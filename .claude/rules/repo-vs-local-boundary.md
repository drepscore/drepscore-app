# Repo vs. Local Agent-Infra Boundary

This repo commits agent infra deliberately so the safety contract is the same
for any agent (and any future contributor) working in it. Everything in this
category is reviewable, hook-enforced, and version-controlled:

- Hooks (`.claude/hooks/`)
- Governed wrappers (`bin/gh.sh`, `bin/git-push.sh`, `bin/supabase*-mcp.sh`,
  `bin/betterstack.sh`, `bin/sentry.sh`)
- MCP registry (`.mcp.json`)
- Shared permissions and hook wiring (`.claude/settings.json`)
- Project policy (`AGENTS.md`, `.claude/rules/`)

What stays **local** (not committed):

- `.claude/settings.local.json` — per-machine permission overrides; Claude
  Code's convention is that `.local.json` is the user's personal layer. It is
  in `.gitignore` and must not be re-tracked.
- `.env.local` — secrets-only file. The committed `.env.local.refs` holds the
  1Password op-refs that resolve secrets at runtime.
- The agent runtime file at `${HOME}/dev/agent-runtime/env/governada-agent.env`
  (or `$OP_AGENT_RUNTIME_FILE`) — machine-specific 1Password service-account
  token. Wrapper defaults are `$HOME`-relative so a second machine works
  without code changes.
- Worktrees, snapshots, lock files (already gitignored).

## Why this split

The safety guarantees this repo carries — hook-gated migration apply, gh-lane
enforcement, push protection, MCP allow/deny — need to hold for any agent that
opens the repo, not just the one that set them up. Committing the wrappers,
hooks, settings, and MCP registry is what gives that. The local layer is what
is genuinely per-machine: personal permission tweaks, secret material,
absolute paths.

## How to keep the boundary clean

- Never commit a file that hardcodes an absolute personal path. Use `$HOME`
  (or an env override like `$OP_AGENT_RUNTIME_FILE`) instead.
- Never commit a secret. Use an `op://` reference in `.env.local.refs` and
  resolve at runtime via the agent runtime token.
- Never re-add `.claude/settings.local.json` to git — that file's whole purpose
  is to be the per-machine override Claude Code merges _on top of_ the shared
  `settings.json`. Tracking it collapses the two layers.

A boundary defect ships when a committed file holds a per-machine path or
secret. The fix is always to split: the path out via `$HOME` or env; the
secret out via an op-ref.
