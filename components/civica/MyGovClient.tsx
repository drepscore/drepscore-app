'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useFeatureFlag } from '@/components/FeatureGate';
import { CitizenCommandCenter } from './mygov/CitizenCommandCenter';
import { DRepCommandCenter } from './mygov/DRepCommandCenter';

function ConnectPrompt() {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
      <p className="text-lg font-bold">Connect Your Wallet</p>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
        Connect your Cardano wallet to access your personal governance command center.
      </p>
      <p className="text-xs text-muted-foreground">
        View delegation health, track open proposals, and get personalised action recommendations.
      </p>
    </div>
  );
}

function SPOStub({ poolId }: { poolId: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-3">
      <p className="text-sm font-semibold">SPO Command Center</p>
      <p className="text-xs text-muted-foreground">
        {poolId ? `Pool: ${poolId}` : 'Pool detected'}
      </p>
      <p className="text-xs text-muted-foreground">
        Full SPO command center coming in the next phase.
      </p>
      <Link
        href={poolId ? `/pool/${poolId}` : '/discover'}
        className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline"
      >
        View pool profile <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export function MyGovClient() {
  const civica = useFeatureFlag('civica_frontend');
  const { segment, isLoading, drepId, poolId, delegatedDrep } = useSegment();

  if (civica === null) return null;

  if (!civica) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <p className="text-muted-foreground">This page is not yet available.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">My Gov</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your civic command center.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full rounded-xl" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : segment === 'anonymous' ? (
        <ConnectPrompt />
      ) : segment === 'drep' && drepId ? (
        <DRepCommandCenter drepId={drepId} />
      ) : segment === 'spo' ? (
        <SPOStub poolId={poolId} />
      ) : (
        <CitizenCommandCenter delegatedDrep={delegatedDrep} />
      )}
    </div>
  );
}
