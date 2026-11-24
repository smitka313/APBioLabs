'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Save = require('../openscied-save-session.js');
const Submission = require('../openscied-submission-report.js');
const Burn = require('../openscied-b2-burn-logic.js');
const Fires = require('../openscied-b2-fires-logic.js');
const Peat = require('../openscied-b2-peat-bog-logic.js');
const Carbon = require('../openscied-b2-carbon-journey-logic.js');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const prefix = 'openscied-b2-';
const opening = { name: 'Earlier Test Student', period: '2' };
const nextStudent = { name: 'Next Test Student', period: '7' };
const response = 'A student’s written evidence.';
function fixture(page, env = {}, raw = null) {
  const key = 'aplab:openscied:b2-' + (page === 'peat-bog-lab' ? 'peat-bog' : page) + ':v1';
  const budgetKey = 'aplab:openscied:b2-carbon-journey:budget:v1';
  const keys = page === 'carbon-journey' ? [key, budgetKey] : [key];
  const records = new Map(raw === null ? [] : [[key, raw]]);
  const storage = { getItem: k => records.get(k) ?? null, setItem: (k, v) => records.set(k, v), removeItem: k => records.delete(k) };
  const saveSession = Save.open(storage, 'b2-' + page, keys);
  let currentIdentity = opening;
  const source = read(prefix + page + '.js');
  const start = source.indexOf('  function classroomResponses()') >= 0 ?
    source.indexOf('  function classroomResponses()') : source.indexOf('  function classroomReport()');
  const end = page === 'carbon-journey' ? source.indexOf("  $('#download').addEventListener", start) : source.indexOf('  function download()', start);
  assert.ok(start >= 0 && end > start, 'real controller has a classroom adapter');
  const box = { KEY: key, key, budgetKey, saveSession, reportIdentity: Save.reportIdentity(saveSession, keys, () => currentIdentity),
    preservedSave: false, unreadable: null, lastSaveError: '', document: { getElementById() { return null; } },
    $: () => ({ value: '' }), guess: null, revealed: false, budgetUI: null, window: {}, ...env };
  const get = vm.runInNewContext(source.slice(start, end) + '\nclassroomReport', box);
  return { box, saveSession, report: () => {
    const report = get();
    assert.equal(Submission.normalize(report).status, report.status, 'shared renderer accepts the live activity snapshot');
    return JSON.parse(JSON.stringify(report));
  },
    handOff() { Save.erase(storage, null, keys); currentIdentity = nextStudent; },
    stored: k => storage.getItem(k ?? key) };
}
const choiceData = {
  picks: () => [{ question: 'Which choice?', answer: 'My first choice', result: 'incorrect' }],
  dropdowns: () => [],
  chips: () => [{ question: 'Evidence I consulted', chosen: ['A reading'],
    notSupportedByRecordedData: ['An unsupported inference I selected'] }],
  textAnswers: () => [{ prompt: 'My explanation', answer: response }],
  answerStats: () => ({ answered: 31, total: 31 })
};
const item = (report, title) => report.sections.flatMap(s => s.items).find(i => i.title === title);
const named = (report, text) => report.sections.some(s => s.title.includes(text));

