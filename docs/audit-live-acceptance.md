# Live acceptance protocol for issues #31 and #80

Use this protocol in Muse or a browser environment that can access https://biologylabbench.com/.

Audit baseline: PR #117 merged as b469beb6f3c2e48559d12fba4fb373389c8f0cd9. Record the audit date, browser, URL and observed deployment evidence. If production has advanced, state that revision evidence explicitly.

Use fresh isolated audit identities and empty browser profiles. Never erase, import over or otherwise alter existing teacher/student work. Use a new browser profile for destructive reset checks. Do not open Labs 5 or 8 in the user's existing profile.

For every check report PASS, FAIL, PARTIAL or NOT TESTED, exact actions, observed values and screenshots/artifact filenames. Separate confirmed fixes, still broken, newly found and not tested. Do not infer live acceptance from CI.

## 1. Production and page smoke

- Open homepage and Labs 1–13. Record blocking console errors and failed first-party requests.
- Download all 13 public guide PDFs from the production links. Verify two pages, Date field, Page 1 of 2 / Page 2 of 2 and no clipping/overlap. Compare downloaded SHA256 hashes with the baseline manifest when possible.
- Check desktop 1366x768 and 1440x900; phones 375x812, 390x844 and 430x932; tablet 768x1024; 200% zoom, light/dark themes, keyboard focus and horizontal tables.
- Record real physical-device results separately from emulation. Do not claim one establishes the other.

## 2. Scientific and persistence checks

- Lab 3: run the actual Gene A clock search; capture all 17 displayed (time, identity) points, query, gene, dataset, cutoff and inclusion state. Independently calculate OLS slope/intercept/R² for the included points. Compare graph and FRQ/report. Click Add all hits twice; row count and fit must remain stable. Change cutoff, reload and confirm restoration.
- Lab 5: reproduce a fully censored level and inspect Design/Evaluate, report preview, actual downloaded DOCX and print PDF. Record bound wording and omitted graph marker. If a partial or uncensored branch cannot be reached naturally, label it NOT TESTED live; do not claim the new fixture tests exercise an actual export.
- Lab 8: complete two transformations with add/reset/reload transitions. Confirm history retained, current checklist and caption match the active run, and calculations persist.
- Lab 9: record settings, gel IDs and dye-front distance/time; verify warning near 60 mm, blank measurement behavior, marker-entry final-keystroke curve update, exclusion state, and IDs across reload/progress export/fresh-profile restore/new gel.
- Lab 11: fresh Stomata view in both themes shows cells and countable stomata; mark, record once, switch sections and reload. Do not allow duplicate recording until Move to a new field. Confirm leaf counts/calculation and water-loss data survive reload.
- Lab 13: separately run palette and spectrophotometer protocols. Record units and initial slopes, negative blank-corrected readings, invalid-input behavior, mode-switch impact on completed results, reload and Reflect/report.
- Labs 4/7/10/12: independent replicate/duplicate checks, reset behavior, NPP harvest day and paired comparisons, discarded interrupted-trial recordings. Record actual values rather than only button success.

## 3. Student and teacher path

- First visit: tour, identity, unobstructed save banner and keyboard navigation.
- Representative labs including 9/11: enter an identifiable answer, collect measurements, refresh, export progress, restore into a separate fresh profile, and compare values/name/period/Dataset ID.
- Export actual DOCX and print PDF, inspect their contents, and import the supported artifact into the local teacher dashboard. Include partial completion and uncertainty/confidence fields.
- Check teacher homepage/getting-started/sample report/dashboard/projector, replayable tour and feedback page.
- Check protected notes using authorized credentials only: unlock/print/lock and idle expiry. Record NOT TESTED if credentials are unavailable.
- Toggle homepage Preview completed bench; return to the actual bench and reload. Student progress must not change.

## Report format

| Check | Result | Dataset/settings | Actions | Actual vs expected | Evidence |
|---|---|---|---|---|---|

For each failure, give the smallest reproducible sequence, severity and whether it affects science, saved work, reports or access. Do not make code changes during the audit. Return results for reconciliation against issues #31/#80.
