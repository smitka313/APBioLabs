/* Reference checks for the Peat Bog Carbon Lab model (OpenSciEd B.2 companion). Values are hand-computed or come from an independent
   calculation (numeric integration of sunlight, the formulas written out again), plus the reference values of the owner's student worksheet key. */
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../openscied-b2-peat-bog-logic.js');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' expected ' + b + ' got ' + a);
const rd = x => Math.round(x) + 0;   // no negative zero
const R = (o) => { const m = L.model(o); return [rd(m.P), rd(m.D), rd(m.B), rd(m.N)]; };
const D = L.DEFAULTS;

test('solstice sunlight at 65 N matches a numeric integral of S0 x cos(zenith) over the day', () => {
  for (const tilt of [22.1, 23.44, 24.5]) {
    const f = 65 * Math.PI / 180, d = tilt * Math.PI / 180;
    let sum = 0; const N = 200000;
    for (let i = 0; i < N; i++) {
      const h = -Math.PI + (i + 0.5) * 2 * Math.PI / N;                       // hour angle over the full day
      const c = Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(h);
      if (c > 0) sum += 1361 * c;
    }
    near(L.solstice(tilt), sum / N, 0.05, 'tilt ' + tilt);
  }
  near(L.Q_NOW, 493.6, 0.2);
  near(L.noonSun(23.44), 48.44, 1e-9); near(L.arcticCircle(23.44), 66.56, 1e-9);
});
test('tilt warming is 0.1 C per W/m2 of extra sunlight, and the worksheet reference rows hold', () => {
  near(L.tiltWarming(23.44), 0, 1e-12);
  near(L.tiltWarming(22.1), 0.1 * (L.solstice(22.1) - L.solstice(23.44)), 1e-12);
  near(10 + L.tiltWarming(22.1), 7.8, 0.05); near(10 + L.tiltWarming(24.2), 11.3, 0.05); near(10 + L.tiltWarming(24.5), 11.8, 0.05);
  near((L.model(Object.assign({}, D, { tilt: 22.1 })).relQ - 1) * 100, -4.5, 0.05); near((L.model(Object.assign({}, D, { tilt: 24.5 })).relQ - 1) * 100, 3.7, 0.05);
  assert.deepEqual(R(Object.assign({}, D, { tilt: 22.1 })).slice(0, 2), [21, 10]);
  assert.deepEqual(R(Object.assign({}, D, { tilt: 24.2 })).slice(0, 2), [34, 20]);
});
test('default bog by hand: P = 28.6, D = 16.4, no fire, peat carbon +13 (29 - 16 - 0 from the displayed numbers)', () => {
  // light 0.8; CO2 1.2*370/770 = 0.5766; T = 10 -> exp(-(8/12)^2) = 0.6412; water 0.3+0.7*(1-exp(-3)) = 0.9335; oxygen 1.15-0.147 = 1.003
  const P = 100 * 0.8 * (1.2 * 370 / 770) * Math.exp(-Math.pow(8 / 12, 2)) * (0.3 + 0.7 * (1 - Math.exp(-3))) * (1.15 - 0.147);
  // soilO2 = 1 * (1 - 0.6375) = 0.3625 ; factor 1.3*0.3625/0.6625 = 0.7113 ; D = 30 * 2^(-0.2) * 0.7113 * (1 - 0.95*0.125)
  const so = 1 - 0.85 * 0.75, Dd = 30 * Math.pow(2, -0.2) * (so * 1.3 / (so + 0.3)) * (1 - 0.95 * 0.125);
  const m = L.model(D);
  near(m.P, P, 1e-9); near(m.D, Dd, 1e-9); near(P, 28.6, 0.05); near(Dd, 16.4, 0.05);
  assert.equal(m.B, 0); assert.equal(m.N, Math.round(P) - Math.round(Dd)); assert.deepEqual(R(D), [29, 16, 0, 13]);
  near(m.perm, 0.125, 1e-12); near(m.peatO2, 21 * (1 - 0.6375), 1e-9);
});
test('worksheet reference tables: water level, temperature, carbon dioxide', () => {
  const wet = { 90: [29, 13, 16], 75: [29, 16, 13], 50: [27, 20, 7], 25: [22, 22, 0], 10: [16, 23, -7] };
  for (const w in wet) { const r = R(Object.assign({}, D, { wet: +w })); assert.deepEqual([r[0], r[1], r[3]], wet[w], 'wet ' + w); }
  const temp = { 0: [5, 0, 100, 5], 5: [14, 4, 75, 10], 10: [29, 16, 13, 13], 15: [42, 26, 0, 16], 20: [43, 37, 0, 6], 25: [24, 53, 0, -29] };
  for (const t in temp) { const m = L.model(Object.assign({}, D, { temp: +t })); assert.deepEqual([rd(m.P), rd(m.D), rd(m.perm * 100), rd(m.N)], temp[t], 'temp ' + t); }
  const co2 = { 200: [16, 16, 0], 420: [29, 16, 13], 800: [39, 16, 23], 1200: [44, 16, 28] };
  for (const c in co2) { const r = R(Object.assign({}, D, { co2: +c })); assert.deepEqual([r[0], r[1], r[3]], co2[c], 'co2 ' + c); }
});
test('trends: more light, CO2 and (up to the optimum) heat raise photosynthesis; warmer is always faster decomposition; dry and oxygen-rich burns more', () => {
  const P = o => L.model(Object.assign({}, D, o)).P;
  assert.ok(P({ tilt: 24.5 }) > P({ tilt: 23.44 }) && P({ tilt: 23.44 }) > P({ tilt: 22.1 }));
  assert.ok(P({ co2: 800 }) > P({ co2: 420 }) && P({ co2: 420 }) > P({ co2: 100 }));
  assert.ok(P({ temp: 15 }) > P({ temp: 10 }) && P({ temp: 25 }) < P({ temp: 18 }));
  let prev = -1; for (let t = -5; t <= 30; t++) { const d = L.model(Object.assign({}, D, { temp: t })).D; assert.ok(d >= prev - 1e-9, 'decomposition not monotonic at ' + t); prev = d; }
  const B = o => L.model(Object.assign({}, D, { burn: 60 }, o)).B;
  assert.ok(B({ wet: 10 }) > B({ wet: 50 }) && B({ wet: 50 }) > B({ wet: 90 }));
  assert.ok(B({ o2: 30, wet: 30 }) > B({ o2: 21, wet: 30 }) && B({ o2: 12 }) === 0 && B({ o2: 5 }) === 0);
  assert.ok(L.model(Object.assign({}, D, { wet: 10 })).D > L.model(Object.assign({}, D, { wet: 90 })).D, 'drier peat decomposes faster');
  assert.equal(B({ temp: -5 }), 0, 'frozen peat does not burn');
});
test('burning and decomposition: opposite to photosynthesis in the sense that CO2 only raises photosynthesis', () => {
  const a = L.model(D), b = L.model(Object.assign({}, D, { co2: 1500 }));
  assert.ok(b.P > a.P); near(b.D, a.D, 1e-12);
});
test('extremes and invalid input never give NaN, negatives or values above 100', () => {
  const bad = [undefined, null, NaN, Infinity, -Infinity, 'abc', '', {}, [], true, -1e9, 1e9, '12'];
  for (const x of bad) {
    const m = L.model({ tilt: x, temp: x, co2: x, o2: x, wet: x, burn: x });
    for (const k of ['P', 'D', 'B', 'T', 'perm', 'soilO2', 'peatO2', 'q']) assert.ok(isFinite(m[k]), k + ' finite for ' + String(x));
    assert.ok(m.P >= 0 && m.P <= 100 && m.D >= 0 && m.D <= 100 && m.B >= 0 && m.B <= 100 && m.perm >= 0 && m.perm <= 1);
    const z = L.zombie({ tilt: x }, m); assert.ok(z.chance >= 0 && z.chance <= 95);
  }
  const corners = [];
  for (const tilt of [22.1, 24.5]) for (const temp of [-5, 30]) for (const co2 of [0, 2000]) for (const o2 of [0, 35]) for (const wet of [0, 100]) for (const burn of [0, 100]) corners.push({ tilt, temp, co2, o2, wet, burn });
  for (const s of corners) {
    const m = L.model(s), z = L.zombie(s, m), o = L.trialOutputs(s);
    for (const v of [m.P, m.D, m.B, m.N, m.T, z.chance, o.P, o.N]) assert.ok(Number.isFinite(v));
    assert.ok(m.P >= 0 && m.D >= 0 && m.B >= 0 && m.P <= 100 && m.D <= 100 && m.B <= 100);
    L.notes(s, m).forEach(n => assert.ok(n.text.length && !/NaN|undefined/.test(n.text)));
  }
  assert.equal(L.sanitize({ wet: 500 }).wet, 100); assert.equal(L.sanitize({ co2: -3 }).co2, 0); assert.equal(L.sanitize(null).temp, 10); assert.equal(L.sanitize({ temp: '18' }).temp, 18);
  assert.equal(L.model({ o2: 0, co2: 0 }).P, 0, 'no CO2: no photosynthesis');
  assert.equal(L.model({ co2: 50 }).P, 0, 'at the 50 ppm compensation point there is none');
});
test('zombie fire chance matches the worksheet table and falls as the water rises', () => {
  const Z = w => L.zombie(Object.assign({}, L.ZOMBIE_SETUP, { wet: w })).chance;
  assert.deepEqual([22, 40, 50, 60, 75].map(Z), [95, 76, 52, 30, 10]);
  for (let w = 0; w < 100; w++) assert.ok(Z(w + 1) <= Z(w), 'monotonic at ' + w);
  assert.equal(L.zombie(D).chance, 0, 'no fire, no zombie fire');
  assert.equal(L.weakestZombieFactor(L.zombie(D)), 'fire');
  assert.match(L.seasonCaption(2, L.zombie(L.ZOMBIE_SETUP), 22), /smolders slowly/);
  assert.match(L.seasonCaption(2, L.zombie(Object.assign({}, L.ZOMBIE_SETUP, { wet: 75 })), 75), /Water filled the air spaces/);
});
test('carbon budget to 2100 matches the worksheet table and hand arithmetic for the first year', () => {
  const r = L.climate(10, 100);
  // 2025: land = 0.018*145 = 2.61, ocean 2.61, clear 0 -> dC = (10 - 5.22)/2.12 = 2.2547 ppm
  near(r[0].land, 2.61, 1e-9); near(r[0].ocean, 2.61, 1e-9); near(L.ppmChange(r[0]), 4.78 / 2.12, 1e-9); near(r[1].C, 425 + 4.78 / 2.12, 1e-9);
  near(r[0].T, 2 * Math.log2(425 / 280), 1e-12);
  const at = (f, fo) => { const x = L.climate(f, fo)[75]; return [Math.round(x.C), +x.T.toFixed(1)]; };
  assert.deepEqual(at(10, 100), [521, 1.8]); assert.deepEqual(at(15, 100), [621, 2.3]); assert.deepEqual(at(10, 50), [599, 2.2]); assert.deepEqual(at(5, 100), [421, 1.2]); assert.deepEqual(at(2, 150), [345, 0.6]);
  assert.ok(L.climate(0, 150).every(x => x.C >= 280 && isFinite(x.T) && x.land >= 0 && x.ocean >= 0));
  assert.ok(L.climate(20, 25)[75].C > L.climate(10, 100)[75].C);
  const bad = L.climate(NaN, 'x'); assert.equal(bad.length, 76); assert.ok(bad.every(x => isFinite(x.C)));
  assert.deepEqual(L.sanitizeClimate({ fossil: 99, forest: 1, year: 1900 }), { fossil: 20, forest: 25, year: 2025 });
  assert.equal(L.heatTrapped(280), 1); assert.ok(L.heatTrapped(560) > L.heatTrapped(300)); assert.ok(L.heatTrapped(5000) <= 6);
});
test('"Test the bog in this year" gives that year\'s CO2 and an amplified Arctic warming', () => {
  const r = L.climate(10, 100), b = L.bogForYear(r, 2100);
  assert.equal(b.co2, 520); assert.equal(b.temp, Math.round(10 + 2.5 * (r[75].T - r[0].T))); assert.equal(b.tilt, 23.44);
  assert.equal(L.bogForYear(r, 2025).temp, 10); assert.equal(L.bogForYear(r, 9999).co2, b.co2);
});
test('trials store inputs only and recompute outputs; CSV is labelled simulated and quotes safely', () => {
  const t = { tilt: 23.44, temp: 10, co2: 420, o2: 21, wet: 75, burn: 0, label: 'My "test", 1', id: 7, at: 5, P: 999 };
  const o = L.trialOutputs(t); assert.deepEqual([o.P, o.D, o.B, o.N, o.perm], [29, 16, 0, 13, 13]); near(o.Teff, 10, 1e-9);
  const row = L.trialRow(t, 1); assert.equal(row.N, '+13'); assert.equal(row.tilt, '23.44');
  const c = L.csv([t]).split('\r\n'); assert.equal(c.length, 2); assert.match(c[1], /"My ""test"", 1"/); assert.match(c[1], /Simulated/);
  assert.match(c[0], /simulated/);
  const clean = L.cleanTrials([t, null, 5, { wet: 9999, label: 7 }]); assert.equal(clean.length, 2); assert.equal(clean[1].wet, 100); assert.equal(clean[1].label, ''); assert.equal(clean[0].P, undefined);
  assert.deepEqual(L.cleanTrials('x'), []);
  assert.equal(L.autoLabel(D), 'Starting values'); assert.equal(L.autoLabel(Object.assign({}, D, { wet: 10, temp: 20 })), 'Changed: Temperature + Water level'); assert.equal(L.autoLabel(D, 'zombie'), 'Experiment D: Zombie fire');
});
test('explore series covers the full slider range with 0..100 values, and describeBog states the verdict', () => {
  for (const v of L.VARS) { const e = L.exploreSeries(D, v.key, 20); assert.equal(e.xs[0], v.min); near(e.xs[20], v.max, 1e-9); assert.ok([...e.P, ...e.D, ...e.B].every(x => x >= 0 && x <= 100)); }
  assert.match(L.describeBog(L.model(D)), /a carbon sink/); assert.match(L.describeBog(L.model(Object.assign({}, D, { wet: 10, burn: 70, temp: 16 }))), /carbon is released/);
  assert.equal(L.exploreSeries(D, 'nope', 5).v.key, 'temp');
});
test('every preset is within slider ranges, and Reset equals the defaults', () => {
  for (const p of L.PRESETS) assert.deepEqual(L.sanitize(p.values), p.values);
  assert.ok(L.same(L.sanitize({}), D));
  assert.ok(L.model(L.PRESETS[3].values).N < 0 && L.model(D).N > 0 && L.model(L.PRESETS[5].values).N > -30);
});
