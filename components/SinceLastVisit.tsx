'use client';

import { useEffect, useState } from 'react';
import { FileText, Vote, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getStoredSession } from '@/lib/supabaseAuth';

interface SinceVisitData {
  proposalsOpened: number;
  proposalsClosed: number;
  drepVotesCast: number;
  drepScoreChange: number | null;
}

interface SinceLastVisitProps {
  previousVisitAt: string;
  delegatedDrepId?: string | null;
}

export function SinceLastVisit({ previousVisitAt, delegatedDrepId }: SinceLastVisitProps) {
  const [data, setData] = useState<SinceVisitData | null>(null);

  useEffect(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (new Date(previousVisitAt).getTime() > oneHourAgo) return;

    const token = getStoredSession();
    if (!token) return;

    const params = new URLSearchParams({ since: previousVisitAt });
    if (delegatedDrepId) params.set('drepId', delegatedDrepId);

    fetch(`/api/governance/since-visit?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {});
  }, [previousVisitAt, delegatedDrepId]);

  if (!data) return null;

  const hasActivity = data.proposalsOpened > 0 || data.drepVotesCast > 0 || data.drepScoreChange !== null;
  if (!hasActivity) return null;

  const scoreIcon = data.drepScoreChange === null ? null
    : data.drepScoreChange > 0 ? <TrendingUp className="h-4 w-4 text-green-500" />
    : data.drepScoreChange < 0 ? <TrendingDown className="h-4 w-4 text-red-500" />
    : <Minus className="h-4 w-4 text-muted-foreground" />;

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-3 rounded-xl bg-card border border-border/60 text-sm">
      <span className="text-muted-foreground font-medium">Since your last visit:</span>
      {data.proposalsOpened > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-blue-500" />
          <strong>{data.proposalsOpened}</strong> proposal{data.proposalsOpened > 1 ? 's' : ''} opened
        </span>
      )}
      {data.drepVotesCast > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <Vote className="h-4 w-4 text-primary" />
          Your DRep voted <strong>{data.drepVotesCast}</strong> time{data.drepVotesCast > 1 ? 's' : ''}
        </span>
      )}
      {data.drepScoreChange !== null && data.drepScoreChange !== 0 && (
        <span className="inline-flex items-center gap-1.5">
          {scoreIcon}
          Score {data.drepScoreChange > 0 ? '+' : ''}{data.drepScoreChange}
        </span>
      )}
    </div>
  );
}
