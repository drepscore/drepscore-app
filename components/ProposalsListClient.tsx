'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ProposalWithVoteSummary } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Zap,
  Landmark,
  Eye,
  Scale,
  ArrowUpDown,
  ChevronRight,
} from 'lucide-react';

interface ProposalsListClientProps {
  proposals: ProposalWithVoteSummary[];
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Landmark; color: string }> = {
  TreasuryWithdrawals: { label: 'Treasury', icon: Landmark, color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  ParameterChange: { label: 'Parameter Change', icon: Shield, color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  HardForkInitiation: { label: 'Hard Fork', icon: Zap, color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  InfoAction: { label: 'Info Action', icon: Eye, color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30' },
  NoConfidence: { label: 'No Confidence', icon: Scale, color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  NewConstitutionalCommittee: { label: 'Committee', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  UpdateConstitution: { label: 'Constitution', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
};

const TREASURY_TIER_LABELS: Record<string, string> = {
  routine: '< 1M ADA',
  significant: '1M – 20M ADA',
  major: '> 20M ADA',
};

type SortKey = 'date' | 'votes' | 'title';

function VoteMiniBar({ yes, no, abstain }: { yes: number; no: number; abstain: number }) {
  const total = yes + no + abstain;
  if (total === 0) return <span className="text-xs text-muted-foreground">No votes yet</span>;

  const yp = (yes / total) * 100;
  const np = (no / total) * 100;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
        <div className="bg-green-500 h-full" style={{ width: `${yp}%` }} />
        <div className="bg-red-500 h-full" style={{ width: `${np}%` }} />
        <div className="bg-amber-500 h-full flex-1" />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {total} votes
      </span>
    </div>
  );
}

export function ProposalsListClient({ proposals }: ProposalsListClientProps) {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');

  const types = useMemo(() => {
    const set = new Set(proposals.map(p => p.proposalType));
    return [...set].sort();
  }, [proposals]);

  const filtered = useMemo(() => {
    let result = proposals;
    if (typeFilter !== 'all') {
      result = result.filter(p => p.proposalType === typeFilter);
    }
    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case 'date':
          return (b.blockTime || 0) - (a.blockTime || 0);
        case 'votes':
          return b.totalVotes - a.totalVotes;
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        default:
          return 0;
      }
    });
    return result;
  }, [proposals, typeFilter, sortKey]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types ({proposals.length})</SelectItem>
            {types.map(t => (
              <SelectItem key={t} value={t}>
                {TYPE_CONFIG[t]?.label || t} ({proposals.filter(p => p.proposalType === t).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-[160px]">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Newest First</SelectItem>
            <SelectItem value="votes">Most Votes</SelectItem>
            <SelectItem value="title">Title A-Z</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} proposals
        </span>
      </div>

      {/* Proposals List */}
      <div className="space-y-3">
        {filtered.map((p) => {
          const config = TYPE_CONFIG[p.proposalType];
          const TypeIcon = config?.icon;
          const date = p.blockTime
            ? new Date(p.blockTime * 1000).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
              })
            : null;

          return (
            <Link
              key={`${p.txHash}-${p.proposalIndex}`}
              href={`/proposals/${p.txHash}/${p.proposalIndex}`}
            >
              <Card className="hover:bg-muted/30 transition-colors cursor-pointer group mb-3">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Badges row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {config && (
                          <Badge variant="outline" className={`gap-1 ${config.color}`}>
                            {TypeIcon && <TypeIcon className="h-3 w-3" />}
                            {config.label}
                          </Badge>
                        )}
                        {p.treasuryTier && (
                          <Badge variant="outline" className="text-xs">
                            {TREASURY_TIER_LABELS[p.treasuryTier] || p.treasuryTier}
                          </Badge>
                        )}
                        {date && (
                          <span className="text-xs text-muted-foreground">{date}</span>
                        )}
                        {p.proposedEpoch && (
                          <span className="text-xs text-muted-foreground">Epoch {p.proposedEpoch}</span>
                        )}
                      </div>

                      {/* Title */}
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">
                        {p.title || `Proposal ${p.txHash.slice(0, 8)}...`}
                      </p>

                      {/* Abstract */}
                      {(p.aiSummary || p.abstract) && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {p.aiSummary || p.abstract}
                        </p>
                      )}

                      {/* Vote bar */}
                      <VoteMiniBar yes={p.yesCount} no={p.noCount} abstain={p.abstainCount} />
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No proposals match the current filters.
        </div>
      )}
    </div>
  );
}
