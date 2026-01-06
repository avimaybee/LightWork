import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface SidebarContextValue {
    /** Whether the sidebar is open (mobile) */
    isOpen: boolean;
    /** Whether the sidebar is collapsed to icon rail (desktop) */
    isCollapsed: boolean;
    /** Open the sidebar (mobile) */
    open: () => void;
    /** Close the sidebar (mobile) */
    close: () => void;
    /** Toggle open/closed (mobile) */
    toggle: () => void;
    /** Toggle collapsed/expanded (desktop) */
    toggleCollapse: () => void;
    /** Set collapsed state directly */
    setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

const COLLAPSED_KEY = 'lightwork_sidebar_collapsed';

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    // Mobile: open/closed state
    const [isOpen, setIsOpen] = useState(false);

    // Desktop: collapsed/expanded state (persisted)
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try {
            return localStorage.getItem(COLLAPSED_KEY) === 'true';
        } catch {
            return false;
        }
    });

    // Persist collapsed state
    useEffect(() => {
        try {
            localStorage.setItem(COLLAPSED_KEY, String(isCollapsed));
        } catch {
            // ignore
        }
    }, [isCollapsed]);

    // Close mobile sidebar on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Prevent body scroll when mobile sidebar is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen(prev => !prev), []);
    const toggleCollapse = useCallback(() => setIsCollapsed(prev => !prev), []);

    const value: SidebarContextValue = {
        isOpen,
        isCollapsed,
        open,
        close,
        toggle,
        toggleCollapse,
        setCollapsed: setIsCollapsed,
    };

    return (
        <SidebarContext.Provider value={value}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar(): SidebarContextValue {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
}
