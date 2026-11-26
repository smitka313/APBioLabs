'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const H = require('../openscied-b4-hawksbeard-logic');

test('browser and Node expose the same pure deterministic interface', () => {
  const scope = {};
  const source = fs.readFileSync(require.resolve('../openscied-b4-hawksbeard-logic'), 'utf8');
  vm.runInNewContext(source, scope);
  assert.equal(JSON.stringify(scope.HawksLogic.makeTrial(0)), JSON.stringify(H.makeTrial(0)));
  assert.equal(H.validSeed(0), true);
  assert.equal(H.validSeed(0xFFFFFFFF), true);
  for (const bad of [undefined, null, '42', NaN, -1, 0.2, Infinity, 0x100000000]) {
    assert.equal(H.validSeed(bad), false);
    assert.throws(() => H.makeTrial(bad), RangeError);
  }
});

test('exactly five matched plants release eight feathery and two nonfeathery seeds each', () => {
  const {field,city} = H.makeTrial(42);
  assert.equal(field.length, 50);
  assert.equal(city.length, 50);
  const onlyFlight = list => list.map(({id, plant, type, start, end}) => ({id, plant, type, start, end}));
  assert.deepEqual(onlyFlight(field), onlyFlight(city));
  assert.equal(new Set(field.map(s => s.id)).size, 50);
  for (const side of [field,city]) {
    for (let i = 1; i <= 5; i++) {
      const head = side.filter(s => s.plant === i);
      assert.equal(head.length, 10);
      assert.equal(head.filter(s => s.type === 'feathery').length, 8);
      assert.equal(head.filter(s => s.type === 'nonfeathery').length, 2);
    }
  }
});

test('only a physical landing inside a drawn soil rectangle counts', () => {
  for (const seed of [0,1,2,31,42,123,270,0x80000000,0xFFFFFFFF]) {
    const trial = H.makeTrial(seed);
    for (const id of ['field','city']) {
      const record = H.layouts[id];
      for (const s of trial[id]) {
        assert.deepEqual(s.start, record.release);
        for (const v of [s.start.x,s.start.y,s.end.x,s.end.y]) assert.ok(v >= 0 && v <= 1);
        const hit = record.soil.find(r => s.end.x >= r.x && s.end.x <= r.x+r.width &&
          s.end.y >= r.y && s.end.y <= r.y+r.height);
        assert.equal(s.patchId, hit?.id ?? null);
        assert.equal(s.landed, !!hit);
        assert.equal(s.land, hit ? 'soil' : 'outside');
      }
    }
  }
  assert.equal(H.layouts.field.soil.length, 1);
  assert.equal(H.layouts.city.soil.length, 2);
  const a = H.layouts.city.soil[0], b = H.layouts.city.soil[1];
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  assert.ok(a.x+a.width < b.x);
});

test('inclusive map edges count; gaps and nonfinite endpoints do not', () => {
  const eps = 1e-7;
  for (const id of ['field','city']) {
    for (const r of H.layouts[id].soil) {
      assert.equal(H.classify(id,{x:r.x,y:r.y}), r);
      assert.equal(H.classify(id,{x:r.x+r.width,y:r.y+r.height}), r);
      assert.equal(H.classify(id,{x:r.x-eps,y:r.y+r.height/2}), null);
      assert.equal(H.classify(id,{x:r.x+r.width+eps,y:r.y+r.height/2}), null);
      assert.equal(H.classify(id,{x:r.x+r.width/2,y:r.y+r.height+eps}), null);
    }
  }
  assert.equal(H.classify('city',{x:0.48,y:0.50}), null);
  assert.ok(H.classify('field',{x:0.48,y:0.50}));
  assert.equal(H.classify('city',{x:NaN,y:0.50}), null);
  assert.equal(H.classify('city',null), null);
  assert.equal(H.classify('unknown',{x:0.25,y:0.50}), null);
});

