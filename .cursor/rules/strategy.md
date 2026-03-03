---
description: Business strategy and product vision context for DRepScore
globs:
  - docs/strategy/**
  - tasks/**
alwaysApply: false
---

# Strategy Context

DRepScore has a comprehensive product vision, monetization strategy, and growth plan documented in `docs/strategy/`.

## North Star Document

**`docs/strategy/ultimate-vision.md`** is the definitive product vision and the single most important strategy document. It defines:

- **The thesis:** DRepScore is the governance intelligence layer for Cardano, not a dashboard.
- **The data flywheel:** Every data point feeds every other data point. Every new data source multiplies the value of every existing surface.
- **Build sequence:** 12 steps (0-11) from backend metric upgrades through cross-ecosystem governance identity, each building on the previous.
- **Monetization roadmap:** Free core through Steps 0-2, then DRep Pro, Premium Delegator, API/B2B, Enterprise, Catalyst Score, and Governance-as-a-Service.
- **Data compounding schedule:** Which snapshots to collect, when they start, and what they compound into.
- **Non-negotiable principles:** Free core, data is the product, progressive complexity, ship fast, DReps are the sales force, vertical depth, build in public.

**Read `ultimate-vision.md` first when you need strategic context for any decision.**

## Detailed Strategy Documents

- `docs/strategy/monetization-strategy.md` — Detailed business model: moat analysis, two-sided marketplace, revenue phases, long-term plays, path to full-time income.
- `docs/strategy/drep-pro-tier.md` — DRep Pro feature design and pricing (corresponds to Vision Step 5).
- `docs/strategy/api-product.md` — Governance Data API product spec (corresponds to Vision Step 7).
- `docs/strategy/catalyst-proposal.md` — Project Catalyst Fund 16 proposal draft.

## Key Strategic Principles

- **Free core, paid power tools** — Never gate basic governance accountability (discovery, scores, delegation, Quick Match, basic alerts).
- **Data moat** — Historical score snapshots, voting patterns, and alignment data are the primary competitive advantage. Prioritize data collection and preservation. Every day without collecting is a day competitors can never catch up to.
- **Progressive complexity** — Layer 1 must be emotionally complete. No user should NEED to scroll to feel the product is valuable.
- **DRep-side monetization** — DRep Pro tier is the primary near-term revenue stream. Build features that make DReps want to pay.
- **API-first for B2B** — Wallet integrations and third-party tools are the long-term revenue giant. Design data access patterns with API exposure in mind.
- **ADA-native payments** — When implementing payments, accept ADA directly.

## Architecture Implications

When building features, consider:

1. Will this data be valuable in the API product? If yes, ensure clean data modeling.
2. Does this feature belong in Free or Pro tier? Default to free unless it is clearly a power-user need.
3. Does this increase switching costs for DReps? Score history, claimed profiles, and engagement tools all increase lock-in.
4. Can this be packaged for the Catalyst proposal milestones?
5. Does this connect to other data sources? The product's magic comes from connecting dots -- a feature that is isolated from the data flywheel is missing an opportunity.
6. Are we snapshotting this data? If a new metric or score is being computed, snapshot it per epoch. The historical data IS the moat.
