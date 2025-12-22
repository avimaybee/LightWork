import * as React from 'react';
import { cn } from '@/lib/utils';
import { getModuleIcon, categoryLabels } from '@/lib/icons';
import { Search, X } from 'lucide-react';
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
    const [searchQuery, setSearchQuery] = React.useState('');

    // Filter modules by name, description, or category
    const filteredModules = React.useMemo(() => {
        if (!searchQuery.trim()) return modules;

        const query = searchQuery.toLowerCase().trim();
        return modules.filter((module) =>
            module.name.toLowerCase().includes(query) ||
            (module.description?.toLowerCase().includes(query)) ||
            (module.category?.toLowerCase().includes(query)) ||
            (categoryLabels[module.category || '']?.toLowerCase().includes(query))
        );
    }, [modules, searchQuery]);

    // Group filtered modules by category
    const groupedModules = React.useMemo(() => {
        const groups: Record<string, Module[]> = {};
        filteredModules.forEach((module) => {
            const category = module.category || 'general';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(module);
        });
        return groups;
    }, [filteredModules]);

    const categories = Object.keys(groupedModules);

    return (
        <div className={cn('space-y-8', className)}>
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-ink-sub)]" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search modules..."
                    disabled={disabled}
                    className={cn(
                        'w-full pl-12 pr-12 py-4 rounded-2xl',
                        'text-base font-medium',
                        'bg-white border border-[var(--color-border)]',
                        'text-[var(--color-ink)] placeholder:text-[var(--color-ink-sub)]/50',
                        'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]',
                        'transition-all duration-300',
                        disabled && 'opacity-50 cursor-not-allowed'
                    )}
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--color-canvas)] hover:bg-[var(--color-border)] flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4 text-[var(--color-ink-sub)]" />
                    </button>
                )}
            </div>

            {/* Empty State */}
            {filteredModules.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--color-canvas)] flex items-center justify-center mb-4">
                        <Search className="w-8 h-8 text-[var(--color-ink-sub)]/50" />
                    </div>
                    <p className="text-lg font-semibold text-[var(--color-ink)]">No modules found</p>
                    <p className="text-sm text-[var(--color-ink-sub)] mt-1">
                        Try a different search term
                    </p>
                </div>
            )}

            {/* Module Grid */}
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
                                                                        
                                                                        {/* Hover Preview Overlay */}
                                                                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none overflow-hidden">
                                                                            <div className="absolute inset-0 flex">
                                                                                <div className="flex-1 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center overflow-hidden grayscale">
                                                                                    <Icon className="w-24 h-24 text-slate-400/20 rotate-12 scale-150" />
                                                                                </div>
                                                                                <div className="w-0.5 bg-white/50 h-full relative z-10" />
                                                                                <div className="flex-1 bg-gradient-to-br from-[var(--color-accent)]/10 to-[var(--color-accent)]/20 flex items-center justify-center overflow-hidden">
                                                                                    <Icon className="w-24 h-24 text-[var(--color-accent)]/10 -rotate-12 scale-150" />
                                                                                </div>
                                                                            </div>
                                                                            {/* "Result" Label */}
                                                                            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-2 py-1 rounded-md shadow-sm border border-slate-200 transform translate-y-8 group-hover:translate-y-0 transition-transform duration-500 delay-100">
                                                                                <span className="text-[8px] font-mono font-black uppercase tracking-tighter text-[var(--color-accent)]">Optimized Result</span>
                                                                            </div>
                                                                        </div>
                                    
                                                                        <div className="flex items-start justify-between mb-6 relative z-10 group-hover:opacity-0 transition-opacity duration-300">
                                    
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

