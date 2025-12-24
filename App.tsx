import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { CommandDock } from './components/CommandDock';
import { ImageCard } from './components/ImageCard';
import { Inspector } from './components/Inspector';
import { Lightbox } from './components/Lightbox';
import { Onboarding } from './components/Onboarding';
import { ModulesManager } from './components/ModulesManager';
import { ToastContainer, ToastMsg } from './components/Toast';
import { Project, ImageJob, ProcessingStatus, DEFAULT_MODULES, Module, AppModel } from './types';
import { UploadCloud, Image as ImageIcon, Command, Key, RefreshCw, Trash2, BoxSelect, Grip, Edit2, Layers, CheckCircle2, Filter, AlertCircle, Clock } from 'lucide-react';
import { processImageWithGemini } from './services/geminiService';
import { generateThumbnail, wait, calculateBackoff } from './utils';
import { api } from './services/api';

const MAX_CONCURRENT_JOBS = 1; // Serial processing to respect Free Tier rate limits

type AppView = 'workspace' | 'modules';
type FilterType = 'all' | 'ready' | 'done' | 'failed';

export default function App() {
    // --- State ---
    const [currentView, setCurrentView] = useState<AppView>('workspace');

    // Modules State
    const [modules, setModules] = useState<Module[]>(DEFAULT_MODULES);

    // Projects State
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState<string>('');

    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [lightboxData, setLightboxData] = useState<{ url: string, original?: string } | null>(null);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [toasts, setToasts] = useState<ToastMsg[]>([]);
    const [gridColumns, setGridColumns] = useState(3);
    const [filter, setFilter] = useState<FilterType>('all');

    const [isHeaderEditing, setIsHeaderEditing] = useState(false);
    const [headerTempName, setHeaderTempName] = useState('');
    const headerInputRef = useRef<HTMLInputElement>(null);

    const lastSelectedId = useRef<string | null>(null);
    const projectsRef = useRef(projects);

    useEffect(() => {
        projectsRef.current = projects;
    }, [projects]);

    // --- Initial Data Fetch ---
    useEffect(() => {
        const init = async () => {
            try {
                const [fetchedProjects, fetchedModules] = await Promise.all([
                    api.getProjects(),
                    api.getModules()
                ]);

                // Merge fetched custom modules with defaults, or replace if logic dictates
                // Here we append custom ones to defaults
                const customModules = fetchedModules.filter(m => m.isCustom);
                setModules([...DEFAULT_MODULES, ...fetchedModules]);

                if (fetchedProjects.length > 0) {
                    setProjects(fetchedProjects);
                    setCurrentProjectId(fetchedProjects[0].id);
                } else {
                    // Create default project
                    const newP = await api.createProject("Session #1");
                    if (newP) {
                        setProjects([newP]);
                        setCurrentProjectId(newP.id);
                    }
                }
            } catch (e) {
                console.error("Initialization failed", e);
                addToast('error', 'Failed to connect to backend');
            }
        };
        init();
    }, []);

    const addToast = (type: ToastMsg['type'], text: string) => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, type, text }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    };

    const currentProject = projects.find(p => p.id === currentProjectId) || projects[0] || {
        id: 'temp',
        name: 'Loading...',
        createdAt: Date.now(),
        jobs: [],
        modulePrompt: '',
        selectedMode: 'fast',
        selectedModulePreset: ''
    };

    const updateCurrentProject = useCallback(async (updates: Partial<Project>) => {
        // Optimistic Update
        setProjects(prev => prev.map(p =>
            p.id === currentProjectId ? { ...p, ...updates } : p
        ));
        // API Update
        await api.updateProject(currentProjectId, updates);
    }, [currentProjectId]);

    const updateJob = useCallback((jobId: string, updates: Partial<ImageJob>) => {
        setProjects(prev => prev.map(p => {
            if (p.id !== currentProjectId) return p;
            return {
                ...p,
                jobs: p.jobs.map(j => j.id === jobId ? { ...j, ...updates } : j)
            };
        }));
    }, [currentProjectId]);

    // --- Logic: Header Renaming ---
    const startHeaderRename = () => {
        setHeaderTempName(currentProject.name);
        setIsHeaderEditing(true);
    };

    const saveHeaderRename = () => {
        if (headerTempName.trim()) {
            updateCurrentProject({ name: headerTempName.trim() });
        }
        setIsHeaderEditing(false);
    };

    // --- Logic: Module Management ---
    const handleCreateModule = async (name: string, prompt: string) => {
        // API Call
        const newModule = await api.createModule(name, prompt);
        if (newModule) {
            setModules(prev => [...prev, newModule]);
            updateCurrentProject({ selectedModulePreset: newModule.id, modulePrompt: prompt });
            addToast('success', 'Module saved');
        } else {
            addToast('error', 'Failed to save module');
        }
    };

    const handleDeleteModule = async (id: string) => {
        // API Call
        await api.deleteModule(id);
        setModules(prev => prev.filter(m => m.id !== id));
        addToast('info', 'Module deleted');
    };

    const deleteProject = async (id: string) => {
        if (projects.length <= 1) return;
        await api.deleteProject(id);
        const newProjects = projects.filter(p => p.id !== id);
        setProjects(newProjects);
        if (currentProjectId === id) setCurrentProjectId(newProjects[0].id);
    };

    const processFiles = async (files: File[]) => {
        if (currentView !== 'workspace') setCurrentView('workspace');

        const newJobs: ImageJob[] = [];

        // Upload logic would go here in real backend scenario
        for (const file of files) {
            // Optimistic UI
            const tempId = crypto.randomUUID();
            const thumb = await generateThumbnail(file);
            const job: ImageJob = {
                id: tempId,
                file: file, // Keep file for thumbnail generation only
                fileName: file.name,
                thumbnailUrl: thumb,
                status: 'uploading',
                localPrompt: '',
                retryCount: 0,
                timestamp: Date.now(),
                originalUrl: URL.createObjectURL(file)
            };
            newJobs.push(job);

            // Background Upload
            api.uploadImage(currentProjectId, file).then(uploadedJob => {
                if (uploadedJob) {
                    updateJob(tempId, {
                        id: uploadedJob.id, // Update to real ID
                        status: 'queued',
                        originalUrl: uploadedJob.originalUrl,
                        thumbnailUrl: uploadedJob.thumbnailUrl // Update to backend URL
                    });
                } else {
                    updateJob(tempId, { status: 'error', errorMsg: 'Upload failed' });
                }
            });
        }

        setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, jobs: [...p.jobs, ...newJobs] } : p));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) processFiles(Array.from(e.target.files));
    };

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = () => setIsDragging(false);
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFiles(Array.from(e.dataTransfer.files));
    };

    const handleJobClick = (id: string, shiftKey: boolean, metaKey: boolean) => {
        const jobs = currentProject.jobs;
        let newSelectedIds = new Set(jobs.filter(j => j.selected).map(j => j.id));

        if (shiftKey && lastSelectedId.current) {
            const startIdx = jobs.findIndex(j => j.id === lastSelectedId.current);
            const endIdx = jobs.findIndex(j => j.id === id);
            if (startIdx !== -1 && endIdx !== -1) {
                const min = Math.min(startIdx, endIdx);
                const max = Math.max(startIdx, endIdx);
                if (!metaKey) newSelectedIds.clear();
                for (let i = min; i <= max; i++) newSelectedIds.add(jobs[i].id);
            }
        } else if (metaKey) {
            if (newSelectedIds.has(id)) newSelectedIds.delete(id);
            else newSelectedIds.add(id);
        } else {
            newSelectedIds.clear();
            newSelectedIds.add(id);
        }

        lastSelectedId.current = id;
        setProjects(prev => prev.map(p =>
            p.id === currentProjectId
                ? { ...p, jobs: p.jobs.map(j => ({ ...j, selected: newSelectedIds.has(j.id) })) }
                : p
        ));
    };

    const toggleSelection = (id: string, shiftKey: boolean) => {
        handleJobClick(id, shiftKey, true);
    };

    const clearSelection = () => {
        setProjects(prev => prev.map(p =>
            p.id === currentProjectId ? { ...p, jobs: p.jobs.map(j => ({ ...j, selected: false })) } : p
        ));
        lastSelectedId.current = null;
    };

    const clearAllJobs = () => {
        if (confirm("Remove all assets from this session?")) {
            setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, jobs: [] } : p));
            // Should call API to delete jobs
        }
    };

    const retryFailed = () => {
        setProjects(prev => prev.map(p =>
            p.id === currentProjectId
                ? {
                    ...p, jobs: p.jobs.map(j => {
                        if (j.status === 'error' || j.status === 'paused') {
                            return { ...j, status: 'queued', errorMsg: undefined, retryCount: 0 };
                        }
                        return j;
                    })
                }
                : p
        ));
    };

    const processQueue = async () => {
        if (!navigator.onLine) { addToast('error', 'You are offline.'); return; }
        if (isProcessing) return;

        const freshProject = projectsRef.current.find(p => p.id === currentProjectId);
        if (!freshProject) return;

        setIsProcessing(true);
        const activeJobIds = new Set<string>();

        const processNext = async (workerId: number) => {
            const freshProject = projectsRef.current.find(p => p.id === currentProjectId);
            if (!freshProject) return;
            const job = freshProject.jobs.find(j => (j.status === 'queued' || j.status === 'retrying') && !activeJobIds.has(j.id));
            if (!job) return;

            activeJobIds.add(job.id);
            updateJob(job.id, { status: 'processing', errorMsg: undefined });

            try {
                // Pass file or URL - compression will always happen client-side
                // This is CRITICAL to avoid hitting Gemini TPM limits with large images
                const imageSource = job.file || job.thumbnailUrl || job.originalUrl;
                const result = await processImageWithGemini(
                    imageSource,
                    freshProject.modulePrompt,
                    job.localPrompt,
                    freshProject.selectedMode === 'fast' ? AppModel.FAST : AppModel.PRO,
                    job.id
                );

                if (result.success && result.imageBytes) {
                    updateJob(job.id, { status: 'completed', resultUrl: `data:image/png;base64,${result.imageBytes}` });
                } else {
                    if (result.isRetryable && job.retryCount < 5) {
                        // Use the exact retry delay from Google's API, or fallback to backoff
                        const delay = result.retryAfterSeconds
                            ? result.retryAfterSeconds * 1000
                            : calculateBackoff(job.retryCount);
                        updateJob(job.id, {
                            status: 'retrying',
                            errorMsg: `Rate limited. Waiting ${Math.round(delay / 1000)}s...`,
                            retryCount: job.retryCount + 1
                        });
                        await wait(delay);
                        updateJob(job.id, { status: 'queued' });
                        activeJobIds.delete(job.id);
                    } else {
                        updateJob(job.id, { status: 'error', errorMsg: result.error });
                    }
                }
            } catch (err) {
                updateJob(job.id, { status: 'error', errorMsg: 'Unexpected error' });
            }

            // Artificial delay to respect RPM limits (Free Tier)
            await wait(2000);
            await processNext(workerId);
        };

        const initialWorkers = [];
        for (let i = 0; i < MAX_CONCURRENT_JOBS; i++) { initialWorkers.push(processNext(i + 1)); }
        await Promise.allSettled(initialWorkers);
        setIsProcessing(false);
        addToast('success', 'Batch complete');
    };

    const filteredJobs = (currentProject.jobs || []).filter(j => {
        if (filter === 'all') return true;
        if (filter === 'ready') return ['queued', 'uploading', 'paused', 'retrying'].includes(j.status);
        if (filter === 'done') return j.status === 'completed';
        if (filter === 'failed') return j.status === 'error';
        return true;
    });

    const stats = {
        all: (currentProject.jobs || []).length,
        ready: (currentProject.jobs || []).filter(j => ['queued', 'uploading', 'paused', 'retrying'].includes(j.status)).length,
        done: (currentProject.jobs || []).filter(j => j.status === 'completed').length,
        failed: (currentProject.jobs || []).filter(j => j.status === 'error').length
    };

    const selectedJobs = (currentProject.jobs || []).filter(j => j.selected);

    if (!projects.length && !toasts.length) return <div className="h-screen flex items-center justify-center bg-[#F2F0E9] text-stone-400">Loading Session...</div>;

    return (
        <div className="flex h-screen overflow-hidden bg-[#F2F0E9] text-stone-900 font-sans selection:bg-clay-500/20" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
            <ToastContainer toasts={toasts} />
            {showOnboarding && <Onboarding onComplete={() => { setShowOnboarding(false); localStorage.setItem('lightwork_onboarded', 'true'); }} />}
            <Lightbox isOpen={!!lightboxData} imageUrl={lightboxData?.url || ''} originalUrl={lightboxData?.original} onClose={() => setLightboxData(null)} />
            {isDragging && <div className="fixed inset-4 border-4 border-dashed border-clay-500/50 rounded-3xl bg-clay-50/20 z-[100] pointer-events-none flex items-center justify-center backdrop-blur-sm"><div className="bg-[#FDFCFB]/90 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4"><UploadCloud className="w-12 h-12 text-clay-600 animate-bounce" /><span className="font-bold text-2xl text-stone-900">Drop Assets to Ingest</span></div></div>}

            <Sidebar
                projects={projects} currentProjectId={currentProjectId}
                onSelectProject={(id) => { setCurrentProjectId(id); setCurrentView('workspace'); clearSelection(); }}
                onCreateProject={async () => { const newP = await api.createProject(`Session #${projects.length + 1}`); if (newP) { setProjects([newP, ...projects]); setCurrentProjectId(newP.id); setCurrentView('workspace'); } }}
                onRenameProject={(id, name) => { setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p)); api.updateProject(id, { name }); }}
                onDeleteProject={deleteProject} currentView={currentView} onChangeView={setCurrentView}
            />

            {currentView === 'modules' ? (
                <ModulesManager modules={modules} onCreate={handleCreateModule} onDelete={handleDeleteModule} onUpdate={() => { }} onBack={() => setCurrentView('workspace')} />
            ) : (
                <div className="flex-1 flex overflow-hidden">
                    <main className="flex-1 relative flex flex-col h-full overflow-hidden transition-all bg-[#F2F0E9]" onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}>
                        {/* Header Height Adjusted to h-16 (64px) with px-6 for better alignment */}
                        <div className="h-16 flex items-center justify-between px-6 border-b border-stone-200/50 bg-[#F2F0E9]/80 backdrop-blur-md z-10 shrink-0">
                            <div className="flex items-center gap-6">
                                {isHeaderEditing ? (
                                    <input ref={headerInputRef} type="text" value={headerTempName} onChange={(e) => setHeaderTempName(e.target.value)} onBlur={saveHeaderRename} onKeyDown={(e) => e.key === 'Enter' && saveHeaderRename()} className="text-xl font-heading font-bold tracking-tight text-stone-900 bg-transparent border-b-2 border-clay-500 focus:outline-none min-w-[240px]" placeholder="Session Name" />
                                ) : (
                                    <div className="flex items-center gap-3 group cursor-pointer" onClick={startHeaderRename} title="Rename"><h1 className="text-xl font-heading font-bold tracking-tight text-stone-900 truncate max-w-[400px]">{currentProject.name}</h1><Edit2 className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500 transition-colors" /></div>
                                )}

                                <div className="h-4 w-px bg-stone-300/50 hidden sm:block" />

                                <div className="flex items-center gap-2 hidden sm:flex">
                                    {['all', 'ready', 'done', 'failed'].map(f => {
                                        if (f === 'failed' && stats.failed === 0) return null;
                                        return (
                                            <button key={f} onClick={() => setFilter(f as FilterType)} className={`flex items-center gap-1 px-2 py-0.5 rounded-full border shadow-sm transition-all ${filter === f ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'}`}>
                                                <span className="text-[9px] font-bold uppercase tracking-wide font-heading">{stats[f as keyof typeof stats]} {f}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {currentProject.jobs && currentProject.jobs.length > 0 && <button onClick={clearAllJobs} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Clear All"><Trash2 className="w-4 h-4" /></button>}
                                {currentProject.jobs && currentProject.jobs.some(j => j.status === 'error' || j.status === 'paused') && <button onClick={retryFailed} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-stone-600 bg-white hover:bg-stone-50 rounded-lg border border-stone-200 shadow-sm"><RefreshCw className="w-3.5 h-3.5" /><span>Retry</span></button>}
                                <label className="group cursor-pointer flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-lg hover:border-clay-400 hover:shadow-md hover:shadow-clay-500/5 active:scale-95 transition-all h-9"><UploadCloud className="w-4 h-4 text-stone-500 group-hover:text-clay-600" /><span className="text-xs font-bold uppercase tracking-wide text-stone-700 font-heading">Add Assets</span><input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} /></label>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 pb-40 scroll-smooth" onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}>
                            {(currentProject.jobs || []).length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center">
                                    {/* Empty State */}
                                    <div className="w-full max-w-lg border border-dashed border-stone-300 rounded-2xl p-16 flex flex-col items-center justify-center bg-[#FDFCFB]">
                                        <ImageIcon className="w-12 h-12 text-stone-200 mb-6" />
                                        <h3 className="text-2xl font-heading font-bold text-stone-900 mb-3 tracking-tight">Your Workspace is Empty</h3>
                                        <p className="text-stone-500 text-center text-sm font-sans">Drag & drop images to begin refinement.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid gap-8 pb-24" style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}>
                                    {filteredJobs.map(job => (
                                        <ImageCard
                                            key={job.id}
                                            job={job}
                                            isSelected={!!job.selected}
                                            isActive={!!job.selected}
                                            onToggleSelect={toggleSelection}
                                            onClick={(id) => handleJobClick(id, false, false)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <CommandDock
                            project={currentProject}
                            modules={modules}
                            isProcessing={isProcessing}
                            queuedCount={(currentProject.jobs || []).filter(j => j.status === 'queued' || j.status === 'error' || j.status === 'paused').length}
                            onUpdateProject={updateCurrentProject}
                            onProcess={processQueue}
                            onCreateModule={handleCreateModule}
                            onDeleteModule={handleDeleteModule}
                            onManageModules={() => setCurrentView('modules')}
                        />
                    </main>

                    {selectedJobs.length > 0 && (
                        <Inspector
                            selectedJobs={selectedJobs}
                            onClose={clearSelection}
                            onUpdateJob={updateJob}
                            onRemove={(ids) => {
                                setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, jobs: p.jobs.filter(j => !ids.includes(j.id)) } : p));
                                clearSelection();
                            }}
                            onRetry={(ids) => {
                                setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, jobs: p.jobs.map(j => ids.includes(j.id) ? { ...j, status: 'queued', errorMsg: undefined, retryCount: 0 } : j) } : p));
                            }}
                            onZoom={(url) => setLightboxData({ url, original: selectedJobs.length === 1 ? selectedJobs[0].originalUrl : undefined })}
                        />
                    )}
                </div>
            )}
        </div>
    );
}