import React from 'react';
import { Zap, Coins } from 'lucide-react';
import { ApiMode } from '../types';

interface BatchModeToggleProps {
    mode: ApiMode;
    onChange: (mode: ApiMode) => void;
    disabled?: boolean;
    queuedCount?: number;
}

export function BatchModeToggle({ mode, onChange, disabled, queuedCount = 0 }: BatchModeToggleProps) {
    const showSuggestion = queuedCount >= 5 && mode === 'fast';

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
                <button
                    onClick={() => onChange('fast')}
                    disabled={disabled}
                    className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                        ${mode === 'fast'
                            ? 'bg-white text-stone-900 shadow-sm'
                            : 'text-stone-500 hover:text-stone-700'}
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                >
                    <Zap className="w-3.5 h-3.5" />
                    Fast
                </button>
                <button
                    onClick={() => onChange('economy')}
                    disabled={disabled}
                    className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                        ${mode === 'economy'
                            ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                            : 'text-stone-500 hover:text-stone-700'}
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                >
                    <Coins className="w-3.5 h-3.5" />
                    Economy
                </button>
            </div>

            {/* Suggestion when many items queued */}
            {showSuggestion && (
                <div className="flex items-center gap-2 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-md">
                    <Coins className="w-3 h-3 text-emerald-600" />
                    <span className="text-[10px] text-emerald-700">
                        {queuedCount}+ images? Save 50% with Economy mode
                    </span>
                </div>
            )}

            {/* Mode description */}
            <p className="text-[10px] text-stone-400 px-1">
                {mode === 'fast'
                    ? 'Real-time processing, immediate results'
                    : 'Batch processing, 50% cheaper • ~1-24h'}
            </p>
        </div>
    );
}
