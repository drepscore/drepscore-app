---
description: Deployment pipeline — migrations, Vercel, sync triggers, validation
globs: ["supabase/**", "app/api/sync/**", "vercel.json", "scripts/**"]
alwaysApply: false
---

# Deployment Pipeline

## Environment
- **Supabase project**: `pbfprhbaayvcrxokgicr` (URL: https://pbfprhbaayvcrxokgicr.supabase.co)
- **Vercel project**: `drepscore-app` in team `drepscores-projects` (URL: https://drepscore-app.vercel.app)
- **Cron secret**: stored in `.env.local` as `CRON_SECRET`
- **Vercel CLI**: authenticated as `drepscore`, use `npx vercel` commands
- **Supabase CLI**: initialized, use `npx supabase` commands (requires `SUPABASE_ACCESS_TOKEN` env var)

## MCP Configuration — DO NOT MODIFY
`.cursor/mcp.json` is gitignored and contains secrets. **NEVER overwrite, recreate, or edit this file.**
- **Supabase MCP**: Local stdio server with access token (bypasses OAuth)
- **Vercel MCP**: `mcp-remote` stdio proxy (localhost OAuth callback — bypasses `cursor://` handler)
- Both use `cmd /c npx` prefix (Windows requirement)
- If MCPs disconnect, diagnose via Cursor Settings > MCP. Do not touch the file.

## Autonomous Deployment Monitoring
Available tooling for end-to-end deploy management:
- `npx vercel ls` — list recent deployments + status (Ready/Error/Building)
- `npx vercel inspect <url> --logs` — full build output for failed deploys
- `npx vercel redeploy <url>` — retrigger a deployment
- `npx vercel env ls` / `npx vercel env add` — manage env vars
- Vercel MCP tools — list_deployments, get_deployment, get_deployment_build_logs, get_runtime_logs
- Supabase MCP tools — execute_sql, apply_migration, list_tables, get_logs

## Migration Workflow
1. Write migration SQL to `supabase/migrations/NNN_description.sql`
2. Apply: `npx supabase db push` (or `npx supabase migration up`)
3. **Validate immediately**: query Supabase to confirm schema change took effect
   - Check table/column exists
   - Verify constraints and indexes
   - If migration creates views, query them for expected results
4. Only proceed to application code after migration is validated

### Migration Naming Convention
- Sequential 3-digit prefix: `001_`, `002_`, etc.
- Descriptive snake_case suffix: `020_feature_name.sql`
- Current latest: `019_data_infra.sql`

### Direct SQL Execution (Alternative)
When the Supabase CLI isn't available, run SQL via the Supabase Management API:
```bash
curl -X POST "https://pbfprhbaayvcrxokgicr.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY"
```

## Deployment Workflow
1. Code changes committed and pushed
2. Vercel auto-deploys from git push (check with `npx vercel ls`)
3. **REQUIRED**: Wait for deploy, then verify build succeeded: `npx vercel inspect <deployment-url>`
4. If status is not "Ready", inspect logs, fix the issue, and re-push — do NOT mark deploy as complete until status is "Ready"
5. Check logs if issues: `npx vercel logs <deployment-url>`

### Pre-Push Checklist
- Run `git status` on any new file's directory — if the directory is untracked (`??`), ensure all required siblings are staged
- Verify `npm run build` passes locally before pushing (pre-push hook should catch this, but don't rely on it alone)

## Post-Deploy Sync Trigger
After deploying changes that affect data:
```bash
# Trigger fast sync
curl -s "https://drepscore-app.vercel.app/api/sync/fast?secret=$CRON_SECRET"

# Trigger full sync
curl -s "https://drepscore-app.vercel.app/api/sync?secret=$CRON_SECRET"
```

## Post-Deploy Validation
1. **Schema**: Confirm new tables/columns exist via Supabase query
2. **Sync**: Trigger sync, validate first 5 results (don't wait for full completion)
3. **UI**: Use browser-use to check key pages load correctly
4. **Integrity**: Check admin integrity dashboard at `/admin/integrity`

## Fast Validation Principle
For ANY long-running operation (sync, backfill, migration):
1. Start the operation
2. After 30-60 seconds, check first results
3. If results look wrong → stop and fix before wasting the full cycle
4. Only let it run to completion once early validation passes
5. Spot-check final results after completion

## Sync Scheduling
### Inngest (durable, retryable)
- Proposals sync: `*/30 * * * *` — managed by Inngest cron (see `inngest/functions/sync-proposals.ts`)
- Future: dreps, votes, secondary, slow will migrate to Inngest (Phase 2)

### Vercel Crons (legacy, defined in `vercel.json`)
- DReps sync: `0 */6 * * *`
- Votes sync: `15 */6 * * *`
- Secondary sync: `30 */6 * * *`
- Slow sync: `0 4 * * *` (daily)
- Integrity alerts: `0 */6 * * *`
- Inbox alerts: `0 3,9,15,21 * * *`
- API health alerts: `*/15 * * * *`

## Environment Variables
Managed in Vercel dashboard. Key vars:
- `KOIOS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`
- `CRON_SECRET`, `SESSION_SECRET`, `ADMIN_WALLETS`
- `ANTHROPIC_API_KEY` (AI summaries), `POSTHOG_PERSONAL_API_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (push notifications)
