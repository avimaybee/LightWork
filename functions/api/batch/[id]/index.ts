// GET /api/batch/[id] - Get batch status, poll Gemini if running
import { GoogleGenAI } from "@google/genai";
import { getAuthContext } from '../../../lib/auth';

interface Env {
    DB: D1Database;
    STORAGE: R2Bucket;
    GEMINI_API_KEY: string;
}

const POLL_THROTTLE_MS = 60000; // Min 60s between Gemini API calls per batch

const AUTO_RESUBMIT_THROTTLE_MS = 60000; // Don't auto-resubmit more than once per minute

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
    try {
        const auth = await getAuthContext(context.request);
        if (!auth.userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const batchId = context.params.id;

        // Get batch job
        const batchJob = await context.env.DB.prepare(
            "SELECT * FROM batch_jobs WHERE id = ? AND user_id = ?"
        ).bind(batchId, auth.userId).first();

        if (!batchJob) {
            return new Response(JSON.stringify({ error: 'Batch not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const now = Date.now();
        let status = batchJob.status;
        let shouldPollGemini = false;

        // Cloudflare Pages Functions has no cron triggers.
        // To still support "auto-retry", we opportunistically resubmit retryable pending batches
        // when the client polls status.
        if (
            status === 'pending' &&
            (batchJob.retry_count || 0) > 0 &&
            !batchJob.gemini_batch_name
        ) {
            const lastActionAt = batchJob.last_polled_at || 0;
            if (now - lastActionAt >= AUTO_RESUBMIT_THROTTLE_MS) {
                try {
                    await context.env.DB.prepare(
                        "UPDATE batch_jobs SET last_polled_at = ? WHERE id = ?"
                    ).bind(now, batchId).run();

                    // Reuse the submit logic inline here (keeps deploy surface small)
                    const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY });

                    const project = await context.env.DB.prepare(
                        "SELECT module_prompt FROM jobs WHERE id = ? AND user_id = ?"
                    ).bind(batchJob.project_id, auth.userId).first();
                    const modulePrompt = project?.module_prompt || '';

                    const { results: items } = await context.env.DB.prepare(
                        `SELECT bi.*, i.r2_key_original, i.prompt
                         FROM batch_items bi
                         JOIN images i ON bi.image_id = i.id
                         WHERE bi.batch_id = ?
                         ORDER BY bi.created_at ASC`
                    ).bind(batchId).all();

                    if (items && items.length > 0) {
                        await context.env.DB.prepare(
                            "UPDATE batch_items SET status = 'pending', error_msg = NULL WHERE batch_id = ?"
                        ).bind(batchId).run();

                        const INLINE_WIRE_LIMIT_BYTES = 18 * 1024 * 1024;
                        let estimatedWireBytes = 0;
                        const inlined = [] as any[];
                        const orderedIds: string[] = [];

                        const textEncoder = new TextEncoder();

                        for (const item of items) {
                            const obj = await context.env.STORAGE.get(item.r2_key_original);
                            if (!obj) continue;

                            const rawBytes = (obj as any).size ?? undefined;
                            if (typeof rawBytes === 'number') {
                                estimatedWireBytes += Math.ceil(rawBytes / 3) * 4 + 512;
                            }

                            const fullPrompt = `${modulePrompt}\n\n${item.prompt || ''}`.trim();
                            estimatedWireBytes += textEncoder.encode(fullPrompt).length + 256;
                            if (estimatedWireBytes > INLINE_WIRE_LIMIT_BYTES) {
                                // Too large: leave pending so the user can split batches.
                                break;
                            }

                            const ab = await obj.arrayBuffer();
                            // base64 encode (chunked)
                            const bytes = new Uint8Array(ab);
                            let binary = '';
                            const chunkSize = 8192;
                            for (let i = 0; i < bytes.length; i += chunkSize) {
                                const chunk = bytes.subarray(i, i + chunkSize);
                                binary += String.fromCharCode.apply(null, chunk as any);
                            }
                            const b64 = btoa(binary);
                            estimatedWireBytes += b64.length + 256;
                            if (estimatedWireBytes > INLINE_WIRE_LIMIT_BYTES) {
                                break;
                            }

                            inlined.push({
                                contents: [{
                                    role: 'user',
                                    parts: [
                                        { text: fullPrompt },
                                        { inlineData: { mimeType: obj.httpMetadata?.contentType || 'image/jpeg', data: b64 } }
                                    ]
                                }],
                                generationConfig: { responseModalities: ["TEXT", "IMAGE"], temperature: 1 }
                            });
                            orderedIds.push(item.id);
                        }

                        if (inlined.length === items.length && inlined.length > 0) {
                            const modelName = batchJob.model || 'gemini-2.5-flash-image';
                            const batchResponse = await ai.batches.create({
                                model: modelName,
                                src: inlined,
                                config: { displayName: batchJob.display_name }
                            });

                            const geminiBatchName = batchResponse.name;
                            const submittedAt = Date.now();
                            await context.env.DB.prepare(
                                `UPDATE batch_jobs
                                 SET status = 'submitted', gemini_batch_name = ?, submitted_at = ?, last_polled_at = ?
                                 WHERE id = ?`
                            ).bind(geminiBatchName, submittedAt, submittedAt, batchId).run();

                            for (let i = 0; i < orderedIds.length; i++) {
                                await context.env.DB.prepare(
                                    "UPDATE batch_items SET result_data = ? WHERE id = ?"
                                ).bind(JSON.stringify({ order: i }), orderedIds[i]).run();
                            }

                            for (const item of items) {
                                await context.env.DB.prepare(
                                    "UPDATE images SET status = 'batch_processing' WHERE id = ?"
                                ).bind(item.image_id).run();
                            }

                            status = 'submitted';
                        }
                    }
                } catch (e: any) {
                    console.error('[Batch Auto-Resubmit] Error:', e?.message || e);
                }
            }
        }

        // Poll Gemini for:
        // - active batches (submitted/running)
        // - reconcile-needed batches (status already terminal but DB not finalized: completed_at is NULL)
        // This is critical because the client may close the tab before results are imported.
        const needsReconcile = !batchJob.completed_at && (status === 'succeeded' || status === 'failed' || status === 'cancelled');

        // Only poll Gemini for pollable batches, with throttling
        if ((status === 'submitted' || status === 'running' || needsReconcile) && batchJob.gemini_batch_name) {
            const lastPolled = batchJob.last_polled_at || 0;
            if (now - lastPolled >= POLL_THROTTLE_MS) {
                shouldPollGemini = true;
            }
        }

        if (shouldPollGemini) {
            try {
                const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY });
                const geminiBatch = await ai.batches.get({ name: batchJob.gemini_batch_name });

                const geminiStateName = (geminiBatch as any).state?.name ?? (geminiBatch as any).state;
                console.log(`[Batch Status] Gemini state: ${geminiStateName}`);

                // Map Gemini state to our status
                const stateMap: Record<string, string> = {
                    'JOB_STATE_PENDING': 'submitted',
                    'JOB_STATE_RUNNING': 'running',
                    'JOB_STATE_SUCCEEDED': 'succeeded',
                    'JOB_STATE_FAILED': 'failed',
                    'JOB_STATE_CANCELLED': 'cancelled',
                    'JOB_STATE_EXPIRED': 'failed'
                };

                const newStatus = stateMap[geminiStateName] || status;

                // Update last_polled_at and status
                await context.env.DB.prepare(
                    "UPDATE batch_jobs SET last_polled_at = ?, status = ? WHERE id = ?"
                ).bind(now, newStatus, batchId).run();

                status = newStatus;

                // If succeeded, process results.
                // Per @google/genai BatchJobDestination: inline results are in `dest.inlinedResponses`.
                // (Some raw API payloads may use snake_case; support both.)
                const inlinedResponses = (geminiBatch as any).dest?.inlinedResponses
                    ?? (geminiBatch as any).dest?.inlined_responses;

                if (newStatus === 'succeeded' && Array.isArray(inlinedResponses)) {
                    await processResults(context.env, batchId, inlinedResponses);
                }

                // If cancelled, mark finalized
                if (newStatus === 'cancelled') {
                    await context.env.DB.prepare(
                        "UPDATE batch_jobs SET completed_at = ? WHERE id = ?"
                    ).bind(now, batchId).run();
                }


                // If failed and retry_count < 3, schedule retry
                if (newStatus === 'failed' && (batchJob.retry_count || 0) < 3) {
                    const retryCount = (batchJob.retry_count || 0) + 1;
                    await context.env.DB.prepare(
                        "UPDATE batch_jobs SET status = 'pending', retry_count = ?, gemini_batch_name = NULL, submitted_at = NULL, last_polled_at = ? WHERE id = ?"
                    ).bind(retryCount, now, batchId).run();
                    status = 'pending'; // Will be retried
                    console.log(`[Batch Status] Scheduled retry ${retryCount}/3 for batch ${batchId}`);
                }

                // If failed and no retries left, mark finalized so it doesn't linger forever.
                if (newStatus === 'failed' && (batchJob.retry_count || 0) >= 3) {
                    await context.env.DB.prepare(
                        "UPDATE batch_jobs SET completed_at = ? WHERE id = ?"
                    ).bind(now, batchId).run();
                }

            } catch (pollError: any) {
                console.error('[Batch Status] Gemini poll error:', pollError.message);
                // Don't fail the request, just return cached status
            }
        }

        // Get item counts
        const itemStats = await context.env.DB.prepare(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
             FROM batch_items WHERE batch_id = ?`
        ).bind(batchId).first();

        return new Response(JSON.stringify({
            id: batchJob.id,
            projectId: batchJob.project_id,
            status: status,
            model: batchJob.model,
            displayName: batchJob.display_name,
            requestCount: batchJob.request_count,
            completedCount: itemStats?.completed || 0,
            failedCount: itemStats?.failed || 0,
            retryCount: batchJob.retry_count,
            createdAt: batchJob.created_at,
            submittedAt: batchJob.submitted_at,
            completedAt: batchJob.completed_at
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[Batch Status] Error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Process batch results and save to R2
async function processResults(env: Env, batchId: string, responses: any[]) {
    console.log(`[Batch Results] Processing ${responses.length} results`);

    let completedCount = 0;
    let failedCount = 0;

    // For inline batches, responses are ordered and do not include the user-defined key.
    // We stored per-item order index in `batch_items.result_data` as `{ order: number }`.
    for (let idx = 0; idx < responses.length; idx++) {
        const response = responses[idx];

        const item = await env.DB.prepare(
            "SELECT * FROM batch_items WHERE batch_id = ? AND result_data = ?"
        ).bind(batchId, JSON.stringify({ order: idx })).first();

        if (!item) continue;

        try {
            // Check for error
            if (response.error) {
                await env.DB.prepare(
                    "UPDATE batch_items SET status = 'failed', error_msg = ? WHERE id = ?"
                ).bind(response.error.message || 'Unknown error', item.id).run();

                await env.DB.prepare(
                    "UPDATE images SET status = 'error', error_msg = ? WHERE id = ?"
                ).bind(response.error.message, item.image_id).run();

                failedCount++;
                continue;
            }

            // Extract image from response
            const content = response.response?.candidates?.[0]?.content;
            const imagePart = content?.parts?.find((p: any) => p.inlineData);

            if (!imagePart?.inlineData?.data) {
                await env.DB.prepare(
                    "UPDATE batch_items SET status = 'failed', error_msg = 'No image in response' WHERE id = ?"
                ).bind(item.id).run();
                failedCount++;
                continue;
            }

            // Save to R2
            const resultKey = `result-${item.image_id}.png`;
            const binaryString = atob(imagePart.inlineData.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            await env.STORAGE.put(resultKey, bytes, {
                httpMetadata: { contentType: 'image/png' }
            });

            // Update batch_item
            await env.DB.prepare(
                "UPDATE batch_items SET status = 'succeeded' WHERE id = ?"
            ).bind(item.id).run();

            // Update images table
            await env.DB.prepare(
                "UPDATE images SET status = 'completed', r2_key_result = ? WHERE id = ?"
            ).bind(resultKey, item.image_id).run();

            completedCount++;

        } catch (itemError: any) {
            console.error(`[Batch Results] Error processing item ${item.id}:`, itemError);
            failedCount++;
        }
    }

    // Update batch job counts and status
    const finalStatus = failedCount > 0 && completedCount === 0 ? 'failed' : 'succeeded';
    await env.DB.prepare(
        `UPDATE batch_jobs 
         SET completed_count = ?, failed_count = ?, status = ?, completed_at = ?
         WHERE id = ?`
    ).bind(completedCount, failedCount, finalStatus, Date.now(), batchId).run();

    console.log(`[Batch Results] Completed: ${completedCount}, Failed: ${failedCount}`);
}
