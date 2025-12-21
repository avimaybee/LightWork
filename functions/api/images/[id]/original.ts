import type { Env, ImageRecord } from '../../../types';

// GET /api/images/[id]/original - Serve original image from R2
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, params } = context;
    const imageId = params.id as string;

    try {
        const image = await env.DB.prepare(
            'SELECT original_key, mime_type, original_filename FROM images WHERE id = ?'
        ).bind(imageId).first<ImageRecord>();

        if (!image || !image.original_key) {
            return new Response('Image not found', { status: 404 });
        }

        const object = await env.STORAGE.get(image.original_key);

        if (!object) {
            return new Response('Image file not found', { status: 404 });
        }

        const headers = new Headers();
        headers.set('Content-Type', image.mime_type || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000');

        if (image.original_filename) {
            headers.set('Content-Disposition', `inline; filename="${image.original_filename}"`);
        }

        return new Response(object.body, { headers });
    } catch (error) {
        return new Response('Failed to fetch image', { status: 500 });
    }
};
