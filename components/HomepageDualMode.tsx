'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { HomepageUnauth } from '@/components/HomepageUnauth';
import { HomepageAuth } from '@/components/HomepageAuth';
import type { PulseData } from '@/components/GovernancePulseHero';

interface PreviewDRep {
  drepId: string;
  name: string | null;
  ticker: string | null;
  handle: string | null;
  drepScore: number;
  sizeTier: string;
  effectiveParticipation: number;
}

interface HomepageDualModeProps {
  pulseData: PulseData;
  topDReps: PreviewDRep[];
}

export function HomepageDualMode({ pulseData, topDReps }: HomepageDualModeProps) {
  const { isAuthenticated, reconnecting } = useWallet();
  const [previousVisitAt, setPreviousVisitAt] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getStoredSession();
    if (!token) return;

    fetch('/api/user', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.previousVisitAt) {
          setPreviousVisitAt(data.previousVisitAt);
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  if (!hasLoaded || reconnecting) {
    return <div className="min-h-[60vh]" />;
  }

  return (
    <>
      {isAuthenticated ? (
        <HomepageAuth previousVisitAt={previousVisitAt} />
      ) : (
        <HomepageUnauth pulseData={pulseData} topDReps={topDReps} />
      )}
    </>
  );
}
