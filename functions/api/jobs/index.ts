import type { Env, Job, JobWithModule, CreateJobRequest, ApiResponse } from '../../types';

// Helper to generate UUID
function generateId(): string {
    return crypto.randomUUID();
}

// GET /api/jobs - List all jobs
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, request } = context;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const search = url.searchParams.get('q');

    try {
        let query = `
            SELECT j.*, m.name as module_name, m.icon as module_icon
            FROM jobs j
            JOIN modules m ON j.module_id = m.id
        `;
        const params: (string | number)[] = [];

        if (search) {
            query += ` WHERE m.name LIKE ? OR j.id LIKE ? `;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY j.created_at DESC LIMIT ? OFFSET ? `;
        params.push(limit, offset);

        const { results } = await env.DB.prepare(query).bind(...params).all<JobWithModule>();

        const response: ApiResponse<JobWithModule[]> = {
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
            error: error instanceof Error ? error.message : 'Failed to fetch jobs',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

// POST /api/jobs - Create a new job
export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { env, request } = context;

    try {
        const body = await request.json() as CreateJobRequest;

        if (!body.module_id) {
            return new Response(JSON.stringify({
                success: false,
                error: 'module_id is required',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Verify module exists
        const module = await env.DB.prepare(
            'SELECT id FROM modules WHERE id = ? AND is_active = 1'
        ).bind(body.module_id).first();

        if (!module) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid module_id',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const jobId = generateId();
        const now = Math.floor(Date.now() / 1000);
        const model = body.model || 'nano_banana';

        await env.DB.prepare(
            `INSERT INTO jobs (id, module_id, global_prompt, model, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`
        ).bind(jobId, body.module_id, body.global_prompt || null, model, now, now).run();

        const job = await env.DB.prepare(
            'SELECT * FROM jobs WHERE id = ?'
        ).bind(jobId).first<Job>();

        const response: ApiResponse<Job> = {
            success: true,
            data: job!,
            message: 'Job created successfully',
        };

        return new Response(JSON.stringify(response), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create job',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
