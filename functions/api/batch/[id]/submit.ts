// POST /api/batch/[id]/submit - Submit batch to Gemini Batch API
import { GoogleGenAI } from "@google/genai";
import { getAuthContext } from '../../../lib/auth';

interface Env {
    DB: D1Database;
    STORAGE: R2Bucket;
    GEMINI_API_KEY: string;
}

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as any);
    }
    return btoa(binary);
}

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
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

        if (batchJob.status !== 'pending') {
            return new Response(JSON.stringify({ error: 'Batch already submitted' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Reset batch items for (re)submit
        await context.env.DB.prepare(
            "UPDATE batch_items SET status = 'pending', error_msg = NULL WHERE batch_id = ?"
        ).bind(batchId).run();

        // Get batch items with image data (stable order is required for inline result mapping)
        const { results: items } = await context.env.DB.prepare(
            `SELECT bi.*, i.r2_key_original, i.prompt 
             FROM batch_items bi 
             JOIN images i ON bi.image_id = i.id 
             WHERE bi.batch_id = ?
             ORDER BY bi.created_at ASC`
        ).bind(batchId).all();

        if (!items || items.length === 0) {
            return new Response(JSON.stringify({ error: 'No items in batch' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get project's module prompt
        const project = await context.env.DB.prepare(
            "SELECT module_prompt FROM jobs WHERE id = ?"
        ).bind(batchJob.project_id).first();

        const modulePrompt = project?.module_prompt || '';

        // Build inline requests for Gemini Batch API
        const inlinedRequests: any[] = [];
        const orderedItemIds: string[] = [];

        // Inline batches must keep total request size under ~20MB.
        // Use a conservative limit to account for JSON overhead.
        const INLINE_WIRE_LIMIT_BYTES = 18 * 1024 * 1024;
        let estimatedWireBytes = 0;

        for (const item of items) {
            // Fetch image from R2
            const r2Key = item.r2_key_original;
            const obj = await context.env.STORAGE.get(r2Key);

            if (!obj) {
                console.warn(`[Batch Submit] Image not found in R2: ${r2Key}`);
                continue;
            }

            // Estimate size before reading full body when possible
            const rawBytes = (obj as any).size ?? undefined;
            if (typeof rawBytes === 'number') {
                // base64 expands to ~4/3, plus JSON overhead
                estimatedWireBytes += Math.ceil(rawBytes / 3) * 4 + 512;
            }

            // Build prompt
            const userPrompt = item.prompt || '';
            const fullPrompt = `${modulePrompt}\n\n${userPrompt}`.trim();
            estimatedWireBytes += new TextEncoder().encode(fullPrompt).length + 256;

            if (estimatedWireBytes > INLINE_WIRE_LIMIT_BYTES) {
                return new Response(JSON.stringify({
                    error: 'Batch too large for inline submit (20MB limit). Reduce batch size or compress images more.',
                    code: 'BATCH_INLINE_TOO_LARGE',
                    estimatedBytes: estimatedWireBytes,
                    limitBytes: INLINE_WIRE_LIMIT_BYTES
                }), { status: 413, headers: { 'Content-Type': 'application/json' } });
            }

            const arrayBuffer = await obj.arrayBuffer();
            const b64Data = arrayBufferToBase64(arrayBuffer);
            const mimeType = obj.httpMetadata?.contentType || 'image/jpeg';

            // Tighten estimate using base64 length
            estimatedWireBytes += b64Data.length + 256;
            if (estimatedWireBytes > INLINE_WIRE_LIMIT_BYTES) {
                return new Response(JSON.stringify({
                    error: 'Batch too large for inline submit (20MB limit). Reduce batch size or compress images more.',
                    code: 'BATCH_INLINE_TOO_LARGE',
                    estimatedBytes: estimatedWireBytes,
                    limitBytes: INLINE_WIRE_LIMIT_BYTES
                }), { status: 413, headers: { 'Content-Type': 'application/json' } });
            }

            inlinedRequests.push({
                key: item.request_key,
                request: {
                    contents: [{
                        role: 'user',
                        parts: [
                            { text: fullPrompt },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: b64Data
                                }
                            }
                        ]
                    }],
                    // Per Batch API docs: use responseModalities for image generation
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"],
                        temperature: 1
                    }
                }
            });

            // IMPORTANT: For inline batch requests, Gemini returns results as an ordered list (no per-item key).
            // Persist the request order so we can map `dest.inlined_responses[i]` back to the corresponding batch_item.
            orderedItemIds.push(item.id);

        }

        if (inlinedRequests.length === 0) {
            return new Response(JSON.stringify({ error: 'No valid images to process' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Initialize Gemini and submit batch
        const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY });
        const modelName = batchJob.model || 'gemini-2.5-flash';

        console.log(`[Batch Submit] Submitting ${inlinedRequests.length} requests to Gemini Batch API`);

        const batchResponse = await ai.batches.create({
            model: modelName,
            src: inlinedRequests.map(r => r.request),
            config: {
                displayName: batchJob.display_name
            }
        });

        const geminiBatchName = batchResponse.name;
        console.log(`[Batch Submit] Created Gemini batch: ${geminiBatchName}`);

        // Update batch job with Gemini batch name
        const now = Date.now();
        await context.env.DB.prepare(
            `UPDATE batch_jobs 
             SET status = 'submitted', gemini_batch_name = ?, submitted_at = ?, last_polled_at = ?
             WHERE id = ?`
        ).bind(geminiBatchName, now, now, batchId).run();

        // Persist ordered item ids for result mapping (inline responses are ordered)
        for (let i = 0; i < orderedItemIds.length; i++) {
            await context.env.DB.prepare(
                "UPDATE batch_items SET result_data = ? WHERE id = ?"
            ).bind(JSON.stringify({ order: i }), orderedItemIds[i]).run();
        }

        // Mark images as actively batch-processing
        for (const item of items) {
            await context.env.DB.prepare(
                "UPDATE images SET status = 'batch_processing' WHERE id = ?"
            ).bind(item.image_id).run();
        }

        return new Response(JSON.stringify({
            success: true,
            geminiBatchName,
            submittedCount: inlinedRequests.length
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[Batch Submit] Error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
