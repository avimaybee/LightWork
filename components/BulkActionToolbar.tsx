import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Download, PlayCircle, XCircle, CheckCircle, RotateCcw, X } from 'lucide-react';
import { ImageJob } from '../types';

interface BulkActionToolbarProps {
    selectedJobs: ImageJob[];
    onDelete: () => void;
    onDownload: () => void;
    onProcess: () => void;
    onClearSelection: () => void;
    onResetStatus: () => void;
    isProcessing: boolean;
}

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
    selectedJobs,
    onDelete,
    onDownload,
    onProcess,
    onClearSelection,
    onResetStatus,
    isProcessing
}) => {
    const count = selectedJobs.length;
    
    // Count by status
    const completedCount = selectedJobs.filter(j => j.status === 'complete').length;
    const queuedCount = selectedJobs.filter(j => j.status === 'queued' || j.status === 'paused').length;
    const errorCount = selectedJobs.filter(j => j.status === 'error').length;
    
    // Show download only if there are completed jobs
    const canDownload = completedCount > 0;
    // Show process only if there are queued jobs
    const canProcess = queuedCount > 0 && !isProcessing;
    // Show reset only if there are errors
    const canReset = errorCount > 0;

    return (
        <AnimatePresence>
            {count > 1 && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
                >
                    <div className="bg-stone-900 text-white rounded-2xl shadow-2xl px-2 py-2 flex items-center gap-1">
                        {/* Selection count */}
                        <div className="px-4 py-2 border-r border-stone-700 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-clay-400" />
                            <span className="font-medium tabular-nums">{count} selected</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 px-2">
                            {/* Process selected */}
                            {canProcess && (
                                <button
                                    onClick={onProcess}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-stone-800 transition-colors text-sm"
                                    title="Process selected images"
                                >
                                    <PlayCircle className="w-4 h-4 text-emerald-400" />
                                    <span>Process</span>
                                </button>
                            )}

                            {/* Download selected */}
                            {canDownload && (
                                <button
                                    onClick={onDownload}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-stone-800 transition-colors text-sm"
                                    title="Download selected images"
                                >
                                    <Download className="w-4 h-4 text-blue-400" />
                                    <span>Download ({completedCount})</span>
                                </button>
                            )}

                            {/* Reset errors */}
                            {canReset && (
                                <button
                                    onClick={onResetStatus}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-stone-800 transition-colors text-sm"
                                    title="Retry failed images"
                                >
                                    <RotateCcw className="w-4 h-4 text-amber-400" />
                                    <span>Retry ({errorCount})</span>
                                </button>
                            )}

                            {/* Delete selected */}
                            <button
                                onClick={onDelete}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-500/20 text-red-400 transition-colors text-sm"
                                title="Delete selected images"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                            </button>
                        </div>

                        {/* Clear selection */}
                        <div className="border-l border-stone-700 pl-2">
                            <button
                                onClick={onClearSelection}
                                className="p-2 rounded-xl hover:bg-stone-800 transition-colors"
                                title="Clear selection (Escape)"
                            >
                                <X className="w-4 h-4 text-stone-400" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BulkActionToolbar;
