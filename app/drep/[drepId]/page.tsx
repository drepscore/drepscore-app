/**
 * DRep Detail Page
 * Shows comprehensive information about a specific DRep.
 * All data is read from Supabase (populated by the sync cron).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProposalDisplayTitle } from '@/utils/display';
import { getDRepPrimaryName, hasCustomMetadata } from '@/utils/display';
import { formatAda, getSizeBadgeClass, getDRepScoreBadgeClass, applyRationaleCurve, getPillarStatus, getMissingProfileFields } from '@/utils/scoring';
import { VoteRecord } from '@/types/drep';
import { VotingHistoryWithPrefs } from '@/components/VotingHistoryWithPrefs';
import { InlineDelegationCTA } from '@/components/InlineDelegationCTA';
import { PillarCard } from '@/components/PillarCard';
import { ScoreHistoryChart } from '@/components/ScoreHistoryChart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { DetailPageSkeleton } from '@/components/LoadingSkeleton';
import { ClaimProfileBanner } from '@/components/ClaimProfileBanner';
import { DRepDashboardWrapper } from '@/components/DRepDashboardWrapper';
import { AboutSection } from '@/components/AboutSection';
import { SocialIconsLarge } from '@/components/SocialIconsLarge';
import {
  getDRepById,
  getVotesByDRepId,
  getProposalsByIds,
  getRationalesByVoteTxHashes,
  getScoreHistory,
  getDRepPercentile,
} from '@/lib/data';
import { Suspense } from 'react';

interface DRepDetailPageProps {
  params: Promise<{ drepId: string }>;
}

async function getDRepData(drepId: string) {
  const isDev = process.env.NODE_ENV === 'development';

  try {
    const decodedId = decodeURIComponent(drepId);

    if (isDev) {
      console.log(`[DRepProfile] Loading DRep: ${decodedId}`);
    }

    // All data from Supabase -- no Koios calls at page load
    const [cachedDRep, votes] = await Promise.all([
      getDRepById(decodedId),
      getVotesByDRepId(decodedId),
    ]);

    if (!cachedDRep) {
      if (isDev) {
        console.warn(`[DRepProfile] DRep not found in Supabase: ${decodedId}`);
      }
      return null;
    }

    if (isDev) {
      console.log(`[DRepProfile] Found ${votes.length} votes for DRep ${decodedId}`);
    }

    // Enrich votes with proposal metadata and rationale text from Supabase
    const [cachedProposals, cachedRationales] = await Promise.all([
      getProposalsByIds(
        votes.map(v => ({ txHash: v.proposal_tx_hash, index: v.proposal_index }))
      ),
      getRationalesByVoteTxHashes(votes.map(v => v.vote_tx_hash)),
    ]);

    const voteRecords: VoteRecord[] = votes.map((vote, index) => {
      const cachedProposal = cachedProposals.get(
        `${vote.proposal_tx_hash}-${vote.proposal_index}`
      );
      const title = cachedProposal?.title || null;
      const abstract = cachedProposal?.abstract || null;
      const aiSummary = cachedProposal?.aiSummary ?? null;
      const rationaleText = cachedRationales.get(vote.vote_tx_hash) || null;

      return {
        id: `${vote.vote_tx_hash}-${index}`,
        proposalTxHash: vote.proposal_tx_hash,
        proposalIndex: vote.proposal_index,
        voteTxHash: vote.vote_tx_hash,
        date: new Date(vote.block_time * 1000),
        vote: vote.vote,
        title: getProposalDisplayTitle(title, vote.proposal_tx_hash, vote.proposal_index),
        abstract,
        aiSummary,
        hasRationale: vote.meta_url !== null || rationaleText !== null,
        rationaleUrl: vote.meta_url,
        rationaleText,
        voteType: 'Governance' as const,
        proposalType: cachedProposal?.proposalType || null,
        treasuryTier: cachedProposal?.treasuryTier || null,
        withdrawalAmount: cachedProposal?.withdrawalAmount || null,
        relevantPrefs: cachedProposal?.relevantPrefs || [],
      };
    });

    return {
      drepId: cachedDRep.drepId,
      drepHash: cachedDRep.drepHash,
      handle: cachedDRep.handle,
      name: cachedDRep.name,
      ticker: cachedDRep.ticker,
      description: cachedDRep.description,
      votingPower: cachedDRep.votingPower,
      delegatorCount: cachedDRep.delegatorCount,
      sizeTier: cachedDRep.sizeTier,
      drepScore: cachedDRep.drepScore,
      isActive: cachedDRep.isActive,
      participationRate: cachedDRep.participationRate,
      rationaleRate: cachedDRep.rationaleRate,
      effectiveParticipation: cachedDRep.effectiveParticipation,
      deliberationModifier: cachedDRep.deliberationModifier,
      consistencyScore: cachedDRep.consistencyScore,
      profileCompleteness: cachedDRep.profileCompleteness,
      anchorUrl: cachedDRep.anchorUrl,
      metadata: cachedDRep.metadata,
      votes: voteRecords,
      activeEpoch: (cachedDRep as any).activeEpoch ?? null,
    };
  } catch (error) {
    console.error('[DRepProfile] Error loading DRep data:', error);
    return null;
  }
}

export default async function DRepDetailPage({ params }: DRepDetailPageProps) {
  const { drepId } = await params;
  const drep = await getDRepData(drepId);

  if (!drep) {
    notFound();
  }

  const [scoreHistory, percentile] = await Promise.all([
    getScoreHistory(drep.drepId),
    getDRepPercentile(drep.drepScore),
  ]);

  const scoreColor = drep.drepScore >= 80 
    ? 'text-green-600 dark:text-green-400' 
    : drep.drepScore >= 60 
      ? 'text-amber-600 dark:text-amber-400' 
      : 'text-red-600 dark:text-red-400';

  // Pillar values for the redesigned score card
  const adjustedRationale = applyRationaleCurve(drep.rationaleRate);
  const pillars = [
    { value: drep.effectiveParticipation, label: 'Effective Participation', weight: '40%' },
    { value: adjustedRationale, label: 'Rationale Rate', weight: '25%' },
    { value: drep.consistencyScore, label: 'Consistency', weight: '20%' },
    { value: drep.profileCompleteness, label: 'Profile Completeness', weight: '15%' },
  ];
  const strongCount = pillars.filter(p => getPillarStatus(p.value) === 'strong').length;

  // Action hints per pillar
  const missingFields = getMissingProfileFields(drep.metadata);
  const participationHint = drep.deliberationModifier < 1.0
    ? `Discounted ${Math.round((1 - drep.deliberationModifier) * 100)}% for uniform voting pattern`
    : `Voted on ${drep.votes.length} proposals`;
  const rationaleHint = `Rationale measured on binding governance votes only. InfoActions excluded.`;
  const consistencyHint = `Measures steady participation across epochs with proposals`;
  const profileHint = missingFields.length > 0
    ? `Missing: ${missingFields.join(', ')}`
    : 'All profile fields completed';

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

      {/* DRep Score Card - Redesigned with status icons and action hints */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <CardTitle>DRep Score</CardTitle>
              <span className="text-xs text-muted-foreground">
                {strongCount} of 4 pillars at Strong
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-4xl font-bold tabular-nums ${scoreColor}`}>
                {drep.drepScore}
              </span>
              <div className="flex flex-col items-end gap-1">
                <Badge
                  variant="outline"
                  className={`text-sm ${getDRepScoreBadgeClass(drep.drepScore)}`}
                >
                  {drep.drepScore >= 80 ? 'Strong' : drep.drepScore >= 60 ? 'Good' : 'Low'}
                </Badge>
                {percentile > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Higher than {percentile}% of DReps
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick win callout */}
          {drep.profileCompleteness < 50 && missingFields.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                Quick win: Complete your profile metadata to easily improve your score — no on-chain transactions needed.
              </p>
            </div>
          )}

          <PillarCard
            label="Effective Participation"
            value={drep.effectiveParticipation}
            weight="40% weight"
            status={getPillarStatus(drep.effectiveParticipation)}
            hint={participationHint}
          />
          <PillarCard
            label="Rationale Rate"
            value={adjustedRationale}
            weight="25% weight"
            status={getPillarStatus(adjustedRationale)}
            hint={rationaleHint}
          />
          <PillarCard
            label="Consistency"
            value={drep.consistencyScore}
            weight="20% weight"
            status={getPillarStatus(drep.consistencyScore)}
            hint={consistencyHint}
          />
          <PillarCard
            label="Profile Completeness"
            value={drep.profileCompleteness}
            weight="15% weight"
            status={getPillarStatus(drep.profileCompleteness)}
            hint={profileHint}
          />
        </CardContent>
      </Card>

      {/* Score History Chart */}
      <ScoreHistoryChart history={scoreHistory} />

      {/* DRep Dashboard - Only visible to the DRep owner or admin in simulate mode */}
      <Suspense fallback={null}>
        <DRepDashboardWrapper
          drepId={drep.drepId}
          drep={{
            drepId: drep.drepId,
            effectiveParticipation: drep.effectiveParticipation,
            rationaleRate: drep.rationaleRate,
            consistencyScore: drep.consistencyScore,
            profileCompleteness: drep.profileCompleteness,
            deliberationModifier: drep.deliberationModifier,
            metadata: drep.metadata,
            votes: drep.votes,
            drepScore: drep.drepScore,
          }}
          scoreHistory={scoreHistory}
        />
      </Suspense>

      {/* Voting History */}
      <Suspense fallback={<DetailPageSkeleton />}>
        <VotingHistoryWithPrefs votes={drep.votes} />
      </Suspense>

      {/* About Section */}
      <AboutSection 
        description={drep.description}
        bio={drep.metadata?.bio}
        email={drep.metadata?.email}
        references={drep.metadata?.references as Array<{ uri: string; label?: string }> | undefined}
      />

      {/* Claim Profile Banner */}
      <ClaimProfileBanner drepId={drep.drepId} />
    </div>
  );
}
