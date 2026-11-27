// Regression: a completed teacher exemplar must not be published alongside its gate.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const exists = f => fs.existsSync(path.join(root, f));
const publicCopy = /(?:samples\/sample-report-lab05|sample-report:start|class="rv-(?:qa|quiz)|>Sample Student<|53V-BFN)/i;
const lab5Gate = /href="teacher-lab05\.html#report-grading-kit"/;

test('legacy public report page sends teachers to the lock, not to any part of the report', () => {
  const landing = read('sample-report.html');
  assert.ok(!publicCopy.test(landing), 'legacy public route includes report content or a file link');
  assert.match(landing, lab5Gate);
});

test('every former static exemplar file and the answer-filled report generator are absent', () => {
  const exposed = ['sample-report-lab05.docx', 'sample-report-lab05.pdf', 'sample-report-lab05-stamp.png',
    ...[1, 2, 3].map(i => `sample-report-lab05-graph-${i}.png`)];
  for (const f of exposed) assert.ok(!exists('samples/' + f), 'still public: ' + f);
  assert.ok(!exists('tools/make-sample-report.js'), 'the old generator itself contains the answers');
});

test('the teacher guide links to a gate and the gate has no readable example content', () => {
  assert.match(read('teachers.html'), lab5Gate);
  const locked = read('teacher-lab05.html');
  assert.match(locked, /type="password"/);
  assert.match(locked, /crypto\.subtle\.decrypt/);
  assert.match(locked, /^const P = \{.*"n":310000\};$/m);
  assert.ok(!publicCopy.test(locked) && !locked.includes('lab5-model-report'));
});
