import { useState, useEffect, useCallback, useRef } from 'react';
import { getJob, triggerProcessing, type JobWithImages } from '@/lib/api';

interface UseJobPollingOptions {
    jobId: string | null;
    enabled?: boolean;
    interval?: number;
    onComplete?: (job: JobWithImages) => void;
    onError?: (error: Error) => void;
}

export function useJobPolling({
    jobId,
    enabled = true,
    interval = 5000,
    onComplete,
    onError,
}: UseJobPollingOptions) {
    const [job, setJob] = useState<JobWithImages | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const intervalRef = useRef<number | null>(null);

    // Use refs for callbacks to avoid dependency cycles (fixes infinite loop!)
    const onCompleteRef = useRef(onComplete);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onCompleteRef.current = onComplete;
        onErrorRef.current = onError;
    }, [onComplete, onError]);

    const fetchJob = useCallback(async () => {
        if (!jobId) return;

        try {
            setIsLoading(true);
            const data = await getJob(jobId);
            setJob(data);
            setError(null);

            // Check if job is complete
            if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'CANCELLED') {
                onCompleteRef.current?.(data);
                // Stop polling when complete
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            } else if (data.status === 'PROCESSING') {
                // Only trigger processing when there are pending/retry images to reduce needless calls
                const hasPending = data.images?.some(img => img.status === 'PENDING' || img.status === 'RETRY_LATER');
                if (hasPending) {
                    triggerProcessing().catch(console.error);
                }
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch job');
            setError(error);
            onErrorRef.current?.(error);
        } finally {
            setIsLoading(false);
        }
    }, [jobId]); // Removed onComplete/onError from dependencies

    useEffect(() => {
        if (!jobId || !enabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Initial fetch
        fetchJob();

        // Set up polling
        intervalRef.current = window.setInterval(fetchJob, interval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [jobId, enabled, interval, fetchJob]);

    const refetch = useCallback(() => {
        fetchJob();
    }, [fetchJob]);

    return {
        job,
        isLoading,
        error,
        refetch,
    };
}
