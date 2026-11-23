'use strict';

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
  await context.addInitScript(() => {
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
  await quiz.locator('summary').press('Enter');
}
async function confirmReport(page, state) {
  const downloaded = page.waitForEvent('download');
  await page.locator('#hb-download').press('Enter');
  const file = await downloaded;
  const report = await fs.readFile(await file.path(), 'utf8');
  check(file.suggestedFilename() === 'hawksbeard-wind-lab.txt' &&
    /Hawksbeard Wind Lab/i.test(report) && /simulat/i.test(report) &&
    /Cheptou/i.test(report) && /0708446105|PMC2268839/i.test(report) &&
    report.includes('Name: Hawksbeard QA') && report.includes('Class period: 3') &&
    Object.values(state.answers).filter(Boolean).every(answer => report.includes(answer)),
    'real report downloads the identified simulation, research citation, and student responses');
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
    const baseline = await snapshot(page);
    await sceneParity(page, baseline.seed, 0, at);
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
            markers: document.querySelectorAll('[data-hb-seed]:not([data-hb-land])').length
          };
        }, SAVE);
        check(inFlight.busy && inFlight.count === 1 && inFlight.markers === 20,
          'animated pair guards against repeat activation and flies ten seeds in each environment');
      } else await use(page, '#hb-release-next', cfg);
      await released(page, step);
      await page.waitForFunction(() =>
        !document.querySelector('[data-hb-seed]:not([data-hb-land])') &&
        !document.querySelector('#hb-release-next')?.textContent.startsWith('Releasing'));
      const series = await snapshot(page);
      check(series.seed === baseline.seed && series.released === step, at + ' records matched plant pair ' + step);
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
        await shot(page, at + '-release-3');
        if (cfg.width === 1366) {
          await page.reload();
          await released(page, step);
          check(await release.isVisible() && (await snapshot(page)).seed === baseline.seed,
            'reload mid-investigation returns to the same release count and paired flight seed');
        }
      }
    }

    await stage(page, 'compare', cfg.touch ? 'touch' : 'keyboard');
    check(await page.locator('#hb-compare-summary').isVisible() && await page.locator('#hb-compare-chart').isVisible(),
      at + ' comparison displays both the student-run summary and plot');
    await hasVisibleTable(page, '#hb-compare-table');
    const compared = await resultRows(page, '#hb-compare-table', baseline.seed, at + ' compare table');
    if (cfg.width === 1366) await checkDenominator(page, baseline.seed);
    check(!await page.locator('#hb-published').isVisible(),
      at + ' does not mix the published numbers into the student comparison');
    await fits(page, 'main, #hb-compare, #hb-compare-chart, #hb-compare-table', at + ' comparison');
    await shot(page, at + '-compare');

    await stage(page, 'explain', cfg.touch ? 'touch' : 'keyboard');
    check(await page.locator('#hb-explain-summary').isVisible(),
      at + ' keeps the student’s own released evidence on the explanation screen');
    await hasVisibleTable(page, '#hb-explain-table');
    const carried = await resultRows(page, '#hb-explain-table', baseline.seed, at + ' explanation table');
    check(JSON.stringify(carried) === JSON.stringify(compared), at + ' carries the exact comparison data into Explain');
    const source = '#hb-published [data-hb-source-content]';
    const published = page.locator(source);
    check(!await published.isVisible(), at + ' offers published observations as optional separate evidence');
    await hasVisibleTable(page, source);
    const publishedText = exact(await published.textContent());
    check(publishedText.includes('15%') && publishedText.includes('28%') &&
      /published|model trial/i.test(publishedText),
      at + ' labels the measured research separately from the modeled wind release');
    const answers = page.locator('#hb-explain [data-hb-answer]');
    check(await answers.count() >= 3, at + ' offers prompts for a claim, evidence, and a limitation');
    for (const node of await answers.all()) {
      const key = await node.getAttribute('data-hb-answer');
      if (EXAMPLE_TEXT[key]) await node.fill(EXAMPLE_TEXT[key]);
    }
    await fits(page, 'main, #hb-explain, #hb-explain-table, [data-hb-answer]', at + ' explanation');
    await shot(page, at + '-explain');
    if (cfg.touch || cfg.width === 1366) await axe(page, '#hb-explain', at + ' explanation');

    if (cfg.width === 1366) {
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
  const card = unit.locator('.dashboard-activity').filter({ has: page.locator('a[href="' + FILE + '"]') });
  check(await card.count() === 1 && /Hawksbeard Wind Lab/i.test(await card.innerText()),
    'dashboard lists the Hawksbeard activity once, under Unit 4');
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
    console.log('openscied-b4-hawksbeard-browser: ' + checks + ' checks passed');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
