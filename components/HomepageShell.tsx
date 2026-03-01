'use client';

import { useState, useEffect, useCallback } from 'react';
import { DRepTableClient } from '@/components/DRepTableClient';
import { GovernanceWidget } from '@/components/GovernanceWidget';
import { GovernanceDNAQuiz } from '@/components/GovernanceDNAQuiz';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { EnrichedDRep } from '@/lib/koios';

const WATCHLIST_KEY = 'drepscore_watchlist';

function getLocalWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalWatchlist(watchlist: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
}

interface HomepageShellProps {
  initialDReps?: EnrichedDRep[];
  initialAllDReps?: EnrichedDRep[];
  initialTotalAvailable?: number;
}

export function HomepageShell({
  initialDReps,
  initialAllDReps,
  initialTotalAvailable,
}: HomepageShellProps = {}) {
  const { isAuthenticated, sessionAddress } = useWallet();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [matchData, setMatchData] = useState<Record<string, number>>({});
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setWatchlist(getLocalWatchlist());
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !sessionAddress) return;

    const token = getStoredSession();
    if (!token) return;

    // Fetch user data (watchlist)
    fetch('/api/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.watchlist?.length > 0) {
          setWatchlist(data.watchlist);
          saveLocalWatchlist(data.watchlist);
        }
      })
      .catch(console.error);

    // Auto-fetch Governance DNA matches for users with existing poll votes
    fetch('/api/governance/matches', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.matches?.length > 0) {
          const map: Record<string, number> = {};
          for (const m of data.matches) {
            map[m.drepId] = m.matchScore;
          }
          setMatchData(map);
        }
      })
      .catch(console.error);
  }, [isAuthenticated, sessionAddress]);

  const handleWatchlistToggle = useCallback(async (drepId: string) => {
    const newWatchlist = watchlist.includes(drepId)
      ? watchlist.filter(id => id !== drepId)
      : [...watchlist, drepId];

    setWatchlist(newWatchlist);
    saveLocalWatchlist(newWatchlist);

    if (isAuthenticated) {
      const token = getStoredSession();
      if (token) {
        fetch('/api/user', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ watchlist: newWatchlist }),
        }).catch(console.error);
      }
    }
  }, [watchlist, isAuthenticated]);

  if (!hasLoaded) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="space-y-6">
      <GovernanceWidget />

      <GovernanceDNAQuiz onQuizComplete={setMatchData} />

      <div id="drep-table" />
      <DRepTableClient
        initialDReps={initialDReps}
        initialAllDReps={initialAllDReps}
        initialTotalAvailable={initialTotalAvailable}
        watchlist={watchlist}
        onWatchlistToggle={handleWatchlistToggle}
        isConnected={isAuthenticated}
        matchData={matchData}
      />
    </div>
  );
}
