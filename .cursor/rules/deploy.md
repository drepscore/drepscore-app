---
description: Autonomous deployment pipeline — the full deploy-validate-rollback cycle
globs: []
alwaysApply: true
---

# Deployment Pipeline

When the user says "deploy" or you determine a deploy is needed, execute this entire sequence autonomously. Do NOT ask for confirmation at each step — run end-to-end and report results.

## Pre-flight Checks (~30s)

Run all three in sequence. If ANY fails, fix the code and re-run. Do not proceed until all green.

```
npm run lint
npm run type-check
npm test
```

If lint/type-check errors are in YOUR changes, fix them. If they're pre-existing, proceed.

## Supabase Migrations (if needed)

1. Check for pending migration files in `supabase/migrations/`
2. Apply via Supabase MCP `apply_migration`
3. Verify with `execute_sql` — confirm the schema change took effect
4. Only proceed after migration is confirmed

### Migration Naming Convention
- Sequential 3-digit prefix: `001_`, `002_`, etc.
- Descriptive snake_case suffix: `020_feature_name.sql`

## Commit + Push

1. `git add` relevant changes (never stage `.env*`, `credentials`, or secrets)
2. Commit with descriptive message following repo style
3. `git push origin main`

## Monitor CI (~2-3 min)

1. `gh run list --limit 1` — get the run ID
2. `gh run watch <run-id>` — wait for completion
3. If CI fails:
   - `gh run view <run-id> --log-failed` — read the error
   - Fix the issue, commit, push again
   - Re-monitor CI
   - Max 3 retry attempts before escalating to user

## Monitor Railway Deployment (~1-2 min)

- Railway auto-deploys on push to main
- Check Railway dashboard Deployments tab for build status
- Wait for deployment to show "Active"
- If deploy fails: check build logs and deploy logs in Railway dashboard, fix, push again

## Post-deploy Validation (~15s)

Run ALL checks. If ANY fails, rollback and investigate.

### Health Check
```
GET https://drepscore.io/api/health → expect 200, status != "error"
```

### Inngest Sync
```
PUT https://drepscore.io/api/inngest → expect 200
```
This registers all 8 Inngest functions with Inngest Cloud.

### Smoke Tests
```
npm run smoke-test
```
This runs `scripts/smoke-test.ts` which checks:
- `/api/health` — 200, no error status
- `/api/dreps` — 200, non-empty dreps array
- `/api/v1/dreps` — 200, data array + meta.api_version
- `/api/v1/governance/health` — 200, score_distribution present
- `/api/auth/nonce` — 200, nonce + signature

### On Failure
- In Railway dashboard, click "Rollback" on the previous healthy deployment
- Investigate root cause, fix, restart from Pre-flight Checks

## Report

After successful deploy, provide a concise summary:
- What changed (1-2 sentences)
- CI result (pass/fail, duration)
- Deploy time
- Validation results (health, Inngest sync, smoke tests)
- Update `.cursor/tasks/lessons.md` if anything unexpected occurred

---

## Environment

- **Supabase project**: `pbfprhbaayvcrxokgicr`
- **Production URL**: `https://drepscore.io`
- **Cron secret**: stored in `.env.local` as `CRON_SECRET`

### MCP Configuration — DO NOT MODIFY
`.cursor/mcp.json` is gitignored and contains secrets. **NEVER overwrite, recreate, or edit this file.**

### Inngest
- All 8 background jobs run via Inngest Cloud
- After every deploy: `PUT https://drepscore.io/api/inngest` to sync functions
- `INNGEST_SERVE_HOST=https://drepscore.io` ensures SDK advertises production URL

### Environment Variables
Key vars (managed in hosting dashboard):
- `KOIOS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`
- `CRON_SECRET`, `SESSION_SECRET`, `ADMIN_WALLETS`
- `ANTHROPIC_API_KEY`, `POSTHOG_PERSONAL_API_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SERVE_HOST`
- `NEXT_PUBLIC_SITE_URL=https://drepscore.io`
