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

const HABITAT = '#cc-habitat-app';
const ANIMAL = '[data-habitat-animal]';
const SOURCE = ['food', 'water', 'shelter'];
const habitatAnimal = (p, id) => p.locator(HABITAT + ` [data-habitat-animal="${id}"]`);
const habitatStation = (p, resource) => p.locator(HABITAT + ` [data-habitat-resource="${resource}"]`);
const habitatMatch = (p, id) => p.locator(HABITAT + ` [data-habitat-match="${id}"]`);
const habitatStock = async (p, resource) => p.locator(HABITAT + ` [data-habitat-stock="${resource}"]`).evaluate(el => {
  // Prefer a numeric accessible/state hook if the UI provides one; prose also
  // includes the number of remaining whole resource units.
  const value = el.dataset.habitatRemaining ?? (el.textContent.match(/\d+/) || [])[0];
  if (value == null || !/^\d+$/.test(value)) throw new Error('Missing numeric habitat stock for ' + el.dataset.habitatStock);
  return Number(value);
});
const habitatAnimals = (p) => p.locator(HABITAT + ' ' + ANIMAL).evaluateAll(nodes => nodes.map(el => ({
  id: el.dataset.habitatAnimal, need: el.dataset.habitatNeed, disabled: el.disabled
})));
const habitatHerd = (p) => p.locator(HABITAT).evaluate(el => [...new Set(
  [...el.querySelectorAll('[data-habitat-animal], [data-habitat-match]')]
    .map(item => (item.dataset.habitatAnimal ?? item.dataset.habitatMatch) + ':' + item.dataset.habitatNeed)
)].sort());

const habitatScores = locator => locator.locator('article.cc-habitat-outcome dl').evaluateAll(rows =>
  rows.map(dl => Object.fromEntries([...dl.querySelectorAll('dt')].map(term =>
    [term.textContent.trim(), Number(term.nextElementSibling.textContent.trim())]))));
const sameScores = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
const BALANCED_SCORE = { 'Starting herd': 8, Survived: 8, Unmatched: 0, Calves: 4, 'Next herd': 12 };
const FOOD_SCORE = { 'Starting herd': 8, Survived: 6, Unmatched: 2, Calves: 3, 'Next herd': 9 };

async function beginHabitat(p) {
  await go(p, 'habitat');
  const prediction = p.locator('#cc-habitat-prediction');
  await prediction.waitFor({ state: 'visible' });
  await p.locator('#cc-habitat-resource').selectOption('low-food');
  await prediction.selectOption('food');
  await p.locator('#cc-habitat-start').click();
  await p.locator(HABITAT + ' ' + ANIMAL).first().waitFor({ state: 'visible' });
}

async function availableAnimal(p) {
  const roster = await habitatAnimals(p);
  for (const piece of roster) {
    if (!piece.disabled && SOURCE.includes(piece.need) && await habitatStock(p, piece.need) > 0 &&
        await habitatMatch(p, piece.id).count() === 0) return piece;
  }
  return null;
}

async function requireAvailableAnimal(p) {
  const piece = await availableAnimal(p);
  assert.ok(piece, 'At least one unmatched animal should have an available station.');
  return piece;
}

async function matchRemainingHabitat(p) {
  let matched = 0;
  for (let i = 0, max = (await habitatHerd(p)).length; i < max; i++) {
    const piece = await availableAnimal(p);
    if (!piece) break;
    await matchHabitat(p, piece, 'click');
    matched++;
  }
  return matched;
}

async function matchHabitat(p, piece, modality) {
  const source = habitatAnimal(p, piece.id);
  const target = habitatStation(p, piece.need);
  const stock = await habitatStock(p, piece.need);
  if (modality === 'keyboard') {
    await source.focus();
    await p.keyboard.press('Space');
    await target.focus();
    await p.keyboard.press('Enter');
  } else if (modality === 'drag') {
    await source.dragTo(target);
  } else if (modality === 'tap') {
    await source.tap();
    await target.tap();
  } else {
    await source.click();
    await target.click();
  }
  await habitatMatch(p, piece.id).waitFor({ state: 'visible' });
  check(await habitatStock(p, piece.need) === stock - 1,
    `${modality} match marks one animal and uses exactly one ${piece.need} unit`);
}

