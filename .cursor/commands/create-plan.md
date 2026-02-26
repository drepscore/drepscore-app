# Plan Creation Stage

Based on our full exchange, produce a markdown plan document.

## Pre-Planning (Do these BEFORE writing the plan)

1. **Review lessons**: Read `tasks/lessons.md` for relevant patterns. If any pattern has appeared 2+ times, propose promoting it to a cursor rule as part of this plan.
2. **First-principles checklist** — answer each before planning:
   - Will this need persistent storage? → Start with DB migration, not frontend
   - What external APIs/libraries are involved? → List them. Have we researched their behavior?
   - What's the validation strategy? → Define checkpoints where partial results get verified
   - What does the 6-month version look like? → Are we building toward it or away from it?
   - Could this cause rework of existing features? → Flag the risk
   - Is there a more elegant approach? → If it feels hacky, pause

## Requirements for the plan:

- Include clear, minimal, concise steps.
- Track the status of each step using these emojis:
  - 🟩 Done
  - 🟨 In Progress
  - 🟥 To Do
- Include dynamic tracking of overall progress percentage (at top).
- Do NOT add extra scope or unnecessary complexity beyond explicitly clarified details.
- Steps should be modular, elegant, minimal, and integrate seamlessly within the existing codebase.
- **Every plan must include validation gates**: explicit checkpoints where results are verified before continuing.

## Markdown Template:

# Feature Implementation Plan

**Overall Progress:** `0%`

## TLDR
Short summary of what we're building and why.

## First-Principles Check
- Storage: [DB migration needed? Y/N]
- External APIs: [List + research status]
- 6-month view: [Does this build toward long-term architecture?]
- Rework risk: [Any existing features affected?]

## Critical Decisions
Key architectural/implementation choices made during exploration:
- Decision 1: [choice] - [brief rationale]
- Decision 2: [choice] - [brief rationale]

## Tasks:

- [ ] 🟥 **Step 1: [Name]**
  - [ ] 🟥 Subtask 1
  - [ ] 🟥 Subtask 2
  - [ ] 🟥 **Validation gate**: [What to verify before proceeding]

- [ ] 🟥 **Step 2: [Name]**
  - [ ] 🟥 Subtask 1
  - [ ] 🟥 Subtask 2
  - [ ] 🟥 **Validation gate**: [What to verify before proceeding]

...

Again, it's still not time to build yet. Just write the clear plan document. No extra complexity or extra scope beyond what we discussed.