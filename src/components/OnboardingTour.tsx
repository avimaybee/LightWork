import * as React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sparkles, Box, FileUp, ChevronRight } from 'lucide-react';

const STEPS = [
    {
        title: "Welcome to LightWork",
        description: "Your professional visual intelligence command center. Automate complex image workflows with precision.",
        icon: Sparkles,
        color: "text-[var(--color-accent)]",
    },
    {
        title: "Select Intelligence",
        description: "Modules define the 'Brain' of your workflow. Choose 'Real Estate' for property enhancement or 'E-Commerce' for product shots.",
        icon: Box,
        color: "text-blue-500",
    },
    {
        title: "Ingest & Refine",
        description: "Drag and drop your assets. You can refine the global workflow logic or tweak specific image prompts before processing.",
        icon: FileUp,
        color: "text-emerald-500",
    }
];

export function OnboardingTour() {
    const [step, setStep] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);

    React.useEffect(() => {
        const hasSeen = localStorage.getItem('has_seen_onboarding');
        if (!hasSeen) {
            // Small delay for drama
            setTimeout(() => setIsVisible(true), 1000);
        }
    }, []);

    const handleNext = () => {
        if (step < STEPS.length - 1) {
            setStep(step + 1);
        } else {
            handleClose();
        }
    };

    const handleClose = () => {
        setIsVisible(false);
        localStorage.setItem('has_seen_onboarding', 'true');
    };

    if (!isVisible) return null;

    const currentStep = STEPS[step];
    const Icon = currentStep.icon;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-white/80 backdrop-blur-xl animate-in fade-in duration-500" 
                onClick={handleClose}
            />

            {/* Card */}
            <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[32px] shadow-2xl shadow-black/10 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 p-8">
                {/* Noise Texture */}
                <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center text-center">
                    {/* Animated Icon */}
                    <div className={cn(
                        "w-20 h-20 rounded-[24px] bg-white border border-[var(--color-border)] flex items-center justify-center mb-8 shadow-xl shadow-black/5",
                        "transition-all duration-500 transform",
                        step === 0 ? "rotate-3 scale-100" : step === 1 ? "-rotate-3 scale-100" : "rotate-0 scale-100"
                    )}>
                        <Icon className={cn("w-10 h-10 transition-colors duration-500", currentStep.color)} />
                    </div>

                    {/* Text Content */}
                    <div className="space-y-4 mb-8 h-32">
                        <h2 key={`title-${step}`} className="font-display font-black text-2xl tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {currentStep.title}
                        </h2>
                        <p key={`desc-${step}`} className="text-[var(--color-ink-sub)] font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
                            {currentStep.description}
                        </p>
                    </div>

                    {/* Progress Indicators */}
                    <div className="flex gap-2 mb-8">
                        {STEPS.map((_, i) => (
                            <div 
                                key={i}
                                className={cn(
                                    "w-2 h-2 rounded-full transition-all duration-300",
                                    i === step ? "w-8 bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
                                )}
                            />
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="w-full flex gap-3">
                        <Button 
                            variant="ghost" 
                            onClick={handleClose}
                            className="flex-1 font-bold text-[var(--color-ink-sub)] hover:text-[var(--color-ink)]"
                        >
                            Skip
                        </Button>
                        <Button 
                            onClick={handleNext}
                            className="flex-[2] rounded-xl bg-[var(--color-ink)] hover:bg-[var(--color-accent)] text-white font-display font-bold shadow-xl shadow-black/5"
                        >
                            {step === STEPS.length - 1 ? "Get Started" : "Next"}
                            {step < STEPS.length - 1 && <ChevronRight className="w-4 h-4 ml-2" />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
