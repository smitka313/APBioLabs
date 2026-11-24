'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const guard = require('../openscied-save-session.js');
const source = fs.readFileSync(path.join(__dirname, '../openscied-b2-peat-bog-lab.js'), 'utf8');
function range(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a+start.length);
  assert.ok(a >= 0 && b > a);
  return source.slice(a,b);
}
const prefix = range("  const KEY = ", "  function readSave()");
const reader = range("  function studentIdentity()", "  /* ---------- the one live region");
const render = range("  function renderStudent()", "  function recordTrial");
const exportSource = range("  function payload()", "  function download()");
const key = 'aplab:openscied:b2-peat-bog:v1', scope='b2-peat-bog-lab';
function verify(openingName) {
  const values = new Map([[key,'{"v":1}']]);
  const storage = { getItem:k=>values.get(k)??null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k) };
  let who = openingName ? {name:openingName, period:'1'} : null;
  const Lab={identity:{get:()=>who,datasetId:'BOG-TEST'}};
  const header={}, run = {settings:{wet:80}, trials:[], climate:{}};
  const ctx = { window:{ OpenSciEdSaveSession:guard, Lab }, Lab, localStorage:storage, byId:()=>header,
    preservedSave:false, state:{S:run.settings, trials:run.trials, climate:run.climate},
    L:{model:()=>({P:1,D:2,B:3,N:4,perm:5})} };
  vm.createContext(ctx);
  vm.runInContext(prefix+reader+render+exportSource,ctx);
  if (openingName) {
    who = {name:openingName, period:'2'};
    assert.equal(ctx.payload().student.period, '2');
  }
  guard.erase(storage,null,[key],()=>scope);
  who={name:'Next Student',period:'7'};
  const report = ctx.payload();
  assert.equal(report.student?.name ?? null, openingName);
  assert.equal(report.student?.period ?? null, openingName ? '2' : null);
  assert.equal(report.datasetId,'BOG-TEST');
  assert.equal(report.settings.wet,80);
  assert.equal(storage.getItem(key),null);
  ctx.renderStudent();
  assert.ok(!header.textContent.includes('Next Student'));
  assert.ok(report.dataNote.includes('student name and class period'));
}
verify('First Student');
verify(null);
console.log('PASS Peat Bog download and print: valid names update; erased work keeps its own name or stays unassigned.');
