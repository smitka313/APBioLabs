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
  assert.deepEqual(L.FUELS.map(f => f.mass), [4, 7, 10, 10, 30], 'the handfuls are not equal');
  assert.deepEqual(L.FUELS.map(f => L.massOf(f.id)), [4, 7, 10, 10, 30]);
  assert.deepEqual(L.FUELS.map(f => f.ignite), [4, 6, 14, 28, 45]);
  assert.deepEqual(L.FUELS.map(f => f.burn), [20, 30, 90, 150, 260]);
  assert.deepEqual(L.FUELS.map(f => f.loss), [0.93, 0.90, 0.97, 0.88, 0.78]);
  assert.deepEqual(L.FUELS.map(f => f.kj), [15, 16, 18, 29, 20]);
  assert.deepEqual(L.FUELS.map(f => f.co2), [0.44, 0.45, 0.50, 0.90, 0.50]);
});

test('new grass and leaf handfuls are distinct at the shown precision; earlier saved readings stay the same', () => {
  const saved=record(44,[['grass',1],['leaves',1]]), latest={...saved,modelVersion:2};
  const readouts=st=>L.tableRows(st).map(r=>[r.massBefore,r.tempRise,r.btbAfter]);
  // Independent reference: seed 44 reproduced the exact audit tie on the old model.
  assert.deepEqual(readouts(saved),[[4.1,3,2.9],[4,3,2.9]]);
  assert.deepEqual(readouts(latest),[[4.1,3,2.9],[7,5,3.4]]);
  assert.deepEqual(readouts(JSON.parse(JSON.stringify(L.cleanState(latest)))),readouts(latest));
  // For the new nominal leaf sample: 7 × .90 × 16 × .35 / 8 = 4.41°C.
  // BTB: 2 + 4(1 - exp(-7 × .90 × .45 × .60 / 3.5)) ≈ 3.54.
  const leaves=SEEDS.flatMap(seed=>[1,2,3].map(n=>L.burnResult(seed,'leaves',n)));
  near(leaves.reduce((sum,row)=>sum+row.dT,0)/leaves.length,4.41,0.12);
  near(leaves.reduce((sum,row)=>sum+row.btbAfter,0)/leaves.length,3.54,0.08);
  for(const seed of SEEDS)for(const n of [1,2,3]){
    const g=L.burnResult(seed,'grass',n), l=L.burnResult(seed,'leaves',n);
    assert.ok(l.btbAfter>g.btbAfter&&l.massBefore>g.massBefore&&l.tempRise>=g.tempRise);
  }
});

test('BTB: hand-computed readings, labels and colors', () => {
  assert.equal(L.btbLabel(1), 'deep blue'); assert.equal(L.btbLabel(2), 'blue'); assert.equal(L.btbLabel(3.4), 'blue-green'); assert.equal(L.btbLabel(4), 'green');
  assert.equal(L.btbLabel(5), 'yellow-green'); assert.equal(L.btbLabel(6), 'yellow'); assert.equal(L.btbLabel(NaN), 'blue'); assert.equal(L.btbLabel(99), 'yellow');
  assert.equal(L.btbText(3.6), 'green (3.6)'); assert.equal(L.btbText(3.4), 'blue-green (3.4)');
  assert.equal(L.btbFromDissolved(0), 2);
  near(L.btbFromDissolved(3.5), 2 + 4 * (1 - Math.exp(-1)), 1e-9); // 4.528
  assert.ok(L.btbFromDissolved(1e9) <= 6 && L.btbFromDissolved(-5) === 2 && L.btbFromDissolved(NaN) === 2);
  assert.deepEqual(L.btbColor(2), L.BTB_RGB[1]); assert.deepEqual(L.btbColor(NaN), L.BTB_RGB[1]);
  // a fixed share (0.6) of the carbon dioxide dissolves; BTB = 2 + 4 (1 - exp(-dissolved / 3.5)); the +/- 0.2 noise fades to nothing when no gas was made
  assert.equal(L.DISSOLVED_SHARE, 0.6);
  near(L.btbFor(10, 0), 2 + 4 * (1 - Math.exp(-6 / 3.5)), 0.05); // 5.2
  assert.equal(L.btbFor(0, 1), 2); assert.equal(L.btbFor(0, -1), 2); assert.equal(L.btbFor(-4, 1), 2); assert.equal(L.btbFor(NaN, 1), 2);
  assert.ok(L.btbFor(1e9, 1) <= 6 && L.btbFor(1e9, 1) >= 2 && L.btbFor(5, 99) === L.btbFor(5, 1), 'noise is clamped');
  for (let c = 0; c < 30; c += 0.5) assert.ok(L.btbFor(c + 0.5, 0) >= L.btbFor(c, 0), 'BTB never falls as carbon dioxide rises');
  near(L.dropletLevel(0), 0, 1e-9); near(L.dropletLevel(12), 1, 1e-9); assert.equal(L.dropletLevel(1e6), 1); assert.equal(L.dropletLevel(NaN), 0); assert.ok(L.dropletLevel(3) < L.dropletLevel(6));
});

