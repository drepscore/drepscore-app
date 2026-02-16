/**
 * Homepage
 * Features hero section with value selector and DRep table
 * DRep Score (0-100) is the primary sorting and display metric
 */

import { Suspense } from 'react';
import { getEnrichedDReps } from '@/lib/koios';
import { DRepTableClient } from '@/components/DRepTableClient';
import { HeroSection } from '@/components/HeroSection';
import { ErrorBanner } from '@/components/ErrorBanner';
import { TableSkeleton } from '@/components/LoadingSkeleton';

export default async function HomePage() {
  // Well-documented default: encourages quality DReps with metadata/rationale
  const { dreps, allDReps, error, totalAvailable } = await getEnrichedDReps(true);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <HeroSection />
      
      {error && (
        <ErrorBanner
          message="Koios data unavailable – try refreshing the page"
          retryable={false}
        />
      )}
      
      <Suspense fallback={<TableSkeleton />}>
        <DRepTableClient 
          initialDReps={dreps} 
          allDReps={allDReps}
          totalAvailable={totalAvailable} 
        />
      </Suspense>
    </div>
  );
}
