const test=require('node:test'),a=require('node:assert/strict'),L=require('../openscied-b2-carbon-journey-logic');
// Independent transcription oracle: [destination, matter index, energy index],
// checked directly against supplied location card PDF pp.1–7, not generated from implementation.
const oracle={
 atmosphere:[['atmosphere',0,0],['atmosphere',0,0],['atmosphere',0,0],['ocean',0,1],['producers',2,3],['producers',2,3]],
 ocean:[['ocean',0,0],['ocean',0,0],['atmosphere',0,1],['atmosphere',0,1],['producers',2,3],['soil',5,1]],
 human:[['human',6,0],['soil',6,1],['atmosphere',0,3],['atmosphere',0,3],['atmosphere',0,3],['atmosphere',0,3]],
 producers:[['producers',2,0],['producers',2,0],['atmosphere',0,3],['atmosphere',0,3],['atmosphere',0,3],['atmosphere',0,3]],
 producerExit:[['herbivores',1,3],['omnivores',1,1],['human',6,1],['human',6,1],['soil',2,1],['soil',2,1]],
 herbivores:[['atmosphere',0,3],['atmosphere',0,3],['omnivores',2,3],['herbivores',2,3],['soil',4,1],['soil',2,3]],
 omnivores:[['atmosphere',0,3],['atmosphere',0,3],['omnivores',2,2],['omnivores',2,2],['soil',2,3],['soil',4,1]],
 soil:[['atmosphere',0,3],['soil',2,2],['soil',2,0],['soil',3,0],['human',3,1],['human',3,1]]
};
for(const [station,rows] of Object.entries(oracle))rows.forEach(([to,m,e],i)=>test(`Official card ${station}, roll ${i+1}`,()=>{const s=L.initial(42);if(station!=='atmosphere')s.rows=[{to:station==='producerExit'?'producers':station}];s.producerExit=station==='producerExit';const c=L.outcome(s,i+1);a.equal(c.to,to);a.equal(c.matter,L.matter[m]);a.equal(c.energy,L.energy[e]);a.ok(c.text.length>70);a.equal(c.exit,station==='producers'&&i<2);}));
test('source contract: seven systems, seven matter forms, four energy categories',()=>{a.equal(L.stations.length,7);a.equal(L.matter.length,7);a.equal(L.energy.length,4);a.equal(L.current(L.initial(1)),'atmosphere');});
test('rolls reproducible, bounded, variable across identities',()=>{for(let seed=0;seed<100;seed++)for(let i=0;i<100;i++){const n=L.die(seed,i);a.ok(n>=1&&n<=6);a.equal(n,L.die(seed,i));}a.notDeepEqual(Array.from({length:10},(_,i)=>L.die(1,i)),Array.from({length:10},(_,i)=>L.die(2,i)));});
test('hand-calculated totals include stays once and origin of moving roll',()=>{let s=L.initial(42);for(const roll of [1,5,1]){s.pending=roll;s=L.record(s);}a.deepEqual(L.totals(s,'from',['atmosphere','producers']).map(x=>x.count),[2,1]);a.deepEqual(L.totals(s,'matter',L.matter).map(x=>x.count),[1,0,2,0,0,0,0]);a.equal(L.current(s),'producers');a.equal(s.producerExit,true);a.deepEqual(L.restore(JSON.stringify(s),0),s);});
test('producer second table persists through reload and resets after leaving',()=>{let s=L.initial(1);for(const die of [5,2]){s.pending=die;s=L.record(s);}s.pending=2;s=L.restore(JSON.stringify(s),8);a.equal(L.outcome(s).to,'omnivores');s=L.record(s);a.equal(s.rows.length,3);a.equal(s.producerExit,false);a.equal(s.rows[2].stage,'producerExit');});
test('automatic outcome cannot be overridden by user choice',()=>{let s=L.initial(1);s.pending=1;s=L.record(s,{to:'ocean',matter:'Waste',note:'test'});a.equal(s.rows[0].to,'atmosphere');a.equal(s.rows[0].matter,'Carbon dioxide');a.equal(s.rows[0].note,'test');});
test('unrolled and finished journeys cannot record; invalid saves reset safely',()=>{let s=L.initial(1);a.throws(()=>L.record(s));s.pending=3;s.done=true;a.throws(()=>L.record(s));a.deepEqual(L.restore('{bad',7),L.initial(7));});
test('pending die and answers survive reload; legacy manual work is preserved and marked',()=>{let s=L.initial(3);s.pending=6;s.answers.q4='An oak tree';a.deepEqual(L.restore(JSON.stringify(s),0),s);const old={version:1,seed:3,rows:[{turn:1,from:'atmosphere',to:'ocean',die:1,matter:'Waste',energy:L.energy[0],note:'Earlier work'}],pending:2,answers:{q4:'Keep my story'}};let next=L.restore(JSON.stringify(old),0);a.equal(next.rows[0].note,'Earlier work');a.equal(next.legacyRows,1);a.equal(next.answers.q3,'Keep my story');next=L.record(next);a.equal(next.rows[1].to,'ocean');a.deepEqual(L.restore(JSON.stringify(next),0),next);});
test('source inconsistencies retained verbatim, no unapproved science edits',()=>{const s=L.initial(1);s.rows=[{to:'omnivores'}];a.match(L.outcome(s,6).text,/leave the herbivore’s body/);s.rows=[{to:'human'}];a.match(L.outcome(s,5).text,/burned to for/);s.rows=[{to:'ocean'}];a.match(L.outcome(s,6).text,/Energy flows to another new system\./);});

