/**
 * Rate Limiting Configuration for Gemini API (Tier 1)
 * 
 * Tier 1 Limits:
 * - 500 RPM (requests per minute)
 * - 500,000 TPM (tokens per minute)
 * - 2,000 RPD (requests per day)
 * 
 * Target: <50% utilization for cost optimization
 */

export const GEMINI_LIMITS = {
    // Tier 1 hard limits
    RPM: 500,
    TPM: 500_000,
    RPD: 2_000,

    // Safe targets (<50% utilization)
    SAFE_RPM: 250,        // 50% of 500 RPM
    SAFE_TPM: 250_000,    // 50% of 500K TPM
    SAFE_RPD: 1_000,      // 50% of 2K RPD

    // Conservative parallel settings for production
    // Cloudflare Workers have 6 concurrent outbound connections per request
    MAX_CONCURRENT_PER_REQUEST: 5,  // Leave 1 connection for other needs
    
    // Batch processing settings
    BATCH_SIZE: 10,                 // Process 10 images in parallel per batch
    INTER_BATCH_DELAY_MS: 2_500,    // 2.5s between batches (~24 batches/min = 240 RPM)
    
    // Per-request minimum spacing to avoid bursts
    MIN_REQUEST_SPACING_MS: 200,    // 200ms min between requests (300 RPM max burst)
    
    // Retry configuration
    MAX_RETRIES: 3,
    BASE_RETRY_DELAY_MS: 1_000,
    MAX_RETRY_DELAY_MS: 30_000,
} as const;

/**
 * Cloudflare Platform Limits
 */
export const CLOUDFLARE_LIMITS = {
    // Cloudflare Workers limits
    CONCURRENT_CONNECTIONS_PER_REQUEST: 6,
    MAX_SUBREQUESTS_PAID: 1_000,    // Paid plan
    MAX_SUBREQUESTS_FREE: 50,       // Free plan

    // D1 Database limits (conservative estimates)
    D1_READS_PER_MINUTE: 10_000,
    D1_WRITES_PER_MINUTE: 1_000,

    // R2 limits (generous)
    R2_OPS_PER_MINUTE: 10_000,
} as const;

/**
 * Calculate optimal concurrent requests based on target RPM
 */
export function calculateOptimalConcurrency(targetRpm: number): {
    concurrency: number;
    delayBetweenBatchesMs: number;
} {
    // With BATCH_SIZE requests sent in parallel, 
    // we need to space batches to hit target RPM
    const batchesPerMinute = targetRpm / GEMINI_LIMITS.BATCH_SIZE;
    const delayBetweenBatchesMs = Math.max(
        60_000 / batchesPerMinute,
        GEMINI_LIMITS.INTER_BATCH_DELAY_MS
    );
    
    return {
        concurrency: GEMINI_LIMITS.BATCH_SIZE,
        delayBetweenBatchesMs: Math.round(delayBetweenBatchesMs)
    };
}

/**
 * Estimate tokens for an image request
 * Gemini charges ~258 tokens for 1024x1024 image input
 * Output images cost more but we're primarily concerned with input
 */
export function estimateTokens(imageSizeBytes: number, promptLength: number): number {
    // Rough estimation:
    // - Base tokens for image: ~1000-4000 depending on resolution
    // - Text tokens: ~1 token per 4 characters
    const baseImageTokens = Math.min(4000, Math.max(1000, imageSizeBytes / 1000));
    const textTokens = Math.ceil(promptLength / 4);
    const outputTokens = 5000; // Estimated for generated image
    
    return baseImageTokens + textTokens + outputTokens;
}

/**
 * Check if we can make requests given current usage
 */
export function canMakeRequest(
    currentRpm: number,
    currentTpm: number,
    estimatedTokens: number,
    safeMode: boolean = true
): { allowed: boolean; reason?: string } {
    const rpmLimit = safeMode ? GEMINI_LIMITS.SAFE_RPM : GEMINI_LIMITS.RPM;
    const tpmLimit = safeMode ? GEMINI_LIMITS.SAFE_TPM : GEMINI_LIMITS.TPM;

    if (currentRpm >= rpmLimit) {
        return { allowed: false, reason: `RPM limit reached (${currentRpm}/${rpmLimit})` };
    }

    if (currentTpm + estimatedTokens > tpmLimit) {
        return { allowed: false, reason: `TPM limit would be exceeded (${currentTpm + estimatedTokens}/${tpmLimit})` };
    }

    return { allowed: true };
}
