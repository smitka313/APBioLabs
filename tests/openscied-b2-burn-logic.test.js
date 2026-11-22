/* Reference checks for the Burning Fuels model (B.2 Lesson 2): hand-computed values, many student seeds, invalid input, no NaN or impossible
   values, the facts the lesson depends on (peat ignites last and burns longest, charcoal gives the most heat per gram, mass after is below mass
   before), and the data-based checks. Run: node --test tests/openscied-b2-burn-logic.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../openscied-b2-burn-logic.js');

const SEEDS = Array.from({ length: 400 }, (_, i) => L.hash32('student-' + i));
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, (msg || '') + ' got ' + a + ' expected ' + b);
const record = (seed, list) => ({ seed, fuel: 'grass', current: null, records: list.map(([fuel, n]) => ({ fuel, n, obs: [] })) });

test('the five fuels carry the nominal values from the plan', () => {
  assert.deepEqual(L.FUEL_IDS, ['grass', 'leaves', 'wood', 'charcoal', 'peat']);
  assert.deepEqual(L.FUELS.map(f => f.ignite), [4, 6, 14, 28, 45]);
  assert.deepEqual(L.FUELS.map(f => f.burn), [20, 30, 90, 150, 260]);
  assert.deepEqual(L.FUELS.map(f => f.loss), [0.93, 0.90, 0.97, 0.88, 0.78]);
  assert.deepEqual(L.FUELS.map(f => f.kj), [15, 16, 18, 29, 20]);
});

test('BTB: hand-computed readings, labels and colors', () => {
  assert.equal(L.btbLabel(1), 'deep blue'); assert.equal(L.btbLabel(2), 'blue'); assert.equal(L.btbLabel(3.4), 'blue-green'); assert.equal(L.btbLabel(4), 'green');
  assert.equal(L.btbLabel(5), 'yellow-green'); assert.equal(L.btbLabel(6), 'yellow'); assert.equal(L.btbLabel(NaN), 'blue'); assert.equal(L.btbLabel(99), 'yellow');
  assert.equal(L.btbText(3.6), 'green (3.6)'); assert.equal(L.btbText(3.4), 'blue-green (3.4)');
  assert.equal(L.btbFromDissolved(0), 2);
  near(L.btbFromDissolved(3.5), 2 + 4 * (1 - Math.exp(-1)), 1e-9); // 4.528
  assert.ok(L.btbFromDissolved(1e9) <= 6 && L.btbFromDissolved(-5) === 2 && L.btbFromDissolved(NaN) === 2);
  assert.deepEqual(L.btbColor(2), L.BTB_RGB[1]); assert.deepEqual(L.btbColor(NaN), L.BTB_RGB[1]);
  near(L.dissolvedFraction(0), 0.35, 1e-9); near(L.dissolvedFraction(80), 0.35 + 0.45 * (1 - Math.exp(-1)), 1e-9); assert.ok(L.dissolvedFraction(1e6) < 0.8001);
});

test('every burn is possible: no NaN, mass after below mass before, temperature never falls, BTB 2 to 6, times positive, for 400 students x 5 fuels x 3 samples', () => {
  for (const seed of SEEDS) for (const f of L.FUEL_IDS) for (let n = 1; n <= 3; n++) {
    const r = L.burnResult(seed, f, n);
    for (const k of Object.keys(r)) if (typeof r[k] === 'number') assert.ok(Number.isFinite(r[k]), f + ' ' + k);
    assert.ok(r.massBefore >= 9.8 && r.massBefore <= 10.2, 'mass before ' + r.massBefore);
    assert.ok(r.massAfter > 0 && r.massAfter < r.massBefore, f + ' mass after ' + r.massAfter + ' before ' + r.massBefore);
    assert.ok(r.tempAfter >= r.tempBefore && r.tempBefore >= 21 && r.tempBefore <= 23, 'temperature');
    assert.ok(r.dT >= 4 && r.dT <= 22);
    assert.ok(r.btbAfter >= 2 && r.btbAfter <= 6 && r.btbAfter > r.btbBefore, f + ' btb ' + r.btbAfter);
    assert.ok(r.igniteS >= 1 && r.burnS >= 1 && r.runS === r.igniteS + r.burnS + L.TAIL);
    assert.ok(Number.isInteger(r.igniteS) && Number.isInteger(r.burnS) && Number.isInteger(r.tempBefore) && Number.isInteger(r.tempAfter));
    near(r.massBefore * 10, Math.round(r.massBefore * 10), 1e-6); near(r.massAfter * 10, Math.round(r.massAfter * 10), 1e-6);
  }
});

test('the same seed, fuel and sample always give the same numbers; another sample or student differs a little', () => {
  const a = L.burnResult(12345, 'wood', 1), b = L.burnResult(12345, 'wood', 1);
  assert.deepEqual(a, b);
  let diffSample = 0, diffStudent = 0;
  for (const seed of SEEDS.slice(0, 100)) {
    const s1 = L.burnResult(seed, 'wood', 1), s2 = L.burnResult(seed, 'wood', 2);
    if (s1.burnS !== s2.burnS || s1.kjPerG !== s2.kjPerG || s1.igniteS !== s2.igniteS) diffSample++;
    if (L.burnResult(seed + 1, 'wood', 1).kjPerG !== s1.kjPerG) diffStudent++;
  }
  assert.ok(diffSample > 90 && diffStudent > 90, diffSample + ' ' + diffStudent);
});

test('variation stays near the planned size and the means sit on the nominal values', () => {
  for (const f of L.FUELS) {
    const rs = SEEDS.map(s => L.burnResult(s, f.id, 1));
    const m = k => rs.reduce((a, r) => a + r[k], 0) / rs.length;
    near(m('igniteS') / f.ignite, 1, 0.03, f.id + ' ignite'); near(m('burnS') / f.burn, 1, 0.03, f.id + ' burn');
    near(m('kjPerG') / f.kj, 1, 0.02, f.id + ' heat');
    assert.ok(rs.every(r => r.igniteS >= f.ignite * 0.84 - 1 && r.igniteS <= f.ignite * 1.16 + 1), f.id + ' ignition within about 15 percent');
    assert.ok(rs.every(r => r.kjPerG >= f.kj * 0.915 && r.kjPerG <= f.kj * 1.085), f.id + ' heat within about 8 percent');
    assert.ok(rs.every(r => r.lossFrac >= Math.min(0.99, f.loss * 0.919) - 1e-9 && r.lossFrac <= Math.min(0.99, f.loss * 1.081) + 1e-9), f.id + ' mass loss within about 8 percent');
  }
});

test('the lesson facts hold for every student: peat ignites last and burns longest, charcoal gives the most heat per gram, peat keeps the most ash', () => {
  for (const seed of SEEDS) for (const n of [1, 2, 3]) {
    const r = Object.fromEntries(L.FUEL_IDS.map(f => [f, L.burnResult(seed, f, n)]));
    for (const f of L.FUEL_IDS) if (f !== 'peat') { assert.ok(r.peat.igniteS > r[f].igniteS, 'peat ignites after ' + f); assert.ok(r.peat.burnS > r[f].burnS, 'peat burns longer than ' + f); }
    for (const f of L.FUEL_IDS) if (f !== 'charcoal') { assert.ok(r.charcoal.kjPerG > r[f].kjPerG, 'charcoal heat per gram over ' + f); assert.ok(r.charcoal.dT > r[f].dT, 'charcoal true rise over ' + f); }
    for (const f of L.FUEL_IDS) if (f !== 'peat') assert.ok(r.peat.massAfter > r[f].massAfter - 0.21 && r.peat.burnedG < r[f].burnedG, 'peat leaves more ash than ' + f);
    assert.ok(r.grass.igniteS < r.leaves.igniteS && r.leaves.igniteS < r.wood.igniteS && r.wood.igniteS < r.charcoal.igniteS, 'ignition order');
    assert.ok(r.charcoal.btbAfter >= Math.max(r.grass.btbAfter, r.leaves.btbAfter, r.wood.btbAfter, r.peat.btbAfter), 'charcoal turns the BTB the most yellow');
    assert.ok(r.wood.btbAfter > r.grass.btbAfter - 0.01 || r.wood.btbAfter > 3.2, 'wood is at least as yellow as grass');
  }
});

test('charcoal is also the warmest as the student reads it, in nearly every table', () => {
  let ok = 0;
  for (const seed of SEEDS) { const r = L.FUEL_IDS.map(f => L.burnResult(seed, f, 1)); if (r.every(x => x.fuel === 'charcoal' || r.find(c => c.fuel === 'charcoal').tempRise > x.tempRise)) ok++; }
  assert.ok(ok / SEEDS.length > 0.98, ok + ' of ' + SEEDS.length);
});

test('hand-computed example: grass at nominal values', () => {
  // 10 g x 0.93 = 9.3 g burned; 15 kJ/g x 9.3 = 139.5 kJ; x 0.45 / 8 = 7.8 C; CO2 = 0.44 x 9.3 = 4.092; dissolved = 4.092 x (0.35 + 0.45 (1 - exp(-20/80)))
  const g = 10 * 0.93; near(15 * g * 0.45 / 8, 7.846875, 1e-9);
  const d = 0.44 * g * L.dissolvedFraction(20); near(d, 4.092 * 0.44946, 0.001); // 1.839
  near(L.btbFromDissolved(d), 2 + 4 * (1 - Math.exp(-d / 3.5)), 1e-9); assert.ok(L.btbFromDissolved(d) > 3.5 && L.btbFromDissolved(d) < 3.7);
  // the model reproduces the arithmetic: average over many students sits near the hand values
  const rs = SEEDS.map(s => L.burnResult(s, 'grass', 1));
  near(rs.reduce((a, r) => a + r.dT, 0) / rs.length, 7.85, 0.15); near(rs.reduce((a, r) => a + r.btbAfter, 0) / rs.length, 3.65, 0.1);
  near(rs.reduce((a, r) => a + r.massAfter, 0) / rs.length, 0.7, 0.1);
});

test('invalid input is handled: unknown fuel, bad sample number, bad seed', () => {
  const a = L.burnResult(NaN, 'plutonium', 99), b = L.burnResult(undefined, null, -4);
  for (const r of [a, b]) { assert.ok(L.FUEL_IDS.includes(r.fuel)); assert.ok(r.n >= 1 && r.n <= 3); for (const k of Object.keys(r)) if (typeof r[k] === 'number') assert.ok(Number.isFinite(r[k])); }
  assert.equal(L.normalizeFuel('x'), 'grass'); assert.equal(L.fuelLabel('x'), ''); assert.equal(L.btbText(NaN), 'blue (2.0)');
  assert.equal(L.simSeconds(1000, NaN, false, 50), 0); assert.equal(L.simSeconds(NaN, 1000, false, 50), 0); assert.equal(L.simSeconds(0, 1e12, false, 50), 50); assert.equal(L.simSeconds(0, 5, true, 50), 50); assert.equal(L.simSeconds(0, -9e9, false, 50), 0);
  assert.equal(L.cleanState(null), null); assert.equal(L.cleanState({ seed: 'x' }), null); assert.deepEqual(L.tableRows(null), []); assert.deepEqual(L.byFuel([]), []);
});

test('the timeline: heating, burning, dying out, done; mass and heat only go one way', () => {
  for (const seed of SEEDS.slice(0, 60)) for (const f of L.FUEL_IDS) {
    const r = L.burnResult(seed, f, 1);
    let prevMass = 11, prevTemp = -99, prevBtb = 0, order = ['heating', 'burning', 'dying', 'done'], at = 0;
    for (let t = 0; t <= r.runS; t += Math.max(1, r.runS / 80)) {
      const s = L.stateAt(r, t);
      assert.ok(order.indexOf(s.stage) >= at, 'stages in order'); at = order.indexOf(s.stage);
      assert.ok(s.massTrue <= prevMass + 1e-9 && s.massTrue > 0, 'mass falls'); prevMass = s.massTrue;
      assert.ok(s.temp >= prevTemp && s.btb >= prevBtb - 1e-9, 'temperature and BTB do not fall'); prevTemp = s.temp; prevBtb = s.btb;
      for (const k of ['flame', 'smoke', 'glow', 'progress', 'burnedFraction']) assert.ok(Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 1.0001, k + ' ' + s[k]);
      assert.equal(s.igniter, s.stage === 'heating');
    }
    const first = L.stateAt(r, 0), last = L.stateAt(r, r.runS * 5);
    assert.equal(first.stage, 'heating'); assert.equal(first.temp, r.tempBefore); assert.equal(first.btb, r.btbBefore);
    assert.equal(last.stage, 'done'); assert.equal(last.temp, r.tempAfter); assert.equal(last.btb, r.btbAfter); near(last.massTrue, 10 - r.burnedG, 0.01); assert.equal(last.flame, 0);
  }
  const peat = L.burnResult(7, 'peat', 1), mid = L.stateAt(peat, peat.igniteS + peat.burnS / 2), early = L.stateAt(peat, peat.igniteS / 2), g = L.burnResult(7, 'grass', 1), gm = L.stateAt(g, g.igniteS + g.burnS / 2);
  assert.ok(mid.smoke > 0.6 && mid.flame < 0.5 && mid.glow > 0.5, 'peat smolders: smoke and ember, little flame');
  assert.ok(early.smoke > 0 && early.flame === 0, 'peat smokes before it catches');
  assert.ok(gm.flame > 0.6 && gm.smoke < mid.smoke, 'grass flames bright');
  const c = L.burnResult(7, 'charcoal', 1), cm = L.stateAt(c, c.igniteS + 5);
  assert.ok(cm.flame < 0.2 && cm.glow > 0.7 && cm.smoke < 0.1, 'charcoal glows with little flame and little smoke');
});

test('the run clock is timestamp based: elapsed simulated seconds follow the clock, skip jumps to the end', () => {
  assert.equal(L.simSeconds(0, 1000, false, 500), L.RATE); assert.equal(L.simSeconds(0, 10000, false, 500), 10 * L.RATE); assert.equal(L.simSeconds(0, 0, true, 123), 123);
  const peat = L.burnResult(1, 'peat', 1); assert.ok(peat.runS / L.RATE < 70, 'peat takes about a minute on screen');
});

test('observation chips the picture shows for each fuel', () => {
  assert.deepEqual(L.obsTruth('grass'), ['bright-flame', 'smoke', 'ash']);
  assert.deepEqual(L.obsTruth('charcoal'), ['small-flame', 'glowing', 'ash']);
  assert.deepEqual(L.obsTruth('peat'), ['small-flame', 'smoke', 'glowing', 'ash']);
  assert.ok(L.obsTruth('wood').includes('glowing') && L.obsTruth('wood').includes('bright-flame'));
});

test('saved state is validated: bad records are dropped, duplicates removed, every number recomputed', () => {
  const s = L.cleanState({ seed: 5.9, fuel: 'nope', current: { fuel: 'peat', n: 9, startedAt: 10, skipped: 1 }, records: [{ fuel: 'peat', n: 1, obs: ['smoke', 'smoke', 'junk'] }, { fuel: 'peat', n: 1 }, { fuel: 'zzz', n: 1 }, null, { fuel: 'wood', n: 2 }] });
  assert.equal(s.seed, 5); assert.equal(s.fuel, 'grass'); assert.equal(s.records.length, 2); assert.deepEqual(s.records[0].obs, ['smoke']);
  assert.equal(s.current.n, 3); assert.equal(s.current.skipped, true);
  assert.equal(L.cleanState({ seed: 5, current: { fuel: 'peat', n: 1, startedAt: 10 }, records: [{ fuel: 'peat', n: 1 }] }).current, null, 'a sample cannot be both current and recorded');
  const rows = L.tableRows(record(99, [['peat', 1], ['grass', 1], ['grass', 2]]));
  assert.deepEqual(rows.map(r => r.fuel + r.n), ['grass1', 'grass2', 'peat1']);
  assert.deepEqual(rows[2], Object.assign(L.burnResult(99, 'peat', 1), { obs: [] }));
  assert.equal(L.nextSample(record(1, [['grass', 1]]), 'grass'), 2); assert.equal(L.nextSample(record(1, [['grass', 1], ['grass', 2], ['grass', 3]]), 'grass'), 0); assert.equal(L.nextSample(null, 'wood'), 1);
  assert.equal(L.samplesOf(record(1, [['grass', 1], ['wood', 1]]), 'grass'), 1);
});

test('chart series: a missing bar stays missing (NaN), one series per sample number', () => {
  const rows = L.tableRows(record(3, [['grass', 1], ['peat', 1], ['peat', 2]]));
  const ser = L.chartSeries(rows, 'rise');
  assert.deepEqual(ser.map(s => s.name), ['Sample 1', 'Sample 2']);
  assert.equal(ser[0].points.length, 5); assert.ok(Number.isNaN(ser[0].points[1].y) && Number.isFinite(ser[0].points[0].y) && Number.isFinite(ser[0].points[4].y));
  assert.ok(Number.isNaN(ser[1].points[0].y) && Number.isFinite(ser[1].points[4].y));
  assert.deepEqual(L.chartSeries([], 'rise'), []);
  for (const k of Object.keys(L.METRICS)) assert.ok(L.chartSeries(rows, k).every(s => s.points.every(p => Number.isNaN(p.y) || Number.isFinite(p.y))));
  assert.equal(L.chartSeries(rows, 'mass')[0].points[0].y, Math.round(rows[0].massLost * 10) / 10);
});

test('predictions are checked against the student table and recomputed when it changes', () => {
  const none = record(11, []);
  assert.equal(L.checkPrediction('grass', 'ignite', '', none).status, 'empty');
  assert.equal(L.checkPrediction('grass', 'ignite', 'quickly', none).status, 'nodata');
  const st = record(11, [['grass', 1], ['peat', 1]]);
  const grass = L.burnResult(11, 'grass', 1), peat = L.burnResult(11, 'peat', 1);
  assert.equal(L.checkPrediction('grass', 'ignite', 'quickly', st).status, 'correct'); assert.equal(L.checkPrediction('grass', 'ignite', 'slowly', st).status, 'wrong');
  assert.equal(L.checkPrediction('peat', 'ignite', 'slowly', st).status, 'correct'); assert.match(L.checkPrediction('peat', 'ignite', 'slowly', st).message, new RegExp('after ' + peat.igniteS + ' s'));
  assert.equal(L.checkPrediction('wood', 'ignite', 'slowly', st).status, 'nodata');
  const more = peat.tempRise > grass.tempRise;
  assert.equal(L.checkPrediction('peat', 'energy', 'more', st).status, more ? 'correct' : 'wrong');
  assert.match(L.checkPrediction('peat', 'energy', 'less', st).message, /keeps burning for much longer/);
  assert.equal(L.checkPrediction('grass', 'energy', 'more', record(11, [['grass', 1]])).status, 'nodata', 'energy needs another fuel to compare');
  // add charcoal: grass is now clearly below the others on average
  const st2 = record(11, [['grass', 1], ['charcoal', 1], ['wood', 1]]);
  assert.equal(L.checkPrediction('grass', 'energy', 'less', st2).status, 'correct'); assert.equal(L.checkPrediction('charcoal', 'energy', 'more', st2).status, 'correct');
});

test('"In my data" picks name the right fuel from the table, ties count, one fuel is not enough', () => {
  assert.equal(L.checkDataPick('yellowest', 'peat', record(4, [['peat', 1]])).status, 'nodata');
  const st = record(4, FUEL_ALL());
  function FUEL_ALL() { return L.FUEL_IDS.map(f => [f, 1]); }
  assert.equal(L.checkDataPick('yellowest', 'charcoal', st).status, 'correct'); assert.equal(L.checkDataPick('yellowest', 'grass', st).status, 'wrong'); assert.match(L.checkDataPick('yellowest', 'grass', st).message, /Charcoal/);
  assert.equal(L.checkDataPick('warmest', 'charcoal', st).status, 'correct'); assert.equal(L.checkDataPick('slowest', 'peat', st).status, 'correct'); assert.equal(L.checkDataPick('slowest', 'grass', st).status, 'wrong');
  assert.equal(L.checkDataPick('yellowest', 'wood', record(4, [['grass', 1], ['peat', 1]])).status, 'wrong'); assert.match(L.checkDataPick('yellowest', 'wood', record(4, [['grass', 1], ['peat', 1]])).message, /not burned that fuel/);
  assert.equal(L.checkDataPick('yellowest', '', st).status, 'empty');
});

test('evidence checks: need data, false when the table does not show it, recomputed after a change', () => {
  assert.deepEqual(L.evidenceChecks(null), { peatLongest: null, allLostMass: null, allYellower: null, peatMostYellow: null });
  const one = L.evidenceChecks(record(8, [['grass', 1]]));
  assert.equal(one.allLostMass, true); assert.equal(one.allYellower, true); assert.equal(one.peatLongest, null);
  const two = L.evidenceChecks(record(8, [['grass', 1], ['peat', 1]]));
  assert.equal(two.peatLongest, true); assert.equal(two.peatMostYellow, L.burnResult(8, 'peat', 1).btbAfter >= L.burnResult(8, 'grass', 1).btbAfter);
  const all = L.evidenceChecks(record(8, L.FUEL_IDS.map(f => [f, 1])));
  assert.equal(all.peatLongest, true); assert.equal(all.peatMostYellow, false, 'charcoal is yellower than peat');
  for (const seed of SEEDS) { const c = L.evidenceChecks(record(seed, L.FUEL_IDS.map(f => [f, 1]))); assert.equal(c.peatLongest, true); assert.equal(c.allLostMass, true); assert.equal(c.allYellower, true); assert.equal(c.peatMostYellow, false); }
  const d = L.evidenceDetail(record(8, L.FUEL_IDS.map(f => [f, 1]))); assert.match(d.longest, /^Peat \(\d+ s\)/); assert.match(d.yellowest, /^Charcoal/); assert.equal(d.count, 5);
  assert.deepEqual(L.evidenceDetail(null), {});
});

test('tap and dropdown rows: right answers, reasons for wrong ones, unknown ids and empty values', () => {
  for (const id of Object.keys(L.PICKS)) {
    const row = L.PICKS[id];
    assert.ok(row.correct.length >= 1 && row.correct.every(v => row.why[v]));
    for (const v of Object.keys(row.why)) { const r = L.checkPick(id, v); assert.equal(r.status, row.correct.includes(v) ? 'correct' : 'wrong'); assert.ok(row.correct.includes(v) ? /^Yes/.test(r.message) : /^Try again\. Why not/.test(r.message), id + ' ' + v); }
    assert.equal(L.checkPick(id, '').status, 'empty'); assert.equal(L.checkPick(id, 'zzz').status, 'wrong');
  }
  assert.equal(L.checkPick('nope', 'a').status, 'unknown');
});

test('claim level climbs as the pieces are added', () => {
  assert.equal(L.claimLevel([]), 'none'); assert.equal(L.claimLevel([true]), 'foundational'); assert.equal(L.claimLevel([true, true, true]), 'linked');
  assert.equal(L.claimLevel([true, true, true, true, true]), 'organized'); assert.equal(L.claimLevel([false, true, true, true, true]), 'foundational');
});
