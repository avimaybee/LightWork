import { Loader2, FileUp } from 'lucide-react';

interface UploadQueueProps {
    current: number;
    total: number;
    stage: 'optimizing' | 'uploading';
}

export function UploadQueue({ current, total, stage }: UploadQueueProps) {
    const percentage = Math.round((current / total) * 100);
    const isUploading = stage === 'uploading';

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-6 fade-in duration-500">
            <div className="bg-white/90 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl shadow-2xl p-4 w-80">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-canvas)] flex items-center justify-center relative">
                            {isUploading ? (
                                <FileUp className="w-5 h-5 text-[var(--color-accent)] animate-bounce" />
                            ) : (
                                <Loader2 className="w-5 h-5 text-[var(--color-ink-sub)] animate-spin" />
                            )}

                            {/* Detailed Progress Ring could go here, using simple percentage for now */}
                        </div>
                        <div>
                            <h4 className="font-display font-bold text-sm text-[var(--color-ink)]">
                                {isUploading ? 'Uploading Assets' : 'Optimizing Images'}
                            </h4>
                            <p className="text-[10px] font-mono text-[var(--color-ink-sub)] uppercase tracking-wider">
                                {current} of {total} processed
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-medium text-[var(--color-ink-sub)]">
                        <span>Progress</span>
                        <span>{percentage}%</span>
                    </div>
                    <div className="h-2 bg-[var(--color-canvas)] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[var(--color-accent)] transition-all duration-300 ease-out"
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                </div>

                {isUploading && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border)]/50 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin text-[var(--color-accent)]" />
                        <span className="text-[10px] text-[var(--color-ink-sub)]">
                            Syncing with Cloudflare R2...
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
