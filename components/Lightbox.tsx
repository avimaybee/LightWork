import React, { useEffect, useState, useRef } from 'react';
import { X, ZoomIn, ZoomOut, Download, Columns, Image as ImageIcon, Zap } from 'lucide-react';

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string; // The processed image
  originalUrl?: string; // The raw image
}

export const Lightbox: React.FC<LightboxProps> = ({ isOpen, onClose, imageUrl, originalUrl }) => {
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [sliderPos, setSliderPos] = useState(50);
  const [isFlashing, setIsFlashing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
        setZoom(1);
        setMode('single');
        setSliderPos(50);
        setIsFlashing(false);
    }
  }, [isOpen]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '\\') setIsFlashing(true);
      
      if (mode === 'compare') {
          if (e.key === 'ArrowLeft') setSliderPos(p => Math.max(0, p - 5));
          if (e.key === 'ArrowRight') setSliderPos(p => Math.min(100, p + 5));
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === '\\') setIsFlashing(false);
    }

    if (isOpen) {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
    }
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, onClose, mode]);

  const handleMouseMove = (e: React.MouseEvent) => {
      if (mode === 'compare' && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
          const percent = (x / rect.width) * 100;
          setSliderPos(percent);
      }
  };

  if (!isOpen) return null;

  // Determine what image to show
  // If Flashing: show Original
  // Else if Single Mode: Show Result
  // Else if Compare: Show Split
  
  const showOriginal = isFlashing;

  return (
    <div className="fixed inset-0 z-[100] bg-[#1C1917]/98 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      
      {/* Header Toolbar */}
      <div className="flex items-center justify-between p-6 z-20">
          <div className="flex items-center gap-6">
               {originalUrl && (
                   <>
                    <div className="flex bg-white/10 rounded-lg p-1 border border-white/5">
                        <button 
                            onClick={() => setMode('single')}
                            className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${mode === 'single' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'}`}
                        >
                            <ImageIcon className="w-4 h-4" />
                            <span>Result</span>
                        </button>
                        <button 
                            onClick={() => setMode('compare')}
                            className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${mode === 'compare' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'}`}
                        >
                            <Columns className="w-4 h-4" />
                            <span>Compare</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 text-stone-500">
                        <div 
                            className={`w-7 h-7 border rounded flex items-center justify-center font-mono text-[10px] transition-colors ${isFlashing ? 'bg-clay-500 text-white border-clay-500' : 'border-white/10 text-white/40'}`}
                        >
                            \
                        </div>
                        <span className="text-xs font-medium text-white/40 hidden sm:block tracking-wide">Hold for Original</span>
                    </div>
                   </>
               )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} disabled={mode === 'compare'} className="p-3 text-white/60 hover:text-white bg-white/5 rounded-full disabled:opacity-30 border border-white/5 transition-all">
                <ZoomOut className="w-5 h-5" />
            </button>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} disabled={mode === 'compare'} className="p-3 text-white/60 hover:text-white bg-white/5 rounded-full disabled:opacity-30 border border-white/5 transition-all">
                <ZoomIn className="w-5 h-5" />
            </button>
            <div className="w-px h-8 bg-white/10 mx-4" />
            <button onClick={onClose} className="p-3 text-white hover:text-clay-400 bg-white/5 rounded-full transition-all border border-white/5 hover:border-clay-500/30">
              <X className="w-6 h-6" />
            </button>
          </div>
      </div>

      {/* Canvas */}
      <div 
        className="flex-1 w-full h-full overflow-hidden flex items-center justify-center p-8 cursor-default" 
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {isFlashing ? (
             // Flash Original Mode (Overrides everything)
             <div className="relative">
                 <img 
                    src={originalUrl} 
                    alt="Original (Flash)" 
                    className="max-w-none shadow-2xl ring-1 ring-white/10"
                    style={{ 
                        transform: `scale(${zoom})`,
                        maxHeight: zoom === 1 ? '85vh' : 'none',
                        maxWidth: zoom === 1 ? '90vw' : 'none',
                    }}
                />
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-clay-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-xl animate-pulse tracking-wide border border-white/10">
                    ORIGINAL SOURCE
                </div>
             </div>
        ) : mode === 'single' ? (
             <img 
                src={imageUrl} 
                alt="Full screen" 
                className="max-w-none transition-transform duration-200 ease-out shadow-2xl ring-1 ring-white/10"
                style={{ 
                    transform: `scale(${zoom})`,
                    maxHeight: zoom === 1 ? '85vh' : 'none',
                    maxWidth: zoom === 1 ? '90vw' : 'none',
                    cursor: zoom > 1 ? 'grab' : 'zoom-in'
                }}
                onClick={(e) => { e.stopPropagation(); setZoom(z => z === 1 ? 2 : 1); }}
            />
        ) : (
            // Comparison Mode
            <div 
                ref={containerRef}
                className="relative shadow-2xl overflow-hidden group cursor-col-resize select-none ring-1 ring-white/10"
                style={{ maxHeight: '85vh', maxWidth: '90vw' }}
                onMouseMove={handleMouseMove}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Background: Original */}
                <img 
                    src={originalUrl} 
                    alt="Original" 
                    className="block max-h-[85vh] w-auto h-auto object-contain pointer-events-none select-none"
                />
                
                {/* Overlay: Processed (Clipped) */}
                <div 
                    className="absolute inset-0 w-full h-full pointer-events-none select-none"
                    style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
                >
                    <img 
                        src={imageUrl} 
                        alt="Processed" 
                        className="block max-h-[85vh] w-full h-full object-contain"
                    />
                </div>

                {/* Slider Handle */}
                <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-white cursor-col-resize z-20 shadow-[0_0_15px_rgba(0,0,0,0.8)] pointer-events-none"
                    style={{ left: `${sliderPos}%` }}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-white rounded-full shadow-xl flex items-center justify-center border border-stone-200">
                        <Columns className="w-4 h-4 text-stone-900" />
                    </div>
                </div>

                {/* Labels */}
                <div className="absolute top-6 left-6 bg-black/60 text-white text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md pointer-events-none border border-white/10 tracking-widest uppercase">
                    Original
                </div>
                <div className="absolute top-6 right-6 bg-white/90 text-stone-900 text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md pointer-events-none border border-white/10 tracking-widest uppercase shadow-lg">
                    Enhanced
                </div>
            </div>
        )}
      </div>
    </div>
  );
};