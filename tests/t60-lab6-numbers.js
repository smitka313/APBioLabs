/* Lab 6 respirometer numbers, end to end (audit 5 re-audit, item 3).
   For two student identities the test drives the real page (microrespirometer run, gas sensors, design trials, Q10 tools)
   and recomputes every number the page shows from the raw readings with its own code:
     - capillary volume per cm: π r² h with r = 0.040 cm  -> 5.0265 µL/cm
     - Table 1: C readings are the distance moved since the time-0 mark (0 at t = 0); D = change since the previous reading;
       corrected = C seeds − C beads (the bead/thermobarometer movement is subtracted, so warming that pushes both plugs
       away from the chamber is added back); O2 (µL) = corrected cm × 5.0265
     - rate = least-squares slope of corrected O2 vs time (µL O2/min); per gram = rate ÷ 0.30 g; mean ± SE of replicates
     - the checkers (D/corrected ±0.015 cm; rate ±max(0.08, 10 %)), blank / negative / zero inputs
     - gas sensors: slope of the logged points; O2 µL/min = −slope/100 × 242 mL, CO2 (no KOH) slope × 1e-6 × 242 mL,
       pressure (KOH) −slope/101.3 × 242 mL; CO2 with KOH and pressure without KOH give no O2 figure
     - design trials: rate = slope of the corrected readings the page fitted, per gram = rate ÷ organism mass, group mean / SD / 2 SE,
       zero and negative rates (boiled seeds), the plug reaching the end of the capillary, Q10 key result from ln(rate/g) vs T (≤ 35 °C)
     - Q10 calculator: (R2/R1)^(10/(T2−T1)); "Use my data" leaves out trials above 35 °C (fix) like the key result does
     - units on every axis and column header, the worked examples in the text and pre-lab, key results and the report export.
   Run: NODE_PATH=$(npm root -g) node tests/t60-lab6-numbers.js */
const T = require('./_h'), D = require('./t59-drive');
const fs = require('fs'), path = require('path');
const { ok } = T;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UL = Math.PI * 0.040 * 0.040 * 1 * 1000;   // µL per cm
const near = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const f = (x, d) => { const v = Number(x).toFixed(d); return /^-0\.?0*$/.test(v) ? v.slice(1) : v; };
function fit(xs, ys) {   // ordinary least squares, written out
  const n = xs.length; let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / n, my = sy / n; let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  return { m: sxy / sxx, b: my - (sxy / sxx) * mx };
}
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const IDS = ['Avery Stone', 'Jordan Ruiz'];

async function ctxAs(b, name) {
  const ctx = await T.ctxFor(b, { reduced: true, width: 1366, height: 900 });
  await ctx.route(/gc\.zgo\.at/, r => r.abort());
  await ctx.addInitScript(n => { try { if (!sessionStorage.getItem('__who')) { localStorage.setItem('aplab:student', JSON.stringify({ name: n, period: '4' })); sessionStorage.setItem('__who', '1'); } } catch (e) { /* ignore */ } }, name);
  return ctx;
}
const txt = (p, sel) => p.evaluate(s => ((document.querySelector(s) || {}).textContent || '').replace(/\s+/g, ' ').trim(), sel);
const rowsOf = (p, id) => p.evaluate(i => JSON.parse(JSON.stringify(Lab._reg.tables.find(t => t.el.id === i).getRows())), id);
const cells = (p, id) => p.evaluate(i => { const t = document.querySelector('#' + i + ' table.data'); const g = tr => [...tr.cells].map(c => { const inp = c.querySelector('input'); return (inp ? inp.value : c.textContent).replace(/\s+/g, ' ').trim(); });
  return { head: [...t.querySelectorAll('thead th')].map(th => th.textContent.replace(/\s+/g, ' ').trim()), body: [...t.querySelectorAll('tbody tr')].map(g), foot: [...t.querySelectorAll('tfoot tr')].map(g) }; }, id);
const chartOpts = (p, id) => p.evaluate(i => { const c = Lab._reg.charts.find(c => c.el.id === i); return JSON.parse(JSON.stringify({ xLabel: c.opts.xLabel, yLabel: c.opts.yLabel, series: (c.opts.series || []).map(s => ({ name: s.name, points: s.points })) })); }, id);
const setv = D.setv;
const typeCell = (p, id, r, k, v) => p.evaluate(([i, r, k, v]) => { const inp = document.querySelector(`#${i} input[data-r="${r}"][data-k="${k}"]`); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }, [id, r, k, String(v)]);

