'use client';

import { useWallet } from '@/utils/wallet';
import { useDelegation } from '@/hooks/useDelegation';
import { getUserPrefs } from '@/utils/userPrefs';
import { Button } from '@/components/ui/button';
import {
  Vote,
  Wallet,
  CheckCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Share2,
  Settings2,
} from 'lucide-react';
import { DelegationRisksModal } from './InfoModal';
import confetti from 'canvas-confetti';

interface InlineDelegationCTAProps {
  drepId: string;
  drepName: string;
}

const PHASE_LABELS: Record<string, string> = {
  preflight: 'Checking eligibility...',
  building: 'Preparing transaction...',
  signing: 'Please sign in your wallet...',
  submitting: 'Submitting to the network...',
};

export function InlineDelegationCTA({ drepId, drepName }: InlineDelegationCTAProps) {
  const { connected } = useWallet();
  const {
    phase,
    startDelegation,
    confirmDelegation,
    reset,
    isProcessing,
    delegatedDrepId,
    canDelegate,
  } = useDelegation();

  const isAlreadyDelegated = !!delegatedDrepId && delegatedDrepId === drepId;

  const handleDelegate = () => {
    if (!canDelegate) {
      window.dispatchEvent(new Event('openWalletConnect'));
      return;
    }
    startDelegation(drepId);
  };

  const handleConfirm = async () => {
    const result = await confirmDelegation(drepId);
    if (result) {
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.8 } });
    }
  };

  const handleShare = () => {
    const text = `I just delegated my Cardano voting power to ${drepName} on @draborak's DRepScore! Check your DRep alignment:`;
    const url = `${window.location.origin}/drep/${encodeURIComponent(drepId)}`;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
    );
  };

  const handleSetPrefs = () => {
    window.dispatchEvent(new Event('openPreferencesWizard'));
  };

  // Already delegated to this DRep
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

  // Success state with post-delegation CTAs
  if (phase.status === 'success') {
    const hasPrefs = !!getUserPrefs()?.userPrefs?.length;
    return (
      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            {phase.confirmed ? 'Delegation confirmed on-chain!' : 'Delegation submitted!'}
          </p>
          <p className="text-xs text-muted-foreground">
            {phase.confirmed
              ? 'Your voting power will be active with this DRep next epoch.'
              : 'Waiting for on-chain confirmation...'}
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1 text-xs"
            onClick={handleShare}
          >
            <Share2 className="h-3 w-3" />
            Share
          </Button>
          {!hasPrefs && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1 text-xs"
              onClick={handleSetPrefs}
            >
              <Settings2 className="h-3 w-3" />
              Set Preferences
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (phase.status === 'error') {
    return (
      <div className="flex flex-col gap-2 p-4 border border-destructive/20 rounded-lg bg-destructive/5 text-center">
        <p className="text-sm text-destructive">{phase.hint}</p>
        {phase.code !== 'user_rejected' && (
          <p className="text-xs text-muted-foreground">{phase.message}</p>
        )}
        <Button variant="outline" size="sm" onClick={reset}>
          Try Again
        </Button>
      </div>
    );
  }

  // Confirmation step -- user reviews before wallet popup
  if (phase.status === 'confirming') {
    const { preflight } = phase;
    return (
      <div className="flex flex-col gap-3 p-4 border border-primary/20 rounded-lg bg-card">
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Delegate to {drepName}
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Your voting power will be assigned to this DRep. You can change anytime.</p>
            <p>
              Transaction fee: <span className="font-medium text-foreground">{preflight.estimatedFee}</span>
            </p>
            {preflight.needsDeposit && (
              <p className="flex items-start gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                Includes a 2 ADA refundable deposit for stake registration.
              </p>
            )}
            <p>Your ADA stays in your wallet at all times.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={reset}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1 gap-1" onClick={handleConfirm}>
            <Vote className="h-3.5 w-3.5" />
            Confirm &amp; Sign
          </Button>
        </div>
      </div>
    );
  }

  // Default: delegate action button
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
            {PHASE_LABELS[phase.status] || 'Processing...'}
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
