'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { HomepageUnauth } from '@/components/HomepageUnauth';
import { HomepageAuth } from '@/components/HomepageAuth';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { getUserPrefs, saveUserPrefs } from '@/utils/userPrefs';
import type { PulseData } from '@/components/GovernancePulseHero';
import type { UserPrefKey } from '@/types/drep';

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
  const [wizardOpen, setWizardOpen] = useState(false);
  const [previousVisitAt, setPreviousVisitAt] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const prefs = getUserPrefs();
    if (!prefs) {
      setWizardOpen(true);
    }
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

  const handleWizardComplete = (prefs: UserPrefKey[]) => {
    saveUserPrefs({ hasSeenOnboarding: true, userPrefs: prefs });
    setWizardOpen(false);
  };

  if (!hasLoaded || reconnecting) {
    return <div className="min-h-[60vh]" />;
  }

  return (
    <>
      <OnboardingWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={handleWizardComplete}
        onSaveForever={() => setWizardOpen(false)}
        initialPrefs={[]}
      />

      {isAuthenticated ? (
        <HomepageAuth previousVisitAt={previousVisitAt} />
      ) : (
        <HomepageUnauth pulseData={pulseData} topDReps={topDReps} />
      )}
    </>
  );
}
