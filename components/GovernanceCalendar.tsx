'use client';

import { useEffect, useState } from 'react';
import { posthog } from '@/lib/posthog';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, AlertTriangle, Sparkles, CheckCircle2, XCircle, Timer } from 'lucide-react';

const SHELLEY_GENESIS_TIMESTAMP = 1596491091;
const EPOCH_LENGTH_SECONDS = 432000;
const SHELLEY_BASE_EPOCH = 209;

function blockTimeToEpoch(blockTime: number): number {
  return Math.floor((blockTime - SHELLEY_GENESIS_TIMESTAMP) / EPOCH_LENGTH_SECONDS) + SHELLEY_BASE_EPOCH;
}

function epochEndTimestamp(epoch: number): number {
  return (epoch - SHELLEY_BASE_EPOCH + 1) * EPOCH_LENGTH_SECONDS + SHELLEY_GENESIS_TIMESTAMP;
}

interface Proposal {
  tx_hash: string;
  proposal_index: number;
  title: string | null;
  proposal_type: string;
  proposed_epoch: number | null;
  expiration_epoch: number | null;
  ratified_epoch: number | null;
  enacted_epoch: number | null;
  dropped_epoch: number | null;
  expired_epoch: number | null;
}

type TimelineEvent =
  | { kind: 'expiring'; proposal: Proposal }
  | { kind: 'new'; proposal: Proposal }
  | { kind: 'outcome'; proposal: Proposal; outcome: string; epoch: number };

const TYPE_COLORS: Record<string, string> = {
  TreasuryWithdrawals: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ParameterChange: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  HardForkInitiation: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  NoConfidence: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  NewCommittee: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  NewConstitution: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  InfoAction: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400',
};

function typeLabel(t: string): string {
  return t.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  switch (outcome) {
    case 'Ratified':
      return <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><CheckCircle2 className="h-3 w-3" />Ratified</Badge>;
    case 'Enacted':
      return <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3" />Enacted</Badge>;
    case 'Dropped':
      return <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><XCircle className="h-3 w-3" />Dropped</Badge>;
    case 'Expired':
      return <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"><Timer className="h-3 w-3" />Expired</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{outcome}</Badge>;
  }
}

function DotConnector({ color }: { color: string }) {
  return (
    <div className="flex flex-col items-center mr-3 shrink-0">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <div className="w-px flex-1 bg-border" />
    </div>
  );
}

