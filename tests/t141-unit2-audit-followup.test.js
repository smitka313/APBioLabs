'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(process.env.UNIT2_FIXTURE || path.join(__dirname, '..'));
const source = filename => fs.readFileSync(path.join(root, filename), 'utf8');
const logic = name => require(path.join(root, 'openscied-b2-' + name + '-logic.js'));

test('Fires names 18 °C and 43 °C as the example, without misrepresenting a custom yeast trial', () => {
  const L = logic('fires');
  const warm = { seed:11, temps:[18,27,43], recorded:[20] };
  const hot = { seed:11, temps:[43,55,55], recorded:[20] };
  const same = { seed:11, temps:[43,43,43], recorded:[20] };
  assert.deepEqual(L.foamRows(warm)[0].h, [11,38,62]);
  assert.deepEqual(L.foamRows(hot)[0].h, [66,2,2]);
  assert.equal(new Set(same.temps).size, 1);
  const html = source('openscied-b2-fires.html');
  assert.match(html, /class example:[\s\S]*10 mm of foam at 18 °C and 62 mm at 43 °C/i);
  assert.match(html, /id="sense3"[\s\S]*id="data-sense-foam-body"[\s\S]*even if you tried different ones/);
  assert.match(source('openscied-b2-fires.js'), /'#data-sense-foam-body', function \(\) \{ return decompNodes\(false, false\); \}/, 'show the actual last reading without duplicating the adjacent prediction result');
  for (const value of ['faster','slower','same']) {
    for (const pick of ['sense-energy','cards-rate-hot']) {
      const result = L.checkPick(pick, value);
      assert.match(result.message, /class/i);
      assert.doesNotMatch(result.message, /your foam|your warm|the warmer the water/i);
    }
  }
  for (const amount of ['more','less']) {
    for (const temp of ['higher','lower']) {
      assert.match(L.checkSugarSentence(amount, temp).message, /18 °C and 43 °C class example/);
    }
  }
});

test('Fires keeps personal tube checks separate from the class example; foil alone is the least in that example', () => {
  const L = logic('fires'), classRun = { settings:['direct','tilt45','foil'], recorded:true, seed:11 };
  const noFoil = { settings:['direct','tilt45','tilt70'], recorded:true, seed:11 };
  assert.equal(L.checkTiltPick('yellowest','foil',classRun).status, 'correct');
  assert.equal(L.checkTiltPick('yellowest','tilt70',noFoil).status, 'correct');
  assert.equal(L.checkTiltPick('yellowest','foil',noFoil).status, 'wrong');
  assert.equal(L.checkPick('sense-least','tilt70').status, 'wrong');
  assert.equal(L.checkPick('sense-least','foil').status, 'correct');
  const html = source('openscied-b2-fires.html');
  assert.match(html, /If you tested foil, compare this example with your own reading above/);
  assert.match(html, /id="sense-least"[\s\S]*<option value="tilt70" hidden>/, 'legacy saved choices still restore');
  assert.match(html, /counting the foil tube/);
});

