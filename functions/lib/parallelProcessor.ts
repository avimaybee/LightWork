/**
 * Parallel Processing Utility with Throttling
 * Safely executes multiple API calls within rate limits
 */

import { GEMINI_LIMITS, canMakeRequest, estimateTokens } from './rateLimitConfig';
import { canExecute, recordSuccess, recordFailure, withCircuitBreaker } from './circuitBreaker';

export interface ProcessingTask<T, R> {
    id: string;
    data: T;
    processor: (data: T) => Promise<R>;
    estimatedTokens?: number;
}

export interface ProcessingResult<R> {
    id: string;
    success: boolean;
    result?: R;
    error?: string;
    retryable?: boolean;
    retryAfterMs?: number;
}

export interface BatchProgress {
    total: number;
    completed: number;
    failed: number;
    pending: number;
}

/**
 * In-memory usage tracking (per isolate)
 * In production, consider using KV or Durable Objects for cross-isolate tracking
 */
interface UsageWindow {
    requests: number[];    // Timestamps of requests in current minute
    tokens: number;        // Tokens used in current minute
    windowStart: number;   // Start of current minute window
}

let usageWindow: UsageWindow = {
    requests: [],
    tokens: 0,
    windowStart: Date.now(),
};

/**
 * Reset usage window if minute has passed
 */
function refreshUsageWindow(): void {
    const now = Date.now();
    const windowDuration = 60_000; // 1 minute

    if (now - usageWindow.windowStart >= windowDuration) {
        usageWindow = {
            requests: [],
            tokens: 0,
            windowStart: now,
        };
    } else {
        // Remove requests older than 1 minute
        const cutoff = now - windowDuration;
        usageWindow.requests = usageWindow.requests.filter(ts => ts > cutoff);
    }
}

/**
 * Record a request in the usage window
 */
function recordRequest(tokens: number): void {
    refreshUsageWindow();
    usageWindow.requests.push(Date.now());
    usageWindow.tokens += tokens;
}

/**
 * Get current usage
 */
export function getCurrentUsage(): { rpm: number; tpm: number } {
    refreshUsageWindow();
    return {
        rpm: usageWindow.requests.length,
        tpm: usageWindow.tokens,
    };
}

/**
 * Wait for rate limit to allow next request
 */
async function waitForRateLimit(estimatedTokens: number): Promise<void> {
    const maxWaitMs = 30_000;
    const checkIntervalMs = 500;
    let waited = 0;

    while (waited < maxWaitMs) {
        refreshUsageWindow();
        
        const check = canMakeRequest(
            usageWindow.requests.length,
            usageWindow.tokens,
            estimatedTokens,
            true // Use safe mode
        );

        if (check.allowed) {
            return;
        }

        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
        waited += checkIntervalMs;
    }

    throw new Error('Rate limit timeout - could not acquire slot within 30 seconds');
}

/**
 * Process a single task with rate limiting and circuit breaker
 */
async function processTask<T, R>(
    task: ProcessingTask<T, R>
): Promise<ProcessingResult<R>> {
    const tokens = task.estimatedTokens || 5000; // Default estimate

    try {
        // Wait for rate limit slot
        await waitForRateLimit(tokens);

        // Check circuit breaker
        const circuitCheck = canExecute();
        if (!circuitCheck.allowed) {
            return {
                id: task.id,
                success: false,
                error: circuitCheck.reason,
                retryable: true,
                retryAfterMs: 60_000, // Circuit breaker reset time
            };
        }

        // Record the request
        recordRequest(tokens);

        // Execute with circuit breaker wrapper
        const result = await withCircuitBreaker(() => task.processor(task.data));

        return {
            id: task.id,
            success: true,
            result,
        };
    } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error';
        
        return {
            id: task.id,
            success: false,
            error: errorMessage,
            retryable: error?.retryable || false,
            retryAfterMs: error?.retryAfterMs,
        };
    }
}

/**
 * Process multiple tasks in parallel with throttling
 * Respects rate limits and handles errors gracefully
 */
