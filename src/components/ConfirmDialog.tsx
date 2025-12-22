import { AlertTriangle, Trash2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'destructive';
    onConfirm: () => void;
    onCancel?: () => void;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const isDestructive = variant === 'destructive';
    const Icon = isDestructive ? Trash2 : AlertTriangle;

    const handleConfirm = () => {
        onConfirm();
        onOpenChange(false);
    };

    const handleCancel = () => {
        onCancel?.();
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-start gap-4">
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                            isDestructive
                                ? "bg-red-100 text-red-600"
                                : "bg-amber-100 text-amber-600"
                        )}>
                            <Icon className="w-6 h-6" />
                        </div>
                        <div>
                            <AlertDialogTitle className="mb-2">{title}</AlertDialogTitle>
                            <AlertDialogDescription>{description}</AlertDialogDescription>
                        </div>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-4">
                    <AlertDialogCancel
                        onClick={handleCancel}
                        className="h-11 rounded-xl"
                    >
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        className={cn(
                            "h-11 rounded-xl font-bold shadow-lg",
                            isDestructive
                                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                                : "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-[var(--color-accent)]/20"
                        )}
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
