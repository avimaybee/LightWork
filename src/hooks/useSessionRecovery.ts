import { useState, useCallback } from 'react';

const STORAGE_KEY = 'lightwork_active_job';

interface StoredSession {
    jobId: string;
    createdAt: number;
}

export function useSessionRecovery() {
    const [activeJobId, setActiveJobId] = useState<string | null>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return null;

            const session: StoredSession = JSON.parse(stored);
            const isRecent = Date.now() - session.createdAt < 24 * 60 * 60 * 1000;
            if (isRecent && session.jobId) return session.jobId;

            localStorage.removeItem(STORAGE_KEY);
            return null;
        } catch {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
    });

    const [hasRecoveredSession, setHasRecoveredSession] = useState(() => !!activeJobId);

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
