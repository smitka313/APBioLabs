# Tests

Browser tests for Lab Bench, written with [Playwright](https://playwright.dev) (Chromium). Each file is a plain Node script: it opens the site from disk or from a tiny local server, prints one line per check (`ok:` or `FAIL:`), ends with `name: N/M checks passed`, and exits non-zero if any check failed.

## Setup

- Node 18 or newer.
- Playwright and the `docx` package installed globally: `npm i -g playwright docx`, then `npx playwright install chromium`.
- Run every test from the repo root with the global modules on the path:

```sh
NODE_PATH=$(npm root -g) node tests/<file>.js
```

The tests need no network. CDN libraries (docx, JSZip, qrcode) are answered from disk by `tests/_h.js`; JSZip and qrcode are vendored in `tests/fixtures/`.

## Shared helpers

| File | What it is |
|---|---|
| `_h.js` | Launch, signed-in context (`ctxFor`), `open`, a local static server (`serve`), `ok`/`done` reporting |
| `t59-drive.js` | One driver per lab: writes the predictions and runs the main simulation so the data tables fill; `dump()` returns every table and key result |
| `t59-lib.js` | Independent reference maths (mean/SD/SE, regression, χ² and t distributions, Welch, Hardy-Weinberg, Smith-Waterman) and `fnSrc`/`load` to call a function lifted from a page's source |

## The audit suites (t59)

| File | Covers | Time |
|---|---|---|
| `t59-science.js` | Each lab's calculations against an independent calculation; plausibility across 2–3 student identities; invalid inputs (blank, negative, text, decimals) in the checkers and calculators; χ² critical values and a textbook Welch t example | ~12 min |
| `t59-e2e.js` | Full student workflow for all 13 labs: sign in on the home page → pre-lab answer → simulation → written response → reload → .docx report → progress file → restore in a fresh browser → teacher dashboard import | ~8 min |
| `t59-a11y.js` | axe-core WCAG 2.2 AA (light + dark, every part of every lab); keyboard on Labs 5, 9, 13; layout at 375/430/768/1024/1440 px (overflow, off-screen controls, dialogs, 24×24 targets) | ~25 min |
| `t59-perf.js` | LCP, CLS, long tasks, script time for index + 13 labs at 1366, 375 and 375 with 4× CPU throttling. Prints a table; the thresholds (LCP ≤ 2.5 s, CLS ≤ 0.1) are informational | ~4 min |

Pass lab names to run part of a suite: `node tests/t59-science.js lab05 lab12` (`stats` runs the shared statistics checks), `node tests/t59-e2e.js lab08`. `t59-a11y.js` takes `axe`, `keys` and/or `resp`.

`t59-a11y.js` needs axe-core, which is not vendored:

```sh
mkdir -p /tmp/axe && (cd /tmp/axe && npm i axe-core)
AXE=/tmp/axe/node_modules/axe-core/axe.min.js NODE_PATH=$(npm root -g) node tests/t59-a11y.js
```

(Or install `axe-core` globally so it resolves through `NODE_PATH`.) `E2E_JOBS=n` sets how many labs `t59-e2e.js` runs at once (default 4).

## Release checklist (before pushing)

1. **Always**, whatever you changed:
   - `t59-e2e.js` — the whole student → teacher path still works for all 13 labs.
   - `t05-progress.js`, `t30-dataset-id.js`, `t23-dashboard.js` — progress counting, Dataset IDs and the dashboard.
   - `t26-persist-labs1-7.js` and the per-lab persist tests `t30`–`t35` — saved work and old saved data still load.
2. **You changed a lab's model, numbers or checker:** `t59-science.js <labNN>` plus that lab's own tests (`grep -l labNN tests/*.js`).
3. **You changed `lab.js`:** all of step 1, then `t59-science.js stats`, `t49-keyresults.js`, `t21-transfer.js`, `t48-tables.js`, `t04-charts.js`.
4. **You changed `style.css` or any layout:** `t59-a11y.js resp`, `t59-a11y.js axe`, `t50-phone.js`, `t25-theme.js`, `t39-colorblind.js`, and a screenshot sweep at 1366, 1920 and 400 dark (overflow must be 0).
5. **Before a release:** every file in `tests/` (a loop such as `for f in tests/t*.js; do NODE_PATH=$(npm root -g) node "$f" || echo "FAILED $f"; done`), then `t59-perf.js` and compare its table with the last release.

A failing check prints `FAIL:` with the values it saw. Fix the site, not the test, unless the test itself is wrong.
