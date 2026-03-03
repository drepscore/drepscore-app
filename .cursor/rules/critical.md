---
description: Non-negotiable rules. Every rule has been violated and caused real damage.
globs: ['**/*']
alwaysApply: true
---

# Critical Rules

These override all other guidance when in conflict.

1. **Feature branches for code changes.** `git branch --show-current` before any edit. If on `main` and it's not a single-commit hotfix the user explicitly requested, create a branch first.

2. **Ship It = the task. Autonomous end-to-end deployment is mandatory.** Implementation is NOT complete until deployed and validated in production. After code compiles clean, execute this sequence WITHOUT STOPPING OR ASKING:
   1. Push branch → create PR
   2. Wait for CI — fix failures if they're yours, verify pre-existing if they're not
   3. Merge PR (use `gh api .../merge` from worktrees)
   4. Apply pending migrations via Supabase MCP `apply_migration`
   5. Monitor Railway deployment (poll commit status every 60-90s until `success`)
   6. PUT `/api/inngest` if Inngest functions were added/modified
   7. Hit new/changed endpoints on `drepscore.io` to verify 200 responses
   8. Clean up worktree
   Never say "PR created — merge when ready." Never present a deployment checklist. Just do it. Corrected 3 times.

3. **Railway, not Vercel.** Never reference `VERCEL_*` env vars, `vercel.json`, or `@vercel/*` packages. Use `BASE_URL` from `lib/constants.ts` for server-side URLs.

4. **`force-dynamic` on all runtime routes.** Any `app/**/page.tsx` or `route.ts` touching Supabase/env vars MUST export `const dynamic = 'force-dynamic'`. Railway Docker build has no env vars. NEVER use `export const revalidate` on these routes.

5. **PowerShell only.** `;` not `&&`. Multi-line strings → write to file. `git commit -F <file>`, `gh pr create --body-file <file>`. No heredocs, no `grep`/`cat`/`head`/`tail`.

6. **Feature-flag risky features.** Controversial/untested/costly → `getFeatureFlag()` (server) or `<FeatureGate>` (client). Add flag to `feature_flags` table via migration.

7. **Register every Inngest function in `serve()`.** Same commit as the function file. An unregistered function never runs.

8. **Database-first reads.** Frontend reads → Supabase via `lib/data.ts`. No direct external API calls from pages/components. Koios/Tally/SubSquare only in sync functions.

9. **No `git add -A` without review.** Targeted `git add`. Run `git diff --cached --name-only` after staging. `-A` picks up `.cursor/`, `COMMIT_MSG.txt`, `PR_BODY.md`, workspace artifacts. Always delete temp files (COMMIT_MSG.txt, PR_BODY.md) BEFORE staging, not after.

10. **Read `tasks/lessons.md` at session start.** Before doing anything, check for patterns that prevent repeat mistakes.

11. **Verify deploy — don't assume.** After merge: poll CI until green, poll Railway until deployed, hit `drepscore.io` to smoke-test. Never report completion while CI is red or deploy is pending.

12. **`.env.local` is PRODUCTION.** Any local operation hitting Supabase/Koios/external services is a production operation. Never run sync, backfills, or write-path tests from localhost without explicit user approval.

13. **Supabase MCP for migrations — never the CLI.** `npx supabase db push` has no access token locally. Use MCP `apply_migration`. Apply migrations autonomously after pushing code — never present a "before merging" checklist to the user. Corrected twice.

14. **Echo-back on complex tasks.** Before creating the first `TodoWrite` for any 3+ step task, state which of these rules apply. Active recall beats passive loading.

15. **Worktree `.git` is a file.** In git worktrees, `.git` is a file pointing to the main repo's git dir, not a directory. Write PR body files to the worktree root (e.g., `PR_BODY.md`), not inside `.git/`.
