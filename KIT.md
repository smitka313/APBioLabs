# AP Bio Lab Bench — build guide for lab pages

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
- `Lab.chart(el, {type:'xy'|'bar', xLabel, yLabel, xMin,xMax,yMin,yMax, height, series:[{name,points:[{x,y,err}],line,dots,fit:'linear',dash}], categories, hLines:[{y,label}], annotations:[{x,label}]})` → `{update(partial)}`. Error bars via `err` (use 2×SE for AP-style 95% CI). Colors come from CSS tokens automatically.
- `Lab.stats` — `mean, sd, se, ci95, median, sum, chiSquare(obs,exp) → {chi2,df,crit,reject,terms}, chiCrit(df,p), linreg(xs,ys) → {m,b,r2,xIntercept,predict}`.
- `Lab.rng(seed?)` — `uniform, normal(m,sd), int(a,b), pick, chance(p), shuffle, poisson, binomial`.
- `Lab.canvas(canvasEl, aspect)` → `{ctx,w,h,resize, onresize}` crisp HiDPI canvas. `Lab.color('--accent')` reads a theme token at draw time (call inside draw so dark mode works). `Lab.loop(fn(dt))` → `{start,stop}` rAF loop. `Lab.reducedMotion()`.
- `Lab.store.get/set(key)` — per-browser save, namespaced to the lab. `Lab.fmt(x, digits)`. `Lab.h(tag, attrs, ...kids)`, `Lab.$`, `Lab.$$`.

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
