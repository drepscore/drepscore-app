'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWallet } from '@/utils/wallet';
import { DRepDashboard } from '@/components/DRepDashboard';
import { VoteRecord } from '@/types/drep';
import { type ScoreSnapshot } from '@/lib/data';
import { generateRecommendations } from '@/utils/recommendations';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, Sparkles } from 'lucide-react';

interface DRepDashboardWrapperProps {
  drepId: string;
  drep: {
    drepId: string;
    effectiveParticipation: number;
    rationaleRate: number;
    consistencyScore: number;
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
  const showDashboard = isOwner || isSimulated;

  if (showDashboard) {
    return (
      <DRepDashboard
        drep={drep}
        scoreHistory={scoreHistory}
        isSimulated={isSimulated}
      />
    );
  }

  // Teaser card for non-owners
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
