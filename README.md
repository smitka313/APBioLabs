# AP Bio Digital Lab Bench

Interactive online versions of the 13 investigations in *AP Biology Investigative Labs: An Inquiry-Based Approach* (Teacher Manual, updated Fall 2019). It is a static website: every lab runs in the browser, with no install, no accounts and no server.

Each lab page has the same parts: an overview with background and diagrams, an auto-graded pre-lab check, a structured investigation (a simulation that follows the real bench procedure and gives realistic, variable data), a design-your-own investigation, analysis tools (tables, graphs with error bars, standard error, chi-square, regression), written CER prompts, and a Submit part.

| # | Investigation | Page |
|---|---|---|
| 1 | Artificial Selection | `lab01.html` |
| 2 | Mathematical Modeling: Hardy-Weinberg | `lab02.html` |
| 3 | Comparing DNA Sequences with BLAST | `lab03.html` |
| 4 | Diffusion and Osmosis | `lab04.html` |
| 5 | Photosynthesis | `lab05.html` |
| 6 | Cellular Respiration | `lab06.html` |
| 7 | Cell Division: Mitosis and Meiosis | `lab07.html` |
| 8 | Biotechnology: Bacterial Transformation | `lab08.html` |
| 9 | Biotechnology: Restriction Enzyme Analysis of DNA | `lab09.html` |
| 10 | Energy Dynamics | `lab10.html` |
| 11 | Transpiration | `lab11.html` |
| 12 | Fruit Fly Behavior | `lab12.html` |
| 13 | Enzyme Activity | `lab13.html` |

## For students

- **Name and Dataset ID.** Students enter their name and class period once per computer. Each student's simulated data are unique, and each lab shows a **Dataset ID** (for example `K7M-2QX`) that also goes on the report. The ID stays the same when a student fixes a typo in their name or period. If a different student signs in on a shared computer, the lab says whose work it is and offers "Yes — I fixed my name", "Start my own dataset" or "Sign out". Nothing is deleted automatically. Work started before the November 2026 update has no recorded owner: reports, progress files and the dashboard say "Dataset owner: not recorded", with no notice to the student, until they choose a new dataset.
- **Save and resume.** Work saves automatically in the browser as students type. The name line shows "Saved 9:05 AM" after each save. If the browser can't save (private window, blocked site data, full storage), a warning stays at the top of the page.
- **Progress files and transfer codes.** *Move your work to another computer* saves a progress file (.json) or a resume code. *Get my transfer code* shows a code and a QR code for a phone. Before loading a file, the page names the student, the lab and the file's saved date, and warns if the work on this computer is newer. A damaged or wrong file changes nothing.
- **Reports.** Submit downloads a Word (.docx) report or opens a print view to save a PDF. **Print worksheet** prints a paper version of the lab.
- **Timelapse.** Some simulations record the run, so students can replay it fast, download it as a GIF, or add it to their report.
- **Pause & bookmark**, a first-visit tour (the **Help** link shows it again), and **Sign out** / **Start over** to clear a shared computer.

## For teachers

- **For teachers page** (`teachers.html`): how the site works, handing in work, privacy, and linking to one part of a lab.
- **Teacher notes** (`teacher-notes.html`, `teacher-labNN.html`): timing, misconceptions, suggested answers and expected ranges. They are encrypted in the page (AES-256-GCM, key from the password with PBKDF2) and need a password. They are encrypted in the page, not behind a school login: anyone with the password can open them. The password is kept only if "Keep unlocked in this tab" is ticked, and **Lock notes** forgets it. The plaintext is not in this repository; `tools/encrypt-notes.js` builds the encrypted pages.
- **Class dashboard** (`teacher-dashboard.html`): drop a class's .docx reports and progress files to get a sortable grid per lab (parts done, key results, pre-lab, FRQ self-score, confidence), flags for shared Dataset IDs, identical results, or a dataset started by another student, and a CSV export. Files are read in the browser and never uploaded. The Word-file reader (JSZip 3.10.1) is in `vendor/`.
- **Projector mode** (`projector.html`): shows the day's lab parts on the classroom screen with a timer. `projector.html#lab05` opens one lab.

## Privacy

- Student work stays in the student's own browser (localStorage, plus IndexedDB for timelapse frames). Nothing is sent to a server.
- There are no accounts. A name and class period are stored only on that computer, for reports.
- The site counts page views with GoatCounter (no cookies, no names, no answers).

## Supported browsers

Current versions of Chrome, Edge, Firefox and Safari (macOS, iPadOS and iOS), on computers, Chromebooks and tablets. Phones work for reading and for carrying on with a transfer code. Every push is tested in Chromium, and a smoke test runs in Firefox and WebKit (Safari's engine): pages load, simulations run, work saves and restores, reports download, and teacher notes unlock. Teacher notes need the site over https (GitHub Pages is), because the browser's encryption tools only work on secure pages.

## Known limitations

- Saved work belongs to one browser on one device. Clearing site data, a private window, or switching computers loses it unless the student saved a progress file or a resume code.
- The simulations are models built on typical classroom results. They support wet-lab work and do not replace it. Every data table and graph is labelled "Simulated data", and reports say the data came from a computer simulation. In chi-square, "observed" keeps its AP meaning; a short note says it means observed in the simulation.
- The .docx report tool (and the QR code tool) load from a public code library (CDN) the first time they are needed, so that step needs internet. Save as PDF does not.

## Hosting and files

A static site with no build step. On GitHub Pages: **Settings → Pages → Deploy from a branch**, `main` / `(root)`. Locally, open `index.html`.

- `index.html` home page; `labNN.html` the labs; `teachers.html`, `teacher-dashboard.html`, `projector.html` for teachers
- `lab.js` shared toolkit (identity, saving, charts, tables, quizzes, statistics, reports); `style.css` shared styles (light and dark)
- `KIT.md` and `_template.html`: guide and template for adding or editing labs
- `tools/`: helper scripts (`encrypt-notes.js` for the teacher notes); `vendor/`: third-party files kept locally
- `tests/`, `package.json`, `.github/`: browser tests and CI only (not needed to host the site)

## Tests

Browser tests use Playwright. `package.json` pins the test tools; the site itself has no build step and no dependencies.

```sh
npm ci && npx playwright install chromium
node tests/run-all.js checklist          # the release checklist (what CI runs)
NODE_PATH=$PWD/node_modules node tests/t05-progress.js     # one test
```

A global install still works: `NODE_PATH=$(npm root -g) node tests/<file>.js`. GitHub Actions (`.github/workflows/tests.yml`) runs the checklist on every push and pull request to `main`, plus a Firefox and WebKit smoke test; the full suite can be started by hand from the Actions tab. See [tests/README.md](tests/README.md) for setup, the runner, CI and the checklist.

AP® is a trademark registered by the College Board, which is not affiliated with and does not endorse this site. The lab content is adapted and paraphrased from the College Board manual; the manual itself is not included in this repository.

## Credits and license

Created by **Robert Smitka**. © 2026 Robert Smitka. Licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See [LICENSE.md](LICENSE.md). Teachers may share and adapt it for non-commercial use with credit, under the same license.
