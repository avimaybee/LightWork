/**
 * POST /api/process-parallel
 * 
 * Process multiple images in parallel with rate limiting and error handling.
 * Utilizes Tier 1 Gemini API limits (500 RPM, 500K TPM) safely.
 */

import { GoogleGenAI } from "@google/genai";
import { getAuthContext } from '../lib/auth';
import { GEMINI_LIMITS, estimateTokens } from '../lib/rateLimitConfig';
import { processInParallel, ProcessingTask, ProcessingResult, retryFailedTasks } from '../lib/parallelProcessor';
import { recordMetric, getUsageStats, shouldThrottle } from '../lib/metricsTracker';
import { withCircuitBreaker, getCircuitStatus } from '../lib/circuitBreaker';

interface Env {
    DB: D1Database;
    STORAGE: R2Bucket;
    GEMINI_API_KEY: string;
}

interface ProcessImageData {
    jobId: string;
    imageData: string;
    mimeType: string;
    prompt: string;
}

// Helper for consistent JSON responses
function jsonResponse(data: any, status: number = 200, extraHeaders?: Record<string, string>) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) }
    });
}

/**
 * Convert ArrayBuffer to base64 safely without stack overflow.
 * Uses chunked approach that works within call stack limits.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    // Use smaller chunks to avoid any potential stack issues
    // 4096 is very conservative and works on all platforms
    const chunkSize = 4096;
    const chunks: string[] = [];
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        // Build string character by character to avoid apply() limitations
        let str = '';
        for (let j = 0; j < chunk.length; j++) {
            str += String.fromCharCode(chunk[j]);
        }
        chunks.push(str);
    }
    
    return btoa(chunks.join(''));
}

/**
 * Process a single image with Gemini
 */
