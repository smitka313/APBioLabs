/* Carbon & Energy Budget — an original controlled comparison after OpenSciEd B.2
 * Lesson 9. The Location Cards and Carbon/Energy Quantitative Model handout
 * describe pathways and categorical energy changes, not numeric energy, fire
 * severity, elapsed years, reservoir sizes or a paired wildfire experiment.
 * Their original seven-station dice rules are not used or changed by this mode.
 *
 * Values below are chosen model units, neither measured quantities nor grams,
 * CO₂ concentration, or joules. The same prescribed moves in each case isolate
 * one peat-fire transfer. The energy ledger follows a normalized one unit of
 * chemical energy per organic carbon unit, with a visible sunlight boundary
 * input and a cumulative dispersed thermal-energy output. That output is a
 * bookkeeping account, not heat remaining at the site or air temperature.
 * Neither the moves nor the simplicity of the energy ratio describe natural
 * rates. Nothing here models ignition, atmospheric feedback, or a real fire.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CarbonBudgetLogic = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RESERVOIRS = Object.freeze({
    air: 'Atmosphere', ocean: 'Ocean', plants: 'Living plants', peat: 'Peat and buried organic matter'
  });
  const ENERGY = Object.freeze({
    plants: 'Chemical energy in living plants', peat: 'Chemical energy in stored organic matter',
    heat: 'Dispersed thermal energy', sunlight: 'Sunlight added so far'
  });
  const INITIAL_CARBON = Object.freeze({ air: 12, ocean: 5, plants: 5, peat: 8 });
  const INITIAL_ENERGY = Object.freeze({ plants: 5, peat: 8, heat: 0, sunlight: 0 });
  const sum = obj => Object.values(obj).reduce((a, b) => a + b, 0);
  const energyAccounted = e => e.plants + e.peat + e.heat;
  const INITIAL_CARBON_TOTAL = sum(INITIAL_CARBON);
  const INITIAL_ENERGY_TOTAL = energyAccounted(INITIAL_ENERGY);

  const transfer = (from, to, amount) => Object.freeze({ from, to, amount });
  const lane = (description, carbon, energy = null) => Object.freeze({ description, carbon, energy });
  const common = (id, title, description, carbon, energy) => {
    const move = lane(description, carbon, energy);
    return Object.freeze({ id, title, description, baseline: move, fire: move });
  };
  const STEPS = Object.freeze([
    common('photosynthesis', 'Photosynthesis',
      'Plants take in carbon dioxide and store part of the incoming sunlight as chemical energy.',
      transfer('air', 'plants', 2), transfer('sunlight', 'plants', 2)),
    common('plant-respiration', 'Plant respiration',
      'Plants return some carbon to the air as carbon dioxide. Some stored chemical energy disperses as thermal energy.',
      transfer('plants', 'air', 1), transfer('plants', 'heat', 1)),
    common('ocean-uptake', 'Carbon enters the ocean',
      'Carbon dioxide moves from the air into the ocean. No tracked chemical-energy transfer is recorded for this move.',
      transfer('air', 'ocean', 1)),
    Object.freeze({
      id: 'peat-fire', title: 'Compare peat with and without fire',
      description: 'Only this step differs between the two cases.',
      baseline: lane('No fire occurs in this case. The stored carbon and chemical energy are unchanged in this step.', null),
      fire: lane('A modeled peat fire moves stored carbon to the atmosphere as carbon dioxide. Stored chemical energy disperses as thermal energy.',
        transfer('peat', 'air', 4), transfer('peat', 'heat', 4))
    }),
    common('burial', 'Dead plant matter enters storage',
      'Dead plant material transfers carbon and chemical energy into buried organic matter. This step does not assume the new litter turns into peat instantly.',
      transfer('plants', 'peat', 2), transfer('plants', 'peat', 2)),
    common('decomposer-respiration', 'Decomposer respiration',
      'Decomposers break down some stored organic matter, returning carbon dioxide to the air and releasing energy that disperses as heat.',
      transfer('peat', 'air', 1), transfer('peat', 'heat', 1)),
    common('ocean-release', 'Carbon returns from the ocean',
      'Carbon dioxide moves from the ocean to the air. No tracked chemical-energy transfer is recorded for this move.',
      transfer('ocean', 'air', 1)),
    common('photosynthesis-again', 'Photosynthesis continues',
      'Plants take in more carbon dioxide and store part of the incoming sunlight as chemical energy.',
      transfer('air', 'plants', 1), transfer('sunlight', 'plants', 1))
  ]);

  const emptyLane = () => Object.freeze({
    carbon: INITIAL_CARBON, energy: INITIAL_ENERGY, ledger: Object.freeze([])
  });
  function create() {
    return Object.freeze({ v: 1, index: 0, done: false, baseline: emptyLane(), fire: emptyLane() });
  }
  function preview(state) {
    const descriptor = STEPS[state.index];
    return descriptor ? Object.freeze({ ...descriptor, index: state.index + 1 }) : null;
  }
  function carbonMove(before, move) {
    const after = move
      ? Object.freeze({ ...before, [move.from]: before[move.from] - move.amount, [move.to]: before[move.to] + move.amount })
      : before;
    const total = sum(after);
    if (total !== INITIAL_CARBON_TOTAL || Object.values(after).some(n => !Number.isSafeInteger(n) || n < 0))
      throw Error('Invalid carbon transfer in the model');
    return Object.freeze({ from: move?.from ?? null, to: move?.to ?? null, amount: move?.amount ?? 0, before, after, total });
  }
  function energyMove(before, move) {
    // Input comes across the boundary: sunlight is a cumulative input counter,
    // not another energy stock to sum with chemical or dispersed thermal energy.
    const external = move?.from === 'sunlight';
    const after = move
      ? Object.freeze({ ...before,
        [move.from]: before[move.from] + (external ? move.amount : -move.amount),
        [move.to]: before[move.to] + move.amount })
      : before;
    const total = energyAccounted(after), expectedTotal = INITIAL_ENERGY_TOTAL + after.sunlight;
    if (total !== expectedTotal || Object.values(after).some(n => !Number.isSafeInteger(n) || n < 0))
      throw Error('Invalid energy transfer in the model');
    return Object.freeze({ from: move?.from ?? null, to: move?.to ?? null, amount: move?.amount ?? 0,
      before, after, total, expectedTotal });
  }
  function apply(branch, descriptor, move) {
    const carbon = carbonMove(branch.carbon, move.carbon);
    const energy = energyMove(branch.energy, move.energy);
    const row = Object.freeze({ id: descriptor.id, index: descriptor.index, title: descriptor.title,
      description: move.description, carbon, energy });
    return Object.freeze({ carbon: carbon.after, energy: energy.after, ledger: Object.freeze([...branch.ledger, row]) });
  }
  function step(state) {
    if (!state || state.v !== 1 || !Number.isInteger(state.index) || state.index < 0 || state.index > STEPS.length)
      throw Error('Invalid budget state');
    const next = preview(state);
    if (!next) return state;
    return Object.freeze({
      v: 1, index: next.index, done: next.index === STEPS.length,
      baseline: apply(state.baseline, next, next.baseline), fire: apply(state.fire, next, next.fire)
    });
  }
  function serialize(state) {
    return { v: 1, index: state.index };
  }
  function restore(raw) {
    if (raw == null) return create();
    try {
      const saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (saved?.v !== 1 || !Number.isInteger(saved.index) || saved.index < 0 || saved.index > STEPS.length) return null;
      let state = create();
      while (state.index < saved.index) state = step(state);
      return state;
    } catch (_) {
      return null;
    }
  }
  const difference = (a, b) => Object.fromEntries(Object.keys(a).map(key => [key, b[key] - a[key]]));
  function compare(state) {
    const totals = ({ carbon, energy }) => ({
      carbon, energy, carbonTotal: sum(carbon),
      energyTotal: energyAccounted(energy), energyExpected: INITIAL_ENERGY_TOTAL + energy.sunlight
    });
    return {
      initialCarbon: INITIAL_CARBON_TOTAL, initialEnergy: INITIAL_ENERGY_TOTAL,
      baseline: totals(state.baseline), fire: totals(state.fire),
      delta: { carbon: difference(state.baseline.carbon, state.fire.carbon),
        energy: difference(state.baseline.energy, state.fire.energy) }
    };
  }

  return Object.freeze({ RESERVOIRS, ENERGY, STEPS, INITIAL_CARBON, INITIAL_ENERGY,
    create, preview, step, compare, serialize, restore });
});
