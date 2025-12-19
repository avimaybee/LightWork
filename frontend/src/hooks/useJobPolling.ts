/**
 * useJobPolling Hook
 * Polls job status from the backend at regular intervals
 * Following optimistic-state-sync skill patterns
 */
import { useState, useEffect, useCallback } from 'react';
import type { JobWithImages } from '../lib/api';
import { api } from '../lib/api';

const POLL_INTERVAL_MS = 3000;

interface UseJobPollingResult {
    job: JobWithImages | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useJobPolling(jobId: string | null): UseJobPollingResult {
    const [job, setJob] = useState<JobWithImages | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchJob = useCallback(async () => {
        if (!jobId) {
            setJob(null);
            return;
        }

        try {
            setLoading(true);
            const data = await api.getJob(jobId);
            setJob(data);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch job');
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        if (!jobId) return;

        // Initial fetch
        fetchJob();

        // Set up polling
        const intervalId = setInterval(fetchJob, POLL_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [jobId, fetchJob]);

    return { job, loading, error, refetch: fetchJob };
}

export default useJobPolling;
