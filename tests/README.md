# Tests

Browser tests for Lab Bench, written with [Playwright](https://playwright.dev). Each file is a plain Node script: it opens the site from disk or from a tiny local server, prints one line per check (`ok:` or `FAIL:`), ends with `name: N/M checks passed`, and exits non-zero if any check failed.

## Setup

Node 18 or newer (CI uses Node 22). Pick one of the two ways.

**A. Project install (what CI does).** `package.json` pins the test tools: Playwright 1.63.0, axe-core and docx.

```sh
npm ci
npx playwright install --with-deps chromium     # add firefox webkit for the cross-browser test
NODE_PATH=$PWD/node_modules node tests/<file>.js
```

**B. Global install (the old way, still works).** `npm i -g playwright docx`, then `npx playwright install chromium`, and:

```sh
NODE_PATH=$(npm root -g) node tests/<file>.js
```

The tests need no network. CDN libraries (docx, JSZip, qrcode) are answered from disk by `tests/_h.js`: docx from `node_modules` (project or global), JSZip and qrcode from `tests/fixtures/`.

`t59-a11y.js` needs axe-core. After `npm ci` it is found in `node_modules`; otherwise install it anywhere and point `AXE` at it:

```sh
mkdir -p /tmp/axe && (cd /tmp/axe && npm i axe-core)
AXE=/tmp/axe/node_modules/axe-core/axe.min.js NODE_PATH=$(npm root -g) node tests/t59-a11y.js
```

`t18-print-headers.js` and `t36-print.js` also need `pdftotext`/`pdfinfo` (poppler-utils), `unzip`, and Python 3 with Pillow and NumPy.

## Running many tests: `tests/run-all.js`

```sh
node tests/run-all.js checklist          # the release checklist below (what CI runs on every push)
node tests/run-all.js all                # every test file
node tests/run-all.js core e2e           # named groups: core, e2e, science, a11y-axe, a11y-keys, a11y-resp, a11y
node tests/run-all.js t05-progress "t59-a11y keys"    # single tests, with arguments
node tests/run-all.js all --shard 2/5    # a fifth of the full suite (CI splits it this way)
node tests/run-all.js --list checklist   # show what would run
```

Each test runs in its own process with a time limit (15 min by default, longer for the t59 suites). A few tests are timing-sensitive when the machine is busy (`t26`, `t21`, `t05`, `t35`, `t30-dataset-id`): if one fails it runs once more, and the summary lists any test that passed only on the retry. `RETRY=all` retries every failure once, `RETRY=0` never retries. `JOBS=n` runs n tests at once (default 1; more than 1 makes the timing-sensitive tests flakier). The runner sets `NODE_PATH` to `./node_modules` (or the global modules) and `AXE` to `node_modules/axe-core` when they are not set.

## Continuous integration

`.github/workflows/tests.yml` runs on GitHub Actions:

- **Every push and pull request to `main`:** the release checklist, split into parallel jobs (`core`, `e2e`, `science`, `a11y-axe`, `a11y-keys`, `a11y-resp`), and the cross-browser smoke test in Firefox and WebKit. About 15–20 minutes.
- **By hand** (Actions → Tests → Run workflow → `all`): every test, in 5 shards, plus the cross-browser test.

Each job's summary page shows a table of tests, times and check counts.

## Supported browsers

Current Chrome, Edge, Firefox and Safari (macOS, iPadOS, iOS). Most tests run in Chromium. `t60-browsers.js` checks the essentials in any engine:

```sh
npx playwright install firefox webkit
BROWSER=webkit NODE_PATH=$PWD/node_modules node tests/t60-browsers.js     # or firefox, chromium
```

It loads every page at 1366 and 390 px (no errors, no sideways scroll), runs one simulation per lab, checks save → reload, downloads a .docx, opens the PDF/print preview, restores a progress file, and unlocks teacher notes it encrypts itself (Web Crypto PBKDF2 + AES-GCM). `BROWSER` works with the other tests too (`tests/_h.js` reads it), but they are written and tuned for Chromium.

## Shared helpers

| File | What it is |
|---|---|
| `_h.js` | Launch (`BROWSER`), signed-in context (`ctxFor`), `open`, a local static server (`serve`), `ok`/`done` reporting |
| `run-all.js` | The runner above |
| `t59-drive.js` | One driver per lab: writes the predictions and runs the main simulation so the data tables fill; `dump()` returns every table and key result |
| `t59-lib.js` | Independent reference maths (mean/SD/SE, regression, χ² and t distributions, Welch, Hardy-Weinberg, Smith-Waterman) and `fnSrc`/`load` to call a function lifted from a page's source |

## The audit suites (t59, t60)

| File | Covers | Time |
|---|---|---|
| `t59-science.js` | Each lab's calculations against an independent calculation; plausibility across 2–3 student identities; invalid inputs (blank, negative, text, decimals) in the checkers and calculators; χ² critical values and a textbook Welch t example | ~8–12 min |
| `t59-e2e.js` | Full student workflow for all 13 labs: sign in on the home page → pre-lab answer → simulation → written response → reload → .docx report → progress file → restore in a fresh browser → teacher dashboard import | ~3–8 min |
| `t59-a11y.js` | axe-core WCAG 2.2 AA (light + dark, every part of every lab); keyboard on all 13 labs (skip link, landmarks, run control by Tab with visible unobscured focus, Enter/Space, live-region result, no trap); layout at 375/430/768/1024/1440 px, portrait tablets 768×1024 and 1024×1366, and 200% zoom (683×384) (overflow, off-screen controls, dialogs, 24×24 targets, sticky bars) | ~15–25 min |
| `t59-perf.js` | LCP, CLS, long tasks, script time for index + 13 labs at 1366, 375 and 375 with 4× CPU throttling. Prints a table; the thresholds (LCP ≤ 2.5 s, CLS ≤ 0.1) are informational | ~4 min |
| `t60-browsers.js` | Cross-browser smoke test (see above) | ~10 min |
| `t60-legacy-owner.js` | A dataset started before owners were recorded says "owner not recorded" everywhere, with no notice | ~1 min |
| `t60-sim-tag.js` | "Simulated data" tags on charts and tables, the report's simulation line, the one-time "observed" note | ~2 min |

Pass lab names to run part of a suite: `node tests/t59-science.js lab05 lab12` (`stats` runs the shared statistics checks), `node tests/t59-e2e.js lab08`. `t59-a11y.js` takes `axe`, `keys` and/or `resp`; `t60-browsers.js` takes `pages`, `sims`, `save` and/or `notes`. `E2E_JOBS=n` sets how many labs `t59-e2e.js` runs at once (default 4).

## Release checklist (before pushing)

CI runs steps 1, 3 and 4 (`node tests/run-all.js checklist`) on every push to `main`. Run them locally first when you can.

1. **Always**, whatever you changed:
   - `t59-e2e.js` — the whole student → teacher path still works for all 13 labs.
   - `t05-progress.js`, `t30-dataset-id.js`, `t23-dashboard.js` — progress counting, Dataset IDs and the dashboard.
   - `t26-persist-labs1-7.js` and the per-lab persist tests `t30`–`t35` — saved work and old saved data still load.
   - `t58-dataset-owner.js`, `t60-legacy-owner.js` — who owns a dataset.
2. **You changed a lab's model, numbers or checker:** `t59-science.js <labNN>` plus that lab's own tests (`grep -l labNN tests/*.js`).
3. **You changed `lab.js`:** all of step 1, then `t59-science.js` (CI runs it in full), `t49-keyresults.js`, `t21-transfer.js`, `t48-tables.js`, `t04-charts.js`, `t60-sim-tag.js`.
4. **You changed `style.css` or any layout:** `t59-a11y.js resp`, `t59-a11y.js axe`, `t59-a11y.js keys`, `t50-phone.js`, `t25-theme.js`, `t39-colorblind.js`, and a screenshot sweep at 1366, 1920 and 400 dark (overflow must be 0).
5. **Before a release:** every test (`node tests/run-all.js all`, or the `all` workflow in GitHub Actions), `t60-browsers.js` in Firefox and WebKit (CI does this), then `t59-perf.js` and compare its table with the last release.

A failing check prints `FAIL:` with the values it saw. Fix the site, not the test, unless the test itself is wrong.
