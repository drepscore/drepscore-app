'use client';

import { useRouter } from 'next/navigation';
import { EnrichedDRep } from '@/lib/koios';
import { DRepCard } from '@/components/DRepCard';

interface DRepCardGridProps {
  dreps: EnrichedDRep[];
  matchData?: Record<string, number>;
  watchlist?: string[];
  onWatchlistToggle?: (drepId: string) => void;
  delegatedDrepId?: string | null;
  onCardClick?: (drep: EnrichedDRep) => void;
}

export function DRepCardGrid({
  dreps,
  matchData = {},
  watchlist = [],
  onWatchlistToggle,
  delegatedDrepId,
  onCardClick,
}: DRepCardGridProps) {
  const router = useRouter();

  if (dreps.length === 0) return null;

  const handleClick = (drep: EnrichedDRep) => {
    if (onCardClick) {
      onCardClick(drep);
    } else {
      router.push(`/drep/${encodeURIComponent(drep.drepId)}`);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {dreps.map((drep) => (
        <DRepCard
          key={drep.drepId}
          drep={drep}
          matchScore={matchData[drep.drepId] ?? null}
          isWatchlisted={watchlist.includes(drep.drepId)}
          onWatchlistToggle={onWatchlistToggle}
          isDelegated={delegatedDrepId === drep.drepId}
          onClick={() => handleClick(drep)}
        />
      ))}
    </div>
  );
}
