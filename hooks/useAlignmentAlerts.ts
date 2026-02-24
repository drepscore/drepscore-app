'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallet } from '@/utils/wallet';
import { getUserPrefs } from '@/utils/userPrefs';
import { computeOverallAlignment } from '@/lib/alignment';
import { EnrichedDRep } from '@/lib/koios';
import { UserPrefKey } from '@/types/drep';

// ── Types ───────────────────────────────────────────────────────────────────

export type AlertType = 'alignment-shift' | 'inactivity' | 'new-proposals' | 'vote-activity'
  | 'drep-score-change' | 'drep-profile-gap' | 'drep-missed-epoch'
  | 'drep-pending-proposals' | 'drep-urgent-deadline';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  link?: string;
  timestamp: number;
  read: boolean;
  metadata?: Record<string, unknown>;
}

export interface VoteActivityItem {
  voteTxHash: string;
  proposalTxHash: string;
  proposalIndex: number;
  vote: string;
  blockTime: number;
  proposalTitle: string | null;
  proposalType: string | null;
  alignment: 'aligned' | 'unaligned' | 'neutral';
  reasons: string[];
}

// ── LocalStorage keys ───────────────────────────────────────────────────────

const PREV_SCORECARDS_KEY = 'drepscore_prev_scorecards';
const LAST_VISIT_KEY = 'drepscore_last_visit';
const DISMISSED_ALERTS_KEY = 'drepscore_dismissed_alerts';
const WATCHLIST_KEY = 'drepscore_watchlist';

// ── Thresholds ──────────────────────────────────────────────────────────────

const SHIFT_THRESHOLD = 8;
const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

// ── Helpers ─────────────────────────────────────────────────────────────────

function getStoredScorecards(): Record<string, { overall: number; timestamp: number }> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(PREV_SCORECARDS_KEY) || '{}');
  } catch { return {}; }
}

function storeScorecards(data: Record<string, { overall: number; timestamp: number }>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREV_SCORECARDS_KEY, JSON.stringify(data));
}

function getLastVisit(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(LAST_VISIT_KEY) || '0', 10);
}

function setLastVisit(ts: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_VISIT_KEY, String(ts));
}

function getDismissedAlerts(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_ALERTS_KEY) || '[]'));
  } catch { return new Set(); }
}

function persistDismissedAlerts(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...ids]));
}

function getWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
  } catch { return []; }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAlignmentAlerts() {
  const { connected, delegatedDrepId, ownDRepId, isAuthenticated } = useWallet();
  const [allDReps, setAllDReps] = useState<EnrichedDRep[]>([]);
  const [userPrefs, setUserPrefs] = useState<UserPrefKey[]>([]);
  const [voteActivity, setVoteActivity] = useState<VoteActivityItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [newProposalCount, setNewProposalCount] = useState(0);
  const [lastVisitTime, setLastVisitTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [ownDRepScore, setOwnDRepScore] = useState<{ current: number; previous: number | null; profileCompleteness: number } | null>(null);
  const [inboxData, setInboxData] = useState<{ pendingCount: number; criticalCount: number; urgentCount: number; potentialGain: number } | null>(null);

  // Load initial state from localStorage
  useEffect(() => {
    setUserPrefs(getUserPrefs()?.userPrefs || []);
    setDismissedIds(getDismissedAlerts());
    setLastVisitTime(getLastVisit());
  }, []);

  // Fetch DRep data when connected
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/dreps');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setAllDReps(data.allDReps || []);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [connected]);

  // Fetch new proposals since last visit
  useEffect(() => {
    if (!connected || lastVisitTime === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/alignment/new-proposals?since=${lastVisitTime}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setNewProposalCount(data.count || 0);
      } catch { /* ignore */ }
    })();

    return () => { cancelled = true; };
  }, [connected, lastVisitTime]);

  // Fetch recent vote activity for delegated DRep
  useEffect(() => {
    if (!delegatedDrepId || userPrefs.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const prefsStr = userPrefs.join(',');
        const res = await fetch(
          `/api/alignment/recent-votes?drepId=${encodeURIComponent(delegatedDrepId)}&prefs=${prefsStr}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setVoteActivity(data.votes || []);
      } catch { /* ignore */ }
    })();

    return () => { cancelled = true; };
  }, [delegatedDrepId, userPrefs]);

  // Fetch DRep-specific score data for DRep alerts
  useEffect(() => {
    if (!ownDRepId) return;
    let cancelled = false;

    (async () => {
      try {
        const myDrep = allDReps.find(d => d.drepId === ownDRepId);
        if (!myDrep) return;

        const historyRes = await fetch(`/api/score-history?drepId=${encodeURIComponent(ownDRepId)}`);
        let previousScore: number | null = null;
        if (historyRes.ok) {
          const history = await historyRes.json();
          if (Array.isArray(history) && history.length >= 2) {
            previousScore = history[history.length - 2]?.score ?? null;
          }
        }

        if (!cancelled) {
          setOwnDRepScore({
            current: myDrep.drepScore,
            previous: previousScore,
            profileCompleteness: myDrep.profileCompleteness ?? 0,
          });
        }
      } catch { /* ignore */ }
    })();

    return () => { cancelled = true; };
  }, [ownDRepId, allDReps]);

  // Fetch inbox data for DRep-specific alerts
  useEffect(() => {
    if (!ownDRepId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/dashboard/inbox?drepId=${encodeURIComponent(ownDRepId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setInboxData({
            pendingCount: data.pendingCount || 0,
            criticalCount: data.criticalCount || 0,
            urgentCount: data.urgentCount || 0,
            potentialGain: data.scoreImpact?.potentialGain || 0,
          });
        }
      } catch { /* ignore */ }
    })();

    return () => { cancelled = true; };
  }, [ownDRepId]);

  // Build all alerts
  const alerts: Alert[] = useMemo(() => {
    if (!loaded || !connected || userPrefs.length === 0) return [];

    const result: Alert[] = [];
    const now = Math.floor(Date.now() / 1000);
    const watchlist = getWatchlist();
    const drepMap = new Map(allDReps.map(d => [d.drepId, d]));

    // ── 1. Alignment shift alerts (delegated + watchlist) ───────────────
    const prevScorecards = getStoredScorecards();
    const newScorecards: Record<string, { overall: number; timestamp: number }> = {};
    const drepIdsToCheck = [
      ...(delegatedDrepId ? [delegatedDrepId] : []),
      ...watchlist,
    ];
    const uniqueIds = [...new Set(drepIdsToCheck)];

    for (const id of uniqueIds) {
      const drep = drepMap.get(id);
      if (!drep) continue;

      const currentOverall = computeOverallAlignment(drep, userPrefs);
      newScorecards[id] = { overall: currentOverall, timestamp: now };

      const prev = prevScorecards[id];
      if (prev) {
        const delta = currentOverall - prev.overall;
        if (delta <= -SHIFT_THRESHOLD) {
          const drepName = drep.name || drep.ticker || drep.handle || `${id.slice(0, 12)}...`;
          const isDelegated = id === delegatedDrepId;
          result.push({
            id: `shift-${id}`,
            type: 'alignment-shift',
            title: isDelegated
              ? `Your DRep's alignment dropped`
              : `${drepName}'s alignment dropped`,
            description: `Alignment went from ${prev.overall}% to ${currentOverall}% (${delta} pts).`,
            link: `/drep/${encodeURIComponent(id)}?tab=scorecard`,
            timestamp: now,
            read: false,
            metadata: { drepId: id, drepName, previousMatch: prev.overall, currentMatch: currentOverall, delta },
          });
        }
      }
    }

    // Update stored scorecards (merge, don't overwrite unrelated entries)
    storeScorecards({ ...prevScorecards, ...newScorecards });

    // ── 2. DRep inactivity warning ──────────────────────────────────────
    if (delegatedDrepId) {
      const myDrep = drepMap.get(delegatedDrepId);
      if (myDrep?.lastVoteTime != null) {
        const daysSince = Math.floor((now - myDrep.lastVoteTime) / (24 * 60 * 60));
        if (daysSince > 30) {
          result.push({
            id: `inactivity-${delegatedDrepId}`,
            type: 'inactivity',
            title: 'Your DRep has been inactive',
            description: `No votes in the last ${daysSince} days. Consider reviewing their activity.`,
            link: `/drep/${encodeURIComponent(delegatedDrepId)}?tab=votes`,
            timestamp: now,
            read: false,
            metadata: { daysSince },
          });
        }
      }
    }

    // ── 3. New proposals since last visit ────────────────────────────────
    if (newProposalCount > 0) {
      result.push({
        id: `new-proposals-${lastVisitTime}`,
        type: 'new-proposals',
        title: `${newProposalCount} new proposal${newProposalCount !== 1 ? 's' : ''}`,
        description: `${newProposalCount} new governance proposal${newProposalCount !== 1 ? 's' : ''} since your last visit.`,
        link: '/proposals',
        timestamp: now,
        read: false,
      });
    }

    // ── 4. Vote activity summary ────────────────────────────────────────
    const relevantVotes = voteActivity.filter(v => v.alignment !== 'neutral');
    for (const v of relevantVotes.slice(0, 3)) {
      const title = v.proposalTitle || `Proposal ${v.proposalTxHash.slice(0, 8)}...`;
      const verb = v.alignment === 'aligned' ? 'aligned with' : 'conflicts with';

      result.push({
        id: `vote-${v.voteTxHash}`,
        type: 'vote-activity',
        title: `Your DRep voted ${v.vote}`,
        description: `On "${title}" — ${verb} your preferences.${v.reasons.length > 0 ? ' ' + v.reasons[0] : ''}`,
        link: `/proposals/${v.proposalTxHash}/${v.proposalIndex}`,
        timestamp: v.blockTime,
        read: false,
        metadata: { alignment: v.alignment, vote: v.vote },
      });
    }

    // ── 5. DRep-specific alerts (when viewer is a DRep) ─────────────────
    if (ownDRepId && ownDRepScore) {
      // Score change alert
      if (ownDRepScore.previous !== null) {
        const delta = ownDRepScore.current - ownDRepScore.previous;
        if (delta !== 0) {
          result.push({
            id: `drep-score-${ownDRepId}-${now}`,
            type: 'drep-score-change',
            title: delta > 0 ? 'Your DRep Score improved' : 'Your DRep Score dropped',
            description: `Score changed from ${ownDRepScore.previous} to ${ownDRepScore.current} (${delta > 0 ? '+' : ''}${delta} pts) since last snapshot.`,
            link: `/drep/${encodeURIComponent(ownDRepId)}`,
            timestamp: now,
            read: false,
            metadata: { delta, current: ownDRepScore.current, previous: ownDRepScore.previous },
          });
        }
      }

      // Profile gap alert
      if (ownDRepScore.profileCompleteness < 100) {
        result.push({
          id: `drep-profile-${ownDRepId}`,
          type: 'drep-profile-gap',
          title: 'Complete your DRep profile',
          description: `Your Profile Completeness is ${ownDRepScore.profileCompleteness}%. Complete your metadata for an easy score boost.`,
          link: `/drep/${encodeURIComponent(ownDRepId)}`,
          timestamp: now,
          read: false,
          metadata: { profileCompleteness: ownDRepScore.profileCompleteness },
        });
      }
    }

    // ── 6. Inbox alerts (pending proposals, urgent deadlines) ────────
    if (ownDRepId && inboxData) {
      if (inboxData.pendingCount > 0) {
        const hasCritical = inboxData.criticalCount > 0;
        result.push({
          id: `drep-pending-${ownDRepId}-${inboxData.pendingCount}`,
          type: 'drep-pending-proposals',
          title: hasCritical
            ? `${inboxData.criticalCount} critical proposal${inboxData.criticalCount !== 1 ? 's' : ''} need your vote`
            : `${inboxData.pendingCount} proposal${inboxData.pendingCount !== 1 ? 's' : ''} need your vote`,
          description: inboxData.potentialGain > 0
            ? `Voting with rationale could boost your score by +${inboxData.potentialGain} pts.`
            : `Open proposals are awaiting your vote.`,
          link: '/dashboard/inbox',
          timestamp: now,
          read: false,
          metadata: { pendingCount: inboxData.pendingCount, criticalCount: inboxData.criticalCount },
        });
      }

      if (inboxData.urgentCount > 0) {
        result.push({
          id: `drep-urgent-${ownDRepId}-${inboxData.urgentCount}`,
          type: 'drep-urgent-deadline',
          title: `${inboxData.urgentCount} proposal${inboxData.urgentCount !== 1 ? 's' : ''} expiring soon`,
          description: `These proposals will expire within 2 epochs. Vote before they close.`,
          link: '/dashboard/inbox',
          timestamp: now,
          read: false,
          metadata: { urgentCount: inboxData.urgentCount },
        });
      }
    }

    // Update last visit time
    setLastVisit(now);

    return result;
  }, [loaded, connected, userPrefs, allDReps, delegatedDrepId, ownDRepId, ownDRepScore, voteActivity, lastVisitTime, newProposalCount, inboxData]);

  // Filter out dismissed alerts
  const activeAlerts = useMemo(
    () => alerts.filter(a => !dismissedIds.has(a.id)),
    [alerts, dismissedIds],
  );

  const dismissAlert = useCallback((alertId: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(alertId);
      persistDismissedAlerts(next);
      return next;
    });
  }, []);

  const unreadCount = activeAlerts.filter(a => !a.read).length;

  return {
    alerts: activeAlerts,
    unreadCount,
    dismissAlert,
    loaded,
  };
}
