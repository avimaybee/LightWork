import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit3, Copy, Pin, PinOff, Trash2 } from 'lucide-react';

interface ProjectMenuProps {
    projectName: string;
    isPinned: boolean;
    canPin: boolean;
    onRename: () => void;
    onDuplicate?: () => void;
    onTogglePin: () => void;
    onDelete: () => void;
}

export const ProjectMenu: React.FC<ProjectMenuProps> = ({
    projectName,
    isPinned,
    canPin,
    onRename,
    onDuplicate,
    onTogglePin,
    onDelete
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen]);

    const handleAction = (action: () => void) => {
        action();
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className={`p-1.5 rounded-md transition-all ${isOpen
                    ? 'bg-stone-100 text-stone-700'
                    : 'text-stone-300 hover:text-stone-600 hover:bg-stone-50'
                    }`}
                title="Project options"
                aria-label={`Options for ${projectName}`}
                aria-expanded={isOpen}
                aria-haspopup="menu"
            >
                <MoreVertical className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            {isOpen && (
                <div
                    ref={menuRef}
                    className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-stone-200 py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                    role="menu"
                >
                    <button
                        onClick={() => handleAction(onRename)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
                        role="menuitem"
                    >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        Rename
                    </button>

                    {onDuplicate && (
                        <button
                            onClick={() => handleAction(onDuplicate)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
                            role="menuitem"
                        >
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            Duplicate
                        </button>
                    )}

                    {(isPinned || canPin) && (
                        <button
                            onClick={() => handleAction(onTogglePin)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
                            role="menuitem"
                        >
                            {isPinned ? (
                                <>
                                    <PinOff className="w-3.5 h-3.5" aria-hidden="true" />
                                    Unpin
                                </>
                            ) : (
                                <>
                                    <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                                    Pin to top
                                </>
                            )}
                        </button>
                    )}

                    <div className="border-t border-stone-100 my-1" />

                    <button
                        onClick={() => handleAction(onDelete)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        role="menuitem"
                    >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Delete
                    </button>
                </div>
            )}
        </div>
    );
};
