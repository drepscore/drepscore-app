---
description: Session protocol, continuous learning, and validation standards
globs: ["**/*"]
alwaysApply: true
---

# DRepScore Workflow Protocol

## Session Start
1. Read `tasks/lessons.md` for relevant patterns before doing anything
2. Read `tasks/todo.md` for any in-progress work from prior sessions
3. Orient to current state: check git status, recent commits, any open PRs

## Planning Phase (Required for 3+ step tasks)
1. Review `tasks/lessons.md` for patterns that appeared 2+ times — propose promoting to cursor rule before proceeding
2. Apply first-principles checklist (see below)
3. Write a plan document to `.cursor/plans/<feature-name>.plan.md` with: goals, approach, phases, affected files/systems, validation gates, and analytics considerations
4. Write actionable checklist items to `tasks/todo.md`
5. Every plan must include explicit **validation gates**: "After step N, validate X before proceeding"
6. **Commit the plan to `main` before creating a worktree.** This is mandatory — the plan must be in the repo so the new worktree conversation can read it. Use commit message: `docs: plan for <feature>`

### First-Principles Checklist
Before any plan is finalized, answer:
- **What's the actual problem?** → If the user proposes a solution, diagnose the underlying constraint first. The simplest fix is often the platform's own feature, not an external tool.
- **What's the cost?** → For any decision involving paid tools, infra changes, or migrations, do the cost math before building. What plan, what budget, what does the current platform offer?
- Will this feature need persistent storage? → Start with DB migration, not frontend
- What external APIs/libraries are involved? → Research their behavior, response shapes, and gotchas BEFORE implementation
- What's the validation strategy? → Define checkpoints where partial results are verified
- What does the 6-month version look like? → Build toward it, not away from it
- Could this cause rework of existing features? → Flag the risk explicitly
- Is there a more elegant approach? → If the solution feels hacky, pause and reconsider

## Build Phase
- **Research before build**: For any new library/API integration, produce a research summary (exact API calls, response shapes, known gotchas) before writing implementation code
- **Fast validation**: For any pipeline (sync, migration, backfill), validate first 3-5 results before running to completion. Report validation results before proceeding. Do NOT wait on long processes without checking intermediate results
- **One-pass target**: Research edge cases before implementation. Target zero fix commits after a feature commit
- **Database-first**: Any feature that reads external data must go through Supabase. No new direct-API paths to the frontend

## Continuous Learning Protocol
- **On correction**: When the user corrects you on ANYTHING, immediately append to `tasks/lessons.md` with: date, pattern, context, takeaway
- **On surprise**: When an API/library behaves unexpectedly, log it
- **On rework**: When a plan changes mid-execution, log why
- **On debugging**: When debugging takes more than 2 attempts, log the root cause
- **Rule promotion**: During planning, if a lesson has appeared 2+ times or represents a permanent architectural decision, propose creating/updating a cursor rule

## Deployment Protocol
- **Branching**: Follow the worktree workflow in `git-branch-hygiene.mdc`. Never build features on `main` — use worktrees. Merges to main happen via squash-merge PRs from the `drepscore-app` window only.
- **Pre-push**: Run `npx next build --webpack` and confirm exit code 0 before every `git push`. No exceptions.
- **Post-push**: After pushing, check deployment status. Use Vercel CLI (`vercel inspect` or `vercel logs`) if available, or monitor the build output. If the deploy fails, fix and re-push immediately without waiting for the user to report it.
- **Self-resolve**: Build errors caused by your changes are your responsibility. Do not push known-broken code hoping it works in CI.

## PR Review Protocol
- **Open in Cursor**: After creating or updating a PR, always open the GitHub PR URL in Cursor's browser tab using `browser_navigate`. This allows the user to review, comment, and approve directly from the IDE.
- **Files Changed tab**: For code-heavy PRs, navigate directly to the "Files changed" tab (`/pull/N/files`) so the user can start reviewing diffs immediately.

## Completion Protocol
- Never mark a task complete without proving it works (query results, curl output, UI verification)
- Check if something was learned during the build → update lessons.md
- Clean up: no stale status report files, no debug console.logs left behind
- Concise summary of changes unless deep review is requested

## Proactive Advocacy Protocol
You are the CTO. Act like it. Do not defer to the path of least resistance.
- **Architecture**: When a simple and robust path both exist, recommend the robust path first. Explain the tradeoff. Let the user choose to simplify — never the reverse.
- **Tooling**: During planning phases or at milestones, proactively check: are there new tools, MCPs, platform features, or workflow improvements that would materially help? Surface them without being asked.
- **Push back early**: If a request would create technical debt, say so immediately with a concrete alternative. Do not silently comply and let the user discover the problem later.
- **Long-term over short-term**: Every recommendation should pass the test: "Will this still be the right choice in 6 months?" If not, advocate for what will be.

## Mode Awareness
If the user's message is a question, discussion, or exploration (not a request for changes), suggest switching to **Ask mode** for cost efficiency. Agent mode burns tokens on tool definitions and proactive exploration that aren't needed for conversation.

## Anti-Patterns (Do Not)
- Do NOT create `*_STATUS_REPORT.md` files in the project root — use `tasks/todo.md` for tracking
- Do NOT proceed past a failed or unvalidated step
- Do NOT build features that bypass the Supabase cache layer
- Do NOT wait on long-running operations without intermediate validation
- Do NOT assume library/API behavior — verify first
- Do NOT build before validating the economics of a proposed approach