export function GovernanceCalendar() {
  const [currentEpoch, setCurrentEpoch] = useState<number | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [pulseRes, proposalsRes] = await Promise.all([
          fetch('/api/governance/pulse'),
          createClient()
            .from('proposals')
            .select('tx_hash, proposal_index, title, proposal_type, proposed_epoch, expiration_epoch, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch'),
        ]);

        if (cancelled) return;

        const pulseData = pulseRes.ok ? await pulseRes.json() : null;
        const epoch = pulseData?.currentEpoch ?? blockTimeToEpoch(Math.floor(Date.now() / 1000));
        setCurrentEpoch(epoch);

        const proposals: Proposal[] = proposalsRes.data || [];
        const timeline: TimelineEvent[] = [];

        for (const p of proposals) {
          if (p.expiration_epoch === epoch) {
            timeline.push({ kind: 'expiring', proposal: p });
          }

          const isOpen = !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch;
          if (isOpen && p.proposed_epoch != null && p.proposed_epoch >= epoch - 2) {
            timeline.push({ kind: 'new', proposal: p });
          }

          if (p.enacted_epoch && p.enacted_epoch >= epoch - 3) {
            timeline.push({ kind: 'outcome', proposal: p, outcome: 'Enacted', epoch: p.enacted_epoch });
          } else if (p.ratified_epoch && p.ratified_epoch >= epoch - 3) {
            timeline.push({ kind: 'outcome', proposal: p, outcome: 'Ratified', epoch: p.ratified_epoch });
          } else if (p.dropped_epoch && p.dropped_epoch >= epoch - 3) {
            timeline.push({ kind: 'outcome', proposal: p, outcome: 'Dropped', epoch: p.dropped_epoch });
          } else if (p.expired_epoch && p.expired_epoch >= epoch - 3) {
            timeline.push({ kind: 'outcome', proposal: p, outcome: 'Expired', epoch: p.expired_epoch });
          }
        }

        if (!cancelled) setEvents(timeline);
      } catch {
        /* non-critical widget */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    try { posthog?.capture('governance_calendar_viewed'); } catch {}

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <Skeleton className="h-5 w-36" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0 mt-1" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const expiring = events.filter((e): e is Extract<TimelineEvent, { kind: 'expiring' }> => e.kind === 'expiring');
  const newProposals = events.filter((e): e is Extract<TimelineEvent, { kind: 'new' }> => e.kind === 'new');
  const outcomes = events.filter((e): e is Extract<TimelineEvent, { kind: 'outcome' }> => e.kind === 'outcome');
  const hasEvents = events.length > 0;

  let countdown = '';
  if (currentEpoch != null) {
    const endTs = epochEndTimestamp(currentEpoch);
    const remaining = Math.max(0, endTs - Date.now() / 1000);
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    countdown = `~${days}d ${hours}h remaining`;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">What&apos;s Coming</CardTitle>
          </div>
          {currentEpoch != null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              Epoch {currentEpoch} &middot; {countdown}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasEvents ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No upcoming governance events — enjoy the calm.
          </div>
        ) : (
          <div className="space-y-1">
            {/* Expiring this epoch */}
            {expiring.map((e) => (
              <div key={`exp-${e.proposal.tx_hash}-${e.proposal.proposal_index}`} className="flex min-h-[2.5rem]">
                <DotConnector color="bg-red-500" />
                <div className="flex flex-wrap items-center gap-1.5 py-1.5 min-w-0">
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${TYPE_COLORS[e.proposal.proposal_type] || ''}`}>
                    {typeLabel(e.proposal.proposal_type)}
                  </Badge>
                  <span className="text-sm truncate">
                    {e.proposal.title || `Proposal ${e.proposal.tx_hash.slice(0, 8)}…`}
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 shrink-0">
                    <AlertTriangle className="h-3 w-3" />
                    Expires this epoch!
                  </Badge>
                </div>
              </div>
            ))}

            {/* Recently opened */}
            {newProposals.map((e) => (
              <div key={`new-${e.proposal.tx_hash}-${e.proposal.proposal_index}`} className="flex min-h-[2.5rem]">
                <DotConnector color="bg-green-500" />
                <div className="flex flex-wrap items-center gap-1.5 py-1.5 min-w-0">
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${TYPE_COLORS[e.proposal.proposal_type] || ''}`}>
                    {typeLabel(e.proposal.proposal_type)}
                  </Badge>
                  <span className="text-sm truncate">
                    {e.proposal.title || `Proposal ${e.proposal.tx_hash.slice(0, 8)}…`}
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">
                    <Sparkles className="h-3 w-3" />
                    New
                  </Badge>
                </div>
              </div>
            ))}

            {/* Recent outcomes */}
            {outcomes.map((e) => (
              <div key={`out-${e.proposal.tx_hash}-${e.proposal.proposal_index}`} className="flex min-h-[2.5rem]">
                <DotConnector color="bg-blue-500" />
                <div className="flex flex-wrap items-center gap-1.5 py-1.5 min-w-0">
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${TYPE_COLORS[e.proposal.proposal_type] || ''}`}>
                    {typeLabel(e.proposal.proposal_type)}
                  </Badge>
                  <span className="text-sm truncate">
                    {e.proposal.title || `Proposal ${e.proposal.tx_hash.slice(0, 8)}…`}
                  </span>
                  <OutcomeBadge outcome={e.outcome} />
                  <span className="text-[10px] text-muted-foreground">Epoch {e.epoch}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
