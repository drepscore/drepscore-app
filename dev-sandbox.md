# Dev Sandbox PR — Do Not Merge

This PR exists to keep a Supabase preview branch alive as the dev DB target
for local Horizon 1 development. **It is never merged.**

## Purpose

Per `governada-brain/decisions/sandbox-dev-target.md`, every worktree's
`npm run env:run -- npm run dev` points at this PR's Supabase preview branch
instead of a standing staging project. Preview branches are recreated from
`supabase/migrations/` so schema drift is impossible by construction.

## Operational notes

- **Never merge this PR.** Closing or merging it terminates the preview branch.
- **Refresh data on demand** via Supabase MCP `rebase_branch` (or CLI). The
  branch's project ref and credentials should remain stable across rebases.
- **Credentials** live in 1Password item `governada-sandbox-environment`
  (`Governada-Agent` vault). On preview-branch regeneration, update that item.
- **`DO NOT MERGE` label** is applied as defense-in-depth (the risk-tiered
  auto-merge classifier already won't touch placeholder PRs).

## Why a long-lived PR

Supabase preview branches are tied to PR lifecycle. Keeping one PR perma-open
keeps one preview branch perma-alive — the leanest mechanism for "a stable,
drift-free remote dev DB" without a standing Supabase project. See the
decision note in `governada-brain/` for the full rationale and the H1
invariants this preserves.
