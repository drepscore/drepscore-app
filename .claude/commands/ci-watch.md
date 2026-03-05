Monitor the CI pipeline and Railway deployment until fully validated.

## CI Monitoring

```bash
gh pr checks <pr-number> --watch
# If failed:
gh run list --branch <branch> --limit 1 --json databaseId --jq '.[0].databaseId'
gh run view <run-id> --log-failed
```

Branch protection requires ALL of: `type-check`, `lint`, `test`, `build`.
If CI fails: read the error, fix, commit, push. Max 3 retries before escalating.

## Railway Deploy Monitoring (after merge to main)

Railway auto-deploys on push to main. Docker build takes ~5 min.
Poll CI on main every 60s until `success`. CI green does NOT mean deployed — budget 5 min after CI passes.

## Post-Deploy Validation (ALL mandatory)

1. Health check: `curl -s https://drepscore.io/api/health` — expect 200
2. Inngest sync: `curl -X PUT https://drepscore.io/api/inngest`
3. Smoke tests: `npm run smoke-test`
4. Feature-specific: hit the changed page/endpoint on `drepscore.io`

If ANY check fails: investigate, fix, push follow-up commit. Never report "done" until all 4 pass.
