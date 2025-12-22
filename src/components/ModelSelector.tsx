import { Zap, Crown, Sparkles } from 'lucide-react';
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
            'flex items-center gap-1 p-1 bg-[var(--color-canvas-sub)]/50 backdrop-blur-xl rounded-2xl border border-[var(--color-border)]/50 shadow-inner w-fit',
            className
        )}>
            <button
                onClick={() => onChange('nano_banana')}
                disabled={disabled}
                className={cn(
                    'relative group flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-300 text-left overflow-hidden min-w-[140px]',
                    value === 'nano_banana'
                        ? 'bg-[var(--color-canvas)] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] border border-[var(--color-border)]'
                        : 'hover:bg-[var(--color-canvas)]/50 border border-transparent opacity-60 hover:opacity-100'
                )}
            >
                {value === 'nano_banana' && (
                    <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />
                )}
                
                <div className={cn(
                    'p-1.5 rounded-lg transition-colors shrink-0',
                    value === 'nano_banana' 
                        ? 'bg-[var(--color-ink)] text-[var(--color-canvas)]' 
                        : 'bg-[var(--color-border)]/30 text-[var(--color-ink-sub)] group-hover:text-[var(--color-ink)]'
                )}>
                    <Zap className="w-3.5 h-3.5" />
                </div>

                <div className="flex flex-col">
                    <span className={cn(
                        'text-[10px] font-black tracking-[0.1em] uppercase leading-none mb-0.5',
                        value === 'nano_banana' ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-sub)]'
                    )}>
                        Flash
                    </span>
                    <span className={cn(
                        'text-[9px] font-medium leading-none whitespace-nowrap',
                        value === 'nano_banana' ? 'text-[var(--color-ink-sub)]' : 'text-[var(--color-ink-sub)]/60'
                    )}>
                        Fast & Efficient
                    </span>
                </div>

                {value === 'nano_banana' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-ink)]" />
                )}
            </button>

            <button
                onClick={() => onChange('nano_banana_pro')}
                disabled={disabled}
                className={cn(
                    'relative group flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-300 text-left overflow-hidden min-w-[140px]',
                    value === 'nano_banana_pro'
                        ? 'bg-[var(--color-canvas)] shadow-[0_4px_12px_-4px_rgba(255,79,0,0.1)] border border-[var(--color-accent)]/20'
                        : 'hover:bg-[var(--color-canvas)]/50 border border-transparent opacity-60 hover:opacity-100'
                )}
            >
                {value === 'nano_banana_pro' && (
                    <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />
                )}

                <div className={cn(
                    'p-1.5 rounded-lg transition-colors shrink-0',
                    value === 'nano_banana_pro' 
                        ? 'bg-[var(--color-accent)] text-white' 
                        : 'bg-[var(--color-border)]/30 text-[var(--color-ink-sub)] group-hover:text-[var(--color-ink)]'
                )}>
                    <Crown className="w-3.5 h-3.5" />
                </div>

                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn(
                            'text-[10px] font-black tracking-[0.1em] uppercase leading-none',
                            value === 'nano_banana_pro' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-sub)]'
                        )}>
                            Pro
                        </span>
                        {value === 'nano_banana_pro' && (
                            <Sparkles className="w-2.5 h-2.5 text-[var(--color-accent)] animate-pulse" />
                        )}
                    </div>
                    <span className={cn(
                        'text-[9px] font-medium leading-none whitespace-nowrap',
                        value === 'nano_banana_pro' ? 'text-[var(--color-ink-sub)]' : 'text-[var(--color-ink-sub)]/60'
                    )}>
                        Max Intelligence
                    </span>
                </div>

                {value === 'nano_banana_pro' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]" />
                )}
            </button>
        </div>
    );
}
