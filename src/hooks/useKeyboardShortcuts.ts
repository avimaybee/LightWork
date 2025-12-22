import * as React from 'react';


type ShortcutAction = (e: KeyboardEvent) => void;

export function useKeyboardShortcuts(
    shortcuts: Record<string, ShortcutAction>,
    disabled: boolean = false
) {
    React.useEffect(() => {
        if (disabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if focus is in an input or textarea
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target instanceof HTMLSelectElement
            ) {
                return;
            }

            // Iterate over shortcuts to find a match
            // Shortcuts format: 'Meta+Enter', 'Escape', 'g', '1'
            Object.entries(shortcuts).forEach(([combo, action]) => {
                const keys = combo.split('+');
                const mainKey = keys.pop()?.toLowerCase();
                const modifiers = keys.map(k => k.toLowerCase());

                const isCtrl = modifiers.includes('ctrl') || modifiers.includes('control');
                const isMeta = modifiers.includes('meta') || modifiers.includes('cmd') || modifiers.includes('command');
                const isShift = modifiers.includes('shift');
                const isAlt = modifiers.includes('alt');

                // Check modifiers
                if (e.ctrlKey !== isCtrl) return;
                if (e.metaKey !== isMeta) return;
                if (e.shiftKey !== isShift) return;
                if (e.altKey !== isAlt) return;

                // Check key
                if (e.key.toLowerCase() === mainKey) {
                    e.preventDefault();
                    action(e);
                }
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts, disabled]);
}
