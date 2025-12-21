/**
 * POST /api/process - Trigger image processing on-demand
 * 
 * This endpoint allows triggering the image processing pipeline manually.
 * Call this after starting a job to begin processing immediately.
 */

import type { Env, ApiResponse } from '../types';
import { processImages, type ProcessResult } from '../lib/processor';

// POST /api/process - Trigger processing
export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { env } = context;

    try {
        console.log('🍌 On-demand processing triggered');

        const result = await processImages(env);

        const response: ApiResponse<ProcessResult> = {
            success: true,
            data: result,
            message: result.processed > 0
                ? `Processed ${result.processed} images (${result.completed} completed, ${result.failed} failed)`
                : 'No pending images to process',
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('🍌 Processing error:', error);

        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Processing failed',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

// GET /api/process - Check processing status (for debugging)
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env } = context;

    try {
        // Count pending images
        const { results: pending } = await env.DB.prepare(
            `SELECT COUNT(*) as count FROM images 
             WHERE status IN ('PENDING', 'RETRY_LATER')`
        ).all<{ count: number }>();

        // Count processing jobs
        const { results: jobs } = await env.DB.prepare(
            `SELECT COUNT(*) as count FROM jobs WHERE status = 'PROCESSING'`
        ).all<{ count: number }>();

        const response: ApiResponse<{ pending_images: number; processing_jobs: number }> = {
            success: true,
            data: {
                pending_images: pending?.[0]?.count || 0,
                processing_jobs: jobs?.[0]?.count || 0,
            },
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get status',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
