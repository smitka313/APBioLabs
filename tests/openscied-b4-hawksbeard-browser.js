'use strict';

const { verifySaveConflict } = require('./openscied-b4-save-conflict-check');

// Classroom-path browser regression for the paired Hawksbeard releases.
// Model tests separately validate the science and the seeded calculations.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { serve, ROOT } = require('./_h');

const FILE = 'openscied-b4-hawksbeard.html';
const SAVE = 'aplab:openscied:b4-hawksbeard:v1';
const OUT = path.join(ROOT, 'artifacts', 'openscied-hawksbeard');
const AXE = require.resolve('axe-core/axe.min.js');
const VIEWPORTS = [
  { width: 390, height: 844, dark: true, touch: true },
  { width: 768, height: 1024 },
  { width: 1366, height: 768, animate: true },
  { width: 1920, height: 1080 }
];
const EXAMPLE_TEXT = {
  claim: 'The soil layout changed where seeds could land.',
  evidence: 'I used the paired release table and compared the share of nonfeathery seeds among all seeds that reached soil in each environment.',
  limits: 'Landing on soil was a proxy. The model did not measure germination, adult survival, or inheritance.'
};
const REFLECTION_TEXT = 'I would revise my prediction after checking the nonfeathery fraction of soil landings in both places.';
const STANDALONE_NAME = 'Wind Lab Standalone QA';
const STANDALONE_PERIOD = '5';
const datasetId = seed => 'HB-' + seed.toString(16).toUpperCase().padStart(8, '0');
const exact = text => text.replace(/\s+/g, ' ').trim();
let checks = 0;
function check(test, message) {
  assert.ok(test, message);
  checks++;
  console.log('ok: ' + message);
}

async function snapshot(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), SAVE);
}
async function released(page, expected) {
  await page.waitForFunction(({ key, index }) => {
    try { return JSON.parse(localStorage.getItem(key))?.released === index; }
    catch { return false; }
  }, { key: SAVE, index: expected });
}
async function stage(page, name, interaction = 'keyboard') {
  const tab = page.locator('.hb-steps [data-hb-go="' + name + '"]');
  if (interaction === 'touch') await tab.tap();
  else await tab.press('Enter');
  await page.locator('#hb-' + name).waitFor({ state: 'visible' });
  check(await tab.getAttribute('aria-current') === 'step' &&
    await page.locator('.hb-steps [aria-current="step"]').count() === 1,
    name + ' is the single step indicated as current');
}
async function completedSteps(page, expected, label) {
  const actual = await page.locator('.hb-steps [data-hb-go]').evaluateAll(buttons =>
    buttons.filter(button => button.dataset.hbComplete === 'true').map(button => ({
      step: button.dataset.hbGo,
      check: button.querySelector('.hb-step-check')?.textContent.trim(),
      announced: /complete/i.test(button.querySelector('.hb-step-completion:not([hidden])')?.textContent || '')
    }))
  );
  check(actual.map(mark => mark.step).join(',') === expected.join(',') &&
    actual.every(mark => mark.check === '✓' && mark.announced),
    label + ' completion markers match recorded work: ' + expected.join(', '));
}
async function trialStamp(page, seed, label) {
  check(await page.locator('#hb-dataset-id').isVisible() &&
    exact(await page.locator('#hb-dataset-id').textContent()) === datasetId(seed),
    label + ' shows the exact Dataset ID for the current trial');
  const note = page.locator('#hb-trial-note');
  const explanation = exact(await note.textContent());
  check(await note.isVisible() && /new trial draws new wind paths/i.test(explanation) &&
    /reloading keeps the same trial/i.test(explanation) && /dataset id is included in your download/i.test(explanation),
    label + ' explains different runs, reload stability, and the report identifier');
}
async function shot(page, label) {
  await page.screenshot({ path: path.join(OUT, label + '.png'), fullPage: true,
    animations: 'disabled', timeout: 12000 });
}
async function fits(page, selector, label) {
  const bad = await page.locator(selector).evaluateAll(elements => {
    const width = document.documentElement.clientWidth;
    return elements.filter(el => {
      const rect = el.getBoundingClientRect();
      return (rect.width && rect.height) && (rect.left < -1 || rect.right > width + 1);
    }).map(el => el.id || el.getAttribute('data-hb-scene') || el.tagName);
  });
  check(!bad.length && await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
  label + ' no sideways clipping or page overflow: ' + bad.join(', '));
}
async function axe(page, scope, label) {
  if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: AXE });
  const violations = await page.evaluate(async scope => {
    const results = await window.axe.run(scope, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      resultTypes: ['violations']
    });
    return results.violations.map(v => [v.id, v.nodes.map(n => n.target)]);
  }, scope);
  check(violations.length === 0, label + ' accessibility ' + JSON.stringify(violations));
}
async function makeContext(browser, base, cfg) {
  const context = await browser.newContext({
    viewport: { width: cfg.width, height: cfg.height },
    colorScheme: cfg.dark ? 'dark' : 'light', reducedMotion: cfg.animate ? 'no-preference' : 'reduce', hasTouch: !!cfg.touch,
    acceptDownloads: true
  });
  const origin = new URL(base).origin;
  // Avoid analytics and externally hosted font traffic in automated QA.
  await context.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  // Exercise a direct activity link with no existing dashboard sign-in at 1366.
  if (cfg.width !== 1366) await context.addInitScript(() => {
    try {
      if (!localStorage.getItem('aplab:student')) {
        localStorage.setItem('aplab:student', JSON.stringify({ name: 'Hawksbeard QA', period: '3' }));
      }
    } catch (_) { /* About:blank has no storage origin. */ }
  });
  return context;
}

