# Matrix Substrate Marker — R2 Re-run

This PR exists **solely** to provision a fresh Supabase preview branch + Railway preview environment as the substrate for the **R2 re-run** of the Cerebro launch-readiness Phase 1 coverage-matrix.

The original substrate (PR #1065) was torn down after the first matrix pass uncovered the user_visit_state UNIQUE-constraint anomaly (R2). R2 was fixed in PR #1088 (merged to main). This new preview branch will replay the R2 migration as part of branch creation, giving us a clean substrate to re-run the 5 previously-blocked cells (03/04/06/07/08).

**DO NOT MERGE.** This PR will be **closed** (not merged) once the re-run completes, which tears the preview branch down.

Tracked in `governada-brain/governada/initiatives/cerebro-launch-readiness.md` Phase 1 and `governada-brain/learnings/cerebro-launch-readiness/coverage-matrix/`.
