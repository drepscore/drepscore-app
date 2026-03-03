'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { posthog } from '@/lib/posthog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { AnimatedTabs, type TabDefinition } from '@/components/AnimatedTabs';
import { FeatureGate } from '@/components/FeatureGate';
import {
  Server,
  Inbox,
  ScrollText,
  Award,
  UserCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowRight,
  ExternalLink,
  BarChart3,
  Search,
  Copy,
  Check,
  ArrowLeft,
  Clock,
  Filter,
} from 'lucide-react';

interface SpoVote {
  pool_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: string;
  block_time: number;
  epoch: number;
  proposalTitle: string | null;
  proposalType: string | null;
}

interface PendingProposal {
  tx_hash: string;
  proposal_index: number;
  title: string | null;
  proposal_type: string | null;
  expiration_epoch: number | null;
}

interface SpoDashboardData {
  poolId: string;
  votes: SpoVote[];
  totalProposals: number;
  participationRate: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  pendingProposals: PendingProposal[];
}

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

const VOTE_ICON: Record<string, typeof CheckCircle2> = {
  Yes: CheckCircle2,
  No: XCircle,
  Abstain: MinusCircle,
};

const VOTE_COLOR: Record<string, string> = {
  Yes: 'text-green-600 dark:text-green-400',
  No: 'text-red-600 dark:text-red-400',
  Abstain: 'text-muted-foreground',
};

export function SpoDashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <SpoDashboardInner />
    </Suspense>
  );
}

function SpoDashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlPoolId = searchParams.get('poolId');

  const [poolIdInput, setPoolIdInput] = useState(urlPoolId ?? '');
  const [activePoolId, setActivePoolId] = useState(urlPoolId ?? '');
  const [data, setData] = useState<SpoDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleLookup = () => {
    const trimmed = poolIdInput.trim();
    if (!trimmed) return;
    setActivePoolId(trimmed);
    router.replace(`/dashboard/spo?poolId=${encodeURIComponent(trimmed)}`, { scroll: false });
  };

  useEffect(() => {
    if (!activePoolId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/dashboard/spo?poolId=${encodeURIComponent(activePoolId)}`,
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed (${res.status})`);
        }
        const json: SpoDashboardData = await res.json();
        if (!cancelled) {
          setData(json);
          try {
            posthog?.capture('spo_dashboard_viewed', {
              pool_id: activePoolId,
              vote_count: json.votes.length,
              participation_rate: json.participationRate,
            });
          } catch {}
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activePoolId]);

  const copyPoolId = () => {
    navigator.clipboard.writeText(activePoolId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <FeatureGate
      flag="spo_profiles"
      fallback={
        <div className="container mx-auto px-4 py-16 max-w-lg text-center">
          <Card className="border-2 border-dashed">
            <CardContent className="pt-8 pb-8 space-y-4">
              <Server className="h-12 w-12 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-bold">SPO Dashboard — Coming Soon</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                The SPO governance dashboard is under development. Check back soon.
              </p>
              <Link href="/dashboard">
                <Button variant="outline" className="gap-2 mt-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      }
    >
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">SPO Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Track your stake pool&apos;s governance participation, voting record, and reputation.
          </p>
        </div>

        {/* Pool ID Entry */}
        <Card className="mb-6">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter your pool ID (pool1...)"
                  value={poolIdInput}
                  onChange={(e) => setPoolIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleLookup} disabled={!poolIdInput.trim()}>
                Load Dashboard
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Paste your Bech32 pool ID. Wallet-to-pool mapping coming soon.
            </p>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && <DashboardSkeleton />}

        {/* Error */}
        {error && !loading && (
          <Card className="border-destructive/30">
            <CardContent className="pt-6 pb-6 text-center space-y-2">
              <p className="text-sm text-destructive font-medium">{error}</p>
              <p className="text-xs text-muted-foreground">
                Make sure you entered a valid pool ID.
              </p>
            </CardContent>
          </Card>
        )}

        {/* No pool yet */}
        {!activePoolId && !loading && !error && (
          <Card className="border-2 border-dashed">
            <CardContent className="pt-12 pb-12 text-center space-y-3">
              <Server className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h2 className="text-lg font-bold">Enter your Pool ID</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Paste your pool&apos;s Bech32 ID above to view your governance dashboard.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Dashboard Content */}
        {data && !loading && (
          <>
            {/* Hero Stats */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 px-4 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent mb-6">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-muted-foreground truncate max-w-[180px] sm:max-w-[280px]">
                  {data.poolId}
                </span>
                <button
                  onClick={copyPoolId}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  title="Copy pool ID"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-foreground tabular-nums">
                  {data.participationRate}%
                </span>{' '}
                <span className="text-muted-foreground">participation</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">
                  {data.votes.length}
                </span>{' '}
                / {data.totalProposals} proposals
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-green-600 dark:text-green-400 tabular-nums">
                  {data.yesCount} Yes
                </span>
                <span className="text-red-600 dark:text-red-400 tabular-nums">
                  {data.noCount} No
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {data.abstainCount} Abstain
                </span>
              </div>
              <Link
                href={`/pool/${encodeURIComponent(data.poolId)}`}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Public Profile <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {/* Tabs */}
            <SpoDashboardTabs data={data} />
          </>
        )}
      </div>
    </FeatureGate>
  );
}

function SpoDashboardTabs({ data }: { data: SpoDashboardData }) {
  const tabs: TabDefinition[] = [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: Inbox,
      content: <InboxTab pendingProposals={data.pendingProposals} poolId={data.poolId} />,
    },
    {
      id: 'record',
      label: 'Voting Record',
      icon: ScrollText,
      content: <VotingRecordTab votes={data.votes} />,
    },
    {
      id: 'reputation',
      label: 'Reputation',
      icon: Award,
      content: <ReputationTab data={data} />,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: UserCircle,
      content: <ProfileTab poolId={data.poolId} />,
    },
  ];

  return <AnimatedTabs tabs={tabs} defaultTab="inbox" stickyOffset={64} />;
}

/* ── Inbox Tab ── */

function InboxTab({
  pendingProposals,
  poolId,
}: {
  pendingProposals: PendingProposal[];
  poolId: string;
}) {
  const [typeFilter, setTypeFilter] = useState('all');

  const proposalTypes = useMemo(() => {
    const types = new Set(pendingProposals.map((p) => p.proposal_type).filter(Boolean) as string[]);
    return [...types].sort();
  }, [pendingProposals]);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return pendingProposals;
    return pendingProposals.filter((p) => p.proposal_type === typeFilter);
  }, [pendingProposals, typeFilter]);

  if (pendingProposals.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="pt-8 pb-8 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 dark:text-green-400" />
          <h2 className="text-lg font-bold">All Caught Up</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            There are no open proposals waiting for this pool&apos;s vote.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{pendingProposals.length}</span> proposals
          awaiting your vote
        </p>
        {proposalTypes.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {proposalTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Proposal</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={`${p.tx_hash}-${p.proposal_index}`}>
                    <TableCell>
                      <Link
                        href={`/proposals/${p.tx_hash}/${p.proposal_index}`}
                        className="text-xs font-medium hover:underline truncate block max-w-[280px]"
                      >
                        {p.title || `${p.tx_hash.slice(0, 16)}...`}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {TYPE_LABELS[p.proposal_type ?? ''] || p.proposal_type || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/proposals/${p.tx_hash}/${p.proposal_index}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                          View <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Voting Record Tab ── */

function VotingRecordTab({ votes }: { votes: SpoVote[] }) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [voteFilter, setVoteFilter] = useState('all');

  const proposalTypes = useMemo(() => {
    const types = new Set(votes.map((v) => v.proposalType).filter(Boolean) as string[]);
    return [...types].sort();
  }, [votes]);

  const filtered = useMemo(() => {
    let list = votes;
    if (typeFilter !== 'all') list = list.filter((v) => v.proposalType === typeFilter);
    if (voteFilter !== 'all') list = list.filter((v) => v.vote === voteFilter);
    return list;
  }, [votes, typeFilter, voteFilter]);

  if (votes.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="pt-8 pb-8 text-center space-y-3">
          <ScrollText className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h2 className="text-lg font-bold">No Votes Yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            This pool hasn&apos;t cast any governance votes yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{votes.length}</span> total votes
        </p>
        <div className="flex items-center gap-2">
          <Select value={voteFilter} onValueChange={setVoteFilter}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="All Votes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Votes</SelectItem>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
              <SelectItem value="Abstain">Abstain</SelectItem>
            </SelectContent>
          </Select>
          {proposalTypes.length > 1 && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {proposalTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Proposal</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vote</TableHead>
                  <TableHead>Epoch</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v) => {
                  const VoteIcon = VOTE_ICON[v.vote] ?? MinusCircle;
                  const voteColor = VOTE_COLOR[v.vote] ?? 'text-muted-foreground';
                  const date = new Date(v.block_time * 1000);
                  return (
                    <TableRow key={`${v.proposal_tx_hash}-${v.proposal_index}-${v.vote}`}>
                      <TableCell>
                        <Link
                          href={`/proposals/${v.proposal_tx_hash}/${v.proposal_index}`}
                          className="text-xs font-medium hover:underline truncate block max-w-[260px]"
                        >
                          {v.proposalTitle || `${v.proposal_tx_hash.slice(0, 16)}...`}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {TYPE_LABELS[v.proposalType ?? ''] || v.proposalType || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${voteColor}`}>
                          <VoteIcon className="h-3.5 w-3.5" />
                          {v.vote}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {v.epoch}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {date.toLocaleDateString()}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Reputation Tab ── */

function ReputationTab({ data }: { data: SpoDashboardData }) {
  const epochActivity = useMemo(() => {
    const map = new Map<number, number>();
    for (const v of data.votes) {
      map.set(v.epoch, (map.get(v.epoch) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [data.votes]);

  const mostActiveEpoch = epochActivity.length > 0
    ? epochActivity.reduce((best, cur) => (cur[1] > best[1] ? cur : best))
    : null;

  const consecutiveEpochs = useMemo(() => {
    if (epochActivity.length === 0) return 0;
    const epochs = new Set(data.votes.map((v) => v.epoch));
    const sorted = [...epochs].sort((a, b) => b - a);
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1] - sorted[i] === 1) streak++;
      else break;
    }
    return streak;
  }, [data.votes, epochActivity.length]);

  const yesRate = data.votes.length > 0
    ? Math.round((data.yesCount / data.votes.length) * 100)
    : 0;
  const noRate = data.votes.length > 0
    ? Math.round((data.noCount / data.votes.length) * 100)
    : 0;
  const abstainRate = data.votes.length > 0
    ? Math.round((data.abstainCount / data.votes.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<BarChart3 className="h-4 w-4 text-primary" />}
          label="Participation"
          value={`${data.participationRate}%`}
        />
        <StatCard
          icon={<ScrollText className="h-4 w-4 text-primary" />}
          label="Total Votes"
          value={data.votes.length.toString()}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          label="Active Streak"
          value={`${consecutiveEpochs} epoch${consecutiveEpochs !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon={<Award className="h-4 w-4 text-primary" />}
          label="Most Active"
          value={mostActiveEpoch ? `Epoch ${mostActiveEpoch[0]}` : '—'}
          sublabel={mostActiveEpoch ? `${mostActiveEpoch[1]} votes` : undefined}
        />
      </div>

      {/* Vote Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Vote Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <VoteBar label="Yes" count={data.yesCount} pct={yesRate} color="bg-green-500" />
            <VoteBar label="No" count={data.noCount} pct={noRate} color="bg-red-500" />
            <VoteBar label="Abstain" count={data.abstainCount} pct={abstainRate} color="bg-gray-400 dark:bg-gray-600" />
          </div>
        </CardContent>
      </Card>

      {/* Epoch Activity */}
      {epochActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Votes by Epoch</CardTitle>
            <CardDescription className="text-xs">Recent epochs first</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
              {epochActivity.slice(0, 14).map(([epoch, count]) => (
                <div
                  key={epoch}
                  className="text-center rounded-md border p-2"
                >
                  <p className="text-xs text-muted-foreground">E{epoch}</p>
                  <p className="text-sm font-bold tabular-nums">{count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Profile Tab ── */

function ProfileTab({ poolId }: { poolId: string }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            Pool Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Pool ID</p>
            <p className="font-mono text-xs break-all">{poolId}</p>
          </div>
          <div className="pt-3 border-t">
            <Link href={`/pool/${encodeURIComponent(poolId)}`}>
              <Button variant="outline" size="sm" className="gap-2 text-xs">
                View Public Profile <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-6 pb-6 text-center space-y-2">
          <p className="text-sm font-medium">Governance Philosophy</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            SPO governance philosophy editing is coming soon. This will let you describe your
            pool&apos;s governance principles and priorities to delegators.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Shared subcomponents ── */

function StatCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-lg font-bold tabular-nums">{value}</p>
        {sublabel && (
          <p className="text-[10px] text-muted-foreground">{sublabel}</p>
        )}
      </CardContent>
    </Card>
  );
}

function VoteBar({
  label,
  count,
  pct,
  color,
}: {
  label: string;
  count: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <Skeleton className="h-4 w-32 mb-3" />
      <Skeleton className="h-8 w-64 mb-2" />
      <Skeleton className="h-4 w-96 mb-6" />
      <Skeleton className="h-16 w-full mb-6" />
      <Skeleton className="h-14 w-full rounded-lg mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-[300px] w-full" />
    </div>
  );
}
