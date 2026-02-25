'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ProposalWithVoteSummary } from '@/lib/data';
import { useWallet } from '@/utils/wallet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  Search,
  Heart,
  UserCheck,
  CheckCircle2,
  XCircle,
  MinusCircle,
  CircleDashed,
} from 'lucide-react';
import { stripMarkdown } from '@/utils/text';
import { Sparkles } from 'lucide-react';
import {
  ProposalStatusBadge,
  PriorityBadge,
  DeadlineBadge,
  TreasuryTierBadge,
  TypeExplainerTooltip,
} from '@/components/ProposalStatusBadge';
import { ThresholdMeter } from '@/components/ThresholdMeter';
import { getProposalStatus } from '@/utils/proposalPriority';

interface ProposalsListClientProps {
  proposals: ProposalWithVoteSummary[];
  watchlist?: string[];
  currentEpoch: number;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Landmark; color: string }> = {
  TreasuryWithdrawals: { label: 'Treasury', icon: Landmark, color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  ParameterChange: { label: 'Parameter Change', icon: Shield, color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  HardForkInitiation: { label: 'Hard Fork', icon: Zap, color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  InfoAction: { label: 'Info Action', icon: Eye, color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30' },
  NoConfidence: { label: 'No Confidence', icon: Scale, color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  NewCommittee: { label: 'Committee', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  NewConstitutionalCommittee: { label: 'Committee', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  NewConstitution: { label: 'Constitution', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  UpdateConstitution: { label: 'Constitution', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
};

type SortKey = 'date' | 'votes' | 'title';
type StatusTab = 'open' | 'closed' | 'all';

interface DRepVoteMap {
  [key: string]: 'Yes' | 'No' | 'Abstain';
}

function DRepVoteIndicator({ vote }: { vote: 'Yes' | 'No' | 'Abstain' | null }) {
  if (!vote) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <CircleDashed className="h-3 w-3" />
        Not voted
      </span>
    );
  }

  const config = {
    Yes: { icon: CheckCircle2, className: 'text-green-600 dark:text-green-400' },
    No: { icon: XCircle, className: 'text-red-600 dark:text-red-400' },
    Abstain: { icon: MinusCircle, className: 'text-amber-600 dark:text-amber-400' },
  }[vote];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${config.className}`}>
      <Icon className="h-3 w-3" />
      {vote}
    </span>
  );
}

export function ProposalsListClient({ proposals, watchlist = [], currentEpoch }: ProposalsListClientProps) {
  const { delegatedDrepId } = useWallet();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [showMyDrepOnly, setShowMyDrepOnly] = useState(false);
  const [statusTab, setStatusTab] = useState<StatusTab>('open');
  const [drepVotes, setDrepVotes] = useState<DRepVoteMap>({});

  // Fetch delegated DRep's votes client-side for the vote indicator
  useEffect(() => {
    if (!delegatedDrepId) {
      setDrepVotes({});
      return;
    }
    fetch(`/api/drep/${delegatedDrepId}/votes`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.votes) {
          const map: DRepVoteMap = {};
          for (const v of data.votes) {
            map[`${v.proposalTxHash}-${v.proposalIndex}`] = v.vote;
          }
          setDrepVotes(map);
        }
      })
      .catch(() => {});
  }, [delegatedDrepId]);

  const preserveScroll = useCallback((fn: () => void) => {
    const y = window.scrollY;
    fn();
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' })));
  }, []);

  const types = useMemo(() => {
    const set = new Set(proposals.map(p => p.proposalType));
    return [...set].sort();
  }, [proposals]);

  const statusCounts = useMemo(() => {
    let open = 0, closed = 0;
    for (const p of proposals) {
      const s = getProposalStatus(p);
      if (s === 'open') open++;
      else closed++;
    }
    return { open, closed, all: proposals.length };
  }, [proposals]);

  const filtered = useMemo(() => {
    let result = proposals;

    // Status tab filter
    if (statusTab === 'open') {
      result = result.filter(p => getProposalStatus(p) === 'open');
    } else if (statusTab === 'closed') {
      result = result.filter(p => getProposalStatus(p) !== 'open');
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.abstract || '').toLowerCase().includes(q) ||
        (p.aiSummary || '').toLowerCase().includes(q) ||
        p.txHash.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(p => p.proposalType === typeFilter);
    }

    // Watchlist filter
    if (showWatchlistOnly && watchlist.length > 0) {
      const wSet = new Set(watchlist);
      result = result.filter(p => p.voterDrepIds.some(id => wSet.has(id)));
    }

    // My DRep filter
    if (showMyDrepOnly && delegatedDrepId) {
      result = result.filter(p => p.voterDrepIds.includes(delegatedDrepId));
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
  }, [proposals, typeFilter, sortKey, searchQuery, showWatchlistOnly, showMyDrepOnly, watchlist, delegatedDrepId, statusTab]);

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="flex gap-1 border-b">
        {(['open', 'closed', 'all'] as StatusTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => preserveScroll(() => setStatusTab(tab))}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'open' ? `Open (${statusCounts.open})` :
             tab === 'closed' ? `Closed (${statusCounts.closed})` :
             `All (${statusCounts.all})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search proposals by title, description, or tx hash..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
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

        {delegatedDrepId && (
          <Button
            variant={showMyDrepOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => preserveScroll(() => setShowMyDrepOnly(!showMyDrepOnly))}
            className="gap-1.5"
          >
            <UserCheck className="h-3.5 w-3.5" />
            My DRep
          </Button>
        )}

        {watchlist.length > 0 && (
          <Button
            variant={showWatchlistOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => preserveScroll(() => setShowWatchlistOnly(!showWatchlistOnly))}
            className="gap-1.5"
          >
            <Heart className="h-3.5 w-3.5" />
            Watchlist
          </Button>
        )}

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

          const status = getProposalStatus(p);
          const isOpen = status === 'open';
          const voteKey = `${p.txHash}-${p.proposalIndex}`;
          const drepVote = delegatedDrepId ? (drepVotes[voteKey] || null) : null;

          return (
            <Link
              key={voteKey}
              href={`/proposals/${p.txHash}/${p.proposalIndex}`}
            >
              <Card className="hover:bg-muted/30 transition-colors cursor-pointer group mb-3">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Badges row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <ProposalStatusBadge
                          ratifiedEpoch={p.ratifiedEpoch}
                          enactedEpoch={p.enactedEpoch}
                          droppedEpoch={p.droppedEpoch}
                          expiredEpoch={p.expiredEpoch}
                        />
                        <PriorityBadge proposalType={p.proposalType} />
                        {config && (
                          <Badge variant="outline" className={`gap-1 ${config.color}`}>
                            {TypeIcon && <TypeIcon className="h-3 w-3" />}
                            {config.label}
                          </Badge>
                        )}
                        <TypeExplainerTooltip proposalType={p.proposalType} />
                        {p.treasuryTier && (
                          <TreasuryTierBadge tier={p.treasuryTier} />
                        )}
                        {isOpen && (
                          <DeadlineBadge expirationEpoch={p.expirationEpoch} currentEpoch={currentEpoch} />
                        )}
                        {date && (
                          <span className="text-xs text-muted-foreground">{date}</span>
                        )}
                      </div>

                      {/* Title */}
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">
                        {p.title || `Proposal ${p.txHash.slice(0, 8)}...`}
                      </p>

                      {/* Summary / Abstract */}
                      {p.aiSummary ? (
                        <div className="flex items-start gap-1.5">
                          <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                          <p className="text-xs text-muted-foreground">
                            {stripMarkdown(p.aiSummary)}
                          </p>
                        </div>
                      ) : p.abstract ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {stripMarkdown(p.abstract)}
                        </p>
                      ) : null}

                      {/* Bottom row: threshold meter + DRep indicator */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <ThresholdMeter
                            txHash={p.txHash}
                            proposalIndex={p.proposalIndex}
                            proposalType={p.proposalType}
                            yesCount={p.yesCount}
                            noCount={p.noCount}
                            abstainCount={p.abstainCount}
                            totalVotes={p.totalVotes}
                            isOpen={isOpen}
                            variant="compact"
                          />
                        </div>
                        {delegatedDrepId && (
                          <div className="shrink-0">
                            <DRepVoteIndicator vote={drepVote} />
                          </div>
                        )}
                      </div>
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
