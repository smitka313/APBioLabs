# Phase 1F — Release readiness audit

## Scope

Release baseline for Labs 1–13. This pull request adds a five-shard run of **every** `tests/t*.js` test (excluding helper modules) on Chromium, including scientific correctness, persistence, data transfer, Word/PDF report generation, mobile layout, accessibility, and submission workflows. The existing main Tests workflow also runs its standard cross-browser Firefox and WebKit smoke checks because workflow changes are classified as high risk.

## Release criteria

- All five full-suite shards pass. A retry-only pass must be reviewed for timing flakiness.
- Firefox and WebKit smoke checks pass.
- Confirm there are no unresolved science, save/restore, report, or accessibility failures.
- Inspect failures before changing production code; document any reproducible defect and fix in a small follow-up PR.
- Check GitHub Pages deployment separately after merge; passing CI does not establish live deployment.
- Manual review on physical phones remains necessary for real touch/scroll behavior and screen-reader experience.

## Findings

**Pending CI.** This audit does not claim scientific accuracy or usability has been manually certified. Record actual test outcomes here after the run; do not merge solely because this plan exists.

## Stability

This PR changes no student-facing code, simulation logic, grading, or student progress storage.
