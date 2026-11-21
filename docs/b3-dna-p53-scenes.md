# DNA copying, p53 and gene expression: scene contract

For builders of `dna-replication-scene.js` (Lesson 5, the DNA fork) and `gene-expression-scene.js` (Lesson 6). The page is
`openscied-b3-dna-p53.html`; its script `openscied-b3-dna-p53.js` has the same contract as a comment at the top.
Both scene files exist now as empty placeholders. While no scene registers, the page draws a small preview picture and
shows "Interactive model coming in the next update". Registering a scene hides that notice.

## Hosts

| Scene id | Host element | Text region | Notice |
|---|---|---|---|
| `fork` | `#dna-fork-scene` | `#dna-fork-desc` (`.scene-desc`) | `#dna-fork-notice` |
| `expression` | `#gene-expression-scene` | `#gene-expression-desc` | `#gene-expression-notice` |

Each host holds a `<canvas role="img" aria-label=...>` (960 x 340 design size, CSS `aspect-ratio`; reuse it or replace it
and keep a role and label) and the text region. Keep the text region up to date with the current state for screen readers.

## Registering

```js
(window.B3DnaP53Scenes = window.B3DnaP53Scenes || []).push({ id: 'fork', mount(host, api) { /* build the scene */ } });
// or, once the page script has loaded: B3DnaP53.registerScene({ id, mount })
```

Script order does not matter. `mount` runs once, after the saved state is restored. If `mount` throws, the page shows a
reload message instead of the scene.

## API (`window.B3DnaP53`, also the `api` argument)

- `saveFork(fork)`, `saveExpression({runs})`, `addExpressionRun(run)`: write to the activity state and save. The four
  "Your data" boxes on the page, the report and the download update immediately.
- `getState()`: a copy of `{fork, expression}` (use it to restore the scene after a reload).
- `announce(text)`: the page's only live region. Do not add another `aria-live` element.
- `seed(salt)` / `rng(salt)`: a per-student number or `Lab.rng` generator, stable across reloads for the same student.
- `logic`: `B3DnaP53Logic` (see `openscied-b3-dna-p53-logic.js`): `STRANDS`, `KEY_SENTENCE`, `CARD_DECK`,
  `STANDARD_CODE` (real codon table), `transcribe`, `editCopy`, `express(dna)`, `cardDisagreements`, `substitutionRate`,
  `forkSummary`.

## Saved state (localStorage `aplab:openscied:b3-dna-p53:v1`)

```
{ v:1, fork, expression:{runs}, fields, feedback, responseIds, lastSection, lastVisitedAt }
```

`fork` (the Lesson 5 simulation-guidance table; all counts are whole numbers >= 0, rates are derived, not stored):

```
{ seed, steps:{unwound, unzipped},
  before:{ top:{correct, substitutions}, bottom:{correct, substitutions} },   // after pairing, before p53
  p53:{ a:{tried, removed}, b:{tried, removed}, c:{tried, removed} },
  after:{ top:{correct, substitutions}, bottom:{correct, substitutions} },    // after p53 and replacing letters
  updatedAt }
```

Substitution rate = 100 x substitutions / (correctly paired + substitutions), shown to one decimal; `null` when the strand has no pairs.
Official behaviour to match: 24-base template; unwind by clicking the center of the bundle; unzip by dropping helicase on the
left end; five correct manual pairings per strand, then automatic pairing with some substitutions (red letter, green when
correct); three p53 versions (a, b, c), only (a) removes a mismatch; replace removed letters until both strands show 0.

`expression.runs[]` (one entry per strand the student finished):

```
{ strand:'A'|'B'|'C'|'custom', dna, copy, edited, aminoAcids:[...], sentence, matchesKey:bool, injectedError:bool, at }
```

Compare with `B3DnaP53Logic.express(dna)`. The official sentences are in `KEY_SENTENCE`. The official card for the RNA group
CUU (card code GAA) says Pro; the standard genetic code says Leu. `express()` returns both (`aminoCards`, `aminoReal`) and
`cardDisagreements()` lists the difference. Keep the card words so the sentence matches the lesson, and show the real amino
acid with a note.

Not covered: the Optional Extension handout prints strand B as `...CATAAGGATCCCGA`, but the teacher reference and answer key use
`...CATAAGAATCCCGA`. This page uses the answer key.

## Rules for scenes

Light and dark tokens from `style.css`; never color alone (add glyphs or text); 24 px minimum targets; keyboard operable;
`prefers-reduced-motion` shows the final state without animation; label simulated data as simulated.
