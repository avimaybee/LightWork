import { useState, useEffect, useCallback, useRef } from 'react';
import { getJob, triggerProcessing, type JobWithImages } from '@/lib/api';

interface UseJobPollingOptions {
    jobId: string | null;
    enabled?: boolean;
    baseInterval?: number;
    maxInterval?: number;
    onComplete?: (job: JobWithImages) => void;
    onError?: (error: Error) => void;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export function useJobPolling({
    jobId,
    enabled = true,
    baseInterval = 2000,
    maxInterval = 30000,
    onComplete,
    onError,
}: UseJobPollingOptions) {
    const [job, setJob] = useState<JobWithImages | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    
    const timeoutRef = useRef<number | null>(null);
    const mountedRef = useRef(true);
    const backoffRef = useRef(baseInterval);
    const hasJobRef = useRef(false);

    // Use refs for callbacks to avoid dependency cycles
    const onCompleteRef = useRef(onComplete);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onCompleteRef.current = onComplete;
        onErrorRef.current = onError;
    }, [onComplete, onError]);

    const stopPolling = useCallback(() => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const fetchJob = useCallback(async () => {
        if (!jobId || !enabled || !mountedRef.current) return;

        try {
            // Only show loading on first fetch or if previously disconnected
            if (!hasJobRef.current) setIsLoading(true);
            
            const data = await getJob(jobId);
            
            if (!mountedRef.current) return;

            setJob(data);
            hasJobRef.current = true;
            setError(null);
            setConnectionStatus('connected');
            backoffRef.current = baseInterval; // Reset backoff on success

            // Check if job is complete
            if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'CANCELLED') {
                onCompleteRef.current?.(data);
                stopPolling();
                return; // Stop the chain
            } else if (data.status === 'PROCESSING') {
                // Trigger processing if needed
                const hasPending = data.images?.some(img => img.status === 'PENDING' || img.status === 'RETRY_LATER');
                if (hasPending) {
                    triggerProcessing().catch(console.error);
                }
            }

            // Schedule next poll
            if (enabled) {
                timeoutRef.current = window.setTimeout(fetchJob, baseInterval);
            }

        } catch (err) {
            if (!mountedRef.current) return;

            const error = err instanceof Error ? err : new Error('Failed to fetch job');
            console.warn('Polling error:', error);
            
            setError(error);
            setConnectionStatus('reconnecting');
            onErrorRef.current?.(error);

            // Calculate next backoff with jitter
            const jitter = Math.random() * 1000;
            const nextInterval = Math.min(maxInterval, backoffRef.current * 1.5) + jitter;
            backoffRef.current = nextInterval;

            // Schedule retry
            if (enabled) {
                timeoutRef.current = window.setTimeout(fetchJob, nextInterval);
            }
        } finally {
            if (mountedRef.current) setIsLoading(false);
        }
    }, [jobId, enabled, baseInterval, maxInterval, stopPolling]);

    // Initial setup and cleanup
    useEffect(() => {
        mountedRef.current = true;
        // Reset hasJobRef when jobId changes so we show loading state again
        hasJobRef.current = false;
        
        if (jobId && enabled) {
            fetchJob();
        } else {
            stopPolling();
        }

        return () => {
            mountedRef.current = false;
            stopPolling();
        };
    }, [jobId, enabled, fetchJob, stopPolling]);

    const refetch = useCallback(() => {
        // Reset backoff and fetch immediately
        backoffRef.current = baseInterval;
        stopPolling();
        fetchJob();
    }, [fetchJob, stopPolling, baseInterval]);

    return {
        job,
        connectionStatus,
        isLoading,
        error,
        refetch,
    };
}