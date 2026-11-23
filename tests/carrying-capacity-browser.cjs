/* Focused preview browser regression. Run via node tests/carrying-capacity-browser.cjs.
   Set CARRYING_CAPACITY_SCREENSHOTS to save screenshots for visual review. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { serve, routeLibs } = require('./_h');

const FILE = 'openscied-b1-carrying-capacity.html';
const SHOTS = process.env.CARRYING_CAPACITY_SCREENSHOTS;
const AXE = require.resolve('axe-core/axe.min.js');
const TEXT = {
  prediction: 'With less grass, the herd will have less food available.',
  claim: 'The simulated grass comparison tests my prediction by changing food availability.'
};
const viewportCases = [
  { name: '390-dark', width: 390, height: 844, dark: true, touch: true },
  { name: '768-light', width: 768, height: 1024 },
  { name: '1366-light', width: 1366, height: 768 },
  { name: '1920-light', width: 1920, height: 1080 }
];
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
  console.log('ok: ' + message);
};
const go = (p, panel) => p.locator(`button[data-cc-go="${panel}"]:visible`).first().click();
const normalizeReport = text => text.replace(/\r\n/g, '\n').trim();

async function shot(p, name, fullPage = false) {
  if (!SHOTS) return;
  await fs.mkdir(SHOTS, { recursive: true });
  await p.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage, animations: 'disabled', timeout: 7000 });
}

async function rounds(p, round) {
  await p.waitForFunction(n => document.querySelector('#cc-round')?.textContent.trim() === `Round ${n} of 12`, round);
}

async function fit(p, selector) {
  await p.locator(selector).waitFor({ state: 'visible' });
  return p.locator(selector).evaluate(el => {
    const box = el.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    return box.width > 0 && box.height > 0 && box.left >= -1 && box.right <= width + 1 &&
      document.documentElement.scrollWidth <= width + 1;
  });
}

async function readiness(p, url, expectedScheme) {
  const response = await p.goto(url);
  assert.ok(response?.ok(), `Local activity should load from ${url}`);
  await rounds(p, 0);
  await p.locator('#cc-board svg[role="img"]').first().waitFor({ state: 'visible' });
  const dark = expectedScheme === 'dark';
  check(await p.evaluate(want => matchMedia('(prefers-color-scheme: dark)').matches === want &&
    matchMedia('(prefers-reduced-motion: reduce)').matches, dark), `${expectedScheme} and reduced-motion media match fixture`);
}

async function axeAudit(p, label) {
  if (!(await p.evaluate(() => typeof globalThis.axe === 'object'))) await p.addScriptTag({ path: AXE });
  const violations = await p.evaluate(async () => {
    const res = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations']
    });
    return res.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }));
  });
  check(violations.length === 0, label + ': axe ' + JSON.stringify(violations));
}

async function withPage(browser, cfg, work) {
  const context = await browser.newContext({
    viewport: { width: cfg.width, height: cfg.height },
    colorScheme: cfg.dark ? 'dark' : 'light',
    reducedMotion: 'reduce',
    hasTouch: !!cfg.touch,
    acceptDownloads: true
  });
  await routeLibs(context);
  await context.route(/https:\/\/(?:fonts\.(?:googleapis|gstatic)\.com|gc\.zgo\.at)\//, route => route.fulfill({
    status: 200,
    contentType: route.request().resourceType() === 'script' ? 'application/javascript' : 'text/css',
    body: ''
  }));
  const p = await context.newPage();
  p.setDefaultTimeout(6000);
  const errors = [];
  p.on('pageerror', err => errors.push(err.message));
  try {
    await work(p);
    check(errors.length === 0, `${cfg.name}: no browser errors ${errors.join('; ')}`);
  } catch (error) {
    try { await shot(p, cfg.name + '-failure', true); } catch (_) { /* Keep original failure. */ }
    throw error;
  } finally {
    await context.close();
  }
}

