'use strict';

const assert = require('node:assert/strict');
const { connect } = require('../openscied-resume.js');

const screening = '/openscied-b3-screening.html';
const junco = '/openscied-b4-junco.html';
const screeningKey = 'aplab:openscied:b3-screening:v1';
const juncoKey = 'aplab:openscied:b4-junco:v1';
const data = new Map();
const storage = {
  getItem: key => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value)
};
let now = 1000;
const clock = () => now;
const edit = connect(storage, clock, { scope:'b3-screening' });
const other = connect(storage, clock, { scope:'b4-junco' });
const dashboard = () => connect(storage, clock);
const newest = () => {
  const view = dashboard();
  return [screening, junco].sort((a, b) => view.snapshot(b).changed - view.snapshot(a).changed)[0];
};
const run = {
  v:1, seed:2026, started:true, plan:{ screen:'hub', machine:'mobile', operator:'mobile', rides:null },
  trial:{ screen:'hub', machine:'mobile', operator:'mobile', rides:null },
  caseId:1, caseAnswers:{}, caseChecks:[]
};
function saveScreening(record) {
  storage.setItem(screeningKey, JSON.stringify({ ...record, lastVisitedAt:now }));
  return edit.snapshot(screening, 'save');
}

assert.equal(edit.snapshot(screening, 'open').changed, 0, 'opening an untouched activity is not work');
now = 1100;
assert.equal(saveScreening(run).changed, 1100, 'running a redesign is work');

now = 1200;
storage.setItem(juncoKey, JSON.stringify({ v:1, observation:'A city bird flew away.', lastVisitedAt:now }));
other.snapshot(junco, 'save');
assert.equal(newest(), junco, 'the newer observation outranks the earlier redesign');

now = 1300;
assert.equal(edit.snapshot(screening, 'open').changed, 1100, 'reopening does not promote an unchanged redesign');
assert.equal(saveScreening({ ...run, caseId:2 }).changed, 1100, 'viewing another case updates the timestamp, not the work rank');
assert.equal(newest(), junco);

now = 1400;
// Wrong-answer submission saves caseAnswers but does not add to caseChecks.
const attempted = { ...run, caseId:2, caseAnswers:{ 2:'neither' } };
assert.equal(saveScreening(attempted).changed, 1400, 'a saved comparison attempt counts even before the case is checked');
assert.equal(newest(), screening, 'the dashboard now points to the newest student work');
assert.deepEqual(JSON.parse(storage.getItem(screeningKey)).caseChecks, [], 'resume tracking does not mark a case correct');
assert.equal(dashboard().snapshot(screening).changed, 1400, 'a fresh dashboard retains the work rank');

now = 1500;
assert.equal(saveScreening({ ...attempted, caseId:1 }).changed, 1400, 'viewing another case after an attempt does not count as new work');

console.log('PASS Screening ranks fresh comparison attempts but not case browsing or reopening');
