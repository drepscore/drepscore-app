/**
 * DRep Detail Page
 * Shows comprehensive information about a specific DRep.
 * All data is read from Supabase (populated by the sync cron).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getProposalDisplayTitle } from '@/utils/display';
import { getDRepPrimaryName, hasCustomMetadata } from '@/utils/display';
import { formatAda, getSizeBadgeClass, applyRationaleCurve, getPillarStatus, getMissingProfileFields, getEasiestWin, getReliabilityHintFromStored } from '@/utils/scoring';
import { VoteRecord } from '@/types/drep';
import { VotingHistoryWithPrefs } from '@/components/VotingHistoryWithPrefs';
import { InlineDelegationCTA } from '@/components/InlineDelegationCTA';
import { ScoreHistoryChart } from '@/components/ScoreHistoryChart';
import { ScoreCard } from '@/components/ScoreCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, TrendingUp, ShieldCheck, ShieldAlert } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DetailPageSkeleton } from '@/components/LoadingSkeleton';
import { DRepDashboardWrapper } from '@/components/DRepDashboardWrapper';
import { CopyableAddress } from '@/components/CopyableAddress';
import { AboutSection } from '@/components/AboutSection';
import { SocialIconsLarge } from '@/components/SocialIconsLarge';
import {
  getDRepById,
  getVotesByDRepId,
  getProposalsByIds,
  getRationalesByVoteTxHashes,
  getScoreHistory,
  getDRepPercentile,
  getSocialLinkChecks,
  isDRepClaimed,
} from '@/lib/data';
import { BASE_URL } from '@/lib/constants';
import { Suspense } from 'react';

interface DRepDetailPageProps {
  params: Promise<{ drepId: string }>;
}

export async function generateMetadata({ params }: DRepDetailPageProps): Promise<Metadata> {
  const { drepId } = await params;
  const decodedId = decodeURIComponent(drepId);
  const drep = await getDRepById(decodedId);
  
  if (!drep) {
    return {
      title: 'DRep Not Found — DRepScore',
    };
  }
  
  const name = getDRepPrimaryName(drep);
  const title = `${name} — DRepScore ${drep.drepScore}/100`;
  const description = `Participation: ${drep.effectiveParticipation}% · Rationale: ${drep.rationaleRate}% · Reliability: ${drep.reliabilityScore}% · Profile: ${drep.profileCompleteness}%`;
  const ogImageUrl = `${BASE_URL}/api/og/drep/${encodeURIComponent(drepId)}`;
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${name} DRepScore card` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
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
      const rationaleRecord = cachedRationales.get(vote.vote_tx_hash) ?? null;
      const rationaleText = rationaleRecord?.rationaleText || null;
      const rationaleAiSummary = rationaleRecord?.rationaleAiSummary || null;

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
        rationaleAiSummary,
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
      reliabilityScore: cachedDRep.reliabilityScore,
      reliabilityStreak: cachedDRep.reliabilityStreak,
      reliabilityRecency: cachedDRep.reliabilityRecency,
      reliabilityLongestGap: cachedDRep.reliabilityLongestGap,
      reliabilityTenure: cachedDRep.reliabilityTenure,
      profileCompleteness: cachedDRep.profileCompleteness,
      anchorUrl: cachedDRep.anchorUrl,
      metadata: cachedDRep.metadata,
      metadataHashVerified: cachedDRep.metadataHashVerified ?? null,
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

  const [scoreHistory, percentile, linkChecks, isClaimed] = await Promise.all([
    getScoreHistory(drep.drepId),
    getDRepPercentile(drep.drepScore),
    getSocialLinkChecks(drep.drepId),
    isDRepClaimed(drep.drepId),
  ]);

  const brokenLinks = new Set(
    linkChecks.filter(c => c.status === 'broken').map(c => c.uri)
  );

  // Pillar values for the redesigned score card
  const adjustedRationale = applyRationaleCurve(drep.rationaleRate);
  const pillars = [
    { value: drep.effectiveParticipation, label: 'Effective Participation', weight: '30%', maxPoints: 30 },
    { value: adjustedRationale, label: 'Rationale Rate', weight: '35%', maxPoints: 35 },
    { value: drep.reliabilityScore, label: 'Reliability', weight: '20%', maxPoints: 20 },
    { value: drep.profileCompleteness, label: 'Profile Completeness', weight: '15%', maxPoints: 15 },
  ];
  const pillarStatuses = pillars.map(p => getPillarStatus(p.value));
  const quickWin = getEasiestWin(pillars);

  // Action hints per pillar — concrete, delegator-friendly counts
  const missingFields = getMissingProfileFields(drep.metadata);
  const participationHint = drep.deliberationModifier < 1.0
    ? `Discounted ${Math.round((1 - drep.deliberationModifier) * 100)}% for uniform voting pattern`
    : `Voted on ${drep.votes.length} proposals`;

  const bindingVotes = drep.votes.filter(v => v.proposalType !== 'InfoAction');
  const rationaleCount = bindingVotes.filter(v => v.hasRationale).length;
  const rationaleHint = `Provided reasoning on ${rationaleCount} of ${bindingVotes.length} binding votes`;

  const reliabilityHint = getReliabilityHintFromStored(drep.reliabilityStreak, drep.reliabilityRecency);
  const brokenLinkCount = brokenLinks.size;
  const profileHintParts: string[] = [];
  if (missingFields.length > 0) profileHintParts.push(`Missing: ${missingFields.join(', ')}`);
  if (brokenLinkCount > 0) profileHintParts.push(`${brokenLinkCount} broken link${brokenLinkCount > 1 ? 's' : ''}`);
  const profileHint = profileHintParts.length > 0
    ? profileHintParts.join('. ')
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
            {drep.metadataHashVerified === true && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ShieldCheck className="h-5 w-5 text-green-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Metadata verified against on-chain hash</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {drep.metadataHashVerified === false && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Metadata doesn&apos;t match on-chain hash</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
          <SocialIconsLarge metadata={drep.metadata} brokenLinks={brokenLinks} />
          
          {/* DRep ID */}
          <div className="pt-1">
            <CopyableAddress address={drep.drepId} className="text-xs text-muted-foreground" />
          </div>
        </div>
        
        {/* Delegation CTA - Compact */}
        <div className="lg:w-auto">
          <InlineDelegationCTA drepId={drep.drepId} drepName={getDRepPrimaryName(drep)} />
        </div>
      </div>

      {/* Claim / Owner banner + Share — compact strip */}
      <Suspense fallback={null}>
        <DRepDashboardWrapper
          drepId={drep.drepId}
          drepName={getDRepPrimaryName(drep)}
          isClaimed={isClaimed}
        />
      </Suspense>

      {/* DRep Score Card — Hero component with ring, range bar, share */}
      <ScoreCard
        drep={drep}
        adjustedRationale={adjustedRationale}
        pillars={pillars}
        pillarStatuses={pillarStatuses}
        quickWin={quickWin}
        percentile={percentile}
        participationHint={participationHint}
        rationaleHint={rationaleHint}
        reliabilityHint={reliabilityHint}
        profileHint={profileHint}
      />

      {/* Score History Chart */}
      <ScoreHistoryChart history={scoreHistory} />

      {/* About Section */}
      <AboutSection 
        description={drep.description}
        bio={drep.metadata?.bio}
        email={drep.metadata?.email}
        references={drep.metadata?.references as Array<{ uri: string; label?: string }> | undefined}
      />

      {/* Voting History */}
      <Suspense fallback={<DetailPageSkeleton />}>
        <VotingHistoryWithPrefs votes={drep.votes} />
      </Suspense>

    </div>
  );
}
