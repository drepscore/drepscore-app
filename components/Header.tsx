'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet } from '@/utils/wallet';
import { WalletConnect } from './WalletConnect';

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
import { Bell, Shield, User, Settings2, LogOut, AlertTriangle } from 'lucide-react';

export function Header() {
  const { isAuthenticated, sessionAddress, logout } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);

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
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="flex items-start gap-3 p-3 cursor-default">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Mock Alert</p>
                      <p className="text-xs text-muted-foreground">
                        Your DRep voted against Treasury Conservative — see how this affects your alignment
                      </p>
                      <p className="text-xs text-muted-foreground/60">Coming soon</p>
                    </div>
                  </DropdownMenuItem>
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
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWalletModalOpen(true)}
                className="gap-2"
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
              <WalletConnect />
            </>
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
