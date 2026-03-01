'use client';

import { useEffect } from 'react';
import { posthog } from '@/lib/posthog';

interface PageViewTrackerProps {
  event: string;
  properties?: Record<string, string | number | boolean | null>;
}

export function PageViewTracker({ event, properties }: PageViewTrackerProps) {
  useEffect(() => {
    posthog.capture(event, properties);
  }, [event]);

  return null;
}
