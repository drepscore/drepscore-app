/**
 * Hero Section Component
 * Features headline, value proposition, and value selector
 */

import { WhatIsDRepModal } from './InfoModal';

export function HeroSection() {
  return (
    <section className="py-12 space-y-6">
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Find Your Ideal Cardano DRep
        </h1>
        <p className="text-xl text-muted-foreground">
          Discover and delegate to Delegated Representatives who align with your values.
        </p>
        <p className="text-base text-muted-foreground">
          Compare participation rates, voting history, and decentralization scores to make informed delegation decisions.
        </p>
        <div className="flex justify-center">
          <WhatIsDRepModal />
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6 space-y-4 max-w-4xl mx-auto">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Explore Without Connecting</h2>
          <p className="text-sm text-muted-foreground">
            Browse DReps and find representatives that match your values. 
            Connect your wallet only when you're ready to delegate.
          </p>
        </div>
      </div>
    </section>
  );
}
