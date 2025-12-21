import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'lightwork_active_job';

interface StoredSession {
    jobId: string;
    createdAt: number;
}

export function useSessionRecovery() {
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [hasRecoveredSession, setHasRecoveredSession] = useState(false);

    // Check for existing session on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const session: StoredSession = JSON.parse(stored);
                // Only recover sessions less than 24 hours old
                const isRecent = Date.now() - session.createdAt < 24 * 60 * 60 * 1000;
                if (isRecent && session.jobId) {
                    setActiveJobId(session.jobId);
                    setHasRecoveredSession(true);
                } else {
                    // Clear stale session
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch {
            // Invalid stored data
            localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    // Save session
    const saveSession = useCallback((jobId: string) => {
        const session: StoredSession = {
            jobId,
            createdAt: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        setActiveJobId(jobId);
    }, []);

    // Clear session
    const clearSession = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setActiveJobId(null);
        setHasRecoveredSession(false);
    }, []);

    // Dismiss recovery prompt without clearing the job
    const dismissRecovery = useCallback(() => {
        setHasRecoveredSession(false);
    }, []);

    return {
        activeJobId,
        hasRecoveredSession,
        saveSession,
        clearSession,
        dismissRecovery,
    };
}
