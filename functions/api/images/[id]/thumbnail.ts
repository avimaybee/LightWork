import type { Env, ImageRecord } from '../../../types';

// GET /api/images/[id]/thumbnail - Serve image thumbnail from R2
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, params } = context;
    const imageId = params.id as string;

    try {
        const image = await env.DB.prepare(
            'SELECT thumbnail_key FROM images WHERE id = ?'
        ).bind(imageId).first<ImageRecord>();

        if (!image || !image.thumbnail_key) {
            return new Response('Thumbnail not found', { status: 404 });
        }

        const object = await env.STORAGE.get(image.thumbnail_key);

        if (!object) {
            return new Response('Thumbnail object not found in storage', { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        return new Response(object.body, {
            headers,
        });
    } catch (error) {
        return new Response(error instanceof Error ? error.message : 'Internal error', { status: 500 });
    }
};
