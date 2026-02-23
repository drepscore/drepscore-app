'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWallet } from '@/utils/wallet';
import { DRepDashboard } from '@/components/DRepDashboard';
import { VoteRecord } from '@/types/drep';
import { type ScoreSnapshot } from '@/lib/data';

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
  };
  scoreHistory: ScoreSnapshot[];
}

/**
 * Client wrapper that conditionally renders the DRep Dashboard
 * based on wallet connection and ownership/admin status.
 */
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

  if (!showDashboard) return null;

  return (
    <DRepDashboard
      drep={drep}
      scoreHistory={scoreHistory}
      isSimulated={isSimulated}
    />
  );
}
