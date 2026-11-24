/* Pure logic for "Burning Fuels: What Burns and Why" (OpenSciEd Unit B.2, Lesson 2 "What is peat and why does it burn so much?").
   No DOM here, so Node can test it (tests/openscied-b2-burn-logic.test.js) and the scene and the page reuse it.

   Source: OpenSciEd Unit B.2 Teacher Edition, Lesson 2 (the teacher's Burning Fuels demonstration: peat and other dry wildfire fuels burned in
   under a glass dome (an inverted bowl or a 1-quart glass container) that captures the carbon dioxide, with blue BTB in a Petri dish inside the dome beside the
   fuel, a laser (infrared) thermometer and a gram balance; students record BTB color, temperature and mass before and after, and other observations) and its Matter-Energy chart. EVERYTHING NUMERICAL HERE IS SIMULATED by a small model written for this
   site, not measured from real fuels. The page replaces no real demonstration and none of its safety steps.

   ASSUMPTIONS (stated once; repeated on the page under "What this simulation models")
   - The handfuls are NOT equal. The Teacher Edition notes that the fuels are not uniform and that the procedure did not emphasize equal masses or volumes,
     so the samples start at different masses. Nominal values per fuel (times are seconds in the flame):
       fuel      mass before   mass lost   ignites after   burns for   heat (kJ per g burned)   carbon factor   water factor
       grass          4 g         93 %          4 s           20 s              15                  0.44            0.55
       leaves         4 g         90 %          6 s           30 s              16                  0.45            0.55
       wood          10 g         97 %         14 s           90 s              18                  0.50            0.60
       charcoal      10 g         88 %         28 s          150 s              29                  0.90            0.12
       peat          30 g         78 %         45 s          260 s              20                  0.50            0.80
     So peat loses the most grams (about 23 g), then wood (9.7), charcoal (8.8), grass (3.7) and leaves (3.6). Peat is slow to catch, then smolders (smoke and a
     glowing ember front, little flame) and burns longest. Peat keeps more ash because it has mineral content. Charcoal is mostly carbon, so it has the
     most heat and the most carbon dioxide per gram, and glows with little flame and little smoke. These are teaching values chosen to look like class data
     and to match the Teacher Edition's sample evidence: peat's mass reduced the most, its temperature change and BTB color change were the greatest,
     it burned longest, and droplets formed on the glass, especially with peat.
   - Variation. Each student gets a seeded factor and each burned sample a smaller one: heat and mass lost about 8 percent in all (5 + 3), ignition
     time about 15 percent (8 + 7), burn time about 10 percent. A second sample of the same fuel therefore differs a little. The scale reads to 0.1 g
     with +/- 0.1 g noise on both weighings. The infrared thermometer shows whole degrees C. Each reading is the true glass temperature plus noise of +/- 0.5 degree, then rounded to the
     nearest degree (so a reading is off by at most a degree, and usually by none). Starting temperature 22 C. Because the rise is only about 2 to 3 degrees for grass and leaves,
     two fuels that give almost the same heat can differ by a degree or two in a table: that is thermometer noise, and the page says so. (The earlier version used +/- 1 degree on each reading,
     which let two near-identical fuels differ by up to 5 degrees.)
   - The apparatus. The fuel burns on a heat-safe tray under a large glass dome. A Petri dish of BTB (lid off) sits inside the dome beside the fuel, exposed to the
     air under the dome. The fuel sample is weighed on a balance before the burn and again after it (the sample sits under the dome during the burn). A laser
     (infrared) thermometer is used at those two weighings only, not during the burn, and it is aimed at the FUEL: before the burn at the sample (the dome is down over the
     tray, so the beam passes through the glass), and after the burn at the ash on the balance (the dome has been lifted and has cooled enough to work near). It reads to
     about 1 degree C. This is a simplification: the laser reads the fuel (or its ash) at each weighing, and real readings depend on where and when you aim.
   - Mass that disappears leaves as gas, mostly carbon dioxide and water vapor (ash stays). Carbon dioxide made (relative) = grams lost x carbon factor. It collects
     under the dome, and a FIXED share (0.6) of it dissolves into the BTB in the dish. The dome is not perfectly sealed, so some gas escapes (the Teacher Edition says
     the system was not totally closed); that is why the BTB shows a color change but not an exact amount, and why 0.6 is a share, not all of it. BTB reading (1 deep blue,
     2 blue, 3 blue-green, 4 green, 5 yellow-green, 6 yellow), starting at 2: 2 + 4 (1 - exp(-dissolved / 3.5)) + noise of +/- 0.2 (the noise is zero when nothing was lost),
     kept from 2 to 6. So for every sample, the BTB change grows with the carbon dioxide made, which grows with grams lost x carbon factor; no mass lost means no
     BTB change. Real BTB color also depends on its starting pH and on how much gas reaches it.
   - Heat. The temperature rise is the difference between the two laser readings of the fuel (the ash, after) taken at the weighings, after minus before. It is the
     temperature of the fuel and its surroundings: what the fuel's heat does. It equals grams burned x kJ per g x 0.35 / 8 kJ per degree C, kept between 2 and 22 C (the 0.35
     stands for the share of the heat that stays with the fuel, its ash, the tray and the air around them, and the 8 kJ per degree for the heat capacity of those). The reading
     is never lower after than before.
   - Water. Hydrogen in the fuel joins oxygen and leaves as water vapor. Water made (relative) = grams lost x water factor. It condenses as droplets on the INSIDE of the
     dome glass: most for peat, some for wood, leaves and grass, least for charcoal. The drawing shows droplets in proportion to it.
   - Smoke and carbon dioxide collect under the dome in the drawing in proportion to the smoke each fuel makes and to the carbon dioxide made.
   - Never impossible: mass after is below mass before and above zero, the temperature reading is not lower after than before, BTB 2 to 6, times positive. */
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
    { id: 'grass', label: 'Dried grass', mass: 4, water: 0.55, ignite: 4, burn: 20, loss: 0.93, kj: 15, co2: 0.44, flame: 1.0, smoke: 0.2, glow: 0.1, tone: 'a quick, bright flame' },
    { id: 'leaves', label: 'Dried leaves', mass: 4, water: 0.55, ignite: 6, burn: 30, loss: 0.90, kj: 16, co2: 0.45, flame: 0.85, smoke: 0.4, glow: 0.2, tone: 'a quick flame with some smoke' },
    { id: 'wood', label: 'Wood chips', mass: 10, water: 0.6, ignite: 14, burn: 90, loss: 0.97, kj: 18, co2: 0.50, flame: 0.75, smoke: 0.3, glow: 0.5, tone: 'a steady flame' },
    { id: 'charcoal', label: 'Charcoal', mass: 10, water: 0.12, ignite: 28, burn: 150, loss: 0.88, kj: 29, co2: 0.90, flame: 0.12, smoke: 0.05, glow: 1.0, tone: 'a red-orange glow, little flame, little smoke' },
    { id: 'peat', label: 'Peat', mass: 30, water: 0.8, ignite: 45, burn: 260, loss: 0.78, kj: 20, co2: 0.50, flame: 0.25, smoke: 1.0, glow: 0.8, tone: 'lots of smoke and a creeping glowing ember' }
  ];
  const FUEL_IDS = FUELS.map(f => f.id);
  const FUEL = Object.fromEntries(FUELS.map(f => [f.id, f]));
  const SHORT = { grass: 'Grass', leaves: 'Leaves', wood: 'Wood', charcoal: 'Charcoal', peat: 'Peat' };   // chart axis names (short, so they never break inside a word)
  const SHORT_NARROW = { grass: 'Hay', leaves: 'Leaf', wood: 'Wood', charcoal: 'Char', peat: 'Peat' };   // for a phone-width chart: Lab.chart gives each bar label about 4 characters there, so no name is longer than 4 and none can break inside a word (Hay = dried grass)
  const fuelLabel = id => FUEL[id] ? FUEL[id].label : '';
  const normalizeFuel = id => FUEL[id] ? id : 'grass';
  const massOf = id => FUEL[normalizeFuel(id)].mass;   // nominal grams of the handful
  const START_TEMP = 22;
  const START_BTB = 2;
  const MAX_SAMPLES = 3;          // samples of one fuel a student can burn
  const TAIL = 12;                // seconds the thermometer and BTB keep settling after the fuel is out
  const RATE = 6;                 // simulated seconds per real second on screen (peat takes about a minute, grass a few seconds)
  const DOME_KJ_PER_C = 8, DOME_SHARE = 0.35;
  const DISSOLVED_SHARE = 0.6;     // share of the carbon dioxide that dissolves into the BTB in the dish
  const DROP_FULL = 12;            // relative water made that fills the glass with droplets

  /* ---------- BTB ---------- */
  const BTB_LABELS = ['deep blue', 'blue', 'blue-green', 'green', 'yellow-green', 'yellow'];
  const BTB_RGB = [[22, 56, 140], [47, 107, 206], [38, 156, 150], [95, 174, 79], [184, 200, 60], [242, 212, 34]];
  const btbLabel = p => BTB_LABELS[clamp(Math.round(num(p) ? p : START_BTB), 1, 6) - 1];
  function btbColor(p) {
    const x = clamp(num(p) ? p : START_BTB, 1, 6) - 1, i = Math.min(4, Math.floor(x)), f = x - i, a = BTB_RGB[i], b = BTB_RGB[i + 1];
    return [0, 1, 2].map(k => Math.round(a[k] + (b[k] - a[k]) * f));
  }
  const btbText = p => btbLabel(p) + ' (' + (num(p) ? p : START_BTB).toFixed(1) + ')';
  const btbFromDissolved = d => START_BTB + 4 * (1 - Math.exp(-Math.max(0, num(d) ? d : 0) / 3.5));
  // The BTB reading for carbon dioxide made (relative): a fixed share dissolves; noise u (-1 to 1) of +/- 0.2 fades to nothing when no gas was made.
  function btbFor(co2Made, u) {
    const c = Math.max(0, num(co2Made) ? co2Made : 0), d = c * DISSOLVED_SHARE;
    return round1(clamp(btbFromDissolved(d) + clamp(num(u) ? u : 0, -1, 1) * 0.2 * Math.min(1, d), START_BTB, 6));
  }
  // Droplet level on the inside of the dome (0 to 1) for water made (relative).
  const dropletLevel = w => clamp(Math.sqrt(Math.max(0, num(w) ? w : 0) / DROP_FULL), 0, 1);

  /* ---------- one burned sample ---------- */
  // The numbers for sample n (1, 2, 3) of a fuel: always the same for the same seed, fuel and n.
  function burnResult(seed, fuelId, n) {
    const id = normalizeFuel(fuelId), f = FUEL[id], k = clamp(Math.round(num(n) ? n : 1), 1, MAX_SAMPLES);
    const stu = makeRng(hash32(seedOf(seed) + ':student')), smp = makeRng(hash32(seedOf(seed) + ':' + id + ':' + k));
    const sHeat = spread(stu, 0.05), sLoss = spread(stu, 0.05), sIgn = spread(stu, 0.08);
    const heatF = sHeat * spread(smp, 0.03), lossF = sLoss * spread(smp, 0.03), ignF = sIgn * spread(smp, 0.07), burnF = spread(smp, 0.10);
    const lossFrac = clamp(f.loss * lossF, 0.05, 0.99);
    const M = f.mass, burnedG = M * lossFrac;                                  // true grams that burned away
    const igniteS = Math.max(1, Math.round(f.ignite * ignF)), burnS = Math.max(1, Math.round(f.burn * burnF));
    const kjPerG = round1(f.kj * heatF), energyKj = kjPerG * burnedG;
    const dT = round1(clamp(DOME_SHARE * energyKj / DOME_KJ_PER_C, 2, 22));
    const co2Made = f.co2 * burnedG, dissolved = co2Made * DISSOLVED_SHARE, waterMade = f.water * burnedG;
    // Thermometer: the true glass temperature plus uniform noise of +/- 0.5 degree, shown to the nearest whole degree. (One draw per reading, as before, so nothing else in a student's data moves.)
    const noise = () => smp.uniform() - 0.5;
    const tempBefore = Math.round(START_TEMP + noise()), tempAfter = Math.max(tempBefore, Math.round(START_TEMP + dT + noise()));
    const scale = () => { const u = smp.uniform(); return u < 0.25 ? -0.1 : u < 0.5 ? 0.1 : 0; };
    const massBefore = round1(M + scale());
    const massAfter = round1(Math.min(massBefore - 0.1, Math.max(0.1, M * (1 - lossFrac) + scale())));
    const btbAfter = btbFor(co2Made, smp.uniform() * 2 - 1);
    return { fuel: id, n: k, label: f.label, igniteS, burnS, runS: igniteS + burnS + TAIL, massBefore, massAfter, massLost: round1(massBefore - massAfter),
      burnedG: Math.round(burnedG * 100) / 100, lossFrac: Math.round(lossFrac * 1000) / 1000, kjPerG, energyKj: Math.round(energyKj * 10) / 10, dT,
      tempBefore, tempAfter, tempRise: tempAfter - tempBefore, co2Made: Math.round(co2Made * 100) / 100, dissolved: Math.round(dissolved * 100) / 100, waterMade: Math.round(waterMade * 100) / 100, dropletLevel: Math.round(dropletLevel(waterMade) * 1000) / 1000, massStart: M, waterMade: Math.round(waterMade * 100) / 100, dropletLevel: Math.round(dropletLevel(waterMade) * 1000) / 1000, massStart: M,
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
    return { stage, t: tt, progress: tt / res.runS, burnedFraction: burned, massTrue: res.massStart - res.burnedG * burned, drops: res.dropletLevel * burned, gas: clamp(res.co2Made / 12, 0, 1) * burned, haze: clamp(burned * f.smoke * (stage === 'done' ? 0.7 : 1), 0, 1), flame, smoke, glow, igniter: stage === 'heating',
      temp: stage === 'done' ? res.tempAfter : temp, btb: stage === 'done' ? res.btbAfter : btb };
  }
  // Which observation chips the picture actually showed for a fuel (used for the text description and tests).
  const OBS = [
    { id: 'bright-flame', label: 'Bright flame' }, { id: 'small-flame', label: 'Small flame' }, { id: 'no-flame', label: 'No flame' },
    { id: 'smoke', label: 'Smoke' }, { id: 'glowing', label: 'Glowing ember' }, { id: 'droplets', label: 'Droplets on the glass' }, { id: 'ash', label: 'Ash left' }
  ];
  const OBS_IDS = OBS.map(o => o.id);
  function obsTruth(fuelId) {
    const f = FUEL[normalizeFuel(fuelId)], out = ['ash'];
    if (f.flame >= 0.7) out.push('bright-flame'); else if (f.flame > 0.1) out.push('small-flame'); else out.push('no-flame');
    if (f.smoke >= 0.15) out.push('smoke');
    if (f.glow >= 0.45) out.push('glowing');
    if (f.water * f.mass * f.loss >= 1.5) out.push('droplets');
    return OBS_IDS.filter(o => out.includes(o));
  }

  /* ---------- the student's saved burn record ---------- */
  // state = { seed, fuel, current:{fuel,n,startedAt,skipped}|null, records:[{fuel,n,obs:[chip ids]}] }. Everything else is recomputed from seed + fuel + n.
  function cleanState(s) {
    if (!s || typeof s !== 'object' || !num(s.seed)) return null;
    const seen = {}, records = [];
    const cleanObs = obs => (Array.isArray(obs) ? obs : []).filter((o, i, a) => OBS_IDS.includes(o) && a.indexOf(o) === i);
    (Array.isArray(s.records) ? s.records : []).forEach(r => {
      if (!r || !FUEL[r.fuel]) return;
      const n = clamp(Math.round(num(r.n) ? r.n : 1), 1, MAX_SAMPLES), key = r.fuel + ':' + n;
      if (seen[key]) return; seen[key] = true;
      records.push({ fuel: r.fuel, n, obs: cleanObs(r.obs) });
    });
    let current = null;
    if (s.current && FUEL[s.current.fuel] && num(s.current.startedAt)) {
      const n = clamp(Math.round(num(s.current.n) ? s.current.n : 1), 1, MAX_SAMPLES);
      if (!seen[s.current.fuel + ':' + n]) {
        current = { fuel: s.current.fuel, n, startedAt: s.current.startedAt, skipped: !!s.current.skipped, after: !!s.current.after };
        if (current.after && Array.isArray(s.current.obs)) current.obs = cleanObs(s.current.obs);
      }
    }
    // the BEFORE weighing (mass and laser temperature read) taken for the next sample; the AFTER weighing is current.after
    let weighed = null;
    if (s.weighed && FUEL[s.weighed.fuel] && !current) { const n = clamp(Math.round(num(s.weighed.n) ? s.weighed.n : 1), 1, MAX_SAMPLES); if (!seen[s.weighed.fuel + ':' + n]) weighed = { fuel: s.weighed.fuel, n }; }
    const out = { seed: s.seed >>> 0, fuel: normalizeFuel(s.fuel), current, records, weighed };
    if (!current && s.review && records.some(row => row.fuel === s.review.fuel && row.n === s.review.n)) {
      out.review = { fuel: s.review.fuel, n: s.review.n };
    }
    return out;
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
    rise: { label: 'Temperature rise (°C)', yLabel: 'Temperature rise (°C, simulated)', yShort: 'Rise (°C, simulated)', get: r => r.tempRise },
    mass: { label: 'Mass lost (g)', yLabel: 'Mass lost (g, simulated)', yShort: 'Lost (g, simulated)', get: r => r.massLost },
    btb: { label: 'BTB change (steps)', yLabel: 'BTB change from blue (steps on the 1 to 6 scale, simulated)', yShort: 'BTB steps (simulated)', get: r => r.btbChange }
  };
  // Bar chart series for Lab.chart: one series per sample number so repeats show as separate bars.
  function chartSeries(rows, metric, names) {
    names = names || SHORT;
    const m = METRICS[metric] || METRICS.rise;
    // Every fuel gets a point in every series (y is NaN when that sample was not burned), so a missing bar stays missing.
    return [1, 2, 3].filter(n => rows.some(r => r.n === n)).map(n => ({ name: 'Sample ' + n, points: FUELS.map(f => { const r = rows.find(x => x.fuel === f.id && x.n === n); return { x: names[f.id], y: r ? round1(m.get(r)) : NaN }; }) }));
  }

  /* ---------- predictions, checked against the student's own table ---------- */
  const QUICK_S = 10;   // "lights quickly" means it ignited in 10 seconds or less
  // kind 'ignite': value 'quickly' | 'slowly'. legacy kind 'energy': value 'less' | 'more' temperature rise than the other fuels burned.
  function checkPrediction(fuelId, kind, value, st) {
    if (!value) return { status: 'empty', message: '' };
    const rows = tableRows(st), g = byFuel(rows), mine = g.find(x => x.fuel === fuelId), name = fuelLabel(fuelId).toLowerCase();
    if (!mine) return { status: 'nodata', message: 'Burn and record ' + name + ' to check this.' };
    if (kind === 'ignite') {
      const s = Math.round(mine.igniteS), quick = mine.igniteS <= QUICK_S, ok = (value === 'quickly') === quick;
      return { status: ok ? 'correct' : 'wrong', message: (ok ? 'Yes. ' : 'Not quite. ') + 'In your data ' + name + ' caught fire after ' + s + ' s, which is ' + (quick ? 'quick' : 'slow') + ' (10 s or less is quick).' };
    }
    const others = g.filter(x => x.fuel !== fuelId);
    if (!others.length) return { status: 'nodata', message: 'Burn and record at least one other fuel to compare temperature changes.' };
    const avg = mean(others.map(x => x.tempRise)), more = mine.tempRise > avg, ok = (value === 'more') === more;
    return { status: ok ? 'correct' : 'wrong', message: (ok ? 'Yes. ' : 'Not quite. ') + 'In your data ' + name + ' warmed up ' + mine.tempRise.toFixed(1) + ' °C, ' + (more ? 'more' : 'less') + ' than the others on average (' + avg.toFixed(1) + ' °C).' };
  }
  // "In my data, ___ turned the BTB most yellow / warmed up most / caught fire last." Ties count. Needs two fuels.
  function checkDataPick(kind, value, st) {
    if (!value) return { status: 'empty', message: '' };
    const g = byFuel(tableRows(st));
    if (g.length < 2) return { status: 'nodata', message: 'Burn and record at least two fuels first, then check this.' };
    const key = kind === 'yellowest' ? 'btbAfter' : kind === 'warmest' ? 'tempRise' : kind === 'lostmost' ? 'massLost' : 'igniteS';
    const top = Math.max.apply(null, g.map(x => Math.round(x[key] * 10) / 10)), win = g.filter(x => Math.round(x[key] * 10) / 10 === top), names = win.map(x => x.label).join(' and ');
    const mine = g.find(x => x.fuel === value), what = kind === 'yellowest' ? 'turned the BTB the most yellow' : kind === 'warmest' ? 'warmed up the most' : kind === 'lostmost' ? 'lost the most mass' : 'took the longest to catch fire';
    if (!mine) return { status: 'wrong', message: 'You have not burned that fuel yet. In your data ' + names + ' ' + what + '.' };
    return win.some(x => x.fuel === value) ? { status: 'correct', message: 'Yes. In your data ' + names + ' ' + what + '.' }
      : { status: 'wrong', message: 'Try again. Why not: look at your table. In your data ' + names + ' ' + what + '.' };
  }

  /* ---------- tap and dropdown rows (the Make sense and Matter-Energy parts) ---------- */
  const PICKS = {
    'sense-btb': { correct: ['co2'], why: {
      co2: 'Yes. BTB turns green, then yellow, as carbon dioxide dissolves in it. Burning made carbon dioxide under the dome.',
      o2: 'Try again. Why not: burning uses oxygen up. BTB does not turn yellow for oxygen.',
      water: 'Try again. Why not: water vapor does not change BTB. Carbon dioxide does.' } },
    'sense-mass': { correct: ['air'], why: {
      air: 'Yes. The mass that disappears leaves as gases, mostly carbon dioxide and water vapor, so the scale showed less. What stayed behind is ash.',
      vanish: 'Try again. Why not: matter is not destroyed. The atoms went somewhere you could not weigh on the scale.',
      light: 'Try again. Why not: light is energy, not matter. It has no mass to lose.' } },
    'sense-water': { correct: ['hydrogen'], why: {
      hydrogen: 'Yes. Fuels contain hydrogen. It joins oxygen when the fuel burns and leaves as water vapor, which condenses on the cool glass.',
      air: 'Try again. Why not: the air under the dome has very little water. The droplets were biggest with peat, which had the most fuel to burn.',
      btb: 'Try again. Why not: the BTB stays in its dish on the bench. The droplets formed on the inside of the dome glass.' } },
    'sense-massbtb': { correct: ['more'], why: {
      more: 'Yes. Mass lost leaves as gas. The more mass a fuel lost, the more carbon dioxide it made, so the BTB changed more. Check this in your table.',
      less: 'Try again. Why not: carbon dioxide comes from the mass that is lost. More mass lost means more carbon dioxide.',
      same: 'Try again. Why not: the BTB changed by different amounts, and the fuels lost different amounts of mass.' } },
    'sense-dish': { correct: ['reach'], why: {
      reach: 'Yes. The carbon dioxide from the fire collects under the dome, so the dish of BTB inside it is exposed to the gas and changes color.',
      cool: 'Try again. Why not: the dish sits next to a hot fire, so it is not there to stay cool.',
      smoke: 'Try again. Why not: BTB shows carbon dioxide, not smoke. Smoke is bits of burning fuel.' } },
    'sense-energy': { correct: ['heat'], why: {
      heat: 'Yes. Energy stored in the fuel was released as heat and light. The fuel and what is around it warmed up.',
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
  /* Does the student's own table back up each evidence statement? true / false, or null when there is not enough data to say (peat and one more fuel).
     Each compares the mean of the student's recorded samples of each fuel; a tie for the top counts.
       peatMostMass: peat lost the most mass    peatBtbMost: peat made the biggest BTB change
       peatWarmest:  peat's temperature rose the most    peatLongest: peat burned the longest */
  function evidenceChecks(st) { return evidenceFromGroups(byFuel(tableRows(st))); }
  // The same checks on per-fuel means (what byFuel returns), so a table that does NOT show a statement can be tested with made-up means.
  function evidenceFromGroups(g) {
    const out = { peatMostMass: null, peatBtbMost: null, peatWarmest: null, peatLongest: null }, peat = g.find(x => x.fuel === 'peat');
    if (peat && g.length > 1) {
      const top = (key, scale) => g.every(x => x.fuel === 'peat' || Math.round(peat[key] * scale) >= Math.round(x[key] * scale));
      out.peatMostMass = top('massLost', 10); out.peatBtbMost = top('btbChange', 10); out.peatWarmest = top('tempRise', 10);
      out.peatLongest = g.every(x => x.fuel === 'peat' || peat.burnS > x.burnS);
    }
    return out;
  }
  function evidenceDetail(st) {
    const g = byFuel(tableRows(st)), d = {};
    const best = (key, fmt) => { const t = g.reduce((a, b) => b[key] > a[key] ? b : a); return t.label + ' (' + fmt(t[key]) + ')'; };
    if (g.length) {
      d.mostMass = best('massLost', v => v.toFixed(1) + ' g'); d.mostBtb = best('btbChange', v => '+' + v.toFixed(1)); d.warmest = best('tempRise', v => v.toFixed(1) + ' °C'); d.longest = best('burnS', v => Math.round(v) + ' s');
    }
    return d;
  }

  return { num, clamp, hash32, makeRng, FUELS, FUEL_IDS, FUEL, SHORT, SHORT_NARROW, fuelLabel, normalizeFuel, massOf, DISSOLVED_SHARE, btbFor, dropletLevel, DROP_FULL, START_TEMP, START_BTB, MAX_SAMPLES, TAIL, RATE, QUICK_S,
    BTB_LABELS, BTB_RGB, btbLabel, btbColor, btbText, btbFromDissolved, burnResult, simSeconds, burnedFraction, stateAt, OBS, OBS_IDS, obsTruth,
    cleanState, samplesOf, nextSample, tableRows, byFuel, METRICS, chartSeries, checkPrediction, checkDataPick, PICKS, checkPick, claimLevel, evidenceChecks, evidenceFromGroups, evidenceDetail };
});
