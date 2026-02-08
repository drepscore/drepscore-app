'use client';

/**
 * Wallet Connect Component
 * Displays wallet connection button and status
 */

import { useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Wallet, ChevronDown, LogOut, Loader2 } from 'lucide-react';

export function WalletConnect() {
  const { connected, connecting, address, error, availableWallets, connect, disconnect } = useWallet();
  const [showWallets, setShowWallets] = useState(false);

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  if (connected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">{shortenAddress(address)}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-2 text-sm">
            <p className="font-medium">Connected</p>
            <p className="text-xs text-muted-foreground mt-1 break-all">
              {address}
            </p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={disconnect} className="text-red-600 dark:text-red-400">
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (connecting) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Connecting...</span>
      </Button>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu open={showWallets} onOpenChange={setShowWallets}>
            <DropdownMenuTrigger asChild>
              <Button variant="default" className="gap-2">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Connect Wallet</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {availableWallets.length > 0 ? (
                <>
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    Select a wallet
                  </div>
                  {availableWallets.map((walletName) => (
                    <DropdownMenuItem
                      key={walletName}
                      onClick={() => {
                        connect(walletName);
                        setShowWallets(false);
                      }}
                      className="capitalize"
                    >
                      <Wallet className="h-4 w-4 mr-2" />
                      {walletName}
                    </DropdownMenuItem>
                  ))}
                </>
              ) : (
                <div className="px-2 py-3 text-sm text-center text-muted-foreground">
                  <p>No Cardano wallets detected</p>
                  <p className="text-xs mt-2">
                    Install Eternl, Nami, Lace, or another Cardano wallet
                  </p>
                </div>
              )}
              {error && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-2 text-xs text-red-600 dark:text-red-400">
                    {error}
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent>
          <p>Connect wallet to delegate to DReps</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
