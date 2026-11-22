# Burning Fuels: what burns and why (OpenSciEd Unit B.2, Lesson 2)

The page is `openscied-b2-burn-lab.html` (8 sections). Its script has the same contract as a comment at the top. All pure logic lives in
`openscied-b2-burn-logic.js` (global `B2BurnLogic`, tested in `tests/openscied-b2-burn-logic.test.js`): reuse it, do not duplicate it.

**Everything numerical is simulated** and labeled so in the table, chart, drawing, report and download. The assumptions are written at the top of the
logic file and on the page under "What this simulation models". The page is a virtual demonstration and replaces the teacher's real one and none of its
safety steps (students 15 feet back, goggles, ventilation, never burn materials at home).

**The page is deliberately light** (about 920 visible words, limit 1,100 in `t106-b2-burn-page.js`). Three short text boxes (`ideas-because`,
`wrap-sentence`, `wrap-question`); everything else is a native dropdown, a tap card or a tap chip with instant feedback. Scenes must not add writing boxes.

## The apparatus (what the scene draws)

The fuel burns on a heat-safe tray under a large clear glass dome (an inverted bowl or a 1-quart glass container) that captures the carbon dioxide. A small Petri dish of
BTB (lid off, shallow liquid) sits INSIDE the dome beside the fuel, exposed to the air under the dome. The fuel is weighed on a balance on the bench before the burn and after
it (the sample sits under the dome during the burn; the ready and finished pictures show it, or its ash, on the balance). A laser (infrared) thermometer is drawn as a handheld gun
with a laser line and a dot on the OUTSIDE of the dome glass, with a live reading. Smoke haze and carbon dioxide gather under the dome from the model, and water condenses as
droplets on the inside of the dome glass. Nothing in the page, tables, chips or aria-labels says "flask" (tested). The Teacher Edition says the system was not totally closed, so some
gas escapes; the BTB shows a color change, not an exact amount.

## Sections

`overview, ideas, fuels, burn, sense, sort, peat, wrapup`. Section 3 has five fuel cards (no inputs) and ten prediction dropdowns that are checked against the
student's own table once the fuel has been burned. Section 5 has reasoning rows (BTB, where the mass went, mass lost and BTB change, why the BTB is in a dish inside the dome, where the droplet water came from, energy, why peat ignites last) and three "in my data" rows (lost the most mass, most yellow, warmest). Section 6 is the Matter-Energy chart
(7 items, matter / energy / both, feedback inside each card). Section 7 is the claim, evidence and reasoning self-check; the four evidence chips (peat lost the most mass, made the biggest BTB change, warmed the dome glass most, burned longest)
are each checked against the student's own table with a text mark naming the fuel, and lose their mark when the table changes.

## Scene

| Scene id | Host | Notice | File |
|---|---|---|---|
| `burn` | `#burn-scene` (canvas) | `#burn-notice` | `burn-lab-scene.js` |

Register with `(window.B2Scenes = window.B2Scenes || []).push({ id, mount(host, api) })` or `B2Burn.registerScene({ id, mount })`. Script order does not matter.
`api` is `window.B2Burn`: `saveState(id, data)`, `update(id, patch)`, `getState()`, `announce(text)` (the page's only live region), `seed(salt)` / `rng(salt)`
(per student, stable across reloads), `logic`.

## Saved state (localStorage `aplab:openscied:b2-burn-lab:v1`, format v1)

```
{ v:1, burn, fields:{ id|radioName: value }, responseIds:[...], lastSection, lastVisitedAt }
burn = { seed, fuel, current: null | { fuel, n:1..3, startedAt:ms, skipped:bool }, records:[{ fuel, n, obs:[chip ids] }], updatedAt }
```

A burn stores a start timestamp, never a timer. Times, masses, temperatures and BTB readings are **not stored**: they are recomputed from `seed + fuel + n`
(`burnResult`), so a table or a "correct" mark can never go stale. Up to three samples of each fuel; a second sample differs a little. With reduced motion
the burn is shown finished at once. The dashboard counts `records.length` and the answered `responseIds`.

## The model, in one place

Matches the Teacher Edition's sample evidence: peat's mass reduced the most, its temperature change and BTB color change were the greatest, it burned longest, and
droplets formed on the glass (especially with peat). The TE also notes the fuels are not uniform and the demonstration did not stress equal masses, so the handfuls are
**not equal**. Per fuel (nominal): mass before 4, 4, 10, 10, 30 g (grass, leaves, wood, charcoal, peat); mass lost 93, 90, 97, 88, 78 percent, so about 3.7, 3.6, 9.7, 8.8 and
23.4 g; ignite after 4, 6, 14, 28, 45 s; burn for 20, 30, 90, 150, 260 s; heat 15, 16, 18, 29, 20 kJ per g burned; carbon factor 0.44, 0.45, 0.50, 0.90, 0.50; water factor
0.55, 0.55, 0.60, 0.12, 0.80. Seeded variation: heat and mass lost about 8 percent, ignition 15 percent, burn time 10 percent. Balance reads 0.1 g (+/- 0.1), laser thermometer
1 C (+/- 1), start 22 C.

- Carbon dioxide made (relative) = grams lost x carbon factor. It collects under the dome and a fixed 0.6 of it dissolves into the BTB in the dish (the rest escapes or stays in the air): BTB = 2 + 4 (1 - exp(-dissolved / 3.5)) +/- 0.2 (noise fades to zero when no
  gas was made), 2 to 6. So BTB change is monotonic in carbon dioxide made, which is grams lost x carbon factor; no mass lost means no BTB change. Means: peat about 5.4, charcoal 5.0,
  wood 4.3, grass and leaves 3.0. (Noise is +/- 0.2, not 0.3, so peat's BTB is above every other fuel for every student, tested over 400 seeds x 3 samples.)
- Temperature rise = the laser-thermometer reading of the dome glass after minus before = grams burned x kJ per g x 0.35 / 8, kept 2 to 22 C (the 0.35 and 8 stand for how much heat
  reaches the glass and the air under the dome): peat about 20, charcoal 11, wood 7.7, grass and leaves 2.5. The glass is never cooler after.
- Water made = grams lost x water factor; droplets on the inside of the dome grow with it (level = sqrt(water / 12), capped at 1), most for peat, least for charcoal. Observation chip "Droplets
  on the glass" is true for every fuel except charcoal (`obsTruth`).
- One simulated second is one sixth of a real second.

## Wiring

`tools/build-seo.py` (spec and structured data; run it, then `--check`), `sitemap.xml` (generated), `tests/seo.test.py`, `openscied-dashboard.html/.js` (third Unit 2
card), `tools/classify-ci-risk.js`, `.github/workflows/tests.yml` (node logic test and `t98-webkit-b2-burn`).
Tests: `tests/t106-b2-burn-{page,a11y,dashboard}.js`, `tests/t107-b2-burn-{scene,layout}.js`, `tests/t98-webkit-b2-burn.js`.
