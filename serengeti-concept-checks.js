/* Optional OpenSciEd B.1 Lesson 7 reflection prompts. This module only reads game
   evidence, never changes gameplay, and stores no data itself. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SerengetiChecks = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ids = Object.freeze(['hunt', 'migration', 'event', 'comparison']);
  const prompts = {
    migration: {
      title: 'Moving is not gaining or losing',
      prompt: 'When the wildebeest move to the season’s grazing area, why doesn’t that move change their population?',
      choices: [
        ['new-season', 'A new season always resets the population.', 'The same population carries into the next season. Compare the tokens before and after migration.'],
        ['same-tokens', 'The same wildebeest move to different squares.', 'Yes. Migration changes where the wildebeest are. Moving them does not add or remove animals.'],
        ['territory', 'Only wildebeest inside predator territory count.', 'Wildebeest count wherever they are on the board. Location can affect which predators meet them.']
      ],
      correct: 'same-tokens'
    },
    event: {
      title: 'Check what the card actually asks',
      prompt: 'Suppose a card says to remove one individual wildebeest, but only small-group and herd tokens are left. What should you do?',
      choices: [
        ['remove-group', 'Remove a small-group token instead.', 'A small-group token is not an individual. Look for the exact type the card names.'],
        ['replace', 'Split a herd so there is an individual to remove.', 'The card does not instruct you to split a herd. Only the specified change is allowed.'],
        ['no-target', 'Continue without removing a token.', 'Yes. There is no legal target. That card leaves the board and the modeled wildebeest population unchanged.']
      ],
      correct: 'no-target'
    },
    hunt: {
      title: 'Read a dice comparison',
      prompt: 'Imagine a paired comparison in a hunt: the predator rolls 5 and the wildebeest rolls 2. What does that pair tell you?',
      choices: [
        ['one-die', 'The wildebeest loses that die for the rest of this hunt.', 'Yes. The higher roll wins that comparison. One die is lost; the hunt may continue if both sides still have dice.'],
        ['automatic-loss', 'One wildebeest is removed from the game immediately.', 'One comparison removes a die, not an animal. A successful predator hunt can reduce the population when the hunt ends.'],
        ['both-reroll', 'Both sides keep their dice for this pair.', 'Both dice stay only when the paired rolls tie. Here 5 beats 2.']
      ],
      correct: 'one-die'
    },
    comparison: {
      title: 'Compare the seasons',
      prompt: 'What evidence would best help explain why hunts differed between two seasons?',
      choices: [
        ['season-names', 'Use the season names to decide which one had more hunts.', 'A season name does not tell you where the tokens were or how many hunts took place.'],
        ['map-and-record', 'Compare where animals could meet on the board and what the hunt records show.', 'Yes. Check whether eligible predators shared sides with wildebeest, then compare which hunts happened and how they ended. A possible hunt is not a guaranteed capture.'],
        ['final-total', 'Use only the final change in the wildebeest population.', 'The final change combines seasons and can include card effects. Look at the board evidence and hunt records for each season.']
      ],
      correct: 'map-and-record'
    }
  };
  const known = id => ids.includes(id);
  const questions = Object.fromEntries(ids.map(id => {
    const { title, prompt, choices } = prompts[id];
    return [id, Object.freeze({ id, title, prompt, choices: Object.freeze(choices.map(([key, label]) => Object.freeze({ id: key, label }))) })];
  }));
  const get = id => known(id) ? questions[id] : null;
  function answer(id, choiceId) {
    if (!known(id)) return null;
    const row = prompts[id].choices.find(([key]) => key === choiceId);
    return row ? { correct: choiceId === prompts[id].correct, feedback: row[2] } : null;
  }
  function restore(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const id of ids) {
      if (!Object.prototype.hasOwnProperty.call(raw, id)) continue;
      const item = raw[id];
      if (!item || typeof item !== 'object' || !Number.isSafeInteger(item.attempts) || item.attempts < 1) continue;
      const response = answer(id, item.choiceId);
      if (response) out[id] = { choiceId: item.choiceId, correct: response.correct, attempts: item.attempts };
    }
    return out;
  }
  function record(progress, id, choiceId) {
    const out = restore(progress);
    const response = answer(id, choiceId);
    if (response) out[id] = { choiceId, correct: response.correct, attempts: Math.min((out[id]?.attempts || 0) + 1, Number.MAX_SAFE_INTEGER) };
    return out;
  }
  // Unlock from completed actions, not from a selection, draw, or unfinished roll.
  // The hypothetical winter hunt question also works if there was no legal hunt.
  function available({ state, phase } = {}) {
    if (!state) return [];
    const log = Array.isArray(state.log) ? state.log : [];
    const happened = (season, kind) => log.some(row => row?.season === season && row.kind === kind);
    const ended = season => Number.isInteger(state.season) && state.season >= season && (
      state.season > season || phase?.kind === 'seasonEnd' || phase?.kind === 'complete' ||
      (!phase && Number.isInteger(state.seasons?.[season]?.end))
    );
    const ready = {
      hunt: happened(0, 'hunt') || ended(0),
      migration: happened(1, 'migration'),
      event: happened(2, 'card'),
      comparison: ended(3)
    };
    return ids.filter(id => ready[id]);
  }
  return Object.freeze({ ids, get, answer, restore, record, available });
});
