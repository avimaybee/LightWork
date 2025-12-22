import type { Env, Job, ImageRecord, JobWithImages, ApiResponse } from '../../types';

// GET /api/jobs/[id] - Get job details with images
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, params } = context;
    const jobId = params.id as string;

    try {
        const job = await env.DB.prepare(
            'SELECT * FROM jobs WHERE id = ?'
        ).bind(jobId).first<Job>();

        if (!job) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Job not found',
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { results: images } = await env.DB.prepare(
            `SELECT i.*, f.rating 
             FROM images i 
             LEFT JOIN (
                SELECT image_id, rating, MAX(created_at) as max_at 
                FROM feedback 
                GROUP BY image_id
             ) f ON i.id = f.image_id
             WHERE i.job_id = ? 
             ORDER BY i.created_at ASC`
        ).bind(jobId).all<ImageRecord & { rating: number | null }>();

        const response: ApiResponse<JobWithImages> = {
            success: true,
            data: {
                ...job,
                images: images || [],
            },
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch job',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

// PATCH /api/jobs/[id] - Update job (e.g., start processing, cancel)
export const onRequestPatch: PagesFunction<Env> = async (context) => {
    const { env, params, request } = context;
    const jobId = params.id as string;

    try {
        const body = await request.json() as { action?: string; global_prompt?: string; model?: string };

        const job = await env.DB.prepare(
            'SELECT * FROM jobs WHERE id = ?'
        ).bind(jobId).first<Job>();

        if (!job) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Job not found',
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const now = Math.floor(Date.now() / 1000);

        if (body.action === 'start' && job.status === 'PENDING') {
            // Start processing - the Cron will pick up pending images
            await env.DB.prepare(
                `UPDATE jobs SET status = 'PROCESSING', started_at = ?, updated_at = ? WHERE id = ?`
            ).bind(now, now, jobId).run();
        } else if (body.action === 'retry') {
            // Reset FAILED images to PENDING
            const { meta } = await env.DB.prepare(
                `UPDATE images SET status = 'PENDING', error_message = NULL, retry_count = retry_count + 1 WHERE job_id = ? AND status = 'FAILED'`
            ).bind(jobId).run();

            const recoveredCount = meta.changes ?? 0;
            
            if (recoveredCount > 0) {
                // Update job counts and status
                await env.DB.prepare(
                    `UPDATE jobs SET 
                        failed_images = failed_images - ?, 
                        status = 'PROCESSING', 
                        updated_at = ? 
                     WHERE id = ?`
                ).bind(recoveredCount, now, jobId).run();
            }
        } else if (body.action === 'cancel') {
            await env.DB.prepare(
                `UPDATE jobs SET status = 'CANCELLED', updated_at = ? WHERE id = ?`
            ).bind(now, jobId).run();

            // Also cancel pending images
            const { meta } = await env.DB.prepare(
                `UPDATE images SET status = 'FAILED', error_message = 'Job cancelled' WHERE job_id = ? AND status IN ('PENDING', 'RETRY_LATER')`
            ).bind(jobId).run();

            const cancelledCount = meta.changes ?? 0;
            if (cancelledCount > 0) {
                await env.DB.prepare(
                    `UPDATE jobs SET failed_images = failed_images + ?, updated_at = ? WHERE id = ?`
                ).bind(cancelledCount, now, jobId).run();
            }
        } else if (body.model !== undefined) {
            if (job.status !== 'PENDING') {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Can only update model for pending jobs',
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            if (body.model !== 'nano_banana' && body.model !== 'nano_banana_pro') {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Invalid model',
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            await env.DB.prepare(
                `UPDATE jobs SET model = ?, updated_at = ? WHERE id = ?`
            ).bind(body.model, now, jobId).run();
        } else if (body.global_prompt !== undefined) {
            await env.DB.prepare(
                `UPDATE jobs SET global_prompt = ?, updated_at = ? WHERE id = ?`
            ).bind(body.global_prompt, now, jobId).run();
        }

        const updatedJob = await env.DB.prepare(
            'SELECT * FROM jobs WHERE id = ?'
        ).bind(jobId).first<Job>();

        const response: ApiResponse<Job> = {
            success: true,
            data: updatedJob!,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update job',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

// DELETE /api/jobs/[id] - Delete job and associated images
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    const { env, params } = context;
    const jobId = params.id as string;

    try {
        // Get all image keys to delete from R2
        const { results: images } = await env.DB.prepare(
            'SELECT original_key, processed_key, thumbnail_key FROM images WHERE job_id = ?'
        ).bind(jobId).all<ImageRecord>();

        // Delete from R2
        if (images && images.length > 0) {
            const keysToDelete = images.flatMap(img => [
                img.original_key,
                img.processed_key,
                img.thumbnail_key,
            ].filter(Boolean)) as string[];

            await Promise.all(keysToDelete.map(key => env.STORAGE.delete(key)));
        }

        // Delete images (CASCADE should handle this, but be explicit)
        await env.DB.prepare('DELETE FROM images WHERE job_id = ?').bind(jobId).run();

        // Delete job
        await env.DB.prepare('DELETE FROM jobs WHERE id = ?').bind(jobId).run();

        const response: ApiResponse = {
            success: true,
            message: 'Job deleted successfully',
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete job',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
