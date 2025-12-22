import * as React from 'react';
import { Command, Trash2, Search, Play, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getModuleIcon } from '@/lib/icons';
import type { JobWithModule } from '@/lib/api';

interface ProjectArchiveProps {
    projects: JobWithModule[];
    activeJobId: string | null;
    isOnline: boolean;
    connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onProjectSelect: (project: JobWithModule) => void;
    onNewProject: () => void;
    onCleanup: () => void;
    onProjectDelete: (e: React.MouseEvent, id: string) => void;
    onRetryJob?: (id: string) => void;
    onBulkEditPrompt?: (ids: string[]) => void;
    isLoadingProjects: boolean;
    observerTarget: React.RefObject<HTMLDivElement | null>;
    isProcessing: boolean;
}

export function ProjectArchive({
    projects,
    activeJobId,
    isOnline,
    connectionStatus,
    searchQuery,
    onSearchChange,
    onProjectSelect,
    onNewProject,
    onCleanup,
    onProjectDelete,
    onRetryJob,
    onBulkEditPrompt,
    isLoadingProjects,
    observerTarget,
    isProcessing,
}: ProjectArchiveProps) {
    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-8 border-b border-[var(--color-border)] bg-white/50 backdrop-blur-xl sticky top-0 z-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center shadow-lg shadow-[var(--color-accent)]/20 rotate-3">
                        <Command className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-display font-black text-xl tracking-tight leading-none text-[var(--color-ink)]">LIGHTWORK</h1>
                        <p className="text-[10px] font-mono font-bold text-[var(--color-accent)] tracking-[0.2em] mt-1 uppercase">Visual Intelligence</p>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h2 className="font-display font-extrabold text-xs tracking-widest uppercase text-[var(--color-ink-sub)]">Archive</h2>
                        {projects.length > 0 && onBulkEditPrompt && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onBulkEditPrompt(projects.map(p => p.id))}
                                className="h-6 px-2 text-[9px] font-bold uppercase tracking-tighter hover:bg-[var(--color-accent-sub)] hover:text-[var(--color-accent)]"
                            >
                                Bulk Edit
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            !isOnline ? "bg-red-500" :
                                connectionStatus === 'reconnecting' ? "bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.5)]" :
                                    "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                        )} />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-tighter text-[var(--color-ink-sub)]">
                            {!isOnline ? "Offline" :
                                connectionStatus === 'reconnecting' ? "Reconnecting..." :
                                    "System Online"}
                        </span>
                    </div>
                </div>

                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all text-[var(--color-ink)]"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-sub)]">
                        <Search className="w-3.5 h-3.5" />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                {projects.length === 0 && !isLoadingProjects && (
                    <div className="p-8 text-center">
                        <p className="text-xs font-mono text-[var(--color-ink-sub)] uppercase tracking-widest opacity-50">
                            {searchQuery ? 'No matches found' : 'No projects found'}
                        </p>
                    </div>
                )}

                {projects.map((p) => {
                    const Icon = getModuleIcon(p.module_icon);
                    const isSelected = activeJobId === p.id;

                    return (
                        <button
                            key={p.id}
                            onClick={() => onProjectSelect(p)}
                            disabled={isProcessing}
                            className={cn(
                                "w-full text-left p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                                isSelected
                                    ? "bg-[var(--color-accent-sub)] border border-[var(--color-accent)]/20 shadow-sm"
                                    : "hover:bg-[var(--color-canvas)] border border-transparent"
                            )}
                        >
                            <div className="flex items-start justify-between mb-2 relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                                        isSelected ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-canvas)] text-[var(--color-ink-sub)] group-hover:bg-white"
                                    )}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-display font-bold text-sm tracking-tight line-clamp-1 text-[var(--color-ink)]">
                                            {p.module_name || 'Untitled Project'}
                                        </p>
                                        <p className="text-[10px] font-mono text-[var(--color-ink-sub)] font-medium">
                                            {new Date(p.created_at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "h-5 px-2 rounded-full text-[9px] font-black tracking-widest uppercase border-none",
                                        p.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-700" :
                                            p.status === 'PROCESSING' ? "bg-blue-100 text-blue-700 animate-pulse" :
                                                p.status === 'FAILED' ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                                    )}
                                >
                                    {p.status}
                                </Badge>
                            </div>

                            <div className="absolute right-4 bottom-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                                {p.status === 'FAILED' && onRetryJob && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRetryJob(p.id);
                                        }}
                                        className="w-8 h-8 rounded-lg bg-white shadow-sm border border-[var(--color-border)] flex items-center justify-center text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-all"
                                        title="Retry Job"
                                    >
                                        <Play className="w-3.5 h-3.5 fill-current" />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => onProjectDelete(e, p.id)}
                                    className="w-8 h-8 rounded-lg bg-white shadow-sm border border-[var(--color-border)] flex items-center justify-center text-[var(--color-ink-sub)] hover:text-red-500 hover:border-red-200 transition-all"
                                    title="Delete Project"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    );
                })}

                <div ref={observerTarget} className="h-10 flex items-center justify-center">
                    {isLoadingProjects && <Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)]" />}
                </div>
            </div>

            <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-canvas)]/50 flex flex-col gap-2 mt-auto">
                <Button
                    onClick={onNewProject}
                    disabled={isProcessing}
                    className="w-full h-12 rounded-2xl bg-[var(--color-ink)] hover:bg-[var(--color-accent)] text-white font-display font-bold tracking-tight transition-all shadow-xl shadow-black/5 group"
                >
                    <Play className="w-4 h-4 mr-2 fill-current group-hover:scale-110 transition-transform" />
                    New Project
                </Button>
                <Button
                    variant="ghost"
                    onClick={onCleanup}
                    className="w-full h-10 rounded-xl text-[10px] font-bold tracking-widest uppercase text-[var(--color-ink-sub)] hover:text-red-500 hover:bg-red-50 transition-all"
                >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Prune History
                </Button>
            </div>
        </div>
    );
}
