import * as React from 'react';
import { Box } from 'lucide-react';
import { DropZone } from '@/components/DropZone';
import { ModuleSelector } from '@/components/ModuleSelector';
import { ModelSelector } from '@/components/ModelSelector';
import { StagingGrid, type StagingImage } from '@/components/StagingGrid';
import { CommandCenter } from '@/components/CommandCenter';
import { PromptEditor, GlobalPromptEditor } from '@/components/PromptEditor';
import { useJobPolling } from '@/hooks/useJobPolling';
import { useSessionRecovery } from '@/hooks/useSessionRecovery';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    getModules,
    createJob,
    uploadImages,
    startJob,
    triggerProcessing,
    getDownloadUrl,
    getModule,
    cancelJob,
    updateJobPrompt,
    updateImagePrompt,
    type Module,
    type ImageRecord,
    type GeminiModel,
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
    const [globalPrompt, setGlobalPrompt] = React.useState('');
    const [localImages, setLocalImages] = React.useState<LocalImage[]>([]);
    const [selectedModel, setSelectedModel] = React.useState<GeminiModel>('nano_banana');
    const [jobId, setJobId] = React.useState<string | null>(null);
    const [isOnline, setIsOnline] = React.useState(navigator.onLine);
    // const [error, setError] = React.useState<string | null>(null); // Removed unused error

    const promptSaveTimeout = React.useRef<number | null>(null);

    // Track generated object URLs for cleanup
    const previewUrls = React.useRef<Set<string>>(new Set());

    // Prompt editor stats
    const [editingImageId, setEditingImageId] = React.useState<string | null>(null);
    const editingImage = localImages.find(img => img.id === editingImageId);

    // Session recovery
    const { activeJobId, hasRecoveredSession, saveSession, clearSession, dismissRecovery } = useSessionRecovery();

    // Job polling
    const { job } = useJobPolling({
        jobId: jobId || activeJobId,
        enabled: appState === 'PROCESSING' || hasRecoveredSession,
        onComplete: (completedJob) => {
            setAppState(completedJob.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED');
        },
    });

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
            } catch (err) {
                // Mock data fallback
                setModules([{ id: 'mock', name: 'Mock Module', description: 'Mock', category: 'general', system_prompt: '', icon: 'box', created_at: 0 }]);
            }
        }
        loadModules();
    }, []);

    // Persist global prompt to backend once a job exists (debounced)
    React.useEffect(() => {
        if (!jobId) return;
        if (promptSaveTimeout.current) {
            window.clearTimeout(promptSaveTimeout.current);
        }
        promptSaveTimeout.current = window.setTimeout(() => {
            updateJobPrompt(jobId, globalPrompt).catch(console.error);
        }, 500);
        return () => {
            if (promptSaveTimeout.current) {
                window.clearTimeout(promptSaveTimeout.current);
            }
        };
    }, [jobId, globalPrompt]);

    React.useEffect(() => {
        if (hasRecoveredSession && job) {
            if (job.status === 'PROCESSING') setAppState('PROCESSING');
            else if (job.status === 'COMPLETED') setAppState('COMPLETED');
            else if (job.status === 'FAILED') setAppState('FAILED');
            setJobId(job.id);
            dismissRecovery();
        }
    }, [hasRecoveredSession, job, dismissRecovery]);

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

    // Handlers
    const handleFilesSelected = async (files: File[]) => {
        const newImages: LocalImage[] = files.map((file) => ({
            id: crypto.randomUUID(),
            localPreview: URL.createObjectURL(file),
            file,
            status: 'PENDING' as const,
            specific_prompt: null,
            original_filename: file.name,
        }));
        setLocalImages((prev) => [...prev, ...newImages]);
        newImages.forEach((img) => previewUrls.current.add(img.localPreview));
        setAppState('READY');
    };

    const handleModuleSelect = async (module: Module) => {
        try {
            const fullModule = await getModule(module.id);
            setSelectedModule(fullModule);
        } catch {
            setSelectedModule(module);
        }
    };

    const handleRemoveImage = (id: string) => {
        setLocalImages((prev) => {
            const img = prev.find((i) => i.id === id);
            if (img?.localPreview) URL.revokeObjectURL(img.localPreview);
            return prev.filter((i) => i.id !== id);
        });
        if (localImages.length <= 1) setAppState('SETUP');
    };

    const handleStart = async () => {
        if (!selectedModule || localImages.length === 0) return;
        // setError(null);
        setAppState('UPLOADING');
        try {
            const newJob = await createJob(selectedModule.id, globalPrompt || undefined, selectedModel);
            setJobId(newJob.id);
            saveSession(newJob.id);
            await uploadImages(newJob.id, localImages.map((img) => img.file));
            await startJob(newJob.id);
            setAppState('PROCESSING');
            triggerProcessing().catch(console.error);
        } catch (err) {
            // setError(err instanceof Error ? err.message : 'Failed start');
            setAppState('READY');
        }
    };

    const handleCancel = async () => {
        if (jobId) await cancelJob(jobId);
        setAppState('FAILED');
    };

    const handleDownload = () => {
        if (jobId) window.open(getDownloadUrl(jobId), '_blank');
    };

    const handleNewBatch = () => {
        previewUrls.current.forEach(url => URL.revokeObjectURL(url));
        previewUrls.current.clear();
        clearSession();
        setJobId(null);
        setLocalImages([]);
        setGlobalPrompt('');
        setAppState('SETUP');
    };

    // Computeds
    const displayImages: StagingImage[] = React.useMemo(() => {
        if (job?.images && job.images.length > 0) {
            return job.images.map(img => ({ ...img, localPreview: undefined }));
        }
        return localImages;
    }, [job?.images, localImages]);

    const isProcessing = appState === 'PROCESSING' || appState === 'UPLOADING';
    const isComplete = appState === 'COMPLETED' || appState === 'FAILED';

    return (
        <div className="min-h-screen pb-36 bg-[var(--color-background)]">
            {/* 1. Header Navigation "Poster Panel" */}
            <header className="sticky top-0 z-40 bg-[var(--color-background)]/90 backdrop-blur-md border-b-2 border-[var(--color-line)]/5">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[var(--color-line)] rounded-xl flex items-center justify-center shadow-lg">
                            <Box className="text-white w-6 h-6" />
                        </div>
                        <span className="font-display font-extrabold text-2xl tracking-tight">
                            LightWork<span className="text-[var(--color-primary)]">.</span>
                        </span>
                    </div>

                    <nav className="hidden md:flex items-center gap-8">
                        {['Product', 'Blog', 'Pricing', 'Faq'].map((item) => (
                            <a key={item} href="#" className="font-body font-bold text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] transition-colors">
                                {item}
                            </a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-4">
                        <Badge variant="neutral" className="hidden md:flex gap-2 h-8">
                            <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-[var(--color-accent)]" : "bg-red-500")} />
                            {isOnline ? "SYSTEM ONLINE" : "OFFLINE"}
                        </Badge>
                        {isComplete && (
                            <Button size="sm" variant="default" className="rounded-full" onClick={handleNewBatch}>
                                NEW BATCH
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-32">

                {/* 2. Hero / Intro Section */}
                {!isComplete && !isProcessing && (
                    <section className="text-center space-y-12 py-12 animate-reveal">
                        <div className="space-y-4">
                            <h1 className="font-display text-6xl md:text-8xl font-extrabold tracking-tighter text-[var(--color-foreground)] leading-[0.85]">
                                BATCH PROCESS <br />
                                <span className="text-[var(--color-primary)]">LIKE A MACHINE.</span>
                            </h1>
                        </div>
                        
                        <div className="flex flex-wrap justify-center items-center gap-4 font-body text-2xl md:text-3xl font-medium text-[var(--color-text-secondary)] max-w-3xl mx-auto">
                            <span>Your</span>
                            <span className="word-pill word-pill-yellow">images.</span>
                            <span>One</span>
                            <span className="word-pill word-pill-orange">batch.</span>
                            <span>Zero</span>
                            <span className="word-pill word-pill-mint">clutter.</span>
                        </div>

                        <p className="font-body text-lg text-[var(--color-text-muted)] max-w-xl mx-auto leading-relaxed">
                            Select a specialised AI module, dump your assets, and let the
                            <span className="font-bold text-[var(--color-foreground)] mx-1">Banana Engine</span>
                            handle the rest.
                        </p>
                    </section>
                )}

                {/* 3. Module Selection Panel */}
                {!isComplete && (
                    <section className="animate-slide-up stagger-reveal" style={{ animationDelay: '0.1s' }}>
                        <div className="flex items-center gap-6 mb-12">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-[var(--color-line)] font-mono font-bold text-lg bg-white shadow-[4px_4px_0px_0px_var(--color-line)]">01</div>
                            <div className="space-y-1">
                                <h2 className="font-display text-3xl font-bold uppercase tracking-tight">Select Module</h2>
                                <div className="dashed-divider w-32" />
                            </div>
                        </div>
                        <ModuleSelector
                            modules={modules}
                            selectedId={selectedModule?.id || null}
                            onSelect={handleModuleSelect}
                            disabled={isProcessing}
                        />
                    </section>
                )}

                {/* 4. Model Selection (Optional) */}
                {!isComplete && localImages.length > 0 && (
                    <section className="animate-slide-up stagger-reveal" style={{ animationDelay: '0.2s' }}>
                        <div className="flex items-center gap-6 mb-12">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-[var(--color-line)] font-mono font-bold text-lg bg-white shadow-[4px_4px_0px_0px_var(--color-line)]">02</div>
                            <div className="space-y-1">
                                <h2 className="font-display text-3xl font-bold uppercase tracking-tight">Model Config</h2>
                                <div className="dashed-divider w-32" />
                            </div>
                        </div>
                        <div className="max-w-md">
                            <ModelSelector
                                value={selectedModel}
                                onChange={setSelectedModel}
                                disabled={isProcessing}
                            />
                        </div>
                    </section>
                )}

                {/* 5. DropZone Workspace */}
                {!isComplete && (
                    <section className="animate-slide-up stagger-reveal" style={{ animationDelay: '0.3s' }}>
                        <div className="flex items-center gap-6 mb-12">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-[var(--color-line)] font-mono font-bold text-lg bg-white shadow-[4px_4px_0px_0px_var(--color-line)]">03</div>
                            <div className="space-y-1">
                                <h2 className="font-display text-3xl font-bold uppercase tracking-tight">Asset Input</h2>
                                <div className="dashed-divider w-32" />
                            </div>
                        </div>
                        <DropZone
                            onFilesSelected={handleFilesSelected}
                            maxFiles={50}
                            currentCount={localImages.length}
                            disabled={isProcessing}
                        />
                    </section>
                )}

                {/* 6. Staging Grid */}
                {displayImages.length > 0 && (
                    <section className="animate-slide-up stagger-reveal" style={{ animationDelay: '0.4s' }}>
                        <div className="flex items-center gap-6 mb-12">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-[var(--color-line)] font-mono font-bold text-lg bg-white shadow-[4px_4px_0px_0px_var(--color-line)]">04</div>
                            <div className="space-y-1">
                                <h2 className="font-display text-3xl font-bold uppercase tracking-tight">Output Preview</h2>
                                <div className="dashed-divider w-32" />
                            </div>
                        </div>
                        <StagingGrid
                            images={displayImages}
                            onRemove={!isProcessing && !isComplete ? handleRemoveImage : undefined}
                            onEditPrompt={!isProcessing && !isComplete ? setEditingImageId : undefined}
                            showStatus={isProcessing || isComplete}
                        />
                    </section>
                )}

                {/* 7. Global Prompt Editor */}
                {!isComplete && localImages.length > 0 && (
                    <section className="animate-slide-up stagger-reveal" style={{ animationDelay: '0.5s' }}>
                        <div className="flex items-center gap-6 mb-12">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-[var(--color-line)] font-mono font-bold text-lg bg-white shadow-[4px_4px_0px_0px_var(--color-line)]">05</div>
                            <div className="space-y-1">
                                <h2 className="font-display text-3xl font-bold uppercase tracking-tight">Final Polish</h2>
                                <div className="dashed-divider w-32" />
                            </div>
                        </div>
                        <GlobalPromptEditor
                            value={globalPrompt}
                            onChange={setGlobalPrompt}
                            modulePromptPreview={selectedModule?.system_prompt}
                        />
                    </section>
                )}
            </main>

            {/* Floating Dock */}
            <CommandCenter
                status={isComplete ? (job?.status || 'COMPLETED') : (localImages.length > 0 ? appState as any : 'PENDING')}
                totalImages={job?.total_images || localImages.length}
                completedImages={job?.completed_images || 0}
                failedImages={job?.failed_images || 0}
                onStart={handleStart}
                onCancel={handleCancel}
                onDownload={handleDownload}
                disabled={!selectedModule || localImages.length === 0}
            />

            {/* Prompt Editor Modal */}
            <PromptEditor
                isOpen={!!editingImageId}
                onClose={() => setEditingImageId(null)}
                prompt={editingImage?.specific_prompt || ''}
                        onSave={(prompt) => {
                            if (!editingImageId) return;

                            setLocalImages(prev => prev.map(img => img.id === editingImageId ? { ...img, specific_prompt: prompt } : img));

                            // Persist per-image prompt if job already created and image exists on backend
                            if (jobId && job?.images?.length) {
                                const remote = job.images.find(img => img.id === editingImageId);
                                if (remote) {
                                    updateImagePrompt(editingImageId, prompt).catch(console.error);
                                }
                            }

                            setEditingImageId(null);
                        }}
                title={`Edit: ${editingImage?.original_filename || 'Image'}`}
            />
        </div>
    );
}
