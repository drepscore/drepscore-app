/**
 * API Route: Load More DReps
 * Fetches additional DReps with complete data (votes, metadata)
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllDReps, fetchDRepsWithDetails, fetchDRepVotes, parseMetadataFields } from '@/utils/koios';
import { calculateParticipationRate, calculateDecentralizationScore, lovelaceToAda, getSizeTier } from '@/utils/scoring';
import { sortByQualityScore } from '@/utils/documentation';
import { DRep } from '@/types/drep';

export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (isDev) {
      console.log(`[API] Loading more DReps: offset=${offset}, limit=${limit}`);
    }

    // Fetch all DReps to get the full list
    const drepList = await fetchAllDReps();
    const registeredDReps = drepList.filter(d => d.registered);

    // Get the next batch
    const drepIds = registeredDReps
      .map(d => d.drep_id)
      .slice(offset, offset + limit);

    if (drepIds.length === 0) {
      return NextResponse.json([]);
    }

    if (isDev) {
      console.log(`[API] Fetching FULL data for ${drepIds.length} DReps...`);
    }

    // Fetch complete info and metadata
    const { info, metadata } = await fetchDRepsWithDetails(drepIds);

    // Sort by voting power
    const sortedInfo = [...info].sort((a, b) => {
      const aPower = parseInt(a.amount || '0');
      const bPower = parseInt(b.amount || '0');
      return bPower - aPower;
    });

    // FETCH COMPLETE VOTE HISTORY FOR ALL
    const votesMap: Record<string, any[]> = {};
    
    for (const drepInfo of sortedInfo) {
      try {
        const votes = await fetchDRepVotes(drepInfo.drep_id);
        votesMap[drepInfo.drep_id] = votes;
        
        if (isDev) {
          console.log(`[API] Loaded ${votes.length} votes for ${drepInfo.drep_id.slice(0, 12)}...`);
        }
      } catch (error) {
        console.error(`[API] Failed to fetch votes for ${drepInfo.drep_id}:`, error);
        votesMap[drepInfo.drep_id] = [];
      }
    }

    // Calculate total proposals
    const allVoteCounts = Object.values(votesMap).map(votes => votes.length);
    const totalProposals = Math.max(...allVoteCounts, 1);

    // Transform to app format with COMPLETE data
    const dreps: DRep[] = sortedInfo.map(drepInfo => {
      const drepMetadata = metadata.find(m => m.drep_id === drepInfo.drep_id);
      const votes = votesMap[drepInfo.drep_id] || [];
      
      const yesVotes = votes.filter(v => v.vote === 'Yes').length;
      const noVotes = votes.filter(v => v.vote === 'No').length;
      const abstainVotes = votes.filter(v => v.vote === 'Abstain').length;

      const votesWithRationale = votes.filter(v => 
        v.meta_url !== null || v.meta_json?.rationale !== null
      ).length;

      // Parse metadata fields with fallback logic
      const { name, ticker, description } = parseMetadataFields(drepMetadata);

      const votingPower = lovelaceToAda(drepInfo.amount || '0');
      
      return {
        drepId: drepInfo.drep_id,
        drepHash: drepInfo.drep_hash,
        handle: null, // ADA Handle lookup not yet integrated
        name,
        ticker,
        description,
        votingPower,
        votingPowerLovelace: drepInfo.amount || '0',
        participationRate: calculateParticipationRate(votes.length, totalProposals),
        rationaleRate: votes.length > 0 ? Math.round((votesWithRationale / votes.length) * 100) : 0,
        decentralizationScore: calculateDecentralizationScore(
          calculateParticipationRate(votes.length, totalProposals),
          votes.length > 0 ? Math.round((votesWithRationale / votes.length) * 100) : 0,
          votingPower,
          yesVotes,
          noVotes,
          abstainVotes
        ),
        sizeTier: getSizeTier(votingPower),
        delegatorCount: drepInfo.delegators || 0,
        totalVotes: votes.length,
        yesVotes,
        noVotes,
        abstainVotes,
        isActive: drepInfo.registered && drepInfo.amount !== '0',
        anchorUrl: drepInfo.anchor_url,
        metadata: drepMetadata?.meta_json?.body || null,
      };
    });

    // Sort by quality score (documentation + voting power)
    const sortedDReps = sortByQualityScore(dreps);
    
    if (isDev) {
      console.log(`[API] Returning ${sortedDReps.length} DReps with complete data`);
      const wellDocumented = sortedDReps.filter(d => d.name && (d.ticker || d.description)).length;
      console.log(`[API] Well documented: ${wellDocumented}/${sortedDReps.length}`);
    }

    return NextResponse.json(sortedDReps);
  } catch (error) {
    console.error('[API] Error fetching more DReps:', error);
    return NextResponse.json({ error: 'Failed to load DReps' }, { status: 500 });
  }
}
