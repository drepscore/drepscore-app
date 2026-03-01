---
description: DRepScore architecture, data flow, scoring model, and key file map
globs: ["lib/**", "utils/**", "app/api/**", "components/**", "app/**"]
alwaysApply: false
---

# DRepScore Architecture

## What This Is
Cardano governance tool for casual ADA holders to discover DReps aligned with their values via scorecards and easy delegation. Brand: `$drepscore`. Tone: neutral, educational.

## Tech Stack
- **Framework**: Next.js 16 App Router, TypeScript strict, server components for data fetching
- **UI**: shadcn/ui + Tailwind CSS v4 + Recharts/Tremor. Dark mode via next-themes
- **Wallet**: MeshJS (Eternl, Nami, Lace, Typhon+). Wallet connection is optional — show value first
- **Data**: Koios API (mainnet) → Supabase (cache) → Next.js (reads)
- **Hosting**: Railway (Docker, health checks, auto-deploy from `main`)
- **CDN/DNS**: Cloudflare
- **Background Jobs**: Inngest Cloud (8 durable functions — syncs, integrity, notifications)
- **Error Tracking**: Sentry (Next.js SDK)
- **Analytics**: PostHog (JS + Node SDKs)

## Data Flow (Canonical)
```
Koios API (source of truth)
    ↓  sync scripts + /api/sync routes
Supabase (cache layer, persistent storage)
    ↓  lib/data.ts reads
Next.js App (server components + API routes + client components)
```

**Critical rule**: All frontend reads go through Supabase via `lib/data.ts`. Direct Koios calls only happen inside sync scripts and `utils/koios.ts` (used by sync). Never add new direct-API paths to the frontend.

## Key Files
| Purpose | File(s) |
|---------|---------|
| Supabase reads (primary data source) | `lib/data.ts` |
| Koios API helpers (used by sync) | `utils/koios.ts` |
| Scoring & enrichment logic | `lib/koios.ts`, `utils/scoring.ts` |
| Supabase client | `lib/supabase.ts` |
| Full sync (daily cron) | `app/api/sync/route.ts` |
| Fast sync (30min cron) | `app/api/sync/fast/route.ts` |
| Bootstrap scripts | `scripts/bootstrap-sync.ts`, `scripts/sync-dreps.ts` |
| DRep types | `types/drep.ts`, `types/koios.ts` |
| Alignment scoring | `lib/alignment.ts`, `utils/scoring.ts` |
| Admin integrity | `app/api/admin/integrity/route.ts`, `app/admin/integrity/page.tsx` |

## Scoring Model (V3, Feb 2026)
```
DRep Score (0-100) =
  Rationale Quality (35%) +
  Effective Participation (30%) +
  Reliability (20%) +
  Profile Completeness (15%)
```
- Influence/voting power intentionally excluded (conflicts with decentralization mission)
- Abstention penalty: <25% mild, 25-50% moderate, >50% severe
- Size tiers: Small (<10k), Medium (10k-1M, optimal), Large (1M-10M), Whale (>10M)

## Sync Architecture
- **Full sync** (`/api/sync`): Daily at 2am UTC. All DReps, votes, rationales, proposals, scores
- **Fast sync** (`/api/sync/fast`): Every 30 min. New proposals, active votes only
- **Bootstrap**: One-time scripts for initial data population (`scripts/bootstrap-sync.ts`)
- **Integrity alerts** (`/api/admin/integrity/alert`): Every 6 hours, Slack/Discord webhooks

## Database (Supabase)
22+ migrations. Key tables: `dreps`, `drep_votes`, `vote_rationales`, `proposals`, `drep_score_history`, `proposal_voting_summary`, `drep_power_snapshots`, `poll_responses`, `sync_log`, `integrity_snapshots`, `api_keys`, `api_usage_log`

## Background Jobs (Inngest Cloud)
All scheduled work runs via Inngest durable functions (no vercel.json crons):
- `sync-fast` — every 30 min (new proposals, active votes)
- `sync-full` — daily 2am UTC (all DReps, votes, rationales, scores)
- `sync-secondary` — daily 3am UTC (social links, power snapshots)
- `integrity-check` — every 6 hours (data quality + Discord alerts)
- `push-notifications` — every 30 min
- `inbox-check` — every 30 min (new proposal alerts)
- `integrity-snapshot` — daily (capture data quality KPIs)
- `api-health-alert` — every 6 hours

## Server Component Constraints
- Any `app/**/page.tsx` that calls `createClient()`, `getSupabaseAdmin()`, or any runtime-only service must export `dynamic = 'force-dynamic'`. Railway's Docker build has no env vars at build time — Next.js will attempt static prerendering and crash.
- Client components (`'use client'`) that fetch via `useEffect` are unaffected since they never run during build.
- When converting a page from client-only to server-fetching, always add the `force-dynamic` export.

## UX Principles
- Show value first (no forced wallet connect)
- Educational tooltips on every metric
- Well-documented DRep filter by default (has name + ticker or description)
- Summary view default, depth on demand (hover tooltips, expandable sections)
- Loading skeletons, <3s target page loads
- Encourage delegation to smaller, quality DReps (size tier badges, decentralization scoring)

## Production URL
https://drepscore.io
