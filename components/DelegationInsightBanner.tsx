'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { getUserPrefs } from '@/utils/userPrefs';
import { resolveRewardAddress } from '@meshsdk/core';
import { computeOverallAlignment, getAlignmentColor } from '@/lib/alignment';
import { EnrichedDRep } from '@/lib/koios';
import { UserPrefKey } from '@/types/drep';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  X,
  ChevronRight,
  AlertTriangle,
  Settings2,
  Compass,
} from 'lucide-react';

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;
const BANNER_DISMISSED_KEY = 'drepscore_insight_banner_dismissed';

function isDismissedThisSession(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
}

export function DelegationInsightBanner() {
  const { connected, isAuthenticated, delegatedDrepId: walletDelegatedDrepId, sessionAddress } = useWallet();
  const isVisible = connected || isAuthenticated;
  const [dismissed, setDismissed] = useState(false);
  const [userPrefs, setUserPrefs] = useState<UserPrefKey[]>([]);
  const [allDReps, setAllDReps] = useState<EnrichedDRep[]>([]);
  const [resolvedDrepId, setResolvedDrepId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prefs = getUserPrefs();
    setUserPrefs(prefs?.userPrefs || []);
    setDismissed(isDismissedThisSession());
  }, []);

  // Use delegatedDrepId from active wallet connection, or fetch it from session address
  useEffect(() => {
    if (walletDelegatedDrepId) {
      setResolvedDrepId(walletDelegatedDrepId);
      return;
    }
    if (!sessionAddress) return;

    let cancelled = false;
    (async () => {
      try {
        // sessionAddress is a payment address; derive the stake address for delegation lookup
        const stakeAddress = resolveRewardAddress(sessionAddress);
        if (!stakeAddress) return;

        const res = await fetch('/api/delegation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stakeAddress }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.drepId) setResolvedDrepId(data.drepId);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [walletDelegatedDrepId, sessionAddress]);

  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dreps');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setAllDReps(data.allDReps || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isVisible]);

  const insight = useMemo(() => {
    if (!resolvedDrepId || userPrefs.length === 0 || allDReps.length === 0) return null;

    const myDrep = allDReps.find(d => d.drepId === resolvedDrepId);
    if (!myDrep) return null;

    const myAlignment = computeOverallAlignment(myDrep, userPrefs);
    const betterCount = allDReps.filter(
      d => d.drepId !== resolvedDrepId && computeOverallAlignment(d, userPrefs) > myAlignment
    ).length;

    const now = Math.floor(Date.now() / 1000);
    const inactive = myDrep.lastVoteTime != null
      ? (now - myDrep.lastVoteTime) > THIRTY_DAYS_SEC
      : false;
    const daysSinceVote = myDrep.lastVoteTime != null
      ? Math.floor((now - myDrep.lastVoteTime) / (24 * 60 * 60))
      : null;

    return {
      drep: myDrep,
      alignment: myAlignment,
      betterCount,
      inactive,
      daysSinceVote,
    };
  }, [resolvedDrepId, userPrefs, allDReps]);

  if (!isVisible) return null;
  if (dismissed) return null;
  if (loading) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true');
  };

  const handleOpenPrefs = () => {
    window.dispatchEvent(new Event('openPreferencesWizard'));
  };

  // State: wallet connected but no prefs
  if (userPrefs.length === 0) {
    return (
      <div className="w-full border-b bg-muted/40">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Compass className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Set your governance preferences to see how your DRep aligns with your values.
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-primary hover:text-primary"
              onClick={handleOpenPrefs}
            >
              <Settings2 className="h-3 w-3" />
              Set Preferences
            </Button>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-muted rounded"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State: has prefs but not delegated (or DRep not found)
  if (!insight) return null;

  const drepName = insight.drep.name || insight.drep.ticker || insight.drep.handle
    || `${insight.drep.drepId.slice(0, 12)}...`;
  const alignmentColorClass = getAlignmentColor(insight.alignment);

  return (
    <div className="w-full border-b bg-muted/40">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          {insight.inactive && (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              <span>
                Your DRep{' '}
                <Link
                  href={`/drep/${encodeURIComponent(insight.drep.drepId)}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {drepName}
                </Link>
                {' '}hasn&apos;t voted in {insight.daysSinceVote} days.
              </span>
              <Link
                href={`/drep/${encodeURIComponent(insight.drep.drepId)}?tab=votes`}
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                Review Activity <ChevronRight className="h-3 w-3" />
              </Link>
            </>
          )}
          {!insight.inactive && (
            <>
              <span>
                Your DRep{' '}
                <Link
                  href={`/drep/${encodeURIComponent(insight.drep.drepId)}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {drepName}
                </Link>
                {' '}is a{' '}
                <Badge variant="outline" className={`text-xs px-1.5 py-0 ${alignmentColorClass}`}>
                  {insight.alignment}% match
                </Badge>
                {' '}with your values.
              </span>
              {insight.betterCount > 0 && (
                <>
                  <span className="hidden sm:inline text-muted-foreground/70">·</span>
                  <span className="text-muted-foreground/80">
                    {insight.betterCount} DRep{insight.betterCount !== 1 ? 's' : ''} score higher.
                  </span>
                  <Link
                    href="/?sort=match"
                    className="text-xs text-primary hover:underline flex items-center gap-0.5"
                  >
                    Explore <ChevronRight className="h-3 w-3" />
                  </Link>
                </>
              )}
              {insight.betterCount === 0 && (
                <Link
                  href={`/drep/${encodeURIComponent(insight.drep.drepId)}?tab=scorecard`}
                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                >
                  View Scorecard <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-muted rounded flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
