'use client';

/**
 * Voting History Chart Component
 * Displays voting analytics with custom donut and area chart
 */

import { useState } from 'react';
import { VoteRecord } from '@/types/drep';
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
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface VotingHistoryChartProps {
  votes: VoteRecord[];
}

interface DonutSegment {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

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
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/20"
          />
          {/* Segments */}
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
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums">{total}</span>
          <span className="text-xs text-muted-foreground">votes</span>
        </div>
      </div>
      
      {/* Legend */}
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

export function VotingHistoryChart({ votes }: VotingHistoryChartProps) {
  const [expandedVotes, setExpandedVotes] = useState<Set<string>>(new Set());
  const [showAllVotes, setShowAllVotes] = useState(false);

  const toggleVoteExpanded = (voteId: string) => {
    setExpandedVotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(voteId)) {
        newSet.delete(voteId);
      } else {
        newSet.add(voteId);
      }
      return newSet;
    });
  };

  // Calculate vote distribution
  const yesCount = votes.filter(v => v.vote === 'Yes').length;
  const noCount = votes.filter(v => v.vote === 'No').length;
  const abstainCount = votes.filter(v => v.vote === 'Abstain').length;
  const total = votes.length;

  const segments: DonutSegment[] = [
    { name: 'Yes', value: yesCount, color: '#10b981', percentage: total > 0 ? (yesCount / total) * 100 : 0 },
    { name: 'No', value: noCount, color: '#ef4444', percentage: total > 0 ? (noCount / total) * 100 : 0 },
    { name: 'Abstain', value: abstainCount, color: '#f59e0b', percentage: total > 0 ? (abstainCount / total) * 100 : 0 },
  ];

  // Monthly aggregation for area chart
  const monthlyVotes = votes.reduce((acc, vote) => {
    const month = vote.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    if (!acc[month]) {
      acc[month] = { month, dateObj: new Date(vote.date.getFullYear(), vote.date.getMonth(), 1), Yes: 0, No: 0, Abstain: 0, total: 0 };
    }
    acc[month][vote.vote]++;
    acc[month].total++;
    return acc;
  }, {} as Record<string, { month: string; dateObj: Date; Yes: number; No: number; Abstain: number; total: number }>);

  // Sort chronologically so right = most recent
  const monthlyData = Object.values(monthlyVotes).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  const visibleVotes = showAllVotes ? votes : votes.slice(0, 10);

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
      {/* Voting Analytics - Side by side on desktop */}
      <Card>
        <CardHeader>
          <CardTitle>Voting Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Donut Chart */}
            <div className="flex flex-col items-center lg:items-start">
              <p className="text-sm font-medium text-muted-foreground mb-4">Vote Distribution</p>
              <VoteDonut segments={segments} total={total} />
            </div>
            
            {/* Area Chart */}
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
                      <Area 
                        type="monotone" 
                        dataKey="Yes" 
                        stackId="1"
                        stroke="#10b981" 
                        fill="url(#gradientYes)"
                        strokeWidth={2}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="No" 
                        stackId="1"
                        stroke="#ef4444" 
                        fill="url(#gradientNo)"
                        strokeWidth={2}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="Abstain" 
                        stackId="1"
                        stroke="#f59e0b" 
                        fill="url(#gradientAbstain)"
                        strokeWidth={2}
                      />
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Votes</CardTitle>
          <span className="text-sm text-muted-foreground">
            {votes.length} total
          </span>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {visibleVotes.map((vote) => {
              const isExpanded = expandedVotes.has(vote.id);
              const rationaleText = vote.rationaleText;
              const shouldTruncate = rationaleText && rationaleText.length > 150;
              const displayRationale = rationaleText && shouldTruncate && !isExpanded
                ? rationaleText.slice(0, 150) + '...'
                : rationaleText;

              return (
                <div key={vote.id} className="border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      {/* Vote badge + date */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={
                          vote.vote === 'Yes' ? 'default' : 
                          vote.vote === 'No' ? 'destructive' : 
                          'secondary'
                        } className="shrink-0">
                          {vote.vote}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {vote.date.toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                      
                      {/* Proposal title */}
                      <p className="font-medium text-sm">
                        {vote.title || 'Untitled Proposal'}
                      </p>
                      
                      {/* Abstract */}
                      {vote.abstract && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {vote.abstract}
                        </p>
                      )}
                    </div>
                    
                    {/* GovTool proposal link */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={`https://gov.tools/governance_actions/${vote.proposalTxHash}#${vote.proposalIndex}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View proposal on GovTool</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  {/* Inline Rationale Display */}
                  {rationaleText && (
                    <div className="mt-3">
                      <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Rationale
                        </p>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {displayRationale}
                        </p>
                        {shouldTruncate && (
                          <button
                            onClick={() => toggleVoteExpanded(vote.id)}
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-2 font-medium"
                          >
                            {isExpanded ? (
                              <>Show less <ChevronUp className="h-3 w-3" /></>
                            ) : (
                              <>Read more <ChevronDown className="h-3 w-3" /></>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Fallback when rationale is submitted but not yet cached */}
                  {vote.hasRationale && !rationaleText && vote.rationaleUrl && (
                    <div className="mt-3">
                      <div className="bg-muted/20 rounded-lg p-3 border border-border/20">
                        <p className="text-xs text-muted-foreground">
                          Rationale pending — will be available shortly.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Show All button */}
          {votes.length > 10 && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowAllVotes(!showAllVotes)}
                className="w-full"
              >
                {showAllVotes ? (
                  <>Show less <ChevronUp className="h-4 w-4 ml-2" /></>
                ) : (
                  <>Show all {votes.length} votes <ChevronDown className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
