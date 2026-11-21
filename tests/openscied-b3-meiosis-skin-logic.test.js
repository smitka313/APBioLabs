// Pure logic of the meiosis and skin-data scenes (Lessons 8-9 companion). Run: node --test tests/openscied-b3-meiosis-skin-logic.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const M = require('../meiosis-scene.js'), S = require('../skin-data-scene.js'), L = require('../openscied-b3-inheritance-logic.js');
const rngOf = seed => { let s = seed >>> 0; return { uniform() { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } }; };

test('meiosis: two gamete kinds without crossing over, four with it', () => {
  assert.deepEqual(M.animationGametes(['AC', 'BD'], false), ['AC', 'AC', 'BD', 'BD']);
  assert.deepEqual([...new Set(M.animationGametes(['AC', 'BD'], true))].sort(), ['AC', 'AD', 'BC', 'BD']);
  for (const p of M.PARENTS) for (const c of [false, true]) assert.deepEqual([...new Set(M.animationGametes(p, c))].sort(), L.gameteTypes(p, c), p + ' ' + c);
});
test('meiosis: closer genes are separated less often; never above 50 percent; off means zero', () => {
  const ab = M.EXIT_PAIRS.find(x => x.id === 'ab'), ac = M.EXIT_PAIRS.find(x => x.id === 'ac'), ad = M.EXIT_PAIRS.find(x => x.id === 'ad');
  assert.ok(M.togetherPercent(ab.cM) > M.togetherPercent(ac.cM) && M.togetherPercent(ac.cM) > M.togetherPercent(ad.cM), 'a-b stay together most: the exit-ticket answer "ab"');
  assert.deepEqual([ab.cM, ac.cM, ad.cM], [9, 42, 73]);
  for (const d of [0, 1, 2, 9, 50, 100, 1e6, NaN, -5]) { const r = M.newPercent(true, M.clampDist(d)); assert.ok(r >= 0 && r <= 50 && Number.isFinite(r)); }
  assert.equal(M.newPercent(false, 40), 0);
});
test('meiosis: sampled tallies are seeded, valid, and follow the model on average', () => {
  const a = M.sampleGametes(rngOf(7), 10, ['AC', 'BD'], true, 9), b = M.sampleGametes(rngOf(7), 10, ['AC', 'BD'], true, 9);
  assert.deepEqual(a, b); assert.equal(a.length, 10);
  assert.ok(a.every(g => M.ALL_TYPES.includes(g)));
  assert.ok(M.sampleGametes(rngOf(3), 500, ['AC', 'BD'], false, 9).every(g => g === 'AC' || g === 'BD'), 'no new combinations when crossing over is off');
  const big = M.sampleGametes(rngOf(11), 20000, ['AC', 'BD'], true, 42), fresh = big.filter(g => !M.isParental(g, ['AC', 'BD'])).length / big.length * 100;
  assert.ok(Math.abs(fresh - L.recombinantPercent(42)) < 1.2, 'observed ' + fresh);
  const t = M.tally(a, ['AC', 'BD']); assert.equal(t.parental + t.fresh, 10);
});
test('meiosis: which-gametes check', () => {
  assert.equal(M.checkPick(['AC', 'BD'], false, ['AC', 'BD']).status, 'correct');
  assert.equal(M.checkPick(['AC', 'BD'], false, ['AC', 'BD', 'AD']).status, 'wrong');
  assert.equal(M.checkPick(['AC', 'BD'], true, ['AC', 'BD']).status, 'wrong');
  assert.equal(M.checkPick(['AC', 'BD'], true, ['AC', 'AD', 'BC', 'BD']).status, 'correct');
  assert.equal(M.checkPick(['AC', 'AD'], true, ['AC', 'AD']).status, 'correct');
  assert.equal(M.checkPick(['AC', 'BD'], true, []).status, 'empty');
});
test('meiosis: every chromosome stays inside its cell at every step, both layouts', () => {
  for (const G of Object.values(M.LAYOUTS)) for (let st = 0; st <= 5; st++) {
    const cells = M.cellsAt(G, st);
    for (let p = 0; p < 2; p++) for (let h = 0; h < 2; h++) for (let s = 0; s < 2; s++) {
      const q = M.pose(G, p, h, s, st); if (!q.show) continue;
      [[q.x - G.barW / 2, q.y], [q.x + G.barW / 2, q.y], [q.x - G.barW / 2, q.y + q.len], [q.x + G.barW / 2, q.y + q.len]].forEach(([x, y]) =>
        assert.ok(cells.some(c => ((x - c.cx) / c.rx) ** 2 + ((y - c.cy) / c.ry) ** 2 <= 0.97), G.key + ' step ' + st));
    }
    const gp = M.genePositions(G, 100); assert.ok(gp.y2 + G.band / 2 < G.L && gp.yb > gp.y1 && gp.yb < gp.y2);
  }
});

