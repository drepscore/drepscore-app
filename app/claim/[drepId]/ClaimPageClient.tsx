'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { posthog } from '@/lib/posthog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Sparkles,
  Inbox,
  TrendingUp,
  ArrowRight,
  Check,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface ClaimPageClientProps {
  drepId: string;
  name: string;
  score: number;
  participation: number;
  rationale: number;
  reliability: number;
  profile: number;
  isClaimed: boolean;
}

function ScoreRing({ score }: { score: number }) {
  const size = 160;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const dashOffset = circumference * (1 - progress);
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Strong' : score >= 60 ? 'Good' : 'Needs Work';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function PillarBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / 100) * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const points = Math.round((value / 100) * max);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">{points}/{max}</span>
    </div>
  );
}

export function ClaimPageClient({
  drepId,
  name,
  score,
  participation,
  rationale,
  reliability,
  profile,
  isClaimed,
}: ClaimPageClientProps) {
  const router = useRouter();
  const { isAuthenticated, ownDRepId, connecting, reconnecting } = useWallet();
  const [claimedCount, setClaimedCount] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

  useEffect(() => {
    posthog.capture('claim_page_viewed', { drep_id: drepId, drep_score: score, is_claimed: isClaimed });
    fetch('/api/stats/claimed')
      .then(r => r.json())
      .then(d => setClaimedCount(d.claimedCount))
      .catch(() => {});
  }, []);

  // Auto-claim when wallet matches
  useEffect(() => {
    if (!isAuthenticated || !ownDRepId || ownDRepId !== drepId || isClaimed || claiming || claimSuccess) return;

    const token = getStoredSession();
    if (!token) return;

    setClaiming(true);
    fetch('/api/drep-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: token, drepId }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.claimed) {
          posthog.capture('claim_completed', { drep_id: drepId, drep_score: score, source: 'claim_page' });
          setClaimSuccess(true);
          setTimeout(() => router.push('/dashboard'), 1500);
        }
      })
      .catch(() => {})
      .finally(() => setClaiming(false));
  }, [isAuthenticated, ownDRepId, drepId, isClaimed, claiming, claimSuccess, router]);

  if (claiming || (isAuthenticated && ownDRepId === drepId && !claimSuccess)) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-lg text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">Claiming your profile...</p>
      </div>
    );
  }

  if (claimSuccess) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-lg text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold">Profile Claimed!</h1>
        <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
      </div>
    );
  }

  if (isClaimed) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-lg text-center space-y-6">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
        <h1 className="text-2xl font-bold">Profile Already Claimed</h1>
        <p className="text-sm text-muted-foreground">
          This DRep profile has already been claimed by its owner.
        </p>
        <Link href={`/drep/${encodeURIComponent(drepId)}`}>
          <Button variant="outline" className="gap-2">
            View Public Profile <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      {/* Hero */}
      <div className="text-center space-y-6 mb-10">
        <Badge variant="secondary" className="text-xs">
          Unclaimed Profile
        </Badge>

        <h1 className="text-3xl font-bold tracking-tight">
          {name}
        </h1>

        <div className="flex justify-center">
          <ScoreRing score={score} />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <PillarBar label="Participation" value={participation} max={30} />
          <PillarBar label="Rationale" value={rationale} max={35} />
          <PillarBar label="Reliability" value={reliability} max={20} />
          <PillarBar label="Profile" value={profile} max={15} />
        </div>
      </div>

      {/* Value Props */}
      <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-semibold text-center">Claim your DRepScore profile</h2>
          <div className="grid gap-3">
            <ValueProp
              icon={<Sparkles className="h-5 w-5 text-primary" />}
              title="Personalized Dashboard"
              desc="Track your score over time, see recommendations, and monitor your governance performance."
            />
            <ValueProp
              icon={<Inbox className="h-5 w-5 text-primary" />}
              title="Governance Inbox"
              desc="Prioritized list of pending proposals with score impact estimates and deadlines."
            />
            <ValueProp
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
              title="Score Tracking & Alerts"
              desc="Get notified when your score changes, delegations shift, or deadlines approach."
            />
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="text-center space-y-4">
        <Button
          size="lg"
          className="gap-2 text-base px-8"
          onClick={() => { posthog.capture('claim_wallet_connect_clicked', { drep_id: drepId }); window.dispatchEvent(new Event('openWalletConnect')); }}
          disabled={connecting || reconnecting}
        >
          {connecting || reconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Shield className="h-5 w-5" />
          )}
          Connect Wallet to Claim
          <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Read-only signature verification — we never request transactions or access to your funds.
        </p>

        {claimedCount !== null && claimedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{claimedCount}</span> DReps have already claimed their profile
          </p>
        )}
      </div>
    </div>
  );
}

function ValueProp({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
