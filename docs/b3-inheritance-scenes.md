# Inheritance, environment and cancer risk: scene contract (Lessons 8-9)

For builders of the six scenes. The page is `openscied-b3-inheritance-environment.html` (14 sections, Part A = Lesson 8 in
sections 2-8, Part B = Lesson 9 in sections 9-14). Its script has the same contract as a comment at the top. The logic
module `openscied-b3-inheritance-logic.js` (global `B3InheritanceLogic`, tested in `tests/openscied-b3-inheritance-logic.test.js`)
holds everything pure: reuse it, do not duplicate it.

**The page is deliberately light.** About 8 short text boxes in all, everything else is taps, choices, chips and sliders with
instant feedback. Scenes should be quick to use (one idea per screen) and must not add new writing boxes: put what a student
chooses into the saved state, and the page report and download will show it.

## Hosts and scene files

| Scene id | Host | Text region | Notice | File |
|---|---|---|---|---|
| `pedigree` | `#pedigree-scene` | `#pedigree-desc` | `#pedigree-notice` | `pedigree-scene.js` |
| `twoGene` | `#two-gene-scene` | `#two-gene-desc` | `#two-gene-notice` | `two-gene-scene.js` |
| `meiosis` | `#meiosis-scene` | `#meiosis-desc` | `#meiosis-notice` | `meiosis-scene.js` |
| `skin` | `#skin-data-scene` | `#skin-data-desc` | `#skin-data-notice` | `skin-data-scene.js` |
| `planner` | `#planner-scene` | `#planner-desc` | `#planner-notice` | `investigation-planner-scene.js` |
| `yeast` | `#yeast-uv-scene` | `#yeast-uv-desc` | `#yeast-uv-notice` | `yeast-uv-scene.js` |

Each host holds a `<canvas role="img" aria-label=...>` (960 x 340 design size; reuse it or replace it and keep a role and label)
and a `.scene-desc` text region. Keep the text region current for screen readers. While no scene registers, the page draws a small
preview and shows "Interactive model coming in the next update"; registering hides the notice. The six scene files exist as
comment-only placeholders (they may also use a `.css` file, add it to `tools/classify-ci-risk.js`).

## Registering and API

```js
(window.B3InhScenes = window.B3InhScenes || []).push({ id: 'pedigree', mount(host, api) { /* build the scene */ } });
// or, once the page script has loaded: B3Inh.registerScene({ id, mount })
```

Script order does not matter. `mount` runs once, after the saved state is restored; if it throws the page shows a reload message.
`api` is `window.B3Inh`:

- `saveState(id, data)` / `update(id, patch)`: write one scene's state and save. The "Your data" boxes, report and download refresh.
- `getState()`: a copy of `{ pedigree, twoGene, meiosis, skin, planner, yeast, question }` (use it to restore the scene after a reload).
- `getQuestion()`: the page's Question Tool result `{ text, iv, dv, ok }` (the planner can show it).
- `announce(text)`: the page's only live region. Do not add another `aria-live` element.
- `seed(salt)` / `rng(salt)`: per-student seeded numbers (`Lab.rng`), stable across reloads.
- `logic`: `B3InheritanceLogic`.

## Saved state (localStorage `aplab:openscied:b3-inheritance-environment:v1`)

```
{ v:1, pedigree, twoGene, meiosis, skin, planner, yeast, question, fields, responseIds, lastSection, lastVisitedAt }
```

Letters: p53 A fixes mutations, B does not; BRCA1 C lower risk, D higher. Counts are whole numbers >= 0. Never store names or
anything about a student's own or family health.

```
pedigree = { guesses: { <personId>: ['AA'|'AB'|'BB', ...] }, view: 'pedigree'|'chromosome', updatedAt }
twoGene  = { genotypes: { father|mother|child1|child2|child3: { p53:'AB', brca1:'CD' } }, updatedAt }
meiosis  = { runs: [ { crossing:bool, parent:['AC','BD'], gametes:[four strings], at } ], distanceCM:number, updatedAt }
skin     = { viewed: { white:bool, black:bool, hispanic:bool }, scale: 'same'|'own', updatedAt }
planner  = { conditions: [ { group:1..7, label, spf:number|null, foil:bool, dark:bool, minutes:number, strain:'sensitive'|'wild' } ], controls:[...], updatedAt }
yeast    = { seed, startedAt:ms, incubationDays:3..5, skipped:bool,
             dishes: [ { group, strain, label, dose, colonies:int>=0, rating:'none'|'few'|'some'|'many', observation }], updatedAt }
```

