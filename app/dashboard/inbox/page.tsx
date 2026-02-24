'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Inbox,
  ArrowLeft,
  TrendingUp,
  Clock,
  Shield,
  Wallet,
  ChevronUp,
  ChevronDown,
  Vote,
  Zap,
  Filter,
} from 'lucide-react';
import { ProposalDrawer } from '@/components/ProposalDrawer';

interface PendingProposal {
  txHash: string;
  proposalIndex: number;
  title: string | null;
  abstract: string | null;
  aiSummary: string | null;
  proposalType: string;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
  relevantPrefs: string[];
  proposedEpoch: number | null;
  blockTime: number | null;
  priority: 'critical' | 'important' | 'standard';
  estimatedExpirationEpoch: number | null;
  epochsRemaining: number | null;
  perProposalScoreImpact: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalVotes: number;
}

interface InboxData {
  pendingProposals: PendingProposal[];
  pendingCount: number;
  votedThisEpoch: number;
  currentEpoch: number;
  scoreImpact: {
    currentScore: number;
    simulatedScore: number;
    potentialGain: number;
    perProposalGain: number;
  };
  criticalCount: number;
  urgentCount: number;
}

type SortField = 'priority' | 'deadline' | 'type' | 'impact';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER = { critical: 0, important: 1, standard: 2 };
const PRIORITY_STYLES = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  important: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  standard: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const TYPE_LABELS: Record<string, string> = {
  TreasuryWithdrawals: 'Treasury',
  ParameterChange: 'Param Change',
  HardForkInitiation: 'Hard Fork',
  InfoAction: 'Info',
  NoConfidence: 'No Confidence',
  NewCommittee: 'Committee',
  NewConstitutionalCommittee: 'Committee',
  NewConstitution: 'Constitution',
  UpdateConstitution: 'Constitution',
};

