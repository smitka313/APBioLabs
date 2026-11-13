# AP Bio Digital Lab Bench — build guide for lab pages

You are building interactive, student-facing web versions of investigations from the College Board
*AP Biology Investigative Labs: An Inquiry-Based Approach* (Teacher Manual, Fall 2019).
The audience is AP Biology students (grades 11–12) and their teacher at a public high school.

## Source material
Work from the College Board *AP Biology Investigative Labs* Teacher Manual (Fall 2019), available free on AP Central. Read the lab's teacher and student versions in full before writing. The manual is not stored in this repository.

## Files you produce (flat in the repository root, no subfolders)
1. `labNN.html` — the student lab (NN = two digits, e.g. `lab04.html`).
2. `teacher-labNN.html` — teacher notes page for that lab.
Do **not** edit `style.css`, `lab.js`, `_template.html`, `index.html` or another builder's files. If the
toolkit lacks something, write page-local CSS/JS inside your own file.

Start each page by copying `_template.html` (full `<!doctype html>` document, fonts link, `style.css`,
`lab.js`, `:root` safe-area padding, header, step nav, name field, footer). Keep the footer text as is.
`<title>` format: `Lab 4 · Diffusion and Osmosis` (teacher page: `Lab 4 Teacher Notes`).
Header crumbs: `All labs` → `index.html`; the unit/Big Idea label; `Teacher notes` → `teacher-labNN.html`
(teacher page links back to `labNN.html` instead).

## Toolkit (`lab.js`, global `Lab`) — read the file once; summary:
- `Lab.init({id:'lab04'})` — call first. Builds the sticky step nav from every `<section class="step" data-step="Short name">`, binds autosave on `[data-save]` fields, renders `[data-responses]` (copy-all-responses toolbar).
- `Lab.quiz(el, questions, {id})` — auto-checked questions with explanations. Types: `mc` (answer index), `multi` (answer index array), `num` (answer, `tol` absolute or `tolPct`, `unit`). Stems and choices accept HTML.
- `Lab.prompt(el, {key, label, rows, placeholder})` — saved free-response box. Keys must be unique within the page.
- `Lab.table(el, {columns:[{key,label,unit,num,digits,editable}], rows, save:'key', onChange(rows), footer(rows)})` → `{addRow,setRows,getRows,clear}`. `editable:true` lets students type values (use for "record your own measurement" steps).
- `Lab.chart(el, {type:'xy'|'bar', xLabel, yLabel, xMin,xMax,yMin,yMax, height, series:[{name,points:[{x,y,err}],line,dots,fit:'linear',dash}], categories, hLines:[{y,label}], annotations:[{x,label}]})` → `{update(partial)}`. Error bars via `err` (use 2×SE for AP-style 95% CI). Colors come from CSS tokens automatically. **Long axis labels wrap** (x and y labels, bar category names) onto up to three lines, then shrink to 10.5 px, and the margins grow to hold them; a label is never cut or ended with an ellipsis, so write the full wording (`tests/t33-chart-labels.js`).
- `Lab.stats` — `mean, sd, se, ci95, median, sum, chiSquare(obs,exp) → {chi2,df,crit,reject,terms}, chiCrit(df,p), linreg(xs,ys) → {m,b,r2,xIntercept,predict}`.
- `Lab.rng(seed?)` — `uniform, normal(m,sd), int(a,b), pick, chance(p), shuffle, poisson, binomial`.
- `Lab.canvas(canvasEl, aspect, {fit})` → `{ctx,w,h,resize, onresize, check}` crisp HiDPI canvas (`fit:true` caps its height by the viewport; see "UI patterns"). `Lab.color('--accent')` reads a theme token at draw time (call inside draw so dark mode works). `Lab.loop(fn(dt))` → `{start,stop}` rAF loop. `Lab.reducedMotion()`.
- `Lab.store.get/set(key)` — per-browser save, namespaced to the lab. `Lab.fmt(x, digits)`. `Lab.h(tag, attrs, ...kids)`, `Lab.$`, `Lab.$$`.

