import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const showTooltip = () => {
        timeoutRef.current = window.setTimeout(() => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                let top = 0;
                let left = 0;

                // Calculate position based on trigger element
                switch (position) {
                    case 'top':
                        top = rect.top - 8; // 8px Gap
                        left = rect.left + rect.width / 2;
                        break;
                    case 'bottom':
                        top = rect.bottom + 8;
                        left = rect.left + rect.width / 2;
                        break;
                    case 'left':
                        top = rect.top + rect.height / 2;
                        left = rect.left - 8;
                        break;
                    case 'right':
                        top = rect.top + rect.height / 2;
                        left = rect.right + 8;
                        break;
                }
                setCoords({ top, left });
                setIsVisible(true);
            }
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

    // Animation variants based on position
    const variants = {
        top: { opacity: 1, scale: 1, y: -10, x: "-50%" },
        bottom: { opacity: 1, scale: 1, y: 10, x: "-50%" },
        left: { opacity: 1, scale: 1, x: -10, y: "-50%" },
        right: { opacity: 1, scale: 1, x: 10, y: "-50%" },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1 } }
    };

    // Initial states for animation
    const initial = {
        top: { opacity: 0, scale: 0.95, y: 0, x: "-50%" },
        bottom: { opacity: 0, scale: 0.95, y: 0, x: "-50%" },
        left: { opacity: 0, scale: 0.95, x: 0, y: "-50%" },
        right: { opacity: 0, scale: 0.95, x: 0, y: "-50%" }
    };

    const tooltipContent = (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={initial[position]}
                    animate={variants[position]}
                    exit={variants.exit}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="fixed z-[9999] pointer-events-none"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        maxWidth
                    }}
                >
                    <div className="bg-stone-900/90 text-white text-xs font-sans rounded-lg px-3 py-2 shadow-xl backdrop-blur-md border border-white/10">
                        {content}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            <div
                ref={triggerRef}
                className="relative inline-flex"
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
            >
                {children}
            </div>
            {createPortal(tooltipContent, document.body)}
        </>
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
