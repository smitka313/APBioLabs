'use strict';

// Classroom regression for the five-generation B.4 Lesson 3 model.
// This browser path independently counts ratios from actual genotype totals.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { serve, ROOT } = require('./_h');

const FILE = 'openscied-b4-rat-generations.html';
const SAVE = 'aplab:openscied:b4-rat-generations:v1';
const OUT = path.join(ROOT, 'artifacts', 'openscied-rat-generations');
const AXE = require.resolve('axe-core/axe.min.js');
const VIEWPORTS = [
  { width: 390, height: 844, dark: true, touch: true, seed:0 },
  { width: 768, height: 1024, seed:5 },
  { width: 1366, height: 768, animate: true, seed:5 },
  { width: 1920, height: 1080, seed:0 }
];
const GENOTYPES = ['RR', 'RB', 'BB'];
const EXAMPLE_TEXT = {
  claim: 'Rats with at least one R allele were able to survive exposure in the classroom model.',
  evidence: 'I compared R allele copies, carriers born, and survival fractions. Their denominators were different.',
  limits: 'This small deterministic cross model does not estimate a future resistance percentage in Tokyo.'
};
const STUDENT = { name: 'Rat Generations QA', period: '4' };
const clean = text => (text || '').replace(/\s+/g, ' ').trim();
let checks = 0;
function check(test, label) {
  assert.ok(test, label);
  checks++;
  console.log('ok: ' + label);
}
const compact = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const trialTag = seed => 'RG-' + seed.toString(16).toUpperCase().padStart(8, '0');
const save = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), SAVE);

