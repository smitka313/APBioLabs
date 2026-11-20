#!/usr/bin/env node
/* Regenerates the sample report shown on sample-report.html from a REAL run of Lab 5.

   A fictional student ("Sample Student", class "Demo") works through Lab 5 in a headless Chromium: answers the pre-lab
   quiz, infiltrates and pours the leaf disks, runs the float assay (with a dark period at the end), enters ET50, runs a
   light-intensity design, and writes every prompt. Answers that quote numbers are filled in from the run's own data.
   The script then
     - downloads the Word report with the Submit part's "Download .docx" button  -> samples/sample-report-lab05.docx
     - opens "Preview my report" and prints it to PDF (letter, the report's own @page rules) -> samples/sample-report-lab05.pdf
     - saves the preview's graph and stamp images            -> samples/sample-report-lab05-*.png
     - writes the preview's HTML into sample-report.html between <!-- sample-report:start --> and <!-- sample-report:end -->.

   Run after changing Lab 5 or the report code:
     NODE_PATH=$(npm root -g) node tools/make-sample-report.js
   Needs playwright (with Chromium) and docx on NODE_PATH, like the tests (see tests/_h.js). */
const fs = require('fs'), path = require('path');
const T = require('../tests/_h');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'samples'), PAGE = path.join(ROOT, 'sample-report.html');
const STUDENT = { name: 'Sample Student', period: 'Demo' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DUMP = process.argv.includes('--dump');   // print the run's data and the prompts, write nothing

/* ---------- driving the lab ---------- */
const show = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForTimeout(500); };
const setv = (p, sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
const write = (p, key, text) => p.evaluate(([k, t]) => {
  const el = document.getElementById('p-' + k); if (!el) throw new Error('no prompt p-' + k);
  el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
}, [key, text]);

async function prelab(p) {
  await show(p, 'pre-lab');
  await p.evaluate(() => {
    const q = Lab._reg.quizzes.find(x => x.id === 'prelab');
    q.el.querySelectorAll('.q').forEach((box, i) => {
      const qq = q.questions[i];
      if (qq.type === 'num') { const inp = box.querySelector('input'); inp.value = String(qq.answer); inp.dispatchEvent(new Event('input', { bubbles: true })); }
      else box.querySelector(`input[value="${qq.answer}"]`).checked = true;
      [...box.querySelectorAll('button')].find(b => /Check answer/.test(b.textContent)).click();
    });
  });
}
async function sinkDisks(p) {
  await show(p, 'sink-disks');
  for (let i = 0; i < 3; i++) {
    await p.click('#inf-pull');
    await p.waitForFunction(() => !document.querySelector('#inf-pull').disabled, null, { timeout: 45000 });
    await sleep(300);
    if (await p.evaluate(() => /^10 /.test(document.querySelector('#inf-a').textContent) && /^10 /.test(document.querySelector('#inf-b').textContent))) break;
  }
  await p.click('#inf-pour'); await sleep(500);
}
async function floatAssay(p) {
  await show(p, 'float-assay');
  await setv(p, '#cup-speed', '0.5'); await setv(p, '#cup-len', 30);
  await p.click('#cup-run');
  // Light for the first 20 minutes, then cover the cups with the box to watch respiration.
  await p.waitForFunction(() => parseFloat(document.querySelector('#cup-t').textContent) >= 20, null, { timeout: 60000 });
  await p.click('#cup-dark');
  await p.waitForFunction(() => { const r = Lab._reg.tables.find(t => t.el.id === 'cup-table').getRows(); return r.length && r[r.length - 1].m >= 30; }, null, { timeout: 60000 });
  await sleep(800);
  // ET50 by linear interpolation from the student's own With-CO2 column (exactly as the page explains it).
  const et = await p.evaluate(() => {
    const rows = Lab._reg.tables.find(t => t.el.id === 'cup-table').getRows().filter(r => !r._setup);
    const n = Lab.store.get('cup-prep').na, half = n / 2;
    for (let i = 1; i < rows.length; i++) if (rows[i].a >= half) { const a = rows[i - 1], b = rows[i]; return a.m + (half - a.a) / (b.a - a.a); }
    return null;
  });
  if (et == null) throw new Error('the bicarbonate cup never reached 50% floating');
  await setv(p, '#et-in', +et.toFixed(2)); await setv(p, '#ret-in', +(1 / +et.toFixed(2)).toFixed(3));
  await p.click('#et-check'); await sleep(300);
}
async function design(p) {
  await show(p, 'design');
  await setv(p, '#d-iv', 'dist'); await setv(p, '#d-levels', '5, 10, 20, 30, 40'); await setv(p, '#d-reps', 3);
  await p.evaluate(() => { const f = document.querySelector('#d-filter'); if (!f.checked) f.click(); });
  await p.click('#d-run');
  await p.waitForFunction(() => Lab.store.get('d-run') && Lab.store.get('d-run').done && Lab._reg.tables.find(t => t.el.id === 'd-raw').getRows().length >= 15, null, { timeout: 90000 });
  await sleep(800);
}
/* Everything the written answers quote, read from the page's own tables and key results. */
const facts = p => p.evaluate(() => {
  const tbl = id => Lab._reg.tables.find(t => t.el.id === id);
  const cup = tbl('cup-table').getRows().filter(r => !r._setup), prep = Lab.store.get('cup-prep');
  const kr = id => { const k = Lab.store.get('keyres:' + id); return k ? k.value : null; };
  const sum = tbl('d-sum').getRows().filter(r => !r._setup);
  const firstUp = cup.find(r => r.a > 0), lastLight = [...cup].reverse().find(r => r.light === 'on'), last = cup[cup.length - 1];
  return { na: prep.na, nb: prep.nb, et: kr('et50-bicarb'), ret: kr('ret50-bicarb'), first: firstUp ? firstUp.m : null,
    lightEnd: lastLight, last, waterMax: Math.max(...cup.map(r => r.b)), sum, raw: tbl('d-raw').getRows() };
});

/* ---------- the student's answers (concise, AP-level; numbers come from f) ---------- */
const n1 = x => (+x).toFixed(1), n3 = x => (+x).toFixed(3);
function answers(f) {
  const s = f.sum, lo = s[0], cm = r => r.lv + ' cm';
  const num = x => x != null && isFinite(x), full = s.filter(r => num(r.med) && num(r.mean) && num(r.se)), hi = full[full.length - 1] || lo, top = full[0] || lo, second = full[1] || lo;
  const cens = (f.raw || []).filter(r => r.et == null), censLv = [...new Set(cens.map(r => r.lvl))];
  const censTxt = cens.length ? ` At ${censLv.map(l => l + ' cm').join(', ')}, ${cens.length} of ${(f.raw || []).filter(r => censLv.includes(r.lvl)).length} cups had not reached 50% floating by 45 min, so ET₅₀ there is longer than 45 min; I left those cups out of the mean instead of counting them as zero.` : '';
  const sank = f.lightEnd.a - f.last.a, flat = top.mean && second.mean && top.mean / second.mean < 2;
  return {
    'predict-floatassay': 'I predict the disks in the bicarbonate cup will float first because NaHCO₃ supplies CO₂ for the Calvin cycle, so photosynthesis can run and O₂ will collect in the air spaces. The water-only cup has almost no CO₂, so I expect few or none of its disks to float.',
    'p-ctrl': (f.waterMax ? `Only ${f.waterMax} of ${f.nb} water-only disks floated in 30 min.` : `None of the ${f.nb} water-only disks floated in 30 min.`) + ' It is the control because it differs only in having no bicarbonate. Without a CO₂ source the Calvin cycle cannot fix carbon, NADP⁺ is not regenerated, and the light reactions soon stall, so little O₂ is made. This shows the bicarbonate (CO₂) is what allowed the floating.',
    'p-dark': `I covered the cups at minute 20, when ${f.lightEnd.a} of ${f.na} disks with CO₂ were floating. By minute ${f.last.m}, ${f.last.a} were still floating` + (sank > 0 ? `, so ${sank} had sunk.` : ', so none had sunk yet.') + ' In the dark there is no photosynthesis, but cellular respiration keeps using O₂ from the air spaces, so the disks slowly lose buoyancy and eventually sink. The sinking slope is much shallower than the floating slope because the respiration rate is far lower than the photosynthesis rate in bright light.',
    'p-net': 'Respiration uses O₂ the whole time, so the O₂ that builds up in the disk is what photosynthesis makes minus what respiration uses. That is net photosynthesis. The dark period measures respiration alone, so gross photosynthesis ≈ net rate (floating) + respiration rate (sinking in the dark).',
    'd-q': 'How does light intensity (lamp distance) affect the net rate of photosynthesis (1/ET₅₀) in spinach leaf disks?',
    'd-h': 'If the lamp is closer, then ET₅₀ will be shorter and 1/ET₅₀ higher, because more photons drive the light reactions and make O₂ faster. At very close distances the rate should level off because the Calvin cycle (CO₂ supply, rubisco) becomes limiting. Null hypothesis: lamp distance has no effect on 1/ET₅₀.',
    'd-v': `Independent variable: lamp distance (${s.map(r => r.lv).join(', ')} cm). Dependent variable: ET₅₀ (min), converted to 1/ET₅₀ (min⁻¹). Held constant: 0.2% NaHCO₃, spinach disks of the same size, 10 disks per cup, 1 drop of soap, 25 °C water with the heat filter in place.`,
    'd-c': 'There is no zero-light cup in this design, so I compare the distances with each other, and the water-only cup from the float assay already showed that disks do not float without CO₂. I used 3 cups per level because disks vary; three replicates give a mean and standard error, so I can judge whether differences are real.',
    'predict-design': 'I predict the rate (1/ET₅₀) will decrease as the lamp distance increases, because light intensity falls with the square of the distance, so fewer photons reach the chlorophyll.',
    'd-r': `The closest lamp gave the fastest flotation: at ${cm(lo)} the median ET₅₀ was ${n1(lo.med)} min (mean 1/ET₅₀ = ${n3(lo.mean)} min⁻¹), while at ${cm(hi)} it was ${n1(hi.med)} min (mean 1/ET₅₀ = ${n3(hi.mean)} min⁻¹).${censTxt} Both graphs plot light at the cups (closer lamp = more light): the rate graph rises with light while the ET₅₀ graph falls, because the rate is the reciprocal of the time; a faster process reaches 50% floating sooner. Where the ±2 SE bars of neighboring levels do not overlap, the difference is probably real; where they overlap, I cannot be confident those levels differ.`,
    'd-lim': flat
      ? `The curve flattens close to the lamp: moving from ${cm(second)} to ${cm(top)} gives about 4 times as much light, but the mean rate only rose from ${n3(second.mean)} to ${n3(top.mean)} min⁻¹. There, light is no longer the limiting factor; the CO₂ supply (0.2% bicarbonate) and the speed of Calvin cycle enzymes such as rubisco limit the rate instead.`
      : `My curve had not clearly leveled off by ${cm(top)} (mean rate ${n3(top.mean)} min⁻¹), so light was still the main limiting factor across my range. Closer still, I would expect CO₂ supply and Calvin cycle enzymes such as rubisco to become limiting.`,
    a1: 'ET₅₀ is the time needed for half the disks to float, so a faster rate of net photosynthesis makes O₂ faster and gives a shorter ET₅₀. Taking 1/ET₅₀ turns the time into a rate, so a bigger value means faster photosynthesis.',
    a2: 'A few disks may float very late or never (damaged or thicker disks), which would drag a mean far off; the median time for 50% is barely affected by those outliers. I showed variability by running 3 cups per level and plotting mean 1/ET₅₀ with ±2 SE error bars.',
    a3: 'The light reactions split water and release the O₂ that makes the disks float, and they make ATP and NADPH. The Calvin cycle uses that ATP and NADPH to fix CO₂ from the bicarbonate; without it, NADP⁺ runs out and O₂ production slows. Lamp distance most directly affected the light reactions, because it changed how many photons reached the chlorophyll.',
    a4: 'Respiration uses some of the O₂ as it is made, so floating only shows net photosynthesis (photosynthesis minus respiration). A disk could photosynthesize but still not float if its respiration uses almost all of the O₂, for example in very dim light near the compensation point.',
    'own-assay': `My disks started rising at minute ${f.first} and reached ET₅₀ = ${n1(f.et)} min, after the light reactions had made enough O₂ to fill the air spaces that the vacuum emptied. The water cup had no floating disks, which shows that CO₂ from the bicarbonate is needed: without carbon fixation, photosynthesis cannot keep making O₂.`,
    'own-outlier': 'The disks in that cup may have been cut from a thicker part of the leaf or near a vein, or been damaged by the vacuum, so they needed more O₂ to float. Small differences in how much solution was infiltrated also change the starting density.',
    'cer-c': 'Increasing light intensity (moving the lamp closer) increased the net rate of photosynthesis in spinach leaf disks, until the rate began to level off at the closest distances.',
    'cer-e': `At ${cm(lo)} the median ET₅₀ was ${n1(lo.med)} min and the mean 1/ET₅₀ was ${n3(lo.mean)} ± ${n3(2 * lo.se)} min⁻¹ (±2 SE, 3 cups). At ${cm(hi)} the median ET₅₀ was ${n1(hi.med)} min and the mean 1/ET₅₀ was ${n3(hi.mean)} ± ${n3(2 * hi.se)} min⁻¹. ${lo.mean - 2 * lo.se > hi.mean + 2 * hi.se ? 'The error bars do not overlap.' : 'The error bars overlap, so the difference is uncertain.'}` + (cens.length ? ` At ${censLv.map(l => l + ' cm').join(', ')}, ${cens.length} cups never reached ET₅₀ within 45 min.` : ''),
    'cer-r': 'More light means more photons absorbed by chlorophyll in photosystems II and I, so water is split faster and O₂ builds up in the spongy mesophyll sooner, making the disks buoyant. At high light the Calvin cycle (CO₂ fixation by rubisco) cannot keep up, so the rate levels off: light stops being the limiting factor.',
    'reflect-predict': `My float-assay prediction was right: the bicarbonate cup reached ET₅₀ at ${n1(f.et)} min and ${f.waterMax ? 'the water cup floated only ' + f.waterMax + ' disks' : 'no water-only disk floated'}. My design prediction was also right in direction: the mean rate fell from ${n3(lo.mean)} min⁻¹ at ${cm(lo)} to ${n3(hi.mean)} min⁻¹ at ${cm(hi)} as the lamp moved away.` + (flat ? ' I did not predict how much the curve would flatten close to the lamp, which showed me that light was not the only limiting factor.' : ''),
    e1: 'Yes. Bigger or thicker disks, deeper solution, too much soap, damaged edges or not swirling can all change ET₅₀. That changes when the disks float, not necessarily the photosynthesis rate per cell, so technique has to be kept the same across all cups to compare treatments fairly.',
    e2: 'A shade leaf should reach its maximum rate at lower light and level off sooner, with a lower maximum; a sun leaf keeps rising to higher light. I would test two variables: leaf type (sun vs. shade leaves from the same plant) and lamp distance (5 levels), with 3 cups per combination, and compare the light response curves.',
    e3: 'If the close lamp warms the water, enzyme activity and gas solubility change too, so I could not tell whether light or temperature caused a faster rate. I kept the water heat filter between the lamp and cups and would check the temperature of each cup with a thermometer.',
    e4: 'C₄ plants concentrate CO₂ around rubisco and avoid photorespiration, so I predict corn disks would keep a higher rate at low bicarbonate and at high temperature than spinach (a C₃ plant). I would run both species at several bicarbonate concentrations (and at two temperatures) with 3 cups per level.',
    e5: 'I used to think the O₂ released in photosynthesis comes from CO₂. It actually comes from splitting water in the light reactions. My water-only cup puzzled me at first, because it had light and water but no disks floated. It showed me that the two stages depend on each other: without CO₂ the Calvin cycle stops, NADP⁺ is not regenerated, and the light reactions (and O₂ release) slow down.',
    'frq-a': 'Independent: distance from the lamp (light intensity). Dependent: ET₅₀ (or 1/ET₅₀). Held constant: bicarbonate concentration and water temperature (also disk size and plant type).',
    'frq-b': 'In light, photosynthesis releases O₂ into the air spaces of the spongy mesophyll, so the disks become less dense than the solution and float. ET₅₀ is the median, so one slow or damaged disk does not change it much, while waiting for every disk could take a very long time.',
    'frq-c': 'Moving from 30 cm to 5 cm increases light intensity about 36 times (inverse square), so ET₅₀ will get shorter, leveling off at the closest distance. If the lamp heated the water a lot, the rate (1/ET₅₀) could fall because enzymes such as rubisco denature and less CO₂ stays dissolved.',
    'frq-d': 'The water-only cup is identical except that it has no CO₂ source. If its disks do not float while the bicarbonate disks do, the floating must come from photosynthesis that depends on CO₂, not from the soap, the vacuum or warming of the cups.',
  };
}

async function run() {
  const srv = await T.serve(); const b = await T.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, colorScheme: 'light', acceptDownloads: true });
  await T.routeLibs(ctx);
  await ctx.addInitScript(s => { try { if (!sessionStorage.getItem('__sr')) { localStorage.clear(); localStorage.setItem('aplab:student', JSON.stringify(s)); localStorage.setItem('aplab:tour', JSON.stringify({ seen: true, v: 1 })); sessionStorage.setItem('__sr', '1'); } } catch (e) { /* ignore */ } }, STUDENT);
  const p = await T.open(ctx, 'lab05.html', '', srv.url);
  // The design and the predictions have to be written before the runs that need them.
  await prelab(p);
  await show(p, 'float-assay');
  const lv0 = { lv: '', med: 0, mean: 0, se: 0 }, A0 = answers({ sum: [lv0, lv0], lightEnd: {}, last: {}, et: 0 });   // the answers that quote no data
  await write(p, 'predict-floatassay', A0['predict-floatassay']);
  await sinkDisks(p);
  await floatAssay(p);
  await show(p, 'design');
  for (const k of ['d-q', 'd-h', 'd-c', 'predict-design']) await write(p, k, A0[k]);
  await design(p);
  const f = await facts(p);
  const A = answers(f);
  if (DUMP) {
    console.log(JSON.stringify(f, null, 1));
    console.log(await p.evaluate(() => [...document.querySelectorAll('textarea[id^="p-"]')].map(t => t.id + ' :: ' + (t.dataset.label || '').slice(0, 90) + (t.value ? ' [filled]' : '')).join('\n')));
  }
  for (const [k, v] of Object.entries(A)) await write(p, k, v);
  await p.evaluate(() => { const btn = document.querySelector('#frq-save'); if (btn) btn.click(); });
  await sleep(300);
  await p.evaluate(() => document.querySelectorAll('#frq-rubric input[type=checkbox]').forEach(c => { if (!c.checked) c.click(); }));
  await p.evaluate(() => { const r = document.querySelector('#confidence-box input[value="2"]'); if (r) r.click(); });
  await sleep(1500);
  const empty = await p.evaluate(() => [...document.querySelectorAll('textarea[id^="p-"]')].filter(t => !t.value.trim()).map(t => t.id));
  if (empty.length) console.log('Unanswered prompts: ' + empty.join(', '));
  if (p.errors.length) console.log('Page errors:\n' + p.errors.join('\n'));
  if (DUMP) { await b.close(); srv.close(); return; }

  fs.mkdirSync(OUT, { recursive: true });
  // 1. The Word report, through the real Submit button.
  await show(p, 'submit');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.locator('section.step.is-current').getByRole('button', { name: 'Download .docx' }).first().click()]);
  await dl.saveAs(path.join(OUT, 'sample-report-lab05.docx'));
  await sleep(500);
  // 2. "Preview my report": the same view the Save as PDF button prints.
  await p.locator('section.step.is-current').getByRole('button', { name: 'Preview my report' }).first().click();
  await p.waitForSelector('#lab-report .rv-paper');
  await sleep(800);
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: path.join(OUT, 'sample-report-lab05.pdf'), preferCSSPageSize: true, printBackground: false });
  await p.emulateMedia({ media: 'screen' });
  // 3. The preview's HTML and images, for the web page.
  const prev = await p.evaluate(() => {
    const body = document.querySelector('#lab-report .pr-body').cloneNode(true);
    const imgs = [];
    body.querySelectorAll('img').forEach((im, i) => { imgs.push({ src: im.getAttribute('src'), stamp: im.classList.contains('rv-stamp') }); im.setAttribute('src', '#img' + i); });
    return { html: body.innerHTML, imgs };
  });
  fs.readdirSync(OUT).filter(n => /^sample-report-lab05-.*\.png$/.test(n)).forEach(n => fs.unlinkSync(path.join(OUT, n)));
  // The page already has an h1: the report's headings go one level down (h1 -> h2, h2 -> h3); sample-report.html styles them to match.
  let html = prev.html.replace(/<(\/?)h2\b/g, '<$1h3').replace(/<(\/?)h1\b/g, '<$1h2');
  let g = 0;
  prev.imgs.forEach((im, i) => {
    const m = /^data:image\/png;base64,(.*)$/.exec(im.src); if (!m) throw new Error('unexpected image source');
    const name = im.stamp ? 'stamp' : 'graph-' + (++g);
    const file = `sample-report-lab05-${name}.png`;
    fs.writeFileSync(path.join(OUT, file), Buffer.from(m[1], 'base64'));
    html = html.replace(`src="#img${i}"`, `src="samples/${file}" loading="lazy"`);
  });
  const page = fs.readFileSync(PAGE, 'utf8');
  const a = '<!-- sample-report:start -->', z = '<!-- sample-report:end -->';
  if (!page.includes(a) || !page.includes(z)) throw new Error('sample-report.html has no sample-report markers');
  fs.writeFileSync(PAGE, page.slice(0, page.indexOf(a) + a.length) + '\n' + html + '\n' + page.slice(page.indexOf(z)));
  console.log('Wrote samples/sample-report-lab05.docx, .pdf, ' + prev.imgs.length + ' images, and the preview in sample-report.html');
  await b.close(); srv.close();
}
run().catch(e => { console.error(e); process.exit(1); });