Person ids for the pedigree are those of `B3InheritanceLogic.LAKITA` (`grandfather`, `grandmother`, `aunt1`, `aunt2`, `uncle`, `aunt3`,
`father`, `mother`, `lakita`). The page re-checks every saved guess with `checkGuess`, so stale "correct" marks disappear when a
guess changes. Model rules (stated in the logic file): shaded means at least one B; the lesson's tested people (grandfather,
mother) are AA; untested and unshaded people could be anything, because not everyone with B gets cancer. Expected possible
genotypes: grandfather AA, mother AA, Lakita AB, father AB, aunt2 AB, uncle AB, untested aunts AA or AB, grandmother AB or BB.

The pedigree data model is `{ id, label, sex:'M'|'F', affected, deceased, untested, parents:[id,id]|null, knownGenotype }`.
`solvePedigree(ped)` enumerates every assignment that obeys the model; use it to build any extra pedigree.

## Per-scene notes

1. **Pedigree**: each person is a button (arrow-key navigation, label like "Lakita's father, male, shaded: cancer related to p53, deceased"). Picking genotypes as chips, instant check, "could be either" for untested people. A chromosome-17 pair view (shapes, not color only).
2. **Two genes**: recreate the reference chromosomes; shade by `twoGeneRisk` with a labelled scale and text. `explainedWithoutCrossing` tells which children the whole-chromosome model explains (child 1 only).
3. **Meiosis**: replicate AC/BD, optional crossing over, four gametes, combine with the mother's AC. Two gamete types without crossing over, four with it. A gene-distance slider uses `recombinantPercent` (Haldane, an illustration; the real p53-BRCA1 rate is not given).
4. **Skin data**: three scatterplots from `SKIN_READINGS` with "same scale / own scale" (the lesson's three figures differ about 25-fold). Keep the lesson's labels with the original labels in a note, and keep the framing note: the labels are not a biological split. Do not show mortality numbers (Lesson 12). The values are approximate readings by eye and must be verified by the owner.
5. **Planner and yeast** (simulated): survival falls with dose = lamp x time x transmittance (SPF s transmits about 1/s, foil 0, dark 0); colonies around 200 with Poisson noise seeded by the Dataset ID; incubation 3-5 days by stored timestamp with a classroom "skip ahead"; edge cases (zero colonies, long exposure also hurting wild-type, no NaN). Label SIMULATED everywhere, including exports.

## Videos and TO CONFIRM items for the owner

Videos are linked only, never embedded. YouTube ids from the unit's video-links PDF (Lesson 8, all CC BY 4.0): `U1Zifbvvl0Q`,
`ux7obpTlkbU` (the two interviews) and `-NhqJRIJJsw` (why one syndrome can lead to many cancers).

- **TO CONFIRM:** which of `U1Zifbvvl0Q` and `ux7obpTlkbU` is which interview (the Teacher Edition and the links PDF list them in different orders). The page labels them "Interview video A / B" for this reason.
- **TO CONFIRM:** that `-NhqJRIJJsw` is the third video (Lauren, why many cancer types).
- **TO CONFIRM:** the skin-cancer readings in `SKIN_READINGS` against the paper, and the y-axis unit (not stated in the lesson figure).
- **TO CONFIRM:** the exit ticket Q2 figure (positions of genes a to d) was not visible in the source; the page draws a, b close together and c, d farther, which is what answer "ab" requires.

## Rules for scenes

Light and dark tokens from `style.css`; never color alone; 24 px minimum targets; keyboard operable; `prefers-reduced-motion` shows
the final state without animation; label simulated data as simulated; no input or text about anyone's own or family health.
