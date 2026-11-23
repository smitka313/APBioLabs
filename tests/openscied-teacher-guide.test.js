'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

const dashboard = read('openscied-dashboard.html');
const guide = read('openscied-teacher-guide.html');
const dashboardActivities = [...dashboard.matchAll(/<article class="dashboard-activity">([\s\S]*?)<\/article>/g)]
  .map(([, article]) => article.match(/<a\b[^>]*\bclass="dashboard-open"[^>]*\bhref="([^"]+)"/)?.[1]);
const guideActivities = [...guide.matchAll(/<article\b[^>]*\bdata-guide-for="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];

test('each dashboard activity has one implementation card in lesson order', () => {
  assert.ok(dashboardActivities.length > 0, 'Dashboard activity inventory was not found.');
  assert.ok(dashboardActivities.every(Boolean), 'Every dashboard card should have a direct activity link.');
  assert.equal(new Set(dashboardActivities).size, dashboardActivities.length, 'Duplicate dashboard activity.');
  assert.deepEqual(guideActivities.map(x => x[1]), dashboardActivities,
    'Update the OpenSciEd Teacher Guide in the same PR as every new activity.');
  for (const [, activity, card] of guideActivities) {
    assert.ok(existsSync(resolve(root, activity)), activity + ' should exist.');
    assert.ok(card.includes('href="' + activity + '"'), activity + ' must be directly linked.');
    for (const prompt of ['Suggested time:', 'Set up', 'Facilitate', 'Listen for']) {
      assert.ok(card.includes(prompt), activity + ': Missing ' + prompt);
    }
  }
});

test('both teacher entry points link to the guide and the guide links to encrypted notes', () => {
  for (const source of [dashboard, read('teachers.html')]) {
    assert.match(source, /href="openscied-teacher-guide\.html"/);
  }
  assert.match(guide, /href="openscied-teacher-notes\.html"/);
  const notes = read('openscied-teacher-notes.html');
  assert.match(notes, /<meta name="robots" content="noindex">/);
  assert.match(notes, /type="password"/);
  assert.doesNotMatch(notes, /<h1>OpenSciEd worked examples<\/h1>|data-guide-for=/);
  const payload = JSON.parse(notes.match(/^const P = (\{.*\});$/m)[1]);
  assert.equal(payload.n, 310000);
  assert.equal(Buffer.from(payload.s, 'base64').length, 16);
  assert.equal(Buffer.from(payload.i, 'base64').length, 12);
  assert.ok(Buffer.from(payload.c, 'base64').length > 1000);
  for (const url of ['/openscied-teacher-notes', '/openscied-teacher-notes.html']) {
    assert.ok(read('_headers').includes(url + '\n  X-Robots-Tag: noindex, nosnippet\n'));
  }
  assert.doesNotMatch(read('sitemap.xml'), /openscied-teacher-notes/);
});
