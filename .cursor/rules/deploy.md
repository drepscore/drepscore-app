---
description: Deploy recipes and environment config — loaded when working on deploy-related files
globs:
  - app/api/**
  - supabase/migrations/**
  - inngest/**
alwaysApply: false
---

# Deploy Recipes

Procedural deploy steps live in commands: `/ship`, `/hotfix`, `/ci-watch`, `/pre-push`. This file is reference material loaded contextually.

## Supabase Migrations

Always use Supabase MCP `apply_migration` — never the CLI. The MCP authenticates through Cursor's integration.

1. Check pending files in `supabase/migrations/`
2. Read the SQL content
3. Apply via MCP `apply_migration` (name: snake_case, query: full SQL)
4. Verify with MCP `execute_sql`

Naming: sequential 3-digit prefix + descriptive snake_case: `020_feature_name.sql`

## Release Gating

**Direct to main (hotfix):** Single-commit bug fixes, docs, config, dependency patches.

**PR required:** Migrations, API contract changes, auth/security, scoring model, new features, 10+ files, Inngest schedule changes.

## Railway Build Parity

Railway's Docker build has NO runtime env vars during `next build`. Local builds with `.env.local` are NOT equivalent. Always verify Railway deploy succeeds.

Any `app/` file importing `@/lib/supabase` (directly or via `@/lib/data`) that is NOT a `route.ts` MUST have `export const dynamic = 'force-dynamic'`.

## Environment

- **Supabase project**: `pbfprhbaayvcrxokgicr`
- **Production URL**: `https://drepscore.io`
- **GitHub CLI**: Always `gh auth switch --user drepscore` before `gh` API calls. `tim-dd` account lacks collaborator perms.
- **MCP config** (`.cursor/mcp.json`): gitignored, contains secrets — NEVER overwrite
- **Inngest**: PUT `https://drepscore.io/api/inngest` after every deploy to sync functions. 20 durable functions total (see `architecture.md`)
- **Post-deploy autonomous**: After any deploy, autonomously: (1) apply pending migrations via MCP, (2) PUT Inngest, (3) trigger new compute functions if they need initial data, (4) verify results. Do not ask the user for permission on these steps
- **INNGEST_SERVE_HOST**: `https://drepscore.io`

## Key Env Vars (managed in Railway dashboard)

`KOIOS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `SESSION_SECRET`, `ADMIN_WALLETS`, `ANTHROPIC_API_KEY`, `POSTHOG_PERSONAL_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `NEXT_PUBLIC_SITE_URL=https://drepscore.io`
