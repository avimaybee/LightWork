import type { Env, ImageRecord, Job, ApiResponse } from '../../types';

const MAX_IMAGES_PER_BATCH = 50;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// Helper to generate UUID
function generateId(): string {
    return crypto.randomUUID();
}

// POST /api/images/upload - Upload images for a job
export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { env, request } = context;

    try {
        const formData = await request.formData();
        const jobId = formData.get('job_id') as string;

        if (!jobId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'job_id is required',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Verify job exists and is in PENDING state
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

        if (job.status !== 'PENDING') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Can only upload to pending jobs',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get current image count
        const countResult = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM images WHERE job_id = ?'
        ).bind(jobId).first<{ count: number }>();

        const currentCount = countResult?.count || 0;

        // Get all files and thumbnails from form data
        const items: { file: File; thumb: File | null }[] = [];
        for (let i = 0; i < MAX_IMAGES_PER_BATCH; i++) {
            const file = formData.get(`file${i}`);
            const thumb = formData.get(`thumb${i}`);
            
            if (file instanceof File) {
                items.push({ 
                    file, 
                    thumb: thumb instanceof File ? thumb : null 
                });
            } else {
                // Assuming sequential naming file0, file1...
                if (i > 0 && !formData.has(`file${i}`)) break;
            }
        }

        if (items.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No files provided',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Validate files (type + size)
        const invalidFiles = items.filter(({ file }) => {
            if (file.size > MAX_FILE_SIZE_BYTES) return true;
            if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) return true;
            return false;
        });

        if (invalidFiles.length > 0) {
            return new Response(JSON.stringify({
                success: false,
                error: `Invalid files: ${invalidFiles.map(i => i.file.name).join(', ')}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}. Max size: 10MB`,
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Check max limit
        if (currentCount + items.length > MAX_IMAGES_PER_BATCH) {
            return new Response(JSON.stringify({
                success: false,
                error: `Maximum ${MAX_IMAGES_PER_BATCH} images per batch. Currently have ${currentCount}, trying to add ${items.length}.`,
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const uploadedImages: ImageRecord[] = [];
        const now = Math.floor(Date.now() / 1000);

        for (const { file, thumb } of items) {
            const imageId = generateId();
            const originalKey = `originals/${jobId}/${imageId}-${file.name}`;
            const thumbnailKey = thumb ? `thumbnails/${jobId}/${imageId}-thumb.jpg` : null;

            // Upload Original to R2
            const arrayBuffer = await file.arrayBuffer();
            await env.STORAGE.put(originalKey, arrayBuffer, {
                httpMetadata: { contentType: file.type },
                customMetadata: {
                    originalFilename: file.name,
                    jobId: jobId,
                    imageId: imageId,
                },
            });

            // Upload Thumbnail to R2 if provided
            if (thumb && thumbnailKey) {
                const thumbBuffer = await thumb.arrayBuffer();
                await env.STORAGE.put(thumbnailKey, thumbBuffer, {
                    httpMetadata: { contentType: 'image/jpeg' },
                    customMetadata: { jobId, imageId, type: 'thumbnail' }
                });
            }

            // Create database record
            await env.DB.prepare(
                `INSERT INTO images (id, job_id, original_key, thumbnail_key, original_filename, status, file_size, mime_type, created_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`
            ).bind(imageId, jobId, originalKey, thumbnailKey, file.name, file.size, file.type, now).run();

            uploadedImages.push({
                id: imageId,
                job_id: jobId,
                original_key: originalKey,
                original_filename: file.name,
                processed_key: null,
                thumbnail_key: thumbnailKey,
                status: 'PENDING',
                specific_prompt: null,
                error_message: null,
                retry_count: 0,
                file_size: file.size,
                mime_type: file.type,
                created_at: now,
                processed_at: null,
            });
        }

        // Update job total_images count
        await env.DB.prepare(
            'UPDATE jobs SET total_images = total_images + ?, updated_at = ? WHERE id = ?'
        ).bind(items.length, now, jobId).run();

        const response: ApiResponse<{ uploaded: number; images: ImageRecord[] }> = {
            success: true,
            data: {
                uploaded: uploadedImages.length,
                images: uploadedImages,
            },
            message: `Successfully uploaded ${uploadedImages.length} images`,
        };

        return new Response(JSON.stringify(response), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload images',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
