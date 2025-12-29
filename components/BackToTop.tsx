import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BackToTopProps {
    /**
     * The scroll container element to monitor.
     * If not provided, will try to find the main scrollable area.
     */
    scrollContainer?: HTMLElement | null;
    /**
     * Scroll threshold (in pixels) before showing the button.
     * Default: 400
     */
    threshold?: number;
}

export const BackToTop: React.FC<BackToTopProps> = ({
    scrollContainer,
    threshold = 400,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [container, setContainer] = useState<HTMLElement | null>(null);

    // Find the scroll container
    useEffect(() => {
        if (scrollContainer) {
            setContainer(scrollContainer);
        } else {
            // Try to find the main scroll container (the workspace area)
            const mainScroll = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement;
            setContainer(mainScroll);
        }
    }, [scrollContainer]);

    // Monitor scroll position
    useEffect(() => {
        if (!container) return;

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            setIsVisible(scrollTop > threshold);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Check initial state

        return () => container.removeEventListener('scroll', handleScroll);
    }, [container, threshold]);

    const scrollToTop = () => {
        if (container) {
            container.scrollTo({
                top: 0,
                behavior: 'smooth',
            });
        }
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 20 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    onClick={scrollToTop}
                    className="fixed bottom-24 right-8 z-40 p-3 bg-white border border-stone-200 rounded-full shadow-lg hover:shadow-xl hover:bg-stone-50 hover:border-stone-300 transition-all group"
                    title="Back to Top"
                    aria-label="Scroll to top"
                >
                    <ChevronUp className="w-5 h-5 text-stone-600 group-hover:text-stone-900 transition-colors" />
                </motion.button>
            )}
        </AnimatePresence>
    );
};

export default BackToTop;
