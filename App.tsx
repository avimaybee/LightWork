import React, { useState, useCallback, useEffect, useRef, Suspense, useMemo } from 'react';
import { Sidebar, MobileMenuTrigger } from './components/Sidebar';
import { SidebarProvider } from './hooks/useSidebar';
import { CommandDock } from './components/CommandDock';
import { ImageCard } from './components/ImageCard';
import { ToastContainer, ToastMsg } from './components/Toast';
import { toast } from 'sonner';
import { LandingPage, AuthModal } from './components/LandingPage';
import { useConfirmDialog } from './components/ConfirmDialog';
import { EmptyState } from './components/EmptyState';
import { AuthProvider, useAuth } from './services/authContext';
import { Project, ImageJob, ProcessingStatus, DEFAULT_MODULES, Module, AppModel, ApiMode } from './types';

import { UploadCloud, Image as ImageIcon, Command, Key, RefreshCw, Trash2, BoxSelect, Grip, Edit2, Layers, CheckCircle2, Filter, AlertCircle, Clock, Loader2, FileText, LayoutGrid, Columns, Search, X, Sparkles } from 'lucide-react';
import { processImageWithGemini, generateSmartFilename } from './services/geminiService';
import { generateThumbnail, wait, calculateBackoff } from './utils';
import { useSettings } from './hooks/useSettings';
import { api } from './services/api';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const LazyInspector = React.lazy(() => import('./components/Inspector').then(m => ({ default: m.Inspector })));
const LazyLightbox = React.lazy(() => import('./components/Lightbox').then(m => ({ default: m.Lightbox })));
const LazyOnboarding = React.lazy(() => import('./components/Onboarding').then(m => ({ default: m.Onboarding })));
const LazyModulesManager = React.lazy(() => import('./components/ModulesManager').then(m => ({ default: m.ModulesManager })));
const LazyBatchStatusPanel = React.lazy(() => import('./components/BatchStatusPanel').then(m => ({ default: m.BatchStatusPanel })));
const LazyBackToTop = React.lazy(() => import('./components/BackToTop').then(m => ({ default: m.BackToTop })));
const LazyReportModal = React.lazy(() => import('./components/ReportModal').then(m => ({ default: m.ReportModal })));

const LazySettingsPage = React.lazy(() => import('./components/SettingsPage').then(m => ({ default: m.SettingsPage })));
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useHistory } from './hooks/useHistory';
import { UndoRedoToolbar } from './components/UndoRedoToolbar';

// Tier 1 Optimized Settings
// With paid Tier 1 limits (500 RPM, 500K TPM), we can process much faster
const MAX_CONCURRENT_JOBS = 5;  // Process 5 images in parallel
const MIN_GEMINI_REQUEST_SPACING_MS = 500; // 500ms between requests (~120 RPM safe rate)
const PARALLEL_BATCH_SIZE = 10; // Send up to 10 images per parallel API call

type AppView = 'workspace' | 'modules' | 'settings';
type FilterType = 'all' | 'ready' | 'done' | 'failed';

// Sortable wrapper for ImageCard (drag-to-reorder)
interface SortableImageCardProps {
    job: ImageJob;
    isSelected: boolean;
    isActive: boolean;
    onToggleSelect: (id: string, shiftKey: boolean) => void;
    onClick: (id: string, e: React.MouseEvent) => void;
    isSearchMatch: boolean;
}

const SortableImageCard: React.FC<SortableImageCardProps> = ({ job, isSelected, isActive, onToggleSelect, onClick, isSearchMatch }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : undefined,
        opacity: isDragging ? 0.8 : isSearchMatch ? 1 : 0.3,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <ImageCard
                job={job}
                isSelected={isSelected}
                isActive={isActive}
                onToggleSelect={onToggleSelect}
                onClick={onClick}
            />
        </div>
    );
};

