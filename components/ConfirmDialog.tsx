import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
}) => {
    const variantStyles = {
        danger: {
            icon: <Trash2 className="w-6 h-6 text-red-600" />,
            iconBg: 'bg-red-50 border-red-100',
            confirmBtn: 'bg-red-600 hover:bg-red-700 text-white',
        },
        warning: {
            icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
            iconBg: 'bg-amber-50 border-amber-100',
            confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
        },
        default: {
            icon: <AlertTriangle className="w-6 h-6 text-stone-600" />,
            iconBg: 'bg-stone-50 border-stone-200',
            confirmBtn: 'bg-stone-900 hover:bg-stone-800 text-white',
        },
    };

    const styles = variantStyles[variant];

    // Handle Escape key
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onCancel();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
                        onClick={onCancel}
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="relative w-full max-w-md mx-4 bg-[#FDFCFB] rounded-2xl shadow-2xl shadow-stone-900/20 border border-stone-200/50 overflow-hidden"
                    >
                        {/* Close button */}
                        <button
                            onClick={onCancel}
                            className="absolute top-4 right-4 p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Content */}
                        <div className="px-6 pt-6 pb-4">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl border ${styles.iconBg} shrink-0`}>
                                    {styles.icon}
                                </div>
                                <div className="min-w-0 pt-1">
                                    <h3 className="text-lg font-heading font-bold text-stone-900 mb-1">
                                        {title}
                                    </h3>
                                    <p className="text-sm text-stone-600 leading-relaxed">
                                        {message}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-3">
                            <button
                                onClick={onCancel}
                                className="px-4 py-2.5 rounded-xl text-sm font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                            >
                                {cancelLabel}
                            </button>
                            <button
                                onClick={onConfirm}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 ${styles.confirmBtn}`}
                            >
                                {confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

// Hook for easy confirmation dialog usage
export function useConfirmDialog() {
    const [state, setState] = React.useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        variant?: 'danger' | 'warning' | 'default';
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
    });

    const confirm = React.useCallback(
        (options: {
            title: string;
            message: string;
            confirmLabel?: string;
            cancelLabel?: string;
            variant?: 'danger' | 'warning' | 'default';
        }): Promise<boolean> => {
            return new Promise((resolve) => {
                setState({
                    ...options,
                    isOpen: true,
                    onConfirm: () => {
                        setState((prev) => ({ ...prev, isOpen: false }));
                        resolve(true);
                    },
                });
            });
        },
        []
    );

    const cancel = React.useCallback(() => {
        setState((prev) => ({ ...prev, isOpen: false }));
    }, []);

    const ConfirmDialogComponent = React.useCallback(
        () => (
            <ConfirmDialog
                isOpen={state.isOpen}
                title={state.title}
                message={state.message}
                confirmLabel={state.confirmLabel}
                cancelLabel={state.cancelLabel}
                variant={state.variant}
                onConfirm={() => state.onConfirm?.()}
                onCancel={cancel}
            />
        ),
        [state, cancel]
    );

    return { confirm, ConfirmDialogComponent };
}