async function processImage(
    ai: GoogleGenAI,
    modelName: string,
    data: ProcessImageData
): Promise<{ success: boolean; imageBytes?: string; error?: string }> {
    const startTime = Date.now();
    
    try {
        const requestPayload = {
            model: modelName,
            contents: [{
                role: 'user',
                parts: [
                    { text: data.prompt },
                    {
                        inlineData: {
                            mimeType: data.mimeType,
                            data: data.imageData
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 1,
                responseMimeType: "image/png"
            }
        };

        const response = await ai.models.generateContent(requestPayload);
        
        const parts = response.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p: any) => p.inlineData);

        if (!imagePart?.inlineData?.data) {
            const textPart = parts.find((p: any) => p.text);
            throw new Error(textPart 
                ? `Model returned text: ${(textPart as any).text?.substring(0, 100)}...`
                : "No image in response"
            );
        }

        // Record success metric
        recordMetric({
            duration: Date.now() - startTime,
            tokens: estimateTokens(data.imageData.length, data.prompt.length),
            success: true,
        });

        return { success: true, imageBytes: imagePart.inlineData.data };
    } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error';
        
        // Record failure metric
        recordMetric({
            duration: Date.now() - startTime,
            tokens: estimateTokens(data.imageData.length, data.prompt.length),
            success: false,
            errorType: errorMessage.includes('429') ? '429_rate_limit' : 
                       errorMessage.includes('503') ? '503_unavailable' : 'error',
        });

        // Determine if retryable
        const isRetryable = 
            errorMessage.includes('429') ||
            errorMessage.includes('503') ||
            errorMessage.includes('RESOURCE_EXHAUSTED');

        const err: any = new Error(errorMessage);
        err.retryable = isRetryable;
        
        // Parse retry delay
        const retryMatch = errorMessage.match(/retryDelay[^0-9]*"?(\d+)s"?/i);
        if (retryMatch) {
            err.retryAfterMs = parseInt(retryMatch[1], 10) * 1000;
        }
        
        throw err;
    }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
    try {
        const auth = await getAuthContext(context.request);
        if (!auth.userId) {
            return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
        }

        // Check if system should throttle
        const throttleCheck = shouldThrottle();
        if (throttleCheck.throttle) {
            return jsonResponse({
                success: false,
                error: throttleCheck.reason,
                retryAfterMs: throttleCheck.recommendedDelayMs,
            }, 429, {
                'Retry-After': String(Math.ceil((throttleCheck.recommendedDelayMs || 5000) / 1000))
            });
        }

        // Check circuit breaker
        const circuitStatus = getCircuitStatus();
        if (circuitStatus.state === 'open') {
            return jsonResponse({
                success: false,
                error: 'Service temporarily unavailable (circuit open)',
                circuitState: circuitStatus.state,
            }, 503);
        }

        const body = await context.request.json();
        const { jobIds, model, systemPrompt } = body;

        if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
            return jsonResponse({ success: false, error: 'jobIds array required' }, 400);
        }

        // Limit batch size for safety
        const maxBatchSize = Math.min(GEMINI_LIMITS.BATCH_SIZE * 3, 30); // Max 30 at once
        if (jobIds.length > maxBatchSize) {
            return jsonResponse({ 
                success: false, 
                error: `Batch size exceeds maximum (${maxBatchSize}). Process in smaller batches.` 
            }, 400);
        }

        console.log(`[Process Parallel] Processing ${jobIds.length} images`);

        // Initialize Gemini
        const apiKey = context.env.GEMINI_API_KEY;
        if (!apiKey) {
            return jsonResponse({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);
        }
        const ai = new GoogleGenAI({ apiKey });
        const modelName = model || 'gemini-2.5-flash-image';

        // Fetch images from DB and R2
        const tasks: ProcessingTask<ProcessImageData, { imageBytes: string }>[] = [];

        for (const jobId of jobIds) {
            // Verify ownership and get image
            const imageRecord = await context.env.DB.prepare(
                `SELECT i.*, j.module_prompt
                 FROM images i
                 JOIN jobs j ON i.job_id = j.id
                 WHERE i.id = ? AND j.user_id = ?`
            ).bind(jobId, auth.userId).first();

            if (!imageRecord) {
                console.warn(`[Process Parallel] Image not found or not owned: ${jobId}`);
                continue;
            }

            // Get image from R2
            const obj = await context.env.STORAGE.get(imageRecord.r2_key_original);
            if (!obj) {
                console.warn(`[Process Parallel] Image not in R2: ${jobId}`);
                continue;
            }

            const arrayBuffer = await obj.arrayBuffer();
            const b64Data = arrayBufferToBase64(arrayBuffer);
            const mimeType = obj.httpMetadata?.contentType || 'image/jpeg';
            const fullPrompt = `${systemPrompt || imageRecord.module_prompt || ''}\n\n${imageRecord.prompt || ''}`.trim();

            tasks.push({
                id: jobId,
                data: {
                    jobId,
                    imageData: b64Data,
                    mimeType,
                    prompt: fullPrompt,
                },
                processor: async (data) => {
                    const result = await withCircuitBreaker(() => 
                        processImage(ai, modelName, data)
                    );
                    if (!result.success || !result.imageBytes) {
                        throw new Error(result.error || 'Processing failed');
                    }
                    return { imageBytes: result.imageBytes };
                },
                estimatedTokens: estimateTokens(b64Data.length, fullPrompt.length),
            });
        }

        if (tasks.length === 0) {
            return jsonResponse({ success: false, error: 'No valid images to process' }, 400);
        }

        console.log(`[Process Parallel] Prepared ${tasks.length} tasks for processing`);

        // Process in parallel with throttling
        const results = await processInParallel(tasks, {
            maxConcurrent: GEMINI_LIMITS.MAX_CONCURRENT_PER_REQUEST,
            batchDelayMs: GEMINI_LIMITS.INTER_BATCH_DELAY_MS,
        });

        // Retry failed tasks once
        const failed = results.filter(r => !r.success && r.retryable);
        if (failed.length > 0) {
            console.log(`[Process Parallel] Retrying ${failed.length} failed tasks`);
            const retryResults = await retryFailedTasks(failed, tasks, 1); // 1 retry
            
            // Merge retry results
            for (const retryResult of retryResults) {
                const idx = results.findIndex(r => r.id === retryResult.id);
                if (idx >= 0) {
                    results[idx] = retryResult;
                }
            }
        }

        // Save results to R2 and update DB
        const processed: { jobId: string; success: boolean; error?: string }[] = [];

        for (const result of results) {
            if (result.success && result.result?.imageBytes) {
                const resultKey = `result-${result.id}.png`;
                
                // Decode base64 to binary
                const binaryString = atob(result.result.imageBytes);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                // Save to R2
                await context.env.STORAGE.put(resultKey, bytes, {
                    httpMetadata: { contentType: 'image/png' }
                });

                // Update DB
                await context.env.DB.prepare(
                    "UPDATE images SET status = ?, r2_key_result = ? WHERE id = ?"
                ).bind('completed', resultKey, result.id).run();

                processed.push({ jobId: result.id, success: true });
            } else {
                // Update DB with error
                await context.env.DB.prepare(
                    "UPDATE images SET status = ?, error_msg = ? WHERE id = ?"
                ).bind('error', result.error || 'Processing failed', result.id).run();

                processed.push({ jobId: result.id, success: false, error: result.error });
            }
        }

        const successCount = processed.filter(p => p.success).length;
        const failCount = processed.filter(p => !p.success).length;

        // Get current usage for response
        const usageStats = getUsageStats();

        console.log(`[Process Parallel] Completed: ${successCount} success, ${failCount} failed`);

        return jsonResponse({
            success: true,
            processed,
            summary: {
                total: processed.length,
                success: successCount,
                failed: failCount,
            },
            usage: {
                currentRpm: usageStats.currentRpm,
                rpmUtilization: usageStats.rpmUtilization,
                status: usageStats.status,
            }
        });

    } catch (e: any) {
        console.error('[Process Parallel] Error:', e);
        return jsonResponse({
            success: false,
            error: e.message || 'Internal error',
        }, 500);
    }
}
