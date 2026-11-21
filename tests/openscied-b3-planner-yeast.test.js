/* Pure logic of the Lessons 8-9 planner and virtual yeast scenes (investigation-planner-scene.js, yeast-uv-scene.js).
   Run: node --test tests/openscied-b3-planner-yeast.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../investigation-planner-scene.js');
const Y = require('../yeast-uv-scene.js');

const cond = (spf, foil, dark, minutes) => ({ spf, foil, dark, minutes });
const ids = (checks, level) => checks.filter(c => c.level === level).map(c => c.id);

test('plan checks: the class set is fair but has no repeats and nothing held yet', () => {
  const p = P.preset('class'), c = P.checkPlan(p);
  assert.equal(p.conditions.length, 8);
  assert.deepEqual(ids(c, 'warn').sort(), ['held', 'repeat']);
  assert.ok(c.find(x => x.id === 'iv').ok && c.find(x => x.id === 'dark').ok && c.find(x => x.id === 'base').ok);
});
test('plan checks: two things changing at once', () => {
  const plan = { iv: 'spf', dv: 'colonies', strainMode: 'sensitive', controls: [], conditions: [cond(null, false, true, 0), cond(null, false, false, 15), cond(15, false, false, 30)] };
  const iv = P.checkPlan(plan).find(x => x.id === 'iv');
  assert.equal(iv.level, 'warn'); assert.match(iv.text, /Two things change at once: the cover and UV time/);
});
test('plan checks: no dark control, no unprotected dish, no repeat, nothing to compare', () => {
  const plan = { iv: 'spf', dv: 'colonies', conditions: [cond(15, false, false, 15), cond(30, false, false, 15)] };
  const c = P.checkPlan(plan);
  assert.equal(c.find(x => x.id === 'dark').level, 'warn'); assert.equal(c.find(x => x.id === 'base').level, 'warn'); assert.equal(c.find(x => x.id === 'repeat').level, 'warn');
  const same = P.checkPlan({ iv: 'time', conditions: [cond(null, false, false, 15), cond(null, false, false, 15)] });
  assert.match(same.find(x => x.id === 'iv').text, /nothing to compare/);
  assert.equal(P.checkPlan({ conditions: [] }).find(x => x.id === 'enough').level, 'warn');
});
test('plan checks: repeat, iv mismatch and held-constant', () => {
  const t = P.preset('time'); t.controls = P.neededHeld('time');
  const c = P.checkPlan(t);
  assert.equal(c.find(x => x.id === 'repeat').level, 'ok'); assert.equal(c.find(x => x.id === 'held').level, 'ok');
  assert.equal(P.checkPlan(Object.assign({}, t, { iv: 'spf' })).find(x => x.id === 'iv').level, 'warn');
  assert.equal(P.checkPlan(Object.assign({}, t, { controls: P.neededHeld('time').concat('time') })).find(x => x.id === 'held').level, 'warn');
  assert.ok(P.isReady(P.checkPlan(Object.assign({}, t, { dv: 'colonies', strainMode: 'both' }))));
});
test('normalizing never produces impossible conditions and caps the plan', () => {
  const list = P.normalizeConditions(Array.from({ length: 14 }, () => ({ spf: -5, minutes: NaN, foil: true, dark: true })), 'wild');
  assert.equal(list.length, P.MAX); assert.ok(list.every(c => c.dark && c.minutes === 0 && c.spf === null && !c.foil && c.strain === 'wild'));
  assert.deepEqual(P.normalizeConditions('nope'), []);
});
test('prediction hints follow the causal story', () => {
  const ref = P.normalizeCondition(cond(null, false, false, 15), 0), dark = P.normalizeCondition(cond(null, false, true, 0), 1);
  assert.equal(P.expectedDirection(dark, ref), 'more'); dark.predict = { dir: 'fewer', why: '' };
  assert.match(P.predictionHint(dark, ref), /^Think again/); dark.predict.dir = 'more'; assert.match(P.predictionHint(dark, ref), /^Good/);
});

const SPECS = Y.classSet().map((c, i) => Object.assign({ group: i + 1 }, c));
const E = (strain, c) => Y.expectedColonies(strain, Object.assign({}, c));
test('survival ordering for the expected counts: dark > SPF 50 > SPF 15 > no protection, wild-type >= sensitive', () => {
  const dark = E('sensitive', cond(null, false, true, 0)), s50 = E('sensitive', cond(50, false, false, 15)), s15 = E('sensitive', cond(15, false, false, 15)), none = E('sensitive', cond(null, false, false, 15));
  assert.ok(dark > s50 && s50 > s15 && s15 > none, [dark, s50, s15, none].join());
  assert.equal(E('sensitive', cond(null, true, false, 15)), dark, 'foil blocks all UV');
  for (const c of [cond(null, false, true, 0), cond(null, false, false, 5), cond(null, false, false, 60), cond(15, false, false, 60), cond(50, false, false, 15)]) assert.ok(E('wild', c) >= E('sensitive', c));
  assert.ok(E('wild', cond(null, false, false, 60)) < E('wild', cond(null, false, false, 15)), 'very long exposure also hurts wild-type');
  assert.ok(Math.abs(Y.transmittance({ spf: 30 }, 1) - 1 / 30) < 1e-12);
});
test('simulated dishes: reproducible per seed, different for another, never negative or NaN', () => {
  const run = seed => SPECS.map(s => Y.simulateDish(seed, Object.assign({ strain: 'sensitive' }, s), 0));
  assert.deepEqual(run(12345), run(12345)); assert.notDeepEqual(run(12345).map(d => d.truth), run(54321).map(d => d.truth));
  for (let seed = 1; seed < 300; seed++) for (const strain of ['sensitive', 'wild']) for (const m of [0, 5, 15, 60, 120]) for (const spf of [null, 15, 50]) {
    const d = Y.simulateDish(seed * 7919, { strain, spf, foil: false, dark: false, minutes: m }, 0);
    assert.ok(Number.isInteger(d.truth) && d.truth >= 0 && Number.isFinite(d.dose) && d.dose >= 0 && d.survival >= 0 && d.survival <= 1);
  }
});
test('simulated counts follow the model on average and look like class data', () => {
  const mean = (spec, n) => { let t = 0; for (let i = 0; i < n; i++) t += Y.simulateDish(i * 977 + 3, spec, 0).truth; return t / n; };
  const dark = mean({ strain: 'sensitive', dark: true, minutes: 0 }, 200), none = mean({ strain: 'sensitive', minutes: 15 }, 200), s15 = mean({ strain: 'sensitive', spf: 15, minutes: 15 }, 200), s50 = mean({ strain: 'sensitive', spf: 50, minutes: 15 }, 200);
  assert.ok(dark > 185 && dark < 215, 'dark ~200: ' + dark); assert.ok(dark > s50 && s50 > s15 && s15 > none && none < 5, [dark, s50, s15, none].join());
  const zeros = Array.from({ length: 50 }, (_, i) => Y.simulateDish(i, { strain: 'sensitive', minutes: 60 }, 0).truth);
  assert.ok(zeros.every(n => n === 0), 'a long unprotected exposure can leave no colonies');
});
test('plan to dishes, ratings, directions, days, layout', () => {
  const both = Y.dishesFromPlan({ conditions: P.preset('class').conditions, strainMode: 'both' });
  assert.equal(both.dishes.length, 16); assert.ok(both.fromPlan); assert.equal(new Set(both.dishes.map(d => d.id)).size, 16);
  assert.equal(Y.dishesFromPlan(null).dishes.length, 8); assert.equal(Y.dishesFromPlan(null).fromPlan, false);
  const rep = Y.dishesFromPlan({ conditions: P.preset('time').conditions, strainMode: 'sensitive' }).dishes; assert.deepEqual(rep.filter(d => d.minutes === 15).map(d => d.rep), [0, 1]);
  assert.deepEqual([0, 1, 25, 26, 100, 101].map(Y.ratingFor), ['none', 'few', 'few', 'some', 'some', 'many']);
  assert.equal(Y.actualDirection(100, 0), 'more'); assert.equal(Y.actualDirection(0, 0), 'same'); assert.equal(Y.actualDirection(50, 100), 'fewer'); assert.equal(Y.actualDirection(NaN, 100), null);
  for (let s = 0; s < 50; s++) { const d = Y.incubationDaysFor(s); assert.ok(d >= 3 && d <= 5); }
  const L = Y.layoutColonies(5, 150); assert.equal(L.length, 150); assert.ok(L.every(c => Math.hypot(c.x, c.y) + c.r <= 1)); assert.deepEqual(L, Y.layoutColonies(5, 150)); assert.equal(Y.layoutColonies(5, 0).length, 0);
});

test('UV dose depends only on the cover and the minutes: same for either yeast, every student, and 15 / SPF for sunscreen', () => {
  for (const seed of [1, 99, 123456, 987654321]) for (const spf of [15, 18, 20, 30, 50]) {
    const a = Y.simulateDish(seed, { strain: 'sensitive', spf, foil: false, dark: false, minutes: 15 }, 0);
    const b = Y.simulateDish(seed, { strain: 'wild', spf, foil: false, dark: false, minutes: 15 }, 0);
    assert.equal(a.dose, Math.round(15 / spf * 100) / 100, 'SPF ' + spf + ' gives 15 / SPF minutes of dose');
    assert.equal(a.dose, b.dose, 'both strains get the same dose for the same cover');
  }
  // a higher SPF never gives a higher dose
  const doses = [15, 18, 20, 30, 50].map(spf => Y.simulateDish(7, { strain: 'sensitive', spf, foil: false, dark: false, minutes: 15 }, 0).dose);
  assert.deepEqual(doses, doses.slice().sort((x, y) => y - x));
});
