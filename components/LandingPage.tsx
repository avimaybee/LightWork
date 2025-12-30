import React, { useMemo, useState } from 'react';
import { useAuth } from '../services/authContext';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Mail,
  UploadCloud,
  X,
} from 'lucide-react';

type AuthMode = 'signin' | 'signup';

interface AuthFormProps {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ mode, setMode }) => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const title = mode === 'signin' ? 'Sign in' : 'Create account';
  const subtitle =
    mode === 'signin'
      ? 'Pick up where your projects left off.'
      : 'Start a fresh workspace in under a minute.';

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    clearError();
    setEmail('');
    setPassword('');
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsLoading(true);
    try {
      if (mode === 'signin') await signInWithEmail(email, password);
      else await signUpWithEmail(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative rounded-[28px] border border-stone-200/70 bg-[#FDFCFB] shadow-2xl shadow-stone-900/10 overflow-hidden">
      <div className="px-8 pt-8 pb-7">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-heading font-bold text-stone-900 tracking-tight">{title}</h2>

          <div className="flex rounded-xl bg-stone-100 p-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                clearError();
              }}
              className={`px-3 h-9 rounded-lg text-[11px] font-heading font-bold uppercase tracking-wider transition-all ${mode === 'signin'
                  ? 'bg-white text-stone-900 shadow-sm ring-1 ring-black/5'
                  : 'text-stone-500 hover:text-stone-700'
                }`}
              disabled={isLoading}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                clearError();
              }}
              className={`px-3 h-9 rounded-lg text-[11px] font-heading font-bold uppercase tracking-wider transition-all ${mode === 'signup'
                  ? 'bg-white text-stone-900 shadow-sm ring-1 ring-black/5'
                  : 'text-stone-500 hover:text-stone-700'
                }`}
              disabled={isLoading}
            >
              Sign up
            </button>
          </div>
        </div>

        <p className="mt-2 text-sm text-stone-500 font-sans max-w-sm">{subtitle}</p>

        {error && (
          <div className="mt-5 flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 flex-1 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={clearError}
              className="text-red-400 hover:text-red-600"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-[0.22em] text-stone-500 font-heading">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-12 pr-4 h-12 bg-stone-50 border border-stone-200 rounded-2xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-clay-500/30 focus:border-clay-500 transition-all"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-[0.22em] text-stone-500 font-heading">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-12 h-12 bg-stone-50 border border-stone-200 rounded-2xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-clay-500/30 focus:border-clay-500 transition-all"
                disabled={isLoading}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-12 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white font-heading font-bold text-xs uppercase tracking-[0.22em] rounded-2xl shadow-lg shadow-stone-900/20 hover:shadow-xl hover:shadow-stone-900/30 disabled:shadow-none transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{mode === 'signin' ? 'Continue' : 'Create account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-4 bg-[#FDFCFB] text-stone-400 font-heading font-bold tracking-[0.22em]">
                or
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={isLoading}
            className="w-full h-12 bg-white border-2 border-stone-200 hover:border-stone-300 hover:bg-stone-50 text-stone-700 font-heading font-bold text-xs uppercase tracking-[0.22em] rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>
        </form>
      </div>

      <div className="px-8 py-6 bg-stone-50 border-t border-stone-100">
        <p className="text-sm text-stone-500">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
          <button
            type="button"
            onClick={switchMode}
            disabled={isLoading}
            className="ml-2 text-clay-700 hover:text-clay-800 font-bold underline underline-offset-2 decoration-clay-300 hover:decoration-clay-500 transition-colors disabled:opacity-60"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};

export const AuthModal: React.FC<{ isOpen: boolean; onClose?: () => void }> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<AuthMode>('signin');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#F2F0E9]/80 backdrop-blur-sm" onClick={onClose} />

      {/* Paper grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-12 right-0 text-stone-500 hover:text-stone-900 transition-colors p-2"
          >
            <X className="w-6 h-6" />
          </button>
        )}
        <AuthForm mode={mode} setMode={setMode} />

        {/* Decorative blooms */}
        <div className="pointer-events-none absolute -z-10 -bottom-8 -right-8 w-32 h-32 bg-clay-200/30 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -z-10 -top-10 -left-8 w-28 h-28 bg-clay-300/20 rounded-full blur-2xl" />
      </div>
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('signin');

  const accentPills = useMemo(
    () => [
      { label: 'Batch-first', Icon: UploadCloud },
      { label: 'Modules', Icon: Layers },
      { label: 'Cinematic output', Icon: ImageIcon },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[#F2F0E9] relative overflow-hidden">
      {/* Paper grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Soft clay bloom */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-clay-200/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-112 w-112 rounded-full bg-clay-300/15 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 sm:px-8">
        <div className="min-h-screen flex flex-col">
          <div className="flex-1 flex items-center py-12 md:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start w-full">
              {/* Left: editorial hero */}
              <div className="lg:col-span-7 lg:pr-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-[#FDFCFB]/70 backdrop-blur px-4 py-2 shadow-sm">
                  <span className="text-[10px] font-heading font-bold uppercase tracking-[0.22em] text-stone-500">
                    AI image processor
                  </span>
                  <span className="h-1 w-1 rounded-full bg-clay-500" />
                  <span className="text-[11px] font-sans font-medium text-stone-600">Utility-first. Output-minded.</span>
                </div>

                <h1 className="mt-7 font-logo text-6xl sm:text-7xl font-light tracking-tight text-stone-900 leading-[0.95]">
                  LightWork<span className="text-clay-500">.</span>
                </h1>

                <p className="mt-5 text-stone-600 text-base sm:text-lg leading-relaxed max-w-xl font-sans">
                  A calm workspace for high-fidelity batch processing — tuned for fast iteration, clean prompts, and repeatable results.
                </p>

                <div className="mt-9 flex flex-wrap gap-3">
                  {accentPills.map(({ label, Icon }) => (
                    <div
                      key={label}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-[#FDFCFB] px-4 py-2 shadow-sm"
                    >
                      <Icon className="w-4 h-4 text-clay-600" />
                      <span className="text-xs font-heading font-bold uppercase tracking-wider text-stone-700">{label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                  <div className="rounded-2xl border border-stone-200/70 bg-[#FDFCFB]/80 backdrop-blur px-5 py-4 shadow-sm">
                    <div className="text-[10px] font-heading font-bold uppercase tracking-[0.24em] text-stone-400">01</div>
                    <div className="mt-2 text-sm font-heading font-bold text-stone-900">Project memory</div>
                    <div className="mt-1 text-xs text-stone-600 leading-relaxed">
                      Projects stay tidy, prompts stay attached.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200/70 bg-[#FDFCFB]/80 backdrop-blur px-5 py-4 shadow-sm">
                    <div className="text-[10px] font-heading font-bold uppercase tracking-[0.24em] text-stone-400">02</div>
                    <div className="mt-2 text-sm font-heading font-bold text-stone-900">Module presets</div>
                    <div className="mt-1 text-xs text-stone-600 leading-relaxed">
                      Save the look. Reuse it on demand.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200/70 bg-[#FDFCFB]/80 backdrop-blur px-5 py-4 shadow-sm">
                    <div className="text-[10px] font-heading font-bold uppercase tracking-[0.24em] text-stone-400">03</div>
                    <div className="mt-2 text-sm font-heading font-bold text-stone-900">Batch control</div>
                    <div className="mt-1 text-xs text-stone-600 leading-relaxed">
                      Queue, refine, rerun — without chaos.
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: auth card */}
              <div className="lg:col-span-5 lg:pl-6">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-[28px] bg-clay-200/20 blur-xl" />
                  <AuthForm mode={mode} setMode={setMode} />
                  <div className="pointer-events-none absolute -z-10 -bottom-8 -right-8 w-32 h-32 bg-clay-200/30 rounded-full blur-3xl" />
                  <div className="pointer-events-none absolute -z-10 -top-10 -left-8 w-28 h-28 bg-clay-300/20 rounded-full blur-2xl" />
                </div>
              </div>
            </div>
          </div>

          <div className="pb-10 md:pb-12 text-center text-[11px] text-stone-400 font-sans">
            <span className="font-heading font-bold uppercase tracking-[0.22em] text-stone-500">Tip</span>
            <span className="mx-2 text-stone-300">—</span>
            Use modules to keep your look consistent across batches.
          </div>
        </div>
      </div>
    </div>
  );
};
