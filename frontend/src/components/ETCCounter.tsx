/**
 * ETCCounter Component
 * Live countdown showing estimated time to completion
 * Per PRD: "Estimated Time to Completion (ETC): A live countdown"
 * Following optimistic-state-sync skill patterns
 */
import { useMemo } from 'react';
import './ETCCounter.css';

interface ETCCounterProps {
    pendingCount: number;
}

// Rate limit: 7 RPM = ~8.57 seconds per request
const REQUESTS_PER_MINUTE = 7;
const SECONDS_PER_REQUEST = 60 / REQUESTS_PER_MINUTE;

export function ETCCounter({ pendingCount }: ETCCounterProps) {
    const etcString = useMemo(() => {
        if (pendingCount <= 0) return 'Complete!';

        const totalSeconds = Math.ceil(pendingCount * SECONDS_PER_REQUEST);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes > 0) {
            return `~${minutes}m ${seconds}s`;
        }
        return `~${seconds}s`;
    }, [pendingCount]);

    if (pendingCount <= 0) {
        return (
            <span className="etc-counter etc-complete">
                ✓ Complete!
            </span>
        );
    }

    return (
        <span className="etc-counter">
            <span className="etc-icon">⏱️</span>
            <span className="etc-time">{etcString}</span>
        </span>
    );
}

export default ETCCounter;