test('count, per-type landing rate and composition have distinct denominators', () => {
  const {stats} = H.makeTrial(0);
  const f = stats.field.byType.nonfeathery, c = stats.city.byType.nonfeathery;
  assert.equal(f.landed, 9);
  assert.equal(c.landed, 9);
  assert.equal(f.survival, 9/10);
  assert.equal(c.survival, 9/10);
  assert.equal(f.share, 9/47);
  assert.equal(c.share, 9/32);
  assert.ok(c.share > f.share, 'same numerator, fewer landings of the other type');

  const sample = H.makeTrial(3).field.filter(r => r.plant <= 2);
  const firstTwo = H.summarize(sample);
  assert.equal(firstTwo.released, 20);
  assert.equal(firstTwo.landed, sample.filter(s => s.landed).length);
  assert.equal(firstTwo.missed + firstTwo.landed, 20);
  assert.equal(firstTwo.byType.feathery.released, 16);
  assert.equal(firstTwo.byType.nonfeathery.released, 4);
  assert.ok(Math.abs(firstTwo.byType.feathery.share + firstTwo.byType.nonfeathery.share - 1) < 1e-12);

  const empty = H.summarize([]);
  assert.equal(empty.landed, 0);
  for (const type of H.TYPES) {
    assert.equal(empty.byType[type].share, null);
    assert.equal(empty.byType[type].survival, null);
  }
  const noneOnSoil = H.summarize([{type:'nonfeathery',landed:false}]);
  assert.equal(noneOnSoil.byType.nonfeathery.survival, 0);
  assert.equal(noneOnSoil.byType.nonfeathery.share, null);
  assert.equal(noneOnSoil.byType.feathery.survival, null);
  assert.throws(() => H.summarize([{}]), TypeError);
});

test('seeds are reproducible, other trials differ, and no outcome is forced', () => {
  const first = H.makeTrial(42);
  H.makeTrial(0);
  assert.deepEqual(H.makeTrial(42), first);
  assert.notDeepEqual(H.makeTrial(43).field.map(s => s.end), first.field.map(s => s.end));
  assert.ok(Object.isFrozen(first.field[0].end) && Object.isFrozen(first.city));
  const reverse = H.makeTrial(270).stats;
  assert.ok(reverse.city.byType.nonfeathery.share < reverse.field.byType.nonfeathery.share,
    'an individual model trial can disagree with the overall tendency');

  const repetitions = 200;
  const results = [];
  const meanDistance = (flight, type) => {
    const rows = flight.filter(r => r.type === type);
    return rows.reduce((n, r) => n + Math.hypot(r.end.x-r.start.x,r.end.y-r.start.y), 0)/rows.length;
  };
  let feathers = 0, nonfeathers = 0, rising = 0;
  for (let seed = 0; seed < repetitions; seed++) {
    const {field,stats} = H.makeTrial(seed);
    feathers += meanDistance(field, 'feathery');
    nonfeathers += meanDistance(field, 'nonfeathery');
    if (stats.city.byType.nonfeathery.share > stats.field.byType.nonfeathery.share) rising++;
    results.push(stats.city.landed);
  }
  assert.ok(feathers > nonfeathers, 'the dispersing form typically travels farther');
  assert.ok(rising > repetitions/2, 'the paired model typically favors nonfeathery share in patchy soil');
  assert.ok(new Set(results).size >= 6, 'landings are not matched to a hidden quota');
});

test('published plot composition and common garden are separate from simulated trials', () => {
  const {plot,commonGarden,doi} = H.published;
  assert.equal(doi, '10.1073/pnas.0708446105');
  assert.deepEqual([plot.before,plot.landed,plot.changePercentagePoints],[0.15,0.28,13]);
  assert.equal(commonGarden.urbanSites+commonGarden.nonurbanSites, commonGarden.sites);
  assert.equal(commonGarden.fragmentedSites+commonGarden.unfragmentedSites, commonGarden.sites);
  assert.notEqual(commonGarden.urbanSites, commonGarden.fragmentedSites,
    'the urban continuous site prevents equating location with fragmentation');
  assert.equal(commonGarden.plantsPerSite,30);
  assert.equal(H.makeTrial(0).published,undefined);
});


test('the explanation puts both modeling limits beside the trial evidence',()=>{
  const fs=require('node:fs'), path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'..','openscied-b4-hawksbeard.html'),'utf8');
  const explain=html.slice(html.indexOf('<section id="hb-explain"'),html.indexOf('<div class="hb-footerbar">'));
  const limit=explain.match(/<p id="hb-evidence-limit"[^>]*>(.*?)<\/p>/)?.[1]||'';
  assert.match(limit,/simulated soil landings, not germination, survival, or reproduction/);
  assert.match(limit,/both soil amount and patch arrangement.*cannot separate/);
  assert.ok(explain.indexOf('id="hb-evidence-limit"')<explain.indexOf('<details class="hb-published"'));
});
