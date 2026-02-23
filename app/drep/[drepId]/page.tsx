/**
 * DRep Detail Page
 * Shows comprehensive information about a specific DRep
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchDRepDetails, parseMetadataFields } from '@/utils/koios';
import { calculateParticipationRate, calculateRationaleRate, calculateDeliberationModifier, calculateConsistency, calculateEffectiveParticipation, lovelaceToAda, formatAda, getSizeTier, getSizeBadgeClass } from '@/utils/scoring';
import { getDRepPrimaryName, hasCustomMetadata, getProposalDisplayTitle } from '@/utils/display';
import { VoteRecord } from '@/types/drep';
import { VotingHistoryChart } from '@/components/VotingHistoryChart';
import { InlineDelegationCTA } from '@/components/InlineDelegationCTA';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Vote, TrendingUp } from 'lucide-react';
import { calculateDRepScore } from '@/lib/koios';
import { getDRepScoreBadgeClass } from '@/utils/scoring';
import { DetailPageSkeleton } from '@/components/LoadingSkeleton';
import { ClaimProfileBanner } from '@/components/ClaimProfileBanner';
import { AboutSection } from '@/components/AboutSection';
import { SocialIconsLarge } from '@/components/SocialIconsLarge';
import { getGlobalTotalProposals, getActiveProposalEpochs, getProposalsByIds, getRationalesByVoteTxHashes, getDRepById } from '@/lib/data';
import { Suspense } from 'react';

interface DRepDetailPageProps {
  params: Promise<{ drepId: string }>;
}

function computeEpochVoteCounts(votes: { block_time: number }[]): { counts: number[]; firstEpoch: number | undefined } {
  if (!votes || votes.length === 0) return { counts: [], firstEpoch: undefined };
  
  const epochCounts: Record<number, number> = {};
  let minEpoch = Infinity;
  let maxEpoch = -Infinity;
  
  for (const vote of votes) {
    const epoch = Math.floor(vote.block_time / (5 * 24 * 60 * 60));
    epochCounts[epoch] = (epochCounts[epoch] || 0) + 1;
    minEpoch = Math.min(minEpoch, epoch);
    maxEpoch = Math.max(maxEpoch, epoch);
  }
  
  if (minEpoch === Infinity) return { counts: [], firstEpoch: undefined };
  
  const counts: number[] = [];
  for (let e = minEpoch; e <= maxEpoch; e++) {
    counts.push(epochCounts[e] || 0);
  }
  
  return { counts, firstEpoch: minEpoch };
}

async function getDRepData(drepId: string) {
  const isDev = process.env.NODE_ENV === 'development';
  
  try {
    const decodedId = decodeURIComponent(drepId);
    
    if (isDev) {
      console.log(`[DRepScore] Fetching details for DRep: ${decodedId}`);
    }

    // Note: Detail pages fetch directly from Koios to get full vote history
    // The Supabase cache doesn't store individual votes (space optimization)
    // Primary performance win is on homepage which doesn't need vote details
    const { info, metadata, votes } = await fetchDRepDetails(decodedId);

    if (!info) {
      if (isDev) {
        console.warn(`[DRepScore] No info found for DRep: ${decodedId}`);
      }
      return null;
    }

    if (isDev) {
      console.log(`[DRepScore] Found ${votes.length} votes for DRep ${decodedId}`);
    }

    const cachedProposals = await getProposalsByIds(
      votes.map(v => ({ txHash: v.proposal_tx_hash, index: v.proposal_index }))
    );
    let cachedRationales = await getRationalesByVoteTxHashes(votes.map(v => v.vote_tx_hash));
    
    // Fetch rationales for recent votes that have meta_url but aren't cached yet
    const votesNeedingRationale = votes
      .filter(v => v.meta_url && !v.meta_json?.rationale && !cachedRationales.has(v.vote_tx_hash))
      .sort((a, b) => b.block_time - a.block_time)
      .slice(0, 15);
    
    if (votesNeedingRationale.length > 0) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL 
          || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        
        const res = await fetch(`${baseUrl}/api/rationale`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            votes: votesNeedingRationale.map(v => ({
              voteTxHash: v.vote_tx_hash,
              drepId: decodedId,
              proposalTxHash: v.proposal_tx_hash,
              proposalIndex: v.proposal_index,
              metaUrl: v.meta_url,
            })),
          }),
        });
        
        if (res.ok) {
          const data = await res.json();
          for (const result of data.results || []) {
            if (result.rationaleText) {
              cachedRationales.set(result.voteTxHash, result.rationaleText);
            }
          }
        }
      } catch (err) {
        console.error('[DRepScore] Rationale fetch failed:', err);
      }
    }
    
    const voteRecords: VoteRecord[] = votes.map((vote, index) => {
      const cachedProposal = cachedProposals.get(`${vote.proposal_tx_hash}-${vote.proposal_index}`);
      const title = cachedProposal?.title || vote.meta_json?.title || null;
      const abstract = cachedProposal?.abstract || vote.meta_json?.abstract || null;
      const rationaleText = cachedRationales.get(vote.vote_tx_hash) || vote.meta_json?.rationale || null;
      
      return {
        id: `${vote.vote_tx_hash}-${index}`,
        proposalTxHash: vote.proposal_tx_hash,
        proposalIndex: vote.proposal_index,
        voteTxHash: vote.vote_tx_hash,
        date: new Date(vote.block_time * 1000),
        vote: vote.vote,
        title: getProposalDisplayTitle(title, vote.proposal_tx_hash, vote.proposal_index),
        abstract: abstract,
        hasRationale: vote.meta_url !== null || rationaleText !== null,
        rationaleUrl: vote.meta_url,
        rationaleText: rationaleText,
        voteType: 'Governance',
      };
    });

    const votingPower = lovelaceToAda(info.amount || '0');
    const delegatorCount = info.delegators || 0;
    
    // Use the global max vote count so participation rate matches the main table
    const globalTotalProposals = await getGlobalTotalProposals();
    const totalProposals = Math.max(globalTotalProposals, votes.length, 1);

    // Calculate vote distribution
    const yesVotes = votes.filter(v => v.vote === 'Yes').length;
    const noVotes = votes.filter(v => v.vote === 'No').length;
    const abstainVotes = votes.filter(v => v.vote === 'Abstain').length;

    // Parse metadata fields with fallback logic
    const { name, ticker, description } = parseMetadataFields(metadata);

    const participationRate = calculateParticipationRate(voteRecords.length, totalProposals);
    const rationaleRate = calculateRationaleRate(votes);
    const deliberationModifier = calculateDeliberationModifier(yesVotes, noVotes, abstainVotes);
    const effectiveParticipation = calculateEffectiveParticipation(participationRate, deliberationModifier);
    
    const { counts: epochVoteCounts, firstEpoch } = computeEpochVoteCounts(votes);
    const activeProposalEpochs = await getActiveProposalEpochs();
    const consistencyScore = calculateConsistency(epochVoteCounts, firstEpoch, activeProposalEpochs);

    const sizeTier = getSizeTier(votingPower);
    
    // Use the cached DRep score from Supabase to ensure consistency with the table
    // Fall back to local calculation only if cache miss
    const cachedDRep = await getDRepById(decodedId);
    const drepScore = cachedDRep?.drepScore ?? calculateDRepScore({ effectiveParticipation, rationaleRate, consistencyScore });

    return {
      drepId: info.drep_id,
      drepHash: info.drep_hash,
      handle: null,
      name,
      ticker,
      description,
      votingPower,
      delegatorCount,
      sizeTier,
      drepScore,
      isActive: info.registered && info.amount !== '0',
      participationRate,
      rationaleRate,
      effectiveParticipation,
      deliberationModifier,
      consistencyScore,
      anchorUrl: info.anchor_url,
      metadata: metadata?.meta_json?.body || null,
      votes: voteRecords,
      activeEpoch: info.active_epoch,
    };
  } catch (error) {
    console.error('[DRepScore] Error fetching DRep details:', error);
    return null;
  }
}

export default async function DRepDetailPage({ params }: DRepDetailPageProps) {
  const { drepId } = await params;
  const drep = await getDRepData(drepId);

  if (!drep) {
    notFound();
  }

  const scoreColor = drep.drepScore >= 80 
    ? 'text-green-600 dark:text-green-400' 
    : drep.drepScore >= 60 
      ? 'text-amber-600 dark:text-amber-400' 
      : 'text-red-600 dark:text-red-400';

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Back button */}
      <Link href="/">
        <Button variant="ghost" className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to DReps
        </Button>
      </Link>

      {/* Header Block */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="space-y-3 flex-1">
          {/* Name and Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold">
              {getDRepPrimaryName(drep)}
            </h1>
            {drep.ticker && (
              <Badge variant="outline" className="text-base px-2 py-0.5">
                {drep.ticker.toUpperCase()}
              </Badge>
            )}
          </div>
          
          {/* Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={drep.isActive ? 'default' : 'secondary'}>
              {drep.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Badge 
              variant="outline" 
              className={getSizeBadgeClass(drep.sizeTier)}
            >
              {drep.sizeTier}
            </Badge>
            {!hasCustomMetadata(drep) && (
              <Badge variant="secondary" className="text-xs">
                No Metadata
              </Badge>
            )}
          </div>
          
          {/* Context Info */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <TrendingUp className="inline h-4 w-4 mr-1" />
              {formatAda(drep.votingPower)} ADA voting power
            </p>
            {drep.activeEpoch && (
              <p>Active since Epoch {drep.activeEpoch}</p>
            )}
          </div>
          
          {/* Social Icons */}
          <SocialIconsLarge metadata={drep.metadata} />
          
          {/* DRep ID */}
          <p className="text-xs text-muted-foreground font-mono pt-1">
            {drep.drepId}
          </p>
        </div>
        
        {/* Delegation CTA - Compact */}
        <div className="lg:w-auto">
          <InlineDelegationCTA drepId={drep.drepId} drepName={getDRepPrimaryName(drep)} />
        </div>
      </div>

      {/* DRep Score Card - Merged metrics and breakdown */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>DRep Score</CardTitle>
            <div className="flex items-center gap-2">
              <span className={`text-4xl font-bold tabular-nums ${scoreColor}`}>
                {drep.drepScore}
              </span>
              <Badge
                variant="outline"
                className={`text-sm ${getDRepScoreBadgeClass(drep.drepScore)}`}
              >
                {drep.drepScore >= 80 ? 'Strong' : drep.drepScore >= 60 ? 'Good' : 'Low'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Effective Participation */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Effective Participation</span>
              <span className="text-muted-foreground">{drep.effectiveParticipation}% <span className="text-xs">(45% weight)</span></span>
            </div>
            <Progress value={drep.effectiveParticipation} className="h-2" />
            <p className="text-xs text-muted-foreground">
              How often this DRep votes on available proposals.
              {drep.deliberationModifier < 1.0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {' '}Discounted by {Math.round((1 - drep.deliberationModifier) * 100)}% due to uniform voting pattern.
                </span>
              )}
            </p>
          </div>
          
          {/* Rationale Rate */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Rationale Rate</span>
              <span className="text-muted-foreground">{drep.rationaleRate}% <span className="text-xs">(35% weight)</span></span>
            </div>
            <Progress value={drep.rationaleRate} className="h-2" />
            <p className="text-xs text-muted-foreground">
              How often this DRep provides explanations for their votes.
            </p>
          </div>
          
          {/* Consistency */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Consistency</span>
              <span className="text-muted-foreground">{drep.consistencyScore}% <span className="text-xs">(20% weight)</span></span>
            </div>
            <Progress value={drep.consistencyScore} className="h-2" />
            <p className="text-xs text-muted-foreground">
              How steadily this DRep participates over time.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Voting History */}
      <Suspense fallback={<DetailPageSkeleton />}>
        <VotingHistoryChart votes={drep.votes} />
      </Suspense>

      {/* About Section */}
      <AboutSection 
        description={drep.description}
        bio={drep.metadata?.bio}
        email={drep.metadata?.email}
        references={drep.metadata?.references}
      />

      {/* Claim Profile Banner */}
      <ClaimProfileBanner drepId={drep.drepId} />
    </div>
  );
}