const Model = require('../openscied-b4-hawksbeard-logic.js');
const SITES = ['field', 'city'];
const TYPES = ['feathery', 'nonfeathery'];
const pairs = SITES.flatMap(site => TYPES.map(type => [site, type]));

function ratio(text) {
  const parts = text.match(/(\d+)\s*\/\s*(\d+)/);
  return parts ? parts.slice(1).map(Number) : [];
}
async function resultRows(page, selector, seed, label) {
  const data = await page.locator(selector + ' [data-hb-result]').evaluateAll(rows =>
    rows.map(row => [row.dataset.hbResult, [...row.querySelectorAll('th,td')]
      .map(cell => cell.textContent.replace(/\s+/g, ' ').trim())]));
  const model = Model.makeTrial(seed);
  check(data.length === 4 && new Set(data.map(row => row[0])).size === 4,
    label + ' presents one row per environment and seed type');
  for (const [site, type] of pairs) {
    const row = data.find(row => row[0] === site + '-' + type)?.[1];
    assert.ok(row?.length === 5, label + ' has five data columns for ' + site + ' ' + type);
    const expected = model.stats[site].byType[type];
    const landed = model.stats[site].landed;
    const proportion = ratio(row[4]);
    check(JSON.stringify(ratio(row[2])) === JSON.stringify([expected.landed, expected.released]) &&
      Number(row[3]) === expected.missed &&
      JSON.stringify(proportion) === JSON.stringify([expected.landed, landed]) &&
      (landed > 0 || /no denominator/i.test(row[4])) &&
      !/\bNaN\b/i.test(row.join('|')), label + ' counts and denominator agree for ' + site + ' ' + type);
  }
  return data;
}
async function sceneParity(page, seed, releasedCount, label) {
  const model = Model.makeTrial(seed);
  const decoded = {};
  for (const site of SITES) {
    const scene = page.locator('[data-hb-scene="' + site + '"]');
    const marks = await scene.locator('[data-hb-seed]').evaluateAll(marks => marks.map(mark => ({
      id: mark.dataset.hbSeed, land: mark.dataset.hbLand, position: mark.getAttribute('transform'),
      feathery: mark.classList.contains('hb-seed-feathery')
    })));
    const source = model[site].filter(seed => seed.plant <= releasedCount);
    const count = source.filter(seed => seed.landed).length;
    const accessibleLegend = scene.locator('svg[role="img"] desc');
    check(marks.length === source.length && new Set(marks.map(mark => mark.id)).size === source.length &&
      source.every(expected => marks.some(mark => mark.id === expected.id &&
        mark.land === expected.land && mark.feathery === (expected.type === 'feathery'))) &&
      exact(await accessibleLegend.textContent()).includes(count + ' of ' + source.length + ' model seeds'),
      label + ' ' + site + ' marks and accessible soil count reflect all released seeds at pair ' + releasedCount);
    decoded[site] = Object.fromEntries(marks.map(mark => [mark.id, mark.position]));
  }
  check(Object.keys(decoded.field).every(id => decoded.field[id] === decoded.city[id]),
    label + ' both layouts show the same paired seed endpoints at pair ' + releasedCount);
}
async function boardCues(page, seed, completed, at) {
  const model = Model.makeTrial(seed);
  const legend = page.getByRole('group', { name: 'Seed key', exact: true });
  const legendText = exact(await legend.textContent());
  const keyBeforeBoards = await legend.evaluate(key => {
    const boards = key.nextElementSibling;
    return boards?.classList.contains('hb-worlds') && key.getBoundingClientRect().bottom <= boards.getBoundingClientRect().top;
  });
  check(await legend.isVisible() && keyBeforeBoards && /Feathery.*Feather shape.*dotted trail.*Nonfeathery.*Diamond shape.*dashed trail/i.test(legendText) &&
    /Soil landing.*Missed soil.*Release point.*Earlier releases fade.*dots.*diamonds/i.test(legendText),
    at + ' a clearly titled seed key appears above both boards and labels both types and outcomes');
  const swatches = await legend.evaluate((key, completed) => {
    const board = key.nextElementSibling.querySelector('[data-hb-scene="field"] svg');
    return ['feathery','nonfeathery'].every(type => {
      const swatch = key.querySelector('[data-hb-key-seed="'+type+'"] svg');
      const mini = key.querySelector('[data-hb-key-earlier="'+type+'"] svg');
      if (!swatch || !mini || swatch.getBoundingClientRect().width < 35) return false;
      const glyph = swatch.querySelector('g').innerHTML;
      const dots = swatch.querySelector('path').getAttribute('stroke-dasharray');
      if (dots !== (type === 'feathery' ? '1 10' : '6 8')) return false;
      const selector = '.hb-seed-'+type;
      const latest = board.querySelector(selector+'[data-hb-fresh="latest"]');
      const earlier = board.querySelector(selector+'[data-hb-fresh="earlier"]');
      return (!completed || (latest && Array.from(latest.children).slice(-2).map(node => node.outerHTML).join('') === glyph)) &&
        (completed < 2 || earlier?.innerHTML === mini.innerHTML);
    });
  }, completed);
  check(swatches, at + ' seed key samples use the exact illustrated markers and trail patterns used on the boards');

  for (const site of SITES) {
    const svg = page.locator('[data-hb-scene="' + site + '"] .hb-scene-svg');
    const cues = await svg.evaluate(board => {
      const v = board.viewBox.baseVal;
      const plant = board.querySelector('.hb-scene-plant');
      const transform = plant?.transform.baseVal.getItem(0).matrix;
      const wind = [...board.querySelectorAll('.hb-scene-wind text')];
      return {
        plant: transform && { x: (transform.e - v.x) / v.width, y: (transform.f - v.y) / v.height },
        plantState: plant?.dataset.hbPlantState,
        wind: wind.some(el => /wind/i.test(el.textContent)),
        labelsFit: wind.every(el => {
          const b = el.getBBox();
          return b.width > 0 && b.height > 0 && b.x >= v.x && b.y >= v.y &&
            b.x + b.width <= v.x + v.width && b.y + b.height <= v.y + v.height;
        }),
        footprints: [...board.querySelectorAll('[data-hb-footprint]')].map(el => {
          const r = el.getBBox();
          return { id:el.dataset.hbFootprint,
            x:(r.x - v.x) / v.width, y:(r.y - v.y) / v.height,
            width:r.width / v.width, height:r.height / v.height };
        }),
        trails: [...board.querySelectorAll('.hb-scene-trails .hb-seed-trail')].map(el => {
          const normalize = point => ({ x:(point.x - v.x) / v.width, y:(point.y - v.y) / v.height });
          return { start:normalize(el.getPointAtLength(0)), end:normalize(el.getPointAtLength(el.getTotalLength())),
            feathery:el.classList.contains('hb-seed-trail-feathery') };
        }),
        phaseContrast: Number(getComputedStyle(board.querySelector('.hb-scene-past')).opacity) <
          Number(getComputedStyle(board.querySelector('.hb-scene-current')).opacity),
        earlier: [...board.querySelectorAll('[data-hb-seed][data-hb-fresh="earlier"]')].map(el => el.dataset.hbSeed),
        latest: [...board.querySelectorAll('[data-hb-seed][data-hb-fresh="latest"]')].map(el => el.dataset.hbSeed)
      };
    });
    const near = (a, b) => Math.abs(a - b) <= .002;
    const layout = Model.layouts[site];
    check(cues.wind && cues.labelsFit && cues.plant && near(cues.plant.x, layout.release.x) &&
      near(cues.plant.y, layout.release.y) && cues.plantState === (completed ? 'landed' : 'ready'),
      at + ' ' + site + ' wind label fits and launch marker is at the matching release point');
    check(cues.footprints.length === layout.soil.length && layout.soil.every(expected => {
      const painted = cues.footprints.find(shape => shape.id === expected.id);
      return painted && ['x','y','width','height'].every(k => near(painted[k], expected[k]));
    }), at + ' ' + site + ' drawn soil boundaries match the model patches exactly');
    const batch = model[site].filter(r => r.plant === completed);
    const latest = batch.map(r => r.id);
    const earlier = model[site].filter(r => r.plant < completed).map(r => r.id);
    check(cues.phaseContrast && cues.trails.length === batch.length &&
      JSON.stringify(cues.latest.sort()) === JSON.stringify(latest.sort()) &&
      JSON.stringify(cues.earlier.sort()) === JSON.stringify(earlier.sort()),
      at + ' ' + site + ' traces only the latest pair and visibly fades earlier seeds at step ' + completed);
    const pointMatches = (a, b) => near(a.x, b.x) && near(a.y, b.y);
    if (completed) check(cues.trails.every((t, i) => pointMatches(t.start, batch[i].start) &&
      pointMatches(t.end, batch[i].end) && t.feathery === (batch[i].type === 'feathery')),
      at + ' ' + site + ' latest trail endpoints and types match the same seed records');
  }
}
async function boardSizes(page, cfg, seed, at) {
  const toggle = page.getByRole('checkbox', { name: 'Enlarge boards', exact: true });
  const boards = page.locator('.hb-worlds');
  const layout = () => boards.evaluate(group => {
    const scope = group.getBoundingClientRect();
    return {
      width: scope.width,
      scenes: [...group.querySelectorAll('[data-hb-scene]')].map(scene => {
        const r = scene.getBoundingClientRect();
        return { x: r.left - scope.left, y: r.top - scope.top, width: r.width, bottom: r.bottom - scope.top };
      })
    };
  });
  const compact = await layout();
  const modelBefore = await snapshot(page);
  check(!await toggle.isChecked() && compact.scenes.length === 2 &&
    compact.scenes[1].x > compact.scenes[0].x + compact.scenes[0].width,
    at + ' starts with two compact side-by-side release boards');
  const originalNodes = await boards.evaluateHandle(board => [
    ...board.querySelectorAll('[data-hb-scene] svg, [data-hb-seed]')
  ]);
  const unchanged = () => boards.evaluate((board, originals) => {
    const current = [...board.querySelectorAll('[data-hb-scene] svg, [data-hb-seed]')];
    return originals.length === current.length && current.every((node, i) => node === originals[i]);
  }, originalNodes);
  const flip = () => cfg.touch ? toggle.tap() : toggle.press('Space');
  try {
    await flip();
    const large = await layout();
    check(await toggle.isChecked() && large.scenes.every((r, i) =>
      r.width > compact.scenes[i].width * 1.5 && r.width > large.width * .85) &&
      Math.abs(large.scenes[0].x - large.scenes[1].x) <= 2 &&
      large.scenes[1].y > large.scenes[0].bottom,
      at + ' enlargement stacks two substantially wider boards without a new page');
    check(await unchanged(), at + ' enlargement keeps the same SVGs and seed markers in place');
    await fits(page, 'main, .hb-worlds, [data-hb-scene]', at + ' enlarged boards');
    await sceneParity(page, seed, 3, at + ' enlarged');
    await boards.screenshot({
      path: path.join(OUT, at + '-release-3-expanded-boards.png'), animations: 'disabled', timeout: 12000
    });
    await flip();
    const returned = await layout();
    check(!await toggle.isChecked() && await unchanged() &&
      returned.scenes.every((r, i) => Math.abs(r.width - compact.scenes[i].width) <= 1) &&
      JSON.stringify(await snapshot(page)) === JSON.stringify(modelBefore),
      at + ' closing close-up restores the compact view and leaves the same trial intact');
  } finally {
    await originalNodes.dispose();
  }
}
async function hasVisibleTable(page, selector) {
  const table = page.locator(selector);
  const disclosure = table.locator('xpath=ancestor::details[1]');
  if (await disclosure.count() && !await disclosure.evaluate(el => el.open)) {
    await disclosure.locator('summary').press('Enter');
  }
  await table.waitFor({ state: 'visible' });
}
async function use(page, locator, cfg) {
  const element = page.locator(locator);
  if (cfg.touch) await element.tap();
  else await element.press('Enter');
}
async function checkDenominator(page, seed) {
  const quiz = page.locator('.hb-denominator-check');
  await quiz.locator('summary').press('Enter');
  const feedback = quiz.locator('.hb-denominator-feedback');
  check(!await feedback.isVisible(), 'denominator check does not announce the solution before interaction');
  const wrong = quiz.locator('input[name="hb-denominator"][value="type"]');
  await wrong.focus();
  await page.keyboard.press('Space');
  check(/soil-landing rate for nonfeathery seeds/i.test(await feedback.textContent()),
    'denominator check explains the result of using only nonfeathery seeds released');
  await page.keyboard.press('ArrowDown');
  const city = Model.makeTrial(seed).stats.city;
  check(/compare seeds that landed on soil/i.test(await feedback.textContent()) &&
    JSON.stringify(ratio(await feedback.textContent())) ===
      JSON.stringify([city.byType.nonfeathery.landed, city.landed]),
    'keyboard correction explains the soil-landing denominator and uses the student’s counts');
  const status = page.locator('#hb-status');
  check(await status.evaluate(el => el.classList.contains('sr-only')) &&
    exact(await status.textContent()) === exact(await feedback.textContent()),
    'quiz feedback is shown inline once and also announced offscreen');
  await quiz.locator('summary').press('Enter');
}
async function disclosed(page, id, open) {
  await page.waitForFunction(({ key, id, open }) => {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    return Boolean(saved?.disclosures?.[id]) === open;
  }, { key:SAVE, id, open });
}
async function downloadReport(page) {
  const backups=page.locator('#hb-other-downloads');
  if(!await backups.evaluate(el=>el.open)){
    check(!await page.locator('#hb-download').isVisible(),'plain-text download is hidden with backups collapsed');
    await backups.locator('summary').press('Enter');
  }
  const downloaded = page.waitForEvent('download');
  await page.locator('#hb-download').press('Enter');
  const file = await downloaded;
  return { filename:file.suggestedFilename(), report:await fs.readFile(await file.path(), 'utf8') };
}
async function fillStandaloneIdentity(page) {
  const name = page.locator('#hb-name'), period = page.locator('#hb-period');
  check(await name.isVisible() && await period.isVisible() &&
    await name.inputValue() === '' && await period.inputValue() === '' &&
    !await page.evaluate(() => Boolean(localStorage.getItem('aplab:student'))),
    'the direct activity link offers local identification without a dashboard sign-in');
  const anonymous = await downloadReport(page);
  const lines = anonymous.report.split(String.fromCharCode(10)).map(line => line.trim());
  check(anonymous.filename === 'hawksbeard-wind-lab.txt' && lines.includes('Name:') && lines.includes('Class period:'),
    'standalone name and class period remain optional for downloading');
  await name.fill(STANDALONE_NAME);
  await name.press('Tab');
  await period.fill(STANDALONE_PERIOD);
  await period.press('Tab');
  check(!await page.evaluate(() => Boolean(localStorage.getItem('aplab:student'))),
    'editing a standalone report label does not overwrite the dashboard sign-in');
}
async function confirmReport(page, state) {
  const { filename, report } = await downloadReport(page);
  check(filename === 'hawksbeard-wind-lab.txt' &&
    /Hawksbeard Wind Lab/i.test(report) && /simulat/i.test(report) &&
    /Cheptou/i.test(report) && /0708446105|PMC2268839/i.test(report) &&
    report.includes('Name: ' + STANDALONE_NAME) && report.includes('Class period: ' + STANDALONE_PERIOD) &&
    report.includes('Dataset: ' + datasetId(state.seed)) && report.includes(REFLECTION_TEXT) &&
    Object.values(state.answers).filter(Boolean).every(answer => report.includes(answer)),
    'real report includes local identification, the Dataset ID, the comparison reflection and explanations');
  check(exact(await page.locator('#hb-status').textContent()) ===
    'Download requested. If no file appears, choose Copy investigation.',
    'download announcement names the exact Copy investigation fallback');
  const flight = Model.makeTrial(state.seed);
  for (let pair = 1; pair <= Model.PLANTS; pair++) {
    const counts = SITES.map(site => Model.summarize(flight[site].filter(seed => seed.plant === pair)));
    check(report.includes('Plant pair ' + pair + ': Field ' + counts[0].landed + ' / 10 on soil · City ' +
      counts[1].landed + ' / 10 on soil'), 'download retains exact soil counts for matched plant pair ' + pair);
  }
  await page.locator('#hb-copy').press('Enter');
  const dialog = page.locator('#hb-copy-dialog');
  await dialog.waitFor({ state: 'visible' });
  check(await page.locator('#hb-copy-text').inputValue() === report,
    'copy fallback contains exactly the same report as the download');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
}

