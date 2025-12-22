import * as React from 'react';
import {
    Play,
    Download,
    X,
    Command,
    Clock,
    Loader2,
    Trash2,
    RotateCcw,
} from 'lucide-react';
import { DropZone } from '@/components/DropZone';
import { ModuleSelector } from '@/components/ModuleSelector';
import { ModelSelector } from '@/components/ModelSelector';
import { StagingGrid, type StagingImage } from '@/components/StagingGrid';
import { PromptEditor } from '@/components/PromptEditor';
import { Lightbox } from '@/components/Lightbox';
import { ProjectArchive } from '@/components/ProjectArchive';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { UploadQueue } from '@/components/UploadQueue';
import { useJobPolling } from '@/hooks/useJobPolling';
import { useSessionRecovery } from '@/hooks/useSessionRecovery';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle,
    SheetTrigger
} from '@/components/ui/sheet';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';

import { getModuleIcon } from '@/lib/icons';
import {
    getModules,
    getJobs,
    createJob,
    uploadImages,
    startJob,
    triggerProcessing,
    getDownloadUrl,
    getImageUrl,
    getModule,
    deleteImage,
    updateImagePrompt,
    updateJobModel,
    updateModulePrompt,
    cleanupJobs,
    retryJob,
    type Module,
    type ImageRecord,
    type GeminiModel,
    type JobWithModule,
} from '@/lib/api';
// Worker import
import ImageProcessorWorker from '@/workers/imageProcessor?worker';
import type { ImageProcessResult, ImageProcessRequest } from '@/workers/imageProcessor';

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
    // Session recovery
    const {
        activeJobId,
        recoveredModuleId,
        recoveredModel,
        hasRecoveredSession,
        saveSession,
        clearSession,
        dismissRecovery
    } = useSessionRecovery();

    // State
    const [appState, setAppState] = React.useState<AppState>('SETUP');
    const [modules, setModules] = React.useState<Module[]>([]);
    const [selectedModule, setSelectedModule] = React.useState<Module | null>(null);
    const [localImages, setLocalImages] = React.useState<LocalImage[]>([]);
    const [selectedModel, setSelectedModel] = React.useState<GeminiModel>(recoveredModel as GeminiModel || 'nano_banana');
    const [jobId, setJobId] = React.useState<string | null>(null);
    const [isOnline, setIsOnline] = React.useState(navigator.onLine);
    const [processingProgress, setProcessingProgress] = React.useState<string>('');
    const [uploadStats, setUploadStats] = React.useState({ current: 0, total: 0 });

    const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
    const [confirmOptions, setConfirmOptions] = React.useState<{
        title: string;
        description: string;
        variant?: 'default' | 'destructive';
        confirmLabel?: string;
        onConfirm: () => void;
    }>({
        title: '',
        description: '',
        onConfirm: () => { },
    });

    const [projects, setProjects] = React.useState<JobWithModule[]>([]);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [hasMoreProjects, setHasMoreProjects] = React.useState(true);
    const [isLoadingProjects, setIsLoadingProjects] = React.useState(false);
    const PROJECTS_PAGE_SIZE = 20;
    const observerTarget = React.useRef<HTMLDivElement>(null);

    const [previewMap, setPreviewMap] = React.useState<Record<string, string>>({});
    const [isEditingModulePrompt, setIsEditingModulePrompt] = React.useState(false);
    const previewUrls = React.useRef<Set<string>>(new Set());

    // Prompt editor stats
    const [editingImageId, setEditingImageId] = React.useState<string | null>(null);
    const [lightboxId, setLightboxId] = React.useState<string | null>(null);

    // Job polling
    const { job, connectionStatus, refetch } = useJobPolling({
        jobId: jobId || activeJobId,
        enabled: !!(jobId || activeJobId),
        onComplete: (completedJob) => {
            setAppState(completedJob.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED');
        },
    });

    const jobImages = job?.images;
    const displayImages: StagingImage[] = React.useMemo(() => {
        if (jobImages && jobImages.length > 0) {
            return jobImages.map(img => ({ ...img, localPreview: previewMap[img.id] }));
        }
        return localImages;
    }, [jobImages, localImages, previewMap]);

    const editingImage = React.useMemo(() => {
        if (!editingImageId) return undefined;
        return job?.images?.find(img => img.id === editingImageId)
            ?? localImages.find(img => img.id === editingImageId);
    }, [editingImageId, job?.images, localImages]);

    // Derived State
    const isProcessing = appState === 'PROCESSING' || appState === 'UPLOADING';
    const isComplete = appState === 'COMPLETED' || appState === 'FAILED';
    const canEditPrompts = !isProcessing && !isComplete;

    // Load projects (job history)
    const loadProjects = React.useCallback(async (reset = false) => {
        if (isLoadingProjects || (!hasMoreProjects && !reset)) return;

        setIsLoadingProjects(true);
        try {
            const offset = reset ? 0 : projects.length;
            const data = await getJobs(PROJECTS_PAGE_SIZE, offset, searchQuery);

            if (reset) {
                setProjects(data);
            } else {
                setProjects(prev => [...prev, ...data]);
            }

            setHasMoreProjects(data.length === PROJECTS_PAGE_SIZE);
        } catch {
            if (reset) setProjects([]);
        } finally {
            setIsLoadingProjects(false);
        }
    }, [isLoadingProjects, hasMoreProjects, projects.length, searchQuery]);

    // Debounced search effect
    React.useEffect(() => {
        const timer = setTimeout(() => {
            loadProjects(true);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Intersection Observer for infinite scroll
    React.useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMoreProjects && !isLoadingProjects) {
                    loadProjects();
                }
            },
            { threshold: 1.0 }
        );

        const currentTarget = observerTarget.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [hasMoreProjects, isLoadingProjects, loadProjects]);

    // Refresh first page when job changes status (keeps sidebar history current)
    React.useEffect(() => {
        if (!job) return;
        // Just refresh the first page to see the latest job status
        getJobs(PROJECTS_PAGE_SIZE, 0).then(data => {
            setProjects(prev => {
                const next = [...prev];
                data.forEach(updatedJob => {
                    const idx = next.findIndex(p => p.id === updatedJob.id);
                    if (idx !== -1) {
                        next[idx] = updatedJob;
                    } else if (next.length < PROJECTS_PAGE_SIZE) {
                        // New job appeared? 
                        next.unshift(updatedJob);
                    }
                });
                return next;
            });
        }).catch(() => undefined);
    }, [job]);

    // Load modules
    React.useEffect(() => {
        async function loadModules() {
            try {
                const data = await getModules();
                setModules(data);

                // If we don't have a module selected, pick one (prioritize recovered ID)
                if (!selectedModule) {
                    const targetId = recoveredModuleId || (data.length > 0 ? data[0].id : null);
                    if (targetId) {
                        const fullModule = await getModule(targetId);
                        setSelectedModule(fullModule);
                    }
                }
            } catch {
                if (modules.length === 0) {
                    setModules([{ id: 'mock', name: 'Mock Module', description: 'Mock', category: 'general', system_prompt: '', icon: 'box', created_at: 0 }]);
                }
            }
        }
        loadModules();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recoveredModuleId]);

    // Auto-save session state
    React.useEffect(() => {
        // Only save if we have at least a module selected
        if (selectedModule) {
            saveSession(jobId || activeJobId, selectedModule.id, selectedModel);
        }
    }, [jobId, activeJobId, selectedModule, selectedModel, saveSession]);

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

    // Warn before leaving during active operations
    React.useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isProcessing) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isProcessing]);

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

    // Handle session recovery
    const handleResumeSession = () => {
        if (activeJobId) {
            setJobId(activeJobId);
        }
        dismissRecovery();
    };

    const handleDiscardSession = () => {
        clearSession();
    };

    // Helper: Process images in worker
    const processFiles = async (files: File[]): Promise<{ items: { file: File, thumbnail: Blob }[], thumbnails: { name: string, url: string }[] }> => {
        return new Promise((resolve) => {
            const worker = new ImageProcessorWorker();
            const results: { file: File, thumbnailBlob: Blob, thumbnailUrl: string, index: number }[] = [];
            let processedCount = 0;

            worker.onmessage = (e) => {
                const { success, data, error } = e.data;

                if (success) {
                    const result = data as ImageProcessResult;

                    // Create new File from processed blob
                    const processedFile = new File(
                        [result.blob],
                        result.originalName,
                        { type: 'image/jpeg', lastModified: Date.now() }
                    );

                    // Create thumbnail URL for immediate preview
                    const thumbnailUrl = URL.createObjectURL(result.thumbnail);
                    previewUrls.current.add(thumbnailUrl);

                    results.push({
                        file: processedFile,
                        thumbnailBlob: result.thumbnail,
                        thumbnailUrl: thumbnailUrl,
                        index: files.findIndex(f => f.name === result.originalName) // naive correlation
                    });

                    processedCount++;
                    setProcessingProgress(`Optimizing ${processedCount}/${files.length}...`);

                    if (processedCount === files.length) {
                        worker.terminate();
                        // Sort by original index to maintain order
                        results.sort((a, b) => a.index - b.index);
                        resolve({
                            items: results.map(r => ({ file: r.file, thumbnail: r.thumbnailBlob })),
                            thumbnails: results.map(r => ({ name: r.file.name, url: r.thumbnailUrl }))
                        });
                    }
                } else {
                    console.error('Worker error:', error);
                    // Fallback to original file on error
                    processedCount++;
                    setUploadStats(prev => ({ ...prev, current: processedCount }));

                    if (processedCount === files.length) {
                        worker.terminate();
                        resolve({
                            items: files.map(f => ({ file: f, thumbnail: f })),
                            thumbnails: files.map(f => ({ name: f.name, url: URL.createObjectURL(f) }))
                        });
                    }
                }
            };

            files.forEach((file, index) => {
                worker.postMessage({
                    id: `req-${index}`,
                    file,
                    maxDimension: 1920,
                    quality: 0.7
                } as ImageProcessRequest);
            });
        });
    };

    // Handlers
    const handleFilesSelected = async (files: File[]) => {
        if (!selectedModule) return;
        if (isProcessing || isComplete) return;

        setAppState('UPLOADING');
        setProcessingProgress('Initializing...');
        setUploadStats({ current: 0, total: files.length });

        try {
            let id = jobId;
            if (!id) {
                const newJob = await createJob(selectedModule.id, undefined, selectedModel);
                id = newJob.id;
                setJobId(newJob.id);
            }

            // Client-side Processing (Worker)
            setProcessingProgress('Optimizing images...');
            const { items, thumbnails } = await processFiles(files);
            setProcessingProgress('Uploading...');

            const result = await uploadImages(id!, items);

            // Attach previews to returned image IDs (best-effort, by order)
            setPreviewMap((prev) => {
                const next = { ...prev };
                result.images.forEach((img, idx) => {
                    const match = thumbnails[idx];
                    if (match) next[img.id] = match.url;
                });
                return next;
            });

            // Job now exists and images are staged remotely
            setLocalImages([]);
            setAppState('READY');
            setProcessingProgress('');
            refetch();
        } catch (error) {
            console.error('Upload failed:', error);
            setAppState('READY');
            setProcessingProgress('');
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

    const handleRetry = async () => {
        const id = jobId || activeJobId;
        if (!id) return;

        setAppState('PROCESSING');
        try {
            await retryJob(id);
            triggerProcessing().catch(console.error);
            refetch();
        } catch {
            setAppState('FAILED');
        }
    };

    const handleDownload = () => {
        const id = jobId || activeJobId;
        if (id) window.open(getDownloadUrl(id), '_blank');
    };

    const handleRemoveImage = async (imageId: string) => {
        try {
            await deleteImage(imageId);
            refetch();
        } catch (error) {
            console.error('Failed to remove image:', error);
        }
    };

    const handleRemoveMultipleImages = async (imageIds: string[]) => {
        try {
            await Promise.all(imageIds.map(id => deleteImage(id)));
            refetch();
        } catch (error) {
            console.error('Failed to remove images:', error);
        }
    };

    const handleClearAllImages = async () => {
        if (!displayImages.length) return;
        try {
            await Promise.all(displayImages.map(img => deleteImage(img.id)));
            refetch();
        } catch (error) {
            console.error('Failed to clear images:', error);
        }
    };

    const handleFeedback = async (imageId: string, rating: 1 | -1) => {
        try {
            await submitFeedback(imageId, rating);
            // Optimistically update if needed or just wait for polling.
            // Since we don't have local ratings state easily accessible for job images,
            // we can just refetch.
            refetch();
        } catch (error) {
            console.error('Failed to submit feedback:', error);
        }
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

    const handleCleanup = () => {
        setConfirmOptions({
            title: 'Prune History',
            description: 'This will delete all projects older than 24 hours. This action cannot be undone.',
            variant: 'destructive',
            confirmLabel: 'Prune All',
            onConfirm: async () => {
                try {
                    await cleanupJobs();
                    loadProjects(true);
                } catch (error) {
                    console.error('Cleanup failed:', error);
                }
            }
        });
        setShowConfirmDialog(true);
    };

    const handleProjectDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmOptions({
            title: 'Delete Project',
            description: 'Are you sure you want to delete this project? All associated images will be permanently removed.',
            variant: 'destructive',
            confirmLabel: 'Delete',
            onConfirm: async () => {
                try {
                    await deleteJob(id);
                    if (jobId === id) {
                        handleNewSession();
                    }
                    loadProjects(true);
                } catch (error) {
                    console.error('Delete failed:', error);
                }
            }
        });
        setShowConfirmDialog(true);
    };

    return (
        <div className="flex h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] overflow-hidden selection:bg-[var(--color-accent)] selection:text-white">
            {/* Desktop Sidebar: Project Archive */}
            <aside className="hidden xl:flex w-80 border-r border-[var(--color-border)] bg-white flex-col relative z-20 shadow-2xl">
                <ProjectArchive
                    projects={projects}
                    activeJobId={jobId || activeJobId}
                    isOnline={isOnline}
                    connectionStatus={connectionStatus}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onProjectSelect={handleProjectSelect}
                    onNewProject={handleNewSession}
                    onCleanup={handleCleanup}
                    onProjectDelete={handleProjectDelete}
                    isLoadingProjects={isLoadingProjects}
                    hasMoreProjects={hasMoreProjects}
                    observerTarget={observerTarget}
                    isProcessing={isProcessing}
                />
            </aside>

            {/* MAIN STAGE */}
            <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden">

                {/* TOP BAR */}
                <header className="h-20 border-b border-[var(--color-border)] bg-white/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-10 sticky top-0 z-10">
                    <div className="flex items-center gap-4 md:gap-6">
                        {/* Mobile Archive Trigger */}
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="xl:hidden h-11 w-11 rounded-xl hover:bg-[var(--color-canvas)]">
                                    <Menu className="w-6 h-6" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-80 border-r border-[var(--color-border)]">
                                <ProjectArchive
                                    projects={projects}
                                    activeJobId={jobId || activeJobId}
                                    isOnline={isOnline}
                                    connectionStatus={connectionStatus}
                                    searchQuery={searchQuery}
                                    onSearchChange={setSearchQuery}
                                    onProjectSelect={handleProjectSelect}
                                    onNewProject={handleNewSession}
                                    onCleanup={handleCleanup}
                                    onProjectDelete={handleProjectDelete}
                                    isLoadingProjects={isLoadingProjects}
                                    hasMoreProjects={hasMoreProjects}
                                    observerTarget={observerTarget}
                                    isProcessing={isProcessing}
                                />
                            </SheetContent>
                        </Sheet>

                        <div className="flex flex-col">
                            <h2 className="font-display font-black text-2xl tracking-tight">
                                {selectedModule?.name || 'Select Module'}
                            </h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono font-bold text-[var(--color-accent)] uppercase tracking-widest">
                                    {jobId ? `BATCH #${jobId.slice(0, 8)}` : 'NEW SESSION'}
                                </span>
                                {(isProcessing || processingProgress) && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-3 h-3 animate-spin text-[var(--color-accent)]" />
                                            <span className="text-[10px] font-mono text-[var(--color-ink-sub)] font-bold uppercase">
                                                {processingProgress || 'Processing...'}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <ModelSelector
                            value={selectedModel}
                            onChange={setSelectedModel}
                            disabled={isProcessing || isComplete || (job?.status !== 'PENDING' && !!job)}
                        />

                        {isComplete && (
                            <Button
                                onClick={handleDownload}
                                className="h-11 px-6 rounded-2xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-display font-bold shadow-lg shadow-[var(--color-accent)]/20"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export All
                            </Button>
                        )}
                    </div>
                </header>

                {/* CANVAS CONTENT */}
                <div className="flex-1 overflow-y-auto p-10 pb-32 custom-scrollbar bg-[var(--color-canvas)]">

                    {/* Empty State / Drop Target */}
                    {localImages.length === 0 && !job && (
                        <div className="h-full flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="w-full max-w-3xl space-y-12">
                                <section>
                                    <div className="flex items-baseline gap-4 mb-8">
                                        <h3 className="font-display font-extrabold text-3xl tracking-tight">Choose Intelligence</h3>
                                        <p className="text-[var(--color-ink-sub)] font-medium">Select a specialized module for your task.</p>
                                    </div>
                                    <ModuleSelector
                                        modules={modules}
                                        selectedId={selectedModule?.id || null}
                                        onSelect={handleModuleSelect}
                                        disabled={isProcessing || isComplete || displayImages.length > 0 || !!(jobId || activeJobId)}
                                    />
                                </section>

                                {selectedModule && (
                                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                                        <div className="flex items-baseline gap-4 mb-8">
                                            <h3 className="font-display font-extrabold text-3xl tracking-tight">Ingest Assets</h3>
                                            <p className="text-[var(--color-ink-sub)] font-medium">Drop images to begin processing.</p>
                                        </div>
                                        <div className="glass-panel p-2 rounded-[32px] shadow-2xl shadow-black/5">
                                            <DropZone
                                                onFilesSelected={handleFilesSelected}
                                                maxFiles={50}
                                                currentCount={localImages.length}
                                                disabled={isProcessing}
                                                className="h-96 rounded-[28px] border-2 border-dashed border-[var(--color-border-hover)] hover:border-[var(--color-accent)] transition-colors"
                                            />
                                        </div>
                                    </section>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Staging Grid (Active) */}
                    {(displayImages.length > 0 || job) && (
                        <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500">

                            {/* Workflow Prompt (Module System Prompt) */}
                            {selectedModule?.system_prompt && (
                                <div className="hidden xl:block glass-panel noise-overlay rounded-[32px] p-8 shadow-2xl shadow-black/5 border border-white/50">
                                    <div className="flex items-start justify-between gap-4 mb-6">
                                        <div className="min-w-0">
                                            <h2 className="font-display font-extrabold text-2xl text-[var(--color-ink)] tracking-tight">Workflow Logic</h2>
                                            <p className="text-sm text-[var(--color-ink-sub)] mt-1 font-medium">The core instructions guiding this module's intelligence.</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsEditingModulePrompt(true)}
                                            disabled={!canEditPrompts}
                                            className="rounded-2xl h-11 px-6 font-bold border-[var(--color-border)] hover:bg-white"
                                        >
                                            Refine Logic
                                        </Button>
                                    </div>

                                    <div className="rounded-2xl border border-[var(--color-border)] bg-white/50 backdrop-blur-sm overflow-hidden">
                                        <div className="max-h-48 overflow-y-auto custom-scrollbar p-6">
                                            <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--color-ink-sub)] leading-relaxed">
                                                {selectedModule.system_prompt}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Images */}
                            <StagingGrid
                                images={displayImages}
                                onRemove={handleRemoveImage}
                                onRemoveMultiple={handleRemoveMultipleImages}
                                onClearAll={handleClearAllImages}
                                onEditPrompt={canEditPrompts ? setEditingImageId : undefined}
                                onBulkEditPrompt={canEditPrompts ? handleBulkEditPrompt : undefined}
                                onView={setLightboxId}
                                onFeedback={handleFeedback}
                                showStatus={isProcessing || isComplete}
                                disabled={isProcessing}
                            />
                        </div>
                    )}
                </div>

                {/* FLOATING COMMAND BAR */}
                {displayImages.length > 0 && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-6 z-30 animate-in slide-in-from-bottom-8 duration-700">
                        <div className="glass-panel noise-overlay p-4 rounded-[28px] shadow-2xl border border-white/50 flex items-center justify-between gap-4">

                            {/* Left: Context */}
                            <div className="flex-1 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-[var(--color-canvas)] flex items-center justify-center border border-[var(--color-border)]">
                                    {selectedModule ? (
                                        (() => {
                                            const Icon = getModuleIcon(selectedModule.icon);
                                            return <Icon className="w-6 h-6 text-[var(--color-accent)]" />;
                                        })()
                                    ) : (
                                        <Command className="w-6 h-6 text-[var(--color-ink-sub)]" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-mono font-bold text-[var(--color-accent)] uppercase tracking-widest leading-none mb-1">Active Module</p>
                                    <h4 className="font-display font-bold text-sm truncate">
                                        {selectedModule?.name || 'Session'}
                                    </h4>
                                </div>
                            </div>

                            <div className="h-10 w-px bg-[var(--color-border)]" />

                            {/* Right: Actions */}
                            <div className="flex items-center gap-3">
                                {!isProcessing && !isComplete && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleNewSession}
                                            className="w-12 h-12 rounded-2xl hover:bg-white text-[var(--color-ink-sub)] hover:text-red-500 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </Button>
                                        <Button
                                            className="h-12 px-8 rounded-2xl bg-[var(--color-ink)] hover:bg-[var(--color-accent)] text-white font-display font-bold shadow-xl shadow-black/10 group transition-all hover:scale-105 active:scale-95"
                                            onClick={handleStart}
                                            disabled={!jobId && !activeJobId}
                                        >
                                            Initialize <Play className="w-4 h-4 ml-2 fill-current group-hover:scale-110 transition-transform" />
                                        </Button>
                                    </>
                                )}

                                {isComplete && (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={handleNewSession}
                                            className="h-12 px-6 rounded-2xl font-bold border-[var(--color-border)] hover:bg-white"
                                        >
                                            New Session
                                        </Button>
                                        {appState === 'FAILED' && (
                                            <Button
                                                variant="outline"
                                                onClick={handleRetry}
                                                className="h-12 px-6 rounded-2xl font-bold border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                            >
                                                <RotateCcw className="w-4 h-4 mr-2" />
                                                Retry Failed
                                            </Button>
                                        )}
                                        <Button
                                            className="h-12 px-8 rounded-2xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-display font-bold shadow-lg shadow-[var(--color-accent)]/20"
                                            onClick={handleDownload}
                                        >
                                            Export All <Download className="w-4 h-4 ml-2" />
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
                title="Refine Asset Prompt"
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
                title="Refine Workflow Logic"
                placeholder="Define the module’s base instruction set…"
            />

            {/* Session Recovery Dialog */}
            <Dialog open={hasRecoveredSession} onOpenChange={(open) => !open && dismissRecovery()}>
                <DialogContent className="sm:max-w-[425px] rounded-[32px] border-[var(--color-border)] bg-white/90 backdrop-blur-2xl shadow-2xl">
                    <DialogHeader>
                        <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                            <Clock className="w-6 h-6 text-[var(--color-accent)]" />
                        </div>
                        <DialogTitle className="font-display font-black text-2xl tracking-tight">Resume Session?</DialogTitle>
                        <DialogDescription className="text-[var(--color-ink-sub)] font-medium leading-relaxed">
                            We found an active session from your last visit. Would you like to continue where you left off?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-3 mt-6">
                        <Button
                            variant="outline"
                            onClick={handleDiscardSession}
                            className="flex-1 h-12 rounded-2xl border-[var(--color-border)] hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all font-bold"
                        >
                            Discard
                        </Button>
                        <Button
                            onClick={handleResumeSession}
                            className="flex-1 h-12 rounded-2xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-lg shadow-[var(--color-accent)]/20 font-bold"
                        >
                            Resume
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Lightbox */}
            {lightboxId && (() => {
                const imgIndex = displayImages.findIndex(img => img.id === lightboxId);
                const img = displayImages[imgIndex];
                if (!img) return null;

                const hasPrev = imgIndex > 0;
                const hasNext = imgIndex < displayImages.length - 1;

                const url = img.localPreview
                    ? img.localPreview
                    : img.status === 'COMPLETED'
                        ? getImageUrl(img.id, 'processed')
                        : getImageUrl(img.id, 'original');

                return (
                    <Lightbox
                        isOpen={!!lightboxId}
                        onClose={() => setLightboxId(null)}
                        imageSrc={url}
                        altText={img.original_filename || 'Preview'}
                        hasPrev={hasPrev}
                        hasNext={hasNext}
                        onPrev={() => hasPrev && setLightboxId(displayImages[imgIndex - 1].id)}
                        onNext={() => hasNext && setLightboxId(displayImages[imgIndex + 1].id)}
                    />
                );
            })()}

            {/* Upload Queue Overlay */}
            {appState === 'UPLOADING' && uploadStats.total > 0 && (
                <UploadQueue
                    current={uploadStats.current}
                    total={uploadStats.total}
                    stage={processingProgress === 'Uploading...' ? 'uploading' : 'optimizing'}
                />
            )}

            <ConfirmDialog
                open={showConfirmDialog}
                onOpenChange={setShowConfirmDialog}
                {...confirmOptions}
            />
        </div>
    );
}
