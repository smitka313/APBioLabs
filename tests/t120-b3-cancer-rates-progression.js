/* Real classroom flow and legacy-bypass saves for openscied-b3-cancer-rates. */

const fs = require('node:fs/promises');
const path = require('node:path');
const { ok, done, launch, ctxFor, serve } = require('./_h');
const FILE = 'openscied-b3-cancer-rates.html';
const KEY = 'aplab:openscied:b3-cancer-rates:v1';
const full = 'Do states with higher poverty also tend to have higher diagnosis rates?';
const notes = { diagnoses: 'One cancer leads the diagnoses chart.', deaths: 'The rankings do not use the same leader.', map: 'Some states have higher rates than others.' };
const claim = 'New Mexico had 17.8% poverty and 378.6 diagnoses per 100,000. Kentucky had 16.4% poverty and 524.7 diagnoses per 100,000.';
const limits = 'The pattern cannot tell us what caused a difference.';
const state = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
const $ = (p, id) => p.locator('#cr-' + id);
const step = (p, id) => p.locator('[data-step="' + id + '"]');
const marked = async (p, id) => await step(p, id).getAttribute('data-ose-complete') === 'true';
const note = async (p, id) => (await $(p, id).textContent()).trim();

async function shot(page, tag) {
  if (!process.env.CANCER_RATES_SCREENSHOTS) return;
  const dir = process.env.CANCER_RATES_SCREENSHOTS;
  await fs.mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, tag + '.png'), fullPage: true, animations: 'disabled' });
}
async function fit(page, label) {
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ' has no horizontal overflow');
}
async function setup(browser, { width = 1366, dark = false, touch = false } = {}) {
  const ctx = await ctxFor(browser, { width, dark, touch, reduced: true, height: 900 });
  await ctx.route('https://gc.zgo.at/**', route => route.abort());
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(7500);
  return { ctx, page, errors };
}
async function verifyDeepLinks(browser, url) {
  const { ctx, page, errors } = await setup(browser);
  try {
    for (const hash of ['cr-income-cards', 'cr-lesson1-diagnoses', 'explore', 'explain']) {
      await page.goto(url + FILE + '?' + hash + '#' + hash);
      ok(await page.locator('#predict').isVisible() && await $(page, 'income-cards').isHidden() &&
        await $(page, 'case-dialog').isHidden() && await step(page, 'explore').isDisabled(),
        'Without a saved prediction, direct #' + hash + ' cannot reveal evidence or jump ahead');
    }
    ok(!errors.length, 'No browser errors on locked deep links: ' + errors.join('; '));
  } finally { await ctx.close(); }
}
async function runStudent(browser, url) {
  const { ctx, page, errors } = await setup(browser, { width: 390, dark: true, touch: true });
  try {
    await page.goto(url + FILE);
    const tap = id => $(page, id).tap();
    const shared = await page.evaluate(() => window.Lab.identity.get());
    ok(shared?.name && await $(page, 'name').inputValue() === shared.name &&
      await $(page, 'period').inputValue() === shared.period, 'Report fields use the shared sign-in when there is no override');
    ok(await page.evaluate(() => document.querySelector('#predict').compareDocumentPosition(document.querySelector('#cr-income-cards')) &
      Node.DOCUMENT_POSITION_FOLLOWING), 'Predict comes before the Evidence Folder in reading order');
    ok(await $(page, 'lock').isDisabled() && await $(page, 'income-cards').isHidden(), 'Evidence is hidden until a student saves a prediction');
    ok(await page.getByText(/20 diagnoses among 200,000 people in one year is 10 diagnoses per 100,000 people/).isVisible(), 'Predict defines a rate through a worked example');
    ok(/prediction first/i.test(await step(page, 'explore').getAttribute('aria-description')), 'Locked Explore gives a readable prerequisite');
    await fit(page, '390 dark Predict'); await shot(page, '390-dark-predict');

    ok(await $(page, 'prediction-unlock').isVisible(), 'Save prediction has its own visible unlock hint');
    await $(page, 'next-required').press('Enter');
    ok(await page.evaluate(() => document.activeElement?.id === 'cr-prediction'), 'The next-action shortcut focuses the prediction without advancing');
    await $(page, 'prediction').selectOption('different');
    await page.reload();
    ok(await $(page, 'prediction').inputValue() === 'different' && await $(page, 'income-cards').isHidden() &&
       !await marked(page, 'predict'), 'A saved choice draft does not count as a locked prediction');
    await tap('lock');
    ok(await marked(page, 'predict') && await $(page, 'income-cards').evaluate(el => el.open) &&
       await step(page, 'explore').isDisabled() && /six exhibits/.test(await note(page, 'step-hint')),
       'Saving the prediction opens the folder but the six exhibits and question still gate Explore');
    await $(page, 'next-required').press('Enter');
    ok(await page.evaluate(() => document.activeElement?.id === 'cr-lesson1-diagnoses-tab'), 'The next-action shortcut focuses the first unfinished exhibit');
    for (const [id, text] of Object.entries(notes)) {
      await tap('lesson1-' + id + '-tab');
      if (id !== 'map') {
        const exhibit = $(page, 'lesson1-' + id);
        await exhibit.waitFor({ state: 'visible' });
        ok(await exhibit.getByText(/NOS means .*not otherwise specified/i).isVisible() &&
          await exhibit.getByText('Corpus and Uterus, NOS', { exact: true }).isVisible(),
        'Exhibit ' + id + ' defines NOS without changing the published label');
      }
      await $(page, 'lesson1-' + id + '-observation').fill(text);
      await tap('lesson1-' + id + '-save');
      await tap('case-close');
    }
    for (const [id, answer] of Object.entries({ access: 'falling', diagnosis: 'rising', 'test-cost': 'longer' })) {
      await tap('income-' + id + '-tab');
      if (id === 'access') ok(await $(page, 'income-access').getByText(/shows four groups, up to \$74,999/).isVisible() &&
        await $(page, 'income-access').getByRole('link', { name: 'CDC Table 2' }).isVisible(),
        'Exhibit D distinguishes its four displayed groups from the full CDC table');
      await $(page, 'income-' + id + '-answer').selectOption(answer);
      await tap('income-' + id + '-check');
      ok(await $(page, 'income-' + id + '-feedback').getAttribute('data-result') === 'correct', 'Exhibit ' + id + ' accepts its evidence-based answer');
      await tap('case-close');
    }
    ok(await $(page, 'income-explore').isDisabled() && await step(page, 'explore').isDisabled(), 'Even after six exhibits, Explore requires a saved question');
    await $(page, 'next-required').press('Enter');
    ok(await page.evaluate(() => document.activeElement?.id === 'cr-income-question'), 'The shortcut moves to the question after all six exhibits');
    ok(await $(page, 'question-unlock').isVisible(), 'The disabled Explore button explains how to unlock it');
    await $(page, 'income-question').fill(full);
    await tap('income-explore');
    ok(await page.locator('#explore').isVisible() && (await note(page, 'question-explore-text')) === full, 'Explore opens with the student question visible');
    ok(await $(page, 'view').inputValue() === 'poverty' && await $(page, 'socio').inputValue() === 'poverty',
      'Poverty question starts on the related dataset, with the other views still available');
    ok(await page.locator('#cr-table tbody tr').count() === 6, 'Phone table starts with six rows and can show more');
    ok(await step(page, 'explain').isDisabled() && !await marked(page, 'explore') && /pin one comparison/i.test(await note(page, 'step-hint')),
      'Explain requires a pinned comparison, and the next action is explicit');
    ok(await $(page, 'explain-unlock').isVisible(), 'The local Explain button names the pin prerequisite');
    await fit(page, '390 dark Explore'); await shot(page, '390-dark-explore');
    await $(page, 'view').selectOption('michigan');
    await $(page, 'measure').selectOption('late-rate');
    await $(page, 'compare-a').selectOption('26001'); // Alcona County's rate is unavailable.
    await $(page, 'compare-b').selectOption('26005'); // Allegan County's rate is reported.
    ok(await $(page, 'pin').isDisabled() && /two reported values/.test(await note(page, 'pin')),
      'A comparison with one missing value cannot be pinned as evidence');
    await $(page, 'view').selectOption('poverty');
    await $(page, 'search').fill('Kentucky');
    await tap('pin');
    ok(await marked(page, 'explore') && !await step(page, 'explain').isDisabled(), 'Pinning a comparison completes Explore and opens Explain');
    ok(await $(page, 'explain-unlock').isHidden(), 'The pin prerequisite clears as soon as Explain unlocks');
    await tap('to-explain');
    ok(/Not shown in this scatterplot: New Mexico/.test(await note(page, 'evidence-list')),
      'The pin names the selected state that was outside the filtered scatterplot');
    ok((await note(page, 'evidence-list')).includes('524.7') && (await note(page, 'evidence-list')).includes('378.6') && (await note(page, 'question-explain-text')) === full, 'Explain keeps the actual chart evidence and question beside the responses');
    ok(await $(page, 'limits').getAttribute('aria-describedby') === 'cr-limits-help' && /Correlation means.*does not prove/.test(await note(page, 'limits-help')), 'The limits prompt explicitly distinguishes correlation and causation');
    await $(page, 'claim').fill(claim);
    ok(await $(page, 'finish').isDisabled() && /Add a limit/.test(await note(page, 'finish-hint')), 'A claim alone is not enough to finish');
    await $(page, 'limits').fill(limits);
    ok(await $(page, 'finish').isDisabled() && !await marked(page, 'explain') &&
      await $(page, 'done').isHidden() && !(await state(page)).completed, 'Writing both responses still requires checking the evidence before Finish');
    await page.reload();
    ok(await $(page, 'claim').inputValue() === claim && !await marked(page, 'explain'), 'An unfinished response reloads without silently completing');
    await downloadStatus(page, 'In progress');
    await $(page, 'evidence-confirm').check();
    await tap('finish');
    ok(await marked(page, 'explain') && await $(page, 'done').isVisible() && (await state(page)).completed, 'Only Finish marks the investigation complete');
    const preview = page.locator('[data-ose-report-final]').getByRole('button', { name: 'Preview report' });
    await preview.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('[data-ose-report-final] .osr-actions button') === document.activeElement);
    ok(await preview.isVisible(), 'Finish focuses the visible report preview beside the completed investigation');
    await downloadStatus(page, 'Complete');
    await page.reload();
    ok(await marked(page, 'explain') && await $(page, 'done').isVisible(), 'Finished status persists after reload');
    await fit(page, '390 dark completed Explain'); await shot(page, '390-dark-explain');
    await step(page, 'explore').tap();
    await tap('revise-question');
    const revised = 'How do cancer diagnosis rates compare between Kentucky and New Mexico?';
    await $(page, 'income-question').fill(revised);
    await page.reload();
    await tap('revise-question');
    ok(await $(page, 'income-question').inputValue() === revised && (await state(page)).casework.question === full,
      'Reload preserves the pending revision separately from the question used to investigate');
    await step(page, 'explain').tap();
    ok(await $(page, 'done').isHidden() && await $(page, 'finish').isDisabled() &&
      /Save your revised question/.test(await note(page, 'finish-hint')), 'A pending revision is not marked complete');
    await preview.tap();
    const reportDialog = page.locator('dialog.osr-dialog');
    const previewText = await reportDialog.innerText();
    ok(previewText.includes(full) && previewText.includes(revised) && /Question draft · not submitted/i.test(previewText) &&
      /In progress/i.test(previewText), 'Preview includes the saved question and clearly separates the revised draft');
    await reportDialog.getByRole('button', { name: 'Close report' }).tap();
    const draftReport = await downloadStatus(page, 'In progress');
    ok(draftReport.includes('QUESTION DRAFT (NOT SUBMITTED)') && draftReport.includes(revised),
      'The text backup also preserves both question versions');
    await step(page, 'explore').tap();
    await tap('revise-question');
    await tap('restore-question');
    await step(page, 'explain').tap();
    ok(await $(page, 'done').isVisible(), 'Keeping the original question restores the investigation that was already completed');
    await $(page, 'limits').fill(limits + ' Other evidence is needed.');
    ok(!await marked(page, 'explain') && await $(page, 'done').isHidden() && !(await state(page)).completed, 'Editing evidence-based writing clears the stale completion');
    await $(page, 'evidence-confirm').check();
    await tap('finish');
    await page.getByRole('button', { name: 'Remove pin 1' }).tap();
    ok(!await marked(page, 'explore') && !await marked(page, 'explain') && await step(page, 'explain').isDisabled(), 'Removing the only pin clears downstream completion and reopens Explore');
    await tap('reset');
    await tap('reset-confirm');
    ok(await $(page, 'income-cards').isHidden() && !await marked(page, 'predict') &&
      await page.evaluate(key => localStorage.getItem(key), KEY) === null, 'Reset clears the complete record and restores the Predict gate');
    ok(!errors.length, 'No browser errors through mobile investigation: ' + errors.join('; '));
  } finally { await ctx.close(); }
}
async function downloadStatus(page, expected) {
  const backups = page.locator('details.ose-report-other');
  if (!await backups.evaluate(node => node.open)) {
    ok(await $(page, 'download').isHidden(), 'Text backup is hidden until the backup menu is opened');
    await backups.locator('summary').tap();
  }
  const [download] = await Promise.all([page.waitForEvent('download'), $(page, 'download').tap()]);
  const report = await fs.readFile(await download.path(), 'utf8');
  ok(download.suggestedFilename() === 'cancer-rates-investigation.txt' && report.includes('Status: ' + expected + '\n') &&
    report.includes(full) && report.includes(claim) && report.includes(limits), 'Download includes Status: ' + expected + ' and the actual written work');
  const shared=await page.evaluate(()=>window.Lab.identity.get());
  ok(report.includes('Name: '+shared.name+'\n') && report.includes('Class period: '+shared.period+'\n'),
    'Report includes the active shared name and period without a local override');
  return report;
}
async function verifyLegacy(browser, url) {
  const { ctx, page, errors } = await setup(browser);
  try {
    await page.goto(url + FILE);
    await page.evaluate(({ key, question, notes, claim, limits }) => localStorage.setItem(key, JSON.stringify({
      step: 'explain',
      prediction: { choice: 'same', reason: 'Still considering it.', locked: false },
      casework: { notes, access: 'falling', diagnosis: 'rising', 'test-cost': 'longer', question, opened: true },
      evidence: [{ view: 'types', measure: 'incidence', a: 'breast', b: 'lung' }], claim, limits, completed: true
    })), { key: KEY, question: full, notes, claim, limits });
    await page.goto(url + FILE + '?legacy#explain');
    ok(await page.locator('#predict').isVisible() && await step(page, 'explain').isDisabled() &&
      !await marked(page, 'explain'), 'An older unlocked save cannot bypass Predict or advertise completion yet');
    await $(page, 'lock').click();
    ok(await step(page, 'explain').isEnabled() && await marked(page, 'explain'), 'A real past Finish and all prior work survive the extra Predict gate');
    await step(page, 'explain').click();
    ok(await $(page, 'claim').inputValue() === claim && await $(page, 'limits').inputValue() === limits &&
      (await note(page, 'question-explain-text')) === full, 'Legacy question, pins, and answers remain intact');
    const dialogHash = url + FILE + '?legacy-exhibit#cr-lesson1-diagnoses';
    await page.goto(dialogHash);
    ok(await $(page, 'case-dialog').isVisible() && await $(page, 'lesson1-diagnoses-observation').inputValue() === notes.diagnoses,
      'Direct exhibit links remain available after prediction is locked');
    await page.keyboard.press('Escape');
    await page.goto(url + FILE + '?return#explain');
    for (const width of [768, 1366, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await fit(page, width + ' light completed Explain');
      await shot(page, width + '-light-explain');
    }
    await page.evaluate(({key})=>{
      const data=JSON.parse(localStorage.getItem(key));
      data.evidence=[{view:'michigan',measure:'late-rate',a:'26001',b:'26005'}];
      data.completed=true;
      localStorage.setItem(key,JSON.stringify(data));
    },{key:KEY});
    await page.reload();
    ok(await $(page, 'finish').isDisabled() && await $(page, 'done').isHidden() &&
      /Reference only/.test(await note(page, 'evidence-list')), 'An older pin with a missing rate survives as reference, not completion evidence');
    ok(!errors.length, 'No browser errors in legacy save: ' + errors.join('; '));
  } finally { await ctx.close(); }
}
(async () => {
  const server = await serve();
  let browser;
  try {
    browser = await launch();
    await verifyDeepLinks(browser, server.url);
    await runStudent(browser, server.url);
    await verifyLegacy(browser, server.url);
  } catch (e) { ok(false, e.stack || String(e)); }
  finally {
    if (browser) await browser.close();
    server.close();
    done('t120-b3-cancer-rates-progression');
  }
})();
