'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useProposals, useDRepVotes } from '@/hooks/queries';
import { useWallet } from '@/utils/wallet-context';

const TYPE_COLORS: Record<string, string> = {
  ParameterChange: 'bg-blue-950/30 text-blue-400 border-blue-800/30',
  HardForkInitiation: 'bg-orange-950/30 text-orange-400 border-orange-800/30',
  TreasuryWithdrawals: 'bg-emerald-950/30 text-emerald-400 border-emerald-800/30',
  NewConstitution: 'bg-purple-950/30 text-purple-400 border-purple-800/30',
  NoConfidence: 'bg-rose-950/30 text-rose-400 border-rose-800/30',
  UpdateCommittee: 'bg-violet-950/30 text-violet-400 border-violet-800/30',
  InfoAction: 'bg-muted text-muted-foreground',
};

const STATUS_COLORS: Record<string, string> = {
  Open: 'text-emerald-400',
  Ratified: 'text-sky-400',
  Enacted: 'text-violet-400',
  Dropped: 'text-muted-foreground',
  Expired: 'text-muted-foreground/70',
};

const STATUS_FILTERS = ['All', 'Open', 'Ratified', 'Enacted', 'Expired', 'Dropped'];

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    ParameterChange: 'Param Change',
    HardForkInitiation: 'Hard Fork',
    TreasuryWithdrawals: 'Treasury',
    NewConstitution: 'Constitution',
    NoConfidence: 'No Confidence',
    UpdateCommittee: 'Committee',
    InfoAction: 'Info',
  };
  return map[type] ?? type;
}

const VOTE_PILL: Record<string, { label: string; color: string }> = {
  Yes: { label: 'Yes', color: 'text-green-500 bg-green-500/10 border-green-500/20' },
  No: { label: 'No', color: 'text-red-500 bg-red-500/10 border-red-500/20' },
  Abstain: { label: 'Abstain', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
};

export function ProposalsBrowse() {
  const { data: rawData, isLoading } = useProposals(200);
  const data = rawData as any;
  const proposals: any[] = data?.proposals ?? [];
  const { delegatedDrepId } = useWallet();
  const { data: drepVotesRaw } = useDRepVotes(delegatedDrepId);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Build a lookup: "txHash:index" -> vote
  const drepVoteMap = useMemo(() => {
    const map = new Map<string, string>();
    const votes = (drepVotesRaw as any)?.votes ?? drepVotesRaw;
    if (Array.isArray(votes)) {
      for (const v of votes) {
        const key = `${v.proposal_tx_hash ?? v.proposalTxHash}:${v.proposal_index ?? v.proposalIndex}`;
        map.set(key, v.vote);
      }
    }
    return map;
  }, [drepVotesRaw]);

  const filtered = useMemo(() => {
    let r = proposals;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (p: any) =>
          p.title?.toLowerCase().includes(q) ||
          p.txHash?.toLowerCase().includes(q) ||
          p.type?.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'All') {
      r = r.filter((p: any) => (p.status ?? 'Open').toLowerCase() === statusFilter.toLowerCase());
    }
    return r;
  }, [proposals, search, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search proposals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">{filtered.length}</strong> proposals
      </p>

      {/* ── List ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          No proposals match your search.
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border/50 overflow-hidden">
          {filtered.map((p: any) => {
            const status = p.status ?? 'Open';
            const drepVote = drepVoteMap.get(`${p.txHash}:${p.index}`);
            const pill = drepVote ? VOTE_PILL[drepVote] : null;
            return (
              <Link
                key={`${p.txHash}-${p.index}`}
                href={`/proposal/${p.txHash}/${p.index}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
              >
                {p.type && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
                      TYPE_COLORS[p.type] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {typeLabel(p.type)}
                  </span>
                )}
                <span className="flex-1 text-sm text-foreground truncate min-w-0">
                  {p.title || `${p.txHash?.slice(0, 16)}…`}
                </span>
                {pill && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 hidden sm:inline',
                      pill.color,
                    )}
                    title={`Your DRep voted ${pill.label}`}
                  >
                    DRep: {pill.label}
                  </span>
                )}
                <span
                  className={cn(
                    'text-xs font-medium shrink-0',
                    STATUS_COLORS[status] ?? 'text-muted-foreground',
                  )}
                >
                  {status}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0 group-hover:text-muted-foreground transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
