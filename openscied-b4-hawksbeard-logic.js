/* OpenSciEd B.4 Lesson 2 digital classroom model of Crepis sancta dispersal.
 *
 * Source for the setup: Seed Dispersal Investigation + Seed Investigation
 * Protocol. Five model plants per setting release the same ten seeds each:
 * eight feathery and two nonfeathery. A continuous field contrasts with two
 * small, separated urban patches, one downwind of the release. The layout
 * changes both shape and total suitable surface, as in the classroom model.
 *
 * Distances, soil shapes and wind kernels are illustrative, not measurements.
 * We generate a seed's modeled flight once and use it in both paired settings.
 * More buoyant feathery seeds generally travel farther with wider scatter;
 * either type can miss soil. There is no terrain-specific wind, tuned outcome
 * quota, or reroll of landings. A seed landing on soil has potential to
 * germinate; actual germination, reproduction and inheritance are not modeled.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HawksLogic = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PLANTS = 5;
  const SEEDS_PER_PLANT = Object.freeze({ feathery:8, nonfeathery:2 });
  const TYPES = Object.freeze(Object.keys(SEEDS_PER_PLANT));
  const release = Object.freeze({ x:0.25, y:0.50 });
  const wind = Object.freeze({ dx:1, dy:0 });
  const rectangle = (id, x, y, width, height) => Object.freeze({ id, x, y, width, height });
  const layout = (id, label, soil) => Object.freeze({ id, label, soil:Object.freeze(soil), release, wind });

  // All units are normalized to the same full view (0–1). Render these same
  // rectangles, not approximations; their edges are included by classify().
  const layouts = Object.freeze({
    field:layout('field', 'Continuous field', [rectangle('field-soil', 0.08, 0.17, 0.84, 0.66)]),
    city:layout('city', 'Fragmented city', [
      rectangle('upwind-patch', 0.09, 0.26, 0.32, 0.48),
      rectangle('downwind-patch', 0.54, 0.26, 0.32, 0.48)
    ])
  });

  // Published results do not parameterize the classroom model. The two
  // experiments test different things: who lands in a patch; what plants from
  // different source populations produce under shared growing conditions.
  const published = Object.freeze({
    citation:'Cheptou, Carrue, Rouifed & Cantarel (2008), PNAS 105, 3796–3799',
    title:'Rapid evolution of seed dispersal in an urban environment in the weed Crepis sancta',
    doi:'10.1073/pnas.0708446105',
    url:'https://doi.org/10.1073/pnas.0708446105',
    plot:Object.freeze({ before:0.15, landed:0.28, changePercentagePoints:13, artificialPatches:3 }),
    // "Urban" describes origin, not patchiness: one city source was continuous.
    commonGarden:Object.freeze({ sites:11, urbanSites:8, nonurbanSites:3, fragmentedSites:7, unfragmentedSites:4, plantsPerSite:30 })
  });

  const validSeed = value => Number.isInteger(value) && value >= 0 && value <= 0xFFFFFFFF;
  function randomStream(seed) {
    let word = seed >>> 0;
    // One stream per paired trial. All arithmetic uses bounded uint32 values.
    return function next() {
      word = (word + 0x6D2B79F5) >>> 0;
      let value = Math.imul(word ^ (word >>> 15), word | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function classify(layoutId, point) {
    if ((layoutId !== 'field' && layoutId !== 'city') || !point ||
        !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return layouts[layoutId].soil.find(rect =>
      point.x >= rect.x && point.x <= rect.x + rect.width &&
      point.y >= rect.y && point.y <= rect.y + rect.height) || null;
  }

  function flight(random, type) {
    const distance = random(), lateral = random() * 2 - 1, tumble = random();
    let dx, dy;
    if (type === 'feathery') {
      dx = 0.045 + 0.625 * distance;
      dy = lateral * (0.13 + 0.28 * Math.sqrt(distance));
    } else {
      // Heavy model seeds usually stay near the plant, with occasional bounce.
      const bounce = tumble < 0.25 ? 2.5 : 1;
      dx = 0.025 + bounce * (distance - 0.5) * 0.12;
      dy = bounce * lateral * 0.15;
    }
    return Object.freeze({ x:release.x + dx, y:release.y + dy });
  }

  function summarize(records) {
    if (!Array.isArray(records)) throw new TypeError('Provide an array of seed records.');
    const byType = { feathery:{ released:0, landed:0 }, nonfeathery:{ released:0, landed:0 } };
    for (const item of records) {
      const type = item?.type;
      if (!TYPES.includes(type) || typeof item.landed !== 'boolean') throw new TypeError('Invalid seed record.');
      byType[type].released++;
      if (item.landed) byType[type].landed++;
    }
    const released = records.length, landed = byType.feathery.landed + byType.nonfeathery.landed;
    for (const type of TYPES) {
      const row = byType[type];
      row.missed = row.released - row.landed;
      // survival: given a seed OF THIS TYPE, did it land on usable soil?
      row.survival = row.released ? row.landed / row.released : null;
      // share: given a seed ON USABLE SOIL, which type was it?
      row.share = landed ? row.landed / landed : null;
      Object.freeze(row);
    }
    return Object.freeze({ released, landed, missed:released - landed, byType:Object.freeze(byType) });
  }

  function makeTrial(seed) {
    if (!validSeed(seed)) throw new RangeError('The trial seed must be a whole number from 0 to 4294967295.');
    const rng = randomStream(seed);
    const projectiles = [];
    for (let plant = 1; plant <= PLANTS; plant++) {
      let slot = 0;
      for (const type of TYPES) {
        for (let i = 0; i < SEEDS_PER_PLANT[type]; i++) {
          slot++;
          projectiles.push({ id:'p'+plant+'-s'+slot, plant, type, start:release, end:flight(rng, type) });
        }
      }
    }
    const classifyAll = id => Object.freeze(projectiles.map(seed => {
      const patch = classify(id, seed.end);
      return Object.freeze({ ...seed, landed:!!patch, land:patch ? 'soil' : 'outside', patchId:patch?.id ?? null });
    }));
    const field = classifyAll('field'), city = classifyAll('city');
    return Object.freeze({ seed:seed === 0 ? 0 : seed, field, city,
      stats:Object.freeze({ field:summarize(field), city:summarize(city) }) });
  }

  return Object.freeze({ layouts, published, PLANTS, SEEDS_PER_PLANT, TYPES, validSeed, makeTrial, summarize, classify });
});