async function makeContext(browser, base, cfg) {
  const context = await browser.newContext({
    viewport: { width: cfg.width, height: cfg.height },
    colorScheme: cfg.dark ? 'dark' : 'light', reducedMotion: cfg.animate ? 'no-preference' : 'reduce',
    hasTouch: !!cfg.touch, acceptDownloads: true
  });
  const origin = new URL(base).origin;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  // Two deterministic classroom fixtures exercise both even and odd
  // breeder counts. The live app still makes a fresh trial on its own.
  await context.addInitScript(({ file, seed }) => {
    if (location.pathname !== '/' + file) return;
    const random = window.crypto.getRandomValues.bind(window.crypto);
    window.crypto.getRandomValues = array => {
      if (array instanceof Uint32Array && array.length === 1) {
        array[0] = seed;
        return array;
      }
      return random(array);
    };
  }, { file:FILE, seed:cfg.seed });
  return context;
}
function stepButton(page, name) {
  return page.locator('nav [data-rg-go="' + name + '"]').first();
}
async function use(element, cfg) {
  if (cfg.touch) await element.tap();
  else await element.press('Enter');
}
async function enterStage(page, name, cfg) {
  const target = stepButton(page, name);
  await use(target, cfg);
  await page.locator('#rg-' + name).waitFor({ state: 'visible' });
  check(await target.getAttribute('aria-current') === 'step' &&
    await page.locator('nav [data-rg-go][aria-current="step"]').count() === 1,
    name + ' is the only active investigation step');
}
async function waitAction(page, action) {
  await page.waitForFunction(({ key, action }) => {
    try { return JSON.parse(localStorage.getItem(key))?.action === action; }
    catch (_) { return false; }
  }, { key: SAVE, action });
}
async function fits(page, selectors, label) {
  const offscreen = await page.locator(selectors).evaluateAll(elements => {
    const viewport = document.documentElement.clientWidth;
    return elements.flatMap(element => {
      const r = element.getBoundingClientRect();
      return r.width && r.height && (r.left < -1 || r.right > viewport + 1)
        ? [element.id || element.tagName] : [];
    });
  });
  check(offscreen.length === 0 && await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    label + ' fits the viewport without horizontal clipping: ' + offscreen.join(', '));
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true,
    animations: 'disabled', timeout: 15000 });
}
async function axe(page, scope, label) {
  if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: AXE });
  const violations = await page.evaluate(async scope => {
    const result = await window.axe.run(scope, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      resultTypes: ['violations']
    });
    return result.violations.map(v => [v.id, v.nodes.map(node => node.target)]);
  }, scope);
  check(violations.length === 0, label + ' accessibility: ' + JSON.stringify(violations));
}
function readFraction(text) {
  const match = clean(text).match(/(\d+)\s*\/\s*(\d+)/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}
function measures(counts, birthTotal, phase) {
  const total = counts.RR + counts.RB + counts.BB;
  return {
    allele: [2 * counts.RR + counts.RB, 2 * total],
    carrier: [counts.RR + counts.RB, total],
    survival: phase === 'survived' ? [total, birthTotal] : null
  };
}

const Model = require('../openscied-b4-rat-generations-logic.js');

function count(records) {
  const counts = { RR: 0, RB: 0, BB: 0 };
  for (const record of records) {
    assert.ok(Object.hasOwn(counts, record.genotype), 'the model produced a valid genotype');
    counts[record.genotype]++;
  }
  return counts;
}
const hasFraction = (display, numerator, denominator) =>
  compact(readFraction(display), [numerator, denominator]);
function comparePercent(display, [num, denom]) {
  const match = clean(display).match(/(\d+(?:\.\d+)?)\s*%/);
  return denom ? !!match && Math.abs(Number(match[1]) - 100 * num / denom) <= .51 :
    !match && !/(?:NaN|Infinity)/.test(display);
}
async function expectBoard(page, model, action, label) {
  const current = model.generations[model.generations.length - 1];
  const selection = action?.action === 'select';
  const expected = count(selection ? current.survivors : current.born);
  const tiles = await page.locator('#rg-colony [data-rg-genotype]').evaluateAll(nodes =>
    nodes.map(node => [node.dataset.rgGenotype,
      node.querySelector('[data-rg-count]')?.textContent.trim() ?? node.textContent.match(/\d+/)?.[0] ?? '']));
  check(tiles.length === 3 && GENOTYPES.every(g => tiles.some(([key,value]) =>
    key === g && String(expected[g]) === String(value).trim())),
    label + ' lists the exact RR, RB and BB totals for the ' + (selection ? 'survivor' : 'birth') + ' phase');
}
async function inspectPair(page, row, cfg, label) {
  const displayed = await page.locator('#rg-pairs [data-rg-pair]').evaluateAll(buttons =>
    buttons.map(button => button.dataset.rgPair).sort());
  check(compact(displayed, row.pairs.map(pair => pair.id).sort()),
    label + ' provides an accessible control for each recorded cross');
  const chosen = row.pairs[row.pairs.length - 1];
  const pair = page.locator('#rg-pairs [data-rg-pair="' + chosen.id + '"]');
  check(await pair.isVisible() && await pair.evaluate(el => el.tagName === 'BUTTON' && el.getBoundingClientRect().height >= 24),
    label + ' the selected cross has a visible, full-size button for keyboard and touch');
  await use(pair, cfg);
  const square = page.locator('#rg-punnett');
  await square.waitFor({ state: 'visible' });
  const cells = await square.locator('[data-rg-cell]').evaluateAll(nodes =>
    nodes.map(node => node.textContent.trim()));
  const accessibleSquare = await square.getByRole('img').getAttribute('aria-label');
  check(compact(cells, chosen.cells) && await pair.getAttribute('aria-pressed') === 'true' &&
    accessibleSquare.includes(chosen.cells.join(', ')),
    label + ' inspecting the selected cross presents and announces its four actual Punnett cells');
  if (row.pairs.some(item => item.reused)) check(/odd.*one parent is used in two pairings/i.test(await square.innerText()),
    label + ' explains why one parent is paired twice when the surviving group is odd');
}
function expectedRows(model) {
  return model.generations.flatMap(row => {
    const entries = [{ generation:row.generation, phase:'born', counts:count(row.born), births:row.born.length }];
    if (Array.isArray(row.survivors)) entries.push({
      generation:row.generation, phase:'survived', counts:count(row.survivors), births:row.born.length
    });
    return entries;
  });
}
async function parity(page, root, model, label) {
  const displayed = await page.locator(root + ' [data-rg-generation][data-rg-phase]').evaluateAll(rows =>
    rows.map(row => ({
      generation:Number(row.dataset.rgGeneration), phase:row.dataset.rgPhase,
      counts:Object.fromEntries([...row.querySelectorAll('[data-rg-count]')].map(node =>
        [node.dataset.rgCount, node.textContent.trim()])),
      measures:Object.fromEntries([...row.querySelectorAll('[data-rg-measure]')].map(node =>
        [node.dataset.rgMeasure, node.textContent.trim()]))
    })));
  const expected = expectedRows(model);
  check(compact(displayed.map(row => [row.generation, row.phase]), expected.map(row => [row.generation, row.phase])),
    label + ' shows the official five birth rows and only the two modeled exposure checkpoints');
  for (const [i, reference] of expected.entries()) {
    const row = displayed[i];
    check(GENOTYPES.every(g => Number(row.counts[g]) === reference.counts[g]),
      label + ' G' + row.generation + ' ' + row.phase + ' exact genotype counts');
    for (const [key, fraction] of Object.entries(measures(reference.counts, reference.births, row.phase))) {
      const display = row.measures[key] || '';
      check(fraction ? hasFraction(display, ...fraction) && comparePercent(display, fraction) :
        readFraction(display) === null && /not exposed|not tested|not applied|not applicable|none|—|–/i.test(display),
      label + ' G' + row.generation + ' ' + row.phase + ' ' + key + ' uses the correct fraction and denominator');
    }
  }
  return displayed;
}
async function reportCheck(page, state) {
  await page.locator('#rg-name').fill(STUDENT.name);
  await page.locator('#rg-period').fill(STUDENT.period);
  const downloaded = page.waitForEvent('download');
  await page.locator('#rg-download').press('Enter');
  const file = await downloaded;
  const report = await fs.readFile(await file.path(), 'utf8');
  check(file.suggestedFilename() === 'rat-generations-investigation.txt' && /Rat Generations/i.test(report) &&
    report.includes('Name: ' + STUDENT.name) && report.includes('Class period: ' + STUDENT.period) &&
    /simulation|simulated|classroom model/i.test(report) && report.includes('Dataset ID: ' + trialTag(state.seed)) &&
    Object.values(state.answers || {}).filter(Boolean).every(answer => report.includes(answer)),
    'the actual downloadable investigation includes local report labels, model disclosure, and saved writing');
  for (const row of expectedRows(ModelAt(state.seed, 6))) {
    const { allele, carrier, survival } = measures(row.counts, row.births, row.phase);
    const prefix = 'G' + row.generation + ' ' + (row.phase === 'born' ? 'Born' : 'Survived') + ':';
    const line = report.split(String.fromCharCode(10)).find(text => text.startsWith(prefix)) || '';
    const countText = GENOTYPES.map(type => type + ' ' + row.counts[type]).join(', ');
    check(line.includes(countText) && [allele, carrier, survival].filter(Boolean).every(([a,b]) =>
      line.includes(a + ' / ' + b)) && /survival/i.test(line) === Boolean(survival),
      'the report includes all measures for generation ' + row.generation + ' ' + row.phase);
  }
  await page.locator('#rg-copy').press('Enter');
  const copy = page.locator('#rg-copy-dialog');
  await copy.waitFor({ state:'visible' });
  check(await page.locator('#rg-copy-text').inputValue() === report,
    'the copy fallback contains the same complete evidence and writing as the download');
  await page.keyboard.press('Escape');
  await copy.waitFor({ state:'hidden' });
}
function ModelAt(seed, actions) {
  let model = Model.create(seed);
  for (let i = 0; i < actions; i++) model = Model.step(model);
  return model;
}

const PHASES = [
  [1,'born'],[2,'born'],[3,'born'],[3,'survived'],[4,'born'],[4,'survived'],[5,'born']
];
async function events(page, step, label) {
  const event = page.locator('#rg-events');
  const [generation, phase] = PHASES[step];
  await page.waitForFunction(({ step, generation, phase }) => {
    const event = document.querySelector('#rg-events');
    return Number(event?.dataset.rgAction) === step &&
      Number(event?.dataset.rgGeneration) === generation && event?.dataset.rgPhase === phase;
  }, { step, generation, phase });
  check(await event.isVisible() && (await event.innerText()).trim().length > 20,
    label + ' identifies generation ' + generation + ' ' + phase + ' and its model event');
}
async function plots(page, model, cfg, label) {
  const chart = page.locator('#rg-chart');
  const snapshots = [];
  for (const metric of ['population', 'carrier', 'allele']) {
    const toggle = page.locator('#rg-metrics button[data-rg-metric="' + metric + '"]');
    await use(toggle, cfg);
    check(await toggle.getAttribute('aria-pressed') === 'true' &&
      await page.locator('#rg-metrics button[aria-pressed="true"]').count() === 1 &&
      await chart.isVisible(), label + ' shows the selected ' + metric + ' view and marks its control pressed');
    const accessiblePlot = await chart.getByRole('img').getAttribute('aria-label');
    const rows = expectedRows(model);
    check(rows.every(row => {
      const fractions = measures(row.counts, row.births, row.phase);
      const n = Object.values(row.counts).reduce((total, value) => total + value, 0);
      const metricLabel = metric === 'population' ? String(n) : (() => {
        const [numerator, denominator] = fractions[metric];
        return new Intl.NumberFormat('en-US', { maximumFractionDigits:1 }).format(100 * numerator / denominator) + '%';
      })();
      return accessiblePlot.includes('G' + row.generation + (row.phase === 'survived' ? ' S' : '') + ': ' + metricLabel);
    }) && await chart.locator('.rg-chart-born').count() === 5 && await chart.locator('.rg-chart-survived').count() === 2,
      label + ' ' + metric + ' plot announces the recorded values and gives birth and survivor points distinct shapes');
    snapshots.push(accessiblePlot);
  }
  check(snapshots.every(text => text.length > 0) && new Set(snapshots).size === 3,
    label + ' gives each measure a distinct labeled plot, not the same data reinterpretation');
}
async function denominatorCheck(page) {
  const quiz = page.locator('#rg-check');
  const feedback = quiz.locator('#rg-check-feedback');
  check(clean(await feedback.textContent()) === '', 'denominator check starts without feedback');
  for (const [value, expected] of [['rats', /two|copies|twice/i], ['alleles', /right|yes|correct/i]]) {
    const choice = quiz.locator('input[name="rg-concept"][value="' + value + '"]');
    await choice.focus();
    await page.keyboard.press('Space');
    await quiz.locator('button[type="submit"]').press('Enter');
    check(await feedback.isVisible() && expected.test(await feedback.textContent()),
      'denominator check explains selecting ' + value);
  }
}
async function dashboardGuide(page, base) {
  await page.goto(base + 'openscied-dashboard.html');
  const section = page.locator('section[aria-labelledby="unit4"]');
  const card = section.locator('.dashboard-activity').filter({
    has: page.locator('a[href="' + FILE + '"]')
  });
  check(await card.count() === 1 && /Rat Generations/i.test(await card.innerText()),
    'the Unit 4 dashboard lists Rat Generations exactly once');
  const resume = page.locator('#openscied-resume-link');
  check(await resume.isVisible() && (await resume.getAttribute('href')).startsWith(FILE),
    'dashboard Resume points to the existing Rat Generations trial');
  await resume.press('Enter');
  await page.locator('#rg-explain').waitFor({ state:'visible' });
  check(await page.locator('#rg-claim').inputValue() === EXAMPLE_TEXT.claim &&
    await page.locator('#rg-name').inputValue() === STUDENT.name,
    'dashboard Resume opens the same saved lesson evidence, writing, and report label');
  await page.goto(base + 'openscied-teacher-guide.html');
  const note = page.locator('article[data-guide-for="' + FILE + '"]');
  check(await note.count() === 1 && await note.locator('a[href="' + FILE + '"]').isVisible(),
    'the teacher guide includes an accessible Rat Generations classroom plan');
}
async function play(browser, base, cfg) {
  const ctx = await makeContext(browser, base, cfg);
  try {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const label = cfg.width + (cfg.dark ? '-dark' : '-light');
    await page.goto(base + FILE);
    await page.getByRole('heading', { name:'Rat Generations', level:1, exact:true }).waitFor();
    check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches) === !cfg.animate,
      label + ' runs in the intended reduced-motion or animated mode');
    check(await stepButton(page,'model').isDisabled() && await stepButton(page,'analyze').isDisabled() &&
      await stepButton(page,'explain').isDisabled(), label + ' initial prediction gate prevents premature jumps');
    await fits(page, 'main, #rg-predict', label + ' prediction');
    await screenshot(page, label + '-prediction');
    if (cfg.touch) await axe(page, '#rg-predict', label + ' prediction');

    const vote = page.locator('#rg-prediction input[value="increase"]');
    if (cfg.touch) await vote.locator('xpath=ancestor::label[1]').tap();
    else {
      await vote.focus();
      await page.keyboard.press('Space');
    }
    check(await vote.isChecked(), label + ' records a prediction using ' + (cfg.touch ? 'a real touch' : 'the keyboard'));
    await use(page.locator('#rg-prediction button[type="submit"]'), cfg);
    await page.locator('#rg-model').waitFor({ state:'visible' });
    await enterStage(page, 'model', cfg);
    await waitAction(page, 0);
    const start = await save(page);
    check(start.prediction === 'increase' && start.seed === cfg.seed,
      label + ' saves the chosen prediction and a stable trial seed');
    const seed = start.seed;
    let model = Model.create(seed);
    const trialId = await page.locator('#rg-trial-id').innerText();
    check(trialId.trim() === 'Dataset ID: ' + trialTag(seed), label + ' displays the exact trial identifier');
    await events(page, 0, label);
    await expectBoard(page, model, null, label);
    check(compact(count(model.generations[0].born), { RR:0,RB:1,BB:3 }),
      label + ' starts with the source handout’s four founders');
    await fits(page, 'main, #rg-model, #rg-colony, #rg-pairs, #rg-punnett', label + ' initial colony board');
    await screenshot(page, label + '-founders');
    if (cfg.touch) await axe(page, '#rg-model', label + ' paired colony board');

    for (let action = 1; action <= 6; action++) {
      const preview = Model.preview(model);
      const subsequent = Model.step(model);
      if (preview.action === 'breed' && (action === 1 || action === 4 || action === 6)) {
        await inspectPair(page, subsequent.generations.at(-1), cfg, label + ' before action ' + action);
      }
      const next = page.locator('#rg-next');
      await use(next, cfg);
      await waitAction(page, action);
      await events(page, action, label);
      model = subsequent;
      await expectBoard(page, model, preview, label + ' action ' + action);
      const record = await save(page);
      check(record.seed === seed && record.prediction === 'increase',
        label + ' action ' + action + ' does not reroll the trial or replace the initial prediction');
      if (action < 6) check(await stepButton(page,'analyze').isDisabled() && await stepButton(page,'explain').isDisabled(),
        label + ' analysis stays gated until the six model actions are complete');
      if (action === 3) {
        const selected = model.generations.at(-1);
        check(selected.survivors.length < selected.born.length &&
          selected.survivors.every(record => record.genotype !== 'BB'),
          label + ' first selection separates original births from surviving rats rather than changing genotypes');
        check((await page.locator('#rg-selection-record').innerText()).includes(String(selected.born.length)) &&
          (await page.locator('#rg-selection-record').innerText()).includes(String(selected.survivors.length)),
          label + ' on-screen selection evidence keeps both original birth and survivor counts');
        await screenshot(page, label + '-generation-3-survivors');
        if (cfg.width === 1366) {
          await page.locator('#rg-timeline [data-rg-snapshot="2"]').press('Enter');
          await events(page, 2, 'history review');
          await expectBoard(page, ModelAt(seed, 2), null, 'history review');
          check((await save(page)).action === 3, 'viewing the earlier birth snapshot does not rewind the saved model');
          await page.locator('#rg-next').press('Enter');
          await events(page, 3, 'returned to current selection');

          await page.reload();
          await page.locator('#rg-model').waitFor({ state:'visible' });
          await waitAction(page, 3);
          await events(page, 3, 'reloaded mid-trial');
          await expectBoard(page, model, preview, 'reloaded mid-trial');
          check((await save(page)).seed === seed && await page.locator('#rg-trial-id').innerText() === trialId,
            'reload during selection retains the same seed, identifier, phase and visible survivor totals');
        }
      }
    }
    await screenshot(page, label + '-generation-5-born');

    await enterStage(page, 'analyze', cfg);
    const analyzed = await parity(page, '#rg-analysis-table', model, label + ' Analyze table');
    await plots(page, model, cfg, label);
    await fits(page, 'main, #rg-analyze, #rg-chart, #rg-analysis-table', label + ' analysis');
    await screenshot(page, label + '-analysis');
    if (cfg.width === 1366) {
      await axe(page, '#rg-analyze', label + ' analysis');
      await denominatorCheck(page);
    }

    await enterStage(page, 'explain', cfg);
    check(await page.locator('#rg-evidence-summary').isVisible(),
      label + ' puts own-trial evidence beside the writing prompts');
    if (cfg.width === 1366) {
      const reading = page.locator('#rg-explain details').filter({
        hasText: 'Class reading connection'
      });
      await reading.locator('summary').press('Enter');
      check(/farm population/i.test(await reading.innerText()) && /laboratory population/i.test(await reading.innerText()) &&
        /not a target that the model is set to produce/i.test(await reading.innerText()),
        'the reading stays separate from simulated evidence and does not turn the Tokyo figure into a model target');
    }
    const table = page.locator('#rg-evidence-table');
    if (!await table.isVisible()) await use(table.locator('xpath=ancestor::details[1]').locator('summary'), cfg);
    const explained = await parity(page, '#rg-evidence-table', model, label + ' Explain table');
    check(compact(explained, analyzed), label + ' carries exact counts and denominators forward without backtracking');
    for (const [key, value] of Object.entries(EXAMPLE_TEXT)) {
      await page.locator('#rg-' + key).fill(value);
    }
    await fits(page, 'main, #rg-explain, #rg-evidence-table, #rg-claim, #rg-evidence, #rg-limits', label + ' explanation');
    await screenshot(page, label + '-explanation');
    if (cfg.touch) await axe(page, '#rg-explain', label + ' explanation');

    if (cfg.width === 1366) {
      await page.reload();
      await page.locator('#rg-explain').waitFor({ state:'visible' });
      const final = await save(page);
      check(final.seed === seed && final.action === 6 && final.prediction === 'increase' &&
        Object.entries(EXAMPLE_TEXT).every(([key,value]) => final.answers[key] === value),
        'completed investigation and answers survive a reload in the same browser');
      await reportCheck(page, final);
      await dashboardGuide(page, base);
    }
    check(errors.length === 0, label + ' has no uncaught browser errors: ' + errors.join(', '));
  } finally {
    await ctx.close();
  }
}

(async () => {
  const server = await serve();
  let browser;
  try {
    const executablePath = process.env.CHROMIUM_PATH || process.env.CHROMIUM_EXECUTABLE;
    browser = await chromium.launch(executablePath ? { executablePath } : {});
    await fs.mkdir(OUT, { recursive:true });
    for (const viewport of VIEWPORTS) await play(browser, server.url, viewport);
    console.log('openscied-b4-rat-generations-browser: ' + checks + ' checks passed');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