async function visualSweep(browser, url) {
  for (const cfg of viewportCases) {
    await withPage(browser, cfg, async p => {
      await readiness(p, url, cfg.dark ? 'dark' : 'light');
      check(await fit(p, '#cc-board') && await fit(p, '#cc-next'), cfg.name + ': starting scene and round control fit horizontally');
      check(await p.evaluate(stacked => {
        const board = document.querySelector('#cc-run .cc-station').getBoundingClientRect();
        const evidence = document.querySelector('#cc-run .cc-analysis').getBoundingClientRect();
        return stacked ? evidence.top >= board.bottom - 1 :
          evidence.left >= board.right - 1 && Math.abs(evidence.top - board.top) <= 2;
      }, cfg.width <= 768), cfg.name + ': scene and simulated chart reflow without overlap');
      await shot(p, cfg.name + '-setup');
      const next = p.locator('#cc-next');
      if (cfg.touch) await next.tap();
      else await next.click();
      await rounds(p, 1);
      check(await fit(p, '#cc-board') && await p.locator('#cc-outcome').isVisible(), cfg.name + ': first round scene and outcome are visible');
      await p.locator('#cc-board').scrollIntoViewIfNeeded();
      await shot(p, cfg.name + '-round-01');
      await p.locator('#cc-finish').click();
      await rounds(p, 12);
      check(await fit(p, '#cc-board') && await p.locator('#cc-compare').isVisible(), cfg.name + ': completed round scene fits and comparison unlocks');
      await p.locator('#cc-board').scrollIntoViewIfNeeded();
      await shot(p, cfg.name + '-round-12');
      if (cfg.width === 390 || cfg.width === 1366) await axeAudit(p, cfg.name + ' Run');
      await go(p, 'evidence');
      check(await fit(p, '#cc-field-chart svg'), cfg.name + ': published evidence plot stays on screen horizontally');
      await p.locator('#cc-field-chart').scrollIntoViewIfNeeded();
      await shot(p, cfg.name + '-evidence', true);
      if (cfg.width === 390 || cfg.width === 1366) await axeAudit(p, cfg.name + ' evidence');
    });
  }
}

