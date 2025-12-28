// GET /api/batch/active - List active batch jobs for current user
import { getAuthContext } from '../../lib/auth';

interface Env {
    DB: D1Database;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
    try {
        const auth = await getAuthContext(context.request);
        if (!auth.userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

                // Get batches that still require client-visible attention.
                // Key idea: users won't keep the tab open for hours, so we treat "not finalized" batches
                // (completed_at IS NULL) as active, even if Gemini already marked them succeeded/failed.
                // This lets the next app visit reconcile results and update images.
         const { results } = await context.env.DB.prepare(
             `SELECT
                  id,
                  user_id as userId,
                  project_id as projectId,
                  status,
                  model,
                  display_name as displayName,
                  request_count as requestCount,
                  completed_count as completedCount,
                  failed_count as failedCount,
                  retry_count as retryCount,
                  created_at as createdAt,
                  submitted_at as submittedAt,
                  completed_at as completedAt
              FROM batch_jobs
              WHERE user_id = ? AND (
                  status IN ('pending', 'submitted', 'running')
                  OR completed_at IS NULL
              )
              ORDER BY created_at DESC`
              ).bind(auth.userId).all();

        return new Response(JSON.stringify({
            batches: results || []
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[Batch Active] Error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
