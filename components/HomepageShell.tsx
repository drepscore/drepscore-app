'use client';

import { useState, useEffect } from 'react';
import { DRepTableClient } from '@/components/DRepTableClient';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { getUserPrefs, saveUserPrefs } from '@/utils/userPrefs';
import { UserPrefKey } from '@/types/drep';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings2, X } from 'lucide-react';

export function HomepageShell() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [userPrefs, setUserPrefs] = useState<UserPrefKey[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const prefs = getUserPrefs();
    if (prefs) {
      setUserPrefs(prefs.userPrefs);
    } else {
      // Open wizard if no prefs found (first time user)
      setWizardOpen(true);
    }
    setHasLoaded(true);
  }, []);

  const handleWizardComplete = (prefs: UserPrefKey[]) => {
    const newPrefs = {
      hasSeenOnboarding: true,
      userPrefs: prefs
    };
    saveUserPrefs(newPrefs);
    setUserPrefs(prefs);
    setWizardOpen(false);
  };

  const clearPrefs = () => {
    const newPrefs = {
      hasSeenOnboarding: true,
      userPrefs: []
    };
    saveUserPrefs(newPrefs);
    setUserPrefs([]);
  };

  const removePref = (key: UserPrefKey) => {
    const newList = userPrefs.filter(k => k !== key);
    const newPrefs = {
      hasSeenOnboarding: true,
      userPrefs: newList
    };
    saveUserPrefs(newPrefs);
    setUserPrefs(newList);
  };

  // Prevent flash of wizard/content before hydration
  if (!hasLoaded) {
    return <div className="min-h-screen" />; 
  }

  return (
    <div className="space-y-6">
      {/* Preferences Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {userPrefs.length > 0 ? (
            <>
              <span className="text-sm font-medium text-muted-foreground mr-2">
                Your Values:
              </span>
              {userPrefs.map(pref => (
                <Badge key={pref} variant="secondary" className="gap-1 pr-1">
                  {pref.replace(/-/g, ' ')}
                  <button 
                    onClick={() => removePref(pref)}
                    className="hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearPrefs}
                className="text-xs h-6 px-2 text-muted-foreground hover:text-destructive"
              >
                Clear All
              </Button>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              Personalize your DRep list based on your values.
            </span>
          )}
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setWizardOpen(true)}
          className="gap-2"
        >
          <Settings2 className="w-4 h-4" />
          {userPrefs.length > 0 ? 'Change Preferences' : 'Personalize My View'}
        </Button>
      </div>

      <OnboardingWizard 
        open={wizardOpen} 
        onOpenChange={setWizardOpen}
        onComplete={handleWizardComplete}
        initialPrefs={userPrefs}
      />

      <DRepTableClient userPrefs={userPrefs} />
    </div>
  );
}