async function play(browser, base, cfg) {
  const context = await makeContext(browser, base, cfg);
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + FILE);
    check(await page.getByRole('heading', { name: 'Hawksbeard Wind Lab', level: 1 }).count() === 1,
      'Hawksbeard Wind Lab has one named main heading');
    const at = cfg.width + (cfg.dark ? '-dark' : '-light');
    const predict = page.locator('#hb-predict');
    await predict.waitFor({ state: 'visible' });
    check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches) === !cfg.animate,
      at + ' tests ' + (cfg.animate ? 'animated' : 'reduced-motion') + ' browser preferences');
    check(await page.locator('.hb-steps [data-hb-go="release"]').isDisabled() &&
      await page.locator('.hb-steps [data-hb-go="compare"]').isDisabled() &&
      await page.locator('.hb-steps [data-hb-go="explain"]').isDisabled(),
      at + ' investigation starts with a genuine prediction gate');
    check(await page.locator('#hb-save-prediction').isDisabled() && await page.locator('#hb-prediction-hint').isVisible(),
      at + ' blank prediction has a visibly disabled Save button and a hint');
    await completedSteps(page, [], at + ' new trial');
    await fits(page, 'main, #hb-predict', at + ' prediction');
    await shot(page, at + '-prediction');
    if (cfg.touch) await axe(page, '#hb-predict', at + ' prediction');

    const prediction = page.locator('#hb-prediction');
    const choice = prediction.locator('input[name="hb-prediction"]').first();
    const predictValue = await choice.getAttribute('value');
    if (cfg.touch) await choice.locator('xpath=ancestor::label[1]').tap();
    else {
      await choice.focus();
      await page.keyboard.press('Space');
    }
    check(await choice.isChecked(), at + ' prediction form works via ' + (cfg.touch ? 'touch' : 'keyboard'));
    check(await page.locator('#hb-save-prediction').isEnabled(), at + ' selecting a prediction enables Save');
    await use(page, '#hb-prediction button[type="submit"]', cfg);
    await page.waitForFunction(({ key, value }) => {
      const incoming = JSON.parse(localStorage.getItem(key) || 'null');
      return incoming?.prediction === value;
    }, { key: SAVE, value: predictValue });
    const earlyFeedback = exact(await page.locator('#hb-prediction-feedback').textContent());
    check(!/\byour prediction is (?:right|wrong|correct|incorrect)\b/i.test(earlyFeedback),
      at + ' recording a prediction does not reveal an answer');
    const release = page.locator('#hb-release');
    await release.waitFor({ state: 'visible' });
    await stage(page, 'release', cfg.touch ? 'touch' : 'keyboard');
    check(await release.locator('[data-hb-scene="field"]').isVisible() &&
      await release.locator('[data-hb-scene="city"]').isVisible(),
      at + ' shows both matched layouts together before the first release');
    await fits(page, 'main, #hb-release, [data-hb-scene]', at + ' pair of wind scenes');
    check(/Field\s+Connected soil/i.test(await page.locator('.hb-field h3').innerText()) &&
      /City\s+Separated soil patches/i.test(await page.locator('.hb-city h3').innerText()),
      at + ' visible board headings identify the field and city soil layouts');
    const baseline = await snapshot(page);
    await trialStamp(page, baseline.seed, at);
    await completedSteps(page, ['predict'], at + ' prediction saved');
    await sceneParity(page, baseline.seed, 0, at);
    await boardCues(page, baseline.seed, 0, at);
    check(Model.validSeed(baseline.seed) && baseline.released === 0,
      at + ' starts with a reproducible seed and zero completed releases');
    check(!await page.locator('#hb-compare').isVisible() && !await page.locator('#hb-explain').isVisible(),
      at + ' compare and explanation do not reveal results before releases');

    for (let step = 1; step <= Model.PLANTS; step++) {
      if (step === 1 && cfg.animate) {
        const inFlight = await page.locator('#hb-release-next').evaluate((button, saveKey) => {
          button.click();
          button.click(); // double activation must not start a second pair
          return {
            busy: button.disabled,
            count: JSON.parse(localStorage.getItem(saveKey))?.released,
            markers: document.querySelectorAll('[data-hb-seed][data-hb-fresh="flying"]:not([data-hb-land])').length,
            launching: document.querySelectorAll('.hb-scene-plant[data-hb-plant-state="releasing"]').length
          };
        }, SAVE);
        check(inFlight.busy && inFlight.count === 1 && inFlight.markers === 20 && inFlight.launching === 2,
          'animated pair guards against repeat activation and highlights the matching launch in both environments');
      } else await use(page, '#hb-release-next', cfg);
      await released(page, step);
      await page.waitForFunction(() =>
        !document.querySelector('[data-hb-seed]:not([data-hb-land])') &&
        !document.querySelector('#hb-release-next')?.textContent.startsWith('Releasing'));
      const series = await snapshot(page);
      check(series.seed === baseline.seed && series.released === step, at + ' records matched plant pair ' + step);
      if(step===1 && cfg.width===1366){
        await stage(page,'predict');
        check(await choice.isChecked() && await choice.isDisabled() && await page.locator('#hb-save-prediction').isHidden() &&
          /starting prediction.*Compare/.test(await page.locator('#hb-prediction-feedback').innerText()),
          'results lock the starting prediction and show where to revise the explanation');
        await prediction.evaluate(form=>{
          form.querySelector('input[value=city]').checked=true;
          form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        });
        check((await snapshot(page)).prediction===predictValue,'the starting prediction stays saved after an attempted rewrite');
        await stage(page,'release');
      }
      if (step < Model.PLANTS) {
        check(await page.locator('.hb-steps [data-hb-go="compare"]').isDisabled() &&
          await page.locator('.hb-steps [data-hb-go="explain"]').isDisabled() &&
          !await page.locator('#hb-compare').isVisible() && !await page.locator('#hb-explain').isVisible(),
          at + ' keeps the compare and explain sections gated after pair ' + step);
      }
      if (step === 1 || step === 3 || step === Model.PLANTS) await sceneParity(page, baseline.seed, step, at);
      if (step === 3) {
        check(await page.locator('#hb-round').isVisible() && await page.locator('#hb-release-summary').isVisible(),
          at + ' mid-run progress and seed landing summary are on the release screen');
        await boardCues(page, baseline.seed, step, at);
        await shot(page, at + '-release-3');
        if (cfg.touch) await axe(page, '#hb-release', at + ' release board and legend');
        if (cfg.touch || cfg.width === 1366) await boardSizes(page, cfg, baseline.seed, at);
        if (cfg.width === 1366) {
          await page.reload();
          await released(page, step);
          check(await release.isVisible() && (await snapshot(page)).seed === baseline.seed,
            'reload mid-investigation returns to the same release count and paired flight seed');
          await trialStamp(page, baseline.seed, 'reloaded mid-trial');
        }
      }
    }

    await stage(page, 'compare', cfg.touch ? 'touch' : 'keyboard');
    check(await page.locator('#hb-compare-summary').isVisible() && await page.locator('#hb-compare-chart').isVisible(),
      at + ' comparison displays both the student-run summary and plot');
    await hasVisibleTable(page, '#hb-compare-table');
    check(/Of the seeds that reached soil, what share came from each type/i.test(await page.locator('#hb-compare-chart figcaption').innerText()) &&
      /all seeds that reached soil, including feathery seeds/.test(await page.locator('#hb-compare').innerText()),
      at+' clearly separates soil-landing composition from landing rate');
    const compared = await resultRows(page, '#hb-compare-table', baseline.seed, at + ' compare table');
    await completedSteps(page, ['predict', 'release'], at + ' comparison not yet recorded');
    const observation = page.locator('#hb-type-observation');
    const stats = Model.makeTrial(baseline.seed).stats;
    const fieldType = stats.field.byType.nonfeathery, cityType = stats.city.byType.nonfeathery;
    const allReachedSoil = fieldType.landed === fieldType.released && cityType.landed === cityType.released;
    const observationText = exact(await observation.textContent());
    check(await observation.isVisible() && observationText.includes(
      'Nonfeathery seeds on soil: ' + fieldType.landed + ' of ' + fieldType.released +
      ' in the field and ' + cityType.landed + ' of ' + cityType.released + ' in the city.') &&
      /every nonfeathery seed reached soil/i.test(observationText) === allReachedSoil,
      at + ' comparison reports counts from this trial and says all landed only when both layouts support it');
    const reflection = page.getByLabel('Would you keep or change your prediction? Cite one fraction.', { exact:true });
    check(await reflection.isVisible() && await reflection.getAttribute('id') === 'hb-reflection',
      at + ' comparison asks students to revisit their prediction using one of their fractions');
    check(await page.locator('#hb-compare [data-hb-go="explain"]').isDisabled()&&
      await page.locator('.hb-steps [data-hb-go="explain"]').isDisabled(),
      at+' Explain stays locked until the student writes a comparison');
    await reflection.fill(REFLECTION_TEXT);
    await reflection.press('Tab');
    await completedSteps(page, ['predict', 'release', 'compare'], at + ' comparison recorded');
    if (cfg.width === 1366) {
      await checkDenominator(page, baseline.seed);
      // Leave the disclosure open for the restoration check, while navigating away.
      await page.locator('#hb-denominator-check summary').press('Enter');
      await disclosed(page, 'hb-denominator-check', true);
    }
    check(!await page.locator('#hb-published').isVisible(),
      at + ' does not mix the published numbers into the student comparison');
    await fits(page, 'main, #hb-compare, #hb-compare-chart, #hb-compare-table', at + ' comparison');
    await shot(page, at + '-compare');

    await stage(page, 'explain', cfg.touch ? 'touch' : 'keyboard');
    await completedSteps(page, ['predict', 'release', 'compare'], at + ' explanation not yet recorded');
    if (cfg.width === 1366) check(!/soil-landing rate for nonfeathery|compare seeds that landed on soil/i
      .test(await page.locator('#hb-status').textContent()), 'Compare feedback does not leak into the Explain footer');
    check(await page.locator('#hb-explain-summary').isVisible(),
      at + ' keeps the student’s own released evidence on the explanation screen');
    await hasVisibleTable(page, '#hb-explain-table');
    const carried = await resultRows(page, '#hb-explain-table', baseline.seed, at + ' explanation table');
    check(JSON.stringify(carried) === JSON.stringify(compared), at + ' carries the exact comparison data into Explain');
    const source = '#hb-published [data-hb-source-content]';
    const published = page.locator(source);
    const researchDisclosure = page.locator('#hb-published');
    check(await researchDisclosure.locator('summary').isVisible() && await published.count() === 1,
      at + ' retains the research disclosure label and exactly one evidence panel');
    check(!await published.isVisible(), at + ' offers published observations as optional separate evidence');
    await hasVisibleTable(page, source);
    const publishedText = exact(await published.textContent());
    check(publishedText.includes('15%') && publishedText.includes('28%') &&
      /published|model trial/i.test(publishedText),
      at + ' labels the measured research separately from the modeled wind release');
    check((await published.getByRole('link').getAttribute('href')).includes('PMC2268839') ||
      (await published.getByRole('link').getAttribute('href')).includes('0708446105'),
      at + ' links the published evidence to the primary study');
    const answers = page.locator('#hb-explain [data-hb-answer]');
    check(await answers.count() >= 3, at + ' offers prompts for a claim, evidence, and a limitation');
    for (const node of await answers.all()) {
      const key = await node.getAttribute('data-hb-answer');
      if (EXAMPLE_TEXT[key]) await node.fill(EXAMPLE_TEXT[key]);
    }
    await completedSteps(page, ['predict', 'release', 'compare', 'explain'], at + ' all work recorded');
    if (cfg.width === 1366) await fillStandaloneIdentity(page);
    else check(await page.locator('#hb-name').inputValue() === 'Hawksbeard QA' &&
      await page.locator('#hb-period').inputValue() === '3',
      at + ' uses the existing dashboard sign-in as the report default');
    if (cfg.width === 768) {
      const { report } = await downloadReport(page);
      check(report.includes('Name: Hawksbeard QA') && report.includes('Class period: 3'),
        'without overrides the downloaded report uses the existing dashboard sign-in');
    }
    await fits(page, 'main, #hb-explain, #hb-explain-table, [data-hb-answer], #hb-name, #hb-period', at + ' explanation');
    await shot(page, at + '-explain');
    if (cfg.touch || cfg.width === 1366) await axe(page, '#hb-explain', at + ' explanation');

    if (cfg.width === 1366) {
      await page.locator('#hb-method summary').press('Enter');
      await disclosed(page, 'hb-method', true);
      await disclosed(page, 'hb-published', true);
      const expectedSaved = await snapshot(page);
      check(Object.entries(EXAMPLE_TEXT).every(([key, value]) => expectedSaved.answers[key] === value),
        'answers are saved with the modeled evidence on this browser');
      await page.reload();
      await page.locator('#hb-explain').waitFor({ state: 'visible' });
      const restored = await snapshot(page);
      check(restored.seed === expectedSaved.seed && restored.released === Model.PLANTS &&
        restored.prediction === expectedSaved.prediction &&
        JSON.stringify(restored.answers) === JSON.stringify(expectedSaved.answers),
        'reload preserves the exact completed trial, prediction, and writing');
      for (const [key, value] of Object.entries(EXAMPLE_TEXT)) {
        check(await page.locator('#hb-explain [data-hb-answer="' + key + '"]').inputValue() === value,
          'restored ' + key + ' appears in the classwork form');
      }
      check(await published.isVisible() && await page.locator('#hb-method').evaluate(el => el.open) &&
        await page.locator('#hb-denominator-check').evaluate(el => el.open),
        'reload restores open research, model method, and Compare quick check disclosures');
      check(await page.locator('#hb-name').inputValue() === STANDALONE_NAME &&
        await page.locator('#hb-period').inputValue() === STANDALONE_PERIOD,
        'this trial restores its standalone report name and class period');
      await completedSteps(page, ['predict', 'release', 'compare', 'explain'], 'reloaded trial');
      await stage(page, 'compare');
      check(await reflection.inputValue() === REFLECTION_TEXT &&
        await page.locator('#hb-denominator-check').evaluate(el => el.open) &&
        await page.locator('input[name="hb-denominator"][value="soil"]').isChecked()&&
        /compare seeds that landed on soil/.test(await page.locator('.hb-denominator-feedback').textContent()),
        'Compare restores the reflection, disclosure, and saved denominator feedback for this trial');
      await page.locator('#hb-denominator-check summary').press('Enter');
      await disclosed(page, 'hb-denominator-check', false);
      await stage(page, 'explain');
      await page.reload();
      await page.locator('#hb-explain').waitFor({ state:'visible' });
      check(!await page.locator('#hb-denominator-check').evaluate(el => el.open) && await published.isVisible(),
        'reload preserves closed Compare instructions independently of open research');
      await confirmReport(page, restored);
      await dashboardLinks(page, base);
    }

    check(errors.length === 0, at + ' has no uncaught browser errors: ' + errors.join(', '));
  } finally {
    await context.close();
  }
}