// Run the actual activity script with fictional storage; no student's data is used.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const journeyPage = fs.readFileSync(path.join(__dirname, '../openscied-b2-carbon-journey.js'), 'utf8');
const sessionGuard=require('../openscied-save-session.js');
const key = 'aplab:openscied:b2-carbon-journey:v1';
const budgetKey = 'aplab:openscied:b2-carbon-journey:budget:v1';
function openFictionalJourney(snapshot, hash = '', budgetRecord, shared) {
  const nodes = new Map(), downloads = [], writes = [], windowEvents = {};
  const data=shared || new Map([[key,snapshot],[budgetKey,budgetRecord===undefined?null:JSON.stringify(budgetRecord)]]);
  let blocked = false;
  function node() {
    return {
      set id(value) { this.localId = value; nodes.set('#' + value, this); },
      get id() { return this.localId; },
      value: '', textContent: 'Download journey and budget', dataset: {}, style: {}, events: {},
      classList: { toggle() {}, add() {}, remove() {} },
      addEventListener(event, handler) { this.events[event] = handler; },
      click() { if (typeof this.download === 'string') downloads.push(this.download); else this.events.click?.(); },
      querySelectorAll() { return []; }, querySelector: get, append() {}, replaceChildren() {}, setAttribute() {},
      showModal() { this.open = true; }, close() { this.open = false; }, reset() {}, focus() {}
    };
  }
  function get(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); }
  const window = {
    CarbonJourney: L, CarbonJourneyScene: { render() {} }, scrollTo() {},
    CarbonBudgetLogic: require('../carbon-budget-logic'),
    OpenSciEdSaveSession:sessionGuard, addEventListener(name, callback) {
      (windowEvents[name] ??= []).push(callback);
    }
  };
  const env = {
    window,
    document: { body: node(), querySelector: get, querySelectorAll(selector) {
      return selector === '.journey-page' ? ['play', 'evidence', 'sense', 'budget'].map(id => Object.assign(get('#' + id), { id })) :
        selector==='[data-page]' ? ['play', 'evidence', 'sense', 'budget'].map(page => Object.assign(get('[data-page="'+page+'"]'),{dataset:{page}})) : [];
    }, createElement: node, addEventListener() {} },
    Lab: { init() {}, identity: { seed: { seed: 42 }, get:()=>{try{return JSON.parse(data.get('aplab:student'));}catch(_){return null;}} }, reducedMotion() { return true; }, chart() { return { update() {} }; } },
    localStorage: {
      getItem: k => data.get(k) ?? null,
      setItem(k, value) {
        if(blocked && k===key)throw Error('fictional failed write');
        if(k===key)writes.push(value);
        data.set(k,value);
      },
      removeItem: k => data.delete(k)
    },
    location: { hash }, history: { replaceState(_, _title, hash) { this.hash = hash; } },
    matchMedia() { return { matches: false, addEventListener() {} }; },
    Blob: class { constructor(parts) { downloads.push(parts.join('')); } },
    URL: { createObjectURL() { return 'blob:fictional'; }, revokeObjectURL() {} },
    setTimeout() {}
  };
  window.Lab=env.Lab;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../carbon-budget.js'),'utf8'),env);
  vm.runInNewContext(journeyPage, env);
  return { get, writes, downloads, storage:env.localStorage, setBlocked(value) { blocked = value; },
    onStorage(key){windowEvents.storage?.forEach(fn=>fn({key}));}, read() { return env.localStorage.getItem(key); } };
}
for (const [name, raw, hash] of [
  ['unsupported version', ' {"version":99,"seed":17,"rows":[],"answers":{"q4":"Keep this fictional answer."}}\n', '#play'],
  ['malformed JSON', '{unfinished fictional work', ''],
  ['invalid row in a supported version', '{"version":2,"seed":42,"rows":[{"turn":1,"from":"producers"}],"answers":{"q4":"Keep"}}', '#sense']
]) {
  test('opening and playing with ' + name + ' protects the raw save until confirmed reset', () => {
    const page = openFictionalJourney(raw, hash);
    a.equal(page.read(), raw);
    a.equal(page.get('#download').textContent, 'Download saved backup');
    a.equal(page.get('#roll').disabled, true);
    a.match(page.get('#card-instruction').textContent, /Open Your evidence/);
    page.get('[data-show-evidence]').click();
    page.get('#roll').click();
    page.get('#note').events.input();
    page.get('#restart').click();
    page.get('#cancel-reset').click();
    a.equal(page.read(), raw);
    a.equal(page.writes.length, 0);
    page.get('#download').click();
    a.deepEqual(page.downloads, [raw, 'carbon-atom-journey-saved-backup.txt']);
    page.setBlocked(true);
    page.get('#confirm-reset').click();
    a.equal(page.read(), raw);
    a.match(page.get('#status').textContent, /previous save has not been changed/);
    page.setBlocked(false);
    page.get('#note').events.input();
    a.equal(page.read(), raw, 'a failed reset must not unlock subsequent autosaves');
    page.get('#confirm-reset').click();
    a.equal(page.writes.length, 1);
    a.equal(JSON.parse(page.read()).version, 3);
    a.equal(JSON.parse(page.read()).lastSection, 'play');
    a.equal(page.get('#download').textContent, 'Download journey and budget');
  });
}

