/**
 * Model Selector Component
 * Toggle between Nano Banana (free/fast) and Nano Banana Pro (paid/quality)
 */

import { Zap, Crown } from 'lucide-react';
import type { GeminiModel } from '@/lib/api';

interface ModelSelectorProps {
    value: GeminiModel;
    onChange: (model: GeminiModel) => void;
    disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                AI Model
            </label>
            <div className="flex gap-2">
                {/* Nano Banana (Free) */}
                <button
                    type="button"
                    onClick={() => onChange('nano_banana')}
                    disabled={disabled}
                    className={`
                        flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl 
                        border-2 transition-all duration-200
                        ${value === 'nano_banana'
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/12 text-[var(--color-primary)]'
                            : 'border-[var(--color-line)]/12 bg-white hover:border-[var(--color-line)]/25 text-[var(--color-text-muted)]'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5'}
                    `}
                >
                    <Zap className="w-4 h-4" />
                    <div className="text-left">
                        <div className="font-bold text-sm">Fast</div>
                        <div className="text-[10px] opacity-70">Free • 1024px</div>
                    </div>
                </button>

                {/* Nano Banana Pro (Paid) */}
                <button
                    type="button"
                    onClick={() => onChange('nano_banana_pro')}
                    disabled={disabled}
                    className={`
                        flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl 
                        border-2 transition-all duration-200
                        ${value === 'nano_banana_pro'
                            ? 'border-[var(--color-secondary)] bg-[var(--color-secondary)]/12 text-[var(--color-foreground)]'
                            : 'border-[var(--color-line)]/12 bg-white hover:border-[var(--color-line)]/25 text-[var(--color-text-muted)]'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5'}
                    `}
                >
                    <Crown className="w-4 h-4" />
                    <div className="text-left">
                        <div className="font-bold text-sm">Pro</div>
                        <div className="text-[10px] opacity-70">Paid • 4K</div>
                    </div>
                </button>
            </div>

            {/* Info text */}
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {value === 'nano_banana_pro'
                    ? '⚠️ Pro uses paid API credits for higher quality output'
                    : '✓ Fast mode is free and optimized for batch processing'
                }
            </p>
        </div>
    );
}
