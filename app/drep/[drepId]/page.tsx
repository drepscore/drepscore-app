/**
 * DRep Detail Page
 * Shows comprehensive information about a specific DRep.
 * All data is read from Supabase (populated by the sync cron).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProposalDisplayTitle } from '@/utils/display';
import { getDRepPrimaryName, hasCustomMetadata } from '@/utils/display';
import { formatAda, getSizeBadgeClass, getDRepScoreBadgeClass, applyRationaleCurve } from '@/utils/scoring';
import { VoteRecord } from '@/types/drep';
import { VotingHistoryWithPrefs } from '@/components/VotingHistoryWithPrefs';
import { InlineDelegationCTA } from '@/components/InlineDelegationCTA';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { DetailPageSkeleton } from '@/components/LoadingSkeleton';
import { ClaimProfileBanner } from '@/components/ClaimProfileBanner';
import { AboutSection } from '@/components/AboutSection';
import { SocialIconsLarge } from '@/components/SocialIconsLarge';
import {
  getDRepById,
  getVotesByDRepId,
  getProposalsByIds,
  getRationalesByVoteTxHashes,
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
              <span className="text-muted-foreground">{drep.effectiveParticipation}% <span className="text-xs">(40% weight)</span></span>
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
              <span className="text-muted-foreground">{applyRationaleCurve(drep.rationaleRate)}% <span className="text-xs">(25% weight)</span></span>
            </div>
            <Progress value={applyRationaleCurve(drep.rationaleRate)} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Weighted by proposal importance: critical votes count 3x more. InfoActions (non-binding polls)
              are excluded. A forgiving curve rewards DReps who provide rationale consistently.
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

          {/* Profile Completeness */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Profile Completeness</span>
              <span className="text-muted-foreground">{drep.profileCompleteness}% <span className="text-xs">(15% weight)</span></span>
            </div>
            <Progress value={drep.profileCompleteness} className="h-2" />
            <p className="text-xs text-muted-foreground">
              How thoroughly this DRep has filled out their CIP-119 metadata profile, including 
              governance objectives, motivations, qualifications, and verified social/communication links.
            </p>
          </div>
        </CardContent>
      </Card>

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
