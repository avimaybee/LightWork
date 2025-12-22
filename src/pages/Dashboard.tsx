import * as React from 'react';
import { 
    Box, 
    Play, 
    Download, 
    X, 
    Command,
    Clock,
    Loader2,
} from 'lucide-react';
import { DropZone } from '@/components/DropZone';
import { ModuleSelector } from '@/components/ModuleSelector';
import { ModelSelector } from '@/components/ModelSelector';
import { StagingGrid, type StagingImage } from '@/components/StagingGrid';
import { PromptEditor } from '@/components/PromptEditor';
import { useJobPolling } from '@/hooks/useJobPolling';
import { useSessionRecovery } from '@/hooks/useSessionRecovery';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getModuleIcon } from '@/lib/icons';
import {
    getModules,
    getJobs,
    createJob,
    uploadImages,
    startJob,
    triggerProcessing,
    getDownloadUrl,
    getModule,
    updateImagePrompt,
    updateJobModel,
    updateModulePrompt,
    type Module,
    type ImageRecord,
    type GeminiModel,
    type JobWithModule,
} from '@/lib/api';

type AppState = 'SETUP' | 'UPLOADING' | 'READY' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface LocalImage extends Partial<ImageRecord> {
    id: string;
    localPreview: string;
    file: File;
    status: ImageRecord['status'];
    specific_prompt: string | null;
    original_filename: string | null;
}

