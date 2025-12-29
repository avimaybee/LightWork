import React from 'react';
import { Toaster, toast } from 'sonner';
import { Wifi, WifiOff, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export interface ToastMsg {
    id: string;
    type: 'success' | 'info' | 'error' | 'warning';
    text: string;
}

// Legacy ToastContainer - keeping for backward compatibility
// Now uses sonner's Toaster internally
export const ToastContainer: React.FC<{ toasts: ToastMsg[] }> = ({ toasts }) => {
    // Display toasts using sonner when they change
    React.useEffect(() => {
        toasts.forEach(t => {
            // Check if this toast is already shown by checking sonner's internal state
            // Sonner handles deduplication by id automatically
            if (t.type === 'success') {
                toast.success(t.text, { id: t.id });
            } else if (t.type === 'error') {
                toast.error(t.text, { id: t.id });
            } else if (t.type === 'warning') {
                toast.warning(t.text, { id: t.id });
            } else {
                toast.info(t.text, { id: t.id });
            }
        });
    }, [toasts]);

    return (
        <Toaster 
            position="top-right"
            expand={true}
            richColors
            closeButton
            toastOptions={{
                duration: 3000,
                className: 'font-sans',
                style: {
                    background: '#FDFCFB',
                    border: '1px solid #e7e5e4',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                },
            }}
        />
    );
};

// Modern toast API for direct usage
// Use these functions instead of managing toasts state manually
export const showToast = {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    warning: (message: string) => toast.warning(message),
    info: (message: string) => toast.info(message),
    loading: (message: string) => toast.loading(message),
    dismiss: (id?: string) => toast.dismiss(id),
    promise: <T,>(
        promise: Promise<T>,
        messages: { loading: string; success: string; error: string }
    ) => toast.promise(promise, messages),
};