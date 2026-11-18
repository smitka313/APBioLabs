# Audit issues #31 and #80: evidence reconciliation

Date: November 18, 2026. Baseline: `b469beb6f3c2e48559d12fba4fb373389c8f0cd9` (PR #117 merged).
This report tracks remaining acceptance work; it does not certify production readiness.

## Verified evidence

- GitHub's check-runs API reports successful Cloudflare Pages deployment for this exact baseline, with preview https://bb8f450d.apbiolabs.pages.dev. The GitHub Pages deployment run [44404014728](https://github.com/smitka313/APBioLabs/actions/runs/44404014728) also succeeded. These provider results establish deployment completion, not that the production custom domain serves the expected bytes.
- PR #117's [Tests run 44400274969](https://github.com/smitka313/APBioLabs/actions/runs/44400274969) succeeded, including PDF validation, checklist shards and Firefox/WebKit smoke. This is automated PR evidence.
- The baseline main-push [Tests run 44404015445](https://github.com/smitka313/APBioLabs/actions/runs/44404015445) was in progress when checked. A full-suite result is not yet recorded.
- Local focused Node execution: 22 tests passed, 0 failed. Command: `node --test tests/audit6-followup.test.js tests/submission-readiness.test.js tests/lab3-clock-recording.test.js tests/domain-redirect.test.js tests/lab5-censored-report.test.js`.
- The five new Lab 5 tests execute the production report-note function and shared report collector against fully censored, partly censored, uncensored, mixed-level and replaced/reconstructed row fixtures. They confirm the report data model contains the correct bound explanation and withdraws stale notes. They do not exercise real storage reload, chart pixels or generated DOCX/PDF files.

## Acceptance matrix

“Implemented / unverified” means merged code addresses the finding but current independent live acceptance is still required. Historical live evidence is explicitly distinguished from a new test.

| Area | Current status | Evidence and remaining action |
|---|---|---|
| Deployment revision (#31) | Partial | Both deployment providers report success for baseline. Verify custom-domain page and PDF bytes before declaring live revision confirmed. |
| All 13 labs load without blocking errors (#31) | Not tested live | PR browser smoke passed locally in CI. Repeat on production, recording console/network errors. |
| Lab 3 OLS and clock rows (#80) | Implemented / unverified live | #103/#105 align fit selection and persist cutoff; #107 refreshes comparison groups. Existing recording/cutoff regressions pass. Still capture all 17 displayed Gene A points and independently calculate OLS under the active filter, then compare graph and report. |
| Lab 5 censored rates (#80) | Historical live fix; partial current evidence | Issue #80 records Muse verification after #101. New deterministic report-model tests cover rare partial and uncensored branches. Actual preview, DOCX and print-PDF extraction for those branches still required. |
| Lab 8 history/reset (#80) | Historical live fix | Issue #80 records two-run/reset/reload verification after #101. Recheck latest production when auditing cumulative changes. |
| Lab 9 gel lifecycle and final marker edits (#31/#80) | Implemented / unverified live | #103/#105 preserve exclusion and refresh final input. Focused final-input regression passes. Still verify gel IDs across reload/restore/new gel, dye-front timing, 60 mm warning and blank measurements. |
| Lab 11 microscope and duplicate prevention (#31/#80) | Implemented / unverified live | #103/#104 handle recorded fields and hints; #113 repaints visible microscope; #116 checks actual pixel contrast in CI. Current phone/theme/mark/record/reload acceptance remains required. |
| Lab 13 measurement modes (#80) | Implemented / unverified live | #103 ties report results to recorded method and explains near-zero readings. Verify both methods, units, invalid inputs, mode switching, persistence and Reflect on production. |
| Labs 4/7/10/12 (#80) | Not reconciled live | Re-run duplicate/reset, mitosis/meiosis, NPP harvest ages and abandoned-trial checks with actual values. |
| Submit completion and dataset wording (#80) | Implemented / unverified live | #91/#105 improve counts; #115 explicitly describes retained work. Focused Submit startup regressions pass. Verify transfer, partial completion and identity in real workflows. |
| Public PDF guides | Automated and prior visual verification | #108/#117 supply direct downloads; #117 verifies two pages, Date and page labels. Current production download and real-device viewer/print acceptance remain required. |
| Responsive, keyboard, themes (#31/#80) | Automated PR checks passed; live pending | #109–#114 change screen styling. Repeat specified widths/200% zoom and inspect screenshots; physical touch cannot be inferred from emulation. |
| Teacher surfaces (#80) | Implemented / unverified live | #102/#105 notes changes; #106 metadata; #111 guide readability; #118 bench preview. Verify dashboard imports, projector, notes lock/print/idle expiry, feedback and bench preview without changing progress. |
| Full regression on baseline (#80) | Pending | Audit branch enables existing five-shard release-audit job. Record exact run/head and outcomes, including retry-only passes. |

## Environment limits

This workspace receives HTTP 403 for biologylabbench.com. The web viewer also could not access the site. Playwright is installed but its Chromium executable is absent, and the browser download is blocked with HTTP 403. No live browser, physical-phone, custom-domain header, DOCX-export or post-merge visual result is claimed here. Run those checks through an environment with production/browser access using [the acceptance protocol](audit-live-acceptance.md).

## Closure criteria

Keep #31 open until production-origin checks, representative save/restore/report flows and desktop/mobile evidence are recorded. Keep #80 open until each scientific/workflow row has a fixed/partial/broken/not-tested result, the full-suite outcome is attached, and confirmed defects are separately tracked. Do not close either issue merely because the new PR passes CI.
