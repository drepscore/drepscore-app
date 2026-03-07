'use client';

import { forwardRef } from 'react';
import dynamic from 'next/dynamic';
import { useFeatureFlag } from '@/components/FeatureGate';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const GovernanceConstellation = dynamic(
  () =>
    import('@/components/GovernanceConstellation').then((m) => ({
      default: m.GovernanceConstellation,
    })),
  { ssr: false },
);

const GlobeConstellation = dynamic(
  () =>
    import('@/components/GlobeConstellation').then((m) => ({
      default: m.GlobeConstellation,
    })),
  { ssr: false },
);

interface ConstellationSceneProps {
  interactive?: boolean;
  onReady?: () => void;
  onContracted?: () => void;
  onNodeSelect?: (node: ConstellationNode3D) => void;
  className?: string;
}

/**
 * Flag-gated constellation wrapper. Renders the globe variant when
 * `globe_constellation` is enabled, otherwise the flat constellation.
 */
export const ConstellationScene = forwardRef<ConstellationRef, ConstellationSceneProps>(
  function ConstellationScene(props, ref) {
    const globeFlag = useFeatureFlag('globe_constellation');
    const useGlobe = globeFlag === true;

    if (useGlobe) {
      return <GlobeConstellation ref={ref} {...props} />;
    }
    return <GovernanceConstellation ref={ref} {...props} />;
  },
);
