'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Landmark, TrendingDown, Wallet } from 'lucide-react';
import { posthog } from '@/lib/posthog';

interface Withdrawal {
  txHash: string;
  index: number;
  title: string;
  amountAda: number;
  enactedEpoch: number;
}

interface TreasuryData {
  treasuryBalance: number;
  treasuryBalanceFormatted: string;
  recentWithdrawals: Withdrawal[];
  totalApproved: number;
  burnRatePerMonth: number;
  estimatedRunwayMonths: number;
  lastUpdated: string | null;
}

function formatAda(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

export function TreasuryHealth() {
  const [data, setData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    posthog.capture('treasury_health_viewed');
    fetch('/api/governance/treasury')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.treasuryBalance === 0) return null;

  const approvedPct =
    data.treasuryBalance > 0
      ? Math.min((data.totalApproved / data.treasuryBalance) * 100, 100)
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-green-500" />
          Treasury Health
        </CardTitle>
        {data.lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Updated{' '}
            {new Date(data.lastUpdated).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Balance */}
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums tracking-tight">
            {data.treasuryBalanceFormatted}
          </span>
          <span className="text-lg text-muted-foreground font-medium">ADA</span>
        </div>

        {/* Approved vs Total bar */}
        {data.totalApproved > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                Approved for withdrawal
              </span>
              <span className="tabular-nums">
                {formatAda(data.totalApproved)} ADA ({approvedPct.toFixed(1)}%)
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-700"
                style={{ width: `${approvedPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Recent withdrawals */}
        {data.recentWithdrawals.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Recent enacted withdrawals
            </p>
            <div className="space-y-1.5">
              {data.recentWithdrawals.map((w) => (
                <div
                  key={`${w.txHash}:${w.index}`}
                  className="flex items-center justify-between p-2.5 rounded-lg border text-sm"
                >
                  <span className="truncate flex-1 mr-3">{w.title}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatAda(w.amountAda)} ADA
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Runway */}
        {data.estimatedRunwayMonths > 0 && (
          <p className="text-sm text-muted-foreground border-t pt-3">
            At current rates, the treasury has{' '}
            <span className="font-semibold text-foreground">
              ~{data.estimatedRunwayMonths} months
            </span>{' '}
            of runway
          </p>
        )}
      </CardContent>
    </Card>
  );
}
