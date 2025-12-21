import type { Env, ApiResponse } from '../types';

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    services: {
        database: 'connected' | 'error';
        storage: 'connected' | 'error';
    };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env } = context;

    const healthStatus: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: 'connected',
            storage: 'connected',
        },
    };

    // Test D1 connection
    try {
        await env.DB.prepare('SELECT 1').first();
    } catch {
        healthStatus.services.database = 'error';
        healthStatus.status = 'degraded';
    }

    // Test R2 connection (just check if binding exists)
    try {
        if (!env.STORAGE) {
            throw new Error('R2 not configured');
        }
        // Try to list (limit 1) to verify connection
        await env.STORAGE.list({ limit: 1 });
    } catch {
        healthStatus.services.storage = 'error';
        healthStatus.status = 'degraded';
    }

    // If both services are down, mark as unhealthy
    if (healthStatus.services.database === 'error' && healthStatus.services.storage === 'error') {
        healthStatus.status = 'unhealthy';
    }

    const response: ApiResponse<HealthStatus> = {
        success: healthStatus.status !== 'unhealthy',
        data: healthStatus,
    };

    return new Response(JSON.stringify(response), {
        status: healthStatus.status === 'unhealthy' ? 503 : 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
        },
    });
};
