# Biology Lab Bench

**Free to use:** [biologylabbench.com](https://biologylabbench.com/) · [Teacher setup](https://biologylabbench.com/getting-started.html) · [Printable student directions](https://biologylabbench.com/student-directions.html)

> **AI agents and contributors:** read and follow [AGENTS.md](AGENTS.md) before changing anything. It is also at https://raw.githubusercontent.com/smitka313/APBioLabs/main/AGENTS.md.

Interactive online versions of the 13 investigations in *AP Biology Investigative Labs: An Inquiry-Based Approach* (Teacher Manual, updated Fall 2019). It is a static website: every lab runs in the browser, with no install, no accounts and no server.

Each lab page has the same parts: an overview with background and diagrams, an auto-graded pre-lab check, a structured investigation (a simulation that follows the real bench procedure and gives realistic, variable data), a design-your-own investigation, analysis tools (tables, graphs with error bars, standard error, chi-square, regression), written CER prompts, and a Submit part.

| # | Investigation | Student lab | Printable directions |
|---|---|---|---|
| 1 | Artificial Selection | [Open lab](lab01.html) | [Student guide](directions-lab01.html) |
| 2 | Mathematical Modeling: Hardy-Weinberg | [Open lab](lab02.html) | [Student guide](directions-lab02.html) |
| 3 | Comparing DNA Sequences with BLAST | [Open lab](lab03.html) | [Student guide](directions-lab03.html) |
| 4 | Diffusion and Osmosis | [Open lab](lab04.html) | [Student guide](directions-lab04.html) |
| 5 | Photosynthesis | [Open lab](lab05.html) | [Student guide](directions-lab05.html) |
| 6 | Cellular Respiration | [Open lab](lab06.html) | [Student guide](directions-lab06.html) |
| 7 | Cell Division: Mitosis and Meiosis | [Open lab](lab07.html) | [Student guide](directions-lab07.html) |
| 8 | Biotechnology: Bacterial Transformation | [Open lab](lab08.html) | [Student guide](directions-lab08.html) |
| 9 | Biotechnology: Restriction Enzyme Analysis of DNA | [Open lab](lab09.html) | [Student guide](directions-lab09.html) |
| 10 | Energy Dynamics | [Open lab](lab10.html) | [Student guide](directions-lab10.html) |
| 11 | Transpiration | [Open lab](lab11.html) | [Student guide](directions-lab11.html) |
| 12 | Fruit Fly Behavior | [Open lab](lab12.html) | [Student guide](directions-lab12.html) |
| 13 | Enzyme Activity | [Open lab](lab13.html) | [Student guide](directions-lab13.html) |

## For students

- **Name and Dataset ID.** Students enter their name and class period once per computer. Each student's simulated data are unique, and each lab shows a **Dataset ID** (for example `K7M-2QX`) that also goes on the report. The ID stays the same when a student fixes a typo in their name or period. If a different student signs in on a shared computer, the lab says whose work it is and offers "Yes — I fixed my name", "Start my own dataset" or "Sign out". Nothing is deleted automatically. Work started before the November 2026 update has no recorded owner: reports, progress files and the dashboard say "Dataset owner: not recorded", with no notice to the student, until they choose a new dataset.
- **Save and resume.** Work saves automatically in the browser as students type. The name line shows "Saved 9:05 AM" after each save. If the browser can't save (private window, blocked site data, full storage), a warning stays at the top of the page.
- **Progress files and transfer codes.** *Move your work to another computer* saves a progress file (.json) or a resume code. *Get my transfer code* shows a code and a QR code for a phone. Before loading a file, the page names the student, the lab and the file's saved date, and warns if the work on this computer is newer. A damaged or wrong file changes nothing.
- **Printable student directions.** Every lab links to a guide from **Overview** and **Submit**. Guides follow the lab's sections with numbered steps, checkboxes, data-recording reminders, and a submission checklist. Each has blank name, period, and Dataset ID fields, plus **Download PDF** and **Print / Save as PDF**. The guide index also links directly to all 13 PDFs. Downloads work without JavaScript or a native print dialog; the browser may open a PDF viewer where students can save or print. They contain no answer keys or student results, and remain readable and printable without JavaScript. Browse [all 13 guides](student-directions.html).
- **Reports and worksheets.** Submit downloads a Word (.docx) report or opens a print view to save a PDF. **Print worksheet** creates a separate paper worksheet with questions and space for work. Downloading a report does not submit it: students must upload or hand in the file where their teacher directs.
- **Timelapse.** Some simulations record the run, so students can replay it fast, download it as a GIF, or add it to their report.
- **Pause & bookmark**, a first-visit tour (the **Help** link shows it again), and **Sign out** / **Start over** to clear a shared computer.

## For teachers

- **Quick start** (`getting-started.html`): five-minute classroom setup, backups, submissions and dashboard workflow. The `sample-report.html` page shows a real Lab 5 export by a fictional student (simulated data), with the .docx and PDF to download; `tools/make-sample-report.js` regenerates it. `feedback.html` offers GitHub issues or email.
- **For teachers page** (`teachers.html`): how the site works, handing in work, privacy, and linking to one part of a lab.
- **Teacher notes** (`teacher-notes.html`, `teacher-labNN.html`): timing, misconceptions, suggested answers and expected ranges. They are encrypted in the page (AES-256-GCM, key from the password with PBKDF2) and need a password. They are encrypted in the page, not behind a school login: anyone with the password can open them. The password is kept only if "Keep unlocked in this tab" is ticked. Unlocked pages provide **Print** and **Lock notes** controls at the top and auto-lock after 15 minutes without activity on a notes page (working in a student lab does not extend this time); **Lock notes** clears remembered access immediately. Leave remembered access off on shared computers. The plaintext is not in this repository; `tools/encrypt-notes.js` builds the encrypted pages.
- **Class dashboard** (`teacher-dashboard.html`): drop a class's .docx reports and progress files to get a sortable grid per lab (parts done, key results, pre-lab, FRQ self-score, confidence), flags for shared Dataset IDs, identical results, or a dataset started by another student, and a CSV export. Files are read in the browser and never uploaded. The Word-file reader (JSZip 3.10.1) is in `vendor/`.
- **Printable walkthroughs.** Use [student-directions.html](student-directions.html) to print or save a guide for any lab. These provide simulation directions; **Print worksheet** supplies the questions and working space.
- **Projector mode** (`projector.html`): shows the day's lab parts on the classroom screen with a timer. `projector.html#lab05` opens one lab.

## Data interpretation and recent fixes

- **Lab 3:** the molecular-clock graph, residual feedback, and report slope use the same gene and selected divergence-time cutoff. Report labels identify the gene, fitted point count, and cutoff. The cutoff and its enabled/disabled setting are saved with the lab's progress. **Add all hits to clock table** refreshes the selected query/gene's rows with the latest search, repairing duplicate or stale entries while retaining other queries and genes.
- **Lab 5:** cups that do not reach ET₅₀ within the observation window are treated as censored results, with explanations in report data rather than a measured zero rate.
- **Lab 9:** marker edits refresh the curve and warnings as you type, the large-marker exclusion setting is saved, uncut λ is modeled as one 48,502-bp band, and estimates outside the fitted marker-distance range show an extrapolation warning.
- **Lab 11:** a stomatal field can be recorded once; students must move to a new field for another replicate, including after reload.
- **Lab 12:** stopping a choice-chamber trial discards its partial recording without a completed-run toast.
- **Lab 13:** Reflect and report results use the recorded measurement method when the current mode changes. The page explains small negative blank-corrected readings and distinguishes endpoint reading ratios from reaction rates.

Independent live verification confirmed the regression/report, recording, and measurement-mode fixes in PRs #102–103, plus cutoff persistence, immediate marker-edit refresh, readiness reload, and notes-timeout wording in PRs #105–106. A later Lab 3 acceptance audit verified that repeating **Add all hits to clock table** kept the same 17 rows and fit, and that the cutoff, enabled state, and fit persisted after reload. PR #139 adds automated responsive checks at the audit viewport sizes and phone/tablet emulation; physical-device and print-dialog checks remain separate.

**New dataset changes future simulated numbers; it keeps existing tables, answers, and saved simulation states.** It is not a clean reset. For an independent fresh investigation, first export a progress backup and then use **Start over** for that lab (this explicitly erases its saved work). For a contaminated Lab 3 clock group, rerun BLAST for that query/gene and choose **Add all hits to clock table** to refresh just that group.

## Privacy

- Student work stays in the student's own browser (localStorage, plus IndexedDB for timelapse frames). Nothing is sent to a server.
- There are no accounts. A name and class period are stored only on that computer, for reports.
- The site counts page views with GoatCounter (no cookies, no names, no answers).

## Supported browsers

Current versions of Chrome, Edge, Firefox and Safari (macOS, iPadOS and iOS), on computers, Chromebooks and tablets. Phones work for reading and for carrying on with a transfer code. Pull requests select checks based on the changed files; full-checklist runs include Chromium tests and smoke tests in Firefox and WebKit (Safari's engine): pages load, simulations run, work saves and restores, reports download, and teacher notes unlock. Teacher notes need HTTPS (the public site uses it), because the browser's encryption tools only work on secure pages.

## Known limitations

- Saved work belongs to one browser on one device. Clearing site data, a private window, or switching computers loses it unless the student saved a progress file or a resume code.
- The simulations are models built on typical classroom results. They support wet-lab work and do not replace it. Every data table and graph is labelled "Simulated data", and reports say the data came from a computer simulation. In chi-square, "observed" keeps its AP meaning; a short note says it means observed in the simulation.
- The .docx report tool (and the QR code tool) load from a public code library (CDN) the first time they are needed, so that step needs internet. Save as PDF does not.

## Hosting and files

The public site is [biologylabbench.com](https://biologylabbench.com/), deployed through Cloudflare Pages. It is a static site with no application build step. It can also be hosted on GitHub Pages: **Settings → Pages → Deploy from a branch**, `main` / `(root)`. Locally, open `index.html` or serve the folder over HTTP for features that need a secure origin.

Old `smitka313.github.io/APBioLabs/` links redirect to the new domain when no saved lab work is detected. Students with saved work stay on the old site and see transfer instructions. Use **Move your work to another computer** in each lab to transfer progress to the new domain; saved browser work does not move automatically. Download timelapse recordings separately.

- `index.html` home page; `labNN.html` the labs; `teachers.html`, `teacher-dashboard.html`, `projector.html` for teachers
- `student-directions.html` guide index; `directions-labNN.html` printable walkthroughs; `student-directions.css` and `student-directions.js` print layout and button
- `lab.js` shared toolkit (identity, saving, charts, tables, quizzes, statistics, reports); `style.css` shared styles (light and dark)
- `KIT.md` and `_template.html`: guide and template for adding or editing labs
- `tools/`: helper scripts (`encrypt-notes.js` for teacher notes; `build-student-directions.py` and `student-directions.json` for walkthroughs); `vendor/`: third-party files kept locally
- `tests/`, `package.json`, `.github/`: browser tests and CI only (not needed to host the site)

### Search visibility

Public lab pages and printable guides have unique search descriptions, production canonical URLs, social previews, and structured learning-resource data. The homepage contains all 13 lab cards in static HTML; JavaScript adds personal progress. `sitemap.xml` lists only the 30 public learning/resource pages. Teacher answer keys, the dashboard, projector, example report, feedback, template, and error page are excluded from the sitemap and marked `noindex`; Cloudflare `_headers` reinforces that for protected and utility routes. Encryption continues to protect teacher answers.

Edit `tools/seo-content.json` when changing catalog descriptions or search copy, then regenerate and check:

```sh
python3 tools/build-seo.py
python3 tools/build-seo.py --check
python3 tests/seo.test.py
```

The student-directions generator also refreshes SEO metadata. Generated HTML is committed, so hosting needs no build service or added dependencies. Canonicals use Cloudflare Pages’ extensionless production URLs; relative `.html` links remain usable on GitHub Pages and local copies. See [search setup and verification](docs/search-visibility.md) for Search Console/Bing submission and deployment checks.

### Updating student directions

Edit the lab-specific steps in `tools/student-directions.json`, then regenerate the static guides and their Overview/Submit links:

```sh
python3 tools/build-student-directions.py
```

The committed PDF copies in `student-pdfs/` are built from those public HTML guides. After changing guide content or PDF layout, regenerate and validate them:

```sh
python3 -m pip install -r tools/pdf-requirements.txt
python3 tools/build-student-pdfs.py
python3 tools/build-student-pdfs.py --check
python3 tests/student-pdfs.test.py
```

The manifest tracks semantic guide contents, renderer/fonts, and PDF bytes; CI rejects stale or modified copies. The PDF generator uses bundled, licensed DejaVu fonts and no network resources. These are development-only dependencies: hosting still serves ordinary static files for free. Cloudflare marks PDF copies `noindex` while the HTML guides remain the search destinations. Narrow-screen guides use smaller outer margins and links with at least 44-pixel touch targets. Real Safari print-dialog behavior and physical-phone interaction still need manual verification.

The generator reads section names and anchors from the current student labs and rejects missing or unknown sections. Commit the regenerated HTML alongside the source changes. Normal hosting serves the generated pages directly and does not need Python. Preview a guide in print mode after editing its content or styles.

## Tests

Browser tests use Playwright. `package.json` pins the test tools; the site itself has no build step and no dependencies.

```sh
npm ci && npx playwright install chromium
node tests/run-all.js checklist          # the release checklist (what CI runs)
NODE_PATH=$PWD/node_modules node tests/t05-progress.js     # one test
```

A global install still works: `NODE_PATH=$(npm root -g) node tests/<file>.js`. GitHub Actions (`.github/workflows/tests.yml`) always checks domain redirects and saved-work protection. Pull requests use `tools/classify-ci-risk.js` to select quick, instructional-UI, standard, or full-checklist coverage. Pushes to `main` run the checklist and Firefox/WebKit smoke tests. The entire test suite can be started manually from the Actions tab. See [tests/README.md](tests/README.md) for setup, the runner, CI and the checklist.

AP® is a trademark registered by the College Board, which is not affiliated with and does not endorse this site. The lab content is adapted and paraphrased from the College Board manual; the manual itself is not included in this repository.

## Credits and license

Created by **Robert Smitka**. © 2026 Robert Smitka. Licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See [LICENSE.md](LICENSE.md). Teachers may share and adapt it for non-commercial use with credit, under the same license.