for (const version of [1, 2]) {
  test('activity still resumes v' + version + ' work with its pending roll and written answer', () => {
    const saved = L.initial(17);
    const withRow = L.record({ ...saved, pending: 5 });
    const fixture = { ...withRow, version, pending: 2, lastSection: 'sense', answers: { q4: 'My fictional evidence.' } };
    const page = openFictionalJourney(JSON.stringify(fixture));
    const resumed = JSON.parse(page.read());
    a.equal(resumed.pending, 2);
    a.equal(resumed.answers.q3, fixture.answers.q4);
    a.equal(resumed.lastSection, 'sense');
    a.equal(resumed.rows[0].to, 'producers');
    a.equal(page.get('#play').hidden, true);
    a.equal(page.get('#sense').hidden, false);
  });
}

test('the reported looping seed keeps every official roll and exposes missed events without adding rows', () => {
  let s=L.initial(4177023592);
  for(let i=0;i<10;i++)s=L.record({...s,pending:L.die(s.seed,i)});
  a.deepEqual(s.rows.map(r=>r.die),[6,6,5,6,5,5,6,3,4,6]);
  a.deepEqual(s.rows.map(r=>r.card),['aPlant','pRespire','aPlant','pRespire','aPlant','pRespire','aPlant','pRespire','aOcean','oSoil']);
  const before=JSON.stringify(s), tour=L.tour(s);
  a.equal(tour.length,7);
  a.deepEqual(tour.filter(v=>!v.visited).map(v=>v.from),['human','herbivores','omnivores']);
  const decomposer=tour.find(v=>v.from==='soil');
  a.equal(decomposer.drawn,false);
  a.equal(decomposer.visited,true,'the student reached soil, but did not draw a soil card');
  a.match(decomposer.text,/decomposer/);
  a.equal(JSON.stringify(s),before);
});

test('every old Make Sense key migrates by position without losing or double-moving answers',()=>{
  const old={...L.initial(123),version:2,answers:{q2:'first',q3:'second',q4:'third',q5:'fourth',q6:'fifth'}};
  const current=L.readSaved(JSON.stringify(old));
  a.deepEqual(current.answers,{q1:'first',q2:'second',q3:'third',q4:'fourth',q5:'fifth'});
  a.deepEqual(L.readSaved(JSON.stringify(current)),current);
});

