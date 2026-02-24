'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { DRepDashboard } from '@/components/DRepDashboard';
import { VoteRecord } from '@/types/drep';
import { type ScoreSnapshot } from '@/lib/data';
import { generateRecommendations } from '@/utils/recommendations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';

interface DRepDashboardWrapperProps {
  drepId: string;
  drep: {
    drepId: string;
    effectiveParticipation: number;
    rationaleRate: number;
    reliabilityScore: number;
    profileCompleteness: number;
    deliberationModifier: number;
    metadata: Record<string, unknown> | null;
    votes: VoteRecord[];
    drepScore: number;
    brokenLinks?: string[];
  };
  scoreHistory: ScoreSnapshot[];
}

export function DRepDashboardWrapper({ drepId, drep, scoreHistory }: DRepDashboardWrapperProps) {
  const { isAuthenticated, ownDRepId, sessionAddress } = useWallet();
  const searchParams = useSearchParams();
  const [isAdmin, setIsAdmin] = useState(false);

  const isOwner = isAuthenticated && ownDRepId === drepId;
  const simulateRequested = searchParams.get('simulate') === 'true';

  useEffect(() => {
    if (!isAuthenticated || !sessionAddress || !simulateRequested) {
      setIsAdmin(false);
      return;
    }

    fetch('/api/admin/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: sessionAddress }),
    })
      .then(r => r.json())
      .then(data => setIsAdmin(data.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [isAuthenticated, sessionAddress, simulateRequested]);

  const isSimulated = !isOwner && isAdmin && simulateRequested;

  // Admin simulate mode still shows inline dashboard on public profile
  if (isSimulated) {
    return (
      <DRepDashboard
        drep={drep}
        scoreHistory={scoreHistory}
        isSimulated
      />
    );
  }

  // Owner: banner pointing to dedicated dashboard
  if (isOwner) {
    return (
      <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold text-sm">This is your DRep profile</p>
              <p className="text-xs text-muted-foreground">
                View your full dashboard with personalized insights and recommendations.
              </p>
            </div>
          </div>
          <Link href="/dashboard">
            <Button size="sm" className="gap-2">
              Open Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Non-owner teaser
  const recs = generateRecommendations(drep);
  if (recs.length === 0) return null;

  const totalGain = recs.reduce((sum, r) => sum + r.potentialGain, 0);

  return (
    <Card className="border-dashed border-2 border-muted-foreground/20">
      <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm flex items-center gap-2">
              DRep Dashboard
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            </p>
            <p className="text-xs text-muted-foreground">
              {recs.length} improvement recommendation{recs.length > 1 ? 's' : ''} available
              {totalGain > 0 && ` (+${totalGain} pts potential)`}.
              {' '}Connect as this DRep to see your action plan.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
