/**
 * Homepage
 * Features hero section with value selector and DRep table
 */

import { Suspense } from 'react';
import { fetchAllDReps, fetchDRepsWithDetails, checkKoiosHealth } from '@/utils/koios';
import { calculateParticipationRate, calculateRationaleRate, calculateDecentralizationScore, lovelaceToAda } from '@/utils/scoring';
import { DRep } from '@/types/drep';
import { DRepTableClient } from '@/components/DRepTableClient';
import { HeroSection } from '@/components/HeroSection';
import { ErrorBanner } from '@/components/ErrorBanner';
import { TableSkeleton } from '@/components/LoadingSkeleton';

async function getDReps(): Promise<{ dreps: DRep[]; error: boolean }> {
  try {
    // Check API health
    const isHealthy = await checkKoiosHealth();
    if (!isHealthy) {
      return { dreps: [], error: true };
    }

    // Fetch all DReps
    const drepList = await fetchAllDReps();
    if (!drepList || drepList.length === 0) {
      return { dreps: [], error: false };
    }

    // Fetch detailed info for all DReps (in batches)
    const drepIds = drepList
      .filter(d => d.registered)
      .map(d => d.drep_id)
      .slice(0, 100); // Limit to first 100 for initial load

    const { info, metadata } = await fetchDRepsWithDetails(drepIds);

    // Transform to app format with calculated metrics
    const dreps: DRep[] = info.map(drepInfo => {
      const drepMetadata = metadata.find(m => m.drep_id === drepInfo.drep_id);
      
      // TODO: Fetch actual vote data for each DRep
      // For now, using placeholder calculations
      const totalVotes = 0; // Would come from vote history
      const totalProposals = 1; // Would come from Koios
      const votes: any[] = []; // Would be actual vote records

      return {
        drepId: drepInfo.drep_id,
        drepHash: drepInfo.drep_hash,
        handle: null, // TODO: Integrate ADA Handle lookup
        votingPower: lovelaceToAda(drepInfo.voting_power || '0'),
        votingPowerLovelace: drepInfo.voting_power || '0',
        participationRate: calculateParticipationRate(totalVotes, totalProposals),
        rationaleRate: calculateRationaleRate(votes),
        decentralizationScore: calculateDecentralizationScore(
          drepInfo.delegators || 0,
          lovelaceToAda(drepInfo.voting_power || '0')
        ),
        delegatorCount: drepInfo.delegators || 0,
        totalVotes,
        yesVotes: 0,
        noVotes: 0,
        abstainVotes: 0,
        isActive: drepInfo.registered && drepInfo.voting_power !== '0',
        anchorUrl: drepInfo.anchor_url,
        metadata: drepMetadata?.json_metadata?.body || null,
      };
    });

    return { dreps, error: false };
  } catch (error) {
    console.error('Error fetching DReps:', error);
    return { dreps: [], error: true };
  }
}

export default async function HomePage() {
  const { dreps, error } = await getDReps();

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <HeroSection />
      
      {error && (
        <ErrorBanner
          message="Unable to fetch DRep data from Cardano network. Please try again later."
          retryable={false}
        />
      )}
      
      <Suspense fallback={<TableSkeleton />}>
        <DRepTableClient initialDReps={dreps} />
      </Suspense>
    </div>
  );
}
