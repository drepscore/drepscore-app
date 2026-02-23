'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DRepTableClient } from '@/components/DRepTableClient';
import { OnboardingWizard } from '@/components/OnboardingWizard';

const WalletConnectModal = dynamic(
  () => import('@/components/WalletConnectModal').then(mod => mod.WalletConnectModal),
  { ssr: false }
);
import { getUserPrefs, saveUserPrefs } from '@/utils/userPrefs';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { UserPrefKey } from '@/types/drep';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Settings2, X, AlertTriangle } from 'lucide-react';
import { getPrefLabel } from '@/lib/alignment';

const WATCHLIST_KEY = 'drepscore_watchlist';
const MISMATCH_DISMISSED_KEY = 'drepscore_mismatch_dismissed';

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

function getMismatchDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MISMATCH_DISMISSED_KEY) === 'true';
}

function setMismatchDismissed(dismissed: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MISMATCH_DISMISSED_KEY, dismissed ? 'true' : 'false');
}

export function HomepageShell() {
  const { isAuthenticated, sessionAddress } = useWallet();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [userPrefs, setUserPrefs] = useState<UserPrefKey[]>([]);
  const [savedPrefs, setSavedPrefs] = useState<UserPrefKey[] | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [mismatchBannerDismissed, setMismatchBannerDismissed] = useState(true);
  
  // Mock mismatch for demo - in production, this would come from real vote analysis
  const mockMismatch = userPrefs.includes('treasury-conservative') ? {
    drepName: 'Example DRep',
    vote: 'Yes' as const,
    proposal: 'Treasury Withdrawal Proposal',
    pref: 'treasury-conservative' as UserPrefKey,
  } : null;

  useEffect(() => {
    const prefs = getUserPrefs();
    if (prefs) {
      setUserPrefs(prefs.userPrefs);
    } else {
      setWizardOpen(true);
    }
    
    setWatchlist(getLocalWatchlist());
    setMismatchBannerDismissed(getMismatchDismissed());
    setHasLoaded(true);
  }, []);

  // Listen for "Change Preferences" event from Header
  useEffect(() => {
    const handleOpenPreferences = () => setWizardOpen(true);
    window.addEventListener('openPreferencesWizard', handleOpenPreferences);
    return () => window.removeEventListener('openPreferencesWizard', handleOpenPreferences);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !sessionAddress) return;
    
    const token = getStoredSession();
    if (!token) return;

    fetch('/api/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.watchlist?.length > 0) {
          setWatchlist(data.watchlist);
          saveLocalWatchlist(data.watchlist);
        }
        // Always set savedPrefs from backend (even if empty) to track remote state
        const backendPrefs = data?.prefs?.userPrefs || [];
        setSavedPrefs(backendPrefs);
        if (backendPrefs.length > 0) {
          setUserPrefs(backendPrefs);
          saveUserPrefs({ hasSeenOnboarding: true, userPrefs: backendPrefs });
        }
      })
      .catch(console.error);
  }, [isAuthenticated, sessionAddress]);

  const handleWizardComplete = (prefs: UserPrefKey[]) => {
    const newPrefs = { hasSeenOnboarding: true, userPrefs: prefs };
    saveUserPrefs(newPrefs);
    setUserPrefs(prefs);
    setWizardOpen(false);
  };

  const handleSaveForever = async () => {
    setWizardOpen(false);
    
    if (isAuthenticated) {
      // Already signed in - sync prefs to backend directly
      const token = getStoredSession();
      if (token) {
        try {
          await fetch('/api/user', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ prefs: { userPrefs } }),
          });
          setSavedPrefs(userPrefs);
        } catch (err) {
          console.error('Failed to save preferences:', err);
        }
      }
    } else {
      setWalletModalOpen(true);
    }
  };

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

  const clearPrefs = () => {
    const newPrefs = { hasSeenOnboarding: true, userPrefs: [] };
    saveUserPrefs(newPrefs);
    setUserPrefs([]);
  };

  const resetToSaved = () => {
    if (savedPrefs) {
      const newPrefs = { hasSeenOnboarding: true, userPrefs: savedPrefs };
      saveUserPrefs(newPrefs);
      setUserPrefs(savedPrefs);
    }
  };

  const removePref = (key: UserPrefKey) => {
    const newList = userPrefs.filter(k => k !== key);
    const newPrefs = { hasSeenOnboarding: true, userPrefs: newList };
    saveUserPrefs(newPrefs);
    setUserPrefs(newList);
  };

  // Check if current prefs differ from saved prefs (both directions)
  const hasUnsavedChanges = isAuthenticated && savedPrefs !== null && savedPrefs.length > 0 && (
    userPrefs.length !== savedPrefs.length ||
    !userPrefs.every(p => savedPrefs.includes(p)) ||
    !savedPrefs.every(p => userPrefs.includes(p))
  );

  if (!hasLoaded) {
    return <div className="min-h-screen" />;
  }

  const handleDismissMismatch = () => {
    setMismatchBannerDismissed(true);
    setMismatchDismissed(true);
  };

  return (
    <div className="space-y-6">
      {/* Mismatch Alert Banner */}
      {mockMismatch && !mismatchBannerDismissed && userPrefs.length > 0 && (
        <Alert variant="destructive" className="relative bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Value Mismatch Detected</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Your DRep <span className="font-semibold">{mockMismatch.drepName}</span> voted{' '}
            <span className="font-semibold">{mockMismatch.vote}</span> on{' '}
            <span className="font-semibold">{mockMismatch.proposal}</span>, which may conflict with your{' '}
            <span className="font-semibold">{getPrefLabel(mockMismatch.pref)}</span> preference.
          </AlertDescription>
          <button
            onClick={handleDismissMismatch}
            className="absolute top-3 right-3 p-1 hover:bg-amber-500/20 rounded"
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4 text-amber-600" />
          </button>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {userPrefs.length > 0 ? (
            <>
              <span className="text-sm font-medium text-muted-foreground mr-2">
                Your Values:
              </span>
              {userPrefs.map(pref => (
                <Badge key={pref} variant="secondary" className="gap-1 pr-1">
                  {pref.replace(/-/g, ' ')}
                  <button
                    onClick={() => removePref(pref)}
                    className="hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {hasUnsavedChanges && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetToSaved}
                  className="text-xs h-6 px-2 text-muted-foreground hover:text-primary"
                >
                  Reset to Saved
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearPrefs}
                className="text-xs h-6 px-2 text-muted-foreground hover:text-destructive"
              >
                Clear All
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Personalize your DRep list based on your values.
              </span>
              {hasUnsavedChanges && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetToSaved}
                  className="text-xs h-6 px-2 text-muted-foreground hover:text-primary"
                >
                  Reset to Saved
                </Button>
              )}
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setWizardOpen(true)}
          className="gap-2"
        >
          <Settings2 className="w-4 h-4" />
          {userPrefs.length > 0 ? 'Change Preferences' : 'Personalize My View'}
        </Button>
      </div>

      <OnboardingWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={handleWizardComplete}
        onSaveForever={handleSaveForever}
        initialPrefs={userPrefs}
      />

      <WalletConnectModal
        open={walletModalOpen}
        onOpenChange={setWalletModalOpen}
      />

      <DRepTableClient
        userPrefs={userPrefs}
        watchlist={watchlist}
        onWatchlistToggle={handleWatchlistToggle}
        isConnected={isAuthenticated}
      />
    </div>
  );
}
