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
