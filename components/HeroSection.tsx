/**
 * Hero Section Component
 * Compact headline with CTA
 */

import { WhatIsDRepModal } from './InfoModal';

export function HeroSection() {
  return (
    <section className="py-8">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Find Your Ideal Cardano DRep
        </h1>
        <p className="text-lg text-muted-foreground">
          Compare accountability scores and value alignment to delegate with confidence.
        </p>
        <div className="flex justify-center pt-1">
          <WhatIsDRepModal />
        </div>
      </div>
    </section>
  );
}