for (const page of ['burn-lab', 'fires', 'peat-bog-lab', 'carbon-journey']) {
  test(page + ' has one accessible fallback, a final-section report slot and no extra report opener', () => {
    const html = read(prefix + page + '.html'), js = read(prefix + page + '.js');
    assert.equal((html.match(/id="classroom-submission"/g) || []).length, 1);
    assert.match(html, /href="openscied-submission-report.css"/);
    assert.ok(html.indexOf('src="openscied-submission-report.js"') >= 0 &&
      html.indexOf('src="openscied-submission-report.js"') < html.indexOf('src="' + prefix + page + '.js'));
    assert.match(html, page === 'carbon-journey' ? /id="download"/ : /id="download-work"/);
    assert.match(html, page === 'carbon-journey' ? /id="print"/ : /id="print-work"/);
    assert.ok(js.includes("OpenSciEdSubmission?.mount({ target: '#classroom-submission', collect: classroomReport })"));
    const reportAt = html.indexOf('id="classroom-submission"');
    assert.ok(reportAt > html.lastIndexOf('</section>') && reportAt < html.indexOf('</main>'));
    const fallback = html.match(/<div[^>]+id="classroom-submission"[^>]*>/)[0];
    assert.ok(!fallback.includes('aria-label'), 'a generic container must not have a prohibited accessible name');
    // A second mount point lets the same launcher follow the student into the optional Budget.
    assert.equal((html.match(/data-ose-report-final/g) || []).length, page === 'carbon-journey' ? 2 : 1);
    if (page === 'carbon-journey') {
      const budget = html.slice(html.indexOf('id="budget"')).split('</section>')[0];
      assert.match(budget, /id="carbon-budget-host"[\s\S]*data-ose-report-final/);
    }
    const finalSection = page === 'carbon-journey' ? 'sense' : page === 'peat-bog-lab' ? 'trials' : 'wrapup';
    const sectionAt = html.indexOf('id="' + finalSection + '"');
    const slotAt = html.indexOf('data-ose-report-final');
    assert.ok(sectionAt >= 0 && sectionAt < slotAt && slotAt < html.indexOf('</section>', sectionAt));
    assert.ok(!html.includes('data-classroom-submission-link'), 'retired report shortcut does not reappear');
    const details = html.slice(html.indexOf('id="legacy-report-tools"')).split('</details>')[0];
    assert.ok(details.includes('<summary>Other downloads and backups</summary>'));
    assert.ok(!details.split('>')[0].split(' ').includes('open'), 'legacy formats start collapsed');
    assert.ok(details.includes(page === 'carbon-journey' ? 'id="download"' : 'id="download-work"'));
    assert.ok(details.includes(page === 'carbon-journey' ? 'id="print"' : 'id="print-work"'));
    if (page === 'peat-bog-lab') assert.ok(details.includes('id="download-csv"') && details.includes('id="copy"'));
  });
}

test('Burns: actual unique recorded fuels distinguish draft from final; written and draft evidence survive without grades', () => {
  const state = { burn: { seed: 72, records: [{ fuel: Burn.FUEL_IDS[0], n: 1, obs: ['smoke'] },
    { fuel: Burn.FUEL_IDS[0], n: 2, obs: [] }], current: { fuel: Burn.FUEL_IDS[1], n: 1, startedAt: 0, skipped: true } } };
  const f = fixture('burn-lab', { L: Burn, state, ...choiceData, labelFor: x => x });
  let report = f.report();
  assert.equal(report.status, 'draft');
  assert.equal(item(report, 'Timing and mass').rows.length, 2);
  assert.match(JSON.stringify(report), /Smoke.*A reading.*An unsupported inference I selected.*A student/);
  assert.doesNotMatch(JSON.stringify(report), /incorrect|correct so far/);
  for (const fuel of Burn.FUEL_IDS.slice(1)) state.burn.records.push({ fuel, n: 1, obs: [] });
  f.box.answerStats = () => ({ answered: 30, total: 31 });
  assert.equal(f.report().status, 'draft');
  f.box.answerStats = choiceData.answerStats;
  assert.equal(f.report().status, 'final');
  f.handOff();
  report = f.report();
  assert.equal(report.status, 'recovery');
  assert.deepEqual(report.student, opening);
  assert.equal(f.stored(), null);
});
test('Burns: unreadable save is never embedded in the classroom file', () => {
  const raw = '{private unreadable token';
  const f = fixture('burn-lab', { L: Burn, state: {}, ...choiceData, labelFor: x => x }, raw);
  assert.equal(f.report().status, 'recovery');
  assert.equal(f.stored(), raw);
  assert.doesNotMatch(JSON.stringify(f.report()), /private unreadable token/);
});

test('Fires: configuration and baseline are not full evidence; recorded model results and student placements count without a correctness gate', () => {
  const state = { decomp: { seed: 8, temps: [18,27,43], recorded: [0] },
    tilt: { seed: 6, settings: ['direct','tilt45','foil'], recorded: false }, cards: { placed: {} } };
  const f = fixture('fires', { L: Fires, state, ...choiceData, labelFor: x => x });
  let report = f.report();
  assert.equal(report.status, 'draft');
  assert.match(report.missing.join(' '), /after 0 minutes.*three BTB/);
  assert.ok(!named(report, 'Light angle'));
  state.cards.placed = Object.fromEntries(Fires.CARDS.map(c => [c.id, c.zone === 'in' ? 'out' : 'in']));
  state.decomp.recorded.push(20);
  state.tilt.recorded = true;
  report = f.report();
  assert.equal(report.status, 'final');
  assert.equal(item(report, 'Recorded foam height (mm)').rows.length, 2);
  assert.ok(named(report, 'Light angle'));
  assert.doesNotMatch(JSON.stringify(report), /incorrect|correct so far|Starch index/);
  state.tilt.starchDone = true;
  assert.match(JSON.stringify(f.report()), /Starch index/);
  f.handOff();
  assert.deepEqual(f.report().student, opening);
  assert.equal(f.report().status, 'recovery');
});

