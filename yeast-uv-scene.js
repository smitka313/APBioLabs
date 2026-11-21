/* Virtual yeast UV investigation (OpenSciEd B.3 Lesson 9 companion, host #yeast-uv-scene, scene id "yeast").
   A web stand-in for the class's physical test. EVERYTHING HERE IS SIMULATED: the dishes, the counts and the drawings are made by a
   small model from the student's Dataset ID, not measured from real yeast. Real UV labs need adult supervision; this page does not
   reproduce any wet-lab handling or safety steps.

   FLOW: set up the dishes from the plan (state.planner, or the class set) -> spread yeast -> switch on the UV lamp -> incubate in the dark
   for 3-5 simulated days (stored START TIMESTAMP, "skip ahead for class", reload resumes) -> look at the dishes, count colonies by tapping
   or "count for me" or a bracket, rate growth, fill the results table and the bar chart.

   MODEL (assumptions; the page's "What this simulation models" says the same in plain words):
   - Dose = lamp x minutes x transmittance, in "minutes of unprotected UV". The lamp is 1 unit per minute. Transmittance is 1 with no cover,
     about 1/SPF for sunscreen (SPF 30 passes about one thirtieth; the same cover and time always give the same dose, for either yeast),
     0 for foil, and a dark dish gets no UV at all.
   - Survival falls with dose as S = exp(-k x dose^0.63). The exponent below 1 makes the curve gentler at high doses, so one scale of dose
     covers both tests: a 5 to 30 minute exposure with no cover (dose 5 to 30) and sunscreen dishes at 15 minutes (dose 15/SPF, about 0.3 to 1).
     UV-sensitive yeast (no repair genes): k = 0.83, so about 44% survive dose 1 (SPF 15 for 15 min), about 68% survive dose 0.3 (SPF 50),
     about 10% survive 5 unprotected minutes and almost none survive 15.
     Wild-type yeast repair DNA: k = 0.08 after a small shoulder of 0.5, so covered dishes stay close to the dark dish and 15 unprotected
     minutes leave about 64%. Wild-type survival is always at least the sensitive survival.
     Calibrated so the lesson's pattern shows without exaggeration: no UV or foil is highest, more SPF means more colonies (SPF 15 and 18
     and 20 are close, as they are in life), and more time with no cover means fewer.
   - Colonies = Poisson(mean 200 x plating factor x S). Plating factor is lognormal (SD 7%): the dish-to-dish difference in how much suspension
     lands on the agar. Counts are whole numbers, never negative; zero is allowed (a long exposure of sensitive yeast).
   - Incubation: 3-5 days from the Dataset ID. One simulated day takes 20 real seconds. Colonies start to show after about a day and grow;
     with fewer colonies on a dish each one grows a bit bigger (less competition for food).
   - Simplified: real survival curves are noisier, real sunscreen layers are uneven, real colonies vary in shape and some merge.
     Yeast DNA repair genes are an analogy to p53, not p53. The data are simulated, not from a real experiment.
   Saved: api.saveState('yeast', { seed, startedAt, incubationDays, skipped, planSig, dishes:[{ group, strain, label, dose, colonies, rating,
   observation, ...}] }). Pure logic (model, layout, ratings, plan to dishes) is exported for node tests. */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.YeastUV = m; (root.B3InhScenes = root.B3InhScenes || []).push({ id: 'yeast', mount: m.mount }); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MODEL = { N0: 200, plateSD: 0.07, leakSD: 0, kSens: 0.83, kWild: 0.08, shoulderWild: 0.5, power: 0.63, dayMs: 20000, minDays: 3, maxDays: 5 };
  const num = x => typeof x === 'number' && isFinite(x);
  const BRACKETS = [{ id: 'b0', label: '0', lo: 0, hi: 0 }, { id: 'b1', label: '1–10', lo: 1, hi: 10 }, { id: 'b2', label: '11–50', lo: 11, hi: 50 }, { id: 'b3', label: '51–100', lo: 51, hi: 100 },
    { id: 'b4', label: '101–150', lo: 101, hi: 150 }, { id: 'b5', label: '151–200', lo: 151, hi: 200 }, { id: 'b6', label: '201 or more', lo: 201, hi: 250 }];
  const RATINGS = [['none', 'None'], ['few', 'Few'], ['some', 'Some'], ['many', 'Many']];
  const OBSERVATIONS = ['No colonies', 'A few separate colonies', 'Many separate colonies', 'Crowded, some touching'];

  function hash32(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function makeRng(seed) {
    let s = seed >>> 0;
    const uniform = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let spare = null;
    const normal = () => { if (spare != null) { const v = spare; spare = null; return v; } let u, v, q; do { u = uniform() * 2 - 1; v = uniform() * 2 - 1; q = u * u + v * v; } while (q === 0 || q >= 1); const f = Math.sqrt(-2 * Math.log(q) / q); spare = v * f; return u * f; };
    return { uniform, normal };
  }
  function poisson(rng, lambda) {
    if (!(lambda > 0)) return 0;
    if (lambda > 40) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * rng.normal()));
    const L = Math.exp(-lambda); let k = 0, p = 1;
    do { k++; p *= rng.uniform(); } while (p > L && k < 400);
    return k - 1;
  }

  /* ---------- model ---------- */
  const transmittance = (spec, leak) => spec.dark || spec.foil ? 0 : num(spec.spf) && spec.spf > 0 ? Math.min(1, (leak == null ? 1 : leak) / spec.spf) : 1;
  const doseFor = (spec, leak) => spec.dark ? 0 : Math.max(0, (num(spec.minutes) ? spec.minutes : 0) * transmittance(spec, leak));
  function survival(strain, dose) {
    const d = Math.max(0, num(dose) ? dose : 0);
    return strain === 'wild' ? Math.exp(-MODEL.kWild * Math.pow(Math.max(0, d - MODEL.shoulderWild), MODEL.power)) : Math.exp(-MODEL.kSens * Math.pow(d, MODEL.power));
  }
  const expectedColonies = (strain, spec) => MODEL.N0 * survival(strain, doseFor(spec, 1));
  const specKey = (s, rep) => [s.strain, s.spf || 0, s.foil ? 1 : 0, s.dark ? 1 : 0, s.minutes || 0, rep || 0].join('|');
  /* One dish: the same Dataset seed and the same set-up always give the same dish. */
  function simulateDish(seed, spec, rep) {
    const r = makeRng(hash32((seed >>> 0) + ':' + specKey(spec, rep)));
    const leak = Math.min(1.4, Math.max(0.7, 1 + MODEL.leakSD * r.normal())), plate = Math.exp(MODEL.plateSD * r.normal());
    const dose = Math.round(doseFor(spec, leak) * 100) / 100, S = survival(spec.strain, dose), expected = MODEL.N0 * plate * S;
    return { dose, survival: S, expected, truth: Math.max(0, poisson(r, expected)) };
  }
  const incubationDaysFor = seed => MODEL.minDays + Math.floor(makeRng(hash32((seed >>> 0) + ':days')).uniform() * (MODEL.maxDays - MODEL.minDays + 1));
  const ratingFor = n => !(n > 0) ? 'none' : n <= 25 ? 'few' : n <= 100 ? 'some' : 'many';
  const strainName = s => s === 'wild' ? 'wild-type' : 'UV-sensitive';

  /* The class set from the Teacher Edition (groups 1-7: no SPF, SPF 15/18/20/30/50, no SPF under foil, 15 min) plus the dark control. */
  function classSet() {
    const mk = (spf, foil, dark, minutes) => ({ spf, foil, dark, minutes });
    return [mk(null, false, true, 0), mk(null, false, false, 15), mk(15, false, false, 15), mk(18, false, false, 15), mk(20, false, false, 15), mk(30, false, false, 15), mk(50, false, false, 15), mk(null, true, false, 15)];
  }
  const coverText = c => c.dark ? 'Dark control' : (c.foil ? 'Foil cover' : c.spf ? 'SPF ' + c.spf : 'No sunscreen') + ', ' + c.minutes + ' min';
  /* Plan (state.planner) -> list of dishes. "Both" strains adds a wild-type copy of every planned dish, like the TE's parallel set. */
  function dishesFromPlan(planner) {
    let conds = planner && Array.isArray(planner.conditions) ? planner.conditions.filter(c => c && typeof c === 'object') : [];
    let fromPlan = conds.length > 0;
    if (!fromPlan) conds = classSet();
    const mode = fromPlan ? (planner.strainMode === 'wild' || planner.strainMode === 'both' ? planner.strainMode : 'sensitive') : 'sensitive';
    const base = conds.slice(0, 10).map((c, i) => ({ group: i + 1, spf: num(c.spf) && c.spf > 0 && !c.foil && !c.dark ? c.spf : null, foil: !!c.foil && !c.dark, dark: !!c.dark, minutes: c.dark ? 0 : (num(c.minutes) && c.minutes > 0 ? Math.min(120, c.minutes) : 15),
      predict: c.predict && c.predict.dir ? { dir: c.predict.dir, why: c.predict.why || '' } : null, group0: c.group }));
    const strains = mode === 'both' ? ['sensitive', 'wild'] : [mode === 'wild' ? 'wild' : 'sensitive'];
    const out = [], seen = {};
    strains.forEach(st => base.forEach(b => {
      const spec = Object.assign({}, b, { strain: st }), k0 = specKey(spec, 0).split('|').slice(0, 5).join('|'); seen[k0] = (seen[k0] || 0) + 1;
      spec.rep = seen[k0] - 1; spec.cond = coverText(spec); spec.label = spec.cond + ' · ' + strainName(st); spec.id = spec.group + (st === 'wild' ? 'W' : 'S');
      if (st === 'wild' && mode === 'both') spec.predict = null;
      out.push(spec);
    }));
    return { dishes: out, fromPlan, mode };
  }
  const planSig = list => list.map(d => d.id + ':' + d.spf + d.foil + d.dark + d.minutes).join(',');
  /* The direction the dish really went, relative to the comparison dish (for the prediction check). */
  function actualDirection(n, refN) { if (!num(n) || !num(refN)) return null; if (refN === 0) return n >= 3 ? 'more' : 'same'; const r = n / refN; return r > 1.25 ? 'more' : r < 0.8 ? 'fewer' : 'same'; }

  /* Colony positions on the agar (unit disc), seeded. Dart throwing so colonies sit apart, with some touching when crowded. */
  function layoutColonies(seed, n) {
    const r = makeRng(hash32((seed >>> 0) + ':layout')), out = [];
    const base = 0.03 * (1 + 0.7 * Math.max(0, 1 - n / 220));
    for (let i = 0; i < n; i++) {
      const rad = Math.min(0.075, Math.max(0.018, n === 1 ? 0.07 : base * Math.exp(0.22 * r.normal())));
      let x = 0, y = 0;
      for (let t = 0; t < 40; t++) {
        const a = r.uniform() * 6.2832, d = Math.sqrt(r.uniform()) * (0.93 - rad); x = Math.cos(a) * d; y = Math.sin(a) * d;
        let ok = true;
        for (let j = 0; j < out.length; j++) { const dx = out[j].x - x, dy = out[j].y - y, m = (out[j].r + rad) * 0.95; if (dx * dx + dy * dy < m * m) { ok = false; break; } }
        if (ok) break;
      }
      out.push({ x, y, r: rad, t0: 0.12 + r.uniform() * 0.4, tone: r.uniform(), lean: r.uniform() });
    }
    return out;
  }

  /* ---------- the scene ---------- */
  function mount(host, api) {
    const doc = host.ownerDocument || document, win = window;
    const canvas = host.querySelector('canvas'), desc = host.querySelector('.scene-desc');
    if (!canvas) throw new Error('yeast scene needs a canvas');
    if (!doc.getElementById('yeast-scene-css')) { const st = doc.createElement('style'); st.id = 'yeast-scene-css'; st.textContent = CSS; doc.head.appendChild(st); }
    const reduced = () => !!(win.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const seedNow = () => api.seed('yeast');
    let ys = null; // saved state when the lamp has been used
    const s0 = api.getState().yeast;
    if (s0 && num(s0.startedAt) && Array.isArray(s0.dishes) && s0.dishes.length && s0.dishes.every(d => d && typeof d === 'object' && d.group)) ys = JSON.parse(JSON.stringify(s0));
    if (ys) { ys.incubationDays = Math.min(MODEL.maxDays, Math.max(MODEL.minDays, Math.round(ys.incubationDays) || incubationDaysFor(ys.seed))); ys.dishes.forEach(d => { if (!num(d.truth)) { const sp = { strain: d.strain === 'wild' ? 'wild' : 'sensitive', spf: d.spf, foil: d.foil, dark: d.dark, minutes: d.minutes }; d.truth = simulateDish(ys.seed || seedNow(), sp, d.rep || 0).truth; } }); }
    let spread = !!ys, selected = 0, exposing = null, tickTimer = 0, finishedAnnounced = !!ys && isFinished(), confirmReset = false, announcedDay = 0;
    const marks = {}, layouts = {};
    let plan = dishesFromPlan(api.getState().planner);

    function h(tag, attrs, ...kids) {
      const e = doc.createElement(tag);
      Object.keys(attrs || {}).forEach(k => { if (k === 'text') e.textContent = attrs[k]; else if (attrs[k] === true) e.setAttribute(k, ''); else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]); });
      [].concat(...kids).forEach(x => { if (x != null) e.appendChild(typeof x === 'string' ? doc.createTextNode(x) : x); });
      return e;
    }
    const css = (n, f) => getComputedStyle(doc.documentElement).getPropertyValue(n).trim() || f;
    const ui = h('div', { class: 'yu-ui' });
    host.insertBefore(ui, desc || null);
    canvas.setAttribute('role', 'img');
    canvas.classList.add('yu-canvas');

    /* ----- time (stored timestamps, never timers) ----- */
    function elapsedDays() { return ys ? (Date.now() - ys.startedAt) / MODEL.dayMs : 0; }
    function isFinished() { return !!ys && (!!ys.skipped || elapsedDays() >= ys.incubationDays); }
    const growth = () => !ys ? 0 : isFinished() ? 1 : Math.min(1, Math.max(0, elapsedDays() / ys.incubationDays));
    const dayNow = () => ys ? Math.min(ys.incubationDays, Math.floor(Math.max(0, elapsedDays())) + 1) : 0;
    const secsLeft = () => ys ? Math.max(0, Math.ceil((ys.incubationDays - elapsedDays()) * MODEL.dayMs / 1000)) : 0;
    const stage = () => exposing ? 'exposing' : !ys ? 'setup' : isFinished() ? 'count' : 'incubate';

    function dishesNow() { return ys ? ys.dishes : plan.dishes.map(d => ({ group: d.group, strain: d.strain, label: d.label, spf: d.spf, foil: d.foil, dark: d.dark, minutes: d.minutes, id: d.id, rep: d.rep, cond: d.cond })); }
    const idOf = d => d.id || d.group + (d.strain === 'wild' ? 'W' : 'S');
    const nameOf = d => 'Dish ' + d.group + (d.strain === 'wild' ? ' (wild-type)' : '');
    function layoutFor(d) { const k = idOf(d); if (!layouts[k] || layouts[k].n !== d.truth) layouts[k] = { n: d.truth, list: layoutColonies((ys ? ys.seed : seedNow()) + hash32(k), d.truth) }; return layouts[k].list; }
    const counted = d => num(d.colonies);
    const nCounted = () => ys ? ys.dishes.filter(counted).length : 0;

    function save() { if (!ys) return; ys.updatedAt = Date.now(); api.saveState('yeast', JSON.parse(JSON.stringify(ys))); }

    /* ----- actions ----- */
    function startLamp() {
      const seed = seedNow(), list = plan.dishes, dishes = list.map(d => {
        const sim = simulateDish(seed, d, d.rep);
        const out = { group: d.group, strain: d.strain, label: d.label, dose: sim.dose, truth: sim.truth, spf: d.spf, foil: d.foil, dark: d.dark, minutes: d.minutes, rep: d.rep, id: d.id, cond: d.cond };
        if (d.predict) out.predict = d.predict;
        return out;
      });
      ys = { seed, startedAt: Date.now(), incubationDays: incubationDaysFor(seed), skipped: false, planSig: planSig(list), fromPlan: plan.fromPlan, dishes };
      selected = 0; finishedAnnounced = false; announcedDay = 1; confirmReset = false;
      if (!reduced()) exposing = { t0: performance.now(), dur: 2600 };
      save(); startTick(); render();
      api.announce('UV lamp on. Simulated yeast are now growing in the dark for ' + ys.incubationDays + ' days.');
      if (exposing) animateExposure();
    }
    function animateExposure() {
      const step = () => { if (!exposing) return; const p = (performance.now() - exposing.t0) / exposing.dur; if (p >= 1) { exposing = null; render(); return; } drawCanvas(); requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
    function skipAhead() { if (!ys || ys.skipped) return; ys.skipped = true; save(); api.announce('Skipped ahead. Incubation is finished. Time to count the colonies.'); finishedAnnounced = true; stopTick(); render(); }
    function startOver() {
      if (!confirmReset) { confirmReset = true; render('[data-yu="reset"]'); api.announce('Tap Start over again to erase these dishes.'); return; }
      ys = null; spread = false; exposing = null; confirmReset = false; selected = 0; stopTick();
      Object.keys(marks).forEach(k => delete marks[k]);
      api.saveState('yeast', null); plan = dishesFromPlan(api.getState().planner); render(); api.announce('Started over. Dishes cleared.');
    }
    function record(d, n, how) {
      d.colonies = Math.max(0, Math.round(n)); d.how = how; if (how !== 'estimate') delete d.bracket;
      if (!d.rating) { /* rating stays the student's choice */ }
      save(); render(); api.announce(nameOf(d) + ' recorded: ' + (how === 'estimate' ? 'about ' : '') + d.colonies + (d.colonies === 1 ? ' colony' : ' colonies') + '. ' + nCounted() + ' of ' + ys.dishes.length + ' dishes counted.');
    }

    /* ----- ticking ----- */
    function startTick() { stopTick(); if (!ys || isFinished()) return; tickTimer = setInterval(tick, 250); }
    function stopTick() { clearInterval(tickTimer); tickTimer = 0; }
    function tick() {
      if (!ys) return stopTick();
      if (isFinished()) { stopTick(); if (!finishedAnnounced) { finishedAnnounced = true; api.announce('Incubation finished after ' + ys.incubationDays + ' simulated days. Time to count the colonies.'); } render(); return; }
      const d = dayNow(); if (d !== announcedDay) { announcedDay = d; api.announce('Day ' + d + ' of ' + ys.incubationDays + '.'); }
      updateClock(); if (!reduced() || d !== lastDrawDay) { lastDrawDay = d; drawCanvas(); try { drawThumbs(); } catch (e) { /* ignore */ } }
    }
    let lastDrawDay = 0;

    /* ----- drawing ----- */
    function glassDish(ctx, cx, cy, r, bg) {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.32)'; ctx.shadowBlur = r * 0.2; ctx.shadowOffsetY = r * 0.08;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = 'rgba(235,242,246,.92)'; ctx.fill(); ctx.restore();
      const rim = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, r); rim.addColorStop(0, 'rgba(255,255,255,.2)'); rim.addColorStop(1, 'rgba(120,140,155,.55)');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = rim; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.025); ctx.strokeStyle = 'rgba(90,105,120,.8)'; ctx.stroke();
      const ar = r * 0.9, ag = ctx.createRadialGradient(cx - ar * 0.25, cy - ar * 0.3, ar * 0.1, cx, cy, ar);
      ag.addColorStop(0, '#f3e2b0'); ag.addColorStop(0.7, '#e6cd8d'); ag.addColorStop(1, '#d3b56c');
      ctx.beginPath(); ctx.arc(cx, cy, ar, 0, 7); ctx.fillStyle = ag; ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.03); ctx.strokeStyle = 'rgba(150,115,45,.55)'; ctx.stroke(); // meniscus ring
      ctx.beginPath(); ctx.arc(cx, cy, ar * 0.97, 3.5, 4.5); ctx.lineWidth = Math.max(1, r * 0.035); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke(); // window glint
      return ar;
    }
    function colony(ctx, x, y, rad, tone, detail) {
      if (rad < 1.1) { ctx.fillStyle = 'rgba(250,244,225,.95)'; ctx.fillRect(x - 0.6, y - 0.6, 1.3, 1.3); return; }
      ctx.fillStyle = 'rgba(80,55,15,.35)'; ctx.beginPath(); ctx.ellipse(x + rad * 0.2, y + rad * 0.28, rad * 1.05, rad * 0.95, 0, 0, 7); ctx.fill();
      if (detail && rad > 2.4) {
        const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
        g.addColorStop(0, tone > 0.5 ? '#fffaea' : '#fbf3d9'); g.addColorStop(0.65, tone > 0.5 ? '#efe2bd' : '#e9d9ae'); g.addColorStop(1, '#c9b583');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(120,98,52,.55)'; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x - rad * 0.33, y - rad * 0.38, rad * 0.26, rad * 0.16, -0.6, 0, 7); ctx.fill();
      } else { ctx.fillStyle = tone > 0.5 ? '#f1e6c4' : '#eadcb0'; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(120,98,52,.5)'; ctx.lineWidth = 0.5; ctx.stroke(); }
    }
    const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    function dishFull(ctx, cx, cy, r, d, t, opts) {
      opts = opts || {}; const ar = glassDish(ctx, cx, cy, r);
      if (opts.lawn) { ctx.beginPath(); ctx.arc(cx, cy, ar * 0.97, 0, 7); ctx.fillStyle = 'rgba(255,250,230,.18)'; ctx.fill(); }
      if (ys && d.truth > 0 && t > 0) {
        const L = layoutFor(d), m = marks[idOf(d)];
        for (let i = 0; i < L.length; i++) {
          const c = L[i], g = ease((t - c.t0 * 0.6) / (1 - c.t0 * 0.6)); if (g <= 0) continue;
          colony(ctx, cx + c.x * ar, cy + c.y * ar, Math.max(0.5, c.r * ar * g), c.tone, opts.detail);
        }
        if (m && opts.marks) m.forEach(i => { const c = L[i]; if (!c) return; const x = cx + c.x * ar, y = cy + c.y * ar, rr = Math.max(4, c.r * ar) + 3; ctx.lineWidth = 2.4; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, rr + 1.2, 0, 7); ctx.stroke(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#7a1d4f'; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.stroke(); });
      }
      return ar;
    }
    function setSize(w, hh) { const dpr = win.devicePixelRatio || 1; canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); canvas.style.aspectRatio = w + ' / ' + hh; canvas.style.minHeight = '0'; const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return ctx; }
    function badge(ctx, x, y, text, col) { ctx.font = '700 12px system-ui, sans-serif'; const w = ctx.measureText(text).width + 14; ctx.fillStyle = col.warnSoft; ctx.strokeStyle = col.warn; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(x, y, w, 22); ctx.fill(); ctx.stroke(); ctx.fillStyle = col.ink; ctx.textAlign = 'left'; ctx.fillText(text, x + 7, y + 15); }
    let layoutInfo = null;
    function drawCanvas() { try { drawCanvas0(); } catch (e) { fallback(); } }
    function fallback() { canvas.setAttribute('aria-label', 'SIMULATED virtual yeast dishes. The picture could not be drawn on this device; use the controls and the table.'); if (desc) desc.textContent = 'The picture could not be drawn on this device. The buttons and the results table still work. All data are simulated.'; }
    function drawCanvas0() {
      const w = Math.max(280, Math.floor(canvas.clientWidth || host.clientWidth || 640)), st = stage(), list = dishesNow();
      const col = { ink: css('--ink', '#14211c'), muted: css('--muted', '#56665f'), bg: css('--surface-2', '#e8eeea'), warn: css('--warn', '#9a5b00'), warnSoft: css('--warn-soft', '#fbedd5'), uv: css('--stain', '#a8326b') };
      let ctx, text;
      if (st === 'count' && list.length) {
        const d = list[Math.min(selected, list.length - 1)], size = Math.min(w, 420), hh = Math.round(size + 14);
        ctx = setSize(w, hh); ctx.fillStyle = col.bg; ctx.fillRect(0, 0, w, hh);
        const cx = w / 2, cy = hh / 2 + 6, r = size / 2 - 16; layoutInfo = { cx, cy, ar: r * 0.9, d };
        dishFull(ctx, cx, cy, r, d, 1, { detail: true, marks: true });
        badge(ctx, 10, 8, 'SIMULATED', col); ctx.fillStyle = col.ink; ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(nameOf(d), w - 12, 24);
        ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = col.muted; ctx.fillText(d.cond || d.label, w - 12, 41);
        const m = marks[idOf(d)]; if (m && m.size) { ctx.textAlign = 'left'; ctx.fillStyle = col.ink; ctx.font = '700 13px system-ui, sans-serif'; ctx.fillText('Marked: ' + m.size, 12, hh - 12); }
        text = 'Close-up of ' + nameOf(d) + ' (' + (d.cond || d.label) + '), simulated, after ' + ys.incubationDays + ' days. ' + (counted(d) ? 'You recorded ' + d.colonies + (d.colonies === 1 ? ' colony.' : ' colonies.') : 'Not counted yet.') + ' Colonies are round, cream-colored dots on amber agar.';
      } else {
        const n = list.length, cols = Math.max(1, Math.min(n, Math.floor(w / 96))), dd = Math.min(112, Math.floor((w - 16) / cols) - 10), r = dd / 2 * 0.88, cellH = dd + 46;
        const top = st === 'incubate' ? 44 : 86, rows = Math.max(1, Math.ceil(n / cols)), hh = top + rows * cellH + 10;
        ctx = setSize(w, hh); ctx.fillStyle = st === 'incubate' ? '#1d2430' : col.bg; ctx.fillRect(0, 0, w, hh);
        const light = st === 'incubate' ? '#dfe6ee' : col.ink, soft = st === 'incubate' ? '#aebccc' : col.muted;
        if (st !== 'incubate') { // lamp bar with glow while it is on
          const p = exposing ? Math.min(1, (performance.now() - exposing.t0) / exposing.dur) : 1;
          const g = ctx.createLinearGradient(0, 0, 0, 78); g.addColorStop(0, '#59616b'); g.addColorStop(1, '#2f353d'); ctx.fillStyle = g; ctx.fillRect(w * 0.06, 8, w * 0.88, 26);
          ctx.fillStyle = '#d7dde3'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('UV LAMP' + (exposing ? ' ON · ' + Math.round(p * 15) + ' of 15 min (simulated)' : ys ? ' · exposure done' : ' · off'), w / 2, 26);
          if (exposing) { const gl = ctx.createLinearGradient(0, 34, 0, 80); gl.addColorStop(0, 'rgba(150,80,230,.55)'); gl.addColorStop(1, 'rgba(150,80,230,0)'); ctx.fillStyle = gl; ctx.fillRect(w * 0.06, 34, w * 0.88, 46); }
        } else { ctx.fillStyle = soft; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('INCUBATOR · dark, room temperature', 12, 26); }
        list.forEach((d, i) => {
          const gx = i % cols, gy = Math.floor(i / cols), cx = (w - cols * (dd + 10)) / 2 + gx * (dd + 10) + (dd + 10) / 2, cy = top + gy * cellH + 6 + dd / 2;
          const ar = dishFull(ctx, cx, cy, r, d, st === 'incubate' ? growth() : 0, { lawn: spread || !!ys, detail: false });
          if (st !== 'incubate') overlay(ctx, cx, cy, ar, d, col);
          ctx.fillStyle = light; ctx.textAlign = 'center'; ctx.font = '700 12px system-ui, sans-serif'; ctx.fillText('Dish ' + d.group + (d.strain === 'wild' ? ' W' : ''), cx, cy + r + 16);
          ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = soft; ctx.fillText(d.dark ? 'dark' : d.foil ? 'foil' : d.spf ? 'SPF ' + d.spf : 'no cover', cx, cy + r + 30);
        });
        badge(ctx, w - 100, hh - 28, 'SIMULATED', col);
        if (list.some(x => x.strain === 'wild')) { ctx.fillStyle = soft; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('W = wild-type yeast', 12, hh - 12); }
        text = st === 'incubate' ? n + ' simulated dishes in a dark incubator, day ' + dayNow() + ' of ' + ys.incubationDays + '. Colonies are starting to show.' : n + ' dishes under a UV lamp' + (ys ? ' (exposure done)' : spread ? ' with yeast spread on them, ready for the lamp' : ', agar only so far') + ': ' + list.map(d => nameOf(d).toLowerCase() + ' ' + (d.dark ? 'in the dark' : d.foil ? 'under foil' : d.spf ? 'with SPF ' + d.spf : 'with no cover')).join('; ') + '.';
      }
      canvas.setAttribute('aria-label', 'SIMULATED virtual yeast dishes. ' + text);
      if (desc) desc.textContent = 'Text description (simulated): ' + text + (ys && counted0() ? ' ' + resultsSentence() : '');
    }
    const counted0 = () => nCounted() > 0;
    function resultsSentence() { return nCounted() + ' of ' + ys.dishes.length + ' dishes counted: ' + ys.dishes.filter(counted).map(d => nameOf(d).toLowerCase() + ', ' + d.colonies + (d.how === 'estimate' ? ' (estimate)' : '')).join('; ') + '.'; }
    function overlay(ctx, cx, cy, ar, d, col) { // cover over the dish during set-up and exposure
      if (d.dark) { ctx.beginPath(); ctx.arc(cx, cy, ar * 1.02, 0, 7); ctx.fillStyle = 'rgba(8,12,30,.84)'; ctx.fill(); ctx.fillStyle = '#e9edf7'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DARK BOX', cx, cy + 4); return; }
      if (d.foil) { const f = ctx.createLinearGradient(cx - ar, cy - ar, cx + ar, cy + ar); f.addColorStop(0, '#f4f6f8'); f.addColorStop(0.5, '#aeb6bf'); f.addColorStop(1, '#e8ecef'); ctx.beginPath(); ctx.arc(cx, cy, ar * 1.02, 0, 7); ctx.fillStyle = f; ctx.fill(); ctx.strokeStyle = 'rgba(70,80,90,.55)'; ctx.lineWidth = 1; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(cx - ar * 0.8 + k * ar * 0.3, cy - ar * 0.7); ctx.lineTo(cx - ar * 0.55 + k * ar * 0.22, cy + ar * 0.7); ctx.stroke(); } ctx.fillStyle = '#26303a'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FOIL', cx, cy + 4); return; }
      if (d.spf) { ctx.beginPath(); ctx.arc(cx, cy, ar * 0.97, 0, 7); ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + Math.min(0.35, d.spf / 140)) + ')'; ctx.fill(); ctx.fillStyle = '#2a2415'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SPF ' + d.spf, cx, cy + 4); }
      if (exposing) { ctx.strokeStyle = col.uv; ctx.lineWidth = 2; const a = 0.5 + 0.5 * Math.sin(performance.now() / 120); ctx.globalAlpha = 0.35 + 0.5 * a; for (const k of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(cx + k * ar, cy - ar - 16); ctx.lineTo(cx + k * ar, cy - ar - 4); ctx.stroke(); } ctx.globalAlpha = 1; }
    }

    /* ----- thumbnails ----- */
    function thumb(d, i) {
      const b = h('button', { type: 'button', class: 'yu-thumb' + (i === selected ? ' is-sel' : ''), 'data-yu': 'thumb', 'data-i': String(i), 'aria-pressed': i === selected ? 'true' : 'false',
        'aria-label': nameOf(d) + ', ' + (d.cond || d.label) + (counted(d) ? ': counted ' + d.colonies + ' colonies' : ': not counted yet') });
      const c = h('canvas', { width: 64, height: 64, 'aria-hidden': 'true' }); b.appendChild(c);
      b.appendChild(h('span', { class: 'yu-tn', text: 'Dish ' + d.group + (d.strain === 'wild' ? ' W' : '') }));
      b.appendChild(h('span', { class: 'yu-ts', text: counted(d) ? '✓ ' + (d.how === 'estimate' ? '≈' : '') + d.colonies : 'to count' }));
      b.addEventListener('click', () => { selected = i; render('[data-yu="thumb"][data-i="' + i + '"]'); });
      b.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = ys.dishes.length; selected = (i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n; render('[data-yu="thumb"][data-i="' + selected + '"]'); } });
      return b;
    }
    function drawThumbs() {
      ui.querySelectorAll('.yu-thumb canvas').forEach((c, i) => {
        const list = ys ? ys.dishes : []; const d = list[i]; if (!d) return;
        const dpr = win.devicePixelRatio || 1; c.width = Math.round(64 * dpr); c.height = Math.round(64 * dpr); const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dishFull(ctx, 32, 32, 29, d, growth(), { detail: false });
      });
    }

    /* ----- UI ----- */
    function updateClock() {
      const clock = ui.querySelector('[data-yu="clock"]'), bar = ui.querySelector('[data-yu="bar"]'); if (!clock || !ys) return;
      clock.textContent = 'Day ' + dayNow() + ' of ' + ys.incubationDays + ' (simulated) · about ' + secsLeft() + ' s left';
      const p = Math.round(growth() * 100); if (bar) { bar.setAttribute('aria-valuenow', String(p)); bar.firstChild.style.width = p + '%'; }
    }
    function render(focusSel) {
      const keep = focusSel || (doc.activeElement && ui.contains(doc.activeElement) ? sel(doc.activeElement) : '');
      const sy = (doc.scrollingElement || doc.documentElement).scrollTop;
      ui.textContent = '';
      const st = stage();
      ui.appendChild(h('p', { class: 'yu-sim', text: 'SIMULATED. This is a model, not a real lab or real yeast. Real UV labs need adult supervision.' }));
      if (st === 'setup' || st === 'exposing') setupPanel(st);
      else if (st === 'incubate') incubatePanel();
      else countPanel();
      ui.appendChild(h('p', { class: 'yu-note' }, h('strong', { text: 'About the model: ' }), 'Yeast DNA repair genes are an analogy to p53, not p53 itself. The counts are simulated from your Dataset ID, so they are not from a real experiment. Cancer is not inevitable and this says nothing about any person.'));
      if (keep) { const t = ui.querySelector(keep); if (t && !t.disabled) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } } }
      const s = doc.scrollingElement || doc.documentElement; if (Math.abs(s.scrollTop - sy) > 2) s.scrollTop = sy;
      drawCanvas(); try { drawThumbs(); } catch (e) { /* thumbnails are decoration */ } updateClock();
    }
    function sel(e) { const y = e.getAttribute('data-yu'); if (!y) return ''; const i = e.getAttribute('data-i'), k = e.getAttribute('data-k'); return '[data-yu="' + y + '"]' + (i != null ? '[data-i="' + i + '"]' : '') + (k != null ? '[data-k="' + k + '"]' : ''); }
    function setupPanel(st) {
      const n = plan.dishes.length;
      ui.appendChild(h('p', { class: 'yu-step', text: plan.fromPlan ? 'Your plan from the step above: ' + n + ' dishes.' : 'No plan yet, so these are the class dishes (' + n + '). Make your own plan in the step above if you like.' }));
      const a = h('button', { type: 'button', class: 'btn yu-btn', 'data-yu': 'spread', text: spread ? '✓ Yeast spread on every dish' : '1 · Spread yeast on every dish' }); a.disabled = spread || st === 'exposing';
      a.addEventListener('click', () => { spread = true; render('[data-yu="lamp"]'); api.announce('Simulated yeast spread on all ' + n + ' dishes.'); });
      const b = h('button', { type: 'button', class: 'btn btn--primary yu-btn', 'data-yu': 'lamp', text: st === 'exposing' ? 'UV lamp is on…' : '2 · Switch on the UV lamp' }); b.disabled = !spread || st === 'exposing' || n < 1;
      b.addEventListener('click', startLamp);
      ui.appendChild(h('div', { class: 'yu-actions' }, a, b));
      ui.appendChild(h('p', { class: 'yu-muted', text: 'The lamp runs each dish for its planned time (15 minutes in the class set). Foil and the dark box block the UV. Then the dishes grow in the dark for 3 to 5 simulated days.' }));
    }
    function incubatePanel() {
      ui.appendChild(h('div', { class: 'yu-clockbox' }, h('strong', { 'data-yu': 'clock', class: 'yu-clock', text: '' }),
        h('div', { class: 'yu-bar', role: 'progressbar', 'data-yu': 'bar', 'aria-label': 'Incubation progress', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, h('span'))));
      const skip = h('button', { type: 'button', class: 'btn yu-btn', 'data-yu': 'skip', text: 'Skip ahead for class' }); skip.addEventListener('click', skipAhead);
      ui.appendChild(h('div', { class: 'yu-actions' }, skip, resetButton()));
      ui.appendChild(h('p', { class: 'yu-muted', text: 'The yeast grow in the dark. One simulated day takes 20 seconds. You can leave and come back: the clock keeps going.' }));
      planNote();
      const strip = h('div', { class: 'yu-thumbs', role: 'group', 'aria-label': 'Dishes in the incubator' }); ys.dishes.forEach((d, i) => strip.appendChild(thumb(d, i))); ui.appendChild(strip);
    }
    function resetButton() { const b = h('button', { type: 'button', class: 'btn btn--ghost yu-btn', 'data-yu': 'reset', text: confirmReset ? 'Tap again to erase these dishes' : 'Start over' }); b.addEventListener('click', startOver); return b; }
    function planNote() { if (ys && planSig(plan.dishes) !== ys.planSig) ui.appendChild(h('p', { class: 'yu-warn', text: 'Your plan changed after these dishes were made. Tap Start over to use the new plan.' })); }
    function countPanel() {
      const d = ys.dishes[Math.min(selected, ys.dishes.length - 1)];
      ui.appendChild(h('p', { class: 'yu-step', text: '✓ Incubation done after ' + ys.incubationDays + ' simulated days. Pick a dish, then count.' }));
      planNote();
      const strip = h('div', { class: 'yu-thumbs', role: 'group', 'aria-label': 'Dishes. Use the left and right arrow keys to move between dishes.' }); ys.dishes.forEach((x, i) => strip.appendChild(thumb(x, i))); ui.appendChild(strip);
      const m = marks[idOf(d)] || (marks[idOf(d)] = new Set());
      const box = h('div', { class: 'yu-panel panel' });
      box.appendChild(h('h4', { text: nameOf(d) + ': ' + (d.cond || d.label) }));
      box.appendChild(h('p', { class: 'yu-muted', text: 'Tap each colony on the dish to mark it. Or use the buttons for a quick count.' }));
      const cnt = h('div', { class: 'yu-count' }, h('span', { class: 'yu-big', 'data-yu': 'marked', text: String(m.size) }), h('span', { text: m.size === 1 ? ' colony marked' : ' colonies marked' }));
      const st = (label, delta, k) => { const b = h('button', { type: 'button', class: 'btn btn--sm yu-btn', 'data-yu': 'step', 'data-k': k, 'aria-label': (delta > 0 ? 'Add ' : 'Remove ') + Math.abs(delta) + ' to the count', text: label }); b.addEventListener('click', () => adjust(d, delta, '[data-yu="step"][data-k="' + k + '"]')); return b; };
      const tools = h('div', { class: 'yu-actions' }, st('−10', -10, 'm10'), st('−1', -1, 'm1'), st('+1', 1, 'p1'), st('+10', 10, 'p10'));
      const undo = h('button', { type: 'button', class: 'btn btn--sm yu-btn', 'data-yu': 'clear', text: 'Clear marks' }); undo.addEventListener('click', () => { m.clear(); render('[data-yu="clear"]'); });
      const auto = h('button', { type: 'button', class: 'btn btn--sm yu-btn', 'data-yu': 'auto', text: 'Count for me' }); auto.addEventListener('click', () => { layoutFor(d).forEach((c, i) => m.add(i)); record(d, d.truth, 'auto'); });
      const rec = h('button', { type: 'button', class: 'btn btn--primary yu-btn', 'data-yu': 'record', text: 'Record ' + m.size + (m.size === 1 ? ' colony' : ' colonies') }); rec.addEventListener('click', () => record(d, m.size, 'tap'));
      tools.appendChild(undo); tools.appendChild(auto);
      box.appendChild(cnt); box.appendChild(tools); box.appendChild(h('div', { class: 'yu-actions' }, rec));
      const br = h('div', { class: 'yu-chips', role: 'group', 'aria-label': 'Or estimate with a count range' }, h('span', { class: 'yu-legend', text: 'Or estimate' }));
      BRACKETS.forEach(b => { const on = d.how === 'estimate' && d.bracket === b.id; const x = h('button', { type: 'button', class: 'yu-chip', 'aria-pressed': on ? 'true' : 'false', 'data-yu': 'bracket', 'data-k': b.id }, h('span', { class: 'yu-tick', 'aria-hidden': 'true', text: on ? '✓' : '' }), b.label);
        x.addEventListener('click', () => { d.bracket = b.id; record(d, Math.round((b.lo + b.hi) / 2), 'estimate'); }); br.appendChild(x); });
      box.appendChild(br);
      const rg = h('div', { class: 'yu-chips', role: 'group', 'aria-label': 'How much grew?' }, h('span', { class: 'yu-legend', text: 'How much grew?' }));
      RATINGS.forEach(r => { const on = d.rating === r[0]; const x = h('button', { type: 'button', class: 'yu-chip', 'aria-pressed': on ? 'true' : 'false', 'data-yu': 'rating', 'data-k': r[0] }, h('span', { class: 'yu-tick', 'aria-hidden': 'true', text: on ? '✓' : '' }), r[1]);
        x.addEventListener('click', () => { d.rating = on ? '' : r[0]; if (!d.rating) delete d.rating; save(); render('[data-yu="rating"][data-k="' + r[0] + '"]'); }); rg.appendChild(x); });
      box.appendChild(rg);
      if (counted(d) && d.rating && d.rating !== ratingFor(d.colonies)) box.appendChild(h('p', { class: 'yu-warn', text: 'Hmm: ' + d.colonies + (d.colonies === 1 ? ' colony is' : ' colonies is') + ' usually “' + ratingFor(d.colonies) + '”. Change your rating or count again.' }));
      else if (counted(d) && d.rating) box.appendChild(h('p', { class: 'yu-ok', text: '✓ Your rating fits your count.' }));
      const og = h('div', { class: 'yu-chips', role: 'group', 'aria-label': 'What do you see?' }, h('span', { class: 'yu-legend', text: 'What do you see?' }));
      OBSERVATIONS.forEach((o, k) => { const on = d.observation === o; const x = h('button', { type: 'button', class: 'yu-chip', 'aria-pressed': on ? 'true' : 'false', 'data-yu': 'obs', 'data-k': 'o' + k }, h('span', { class: 'yu-tick', 'aria-hidden': 'true', text: on ? '✓' : '' }), o);
        x.addEventListener('click', () => { d.observation = on ? '' : o; if (!d.observation) delete d.observation; save(); render('[data-yu="obs"][data-k="o' + k + '"]'); }); og.appendChild(x); });
      box.appendChild(og);
      const all = h('button', { type: 'button', class: 'btn btn--sm yu-btn', 'data-yu': 'autoall', text: 'Count all dishes for me' }); all.addEventListener('click', () => { ys.dishes.forEach(x => { if (!counted(x)) { x.colonies = x.truth; x.how = 'auto'; } }); save(); render('[data-yu="autoall"]'); api.announce('All dishes counted for you. ' + ys.dishes.length + ' of ' + ys.dishes.length + '.'); });
      box.appendChild(h('div', { class: 'yu-actions' }, all, resetButton()));
      ui.appendChild(box);
      resultsPanel();
    }
    function adjust(d, delta, focusSel) {
      const m = marks[idOf(d)] || (marks[idOf(d)] = new Set()), L = layoutFor(d);
      if (delta > 0) { for (let i = 0; i < L.length && delta > 0; i++) if (!m.has(i)) { m.add(i); delta--; } }
      else { const a = Array.from(m); while (delta < 0 && a.length) { m.delete(a.pop()); delta++; } }
      render(focusSel);
    }
    function resultsPanel() {
      const rows = ys.dishes;
      const wrap = h('div', { class: 'yu-results' });
      wrap.appendChild(h('h4', { text: 'Results: simulated dishes' }));
      const tw = h('div', { class: 'table-wrap', role: 'region', tabindex: '0', 'aria-label': 'Data collection table (simulated). Scrolls sideways on narrow screens.' }), t = h('table', { class: 'data yu-table' });
      // Focusable from the first frame: the shared table watcher only adds this after it has measured the table (a frame later),
      // and a scrollable region that cannot take keyboard focus is an accessibility failure in that gap. The watcher removes
      // tabindex again if the table turns out not to scroll.
      t.appendChild(h('caption', { text: 'Data collection table (simulated). ' + nCounted() + ' of ' + rows.length + ' dishes counted.' }));
      t.appendChild(h('thead', {}, h('tr', {}, ['Dish', 'Condition', 'UV dose*', 'Colonies', 'Growth', 'Prediction'].map(x => h('th', { scope: 'col', text: x })))));
      const tb = h('tbody');
      rows.forEach(d => {
        let pred = '—';
        const ref = refDish(rows, d.strain);
        if (d.predict && d.predict.dir && counted(d) && ref && counted(ref) && d !== ref) { const act = actualDirection(d.colonies, ref.colonies); pred = act === d.predict.dir ? '✓ matched' : '✕ differed (' + act + ')'; }
        tb.appendChild(h('tr', {}, h('th', { scope: 'row', text: nameOf(d) }), h('td', { text: d.cond || d.label }), h('td', { text: (num(d.dose) ? d.dose : 0).toFixed(d.dose < 10 ? 2 : 1) }),
          h('td', { text: counted(d) ? (d.how === 'estimate' ? '≈ ' : '') + d.colonies : 'not counted' }), h('td', { text: d.rating ? (RATINGS.find(r => r[0] === d.rating) || ['', d.rating])[1] : '—' }), h('td', { text: pred })));
      });
      t.appendChild(tb); tw.appendChild(t); wrap.appendChild(tw);
      wrap.appendChild(h('p', { class: 'yu-muted', text: '*UV dose in minutes of unprotected lamp UV that would give the same dose. Simulated numbers, not measurements.' }));
      const fig = h('figure', { class: 'yu-fig' }, h('div', { class: 'yu-chart', 'data-yu': 'chart' }), h('figcaption', { class: 'yu-muted', text: 'Bar chart of the table above (simulated). Bars show colonies counted; if you repeated a dish, the bar is the average with the range.' }));
      wrap.appendChild(fig); ui.appendChild(wrap);
      if (win.Lab && Lab.tableFit) Lab.tableFit.scan();
      if (win.Lab && Lab.chart) {
        const data = chartData(rows);
        try { Lab.chart(fig.firstChild, { type: 'bar', responsive: true, xLabel: 'Dish condition', yLabel: 'Colonies counted (simulated)', yMin: 0, categories: data.cats, series: data.series }); } catch (e) { fig.firstChild.textContent = 'The chart could not be drawn. The table above has every number.'; }
      }
    }
    const refDish = (rows, strain) => rows.filter(d => !d.dark && !d.foil && !d.spf && d.strain === strain).sort((a, b) => b.minutes - a.minutes)[0] || null;
    function chartData(rows) {
      const tv = new Set(rows.filter(d => !d.dark).map(d => d.minutes)).size > 1;
      const cl = d => d.dark ? 'Dark' : (d.foil ? 'Foil' : d.spf ? 'SPF ' + d.spf : 'No cover') + (tv ? ' ' + d.minutes + 'm' : '');
      const cats = []; rows.forEach(d => { if (counted(d) && !cats.includes(cl(d))) cats.push(cl(d)); });
      const series = ['sensitive', 'wild'].map(s => {
        const pts = [];
        cats.forEach(c => { const v = rows.filter(d => d.strain === s && cl(d) === c && counted(d)).map(d => d.colonies); if (!v.length) return; const mean = v.reduce((a, b) => a + b, 0) / v.length; pts.push({ x: c, y: Math.round(mean * 10) / 10, err: v.length > 1 ? (Math.max.apply(null, v) - Math.min.apply(null, v)) / 2 : 0 }); });
        return { name: strainName(s), points: pts };
      }).filter(s => s.points.length);
      return { cats, series };
    }

    /* tapping the big dish marks the nearest colony */
    canvas.addEventListener('pointerdown', ev => {
      if (stage() !== 'count' || !layoutInfo) return;
      const rect = canvas.getBoundingClientRect(), sx = rect.width / (canvas.width / (win.devicePixelRatio || 1)), x = (ev.clientX - rect.left) / sx, y = (ev.clientY - rect.top) / sx;
      const d = layoutInfo.d, L = layoutFor(d); let best = -1, bd = 1e9;
      for (let i = 0; i < L.length; i++) { const cx = layoutInfo.cx + L[i].x * layoutInfo.ar, cy = layoutInfo.cy + L[i].y * layoutInfo.ar, dd = Math.hypot(cx - x, cy - y) - L[i].r * layoutInfo.ar; if (dd < bd) { bd = dd; best = i; } }
      if (best < 0 || bd > 10) return;
      const m = marks[idOf(d)] || (marks[idOf(d)] = new Set()); if (m.has(best)) m.delete(best); else m.add(best);
      const el = ui.querySelector('[data-yu="marked"]'); if (el) { el.textContent = String(m.size); el.nextSibling.textContent = m.size === 1 ? ' colony marked' : ' colonies marked'; }
      const rec = ui.querySelector('[data-yu="record"]'); if (rec) rec.textContent = 'Record ' + m.size + (m.size === 1 ? ' colony' : ' colonies');
      drawCanvas();
    });

    // keep the dishes in step with the plan until the lamp is used, and redraw on size or theme change
    doc.addEventListener('b3:planner-changed', () => { if (!ys) { plan = dishesFromPlan(api.getState().planner); if (!exposing) { spread = false; render(); } } else { const n = ui.querySelector('.yu-warn'); if (!n) { render(); } } });
    let raf = 0; const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { drawCanvas(); try { drawThumbs(); } catch (e) { /* ignore */ } }); };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(redraw).observe(canvas.parentElement || host);
    win.addEventListener('resize', redraw, { passive: true }); doc.addEventListener('companion:show', redraw);
    new MutationObserver(redraw).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (win.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', redraw); }
    doc.addEventListener('visibilitychange', () => { if (!doc.hidden && ys) { if (isFinished()) tick(); else render(); } });
    render(); startTick();
  }

  const CSS = '.yu-ui{display:grid;gap:12px}.yu-sim{margin:0;padding:8px 12px;border-left:4px solid var(--warn);background:var(--warn-soft);border-radius:0 var(--r-sm) var(--r-sm) 0;font-weight:700}' +
    '.yu-step{margin:0;font-weight:700}.yu-muted{margin:0;color:var(--muted);font-size:.9rem}.yu-note{margin:0;font-size:.88rem;color:var(--muted)}.yu-note strong{color:var(--ink)}.yu-warn{margin:0;color:var(--warn);font-weight:700}.yu-ok{margin:0;color:var(--ok);font-weight:700}' +
    '.yu-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.yu-btn{min-height:44px;justify-content:center}.btn--sm.yu-btn{min-height:40px;min-width:44px}' +
    '.yu-clockbox{display:grid;gap:6px;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}.yu-clock{font-size:1.05rem}.yu-bar{height:12px;border-radius:6px;background:var(--surface-2);border:1px solid var(--line);overflow:hidden}.yu-bar span{display:block;height:100%;width:0;background:var(--accent)}' +
    '.yu-thumbs{display:flex;flex-wrap:wrap;gap:8px}.yu-thumb{display:grid;justify-items:center;gap:1px;padding:5px 6px;min-width:76px;border:2px solid var(--line);border-radius:var(--r-sm);background:var(--surface);color:var(--ink);cursor:pointer;font:inherit}' +
    '.scene-host .yu-thumb canvas{width:56px;height:56px;aspect-ratio:1/1;min-height:0;border:0;border-radius:50%;background:transparent}.yu-thumb.is-sel{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}.yu-thumb[aria-pressed=true] .yu-tn::before{content:"▸ "}.yu-tn{font-size:.78rem;font-weight:700}.yu-ts{font-size:.76rem;color:var(--muted)}' +
    '.yu-panel{display:grid;gap:10px}.yu-panel h4{margin:0}.yu-count{display:flex;align-items:baseline;gap:6px}.yu-big{font:700 1.8rem var(--f-mono)}' +
    '.yu-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.yu-legend{font-weight:700;margin-right:4px}.yu-chip{font:inherit;font-weight:600;font-size:.88rem;min-height:36px;min-width:44px;padding:4px 12px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;gap:6px}' +
    '.yu-chip:hover{border-color:var(--accent)}.yu-chip[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.yu-tick{display:inline-block;min-width:.9em;color:var(--accent);font-weight:800}' +
    '.yu-results{display:grid;gap:8px}.yu-results h4{margin:0}.yu-table th,.yu-table td{white-space:normal;text-align:left}.yu-fig{margin:0;display:grid;gap:6px}.yu-chart{max-width:100%}' +
    '.scene-host canvas.yu-canvas{touch-action:pan-y;cursor:default}@media(max-width:560px){.yu-actions .btn{flex:1 1 auto}.yu-table{font-size:.82rem}.yu-table th,.yu-table td{padding:5px 4px}.yu-thumb{min-width:68px}}';

  return { MODEL, BRACKETS, RATINGS, OBSERVATIONS, hash32, makeRng, poisson, transmittance, doseFor, survival, expectedColonies, specKey, simulateDish, incubationDaysFor, ratingFor, classSet, coverText, dishesFromPlan, planSig, actualDirection, layoutColonies, mount };
});
