# Migration Map Explorer: source and verification notes

Independent OpenSciEd B.1 Lessons 3–4 companion. Original map, wildlife, controls, notebook, and adapted questions. No teacher answer key is included in the student site.

## Source materials supplied by the teacher

- B.1 Lesson 3 Reference Wildebeest Data Cards.docx: all 18 card images, transcribed into `migration-logic.js`. Records are selected monthly group averages for male wildebeest, not individual animals or sample sizes.
- B.1 Lesson 3 Teacher Reference Data and Sources.docx: interpretation of the selected evidence and the outbreak-year anthrax data; primary literature attribution.
- B.1 Lesson 3 Slides.pptx, slide A, and B.1 Lesson 4 Reference Wildebeest Migration Map.docx: broad monthly ranges used for the schematic route. Source attribution in those materials: Giovanni Tombazzi’s Serengeti maps in cooperation with Hoopoe Adventure Tours. Original digital redrawing; no BioRender illustrations copied into the map.
- B.1 Lesson 3 Handout Analyzing Wildebeest Data.docx: purpose, patterns, alternative explanations and next questions.
- B.1 Lesson 4 Reference Regional Data Cards.docx: source of the north, south and west ecological descriptions. Regional facts must not be reduced to “follow the wettest region.”
- B.1 Lesson 4 Slides.pptx, slide T, `ppt/media/image24.png`: original Concord Consortium 1961–1990 station-average rainfall graph, copied byte-for-byte into `assets/migration-rainfall-source.png`. No monthly numeric values were guessed or digitized from the plotted points. Published-evidence graphs disable the shared toolkit’s default simulated-data stamp and use responsive axis labels.
- B.1 Lesson 4 Slides.pptx, slides X–Y: one annual regional example, South 1160 mm / 52% occupancy; West 1180 mm / 26%; North 1310 mm / 6%. These selected regions total 84% and do not represent all locations. This is not the complete multi-year CODAP dataset.
- B.1 Lesson 4 Handouts Investigating Rainfall Data, Wildebeest and Rainfall, and Regional Data Notecatcher: comparison questions and the distinction between seasonal station averages and annual regional occupancy.

The teacher also supplied two CODAP shared links and a SageModeler link. The pages link to these exact tools as optional extensions. Their shared JSON documents were unavailable in the execution environment; no claims are made about having imported their contents. Nothing students enter is transferred to these external tools automatically.

## Deliberate source fidelity

The supplied teacher key contains summaries that conflict with the individual student cards. The explorer preserves the card images. Examples: May living / predation / other-cause fat values are 95 / 75 / 90%; July predation is 51%; September predation is 46%. There are eight cards labeled healthy, seven stressed and three starved. The app preserves the printed nutritional labels rather than deriving thresholds. The selected cards must never be used to calculate a population mortality rate.

## Illustration limits

The map is a schematic of broad ranges, not GPS tracks, exact dates, distances or park boundaries. Between-month interpolation and individual animal motion are visual transitions, not a mechanistic migration model. Weather and grass color are seasonal illustrations, not measured rainfall or grass biomass. Grass appearance does not quantify nutritional quality. The fixed decorative herd does not represent a population count. No predictions are scored against a predetermined biological answer.

## Validation

- `node --test tests/migration-explorer.test.js tests/openscied-dashboard.test.js`: independent transcription checks, missing-month behavior, group integrity, source exceptions, invalid months, dashboard resume, exports, unreadable storage and isolated resets.
- `node tests/t120-migration-explorer.js`: browser workflow, reload, downloads, dashboard integration, every viewport, reduced motion, keyboard slider, playback, axe in light/dark and corrupt-save preservation.
- `MIGRATION_SCREENSHOTS=...` retains beginning/middle/end views at 390 dark, 768, 1366 light, 1920 and 683 dark (200% zoom equivalent), plus evidence, writing and enlarged maps.
- Dedicated GitHub Actions workflow runs source and browser checks and uploads screenshots for inspection. The usual repository CI also runs.

## License

OpenSciEd source materials: CC BY-NC 4.0. Original digital adaptation: CC BY-NC-SA 4.0. Rainfall chart credited to Concord Consortium via the supplied OpenSciEd slides. Illustrations in the new map and preview are original code. Full attribution appears in the student footer and model-limits disclosure.
