/**
 * DRep Detail Page
 * Shows comprehensive information about a specific DRep
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchDRepDetails, parseMetadataFields } from '@/utils/koios';
import { calculateParticipationRate, calculateRationaleRate, calculateDeliberationModifier, calculateConsistency, calculateEffectiveParticipation, lovelaceToAda, formatAda, getParticipationColor, getRationaleColor } from '@/utils/scoring';
import { getDRepDisplayName, getDRepPrimaryName, hasCustomMetadata, truncateDescription, getProposalDisplayTitle, extractSocialPlatform } from '@/utils/display';
import { VoteRecord } from '@/types/drep';
import { MetricCard } from '@/components/MetricCard';
import { VotingHistoryChart } from '@/components/VotingHistoryChart';
import { DelegationButton } from '@/components/DelegationButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, TrendingUp, FileText, Activity, BarChart3, ExternalLink } from 'lucide-react';
import { calculateDRepScore } from '@/lib/koios';
import { getDRepScoreBadgeClass } from '@/utils/scoring';
import { DetailPageSkeleton } from '@/components/LoadingSkeleton';
import { ClaimProfileBanner } from '@/components/ClaimProfileBanner';
import { Suspense } from 'react';

interface DRepDetailPageProps {
  params: Promise<{ drepId: string }>;
}

function computeEpochVoteCounts(votes: { block_time: number }[]): number[] {
  if (!votes || votes.length === 0) return [];
  
  const epochCounts: Record<number, number> = {};
  let minEpoch = Infinity;
  let maxEpoch = -Infinity;
  
  for (const vote of votes) {
    const epoch = Math.floor(vote.block_time / (5 * 24 * 60 * 60));
    epochCounts[epoch] = (epochCounts[epoch] || 0) + 1;
    minEpoch = Math.min(minEpoch, epoch);
    maxEpoch = Math.max(maxEpoch, epoch);
  }
  
  if (minEpoch === Infinity) return [];
  
  const counts: number[] = [];
  for (let e = minEpoch; e <= maxEpoch; e++) {
    counts.push(epochCounts[e] || 0);
  }
  
  return counts;
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

    // Transform votes to VoteRecord format
    const voteRecords: VoteRecord[] = votes.map((vote, index) => ({
      id: `${vote.vote_tx_hash}-${index}`,
      proposalTxHash: vote.proposal_tx_hash,
      proposalIndex: vote.proposal_index,
      voteTxHash: vote.vote_tx_hash,
      date: new Date(vote.block_time * 1000),
      vote: vote.vote,
      title: getProposalDisplayTitle(vote.meta_json?.title || null, vote.proposal_tx_hash, vote.proposal_index),
      abstract: vote.meta_json?.abstract || null,
      hasRationale: vote.meta_url !== null || vote.meta_json?.rationale !== null,
      rationaleUrl: vote.meta_url,
      rationaleText: vote.meta_json?.rationale || null,
      voteType: 'Governance', // Catalyst votes would need different endpoint/detection
    }));

    const votingPower = lovelaceToAda(info.amount || '0');
    const delegatorCount = info.delegators || 0;
    
    // Use actual vote count as proxy for total proposals this DRep could have voted on
    // This gives us their actual participation in available votes
    const totalProposals = Math.max(votes.length, 1);

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
    
    const epochVoteCounts = computeEpochVoteCounts(votes);
    const consistencyScore = calculateConsistency(epochVoteCounts);

    return {
      drepId: info.drep_id,
      drepHash: info.drep_hash,
      handle: null,
      name,
      ticker,
      description,
      votingPower,
      delegatorCount,
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

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Back button */}
      <Link href="/">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to DReps
        </Button>
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold">
            {getDRepPrimaryName(drep)}
          </h1>
          {drep.ticker && (
            <Badge variant="outline" className="text-lg px-3 py-1">
              {drep.ticker.toUpperCase()}
            </Badge>
          )}
          <Badge variant={drep.isActive ? 'default' : 'secondary'} className="text-sm">
            {drep.isActive ? 'Active' : 'Inactive'}
          </Badge>
          {!hasCustomMetadata(drep) && (
            <Badge variant="secondary" className="text-xs">
              No Metadata
            </Badge>
          )}
        </div>
        
        {drep.description && (
          <p className="text-base text-muted-foreground max-w-3xl">
            {drep.description}
          </p>
        )}
        
        <p className="text-xs text-muted-foreground font-mono">
          DRep ID: {drep.drepId}
        </p>
      </div>

      {/* Voting Power Context */}
      <div className="text-sm text-muted-foreground">
        <TrendingUp className="inline h-4 w-4 mr-1" />
        Voting Power: <span className="font-medium">{formatAda(drep.votingPower)} ADA</span>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="DRep Score"
          value={`${calculateDRepScore({ effectiveParticipation: drep.effectiveParticipation, rationaleRate: drep.rationaleRate, consistencyScore: drep.consistencyScore })}`}
          icon={BarChart3}
          colorClass={getDRepScoreBadgeClass(calculateDRepScore({ effectiveParticipation: drep.effectiveParticipation, rationaleRate: drep.rationaleRate, consistencyScore: drep.consistencyScore })).includes('green') ? 'text-green-600 dark:text-green-400' : getDRepScoreBadgeClass(calculateDRepScore({ effectiveParticipation: drep.effectiveParticipation, rationaleRate: drep.rationaleRate, consistencyScore: drep.consistencyScore })).includes('amber') ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}
          subtitle="Accountability score"
        />
        <MetricCard
          title="Effective Participation"
          value={`${drep.effectiveParticipation}%`}
          icon={Activity}
          colorClass={getParticipationColor(drep.effectiveParticipation)}
          subtitle={drep.deliberationModifier < 1.0 ? 'Discounted for uniformity' : `${drep.votes.length} votes cast`}
        />
        <MetricCard
          title="Rationale Rate"
          value={`${drep.rationaleRate}%`}
          icon={FileText}
          colorClass={getRationaleColor(drep.rationaleRate)}
          subtitle="Votes with explanation"
        />
        <MetricCard
          title="Consistency"
          value={`${drep.consistencyScore}%`}
          icon={Activity}
          colorClass={drep.consistencyScore >= 70 ? 'text-green-600 dark:text-green-400' : drep.consistencyScore >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}
          subtitle="Steady engagement over time"
        />
      </div>

      {/* About/Statement */}
      {(drep.metadata || drep.description || drep.name) && (
        <Card>
          <CardHeader>
            <CardTitle>About This DRep</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {drep.name && (
              <div>
                <h3 className="font-medium mb-2">Name</h3>
                <p className="text-sm">{drep.name}</p>
              </div>
            )}
            {drep.description && (
              <div>
                <h3 className="font-medium mb-2">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{drep.description}</p>
              </div>
            )}
            {drep.metadata?.bio && (
              <div>
                <h3 className="font-medium mb-2">Bio</h3>
                <p className="text-sm text-muted-foreground">
                  {typeof drep.metadata.bio === 'object' && drep.metadata.bio !== null && '@value' in drep.metadata.bio
                    ? (drep.metadata.bio as any)['@value']
                    : drep.metadata.bio}
                </p>
              </div>
            )}
            {drep.metadata?.email && (
              <div>
                <h3 className="font-medium mb-2">Contact</h3>
                <a
                  href={`mailto:${typeof drep.metadata.email === 'object' && drep.metadata.email !== null && '@value' in drep.metadata.email ? (drep.metadata.email as any)['@value'] : drep.metadata.email}`}
                  className="text-sm text-primary hover:underline"
                >
                  {typeof drep.metadata.email === 'object' && drep.metadata.email !== null && '@value' in drep.metadata.email
                    ? (drep.metadata.email as any)['@value']
                    : drep.metadata.email}
                </a>
              </div>
            )}
            {drep.metadata?.references && drep.metadata.references.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">References</h3>
                <ul className="space-y-1">
                  {drep.metadata.references.map((ref, i) => (
                    <li key={i}>
                      <a
                        href={ref.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {extractSocialPlatform(ref.uri, ref.label)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* DRep Score Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Accountability Score Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">Effective Participation</p>
                <p className="text-2xl font-bold">{drep.effectiveParticipation}%</p>
                {drep.deliberationModifier < 1.0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Discounted ({Math.round(drep.deliberationModifier * 100)}%) due to uniform voting
                  </p>
                )}
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">Rationale Rate</p>
                <p className="text-2xl font-bold">{drep.rationaleRate}%</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">Consistency</p>
                <p className="text-2xl font-bold">{drep.consistencyScore}%</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Accountability score measures how consistently this DRep participates, explains their votes, and stays engaged over time.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Voting History */}
      <Suspense fallback={<DetailPageSkeleton />}>
        <VotingHistoryChart votes={drep.votes} />
      </Suspense>

      {/* Delegation CTA */}
      <DelegationButton drepId={drep.drepId} drepHandle={drep.handle} />

      {/* Claim Profile Banner */}
      <ClaimProfileBanner drepId={drep.drepId} />
    </div>
  );
}
