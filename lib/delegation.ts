/**
 * DRep vote delegation transaction builder.
 * Uses MeshJS MeshTxBuilder + KoiosProvider to create, sign, and submit
 * a CIP-1694 voteDelegationCertificate transaction.
 */

import { MeshTxBuilder, KoiosProvider, BrowserWallet } from '@meshsdk/core';

export type DelegationErrorCode =
  | 'no_wallet'
  | 'no_reward_address'
  | 'user_rejected'
  | 'insufficient_funds'
  | 'tx_build_failed'
  | 'tx_submit_failed'
  | 'wallet_unsupported'
  | 'unknown';

export class DelegationError extends Error {
  code: DelegationErrorCode;
  hint: string;

  constructor(code: DelegationErrorCode, message: string, hint: string) {
    super(message);
    this.name = 'DelegationError';
    this.code = code;
    this.hint = hint;
  }
}

function classifyError(err: unknown): DelegationError {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('user') && (lower.includes('reject') || lower.includes('cancel') || lower.includes('declined'))) {
    return new DelegationError('user_rejected', msg, 'No worries -- you can delegate anytime.');
  }
  if (lower.includes('insufficient') || lower.includes('not enough') || lower.includes('utxo')) {
    return new DelegationError('insufficient_funds', msg, 'You need at least 2 ADA to cover the transaction fee and deposit.');
  }
  if (lower.includes('not supported') || lower.includes('not implemented') || lower.includes('api.get')) {
    return new DelegationError('wallet_unsupported', msg, 'Your wallet may not support governance transactions. Try Eternl or Lace.');
  }
  return new DelegationError('unknown', msg, 'Something went wrong. Please try again.');
}

const provider = new KoiosProvider('api');

export interface DelegationResult {
  txHash: string;
  drepId: string;
}

/**
 * Build, sign, and submit a vote delegation transaction.
 * Returns the submitted transaction hash.
 */
export async function delegateToDRep(
  wallet: BrowserWallet,
  drepId: string,
): Promise<DelegationResult> {
  try {
    const utxos = await wallet.getUtxos();
    const changeAddress = await wallet.getChangeAddress();
    const rewardAddresses = await wallet.getRewardAddresses();
    const rewardAddress = rewardAddresses?.[0];

    if (!rewardAddress) {
      throw new DelegationError(
        'no_reward_address',
        'Could not resolve your stake address.',
        'Your wallet may not have a registered stake address. Make sure you have staked ADA before.',
      );
    }

    if (!utxos || utxos.length === 0) {
      throw new DelegationError(
        'insufficient_funds',
        'No UTXOs found in wallet.',
        'Your wallet needs ADA to pay for the transaction fee.',
      );
    }

    const txBuilder = new MeshTxBuilder({ fetcher: provider });

    txBuilder
      .voteDelegationCertificate({ dRepId: drepId }, rewardAddress)
      .changeAddress(changeAddress)
      .selectUtxosFrom(utxos);

    const unsignedTx = await txBuilder.complete();
    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

    return { txHash, drepId };
  } catch (err) {
    if (err instanceof DelegationError) throw err;
    throw classifyError(err);
  }
}
