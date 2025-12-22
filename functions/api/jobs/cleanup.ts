import type { Env, ApiResponse } from '../../types';
import { cleanupOldJobs } from '../../lib/processor';

// DELETE /api/jobs/cleanup - Manually trigger cleanup of old jobs
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    const { env } = context;

    try {
        await cleanupOldJobs(env);

        const response: ApiResponse = {
            success: true,
            message: 'Cleanup completed successfully',
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Cleanup failed',
        };

        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
