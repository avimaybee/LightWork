import React from 'react';
import { motion } from 'framer-motion';
import { ImageIcon, UploadCloud, Sparkles, FolderOpen, Search, Layers } from 'lucide-react';

interface EmptyStateProps {
    type: 'workspace' | 'no-results' | 'no-modules' | 'loading';
    searchTerm?: string;
    onClearSearch?: () => void;
}

// Stone-aesthetic SVG illustration component
const WorkspaceIllustration = () => (
    <svg className="w-32 h-32" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Background frame */}
        <rect x="16" y="24" width="96" height="80" rx="8" stroke="#D6D3D1" strokeWidth="2" strokeDasharray="6 4" />
        
        {/* Stacked images effect */}
        <motion.g
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
        >
            <rect x="32" y="36" width="40" height="32" rx="4" fill="#F5F5F4" stroke="#D6D3D1" strokeWidth="1.5" />
            <circle cx="42" cy="46" r="4" fill="#E7E5E4" />
            <path d="M32 60 L44 52 L56 58 L72 48 L72 68 L32 68 Z" fill="#E7E5E4" />
        </motion.g>
        
        <motion.g
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
        >
            <rect x="56" y="44" width="40" height="32" rx="4" fill="#FAFAF9" stroke="#D6D3D1" strokeWidth="1.5" />
            <circle cx="66" cy="54" r="4" fill="#E7E5E4" />
            <path d="M56 68 L68 60 L80 66 L96 56 L96 76 L56 76 Z" fill="#E7E5E4" />
        </motion.g>
        
        {/* Upload arrow */}
        <motion.g
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5, repeat: Infinity, repeatType: 'reverse', repeatDelay: 1 }}
        >
            <path d="M64 96 L64 112" stroke="#A8A29E" strokeWidth="2" strokeLinecap="round" />
            <path d="M58 102 L64 96 L70 102" stroke="#A8A29E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </motion.g>
    </svg>
);

const NoResultsIllustration = () => (
    <svg className="w-24 h-24" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Magnifying glass */}
        <motion.g
            initial={{ rotate: -10 }}
            animate={{ rotate: 10 }}
            transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            style={{ originX: '50%', originY: '50%' }}
        >
            <circle cx="40" cy="40" r="20" stroke="#D6D3D1" strokeWidth="3" fill="#F5F5F4" />
            <line x1="54" y1="54" x2="72" y2="72" stroke="#D6D3D1" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
        
        {/* Question mark */}
        <motion.path
            d="M36 34 Q36 28 42 28 Q48 28 48 34 Q48 38 42 40 L42 44"
            stroke="#A8A29E"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
        />
        <motion.circle
            cx="42"
            cy="50"
            r="1.5"
            fill="#A8A29E"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.1 }}
        />
    </svg>
);

const EmptyModulesIllustration = () => (
    <svg className="w-24 h-24" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Module blocks */}
        <motion.rect
            x="16" y="24" width="24" height="24" rx="4"
            stroke="#D6D3D1" strokeWidth="2" strokeDasharray="4 4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
        />
        <motion.rect
            x="48" y="24" width="24" height="24" rx="4"
            stroke="#D6D3D1" strokeWidth="2" strokeDasharray="4 4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
        />
        <motion.rect
            x="32" y="48" width="24" height="24" rx="4"
            stroke="#D6D3D1" strokeWidth="2" strokeDasharray="4 4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
        />
        
        {/* Plus icon in center block */}
        <motion.g
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
        >
            <line x1="44" y1="56" x2="44" y2="64" stroke="#A8A29E" strokeWidth="2" strokeLinecap="round" />
            <line x1="40" y1="60" x2="48" y2="60" stroke="#A8A29E" strokeWidth="2" strokeLinecap="round" />
        </motion.g>
    </svg>
);

export const EmptyState: React.FC<EmptyStateProps> = ({ type, searchTerm, onClearSearch }) => {
    const content = {
        workspace: {
            illustration: <WorkspaceIllustration />,
            icon: <UploadCloud className="w-6 h-6 text-clay-500" />,
            title: 'Your Workspace is Empty',
            description: 'Drag & drop images to begin refinement, or click to browse your files.',
            action: null,
        },
        'no-results': {
            illustration: <NoResultsIllustration />,
            icon: <Search className="w-5 h-5 text-stone-400" />,
            title: 'No Matching Images',
            description: searchTerm 
                ? `No images match "${searchTerm}". Try a different search term.`
                : 'No images found with the current filter.',
            action: onClearSearch ? (
                <button
                    onClick={onClearSearch}
                    className="mt-4 px-4 py-2 text-sm font-medium text-clay-600 hover:text-clay-700 hover:bg-clay-50 rounded-lg transition-colors"
                >
                    Clear Search
                </button>
            ) : null,
        },
        'no-modules': {
            illustration: <EmptyModulesIllustration />,
            icon: <Layers className="w-5 h-5 text-stone-400" />,
            title: 'No Custom Modules Yet',
            description: 'Create your first module to save reusable prompt templates.',
            action: null,
        },
        loading: {
            illustration: null,
            icon: <Sparkles className="w-6 h-6 text-clay-500 animate-pulse" />,
            title: 'Loading...',
            description: 'Preparing your workspace.',
            action: null,
        },
    };

    const config = content[type];

    return (
        <motion.div
            className="h-full flex flex-col items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div className="w-full max-w-lg border border-dashed border-stone-300 rounded-2xl p-12 flex flex-col items-center justify-center bg-[#FDFCFB] shadow-sm">
                {/* Illustration */}
                {config.illustration && (
                    <div className="mb-6">
                        {config.illustration}
                    </div>
                )}
                
                {/* Icon badge - only show if no illustration */}
                {!config.illustration && (
                    <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-6">
                        {config.icon}
                    </div>
                )}
                
                {/* Text content */}
                <h3 className="text-xl font-heading font-bold text-stone-900 mb-2 tracking-tight text-center">
                    {config.title}
                </h3>
                <p className="text-stone-500 text-center text-sm font-sans max-w-xs leading-relaxed">
                    {config.description}
                </p>
                
                {/* Action button */}
                {config.action}
            </div>
        </motion.div>
    );
};

export default EmptyState;
