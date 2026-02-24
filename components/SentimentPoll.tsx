'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BarChart3,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  Info,
  RefreshCw,
} from 'lucide-react';
import { resolveRewardAddress } from '@meshsdk/core';
import type { PollResultsResponse } from '@/types/supabase';

interface SentimentPollProps {
  txHash: string;
  proposalIndex: number;
  isOpen: boolean;
}

type VoteChoice = 'yes' | 'no' | 'abstain';

export function SentimentPoll({ txHash, proposalIndex, isOpen }: SentimentPollProps) {
  const { connected, isAuthenticated, address, delegatedDrepId, authenticate } = useWallet();

  const [results, setResults] = useState<PollResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [changingVote, setChangingVote] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasVoted = results?.hasVoted ?? false;
  const userVote = results?.userVote ?? null;

  const fetchResults = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        proposalTxHash: txHash,
        proposalIndex: String(proposalIndex),
      });

      const headers: HeadersInit = {};
      const token = getStoredSession();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/polls/results?${params}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch');

      const data: PollResultsResponse = await res.json();
      setResults(data);
      if (data.hasVoted) setRevealed(true);
    } catch {
      setError('Could not load sentiment data');
    } finally {
      setLoading(false);
    }
  }, [txHash, proposalIndex]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const castVote = async (vote: VoteChoice) => {
    if (!isAuthenticated) {
      const ok = await authenticate();
      if (!ok) return;
    }

    setVoting(true);
    setError(null);
    try {
      const token = getStoredSession();
      if (!token) throw new Error('Not authenticated');

      let stakeAddress: string | undefined;
      if (address) {
        try {
          stakeAddress = resolveRewardAddress(address);
        } catch { /* script addresses won't resolve */ }
      }

      const res = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proposalTxHash: txHash,
          proposalIndex,
          vote,
          stakeAddress,
          delegatedDrepId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Vote failed');
      }

      const data = await res.json();
      setResults({
        community: data.community,
        userVote: data.userVote,
        hasVoted: true,
      });
      setRevealed(true);
      setChangingVote(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const community = results?.community ?? { yes: 0, no: 0, abstain: 0, total: 0 };
  const showButtons = isOpen && (!hasVoted || changingVote);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Community Sentiment
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[260px]">
                <p className="text-xs">
                  This is a non-binding poll for ADA holders. Your DRep votes
                  on-chain on your behalf — this shows how the community feels.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Teaser or results */}
        {revealed && hasVoted ? (
          <ResultsView
            community={community}
            userVote={userVote}
            isOpen={isOpen}
            onChangeVote={() => setChangingVote(true)}
          />
        ) : (
          <div className="text-sm text-muted-foreground">
            {community.total > 0 ? (
              <p>{community.total} holder{community.total !== 1 ? 's have' : ' has'} weighed in</p>
            ) : (
              <p>Be the first to share your opinion</p>
            )}
          </div>
        )}

        {/* Vote buttons */}
        {showButtons && (
          <VoteButtons
            onVote={castVote}
            voting={voting}
            connected={connected}
            currentVote={changingVote ? userVote : null}
          />
        )}

        {/* Connect prompt */}
        {!connected && isOpen && !hasVoted && (
          <p className="text-xs text-muted-foreground">
            Connect your wallet to share your opinion.
          </p>
        )}

        {/* Closed proposal */}
        {!isOpen && !hasVoted && community.total > 0 && (
          <ResultsView community={community} userVote={null} isOpen={false} />
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function VoteButtons({
  onVote,
  voting,
  connected,
  currentVote,
}: {
  onVote: (vote: VoteChoice) => void;
  voting: boolean;
  connected: boolean;
  currentVote: VoteChoice | null;
}) {
  const buttons: { vote: VoteChoice; label: string; icon: typeof ThumbsUp; activeClass: string }[] = [
    {
      vote: 'yes',
      label: 'Yes',
      icon: ThumbsUp,
      activeClass: 'bg-green-600 hover:bg-green-700 text-white border-green-600',
    },
    {
      vote: 'no',
      label: 'No',
      icon: ThumbsDown,
      activeClass: 'bg-red-600 hover:bg-red-700 text-white border-red-600',
    },
    {
      vote: 'abstain',
      label: 'Abstain',
      icon: MinusCircle,
      activeClass: 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600',
    },
  ];

  return (
    <div className="flex gap-2">
      {buttons.map(({ vote, label, icon: Icon, activeClass }) => (
        <Button
          key={vote}
          variant="outline"
          size="sm"
          className={`flex-1 gap-1.5 ${currentVote === vote ? activeClass : ''}`}
          disabled={voting || !connected}
          onClick={() => onVote(vote)}
        >
          {voting ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Icon className="h-3.5 w-3.5" />
          )}
          {label}
        </Button>
      ))}
    </div>
  );
}

function ResultsView({
  community,
  userVote,
  isOpen,
  onChangeVote,
}: {
  community: { yes: number; no: number; abstain: number; total: number };
  userVote: VoteChoice | null;
  isOpen: boolean;
  onChangeVote?: () => void;
}) {
  const total = community.total;
  const yp = total > 0 ? Math.round((community.yes / total) * 100) : 0;
  const np = total > 0 ? Math.round((community.no / total) * 100) : 0;
  const ap = total > 0 ? Math.round((community.abstain / total) * 100) : 0;

  const userVoteLabel = userVote
    ? { yes: 'Yes', no: 'No', abstain: 'Abstain' }[userVote]
    : null;

  const userPercent = userVote
    ? { yes: yp, no: np, abstain: ap }[userVote]
    : null;

  return (
    <div className="space-y-3">
      {userVote && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <span>
            You voted <strong>{userVoteLabel}</strong>.{' '}
            {userPercent !== null && `${userPercent}% of the community agrees.`}
          </span>
        </div>
      )}

      <SentimentBar label="Yes" count={community.yes} percent={yp} color="bg-green-500" />
      <SentimentBar label="No" count={community.no} percent={np} color="bg-red-500" />
      <SentimentBar label="Abstain" count={community.abstain} percent={ap} color="bg-amber-500" />

      <p className="text-xs text-muted-foreground">
        {total} holder{total !== 1 ? 's' : ''} voted
      </p>

      {isOpen && userVote && onChangeVote && (
        <button
          onClick={onChangeVote}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          Change your vote
        </button>
      )}
    </div>
  );
}

function SentimentBar({
  label,
  count,
  percent,
  color,
}: {
  label: string;
  count: number;
  percent: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {count} ({percent}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