async function habitatVisual(p, cfg) {
  await beginHabitat(p);
  check(await fit(p, HABITAT), cfg.name + ': interactive habitat board fits horizontally');
  await shot(p, cfg.name + '-habitat-setup', true);
  const roster = await habitatHerd(p);
  const first = await requireAvailableAnimal(p);
  await matchHabitat(p, first, cfg.touch ? 'tap' : 'click');
  check(JSON.stringify(await habitatHerd(p)) === JSON.stringify(roster),
    cfg.name + ': matching a need leaves the starting herd intact until resolution');
  await shot(p, cfg.name + '-habitat-matched', true);
  if (cfg.width === 390) await axeAudit(p, cfg.name + ' Habitat');
  await matchRemainingHabitat(p);
  await p.locator('#cc-habitat-finish').click();
  await p.locator('#cc-habitat-result').waitFor({ state: 'visible' });
  check(await fit(p, '#cc-habitat-result'), cfg.name + ': habitat result is visible without horizontal overflow');
  await shot(p, cfg.name + '-habitat-result', true);
  if (cfg.width === 390) {
    await p.locator('#cc-habitat-compare').click();
    await matchRemainingHabitat(p);
    await p.locator('#cc-habitat-finish').click();
    await p.locator('#cc-habitat-comparison').waitFor({ state: 'visible' });
    check(await fit(p, '#cc-habitat-comparison'), cfg.name + ': completed comparison fits horizontally');
    await shot(p, cfg.name + '-habitat-comparison', true);
  }
}

