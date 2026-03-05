Initialize the session properly before writing any code.

## Steps

1. **Orient**: `git branch --show-current && git status && git log --oneline -5`
2. **Read lessons**: Read `.cursor/tasks/lessons.md`. If a pattern appeared 2+ times without promotion, propose promoting it now
3. **Check for in-progress work**: Read `.cursor/tasks/todo.md` if it exists
4. **Git hygiene**: `git stash list && git worktree list` — flag stale stashes and orphaned worktrees
5. **Echo-back critical rules**: Before creating the first todo list, state which rules from CLAUDE.md apply to this task
6. **Create task list WITH deploy steps**: Last items MUST be the deploy pipeline (commit → PR → CI → merge → deploy → validate). A feature not in production is not done.