export default function InboxPage() {
  const { connected, isAuthenticated, ownDRepId, connecting } = useWallet();
  const [data, setData] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedProposal, setSelectedProposal] = useState<PendingProposal | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const drepId = ownDRepId;

  useEffect(() => {
    if (connecting || !connected || !drepId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/dashboard/inbox?drepId=${encodeURIComponent(drepId)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [connecting, connected, drepId]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const openDrawer = useCallback((proposal: PendingProposal) => {
    setSelectedProposal(proposal);
    setDrawerOpen(true);
  }, []);

  // Derive unique proposal types for filter
  const proposalTypes = useMemo(() => {
    if (!data) return [];
    const types = new Set(data.pendingProposals.map(p => p.proposalType));
    return [...types].sort();
  }, [data]);

  // Filter and sort
  const sorted = useMemo(() => {
    if (!data) return [];
    let list = [...data.pendingProposals];

    if (typeFilter !== 'all') {
      list = list.filter(p => p.proposalType === typeFilter);
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'priority':
          cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case 'deadline':
          cmp = (a.epochsRemaining ?? 999) - (b.epochsRemaining ?? 999);
          break;
        case 'type':
          cmp = a.proposalType.localeCompare(b.proposalType);
          break;
        case 'impact':
          cmp = b.perProposalScoreImpact - a.perProposalScoreImpact;
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [data, typeFilter, sortField, sortDir]);

  if (connecting) return <InboxSkeleton />;
  if (!connected || !isAuthenticated) return <ConnectWalletCTA />;
  if (!drepId) return <NotADRepCTA />;
  if (loading) return <InboxSkeleton />;

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Governance Inbox</h1>
            {data && (
              <Badge variant="outline" className="text-xs font-bold tabular-nums">
                {data.pendingCount} pending
              </Badge>
            )}
          </div>
          {data && data.currentEpoch > 0 && (
            <span className="text-xs text-muted-foreground">
              Epoch {data.currentEpoch}
            </span>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {data && data.pendingCount > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon={<Inbox className="h-4 w-4" />}
            label="Pending"
            value={data.pendingCount.toString()}
          />
          <StatCard
            icon={<Zap className="h-4 w-4" />}
            label="Voted This Epoch"
            value={data.votedThisEpoch.toString()}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4 text-green-600" />}
            label="Potential Gain"
            value={`+${data.scoreImpact.potentialGain} pts`}
            highlight
          />
          <StatCard
            icon={<Clock className="h-4 w-4 text-amber-600" />}
            label="Urgent"
            value={data.urgentCount.toString()}
            warn={data.urgentCount > 0}
          />
        </div>
      )}

      {/* Empty State */}
      {(!data || data.pendingCount === 0) && (
        <Card className="border-2 border-dashed">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <Vote className="h-12 w-12 mx-auto text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-bold">All Caught Up!</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              There are no open proposals waiting for your vote. Check back later or review your voting history on the dashboard.
            </p>
            <Link href="/dashboard">
              <Button variant="outline" className="gap-2 mt-2">
                <ArrowLeft className="h-4 w-4" /> Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Proposals Table */}
      {data && data.pendingCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm">Open Proposals</CardTitle>
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {proposalTypes.map(t => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t] || t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <div className="border-t overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="priority" current={sortField} dir={sortDir} onSort={handleSort}>
                      Priority
                    </SortableHeader>
                    <TableHead className="min-w-[200px]">Proposal</TableHead>
                    <SortableHeader field="type" current={sortField} dir={sortDir} onSort={handleSort}>
                      Type
                    </SortableHeader>
                    <SortableHeader field="deadline" current={sortField} dir={sortDir} onSort={handleSort}>
                      Deadline
                    </SortableHeader>
                    <TableHead className="text-right">Votes</TableHead>
                    <SortableHeader field="impact" current={sortField} dir={sortDir} onSort={handleSort} className="text-right">
                      Impact
                    </SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(p => (
                    <TableRow
                      key={`${p.txHash}-${p.proposalIndex}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDrawer(p)}
                    >
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLES[p.priority]}`}>
                          {p.priority === 'critical' ? 'Critical' : p.priority === 'important' ? 'Important' : 'Standard'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate max-w-[280px]">
                            {p.title || `Proposal ${p.txHash.slice(0, 12)}...`}
                          </p>
                          {p.withdrawalAmount != null && (
                            <p className="text-[10px] text-muted-foreground">
                              {p.withdrawalAmount.toLocaleString()} ADA
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {TYPE_LABELS[p.proposalType] || p.proposalType}
                        </span>
                      </TableCell>
                      <TableCell>
                        {p.epochsRemaining != null ? (
                          <span className={`text-xs tabular-nums ${
                            p.epochsRemaining <= 1 ? 'text-red-600 dark:text-red-400 font-semibold' :
                            p.epochsRemaining <= 2 ? 'text-amber-600 dark:text-amber-400' :
                            'text-muted-foreground'
                          }`}>
                            {p.epochsRemaining} epoch{p.epochsRemaining !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {p.totalVotes}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.perProposalScoreImpact > 0 ? (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium tabular-nums">
                            +{p.perProposalScoreImpact}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proposal Drawer */}
      <ProposalDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        proposal={selectedProposal}
        drepId={drepId}
      />
    </div>
  );
}

function SortableHeader({
  field,
  current,
  dir,
  onSort,
  children,
  className,
}: {
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const active = field === current;
  return (
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground ${className || ''}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && (dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </TableHead>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <Card className={warn ? 'border-amber-500/30' : highlight ? 'border-green-500/30' : ''}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
        </div>
        <p className={`text-lg font-bold tabular-nums ${
          highlight ? 'text-green-600 dark:text-green-400' :
          warn ? 'text-amber-600 dark:text-amber-400' : ''
        }`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function InboxSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <Skeleton className="h-4 w-32 mb-3" />
      <Skeleton className="h-8 w-64 mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}

function ConnectWalletCTA() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-lg text-center">
      <Card className="border-2 border-dashed">
        <CardContent className="pt-8 pb-8 space-y-4">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-bold">Connect Your Wallet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Connect a Cardano wallet with DRep credentials to access your Governance Inbox.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NotADRepCTA() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-lg text-center">
      <Card className="border-2 border-dashed">
        <CardContent className="pt-8 pb-8 space-y-4">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-bold">DRep Access Required</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            The Governance Inbox is available for registered DReps. Connect the wallet associated with your DRep registration.
          </p>
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2 mt-2">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