async function textChecks(b) {
  console.log('\n== worked examples in the text and pre-lab');
  const src = fs.readFileSync(path.join(T.ROOT, 'lab06.html'), 'utf8');
  ok(near(UL, 5.0265, 1e-4) && /π\(0\.040 cm\)²\(1 cm\) = 0\.00503 cm³ = 5\.03 µL/.test(src), 'background: π(0.040 cm)²(1 cm) = 0.00503 cm³ = 5.03 µL (computed ' + UL.toFixed(4) + ')');
  const q1 = src.match(/corrected plug movement is 2\.40 cm[^}]*answer: ([\d.]+), tol: ([\d.]+)/);
  ok(q1 && near(+q1[1], UL * 2.40, 0.01) && +q1[2] < 0.05 * UL * 2.40, `pre-lab: 2.40 cm × 5.03 µL/cm = ${(UL * 2.4).toFixed(2)} µL (answer ${q1 && q1[1]}, tolerance ${q1 && q1[2]})`);
  ok(/That is a rate of 1\.21 µL O<sub>2<\/sub>\/min/.test(src) && near(UL * 2.40 / 10, 1.21, 0.005), 'pre-lab: 12.06 µL over 10 min = 1.21 µL O₂/min');
  const q2 = src.match(/1\.1 µL\/min at 15 °C and at 2\.6 µL\/min at 25 °C[^}]*answer: ([\d.]+), tol: ([\d.]+)/);
  ok(q2 && near(+q2[1], Math.pow(2.6 / 1.1, 10 / 10), 0.005), `pre-lab Q10: (2.6/1.1)^(10/10) = ${(2.6 / 1.1).toFixed(3)} (answer ${q2 && q2[1]})`);
  ok(/one CO<sub>2<\/sub> is released for every O<sub>2<\/sub> consumed/.test(src) && /CO2 \+ 2 KOH|CO<sub>2<\/sub> \+ 2 KOH → K<sub>2<\/sub>CO<sub>3<\/sub> \+ H<sub>2<\/sub>O/.test(src), 'KOH: CO₂ + 2 KOH → K₂CO₃ + H₂O (balanced: K2 C1 O4 H2 each side)');
  ok(!/CO<sub>2<\/sub> is made as fast as O<sub>2<\/sub> is used/.test(src) && /one for one with glucose; a bit less CO<sub>2<\/sub> with oils/.test(src), 'key idea no longer claims CO₂ is always made as fast as O₂ is used (oil-storing Fast Plant seeds have RQ < 1)');
  ok(/Plug travel \(cm\) × 5\.03 µL\/cm gives O<sub>2<\/sub> used \(µL\)/.test(src), 'key idea: plug travel (cm) × 5.03 µL/cm = O₂ (µL)');
  void b;
}

