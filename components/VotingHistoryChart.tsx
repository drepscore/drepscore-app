'use client';

/**
 * Voting History Chart Component
 * Displays voting analytics with custom donut and area chart,
 * plus clickable vote cards with alignment flags and detail sheet.
 */

import { useState, useMemo } from 'react';
import { VoteRecord, UserPrefKey, VoteAlignment } from '@/types/drep';
import { evaluateVoteAlignment } from '@/lib/alignment';
import { VoteDetailSheet } from '@/components/VoteDetailSheet';
import { stripMarkdown } from '@/utils/text';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Shield,
  Zap,
  Landmark,
  Eye,
  Scale,
  CheckCircle2,
  AlertCircle,
  Search,
} from 'lucide-react';
import Link from 'next/link';

interface VotingHistoryChartProps {
  votes: VoteRecord[];
  userPrefs?: UserPrefKey[];
}

interface DonutSegment {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

const PROPOSAL_TYPE_CONFIG: Record<string, { label: string; icon: typeof Landmark }> = {
  TreasuryWithdrawals: { label: 'Treasury', icon: Landmark },
  ParameterChange: { label: 'Param Change', icon: Shield },
  HardForkInitiation: { label: 'Hard Fork', icon: Zap },
  InfoAction: { label: 'Info', icon: Eye },
  NoConfidence: { label: 'No Confidence', icon: Scale },
  NewCommittee: { label: 'Committee', icon: Scale },
  NewConstitutionalCommittee: { label: 'Committee', icon: Scale },
  NewConstitution: { label: 'Constitution', icon: Scale },
  UpdateConstitution: { label: 'Constitution', icon: Scale },
};

function VoteDonut({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  
  let currentOffset = 0;
  
  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/20"
          />
          {segments.map((segment, i) => {
            const segmentLength = (segment.percentage / 100) * circumference;
            const offset = currentOffset;
            currentOffset += segmentLength;
            
            if (segment.value === 0) return null;
            
            return (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums">{total}</span>
          <span className="text-xs text-muted-foreground">votes</span>
        </div>
      </div>
      
      <div className="space-y-2">
        {segments.map((segment, i) => (
          <div key={i} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-sm font-medium w-16">{segment.name}</span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {segment.value} ({segment.percentage.toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlignmentFlag({ alignment }: { alignment: VoteAlignment }) {
  if (alignment.status === 'neutral') return null;

  const isAligned = alignment.status === 'aligned';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="shrink-0">
            {isAligned ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-orange-500" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <p className="font-medium text-xs mb-1">
            {isAligned ? 'Aligned with your preferences' : 'Differs from your preferences'}
          </p>
          {alignment.reasons.map((r, i) => (
            <p key={i} className="text-xs text-muted-foreground">{r}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type VoteFilterType = 'all' | 'Yes' | 'No' | 'Abstain';

export function VotingHistoryChart({ votes, userPrefs = [] }: VotingHistoryChartProps) {
  const [showAllVotes, setShowAllVotes] = useState(false);
  const [selectedVote, setSelectedVote] = useState<VoteRecord | null>(null);
  const [voteSearchQuery, setVoteSearchQuery] = useState('');
  const [voteTypeFilter, setVoteTypeFilter] = useState<string>('all');
  const [voteDirectionFilter, setVoteDirectionFilter] = useState<VoteFilterType>('all');

  const yesCount = votes.filter(v => v.vote === 'Yes').length;
  const noCount = votes.filter(v => v.vote === 'No').length;
  const abstainCount = votes.filter(v => v.vote === 'Abstain').length;
  const total = votes.length;

  const segments: DonutSegment[] = [
    { name: 'Yes', value: yesCount, color: '#10b981', percentage: total > 0 ? (yesCount / total) * 100 : 0 },
    { name: 'No', value: noCount, color: '#ef4444', percentage: total > 0 ? (noCount / total) * 100 : 0 },
    { name: 'Abstain', value: abstainCount, color: '#f59e0b', percentage: total > 0 ? (abstainCount / total) * 100 : 0 },
  ];

  const monthlyVotes = votes.reduce((acc, vote) => {
    const month = vote.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    if (!acc[month]) {
      acc[month] = { month, dateObj: new Date(vote.date.getFullYear(), vote.date.getMonth(), 1), Yes: 0, No: 0, Abstain: 0, total: 0 };
    }
    acc[month][vote.vote]++;
    acc[month].total++;
    return acc;
  }, {} as Record<string, { month: string; dateObj: Date; Yes: number; No: number; Abstain: number; total: number }>);

  const monthlyData = Object.values(monthlyVotes).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  const proposalTypes = useMemo(() => {
    const set = new Set(votes.map(v => v.proposalType).filter(Boolean) as string[]);
    return [...set].sort();
  }, [votes]);

  const filteredVotes = useMemo(() => {
    let result = votes;

    if (voteSearchQuery.trim()) {
      const q = voteSearchQuery.toLowerCase();
      result = result.filter(v =>
        (v.title || '').toLowerCase().includes(q) ||
        (v.abstract || '').toLowerCase().includes(q) ||
        v.proposalTxHash.toLowerCase().includes(q)
      );
    }

    if (voteTypeFilter !== 'all') {
      result = result.filter(v => v.proposalType === voteTypeFilter);
    }

    if (voteDirectionFilter !== 'all') {
      result = result.filter(v => v.vote === voteDirectionFilter);
    }

    return result;
  }, [votes, voteSearchQuery, voteTypeFilter, voteDirectionFilter]);

  const visibleVotes = showAllVotes ? filteredVotes : filteredVotes.slice(0, 10);

  const alignments = useMemo(() => {
    const map = new Map<string, VoteAlignment>();
    for (const vote of visibleVotes) {
      map.set(
        vote.id,
        evaluateVoteAlignment(
          vote.vote,
          vote.hasRationale,
          vote.proposalType,
          vote.treasuryTier,
          vote.relevantPrefs,
          userPrefs
        )
      );
    }
    return map;
  }, [visibleVotes, userPrefs]);

  if (votes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Voting History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No voting history available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Voting Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Voting Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="flex flex-col items-center lg:items-start">
              <p className="text-sm font-medium text-muted-foreground mb-4">Vote Distribution</p>
              <VoteDonut segments={segments} total={total} />
            </div>
            
            {monthlyData.length > 1 && (
              <div className="flex flex-col">
                <p className="text-sm font-medium text-muted-foreground mb-4">Activity Over Time</p>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradientYes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gradientNo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gradientAbstain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 11 }} 
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 11 }} 
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                      />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Area type="monotone" dataKey="Yes" stackId="1" stroke="#10b981" fill="url(#gradientYes)" strokeWidth={2} />
                      <Area type="monotone" dataKey="No" stackId="1" stroke="#ef4444" fill="url(#gradientNo)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Abstain" stackId="1" stroke="#f59e0b" fill="url(#gradientAbstain)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Votes List */}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>Voting History</CardTitle>
            <span className="text-sm text-muted-foreground">
              {filteredVotes.length === votes.length
                ? `${votes.length} total`
                : `${filteredVotes.length} of ${votes.length}`}
            </span>
          </div>

          {/* Search + Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search proposals..."
                value={voteSearchQuery}
                onChange={(e) => { setVoteSearchQuery(e.target.value); setShowAllVotes(false); }}
                className="pl-9 h-8 text-sm"
              />
            </div>

            {proposalTypes.length > 1 && (
              <Select value={voteTypeFilter} onValueChange={(v) => { setVoteTypeFilter(v); setShowAllVotes(false); }}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {proposalTypes.map(t => (
                    <SelectItem key={t} value={t}>
                      {PROPOSAL_TYPE_CONFIG[t]?.label || t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex gap-1">
              {(['all', 'Yes', 'No', 'Abstain'] as const).map(d => (
                <Button
                  key={d}
                  variant={voteDirectionFilter === d ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setVoteDirectionFilter(d); setShowAllVotes(false); }}
                  className="text-xs h-8 px-2.5"
                >
                  {d === 'all' ? 'All' : d}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {visibleVotes.map((vote) => {
              const alignment = alignments.get(vote.id) || { status: 'neutral' as const, reasons: [] };
              const typeConfig = vote.proposalType ? PROPOSAL_TYPE_CONFIG[vote.proposalType] : null;
              const TypeIcon = typeConfig?.icon;

              return (
                <button
                  key={vote.id}
                  onClick={() => setSelectedVote(vote)}
                  className="w-full text-left border rounded-lg p-3 hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Vote badge + type + date + alignment */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={
                          vote.vote === 'Yes' ? 'default' : 
                          vote.vote === 'No' ? 'destructive' : 
                          'secondary'
                        } className="shrink-0">
                          {vote.vote}
                        </Badge>
                        {typeConfig && (
                          <Badge variant="outline" className="text-xs gap-1 shrink-0">
                            {TypeIcon && <TypeIcon className="h-3 w-3" />}
                            {typeConfig.label}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {vote.date.toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                      
                      {/* Proposal title */}
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">
                        {vote.title || 'Untitled Proposal'}
                      </p>
                      
                      {/* Proposal summary */}
                      {(vote.aiSummary || vote.abstract) && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {stripMarkdown(vote.aiSummary || vote.abstract || '')}
                        </p>
                      )}

                      {/* Rationale summary */}
                      {(vote.rationaleAiSummary || vote.rationaleText) && (
                        <div className="bg-muted/30 rounded p-2 mt-1">
                          <p className="text-xs text-foreground/80 line-clamp-2">
                            <span className="font-semibold text-muted-foreground">Rationale: </span>
                            {stripMarkdown(vote.rationaleAiSummary || vote.rationaleText || '')}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Right side: alignment flag + external link */}
                    <div className="flex flex-col items-center gap-2 shrink-0 pt-0.5">
                      <AlignmentFlag alignment={alignment} />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={`/proposals/${vote.proposalTxHash}/${vote.proposalIndex}`}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <FileText className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View full proposal</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          
          {filteredVotes.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">
              No votes match the current filters.
            </p>
          )}

          {/* Show All button */}
          {filteredVotes.length > 10 && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowAllVotes(!showAllVotes)}
                className="w-full"
              >
                {showAllVotes ? (
                  <>Show less <ChevronUp className="h-4 w-4 ml-2" /></>
                ) : (
                  <>Show all {filteredVotes.length} votes <ChevronDown className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vote Detail Sheet */}
      <VoteDetailSheet
        vote={selectedVote}
        open={!!selectedVote}
        onOpenChange={(open) => { if (!open) setSelectedVote(null); }}
        userPrefs={userPrefs}
      />
    </div>
  );
}
