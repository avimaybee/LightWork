import type { Env, ImageRecord, Job, ApiResponse } from '../../types';
import JSZip from 'jszip';

// GET /api/jobs/[id]/download - Download all processed images as ZIP
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, params } = context;
    const jobId = params.id as string;

    try {
        const job = await env.DB.prepare(
            'SELECT * FROM jobs WHERE id = ?'
        ).bind(jobId).first<Job>();

        if (!job) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Job not found',
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get all completed images
        const { results: images } = await env.DB.prepare(
            `SELECT * FROM images WHERE job_id = ? AND status = 'COMPLETED' AND processed_key IS NOT NULL`
        ).bind(jobId).all<ImageRecord>();

        if (!images || images.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No processed images available for download',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Create ZIP file
        const zip = new JSZip();

        for (const image of images) {
            if (image.processed_key) {
                const object = await env.STORAGE.get(image.processed_key);
                if (object) {
                    const arrayBuffer = await object.arrayBuffer();
                    const filename = image.original_filename
                        ? image.original_filename.replace(/(\.[^.]+)$/, '-processed$1')
                        : `${image.id}-processed.jpg`;
                    zip.file(filename, arrayBuffer);
                }
            }
        }

        const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

        return new Response(zipBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="lightwork-${jobId.slice(0, 8)}.zip"`,
            },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create download',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