async function microrespirometer(p, who, first) {
  console.log(`\n== [${who}] Option 1 microrespirometer`);
  await D.show(p, 'microrespirometer');
  for (const k of ['predict-microresp', 'predict-gas', 'predict-design']) await D.fillPred(p, k, 'I predict the seed plug will move toward the seeds and the bead plug will barely move because seeds use O2.');
  await setv(p, '#p-speed', '0');
  await p.click('#p-run'); await p.waitForFunction(() => Lab._reg.tables.find(t => t.el.id === 'p-reps').getRows().length >= 1, null, { timeout: 20000 }); await sleep(300);
  const rows = await rowsOf(p, 'p-table'), reps = await rowsOf(p, 'p-reps');
  ok(rows.length === 6 && rows.map(r => r.t).join() === '0,5,10,15,20,25', 'six readings at 0, 5 … 25 min');
  ok(rows[0].e === 0 && rows[0].c === 0, 'readings are the distance moved since the time-0 mark (both 0 at t = 0)');
  const good = rows.filter(r => typeof r.e === 'number' && typeof r.c === 'number');
  const xs = good.map(r => r.t), corr = good.map(r => r.e - r.c), o2 = corr.map(c => c * UL), F = fit(xs, o2);
  ok(good.every((r, i) => i === 0 || r.e > good[i - 1].e - 0.1) && good[good.length - 1].e > 2, 'seed plug moves toward the chamber (C seeds rises) for respiring seeds');
  ok(good.every(r => Math.abs(r.c) < 0.6), 'bead plug barely moves (|C beads| < 0.6 cm), so the correction is small: ' + good.map(r => r.c).join(', '));
  ok(rows.every(r => r.T >= 19.5 && r.T <= 20.5), 'B. bath temperature column stays at 20 °C');
  /* displayed table */
  const tb = await cells(p, 'p-table');
  ok(/A\. Time \(min\)/.test(tb.head[0]) && /\(°C\)/.test(tb.head[1]) && /Seeds total \(cm\)/.test(tb.head[2]) && /Beads total \(cm\)/.test(tb.head[3]) && /\(cm\)/.test(tb.head[4]) && /seeds − C beads\) \(cm\)/.test(tb.head[5]), 'Table 1 headers carry units: ' + tb.head.join(' | '));
  ok(rows.every((r, i) => tb.body[i][0] === f(r.t, 0) && tb.body[i][1] === f(r.T, 1) && tb.body[i][2] === (r.e == null ? '' : f(r.e, 2)) && tb.body[i][3] === f(r.c, 2)), 'Table 1 shows each raw reading to 0.01 cm');
  /* replicate table, rate and per gram */
  const rep = reps[reps.length - 1];
  ok(near(rep.rate, F.m, 1e-9), `replicate rate = slope of (C seeds − C beads) × 5.03 µL/cm vs time = ${F.m.toFixed(4)} µL O₂/min (page ${rep.rate.toFixed(4)})`);
  ok(near(rep.perg, F.m / 0.30, 1e-9), `per gram = rate ÷ 0.30 g = ${(F.m / 0.30).toFixed(3)} µL·g⁻¹·min⁻¹`);
  ok(F.m > 0.6 && F.m < 2.2, `rate is plausible for 0.30 g germinating seeds at 20 °C (0.30 g × ~4 µL·g⁻¹·min⁻¹): ${F.m.toFixed(2)}`);
  const rt = await cells(p, 'p-reps');
  ok(/Rate \(µL O₂\/min\)/.test(rt.head[2]) && /Rate per gram \(µL·g⁻¹·min⁻¹\)/.test(rt.head[3]), 'replicate headers: µL O₂/min and µL·g⁻¹·min⁻¹');
  ok(rt.body[rt.body.length - 1][2] === f(F.m, 2) && rt.body[rt.body.length - 1][3] === f(F.m / 0.30, 2), 'replicate row shows rate and per gram to 0.01');
  const rr = reps.map(r => r.rate);
  ok(rt.foot[0][1] === `n = ${rr.length}` && rt.foot[0][2] === (rr.length > 1 ? `${f(mean(rr), 2)} ± ${f(sd(rr) / Math.sqrt(rr.length), 2)}` : f(mean(rr), 2)) && rt.foot[0][3] === f(mean(rr) / 0.30, 2), 'replicate footer: n, mean ± SE, mean per gram: ' + rt.foot[0].join(' | '));
  /* graph */
  const ch = await chartOpts(p, 'p-chart');
  ok(ch.xLabel === 'Time (min)' && ch.yLabel === 'O₂ consumed (µL)', 'graph axes: Time (min) vs O₂ consumed (µL)');
  const cs = ch.series.find(s => /Corrected/.test(s.name)), us = ch.series.find(s => /uncorrected/.test(s.name)), bs = ch.series.find(s => /Beads/.test(s.name));
  ok(cs && cs.points.length === good.length && cs.points.every((pt, i) => pt.x === xs[i] && near(pt.y, o2[i], 1e-9)), 'graph: corrected points = (t, (C seeds − C beads) × 5.03)');
  ok(us && bs && us.points.every((pt, i) => near(pt.y, good[i].e * UL, 1e-9)) && bs.points.every((pt, i) => near(pt.y, rows[i].c * UL, 1e-9)), 'graph: uncorrected seeds and bead lines are C × 5.03 µL');
  /* readout tiles: the live plug (no marking error) */
  const tE = parseFloat(await txt(p, '#p-e')), tC = parseFloat(await txt(p, '#p-c')), tO = parseFloat(await txt(p, '#p-o2'));
  ok(/^25\.0 min$/.test(await txt(p, '#p-time')), 'time tile ends at 25.0 min');
  const lastE = good[good.length - 1];
  ok(rows[5].e == null ? near(tE, 6.8, 0.005) : near(tE, rows[5].e, 0.12), `seed tile ${tE} cm matches the 25-min reading ${rows[5].e} within the ±0.03 cm marking error`);
  ok(near(tC, rows[5].c, 0.12), `bead tile ${tC} cm matches the 25-min reading ${rows[5].c}`);
  ok(near(tO, (tE - tC) * UL, 0.06 + 0.005 * UL * 2), `corrected O₂ tile ${tO} µL = (seed tile − bead tile) × 5.03`);
  void lastE;
  /* checker: blank, correct, one wrong */
  await p.evaluate(() => document.querySelector('#p-check').click()); await sleep(150);
  ok(/Not checked yet/.test(await txt(p, '#p-check-msg')), 'checker refuses blank D / corrected cells');
  let prev = 0, total = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]; if (typeof r.e !== 'number') continue;
    const de = i === 0 ? 0 : r.e - prev; prev = r.e;
    await typeCell(p, 'p-table', i, 'de', de.toFixed(2)); await typeCell(p, 'p-table', i, 'corr', (r.e - r.c).toFixed(2)); total += 2;
  }
  await p.evaluate(() => document.querySelector('#p-check').click()); await sleep(150);
  ok((await txt(p, '#p-check-msg')) === `All ${total} entries are correct.`, `checker accepts independently computed D (= C − previous C) and corrected (= C seeds − C beads): ${await txt(p, '#p-check-msg')}`);
  const i2 = 2, wrongCorr = rows[i2].e + rows[i2].c;   // the classic sign error: adding the bead movement
  await typeCell(p, 'p-table', i2, 'corr', wrongCorr.toFixed(2)); await p.evaluate(() => document.querySelector('#p-check').click()); await sleep(150);
  const sameAnyway = Math.abs(wrongCorr - (rows[i2].e - rows[i2].c)) <= 0.015;
  ok(sameAnyway || (await txt(p, '#p-check-msg')).startsWith(`${total - 1} of ${total} entries correct`), 'checker rejects seeds + beads (wrong sign of the correction): ' + await txt(p, '#p-check-msg'));
  await typeCell(p, 'p-table', i2, 'corr', (rows[i2].e - rows[i2].c + 0.01).toFixed(2)); await p.evaluate(() => document.querySelector('#p-check').click()); await sleep(150);
  ok((await txt(p, '#p-check-msg')) === `All ${total} entries are correct.`, 'checker tolerates a 0.01 cm rounding difference');
  /* rate checker */
  const check = async v => { await setv(p, '#p-rate-in', v); await p.evaluate(() => document.querySelector('#p-rate-check').click()); await sleep(150); return (await txt(p, '#p-rate-msg')) + ' || ' + await p.evaluate(() => { const e = document.querySelector('#p-rate-in'); const fb = document.getElementById(e.getAttribute('aria-describedby') || '__'); return e.getAttribute('aria-invalid') === 'true' ? (fb ? fb.textContent : 'invalid') : ''; }); };
  let c = await check(F.m.toFixed(2));
  ok(c.startsWith(`Yes. The best-fit slope is ${f(F.m, 2)} µL O2/min (≈ ${f(F.m / 0.30, 1)} µL per gram per minute for 0.30 g of seeds).`), 'rate check: accepts the slope and reports slope and per-gram correctly: ' + c.slice(0, 110));
  const tol = Math.max(0.08, F.m * 0.1);
  ok((await check((F.m + tol * 0.8).toFixed(3))).startsWith('Yes'), 'rate check: accepts within the tolerance max(0.08, 10 %)');
  ok((await check((F.m + tol * 1.3).toFixed(3))).startsWith('Not quite'), 'rate check: rejects outside the tolerance');
  ok((await check((F.m / 0.30).toFixed(2))).startsWith('Not quite'), 'rate check: rejects the per-gram value typed as the rate');
  c = await check(''); ok(/Type your rate/.test(c) && !c.startsWith('Yes'), 'rate check: blank input asks for a number');
  c = await check('-1'); ok(/can.t be negative/.test(c) && !c.startsWith('Yes'), 'rate check: negative rate refused');
  c = await check('0'); ok(c.startsWith('Not quite'), 'rate check: a zero rate is checked (and is wrong for living seeds)');
  await check(F.m.toFixed(2));
  /* key result and report */
  const kr = await p.evaluate(() => Lab.keyResults());
  const k = kr.find(x => x.id === 'rate-microresp');
  ok(k && k.value === +f(rep.rate, 2) && k.unit === 'µL/min', `key result: O₂ uptake ${k && k.value} µL/min = last replicate rate rounded`);
  const rp = await p.evaluate(() => { const r = Lab.report.collect(); return { kr: r.keyResults, tables: r.sections.flatMap(s => s.items.filter(i => i.kind === 'table')) }; });
  const rk = rp.keyResults || rp.kr; const rkr = rk.find(x => x.id === 'rate-microresp');
  ok(rkr && rkr.text === `${f(rep.rate, 2)} µL/min`, 'report export key result: ' + (rkr && rkr.text));
  const repT = rp.tables.find(t => t.head.some(h => /Rate per gram/.test(h)) && t.head.some(h => /Setup/.test(h)));
  ok(repT && repT.rows[repT.rows.length - 1][2] === f(rep.rate, 2) && repT.rows[repT.rows.length - 1][3] === f(rep.perg, 2), 'report export: replicate table carries the same rate and per gram');
  const t1 = rp.tables.find(t => t.head.some(h => /Seeds total/.test(h)));
  ok(t1 && t1.rows.length === rows.length && t1.rows.every((r, i) => r[2] === (rows[i].e == null ? '' : f(rows[i].e, 2)) && r[5] === (rows[i].e == null ? '' : (rows[i].e - rows[i].c + (i === i2 ? 0.01 : 0)).toFixed(2))), 'report export: Table 1 readings and the typed corrected column');

  if (first) {
    /* edge case: the plug reaching the end of the capillary. Without equilibration the cooling gas adds ~1 cm, so some runs hit the end. */
    let hit = null;
    await setv(p, '#p-equil', ''); await p.evaluate(() => { const e = document.querySelector('#p-equil'); e.checked = false; e.dispatchEvent(new Event('change', { bubbles: true })); });
    for (let k2 = 0; k2 < 25 && !hit; k2++) {
      const before = (await rowsOf(p, 'p-reps')).length;
      await p.click('#p-run'); await p.waitForFunction(n => Lab._reg.tables.find(t => t.el.id === 'p-reps').getRows().length > n, before, { timeout: 20000 }); await sleep(100);
      const m = await txt(p, '#p-msg'); if (/reached the barrel/.test(m)) hit = m;
    }
    ok(!!hit, 'found a run whose seed plug reached the end of the capillary: ' + hit);
    if (hit) {
      const rs = await rowsOf(p, 'p-table'), rp2 = await rowsOf(p, 'p-reps'), at = parseFloat(hit.match(/at ([\d.]+) min/)[1]);
      const ok2 = rs.filter(r => typeof r.e === 'number');
      ok(rs.some(r => r.e == null) && rs.every(r => r.e != null || r.t >= at - 0.05) && ok2.every(r => r.t < at + 0.05), `readings after ${at} min are blank, earlier ones kept`);
      const F2 = fit(ok2.map(r => r.t), ok2.map(r => (r.e - r.c) * UL));
      ok(ok2.length >= 3 ? near(rp2[rp2.length - 1].rate, F2.m, 1e-9) : !Number.isFinite(rp2[rp2.length - 1].rate), `rate uses only the readings before the plug stopped (${ok2.length} readings, slope ${F2.m.toFixed(3)})`);
      const tb2 = await cells(p, 'p-table');
      ok(rs.every((r, i) => r.e != null || tb2.body[i][2] === ''), 'blank seed cells after the plug stopped');
      const ch2 = await chartOpts(p, 'p-chart'); const cs2 = ch2.series.find(s => /Corrected/.test(s.name));
      ok(cs2.points.length === ok2.length, 'graph leaves the stopped readings out');
      ok(near(parseFloat(await txt(p, '#p-e')), 6.8, 0.005), 'seed tile stops at the end of the capillary (6.80 cm)');
      /* the checker skips the stopped rows */
      let pv = 0, tot = 0;
      for (let i = 0; i < rs.length; i++) { const r = rs[i]; if (typeof r.e !== 'number') continue; await typeCell(p, 'p-table', i, 'de', (i === 0 ? 0 : r.e - pv).toFixed(2)); pv = r.e; await typeCell(p, 'p-table', i, 'corr', (r.e - r.c).toFixed(2)); tot += 2; }
      await p.evaluate(() => document.querySelector('#p-check').click()); await sleep(150);
      ok((await txt(p, '#p-check-msg')) === `All ${tot} entries are correct.`, 'checker grades only the rows with a reading: ' + await txt(p, '#p-check-msg'));
    }
  }
}

