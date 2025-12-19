/**
 * StatusBadge Component
 * Visual status indicators for job/image states
 * Following PRD specifications for status badges
 */
import type { JobStatus } from '../lib/api';

interface StatusBadgeProps {
    status: JobStatus;
    showLabel?: boolean;
    size?: 'sm' | 'md';
}

const statusConfig: Record<JobStatus, {
    label: string;
    className: string;
    icon: string;
}> = {
    PENDING: {
        label: 'Waiting',
        className: 'badge-pending',
        icon: '○'
    },
    PROCESSING: {
        label: 'Processing',
        className: 'badge-processing',
        icon: '◐'
    },
    COOLDOWN: {
        label: 'Retrying...',
        className: 'badge-cooldown',
        icon: '⏳'
    },
    COMPLETED: {
        label: 'Done',
        className: 'badge-completed',
        icon: '✓'
    },
    FAILED: {
        label: 'Failed',
        className: 'badge-failed',
        icon: '✕'
    },
    REFUSED: {
        label: 'Blocked',
        className: 'badge-refused',
        icon: '⊘'
    },
};

export function StatusBadge({ status, showLabel = true, size = 'md' }: StatusBadgeProps) {
    const config = statusConfig[status];

    return (
        <span
            className={`badge ${config.className}`}
            style={{
                fontSize: size === 'sm' ? 'var(--text-xs)' : undefined,
                padding: size === 'sm' ? 'var(--space-1) var(--space-2)' : undefined,
            }}
        >
            <span>{config.icon}</span>
            {showLabel && <span>{config.label}</span>}
        </span>
    );
}

export default StatusBadge;
