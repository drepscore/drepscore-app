#!/usr/bin/env bash
# check-gh-lane.sh
#
# PreToolUse gate for the Bash tool. Blocks raw `gh` invocations so that every
# GitHub access in this repo goes through the governed lane:
#   bin/gh.sh <args>        — GitHub App installation token (the agent API lane)
#   npm run gh -- <args>    — the same wrapper via npm
#
# Raw `gh` resolves to whatever account is active in the local keyring, which
# may be a personal PAT (e.g. tim-dd). AGENTS.md ("Two lanes for git/GitHub")
# is explicit: agent GitHub API access goes through bin/gh.sh, minted from the
# governada-agent GitHub App. The personal lane is never the agent lane.
#
# Detection: `gh` is flagged only when it sits at a command position — at the
# start, or after a shell separator (; & | && || ( ` {), after optional
# launcher keywords (sudo, env, xargs, do, then, ...), and after optional
# VAR=value assignments — and is followed by whitespace or end of command.
# `bin/gh.sh` and `npm run gh` never place `gh` at a command position, so they
# pass; `gh` as a substring (github, paths, quoted strings) never matches.
#
# Exit 0 -> allow. Exit 2 -> deny (Claude Code surfaces stderr to the agent).

set -uo pipefail

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Newlines and carriage returns are command separators in shell; map them to ';'
# so a raw `gh` starting a later line is still seen at a command boundary.
gh_lane_re='(^|[;&|(`{]|&&|\|\|)[[:space:]]*((sudo|xargs|nohup|timeout|time|exec|command|builtin|env|do|then|else)[[:space:]]+)*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*gh([[:space:]]|$)'

if printf '%s' "$COMMAND" | tr '\r\n' ';;' | grep -Eq "$gh_lane_re"; then
  cat >&2 <<'MSG'
BLOCKED: raw `gh` is not permitted in this repo.

All agent GitHub access goes through the governed GitHub App lane:
  bin/gh.sh <args>        e.g.  bin/gh.sh pr list --state open
  npm run gh -- <args>    e.g.  npm run gh -- pr view 123

Raw `gh` resolves to whatever account is active in the local keyring (a
personal PAT such as tim-dd), which is never the agent lane. See AGENTS.md
"Two lanes for git/GitHub".

  Merges:        npm run github:merge
  Branch pushes: bin/git-push.sh  (or npm run git:push -- ...)
MSG
  exit 2
fi

exit 0
