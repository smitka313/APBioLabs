'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Report = require('../openscied-submission-report.js');
const NOW = new Date('2026-01-03T12:20:00Z');
const fixture = () => ({
  title: 'Ecosystem Report', unit: 'Unit 1', source: 'Simulated trial; separate observations from field data',
  status: 'final', datasetId: 'AB-08', student: { name: 'Example Student', period: '4' },
  keyResults: [{ label: 'Loss', value: 0, unit: 'tokens', note: 'Zero losses observed.' }],
  sections: [{ title: 'Trial evidence', items: [
    { type: 'answer', prompt: 'What did you observe?', value: 'First line\nSecond <tag> & line' },
    { type: 'table', title: 'Counts', columns: ['Winter', 'Rain?'], rows: [[0, false], [21, true], [null, '']] },
  ] }],
});

test('report normalization snapshots typed activity evidence and preserves zero, false and multiline answers', () => {
  const input = fixture(), actual = Report.normalize(input, NOW);
  input.sections[0].items[0].value = 'changed after capture';
  input.student.name = 'Different Student';
  assert.equal(actual.status, 'final');
  assert.equal(actual.student.name, 'Example Student');
  assert.equal(actual.exportedAt, NOW.toISOString());
  assert.equal(actual.keyResults[0].value, '0');
  assert.equal(actual.sections[0].items[0].value, 'First line\nSecond <tag> & line');
  assert.deepEqual(actual.sections[0].items[1].rows, [['0', 'false'], ['21', 'true'], ['', '']]);
});
test('disagreeing missing list, no evidence and unrecognized status never show completed', () => {
  const withMissing = Report.normalize({ ...fixture(), missing: ['Write a claim', ' Write a claim ', 'Finish two trials'] }, NOW);
  assert.equal(withMissing.status, 'draft');
  assert.deepEqual(withMissing.missing, ['Write a claim', 'Finish two trials']);
  assert.equal(Report.normalize({ ...fixture(), sections: [], keyResults: [] }, NOW).status, 'draft');
  assert.equal(Report.normalize({ ...fixture(), status: 'constructor' }, NOW).status, 'draft');
});
test('anonymous has no generated name, identity or Dataset ID and recovery never becomes final', () => {
  const r = Report.normalize({ ...fixture(), status: 'recovery', student: null, datasetId: '' }, NOW);
  assert.deepEqual(r.student, { name: '', period: '' });
  assert.equal(r.datasetId, '');
  assert.equal(r.status, 'recovery');
  assert.equal(r.allowIdentityEdit, false);
  assert.equal(Report.normalize({ ...fixture(), allowIdentityEdit: false, student: null }, NOW).allowIdentityEdit, false);
  assert.equal(Report.normalize({ ...fixture(), status: 'draft', student: null }, NOW).allowIdentityEdit, true);
  assert.equal(r.sections[0].items[1].rows[0][0], '0');
});
test('invalid evidence shapes fail rather than silently omitting data from the report', () => {
  const bad = fixture();
  bad.sections[0].items[1].rows.push(['misaligned']);
  assert.throws(() => Report.normalize(bad, NOW), /table row/);
  assert.throws(() => Report.normalize({ ...fixture(), keyResults: [{ label: 'Student note', value: { text: 'do not lose' } }] }, NOW), /Report values/);
  assert.throws(() => Report.normalize({ ...fixture(), source: '' }, NOW), /report source/);
});
test('Word contract creates editable typed runs, tables and repeated headers without AP resume data', async () => {
  class MockNode { constructor(options) { this.options = options; } }
  class TableRow extends MockNode {}
  const D = new Proxy({ Packer: { toBlob: output => output }, TableRow,
    HeadingLevel: { TITLE: 'title', HEADING_1: 'h1', HEADING_2: 'h2' },
    WidthType: { PERCENTAGE: '%' }, ShadingType: { CLEAR: 'clear' }, BorderStyle: { SINGLE: 'single' },
    PageNumber: { CURRENT: 'CURRENT', TOTAL_PAGES: 'TOTAL_PAGES' }, AlignmentType: { RIGHT: 'right' },
  }, { get: (obj, key) => obj[key] || MockNode });
  const document = await Report.word(Report.normalize(fixture(), NOW), D);
  function findRow(value) {
    if (value instanceof TableRow && value.options.tableHeader) return true;
    if (value != null && typeof value === 'object') return Object.values(value).some(findRow);
    return false;
  }
  const json = JSON.stringify(document);
  assert.match(json, /ACTIVITY COMPLETE/);
  assert.match(json, /This does not show who did the work or how well/);
  assert.match(json, /Second <tag> & line/);
  assert.match(json, /Example Student/);
  assert.match(json, /Simulated trial/);
  assert.match(json, /Page /);
  assert.doesNotMatch(json, /aplab_payload|LB1/);
  assert.ok(findRow(document));
});
