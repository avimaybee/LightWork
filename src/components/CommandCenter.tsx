import { Rocket, Download, Square, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { JobStatus } from '@/lib/api';

interface CommandCenterProps {
    status: JobStatus | 'READY' | 'UPLOADING';
    totalImages: number;
    completedImages: number;
    failedImages: number;
    onStart: () => void;
    onCancel: () => void;
    onDownload: () => void;
    disabled?: boolean;
    className?: string;
}

export function CommandCenter({
    status,
    totalImages,
    completedImages,
    failedImages,
    onStart,
    onCancel,
    onDownload,
    disabled = false,
    className,
}: CommandCenterProps) {
    const progress = totalImages > 0
        ? Math.round(((completedImages + failedImages) / totalImages) * 100)
        : 0;

    const isProcessing = status === 'PROCESSING' || status === 'UPLOADING';
    const isComplete = status === 'COMPLETED';
    const isFailed = status === 'FAILED';
    const canStart = status === 'READY' || status === 'PENDING';

    // "Permian-style" Technical Data
    const remainingImages = totalImages - completedImages - failedImages;
    const etcMinutes = Math.ceil((remainingImages * 10) / 60);

    return (
        <div className={cn('fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4', className)}>
            <div className={cn(
                'relative flex flex-col gap-0 overflow-hidden',
                // Shape & Material
                'rounded-[32px] bg-[var(--color-foreground)] border-2 border-[var(--color-line)]',
                'shadow-[0px_12px_32px_-8px_rgba(0,0,0,0.4)]',
                'transition-all duration-300 ease-out',
                isProcessing && 'ring-4 ring-[var(--color-primary)]/20'
            )}>

                {/* Top Status Bar (Technical) */}
                <div className="flex items-center justify-between px-6 py-3 bg-black/20 border-b-2 border-[var(--color-line)]/10">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            isProcessing ? "bg-[var(--color-primary)] animate-pulse" :
                                isComplete ? "bg-[var(--color-accent)]" : "bg-white/20"
                        )} />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/40">
                            {status === 'PENDING' ? 'SYSTEM READY' : status}
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-mono font-bold text-white/30">
                        <span>IMG: {totalImages}</span>
                        <span>REM: {remainingImages}</span>
                    </div>
                </div>

                {/* Progress Visualizer */}
                {isProcessing && (
                    <div className="relative h-1 w-full bg-[#222]">
                        <div
                            className="absolute top-0 left-0 h-full bg-[var(--color-primary)] shadow-[0_0_10px_var(--color-primary)] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                {/* Main Action Area */}
                <div className="p-4 flex items-center gap-3">
                    {/* Status Feedback Area */}
                    {(isComplete || isFailed) ? (
                        <div className={cn(
                            "flex-1 flex items-center gap-3 px-4 h-14 rounded-2xl",
                            isComplete ? "bg-[var(--color-mint)] text-[#1A1A1A]" : "bg-red-500 text-white"
                        )}>
                            {isComplete ? <Rocket className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                            <div className="flex flex-col leading-none">
                                <span className="font-display font-bold text-lg">
                                    {isComplete ? 'BATCH DONE' : 'BATCH FAILED'}
                                </span>
                                <span className="font-mono text-[10px] uppercase opacity-70">
                                    {completedImages} Processed • {failedImages} Errors
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="hidden md:flex flex-col justify-center px-4 h-14 flex-1">
                            <span className="font-display font-bold text-white text-lg leading-none uppercase tracking-tight">
                                {isProcessing ? 'Processing...' : 'Command Center'}
                            </span>
                            <span className="font-mono text-[10px] text-white/40 uppercase mt-1">
                                {isProcessing ? `~${etcMinutes} MIN REMAINING` : 'READY FOR INPUT'}
                            </span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {canStart && (
                            <Button
                                onClick={onStart}
                                disabled={disabled || totalImages === 0}
                                className="h-14 px-8 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] border-none hover:bg-white hover:text-[var(--color-foreground)] hover:scale-105 shadow-[0_0_20px_rgba(255,122,47,0.25)] hover:shadow-[0_0_30px_rgba(255,122,47,0.35)] transition-all rounded-2xl font-display text-lg tracking-normal"
                            >
                                <Rocket className="w-5 h-5 mr-2" />
                                LAUNCH
                            </Button>
                        )}

                        {isProcessing && (
                            <Button
                                onClick={onCancel}
                                variant="destructive"
                                className="h-14 w-14 p-0 rounded-2xl bg-[#333] border border-[#444] text-white hover:bg-red-500 hover:border-red-500"
                            >
                                <Square className="w-5 h-5 fill-current" />
                            </Button>
                        )}

                        {(isComplete || isFailed) && completedImages > 0 && (
                            <Button
                                onClick={onDownload}
                                className="h-14 px-8 bg-white text-[var(--color-foreground)] border-none hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-foreground)] hover:scale-105 rounded-2xl font-display text-lg"
                            >
                                <Download className="w-5 h-5 mr-2" />
                                SAVE ALL
                            </Button>
                        )}
                    </div>
                </div>

                {/* Decorative Tech Lines */}
                <div className="absolute top-0 right-8 w-px h-full bg-[#333]" />
                <div className="absolute bottom-0 left-8 w-px h-8 bg-[#333]" />
            </div>
        </div>
    );
}
