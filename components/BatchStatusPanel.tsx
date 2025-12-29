import React, { useEffect, useRef, useState } from 'react';
import { Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { BatchJob } from '../types';

interface BatchStatusPanelProps {
    onBatchComplete?: (batchId: string) => void;
}

export function BatchStatusPanel({ onBatchComplete }: BatchStatusPanelProps) {
    const [batches, setBatches] = useState<BatchJob[]>([]);
    const [loading, setLoading] = useState(true);
    const notifiedCompleteRef = useRef<Set<string>>(new Set());

    // Initial fetch and polling
    useEffect(() => {
        let isCancelled = false;

        const reconcileAndRefresh = async () => {
            const activeBatches = (await api.getActiveBatches()) as BatchJob[];

            // Reconcile each batch by calling the status endpoint.
            // This triggers server-side Gemini polling/import when the user returns.
            const reconciled: BatchJob[] = [];
            for (const batch of activeBatches) {
                const status = (await api.getBatchStatus(batch.id)) as BatchJob | null;
                const effective = status || batch;
                reconciled.push(effective);

                const doneCount = (effective.completedCount || 0) + (effective.failedCount || 0);
                const isFinalized = !!effective.completedAt || (effective.requestCount > 0 && doneCount >= effective.requestCount);
                const terminal = effective.status === 'succeeded' || effective.status === 'failed' || effective.status === 'cancelled';

                if (terminal && isFinalized && !notifiedCompleteRef.current.has(effective.id)) {
                    notifiedCompleteRef.current.add(effective.id);
                    onBatchComplete?.(effective.id);
                }
            }

            if (isCancelled) return;
            setBatches(reconciled.filter(b => !b.completedAt));
            setLoading(false);
        };

        reconcileAndRefresh();

        // Poll every 30 seconds
        const interval = setInterval(reconcileAndRefresh, 30000);

        return () => {
            isCancelled = true;
            clearInterval(interval);
        };
    }, [onBatchComplete]);

    // Manual refresh for a specific batch
    const refreshBatch = async (batchId: string) => {
        const status = await api.getBatchStatus(batchId);
        if (status) {
            setBatches(prev => prev.map(b => b.id === batchId ? status : b));
            const doneCount = (status.completedCount || 0) + (status.failedCount || 0);
            const isFinalized = !!status.completedAt || (status.requestCount > 0 && doneCount >= status.requestCount);
            if ((status.status === 'succeeded' || status.status === 'failed' || status.status === 'cancelled') && isFinalized) {
                onBatchComplete?.(batchId);
            }
        }
    };

    if (loading) return null;
    if (batches.length === 0) return null;

    return (
        <div className="fixed bottom-28 right-4 z-50 w-80 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                <h3 className="text-sm font-medium text-stone-700">Batch Processing</h3>
                <span className="text-xs text-stone-400">{batches.length} active</span>
            </div>

            <div className="max-h-64 overflow-y-auto">
                {batches.map(batch => (
                    <BatchItem
                        key={batch.id}
                        batch={batch}
                        onRefresh={() => refreshBatch(batch.id)}
                    />
                ))}
            </div>
        </div>
    );
}

function BatchItem({ batch, onRefresh }: { batch: BatchJob; onRefresh: () => void }) {
    const doneCount = (batch.completedCount || 0) + (batch.failedCount || 0);
    const progress = batch.requestCount > 0
        ? Math.round((doneCount / batch.requestCount) * 100)
        : 0;

    const statusConfig = {
        pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Pending' },
        submitted: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Submitted' },
        running: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Processing' },
        succeeded: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Complete' },
        failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Failed' },
        cancelled: { icon: XCircle, color: 'text-stone-500', bg: 'bg-stone-50', label: 'Cancelled' }
    };

    const config = statusConfig[batch.status] || statusConfig.pending;
    const Icon = config.icon;
    const isAnimating = batch.status === 'submitted' || batch.status === 'running';

    return (
        <div className="px-4 py-3 border-b border-stone-100 last:border-b-0">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`p-1 rounded-md ${config.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${config.color} ${isAnimating ? 'animate-spin' : ''}`} />
                    </div>
                    <span className="text-xs font-medium text-stone-700 truncate max-w-[140px]">
                        {batch.displayName}
                    </span>
                </div>
                <button
                    onClick={onRefresh}
                    className="p-1 text-stone-400 hover:text-stone-600 rounded transition-colors"
                    title="Refresh status"
                >
                    <RefreshCw className="w-3 h-3" />
                </button>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-1.5">
                <div
                    className={`h-full transition-all duration-500 ${batch.status === 'succeeded' ? 'bg-emerald-500' :
                            batch.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="flex items-center justify-between text-[10px] text-stone-400">
                <span>{doneCount}/{batch.requestCount} images</span>
                <span className={config.color}>{config.label}</span>
            </div>

            {batch.failedCount > 0 && (
                <div className="mt-1 text-[10px] text-red-500">
                    {batch.failedCount} failed
                </div>
            )}
        </div>
    );
}
