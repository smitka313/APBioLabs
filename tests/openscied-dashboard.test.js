const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const SaveSession = require('../openscied-save-session.js');
const source = fs.readFileSync(path.join(__dirname, '../openscied-dashboard.js'), 'utf8');
const workspaceEpochKey = 'aplab:pref:workspace-handoff:v1';
function setup(blocked = false, overrides = {}, absent = [], tracker, workshopLogic) {
  const elements = new Map(), created = [], events = {};
  function element(tag) {
    const handlers = {};
    return { tag, value: '', disabled: false, textContent: '', open: false, attrs:{},
      setAttribute(k,v) { this.attrs[k]=v; }, before() {}, after() {},
      addEventListener(type, fn) { handlers[type] = fn; },
      fire(type) { handlers[type]?.({ preventDefault() {} }); },
      showModal() { this.open = true; }, close() { this.open = false; this.fire('close'); },
      click() {}, remove() {} };
  }
  const data = { 'aplab:openscied:b3-cell-cycle:v1': '{"trials":[1]}',
    'aplab:openscied:future-activity:v1': '{"answer":"saved"}',
    'aplab:student': '{"name":"Student","period":"2"}',
    'aplab:lab05:results': '{"rate":4}', 'aplab:pref:theme': '"dark"',
    'aplab:openscied-other:keep': 'unrelated' };
  Object.assign(data, overrides);
  const workspaceEpoch = data[workspaceEpochKey] ?? null;
  const storage = blocked ? new Proxy({}, { ownKeys() { throw new Error('Storage blocked'); } }) : data;
  Object.defineProperty(data, 'getItem', { value: key => data[key] ?? null });
  Object.defineProperty(data, 'removeItem', { value: key => { delete data[key]; } });
  Object.defineProperty(data, 'setItem', { value: (key, value) => { data[key]=String(value); } });
  let mounted = '', mountOptions, blob, failBackup = false;
  const context = { document: { readyState: 'complete',
      addEventListener(type, fn) { events[type]=fn; },
      querySelector(selector) { if (absent.includes(selector)) return null; if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); },
      createElement(tag) { const el=element(tag);created.push(el);return el; }, body: { appendChild() {} } },
    Lab: {
      identity: { mount(selector, options) { mounted = selector; mountOptions = options; }, get: () => JSON.parse(data['aplab:student'] || 'null') },
      data: { workspaceEpochKey, workspaceStatus: () => blocked ? 'unavailable' :
        (data[workspaceEpochKey] ?? null) === workspaceEpoch ? 'current' : 'changed' }
    },
    localStorage: storage, window: { location:{origin:'https://biologylabbench.com'},OpenSciEdResume:tracker,OpenSciEdSaveSession:SaveSession,DNAWorkshopLogic:workshopLogic,addEventListener(type, fn) { events[type]=fn; } }, Blob,
    URL: { createObjectURL(value) { if (failBackup) throw Error('blocked download'); blob = value; return 'blob:backup'; }, revokeObjectURL() {} }, setTimeout() {} };
  vm.runInNewContext(source, context);
  return { data, created, events, el: selector => elements.get(selector), mounted, mountOptions, blob: () => blob, blockBackup: () => { failBackup = true; } };
}
test('mounts the shared sign-in and confirms an OpenSciEd-only reset', () => {
  const s = setup(), before = { ...s.data };
  assert.equal(s.mounted, '#openscied-student-identity');
  s.el('#clear-openscied-results').fire('click');
  assert.equal(s.el('#clear-openscied-dialog').open, true);
  assert.equal(s.el('#confirm-openscied-clear').disabled, true);
  s.el('#cancel-openscied-clear').fire('click');
  assert.deepEqual({ ...s.data }, before, 'cancel must preserve every saved result');
  s.el('#clear-openscied-results').fire('click');
  s.el('#openscied-erase-confirmation').value = 'erase';
  s.el('#openscied-erase-confirmation').fire('input');
  s.el('#clear-openscied-form').fire('submit');
  assert.deepEqual({ ...s.data }, before, 'incorrect confirmation cannot erase');
  s.el('#openscied-erase-confirmation').value = 'ERASE';
  s.el('#openscied-erase-confirmation').fire('input');
  assert.equal(s.el('#confirm-openscied-clear').disabled, false);
  s.el('#clear-openscied-form').fire('submit');
  assert.deepEqual(Object.keys(s.data).sort(), [...Object.keys(before).filter(k => !k.startsWith('aplab:openscied:')), SaveSession.globalKey].sort());
  for (const key of Object.keys(s.data).filter(k => k!==SaveSession.globalKey)) assert.equal(s.data[key], before[key]);
  assert.equal(s.el('#clear-openscied-dialog').open, false);
  assert.equal(s.el('#clear-openscied-results').disabled, true);
});
test('backup preserves exact values without relabeling them to the current browser identity', async () => {
  const s = setup();
  s.data['aplab:student'] = JSON.stringify({ name: 'Fictional Other Student', period: '3' });
  const before = { ...s.data };
  s.el('#download-openscied-results').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.equal(payload.student, null);
  assert.doesNotMatch(JSON.stringify(payload), /Fictional Other Student/);
  assert.equal(payload.format, 'openscied-saved-work-v1');
  assert.deepEqual(payload.work, Object.fromEntries(Object.entries(before).filter(([k]) => k.startsWith('aplab:openscied:'))));
  assert.deepEqual({ ...s.data }, before);
});
test('backup indexes exact activity report IDs without attributing a shared archive to the active student', async () => {
  const known={
    'aplab:openscied:b1-ripple:v1': JSON.stringify({v:1,seed:0}),
    'aplab:openscied:b4-junco:v1': JSON.stringify({v:1,notebookSeed:0x7f1}),
    'aplab:openscied:b5-hybrid:v1': JSON.stringify({v:1,id:'FE8D9975'}),
    'aplab:openscied:b5-speciation:v1': JSON.stringify({v:1,id:'BAD-ID'}),
    'aplab:openscied:b5-wapusk:v1': '{"v":1,'
  };
  const s=setup(false,known);
  s.el('#download-openscied-results').fire('click');
  const archive=JSON.parse(await s.blob().text());
  assert.equal(archive.format,'openscied-saved-work-v1');
  assert.equal(archive.archiveRevision,2);
  assert.equal(archive.scope,'browser');
  assert.equal(archive.student,null);
  assert.deepEqual(archive.datasetIds,{ripple:'SR-00000000',junco:'JU-000007F1','bear-hybrid':'HY-FE8D9975'});
  for(const [key,raw] of Object.entries(known)) assert.equal(archive.work[key],raw);
});
test('browser backup is explained without attributing mixed work to one student', () => {
  const html=fs.readFileSync(path.join(__dirname,'../openscied-dashboard.html'),'utf8');
  assert.match(html,/id="download-openscied-results" aria-describedby="openscied-backup-help"/);
  assert.match(html,/id="openscied-backup-help"[^>]*>[^<]*more than one student[^<]*Preview report/);
});
test('blocked browser storage disables actions and explains the problem', () => {
  const s = setup(true);
  assert.equal(s.el('#clear-openscied-results').disabled, true);
  assert.equal(s.el('#download-openscied-results').disabled, true);
  assert.match(s.el('#openscied-results-status').textContent, /cannot access saved work/);
});
test('progress counts saved rounds, trial sets, and written answers; resume targets the saved section', () => {
  const saved = { v: 1, game: { round: 2, roundResults: { 1: { divisions: 1 } } },
    trials: [{}, {}, {}, {}, {}, {}], fields: { 'analysis-design': 'Controlled settings',
      'analysis-variation': 'Repeated trials', explanation: 'Longer time', 'model-prediction': '   ' },
    lastSection: 'analyze', lastVisitedAt: 123 };
  const s = setup(false, { 'aplab:openscied:b3-cell-cycle:v1': JSON.stringify(saved) });
  assert.match(s.el('#cell-cycle-progress').textContent, /Round 1 complete.*2 trial sets saved.*3 of 31 responses/);
  assert.equal(s.el('#openscied-resume').hidden, false);
  assert.equal(s.el('#openscied-resume-link').href, 'openscied-b3-cell-cycle.html#analyze');
});
test('legacy saves resume at the relevant section and saved strings cannot change the destination', () => {
  const s = setup(false, { 'aplab:openscied:b3-cell-cycle:v1': JSON.stringify({ v: 1,
    game: { round: 1 }, lastSection: '//untrusted.example', fields: {} }) });
  assert.equal(s.el('#openscied-resume-link').href, 'openscied-b3-cell-cycle.html#cell-game');
  assert.match(s.el('#cell-cycle-progress').textContent, /Round 1 in progress/);
});
test('per-activity restart preserves other OpenSciEd activities and offers a scoped backup', async () => {
  const s = setup(), before = { ...s.data };
  s.el('#cell-cycle-reset').fire('click');
  assert.match(s.el('#clear-openscied-title').textContent, /Restart Cell Cycle/);
  s.el('#backup-before-openscied-clear').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.deepEqual(Object.keys(payload.work), ['aplab:openscied:b3-cell-cycle:v1']);
  s.el('#openscied-erase-confirmation').value = 'ERASE';
  s.el('#clear-openscied-form').fire('submit');
  assert.equal(s.data['aplab:openscied:b3-cell-cycle:v1'], undefined);
  const marker = SaveSession.scopeKey('b3-cell-cycle');
  assert.ok(s.data[marker]);
  for (const key of Object.keys(s.data).filter(k => k!==marker)) assert.equal(s.data[key], before[key]);
  assert.equal(s.el('#cell-cycle-reset').disabled, true);
  assert.equal(s.el('#openscied-resume').hidden, true);
  assert.equal(s.el('#cell-cycle-progress').textContent, 'Not started');
});
test('unreadable work stays downloadable and resettable without showing a misleading Resume link', () => {
  const s = setup(false, { 'aplab:openscied:b3-cell-cycle:v1': '{broken json' });
  assert.match(s.el('#cell-cycle-progress').textContent, /could not be read/);
  assert.equal(s.el('#openscied-resume').hidden, true);
  assert.equal(s.el('#cell-cycle-reset').disabled, false);
});

