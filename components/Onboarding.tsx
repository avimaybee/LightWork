import React, { useMemo, useState } from 'react';
import { X, ArrowRight, UploadCloud, Terminal, Download } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const steps = useMemo(() => (
    [
      {
        icon: UploadCloud,
        title: "Upload",
        desc: "Add assets via the header button or drag-and-drop. Your images appear instantly while they upload.",
      },
      {
        icon: Terminal,
        title: "Apply Module",
        desc: "Use the Command Dock to choose a module (or write custom instructions), then process queued images.",
      },
      {
        icon: Download,
        title: "Export",
        desc: "After processing, download your result from the Inspector. Multi-select to export multiple outputs.",
      },
    ]
  ), []);

  if (step >= steps.length) {
      onComplete();
      return null;
  }

  return (
    <div className="fixed inset-0 z-[60] bg-stone-900/35 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in">
      <div className="bg-[#FDFCFB] border border-stone-200 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-stone-900/20 relative font-sans">
        <button onClick={onComplete} className="absolute top-4 right-4 p-2 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors">
          <X className="w-5 h-5" />
        </button>
        
        <div className="mb-6">
            <div className="w-12 h-12 bg-clay-50 border border-clay-100 rounded-xl flex items-center justify-center mb-4 text-clay-600 shadow-sm">
                {(() => {
                  const Icon = steps[step].icon;
                  return <Icon className="w-5 h-5" />;
                })()}
            </div>
            <div className="text-[10px] font-heading font-bold uppercase tracking-[0.22em] text-stone-400 mb-2">Step {step + 1} of {steps.length}</div>
            <h2 className="text-2xl font-heading font-bold text-stone-900 mb-2 tracking-tight">{steps[step].title}</h2>
            <p className="text-stone-600 leading-relaxed text-sm">{steps[step].desc}</p>
        </div>

        <div className="flex items-center justify-between mt-8">
            <div className="flex gap-1.5">
                {steps.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-clay-500' : 'w-1.5 bg-stone-200'}`} />
                ))}
            </div>
            <button 
                onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : onComplete()}
              className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-lg hover:bg-stone-800 transition-colors font-heading font-bold text-xs uppercase tracking-wider"
            >
                <span>{step === steps.length - 1 ? 'Get Started' : 'Next'}</span>
                <ArrowRight className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
};