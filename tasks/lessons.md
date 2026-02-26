# Lessons Learned

Patterns, mistakes, and architectural decisions captured during development. Reviewed at session start. Patterns appearing 2+ times get promoted to cursor rules.

---

## Architecture

### 2026-02-25: Database-first, always
**Pattern**: Started with direct Koios API calls from frontend (server components with `revalidate: 900`). This caused slow page loads (10-20s), rate limit anxiety, and no foundation for features needing persistent state (score history, polls, sync logging). Retrofitting Supabase created a confusing dual data layer (`lib/data.ts` + `utils/koios.ts` + `lib/koios.ts`).
**Takeaway**: When building a dashboard over a slow, rate-limited external API, always start with your own database. Koios → Supabase sync → Next.js reads. No exceptions.
**Promoted to rule**: Yes — `architecture.md` and `workflow.md` both encode database-first principle.

### 2026-02-25: Bulk endpoints over per-entity calls
**Pattern**: Initial sync made ~250 per-DRep API calls to `/drep_votes`. Switching to bulk `/vote_list` endpoint reduced to ~19 paginated calls (75% reduction in API calls).
**Takeaway**: Always check if a bulk endpoint exists before building per-entity fetch loops. Read the API docs first.

### 2026-02-25: Research APIs before implementing
**Pattern**: MeshJS wallet signing required ~10 fix commits (hex encoding, bech32 conversion, CIP-30 wrapper bypass). All discoverable with upfront research.
**Takeaway**: For any new library/API integration, produce a research summary of exact calls, response shapes, and known gotchas BEFORE writing code.
**Promoted to rule**: Yes — `workflow.md` requires research phase before build.

## Process

### 2026-02-25: Fast validation, not passive waiting
**Pattern**: During data integrity work, time was spent waiting on syncs without checking intermediate results. A silent error was initially missed because early results weren't validated.
**Takeaway**: For any long-running operation (sync, migration, backfill): start it, check first 3-5 results within 30-60 seconds, fix issues before letting it complete. Never wait passively.
**Promoted to rule**: Yes — `workflow.md` and `deployment.md` both encode fast validation principle.

### 2026-02-25: One-pass features, not fix-after-ship
**Pattern**: Almost every `feat:` commit was followed by 2-5 `fix:` commits. Wallet auth had 10+ fixes. UX polish needed a Round 2.
**Takeaway**: Invest more time in upfront research and edge case analysis. Target zero fix commits after a feature commit. If UX changes are needed, gather all feedback before implementation, not incrementally.

### 2026-02-25: No stale documentation artifacts
**Pattern**: 9 status report files accumulated in project root (`*_STATUS_REPORT.md`, `*_FIX_STATUS.md`). All point-in-time artifacts that became stale immediately. Meanwhile, persistent context docs (`PROJECT_CONTEXT.md`) went out of date.
**Takeaway**: Use `tasks/todo.md` for in-progress tracking, `.cursor/rules/` for persistent context. Never create root-level status reports.
**Promoted to rule**: Yes — `workflow.md` prohibits root status report files.

### 2026-02-25: Advocate for the robust path, not the simple one
**Pattern**: Repeatedly chose the simpler approach (direct API calls, inline browser testing) over the more robust one (Supabase caching, Cloud Agents for E2E validation). When both a simple and robust path exist, defaulted to simple and let the user discover the need for robust later — causing rework.
**Takeaway**: When there are two valid approaches, default to recommending the one with higher long-term leverage. Let the user choose to simplify, not the other way around. Proactively surface tools, infrastructure, and architectural patterns that would materially improve the project, even if not explicitly asked.
**Promoted to rule**: Yes — `workflow.md` updated with proactive advocacy protocol.

### 2026-02-25: Proactively scan for tooling and capability improvements
**Pattern**: Didn't recommend Cloud Agents, Supabase MCP, or Vercel MCP until the user initiated a retrospective. These tools were available and would have saved time.
**Takeaway**: Periodically (during planning or at milestones) ask: "Are there new tools, MCPs, or platform features that would improve our workflow?" Don't wait for the user to discover them.
**Promoted to rule**: Yes — `workflow.md` updated with proactive advocacy protocol.

## Scoring

### 2026-02-25: Influence metric conflicted with mission
**Pattern**: Including voting power percentile (Influence at 10%) in the DRep Score rewarded whales, directly contradicting the decentralization mission.
**Takeaway**: When adding a new metric, validate it against the project's core mission before implementation. "Does rewarding X align with our values?"

### 2026-02-25: Scoring model evolved 3 times (v1 → v2 → v3)
**Pattern**: Each revision required migrations, multi-file changes, and recalculation. Some churn was unavoidable (learning from real data), but some was predictable.
**Takeaway**: Spend more time on scoring design upfront. Use simulation/back-testing before committing to a model. When in doubt, prefer simpler models that are easier to evolve.

---

*Last updated: 2026-02-25*
*Review this file at the start of every session.*