test('matching and skipped predictions survive reload and export; old predictions stay unspecified',()=>{
  const earlier=L.record({...L.initial(1),pending:4});
  const predicted=L.record({...earlier,pending:3},{prediction:'atmosphere'});
  const skipped=L.record({...predicted,pending:2},{prediction:null});
  const restored=L.readSaved(JSON.stringify(skipped));
  a.equal(Object.hasOwn(restored.rows[0],'prediction'),false);
  a.equal(restored.rows[1].prediction,'atmosphere');
  a.equal(restored.rows[1].to,'atmosphere');
  a.equal(restored.rows[2].prediction,null);
  const page=openFictionalJourney(JSON.stringify(restored));
  page.get('#download').click();
  const exported=JSON.parse(page.downloads[0]);
  a.equal(exported.rows[1].prediction,'atmosphere');
  a.equal(exported.rows[2].prediction,null);
  a.match(exported.questions.q1,/start out in the atmosphere/);
  a.equal(exported.budget,null);
});

test('Journey download includes the full saved Budget without opening the Budget tab this session',()=>{
  const budget={v:1,position:2,furthest:8,prediction:'More air carbon',explanation:'Fire moved carbon out of peat.'};
  const page=openFictionalJourney(JSON.stringify(L.initial(1)),'#sense',budget);
  page.get('#download').click();
  const exported=JSON.parse(page.downloads[0]).budget;
  a.equal(exported.simulated,true);
  a.equal(exported.position,2);
  a.equal(exported.furthest,8);
  a.equal(exported.prediction,budget.prediction);
  a.equal(exported.explanation,budget.explanation);
  a.equal(exported.checkpoints.length,9);
  a.equal(exported.checkpoints[4].title,'Compare peat with and without fire');
  a.equal(exported.checkpoints[4].fire.carbon.air-exported.checkpoints[4].baseline.carbon.air,4);
  a.equal(exported.checkpoints[8].fire.energy.heat-exported.checkpoints[8].baseline.energy.heat,4);
});

test('repeated cards trigger a resumable checkpoint before the next official roll',()=>{
  let s=L.initial(4177023592);
  for(let i=0;i<5;i++)s=L.record({...s,pending:L.die(s.seed,i)});
  a.equal(L.routeRepeating(s),true);
  s.coverageCheckpoint='repeat';
  const page=openFictionalJourney(JSON.stringify(s),'#play');
  a.equal(page.get('#roll').hidden,true);
  a.equal(page.get('#coverage-continue').hidden,false);
  a.match(page.get('#coverage-route').textContent,/Ocean/);
  page.get('#roll').click();
  a.equal(JSON.parse(page.read()).pending,null);
  page.get('#coverage-continue').click();
  const after=JSON.parse(page.read());
  a.equal(page.get('#roll').hidden,false);
  a.deepEqual(after.rows,s.rows);
  a.deepEqual(after.coverageReviewed,['ocean']);
  a.equal(after.coverageCheckpoint,null);
});

test('a short route cannot finish without evidence from every missing station and a decomposer',()=>{
  let s=L.initial(1);
  for(let i=0;i<10;i++)s=L.record({...s,pending:1});
  const page=openFictionalJourney(JSON.stringify(s),'#play');
  page.get('#finish').click();
  const queued=JSON.parse(page.read());
  a.equal(queued.done,false);
  a.equal(queued.coverageCheckpoint,'finish');
  for(let i=0;i<6;i++){
    a.equal(page.get('#coverage-continue').hidden,false);
    page.get('#coverage-continue').click();
  }
  const finished=JSON.parse(page.read());
  a.equal(finished.done,true);
  a.deepEqual(finished.rows,s.rows);
  a.equal(L.missingCoverage(finished).length,0);
  page.get('#download').click();
  const saved=JSON.parse(page.downloads[0]);
  a.equal(saved.referenceCardsReviewed.length,6);
  a.match(saved.referenceCardsReviewed.find(r=>r.from==='soil').text,/decomposer/);
});

