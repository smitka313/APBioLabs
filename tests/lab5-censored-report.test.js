/* Deterministic report-model checks; actual DOCX/PDF and live UI remain separate acceptance checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'lab05.html'), 'utf8');
const shared = fs.readFileSync(path.join(root, 'lab.js'), 'utf8');

function reportFor(rows, { stale = false } = {}) {
  const section = { id: 'design', dataset: { step: 'Design' } };
  const context = {
    draw: { getRows: () => rows },
    Lab: { keyResults: () => [] },
    PAGE: { id: 'lab05' }, REG: { quizzes: [], charts: [] },
    IS_LAB: true, staleEditor: () => stale, staleEditorMessage: 'Reload after the shared device was cleared.',
    reportIdentity: () => ({ name: 'Audit', period: 'Test', datasetId: 'AUDIT' }),
    document: { title: 'Lab 5: Photosynthesis' }, cleanTitle: x => x, labTag: () => 'Lab5',
    $: () => null,
    $$: selector => selector === 'section.step' ? [section] : []
  };
  vm.createContext(context);
  const start = page.indexOf('  Lab.lab05ReportNotes = () => {');
  const end = page.indexOf('\n  /* The design run is saved', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(page.slice(start, end), context);
  const collect = shared.indexOf('  function collectReport(');
  const collectEnd = shared.indexOf('  /* Chart SVG', collect);
  assert.ok(collect >= 0 && collectEnd > collect);
  vm.runInContext(shared.slice(collect, collectEnd), context);
  return () => JSON.parse(vm.runInContext('JSON.stringify(collectReport())', context));
}
const cup = (lvl, rate) => ({ lvl, rate });
const answers = report => report.sections.flatMap(s => s.items).map(i => i.a);

test('fully censored level reaches the shared report model as a bound, not zero', () => {
  const report = reportFor([cup('45 cm', null), cup('45 cm', null)])();
  const notes = answers(report);
  assert.equal(notes.length, 1);
  assert.match(notes[0], /Not plotted: 45 cm/);
  assert.match(notes[0], /1\/ET50 <0\.0222/);
  assert.match(notes[0], /not measured zeros/);
  assert.doesNotMatch(notes[0], /Partially censored/);
});

test('partial censoring keeps the measured level and explains the excluded cup', () => {
  const notes = answers(reportFor([cup('30 cm', 0.05), cup('30 cm', null)])());
  assert.equal(notes.length, 1);
  assert.match(notes[0], /Partially censored: 30 cm/);
  assert.match(notes[0], /mean uses only measured rates/);
  assert.doesNotMatch(notes[0], /Not plotted/);
});

test('uncensored results do not gain a censored report annotation', () => {
  assert.deepEqual(answers(reportFor([cup('10 cm', 0.12), cup('10 cm', 0.1)])()), []);
});

test('mixed levels classify fully and partly censored groups separately', () => {
  const notes = answers(reportFor([
    cup('10 cm', 0.12), cup('30 cm', 0.05), cup('30 cm', null), cup('45 cm', null)
  ])());
  assert.equal(notes.length, 2);
  assert.match(notes[0], /^Not plotted: 45 cm\./);
  assert.match(notes[1], /^Partially censored: 30 cm\./);
  assert.ok(notes.every(n => !n.includes('10 cm')));
});

test('report annotations follow current recorded rows and survive reconstruction', () => {
  const rows = [cup('45 cm', null)];
  const collect = reportFor(rows);
  assert.deepEqual(collect(), reportFor(JSON.parse(JSON.stringify(rows)))());
  rows.splice(0, 1, cup('10 cm', 0.1));
  assert.deepEqual(answers(collect()), []);
  assert.deepEqual(answers(reportFor([])()), []);
});

test('AP report collection rejects a stale editor before opening a new student’s evidence', () => {
  assert.throws(reportFor([cup('45 cm', null)], { stale: true }), /Reload after the shared device was cleared/);
});
