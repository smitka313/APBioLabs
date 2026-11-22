/* Pure logic for "Burning Fuels: What Burns and Why" (OpenSciEd Unit B.2, Lesson 2 "What is peat and why does it burn so much?").
   No DOM here, so Node can test it (tests/openscied-b2-burn-logic.test.js) and the scene and the page reuse it.

   Source: OpenSciEd Unit B.2 Teacher Edition, Lesson 2 (the teacher's Burning Fuels demonstration: peat and other dry wildfire fuels burned in
   1-quart glass containers with blue BTB solution, optional infrared thermometer and gram scale; students record BTB color, temperature and mass
   before and after, and other observations) and its Matter-Energy chart. EVERYTHING NUMERICAL HERE IS SIMULATED by a small model written for this
   site, not measured from real fuels. The page replaces no real demonstration and none of its safety steps.

   ASSUMPTIONS (stated once; repeated on the page under "What this simulation models")
   - Five fuels, each a 10 g sample. Nominal values (seconds in the flame, then per fuel):
       fuel      ignites after   burns for   mass lost   heat (kJ per g burned)   carbon dioxide (relative, per g burned)
       grass          4 s          20 s        93 %            15                    0.44
       leaves         6 s          30 s        90 %            16                    0.45
       wood          14 s          90 s        97 %            18                    0.50
       charcoal      28 s         150 s        88 %            29                    0.90
       peat          45 s         260 s        78 %            20                    0.50
     Peat is slow to catch, then smolders (smoke and a glowing ember front, little flame) and burns longest. Peat keeps more ash because it has
     mineral content. Charcoal is mostly carbon, so it gives the most heat per gram and the most carbon dioxide per gram, and glows with little flame
     and little smoke. These are teaching values chosen to look like class data.
   - Variation. Each student gets a seeded factor and each burned sample a smaller one: heat and mass lost about 8 percent in all (5 + 3), ignition
     time about 15 percent (8 + 7), burn time about 10 percent. A second sample of the same fuel therefore differs a little. The scale reads to 0.1 g
     with +/- 0.1 g noise on both weighings. The infrared thermometer reads to 1 degree C with +/- 1 degree noise on both readings. Starting temperature 22 C.
   - Temperature rise of the flask above the flame: energy released (kJ per g burned x g burned) x 0.45 / 8 kJ per degree, kept between 4 and 22 C.
     (0.45 is the share of the heat that reaches the flask; 8 kJ per degree is the heat capacity of the flask and BTB solution.)
   - Carbon dioxide made = coefficient x g burned. How much dissolves into the BTB grows with the time the flask sits in the gas: fraction dissolved =
     0.35 + 0.45 (1 - exp(-burn time / 80 s)). BTB reading (1 deep blue, 2 blue, 3 blue-green, 4 green, 5 yellow-green, 6 yellow), starting at 2:
     2 + 4 (1 - exp(-dissolved / 3.5)) + noise of +/- 0.3, kept from 2 to 6 (burning only adds carbon dioxide, so the BTB never gets bluer). No fuel
     reaches full yellow, and some only turn green, as the Teacher Edition says. Real BTB color also depends on its starting pH.
   - Never impossible: mass after is below mass before and above zero, the flask is not cooler after than before, BTB 2 to 6, times positive. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.B2BurnLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const num = x => typeof x === 'number' && isFinite(x);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const round1 = x => Math.round(x * 10) / 10;
  const smooth = x => { x = clamp(num(x) ? x : 0, 0, 1); return x * x * (3 - 2 * x); };
  function hash32(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Same generator as Lab.rng (mulberry32), so Node tests and the browser agree for the same seed.
  function makeRng(seed) {
    let s = (num(seed) ? seed : 0) >>> 0;
    function uniform() { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    return { uniform };
  }
  const seedOf = seed => String(num(seed) ? seed >>> 0 : 0);
  const spread = (r, amount) => 1 + (r.uniform() * 2 - 1) * amount;

  /* ---------- the five fuels ---------- */
  // flame, smoke and glow (0 to 1) set how the picture is drawn; the table of nominal values is above.
  const FUELS = [
    { id: 'grass', label: 'Dried grass', ignite: 4, burn: 20, loss: 0.93, kj: 15, co2: 0.44, flame: 1.0, smoke: 0.2, glow: 0.1, tone: 'a quick, bright flame' },
    { id: 'leaves', label: 'Dried leaves', ignite: 6, burn: 30, loss: 0.90, kj: 16, co2: 0.45, flame: 0.85, smoke: 0.4, glow: 0.2, tone: 'a quick flame with some smoke' },
    { id: 'wood', label: 'Wood chips', ignite: 14, burn: 90, loss: 0.97, kj: 18, co2: 0.50, flame: 0.75, smoke: 0.3, glow: 0.5, tone: 'a steady flame' },
    { id: 'charcoal', label: 'Charcoal', ignite: 28, burn: 150, loss: 0.88, kj: 29, co2: 0.90, flame: 0.12, smoke: 0.05, glow: 1.0, tone: 'a red-orange glow, little flame, little smoke' },
    { id: 'peat', label: 'Peat', ignite: 45, burn: 260, loss: 0.78, kj: 20, co2: 0.50, flame: 0.25, smoke: 1.0, glow: 0.8, tone: 'lots of smoke and a creeping glowing ember' }
  ];
  const FUEL_IDS = FUELS.map(f => f.id);
  const FUEL = Object.fromEntries(FUELS.map(f => [f.id, f]));
  const SHORT = { grass: 'Grass', leaves: 'Leaves', wood: 'Wood', charcoal: 'Charcoal', peat: 'Peat' };   // chart axis names (short, so they never break inside a word)
  const fuelLabel = id => FUEL[id] ? FUEL[id].label : '';
  const normalizeFuel = id => FUEL[id] ? id : 'grass';
  const SAMPLE_MASS = 10;
  const START_TEMP = 22;
  const START_BTB = 2;
  const MAX_SAMPLES = 3;          // samples of one fuel a student can burn
  const TAIL = 12;                // seconds the thermometer and BTB keep settling after the fuel is out
  const RATE = 6;                 // simulated seconds per real second on screen (peat takes about a minute, grass a few seconds)
  const FLASK_KJ_PER_C = 8, FLASK_SHARE = 0.45;

  /* ---------- BTB ---------- */
  const BTB_LABELS = ['deep blue', 'blue', 'blue-green', 'green', 'yellow-green', 'yellow'];
  const BTB_RGB = [[22, 56, 140], [47, 107, 206], [38, 156, 150], [95, 174, 79], [184, 200, 60], [242, 212, 34]];
  const btbLabel = p => BTB_LABELS[clamp(Math.round(num(p) ? p : START_BTB), 1, 6) - 1];
  function btbColor(p) {
    const x = clamp(num(p) ? p : START_BTB, 1, 6) - 1, i = Math.min(4, Math.floor(x)), f = x - i, a = BTB_RGB[i], b = BTB_RGB[i + 1];
    return [0, 1, 2].map(k => Math.round(a[k] + (b[k] - a[k]) * f));
  }
  const btbText = p => btbLabel(p) + ' (' + (num(p) ? p : START_BTB).toFixed(1) + ')';
  const dissolvedFraction = burnS => 0.35 + 0.45 * (1 - Math.exp(-Math.max(0, num(burnS) ? burnS : 0) / 80));
  const btbFromDissolved = d => START_BTB + 4 * (1 - Math.exp(-Math.max(0, num(d) ? d : 0) / 3.5));

  /* ---------- one burned sample ---------- */
  // The numbers for sample n (1, 2, 3) of a fuel: always the same for the same seed, fuel and n.
  function burnResult(seed, fuelId, n) {
    const id = normalizeFuel(fuelId), f = FUEL[id], k = clamp(Math.round(num(n) ? n : 1), 1, MAX_SAMPLES);
    const stu = makeRng(hash32(seedOf(seed) + ':student')), smp = makeRng(hash32(seedOf(seed) + ':' + id + ':' + k));
    const sHeat = spread(stu, 0.05), sLoss = spread(stu, 0.05), sIgn = spread(stu, 0.08);
    const heatF = sHeat * spread(smp, 0.03), lossF = sLoss * spread(smp, 0.03), ignF = sIgn * spread(smp, 0.07), burnF = spread(smp, 0.10);
    const lossFrac = clamp(f.loss * lossF, 0.05, 0.99);
    const burnedG = SAMPLE_MASS * lossFrac;                                  // true grams that burned away
    const igniteS = Math.max(1, Math.round(f.ignite * ignF)), burnS = Math.max(1, Math.round(f.burn * burnF));
    const kjPerG = round1(f.kj * heatF), energyKj = kjPerG * burnedG;
    const dT = round1(clamp(FLASK_SHARE * energyKj / FLASK_KJ_PER_C, 4, 22));
    const co2Made = round1(f.co2 * burnedG * 10) / 10, dissolved = co2Made * dissolvedFraction(burnS);
    const noise = () => { const u = smp.uniform(); return u < 0.2 ? -1 : u < 0.8 ? 0 : 1; };
    const tempBefore = START_TEMP + noise(), tempAfter = Math.max(tempBefore, Math.round(START_TEMP + dT) + noise());
    const scale = () => { const u = smp.uniform(); return u < 0.25 ? -0.1 : u < 0.5 ? 0.1 : 0; };
    const massBefore = round1(SAMPLE_MASS + scale());
    const massAfter = round1(Math.min(massBefore - 0.1, Math.max(0.1, SAMPLE_MASS * (1 - lossFrac) + scale())));
    const btbAfter = round1(clamp(btbFromDissolved(dissolved) + (smp.uniform() * 2 - 1) * 0.3, START_BTB, 6));
    return { fuel: id, n: k, label: f.label, igniteS, burnS, runS: igniteS + burnS + TAIL, massBefore, massAfter, massLost: round1(massBefore - massAfter),
      burnedG: Math.round(burnedG * 100) / 100, lossFrac: Math.round(lossFrac * 1000) / 1000, kjPerG, energyKj: Math.round(energyKj * 10) / 10, dT,
      tempBefore, tempAfter, tempRise: tempAfter - tempBefore, co2Made: Math.round(co2Made * 100) / 100, dissolved: Math.round(dissolved * 100) / 100,
      btbBefore: START_BTB, btbAfter, btbLabelBefore: btbLabel(START_BTB), btbLabelAfter: btbLabel(btbAfter), btbChange: round1(btbAfter - START_BTB) };
  }

  /* ---------- the timeline of a run (seconds since the sample went into the flame) ---------- */
  function simSeconds(startedAt, now, skipped, total) {
    const T = num(total) ? Math.max(0, total) : 0;
    if (skipped) return T;
    if (!num(startedAt) || !num(now)) return 0;
    return clamp((now - startedAt) / 1000 * RATE, 0, T);
  }
  const burnedFraction = p => 1 - Math.pow(1 - clamp(num(p) ? p : 0, 0, 1), 1.5);
  // What the picture and the readouts show at time t: stage, flame / smoke / glow levels (0 to 1), grams left, thermometer, BTB.
  function stateAt(res, t) {
    const f = FUEL[res.fuel], tt = clamp(num(t) ? t : 0, 0, res.runS);
    const p = clamp((tt - res.igniteS) / res.burnS, 0, 1), settle = clamp((tt - res.igniteS) / (res.burnS + TAIL), 0, 1);
    const stage = tt >= res.runS ? 'done' : tt < res.igniteS ? 'heating' : tt < res.igniteS + res.burnS ? 'burning' : 'dying';
    const burned = burnedFraction(p), life = stage === 'burning' ? 1 : stage === 'dying' ? 1 - smooth((tt - res.igniteS - res.burnS) / TAIL) : 0;
    const flame = stage === 'burning' ? f.flame * (res.fuel === 'wood' ? 1 - 0.25 * p : res.fuel === 'peat' ? 0.6 + 0.4 * (1 - p) : 1 - 0.3 * p) : stage === 'dying' ? f.flame * 0.5 * life : 0;
    const smoke = stage === 'heating' ? f.smoke * 0.35 * smooth(tt / Math.max(1, res.igniteS)) : stage === 'done' ? 0 : f.smoke * (stage === 'dying' ? 0.7 * life : 0.8 + 0.2 * (1 - p));
    const glow = stage === 'heating' ? f.glow * 0.15 * smooth(tt / Math.max(1, res.igniteS)) : stage === 'done' ? 0 : f.glow * (stage === 'dying' ? life : 0.7 + 0.3 * smooth(p * 3));
    const temp = Math.round(res.tempBefore + (res.tempAfter - res.tempBefore) * smooth(settle));
    const btb = round1(res.btbBefore + (res.btbAfter - res.btbBefore) * smooth(settle));
    return { stage, t: tt, progress: tt / res.runS, burnedFraction: burned, massTrue: SAMPLE_MASS - res.burnedG * burned, flame, smoke, glow, igniter: stage === 'heating',
      temp: stage === 'done' ? res.tempAfter : temp, btb: stage === 'done' ? res.btbAfter : btb };
  }
  // Which observation chips the picture actually showed for a fuel (used for the text description and tests).
  const OBS = [
    { id: 'bright-flame', label: 'Bright flame' }, { id: 'small-flame', label: 'Small flame' }, { id: 'no-flame', label: 'No flame' },
    { id: 'smoke', label: 'Smoke' }, { id: 'glowing', label: 'Glowing ember' }, { id: 'ash', label: 'Ash left' }
  ];
  const OBS_IDS = OBS.map(o => o.id);
  function obsTruth(fuelId) {
    const f = FUEL[normalizeFuel(fuelId)], out = ['ash'];
    if (f.flame >= 0.7) out.push('bright-flame'); else if (f.flame > 0.1) out.push('small-flame'); else out.push('no-flame');
    if (f.smoke >= 0.15) out.push('smoke');
    if (f.glow >= 0.45) out.push('glowing');
    return OBS_IDS.filter(o => out.includes(o));
  }

  /* ---------- the student's saved burn record ---------- */
  // state = { seed, fuel, current:{fuel,n,startedAt,skipped}|null, records:[{fuel,n,obs:[chip ids]}] }. Everything else is recomputed from seed + fuel + n.
  function cleanState(s) {
    if (!s || typeof s !== 'object' || !num(s.seed)) return null;
    const seen = {}, records = [];
    (Array.isArray(s.records) ? s.records : []).forEach(r => {
      if (!r || !FUEL[r.fuel]) return;
      const n = clamp(Math.round(num(r.n) ? r.n : 1), 1, MAX_SAMPLES), key = r.fuel + ':' + n;
      if (seen[key]) return; seen[key] = true;
      records.push({ fuel: r.fuel, n, obs: (Array.isArray(r.obs) ? r.obs : []).filter((o, i, a) => OBS_IDS.includes(o) && a.indexOf(o) === i) });
    });
    let current = null;
    if (s.current && FUEL[s.current.fuel] && num(s.current.startedAt)) {
      const n = clamp(Math.round(num(s.current.n) ? s.current.n : 1), 1, MAX_SAMPLES);
      if (!seen[s.current.fuel + ':' + n]) current = { fuel: s.current.fuel, n, startedAt: s.current.startedAt, skipped: !!s.current.skipped };
    }
    return { seed: s.seed >>> 0, fuel: normalizeFuel(s.fuel), current, records };
  }
  const samplesOf = (st, fuelId) => st && Array.isArray(st.records) ? st.records.filter(r => r.fuel === fuelId).length : 0;
  // The sample number the next burn of this fuel would be (1, 2, 3), or 0 when all three are used.
  function nextSample(st, fuelId) {
    const used = st && Array.isArray(st.records) ? st.records.filter(r => r.fuel === fuelId).map(r => r.n) : [];
    for (let n = 1; n <= MAX_SAMPLES; n++) if (!used.includes(n)) return n;
    return 0;
  }
  // Table rows for the recorded samples, with every number recomputed from the seed.
  function tableRows(st) {
    const s = cleanState(st); if (!s) return [];
    return s.records.map(r => Object.assign(burnResult(s.seed, r.fuel, r.n), { obs: r.obs })).sort((a, b) => FUEL_IDS.indexOf(a.fuel) - FUEL_IDS.indexOf(b.fuel) || a.n - b.n);
  }
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  // One line per fuel the student has burned: the mean of its recorded samples (what a class would graph).
  function byFuel(rows) {
    return FUELS.map(f => {
      const r = rows.filter(x => x.fuel === f.id); if (!r.length) return null;
      return { fuel: f.id, label: f.label, samples: r.length, igniteS: mean(r.map(x => x.igniteS)), burnS: mean(r.map(x => x.burnS)), tempRise: mean(r.map(x => x.tempRise)),
        massLost: mean(r.map(x => x.massLost)), btbAfter: mean(r.map(x => x.btbAfter)), btbChange: mean(r.map(x => x.btbChange)) };
    }).filter(Boolean);
  }
  const METRICS = {
    rise: { label: 'Temperature rise (°C)', yLabel: 'Temperature rise (°C, simulated)', get: r => r.tempRise },
    mass: { label: 'Mass lost (g)', yLabel: 'Mass lost (g, simulated)', get: r => r.massLost },
    btb: { label: 'BTB change (steps)', yLabel: 'BTB change from blue (steps on the 1 to 6 scale, simulated)', get: r => r.btbChange }
  };
  // Bar chart series for Lab.chart: one series per sample number so repeats show as separate bars.
  function chartSeries(rows, metric) {
    const m = METRICS[metric] || METRICS.rise;
    // Every fuel gets a point in every series (y is NaN when that sample was not burned), so a missing bar stays missing.
    return [1, 2, 3].filter(n => rows.some(r => r.n === n)).map(n => ({ name: 'Sample ' + n, points: FUELS.map(f => { const r = rows.find(x => x.fuel === f.id && x.n === n); return { x: SHORT[f.id], y: r ? round1(m.get(r)) : NaN }; }) }));
  }

  /* ---------- predictions, checked against the student's own table ---------- */
  const QUICK_S = 10;   // "lights quickly" means it ignited in 10 seconds or less
  // kind 'ignite': value 'quickly' | 'slowly'. kind 'energy': value 'less' | 'more' than the other fuels the student has burned.
  function checkPrediction(fuelId, kind, value, st) {
    if (!value) return { status: 'empty', message: '' };
    const rows = tableRows(st), g = byFuel(rows), mine = g.find(x => x.fuel === fuelId), name = fuelLabel(fuelId).toLowerCase();
    if (!mine) return { status: 'nodata', message: 'Burn and record ' + name + ' to check this.' };
    if (kind === 'ignite') {
      const s = Math.round(mine.igniteS), quick = mine.igniteS <= QUICK_S, ok = (value === 'quickly') === quick;
      return { status: ok ? 'correct' : 'wrong', message: (ok ? 'Yes. ' : 'Not quite. ') + 'In your data ' + name + ' caught fire after ' + s + ' s, which is ' + (quick ? 'quick' : 'slow') + ' (10 s or less is quick).' };
    }
    const others = g.filter(x => x.fuel !== fuelId);
    if (!others.length) return { status: 'nodata', message: 'Burn and record at least one other fuel to compare energy.' };
    const avg = mean(others.map(x => x.tempRise)), more = mine.tempRise > avg, ok = (value === 'more') === more;
    const tail = fuelId === 'peat' ? ' Peat warms the flask a little, but it keeps burning for much longer.' : '';
    return { status: ok ? 'correct' : 'wrong', message: (ok ? 'Yes. ' : 'Not quite. ') + 'In your data ' + name + ' warmed the flask ' + mine.tempRise.toFixed(1) + ' °C, ' + (more ? 'more' : 'less') + ' than the others on average (' + avg.toFixed(1) + ' °C).' + tail };
  }
  // "In my data, ___ turned the BTB most yellow / warmed the flask most / caught fire last." Ties count. Needs two fuels.
  function checkDataPick(kind, value, st) {
    if (!value) return { status: 'empty', message: '' };
    const g = byFuel(tableRows(st));
    if (g.length < 2) return { status: 'nodata', message: 'Burn and record at least two fuels first, then check this.' };
    const key = kind === 'yellowest' ? 'btbAfter' : kind === 'warmest' ? 'tempRise' : 'igniteS';
    const top = Math.max.apply(null, g.map(x => Math.round(x[key] * 10) / 10)), win = g.filter(x => Math.round(x[key] * 10) / 10 === top), names = win.map(x => x.label).join(' and ');
    const mine = g.find(x => x.fuel === value), what = kind === 'yellowest' ? 'turned the BTB the most yellow' : kind === 'warmest' ? 'warmed the flask the most' : 'took the longest to catch fire';
    if (!mine) return { status: 'wrong', message: 'You have not burned that fuel yet. In your data ' + names + ' ' + what + '.' };
    return win.some(x => x.fuel === value) ? { status: 'correct', message: 'Yes. In your data ' + names + ' ' + what + '.' }
      : { status: 'wrong', message: 'Try again. Why not: look at your table. In your data ' + names + ' ' + what + '.' };
  }

  /* ---------- tap and dropdown rows (the Make sense and Matter-Energy parts) ---------- */
  const PICKS = {
    'sense-btb': { correct: ['co2'], why: {
      co2: 'Yes. BTB turns green, then yellow, as carbon dioxide dissolves in it. Burning made carbon dioxide.',
      o2: 'Try again. Why not: burning uses oxygen up. BTB does not turn yellow for oxygen.',
      water: 'Try again. Why not: water vapor does not change BTB. Carbon dioxide does.' } },
    'sense-mass': { correct: ['air'], why: {
      air: 'Yes. Most of the missing mass left as gas, mostly carbon dioxide, so the scale showed less. What stayed behind is ash.',
      vanish: 'Try again. Why not: matter is not destroyed. The atoms went somewhere you could not weigh on the scale.',
      light: 'Try again. Why not: light is energy, not matter. It has no mass to lose.' } },
    'sense-energy': { correct: ['heat'], why: {
      heat: 'Yes. Energy stored in the fuel was released as heat and light. The flask warmed up.',
      ash: 'Try again. Why not: the ash is what is left over. The energy left with the heat and light.',
      vanish: 'Try again. Why not: energy is never used up. It is transferred.' } },
    'sense-slowest': { correct: ['dense'], why: {
      dense: 'Yes. Peat is dense and holds water, so it takes a long time to dry out and heat up before it catches. Then it smolders.',
      carbon: 'Try again. Why not: peat is made of plants, so it has plenty of carbon.',
      light: 'Try again. Why not: peat is not lighter than grass. It is packed tight.' } },
    'peat-fire': { correct: ['slow'], why: {
      slow: 'Yes. Peat burns slowly and keeps finding fuel under the ground, so a smoldering fire can last all winter.',
      fast: 'Try again. Why not: peat does not burn up fast. It smolders for a long time.',
      flame: 'Try again. Why not: smoldering fire has little flame. It glows and makes smoke.' } }
  };
  function checkPick(id, value) {
    const row = PICKS[id];
    if (!row) return { status: 'unknown', message: '' };
    if (!value) return { status: 'empty', message: '' };
    const message = row.why[value];
    if (message == null) return { status: 'wrong', message: 'Choose one of the answers shown.' };
    return { status: row.correct.includes(value) ? 'correct' : 'wrong', message };
  }

  /* ---------- claim, evidence and reasoning self-check ---------- */
  // 0 claim chosen, 1 evidence from my data, 2 reading evidence, 3 reasoning chosen, 4 caveat.
  function claimLevel(flags) {
    const f = [0, 1, 2, 3, 4].map(i => !!(flags && flags[i]));
    const n = f.filter(Boolean).length;
    if (!n) return 'none';
    if (f.every(Boolean)) return 'organized';
    if (f[0] && f[1] && n >= 3) return 'linked';
    return 'foundational';
  }
  /* Does the student's own table back up each evidence statement? true / false, or null when there is not enough data to say.
       peatLongest:    peat burned longer than every other fuel burned (needs peat and one more fuel)
       allLostMass:    every recorded sample weighed less after
       allYellower:    every recorded sample turned the BTB more yellow
       peatMostYellow: peat turned the BTB the most yellow (needs peat and one more fuel) */
  function evidenceChecks(st) {
    const out = { peatLongest: null, allLostMass: null, allYellower: null, peatMostYellow: null };
    const rows = tableRows(st), g = byFuel(rows);
    if (rows.length) { out.allLostMass = rows.every(r => r.massAfter < r.massBefore); out.allYellower = rows.every(r => r.btbAfter > r.btbBefore); }
    const peat = g.find(x => x.fuel === 'peat');
    if (peat && g.length > 1) {
      out.peatLongest = g.every(x => x.fuel === 'peat' || peat.burnS > x.burnS);
      out.peatMostYellow = g.every(x => x.fuel === 'peat' || Math.round(peat.btbAfter * 10) >= Math.round(x.btbAfter * 10));
    }
    return out;
  }
  function evidenceDetail(st) {
    const rows = tableRows(st), g = byFuel(rows), d = {};
    if (g.length) {
      const longest = g.reduce((a, b) => b.burnS > a.burnS ? b : a), yellow = g.reduce((a, b) => b.btbAfter > a.btbAfter ? b : a);
      d.longest = longest.label + ' (' + Math.round(longest.burnS) + ' s)'; d.yellowest = yellow.label + ' (' + yellow.btbAfter.toFixed(1) + ')';
      d.count = rows.length;
      d.worstMass = rows.reduce((a, b) => b.massLost < a.massLost ? b : a).label;
    }
    return d;
  }

  return { num, clamp, hash32, makeRng, FUELS, FUEL_IDS, FUEL, SHORT, fuelLabel, normalizeFuel, SAMPLE_MASS, START_TEMP, START_BTB, MAX_SAMPLES, TAIL, RATE, QUICK_S,
    BTB_LABELS, BTB_RGB, btbLabel, btbColor, btbText, dissolvedFraction, btbFromDissolved, burnResult, simSeconds, burnedFraction, stateAt, OBS, OBS_IDS, obsTruth,
    cleanState, samplesOf, nextSample, tableRows, byFuel, METRICS, chartSeries, checkPrediction, checkDataPick, PICKS, checkPick, claimLevel, evidenceChecks, evidenceDetail };
});
