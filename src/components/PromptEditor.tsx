import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Lock, ChevronDown, ChevronUp } from 'lucide-react';

interface PromptEditorProps {
    isOpen: boolean;
    onClose: () => void;
    prompt: string;
    onSave: (prompt: string) => void;
    systemPrompt?: string;
    title?: string;
    placeholder?: string;
    className?: string;
    storageKey?: string;
}

export function PromptEditor({
    isOpen,
    onClose,
    prompt,
    onSave,
    systemPrompt,
    title = 'Edit Prompt',
    placeholder = 'Add specific instructions for this image...',
    className,
    storageKey,
}: PromptEditorProps) {
    const [value, setValue] = React.useState(prompt);
    const [history, setHistory] = React.useState<string[]>([prompt]);
    const [historyIndex, setHistoryIndex] = React.useState(0);
    const [isSystemExpanded, setIsSystemExpanded] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Load draft from storage on mount/open if exists
    React.useEffect(() => {
        if (isOpen && storageKey) {
            const draft = localStorage.getItem(storageKey);
            if (draft && draft !== prompt) {
                setValue(draft);
                setHistory([prompt, draft]);
                setHistoryIndex(1);
            } else {
                setValue(prompt);
                setHistory([prompt]);
                setHistoryIndex(0);
            }
        } else {
            setValue(prompt);
            setHistory([prompt]);
            setHistoryIndex(0);
        }
    }, [prompt, isOpen, storageKey]);

    // Save to storage on change
    React.useEffect(() => {
        if (!storageKey) return;
        const timer = setTimeout(() => {
            localStorage.setItem(storageKey, value);
        }, 500);
        return () => clearTimeout(timer);
    }, [value, storageKey]);

    React.useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isOpen]);

    const handleValueChange = (newValue: string) => {
        setValue(newValue);
        // Add to history with debounce-like behavior could be better, but for now simple push
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newValue);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setValue(history[newIndex]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setValue(history[newIndex]);
        }
    };

    const handleSave = () => {
        onSave(value);
        if (storageKey) localStorage.removeItem(storageKey);
        onClose();
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
                <SheetHeader className="mb-4 flex flex-row items-center justify-between">
                    <SheetTitle
                        className="text-lg font-semibold text-foreground"
                    >
                        {title}
                    </SheetTitle>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleUndo}
                            disabled={historyIndex === 0}
                            className="h-8 w-8 p-0"
                            title="Undo (Ctrl+Z)"
                        >
                            <span className="sr-only">Undo</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRedo}
                            disabled={historyIndex === history.length - 1}
                            className="h-8 w-8 p-0"
                            title="Redo (Ctrl+Y)"
                        >
                            <span className="sr-only">Redo</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
                        </Button>
                    </div>
                </SheetHeader>

                <div className="flex flex-col h-[calc(100%-80px)] gap-4">
                    {/* System Context Block (Non-editable) */}
                    {systemPrompt && (
                        <div className="border border-border/60 rounded-xl overflow-hidden bg-muted/30">
                            <button
                                onClick={() => setIsSystemExpanded(!isSystemExpanded)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        System Context
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                        Read-only
                                    </span>
                                </div>
                                {isSystemExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                            </button>

                            {isSystemExpanded && (
                                <div className="px-4 pb-4">
                                    <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                                        {systemPrompt}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Visual Separator */}
                    {systemPrompt && (
                        <div className="flex items-center gap-3 px-1">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Your Instructions
                            </span>
                            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
                        </div>
                    )}

                    {/* User Prompt Textarea (Editable) */}
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => handleValueChange(e.target.value)}
                        onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                                e.preventDefault();
                                if (e.shiftKey) handleRedo();
                                else handleUndo();
                            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                                e.preventDefault();
                                handleRedo();
                            }
                        }}
                        placeholder={placeholder}
                        className={cn(
                            'flex-1 w-full p-4 rounded-xl resize-none',
                            'text-base leading-relaxed',
                            'bg-background text-foreground border border-border',
                            'placeholder:text-muted-foreground/70',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                            className
                        )}
                    />

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 h-12 text-muted-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            className="flex-1 h-12"
                        >
                            Save
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// Global prompt editor (inline for desktop, sheet for mobile)
interface GlobalPromptEditorProps {
    value: string;
    onChange: (value: string) => void;
    modulePromptPreview?: string;
    className?: string;
}

export function GlobalPromptEditor({
    value,
    onChange,
    modulePromptPreview,
    className,
}: GlobalPromptEditorProps) {
    const [isExpanded, setIsExpanded] = React.useState(false);

    return (
        <div className={cn('space-y-3', className)}>
            {/* System Context Block (Always visible when present) */}
            {modulePromptPreview && (
                <div className="border border-border/60 rounded-xl overflow-hidden bg-muted/30">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Module System Prompt
                            </span>
                        </div>
                        {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                    </button>

                    {isExpanded && (
                        <div className="px-3 pb-3 border-t border-border/40">
                            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto pt-2">
                                {modulePromptPreview}
                            </pre>
                        </div>
                    )}
                </div>
            )}

            {/* Visual Separator */}
            {modulePromptPreview && (
                <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                    <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground/70">
                        Additional Instructions
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
                </div>
            )}

            {/* User Input Label (only when no system prompt) */}
            {!modulePromptPreview && (
                <label className="text-sm font-medium text-muted-foreground">
                    Additional Instructions (optional)
                </label>
            )}

            {/* User Prompt Textarea */}
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="e.g., Make the lighting moodier, use warmer tones..."
                rows={3}
                className={cn(
                    'w-full p-3 rounded-xl resize-none',
                    'text-sm leading-relaxed',
                    'bg-surface text-foreground border border-border',
                    'placeholder:text-muted-foreground/70',
                    'transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                )}
            />
        </div>
    );
}

