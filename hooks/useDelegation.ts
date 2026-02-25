'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@/utils/wallet';
import { delegateToDRep, DelegationError, type DelegationResult } from '@/lib/delegation';
import { getStoredSession } from '@/lib/supabaseAuth';

export type DelegationPhase =
  | { status: 'idle' }
  | { status: 'building' }
  | { status: 'signing' }
  | { status: 'submitting' }
  | { status: 'success'; txHash: string }
  | { status: 'error'; code: string; message: string; hint: string };

export function useDelegation() {
  const { wallet, connected, isAuthenticated, delegatedDrepId, refreshDelegation } = useWallet();
  const [phase, setPhase] = useState<DelegationPhase>({ status: 'idle' });

  const delegate = useCallback(async (drepId: string): Promise<DelegationResult | null> => {
    if (!wallet || !connected) {
      setPhase({ status: 'error', code: 'no_wallet', message: 'Wallet not connected', hint: 'Connect your wallet first.' });
      return null;
    }

    setPhase({ status: 'building' });

    try {
      setPhase({ status: 'signing' });
      const result = await delegateToDRep(wallet, drepId);

      setPhase({ status: 'submitting' });

      // Record delegation in backend
      if (isAuthenticated) {
        const token = getStoredSession();
        if (token) {
          fetch('/api/user', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              delegation_history: [{
                drepId,
                timestamp: new Date().toISOString(),
                txHash: result.txHash,
              }],
            }),
          }).catch(() => {});
        }
      }

      // Refresh delegation state in wallet context
      if (refreshDelegation) {
        refreshDelegation();
      }

      setPhase({ status: 'success', txHash: result.txHash });

      import('@/lib/posthog').then(({ posthog }) => {
        posthog.capture('delegation_completed', {
          drep_id: drepId,
          previous_drep_id: delegatedDrepId || null,
          tx_hash: result.txHash,
        });
      }).catch(() => {});

      return result;
    } catch (err) {
      if (err instanceof DelegationError) {
        setPhase({ status: 'error', code: err.code, message: err.message, hint: err.hint });
        import('@/lib/posthog').then(({ posthog }) => {
          posthog.capture('delegation_failed', { drep_id: drepId, error_code: err.code });
        }).catch(() => {});
      } else {
        setPhase({ status: 'error', code: 'unknown', message: String(err), hint: 'Something went wrong. Please try again.' });
      }
      return null;
    }
  }, [wallet, connected, isAuthenticated, refreshDelegation]);

  const reset = useCallback(() => setPhase({ status: 'idle' }), []);

  const isProcessing = phase.status === 'building' || phase.status === 'signing' || phase.status === 'submitting';

  return {
    phase,
    delegate,
    reset,
    isProcessing,
    delegatedDrepId,
    canDelegate: connected && !!wallet,
  };
}
