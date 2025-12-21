import type { Env, Module, ApiResponse } from '../../types';

// GET /api/modules - List all active modules
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env } = context;

    try {
        const { results } = await env.DB.prepare(
            `SELECT id, name, description, icon, category, created_at 
       FROM modules 
       WHERE is_active = 1 
       ORDER BY category, name`
        ).all<Module>();

        const response: ApiResponse<Module[]> = {
            success: true,
            data: results || [],
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch modules',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
