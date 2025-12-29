/**
 * GET /api/status
 * 
 * Returns current API usage stats, circuit breaker status, and health.
 * Useful for monitoring and auto-fallback decisions on the client.
 */

import { getAuthContext } from '../lib/auth';
import { getUsageStats, getErrorBreakdown } from '../lib/metricsTracker';
import { getCircuitStatus } from '../lib/circuitBreaker';
import { GEMINI_LIMITS } from '../lib/rateLimitConfig';

// Helper for consistent JSON responses
function jsonResponse(data: any, status: number = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequestGet(context: { request: Request; env: any }) {
    try {
        // Optional auth - some status info can be public
        const auth = await getAuthContext(context.request);
        
        const usageStats = getUsageStats();
        const circuitStatus = getCircuitStatus();
        const errorBreakdown = getErrorBreakdown();

        const response: any = {
            // Overall health
            status: usageStats.status,
            circuit: circuitStatus.state,
            
            // Rate limits
            limits: {
                rpm: GEMINI_LIMITS.SAFE_RPM,
                tpm: GEMINI_LIMITS.SAFE_TPM,
                maxRpm: GEMINI_LIMITS.RPM,
                maxTpm: GEMINI_LIMITS.TPM,
            },
            
            // Current usage
            usage: {
                currentRpm: usageStats.currentRpm,
                currentTpm: usageStats.currentTpm,
                rpmUtilization: usageStats.rpmUtilization,
                tpmUtilization: usageStats.tpmUtilization,
            },
            
            // Performance
            performance: {
                successRate: usageStats.successRate,
                avgLatencyMs: usageStats.avgLatencyMs,
            },
            
            // Warnings and recommendations
            warnings: usageStats.warnings,
            
            // Recommendations based on current state
            recommendations: getRecommendations(usageStats, circuitStatus),
        };

        // Add detailed error breakdown for authenticated users
        if (auth.userId) {
            response.errors = errorBreakdown;
            response.circuitDetails = {
                state: circuitStatus.state,
                failures: circuitStatus.failures,
                lastFailure: circuitStatus.lastFailure,
            };
        }

        return jsonResponse(response);
    } catch (e: any) {
        console.error('[Status API] Error:', e);
        return jsonResponse({
            status: 'error',
            error: e.message,
        }, 500);
    }
}

/**
 * Generate recommendations based on current system state
 */
function getRecommendations(
    usageStats: ReturnType<typeof getUsageStats>,
    circuitStatus: ReturnType<typeof getCircuitStatus>
): string[] {
    const recommendations: string[] = [];

    // Circuit breaker recommendations
    if (circuitStatus.state === 'open') {
        recommendations.push('Use batch API (economy mode) until circuit recovers');
        recommendations.push(`Wait ${Math.ceil(60 - (Date.now() - circuitStatus.lastFailure) / 1000)}s before retrying`);
    } else if (circuitStatus.state === 'half-open') {
        recommendations.push('System recovering - reduce concurrent requests');
    }

    // Usage recommendations
    if (usageStats.rpmUtilization >= 80) {
        recommendations.push('Consider switching to batch API for non-urgent work');
        recommendations.push('Increase delay between requests');
    } else if (usageStats.rpmUtilization >= 50) {
        recommendations.push('Parallel processing available with reduced concurrency');
    } else {
        recommendations.push('System healthy - parallel processing recommended');
    }

    // Error rate recommendations
    if (usageStats.successRate < 80) {
        recommendations.push('High error rate detected - switch to sequential processing');
        recommendations.push('Consider using lighter models for analysis tasks');
    } else if (usageStats.successRate < 95) {
        recommendations.push('Some errors detected - enable automatic retries');
    }

    // Cost optimization
    if (usageStats.status === 'healthy' && usageStats.rpmUtilization < 30) {
        recommendations.push('Low utilization - can increase batch sizes for faster processing');
    }

    return recommendations;
}
