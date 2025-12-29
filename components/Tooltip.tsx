import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    delay?: number;
    position?: 'top' | 'bottom' | 'left' | 'right';
    maxWidth?: number;
}

// Default tooltip delay standardized to 700ms for non-critical tooltips
// to reduce visual noise when moving the mouse
const DEFAULT_TOOLTIP_DELAY = 700;

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    delay = DEFAULT_TOOLTIP_DELAY,
    position = 'top',
    maxWidth = 280,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<number | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);

    const showTooltip = () => {
        timeoutRef.current = window.setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    const arrowClasses = {
        top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-stone-800',
        bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-stone-800',
        left: 'right-[-6px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-stone-800',
        right: 'left-[-6px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-stone-800',
    };

    return (
        <div
            ref={triggerRef}
            className="relative inline-flex"
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onFocus={showTooltip}
            onBlur={hideTooltip}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute z-[500] ${positionClasses[position]}`}
                        style={{ maxWidth }}
                    >
                        <div className="bg-stone-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed">
                            {content}
                        </div>
                        <div
                            className={`absolute w-0 h-0 border-[6px] ${arrowClasses[position]}`}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Help icon with tooltip for contextual help
interface HelpTooltipProps {
    content: React.ReactNode;
    delay?: number;
    size?: 'sm' | 'md';
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
    content,
    delay = 400,
    size = 'sm',
}) => {
    const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

    return (
        <Tooltip content={content} delay={delay} position="top">
            <button
                type="button"
                className="text-stone-400 hover:text-stone-600 transition-colors focus:outline-none focus:text-stone-600"
                aria-label="Help"
            >
                <HelpCircle className={iconSize} />
            </button>
        </Tooltip>
    );
};

// Pre-built help content for common UI elements
export const HELP_CONTENT = {
    MODEL_FAST: (
        <div className="space-y-1">
            <div className="font-bold text-white">Gemini Flash (Fast)</div>
            <div className="text-stone-300">
                Optimized for speed. Best for quick iterations and large batches.
                ~2-3 seconds per image.
            </div>
        </div>
    ),
    MODEL_PRO: (
        <div className="space-y-1">
            <div className="font-bold text-white">Gemini Pro (Quality)</div>
            <div className="text-stone-300">
                Higher quality results with better understanding of complex prompts.
                ~5-8 seconds per image. Uses more API credits.
            </div>
        </div>
    ),
    SPEED_FAST: (
        <div className="space-y-1">
            <div className="font-bold text-white">Real-time Processing</div>
            <div className="text-stone-300">
                Process images immediately one-by-one. Results appear as they complete.
                Standard API pricing applies.
            </div>
        </div>
    ),
    SPEED_ECONOMY: (
        <div className="space-y-1">
            <div className="font-bold text-white">Batch Processing (50% Off)</div>
            <div className="text-stone-300">
                Queue images for batch processing. Results may take 5-30 minutes but cost 50% less.
                Best for large jobs where speed isn't critical.
            </div>
        </div>
    ),
    MODULE: (
        <div className="space-y-1">
            <div className="font-bold text-white">Processing Module</div>
            <div className="text-stone-300">
                Modules are pre-written prompts that tell the AI how to process your images.
                Select a preset or write custom instructions.
            </div>
        </div>
    ),
    MODIFICATION_INSTRUCTIONS: (
        <div className="space-y-1">
            <div className="font-bold text-white">Modification Instructions</div>
            <div className="text-stone-300">
                Describe what you want the AI to do with your images. Be specific!
                Example: "Remove background and add soft shadow beneath object"
            </div>
        </div>
    ),
};
