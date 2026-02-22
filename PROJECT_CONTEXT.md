# DRepScore: Project Context & Design Philosophy

## Project Overview

**DRepScore** is a Cardano governance tool designed for casual ADA holders to discover DReps (Delegated Representatives) aligned with their values through intuitive scorecards and easy delegation.

### Core Mission
Help casual ADA holders participate in Cardano governance by:
- Showing value **first** (no forced wallet connection)
- Providing simple alignment discovery (preset value tags)
- Creating an educational UX with tooltips explaining governance concepts
- Promoting both **participation** and **decentralization**

### Brand Identity
- Project handle: `$drepscore` (ADA Handle)
- Theme: Clean, modern Cardano aesthetic (blues/greens)
- Tone: Neutral and educational, not promotional

---

## Architectural Decisions

### 1. Technology Stack

**Next.js 15 with App Router**
- **Why**: Server-side rendering for fast initial loads, SEO-friendly
- **Why App Router**: Modern React patterns, built-in loading states, server components for data fetching
- **TypeScript strict mode**: Type safety prevents runtime errors with complex data transformations

**shadcn/ui + Tailwind CSS v4**
- **Why**: Accessible components out of the box, customizable, modern design system
- **Tailwind v4**: Inline CSS custom properties with `@theme inline` for dynamic theming
- **Dark mode**: Using `next-themes` for seamless light/dark switching

**MeshJS for Wallet Integration**
- **Why**: Supports all major Cardano wallets (Nami, Eternl, Typhon, etc.)
- **Philosophy**: Wallet connection is optional; users can explore without connecting

### 2. Data Architecture

**Koios API (Mainnet)**
- **Why Koios**: Free, open-source, well-maintained Cardano API
- **Endpoints used**:
  - `/drep_list` - List all registered DReps
  - `/drep_info` - Voting power, delegators, registration status
  - `/drep_metadata` - Names, descriptions, social links (CIP-119)
  - `/drep_votes` - Complete voting history
  - `/proposal_list` - Governance actions for context

**Caching Strategy**
- Server-side: `revalidate: 900-1800s` (15-30 min)
- **Why**: Balance freshness vs. API load; governance changes slowly
- **Philosophy**: Prioritize <3s page loads over real-time accuracy

**Batch Fetching**
- Load ALL DReps in batches of 50 (no arbitrary limits)
- **Why**: Users expect to see complete data, not just "top 50"
- Concurrent fetching with controlled parallelism (5 concurrent vote fetches)
- **Trade-off**: Slower initial load (~10-20s) but complete, consistent data

### 3. Data Quality Philosophy

**Progressive Loading**
- Show well-documented DReps by default
- Allow users to toggle to see all DReps
- **Why**: Prioritize quality over quantity in the default view

**Metadata Handling (CIP-119 & CIP-100)**
- Support both standard JSON and JSON-LD `{@value: "..."}` format
- Graceful degradation: Show DRep ID if name missing
- **Why**: Cardano ecosystem uses multiple metadata standards; we support both

**Missing Data Strategy**
- Default missing metrics to 0 (penalizes inactive DReps in scoring)
- **Why**: Encourages DReps to maintain metadata and participate actively
- Never hide DReps with missing data; transparency is key

---

## DRep Scoring Methodology

### Current Score Weights (as of Feb 2026)

```
DRep Score (0-100) = 
  Participation (35%) + 
  Rationale (30%) + 
  Decentralization (35%)
```

### Why These Weights?

**Removed Influence (10%) in Feb 2026**
- **Original problem**: Including voting power percentile rewarded whales
- **Contradiction**: Conflicted with decentralization goal
- **Solution**: Removed entirely; voting power now informational only

**Participation (35%)**
- **What**: Percentage of governance actions voted on
- **Why important**: Active participation is the foundation of effective representation
- **Calculation**: `votes_cast / max_votes_by_any_drep * 100`
- **Philosophy**: We compare against the most active DRep, not total proposals (which varies by DRep registration time)

**Rationale (30%)**
- **What**: Percentage of votes that include written explanations
- **Why important**: Transparency and accountability to delegators
- **Calculation**: `votes_with_rationale / total_votes * 100`
- **Flags**: Surface DReps with 0% rationale rate ("missing rationale" badge)
- **Future**: Include Catalyst votes in timeline

