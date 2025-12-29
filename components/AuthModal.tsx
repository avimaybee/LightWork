import React, { useState } from 'react';
import { useAuth } from '../services/authContext';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, X } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
}

export function AuthModal({ isOpen }: AuthModalProps) {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail, error, clearError } = useAuth();
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        setIsLoading(true);
        try {
            if (mode === 'signin') {
                await signInWithEmail(email, password);
            } else {
                await signUpWithEmail(email, password);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        try {
            await signInWithGoogle();
        } finally {
            setIsLoading(false);
        }
    };

    const switchMode = () => {
        setMode(mode === 'signin' ? 'signup' : 'signin');
        clearError();
        setEmail('');
        setPassword('');
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
            {/* Backdrop with blur and subtle grain texture */}
            <div className="absolute inset-0 bg-[#F2F0E9]/95 backdrop-blur-sm">
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    }}
                />
            </div>

            {/* Modal Card */}
            <div className="relative w-full max-w-md mx-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-[#FDFCFB] rounded-3xl shadow-2xl shadow-stone-900/10 border border-stone-200/50 overflow-hidden">

                    {/* Header */}
                    <div className="px-10 pt-12 pb-8 text-center">
                        <h1 className="font-logo text-4xl font-light text-stone-900 tracking-tight mb-2">
                            LightWork<span className="text-clay-500">.</span>
                        </h1>
                        <p className="text-stone-500 text-sm font-sans">
                            {mode === 'signin' ? 'Welcome back. Sign in to continue.' : 'Create your account to get started.'}
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mx-10 mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700 flex-1">{error}</p>
                            <button onClick={clearError} className="text-red-400 hover:text-red-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="px-10 pb-8 space-y-5">
                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-wide text-stone-500 font-heading">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-clay-500/30 focus:border-clay-500 transition-all"
                                    disabled={isLoading}
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-wide text-stone-500 font-heading">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-12 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-clay-500/30 focus:border-clay-500 transition-all"
                                    disabled={isLoading}
                                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || !email || !password}
                            className="w-full py-4 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white font-heading font-bold text-sm uppercase tracking-wide rounded-xl shadow-lg shadow-stone-900/20 hover:shadow-xl hover:shadow-stone-900/30 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                mode === 'signin' ? 'Sign In' : 'Create Account'
                            )}
                        </button>

                        {/* Divider */}
                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-stone-200"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="px-4 bg-[#FDFCFB] text-stone-400 font-heading font-bold tracking-wide">or</span>
                            </div>
                        </div>

                        {/* Google Sign In */}
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            className="w-full py-4 bg-white border-2 border-stone-200 hover:border-stone-300 hover:bg-stone-50 text-stone-700 font-heading font-bold text-sm uppercase tracking-wide rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>
                    </form>

                    {/* Footer - Mode Switch */}
                    <div className="px-10 py-6 bg-stone-50 border-t border-stone-100 text-center">
                        <p className="text-sm text-stone-500">
                            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
                            <button
                                onClick={switchMode}
                                className="ml-2 text-clay-600 hover:text-clay-700 font-bold underline underline-offset-2 decoration-clay-300 hover:decoration-clay-500 transition-colors"
                            >
                                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                            </button>
                        </p>
                    </div>
                </div>

                {/* Decorative Element */}
                <div className="absolute -z-10 -bottom-6 -right-6 w-32 h-32 bg-clay-200/30 rounded-full blur-3xl" />
                <div className="absolute -z-10 -top-6 -left-6 w-24 h-24 bg-clay-300/20 rounded-full blur-2xl" />
            </div>
        </div>
    );
}
