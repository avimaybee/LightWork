import * as React from 'react';
import { Check } from 'lucide-react';
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
                    <div className="flex items-center gap-3">
                        <span className="w-3 h-3 bg-black rounded-full" />
                        <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-[#666]">
                            {categoryLabels[category] || category}
                        </h3>
                        <div className="h-px flex-1 border-t-2 border-dashed border-[#CCC]" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {groupedModules[category].map((module) => {
                            const Icon = getModuleIcon(module.icon);
                            const isSelected = selectedId === module.id;

                            return (
                                <button
                                    key={module.id}
                                    onClick={() => onSelect(module)}
                                    disabled={disabled}
                                    className={cn(
                                        'group relative flex flex-col items-start p-8 text-left transition-all duration-200',
                                        // Shape & Border
                                        'rounded-[32px] border-2 border-black bg-white',

                                        // Interaction
                                        disabled
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:-translate-y-2 hover:shadow-[8px_8px_0px_0px_#1A1A1A]',

                                        // Selection State
                                        isSelected
                                            ? 'bg-[var(--color-yellow)] shadow-[8px_8px_0px_0px_var(--color-line)] translate-y-[-4px]'
                                            : 'shadow-[4px_4px_0px_0px_var(--color-line)]'
                                    )}
                                >
                                    <div className="flex items-start justify-between w-full mb-6 relative">
                                        <div
                                            className={cn(
                                                "w-16 h-16 rounded-2xl flex items-center justify-center border-2 border-black transition-transform duration-300 group-hover:scale-110",
                                                isSelected ? "bg-white" : "bg-[var(--color-cream)]"
                                            )}
                                        >
                                            <Icon className="w-8 h-8 text-black stroke-[2px]" />
                                        </div>

                                        {isSelected && (
                                            <div className="absolute -right-2 -top-2 w-8 h-8 rounded-full bg-black flex items-center justify-center animate-scale-in">
                                                <Check className="w-5 h-5 text-white stroke-[4px]" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-display font-bold text-2xl leading-none tracking-tight text-black">
                                            {module.name}
                                        </h4>
                                        <p className="font-body text-sm font-medium text-black/70 leading-relaxed">
                                            {module.description}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
