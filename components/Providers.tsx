'use client';

/**
 * Client-side providers wrapper.
 * Placed at the root layout level so WalletProvider is available
 * to all pages (e.g. DelegationButton on the DRep detail page).
 */

import { WalletProvider } from '@/utils/wallet';

export function Providers({ children }: { children: React.ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
