import { X, MessageSquare, Check, AlertCircle, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getImageUrl, type ImageStatus } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

export type StagingImage = {
    id: string;
    status: ImageStatus;
    original_filename: string | null;
    localPreview?: string;
    specific_prompt?: string | null;
    error_message?: string | null;
};

interface StagingGridProps {
    images: StagingImage[];
    onRemove?: (id: string) => void;
    onEditPrompt?: (id: string) => void;
    showStatus?: boolean;
    className?: string;
}

const statusConfig = {
    PENDING: { icon: Clock, label: 'WAIT', bg: 'bg-[var(--color-muted)]', text: 'text-[var(--color-foreground)]' },
    PROCESSING: { icon: Loader2, label: 'BUSY', bg: 'bg-[var(--color-primary)]', text: 'text-[var(--color-foreground)]' },
    COMPLETED: { icon: Check, label: 'DONE', bg: 'bg-[var(--color-mint)]', text: 'text-[var(--color-foreground)]' },
    FAILED: { icon: AlertCircle, label: 'ERR', bg: 'bg-red-500', text: 'text-white' },
    RETRY_LATER: { icon: Clock, label: 'RETRY', bg: 'bg-yellow-400', text: 'text-black' },
};

export function StagingGrid({
    images,
    onRemove,
    onEditPrompt,
    showStatus = false,
    className,
}: StagingGridProps) {
    if (images.length === 0) return null;

    return (
        <div className={cn('space-y-6', className)}>
            <div className="flex items-center justify-between pb-4 border-b-2 border-dashed border-black/10">
                <h3 className="font-display font-bold text-xl text-black">
                    Staging Area <span className="ml-2 text-sm font-mono text-black/50">[{images.length}]</span>
                </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {images.map((image, index) => {
                    const status = statusConfig[image.status];
                    const StatusIcon = status?.icon || Clock;
                    const imageUrl = image.localPreview || (image.id ? getImageUrl(image.id, 'original') : '');

                    return (
                        <div
                            key={image.id || index}
                            className={cn(
                                'group relative aspect-[4/5] p-2 bg-white',
                                'rounded-[20px] border-2 border-[var(--color-line)]',
                                'shadow-[4px_4px_0px_0px_var(--color-line)]',
                                'transition-all duration-300 hover:-translate-y-2 hover:shadow-[8px_8px_0px_0px_var(--color-line)]'
                            )}
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {/* Polaroid Image Area */}
                            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-[var(--color-muted)] border border-[var(--color-line)]/10">
                                {imageUrl && (
                                    <img
                                        src={imageUrl}
                                        alt={image.original_filename || `Image ${index + 1}`}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        loading="lazy"
                                    />
                                )}

                                {/* Overlay Actions */}
                                <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[2px]">
                                    {onEditPrompt && image.status === 'PENDING' && (
                                        <button
                                            onClick={() => onEditPrompt(image.id)}
                                            className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                                        >
                                            <MessageSquare className="w-5 h-5" />
                                        </button>
                                    )}
                                    {onRemove && image.status === 'PENDING' && (
                                        <button
                                            onClick={() => onRemove(image.id)}
                                            className="w-10 h-10 rounded-xl bg-red-500 border-2 border-black flex items-center justify-center hover:scale-110 transition-transform shadow-sm text-white"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Caption Area */}
                            <div className="mt-3 px-1 flex items-center justify-between">
                                <span className="font-mono text-[10px] font-bold truncate max-w-[80px] text-[var(--color-text-muted)]">
                                    {image.original_filename}
                                </span>

                                {showStatus && (
                                    <Badge
                                        variant="default"
                                        className={cn(
                                            "h-5 px-1.5 rounded-md border-black bg-white text-[9px] tracking-wider",
                                            status.bg, status.text
                                        )}
                                    >
                                        <StatusIcon className={cn("w-3 h-3 mr-1", image.status === 'PROCESSING' && "animate-spin")} />
                                        {status.label}
                                    </Badge>
                                )}
                            </div>

                            {/* Prompt Indicator Sticker */}
                            {image.specific_prompt && (
                                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--color-yellow)] border-2 border-[var(--color-line)] flex items-center justify-center z-10 shadow-sm" title="Custom Prompt Active">
                                    <MessageSquare className="w-3 h-3 text-black" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
