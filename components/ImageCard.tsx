import React, { useState } from 'react';
import { ImageJob } from '../types';
import { Loader2, AlertCircle, CheckCircle2, FileQuestion, Sparkles, Image as ImageIcon } from 'lucide-react';

interface ImageCardProps {
  job: ImageJob;
  isSelected: boolean;
  isActive: boolean; // Is currently open in Inspector
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  onClick: (id: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({ 
    job, 
    isSelected, 
    isActive,
    onToggleSelect,
    onClick
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getStatusIndicator = () => {
      switch(job.status) {
          case 'processing': return <Loader2 className="w-3.5 h-3.5 text-stone-500 animate-spin" />;
          case 'retrying': return <Loader2 className="w-3.5 h-3.5 text-clay-500 animate-spin" />;
          case 'uploading': return <div className="w-1.5 h-1.5 rounded-full bg-stone-300" />;
          case 'error': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
          case 'paused': return <FileQuestion className="w-3.5 h-3.5 text-amber-500" />;
          case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
          default: return null;
      }
  };

  return (
    <div 
      className={`
        group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-300 select-none
        aspect-[4/5] bg-white
        ${isActive ? 'ring-[3px] ring-stone-900 shadow-xl scale-[1.01] z-10' : ''}
        ${isSelected && !isActive ? 'ring-[3px] ring-clay-400 shadow-lg z-10' : ''}
        ${!isActive && !isSelected ? 'hover:shadow-xl hover:-translate-y-1 border border-stone-200' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => onClick(job.id)}
    >
      {/* Visual Content - "Matte" Frame effect */}
      <div className="absolute inset-2 overflow-hidden bg-stone-100 rounded-sm">
         {job.status === 'completed' && job.resultUrl ? (
            <img 
                src={isHovered ? job.thumbnailUrl : job.resultUrl} 
                alt="Asset" 
                className="w-full h-full object-cover transition-opacity duration-500" 
            />
         ) : (
            <img 
                src={job.thumbnailUrl} 
                alt="Original" 
                className={`w-full h-full object-cover transition-all duration-500 ${job.status === 'paused' ? 'opacity-40 grayscale' : 'opacity-90'}`} 
            />
         )}
         
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

      {/* Loading Overlay */}
      {job.status === 'processing' && (
          <div className="absolute inset-2 z-10 bg-white/20 backdrop-blur-[1px]">
             <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent animate-shimmer" />
          </div>
      )}

      <style>{`
        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        .animate-shimmer {
            animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
};