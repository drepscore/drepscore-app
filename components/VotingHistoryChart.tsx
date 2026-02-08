'use client';

/**
 * Voting History Chart Component
 * Displays voting timeline using Recharts
 */

import { useState } from 'react';
import { VoteRecord } from '@/types/drep';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';

interface VotingHistoryChartProps {
  votes: VoteRecord[];
}

export function VotingHistoryChart({ votes }: VotingHistoryChartProps) {
  const [filter, setFilter] = useState<'all' | 'Governance' | 'Catalyst'>('all');

  const filteredVotes = filter === 'all' 
    ? votes 
    : votes.filter(v => v.voteType === filter);

  // Calculate vote distribution
  const voteDistribution = [
    { name: 'Yes', value: filteredVotes.filter(v => v.vote === 'Yes').length, color: '#4CAF50' },
    { name: 'No', value: filteredVotes.filter(v => v.vote === 'No').length, color: '#F44336' },
    { name: 'Abstain', value: filteredVotes.filter(v => v.vote === 'Abstain').length, color: '#FF9800' },
  ];

  // Monthly aggregation for bar chart
  const monthlyVotes = filteredVotes.reduce((acc, vote) => {
    const month = vote.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    if (!acc[month]) {
      acc[month] = { month, Yes: 0, No: 0, Abstain: 0 };
    }
    acc[month][vote.vote]++;
    return acc;
  }, {} as Record<string, { month: string; Yes: number; No: number; Abstain: number }>);

  const monthlyData = Object.values(monthlyVotes);

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
      {/* Filter buttons */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All Votes ({votes.length})
        </Button>
        <Button
          variant={filter === 'Governance' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('Governance')}
        >
          Governance ({votes.filter(v => v.voteType === 'Governance').length})
        </Button>
        <Button
          variant={filter === 'Catalyst' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('Catalyst')}
        >
          Catalyst ({votes.filter(v => v.voteType === 'Catalyst').length})
        </Button>
      </div>

      {/* Distribution Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Vote Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={voteDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {voteDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Bar Chart */}
      {monthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Voting Activity Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Yes" stackId="a" fill="#4CAF50" />
                <Bar dataKey="No" stackId="a" fill="#F44336" />
                <Bar dataKey="Abstain" stackId="a" fill="#FF9800" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Votes List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Votes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredVotes.slice(0, 10).map((vote) => (
              <div key={vote.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      vote.vote === 'Yes' ? 'default' : 
                      vote.vote === 'No' ? 'destructive' : 
                      'secondary'
                    }>
                      {vote.vote}
                    </Badge>
                    <Badge variant="outline">{vote.voteType}</Badge>
                    {vote.hasRationale && (
                      <Badge variant="outline" className="text-green-600 dark:text-green-400">
                        Rationale
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium text-sm">
                    {vote.title || 'Untitled Proposal'}
                  </p>
                  {vote.abstract && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {vote.abstract}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {vote.date.toLocaleDateString()}
                  </p>
                </div>
                {vote.rationaleUrl && (
                  <a
                    href={vote.rationaleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-xs"
                  >
                    View Rationale
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
