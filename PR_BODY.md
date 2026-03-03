## Summary

- **Rebuild GHI from 6 participation-heavy components to 6 balanced across Engagement, Quality, and Resilience**, each with calibrated scoring curves instead of raw percentages
- **New Edinburgh Decentralization Index engine** — 7 pure-math metrics (Nakamoto, Gini, Shannon Entropy, HHI, Theil, Concentration Ratio, Tau-Decentralization) composited into the Power Distribution component
- **Standalone `/decentralization` dashboard** with 7-metric breakdown, normalized scores, historical sparklines, and EDI methodology attribution
- **Feature-flagged Citizen Engagement component** (`ghi_citizen_engagement`, default OFF) — weight redistributes proportionally when disabled
- **Circulating supply** exposed from Koios `/totals` for delegation rate calculations
- **Component-level trends** in the history API for per-component improving/declining signals

## New Files

| File | Purpose |
|------|---------|
| `lib/ghi/ediMetrics.ts` | 7 EDI metric implementations + composite scorer |
| `lib/ghi/components.ts` | 6 GHI component computations |
| `lib/ghi/calibration.ts` | Piecewise linear calibration curves |
| `lib/ghi/index.ts` | Orchestrator replacing `computeGHI()` |
| `lib/ghi/types.ts` | Shared types extracted for reuse |
| `app/decentralization/` | Dashboard page + client component |
| `app/api/governance/decentralization/route.ts` | EDI metrics API |
| `supabase/migrations/032_ghi_v2.sql` | `decentralization_snapshots` table, `ghi_snapshots` formalized, circulating supply column, feature flag seed |

## Modified Files

- `lib/ghi.ts` → backward-compatible re-export shim
- `utils/koios.ts` → `fetchTreasuryBalance()` now returns `circulation`, new `fetchCirculatingSupply()`
- `inngest/functions/snapshot-ghi.ts` → stores decentralization snapshots alongside GHI
- `components/GovernanceHealthIndex.tsx` → filters zero-weight components
- `app/api/governance/health-index/history/route.ts` → component-level trends
- `app/pulse/page.tsx` → updated description + link to decentralization dashboard

## Test plan

- [x] `npx tsc --noEmit` — passes
- [x] `npx vitest run` — 241 tests passing
- [ ] Apply migration 032 via Supabase MCP
- [ ] Verify `/api/governance/health-index` returns new component names
- [ ] Verify `/api/governance/decentralization` returns EDI metrics
- [ ] Verify `/decentralization` page renders
- [ ] Add `ghi_citizen_engagement` flag and verify weight redistribution
