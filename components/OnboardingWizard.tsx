'use client';

import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { UserPrefKey } from '@/types/drep';
import { 
  Vault, 
  Coins, 
  Users, 
  Lock, 
  Zap, 
  Eye, 
  Check,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (prefs: UserPrefKey[]) => void;
  initialPrefs?: UserPrefKey[];
}

const PREF_OPTIONS: {
  key: UserPrefKey;
  icon: React.ElementType;
  title: string;
  description: string;
}[] = [
  {
    key: 'treasury-conservative',
    icon: Vault,
    title: 'Treasury Conservative',
    description: 'Prioritize DReps who are cautious with treasury spending.',
  },
  {
    key: 'smart-treasury-growth',
    icon: Coins,
    title: 'Smart Treasury Growth',
    description: 'Support DReps who vote for effective treasury usage and growth.',
  },
  {
    key: 'strong-decentralization',
    icon: Users,
    title: 'Strong Decentralization',
    description: 'Boost smaller DReps and those with high decentralization scores.',
  },
  {
    key: 'protocol-security-first',
    icon: Lock,
    title: 'Protocol Security',
    description: 'Favor DReps who demonstrate high engagement and rationale.',
  },
  {
    key: 'innovation-defi-growth',
    icon: Zap,
    title: 'Innovation & DeFi',
    description: 'Support active DReps participating in ecosystem growth.',
  },
  {
    key: 'responsible-governance',
    icon: Eye,
    title: 'Responsible Governance',
    description: 'Prioritize DReps who consistently explain their votes.',
  },
];

export function OnboardingWizard({ 
  open, 
  onOpenChange, 
  onComplete, 
  initialPrefs = [] 
}: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedPrefs, setSelectedPrefs] = useState<UserPrefKey[]>(initialPrefs);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedPrefs(initialPrefs);
      setShowSuccess(false);
    }
  }, [open, initialPrefs]);

  const togglePref = (key: UserPrefKey) => {
    setSelectedPrefs(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const handleComplete = () => {
    // Fire confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0033A0', '#00C853'], // Cardano Blue & Green
    });

    setShowSuccess(true);

    // Delay closing to show success message
    setTimeout(() => {
      onComplete(selectedPrefs);
    }, 1500);
  };

  const progress = (step / 3) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden">
        <div className="h-1 w-full bg-secondary">
          <Progress value={progress} className="h-1 rounded-none" />
        </div>

        <div className="p-6">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-center">
                  Welcome to DRepScore
                </DialogTitle>
                <DialogDescription className="text-center text-base mt-2">
                  Discover Cardano DReps that align with your values. 
                  Personalize your scorecard to find the best delegates for you.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 pt-4">
                <Button onClick={() => setStep(2)} size="lg" className="w-full">
                  Personalize My View
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => onComplete([])}
                  className="text-muted-foreground"
                >
                  Skip for now
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: My Values */}
          {step === 2 && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle>Select Your Values</DialogTitle>
                <DialogDescription>
                  Choose what matters most to you. We'll boost DReps that match these criteria.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PREF_OPTIONS.map((option) => {
                  const isSelected = selectedPrefs.includes(option.key);
                  const Icon = option.icon;
                  
                  return (
                    <TooltipProvider key={option.key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Card 
                            className={cn(
                              "p-4 cursor-pointer transition-all border-2 hover:border-primary/50 relative",
                              isSelected ? "border-primary bg-primary/5" : "border-transparent bg-secondary/50"
                            )}
                            onClick={() => togglePref(option.key)}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "p-2 rounded-lg",
                                isSelected ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                              )}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="space-y-1 text-left">
                                <h4 className="font-medium leading-none">{option.title}</h4>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {option.description}
                                </p>
                              </div>
                              {isSelected && (
                                <div className="absolute top-3 right-3 text-primary">
                                  <Check className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          </Card>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{option.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>

              <DialogFooter className="flex-col sm:justify-between sm:flex-row gap-3 pt-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button 
                  onClick={() => setStep(3)}
                  disabled={selectedPrefs.length === 0}
                >
                  Continue ({selectedPrefs.length})
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3: All Set */}
          {step === 3 && (
            <div className="space-y-6 text-center py-4">
               {showSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                    <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">Alignment Achieved! 🌱</h3>
                </div>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>You're All Set!</DialogTitle>
                    <DialogDescription>
                      We've personalized the DRep list based on your values.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="py-6">
                    <div className="flex flex-wrap gap-2 justify-center mb-6">
                      {selectedPrefs.map(key => {
                        const opt = PREF_OPTIONS.find(o => o.key === key);
                        if (!opt) return null;
                        const Icon = opt.icon;
                        return (
                          <div key={key} className="flex items-center gap-1.5 px-3 py-1 bg-secondary rounded-full text-sm">
                            <Icon className="w-3 h-3" />
                            <span>{opt.title}</span>
                          </div>
                        );
                      })}
                    </div>
                    
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      Connect your wallet later to delegate to your top matches.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button onClick={handleComplete} size="lg" className="w-full">
                      Show My Personalized DReps
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => setStep(2)}
                    >
                      Back
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
