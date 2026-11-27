const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const file = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function between(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, 'evidence surface exists: ' + start);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, 'evidence surface finishes: ' + end);
  return source.slice(a, b);
}

test('B.1: Ripple comparison table names the source of its modeled indices', () => {
  const section = between(file('openscied-b1-ripple.js'), 'function compareTable(', '  function render(');
  assert.match(section, /model for OpenSciEd B\.1 Lesson 8, not Serengeti field counts/);
});

test('B.2: the Burn evidence panel distinguishes model runs from classroom measurements', () => {
  const section = between(file('openscied-b2-burn-lab.html'), 'id="sense-burn-data"', 'id="sense-burn-data-body"');
  assert.match(section, /simulated burn results/);
  assert.match(section, /OpenSciEd B\.2 Lesson 2 companion, not readings from the classroom demonstration/);
});

test('B.3: the plant cell summary distinguishes observed color categories from exact areas', () => {
  const section = between(file('openscied-b3-cell-cycle.html'), 'id="cycle-data-size"', 'id="cycle-data-dna"');
  assert.match(section, /Microscope observations of one plant cell/);
  assert.match(section, /color categories in the microscope images; they do not give an exact area/);
  assert.match(section, /Cell Cycle Data/);
  assert.match(section, /Jones, A\. R\., et al\. \(2017\)/);
});

test('B.3: the adjacent DNA copying diagram does not claim a measured timeline or slope', () => {
  const section = between(file('openscied-b3-cell-cycle.html'), 'id="cycle-data-dna"', '</figure>');
  assert.match(section, /Simplified diagram of genetic material by phase/);
  assert.match(section, /do not show measured copying rates or phase durations/);
  assert.match(section, /Cell Cycle Data/);
  assert.match(section, /Heinz, K\., et al\. \(2018\)/);
});

test('B.4: the Hawksbeard landing chart and Cheptou experiment are labeled separately', () => {
  const src = file('openscied-b4-hawksbeard.html');
  const section = between(src, 'id="hb-compare"', 'id="hb-compare-chart"');
  assert.match(section, /Your simulated trial/);
  assert.match(section, /virtual releases, not from Cheptou and colleagues/);
  assert.match(src, /id="hb-published"><summary>Compare with Cheptou et al\. \(2008\) · published experiment/);
});

test('B.4: the Junco aviary chart links the exact published figure near the bars', () => {
  const section = between(file('openscied-b4-junco.html'), 'id="ju-aviary-results"', 'id="ju-aviary-chart"');
  assert.match(section, /group averages from a real aviary experiment/);
  assert.match(section, /https:\/\/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC3431113\/#fig3/);
});

test('B.5: the speciation timeline identifies the teaching intervals before the map', () => {
  const section = between(file('openscied-b5-speciation.html'), 'id="ice-dates"', 'id="ice-map"');
  assert.match(section, /OpenSciEd B\.5 Lesson 4, slide J/);
  assert.match(section, /not measured ice extent/);
});

test('B.5: the fossil map distinguishes age estimates from exact find sites', () => {
  const section = between(file('openscied-b5-speciation.html'), 'id="fossils-title"', 'class="ice-fossil-map"');
  assert.match(section, /published fossil age estimates/);
  assert.match(section, /OpenSciEd B\.5 Lesson 4 <em>Bear Fossils Map<\/em>/);
  assert.match(section, /approximate locations, not exact find sites/);
});
