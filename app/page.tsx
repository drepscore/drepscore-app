/**
 * Homepage
 * Features hero section with value selector and DRep table
 */

import { Suspense } from 'react';
import { fetchAllDReps, fetchDRepsWithDetails, fetchDRepVotes, checkKoiosHealth } from '@/utils/koios';
import { calculateParticipationRate, calculateRationaleRate, calculateDecentralizationScore, lovelaceToAda } from '@/utils/scoring';
import { DRep } from '@/types/drep';
import { DRepTableClient } from '@/components/DRepTableClient';
import { HeroSection } from '@/components/HeroSection';
import { ErrorBanner } from '@/components/ErrorBanner';
import { TableSkeleton } from '@/components/LoadingSkeleton';

async function getDReps(): Promise<{ dreps: DRep[]; error: boolean }> {
  const isDev = process.env.NODE_ENV === 'development';
  
  try {
    if (isDev) {
      console.log('[DRepScore] Starting DRep data fetch...');
    }

    // Check API health
    const isHealthy = await checkKoiosHealth();
    if (!isHealthy) {
      console.error('[DRepScore] Koios API health check failed');
      return { dreps: [], error: true };
    }

    // Fetch all DReps
    const drepList = await fetchAllDReps();
    if (!drepList || drepList.length === 0) {
      if (isDev) {
        console.warn('[DRepScore] No DReps found');
      }
      return { dreps: [], error: false };
    }

    if (isDev) {
      console.log(`[DRepScore] Found ${drepList.length} total DReps`);
    }

    // Fetch detailed info for active DReps (limit to first 50 for performance)
    const drepIds = drepList
      .filter(d => d.registered)
      .map(d => d.drep_id)
      .slice(0, 50); // Reduced limit for faster initial load

    if (isDev) {
      console.log(`[DRepScore] Fetching details for ${drepIds.length} DReps...`);
    }

    const { info, metadata } = await fetchDRepsWithDetails(drepIds);

    if (isDev) {
      console.log(`[DRepScore] Fetching vote history for top DReps...`);
    }

    // Fetch votes for top 20 DReps by voting power for accurate metrics
    const sortedInfo = [...info].sort((a, b) => {
      const aPower = parseInt(a.voting_power || '0');
      const bPower = parseInt(b.voting_power || '0');
      return bPower - aPower;
    });
    
    const topDRepIds = sortedInfo.slice(0, 20).map(d => d.drep_id);
    const votesMap: Record<string, any[]> = {};
    
    // Fetch votes for top DReps
    for (const drepId of topDRepIds) {
      try {
        const votes = await fetchDRepVotes(drepId);
        votesMap[drepId] = votes;
      } catch (error) {
        console.error(`[DRepScore] Failed to fetch votes for ${drepId}:`, error);
        votesMap[drepId] = [];
      }
    }

    // Estimate total proposals for participation calculation
    const totalProposals = Math.max(
      ...Object.values(votesMap).map(votes => votes.length),
      1 // Minimum 1 to avoid division by zero
    );

    if (isDev) {
      console.log(`[DRepScore] Estimated ${totalProposals} total proposals`);
    }

    // Transform to app format with real metrics
    const dreps: DRep[] = info.map(drepInfo => {
      const drepMetadata = metadata.find(m => m.drep_id === drepInfo.drep_id);
      const votes = votesMap[drepInfo.drep_id] || [];
      
      // Calculate vote distribution
      const yesVotes = votes.filter(v => v.vote === 'Yes').length;
      const noVotes = votes.filter(v => v.vote === 'No').length;
      const abstainVotes = votes.filter(v => v.vote === 'Abstain').length;

      return {
        drepId: drepInfo.drep_id,
        drepHash: drepInfo.drep_hash,
        handle: null, // ADA Handle lookup not yet integrated
        votingPower: lovelaceToAda(drepInfo.voting_power || '0'),
        votingPowerLovelace: drepInfo.voting_power || '0',
        participationRate: calculateParticipationRate(votes.length, totalProposals),
        rationaleRate: calculateRationaleRate(votes),
        decentralizationScore: calculateDecentralizationScore(
          drepInfo.delegators || 0,
          lovelaceToAda(drepInfo.voting_power || '0')
        ),
        delegatorCount: drepInfo.delegators || 0,
        totalVotes: votes.length,
        yesVotes,
        noVotes,
        abstainVotes,
        isActive: drepInfo.registered && drepInfo.voting_power !== '0',
        anchorUrl: drepInfo.anchor_url,
        metadata: drepMetadata?.json_metadata?.body || null,
      };
    });

    if (isDev) {
      console.log(`[DRepScore] Successfully loaded ${dreps.length} DReps`);
    }

    return { dreps, error: false };
  } catch (error) {
    console.error('[DRepScore] Error fetching DReps:', error);
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
          message="Koios data unavailable – try refreshing the page"
          retryable={false}
        />
      )}
      
      <Suspense fallback={<TableSkeleton />}>
        <DRepTableClient initialDReps={dreps} />
      </Suspense>
    </div>
  );
}