export function Dashboard() {
    // State
    const [appState, setAppState] = React.useState<AppState>('SETUP');
    const [modules, setModules] = React.useState<Module[]>([]);
    const [selectedModule, setSelectedModule] = React.useState<Module | null>(null);
    const [localImages, setLocalImages] = React.useState<LocalImage[]>([]);
    const [selectedModel, setSelectedModel] = React.useState<GeminiModel>('nano_banana');
    const [jobId, setJobId] = React.useState<string | null>(null);
    const [isOnline, setIsOnline] = React.useState(navigator.onLine);

    const [projects, setProjects] = React.useState<JobWithModule[]>([]);

    const [previewMap, setPreviewMap] = React.useState<Record<string, string>>({});
    const [isEditingModulePrompt, setIsEditingModulePrompt] = React.useState(false);
    const previewUrls = React.useRef<Set<string>>(new Set());

    // Prompt editor stats
    const [editingImageId, setEditingImageId] = React.useState<string | null>(null);

    // Session recovery
    const { activeJobId, hasRecoveredSession, saveSession, clearSession, dismissRecovery } = useSessionRecovery();

    // Job polling
    const { job } = useJobPolling({
        jobId: jobId || activeJobId,
        enabled: !!(jobId || activeJobId),
        onComplete: (completedJob) => {
            setAppState(completedJob.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED');
        },
    });

    const editingImage = React.useMemo(() => {
        if (!editingImageId) return undefined;
        return job?.images?.find(img => img.id === editingImageId)
            ?? localImages.find(img => img.id === editingImageId);
    }, [editingImageId, job?.images, localImages]);

    // Load projects (job history)
    React.useEffect(() => {
        async function loadProjects() {
            try {
                const data = await getJobs();
                setProjects(data);
            } catch {
                setProjects([]);
            }
        }
        loadProjects();
    }, []);

    // Refresh projects when job changes status (keeps sidebar history current)
    React.useEffect(() => {
        if (!job) return;
        getJobs().then(setProjects).catch(() => undefined);
    }, [job]);

    // Load modules
    React.useEffect(() => {
        async function loadModules() {
            try {
                const data = await getModules();
                setModules(data);
                if (data.length > 0 && !selectedModule) {
                    const fullModule = await getModule(data[0].id);
                    setSelectedModule(fullModule);
                }
            } catch {
                setModules([{ id: 'mock', name: 'Mock Module', description: 'Mock', category: 'general', system_prompt: '', icon: 'box', created_at: 0 }]);
            }
        }
        loadModules();
    }, [selectedModule]);

    // Online/offline indicator
    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Persist model selection (only works on pending jobs)
    React.useEffect(() => {
        if (!jobId) return;
        if (!job) return;
        if (job.status !== 'PENDING') return;
        if (job.model === selectedModel) return;
        updateJobModel(jobId, selectedModel).catch(console.error);
    }, [jobId, job, selectedModel]);

    // Keep local model selection in sync when recovering a session
    React.useEffect(() => {
        if (!job) return;
        setSelectedModel(job.model);
    }, [job]);

    // Keep app state aligned to job status (covers project/history selection too)
    React.useEffect(() => {
        if (!job) return;
        if (appState === 'UPLOADING' && job.status === 'PENDING') return;
        if (job.status === 'PROCESSING') setAppState('PROCESSING');
        else if (job.status === 'PENDING') setAppState('READY');
        else if (job.status === 'COMPLETED') setAppState('COMPLETED');
        else setAppState('FAILED');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [job?.id, job?.status]);

    React.useEffect(() => {
        if (hasRecoveredSession && job) {
            if (job.status === 'PROCESSING') setAppState('PROCESSING');
            else if (job.status === 'COMPLETED') setAppState('COMPLETED');
            else if (job.status === 'FAILED') setAppState('FAILED');
            setJobId(job.id);
            dismissRecovery();
        }
    }, [hasRecoveredSession, job, dismissRecovery]);

    // Handlers
    const handleFilesSelected = async (files: File[]) => {
        if (!selectedModule) return;
        if (isProcessing || isComplete) return;

        setAppState('UPLOADING');

        try {
            let id = jobId;
            if (!id) {
                const newJob = await createJob(selectedModule.id, undefined, selectedModel);
                id = newJob.id;
                setJobId(newJob.id);
                saveSession(newJob.id);
            }

            // Create local previews immediately and remember them
            const previews = files.map((file) => {
                const url = URL.createObjectURL(file);
                previewUrls.current.add(url);
                return { name: file.name, url };
            });

            const result = await uploadImages(id!, files);

            // Attach previews to returned image IDs (best-effort, by order)
            setPreviewMap((prev) => {
                const next = { ...prev };
                result.images.forEach((img, idx) => {
                    const match = previews[idx];
                    if (match) next[img.id] = match.url;
                });
                return next;
            });

            // Job now exists and images are staged remotely
            setLocalImages([]);
            setAppState('READY');
        } catch {
            setAppState('READY');
        }
    };

    const handleModuleSelect = async (module: Module) => {
        try {
            const fullModule = await getModule(module.id);
            setSelectedModule(fullModule);
        } catch {
            setSelectedModule(module);
        }
    };

    const handleProjectSelect = async (project: JobWithModule) => {
        setJobId(project.id);
        setPreviewMap({});

        try {
            const fullModule = await getModule(project.module_id);
            setSelectedModule(fullModule);
        } catch {
            // fall back to leaving the current module
        }
    };


    const handleStart = async () => {
        const id = jobId || activeJobId;
        if (!id) return;
        if (!job || job.images.length === 0) return;
        if (isProcessing || isComplete) return;

        setAppState('PROCESSING');
        try {
            await startJob(id);
            triggerProcessing().catch(console.error);
        } catch {
            setAppState('READY');
        }
    };

    const handleDownload = () => {
        const id = jobId || activeJobId;
        if (id) window.open(getDownloadUrl(id), '_blank');
    };

    const handleNewSession = () => {
        const id = jobId || activeJobId;

        // Do not delete/cancel jobs automatically: projects/history should persist.
        // If you want explicit cleanup later, we can add a dedicated action.
        void id;

        previewUrls.current.forEach(url => URL.revokeObjectURL(url));
        previewUrls.current.clear();
        setPreviewMap({});

        clearSession();
        setJobId(null);
        setLocalImages([]);
        setAppState('SETUP');
    };

    const jobImages = job?.images;
    const displayImages: StagingImage[] = React.useMemo(() => {
        if (jobImages && jobImages.length > 0) {
            return jobImages.map(img => ({ ...img, localPreview: previewMap[img.id] }));
        }
        return localImages;
    }, [jobImages, localImages, previewMap]);

    const isProcessing = appState === 'PROCESSING' || appState === 'UPLOADING';
    const isComplete = appState === 'COMPLETED' || appState === 'FAILED';

    const canEditPrompts = !isProcessing && !isComplete;

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)] selection:bg-[var(--color-accent-sub)] selection:text-[var(--color-accent)]">
            
            {/* SIDEBAR - NAVIGATION & MODULES */}
            <aside className="w-[320px] shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col z-20">
                {/* Header */}
                <div className="h-16 flex items-center px-6 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
                            <Box className="w-5 h-5" />
                        </div>
                        <span className="font-display font-bold text-lg tracking-tight">LightWork</span>
                    </div>
                </div>

                {/* Module List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="mb-4 px-2">
                        <h3 className="text-xs font-semibold text-[var(--color-ink-sub)] uppercase tracking-wider mb-2">Workflows</h3>
                    </div>
                    <ModuleSelector
                        modules={modules}
                        selectedId={selectedModule?.id || null}
                        onSelect={handleModuleSelect}
                        disabled={isProcessing || isComplete || displayImages.length > 0 || !!(jobId || activeJobId)}
                    />

                    {/* Projects / History */}
                    <div className="mt-10">
                        <div className="flex items-center justify-between px-2 mb-2">
                            <h3 className="text-xs font-semibold text-[var(--color-ink-sub)] uppercase tracking-wider">Projects</h3>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 rounded-lg"
                                onClick={handleNewSession}
                                disabled={isProcessing}
                            >
                                New
                            </Button>
                        </div>

                        <div className="space-y-1">
                            {projects.length === 0 && (
                                <div className="px-3 py-2 text-xs text-[var(--color-ink-sub)] opacity-70">
                                    No projects yet.
                                </div>
                            )}

                            {projects.map((p) => {
                                const Icon = getModuleIcon(p.module_icon);
                                const isSelected = (jobId || activeJobId) === p.id;
                                const statusDot = p.status === 'COMPLETED'
                                    ? 'bg-secondary'
                                    : p.status === 'PROCESSING'
                                        ? 'bg-accent'
                                        : p.status === 'FAILED'
                                            ? 'bg-red-500'
                                            : 'bg-muted';

                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => handleProjectSelect(p)}
                                        disabled={isProcessing}
                                        className={cn(
                                            'w-full group relative flex items-center p-3 rounded-xl transition-all duration-200',
                                            isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white hover:shadow-subtle',
                                            isSelected ? 'bg-white shadow-float ring-1 ring-black/5' : 'bg-transparent'
                                        )}
                                    >
                                        <div className={cn(
                                            'w-8 h-8 rounded-lg flex items-center justify-center mr-3 transition-colors duration-200',
                                            isSelected ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-border)] text-[var(--color-ink-sub)] group-hover:text-[var(--color-ink)]'
                                        )}>
                                            <Icon className="w-4 h-4" />
                                        </div>

                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className={cn(
                                                    'text-sm font-medium truncate transition-colors',
                                                    isSelected ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-sub)] group-hover:text-[var(--color-ink)]'
                                                )}>
                                                    {p.module_name}
                                                </h4>
                                                <span className={cn('w-1.5 h-1.5 rounded-full', statusDot)} />
                                            </div>

                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--color-ink-sub)] opacity-70">
                                                <Clock className="w-3 h-3" />
                                                <span className="truncate">{new Date(p.created_at * 1000).toLocaleString()}</span>
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer / Status */}
                <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-muted)]">
                    <div className="flex items-center justify-between text-xs text-[var(--color-ink-sub)]">
                        <span className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500" : "bg-red-500")} />
                            {isOnline ? "System Online" : "Offline"}
                        </span>
                        <span className="font-mono opacity-50">v2.5.0</span>
                    </div>
                </div>
            </aside>

            {/* MAIN STAGE */}
            <main className="flex-1 relative flex flex-col min-w-0">
                
                {/* TOP BAR - Breadcrumbs & Context */}
                <header className="h-16 flex items-center justify-between px-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-2 text-sm text-[var(--color-ink-sub)]">
                        <span>Project</span>
                        <span className="text-[var(--color-border-hover)]">/</span>
                        <span className="text-[var(--color-ink)] font-medium">
                            {jobId ? `Batch #${jobId.slice(0, 8)}` : 'New Session'}
                        </span>
                    </div>
                    
                    {/* Progress Indicator (Subtle) */}
                    {isProcessing && (
                        <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border border-[var(--color-border)] shadow-sm">
                            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
                            <span className="text-xs font-medium">Processing Assets...</span>
                        </div>
                    )}
                </header>

                {/* CANVAS CONTENT */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[var(--color-canvas)]">
                    
                    {/* Empty State / Drop Target */}
                    {localImages.length === 0 && !job && (
                        <div className="h-full flex flex-col items-center justify-center animate-fade-in">
                            <div className="w-full max-w-2xl aspect-[16/9]">
                                <DropZone
                                    onFilesSelected={handleFilesSelected}
                                    maxFiles={50}
                                    currentCount={localImages.length}
                                    disabled={isProcessing}
                                    className="h-full rounded-2xl border-2 border-dashed border-[var(--color-border-hover)] hover:border-[var(--color-accent)] transition-colors"
                                />
                            </div>
                        </div>
                    )}

                    {/* Staging Grid (Active) */}
                    {(displayImages.length > 0 || job) && (
                        <div className="max-w-6xl mx-auto space-y-8 pb-32 animate-slide-up">
                            
                            {/* Stats Header */}
                            <div className="flex items-end justify-between">
                                <div>
                                    <h1 className="font-display text-3xl font-bold text-[var(--color-ink)]">
                                        {selectedModule?.name || 'Batch Processing'}
                                    </h1>
                                    <p className="text-[var(--color-ink-sub)] mt-1">
                                        {displayImages.length} assets queued for refinement
                                    </p>
                                </div>
                                <div className="hidden md:block">
                                    <ModelSelector 
                                        value={selectedModel} 
                                        onChange={setSelectedModel} 
                                        disabled={isProcessing || isComplete || (job?.status !== 'PENDING' && !!job)} 
                                    />
                                </div>
                            </div>

                            {/* Workflow Prompt (Module System Prompt) */}
                            {selectedModule?.system_prompt && (
                                <div className="glass-panel rounded-2xl p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <h2 className="font-display font-bold text-lg text-[var(--color-ink)]">Workflow Prompt</h2>
                                            <p className="text-sm text-[var(--color-ink-sub)] mt-1">This is the module’s base instruction set. Edit it if you want to change the workflow behavior.</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsEditingModulePrompt(true)}
                                            disabled={!canEditPrompts}
                                            className="rounded-xl"
                                        >
                                            Edit
                                        </Button>
                                    </div>

                                    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-white/70">
                                        <div className="max-h-36 overflow-y-auto custom-scrollbar p-4">
                                            <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--color-ink-sub)]">
                                                {selectedModule.system_prompt}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Images */}
                            <StagingGrid
                                images={displayImages}
                                onRemove={undefined}
                                onEditPrompt={canEditPrompts ? setEditingImageId : undefined}
                                showStatus={isProcessing || isComplete}
                            />
                        </div>
                    )}
                </div>

                {/* FLOATING COMMAND BAR */}
                {displayImages.length > 0 && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-30 animate-slide-up">
                        <div className="glass-panel p-2 rounded-2xl flex items-center justify-between gap-4 pl-4 pr-2">
                            
                            {/* Left: Context */}
                            <div className="flex-1 flex items-center gap-3">
                                <Command className="w-5 h-5 text-[var(--color-ink-sub)]" />
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-[var(--color-ink)] truncate">
                                        {selectedModule?.name || 'Session'}
                                    </div>
                                    <div className="text-xs text-[var(--color-ink-sub)] truncate">
                                        Workflow prompt + per-image prompts (optional)
                                    </div>
                                </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2">
                                {!isProcessing && !isComplete && (
                                    <>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={handleNewSession}
                                            className="text-[var(--color-ink-sub)] hover:text-red-500"
                                        >
                                            <X className="w-5 h-5" />
                                        </Button>
                                        <div className="w-px h-6 bg-[var(--color-border)]" />
                                        <Button 
                                            size="default" 
                                            className="rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-white px-6 font-medium shadow-lg shadow-orange-500/20"
                                            onClick={handleStart}
                                            disabled={!jobId && !activeJobId}
                                        >
                                            Start Processing <Play className="w-4 h-4 ml-2 fill-current" />
                                        </Button>
                                    </>
                                )}

                                {isComplete && (
                                    <>
                                        <Button variant="outline" onClick={handleNewSession} className="rounded-xl">
                                            New Session
                                        </Button>
                                        <Button 
                                            size="default"
                                            className="rounded-xl bg-[var(--color-ink)] text-white shadow-lg"
                                            onClick={handleDownload}
                                        >
                                            Download All <Download className="w-4 h-4 ml-2" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* EDIT MODAL */}
            <PromptEditor
                isOpen={!!editingImageId}
                onClose={() => setEditingImageId(null)}
                prompt={editingImage?.specific_prompt || ''}
                onSave={(prompt) => {
                    if (!editingImageId) return;
                    if (job?.images?.some(img => img.id === editingImageId)) {
                        updateImagePrompt(editingImageId, prompt).catch(console.error);
                    } else {
                        setLocalImages(prev => prev.map(img => img.id === editingImageId ? { ...img, specific_prompt: prompt } : img));
                    }
                    setEditingImageId(null);
                }}
                title="Edit Image Prompt"
            />

            <PromptEditor
                isOpen={isEditingModulePrompt}
                onClose={() => setIsEditingModulePrompt(false)}
                prompt={selectedModule?.system_prompt || ''}
                onSave={(prompt) => {
                    if (!selectedModule) return;
                    updateModulePrompt(selectedModule.id, prompt)
                        .then((updated) => setSelectedModule(updated))
                        .catch(console.error);
                }}
                title="Edit Workflow Prompt"
                placeholder="Define the module’s base instruction set…"
            />
        </div>
    );
}
