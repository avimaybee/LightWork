import type { Env, ImageRecord, ApiResponse } from '../../types';

// GET /api/images/[id] - Get image details with signed URLs
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, params, request } = context;
    const imageId = params.id as string;

    try {
        const image = await env.DB.prepare(
            'SELECT * FROM images WHERE id = ?'
        ).bind(imageId).first<ImageRecord>();

        if (!image) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Image not found',
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Generate presigned URLs for the images
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;

        const imageWithUrls = {
            ...image,
            original_url: image.original_key ? `${baseUrl}/api/images/${imageId}/original` : null,
            processed_url: image.processed_key ? `${baseUrl}/api/images/${imageId}/processed` : null,
        };

        const response: ApiResponse<typeof imageWithUrls> = {
            success: true,
            data: imageWithUrls,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch image',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

// PATCH /api/images/[id] - Update specific prompt for an image
export const onRequestPatch: PagesFunction<Env> = async (context) => {
    const { env, params, request } = context;
    const imageId = params.id as string;

    try {
        const body = await request.json() as { specific_prompt?: string };

        const image = await env.DB.prepare(
            'SELECT * FROM images WHERE id = ?'
        ).bind(imageId).first<ImageRecord>();

        if (!image) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Image not found',
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (image.status !== 'PENDING' && image.status !== 'RETRY_LATER') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Can only update prompt for pending images',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        await env.DB.prepare(
            'UPDATE images SET specific_prompt = ? WHERE id = ?'
        ).bind(body.specific_prompt || null, imageId).run();

        const updatedImage = await env.DB.prepare(
            'SELECT * FROM images WHERE id = ?'
        ).bind(imageId).first<ImageRecord>();

        const response: ApiResponse<ImageRecord> = {
            success: true,
            data: updatedImage!,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update image',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
