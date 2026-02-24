'use client';

import { useWallet } from '@/utils/wallet';
import { useDelegation } from '@/hooks/useDelegation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Vote, AlertCircle, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { DelegationRisksModal } from './InfoModal';
import confetti from 'canvas-confetti';

interface DelegationButtonProps {
  drepId: string;
  drepHandle: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  building: 'Preparing transaction...',
  signing: 'Please sign in your wallet...',
  submitting: 'Submitting to the network...',
};

export function DelegationButton({ drepId, drepHandle }: DelegationButtonProps) {
  const { connected } = useWallet();
  const { phase, delegate, reset, isProcessing, delegatedDrepId, canDelegate } = useDelegation();

  const isAlreadyDelegated = !!delegatedDrepId && delegatedDrepId === drepId;

  const handleDelegate = async () => {
    const result = await delegate(drepId);
    if (result) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Delegate to This DRep
          <DelegationRisksModal />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Not connected */}
        {!connected && (
          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
            <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium">Connect your wallet to delegate</p>
              <p className="text-sm text-muted-foreground">
                Use the &quot;Connect Wallet&quot; button in the header to get started.
                Your ADA remains in your wallet and fully accessible at all times.
              </p>
            </div>
          </div>
        )}

        {/* Already delegated to this DRep */}
        {connected && isAlreadyDelegated && phase.status !== 'success' && (
          <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">You&apos;re delegating to this DRep</p>
              <p className="text-xs text-muted-foreground">
                Your ADA voting power is already with {drepHandle || 'this DRep'}.
              </p>
            </div>
          </div>
        )}

        {/* Success */}
        {phase.status === 'success' && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-2">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Delegation submitted successfully!
            </p>
            <p className="text-xs text-muted-foreground">
              It may take 1-2 epochs (~5-10 days) for your voting power to be fully active with this DRep.
            </p>
            <a
              href={`https://cardanoscan.io/transaction/${phase.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View transaction <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Error */}
        {phase.status === 'error' && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
            <p className="text-sm font-medium text-destructive">{phase.hint}</p>
            {phase.code !== 'user_rejected' && (
              <p className="text-xs text-muted-foreground">{phase.message}</p>
            )}
            <Button variant="outline" size="sm" onClick={reset}>
              Try Again
            </Button>
          </div>
        )}

        {/* Delegate action */}
        {connected && !isAlreadyDelegated && phase.status !== 'success' && phase.status !== 'error' && (
          <>
            <p className="text-sm text-muted-foreground">
              By delegating, you assign your voting power to{' '}
              <span className="font-medium">{drepHandle || 'this DRep'}</span>.
              You can change your delegation at any time with no penalty.
            </p>
            <Button
              onClick={handleDelegate}
              disabled={!canDelegate || isProcessing}
              className="w-full gap-2"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {PHASE_LABELS[phase.status] || 'Processing...'}
                </>
              ) : (
                <>
                  <Vote className="h-4 w-4" />
                  {delegatedDrepId ? 'Switch Delegation' : 'Delegate Now'}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Transaction fee: ~0.2 ADA. Your ADA never leaves your wallet.
            </p>
          </>
        )}

        {/* Re-delegate after switching */}
        {connected && isAlreadyDelegated && phase.status !== 'success' && (
          <p className="text-xs text-muted-foreground text-center">
            Want to switch? Browse other DReps on the homepage.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
