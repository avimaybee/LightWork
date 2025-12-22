import type { Env, ImageRecord } from '../../../types';

// GET /api/images/[id]/processed - Serve processed image from R2
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, params } = context;
    const imageId = params.id as string;

    try {
        const image = await env.DB.prepare(
            'SELECT processed_key, processed_mime_type, mime_type, original_filename FROM images WHERE id = ?'
        ).bind(imageId).first<ImageRecord & { processed_mime_type: string | null }>();

        if (!image || !image.processed_key) {
            return new Response('Processed image not found', { status: 404 });
        }

        const object = await env.STORAGE.get(image.processed_key);

        if (!object) {
            return new Response('Image file not found', { status: 404 });
        }

        const headers = new Headers();
        // Use stored processed_mime_type, fallback to R2 metadata, then original mime_type
        const contentType = image.processed_mime_type || object.httpMetadata?.contentType || image.mime_type || 'image/png';
        headers.set('Content-Type', contentType);
        headers.set('Cache-Control', 'public, max-age=31536000');

        if (image.original_filename) {
            const processedFilename = image.original_filename.replace(/(\.[^.]+)$/, '-processed$1');
            headers.set('Content-Disposition', `inline; filename="${processedFilename}"`);
        }

        return new Response(object.body, { headers });
    } catch {
        return new Response('Failed to fetch image', { status: 500 });
    }
};