async function gasSensors(p, who, all) {
  console.log(`\n== [${who}] Option 2 gas sensors`);
  await D.show(p, 'gas-sensors');
  const runs = all ? [['o2', true], ['o2', false], ['co2', false], ['co2', true], ['p', true], ['p', false]] : [['o2', false]];
  for (const [sensor, koh] of runs) {
    await setv(p, '#g-sensor', sensor); await setv(p, '#g-contents', 'peas');
    await p.evaluate(k => { const e = document.querySelector('#g-koh'); e.checked = k; e.dispatchEvent(new Event('change', { bubbles: true })); }, koh);
    const n0 = (await rowsOf(p, 'g-table')).length;
    await p.click('#g-run'); await p.waitForFunction(n => Lab._reg.tables.find(t => t.el.id === 'g-table').getRows().length > n, n0, { timeout: 20000 }); await sleep(150);
    const ch = await chartOpts(p, 'g-chart'), pts = ch.series[0].points, g = (await rowsOf(p, 'g-table')).pop();
    const F = fit(pts.map(q => q.x), pts.map(q => q.y));
    const exp = sensor === 'o2' ? -F.m / 100 * 242000 : sensor === 'co2' ? (koh ? NaN : F.m * 1e-6 * 242000) : (koh ? -F.m / 101.3 * 242000 : NaN);
    const unit = { o2: '%', co2: 'ppm', p: 'kPa' }[sensor];
    ok(pts.length === 51 && pts[0].x === 0 && pts[50].x === 25 && ch.xLabel === 'Time (min)' && ch.yLabel === { o2: 'O₂ (%)', co2: 'CO₂ (ppm)', p: 'Pressure (kPa)' }[sensor], `${sensor}${koh ? '+KOH' : ''}: 51 readings over 25 min; axes Time (min) vs ${ch.yLabel}`);
    ok(near(g.slope, F.m, 1e-9) && (await txt(p, '#g-slope')) === `${f(F.m, sensor === 'co2' ? 1 : 4)} ${unit}/min`, `${sensor}${koh ? '+KOH' : ''}: slope ${F.m.toFixed(5)} ${unit}/min matches table and tile`);
    if (Number.isFinite(exp)) ok(near(g.o2, exp, 1e-6) && (await txt(p, '#g-o2')) === f(exp, 1) + ' µL/min' && exp > 15 && exp < 120, `${sensor}${koh ? '+KOH' : ''}: O₂ used = ${exp.toFixed(1)} µL/min (25 peas ≈ 45 µL/min at 20 °C)`);
    else ok(g.o2 == null && /can.t tell/.test(await txt(p, '#g-o2')), `${sensor}${koh ? '+KOH' : ''}: no O₂ figure (${sensor === 'co2' ? 'KOH scrubs the CO₂' : 'without KOH, CO₂ replaces O₂ and pressure stays flat'})`);
    if (sensor === 'o2') ok(F.m < 0, 'O₂ % falls');
    if (sensor === 'co2') ok(koh ? pts[50].y < 100 : F.m > 0, koh ? 'with KOH, CO₂ is scrubbed toward 0 ppm' : 'without KOH, CO₂ rises');
    if (sensor === 'p') ok(koh ? F.m < 0 : Math.abs(-F.m / 101.3 * 242000) < 5, koh ? 'with KOH, pressure falls' : 'without KOH, pressure is about flat');
    ok((await txt(p, '#g-read')) === `${f(pts[50].y, { o2: 3, co2: 0, p: 2 }[sensor])} ${unit}`, `${sensor}: reading tile shows the last logged point`);
  }
  const gt = await cells(p, 'g-table');
  ok(/Bath temp \(°C\)/.test(gt.head[2]) && /Slope \(sensor units\/min\)/.test(gt.head[5]) && /O₂ used \(µL\/min\)/.test(gt.head[6]), 'gas table headers carry units');
}

