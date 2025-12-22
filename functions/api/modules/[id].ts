import type { Env, Module, ApiResponse } from '../../types';

// GET /api/modules/[id] - Get a single module with full prompt
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, params } = context;
    const moduleId = params.id as string;

    try {
        const module = await env.DB.prepare(
            `SELECT * FROM modules WHERE id = ? AND is_active = 1`
        ).bind(moduleId).first<Module>();

        if (!module) {
            const response: ApiResponse = {
                success: false,
                error: 'Module not found',
            };
            return new Response(JSON.stringify(response), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const response: ApiResponse<Module> = {
            success: true,
            data: module,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch module',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

// PATCH /api/modules/[id] - Update module prompt (system_prompt)
export const onRequestPatch: PagesFunction<Env> = async (context) => {
    const { env, params, request } = context;
    const moduleId = params.id as string;

    try {
        const body = await request.json() as { system_prompt?: string };

        if (body.system_prompt === undefined) {
            const response: ApiResponse = {
                success: false,
                error: 'system_prompt is required',
            };
            return new Response(JSON.stringify(response), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const existing = await env.DB.prepare(
            `SELECT * FROM modules WHERE id = ? AND is_active = 1`
        ).bind(moduleId).first<Module>();

        if (!existing) {
            const response: ApiResponse = {
                success: false,
                error: 'Module not found',
            };
            return new Response(JSON.stringify(response), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        await env.DB.prepare(
            `UPDATE modules SET system_prompt = ? WHERE id = ?`
        ).bind(body.system_prompt, moduleId).run();

        const updated = await env.DB.prepare(
            `SELECT * FROM modules WHERE id = ? AND is_active = 1`
        ).bind(moduleId).first<Module>();

        const response: ApiResponse<Module> = {
            success: true,
            data: updated!,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update module',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
