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

### 2026-02-25: Always build-check before pushing
**Pattern**: Pushed code changes twice without running `next build` locally. Both times hit type errors that only surfaced in Vercel's build (missing variable alias, implicit `any` from closure capture). Required two fix commits and two failed deploys.
**Takeaway**: Run `npx next build --webpack` before every `git push`. Also monitor deployment status after pushing — environment-specific failures (env vars, edge runtime) can't be caught locally.
**Promoted to rule**: Yes — `workflow.md` updated with Deployment Protocol (pre-push build check + post-push monitoring).

## Scoring

### 2026-02-25: Influence metric conflicted with mission
**Pattern**: Including voting power percentile (Influence at 10%) in the DRep Score rewarded whales, directly contradicting the decentralization mission.
**Takeaway**: When adding a new metric, validate it against the project's core mission before implementation. "Does rewarding X align with our values?"

### 2026-02-25: Scoring model evolved 3 times (v1 → v2 → v3)
**Pattern**: Each revision required migrations, multi-file changes, and recalculation. Some churn was unavoidable (learning from real data), but some was predictable.
**Takeaway**: Spend more time on scoring design upfront. Use simulation/back-testing before committing to a model. When in doubt, prefer simpler models that are easier to evolve.

---

### 2026-02-26: Admin bypass on all gated features
**Pattern**: The `/dashboard/inbox` page gated on `ownDRepId` (wallet must be a registered DRep). Admin wallets that aren't registered DReps were blocked. The API had zero authorization.
**Takeaway**: Every gated feature must check `isAdmin` as a bypass. Admin gets a DRep selector dropdown instead of being blocked. Apply this pattern to all new gated pages by default.

---

### 2026-02-26: Vitest 4 broken on Node 24 — use Vitest 3.x
**Pattern**: Vitest 4.0.18 fails with "No test suite found" / "Vitest failed to find the current suite" on Node v24.12.0. The `describe`/`it`/`test` functions from the import don't register with the runner. Downgrading to Vitest 3.2.4 resolved immediately.
**Takeaway**: Pin to Vitest 3.x until Vitest 4 stabilizes. Check major version compatibility before upgrading test frameworks.

### 2026-02-26: Cron secrets must never live in committed files
**Pattern**: `vercel.json` had `CRON_SECRET` hardcoded in cron path URLs and committed to git. Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` header on cron invocations — no need to put the secret in the URL.
**Takeaway**: Validate cron auth via `request.headers.get('authorization')`, not query parameters. Rotate any secret that has ever been committed to git history.

### 2026-02-26: Separate Supabase projects per environment from the start
**Pattern**: Single Supabase project used for all environments. Preview deployments hit production data. Any mistake on a feature branch could corrupt production.
**Takeaway**: Create a staging Supabase project (free tier) on day one. Configure Vercel Preview env vars to point to staging. Production data should only be touched by the `main` branch.

## Delegation / Wallet Integration

### 2026-02-26: Stake registration is required before vote delegation
**Pattern**: CIP-1694 vote delegation uses the same stake key mechanism as pool delegation. If a user's stake key isn't registered (new wallet, never staked), `voteDelegationCertificate` will fail silently. MeshJS doesn't auto-detect this.
**Takeaway**: Always check stake registration via Koios `/account_info` before building delegation txs. Chain `registerStakeCertificate` in the same tx if needed. Inform user about the 2 ADA refundable deposit.

### 2026-02-26: Nami standalone has no CIP-1694 governance support
**Pattern**: Nami (~200k installs, largest Cardano wallet by install count) was merged into Lace because it lacks CIP-1694 governance support. Migration became mandatory after Chang hard fork. Users still on standalone Nami will hit opaque errors on governance transactions.
**Takeaway**: Proactively detect wallet governance capability by checking `window.cardano[name].supportedExtensions` for CIP-95. For Nami specifically, direct users to migrate to Lace (which includes Nami mode).

### 2026-02-26: Wallet phase tracking requires splitting build/sign/submit
**Pattern**: Original delegation hook set `'signing'` phase before calling `delegateToDRep()`, but building/signing/submitting all happened inside that function. User never saw accurate phase transitions.
**Takeaway**: For multi-step wallet interactions, use phase callbacks (`onPhase`) so the calling code can track progress accurately. Don't conflate transaction building with wallet signing.

---

*Last updated: 2026-02-26*
*Review this file at the start of every session.*
