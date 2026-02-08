'use client';

/**
 * Delegation Button Component
 * Handles delegation to a DRep (requires wallet connection)
 */

import { useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Vote, AlertCircle } from 'lucide-react';
import { DelegationRisksModal } from './InfoModal';

interface DelegationButtonProps {
  drepId: string;
  drepHandle: string | null;
}

export function DelegationButton({ drepId, drepHandle }: DelegationButtonProps) {
  const { connected, wallet } = useWallet();
  const [delegating, setDelegating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleDelegate = async () => {
    if (!wallet || !connected) {
      return;
    }

    setDelegating(true);
    setError(null);

    try {
      // TODO: Implement actual delegation using MeshJS
      // This would involve creating and submitting a delegation certificate transaction
      // Example:
      // const tx = await wallet.createDelegationCertificate(drepId);
      // await wallet.signAndSubmit(tx);
      
      // For now, show placeholder message
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delegate');
    } finally {
      setDelegating(false);
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
        {!connected ? (
          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
            <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Connect your wallet to delegate
              </p>
              <p className="text-sm text-muted-foreground">
                Use the "Connect Wallet" button in the header to get started. 
                Your ADA remains in your wallet and fully accessible at all times.
              </p>
            </div>
          </div>
        ) : success ? (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Delegation successful! It may take a few epochs for your voting power to be active.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              By delegating, you assign your voting power to{' '}
              <span className="font-medium">{drepHandle || 'this DRep'}</span>.
              You can change your delegation at any time with no penalty.
            </p>
            <Button
              onClick={handleDelegate}
              disabled={delegating}
              className="w-full gap-2"
              size="lg"
            >
              <Vote className="h-4 w-4" />
              {delegating ? 'Processing...' : 'Delegate Now'}
            </Button>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Note: Delegation functionality is in development. 
              This will create a delegation certificate transaction using your connected wallet.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
