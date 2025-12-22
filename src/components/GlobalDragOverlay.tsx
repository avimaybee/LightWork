import * as React from 'react';
import { Upload, FileUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

export function GlobalDragOverlay() {
    const [isDragging, setIsDragging] = React.useState(false);
    const dragCounter = React.useRef(0);

    React.useEffect(() => {
        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter.current += 1;
            if (e.dataTransfer?.types?.includes('Files')) {
                setIsDragging(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter.current -= 1;
            if (dragCounter.current === 0) {
                setIsDragging(false);
            }
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter.current = 0;
            setIsDragging(false);
            
            // Note: Actual file handling happens in the specific DropZone 
            // or we could emit an event here if we wanted a global drop.
            // For now, this is purely visual feedback to guide the user 
            // to the drop zones or indicate the app is ready.
        };

        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, []);

    if (!isDragging) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-in fade-in duration-300">
            {/* Cinematic Backdrop Blur */}
            <div className="absolute inset-0 bg-white/60 backdrop-blur-xl" />
            
            {/* Floating "Command" Frame */}
            <div className={cn(
                "relative w-[95vw] h-[95vh] rounded-[32px] flex flex-col items-center justify-center gap-8",
                "border-4 border-dashed border-[var(--color-accent)] bg-white/20",
                "shadow-[0_0_100px_rgba(255,79,0,0.1)]",
                "animate-in zoom-in-95 duration-300 ease-out"
            )}>
                {/* Noise Texture */}
                <div className="absolute inset-0 rounded-[28px] noise-overlay opacity-[0.05] pointer-events-none" />

                {/* Animated Icon Cluster */}
                <div className="relative">
                    <div className="absolute inset-0 bg-[var(--color-accent)] blur-3xl opacity-20 animate-pulse" />
                    <div className="relative w-32 h-32 bg-white rounded-3xl shadow-2xl flex items-center justify-center rotate-3 border border-[var(--color-accent)]/20">
                        <Upload className="w-12 h-12 text-[var(--color-accent)]" />
                    </div>
                    <div className="absolute -top-6 -right-6 w-20 h-20 bg-[var(--color-accent)] rounded-2xl shadow-xl flex items-center justify-center -rotate-6 animate-bounce delay-100">
                        <FileUp className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-[var(--color-ink)] rounded-xl shadow-xl flex items-center justify-center -rotate-3">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                </div>

                {/* Typography */}
                <div className="text-center relative z-10 space-y-2">
                    <h2 className="font-display font-black text-4xl md:text-5xl tracking-tight text-[var(--color-ink)] drop-shadow-sm">
                        INITIALIZE INGESTION
                    </h2>
                    <div className="flex items-center justify-center gap-3">
                        <div className="h-px w-12 bg-[var(--color-accent)]" />
                        <p className="font-mono font-bold text-sm tracking-[0.2em] uppercase text-[var(--color-accent)]">
                            Release to Process
                        </p>
                        <div className="h-px w-12 bg-[var(--color-accent)]" />
                    </div>
                </div>

                {/* Corner Accents */}
                <div className="absolute top-8 left-8 w-4 h-4 border-t-2 border-l-2 border-[var(--color-accent)]" />
                <div className="absolute top-8 right-8 w-4 h-4 border-t-2 border-r-2 border-[var(--color-accent)]" />
                <div className="absolute bottom-8 left-8 w-4 h-4 border-b-2 border-l-2 border-[var(--color-accent)]" />
                <div className="absolute bottom-8 right-8 w-4 h-4 border-b-2 border-r-2 border-[var(--color-accent)]" />
            </div>
        </div>,
        document.body
    );
}
