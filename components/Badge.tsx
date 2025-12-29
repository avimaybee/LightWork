import React from 'react';

type BadgeVariant = 'success' | 'error' | 'warning' | 'pending' | 'processing' | 'default';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
    variant?: BadgeVariant;
    size?: BadgeSize;
    children: React.ReactNode;
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-status-success-bg text-status-success-text',
    error: 'bg-status-error-bg text-status-error-text',
    warning: 'bg-status-warning-bg text-status-warning-text',
    pending: 'bg-status-pending-bg text-status-pending-text',
    processing: 'bg-status-processing-bg text-status-processing-text',
    default: 'bg-stone-100 text-stone-600',
};

const sizeStyles: Record<BadgeSize, string> = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-[10px] px-2 py-0.5',
    lg: 'text-xs px-2.5 py-1',
};

export const Badge: React.FC<BadgeProps> = ({
    variant = 'default',
    size = 'md',
    children,
    className = '',
}) => {
    return (
        <span
            className={`
                inline-flex items-center rounded-full font-bold uppercase tracking-wider
                ${variantStyles[variant]}
                ${sizeStyles[size]}
                ${className}
            `}
        >
            {children}
        </span>
    );
};

// Status-specific badge presets for processing states
type ProcessingStatus = 'queued' | 'uploading' | 'processing' | 'batch_pending' | 'batch_processing' | 'completed' | 'error' | 'paused' | 'retrying';

const statusToVariant: Record<ProcessingStatus, BadgeVariant> = {
    queued: 'pending',
    uploading: 'pending',
    processing: 'processing',
    batch_pending: 'warning',
    batch_processing: 'processing',
    completed: 'success',
    error: 'error',
    paused: 'warning',
    retrying: 'warning',
};

interface StatusBadgeProps {
    status: ProcessingStatus;
    size?: BadgeSize;
    className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    size = 'md',
    className = '',
}) => {
    const variant = statusToVariant[status] || 'default';
    const displayText = status.replace('_', ' ').replace('-', ' ');
    
    return (
        <Badge variant={variant} size={size} className={className}>
            {displayText}
        </Badge>
    );
};

// Dot badge for minimal status indication
interface DotBadgeProps {
    variant?: BadgeVariant;
    pulse?: boolean;
    className?: string;
}

export const DotBadge: React.FC<DotBadgeProps> = ({
    variant = 'default',
    pulse = false,
    className = '',
}) => {
    const colorMap: Record<BadgeVariant, string> = {
        success: 'bg-status-success',
        error: 'bg-status-error',
        warning: 'bg-status-warning',
        pending: 'bg-status-pending',
        processing: 'bg-status-processing',
        default: 'bg-stone-400',
    };
    
    return (
        <span
            className={`
                inline-block w-2 h-2 rounded-full
                ${colorMap[variant]}
                ${pulse ? 'animate-pulse' : ''}
                ${className}
            `}
        />
    );
};

export default Badge;
