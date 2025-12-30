import { getAuthContext } from '../../../lib/auth'; // Adjust import
import { corsHeaders } from '../../../lib/utils'; // Adjust import

export async function onRequestPost(context) {
    const { request, env, params } = context;
    const { id } = params;

    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const auth = await getAuthContext(request);
        if (!auth.userId) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }

        // 1. Get Original Project
        const project = await env.DB.prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ?")
            .bind(id, auth.userId)
            .first();

        if (!project) {
            return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers: corsHeaders });
        }

        // 2. Create New Project
        const newProjectId = crypto.randomUUID();
        const newName = `Copy of ${project.name}`;

        await env.DB.prepare(
            "INSERT INTO jobs (id, user_id, name, status, created_at, module_prompt, selected_mode, selected_module_preset) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
            newProjectId,
            auth.userId,
            newName,
            'active',
            Date.now(),
            project.module_prompt || '',
            project.selected_mode || 'fast',
            project.selected_module_preset || ''
        ).run();

        // 3. Copy Images
        const { results: images } = await env.DB.prepare("SELECT * FROM images WHERE job_id = ?").bind(id).all();

        if (images.length > 0) {
            const stmt = env.DB.prepare(`
                INSERT INTO images (id, job_id, status, filename, r2_key_original, r2_key_result, prompt, description, error_msg, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            // Batch Execute
            const batch = images.map(img => stmt.bind(
                crypto.randomUUID(),
                newProjectId,
                img.status,
                img.filename,
                img.r2_key_original,
                img.r2_key_result,
                img.prompt,
                img.description,
                img.error_msg,
                Date.now()
            ));

            await env.DB.batch(batch);
        }

        // Return new project metadata (simplified)
        return new Response(JSON.stringify({
            id: newProjectId,
            name: newName,
            success: true
        }), { headers: corsHeaders });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
}