async function followHabitatWorkflow(browser, url) {
  await withPage(browser, { name: 'desktop-habitat-workflow', width: 1366, height: 900 }, async p => {
    await readiness(p, url, 'light');
    await beginHabitat(p);
    const roster = await habitatHerd(p);
    check(roster.length === 8 && await p.locator('#cc-habitat-finish').isDisabled(),
      'eight live cards appear and still-possible matches cannot be skipped');
    const first = await requireAvailableAnimal(p);
    const wrong = SOURCE.find(resource => resource !== first.need);
    const before = Object.fromEntries(await Promise.all(SOURCE.map(async key => [key, await habitatStock(p, key)])));
    await habitatAnimal(p, first.id).click();
    await habitatStation(p, wrong).click();
    check(await habitatMatch(p, first.id).count() === 0 &&
      /cannot meet that need/i.test(await p.locator('#cc-habitat-live').textContent()) &&
      (await Promise.all(SOURCE.map(async key => (await habitatStock(p, key)) === before[key]))).every(Boolean),
    'a wrong station explains the mismatch without using stock or marking an animal');
    const pending = habitatAnimal(p, first.id);
    if (await pending.getAttribute('aria-pressed') === 'true') {
      await p.keyboard.press('Escape');
      if (await pending.getAttribute('aria-pressed') === 'true') await pending.click();
    }
    await matchHabitat(p, first, 'keyboard');
    const second = await requireAvailableAnimal(p);
    await matchHabitat(p, second, 'drag');
    check(JSON.stringify(await habitatHerd(p)) === JSON.stringify(roster),
      'dragging and matching animals never change the starting herd mid-round');

    await p.reload();
    await p.locator(`.cc-nav [data-cc-go="habitat"][aria-current="page"]`).waitFor({ state: 'visible' });
    check(await habitatMatch(p, first.id).isVisible() && await habitatMatch(p, second.id).isVisible() &&
      JSON.stringify(await habitatHerd(p)) === JSON.stringify(roster),
    'reload retains the active habitat phase, both matches, and the starting herd');

    check(await matchRemainingHabitat(p) === 6, 'the balanced trial lets all eight animals find their stated needs');
    await p.locator('#cc-habitat-finish').click();
    const result = p.locator('#cc-habitat-result');
    await result.waitFor({ state: 'visible' });
    check(sameScores(await habitatScores(result), [BALANCED_SCORE]),
      'balanced result holds 8 starters, 8 survivors, no deaths, 4 calves, and a next herd of 12');
    await p.locator('#cc-habitat-compare').click();
    await p.locator(HABITAT + ' ' + ANIMAL).first().waitFor({ state: 'visible' });
    check(JSON.stringify(await habitatHerd(p)) === JSON.stringify(roster) &&
      await habitatStock(p, 'food') === 1 && await habitatStock(p, 'water') === before.water &&
      await habitatStock(p, 'shelter') === before.shelter,
      'comparison restarts with same original animals and needs; only food changes');

    // Deplete the chosen stock through valid matches only; then try another
    // hungry animal without using an app-internal test hook or changing state.
    for (let i = 0; i < roster.length && await habitatStock(p, 'food') > 0; i++) {
      const candidates = (await habitatAnimals(p)).filter(piece => piece.need === 'food' && !piece.disabled);
      let eligible;
      for (const piece of candidates) if (await habitatMatch(p, piece.id).count() === 0) { eligible = piece; break; }
      if (!eligible) break;
      await matchHabitat(p, eligible, 'click');
    }
    check(await habitatStock(p, 'food') === 0, 'food comparison reaches a depleted station');
    const seekers = (await habitatAnimals(p)).filter(piece => piece.need === 'food' && !piece.disabled);
    let blocked;
    for (const piece of seekers) if (await habitatMatch(p, piece.id).count() === 0) { blocked = piece; break; }
    check(!!blocked, 'a food seeker remains after the reduced supply is exhausted');
    await habitatAnimal(p, blocked.id).click();
    const empty = habitatStation(p, 'food');
    await empty.scrollIntoViewIfNeeded();
    const box = await empty.boundingBox();
    assert.ok(box, 'depleted station is still visibly represented');
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    check(await habitatMatch(p, blocked.id).count() === 0 && await habitatStock(p, 'food') === 0 &&
      /no food remains/i.test(await p.locator('#cc-habitat-live').textContent()) &&
      JSON.stringify(await habitatHerd(p)) === JSON.stringify(roster),
    'a depleted station gives no match and cannot remove an animal before resolution');

    check(await matchRemainingHabitat(p) === 5, 'five other needs still match after food is depleted');
    await p.locator('#cc-habitat-finish').click();
    const comparison = p.locator('#cc-habitat-comparison');
    await comparison.waitFor({ state: 'visible' });
    const comparisonOutcome = normalizeReport(await comparison.innerText());
    check(sameScores(await habitatScores(comparison), [BALANCED_SCORE, FOOD_SCORE]) &&
      /balanced habitat/i.test(comparisonOutcome) && /food was a limiting factor/i.test(comparisonOutcome),
      'only food is limiting and the comparison shows both exact modeled outcomes (12 vs 9 next herd)');
    await shot(p, '1366-light-habitat-comparison', true);

    await go(p, 'explain');
    const claim = 'The habitat challenge showed that extra water cannot replace scarce food.';
    await p.locator('#cc-habitat-claim').fill(claim);
    await p.reload();
    await p.locator('.cc-nav [data-cc-go="explain"][aria-current="page"]').waitFor({ state: 'visible' });
    check(await p.locator('#cc-habitat-claim').inputValue() === claim &&
      (await p.locator('#cc-writing-habitat').textContent()).trim().length > 20,
    'reload retains the habitat explanation and its summarized run evidence');
    await go(p, 'habitat');
    check(normalizeReport(await comparison.innerText()) === comparisonOutcome, 'both resolved habitat trials survive reload');
    await go(p, 'explain');
    const downloadPromise = p.waitForEvent('download');
    await p.locator('#cc-download').click();
    const download = await downloadPromise;
    const report = normalizeReport(await fs.readFile(await download.path(), 'utf8'));
    check(/Habitat challenge \(SIMULATED\)/i.test(report) && report.includes(claim) &&
      /Trial A[^\n]+Balanced habitat[^\n]+next herd 12/i.test(report) &&
      /Trial B[^\n]+Less forage[^\n]+next herd 9/i.test(report),
    'real downloaded file contains both habitat outcomes and the written explanation');
    await p.locator('#cc-copy').click();
    check(normalizeReport(await p.locator('#cc-report-text').inputValue()) === report,
      'habitat report text matches the real download');
    await p.keyboard.press('Escape');
    await p.locator('#cc-report').waitFor({ state: 'hidden' });
    await go(p, 'run');
    await p.locator('#cc-reset').click();
    await p.locator('#cc-reset-confirm').click();
    await go(p, 'habitat');
    check(await p.locator('#cc-habitat-start').isVisible() && await comparison.isHidden(),
      'confirmed investigation reset clears prior habitat trials');
  });
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
      check(await fit(p, '#cc-field-chart svg[role="img"]'), cfg.name + ': published evidence plot stays on screen horizontally');
      await p.locator('#cc-field-chart').scrollIntoViewIfNeeded();
      await shot(p, cfg.name + '-evidence', true);
      if (cfg.width === 390 || cfg.width === 1366) await axeAudit(p, cfg.name + ' evidence');
      await habitatVisual(p, cfg);
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
    check(await fit(p, '#cc-chart svg[role="img"]'), 'simulated run chart is available as well as its table');

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
    check(await fit(p, '#cc-field-chart svg[role="img"]') && await p.locator('#cc-field-data').isVisible(),
      'published evidence has a distinct chart and data presentation');
    await p.locator('input[name="cc-check-field"][value="yes"]').check();
    await p.locator('#cc-check-field-answer').click();
    check(/counts alone/.test(await p.locator('#cc-field-feedback').textContent()),
      'a claim that the graph proves its cause gets corrective feedback');
    await p.locator('input[name="cc-check-field"][value="no"]').check();
    await p.locator('#cc-check-field-answer').click();
    check(/separate evidence/.test(await p.locator('#cc-field-feedback').textContent()),
      'the evidence check explains why the graph alone does not establish a cause');
    await p.locator('.cc-rate summary').click();
    await p.locator('#cc-rate-reveal').click();
    check(/73,540 wildebeest per year/.test(await p.locator('#cc-rate-answer').textContent()),
      'the 1961–1977 interval uses elapsed years and published endpoints');
    await p.locator('#cc-interval').selectOption('1');
    check(await p.locator('#cc-rate-answer').isHidden(),
      'selecting a new time interval hides the previous calculation');
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
    await followHabitatWorkflow(browser, url);
    console.log(`carrying-capacity-browser: ${checks} checks passed`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
