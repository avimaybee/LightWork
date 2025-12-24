import React, { useState, useEffect } from 'react';
import { ImageJob } from '../types';
import { X, Sparkles, ScanEye, Wand2, Download, Copy, Trash2, RefreshCcw, CheckCircle2, Clipboard, Maximize2, AlertCircle, Terminal, FileText, Image as ImageIcon, BoxSelect, Edit3, CheckSquare, DownloadCloud } from 'lucide-react';
import { enhancePrompt, generateImageDescription, generateSmartFilename } from '../services/geminiService';
// @ts-ignore
import JSZip from 'jszip';

interface InspectorProps {
    selectedJobs: ImageJob[];
    onClose: () => void;
    onUpdateJob: (id: string, updates: Partial<ImageJob>) => void;
    onRemove: (ids: string[]) => void;
    onRetry: (ids: string[]) => void;
    onZoom: (url: string) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
    selectedJobs,
    onClose,
    onUpdateJob,
    onRemove,
    onRetry,
    onZoom
}) => {
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isAutoDrafting, setIsAutoDrafting] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [justCopied, setJustCopied] = useState(false);

    // Batch State
    const [batchPrompt, setBatchPrompt] = useState('');

    // Reset local states when selection changes
    useEffect(() => {
        setIsEnhancing(false);
        setIsAutoDrafting(false);
        setIsRenaming(false);
        setJustCopied(false);
        setBatchPrompt('');
    }, [selectedJobs.map(j => j.id).join(',')]);

    if (selectedJobs.length === 0) return null;

    // --- SINGLE MODE ---
    if (selectedJobs.length === 1) {
        const job = selectedJobs[0];

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
            if (!job.file) return; // Need file for client-side compression
            setIsAutoDrafting(true);
            const response = await generateImageDescription(job.file);
            if (response.success && response.result) {
                onUpdateJob(job.id, { localPrompt: response.result });
            }
            setIsAutoDrafting(false);
        };

        const handleSmartRename = async () => {
            if (!job.file) return; // Need file for client-side compression
            setIsRenaming(true);
            const response = await generateSmartFilename(job.file);
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
            <div className="w-96 h-full bg-[#FDFCFB] border-l border-stone-200 flex flex-col shadow-2xl z-30 animate-in slide-in-from-right duration-300 font-sans">
                <div className="h-20 px-8 border-b border-stone-100 flex items-center justify-between shrink-0 bg-[#FDFCFB]">
                    <span className="font-bold text-xl text-stone-900 font-heading">Inspector</span>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-900 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Preview */}
                    <div className="space-y-4">
                        <div
                            className="aspect-square bg-white rounded-lg p-2 border border-stone-200 shadow-sm relative group cursor-zoom-in"
                            onClick={() => onZoom(job.resultUrl || job.thumbnailUrl)}
                        >
                            <div className="w-full h-full relative overflow-hidden rounded-sm">
                                <img src={job.resultUrl || job.thumbnailUrl} className="w-full h-full object-cover" alt="Preview" />
                                <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/10 transition-colors flex items-center justify-center">
                                    <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 drop-shadow-md transform scale-95 group-hover:scale-100 transition-all" />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1 min-w-0">
                                <h3 className="text-sm font-bold text-stone-900 truncate font-sans" title={job.fileName}>{job.fileName}</h3>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${job.status === 'completed' ? 'bg-green-100 text-green-700' :
                                            job.status === 'error' ? 'bg-red-100 text-red-700' :
                                                job.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-stone-100 text-stone-500'
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

                    <hr className="border-stone-100" />

                    {/* Prompt */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-stone-400" />
                                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Adjustment Prompt</label>
                            </div>
                            <div className="flex gap-1">
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
                            <button onClick={() => onRetry([job.id])} className="flex items-center justify-center gap-2 px-4 py-2 bg-stone-50 text-stone-600 rounded-lg text-xs font-bold hover:bg-stone-100 transition-colors border border-transparent hover:border-stone-200">
                                <RefreshCcw className="w-3.5 h-3.5" /> Re-run
                            </button>
                            <button onClick={() => { onRemove([job.id]); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 border border-stone-200 hover:border-red-100 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- BATCH MODE ---
    const handleBatchDownload = async () => {
        const readyJobs = selectedJobs.filter(j => j.resultUrl);
        if (readyJobs.length === 0) return;
        const zip = new JSZip();
        readyJobs.forEach(j => {
            if (j.resultUrl) {
                zip.file(`LightWork_${j.fileName.split('.')[0]}_processed.png`, j.resultUrl.split(',')[1], { base64: true });
            }
        });
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `LightWork_Batch_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleBatchRename = async () => {
        setIsRenaming(true);
        for (const job of selectedJobs) {
            if (!job.file) continue; // Skip jobs without file
            const response = await generateSmartFilename(job.file);
            if (response.success && response.result) {
                const ext = job.fileName.split('.').pop() || 'png';
                const cleanName = response.result.replace(/\.[^/.]+$/, "");
                onUpdateJob(job.id, { fileName: `${cleanName}.${ext}` });
            }
            // Add small delay between requests to avoid rate limits
            await new Promise(r => setTimeout(r, 2000));
        }
        setIsRenaming(false);
    };

    const applyBatchPrompt = () => {
        selectedJobs.forEach(j => onUpdateJob(j.id, { localPrompt: batchPrompt }));
    };

    return (
        <div className="w-96 h-full bg-[#FDFCFB] border-l border-stone-200 flex flex-col shadow-2xl z-30 animate-in slide-in-from-right duration-300 font-sans">
            <div className="h-20 px-8 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-900 text-[#FDFCFB]">
                <div className="flex items-center gap-3">
                    <BoxSelect className="w-5 h-5 text-clay-300" />
                    <span className="font-medium text-xl font-heading">{selectedJobs.length} Selected</span>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Batch Visuals */}
                <div className="grid grid-cols-4 gap-2">
                    {selectedJobs.slice(0, 11).map(j => (
                        <div key={j.id} className="aspect-square bg-stone-100 rounded overflow-hidden relative border border-stone-200">
                            <img src={j.thumbnailUrl} className="w-full h-full object-cover opacity-80" alt="" />
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

                    <button onClick={handleBatchRename} disabled={isRenaming} className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-stone-200 text-stone-700 rounded-xl text-xs font-bold hover:border-clay-300 hover:bg-clay-50/10 transition-all text-left disabled:opacity-50 shadow-sm group">
                        {isRenaming ? <RefreshCcw className="w-5 h-5 animate-spin text-clay-500" /> : <Wand2 className="w-5 h-5 text-clay-500" />}
                        <div className="flex flex-col">
                            <span className="text-stone-900 font-heading">Smart Rename All</span>
                            <span className="text-[10px] text-stone-400 font-normal">Generate consistent filenames</span>
                        </div>
                    </button>

                    <button onClick={handleBatchDownload} className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-stone-200 text-stone-700 rounded-xl text-xs font-bold hover:border-stone-300 hover:bg-stone-50 transition-all text-left shadow-sm">
                        <DownloadCloud className="w-5 h-5 text-stone-400" />
                        <div className="flex flex-col">
                            <span className="text-stone-900 font-heading">Download All</span>
                            <span className="text-[10px] text-stone-400 font-normal">Save processed images as ZIP</span>
                        </div>
                    </button>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button onClick={() => onRetry(selectedJobs.map(j => j.id))} className="flex items-center justify-center gap-2 px-4 py-2 bg-stone-50 text-stone-600 rounded-lg text-xs font-bold hover:bg-stone-100 transition-colors border border-transparent hover:border-stone-200">
                            <RefreshCcw className="w-3.5 h-3.5" /> Re-run
                        </button>
                        <button onClick={() => { onRemove(selectedJobs.map(j => j.id)); onClose(); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 border border-stone-200 hover:border-red-100 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
