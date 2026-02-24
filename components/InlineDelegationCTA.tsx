'use client';

import { useWallet } from '@/utils/wallet';
import { useDelegation } from '@/hooks/useDelegation';
import { Button } from '@/components/ui/button';
import { Vote, Wallet, CheckCircle, Loader2, ExternalLink } from 'lucide-react';
import { DelegationRisksModal } from './InfoModal';
import confetti from 'canvas-confetti';

interface InlineDelegationCTAProps {
  drepId: string;
  drepName: string;
}

export function InlineDelegationCTA({ drepId, drepName }: InlineDelegationCTAProps) {
  const { connected, isAuthenticated } = useWallet();
  const { phase, delegate, reset, isProcessing, delegatedDrepId, canDelegate } = useDelegation();

  const isAlreadyDelegated = !!delegatedDrepId && delegatedDrepId === drepId;

  const handleDelegate = async () => {
    if (!canDelegate) {
      window.dispatchEvent(new Event('openWalletConnect'));
      return;
    }
    const result = await delegate(drepId);
    if (result) {
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.8 } });
    }
  };

  if (isAlreadyDelegated && phase.status !== 'success') {
    return (
      <div className="flex flex-col gap-2 p-4 border border-primary/20 rounded-lg bg-primary/5 text-center">
        <CheckCircle className="h-5 w-5 text-primary mx-auto" />
        <p className="text-sm font-medium">You&apos;re delegating to this DRep</p>
        <p className="text-xs text-muted-foreground">
          Your ADA voting power is already with this DRep.
        </p>
      </div>
    );
  }

  if (phase.status === 'success') {
    return (
      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center space-y-1">
        <p className="text-sm font-medium text-green-600 dark:text-green-400">
          Delegation submitted!
        </p>
        <p className="text-xs text-muted-foreground">
          Changes take effect in 1-2 epochs.
        </p>
        <a
          href={`https://cardanoscan.io/transaction/${phase.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View tx <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  if (phase.status === 'error') {
    return (
      <div className="flex flex-col gap-2 p-4 border border-destructive/20 rounded-lg bg-destructive/5 text-center">
        <p className="text-sm text-destructive">{phase.hint}</p>
        <Button variant="outline" size="sm" onClick={reset}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg bg-card">
      <Button
        onClick={handleDelegate}
        disabled={isProcessing}
        className="gap-2 w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {phase.status === 'signing' ? 'Sign in wallet...' : 'Processing...'}
          </>
        ) : canDelegate ? (
          <>
            <Vote className="h-4 w-4" />
            {delegatedDrepId ? 'Switch to this DRep' : 'Delegate to this DRep'}
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
