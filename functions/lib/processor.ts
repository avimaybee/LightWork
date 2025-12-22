/**
 * LightWork Image Processing Service
 * Shared processing logic for both on-demand and scheduled triggers
 */

import type { Env, ImageRecord, Job, Module } from '../types';
import { GeminiService, MODELS } from './gemini';

// Keep this low to avoid long-running HTTP requests and large memory spikes.
// With the current Gemini integration (base64-in-JSON), processing too many large images
// concurrently can exceed the 128MB isolate memory limit.
const IMAGES_PER_RUN = 2;

// Concurrency is bounded to reduce wall time, while staying under Workers connection limits
// (6 outgoing connections per request) and memory constraints.
const MAX_CONCURRENCY = 2;
const MAX_RETRIES = 3;

export interface ProcessResult {
    processed: number;
    completed: number;
    failed: number;
    errors: string[];
}

/**
 * Process pending images from active jobs
 */
export async function processImages(env: Env, ctx?: ExecutionContext): Promise<ProcessResult> {
    const result: ProcessResult = {
        processed: 0,
        completed: 0,
        failed: 0,
        errors: [],
    };

    // Check if API key is configured
    if (!env.GEMINI_API_KEY) {
        result.errors.push('GEMINI_API_KEY not configured');
        return result;
    }

    const now = Math.floor(Date.now() / 1000);

    // CRITICAL: Reset "stuck" processing images (Zombies)
    // If an image has been PROCESSING for > 5 minutes, the worker likely crashed.
    // Reset it to PENDING so it can be picked up again.
    const STUCK_THRESHOLD_SECONDS = 300; // 5 minutes
    await env.DB.prepare(
        `UPDATE images 
         SET status = 'PENDING', updated_at = ? 
         WHERE status = 'PROCESSING' 
         AND updated_at < ?`
    ).bind(now, now - STUCK_THRESHOLD_SECONDS).run();

    // Get pending images from active jobs (include model selection)
    // We use a subquery to find candidates and then update them to 'PROCESSING' in one go to "claim" them
    
    const { results: claimedImages } = await env.DB.prepare(
        `UPDATE images 
         SET status = 'PROCESSING', updated_at = ? 
         WHERE id IN (
             SELECT i.id 
             FROM images i
             JOIN jobs j ON i.job_id = j.id
             WHERE i.status IN ('PENDING', 'RETRY_LATER')
             AND j.status = 'PROCESSING'
             AND i.retry_count < ?
             AND (i.next_retry_at IS NULL OR i.next_retry_at <= ?)
             ORDER BY i.created_at ASC
             LIMIT ?
         )
         RETURNING *`
    ).bind(now, MAX_RETRIES, now, IMAGES_PER_RUN).all<ImageRecord>();

    if (!claimedImages || claimedImages.length === 0) {
        console.log('🍌 No pending images to process');
        await checkAndCompleteJobs(env);
        return result;
    }

    // We need the job info (module_id, model) for these images
    // Since RETURNING * only gives image columns, we fetch the job info separately or join
    // Actually, it's better to fetch the full joined data for the claimed IDs
    const imageIds = claimedImages.map(img => img.id);
    const placeholders = imageIds.map(() => '?').join(',');
    
    const { results: pendingImages } = await env.DB.prepare(
        `SELECT i.*, j.module_id, j.model
         FROM images i
         JOIN jobs j ON i.job_id = j.id
         WHERE i.id IN (${placeholders})`
    ).bind(...imageIds).all<ImageRecord & { module_id: string; model: string | null }>();

    if (!pendingImages || pendingImages.length === 0) {
        return result;
    }

    console.log(`🍌 Processing ${pendingImages.length} images`);

    // Run cleanup occasionally (10% chance per run to avoid overhead)
    if (Math.random() < 0.1) {
        ctx?.waitUntil?.(cleanupOldJobs(env));
    }

    // For Pro model jobs, keep concurrency at 1 to reduce memory spikes (larger outputs / thinking).
    const hasProModel = pendingImages.some(img => img.model === 'nano_banana_pro');
    const concurrency = hasProModel ? 1 : MAX_CONCURRENCY;

    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, pendingImages.length) }, async () => {
        while (true) {
            const index = cursor++;
            if (index >= pendingImages.length) return;

            const image = pendingImages[index];
            const imageResult = await processImage(env, image);
            result.processed++;
            if (imageResult.success) {
                result.completed++;
            } else {
                result.failed++;
                if (imageResult.error) {
                    result.errors.push(`Image ${image.id}: ${imageResult.error}`);
                }
            }
        }
    });

    await Promise.all(workers);

    // Check if any jobs are now complete
    await checkAndCompleteJobs(env);

    return result;
}

