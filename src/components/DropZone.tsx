import * as React from 'react';
import { Upload, X, AlertCircle, FileImage } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropZoneProps {
    onFilesSelected: (files: File[]) => void;
    maxFiles?: number;
    currentCount?: number;
    disabled?: boolean;
    className?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function DropZone({
    onFilesSelected,
    maxFiles = 50,
    currentCount = 0,
    disabled = false,
    className,
}: DropZoneProps) {
    const [isDragging, setIsDragging] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const remainingSlots = maxFiles - currentCount;

    const validateFiles = (files: FileList | File[]): File[] => {
        const validFiles: File[] = [];
        const errors: string[] = [];

        Array.from(files).forEach((file) => {
            if (!ACCEPTED_TYPES.includes(file.type)) {
                errors.push(`${file.name}: Invalid type`);
                return;
            }
            if (file.size > MAX_FILE_SIZE) {
                errors.push(`${file.name}: Too large (max 10MB)`);
                return;
            }
            if (validFiles.length >= remainingSlots) {
                errors.push(`Max ${maxFiles} images`);
                return;
            }
            validFiles.push(file);
        });

        if (errors.length > 0) {
            setError(errors.slice(0, 2).join(', ') + (errors.length > 2 ? '...' : ''));
            setTimeout(() => setError(null), 4000);
        }

        return validFiles;
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (disabled) return;
        const files = validateFiles(e.dataTransfer.files);
        if (files.length > 0) onFilesSelected(files);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = validateFiles(e.target.files);
            if (files.length > 0) onFilesSelected(files);
        }
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    return (
        <div className={cn('relative group h-full', className)}>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handleFileInput}
                disabled={disabled}
                className="sr-only"
                id="dropzone-input"
            />

            <label
                htmlFor="dropzone-input"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                    'relative flex flex-col items-center justify-center w-full h-full min-h-[400px] p-12',
                    'transition-all duration-700 cubic-bezier(0.25, 0.8, 0.25, 1)',
                    'cursor-pointer overflow-hidden',
                    // Cinematic Base
                    'bg-white/30 backdrop-blur-xl',
                    'border-2 border-dashed border-[var(--color-border)]',
                    'rounded-[32px]',

                    // Hover State
                    !disabled && 'hover:bg-white hover:border-[var(--color-accent)]/30 hover:shadow-2xl hover:shadow-black/5',

                    // Active Drag State
                    isDragging && 'bg-[var(--color-accent-sub)] border-[var(--color-accent)] scale-[0.99] shadow-none',

                    // Disabled State
                    disabled && 'opacity-50 cursor-not-allowed bg-[var(--color-muted)]'
                )}
            >
                {/* Background Noise Overlay */}
                <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />

                <div className={cn(
                    'flex flex-col items-center text-center space-y-8 transition-all duration-700',
                    isDragging && 'scale-105'
                )}>
                    {/* Icon Container */}
                    <div className={cn(
                        'w-24 h-24 rounded-[32px] flex items-center justify-center transition-all duration-700 relative',
                        isDragging ? 'bg-[var(--color-accent)] text-white rotate-12 shadow-2xl shadow-[var(--color-accent)]/40' : 'bg-white text-[var(--color-ink-sub)] group-hover:text-[var(--color-accent)] group-hover:rotate-6 shadow-xl shadow-black/5'
                    )}>
                        {isDragging ? <Upload className="w-10 h-10" /> : <FileImage className="w-10 h-10 stroke-[1.5]" />}
                        
                        {/* Subtle pulse effect when dragging */}
                        {isDragging && (
                            <div className="absolute inset-0 rounded-[32px] bg-[var(--color-accent)] animate-ping opacity-20" />
                        )}
                    </div>

                    <div className="space-y-3 relative z-10">
                        <h3 className={cn(
                            "font-display text-4xl font-black tracking-tight transition-colors duration-700",
                            isDragging ? "text-[var(--color-accent)]" : "text-[var(--color-ink)]"
                        )}>
                            {isDragging ? 'Release Assets' : 'Ingest Assets'}
                        </h3>
                        <p className="text-lg text-[var(--color-ink-sub)] max-w-md mx-auto leading-relaxed font-medium opacity-70">
                            {isDragging 
                                ? 'Drop your files to begin the optimization sequence.' 
                                : 'Drag and drop high-resolution images here, or click to browse your local archive.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="h-px w-8 bg-[var(--color-border)]" />
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white border border-[var(--color-border)] text-[10px] font-mono font-black tracking-[0.2em] text-[var(--color-accent)] uppercase shadow-sm">
                            JPG · PNG · WEBP · HEIC
                        </div>
                        <div className="h-px w-8 bg-[var(--color-border)]" />
                    </div>
                </div>

                {/* Corner Accents */}
                <div className="absolute top-6 left-6 w-4 h-4 border-t-2 border-l-2 border-[var(--color-border)] rounded-tl-sm" />
                <div className="absolute top-6 right-6 w-4 h-4 border-t-2 border-r-2 border-[var(--color-border)] rounded-tr-sm" />
                <div className="absolute bottom-6 left-6 w-4 h-4 border-b-2 border-l-2 border-[var(--color-border)] rounded-bl-sm" />
                <div className="absolute bottom-6 right-6 w-4 h-4 border-b-2 border-r-2 border-[var(--color-border)] rounded-br-sm" />
            </label>

            {/* Error Toast */}
            {error && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-display font-bold text-sm">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                        <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
