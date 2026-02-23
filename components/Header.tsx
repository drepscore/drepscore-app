'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet } from '@/utils/wallet';
import { getUserPrefs } from '@/utils/userPrefs';
import { AlignmentShift } from '@/lib/alignment';
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
import { Bell, Shield, User, Settings2, LogOut, TrendingDown, Wallet, Info, BookOpen, ScrollText } from 'lucide-react';

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

  // Generate demo shift-based alerts
  const shiftAlerts: (AlignmentShift & { isDemo?: boolean })[] = useMemo(() => {
    const result: (AlignmentShift & { isDemo?: boolean })[] = [];
    
    // Demo alert - always show one for new users
    result.push({
      drepId: 'demo',
      drepName: '[Demo] Example DRep',
      previousMatch: 78,
      currentMatch: 65,
      delta: -13,
      categoryShifts: [
        { pref: 'treasury-conservative', previous: 80, current: 55, causedBy: ['2 recent treasury votes'] }
      ],
      isDemo: true,
    });

    // Add a real-looking alert if user has preferences
    if (userPrefs.length > 0) {
      result.push({
        drepId: 'drep_example_shift',
        drepName: 'CardanoBuilder',
        previousMatch: 72,
        currentMatch: 61,
        delta: -11,
        categoryShifts: [
          { pref: userPrefs[0], previous: 75, current: 58, causedBy: ['Recent voting activity'] }
        ],
      });
    }

    return result.slice(0, 5);
  }, [userPrefs]);

  const hasAlerts = shiftAlerts.length > 0;

  const shortenAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-2xl font-bold text-primary">$drepscore</span>
        </Link>

        <nav className="flex items-center space-x-2 sm:space-x-4">
          <Link href="/proposals" className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ScrollText className="h-4 w-4" />
            <span>Proposals</span>
          </Link>
          <Link href="/methodology" className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <BookOpen className="h-4 w-4" />
            <span>Methodology</span>
          </Link>
          
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
                    <span>Alignment Alerts</span>
                    {shiftAlerts.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {shiftAlerts.length}
                      </Badge>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {shiftAlerts.length === 0 ? (
                    <DropdownMenuItem className="flex items-center gap-3 p-3 cursor-default text-muted-foreground">
                      <Info className="h-4 w-4" />
                      <span className="text-sm">No alignment changes detected</span>
                    </DropdownMenuItem>
                  ) : (
                    shiftAlerts.map((shift, index) => (
                      <DropdownMenuItem 
                        key={`${shift.drepId}-${index}`} 
                        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted"
                        asChild
                      >
                        <Link href={shift.drepId === 'demo' ? '#' : `/drep/${encodeURIComponent(shift.drepId)}?tab=scorecard`}>
                          <TrendingDown className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                          <div className="space-y-1 flex-1">
                            <p className="text-sm font-medium">
                              {shift.drepName}
                              {shift.isDemo && (
                                <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">Demo</Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Alignment dropped from{' '}
                              <span className="font-medium">{shift.previousMatch}%</span> to{' '}
                              <span className="font-medium">{shift.currentMatch}%</span>{' '}
                              <span className="text-red-500">({shift.delta} pts)</span>
                            </p>
                            {shift.categoryShifts.length > 0 && (
                              <p className="text-xs text-muted-foreground/80">
                                {shift.categoryShifts[0].causedBy[0] || 'Recent voting activity'}
                              </p>
                            )}
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