**Decentralization (35%)**
- **What**: Composite score of voting independence and power balance
- **Why important**: Prevents governance capture, encourages diverse perspectives
- **Components**:
  1. **Activity Score (40%)**: Participation + Rationale (redundant with main metrics, identified for future refactor)
  2. **Voting Independence (30%)**: Shannon entropy of Yes/No/Abstain distribution
     - **Why entropy**: Balanced voting suggests independent thinking, not rubber-stamping
     - Perfect balance (33/33/33) scores highest
  3. **Power Balance (30%)**: Tier-based scoring favoring moderate stake
     - <1k ADA: 5 pts (likely inactive)
     - 1k-10k: 15 pts (emerging)
     - **10k-100k: 30 pts (optimal)** ← Encourages this tier
     - 100k-1M: 25 pts (established)
     - 1M-10M: 15 pts (whale risk)
     - >10M: 5 pts (extreme concentration)
     - **Why tier-based**: Penalizes extremes, rewards healthy engagement range

### Abstention Penalty
- Excessive abstentions reduce overall effectiveness
- <25%: Mild penalty (0.5x rate)
- 25-50%: Moderate (0.75x rate)
- >50%: Severe (1x rate)
- **Philosophy**: Abstaining is valid but should be used judiciously

---

## UI/UX Design Philosophy

### Table Simplification (Feb 2026 Redesign)

**Before**: 7 columns (Score, DRep, Decentralization, Participation, Rationale, Influence, Voting Power)
**After**: 4 columns (Score, DRep, Size, Voting Power)

**Why Simplified?**
- Users felt overwhelmed by too many metrics
- Redundancy: Individual metrics already shown in score breakdown
- **Solution**: Move detailed metrics to hover tooltips on the ScoreBreakdown visual bar

### ScoreBreakdown Component
- Visual bar showing weighted components (colored segments)
- **Hover tooltip shows**:
  - Component name (e.g., "Participation")
  - Description (e.g., "Percentage of governance actions voted on")
  - Raw score (e.g., "85/100")
  - Points contributed (e.g., "30 pts" from 35% weight)
  - Weight percentage

**Philosophy**: Summary view by default, depth on demand

### Size Tier Badges
- **Small** (<10k ADA): Gray - Emerging DReps
- **Medium** (10k-1M): Green - Healthy engagement ← Optimal tier
- **Large** (1M-10M): Amber - Established but concentrated
- **Whale** (>10M): Red - High concentration warning

**Why Color-Coded?**
- Visual whale-spotting at a glance
- Encourages delegation to smaller, quality DReps
- Aligns with decentralization mission

### Filtering System

**Well-Documented Filter**
- **Criteria**: Has name AND (ticker OR description)
- **Why strict**: Encourages DReps to fill out metadata for better discoverability
- **Note**: Removed "OR has rationale" clause to keep it focused on metadata quality

**Size Filter (Dropdown)**
- Multi-select checkboxes for Small/Medium/Large/Whale
- All enabled by default
- **Use case**: Users wanting to delegate to smaller DReps can filter out whales

**Search**
- Searches across: Name, Ticker, DRep ID, Handle
- Real-time filtering, case-insensitive

### Loading & Error Handling

**Loading Skeletons**
- Show structure before data loads
- **Why**: Perceived performance > actual performance

**Error Handling**
- Koios API errors show banner (not blocking)
- **Philosophy**: Graceful degradation; never crash the app

**Target Performance**
- <3s initial page load
- All DReps loaded within 10-20s (server-side, once)
- **Vercel deployment ready** (edge functions, ISR)

---

## Key Technical Challenges & Solutions

### Challenge 1: CIP-119 Metadata Parsing
**Problem**: DRep metadata comes in multiple formats (standard JSON, JSON-LD with `@context`, nested `@value` objects)

**Solution**:
- Created `parseMetadataFields()` utility
- Checks for `@value` wrapper and extracts string
- Fallback chain: `givenName` → `name` → `"DRep [ID]"`
- Handle JSON-LD references array for social links

**Why Important**: Metadata inconsistency was breaking the UI and causing React rendering errors

