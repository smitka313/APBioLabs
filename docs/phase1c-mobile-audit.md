# Phase 1C — mobile usability audit

Status: **audit in progress; no UI fixes merged**.

## Evidence from source review

- All 13 lab pages declare a responsive viewport.
- Shared mobile checks already cover horizontal page overflow, sticky navigation overlap, and shared control heights on iPhone 13 and Pixel 7 emulations.
- The existing phone test (`tests/t50-phone.js`) **logs lab-specific controls shorter than 40 px without failing**. This is a coverage gap, not proof that any particular control is unusable.
- Wide data tables already have scroll affordances and keyboard focus behavior in `lab.js`. Do not duplicate this feature.
- Lab 9 already specifies 40 px minimum well buttons for coarse pointers and small viewports.

## Next verification before making interface changes

1. Run `node tests/run-all.js checklist` and the full phone test.
2. Capture the lab-specific short-control log from `tests/t50-phone.js` and classify each control as interactive, intentionally compact, or hidden/inactive.
3. Reproduce any problematic controls on iPhone and Android-sized viewports, in light and dark mode.
4. Fix only confirmed usability issues in separate small PRs, preserving calculations, scoring, persistence and simulation behavior.
5. Re-run the browser checklist and test touch interaction and keyboard navigation before merge.

## Scope

This audit note does not assert that all 13 labs have passed a manual usability review. It introduces no runtime changes and requires no deployment.
