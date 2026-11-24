'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Save = require('../openscied-save-session.js');

const apps = [
  ['b1-migration', 'aplab:openscied:b1-migration:v1', 'function save(){', 'function el('],
  ['b1-carrying-capacity', 'aplab:openscied-b1-carrying-capacity:run-v1', 'const save = ', 'const speak = '],
  ['b1-serengeti', 'aplab:openscied-b1-serengeti:preview-v1', 'function save() {', 'function showAnswerStep('],
  ['b2-fires', 'aplab:openscied:b2-fires:v1', 'function save() {', 'function restoreFields('],
  ['b2-peat-bog-lab', 'aplab:openscied:b2-peat-bog:v1', 'function save() {', '/* ---------- controls: sliders with number boxes ---------- */']
];
const file = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function memory() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

function editor(code, start, end, key, localStorage) {
  const elements = new Map(), listeners = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id,{hidden:true,textContent:''});
    return elements.get(id);
  };
  const window = {OpenSciEdSaveSession:Save,addEventListener:(event,fn)=>listeners.set(event, fn)};
  const guardStart = code.indexOf('  const saveAPI = ');
  const guardLine = "  window.addEventListener('pageshow', checkSaveConflict);";
  const guardEnd = code.indexOf(guardLine) + guardLine.length;
  const guard = guardStart >= 0 ? code.slice(guardStart, guardEnd) : '';
  const startAt = code.indexOf('  ' + start);
  const endAt = code.indexOf('  ' + end, startAt);
  assert.ok(startAt >= 0 && endAt > startAt, 'production autosave located');
  const quiet = () => {};
  const sandbox = {
    localStorage, window, document:{getElementById:element}, KEY:key, S:key, $:element, qs:element, byId:element,
    state:{page:'play'}, ready:true, cleared:false, preservedSave:false, hasSavedRecord:false, hadSaved:false,
    hydrating:false, corrupt:false, unavailable:false, preserveRaw:false, saveUnavailable:false,
    RESPONSES:[], RESPONSE_IDS:[], SCENE_IDS:[], SECTIONS:[], fields:{}, L:{sceneEvidence:()=>({})},
    page:'play', answers:{}, answerStep:'evidence', roleSetup:{}, huntReview:null, huntStart:null, huntDetails:{},
    decision:null, conceptProgress:{}, location:{hash:''}, say:quiet, speak:quiet, announce:quiet,
    record:()=>({v:1}), collectFields:()=>({}), renderReport:quiet
  };
  const save = vm.runInNewContext(guard + '\n' + code.slice(startAt, endAt) + '\nsave',sandbox);
  return { save, element, emit(event){ listeners.get(event.type)?.(event); } };
}

for (const [scope, key, start, end] of apps) {
  const filename = 'openscied-' + scope;
  test(scope + ': another tab’s work and dashboard ERASE survive an old editor’s autosave', () => {
    const code = file(filename + '.js'), store = memory();
    const original = editor(code, start, end, key, store);
    original.save();
    assert.notEqual(store.getItem(key),null,'normal autosave remains enabled');
    const newer = Save.open(store,scope,[key]);
    assert.equal(newer.write(key,'newer student work').ok,true);
    original.emit({type:'storage',key});
    original.save();
    assert.equal(store.getItem(key),'newer student work','must not overwrite newer saved work');
    assert.match(original.element('save-conflict').textContent,/newer save.*Download/s);
    const current = editor(code, start, end, key, store);
    assert.equal(Save.erase(store,scope,[key]).ok,true);
    current.emit({type:'storage',key:Save.scopeKey(scope)});
    current.save();
    assert.equal(store.getItem(key),null,'must not resurrect erased data');
    assert.match(current.element('save-conflict').textContent,/cleared in another tab.*cannot write it back/s);
    editor(code, start, end, key, store).save();
    assert.notEqual(store.getItem(key),null,'a fresh tab can start over');
  });

  test(scope + ': loads the guard before its controller', () => {
    const markup = file(filename + '.html');
    const guard = markup.indexOf('src="openscied-save-session.js"');
    assert.ok(guard >= 0 && guard < markup.indexOf('src="'+filename+'.js"'));
  });
}

for(const part of ['habitat','range','field']) {
  test('Carrying '+part+': writes through the shared session, not directly into localStorage', () => {
    const code = file('carrying-'+part+'.js');
    const start = code.indexOf('    function persist(){');
    const end = code.indexOf('\n    }',start);
    assert.ok(start >= 0 && end > start);
    const key = 'aplab:openscied:b1-carrying-capacity:'+part+':v1';
    const store = memory(), saveSession = Save.open(store,'b1-carrying-capacity',[key]);
    const writeStatus = [];
    const sandbox = {root:{localStorage:store},store:{localStorage:store},KEY:key,state:{notes:['before']},
      status:'ok',storage:'ok',getSaveSession:()=>saveSession,onSaveConflict:result=>writeStatus.push(result?.reason)};
    const persist = vm.runInNewContext(code.slice(start,end+6)+'\npersist',sandbox);
    persist();
    assert.equal(store.getItem(key),'{"notes":["before"]}');
    Save.erase(store,'b1-carrying-capacity',[key]);
    persist();
    assert.equal(store.getItem(key),null);
    assert.deepEqual(writeStatus,['erased']);
  });
}

for (const [scope, key] of apps.filter(([scope]) => scope.startsWith('b2'))) {
  test(scope + ': a stale in-app clear neither erases newer work nor reloads the editor', () => {
    const code = file('openscied-'+scope+'.js');
    const at = code.indexOf('  function clearActivity() {'), close = code.indexOf('\n  }', at);
    assert.ok(at >= 0 && close > at, 'production reset located');
    const store = memory();
    store.setItem(key,'opening save');
    const saveSession = Save.open(store,scope,[key]);
    store.setItem(key,'newer save');
    const seen = [];
    const dialog = {close(){seen.push('dialog closed');}};
    const sandbox = {
      KEY:key, saveSession, localStorage:store, cleared:false, $$:()=>[], $:()=>dialog, byId:()=>dialog,
      showSaveConflict:result=>seen.push(result?.reason),
      history:{replaceState(){seen.push('route changed');}},
      location:{pathname:'/activity',search:'',reload(){seen.push('reload');}}
    };
    const clear = vm.runInNewContext(code.slice(at,close+4)+'\nclearActivity', sandbox);
    clear();
    assert.equal(store.getItem(key),'newer save');
    assert.equal(sandbox.cleared,false);
    assert.deepEqual(seen,['dialog closed','changed']);
    const fresh = Save.open(store,scope,[key]);
    sandbox.saveSession = fresh;
    clear();
    assert.equal(store.getItem(key),null);
    assert.equal(sandbox.cleared,true);
    assert.deepEqual(seen,['dialog closed','changed','route changed','reload']);
  });
}
