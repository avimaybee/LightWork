/**
 * useSessionRecovery Hook
 * Persists job ID to LocalStorage for session recovery
 * Following optimistic-state-sync skill patterns
 */
import { useState, useEffect, useCallback } from 'react';

const JOB_ID_KEY = 'bananabatch_job_id';

interface UseSessionRecoveryResult {
    jobId: string | null;
    saveJobId: (id: string) => void;
    clearJobId: () => void;
}

export function useSessionRecovery(): UseSessionRecoveryResult {
    const [jobId, setJobId] = useState<string | null>(() => {
        // Initialize from localStorage
        if (typeof window !== 'undefined') {
            return localStorage.getItem(JOB_ID_KEY);
        }
        return null;
    });

    // Sync to localStorage when jobId changes
    useEffect(() => {
        if (jobId) {
            localStorage.setItem(JOB_ID_KEY, jobId);
        }
    }, [jobId]);

    const saveJobId = useCallback((id: string) => {
        setJobId(id);
        localStorage.setItem(JOB_ID_KEY, id);
    }, []);

    const clearJobId = useCallback(() => {
        setJobId(null);
        localStorage.removeItem(JOB_ID_KEY);
    }, []);

    return { jobId, saveJobId, clearJobId };
}

export default useSessionRecovery;
