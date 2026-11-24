/* Tiny source regressions for student-visible copy and no-script initial state. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const checks = [
  ['Carrying Capacity labels five required questions and puts the optional habitat question last', () => {
    const page = read('openscied-b1-carrying-capacity.html');
    assert.match(page, /0 of 5 required responses/);
    assert.match(page, /Required question 1 of 5/);
    assert.match(page, /<option value="limit">5\. Model limitations<\/option>\s*<option value="habitat-claim">Optional: Habitat challenge<\/option>/);
  }],
  ['Migration uses plain-language action links and keeps the original credit', () => {
    const page = read('openscied-b1-migration.html'), script = read('openscied-b1-migration.js');
    const names = [...page.matchAll(/<a href="https:\/\/codap\.concord\.org[^"]+"[^>]*>([^<]+)<\/a>/g)].map(a => a[1]);
    assert.deepEqual(names, ['Open the interactive monthly rainfall table ↗', 'Open the interactive rainfall and herd data ↗', 'Open the interactive monthly rainfall table ↗']);
    assert.match(page, /Source: OpenSciEd Lesson 4, Data Excursion 2 ↗/);
    assert.match(script, /Data Excursion 2: Annual Rainfall and Wildebeest Occupancy/);
  }],
  ['Fires shows the caveat next to the yeast model even when details are closed', () => {
    const page = read('openscied-b2-fires.html'), scene = page.match(/<section[^>]*\bid="yeast"[^>]*>([\s\S]*?)<\/section>/)[1];
    const index = scene.indexOf('id="yeast-model-limit"');
    assert.ok(index > 0 && index < scene.indexOf('id="decomp-scene"') && index < scene.indexOf('<details'));
    assert.match(scene, /doesn’t mean 43 °C is best for all yeast/);
    assert.match(scene, /how long it stays warm/);
  }],
  ['Carbon Journey starts with a disabled Restart before the script reads storage', () => {
    const page = read('openscied-b2-carbon-journey.html');
    assert.match(page, /<button[^>]+id="restart"[^>]*\bdisabled>/);
    assert.match(page, /id="restart-hint">Start a turn or write an answer before restarting\./);
  }],
  ['Student privacy copy is plain while the existing analytics and local-only disclosure remain', () => {
    for (const page of ['openscied-b2-fires.html', 'openscied-b3-cell-cycle.html', 'openscied-b2-carbon-journey.html'].map(read)) {
      assert.match(page, /anonymous page visits[^.]*without cookies/i);
      assert.match(page, /Nothing you type[^.]*is sent/);
      assert.match(page, /<script[^>]+src="https:\/\/gc\.zgo\.at\/count\.js"/);
      assert.doesNotMatch(page, />[^<]*GoatCounter[^<]*</);
    }
  }]
];
let passed = 0;
for (const [label, check] of checks) {
  try { check(); passed++; console.log('PASS', label); }
  catch (e) { console.error('FAIL', label, e.message.slice(0,200)); }
}
console.log('t133-openscied-readable-copy: ' + passed + '/' + checks.length + ' checks passed');
if (passed !== checks.length) process.exitCode = 1;