test('Carbon Journey resumes the saved page and counts its actual rolls and answers', () => {
  const s = setup(false, { 'aplab:openscied:b2-carbon-journey:v1': JSON.stringify({version:2,rows:[{},{}],answers:{q2:'Fire added carbon',q4:'My atom story',q5:'   '},lastSection:'sense',lastVisitedAt:999}) });
  assert.match(s.el('#carbon-journey-progress').textContent,/2 rolls recorded.*2 of 5 responses/);
  assert.equal(s.el('#carbon-journey-open').href,'openscied-b2-carbon-journey.html#sense');
  assert.equal(s.el('#openscied-resume-link').href,'openscied-b2-carbon-journey.html#sense');
});
test('Carbon Journey backup includes readable answers as well as the original save', async () => {
  const s = setup(false, { 'aplab:openscied:b2-carbon-journey:v1': JSON.stringify({version:1,rows:[],answers:{q4:'My atom story'}}) });
  s.el('#download-openscied-results').fire('click');
  const payload=JSON.parse(await s.blob().text());
  assert.equal(payload.responses['carbon-journey'].q4,'My atom story');
  assert.ok(payload.work['aplab:openscied:b2-carbon-journey:v1']);
});
test('Carbon Journey restart removes only that activity', () => {
  const s = setup(false, { 'aplab:openscied:b2-carbon-journey:v1': JSON.stringify({version:2,rows:[{}],answers:{}}) });
  s.el('#carbon-journey-reset').fire('click');
  assert.match(s.el('#clear-openscied-title').textContent,/Restart Carbon Atom Journey/);
  s.el('#openscied-erase-confirmation').value='ERASE';s.el('#clear-openscied-form').fire('submit');
  assert.equal(s.data['aplab:openscied:b2-carbon-journey:v1'],undefined);
  assert.ok(s.data['aplab:openscied:b3-cell-cycle:v1']);
});

const serengetiKey = 'aplab:openscied-b1-serengeti:preview-v1';
const nearSerengetiKey = 'aplab:openscied-b1-serengeti:do-not-touch';
const serengetiSaved = JSON.stringify({v:1,game:{version:1,season:1,step:'hunt',log:[{},{}]},
  answers:{question:'Does group size matter?',evidence:'0',claim:'The group survived.',limits:' '},page:'analyze',lastVisitedAt:100});

