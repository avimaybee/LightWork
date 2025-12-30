// POST /api/batch/create - Create a batch job from queued images
import { getAuthContext } from '../../lib/auth';
import { createBatchSchema, validateRequest } from '../../lib/validation';

interface Env {
    DB: D1Database;
    STORAGE: R2Bucket;
}

// Helper for consistent JSON responses
function jsonResponse(data: any, status: number = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
    try {
        const auth = await getAuthContext(context.request);
        if (!auth.userId) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const rawBody = await context.request.json();

        // Validate input with Zod schema
        const validation = validateRequest(createBatchSchema, rawBody);
        if (!validation.success) {
            return jsonResponse({ error: validation.error }, 400);
        }

        const { projectId, model } = validation.data;

        // Verify project ownership
        const project = await context.env.DB.prepare(
            "SELECT id, user_id FROM jobs WHERE id = ?"
        ).bind(projectId).first();

        if (!project || project.user_id !== auth.userId) {
            return new Response(JSON.stringify({ error: 'Project not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get queued images for this project (max 50 for cost control)
        const { results: queuedImages } = await context.env.DB.prepare(
            "SELECT id, filename FROM images WHERE job_id = ? AND status = 'queued' LIMIT 50"
        ).bind(projectId).all();

        if (!queuedImages || queuedImages.length === 0) {
            return new Response(JSON.stringify({ error: 'No queued images found' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Create batch job
        const batchId = crypto.randomUUID();
        const now = Date.now();
        const displayName = `batch-${projectId.substring(0, 8)}-${now}`;

        await context.env.DB.prepare(
            `INSERT INTO batch_jobs 
            (id, user_id, project_id, status, model, display_name, request_count, created_at)
            VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`
        ).bind(
            batchId,
            auth.userId,
            projectId,
            model || 'gemini-2.5-flash-image',
            displayName,
            queuedImages.length,
            now
        ).run();

        // Create batch items for each image
        for (const img of queuedImages) {
            const itemId = crypto.randomUUID();
            const requestKey = `req-${itemId}`;

            await context.env.DB.prepare(
                `INSERT INTO batch_items (id, batch_id, image_id, request_key, status, created_at)
                VALUES (?, ?, ?, ?, 'pending', ?)`
            ).bind(itemId, batchId, img.id, requestKey, now).run();

            // Update image status to 'batch_pending' (distinct from real-time processing)
            await context.env.DB.prepare(
                "UPDATE images SET status = 'batch_pending' WHERE id = ?"
            ).bind(img.id).run();
        }

        console.log(`[Batch Create] Created batch ${batchId} with ${queuedImages.length} items`);

        return new Response(JSON.stringify({
            success: true,
            batchId,
            itemCount: queuedImages.length,
            displayName
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[Batch Create] Error:', e);
        // Return full error details for debugging (remove in production later)
        return new Response(JSON.stringify({
            error: e.message || 'Unknown error',
            stack: e.stack,
            details: JSON.stringify(e)
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
