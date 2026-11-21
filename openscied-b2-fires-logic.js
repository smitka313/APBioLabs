/* Pure logic for the "Fires: Peat, Decomposition and Earth's Tilt" companion (OpenSciEd Unit B.2, Lessons 3 and 5).
   No DOM here, so Node can test it (tests/openscied-b2-fires-logic.test.js) and the scene scripts and the page reuse it.

   Sources: OpenSciEd Unit B.2 Teacher Edition, Lesson 3 (Decomposition Investigation, Matter Energy Cards) and Lesson 5 (Tilt
   Investigation, directional hypothesis), and their student handouts. EVERYTHING NUMERICAL HERE IS SIMULATED. The numbers come from
   small models written for this site, not from measurements of real yeast or real Elodea.

   ASSUMPTIONS (stated once, repeated on the page under "What this simulation models")
   Yeast foam (Lesson 3)
   - Yeast respire the sugar in the water and make carbon dioxide gas, which makes foam. Foam height stands in for carbon dioxide made.
   - Water temperature sets how fast the yeast work. Relative rate: 5 C 0.1, 18 C 0.35, 27 C 1.0, 35 C 1.5, 43 C 1.7, 55 C 0.2 and falling
     (55 C kills most yeast). Foam appears after a short lag (3 minutes at 27 C, longer when it is cold) and then rises.
   - Typical foam at 20 minutes (nominal, mm): 5 C 3, 18 C about 10, 27 C 38, 35 C 50, 43 C 62, 55 C 2.5 after a small early burst.
     At 43 C the foam settles a little late in the run. Real foam depends on yeast brand, freshness, sugar, beaker shape and how it was stirred.
   - Each beaker gets its own seeded size factor (+/- 8 percent), so two beakers at the same temperature differ a little, and each reading has
     whole-millimeter rounding and +/- 1 mm noise. A reading never falls by more than 3 mm from the one before, and is never negative.
   Tilt and BTB (Lesson 5)
   - Light reaching the plant is I = cos(angle): 1.00 direct (0 degrees), 0.71 at 45 degrees, 0.34 at 70 degrees, 0 under foil.
   - Over the simulated night the plant respires (R = 0.30, constant, it makes carbon dioxide) and photosynthesizes (P = 1.1 I / (0.35 + I),
     it uses carbon dioxide). Net change in carbon dioxide = b (R - P). b is the plant size: a seeded student factor (+/- 8 percent) times a
     small tube-to-tube factor (+/- 5 percent), so tubes with the same setting differ a little.
   - BTB reading is a number from 1 to 6 (1 deep blue, 2 blue, 3 blue-green, 4 green, 5 yellow-green, 6 yellow). The tubes start blue (2.0).
     Less carbon dioxide moves the reading toward 1 (net -0.6 reaches 1.0), more moves it toward 6 (net +0.3 reaches 5.9). BTB really changes color over a
     narrow range of carbon dioxide, so this is simplified. Real BTB color also depends on its starting pH and the water.
   - Starch (optional iodine test): starch index = max(0, -net), the sugar left over after respiration. It is shown as a stain from none to dark.
   Cards (Lesson 3): cellular respiration takes in sugar and oxygen and gives out carbon dioxide, water and energy (energy is transferred,
   not matter, so its card looks different). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.B2FiresLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const num = x => typeof x === 'number' && isFinite(x);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const round1 = x => Math.round(x * 10) / 10;
  function hash32(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Same generator as Lab.rng (mulberry32), so Node tests and the browser agree for the same seed.
  function makeRng(seed) {
    let s = (num(seed) ? seed : 0) >>> 0;
    function uniform() { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    function normal() { let u = 0; while (u === 0) u = uniform(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform()); }
    return { uniform, normal };
  }
  const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  /* ---------- yeast foam (Lesson 3) ---------- */
  const TEMPS = [5, 18, 27, 35, 43, 55];
  const TIMES = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  const END_MIN = 20;
  const RATE = { 5: 0.1, 18: 0.35, 27: 1.0, 35: 1.5, 43: 1.7, 55: 0.2 };
  const TARGET20 = { 5: 3, 18: 10.5, 27: 38, 35: 50, 43: 62, 55: 2.5 };
  const DEFAULT_TEMPS = [18, 27, 43];
  const TEMP_NAMES = { 5: 'Ice bath', 18: 'Cold', 27: 'Room', 35: 'Warm-ish', 43: 'Warm', 55: 'Very hot' };
  const BEAKER_NAMES = ['Beaker 1', 'Beaker 2', 'Beaker 3'];
  const SIM_MIN_MS = 4000; // one simulated minute lasts 4 seconds on screen (a 20 minute test takes about 80 seconds)
  function normalizeTemp(t) {
    const x = Number(t);
    if (!num(x)) return 27;
    return TEMPS.reduce((best, c) => Math.abs(c - x) < Math.abs(best - x) ? c : best, TEMPS[0]);
  }
  function normalizeTemps(list) {
    const l = Array.isArray(list) ? list : [];
    return [0, 1, 2].map(i => l[i] == null ? DEFAULT_TEMPS[i] : normalizeTemp(l[i]));
  }
  // Un-normalized shape of the foam over time (before it is scaled to the 20-minute target), 0 at time 0.
  function shape(temp, t) {
    t = clamp(t, 0, END_MIN);
    if (temp === 55) return (1 - Math.exp(-t / 2.5)) * (1 - 0.75 * smooth((t - 5) / 15));
    const m = RATE[temp], lag = Math.min(3 / m, 9), k = 0.05 * m;
    if (t <= lag) return 0;
    const collapse = temp === 43 ? 1 - 0.12 * smooth((t - 14) / 6) : 1;
    return (1 - Math.exp(-k * (t - lag))) * collapse;
  }
  // Foam height in mm with no student variation and no noise: the nominal curve.
  function nominalFoam(temp, t) {
    temp = normalizeTemp(temp);
    const end = shape(temp, END_MIN);
    return end > 0 ? TARGET20[temp] * shape(temp, t) / end : 0;
  }
  // The eleven readings (0, 2, ... 20 min) for one beaker: whole mm, never negative, never falling by more than 3 mm.
  function foamSeries(seed, beaker, temp) {
    temp = normalizeTemp(temp);
    const idx = clamp(Math.round(Number(beaker)) || 0, 0, 2);
    const rng = makeRng(hash32(String(num(seed) ? seed >>> 0 : 0) + ':foam:' + idx));
    const factor = 1 + (rng.uniform() * 2 - 1) * 0.08;
    const out = [];
    TIMES.forEach(function (t, i) {
      const noise = clamp(Math.round(rng.normal() * 0.6), -1, 1);
      let v = i === 0 ? 0 : Math.max(0, Math.round(nominalFoam(temp, t) * factor + noise));
      if (i > 0) v = Math.max(v, out[i - 1] - (temp === 43 || temp === 55 ? 3 : 1));
      out.push(v);
    });
    return out;
  }
  // Foam height between readings (straight line), for drawing. Minutes are clamped to 0..20.
  function foamAt(series, minutes) {
    if (!Array.isArray(series) || !series.length) return 0;
    const m = clamp(num(minutes) ? minutes : 0, 0, END_MIN) / 2, i = Math.min(Math.floor(m), series.length - 1), j = Math.min(i + 1, series.length - 1), f = m - i;
    return series[i] + (series[j] - series[i]) * f;
  }
  // Carbon dioxide made, in relative units: the foam is carbon dioxide gas, so one unit per 10 mm of foam.
  const co2Made = h => num(h) ? round1(Math.max(0, h) / 10) : 0;
  function minutesElapsed(startedAt, now, skipped) {
    if (skipped) return END_MIN;
    if (!num(startedAt) || !num(now)) return 0;
    return clamp((now - startedAt) / SIM_MIN_MS, 0, END_MIN);
  }
  // The recorded rows of a saved yeast test: [{ t, h:[b1,b2,b3] }] from the seed, temps and the list of recorded minutes. Everything is recomputed from the seed.
  function foamRows(st) {
    if (!st || typeof st !== 'object' || !num(st.seed)) return [];
    const temps = normalizeTemps(st.temps), series = temps.map((t, i) => foamSeries(st.seed, i, t));
    const rec = Array.isArray(st.recorded) ? st.recorded.filter(t => TIMES.includes(t)) : [];
    return TIMES.filter(t => rec.includes(t)).map(t => ({ t, h: series.map(s => s[TIMES.indexOf(t)]) }));
  }
  function lastRow(rows) { return rows && rows.length ? rows[rows.length - 1] : null; }

  /* ---------- Matter Energy cards (Lesson 3) ---------- */
  const CARDS = [
    { id: 'sugar', label: 'Sugar', zone: 'in', note: 'matter',
      right: 'Yes. Sugar is the food. It holds matter (carbon, hydrogen, oxygen) and energy that the decomposer takes in.',
      wrong: 'Try again. Sugar is the food that goes in. It is made by plants and used up by the decomposer.' },
    { id: 'oxygen', label: 'Oxygen', zone: 'in', note: 'matter',
      right: 'Yes. Cells use oxygen to release the energy in sugar, so oxygen goes in.',
      wrong: 'Try again. The decomposer takes oxygen in from the air or water to use the sugar.' },
    { id: 'carbon-dioxide', label: 'Carbon dioxide', zone: 'out', note: 'matter',
      right: 'Yes. The carbon from the sugar leaves as carbon dioxide, the gas in the yeast foam.',
      wrong: 'Try again. Carbon dioxide is a waste gas the decomposer gives off. It comes out.' },
    { id: 'water', label: 'Water', zone: 'out', note: 'matter',
      right: 'Yes. Hydrogen and oxygen from the sugar come out as water.',
      wrong: 'Try again. This reaction makes water and gives it off, so it comes out.' },
    { id: 'energy', label: 'Energy', zone: 'out', note: 'energy',
      right: 'Yes. Energy from the sugar is transferred out: some powers the decomposer and some leaves as heat. Energy is not matter, so its card looks different.',
      wrong: 'Try again. The energy stored in sugar is released and transferred out, to the decomposer and as heat.' }
  ];
  const REACTION = 'sugar + oxygen → carbon dioxide + water + energy transferred';
  // placed = { cardId: 'in' | 'out' }. Returns per-card results and an overall status.
  function checkCards(placed) {
    const p = placed && typeof placed === 'object' ? placed : {};
    const results = {};
    let right = 0, put = 0;
    CARDS.forEach(function (c) {
      const z = p[c.id] === 'in' || p[c.id] === 'out' ? p[c.id] : null;
      if (!z) { results[c.id] = { zone: null, correct: null, message: '' }; return; }
      put++;
      const ok = z === c.zone; if (ok) right++;
      results[c.id] = { zone: z, correct: ok, message: ok ? c.right : c.wrong };
    });
    return { results, placed: put, right, solved: right === CARDS.length, status: !put ? 'empty' : right === CARDS.length ? 'correct' : put < CARDS.length ? 'partial' : 'wrong' };
  }

  /* ---------- tap and dropdown rows ---------- */
  // Every row: { correct:[values that are right], why:{ value: text } }. "poll" rows have no correct answer.
  const PICKS = {
    'plan-iv': { correct: ['temp'], why: {
      temp: 'Yes. The lesson changes the water temperature and keeps everything else the same.',
      sugar: 'Try again. Why not: the lesson gives each beaker the same sugar. Temperature is what changes.',
      yeast: 'Try again. Why not: each beaker gets the same yeast. Temperature is what changes.' } },
    'plan-dv': { correct: ['foam'], why: {
      foam: 'Yes. The foam is carbon dioxide gas, so its height shows how much sugar the yeast used.',
      color: 'Try again. Why not: the water color does not show how much carbon dioxide was made.',
      smell: 'Try again. Why not: smell is hard to measure. Foam height can be measured in mm.' } },
    'pred-fastest': { correct: [], why: {
      cold: 'Thank you. You will test this in the next part.',
      room: 'Thank you. You will test this in the next part.',
      warm: 'Thank you. You will test this in the next part.' } },
    'cards-rate-hot': { correct: ['faster'], why: {
      faster: 'Yes. Warmer yeast work faster, so more sugar is used up and more carbon dioxide is made.',
      slower: 'Try again. Why not: your warm beaker made foam faster than the cold one.',
      same: 'Try again. Why not: the three beakers did not make the same amount of foam.' } },
    'cards-rate-peat': { correct: ['slower'], why: {
      slower: 'Yes. Cold, low-oxygen peat slows the reaction, so carbon and energy stay in the peat. That makes a carbon sink.',
      faster: 'Try again. Why not: cold slows the reaction down.',
      same: 'Try again. Why not: temperature changes the rate, and so does oxygen.' } },
    'sense-energy': { correct: ['faster'], why: {
      faster: 'Yes. At higher temperatures, energy was transferred from sugar to the yeast faster.',
      slower: 'Try again. Why not: the warm beaker used its sugar up faster, so energy moved faster.',
      same: 'Try again. Why not: the beakers made different amounts of foam, so energy did not move at the same speed.' } },
    'sense-past': { correct: ['cold'], why: {
      cold: 'Yes. The past was cold and slow: little decomposition, so the matter stayed in the peat.',
      room: 'Try again. Why not: the permafrost was frozen. The cold beaker is the best match.',
      warm: 'Try again. Why not: warm yeast decompose fast. The frozen peat was not decomposing much.' } },
    'sense-present': { correct: ['warm', 'room'], why: {
      cold: 'Try again. Why not: the permafrost is thawing and fires are burning, so it is warmer than before.',
      room: 'Yes. It is warmer than the frozen past, so decomposition speeds up. Warm also fits.',
      warm: 'Yes. A warmer, thawing Arctic speeds up decomposition and lets fires burn.' } },
    'sense-future': { correct: ['warm'], why: {
      cold: 'Try again. Why not: the Arctic is warming, not getting colder.',
      room: 'Close. If the Arctic keeps warming, the warm beaker is the better match.',
      warm: 'Yes. With more warming, decomposition would speed up even more.' } },
    'tilt-plan-iv': { correct: ['angle'], why: {
      angle: 'Yes. Changing the angle of the light changes how much light energy reaches the plant, like a change in Earth’s tilt.',
      species: 'Try again. Why not: the lesson uses the same kind of plant in every tube.',
      size: 'Try again. Why not: the size of the tube does not change the light the plant gets.' } },
    'tilt-plan-dv': { correct: ['btb'], why: {
      btb: 'Yes. BTB changes color with carbon dioxide, so its color shows what the plant did with carbon dioxide.',
      height: 'Try again. Why not: a plant would not grow measurably in one night.',
      temp: 'Try again. Why not: temperature is something to keep the same, not what we measure.' } },
    'sense-btb-blue': { correct: ['more'], why: {
      more: 'Yes. In a blue tube the plant used up more carbon dioxide in photosynthesis than it made by respiring.',
      less: 'Try again. Why not: a tube gets bluer when carbon dioxide goes down.',
      same: 'Try again. Why not: the color changed, so carbon dioxide changed.' } },
    'sense-foil-co2': { correct: ['up'], why: {
      up: 'Yes. With no light, the plant could not use carbon dioxide, but it still made some.',
      down: 'Try again. Why not: with no light, nothing in the tube used carbon dioxide.' } },
    'sense-foil-why': { correct: ['respire'], why: {
      respire: 'Yes. Plants respire day and night, so they keep making carbon dioxide.',
      photo: 'Try again. Why not: photosynthesis needs light, and the foil blocked it.',
      nothing: 'Try again. Why not: living plants always respire.' } },
    'sense-lamp': { correct: ['sun'], why: {
      sun: 'Yes. The lamp stands in for the Sun, the source of the energy.',
      plant: 'Try again. Why not: the plant is in the tube. The lamp gives the light.',
      peat: 'Try again. Why not: peat does not give off light.' } },
    'sense-angle': { correct: ['tilt'], why: {
      tilt: 'Yes. A different angle stands for a different tilt of Earth, and so a different amount of sunlight in the Arctic.',
      plant: 'Try again. Why not: the plant stays the same. Only the light angle changes.',
      co2: 'Try again. Why not: the air is not what changes with the lamp’s angle.' } },
    'sense-plant': { correct: ['arctic'], why: {
      arctic: 'Yes. The plant in the tube stands in for the Arctic plants that stored energy and matter in sugar.',
      sun: 'Try again. Why not: the Sun is the lamp.',
      decomp: 'Try again. Why not: decomposers are the yeast from Part A.' } },
    'sense-light-energy': { correct: ['stored'], why: {
      stored: 'Yes. Light energy is captured and stored as chemical energy in sugar. Some is lost as heat.',
      vanish: 'Try again. Why not: energy is never used up. It changes form.',
      co2: 'Try again. Why not: carbon dioxide is matter. The light energy goes into the sugar.' } },
    'sense-most': { correct: ['direct'], why: {
      direct: 'Yes. When the most sunlight reached the Arctic plants, they did the most photosynthesis.',
      tilt45: 'Try again. Why not: look at your table. Which tube was the bluest?',
      tilt70: 'Try again. Why not: look at your table. Which tube was the bluest?',
      foil: 'Try again. Why not: with no light there is no photosynthesis.' } },
    'sense-least': { correct: ['foil', 'tilt70'], why: {
      direct: 'Try again. Why not: direct light gave the most photosynthesis.',
      tilt45: 'Try again. Why not: the 45 degree tube made more sugar than the weaker light settings.',
      tilt70: 'Yes. Less sunlight means less photosynthesis.',
      foil: 'Yes. Less sunlight means less photosynthesis, and none means none.' } },
    'sense-starch': { correct: ['starch'], why: {
      starch: 'Yes. Extra sugar is stored in the plant as starch, and more light means more to store.',
      co2: 'Try again. Why not: sugar made in excess is stored, not turned back into carbon dioxide.',
      vanish: 'Try again. Why not: matter does not disappear. The sugar is stored.' } },
    'peat-warm': { correct: ['faster'], why: {
      faster: 'Yes. A warmer Arctic speeds up decomposition, so more carbon dioxide goes into the air.',
      slower: 'Try again. Why not: warmer decomposers work faster, as in your warm beaker.',
      same: 'Try again. Why not: your yeast beakers showed that temperature changes the rate.' } }
  };
  function checkPick(id, value) {
    const row = PICKS[id];
    if (!row) return { status: 'unknown', message: '' };
    if (!value) return { status: 'empty', message: '' };
    const message = row.why[value];
    if (message == null) return { status: 'wrong', message: 'Choose one of the answers shown.' };
    if (!row.correct.length) return { status: 'poll', message };
    return { status: row.correct.includes(value) ? 'correct' : 'wrong', message };
  }
  // Two dropdowns in one sentence: "More/Less sugar was converted to carbon dioxide at higher/lower temperatures."
  function checkSugarSentence(amount, temp) {
    if (!amount || !temp) return { status: 'empty', message: '' };
    const ok = (amount === 'more' && temp === 'higher') || (amount === 'less' && temp === 'lower');
    return ok ? { status: 'correct', message: 'Yes. Warmer beakers made more foam, so more sugar was turned into carbon dioxide. Cooler beakers made less.' }
      : { status: 'wrong', message: 'Try again. Why not: look at your foam table. The warmer the water, the more foam, and the more sugar was used up.' };
  }
  // Directional hypothesis builder: "If the plant gets [more/less/the same] light energy, then it takes in [more/less/the same] carbon dioxide, because [reason]."
  const HYP_REASONS = {
    energy: 'light energy drives photosynthesis, which builds sugar from carbon dioxide and water',
    warm: 'light only warms the water',
    air: 'plants make their own light' };
  function checkHypothesis(light, co2, why) {
    if (!light || !co2) return { status: 'empty', message: '', direction: false, reason: false, variables: false };
    const direction = light === 'more' && co2 === 'more' || light === 'less' && co2 === 'less';
    const reason = why === 'energy';
    const status = direction && reason ? 'correct' : direction ? 'partial' : 'wrong';
    const message = direction && reason ? 'Yes. This is a directional hypothesis: it names what you change (light energy), what you measure (carbon dioxide taken in), and which way it goes.'
      : direction ? 'The direction fits the lesson. Now pick the reason: it is about how light energy is used.'
      : light === 'same' || co2 === 'same' ? 'A directional hypothesis says which way: more or less. Pick more or less.'
      : 'Think about the Sun. More light energy gives plants more energy for photosynthesis, so they take in more carbon dioxide, not less.';
    return { status, message, direction, reason, variables: true };
  }

  /* ---------- tilt and BTB (Lesson 5) ---------- */
  const LIGHTS = {
    direct: { label: 'Direct light (0°)', short: 'Direct (0°)', angle: 0, foil: false },
    tilt45: { label: 'Tilted light (45°)', short: 'Tilted (45°)', angle: 45, foil: false },
    tilt70: { label: 'Strongly tilted light (70°)', short: 'Strongly tilted (70°)', angle: 70, foil: false },
    foil: { label: 'Covered in foil (no light)', short: 'Foil (no light)', angle: 0, foil: true }
  };
  const LIGHT_IDS = Object.keys(LIGHTS);
  const TUBE_IDS = ['A', 'B', 'C'];
  const SUGGESTED_SETUP = ['direct', 'tilt45', 'foil'];
  const RESP = 0.30;
  const NIGHT_MS = 60000; // the simulated night lasts one minute on screen
  const NIGHT_HOURS = 12;
  const lightIntensity = id => !LIGHTS[id] || LIGHTS[id].foil ? 0 : Math.cos(LIGHTS[id].angle * Math.PI / 180);
  const photosynthesis = I => { const x = num(I) ? Math.max(0, I) : 0; return 1.1 * x / (0.35 + x); };
  const BTB_LABELS = ['deep blue', 'blue', 'blue-green', 'green', 'yellow-green', 'yellow'];
  const BTB_RGB = [[22, 56, 140], [47, 107, 206], [38, 156, 150], [95, 174, 79], [184, 200, 60], [242, 212, 34]];
  const BTB_START = 2;
  // BTB reading for a net change in carbon dioxide: less CO2 (net below 0) goes toward 1, more goes toward 6. One decimal, 1.0 to 6.0.
  function btbPosition(net) {
    const n = num(net) ? net : 0;
    const p = n <= 0 ? BTB_START + n / 0.6 : BTB_START + n * 13;
    return round1(clamp(p, 1, 6));
  }
  const btbLabel = p => BTB_LABELS[clamp(Math.round(num(p) ? p : BTB_START), 1, 6) - 1];
  function btbColor(p) {
    const x = clamp(num(p) ? p : BTB_START, 1, 6) - 1, i = Math.min(4, Math.floor(x)), f = x - i, a = BTB_RGB[i], b = BTB_RGB[i + 1];
    return [0, 1, 2].map(k => Math.round(a[k] + (b[k] - a[k]) * f));
  }
  // The BTB reading part-way through the night (progress 0..1): the same curve for every tube, from the start to the final reading.
  const btbAt = (final, progress) => round1(BTB_START + (clamp(num(final) ? final : BTB_START, 1, 6) - BTB_START) * smooth(num(progress) ? progress : 0));
  function plantFactor(seed) { return 1 + (makeRng(hash32(String(num(seed) ? seed >>> 0 : 0) + ':plant')).uniform() * 2 - 1) * 0.08; }
  function tubeFactor(seed, tube) { return plantFactor(seed) * (1 + (makeRng(hash32(String(num(seed) ? seed >>> 0 : 0) + ':tube:' + tube)).uniform() * 2 - 1) * 0.05); }
  const normalizeLight = id => LIGHTS[id] ? id : 'direct';
  // The result for one tube: light reaching the plant, photosynthesis, net change in carbon dioxide, BTB reading, starch.
  function tubeResult(seed, tube, light) {
    const id = normalizeLight(light), I = lightIntensity(id), P = photosynthesis(I), b = tubeFactor(seed, tube);
    const net = b * (RESP - P), pos = btbPosition(net), starch = Math.max(0, -net);
    return { tube: TUBE_IDS[tube] || String(tube), light: id, intensity: Math.round(I * 100) / 100, plantSize: Math.round(b * 1000) / 1000,
      respiration: Math.round(b * RESP * 1000) / 1000, photosynthesis: Math.round(b * P * 1000) / 1000, net: Math.round(net * 1000) / 1000,
      btb: pos, btbLabel: btbLabel(pos), starch: Math.round(starch * 1000) / 1000, starchLabel: starchLabel(starch) };
  }
  function starchLabel(s) { return !(s >= 0.02) ? 'none' : s < 0.3 ? 'light' : s < 0.45 ? 'medium' : 'dark'; }
  const starchDarkness = s => clamp((num(s) ? s : 0) / 0.6, 0, 1);
  function tiltResults(seed, settings) {
    const l = Array.isArray(settings) ? settings : [];
    return [0, 1, 2].map(i => tubeResult(seed, i, l[i]));
  }
  function nightProgress(startedAt, now, skipped) {
    if (skipped) return 1;
    if (!num(startedAt) || !num(now)) return 0;
    return clamp((now - startedAt) / NIGHT_MS, 0, 1);
  }
  // Does what the student set up make a fair, informative test? Needs a foil tube and at least two different lit settings (the lesson's idea).
  function setupCheck(settings) {
    const s = Array.isArray(settings) ? settings : [];
    if (s.length < 3 || s.slice(0, 3).some(x => !LIGHTS[x])) return { ok: false, complete: false, message: 'Choose a light setting for each tube.' };
    const lit = s.filter(x => !LIGHTS[x].foil), kinds = new Set(s);
    if (kinds.size < 2) return { ok: true, complete: true, message: 'All three tubes have the same setting. That is a repeat, which is fine, but you cannot compare settings.' };
    if (!s.includes('foil')) return { ok: true, complete: true, message: 'There is no foil tube. A foil tube is the comparison with no light.' };
    if (new Set(lit).size < 2) return { ok: true, complete: true, message: 'Only one lit setting. Try two different angles to see the effect of tilt.' };
    return { ok: true, complete: true, message: 'Good plan: different angles and a no-light tube to compare.' };
  }

  /* ---------- claim, evidence and reasoning self-check (Back to the peat) ---------- */
  // 0 claim chosen, 1 evidence from my data, 2 reading evidence, 3 reasoning chosen, 4 caveat.
  function claimLevel(flags) {
    const f = [0, 1, 2, 3, 4].map(i => !!(flags && flags[i]));
    const n = f.filter(Boolean).length;
    if (!n) return 'none';
    if (f.every(Boolean)) return 'organized';
    if (f[0] && f[1] && n >= 3) return 'linked';
    return 'foundational';
  }
  /* Does the student's own data back up each evidence statement? true / false, or null when there is not enough data to say. A self-check of
     the student's reading of their own data, not a grade.
       warmMost:   the warmest beaker has the most foam at the last reading (needs a reading and two different temperatures)
       coldLeast:  the coldest beaker has the least foam at the last reading
       directBluest: a tube with direct light has the lowest (bluest) BTB reading, ties count
       foilYellow: a foil tube has the highest (yellowest) BTB reading
       moreLightBluer: among lit tubes with different angles, a tube with more light is never less blue than one with less light */
  function evidenceChecks(foamState, tiltState) {
    const out = { warmMost: null, coldLeast: null, directBluest: null, foilYellow: null, moreLightBluer: null };
    const rows = foamRows(foamState), last = lastRow(rows);
    if (last && foamState) {
      const temps = normalizeTemps(foamState.temps), h = last.h;
      const hi = Math.max.apply(null, temps), lo = Math.min.apply(null, temps);
      if (hi !== lo) {
        const top = Math.max.apply(null, h), bottom = Math.min.apply(null, h);
        out.warmMost = temps.every((t, i) => t !== hi || h[i] === top);
        out.coldLeast = temps.every((t, i) => t !== lo || h[i] === bottom);
      }
    }
    if (tiltState && tiltState.recorded && num(tiltState.seed)) {
      const res = tiltResults(tiltState.seed, tiltState.settings), pos = res.map(r => r.btb);
      const min = Math.min.apply(null, pos), max = Math.max.apply(null, pos);
      if (res.some(r => r.light === 'direct') && min !== max) out.directBluest = res.every(r => r.light !== 'direct' || r.btb === min);
      if (res.some(r => r.light === 'foil') && min !== max) out.foilYellow = res.every(r => r.light !== 'foil' || r.btb === max);
      const lit = res.filter(r => r.light !== 'foil');
      if (new Set(lit.map(r => r.intensity)).size > 1) out.moreLightBluer = lit.every(a => lit.every(b => a.intensity <= b.intensity || a.btb <= b.btb));
    }
    return out;
  }
  // The beaker or tube behind a check, for the note shown next to the student's pick.
  function evidenceDetail(foamState, tiltState) {
    const d = {}, rows = foamRows(foamState), last = lastRow(rows);
    if (last && foamState) {
      const temps = normalizeTemps(foamState.temps), top = Math.max.apply(null, last.h), bottom = Math.min.apply(null, last.h);
      d.mostBeaker = BEAKER_NAMES[last.h.indexOf(top)] + ' (' + temps[last.h.indexOf(top)] + ' °C)';
      d.leastBeaker = BEAKER_NAMES[last.h.indexOf(bottom)] + ' (' + temps[last.h.indexOf(bottom)] + ' °C)';
      d.minute = last.t;
    }
    if (tiltState && tiltState.recorded && num(tiltState.seed)) {
      const res = tiltResults(tiltState.seed, tiltState.settings), pos = res.map(r => r.btb);
      const b = res[pos.indexOf(Math.min.apply(null, pos))], y = res[pos.indexOf(Math.max.apply(null, pos))];
      d.bluestTube = 'Tube ' + b.tube + ' (' + LIGHTS[b.light].short + ')'; d.yellowestTube = 'Tube ' + y.tube + ' (' + LIGHTS[y.light].short + ')';
    }
    return d;
  }

  return { num, clamp, hash32, makeRng, TEMPS, TIMES, END_MIN, RATE, TARGET20, DEFAULT_TEMPS, TEMP_NAMES, BEAKER_NAMES, SIM_MIN_MS,
    normalizeTemp, normalizeTemps, nominalFoam, foamSeries, foamAt, co2Made, minutesElapsed, foamRows, lastRow,
    CARDS, REACTION, checkCards, PICKS, checkPick, checkSugarSentence, HYP_REASONS, checkHypothesis,
    LIGHTS, LIGHT_IDS, TUBE_IDS, SUGGESTED_SETUP, RESP, NIGHT_MS, NIGHT_HOURS, lightIntensity, photosynthesis, BTB_LABELS, BTB_RGB, BTB_START,
    btbPosition, btbLabel, btbColor, btbAt, plantFactor, tubeFactor, tubeResult, tiltResults, starchLabel, starchDarkness, nightProgress, setupCheck,
    claimLevel, evidenceChecks, evidenceDetail };
});