test('Unit 1 precedes Units 2 and 3 with a linked original Serengeti illustration', () => {
  const page = fs.readFileSync(path.join(__dirname, '../openscied-dashboard.html'), 'utf8');
  assert.deepEqual([...page.matchAll(/<section class="dashboard-unit current" aria-labelledby="(unit\d+)">/g)].map(m=>m[1]),
    ['unit1','unit2','unit3','unit4','unit5']);
  assert.equal((page.match(/id="unit1"/g)||[]).length,1);
  assert.match(page, /<h2 id="unit5"[\s\S]*?b-5-common-ancestry-speciation\/[\s\S]*?id="wapusk-open"/);
  const unit = page.split('<section class="dashboard-unit current" aria-labelledby="unit1">')[1].split('</section>')[0];
  assert.match(unit, /href="openscied-b1-serengeti\.html"[^>]*><img src="assets\/openscied-atlas-b1-serengeti\.svg" width="960" height="600"/);
  assert.match(unit, /id="serengeti-open"[^>]*href="openscied-b1-serengeti\.html"/);
  const preview = fs.readFileSync(path.join(__dirname,'../assets/openscied-atlas-b1-serengeti.svg'),'utf8');
  const root = preview.match(/<svg\b[^>]*>/i)?.[0] || '';
  assert.match(root, /\bxmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/);
  assert.match(root, /\bviewBox=["']0 0 960 600["']/);
  assert.match(root, /\bwidth=["']960["']/);
  assert.match(root, /\bheight=["']600["']/);
  assert.doesNotMatch(preview, /<(?:[\w.-]+:)?(?:image|feImage)\b|data:image\//i, 'the preview is original vector artwork, not an embedded image');
  assert.ok((preview.match(/<(?:path|circle|ellipse|rect|polygon)\b/g)||[]).length>12, 'the asset contains the actual vector drawing');
});

test('DNA Workshop comes before DNA Copying and saves a resumable local practice record', async () => {
  const p = fs.readFileSync(path.join(__dirname, '../openscied-dashboard.html'), 'utf8');
  const unit = p.split('aria-labelledby="unit3">')[1]?.split('</section>')[0] || '';
  assert.deepEqual([...unit.matchAll(/class="dashboard-preview" href="([^"]+)"/g)].map(m=>m[1]),[
    'openscied-b3-cancer-rates.html','openscied-b3-screening.html','openscied-b3-cell-cycle.html','openscied-b3-dna-workshop.html','openscied-b3-dna-p53.html','openscied-b3-inheritance-environment.html'
  ]);
  const key='aplab:openscied:b3-dna-workshop:v1';
  const raw=JSON.stringify({v:1,step:'copy',progress:{v:1,placed:{'pair-1':'A','pair-2':'C'}},answers:{build:'One new strand.'},lastVisitedAt:1800000000000});
  const s=setup(false,{[key]:raw});
  assert.equal(s.el('#dna-workshop-progress').textContent,'2 pieces placed · 1 response saved');
  assert.equal(s.el('#dna-workshop-open').href,'openscied-b3-dna-workshop.html#copy');
  assert.equal(s.el('#openscied-resume-link').href,'openscied-b3-dna-workshop.html#copy');
  s.el('#dna-workshop-reset').fire('click');
  s.el('#backup-before-openscied-clear').fire('click');
  const payload=JSON.parse(await s.blob().text());
  assert.deepEqual(payload.work,{[key]:raw});
  assert.equal(payload.responses['dna-workshop'].build,'One new strand.');
  const primer=JSON.stringify({v:1,step:'nucleotide',progress:{v:1,placed:{'nucleotide-sugar':'deoxyribose'}},answers:{nucleotide:'Sugar, phosphate, and a base.'},lastVisitedAt:1800000001000});
  const starter=setup(false,{[key]:primer});
  assert.equal(starter.el('#dna-workshop-open').href,'openscied-b3-dna-workshop.html#nucleotide');
  assert.equal(starter.el('#dna-workshop-progress').textContent,'1 piece placed · 1 response saved');
});

test('dashboard loads the codon wheel first and counts a seeded long Workshop board', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'openscied-dashboard.html'), 'utf8');
  const links = [...html.matchAll(/<script\b[^>]*\bsrc="([^"?]+)(?:\?[^"]*)?"[^>]*>/g)]
    .map(match => ({name: match[1], tag: match[0]}));
  const wheelAt = links.findIndex(script => script.name === 'openscied-b3-dna-workshop-codon-wheel.js');
  const logicAt = links.findIndex(script => script.name === 'openscied-b3-dna-workshop-logic.js');
  const dashboardAt = links.findIndex(script => script.name === 'openscied-dashboard.js');
  assert.ok(wheelAt >= 0 && wheelAt < logicAt && logicAt < dashboardAt,
    'the same reference table used by the Workshop model is available before dashboard startup');
  const required = [links[wheelAt], links[logicAt], links[dashboardAt]];
  const deferred = script => /\bdefer\b/i.test(script.tag);
  for (const [i, script] of required.entries()) {
    assert.doesNotMatch(script.tag, /\basync\b/i, 'the model and dashboard do not load out of order');
    if (i > 0 && deferred(required[i-1])) assert.ok(deferred(script), 'a dependent script cannot run before its deferred dependency');
  }
  const window = vm.createContext({});
  for (const script of required.slice(0, 2)) {
    vm.runInContext(fs.readFileSync(path.join(root, script.name), 'utf8'), window);
  }
  const logic = window.DNAWorkshopLogic;
  assert.ok(logic, 'the real browser model loads without a CommonJS require');
  const seed = logic.create(4471);
  const translation = logic.stage('chain', seed);
  assert.equal(translation.slots.length, 9);
  const record = {
    v: 1, step: 'chain', lastVisitedAt: Date.now(), answers: {},
    progress: {...seed, placed: Object.fromEntries(translation.slots.map(slot => [slot.id, slot.expected]))},
  };
  const s = setup(false, {'aplab:openscied:b3-dna-workshop:v1': JSON.stringify(record)}, [], null, logic);
  const meter = s.created.find(el => el.tag === 'progress' && el.attrs['aria-label']?.startsWith('DNA Workshop:'));
  assert.equal(meter?.attrs['aria-valuetext'], '1 of 6 workshop practices completed');
  assert.equal(s.el('#dna-workshop-progress').textContent, '9 pieces placed');
  assert.equal(s.el('#dna-workshop-open').href, 'openscied-b3-dna-workshop.html#chain');
});

test('Unit 4 shows Hawksbeard, Rat Generations, then Junco, with a real curriculum link for Unit 5', () => {
  const page = fs.readFileSync(path.join(__dirname, '../openscied-dashboard.html'), 'utf8');
  const heading = '<section class="dashboard-unit current" aria-labelledby="unit4">';
  const unit = page.split(heading)[1]?.split('</section>')[0] || '';
  assert.equal((page.match(/id="unit4"/g)||[]).length, 1);
  assert.match(unit, /<h2 id="unit4"[^>]*>Unit 4 · Natural Selection &amp; Evolution of Populations<\/h2>/);
  assert.match(unit, /<span class="dashboard-tag">4 activities available<\/span>/);
  assert.equal((unit.match(/<article class="dashboard-activity">/g)||[]).length, 4);
  assert.match(unit, /href="openscied-b4-hawksbeard\.html"[^>]*><img src="assets\/openscied-atlas-b4-hawksbeard\.svg" width="960" height="600"/);
  assert.match(unit, /id="hawksbeard-open"[^>]*href="openscied-b4-hawksbeard\.html"/);
  assert.match(unit, /href="openscied-b4-rat-generations\.html"[^>]*><img src="assets\/openscied-atlas-b4-rat-generations\.svg" width="960" height="600"/);
  assert.ok(unit.indexOf('id="hawksbeard-open"') < unit.indexOf('id="rat-generations-open"'));
  assert.match(unit, /href="openscied-b4-junco\.html"[^>]*><img src="assets\/openscied-atlas-b4-junco\.svg" width="960" height="600"/);
  assert.ok(unit.indexOf('id="rat-generations-open"') < unit.indexOf('id="junco-open"'));
  assert.match(unit, /href="openscied-b4-wildlife-corridor\.html"[^>]*><img src="assets\/openscied-atlas-b4-wildlife-corridor\.svg" width="960" height="600"/);
  assert.match(unit, /id="wildlife-corridor-open"[^>]*href="openscied-b4-wildlife-corridor\.html"/);
  assert.ok(unit.indexOf('id="junco-open"') < unit.indexOf('id="wildlife-corridor-open"'));
  assert.match(page, /<h2 id="unit5"[\s\S]*?b-5-common-ancestry-speciation\/[\s\S]*?id="wapusk-open"/);
  assert.doesNotMatch(page, /<details class="dashboard-coming-soon">/);
});

test('Wildlife Corridor tracks real work, resumes without a hash, and preserves both raw and readable work in scoped backups', async () => {
  const key='aplab:openscied:b4-wildlife-corridor:v1', file='openscied-b4-wildlife-corridor.html';
  const base={v:1,model:'Aa',seed:4892,step:'predict',prediction:null,generations:{baseline:0,corridor:0},
    crossing:-1,claim:'',limits:'',finished:false,lastVisitedAt:1800000000000};
  const state = input => setup(false,{[key]:JSON.stringify(input)});
  const empty=state(base);
  assert.equal(empty.el('#wildlife-corridor-progress').textContent,'Not started');
  assert.equal(empty.el('#wildlife-corridor-reset').disabled,true,'an untouched record is not progress to reset');
  const partial=state({...base,step:'model',prediction:{choice:'connected',reason:'Gene versions can mix.'},
    generations:{baseline:8,corridor:4},crossing:1});
  assert.match(partial.el('#wildlife-corridor-progress').textContent,/Prediction saved.*First comparison: 8 of 8.*Crossing trial: 4 of 8/);
  assert.equal(partial.el('#wildlife-corridor-open').href,file);
  assert.equal(partial.el('#openscied-resume-link').href,file);
  const saved={...base,step:'explain',prediction:{choice:'connected',reason:'Gene versions can mix.'},
    generations:{baseline:8,corridor:8},crossing:1,claim:'The west and east frequencies converged.',limits:'This does not measure real animals.',finished:true};
  const invalid=state({...saved,crossing:-1});
  assert.doesNotMatch(invalid.el('#wildlife-corridor-progress').textContent,/Investigation complete/);
  const earlierPreview=state({...saved,model:undefined});
  assert.equal(earlierPreview.el('#wildlife-corridor-progress').textContent,'Not started');
  const finished=state(saved);
  assert.equal(finished.el('#wildlife-corridor-progress').textContent,'Investigation complete');
  finished.el('#wildlife-corridor-reset').fire('click');
  finished.el('#backup-before-openscied-clear').fire('click');
  const payload=JSON.parse(await finished.blob().text());
  assert.deepEqual(payload.work,{[key]:JSON.stringify(saved)});
  assert.equal(payload.student,null);
  assert.deepEqual(payload.responses['wildlife-corridor'],{claim:saved.claim,limits:saved.limits,
    prediction:saved.prediction.choice,predictionReason:saved.prediction.reason});
  finished.el('#openscied-erase-confirmation').value='ERASE';
  finished.el('#clear-openscied-form').fire('submit');
  assert.equal(finished.data[key],undefined);
  assert.ok(finished.data['aplab:openscied:b3-cell-cycle:v1']);
});

test('corridor resume dates follow changes to evidence, not view-only movement', () => {
  const resume=require('../openscied-resume.js');
  const slug='b4-wildlife-corridor', path='/openscied-'+slug+'.html', key='aplab:openscied:'+slug+':v1';
  assert.equal(resume.route(path),slug);
  let now=5000;
  const data=new Map();
  const tracker=resume.connect({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},()=>now);
  const original={v:1,lastVisitedAt:4000,step:'model',generations:{baseline:2,corridor:0}};
  data.set(key,JSON.stringify(original));
  assert.equal(tracker.snapshot(path,'open').changed,4000);
  now=6000;
  data.set(key,JSON.stringify({...original,lastVisitedAt:now,step:'predict'}));
  assert.equal(tracker.snapshot(path,'exit').changed,4000);
  now=7000;
  data.set(key,JSON.stringify({...original,lastVisitedAt:now,generations:{baseline:3,corridor:0}}));
  assert.equal(tracker.snapshot(path,'exit').changed,7000);
});

test('Hawksbeard continues the saved phase and includes its written answers in a scoped restart backup', async () => {
  const key = 'aplab:openscied:b4-hawksbeard:v1';
  const save = JSON.stringify({v:1,seed:12,prediction:'city',released:5,lastSection:'explain',lastVisitedAt:1740000000000,
    answers:{reflection:'I kept my prediction after comparing 2/9 and 2/5.',claim:'The landings differ.',evidence:'I compared both sites.',limits:'  '}});
  const fresh = setup();
  assert.equal(fresh.el('#hawksbeard-open').href,'openscied-b4-hawksbeard.html');
  assert.equal(fresh.el('#hawksbeard-progress').textContent,'Not started');
  assert.equal(fresh.el('#hawksbeard-reset').disabled,true);
  const s = setup(false,{[key]:save});
  assert.equal(s.el('#hawksbeard-progress').textContent,'5 of 5 plant pairs released · 3 of 4 responses saved');
  assert.equal(s.el('#hawksbeard-open').href,'openscied-b4-hawksbeard.html#explain');
  assert.equal(s.el('#openscied-resume-link').href,'openscied-b4-hawksbeard.html#explain');
  assert.equal(s.el('#hawksbeard-reset').disabled,false);
  s.el('#hawksbeard-reset').fire('click');
  s.el('#backup-before-openscied-clear').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.deepEqual(payload.work,{[key]:save});
  assert.equal(payload.responses.hawksbeard.reflection,'I kept my prediction after comparing 2/9 and 2/5.');
  assert.equal(payload.responses.hawksbeard.claim,'The landings differ.');
  assert.equal(payload.responses.hawksbeard.evidence,'I compared both sites.');
  s.el('#openscied-erase-confirmation').value='ERASE';
  s.el('#clear-openscied-form').fire('submit');
  assert.equal(s.data[key],undefined);
  assert.equal(s.el('#hawksbeard-open').href,'openscied-b4-hawksbeard.html');
  assert.ok(s.data['aplab:openscied:b3-cell-cycle:v1'],'an activity-only reset preserves other OpenSciEd work');
});

test('Rat Generations resumes the saved stage and exports the prediction and written evidence', async () => {
  const key = 'aplab:openscied:b4-rat-generations:v1';
  const raw = JSON.stringify({v:1,seed:5,step:'explain',action:6,lastVisitedAt:1800000000000,prediction:'increase',analysisChecked:true,
    answers:{reason:'I predict a change.',claim:'The survivors were not a random subset.'}});
  const s = setup(false,{[key]:raw});
  assert.equal(s.el('#rat-generations-open').href,'openscied-b4-rat-generations.html#explain');
  assert.equal(s.el('#openscied-resume-link').href,'openscied-b4-rat-generations.html#explain');
  assert.equal(s.el('#rat-generations-progress').textContent,'6 of 6 model actions recorded · 2 of 4 responses saved');
  s.el('#rat-generations-reset').fire('click');
  s.el('#backup-before-openscied-clear').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.deepEqual(payload.work,{[key]:raw});
  assert.equal(payload.responses['rat-generations'].prediction,'increase');
  assert.equal(payload.responses['rat-generations'].claim,'The survivors were not a random subset.');
});

test('Serengeti progress sees the existing preview save and resumes without a conflicting hash', () => {
  const s = setup(false, {[serengetiKey]:serengetiSaved});
  assert.match(s.el('#serengeti-progress').textContent,/Spring turn.*2 evidence entries.*1 of 2 explanations/);
  assert.equal(s.el('#serengeti-open').href,'openscied-b1-serengeti.html');
  assert.equal(s.el('#openscied-resume-link').href,'openscied-b1-serengeti.html');
  assert.equal(s.el('#serengeti-reset').disabled,false);
  const broken = setup(false,{[serengetiKey]:'{}'});
  assert.match(broken.el('#serengeti-progress').textContent,/could not be read/);
  assert.equal(broken.el('#serengeti-reset').disabled,false,'a bad save can still be downloaded or reset via confirmation');
});

test('dashboard backups and OpenSciEd-only clearing include the exact Serengeti key, not neighboring names', async () => {
  const s = setup(false, {[serengetiKey]:serengetiSaved,[nearSerengetiKey]:'separate local data'});
  s.el('#download-openscied-results').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.equal(payload.work[serengetiKey],serengetiSaved);
  assert.equal(payload.work[nearSerengetiKey],undefined);
  assert.equal(payload.responses.serengeti.claim,'The group survived.');
  assert.equal(payload.responses.serengeti.evidence,'0');
  s.el('#clear-openscied-results').fire('click');
  s.el('#openscied-erase-confirmation').value='ERASE';
  s.el('#clear-openscied-form').fire('submit');
  assert.equal(s.data[serengetiKey],undefined);
  assert.equal(s.data[nearSerengetiKey],'separate local data');
  assert.ok(s.data['aplab:lab05:results']);
});
test('a Serengeti-only restart provides a scoped backup and preserves other saved work', async () => {
  const s = setup(false, {[serengetiKey]:serengetiSaved,[nearSerengetiKey]:'keep'});
  s.el('#serengeti-reset').fire('click');
  assert.match(s.el('#clear-openscied-title').textContent,/Restart Serengeti Board Game/);
  s.el('#backup-before-openscied-clear').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.deepEqual(Object.keys(payload.work),[serengetiKey]);
  s.el('#openscied-erase-confirmation').value='ERASE';
  s.el('#clear-openscied-form').fire('submit');
  assert.equal(s.data[serengetiKey],undefined);
  assert.ok(s.data['aplab:openscied:b3-cell-cycle:v1']);
  assert.equal(s.data[nearSerengetiKey],'keep');
});


test('Cancer Rates Data Dive resumes, backs up its prediction and comparison, and resets only its own work', async () => {
  const key = 'aplab:openscied:b3-cancer-rates:v1';
  const fresh = { v:1, step:'predict', prediction:{choice:'', reason:'', locked:false}, evidence:[], claim:'', limits:'', completed:false };
  const starter = setup(false, { [key]:JSON.stringify(fresh) });
  assert.equal(starter.el('#cancer-rates-progress').textContent, 'Not started');
  assert.equal(starter.el('#cancer-rates-open').href, 'openscied-b3-cancer-rates.html');
  assert.equal(starter.el('#openscied-resume').hidden, true);
  const saved = { ...fresh, step:'explain', lastVisitedAt:1800000000000, completed:true,
    prediction:{choice:'different', reason:'The groups may differ.', locked:true},
    casework:{notes:{diagnoses:'A note',deaths:'B note',map:'C note'},access:'falling',diagnosis:'rising','test-cost':'longer',
      question:'How does place compare?',opened:true},
    evidence:[{view:'states', measure:'incidence', a:'MI', b:'OH'}], claim:'I compared two rates.', limits:'These are population data.' };
  const raw = JSON.stringify(saved);
  const s = setup(false, { [key]:raw });
  assert.equal(s.el('#cancer-rates-progress').textContent, 'Investigation complete · Investigation question saved · 1 pinned comparison · 2 of 2 responses saved');
  assert.equal(s.el('#cancer-rates-open').href, 'openscied-b3-cancer-rates.html#explain');
  assert.equal(s.el('#openscied-resume-link').href, 'openscied-b3-cancer-rates.html#explain');
  s.el('#download-openscied-results').fire('click');
  const whole = JSON.parse(await s.blob().text());
  assert.equal(whole.work[key], raw);
  s.el('#cancer-rates-reset').fire('click');
  s.el('#backup-before-openscied-clear').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.deepEqual(payload.work, { [key]:raw });
  assert.deepEqual(payload.responses['cancer-rates'], {
    claim:saved.claim, limits:saved.limits, prediction:saved.prediction.choice, predictionReason:saved.prediction.reason,
    investigationQuestion:saved.casework.question,exhibitObservations:{A:'A note',B:'B note',C:'C note'}
  });
  s.el('#openscied-erase-confirmation').value = 'ERASE';
  s.el('#clear-openscied-form').fire('submit');
  assert.equal(s.data[key], undefined);
  assert.ok(s.data['aplab:openscied:future-activity:v1']);
  assert.ok(s.data['aplab:lab05:results']);
  assert.equal(s.el('#cancer-rates-progress').textContent, 'Not started');
});

test('a cached dashboard without the Cancer Rates card keeps existing cards and saves usable', () => {
  const absent = ['progress','open','reset'].map(suffix=> '#cancer-rates-'+suffix);
  const s = setup(false, {}, absent);
  assert.equal(s.el('#migration-open').href, 'openscied-b1-migration.html');
  assert.equal(s.el('#dna-workshop-progress').textContent, 'Not started');
  assert.equal(s.el('#download-openscied-results').disabled, false);
});

test('case evidence checks and a question draft are resumable before a comparison is pinned', () => {
  const key = 'aplab:openscied:b3-cancer-rates:v1';
  const base = { step:'predict', evidence:[], prediction:{choice:'same',locked:true}, lastVisitedAt:1800000000000 };
  const partial = setup(false,{[key]:JSON.stringify({...base,casework:{access:'falling',screening:'rising','race-stage':'higher','rural-stage':'higher'}})});
  assert.match(partial.el('#cancer-rates-progress').textContent,/1 of 6 exhibits complete/);
  assert.equal(partial.el('#openscied-resume-link').href,'openscied-b3-cancer-rates.html#cr-income-cards');
  const sixthOnly = setup(false,{[key]:JSON.stringify({...base,casework:{'test-cost':'longer'}})});
  assert.match(sixthOnly.el('#cancer-rates-progress').textContent,/1 of 6 exhibits complete/);
  assert.equal(sixthOnly.el('#openscied-resume-link').href,'openscied-b3-cancer-rates.html#cr-income-cards');
  const draft = setup(false,{[key]:JSON.stringify({...base,casework:{access:'falling',diagnosis:'rising',questionDraft:'Which groups were diagnosed earlier?'}})});
  assert.match(draft.el('#cancer-rates-progress').textContent,/Question draft saved/);
  assert.equal(draft.el('#openscied-resume-link').href,'openscied-b3-cancer-rates.html#cr-income-cards');
});

test('a submitted case question resumes Explore and is included in readable backup responses', async () => {
  const key = 'aplab:openscied:b3-cancer-rates:v1';
  const question = 'How does stage at diagnosis differ by place?';
  const raw = JSON.stringify({step:'explore',evidence:[],prediction:{choice:'different',locked:true},lastVisitedAt:1800000000000,
    casework:{notes:{diagnoses:'A note',deaths:'B note',map:'C note'},access:'falling',diagnosis:'rising','test-cost':'longer',question,opened:true}});
  const s = setup(false,{[key]:raw});
  assert.match(s.el('#cancer-rates-progress').textContent,/Investigation question saved/);
  assert.equal(s.el('#openscied-resume-link').href,'openscied-b3-cancer-rates.html#explore');
  s.el('#download-openscied-results').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.equal(payload.responses['cancer-rates'].investigationQuestion,question);
  assert.deepEqual(payload.responses['cancer-rates'].exhibitObservations,{A:'A note',B:'B note',C:'C note'});
  assert.equal(payload.work[key],raw);
});


test('Junco resumes its supported step and backs up prediction and written evidence without clearing other activities', async () => {
  const key = 'aplab:openscied:b4-junco:v1';
  const blank = setup(false,{[key]:JSON.stringify({step:'field',prediction:' ',revealed:false})});
  assert.equal(blank.el('#junco-progress').textContent,'Not started');
  assert.equal(blank.el('#junco-open').href,'openscied-b4-junco.html');
  const saved = {step:'cort',prediction:'same',revealed:true,claim:'The aviary compared birds in shared conditions.',
    limits:'Early experience can still matter.',lastVisitedAt:1800000000000};
  const raw = JSON.stringify(saved);
  const s = setup(false,{[key]:raw});
  assert.equal(s.el('#junco-open').href,'openscied-b4-junco.html#cort');
  assert.equal(s.el('#openscied-resume-link').href,'openscied-b4-junco.html#cort');
  assert.equal(s.el('#junco-progress').textContent,'Stress hormone evidence · Aviary results viewed · 2 of 2 responses written');
  s.el('#junco-reset').fire('click');
  s.el('#backup-before-openscied-clear').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.deepEqual(payload.work,{[key]:raw});
  assert.deepEqual(payload.responses.junco,{prediction:saved.prediction,claim:saved.claim,limits:saved.limits});
  s.el('#openscied-erase-confirmation').value='ERASE';
  s.el('#clear-openscied-form').fire('submit');
  assert.equal(s.data[key],undefined);
  assert.ok(s.data['aplab:openscied:b3-cell-cycle:v1']);
  assert.ok(s.data['aplab:lab05:results']);
  const unknown=setup(false,{[key]:JSON.stringify({...saved,step:'https://example.invalid/'})});
  assert.equal(unknown.el('#junco-open').href,'openscied-b4-junco.html#cort');
});

test('navigation, default records and empty scenes do not make Resume appear', () => {
  const lastVisitedAt=1750000000000;
  const raw = obj=>JSON.stringify({v:1,lastVisitedAt,...obj});
  const s=setup(false,{
    'aplab:openscied:b1-migration:v1':raw({month:1,visited:[0,1],notes:[],observations:{},answers:{}}),
    'aplab:openscied:b3-cell-cycle:v1':raw({lastSection:'analyze',game:{round:0,roundResults:{}},trials:[],fields:{}}),
    'aplab:openscied:b3-dna-p53:v1':raw({lastSection:'wrapup',fields:{},fork:{steps:{unwound:false,unzipped:false},stage:'wound'},expression:{runs:[]}}),
    'aplab:openscied:b3-inheritance-environment:v1':raw({lastSection:'passing',fields:{},pedigree:{guesses:{},view:'chromosome'},planner:{conditions:[],controls:[]}}),
    'aplab:openscied:b2-fires:v1':raw({lastSection:'cards',fields:{},cards:{placed:{},solved:false}}),
    'aplab:openscied:b2-peat-bog:v1':raw({lastSection:'bog',settings:{tilt:23.44,temp:10,co2:420,o2:21,wet:75,burn:0},trials:[]}),
    'aplab:openscied:b2-burn-lab:v1':raw({lastSection:'fuel',fields:{},burn:{records:[]}}),
    'aplab:openscied:b2-carbon-journey:budget:v1':raw({position:0,furthest:0,prediction:'',explanation:''}),
    'aplab:openscied:b4-junco:v1':raw({step:'aviary',prediction:'',revealed:false,sim:{serial:0,results:[]}})
  });
  for(const id of ['migration','cell-cycle','dna-p53','inh-env','b2-fires','peat-bog','b2-burn','carbon-journey','junco']){
    assert.equal(s.el('#'+id+'-progress').textContent,'Not started',id);
  }
  assert.equal(s.el('#openscied-resume').hidden,true);
  assert.equal(s.el('#carbon-journey-reset').disabled,true);
  const inactive=s.created.filter(el=>el.tag==='progress' && !el.hidden);
  assert.ok(inactive.length>0,'fixed denominators remain visible at zero');
  assert.ok(inactive.every(el=>el.value===0));
});

test('Resume ranks changed evidence, separately shows last opened, and renders a known denominator', async () => {
  const Resume=require('../openscied-resume.js');
  const base=1700000000000;
  let now=base;
  const Tracker={...Resume,connect:store=>Resume.connect(store,()=>now)};
  const migration='aplab:openscied:b1-migration:v1', hawksbeard='aplab:openscied:b4-hawksbeard:v1';
  const prior = {v:1,month:0,page:'explore',visited:[0],notes:[],answers:{claim:'One old analysis.'},lastVisitedAt:base-2000};
  const latest = {v:1,prediction:'city',released:2,lastSection:'release',answers:{},lastVisitedAt:base-1000};
  const s=setup(false,{[migration]:JSON.stringify(prior),[hawksbeard]:JSON.stringify(latest)},[],Tracker);
  const tracker=Tracker.connect(s.data);
  const refresh=()=>s.events.pageshow();
  assert.match(s.el('#openscied-resume-link').href,/hawksbeard\.html#release$/);
  const meter=s.created.find(e=>e.tag==='progress' && e.attrs['aria-label'].includes('Hawksbeard'));
  assert.equal(meter.value,2);
  assert.equal(meter.max,5);
  const stamp=s.created.find(e=>e.tag==='time');
  assert.match(stamp.textContent,/^Saved: /);
  now+=1000;
  tracker.snapshot('/openscied-b1-migration','open');
  s.data[migration]=JSON.stringify({...prior,page:'explain',lastVisitedAt:now});
  tracker.snapshot('/openscied-b1-migration','exit');
  refresh();
  assert.match(s.el('#openscied-resume-link').href,/hawksbeard\.html#release$/,'navigation does not promote a different activity');
  now+=1000;
  s.data[migration]=JSON.stringify({...prior,page:'explain',answers:{claim:'New analysis.'},lastVisitedAt:now});
  tracker.snapshot('/openscied-b1-migration','exit');
  refresh();
  assert.match(s.el('#openscied-resume-link').href,/migration\.html#explain$/);
  assert.match(stamp.textContent,/^Last opened: /);
  assert.equal(stamp.dateTime,new Date(base+1000).toISOString());
  const ledger=s.data[Resume.META_KEY+':b1-migration'];
  assert.doesNotMatch(ledger,/analysis|claim/);
  delete s.data['aplab:student'];
  refresh();
  assert.equal(s.el('#resume-title').textContent,'Saved work on this device');
  assert.match(s.el('#openscied-resume-description').textContent,/Continue only if this work is yours/);
  assert.match(s.el('#openscied-resume-link').textContent,/^Continue my saved Migration Map Explorer/);
  s.el('#download-openscied-results').fire('click');
  const payload=JSON.parse(await s.blob().text());
  assert.equal(Object.keys(payload.work).some(Resume.isMetaKey),false,'metadata never exports as student work');
});

test('same legacy timestamps yield curriculum order; Carbon Journey v3 keeps its numbered response', async () => {
  const lastVisitedAt=1700000000000;
  const s=setup(false,{
    'aplab:openscied:b2-carbon-journey:v1':JSON.stringify({version:3,rows:[{}],answers:{q1:'A source of carbon.'},lastSection:'sense',lastVisitedAt}),
    'aplab:openscied:b4-hawksbeard:v1':JSON.stringify({v:1,prediction:'field',released:1,lastSection:'release',lastVisitedAt})
  });
  assert.match(s.el('#openscied-resume-link').href,/carbon-journey\.html#sense$/);
  s.el('#download-openscied-results').fire('click');
  assert.equal(JSON.parse(await s.blob().text()).responses['carbon-journey'].q1,'A source of carbon.');
});


test('Cancer rates requires the prediction lock and credible evidence before Resume shows completion', () => {
  const key='aplab:openscied:b3-cancer-rates:v1';
  const complete={step:'explain', completed:true, claim:'I compared the groups.', limits:'These data are observational.',
    prediction:{choice:'same',locked:true}, evidence:[{view:'states',measure:'incidence',a:'MI',b:'OH'}],
    casework:{notes:{diagnoses:'A',deaths:'B',map:'C'},access:'falling',diagnosis:'rising','test-cost':'longer',
      opened:true,question:'How do the state rates compare?'}};
  const state = v=>setup(false,{[key]:JSON.stringify({...complete,...v})});
  const draft=state({prediction:{choice:'same',locked:false}});
  assert.match(draft.el('#cancer-rates-progress').textContent,/^Prediction draft/);
  assert.match(draft.el('#openscied-resume-link').href,/#predict$/);
  const invalidPin=state({evidence:[{view:'states',measure:'incidence',a:'MI',b:'MI'}]});
  assert.doesNotMatch(invalidPin.el('#cancer-rates-progress').textContent,/Investigation complete/);
  assert.match(invalidPin.el('#openscied-resume-link').href,/#explore$/);
});

test('Fires only completes meter milestones on recorded evidence while resuming genuine unfinished work', () => {
  const key='aplab:openscied:b2-fires:v1';
  const make=(scenes={})=>setup(false,{[key]:JSON.stringify({v:1,fields:{},lastSection:'tilt',...scenes})});
  const read=(s)=>s.created.find(el=>el.tag==='progress'&&el.attrs['aria-label'].includes('Fires')).value;
  const blank=make({cards:{placed:{},solved:false},decomp:{startedAt:0,recorded:[]},tilt:{startedAt:0,recorded:false},
    modelEvidence:{cardsPlaced:0,cardsRight:0,foamReadings:0,foamAfterBaseline:false,tubesRead:0,starchTested:false}});
  assert.equal(blank.el('#openscied-resume').hidden,true);
  assert.equal(read(blank),0);
  const started=make({cards:{placed:{sugar:'in'}},decomp:{startedAt:1700000000000,recorded:[0]},tilt:{recorded:true,starchDone:false},
    modelEvidence:{cardsPlaced:1,cardsRight:1,foamReadings:1,foamAfterBaseline:false,tubesRead:3,starchTested:false}});
  assert.match(started.el('#openscied-resume-link').href,/fires\.html#tilt$/);
  assert.equal(read(started),0,'initial readings and partial work are resumable without claiming a milestone');
  const completed=make({modelEvidence:{cardsPlaced:5,cardsRight:5,foamReadings:2,foamAfterBaseline:true,foamComparison:true,tubesRead:3,tiltComparison:true,starchTested:true}});
  assert.equal(read(completed),3);
  const old=make({cards:{placed:{sugar:'in'}},decomp:{seed:7,temps:[18,27,43],recorded:[0,2]},tilt:{seed:7,settings:['direct','tilt45','foil'],recorded:true,starchDone:true}});
  assert.match(old.el('#openscied-resume-link').href,/fires\.html#tilt$/);
  assert.equal(read(old),2,'legacy observations remain measurable and resumable');
});

test('dashboard direct-card clicks prime the first trip without promoting unchanged older work', () => {
  const Resume=require('../openscied-resume.js');
  let now=1700000000000;
  const Tracker={...Resume,connect:store=>Resume.connect(store,()=>now)};
  const hawks='aplab:openscied:b4-hawksbeard:v1', migration='aplab:openscied:b1-migration:v1',
    carrying='aplab:openscied-b1-carrying-capacity:run-v1';
  const s=setup(false,{[hawks]:JSON.stringify({v:1,prediction:'city',released:2,lastVisitedAt:now-1000}),
    [migration]:JSON.stringify({v:1,month:0,visited:[],notes:[],answers:{claim:'Old idea'},lastVisitedAt:now-2000})},[],Tracker);
  const open=(pathname,origin='https://biologylabbench.com')=>s.events.click({
    button:0,target:{closest:()=>({origin,pathname})}
  });
  now+=1000;
  open('/openscied-b1-migration.html');
  s.events.pageshow();
  assert.match(s.el('#openscied-resume-link').href,/hawksbeard\.html/,'opening older unchanged work does not promote it');
  open('/openscied-b1-carrying-capacity.html','https://example.invalid');
  assert.equal(s.data[Resume.META_KEY+':b1-carrying-capacity'],undefined);
  open('/openscied-b1-carrying-capacity');
  assert.equal(JSON.parse(s.data[Resume.META_KEY+':b1-carrying-capacity']).signature,'');
  now+=4000;
  s.data[carrying]=JSON.stringify({baseline:{round:1},comparison:null,answers:{},checks:{}});
  s.events.pageshow();
  assert.match(s.el('#openscied-resume-link').href,/carrying-capacity\.html$/,'first new save without its own timestamp comes first even if page tracker did not load');
});

test('confirming a required Carbon reference card counts as work, but opening does not', () => {
  const Resume=require('../openscied-resume.js');
  let now=1700000000000;
  const carbon='aplab:openscied:b2-carbon-journey:v1', hawks='aplab:openscied:b4-hawksbeard:v1';
  const prior={version:3,rows:[{}],answers:{},coverageReviewed:[],lastSection:'play',lastVisitedAt:now-2000};
  const Tracker={...Resume,connect:store=>Resume.connect(store,()=>now)};
  const s=setup(false,{[carbon]:JSON.stringify(prior),
    [hawks]:JSON.stringify({v:1,prediction:'city',released:2,lastVisitedAt:now-1000})},[],Tracker);
  const tracker=Tracker.connect(s.data);
  now+=1000;
  tracker.snapshot('/openscied-b2-carbon-journey','open');
  s.events.pageshow();
  assert.match(s.el('#openscied-resume-link').href,/hawksbeard\.html/);
  s.data[carbon]=JSON.stringify({...prior,coverageReviewed:['ocean']});
  now+=1000;
  tracker.snapshot('/openscied-b2-carbon-journey','exit');
  s.events.pageshow();
  assert.match(s.el('#openscied-resume-link').href,/carbon-journey\.html/);
});

test('Junco offers Resume for a trial in progress, but not after canceling the first trial', () => {
  const key='aplab:openscied:b4-junco:v1';
  const active={id:1,site:'urban',group:'incubating',step:0,finished:false};
  const sim={seed:42,serial:1,site:'urban',group:'incubating',active,results:[]};
  const save=sim=>JSON.stringify({v:1,step:'field',sim});
  const s=setup(false,{'aplab:openscied:b3-cell-cycle:v1':null,[key]:save(sim)});
  assert.match(s.el('#junco-progress').textContent,/Simulated trial in progress/);
  assert.match(s.el('#openscied-resume-link').href,/junco\.html#field$/);
  s.data[key]=save({...sim,active:null});
  s.events.pageshow();
  assert.equal(s.el('#junco-progress').textContent,'Not started');
  assert.equal(s.el('#openscied-resume').hidden,true);
  assert.equal(s.el('#junco-reset').disabled,true);
});

test('Junco setup-only changes do not outrank newer saved evidence', () => {
  const Resume=require('../openscied-resume.js');
  let now=1700000000000;
  const Tracker={...Resume,connect:store=>Resume.connect(store,()=>now)};
  const key='aplab:openscied:b4-junco:v1', hawks='aplab:openscied:b4-hawksbeard:v1';
  const row={id:1,site:'urban',group:'incubating',step:3};
  const sim={seed:42,serial:1,site:'urban',group:'incubating',active:{...row,finished:true},results:[row]};
  const save=sim=>JSON.stringify({v:1,step:'field',sim,lastVisitedAt:now});
  const prior=JSON.stringify({v:1,step:'field',sim,lastVisitedAt:now-2000});
  const s=setup(false,{[key]:prior,
    [hawks]:JSON.stringify({v:1,prediction:'city',released:2,lastVisitedAt:now-1000})},[],Tracker);
  const tracker=Tracker.connect(s.data);
  assert.match(s.el('#junco-progress').textContent,/1 simulated trial/);
  // The actual activity records its baseline when it opens. A dashboard visit
  // alone no longer writes that baseline on the activity's behalf.
  tracker.snapshot('/openscied-b4-junco','open');
  now+=1000;
  s.data[key]=save({...sim,site:'mountain',group:'foraging'});
  tracker.snapshot('/openscied-b4-junco','exit');
  s.events.pageshow();
  assert.match(s.el('#openscied-resume-link').href,/hawksbeard\.html/);
  now+=1000;
  const next={id:2,site:'mountain',group:'foraging',step:0,finished:false};
  s.data[key]=save({...sim,serial:2,site:next.site,group:next.group,active:next});
  tracker.snapshot('/openscied-b4-junco','exit');
  s.events.pageshow();
  assert.match(s.el('#openscied-resume-link').href,/junco\.html#field$/,'an actual unfinished trial is resumable');
});

test('Carbon Journey keeps its required-turn meter when the optional Budget has saved work', () => {
  const carbon='aplab:openscied:b2-carbon-journey:v1', budget='aplab:openscied:b2-carbon-journey:budget:v1';
  const budgetSave={v:1,position:0,furthest:0,prediction:'I predict a difference.',explanation:'',lastVisitedAt:1};
  const s=setup(false,{[carbon]:JSON.stringify({version:3,rows:Array.from({length:10},()=>({})),
    done:true,lastSection:'evidence',lastVisitedAt:2}),[budget]:JSON.stringify(budgetSave)});
  const meter=s.created.find(el=>el.tag==='progress' && el.attrs['aria-label'].startsWith('Carbon Atom Journey'));
  assert.equal(meter.value,10);
  assert.equal(meter.max,10);
  assert.match(meter.attrs['aria-valuetext'],/required turns recorded/);
  assert.match(s.el('#carbon-journey-progress').textContent,/Journey complete.*Budget checkpoints: 0 of 8/);
  assert.match(s.el('#carbon-journey-open').href,/#evidence$/);
  s.data[budget]=JSON.stringify({...budgetSave,position:3,furthest:3,lastVisitedAt:3});
  s.events.pageshow();
  assert.match(s.el('#carbon-journey-open').href,/#budget$/,'a newer Budget save remains resumable');
  assert.equal(meter.value,10);
  delete s.data[carbon];
  s.events.pageshow();
  assert.equal(meter.value,3);
  assert.equal(meter.max,8);
  assert.match(meter.attrs['aria-valuetext'],/budget checkpoints reached/);
});

for (const [id,card] of [['b2-burn-lab','b2-burn'],['b2-fires','b2-fires']]) {
  test(id+' ranks saved claim checklist edits without counting them as answers', () => {
    const Resume=require('../openscied-resume.js');
    let now=1700000000000;
    const Tracker={...Resume,connect:store=>Resume.connect(store,()=>now)};
    const key='aplab:openscied:'+id+':v1', hawks='aplab:openscied:b4-hawksbeard:v1';
    const previous={v:1,lastSection:'peat',responseIds:['peat-prompt','cer-claim'],
      fields:{'cer-claim':'a','cer-ev-5':false,'cer-caveat':false},lastVisitedAt:now-2000};
    const s=setup(false,{[key]:JSON.stringify(previous),
      [hawks]:JSON.stringify({v:1,prediction:'city',released:2,lastVisitedAt:now-1000})},[],Tracker);
    const tracker=Tracker.connect(s.data);
    const change=fields=>{
      now+=1000;
      s.data[key]=JSON.stringify({...previous,lastVisitedAt:now,fields});
      const meta=tracker.snapshot('/openscied-'+id,'exit');
      s.events.pageshow();
      return meta.changed;
    };
    assert.match(s.el('#openscied-resume-link').href,/hawksbeard\.html/);
    const fields={...previous.fields,'cer-ev-5':true,'cer-caveat':true};
    assert.equal(change(fields),now);
    assert.match(s.el('#openscied-resume-link').href,new RegExp(id+'\\.html#peat$'));
    assert.match(s.el('#'+card+'-progress').textContent,/1 of 2 answers saved · Claim checklist saved/);
    const lastWork=now;
    assert.equal(change({...fields,'aq-unrelated-pref':'test'}),lastWork,'unrelated controls do not count');
    assert.equal(change(previous.fields),now,'unchecking a previously saved response updates the work time');
  });
  test(id+' can resume a claim checklist even if no answer or model run is saved yet', () => {
    const key='aplab:openscied:'+id+':v1';
    const s=setup(false,{'aplab:openscied:b3-cell-cycle:v1':null,
      [key]:JSON.stringify({v:1,responseIds:['cer-claim'],fields:{'cer-caveat':true}})});
    assert.equal(s.el('#openscied-resume').hidden,false);
    assert.match(s.el('#openscied-resume-link').href,new RegExp(id+'\\.html#peat$'));
    assert.match(s.el('#'+card+'-progress').textContent,/0 of 1 answers saved · Claim checklist saved/);
  });
}


test('dashboard ERASE rejects stale editors and allows a fresh editor', () => {
  const scope='b2-carbon-journey', key='aplab:openscied:'+scope+':v1';
  const s=setup(false,{[key]:JSON.stringify({version:3,rows:[{}],answers:{}})});
  const editor=SaveSession.open(s.data,scope,[key]);
  const previous=editor.read(key);
  s.el('#clear-openscied-results').fire('click');
  s.el('#openscied-erase-confirmation').value='ERASE';
  s.el('#clear-openscied-form').fire('submit');
  assert.equal(s.data[key],undefined);
  assert.equal(editor.write(key,previous).reason,'erased');
  assert.equal(s.data[key],undefined);
  const fresh=SaveSession.open(s.data,scope,[key]);
  assert.equal(fresh.write(key,previous).ok,true);
});

test('one activity reset does not invalidate a different editor or erase work in it', () => {
  const scope='b2-carbon-journey', key='aplab:openscied:'+scope+':v1', otherScope='b3-dna-workshop';
  const otherKey='aplab:openscied:'+otherScope+':v1';
  const s=setup(false,{[key]:JSON.stringify({version:3,rows:[{}],answers:{}}),[otherKey]:'{}'});
  const carbon=SaveSession.open(s.data,scope,[key]), other=SaveSession.open(s.data,otherScope,[otherKey]);
  s.el('#carbon-journey-reset').fire('click');
  s.el('#openscied-erase-confirmation').value='ERASE';
  s.el('#clear-openscied-form').fire('submit');
  assert.equal(carbon.write(key,carbon.read(key)).reason,'erased');
  assert.equal(other.write(otherKey,'{"value":"kept"}').ok,true);
  assert.equal(s.data[SaveSession.globalKey],undefined);
});

test('Lab sign-out and full reset set both non-personal guards before wiping work', () => {
  const src=fs.readFileSync(path.join(__dirname,'../lab.js'),'utf8');
  const start=src.indexOf('  function wipe(keep)');
  const end=src.indexOf('  /* The dialog. o:',start);
  assert.ok(start>=0 && end>start,'the production data-management helpers are available');
  const code=src.slice(start,end);
  const records={}, order=[];
  const localStorage=Object.defineProperties(records,{
    getItem:{value:k=>records[k]??null},
    setItem:{value(k,v){order.push(['write',k]);records[k]=v;}},
    removeItem:{value(k){order.push(['remove',k]);delete records[k];}}
  });
  const key='aplab:openscied:b2-carbon-journey:v1';
  const handoff='aplab:pref:workspace-handoff:v1', resume='aplab:pref:openscied-resume:v1';
  localStorage.setItem(key,'{}');
  const old=SaveSession.open(localStorage,'b2-carbon-journey',[key]);order.length=0;
  const sandbox={localStorage,sessionStorage:{},OPENSCIED_EPOCH_KEY:SaveSession.globalKey,
    HANDOFF_KEY:handoff,OPENSCIED_RESUME_KEY:resume,handoffEpoch:null,staleEditorMessage:'Work cleared in another tab',
    nativeRandom:Math.random,noFlush:false,wiped:false,lastStoredIdentity:null,lastEffectiveIdentity:null,
    KEEP_PREFS:['aplab:ui:','aplab:pref:'],sessionSet(){},FLASH_KEY:'flash',IS_LAB:false,location:{reload(){}},
    Lab:{toast(message){assert.fail(message);}},storedIdentity:()=>null,memIdentity:null,memBackup:null};
  sandbox.staleEditor=()=>localStorage.getItem(handoff)!==sandbox.handoffEpoch;
  vm.runInNewContext(code+'; doSignOut(); localStorage.setItem("'+key+'","{}"); doStartOverAll();',sandbox);
  const actual=order.filter(([action,k])=>k!==key||action==='remove');
  const one=[['write',SaveSession.globalKey],['write',handoff],['remove',key]];
  assert.deepEqual(actual,[...one,['remove','aplab:student'],...one]);
  assert.equal(old.write(key,'{}').reason,'erased');
  assert.equal(localStorage.getItem(key),null);
  assert.ok(localStorage.getItem(SaveSession.globalKey));
  assert.ok(localStorage.getItem(handoff));
});


test('Peat Bog shows trial collection progress without inventing completion', () => {
  const key='aplab:openscied:b2-peat-bog:v1';
  const s=setup();
  const meter=s.created.find(el=>el.tag==='progress' && el.attrs['aria-label'].startsWith('Peat Bog'));
  assert.equal(meter.max,2); assert.equal(meter.value,0);
  const trial={tilt:23.44,temp:10,co2:420,o2:21,wet:75,burn:0};
  s.data[key]=JSON.stringify({v:1,trials:[trial]}); s.events.pageshow();
  assert.equal(meter.value,1);
  s.data[key]=JSON.stringify({v:1,trials:[trial,{...trial,label:'Same inputs'}]}); s.events.pageshow();
  assert.equal(meter.value,1);
  assert.match(s.el('#peat-bog-progress').textContent,/same conditions/);
  s.data[key]=JSON.stringify({v:1,trials:[trial,{...trial},{...trial,wet:30}]}); s.events.pageshow();
  assert.equal(meter.value,2);
  assert.match(s.el('#peat-bog-progress').textContent,/3 simulated trials/);
  assert.match(meter.attrs['aria-label'],/Trials saved for a comparison/);
});


test('dashboard hands off to the guarded student-switch flow and provides standalone backup', async () => {
  const s = setup();
  const before = { ...s.data };
  assert.equal(s.mountOptions?.sharedDevice, true);
  assert.equal(s.mountOptions.downloadOpenSciEd(), true);
  const payload = JSON.parse(await s.blob().text());
  assert.equal(payload.format, 'openscied-saved-work-v1');
  assert.equal(payload.student, null);
  assert.deepEqual({ ...s.data }, before);
  s.blockBackup();
  assert.equal(s.mountOptions.downloadOpenSciEd(), false, 'the sign-out dialog can show its own failure feedback');
});

test('backup reports both outcomes inside the clear dialog without erasing anything', () => {
  const s = setup(), before = { ...s.data };
  const page = s.el('#openscied-results-status').textContent;
  s.el('#clear-openscied-results').fire('click');
  s.el('#backup-before-openscied-clear').fire('click');
  assert.match(s.el('#openscied-backup-status').textContent, /Backup download started.*not a classroom report/);
  assert.equal(s.el('#openscied-results-status').textContent, page);
  assert.deepEqual({ ...s.data }, before);
  s.blockBackup();
  s.el('#backup-before-openscied-clear').fire('click');
  assert.match(s.el('#openscied-backup-status').textContent, /Could not download.*Nothing was cleared/);
  assert.deepEqual({ ...s.data }, before);
});

test('student gets five direct unit jumps, one named card link, and no live-region chatter by card', () => {
  const html = fs.readFileSync(path.join(__dirname,'../openscied-dashboard.html'),'utf8');
  const units = html.match(/<nav class="dashboard-unit-jumps"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
  assert.deepEqual([...units.matchAll(/href="#(unit[1-5])"/g)].map(m => m[1]), ['unit1','unit2','unit3','unit4','unit5']);
  const cards = [...html.matchAll(/<article class="dashboard-activity">([\s\S]*?)<\/article>/g)].map(m=>m[1]);
  assert.equal(cards.length, 23);
  const names = cards.map(card => {
    const image = card.match(/<a class="dashboard-preview"[^>]*>/)?.[0];
    assert.match(image || '', /tabindex="-1"/);
    assert.match(image || '', /aria-hidden="true"/);
    assert.doesNotMatch(card, /role="status"/);
    return card.match(/<a[^>]*class="dashboard-open btn btn--primary"[^>]*aria-label="([^"]+)"/)?.[1];
  });
  assert.ok(names.every(name => name?.startsWith('Open activity: ')));
  assert.equal(new Set(names).size, cards.length);
  const s = setup(false, { 'aplab:openscied:b4-junco:v1': JSON.stringify({ prediction:'city' }) });
  assert.equal(s.el('#junco-open').attrs['aria-label'], 'Continue activity: Junco Investigation');
});

test('burn meter names the model milestone without a misleading assignment percentage', () => {
  const records = ['grass','leaves','wood','charcoal','peat'].map(fuel => ({ fuel }));
  const s = setup(false,{ 'aplab:openscied:b2-burn-lab:v1': JSON.stringify({v:1, burn:{records}, fields:{}}) });
  assert.ok(s.created.some(e => e.className==='dashboard-activity-metric' && e.textContent==='5 of 5 fuels with saved results'));
  assert.ok(s.created.filter(e => e.className==='dashboard-activity-metric').every(e => !e.textContent.includes('%')));
});

test('Rat Analyze saves attempts but counts completion only after a correct answer', () => {
  const key = 'aplab:openscied:b4-rat-generations:v1';
  const s = setup(false, { [key]: JSON.stringify({v:1, seed:5, prediction:'same', action:6, step:'explain', analysisAttempt:'rats', analysisChecked:false}) });
  const meter = s.created.find(e => e.tag==='progress' && e.attrs['aria-label']?.includes('Rat Generations'));
  assert.equal(meter.value, 2);
  assert.match(s.el('#rat-generations-open').href,/#analyze$/);
  const corrected = setup(false, { [key]: JSON.stringify({v:1, seed:5, prediction:'same', action:6, step:'analyze', analysisAttempt:'alleles', analysisChecked:true}) });
  assert.equal(corrected.created.find(e=>e.tag==='progress'&&e.attrs['aria-label']?.includes('Rat Generations')).value,3);
  const completed = {v:1, seed:5, prediction:'same', action:6, step:'explain', analysisAttempt:'alleles', analysisChecked:true,
    answers:{claim:'A difference',evidence:'The measured counts.',limits:'The colony model is simplified.'}};
  const final = setup(false, { [key]: JSON.stringify(completed) });
  assert.equal(final.created.find(e=>e.tag==='progress'&&e.attrs['aria-label']?.includes('Rat Generations')).value,4);
  assert.match(final.el('#rat-generations-open').href,/#explain$/);
  completed.answers.limits='  ';
  const missing = setup(false, { [key]: JSON.stringify(completed) });
  assert.equal(missing.created.find(e=>e.tag==='progress'&&e.attrs['aria-label']?.includes('Rat Generations')).value,3,
    'Blank responses do not count as complete.');
});

test('Wapusk tracks meaningful evidence, not tab browsing, and links Unit 5 independently',()=>{
  const key='aplab:openscied:b5-wapusk:v1';
  const base={v:1,id:'12345678',fields:{},step:'regions'};
  const empty=setup(false,{[key]:JSON.stringify(base)});
  assert.equal(empty.el('#wapusk-progress').textContent,'Not started');
  for(const scales of [{scaleDraft:['park']},{scaleCheck:[]}]) {
    const scaleOnly=setup(false,{[key]:JSON.stringify({...base,...scales})});
    assert.match(scaleOnly.el('#wapusk-progress').textContent,/Scale choices saved · 0 of 6/);
    assert.equal(scaleOnly.el('#wapusk-open').href,'openscied-b5-wapusk.html');
  }
  const started=setup(false,{[key]:JSON.stringify({...base,fields:{observe:'Different seasons show different places.'}})});
  assert.equal(started.el('#wapusk-progress').textContent,'1 of 6 notebook responses saved');
  assert.equal(started.el('#wapusk-open').href,'openscied-b5-wapusk.html');
});

test('Thermoregulation ignores selectors without evidence and resumes meaningful work',()=>{
  const key='aplab:openscied:b5-thermoregulation:v1',base={v:1,id:'99AA1177',fields:{},step:'treadmill',row:3,hum:Array(10).fill('')};
  const empty=setup(false,{[key]:JSON.stringify(base)});
  assert.equal(empty.el('#thermoregulation-progress').textContent,'Not started');
  const work=setup(false,{[key]:JSON.stringify({...base,fields:{pattern:'The bear took 24 breaks.'},lastVisitedAt:Date.now()-5})});
  assert.equal(work.el('#thermoregulation-progress').textContent,'1 of 5 notebook responses saved');
  assert.match(work.el('#thermoregulation-open').href,/openscied-b5-thermoregulation\.html#treadmill$/);
});

test('Bear Ancestry ignores page-only visits and resumes the latest available stage', () => {
  const key='aplab:openscied:b5-ancestry:v1', base={v:1,id:'12AB34CD',step:'explain',notes:{},prediction:null};
  const empty=setup(false,{[key]:JSON.stringify(base)});
  assert.equal(empty.el('#bear-ancestry-progress').textContent,'Not started');
  const work=setup(false,{[key]:JSON.stringify({...base,notes:{skull:'The snout is long.'},prediction:0,checked:[0,1,2]})});
  assert.equal(work.el('#bear-ancestry-progress').textContent,'2 of 4 investigation steps complete');
  assert.match(work.el('#bear-ancestry-open').href,/openscied-b5-ancestry\.html#tree$/);
});

test('Ice Age Bear Speciation derives completion from saved evidence and gates resume',()=>{
  const key='aplab:openscied:b5-speciation:v1',base={v:1,id:'12AB34CD',step:'argument',answers:{}};
  const blank=setup(false,{[key]:JSON.stringify(base)});
  assert.equal(blank.el('#bear-speciation-progress').textContent,'Not started');
  const draft=setup(false,{[key]:JSON.stringify({...base,answers:{first:'Ice could separate the two populations.'},locked:true,finished:true,pins:[0]})});
  assert.equal(draft.el('#bear-speciation-progress').textContent,'1 of 4 investigation steps complete');
  assert.match(draft.el('#bear-speciation-open').href,/openscied-b5-speciation\.html#fossils$/);
  const finished=setup(false,{[key]:JSON.stringify({...base,answers:{first:'Ice could separate populations.',fossilNote:'A minimum age.',traitNote:'Fur could affect camouflage.',revised:'Several lines of evidence.',future:'Seals depend on ice.'},locked:true,finished:true,limit:true,pins:[0,4],genes:[0,1,2],choices:{north:0,south:1}})});
  assert.equal(finished.el('#bear-speciation-progress').textContent,'4 of 4 investigation steps complete');
  const edited=JSON.parse(finished.data[key]);edited.rosterVersion=2;edited.matches={north:false,south:true};
  const retry=setup(false,{[key]:JSON.stringify(edited)});
  assert.equal(retry.el('#bear-speciation-progress').textContent,'2 of 4 investigation steps complete');
  assert.match(retry.el('#bear-speciation-open').href,/#traits$/);
  assert.match(finished.el('#bear-speciation-open').href,/openscied-b5-speciation\.html#argument$/);
});

test('Screening resumes saved cost-sheet practice without counting a district milestone',()=>{
  const key='aplab:openscied:b3-screening:v1', base={v:1,seed:419,started:false};
  assert.equal(setup(false,{[key]:JSON.stringify(base)}).el('#screening-progress').textContent,'Not started');
  const s=setup(false,{'aplab:openscied:b3-cell-cycle:v1':null,
    [key]:JSON.stringify({...base,practice:{'12:mobile:mobile:mobile:none':1},lastVisitedAt:Date.now()-10})});
  assert.equal(s.el('#screening-progress').textContent,'Practice booking saved');
  assert.equal(s.el('#openscied-resume-link').href,'openscied-b3-screening.html');
  const meter=s.created.find(e=>e.tag==='progress'&&e.attrs['aria-label']?.includes('Cancer Screening'));
  assert.equal(meter.value,0);
});


test('Inheritance counts the same choices as the activity, separately from writing and model progress', () => {
  const choices = Array.from({length:23},(_,i)=>'choice-'+(i+1));
  const other = ['prompt-a','prompt-b','prompt-c','prompt-d','prompt-e','prompt-f','prompt-g','order-meiosis-seq'];
  const fields=Object.fromEntries([...choices,...other.slice(0,5)].map(id=>[id,'saved']));
  const key='aplab:openscied:b3-inheritance-environment:v1';
  const base={v:1,fields,responseIds:[...choices,...other],lastSection:'wrapup',meiosis:{runs:[{crossing:true}]}};
  const modern={...base,choiceResponseIds:[...choices,choices[0], 'not-an-activity-response']};
  const card=s=>setup(false,{[key]:JSON.stringify(s)}).el('#inh-env-progress').textContent;
  assert.match(card(modern),/1 of 6 interactive models used · 23 of 23 choice questions answered/);
  assert.match(card({...modern,fields:{...fields,[choices[0]]:'  '}}),/22 of 23 choice questions answered/);
  assert.match(card(base),/28 of 31 answers saved \(choices and writing\)/,'legacy records still keep their work and label the combined count');
});
