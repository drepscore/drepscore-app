# Manifest

Slim shipped/not-shipped checklist consolidated from `docs/archive/strategy-context/build-manifest.md`.

Last auth-harness verification: 2026-04-30.
Last code reconciliation of not-shipped statuses: 2026-06-09.

## Shipped

### Foundation Complete

- [x] DRep Score V3 with percentile normalization, momentum, and history.
- [x] SPO scoring, alignment, matching, and score snapshots.
- [x] CC Transparency Index.
- [x] Six-dimensional PCA alignment and AI proposal classification.
- [x] Governance Health Index with component metrics and snapshots.
- [x] PCA-based Quick Match and persona-agnostic matching.
- [x] Treasury intelligence APIs and treasury citizen surfaces.
- [x] Governance calendar, epoch recaps, proposal similarity cache.
- [x] SPO and CC vote fetching and sync.
- [x] Large Inngest sync surface for chain, entity, and snapshot jobs.
- [x] Public API v1 and embed surfaces.

### Phase 0 Complete: Architecture Reset

- [x] Hub at `/` as persona-adaptive control center.
- [x] Workspace at `/workspace` for governance work.
- [x] Governance section at `/governance` with proposals, representatives, pools, committee, treasury, and health.
- [x] Delegation page for citizen representation health.
- [x] You/account section for identity, settings, inbox, and public profile.
- [x] Match flow expanded toward DRep and pool representation.
- [x] Desktop sidebar, mobile bottom nav, section pill nav, and top bar.
- [x] Hub card renderer with action, status, engagement, discovery, representation, and health cards.
- [x] Persona-specific minimum lovable experiences for citizen, DRep, SPO, and anonymous users.

### Phase 1 Mostly Complete: Recompose and Activate

- [x] DRep, SPO, CC, and proposal detail pages recomposed into the new architecture.
- [x] Governance browse pages populated with active proposals, representatives, pools, committee, treasury, and health.
- [x] DRep workspace action queue, vote flow, rationales, delegators, and performance surfaces.
- [x] SPO workspace governance score, pool profile, delegators, and position surfaces.
- [x] Governance coverage calculation, Hub status card, delegation coverage, and gap/conflict alerts.
- [x] Anonymous and citizen polish: route cleanup, browse links, help page, score narratives, landing SSR, branded loader.
- [x] Anonymous conversion nudges and shareable match results.
- [x] Proposal Workspace: review queue, voting, intelligence blocks, journal, annotations, review templates.
- [x] Authoring Pipeline: drafts, lifecycle stages, review rubrics, collaboration, constitutional pre-check, preview, version diff.
- [x] Supporting infrastructure: AI provider abstraction, skills engine, diversity mechanisms, engagement provenance.

## Not Shipped

State tags from the 2026-06-09 code reconciliation: `greenfield` = no meaningful code; `scaffold` = components or events exist but no pipeline or mount; `half-built` = substantial code with wiring or depth missing; `built-unwired` = complete, needs only a mount, route, or flag flip.

### Phase 1 Remaining

- [ ] `/you/inbox` notification pipeline wired to real governance events — **built-unwired**. `components/notifications/InboxFeed.tsx` is complete but imported nowhere; `check-notifications` (Inngest) and `/api/you/notifications` already produce and serve real events; the header bell shows unread counts. Remaining work is a route and a mount.
- [ ] Dual-role sidebar expansion for DRep+SPO users — **half-built**. An admin-gated two-step dual-role picker exists in `GovernadaHeader`; workspace nav is not SPO-differentiated and SPO workspace sub-pages redirect away.

### Phase 2 Partially Built: Living Platform

