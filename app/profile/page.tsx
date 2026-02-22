'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { getUserPrefs, saveUserPrefs } from '@/utils/userPrefs';
import { UserPrefKey } from '@/types/drep';
import { SupabaseUser } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const WalletConnectModal = dynamic(
  () => import('@/components/WalletConnectModal').then(mod => mod.WalletConnectModal),
  { ssr: false }
);
import {
  Shield,
  Wallet,
  Heart,
  History,
  X,
  Plus,
  ExternalLink,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

const PREF_LABELS: Record<UserPrefKey, string> = {
  'treasury-conservative': 'Treasury Conservative',
  'smart-treasury-growth': 'Smart Treasury Growth',
  'strong-decentralization': 'Strong Decentralization',
  'protocol-security-first': 'Protocol Security',
  'innovation-defi-growth': 'Innovation & DeFi',
  'responsible-governance': 'Responsible Governance',
};

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, sessionAddress } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<SupabaseUser | null>(null);
  const [userPrefs, setUserPrefs] = useState<UserPrefKey[]>([]);

  useEffect(() => {
    const prefs = getUserPrefs();
    if (prefs) {
      setUserPrefs(prefs.userPrefs);
    }

    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const token = getStoredSession();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        setUserData(data);
        if (data?.prefs?.userPrefs) {
          setUserPrefs(data.prefs.userPrefs);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isAuthenticated]);

  const removeFromWatchlist = async (drepId: string) => {
    if (!userData) return;

    const newWatchlist = userData.watchlist.filter(id => id !== drepId);
    setUserData({ ...userData, watchlist: newWatchlist });

    const token = getStoredSession();
    if (token) {
      await fetch('/api/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ watchlist: newWatchlist }),
      });
    }
  };

  const removePref = (key: UserPrefKey) => {
    const newList = userPrefs.filter(k => k !== key);
    setUserPrefs(newList);
    saveUserPrefs({ hasSeenOnboarding: true, userPrefs: newList });

    if (isAuthenticated) {
      const token = getStoredSession();
      if (token) {
        fetch('/api/user', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ prefs: { userPrefs: newList, hasSeenOnboarding: true } }),
        });
      }
    }
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 12)}...${addr.slice(-8)}`;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              Connect and verify your wallet to access your profile and saved preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => setWalletModalOpen(true)} className="w-full gap-2">
              <Shield className="h-4 w-4" />
              Sign In with Wallet
            </Button>
            <Button variant="outline" onClick={() => router.push('/')} className="w-full">
              Back to Home
            </Button>
          </CardContent>
        </Card>

        <WalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Governance Guardian
            <Badge variant="outline" className="text-green-600 border-green-600">
              Verified
            </Badge>
          </h1>
          {sessionAddress && (
            <p className="text-sm text-muted-foreground font-mono">{shortenAddress(sessionAddress)}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Your Preferences
            </CardTitle>
            <CardDescription>Values that boost your DRep rankings</CardDescription>
          </CardHeader>
          <CardContent>
            {userPrefs.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userPrefs.map(pref => (
                  <Badge key={pref} variant="secondary" className="gap-1 pr-1">
                    {PREF_LABELS[pref] || pref}
                    <button onClick={() => removePref(pref)} className="hover:bg-muted rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No preferences set yet.</p>
            )}
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/">Change Preferences</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500 fill-red-500" />
              Watchlist
            </CardTitle>
            <CardDescription>DReps you're tracking</CardDescription>
          </CardHeader>
          <CardContent>
            {userData?.watchlist && userData.watchlist.length > 0 ? (
              <div className="space-y-2">
                {userData.watchlist.map(drepId => (
                  <div
                    key={drepId}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <Link
                      href={`/drep/${encodeURIComponent(drepId)}`}
                      className="text-sm font-mono hover:text-primary flex items-center gap-1"
                    >
                      {shortenAddress(drepId)}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <button
                      onClick={() => removeFromWatchlist(drepId)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No DReps in your watchlist yet. Add some from the homepage!
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Connected Wallets
            </CardTitle>
            <CardDescription>Manage your linked wallets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessionAddress && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="text-sm font-mono">{shortenAddress(sessionAddress)}</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">Primary</Badge>
                </div>
              )}
              {userData?.connected_wallets
                ?.filter(w => w !== sessionAddress)
                .map(wallet => (
                  <div
                    key={wallet}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <span className="text-sm font-mono">{shortenAddress(wallet)}</span>
                  </div>
                ))}
            </div>
            <Button variant="outline" size="sm" className="mt-4 gap-2" disabled>
              <Plus className="h-4 w-4" />
              Add Wallet (Coming Soon)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Delegation History
            </CardTitle>
            <CardDescription>Your past delegations</CardDescription>
          </CardHeader>
          <CardContent>
            {userData?.delegation_history && userData.delegation_history.length > 0 ? (
              <div className="space-y-2">
                {userData.delegation_history.map((record, i) => (
                  <div key={i} className="p-2 rounded-lg bg-muted/50 text-sm">
                    <p className="font-mono">{shortenAddress(record.drepId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No delegation history yet. Delegate to a DRep to see it here!
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <WalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </div>
  );
}
