/* Targeted source contracts for the openscied-b1 and openscied-b2 audit follow-up. */
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const read = file => readFileSync(resolve(__dirname, '..', file), 'utf8');
const checks = [
  ['Migration Explorer names the activity and explains the source category and sample limitation', () => {
    const page = read('openscied-b1-migration.html');
    assert.match(page, /<h1>Migration Map Explorer<\/h1>/);
    assert.match(page, /“Healthy” is the source’s nutritional category/);
    assert.match(page, /cards do not report a numerical cutoff for bone-marrow fat/);
    assert.match(page, /pair each month with one location.*cannot separate the effect of month from the effect of location/);
  }],
  ['Serengeti How to play has a self-contained example with one win, a tie and the unmatched die', () => {
    const dialog = read('openscied-b1-serengeti.html').match(/<dialog id="sg-instructions"[\s\S]*?<\/dialog>/)[0];
    assert.match(dialog, /6 beats 5, the two 2s tie, and the unmatched 1 stays/);
    assert.match(dialog, /Each side rolls two fresh dice next/);
  }],
  ['Burning Fuels distinguishes three personal-data questions from general interpretation', () => {
    const section = read('openscied-b2-burn-lab.html').match(/<section[^>]*id="sense"[\s\S]*?<\/section>/)[0];
    const dropdowns = [...section.matchAll(/<select id="(sense-[^"]+)"/g)].map(m => m[1]);
    assert.equal(dropdowns.length, 10);
    assert.deepEqual(dropdowns.slice(-3), ['sense-lostmost', 'sense-yellowest', 'sense-warmest']);
    assert.match(section, /last three questions check your own recorded data; the earlier ones ask you to interpret what you saw/);
  }],
  ['Yeast distinguishes the next unrecorded sample from elapsed time without changing the queue', () => {
    const scene = read('decomposition-scene.js');
    assert.match(scene, /const take = all \? due : \[due\[0\]\]/);
    assert.match(scene, /Record next unrecorded sample \('/);
    assert.match(scene, /reached minute 20. The next unrecorded sample is from minute/);
  }],
  ['Tilt has visible HTML tube identification and numeric readings in addition to the canvas', () => {
    const scene = read('tilt-scene.js');
    assert.match(scene, /renderRun\(\)[\s\S]*?renderTubeReadouts\(\)/);
    assert.match(scene, /'data-tube-readout': row.tube/);
    assert.match(scene, /BTB ' \+ row.btb.toFixed\(1\)/);
    assert.match(scene, /same color and still have different readings/);
  }]
];
let passed = 0;
for (const [label, check] of checks) {
  try { check(); passed++; console.log('PASS', label); }
  catch (error) { console.error('FAIL', label, error.message.slice(0,150)); }
}
console.log('t134-openscied-audit-copy: ' + passed + '/' + checks.length + ' checks passed');
if (passed !== checks.length) process.exitCode = 1;
