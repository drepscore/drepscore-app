# Session Start

Initialize the session properly before writing any code.

## 1. Orient

```powershell
git branch --show-current
git status
git log --oneline -5
```

## 2. Read lessons

Read `.cursor/tasks/lessons.md`. If a pattern has appeared 2+ times and hasn't been promoted to a rule, propose promoting it now.

## 3. Check for in-progress work

Read `.cursor/tasks/todo.md` if it exists. Resume where the last session left off.

## 4. Git hygiene

```powershell
git stash list
git worktree list
```

Stashes older than this session: either branch them or drop them. Orphaned worktrees: remove them.

## 5. Echo-back critical rules

Before creating the first todo list, state which rules from `critical.md` apply to this task. This transforms passive rule loading into active recall. Example:

> "This task involves a new user-facing feature, so rules 1 (feature branch), 2 (ship it), 4 (force-dynamic), 6 (feature flag), and 8 (database-first) apply."

## 6. Create task list WITH deploy steps

When creating todos, the LAST items MUST be the deploy pipeline. Use the `/ship` command for the exact todo template. These are not optional cleanup — they ARE the session.

Example structure:

```
- impl-1       → First implementation task
- impl-2       → Second implementation task
- impl-3       → Third implementation task
- ship-commit  → Stage, commit, push
- ship-pr      → Create PR
- ship-ci      → Monitor CI until green
- ship-merge   → Merge PR
- ship-deploy  → Monitor Railway deploy
- ship-validate → Post-deploy validation
```

A feature not in production is not done.
