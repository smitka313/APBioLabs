const assert = require('node:assert/strict');
const test = require('node:test');
const C = require('../serengeti-concept-checks');
const L = require('../serengeti-logic');
const action = (state, type) => L.act(state, { type });

test('four classroom checks have one correct answer and useful feedback for each choice', () => {
  assert.deepEqual(C.ids, ['hunt', 'migration', 'event', 'comparison']);
  for (const id of C.ids) {
    const question = C.get(id);
    assert.equal(question.choices.length, 3);
    assert.equal(new Set(question.choices.map(choice => choice.id)).size, 3);
    const feedback = question.choices.map(choice => C.answer(id, choice.id));
    assert.equal(feedback.filter(result => result.correct).length, 1);
    assert.ok(feedback.every(result => result.feedback.length > 20));
    assert.equal(new Set(feedback.map(result => result.feedback)).size, 3);
  }
  assert.equal(C.answer('hunt', 'one-die').correct, true);
  assert.match(C.answer('event','no-target').feedback,/card leaves the board.*successful hunt is different.*splitting a small group/);
  assert.equal(C.answer('comparison', 'map-and-record').correct, true);
  assert.equal(C.get('__proto__'), null);
  assert.equal(C.answer('event', 'not-a-choice'), null);
});

test('progress retries are immutable and restore recomputes correctness from a validated answer', () => {
  const first = C.record({}, 'event', 'remove-group');
  const second = C.record(first, 'event', 'no-target');
  assert.deepEqual(first, { event: { choiceId: 'remove-group', correct: false, attempts: 1 } });
  assert.deepEqual(second, { event: { choiceId: 'no-target', correct: true, attempts: 2 } });
  const malformed = JSON.parse('{"__proto__":{"injected":true},"hunt":{"choiceId":"fake","attempts":1},"event":{"choiceId":"no-target","correct":false,"attempts":2},"migration":{"choiceId":"same-tokens","attempts":0}}');
  assert.deepEqual(C.restore(malformed), second);
  assert.deepEqual(C.restore(null), {});
  assert.deepEqual(C.record(second, 'event', 'illegal'), second);
  assert.deepEqual(C.restore(JSON.parse(JSON.stringify(second))), second);
});

test('milestones unlock only in the specified season and only after a real recorded action', () => {
  const s = { season: 0, log: [] };
  assert.deepEqual(C.available(), []);
  assert.deepEqual(C.available({ state: s, phase: { kind: 'hunt' } }), []);
  s.log.push({ kind: 'migration', season: 0 }, { kind: 'card', season: 0 }, { kind: 'hunt', season: 0 });
  assert.deepEqual(C.available({ state: s, phase: { kind: 'huntReview' } }), ['hunt']);
  s.season = 1;
  assert.deepEqual(C.available({ state: s, phase: { kind: 'migration' } }), ['hunt']);
  s.log.push({ kind: 'migration', season: 1 }, { kind: 'card', season: 1 });
  assert.deepEqual(C.available({ state: s, phase: { kind: 'card' } }), ['hunt', 'migration']);
  s.season = 2;
  assert.deepEqual(C.available({ state: s, phase: { kind: 'card', card: { id: 'old-sick' } } }), ['hunt', 'migration']);
  s.log.push({ kind: 'card', season: 2, change: 0 });
  assert.deepEqual(C.available({ state: s, phase: { kind: 'card' } }), ['hunt', 'migration', 'event']);
  s.season = 3;
  s.seasons = [null, null, null, { end: -2 }];
  assert.deepEqual(C.available({ state: s, phase: { kind: 'huntReview' } }), ['hunt', 'migration', 'event']);
  assert.deepEqual(C.available({ state: s, phase: { kind: 'seasonEnd' } }), C.ids);
});

test('real seeded playthrough unlocks all four checks, persists milestones, and never changes state or dice', () => {
  let state = L.create(641);
  const next = { migration: 'migrate', hyenaMove: 'beginHunts', lionMove: 'beginHunts', hunt: 'roll', seasonEnd: 'nextSeason' };
  const found = [];
  for (let i = 0; i < 400; i++) {
    const phase = L.phase(state);
    const before = JSON.stringify(state);
    for (const unlocked of C.available({ state, phase })) if (!found.includes(unlocked)) found.push(unlocked);
    assert.equal(JSON.stringify(state), before);
    if (phase.kind === 'complete') break;
    state = action(state, phase.kind === 'card' ? phase.card ? 'resolveCard' : 'draw' : next[phase.kind]);
  }
  assert.equal(L.phase(state).kind, 'complete');
  assert.deepEqual(found, C.ids);
  assert.deepEqual(C.available({ state: L.restore(JSON.parse(JSON.stringify(state))) }), C.ids);
});

test('Winter fallback unlocks the dice-reading check with zero completed hunts', () => {
  const state = { season: 0, log: [{ kind: 'migration', season: 0 }] };
  assert.deepEqual(C.available({ state, phase: { kind: 'lionMove' } }), []);
  assert.deepEqual(C.available({ state, phase: { kind: 'seasonEnd' } }), ['hunt']);
  assert.deepEqual(C.available({ state: { ...state, season: 1 }, phase: { kind: 'migration' } }), ['hunt']);
});
