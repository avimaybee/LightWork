/**
 * Circuit Breaker pattern for handling Gemini API errors
 * Prevents cascading failures when API is overloaded
 */

export interface CircuitBreakerState {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    lastFailure: number;
    successesSinceHalfOpen: number;
}

export interface CircuitBreakerConfig {
    failureThreshold: number;      // Failures before opening
    resetTimeoutMs: number;        // Time before trying again (half-open)
    successThreshold: number;      // Successes in half-open to close
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeoutMs: 60_000,  // 1 minute
    successThreshold: 2,
};

/**
 * In-memory circuit breaker state
 * In production, this could be stored in KV for persistence across isolates
 */
let circuitState: CircuitBreakerState = {
    state: 'closed',
    failures: 0,
    lastFailure: 0,
    successesSinceHalfOpen: 0,
};

/**
 * Check if circuit allows request
 */
export function canExecute(config: CircuitBreakerConfig = DEFAULT_CONFIG): {
    allowed: boolean;
    state: CircuitBreakerState['state'];
    reason?: string;
} {
    const now = Date.now();

    // If open, check if enough time passed to try half-open
    if (circuitState.state === 'open') {
        const timeSinceFailure = now - circuitState.lastFailure;
        
        if (timeSinceFailure >= config.resetTimeoutMs) {
            // Transition to half-open
            circuitState.state = 'half-open';
            circuitState.successesSinceHalfOpen = 0;
            console.log('[CircuitBreaker] Transitioning to half-open state');
        } else {
            const waitMs = config.resetTimeoutMs - timeSinceFailure;
            return {
                allowed: false,
                state: 'open',
                reason: `Circuit open. Wait ${Math.ceil(waitMs / 1000)}s before retry`
            };
        }
    }

    return { allowed: true, state: circuitState.state };
}

/**
 * Record a successful request
 */
export function recordSuccess(config: CircuitBreakerConfig = DEFAULT_CONFIG): void {
    if (circuitState.state === 'half-open') {
        circuitState.successesSinceHalfOpen++;
        
        if (circuitState.successesSinceHalfOpen >= config.successThreshold) {
            // Close the circuit
            circuitState.state = 'closed';
            circuitState.failures = 0;
            circuitState.successesSinceHalfOpen = 0;
            console.log('[CircuitBreaker] Circuit closed after successful recovery');
        }
    } else if (circuitState.state === 'closed') {
        // Reset failure count on success
        circuitState.failures = Math.max(0, circuitState.failures - 1);
    }
}

/**
 * Record a failed request
 */
export function recordFailure(
    error: any,
    config: CircuitBreakerConfig = DEFAULT_CONFIG
): { shouldRetry: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const errorMessage = error?.message || String(error);
    
    // Check if it's a rate limit error (these should trigger circuit opening faster)
    const isRateLimitError = 
        errorMessage.includes('429') ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('retryDelay');
    
    // Check if error is retryable
    const isRetryable = 
        isRateLimitError ||
        errorMessage.includes('503') ||
        errorMessage.includes('UNAVAILABLE') ||
        errorMessage.includes('INTERNAL');

    // Parse retry-after from error if present
    let retryAfterMs: number | undefined;
    const retryMatch = errorMessage.match(/retryDelay[^0-9]*"?(\d+)s"?/i);
    if (retryMatch) {
        retryAfterMs = parseInt(retryMatch[1], 10) * 1000;
    }

    // Increment failure count
    circuitState.failures++;
    circuitState.lastFailure = now;

    // Rate limit errors should open circuit faster
    const effectiveThreshold = isRateLimitError 
        ? Math.ceil(config.failureThreshold / 2)
        : config.failureThreshold;

    if (circuitState.state === 'half-open') {
        // Any failure in half-open reopens the circuit
        circuitState.state = 'open';
        console.log('[CircuitBreaker] Reopening circuit after failure in half-open state');
    } else if (circuitState.failures >= effectiveThreshold) {
        // Open the circuit
        circuitState.state = 'open';
        console.log(`[CircuitBreaker] Opening circuit after ${circuitState.failures} failures`);
    }

    return {
        shouldRetry: isRetryable && circuitState.state !== 'open',
        retryAfterMs: retryAfterMs || calculateBackoff(circuitState.failures)
    };
}

/**
 * Calculate exponential backoff with jitter
 */
function calculateBackoff(failures: number): number {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, failures - 1));
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
}

/**
 * Reset circuit breaker state (for testing or manual override)
 */
export function resetCircuit(): void {
    circuitState = {
        state: 'closed',
        failures: 0,
        lastFailure: 0,
        successesSinceHalfOpen: 0,
    };
}

/**
 * Get current circuit breaker status
 */
export function getCircuitStatus(): CircuitBreakerState {
    return { ...circuitState };
}

/**
 * Execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
    fn: () => Promise<T>,
    config: CircuitBreakerConfig = DEFAULT_CONFIG
): Promise<T> {
    const check = canExecute(config);
    
    if (!check.allowed) {
        throw new Error(`Circuit breaker open: ${check.reason}`);
    }

    try {
        const result = await fn();
        recordSuccess(config);
        return result;
    } catch (error) {
        const failureResult = recordFailure(error, config);
        
        if (failureResult.shouldRetry) {
            // Attach retry info to error for caller
            (error as any).retryable = true;
            (error as any).retryAfterMs = failureResult.retryAfterMs;
        }
        
        throw error;
    }
}
