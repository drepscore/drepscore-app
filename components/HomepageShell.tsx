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
import { Settings2, X } from 'lucide-react';

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

export function HomepageShell() {
  const { isAuthenticated, sessionAddress } = useWallet();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [userPrefs, setUserPrefs] = useState<UserPrefKey[]>([]);
  const [savedPrefs, setSavedPrefs] = useState<UserPrefKey[] | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const prefs = getUserPrefs();
    if (prefs) {
      setUserPrefs(prefs.userPrefs);
    } else {
      setWizardOpen(true);
    }
    
    setWatchlist(getLocalWatchlist());
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
        if (data?.prefs?.userPrefs?.length > 0) {
          setUserPrefs(data.prefs.userPrefs);
          setSavedPrefs(data.prefs.userPrefs);
          saveUserPrefs({ hasSeenOnboarding: true, userPrefs: data.prefs.userPrefs });
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

  // Check if current prefs differ from saved prefs
  const hasUnsavedChanges = savedPrefs !== null && 
    (userPrefs.length !== savedPrefs.length || 
     !userPrefs.every(p => savedPrefs.includes(p)));

  if (!hasLoaded) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="space-y-6">
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
            <span className="text-sm text-muted-foreground">
              Personalize your DRep list based on your values.
            </span>
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
      />
    </div>
  );
}
