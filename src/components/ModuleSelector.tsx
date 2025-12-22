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
        <div className={cn('space-y-8', className)}>
            {categories.map((category) => (
                <div key={category} className="space-y-2">
                    <h3 className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-sub)] opacity-70">
                        {categoryLabels[category] || category}
                    </h3>

                    <div className="space-y-1">
                        {groupedModules[category].map((module) => {
                            const Icon = getModuleIcon(module.icon);
                            const isSelected = selectedId === module.id;

                            return (
                                <button
                                    key={module.id}
                                    onClick={() => onSelect(module)}
                                    disabled={disabled}
                                    className={cn(
                                        'w-full group relative flex items-center p-3 rounded-xl transition-all duration-200',
                                        
                                        // Interaction
                                        disabled
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-white hover:shadow-subtle',

                                        // Selection State
                                        isSelected
                                            ? 'bg-white shadow-float ring-1 ring-black/5'
                                            : 'bg-transparent text-[var(--color-ink-sub)]'
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center mr-3 transition-colors duration-200",
                                            isSelected ? "bg-[var(--color-ink)] text-white" : "bg-[var(--color-border)] text-[var(--color-ink-sub)] group-hover:text-[var(--color-ink)]"
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                    </div>

                                    <div className="flex-1 text-left min-w-0">
                                        <h4 className={cn(
                                            "text-sm font-medium truncate transition-colors",
                                            isSelected ? "text-[var(--color-ink)]" : "text-[var(--color-ink-sub)] group-hover:text-[var(--color-ink)]"
                                        )}>
                                            {module.name}
                                        </h4>
                                    </div>

                                    {isSelected && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />
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
