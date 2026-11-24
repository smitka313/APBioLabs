'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Save = require('../openscied-save-session.js');
const L = require('../migration-logic.js');

const getSource = app => readFileSync(path.join(__dirname, '..', app), 'utf8');
function section(code, first, last) {
  const from = code.indexOf(first), to = code.indexOf(last, from);
  assert.ok(from >= 0 && to > from, 'production section found');
  return code.slice(from, to);
}
function fixture(app, identity) {
  const migration = app === 'migration';
  const key = migration ? 'aplab:openscied:b1-migration:v1' : 'aplab:openscied-b1-carrying-capacity:run-v1';
  const rangeKey = 'aplab:openscied:b1-carrying-capacity:range:v1';
  const storage = new Map([[key, 'opening main save'], [rangeKey, 'opening range save']]);
  const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k, v), removeItem: k => storage.delete(k) };
  const Lab = { identity:{ get: () => identity } }, window = { OpenSciEdSaveSession:Save, Lab };
  const source = getSource('openscied-b1-' + app + '.js');
  const init = section(source, '  const KEY', '  function showSaveConflict');
  const report = migration
    ? section(source, '  function unsavedMonthDrafts(){', '  function submissionData(){') +
      section(source, '  function reportText(kind){', '  function textCopy(')
    : section(source, '  const report = ', '  const openReport = ');
  const state = { notes:migration ? L.upsertMonthlyNote([],0,'Earlier notebook version').notes : [],
    observations:migration ? {0:'Earlier January draft revision'} : undefined,
    answers: { claim:'Earlier synthetic observation' } };
  let previousRange = localStorage.getItem(rangeKey);
  const sandbox = { localStorage, window, Lab, state, L, displayNoteText:L.notebookText, RESPONSES:[['claim','What did you observe?']],
    compareText:()=>'', range:{report:()=>previousRange}, habitat:{report:()=>''},field:{report:()=>''} };
  vm.runInNewContext(init + report + 'globalThis.getReport = ' + (migration ? 'reportText' : 'report') + ';', sandbox);
  return {
    key, rangeKey, localStorage, setIdentity: next => { identity = next; }, report: kind => sandbox.getReport(kind)
  };
}

for (const app of ['migration','carrying-capacity']) {
  test(app + ' recovery exports neither adopt a new student nor drop the earlier work after sign-out', () => {
    const f = fixture(app, {name:'Earlier QA student',period:'1'});
    assert.match(f.report(), /Name: Earlier QA student\nClass period: 1/);
    assert.match(f.report(), /Earlier synthetic observation/);
    assert.equal(Save.erase(f.localStorage,null,[f.key]).ok,true);
    f.setIdentity({name:'Next QA student',period:'7'});
    const stale = f.report();
    assert.match(stale, /Name: Earlier QA student\nClass period: 1/);
    assert.match(stale, /Earlier synthetic observation/);
    assert.doesNotMatch(stale, /Next QA student|Class period: 7/);
    if (app === 'migration') {
      for (const report of [stale,f.report('notebook')]) {
        assert.match(report, /Name: Earlier QA student\nClass period: 1/);
        assert.match(report, /Earlier notebook version/);
        assert.match(report, /January · draft revision\nEarlier January draft revision/);
        assert.doesNotMatch(report, /Next QA student|Class period: 7/);
      }
    }
  });
}
test('Carrying uses the shared name in a valid session and freezes it when an included submodel changes', () => {
  const f = fixture('carrying-capacity', {name:'Starting QA name',period:'2'});
  f.setIdentity({name:'Corrected QA name',period:'3'});
  assert.match(f.report(), /Name: Corrected QA name\nClass period: 3/);
  f.localStorage.setItem(f.rangeKey, 'next student range save');
  f.setIdentity({name:'Different QA student',period:'6'});
  const report = f.report();
  assert.match(report, /Name: Corrected QA name\nClass period: 3/);
  assert.match(report, /opening range save/);
  assert.doesNotMatch(report, /Different QA student|next student range save/);
});
test('a stale Migration tab opened anonymously stays anonymous', () => {
  const f = fixture('migration', null);
  assert.equal(Save.erase(f.localStorage,'b1-migration',[f.key]).ok,true);
  f.setIdentity({name:'Next QA student',period:'7'});
  assert.match(f.report(), /Name: \nClass period: \n/);
});
