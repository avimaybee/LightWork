import { useState, useCallback } from 'react';

const STORAGE_KEY = 'lightwork_active_job';

interface StoredSession {
    jobId: string | null;
    moduleId: string | null;
    model: string | null;
    createdAt: number;
}

export function useSessionRecovery() {
    const [session, setSession] = useState<StoredSession | null>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return null;

            const session: StoredSession = JSON.parse(stored);
            const isRecent = Date.now() - session.createdAt < 24 * 60 * 60 * 1000;
            if (isRecent) return session;

            localStorage.removeItem(STORAGE_KEY);
            return null;
        } catch {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
    });

    const [hasRecoveredSession, setHasRecoveredSession] = useState(() => !!session?.jobId);

    // Save session
    const saveSession = useCallback((jobId: string | null, moduleId: string | null, model: string | null) => {
        const newSession: StoredSession = {
            jobId,
            moduleId,
            model,
            createdAt: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
        setSession(newSession);
    }, []);

    // Clear session
    const clearSession = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setSession(null);
        setHasRecoveredSession(false);
    }, []);

    // Dismiss recovery prompt without clearing the job
    const dismissRecovery = useCallback(() => {
        setHasRecoveredSession(false);
    }, []);

    return {
        activeJobId: session?.jobId || null,
        recoveredModuleId: session?.moduleId || null,
        recoveredModel: session?.model || null,
        hasRecoveredSession,
        saveSession,
        clearSession,
        dismissRecovery,
    };
}