// Main App Content (protected by auth)
function AppContent() {
    // --- State ---
    const [currentView, setCurrentView] = useState<AppView>('workspace');

    // Confirmation Dialog Hook
    const { confirm, ConfirmDialogComponent } = useConfirmDialog();

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
    const [gridColumns, setGridColumns] = useState(4);
    const [userAdjustedGrid, setUserAdjustedGrid] = useState(false); // Track if user manually adjusted
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false); // Mobile search state
    const [filter, setFilter] = useState<FilterType>('all');
    const [apiMode, setApiMode] = useState<ApiMode>('fast');
    const { settings } = useSettings();

    // AI Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<string[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Interactions #7: Infinite Scroll (client-side pagination)
    const [visibleCount, setVisibleCount] = useState(36);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    const [isHeaderEditing, setIsHeaderEditing] = useState(false);
    const [headerTempName, setHeaderTempName] = useState('');
    const headerInputRef = useRef<HTMLInputElement>(null);

    const [showReportModal, setShowReportModal] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const lastSelectedId = useRef<string | null>(null);
    const projectsRef = useRef(projects);
    const nextGeminiAllowedAtRef = useRef<number>(0);
    const uploadProgressTimersRef = useRef<Record<string, number>>({});
    const uploadProgressValueRef = useRef<Record<string, number>>({});

    const didAutoNameProjectRef = useRef<Record<string, true>>({});
    const gridContainerRef = useRef<HTMLDivElement>(null);
    const newImageIdsRef = useRef<string[]>([]);

    // Refs for handlers used in keyboard shortcuts (to avoid temporal dead zone)
    const handleProcessBatchRef = useRef<() => void>(() => { });
    const processQueueRef = useRef<() => void>(() => { });

    // Undo/Redo History for projects state
    const projectsHistoryRef = useRef<Project[][]>([]);
    const projectsFutureRef = useRef<Project[][]>([]);
    const lastProjectsSnapshotTimeRef = useRef<number>(0);

    // Reactive state for UI (force re-render when history changes)
    const [canUndoState, setCanUndoState] = useState(false);
    const [canRedoState, setCanRedoState] = useState(false);
    const [historyLengthState, setHistoryLengthState] = useState(0);

    const pushProjectsHistory = useCallback(() => {
        const now = Date.now();
        // Debounce: only push if more than 500ms since last snapshot
        if (now - lastProjectsSnapshotTimeRef.current > 500) {
            projectsHistoryRef.current = [...projectsHistoryRef.current.slice(-49), projectsRef.current];
            projectsFutureRef.current = []; // Clear future on new action
            lastProjectsSnapshotTimeRef.current = now;
            // Update reactive state
            setCanUndoState(true);
            setCanRedoState(false);
            setHistoryLengthState(projectsHistoryRef.current.length);
        }
    }, []);

    const undoProjects = useCallback(() => {
        if (projectsHistoryRef.current.length === 0) {
            toast.info('Nothing to undo');
            return;
        }
        const previous = projectsHistoryRef.current[projectsHistoryRef.current.length - 1];
        projectsHistoryRef.current = projectsHistoryRef.current.slice(0, -1);
        projectsFutureRef.current = [projectsRef.current, ...projectsFutureRef.current];
        setProjects(previous);
        toast.success('Undone');
        // Update reactive state
        setCanUndoState(projectsHistoryRef.current.length > 0);
        setCanRedoState(true);
        setHistoryLengthState(projectsHistoryRef.current.length);
    }, []);

    const redoProjects = useCallback(() => {
        if (projectsFutureRef.current.length === 0) {
            toast.info('Nothing to redo');
            return;
        }
        const next = projectsFutureRef.current[0];
        projectsFutureRef.current = projectsFutureRef.current.slice(1);
        projectsHistoryRef.current = [...projectsHistoryRef.current, projectsRef.current];
        setProjects(next);
        toast.success('Redone');
        // Update reactive state
        setCanUndoState(true);
        setCanRedoState(projectsFutureRef.current.length > 0);
        setHistoryLengthState(projectsHistoryRef.current.length);
    }, []);

    useEffect(() => {
        projectsRef.current = projects;
    }, [projects]);

    // Event Listeners
    useEffect(() => {
        const onNavigateSettings = () => setCurrentView('settings');
        window.addEventListener('lightwork:navigate-settings', onNavigateSettings);
        return () => window.removeEventListener('lightwork:navigate-settings', onNavigateSettings);
    }, []);

    // Initial Data Fetch
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
                    // Session Persistence: restore last active project
                    const lastProjectId = localStorage.getItem('lightwork_last_project_id');
                    const lastProject = lastProjectId ? fetchedProjects.find(p => p.id === lastProjectId) : null;
                    setCurrentProjectId(lastProject ? lastProject.id : fetchedProjects[0].id);
                } else {
                    // Create default project
                    const newP = await api.createProject("Session #1");
                    if (newP) {
                        setProjects([newP]);
                        setCurrentProjectId(newP.id);
                    }
                }

                // Onboarding (once per browser)
                if (localStorage.getItem('lightwork_onboarded') !== 'true') {
                    setShowOnboarding(true);
                }
            } catch (e) {
                console.error("Initialization failed", e);
                addToast('error', 'Failed to connect to backend');
            }
        };
        init();
    }, []);

    // Responsive Grid Columns
    useEffect(() => {
        const calculateColumns = () => {
            const width = window.innerWidth;
            if (width < 640) return 2;        // Mobile
            if (width < 1024) return 3;       // Tablet
            if (width < 1280) return 4;       // Desktop
            return 4;                          // Large desktop (user can adjust via slider)
        };

        const handleResize = () => {
            // Only auto-adjust if user hasn't manually changed (or on mobile where slider is hidden)
            if (!userAdjustedGrid || window.innerWidth < 1024) {
                setGridColumns(calculateColumns());
            }
        };

        // Set initial value
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [userAdjustedGrid]);

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

    // Session Persistence: save current project ID
    useEffect(() => {
        if (currentProjectId && currentProjectId !== 'temp') {
            try {
                localStorage.setItem('lightwork_last_project_id', currentProjectId);
            } catch {
                // ignore storage failures
            }
        }
    }, [currentProjectId]);

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

        // Persist fileName and localPrompt changes to backend
        // Only persist if it's a real job ID (not temp IDs starting with 'temp_')
        if (!jobId.startsWith('temp_')) {
            const persistableUpdates: { fileName?: string; localPrompt?: string } = {};
            if (updates.fileName !== undefined) persistableUpdates.fileName = updates.fileName;
            if (updates.localPrompt !== undefined) persistableUpdates.localPrompt = updates.localPrompt;

            if (Object.keys(persistableUpdates).length > 0) {
                api.updateImage(jobId, persistableUpdates).catch(err => {
                    console.error('Failed to persist image update:', err);
                });
            }
        }
    }, [currentProjectId]);

    // Reset infinite-scroll window when project/filter changes
    useEffect(() => {
        setVisibleCount(36);
    }, [currentProjectId, filter]);

    // Filter Persistence: Load saved filter when switching projects
    useEffect(() => {
        if (currentProjectId && currentProjectId !== 'temp') {
            try {
                const savedFilter = localStorage.getItem(`lightwork_filter_${currentProjectId}`);
                if (savedFilter && ['all', 'ready', 'done', 'failed'].includes(savedFilter)) {
                    setFilter(savedFilter as FilterType);
                } else {
                    setFilter('all'); // Default for new projects
                }
            } catch {
                setFilter('all');
            }
        }
    }, [currentProjectId]);

    // Filter Persistence: Save filter when it changes
    useEffect(() => {
        if (currentProjectId && currentProjectId !== 'temp' && filter) {
            try {
                localStorage.setItem(`lightwork_filter_${currentProjectId}`, filter);
            } catch {
                // ignore storage failures
            }
        }
    }, [currentProjectId, filter]);

    // QoL #1: Auto-save Module Prompt (local only)
    useEffect(() => {
        const projectId = currentProjectId;
        if (!projectId) return;

        const key = `lightwork_module_prompt_draft_${projectId}`;
        const timer = window.setInterval(() => {
            const fresh = projectsRef.current.find(p => p.id === projectId);
            const prompt = (fresh?.modulePrompt ?? '').toString();
            try {
                localStorage.setItem(key, prompt);
                localStorage.setItem(`${key}_ts`, String(Date.now()));
            } catch {
                // ignore storage failures
            }
        }, 5000);

        return () => window.clearInterval(timer);
    }, [currentProjectId]);

    // Restore draft only when backend prompt is empty
    useEffect(() => {
        const projectId = currentProjectId;
        if (!projectId) return;

        const key = `lightwork_module_prompt_draft_${projectId}`;
        let draft: string | null = null;
        try {
            draft = localStorage.getItem(key);
        } catch {
            draft = null;
        }

        if (!draft) return;
        if ((currentProject?.modulePrompt || '').trim().length > 0) return;

        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modulePrompt: draft || '' } : p));
    }, [currentProjectId, currentProject?.modulePrompt]);

    const getFilteredJobs = useCallback(() => {
        const jobs = (projectsRef.current.find(p => p.id === currentProjectId)?.jobs || []);
        return jobs.filter(j => {
            if (filter === 'all') return true;
            if (filter === 'ready') return ['queued', 'uploading', 'paused', 'retrying'].includes(j.status);
            if (filter === 'done') return j.status === 'completed';
            if (filter === 'failed') return j.status === 'error';
            return true;
        });
    }, [currentProjectId, filter]);

    const getRenderedJobs = useCallback(() => {
        const filtered = getFilteredJobs();
        return filtered.slice(0, visibleCount);
    }, [getFilteredJobs, visibleCount]);

    const selectAllVisible = useCallback(() => {
        const visible = getRenderedJobs();
        if (visible.length === 0) return;

        const visibleIds = new Set(visible.map(j => j.id));
        lastSelectedId.current = visible[visible.length - 1]?.id || null;

        setProjects(prev => prev.map(p =>
            p.id === currentProjectId
                ? { ...p, jobs: p.jobs.map(j => ({ ...j, selected: visibleIds.has(j.id) })) }
                : p
        ));
    }, [currentProjectId, getRenderedJobs]);

    // Moved clearSelection before keyboard shortcuts useEffect to avoid temporal dead zone
    const clearSelection = useCallback(() => {
        setProjects(prev => prev.map(p =>
            p.id === currentProjectId ? { ...p, jobs: p.jobs.map(j => ({ ...j, selected: false })) } : p
        ));
        lastSelectedId.current = null;
    }, [currentProjectId]);

    // Compute selectedJobs and queuedCount before keyboard shortcuts useEffect
    const selectedJobs = (currentProject.jobs || []).filter(j => j.selected);
    const queuedCount = (currentProject.jobs || []).filter(j => j.status === 'queued' || j.status === 'error' || j.status === 'paused').length;

    // QoL #2: Keyboard Shortcuts (Refactored)
    useKeyboardShortcuts({
        currentView,
        hasSelection: selectedJobs.length > 0,
        isProcessing,
        queuedCount,
        apiMode,
        lightboxOpen: !!lightboxData,
        onEscape: () => {
            if (lightboxData) setLightboxData(null);
            else if (selectedJobs.length > 0) clearSelection();
        },
        onDelete: () => {
            if (selectedJobs.length > 0) handleBulkDelete();
        },
        onSelectAll: selectAllVisible,
        onProcess: () => {
            if (!isProcessing && queuedCount > 0) {
                if (apiMode === 'economy') handleProcessBatchRef.current();
                else processQueueRef.current();
            }
        },
        onSpace: () => {
            if (selectedJobs.length > 0) {
                const first = selectedJobs[0];
                setLightboxData({ url: first.resultUrl || first.thumbnailUrl, original: first.originalUrl });
            }
        },
        onNavigate: (direction) => {
            const jobs = currentProject?.jobs || [];
            if (jobs.length === 0) return;

            const currentIndex = lastSelectedId.current
                ? jobs.findIndex(j => j.id === lastSelectedId.current)
                : -1;

            let newIndex = currentIndex;
            switch (direction) {
                case 'left':
                    newIndex = currentIndex <= 0 ? jobs.length - 1 : currentIndex - 1;
                    break;
                case 'right':
                    newIndex = currentIndex >= jobs.length - 1 ? 0 : currentIndex + 1;
                    break;
                case 'up':
                    newIndex = Math.max(0, currentIndex - gridColumns);
                    break;
                case 'down':
                    newIndex = Math.min(jobs.length - 1, currentIndex + gridColumns);
                    break;
            }

            const newJob = jobs[newIndex];
            if (newJob) {
                handleJobClick(newJob.id, false, false);
            }
        },
        onUndo: undoProjects,
        onRedo: redoProjects
    });

    const stopUploadProgress = useCallback((jobId: string) => {
        const timerId = uploadProgressTimersRef.current[jobId];
        if (timerId) {
            window.clearInterval(timerId);
            delete uploadProgressTimersRef.current[jobId];
        }
        delete uploadProgressValueRef.current[jobId];
    }, []);

    const startUploadProgress = useCallback((jobId: string) => {
        stopUploadProgress(jobId);
        uploadProgressValueRef.current[jobId] = 0;

        // Smooth-ish progress that caps at ~92% until the upload completes.
        const timerId = window.setInterval(() => {
            const current = uploadProgressValueRef.current[jobId] ?? 0;
            const next = Math.min(92, current + (3 + Math.floor(Math.random() * 6)));
            uploadProgressValueRef.current[jobId] = next;
            updateJob(jobId, { uploadProgress: next });
        }, 220);

        uploadProgressTimersRef.current[jobId] = timerId;
    }, [stopUploadProgress, updateJob]);

    // Cleanup any active timers when unmounting
    useEffect(() => {
        return () => {
            Object.keys(uploadProgressTimersRef.current).forEach(key => {
                window.clearInterval(uploadProgressTimersRef.current[key]);
            });
            uploadProgressTimersRef.current = {};
            uploadProgressValueRef.current = {};
        };
    }, []);

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
        const confirmed = await confirm({
            title: 'Delete Module',
            message: 'Are you sure you want to delete this module? This action cannot be undone.',
            confirmLabel: 'Delete',
            variant: 'danger',
        });
        if (!confirmed) return;
        // API Call
        await api.deleteModule(id);
        setModules(prev => prev.filter(m => m.id !== id));
        addToast('info', 'Module deleted');
    };

    const deleteProject = async (id: string) => {
        if (projects.length <= 1) return;
        const confirmed = await confirm({
            title: 'Delete Project',
            message: 'Are you sure you want to delete this project? All images will be permanently removed. This action cannot be undone.',
            confirmLabel: 'Delete Project',
            variant: 'danger',
        });
        if (!confirmed) return;

        // Push to history for undo support
        pushProjectsHistory();

        setProjects(prev => prev.filter(p => p.id !== id));
        if (currentProjectId === id && projects.length > 0) {
            const next = projects.find(p => p.id !== id);
            if (next) setCurrentProjectId(next.id);
        }
        await api.deleteProject(id);
    };

    const handleDuplicateProject = async (id: string) => {
        const toastId = toast.loading('Duplicating project...');
        await api.duplicateProject(id);
        const updated = await api.getProjects();
        setProjects(updated);
        toast.dismiss(toastId);
        toast.success('Project duplicated');
    };

    const processFiles = async (files: File[]) => {
        if (currentView !== 'workspace') setCurrentView('workspace');

        const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (newFiles.length === 0) return;

        addToast('info', `Added ${newFiles.length} images`);

        const newJobs: ImageJob[] = await Promise.all(newFiles.map(async (file) => {
            // Apply Smart Rename from Settings if enabled
            let fileName = file.name;
            if (settings.smartRename) {
                // Placeholder logic: in a real app we might ask AI here, or just clean up the name
                // For now, let's just make it "cleaner" (replace spaces with dashes, lowercase)
                const ext = fileName.split('.').pop();
                const base = fileName.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, '-');
                fileName = `${base}.${ext}`;
            }

            const tempId = crypto.randomUUID();
            const thumb = await generateThumbnail(file);

            // Start upload progress UI immediately
            startUploadProgress(tempId);

            // Background Upload (fire-and-forget, handled after return)
            api.uploadImage(currentProjectId, file).then(uploadedJob => {
                stopUploadProgress(tempId);
                if (uploadedJob) {
                    updateJob(tempId, {
                        id: uploadedJob.id, // Update to real ID
                        status: 'queued',
                        originalUrl: uploadedJob.originalUrl,
                        thumbnailUrl: uploadedJob.thumbnailUrl, // Update to backend URL
                        uploadProgress: 100,
                    });

                    // UX Task 7: Smart Default Modules - auto-select "General" module on first upload if no module selected
                    const freshProject = projectsRef.current.find(p => p.id === currentProjectId);
                    if (freshProject && !freshProject.selectedModulePreset && freshProject.jobs.length <= 1) {
                        // First upload to this project, auto-select the General module
                        updateCurrentProject({ selectedModulePreset: 'general', modulePrompt: modules.find(m => m.id === 'general')?.prompt || '' });
                    }

                    // QoL #11: Auto-name default projects once, based on first uploaded image
                    const autoNameKey = `lightwork_project_autonamed_${currentProjectId}`;
                    const alreadyNamed = didAutoNameProjectRef.current[currentProjectId] || localStorage.getItem(autoNameKey) === 'true';
                    const isDefaultName = /^Session #\d+$/i.test(currentProject.name) || currentProject.name.trim().toLowerCase() === 'untitled project';
                    if (!alreadyNamed && isDefaultName) {
                        didAutoNameProjectRef.current[currentProjectId] = true;
                        localStorage.setItem(autoNameKey, 'true');
                        generateSmartFilename(file).then(r => {
                            if (r.success && r.result) {
                                const clean = r.result.replace(/\.[^/.]+$/, '').trim();
                                if (clean.length > 0) {
                                    updateCurrentProject({ name: clean });
                                }
                            }
                        }).catch(() => {
                            // ignore AI failures
                        });
                    }

                    // Let the user see 100% briefly, then clear
                    setTimeout(() => {
                        updateJob(uploadedJob.id, { uploadProgress: undefined });
                    }, 450);
                } else {
                    updateJob(tempId, { status: 'error', errorMsg: 'Upload failed' });
                }
            });

            return {
                id: tempId,
                file: file, // Store file temporarily for upload
                fileName: fileName,
                thumbnailUrl: thumb.dataUrl,
                status: 'uploading' as const,
                retryCount: 0,
                timestamp: Date.now(),
                originalUrl: URL.createObjectURL(file),
                width: thumb.width,
                height: thumb.height,
                uploadProgress: 0,
            };
        }));

        // Track new image IDs for smooth scroll
        const newImageIds = newJobs.map(j => j.id);
        newImageIdsRef.current = newImageIds;

        setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, jobs: [...p.jobs, ...newJobs] } : p));

        // Smooth scroll to first new image after DOM update
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (newImageIds.length > 0 && gridContainerRef.current) {
                    const firstNewImage = gridContainerRef.current.querySelector(`[data-image-id="${newImageIds[0]}"]`);
                    if (firstNewImage) {
                        firstNewImage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }, 100);
        });
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

    // Bulk Action Handlers
    const handleBulkDelete = () => {
        if (selectedJobs.length === 0) return;

        // Push to history for undo support
        pushProjectsHistory();

        const jobsToDelete = [...selectedJobs];
        const ids = jobsToDelete.map(j => j.id);
        const count = ids.length;

        // Immediately remove from UI (optimistic)
        setProjects(prev => prev.map(p =>
            p.id === currentProjectId
                ? { ...p, jobs: p.jobs.filter(j => !ids.includes(j.id)) }
                : p
        ));
        clearSelection();

        // Show undo toast with delayed backend deletion
        let undone = false;
        toast(`${count} image${count > 1 ? 's' : ''} deleted`, {
            duration: 10000,
            action: {
                label: 'Undo',
                onClick: () => {
                    undone = true;
                    // Restore deleted jobs to UI
                    setProjects(prev => prev.map(p =>
                        p.id === currentProjectId
                            ? { ...p, jobs: [...p.jobs, ...jobsToDelete] }
                            : p
                    ));
                    toast.success('Restored!', { duration: 2000 });
                },
            },
        });

        // Delay actual backend deletion to allow undo
        setTimeout(async () => {
            if (!undone) {
                await Promise.allSettled(ids.map(id => api.deleteImage(id)));
            }
        }, 10000);
    };

    const handleBulkDownload = async () => {
        const readyJobs = selectedJobs.filter(j => j.resultUrl);
        if (readyJobs.length === 0) return;

        // Dynamic import JSZip
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        const getZipFileName = (j: ImageJob) => {
            const base = (j.fileName || 'image').replace(/\.[^/.]+$/, '');
            return `LightWork_${base}_processed.png`;
        };

        try {
            for (const j of readyJobs) {
                const resultUrl = j.resultUrl;
                if (!resultUrl) continue;

                if (resultUrl.startsWith('data:')) {
                    const base64 = resultUrl.split(',')[1] || '';
                    zip.file(getZipFileName(j), base64, { base64: true });
                } else {
                    const res = await fetch(resultUrl);
                    const blob = await res.blob();
                    zip.file(getZipFileName(j), blob);
                }
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `LightWork_Batch_${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (err) {
            console.error('Bulk download failed:', err);
        }
    };

    const handleBulkProcess = () => {
        // Process only selected queued jobs - trigger the process queue
        processQueueRef.current?.();
    };

    const handleBulkResetStatus = () => {
        const errorIds = selectedJobs.filter(j => j.status === 'error').map(j => j.id);
        if (errorIds.length === 0) return;
        setProjects(prev => prev.map(p =>
            p.id === currentProjectId
                ? { ...p, jobs: p.jobs.map(j => errorIds.includes(j.id) ? { ...j, status: 'queued', errorMsg: undefined, retryCount: 0 } : j) }
                : p
        ));
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

    // clearSelection is now defined earlier (before keyboard shortcuts useEffect)

    const clearAllJobs = async () => {
        const confirmed = await confirm({
            title: 'Clear All Images',
            message: 'Are you sure you want to remove all images from this session? This action cannot be undone.',
            confirmLabel: 'Clear All',
            variant: 'danger',
        });
        if (confirmed) {
            const currentJobs = projectsRef.current.find(p => p.id === currentProjectId)?.jobs || [];
            const ids = currentJobs.map(j => j.id);
            // Optimistic UI update
            setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, jobs: [] } : p));
            // Persist deletions to backend
            await Promise.allSettled(ids.map(id => api.deleteImage(id)));
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

    // AI-Powered Search Handler
    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }

        const jobs = currentProject?.jobs || [];
        if (jobs.length === 0) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const imageData = jobs.map(j => ({
                id: j.id,
                filename: j.fileName || 'untitled',
                thumbnailUrl: j.thumbnailUrl || ''
            }));

            const matchingIds = await api.searchImages(imageData, searchQuery);
            setSearchResults(matchingIds);
            // Removed toast per user request
        } catch (error) {
            console.error('Search failed:', error);
            // toast.error('Search failed'); // Optional: keep error toast or remove it too. Kept silent for smoother UX? User said "search feature shouldnt bring up the toast as the results are already visiible". Error toast might still be useful, but let's suppress it for "clean" UX unless critical.
            setSearchResults(null);
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, currentProject]);

    // Live Search with Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim()) {
                handleSearch();
            } else {
                setSearchResults(null);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [searchQuery, handleSearch]);

    // Clear search
    const clearSearch = useCallback(() => {
        setSearchQuery('');
        setSearchResults(null);
    }, []);

    // Drag-to-Reorder: DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    // Drag-to-Reorder: Handle drag end
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        setProjects(prev => prev.map(p => {
            if (p.id !== currentProjectId) return p;

            const jobs = [...p.jobs];
            const oldIndex = jobs.findIndex(j => j.id === active.id);
            const newIndex = jobs.findIndex(j => j.id === over.id);

            if (oldIndex === -1 || newIndex === -1) return p;

            const reorderedJobs = arrayMove(jobs, oldIndex, newIndex);
            return { ...p, jobs: reorderedJobs };
        }));

        toast.success('Images reordered');
    }, [currentProjectId]);

    // QoL #19: Retry a single failed upload (keeps it per-item)
    const retryUpload = useCallback((jobId: string) => {
        const project = projectsRef.current.find(p => p.id === currentProjectId);
        const job = project?.jobs.find(j => j.id === jobId);
        if (!job) return;
        if (!job.file) {
            addToast('error', 'Original file not available for retry');
            return;
        }

        updateJob(jobId, { status: 'uploading', errorMsg: undefined, uploadProgress: 0 });
        startUploadProgress(jobId);

        api.uploadImage(currentProjectId, job.file).then(uploadedJob => {
            stopUploadProgress(jobId);
            if (uploadedJob) {
                updateJob(jobId, {
                    id: uploadedJob.id,
                    status: 'queued',
                    originalUrl: uploadedJob.originalUrl,
                    thumbnailUrl: uploadedJob.thumbnailUrl,
                    uploadProgress: 100,
                    errorMsg: undefined,
                });
                setTimeout(() => {
                    updateJob(uploadedJob.id, { uploadProgress: undefined });
                }, 450);
            } else {
                updateJob(jobId, { status: 'error', errorMsg: 'Upload failed' });
            }
        });
    }, [currentProjectId, startUploadProgress, stopUploadProgress, updateJob]);

    const openReportModal = useCallback(() => {
        setShowReportModal(true);
    }, []);

    // Optimized parallel processing for Tier 1 limits
    const processQueueParallel = async () => {
        if (!navigator.onLine) { addToast('error', 'You are offline.'); return; }
        if (isProcessing) return;

        const freshProject = projectsRef.current.find(p => p.id === currentProjectId);
        if (!freshProject) return;

        // Get all queued jobs
        const queuedJobs = freshProject.jobs.filter(j =>
            j.status === 'queued' || j.status === 'retrying'
        );

        if (queuedJobs.length === 0) {
            addToast('info', 'No images to process');
            return;
        }

        setIsProcessing(true);
        addToast('info', `Processing ${queuedJobs.length} images in parallel...`);

        // Mark all as processing
        for (const job of queuedJobs) {
            updateJob(job.id, { status: 'processing', errorMsg: undefined });
        }

        // Track retries per batch to prevent infinite loops
        const MAX_BATCH_RETRIES = 3;
        const batchRetries = new Map<number, number>();

        try {
            // Process in batches of PARALLEL_BATCH_SIZE
            let batchIndex = 0;
            while (batchIndex < queuedJobs.length) {
                const batch = queuedJobs.slice(batchIndex, batchIndex + PARALLEL_BATCH_SIZE);
                const jobIds = batch.map(j => j.id);
                const model = freshProject.selectedMode === 'fast' ? AppModel.FAST : AppModel.PRO;

                const result = await api.processImagesParallel(
                    jobIds,
                    model,
                    freshProject.modulePrompt
                );

                if (!result.success) {
                    if (result.retryAfterMs) {
                        // Check if we've exceeded max retries for this batch
                        const currentRetries = batchRetries.get(batchIndex) || 0;

                        if (currentRetries < MAX_BATCH_RETRIES) {
                            // Rate limited - wait and retry this batch
                            const waitSec = Math.ceil(result.retryAfterMs / 1000);
                            addToast('warning', `Rate limited. Waiting ${waitSec}s... (retry ${currentRetries + 1}/${MAX_BATCH_RETRIES})`);

                            for (const job of batch) {
                                updateJob(job.id, {
                                    status: 'retrying',
                                    errorMsg: `Rate limited. Waiting ${waitSec}s...`
                                });
                            }

                            await wait(result.retryAfterMs);

                            // Record retry attempt
                            batchRetries.set(batchIndex, currentRetries + 1);

                            // Reset status and retry (don't advance batchIndex)
                            for (const job of batch) {
                                updateJob(job.id, { status: 'processing' });
                            }
                            continue;
                        } else {
                            // Max retries exceeded - mark as failed
                            addToast('error', `Batch failed after ${MAX_BATCH_RETRIES} retries`);
                            for (const job of batch) {
                                updateJob(job.id, { status: 'error', errorMsg: 'Max retries exceeded' });
                            }
                        }
                    } else {
                        // General error - mark all as failed
                        for (const job of batch) {
                            updateJob(job.id, { status: 'error', errorMsg: result.error });
                        }
                    }
                } else if (result.processed) {
                    // Update individual job statuses
                    for (const processed of result.processed) {
                        if (processed.success) {
                            // Fetch the result image URL - for now we'll refresh from backend
                            updateJob(processed.jobId, { status: 'completed' });
                        } else {
                            updateJob(processed.jobId, {
                                status: 'error',
                                errorMsg: processed.error || 'Processing failed'
                            });
                        }
                    }

                    // Show progress
                    const completed = batchIndex + batch.length;
                    if (completed < queuedJobs.length) {
                        addToast('info', `Processed ${completed}/${queuedJobs.length}...`);
                    }
                }

                // Move to next batch
                batchIndex += PARALLEL_BATCH_SIZE;

                // Small delay between batches for safety
                if (batchIndex < queuedJobs.length) {
                    await wait(MIN_GEMINI_REQUEST_SPACING_MS);
                }
            }

            // Refresh project data to get result URLs
            const updatedProjects = await api.getProjects();
            setProjects(updatedProjects);

            addToast('success', 'Batch complete!');
        } catch (err) {
            console.error('Parallel processing error:', err);
            addToast('error', 'Processing failed');

            // Mark remaining as queued for retry
            for (const job of queuedJobs) {
                const current = projectsRef.current
                    .find(p => p.id === currentProjectId)?.jobs
                    .find(j => j.id === job.id);
                if (current?.status === 'processing') {
                    updateJob(job.id, { status: 'queued' });
                }
            }
        }

        setIsProcessing(false);
    };

    // Legacy sequential processing (fallback)
    const processQueueSequential = async () => {
        if (!navigator.onLine) { addToast('error', 'You are offline.'); return; }
        if (isProcessing) return;

        const freshProject = projectsRef.current.find(p => p.id === currentProjectId);
        if (!freshProject) return;

        setIsProcessing(true);
        const activeJobIds = new Set<string>();

        const processNext = async (workerId: number) => {
            const now = Date.now();
            if (now < nextGeminiAllowedAtRef.current) {
                await wait(nextGeminiAllowedAtRef.current - now);
            }

            const freshProject = projectsRef.current.find(p => p.id === currentProjectId);
            if (!freshProject) return;
            const job = freshProject.jobs.find(j => (j.status === 'queued' || j.status === 'retrying') && !activeJobIds.has(j.id));
            if (!job) return;

            activeJobIds.add(job.id);
            updateJob(job.id, { status: 'processing', errorMsg: undefined });

            try {
                // Enforce minimum spacing between Gemini requests to avoid RPM throttling.
                nextGeminiAllowedAtRef.current = Math.max(
                    nextGeminiAllowedAtRef.current,
                    Date.now() + MIN_GEMINI_REQUEST_SPACING_MS
                );

                // Pass file or URL - compression will always happen client-side
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
                        const delay = result.retryAfterSeconds
                            ? result.retryAfterSeconds * 1000
                            : calculateBackoff(job.retryCount);

                        nextGeminiAllowedAtRef.current = Math.max(
                            nextGeminiAllowedAtRef.current,
                            Date.now() + delay
                        );

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

            await processNext(workerId);
        };

        const initialWorkers = [];
        for (let i = 0; i < MAX_CONCURRENT_JOBS; i++) { initialWorkers.push(processNext(i + 1)); }
        await Promise.allSettled(initialWorkers);
        setIsProcessing(false);
        addToast('success', 'Batch complete');
    };

    // Main process function - uses parallel by default, falls back to sequential
    const processQueue = processQueueParallel;

    // Handle batch processing (economy mode)
    const handleProcessBatch = useCallback(async () => {
        const model = currentProject.selectedMode === 'pro' ? AppModel.PRO : AppModel.FAST;
        addToast('info', 'Creating batch job...');
        const createResult = await api.createBatch(currentProjectId, model);
        if (!createResult.success) {
            addToast('error', createResult.error || 'Failed to create batch');
            return;
        }
        addToast('success', `Batch created with ${createResult.itemCount} images`);
        const submitResult = await api.submitBatch(createResult.batchId!);
        if (!submitResult.success) {
            addToast('error', submitResult.error || 'Failed to submit batch');
            return;
        }
        addToast('success', 'Batch submitted! Check status panel for progress.');
    }, [currentProject.selectedMode, currentProjectId, addToast]);

    // Update refs for keyboard shortcuts to use (in useEffect to avoid side effects during render)
    useEffect(() => {
        processQueueRef.current = processQueue;
        handleProcessBatchRef.current = handleProcessBatch;
    }, [processQueue, handleProcessBatch]);

    const filteredJobs = (currentProject.jobs || []).filter(j => {
        if (filter === 'all') return true;
        if (filter === 'ready') return ['queued', 'uploading', 'paused', 'retrying'].includes(j.status);
        if (filter === 'done') return j.status === 'completed';
        if (filter === 'failed') return j.status === 'error';
        return true;
    });

    const renderedJobs = filteredJobs.slice(0, visibleCount);

    // Interactions #7: IntersectionObserver sentinel to load more
    useEffect(() => {
        const el = loadMoreRef.current;
        if (!el) return;

        if (renderedJobs.length >= filteredJobs.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (!first?.isIntersecting) return;
                setVisibleCount(v => Math.min(filteredJobs.length, v + 36));
            },
            { root: null, rootMargin: '800px 0px', threshold: 0 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [filteredJobs.length, renderedJobs.length]);

    const stats = {
        all: (currentProject.jobs || []).length,
        ready: (currentProject.jobs || []).filter(j => ['queued', 'uploading', 'paused', 'retrying'].includes(j.status)).length,
        done: (currentProject.jobs || []).filter(j => j.status === 'completed').length,
        failed: (currentProject.jobs || []).filter(j => j.status === 'error').length
    };

    // selectedJobs is now defined earlier (before keyboard shortcuts useEffect)

    if (!projects.length && !toasts.length) return <div className="h-screen flex items-center justify-center bg-[#F2F0E9] text-stone-400">Loading Session...</div>;

    return (
        <div className="flex h-screen overflow-hidden bg-[#F2F0E9] text-stone-900 font-sans selection:bg-clay-500/20" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
            <ToastContainer toasts={toasts} />
            <ConfirmDialogComponent />
            <Suspense fallback={null}>
                {showOnboarding && <LazyOnboarding onComplete={() => { setShowOnboarding(false); localStorage.setItem('lightwork_onboarded', 'true'); }} />}
            </Suspense>

            <Suspense fallback={null}>
                <LazyLightbox isOpen={!!lightboxData} imageUrl={lightboxData?.url || ''} originalUrl={lightboxData?.original} onClose={() => setLightboxData(null)} />
            </Suspense>

            <Suspense fallback={null}>
                <LazyReportModal project={currentProject} isOpen={showReportModal} onClose={() => setShowReportModal(false)} />
            </Suspense>
            {isDragging && <div className="fixed inset-4 border-4 border-dashed border-clay-500/50 rounded-3xl bg-clay-50/20 z-[100] pointer-events-none flex items-center justify-center backdrop-blur-sm"><div className="bg-[#FDFCFB]/90 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4"><UploadCloud className="w-12 h-12 text-clay-600 animate-bounce" /><span className="font-bold text-2xl text-stone-900">Drop Assets to Ingest</span></div></div>}

            <Sidebar
                projects={projects} currentProjectId={currentProjectId}
                onSelectProject={(id) => { setCurrentProjectId(id); setCurrentView('workspace'); clearSelection(); }}
                onCreateProject={async () => {
                    const newP = await api.createProject(`Session #${projects.length + 1}`);
                    if (newP) {
                        // Apply default model from settings
                        const projectWithSettings = { ...newP, selectedMode: settings.defaultModel };
                        // We would essentially need to update this on the backend too in a real sync scenario
                        setProjects([projectWithSettings, ...projects]);
                        setCurrentProjectId(newP.id);
                        setCurrentView('workspace');
                    }
                }}
                onRenameProject={(id, name) => { setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p)); api.updateProject(id, { name }); }}
                onDeleteProject={deleteProject} currentView={currentView} onChangeView={setCurrentView} onDuplicateProject={handleDuplicateProject}
            />

            {currentView === 'modules' ? (
                <Suspense fallback={null}>
                    <LazyModulesManager modules={modules} onCreate={handleCreateModule} onDelete={handleDeleteModule} onUpdate={() => { }} onBack={() => setCurrentView('workspace')} />
                </Suspense>
            ) : currentView === 'settings' ? (
                <Suspense fallback={null}>
                    <LazySettingsPage onBack={() => setCurrentView('workspace')} />
                </Suspense>
            ) : (
                <div className="flex-1 flex overflow-hidden">
                    <main className="flex-1 relative flex flex-col h-full overflow-hidden transition-all bg-[#F2F0E9]" onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}>
                        {/* Header: Minimal Icon-Based Design */}
                        <div className="h-16 flex items-center justify-between px-6 border-b border-stone-200/50 bg-[#F2F0E9]/80 backdrop-blur-md z-10 shrink-0 gap-6 relative">

                            {/* MOBILE SEARCH OVERLAY (Unchanged logic) */}
                            {isMobileSearchOpen && (
                                <div className="absolute inset-0 bg-[#F2F0E9] z-20 flex items-center px-4 md:hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="relative w-full flex items-center gap-3">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            placeholder="Search assets..."
                                            autoFocus
                                            className="w-full pl-10 pr-10 py-2.5 bg-white border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:ring-4 focus:ring-clay-500/5 focus:border-clay-400 shadow-lg"
                                        />
                                        <button
                                            onClick={() => setIsMobileSearchOpen(false)}
                                            className="p-2 bg-white border border-stone-200 rounded-xl text-stone-500 hover:text-stone-900 shadow-sm whitespace-nowrap text-xs font-bold"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* LEFT ZONE: Context & Discovery */}
                            <div className="flex items-center gap-4 min-w-0">
                                {/* Mobile Menu Trigger */}
                                <MobileMenuTrigger />

                                {/* Mobile Search Toggle */}
                                <button
                                    onClick={() => setIsMobileSearchOpen(true)}
                                    className="md:hidden p-2 text-stone-400 hover:text-stone-900 hover:bg-white rounded-lg transition-colors"
                                >
                                    <Search className="w-5 h-5" />
                                </button>

                                {isHeaderEditing ? (
                                    <input ref={headerInputRef} type="text" value={headerTempName} onChange={(e) => setHeaderTempName(e.target.value)} onBlur={saveHeaderRename} onKeyDown={(e) => e.key === 'Enter' && saveHeaderRename()} className="text-xl font-heading font-bold tracking-tight text-stone-900 bg-transparent border-b-2 border-clay-500 focus:outline-none min-w-[120px] md:min-w-[200px]" placeholder="Session Name" />
                                ) : (
                                    <div className="flex items-center gap-3 group cursor-pointer min-w-0" onClick={startHeaderRename} title="Rename">
                                        <h1 className="text-xl font-heading font-bold tracking-tight text-stone-900 truncate max-w-[200px] md:max-w-[320px]">{currentProject.name}</h1>
                                        <Edit2 className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0 hidden md:block" />
                                    </div>
                                )}

                                <div className="h-6 w-px bg-stone-300/30 hidden lg:block" />

                                <div className="items-center gap-1 hidden lg:flex">
                                    {['all', 'ready', 'done', 'failed'].map(f => {
                                        if (f === 'failed' && stats.failed === 0) return null;
                                        const isActive = filter === f;
                                        const icons = {
                                            all: Layers,
                                            ready: Clock,
                                            done: CheckCircle2,
                                            failed: AlertCircle
                                        };
                                        const Icon = icons[f as keyof typeof icons];

                                        return (
                                            <button
                                                key={f}
                                                onClick={() => setFilter(f as FilterType)}
                                                className={`relative p-2 rounded-lg transition-all group ${isActive ? 'bg-stone-200 text-stone-900' : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'}`}
                                                title={`${f.charAt(0).toUpperCase() + f.slice(1)} (${stats[f as keyof typeof stats]})`}
                                            >
                                                <Icon className="w-4 h-4" />
                                                {/* Badge Count */}
                                                {stats[f as keyof typeof stats] > 0 && (
                                                    <span className={`absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-white text-[9px] font-bold shadow-sm border border-stone-100 px-0.5 ${isActive ? 'text-stone-900' : 'text-stone-500'}`}>
                                                        {stats[f as keyof typeof stats]}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* CENTER ZONE: Global Search */}
                            <div className="hidden md:flex flex-1 justify-center max-w-lg">
                                <div className="relative group w-full">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 group-focus-within:text-clay-500 transition-colors" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSearchQuery(val);
                                            if (!val.trim()) setSearchResults(null);
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        placeholder="Search..."
                                        className="w-full pl-10 pr-10 py-2 bg-white border border-stone-200 rounded-xl text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-clay-500/5 focus:border-clay-400 transition-all shadow-sm group-hover:shadow-md"
                                    />
                                    {searchQuery ? (
                                        <button
                                            onClick={clearSearch}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    ) : null}
                                    {searchResults && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-stone-100 shadow-xl p-3 z-20 flex items-center justify-between animate-in slide-in-from-top-2 fade-in duration-200">
                                            <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
                                                <Sparkles className="w-3.5 h-3.5 text-clay-500" />
                                                Found {searchResults.length} matches
                                            </div>
                                            <button onClick={clearSearch} className="text-[10px] font-bold text-stone-400 hover:text-stone-600 uppercase tracking-wider">Clear</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT ZONE: Actions & View */}
                            <div className="flex items-center gap-3">
                                {/* Undo/Redo Toolbar */}
                                <UndoRedoToolbar
                                    canUndo={canUndoState}
                                    canRedo={canRedoState}
                                    onUndo={undoProjects}
                                    onRedo={redoProjects}
                                    historyLength={historyLengthState}
                                />

                                {/* View Controls Group */}
                                <div className="hidden lg:flex items-center gap-2 p-1 bg-white rounded-xl border border-stone-200 shadow-sm">
                                    <div className="flex items-center gap-2 px-2" title="Image Size">
                                        <Grip className="w-3.5 h-3.5 text-stone-400" />
                                        <input
                                            type="range"
                                            min={2}
                                            max={6}
                                            step={1}
                                            value={8 - gridColumns}
                                            onChange={(e) => {
                                                setGridColumns(8 - parseInt(e.target.value, 10));
                                                setUserAdjustedGrid(true);
                                            }}
                                            className="w-16 accent-stone-900 h-1.5 bg-stone-100 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>

                                {/* Primary Actions */}
                                <div className="flex items-center gap-2 pl-2 border-l border-stone-200/50">
                                    {currentProject.jobs && currentProject.jobs.length > 0 && (
                                        <button
                                            onClick={openReportModal}
                                            className="p-2.5 text-stone-500 bg-white hover:bg-stone-50 hover:text-red-600 rounded-xl border border-stone-200 shadow-sm transition-all active:scale-95 disabled:opacity-50 hidden sm:block"
                                            title="Export PDF Report"
                                        >
                                            <FileText className="w-4 h-4" />
                                        </button>
                                    )}

                                    <label className="group cursor-pointer flex items-center justify-center p-2.5 bg-stone-900 text-white rounded-xl shadow-lg shadow-stone-900/10 hover:shadow-stone-900/20 hover:bg-stone-800 active:scale-95 transition-all" title="Add Assets">
                                        <UploadCloud className="w-4 h-4 text-stone-300 group-hover:text-white transition-colors" />
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div ref={gridContainerRef} className="flex-1 overflow-y-auto p-4 md:p-10 pb-40 scroll-smooth" onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}>
                            {(currentProject.jobs || []).length === 0 ? (
                                <EmptyState type="workspace" />
                            ) : (
                                /* Standard Grid Layout with Drag-to-Reorder */
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={renderedJobs.map(j => j.id)} strategy={rectSortingStrategy}>
                                        <div className="grid gap-4 md:gap-8 pb-24" style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}>
                                            {renderedJobs.map(job => {
                                                const isSearchMatch = !searchResults || searchResults.includes(job.id);
                                                return (
                                                    <SortableImageCard
                                                        key={job.id}
                                                        job={job}
                                                        isSelected={!!job.selected}
                                                        isActive={!!job.selected}
                                                        onToggleSelect={toggleSelection}
                                                        onClick={(id, e) => handleJobClick(id, e.shiftKey, e.metaKey || e.ctrlKey)}
                                                        isSearchMatch={isSearchMatch}
                                                    />
                                                );
                                            })}

                                            {/* Infinite scroll sentinel */}
                                            {renderedJobs.length < filteredJobs.length && (
                                                <div ref={loadMoreRef} className="h-8 col-span-full" />
                                            )}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            )}
                        </div>

                        <CommandDock
                            project={currentProject}
                            modules={modules}
                            isProcessing={isProcessing}
                            queuedCount={(currentProject.jobs || []).filter(j => j.status === 'queued' || j.status === 'error' || j.status === 'paused').length}
                            apiMode={apiMode}
                            onApiModeChange={setApiMode}
                            onUpdateProject={updateCurrentProject}
                            onProcess={processQueue}
                            onProcessBatch={handleProcessBatch}
                            onCreateModule={handleCreateModule}
                            onDeleteModule={handleDeleteModule}
                            onManageModules={() => setCurrentView('modules')}
                        />

                        <Suspense fallback={null}>
                            <LazyBatchStatusPanel onBatchComplete={(batchId) => {
                                addToast('success', 'Batch processing complete!');
                                // Refresh project data to show results
                                api.getProjects().then(projects => setProjects(projects));
                            }} />
                        </Suspense>
                    </main>

                    {selectedJobs.length > 0 && ( // FIX: Show inspector for ANY selection count
                        <Suspense fallback={null}>
                            <LazyInspector
                                selectedJobs={selectedJobs}
                                onClose={clearSelection}
                                onUpdateJob={updateJob}
                                onRetryUpload={retryUpload}
                                onRemove={(ids) => {
                                    setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, jobs: p.jobs.filter(j => !ids.includes(j.id)) } : p));
                                    clearSelection();
                                }}
                                onRetry={(ids) => {
                                    setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, jobs: p.jobs.map(j => ids.includes(j.id) ? { ...j, status: 'queued', errorMsg: undefined, retryCount: 0 } : j) } : p));
                                }}
                                onZoom={(url) => setLightboxData({ url, original: selectedJobs.length === 1 ? selectedJobs[0].originalUrl : undefined })}
                            />
                        </Suspense>
                    )}



                    {/* Back to Top Button */}
                    <Suspense fallback={null}>
                        <LazyBackToTop />
                    </Suspense>
                </div>
            )}
        </div>
    );
}

// Main App with Auth Provider
export default function App() {
    return (
        <AuthProvider>
            <AuthenticatedApp />
        </AuthProvider>
    );
}

// Wrapper to handle auth state
function AuthenticatedApp() {
    const { user, loading } = useAuth();

    // Loading state
    if (loading) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-[#F2F0E9] gap-4">
                <div className="w-12 h-12 bg-stone-900 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
                    <Command className="w-6 h-6 text-[#FDFCFB]" />
                </div>
                <div className="flex items-center gap-2 text-stone-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-sans">Loading...</span>
                </div>
            </div>
        );
    }

    // Show auth modal if not logged in
    if (!user) {
        return <LandingPage />;
    }

    // Show main app content wrapped in SidebarProvider
    return (
        <SidebarProvider>
            <AppContent />
        </SidebarProvider>
    );
}