export async function processInParallel<T, R>(
    tasks: ProcessingTask<T, R>[],
    options: {
        maxConcurrent?: number;
        batchDelayMs?: number;
        onProgress?: (progress: BatchProgress) => void;
    } = {}
): Promise<ProcessingResult<R>[]> {
    const {
        maxConcurrent = GEMINI_LIMITS.MAX_CONCURRENT_PER_REQUEST,
        batchDelayMs = GEMINI_LIMITS.INTER_BATCH_DELAY_MS,
        onProgress,
    } = options;

    const results: ProcessingResult<R>[] = [];
    let completed = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < tasks.length; i += maxConcurrent) {
        const batch = tasks.slice(i, i + maxConcurrent);
        
        // Add minimum spacing between requests in the batch
        const batchPromises = batch.map(async (task, batchIndex) => {
            // Stagger requests within batch
            if (batchIndex > 0) {
                await new Promise(resolve => 
                    setTimeout(resolve, GEMINI_LIMITS.MIN_REQUEST_SPACING_MS * batchIndex)
                );
            }
            return processTask(task);
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Track results
        for (const result of batchResults) {
            results.push(result);
            if (result.success) {
                completed++;
            } else {
                failed++;
            }
        }

        // Report progress
        if (onProgress) {
            onProgress({
                total: tasks.length,
                completed,
                failed,
                pending: tasks.length - completed - failed,
            });
        }

        // Wait between batches (unless this is the last batch)
        if (i + maxConcurrent < tasks.length) {
            await new Promise(resolve => setTimeout(resolve, batchDelayMs));
        }
    }

    return results;
}

/**
 * Process tasks one at a time (for critical/non-parallel work)
 */
export async function processSequentially<T, R>(
    tasks: ProcessingTask<T, R>[],
    options: {
        delayBetweenMs?: number;
        onProgress?: (progress: BatchProgress) => void;
    } = {}
): Promise<ProcessingResult<R>[]> {
    const { delayBetweenMs = GEMINI_LIMITS.MIN_REQUEST_SPACING_MS * 2, onProgress } = options;
    
    const results: ProcessingResult<R>[] = [];
    let completed = 0;
    let failed = 0;

    for (let i = 0; i < tasks.length; i++) {
        const result = await processTask(tasks[i]);
        results.push(result);
        
        if (result.success) {
            completed++;
        } else {
            failed++;
        }

        if (onProgress) {
            onProgress({
                total: tasks.length,
                completed,
                failed,
                pending: tasks.length - completed - failed,
            });
        }

        // Delay between requests
        if (i < tasks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenMs));
        }
    }

    return results;
}

/**
 * Retry failed tasks with exponential backoff
 */
export async function retryFailedTasks<T, R>(
    failedResults: ProcessingResult<R>[],
    originalTasks: ProcessingTask<T, R>[],
    maxRetries: number = GEMINI_LIMITS.MAX_RETRIES
): Promise<ProcessingResult<R>[]> {
    // Get retryable tasks
    const retryableTasks: Array<ProcessingTask<T, R> & { retryCount: number }> = [];
    
    for (const result of failedResults) {
        if (result.retryable) {
            const originalTask = originalTasks.find(t => t.id === result.id);
            if (originalTask) {
                retryableTasks.push({ ...originalTask, retryCount: 1 });
            }
        }
    }

    if (retryableTasks.length === 0) {
        return [];
    }

    const results: ProcessingResult<R>[] = [];
    let remaining = retryableTasks;

    while (remaining.length > 0 && remaining[0].retryCount <= maxRetries) {
        // Wait based on retry count (exponential backoff)
        const waitMs = Math.min(
            GEMINI_LIMITS.MAX_RETRY_DELAY_MS,
            GEMINI_LIMITS.BASE_RETRY_DELAY_MS * Math.pow(2, remaining[0].retryCount - 1)
        );
        await new Promise(resolve => setTimeout(resolve, waitMs));

        // Process retry batch
        const batchResults = await processInParallel(remaining);
        
        const stillFailed: typeof remaining = [];
        
        for (const result of batchResults) {
            if (result.success) {
                results.push(result);
            } else if (result.retryable) {
                const task = remaining.find(t => t.id === result.id);
                if (task && task.retryCount < maxRetries) {
                    stillFailed.push({ ...task, retryCount: task.retryCount + 1 });
                } else {
                    results.push(result); // Max retries reached
                }
            } else {
                results.push(result); // Non-retryable error
            }
        }

        remaining = stillFailed;
    }

    // Add remaining failures
    for (const task of remaining) {
        results.push({
            id: task.id,
            success: false,
            error: `Max retries (${maxRetries}) exceeded`,
            retryable: false,
        });
    }

    return results;
}
