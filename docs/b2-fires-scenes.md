# Fires: peat, decomposition and Earth's tilt (OpenSciEd Unit B.2, Lessons 3 and 5)

The page is `openscied-b2-fires.html` (11 sections; Part A = Lesson 3 in sections 2-6, Part B = Lesson 5 in sections 7-9, sections 10-11 put it
together). Its script has the same contract as a comment at the top. All pure logic lives in `openscied-b2-fires-logic.js`
(global `B2FiresLogic`, tested in `tests/openscied-b2-fires-logic.test.js`): reuse it, do not duplicate it.

**Everything numerical is simulated** and labeled so in the tables, charts, drawings, report and download. The assumptions are written at the top
of the logic file and on the page under "What this simulation models".

**The page is deliberately light.** Three short text boxes (`ideas-because`, `wrap-sentence`, `wrap-question`); everything else is a native dropdown,
a tap card or a tap chip with instant feedback. Scenes must not add writing boxes.

## Section order

`overview, ideas, plan, yeast, cards, sense3, hypothesis, tilt, sense5, peat, wrapup`. The order follows the Teacher Edition: the yeast
investigation comes before the Matter Energy Cards (the cards are used to make sense of the unseen parts of the investigation).

## Hosts and scene files

| Scene id | Host | Notice | File |
|---|---|---|---|
| `cards` | `#cards-scene` (no canvas, SVG molecules) | `#cards-notice` | `matter-energy-scene.js` |
| `decomp` | `#decomp-scene` | `#decomp-notice` | `decomposition-scene.js` |
| `tilt` | `#tilt-scene` | `#tilt-notice` | `tilt-scene.js` |

Register with `(window.B2Scenes = window.B2Scenes || []).push({ id, mount(host, api) })` or `B2Fires.registerScene({ id, mount })`. Script order does not
matter. `api` is `window.B2Fires`: `saveState(id, data)`, `update(id, patch)`, `getState()`, `announce(text)` (the page's only live region), `seed(salt)` /
`rng(salt)` (per student, stable across reloads), `logic`. The `.scene-notice` is only shown when a scene fails to register or mount.

## Saved state (localStorage `aplab:openscied:b2-fires:v1`, format v1)

```
{ v:1, cards, decomp, tilt, fields:{ id|radioName: value }, responseIds:[...], lastSection, lastVisitedAt }
cards  = { placed:{ sugar|oxygen|carbon-dioxide|water|energy: 'in'|'out' }, solved:bool, updatedAt }
decomp = { seed, startedAt:ms, skipped:bool, temps:[c1,c2,c3] (5|18|27|35|43|55), recorded:[0,2,...,20], updatedAt }
tilt   = { seed, startedAt:ms, skipped:bool, settings:[A,B,C] (direct|tilt45|tilt70|foil), recorded:bool, starchDone:bool, updatedAt }
```

Timed steps store a start timestamp, never a timer. Foam heights, BTB readings and starch are **not stored**: they are recomputed from `seed` plus
the choices (`foamRows`, `tiltResults`), so a "correct" mark or a table can never go stale. The dashboard counts `responseIds` (radio names, the three
text boxes and every page dropdown; scene controls are not page fields).

## The models, in one place

- **Yeast foam.** Nominal foam at 20 min (mm): 5 C 3, 18 C 10.5, 27 C 38, 35 C 50, 43 C 62 (settles a little late), 55 C 2.5 after a small early burst.
  Relative rates 0.1, 0.35, 1.0, 1.5, 1.7, 0.2 set the lag and speed. Per beaker seeded size factor +/- 8 percent, whole-mm rounding, noise of -1, 0 or +1 mm,
  never negative, never down more than 3 mm from the last reading. Relative carbon dioxide = foam / 10.
- **Tilt.** Light I = cos(angle): 1, 0.71, 0.34, foil 0. Respiration R = 0.30; photosynthesis P = 1.1 I / (0.35 + I). Net carbon dioxide = b (R - P) with plant
  size b = student factor (+/- 8 percent) x tube factor (+/- 5 percent). BTB reading = 2 + net / 0.6 (below 2, minimum 1) or 2 + 13 net (above 2, maximum 6).
  Starch index = max(0, -net). The ordering direct <= 45 degrees < foil is guaranteed for every student (tested across 300 seeds).

## Wiring (same as PR #172)

`tools/build-seo.py` (spec and structured data; run it, then `--check`), `sitemap.xml` (generated), `tests/seo.test.py`, `openscied-dashboard.html/.js`
(Unit 2 section and card; "Coming soon" now lists Units 1, 4-5), `tools/classify-ci-risk.js`, `.github/workflows/tests.yml` (node logic test and `t98-webkit-b2`).
Tests: `tests/t102-b2-fires-{page,a11y,dashboard}.js`, `tests/t103-b2-fires-{scenes,layout}.js`, `tests/t98-webkit-b2.js`.