async function design(p, who) {
  console.log(`\n== [${who}] Design trials, Q10`);
  await D.show(p, 'design');
  await p.evaluate(() => { const s = Lab.stats, orig = s.linreg; window.__fits = []; s.linreg = function (xs, ys) { window.__fits.push({ xs: xs.slice(), ys: ys.slice() }); return orig.apply(this, arguments); }; });
  const MASS = { fastplant: 0.30, boiled: 0.30, cricket: 0.45 };
  const trial = async (org, temp, reps, interval) => {
    await setv(p, '#d-org', org); await setv(p, '#d-temp', temp); await setv(p, '#d-reps', reps); await setv(p, '#d-int', interval);
    await p.evaluate(() => { window.__fits = []; });
    const n0 = (await rowsOf(p, 'd-table')).length;
    await p.click('#d-run'); await p.waitForFunction(n => Lab._reg.tables.find(t => t.el.id === 'd-table').getRows().length >= n, n0 + reps, { timeout: 20000 }); await sleep(150);
    const rows = (await rowsOf(p, 'd-table')).slice(n0);
    const fits = await p.evaluate(() => window.__fits.filter(f => f.xs.length && f.xs.every((x, i) => i === 0 || x > f.xs[i - 1]) && f.xs[0] === 0));
    return { rows, fits, msg: await txt(p, '#d-msg') };
  };
  /* rows whose plug ran out too early have no fit; the rest map 1:1, in order, to the slope calls made for them */
  const verify = (lbl, org, interval, r) => {
    let fi = 0, okRate = true, okPer = true, okX = true, okY = true;
    r.rows.forEach(row => {
      if (!Number.isFinite(row.rate)) return;
      const ft = r.fits[fi++]; if (!ft) { okRate = false; return; }
      const F = fit(ft.xs, ft.ys);
      if (!near(row.rate, F.m, 1e-9)) okRate = false;
      if (!near(row.perg, row.rate / MASS[org], 1e-9) || row.mass !== MASS[org]) okPer = false;
      if (!ft.xs.every((x, i) => near(x, i * interval, 1e-9)) || ft.xs[ft.xs.length - 1] > 25) okX = false;
      if (!ft.ys.every(y => near(y / UL * 100, Math.round(y / UL * 100), 1e-6))) okY = false;   // y = (C seeds − C beads, each to 0.01 cm) × 5.03
    });
    ok(okRate, `${lbl}: each trial's rate = slope of its corrected O₂ readings vs time`);
    ok(okPer, `${lbl}: per gram = rate ÷ ${MASS[org]} g`);
    ok(okX && okY, `${lbl}: fitted readings are every ${interval} min from 0, each (C seeds − C beads in 0.01 cm) × 5.03 µL/cm`);
  };
  let r = await trial('boiled', 25, 3, 5); verify('boiled seeds 25 °C', 'boiled', 5, r);
  ok(r.rows.every(x => Math.abs(x.rate) < 0.08), 'boiled seeds: rate ≈ 0, within reading noise (may be slightly negative): ' + r.rows.map(x => x.rate.toFixed(3)).join(', '));
  const cellsD = await cells(p, 'd-table');
  const lastBody = cellsD.body.slice(-3);
  ok(lastBody.every((c, i) => c[5] === f(r.rows[i].rate, 3) && c[7] === f(r.rows[i].perg, 2) && c[6] === '0.30'), 'design table shows zero/negative rates with their sign (rate 0.001, per gram 0.01)');
  r = await trial('cricket', 35, 1, 5);
  ok(!Number.isFinite(r.rows[0].rate) && r.rows[0].note === 'plug hit barrel too soon' && (await txt(p, '#d-last')) === '—' && (await txt(p, '#d-lastg')) === '—', 'cricket at 35 °C, 5-min readings: plug hits the end before 3 readings, so no rate (—) and a note');
  ok(/reached the barrel before 25 min/.test(r.msg), 'design message explains the plug reached the end');
  r = await trial('cricket', 20, 2, 1); verify('cricket every 1 min', 'cricket', 1, r);
  ok(r.rows.every(x => /^plug hit barrel at \d+ min$/.test(x.note) && Number.isFinite(x.rate)), 'cricket, 1-min readings: rate from the readings before the plug stopped: ' + r.rows.map(x => x.note).join('; '));
  ok(r.rows.every((x, i) => { const at = +x.note.match(/at (\d+) min/)[1], ft = r.fits[i]; return ft && ft.xs[ft.xs.length - 1] <= at + 0.5; }), 'no reading at or after the stop time is used');
  const ld = await txt(p, '#d-last'), lr = r.rows[r.rows.length - 1];
  ok(ld === f(lr.rate, 2) + ' µL/min' && (await txt(p, '#d-lastg')) === f(lr.rate / 0.45, 2), `last-rate tiles: ${ld}, ${await txt(p, '#d-lastg')} per g`);
  for (const t of [15, 25, 45]) { r = await trial('fastplant', t, 3, 5); verify(`Fast Plant ${t} °C`, 'fastplant', 5, r); }
  const all = await rowsOf(p, 'd-table'), fp = all.filter(x => x.org === 'fastplant');
  const m = t => mean(fp.filter(x => x.temp === t).map(x => x.rate));
  ok(m(25) > m(15) * 1.6 && m(25) < m(15) * 3.4, `Fast Plant rate rises with temperature (Q10 ≈ 2–3): ${m(15).toFixed(2)} → ${m(25).toFixed(2)} µL/min`);
  ok(m(45) < m(25), `heat damage at 45 °C: ${m(45).toFixed(2)} < ${m(25).toFixed(2)} µL/min`);
  /* summary by temperature */
  const sum = await p.evaluate(() => [...document.querySelectorAll('#d-summary tbody tr')].map(tr => [...tr.cells].map(c => c.textContent.trim())));
  const head = await p.evaluate(() => [...document.querySelectorAll('#d-summary thead th')].map(th => th.textContent.replace(/\s+/g, ' ').trim()));
  ok(/Temperature \(°C\)/.test(head[0]) && head.slice(2).every(h => /\(µL·g⁻¹·min⁻¹\)/.test(h)), 'summary headers: ' + head.join(' | '));
  const fin = all.filter(x => Number.isFinite(x.perg)), temps = [...new Set(fin.map(x => x.temp))].sort((a, b) => a - b);
  ok(sum.length === temps.length && temps.every((t, i) => { const a = fin.filter(x => x.temp === t).map(x => x.perg); return sum[i][0] === String(t) && sum[i][1] === String(a.length) && sum[i][2] === f(mean(a), 2) && sum[i][3] === (a.length > 1 ? f(sd(a), 2) : '—') && sum[i][4] === (a.length > 1 ? f(2 * sd(a) / Math.sqrt(a.length), 2) : '—'); }), 'summary: n, mean, SD, ±2 SE per temperature recomputed from the per-gram rates (no-rate trials left out)');
  const dc = await chartOpts(p, 'd-chart');
  ok(dc.xLabel === 'Temperature (°C)' && dc.yLabel === 'O₂ uptake (µL·g⁻¹·min⁻¹)', 'design graph axes: Temperature (°C) vs O₂ uptake (µL·g⁻¹·min⁻¹)');
  /* Q10 key result: ln(rate per g) vs T, Fast Plant trials up to 35 °C with a positive rate */
  const q = fp.filter(x => x.temp <= 35 && x.perg > 0), Fq = fit(q.map(x => x.temp), q.map(x => Math.log(x.perg))), Q10 = Math.exp(10 * Fq.m);
  const kq = (await p.evaluate(() => Lab.keyResults())).find(x => x.id === 'q10');
  ok(kq && kq.value === +f(Q10, 2) && /trials up to 35/.test(kq.label), `Q10 key result = exp(10 × slope of ln(rate/g) vs T) = ${Q10.toFixed(3)} (page ${kq && kq.value}); 45 °C left out`);
  ok(Q10 > 1.7 && Q10 < 3.2, 'Q10 is in the 2–3 range typical of enzyme-driven respiration');
  /* Q10 calculator: Use my data leaves out 45 °C (fix), like the key result */
  await p.evaluate(() => document.querySelector('#q-mine').click()); await sleep(150);
  const qv = await p.evaluate(() => ['#q-t1', '#q-r1', '#q-t2', '#q-r2'].map(s => document.querySelector(s).value));
  ok(qv[0] === '15' && qv[2] === '25', `"Use my data" picks 15 and 25 °C, not the heat-damaged 45 °C trials: T1 ${qv[0]}, T2 ${qv[2]}`);
  ok(qv[1] === f(m(15), 2) && qv[3] === f(m(25), 2), `"Use my data" fills the mean rates (µL O₂/min): ${qv[1]}, ${qv[3]}`);
  ok((await txt(p, '#q-out')) === f(Math.pow(+qv[3] / +qv[1], 10 / (25 - 15)), 2), `Q10 = (R2/R1)^(10/(T2−T1)) = ${await txt(p, '#q-out')}`);
  ok(/left out/.test(await txt(p, '#q-msg')), 'calculator says the trials above 35 °C were left out');
  /* calculator edge cases */
  await p.evaluate(() => document.querySelector('#q-example').click()); await sleep(100);
  ok((await txt(p, '#q-out')) === f(Math.pow(4.1 / 1.8, 1), 2), 'worked example (15 °C 1.8, 25 °C 4.1) gives Q10 = 2.28');
  await setv(p, '#q-t1', '15'); await setv(p, '#q-t2', '25'); await setv(p, '#q-r1', '0'); await setv(p, '#q-r2', '2');
  ok((await txt(p, '#q-out')) === '—', 'zero rate: no Q10');
  await setv(p, '#q-r1', '-1'); ok((await txt(p, '#q-out')) === '—', 'negative rate: no Q10');
  await setv(p, '#q-r1', ''); await setv(p, '#q-r2', ''); ok((await txt(p, '#q-out')) === '—', 'blank rates: no Q10');
  await setv(p, '#q-r1', '1'); await setv(p, '#q-r2', '2'); await setv(p, '#q-t2', '15'); ok((await txt(p, '#q-out')) === '—', 'same temperature twice: no Q10');
  await setv(p, '#q-t2', '20'); ok((await txt(p, '#q-out')) === f(Math.pow(2, 10 / 5), 2), '5 °C apart: (2/1)^(10/5) = 4.00');
}

(async () => {
  const b = await T.launch();
  await textChecks(b);
  for (const who of IDS) {
    const ctx = await ctxAs(b, who), p = await T.open(ctx, 'lab06.html');
    await microrespirometer(p, who, who === IDS[0]);
    await gasSensors(p, who, who === IDS[0]);
    await design(p, who);
    ok(p.errors.length === 0, `[${who}] no page errors ` + p.errors.join(' | '));
    await ctx.close();
  }
  await b.close(); T.done('t60-lab6-numbers');
})();
