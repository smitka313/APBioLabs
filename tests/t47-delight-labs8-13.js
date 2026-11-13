/* Delight features wired into labs 8-13: timelapse records/replays a live run, predictCompare renders with real data,
   sound calls don't throw with sound on, and no "new" badge appears after a reload.
   Run: NODE_PATH=$(npm root -g) node tests/t47-delight-labs8-13.js [lab08 ...] */
const T = require('./_h');
const only = process.argv.slice(2);
const want = n => !only.length || only.includes(n);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function soundOn(ctx) { await ctx.addInitScript(() => { try { localStorage.setItem('aplab:pref:sound', 'on'); } catch (e) {} }); }
const badges = p => p.evaluate(() => [...document.querySelectorAll('.tab-badge')].filter(b => !b.hidden).length);
async function replayWorks(p, sel, label) {
  const info = await p.evaluate(sel => { const b = document.querySelector(sel + ' .tl-replay'); return b ? { dis: b.disabled, st: document.querySelector(sel + ' .tl-status').textContent } : null; }, sel);
  T.ok(info && !info.dis, label + ': replay button enabled (' + (info && info.st) + ')');
  await p.click(sel + ' .tl-replay'); await p.waitForSelector('.tl-modal canvas', { timeout: 5000 });
  const n = await p.evaluate(() => +document.querySelector('.tl-scrub').max + 1);
  T.ok(n >= 3, label + ': replay modal opens with ' + n + ' frames');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
}
const R = {};
R.lab08 = async (b) => {
  console.log('lab08');
  const ctx = await T.ctxFor(b); await soundOn(ctx);
  let p = await T.open(ctx, 'lab08.html', 'transform');
  for (let i = 0; i < 9; i++) { await p.click('#do-step'); await p.waitForFunction(() => !document.querySelector('#do-step').disabled, null, { timeout: 40000 }); }
  await p.evaluate(() => { document.querySelectorAll('#pred-grid select').forEach(s => { s.value = 'white'; s.dispatchEvent(new Event('change', { bubbles: true })); }); });
  await p.click('#do-step'); await p.waitForTimeout(1500);
  T.ok(await p.evaluate(() => /Recording/.test(document.querySelector('#plate-timelapse .tl-status').textContent)), 'recording while incubating');
  await p.waitForFunction(() => /Colonies|Lawn|growth/i.test(document.querySelector('#plate-readouts').textContent), null, { timeout: 40000 });
  await p.waitForTimeout(1500);
  await replayWorks(p, '#plate-timelapse', 'lab08');
  // predictCompare
  await p.goto(p.url().replace(/#.*/, '') + '#evaluate'); await p.waitForTimeout(600);
  const cards = await p.evaluate(() => [...document.querySelectorAll('#ev-recall .pvc')].map(c => c.querySelector('.pvc-what').textContent + ' | ' + c.querySelector('.pvc-quote').textContent));
  T.ok(cards.length === 6 && cards.every(c => /What happened: (Your prediction matched|You predicted)/.test(c) && /“/.test(c)), 'six predictCompare cards with real data: ' + cards[0]);
  // reload: replay survives, no badge, no errors
  await p.reload(); await p.waitForTimeout(1500);
  T.ok(await p.evaluate(() => !document.querySelector('#plate-timelapse .tl-replay').disabled), 'replay available after reload');
  T.ok(await badges(p) === 0, 'no new badge after reload');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await ctx.close();
};
R.lab09 = async (b) => {
  console.log('lab09');
  const ctx = await T.ctxFor(b); await soundOn(ctx);
  let p = await T.open(ctx, 'lab09.html', 'run-a-gel');
  await p.evaluate(() => document.querySelector('#g1-layout').click());
  await p.click('#g1-run'); await p.waitForTimeout(1200);
  T.ok(await p.evaluate(() => /Recording/.test(document.querySelector('#g1-tl-run .tl-status').textContent)), 'gel run is recording');
  await p.waitForTimeout(3500); await p.click('#g1-run'); await p.waitForTimeout(1200);
  await replayWorks(p, '#g1-tl-run', 'lab09 run');
  await p.click('#g1-stain'); await p.waitForTimeout(800);
  T.ok(await p.evaluate(() => /Recording/.test(document.querySelector('#g1-tl-stain .tl-status').textContent)), 'staining is recording');
  await p.click('#g1-skip'); await p.waitForTimeout(500); await p.click('#g1-stain'); await p.waitForTimeout(800); await p.click('#g1-skip'); await p.waitForTimeout(1500);
  await replayWorks(p, '#g1-tl-stain', 'lab09 stain');
  // evidence gel with a real comparison
  await p.evaluate(() => Lab.pages.go(document.querySelector('#p-predict-crime'))); await p.waitForTimeout(500);
  await p.fill('#p-predict-crime', 'The matching suspect will have bands at the same distances as the blood.'); await p.waitForTimeout(1300);
  await p.evaluate(() => document.querySelector('#g2-layout').click());
  await p.click('#g2-run'); await p.waitForTimeout(5500); await p.click('#g2-run');
  await p.click('#g2-stain'); await p.click('#g2-skip'); await p.waitForTimeout(400); await p.click('#g2-stain'); await p.click('#g2-skip'); await p.waitForTimeout(800);
  for (let i = 0; i < 5; i++) { await p.selectOption('#g2-mlane', String(i)); await p.click('#g2-mall'); }
  const sizes = [23130, 9416, 6557, 4361, 2322, 2027, 564];
  await p.evaluate(sizes => { let k = 0; document.querySelectorAll('#g2-sim .mtable tbody tr').forEach(row => { const td = row.querySelectorAll('td'); if (td[2].textContent.trim() === 'HindIII' && k < sizes.length) { const inp = row.querySelector('input[data-k="known"]'); inp.value = sizes[k++]; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); } }); }, sizes);
  await p.waitForTimeout(800);
  await p.evaluate(() => Lab.pages.go(document.querySelector('section.step[data-step="Evaluate"]'))); await p.waitForTimeout(2200);
  const txt = await p.evaluate(() => { const c = document.querySelector('#ev-compare .pvc'); return c ? c.querySelector('.pvc-what').textContent + ' | ' + c.querySelector('.pvc-quote').textContent : ''; });
  T.ok(/What happened: (With your match rule|No suspect|Exactly|More than)|matched the blood/.test(txt) && /same distances/.test(txt), 'predictCompare shows the evidence-gel result: ' + txt.slice(0, 160));
  await p.reload(); await p.waitForTimeout(1500);
  T.ok(await p.evaluate(() => !document.querySelector('#g1-tl-run .tl-replay').disabled), 'replay available after reload');
  T.ok(await badges(p) === 0, 'no new badge after reload');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await ctx.close();
};
R.lab10 = async (b) => {
  console.log('lab10');
  const ctx = await T.ctxFor(b); await soundOn(ctx);
  let p = await T.open(ctx, 'lab10.html', 'part-1-npp');
  const go = sel => p.evaluate(s => Lab.pages.go(document.querySelector(s)), sel);
  await go('#p-p1-diagram'); await p.fill('#p-p1-diagram', 'Mass rises quickly, then about 30% of the energy is lost to respiration.'); await p.waitForTimeout(1300);
  await p.click('#p1-plus7'); await p.waitForTimeout(900);
  await p.click('#p1-harvest'); await p.waitForTimeout(500);
  await p.click('#p1-dry'); await p.waitForTimeout(600);
  T.ok(await p.evaluate(() => /Recording/.test(document.querySelector('#p1-timelapse .tl-status').textContent)), 'drying is recording');
  await p.waitForFunction(() => /Timelapse ready/.test(document.querySelector('#p1-timelapse .tl-status').textContent), null, { timeout: 15000 });
  await replayWorks(p, '#p1-timelapse', 'lab10 drying');
  await p.click('#p1-plus7'); await p.waitForTimeout(600); await p.click('#p1-plus7'); await p.waitForTimeout(900);
  await p.click('#p1-harvest'); await p.waitForTimeout(500); await p.click('#p1-dry');
  await p.waitForFunction(() => document.querySelector('#p1-status').textContent.indexOf('Oven') < 0 && !document.querySelector('#p1-dry').disabled || true, null, { timeout: 2000 });
  await p.waitForTimeout(1500);
  // barn
  await go('#p-p2-diagram'); await p.fill('#p-p2-diagram', 'About 20% of the energy a larva eats will become body mass.'); await p.waitForTimeout(1300);
  await p.evaluate(() => { [['#ratio-plant', '0.15'], ['#ratio-larva', '0.40']].forEach(([q, v]) => { const e = document.querySelector(q); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }); });
  await p.click('#p2-run'); await p.waitForTimeout(900);
  T.ok(await p.evaluate(() => /Recording/.test(document.querySelector('#p2-timelapse .tl-status').textContent)), 'barn is recording');
  await p.waitForFunction(() => /Timelapse ready/.test(document.querySelector('#p2-timelapse .tl-status').textContent), null, { timeout: 15000 });
  await replayWorks(p, '#p2-timelapse', 'lab10 barn');
  await go('section.step[data-step="Reflect"]'); await p.waitForTimeout(2300);
  const cards = await p.evaluate(() => [...document.querySelectorAll('#reflect-compare .pvc')].map(c => c.querySelector('.pvc-what').textContent));
  T.ok(cards.length === 3, 'three predictCompare cards');
  T.ok(/day 7|dry mass/i.test(cards[0]) && !/Finish/.test(cards[0]), 'plant card has real data: ' + cards[0].slice(0, 140));
  T.ok(/You predicted about 20%/.test(cards[1]), 'barn card compares the predicted % with the measured one: ' + cards[1].slice(0, 140));
  T.ok(/Finish/.test(cards[2]), 'design card waits for the experiment: ' + cards[2]);
  await p.reload(); await p.waitForTimeout(1500);
  T.ok(await p.evaluate(() => !document.querySelector('#p2-timelapse .tl-replay').disabled), 'replay available after reload');
  T.ok(await badges(p) === 0, 'no new badge after reload');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await ctx.close();
};
R.lab11 = async (b) => {
  console.log('lab11');
  const ctx = await T.ctxFor(b); await soundOn(ctx);
  let p = await T.open(ctx, 'lab11.html', 'stomata');
  const go = sel => p.evaluate(s => Lab.pages.go(document.querySelector(s)), sel);
  await go('#p-predict-stomata'); await p.fill('#p-predict-stomata', 'The lower surface will have far more stomata than the upper.'); await p.waitForTimeout(1300);
  await p.click('#st-m400'); await p.waitForTimeout(300);
  for (let i = 0; i < 2; i++) { await p.click('#st-record'); await p.waitForTimeout(200); }
  await p.click('#st-upper'); await p.waitForTimeout(300);
  for (let i = 0; i < 2; i++) { await p.click('#st-record'); await p.waitForTimeout(200); }
  await go('#p-predict-water'); await p.fill('#p-predict-water', 'The fan and heat lamp will raise the rate; mist and the bag will lower it.'); await p.waitForTimeout(1300);
  await go('#tr-run');
  await p.click('#tr-run'); await p.waitForTimeout(900);
  T.ok(await p.evaluate(() => /Recording/.test(document.querySelector('#tr-timelapse .tl-status').textContent)), 'water-loss run is recording');
  await p.waitForFunction(() => /Timelapse ready/.test(document.querySelector('#tr-timelapse .tl-status').textContent), null, { timeout: 15000 });
  await replayWorks(p, '#tr-timelapse', 'lab11 water loss');
  await p.selectOption('#tr-cond', 'fan'); await p.click('#tr-run'); await p.waitForTimeout(5500);
  await go('section.step[data-step="Evaluate"]'); await p.waitForTimeout(2300);
  const cards = await p.evaluate(() => [...document.querySelectorAll('#ev-compare .pvc')].map(c => c.querySelector('.pvc-what').textContent));
  T.ok(cards.length === 3, 'three predictCompare cards');
  T.ok(/stomata/i.test(cards[0]) && !/Finish/.test(cards[0]), 'stomata card has real data: ' + cards[0].slice(0, 150));
  T.ok(/the control/.test(cards[1]) && !/Finish/.test(cards[1]), 'water card compares with the control: ' + cards[1].slice(0, 150));
  T.ok(/Finish/.test(cards[2]), 'design card waits for the experiment: ' + cards[2]);
  await p.reload(); await p.waitForTimeout(1500);
  T.ok(await p.evaluate(() => !document.querySelector('#tr-timelapse .tl-replay').disabled), 'replay available after reload');
  T.ok(await badges(p) === 0, 'no new badge after reload');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await ctx.close();
};
R.lab12 = async (b) => {
  console.log('lab12');
  const ctx = await T.ctxFor(b); await soundOn(ctx);
  let p = await T.open(ctx, 'lab12.html', 'geotaxis-vial');
  const go = sel => p.evaluate(s => Lab.pages.go(document.querySelector(s)), sel);
  await go('#p-predict-vial'); await p.fill('#p-predict-vial', 'Most flies will climb to the top half within 30 seconds.'); await p.waitForTimeout(1300);
  await p.click('#vial-run'); await p.waitForTimeout(1500);
  T.ok(await p.evaluate(() => /Recording/.test(document.querySelector('#vial-timelapse .tl-status').textContent)), 'vial trial is recording');
  await p.waitForFunction(() => /Timelapse ready/.test(document.querySelector('#vial-timelapse .tl-status').textContent), null, { timeout: 25000 });
  await replayWorks(p, '#vial-timelapse', 'lab12 vial');
  await go('#p-predict'); await p.fill('#p-predict', 'The flies will prefer vinegar and avoid ammonia.'); await p.waitForTimeout(1300);
  await go('#c-run');
  await p.evaluate(() => { const c = document.querySelector('#c-pause'); if (c.checked) c.click(); const s = document.querySelector('#c-a'); const o = [...s.options].find(x => /vinegar/i.test(x.textContent)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); } });
  await p.click('#c-run'); await p.waitForTimeout(1500);
  T.ok(await p.evaluate(() => /Recording/.test(document.querySelector('#ch-timelapse .tl-status').textContent)), 'chamber trial is recording');
  await p.waitForFunction(() => /Timelapse ready/.test(document.querySelector('#ch-timelapse .tl-status').textContent), null, { timeout: 60000 });
  await replayWorks(p, '#ch-timelapse', 'lab12 chamber');
  await go('section.step[data-step="Evaluate"]'); await p.waitForTimeout(2300);
  const cards = await p.evaluate(() => [...document.querySelectorAll('#ev-compare .pvc')].map(c => c.querySelector('.pvc-what').textContent));
  T.ok(cards.length === 3, 'three predictCompare cards');
  T.ok(/flies were in the top half/.test(cards[0]) || /top half/.test(cards[0]), 'vial card has real data: ' + cards[0].slice(0, 150));
  T.ok(/χ²|none of your/i.test(cards[1]) && !/Finish/.test(cards[1]), 'chamber card has real data: ' + cards[1].slice(0, 150));
  T.ok(/Finish/.test(cards[2]), 'design card waits for the experiment: ' + cards[2]);
  await p.reload(); await p.waitForTimeout(1500);
  T.ok(await p.evaluate(() => !document.querySelector('#ch-timelapse .tl-replay').disabled), 'replay available after reload');
  T.ok(await badges(p) === 0, 'no new badge after reload');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await ctx.close();
};
R.lab13 = async (b) => {
  console.log('lab13');
  const ctx = await T.ctxFor(b); await soundOn(ctx);
  let p = await T.open(ctx, 'lab13.html', 'procedure-1');
  const go = sel => p.evaluate(s => Lab.pages.go(document.querySelector(s)), sel);
  const spec = sel => p.evaluate(s => { const b2 = document.querySelector(s + ' button[data-v="spec"]'); if (b2) b2.click(); }, sel);
  await go('#p-predict-assay'); await p.fill('#p-predict-assay', 'Only the tube with enzyme will turn brown.'); await p.waitForTimeout(1300);
  await spec('#m1'); await go('#p1-run');
  await p.click('#p1-run'); await p.waitForTimeout(1500);
  T.ok(await p.evaluate(() => /Recording/.test(document.querySelector('#p1-timelapse .tl-status').textContent)), 'procedure 1 is recording');
  await p.waitForFunction(() => /Timelapse ready/.test(document.querySelector('#p1-timelapse .tl-status').textContent), null, { timeout: 30000 });
  await replayWorks(p, '#p1-timelapse', 'lab13 procedure 1');
  await go('#p-p2-pred'); await p.fill('#p-p2-pred', 'The optimum will be near pH 6 and the rate will fall at the extremes.'); await p.waitForTimeout(1300);
  await spec('#m2'); await go('#p2-run');
  await p.click('#p2-run'); await p.waitForTimeout(1500);
  T.ok(await p.evaluate(() => /Recording/.test(document.querySelector('#p2-timelapse .tl-status').textContent)), 'procedure 2 is recording');
  await p.waitForFunction(() => /Timelapse ready/.test(document.querySelector('#p2-timelapse .tl-status').textContent), null, { timeout: 30000 });
  await replayWorks(p, '#p2-timelapse', 'lab13 procedure 2');
  await go('#p-d-h'); await p.fill('#p-d-h', 'Higher temperature will raise the rate up to about 40 C.'); await p.waitForTimeout(1300);
  await go('#d-run'); await p.click('#d-run'); await p.waitForTimeout(1200);
  T.ok(await p.evaluate(() => /Recording/.test(document.querySelector('#d-timelapse .tl-status').textContent)), 'design run is recording');
  await p.waitForFunction(() => /Timelapse ready/.test(document.querySelector('#d-timelapse .tl-status').textContent), null, { timeout: 30000 });
  await go('section.step[data-step="Reflect"]'); await p.waitForTimeout(2300);
  const cards = await p.evaluate(() => [...document.querySelectorAll('#reflect-compare .pvc')].map(c => c.querySelector('.pvc-what').textContent));
  T.ok(cards.length === 3, 'three predictCompare cards');
  T.ok(/enzyme tube reached/.test(cards[0]) || /enzyme tube/.test(cards[0]), 'assay card has real data: ' + cards[0].slice(0, 160));
  T.ok(/You predicted an optimum near pH 6/.test(cards[1]), 'pH card compares predicted and measured optimum: ' + cards[1].slice(0, 160));
  T.ok(/fastest reaction/.test(cards[2]), 'design card has real data: ' + cards[2].slice(0, 160));
  await p.reload(); await p.waitForTimeout(1500);
  T.ok(await p.evaluate(() => !document.querySelector('#d-timelapse .tl-replay').disabled), 'replay available after reload');
  T.ok(await badges(p) === 0, 'no new badge after reload');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await ctx.close();
};
(async () => {
  const b = await T.launch();
  for (const k of Object.keys(R)) if (want(k)) await R[k](b);
  await b.close(); T.done('delight labs 8-13');
})();
