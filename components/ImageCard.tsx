import React, { useMemo, useRef, useState } from 'react';
import { ImageJob } from '../types';
import { Loader2, AlertCircle, CheckCircle2, FileQuestion, Sparkles, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface ImageCardProps {
  job: ImageJob;
  isSelected: boolean;
  isActive: boolean; // Is currently open in Inspector
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  onClick: (id: string, e: React.MouseEvent) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({ 
    job, 
    isSelected, 
    isActive,
    onToggleSelect,
    onClick
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const loadedSrcsRef = useRef<Record<string, true>>({});
  const [, forceRerender] = useState(0);

  const displaySrc = useMemo(() => {
    if (job.status === 'completed' && job.resultUrl) {
      return isHovered ? job.thumbnailUrl : job.resultUrl;
    }
    return job.thumbnailUrl;
  }, [isHovered, job.resultUrl, job.status, job.thumbnailUrl]);

  const aspectRatio = useMemo(() => {
    if (job.width && job.height && job.width > 0 && job.height > 0) {
      return `${job.width} / ${job.height}`;
    }
    return '4 / 5';
  }, [job.height, job.width]);

  const isLoaded = !!loadedSrcsRef.current[displaySrc];

  const getStatusIndicator = () => {
      switch(job.status) {
        case 'batch_pending': return <FileQuestion className="w-3.5 h-3.5 text-status-warning" />;
        case 'batch_processing': return <Loader2 className="w-3.5 h-3.5 text-status-processing animate-spin" />;
        case 'processing': return <Loader2 className="w-3.5 h-3.5 text-status-processing animate-spin" />;
        case 'retrying': return <Loader2 className="w-3.5 h-3.5 text-status-warning animate-spin" />;
        case 'uploading': return <div className="w-1.5 h-1.5 rounded-full bg-status-pending" />;
        case 'error': return <AlertCircle className="w-3.5 h-3.5 text-status-error" />;
        case 'paused': return <FileQuestion className="w-3.5 h-3.5 text-status-warning" />;
        case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />;
        default: return null;
      }
  };

  return (
    <div 
      className={`
        group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-300 select-none
        bg-white
        content-auto
        ${isActive ? 'ring-[3px] ring-stone-900 shadow-xl scale-[1.01] z-10' : ''}
        ${isSelected && !isActive ? 'ring-[3px] ring-clay-400 shadow-lg z-10' : ''}
        ${!isActive && !isSelected ? 'hover:shadow-xl hover:-translate-y-1 border border-stone-200' : ''}
      `}
      style={{ aspectRatio }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => onClick(job.id, e)}
    >
      {/* Visual Content - "Matte" Frame effect */}
      <div className="absolute inset-2 overflow-hidden bg-stone-100 rounded-sm">
         {!isLoaded && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="absolute inset-0 bg-stone-100" />
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/45 to-white/0"
                style={{ backgroundSize: '200% 100%' }}
                animate={{ backgroundPositionX: ['200%', '-200%'] }}
                transition={{ repeat: Infinity, duration: 1.25, ease: 'linear' }}
              />
            </motion.div>
         )}

         <img
            src={displaySrc}
            alt={job.status === 'completed' && job.resultUrl ? 'Asset' : 'Original'}
          loading="lazy"
          decoding="async"
            onLoad={() => {
              loadedSrcsRef.current[displaySrc] = true;
              forceRerender(v => v + 1);
            }}
            className={`w-full h-full object-cover transition-all duration-500 ${job.status === 'paused' ? 'opacity-40 grayscale' : 'opacity-90'} ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
         />
         
         {/* Subtle Vignette on Hover */}
         <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/5 transition-colors duration-300" />
      </div>

      {/* Selection Area (Top Right) */}
      <div 
        className="absolute top-4 right-4 z-20"
        onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(job.id, e.shiftKey);
        }}
      >
         <div 
            className={`
                w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-200
                ${isSelected ? 'bg-clay-500 border-clay-500 text-white' : 'bg-white/90 border-stone-300 text-transparent hover:border-clay-400 opacity-0 group-hover:opacity-100'}
            `}
         >
             <CheckCircle2 className="w-4 h-4" />
         </div>
      </div>

      {/* Status & Info (Bottom) */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-20">
          <div className="px-2 py-1 bg-white/95 backdrop-blur-md rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 max-w-[70%]">
              <p className="text-[10px] font-bold text-stone-700 truncate font-sans">
                  {job.fileName}
              </p>
          </div>
          
          {job.status !== 'queued' && (
            <div className="w-6 h-6 bg-white/95 backdrop-blur-md rounded-full shadow-sm flex items-center justify-center">
                {getStatusIndicator()}
            </div>
          )}
      </div>

      {/* Upload Progress */}
      {typeof job.uploadProgress === 'number' && job.status === 'uploading' && (
        <div className="absolute left-4 right-4 bottom-4 z-20">
          <div className="px-2.5 py-2 bg-white/95 backdrop-blur-md rounded-lg shadow-sm border border-white/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 font-heading">Uploading</span>
              <span className="text-[10px] font-bold text-stone-700 tabular-nums font-sans">{Math.round(job.uploadProgress)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
              <div
                className="h-full bg-clay-500 transition-[width] duration-200"
                style={{ width: `${Math.max(0, Math.min(100, job.uploadProgress))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
        {(job.status === 'processing' || job.status === 'batch_processing') && (
          <div className="absolute inset-2 z-10 bg-white/20 backdrop-blur-[1px]">
             <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent animate-shimmer" />
          </div>
      )}
    </div>
  );
};