### Challenge 2: Vote Count Consistency
**Problem**: DReps register at different times, so comparing vote counts directly is unfair

**Solution**:
- Use `max_votes_by_any_drep` as baseline for participation rate
- **Why**: Fair comparison; a DRep can't vote on proposals before they existed
- Calculate globally after loading all DReps for consistency

### Challenge 3: Social Link Extraction
**Problem**: Social links stored in various formats (raw URLs, labeled references, shortened links)

**Solution**:
- `extractSocialPlatform()` maps domains to platform names
- Supports: Twitter/X, GitHub, LinkedIn, Telegram, Discord, etc.
- Handles t.co, lnkd.in, linktr.ee redirects
- Filters out malformed/404 URLs

**Why Icons**: Visual scanning > reading URLs

### Challenge 4: Influence vs. Decentralization Contradiction
**Problem**: Including voting power percentile (Influence) in the score rewarded whales, contradicting the decentralization goal

**Evolution**:
1. **Initial**: Influence was 10% of score (percentile rank of voting power)
2. **Analysis**: Realized it conflicts with "promote smaller DReps" mission
3. **Solution**: Removed Influence entirely; voting power is now informational only

**Lesson**: Sometimes removing a metric improves clarity more than tweaking its weight

---

## Data Flow Architecture

```
User Request
    ↓
Next.js Page (SSR)
    ↓
lib/koios.ts: getEnrichedDReps()
    ↓
┌─────────────────────────────────┐
│ 1. Health Check                 │
│ 2. Fetch All DRep IDs           │
│ 3. Batch Process (50 per batch) │
│    - Fetch info (voting power)  │
│    - Fetch metadata (names)     │
│    - Fetch votes (history)      │
│ 4. Calculate Metrics            │
│    - Participation rate         │
│    - Rationale rate             │
│    - Decentralization score     │
│ 5. Calculate DRep Score         │
│ 6. Sort by Score DESC           │
│ 7. Filter Well-Documented       │
└─────────────────────────────────┘
    ↓
Return: { dreps, allDReps, error, totalAvailable }
    ↓
Client Component: DRepTableClient
    ↓
┌─────────────────────────────────┐
│ Client-Side Features:           │
│ - Filtering (search, toggles)   │
│ - Sorting (multi-column)        │
│ - Pagination (10 per page)      │
└─────────────────────────────────┘
    ↓
DRepTable Component (renders rows)
```

### Why Server-Side Scoring?
- **Consistency**: All DReps scored against same baseline
- **Performance**: Calculate once, cache results
- **Security**: Scoring logic not exposed to client

### Why Client-Side Filtering?
- **Instant feedback**: No server round-trip
- **Rich interactions**: Multi-filter combinations
- **State management**: Easy to reset filters

---

## Educational UX Elements

### Tooltips Everywhere
- Every metric has an info icon with explanation
- **Examples**:
  - "What is Participation Rate?"
  - "Why does Size matter?"
  - "What is a Well-Documented DRep?"

**Philosophy**: Never assume users know Cardano governance terminology

### DRep Profile Pages
- Detailed breakdown of voting history
- Voting History Chart component
- Expandable vote rationale (show more/less)
- Includes Catalyst votes in timeline (future)
- Links to proposals on Cardano explorers

### Delegation Button
- Clear CTA on profile pages
- Requires wallet connection (MeshJS)
- **Educational modals**:
  - Delegation risks (not financial advice)
  - Governance myths debunked
  - How to change delegation later

**Philosophy**: Empower, don't pressure

---

## Future Considerations & Technical Debt

### Known Issues / Future Improvements

**1. Decentralization Score Redundancy**
- Activity Score component duplicates Participation + Rationale
- **Future**: Remove Activity Score, keep only Independence + Power Balance
- Potential rename: "Decentralization" → "Independence Score"

**2. Stake Pool Operator Links**
- CIP-119 supports `paymentAddress` → can map to stake pool
- **Future**: Show "Operated by [Pool Name]" for transparency
- **Why**: DReps running stake pools have additional centralization concerns

**3. Catalyst Vote Integration**
- Currently only shows governance actions
- **Future**: Fetch and display Catalyst votes in timeline
- **Challenge**: Different API endpoint, different metadata format

