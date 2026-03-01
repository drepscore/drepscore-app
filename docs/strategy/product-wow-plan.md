# Product "Wow" Plan — DRepScore

> The definitive product vision and execution plan for transforming DRepScore from a useful governance tool into the product that makes the entire crypto space say "wow."

**Created:** March 1, 2026
**Context:** Full product/UX critique and strategic planning session. See agent transcript for the raw conversation.

---

## Table of Contents

1. [Core Thesis](#core-thesis)
2. [What We Built vs What We Need](#what-we-built-vs-what-we-need)
3. [Session 1 — IA Restructure & Narrative Homepage](#session-1--ia-restructure--narrative-homepage)
4. [Session 2 — DRep Discovery Reimagined](#session-2--drep-discovery-reimagined)
5. [Session 3 — DRep Command Center](#session-3--drep-command-center)
6. [Session 4 — Shareable Moments & Viral Mechanics](#session-4--shareable-moments--viral-mechanics)
7. [Session 5 — Governance Citizen Experience](#session-5--governance-citizen-experience)
8. [Session 6 — Visual Identity & Polish](#session-6--visual-identity--polish)
9. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
10. [Competitive Positioning](#competitive-positioning)

---

## Core Thesis

### The Problem With What We Built

DRepScore is an **information product** that needs to become an **experience product**.

The data layer is excellent: 4-pillar scoring model (V3), 51 API routes, Koios → Supabase → Next.js data pipeline, background sync via Inngest, multi-channel notifications, PostHog analytics, Observable dashboards. The engineering is genuinely impressive.

But the presentation layer treats every user as an **analyst who wants to evaluate data**. The homepage is a data table. The DRep detail page is a dashboard. The governance page is a report. The proposals page is a list. Everything is rational and informational.

The "wow" comes when you treat users as **citizens who want to feel empowered, informed, and part of something meaningful**.

### The Reframe

| Current Framing | "Wow" Framing |
|---|---|
| "Which DRep should I pick?" | "What's happening with my money, is my voice being heard, and does my participation matter?" |
| DRep directory | Personal governance dashboard for every ADA holder |
| DRep shopping (one-time action) | Governance citizenship (ongoing identity) |
| Information display | Emotional experience with storytelling |
| Functional tool | Platform nobody in crypto has built for any chain |

### Two-Sided Marketplace Dynamics

DRepScore is a two-sided marketplace. Both sides need to feel the product is indispensable:

**ADA Holders (demand side):** Currently treated as DRep shoppers. Need to be treated as governance citizens with financial stakes, ongoing representation monitoring, and community identity.

**DReps (supply side):** Currently given a read-only report card. Need a command center with delegation management, competitive context, gamified improvement, positioning tools, and the feeling that DRepScore is where their reputation lives.

**The flywheel:** DReps engage → data gets richer → delegators find more value → more delegators use the platform → DReps need to be on the platform → DReps invest in their score → data gets even richer.

### Design Principles for "Wow"

1. **Story first, data second.** Every screen should tell a story before showing a spreadsheet.
2. **Financial stakes are real.** Connect governance to ADA holdings. Make it personal.
3. **Emotional moments matter.** Celebration, warning, pride, discovery — design for feelings, not just information.
4. **Mobile is primary.** The majority of crypto users are mobile-first. Design for phones, adapt for desktop.
5. **Viral by design.** Every feature should have a shareable output. If it can't be screenshotted and posted, add a way.
6. **Progressive complexity.** Simple by default, powerful on demand. Never overwhelm a new user.
7. **Return users are different from new users.** The homepage should adapt. "Since you were last here" is more valuable than "Welcome to DRepScore."

---

## What We Built vs What We Need

### Information Architecture — Current

```
/ (Homepage)
├── Hero "Your ADA. Your Voice." + 3 step cards
├── GovernanceWidget (small, for connected users)
└── DRepTableClient (the main table)

/drep/[drepId] — DRep detail (score card, history, votes)
/compare — Side-by-side comparison (radar, trends, overlap)
/proposals — Proposal list
/proposals/[txHash]/[index] — Proposal detail + voters
/governance — My Governance (auth-gated, delegation health, representation score)
/dashboard — DRep Dashboard (auth-gated, for DRep owners)
/dashboard/inbox — Governance inbox for DReps
/profile — User profile, prefs, watchlist
/claim/[drepId] — Claim DRep profile
/methodology — Scoring methodology (standalone dead-end page)
/admin/integrity — Admin dashboard
```

**Header Nav:** Proposals | Methodology | My Governance (auth) | DRep Dashboard (DRep/admin) | Inbox (badge)

### Information Architecture — Target

```
/ (Homepage — DUAL MODE)
├── Unauthenticated: Story-first governance pulse + financial stakes + discovery preview
└── Authenticated: Personal governance hub + "since last visit" + delegation health + discovery

/discover — Full DRep discovery (table + card views, all power-user filters)
/drep/[drepId] — DRep detail (enhanced with score storytelling)
/compare — Side-by-side comparison (keep, enhance)
/proposals — Governance feed (living newsfeed, not archive)
/proposals/[txHash]/[index] — Proposal detail (impact framing, prominent polls)
/governance — My Representation (merged governance + profile)
/dashboard — DRep Command Center (enhanced)
/dashboard/inbox — Governance inbox (enhanced)
/claim/[drepId] — Claim flow (overhaul with FOMO + ceremony)
/pulse — Governance ecosystem health (public)
```

**Header Nav:** Discover | Proposals | My Governance (auth) | DRep Dashboard (DRep)

**Kill:** `/methodology` as standalone page → replace with progressive disclosure inside score cards.
**Kill:** `/dev/delegation-test` → dev-only, remove before launch.
**Merge:** Governance + Profile → unified "My Governance" hub.
**New:** `/pulse` → Governance ecosystem health (public-facing).

### Components to Rethink

| Component | Current State | Target State |
|---|---|---|
| `HeroSection` | Static marketing copy, same for everyone | Dual-mode: unauth sees governance pulse with financial stakes; auth sees personal governance summary |
| `DRepTableClient` | Table with 8+ visible controls, overwhelming | Default: search + sort; everything else behind progressive "Filters" expand; card view toggle for mobile |
| `HomepageShell` | Orchestrates table + onboarding | Orchestrates dual-mode homepage experience (no onboarding wizard; quiz moves to /discover) |
| `GovernanceWidget` | Small widget on homepage for connected users | Promoted to hero component for authenticated homepage |
| `GovernanceDashboard` | Full page at `/governance` | Core content integrated into authenticated homepage |
| `DelegationInsightBanner` | Dismissible banner below header | Integrated into homepage layout, not a banner |
| `OnboardingWizard` | 3-step dialog: welcome → 6 value cards → done | **Kill.** Replace with non-blocking Governance DNA Quiz on /discover (Session 2). Users vote on real proposals, not abstract categories. |
| `ScoreCard` | Dense dashboard with ring, bars, hints | Add score storytelling: what does this score MEAN for the delegator |
| `EmptyState` | Generic icon + title + message | Contextual storytelling: guide, educate, motivate |
| `DRepDashboard` | Read-only recommendations + missing rationale table | Actionable command center with inline rationale assistant, delegator analytics |
| `GovernanceInboxWidget` | Top proposals with score impact | Enhanced with rationale assistant integration |
| `ClaimPageClient` | Score + 3 value props + CTA | FOMO-driven: show platform activity, delegator search volume, competitive positioning |
| `ValueSelector` / `OnboardingWizard` | 6 static value cards | **Kill entirely.** Governance DNA Quiz replaces both. |

---

## Session 1 — IA Restructure & Narrative Homepage

### Goal
Transform the homepage from a table-first data display into a story-first governance experience that adapts to user state. Restructure navigation to follow user intent, not product architecture.

### Problems This Solves
- First-time visitors see a data table and don't understand why they should care
- No urgency, no financial stakes, no emotional hook
- Returning connected users scroll past marketing copy they've already internalized
- Best feature (governance dashboard) is buried behind auth on a sub-nav link
- Homepage hero is dead weight for returning users
- Nav organized by feature, not user journey
- `/methodology` is a dead-end academic document

### Specific Changes

**1. Kill `/methodology` as standalone page**
- Remove from navigation
- Move scoring explanation into progressive disclosure inside `ScoreCard` and DRep detail pages
- Add expandable "How is this calculated?" sections to each pillar
- This reclaims a nav slot and keeps users in-flow

**2. Restructure header navigation**
- Old: Proposals | Methodology | My Governance (auth) | DRep Dashboard (DRep/admin) | Inbox (badge)
- New: Discover | Proposals | My Governance (auth) | Dashboard (DRep)
- "Discover" links to `/discover` (the DRep table/card experience)
- "My Governance" merges current governance + profile into one authenticated hub
- Inbox badge moves into the My Governance section or stays as a notification bell

**3. Build dual-mode homepage**

**Unauthenticated mode — Story-first:**
- Hero: Live governance stats — total ADA under governance, active proposals count, votes cast this week, DRep participation rate. Animated/updating numbers (or at least fetched server-side for freshness). "X billion ADA is being governed right now. Do you know who's voting with yours?"
- Governance Pulse preview: "This week: [proposal title] is being decided. [X]% of DReps have voted. Community sentiment: [Y]% in favor." This creates urgency and context.
- "How it works" section: Keep the 3-step concept but make it more visual and less text-heavy
- Preview of the governance dashboard: Blurred/demo version showing what a connected user sees — delegation health, representation score, active proposals. CTA: "Connect your wallet to see your governance status."
- DRep discovery table below (simplified initial view, with "View all DReps" CTA linking to `/discover`)
- Kill the current static hero text that says the same thing every visit

**Authenticated mode — Personal governance hub:**
- Above-the-fold: "Since you were last here" summary — proposals opened/closed, your DRep's votes, score changes, new delegator activity
- Delegation health card (currently in GovernanceDashboard) — promoted to hero position
- Active proposals needing attention (from GovernanceDashboard) — with "X need your vote" badge
- Representation score (from GovernanceDashboard) — prominent with trend
- Re-delegation nudge (conditional, from GovernanceDashboard)
- Quick DRep discovery section below — "Explore DReps" link to `/discover`
- Kill the marketing hero entirely for authenticated users

**4. Integrate `DelegationInsightBanner` into layout**
- Stop rendering as a dismissible banner below the header
- Integrate the alignment/inactivity insight into the authenticated homepage cards
- The information is valuable; the delivery mechanism (dismissible banner) is not

**5. Create `/discover` route**
- Move the full DRep table experience (with all filters) to `/discover`
- Homepage shows a simplified preview of DRep discovery
- `/discover` becomes the power-user destination

**6. Server-render the initial data**
- Currently `DRepTableClient` fetches `/api/dreps` on mount (blocking first meaningful paint)
- Server-render the first page of DRep results in the homepage for instant load
- Client-side hydration takes over for filtering/sorting/pagination

### Files Affected
- `app/page.tsx` — Complete rewrite (dual-mode homepage)
- `app/discover/page.tsx` — New route (move table here)
- `app/methodology/page.tsx` — Delete (or redirect to homepage)
- `components/HeroSection.tsx` — Complete rewrite (dual-mode)
- `components/HomepageShell.tsx` — Complete rewrite (orchestrate dual-mode)
- `components/HeaderClient.tsx` — Nav restructure
- `components/Header.tsx` — Nav restructure
- `components/GovernanceDashboard.tsx` — Extract cards for homepage reuse
- `components/GovernanceWidget.tsx` — Promote to hero component
- `components/DelegationInsightBanner.tsx` — Kill as banner, integrate content into homepage
- `app/layout.tsx` — Remove DelegationInsightBanner from layout
- New: `components/GovernancePulse.tsx` — Live governance stats for unauth homepage
- New: `components/SinceLastVisit.tsx` — Returning user summary
- New: `components/HomepageAuth.tsx` — Authenticated homepage layout
- New: `components/HomepageUnauth.tsx` — Unauthenticated homepage layout
- New: API route for governance pulse stats (total ADA governed, active proposals, participation rates)

### Success Criteria
- A first-time visitor immediately understands the financial stakes of governance
- A returning connected user sees their governance status above-the-fold without scrolling
- No user sees marketing copy they've already internalized
- Time-to-value for new visitors decreases (measured by PostHog funnel: land → meaningful interaction)
- The homepage feels alive, not static

### Risks
- Server-rendered governance stats need a fast API (cache aggressively in Supabase)
- "Since last visit" requires tracking last visit timestamp per user (add to `users` table)
- Dual-mode complexity — need clean separation between auth/unauth experiences
- Moving the table to `/discover` changes the primary flow; need clear CTAs from homepage to discovery

---

## Session 2 — DRep Discovery Reimagined

### Goal
Transform DRep discovery from a desktop-first data table into a mobile-first, progressive, intelligent experience powered by **Governance DNA** — behavioral matching that learns how you'd govern from real decisions, not abstract labels. Kill the preference system entirely.

### The Systemic Change: Preferences → Governance DNA

The OnboardingWizard (6 abstract value cards) is replaced by the **Governance DNA Quiz** — a non-blocking, engaging quiz where users vote on real governance proposals and get matched to DReps based on actual vote agreement. This is the personalization engine for the entire platform going forward.

**What dies:** `OnboardingWizard`, `ValueSelector`, `UserPrefKey` as primary matching input, preference-based "Match %" column, the wizard-before-content anti-pattern.

**What stays (repositioned):** Pre-computed per-category alignment scores on `dreps` table — repurposed as DRep descriptive trait tags (labels on cards/profiles), not user-selected matching input. `poll_responses` table becomes the primary data source for matching. Existing representation score logic in `governance/holder` API already compares poll votes to DRep on-chain votes — this is extracted and generalized.

### Problems This Solves
- The DRep table is hostile on mobile (horizontal scroll, tiny text, 8+ filter controls)
- Discovery is a spreadsheet, not an experience
- The OnboardingWizard asks users to self-declare abstract ideologies before seeing any DReps — a gate, not a hook
- "Match %" is based on category-level proxies, not actual vote agreement
- Search is basic client-side substring matching with no intelligence
- Pagination is prev/next buttons instead of modern patterns
- All DReps fetched client-side, blocking first meaningful paint
- No visual DRep card format for casual browsing
- No quick preview without full-page navigation

### Specific Changes

**Phase 0: Session 1 Cleanup**
- Remove `OnboardingWizard` from `HomepageDualMode.tsx` (currently auto-opens if no prefs stored)
- Remove `openPreferencesWizard` event dispatch from `InlineDelegationCTA.tsx`
- Homepage (Session 1 output) stops gating on preferences immediately

**Phase 1: Server-rendered foundation + DRep cards**
- Server-render `/discover` with first 20 DReps from Supabase (kill the loading skeleton)
- New `DRepCard` component: avatar/initial, name, score ring, DRep trait tags (derived from `alignment_*` scores), pillar mini-bars, size/power, action buttons
- Responsive card grid: 1 column on mobile, 2 on tablet, 3 on desktop
- Toggle between card view and table view (persist in localStorage, default cards on mobile)
- Background hydration loads full dataset for client-side filtering

**Phase 2: Governance DNA Quiz + Progressive Filters**
- New `GovernanceDNAQuiz` component — non-blocking CTA above the DRep grid: "Find Your Ideal DRep in 60 Seconds"
- Quiz shows 5-7 real proposals that are maximally discriminating (close to 50/50 DRep vote split)
- Each question: proposal type badge, title, plain-language summary, financial context, Yes/No/Abstain buttons
- Quiz votes go directly into `poll_responses` (same table, same schema — zero new infrastructure)
- **The reveal:** Quiz card transforms into results showing top 3 matching DReps with vote agreement counts, delta vs current DRep, grid re-sorts by match
- New API route `GET /api/governance/quiz-proposals` — selects maximally discriminating proposals
- Progressive filter disclosure: search + sort always visible, filters behind expand button with active count badge
- Smart search with `fuse.js` fuzzy matching, suggestions dropdown, recent searches
- **Kill preference system:** Delete `OnboardingWizard.tsx`, gut preference management from `HomepageShell` and `DRepTableClient`, remove pref-based Match column

**Phase 3: Infinite scroll + Quick View**
- Replace prev/next pagination with `IntersectionObserver` infinite scroll + "Load more" fallback
- New `DRepQuickView` bottom sheet (mobile) / side sheet (desktop)
- Quick view shows: score breakdown, recent votes, Governance DNA match with vote-by-vote comparison (for users with quiz/poll data), DRep trait tags fallback (for users without)
- "View Full Profile" and "Delegate" CTAs

**Phase 4: Representation Matching Engine**
- Extract matching logic from `governance/holder` API into shared `lib/representationMatch.ts`
- New API route `GET /api/governance/matches` — returns match scores for all DReps based on user's poll history
- "Best Match" sort option on discovery page (available when user has >= 3 poll votes)
- Match % appears on cards/table rows, quick view shows vote-by-vote comparison
- Fix broken alignment score bug in `governance/holder` route (display-label key mismatch) by replacing with representation score
- Refactor governance dashboard to use shared matching functions

### Files Affected
- `components/HomepageDualMode.tsx` — Remove wizard integration (Phase 0)
- `components/InlineDelegationCTA.tsx` — Remove preference event dispatch (Phase 0)
- `app/discover/page.tsx` — Rewrite as server component with data fetching
- `lib/data.ts` — Add `getDRepsPage()` function
- `lib/alignment.ts` — Add `getDRepTraitTags()` utility
- `components/DRepTableClient.tsx` — Complete overhaul (remove prefs, add view toggle, infinite scroll, quiz integration)
- `components/DRepTable.tsx` — Remove pref-based Match column (re-added as behavioral match in Phase 4)
- `components/HomepageShell.tsx` — Gut preference management, add quiz CTA
- New: `components/DRepCard.tsx` — Card-based DRep display with trait tags / match %
- New: `components/DRepCardGrid.tsx` — Responsive card grid layout
- New: `components/GovernanceDNAQuiz.tsx` — The quiz experience
- New: `components/GovernanceDNAReveal.tsx` — Quiz results card
- New: `components/DRepQuickView.tsx` — Bottom/side sheet for quick preview
- New: `components/SmartSearch.tsx` — Fuzzy search with suggestions
- New: `components/FilterPanel.tsx` — Progressive filter disclosure
- New: `lib/representationMatch.ts` — Shared matching functions
- New: `app/api/governance/quiz-proposals/route.ts` — Quiz proposal selection
- New: `app/api/governance/matches/route.ts` — Discovery-page matching
- Kill: `components/OnboardingWizard.tsx` — Delete
- Kill: `components/ValueSelector.tsx` — Delete
- Update: `app/api/governance/holder/route.ts` — Refactor to use shared matching, fix broken alignment score

### Success Criteria
- A new user goes from landing on /discover to personalized DRep matches in under 90 seconds (quiz flow)
- Quiz completion rate > 60% of users who start it
- Mobile discovery feels native-app quality, not a shrunken desktop table
- Page loads with DReps visible in < 1 second (server-rendered)
- "Best Match" becomes the most-used sort option for users with quiz data
- OnboardingWizard is fully deleted from the codebase

---

## Session 3 — DRep Command Center

### Goal
Transform the DRep experience from a read-only report card into an actionable command center that makes DReps addicted to the platform. Fix the claim funnel to create FOMO and ceremony. Build the foundation for DRep Pro monetization.

### Problems This Solves

**Claim experience:**
- Claim page sells features ("Dashboard," "Inbox," "Alerts") instead of outcomes (more delegators, more credibility, more influence)
- No preview of the dashboard — DReps don't know what they're claiming
- No FOMO — no sense that other DReps are actively using the platform
- No competitive context — "DReps like you who already claimed are scoring higher"
- Post-claim celebration is a small green banner, not a moment

**Dashboard experience:**
- Dashboard is read-only — almost nothing to DO
- Recommendations say "improve rationale rate" but don't let you act on it right there
- Missing rationale table shows votes without rationale but doesn't surface the Rationale Assistant inline
- No delegator analytics (growth/loss trends, who's viewing, sentiment)
- No competitive context ("DReps with similar voting power who score higher")
- Score improvement is informational, not gamified (no progress tracking, streaks, milestones, badges)
- No DRep positioning tools (governance philosophy, position statements)
- No shareable DRep report card
- Profile editing bounces to external tools (gov.tools) with no guidance
- No DRep-to-DRep visibility or activity feed

**Rationale Assistant:**
- Buried inside vote detail sheets on individual proposals
- Tagged as "Pro" but no paywall or upgrade flow
- Not surfaced in the dashboard where DReps see their missing rationales
- Should be the #1 tool a DRep uses, but it's hidden

### Specific Changes

**1. Claim page overhaul**
- Replace feature-list pitch with outcome-driven pitch: "X delegators searched for DReps this week. Your profile is live. Own your reputation."
- Show a blurred/preview dashboard screenshot so DReps see what they're getting
- Social proof: "X DReps have claimed. Here are some:" (show top-scoring claimed DReps)
- Competitive nudge: "DReps who claimed their profile average 12 points higher" (if data supports)
- Show the DRep's current score prominently with "your biggest opportunity: [quick win]"
- Post-claim: Full-screen celebration moment with confetti (use canvas-confetti dep already installed), personalized score breakdown, "Your first 3 actions" checklist

**2. Post-claim onboarding flow**
- After claim celebration, guided walkthrough: "Here's your score. Here's your weakest pillar. Here's the #1 thing you can do right now to improve."
- Interactive checklist that persists: "Complete your profile (0/5 fields) → Write your first rationale → Vote on a pending proposal → Share your score"
- Checklist visible on dashboard until complete

**3. Inline Rationale Assistant**
- In the missing rationale table, add a "Write Rationale" button on each row
- Clicking opens the RationaleAssistant pre-loaded with that proposal's context (title, abstract, AI summary, proposal type)
- After generating and copying, mark the row with a visual indicator
- This is the single most impactful UX improvement for DRep engagement

**4. Delegator analytics**
- Delegator count trend chart (reuse ScoreHistoryChart pattern)
- "This week: +8 delegators, -2 delegators, net +6"
- Delegator size distribution (how many small vs large delegators)
- Profile view stats enhanced: daily/weekly views, trend, referral sources if possible
- Correlation insights (stretch): "Your score increase of 5 points last week coincided with gaining 12 delegators"

**5. Competitive context**
- "Leaderboard position: #15 of 200 active DReps"
- "DReps near you": Show 2-3 DReps just above and below in score, with their pillar breakdown
- "To reach top 10, focus on: [specific pillar recommendation]"
- Weekly rank change indicator: "↑3 positions this week"

**6. Gamification layer**
- Score improvement progress: "You've completed 2 of 4 recommendations this month"
- Streaks: "5 consecutive votes with rationale" (visible on public profile as a badge)
- Milestones: First 10 delegators, First 100 delegators, Score above 80 for 30 days, All pillars Strong
- Milestone badges visible on public DRep profile page
- Each milestone triggers a shareable moment card

**7. DRep positioning tools**
- "Governance Philosophy" field — free-text that appears on public profile (stored in Supabase, not CIP-119)
- "Position Statements" — DReps can write a position on active proposals before voting, visible to delegators browsing proposals
- These are DRepScore-native features that don't require CIP-119 metadata changes
- Creates platform lock-in: this content only lives on DRepScore

**8. Shareable DRep report card**
- "Generate Report Card" button on dashboard
- Produces a beautiful, branded image: score, pillar breakdown, key stats (delegators, votes, rationale rate), score trend mini-chart, rank
- Designed for X/Twitter sharing with proper dimensions
- Periodic auto-generation: "Your monthly governance report is ready to share"

**9. Notification enhancements for DReps**
- "Your delegator polling shows 70% disagreement on your last vote — consider posting an explanation"
- "You're 3 points away from the top 10 — one more rationale would get you there"
- "You gained 5 delegators this week" (with shareable card)
- "3 proposals expire in 2 epochs — vote now to maintain your participation rate"

### Data Model Changes
- `users` table: Add `first_visit_at`, `last_visit_at`, `onboarding_checklist` (JSONB)
- New `drep_milestones` table: `drep_id`, `milestone_key`, `achieved_at`
- New `position_statements` table: `drep_id`, `proposal_tx_hash`, `proposal_index`, `statement_text`, `created_at`
- New `governance_philosophy` column on `dreps` table (or separate table)
- `drep_power_snapshots` — ensure delegator count is tracked over time (may already exist)

### Files Affected
- `app/claim/[drepId]/ClaimPageClient.tsx` — Complete rewrite
- `app/dashboard/page.tsx` — Major enhancement
- `components/DRepDashboard.tsx` — Add inline rationale, gamification, competitive context
- `components/GovernanceInboxWidget.tsx` — Add rationale assistant integration
- `components/RationaleAssistant.tsx` — Make embeddable in different contexts
- `components/ProfileViewStats.tsx` — Enhance with trends
- New: `components/DelegatorTrendChart.tsx`
- New: `components/CompetitiveContext.tsx`
- New: `components/OnboardingChecklist.tsx`
- New: `components/MilestoneBadges.tsx`
- New: `components/DRepReportCard.tsx`
- New: `components/PositionStatementEditor.tsx`
- New: `components/GovernancePhilosophyEditor.tsx`
- New: API routes for position statements, governance philosophy, milestones, delegator trends

### Success Criteria
- DReps return to the dashboard at least weekly (measured by PostHog)
- Claim conversion rate increases (claim page viewed → claimed)
- Rationale provision rate increases for claimed DReps
- DReps share their report cards on social media (trackable via UTM params on shared URLs)
- Onboarding checklist completion rate > 50%

---

## Session 4 — Shareable Moments & Viral Mechanics

### Goal
Build the organic growth engine. Every feature should have a shareable output. Create mechanics that spread without the user explicitly deciding to share.

### Problems This Solves
- Sharing is limited to "Share on X" and "Copy Link" — minimum viable social
- No organic DRep acquisition funnel (how do DReps discover DRepScore?)
- No embeddable content that lives outside the platform
- No viral moments designed into the user journey
- Score changes happen silently
- Delegation is a transaction, not a ceremony
- No leaderboard creating competitive content

### Specific Changes

**1. Embeddable DRep score badges**
- PNG/SVG badges at `/api/badge/[drepId]` (route already exists — enhance it)
- Multiple formats: shield (like GitHub badges), card (like npm badges), full (mini score card)
- Markdown/HTML embed code with one-click copy: `![DRepScore](https://drepscore.io/badge/drep1...)`
- DReps put these in: Twitter/X bio, forum signatures, governance proposals, personal websites
- This is the #1 growth loop: badges link back to DRepScore, creating inbound traffic from everywhere DReps are active
- Auto-updating: badge re-generates on each request (cache with short TTL)
- "Get your badge" prominent CTA on DRep dashboard and claim page

**2. "Wrapped-style" shareable score cards**
- Beautiful, auto-generated images designed for social sharing (1080x1080 for X, 1080x1920 for stories)
- For DReps: "My DRepScore this month: 82/100. Voted on 12 proposals. Provided rationale on 10. Top 8% of DReps."
- For delegators: "I'm delegated to [DRep Name]. They scored 85/100 and voted on 100% of proposals this month. Who's your DRep?"
- "Who's your DRep?" becomes a social mechanic: people share, others check their own, creates a loop
- Generate via server-side canvas/OG image route — optimize for visual impact
- Share buttons: X, copy image, download

**3. Delegation ceremony**
- When a user delegates through the platform (or we detect a new delegation on-chain):
  - Full-screen celebration: confetti, animated score reveal of their new DRep
  - "You're now a Governance Guardian" messaging
  - Shareable card: "I just delegated to [DRep Name] on DRepScore. My voice in Cardano governance is now active."
  - Social proof: "You're one of X active Governance Guardians"
  - Track and surface this moment: the canvas-confetti dependency is already installed but underutilized

**4. Score change moment cards**
- When a DRep's score changes significantly (±5 points), auto-generate a shareable moment card
- "DRep X gained 8 points this month after improving rationale quality from 40% to 75%"
- For the DRep: push notification + "Share your progress"
- For delegators watching: watchlist alert + "DRep X on your watchlist is improving"
- Design these as beautiful, branded cards that look great in a tweet

**5. Public leaderboard**
- `/leaderboard` or section on `/pulse` page
- Top 20 DReps by score, filterable by size tier
- Weekly movers: biggest score gains and drops
- "Hall of Fame": DReps who've maintained score above 80 for 90+ days
- This creates competitive content: DReps share their ranking, debate positions
- Leaderboard entries link to profiles, driving traffic

**6. Governance Pulse public page**
- `/pulse` — the public face of Cardano governance health
- Total ADA governed, active proposals, participation rates, rationale rates
- Trend charts: governance health over time
- "This week in governance" summary
- Community sentiment vs DRep voting gap analysis
- Designed to be the page journalists, researchers, and community leaders link to
- Shareable stats: each stat has a share button that generates an image

**7. OG image overhaul**
- Current OG images (`/api/og/drep/[drepId]`, `/api/og/compare`) — enhance visual quality
- Make them look like premium cards, not basic text layouts
- Include score ring visualization, pillar summary, key stats
- Compare OG image should show the radar chart comparison
- These are what people see when links are shared on X, Discord, Telegram

### Files Affected
- `app/api/badge/[drepId]/route.ts` — Enhance with multiple formats
- `app/api/og/drep/[drepId]/route.ts` — Visual overhaul
- `app/api/og/compare/route.ts` — Visual overhaul
- New: `app/pulse/page.tsx` — Governance Pulse public page
- New: `app/leaderboard/page.tsx` (or section of `/pulse`)
- New: `components/ShareableScoreCard.tsx` — Wrapped-style cards
- New: `components/DelegationCeremony.tsx` — Full-screen celebration
- New: `components/BadgeEmbed.tsx` — Badge preview + embed code copy
- New: `components/LeaderboardTable.tsx`
- New: `components/GovernancePulseStats.tsx`
- New: `components/ScoreChangeMoment.tsx`
- New: API routes for leaderboard data, governance pulse stats
- Enhancement: Inngest functions to detect significant score changes and trigger moment card generation

### Success Criteria
- Embeddable badges appear on 20+ DRep external profiles within first month
- "Who's your DRep?" shares generate measurable inbound traffic
- Governance Pulse page becomes the most-linked DRepScore URL
- Delegation ceremony completion → social share rate > 15%
- DRep leaderboard creates organic X/Twitter discussion

---

## Session 5 — Governance Citizen Experience

### Goal
Build the features that transform ADA holders from passive DRep shoppers into active governance citizens. This is the differentiator that no other crypto governance tool has built — the first governance *relationship* platform.

### Problems This Solves
- Financial stakes of governance are invisible to ADA holders
- No personal governance timeline or history
- No "what if" delegation intelligence (proactive, not just when rep score < 50%)
- Watchlist is passive filtering, not active intelligence
- No governance calendar or forward-looking view
- No community pulse beyond isolated proposal polls
- No governance digest / "since you were last here" depth
- No delegator collective identity
- No sense that participation is consequential

### Specific Changes

**1. Financial impact framing on proposals**
- Every proposal page shows financial context:
  - Treasury proposals: "This would withdraw X ADA (Y% of the Z ADA treasury)"
  - Parameter changes: "This changes [parameter] from X to Y. Here's what that means for staking rewards / fees / block sizes."
  - Hard forks: "This is a fundamental protocol change. Only N have been proposed in Cardano's history."
- On the homepage governance pulse: "X billion ADA is under governance. Y ADA has been requested from the treasury this quarter."
- ADA-denominated thinking throughout: if we know the user's wallet balance, show "Your X ADA gives your DRep Y% of their voting power"

**2. Personal governance timeline**
- `/governance/timeline` or section within My Governance
- Chronological story: "Connected March 1 → Delegated to DRep X March 5 → DRep X voted Yes on Proposal Y March 8 → You polled Abstain on Proposal Y March 10 → DRep X's score rose 3 points March 15 → You gained Governance Guardian status"
- Visual timeline with icons for each event type
- Events: wallet connection, delegation changes, DRep votes on your behalf, your poll votes, score changes, milestone achievements, proposal outcomes
- Data sources: `users` table (connection/delegation), `drep_votes` (DRep activity), `poll_responses` (user polls), `drep_score_history` (score changes)
- This creates a narrative of ongoing participation, not a snapshot

**3. "What if" delegation intelligence (deepens Session 2 Governance DNA)**
- Session 2 builds the foundation: Governance DNA Quiz, `representationMatch.ts`, `/api/governance/matches`, "Best Match" sort on /discover
- Session 5 deepens this with **proactive suggestions and triggers** on the governance dashboard:
- "Based on your 12 poll votes, here's how other DReps would represent you:" (top 3 best-match DReps with profile link)
- Current DRep's match rate for comparison: "Switch to DRep Y for 92% representation (vs 61% current)"
- Trigger: recalculate and surface a nudge whenever user casts a new poll vote
- The representation matching engine (`lib/representationMatch.ts`) is shared between /discover and /governance — Session 5 adds proactive triggers, not duplicate logic

**4. Watchlist intelligence**
- Transform watchlist from passive filter to active monitoring tool
- Watchlist dashboard section (in My Governance):
  - "DRep X dropped 8 points this week after missing 3 critical votes"
  - "DRep Y published rationale on the treasury proposal — here's what they said"
  - "DRep Z gained 50 delegators this month — fastest growing on your watchlist"
- Watchlist notifications: push/email alerts when watched DReps have significant events
- "Why you're watching vs why you're delegated" tension: "DRep Z on your watchlist has an 88% representation match vs your current DRep's 61%" (based on Governance DNA / poll vote comparison)

**5. Governance calendar / "what's coming"**
- Section on homepage (auth mode) and My Governance
- Next epoch boundary with countdown
- Proposals expiring this epoch with urgency markers
- Recently opened proposals
- Historical: recent proposal outcomes
- Future: any known upcoming governance events
- Simple timeline view, not a full calendar — think "upcoming" section in a news app

**6. Community governance pulse**
- Aggregate poll data into community-wide insights:
  - "72% of polled delegators support Proposal X, but only 45% of DReps voted Yes"
  - "Growing gap between community sentiment and DRep voting on treasury proposals"
  - "Delegators who voted No on treasury proposals are 80% opposed to this withdrawal" (behavioral cohort derived from poll data, not self-selected labels)
- Visible on proposal pages and on the `/pulse` public page
- This is the "headline" feature — the insight people share and discuss
- Creates narrative tension that drives engagement

**7. Governance digest**
- In-app: "Since your last visit" section on authenticated homepage (built in Session 1, enriched here)
- Push/email: Epoch-based summary
  - "This epoch: 2 proposals closed (1 passed, 1 failed), 3 new proposals opened, your DRep voted on 4 and provided rationale on 3"
  - "Your representation score: 75% (↑5% from last epoch)"
  - "Community highlight: Proposal X passed with 82% DRep support despite 45% delegator opposition"
- Designed to be the thing that pulls users back weekly

**8. Governance impact / agency framing**
- On proposal outcome pages: "Your DRep's vote was part of the [winning/losing] majority. Your ADA helped shape this outcome."
- On delegation: "Your X ADA represents Y% of your DRep's voting power"
- On My Governance: "Since you delegated, your DRep has voted on Z proposals on your behalf, shaping decisions worth W ADA in treasury allocations"
- This creates the feeling that participation is consequential, not performative

**9. Delegator collective identity (behavioral cohorts)**
- Based on voting patterns (Governance DNA), not self-selected preferences: "You and 340 other delegators who voted No on large treasury withdrawals represent 22M ADA in combined voting power"
- Behavioral cohorts derived from poll data clustering (e.g., "treasury skeptics", "innovation advocates") — labels generated from voting patterns, not declared by users
- Cohort stats: how your cohort's DReps are performing, how cohort sentiment compares to outcomes
- This makes individual delegators feel part of a movement
- Potential for cohort leaderboards or badges (stretch)

### Data Model Changes
- `users` table: `last_visit_at` (timestamp for "since last visit"), `governance_events` (JSONB log or separate table)
- New `governance_events` table: `user_address`, `event_type`, `event_data` (JSONB), `created_at` — for personal timeline
- Enhancement to `poll_responses`: aggregate views for community pulse
- New `proposal_outcomes` tracking: store pass/fail results for impact framing
- New governance stats API: total ADA governed, participation rates, sentiment gaps

### Files Affected
- `app/governance/page.tsx` — Major enhancement with timeline, watchlist intelligence, calendar
- `components/GovernanceDashboard.tsx` — Add "what if" intelligence, governance calendar
- `app/proposals/[txHash]/[index]/page.tsx` — Add financial impact framing, community pulse
- `components/ProposalDescription.tsx` or new component — Financial context
- New: `components/GovernanceTimeline.tsx`
- New: `components/WatchlistIntelligence.tsx`
- New: `components/GovernanceCalendar.tsx`
- New: `components/CommunityPulse.tsx`
- New: `components/GovernanceDigest.tsx`
- New: `components/DelegationImpact.tsx`
- New: `components/CohortIdentity.tsx`
- Enhancement: Inngest functions for governance event tracking, digest generation

### Success Criteria
- Connected users return weekly (measured by `last_visit_at` frequency)
- "What if" intelligence drives measurable re-delegation events
- Community pulse insights get shared on social media
- Financial framing increases poll voting participation
- Governance digest push notifications have > 30% open rate
- Users describe DRepScore as "my governance dashboard" not "that DRep scoring site"

---

## Session 6 — Visual Identity & Polish

### Goal
Create a visual identity that is instantly recognizable — every screenshot, every shared card, every page is unmistakably DRepScore. Add the micro-interactions and polish that separate a "good app" from a "wow" experience.

### Problems This Solves
- Visual design is "good shadcn app" — indistinguishable from 10,000 other Next.js + shadcn projects
- No signature visual element that's ownable
- Recharts defaults for data visualization (same as every dashboard)
- No page transitions (hard cuts between pages)
- No micro-interactions beyond basic hover states
- No celebration animations that reinforce brand
- Dark mode may be less polished than light mode
- Achievement system exists conceptually but not visually

### Specific Changes

**1. Signature visual element**
- Design a custom score visualization that's uniquely DRepScore — not a standard ring/donut chart
- Consider: a "governance constellation" where each pillar is a node with connections, or a custom radial design with Cardano-inspired geometry
- This visualization appears: on DRep profiles, on shared cards, on badges, on the homepage, on OG images
- It should be so distinctive that seeing it in a tweet immediately signals "that's DRepScore"

**2. Custom data visualization style**
- Replace Recharts defaults with custom-styled charts that have a consistent DRepScore aesthetic
- Custom tooltip designs, grid styles, color palettes that are ownable
- Score trend chart: custom styling with gradient fills, subtle animations on load
- Radar chart (compare page): custom styling that matches the signature visual language
- Consider WebGL or Canvas-based visualizations for hero stats (stretch)

**3. Page transitions**
- Implement View Transitions API (Next.js 15 supports this) for smooth navigation
- Shared element transitions: DRep card in the table animates into the detail page header
- Slide transitions between related pages (discovery → detail → compare)
- Fade transitions for unrelated navigation
- Keep transitions fast (200-300ms) — polish, not delay

**4. Micro-interactions**
- Button press: subtle scale-down (0.97) on press, scale-up on release
- Score ring: animated fill on mount (already exists, enhance with easing)
- Pillar bars: staggered fill animation on mount
- Card hover: subtle lift + shadow increase
- Like/watchlist: heart fill animation
- Compare selection: card briefly highlights with brand color
- Poll vote: button pulses briefly after selection
- Copy actions: checkmark morph animation
- Scroll-triggered animations for sections below the fold

**5. Celebration animations**
- Delegation ceremony: confetti (canvas-confetti), score ring dramatic reveal, badge unlock animation
- Milestone achieved: badge appears with shine effect, shareable card auto-generates
- Score increase: number counter animation with positive color pulse
- Claim success: full-screen brand moment with animated elements
- All celebrations should be brief (1-2 seconds), skippable, and delightful

**6. Custom iconography**
- Replace generic Lucide icons for core concepts with custom-designed icons:
  - Governance (not just Shield)
  - Delegation (not just Users)
  - Score/reputation (not just TrendingUp)
  - Proposals (not just Vote)
- These appear in: navigation, feature sections, empty states, badges, shared cards
- Consistent stroke weight and style across all custom icons

**7. Typography refinements**
- Use Geist display weights more dramatically for hero numbers and headings
- Score displays: tabular-nums with custom letter-spacing for emphasis
- Consider a secondary display font for the brand name "$drepscore" in marketing contexts
- Ensure typographic hierarchy is consistent across all pages

**8. Dark mode audit**
- Systematic review of every component in dark mode
- Ensure gradient backgrounds work in both modes
- Verify chart readability in dark mode
- Check contrast ratios meet WCAG AA standards
- Make dark mode feel intentional, not auto-generated

**9. Achievement / badge visual system**
- Design a consistent badge visual language for milestones
- Badges should look like real achievement badges (not just colored circles)
- Badge levels: Bronze, Silver, Gold for progressive milestones
- Displayed on public DRep profiles and in shared cards
- Consider animated badge reveals

**10. Loading state refinements**
- Skeleton loaders with subtle shimmer animation (beyond basic animate-pulse)
- Content-specific skeleton shapes (score ring placeholder, chart placeholder)
- Loading states that hint at what's coming (not just gray blocks)
- Consider brief loading tips/facts about governance during longer loads

### Success Criteria
- Screenshots of DRepScore are instantly recognizable without seeing the URL
- Users comment on the visual quality ("this looks amazing" / "this is beautiful")
- Dark mode and light mode are equally polished
- Page transitions feel native-app quality
- Celebration moments are shared on social media as screenshots/recordings

---

## Anti-Patterns to Avoid

1. **Don't gamify re-delegation too aggressively.** Frequent switching destabilizes governance. Frame re-delegation as a considered decision, not a game.
2. **Don't create DRep tribalism.** Comparison and competition are healthy; factions and hostility are not. Keep the tone constructive.
3. **Don't make governance feel like a chore.** Too many notifications, too many "you need to vote" nudges = notification fatigue. Quality over quantity.
4. **Don't gate accountability features behind payment.** Basic scores, voting records, and delegation tools must always be free. This is governance infrastructure.
5. **Don't over-animate.** Celebrations should be brief and skippable. Micro-interactions should be subtle. Never slow down the user for animation.
6. **Don't fake real-time.** If data syncs every 30 minutes, don't create a fake "live" ticker. Design around the actual data freshness with honest timestamps.
7. **Don't show empty/broken states at launch.** If DRep data is sparse, design around it. "This DRep hasn't provided metadata yet" is better than empty cards.
8. **Don't forget accessibility.** ARIA labels, keyboard navigation, screen reader support. Governance tools should be inclusive by definition.

---

## Competitive Positioning

### What Exists in Crypto Governance

| Tool | Chain | What It Does | Where We Differentiate |
|---|---|---|---|
| Tally | Ethereum | Proposal voting + delegation | No scoring, no value matching, no delegator intelligence |
| Snapshot | Multi-chain | Off-chain voting | Voting tool only, no representative evaluation |
| Realms | Solana | DAO governance | Basic voting, no scoring or analytics |
| Boardroom | Multi-chain | Governance aggregator | Information display, no personalization or citizen experience |
| GovTool | Cardano | Official governance tool | Functional, not experiential; no scoring, no analytics |

### Our Unique Position
DRepScore would be the **first governance relationship platform** in all of crypto — not a voting tool, not a directory, not an aggregator, but a platform that makes every token holder feel like an empowered governance citizen with personal stakes, ongoing representation monitoring, and community identity.

No one has built this for any chain. The opportunity is to define the category.