test('two actual Journey pages cannot undo dashboard ERASE by opening Your evidence',()=>{
  let state=L.initial(42);
  const roll=()=>{state=L.record({...state,pending:L.die(state.seed,state.rows.length)});};
  roll();
  const shared=new Map([[key,JSON.stringify(state)]]);
  const older=openFictionalJourney(null,'#play',undefined,shared);
  a.equal(older.writes.length,0,'opening a current record must not stale another tab');
  a.equal(JSON.parse(older.read()).rows.length,1);
  for(let i=0;i<5;i++)roll();
  shared.set(key,JSON.stringify(state));
  const newer=openFictionalJourney(null,'#play',undefined,shared);
  a.equal(JSON.parse(newer.read()).rows.length,6);
  older.get('[data-show-evidence]').click();
  a.equal(JSON.parse(older.read()).rows.length,6,'old page cannot undo newly saved rolls');
  a.match(older.get('#journey-save-conflict').textContent,/changed in another tab/);
  a.equal(sessionGuard.erase(newer.storage,null,[key,budgetKey]).ok,true);
  for(const tab of [newer,older]){
    tab.onStorage(sessionGuard.globalKey);
    tab.get('[data-show-evidence]').click();
    a.equal(tab.read(),null,'old navigation cannot restore the erased work');
    a.match(tab.get('#journey-save-conflict').textContent,/cleared in another tab/);
  }
  newer.get('#download').click();
  a.equal(JSON.parse(newer.downloads[0]).rows.length,6,'conflicted work remains available for a deliberate local download');
  const fresh=openFictionalJourney(null,'#play',undefined,shared);
  fresh.get('#roll').click();
  a.equal(JSON.parse(fresh.read()).rows.length,0,'a page opened after ERASE can save new work');
  a.notEqual(JSON.parse(fresh.read()).pending,null);
});

test('a Budget tab opened after ERASE by an older Journey page cannot recreate erased work',()=>{
  const saved={v:1,position:-1,furthest:-1,prediction:'Old budget evidence',explanation:''};
  const shared=new Map([[budgetKey,JSON.stringify(saved)]]);
  const tab=openFictionalJourney(null,'#play',undefined,shared);
  a.equal(sessionGuard.erase(tab.storage,null,[key,budgetKey]).ok,true);
  tab.get('[data-page="budget"]').click();
  a.equal(tab.get('#cb-prediction').value,saved.prediction,'still available to download from the older page');
  a.match(tab.get('#cb-save-status').textContent,/budget was cleared/i);
  tab.get('#cb-prediction').value='A fictional late edit';
  tab.get('#cb-prediction').events.input();
  a.equal(tab.storage.getItem(budgetKey),null);
  tab.get('#download').click();
  a.equal(JSON.parse(tab.downloads[0]).budget.prediction,'A fictional late edit');
});

test('Carbon Journey download uses the current shared sign-in, not a stale page name',()=>{
  const shared=new Map([['aplab:student',JSON.stringify({name:'Initial QA',period:'1'})]]);
  const tab=openFictionalJourney(null,'#play',undefined,shared);
  shared.set('aplab:student',JSON.stringify({name:'Current QA',period:'4'}));
  tab.get('#download').click();
  a.deepEqual(JSON.parse(tab.downloads[0]).student,{name:'Current QA',period:'4'});
  a.equal(tab.read(),null,'reading the activity and exporting do not create a saved record');
  shared.delete('aplab:student');tab.get('#download').click();
  a.equal(Object.hasOwn(JSON.parse(tab.downloads[2]),'student'),false);
});

test('blank journey Restart is inert, then unlocks for actual journey work and resets to disabled', () => {
  const page = openFictionalJourney(null, '#evidence');
  a.equal(page.get('#restart').disabled, true);
  a.equal(page.get('#restart-hint').hidden, false);
  page.get('#restart').click();
  a.notEqual(page.get('#reset-dialog').open, true);
  page.get('#q1').value = '   ';
  page.get('#q1').events.input();
  a.equal(page.get('#restart').disabled, true);
  page.get('#q1').value = 'Carbon started in the air.';
  page.get('#q1').events.input();
  a.equal(page.get('#restart').disabled, false);
  a.equal(page.get('#restart-hint').hidden, true);
  page.get('#restart').click();
  a.equal(page.get('#reset-dialog').open, true);
  page.get('#cancel-reset').click();
  a.equal(page.get('#restart').disabled, false);
  page.get('#restart').click();
  page.get('#confirm-reset').click();
  a.equal(page.get('#restart').disabled, true);
  a.equal(page.get('#q1').value, '');
  const pending = openFictionalJourney(JSON.stringify({...L.initial(42), pending:1}));
  a.equal(pending.get('#restart').disabled, false);
  const unreadable = openFictionalJourney('{unreadable local save');
  a.equal(unreadable.get('#restart').disabled, false);
});
