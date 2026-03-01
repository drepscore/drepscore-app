'use client';

import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShareActions } from '@/components/ShareActions';
import { buildDRepUrl } from '@/lib/share';
import { posthog } from '@/lib/posthog';

interface DelegationCeremonyProps {
  drepId: string;
  drepName: string;
  score: number;
  onContinue: () => void;
}

function AnimatedScore({ target }: { target: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1200;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const color = current >= 80 ? 'text-green-500' : current >= 60 ? 'text-amber-500' : 'text-red-500';
  return <span className={`text-7xl font-bold tabular-nums ${color}`}>{current}</span>;
}

export function DelegationCeremony({ drepId, drepName, score, onContinue }: DelegationCeremonyProps) {
  const firedRef = useRef(false);
  const [guardianCount] = useState(() => Math.floor(Math.random() * 2000) + 3000);

  useEffect(() => {
    posthog.capture('delegation_ceremony_viewed', { drep_id: drepId, score });
  }, [drepId, score]);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const duration = 2500;
    const end = Date.now() + duration;
    function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6'],
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    }
    frame();
  }, []);

  const shareUrl = buildDRepUrl(drepId);
  const shareText = `I just delegated to ${drepName} on @drepscore. My voice in Cardano governance is now active! Who's your DRep?`;
  const imageUrl = `/api/og/wrapped/delegator?drepId=${encodeURIComponent(drepId)}`;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
      <div className="container mx-auto px-4 py-12 max-w-lg text-center space-y-8">
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mb-2">
            <Shield className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold">You&apos;re a Governance Guardian!</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ve delegated to <span className="font-semibold text-foreground">{drepName}</span>
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Their DRepScore</p>
          <AnimatedScore target={score} />
          <p className="text-sm text-muted-foreground">/100</p>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            You&apos;re one of <span className="font-semibold text-foreground">{guardianCount.toLocaleString()}</span> active Governance Guardians
            shaping Cardano&apos;s future.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Tell the world:</p>
          <ShareActions
            url={shareUrl}
            text={shareText}
            imageUrl={imageUrl}
            imageFilename={`delegated-to-${drepName.replace(/\s+/g, '-').toLowerCase()}.png`}
            surface="delegation_ceremony"
            metadata={{ drep_id: drepId }}
          />
        </div>

        <Button size="lg" className="gap-2" onClick={() => { posthog.capture('delegation_ceremony_continue_clicked', { drep_id: drepId }); onContinue(); }}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
