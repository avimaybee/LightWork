import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PromptEditorProps {
    isOpen: boolean;
    onClose: () => void;
    prompt: string;
    onSave: (prompt: string) => void;
    title?: string;
    placeholder?: string;
    className?: string;
}

export function PromptEditor({
    isOpen,
    onClose,
    prompt,
    onSave,
    title = 'Edit Prompt',
    placeholder = 'Add specific instructions for this image...',
    className,
}: PromptEditorProps) {
    const [value, setValue] = React.useState(prompt);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        setValue(prompt);
    }, [prompt, isOpen]);

    React.useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isOpen]);

    const handleSave = () => {
        onSave(value);
        onClose();
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="h-[60vh] rounded-t-2xl">
                <SheetHeader className="mb-4">
                    <SheetTitle
                        className="text-lg font-semibold text-[var(--color-text-primary)]"
                    >
                        {title}
                    </SheetTitle>
                </SheetHeader>

                <div className="flex flex-col h-[calc(100%-80px)]">
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        className={cn(
                            'flex-1 w-full p-4 rounded-xl resize-none',
                            'text-base leading-relaxed',
                            'focus:outline-none focus:ring-2 focus:ring-[var(--color-line)]',
                            'bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border)]',
                            className
                        )}
                    />

                    <div className="flex gap-3 mt-4">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 h-12 text-[var(--color-text-secondary)] border-[var(--color-border)]"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            className="flex-1 h-12 bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
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
        <div className={cn('space-y-2', className)}>
            <div className="flex items-center justify-between">
                <label
                    className="text-sm font-medium text-[var(--color-text-secondary)]"
                >
                    Additional Instructions (optional)
                </label>
                {modulePromptPreview && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs hover:underline text-[var(--color-primary)]"
                    >
                        {isExpanded ? 'Hide' : 'View'} module prompt
                    </button>
                )}
            </div>

            {isExpanded && modulePromptPreview && (
                <div
                    className="p-3 rounded-lg text-xs max-h-32 overflow-y-auto bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)]/20"
                >
                    <pre className="whitespace-pre-wrap font-mono">
                        {modulePromptPreview}
                    </pre>
                </div>
            )}

            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="e.g., Make the lighting moodier, use warmer tones..."
                rows={3}
                className={cn(
                    'w-full p-3 rounded-xl resize-none',
                    'text-sm leading-relaxed',
                    'border focus:outline-none focus:border-primary',
                    'transition-colors'
                )}
                style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    borderColor: 'var(--color-border)',
                }}
            />
        </div>
    );
}
