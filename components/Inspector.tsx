import React, { useState, useEffect } from 'react';
import { ImageJob } from '../types';
import { X, Sparkles, ScanEye, Wand2, Download, Copy, Trash2, RefreshCcw, CheckCircle2, Maximize2, AlertCircle, BoxSelect, DownloadCloud, History as HistoryIcon, Clock } from 'lucide-react';
import { enhancePrompt, generateImageDescription, generateSmartFilename } from '../services/geminiService';
import { api } from '../services/api';
import { useConfirmDialog } from './ConfirmDialog';
// @ts-ignore
import JSZip from 'jszip';

// Custom hook for responsive breakpoint detection
const useMediaQuery = (query: string) => {
    const [matches, setMatches] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia(query).matches;
        }
        return false;
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [query]);

    return matches;
};

interface InspectorProps {
    selectedJobs: ImageJob[];
    onClose: () => void;
    onUpdateJob: (id: string, updates: Partial<ImageJob>) => void;
    onRetryUpload: (id: string) => void;
    onRemove: (ids: string[]) => void;
    onRetry: (ids: string[]) => void;
    onZoom: (url: string) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
    selectedJobs,
    onClose,
    onUpdateJob,
    onRetryUpload,
    onRemove,
    onRetry,
    onZoom
}) => {
    const { ConfirmDialogComponent: ConfirmDialog, confirm } = useConfirmDialog();
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isAutoDrafting, setIsAutoDrafting] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [justCopied, setJustCopied] = useState(false);
    const [isOpen, setIsOpen] = useState(true);

    const [isDownloadingZip, setIsDownloadingZip] = useState(false);
    const [zipProgress, setZipProgress] = useState<number | undefined>(undefined);
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Responsive: use lg breakpoint (1024px)
    const isMobile = useMediaQuery('(max-width: 1023px)');

    // Batch State
    const [batchPrompt, setBatchPrompt] = useState('');

    // Reset local states when selection changes
    useEffect(() => {
        setIsEnhancing(false);
        setIsAutoDrafting(false);
        setIsRenaming(false);
        setJustCopied(false);
        setIsDownloadingZip(false);
        setZipProgress(undefined);
        setBatchPrompt('');
        setIsOpen(true);
        setHistory([]);

        // Fetch history if single selection
        if (selectedJobs.length === 1) {
            const job = selectedJobs[0];
            if ((job.version || 1) > 1) {
                setLoadingHistory(true);
                api.getHistory(job.id).then(h => {
                    setHistory(h);
                    setLoadingHistory(false);
                });
            }
        }
    }, [selectedJobs.map(j => j.id).join(','), selectedJobs[0]?.version]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                if (isMobile) {
                    setIsOpen(false);
                } else {
                    onClose();
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isMobile, onClose]);

    const describeAiError = (raw?: string) => {
        const msg = (raw || '').trim();
        const lower = msg.toLowerCase();

        if (!msg) {
            return { title: 'Processing Failed', detail: 'The AI request failed. Try again in a moment.', raw: undefined as string | undefined };
        }

        if (lower.includes('safety') || lower.includes('blocked') || lower.includes('policy') || (lower.includes('content') && lower.includes('filter'))) {
            return { title: 'Safety Filter Triggered', detail: 'Try rephrasing your prompt to avoid sensitive content.', raw: msg };
        }

        if (lower.includes('rate limited') || lower.includes('too many requests') || lower.includes('429')) {
            return { title: 'Rate Limited', detail: 'The service is busy. Wait a moment, then retry.', raw: msg };
        }

        if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('timeout')) {
            return { title: 'Network Error', detail: 'Check your connection and retry.', raw: msg };
        }

        return { title: 'Processing Failed', detail: 'Retry the operation, or adjust your prompt.', raw: msg };
    };

    if (selectedJobs.length === 0) return null;

    const handleClose = () => {
        if (isMobile) {
            setIsOpen(false);
            setTimeout(onClose, 300);
        } else {
            onClose();
        }
    };

    // --- SINGLE MODE ---
    if (selectedJobs.length === 1) {
        const job = selectedJobs[0];
        const isUploadFailed = job.status === 'error' && job.errorMsg === 'Upload failed' && !!job.file;
        const isAiFailed = job.status === 'error' && job.errorMsg !== 'Upload failed';
        const aiError = isAiFailed ? describeAiError(job.errorMsg) : null;

        const handleEnhance = async () => {
            if (!job.localPrompt.trim()) return;
            setIsEnhancing(true);
            const response = await enhancePrompt(job.localPrompt);
            if (response.success && response.result) {
                onUpdateJob(job.id, { localPrompt: response.result });
            }
            setIsEnhancing(false);
        };

        const handleAutoDraft = async () => {
            const imageSource = job.file || job.thumbnailUrl || job.originalUrl;
            if (!imageSource) return;
            setIsAutoDrafting(true);
            const response = await generateImageDescription(imageSource);
            if (response.success && response.result) {
                onUpdateJob(job.id, { localPrompt: response.result });
            }
            setIsAutoDrafting(false);
        };

        const handleSmartRename = async () => {
            const imageSource = job.file || job.thumbnailUrl || job.originalUrl;
            if (!imageSource) return;
            setIsRenaming(true);
            const response = await generateSmartFilename(imageSource);
            if (response.success && response.result) {
                const ext = job.fileName.split('.').pop() || 'png';
                const cleanName = response.result.replace(/\.[^/.]+$/, "");
                onUpdateJob(job.id, { fileName: `${cleanName}.${ext}` });
            }
            setIsRenaming(false);
        };

        const copyImage = async () => {
            if (!job.resultUrl) return;
            try {
                const response = await fetch(job.resultUrl);
                const blob = await response.blob();
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
                setJustCopied(true);
                setTimeout(() => setJustCopied(false), 2000);
            } catch (e) { console.error(e); }
        };

        const downloadImage = () => {
            if (!job.resultUrl) return;
            const link = document.createElement('a');
            link.href = job.resultUrl;
            link.download = `LightWork_${job.fileName}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        return (
            <>
                {/* Mobile Backdrop */}
                {isMobile && (
                    <div
                        className={`fixed inset-0 bg-stone-900/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        onClick={handleClose}
                        aria-hidden="true"
                    />
                )}

                {/* Panel */}
                <aside
                    className={`
                        ${isMobile ? 'fixed inset-y-0 right-0 z-50' : 'relative z-20'}
                        w-80 max-w-[85vw] h-full bg-[#FDFCFB] border-l border-stone-200 flex flex-col shadow-xl
                        transition-transform duration-300 ease-out
                        ${isMobile && !isOpen ? 'translate-x-full' : 'translate-x-0'}
                    `}
                    aria-label="Image inspector"
                >
                    {/* Header */}
                    <div className="h-14 px-5 border-b border-stone-200/60 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <div
                                className="w-8 h-8 rounded-lg overflow-hidden bg-stone-100 shrink-0 cursor-pointer"
                                onClick={() => onZoom(job.resultUrl || job.thumbnailUrl)}
                            >
                                <img src={job.resultUrl || job.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div className="min-w-0">
                                <h3
                                    className={`text-sm font-semibold truncate transition-colors ${job.status === 'completed' ? 'text-green-600' :
                                        job.status === 'error' ? 'text-red-600' :
                                            'text-stone-900'
                                        }`}
                                    title={job.fileName}
                                >
                                    {job.fileName}
                                </h3>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 -mr-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                            aria-label="Close inspector"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        {/* Image Preview */}
                        <div
                            className="aspect-square rounded-xl overflow-hidden bg-stone-100 cursor-zoom-in group relative"
                            onClick={() => onZoom(job.resultUrl || job.thumbnailUrl)}
                        >
                            <img src={job.resultUrl || job.thumbnailUrl} className="w-full h-full object-cover" alt="Preview" loading="lazy" />
                            <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/10 transition-colors flex items-center justify-center">
                                <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow-lg transition-opacity" />
                            </div>
                            {(job.version || 1) > 1 && (
                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[10px] font-bold border border-white/20">
                                    v{job.version}
                                </div>
                            )}
                        </div>

                        {/* Version History */}
                        {history.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider">
                                    <HistoryIcon className="w-3.5 h-3.5" /> Version History
                                </div>
                                <div className="space-y-1.5 p-2 bg-stone-50 rounded-xl border border-stone-100">
                                    {history.map((ver) => (
                                        <div key={ver.id} className="flex items-center justify-between p-2 hover:bg-white rounded-lg group transition-colors cursor-pointer" onClick={() => onZoom(ver.resultUrl)}>
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded bg-stone-200 overflow-hidden shrink-0 border border-stone-200">
                                                    <img src={ver.resultUrl} className="w-full h-full object-cover" alt="" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-semibold text-stone-700">Version {ver.version}</div>
                                                    <div className="text-[10px] text-stone-400 flex items-center gap-1">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {new Date(ver.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="text-[10px] font-bold text-clay-600 hover:underline">View</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {isAiFailed && aiError && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                                    <div>
                                        <div className="text-xs font-bold text-red-700">{aiError.title}</div>
                                        <div className="text-xs text-red-600 mt-1">{aiError.detail}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onRetry([job.id])}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-red-700 rounded-lg text-xs font-bold hover:bg-red-50 border border-red-200 transition-colors"
                                >
                                    <RefreshCcw className="w-3.5 h-3.5" /> Retry
                                </button>
                            </div>
                        )}

                        {/* Prompt */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-end gap-1">
                                <button
                                    onClick={handleAutoDraft}
                                    disabled={isAutoDrafting}
                                    className="p-1.5 text-stone-400 hover:text-clay-600 hover:bg-clay-50 rounded-md transition-colors disabled:opacity-50"
                                    title="Auto-describe image"
                                >
                                    {isAutoDrafting ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <ScanEye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                    onClick={handleEnhance}
                                    disabled={isEnhancing || !job.localPrompt}
                                    className="p-1.5 text-stone-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors disabled:opacity-50"
                                    title="Enhance prompt"
                                >
                                    {isEnhancing ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                    onClick={handleSmartRename}
                                    disabled={isRenaming}
                                    className="p-1.5 text-stone-400 hover:text-clay-600 hover:bg-clay-50 rounded-md transition-colors disabled:opacity-50"
                                    title="Smart rename"
                                >
                                    {isRenaming ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                            <textarea
                                value={job.localPrompt}
                                onChange={(e) => onUpdateJob(job.id, { localPrompt: e.target.value })}
                                placeholder="Describe changes for this image..."
                                className="w-full h-28 bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-clay-500/5 focus:border-clay-400 resize-none"
                            />
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            <button
                                onClick={downloadImage}
                                disabled={!job.resultUrl}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 transition-colors active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-stone-900/10"
                            >
                                <Download className="w-4 h-4" /> Download
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={copyImage}
                                    disabled={!job.resultUrl}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-stone-200 text-stone-600 rounded-lg text-xs font-semibold hover:bg-stone-50 transition-colors disabled:opacity-50"
                                >
                                    {justCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    {justCopied ? 'Copied' : 'Copy'}
                                </button>
                                {isUploadFailed ? (
                                    <button
                                        onClick={() => onRetryUpload(job.id)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-stone-200 text-stone-600 rounded-lg text-xs font-semibold hover:bg-stone-50 transition-colors"
                                    >
                                        <RefreshCcw className="w-3.5 h-3.5" /> Retry
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onRetry([job.id])}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-stone-200 text-stone-600 rounded-lg text-xs font-semibold hover:bg-stone-50 transition-colors"
                                    >
                                        <RefreshCcw className="w-3.5 h-3.5" /> Re-run
                                    </button>
                                )}
                                <button
                                    onClick={async () => {
                                        const confirmed = await confirm({
                                            title: 'Delete Image',
                                            message: 'Are you sure? This cannot be undone.',
                                            confirmLabel: 'Delete',
                                            variant: 'danger',
                                        });
                                        if (confirmed) {
                                            onRemove([job.id]);
                                            onClose();
                                        }
                                    }}
                                    className="p-2.5 bg-white border border-stone-200 text-red-500 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <ConfirmDialog />
                </aside>
            </>
        );
    }

    // --- BATCH MODE ---
    const aiFailedIds = selectedJobs.filter(j => j.status === 'error' && j.errorMsg !== 'Upload failed').map(j => j.id);
    const readyCount = selectedJobs.filter(j => j.resultUrl).length;

    const handleBatchDownload = async () => {
        const readyJobs = selectedJobs.filter(j => j.resultUrl);
        if (readyJobs.length === 0 || isDownloadingZip) return;

        setIsDownloadingZip(true);
        setZipProgress(0);

        const zip = new JSZip();
        const getZipFileName = (j: ImageJob) => {
            const base = (j.fileName || 'image').replace(/\.[^/.]+$/, '');
            return `LightWork_${base}_processed.png`;
        };

        const total = readyJobs.length;
        try {
            for (let i = 0; i < total; i++) {
                const j = readyJobs[i];
                if (!j.resultUrl) continue;
                setZipProgress(Math.round((i / total) * 70));

                if (j.resultUrl.startsWith('data:')) {
                    const base64 = j.resultUrl.split(',')[1] || '';
                    zip.file(getZipFileName(j), base64, { base64: true });
                } else {
                    const res = await fetch(j.resultUrl);
                    const blob = await res.blob();
                    zip.file(getZipFileName(j), blob);
                }
            }

            const content = await zip.generateAsync(
                { type: 'blob' },
                (metadata: { percent: number }) => setZipProgress(Math.round(70 + metadata.percent * 0.3))
            );

            setZipProgress(100);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `LightWork_Batch_${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            setTimeout(() => {
                setIsDownloadingZip(false);
                setZipProgress(undefined);
            }, 600);
        }
    };

    const handleBatchRename = async () => {
        setIsRenaming(true);
        for (const job of selectedJobs) {
            const imageSource = job.file || job.thumbnailUrl || job.originalUrl;
            if (!imageSource) continue;
            const response = await generateSmartFilename(imageSource);
            if (response.success && response.result) {
                const ext = job.fileName.split('.').pop() || 'png';
                const cleanName = response.result.replace(/\.[^/.]+$/, "");
                onUpdateJob(job.id, { fileName: `${cleanName}.${ext}` });
            }
            await new Promise(r => setTimeout(r, 500));
        }
        setIsRenaming(false);
    };

    const applyBatchPrompt = () => {
        selectedJobs.forEach(j => onUpdateJob(j.id, { localPrompt: batchPrompt }));
    };

    return (
        <>
            {/* Mobile Backdrop */}
            {isMobile && (
                <div
                    className={`fixed inset-0 bg-stone-900/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    onClick={handleClose}
                    aria-hidden="true"
                />
            )}

            {/* Panel */}
            <aside
                className={`
                    ${isMobile ? 'fixed inset-y-0 right-0 z-50' : 'relative z-20'}
                    w-80 max-w-[85vw] h-full bg-[#FDFCFB] border-l border-stone-200 flex flex-col shadow-xl
                    transition-transform duration-300 ease-out
                    ${isMobile && !isOpen ? 'translate-x-full' : 'translate-x-0'}
                `}
                aria-label="Batch inspector"
            >
                {/* Header */}
                <div className="h-14 px-5 border-b border-stone-200/60 flex items-center justify-between shrink-0 bg-stone-900 text-white">
                    <div className="flex items-center gap-3">
                        <BoxSelect className="w-4 h-4 text-clay-400" />
                        <span className="font-semibold">{selectedJobs.length} Selected</span>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 -mr-2 text-stone-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        aria-label="Close inspector"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Thumbnail Grid */}
                    <div className="grid grid-cols-4 gap-1.5">
                        {selectedJobs.slice(0, 11).map(j => (
                            <div key={j.id} className="aspect-square rounded-md overflow-hidden bg-stone-100 relative">
                                <img src={j.thumbnailUrl} className="w-full h-full object-cover" alt="" loading="lazy" />
                                {j.status === 'completed' && <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-tl" />}
                                {j.status === 'error' && <div className="absolute bottom-0 right-0 w-2 h-2 bg-red-500 rounded-tl" />}
                            </div>
                        ))}
                        {selectedJobs.length > 11 && (
                            <div className="aspect-square rounded-md bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-500">
                                +{selectedJobs.length - 11}
                            </div>
                        )}
                    </div>

                    {/* Error Banner */}
                    {aiFailedIds.length > 0 && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                                <span className="text-xs font-bold text-red-700">{aiFailedIds.length} Failed</span>
                            </div>
                            <button
                                onClick={() => onRetry(aiFailedIds)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-red-700 rounded-lg text-xs font-bold hover:bg-red-50 border border-red-200 transition-colors"
                            >
                                <RefreshCcw className="w-3.5 h-3.5" /> Retry Failed
                            </button>
                        </div>
                    )}

                    {/* Batch Prompt */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-end">
                            <button
                                onClick={applyBatchPrompt}
                                disabled={!batchPrompt}
                                className="text-xs font-semibold text-clay-600 hover:text-clay-700 disabled:opacity-50"
                            >
                                Apply to All
                            </button>
                        </div>
                        <textarea
                            value={batchPrompt}
                            onChange={(e) => setBatchPrompt(e.target.value)}
                            placeholder="Write instruction for all selected..."
                            className="w-full h-24 bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-clay-500/5 focus:border-clay-400 resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={handleBatchDownload}
                            disabled={readyCount === 0 || isDownloadingZip}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 transition-colors active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-stone-900/10"
                        >
                            {isDownloadingZip ? (
                                <RefreshCcw className="w-4 h-4 animate-spin" />
                            ) : (
                                <DownloadCloud className="w-4 h-4" />
                            )}
                            {isDownloadingZip ? 'Preparing...' : `Download All (${readyCount})`}
                        </button>

                        {typeof zipProgress === 'number' && (
                            <div className="px-1">
                                <div className="h-1 rounded-full bg-stone-200 overflow-hidden">
                                    <div className="h-full bg-clay-500 transition-[width] duration-150" style={{ width: `${zipProgress}%` }} />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleBatchRename}
                            disabled={isRenaming}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-xl text-xs font-semibold hover:bg-stone-50 transition-colors disabled:opacity-50"
                        >
                            {isRenaming ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                            Smart Rename All
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onRetry(selectedJobs.map(j => j.id))}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-stone-200 text-stone-600 rounded-lg text-xs font-semibold hover:bg-stone-50 transition-colors"
                            >
                                <RefreshCcw className="w-3.5 h-3.5" /> Re-run All
                            </button>
                            <button
                                onClick={async () => {
                                    const confirmed = await confirm({
                                        title: `Delete ${selectedJobs.length} Images`,
                                        message: `Are you sure? This cannot be undone.`,
                                        confirmLabel: 'Delete All',
                                        variant: 'danger',
                                    });
                                    if (confirmed) {
                                        onRemove(selectedJobs.map(j => j.id));
                                        onClose();
                                    }
                                }}
                                className="p-2.5 bg-white border border-stone-200 text-red-500 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors"
                                title="Delete all"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
                <ConfirmDialog />
            </aside>
        </>
    );
};
