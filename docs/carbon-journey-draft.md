# Lesson 9 Carbon Atom Journey — first implementation

## Source contract

Read the uploaded OpenSciEd B.2 Teacher Edition (4/4/25), especially printed pp.188,194–196,325–326, plus the separately uploaded student Carbon/Energy Quantitative Model handout (4 pages) and answer key (2 pages).

- Seven locations, exactly as listed on student p.1.
- Begin in atmospheric carbon dioxide; at least ten die rolls, including stays.
- Record roll, matter, energy, next location and optional notes (p.2).
- Count the origin of every roll once; matter and energy totals each count recorded outcomes once. The initial position is not an extra turn.
- Biomass follows the handout's summary table, although the instructions call it body mass.
- Summary questions follow pp.3–4. No teacher answers or answer-key example data are shipped to students.
- The answer key's phrase “all 10 locations” refers to the ten recorded stops, not ten distinct systems; there are seven systems and repeat stops are allowed.

## Missing source and release gate

The direction cards are a separate slide deck linked in the Teacher Edition:
https://docs.google.com/presentation/d/1gqIa_dNfc4SEq66n888e2wOahm7cUS5GNLLreQon4qU/edit

Access failed through both web retrieval and direct PDF export (403). The handout and key do not contain all six outcomes for each station. Do not infer 42 outcomes or force the answer-key sample journey. Current printed-card mode rolls a seeded die and lets students copy the card's matter, energy and destination. It deliberately does not validate those choices.

Before classroom release: obtain the seven direction cards, transcribe all outcomes and wording, add source-based transition tests, and switch to automatic outcomes. Verify the printed-card mode or remove it if no longer useful. Register in dashboard and generated SEO only after release review. Current page has noindex and no dashboard link.

## Implementation and verification

- Illustrated SVG dioramas: atmospheric carbon dioxide, ocean, human activity, tree producers, herbivore, omnivore, soil cross-section. Procedural original art; decorative quantities do not encode scientific data.
- Responsive board/HUD, portrait board below 850px, keyboard station inspection, enlarged board with Escape, pips, turn log, separate evidence and analysis, data tables, Lab.chart totals, source/limit notes, local save, JSON download, print report, confirmed reset and completion dialog.
- Independent source-contract and hand-calculated logic checks: 5/5 pass locally; syntax checks pass.
- Browser script checks beginning/middle/completed states, reload of pending dice and answers, totals/log, reset cancellation/confirmation, no horizontal overflow and page errors at 390 dark, 768, 1366 and 1920. Local browser could not start: installed Playwright browser missing; system Chromium fails socket creation with Operation not permitted. Dedicated CI workflow runs that script and uploads screenshots.
- Static SVG board rendered and inspected locally. Full browser appearance and cross-browser behavior remain unverified until CI screenshots and browser checks are reviewed. This is a development draft, not a claim of cell-cycle visual parity or finished classroom readiness.

## Official cards supplied — automatic outcomes implemented

The owner subsequently uploaded `Energy%20Quantitative%20Model%20Cards.pdf.pdf` (seven station pages plus license). This supersedes the missing-source blocker above. All 48 dice cases (seven stations plus the Producers second table) are now transcribed and tested against an independent mapping oracle.

The first Producers roll of 1 or 2 records biomass growth and sets a persistent flag. The next roll uses the card's second table, records a separate turn, then clears the flag when leaving. Re-entering Producers uses the first table. Stays at the other stations do not trigger a second table.

Original event wording remains visible, including source grammatical errors and the omnivore waste event's reference to a herbivore. Short destination labels normalize singular/plural forms to the seven station IDs. For summary bins only, “another/new system” transfer phrases are grouped in the handout's second energy category; this is an interpretation of the category, not an added statement in the displayed source prose. Dead-organism soil transitions retain the named biomass category; ocean sediment uses Sediment; harvested materials use Material good.

Save schema v2 retains all v1 printed-card journal entries, notes and written answers, marks them as legacy, and uses the official rules for subsequent rolls. It does not silently rewrite earlier manually entered outcomes to different destinations. A legacy journey at Producers starts automatic play with the first table because the earlier draft did not track which producer table applied. New automatic saves replay validated outcomes to restore the correct table, pending die and counts.

Added official card text, automatic readouts, last-recorded-route animation (disabled for reduced motion) and a compact mobile current-station board with full-map toggle. The 56 logic tests pass locally; JS syntax checks pass. The previous commit's CI browser checks passed all four widths; its 390-dark and 1366-light screenshots were downloaded and inspected. Updated browser checks now exercise automatic outcomes and the compact/full phone map. Current browser appearance remains subject to the updated CI run. Dashboard/SEO release remains deferred while the activity is a draft.

## Mobile and illustration revision

The failed required job was `Domain redirect and saved-work protection`: this page lacked the mandatory early domain-redirect.js script. The existing domain regression reproduced 5/6 before the fix and passes 6/6 after; no assertion was weakened. Full required checks must be reviewed independently of the dedicated game workflow.

Reworked the play screen into ready → roll → optional destination prediction → official card → record/travel. Prediction does not change the die, probabilities, card wording or recorded outcome. Pending prediction/reveal and notes are saved separately from the scientific model. On phones the current diorama, turn summary and primary actions share a viewport-sized play area; source text can scroll inside the event area while the action bar remains visible. The full map is an explicit overlay with a return control. Rules move to a help dialog. Analysis uses one question at a time; mobile totals have Systems/Matter/Energy tabs.

Original SVG scenes redrawn with leaf geometry, branching trunks, grasses, mountain layers, ocean light and fish anatomy, zebra legs/mane/stripes, raccoon fur/mask/tail, roots and soil layers, and more detailed buildings. Feature inspection opens a large field view with numbered pins, geometry-based anchor dots and explanatory text. These are illustrative examples, not new simulation quantities.

The 56 rule tests and 6 domain tests pass locally. The updated browser regression checks 375×667, 390×844 dark, 768×1024, 1366×768 and 1920×1080; verifies that board/roll/record controls fit the phone viewport without document scrolling; tests predictions, inspection, expanded map return, saved pending turns, downloads, completion, question paging and reset. Screenshots include ready, prediction, official card, mid-game and evidence. Local Chromium remains unavailable due to the previously documented socket restriction; review CI results and screenshots for this revision.