test('every burn is possible: no NaN, mass after below mass before, temperature never falls, BTB 2 to 6, times positive, for 400 students x 5 fuels x 3 samples', () => {
  for (const seed of SEEDS) for (const f of L.FUEL_IDS) for (let n = 1; n <= 3; n++) {
    const r = L.burnResult(seed, f, n);
    for (const k of Object.keys(r)) if (typeof r[k] === 'number') assert.ok(Number.isFinite(r[k]), f + ' ' + k);
    assert.ok(Math.abs(r.massBefore - L.massOf(f)) <= 0.1001 && r.massStart === L.massOf(f), 'mass before ' + r.massBefore);
    assert.ok(r.massAfter > 0 && r.massAfter < r.massBefore, f + ' mass after ' + r.massAfter + ' before ' + r.massBefore);
    assert.ok(r.tempAfter >= r.tempBefore && r.tempBefore >= 21 && r.tempBefore <= 23, 'temperature');
    assert.ok(r.dT >= 2 && r.dT <= 22);
    assert.ok(r.btbAfter >= 2 && r.btbAfter <= 6 && r.btbAfter > r.btbBefore && r.massLost > 0, f + ' btb ' + r.btbAfter);
    assert.ok(r.waterMade > 0 && r.dropletLevel > 0 && r.dropletLevel <= 1);
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

test('the lesson facts hold for every student: peat loses the most mass, makes the most carbon dioxide and the biggest BTB change, warms the fuel most, ignites last and burns longest', () => {
  for (const seed of SEEDS) for (const n of [1, 2, 3]) {
    const r = Object.fromEntries(L.FUEL_IDS.map(f => [f, L.burnResult(seed, f, n)]));
    for (const f of L.FUEL_IDS) if (f !== 'peat') {
      assert.ok(r.peat.igniteS > r[f].igniteS, 'peat ignites after ' + f); assert.ok(r.peat.burnS > r[f].burnS, 'peat burns longer than ' + f);
      assert.ok(r.peat.massLost > r[f].massLost, 'peat loses more grams than ' + f); assert.ok(r.peat.burnedG > r[f].burnedG);
      assert.ok(r.peat.co2Made > r[f].co2Made, 'peat makes more carbon dioxide than ' + f);
      assert.ok(r.peat.btbAfter > r[f].btbAfter, 'peat has the biggest BTB change over ' + f + ' ' + r.peat.btbAfter + ' vs ' + r[f].btbAfter);
      assert.ok(r.peat.dT > r[f].dT, 'peat true temperature rise over ' + f);
      assert.ok(r.peat.waterMade > r[f].waterMade && r.peat.dropletLevel >= r[f].dropletLevel, 'peat makes the most water');
    }
    for (const f of L.FUEL_IDS) if (f !== 'charcoal') { assert.ok(r.charcoal.kjPerG > r[f].kjPerG, 'charcoal heat per gram over ' + f); }
    for (const f of ['grass', 'leaves', 'wood']) { assert.ok(r.charcoal.dT > r[f].dT, 'charcoal true rise over ' + f); assert.ok(r.charcoal.waterMade < r[f].waterMade, 'charcoal makes the least water'); }
    assert.ok(r.wood.dT > r.grass.dT && r.wood.dT > r.leaves.dT, 'wood warms more than grass and leaves');
    assert.ok(r.grass.igniteS < r.leaves.igniteS && r.leaves.igniteS < r.wood.igniteS && r.wood.igniteS < r.charcoal.igniteS, 'ignition order');
    assert.ok(r.charcoal.btbAfter > r.wood.btbAfter && r.wood.btbAfter > Math.max(r.grass.btbAfter, r.leaves.btbAfter), 'BTB order: peat, charcoal, wood, then grass and leaves');
    assert.ok(r.peat.massAfter > r.wood.massAfter && r.peat.massBefore > 29 && r.grass.massBefore < 5, 'peat is the big handful and keeps the most ash');
  }
});

test('mass lost, carbon dioxide and BTB change go together: bigger mass lost x carbon factor means more carbon dioxide and a bigger BTB change, and BTB never changes without mass lost', () => {
  const all = [];
  for (const seed of SEEDS) for (const f of L.FUEL_IDS) for (let n = 1; n <= 3; n++) all.push(L.burnResult(seed, f, n));
  for (const r of all) {
    near(r.co2Made, L.FUEL[r.fuel].co2 * r.burnedG, 0.02, 'carbon dioxide = grams lost x carbon factor');
    near(r.dissolved, r.co2Made * 0.6, 0.02, 'a fixed share dissolves');
    assert.ok(r.btbChange >= 0 && Math.abs(r.massLost - r.burnedG) <= 0.25, 'the scale shows the grams that burned away');
  }
  // the noise-free BTB is a rising function of carbon dioxide made, so ranking samples by carbon dioxide never ranks the BTB backwards beyond the +/- 0.2 noise
  all.sort((a, b) => a.co2Made - b.co2Made);
  for (let i = 1; i < all.length; i++) assert.ok(L.btbFor(all[i].co2Made, 0) >= L.btbFor(all[i - 1].co2Made, 0), 'monotonic');
  // across the five fuels, mass lost x carbon factor, carbon dioxide made and the mean BTB change all rank the same way (peat greatest), for every student
  for (const seed of SEEDS) {
    const r = L.FUEL_IDS.map(f => L.burnResult(seed, f, 1));
    const byCo2 = r.slice().sort((a, b) => b.co2Made - a.co2Made), byMassCarbon = r.slice().sort((a, b) => b.burnedG * L.FUEL[b.fuel].co2 - a.burnedG * L.FUEL[a.fuel].co2);
    assert.deepEqual(byCo2.map(x => x.fuel).slice(0, 3), byMassCarbon.map(x => x.fuel).slice(0, 3));
    assert.deepEqual(byCo2.map(x => x.fuel).slice(0, 3), ['peat', 'charcoal', 'wood'], 'order of carbon dioxide made');
    assert.equal(byCo2[0].fuel, 'peat'); assert.equal(r.slice().sort((a, b) => b.btbAfter - a.btbAfter)[0].fuel, 'peat'); assert.equal(r.slice().sort((a, b) => b.massLost - a.massLost)[0].fuel, 'peat');
  }
  // fuels with similar carbon (grass, leaves, wood, peat: 0.44 to 0.50): more mass lost goes with more carbon dioxide and a bigger BTB change
  for (const seed of SEEDS) {
    const r = ['grass', 'wood', 'peat'].map(f => L.burnResult(seed, f, 1)).sort((a, b) => a.burnedG - b.burnedG);
    assert.ok(r[0].co2Made < r[1].co2Made && r[1].co2Made < r[2].co2Made && r[0].btbAfter < r[1].btbAfter && r[1].btbAfter < r[2].btbAfter, 'grass < wood < peat for mass lost, carbon dioxide and BTB');
  }
  // no mass lost, no BTB change (for any noise)
  for (const u of [-1, -0.5, 0, 0.5, 1]) assert.equal(L.btbFor(0, u), L.START_BTB);
  // the BTB change shown in a table is zero only when nothing was lost
  assert.ok(all.every(r => (r.btbChange > 0) === (r.massLost > 0)));
});

test('droplets: water made follows grams lost x water factor, most for peat, some for wood, leaves and grass, least for charcoal', () => {
  for (const seed of SEEDS.slice(0, 100)) for (const f of L.FUEL_IDS) { const r = L.burnResult(seed, f, 1); near(r.waterMade, L.FUEL[f].water * r.burnedG, 0.02); near(r.dropletLevel, L.dropletLevel(L.FUEL[f].water * r.burnedG), 0.003); }
  const m = L.FUEL_IDS.map(f => ({ f, w: SEEDS.slice(0, 100).reduce((a, s) => a + L.burnResult(s, f, 1).waterMade, 0) / 100 })).sort((a, b) => b.w - a.w).map(x => x.f);
  assert.equal(m[0], 'peat'); assert.equal(m[4], 'charcoal'); assert.equal(m[1], 'wood');
  const peat = L.burnResult(5, 'peat', 1), mid = L.stateAt(peat, peat.igniteS + peat.burnS / 2), end = L.stateAt(peat, peat.runS), start = L.stateAt(peat, 0);
  assert.equal(start.drops, 0); assert.ok(mid.drops > 0 && mid.drops < end.drops); near(end.drops, peat.dropletLevel, 1e-9);
  assert.ok(L.stateAt(L.burnResult(5, 'charcoal', 1), 1e6).drops < end.drops);
});

test('hand-computed example: grass at nominal values', () => {
  // 4 g x 0.93 = 3.72 g burned; 15 kJ/g x 3.72 = 55.8 kJ; x 0.35 / 8 = 2.44 C; CO2 = 0.44 x 3.72 = 1.637; dissolved = 0.6 x 1.637 = 0.982; BTB = 2 + 4 (1 - exp(-0.982 / 3.5))
  const g = 4 * 0.93; near(15 * g * 0.35 / 8, 2.44125, 1e-9);
  const d = 0.44 * g * 0.6; near(d, 0.98208, 1e-4); near(L.btbFor(0.44 * g, 0), 2 + 4 * (1 - Math.exp(-d / 3.5)), 0.05); near(2 + 4 * (1 - Math.exp(-d / 3.5)), 2.98, 0.01);
  // peat: 30 g x 0.78 = 23.4 g; 20 x 23.4 x 0.35 / 8 = 20.5 C; CO2 = 0.5 x 23.4 = 11.7; dissolved 7.02; BTB = 2 + 4 (1 - exp(-7.02 / 3.5)) = 5.46; water = 0.8 x 23.4 = 18.7
  near(20 * 23.4 * 0.35 / 8, 20.475, 1e-9); near(2 + 4 * (1 - Math.exp(-7.02 / 3.5)), 5.46, 0.01); near(0.8 * 23.4, 18.72, 1e-9);
  // the model reproduces the arithmetic: the average over many students sits near the hand values
  const mean = (f, k) => SEEDS.reduce((a, s) => a + L.burnResult(s, f, 1)[k], 0) / SEEDS.length;
  near(mean('grass', 'dT'), 2.44, 0.12); near(mean('grass', 'btbAfter'), 2.99, 0.08); near(mean('grass', 'massLost'), 3.72, 0.1);
  near(mean('peat', 'dT'), 20.4, 0.3); near(mean('peat', 'btbAfter'), 5.45, 0.08); near(mean('peat', 'massLost'), 23.4, 0.3); near(mean('peat', 'massBefore'), 30, 0.02);
  near(mean('charcoal', 'dT'), 11.2, 0.25); near(mean('wood', 'dT'), 7.65, 0.2); near(mean('charcoal', 'btbAfter'), 5.0, 0.08); near(mean('wood', 'btbAfter'), 4.28, 0.08);
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
    let prevMass = 1e9, prevTemp = -99, prevBtb = 0, order = ['heating', 'burning', 'dying', 'done'], at = 0;
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
    assert.equal(last.stage, 'done'); assert.equal(last.temp, r.tempAfter); assert.equal(last.btb, r.btbAfter); near(last.massTrue, r.massStart - r.burnedG, 0.01); assert.equal(last.flame, 0);
  }
  const peat = L.burnResult(7, 'peat', 1), mid = L.stateAt(peat, peat.igniteS + peat.burnS / 2), early = L.stateAt(peat, peat.igniteS / 2), g = L.burnResult(7, 'grass', 1), gm = L.stateAt(g, g.igniteS + g.burnS / 2);
  assert.ok(mid.smoke > 0.6 && mid.flame < 0.5 && mid.glow > 0.5, 'peat smolders: smoke and ember, little flame');
  assert.ok(early.smoke > 0 && early.flame === 0, 'peat smokes before it catches');
  assert.ok(gm.flame > 0.6 && gm.smoke < mid.smoke, 'grass flames bright');
  const c = L.burnResult(7, 'charcoal', 1), cm = L.stateAt(c, c.igniteS + 5);
  assert.ok(cm.flame < 0.2 && cm.glow > 0.7 && cm.smoke < 0.1, 'charcoal glows with little flame and little smoke');
});

test('smoke haze and carbon dioxide under the dome grow with the burn and follow the model: most haze for peat, least for charcoal; gas follows carbon dioxide made', () => {
  for (const f of L.FUEL_IDS) {
    const r = L.burnResult(21, f, 1); let hz = -1, gs = -1;
    for (let t = 0; t <= r.runS; t += r.runS / 60) { const s = L.stateAt(r, t); assert.ok(s.haze >= 0 && s.haze <= 1 && s.gas >= 0 && s.gas <= 1); assert.ok(s.gas >= gs - 1e-9, 'gas never falls'); gs = s.gas; if (s.stage !== 'done') { assert.ok(s.haze >= hz - 1e-9, 'haze grows while it burns'); hz = s.haze; } }
    assert.equal(L.stateAt(r, 0).gas, 0); assert.equal(L.stateAt(r, 0).haze, 0);
  }
  const end = f => L.stateAt(L.burnResult(21, f, 1), 1e6);
  assert.ok(end('peat').haze > end('wood').haze && end('wood').haze > end('charcoal').haze, 'haze: peat > wood > charcoal');
  assert.ok(end('peat').gas > end('charcoal').gas && end('charcoal').gas > end('wood').gas && end('wood').gas > end('grass').gas, 'gas follows carbon dioxide made');
  // the BTB dish row and the dome wording
  assert.equal(L.checkPick('sense-dish', 'reach').status, 'correct'); assert.equal(L.checkPick('sense-dish', 'cool').status, 'wrong'); assert.equal(L.checkPick('sense-dish', 'smoke').status, 'wrong');
  assert.ok(!/dome glass/i.test(L.PICKS['sense-energy'].why.heat + L.checkPrediction('peat', 'energy', 'more', record(3, [['grass', 1], ['peat', 1]])).message + L.checkDataPick('warmest', 'grass', record(3, [['grass', 1], ['peat', 1]])).message), 'the temperature feedback names the fuel, not the dome glass');
  const text = JSON.stringify(L.PICKS) + L.checkPrediction('peat', 'energy', 'more', record(3, [['grass', 1], ['peat', 1]])).message + L.checkDataPick('warmest', 'grass', record(3, [['grass', 1], ['peat', 1]])).message;
  assert.ok(!/flask/i.test(text), 'no flask wording in any feedback');
});

test('the run clock is timestamp based: elapsed simulated seconds follow the clock, skip jumps to the end', () => {
  assert.equal(L.simSeconds(0, 1000, false, 500), L.RATE); assert.equal(L.simSeconds(0, 10000, false, 500), 10 * L.RATE); assert.equal(L.simSeconds(0, 0, true, 123), 123);
  const peat = L.burnResult(1, 'peat', 1); assert.ok(peat.runS / L.RATE < 70, 'peat takes about a minute on screen');
});

test('observation chips the picture shows for each fuel', () => {
  assert.deepEqual(L.obsTruth('grass'), ['bright-flame', 'smoke', 'droplets', 'ash']);
  assert.deepEqual(L.obsTruth('charcoal'), ['small-flame', 'glowing', 'ash'], 'charcoal shows the least droplets');
  assert.deepEqual(L.obsTruth('peat'), ['small-flame', 'smoke', 'glowing', 'droplets', 'ash']);
  assert.ok(L.OBS.some(o => o.id === 'droplets' && o.label === 'Droplets on the glass'));
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

test('the two weighings are saved as flags only: before (weighed for the next sample) and after (current.after); invalid or contradictory flags are dropped', () => {
  const ok = L.cleanState({ seed: 5, fuel: 'peat', weighed: { fuel: 'peat', n: 2 }, current: null, records: [] });
  assert.deepEqual(ok.weighed, { fuel: 'peat', n: 2 });
  assert.equal(L.cleanState({ seed: 5, weighed: { fuel: 'zzz', n: 1 }, records: [] }).weighed, null, 'unknown fuel');
  assert.equal(L.cleanState({ seed: 5, weighed: { fuel: 'peat', n: 1 }, records: [{ fuel: 'peat', n: 1 }] }).weighed, null, 'that sample is already recorded');
  assert.equal(L.cleanState({ seed: 5, weighed: { fuel: 'peat', n: 1 }, current: { fuel: 'peat', n: 1, startedAt: 5 }, records: [] }).weighed, null, 'cleared once it is burning');
  assert.equal(L.cleanState({ seed: 5, current: { fuel: 'wood', n: 1, startedAt: 5, after: 1 }, records: [] }).current.after, true);
  assert.equal(L.cleanState({ seed: 5, current: { fuel: 'wood', n: 1, startedAt: 5 }, records: [] }).current.after, false);
  assert.equal(L.cleanState({ seed: 5, records: [] }).weighed, null);
  // the temperature rise is the difference of the two readings: after minus before, never negative, equal to tempRise in every table row
  for (const seed of SEEDS.slice(0, 50)) for (const f of L.FUEL_IDS) { const r = L.burnResult(seed, f, 1); assert.equal(r.tempRise, r.tempAfter - r.tempBefore); assert.ok(r.tempRise >= 0); }
});

test('chart series: a missing bar stays missing (NaN), one series per sample number', () => {
  const rows = L.tableRows(record(3, [['grass', 1], ['peat', 1], ['peat', 2]]));
  const ser = L.chartSeries(rows, 'rise');
  assert.deepEqual(ser.map(s => s.name), ['Sample 1', 'Sample 2']);
  assert.equal(ser[0].points.length, 5); assert.ok(Number.isNaN(ser[0].points[1].y) && Number.isFinite(ser[0].points[0].y) && Number.isFinite(ser[0].points[4].y));
  assert.ok(Number.isNaN(ser[1].points[0].y) && Number.isFinite(ser[1].points[4].y));
  assert.deepEqual(L.chartSeries([], 'rise'), []); assert.ok(L.FUEL_IDS.every(f => L.SHORT_NARROW[f].length <= 4), 'phone chart names are 4 letters or fewer'); assert.equal(L.chartSeries(rows, 'rise', L.SHORT_NARROW)[0].points[0].x, 'Hay'); assert.equal(ser[0].points[0].x, 'Grass'); assert.equal(ser[0].points[4].x, 'Peat');
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
  assert.equal(L.checkPrediction('peat', 'energy', 'more', st).status, 'correct', 'peat gives more energy than grass'); assert.match(L.checkPrediction('peat', 'energy', 'more', st).message, /warmed up [12]\d\.\d °C, more than the others/);
  assert.equal(L.checkPrediction('grass', 'energy', 'more', record(11, [['grass', 1]])).status, 'nodata', 'energy needs another fuel to compare');
  // add charcoal: grass is now clearly below the others on average
  const st2 = record(11, [['grass', 1], ['charcoal', 1], ['wood', 1]]);
  assert.equal(L.checkPrediction('grass', 'energy', 'less', st2).status, 'correct'); assert.equal(L.checkPrediction('charcoal', 'energy', 'more', st2).status, 'correct');
});

test('"In my data" picks name the right fuel from the table, ties count, one fuel is not enough', () => {
  assert.equal(L.checkDataPick('yellowest', 'peat', record(4, [['peat', 1]])).status, 'nodata');
  const st = record(4, FUEL_ALL());
  function FUEL_ALL() { return L.FUEL_IDS.map(f => [f, 1]); }
  assert.equal(L.checkDataPick('yellowest', 'peat', st).status, 'correct'); assert.equal(L.checkDataPick('yellowest', 'grass', st).status, 'wrong'); assert.match(L.checkDataPick('yellowest', 'grass', st).message, /Peat/);
  assert.equal(L.checkDataPick('lostmost', 'peat', st).status, 'correct'); assert.equal(L.checkDataPick('lostmost', 'wood', st).status, 'wrong'); assert.match(L.checkDataPick('lostmost', 'wood', st).message, /lost the most mass/);
  assert.equal(L.checkDataPick('warmest', 'peat', st).status, 'correct'); assert.equal(L.checkDataPick('slowest', 'peat', st).status, 'correct'); assert.equal(L.checkDataPick('slowest', 'grass', st).status, 'wrong');
  assert.equal(L.checkDataPick('yellowest', 'wood', record(4, [['grass', 1], ['peat', 1]])).status, 'wrong'); assert.match(L.checkDataPick('yellowest', 'wood', record(4, [['grass', 1], ['peat', 1]])).message, /not burned that fuel/);
  assert.equal(L.checkDataPick('yellowest', '', st).status, 'empty');
});

test('evidence checks: need peat and another fuel, true or false against the table, recomputed after a change', () => {
  const none = { peatMostMass: null, peatBtbMost: null, peatWarmest: null, peatLongest: null };
  assert.deepEqual(L.evidenceChecks(null), none); assert.deepEqual(L.evidenceChecks(record(8, [['grass', 1]])), none); assert.deepEqual(L.evidenceChecks(record(8, [['peat', 1]])), none);
  const two = L.evidenceChecks(record(8, [['grass', 1], ['peat', 1]]));
  assert.equal(two.peatMostMass, true); assert.equal(two.peatBtbMost, true); assert.equal(two.peatLongest, true);
  const all = L.FUEL_IDS.map(f => [f, 1]);
  for (const seed of SEEDS) { const c = L.evidenceChecks(record(seed, all)); assert.equal(c.peatMostMass, true); assert.equal(c.peatBtbMost, true); assert.equal(c.peatLongest, true); assert.equal(c.peatWarmest, true, 'warmest ' + seed); }
  // a table that does not show it: peat is not the top of an invented table (a statement the data do not show is false)
  const rows = L.tableRows(record(8, all)); const g = L.byFuel(rows); const peat = g.find(x => x.fuel === 'peat');
  assert.ok(peat.massLost > 15 && g.filter(x => x.fuel !== 'peat').every(x => x.massLost < peat.massLost));
  const d = L.evidenceDetail(record(8, all)); assert.match(d.mostMass, /^Peat \(2\d\.\d g\)/); assert.match(d.mostBtb, /^Peat \(\+3\.\d\)/); assert.match(d.warmest, /^Peat \(\d+\.\d °C\)/); assert.match(d.longest, /^Peat \(\d+ s\)/);
  assert.deepEqual(L.evidenceDetail(null), {});
  // statements the table does not show are false, not assumed: made-up means where another fuel is on top
  const mk = (fuel, burnS, massLost, btbChange, tempRise) => ({ fuel, label: fuel, burnS, massLost, btbChange, tempRise });
  const fake = [mk('grass', 20, 3.7, 1, 2.4), mk('charcoal', 150, 25, 3.4, 22), mk('peat', 260, 23.4, 3.45, 20.5)];
  assert.deepEqual(L.evidenceFromGroups(fake), { peatMostMass: false, peatBtbMost: true, peatWarmest: false, peatLongest: true });
  assert.deepEqual(L.evidenceFromGroups([mk('peat', 1, 1, 1, 1)]), none, 'one fuel is not enough');
  assert.deepEqual(L.evidenceFromGroups([mk('grass', 1, 1, 1, 1), mk('wood', 1, 1, 1, 1)]), none, 'no peat, nothing to check');
  assert.equal(L.evidenceFromGroups([mk('peat', 100, 5, 1, 3), mk('wood', 100, 5, 1, 3)]).peatLongest, false, 'a tie in burn time is not "longest"');
  assert.equal(L.evidenceFromGroups([mk('peat', 100, 5, 1, 3), mk('wood', 90, 5, 1, 3)]).peatMostMass, true, 'a tie for the top counts for mass');
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

test('a saved burn review points to one existing sample, never manufactures a duplicate', () => {
  const before={seed:8,fuel:'peat',records:[{fuel:'peat',n:1,obs:['smoke','smoke','invalid']}],review:{fuel:'peat',n:1}};
  const restored=L.cleanState(before);
  assert.deepEqual(restored.review,{fuel:'peat',n:1});
  assert.deepEqual(L.tableRows(restored).map(x=>x.obs),[['smoke']]);
  assert.equal(L.cleanState({...before,review:{fuel:'peat',n:3}}).review,undefined);
  const draft=L.cleanState({...before,current:{fuel:'wood',n:1,startedAt:10,after:true,obs:['smoke']}});
  assert.deepEqual(draft.current.obs,['smoke']);
  assert.equal(draft.review,undefined);
});


test('burn caption follows each phase and never prints an unmeasured result', () => {
  const r = L.burnResult(40, 'wood', 1);
  assert.equal(L.instrumentCaption(r, 'ready', false), 'Fuel not yet weighed · temperature not yet read');
  assert.equal(L.instrumentCaption(r, 'ready', true), 'Balance: ' + r.massBefore.toFixed(1) + ' g · temperature: ' + r.tempBefore + ' °C');
  assert.equal(L.instrumentCaption(r, 'running', false), 'Balance idle · thermometer put down');
  assert.equal(L.instrumentCaption(r, 'finished', false), 'Ash not yet weighed · temperature not yet read');
  assert.equal(L.instrumentCaption(r, 'finished', true), 'Balance: ' + r.massAfter.toFixed(1) + ' g · temperature: ' + r.tempAfter + ' °C');
});
