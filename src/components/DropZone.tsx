import * as React from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
// import { Button } from './ui/button'; // Unused

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
        <div className={cn('relative group', className)}>
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
                    'relative flex flex-col items-center justify-center w-full min-h-[300px] p-10',
                    'transition-all duration-300 ease-out',
                    'cursor-pointer touch-target',
                    // The "Physical Worksheet" Look
                    'bg-[var(--color-cream)]',
                    'border-2 border-dashed border-[var(--color-line)]/30 rounded-[32px]',

                    // Hover State
                    !disabled && 'hover:border-[var(--color-line)] hover:bg-white hover:shadow-[8px_8px_0px_0px_var(--color-line)] hover:-translate-y-1',

                    // Active Drag State
                    isDragging && 'border-[var(--color-line)] bg-[var(--color-yellow)] shadow-[12px_12px_0px_0px_var(--color-line)] -translate-y-2 scale-[1.01]',

                    // Disabled State
                    disabled && 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-300'
                )}
            >
                {/* Decorative "Tape" corners */}
                <div className="absolute -top-3 -left-3 w-12 h-4 rotate-[-45deg] bg-black/10 backdrop-blur-sm z-10" />
                <div className="absolute -bottom-3 -right-3 w-12 h-4 rotate-[-45deg] bg-black/10 backdrop-blur-sm z-10" />

                <div className={cn(
                    'flex flex-col items-center text-center space-y-6 transition-transform duration-300',
                    isDragging && 'scale-110'
                )}>
                    {/* Icon Container */}
                    <div className={cn(
                        'w-20 h-20 rounded-2xl border-2 border-[var(--color-line)] flex items-center justify-center bg-white shadow-[4px_4px_0px_0px_var(--color-line)]',
                        isDragging && 'bg-[var(--color-line)] text-[var(--color-yellow)]'
                    )}>
                        <Upload className="w-10 h-10 stroke-[1.5px]" />
                    </div>

                    <div className="space-y-2">
                        <p className="font-display font-bold text-2xl text-black">
                            {isDragging ? 'Drop it like it\'s hot' : 'Upload Images'}
                        </p>
                        <p className="font-mono text-sm text-[var(--color-text-muted)] max-w-xs mx-auto leading-relaxed">
                            {isDragging
                                ? 'Release to add files to the batch'
                                : 'Drag & drop files here, or click to browse your system'
                            }
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full border border-[var(--color-line)]/10 bg-[var(--color-line)]/5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            JPG / PNG / WEBP
                        </span>
                        <span className="px-3 py-1 rounded-full border border-[var(--color-line)]/10 bg-[var(--color-line)]/5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            MAX 10MB
                        </span>
                    </div>
                </div>
            </label>

            {/* Error Toast */}
            {error && (
                <div
                    className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-4 rounded-xl border-2 border-black bg-red-500 text-white shadow-[4px_4px_0px_0px_#1A1A1A] animate-slide-up z-20 w-max max-w-[90vw]"
                >
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-bold">{error}</p>
                    <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
