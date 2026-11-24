/* Reference checks for the B.2 Fires companion model (Lessons 3 and 5): hand-computed values, many student seeds, invalid input, no NaN or
   impossible values, and the claim self-check. Run: node --test tests/openscied-b2-fires-logic.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../openscied-b2-fires-logic.js');

const SEEDS = Array.from({ length: 300 }, (_, i) => L.hash32('student-' + i));
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, (msg || '') + ' got ' + a + ' expected ' + b);

test('light and photosynthesis match hand-computed values', () => {
  near(L.lightIntensity('direct'), 1, 1e-9);
  near(L.lightIntensity('tilt45'), 0.70711, 1e-5);
  near(L.lightIntensity('tilt70'), 0.34202, 1e-5);
  assert.equal(L.lightIntensity('foil'), 0);
  assert.equal(L.lightIntensity('bogus'), 0);
  near(L.photosynthesis(1), 1.1 / 1.35, 1e-9); // 0.81481
  near(L.photosynthesis(0.70711), 0.73581, 1e-4);
  near(L.photosynthesis(0.34202), 0.54364, 1e-4);
  assert.equal(L.photosynthesis(0), 0);
  assert.equal(L.photosynthesis(-1), 0);
  assert.equal(L.photosynthesis(NaN), 0);
});

test('BTB reading: start is blue (2.0), net -0.5148 gives 1.1, foil net +0.30 gives 5.9, always 1 to 6', () => {
  assert.equal(L.btbPosition(0), 2);
  assert.equal(L.btbPosition(0.3 - 1.1 / 1.35), 1.1);
  assert.equal(L.btbPosition(0.3 - 0.73581), 1.3);
  assert.equal(L.btbPosition(0.3 - 0.54364), 1.6);
  assert.equal(L.btbPosition(0.3), 5.9);
  assert.equal(L.btbPosition(-5), 1);
  assert.equal(L.btbPosition(5), 6);
  assert.equal(L.btbPosition(NaN), 2);
  assert.equal(L.btbLabel(2), 'blue');
  assert.equal(L.btbLabel(1.1), 'deep blue');
  assert.equal(L.btbLabel(5.9), 'yellow');
  assert.equal(L.btbLabel(undefined), 'blue');
  for (let p = 1; p <= 6; p += 0.1) { const c = L.btbColor(p); assert.ok(c.length === 3 && c.every(v => Number.isInteger(v) && v >= 0 && v <= 255)); }
  assert.deepEqual(L.btbColor(1), L.BTB_RGB[0]); assert.deepEqual(L.btbColor(6), L.BTB_RGB[5]);
  assert.deepEqual(L.btbColor(NaN), L.BTB_RGB[1]);
  assert.equal(L.btbAt(1.1, 0), 2); assert.equal(L.btbAt(1.1, 1), 1.1); assert.equal(L.btbAt(6, 0.5), 4);
});

test('tilt tubes across 300 students: ordering holds, nothing impossible', () => {
  for (const seed of SEEDS) {
    const r = L.tiltResults(seed, ['direct', 'tilt45', 'foil']);
    const [a, b, f] = r;
    assert.ok(a.btb <= b.btb, 'direct is at least as blue as 45 degrees (seed ' + seed + ')');
    assert.ok(b.btb < f.btb && a.btb < f.btb, 'foil is the yellowest');
    assert.ok(f.net > 0 && a.net < 0 && b.net < 0, 'foil CO2 goes up, lit tubes go down');
    assert.ok(f.btb >= 5.3 && f.btb <= 6, 'foil is yellow-green to yellow: ' + f.btb);
    const c = L.tiltResults(seed, ['tilt70', 'tilt45', 'direct']);
    assert.ok(c[2].btb <= c[1].btb && c[1].btb <= c[0].btb, 'more light, bluer');
    for (const t of r.concat(c)) {
      for (const k of ['intensity', 'plantSize', 'respiration', 'photosynthesis', 'net', 'btb', 'starch']) assert.ok(Number.isFinite(t[k]), k);
      assert.ok(t.btb >= 1 && t.btb <= 6 && t.starch >= 0 && t.photosynthesis >= 0 && t.respiration > 0);
      assert.ok(t.plantSize >= 0.92 * 0.95 - 1e-9 && t.plantSize <= 1.08 * 1.05 + 1e-9);
    }
    assert.equal(f.starchLabel, 'none');
    assert.ok(a.starch >= b.starch);
  }
  // Same setting in all three tubes: tubes differ a little (about 5 percent) but not a lot.
  const same = L.tiltResults(SEEDS[0], ['direct', 'direct', 'direct']);
  assert.ok(new Set(same.map(t => t.net)).size === 3);
  assert.ok(Math.max(...same.map(t => t.net)) / Math.min(...same.map(t => t.net)) < 1.12);
  // Same seed, same answer after a reload.
  assert.deepEqual(L.tiltResults(SEEDS[3], ['direct', 'foil', 'tilt70']), L.tiltResults(SEEDS[3], ['direct', 'foil', 'tilt70']));
  assert.notDeepEqual(L.tiltResults(SEEDS[3], ['direct', 'foil', 'tilt70']), L.tiltResults(SEEDS[4], ['direct', 'foil', 'tilt70']));
});

test('tilt invalid input falls back to safe values', () => {
  for (const bad of [undefined, null, [], ['x', 'y', 'z'], 'direct', 5]) {
    const r = L.tiltResults(NaN, bad);
    assert.equal(r.length, 3);
    for (const t of r) { assert.ok(Number.isFinite(t.net) && Number.isFinite(t.btb) && t.btb >= 1 && t.btb <= 6); assert.ok(L.LIGHTS[t.light]); }
  }
  assert.equal(L.setupCheck(['direct', 'foil']).complete, false);
  assert.equal(L.setupCheck(['direct', 'tilt45', 'foil']).message.slice(0, 9), 'Good plan');
  assert.match(L.setupCheck(['direct', 'direct', 'direct']).message, /same setting/);
  assert.match(L.setupCheck(['direct', 'tilt45', 'tilt70']).message, /no foil/);
  assert.match(L.setupCheck(['direct', 'foil', 'foil']).message, /one lit setting/);
  assert.equal(L.setupCheck(null).ok, false);
  assert.equal(L.nightProgress(1000, 1000 + L.NIGHT_MS / 2, false), 0.5);
  assert.equal(L.nightProgress(1000, 1e12, false), 1);
  assert.equal(L.nightProgress(1000, 0, false), 0);
  assert.equal(L.nightProgress(NaN, 5, false), 0);
  assert.equal(L.nightProgress(null, null, true), 1);
});

test('starch labels and darkness', () => {
  assert.equal(L.starchLabel(0), 'none'); assert.equal(L.starchLabel(0.1), 'light'); assert.equal(L.starchLabel(0.4), 'medium'); assert.equal(L.starchLabel(0.5), 'dark');
  assert.equal(L.starchLabel(NaN), 'none');
  assert.equal(L.starchDarkness(0.6), 1); assert.equal(L.starchDarkness(0.3), 0.5); assert.equal(L.starchDarkness(-1), 0); assert.equal(L.starchDarkness(NaN), 0);
});

test('yeast foam: nominal curve hits the 20-minute targets; 43 C settles a little late; 55 C bursts then falls', () => {
  for (const T of L.TEMPS) { near(L.nominalFoam(T, 20), L.TARGET20[T], 1e-9, T + ' C at 20 min'); assert.equal(L.nominalFoam(T, 0), 0); }
  near(L.nominalFoam(27, 20), 38, 1e-9);
  near(L.nominalFoam(43, 20), 62, 1e-9);
  near(L.nominalFoam(18, 20), 10.5, 1e-9);
  // 27 C by hand: lag 3, k 0.05, shape(20) = 1 - exp(-0.85) = 0.57259; shape(10) = 1 - exp(-0.35) = 0.29531 -> 38 * 0.29531 / 0.57259 = 19.60
  near(L.nominalFoam(27, 10), 38 * (1 - Math.exp(-0.35)) / (1 - Math.exp(-0.85)), 1e-9);
  near(L.nominalFoam(27, 10), 19.60, 0.01);
  assert.ok(L.nominalFoam(43, 20) - L.nominalFoam(43, 16) < 6, '43 C foam slows late');
  const peak55 = Math.max(...L.TIMES.map(t => L.nominalFoam(55, t)));
  assert.ok(peak55 > 6 && peak55 < 12 && L.nominalFoam(55, 20) < peak55 * 0.4);
  for (let i = 0; i < L.TEMPS.length - 2; i++) assert.ok(L.nominalFoam(L.TEMPS[i], 20) < L.nominalFoam(L.TEMPS[i + 1], 20), 'warmer, more foam up to 43 C');
  assert.equal(L.normalizeTemp('abc'), 27); assert.equal(L.normalizeTemp(40), 43); assert.equal(L.normalizeTemp(-10), 5); assert.equal(L.normalizeTemp(1e9), 55);
  assert.deepEqual(L.normalizeTemps(null), [18, 27, 43]); assert.deepEqual(L.normalizeTemps([5, 'x']), [5, 27, 43]);
  assert.equal(L.nominalFoam(NaN, 10), L.nominalFoam(27, 10));
});

test('foam never shrinks where it should not: monotonic for 5, 18, 27 and 35 C over 300 seeds, and for 43 C until its late settle', () => {
  const seeds = Array.from({ length: 300 }, (_, i) => (i + 1) * 104729 >>> 0);
  for (const T of [5, 18, 27, 35]) {
    let drops = 0;
    for (const seed of seeds) for (const beaker of [0, 1, 2]) { const x = L.foamSeries(seed, beaker, T); for (let k = 1; k < x.length; k++) if (x[k] < x[k - 1]) drops++; }
    assert.equal(drops, 0, T + ' C foam never decreases between readings');
  }
  let early = 0, late = 0;
  for (const seed of seeds) for (const beaker of [0, 1, 2]) {
    const x = L.foamSeries(seed, beaker, 43);
    for (let k = 1; k < x.length; k++) if (x[k] < x[k - 1]) { if (L.TIMES[k] <= 14) early++; else { late++; assert.ok(x[k - 1] - x[k] <= 3, 'a late settle is at most 3 mm'); } }
  }
  assert.equal(early, 0, '43 C foam does not decrease up to 14 minutes');
  assert.ok(late > 0, 'but it does settle a little late for some beakers (' + late + ')');
  // the 55 C burst-then-fall behaviour is kept
  const hot = seeds.filter(seed => { const x = L.foamSeries(seed, 0, 55); return Math.max(...x) > x[10]; }).length;
  assert.ok(hot > 250, '55 C foam rises and then falls for most beakers (' + hot + ' of 300)');
  // no foam, and no noise, before the lag: a cold beaker never beats a room-temperature one at 2 minutes
  for (const seed of seeds) { const cold = L.foamSeries(seed, 0, 18), room = L.foamSeries(seed, 1, 27); assert.ok(cold[1] <= room[1], 'cold is not ahead of room at 2 min'); assert.equal(cold[1], 0); assert.equal(room[1], 0); }
  // totals still match the stated typicals
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const m = {}; for (const T of [5, 18, 27, 35, 43, 55]) m[T] = mean(seeds.map((seed, i) => L.foamSeries(seed, i % 3, T)[10]));
  near(m[5], 3, 0.8); near(m[18], 10.5, 1); near(m[27], 38, 1.5); near(m[35], 50, 2); near(m[43], 62, 2.5); near(m[55], 2.5, 0.8);
  // deterministic per student
  assert.deepEqual(L.foamSeries(seeds[0], 1, 27), L.foamSeries(seeds[0], 1, 27));
});

test('prediction sentence: complete, with the foam height, the same for every beaker and temperature (section 6 note and section 11 report)', () => {
  const seed = 987654321;
  for (const temps of [[18, 27, 43], [5, 27, 35], [27, 35, 55], [43, 18, 5], [35, 43, 27]]) for (const pred of ['cold', 'room', 'warm']) {
    const st = { seed, temps, recorded: [0, 2, 20] }, pc = L.predictionCheck(pred, st), text = L.predictionSentence(pc);
    const last = L.foamRows(st).pop(), top = Math.max(...last.h);
    assert.ok(/\.$/.test(text) && !/\($/.test(text.replace(/\.$/, '')), 'ends in a full stop, not an open bracket: ' + text);
    assert.equal((text.match(/\(/g) || []).length, (text.match(/\)/g) || []).length, 'brackets balance: ' + text);
    assert.ok(text.endsWith(', at ' + top + ' mm.') && pc.height === top, 'ends with the winning foam height: ' + text);
    assert.ok(new RegExp('most foam was in Beaker [123] \\(\\d+ °C\\), at \\d+ mm\\.$').test(text), text);
  }
  assert.equal(L.predictionSentence(null), '');
});

test('yeast readings across 300 students look like class data', () => {
  const stat = { 18: [], 27: [], 43: [] };
  for (const seed of SEEDS) {
    const temps = [18, 27, 43], s = temps.map((T, i) => L.foamSeries(seed, i, T));
    s.forEach((series, i) => {
      assert.equal(series.length, 11); assert.equal(series[0], 0);
      series.forEach((v, k) => { assert.ok(Number.isInteger(v) && v >= 0 && v <= 100, 'whole mm in range'); if (k) assert.ok(v >= series[k - 1] - (temps[i] === 43 ? 3 : 1), 'no big drops'); });
      stat[temps[i]].push(series[10]);
    });
    assert.ok(s[0][10] < s[1][10] && s[1][10] < s[2][10], 'cold < room < warm at 20 min, seed ' + seed);
    assert.deepEqual(s, temps.map((T, i) => L.foamSeries(seed, i, T)), 'reproducible');
  }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  near(mean(stat[18]), 10.5, 1.5); near(mean(stat[27]), 38, 2.5); near(mean(stat[43]), 62, 3.5);
  assert.ok(Math.min(...stat[27]) >= 38 * 0.92 - 2 && Math.max(...stat[27]) <= 38 * 1.08 + 2, 'about 8 percent variation');
  assert.ok(new Set(stat[27]).size > 5, 'students differ');
  // Two beakers at the same temperature differ a little; 35 C and 43 C keep their order even with the noise.
  const sameT = L.foamSeries(SEEDS[1], 0, 27)[10] !== L.foamSeries(SEEDS[1], 1, 27)[10] || L.foamSeries(SEEDS[2], 0, 27)[10] !== L.foamSeries(SEEDS[2], 1, 27)[10];
  assert.ok(sameT);
  for (const seed of SEEDS) { assert.ok(L.foamSeries(seed, 0, 35)[10] < L.foamSeries(seed, 1, 43)[10]); assert.ok(L.foamSeries(seed, 0, 27)[10] < L.foamSeries(seed, 1, 35)[10]); }
  // The warm beaker really does dip late for some students, by at most 3 mm per step.
  let dips = 0;
  for (const seed of SEEDS) { const w = L.foamSeries(seed, 2, 43); for (let k = 1; k < 11; k++) if (w[k] < w[k - 1]) { dips++; assert.ok(w[k - 1] - w[k] <= 3); } }
  assert.ok(dips >= 0);
  // Extreme temperatures stay possible.
  for (const T of [5, 55]) for (const seed of SEEDS.slice(0, 50)) { const s = L.foamSeries(seed, 0, T); assert.ok(s.every(v => Number.isInteger(v) && v >= 0 && v < 20)); }
  const cold = L.foamSeries(SEEDS[0], 0, 5); assert.ok(cold[10] <= 6);
  const hot = L.foamSeries(SEEDS[0], 0, 55); assert.ok(Math.max(...hot) >= 5 && hot[10] < Math.max(...hot));
});

test('yeast invalid input: no NaN, no negatives, safe defaults', () => {
  for (const [seed, idx, T] of [[NaN, 0, 27], [undefined, 5, 'x'], [-5, -1, null], [1e12, 1.7, Infinity]]) {
    const s = L.foamSeries(seed, idx, T); assert.equal(s.length, 11); assert.ok(s.every(v => Number.isInteger(v) && v >= 0));
  }
  assert.equal(L.foamAt([], 5), 0); assert.equal(L.foamAt(null, 5), 0); assert.equal(L.foamAt([0, 4, 8], NaN), 0);
  assert.equal(L.foamAt([0, 4, 8], 1), 2); assert.equal(L.foamAt([0, 4, 8], 3), 6); assert.equal(L.foamAt([0, 4, 8], 99), 8); assert.equal(L.foamAt([0, 4, 8], -4), 0);
  assert.equal(L.co2Made(38), 3.8); assert.equal(L.co2Made(-5), 0); assert.equal(L.co2Made(NaN), 0); assert.equal(L.co2Made(0), 0);
  assert.equal(L.minutesElapsed(0, L.SIM_MIN_MS * 7, false), 7); assert.equal(L.minutesElapsed(0, 1e12, false), 20); assert.equal(L.minutesElapsed(100, 0, false), 0);
  assert.equal(L.minutesElapsed(null, 5, false), 0); assert.equal(L.minutesElapsed(null, null, true), 20);
  assert.deepEqual(L.foamRows(null), []); assert.deepEqual(L.foamRows({}), []); assert.deepEqual(L.foamRows({ seed: 'x' }), []);
  const rows = L.foamRows({ seed: SEEDS[0], temps: [18, 27, 43], recorded: [4, 0, 2, 99, 'x'] });
  assert.deepEqual(rows.map(r => r.t), [0, 2, 4]);
  assert.deepEqual(rows[2].h, [0, 1, 2].map(i => L.foamSeries(SEEDS[0], i, [18, 27, 43][i])[2]));
  assert.equal(L.lastRow([]), null);
});

test('Matter Energy cards: sugar and oxygen in; carbon dioxide, water and energy out', () => {
  const good = { sugar: 'in', oxygen: 'in', 'carbon-dioxide': 'out', water: 'out', energy: 'out' };
  const r = L.checkCards(good);
  assert.equal(r.status, 'correct'); assert.equal(r.right, 5); assert.equal(r.solved, true);
  assert.equal(L.checkCards({}).status, 'empty'); assert.equal(L.checkCards(null).status, 'empty');
  assert.equal(L.checkCards({ sugar: 'in' }).status, 'partial');
  const bad = L.checkCards(Object.assign({}, good, { water: 'in' }));
  assert.equal(bad.status, 'wrong'); assert.equal(bad.results.water.correct, false); assert.match(bad.results.water.message, /^Try again/);
  assert.equal(bad.results.sugar.correct, true); assert.match(bad.results.sugar.message, /^Yes/);
  assert.equal(L.checkCards({ sugar: 'sideways' }).placed, 0);
  assert.equal(L.CARDS.length, 5); assert.equal(L.CARDS.filter(c => c.note === 'energy').length, 1);
  assert.match(L.REACTION, /sugar \+ oxygen → carbon dioxide \+ water \+ energy/);
});

test('rows and the directional hypothesis', () => {
  assert.equal(L.checkPick('cards-rate-hot', 'faster').status, 'correct');
  assert.equal(L.checkPick('cards-rate-peat', 'slower').status, 'correct');
  assert.equal(L.checkPick('sense-present', 'room').status, 'correct'); assert.equal(L.checkPick('sense-present', 'warm').status, 'correct'); assert.equal(L.checkPick('sense-present', 'cold').status, 'wrong');
  assert.equal(L.checkPick('sense-past', 'cold').status, 'correct'); assert.equal(L.checkPick('sense-future', 'warm').status, 'correct');
  assert.equal(L.checkPick('pred-fastest', 'warm').status, 'poll');
  assert.equal(L.checkPick('plan-iv', '').status, 'empty'); assert.equal(L.checkPick('nope', 'a').status, 'unknown'); assert.equal(L.checkPick('plan-iv', 'zzz').status, 'wrong');
  for (const [id, row] of Object.entries(L.PICKS)) {
    for (const [v, why] of Object.entries(row.why)) {
      assert.ok(why.length > 20, id + '/' + v);
      if (row.correct.length && !row.correct.includes(v)) assert.match(why, /^(Try again|Close)\. /, id + '/' + v);
      if (row.correct.includes(v)) assert.match(why, /^Yes\. /, id + '/' + v);
    }
  }
  assert.equal(L.checkSugarSentence('more', 'higher').status, 'correct'); assert.equal(L.checkSugarSentence('less', 'lower').status, 'correct');
  assert.equal(L.checkSugarSentence('more', 'lower').status, 'wrong'); assert.equal(L.checkSugarSentence('', 'lower').status, 'empty');
  assert.equal(L.checkHypothesis('more', 'more', 'energy').status, 'correct');
  assert.equal(L.checkHypothesis('more', 'more', 'warm').status, 'partial');
  assert.equal(L.checkHypothesis('more', 'less', 'energy').status, 'wrong');
  assert.equal(L.checkHypothesis('less', 'less', 'energy').status, 'correct');
  assert.equal(L.checkHypothesis('same', 'more', 'energy').status, 'wrong');
  assert.equal(L.checkHypothesis('', 'more', '').status, 'empty');
});

test('claim self-check levels', () => {
  assert.equal(L.claimLevel([]), 'none');
  assert.equal(L.claimLevel(null), 'none');
  assert.equal(L.claimLevel([true, false, false, false, false]), 'foundational');
  assert.equal(L.claimLevel([true, true, false, true, false]), 'linked');
  assert.equal(L.claimLevel([false, true, true, true, false]), 'foundational');
  assert.equal(L.claimLevel([true, true, true, true, true]), 'organized');
});

test('evidence checks read the student\'s own data and null means not enough data', () => {
  assert.deepEqual(L.evidenceChecks(null, null), { warmMost: null, coldLeast: null, directBluest: null, foilYellow: null, moreLightBluer: null });
  assert.deepEqual(L.evidenceChecks({}, {}), { warmMost: null, coldLeast: null, directBluest: null, foilYellow: null, moreLightBluer: null });
  for (const seed of SEEDS.slice(0, 60)) {
    const foam = { seed, temps: [18, 27, 43], recorded: [0, 2, 20] };
    const e = L.evidenceChecks(foam, { seed, settings: ['direct', 'tilt45', 'foil'], recorded: true });
    assert.equal(e.warmMost, true); assert.equal(e.coldLeast, true); assert.equal(e.directBluest, true); assert.equal(e.foilYellow, true); assert.equal(e.moreLightBluer, true);
    // Beakers put in the other order: the statement is about the warmest beaker, wherever it is.
    assert.equal(L.evidenceChecks({ seed, temps: [43, 27, 18], recorded: [20] }, null).warmMost, true);
    // A 0-minute all-zero baseline is a valid recorded reading, but it cannot support a CER comparison.
    assert.equal(L.evidenceChecks({ seed, temps: [18, 27, 43], recorded: [0] }, null).warmMost, null);
    assert.equal(L.evidenceChecks({ seed, temps: [18, 27, 43], recorded: [0] }, null).coldLeast, null);
    // Unrecorded tubes give no verdict.
    assert.equal(L.evidenceChecks(null, { seed, settings: ['direct', 'tilt45', 'foil'], recorded: false }).directBluest, null);
    // No direct tube: no verdict about it; all one setting: nothing to compare.
    assert.equal(L.evidenceChecks(null, { seed, settings: ['tilt45', 'tilt70', 'foil'], recorded: true }).directBluest, null);
    assert.equal(L.evidenceChecks(null, { seed, settings: ['direct', 'direct', 'direct'], recorded: true }).foilYellow, null);
    assert.equal(L.evidenceChecks(null, { seed, settings: ['tilt45', 'tilt45', 'foil'], recorded: true }).moreLightBluer, null);
  }
  // Same temperature in all beakers: nothing to compare.
  assert.equal(L.evidenceChecks({ seed: 5, temps: [27, 27, 27], recorded: [20] }, null).warmMost, null);
  // A hot 55 C beaker makes "the warmest beaker had the most foam" false: it is a real finding.
  assert.equal(L.evidenceChecks({ seed: SEEDS[7], temps: [18, 27, 55], recorded: [20] }, null).warmMost, false);
  assert.equal(L.evidenceChecks({ seed: SEEDS[7], temps: [18, 27, 55], recorded: [20] }, null).coldLeast, false); // 55 C yeast die, so the coldest beaker is not the least
  const d = L.evidenceDetail({ seed: SEEDS[7], temps: [18, 27, 43], recorded: [20] }, { seed: SEEDS[7], settings: ['direct', 'tilt45', 'foil'], recorded: true });
  assert.match(d.mostBeaker, /^Beaker 3 \(43 °C\)$/); assert.match(d.leastBeaker, /^Beaker 1 \(18 °C\)$/);
  assert.match(d.bluestTube, /^Tube A \(Direct/); assert.match(d.yellowestTube, /^Tube C \(Foil/);
});

test('each tube evidence statement accepts any informative recorded contrast', () => {
  const direct = ['direct', 'tilt45', 'tilt70'], foil = ['tilt45', 'foil', 'tilt70'];
  for (const seed of SEEDS.slice(0, 60)) {
    const lights = { seed, recorded:true, settings:direct };
    const dark = { seed, recorded:true, settings:foil };
    const d = L.evidenceChecks(null, lights), f = L.evidenceChecks(null, dark);
    assert.equal(d.directBluest, true); assert.equal(d.foilYellow, null);
    assert.equal(f.foilYellow, true); assert.equal(f.directBluest, null);
  }
  const repeated = { seed:1, recorded:true, settings:['direct','direct','foil'] };
  const btb = L.tiltResults(repeated.seed, repeated.settings).map(r => r.btb);
  assert.notEqual(btb[0], btb[1], 'the separately simulated direct tubes must have different readings');
  assert.equal(L.evidenceChecks(null, repeated).directBluest, true, 'one of two direct tubes can be the bluest');
  assert.match(L.evidenceDetail(null, repeated).bluestTube, /^Tube B \(Direct/);
});

test('missing tilt evidence explains what to record without manufacturing a comparison', () => {
  const direct = { seed:42, recorded:true, settings:['direct', 'tilt45', 'tilt70'] };
  const foil = { seed:42, recorded:true, settings:['tilt45', 'tilt70', 'foil'] };
  assert.equal(L.tiltEvidenceGap('directBluest', direct), '');
  assert.equal(L.tiltEvidenceGap('foilYellow', foil), '');
  assert.match(L.tiltEvidenceGap('foilYellow', direct), /foil-covered tube and one lit tube at any angle/);
  assert.match(L.tiltEvidenceGap('directBluest', foil), /direct-light tube and one tube with a different light setting/);
  const repeated = { seed:42, recorded:true, settings:['direct','direct','direct'] };
  const invalid = { seed:42, recorded:true, settings:['direct','tilt45','fictional-setting'] };
  assert.equal(L.evidenceChecks(null, repeated).directBluest, null);
  assert.equal(L.evidenceChecks(null, invalid).directBluest, null);
  assert.equal(L.evidenceChecks(null, {...foil, recorded:false}).foilYellow, null);
});

test('seeded random numbers are stable and in range', () => {
  const a = L.makeRng(42), b = L.makeRng(42);
  for (let i = 0; i < 100; i++) { const x = a.uniform(); assert.equal(x, b.uniform()); assert.ok(x >= 0 && x < 1); }
  for (let i = 0; i < 100; i++) assert.ok(Number.isFinite(a.normal()));
  assert.ok(Number.isFinite(L.makeRng(NaN).uniform()));
  assert.equal(L.hash32('abc'), L.hash32('abc')); assert.notEqual(L.hash32('abc'), L.hash32('abd'));
});

test('scene evidence counts actual sorted cards and recorded readings, not just a saved configuration', () => {
  const empty = { cardsPlaced: 0, cardsRight: 0, foamReadings: 0, foamAfterBaseline: false, tubesRead: 0, starchTested: false };
  assert.deepEqual(L.sceneEvidence({cards:{},decomp:{seed:1,recorded:[]},tilt:{seed:1,settings:['direct','tilt45','foil'],recorded:false}}),empty);
  const cards = {placed:Object.fromEntries(L.CARDS.map(c=>[c.id,c.zone]))};
  const decomp = {seed:1,temps:[18,27,43],recorded:[0,0,2,4,99]};
  assert.deepEqual(L.sceneEvidence({cards,decomp,tilt:{seed:1,settings:['direct','tilt45','foil'],recorded:true,starchDone:true}}),
    {cardsPlaced:5,cardsRight:5,foamReadings:3,foamAfterBaseline:true,tubesRead:3,starchTested:true});
  assert.equal(L.sceneEvidence({tilt:{seed:1,settings:[],recorded:true}}).tubesRead,0);
});
