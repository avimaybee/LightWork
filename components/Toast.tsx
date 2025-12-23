import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, CheckCircle2, Info } from 'lucide-react';

export interface ToastMsg {
    id: string;
    type: 'success' | 'info' | 'error';
    text: string;
}

export const ToastContainer: React.FC<{ toasts: ToastMsg[] }> = ({ toasts }) => {
    return (
        <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className="animate-in slide-in-from-right-12 fade-in duration-300 bg-white shadow-lg border border-stone-100 rounded-lg p-3 flex items-center gap-3 pr-6 min-w-[240px]">
                    {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {t.type === 'error' && <WifiOff className="w-5 h-5 text-red-500" />}
                    {t.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
                    <span className="text-sm font-medium text-stone-700">{t.text}</span>
                </div>
            ))}
        </div>
    );
};