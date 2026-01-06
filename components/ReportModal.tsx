import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Download, Loader2, RefreshCw } from 'lucide-react';
import { Project } from '../types';
import { generateReportBlob, generateProjectPdfReport, ReportOptions } from '../services/pdfReport';
import { createPortal } from 'react-dom';

interface ReportModalProps {
    project: Project;
    isOpen: boolean;
    onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ project, isOpen, onClose }) => {
    const [title, setTitle] = useState(`Report: ${project.name}`);
    const [subtitle, setSubtitle] = useState('');
    const [notes, setNotes] = useState('');
    const [includePrompt, setIncludePrompt] = useState(true);
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Initial Setup
    useEffect(() => {
        if (isOpen) {
            setTitle(`Report: ${project.name}`);
            setSubtitle(`Generated on ${new Date().toLocaleDateString()}`);
            setNotes('');
            updatePreview();
        } else {
            setPdfBlobUrl(null);
        }
    }, [isOpen, project]);

    const updatePreview = async () => {
        setIsGenerating(true);
        try {
            const options: ReportOptions = {
                title,
                subtitle,
                notes,
                includeModulePrompt: includePrompt,
            };
            const url = await generateReportBlob(project, options);
            setPdfBlobUrl(url);
        } catch (error) {
            console.error("Preview generation failed", error);
        } finally {
            setIsGenerating(false);
        }
    };

    // Debounced update for text fields
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            updatePreview();
        }, 800);
        return () => clearTimeout(timer);
    }, [title, subtitle, notes, includePrompt]);

    const handleDownload = async () => {
        await generateProjectPdfReport(project, {
            title,
            subtitle,
            notes,
            includeModulePrompt: includePrompt
        });
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
                onClick={onClose}
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#FDFCFB] rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden relative border border-stone-200"
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Left: Settings */}
                <div className="w-1/3 min-w-[320px] border-r border-stone-200 bg-stone-50/50 flex flex-col">
                    <div className="p-6 border-b border-stone-200 bg-white">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                                <FileText className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-heading font-bold text-stone-900">Report Builder</h2>
                        </div>
                        <p className="text-sm text-stone-500 pl-1">Customize your PDF export</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Report Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all shadow-sm"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Subtitle</label>
                            <input
                                type="text"
                                value={subtitle}
                                onChange={(e) => setSubtitle(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all shadow-sm"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Executive Summary / Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={6}
                                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all shadow-sm resize-none"
                                placeholder="Add an introduction or summary specific to this collection..."
                            />
                        </div>

                        <div className="pt-4 border-t border-stone-200">
                            <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-white transition-colors cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={includePrompt}
                                    onChange={(e) => setIncludePrompt(e.target.checked)}
                                    className="mt-0.5"
                                />
                                <div className="space-y-0.5">
                                    <span className="text-sm font-semibold text-stone-900 block">Include System Instructions</span>
                                    <span className="text-xs text-stone-500 block">Adds the module prompt to the report cover page.</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="p-6 border-t border-stone-200 bg-white">
                        <button
                            onClick={handleDownload}
                            className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 active:scale-95"
                        >
                            <Download className="w-4 h-4" />
                            Download PDF
                        </button>
                    </div>
                </div>

                {/* Right: Preview */}
                <div className="flex-1 bg-stone-200/50 p-8 flex flex-col items-center justify-center relative overflow-hidden">
                    {/* Toolbar */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-full px-4 py-1.5 shadow-sm border border-stone-200 text-xs font-medium text-stone-500 flex items-center gap-2">
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Updating Preview...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-3 h-3" />
                                Live Preview
                            </>
                        )}
                    </div>

                    <div className="w-full h-full flex items-center justify-center">
                        {pdfBlobUrl ? (
                            <iframe
                                src={`${pdfBlobUrl}#toolbar=0&view=FitH`}
                                className="w-full h-full rounded-lg shadow-2xl bg-white"
                                title="PDF Preview"
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-3 text-stone-400">
                                <Loader2 className="w-8 h-8 animate-spin" />
                                <span>Generating Preview...</span>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>,
        document.body
    );
};