async function processImage(
    env: Env,
    image: ImageRecord & { module_id: string; model: string | null }
): Promise<{ success: boolean; error?: string }> {
    const now = Math.floor(Date.now() / 1000);

    try {
        // Get the module
        const module = await env.DB.prepare(
            'SELECT * FROM modules WHERE id = ?'
        ).bind(image.module_id).first<Module>();

        if (!module) {
            throw new Error('Module not found');
        }

        // Get original image from R2
        const originalObject = await env.STORAGE.get(image.original_key);
        if (!originalObject) {
            throw new Error('Original image not found in storage');
        }

        const imageBuffer = await originalObject.arrayBuffer();

        // Determine which Gemini model to use based on job selection
        const modelId = image.model === 'nano_banana_pro'
            ? MODELS.NANO_BANANA_PRO
            : MODELS.NANO_BANANA;

        const gemini = new GeminiService(env.GEMINI_API_KEY, modelId);

        // Process with Gemini
        const result = await gemini.processImage(
            imageBuffer,
            image.mime_type || 'image/jpeg',
            module,
            image.specific_prompt
        );

        if (!result.success) {
            // Handle rate limiting and overloaded models with exponential backoff
            if (result.error === 'RATE_LIMITED' || result.error === 'MODEL_OVERLOADED') {
                const isOverloaded = result.error === 'MODEL_OVERLOADED';
                const backoffSeconds = Math.pow(2, image.retry_count + 1) * (isOverloaded ? 15 : 30); 
                const nextRetry = now + backoffSeconds;
                
                console.log(`🍌 ${result.error} on image ${image.id}, retrying in ${backoffSeconds}s`);
                
                await env.DB.prepare(
                    `UPDATE images SET 
                     status = 'RETRY_LATER', 
                     error_message = ?,
                     retry_count = retry_count + 1,
                     next_retry_at = ?
                     WHERE id = ?`
                ).bind(
                    isOverloaded ? 'Gemini is busy. Retrying...' : 'Rate limit exceeded. Retrying...',
                    nextRetry, 
                    image.id
                ).run();
                
                return { success: false, error: result.error };
            }

            // Map Safety Blocks
            if (result.error?.startsWith('SAFETY_BLOCKED')) {
                throw new Error('Blocked by AI Safety filters. Please try a different prompt.');
            }

            throw new Error(result.error || 'Processing failed');
        }

        // Determine file extension from MIME type
        const outputMimeType = result.mimeType || 'image/png';
        const extension = outputMimeType === 'image/jpeg' ? 'jpg' :
            outputMimeType === 'image/webp' ? 'webp' : 'png';

        // Save processed image to R2 with correct extension
        const processedKey = `processed/${image.job_id}/${image.id}-processed.${extension}`;
        await env.STORAGE.put(processedKey, result.imageData!, {
            httpMetadata: {
                contentType: outputMimeType,
            },
        });

        // Update database
        await env.DB.prepare(
            `UPDATE images SET 
        status = 'COMPLETED', 
        processed_key = ?, 
        processed_mime_type = ?,
        processed_at = ?
       WHERE id = ?`
        ).bind(processedKey, outputMimeType, now, image.id).run();

        // Update job completed count
        await env.DB.prepare(
            `UPDATE jobs SET completed_images = completed_images + 1, updated_at = ? WHERE id = ?`
        ).bind(now, image.job_id).run();

        console.log(`🍌 Successfully processed image ${image.id}`);
        return { success: true };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`🍌 Failed to process image ${image.id}:`, errorMessage);

        if (image.retry_count >= MAX_RETRIES - 1) {
            // Mark as failed after max retries
            await env.DB.prepare(
                `UPDATE images SET 
          status = 'FAILED', 
          error_message = ?,
          retry_count = retry_count + 1
         WHERE id = ?`
            ).bind(errorMessage, image.id).run();

            // Update job failed count
            await env.DB.prepare(
                `UPDATE jobs SET failed_images = failed_images + 1, updated_at = ? WHERE id = ?`
            ).bind(now, image.job_id).run();
        } else {
            // Mark for retry with backoff
            const backoffSeconds = Math.pow(2, image.retry_count + 1) * 60; // 120s, 240s, 480s...
            const nextRetry = now + backoffSeconds;

            await env.DB.prepare(
                `UPDATE images SET 
          status = 'RETRY_LATER', 
          error_message = ?,
          retry_count = retry_count + 1,
          next_retry_at = ?
         WHERE id = ?`
            ).bind(errorMessage, nextRetry, image.id).run();
        }

        return { success: false, error: errorMessage };
    }
}

