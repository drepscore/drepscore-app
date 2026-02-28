---
description: Legacy deployment notes — see deploy.md for the active deployment pipeline
globs: ["supabase/**"]
alwaysApply: false
---

# Deployment Notes (Legacy)

> **The active deployment pipeline is in `.cursor/rules/deploy.md` (alwaysApply: true).**
> This file contains supplementary reference only.

## Migration Workflow
1. Write migration SQL to `supabase/migrations/NNN_description.sql`
2. Apply via Supabase MCP `apply_migration`
3. Validate immediately: query Supabase to confirm schema change took effect
4. Only proceed to application code after migration is validated

### Direct SQL Execution (Alternative)
When the Supabase CLI isn't available, use the Supabase MCP `execute_sql` tool.

## Supabase Project
- **Project ref**: `pbfprhbaayvcrxokgicr`
- **URL**: `https://pbfprhbaayvcrxokgicr.supabase.co`
