'use client';

import { useEffect } from 'react';
import { getStoredSession } from '@/lib/supabaseAuth';

export function ProfileViewTracker({ drepId }: { drepId: string }) {
  useEffect(() => {
    const sessionToken = getStoredSession();
    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drepId, sessionToken }),
    }).catch(() => {});
  }, [drepId]);

  return null;
}
