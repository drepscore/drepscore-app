'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, Users, ShieldCheck, Activity, Zap, Vote, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const GovernanceConstellation = dynamic(
  () =>
    import('@/components/GovernanceConstellation').then((m) => ({
      default: m.GovernanceConstellation,
    })),
  { ssr: false },
);

interface PulseData {
  totalAdaGoverned: string;
  activeProposals: number;
  activeDReps: number;
  totalDReps: number;
  votesThisWeek: number;
  claimedDReps: number;
  activeSpOs: number;
  ccMembers: number;
}

interface HomeAnonymousProps {
  pulseData: PulseData;
}

export function HomeAnonymous({ pulseData }: HomeAnonymousProps) {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* ── Constellation hero ─────────────────────────────────────── */}
      <section
        className="relative h-[55vh] sm:h-[calc(55vh+3.5rem)] min-h-[420px] sm:-mt-14 overflow-hidden"
        aria-label="Governance constellation visualization"
      >
        <div className="absolute inset-0">
          <GovernanceConstellation className="w-full h-full" interactive={false} />
        </div>

        {/* Gradient fade at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Live data overlay on constellation */}
        <div className="absolute top-16 sm:top-20 left-4 right-4 flex justify-center pointer-events-none">
          <div className="flex items-center gap-3 sm:gap-6 text-white/60 text-[10px] sm:text-xs tracking-wider uppercase">
            <span className="tabular-nums">
              <strong className="text-white/90">{pulseData.activeDReps}</strong> DReps
            </span>
            <span className="text-white/30">·</span>
            <span className="tabular-nums">
              <strong className="text-white/90">{pulseData.activeSpOs}</strong> SPOs
            </span>
            <span className="text-white/30">·</span>
            <span className="tabular-nums">
              <strong className="text-white/90">{pulseData.ccMembers}</strong> CC Members
            </span>
          </div>
        </div>

        {/* Value prop overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 sm:pt-14">
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-lg leading-tight text-center">
            Cardano has a government.
          </h1>

          {/* Gap where the constellation core sun shows through */}
          <div className="h-10 sm:h-16" />

          <p className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-[#fff0d4] drop-shadow-lg text-center">
            Know who represents you.
          </p>

          {/* Live urgency hook */}
          {pulseData.activeProposals > 0 && (
            <p
              className="text-sm sm:text-base text-white/70 mt-4 text-center tabular-nums"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
            >
              <strong className="text-white/90">{pulseData.activeProposals} proposals</strong> are
              being decided right now.{' '}
              <strong className="text-[#fff0d4]">₳{pulseData.totalAdaGoverned}</strong> is at stake.
            </p>
          )}
        </div>
      </section>

      {/* ── Quick Match CTA (direct link — no expand panel) ──────── */}
      <section className="relative z-10 -mt-10 px-4 flex flex-col items-center gap-5">
        {/* Glowing primary CTA */}
        <div className="relative group">
          <div
            className={cn(
              'absolute -inset-1 rounded-xl bg-primary/40 blur-md',
              'animate-pulse group-hover:bg-primary/60 transition-colors',
            )}
            aria-hidden
          />
          <Button
            asChild
            size="lg"
            className="relative text-base px-8 py-6 rounded-xl font-semibold shadow-lg"
          >
            <Link href="/match">
              <Zap className="mr-2 h-5 w-5" />
              Find My DRep — 60 Seconds
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          No wallet required · 3 questions · Matched to {pulseData.activeDReps}+ DReps
        </p>

        {/* What is a DRep? micro-explainer */}
        <div className="max-w-md mx-auto rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <HelpCircle className="h-4 w-4 text-primary/60 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">What is a DRep?</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                A Delegated Representative (DRep) votes on governance proposals on your behalf —
                protocol changes, treasury spending, and more. You choose who represents your ADA.
              </p>
              <Link
                href="/learn"
                className="text-[11px] text-primary hover:underline mt-1 inline-block"
              >
                Learn more about governance →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live governance stats ──────────────────────────────────── */}
      <section className="mx-auto w-full max-w-4xl px-4 mt-10 mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              icon: Vote,
              label: 'Open Proposals',
              value: pulseData.activeProposals,
              sub: 'awaiting votes',
            },
            {
              icon: Users,
              label: 'Active DReps',
              value: pulseData.activeDReps,
              sub: 'voting right now',
            },
            {
              icon: ShieldCheck,
              label: 'SPOs Governing',
              value: pulseData.activeSpOs,
              sub: 'pools participating',
            },
            {
              icon: Activity,
              label: 'Votes This Week',
              value: pulseData.votesThisWeek.toLocaleString(),
              sub: 'across all bodies',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4 space-y-1"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className="h-3.5 w-3.5 text-primary/50" />
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </p>
              </div>
              <p className="font-display text-2xl font-bold text-foreground tabular-nums">
                {s.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social proof strip ──────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-4xl px-4 pb-16">
        <div className="rounded-xl border border-border/50 bg-muted/30 px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary/60 shrink-0" />
              <strong className="text-foreground">
                {pulseData.totalDReps.toLocaleString()}
              </strong>{' '}
              DReps scored
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary/60 shrink-0" />
              <strong className="text-foreground">{pulseData.claimedDReps}</strong> profiles claimed
            </span>
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary/60 shrink-0" />
              <strong className="text-foreground">
                {pulseData.votesThisWeek.toLocaleString()}
              </strong>{' '}
              votes cast this week
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
