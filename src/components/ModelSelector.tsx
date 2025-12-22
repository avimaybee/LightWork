import { Zap, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeminiModel } from '@/lib/api';

interface ModelSelectorProps {
    value: GeminiModel;
    onChange: (value: GeminiModel) => void;
    disabled?: boolean;
    className?: string;
}

export function ModelSelector({
    value,
    onChange,
    disabled = false,
    className,
}: ModelSelectorProps) {
    return (
        <div className={cn(
            'flex p-1 bg-[var(--color-border)]/20 rounded-lg border border-[var(--color-border)]',
            className
        )}>
            <button
                onClick={() => onChange('nano_banana')}
                disabled={disabled}
                className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                    value === 'nano_banana'
                        ? 'bg-white text-[var(--color-ink)] shadow-sm'
                        : 'text-[var(--color-ink-sub)] hover:text-[var(--color-ink)]'
                )}
            >
                <Zap className="w-3 h-3" />
                <span>Fast</span>
            </button>
            <button
                onClick={() => onChange('nano_banana_pro')}
                disabled={disabled}
                className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                    value === 'nano_banana_pro'
                        ? 'bg-white text-[var(--color-accent)] shadow-sm ring-1 ring-[var(--color-accent)]/10'
                        : 'text-[var(--color-ink-sub)] hover:text-[var(--color-ink)]'
                )}
            >
                <Crown className="w-3 h-3" />
                <span>Pro</span>
            </button>
        </div>
    );
}