test('Burning Fuels places the actual recorded per-fuel averages next to the three data questions', () => {
  const L = logic('burn');
  const state = { burn:{ seed:72, records:[] } };
  const js = source('openscied-b2-burn-lab.js');
  const helper = js.match(/  function senseBurnNodes\(\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(helper);
  const generate = vm.runInNewContext(helper+'\nsenseBurnNodes', {
    L, state, el:(_tag,_cls,text)=>text, table:(_caption,head,rows)=>({head,rows})
  });
  assert.match(generate()[0], /at least two fuel types/);
  state.burn.records.push({fuel:'grass',n:1,obs:[]});
  assert.match(generate()[1], /another type of fuel/);
  state.burn.records.push({fuel:'peat',n:1,obs:[]},{fuel:'peat',n:2,obs:[]});
  const result = generate()[0];
  assert.equal(result.rows.length, 2);
  const format = raw => (Math.round(raw * 10) / 10).toFixed(1);
  const groups = L.byFuel(L.tableRows(state.burn));
  for (const [i, group] of groups.entries()) {
    assert.deepEqual(Array.from(result.rows[i]),[group.label,format(group.massLost),format(group.tempRise),L.btbText(Number(format(group.btbAfter)))]);
  }
  for (const [kind, key] of [['lostmost','massLost'],['warmest','tempRise'],['yellowest','btbAfter']]) {
    const top = [...groups].sort((a,b)=>Number(format(b[key]))-Number(format(a[key])))[0];
    assert.equal(L.checkDataPick(kind,top.fuel,state.burn).status,'correct');
  }
  assert.match(js, /\$\('#sense-burn-data-body'\)\?\.replaceChildren\(\.\.\.senseBurnNodes\(\)\)/);
  const html = source('openscied-b2-burn-lab.html');
  assert.match(html, /bromothymol blue \(BTB\)/i);
  assert.match(html, /cannot reliably measure through the glass dome/);
  assert.match(html, /id="sense"[\s\S]*id="sense-burn-data-body"[\s\S]*id="sense-lostmost"[\s\S]*id="sense-warmest"/);
});

test('Peat Bog acknowledges residual decomposition at 100% frozen without changing the numbers', () => {
  const L = logic('peat-bog');
  const s = {...L.DEFAULTS, temp:3, wet:0, o2:35, burn:80};
  const m = L.model(s);
  assert.equal(m.perm, 1);
  assert.equal(m.B, 0);
  assert.equal(Math.round(m.D), 1);
  const note = L.notes(s,m).find(n => n.title === 'Permafrost');
  assert.match(note.text, /still show a small rate even when all peat is frozen/);
  assert.match(note.text, /fire can burn only the thawed share/i);
  const html = source('openscied-b2-peat-bog-lab.html');
  assert.match(html, /Peat and coal form from plant remains\. Much oil and natural gas formed from the remains of tiny ocean organisms/);
  assert.match(html, /At 100% frozen, the model still allows a small rate/);
});

test('Carbon Journey clearly separates die records, examples and which report to submit', () => {
  const html = source('openscied-b2-carbon-journey.html');
  const js = source('openscied-b2-carbon-journey.js');
  assert.match(js, /Your atom started in atmospheric carbon dioxide[\s\S]*rule of this model/);
  assert.match(js, /Tell the story of two turns you recorded[\s\S]*label it as an example/);
  assert.match(html, /id="budget"[\s\S]*id="carbon-budget-host"[\s\S]*data-ose-report-final[\s\S]*<\/section>/);
  const budget = source('carbon-budget.js');
  assert.match(budget, /Only one burns/);
  assert.match(budget, /Preview report<\/strong> includes your Journey and Budget work[\s\S]*Download budget evidence<\/strong> saves just this comparison/);
});

test('Peat tilt notes reflect rounded results for the same settings at today’s tilt', () => {
  const L = logic('peat-bog');
  const hint = (tilt, temp) => L.notes({...L.DEFAULTS, tilt,temp}).find(n=>/ tilt$/.test(n.title)).text;
  assert.match(hint(24.5,24), /photosynthesis falls from 29 to 22/);
  assert.match(hint(22.1,20), /Frozen peat stays at 0%/);
  assert.match(hint(24.5,10), /photosynthesis rises from \d+ to \d+/);
  assert.match(hint(24.5,18), /photosynthesis stays at 45|photosynthesis falls from 45 to 44/);
});

test('Fires distinguishes same-setting readings from temperature and lamp comparisons', () => {
  const L=logic('fires'), seed=11;
  const same={decomp:{seed,recorded:[20],temps:[43,43,43]},tilt:{seed,recorded:true,settings:['direct','direct','direct']}};
  let e=L.sceneEvidence(same);
  assert.equal(e.foamReadings,1); assert.equal(e.foamComparison,false);
  assert.equal(e.tubesRead,3); assert.equal(e.tiltComparison,false);
  e=L.sceneEvidence({
    decomp:{...same.decomp,temps:[43,55,55]},
    tilt:{...same.tilt,settings:['direct','tilt45','tilt70']}
  });
  assert.equal(e.foamComparison,true);
  assert.equal(e.tiltComparison,true, 'a real lit contrast does not require foil');
  assert.equal(L.sceneEvidence({tilt:{...same.tilt,settings:['direct','fake','foil']}}).tiltComparison,false);
});

test('Burning Fuels predictions ask for the measured temperature change without changing save keys', () => {
  const html=source('openscied-b2-burn-lab.html');
  assert.equal([...html.matchAll(/id="pred-[a-z]+-energy" aria-label="[^"]+warms up less or more than the others"/g)].length,5);
  assert.doesNotMatch(html, /give the most energy|gives less or more energy than the others/);
  const L=logic('burn');
  const trial={seed:42,records:[{fuel:'peat',n:1,obs:[]}]};
  assert.match(L.checkPrediction('peat','energy','more',trial).message,/compare temperature changes/);
});

test('Carbon Journey repeats recorded totals beside Q2 and offers an optional separate sample on Q4', () => {
  const html=source('openscied-b2-carbon-journey.js');
  assert.match(html, /article.append\(panel\)[\s\S]*if \(id === 'q4'\)/);
  assert.match(html, /Example journey for solo work/);
  assert.match(html, /This example does not change your journal or totals/);
  assert.match(html, /totalGroups.forEach\([\s\S]*?renderQuestionTotals\(totalGroups\)/);
  const L=logic('carbon-journey');
  let sample=L.initial(70);
  for(let i=0;i<10;i++) sample=L.record({...sample,pending:L.die(70,i)});
  assert.equal(sample.rows.length,10);
  assert.ok(new Set(sample.rows.map(row=>row.from)).size>=6);
});

test('Fires distinguishes a 59 mm student trial from the fixed 62 mm model benchmark', () => {
  const F = logic('fires'), sample = {seed:14, temps:[18,27,43], recorded:[20]};
  assert.deepEqual(F.foamRows(sample)[0].h, [11,38,59]);
  assert.equal(F.TARGET20[43], 62);
  const html = source('openscied-b2-fires.html');
  assert.match(html, /id="data-sense-foam-title">Your simulated results/);
  assert.match(html, /The 62 mm is a fixed model benchmark; use the values in <strong>Your simulated results<\/strong> to describe your own run/);
  assert.match(html, /These are fixed model benchmarks, not your results or real lab measurements\./);
});

test('Fires explains why same-color tubes can model different CO₂ changes and publishes the unchanged formula', () => {
  const F = logic('fires');
  const tubes=F.tiltResults(14,['direct','tilt45','foil']);
  assert.deepEqual(tubes.map(({btbLabel,btb,net})=>[btbLabel,btb,net]),
    [['deep blue',1.1,-0.563],['deep blue',1.2,-0.457],['yellow',6,0.318]]);
  for (const [i,tube] of tubes.entries()) {
    const light=[1,Math.SQRT1_2,0][i], rawNet=F.tubeFactor(14,i)*(0.30-1.10*light/(0.35+light));
    const rawBtb=2+(rawNet<=0?rawNet/0.60:13*rawNet);
    assert.equal(tube.net,Math.round(rawNet*1000)/1000);
    assert.equal(tube.btb,Math.round(Math.min(6,Math.max(1,rawBtb))*10)/10);
  }
  const html=source('openscied-b2-fires.html');
  assert.match(html,/CO₂ change = plant size × \(respiration per size − photosynthesis per size\)/);
  assert.match(html,/1\.10 × light ÷ \(0\.35 \+ light\)/);
  assert.match(html,/signed change divided by 0\.60 to 2\.0[\s\S]*13 times the change[\s\S]*caps BTB at 1\.0–6\.0/);
  const scene=source('tilt-scene.js');
  assert.match(scene,/If BTB values tie after rounding or reach a limit, compare the modeled CO₂ changes in the table/);
  assert.match(scene,/x\.net\.toFixed\(3\)/);
});