test('Peat: sliders alone or duplicate trials cannot report full comparison; actual recorded inputs and outputs do', () => {
  const trials = [];
  const state = { warmingUsed: false };
  const f = fixture('peat-bog-lab', { L: Peat, state, payload: () => ({
    student: f.box.reportIdentity(f.box.preservedSave), trials,
    climate: { fossil: 10, forest: 100, year: 2070 }
  }) });
  let report = f.report();
  assert.equal(report.status, 'draft');
  assert.equal(report.sections.length, 0);
  const testTrial = (trial, water) => {
    const inputs = { ...Peat.DEFAULTS, wet: water };
    return { trial, label: 'Water comparison ' + trial, inputs, outputs: Peat.trialOutputs(inputs) };
  };
  trials.push(testTrial(1, 75), testTrial(2, 75));
  assert.equal(f.report().status, 'draft');
  trials[1] = testTrial(2, 15);
  state.warmingUsed = true;
  report = f.report();
  assert.equal(report.status, 'final');
  assert.equal(item(report, 'Trial setup continued').rows[1][2], 15);
  assert.equal(item(report, 'Modeled outcomes').rows[1][1], trials[1].outputs.N);
  assert.ok(named(report, 'Current climate scenario'));
  assert.equal(report.datasetId, undefined);
  f.handOff();
  assert.deepEqual(f.report().student, opening);
  assert.equal(f.report().status, 'recovery');
});

test('Carbon: recorded rolls and reference cards are separate, plus optional same-session Budget and responses', () => {
  let state = Carbon.initial(4177023592);
  for (let i = 0; i < 10; i++) {
    state.pending = Carbon.die(state.seed, i);
    state = Carbon.record(state, { note: i === 0 ? 'My first note' : '', prediction: 'producers' });
  }
  state.coverageReviewed = Carbon.missingCoverage(state).map(card => card.from);
  const questions = ['q1','q2','q3','q4','q5'].map((id, i) => [id, 'Prompt ' + (i + 1)]);
  const budget = { prediction: 'My extension prediction', explanation: 'My extension explanation', checkpoints: [{
    title: 'After the fire',
    baseline: { carbon:{air:9,ocean:3,plants:4,peat:5}, energy:{sunlight:4,plants:3,peat:2,heat:3} },
    fire: { carbon:{air:11,ocean:3,plants:4,peat:3}, energy:{sunlight:4,plants:3,peat:1,heat:4} }
  }] };
  const f = fixture('carbon-journey', { L: Carbon, state, questions, name: id => Carbon.stations.find(s => s[0] === id)[1] });
  f.box.window.CarbonBudgetUI = { readExport(session) { assert.equal(session, f.saveSession); return null; } };
  assert.equal(f.report().status, 'draft');
  state.done = true;
  questions.forEach(([id]) => { state.answers[id] = response; });
  assert.equal(f.report().status, 'final', 'Budget is not mandatory');
  assert.ok(!named(f.report(), 'Optional Carbon'));
  f.box.window.CarbonBudgetUI.readExport = session => { assert.equal(session, f.saveSession); return budget; };
  let report = f.report();
  assert.ok(named(report, 'Reference cards you reviewed · not extra rolls'));
  assert.equal(item(report, 'Recorded rolls').rows.length, 10);
  assert.equal(item(report, 'Starting stations').rows.reduce((sum, r) => sum + r[1], 0), 10);
  assert.equal(item(report, 'Carbon checkpoints (model units)').rows.length, 2);
  assert.equal(item(report, 'Energy checkpoints (model units)').rows[1][5], 4);
  assert.match(JSON.stringify(report), /My first note.*My extension prediction.*My extension explanation/);
  f.box.budgetUI = { exportData: () => ({ ...budget, unreadableBackup: '{secret raw save' }) };
  assert.equal(f.report().status, 'recovery');
  assert.doesNotMatch(JSON.stringify(f.report()), /secret raw save/);
  f.box.budgetUI = null;
  f.handOff();
  report = f.report();
  assert.deepEqual(report.student, opening);
  assert.equal(report.status, 'recovery');
});
