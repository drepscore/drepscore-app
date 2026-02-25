'use client';

import { Shield, Users, Vote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WhatIsDRepModal } from './InfoModal';

const STEPS = [
  { icon: Shield, text: 'Your ADA stays in your wallet' },
  { icon: Users, text: 'Pick a DRep who shares your values' },
  { icon: Vote, text: 'They vote on proposals for you' },
];

export function HeroSection() {
  const scrollToTable = () => {
    const el = document.getElementById('drep-table');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15 animate-gradient-shift" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

      <div className="relative z-10 px-6 py-12 md:py-16 text-center space-y-6 max-w-3xl mx-auto">
        <div className="space-y-3 animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
            Your ADA. Your Voice.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Cardano lets you choose a representative to vote on your behalf.
            We help you find the right one.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-in-up animation-delay-200">
          {STEPS.map(({ icon: Icon, text }, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3 animate-fade-in-up animation-delay-400">
          <Button size="lg" onClick={scrollToTable} className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
            Find Your DRep
          </Button>
          <WhatIsDRepModal />
        </div>
      </div>
    </section>
  );
}
