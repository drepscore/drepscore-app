'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet } from '@/utils/wallet';
import { getUserPrefs } from '@/utils/userPrefs';
import { MismatchAlert, getPrefLabel } from '@/lib/alignment';
import { UserPrefKey } from '@/types/drep';

const WalletConnectModal = dynamic(
  () => import('./WalletConnectModal').then(mod => mod.WalletConnectModal),
  { ssr: false }
);
import { ModeToggle } from './mode-toggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Shield, User, Settings2, LogOut, AlertTriangle, Wallet, Info } from 'lucide-react';

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function Header() {
  const { isAuthenticated, sessionAddress, logout } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [userPrefs, setUserPrefs] = useState<UserPrefKey[]>([]);

  useEffect(() => {
    const prefs = getUserPrefs();
    if (prefs?.userPrefs) {
      setUserPrefs(prefs.userPrefs);
    }
  }, []);

  // Generate mock alerts based on user preferences (demo + real structure)
  const alerts: MismatchAlert[] = useMemo(() => {
    const result: MismatchAlert[] = [];
    
    // Demo alert - always show one for testing
    result.push({
      id: 'demo-1',
      drepId: 'demo',
      drepName: '[Demo] Example DRep',
      vote: 'Yes',
      proposalTitle: 'Treasury Withdrawal #42',
      conflictingPref: 'treasury-conservative',
      timestamp: Date.now() - 3600000,
      severity: 'medium',
    });

    // Add real-looking alerts based on user prefs
    if (userPrefs.includes('treasury-conservative')) {
      result.push({
        id: 'mock-treasury-1',
        drepId: 'drep_mock_1',
        drepName: 'Catalyst Voter',
        vote: 'Yes',
        proposalTitle: 'Community Fund Allocation',
        conflictingPref: 'treasury-conservative',
        timestamp: Date.now() - 7200000,
        severity: 'medium',
      });
    }

    if (userPrefs.includes('responsible-governance')) {
      result.push({
        id: 'mock-rationale-1',
        drepId: 'drep_mock_2',
        drepName: 'Active Delegate',
        vote: 'No',
        proposalTitle: 'Protocol Parameter Change',
        conflictingPref: 'responsible-governance',
        timestamp: Date.now() - 14400000,
        severity: 'low',
      });
    }

    return result.slice(0, 5);
  }, [userPrefs]);

  const hasAlerts = alerts.length > 0;

  const shortenAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-2xl font-bold text-primary">$drepscore</span>
        </Link>

        <nav className="flex items-center space-x-2 sm:space-x-4">
          {isAuthenticated && sessionAddress ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                    {hasAlerts && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    {alerts.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {alerts.length}
                      </Badge>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {alerts.length === 0 ? (
                    <DropdownMenuItem className="flex items-center gap-3 p-3 cursor-default text-muted-foreground">
                      <Info className="h-4 w-4" />
                      <span className="text-sm">No alerts yet</span>
                    </DropdownMenuItem>
                  ) : (
                    alerts.map((alert) => (
                      <DropdownMenuItem 
                        key={alert.id} 
                        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted"
                        asChild
                      >
                        <Link href={alert.drepId === 'demo' ? '#' : `/drep/${encodeURIComponent(alert.drepId)}`}>
                          <AlertTriangle 
                            className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                              alert.severity === 'high' ? 'text-red-500' :
                              alert.severity === 'medium' ? 'text-amber-500' :
                              'text-yellow-500'
                            }`} 
                          />
                          <div className="space-y-1 flex-1">
                            <p className="text-sm font-medium">
                              {alert.drepName}
                              {alert.id.startsWith('demo') && (
                                <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">Demo</Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Voted <span className="font-medium">{alert.vote}</span> on{' '}
                              <span className="font-medium">{alert.proposalTitle}</span>
                              {' — conflicts with your '}
                              <span className="font-medium">{getPrefLabel(alert.conflictingPref)}</span>
                              {' preference'}
                            </p>
                            <p className="text-xs text-muted-foreground/60">
                              {formatTimeAgo(alert.timestamp)}
                            </p>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Badge variant="outline" className="gap-1 text-green-600 border-green-600 px-1.5 py-0">
                      <Shield className="h-3 w-3" />
                    </Badge>
                    <span className="hidden sm:inline font-mono text-xs">
                      {shortenAddress(sessionAddress)}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Shield className="h-3 w-3 text-green-600" />
                        Governance Guardian
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {shortenAddress(sessionAddress)}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => window.dispatchEvent(new Event('openPreferencesWizard'))}
                    className="cursor-pointer"
                  >
                    <Settings2 className="h-4 w-4 mr-2" />
                    Change Preferences
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => setWalletModalOpen(true)}
              className="gap-2"
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Connect Wallet</span>
            </Button>
          )}

          <ModeToggle />
        </nav>
      </div>

      <WalletConnectModal
        open={walletModalOpen}
        onOpenChange={setWalletModalOpen}
      />
    </header>
  );
}
