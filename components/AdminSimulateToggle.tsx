'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';

export function AdminSimulateToggle() {
  const { isAuthenticated } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  const isSimulating = searchParams.get('simulate') === 'true';

  useEffect(() => {
    const token = getStoredSession();
    if (!isAuthenticated || !token) {
      setIsAdmin(false);
      return;
    }

    fetch('/api/admin/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsAdmin(data?.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [isAuthenticated]);

  if (!isAdmin) return null;

  const toggle = (simulate: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (simulate) {
      params.set('simulate', 'true');
    } else {
      params.delete('simulate');
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center rounded-full border bg-background/90 backdrop-blur-md shadow-lg p-1 gap-0">
        <button
          onClick={() => toggle(false)}
          className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
            !isSimulating
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          ADA Holders
        </button>
        <button
          onClick={() => toggle(true)}
          className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
            isSimulating
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          DReps
        </button>
      </div>
    </div>
  );
}
