Now implement precisely as planned, in full.

## Pre-Flight

Before writing any code:
1. Re-read the plan — confirm all validation gates are defined
2. If the plan involves a new library/API: verify you've completed the research phase (exact calls, response shapes, gotchas documented)
3. If the plan involves a database migration: write and apply the migration FIRST, validate schema change, then proceed to application code

## Implementation Requirements:

- Write elegant, minimal, modular code.
- Adhere strictly to existing code patterns, conventions, and best practices.
- All data reads go through Supabase (`lib/data.ts`). No new direct Koios-to-frontend paths.
- As you implement each step:
  - Update the markdown tracking document with emoji status and overall progress percentage dynamically.
  - **At each validation gate**: stop, verify results, report findings. Do NOT proceed past a failed or unvalidated gate.
  - For long-running operations (sync, migration, backfill): check first 3-5 results within 30-60 seconds before letting it complete.

## Post-Implementation

- Verify the feature works end-to-end (query results, curl output, or UI check)
- Check for regressions: did existing features break?
- Update `tasks/lessons.md` if anything was learned during the build
- No stale artifacts: remove any debug logging, temp files, or status reports