async function followWorkflow(browser, url) {
  await withPage(browser, { name: 'desktop-workflow', width: 1366, height: 900 }, async p => {
    await readiness(p, url, 'light');
    await p.locator('#cc-prediction').fill(TEXT.prediction);
    const next = p.locator('#cc-next');
    await p.locator('#cc-reset').focus();
    await p.keyboard.press('Tab');
    check(await next.evaluate(el => document.activeElement === el), 'round control is reachable in sequential keyboard navigation');
    await p.keyboard.press('Enter');
    await rounds(p, 1);
    const firstOutcome = (await p.locator('#cc-outcome').textContent()).trim();
    check(firstOutcome.length > 10, 'keyboard starts a round and reveals a plain-language outcome');
    await p.reload();
    await rounds(p, 1);
    check(await p.locator('#cc-prediction').inputValue() === TEXT.prediction &&
      (await p.locator('#cc-outcome').textContent()).trim() === firstOutcome,
    'first round and prediction survive reload without changing the result');
    await next.press('Space');
    await rounds(p, 2);
    const history = p.locator('#cc-history tbody');
    const openHistory = async () => {
      await go(p, 'run');
      const details = p.locator('#cc-table');
      if (!(await details.evaluate(el => el.open))) await details.locator('summary').click();
      await history.waitFor({ state: 'visible' });
      return history.locator('tr').evaluateAll(rows => rows.map(row =>
        [...row.querySelectorAll('td,th')].map(cell => Number(cell.textContent.trim()))));
    };
    const early = await openHistory();
    check(early.length === 2 && early.every((row, index) => row.length === 7 && row[0] === index + 1),
      'simulated evidence table captures both early rounds');
    check(early.every(([, start, grass, survived, births, deaths, end]) =>
      survived === Math.min(start, grass) && births === Math.floor(survived / 2) &&
      deaths === start - survived && end === survived + births),
    'early simulated UI counts honor the feeding, survival and reproduction rules');
    check(await fit(p, '#cc-chart svg'), 'simulated run chart is available as well as its table');

    await p.locator('#cc-finish').click();
    await rounds(p, 12);
    const baseline = await openHistory();
    check(baseline.length === 12, 'simulated evidence retains the complete baseline trial');
    await p.locator('#cc-grass').selectOption('50');
    await p.locator('#cc-compare').click();
    await rounds(p, 0);
    await next.click();
    await rounds(p, 1);
    await p.locator('#cc-finish').click();
    await rounds(p, 12);
    const compared = await openHistory();
    check(compared.length === 12 && compared[0][1] === baseline[0][1] &&
      compared[0][2] === Math.floor(baseline[0][2] / 2) &&
      compared.some((row, i) => row[6] !== baseline[i][6]),
    'comparison keeps the starting herd, halves food availability, and changes a population result');
    await p.locator('#cc-view-baseline').click();
    check(JSON.stringify(await openHistory()) === JSON.stringify(baseline),
      'comparison leaves the complete baseline intact');
    await p.locator('#cc-view-comparison').click();

    const checkFood = p.locator('#cc-check-food');
    await checkFood.locator('input[name="cc-check-food"][value="herd"]').check();
    await p.locator('#cc-check-answer').click();
    const first = (await p.locator('#cc-feedback').textContent()).trim();
    check(await p.locator('#cc-feedback').isVisible() && first.length > 10, 'an alternate food claim gets visible written feedback');
    await checkFood.locator('input[name="cc-check-food"][value="grass"]').check();
    await p.locator('#cc-check-answer').click();
    check((await p.locator('#cc-feedback').textContent()).trim() !== first,
      'rechecking changes the written feedback');
    await go(p, 'evidence');
    check(await fit(p, '#cc-field-chart svg') && await p.locator('#cc-field-data').isVisible(),
      'published evidence has a distinct chart and data presentation');
    await go(p, 'explain');
    await p.locator('#cc-claim').fill(TEXT.claim);
    await go(p, 'run');
    check(await p.locator('#cc-prediction').inputValue() === TEXT.prediction, 'switching sections preserves student work');
    await go(p, 'explain');
    await axeAudit(p, 'desktop Explain');
    await shot(p, '1366-light-explain', true);

    await p.reload();
    await p.locator('.cc-nav [data-cc-go="explain"][aria-current="page"]').waitFor({ state: 'visible' });
    check(await p.locator('#cc-claim').inputValue() === TEXT.claim, 'written claim and active explanation stage survive reload');
    check(await p.locator('#cc-writing-evidence').textContent().then(s => /baseline/i.test(s) && /50% grass comparison/i.test(s)),
      'both complete trials remain available beside the restored writing');
    const downloadPromise = p.waitForEvent('download');
    await p.locator('#cc-download').click();
    const download = await downloadPromise;
    check(download.suggestedFilename() === 'carrying-capacity-investigation.txt', 'download has the investigation filename');
    const report = normalizeReport(await fs.readFile(await download.path(), 'utf8'));
    check(report.includes(TEXT.prediction) && report.includes(TEXT.claim) && /simulat|model/i.test(report),
      'download contains student work and discloses the modeled evidence');
    check(/grass/i.test(report) && /50\s*%/.test(report), 'download includes the selected lower-grass comparison');

    const copy = p.locator('#cc-copy');
    await copy.focus();
    await copy.press('Enter');
    const reportDialog = p.locator('#cc-report');
    await reportDialog.waitFor({ state: 'visible' });
    check(normalizeReport(await reportDialog.locator('#cc-report-text').inputValue()) === report,
      'copyable investigation agrees with the downloaded file');
    await p.keyboard.press('Escape');
    await reportDialog.waitFor({ state: 'hidden' });
    check(await copy.evaluate(el => document.activeElement === el), 'Escape restores focus after previewing report');

    await go(p, 'run');
    const reset = p.locator('#cc-reset');
    await reset.click();
    await p.locator('#cc-reset-confirm').waitFor({ state: 'visible' });
    await p.keyboard.press('Escape');
    await p.locator('#cc-reset-confirm').waitFor({ state: 'hidden' });
    await go(p, 'explain');
    check(await p.locator('#cc-claim').inputValue() === TEXT.claim, 'canceling reset does not erase work');
    await go(p, 'run');
    await reset.click();
    await p.locator('#cc-reset-confirm').click();
    await go(p, 'run');
    await rounds(p, 0);
    check(await p.locator('#cc-prediction').inputValue() === '', 'confirmed reset starts a fresh trial');
  });
}

(async () => {
  const server = await serve();
  let browser;
  try {
    browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});
    const url = server.url + FILE;
    await visualSweep(browser, url);
    await followWorkflow(browser, url);
    console.log(`carrying-capacity-browser: ${checks} checks passed`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
