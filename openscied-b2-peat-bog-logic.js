/* Peat Bog Carbon Lab: pure model for the OpenSciEd Biology Unit B.2 companion (Fires). No DOM, no storage, no randomness.
   Loads in the browser (window.B2PeatBogLogic) and in Node (require) so tests can check it against hand-computed values.

   WHAT THIS MODELS, AND WHAT IT DOES NOT (the page repeats this in "What this simulation models")
   Every number is SIMULATED and sits on a 0-100 TEACHING SCALE. 0 means "stopped", 100 means "fastest this model allows". These are
   not measurements and not units of carbon. The model was chosen to show the trends in OpenSciEd B.2 Lessons 2-9; it is not a
   forecast of any real bog.

   MODEL ASSUMPTIONS
   1. Sunlight. Daily-mean sunlight on the longest day at 65 degrees north, from the standard solstice formula with the sun's
      distance held at its mean value (no orbital eccentricity, no clouds, no atmosphere). Only Earth's tilt (obliquity) changes it.
      The model takes today's 65 N value (Q_NOW) as 1.0 and scales plant light by that ratio. The solstice noon sun is
      (90 - 65 + tilt) degrees above the horizon.
   2. Tilt warming. Summer air temperature rises 0.1 degree C for every 1 W/m2 of extra solstice sunlight (a teaching constant, not
      a measured climate sensitivity). The slider "Summer temperature" is the temperature BEFORE this tilt effect.
   3. Photosynthesis P = 100 x light x CO2 x temperature x water x oxygen, each factor on its own scale, then limited to 0..100.
      light   = 0.8 x (sunlight / today's sunlight)
      CO2     = 1.2 x x/(x+400) with x = max(0, ppm - 50): saturating, nothing below a 50 ppm compensation point
      temp    = 0 at or below -2 C, a bell peaking at 18 C (width 12 C below, 9 C above): cold and heat both slow plants
      water   = 0.3 + 0.7 x (1 - exp(-wet/25)): bog mosses dry out if the water table is low, but never stop completely
      oxygen  = 1.15 - 0.007 x O2%, limited to 0.5..1.15 (high oxygen slightly slows photosynthesis; real plants lose carbon to
                photorespiration)
   4. Permafrost. Fraction of the peat that is frozen = (11 - T)/8 limited to 0..1, with T the summer temperature including tilt.
      Freezing sharply reduces modeled decomposition. Fire cannot burn the frozen share.
   5. Oxygen in the peat. soilO2 = (air O2 / 21) x (1 - 0.85 x water/100): a whole-bog average. Water fills the air spaces, so more
      water means less oxygen reaches the decomposers. (Real peat has oxygen near the surface and almost none under the water table.)
   6. Decomposition D = 30 x 2^((T - 12)/10) x heat-damage x oxygen x (1 - 0.95 x frozen). The temperature rule doubles the rate
      for every 10 C (a Q10 of 2, typical of microbes). Oxygen factor = 1.3 x s/(s + 0.3) with s = soilO2. Heat damage applies only
      above 40 C. With no oxygen the model stops decomposition; real peat keeps decomposing very slowly without oxygen (microbes
      that make methane).
   7. Burning B = burning-slider x dryness x oxygen x (1 - frozen) x 1.1, limited to 0..100. Frozen peat cannot burn, so B is 0
      when all the peat is frozen (summer temperature 3 degrees C or lower) and shrinks in proportion to the frozen share before that. dryness = 1 - 0.9 x water/100.
      oxygen factor = (O2% - 12)/9 limited to 0..1.6, so there is no fire at or below 12% oxygen. (Real flaming fire needs about 15-16%
      oxygen; smoldering peat can keep going at lower oxygen, so 12% is a middle value for "fire of any kind".)
   8. Peat carbon N = P - D - B, worked out from the three numbers AS DISPLAYED (each rounded to a whole number), so a student can
      check the subtraction on the screen and it always closes. Positive: more carbon goes in than comes out (a carbon sink).
      Negative: the bog is a carbon source. Zero (P = D + B once rounded) is balanced. It is a difference of three teaching-scale
      numbers, not a mass of carbon.
   9. Zombie fire survival (chance, 0-95%) multiplies five 0..1 factors: fire burning now (B/40), dry peat (1.3 x (1 - water/100)),
      oxygen in the peat (soilO2/0.6), thawed ground (1 - frozen), summer heat (0.4 + 0.6 x (T - 4)/14). One weak factor can end the fire.
      It is a teaching chance, not a fire forecast. Real overwintering fires depend on peat depth, snow cover, weather and more.
   10. Carbon budget to 2100. Years 2025..2100, starting at 425 ppm. Each year: land uptake = 0.018 x (ppm - 280) x forests/100 GtC,
      ocean uptake = 0.018 x (ppm - 280) GtC, clearing and draining = 0.03 x (100 - forests) GtC (only below 100%). The change in
      CO2 is (fossil + clearing - land - ocean)/2.12 ppm per year (2.12 GtC of carbon raises the air by 1 ppm), never below 280 ppm.
      Warming since the 1800s = 2.0 x log2(ppm/280) degrees C. This is about 1.2 C at 425 ppm. It leaves out other greenhouse gases,
      aerosols, clouds, ice, ocean heat storage and tipping points, and it is a transient estimate, not an equilibrium one.
   11. "Test the bog in this year": the bog gets that year's CO2 (rounded to 10 ppm) and a summer temperature of 10 C plus
      2.5 times the warming since 2025 (the Arctic warms faster than the planet; estimates run from about 2 to 4 times).
   12. Nothing here is random, so every student sees the same numbers for the same settings. The worksheet's reference values depend
      on that. Inputs outside a slider's range, or not numbers, are clamped to the range (or reset to the default): no output is ever
      negative where it should not be, above 100, or NaN. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.B2PeatBogLogic = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RAD = Math.PI / 180;
  const LAT = 65, TILT_NOW = 23.44, SOLAR_CONSTANT = 1361;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const isNum = x => typeof x === 'number' && isFinite(x);

  // Bog variables (the sliders). step is the slider step; unit is for labels and axis titles.
  const VARS = [
    { key: 'tilt', label: 'Earth’s tilt', min: 22.1, max: 24.5, step: 0.05, unit: '°', digits: 2 },
    { key: 'temp', label: 'Summer temperature', min: -5, max: 30, step: 1, unit: '°C', digits: 0 },
    { key: 'co2', label: 'Carbon dioxide', min: 0, max: 2000, step: 10, unit: 'ppm', digits: 0 },
    { key: 'o2', label: 'Oxygen in the air', min: 0, max: 35, step: 1, unit: '%', digits: 0 },
    { key: 'wet', label: 'Water level in the bog', min: 0, max: 100, step: 1, unit: '%', digits: 0 },
    { key: 'burn', label: 'Burning', min: 0, max: 100, step: 1, unit: '%', digits: 0 }
  ];
  const DEFAULTS = { tilt: TILT_NOW, temp: 10, co2: 420, o2: 21, wet: 75, burn: 0 };
  const ZOMBIE_SETUP = { tilt: TILT_NOW, temp: 19, co2: 420, o2: 21, wet: 22, burn: 55 };
  const PRESETS = [
    { name: 'Arctic summer today', values: DEFAULTS },
    { name: 'High tilt, 10,700 years ago', values: Object.assign({}, DEFAULTS, { tilt: 24.2, co2: 260 }) },
    { name: 'Low tilt (22.1°)', values: Object.assign({}, DEFAULTS, { tilt: 22.1 }) },
    { name: 'Drained bog', values: Object.assign({}, DEFAULTS, { wet: 12 }) },
    { name: 'Peat wildfire in a drought', values: Object.assign({}, DEFAULTS, { wet: 15, temp: 16, burn: 70 }) },
    { name: 'Arctic heat wave', values: Object.assign({}, DEFAULTS, { temp: 20, wet: 45 }) },
    { name: 'Zombie fire conditions', values: ZOMBIE_SETUP }
  ];
  const TILT_PRESETS = [{ name: 'Lowest · 22.1°', tilt: 22.1 }, { name: 'Today · 23.44°', tilt: 23.44 }, { name: '10,700 yrs ago · 24.2°', tilt: 24.2 }, { name: 'Highest · 24.5°', tilt: 24.5 }];
  const SEASONS = ['Summer', 'Fall', 'Winter', 'Spring'];

  /* Fill in missing or bad values with the defaults and clamp every value to its slider range. */
  function sanitize(s) {
    const out = {};
    VARS.forEach(function (v) {
      const raw = s ? s[v.key] : undefined;
      const x = typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '') ? +raw : NaN;
      out[v.key] = clamp(isFinite(x) ? x : DEFAULTS[v.key], v.min, v.max);
    });
    return out;
  }
  const same = (a, b) => VARS.every(v => Math.abs(a[v.key] - b[v.key]) < 1e-6);

  /* ---------- Earth's tilt: daily-mean sunlight at 65 N on the summer solstice (W/m2) ---------- */
  function solstice(tilt) {
    const f = LAT * RAD, d = clamp(+tilt, 0, 90) * RAD;
    const x = -Math.tan(f) * Math.tan(d);
    const h = x <= -1 ? Math.PI : Math.acos(Math.min(1, x));
    return SOLAR_CONSTANT / Math.PI * (h * Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.sin(h));
  }
  const Q_NOW = solstice(TILT_NOW);
  const tiltWarming = tilt => 0.1 * (solstice(tilt) - Q_NOW);
  const noonSun = tilt => 90 - LAT + tilt;
  const arcticCircle = tilt => 90 - tilt;

  /* Oxygen that reaches the peat, as a percent of the bog (whole-bog average). */
  const peatOxygen = s => s.o2 * (1 - 0.85 * s.wet / 100);

  /* ---------- the bog ---------- */
  function model(input) {
    const s = sanitize(input);
    const q = solstice(s.tilt), relQ = q / Q_NOW;
    const T = s.temp + tiltWarming(s.tilt);
    const fL = 0.8 * relQ;
    const x = Math.max(0, s.co2 - 50);
    const fC = 1.2 * x / (x + 400);
    let fT = 0;
    if (T > -2) fT = T <= 18 ? Math.exp(-Math.pow((T - 18) / 12, 2)) : Math.exp(-Math.pow((T - 18) / 9, 2));
    const fW = 0.3 + 0.7 * (1 - Math.exp(-s.wet / 25));
    const fO = clamp(1.15 - 0.007 * s.o2, 0.5, 1.15);
    const P = clamp(100 * fL * fC * fT * fW * fO, 0, 100);

    const perm = clamp((11 - T) / 8, 0, 1);
    const soilO2 = (s.o2 / 21) * (1 - 0.85 * s.wet / 100);
    const fOD = soilO2 * 1.3 / (soilO2 + 0.3);
    const den = T > 40 ? Math.exp(-Math.pow((T - 40) / 6, 2)) : 1;
    const D = clamp(30 * Math.pow(2, (T - 12) / 10) * den * fOD * (1 - 0.95 * perm), 0, 100);

    const dry = 1 - 0.9 * s.wet / 100;
    const fOB = clamp((s.o2 - 12) / 9, 0, 1.6);
    const B = clamp(s.burn * dry * fOB * (1 - perm) * 1.1, 0, 100);
    // Peat carbon uses the displayed (rounded) rates so P - D - B is exact on screen (every page, table, CSV and note reads this N).
    return { s, P, D, B, N: Math.round(P) - Math.round(D) - Math.round(B), T, q, relQ, perm, soilO2, peatO2: peatOxygen(s), f: { light: fL / 0.8, co2: fC, temp: fT, water: fW } };
  }
  // N is a whole number (see model), so balanced means exactly 0: the displayed P equals D + B.
  const verdict = N => N > 0 ? 'sink' : N < 0 ? 'source' : 'balanced';

  /* ---------- zombie fires: the chance an underground fire survives the winter ---------- */
  function zombie(input, m) {
    const mm = m || model(input), s = mm.s;
    const fire = clamp(mm.B / 40, 0, 1);
    const dry = clamp((1 - s.wet / 100) * 1.3, 0, 1);
    const oxy = clamp(mm.soilO2 / 0.6, 0, 1);
    const thaw = 1 - mm.perm;
    const heat = clamp((mm.T - 4) / 14, 0, 1);
    const score = fire * dry * oxy * thaw * (0.4 + 0.6 * heat);
    return { fire, dry, oxy, thaw, heat, chance: Math.round(clamp(score, 0, 0.95) * 100) };
  }
  const ZOMBIE_FACTORS = [['fire', 'Fire burning now'], ['dry', 'Dry peat to burn'], ['oxy', 'Oxygen in the peat'], ['thaw', 'Thawed ground'], ['heat', 'Summer heat']];
  const ZOMBIE_WHY = {
    fire: 'There is no fire to survive the winter. Raise the Burning slider above 0.',
    dry: 'The water level is high, so there is little dry peat for the fire to creep into.',
    oxy: 'Water fills the air spaces in the peat, so the smoldering fire is smothered without oxygen.',
    thaw: 'Most of the peat is frozen. A fire can’t burn into frozen peat.',
    heat: 'Cool summers don’t dry the peat deeply enough.'
  };
  function weakestZombieFactor(z) {
    let best = ZOMBIE_FACTORS[0][0];
    ZOMBIE_FACTORS.forEach(function (f) { if (z[f[0]] < z[best]) best = f[0]; });
    return best;
  }
  // Captions for the four seasons, from the fire's strength, whether it survives (chance >= 50) and the water level.
  function seasonCaption(season, z, wet) {
    const alive = z.chance >= 50, none = z.fire <= 0.05;
    switch (season) {
      case 0: return none ? 'Summer: no fire is burning in this bog. Raise the Burning slider to start one.'
        : 'Summer: the fire burns at the surface. Where the peat is dry, air spaces let oxygen in, and the fire creeps downward into the peat.';
      case 1: return none ? 'Fall: no fire.' : 'Fall: rain and cold put out the flames at the surface. Underground, the fire keeps smoldering in the dry peat, like a hot coal.';
      case 2: return none ? 'Winter: no fire.' : alive
        ? 'Winter: snow covers the bog. Underneath, the fire smolders slowly, using the little oxygen that seeps through dry peat and burning the carbon stored in it. The snow keeps it insulated.'
        : 'Winter: the underground fire runs out of oxygen or dry peat and goes out. ' + (wet > 40 ? 'Water filled the air spaces and smothered it.' : '');
      default: return none ? 'Spring: no fire returns.' : alive
        ? 'Spring: the snow melts and the peat dries. The fire comes back to the surface and starts burning again. This is a zombie fire.'
        : 'Spring: the fire stayed out. No zombie fire this year.';
    }
  }

  /* ---------- coloured notes under the bog ---------- */
  function notes(input, m) {
    const mm = m || model(input), s = mm.s, out = [], dq = (mm.relQ - 1) * 100;
    if (Math.abs(s.tilt - TILT_NOW) > 0.05) {
      const today = model({ ...s, tilt: TILT_NOW });
      const compare = (label, before, after, unit = '') => {
        const first = Math.round(before), last = Math.round(after);
        return label + (first === last ? ' stays at ' + last + unit : (last > first ? ' rises' : ' falls') +
          ' from ' + first + unit + ' to ' + last + unit) + '.';
      };
      const results = ' With only tilt changed from today’s value: ' +
        compare('photosynthesis', today.P, mm.P) + ' ' + compare('Frozen peat', today.perm * 100, mm.perm * 100, '%');
      out.push(s.tilt > TILT_NOW
        ? ['photo', 'Bigger tilt', 'In summer the Arctic leans further toward the sun. The noon sun is ' + (s.tilt - TILT_NOW).toFixed(1) + '° higher and the long summer days deliver ' + dq.toFixed(1) + '% more sunlight. Summers warm by about ' + tiltWarming(s.tilt).toFixed(1) + ' °C.' + results]
        : ['ice', 'Smaller tilt', 'In summer the Arctic leans less toward the sun. The noon sun is ' + (TILT_NOW - s.tilt).toFixed(1) + '° lower and summer sunlight drops ' + Math.abs(dq).toFixed(1) + '%. Summers cool by about ' + Math.abs(tiltWarming(s.tilt)).toFixed(1) + ' °C.' + results]);
    }
    if (mm.perm > 0.04) out.push(['ice', 'Permafrost', 'About ' + Math.round(mm.perm * 100) + '% of the peat is frozen. Freezing sharply slows decomposition; the model can still show a small rate even when all peat is frozen. Fire can burn only the thawed share. Slower carbon loss helps explain why many cold peatlands store carbon.']);
    if (mm.T > 40) out.push(['warn', 'Too hot', 'Extreme heat damages the enzymes that plants and decomposers depend on.']);
    if (mm.P < 1) {
      out.push(['photo', 'Plants can’t grow', mm.T <= -2 ? 'It is too cold for photosynthesis.' : s.co2 <= 50 ? 'There is not enough carbon dioxide for photosynthesis.' : 'Conditions are too harsh for photosynthesis.']);
    } else {
      const why = {
        temp: mm.T < 18 ? 'Cool Arctic temperatures are slowing photosynthesis the most.' : 'It is past the best temperature for these plants.',
        co2: 'Carbon dioxide is limiting photosynthesis. More CO₂ would speed it up, until something else runs short.',
        water: 'Water is limiting photosynthesis. Bog mosses dry out and stop growing.',
        light: 'Sunlight is limiting photosynthesis.'
      };
      let k = 'temp', lo = 9;
      ['light', 'co2', 'temp', 'water'].forEach(function (key) { if (mm.f[key] < lo) { lo = mm.f[key]; k = key; } });
      out.push(['photo', 'What limits plant growth', why[k]]);
    }
    const peatO2 = mm.peatO2.toFixed(0);
    if (s.wet >= 60) out.push(['resp', 'Water level high, oxygen low', 'Water fills the air spaces in the peat, so only about ' + peatO2 + '% oxygen reaches it (air has ' + s.o2 + '%). Decomposers need oxygen for cellular respiration, so they work slowly. That is why dead plants pile up instead of rotting away.']);
    else if (s.wet <= 30) out.push(['warn', 'Water level low, oxygen high', 'Air fills the spaces in the dry peat, so about ' + peatO2 + '% oxygen reaches it. Decomposers speed up, and fire has the oxygen it needs to burn down into the peat.']);
    else out.push(['resp', 'Water level and oxygen', 'About ' + peatO2 + '% oxygen reaches the peat above the water level. Below the water level there is very little.']);
    if (s.o2 < 5) out.push(['resp', 'Very little oxygen', 'Decomposers can’t do much cellular respiration without oxygen, so decomposition nearly stops in this model. In a real bog a few microbes still work slowly without oxygen.']);
    if (s.burn > 0) {
      if (mm.B < 2) out.push(['warn', 'The fire won’t spread', s.o2 <= 12 ? 'There isn’t enough oxygen in the air to keep the fire going.' : mm.perm > 0.8 ? 'Frozen peat won’t burn.' : 'Wet peat barely burns.']);
      else out.push(['warn', 'Burning', 'Fire uses the same inputs as decomposition (peat and oxygen) and makes the same outputs (CO₂ and water). Fire releases the stored energy in minutes as heat and light. Decomposers release it slowly over many years.']);
    }
    return out.map(function (n) { return { kind: n[0], title: n[1], text: n[2] }; });
  }

  /* ---------- the "Test one variable" graph ---------- */
  function exploreSeries(input, key, n) {
    const v = VARS.find(x => x.key === key) || VARS[1], s = sanitize(input), count = Math.max(2, n || 120);
    const xs = [], P = [], D = [], B = [];
    for (let i = 0; i <= count; i++) {
      const x = v.min + (v.max - v.min) * i / count;
      const m = model(Object.assign({}, s, { [v.key]: x }));
      xs.push(x); P.push(m.P); D.push(m.D); B.push(m.B);
    }
    return { v, xs, P, D, B };
  }

  /* ---------- CO2 and global warming through 2100 ---------- */
  const Y0 = 2025, Y1 = 2100, C0 = 425, PPM_PER_GT = 2.12, PREINDUSTRIAL = 280, ARCTIC_AMPLIFICATION = 2.5;
  const CLIMATE_VARS = {
    fossil: { min: 0, max: 20, step: 0.5, def: 10 },
    forest: { min: 25, max: 150, step: 5, def: 100 },
    year: { min: Y0, max: Y1, step: 1, def: Y1 }
  };
  function sanitizeClimate(c) {
    const out = {};
    Object.keys(CLIMATE_VARS).forEach(function (k) {
      const spec = CLIMATE_VARS[k], raw = c ? c[k] : undefined;
      const x = typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '') ? +raw : NaN;
      out[k] = isFinite(x) ? clamp(x, spec.min, spec.max) : spec.def;
    });
    out.year = Math.round(out.year);
    return out;
  }
  function climate(fossilIn, forestIn) {
    const fossil = clamp(isNum(+fossilIn) ? +fossilIn : 10, 0, 20), forest = clamp(isNum(+forestIn) ? +forestIn : 100, 25, 150);
    let C = C0; const rows = [];
    for (let y = Y0; y <= Y1; y++) {
      const land = 0.018 * (C - PREINDUSTRIAL) * forest / 100;
      const ocean = 0.018 * (C - PREINDUSTRIAL);
      const clear = forest < 100 ? 0.03 * (100 - forest) : 0;
      const T = 2.0 * Math.log2(C / PREINDUSTRIAL);
      rows.push({ y, C, T, fossil, clear, land: Math.max(0, land), ocean: Math.max(0, ocean) });
      C = Math.max(PREINDUSTRIAL, C + (fossil + clear - land - ocean) / PPM_PER_GT);
    }
    return rows;
  }
  const ppmChange = row => (row.fossil + row.clear - row.land - row.ocean) / PPM_PER_GT;
  // Heat arrows in the greenhouse picture: how many of 6 are sent back down (1..6).
  const heatTrapped = C => clamp(Math.round(6 * (0.2 + 0.3 * Math.log2(Math.max(C, 1) / PREINDUSTRIAL))), 1, 6);
  // Settings the bog gets from "Test the bog in this year".
  function bogForYear(rows, year) {
    const row = rows[clamp(Math.round(year) - Y0, 0, rows.length - 1)];
    const arcticWarm = ARCTIC_AMPLIFICATION * (row.T - rows[0].T);
    return { co2: Math.round(row.C / 10) * 10, temp: clamp(Math.round(DEFAULTS.temp + arcticWarm), -5, 30), tilt: TILT_NOW };
  }

  /* ---------- recorded trials ---------- */
  // A trial stores only the inputs (and a label); every output is recomputed from them, so a table can never show a stale result.
  function trialOutputs(input) {
    const m = model(input), z = zombie(input, m);
    return { Teff: +m.T.toFixed(1), P: Math.round(m.P), D: Math.round(m.D), B: Math.round(m.B), perm: Math.round(m.perm * 100), N: Math.round(m.N), zc: z.chance, peatO2: +m.peatO2.toFixed(1) };
  }
  function autoLabel(input, source) {
    const s = sanitize(input);
    if (source === 'zombie') return 'Experiment D: Zombie fire';
    const names = { tilt: 'Earth’s tilt', temp: 'Temperature', co2: 'Carbon dioxide', o2: 'Oxygen', wet: 'Water level', burn: 'Burning' };
    const changed = Object.keys(names).filter(k => Math.abs(s[k] - DEFAULTS[k]) > 1e-6).map(k => names[k]);
    return changed.length ? 'Changed: ' + changed.join(' + ') : 'Starting values';
  }
  const TRIAL_COLUMNS = [
    { key: 'n', label: '#' }, { key: 'label', label: 'Label' },
    { key: 'tilt', label: 'Earth’s tilt (°)' }, { key: 'Teff', label: 'Summer temperature with tilt (°C)' }, { key: 'co2', label: 'Carbon dioxide (ppm)' },
    { key: 'o2', label: 'Oxygen in the air (%)' }, { key: 'wet', label: 'Water level in the bog (%)' }, { key: 'burn', label: 'Burning slider (%)' },
    { key: 'P', label: 'Photosynthesis (0–100, simulated)' }, { key: 'D', label: 'Decomposition (0–100, simulated)' }, { key: 'B', label: 'Burning rate (0–100, simulated)' },
    { key: 'perm', label: 'Permafrost (% frozen)' }, { key: 'N', label: 'Peat carbon (simulated)' }, { key: 'zc', label: 'Chance this fire survives the winter (%)' }
  ];
  // One display row for a trial (strings, ready for a table, CSV or copy).
  function trialRow(trial, n) {
    const s = sanitize(trial), o = trialOutputs(s);
    return { n: n, label: typeof trial.label === 'string' ? trial.label : '', tilt: s.tilt.toFixed(2), Teff: o.Teff.toFixed(1), co2: String(s.co2), o2: String(s.o2), wet: String(s.wet), burn: String(s.burn),
      P: String(o.P), D: String(o.D), B: String(o.B), perm: String(o.perm), N: (o.N > 0 ? '+' : '') + o.N, zc: String(o.zc) };
  }
  // Keep only well-formed trials from saved data (inputs clamped, label a short string, an id for stable editing).
  function cleanTrials(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(t => t && typeof t === 'object').slice(0, 500).map(function (t, i) {
      const s = sanitize(t);
      return Object.assign(s, { id: typeof t.id === 'number' && isFinite(t.id) ? t.id : i + 1, label: typeof t.label === 'string' ? t.label.slice(0, 60) : '', at: isNum(t.at) ? t.at : 0 });
    });
  }
  function csv(trials) {
    const q = v => { const t = String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const cols = TRIAL_COLUMNS.concat([{ key: 'src', label: 'Data source' }]);
    const lines = [cols.map(c => q(c.label)).join(',')];
    trials.forEach(function (t, i) { const r = trialRow(t, i + 1); r.src = 'Simulated (0-100 teaching scale, not measurements)'; lines.push(cols.map(c => q(r[c.key])).join(',')); });
    return lines.join('\r\n');
  }

  // Plain text for screen readers: the current bog in a few sentences.
  function describeBog(m) {
    const s = m.s;
    return 'Simulated bog cross-section. Water level ' + s.wet + ' percent, oxygen in the air ' + s.o2 + ' percent, burning ' + s.burn + ' percent. Photosynthesis ' + Math.round(m.P) +
      ', decomposition ' + Math.round(m.D) + ', burning ' + Math.round(m.B) + ' on a scale of 0 to 100. Peat carbon ' + (m.N > 0 ? 'plus ' : m.N < 0 ? 'minus ' : '') + Math.abs(Math.round(m.N)) +
      (verdict(m.N) === 'sink' ? ': a carbon sink.' : verdict(m.N) === 'source' ? ': carbon is released to the air.' : ': balanced.') +
      ' About ' + Math.round(m.perm * 100) + ' percent of the peat is frozen. ' + (m.B > 0.5 ? 'A fire is burning at the right side of the bog.' : 'No fire is burning.');
  }

  return { VARS, DEFAULTS, ZOMBIE_SETUP, PRESETS, TILT_PRESETS, SEASONS, LAT, TILT_NOW, Q_NOW, sanitize, same, solstice, tiltWarming, noonSun, arcticCircle, peatOxygen,
    model, verdict, zombie, ZOMBIE_FACTORS, ZOMBIE_WHY, weakestZombieFactor, seasonCaption, notes, exploreSeries,
    Y0, Y1, C0, PPM_PER_GT, PREINDUSTRIAL, ARCTIC_AMPLIFICATION, CLIMATE_VARS, sanitizeClimate, climate, ppmChange, heatTrapped, bogForYear,
    trialOutputs, autoLabel, TRIAL_COLUMNS, trialRow, cleanTrials, csv, describeBog };
}));
