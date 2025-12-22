import * as React from 'react';
import { X, MessageSquare, Check, AlertCircle, Loader2, Clock, Trash2, CheckSquare, Square, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getImageUrl, type ImageStatus } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type StagingImage = {
    id: string;
    status: ImageStatus;
    original_filename: string | null;
    localPreview?: string;
    specific_prompt?: string | null;
    error_message?: string | null;
    thumbnail_key?: string | null;
};

interface StagingGridProps {
    images: StagingImage[];
    onRemove?: (id: string) => void;
    onRemoveMultiple?: (ids: string[]) => void;
    onClearAll?: () => void;
    onEditPrompt?: (id: string) => void;
    onBulkEditPrompt?: (ids: string[]) => void;
    onView?: (id: string) => void;
    showStatus?: boolean;
    className?: string;
    disabled?: boolean;
}

const statusConfig = {
    PENDING: { icon: Clock, label: 'WAIT', bg: 'bg-muted', text: 'text-foreground' },
    PROCESSING: { icon: Loader2, label: 'BUSY', bg: 'bg-accent-sub', text: 'text-foreground' },
    COMPLETED: { icon: Check, label: 'DONE', bg: 'bg-secondary', text: 'text-foreground' },
    FAILED: { icon: AlertCircle, label: 'ERR', bg: 'bg-red-500', text: 'text-white' },
    RETRY_LATER: { icon: Clock, label: 'RETRY', bg: 'bg-secondary', text: 'text-foreground' },
};

