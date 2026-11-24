/* Play-test Nov 20, item 16: the downloaded JSON listed trials without their set. Each trial now carries setNumber and
   trialInSet (matching the data table's "Set 2 / 1"), with every earlier field kept, and a save written before this
   change (trials without these fields) still loads and exports. */
const T = require('./_h');
const fs = require('fs');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const t = (age, divisions) => ({modelVersion:2, age, size:'average', tissue:'skin', divisions, opportunities:divisions, cancerCount:0, firstCancerAge:null, timeline:[{year:20,cumulative:0,cells:[],changes:[],cancerCells:[],newCancerCells:[],cancerCount:0}]});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','overview',server.url);
  try {
    // An older save: four trials (a full set and the start of a second), plus an older trial with no model version.
    const trials = [t(30,5),t(30,6),t(30,7),t(50,9),{age:40,size:'small',tissue:'medium',divisions:4,opportunities:4}];
    await p.evaluate(({key,trials}) => localStorage.setItem(key, JSON.stringify({v:1,trials,fields:{'analysis-design':'Old answer'}})), {key:KEY,trials});
    await p.reload(); await p.locator('.step-nav a[href="#submit"]').click(); await p.waitForTimeout(150);
    T.ok((await p.locator('#trial-rows tr').count()) === 5, 'the older save still loads all five trials');
    await p.locator('#submit details.ose-report-other > summary').click();
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#download-work').click()]);
    const payload = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    const st = payload.simulationTrials;
    T.ok(payload.format === 'openscied-b3-cell-cycle-progress-v1' && st.length === 5, 'same file format, all trials exported');
    T.ok(st.map(x => x.setNumber + '/' + x.trialInSet).join() === '1/1,1/2,1/3,2/1,2/2', 'each trial has its set number and trial number within the set (' + st.map(x => x.setNumber + '/' + x.trialInSet).join() + ')');
    T.ok(st[3].age === 50 && st[3].divisions === 9 && st[3].opportunities === 9 && st[3].modelVersion === 2 && Array.isArray(st[3].timeline) && st[4].tissue === 'medium', 'every earlier trial field is kept');
    const stored = await p.evaluate(key => JSON.parse(localStorage.getItem(key)).trials, KEY);
    T.ok(stored.every(x => !('setNumber' in x)), 'the saved record itself is unchanged (numbers are added only to the export)');
    T.ok(payload.answers['analysis-design'] === 'Old answer', 'answers from the older save are exported');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-json-set-numbers');
})();