- [ ] Hub and entity-page engagement prompts — **half-built**. Engagement components are mounted in the proposal page community-signals zone, backed by 19 routes under `/api/engagement/`; Hub and DRep-page prompt coverage is incomplete.
- [ ] Anonymous engagement glass window and conversion loop — **scaffold**. `IntentWalletPrompt` and typed funnel events exist but are unmounted; no progressive-reveal pattern exists.
- [ ] Citizen sentiment surfaced in DRep Workspace — **scaffold**. `DelegatorSentimentSection` exists; `/api/workspace/delegator-intelligence` is an 18-line stub; `/workspace/delegators` redirects away.
- [ ] Governance Impact Score and milestone system — **half-built**. `lib/citizenImpactScore.ts`, `lib/citizenMilestones.ts`, `lib/milestones.ts`, `/api/you/impact-score`, and milestone awarding in `check-notifications` all exist; the scorecard UI is thin.
- [ ] Enhanced civic identity and governance resume — **half-built**. `CivicIdentityProfile` renders at `/you`; passport/footprint libs and OG images are live; depth and share wiring remain.
- [ ] Milestone, profile, and governance-stat share cards — **built-unwired**. 36 OG image routes plus share-card components exist; remaining work is CTA coverage and social-crawler QA.
- [ ] Claim-profile flows for DReps and SPOs — **half-built**. The DRep claim route and API are substantive; SPO claim components exist with no route.
- [ ] Delegator intelligence and representative sharing toolkit — **half-built**. Components exist (`DelegatorIntelligence`, `DelegatorShareCard`, trend charts); the API stub is 18 lines; no live workspace tab.

### Phase 3 Partially Built: Growth Engine

- [ ] Anonymous conversion funnel instrumentation and SEO foundation — **half-built**. Typed funnel/onboarding events in `lib/funnel.ts`, ~440 capture/track call sites, sitemap and robots present; no funnel dashboard configuration or SEO audit.
- [ ] Epoch-boundary digest and email opt-in — **built-unwired**. `emails/EpochDigest.tsx`, the `notify-epoch-recap` Inngest function, prefs, verification, and unsubscribe are complete; gated off by the `governance_wrapped` flag.
- [ ] Alert system and real `/you/inbox` events — **half-built**. `check-notifications.ts` writes real milestone/proposal/DRep events; the only missing surface is the unmounted inbox (see Phase 1).
- [ ] Return-loop "what changed" summaries — **built-unwired**. `/api/you/what-changed` is implemented and `components/hub/WhatChanged.tsx` exists; mounted nowhere.
- [ ] Community intelligence surfaces — **half-built**. All four components plus their compute Inngest functions exist; State of Governance and Governance Temperature are mounted; Citizen Mandate and Sentiment Divergence are not.
- [ ] Mobile launch audit and edge-case polish — **greenfield**. One mobile-specific test; no viewport or Lighthouse tooling.
- [ ] Performance optimization and load testing — **scaffold**. Four k6 scenarios in `tests/load/scenarios/` (manual, no thresholds) and a CI bundle budget; no Lighthouse CI or perf baselines.
- [ ] Legal/privacy baseline — **half-built**. Real `/privacy` and `/terms` pages exist; needs a legal review pass.

### Post-Launch

- [ ] Monetization layer: Stripe, subscriptions, Pro gates, paid DRep/SPO/delegator/project offerings.
- [ ] API v2, SDKs, rate limiting tiers, research exports, embeddable widgets, partner integrations.
- [ ] Advanced intelligence: delegation graph, simulation engine, Catalyst scoring, cross-ecosystem identity, enhanced Wrapped.

## Launch Posture

- Foundation is complete.
- Phase 1 is mostly complete; both remaining items are wiring, not new builds.
- Phase 2 and Phase 3 are the public-launch product, not optional polish. The 2026-06-09 reconciliation found most items half-built or built-unwired; the truly greenfield work is the glass-window conversion loop, the citizen-sentiment pipeline, SPO workspace depth, and mobile/perf audit tooling.
- Public launch waits until Phase 3 closes and the launch bars behind the roadmap's open questions are defined.
