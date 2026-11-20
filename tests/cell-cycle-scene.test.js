const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
/* Draws the scene with a fake 2D context and records what it paints. */
function scene() {
  const labels = [], squares = [], fills = [];
  let fillStyle = '';
  const ctx = new Proxy({
    fillText(value, x, y) { labels.push({ value: String(value), x, y }); },
    roundRect(x, y, w, h) { squares.push({ w, h, fill: null }); },
    fill() { if (squares.length) squares[squares.length - 1].fill = squares[squares.length - 1].fill || fillStyle; fills.push(fillStyle); },
    strokeRect(...args) { squares.push({ ring: true, args }); },
    createLinearGradient() { return { addColorStop() {} }; }, createRadialGradient() { return { addColorStop() {} }; }
  }, {
    get(target, key) { return key in target ? target[key] : () => {}; },
    set(target, key, value) { if (key === 'fillStyle') fillStyle = value; target[key] = value; return true; }
  });
  const canvas = { width: 1160, height: 760, style: {}, getContext: () => ctx, addEventListener() {}, getBoundingClientRect: () => ({ width: 1160, height: 760, left: 0, top: 0 }) };
  const observer = class { observe() {} };
  const environment = { window: { matchMedia: () => ({ matches: true }) }, document: { getElementById: id => id === 'cycle-scene' ? canvas : {}, addEventListener() {} },
    ResizeObserver: observer, IntersectionObserver: observer, performance: { now: () => 0 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../cell-cycle-scene.js'), 'utf8'), environment);
  return { labels, squares, fills, api: environment.window.CellCycleScene, reset() { labels.length = 0; squares.length = 0; fills.length = 0; } };
}
/* The OpenSciEd board: START, 6 G1, G1 Checkpoint, 8 S, 8 G2, G2 Checkpoint, 5 M (Must roll 1-5), M Checkpoint, FINISH. */
function board() {
  const t = [{ type: 'start', phase: 'start', label: 'START' }];
  for (let i = 1; i <= 6; i++) t.push({ type: 'space', phase: 'g1', n: i, label: 'G1 space ' + i, chance: i % 2 === 0 });
  t.push({ type: 'checkpoint', phase: 'g1', label: 'G1 Checkpoint' });
  for (let i = 1; i <= 8; i++) t.push({ type: 'space', phase: 's', n: i, label: 'S space ' + i, chance: i % 2 === 1 });
  for (let i = 1; i <= 8; i++) t.push({ type: 'space', phase: 'g2', n: i, label: 'G2 space ' + i, chance: i % 2 === 1 });
  t.push({ type: 'checkpoint', phase: 'g2', label: 'G2 Checkpoint' });
  for (let i = 1; i <= 5; i++) t.push({ type: 'space', phase: 'm', n: i, roll: i, label: 'M space ' + i, chance: i % 2 === 0 });
  t.push({ type: 'checkpoint', phase: 'm', label: 'M Checkpoint' });
  t.push({ type: 'finish', phase: 'finish', label: 'FINISH' });
  return t;
}
const player = (extra) => Object.assign({ id: 1, pos: 0, score: { g1: { nutrients: 0, proteins: 0, organelles: 0 }, s: { chromosomes: 0 }, g2: { nutrients: 0, proteins: 0, organelles: 0 } }, blue: 0, red: 0 }, extra);
test('the board has 32 positions with START and FINISH named, and light-blue squares on the chance spaces in both rounds', () => {
  const s = scene(), track = board();
  assert.equal(track.length, 32);
  const game = { round: 1, active: 0, turns: 0, playersState: [], lastDice: [], event: {} };
  s.api.update(game, track);
  const light = s.squares.filter(q => q.fill === '#bfe7f7');
  assert.equal(light.length, 13, 'the 13 light-blue squares are drawn in Round 1, as on the paper board');
  assert.ok(s.labels.some(l => l.value === 'START') && s.labels.some(l => l.value === 'FINISH'), 'START and FINISH are labelled');
  // Space 1 (the first G1 space) is at angle 1/32 of the way round and shows its phase ordinal "1".
  const angle = -Math.PI / 2 + 1 / 32 * Math.PI * 2;
  assert.ok(s.labels.some(l => l.value === '1' && Math.abs(l.x - (568 + Math.cos(angle) * 428)) < .01), 'G1 space 1 is drawn at the first position after START');
  for (const roll of ['1', '2', '3', '4', '5']) assert.ok(s.labels.filter(l => l.value === roll).length >= 1, 'M spaces show their Must roll number ' + roll);
  assert.ok(s.labels.some(l => /5–6\s+Nothing to check off/.test(l.value)) && s.labels.some(l => /M: roll the number on the next space/.test(l.value)), 'the dice key on the canvas matches the rules');
  assert.ok(!s.labels.some(l => /SPINDLE|ATTACH/i.test(l.value)), 'no spindle-attachment rule is drawn');
  s.reset(); game.round = 2; s.api.update(game, track);
  assert.equal(s.squares.filter(q => q.ring).length, 13, 'Round 2 rings each light-blue square');
});
test('cell chips are drawn per player with their counts written out', () => {
  const s = scene();
  const game = { round: 2, active: 0, turns: 3, playersState: [player({ blue: 2, red: 1 }), player({ id: 2, blue: 0, red: 3 })], lastDice: [1, 2, 3, 4], event: {} };
  s.api.update(game, board());
  assert.ok(s.labels.some(l => l.value === 'CELL CHIPS'));
  assert.ok(s.labels.some(l => l.value === '2 blue') && s.labels.some(l => l.value === '1 red') && s.labels.some(l => l.value === '3 red'), 'chip counts appear as text beside the colours');
});
test('FINISH shows daughter cells: identical DNA after a blue chip, one changed chromosome after a red chip', () => {
  const s = scene();
  const game = { round: 2, active: 0, turns: 3, playersState: [player({ pos: 31, red: 1, lastChip: 'red' })], lastDice: [], event: {} };
  s.api.update(game, board());
  assert.ok(s.labels.some(l => l.value === 'Daughter cells · one carries changed DNA (game model)'));
  assert.ok(s.labels.some(l => /RED CHIP · CANCER CELL IN THIS GAME MODEL/.test(l.value)) && s.labels.some(l => l.value === 'CHANGED'));
  let state = JSON.parse(JSON.stringify(s.api.state()));
  assert.deepEqual(state.daughters.map(d => d.changed), [true, false], 'one daughter carries the changed chromosome');
  assert.ok(state.changedAt && s.fills.length, 'the changed section has a position on the canvas');
  s.reset(); game.playersState[0].lastChip = 'blue'; s.api.update(game, board());
  assert.ok(s.labels.some(l => l.value === 'Daughter cells · identical DNA') && s.labels.some(l => /NEW BLUE CHIP/.test(l.value)));
  assert.ok(!s.labels.some(l => l.value === 'CHANGED'));
  state = JSON.parse(JSON.stringify(s.api.state()));
  assert.deepEqual(state.daughters[0].chromosomes, state.daughters[1].chromosomes, 'blue chip: both daughters have the same chromosome set');
  assert.equal(state.changedAt, null);
});
