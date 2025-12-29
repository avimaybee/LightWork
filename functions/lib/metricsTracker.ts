/**
 * Metrics Tracking for API Usage Monitoring
 * Tracks RPM, TPM, success rates, and latency
 */

import { GEMINI_LIMITS } from './rateLimitConfig';

export interface RequestMetrics {
    timestamp: number;
    duration: number;
    tokens: number;
    success: boolean;
    errorType?: string;
}

export interface UsageStats {
    // Current minute
    currentRpm: number;
    currentTpm: number;
    
    // Percentages
    rpmUtilization: number;  // 0-100
    tpmUtilization: number;  // 0-100
    
    // Performance
    successRate: number;      // 0-100 for last hour
    avgLatencyMs: number;
    
    // Health status
    status: 'healthy' | 'warning' | 'critical';
    warnings: string[];
}

/**
 * In-memory metrics storage (rolling 1 hour window)
 * In production, consider persisting to KV for cross-isolate aggregation
 */
const metricsWindow: RequestMetrics[] = [];
const WINDOW_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Record a request metric
 */
export function recordMetric(metric: Omit<RequestMetrics, 'timestamp'>): void {
    const now = Date.now();
    
    // Clean old metrics
    const cutoff = now - WINDOW_DURATION_MS;
    while (metricsWindow.length > 0 && metricsWindow[0].timestamp < cutoff) {
        metricsWindow.shift();
    }
    
    // Add new metric
    metricsWindow.push({
        ...metric,
        timestamp: now,
    });
}

/**
 * Get current usage statistics
 */
export function getUsageStats(): UsageStats {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const oneHourAgo = now - 60 * 60_000;
    
    // Current minute metrics
    const currentMinuteMetrics = metricsWindow.filter(m => m.timestamp >= oneMinuteAgo);
    const currentRpm = currentMinuteMetrics.length;
    const currentTpm = currentMinuteMetrics.reduce((sum, m) => sum + m.tokens, 0);
    
    // Last hour metrics for success rate
    const hourMetrics = metricsWindow.filter(m => m.timestamp >= oneHourAgo);
    const successCount = hourMetrics.filter(m => m.success).length;
    const successRate = hourMetrics.length > 0 
        ? (successCount / hourMetrics.length) * 100 
        : 100;
    
    // Average latency
    const successfulRequests = hourMetrics.filter(m => m.success);
    const avgLatencyMs = successfulRequests.length > 0
        ? successfulRequests.reduce((sum, m) => sum + m.duration, 0) / successfulRequests.length
        : 0;
    
    // Calculate utilization percentages
    const rpmUtilization = (currentRpm / GEMINI_LIMITS.SAFE_RPM) * 100;
    const tpmUtilization = (currentTpm / GEMINI_LIMITS.SAFE_TPM) * 100;
    
    // Determine health status and warnings
    const warnings: string[] = [];
    let status: UsageStats['status'] = 'healthy';
    
    if (rpmUtilization >= 90) {
        warnings.push('RPM approaching limit');
        status = 'critical';
    } else if (rpmUtilization >= 70) {
        warnings.push('RPM utilization high');
        if (status === 'healthy') status = 'warning';
    }
    
    if (tpmUtilization >= 90) {
        warnings.push('TPM approaching limit');
        status = 'critical';
    } else if (tpmUtilization >= 70) {
        warnings.push('TPM utilization high');
        if (status === 'healthy') status = 'warning';
    }
    
    if (successRate < 80) {
        warnings.push(`High error rate (${Math.round(100 - successRate)}% failures)`);
        status = 'critical';
    } else if (successRate < 95) {
        warnings.push(`Elevated error rate (${Math.round(100 - successRate)}% failures)`);
        if (status === 'healthy') status = 'warning';
    }
    
    // Check for rate limit errors
    const rateLimitErrors = hourMetrics.filter(m => 
        !m.success && m.errorType?.includes('429')
    ).length;
    if (rateLimitErrors > 0) {
        warnings.push(`${rateLimitErrors} rate limit errors in last hour`);
        if (status === 'healthy') status = 'warning';
    }
    
    return {
        currentRpm,
        currentTpm,
        rpmUtilization: Math.round(rpmUtilization),
        tpmUtilization: Math.round(tpmUtilization),
        successRate: Math.round(successRate),
        avgLatencyMs: Math.round(avgLatencyMs),
        status,
        warnings,
    };
}

/**
 * Get error breakdown for diagnostics
 */
export function getErrorBreakdown(): Record<string, number> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60_000;
    
    const errors = metricsWindow
        .filter(m => m.timestamp >= oneHourAgo && !m.success && m.errorType)
        .reduce((acc, m) => {
            const errorType = m.errorType || 'unknown';
            acc[errorType] = (acc[errorType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    
    return errors;
}

/**
 * Get request distribution by minute for the last hour
 */
export function getRequestDistribution(): { minute: number; count: number }[] {
    const now = Date.now();
    const distribution: { minute: number; count: number }[] = [];
    
    for (let i = 59; i >= 0; i--) {
        const minuteStart = now - (i + 1) * 60_000;
        const minuteEnd = now - i * 60_000;
        
        const count = metricsWindow.filter(
            m => m.timestamp >= minuteStart && m.timestamp < minuteEnd
        ).length;
        
        distribution.push({ minute: 60 - i, count });
    }
    
    return distribution;
}

/**
 * Check if system should throttle based on current usage
 */
export function shouldThrottle(): { throttle: boolean; reason?: string; recommendedDelayMs?: number } {
    const stats = getUsageStats();
    
    // Critical status - stop all non-essential requests
    if (stats.status === 'critical') {
        return {
            throttle: true,
            reason: 'System in critical state',
            recommendedDelayMs: 30_000,
        };
    }
    
    // High RPM utilization - slow down
    if (stats.rpmUtilization >= 80) {
        return {
            throttle: true,
            reason: 'RPM utilization too high',
            recommendedDelayMs: 5_000,
        };
    }
    
    // High TPM utilization - slow down
    if (stats.tpmUtilization >= 80) {
        return {
            throttle: true,
            reason: 'TPM utilization too high',
            recommendedDelayMs: 5_000,
        };
    }
    
    return { throttle: false };
}

/**
 * Create a metrics-enabled wrapper for async functions
 */
export function withMetrics<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    tokenEstimator?: (...args: T) => number
): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
        const startTime = Date.now();
        const estimatedTokens = tokenEstimator ? tokenEstimator(...args) : 5000;
        
        try {
            const result = await fn(...args);
            
            recordMetric({
                duration: Date.now() - startTime,
                tokens: estimatedTokens,
                success: true,
            });
            
            return result;
        } catch (error: any) {
            const errorMessage = error?.message || String(error);
            let errorType = 'unknown';
            
            if (errorMessage.includes('429')) errorType = '429_rate_limit';
            else if (errorMessage.includes('503')) errorType = '503_unavailable';
            else if (errorMessage.includes('500')) errorType = '500_server_error';
            else if (errorMessage.includes('SAFETY')) errorType = 'safety_filter';
            else if (errorMessage.includes('timeout')) errorType = 'timeout';
            
            recordMetric({
                duration: Date.now() - startTime,
                tokens: estimatedTokens,
                success: false,
                errorType,
            });
            
            throw error;
        }
    };
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(): void {
    metricsWindow.length = 0;
}
