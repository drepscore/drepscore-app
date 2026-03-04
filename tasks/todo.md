# Civica — Active Work

## Current Phase: Phase A (Backend Completion + Civic Foundation)

See `docs/strategy/ultimate-vision.md` for full build sequence.

## Completed

- [x] Civica Shell Foundation (Phase 1A) — PR #77 merged
  - Feature flag `civica_frontend` in feature_flags table
  - SegmentProvider + useSegment() hook
  - TierThemeProvider + useTierTheme() hook
  - CivicaHeader (desktop) + CivicaBottomNav (mobile) 4-tab nav
  - Tier color palette + motion tokens in globals.css
  - Root layout branching (old shell when flag off, CivicaShell when on)
  - /my-gov stub page (auth-gated)

- [x] Civica Phase 1B — GovTerm, Metadata, Home Pages — PR #78
  - GovTerm component (localStorage progressive dismissal, segment-aware tooltips)
  - 12 governance terms in lib/microcopy.ts GOV_TERMS
  - generateMetadata() on /, /discover, /pulse, /my-gov (Civica-branded)
  - Home/anonymous: constellation hero + value prop + Quick Match CTA + SSR stats
  - Home/citizen: DRep report card, pillar bars, epoch callout
  - Home/DRep: score hero, sparkline, quick win card, competitive context
  - Home/SPO: governance score hero, claim prompt, competitive neighbors
  - CivicaHomePage segment dispatcher
  - useDRepReportCard, useDashboardCompetitive, useSPOPoolCompetitive hooks

## Next Up (Phase 2A)

- [ ] Civica Phase 2A — Discover unified browse, DRep/SPO card component, Leaderboard
- [ ] Score Tier System (A1) — tier assignment, change detection, progress-to-next, history
- [ ] Intelligent Notification Triggers (A2) — post-sync Inngest functions for meaningful state changes
- [ ] Alignment Drift Detection (A3) — citizen-DRep alignment monitoring + re-delegation intelligence
- [ ] Score Impact Prediction (A4) — lightweight simulation per action
- [ ] SPO Experience Completion (A5) — wallet-to-pool detection, 4th pillar, claim flow, narrative parity
- [ ] Citizen Intelligence (A6) — engagement levels, personalized epoch summaries, report cards
- [ ] Scoring Cleanup (A8) — deprecate GHI Platform Engagement, audit legacy code, validate personality stability
