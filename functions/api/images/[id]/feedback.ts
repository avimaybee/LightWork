import type { Env, ApiResponse } from '../../../types';

interface FeedbackRequest {
    rating: 1 | -1;
    comment?: string;
}

// POST /api/images/[id]/feedback - Submit feedback for an image
export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { env, params, request } = context;
    const imageId = params.id as string;

    try {
        const body = await request.json() as FeedbackRequest;

        if (body.rating !== 1 && body.rating !== -1) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid rating. Must be 1 or -1.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Verify image exists
        const image = await env.DB.prepare(
            'SELECT id FROM images WHERE id = ?'
        ).bind(imageId).first();

        if (!image) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Image not found',
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const feedbackId = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        await env.DB.prepare(
            `INSERT INTO feedback (id, image_id, rating, comment, created_at)
             VALUES (?, ?, ?, ?, ?)`
        ).bind(feedbackId, imageId, body.rating, body.comment || null, now).run();

        const response: ApiResponse = {
            success: true,
            message: 'Feedback submitted successfully',
        };

        return new Response(JSON.stringify(response), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to submit feedback',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

// GET /api/images/[id]/feedback - Get feedback for an image
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, params } = context;
    const imageId = params.id as string;

    try {
        const feedback = await env.DB.prepare(
            'SELECT * FROM feedback WHERE image_id = ? ORDER BY created_at DESC LIMIT 1'
        ).bind(imageId).first();

        const response: ApiResponse = {
            success: true,
            data: feedback || null,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch feedback',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
