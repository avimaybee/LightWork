import type { Env, ImageRecord, Job, ApiResponse } from '../../types';
import JSZip from 'jszip';

// GET /api/jobs/[id]/download - Download all processed images as ZIP
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, params } = context;
    const jobId = params.id as string;

    try {
        // Get job with module name
        const job = await env.DB.prepare(
            `SELECT j.*, m.name as module_name 
             FROM jobs j 
             JOIN modules m ON j.module_id = m.id 
             WHERE j.id = ?`
        ).bind(jobId).first<Job & { module_name: string }>();

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

        // Download images in parallel (bounded by Cloudflare's concurrent subrequest limit)
        // Cloudflare allows up to 6 concurrent subrequests per request.
        // We'll process them in batches or just use Promise.all and let the platform handle it.
        // Actually, Promise.all is fine as Cloudflare will queue them if needed.
        await Promise.all(images.map(async (image) => {
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
        }));

        const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

        // Format filename: LightWork_ModuleName_YYYY-MM-DD.zip
        const date = new Date().toISOString().split('T')[0];
        const safeModuleName = job.module_name.replace(/[^a-z0-9]/gi, '_');
        const zipFilename = `LightWork_${safeModuleName}_${date}.zip`;

        return new Response(zipBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${zipFilename}"`,
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