**4. ADA Handle Lookup**
- Currently shows `null` for handles
- **Future**: Integrate ADA Handle resolution API
- **Why**: Handles are more memorable than DRep IDs

**5. Value Alignment Matching**
- **Planned feature**: Let users select values (Treasury Conservative, Pro-DeFi, etc.)
- Score DReps based on voting pattern alignment
- **Challenge**: Requires proposal content analysis (NLP/manual tagging)

**6. Delegator Privacy**
- Koios provides delegator count but not identities (good for privacy)
- **Trade-off**: Can't show "X users from your city" style social proof

**7. Real-Time Updates**
- Currently 15-30min cache revalidation
- **Future**: WebSocket connection for live vote notifications
- **Challenge**: Koios doesn't offer WebSockets; would need to poll

---

## Testing & Quality Assurance

### Type Safety
- TypeScript strict mode throughout
- All API responses typed (Koios types in `types/koios.ts`)
- Component props fully typed

### Error Boundaries
- Graceful degradation for missing data
- API errors don't crash the app
- **Philosophy**: Show what we can, explain what we can't

### Loading States
- Skeleton components for all async data
- Progress indicators for multi-stage loading
- **User feedback**: "Loading 2/5 batches..."

### Browser Compatibility
- Tested on Chrome, Firefox, Safari, Edge
- Mobile-responsive (Tailwind breakpoints)
- Dark mode tested in all browsers

---

## Deployment & DevOps

### Vercel Deployment
- Edge functions for server-side rendering
- ISR (Incremental Static Regeneration) for caching
- Environment variables: `NEXT_PUBLIC_KOIOS_API_URL`

### Environment Configuration
- `.env.example` shows required variables
- `.env.local` for local development (gitignored)
- **Security**: Never commit API keys (Koios is public, but principle matters)

### Git Workflow
- Feature branches for major changes
- Commit messages: Imperative mood, descriptive
- **Example**: "Simplify DRep table and remove Influence from scoring"

---

## Design Principles Summary

1. **Show Value First**: No wallet required to explore
2. **Educational > Marketing**: Explain concepts, don't sell
3. **Quality over Quantity**: Default to well-documented DReps
4. **Depth on Demand**: Simple view, detailed tooltips
5. **Decentralization First**: Encourage delegation to smaller DReps
6. **Transparency**: Show scoring logic, data sources
7. **Performance Matters**: <3s loads, smooth interactions
8. **Accessibility**: ARIA labels, keyboard navigation, screen reader support
9. **Mobile-First**: Responsive design for all screen sizes
10. **Neutral Tone**: No political bias, just data

---

## Key Metrics & Success Criteria

### Product Metrics (Planned)
- Time to first delegation (goal: <5 min from landing)
- % of users who explore without wallet connection
- Most common filter combinations
- Average time on DRep profile pages

### Technical Metrics
- Page load time (goal: <3s)
- API error rate (goal: <1%)
- Uptime (goal: 99.9%)

### Governance Impact (Long-term)
- Increase in delegations to smaller DReps
- Increase in DRep metadata completion rates
- Increase in vote rationale provision

---

## Glossary

**DRep**: Delegated Representative - a person/entity who votes on Cardano governance proposals on behalf of delegators

**Delegation**: Assigning your voting power to a DRep without giving up custody of your ADA

**Governance Action**: A proposal for changing Cardano (protocol params, treasury withdrawals, hard forks, etc.)

**Rationale**: Written explanation of why a DRep voted a certain way

**Abstain**: Choosing not to vote Yes/No (different from not voting at all)

**Whale**: Entity with extremely large ADA holdings (>10M ADA in this context)

**CIP-119**: Cardano Improvement Proposal defining DRep metadata standards

**Koios**: Open-source, community-maintained Cardano API

**Lovelace**: Smallest unit of ADA (1 ADA = 1,000,000 lovelaces)

---

## Acknowledgments

- **Koios API**: Free, reliable Cardano data
- **MeshJS**: Easy wallet integration
- **shadcn/ui**: Beautiful, accessible components
- **Cardano Community**: Feedback and governance participation

---

*Last Updated: February 16, 2026*
*Project Status: Active Development*
*Version: 0.1.0 (Pre-launch)*
