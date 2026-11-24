const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../openscied-dashboard.js'), 'utf8');
function setup(blocked = false, overrides = {}, absent = []) {
  const elements = new Map();
  function element() {
    const handlers = {};
    return { value: '', disabled: false, textContent: '', open: false,
      addEventListener(type, fn) { handlers[type] = fn; },
      fire(type) { handlers[type]?.({ preventDefault() {} }); },
      showModal() { this.open = true; }, close() { this.open = false; },
      click() {}, remove() {} };
  }
  const data = { 'aplab:openscied:b3-cell-cycle:v1': '{"trials":[1]}',
    'aplab:openscied:future-activity:v1': '{"answer":"saved"}',
    'aplab:student': '{"name":"Student","period":"2"}',
    'aplab:lab05:results': '{"rate":4}', 'aplab:pref:theme': '"dark"',
    'aplab:openscied-other:keep': 'unrelated' };
  Object.assign(data, overrides);
  const storage = blocked ? new Proxy({}, { ownKeys() { throw new Error('Storage blocked'); } }) : data;
  Object.defineProperty(data, 'getItem', { value: key => data[key] ?? null });
  Object.defineProperty(data, 'removeItem', { value: key => { delete data[key]; } });
  let mounted = '', blob;
  const context = { document: { readyState: 'complete',
      querySelector(selector) { if (absent.includes(selector)) return null; if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); },
      createElement: element, body: { appendChild() {} } },
    Lab: { identity: { mount(selector) { mounted = selector; }, get: () => ({ name: 'Student', period: '2' }) } },
    localStorage: storage, window: { addEventListener() {} }, Blob,
    URL: { createObjectURL(value) { blob = value; return 'blob:backup'; }, revokeObjectURL() {} }, setTimeout() {} };
  vm.runInNewContext(source, context);
  return { data, el: selector => elements.get(selector), mounted, blob: () => blob };
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
  assert.deepEqual(Object.keys(s.data).sort(), Object.keys(before).filter(k => !k.startsWith('aplab:openscied:')).sort());
  for (const key of Object.keys(s.data)) assert.equal(s.data[key], before[key]);
  assert.equal(s.el('#clear-openscied-dialog').open, false);
  assert.equal(s.el('#clear-openscied-results').disabled, true);
});
test('backup includes exact OpenSciEd values and identity without erasing results', async () => {
  const s = setup(), before = { ...s.data };
  s.el('#download-openscied-results').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.equal(payload.student.name, 'Student');
  assert.equal(payload.format, 'openscied-saved-work-v1');
  assert.deepEqual(payload.work, Object.fromEntries(Object.entries(before).filter(([k]) => k.startsWith('aplab:openscied:'))));
  assert.deepEqual({ ...s.data }, before);
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
  for (const key of Object.keys(s.data)) assert.equal(s.data[key], before[key]);
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
    ['unit1','unit2','unit3','unit4']);
  assert.equal((page.match(/id="unit1"/g)||[]).length,1);
  assert.match(page, /<summary>Coming soon: Unit 5<\/summary>/);
  const unit = page.split('<section class="dashboard-unit current" aria-labelledby="unit1">')[1].split('</section>')[0];
  assert.match(unit, /href="openscied-b1-serengeti\.html"[^>]*><img src="assets\/openscied-serengeti-preview\.svg" width="960" height="600"/);
  assert.match(unit, /id="serengeti-open"[^>]*href="openscied-b1-serengeti\.html"/);
  const preview = fs.readFileSync(path.join(__dirname,'../assets/openscied-serengeti-preview.svg'),'utf8');
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
    'openscied-b3-cancer-rates.html','openscied-b3-cell-cycle.html','openscied-b3-dna-workshop.html','openscied-b3-dna-p53.html','openscied-b3-inheritance-environment.html'
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

test('Unit 4 shows Hawksbeard, Rat Generations, then Junco, leaving only Unit 5 under Coming soon', () => {
  const page = fs.readFileSync(path.join(__dirname, '../openscied-dashboard.html'), 'utf8');
  const heading = '<section class="dashboard-unit current" aria-labelledby="unit4">';
  const unit = page.split(heading)[1]?.split('</section>')[0] || '';
  assert.equal((page.match(/id="unit4"/g)||[]).length, 1);
  assert.match(unit, /<h2 id="unit4">Unit 4 · Natural Selection &amp; Evolution of Populations<\/h2>/);
  assert.match(unit, /<span class="dashboard-tag">3 activities available<\/span>/);
  assert.equal((unit.match(/<article class="dashboard-activity">/g)||[]).length, 3);
  assert.match(unit, /href="openscied-b4-hawksbeard\.html"[^>]*><img src="assets\/hawksbeard-preview\.svg" width="960" height="600"/);
  assert.match(unit, /id="hawksbeard-open"[^>]*href="openscied-b4-hawksbeard\.html"/);
  assert.match(unit, /href="openscied-b4-rat-generations\.html"[^>]*><img src="assets\/rat-generations-preview\.svg" width="960" height="600"/);
  assert.ok(unit.indexOf('id="hawksbeard-open"') < unit.indexOf('id="rat-generations-open"'));
  assert.match(unit, /href="openscied-b4-junco\.html"[^>]*><img src="assets\/junco-preview\.svg" width="960" height="600"/);
  assert.ok(unit.indexOf('id="rat-generations-open"') < unit.indexOf('id="junco-open"'));
  const upcoming = page.split('<details class="dashboard-coming-soon">')[1]?.split('</details>')[0] || '';
  assert.deepEqual([...upcoming.matchAll(/aria-labelledby="(unit\d+)"/g)].map(m=>m[1]), ['unit5']);
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
  const raw = JSON.stringify({v:1,seed:5,step:'explain',action:6,lastVisitedAt:1800000000000,prediction:'increase',
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
    prediction:{choice:'lower', reason:'The groups may differ.', locked:true},
    evidence:[{view:'state', measure:'incidence', a:'MI', b:'OH'}], claim:'I compared two rates.', limits:'These are population data.' };
  const raw = JSON.stringify(saved);
  const s = setup(false, { [key]:raw });
  assert.equal(s.el('#cancer-rates-progress').textContent, 'Investigation complete · 1 pinned comparison · 2 of 2 responses saved');
  assert.equal(s.el('#cancer-rates-open').href, 'openscied-b3-cancer-rates.html#cr-income-cards');
  assert.equal(s.el('#openscied-resume-link').href, 'openscied-b3-cancer-rates.html#cr-income-cards');
  s.el('#download-openscied-results').fire('click');
  const whole = JSON.parse(await s.blob().text());
  assert.equal(whole.work[key], raw);
  s.el('#cancer-rates-reset').fire('click');
  s.el('#backup-before-openscied-clear').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.deepEqual(payload.work, { [key]:raw });
  assert.deepEqual(payload.responses['cancer-rates'], {
    claim:saved.claim, limits:saved.limits, prediction:saved.prediction.choice, predictionReason:saved.prediction.reason
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
  assert.equal(s.el('#migration-open').href, 'openscied-b1-migration.html#explore');
  assert.equal(s.el('#dna-workshop-progress').textContent, 'Not started');
  assert.equal(s.el('#download-openscied-results').disabled, false);
});

test('case evidence checks and a question draft are resumable before a comparison is pinned', () => {
  const key = 'aplab:openscied:b3-cancer-rates:v1';
  const base = { step:'predict', evidence:[], lastVisitedAt:1800000000000 };
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
  const raw = JSON.stringify({step:'explore',evidence:[],lastVisitedAt:1800000000000,
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
  assert.equal(s.el('#junco-progress').textContent,'CORT evidence · Aviary results viewed · 2 of 2 responses written');
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