Classroom features (automatic on every `labNN.html`; teacher pages get none of the student tools):
- **Identity + per-student data.** A site-wide name + class period (`localStorage['aplab:student']`) replaces the
  per-lab "Your name" field (still read as a fallback). On lab pages `Math.random` and unseeded `Lab.rng()` are
  seeded from hash(name | period | lab id | dataset number), so use them (not fixed seeds) for data that should
  differ per student.
  **The seed and Dataset ID are sticky:** the first time they are computed they are stored in `aplab:<lab>:dataset`
  (`{seed, str, datasetNumber, datasetId}`) and reused on every later load, even if the name, period or hash inputs change.
  Only "New dataset" (drops the record, bumps the number), Start over and Sign out change them. A progress file carries the record
  (it is one of the lab's stored keys), so a restore keeps the same ID. If no record exists the ID is computed as before and stored. `Lab.identity.get()/set()/newDataset()`, `Lab.identity.seed` → `{seed, datasetId, datasetNumber}`.
- **Report + save/resume** in the `[data-responses]` toolbar: `Lab.report.docx()` (docx@9.0.2 loaded lazily from
  jsDelivr), `Lab.report.open({print})` (print view for Save as PDF), `Lab.progressFile.payload/parse/apply/makeCode/readCode`.
- **Deep links + progress.** Sections get ids from `data-step` (`#root-tips`; old `#step-N`, `#evaluate-2` and `#reflect-2` still work; do not give an inner container the id `evaluate` or `reflect`, use e.g. `evaluate-prompts`) and a
  "Copy link" button. **One progress scheme:** a "part" counts only if it holds student work (prompt textareas, quiz
  questions, saved `Lab.table`s, required `Lab.steps` items); Overview, Background and Submit do not. A part is done when
  all of that work is done. **Two levels:** beside the part count, the nav (`.np-part`, wide screens) and the home card name
  the part under way (some, not all, of its items done; the current part if it qualifies) with its item count:
  "3 of 6 parts · Float assay 6/11 items", or "Started · Float assay 6/11 items" before any part is complete, never "0 of N"
  once work has begun ("Not started" before that). `aplab:progress:<lab>` = `{done, total, sections, items:{done,total}, partial:{id,name,done,total}, t}`;
  `Lab.progressText(summary)` builds the text. The completion rule is unchanged. The same number is used by the nav ("3 of 6 parts done"), the home cards and the
  teachers.html table ("10 parts (6 with work)"; regenerate with `node tools/gen-parts.js` after changing a lab's parts;
  `tests/t05b-teachers.js` checks it). **Setup rows are not work:** a row a page adds while loading (a starting row, preset
  rows) is tagged `_setup:true` and saved that way; `addRow(row, {setup:false})` / `setRows(rows, {setup:false})` force
  "student work" and `{setup:true}` forces setup (for rows added later, e.g. inside `Lab.onShow`). A required step counts
  once the student has completed it (remembered in `stepdone`, so reloads keep it); a step already satisfied when the page
  loads, or satisfied before the student touches anything, is left out. Give steps a stable `id`.
  `Lab.progress.update()` → `{done, total, sections}`, `Lab.progress.forLab('lab07')`; `Lab.home({identity, resume})` on index.
- **Time estimates and arrow keys.** `data-minutes="15"` on a `section.step` renders a "≈ 15 min" chip (read as "About 15 minutes") beside the part eyebrow and adds "≈ N min total" to the header tags; round to 5. In paged mode ← / → change part unless focus is in a text field, select, slider, tab or other arrow-key control, the tour is open, or a modifier is held.
- **First-visit tour.** After sign-in, the first lab page a browser opens shows a 5-step dismissible tour
  (`localStorage['aplab:tour']`, site-wide; `Lab.tour.start({force:true})`, `.reset()`; "Help" link in the sign-in line).
  It anchors to `.step-nav`, `.steps-box`, `.sim-tabs`, `.id-box`, `.report-bar`; a step whose element is hidden is
  explained without a highlight. In Playwright tests set `aplab:tour` first or the dialog covers the page.
- **Backup reminders + storage warnings.** `Lab.backup.state()` → `{answers, rows, meaningful, dirty, unsaved, lastSaved}`;
  saving a progress file or copying a resume code calls `Lab.backup.markSaved()`. After 3+ answers or a recorded row
  with no backup, a once-per-session dismissible bar offers "Save progress file" (never while a `Lab.loop` runs).
  A `beforeunload` guard is attached only while work is unsaved. Rows a page adds itself while loading are not work.
  Any failed localStorage write shows a persistent warning; `navigator.storage.persist()` is requested once work exists.
- **"Saved ✓" status.** Every `Lab.store.set` (prompts, tables, quizzes, steps, sim saves) updates `.save-status` lines (one in each part's pager, one under the Submit tools): "Saved ✓ just now" / "2 min ago", or "Not saved — see warning" when a write fails. Visible text is aria-hidden; a polite live region speaks only on state changes, at most every 4 s. Use `Lab.store.set` for anything a student would call saved work.
- **Key results.** `Lab.keyResult(id, {label, value, unit, part})` stores `keyres:<id>` = `{label, value, unit, part, t}`;
  `Lab.keyResults()` lists them. Call it whenever a headline number is computed (FRQ self-score: id `frq-score`, unit `of 4`).
  They appear in the report (Key results table), the progress file and the teacher dashboard.
- **Transfer code + Pause & bookmark.** "Get my transfer code" (Submit part, pause card) shows the resume code and a QR code
  for `labNN.html#resume=<code>` (qrcode-generator 1.4.4 from cdnjs, loaded lazily). lab.js strips `#resume=` from the address
  bar on load and offers an inline confirm. `Lab.pause()` saves, stores `aplab:bookmark` and opens the pause card; the home
  card prefers a bookmark newer than the last part visited. The .docx carries the full payload in custom properties
  `aplab_payload_NNN`; `teacher-dashboard.html` (JSZip 3.10.1 from cdnjs) reads them and progress files.
- **Pick up where you left off (index.html).** `Lab.home({resume:'#resume'})` fills a card with the lab, part, the part's last `Lab.steps` "Next:" hint (stored per lab in `aplab:hint:<lab>`), "n of m parts done" and a Resume button; hidden for new visitors.
- **Running page headers.** The .docx has a header (name, class, lab number and title) and footer (Dataset ID, Page n of N). The PDF report view and worksheet add `@page` margin boxes (Chromium 131+) and otherwise repeat a header through a one-cell table (`body.pr-fallback`, `.pr-t`, `.print-run`). Worksheets print "Name ____ Class ____".
- **Titles.** Lab page `<title>` is "Lab 5 · Photosynthesis — AP Bio Lab Bench"; page detection matches `^Lab N ·`; `cleanTitle()` strips the suffix in reports and worksheets.
- **Public teacher page.** `teachers.html` (kind `info`) has no sign-in, report tools, tour or backup prompts.
- **Worksheet.** `Lab.worksheet.print()` / `.enter()` / `.exit()` builds a printable sheet from `Lab.quiz`,
  `Lab.prompt` and `Lab.table` (blank rows: `worksheetRows` option, else preset `rows`, else 8).

CSS classes in `style.css`: `.wrap`, `.wrap--wide` (use for sections holding a `.sim`), `.gutter`, `.step`,
`.step-body`, `.prose`, `.lede`, `.callout` + `--question|--safety|--tip|--key` with `.callout-title`,
`.equation`, `.grid-2`, `.grid-3`, `.row`, `.stack`, `.sim` > `.controls` + `.stage`, `.viz` (canvas/svg
frame), `.field`, `.val`, `.seg` (segmented buttons with `aria-pressed`), `.check`, `.btn`, `.btn--primary`,
`.btn--sm`, `.btn--ghost`, `.readouts` > `.readout` > `.k` + `.v`, `.table-wrap`, `.cer` (wrap 3 prompts;
put `data-letter="C"` etc. on each prompt's `<label>`), `.pill` (`.ok|.warn|.bad`), `details.disclose` >
`summary` + `.inner`, `.tags`/`.tag`, `.eyebrow`, `.muted`, `.small`.
Colors: only `var(--token)` values; never literal hex in your page CSS or canvas drawing (use `Lab.color`).
Tokens: --bg --surface --surface-2 --ink --muted --line --accent --accent-ink --accent-soft --stain
--stain-soft --ok --warn --bad (+ -soft) --s1…--s6 (series) --grid.

## UI patterns (laptop layout) — `lab05.html` is the reference implementation
Target: Windows laptops at 1366×768 (also 1280×720, 1440×900, 1920×1080, and 400 px phones). A part must
be usable without hunting: the simulation scene, its controls and its results fit on one screen.
Everything below is in `lab.js` / `style.css`; a lab opts in through markup classes and a few calls.

### 1. Paged mode (automatic on every `labNN.html`)
Lab pages show **one `section.step` at a time** (`body.paged`, current part has `.is-current`) with
Back / Next links at the bottom of each part ("Next: Float assay →"). Nothing to do in your markup.
- Hash links open the part: `#float-assay`, legacy `#step-5` (rewritten to the slug), or any element id
  inside a part (`#p-a1` opens Analyze and scrolls to that box). A part change scrolls to the part's top,
  focuses its `<h2>`, updates the hash (browser Back works) and records "resume where you left off".
- **All parts** toggle (step nav, and "Show all parts on one page" in each pager) shows the whole lab;
  remembered per browser in `aplab:ui:allParts`. Ctrl+F offers it once; Ctrl+P, the worksheet and the
  report always read every part. Progress checks, the report, worksheet and progress file read hidden
  parts too.
- Hidden parts have no width. When a part is shown, every `Lab.canvas` in it is resized and its
  `onresize` redraw runs, charts re-render, `Scope.view` canvases redraw, and a `resize` event fires.
  So **always set `cv.onresize = draw`** (or use a ResizeObserver) and never cache a canvas width at load.
- `Lab.onShow(partOrAnyElementInIt, fn)` runs `fn(section)` each time that part becomes visible (and once
  right away if it is visible). Use it for anything else that measures itself. Returns an unsubscribe.
- `Lab.pages` → `{on, current(), go(idOrEl), showAll(bool), list()}` e.g. `Lab.pages.go('float-assay')`.
- Never call `scrollIntoView` on something in another part without `Lab.pages.go(...)` first.

### 2. Laptop-fit simulation: `.sim.sim--fit`
Before (procedure paragraphs above a sim whose scene + controls are taller than the screen):
```html
<section class="step wrap wrap--wide gutter" data-step="Float assay">
  <header>…</header>
  <div class="step-body">
    <div class="prose"><p>Put both cups under the lamp…</p><p>Before you start…</p></div>
    <div class="sim">
      <div class="controls">…every control…</div>
      <div class="stage"><canvas class="viz" id="cup-viz" …></canvas><div class="readouts">…</div></div>
    </div>
    <div id="cup-table"></div><div id="cup-chart"></div>
```
After (section gets `wrap--sim`; steps checklist + controls in the left column; the long wording moves
into a "Full procedure" disclosure; rarely used controls into "More options"):
```html
<section class="step wrap wrap--wide wrap--sim gutter" data-step="Float assay">
  <header>…</header>
  <div class="step-body">
    <div class="sim sim--fit" id="cup-sim">
      <div class="sim-side">
        <div id="cup-steps"></div>                      <!-- Lab.steps renders here -->
        <div class="controls">
          <p class="controls-title">Controls</p>
          …the 2–4 controls used every run (slider, Start button)…
          <details class="more"><summary>More options</summary><div class="inner">…speed, fixed conditions…</div></details>
        </div>
        <details class="disclose disclose--sm"><summary>Full procedure</summary><div class="inner">
          <p>…the original procedure paragraphs, unchanged…</p>
        </div></details>
      </div>
      <div class="stage"><canvas class="viz" id="cup-viz" …></canvas><div class="readouts">…</div></div>
    </div>
    <div id="cup-table"></div><div id="cup-chart"></div>  <!-- Lab.results moves these beside the scene -->
    …calculations and prompts stay below the sim…
```
```js
const cupcv = Lab.canvas('#cup-viz', 0.55, { fit: true });   // height capped by the viewport, never cropped
```
- `fit:true` sets the canvas `max-width` to `(viewport height − var(--fit-reserve)) ÷ aspect`; the drawing
  just gets smaller. For `Scope.view`/`Scope.still`, call `Lab.fitHeight(canvasEl, aspect)` before
  creating the view (Scope reads its CSS width). `Lab.fitHeight(el, aspect, '320px')` takes a custom reserve.
- Budget at 1366×768: the whole `.sim--fit` box ≤ 600 px tall. The left column is usually the tallest
  thing: keep step texts to ~30 characters (one line), at most ~6 steps, and ≤ 4 visible controls.
- Keep every control `id`, label and listener; only move the markup.

### 3. Results beside the simulation: `Lab.results`
```js
Lab.results('#cup-sim', { graph: ['#cup-chart'], data: ['#cup-table'] });
Lab.results('#d-sim', {
  graph: [{ el: '#d-chart', title: 'Rate: mean 1/ET₅₀ ± 2 SE' }, { el: '#d-chart2', title: 'Median ET₅₀' }],
  data:  [{ el: '#d-sum', title: 'Summary by level' }, { el: '#d-raw', title: 'ET₅₀ for every cup' }] });
```
Moves existing `Lab.chart` / `Lab.table` containers (ids unchanged) into a results panel:
- **≥1280 px:** the scene stays visible and a right-hand column (36%) switches **Graph ⇄ Data**. Students
  watch the graph build while the run plays; this is the layout at 1366×768.
- **<1280 px:** a **Scene / Data / Graph** switch above the scene; Data and Graph cover the scene in the
  same box (the canvas keeps its size), so nothing below moves.
- A "new" badge appears on a tab whose table/chart changed while it was not showing (not for restored data).
- Charts inside a panel draw at their real width so axis text stays 12 px (any chart can opt in with
  `Lab.chart(el, {responsive:true, …})`); the report always uses a full-size 640-wide copy.
- ARIA tabs: arrow keys / Home / End, `aria-selected`, `role=tabpanel`. Returns `{select('graph'|'data'|'scene')}`.

### 4. Guidance inside sims: `Lab.steps` and `Lab.gate`
```js
Lab.steps('#cup-steps', [
  { id: 'ready', text: 'Sink and pour the disks', target: '#inf-pour', done: () => poured || rows().length > 0,
    hint: 'Go back to <a href="#sink-disks">Sink disks</a>, sink the disks and pour them.' },
  { id: 'start', text: 'Start the timer', target: '#cup-run', done: () => rows().length > 1 },
  { id: 'dark', text: 'Cover the cups (dark)', target: '#cup-dark', optional: true, done: () => … },
  { id: 'qs', text: 'Answer the 3 questions (below)', target: '#p-p-ctrl', done: () => … },
], { doneText: 'Assay done. Next, design your own test in <a href="#design">Design</a>.' });
Lab.gate('#cup-run', () => poured || rows().length ? '' : 'Pour the disks first (Sink disks part)');
```
- Numbered checklist; the first unfinished non-optional step is current (highlighted, `aria-current="step"`),
  a one-line **Next:** hint (`hint`, else `text`) sits under it, and the step's `target` control gets a
  gentle pulsing outline (static under reduced motion). "Show me" also lands a **ring** on the target (`Lab.highlight(el, {ms})`, also usable from lab pages): a fixed-position two-tone frame with a glow and three expanding pulses, about 2.5 s once scrolling has settled (a steady ring under reduced motion, hidden in print). It follows the target while the page scrolls and works for targets in closed `details`, hidden Data/Graph/tab panels and other parts. Each step with a `target` has a small "Show me ↓" button
  (it only scrolls, so it is labelled that way; the step text is plain): it opens the control's part, closed
  "More options", and Data/Graph tab if needed, pulses the control for a few seconds and focuses it (and
  opens its part if it is elsewhere). `sticky:true` keeps a step ticked once done.
- `done()` is re-checked after every input/change/click, after table/quiz/answer changes, every 0.6 s, and
  on `Lab.steps.refresh()`. Base it on saved state too (tables, prompts) so a reload shows real progress.
- `Lab.gate(button, fn, {show: target})` (optional `show`) adds a "Show me ↓" button next to the reason.
- `Lab.gate(button, fn)` disables the button while `fn()` returns a reason and shows the reason under it
  (`#<id>-why`, linked by `aria-describedby`). Do not gate buttons that page code also disables itself,
  and let saved data pass the gate (students who reload must not be locked out).

### 5. Reading parts: Key ideas, Key terms, collapsible subsections, wide layout
Before: a single 68ch column of paragraphs and diagrams next to empty space.
After (section becomes `wrap--wide`; nothing deleted — subsections move into `details.disclose`):
```html
<div class="step-body split">
  <div class="split-main prose">
    <div class="callout callout--key key-ideas"><div class="callout-title">Key ideas</div>
      <ul><li>3–5 one-sentence bullets drawn from the text below</li></ul></div>
    <p>…the opening paragraph and equation stay visible…</p>
    <details class="disclose"><summary>Why the disks sink and rise</summary><div class="inner">
      …the subsection's paragraphs and diagram, unchanged…</div></details>
  </div>
  <aside class="split-side glossary" aria-labelledby="bg-terms">
    <div class="callout-title" id="bg-terms">Key terms</div>
    <dl><dt>Net photosynthesis</dt><dd>Gross photosynthesis minus the O₂ used by respiration.</dd>…</dl>
  </aside>
</div>
```
- `.split` = main + 300 px side column at ≥1100 px (Overview: objectives left, safety/practices right).
- Closed `details` still match Ctrl+F (Chrome), open for printing, and print in full on the worksheet.
- `Lab.tabs(el)` turns `<div><section data-tab="Label">…</section>…</div>` into ARIA tabs if a part
  really needs tabs (all tabs still print on the worksheet). Prefer `details`.
- Pre-lab: `<div id="prelab" class="quiz--cols">` = two quiz columns at ≥1100 px.
  Prompt groups: put prompts in a `.prompts-2` container (two columns at ≥1100 px).

### 6. Toasts: `Lab.toast(msg, {type, timeout, key, announce, action})`
`type`: `ok` (default) | `info` | `warn` | `bad`. Polite live region, bottom right (bottom, full width on
phones), clear of safe areas. `key` replaces an earlier toast with the same key; `announce:false` shows it
without announcing (use when an `aria-live` status already says the same); `action:{label, onClick}` adds
one button. Automatic toasts: saved answers (after typing pauses, at most every 45 s), quiz checks,
"Recorded trial N" for `Lab.table` with `save` (`addRow`/`setRows`), copy responses, .docx download,
progress file, resume code, copy link, name saved. Table options: `toast: false | 'text' | (rows, added) => 'text'`.
For rows that stream in during an animation (one per simulated minute) set `toast:false` and call
`Lab.toast('Recorded minutes 0–20…')` when the run ends.

### 7. Step nav
Compact items, ‹ › scroll arrows and edge fades when 10–12 parts do not fit, the current part kept in view,
"n of m parts done" and the All parts toggle pinned at the right. Keep `data-step` names short (≤ 14
characters, e.g. "Root tips", not "Effects of environment on mitosis").

### 8. Input validation: `Lab.validate`
Use it for every calculator or numeric entry, so the messages look and behave the same on every lab.
```js
const n = Lab.validate.number($('#ttest-n'), { min: 2, integer: true, label: 'Number of measurements' });
if (n == null) return;                       // a message is already showing under the field; do not compute
const p = Lab.validate.number($('#p-in'), { min: 0, max: 1, label: 'p' });   // "p must be between 0 and 1."
if (p == null) return;
Lab.validate.show($('#csv'), 'Enter at least 2 measurements for each group.');   // custom rule
Lab.validate.clear($('#csv'));
```
- `Lab.validate.number(inputEl, {min, max, integer, required = true, label})` returns the number, or `null` after
  showing the message. Rejects empty ("Enter a value for p."), non-numeric, non-whole (`integer:true`) and
  out-of-range input ("… must be between 0 and 1." / "at least 2" / "at most 100"). It never clamps. `label`
  defaults to the field's `aria-label` or `<label>`. With `required:false` an empty field returns `null` with no message.
- `Lab.validate.show(inputEl, msg)` / `.clear(inputEl)` do the display part for any rule you check yourself. The
  message is a `<p class="feedback bad field-msg" role="alert">` right under the field (under its row if the
  field sits in a flex/grid row); the field gets `aria-invalid="true"` and `aria-describedby` to the message,
  and both go away when `clear` runs or, for `number()`, as soon as the field holds a valid value again.
- Do not compute or draw a result while a message is showing. Never silently clamp; if you must change a value,
  say so ("p can't be more than 1, so it was set to 1").

### 9. Microscope zoom (`Scope.view`)
Every `Scope.view` has a zoom of 1× to 3× (−/+ buttons, Ctrl/⌘ + wheel, pinch on touch, keys + − 0) that works with
panning. Lab pages get it automatically; keep using `onClick(x, y)` and `view.toWorld()` (both are zoom-aware)
and draw marks in `overlay()` (world units). If a page draws its own `hud` function, multiply its scale-bar length
by `view.zoom` (second argument: `hud: (ctx, view) => …`). Pass `{ zoom: false }` to opt out.

### `Lab.onShow` example
```js
// Something that measures itself (not a Lab.canvas, Lab.chart or Scope view, which are handled for you):
Lab.onShow('#gel-wrap', sec => layoutGel($('#gel-wrap').clientWidth));
```

### Pitfalls (seen while building Lab 5)
- **Canvases drawn while hidden.** A canvas created in a hidden part is first drawn at a guessed width;
  drawing code must not throw at small sizes (e.g. negative `ellipse` radii: clamp with `Math.max(0, …)`)
  and must redraw from `onresize`. Never read `clientWidth` once at load and keep it.
- **Moving nodes, not rebuilding them.** `Lab.results` moves the existing containers. Do not recreate a
  table/chart in a new element, do not change its `id`, `save` key or columns: the report, worksheet,
  progress checks and saved data all depend on them. Leave an empty `<details>` behind? Remove it.
- **Gates that lock students out.** A gate based only on in-memory state (`poured`) blocks a student who
  reloads. Always also accept saved evidence (`table.getRows().length`).
- **Toast spam.** Rows added once per animation frame/minute: `toast:false` on the table and one toast
  at the end. Never toast on every keystroke (autosave already debounces).
- **`done()` that throws or is slow.** It runs every 0.6 s: read state, don't compute simulations in it.
- **Step text too long.** Two-line steps push the left column past 768 px. ≤ 30 characters; put detail
  in `hint`.
- **Links to other parts.** Use `href="#slug"` (paged mode opens the part) or `Lab.pages.go('slug')`;
  never `scrollIntoView` an element in a hidden part.
- **Pulse targets.** Point `target` at the actual control (button/select/input), not a wrapper, so
  clicking the step focuses something useful.
- **Slugs.** Section ids come from `data-step`; renaming a `data-step` breaks old deep links, saved
  "resume" links and the progress summary. Don't rename parts while converting.
- **Playwright tests:** after clicking Next, wait (~250 ms) before locating `section.step.is-current`
  again; the part changes on `hashchange`.

### Acceptance tests for a converted lab
Run with `python3 -m http.server` in the repo and Playwright (Chromium):
1. `shot.js` on the lab at 1366 light and 400 dark: `errs: []`, `horizontalOverflow: 0`.
2. At 1366×768 open each sim part from the nav and measure:
   ```js
   const r = document.querySelector('section.step.is-current .sim--fit').getBoundingClientRect();
   const side = document.querySelector('section.step.is-current .sim-side');
   // pass: r.bottom <= 768 && r.height <= 712 && side.scrollHeight <= side.clientHeight
   //       and every visible button/select/input in .sim-side has bottom <= 768
   ```
   Repeat at 1280×720 (r.bottom ≤ 720).
3. IDs unchanged: `grep -o 'id="[^"]*"'` on the old and new file; the new set must be a superset.
   Saved-state keys unchanged: the same `save:` / `data-save` / `Lab.prompt` `key`s and quiz ids.
   Graders unchanged: every quiz/`Check` button gives the same verdict for the same input.
4. Page through every part with Next and Back: exactly one part visible, hash updated, heading focused.
   Open `#<slug>`, `#step-N` and an inner element id directly.
5. Run every procedure from the steps checklist only: each step ticks, gated buttons show their reason
   then enable, the results panel updates, a "new" badge appears on the hidden tab, toasts appear.
6. Download the .docx (serve the docx UMD from the npm package; the CDN is blocked in the sandbox),
   open `Lab.report.open()` and `Lab.worksheet.enter()`: every part with student work appears, plus
   Overview/Background prose (disclosures expanded) on the worksheet.
7. Reload: tables, answers and the steps' ticks come back; no "new" badges or table toasts on reload.
8. 1100 px wide: Scene / Data / Graph switch works with arrow keys. Dark mode looks right.
Lab 5's full version of these checks (92 assertions) is `lab05.test.js` in the UI builder's scratchpad (`/tmp/claude-0/-home-user-apbiolabs/7e2baecf-cce5-5f50-9108-1aa82922f719/scratchpad/ui/`); copy it and swap the selectors.

### Converting a lab (phase 2 checklist)
1. Overview, Background, Pre-lab, Analyze, Evaluate, Submit sections → `wrap wrap--wide`; sim sections →
   `wrap wrap--wide wrap--sim`.
2. Overview → `.split` (lede + objectives left; practices + safety right).
3. Background → Key ideas (3–5 bullets from the existing text), opening paragraph visible, every `<h3>`
   subsection into `details.disclose` (summary = the old h3 text), Key terms `aside.glossary` (4–7 terms).
   Delete nothing.
4. Pre-lab container gets `quiz--cols`; prompt groups get `.prompts-2` (create a wrapper div in JS when
   prompts are appended to the step body directly).
5. Each `.sim` → `.sim.sim--fit` with `.sim-side` (steps div, `.controls` with `controls-title`, rare
   controls in `details.more`, original procedure paragraphs in `details.disclose--sm` "Full procedure").
   Keep all ids. Give the sim an id.
6. Every `Lab.canvas(...)` in a sim → add `{ fit: true }`; Scope views → `Lab.fitHeight(cv, aspect)` first.
   Check every canvas has an `onresize` redraw (or `Lab.onShow`).
7. `Lab.results(sim, {graph, data})` for the tables/charts that belong to that sim (after they are created).
8. `Lab.steps` per sim (≤ 6 one-line steps, a `target` for each, `hint` where the next action is not
   obvious, `done()` that also reads saved tables/prompts) and `Lab.gate` for buttons whose prerequisite
   is not met; the gate must pass when saved data exists.
9. Streaming tables: `toast:false` + one `Lab.toast` at the end of the run; add toasts for key moments
   (e.g. "All disks sunk"), with `announce:false` where a live feedback line already exists.
10. Test at 1366×768: open each sim part from the nav; the `.sim--fit` box must end above 768 px and need
    no inner scrolling (also 1280×720). Then 1100 px (Scene/Data/Graph switch), 400 px phone, dark mode,
    zero console errors, no sideways scroll, the .docx/worksheet still list every part, and reload keeps
    the steps ticked from saved data. `lab05.html` shows every pattern.

## Required structure of `labNN.html` (sections in this order; adapt names to the lab)
1. **Overview** — the lab's driving question, what students will do, learning objectives & science
   practices (codes from the manual, e.g. ENE-2.H, 4.A), and a safety callout if the real lab has hazards.
2. **Background** — concise, accurate explanation in your own words (aim 300–700 words), with equations
   and at least one diagram (inline SVG or canvas) where the concept is visual.
3. **Pre-lab** — 5–8 `Lab.quiz` questions drawn from the manual's prelab/"Getting Started" items, including
   calculations where the lab has them. Every question has an explanation.
4. **Structured investigation(s)** — one section per procedure/part in the manual. Each gets a
   **working simulation** that reproduces the real procedure (materials, steps, measurements) and generates
   realistic, noisy data from a scientifically sound model (state the model in a comment). Students choose
   settings, run trials, and results flow into a `Lab.table` and `Lab.chart`. Include replicate trials and
   variability so means/SE/error bars are meaningful. Where the manual has students record observations or
   do calculations, make them do it (editable columns or quiz/num questions), not just watch.
5. **Design your own investigation** — mirrors the manual's "Designing and Conducting Your Investigation":
   student writes question + hypothesis (prompts), picks an independent variable from the options the
   manual suggests, sets levels & replicates, identifies controls, runs the sim, graphs, and analyzes with
   the appropriate statistic (SE/95% CI error bars, chi-square, regression, etc.).
6. **Analyze** — the manual's "Analyzing Results" questions as prompts, a CER block (`.cer`), and any
   statistics tool needed (e.g. chi-square calculator).
7. **Evaluate / Reflect** — the manual's evaluation/"where can you go from here" questions as prompts.
8. **Submit** — `<div data-responses></div>`.

Simulations are the heart of the product. Make them visual and genuinely interactive (animated canvas or
SVG of the apparatus/organism/gel/etc.), with controls labelled with real units, and physically sensible
outputs (e.g. water potential −iCRT, Q10 ≈ 2 for respiration, Michaelis–Menten + denaturation for enzymes,
Hardy–Weinberg with selection/drift/migration, gel band migration ∝ log(bp), Beer–Lambert, etc.).
Reproduce numbers from the manual's sample data where given so results look like the real lab.
For labs that rely on outside software (BLAST, spreadsheet models), build an in-page equivalent
(e.g. a small sequence-alignment/identity tool with real-looking sequences, a spreadsheet-style model)
and link to the real tool with a normal `<a href>` as an optional extension.

## Teacher page `teacher-labNN.html`
Same skeleton/footer. Sections: At a glance (timing, unit, objectives, practices), Preparation & real
materials list (summarized), How the simulation maps to the bench procedure (and its limits), Common
misconceptions, Suggested answers/expected results for the pre-lab and analysis questions, Ideas for
student-designed investigations, Extensions. Use `Lab.init({id:'teacher-labNN'})`.
Answer keys belong only here, never on the student page (except pre-lab quiz explanations).

## Writing rules
- Write in your own words. Paraphrase the manual; do not paste long passages. Short quotations of a
  driving question or a single prompt are fine. No College Board logos or branding beyond the footer.
- Plain, direct sentences for 16–18-year-olds. Correct units, subscripts (`<sub>`), and symbols.
- Use real content everywhere; no placeholders, no lorem ipsum, no "TODO".
- Accessibility: every control has a `<label>`/aria-label and a stable `id`; canvases get `aria-label`
  and the key numbers are also shown as text readouts.
- The page must work at 400px wide with no horizontal page scroll, and in dark mode.
- Pages open in a working state: show the apparatus drawn and controls set to sensible defaults.

## Test before you finish
Open both pages in a browser at desktop width and at about 400px wide, in light and dark mode. Check the
console for errors, make sure the page never scrolls sideways, and exercise every simulation control.