export function StagingGrid({
    images,
    onRemove,
    onRemoveMultiple,
    onClearAll,
    onEditPrompt,
    onBulkEditPrompt,
    onView,
    showStatus = false,
    className,
    disabled = false,
}: StagingGridProps) {
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

    if (images.length === 0) return null;

    const toggleSelect = (id: string) => {
        if (disabled) return;
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (disabled) return;
        if (selectedIds.size === images.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(images.map(img => img.id)));
        }
    };

    const handleRemoveSelected = () => {
        if (selectedIds.size === 0) return;
        onRemoveMultiple?.(Array.from(selectedIds));
        setSelectedIds(new Set());
    };

    const handleClearAll = () => {
        onClearAll?.();
        setSelectedIds(new Set());
    };

    const canPrune = !disabled && images.some(img => img.status === 'PENDING' || img.status === 'RETRY_LATER' || img.status === 'FAILED');

    return (
        <div className={cn('space-y-8', className)}>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
                <div className="flex items-baseline gap-4">
                    <h3 className="font-display font-extrabold text-2xl text-[var(--color-ink)] tracking-tight">
                        Staging Area
                    </h3>
                    <span className="text-sm font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent-sub)] px-2 py-0.5 rounded-md">
                        {images.length} ASSETS
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {canPrune && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleSelectAll}
                                className="h-9 text-[10px] font-bold tracking-widest uppercase rounded-xl hover:bg-white"
                            >
                                {selectedIds.size === images.length ? <CheckSquare className="w-3.5 h-3.5 mr-2" /> : <Square className="w-3.5 h-3.5 mr-2" />}
                                {selectedIds.size === images.length ? 'Deselect All' : 'Select All'}
                            </Button>
                            <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
                        </>
                    )}

                    {canPrune && (
                        <div className="flex items-center gap-2">
                            {selectedIds.size > 0 && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleRemoveSelected}
                                    className="h-9 text-[10px] font-bold tracking-widest uppercase rounded-xl shadow-lg shadow-red-500/10"
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                    Remove ({selectedIds.size})
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClearAll}
                                className="h-9 text-[10px] font-bold tracking-widest uppercase rounded-xl border-dashed bg-white/50"
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Clear All
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                {images.map((image, index) => {
                    const status = statusConfig[image.status];
                    const imageUrl = image.localPreview 
                        ? image.localPreview 
                        : image.thumbnail_key 
                            ? getImageUrl(image.id, 'thumbnail') 
                            : getImageUrl(image.id, 'original');
                    
                    const isSelected = selectedIds.has(image.id);
                    const canEdit = image.status === 'PENDING' || image.status === 'RETRY_LATER';

                    return (
                        <div
                            key={image.id || index}
                            onClick={() => canPrune && toggleSelect(image.id)}
                            className={cn(
                                'group relative aspect-[4/5.2] p-3 bg-white cursor-pointer',
                                'rounded-[24px] border border-[var(--color-border)] shadow-subtle',
                                'interactive-card noise-overlay',
                                isSelected ? 'ring-2 ring-[var(--color-accent)] border-[var(--color-accent)] bg-[var(--color-accent-sub)]/30' : 'hover:border-[var(--color-border-hover)] hover:shadow-float',
                                'animate-slide-up motion-reduce:animate-none'
                            )}
                            style={{ animationDelay: `${index * 40}ms` }}
                        >
                            {/* Polaroid Image Area */}
                            <div className="relative w-full aspect-square rounded-[16px] overflow-hidden bg-[var(--color-canvas)] border border-[var(--color-border)]/50">
                                {imageUrl && (
                                    <img
                                        src={imageUrl}
                                        alt={image.original_filename || `Image ${index + 1}`}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        loading="lazy"
                                    />
                                )}

                                {/* Overlay Actions */}
                                <div className={cn(
                                    "absolute inset-0 flex items-center justify-center gap-2 transition-all duration-300 bg-black/10 backdrop-blur-[2px]",
                                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                )}>
                                    {onView && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onView(image.id);
                                            }}
                                            className="w-11 h-11 rounded-2xl bg-white border border-white/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl text-[var(--color-ink)]"
                                            title="View Fullscreen"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </button>
                                    )}
                                    {onEditPrompt && canEdit && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditPrompt(image.id);
                                            }}
                                            className="w-11 h-11 rounded-2xl bg-white border border-white/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl text-[var(--color-ink)]"
                                        >
                                            <MessageSquare className="w-5 h-5" />
                                        </button>
                                    )}
                                    {onRemove && canEdit && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemove(image.id);
                                            }}
                                            className="w-11 h-11 rounded-2xl bg-red-500 border border-red-600 flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl text-white"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                    {isSelected && (
                                        <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center shadow-xl animate-scale-in">
                                            <Check className="w-4 h-4 stroke-[3]" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Caption Area */}
                            <div className="mt-4 px-1 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-[10px] font-bold tracking-tighter truncate max-w-[100px] text-[var(--color-ink-sub)] uppercase">
                                        {image.original_filename}
                                    </span>
                                    
                                    {showStatus && (
                                        <Badge
                                            variant="default"
                                            className={cn(
                                                "h-5 px-2 rounded-full border-none text-[9px] font-black tracking-widest uppercase",
                                                status.bg, status.text
                                            )}
                                        >
                                            {status.label}
                                        </Badge>
                                    )}
                                </div>

                                {image.error_message && (
                                    <p className="text-[9px] text-red-500 font-medium leading-tight line-clamp-2">
                                        {image.error_message}
                                    </p>
                                )}
                            </div>

                            {/* Prompt Indicator Sticker */}
                            {image.specific_prompt && (
                                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-2xl bg-[var(--color-accent)] border-2 border-white flex items-center justify-center z-10 shadow-lg rotate-12 group-hover:rotate-0 transition-transform" title="Custom Prompt Active">
                                    <MessageSquare className="w-4 h-4 text-white fill-current" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Floating Selection Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-8 duration-500">
                    <div className="flex items-center gap-6 px-6 py-3 bg-[var(--color-ink)] text-white rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 backdrop-blur-xl">
                        <div className="flex items-center gap-3 border-r border-white/10 pr-6">
                            <div className="w-6 h-6 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-[10px] font-black">
                                {selectedIds.size}
                            </div>
                            <span className="text-xs font-bold tracking-tight uppercase">Assets Selected</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {onBulkEditPrompt && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onBulkEditPrompt(Array.from(selectedIds))}
                                    className="h-9 px-4 text-[10px] font-bold tracking-widest uppercase rounded-full bg-white text-[var(--color-ink)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                                >
                                    <MessageSquare className="w-3.5 h-3.5 mr-2" />
                                    Edit Prompts
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleSelectAll}
                                className="h-9 text-[10px] font-bold tracking-widest uppercase rounded-full hover:bg-white/10 text-white"
                            >
                                {selectedIds.size === images.length ? 'Deselect All' : 'Select All'}
                            </Button>
                            
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleRemoveSelected}
                                className="h-9 px-6 text-[10px] font-bold tracking-widest uppercase rounded-full bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20"
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Delete Selection
                            </Button>
                        </div>

                        <button 
                            onClick={() => setSelectedIds(new Set())}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
