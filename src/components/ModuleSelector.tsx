import * as React from 'react';
import { cn } from '@/lib/utils';
import { getModuleIcon, categoryLabels } from '@/lib/icons';
import type { Module } from '@/lib/api';

interface ModuleSelectorProps {
    modules: Module[];
    selectedId: string | null;
    onSelect: (module: Module) => void;
    disabled?: boolean;
    className?: string;
}

export function ModuleSelector({
    modules,
    selectedId,
    onSelect,
    disabled = false,
    className,
}: ModuleSelectorProps) {
    const groupedModules = React.useMemo(() => {
        const groups: Record<string, Module[]> = {};
        modules.forEach((module) => {
            const category = module.category || 'general';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(module);
        });
        return groups;
    }, [modules]);

    const categories = Object.keys(groupedModules);

    return (
        <div className={cn('space-y-12', className)}>
            {categories.map((category) => (
                <div key={category} className="space-y-6">
                    <div className="flex items-center gap-4 px-2">
                        <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-[var(--color-accent)]">
                            {categoryLabels[category] || category}
                        </h3>
                        <div className="h-px flex-1 bg-gradient-to-r from-[var(--color-border)] to-transparent" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupedModules[category].map((module) => {
                            const Icon = getModuleIcon(module.icon);
                            const isSelected = selectedId === module.id;

                            return (
                                <button
                                    key={module.id}
                                    onClick={() => onSelect(module)}
                                    disabled={disabled}
                                    className={cn(
                                        'group relative flex flex-col p-6 rounded-[24px] transition-all duration-500 text-left overflow-hidden',
                                        'border border-[var(--color-border)]',
                                        
                                        // Interaction
                                        disabled
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:border-[var(--color-accent)]/30 hover:shadow-float hover:-translate-y-1',

                                        // Selection State
                                        isSelected
                                            ? 'bg-white shadow-2xl ring-2 ring-[var(--color-accent)] border-transparent'
                                            : 'bg-white/50 backdrop-blur-sm'
                                    )}
                                >
                                    {/* Background Noise Overlay */}
                                    <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />
                                    
                                    <div className="flex items-start justify-between mb-6 relative z-10">
                                        <div
                                            className={cn(
                                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                                                isSelected ? "bg-[var(--color-accent)] text-white rotate-3 scale-110 shadow-lg shadow-[var(--color-accent)]/20" : "bg-[var(--color-canvas)] text-[var(--color-ink-sub)] group-hover:bg-white group-hover:text-[var(--color-ink)] group-hover:rotate-3"
                                            )}
                                        >
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        
                                        {isSelected && (
                                            <div className="w-6 h-6 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center shadow-lg animate-scale-in">
                                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative z-10">
                                        <h4 className={cn(
                                            "font-display font-extrabold text-lg tracking-tight transition-colors mb-1",
                                            isSelected ? "text-[var(--color-ink)]" : "text-[var(--color-ink-sub)] group-hover:text-[var(--color-ink)]"
                                        )}>
                                            {module.name}
                                        </h4>
                                        <p className="text-xs text-[var(--color-ink-sub)] font-medium leading-relaxed line-clamp-2 opacity-70">
                                            {module.description || 'Specialized visual intelligence for high-fidelity asset refinement.'}
                                        </p>
                                    </div>

                                    {/* Subtle Gradient on Selection */}
                                    {isSelected && (
                                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-[var(--color-accent)]/5 to-transparent rounded-tl-full pointer-events-none" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
