/**
 * DRep Detail Page
 * Shows comprehensive information about a specific DRep
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchDRepDetails } from '@/utils/koios';
import { calculateParticipationRate, calculateRationaleRate, calculateDecentralizationScore, lovelaceToAda, formatAda, getParticipationColor, getRationaleColor } from '@/utils/scoring';
import { VoteRecord } from '@/types/drep';
import { MetricCard } from '@/components/MetricCard';
import { VotingHistoryChart } from '@/components/VotingHistoryChart';
import { DelegationButton } from '@/components/DelegationButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users, TrendingUp, FileText, Activity } from 'lucide-react';
import { DetailPageSkeleton } from '@/components/LoadingSkeleton';
import { Suspense } from 'react';

interface DRepDetailPageProps {
  params: Promise<{ drepId: string }>;
}

async function getDRepData(drepId: string) {
  const isDev = process.env.NODE_ENV === 'development';
  
  try {
    const decodedId = decodeURIComponent(drepId);
    
    if (isDev) {
      console.log(`[DRepScore] Fetching details for DRep: ${decodedId}`);
    }

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
      title: vote.meta_json?.title || null,
      abstract: vote.meta_json?.abstract || null,
      hasRationale: vote.meta_url !== null || vote.meta_json?.rationale !== null,
      rationaleUrl: vote.meta_url,
      rationaleText: vote.meta_json?.rationale || null,
      voteType: 'Governance', // Catalyst votes would need different endpoint/detection
    }));

    const votingPower = lovelaceToAda(info.voting_power || '0');
    const delegatorCount = info.delegators || 0;
    
    // Use actual vote count as proxy for total proposals this DRep could have voted on
    // This gives us their actual participation in available votes
    const totalProposals = Math.max(votes.length, 1);

    return {
      drepId: info.drep_id,
      drepHash: info.drep_hash,
      handle: null, // ADA Handle lookup not yet integrated
      votingPower,
      delegatorCount,
      isActive: info.registered && info.voting_power !== '0',
      participationRate: calculateParticipationRate(voteRecords.length, totalProposals),
      rationaleRate: calculateRationaleRate(votes),
      decentralizationScore: calculateDecentralizationScore(delegatorCount, votingPower),
      anchorUrl: info.anchor_url,
      metadata: metadata?.json_metadata?.body || null,
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
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">
            {drep.handle || 'DRep Profile'}
          </h1>
          <Badge variant={drep.isActive ? 'default' : 'secondary'} className="text-sm">
            {drep.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground font-mono">
          {drep.drepId}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Voting Power"
          value={`${formatAda(drep.votingPower)} ADA`}
          icon={TrendingUp}
          subtitle="Total delegated stake"
        />
        <MetricCard
          title="Participation Rate"
          value={`${drep.participationRate}%`}
          icon={Activity}
          colorClass={getParticipationColor(drep.participationRate)}
          subtitle={`${drep.votes.length} votes cast`}
        />
        <MetricCard
          title="Delegators"
          value={drep.delegatorCount.toLocaleString()}
          icon={Users}
          subtitle="Unique delegators"
        />
        <MetricCard
          title="Rationale Rate"
          value={`${drep.rationaleRate}%`}
          icon={FileText}
          colorClass={getRationaleColor(drep.rationaleRate)}
          subtitle="Votes with rationale"
        />
      </div>

      {/* About/Statement */}
      {drep.metadata && (
        <Card>
          <CardHeader>
            <CardTitle>About This DRep</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {drep.metadata.bio && (
              <div>
                <h3 className="font-medium mb-2">Bio</h3>
                <p className="text-sm text-muted-foreground">{drep.metadata.bio}</p>
              </div>
            )}
            {drep.metadata.email && (
              <div>
                <h3 className="font-medium mb-2">Contact</h3>
                <a
                  href={`mailto:${drep.metadata.email}`}
                  className="text-sm text-primary hover:underline"
                >
                  {drep.metadata.email}
                </a>
              </div>
            )}
            {drep.metadata.references && drep.metadata.references.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">References</h3>
                <ul className="space-y-1">
                  {drep.metadata.references.map((ref, i) => (
                    <li key={i}>
                      <a
                        href={ref.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {ref.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Decentralization Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Decentralization Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold">
                {drep.decentralizationScore}/100
              </div>
              <div className="flex-1">
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${drep.decentralizationScore}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Based on {drep.delegatorCount.toLocaleString()} delegators and voting power distribution.
            </p>
            <p className="text-xs text-muted-foreground">
              Note: Future versions will include stake pool operator links for enhanced transparency.
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
    </div>
  );
}
