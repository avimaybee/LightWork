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
                    'relative flex flex-col items-center justify-center w-full h-full min-h-[300px] p-12',
                    'transition-all duration-300 cubic-bezier(0.25, 0.8, 0.25, 1)',
                    'cursor-pointer',
                    // Cinematic Base
                    'bg-white/50 backdrop-blur-sm',
                    'border border-dashed border-[var(--color-border)]',
                    'rounded-[var(--radius-2xl)]',

                    // Hover State
                    !disabled && 'hover:bg-white hover:border-[var(--color-ink-sub)] hover:shadow-subtle',

                    // Active Drag State
                    isDragging && 'bg-[var(--color-accent-sub)] border-[var(--color-accent)] scale-[0.98] shadow-none',

                    // Disabled State
                    disabled && 'opacity-50 cursor-not-allowed bg-[var(--color-muted)]'
                )}
            >
                <div className={cn(
                    'flex flex-col items-center text-center space-y-6 transition-transform duration-300',
                    isDragging && 'scale-105'
                )}>
                    {/* Icon Container */}
                    <div className={cn(
                        'w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-300',
                        isDragging ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-secondary)] text-[var(--color-ink-sub)] group-hover:text-[var(--color-ink)]'
                    )}>
                        {isDragging ? <Upload className="w-8 h-8" /> : <FileImage className="w-8 h-8 stroke-1" />}
                    </div>

                    <div className="space-y-2">
                        <p className={cn(
                            "font-display text-xl font-bold transition-colors",
                            isDragging ? "text-[var(--color-accent)]" : "text-[var(--color-ink)]"
                        )}>
                            {isDragging ? 'Release to Upload' : 'Import Assets'}
                        </p>
                        <p className="text-sm text-[var(--color-ink-sub)] max-w-xs mx-auto leading-relaxed font-medium">
                            Drag & drop your images here, or click to browse.
                        </p>
                    </div>

                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-[var(--color-secondary)] text-[10px] font-semibold tracking-wide text-[var(--color-ink-sub)] uppercase">
                        JPG · PNG · WEBP · Max 10MB
                    </div>
                </div>
            </label>

            {/* Error Toast */}
            {error && (
                <div
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-full bg-red-500 text-white shadow-lg animate-slide-up z-20 w-max"
                >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p className="text-xs font-medium">{error}</p>
                    <button onClick={() => setError(null)} className="ml-2 hover:opacity-80">
                        <X className="w-3 h-3" />
                    </button>
                </div>
            )}
        </div>
    );
}
