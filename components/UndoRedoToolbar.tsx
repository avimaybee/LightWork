import React from 'react';
import { Undo2, Redo2 } from 'lucide-react';

interface UndoRedoToolbarProps {
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    historyLength?: number;
}

export const UndoRedoToolbar: React.FC<UndoRedoToolbarProps> = ({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    historyLength = 0
}) => {


    return (
        <div className="flex items-center gap-1 glass rounded-lg px-1.5 py-1 shadow-sm">
            <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`p-2 rounded-md transition-all flex items-center justify-center ${canUndo
                    ? 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 active:scale-95'
                    : 'text-stone-300 cursor-not-allowed'
                    }`}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
            >
                <Undo2 className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="w-px h-5 bg-stone-200" />

            <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`p-2 rounded-md transition-all flex items-center justify-center ${canRedo
                    ? 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 active:scale-95'
                    : 'text-stone-300 cursor-not-allowed'
                    }`}
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo"
            >
                <Redo2 className="w-4 h-4" aria-hidden="true" />
            </button>

            {historyLength > 0 && (
                <>
                    <div className="w-px h-5 bg-stone-200" />
                    <span className="text-[10px] font-medium text-stone-400 px-1.5 tabular-nums">
                        {historyLength}
                    </span>
                </>
            )}
        </div>
    );
};