// The values the owner will verify against the paper (approximate readings of the lesson's three figures, measured from pixel positions).
const VERIFIED = {
  white: { Hawaii: 46, Atlanta: 28, 'New Mexico': 26, 'San Jose': 25, Connecticut: 24.5, Seattle: 25, 'Los Angeles': 25, 'San Francisco': 23.5, Utah: 23, Detroit: 20.5, Iowa: 18 },
  black: { Utah: 1.7, Connecticut: 1.5, Seattle: 1.4, 'New Mexico': 1.4, Atlanta: 1.2, 'Los Angeles': 1.1, Iowa: 0.9, Detroit: 0.9, 'San Francisco': 0.8, Hawaii: 0.2, 'San Jose': 0.1 },
  hispanic: { Atlanta: 10, Utah: 9.6, 'San Francisco': 5.9, Connecticut: 5.7, Seattle: 4.7, Iowa: 4.5, 'San Jose': 4.3, 'Los Angeles': 3.7, 'New Mexico': 3.4, Detroit: 2.5, Hawaii: 0 } };
const UV = { Hawaii: 9.7, Atlanta: 5.0, 'New Mexico': 6.2, 'San Jose': 5.3, Connecticut: 3.5, Seattle: 2.7, 'Los Angeles': 5.9, 'San Francisco': 5.3, Utah: 4.8, Detroit: 3.4, Iowa: 4.0 };
test('skin: the readings equal the verified table', () => {
  for (const g of S.GROUPS) { const pts = S.points(g); assert.equal(pts.length, 11); pts.forEach(p => { assert.equal(p.rate, VERIFIED[g][p.site], g + ' ' + p.site); assert.equal(p.uv, UV[p.site]); }); }
  assert.deepEqual(S.AXES.white, { max: 50, step: 10 }); assert.equal(S.AXES.black.max, 1.8); assert.equal(S.AXES.hispanic.max, 12);
  for (const g of S.GROUPS) S.points(g).forEach(p => assert.ok(p.rate <= S.AXES[g].max && p.rate >= 0));
});
test('skin: polls have one right answer computed from the data, and trends match the lesson', () => {
  assert.deepEqual(S.POLLS.map(p => p.answer()), ['Hawaii', 'The lowest', 'Atlanta']);
  S.POLLS.forEach(p => { assert.equal(S.checkPoll(p.id, p.answer()).status, 'correct'); p.options.filter(o => o !== p.answer()).forEach(o => assert.equal(S.checkPoll(p.id, o).status, 'wrong')); });
  assert.equal(S.checkPoll('nope', 'x').status, 'empty');
  assert.ok(S.trend('white').r > 0.5 && S.trend('hispanic').r < S.trend('white').r);
  assert.ok(Math.round(S.ratio('white', 'black')) >= 20 && Math.round(S.ratio('white', 'black')) <= 30);
});
test('skin: labels are placed inside the plot', () => {
  for (const g of S.GROUPS) {
    const ax = S.AXES[g], items = S.points(g).map(p => ({ site: p.site, text: p.site, x: 56 + p.uv / 12 * 270, y: 12 + 230 - p.rate / ax.max * 230 }));
    const out = S.placeLabels(items, { l: 58, r: 340, t: 12, b: 244 }, 12);
    assert.ok(Object.keys(out).length >= 5, g + ' labels placed: ' + Object.keys(out).length);
    Object.values(out).forEach(o => assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y)));
  }
});
