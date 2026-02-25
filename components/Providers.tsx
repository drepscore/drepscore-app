'use client';

import { useEffect } from 'react';
import { WalletProvider } from '@/utils/wallet';
import { initPostHog } from '@/lib/posthog';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return <WalletProvider>{children}</WalletProvider>;
}
