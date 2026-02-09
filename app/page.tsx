/**
 * Homepage
 * Features hero section with value selector and DRep table
 */

import { Suspense } from 'react';
import { fetchAllDReps, fetchDRepsWithDetails, fetchDRepVotes, checkKoiosHealth, parseMetadataFields } from '@/utils/koios';
import { calculateParticipationRate, calculateRationaleRate, calculateDecentralizationScore, lovelaceToAda } from '@/utils/scoring';
import { sortByQualityScore, isWellDocumented } from '@/utils/documentation';
import { DRep } from '@/types/drep';
import { DRepTableClient } from '@/components/DRepTableClient';
import { HeroSection } from '@/components/HeroSection';
import { ErrorBanner } from '@/components/ErrorBanner';
import { TableSkeleton } from '@/components/LoadingSkeleton';

async function getDReps(limit: number = 50): Promise<{ 
  dreps: DRep[]; 
  allDReps: DRep[];
  error: boolean; 
  totalAvailable: number;
}> {
  const isDev = process.env.NODE_ENV === 'development';
  
  try {
    if (isDev) {
      console.log(`[DRepScore] Starting DRep data fetch (limit: ${limit})...`);
    }

    // Check API health
    const isHealthy = await checkKoiosHealth();
    if (!isHealthy) {
      console.error('[DRepScore] Koios API health check failed');
      return { dreps: [], allDReps: [], error: true, totalAvailable: 0 };
    }

    // Fetch all DReps
    const drepList = await fetchAllDReps();
    if (!drepList || drepList.length === 0) {
      if (isDev) {
        console.warn('[DRepScore] No DReps found');
      }
      return { dreps: [], allDReps: [], error: false, totalAvailable: 0 };
    }

    if (isDev) {
      console.log(`[DRepScore] Found ${drepList.length} total DReps`);
    }

    // Get registered DReps and sort by voting power
    const registeredDReps = drepList.filter(d => d.registered);
    const totalAvailable = registeredDReps.length;

    // Take initial batch (sorted by voting power on server side if possible)
    const drepIds = registeredDReps
      .map(d => d.drep_id)
      .slice(0, limit);

    if (isDev) {
      console.log(`[DRepScore] Fetching FULL data for ${drepIds.length} DReps...`);
    }

    const { info, metadata } = await fetchDRepsWithDetails(drepIds);

    // Sort by voting power descending
    const sortedInfo = [...info].sort((a, b) => {
      const aPower = parseInt(a.voting_power || '0');
      const bPower = parseInt(b.voting_power || '0');
      return bPower - aPower;
    });

    if (isDev) {
      console.log(`[DRepScore] Fetching COMPLETE vote history for ALL ${sortedInfo.length} displayed DReps...`);
    }

    // FETCH COMPLETE VOTE HISTORY FOR ALL DISPLAYED DREPS
    const votesMap: Record<string, any[]> = {};
    
    for (const drepInfo of sortedInfo) {
      try {
        const votes = await fetchDRepVotes(drepInfo.drep_id);
        votesMap[drepInfo.drep_id] = votes;
        
        if (isDev) {
          console.log(`[DRepScore] Loaded ${votes.length} votes for ${drepInfo.drep_id.slice(0, 12)}...`);
        }
      } catch (error) {
        console.error(`[DRepScore] Failed to fetch votes for ${drepInfo.drep_id}:`, error);
        votesMap[drepInfo.drep_id] = [];
      }
    }

    // Calculate total proposals from all fetched votes
    const allVoteCounts = Object.values(votesMap).map(votes => votes.length);
    const totalProposals = Math.max(...allVoteCounts, 1);

    if (isDev) {
      console.log(`[DRepScore] Total proposals in dataset: ${totalProposals}`);
    }

    // Transform to app format with COMPLETE metrics from ALL vote data
    const dreps: DRep[] = sortedInfo.map(drepInfo => {
      const drepMetadata = metadata.find(m => m.drep_id === drepInfo.drep_id);
      const votes = votesMap[drepInfo.drep_id] || [];
      
      // Calculate vote distribution from COMPLETE vote history
      const yesVotes = votes.filter(v => v.vote === 'Yes').length;
      const noVotes = votes.filter(v => v.vote === 'No').length;
      const abstainVotes = votes.filter(v => v.vote === 'Abstain').length;

      // Full rationale analysis
      const votesWithRationale = votes.filter(v => 
        v.meta_url !== null || v.meta_json?.rationale !== null
      ).length;

      // Parse metadata fields with fallback logic
      const { name, ticker, description } = parseMetadataFields(drepMetadata);

      return {
        drepId: drepInfo.drep_id,
        drepHash: drepInfo.drep_hash,
        handle: null, // ADA Handle lookup not yet integrated
        name,
        ticker,
        description,
        votingPower: lovelaceToAda(drepInfo.voting_power || '0'),
        votingPowerLovelace: drepInfo.voting_power || '0',
        participationRate: calculateParticipationRate(votes.length, totalProposals),
        rationaleRate: votes.length > 0 ? Math.round((votesWithRationale / votes.length) * 100) : 0,
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

    // Sort by quality score (documentation + voting power)
    const sortedDReps = sortByQualityScore(dreps);
    
    // DEFAULT FILTER: Only well-documented DReps
    // Well-documented = has metadata (name/ticker/description) OR has rationale provision
    const wellDocumentedDReps = sortedDReps.filter(drep => 
      isWellDocumented(drep) || drep.rationaleRate > 0
    );
    
    if (isDev) {
      console.log(`[DRepScore] Successfully loaded ${sortedDReps.length} DReps with COMPLETE data`);
      console.log(`[DRepScore] Average votes per DRep: ${Math.round(sortedDReps.reduce((sum, d) => sum + d.totalVotes, 0) / sortedDReps.length)}`);
      const wellDocumented = wellDocumentedDReps.length;
      console.log(`[DRepScore] Well documented DReps (default filter): ${wellDocumented}/${sortedDReps.length} (${Math.round((wellDocumented / sortedDReps.length) * 100)}%)`);
      console.log(`[DRepScore] Returning well-documented DReps by default for better UX`);
    }

    return { 
      dreps: wellDocumentedDReps, // Default: well-documented only
      allDReps: sortedDReps, // All DReps for "show all" toggle
      error: false, 
      totalAvailable 
    };
  } catch (error) {
    console.error('[DRepScore] Error fetching DReps:', error);
    return { dreps: [], allDReps: [], error: true, totalAvailable: 0 };
  }
}

export default async function HomePage() {
  const { dreps, allDReps, error, totalAvailable } = await getDReps();

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
