/* Browser regression for the optional Carbon & Energy Budget mode.
 * The existing Carbon Atom Journey browser and model suites are separate. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { serve, routeLibs } = require('./_h');

const FILE = 'openscied-b2-carbon-journey.html';
const OUT = path.resolve(__dirname, '../artifacts/l9/budget');
const HOST = '#carbon-budget-host';
const AXE = require.resolve('axe-core/axe.min.js');
const CASES = [
  { width:390, height:844, dark:true, mobile:true },
  { width:768, height:1024 },
  { width:1366, height:768 },
  { width:1920, height:1080 }
];
const PREDICTION = 'Fire will transfer some stored peat carbon to air and some stored chemical energy to heat.';
const EXPLANATION = 'I held the starting landscape and light steps constant. The fire transfer changed the reservoirs without destroying carbon or turning carbon into heat.';
const CARBON = ['air', 'ocean', 'plants', 'peat'];
const ENERGY = ['plants', 'peat', 'heat', 'sunlight'];
const BUDGET_END = 8;
const JOURNEY_KEY = 'aplab:openscied:b2-carbon-journey:v1';

let count = 0;
function check(ok, message) {
  assert.ok(ok, message);
  count++;
  console.log('ok: ' + message);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const numberOf = (obj, keys) => keys.reduce((sum, key) => sum + obj[key], 0);
const trialCard = (p, id) => p.locator(HOST + ' [data-budget-trial="' + id + '"]');

async function shot(p, name, fullPage = true) {
  await fs.mkdir(OUT, { recursive:true });
  await p.screenshot({ path:path.join(OUT, name + '.png'), fullPage, animations:'disabled', timeout:8000 });
}
async function stage(p, index) {
  await p.waitForFunction(n => document.querySelector('#cb-stage')?.dataset.stageIndex === String(n), index);
}
async function fit(p, selector) {
  const el = p.locator(selector);
  await el.waitFor({ state:'visible' });
  return el.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.left >= -1 &&
      rect.right <= document.documentElement.clientWidth + 1 &&
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  });
}
async function pools(p, id, ledger, keys) {
  return trialCard(p, id).locator('[data-ledger="' + ledger + '"]').evaluate((node, expected) => {
    const result = {};
    for (const key of expected) {
      const item = node.querySelector('[data-pool="' + key + '"]');
      const units = item?.dataset.units;
      if (!item || typeof units !== 'string' || !/^\d+$/.test(units) ||
          item.querySelector('dd')?.textContent.trim() !== units) throw Error('Missing displayed '+key+' pool units: '+units);
      result[key] = Number(units);
    }
    return result;
  }, keys);
}
async function ledgers(p) {
  const read = async id => ({
    carbon: await pools(p, id, 'carbon', CARBON),
    energy: await pools(p, id, 'energy', ENERGY)
  });
  return { baseline:await read('noFire'), fire:await read('fire') };
}
function tally(snapshot) {
  return [numberOf(snapshot.carbon, CARBON),
    numberOf(snapshot.energy, ['plants', 'peat', 'heat']) - snapshot.energy.sunlight];
}
async function axe(p, label) {
  await p.addScriptTag({ path:AXE });
  const violations = await p.evaluate(async host => {
    const result = await axe.run(document.querySelector(host), {
      runOnly:{ type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] },
      resultTypes:['violations']
    });
    return result.violations.map(v => [v.id, v.nodes.map(n => n.target)]);
  }, HOST);
  check(violations.length === 0, label + ' Budget accessibility ' + JSON.stringify(violations));
}

async function withPage(browser, cfg, work) {
  const context = await browser.newContext({
    viewport:{ width:cfg.width, height:cfg.height }, colorScheme:cfg.dark?'dark':'light',
    reducedMotion:'reduce', isMobile:!!cfg.mobile, hasTouch:!!cfg.mobile,
    acceptDownloads:true
  });
  await routeLibs(context);
  await context.route(/https:\/\/(?:fonts\.(?:googleapis|gstatic)\.com|gc\.zgo\.at)\//,
    route => route.fulfill({ status:200, contentType:route.request().resourceType()==='script'?'application/javascript':'text/css', body:'' }));
  const p = await context.newPage();
  p.setDefaultTimeout(5500);
  const errors = [];
  p.on('pageerror', error => errors.push(error.message));
  try {
    await work(p);
    check(errors.length === 0, cfg.width + ' browser runtime errors ' + errors.join('; '));
  } catch (error) {
    try { await shot(p, cfg.width + '-failure'); } catch (_) {}
    throw error;
  } finally {
    await context.close();
  }
}

async function openBudget(p, url, keyboard = false) {
  const response = await p.goto(url);
  assert.ok(response?.ok(), 'carbon journey page loads at the local origin');
  let original;
  if (keyboard) {
    await p.locator('#roll').press('Enter');
    await p.locator('#prediction-options button').first().waitFor({ state:'visible' });
    original = {
      die:await p.locator('#die').getAttribute('aria-label'),
      save:await p.evaluate(key => localStorage.getItem(key), JOURNEY_KEY)
    };
    check(!!original.die && !!original.save, 'the original journey has a real pending roll and a saved record before using Budget');
  }
  const tab = p.locator('button[data-page="budget"]');
  if (keyboard) await tab.press('Enter'); else await tab.click();
  await p.locator(HOST).waitFor({ state:'visible' });
  check(new URL(p.url()).hash === '#budget' && await p.locator('#roll').isHidden(),
    'Budget route opens the budget alone without changing the original journey UI');
  return original;
}

async function beginBudget(p) {
  const predict = p.locator('#cb-prediction');
  await predict.fill(PREDICTION);
  await p.locator('#cb-start').press('Enter');
  await stage(p, 0);
  const initial = await ledgers(p);
  check(same(initial.baseline, initial.fire) && initial.baseline.energy.sunlight === 0 &&
    same(initial.baseline.carbon, { air:12, ocean:5, plants:5, peat:8 }),
    'both controlled trials begin with the same physical inventories and no accrued light input');
  return initial;
}

async function exerciseBudget(p, cfg, url) {
  const { width, dark, mobile } = cfg;
  const label = width + (dark ? '-dark' : '-light');
  check(await p.evaluate(d => matchMedia('(prefers-color-scheme:dark)').matches===!!d &&
    matchMedia('(prefers-reduced-motion:reduce)').matches, dark), label + ' color and reduced-motion fixture');
  const original = await openBudget(p, url, width === 1366);
  check(await fit(p, '#cb-start') && await fit(p, '#cb-prediction'), label + ' setup and prompt fit without horizontal overflow');
  await shot(p, label + '-setup');
  const initial = await beginBudget(p);
  const conserved = tally(initial.baseline);
  check(same(conserved, [30,13]), 'the display starts with 30 carbon units and 13 stored energy units, not a combined total');
  const next = p.locator('#cb-next'), prev = p.locator('#cb-prev');
  check(await prev.isHidden(), 'the first checkpoint cannot step back into an invented state');
  const history = [initial];
  let fireShift = null;
  for (let index = 1; index <= BUDGET_END; index++) {
    if (mobile && index === 1) await next.tap(); else if (index === 1) await next.press('Enter'); else await next.click();
    await stage(p, index);
    const snapshot = await ledgers(p);
    const before = history.at(-1);
    history.push(snapshot);
    check(same(tally(snapshot.baseline), conserved) && same(tally(snapshot.fire), conserved),
      label + ' checkpoint ' + index + ' conserves carbon separately from tracked energy minus light input');
    if (!fireShift && !same(snapshot.fire, snapshot.baseline)) {
      fireShift = { index, snapshot };
      check(index === 4 && same(before.baseline, before.fire) &&
        snapshot.fire.carbon.air - snapshot.baseline.carbon.air === 4 &&
        snapshot.baseline.carbon.peat - snapshot.fire.carbon.peat === 4 &&
        snapshot.fire.energy.heat - snapshot.baseline.energy.heat === 4 &&
        snapshot.baseline.energy.peat - snapshot.fire.energy.peat === 4,
        'trials diverge only at the single fire event: peat to air carbon and stored energy to heat');
      await shot(p, label + '-fire-checkpoint');
    }
  }
  check(!!fireShift && history.some(s => s.baseline.energy.sunlight > 0),
    'the complete sequence shows both a controlled difference and light entering the ecosystem');
  const final = history.at(-1), base = final.baseline, fire = final.fire;
  check(same([base.carbon.air, fire.carbon.air, base.carbon.peat, fire.carbon.peat,
    base.energy.heat, fire.energy.heat, base.energy.sunlight, fire.energy.sunlight], [11,15,9,5,2,6,3,3]),
    'the final ledgers show the actual carbon reservoirs, heat totals, and equal sunlight added');
  check(await next.isHidden() && await fit(p, '#cb-comparison'), label + ' complete comparison fits and the sequence stops');
  check(await p.locator('#cb-explain').isVisible() && await fit(p, '#cb-explain-evidence'),
    label + ' final quantitative evidence is beside the explanation');
  const evidence = await p.locator('#cb-explain-evidence [data-compare-pool]').evaluateAll(rows =>
    Object.fromEntries(rows.map(el => [el.dataset.comparePool, [Number(el.dataset.noFire), Number(el.dataset.fire)]])));
  check(same(evidence, { air:[11,15], peat:[9,5], chemical:[9,5], heat:[2,6] }),
    'explanation evidence includes exact matched results in separate carbon and energy units');
  await shot(p, label + '-comparison');
  if (width === 390 || width === 1366) await axe(p, label);

  if (width === 1366) {
    await p.locator('#cb-log summary').press('Enter');
    const table = p.locator('#cb-log table');
    await table.nth(1).waitFor({ state:'visible' });
    const rows = await table.evaluateAll(nodes => nodes.map(t => ({
      title:t.caption.textContent, rows:t.tBodies[0].rows.length
    })));
    check(rows.length === 2 && rows.every(t => t.rows === 18) &&
      /carbon/i.test(rows[0].title) && /energy/i.test(rows[1].title),
      'the keyboard-accessible evidence log provides all nine checkpoints for both trials in separate tables');
    await p.locator('#cb-explanation').fill(EXPLANATION);
    await prev.press('Space');
    await stage(p, BUDGET_END - 1);
    check(same(await ledgers(p), history[BUDGET_END - 1]), 'keyboard review shows the actual previous committed ledger');
    await next.press('Enter');
    await stage(p, BUDGET_END);
    check(same(await ledgers(p), history.at(-1)), 'reviewing a completed scenario does not reapply a transfer');
    await p.reload();
    await stage(p, BUDGET_END);
    check(await p.locator('#cb-prediction').inputValue() === PREDICTION &&
      await p.locator('#cb-explanation').inputValue() === EXPLANATION &&
      same(await ledgers(p), history.at(-1)),
      'reload in Budget restores both ledgers, the matched checkpoint, and both student responses');
    check(await p.evaluate(key => localStorage.getItem(key), JOURNEY_KEY) === original.save,
      'Budget interaction leaves the pre-existing original journey record untouched');
    const dashboardResponse = await p.goto(new URL('openscied-dashboard.html', url).href);
    assert.ok(dashboardResponse?.ok(), 'OpenSciEd dashboard loads for a Budget resume');
    const resume = p.locator('#carbon-journey-open');
    check(await resume.getAttribute('href') === FILE + '#budget' &&
      /Budget comparison complete/.test(await p.locator('#carbon-journey-progress').textContent()),
      'the existing dashboard card picks up the newer completed Budget mode without listing a second activity');
    await resume.press('Enter');
    await stage(p, BUDGET_END);
    check(await p.locator('#cb-explanation').inputValue() === EXPLANATION,
      'keyboard dashboard Resume returns to the completed Budget evidence and writing');
    await p.locator('button[data-page="play"]').press('Enter');
    check(await p.locator('#die').getAttribute('aria-label') === original.die &&
      await p.locator('#prediction-options button').count() === 7,
      'returning to the original mode restores its pending roll and prediction choices');
    await p.locator('button[data-page="budget"]').press('Enter');
    await stage(p, BUDGET_END);
    await verifyReportAndReset(p, original);
  }
  return { history, initial };
}

async function verifyReportAndReset(p, original) {
  const downloadPromise = p.waitForEvent('download');
  await p.locator('#cb-download').press('Enter');
  const file = await downloadPromise;
  const report = await fs.readFile(await file.path(), 'utf8');
  check(file.suggestedFilename() === 'Carbon-Energy-Budget.txt' &&
    report.startsWith('Carbon & Energy Budget (simulated model units)') &&
    report.includes('Without fire: air 11') && report.includes('With peat fire: air 15') &&
    report.includes('Prediction: ' + PREDICTION) && report.includes('Explanation: ' + EXPLANATION),
    'Budget downloads its own real report with matched data, simulation disclosure, and both student responses');
  await p.locator('#cb-download-fallback summary').press('Enter');
  check(await p.locator('#cb-copy').isVisible() && await p.locator('#cb-copy').inputValue() === report,
    'the visible no-download fallback contains exactly the same report');

  await p.locator('#cb-reset').press('Enter');
  const dialog = p.locator('#cb-reset-dialog');
  await dialog.waitFor({ state:'visible' });
  await p.keyboard.press('Escape');
  await dialog.waitFor({ state:'hidden' });
  check(await p.locator('#cb-explanation').inputValue() === EXPLANATION &&
    await p.locator('#cb-reset').evaluate(el => document.activeElement === el),
    'closing the Budget restart dialog leaves the report intact and restores focus');
  await p.locator('#cb-reset').click();
  await p.locator('#cb-confirm-reset').click();
  await stage(p, -1);
  check(await p.locator('#cb-prediction').inputValue() === '' && await p.locator('#cb-explain').isHidden() &&
    await p.locator('#cb-start').evaluate(el => !el.hidden && document.activeElement === el) &&
    await p.locator('#cb-download').isDisabled(),
    'confirmed Budget reset clears only its checkpoints, predictions, and explanation');
  await p.locator('button[data-page="play"]').press('Enter');
  check(await p.locator('#die').getAttribute('aria-label') === original.die &&
      await p.locator('#prediction-options button').count() === 7,
    'Budget reset leaves the original pending Journey roll in place');
}

(async () => {
  const server = await serve();
  let browser;
  try {
    const binary = process.env.CHROMIUM_PATH || process.env.CHROMIUM_EXECUTABLE;
    browser = await chromium.launch(binary ? { executablePath:binary } : {});
    for (const cfg of CASES) await withPage(browser, cfg, p => exerciseBudget(p, cfg, server.url + FILE));
    console.log('carbon-budget-browser: ' + count + ' checks passed');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
