---
description: Session protocol, continuous learning, and behavioral standards
globs: ['**/*']
alwaysApply: true
---

# Workflow Protocol

> Read `.cursor/rules/critical.md` FIRST. It overrides everything here.

## Session Start

1. Read `tasks/lessons.md` for patterns from prior sessions
2. Read `tasks/todo.md` for any in-progress work
3. `git branch --show-current` + `git status` — orient to current state
4. For multi-step tasks, run `/start` for a full session setup

## Planning (3+ step tasks)

1. Check lessons for patterns that appeared 2+ times — propose promoting to a rule
2. First-principles checklist:
   - What's the actual problem? (Diagnose before solving)
   - What external APIs/libraries? (Research before building)
   - What's the validation strategy? (Define checkpoints)
   - What does the 6-month version look like? (Build toward it)
   - Could this cause rework? (Flag risks)
3. Write plan to `.cursor/plans/<feature>.plan.md` with goals, phases, validation gates
4. Commit plan to `main` before creating a worktree
5. Large features: 15-20 changes per session, single theme, independently deployable

## Build Phase

- **Branch check (step 0)**: `git branch --show-current`. On `main` and not a hotfix → STOP and branch first
- **Research before build**: New library/API → research summary before implementation
- **Analytics inline**: Every new user interaction gets a PostHog event in the same diff (see `analytics.mdc`)
- **No orphaned components**: Every component created must be imported and rendered in the same commit
- **Deprecation audit**: When removing a system, search for all consumers of its data and state — not just imports

## Continuous Learning

- **On correction**: Immediately append to `tasks/lessons.md` (date, pattern, context, takeaway)
- **On surprise/rework/debugging (2+ attempts)**: Log the pattern
- **Rule promotion**: 2+ occurrences or permanent architectural decision → propose a cursor rule

## Hotfix Protocol

When the user says "hotfix": deploy autonomously end-to-end. Create todos for ALL phases before writing code. Fix on `main` → commit → push → monitor CI → monitor deploy → validate → report. Run `/hotfix` for the full procedure. Never report success before post-deploy validation passes.

## Shell Compatibility (PowerShell — mandatory)

| Task | Correct | Wrong |
|------|---------|-------|
| Chain commands | `cmd1 ; cmd2` | `cmd1 && cmd2` |
| Multi-line commit | Write to `COMMIT_MSG.txt`, `git commit -F COMMIT_MSG.txt`, then `Remove-Item COMMIT_MSG.txt` | Heredocs, `.git/COMMIT_MSG` |
| Multi-line PR body | Write to `PR_BODY.md`, `--body-file PR_BODY.md`, then `Remove-Item PR_BODY.md` | Inline `--body`, `.git/PR_BODY.md` |
| Search/Read files | Grep/Read tools | `grep`/`cat`/`head`/`tail` |

## Anti-Patterns

- Do NOT create status report files in project root — use `tasks/todo.md`
- Do NOT proceed past a failed or unvalidated step
- Do NOT build features that bypass Supabase
- Do NOT assume library/API behavior — verify first
- Do NOT use `git add -A` without reviewing staged files

## Mode Awareness

If the user's message is a question (not a change request), suggest Ask mode for cost efficiency.
