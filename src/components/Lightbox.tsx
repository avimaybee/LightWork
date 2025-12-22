import * as React from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LightboxProps {
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string | null;
    altText?: string;
    onNext?: () => void;
    onPrev?: () => void;
    hasNext?: boolean;
    hasPrev?: boolean;
}

export function Lightbox({
    isOpen,
    onClose,
    imageSrc,
    altText,
    onNext,
    onPrev,
    hasNext,
    hasPrev,
}: LightboxProps) {
    const [scale, setScale] = React.useState(1);
    const [position, setPosition] = React.useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = React.useState(false);
    const dragStart = React.useRef({ x: 0, y: 0 });

    React.useEffect(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, [imageSrc]);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' && onNext) onNext();
            if (e.key === 'ArrowLeft' && onPrev) onPrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, onNext, onPrev]);

    if (!isOpen || !imageSrc) return null;

    const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 4));
    const handleZoomOut = () => {
        setScale(s => {
            const next = Math.max(s - 0.5, 1);
            if (next === 1) setPosition({ x: 0, y: 0 });
            return next;
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            setIsDragging(true);
            dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && scale > 1) {
            setPosition({
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y
            });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 flex items-center justify-center overflow-hidden">
            {/* Toolbar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-50">
                <div className="text-white/70 font-mono text-xs">{altText}</div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={scale <= 1} className="text-white hover:bg-white/10 rounded-full">
                        <ZoomOut className="w-5 h-5" />
                    </Button>
                    <span className="text-white/50 text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                    <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={scale >= 4} className="text-white hover:bg-white/10 rounded-full">
                        <ZoomIn className="w-5 h-5" />
                    </Button>
                    <div className="w-px h-6 bg-white/10 mx-2" />
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 rounded-full">
                        <X className="w-6 h-6" />
                    </Button>
                </div>
            </div>

            {/* Navigation */}
            {hasPrev && (
                <button
                    onClick={onPrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all z-50"
                >
                    <ChevronLeft className="w-8 h-8" />
                </button>
            )}
            {hasNext && (
                <button
                    onClick={onNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all z-50"
                >
                    <ChevronRight className="w-8 h-8" />
                </button>
            )}

            {/* Image Stage */}
            <div
                className="w-full h-full flex items-center justify-center p-4 md:p-12 cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <img
                    src={imageSrc}
                    alt={altText}
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                    }}
                    className="max-w-full max-h-full object-contain select-none"
                    draggable={false}
                />
            </div>
        </div>,
        document.body
    );
}
