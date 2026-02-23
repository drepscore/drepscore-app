'use client';

/**
 * Inline Delegation CTA Component
 * Compact delegation button for the DRep profile header
 */

import { useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { Button } from '@/components/ui/button';
import { Vote, Wallet, RefreshCw } from 'lucide-react';
import { DelegationRisksModal } from './InfoModal';

interface InlineDelegationCTAProps {
  drepId: string;
  drepName: string;
}

export function InlineDelegationCTA({ drepId, drepName }: InlineDelegationCTAProps) {
  const { connected, wallet, isAuthenticated } = useWallet();
  const [delegating, setDelegating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const handleDelegate = async () => {
    // If authenticated but wallet not connected in this session, prompt reconnect
    if (isAuthenticated && !connected) {
      setNeedsReconnect(true);
      return;
    }

    if (!wallet || !connected) return;

    setDelegating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSuccess(true);
    } catch (err) {
      console.error('Delegation failed:', err);
    } finally {
      setDelegating(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
        <p className="text-sm font-medium text-green-600 dark:text-green-400">
          Delegation submitted!
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Changes take effect in a few epochs.
        </p>
      </div>
    );
  }

  // Show reconnect prompt if user clicked delegate while authenticated but not connected
  if (needsReconnect && isAuthenticated && !connected) {
    return (
      <div className="flex flex-col gap-2 p-4 border rounded-lg bg-card">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium">Wallet session expired</p>
          <p className="text-xs text-muted-foreground">
            Please reconnect your wallet using the button in the header to delegate.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setNeedsReconnect(false)}
          className="gap-2 w-full"
        >
          <RefreshCw className="h-4 w-4" />
          Dismiss
        </Button>
      </div>
    );
  }

  // Determine button state based on authentication (not just connection)
  const canDelegate = isAuthenticated || connected;

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg bg-card">
      <Button
        onClick={canDelegate ? handleDelegate : undefined}
        disabled={!canDelegate || delegating}
        className="gap-2 w-full"
        size="lg"
      >
        {canDelegate ? (
          <>
            <Vote className="h-4 w-4" />
            {delegating ? 'Processing...' : 'Delegate to this DRep'}
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4" />
            Connect wallet to delegate
          </>
        )}
      </Button>
      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <span>Your ADA stays in your wallet.</span>
        <DelegationRisksModal />
      </div>
    </div>
  );
}
