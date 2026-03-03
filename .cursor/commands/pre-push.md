# Pre-Push Checklist

Run before pushing to verify the code is ready. Fix any issues found before proceeding.

## 1. Type check

```powershell
npx tsc --noEmit
```

## 2. Lint

```powershell
npm run lint
```

## 3. Tests (if relevant to changes)

```powershell
npx vitest run
```

## 4. Force-dynamic audit

Any new or modified `app/` file importing `@/lib/supabase` or `@/lib/data` MUST have `export const dynamic = 'force-dynamic'` (unless it's a `route.ts`). Without it, Railway's Docker build crashes.

```powershell
rg "import.*from.*@/lib/(supabase|data)" app/ --files-with-matches
```

Cross-check each result for `export const dynamic = 'force-dynamic'`.

## 5. Staged files review

```powershell
git diff --cached --name-only
```

Verify: no `.cursor/`, no `commit-msg.txt`, no `.env*`, no workspace artifacts staged.

## 6. New Inngest functions

If you created an Inngest function, verify it's registered in `app/api/inngest/route.ts` `serve()` array.
