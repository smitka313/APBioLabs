'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

const dashboard = read('openscied-dashboard.html');
const guide = read('openscied-teacher-guide.html');
// Inspect complete opening tags; class order and unrelated style tokens are not part of the link contract.
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find(v => v !== undefined);
const hasClass = (tag, token) => (attr(tag, 'class') || '').split(/\s+/).includes(token);
const dashboardCards = [...dashboard.matchAll(/(<article\b[^>]*>)([\s\S]*?)<\/article>/gi)]
  .filter(([, tag]) => hasClass(tag, 'dashboard-activity'))
  .map(([, , article]) => {
    const links = article.match(/<a\b[^>]*>/gi) || [];
    const destinations = token => links.filter(link => hasClass(link, token)).map(link => attr(link, 'href'));
    return { direct: destinations('dashboard-open'), preview: destinations('dashboard-preview') };
  });
const guideActivities = [...guide.matchAll(/<article\b[^>]*\bdata-guide-for="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];

test('each dashboard activity has one implementation card in lesson order', () => {
  assert.ok(dashboardCards.length > 0, 'Dashboard activity inventory was not found.');
  for (const { direct, preview } of dashboardCards) {
    assert.equal(direct.length, 1, 'Every dashboard card should have exactly one direct activity link.');
    assert.match(direct[0] || '', /^openscied-[a-z0-9-]+\.html$/, 'The direct link must point to a published activity page.');
    assert.deepEqual(preview, direct, 'The illustration and direct link must open the same activity.');
  }
  const dashboardActivities = dashboardCards.map(card => card.direct[0]);
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

test('the teacher landing page, not the student dashboard, links to the guide and encrypted notes', () => {
  assert.match(read('teachers.html'), /href="openscied-teacher-guide\.html"/);
  assert.doesNotMatch(dashboard, /href="openscied-teacher-guide\.html"/);
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

test('public activity index gives each guide card a direct jump and a collapsed classroom plan', () => {
  const index = guide.match(/<nav\b[^>]*\bid="guide-index"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(index, 'Missing activity index.');
  for (const [, activity, card] of guideActivities) {
    const id = 'guide-' + activity.replace(/^openscied-/, '').replace(/\.html$/, '');
    const openingTag = [...guide.matchAll(/<article\b[^>]*>/g)].map(m => m[0])
      .find(tag => tag.includes('data-guide-for="' + activity + '"'));
    assert.ok(openingTag?.includes('id="' + id + '"'), activity + ': missing jump target.');
    assert.ok(index.includes('href="#' + id + '"'), activity + ': missing index entry.');
    assert.ok(card.indexOf('Suggested time:') < card.indexOf('<details'), activity + ': pacing must stay visible.');
    const details = card.match(/<details\b[^>]*>/)?.[0];
    assert.ok(details && !/\bopen(?:\s|=|>)/.test(details), activity + ': plan should start collapsed.');
  }
});


test('teachers can jump from the guide header to accessible collection instructions', () => {
  const hero = guide.match(/<header class="[^"]*\bose-teacher-hero\b[^"]*">([\s\S]*?)<\/header>/)?.[1];
  assert.match(hero || '', /<a\b[^>]*href="#collect"[^>]*>Jump to collecting student work/);
  assert.match(guide, /<h2 id="collect" tabindex="-1">Collect student work<\/h2>/);
  const collection = guide.match(/<aside class="ose-teacher-callout" aria-labelledby="collect">([\s\S]*?)<\/aside>/)?.[1];
  assert.match(collection || '', /For individual reports[\s\S]*Group reports do not need an individual name/);
  assert.match(collection || '', /Students choose <strong>Print or save as PDF<\/strong> and turn in the file/);
  assert.match(collection || '', /dashboard JSON is an archive[\s\S]*cannot reopen a session on the dashboard/);
  assert.match(collection || '', /Recovered work<\/strong> while keeping its original name, when known/);
  assert.match(guide, /A typed draft appears in the report under its month, but it counts as a notebook observation only after students save it/);
  assert.match(guide, /Repeating the same settings does not count as a comparison/);
});

test('dashboard and teacher guide offer the same masthead theme control and honest privacy copy', () => {
  const ap = read('ap-biology.html');
  for (const page of [ap, guide]) {
    const masthead = page.match(/<div class="bench-appearance">([\s\S]*?)<\/div>/)?.[1];
    assert.match(masthead || '', /data-ph="theme"/, 'theme control has a masthead slot');
    assert.match(page, /src="lab\.js"/, 'shared theme controller');
  }
  assert.match(guide, /class="bench-logo" href="index\.html"/);
  assert.match(guide, /class="ose-teacher-hero__art" src="assets\/bench-field-atlas\.svg"/);
  for (const page of [ap, dashboard, read('index.html')]) {
    assert.match(page, /counts page visits without cookies\. Student names and answers stay in this browser unless you choose to share them/);
  }
  assert.match(read('style.css'), /neutral fill distinguishes disabled controls[\s\S]*?background: var\(--surface-2\);[\s\S]*?border: 1px solid/);
});
