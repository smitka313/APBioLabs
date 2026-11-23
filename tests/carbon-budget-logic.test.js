'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../carbon-budget-logic.js');

const carbon = b => [b.carbon.air, b.carbon.ocean, b.carbon.plants, b.carbon.peat];
const energy = b => [b.energy.plants, b.energy.peat, b.energy.heat, b.energy.sunlight];
// Independent accounting in air/ocean/plants/peat order, then energy in
// plant chemical/peat chemical/dispersed thermal/cumulative sunlight order.
const noFireCarbon = [
  [12,5,5,8], [10,5,7,8], [11,5,6,8], [10,6,6,8], [10,6,6,8],
  [10,6,4,10], [11,6,4,9], [12,5,4,9], [11,5,5,9]
];
const fireCarbon = [
  [12,5,5,8], [10,5,7,8], [11,5,6,8], [10,6,6,8], [14,6,6,4],
  [14,6,4,6], [15,6,4,5], [16,5,4,5], [15,5,5,5]
];
const noFireEnergy = [
  [5,8,0,0], [7,8,0,2], [6,8,1,2], [6,8,1,2], [6,8,1,2],
  [4,10,1,2], [4,9,2,2], [4,9,2,2], [5,9,2,3]
];
const fireEnergy = [
  [5,8,0,0], [7,8,0,2], [6,8,1,2], [6,8,1,2], [6,4,5,2],
  [4,6,5,2], [4,5,6,2], [4,5,6,2], [5,5,6,3]
];
const sum = nums => nums.reduce((acc, n) => acc + n, 0);
const states = () => {
  const out = [L.create()];
  while (!out.at(-1).done) out.push(L.step(out.at(-1)));
  return out;
};

test('both matched scenarios reproduce the independent step-by-step budgets', () => {
  const all = states();
  assert.equal(all.length, 9);
  all.forEach((s, i) => {
    assert.equal(s.index, i);
    assert.deepEqual(carbon(s.baseline), noFireCarbon[i]);
    assert.deepEqual(carbon(s.fire), fireCarbon[i]);
    assert.deepEqual(energy(s.baseline), noFireEnergy[i]);
    assert.deepEqual(energy(s.fire), fireEnergy[i]);
  });
});

test('only the fire treatment prescribes different actions between the two lanes', () => {
  const all = states();
  const differences = L.STEPS.filter(s => s.baseline !== s.fire);
  assert.deepEqual(differences.map(s => s.id), ['peat-fire']);
  all.slice(1).forEach((s, i) => {
    const base = s.baseline.ledger.at(-1), fire = s.fire.ledger.at(-1);
    assert.equal(base.index, i + 1);
    assert.equal(base.id, fire.id);
    for (const field of ['carbon', 'energy']) {
      const keys = ({ from, to, amount }) => [from, to, amount];
      if (i === 3) {
        assert.deepEqual(keys(base[field]), [null, null, 0]);
        assert.deepEqual(keys(fire[field]), ['peat', field === 'carbon' ? 'air' : 'heat', 4]);
      } else {
        assert.deepEqual(keys(base[field]), keys(fire[field]));
      }
    }
  });
});

test('carbon and energy accounting hold in both branches at every step', () => {
  for (const s of states()) {
    for (const branch of [s.baseline, s.fire]) {
      assert.equal(sum(Object.values(branch.carbon)), 30);
      assert.ok([...Object.values(branch.carbon), ...Object.values(branch.energy)].every(v => Number.isInteger(v) && v >= 0));
      const { plants, peat, heat, sunlight } = branch.energy;
      assert.equal(plants + peat + heat, 13 + sunlight, 'cumulative sunlight is an input, not a stock');
      assert.equal(plants, branch.carbon.plants);
      assert.equal(peat, branch.carbon.peat);
      const row = branch.ledger.at(-1);
      if (row) {
        assert.equal(row.carbon.total, 30);
        assert.equal(row.energy.total, 13 + sunlight);
        assert.equal(row.energy.total, row.energy.expectedTotal);
        assert.deepEqual(row.carbon.after, branch.carbon);
        assert.deepEqual(row.energy.after, branch.energy);
      }
    }
  }
});

test('completed comparison preserves the effect in the right accounts', () => {
  const s = states().at(-1), r = L.compare(s);
  assert.equal(r.baseline.carbon.air, 11);
  assert.equal(r.fire.carbon.air, 15);
  assert.deepEqual(r.delta, {
    carbon: { air: 4, ocean: 0, plants: 0, peat: -4 },
    energy: { plants: 0, peat: -4, heat: 4, sunlight: 0 }
  });
  assert.equal(r.baseline.energy.heat, 2);
  assert.equal(r.fire.energy.heat, 6);
  assert.equal(r.baseline.energyExpected, 16);
  assert.equal(r.fire.energyExpected, 16);
  assert.equal(L.preview(s), null);
  assert.equal(L.step(s), s, 'extra clicks on a complete comparison do not change it');
});

test('preview and step do not mutate earlier evidence; save restores by replay', () => {
  const all = states();
  assert.ok(Object.isFrozen(L.STEPS[0].fire.carbon));
  for (const s of all) {
    const saved = L.serialize(s);
    assert.deepEqual(saved, { v: 1, index: s.index });
    assert.deepEqual(L.restore(JSON.stringify(saved)), s);
    assert.deepEqual(L.restore({ ...saved, fire: { carbon: { air: 999 } } }), s);
    assert.equal(s.baseline.ledger.length, s.index);
    assert.equal(s.fire.ledger.length, s.index);
    if (!s.done) {
      const next = L.preview(s);
      assert.equal(next.index, s.index + 1);
      assert.equal(L.step(s).fire.ledger.at(-1).id, next.id);
    }
  }
  assert.deepEqual(L.restore(null), L.create());
  for (const bad of ['', 'not JSON', 'null', {}, { v: 1, index: -1 }, { v: 1, index: 9 },
    { v: 1, index: 2.5 }, { v: 1, index: '4' }, { v: 2, index: 0 }]) assert.equal(L.restore(bad), null);
});
