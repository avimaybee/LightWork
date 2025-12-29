import React, { useState, useEffect } from 'react';
import { ImageJob } from '../types';
import { X, Sparkles, ScanEye, Wand2, Download, Copy, Trash2, RefreshCcw, CheckCircle2, Clipboard, Maximize2, AlertCircle, Terminal, FileText, Image as ImageIcon, BoxSelect, Edit3, CheckSquare, DownloadCloud, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { enhancePrompt, generateImageDescription, generateSmartFilename } from '../services/geminiService';
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
    const { ConfirmDialog, confirm } = useConfirmDialog();
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isAutoDrafting, setIsAutoDrafting] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [justCopied, setJustCopied] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const [isDownloadingZip, setIsDownloadingZip] = useState(false);
    const [zipProgress, setZipProgress] = useState<number | undefined>(undefined);

    // Responsive: detect screens < 1200px for drawer mode
    const isSmallScreen = useMediaQuery('(max-width: 1199px)');
    
    // Auto-collapse on small screens
    useEffect(() => {
        if (isSmallScreen && selectedJobs.length > 0) {
            setIsCollapsed(true);
        }
    }, [isSmallScreen, selectedJobs.length]);

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
    }, [selectedJobs.map(j => j.id).join(',')]);

    const describeAiError = (raw?: string) => {
        const msg = (raw || '').trim();
        const lower = msg.toLowerCase();

        if (!msg) {
            return {
                title: 'Processing Failed',
                detail: 'The AI request failed. Try again in a moment.',
                raw: undefined as string | undefined,
            };
        }

        const looksLikeSafety =
            lower.includes('safety') ||
            lower.includes('blocked') ||
            lower.includes('policy') ||
            lower.includes('content') && lower.includes('filter');

        if (looksLikeSafety) {
            return {
                title: 'Safety Filter Triggered',
                detail: 'Try rephrasing your prompt to avoid sensitive content, then retry.',
                raw: msg,
            };
        }

        const looksLikeRateLimit =
            lower.includes('rate limited') ||
            lower.includes('too many requests') ||
            lower.includes('429');

        if (looksLikeRateLimit) {
            return {
                title: 'Rate Limited',
                detail: 'The service is busy. Wait a moment, then retry.',
                raw: msg,
            };
        }

        const looksLikeNetwork =
            lower.includes('network') ||
            lower.includes('failed to fetch') ||
            lower.includes('timeout');

        if (looksLikeNetwork) {
            return {
                title: 'Network Error',
                detail: 'Check your connection and retry.',
                raw: msg,
            };
        }

        return {
            title: 'Processing Failed',
            detail: 'Retry the operation, or adjust your prompt and try again.',
            raw: msg,
        };
    };

    if (selectedJobs.length === 0) return null;

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
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
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
                {/* Collapsed Toggle Button - Only visible on small screens when collapsed */}
                {isSmallScreen && isCollapsed && (
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-stone-900 text-white p-3 rounded-l-xl shadow-lg hover:bg-stone-800 transition-colors"
                        title="Open Inspector"
                    >
                        <PanelRightClose className="w-5 h-5" />
                    </button>
                )}
                
                {/* Backdrop for drawer mode */}
                {isSmallScreen && !isCollapsed && (
                    <div 
                        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-20 animate-in fade-in duration-200"
                        onClick={() => setIsCollapsed(true)}
                    />
                )}
                
                <div className={`
                    ${isSmallScreen ? 'fixed right-0 top-0 bottom-0 z-30' : ''} 
                    ${isSmallScreen && isCollapsed ? 'translate-x-full' : 'translate-x-0'}
                    w-96 max-w-[90vw] h-full bg-[#FDFCFB] border-l border-stone-200 flex flex-col shadow-2xl z-30 transition-transform duration-300 ease-out font-sans
                `}>
                <div className="h-20 px-8 border-b border-stone-100 flex items-center justify-between shrink-0 bg-[#FDFCFB]">
                    <span className="font-bold text-xl text-stone-900 font-heading">Inspector</span>
                    <div className="flex items-center gap-1">
                        {isSmallScreen && (
                            <button 
                                onClick={() => setIsCollapsed(true)} 
                                className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-900 transition-colors"
                                title="Collapse Panel"
                            >
                                <PanelRightOpen className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-900 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Preview */}
                    <div className="space-y-4">
                        <div
                            className="aspect-square bg-white rounded-lg p-2 border border-stone-200 shadow-sm relative group cursor-zoom-in"
                            onClick={() => onZoom(job.resultUrl || job.thumbnailUrl)}
                        >
                            <div className="w-full h-full relative overflow-hidden rounded-sm">
                                <img src={job.resultUrl || job.thumbnailUrl} className="w-full h-full object-cover" alt="Preview" loading="lazy" decoding="async" />
                                <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/10 transition-colors flex items-center justify-center">
                                    <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 drop-shadow-md transform scale-95 group-hover:scale-100 transition-all" />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1 min-w-0">
                                <h3 className="text-sm font-bold text-stone-900 truncate font-sans" title={job.fileName}>{job.fileName}</h3>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${job.status === 'completed' ? 'bg-status-success-bg text-status-success-text' :
                                        job.status === 'error' ? 'bg-status-error-bg text-status-error-text' :
                                            (job.status === 'processing' || job.status === 'batch_processing') ? 'bg-status-processing-bg text-status-processing-text' :
                                                job.status === 'batch_pending' ? 'bg-status-warning-bg text-status-warning-text' :
                                                'bg-status-pending-bg text-status-pending-text'
                                        }`}>
                                        {job.status}
                                    </span>
                                </div>
                            </div>
                            <button onClick={handleSmartRename} disabled={isRenaming} className="p-2 text-stone-400 hover:text-clay-600 hover:bg-clay-50 rounded-lg transition-colors" title="Smart Rename">
                                {isRenaming ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {isAiFailed && aiError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-red-700 uppercase tracking-widest">{aiError.title}</div>
                                    <div className="text-xs text-red-700/90 font-medium leading-relaxed mt-1">{aiError.detail}</div>
                                    {aiError.raw && (
                                        <div className="text-[10px] text-red-700/70 font-medium mt-2 wrap-break-word">{aiError.raw}</div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => onRetry([job.id])}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-red-700 rounded-lg text-xs font-bold hover:bg-red-50 border border-red-200 hover:border-red-300 transition-colors"
                            >
                                <RefreshCcw className="w-3.5 h-3.5" /> Retry
                            </button>
                        </div>
                    )}

                    <hr className="border-stone-100" />

                    {/* Prompt */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-stone-400" />
                                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Adjustment Prompt</label>
                            </div>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => {
                                        if (job.localPrompt) {
                                            navigator.clipboard.writeText(job.localPrompt);
                                            setJustCopied(true);
                                            setTimeout(() => setJustCopied(false), 2000);
                                        }
                                    }} 
                                    disabled={!job.localPrompt} 
                                    className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-md transition-colors disabled:opacity-50" 
                                    title="Copy Prompt"
                                >
                                    {justCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={handleAutoDraft} disabled={isAutoDrafting} className="p-1.5 text-stone-400 hover:text-clay-600 hover:bg-clay-50 rounded-md transition-colors disabled:opacity-50" title="Auto-Draft">
                                    {isAutoDrafting ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <ScanEye className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={handleEnhance} disabled={isEnhancing || !job.localPrompt} className="p-1.5 text-stone-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors disabled:opacity-50" title="Magic Polish">
                                    {isEnhancing ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={job.localPrompt}
                            onChange={(e) => onUpdateJob(job.id, { localPrompt: e.target.value })}
                            placeholder="Describe specific changes for this image..."
                            className="w-full h-32 bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 resize-none font-medium leading-relaxed font-sans"
                        />
                    </div>

                    <hr className="border-stone-100" />

                    {/* Actions */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                            <FileText className="w-4 h-4 text-stone-300" />
                            Actions
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={downloadImage} disabled={!job.resultUrl} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-lg text-xs font-bold hover:bg-stone-800 transition-colors disabled:opacity-50 shadow-sm">
                                <Download className="w-3.5 h-3.5" /> Download
                            </button>
                            <button onClick={copyImage} disabled={!job.resultUrl} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-lg text-xs font-bold hover:border-stone-300 transition-colors disabled:opacity-50 shadow-sm">
                                {justCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Clipboard className="w-3.5 h-3.5" />} {justCopied ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {isUploadFailed ? (
                                <button onClick={() => onRetryUpload(job.id)} className="flex items-center justify-center gap-2 px-4 py-2 bg-stone-50 text-stone-600 rounded-lg text-xs font-bold hover:bg-stone-100 transition-colors border border-transparent hover:border-stone-200">
                                    <RefreshCcw className="w-3.5 h-3.5" /> Try Again
                                </button>
                            ) : (
                                <button onClick={() => onRetry([job.id])} className="flex items-center justify-center gap-2 px-4 py-2 bg-stone-50 text-stone-600 rounded-lg text-xs font-bold hover:bg-stone-100 transition-colors border border-transparent hover:border-stone-200">
                                    <RefreshCcw className="w-3.5 h-3.5" /> {isAiFailed ? 'Retry' : 'Re-run'}
                                </button>
                            )}
                            <button 
                                onClick={async () => { 
                                    const confirmed = await confirm({
                                        title: 'Delete Image',
                                        message: 'Are you sure you want to delete this image? This action cannot be undone.',
                                        confirmLabel: 'Delete',
                                        variant: 'danger',
                                    });
                                    if (confirmed) {
                                        onRemove([job.id]); 
                                        onClose(); 
                                    }
                                }} 
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 border border-stone-200 hover:border-red-100 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                        </div>
                    </div>
                </div>
                <ConfirmDialog />
            </div>
            </>
        );
    }

    // --- BATCH MODE ---
    const aiFailedIds = selectedJobs
        .filter(j => j.status === 'error' && j.errorMsg !== 'Upload failed')
        .map(j => j.id);

    const handleBatchDownload = async () => {
        const readyJobs = selectedJobs.filter(j => j.resultUrl);
        if (readyJobs.length === 0) return;

        if (isDownloadingZip) return;
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
                const resultUrl = j.resultUrl;
                if (!resultUrl) continue;

                // Fetch phase progress: 0..70
                setZipProgress(Math.round((i / total) * 70));

                if (resultUrl.startsWith('data:')) {
                    const base64 = resultUrl.split(',')[1] || '';
                    zip.file(getZipFileName(j), base64, { base64: true });
                } else {
                    const res = await fetch(resultUrl);
                    const blob = await res.blob();
                    zip.file(getZipFileName(j), blob);
                }
            }

            const content = await zip.generateAsync(
                { type: 'blob' },
                (metadata: { percent: number }) => {
                    // Zip generation phase: 70..100
                    const pct = 70 + (metadata.percent * 0.3);
                    setZipProgress(Math.round(pct));
                }
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
            // Add small delay between requests to avoid rate limits
            await new Promise(r => setTimeout(r, 500));
        }
        setIsRenaming(false);
    };

    const applyBatchPrompt = () => {
        selectedJobs.forEach(j => onUpdateJob(j.id, { localPrompt: batchPrompt }));
    };

    return (
        <>
            {/* Collapsed Toggle Button - Only visible on small screens when collapsed */}
            {isSmallScreen && isCollapsed && (
                <button
                    onClick={() => setIsCollapsed(false)}
                    className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-stone-900 text-white p-3 rounded-l-xl shadow-lg hover:bg-stone-800 transition-colors"
                    title="Open Inspector"
                >
                    <PanelRightClose className="w-5 h-5" />
                </button>
            )}
            
            {/* Backdrop for drawer mode */}
            {isSmallScreen && !isCollapsed && (
                <div 
                    className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-20 animate-in fade-in duration-200"
                    onClick={() => setIsCollapsed(true)}
                />
            )}
            
        <div className={`
            ${isSmallScreen ? 'fixed right-0 top-0 bottom-0 z-30' : ''} 
            ${isSmallScreen && isCollapsed ? 'translate-x-full' : 'translate-x-0'}
            w-96 max-w-[90vw] h-full bg-[#FDFCFB] border-l border-stone-200 flex flex-col shadow-2xl z-30 transition-transform duration-300 ease-out font-sans
        `}>
            <div className="h-20 px-8 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-900 text-[#FDFCFB]">
                <div className="flex items-center gap-3">
                    <BoxSelect className="w-5 h-5 text-clay-300" />
                    <span className="font-medium text-xl font-heading">{selectedJobs.length} Selected</span>
                </div>
                <div className="flex items-center gap-1">
                    {isSmallScreen && (
                        <button 
                            onClick={() => setIsCollapsed(true)} 
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Collapse Panel"
                        >
                            <PanelRightOpen className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Batch Visuals */}
                <div className="grid grid-cols-4 gap-2">
                    {selectedJobs.slice(0, 11).map(j => (
                        <div key={j.id} className="aspect-square bg-stone-100 rounded overflow-hidden relative border border-stone-200">
                            <img src={j.thumbnailUrl} className="w-full h-full object-cover opacity-80" alt="" loading="lazy" decoding="async" />
                            {j.status === 'completed' && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-tl shadow-sm" />}
                        </div>
                    ))}
                    {selectedJobs.length > 11 && (
                        <div className="aspect-square bg-stone-100 rounded flex items-center justify-center text-xs font-bold text-stone-400 border border-stone-200">
                            +{selectedJobs.length - 11}
                        </div>
                    )}
                </div>

                {/* Batch Prompt */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Edit3 className="w-4 h-4 text-stone-400" />
                            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Batch Adjustment</label>
                        </div>
                        <button onClick={applyBatchPrompt} disabled={!batchPrompt} className="text-xs font-bold text-clay-600 hover:text-clay-700 disabled:opacity-50">
                            Apply to All
                        </button>
                    </div>
                    <textarea
                        value={batchPrompt}
                        onChange={(e) => setBatchPrompt(e.target.value)}
                        placeholder="Write instruction for all selected items..."
                        className="w-full h-24 bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 resize-none font-medium font-sans"
                    />
                </div>

                <hr className="border-stone-100" />

                {/* Batch Actions */}
                <div className="space-y-4">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-stone-300" />
                        Bulk Actions
                    </label>

                    {aiFailedIds.length > 0 && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-red-700 uppercase tracking-widest">{aiFailedIds.length} Failed</div>
                                    <div className="text-xs text-red-700/90 font-medium leading-relaxed mt-1">Some selected items failed AI generation. You can retry just the failed ones.</div>
                                </div>
                            </div>
                            <div className="pt-3">
                                <button
                                    onClick={() => onRetry(aiFailedIds)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-red-700 rounded-lg text-xs font-bold hover:bg-red-50 border border-red-200 hover:border-red-300 transition-colors"
                                >
                                    <RefreshCcw className="w-3.5 h-3.5" /> Retry Failed
                                </button>
                            </div>
                        </div>
                    )}

                    <button onClick={handleBatchRename} disabled={isRenaming} className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-stone-200 text-stone-700 rounded-xl text-xs font-bold hover:border-clay-300 hover:bg-clay-50/10 transition-all text-left disabled:opacity-50 shadow-sm group">
                        {isRenaming ? <RefreshCcw className="w-5 h-5 animate-spin text-clay-500" /> : <Wand2 className="w-5 h-5 text-clay-500" />}
                        <div className="flex flex-col">
                            <span className="text-stone-900 font-heading">Smart Rename All</span>
                            <span className="text-[10px] text-stone-400 font-normal">Generate consistent filenames</span>
                        </div>
                    </button>

                    <button onClick={handleBatchDownload} disabled={isDownloadingZip} className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-stone-200 text-stone-700 rounded-xl text-xs font-bold hover:border-stone-300 hover:bg-stone-50 transition-all text-left shadow-sm disabled:opacity-50">
                        {isDownloadingZip ? (
                            <RefreshCcw className="w-5 h-5 text-stone-400 animate-spin" />
                        ) : (
                            <DownloadCloud className="w-5 h-5 text-stone-400" />
                        )}
                        <div className="flex flex-col">
                            <span className="text-stone-900 font-heading">{isDownloadingZip ? 'Preparing...' : 'Download All'}</span>
                            <span className="text-[10px] text-stone-400 font-normal">Save processed images as ZIP</span>
                        </div>
                    </button>

                    {typeof zipProgress === 'number' && (
                        <div className="px-4">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Preparing ZIP</span>
                                <span className="text-[10px] font-bold text-stone-600 tabular-nums">{zipProgress}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
                                <div className="h-full bg-clay-500 transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(100, zipProgress))}%` }} />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button onClick={() => onRetry(selectedJobs.map(j => j.id))} className="flex items-center justify-center gap-2 px-4 py-2 bg-stone-50 text-stone-600 rounded-lg text-xs font-bold hover:bg-stone-100 transition-colors border border-transparent hover:border-stone-200">
                            <RefreshCcw className="w-3.5 h-3.5" /> Re-run
                        </button>
                        <button 
                            onClick={async () => { 
                                const confirmed = await confirm({
                                    title: `Delete ${selectedJobs.length} Images`,
                                    message: `Are you sure you want to delete ${selectedJobs.length} selected images? This action cannot be undone.`,
                                    confirmLabel: 'Delete All',
                                    variant: 'danger',
                                });
                                if (confirmed) {
                                    onRemove(selectedJobs.map(j => j.id)); 
                                    onClose(); 
                                }
                            }} 
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 border border-stone-200 hover:border-red-100 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                    </div>
                </div>
            </div>
            <ConfirmDialog />
        </div>
        </>
    );
};
