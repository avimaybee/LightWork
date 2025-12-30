import { getAuthContext } from '../lib/auth'; // Adjusted import path
import { corsHeaders } from '../lib/utils'; // Adjusted import path

export const onRequest = async (context) => {
    const { request, env } = context;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const auth = await getAuthContext(request);
        if (!auth.userId) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }
        const user = { uid: auth.userId }; // Map for compatibility with existing code

        const url = new URL(request.url);

        // GET /api/favorites - List all favorites
        if (request.method === 'GET') {
            const { results } = await env.DB.prepare(
                "SELECT module_id FROM favorites WHERE user_id = ?"
            )
                .bind(user.uid)
                .all();

            const favoriteIds = results.map(r => r.module_id);
            return new Response(JSON.stringify(favoriteIds), { headers: corsHeaders });
        }

        // POST /api/favorites - Add a favorite
        if (request.method === 'POST') {
            const { moduleId } = await request.json();
            if (!moduleId) {
                return new Response("Missing module_id", { status: 400, headers: corsHeaders });
            }

            await env.DB.prepare(
                "INSERT OR IGNORE INTO favorites (user_id, module_id, created_at) VALUES (?, ?, ?)"
            )
                .bind(user.uid, moduleId, Date.now())
                .run();

            return new Response(JSON.stringify({ success: true, moduleId }), { headers: corsHeaders });
        }

        // DELETE /api/favorites - Remove a favorite
        if (request.method === 'DELETE') {
            const { moduleId } = await request.json(); // Or use query param? Using body for consistency
            if (!moduleId) {
                // Try query param if body is empty? But let's stick to JSON body or query param. DELETE with body is discouraged but often used.
                // Let's use query param for safety: ?moduleId=...
                // Re-checking URL for query param if body fails?
                // Actually, let's stick to URL param for DELETE: /api/favorites?moduleId=xyz
            }

            const targetId = url.searchParams.get('moduleId') || (await request.json().catch(() => ({}))).moduleId;

            if (!targetId) {
                return new Response("Missing moduleId", { status: 400, headers: corsHeaders });
            }

            await env.DB.prepare(
                "DELETE FROM favorites WHERE user_id = ? AND module_id = ?"
            )
                .bind(user.uid, targetId)
                .run();

            return new Response(JSON.stringify({ success: true, moduleId: targetId }), { headers: corsHeaders });
        }

        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
};
