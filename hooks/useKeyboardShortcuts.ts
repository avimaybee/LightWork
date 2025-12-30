import { useEffect, useRef } from 'react';

interface ShortcutConfig {
    currentView: string;
    hasSelection: boolean;
    isProcessing: boolean;
    queuedCount: number;
    apiMode: string;
    lightboxOpen: boolean;
    onEscape: () => void;
    onDelete: () => void;
    onSelectAll: () => void;
    onProcess: () => void;
    onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void;
    onSpace: () => void;
}

export function useKeyboardShortcuts({
    currentView,
    hasSelection,
    isProcessing,
    queuedCount,
    apiMode,
    lightboxOpen,
    onEscape,
    onDelete,
    onSelectAll,
    onProcess,
    onNavigate,
    onSpace
}: ShortcutConfig) {

    // Refs to avoid dependency cycles / stale closures in event listener
    const handlers = useRef({ onEscape, onDelete, onSelectAll, onProcess, onNavigate, onSpace });

    useEffect(() => {
        handlers.current = { onEscape, onDelete, onSelectAll, onProcess, onNavigate, onSpace };
    }, [onEscape, onDelete, onSelectAll, onProcess, onNavigate, onSpace]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement as HTMLElement | null;
            const tag = active?.tagName?.toLowerCase();
            const isTypingTarget = tag === 'input' || tag === 'textarea' || (active?.getAttribute?.('contenteditable') === 'true');

            const key = e.key.toLowerCase();
            const isMod = e.ctrlKey || e.metaKey;

            // Global: Escape
            if (key === 'escape' && !isTypingTarget) {
                // Determine if we should handle it (lightbox or selection)
                // Logic is effectively moved to the handler callback
                handlers.current.onEscape();
                return;
            }

            // Global: Space (Lightbox)
            if (key === ' ' && !isTypingTarget && hasSelection) {
                e.preventDefault();
                handlers.current.onSpace();
                return;
            }

            // Global: Delete
            if ((key === 'delete' || key === 'backspace') && !isTypingTarget && hasSelection) {
                e.preventDefault();
                handlers.current.onDelete();
                return;
            }

            // Workspace Specific Controls
            if (currentView !== 'workspace') return;
            if (isTypingTarget) return;

            // Navigation
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                e.preventDefault();
                handlers.current.onNavigate(key.replace('arrow', '') as any);
                return;
            }

            // Select All
            if (isMod && key === 'a') {
                e.preventDefault();
                handlers.current.onSelectAll();
                return;
            }

            // Run Batch
            if (isMod && key === 'enter') {
                e.preventDefault();
                handlers.current.onProcess();
                return;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [currentView, hasSelection, isProcessing, queuedCount, apiMode, lightboxOpen]);
}