async function checkAndCompleteJobs(env: Env): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    // Find jobs where all images are processed (completed or failed)
    const { results: processingJobs } = await env.DB.prepare(
        `SELECT j.id, j.total_images, j.completed_images, j.failed_images
     FROM jobs j
     WHERE j.status = 'PROCESSING'`
    ).all<Job>();

    if (!processingJobs) return;

    for (const job of processingJobs) {
        const processedCount = job.completed_images + job.failed_images;

        if (processedCount >= job.total_images) {
            // Check if there are any images still pending/retrying
            const { results: remaining } = await env.DB.prepare(
                `SELECT COUNT(*) as count FROM images 
         WHERE job_id = ? AND status IN ('PENDING', 'PROCESSING', 'RETRY_LATER')`
            ).bind(job.id).all<{ count: number }>();

            if (!remaining || remaining[0]?.count === 0) {
                // Job is complete
                const finalStatus = job.failed_images === job.total_images ? 'FAILED' : 'COMPLETED';

                await env.DB.prepare(
                    `UPDATE jobs SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?`
                ).bind(finalStatus, now, now, job.id).run();

                console.log(`🍌 Job ${job.id} marked as ${finalStatus}`);
            }
        }
    }
}

/**
 * Delete jobs and images older than 24 hours
 */
export async function cleanupOldJobs(env: Env): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const CLEANUP_THRESHOLD = 24 * 60 * 60; // 24 hours
    const cutoff = now - CLEANUP_THRESHOLD;

    console.log(`✨ Starting cleanup for jobs older than ${new Date(cutoff * 1000).toISOString()}`);

    try {
        // Find old jobs
        const { results: oldJobs } = await env.DB.prepare(
            'SELECT id FROM jobs WHERE created_at < ?'
        ).bind(cutoff).all<{ id: string }>();

        if (!oldJobs || oldJobs.length === 0) {
            console.log('✨ No old jobs to clean up');
            return;
        }

        console.log(`✨ Cleaning up ${oldJobs.length} old jobs`);

        for (const job of oldJobs) {
            // Find all images for this job
            const { results: images } = await env.DB.prepare(
                'SELECT original_key, processed_key, thumbnail_key FROM images WHERE job_id = ?'
            ).bind(job.id).all<{ original_key: string | null, processed_key: string | null, thumbnail_key: string | null }>();

            // Delete from R2
            const keysToDelete = images.flatMap(img => [
                img.original_key,
                img.processed_key,
                img.thumbnail_key
            ]).filter(Boolean) as string[];

            if (keysToDelete.length > 0) {
                // Delete in batches of 20 to avoid R2 limits/timeouts
                for (let i = 0; i < keysToDelete.length; i += 20) {
                    const batch = keysToDelete.slice(i, i + 20);
                    await Promise.all(batch.map(key => env.STORAGE.delete(key)));
                }
            }

            // Delete from D1 (Cascade should handle images if configured, but we'll be explicit)
            await env.DB.prepare('DELETE FROM images WHERE job_id = ?').bind(job.id).run();
            await env.DB.prepare('DELETE FROM jobs WHERE id = ?').bind(job.id).run();
        }

        console.log('✨ Cleanup completed successfully');
    } catch (error) {
        console.error('✨ Cleanup failed:', error);
    }
}