async function resetTrial(page) {
  const untouched = 'aplab:test:outside-hawksbeard';
  await page.evaluate(key => localStorage.setItem(key, 'keep'), untouched);
  const old = await snapshot(page);
  const dialog = page.locator('#hb-reset-dialog');
  await page.locator('#hb-restart').press('Enter');
  await dialog.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  check((await snapshot(page)).seed === old.seed && (await snapshot(page)).released === old.released,
    'canceling the restart preserves the existing trial');
  await page.locator('#hb-restart').press('Enter');
  await page.locator('#hb-reset-confirm').press('Enter');
  await page.locator('#hb-predict').waitFor({ state: 'visible' });
  const reset = await snapshot(page);
  check(reset.released === 0 && reset.prediction === '' && !Object.keys(reset.answers).length &&
    await page.evaluate(key => localStorage.getItem(key) === 'keep', untouched),
    'confirmed restart clears only the current lab and returns to prediction');
}

async function dashboardLinks(page, base) {
  await page.goto(base + 'openscied-dashboard.html');
  const unit = page.locator('section[aria-labelledby="unit4"]');
  check(await unit.locator('#unit4').isVisible() && /Unit 4/i.test(await unit.locator('#unit4').innerText()),
    'dashboard has a live Unit 4 section');
  const card = unit.locator('.dashboard-activity').filter({
    has: page.getByRole('heading', { name:'Hawksbeard Wind Lab', level:3, exact:true })
  });
  check(await card.count() === 1, 'dashboard lists Hawksbeard Wind Lab once under Unit 4');
  const action = card.getByRole('link',{ name:'Continue activity: Hawksbeard Wind Lab', exact:true });
  check(await card.getByRole('link').count() === 1 && await action.isVisible() &&
    await action.getAttribute('href') === FILE+'#explain',
    'the saved card has one accessible Continue link that opens the saved Explain step');
  const artwork = card.locator('a.dashboard-preview');
  await artwork.scrollIntoViewIfNeeded();
  check(await artwork.isVisible(), 'the card keeps its clickable artwork visible');
  check(await artwork.getAttribute('aria-hidden') === 'true',
    'the decorative artwork does not supply a second accessible link');
  check(await artwork.getAttribute('tabindex') === '-1', 'the artwork adds no keyboard stop');
  const illustration = artwork.locator('img[src="assets/openscied-atlas-b4-hawksbeard.svg"]');
  check(await illustration.count() === 1, 'the card shows its revised illustration');
  await page.waitForFunction(src => [...document.images].some(img =>
    img.getAttribute('src') === src && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0
  ), 'assets/openscied-atlas-b4-hawksbeard.svg');
  const artHref = await artwork.getAttribute('href');
  const actionHref = await action.getAttribute('href');
  check(artHref && actionHref && new URL(artHref, page.url()).href === new URL(actionHref, page.url()).href,
    'clicking the artwork opens the same saved Explain step as the named action');
  const resume = page.locator('#openscied-resume-link');
  check(await resume.isVisible() && (await resume.getAttribute('href')).startsWith(FILE),
    'dashboard Resume points to the saved Hawksbeard investigation');
  await resume.press('Enter');
  await page.locator('#hb-explain').waitFor({ state: 'visible' });
  check(await page.locator('[data-hb-answer="claim"]').inputValue() === EXAMPLE_TEXT.claim,
    'dashboard Resume opens the student’s existing Explain evidence and work');

  await resetTrial(page);
  await page.goto(base + 'openscied-teacher-guide.html');
  const guide = page.locator('article[data-guide-for="' + FILE + '"]');
  check(await guide.count() === 1 && /Hawksbeard Wind Lab/i.test(await guide.innerText()) &&
    await guide.locator('a[href="' + FILE + '"]').isVisible(),
    'teacher guide includes one classroom plan and activity link for Hawksbeard');
}

(async () => {
  const server = await serve();
  let browser;
  try {
    const executablePath = process.env.CHROMIUM_PATH || process.env.CHROMIUM_EXECUTABLE;
    browser = await chromium.launch(executablePath ? { executablePath } : {});
    await fs.mkdir(OUT, { recursive: true });
    for (const viewport of VIEWPORTS) await play(browser, server.url, viewport);
    await verifySaveConflict(browser, server.url, {
      protectIdentity:true, file:FILE, key:SAVE, warning:'#hb-save-warning', backup:'#hb-download-tab', check,
      async edit(page,n) {
        if(!await page.locator('#hb-predict').isVisible()) await page.locator('.hb-steps [data-hb-go="predict"]').click();
        await page.locator('input[name="hb-prediction"]').nth(n).check();
        await page.locator('#hb-prediction button[type="submit"]').click();
      },
      read:saved=>['field','city','same'].indexOf(saved?.prediction), draft:/Prediction: About the same/i
    });
    console.log('openscied-b4-hawksbeard-browser: ' + checks + ' checks passed');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
