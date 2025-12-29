
import { getAuthContext } from '../lib/auth';
import { createModuleSchema, validateRequest } from '../lib/validation';

// Helper for consistent JSON responses
function jsonResponse(data: any, status: number = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequestGet(context: any) {
    try {
        const auth = await getAuthContext(context.request);

        // Fetch user's custom modules (or all if no auth for public modules)
        let query = "SELECT * FROM modules";
        let params: string[] = [];

        if (auth.userId) {
            // Get modules for this user OR system modules (null user_id)
            query = "SELECT * FROM modules WHERE user_id = ? OR user_id IS NULL";
            params = [auth.userId];
        } else {
            // Only system modules for unauthenticated users
            query = "SELECT * FROM modules WHERE user_id IS NULL";
        }

        const stmt = params.length > 0
            ? context.env.DB.prepare(query).bind(...params)
            : context.env.DB.prepare(query);

        const { results } = await stmt.all();

        // Map to frontend structure
        const modules = results.map((m: any) => ({
            id: m.id,
            name: m.name,
            prompt: m.prompt,
            isCustom: m.user_id !== null
        }));
        return new Response(JSON.stringify(modules), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response("[]", {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestPost(context: any) {
    try {
        const auth = await getAuthContext(context.request);

        if (!auth.userId) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const rawBody = await context.request.json();
        
        // Validate input with Zod schema
        const validation = validateRequest(createModuleSchema, rawBody);
        if (!validation.success) {
            return jsonResponse({ error: validation.error }, 400);
        }
        
        const { name, systemPrompt, userPrompt } = validation.data;
        const id = crypto.randomUUID();
        
        // Combine system and user prompts for storage
        const prompt = systemPrompt + (userPrompt ? '\n\n' + userPrompt : '');

        await context.env.DB.prepare(
            "INSERT INTO modules (id, user_id, name, prompt, category) VALUES (?, ?, ?, ?, ?)"
        ).bind(id, auth.userId, name, prompt, 'custom').run();

        return jsonResponse({ id, name, prompt, isCustom: true });
    } catch (e: any) {
        return jsonResponse({ error: e.message }, 500);
    }
}
