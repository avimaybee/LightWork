import * as React from 'react';
import { WifiOff, Wifi, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ConnectivityToast() {
    const [isOnline, setIsOnline] = React.useState(navigator.onLine);
    const [showToast, setShowToast] = React.useState(false);
    const [dismissed, setDismissed] = React.useState(false);

    React.useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setDismissed(false);
            // Show "back online" briefly then hide
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setDismissed(false);
            setShowToast(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Don't show if dismissed or no toast state
    if (dismissed || !showToast) return null;

    return (
        <div className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]",
            "animate-in slide-in-from-bottom-4 fade-in duration-500"
        )}>
            <div className={cn(
                "flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl",
                "backdrop-blur-xl border",
                isOnline
                    ? "bg-emerald-500/90 border-emerald-400/50 text-white"
                    : "bg-red-500/90 border-red-400/50 text-white"
            )}>
                <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center",
                    isOnline ? "bg-white/20" : "bg-white/20 animate-pulse"
                )}>
                    {isOnline ? (
                        <Wifi className="w-4 h-4" />
                    ) : (
                        <WifiOff className="w-4 h-4" />
                    )}
                </div>

                <div>
                    <p className="font-display font-bold text-sm">
                        {isOnline ? "Back Online" : "Connection Lost"}
                    </p>
                    <p className="text-xs opacity-80">
                        {isOnline
                            ? "Your connection has been restored."
                            : "Check your internet connection."}
                    </p>
                </div>

                {!isOnline && (
                    <button
                        onClick={() => setDismissed(true)}
                        className="ml-2 p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
