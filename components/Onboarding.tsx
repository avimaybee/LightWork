import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to LightWork",
      desc: "Your cinematic utility for high-fidelity batch image processing. Let's get you set up.",
      target: "center"
    },
    {
      title: "Batch Context",
      desc: "Use the Command Dock below to set global instructions or 'Modules' that apply to all your images.",
      target: "bottom"
    },
    {
      title: "Rapid Refinement",
      desc: "Upload assets, select models (Nano Banana/Pro), and refine specific images with local prompts.",
      target: "top"
    }
  ];

  if (step >= steps.length) {
      onComplete();
      return null;
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
        <button onClick={onComplete} className="absolute top-4 right-4 text-stone-400 hover:text-stone-900">
          <X className="w-5 h-5" />
        </button>
        
        <div className="mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4 text-orange-600 font-bold font-display text-xl">
                {step + 1}
            </div>
            <h2 className="text-2xl font-display font-bold text-stone-900 mb-2">{steps[step].title}</h2>
            <p className="text-stone-600 leading-relaxed">{steps[step].desc}</p>
        </div>

        <div className="flex items-center justify-between mt-8">
            <div className="flex gap-1.5">
                {steps.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-orange-international' : 'w-1.5 bg-stone-200'}`} />
                ))}
            </div>
            <button 
                onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : onComplete()}
                className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-lg hover:bg-stone-800 transition-colors font-medium text-sm"
            >
                <span>{step === steps.length - 1 ? 'Get Started' : 'Next'}</span>
                <ArrowRight className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
};