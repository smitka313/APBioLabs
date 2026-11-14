/* AP Bio Digital Lab Bench — shared toolkit. Exposes window.Lab.
   No dependencies. Every API is documented in KIT.md. */
(function () {
  'use strict';
  const Lab = {};
  let LAB_ID = 'lab';

  /* ---------------- Page context ----------------
     Detected from the filename (lab07.html → lab07, teacher-lab07.html → teacher page, index.html → home),
     with the <title> as a fallback for hosts that rename files. */
  const FILE = (function () { try { return decodeURIComponent((location.pathname || '').split('/').pop() || '').toLowerCase(); } catch (e) { return ''; } })();
  const PAGE = (function () {
    let m; const t = document.title || '';
    if ((m = FILE.match(/^(teacher-lab\d\d)\.html?$/))) return { kind: 'teacher', id: m[1] };
    if ((m = FILE.match(/^(lab\d\d)\.html?$/))) return { kind: 'lab', id: m[1] };
    if (FILE === '' || /^index\.html?$/.test(FILE)) return { kind: 'home', id: 'home' };
    if (/^teachers\.html?$/.test(FILE) || /^For teachers/i.test(t)) return { kind: 'info', id: 'teachers' }; // public information page: no sign-in, no report tools, no tour, no backup prompts
    if (/^404\.html?$/.test(FILE) || /^Page not found/i.test(t)) return { kind: 'info', id: 'not-found' }; // 404.html is served from any path, so the title is the reliable signal
    if ((m = t.match(/^Lab (\d+) Teacher Notes/i))) return { kind: 'teacher', id: 'teacher-lab' + m[1].padStart(2, '0') };
    if ((m = t.match(/^Lab (\d+) ·/))) return { kind: 'lab', id: 'lab' + m[1].padStart(2, '0') };
    if (/^AP Bio (Digital )?Lab Bench/.test(t)) return { kind: 'home', id: 'home' };
    return { kind: 'other', id: FILE.replace(/\.html?$/, '') || 'page' };
  })();
  if (PAGE.kind === 'lab' || PAGE.kind === 'teacher') LAB_ID = PAGE.id;
  const IS_LAB = PAGE.kind === 'lab';
  Lab.page = PAGE;

  /* A transfer link looks like <lab>.html#resume=<code>. Take the code out of the address bar right away (before any
     part routing reads the hash), keep it in memory, and offer to restore it once the page is built (see handleResumeHash). */
  const RESUME_HASH = (function () {
    const m = /^#resume=([A-Za-z0-9._-]+)$/.exec(location.hash || '');
    if (!m) return null;
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* some file:// contexts */ }
    return m[1];
  })();

  /* Storage health: set when any localStorage write throws (private window, blocked site data). See "Onboarding". */
  var storageBad = false;
  /* Set while the page is being wiped (sign out, start over): nothing may write back before the reload. */
  var wiped = false;
  function storageFailed() { if (storageBad) return; storageBad = true; setTimeout(function () { if (Lab._storageWarn) Lab._storageWarn(); }, 0); }

  /* Site-wide storage (not namespaced to one lab): identity, dataset numbers, progress summaries. */
  const gstore = {
    get(key, fallback = null) { try { const v = localStorage.getItem('aplab:' + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(key, val) { if (wiped) return true; try { localStorage.setItem('aplab:' + key, JSON.stringify(val)); return true; } catch (e) { storageFailed(); return false; } },
  };
  Lab.globalStore = gstore;

  /* ---------------- Student identity + per-student seeded randomness ----------------
     One identity for the whole site: localStorage 'aplab:student' = {name, period}.
     On a student lab page, Math.random and unseeded Lab.rng() are seeded from
     hash(name | period | lab id | dataset number), so each student gets unique, repeatable data. */
  function hash32(str) { // cyrb53, folded to 32 bits
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }
  function mulberry32(a) {
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const CODE_ABC = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L
  function datasetCode(n) { let s = ''; for (let i = 0; i < 6; i++) { s += CODE_ABC[n % 31]; n = Math.floor(n / 31); } return s.slice(0, 3) + '-' + s.slice(3); }
  const nativeRandom = Math.random.bind(Math);
  const normName = s => String(s == null ? '' : s).normalize('NFKC').trim().replace(/\s+/g, ' ');
  const PERIODS = ['1', '2', '3', '4', '5', '6', '7', '8', 'Other'];
  let memIdentity = null; // used only when localStorage is blocked
  function storedIdentity() {
    if (memIdentity) return memIdentity;
    const v = gstore.get('student');
    return v && normName(v.name) ? { name: normName(v.name), period: String(v.period || '') } : null;
  }
  function legacyName() { // the old per-lab "Your name" field
    try { const v = localStorage.getItem(`aplab:${PAGE.id}:field:student-name`); return v ? normName(JSON.parse(v)) : ''; } catch (e) { return ''; }
  }
  /* Identity used for seeding and reports: the site-wide one, else the old per-lab name. */
  function effectiveIdentity() { const s = storedIdentity(); if (s) return s; const l = IS_LAB ? legacyName() : ''; return l ? { name: l, period: '', legacy: true } : null; }
  const studentKey = idn => normName(idn.name).toLowerCase() + '|' + (idn.period || '');
  const dsKey = idn => `dataset:${PAGE.id}:${studentKey(idn)}`;
  const datasetNo = idn => (idn && +gstore.get(dsKey(idn))) || 1;
  /* The seed and Dataset ID are computed once per student and lab, then stored (aplab:<lab>:dataset) and reused until the
     student chooses "New dataset" (the stored record is dropped and the dataset number goes up), Start over or Sign out.
     Why IDs used to flip: they were recomputed on every page load from name | period | lab | dataset number. Any change to
     one of those inputs gave a new ID with no warning: filling in or correcting the class period (the dataset number is
     stored per name + period, so it fell back to 1), fixing a typo or capital letter in the name, signing in after
     starting as an anonymous visitor, or a progress file restored under a slightly different name. Nothing in the hash itself
     changed between deploys. Storing the first result makes the ID independent of all of that. */
  const DS_STORE = `aplab:${PAGE.id}:dataset`;
  function readStoredDataset() {
    try {
      const v = JSON.parse(localStorage.getItem(DS_STORE));
      if (v && typeof v === 'object' && Number.isFinite(v.seed) && typeof v.str === 'string' && /^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/.test(v.datasetId) && Number.isFinite(+v.datasetNumber)) return v;
    } catch (e) { /* missing or damaged: compute a new one */ }
    return null;
  }
  const SEED = (function () {
    const idn = effectiveIdentity();
    if (IS_LAB) { const st = readStoredDataset(); if (st) return { seed: st.seed >>> 0, str: st.str, basis: st.basis || '', datasetNumber: Math.floor(+st.datasetNumber) || 1, datasetId: st.datasetId, student: !!idn, sticky: true }; }
    let basis;
    if (idn) basis = studentKey(idn);
    else {
      let a = gstore.get('anon');
      if (!a) { a = Math.floor(nativeRandom() * 4294967296).toString(36); gstore.set('anon', a); }
      basis = 'anon:' + a;
    }
    const ds = datasetNo(idn);
    const str = [basis, PAGE.id, ds].join('|');
    const rec = { seed: hash32(str), str, basis, datasetNumber: ds, datasetId: datasetCode(hash32(str + '#dataset-id')), student: !!idn };
    if (IS_LAB) { try { localStorage.setItem(DS_STORE, JSON.stringify({ seed: rec.seed, str, basis, datasetNumber: ds, datasetId: rec.datasetId, t: Date.now() })); } catch (e) { /* blocked: recomputed each load, as before */ } }
    return rec;
  })();
  let rngCount = 0;
  if (IS_LAB) Math.random = mulberry32(SEED.seed);
  /* Seed for an unseeded Lab.rng(): the n-th call on a page always gets the same seed for the same student. */
  const autoSeed = () => IS_LAB ? hash32(SEED.str + ':rng:' + (rngCount++)) : Math.floor(nativeRandom() * 2 ** 31);

  /* ResizeObserver, made flushable. A page that redraws a canvas from its own ResizeObserver cannot do that while the browser is
     printing (observer callbacks wait for the next rendering step), so a part that was just shown can print as an empty canvas.
     Lab.print.prepare() calls flushResize(): every observer's callback runs now with the current size of what it watches. */
  const RO_ALL = new Set();
  if (typeof window.ResizeObserver === 'function' && !window.ResizeObserver.__aplab) {
    const NativeRO = window.ResizeObserver;
    const PatchedRO = class extends NativeRO {
      constructor(cb) { super(cb); this._aplab = { cb, els: new Set() }; RO_ALL.add(this); }
      observe(el, o) { this._aplab.els.add(el); return super.observe(el, o); }
      unobserve(el) { this._aplab.els.delete(el); return super.unobserve(el); }
      disconnect() { this._aplab.els.clear(); RO_ALL.delete(this); return super.disconnect(); }
    };
    PatchedRO.__aplab = true;
    window.ResizeObserver = PatchedRO;
  }
  /* The same for requestAnimationFrame: a view that redraws "next frame" (the microscope views) would still be blank when the print
     dialog opens, so pending frame callbacks can be run at once. */
  const RAF_PENDING = new Map(), nativeRaf = window.requestAnimationFrame.bind(window), nativeCaf = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { const id = nativeRaf(t => { RAF_PENDING.delete(id); cb(t); }); RAF_PENDING.set(id, cb); return id; };
  window.cancelAnimationFrame = id => { RAF_PENDING.delete(id); nativeCaf(id); };
  function flushFrames() {
    for (let pass = 0; pass < 3 && RAF_PENDING.size; pass++) {
      Array.from(RAF_PENDING.entries()).forEach(([id, cb]) => { RAF_PENDING.delete(id); nativeCaf(id); try { cb(performance.now()); } catch (e) { /* a page frame callback failed: ignore */ } });
    }
  }
  function flushResize() {
    RO_ALL.forEach(ro => {
      const ents = Array.from(ro._aplab.els).filter(e => e.isConnected).map(e => { const w = e.clientWidth, hh = e.clientHeight; return { target: e, contentRect: { x: 0, y: 0, top: 0, left: 0, width: w, height: hh, right: w, bottom: hh }, borderBoxSize: [{ inlineSize: w, blockSize: hh }], contentBoxSize: [{ inlineSize: w, blockSize: hh }] }; });
      if (ents.length) { try { ro._aplab.cb(ents, ro); } catch (e) { /* a page observer failed: ignore */ } }
    });
  }

  /* ---------------- DOM helpers ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  Lab.$ = $; Lab.$$ = $$; Lab.h = h; Lab.esc = esc;

  /* ---------------- Storage (per-viewer convenience only) ---------------- */
  const store = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(`aplab:${LAB_ID}:${key}`); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, val) { if (wiped) return; try { localStorage.setItem(`aplab:${LAB_ID}:${key}`, JSON.stringify(val)); saveNote(true); } catch (e) { storageFailed(); saveNote(false); } },
    clearLab() {
      try { Object.keys(localStorage).filter(k => k.startsWith(`aplab:${LAB_ID}:`)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    }
  };
  Lab.store = store;

  /* ---------------- Key results ----------------
     Lab.keyResult(id, {label, value, unit, part}) records one headline number for this lab
     (e.g. 'et50', {label:'ET₅₀ (with CO₂)', value:10.4, unit:'min', part:'float-assay'}; FRQ self-score:
     'frq-score', {label:'FRQ self-score', value:3, unit:'of 4'}). Stored as store 'keyres:<id>' = {label, value, unit, part, t}.
     Lab.keyResults() → [{id, label, value, unit, part, t}] oldest first. They go into the report, the progress file
     and the teacher dashboard. */
  /* Key-result clean-up. A key result is exported as "Label: value unit" with any extra wording in a separate Notes cell,
     so a stored record is normalised first: pipes, line breaks and control characters are removed from text; an object value
     becomes "k: v, k: v" (or its own .value), an array "a, b, c", NaN/Infinity becomes "no value"; and a `unit` that is really a
     sentence ("df = 1; critical value 3.84") is moved into `note`. */
  const krText = (s, max) => { let t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s*\|\s*/g, ' / ').replace(/\s+/g, ' ').trim(); if (max && t.length > max) t = t.slice(0, max - 1) + '…'; return t; };
  const krNum = n => (Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : null);
  function krValue(v, depth) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return krNum(v);
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) { const a = v.map(x => krValue(x, (depth || 0) + 1)).filter(x => x != null); return a.length ? krText(a.join(', '), 200) : null; }
    if (typeof v === 'object') {
      if ('value' in v && (depth || 0) < 2) return krValue(v.value, (depth || 0) + 1);
      const a = Object.keys(v).map(k => { const x = krValue(v[k], (depth || 0) + 1); return x == null ? null : krText(k, 40) + ': ' + x; }).filter(Boolean);
      return a.length ? krText(a.join(', '), 200) : null;
    }
    return krText(v, 200) || null;
  }
  const unitIsNote = u => /[;=]/.test(u) || /\b(critical|df|degrees of freedom|threshold)\b/i.test(u) || u.length > 28;
  function krNorm(r) {
    const o = Object.assign({}, r);
    o.value = krValue(r.value);
    let unit = krText(r.unit, 120), note = krText(r.note, 200);
    if (unit && unitIsNote(unit)) { note = note ? note + '; ' + unit : unit; unit = ''; }
    o.unit = unit; o.note = note; if (r.label != null) o.label = krText(r.label, 160);
    return o;
  }
  Lab.keyResult = function (id, o) {
    if (!id) return null;
    if (o === null) { store.set('keyres:' + id, null); return null; }   // a calculator whose inputs changed can withdraw its result
    if (!o || typeof o !== 'object') return null;
    const rec = krNorm({ label: o.label, value: o.value, unit: o.unit, note: o.note, part: o.part });
    rec.t = Date.now();
    store.set('keyres:' + id, rec);
    return rec;
  };
  Lab.keyResults = function () {
    const out = [], pre = `aplab:${LAB_ID}:keyres:`;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(pre)) continue;
        try { const v = JSON.parse(localStorage.getItem(k)); if (v && typeof v === 'object') out.push(Object.assign({ id: k.slice(pre.length) }, krNorm(v), { t: v.t })); } catch (e) { /* skip bad value */ }
      }
    } catch (e) { /* storage blocked */ }
    return out.sort((a, b) => (a.t || 0) - (b.t || 0) || String(a.id).localeCompare(String(b.id)));
  };
  const keyResultText = r => (r.value == null ? '—' : String(r.value)) + (r.value != null && r.unit ? ' ' + r.unit : '');

  /* ---------------- "Saved ✓" status line ----------------
     Every Lab.store.set (prompts, tables, quizzes, steps, sim saves) reports here. Each .save-status element
     (one per part, one by the Submit tools) shows "Saved ✓ just now" / "Saved ✓ 2 min ago", or
     "Not saved — see warning" when a write fails. The visible text is aria-hidden; a visually hidden polite live
     region speaks only when the state changes (first save, failure, recovery), never more than every 4 s. */
  const SAVE = { at: 0, ok: null, spoken: null, spokenAt: 0 };
  function saveAgo() {
    const s = Math.max(0, (Date.now() - SAVE.at) / 1000);
    if (s < 45) return 'just now';
    const m = Math.round(s / 60); if (m < 60) return (m < 1 ? 1 : m) + ' min ago';
    const hr = Math.floor(m / 60); return hr + (hr === 1 ? ' hour ago' : ' hours ago');
  }
  function saveText() {
    if (SAVE.ok === false) return 'Not saved — see warning';
    if (SAVE.ok === true) return 'Saved ✓ ' + saveAgo();
    return 'Saves automatically on this device';
  }
  function renderSave(speak) {
    const nodes = Array.prototype.slice.call(document.querySelectorAll('.save-status'));
    if (!nodes.length) return;
    const t = saveText();
    nodes.forEach(n => { n.dataset.state = SAVE.ok === false ? 'bad' : SAVE.ok ? 'ok' : 'idle'; const v = n.firstChild; if (v && v.textContent !== t) v.textContent = t; });
    if (!speak) return;
    const key = String(SAVE.ok), now = Date.now();
    if (SAVE.spoken === key || now - SAVE.spokenAt < 4000) return;
    SAVE.spoken = key; SAVE.spokenAt = now;
    const msg = SAVE.ok === false ? 'Not saved. See the warning at the top of the page.' : 'Your work is saved on this device.';
    const vis = nodes.filter(n => n.offsetParent !== null);
    nodes.forEach(n => { n.lastChild.textContent = ''; });
    const target = vis[0];
    if (target) setTimeout(() => { target.lastChild.textContent = msg; }, 50);
  }
  function saveNote(ok) {
    if (PAGE.kind !== 'lab') return;
    const changed = SAVE.ok !== ok;
    SAVE.ok = ok; if (ok) SAVE.at = Date.now();
    clearTimeout(saveNote._t); saveNote._t = setTimeout(() => renderSave(true), changed ? 0 : 1500);
  }
  /* A fresh status element for a part or the Submit tools. */
  function saveStatusEl() {
    return h('p', { class: 'save-status', 'data-state': 'idle' }, h('span', { 'aria-hidden': 'true' }, saveText()), h('span', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' }));
  }
  if (PAGE.kind === 'lab') setInterval(() => renderSave(false), 15000);
  Lab.saveStatus = { text: saveText, render: () => renderSave(false) };

  /* ---------------- Random numbers (seedable) ---------------- */
  Lab.rng = function (seed) {
    let s = (seed == null ? autoSeed() : seed) >>> 0;
    function uniform() { // mulberry32
      s = (s + 0x6D2B79F5) >>> 0; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    let spare = null;
    function normal(mean = 0, sd = 1) {
      if (spare != null) { const v = spare; spare = null; return mean + sd * v; }
      let u, v, q; do { u = uniform() * 2 - 1; v = uniform() * 2 - 1; q = u * u + v * v; } while (q === 0 || q >= 1);
      const f = Math.sqrt(-2 * Math.log(q) / q); spare = v * f; return mean + sd * u * f;
    }
    const int = (a, b) => a + Math.floor(uniform() * (b - a + 1));
    const pick = arr => arr[Math.floor(uniform() * arr.length)];
    const chance = p => uniform() < p;
    function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(uniform() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function poisson(lambda) { if (lambda > 50) return Math.max(0, Math.round(normal(lambda, Math.sqrt(lambda)))); let L = Math.exp(-lambda), k = 0, p = 1; do { k++; p *= uniform(); } while (p > L); return k - 1; }
    function binomial(n, p) { if (n > 200) return Math.max(0, Math.min(n, Math.round(normal(n * p, Math.sqrt(n * p * (1 - p)))))); let c = 0; for (let i = 0; i < n; i++) if (uniform() < p) c++; return c; }
    return { uniform, normal, int, pick, chance, shuffle, poisson, binomial };
  };

  /* ---------------- Statistics ---------------- */
  const CHI_CRIT = { // df: [p=0.05, p=0.01]
    1: [3.84, 6.63], 2: [5.99, 9.21], 3: [7.81, 11.34], 4: [9.49, 13.28], 5: [11.07, 15.09],
    6: [12.59, 16.81], 7: [14.07, 18.48], 8: [15.51, 20.09], 9: [16.92, 21.67], 10: [18.31, 23.21]
  };
  const stats = {
    mean: a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN,
    sd(a) { if (a.length < 2) return NaN; const m = stats.mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); },
    se(a) { return stats.sd(a) / Math.sqrt(a.length); },
    ci95(a) { const m = stats.mean(a), e = 2 * stats.se(a); return [m - e, m + e]; }, // AP convention: mean ± 2 SE
    median(a) { const b = a.slice().sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : NaN; },
    chiSquare(obs, exp) {
      const terms = obs.map((o, i) => (o - exp[i]) ** 2 / exp[i]);
      const chi2 = terms.reduce((s, x) => s + x, 0), df = obs.length - 1;
      const crit = CHI_CRIT[df] ? CHI_CRIT[df][0] : NaN;
      return { chi2, df, crit, crit01: CHI_CRIT[df] ? CHI_CRIT[df][1] : NaN, terms, reject: chi2 > crit };
    },
    chiCrit: (df, p = 0.05) => CHI_CRIT[df] ? CHI_CRIT[df][p === 0.01 ? 1 : 0] : NaN,
    CHI_TABLE: CHI_CRIT,
    linreg(xs, ys) {
      const n = xs.length, mx = stats.mean(xs), my = stats.mean(ys);
      let sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
      const m = sxy / sxx, b = my - m * mx;
      return { m, b, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy), xIntercept: m === 0 ? NaN : -b / m, predict: x => m * x + b };
    },
    sum: a => a.reduce((s, x) => s + x, 0),
  };
  Lab.stats = stats;

  /* Format a number with fixed decimals; '—' for non-finite */
  Lab.fmt = function (x, d = 2) {
    if (x == null || !isFinite(x)) return '—';
    const v = Number(x).toFixed(d);
    return v === '-0' || /^-0\.0*$/.test(v) ? v.slice(1) : v;
  };

  /* ---------------- Chart (SVG, theme-aware via CSS vars) ----------------
     Lab.chart(el, opts) → { update(opts) }
     opts: { type:'xy'|'bar', xLabel, yLabel, xMin,xMax,yMin,yMax, height,
             series:[{ name, color, points:[{x,y,err}], line:true, dots:true, fit:false|'linear', dash:false }],
             categories:[...] (bar), annotations:[{x, label}] , hLines:[{y,label}] } */
  const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];
  /* Series are told apart by more than color (about 1 in 12 men cannot separate the green, red and orange of a rainbow palette):
     each series also gets its own marker shape and line pattern (xy), or fill pattern (bar), and the legend draws the same swatch. */
  const MARKERS = ['circle', 'square', 'triangle', 'diamond', 'cross', 'plus'];
  const DASHES = ['', '8 4', '2 4', '9 3 2 3', '', '4 3'];
  function markerSvg(shape, x, y, r, style, title) {
    const t = title ? `<title>${title}</title>` : '', st = `style="${style}" stroke-width="1.5"`;
    if (shape === 'square') return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" ${st}>${t}</rect>`;
    if (shape === 'triangle') return `<polygon points="${x},${y - r * 1.25} ${x + r * 1.2},${y + r * 0.9} ${x - r * 1.2},${y + r * 0.9}" ${st}>${t}</polygon>`;
    if (shape === 'diamond') return `<polygon points="${x},${y - r * 1.3} ${x + r * 1.3},${y} ${x},${y + r * 1.3} ${x - r * 1.3},${y}" ${st}>${t}</polygon>`;
    if (shape === 'cross') return `<path d="M${x - r} ${y - r}L${x + r} ${y + r}M${x - r} ${y + r}L${x + r} ${y - r}" fill="none" style="stroke:${style.match(/fill:([^;]+)/)[1]}" stroke-width="2.6" stroke-linecap="round">${t}</path>`;
    if (shape === 'plus') return `<path d="M${x - r * 1.15} ${y}L${x + r * 1.15} ${y}M${x} ${y - r * 1.15}L${x} ${y + r * 1.15}" fill="none" style="stroke:${style.match(/fill:([^;]+)/)[1]}" stroke-width="2.6" stroke-linecap="round">${t}</path>`;
    return `<circle cx="${x}" cy="${y}" r="${r}" ${st}>${t}</circle>`;
  }
  /* Pattern for bar series i (0 = solid): the series color with light stripes, dots or hatching drawn over it. */
  function barPattern(id, color, i) {
    const k = i % 6; if (!k) return '';
    const ln = d => `<path d="${d}" stroke="var(--surface)" stroke-width="2.4" opacity=".75" fill="none"/>`;
    const body = k === 1 ? ln('M-2 2L2 -2M0 8L8 0M6 10L10 6') : k === 2 ? '<circle cx="4" cy="4" r="1.7" fill="var(--surface)" opacity=".85"/>'
      : k === 3 ? ln('M-2 2L2 -2M0 8L8 0M6 10L10 6') + ln('M-2 6L2 10M0 0L8 8M6 -2L10 2') : k === 4 ? ln('M0 2H8M0 6H8') : ln('M2 0V8M6 0V8');
    return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" style="fill:${color}"/>${body}</pattern>`;
  }
  function legendSwatch(sr, i, type, uid) {
    if (type === 'bar') { const pat = barPattern(`${uid}-${i}`, sr.color, i); return `<svg class="lg-sw" width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">${pat ? `<defs>${pat}</defs>` : ''}<rect x="1" y="1" width="18" height="12" rx="2" style="fill:${pat ? `url(#${uid}-${i})` : sr.color}"/></svg>`; }
    const dash = sr.dash ? '6 4' : DASHES[i % 6];
    return `<svg class="lg-sw" width="28" height="14" viewBox="0 0 28 14" aria-hidden="true">${sr.line ? `<line x1="1" x2="27" y1="7" y2="7" style="stroke:${sr.color}" stroke-width="2.4"${dash ? ` stroke-dasharray="${dash}"` : ''}/>` : ''}${sr.dots ? markerSvg(MARKERS[i % 6], 14, 7, 3.8, `fill:${sr.color};stroke:var(--surface)`).replace(/<circle cx="(\S+)" cy="(\S+)" r="(\S+)"/, '<ellipse cx="$1" cy="$2" rx="$3" ry="$3"') : ''}</svg>`;   // an <ellipse>, so counting a chart's plotted <circle> points never counts the legend
  }
  function niceStep(range, ticks) {
    const raw = range / Math.max(1, ticks), mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    return (r >= 5 ? 10 : r >= 2 ? 5 : r >= 1 ? 2 : 1) * mag;
  }
  /* exact = both ends were given by the page: keep them as they are, pick a nice step that fits inside, and start the ticks at the first
     nice multiple at or above the lower end (t0), so a 2-12 pH axis stays 2-12 even in a narrow panel. */
  function niceRange(lo, hi, ticks = 5, exact = false) {
    if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; exact = false; }
    if (lo === hi) { hi = lo + 1; lo = lo - (lo === 0 ? 0 : 1); }
    const step = niceStep(hi - lo, exact ? ticks + 2 : ticks);
    if (exact && hi > lo) return { lo, hi, step, t0: Math.ceil(lo / step - 1e-9) * step };
    const r = { lo: Math.floor(lo / step + 1e-9) * step, hi: Math.ceil(hi / step - 1e-9) * step, step };
    r.t0 = r.lo; return r;
  }
  const tickFmt = (v, step) => { const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); return Lab.fmt(v, Math.min(d, 6)); };
  const errOf = p => { const e = p && p.err != null ? Math.abs(+p.err) : 0; return isFinite(e) ? e : 0; }; // a missing or NaN error bar (e.g. SE of one plant) must not wreck the axis scale

  let clipCount = 0;
  /* Callbacks run (debounced) whenever student work changes: progress marks use this. */
  const workListeners = []; let workTimer = null;
  function workChanged() { clearTimeout(workTimer); workTimer = setTimeout(() => workListeners.forEach(f => { try { f(); } catch (e) { console.warn(e); } }), 120); }
  const REG = { charts: [], tables: [], quizzes: [], prompts: [] }; // used by reports, worksheets and progress
  Lab._reg = REG;   // read-only handle for tests (tests/t48-tables.js)
  const CANVASES = []; // every Lab.canvas, so a part that becomes visible can be resized and redrawn at once
  /* Lab.chart draws in a 640-unit-wide viewBox. A responsive chart (opts.responsive, or any chart inside a
     results panel) draws at its real CSS width instead, so axis text stays 12px in narrow columns. */
  /* Wrap an axis label into lines that fit `room` px (≈0.6 em per character, generous): one line at full size, else two or
     three lines at full size, else smaller text (down to 10.5px) on two or three lines. A word longer than a line is split.
     Never an ellipsis: a long label gets more lines, not fewer letters. → {lines, fs} */
  function wrapLabel(str, room, fs = 13, minFs = 10.5, per = 0.6) {
    const words = String(str == null ? '' : str).split(/\s+/).filter(Boolean);
    if (!words.length) return { lines: [''], fs };
    const fill = cap => {
      const lines = []; let cur = '';
      words.forEach(wd => {
        while (wd.length > cap) { if (cur) { lines.push(cur); cur = ''; } lines.push(wd.slice(0, cap)); wd = wd.slice(cap); }
        if (cur && (cur + ' ' + wd).length > cap) { lines.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd;
      });
      if (cur) lines.push(cur);
      return lines;
    };
    const at = f => fill(Math.max(4, Math.floor(room / (per * f))));
    for (const n of [1, 2, 3]) {   // fewest lines first: full size, then (for 2 and 3 lines) slightly smaller text
      for (let f = fs; f >= (n === 1 ? fs : minFs) - 1e-6; f -= 0.5) { const l = at(f); if (l.length <= n) return { lines: l, fs: f }; }
    }
    return { lines: fill(Math.max(4, Math.floor(room / (per * minFs)))), fs: minFs };
  }
  Lab.chart = function (el, opts) {
    if (typeof el === 'string') el = $(el);
    el.classList.add('chart');
    let cur = Object.assign({}, opts);
    let ro = null, lastW = 0;
    const responsive = () => !!(cur.responsive || el.closest('.sim-panel'));
    function chooseW() {
      if (!responsive()) return 640;
      const cw = el.clientWidth;
      // Observe even while hidden (width 0): when the panel is shown the chart redraws at its real width.
      if (!ro && 'ResizeObserver' in window) { ro = new ResizeObserver(() => { const w = el.clientWidth; if (w && Math.abs(w - lastW) > 8) render(); }); ro.observe(el); }
      if (!cw) return lastW || 640;
      return Math.max(300, Math.min(760, Math.round(cw)));
    }
    const entry = { el, get opts() { return cur; }, render: () => render(), html: W => build(W || 640) };
    REG.charts.push(entry);
    function render() { lastW = chooseW(); el.innerHTML = build(lastW); el.classList.toggle('is-empty', !chartHasData(cur)); }
    function build(W) {
      const o = cur, H = Math.round((o.height || 360) * Math.max(0.62, Math.min(1, W / 640))), m = { t: 16, r: 18, b: 54, l: 64 };
      /* Axis labels wrap instead of being cut: the x label and the y label take extra lines, and the margins grow to hold them. */
      const xl = wrapLabel(o.xLabel, W - 100), LH = 15;
      m.b += LH * (xl.lines.length - 1);
      let catWrap = null;
      if (o.type === 'bar') { // long category names wrap under their bars too
        const cats0 = o.categories || ((o.series || [])[0] ? o.series[0].points.map(p => p.x) : []);
        const gw0 = (W - 64 - 18 - 30) / Math.max(1, cats0.length);
        catWrap = cats0.map(c => wrapLabel(c, Math.max(30, gw0 - 8), 12, 10.5));
        m.b += LH * (Math.max(1, ...catWrap.map(w => w.lines.length)) - 1);
      }
      const yl = wrapLabel(o.yLabel, Math.max(40, H - m.t - m.b - 6));
      m.l += LH * (yl.lines.length - 1);
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const series = (o.series || []).map((s, i) => Object.assign({ color: SERIES[i % SERIES.length], line: o.type !== 'bar', dots: true, idx: i }, s));
      const uid = 'bp' + (++clipCount), multi = series.filter(x => x.points && x.points.length).length > 1;
      let patDefs = '';
      let svg = '';
      const empty = !chartHasData(o);                                  // nothing to plot yet: draw the axes and a note, not a fake 0–1 scale
      const knownX = o.xMin != null && o.xMax != null, knownY = o.yMin != null && o.yMax != null;
      const showX = !empty || knownX, showY = !empty || knownY;          // tick numbers only when they mean something
      if (o.type === 'bar') {
        const cats = o.categories || (series[0] ? series[0].points.map(p => p.x) : []);
        let yMax = -Infinity, yMin = 0;
        series.forEach(s => s.points.forEach(p => { if (!isFinite(p.y)) return; yMax = Math.max(yMax, p.y + errOf(p)); yMin = Math.min(yMin, p.y - errOf(p)); }));
        const yr = niceRange(o.yMin != null ? o.yMin : yMin, o.yMax != null ? o.yMax : (isFinite(yMax) ? yMax : 1), 5, o.yMin != null && o.yMax != null);
        const Y = v => m.t + ih - (v - yr.lo) / (yr.hi - yr.lo) * ih;
        for (let v = yr.t0; v <= yr.hi + 1e-9; v += yr.step) svg += `<line class="gridline" x1="${m.l}" x2="${m.l + iw}" y1="${Y(v)}" y2="${Y(v)}"/>${showY ? `<text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${tickFmt(v, yr.step)}</text>` : ''}`;
        const gw = iw / Math.max(1, cats.length), bw = Math.min(56, (gw * 0.72) / Math.max(1, series.length));
        cats.forEach((c, ci) => {
          const gx = m.l + gw * ci + gw / 2;
          const cw = (catWrap && catWrap[ci]) || { lines: [String(c)], fs: 12 };
          svg += `<text x="${gx}" y="${m.t + ih + 18}" text-anchor="middle"${cw.fs < 12 ? ` style="font-size:${cw.fs}px"` : ''}>${cw.lines.map((ln, li) => `<tspan x="${gx}" dy="${li ? 14 : 0}">${esc(ln)}</tspan>`).join('')}</text>`;
          series.forEach((s, si) => {
            const p = s.points.find(pp => pp.x === c) || s.points[ci]; if (!p || !isFinite(p.y)) return;
            const x = gx - (bw * series.length) / 2 + bw * si, y0 = Y(Math.max(0, yr.lo)), y1 = Y(p.y);
            const pat = series.length > 1 ? barPattern(`${uid}-${si}`, s.color, si) : ''; if (pat && !patDefs.includes(`id="${uid}-${si}"`)) patDefs += pat;
            svg += `<rect x="${x + 2}" y="${Math.min(y0, y1)}" width="${Math.max(0.5, bw - 4)}" height="${Math.abs(y0 - y1)}" rx="3" style="fill:${pat ? `url(#${uid}-${si})` : s.color};stroke:${s.color}" stroke-width="1.2"><title>${esc(s.name || '')} ${esc(c)}: ${Lab.fmt(p.y, 3)}</title></rect>`;
            const pe = errOf(p);
            if (pe) { const cx = x + bw / 2; svg += `<g style="stroke:var(--ink)" stroke-width="1.4"><line x1="${cx}" x2="${cx}" y1="${Y(p.y - pe)}" y2="${Y(p.y + pe)}"/><line x1="${cx - 5}" x2="${cx + 5}" y1="${Y(p.y - pe)}" y2="${Y(p.y - pe)}"/><line x1="${cx - 5}" x2="${cx + 5}" y1="${Y(p.y + pe)}" y2="${Y(p.y + pe)}"/></g>`; }
          });
        });
        svg += `<line class="axis" x1="${m.l}" x2="${m.l + iw}" y1="${Y(Math.max(0, yr.lo))}" y2="${Y(Math.max(0, yr.lo))}"/>`;
      } else {
        let xs = [], ys = [];
        series.forEach(s => s.points.forEach(p => { if (isFinite(p.x) && isFinite(p.y)) { xs.push(p.x); ys.push(p.y - errOf(p), p.y + errOf(p)); } }));
        if (!empty) (o.hLines || []).forEach(l => { if (isFinite(l.y)) ys.push(l.y); });
        const xr = niceRange(o.xMin != null ? o.xMin : Math.min(0, ...(xs.length ? xs : [0])), o.xMax != null ? o.xMax : Math.max(...(xs.length ? xs : [1])), W < 480 ? 4 : 6, o.xMin != null && o.xMax != null);
        const yr = niceRange(o.yMin != null ? o.yMin : Math.min(0, ...(ys.length ? ys : [0])), o.yMax != null ? o.yMax : Math.max(...(ys.length ? ys : [1])), 5, o.yMin != null && o.yMax != null);
        const X = v => m.l + (v - xr.lo) / (xr.hi - xr.lo) * iw, Y = v => m.t + ih - (v - yr.lo) / (yr.hi - yr.lo) * ih;
        for (let v = yr.t0; v <= yr.hi + 1e-9; v += yr.step) svg += `<line class="gridline" x1="${m.l}" x2="${m.l + iw}" y1="${Y(v)}" y2="${Y(v)}"/>${showY ? `<text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${tickFmt(v, yr.step)}</text>` : ''}`;
        for (let v = xr.t0; v <= xr.hi + 1e-9; v += xr.step) svg += `<line class="gridline" x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${m.t + ih}"/>${showX ? `<text x="${X(v)}" y="${m.t + ih + 18}" text-anchor="middle">${tickFmt(v, xr.step)}</text>` : ''}`;
        if (yr.lo < 0 && yr.hi > 0) svg += `<line class="axis" x1="${m.l}" x2="${m.l + iw}" y1="${Y(0)}" y2="${Y(0)}"/>`;
        svg += `<line class="axis" x1="${m.l}" x2="${m.l + iw}" y1="${m.t + ih}" y2="${m.t + ih}"/><line class="axis" x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${m.t + ih}"/>`;
        (empty ? [] : o.hLines || []).forEach(l => { if (!isFinite(l.y)) return; svg += `<line x1="${m.l}" x2="${m.l + iw}" y1="${Y(l.y)}" y2="${Y(l.y)}" style="stroke:var(--muted)" stroke-dasharray="5 4"/>${l.label ? `<text x="${m.l + iw - 4}" y="${Y(l.y) - 5}" text-anchor="end">${esc(l.label)}</text>` : ''}`; });
        (empty ? [] : o.annotations || []).forEach(a => { svg += `<line x1="${X(a.x)}" x2="${X(a.x)}" y1="${m.t}" y2="${m.t + ih}" style="stroke:var(--stain)" stroke-dasharray="4 4"/>${a.label ? (X(a.x) > m.l + iw * 0.6 ? `<text x="${X(a.x) - 5}" y="${m.t + 12}" text-anchor="end" style="fill:var(--stain)">${esc(a.label)}</text>` : `<text x="${X(a.x) + 5}" y="${m.t + 12}" style="fill:var(--stain)">${esc(a.label)}</text>`) : ''}`; });
        const clipId = 'lc' + (++clipCount); // not Math.random: keeps the seeded stream for simulations
        svg += `<defs><clipPath id="${clipId}"><rect x="${m.l}" y="${m.t - 6}" width="${iw + 6}" height="${ih + 12}"/></clipPath></defs><g clip-path="url(#${clipId})">`;
        series.forEach(s => {
          const pts = s.points.filter(p => isFinite(p.x) && isFinite(p.y)).slice().sort((a, b) => a.x - b.x);
          if (s.line && pts.length > 1) svg += `<polyline fill="none" style="stroke:${s.color}" stroke-width="2.2" ${s.dash ? 'stroke-dasharray="6 5"' : (multi && DASHES[s.idx % 6] ? `stroke-dasharray="${DASHES[s.idx % 6]}"` : '')} stroke-linejoin="round" points="${pts.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')}"/>`;
          pts.forEach(p => { const pe = errOf(p); if (pe) svg += `<g style="stroke:${s.color}" stroke-width="1.3"><line x1="${X(p.x)}" x2="${X(p.x)}" y1="${Y(p.y - pe)}" y2="${Y(p.y + pe)}"/><line x1="${X(p.x) - 4}" x2="${X(p.x) + 4}" y1="${Y(p.y - pe)}" y2="${Y(p.y - pe)}"/><line x1="${X(p.x) - 4}" x2="${X(p.x) + 4}" y1="${Y(p.y + pe)}" y2="${Y(p.y + pe)}"/></g>`; });
          if (s.dots && pts.length <= 120) pts.forEach(p => { svg += markerSvg(multi ? MARKERS[s.idx % 6] : 'circle', X(p.x), Y(p.y), 3.8, `fill:${s.color};stroke:var(--surface)`, `${esc(s.name || '')} (${Lab.fmt(p.x, 3)}, ${Lab.fmt(p.y, 3)})`); });
          if (s.fit === 'linear' && pts.length > 1) {
            const f = stats.linreg(pts.map(p => p.x), pts.map(p => p.y));
            if (isFinite(f.m) && isFinite(f.b)) svg += `<line x1="${X(xr.lo)}" x2="${X(xr.hi)}" y1="${Y(f.predict(xr.lo))}" y2="${Y(f.predict(xr.hi))}" style="stroke:${s.color}" stroke-width="1.5" stroke-dasharray="6 4" opacity=".8"/>`;
            if (isFinite(f.m)) s._fit = f;
          }
        });
        svg += '</g>';
      }
      if (empty) { // designed empty state: a centred note over the (labelled) axes
        const words = String(o.emptyText || 'Run a trial to see your results here').split(' '), per = 7.8, lines = [];
        const maxCh = Math.max(12, Math.floor((iw - 28) / per)); let cur = '';
        words.forEach(wd => { if (cur && (cur + ' ' + wd).length > maxCh) { lines.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd; });
        if (cur) lines.push(cur);
        const bw = Math.min(iw - 8, Math.max(...lines.map(l => l.length)) * per + 32), bh = lines.length * 20 + 18, cx = m.l + iw / 2, cy = m.t + ih / 2;
        svg += `<g class="chart-empty"><rect x="${cx - bw / 2}" y="${cy - bh / 2}" width="${bw}" height="${bh}" rx="10"/>${lines.map((l, i) => `<text x="${cx}" y="${cy - bh / 2 + 9 + 20 * i + 15}" text-anchor="middle">${esc(l)}</text>`).join('')}</g>`;
      }
      { // axis labels, wrapped (see wrapLabel); the y label reads bottom to top, its first line outermost
        const xs = xl.fs < 13 ? ` style="font-size:${xl.fs}px"` : '', ys = yl.fs < 13 ? ` style="font-size:${yl.fs}px"` : '';
        xl.lines.forEach((ln, i) => { svg += `<text class="axis-label" x="${m.l + iw / 2}" y="${H - 10 - LH * (xl.lines.length - 1 - i)}" text-anchor="middle"${xs}>${esc(ln)}</text>`; });
        yl.lines.forEach((ln, i) => { svg += `<text class="axis-label" transform="translate(${14 + LH * i} ${m.t + ih / 2}) rotate(-90)" text-anchor="middle"${ys}>${esc(ln)}</text>`; });
      }
      const named = series.filter(s => s.name);
      const legend = named.length > 1 || (named.length === 1 && o.type !== 'bar') ? `<div class="legend">${named.map(s => `<span>${legendSwatch(s, s.idx, o.type === 'bar' ? 'bar' : 'xy', uid)}${esc(s.name)}</span>`).join('')}</div>` : '';
      const fits = series.filter(s => s._fit).map(s => `${esc(s.name || 'fit')}: y = ${Lab.fmt(s._fit.m, 4)}x ${s._fit.b < 0 ? '−' : '+'} ${Lab.fmt(Math.abs(s._fit.b), 4)}  (R² = ${Lab.fmt(s._fit.r2, 3)})`);
      if (patDefs) svg = `<defs>${patDefs}</defs>` + svg;
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc((o.yLabel || '') + ' vs ' + (o.xLabel || '') + (empty ? ': no data yet' : ''))}">${svg}</svg>${legend}${fits.length ? `<div class="chart-note">${fits.join('<br>')}</div>` : ''}`;
    }
    render();
    return { update(next) { cur = Object.assign({}, cur, next); render(); }, el };
  };

  /* ---------------- Data table ----------------
     Lab.table(el, { columns:[{key,label,unit,num:true,digits:2,editable:false}], rows:[], save:'key', onChange(rows), footer:(rows)=>[...cells] })
     → { setRows(rows), getRows(), addRow(row) } */
  Lab.table = function (el, opts) {
    if (typeof el === 'string') el = $(el);
    /* Setup rows: rows the page itself adds while loading (a starting row, preset rows) are tagged _setup:true,
       and the tag is saved with the row, so they still do not count as student work after a reload. */
    let rows = (opts.save && store.get(opts.save)) || (opts.rows || []).map(r => Object.assign({ _setup: true }, r));
    const reg = { el, opts, getRows: () => rows };
    const workRows = () => rows.filter(r => !r._setup);
    REG.tables.push(reg);
    function render() {
      const cols = opts.columns;
      const head = cols.map(c => `<th class="${c.num ? 'num' : ''}">${esc(c.label)}${c.unit ? ` <span class="unit">(${esc(c.unit)})</span>` : ''}</th>`).join('');
      const body = rows.map((r, ri) => `<tr>${cols.map(c => {
        const v = r[c.key];
        if (c.editable) return `<td class="${c.num ? 'num' : ''}"><input data-r="${ri}" data-k="${c.key}" type="${c.num ? 'number' : 'text'}" step="any" value="${v == null ? '' : esc(v)}" aria-label="${esc(c.label)} row ${ri + 1}"></td>`;
        return `<td class="${c.num ? 'num' : ''}">${c.num && typeof v === 'number' ? Lab.fmt(v, c.digits != null ? c.digits : 2) : esc(v == null ? '' : v)}</td>`;
      }).join('')}</tr>`).join('');
      const foot = opts.footer && rows.length ? `<tfoot><tr>${opts.footer(rows).map((v, i) => `<td class="${cols[i] && cols[i].num ? 'num' : ''}">${v == null ? '' : v}</td>`).join('')}</tr></tfoot>` : '';
      el.innerHTML = `<div class="table-wrap"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length}" class="muted">No data yet. Run a trial to fill this table.</td></tr>`}</tbody>${foot}</table></div>`;
      $$('input[data-r]', el).forEach(inp => inp.addEventListener('input', () => { // typed cell values are saved at once, not only on blur
        const r = rows[+inp.dataset.r], c = cols.find(cc => cc.key === inp.dataset.k);
        if (r && c && opts.save) { r[inp.dataset.k] = c.num ? (inp.value === '' || !isFinite(parseFloat(inp.value)) ? null : parseFloat(inp.value)) : inp.value; delete r._setup; store.set(opts.save, rows); }
      }));
      $$('input[data-r]', el).forEach(inp => inp.addEventListener('change', () => {
        const r = rows[+inp.dataset.r], c = cols.find(cc => cc.key === inp.dataset.k);
        r[inp.dataset.k] = c.num ? (inp.value === '' ? null : parseFloat(inp.value)) : inp.value; delete r._setup; // editing a row makes it the student's
        changed(false);
      }));
    }
    function changed(rerender = true) { if (opts.save) store.set(opts.save, rows); if (rerender) render(); else if (opts.footer) render(); opts.onChange && opts.onChange(rows); workChanged(); }
    /* "Recorded trial N" toast for saved (student data) tables. Rows that arrive in a stream (one per simulated
       minute) are coalesced into one toast. opts.toast: false | 'text' | (rows, added) => 'text'. */
    let pend = 0, toastT = null, lastSay = 0;
    const toastKey = 'table:' + (opts.save || REG.tables.length);
    function noteRows(n) {
      if (!opts.save || opts.toast === false || n <= 0 || !autoToasts.ready) return;
      pend += n; clearTimeout(toastT);
      toastT = setTimeout(() => {
        const k = pend; pend = 0;
        const msg = typeof opts.toast === 'function' ? opts.toast(rows, k) : typeof opts.toast === 'string' ? opts.toast
          : (k === 1 ? `Recorded trial ${rows.length} in your data table` : `Recorded ${k} rows in your data table`);
        if (!msg) return;
        const quiet = Date.now() - lastSay < 4000; lastSay = Date.now();
        Lab.toast(msg, { type: 'ok', key: toastKey, announce: !quiet });
      }, 600);
    }
    render();
    if (rows.length && opts.onChange) setTimeout(() => opts.onChange(rows), 0);
    return reg.api = {
      /* o.setup: true marks the new rows as page setup (not student work); false marks them as work. Default: setup while the page is still loading. */
      setRows(r, o) { const su = o && o.setup != null ? !!o.setup : !autoToasts.ready; rows = r.map(x => { const c = Object.assign({}, x); if (su && c._setup == null) c._setup = true; else if (!su && o && o.setup === false) delete c._setup; return c; }); changed(); noteRows(rows.length); },
      addRow(r, o) { const su = o && o.setup != null ? !!o.setup : !autoToasts.ready; const c = Object.assign({}, r); if (su) c._setup = true; else delete c._setup; rows.push(c); changed(); noteRows(1); },
      workRows,
      getRows() { return rows; },
      clear() { rows = []; changed(); },
    };
  };

  /* ---------------- Wide tables: never lose a column off-screen ----------------
     Every .table-wrap (Lab.table or a page's own) is watched. When its table is wider than the box, the wrap gets .is-scrollable
     (first column sticks, edge shadows show), is made keyboard-focusable, and a "Scroll →" line under it says so until the
     right end is reached. Inside a results panel the Data column is also widened (Lab.results) before anything scrolls. */
  const WRAP_STATE = new WeakMap();
  function wrapUpdate(w) {
    const st = WRAP_STATE.get(w); if (!st || !w.isConnected) return;
    const over = w.scrollWidth - w.clientWidth > 2 && w.clientWidth > 0;
    const end = !over || w.scrollLeft + w.clientWidth >= w.scrollWidth - 2;
    w.classList.toggle('is-scrollable', over);
    w.classList.toggle('at-end', end);
    if (over) { w.setAttribute('tabindex', '0'); w.setAttribute('role', 'region'); if (!w.getAttribute('aria-label')) w.setAttribute('aria-label', 'Data table. Scrolls sideways; arrow keys move it.'); }
    else if (w.getAttribute('tabindex') === '0') w.removeAttribute('tabindex');
    st.hint.hidden = !over || end;
  }
  function wrapWatch(w) {
    if (WRAP_STATE.has(w)) return;
    const hint = h('div', { class: 'scroll-hint', 'aria-hidden': 'true', hidden: true }, 'Scroll → for more columns');
    w.after(hint);
    WRAP_STATE.set(w, { hint });
    const upd = () => wrapUpdate(w);
    w.addEventListener('scroll', upd, { passive: true });
    if (window.ResizeObserver) { const ro = new ResizeObserver(upd); ro.observe(w); const t = $('table', w); if (t) ro.observe(t); }
    window.addEventListener('resize', upd);
    upd();
  }
  function scanWraps() { $$('.table-wrap').forEach(wrapWatch); }
  Lab.tableFit = { scan: scanWraps, update: () => $$('.table-wrap').forEach(wrapUpdate) };
  (function () {
    const start = () => {
      scanWraps();
      if (!('MutationObserver' in window)) return;
      let q = false;
      new MutationObserver(() => { if (q) return; q = true; requestAnimationFrame(() => { q = false; scanWraps(); }); }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
  })();

  /* ---------------- Quiz ----------------
     Lab.quiz(el, questions, { id:'prelab' })
     question: { type:'mc', q, choices:[...], answer: index, explain }
             | { type:'multi', q, choices, answer:[indices], explain }
             | { type:'num', q, answer, tol (absolute) | tolPct, unit, explain } */
  Lab.quiz = function (el, questions, opts = {}) {
    if (typeof el === 'string') el = $(el);
    const id = opts.id || 'quiz';
    const saved = store.get('quiz:' + id, {});
    el.classList.add('quiz');
    el.innerHTML = '';
    REG.quizzes.push({ el, id, questions, state: () => store.get('quiz:' + id, {}) });
    const scoreEl = h('div', { class: 'score', 'aria-live': 'polite' });
    function updateScore() {
      const st = store.get('quiz:' + id, {});
      const right = Object.values(st).filter(v => v && v.correct).length;
      scoreEl.textContent = `${right} of ${questions.length} correct`;
    }
    questions.forEach((qq, qi) => {
      const box = h('div', { class: 'q' });
      box.append(h('div', { class: 'q-stem', html: `<span class="q-num">${qi + 1}.</span>${qq.q}` }));
      const fb = h('div', { class: 'feedback', hidden: true, 'aria-live': 'polite' });
      const name = `${id}-q${qi}`;
      let getAnswer;
      if (qq.type === 'num') {
        const inp = h('input', { type: 'number', step: 'any', id: name, 'aria-label': 'Your answer' });
        box.append(h('div', { class: 'num-row' }, inp, qq.unit ? h('span', { class: 'muted', html: qq.unit }) : null));
        getAnswer = () => inp.value;
        if (saved[qi]) inp.value = saved[qi].value;
      } else {
        const multi = qq.type === 'multi';
        const list = h('div', { class: 'choices', role: multi ? 'group' : 'radiogroup' });
        qq.choices.forEach((c, ci) => {
          const inp = h('input', { type: multi ? 'checkbox' : 'radio', name, value: ci, id: `${name}-${ci}` });
          list.append(h('label', { class: 'choice', for: `${name}-${ci}` }, inp, h('span', { html: c })));
          if (saved[qi]) { const sv = [].concat(saved[qi].value); if (sv.map(String).includes(String(ci))) inp.checked = true; }
        });
        box.append(list);
        getAnswer = () => multi ? $$('input:checked', list).map(i => +i.value) : ($('input:checked', list) || {}).value;
      }
      function grade(show) {
        const a = getAnswer();
        let ok = false;
        if (qq.type === 'num') {
          const v = parseFloat(a); const tol = qq.tol != null ? qq.tol : Math.abs(qq.answer) * (qq.tolPct != null ? qq.tolPct : 0.02);
          ok = isFinite(v) && Math.abs(v - qq.answer) <= tol + 1e-12;
        } else if (qq.type === 'multi') {
          ok = a.length === qq.answer.length && qq.answer.every(x => a.includes(x));
        } else ok = a != null && +a === qq.answer;
        if (a == null || a === '' || (Array.isArray(a) && !a.length)) { fb.hidden = false; fb.className = 'feedback bad'; fb.textContent = 'Choose or enter an answer first.'; return; }
        if (qq.type !== 'num') $$('.choice', box).forEach((lab, ci) => {
          lab.classList.remove('is-right', 'is-wrong');
          const inp = $('input', lab); const correctIdx = [].concat(qq.answer);
          if (inp.checked) lab.classList.add(correctIdx.includes(ci) ? 'is-right' : 'is-wrong');
        });
        fb.hidden = false; fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
        fb.innerHTML = (ok ? '<strong>Correct.</strong> ' : '<strong>Not quite.</strong> ') + (ok || opts.revealOnWrong !== false ? (qq.explain || '') : (qq.hint || 'Try again.'));
        const st = store.get('quiz:' + id, {}); st[qi] = { value: a, correct: ok }; store.set('quiz:' + id, st);
        updateScore(); workChanged();
        if (show) { const sc = scoreEl.textContent; Lab.toast(`Question ${qi + 1} checked: ${ok ? 'correct' : 'not quite, read the explanation'} · ${sc}`, { type: ok ? 'ok' : 'warn', key: 'quiz:' + id, announce: false }); }
      }
      box.append(h('div', { class: 'row' }, h('button', { class: 'btn btn--sm', type: 'button', onclick: () => grade(true) }, 'Check answer')), fb);
      el.append(box);
      if (saved[qi]) grade(false);
    });
    el.append(scoreEl);
    updateScore();
  };

  /* ---------------- Input validation helper ----------------
     Lab.validate.number(inputEl, {min, max, integer, required = true, label}) → number | null
       Reads the field. Empty, non-numeric, non-integer (when integer:true) or out-of-range input shows a plain
       message under the field and returns null, so the caller can simply do `if (v == null) return;`.
       A valid value clears any earlier message. required:false returns null for an empty field without a message.
       The value is never clamped: out-of-range input is rejected, not changed.
     Lab.validate.show(inputEl, msg)  put a custom message under the field (.feedback.bad, role="alert") and set aria-invalid
     Lab.validate.clear(inputEl)      remove the message and aria-invalid
     The message goes right under the field (under its row when the field sits in a flex or grid row) and clears
     itself as soon as the field holds a valid value again. */
  const vNum = n => String(+(+n).toPrecision(10));
  function fieldLabel0(el) {
    const l = el.getAttribute('aria-label') || (el.labels && el.labels[0] ? el.labels[0].textContent : '');
    return String(l || '').replace(/\s+/g, ' ').trim();
  }
  function checkNumber(el, o) {
    const label = (o.label || fieldLabel0(el) || 'This value').replace(/[.:]$/, '');
    const Cap = label.length > 2 ? label.charAt(0).toUpperCase() + label.slice(1) : label; // keep symbols such as p or pH as written
    const raw = String(el.value == null ? '' : el.value).trim();
    if (el.validity && el.validity.badInput) return { msg: `${Cap} must be a number.` };
    if (raw === '') return o.required === false ? { value: null, skip: true } : { msg: `Enter a value for ${label.length > 2 ? label.charAt(0).toLowerCase() + label.slice(1) : label}.` };
    const v = Number(raw);
    if (!isFinite(v)) return { msg: `${Cap} must be a number.` };
    if (o.integer && !Number.isInteger(v)) return { msg: `${Cap} must be a whole number.` };
    const hasMin = o.min != null && isFinite(o.min), hasMax = o.max != null && isFinite(o.max);
    if ((hasMin && v < o.min) || (hasMax && v > o.max)) {
      if (hasMin && hasMax) return { msg: `${Cap} must be between ${vNum(o.min)} and ${vNum(o.max)}.` };
      return { msg: hasMin ? `${Cap} must be at least ${vNum(o.min)}.` : `${Cap} must be at most ${vNum(o.max)}.` };
    }
    return { value: v };
  }
  let vCount = 0;
  const validate = {
    show(el, msg) {
      if (typeof el === 'string') el = $(el);
      if (!el) return;
      validate.clear(el);
      let host = el, par = el.parentElement;
      if (par && /flex|grid/.test(getComputedStyle(par).display) && !par.classList.contains('field')) host = par;
      const id = (el.id || 'v' + (++vCount)) + '-err';
      const box = h('p', { class: 'feedback bad field-msg', role: 'alert', id }, String(msg));
      host.insertAdjacentElement('afterend', box);
      el._vmsg = box; el._vdesc = el.getAttribute('aria-describedby');
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', ((el._vdesc || '') + ' ' + id).trim());
      if (!el._vbound) {
        el._vbound = true;
        el.addEventListener('input', () => {
          if (!el._vmsg) return;
          if (el._vopts) { const r = checkNumber(el, el._vopts); if (!r.msg) validate.clear(el); } else validate.clear(el);
        });
      }
    },
    clear(el, keepState) {
      if (typeof el === 'string') el = $(el);
      if (!el) return;
      if (el._vmsg) { el._vmsg.remove(); el._vmsg = null; }
      el.removeAttribute('aria-invalid');
      if (el._vdesc != null || el.hasAttribute('aria-describedby')) { if (el._vdesc) el.setAttribute('aria-describedby', el._vdesc); else el.removeAttribute('aria-describedby'); el._vdesc = null; }
      if (!keepState) el._vopts = null;
    },
    number(el, o = {}) {
      if (typeof el === 'string') el = $(el);
      if (!el) return null;
      const r = checkNumber(el, o);
      if (r.msg) { validate.show(el, r.msg); el._vopts = o; return null; }
      validate.clear(el);
      return r.value;
    },
  };
  Lab.validate = validate;

  /* ---------------- Autosave for [data-save] fields ---------------- */
  const saveFns = []; // flushed before a reload so nothing typed is lost
  /* A debounced autosave must not lose the last 400 ms of typing when the page goes away: flush on pagehide, beforeunload and when hidden. */
  window.addEventListener("pagehide", () => flushSaves());
  window.addEventListener("beforeunload", () => flushSaves());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSaves(); });
  function bindAutosave(root = document) {
    $$('[data-save]', root).forEach(f => {
      if (f._bound) return; f._bound = true;
      const key = 'field:' + f.dataset.save;
      const v = store.get(key);
      if (v != null) { if (f.type === 'checkbox') f.checked = v; else f.value = v; }
      let t, typed = false; const status = f.closest('.prompt') && $('.saved', f.closest('.prompt'));
      const answer = f.tagName === 'TEXTAREA' || !!f.dataset.label;
      const save = () => { store.set(key, f.type === 'checkbox' ? f.checked : f.value); if (status) status.textContent = 'Saved on this device'; if (typed && answer) savedToast(); typed = false; };
      saveFns.push(() => { clearTimeout(t); save(); });
      f.addEventListener('input', () => { typed = true; clearTimeout(t); t = setTimeout(save, 400); workChanged(); });
      f.addEventListener('change', save);
    });
  }
  Lab.bindAutosave = bindAutosave;
  /* One "saved" toast after typing pauses, at most every 45 s (never one per keystroke). */
  let savedT = null, savedAt = 0;
  function savedToast() {
    clearTimeout(savedT);
    savedT = setTimeout(() => { if (Date.now() - savedAt < 45000) return; savedAt = Date.now(); Lab.toast('Your answers are saved on this device', { type: 'ok', key: 'saved' }); }, 1500);
  }

  /* Build a written-response prompt. Lab.prompt(container, {key, label, rows, placeholder}) */
  Lab.prompt = function (el, o) {
    if (typeof el === 'string') el = $(el);
    const id = 'p-' + o.key;
    const wrap = h('div', { class: 'prompt' },
      h('label', { for: id, html: o.label }),
      h('textarea', { id, 'data-save': o.key, 'data-label': o.label.replace(/<[^>]+>/g, ''), rows: o.rows || 4, placeholder: o.placeholder || '' }),
      h('div', { class: 'saved' }));
    REG.prompts.push({ el: wrap, key: o.key, label: o.label, rows: o.rows || 4 });
    el.append(wrap); bindAutosave(wrap); return wrap;
  };

  /* ---------------- Identity UI ----------------
     Lab.identity.get() → {name, period} | null   (site-wide; the old per-lab name is a fallback)
     Lab.identity.set({name, period})               save it (no reload)
     Lab.identity.mount(el)                         sign-in panel, or "Signed in as … · change" line
     Lab.identity.newDataset()                      next dataset number for this student + lab, then reload
     Lab.identity.seed                              {seed, datasetId, datasetNumber, student} for this page */
  /* After a restore or "Erase my work" the page reloads: its old field values must not be flushed back over the new storage. */
  let noFlush = false;
  function reloadClean() { noFlush = true; if (Lab._allowLeave) Lab._allowLeave(); location.reload(); }
  function flushSaves() { if (noFlush) return; saveFns.forEach(f => { try { f(); } catch (e) { /* ignore */ } }); }
  function setIdentity(idn) {
    const clean = { name: normName(idn.name), period: String(idn.period || '') };
    const ok = gstore.set('student', clean);
    memIdentity = ok ? null : clean;
    return ok;
  }
  function reloadForSeed() { flushSaves(); if (Lab._allowLeave) Lab._allowLeave(); location.reload(); }
  function focusIn(root, sel) { const el = root.querySelector(sel); if (el) el.focus(); }
  const idHosts = [];
  const periodText = p => p ? (p === 'Other' ? 'Other period' : 'Period ' + p) : '';
  function renderIdentity(box, mode) {
    const idn = storedIdentity();
    box.innerHTML = '';
    if (!idn && mode !== 'form' && box._compact) {
      box.append(h('p', { class: 'id-line' }, 'Not signed in yet · ', h('button', { class: 'linkbtn id-change', type: 'button', onclick: () => { renderIdentity(box, 'form'); focusIn(box, 'input'); } }, 'Enter your name and class period')));
      return;
    }
    if (!idn || mode === 'form') {
      const pre = idn || effectiveIdentity() || { name: '', period: '' };
      const uid = 'ident' + idHosts.indexOf(box);
      const nameIn = h('input', { id: uid + '-name', type: 'text', autocomplete: 'name', value: pre.name || '', spellcheck: 'false', 'aria-describedby': uid + '-err' });
      const perSel = h('select', { id: uid + '-period', 'aria-describedby': uid + '-err' }, h('option', { value: '' }, 'Choose…'),
        PERIODS.map(p => h('option', { value: p, selected: String(pre.period) === p }, p === 'Other' ? 'Other' : 'Period ' + p)));
      const err = h('p', { class: 'id-err', id: uid + '-err', 'aria-live': 'polite' });
      const form = h('form', { class: 'id-panel', 'aria-labelledby': uid + '-title', novalidate: true },
        h('p', { class: 'id-title', id: uid + '-title' }, idn ? 'Change who is working' : (IS_LAB ? 'Who is working on this lab?' : 'Who is working?')),
        h('p', { class: 'small muted' }, 'Your name goes on your lab reports, and your simulated data will be unique to you. You only need to do this once on this computer.'),
        h('div', { class: 'id-fields' },
          h('div', { class: 'field id-f-name' }, h('label', { for: uid + '-name' }, 'Enter your name as your teacher knows it'), nameIn),
          h('div', { class: 'field id-f-period' }, h('label', { for: uid + '-period' }, 'Class period'), perSel),
          h('div', { class: 'id-actions' }, h('button', { class: 'btn btn--primary', type: 'submit' }, 'Save'),
            idn || box._compact ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { renderIdentity(box); focusIn(box, '.id-change'); } }, 'Cancel') : null)),
        err);
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const name = normName(nameIn.value), period = perSel.value;
        if (name.length < 2) { err.textContent = 'Type your name as your teacher knows it.'; nameIn.focus(); return; }
        if (!period) { err.textContent = 'Choose your class period.'; perSel.focus(); return; }
        const ok = setIdentity({ name, period });
        if (ok && IS_LAB && !SEED.sticky && studentKey({ name, period }) !== SEED.basis) { // seeding must change: reload once
          err.textContent = 'Saved. Setting up your own data…';
          reloadForSeed(); return;
        }
        idHosts.forEach(b => renderIdentity(b));
        if (IS_LAB && Lab._tourSoon) Lab._tourSoon();
        if (ok) Lab.toast('Saved: signed in as ' + name, { type: 'ok' });
        if (!ok) { const l = $('.id-line', box); if (l) l.append(h('span', { class: 'id-note' }, ' This browser is not saving data here, so your name is used on this page only.')); }
        focusIn(box, '.id-change');
      });
      box.append(form);
      return;
    }
    const line = h('p', { class: 'id-line' },
      h('span', null, 'Signed in as ', h('strong', null, idn.name), idn.period ? ' · ' + periodText(idn.period) : ''));
    if (IS_LAB) line.append(h('span', null, ' · Dataset ID ', h('code', { class: 'ds-id', title: 'Dataset number ' + SEED.datasetNumber }, SEED.datasetId)));
    line.append(' · ', h('button', { class: 'linkbtn id-change', type: 'button', 'aria-label': 'Change name or class period', onclick: () => { renderIdentity(box, 'form'); focusIn(box, 'input'); } }, 'change'));
    let confirmRow = null;
    if (IS_LAB) {
      const nb = h('button', { class: 'linkbtn id-newds', type: 'button', 'aria-expanded': 'false', onclick: () => { confirmRow.hidden = !confirmRow.hidden; nb.setAttribute('aria-expanded', String(!confirmRow.hidden)); if (!confirmRow.hidden) focusIn(confirmRow, 'button'); } }, 'New dataset');
      line.append(' · ', nb);
      confirmRow = h('div', { class: 'id-confirm', hidden: true, role: 'group', 'aria-label': 'Confirm new dataset' },
        h('span', null, 'Start a new dataset? Simulations will give different numbers from now on. Data already in your tables stays.'),
        h('button', { class: 'btn btn--sm btn--primary', type: 'button', onclick: () => Lab.identity.newDataset() }, 'Use a new dataset'),
        h('button', { class: 'btn btn--sm', type: 'button', onclick: () => { confirmRow.hidden = true; nb.setAttribute('aria-expanded', 'false'); nb.focus(); } }, 'Cancel'));
    }
    if (IS_LAB) line.append(' · ', h('button', { class: 'linkbtn id-help', type: 'button', title: 'Show the quick tour of this page again', 'aria-label': 'Help: show the quick tour again', onclick: e => { if (Lab.tour) Lab.tour.start({ opener: e.currentTarget, force: true }); } }, 'Help'));
    line.append(' · ', h('button', { class: 'linkbtn id-signout', type: 'button', title: 'Remove this student and all saved work from this computer', 'aria-haspopup': 'dialog', onclick: e => signOutDialog(e.currentTarget) }, 'Sign out'));
    box.append(line); if (confirmRow) box.append(confirmRow);
    if (homeManageRefresh) homeManageRefresh();
  }
  let homeManageRefresh = null;
  Lab.identity = {
    get: () => { const e = effectiveIdentity(); return e ? { name: e.name, period: e.period } : null; },
    set(idn) { const ok = setIdentity(idn); idHosts.forEach(b => renderIdentity(b)); return ok; },
    mount(el, opts = {}) {
      if (typeof el === 'string') el = $(el);
      if (!el || PAGE.kind === 'teacher' || PAGE.kind === 'info') return null;
      const box = h('div', { class: 'id-box' }); box._compact = !!opts.compact; idHosts.push(box); el.append(box); renderIdentity(box); return box;
    },
    newDataset() {
      const idn = effectiveIdentity(); if (!idn || !IS_LAB) return false;
      if (!gstore.set(dsKey(idn), SEED.datasetNumber + 1)) return false;
      try { localStorage.removeItem(DS_STORE); } catch (e) { /* ignore */ }
      reloadForSeed(); return true;
    },
    seed: { seed: SEED.seed, datasetId: SEED.datasetId, datasetNumber: SEED.datasetNumber, student: SEED.student },
    datasetId: SEED.datasetId,
  };
  /* On a lab page, the identity panel replaces the old per-lab "Your name" field (kept in the DOM, hidden). */
  function mountLabIdentity() {
    if (!IS_LAB || $('.id-box')) return;
    const old = $('#student-name');
    let host;
    if (old) { const f = old.closest('.field') || old; f.hidden = true; host = f.parentElement; }
    else { const main = $('main'); if (!main) return; host = h('div', { class: 'wrap gutter' }); main.prepend(host); }
    host.classList.add('id-host');
    Lab.identity.mount(host);
  }
  function reportIdentity() {
    const e = effectiveIdentity();
    return { name: e ? e.name : '', period: e ? e.period : '', datasetId: SEED.datasetId };
  }

  /* ---------------- Data management: sign out, start over ----------------
     Lab.data.signOut(opener)        dialog: remove this student and ALL saved work from this computer
     Lab.data.startOverAll(opener)   dialog (home page): erase every lab's work, keep name + class, bump dataset numbers
     Lab.data.startOverLab(opener)   dialog (lab page): erase this lab only
     Lab.data.labsWithWork()         [{id, no, done, total, text}] read from storage
     Site-wide preferences that are not personal (aplab:ui:*, aplab:pref:*) survive a sign-out. */
  const LAB_IDS = Array.from({ length: 13 }, (_, i) => 'lab' + String(i + 1).padStart(2, '0'));
  const KEEP_PREFS = ['aplab:ui:', 'aplab:pref:']; // not personal: view mode, theme
  const lsKeys = () => { try { return Object.keys(localStorage); } catch (e) { return []; } };
  const lsRemove = k => { try { localStorage.removeItem(k); } catch (e) { /* blocked */ } };
  const lsWrite = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* blocked */ } };
  const labNo = id => +String(id).slice(3);
  const FLASH_KEY = 'aplab:flash';
  function showFlash() {
    const f = sessionGet(FLASH_KEY); if (!f) return;
    try { sessionStorage.removeItem(FLASH_KEY); } catch (e) { /* ignore */ }
    const msg = f === 'signout' ? 'Signed out. This computer is ready for the next student.' : f === 'reset' ? 'All your lab work was erased. Your name and class are kept, and you will get fresh data.' : f === 'lab' ? 'This lab was erased. Your other labs are untouched.' : '';
    if (msg) Lab.toast(msg, { type: 'ok', timeout: 9000, key: 'flash' });
  }
  function firstNameOf(name) {
    let n = normName(name);
    if (n.includes(',')) n = (n.split(',')[1] || '').trim() || n;
    return n.split(' ')[0] || n;
  }
  /* The labs that hold saved work, with their progress. */
  function labsWithWork() {
    const keys = lsKeys(), out = [];
    LAB_IDS.forEach(id => {
      const pre = `aplab:${id}:`;
      const started = keys.some(k => k.startsWith(pre) && !k.endsWith(':field:student-name') && !k.endsWith(':dataset'));
      const p = gstore.get('progress:' + id);
      if (!started) return;
      const hasP = p && p.total;
      out.push({ id, no: labNo(id), done: hasP ? p.done : 0, total: hasP ? p.total : 0, text: hasP ? (progressText(p) === 'Not started' ? 'started' : progressText(p).replace(/^Started · /, 'started · ')) : 'started' });
    });
    return out;
  }
  /* A progress file for any lab, built from what is in storage (the home page has no lab open). */
  function storedPayload(id) {
    const data = {}, pre = `aplab:${id}:`;
    lsKeys().forEach(k => { if (k.startsWith(pre)) { try { data[k.slice(pre.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* skip */ } } });
    const idn = storedIdentity(), pr = gstore.get('progress:' + id);
    const p = { app: 'aplab', v: 1, lab: id, savedAt: new Date().toISOString(), exportedAt: new Date().toISOString(), student: idn ? { name: idn.name, period: idn.period } : null,
      dataset: idn ? (+gstore.get(`dataset:${id}:${studentKey(idn)}`) || 1) : 1, data };
    if (pr && pr.total) p.parts = { done: pr.done, total: pr.total };
    return p;
  }
  function downloadStoredProgress(id) {
    downloadBlob(new Blob([JSON.stringify(storedPayload(id))], { type: 'application/json' }), reportFileBase('Lab' + id.slice(3)) + '_progress.json');
    gstore.set('backup:' + id, { t: Date.now(), adopt: true });
  }
  /* Erase. keep(k) → true for keys that stay. Sets the guards first so nothing writes back before the reload. */
  function wipe(keep) {
    noFlush = true; wiped = true; if (Lab._allowLeave) Lab._allowLeave();
    lsKeys().filter(k => k.startsWith('aplab:') && !keep(k)).forEach(lsRemove);
    try { Lab.timelapse.eraseAll(); } catch (e) { /* recorded runs live in IndexedDB */ }
    try { Object.keys(sessionStorage).filter(k => k.startsWith('aplab:')).forEach(k => sessionStorage.removeItem(k)); } catch (e) { /* ignore */ }
  }
  function doSignOut() {
    wipe(k => KEEP_PREFS.some(p => k.startsWith(p)));
    memIdentity = null; memBackup = null;
    sessionSet(FLASH_KEY, 'signout');
    /* From a lab page go to the home page: reloading the lab would record a fresh "last visited" for nobody. */
    if (IS_LAB) location.assign('index.html'); else location.reload();
  }
  function doStartOverAll() {
    const idn = storedIdentity();
    const next = {};
    if (idn) LAB_IDS.forEach(id => { next[`aplab:dataset:${id}:${studentKey(idn)}`] = (+gstore.get(`dataset:${id}:${studentKey(idn)}`) || 1) + 1; });
    wipe(k => KEEP_PREFS.some(p => k.startsWith(p)) || k === 'aplab:student' || k === 'aplab:tour' || k === 'aplab:anon' || k.startsWith('aplab:dataset:'));
    Object.entries(next).forEach(([k, v]) => lsWrite(k, v));
    memBackup = null;
    sessionSet(FLASH_KEY, 'reset');
    location.reload();
  }
  function doStartOverLab() {
    const id = LAB_ID, bm = gstore.get('bookmark'), last = gstore.get('last');
    const drop = new Set([`aplab:progress:${id}`, `aplab:hint:${id}`, `aplab:backup:${id}`]);
    if (bm && bm.lab === id) drop.add('aplab:bookmark');
    if (last && last.lab === id) drop.add('aplab:last');
    noFlush = true; wiped = true; if (Lab._allowLeave) Lab._allowLeave();
    lsKeys().filter(k => k.startsWith(`aplab:${id}:`) || drop.has(k)).forEach(lsRemove);
    try { Lab.timelapse.erase(id); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem(shownKey()); } catch (e) { /* ignore */ }
    memBackup = null;
    sessionSet(FLASH_KEY, 'lab');
    location.reload();
  }

  /* The dialog. o: {id, title, warn, body: [nodes], confirmText, gate: {kind:'check'|'text', label, expect?}, onConfirm, opener}.
     role=alertdialog, background inert, Tab stays inside, Esc and Cancel close it and put focus back on the opener. */
  let dmEl = null;
  function dataDialog(o) {
    if (dmEl) return dmEl;
    const opener = o.opener || document.activeElement;
    const inerted = [];
    const uid = 'dm-' + o.id;
    const confirmBtn = h('button', { class: 'btn btn--danger-solid dm-confirm', type: 'button', disabled: true, onclick: () => { if (!confirmBtn.disabled) o.onConfirm(); } }, o.confirmText);
    let gateEl, gateNode;
    if (o.gate.kind === 'check') {
      gateEl = h('input', { type: 'checkbox', id: uid + '-gate', class: 'dm-check' });
      gateEl.addEventListener('change', () => { confirmBtn.disabled = !gateEl.checked; });
      gateNode = h('div', { class: 'dm-gate' }, h('label', { class: 'dm-check-label', for: uid + '-gate' }, gateEl, h('span', null, o.gate.label)));
    } else {
      gateEl = h('input', { type: 'text', id: uid + '-gate', class: 'dm-text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-describedby': uid + '-gate-hint' });
      const want = String(o.gate.expect), norm = v => o.gate.exact ? String(v).trim() : normName(v).toLowerCase();
      gateEl.addEventListener('input', () => { confirmBtn.disabled = norm(gateEl.value) !== norm(want); });
      gateEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (!confirmBtn.disabled) confirmBtn.click(); } });
      gateNode = h('div', { class: 'dm-gate field' }, h('label', { for: uid + '-gate' }, o.gate.label), gateEl, o.gate.hint ? h('p', { class: 'small muted', id: uid + '-gate-hint' }, o.gate.hint) : null);
    }
    const title = h('h2', { class: 'dm-title', id: uid + '-title', tabindex: '-1' }, o.title);
    const warn = h('p', { class: 'dm-warn', id: uid + '-desc' }, o.warn);
    const cancel = h('button', { class: 'btn dm-cancel', type: 'button', onclick: () => close(true) }, 'Cancel');
    const card = h('div', { class: 'dm-card', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': uid + '-title', 'aria-describedby': uid + '-desc' },
      h('p', { class: 'eyebrow dm-eyebrow' }, o.eyebrow || 'Please read'), title, warn, ...(o.body || []), gateNode,
      h('div', { class: 'dm-actions' }, confirmBtn, cancel));
    const scrim = h('div', { class: 'dm-scrim' }, card);
    function key(e) {
      if (!dmEl) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
      if (e.key !== 'Tab') return;
      const f = $$('button, a[href], input, textarea, select, [tabindex="0"]', card).filter(x => !x.disabled && !x.hidden && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1], cur = document.activeElement;
      if (e.shiftKey && (cur === first || cur === title || !card.contains(cur))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (cur === last || !card.contains(cur))) { e.preventDefault(); first.focus(); }
    }
    function close(restore) {
      if (!dmEl) return;
      document.removeEventListener('keydown', key, true);
      scrim.remove(); dmEl = null; document.body.classList.remove('has-dm');
      inerted.forEach(x => x.removeAttribute('inert'));
      if (restore && opener && opener.isConnected) { try { opener.focus(); } catch (e) { /* gone */ } }
    }
    dmEl = scrim;
    Array.from(document.body.children).forEach(x => { if (x !== scrim && !x.hasAttribute('inert') && x.tagName !== 'SCRIPT') { x.setAttribute('inert', ''); inerted.push(x); } });
    document.body.append(scrim); document.body.classList.add('has-dm');
    document.addEventListener('keydown', key, true);
    title.focus();
    return scrim;
  }

  /* "Save your work first" buttons. On a lab page: this lab's report, progress file and transfer code. Other labs: progress files. */
  function saveBlock(opts = {}) {
    const status = h('p', { class: 'tool-status', role: 'status', 'aria-live': 'polite' });
    const say = (t, bad) => { status.textContent = t; status.classList.toggle('is-bad', !!bad); };
    const kids = [];
    if (IS_LAB && opts.current !== false) {
      const docx = h('button', { class: 'btn btn--sm', type: 'button', onclick: async () => {
        docx.disabled = true; say('Building your Word file…');
        try { const blob = await Lab.report.docx(); const name = reportFileBase() + '.docx'; downloadBlob(blob, name); say(`Downloaded ${name}.`); reportSaved(); }
        catch (e) { say(e && e.message === 'docx-load' ? 'Could not load the Word file tool. Check your internet connection, or save a progress file instead.' : 'Could not build the Word file here. Save a progress file instead.', true); }
        finally { docx.disabled = false; }
      } }, 'Download report (.docx)');
      const pf = h('button', { class: 'btn btn--sm', type: 'button', onclick: () => { say(`Downloaded ${saveProgressFile()}.`); } }, 'Download progress file');
      kids.push(h('p', { class: 'dm-sub' }, `This lab (Lab ${labNo(LAB_ID)})`), h('div', { class: 'row' }, docx, pf), transferBlock());
    }
    const others = labsWithWork().filter(l => !(IS_LAB && l.id === LAB_ID));
    if (opts.others !== false && others.length) {
      kids.push(h('p', { class: 'dm-sub' }, IS_LAB ? 'Other labs with saved work' : 'Progress file for each lab with saved work'),
        h('ul', { class: 'dm-labs' }, others.map(l => h('li', null, h('span', null, h('strong', null, `Lab ${l.no}`), ` · ${l.text}`),
          h('button', { class: 'btn btn--sm', type: 'button', 'aria-label': `Download progress file for Lab ${l.no}`, onclick: () => { downloadStoredProgress(l.id); say(`Downloaded the progress file for Lab ${l.no}.`); } }, 'Download progress file')))));
    }
    if (!IS_LAB && !others.length) kids.push(h('p', { class: 'small muted' }, 'No saved lab work was found on this computer.'));
    if (!IS_LAB && others.length) kids.push(h('p', { class: 'small muted' }, 'To keep a lab report (.docx) too, open that lab first and use Submit.'));
    kids.push(status);
    return h('div', { class: 'dm-save', role: 'group', 'aria-label': 'Save your work first' }, h('p', { class: 'dm-save-title' }, 'Save your work first:'), ...kids);
  }

  function signOutDialog(opener) {
    const idn = storedIdentity() || effectiveIdentity();
    const name = idn ? idn.name : 'this student', first = idn ? firstNameOf(idn.name) : '';
    return dataDialog({
      id: 'signout', opener, eyebrow: 'Sign out', title: `Sign out ${name}?`,
      warn: `This removes ${name} and ALL of their saved work in every lab from this computer. It can't be undone.`,
      body: [saveBlock()],
      gate: { kind: 'text', label: `To confirm, type your first name (${first})`, expect: first, hint: 'The button below turns on when the name matches.' },
      confirmText: 'Sign out and erase', onConfirm: doSignOut,
    });
  }
  function startOverAllDialog(opener) {
    const idn = storedIdentity();
    const labs = labsWithWork();
    const list = labs.length
      ? h('ul', { class: 'dm-labs dm-labs--plain', 'aria-label': 'Labs with saved work' }, labs.map(l => h('li', null, h('span', null, h('strong', null, `Lab ${l.no}`), `: ${l.text}`))))
      : h('p', { class: 'small muted' }, 'No saved lab work was found. You will still get fresh data.');
    return dataDialog({
      id: 'startover', opener, eyebrow: 'Start over', title: 'Start over with all labs?',
      warn: `This erases all of your lab work in every lab on this computer. ${idn ? 'Your name and class stay, and ' : ''}you get fresh simulated data (a new Dataset ID). It can't be undone.`,
      body: [h('div', { class: 'dm-save' }, h('p', { class: 'dm-save-title' }, 'Work that will be erased:'), list), saveBlock()],
      gate: { kind: 'text', label: 'To confirm, type ERASE (capital letters)', expect: 'ERASE', exact: true, hint: 'The button below turns on when you type ERASE.' },
      confirmText: 'Erase all my lab work', onConfirm: doStartOverAll,
    });
  }
  function startOverLabDialog(opener) {
    const no = labNo(LAB_ID), p = gstore.get('progress:' + LAB_ID);
    return dataDialog({
      id: 'startlab', opener, eyebrow: 'Start over', title: `Start Lab ${no} over?`,
      warn: `This erases every answer, data table and saved result on Lab ${no}${p && p.total ? ` (${p.done} of ${p.total} parts done)` : ''} from this computer. Your name, your class and your other labs are not touched. It can't be undone.`,
      body: [saveBlock({ others: false })],
      gate: { kind: 'check', label: `I've saved anything I need from Lab ${no}.` },
      confirmText: `Erase Lab ${no} work`, onConfirm: doStartOverLab,
    });
  }

  /* Home page: a small "Manage my data" area under the signed-in line. */
  function homeManage(host) {
    const mk = (txt, fn, id) => h('button', { class: 'btn btn--sm', type: 'button', id, 'aria-haspopup': 'dialog', onclick: e => fn(e.currentTarget) }, txt);
    const box = h('details', { class: 'disclose disclose--sm manage-data' },
      h('summary', null, 'Manage my data'),
      h('div', { class: 'inner' },
        h('p', { class: 'small muted' }, 'Your work is saved only in this browser. On a shared computer, sign out when you finish. Start over erases your lab work but keeps your name.'),
        h('div', { class: 'row' }, mk('Start over with all labs…', startOverAllDialog, 'md-startover'), mk('Sign out…', signOutDialog, 'md-signout'))));
    host.append(box);
    homeManageRefresh = () => { box.hidden = !(storedIdentity() || labsWithWork().length); };
    homeManageRefresh();
  }
  Lab.data = { signOut: signOutDialog, startOverAll: startOverAllDialog, startOverLab: startOverLabDialog, labsWithWork, wipe };

  /* ---------------- Responses toolbar: copy all work ---------------- */
  function collectText() {
    const title = cleanTitle(document.title);
    const lines = [title, '='.repeat(title.length), ''];
    const who = reportIdentity();
    if (who.name) lines.push('Name: ' + who.name);
    if (who.period) lines.push('Class period: ' + who.period);
    if (IS_LAB) lines.push('Dataset ID: ' + who.datasetId);
    lines.push('');
    $$('.step').forEach(sec => {
      const fields = $$('[data-save]', sec).filter(f => f.id !== 'student-name' && (f.tagName === 'TEXTAREA' || f.dataset.label));
      const tables = $$('table.data', sec);
      if (!fields.length && !tables.length) return;
      lines.push('## ' + (sec.dataset.step || ''), '');
      fields.forEach(f => {
        const label = f.dataset.label || (f.labels && f.labels[0] ? f.labels[0].textContent : f.dataset.save);
        lines.push(label.trim(), (f.type === 'checkbox' ? (f.checked ? 'Yes' : 'No') : f.value.trim()) || '(no response)', '');
      });
      tables.forEach(t => {
        $$('tr', t).forEach(tr => lines.push($$('th,td', tr).map(c => { const i = $('input', c); return (i ? i.value : c.textContent).trim(); }).join('\t')));
        lines.push('');
      });
    });
    return lines.join('\n');
  }
  Lab.responses = function (el) {
    if (typeof el === 'string') el = $(el);
    const msg = h('span', { class: 'grow', 'aria-live': 'polite' }, 'Your answers save in this browser automatically. Copy them to paste into a document or your class LMS.');
    const fallback = h('textarea', { class: 'copy-fallback', hidden: true, readonly: true, 'aria-label': 'Your responses as text' });
    const copyBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
      const text = collectText();
      try { await navigator.clipboard.writeText(text); msg.textContent = 'Copied. Paste it into your document or LMS.'; fallback.hidden = true; Lab.toast('Copied all your responses', { type: 'ok', announce: false }); }
      catch (e) { fallback.value = text; fallback.hidden = false; fallback.focus(); fallback.select(); msg.textContent = 'Copy is blocked here. Your text is selected below: press Ctrl+C (or ⌘C).'; }
    } }, 'Copy all my responses');
    const clearBtn = h('button', { class: 'btn btn--ghost btn--sm btn-startover', type: 'button', 'aria-haspopup': 'dialog', onclick: () => startOverLabDialog(clearBtn) }, 'Start over');
    el.append(h('div', { class: 'responses-bar' }, msg, copyBtn, clearBtn), fallback);
    if (PAGE.kind !== 'teacher' && PAGE.kind !== 'info') el.append(...reportTools(), transferBlock(), moveWorkPanel());
  };

  /* ---------------- Hosting environment ----------------
     A private preview copy runs framed and blocks downloads, print() and fetch to other hosts.
     We detect failures where we can and otherwise show PREVIEW_NOTE when the page is framed off GitHub Pages. */
  const FRAMED = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
  const LIKELY_PREVIEW = FRAMED && !/\.github\.io$/i.test(location.hostname || '');
  const PREVIEW_NOTE = 'Downloads and printing work on the class website, not in this preview.';
  Lab.env = { framed: FRAMED, likelyPreview: LIKELY_PREVIEW };
  function previewNote(hidden = !LIKELY_PREVIEW) { return h('p', { class: 'preview-note', hidden }, PREVIEW_NOTE); }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name, style: 'display:none' });
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
  }
  /* window.print() with detection: a blocked print (sandboxed preview) never fires beforeprint. */
  function tryPrint(onBlocked) {
    let fired = false; const f = () => { fired = true; };
    window.addEventListener('beforeprint', f);
    try { window.print(); } catch (e) { /* blocked */ }
    setTimeout(() => { window.removeEventListener('beforeprint', f); if (!fired && onBlocked) onBlocked(); }, 400);
  }
  /* Run fn with the browser's own Math.random so library code does not use up the student's seeded stream. */
  async function withNativeRandom(fn) {
    const seeded = Math.random; Math.random = nativeRandom;
    try { return await fn(); } finally { Math.random = seeded; }
  }
  /* Temporarily force light-theme tokens (print/report views). Returns a restore function. */
  function forceLight() {
    const root = document.documentElement, prev = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    return () => { if (prev == null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', prev); };
  }
  /* ---- Printing: light colors and static pictures of every canvas ----
     A canvas is drawn with the colors of the theme that was on screen (dark mode gives pale lines on a dark scene) and a part that is
     hidden has no real size, so printing the page as it is can give dark or blank pictures. Lab.print.prepare() (run on beforeprint,
     and while building the worksheet) switches to the light tokens, redraws every canvas, chart and microscope view, and puts a static
     <img> snapshot (canvas.toDataURL) next to each visible canvas, hiding the canvas. Lab.print.restore() (afterprint) undoes all of it.
     A canvas that cannot be read (a tainted canvas) is left as it is. */
  const PRINT = { snaps: [], restoreTheme: null, on: false };
  function redrawEverything() {
    quietBadges(900);
    try { CANVASES.forEach(c => c.check()); themeRedraw(); flushResize(); flushFrames(); } catch (e) { /* ignore */ }
  }
  function printPrepare() {
    if (PRINT.on) return PRINT.snaps.length;
    PRINT.on = true;
    if (isDarkNow()) { PRINT.restoreTheme = forceLight(); }
    redrawEverything();
    $$('canvas').forEach(cv => {
      if (cv.closest('.print-snap') || !cv.getClientRects().length || !cv.clientWidth || !cv.clientHeight) return;
      let url; try { url = cv.toDataURL('image/png'); } catch (e) { return; }
      const img = h('img', { class: (cv.className ? cv.className + ' ' : '') + 'print-snap', src: url, alt: cv.getAttribute('aria-label') || '', width: cv.clientWidth, height: cv.clientHeight });
      img.style.cssText = cv.style.cssText;
      PRINT.snaps.push({ cv, img, display: cv.style.display });
      cv.after(img); cv.style.display = 'none';
    });
    return PRINT.snaps.length;
  }
  function printRestore() {
    if (!PRINT.on) return;
    PRINT.on = false;
    PRINT.snaps.forEach(x => { x.img.remove(); x.cv.style.display = x.display; });
    PRINT.snaps = [];
    if (PRINT.restoreTheme) { PRINT.restoreTheme(); PRINT.restoreTheme = null; redrawEverything(); }
  }
  Lab.print = { prepare: printPrepare, restore: printRestore, get snapshots() { return PRINT.snaps.map(x => x.img); } };
  function lightTokenResolver() {
    const restore = forceLight(), cs = getComputedStyle(document.documentElement), cache = {};
    const names = ['--bg', '--surface', '--surface-2', '--ink', '--muted', '--line', '--grid', '--accent', '--stain', '--ok', '--warn', '--bad', '--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];
    names.forEach(n => { cache[n] = cs.getPropertyValue(n).trim(); });
    restore();
    return name => cache[name] || '#555555';
  }

  /* ---------------- Lab report (collect → .docx or print view) ---------------- */
  const stripHtml = s => { const d = document.createElement('div'); d.innerHTML = String(s == null ? '' : s); return d.textContent.replace(/\s+/g, ' ').trim(); };
  const fieldLabel = f => (f.dataset.label || (f.labels && f.labels[0] ? f.labels[0].textContent : '') || f.dataset.save || '').replace(/\s+/g, ' ').trim();
  function fieldValue(f) {
    if (f.type === 'checkbox') return f.checked ? 'Yes' : 'No';
    if (f.tagName === 'SELECT') { const o = f.selectedOptions && f.selectedOptions[0]; return o ? o.textContent.trim() : ''; }
    return (f.value || '').trim();
  }
  /* ---- Running header/footer on every printed page (report PDF, .docx, worksheet) ----
     Browsers with CSS paged-media margin boxes (Chromium 131+) get @top/@bottom boxes from a temporary <style>.
     Others get a repeated header: the content sits in a display:table whose header group repeats on each page
     (body.pr-fallback). The fallback cannot show a page number. */
  const cleanTitle = t => String(t || '').replace(/\s+[—–-]\s+AP Bio (Digital )?Lab Bench\s*$/, '').trim();
  const HAS_MARGIN_BOXES = (function () { const m = /Chrome\/(\d+)/.exec(navigator.userAgent || ''); return !!m && +m[1] >= 131; })();
  const cssStr = t => '"' + String(t).replace(/[\\"]/g, '').replace(/[\r\n]+/g, ' ') + '"';
  function printRun(a, body) { // a: {left, right, bottomLeft} plain text; body: the page HTML. A real table so every browser repeats the header group.
    return `<table class="pr-t" role="presentation"><thead class="pr-thead print-run" aria-hidden="true"><tr><td><span>${esc(a.left)}</span><span>${esc(a.right)}</span><span>${esc(a.bottomLeft)}</span></td></tr></thead><tbody><tr><td class="pr-body">${body}</td></tr></tbody></table>`;
  }
  function printPageStyle(id, a, margin) {
    const f = 'font: 9pt Arial, sans-serif; color: #444;';
    const boxes = HAS_MARGIN_BOXES ? ` @top-left { content: ${cssStr(a.left)}; ${f} } @top-right { content: ${cssStr(a.right)}; ${f} } @bottom-left { content: ${cssStr(a.bottomLeft)}; ${f} } @bottom-right { content: "Page " counter(page) " of " counter(pages); ${f} }` : '';
    document.body.classList.toggle('pr-fallback', !HAS_MARGIN_BOXES);
    return h('style', { id, text: `@page { size: letter; margin: ${margin};${boxes} }` });
  }
  const labTag = () => { const m = /^lab(\d\d)$/.exec(PAGE.id); return m ? 'Lab' + m[1] : 'Lab'; };
  function reportFileBase(tag) {
    const who = reportIdentity().name;
    let first = '', last = '';
    if (who.includes(',')) { [last, first] = who.split(',').map(s => s.trim()); }
    else { const parts = who.split(' ').filter(Boolean); if (parts.length > 1) { last = parts.pop(); first = parts.join(' '); } else last = parts[0] || ''; }
    const clean = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    return [tag || labTag(), clean(last), clean(first)].filter(Boolean).join('_') || tag || labTag();
  }
  function quizItem(q) {
    const st = q.state() || {};
    let right = 0;
    const qs = q.questions.map((qq, i) => {
      const s = st[i];
      let ans = '';
      if (s && s.value != null && s.value !== '') {
        if (qq.type === 'num') ans = String(s.value) + (qq.unit ? ' ' + stripHtml(qq.unit) : '');
        else ans = [].concat(s.value).map(v => stripHtml(qq.choices[+v])).join('; ');
      }
      if (s && s.correct) right++;
      return { q: stripHtml(qq.q), answer: ans, status: !s ? 'Not answered' : (s.correct ? 'Correct' : 'Incorrect') };
    });
    return { kind: 'quiz', id: q.id, right, total: q.questions.length, questions: qs };
  }
  function tableItem(t) {
    const cellText = c => { const i = $('input, select', c); return (i ? i.value : c.textContent).replace(/\s+/g, ' ').trim(); };
    const head = $$('thead th', t).map(cellText);
    const rows = $$('tbody tr', t).filter(tr => !(tr.cells.length === 1 && tr.cells[0].colSpan > 1)).map(tr => $$('th,td', tr).map(cellText));
    const foot = $$('tfoot tr', t).map(tr => $$('th,td', tr).map(cellText));
    if (!rows.length) return null;
    return { kind: 'table', head, rows, foot };
  }
  const chartHasData = o => (o.series || []).some(s => (s.points || []).some(p => p && isFinite(p.y)));
  function collectReport() {
    const who = reportIdentity();
    const hd = $('.lab-header');
    const title = hd && $('h1', hd) ? hd.querySelector('h1').textContent.trim() : document.title;
    const quizByEl = new Map(REG.quizzes.map(q => [q.el, q])), chartByEl = new Map(REG.charts.map(c => [c.el, c]));
    const sections = [];
    $$('section.step').forEach(sec => {
      const items = [];
      $$('[data-save], .quiz, table.data, .chart', sec).forEach(n => {
        if (n.closest('.id-box')) return;
        if (n.matches('.quiz')) { const q = quizByEl.get(n); if (q) items.push(quizItem(q)); return; }
        if (n.closest('.quiz')) return;
        if (n.matches('.chart')) {
          const c = chartByEl.get(n);
          if (c && $('svg', n) && chartHasData(c.opts)) { const full = h('div', { class: 'chart', html: c.html(640) }); items.push({ kind: 'chart', el: full, opts: c.opts }); } // full-size copy, whatever width it is shown at
          return;
        }
        if (n.matches('table.data')) { const t = tableItem(n); if (t) items.push(t); return; }
        if (n.id === 'student-name' || !(n.tagName === 'TEXTAREA' || n.dataset.label)) return;
        items.push({ kind: 'answer', q: fieldLabel(n), a: fieldValue(n) });
      });
      const h2 = $(':scope > header h2', sec);
      if (items.length) sections.push({ name: sec.dataset.step || '', heading: h2 ? h2.textContent.trim() : '', items });
    });
    return {
      title, docTitle: cleanTitle(document.title), labTitle: cleanTitle(document.title), lab: PAGE.id, labNo: labTag().replace('Lab', ''),
      name: who.name, period: who.period, datasetId: who.datasetId,
      date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      sections,
      keyResults: Lab.keyResults().map(r => ({ id: r.id, label: String(r.label == null ? r.id : r.label), text: keyResultText(r), value: r.value == null ? '' : String(r.value), unit: r.unit || '', note: r.note || '', part: r.part || '' })),
    };
  }
  /* Chart SVG → PNG in light colors (CSS variables resolved), legend and fit notes drawn in. */
  async function chartPng(el, tok) {
    const svg = $('svg', el); if (!svg) return null;
    const vb = svg.viewBox && svg.viewBox.baseVal; const W = (vb && vb.width) || 640, H = (vb && vb.height) || 360;
    const xs = new XMLSerializer();
    let body = Array.from(svg.childNodes).map(n => xs.serializeToString(n)).join('');
    const legend = $$('.legend span', el).map(s => ({ color: (s.querySelector('i') || {}).style ? s.querySelector('i').style.background : '', text: s.textContent.trim() }));
    const notes = $$('.chart-note', el).flatMap(n => n.innerHTML.split(/<br\s*\/?>/i).map(stripHtml)).filter(Boolean);
    let y = H + 4, extra = '';
    if (legend.length) {
      let x = 64; y += 16;
      legend.forEach(l => {
        const w = 22 + l.text.length * 6.6 + 14;
        if (x + w > W - 10 && x > 64) { x = 64; y += 20; }
        extra += `<rect x="${x}" y="${y - 10}" width="12" height="12" rx="3" style="fill:${l.color}"/><text x="${x + 18}" y="${y}">${esc(l.text)}</text>`;
        x += w;
      });
      y += 8;
    }
    notes.forEach(t => { y += 17; extra += `<text x="64" y="${y}" class="note">${esc(t)}</text>`; });
    const HH = Math.ceil(y + 8);
    const style = `<style>text{font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;fill:var(--muted)}.axis-label{fill:var(--ink);font-weight:600;font-size:13px}.gridline{stroke:var(--grid);stroke-width:1}.axis{stroke:var(--muted);stroke-width:1}.note{font-family:Consolas,'Courier New',monospace;font-size:11px}</style>`;
    let str = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HH}" viewBox="0 0 ${W} ${HH}"><rect x="0" y="0" width="${W}" height="${HH}" fill="#ffffff"/>${style}${body}${extra}</svg>`;
    str = str.replace(/var\((--[\w-]+)\)/g, (m, k) => tok(k));
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('chart render failed')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str); });
    const scale = 2, cv = document.createElement('canvas'); cv.width = W * scale; cv.height = HH * scale;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
    return { dataUrl: cv.toDataURL('image/png'), width: W, height: HH, alt: 'Graph: ' + (svg.getAttribute('aria-label') || '') };
  }
  async function renderCharts(rep) {
    const tok = lightTokenResolver();
    for (const s of rep.sections) for (const it of s.items) if (it.kind === 'chart' && !it.png) {
      try { it.png = await chartPng(it.el, tok); } catch (e) { it.png = null; }
    }
    return rep;
  }
  const dataUrlBytes = u => { const bin = atob(u.split(',')[1]); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

  /* docx (https://docx.js.org) UMD build, pinned, loaded only when a student asks for a Word file. */
  const DOCX_URLS = ['https://cdn.jsdelivr.net/npm/docx@9.0.2/build/index.umd.js', 'https://unpkg.com/docx@9.0.2/build/index.umd.js'];
  let docxPromise = null;
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => { s.remove(); rej(new Error('load failed ' + src)); }; document.head.append(s); });
  }
  function loadDocx() {
    if (window.docx && window.docx.Packer) return Promise.resolve(window.docx);
    if (!docxPromise) docxPromise = (async () => {
      for (const u of DOCX_URLS) { try { await loadScript(u); if (window.docx && window.docx.Packer) return window.docx; } catch (e) { /* try next */ } }
      docxPromise = null; throw new Error('docx-load');
    })();
    return docxPromise;
  }
  async function buildDocx(rep) {
    const D = await loadDocx();
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun, ShadingType, BorderStyle, Header, Footer, PageNumber, TabStopType } = D;
    const P = (text, o = {}) => new Paragraph(Object.assign({ children: [new TextRun(Object.assign({ text: String(text) }, o.run || {}))] }, o.para || {}));
    const kids = [];
    kids.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(rep.docTitle || rep.title)] }));
    const info = [['Name', rep.name || '(not entered)'], ['Class period', rep.period || '—'], ['Date', rep.date], ['Dataset ID', rep.datasetId]];
    info.forEach(([k, v]) => kids.push(new Paragraph({ children: [new TextRun({ text: k + ': ', bold: true }), new TextRun(String(v))] })));
    const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
    const borders = { top: border, bottom: border, left: border, right: border };
    const cell = (t, head) => new TableCell({ borders, shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E8EEEA' } : undefined, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: String(t == null ? '' : t), bold: !!head, size: 18 })] })] });
    if (rep.keyResults && rep.keyResults.length) {
      const anyNote = rep.keyResults.some(r => r.note);
      const krCell = r => new TableCell({ borders, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: String(r.label), bold: true, size: 18 }), new TextRun({ text: ': ' + r.text, size: 18 })] })] });
      kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320 }, children: [new TextRun('Key results')] }));
      kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: (anyNote ? ['Result', 'Notes'] : ['Result']).map(t => cell(t, true)) })].concat(rep.keyResults.map(r => new TableRow({ cantSplit: true, children: anyNote ? [krCell(r), cell(r.note)] : [krCell(r)] }))) }));
    }
    for (const s of rep.sections.concat(rep.timelapse && rep.timelapse.length ? [{ timelapse: true, name: 'My timelapse', items: [] }] : [])) {
      kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320 }, children: [new TextRun(s.name + (s.heading && s.heading !== s.name ? ': ' + s.heading : ''))] }));
      if (s.timelapse) rep.timelapse.forEach(t => {
        kids.push(P(t.label + ': your run, replayed about 15 times faster (an animated GIF; it plays in Word when you open the file).', { run: { italics: true }, para: { spacing: { before: 120 } } }));
        kids.push(new Paragraph({ spacing: { before: 80 }, children: [new ImageRun({ type: 'gif', data: t.bytes, transformation: { width: t.width, height: t.height }, altText: { name: 'Timelapse', title: 'Timelapse: ' + t.label, description: 'Animated timelapse of the student run: ' + t.label } })] }));
      });
      for (const it of s.items) {
        if (it.kind === 'answer') {
          kids.push(P(it.q, { run: { bold: true }, para: { spacing: { before: 160 } } }));
          const lines = it.a ? it.a.split(/\r?\n/) : [];
          if (!lines.length) kids.push(P('(no response)', { run: { italics: true, color: '666666' } }));
          else lines.forEach(l => kids.push(P(l)));
        } else if (it.kind === 'quiz') {
          kids.push(P(`Pre-lab quiz: ${it.right} of ${it.total} correct`, { run: { bold: true }, para: { spacing: { before: 160 } } }));
          it.questions.forEach((q, i) => {
            kids.push(P(`${i + 1}. ${q.q}`, { para: { spacing: { before: 100 } } }));
            kids.push(new Paragraph({ indent: { left: 360 }, children: [new TextRun({ text: 'Answer: ', bold: true }), new TextRun(q.answer || '—'), new TextRun({ text: '  (' + q.status + ')', italics: true })] }));
          });
        } else if (it.kind === 'table') {
          const rows = [new TableRow({ tableHeader: true, children: it.head.map(t => cell(t, true)) })]
            .concat(it.rows.map(r => new TableRow({ cantSplit: true, children: it.head.map((_, i) => cell(r[i])) })))
            .concat(it.foot.map(r => new TableRow({ children: it.head.map((_, i) => cell(r[i], true)) })));
          kids.push(new Paragraph({ spacing: { before: 120 }, children: [] }));
          kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
        } else if (it.kind === 'chart' && it.png) {
          const w = 600, hgt = Math.round(w * it.png.height / it.png.width);
          kids.push(new Paragraph({ spacing: { before: 160 }, children: [new ImageRun({ type: 'png', data: dataUrlBytes(it.png.dataUrl), transformation: { width: w, height: hgt }, altText: { name: 'Graph', title: 'Graph', description: it.png.alt || 'Graph' } })] }));
        }
      }
    }
    /* The student's full progress payload (identity, Dataset ID, every stored key, key results, quiz answers, step state,
       timestamps) rides inside the .docx as custom document properties aplab_payload_000, _001, …: a resume code
       (gzip + base64) cut into 2000-character pieces. teacher-dashboard.html reads them back. */
    const customProperties = [{ name: 'aplab_format', value: 'LB1' }];
    if (rep.embed) for (let i = 0, n = 0; i < rep.embed.length; i += 2000, n++) customProperties.push({ name: 'aplab_payload_' + String(n).padStart(3, '0'), value: rep.embed.slice(i, i + 2000) });
    const doc = new Document({
      customProperties,
      creator: rep.name || 'Student', title: rep.docTitle || rep.title,
      styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
      sections: [{
        properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080, header: 360 } } },
        headers: { default: new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: 10080 }], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '999999', space: 4 } }, children: [
          new TextRun({ text: (rep.name || '(name not entered)') + (rep.period ? ' · Class ' + rep.period : ''), size: 18, color: '444444' }),
          new TextRun({ text: '\t' + rep.labTitle, size: 18, color: '444444' }),
          rep.stamp ? new TextRun({ text: '  ', size: 18 }) : null,
          rep.stamp ? new ImageRun({ type: 'png', data: rep.stamp.bytes, transformation: { width: 80, height: 80 }, altText: { name: 'Bench-verified stamp', title: 'Bench-verified stamp', description: rep.stamp.alt } }) : null].filter(Boolean) })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: 10080 }], children: [
          new TextRun({ text: 'Dataset ID: ' + rep.datasetId, size: 18, color: '444444' }),
          new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 18, color: '444444' })] })] }) },
        children: kids }],
    });
    return Packer.toBlob(doc);
  }

  /* Print-styled report view (body.report-mode) for Save as PDF. */
  let reportOpener = null, restoreTheme = null;
  function reportHtml(rep) {
    const out = [];
    out.push(`<header class="rv-head">${rep.stamp ? `<img class="rv-stamp" src="${rep.stamp.dataUrl}" alt="${esc(rep.stamp.alt)}" width="110" height="110">` : ''}<p class="rv-eyebrow">AP Biology lab report</p><h1 id="rv-title">${esc(rep.docTitle || rep.title)}</h1>
      <dl class="rv-info"><div><dt>Name</dt><dd>${esc(rep.name || '(not entered)')}</dd></div><div><dt>Class period</dt><dd>${esc(rep.period || '—')}</dd></div><div><dt>Date</dt><dd>${esc(rep.date)}</dd></div><div><dt>Dataset ID</dt><dd>${esc(rep.datasetId)}</dd></div></dl></header>`);
    if (rep.keyResults && rep.keyResults.length) { const anyNote = rep.keyResults.some(r => r.note); out.push(`<section class="rv-sec"><h2>Key results</h2><table class="rv-table"><thead><tr><th>Result</th>${anyNote ? '<th>Notes</th>' : ''}</tr></thead><tbody>${rep.keyResults.map(r => `<tr><td><strong>${esc(r.label)}</strong>: ${esc(r.text)}</td>${anyNote ? `<td>${esc(r.note)}</td>` : ''}</tr>`).join('')}</tbody></table></section>`); }
    if (!rep.sections.length) out.push('<p>No answers or data yet.</p>');
    rep.sections.forEach((s, si) => {
      out.push(`<section class="rv-sec"><h2>${esc(s.name)}${s.heading && s.heading !== s.name ? `<span class="rv-sub">: ${esc(s.heading)}</span>` : ''}</h2>`);
      s.items.forEach((it, ii) => {
        if (it.kind === 'answer') out.push(`<div class="rv-qa"><p class="rv-q">${esc(it.q)}</p>${it.a ? it.a.split(/\r?\n/).map(l => `<p>${esc(l) || '&nbsp;'}</p>`).join('') : '<p class="rv-none">(no response)</p>'}</div>`);
        else if (it.kind === 'quiz') out.push(`<div class="rv-quiz"><p class="rv-q">Pre-lab quiz: ${it.right} of ${it.total} correct</p><ol>${it.questions.map(q => `<li><p>${esc(q.q)}</p><p><strong>Answer:</strong> ${esc(q.answer || '—')} <em>(${q.status})</em></p></li>`).join('')}</ol></div>`);
        else if (it.kind === 'table') out.push(`<table class="rv-table"><thead><tr>${it.head.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${it.rows.map(r => `<tr>${it.head.map((_, i) => `<td>${esc(r[i] == null ? '' : r[i])}</td>`).join('')}</tr>`).join('')}</tbody>${it.foot.length ? `<tfoot>${it.foot.map(r => `<tr>${it.head.map((_, i) => `<td>${esc(r[i] == null ? '' : r[i])}</td>`).join('')}</tr>`).join('')}</tfoot>` : ''}</table>`);
        else if (it.kind === 'chart' && it.png) out.push(`<figure class="rv-fig"><img src="${it.png.dataUrl}" alt="${esc(it.png.alt)}" width="${it.png.width}" height="${it.png.height}"></figure>`);
      });
      out.push('</section>');
    });
    return out.join('');
  }
  function closeReport() {
    const v = $('#lab-report'); if (v) v.remove();
    const ps = $('#rv-page-style'); if (ps) ps.remove();
    document.body.classList.remove('report-mode', 'pr-fallback');
    if (restoreTheme) { restoreTheme(); restoreTheme = null; }
    document.removeEventListener('keydown', reportKey);
    if (reportOpener) { try { reportOpener.focus(); } catch (e) { /* gone */ } reportOpener = null; }
  }
  function reportKey(e) { if (e.key === 'Escape') closeReport(); }
  /* "Include my timelapse in the report": a GIF per recorded run (smaller than the download: 320 px, at most 90 frames), inserted after the last section. */
  const tlInclude = () => !!store.get('tl-include');
  async function reportTimelapse() {
    const out = [];
    for (const r of Lab.timelapse.withRun()) { try { const blob = await r.gif({ width: 320, maxFrames: 90, speed: 15 }); out.push({ label: r.label, bytes: new Uint8Array(await blob.arrayBuffer()), width: 320, height: Math.round(320 * r.height / r.width) }); } catch (e) { /* a run that cannot be encoded is left out */ } }
    return out;
  }
  /* The "Bench-verified" stamp for this report (see Stamp); a failure just leaves it out. */
  function reportStamp(rep) { try { return Lab.stamp.png({ datasetId: rep.datasetId }); } catch (e) { return null; } }
  /* A report was downloaded or sent to the print dialog: the one confetti burst (see Celebrations), only if every part is done. */
  function reportSaved() { try { Lab.celebrate.lab(); } catch (e) { /* never block a download */ } }
  async function openReport(o = {}) {
    closeReport(); flushSaves();
    reportOpener = o.opener || document.activeElement;
    const rep = await renderCharts(collectReport());
    rep.stamp = reportStamp(rep);
    restoreTheme = forceLight();
    const run = { left: (rep.name || '(name not entered)') + (rep.period ? ' · Class ' + rep.period : ''), right: rep.labTitle, bottomLeft: 'Dataset ID: ' + rep.datasetId };
    const rvStyle = printPageStyle('rv-page-style', run, '.7in .6in .6in');
    document.head.append(rvStyle);
    const note = previewNote(true);
    const status = h('p', { class: 'rv-status', 'aria-live': 'polite' });
    const doPrint = () => { tryPrint(() => { note.hidden = false; }); setTimeout(reportSaved, 450); }; // window.print() returns when the print dialog closes
    const view = h('div', { id: 'lab-report', class: 'report-view', role: 'region', 'aria-labelledby': 'rv-title' },
      h('div', { class: 'rv-tools' },
        h('div', { class: 'row' },
          h('button', { class: 'btn btn--primary', type: 'button', onclick: doPrint }, 'Print or save as PDF'),
          h('button', { class: 'btn', type: 'button', onclick: closeReport }, 'Close report')),
        h('p', { class: 'small' }, 'In the print window, set the printer (Destination) to “Save as PDF” or “Microsoft Print to PDF”, then hand in the PDF the way your teacher asks.'),
        note, status),
      h('article', { class: 'rv-paper', html: printRun(run, reportHtml(rep)) }));
    document.body.append(view);
    document.body.classList.add('report-mode');
    document.addEventListener('keydown', reportKey);
    window.scrollTo(0, 0);
    const t = $('#rv-title'); if (t) { t.tabIndex = -1; t.focus(); }
    if (o.print) setTimeout(doPrint, 60);
    return rep;
  }
  Lab.report = {
    collect: collectReport,
    filename: () => reportFileBase(),
    open: openReport, close: closeReport,
    async docx(o = {}) { const rep = await renderCharts(collectReport()); rep.stamp = reportStamp(rep); if (o.timelapse != null ? o.timelapse : tlInclude()) rep.timelapse = await reportTimelapse(); try { rep.embed = await makeResumeCode(progressPayload(true)); } catch (e) { rep.embed = ''; } return withNativeRandom(() => buildDocx(rep)); },
    docxUrls: DOCX_URLS,
  };

  /* ---------------- Save / resume (progress file + resume code) ----------------
     Payload: {app:'aplab', v:1, lab, title, savedAt, student:{name,period}|null, dataset, data:{key: value}}
     data holds every localStorage value this lab saves (aplab:<lab>:*). */
  /* Extra summary for the teacher dashboard (progress file and .docx only; the resume code stays lean so its QR code fits). */
  function dashboardExtras() {
    const partList = $$('section.step').map(sec => { const r = sectionWork(sec); return { id: sec.id, name: sec.dataset.step || '', done: r.done, total: r.total }; }).filter(p => p.total > 0);
    return {
      datasetId: SEED.datasetId, labTitle: cleanTitle(document.title), exportedAt: new Date().toISOString(),
      keyResults: Lab.keyResults(),
      quizzes: REG.quizzes.map(quizItem),
      parts: { done: partList.filter(p => p.done === p.total).length, total: partList.length },
      partList,
    };
  }
  function progressPayload(full) {
    flushSaves();
    const data = {}, pre = `aplab:${LAB_ID}:`;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(pre)) { try { data[k.slice(pre.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* skip bad value */ } }
      }
    } catch (e) { /* storage blocked */ }
    const idn = effectiveIdentity();
    const p = { app: 'aplab', v: 1, lab: LAB_ID, title: document.title, savedAt: new Date().toISOString(), student: idn ? { name: idn.name, period: idn.period } : null, dataset: SEED.datasetNumber, data };
    if (full === true && IS_LAB) { try { Object.assign(p, dashboardExtras()); } catch (e) { /* extras are optional */ } }
    return p;
  }
  function parseProgress(text, anyLab) {
    let o;
    try { o = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { throw new Error('That is not a progress file. Choose the .json file you saved from this lab.'); }
    if (!o || typeof o !== 'object' || o.app !== 'aplab' || !o.data || typeof o.data !== 'object' || Array.isArray(o.data)) throw new Error('That does not look like a Lab Bench progress file.');
    if (typeof o.v !== 'number' || o.v > 1) throw new Error('That progress file was made by a newer version of this site. Reload the page and try again.');
    if (typeof o.lab !== 'string') throw new Error('That progress file is missing its lab number.');
    if (!anyLab && o.lab !== LAB_ID) { const m = /^lab(\d\d)$/.exec(o.lab); throw new Error(m ? `That progress file is for Lab ${+m[1]}. Open Lab ${+m[1]} and load it there.` : 'That progress file is for a different page.'); }
    if (o.student && (typeof o.student.name !== 'string' || !normName(o.student.name))) o.student = null;
    return o;
  }
  function applyProgress(o) {
    try {
      store.clearLab();
      Object.entries(o.data).forEach(([k, v]) => localStorage.setItem(`aplab:${LAB_ID}:${k}`, JSON.stringify(v)));
    } catch (e) { throw new Error('This browser is not letting the site save data, so the progress could not be loaded here.'); }
    if (o.student) {
      setIdentity(o.student);
      if (o.dataset > 1) gstore.set(`dataset:${PAGE.id}:${studentKey(o.student)}`, Math.floor(o.dataset));
    }
    gstore.set('backup:' + LAB_ID, { t: Date.now(), adopt: true }); // loaded from a backup: nothing is unsaved until the student changes it
    reloadClean();
  }
  const b64u = {
    enc(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const bin = atob(str); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; },
  };
  async function makeResumeCode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj || progressPayload()));
    if (typeof CompressionStream === 'function') {
      try { const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer(); return 'LB1z.' + b64u.enc(new Uint8Array(buf)); } catch (e) { /* fall back */ }
    }
    return 'LB1b.' + b64u.enc(bytes);
  }
  async function readResumeCode(code, anyLab) {
    code = String(code || '').replace(/\s+/g, '');
    if (!code) throw new Error('Paste your resume code first.');
    const m = /^LB1([zb])\.([A-Za-z0-9_-]+)$/.exec(code);
    if (!m) throw new Error('That is not a resume code. A resume code starts with LB1. Copy the whole code and try again.');
    let bytes;
    try { bytes = b64u.dec(m[2]); } catch (e) { throw new Error('That resume code is damaged. Copy the whole code and try again.'); }
    if (m[1] === 'z') {
      if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open compressed resume codes. Use a progress file instead.');
      try { bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); }
      catch (e) { throw new Error('That resume code is incomplete or damaged. Copy the whole code and try again.'); }
    }
    let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { throw new Error('That resume code is damaged. Copy the whole code and try again.'); }
    return parseProgress(text, anyLab);
  }
  Lab.progressFile = { payload: progressPayload, parse: parseProgress, apply: applyProgress, makeCode: makeResumeCode, readCode: readResumeCode };

  /* Download the progress file and record it as the latest backup. Returns the file name. */
  function saveProgressFile() {
    const p = progressPayload(true);
    const name = reportFileBase() + '_progress.json';
    downloadBlob(new Blob([JSON.stringify(p)], { type: 'application/json' }), name);
    if (Lab.backup) Lab.backup.markSaved('file');
    return name;
  }
  /* ---------------- Transfer code (code + QR) ----------------
     "Get my transfer code" shows the resume code in large type and a QR code for <lab>.html#resume=<code>, so a student can
     photograph it and carry on from a phone or another computer. The QR library (qrcode-generator, pinned) loads only then. */
  const QR_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'];
  const CANON_BASE = 'https://smitka313.github.io/APBioLabs/';
  let qrPromise = null;
  function loadQr() {
    if (typeof window.qrcode === 'function') return Promise.resolve(window.qrcode);
    if (!qrPromise) qrPromise = (async () => {
      for (const u of QR_URLS) { try { await loadScript(u); if (typeof window.qrcode === 'function') return window.qrcode; } catch (e) { /* try next */ } }
      qrPromise = null; throw new Error('qr-load');
    })();
    return qrPromise;
  }
  function transferUrl(code) {
    const base = /^https?:$/.test(location.protocol) ? location.origin + location.pathname.replace(/[^/]*$/, '') : CANON_BASE;
    return base + PAGE.id + '.html#resume=' + code;
  }
  Lab.transfer = { url: transferUrl, code: () => makeResumeCode() };
  async function fillTransfer(out) {
    out.innerHTML = '';
    flushSaves();
    const code = await makeResumeCode(), url = transferUrl(code);
    const status = h('p', { class: 'tool-status', 'aria-live': 'polite' });
    const qrBox = h('div', { class: 'transfer-qr' });
    const codeEl = h('p', { class: 'transfer-code', tabindex: '0', id: 'transfer-code-text', 'aria-label': 'Your transfer code' }, code);
    const copy = (text, what) => async () => {
      try { await navigator.clipboard.writeText(text); if (Lab.backup) Lab.backup.markSaved('code'); status.textContent = `${what} copied. Send it to yourself, for example in an email.`; }
      catch (e) { const r = document.createRange(); r.selectNodeContents(codeEl); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); status.textContent = 'Copy is blocked here. The code is selected: press Ctrl+C.'; }
    };
    out.append(h('div', { class: 'transfer-grid' },
      qrBox,
      h('div', { class: 'transfer-side' },
        h('p', { class: 'transfer-photo' }, 'Take a photo of this with your phone.'),
        h('p', { class: 'small muted' }, 'Open the photo on your phone and tap the link that appears. Your work opens in your phone’s browser. If your phone has no QR reader, type or paste the code below into “Load resume code” on the other computer.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn--sm', type: 'button', onclick: copy(code, 'Code') }, 'Copy code'),
          h('button', { class: 'btn btn--sm', type: 'button', onclick: copy(url, 'Link') }, 'Copy link')))),
      h('p', { class: 'transfer-label', id: 'transfer-code-label' }, `Your transfer code (${code.length.toLocaleString()} characters)`),
      codeEl, status);
    try {
      const qrcode = await loadQr();
      try {
        const qr = qrcode(0, 'L'); qr.addData(url, 'Byte'); qr.make();
        qrBox.innerHTML = qr.createSvgTag({ scalable: true, margin: 4, alt: 'QR code that opens your saved work' });
        qrBox.dataset.url = url; qrBox.dataset.modules = String(qr.getModuleCount());
      } catch (e) {
        qrBox.append(h('p', { class: 'transfer-noqr' }, 'Too much data for a QR code — save a progress file instead.'));
      }
    } catch (e) {
      qrBox.append(h('p', { class: 'transfer-noqr' }, 'Could not load the QR code tool. Check your internet connection, copy the code below, or save a progress file instead.'));
    }
  }
  /* The "Get my transfer code" button and the place its result appears. */
  function transferBlock() {
    const out = h('div', { class: 'transfer-out' });
    const btn = h('button', { class: 'btn btn--primary btn--lg transfer-btn', type: 'button', 'aria-expanded': 'false', onclick: async () => {
      btn.disabled = true; out.innerHTML = ''; out.append(h('p', { class: 'muted', role: 'status' }, 'Making your transfer code…'));
      try { await fillTransfer(out); btn.setAttribute('aria-expanded', 'true'); btn.textContent = 'Update my transfer code'; }
      catch (e) { out.innerHTML = ''; out.append(h('p', { class: 'tool-status is-bad', role: 'alert' }, 'Could not make a transfer code here. Save a progress file instead.')); }
      finally { btn.disabled = false; }
    } }, 'Get my transfer code');
    return h('div', { class: 'transfer' }, btn, out);
  }
  Lab.transfer.block = transferBlock;

  /* ---- Opening a transfer link: <lab>.html#resume=<code> ---- */
  async function handleResumeHash() {
    if (!RESUME_HASH) return;
    const code = RESUME_HASH;
    const box = h('div', { class: 'resume-banner', role: 'group', 'aria-label': 'Restore saved work from a link', id: 'resume-banner' });
    const say = (kids, bad) => { box.classList.toggle('is-bad', !!bad); box.innerHTML = ''; box.append(...kids); };
    const close = () => { box.remove(); };
    document.body.prepend(box);
    say([h('span', null, 'Reading the saved work in this link…')]);
    let o;
    try { o = await readResumeCode(code, true); }
    catch (e) { say([h('span', null, e.message), h('button', { class: 'btn btn--sm', type: 'button', onclick: close }, 'Close')], true); return; }
    const when = o.savedAt ? new Date(o.savedAt).toLocaleString() : 'an unknown date';
    const who = o.student && o.student.name ? ' from ' + o.student.name : '';
    const m = /^lab(\d\d)$/.exec(o.lab || '');
    if (!IS_LAB || o.lab !== LAB_ID) {
      const to = m ? `lab${m[1]}.html#resume=${code}` : null;
      say([h('span', null, m ? `This link carries saved work${who} for Lab ${+m[1]}.` : 'This link carries saved work for a different page.'),
        to ? h('a', { class: 'btn btn--sm btn--primary', href: to }, `Open Lab ${+m[1]} to restore it`) : null,
        h('button', { class: 'btn btn--sm', type: 'button', onclick: close }, 'Close')]);
      const a = $('a', box); if (a) a.focus();
      return;
    }
    say([h('span', null, `This link carries saved work${who} (saved ${when}). Replace your work on this lab with it? Your current answers and data on this computer will be overwritten.`),
      h('button', { class: 'btn btn--sm btn--primary', type: 'button', id: 'resume-apply', onclick: () => { try { applyProgress(o); say([h('span', null, 'Loaded. Reloading…')]); } catch (e) { say([h('span', null, e.message), h('button', { class: 'btn btn--sm', type: 'button', onclick: close }, 'Close')], true); } } }, 'Replace my work'),
      h('button', { class: 'btn btn--sm', type: 'button', onclick: () => { close(); Lab.toast('Nothing was changed', { type: 'info' }); } }, 'Keep my work')]);
    focusIn(box, '#resume-apply');
  }

  function moveWorkPanel() {
    const status = h('p', { class: 'tool-status', 'aria-live': 'polite' });
    const say = (t, bad) => { status.textContent = t; status.classList.toggle('is-bad', !!bad); };
    const note = previewNote(true);
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-hidden': 'true', tabindex: '-1' });
    const codeOut = h('textarea', { class: 'code-box', readonly: true, rows: 3, hidden: true, 'aria-label': 'Your resume code' });
    const copyCode = h('button', { class: 'btn btn--sm', type: 'button', hidden: true, onclick: async () => {
      try { await navigator.clipboard.writeText(codeOut.value); if (Lab.backup) Lab.backup.markSaved('code'); say('Resume code copied. Paste it somewhere you can reach from the other computer (for example, an email to yourself).'); Lab.toast('Resume code copied', { type: 'ok', announce: false }); }
      catch (e) { codeOut.focus(); codeOut.select(); say('Copy is blocked here. The code is selected: press Ctrl+C.'); }
    } }, 'Copy code');
    const codeIn = h('textarea', { id: 'resume-code-in', class: 'code-box', rows: 3, spellcheck: 'false', placeholder: 'LB1z.…' });
    const confirmRow = h('div', { class: 'id-confirm', hidden: true, role: 'group', 'aria-label': 'Confirm loading saved work' });
    function askApply(o) {
      const when = o.savedAt ? new Date(o.savedAt).toLocaleString() : 'an unknown date';
      confirmRow.innerHTML = '';
      confirmRow.append(
        h('span', null, `Replace your work on this lab with the progress saved ${o.student ? 'by ' + o.student.name + ' ' : ''}on ${when}? Your current answers and data on this computer will be overwritten.`),
        h('button', { class: 'btn btn--sm btn--primary', type: 'button', onclick: () => { try { applyProgress(o); say('Loaded. Reloading…'); } catch (e) { say(e.message, true); } } }, 'Replace my work'),
        h('button', { class: 'btn btn--sm', type: 'button', onclick: () => { confirmRow.hidden = true; say('Nothing was changed.'); } }, 'Cancel'));
      confirmRow.hidden = false; focusIn(confirmRow, 'button');
    }
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files && fileIn.files[0]; fileIn.value = '';
      if (!f) return;
      if (f.size > 5e6) { say('That file is too large to be a progress file.', true); return; }
      try { askApply(parseProgress(await f.text())); say(''); } catch (e) { say(e.message, true); }
    });
    return h('details', { class: 'disclose move-work' },
      h('summary', null, 'Move your work to another computer'),
      h('div', { class: 'inner' },
        h('p', { class: 'small muted' }, 'Your work saves only in this browser. To keep working on a different computer, save a progress file (or copy a resume code), then load it on the other computer.'),
        h('p', { class: 'small backup-status', 'aria-live': 'polite' }),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => {
            const name = saveProgressFile();
            say(`Saved ${name} to your Downloads folder.`); if (LIKELY_PREVIEW) note.hidden = false;
            Lab.toast('Progress file saved to Downloads', { type: 'ok', announce: false });
          } }, 'Save progress file'),
          h('button', { class: 'btn', type: 'button', onclick: () => fileIn.click() }, 'Load progress file'), fileIn),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn--sm', type: 'button', onclick: async () => {
            try { codeOut.value = await makeResumeCode(); codeOut.hidden = false; copyCode.hidden = false; say(`Your resume code is ready (${codeOut.value.length.toLocaleString()} characters).`); }
            catch (e) { say('Could not make a resume code here. Use a progress file instead.', true); }
          } }, 'Get a resume code'), copyCode),
        codeOut,
        h('div', { class: 'field' }, h('label', { for: 'resume-code-in' }, 'Or paste a resume code'), codeIn),
        h('div', { class: 'row' }, h('button', { class: 'btn btn--sm', type: 'button', onclick: async () => {
          try { askApply(await readResumeCode(codeIn.value)); say(''); } catch (e) { say(e.message, true); }
        } }, 'Load resume code')),
        confirmRow, status, note));
  }

  /* Report tools added to the responses toolbar on student lab pages. */
  function reportTools() {
    const status = h('p', { class: 'tool-status', 'aria-live': 'polite' });
    const note = previewNote();
    const say = (t, bad) => { status.textContent = t; status.classList.toggle('is-bad', !!bad); };
    const nameWarn = () => reportIdentity().name ? '' : ' Add your name at the top of the page so it appears on your report.';
    const docxBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
      docxBtn.disabled = true; say('Building your Word file…');
      try {
        const blob = await Lab.report.docx();
        const name = reportFileBase() + '.docx';
        downloadBlob(blob, name);
        say(`Downloaded ${name}. Hand it in the way your teacher asks.` + nameWarn());
        reportSaved();
        Lab.toast(`Downloaded ${name}`, { type: 'ok', announce: false });
        if (LIKELY_PREVIEW) note.hidden = false;
      } catch (e) {
        if (e && e.message === 'docx-load') { say('Could not load the Word file tool. Check your internet connection, or use Save as PDF.', true); note.hidden = false; }
        else { console.error(e); say('Something went wrong building the Word file. Use Save as PDF instead.', true); }
      } finally { docxBtn.disabled = false; }
    } }, 'Download .docx');
    const pdfBtn = h('button', { class: 'btn', type: 'button', onclick: () => openReport({ print: true, opener: pdfBtn }) }, 'Save as PDF');
    const tlBox = h('input', { type: 'checkbox', id: 'tl-include', checked: tlInclude() || null, onchange: () => store.set('tl-include', tlBox.checked) });
    const tlRow = h('label', { class: 'check tl-include', for: 'tl-include', hidden: true }, tlBox, ' Include my timelapse in the report');
    const tlSync = () => { tlRow.hidden = !Lab.timelapse.withRun().length; };
    window.addEventListener('aplab:timelapse', tlSync); setTimeout(tlSync, 400);
    const bar = h('div', { class: 'responses-bar report-bar' },
      h('span', { class: 'grow' }, 'Hand in your work: download a Word file, or save a PDF from the print window.'), docxBtn, pdfBtn,
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: printWorksheet }, 'Print worksheet'), tlRow);
    const ss = saveStatusEl(); ss.classList.add('save-status--bar');
    return [bar, ss, makeLabBadge(), status, note];
  }

  /* ---------------- Printable worksheet ----------------
     Lab.worksheet.print() switches to worksheet mode (body.worksheet-mode), prints, and exits afterwards.
     Lab.worksheet.enter() / .exit() switch the mode without printing.
     Built from the registered Lab.quiz / Lab.prompt / Lab.table structures: multiple choice with ○ bubbles,
     numeric answers on a line with units, blank ruled data tables (Lab.table option worksheetRows, else the
     table's preset rows, else 8), and ruled lines for every written prompt. */
  let wsState = null;
  const isDarkNow = () => { const t = document.documentElement.getAttribute('data-theme'); return t === 'dark' || (t !== 'light' && !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)); };
  function wsQuiz(q) {
    return `<ol class="ws-quiz">${q.questions.map(qq => `<li class="ws-q"><div class="ws-stem">${qq.q}</div>${qq.type === 'num'
      ? `<p class="ws-num">Answer: <span class="ws-blank"></span>${qq.unit ? ' <span class="ws-unit">' + qq.unit + '</span>' : ''}</p>`
      : `${qq.type === 'multi' ? '<p class="ws-hint">Select all that apply.</p>' : ''}<ul class="ws-choices">${(qq.choices || []).map(c => `<li><span class="ws-bubble" aria-hidden="true">${qq.type === 'multi' ? '☐' : '○'}</span><span>${c}</span></li>`).join('')}</ul>`}</li>`).join('')}</ol>`;
  }
  function wsTable(t) {
    const cols = t.opts.columns || [], preset = t.opts.rows || [];
    const n = Math.max(1, t.opts.worksheetRows || preset.length || 8);
    const cellVal = (r, c) => { if (!r || c.editable) return ''; const v = r[c.key]; if (v == null) return ''; return c.num && typeof v === 'number' ? Lab.fmt(v, c.digits != null ? c.digits : 2) : esc(v); };
    let body = '';
    for (let i = 0; i < n; i++) body += `<tr>${cols.map(c => `<td>${cellVal(preset[i], c)}</td>`).join('')}</tr>`;
    return `<table class="ws-table"><thead><tr>${cols.map(c => `<th>${esc(c.label)}${c.unit ? ` <span class="ws-unit">(${esc(c.unit)})</span>` : ''}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  }
  const wsLines = n => '<div class="ws-line"></div>'.repeat(n);
  function wsCopyProse(body, wasDark) {
    const clone = body.cloneNode(true);
    const origCanvases = $$('canvas', body), cloneCanvases = $$('canvas', clone);
    cloneCanvases.forEach((cv, i) => {
      let img = null; // enterWorksheet has already switched to the light tokens and redrawn, so this is a light picture even from dark mode
      try { img = h('img', { src: origCanvases[i].toDataURL('image/png'), alt: origCanvases[i].getAttribute('aria-label') || '', class: 'ws-img' }); } catch (e) { img = null; }
      if (img) cv.replaceWith(img); else cv.remove();
    });
    $$('.tab-panel', clone).forEach(p => { p.hidden = false; if (p.dataset.tab) p.prepend(h('p', { class: 'ws-sum' }, p.dataset.tab)); }); // every tab prints
    $$('button, input, select, textarea, script, .sim, [hidden], .link-tools, .pager, .save-status, [role="tablist"], .pvc', clone).forEach(e => e.remove());
    // Collapsed disclosures print in full: <details> becomes a plain block with its summary as a heading.
    $$('details', clone).forEach(d => {
      const box = h('div', { class: 'ws-details' });
      Array.from(d.childNodes).forEach(n => { if (n.nodeType === 1 && n.tagName === 'SUMMARY') box.append(h('p', { class: 'ws-sum', html: n.innerHTML })); else box.append(n); });
      d.replaceWith(box);
    });
    $$('[role="tabpanel"]', clone).forEach(p => { p.removeAttribute('role'); p.removeAttribute('aria-labelledby'); });
    $$('[id]', clone).forEach(e => e.removeAttribute('id'));
    return clone.innerHTML;
  }
  function buildWorksheet(wasDark) {
    const hd = $('.lab-header');
    const title = hd && $('h1', hd) ? $('h1', hd).textContent.trim() : document.title;
    const eyebrow = hd && $('.eyebrow', hd) ? $('.eyebrow', hd).textContent.trim() : '';
    const dq = hd && $('.driving-q', hd) ? $('.driving-q', hd).textContent.trim() : '';
    const out = [`<header class="ws-head"><p class="ws-eyebrow">${esc(eyebrow)}${eyebrow ? ' · ' : ''}Worksheet</p><h1>${esc(title)}</h1>${dq ? `<p class="ws-dq">${esc(dq)}</p>` : ''}
      <div class="ws-idline"><span class="ws-id ws-id-name">Name</span><span class="ws-id ws-id-period">Period</span><span class="ws-id ws-id-date">Date</span></div></header>`];
    const quizByEl = new Map(REG.quizzes.map(q => [q.el, q])), promptByEl = new Map(REG.prompts.map(p => [p.el, p])), tableByEl = new Map(REG.tables.map(t => [t.el, t]));
    $$('section.step').forEach(sec => {
      const name = (sec.dataset.step || '').trim();
      const ehd = $(':scope > header', sec);
      const eb = ehd && $('.eyebrow', ehd) ? $('.eyebrow', ehd).textContent.trim() : '';
      const h2 = ehd && $('h2', ehd) ? $('h2', ehd).textContent.trim() : name;
      const head = `<div class="ws-shead"><h2>${esc(h2)}</h2>${eb && eb !== h2 ? `<p class="ws-eyebrow">${esc(eb)}</p>` : ''}</div>`;
      if (/^(overview|background)$/i.test(name)) {
        const body = $(':scope > .step-body', sec) || sec;
        out.push(`<section class="ws-sec ws-copy">${head}<div class="ws-prose">${wsCopyProse(body, wasDark)}</div></section>`);
        return;
      }
      const cands = [];
      REG.quizzes.forEach(q => { if (sec.contains(q.el)) cands.push(q.el); });
      REG.prompts.forEach(p => { if (sec.contains(p.el)) cands.push(p.el); });
      REG.tables.forEach(t => { if (sec.contains(t.el)) cands.push(t.el); });
      $$('[data-save], table.data', sec).forEach(e => {
        if (e.id === 'student-name' || e.closest('.prompt, .quiz, .id-box') || REG.tables.some(t => t.el.contains(e))) return;
        if (e.matches('[data-save]') && !(e.tagName === 'TEXTAREA' || e.dataset.label)) return;
        cands.push(e);
      });
      cands.sort((a, b) => a === b ? 0 : (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      const parts = [];
      cands.forEach(e => {
        if (quizByEl.has(e)) parts.push(wsQuiz(quizByEl.get(e)));
        else if (promptByEl.has(e)) { const p = promptByEl.get(e); parts.push(`<div class="ws-prompt"><p class="ws-plabel">${p.label}</p>${wsLines(Math.max(3, (p.rows || 4) + 1))}</div>`); }
        else if (tableByEl.has(e)) parts.push(wsTable(tableByEl.get(e)));
        else if (e.matches('table.data')) { const c = e.cloneNode(true); c.className = 'ws-table'; $$('input, select', c).forEach(i => i.replaceWith('')); parts.push(c.outerHTML); }
        else if (e.tagName === 'TEXTAREA') parts.push(`<div class="ws-prompt"><p class="ws-plabel">${esc(fieldLabel(e))}</p>${wsLines(4)}</div>`);
        else parts.push(`<p class="ws-short"><span>${esc(fieldLabel(e))}:</span> <span class="ws-blank"></span></p>`);
      });
      if (parts.length) out.push(`<section class="ws-sec">${head}${parts.join('')}</section>`);
    });
    return out.join('');
  }
  function enterWorksheet() {
    if (wsState) return wsState.root;
    closeReport(); flushSaves();
    pagesSuspend(); // every part laid out, so canvases copy at full size
    const wasDark = isDarkNow();
    const restore = forceLight();
    if (wasDark) redrawEverything();   // canvases drawn in dark colors are redrawn in light ones before they are copied
    const note = previewNote(true);
    const hd = $('.lab-header h1');
    const titleText = cleanTitle(document.title || (hd ? hd.textContent : 'Lab'));
    const run = { left: 'Name ______________________  Class ______', right: titleText, bottomLeft: 'Dataset ID ____________' };
    const style = printPageStyle('ws-page-style', run, '.7in .6in .6in');
    const root = h('div', { id: 'lab-worksheet', class: 'worksheet', role: 'region', 'aria-label': 'Printable worksheet' },
      h('div', { class: 'ws-tools' },
        h('div', { class: 'row' },
          h('button', { class: 'btn btn--primary', type: 'button', onclick: () => tryPrint(() => { note.hidden = false; }) }, 'Print worksheet'),
          h('button', { class: 'btn', type: 'button', onclick: exitWorksheet }, 'Back to the lab')),
        note),
      h('article', { class: 'ws-paper', html: printRun(run, buildWorksheet(wasDark)) }));
    document.head.append(style);
    document.body.append(root);
    document.body.classList.add('worksheet-mode');
    wsState = { restore, root, style, dark: wasDark, scrollY: window.scrollY, opener: document.activeElement };
    document.addEventListener('keydown', wsKey);
    window.scrollTo(0, 0);
    return root;
  }
  function wsKey(e) { if (e.key === 'Escape') exitWorksheet(); }
  function exitWorksheet() {
    if (!wsState) return;
    const s = wsState; wsState = null;
    s.root.remove(); s.style.remove(); s.restore(); if (s.dark) redrawEverything(); pagesResume();
    document.body.classList.remove('worksheet-mode', 'pr-fallback');
    document.removeEventListener('keydown', wsKey);
    window.scrollTo(0, s.scrollY);
    if (s.opener && s.opener.focus) { try { s.opener.focus({ preventScroll: true }); } catch (e) { /* gone */ } }
  }
  function printWorksheet() {
    enterWorksheet();
    const after = () => { window.removeEventListener('afterprint', after); exitWorksheet(); };
    window.addEventListener('afterprint', after);
    // If printing is blocked (preview), stay in the worksheet view and show the note.
    setTimeout(() => tryPrint(() => { window.removeEventListener('afterprint', after); const n = wsState && $('.preview-note', wsState.root); if (n) n.hidden = false; }), 60);
  }
  Lab.worksheet = { enter: enterWorksheet, exit: exitWorksheet, print: printWorksheet, html: () => buildWorksheet(isDarkNow()) };
  function addHeaderPrintButton() {
    const crumbs = $('.lab-header .crumbs'); if (!crumbs || $('.ws-print-btn', crumbs)) return;
    if (!$('.project-link', crumbs)) crumbs.append(h('a', { class: 'project-link', href: 'projector.html#' + PAGE.id, title: 'Open projector mode for this lab (for teachers)' },
      h('span', { class: 'pl-icon', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" width="14" height="14" focusable="false"><rect x="3" y="4" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' }), 'Project this lab'));
    crumbs.append(h('button', { class: 'btn btn--sm ws-print-btn', type: 'button', onclick: printWorksheet }, 'Print worksheet'));
  }

  /* ---------------- Step navigation, deep links, progress ----------------
     Every section.step gets a readable id from its data-step ("Root tips" → #root-tips).
     Old #step-N links still work. Lab pages get "Copy link to this part" buttons and progress checkmarks. */
  const RESERVED_IDS = /^(settings|sidebar|customize|upgrade|downloads|comment-.*)$/;
  const slugify = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  function assignStepIds(steps) {
    const used = new Set();
    steps.forEach((s, i) => {
      if (s.id) { used.add(s.id); return; }
      let base = slugify(s.dataset.step) || 'part-' + (i + 1);
      if (RESERVED_IDS.test(base) || /^step-\d+$/.test(base)) base = 'part-' + base;
      let id = base, n = 2;
      while (used.has(id) || document.getElementById(id)) id = base + '-' + n++;
      used.add(id); s.id = id;
    });
  }
  /* Older links used #evaluate-2 / #reflect-2 (an inner prompt container once held the plain id). */
  const LEGACY_SLUGS = { 'evaluate-2': 'evaluate', 'reflect-2': 'reflect' };
  const byIdOrAlias = id => document.getElementById(id) || (LEGACY_SLUGS[id] ? document.getElementById(LEGACY_SLUGS[id]) : null);
  const isLegacyHash = h => /^#step-\d+$/.test(h) || Object.prototype.hasOwnProperty.call(LEGACY_SLUGS, h.slice(1));
  function hashTarget() {
    let raw = ''; try { raw = decodeURIComponent(location.hash.slice(1)); } catch (e) { raw = location.hash.slice(1); }
    if (!raw) return null;
    let el = byIdOrAlias(raw);
    const m = /^step-(\d+)$/.exec(raw);
    if (!el && m) el = $$('section.step')[+m[1] - 1] || null;
    return el;
  }
  let userScrolled = false;
  /* Legacy #step-N links: show the slug in the address bar instead. */
  function tidyLegacyHash(el) {
    if (el && el.matches('section.step') && isLegacyHash(location.hash) && history.replaceState) { try { history.replaceState(history.state, '', '#' + el.id); } catch (e) { /* file:// in some browsers */ } }
  }
  function scrollToHash() {
    const el = hashTarget(); if (!el) return;
    const sec = partOf(el);
    if (pages.on && !pages.suspended && sec) { showPart(sec); tidyLegacyHash(el); el.scrollIntoView({ block: el === sec ? 'start' : 'center' }); return; }
    if (el.matches('section.step')) el.scrollIntoView({ block: 'start' });
  }
  function setupDeepLinks() {
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(ev => window.addEventListener(ev, () => { userScrolled = true; }, { passive: true }));
    window.addEventListener('hashchange', () => {
      const el = hashTarget();
      const sec = el && partOf(el);
      if (pages.on && !pages.suspended && sec) { // nav links, Back/Next, in-page links and browser Back all arrive here
        goPart(sec, { focus: el === sec, scroll: el === sec });
        tidyLegacyHash(el);
        if (el !== sec) el.scrollIntoView({ block: 'center' });
        return;
      }
      scrollToHash();
    });
    if (!location.hash) return;
    // Page scripts build content after Lab.init, and charts and fonts shift layout, so settle the scroll a few times.
    const again = () => { if (!userScrolled) scrollToHash(); };
    setTimeout(again, 0);
    window.addEventListener('load', () => { again(); setTimeout(again, 350); setTimeout(again, 1000); });
  }
  const LINK_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L11.6 6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function addCopyLinks(steps) {
    steps.forEach(s => {
      const hd = $(':scope > header', s); if (!hd || $('.link-tools', hd)) return;
      const name = (s.dataset.step || '').trim();
      const status = h('span', { class: 'link-status', 'aria-live': 'polite' });
      const tools = h('div', { class: 'link-tools' });
      const btn = h('button', { class: 'link-btn', type: 'button', 'aria-label': 'Copy link to this part' + (name ? ': ' + name : ''), title: 'Copy link to this part', html: LINK_SVG + '<span class="lb-text">Copy link</span>' });
      btn.addEventListener('click', async () => {
        const url = location.href.split('#')[0] + '#' + s.id;
        const old = $('.link-fallback', tools); if (old) old.remove();
        try { await navigator.clipboard.writeText(url); status.textContent = 'Link copied'; Lab.toast('Link to “' + (name || 'this part') + '” copied', { type: 'ok', announce: false }); }
        catch (e) {
          const inp = h('input', { type: 'text', class: 'link-fallback', readonly: true, value: url, 'aria-label': 'Link to this part' });
          tools.append(inp); inp.focus(); inp.select(); status.textContent = 'Press Ctrl+C to copy';
        }
        setTimeout(() => { status.textContent = ''; }, 3000);
      });
      tools.append(btn, status);
      hd.classList.add('has-link'); hd.append(tools);
    });
  }
  /* A section is done when every prompt textarea is filled, every quiz question checked,
     and every saved data table has a row. Sections without student inputs get no check. */
  function sectionWork(sec) {
    let total = 0, done = 0;
    $$('textarea[data-save]', sec).forEach(t => { if (t.closest('.id-box')) return; total++; if (t.value.trim()) done++; });
    REG.quizzes.forEach(q => { if (!sec.contains(q.el)) return; const st = q.state() || {}; q.questions.forEach((_, i) => { total++; if (st[i]) done++; }); });
    REG.tables.forEach(t => { if (!t.opts.save || !sec.contains(t.el)) return; total++; if (t.getRows().some(r => !r._setup)) done++; });
    STEPBOXES.forEach(box => { if (!sec.contains(box.el)) return; box.items.forEach((it, i) => { const st = stepStatus(box, it, i); if (st === 'skip') return; total++; if (st === 'done') done++; }); });
    return { total, done };
  }
  /* Simulation steps (Lab.steps) count as work. A required step is "open" until the student completes it; its
     completion is remembered (aplab:<lab>:stepdone), so a reload keeps it. A step that is already satisfied the
     first time we look (a default), or that flips before the student has touched anything (page setup or restored
     state), is not student work and is left out of the count. */
  const STEPBOXES = [];
  let acted = false, stepDone = null;
  ['pointerdown', 'keydown', 'input', 'change', 'click'].forEach(ev => document.addEventListener(ev, () => { if (document.readyState === 'complete') acted = true; }, true));
  const stepKey = (box, it, i) => box.uid + ':' + (it.s.id || i);
  function stepSaved() { if (!stepDone) stepDone = store.get('stepdone') || {}; return stepDone; }
  function stepStatus(box, it, i) {
    if (it.s.optional) return 'skip';
    if (it.s.live) return it.d ? 'done' : 'open';   // live: counts only while its done() is true now (not remembered), for steps that must un-complete when the data changes
    if (stepSaved()[stepKey(box, it, i)]) return 'done';
    if (!it.seenOpen || it.init) return it.d ? 'skip' : 'open';
    return it.d && it.ackd ? 'done' : (it.d ? 'skip' : 'open');
  }
  let progTimer = 0;
  const progressSoon = () => { clearTimeout(progTimer); progTimer = setTimeout(() => { try { updateProgress(); } catch (e) { /* ignore */ } }, 30); };
  function stepTick(box) { // called after a Lab.steps refresh: record newly completed steps
    let changedAny = false;
    box.items.forEach((it, i) => {
      if (it.s.optional) return;
      if (!it.d) { it.seenOpen = true; it.ackd = false; it.init = false; }
      else if (it.seenOpen && !acted) it.init = true;   // flipped before the student did anything: setup or restored state
      else if (it.seenOpen && acted && !it.ackd && !it.init) { it.ackd = true; stepSaved()[stepKey(box, it, i)] = 1; changedAny = true; }
      if (it.pd !== it.d) { it.pd = it.d; changedAny = true; }
    });
    if (changedAny) { if (acted) store.set('stepdone', stepSaved()); progressSoon(); }
  }
  let navProgressEl = null, lastSummary = '';
  /* Two-level progress. Level 1 is the part count (a part is done when ALL its work is done; unchanged). Level 2 names the
     part that is under way (some, not all, of its items done) with its item count, e.g. "3 of 6 parts · Float assay 6/11 items".
     Before any part is complete it reads "Started · Float assay 6/11 items", never "0 of N". s = {done, total, items:{done,total},
     partial:{name, done, total}, started}. opts.suffix adds " done" after "parts" (nav, resume card). */
  function progressText(s, opts = {}) {
    if (!s || !s.total) return s && s.started ? 'Started' : 'Not started';
    const part = s.partial && s.partial.total ? `${s.partial.name} ${s.partial.done}/${s.partial.total} items` : '';
    if (s.done >= s.total) return `All ${s.total} parts done`;
    if (!s.done) {
      const worked = s.items ? s.items.done > 0 : !!s.started;
      return !worked ? 'Not started' : part ? `Started · ${part}` : 'Started';
    }
    return `${s.done} of ${s.total} parts${opts.suffix ? ' done' : ''}${part ? ' · ' + part : ''}`;
  }
  Lab.progressText = progressText;
  function updateProgress() {
    const nav = $('.step-nav ol'); if (!nav) return null;
    let parts = 0, complete = 0, itemsDone = 0, itemsTotal = 0;
    const partials = [], doneIds = new Set();
    const steps = $$('section.step');
    steps.forEach(s => {
      const link = $$('a', nav).find(a => a.getAttribute('href') === '#' + s.id); if (!link) return;
      const r = sectionWork(s), sr = $('.done-sr', link);
      if (!r.total) { link.classList.remove('is-done', 'has-work'); if (sr) sr.textContent = ''; link.removeAttribute('title'); return; }
      parts++; const ok = r.done === r.total; if (ok) { complete++; doneIds.add(s.id); }
      itemsDone += r.done; itemsTotal += r.total;
      if (r.done > 0 && !ok) partials.push({ id: s.id, name: (s.dataset.step || '').trim() || 'This part', done: r.done, total: r.total });
      link.classList.add('has-work'); link.classList.toggle('is-done', ok);
      if (sr) sr.textContent = ok ? ' (done)' : '';
      link.title = ok ? 'Done' : `${r.done} of ${r.total} items done`;
    });
    celebrateCheck(doneIds, complete, parts);
    const curId = pages.cur && pages.cur.id;
    const partial = partials.find(x => x.id === curId) || partials[0] || null;
    const sumObj = { done: complete, total: parts, sections: steps.length, items: { done: itemsDone, total: itemsTotal }, partial };
    if (navProgressEl) {
      const started = !complete && itemsDone > 0;
      const pt = partial ? `${partial.name} ${partial.done}/${partial.total} items` : '';
      navProgressEl.hidden = !parts;
      navProgressEl.innerHTML = `<span class="np-long">${started ? 'Started' : `${complete} of ${parts} parts done`}</span><span class="np-short">${started ? 'Started' : `${complete} of ${parts} done`}</span>` + (pt ? `<span class="np-part"> · ${esc(pt)}</span>` : '');
      navProgressEl.title = progressText(sumObj, { suffix: true });
    }
    const sum = JSON.stringify([complete, parts, itemsDone, partial && [partial.id, partial.done, partial.total]]);
    if (sum !== lastSummary && parts) { lastSummary = sum; gstore.set('progress:' + PAGE.id, Object.assign({ t: Date.now() }, sumObj)); }
    return { done: complete, total: parts, sections: steps.length, items: sumObj.items, partial };
  }
  /* ---------------- Paged mode: one part at a time ----------------
     Lab pages show one section.step at a time (body.paged; the current one has .is-current), with Back/Next
     links at the bottom of each part. Hash links (#float-assay, legacy #step-5) open that part. "All parts"
     (remembered per browser in aplab:ui:allParts) shows the whole lab on one page; printing, the worksheet
     and the report always read every part. Lab.pages: {on, current(), go(idOrEl), showAll(bool), list()}.
     Lab.onShow(partOrChild, fn) runs fn(section) whenever that part becomes visible. */
  const ALL_KEY = 'ui:allParts';
  const pages = { on: false, suspended: 0, steps: [], cur: null };
  const showFns = new Map();
  let navLinks = [], navOl = null, lastId = null;
  function partOf(el) { if (!el || !el.matches) return null; return el.matches('section.step') ? el : el.closest('section.step'); }
  const navHeight = () => { const n = $('.step-nav'); return n ? n.getBoundingClientRect().height : 0; };
  const isShown = sec => !pages.on || pages.suspended > 0 || sec === pages.cur;
  function setActive(id) {
    navLinks.forEach(a => {
      const on = a.getAttribute('href') === '#' + id; a.setAttribute('aria-current', on ? 'true' : 'false');
      if (on && navOl) { const r = a.getBoundingClientRect(), nr = navOl.getBoundingClientRect(); if (r.left < nr.left + 24 || r.right > nr.right - 24) navOl.scrollLeft += (r.left + r.right) / 2 - (nr.left + nr.right) / 2; }
    });
    if (IS_LAB && id !== lastId) { lastId = id; const s = document.getElementById(id); gstore.set('last', { lab: PAGE.id, step: id, name: s ? s.dataset.step || '' : '', title: document.title, t: Date.now() }); }
  }
  /* Size and redraw what lives in a part that just became visible. */
  function syncPart(sec) {
    quietBadges(900);   // redrawing a part that was just shown (or after printing) is not a new result
    CANVASES.forEach(c => { if (sec.contains(c.canvas)) { try { c.check(); } catch (e) { console.warn(e); } } });
    REG.charts.forEach(c => { if (sec.contains(c.el)) { try { c.render(); } catch (e) { console.warn(e); } } });
  }
  function partShown(sec) {
    quietBadges(900);
    syncPart(sec);
    requestAnimationFrame(() => {
      $$('canvas', sec).forEach(cv => { if (cv.scopeView) { try { cv.scopeView.redraw(); } catch (e) { /* ignore */ } } });
      window.dispatchEvent(new Event('resize'));
    });
    (showFns.get(sec) || []).slice().forEach(f => { try { f(sec); } catch (e) { console.error(e); } });
    sec.dispatchEvent(new CustomEvent('lab:show', { bubbles: true }));
    refreshGuides();
  }
  function showPart(sec) {
    if (!sec) return;
    if (pages.on && pages.cur !== sec) {
      pages.cur = sec;
      pages.steps.forEach(s => s.classList.toggle('is-current', s === sec));
      partShown(sec);
    }
    setActive(sec.id);
  }
  function goPart(sec, o = {}) {
    if (typeof sec === 'string') sec = byIdOrAlias(sec.replace(/^#/, ''));
    sec = partOf(sec); if (!sec) return;
    showPart(sec);
    if (o.hash && location.hash.slice(1) !== sec.id) { try { history.pushState(null, '', '#' + sec.id); } catch (e) { location.hash = sec.id; return; } }
    if (o.scroll !== false) window.scrollTo(0, Math.max(0, sec.getBoundingClientRect().top + window.scrollY - navHeight()));
    if (o.focus) {
      const hd = $(':scope > header h2', sec) || $(':scope > header', sec);
      if (hd) { if (!hd.hasAttribute('tabindex')) hd.tabIndex = -1; hd.focus({ preventScroll: true }); }
    }
  }
  function setAllParts(all, o = {}) {
    if (!IS_LAB || !pages.steps.length) return;
    if (o.save !== false) gstore.set(ALL_KEY, !!all);
    const keep = pages.cur || document.getElementById(lastId) || pages.steps[0];
    pages.on = !all;
    document.body.classList.toggle('paged', pages.on && !pages.suspended);
    $$('.parts-toggle').forEach(b => b.setAttribute('aria-pressed', String(!!all)));
    if (all) {
      pages.steps.forEach(s => { if (s !== pages.cur) partShown(s); });
      pages.cur = null;
      if (keep && o.scroll !== false) keep.scrollIntoView({ block: 'start' });
    } else {
      pages.cur = null;
      const sec = (lastId && document.getElementById(lastId)) || keep;
      if (sec) { try { history.replaceState(null, '', '#' + sec.id); } catch (e) { /* ignore */ } }
      goPart(sec, { scroll: o.scroll !== false });
    }
    if (o.toast !== false) Lab.toast(all ? 'Showing all parts on one page' : 'Showing one part at a time', { type: 'info' });
  }
  /* Printing and the worksheet need every part laid out. */
  function pagesSuspend() {
    pages.suspended++;
    if (pages.suspended === 1 && pages.on) { document.body.classList.remove('paged'); pages.steps.forEach(s => { if (s !== pages.cur) syncPart(s); }); }
  }
  function pagesResume() {
    if (pages.suspended > 0) pages.suspended--;
    if (!pages.suspended && pages.on) document.body.classList.add('paged');
  }
  Lab.pages = {
    get on() { return pages.on; },
    current: () => pages.on ? pages.cur : (lastId && document.getElementById(lastId)),
    go: (target, o = {}) => goPart(target, Object.assign({ hash: true, focus: true }, o)),
    showAll: (all = true) => setAllParts(all),
    list: () => pages.steps.slice(),
    suspend: pagesSuspend, resume: pagesResume,
  };
  Lab.onShow = function (part, fn) {
    const sec = partOf(typeof part === 'string' ? $(part) : part);
    if (!sec || typeof fn !== 'function') return () => {};
    if (!showFns.has(sec)) showFns.set(sec, []);
    showFns.get(sec).push(fn);
    if (isShown(sec)) setTimeout(() => { if (isShown(sec)) fn(sec); }, 0);
    return () => { const a = showFns.get(sec) || [], i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  };
  const partName = (s, i) => (s.dataset.step || '').trim() || 'Part ' + (i + 1);
  function buildPagers(steps) {
    steps.forEach((s, i) => {
      if ($(':scope > .pager', s)) return;
      const prev = steps[i - 1], next = steps[i + 1];
      s.append(h('nav', { class: 'pager', 'aria-label': 'Move between parts' },
        prev ? h('a', { class: 'btn pager-prev', href: '#' + prev.id, rel: 'prev' }, h('span', { 'aria-hidden': 'true' }, '←'), h('span', null, 'Back', h('span', { class: 'pager-name' }, ': ' + partName(prev, i - 1)))) : h('span', { class: 'pager-gap' }),
        h('span', { class: 'pager-mid' }, saveStatusEl(), h('span', { class: 'pager-pos' }, `Part ${i + 1} of ${steps.length}`),
          h('button', { class: 'linkbtn pager-all', type: 'button', onclick: () => setAllParts(true) }, 'Show all parts on one page'),
          IS_LAB ? h('button', { class: 'linkbtn pager-pause', type: 'button', 'aria-haspopup': 'dialog', onclick: ev => Lab.pause({ opener: ev.currentTarget }) }, 'Pause & bookmark') : null,
          h('span', { class: 'pager-tip' }, 'Tip: use ← → to move between parts')),
        next ? h('a', { class: 'btn btn--primary pager-next', href: '#' + next.id, rel: 'next' }, h('span', null, 'Next', h('span', { class: 'pager-name' }, ': ' + partName(next, i + 1))), h('span', { 'aria-hidden': 'true' }, '→'))
          : h('a', { class: 'btn pager-next', href: 'index.html' }, h('span', null, 'All labs'), h('span', { 'aria-hidden': 'true' }, '→'))));
    });
    // Page scripts run after Lab.init; keep each pager last in its part.
    window.addEventListener('load', () => steps.forEach(s => { const p = $(':scope > .pager', s); if (p && p !== s.lastElementChild) s.append(p); }));
  }
  /* Arrows for a step nav that is wider than the screen (they only scroll; links stay in the Tab order). */
  function setupNavScroll(ol) {
    const wrap = ol.parentElement;
    const mk = (cls, dir, label) => h('button', { class: 'nav-arrow ' + cls, type: 'button', tabindex: '-1', 'aria-hidden': 'true', title: label, onclick: () => ol.scrollBy({ left: dir * Math.max(160, ol.clientWidth * 0.6), behavior: Lab.reducedMotion() ? 'auto' : 'smooth' }) }, dir < 0 ? '‹' : '›');
    const prev = mk('nav-prev', -1, 'Scroll parts left'), next = mk('nav-next', 1, 'Scroll parts right');
    ol.before(prev); ol.after(next);
    const upd = () => {
      const over = ol.scrollWidth > ol.clientWidth + 2;
      wrap.classList.toggle('nav-overflow', over);
      prev.disabled = !over || ol.scrollLeft <= 2; next.disabled = !over || ol.scrollLeft + ol.clientWidth >= ol.scrollWidth - 2;
      wrap.classList.toggle('at-start', prev.disabled); wrap.classList.toggle('at-end', next.disabled);
    };
    ol.addEventListener('scroll', upd, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(upd).observe(ol); else window.addEventListener('resize', upd);
    window.addEventListener('load', upd); setTimeout(upd, 0);
  }
  function setupPaged(steps) {
    pages.steps = steps;
    buildPagers(steps);
    pages.on = !gstore.get(ALL_KEY);
    const first = hashTarget(), sec = partOf(first) || steps[0];
    if (pages.on) { pages.cur = null; showPart(sec); document.body.classList.add('paged'); tidyLegacyHash(first); }
    // Same-part clicks do not change the hash, so handle them here.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || !pages.on || pages.suspended || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const href = a.getAttribute('href');
      if (href.length > 1 && href === location.hash) {
        const el = byIdOrAlias(decodeURIComponent(href.slice(1)));
        if (el && el.matches('section.step')) { e.preventDefault(); goPart(el, { focus: true }); }
      }
    });
    // ← / → move between parts, unless the keys belong to something else (typing, sliders, tabs, the tour...).
    document.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (!pages.on || pages.suspended || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing) return;
      const b = document.body;
      if (b.classList.contains('tour-open') || b.classList.contains('report-mode') || b.classList.contains('worksheet-mode')) return;
      const t = e.target;
      if (t && t.closest) {
        if (t.isContentEditable || t.closest('[contenteditable]:not([contenteditable="false"])')) return;
        if (t.closest('textarea, select, [role="slider"], [role="spinbutton"], [role="tab"], [role="tablist"], [role="radio"], [role="radiogroup"], [role="listbox"], [role="option"], [role="combobox"], [role="menu"], [role="menuitem"], [role="tree"], [role="grid"], [role="textbox"], [role="scrollbar"], [role="separator"], video, audio, dialog, [aria-modal="true"]')) return;
        const inp = t.closest('input');
        if (inp && !/^(button|checkbox|submit|reset|image)$/i.test(inp.type)) return; // text, number, range, radio, date... use the arrows themselves
        if (t.scrollWidth > t.clientWidth + 2 && t !== document.body && t !== document.documentElement && /(auto|scroll)/.test(getComputedStyle(t).overflowX)) return; // a focused scroller
      }
      const i = pages.steps.indexOf(pages.cur); if (i < 0) return;
      const to = pages.steps[i + (e.key === 'ArrowRight' ? 1 : -1)]; if (!to) return;
      e.preventDefault();
      goPart(to, { hash: true, focus: true });
    });
    // Printing (Ctrl+P) shows every part, with disclosures open.
    let printing = null;
    window.addEventListener('beforeprint', () => {
      if (printing || document.body.classList.contains('worksheet-mode') || document.body.classList.contains('report-mode')) return;
      printing = $$('details.disclose:not([open])'); printing.forEach(d => { d.open = true; });
      pagesSuspend();
      printPrepare();   // light colors, every canvas redrawn and replaced by a static image
    });
    window.addEventListener('afterprint', () => { if (!printing) return; printRestore(); printing.forEach(d => { d.open = false; }); printing = null; pagesResume(); });
    // Find (Ctrl+F) only searches what is on screen: offer the one-page view once.
    let findHint = false;
    window.addEventListener('keydown', e => {
      if (findHint || !pages.on || !(e.ctrlKey || e.metaKey) || (e.key || '').toLowerCase() !== 'f') return;
      findHint = true;
      Lab.toast('Find only searches the part on screen.', { type: 'info', timeout: 9000, action: { label: 'Show all parts', onClick: () => setAllParts(true) } });
    });
  }
  function buildNav() {
    const nav = $('.step-nav ol');
    const steps = $$('section.step');
    assignStepIds(steps);
    if (IS_LAB && steps.length > 1) setupPaged(steps);
    setupDeepLinks();
    if (!nav) return;
    navOl = nav;
    steps.forEach((s, i) => {
      nav.append(h('li', null, h('a', { href: '#' + s.id }, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'nl' }, s.dataset.step || ('Step ' + (i + 1))), IS_LAB ? h('span', { class: 'sr-only done-sr' }) : null)));
    });
    navLinks = $$('a', nav);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => { if (pages.on && !pages.suspended) return; es.filter(e => e.isIntersecting).forEach(e => setActive(e.target.id)); }, { rootMargin: '-30% 0px -60% 0px' });
      steps.forEach(s => io.observe(s));
    }
    const first = hashTarget();
    if (pages.on && pages.cur) setActive(pages.cur.id);
    else if (steps[0]) setActive(first && first.matches('section.step') ? first.id : steps[0].id);
    if (IS_LAB) {
      const wrap = nav.parentElement;
      navProgressEl = h('p', { class: 'nav-progress', hidden: true });
      wrap.classList.add('has-progress');
      setupNavScroll(nav);
      const tog = h('button', { class: 'btn btn--sm parts-toggle', type: 'button', 'aria-pressed': String(!pages.on), 'aria-label': 'Show all parts on one page', title: 'Show all parts on one page',
        onclick: () => setAllParts(pages.on) }, h('span', { class: 'pt-icon', 'aria-hidden': 'true' }), h('span', { class: 'pt-text' }, 'All parts'));
      const pauseBtn = h('button', { class: 'btn btn--sm pause-btn', type: 'button', 'aria-label': 'Pause and bookmark', title: 'Pause and bookmark: save and remember where you stopped', 'aria-haspopup': 'dialog',
        onclick: ev => Lab.pause({ opener: ev.currentTarget }) }, h('span', { class: 'pb-icon', 'aria-hidden': 'true' }), h('span', { class: 'pb-text' }, 'Pause'));
      wrap.append(h('div', { class: 'nav-end' }, makeNavRing(), navProgressEl, pauseBtn, steps.length > 1 ? tog : null));
      addCopyLinks(steps);
      workListeners.push(updateProgress);
      setTimeout(updateProgress, 0);
      window.addEventListener('load', () => setTimeout(updateProgress, 50));
    }
  }
  Lab.progress = {
    update: updateProgress,
    /* For the home page: {done, total, started} cached by the lab page, {started:true} if work exists but no summary yet, or null. */
    forLab(id) {
      const p = gstore.get('progress:' + id);
      let started = false;
      try { started = Object.keys(localStorage).some(k => k.startsWith(`aplab:${id}:`) && !k.endsWith(':field:student-name') && !k.endsWith(':dataset')); } catch (e) { /* blocked */ }
      if (p && p.total) return Object.assign({ started }, p);
      return started ? { started: true } : null;
    },
    last: () => gstore.get('last'),
  };

  /* Home page (index.html): identity line, per-lab progress on [data-lab-progress] elements, resume link. */
  Lab.home = function (o = {}) {
    setTimeout(startOnboarding, 0);
    handleResumeHash();
    if (o.identity) { const host = typeof o.identity === 'string' ? $(o.identity) : o.identity; Lab.identity.mount(host, { compact: true }); if (!$('.manage-data')) homeManage(host); }
    $$('[data-lab-progress]').forEach(el => {
      const p = Lab.progress.forLab(el.dataset.labProgress);
      el.innerHTML = '';
      const txt = progressText(p);
      el.append(h('span', { class: 'prog-text' }, txt));
      if (!p || !p.total || txt === 'Not started') return;
      /* The bar shows part completion, plus the item progress of the part under way. */
      const frac = p.done / p.total + (p.partial && p.partial.total ? (p.partial.done / p.partial.total) / p.total : 0);
      el.append(h('span', { class: 'prog-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round(100 * Math.min(1, frac))}%` })));
    });
    if (o.resume) {
      const el = typeof o.resume === 'string' ? $(o.resume) : o.resume;
      let last = gstore.get('last');
      /* A "Pause & bookmark" is the student's own note of where they stopped: use it while it is at least as new as the last part visited. */
      const bm = gstore.get('bookmark');
      const useBm = !!(bm && /^lab\d\d$/.test(bm.lab) && (!last || (bm.t || 0) >= (last.t || 0) - 1000 || (last.lab === bm.lab && last.step === bm.step)));
      if (useBm) last = { lab: bm.lab, step: bm.step, name: bm.name, title: bm.title, t: bm.t };
      if (el && last && /^lab\d\d$/.test(last.lab)) {
        const labName = String(last.title || last.lab).replace(/\s+[—–-]\s+AP Bio (Digital )?Lab Bench$/, '');
        const hints = gstore.get('hint:' + last.lab, {}) || {};
        let hr = hints[last.step] || null;
        if (useBm && (!hr || !(hr.t > bm.t))) hr = { hint: bm.hint, done: bm.done, t: bm.t };
        const pr = Lab.progress.forLab(last.lab);
        const href = `${last.lab}.html${last.step ? '#' + encodeURIComponent(last.step) : ''}`;
        el.innerHTML = '';
        const hid = 'pickup-title';
        el.setAttribute('aria-labelledby', hid);
        el.append(
          h('div', { class: 'pickup-main' },
            h('p', { class: 'eyebrow' }, 'Pick up where you left off'),
            h('h2', { class: 'pickup-lab', id: hid }, labName),
            last.name ? h('p', { class: 'pickup-part' }, useBm ? 'You paused at: ' : 'Part: ', h('strong', null, last.name + (useBm && bm.stepNo ? ', step ' + bm.stepNo : ''))) : null,
            hr && hr.hint ? h('p', { class: 'pickup-next' }, h('span', { class: 'sn-k' }, 'Next: '), hr.hint)
              : hr && hr.done ? h('p', { class: 'pickup-next' }, h('span', { class: 'sn-k' }, '✓ '), hr.done) : null,
            pr && pr.total && progressText(pr) !== 'Not started' ? h('p', { class: 'pickup-prog small muted' }, progressText(pr, { suffix: true })) : null),
          h('a', { class: 'btn btn--primary btn--lg resume-link', href }, 'Resume', h('span', { class: 'sr-only' }, ' ' + labName + (last.name ? ', ' + last.name : '')), h('span', { 'aria-hidden': 'true' }, ' →')));
        el.hidden = false;
      }
    }
  };

  /* The latest "Next:" hint per lab part is remembered (aplab:hint:<lab> = {<part id>: {hint, done, t}}) so the
     home page can say what to do when a student comes back. Plain text only. */
  function rememberHint(boxEl, hint, doneText) {
    if (!IS_LAB) return;
    const sec = boxEl && boxEl.closest && boxEl.closest('section.step'); if (!sec || !sec.id) return;
    const plain = x => { const d = document.createElement('div'); d.innerHTML = x; return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
    const rec = { hint: plain(hint), done: plain(doneText), t: Date.now() };
    const all = gstore.get('hint:' + PAGE.id, {}) || {}, old = all[sec.id];
    if (old && old.hint === rec.hint && old.done === rec.done) return;
    all[sec.id] = rec; gstore.set('hint:' + PAGE.id, all);
  }

  /* ---------------- Pause & bookmark ----------------
     Lab.pause() saves everything, records the current part and its "Next:" hint as the bookmark (aplab:bookmark =
     {lab, step, name, stepNo, stepText, hint, done, title, t}; the home page's "Pick up where you left off" card reads it)
     and opens a calm full-screen card with the transfer code, "Save progress file" and "Keep working". */
  function plainText(x) { const d = document.createElement('div'); d.innerHTML = x; return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function currentPart() { return (pages.on && pages.cur) || (lastId && document.getElementById(lastId)) || $('section.step'); }
  function makeBookmark() {
    flushSaves();
    const sec = currentPart(); if (!sec) return null;
    const boxes = $$('.steps-box', sec);
    const box = boxes.find(b => $('li.si.is-current', b)) || boxes[0] || null;
    const cur = box && $('li.si.is-current', box);
    const nx = box && $('.steps-next', box);
    let hint = '', done = '';
    if (nx) { const txt = plainText(nx.innerHTML).replace(/^(Next:|✓)\s*/, ''); if (nx.classList.contains('is-complete')) done = txt; else hint = txt; }
    const rec = {
      lab: PAGE.id, step: sec.id, name: (sec.dataset.step || '').trim() || 'this part',
      stepNo: cur ? +($('.si-n', cur) || {}).textContent || 0 : 0, stepText: cur ? plainText($('.si-text', cur) ? $('.si-text', cur).innerHTML : '') : '',
      hint, done, title: document.title, t: Date.now(),
    };
    gstore.set('bookmark', rec);
    gstore.set('last', { lab: PAGE.id, step: sec.id, name: rec.name, title: document.title, t: rec.t });
    return rec;
  }
  let pauseEl = null, pauseOpener = null;
  function closePause() {
    if (!pauseEl) return;
    pauseEl.remove(); pauseEl = null; document.body.classList.remove('has-pause');
    document.removeEventListener('keydown', pauseKey, true);
    if (pauseOpener && pauseOpener.isConnected) { try { pauseOpener.focus(); } catch (e) { /* gone */ } }
    pauseOpener = null;
  }
  function pauseKey(e) {
    if (!pauseEl) return;
    if (e.key === 'Escape') { e.preventDefault(); closePause(); return; }
    if (e.key !== 'Tab') return;
    const f = $$('button, a[href], [tabindex="0"], textarea', pauseEl).filter(x => !x.disabled && !x.hidden && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !pauseEl.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  Lab.pause = function (o = {}) {
    if (!IS_LAB) return null;
    closePause();
    const rec = makeBookmark(); if (!rec) return null;
    pauseOpener = o.opener || document.activeElement;
    const status = h('p', { class: 'tool-status', 'aria-live': 'polite' });
    const xfer = transferBlock();
    const title = h('h2', { class: 'pause-title', id: 'pause-title', tabindex: '-1' }, `You stopped at ${rec.name}${rec.stepNo ? ', step ' + rec.stepNo : ''}.`);
    pauseEl = h('div', { class: 'pause-screen', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pause-title', 'aria-describedby': 'pause-sub' },
      h('div', { class: 'pause-card' },
        h('p', { class: 'eyebrow' }, 'Paused · ' + cleanTitle(rec.title)),
        title,
        h('p', { class: 'pause-sub', id: 'pause-sub' }, 'Your work is saved in this browser.'),
        rec.hint ? h('p', { class: 'pause-next' }, h('span', { class: 'sn-k' }, 'Next: '), rec.hint) : rec.done ? h('p', { class: 'pause-next' }, h('span', { class: 'sn-k' }, '✓ '), rec.done) : null,
        h('p', { class: 'small muted' }, 'Come back to the home page and press Resume, or reopen this lab on this computer. To carry on somewhere else, take your work with you.'),
        h('div', { class: 'pause-actions' },
          h('button', { class: 'btn btn--primary btn--lg', type: 'button', id: 'pause-keep', onclick: closePause }, 'Keep working'),
          h('button', { class: 'btn', type: 'button', onclick: () => { const name = saveProgressFile(); status.textContent = `Saved ${name} to your Downloads folder.`; Lab.toast('Progress file saved to Downloads', { type: 'ok', announce: false }); } }, 'Save progress file')),
        h('div', { class: 'pause-xfer' }, xfer),
        status));
    document.body.append(pauseEl); document.body.classList.add('has-pause');
    document.addEventListener('keydown', pauseKey, true);
    title.focus();
    return rec;
  };

  /* ---------------- Toasts ----------------
     Lab.toast(msg, {type:'ok'|'info'|'warn'|'bad', timeout, key, announce, action:{label, onClick}}) → {dismiss(), el}
     Brief confirmations in a polite live region at the bottom right (bottom centre on phones), clear of the
     safe areas. key: a newer toast with the same key replaces the older one. announce:false shows it without
     announcing it (use when the page already has its own aria-live status for the same event). */
  const autoToasts = { ready: false }; // automatic toasts (tables) wait until the page has finished restoring saved work
  window.addEventListener('load', () => setTimeout(() => { autoToasts.ready = true; }, 600));
  let toastHost = null;
  function toastRegion() {
    if (toastHost && toastHost.isConnected) return toastHost;
    toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' });
    document.body.append(toastHost);
    return toastHost;
  }
  const TOAST_ICON = { ok: '✓', info: 'i', warn: '!', bad: '✕' };
  Lab.toast = function (msg, o = {}) {
    if (!document.body) return { dismiss() {}, el: null };
    const host = toastRegion(), type = TOAST_ICON[o.type] ? o.type : 'ok';
    $$('.toast', host).filter(x => (o.key && x._key === o.key) || x._msg === msg).forEach(x => x.remove());
    const t = h('div', { class: 'toast toast--' + type }, h('span', { class: 'toast-icon', 'aria-hidden': 'true' }, TOAST_ICON[type]), h('span', { class: 'toast-msg' }, msg));
    t._msg = msg; t._key = o.key || null;
    if (o.announce === false) t.setAttribute('aria-hidden', 'true');
    let timer = null;
    const dismiss = () => { clearTimeout(timer); if (!t.isConnected || t.classList.contains('is-leaving')) return; t.classList.add('is-leaving'); setTimeout(() => t.remove(), Lab.reducedMotion() ? 0 : 200); };
    if (o.action) t.append(h('button', { class: 'toast-action', type: 'button', onclick: () => { dismiss(); if (o.action.onClick) o.action.onClick(); } }, o.action.label));
    t.append(h('button', { class: 'toast-close', type: 'button', tabindex: '-1', 'aria-hidden': 'true', title: 'Dismiss', onclick: dismiss }, '×'));
    host.append(t);
    const all = $$('.toast', host); if (all.length > 3) all.slice(0, all.length - 3).forEach(x => x.remove());
    const ms = o.timeout || (o.action ? 8000 : type === 'bad' ? 6000 : 3200);
    const arm = () => { clearTimeout(timer); timer = setTimeout(dismiss, ms); };
    t.addEventListener('mouseenter', () => clearTimeout(timer)); t.addEventListener('mouseleave', arm);
    t.addEventListener('focusin', () => clearTimeout(timer)); t.addEventListener('focusout', arm);
    arm();
    return { dismiss, el: t };
  };

  /* ---------------- Guidance inside simulations ----------------
     Lab.steps(el, [{id, text, done: () => bool, target, hint, optional, sticky}], {title, doneText, pulse}) → {refresh(), current, el}
       Numbered checklist that ticks itself off. The first unfinished (non-optional) step is current: it is
       highlighted, a one-line "Next:" hint shows under the list, and its target control (selector, element,
       or function returning one) gets a gentle pulsing outline. Clicking a step's text moves focus to its target.
       sticky:true keeps a step ticked once done. Steps re-check after every input/change/click on the page,
       after table/quiz/answer changes, every 0.6 s, and on Lab.steps.refresh().
     Lab.gate(button, () => reason | '') disables a button while reason is non-empty and shows the reason
       ("Pour the disks first") in small text right after it (linked with aria-describedby). */
  const GUIDES = [];
  let guideRaf = 0, guideBound = false;
  function refreshGuides() {
    if (!GUIDES.length || guideRaf) return;
    guideRaf = requestAnimationFrame(() => { guideRaf = 0; GUIDES.forEach(g => { try { g.refresh(); } catch (e) { console.warn(e); } }); });
  }
  function bindGuides() {
    if (guideBound) return; guideBound = true;
    ['input', 'change', 'click', 'keyup'].forEach(ev => document.addEventListener(ev, () => setTimeout(refreshGuides, 0), true));
    workListeners.push(refreshGuides);
    setInterval(() => { if (!document.hidden) refreshGuides(); }, 600);
  }
  const resolveEl = t => typeof t === 'function' ? t() : typeof t === 'string' ? $(t) : t;
  const PULSED = new Set(); // controls a Lab.steps list is currently pulsing
  /* Open whatever hides the control: closed <details>, a Data/Graph/tab panel that is not showing. */
  function revealTarget(t) {
    for (let a = t.parentElement; a; a = a.parentElement) {
      if (a.tagName === 'DETAILS' && !a.open) a.open = true;
      if (a.hidden && a.getAttribute('role') === 'tabpanel') { const b = document.getElementById(a.getAttribute('aria-labelledby') || ''); if (b) b.click(); }
    }
  }
  /* A ring that lands on an element: Lab.highlight(el, {ms = 2500}). A fixed-position overlay (so no clipped ancestor or focus
     style can hide it) that follows the element while the page scrolls, and runs about 2.5 s once the scroll has settled. Three
     expanding pulses; with reduced motion it is a steady ring for the same time. Works after the caller has opened the part,
     closed <details> and tab panels (revealTarget); an element that has no box of its own gets its nearest visible ancestor. */
  let ringEl = null, ringRaf = 0, ringEnd = 0;
  function visibleBox(t) {
    for (let e = t; e && e !== document.body; e = e.parentElement) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return e; }
    return null;
  }
  function stopRing() { cancelAnimationFrame(ringRaf); ringRaf = 0; if (ringEl) { ringEl.remove(); ringEl = null; } }
  Lab.highlight = function (t, o = {}) {
    if (typeof t === 'string') t = $(t);
    if (!t) return null;
    stopRing();
    const ms = o.ms || 2500, pad = 6, still = Lab.reducedMotion();
    const ring = ringEl = h('div', { class: 'lab-ring' + (still ? ' is-still' : ''), 'aria-hidden': 'true' });
    document.body.append(ring);
    let last = '', calm = 0, t0 = performance.now(), settled = 0;
    const tick = now => {
      if (ringEl !== ring) return;
      const box = visibleBox(t);
      if (!box) { ringRaf = requestAnimationFrame(tick); if (now - t0 > 3000) stopRing(); return; }
      const r = box.getBoundingClientRect();
      const key = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
      ring.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
      ring.classList.add('is-on');
      calm = key === last ? calm + 1 : 0; last = key;
      if (!settled && (calm >= 6 || now - t0 > 1500)) { settled = now; ring.classList.add('go'); }
      if (settled && now - settled > ms) { stopRing(); return; }
      ringRaf = requestAnimationFrame(tick);
    };
    ringRaf = requestAnimationFrame(tick);
    return ring;
  };
  /* "Show me" arrival: open its part, scroll to it, ring it for a few seconds and give it keyboard focus. */
  function focusTarget(t) {
    const sec = partOf(t);
    if (sec && pages.on && !pages.suspended && sec !== pages.cur) goPart(sec, { hash: true, scroll: false });
    revealTarget(t);
    const vb = visibleBox(t) || t;
    vb.scrollIntoView({ block: 'center', behavior: Lab.reducedMotion() ? 'auto' : 'smooth' });
    Lab.highlight(t);
    t.classList.add('lab-pulse'); clearTimeout(t._flashT);
    t._flashT = setTimeout(() => { if (!PULSED.has(t)) t.classList.remove('lab-pulse'); }, 3600);
    let f = t.matches('input, select, textarea, button, a[href], [tabindex]') ? t : $('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]', t);
    if (!f || f.disabled) { f = (f && f.disabled ? f.parentElement : t) || t; if (!f.hasAttribute('tabindex')) f.tabIndex = -1; } // a gated (disabled) button cannot take focus: focus its wrapper
    f.focus({ preventScroll: true });
  }
  Lab.steps = function (el, list, o = {}) {
    if (typeof el === 'string') el = $(el);
    const uid = (el.id || 'steps' + GUIDES.length);
    el.classList.add('steps-box');
    const title = h('p', { class: 'steps-title', id: uid + '-title' }, o.title || 'Steps');
    const ol = h('ol', { class: 'steps', 'aria-labelledby': uid + '-title' });
    const items = list.map((s, i) => {
      const text = h('span', { class: 'si-text', html: s.text });
      const plain = s.text.replace(/<[^>]+>/g, '');
      const show = s.target ? h('button', { type: 'button', class: 'si-show', title: 'Scroll to this control and highlight it. It does not do the step for you.', 'aria-label': 'Show me where: ' + plain, onclick: () => { const t = resolveEl(s.target); if (t) focusTarget(t); } }, 'Show me ↓') : null;
      const label = text;
      const state = h('span', { class: 'sr-only si-state' });
      const li = h('li', { class: 'si' + (s.optional ? ' is-optional' : ''), 'data-step-id': s.id || null },
        h('span', { class: 'si-n', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'si-body' }, label, state, s.optional ? h('span', { class: 'si-opt' }, ' optional') : null, show ? ' ' : null, show));
      ol.append(li);
      return { s, li, state, d: false, stuck: false };
    });
    const next = h('p', { class: 'steps-next', 'aria-live': 'polite' });
    el.append(title, ol, next);
    let pulsed = null, cur = -2, lastNext = null;
    function refresh() {
      let c = -1;
      items.forEach((it, i) => {
        let d = false; try { d = !!(it.s.done && it.s.done()); } catch (e) { d = false; }
        if (d && it.s.sticky) it.stuck = true;
        it.d = d || it.stuck;
        it.li.classList.toggle('is-done', it.d);
        if (c < 0 && !it.d && !it.s.optional) c = i;
      });
      items.forEach((it, i) => {
        const on = i === c;
        it.li.classList.toggle('is-current', on);
        if (on) it.li.setAttribute('aria-current', 'step'); else it.li.removeAttribute('aria-current');
        const st = it.d ? ' (done)' : on ? ' (next step)' : '';
        if (it.state.textContent !== st) it.state.textContent = st;
      });
      const ci = items[c];
      const nt = ci ? (ci.s.hint || ci.s.text) : (o.doneText || 'All steps done.');
      if (nt !== lastNext) { lastNext = nt; rememberHint(el, ci ? nt : '', ci ? '' : nt); next.innerHTML = ''; next.append(h('span', { class: 'sn-k' }, ci ? 'Next: ' : '✓ '), h('span', { html: nt })); next.classList.toggle('is-complete', !ci); }
      let tgt = ci && ci.s.target ? resolveEl(ci.s.target) : null;
      if (o.pulse === false) tgt = null;
      if (pulsed !== tgt) { if (pulsed) { pulsed.classList.remove('lab-pulse'); PULSED.delete(pulsed); } if (tgt) { tgt.classList.add('lab-pulse'); PULSED.add(tgt); } pulsed = tgt; }
      if (c !== cur) { cur = c; if (o.onChange) { try { o.onChange(c, ci ? ci.s : null); } catch (e) { console.warn(e); } } }
    }
    const box = { el, uid, items }; STEPBOXES.push(box);
    const api = { el, refresh() { refresh(); stepTick(box); }, get current() { return cur; }, get items() { return items.map(it => ({ id: it.s.id, done: it.d })); } };
    GUIDES.push(api); bindGuides(); api.refresh();
    return api;
  };
  Lab.steps.refresh = refreshGuides;
  Lab.gate = function (btn, fn, o = {}) {
    if (typeof btn === 'string') btn = $(btn);
    if (!btn) return null;
    const id = (btn.id || 'gate' + GUIDES.length) + '-why';
    const why = h('span', { class: 'gate-why', id, hidden: true });
    const showBtn = o.show ? h('button', { type: 'button', class: 'si-show', hidden: true, onclick: () => { const t = resolveEl(o.show); if (t) focusTarget(t); } }, 'Show me ↓') : null;
    btn.insertAdjacentElement('afterend', why); if (showBtn) why.insertAdjacentElement('afterend', showBtn);
    btn.setAttribute('aria-describedby', ((btn.getAttribute('aria-describedby') || '') + ' ' + id).trim());
    let last = null;
    const g = { el: btn, refresh() {
      let r = ''; try { r = fn() || ''; } catch (e) { r = ''; }
      if (r === last) return; last = r;
      btn.disabled = !!r; btn.classList.toggle('is-gated', !!r); why.textContent = r; why.hidden = !r; if (showBtn) showBtn.hidden = !r;
    } };
    GUIDES.push(g); bindGuides(); g.refresh();
    return g;
  };

  /* ---------------- Tabs ----------------
     Lab.tabs(container, {label, start}) turns  <div class="tabs"><section data-tab="Label">…</section>…</div>
     into an ARIA tab list (arrow keys, Home/End) with one visible panel. → {select(i)} */
  let tabCount = 0;
  function wireTabs(list, tabs, onSelect, label) {
    list.setAttribute('role', 'tablist'); if (label) list.setAttribute('aria-label', label);
    tabs.forEach((t, i) => {
      t.btn.setAttribute('role', 'tab'); t.btn.type = 'button';
      t.btn.setAttribute('aria-controls', t.panel.id);
      t.panel.setAttribute('aria-labelledby', t.btn.id);
      t.btn.addEventListener('click', () => onSelect(i, true));
      t.btn.addEventListener('keydown', e => {
        const vis = tabs.filter(x => !x.btn.hidden), at = vis.indexOf(t);
        let to = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = vis[(at + 1) % vis.length];
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = vis[(at - 1 + vis.length) % vis.length];
        else if (e.key === 'Home') to = vis[0]; else if (e.key === 'End') to = vis[vis.length - 1];
        if (!to) return;
        e.preventDefault(); onSelect(tabs.indexOf(to), true); to.btn.focus();
      });
    });
  }
  function markTabs(tabs, i) { tabs.forEach((t, j) => { t.btn.setAttribute('aria-selected', String(i === j)); t.btn.tabIndex = i === j ? 0 : -1; }); }
  Lab.tabs = function (el, o = {}) {
    if (typeof el === 'string') el = $(el);
    const n = ++tabCount, panels = $$(':scope > [data-tab]', el);
    const list = h('div', { class: 'tabs-list' });
    const tabs = panels.map((p, i) => {
      p.id = p.id || `tabs${n}-p${i}`; p.classList.add('tab-panel'); p.setAttribute('role', 'tabpanel'); p.tabIndex = 0;
      const b = h('button', { class: 'tab', id: `tabs${n}-t${i}` }, p.dataset.tab); list.append(b);
      return { btn: b, panel: p };
    });
    el.classList.add('tabs'); el.prepend(list);
    const select = i => { markTabs(tabs, i); tabs.forEach((t, j) => { t.panel.hidden = i !== j; }); const sec = partOf(el); if (sec) syncPart(sec); };
    wireTabs(list, tabs, select, o.label);
    select(o.start || 0);
    return { select, el };
  };

  /* ---------------- Results beside the simulation ----------------
     Lab.results(sim, {data:[…], graph:[…], start:'graph'|'data', label})  items: '#id' | element | {el:'#id', title:'…'}
     Moves existing Lab.table / Lab.chart containers (ids unchanged) into a results panel next to the scene:
       ≥1280px wide: scene stays in view; a right-hand column switches Graph ⇄ Data.
       narrower:     a Scene / Data / Graph switch above the scene; Data and Graph cover the scene in the same box.
     A "new" badge appears on a tab when its table or chart changes while it is not showing. → {select(kind), el} */
  const WIDE_RESULTS = '(min-width: 1280px)';
  /* The "new" badge on a Data / Graph tab means a result arrived after the student acted. Redraws that are not new results (the page
     restoring saved data on load, a part being shown again, a theme change, printing) must not raise it: lab.js stays quiet around part
     shows, theme redraws and print preparation, and a page can say so itself: Lab.results.quiet(fn) runs fn and the badges ignore
     everything it changes (plus the next 900 ms of asynchronous redraws), e.g. Lab.results.quiet(() => table.setRows(saved)). */
  let badgeQuietUntil = Date.now() + 1500;   // page load
  function quietBadges(ms) { badgeQuietUntil = Math.max(badgeQuietUntil, Date.now() + (ms || 900)); }
  Lab.results = function (sim, o = {}) {
    if (typeof sim === 'string') sim = $(sim);
    const stage = $(':scope > .stage', sim);
    if (!stage) return null;
    const n = ++tabCount, idp = sim.id || 'sim' + n;
    const main = h('div', { class: 'sim-main has-results' });
    stage.before(main);
    const list = h('div', { class: 'sim-tabs' });
    const watched = [];
    const panel = (kind, items) => {
      const p = h('div', { class: 'sim-panel sim-panel--' + kind, id: idp + '-' + kind, role: 'tabpanel', tabindex: '0' });
      (items || []).forEach(it => {
        const el = resolveEl(it && it.el ? it.el : it); if (!el) return;
        if (it && it.title) p.append(h('p', { class: 'panel-title' }, it.title));
        p.append(el); watched.push({ el, kind });
      });
      return p;
    };
    if (!stage.id) stage.id = idp + '-scene';
    const kinds = [{ k: 'scene', label: o.sceneLabel || 'Scene', panel: stage }];
    if (o.data && o.data.length) kinds.push({ k: 'data', label: 'Data', panel: panel('data', o.data) });
    if (o.graph && o.graph.length) kinds.push({ k: 'graph', label: 'Graph', panel: panel('graph', o.graph) });
    const tabs = kinds.map(K => {
      const badge = h('span', { class: 'tab-badge', hidden: true }, 'new');
      const btn = h('button', { class: 'sim-tab', 'data-tab': K.k, id: idp + '-tab-' + K.k }, h('span', null, K.label), badge);
      list.append(btn);
      return { k: K.k, btn, panel: K.panel, badge };
    });
    main.append(list, stage, ...kinds.slice(1).map(K => K.panel));
    const mq = window.matchMedia ? window.matchMedia(WIDE_RESULTS) : { matches: false };
    const firstResult = (o.start && o.start !== 'scene') ? o.start : (kinds.find(K => K.k === 'graph') ? 'graph' : (kinds[1] || kinds[0]).k);
    let wideSel = firstResult, narrowSel = 'scene';
    const curKind = () => mq.matches ? wideSel : narrowSel;
    function apply() {
      const wide = mq.matches, cur = curKind();
      main.classList.toggle('is-wide', wide);
      list.setAttribute('aria-label', o.label || (wide ? 'Results' : 'Scene and results'));
      markTabs(tabs, tabs.findIndex(t => t.k === cur));
      tabs.forEach(t => {
        t.btn.hidden = wide && t.k === 'scene';
        if (t.k !== 'scene') t.panel.hidden = t.k !== cur;
        if (t.k === cur) t.badge.hidden = true;
      });
      main.classList.toggle('shows-result', !wide && cur !== 'scene'); // narrow: the panel covers the scene, which keeps its size
      if (wide || cur === 'scene') { stage.setAttribute('role', wide ? 'region' : 'tabpanel'); stage.setAttribute('aria-label', 'Scene'); }
      const p = tabs.find(t => t.k === cur);
      if (p && p.k !== 'scene') REG.charts.forEach(c => { if (p.panel.contains(c.el)) c.render(); });
      fitData();
    }
    /* A Data panel whose table would scroll sideways gets a wider column (up to 56% of the box) before anything is hidden. */
    let fitQ = false;
    function fitData() {
      main.style.removeProperty('--res-w');
      const dp = tabs.find(t => t.k === 'data');
      if (!main.classList.contains('is-wide') || !dp || dp.panel.hidden || !main.clientWidth) { main.classList.remove('is-widened'); return; }
      let need = 0;
      $$('.table-wrap', dp.panel).forEach(w => { const t = $('table', w); if (t && t.scrollWidth > w.clientWidth + 2) need = Math.max(need, t.scrollWidth + (dp.panel.clientWidth - w.clientWidth) + 2); });
      const base = dp.panel.clientWidth;
      if (need > base) main.style.setProperty('--res-w', Math.min(need, Math.floor(main.clientWidth * 0.56)) + 'px');
      main.classList.toggle('is-widened', need > base);
    }
    const fitSoon = () => { if (fitQ) return; fitQ = true; requestAnimationFrame(() => { fitQ = false; fitData(); }); };
    window.addEventListener('resize', fitSoon);
    wireTabs(list, tabs, i => { const k = tabs[i].k; if (mq.matches) { if (k !== 'scene') wideSel = k; } else { narrowSel = k; if (k !== 'scene') wideSel = k; } apply(); }, o.label || 'Results');
    stage.setAttribute('aria-labelledby', tabs[0].btn.id);
    if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply);
    apply();
    if ('MutationObserver' in window) {
      const mo = new MutationObserver(recs => {
        fitSoon();
        if (!autoToasts.ready || Date.now() < badgeQuietUntil) return;   // loading, restoring saved data or re-showing a part: not a new result
        const cur = curKind();
        recs.forEach(r => { if (r.addedNodes.length && Array.from(r.addedNodes).every(n => n.classList && n.classList.contains('scroll-hint'))) return; const w = watched.find(x => x.el === r.target); if (!w || w.kind === cur) return; const t = tabs.find(x => x.k === w.kind); if (t) t.badge.hidden = false; });
      });
      watched.forEach(w => mo.observe(w.el, { childList: true }));
    }
    sim.classList.add('has-results');
    return { el: main, select(k) { const i = tabs.findIndex(t => t.k === k); if (i >= 0) { if (mq.matches) { if (k !== 'scene') wideSel = k; } else narrowSel = k; apply(); } }, get current() { return curKind(); } };
  };
  Lab.results.quiet = (fn, ms) => { quietBadges(ms); try { if (typeof fn === 'function') fn(); } finally { quietBadges(ms); } };

  /* ---------------- Onboarding: first-visit tour, backup reminders, storage warnings ----------------
     Tour (lab pages): a short dismissible walkthrough shown once per browser (localStorage 'aplab:tour'),
       after the student has signed in. Lab.tour.start({force:true}) / .reset(); the "Help" link in the sign-in line
       shows it again. Steps anchor to elements that exist on every lab; a step whose element is missing or hidden
       (paged mode shows one part at a time) is explained without a highlight.
     Backups (lab pages): Lab.backup.state() → {answers, rows, meaningful, dirty, unsaved, lastSaved}. markSaved(kind) is
       called when a progress file is saved or a resume code is copied. After meaningful work with no backup, a
       dismissible bar offers "Save progress file" (once per session per lab, never during an animation or while
       typing). While unsaved work exists a beforeunload guard is attached (the browser's own generic prompt).
     Storage: if a localStorage write fails, a persistent warning shows; navigator.storage.persist() is requested
       once the student has done real work. */
  const STORAGE_MSG = 'This browser isn’t saving your work. Download your report or a progress file before you leave.';
  const BACKUP_MSG = 'Your work is only saved in this browser. Save a progress file to be safe.';
  const QUIET_MS = 3500;       // no typing or table changes for this long before the reminder appears
  const isBusyMode = () => document.body.classList.contains('report-mode') || document.body.classList.contains('worksheet-mode');
  let leaving = false, guardOn = false, memBackup = null, memTourSeen = false, persistAsked = false;
  const sessionGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const sessionSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } };

  /* ---- storage warning ---- */
  function probeStorage() { try { const k = 'aplab:__probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } }
  let storageWarnEl = null;
  Lab._storageWarn = function () {
    if (PAGE.kind !== 'lab' && PAGE.kind !== 'home') return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', Lab._storageWarn, { once: true }); return; }
    if (storageWarnEl && storageWarnEl.isConnected) return;
    storageWarnEl = h('div', { class: 'storage-warn', role: 'alert' },
      h('span', { class: 'sw-icon', 'aria-hidden': 'true' }, '!'),
      h('span', { class: 'sw-msg' }, STORAGE_MSG),
      IS_LAB ? h('button', { class: 'btn btn--sm', type: 'button', onclick: () => { saveProgressFile(); Lab.toast('Progress file saved to Downloads', { type: 'ok', announce: false }); } }, 'Save progress file') : null);
    document.body.prepend(storageWarnEl);
  };
  function requestPersist() {
    if (persistAsked) return; persistAsked = true;
    try { if (navigator.storage && navigator.storage.persist) { const p = navigator.storage.persist(); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* ignore */ }
  }

  /* ---- what counts as work, and is it backed up? ---- */
  function workSnapshot() {
    let answers = 0, rows = 0; const parts = [];
    $$('[data-save]').forEach(f => {
      if (f.closest('.id-box') || f.id === 'student-name') return;
      const v = f.type === 'checkbox' ? (f.checked ? '1' : '') : String(f.value == null ? '' : f.value);
      parts.push(f.dataset.save + '=' + v);
      if (f.tagName === 'TEXTAREA' && v.trim()) answers++;
    });
    REG.tables.forEach(t => {
      if (!t.opts.save) return;
      const r = t.getRows(), preset = (t.opts.rows || []).map(x => JSON.stringify(x));
      rows += r.filter(x => !x._setup && preset.indexOf(JSON.stringify(x)) < 0).length; // rows the page starts with are not work
      parts.push('t:' + t.opts.save + JSON.stringify(r));
    });
    REG.quizzes.forEach(q => {
      answers += $$('.feedback.ok, .feedback.bad', q.el).filter(f => !f.hidden).length;
      parts.push('q:' + q.id + $$('input', q.el).filter(i => i.checked || (i.type === 'number' && i.value)).map(i => i.id + ':' + i.value).join(','));
    });
    return { answers, rows, sig: hash32(parts.join('\u0001')) };
  }
  const recKey = () => 'backup:' + PAGE.id;
  const backupRec = () => memBackup || gstore.get(recKey());
  function writeRec(rec) { memBackup = rec; gstore.set(recKey(), rec); }
  function backupState() {
    const w = workSnapshot(); let rec = backupRec();
    if (rec && rec.adopt && !rec.sig) { rec = Object.assign({}, rec, { sig: w.sig }); writeRec(rec); } // work loaded from a progress file counts as backed up
    const meaningful = w.answers >= 3 || w.rows >= 1;
    const dirty = rec && rec.sig ? rec.sig !== w.sig : (w.answers + w.rows) > 0;
    return { answers: w.answers, rows: w.rows, meaningful, dirty, unsaved: meaningful && dirty, lastSaved: rec ? rec.t : null };
  }
  const clock = t => { try { return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  function updateBackupStatus(s) {
    s = s || backupState();
    $$('.backup-status').forEach(el => {
      el.classList.toggle('is-unsaved', !!s.unsaved);
      el.textContent = !s.lastSaved ? (s.unsaved ? 'You have not saved a progress file for this lab yet.' : 'No progress file saved yet.')
        : s.dirty ? `You have changes since your last backup (${clock(s.lastSaved)}). Save a new progress file to keep them.`
        : `Backed up at ${clock(s.lastSaved)}. Nothing new since.`;
    });
  }
  Lab.backup = {
    state: backupState,
    guardActive: () => guardOn,
    markSaved(kind) {
      const w = workSnapshot();
      writeRec({ t: Date.now(), sig: w.sig, kind: kind || 'file' });
      removeBar(); syncGuard(); updateBackupStatus();
    },
    check: () => checkBackup(),
    barShown: () => !!(backupBar && backupBar.isConnected),
  };
  Lab._allowLeave = function () { leaving = true; syncGuard(); };

  /* ---- leaving the page ---- */
  function onBeforeUnload(e) { if (leaving) return; e.preventDefault(); e.returnValue = ''; return ''; } // the browser shows its own generic prompt
  function syncGuard(s) {
    const need = !leaving && (s || backupState()).unsaved;
    if (need && !guardOn) { window.addEventListener('beforeunload', onBeforeUnload); guardOn = true; }
    else if (!need && guardOn) { window.removeEventListener('beforeunload', onBeforeUnload); guardOn = false; }
  }

  /* ---- the reminder bar ---- */
  let backupBar = null, lastWork = Date.now(), loadedAt = Date.now(), bkShown = false;
  const shownKey = () => 'aplab:bk-shown:' + PAGE.id;
  function removeBar() {
    if (backupBar) { backupBar.remove(); backupBar = null; }
    document.body.classList.remove('has-backup-bar'); document.documentElement.style.removeProperty('--backup-bar-h');
  }
  /* showBar('nudge') is the end-of-period nudge: the same bar with other words and buttons, shown at most once per browser session. */
  function showBar(kind) {
    const nudge = kind === 'nudge';
    if (nudge) sessionSet(NUDGE_KEY, '1'); else { bkShown = true; sessionSet(shownKey(), '1'); }
    const region = h('div', { class: 'backup-bar' + (nudge ? ' nudge-bar' : ''), role: 'status', 'aria-live': 'polite' });
    backupBar = region; document.body.append(region);
    setTimeout(() => { // fill after insertion so screen readers announce it politely
      if (!region.isConnected) return;
      const dismiss = h('button', { class: 'bb-close', type: 'button', 'aria-label': 'Dismiss this reminder', title: 'Dismiss', onclick: removeBar }, '×');
      if (nudge) region.append(h('span', { class: 'bb-icon', 'aria-hidden': 'true' }, 'i'),
        h('p', { class: 'bb-msg' }, NUDGE_MSG),
        h('div', { class: 'bb-actions' },
          h('button', { class: 'btn btn--sm btn--primary nudge-docx', type: 'button', onclick: ev => nudgeDocx(ev.currentTarget) }, 'Download .docx'),
          h('button', { class: 'btn btn--sm nudge-code', type: 'button', onclick: ev => nudgeCode(ev.currentTarget) }, 'Transfer code'),
          dismiss));
      else region.append(h('span', { class: 'bb-icon', 'aria-hidden': 'true' }, 'i'),
        h('p', { class: 'bb-msg' }, storageBad ? STORAGE_MSG : BACKUP_MSG),
        h('div', { class: 'bb-actions' },
          h('button', { class: 'btn btn--sm btn--primary bb-save', type: 'button', onclick: () => { saveProgressFile(); Lab.toast('Progress file saved to Downloads', { type: 'ok', announce: false }); } }, 'Save progress file'),
          dismiss));
      document.body.classList.add('has-backup-bar');
      document.documentElement.style.setProperty('--backup-bar-h', region.offsetHeight + 'px');
    }, 60);
  }
  /* ---- end-of-period nudge ----
     Meaningful work that is not backed up (Lab.backup.state().unsaved: no progress file or transfer code since) and the lab tab
     open for 40+ minutes: one gentle, dismissible banner per browser session, with Download .docx and Transfer code buttons.
     Never while a Lab.loop animation runs, while typing, over a dialog or the tour; it waits and tries again every 2 s. */
  const NUDGE_MS = 40 * 60 * 1000, NUDGE_KEY = 'aplab:nudge-shown';
  const NUDGE_MSG = 'Period ending soon? Download your report or get a transfer code.';
  Lab.nudge = { after: NUDGE_MS, shown: () => !!sessionGet(NUDGE_KEY) };
  async function nudgeDocx(btn) {
    btn.disabled = true;
    try { const blob = await Lab.report.docx(), name = reportFileBase() + '.docx'; downloadBlob(blob, name); Lab.toast(`Downloaded ${name}`, { type: 'ok', announce: false }); removeBar(); reportSaved(); }
    catch (e) { Lab.toast(e && e.message === 'docx-load' ? 'Could not load the Word file tool. Check your internet connection, or get a transfer code.' : 'Could not build the Word file here. Get a transfer code instead.', { type: 'warn' }); btn.disabled = false; }
  }
  function nudgeCode(btn) {
    removeBar();
    Lab.pause({ opener: btn });   // the pause card holds the transfer code and QR; open it ready to use
    const go = pauseEl && $('.transfer-btn', pauseEl); if (go) go.click();
  }
  function maybeNudge(s) {
    if (backupBar || !s.unsaved || sessionGet(NUDGE_KEY)) return;
    if (Date.now() - loadedAt < NUDGE_MS) return;
    if (document.hidden || LOOPS.size || tourEl || dmEl || pauseEl || isBusyMode()) return;
    if (Date.now() - lastWork < QUIET_MS) return;
    showBar('nudge');
  }
  function checkBackup() {
    if (!IS_LAB || !document.body) return;
    const s = backupState();
    syncGuard(s); updateBackupStatus(s);
    if (s.meaningful) requestPersist();
    if (backupBar && !s.dirty) removeBar();
    maybeNudge(s);
    if (backupBar || bkShown || sessionGet(shownKey())) return;
    if (!s.unsaved || document.hidden || LOOPS.size || tourEl || isBusyMode()) return;
    const t = Date.now();
    if (t - lastWork < QUIET_MS || t - loadedAt < QUIET_MS) return;
    showBar();
  }

  /* ---- first-visit tour ---- */
  const TOUR_KEY = 'tour';
  let tourEl = null, tourOpener = null, tourIdx = 0, tourList = [], tourRaf = 0;
  const shown = el => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const firstShown = sel => $$(sel).find(shown) || null;
  const tourDefs = () => [
    { id: 'nav', find: () => firstShown('.step-nav'), title: 'Move through the lab one part at a time',
      body: 'Use the part tabs up here, or the Back and Next buttons at the bottom of each part (the left and right arrow keys work too). A check mark means the part is done. “All parts” shows the whole lab on one page.' },
    { id: 'steps', find: () => firstShown('.steps-box'), title: 'Follow the Steps checklist',
      body: 'Each simulation part starts with a Steps list. A step ticks itself off when you finish it, and the “Next:” line under it tells you what to do now.',
      plain: 'Each simulation part starts with a Steps list. A step ticks itself off when you finish it, and a “Next:” line tells you what to do now. You will see it as soon as you open a simulation part.' },
    { id: 'results', find: () => firstShown('.sim-tabs'), title: 'Your results build next to the simulation',
      body: 'Switch between Data and Graph to watch your table fill and your graph grow as you run trials.',
      plain: 'Next to each simulation, a Data / Graph switch shows your table filling and your graph growing as you run trials. A small “new” badge marks a tab that changed.' },
    { id: 'who', find: () => firstShown('.id-box'), title: 'Your name and Dataset ID',
      body: 'Your name and class period go on your report. The Dataset ID tells your teacher which set of simulated numbers is yours. “New dataset” starts fresh numbers, and “Help” shows this tour again.',
      plain: 'Your name and class period go on your report, and your Dataset ID identifies your own simulated numbers.' },
    { id: 'submit', find: () => firstShown('.report-bar'), title: 'Hand in your work and back it up',
      body: 'Download a .docx or save a PDF, then hand it in the way your teacher asks. Your work is saved only in this browser, so also save a progress file below.',
      plain: 'The last part, Submit, has the report buttons (Download .docx, Save as PDF) and “Move your work to another computer”. Your work is saved only in this browser, so save a progress file there before you leave.' },
  ];
  const markTourSeen = () => { memTourSeen = true; gstore.set(TOUR_KEY, { seen: true, v: 1, t: Date.now() }); };
  const tourSeen = () => memTourSeen || !!gstore.get(TOUR_KEY);
  function tourFocusables() { return tourEl ? $$('button:not([disabled])', $('.tour-card', tourEl)) : []; }
  function closeTour() {
    if (!tourEl) return;
    document.removeEventListener('keydown', tourKey, true);
    window.removeEventListener('resize', tourLayoutSoon); window.removeEventListener('scroll', tourLayoutSoon, true);
    tourEl.remove(); tourEl = null; document.body.classList.remove('tour-open');
    const o = tourOpener; tourOpener = null;
    if (o && o !== document.body && o.isConnected && typeof o.focus === 'function') { try { o.focus(); } catch (e) { /* gone */ } }
  }
  function tourKey(e) {
    if (!tourEl) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeTour(); return; }
    if (e.key === 'Tab') {
      const f = tourFocusables(), card = $('.tour-card', tourEl);
      if (!f.length) { e.preventDefault(); card.focus(); return; }
      const first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (!card.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && (a === first || a === card)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    }
  }
  function tourLayoutSoon() { if (!tourRaf) tourRaf = requestAnimationFrame(() => { tourRaf = 0; tourLayout(); }); }
  function tourLayout() {
    if (!tourEl) return;
    const d = tourList[tourIdx], card = $('.tour-card', tourEl), spot = $('.tour-spot', tourEl);
    const t = d.find && d.find();
    const vw = window.innerWidth, vh = window.innerHeight, pad = 6, m = 12;
    const small = vw < 640;
    tourEl.classList.toggle('is-nospot', !t);
    card.classList.toggle('is-sheet', small);
    card.style.top = card.style.left = '';
    if (!t) {
      spot.style.width = spot.style.height = '0px';
      if (!small) { card.style.left = Math.max(m, (vw - card.offsetWidth) / 2) + 'px'; card.style.top = Math.max(m, (vh - card.offsetHeight) / 2) + 'px'; }
      return;
    }
    const r = t.getBoundingClientRect();
    spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px';
    spot.style.width = (r.width + 2 * pad) + 'px'; spot.style.height = (r.height + 2 * pad) + 'px';
    if (small) return; // the card is a bottom sheet
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const clampX = x => Math.min(Math.max(m, x), vw - cw - m), clampY = y => Math.min(Math.max(m, y), vh - ch - m);
    let top, left;
    if (r.bottom + pad + m + ch <= vh - m) { top = r.bottom + pad + m; left = clampX(r.left); }
    else if (r.top - pad - m - ch >= m) { top = r.top - pad - m - ch; left = clampX(r.left); }
    else if (r.right + pad + m + cw <= vw - m) { left = r.right + pad + m; top = clampY(r.top); }
    else if (r.left - pad - m - cw >= m) { left = r.left - pad - m - cw; top = clampY(r.top); }
    else { left = vw - cw - m; top = vh - ch - m; }
    card.style.left = left + 'px'; card.style.top = top + 'px';
  }
  /* Bring the highlighted element into view (below the sticky nav, above the bottom sheet on phones). */
  function tourReveal(t) {
    if (!t || t.closest('.step-nav')) return;
    const r = t.getBoundingClientRect(), nav = navHeight(), vh = window.innerHeight, bottomGap = window.innerWidth < 640 ? 260 : 40;
    if (r.top >= nav + 8 && r.bottom <= vh - bottomGap) return;
    const y = window.scrollY + r.top - nav - 24;
    window.scrollTo({ top: Math.max(0, y), behavior: Lab.reducedMotion() ? 'auto' : 'smooth' });
  }
  function renderTourStep(prevFocus) {
    const d = tourList[tourIdx], n = tourList.length, t = d.find && d.find();
    $('.tour-count', tourEl).textContent = `Step ${tourIdx + 1} of ${n}`;
    $('.tour-title', tourEl).textContent = d.title;
    $('.tour-text', tourEl).textContent = t || !d.plain ? d.body : d.plain;
    const dots = $('.tour-dots', tourEl); dots.innerHTML = '';
    tourList.forEach((_, i) => dots.append(h('span', { class: 'tour-dot' + (i === tourIdx ? ' is-on' : '') })));
    const back = $('.tour-back', tourEl), next = $('.tour-next', tourEl);
    back.disabled = tourIdx === 0;
    next.textContent = tourIdx === n - 1 ? 'Done' : 'Next';
    if (prevFocus && prevFocus.disabled) next.focus();
    tourReveal(t);
    tourLayout();
    setTimeout(tourLayout, 60);
  }
  function startTour(o = {}) {
    if (!IS_LAB || tourEl || !document.body) return false;
    // Keep a step if its element is on screen or if it can be explained without one.
    tourList = tourDefs().filter(d => (d.find && d.find()) || d.plain || d.id === 'nav');
    if (!tourList.length) return false;
    tourOpener = o.opener || document.activeElement; tourIdx = 0;
    markTourSeen();
    tourEl = h('div', { class: 'tour', id: 'lab-tour' },
      h('div', { class: 'tour-scrim', 'aria-hidden': 'true' }),
      h('div', { class: 'tour-spot', 'aria-hidden': 'true' }),
      h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tour-title', 'aria-describedby': 'tour-text', tabindex: '-1' },
        h('div', { class: 'tour-top' }, h('span', { class: 'tour-count' }),
          h('button', { class: 'linkbtn tour-skip', type: 'button', onclick: closeTour }, 'Skip tour')),
        h('h2', { class: 'tour-title', id: 'tour-title' }),
        h('p', { class: 'tour-text', id: 'tour-text', 'aria-live': 'polite' }),
        h('div', { class: 'tour-foot' }, h('span', { class: 'tour-dots', 'aria-hidden': 'true' }),
          h('div', { class: 'tour-actions' },
            h('button', { class: 'btn btn--sm tour-back', type: 'button', onclick: e => { if (tourIdx > 0) { tourIdx--; renderTourStep(e.currentTarget); } } }, 'Back'),
            h('button', { class: 'btn btn--sm btn--primary tour-next', type: 'button', onclick: () => { if (tourIdx < tourList.length - 1) { tourIdx++; renderTourStep(); } else closeTour(); } }, 'Next')))));
    document.body.append(tourEl); document.body.classList.add('tour-open');
    document.addEventListener('keydown', tourKey, true);
    window.addEventListener('resize', tourLayoutSoon); window.addEventListener('scroll', tourLayoutSoon, true);
    renderTourStep();
    $('.tour-card', tourEl).focus({ preventScroll: true });
    return true;
  }
  function maybeAutoTour() {
    if (!IS_LAB || tourEl || tourSeen() || !storedIdentity() || isBusyMode() || !document.body) return;
    if (backupBar) removeBar();
    startTour({ auto: true });
  }
  Lab._tourSoon = function () { requestPersist(); setTimeout(maybeAutoTour, 700); };
  Lab.tour = {
    start: o => startTour(o || {}),
    close: closeTour,
    seen: tourSeen,
    reset() { memTourSeen = false; try { localStorage.removeItem('aplab:' + TOUR_KEY); } catch (e) { /* ignore */ } },
    get open() { return !!tourEl; },
  };

  /* Called from Lab.init (lab pages) and Lab.home (index). */
  function startOnboarding() {
    showFlash();
    if (!probeStorage()) storageFailed();
    if (storageBad) { Lab._storageWarn(); saveNote(false); }
    if (!IS_LAB) return;
    workListeners.push(() => { lastWork = Date.now(); setTimeout(checkBackup, QUIET_MS + 100); syncGuard(); });
    setInterval(() => { if (!document.hidden) checkBackup(); }, 2000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkBackup(); });
    setTimeout(() => { updateBackupStatus(); syncGuard(); }, 400);
    const go = () => setTimeout(maybeAutoTour, 900);
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
  }

  /* ---------------- Time estimates ----------------
     A part with data-minutes="15" gets a "≈ 15 min" chip beside its eyebrow in the header (read aloud as
     "About 15 minutes"); the lab header's tag row gets "≈ N min total". */
  const minutesText = n => n === 1 ? 'About 1 minute' : 'About ' + n + ' minutes';
  function addTimeChips() {
    let total = 0;
    $$('section.step[data-minutes]').forEach(sec => {
      const n = Math.round(parseFloat(sec.dataset.minutes)); if (!(n > 0)) return;
      total += n;
      const hd = $(':scope > header', sec); if (!hd || $('.time-chip', hd)) return;
      const chip = h('span', { class: 'time-chip' }, h('span', { 'aria-hidden': 'true' }, '≈ ' + n + ' min'), h('span', { class: 'sr-only' }, minutesText(n)));
      const eb = $('.eyebrow', hd);
      if (eb && eb.parentElement === hd) { const row = h('div', { class: 'eyebrow-row' }); eb.before(row); row.append(eb, chip); }
      else hd.prepend(chip);
    });
    const tags = $('.lab-header .tags');
    if (total && tags && !$('.tag--time', tags)) tags.append(h('span', { class: 'tag tag--time' }, h('span', { 'aria-hidden': 'true' }, '≈ ' + total + ' min total'), h('span', { class: 'sr-only' }, minutesText(total) + ' in total')));
  }

  /* ---------------- Init ---------------- */
  /* ---------------- "Rate my confidence" ----------------
     A one-tap, three-choice control at the end of every lab's Reflect or Evaluate part (found by data-step or slug, so lab pages
     need no markup): "I could teach this" (3) / "I mostly get it" (2) / "I'm lost" (1). It is saved (aplab:<lab>:confidence =
     {v, t}) and reported as Lab.keyResult('confidence', {label: 'Confidence', value: 1-3, unit: '(I could teach this)'}), so it is
     in the report, the progress file and the teacher dashboard (its own Confidence column and a per-lab count).
     It is not a prompt, quiz, table or step, so it never counts toward part completion or the backup reminder. */
  const CONFIDENCE = [{ v: 3, text: 'I could teach this' }, { v: 2, text: 'I mostly get it' }, { v: 1, text: 'I’m lost' }];
  Lab.confidence = { choices: CONFIDENCE, get: () => { const r = store.get('confidence'); return r && CONFIDENCE.some(c => c.v === r.v) ? r.v : null; } };
  function mountConfidence() {
    if (!IS_LAB) return;
    const sec = $$('section.step').find(x => /^(reflect|evaluate)$/i.test((x.dataset.step || '').trim())) || document.getElementById('reflect') || document.getElementById('evaluate');
    if (!sec) return;
    const body = $(':scope > .step-body', sec) || sec;
    let box = $('.confidence', sec);
    if (!box) {
      const name = 'conf-' + LAB_ID, say = h('p', { class: 'conf-say small muted', 'aria-live': 'polite' });
      box = h('fieldset', { class: 'confidence', id: 'confidence-box' },
        h('legend', null, 'Rate my confidence'),
        h('p', { class: 'small muted conf-help' }, 'One tap. This is for you and your teacher, not a grade. You can change it any time.'),
        h('div', { class: 'conf-opts' }, CONFIDENCE.map(c => h('label', { class: 'conf-opt', 'data-v': String(c.v) },
          h('input', { type: 'radio', name, value: String(c.v), id: `${name}-${c.v}` }),
          h('span', { class: 'conf-dots', 'aria-hidden': 'true' }, '●'.repeat(c.v) + '○'.repeat(3 - c.v)),
          h('span', { class: 'conf-text' }, c.text),
          h('span', { class: 'conf-tick', 'aria-hidden': 'true' }, '✓')))),
        say);
      box.addEventListener('change', e => {
        const inp = e.target.closest ? e.target.closest('input[type=radio]') : null; if (!inp) return;
        const v = +inp.value, c = CONFIDENCE.find(x => x.v === v); if (!c) return;
        store.set('confidence', { v, t: Date.now() });
        Lab.keyResult('confidence', { label: 'Confidence', value: v, unit: `(${c.text})`, part: sec.id });
        say.textContent = `Saved: ${c.text}.`;
        workChanged();
      });
      const saved = Lab.confidence.get();
      if (saved) { const inp = $(`input[value="${saved}"]`, box); if (inp) inp.checked = true; }
    }
    if (box.parentElement !== body || body.lastElementChild !== box) body.append(box); // last thing in the part, above the Back / Next links
  }
  Lab._mountConfidence = mountConfidence;

  Lab.init = function (o = {}) {
    LAB_ID = o.id || LAB_ID;
    if (IS_LAB) { mountLabIdentity(); addHeaderPrintButton(); addTimeChips(); mountConfidence(); window.addEventListener('load', () => setTimeout(mountConfidence, 0)); }
    buildNav();
    bindAutosave();
    $$('[data-responses]').forEach(el => Lab.responses(el));
    startOnboarding();
    handleResumeHash();
  };

  /* Animation loop helper that respects reduced motion & visibility.
     const loop = Lab.loop(dt => {...}); loop.start(); loop.stop();
     Lab.loop(fn, {tick: 1}) also plays the soft 'tick' sound every 1 s while it runs (only when the student turned sound on). */
  const LOOPS = new Set(); // running Lab.loop animations (the backup reminder never appears while one runs)
  Lab.loop = function (fn, opts = {}) {
    let raf = null, last = 0, lastTick = 0;
    const self = { start() { if (!raf) { last = 0; lastTick = 0; raf = requestAnimationFrame(tick); LOOPS.add(self); } }, stop() { if (raf) cancelAnimationFrame(raf); raf = null; LOOPS.delete(self); }, get running() { return !!raf; } };
    const tick = t => { const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t; if (opts.tick > 0) { if (!lastTick) lastTick = t; if (t - lastTick >= opts.tick * 1000) { lastTick = t; Lab.sound.play('tick'); } } if (fn(dt) === false) { raf = null; LOOPS.delete(self); return; } raf = requestAnimationFrame(tick); };
    return self;
  };
  Lab.reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Canvas helper: crisp canvas sized to CSS width. Returns {ctx, w, h, resize(), check()}
     Lab.canvas(el, aspect, {fit: true | '<CSS length>'}) also caps the drawn height by the viewport
     (see Lab.fitHeight): the canvas is drawn smaller, never cropped. */
  Lab.canvas = function (canvas, aspect = 0.56, opts = {}) {
    if (typeof canvas === 'string') canvas = $(canvas);
    if (opts && opts.fit) Lab.fitHeight(canvas, aspect, opts.fit === true ? null : opts.fit);
    const ctx = canvas.getContext('2d');
    const o = { canvas, ctx, w: 0, h: 0 };
    o.resize = () => {
      const w = Math.max(200, canvas.clientWidth || canvas.parentElement.clientWidth || hiddenWidth(canvas)); const hh = Math.round(w * aspect);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); canvas.style.height = hh + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); o.w = w; o.h = hh;
    };
    /* Resize + redraw now if the CSS width changed (used when a hidden part is shown). */
    o.check = () => { const pw = canvas.clientWidth; if (pw && Math.abs(pw - o.w) > 1) { o.resize(); if (o.onresize) o.onresize(); return true; } return false; };
    o.resize();
    // A hidden part reports width 0: skip it and size the canvas when it is shown again.
    if ('ResizeObserver' in window) new ResizeObserver(() => { o.check(); }).observe(canvas);
    CANVASES.push(o);
    return o;
  };
  /* Cap an element's displayed height by the viewport while keeping its aspect (height ÷ width):
     its max-width becomes (viewport height − reserve) ÷ aspect, and it is centered. Works for any
     canvas whose drawing size follows its CSS width (Lab.canvas, Scope.view, Scope.still):
     call it before creating the view. reserve defaults to var(--fit-reserve) (set by .sim--fit). */
  /* A canvas created inside a hidden part has no width yet: draw it at a plausible size (the nearest
     visible ancestor's width) until the part is shown and the real size is known. */
  function hiddenWidth(el) {
    let a = el.parentElement;
    while (a && !a.clientWidth) a = a.parentElement;
    return a ? Math.round(Math.min(900, a.clientWidth * (a.clientWidth > 900 ? 0.65 : 0.9))) : 640;
  }
  Lab.fitHeight = function (el, aspect, reserve) {
    if (typeof el === 'string') el = $(el);
    if (!el) return null;
    const r = reserve || 'var(--fit-reserve, 300px)';
    el.classList.add('fit-h');
    el.style.maxWidth = `max(280px, calc((100vh - ${r}) / ${aspect}))`;
    el.style.maxWidth = `max(280px, calc((100svh - ${r}) / ${aspect}))`; // ignored where svh is unsupported
    return el;
  };
  /* Read a CSS color token for canvas drawing: Lab.color('--accent') (call at draw time so theme changes apply) */
  Lab.color = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';

  /* ---------------- Theme switch: Light / Dark / Auto ----------------
     The choice lives in localStorage 'aplab:pref:theme' ('light' | 'dark'; absent = Auto, follow the computer). It is a
     preference, not personal data, so Sign out and Start over keep it. Every page's <head> sets data-theme from it before first paint:
     <script>try{var t=localStorage.getItem('aplab:pref:theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
     Lab.theme.get() gives 'light'|'dark'|'auto'; Lab.theme.set(mode); window event 'aplab:theme' fires after a change (token-driven canvases redraw). */
  const THEME_KEY = 'aplab:pref:theme';
  let memTheme = 'auto';
  const themeGet = () => { try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : 'auto'; } catch (e) { return memTheme; } };
  function themeApply() {
    const m = themeGet(), root = document.documentElement;
    if (m === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', m);
    $$('.theme-switch').forEach(sw => $$('button', sw).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m))));
    themeRedraw();
  }
  function themeRedraw() {
    quietBadges(900);
    window.dispatchEvent(new Event('aplab:theme'));
    CANVASES.forEach(c => { try { if (c.onresize) c.onresize(); } catch (e) { /* ignore */ } });
    REG.charts.forEach(c => { try { c.render(); } catch (e) { /* ignore */ } });
    $$('canvas').forEach(cv => { if (cv.scopeView) { try { cv.scopeView.redraw(); } catch (e) { /* ignore */ } } });
  }
  function themeSet(m) {
    memTheme = m;
    try { if (m === 'light' || m === 'dark') localStorage.setItem(THEME_KEY, m); else localStorage.removeItem(THEME_KEY); } catch (e) { /* blocked: this page only */ }
    themeApply();
  }
  Lab.theme = { get: themeGet, set: themeSet };
  function mountThemeSwitch() {
    if (!document.body || $('.theme-switch')) return;
    const mk = (mode, label, title) => h('button', { type: 'button', class: 'theme-opt', 'data-mode': mode, 'aria-pressed': 'false', title, onclick: () => themeSet(mode) }, label);
    const sw = h('div', { class: 'theme-switch', role: 'group', 'aria-label': 'Color theme' },
      mk('light', 'Light', 'Light theme'), mk('dark', 'Dark', 'Dark theme'), mk('auto', 'Auto', 'Auto: match my computer'));
    const crumbs = $('.crumbs'), links = $('.hero-links');
    const printBtn = crumbs && $('.ws-print-btn', crumbs);
    if (crumbs) { if (printBtn) printBtn.before(sw); else crumbs.append(sw); }
    else if (links) { sw.classList.add('theme-switch--inline'); links.append(' · ', sw); }
    else { const bar = h('div', { class: 'theme-bar wrap gutter' }, sw); (document.querySelector('main') || document.body).prepend(bar); }
    mountSoundToggle(sw);
    themeApply();
  }
  window.addEventListener('storage', e => { if (e.key === THEME_KEY) themeApply(); });
  try { const mq = window.matchMedia('(prefers-color-scheme: dark)'); const f = () => { if (themeGet() === 'auto') themeRedraw(); }; if (mq.addEventListener) mq.addEventListener('change', f); } catch (e) { /* old browser */ }
  /* ---------------- Sound (off by default) ----------------
     Lab.sound.play(name) with name one of click | hiss | beep | pop | chime | buzz | tick. Every sound is synthesized in
     Web Audio (no audio files), soft (master gain 0.126 = −18 dB) and under a second. Nothing plays unless the student turned
     sound on with the speaker button beside the theme switch (localStorage 'aplab:pref:sound' = 'on'; a preference, so Sign out and
     Start over keep it), and the AudioContext is only created after a real user gesture. Reduced motion does not change this:
     sound stays allowed, but only when the toggle is on.
       Lab.sound.play('beep')   → true if a sound started, false if sound is off / no gesture yet / unsupported
       Lab.sound.enabled        → boolean            Lab.sound.set(true|false)    Lab.sound.toggle()
       Lab.sound.names          → the sound set      Lab.sound.render(name) → Promise<{peak, rms, seconds}> (offline, for tests) */
  const SOUND_KEY = 'aplab:pref:sound';
  const MASTER_GAIN = 0.126; // −18 dB
  let memSound = false, audioCtx = null, audioOut = null, gestured = false;
  const soundGet = () => { try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch (e) { return memSound; } };
  ['pointerdown', 'keydown', 'touchend', 'click'].forEach(ev => document.addEventListener(ev, e => { if (e.isTrusted) gestured = true; }, { capture: true, passive: true }));
  const hasGesture = () => gestured || !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
  function noiseBuffer(ac) { // fixed pseudo-random noise (never touches Math.random: that stream is the student's seeded data)
    const n = Math.ceil(ac.sampleRate * 1.0), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    let s = 22695477;
    for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; }
    return b;
  }
  /* Each voice: (ac, out, t0, nb) schedules its nodes on `out` starting at t0 and returns its length in seconds. */
  function env(ac, out, t0, peak, atk, dec) { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + atk); g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + dec); g.connect(out); return g; }
  function tone(ac, out, t0, type, f0, f1, dur) { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); o.connect(out); o.start(t0); o.stop(t0 + dur + 0.05); return o; }
  function noise(ac, out, t0, nb, kind, f, q, dur) { const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; const bq = ac.createBiquadFilter(); bq.type = kind; bq.frequency.value = f; bq.Q.value = q; s.connect(bq); bq.connect(out); s.start(t0); s.stop(t0 + dur + 0.05); return bq; }
  const VOICES = {
    click(ac, out, t, nb) { noise(ac, env(ac, out, t, 0.8, 0.002, 0.03), t, nb, 'bandpass', 2400, 3, 0.04); tone(ac, env(ac, out, t, 0.3, 0.002, 0.045), t, 'sine', 1300, 700, 0.05); return 0.1; },
    hiss(ac, out, t, nb) { const g = env(ac, out, t, 0.45, 0.12, 0.5); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; lp.connect(g); noise(ac, lp, t, nb, 'highpass', 1800, 0.7, 0.7); return 0.75; },
    beep(ac, out, t) { tone(ac, env(ac, out, t, 0.6, 0.012, 0.2), t, 'sine', 880, 0, 0.22); tone(ac, env(ac, out, t, 0.08, 0.012, 0.15), t, 'sine', 1760, 0, 0.17); return 0.26; },
    pop(ac, out, t, nb) { tone(ac, env(ac, out, t, 0.85, 0.003, 0.09), t, 'sine', 560, 150, 0.1); noise(ac, env(ac, out, t, 0.25, 0.001, 0.015), t, nb, 'bandpass', 1800, 1, 0.02); return 0.14; },
    chime(ac, out, t) { [[784, 0, 0.5], [1046.5, 0.09, 0.45], [1568, 0.09, 0.15]].forEach(([f, d, p]) => tone(ac, env(ac, out, t + d, p, 0.008, 0.55), t + d, 'sine', f, 0, 0.6)); return 0.8; },
    buzz(ac, out, t) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.connect(env(ac, out, t, 0.4, 0.04, 0.3)); tone(ac, lp, t, 'sawtooth', 110, 0, 0.34); tone(ac, lp, t, 'square', 55, 0, 0.34); return 0.4; },
    tick(ac, out, t, nb) { tone(ac, env(ac, out, t, 0.5, 0.001, 0.02), t, 'sine', 1900, 1700, 0.025); noise(ac, env(ac, out, t, 0.4, 0.001, 0.012), t, nb, 'bandpass', 3600, 2, 0.015); return 0.06; },
  };
  const SOUND_NAMES = Object.keys(VOICES);
  function audioStart() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try {
      audioCtx = new AC({ latencyHint: 'interactive' });
      const comp = audioCtx.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 6;
      audioOut = audioCtx.createGain(); audioOut.gain.value = MASTER_GAIN; audioOut.connect(comp); comp.connect(audioCtx.destination);
      audioCtx._nb = noiseBuffer(audioCtx);
    } catch (e) { audioCtx = null; }
    return audioCtx;
  }
  const lastPlayed = {};
  function soundPlay(name) {
    if (!soundGet() || !VOICES[name] || !hasGesture()) return false;
    const now = Date.now(); if (now - (lastPlayed[name] || 0) < 35) return false; lastPlayed[name] = now;
    const ac = audioStart(); if (!ac) return false;
    try {
      if (ac.state === 'suspended') ac.resume();
      VOICES[name](ac, audioOut, ac.currentTime + 0.005, ac._nb);
      return true;
    } catch (e) { return false; }
  }
  async function soundRender(name) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC || !VOICES[name]) return null;
    const rate = 22050, ac = new OAC(1, rate * 1.2, rate), out = ac.createGain(); out.gain.value = MASTER_GAIN; out.connect(ac.destination);
    const len = VOICES[name](ac, out, 0.005, noiseBuffer(ac));
    const buf = await ac.startRendering(), d = buf.getChannelData(0);
    let peak = 0, sum = 0, last = 0;
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; if (a > 0.002) last = i; }
    return { peak, rms: Math.sqrt(sum / d.length), seconds: last / rate, length: len };
  }
  function soundSet(on) {
    on = !!on; memSound = on;
    try { if (on) localStorage.setItem(SOUND_KEY, 'on'); else localStorage.removeItem(SOUND_KEY); } catch (e) { /* blocked: this page only */ }
    soundSync();
    if (on) soundPlay('click');
    window.dispatchEvent(new Event('aplab:sound'));
  }
  Lab.sound = { play: soundPlay, get enabled() { return soundGet(); }, set: soundSet, toggle: () => soundSet(!soundGet()), names: SOUND_NAMES, render: soundRender, key: SOUND_KEY, masterGain: MASTER_GAIN };
  const SPEAKER_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" focusable="false" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><g class="sx-on" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.5a8 8 0 0 1 0 11"/></g><path class="sx-off" d="M15.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function soundSync() {
    const on = soundGet();
    $$('.sound-toggle').forEach(b => { b.setAttribute('aria-pressed', String(on)); b.title = on ? 'Sound effects: on (click to turn off)' : 'Sound effects: off (click to turn on)'; });
  }
  function mountSoundToggle(after) {
    if (!IS_LAB || $('.sound-toggle')) return;
    const b = h('button', { type: 'button', class: 'sound-toggle', 'aria-label': 'Sound effects', 'aria-pressed': 'false', html: SPEAKER_SVG, onclick: () => Lab.sound.toggle() });
    after.after(b); soundSync();
  }
  window.addEventListener('storage', e => { if (e.key === SOUND_KEY) soundSync(); });

  /* ---------------- Celebrations (used sparingly) ----------------
     1. A part becoming complete: a quiet check-sweep on its nav item and on the progress ring, and the "chime" if sound is on.
        Only for completions a student causes (not when saved work is restored on load).
     2. The lab: ONE confetti burst per lab, only when the student downloads or saves their report (.docx or PDF) after every
        required part is complete. aplab:<lab>:celebrated remembers it. Confetti happens nowhere else.
     With reduced motion both are replaced by a calm static "Lab complete ✓" badge next to the report buttons.
       Lab.celebrate.lab({force})  → true if it fired now (lab.js calls it after a report download; a page rarely needs to)
       Lab.celebrate.complete()    → every required part is done       Lab.celebrate.done() → it already fired for this lab
       window event 'aplab:celebrate' {detail:{lab, kind:'confetti'|'badge'}} fires when it does. */
  const CEL = { prev: null, acted: false, t0: Date.now(), complete: false };
  ['pointerdown', 'keydown', 'input', 'change', 'click'].forEach(ev => document.addEventListener(ev, () => { CEL.acted = true; }, { capture: true, passive: true }));
  let labBadgeEl = null, navRingEl = null, ringTimer = null;
  const RING_C = 2 * Math.PI * 15;
  function makeNavRing() {
    navRingEl = h('span', { class: 'nav-ring', 'aria-hidden': 'true', hidden: true, html: `<svg viewBox="0 0 36 36" focusable="false"><circle class="nr-bg" cx="18" cy="18" r="15"/><circle class="nr-fg" cx="18" cy="18" r="15" stroke-dasharray="0 ${RING_C.toFixed(2)}" transform="rotate(-90 18 18)"/><path class="nr-check" d="M11 18.5l5 5 9.5-11"/></svg>` });
    return navRingEl;
  }
  function updateRing(done, total) {
    if (!navRingEl) return;
    navRingEl.hidden = !total;
    const fg = $('.nr-fg', navRingEl); if (fg) fg.setAttribute('stroke-dasharray', `${(total ? RING_C * done / total : 0).toFixed(2)} ${RING_C.toFixed(2)}`);
    navRingEl.classList.toggle('is-full', !!total && done === total);
  }
  function celebratePart(ids) {
    if (Date.now() - CEL.t0 < 1800 || !CEL.acted) return;
    if (!Lab.reducedMotion()) {
      ids.forEach(id => { const a = $$('.step-nav a').find(x => x.getAttribute('href') === '#' + id); if (a) a.classList.add('just-done'); });
      if (navRingEl) navRingEl.classList.add('just-done');
      clearTimeout(ringTimer);
      ringTimer = setTimeout(() => { $$('.just-done').forEach(n => n.classList.remove('just-done')); }, 1400);
    }
    Lab.sound.play('chime');
  }
  function celebrateCheck(ids, complete, parts) {
    const prev = CEL.prev; CEL.prev = ids; CEL.complete = parts > 0 && complete === parts;
    updateRing(complete, parts);
    if (prev) { const fresh = Array.from(ids).filter(id => !prev.has(id)); if (fresh.length) celebratePart(fresh); }
    syncLabBadge();
  }
  const celebrated = () => !!store.get('celebrated');
  function makeLabBadge() { labBadgeEl = h('p', { class: 'lab-complete', role: 'status', hidden: true }, 'Lab complete ✓'); return labBadgeEl; }
  function syncLabBadge() { if (labBadgeEl) labBadgeEl.hidden = !(Lab.reducedMotion() && CEL.complete && celebrated()); }
  /* A light confetti canvas of our own: 110 paper rectangles, 2.4 s, then removed. The canvas ignores the pointer and never prints. */
  function confetti() {
    const cv = h('canvas', { class: 'confetti-canvas', 'aria-hidden': 'true' });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5), W = window.innerWidth, H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    document.body.append(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const cols = ['--s1', '--s2', '--s3', '--s4', '--s6', '--accent', '--stain'].map(Lab.color);
    let s = 12345; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; // not Math.random: keep the student's data stream untouched
    const ps = [];
    for (let i = 0; i < 110; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 1.9, v = 380 + r() * 520; ps.push({ x: W / 2 + (r() - 0.5) * W * 0.3, y: H * 0.72, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + r() * 6, h: 3 + r() * 4, rot: r() * 6.3, vr: (r() - 0.5) * 12, c: cols[i % cols.length], ph: r() * 6.3 }); }
    const T = 2400; let t0 = 0, last = 0;
    const step = t => {
      if (!cv.isConnected) return;
      if (!t0) { t0 = t; last = t; }
      const dt = Math.min(0.05, (t - last) / 1000); last = t; const el = t - t0;
      ctx.clearRect(0, 0, W, H);
      const fade = el > T - 600 ? Math.max(0, (T - el) / 600) : 1;
      ps.forEach(p => { p.vy += 900 * dt; p.vx *= 1 - 1.3 * dt; p.vy *= 1 - 0.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.rot * 1.7 + p.ph)); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); });
      if (el < T) requestAnimationFrame(step); else cv.remove();
    };
    requestAnimationFrame(step);
    setTimeout(() => cv.remove(), T + 800);
    return cv;
  }
  function celebrateLab(o = {}) {
    if (!IS_LAB) return false;
    try { updateProgress(); } catch (e) { /* ignore */ }
    if (!CEL.complete && !o.force) return false;
    if (celebrated()) { syncLabBadge(); return false; }
    store.set('celebrated', { t: Date.now() });
    const calm = Lab.reducedMotion();
    if (calm) syncLabBadge(); else confetti();
    window.dispatchEvent(new CustomEvent('aplab:celebrate', { detail: { lab: LAB_ID, kind: calm ? 'badge' : 'confetti' } }));
    return true;
  }
  Lab.celebrate = { lab: celebrateLab, complete: () => CEL.complete, done: celebrated, confetti };

  /* ---------------- GIF encoder (no library) ----------------
     Lab.gif.encode(frames, {delay, delays, loop, onprogress}) → Promise<Uint8Array>   a GIF89a, looping forever by default.
       frames: [{data: Uint8ClampedArray RGBA, width, height}] (ImageData works), all the same size; delay in 1/100 s (default 8).
     Lab.gif.Encoder(width, height, {loop}) is the streaming form the timelapse uses (never holds every frame at once):
       const enc = new Lab.gif.Encoder(360, 240);  enc.setPalette([rgba1, rgba2, …]);  enc.addFrame(rgba, delayCs);  const bytes = enc.finish();
     One global 255-colour palette from median cut over a sample of the frames (index 255 is "unchanged"), nearest-colour mapping through a
     5-bit-per-channel lookup, then only the changed rectangle of each frame is stored (transparent where unchanged), LZW-compressed. */
  const GIF = (function () {
    const TRANS = 255;
    let tab = null, stamp = null, gen = 0;
    function lzw(idx) { // → Uint8Array of the LZW data (min code size 8, 12-bit codes, clear when the table fills)
      const n = idx.length;
      if (!tab) { tab = new Int32Array(1 << 20); stamp = new Uint32Array(1 << 20); }
      gen++;
      const out = new Uint8Array(Math.ceil(n * 1.6) + 64); let p = 0, cur = 0, shift = 0, size = 9, next = 258;
      const emit = c => { cur |= c << shift; shift += size; while (shift >= 8) { out[p++] = cur & 255; cur >>>= 8; shift -= 8; } };
      emit(256);
      let ib = idx[0];
      for (let i = 1; i < n; i++) {
        const k = idx[i], key = (ib << 8) | k;
        if (stamp[key] === gen) { ib = tab[key]; continue; }
        emit(ib);
        if (next === 4096) { emit(256); next = 258; size = 9; gen++; }
        else { if (next >= (1 << size)) size++; tab[key] = next++; stamp[key] = gen; }
        ib = k;
      }
      emit(ib); emit(257);
      if (shift > 0) out[p++] = cur & 255;
      return out.subarray(0, p);
    }
    /* Median cut over a 15-bit histogram of the sampled pixels. Returns {pal: Uint8Array(768), lut: Int16Array(32768)}. */
    function buildPalette(samples) {
      const hist = new Uint32Array(32768);
      samples.forEach(d => { const step = Math.max(1, Math.floor(d.length / 4 / 40000)) * 4; for (let i = 0; i < d.length; i += step) { if (d[i + 3] < 128) continue; hist[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)]++; } });
      const all = []; let total = 0;
      for (let i = 0; i < 32768; i++) if (hist[i]) { all.push(i); total += hist[i]; }
      const ch = (k, a) => a === 0 ? k >> 10 : a === 1 ? (k >> 5) & 31 : k & 31;
      const stat = cols => { let n = 0; const lo = [31, 31, 31], hi = [0, 0, 0]; cols.forEach(k => { n += hist[k]; for (let a = 0; a < 3; a++) { const v = ch(k, a); if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; } }); let ax = 0, best = -1; for (let a = 0; a < 3; a++) if (hi[a] - lo[a] > best) { best = hi[a] - lo[a]; ax = a; } return { cols, n, ax, range: best }; };
      const boxes = all.length ? [stat(all)] : [];
      while (boxes.length < 255) {
        let bi = -1, bs = 0;
        boxes.forEach((b, i) => { if (b.cols.length > 1) { const s = b.range * Math.sqrt(b.n); if (s > bs) { bs = s; bi = i; } } });
        if (bi < 0) break;
        const b = boxes[bi]; b.cols.sort((x, y) => ch(x, b.ax) - ch(y, b.ax));
        let acc = 0, cut = 1; for (let i = 0; i < b.cols.length - 1; i++) { acc += hist[b.cols[i]]; cut = i + 1; if (acc * 2 >= b.n) break; }
        boxes.splice(bi, 1, stat(b.cols.slice(0, cut)), stat(b.cols.slice(cut)));
      }
      const pal = new Uint8Array(768), lut = new Int16Array(32768).fill(-1);
      boxes.forEach((b, i) => { let r = 0, g = 0, bl = 0; b.cols.forEach(k => { const w = hist[k]; r += (k >> 10) * w; g += ((k >> 5) & 31) * w; bl += (k & 31) * w; lut[k] = i; }); pal[i * 3] = Math.min(255, Math.round(r / b.n * 8 + 4)); pal[i * 3 + 1] = Math.min(255, Math.round(g / b.n * 8 + 4)); pal[i * 3 + 2] = Math.min(255, Math.round(bl / b.n * 8 + 4)); });
      return { pal, lut, used: boxes.length, total };
    }
    function Encoder(w, h, o = {}) { this.w = w; this.h = h; this.loop = o.loop || 0; this.chunks = []; this.palette = null; this.prev = null; this.pending = null; this.frames = 0; }
    Encoder.prototype.setPalette = function (samples) {
      this.palette = buildPalette(samples);
      const c = [71, 73, 70, 56, 57, 97, this.w & 255, this.w >> 8, this.h & 255, this.h >> 8, 0xF7, 0, 0];
      this.chunks.push(Uint8Array.from(c), this.palette.pal);
      this.chunks.push(Uint8Array.from([0x21, 0xFF, 0x0B, 78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48, 0x03, 0x01, this.loop & 255, this.loop >> 8, 0]));
    };
    Encoder.prototype.map = function (rgba) {
      const { pal, lut } = this.palette, n = this.w * this.h, idx = new Uint8Array(n);
      for (let i = 0, j = 0; i < n; i++, j += 4) {
        const r = rgba[j], g = rgba[j + 1], b = rgba[j + 2], key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        let v = lut[key];
        if (v < 0) { let best = 1e9; v = 0; for (let c = 0; c < this.palette.used; c++) { const dr = pal[c * 3] - r, dg = pal[c * 3 + 1] - g, db = pal[c * 3 + 2] - b, d = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (d < best) { best = d; v = c; } } lut[key] = v; }
        idx[i] = v;
      }
      return idx;
    };
    Encoder.prototype.flush = function () {
      const f = this.pending; if (!f) return; this.pending = null;
      const d = Math.max(2, Math.round(f.delay));
      this.chunks.push(Uint8Array.from([0x21, 0xF9, 0x04, f.trans ? 0x05 : 0x04, d & 255, d >> 8, f.trans ? TRANS : 0, 0]));
      this.chunks.push(Uint8Array.from([0x2C, f.x & 255, f.x >> 8, f.y & 255, f.y >> 8, f.w & 255, f.w >> 8, f.h & 255, f.h >> 8, 0, 8]));
      const data = lzw(f.idx), blocks = [];
      for (let i = 0; i < data.length; i += 255) { const part = data.subarray(i, Math.min(data.length, i + 255)); const b = new Uint8Array(part.length + 1); b[0] = part.length; b.set(part, 1); blocks.push(b); }
      blocks.push(Uint8Array.from([0]));
      this.chunks.push(...blocks); this.frames++;
    };
    Encoder.prototype.addFrame = function (rgba, delay = 8) {
      if (!this.palette) this.setPalette([rgba]);
      const idx = this.map(rgba), w = this.w, h = this.h, prev = this.prev;
      this.prev = idx;
      if (!prev) { this.pending = { x: 0, y: 0, w, h, idx, delay, trans: false }; return; }
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0, i = y * w; x < w; x++, i++) if (idx[i] !== prev[i]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) { if (this.pending) this.pending.delay += delay; return; }  // identical: just hold the previous frame longer
      this.flush();
      const rw = x1 - x0 + 1, rh = y1 - y0 + 1, sub = new Uint8Array(rw * rh);
      for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) { const i = (y0 + y) * w + x0 + x; sub[y * rw + x] = idx[i] === prev[i] ? TRANS : idx[i]; }
      this.pending = { x: x0, y: y0, w: rw, h: rh, idx: sub, delay, trans: true };
    };
    Encoder.prototype.finish = function () {
      this.flush(); this.chunks.push(Uint8Array.from([0x3B]));
      let n = 0; this.chunks.forEach(c => { n += c.length; });
      const out = new Uint8Array(n); let p = 0; this.chunks.forEach(c => { out.set(c, p); p += c.length; });
      this.chunks = []; return out;
    };
    const tick = () => new Promise(r => setTimeout(r, 0));
    async function encode(frames, o = {}) {
      if (!frames.length) throw new Error('no frames');
      const w = frames[0].width, h = frames[0].height, enc = new Encoder(w, h, { loop: o.loop });
      const pick = []; const k = Math.max(1, Math.ceil(frames.length / 10)); for (let i = 0; i < frames.length; i += k) pick.push(frames[i].data);
      enc.setPalette(pick);
      for (let i = 0; i < frames.length; i++) { enc.addFrame(frames[i].data, o.delays ? o.delays[i] : (o.delay || 8)); if (o.onprogress) o.onprogress((i + 1) / frames.length); if (i % 4 === 3) await tick(); }
      return enc.finish();
    }
    return { encode, Encoder, buildPalette, lzw };
  })();
  Lab.gif = GIF;

  /* ---------------- Timelapse: record a run, replay it fast, save it as a GIF ----------------
     const rec = Lab.timelapse(canvasOrScopeView, { fps: 4, maxFrames: 240, width: 360, label: 'Gel run', key: 'gel' });
     rec.start();  …the run animates…  rec.stop();           // frames are copied from the canvas, downscaled to `width`
     rec.mount('#gel-timelapse');                            // "Replay my run" + "Download timelapse (GIF)" buttons and a status line
     rec.replay({ speed: 15 });  rec.gif({ speed: 15 }) → Promise<Blob>;  rec.downloadGif();  rec.clear();  rec.count;  rec.fps;
     rec.onchange = () => …  (fires after start, each batch of frames, stop, clear and a restore from the previous visit)
     Frames are small JPEGs kept in memory and in IndexedDB (database aplab-timelapse, capped by maxBytes, every call in try/catch),
     so a replay survives a reload; a marker aplab:<lab>:tl:<key> is what makes the stored run "this student's", so Sign out and Start over
     erase it. At maxFrames (or maxBytes) every second frame is dropped and capture slows to match: a long run still covers its whole length.
     fps is the capture rate; a replay at 15× shows fps × 15 frames per second. A GIF drops frames when that would be faster than browsers
     show GIFs (they treat delays under 2/100 s as 10/100 s). The .docx can carry the GIF ("Include my timelapse in the report"). */
  const TLS = [];            // every recorder on this page
  const TL_DB = 'aplab-timelapse';
  const tlOpen = () => new Promise((res, rej) => { try { const r = indexedDB.open(TL_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('runs', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked')); } catch (e) { rej(e); } });
  const tlTx = (mode, fn) => tlOpen().then(db => new Promise((res, rej) => { let out; const tx = db.transaction('runs', mode); try { out = fn(tx.objectStore('runs')); } catch (e) { db.close(); rej(e); return; } tx.oncomplete = () => { db.close(); res(out && out.result !== undefined ? out.result : out); }; tx.onerror = tx.onabort = () => { db.close(); rej(tx.error); }; }));
  const tlPut = rec => tlTx('readwrite', s => s.put(rec));
  const tlGet = id => tlTx('readonly', s => s.get(id));
  const tlDel = id => tlTx('readwrite', s => s.delete(id));
  const tlDelLab = lab => tlTx('readwrite', s => { s.openCursor().onsuccess = e => { const c = e.target.result; if (c) { if (String(c.key).startsWith(lab + ':')) c.delete(); c.continue(); } }; });
  function tlEraseAll() { try { TLS.forEach(r => r._detach && r._detach()); const q = indexedDB.deleteDatabase(TL_DB); q.onerror = q.onblocked = () => {}; } catch (e) { /* no IndexedDB */ } }
  function tlEraseLab(lab) { try { tlDelLab(lab).catch(() => {}); } catch (e) { /* ignore */ } }
  const tlMark = (k, v) => { const name = `aplab:${LAB_ID}:tl:${k}`; try { if (v === undefined) { const r = localStorage.getItem(name); return r ? JSON.parse(r) : null; } if (wiped) return null; if (v === null) localStorage.removeItem(name); else localStorage.setItem(name, JSON.stringify(v)); } catch (e) { /* blocked */ } return null; };
  const tlYield = () => new Promise(r => setTimeout(r, 0));
  const tlPlain = html => { const d = document.createElement('div'); d.innerHTML = html; return (d.textContent || '').trim(); };
  function tlSource(t) { if (typeof t === 'function') t = t(); if (typeof t === 'string') t = $(t); if (t && t.canvas && t.canvas.getContext) t = t.canvas; return t && t.getContext ? t : null; }
  async function tlBitmap(blob) { if (window.createImageBitmap) { try { return await createImageBitmap(blob); } catch (e) { /* fall back */ } } return new Promise((res, rej) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('decode')); }; im.src = u; }); }
  Lab.timelapse = function (target, o = {}) {
    const opts = Object.assign({ fps: 4, maxFrames: 240, width: 360, label: 'My run', quality: 0.85, maxBytes: 6e6 }, o);
    const srcEl0 = typeof target === 'string' ? $(target) : target;
    const key = String(opts.key || (srcEl0 && (srcEl0.id || (srcEl0.canvas && srcEl0.canvas.id))) || slugify(opts.label) || 'run');
    const id = LAB_ID + ':' + key;
    let frames = [], stride = 1, ticks = 0, pending = 0, timer = 0, recording = false, bytes = 0, W = 0, H = 0, fps = opts.fps, saveT = 0, ui = [];
    const cap = document.createElement('canvas'), cctx = cap.getContext('2d');
    const rec = { id, key, label: opts.label, onchange: null, persisted: false };
    const changed = () => { ui.forEach(f => f()); try { if (rec.onchange) rec.onchange(rec); } catch (e) { console.warn(e); } window.dispatchEvent(new CustomEvent('aplab:timelapse', { detail: { id, count: frames.length } })); };
    const decimate = () => { if (pending) return; frames = frames.filter((_, i) => i % 2 === 0); stride *= 2; fps = opts.fps / stride; bytes = frames.reduce((a, b) => a + b.size, 0); };
    function grab() {
      const src = tlSource(target); if (!src || !src.width || !src.height) return;
      const w = Math.min(opts.width, src.width), h = Math.max(2, Math.round(w * src.height / src.width));
      W = w; H = h; if (cap.width !== w || cap.height !== h) { cap.width = w; cap.height = h; }
      cctx.fillStyle = Lab.color('--surface'); cctx.fillRect(0, 0, w, h);
      cctx.imageSmoothingQuality = 'medium'; cctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, w, h);
      const slot = frames.length; frames.push(null); pending++;
      cap.toBlob(b => { pending--; if (b) { frames[slot] = b; bytes += b.size; } else frames[slot] = undefined; if (!pending) { frames = frames.filter(Boolean); } }, 'image/jpeg', opts.quality);
    }
    function step() {
      if (document.hidden || pending > 3) return;
      if (ticks++ % stride) return;
      if (frames.length >= opts.maxFrames || bytes > opts.maxBytes) decimate();
      if (frames.length >= opts.maxFrames) return;
      grab(); if (ticks % 4 === 1) changed();
    }
    const settle = async () => { for (let i = 0; i < 100 && pending; i++) await tlYield(); frames = frames.filter(Boolean); };
    async function persist() {
      const meta = { n: frames.length, fps, w: W, h: H, label: opts.label, t: Date.now() };
      tlMark(key, meta);
      try { await tlPut({ id, lab: LAB_ID, key, label: opts.label, fps, w: W, h: H, t: meta.t, frames: frames.slice() }); rec.persisted = true; } catch (e) { rec.persisted = false; }
      changed();
    }
    rec.start = function () {
      if (recording) return rec; frames = []; stride = 1; ticks = 0; bytes = 0; fps = opts.fps; recording = true;
      grab(); changed();
      timer = setInterval(step, 1000 / opts.fps); return rec;
    };
    rec.stop = async function () {
      if (!recording) return rec; recording = false; clearInterval(timer);
      grab(); await settle(); if (frames.length > opts.maxFrames) frames = frames.filter((_, i) => i % 2 === 0);
      await persist(); return rec;
    };
    rec.capture = function () { grab(); return rec; };
    rec.clear = async function () { recording = false; clearInterval(timer); frames = []; bytes = 0; tlMark(key, null); try { await tlDel(id); } catch (e) { /* ignore */ } changed(); return rec; };
    rec._detach = () => { recording = false; clearInterval(timer); frames = []; ui = []; };
    Object.defineProperties(rec, { count: { get: () => frames.filter(Boolean).length }, fps: { get: () => fps }, recording: { get: () => recording }, width: { get: () => W }, height: { get: () => H }, bytes: { get: () => bytes }, frames: { get: () => frames.filter(Boolean) } });
    rec.restored = (async () => {
      const m = tlMark(key);
      if (!m || !m.n) { try { await tlDel(id); } catch (e) { /* ignore */ } return false; }   // no marker: an erased student's leftovers
      try {
        const r = await tlGet(id);
        if (r && r.frames && r.frames.length && !recording && !frames.length) { frames = r.frames; fps = r.fps || opts.fps; W = r.w; H = r.h; bytes = frames.reduce((a, b) => a + b.size, 0); stride = Math.max(1, Math.round(opts.fps / fps)); rec.persisted = true; changed(); return true; }
      } catch (e) { /* no IndexedDB: this visit only */ }
      return false;
    })();

    /* --- Replay modal --- */
    let modal = null;
    rec.replay = async function (ro = {}) {
      await rec.restored; if (rec.count < 2 || modal) return null;
      const list = rec.frames, n = list.length; let speed = ro.speed || 15, pos = 0, playing = false, raf = 0, last = 0, shown = -1;
      const cache = new Map(), inflight = new Set(); let gone = false;
      const cv = h('canvas', { class: 'tl-canvas', width: W, height: H, 'aria-label': `${opts.label}: replay of your run` });
      const c2 = cv.getContext('2d');
      const play = h('button', { class: 'btn btn--primary btn--sm tl-play', type: 'button', 'aria-label': 'Play' }, 'Play');
      const scrub = h('input', { class: 'tl-scrub', type: 'range', min: 0, max: n - 1, value: 0, step: 1, 'aria-label': 'Position in your run' });
      const lab = h('span', { class: 'tl-pos', 'aria-live': 'off' });
      const sel = h('select', { class: 'tl-speed', 'aria-label': 'Replay speed' }, [10, 15, 20].map(v => h('option', { value: v, selected: v === speed }, v + '× speed')));
      const gifBtn = h('button', { class: 'btn btn--sm', type: 'button' }, 'Download timelapse (GIF)');
      const closeBtn = h('button', { class: 'btn btn--sm', type: 'button' }, 'Close');
      const status = h('p', { class: 'tl-gifstatus small muted', 'aria-live': 'polite' });
      const card = h('div', { class: 'tl-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Replay: ' + opts.label },
        h('div', { class: 'tl-head' }, h('strong', null, opts.label), h('span', { class: 'muted small' }, ' · your run, sped up')),
        h('div', { class: 'tl-view' }, cv),
        h('div', { class: 'tl-row' }, play, scrub), h('div', { class: 'tl-row tl-row--meta' }, lab, h('label', { class: 'tl-speed-l' }, 'Speed ', sel)),
        h('div', { class: 'tl-row' }, gifBtn, closeBtn), status);
      modal = h('div', { class: 'tl-modal' }, card);
      const opener = document.activeElement, inert = [];
      Array.from(document.body.children).forEach(el => { if (el !== modal && !el.hasAttribute('inert') && el.tagName !== 'SCRIPT') { el.setAttribute('inert', ''); inert.push(el); } });
      document.body.append(modal); document.body.classList.add('has-dm');
      const ensure = async i => { if (cache.has(i) || inflight.has(i) || gone) return; inflight.add(i); try { const bm = await tlBitmap(list[i]); if (gone) { if (bm.close) bm.close(); } else cache.set(i, bm); } catch (e) { /* skip a bad frame */ } inflight.delete(i); };
      const trim = i => { cache.forEach((bm, k) => { if (k < i - 6 || k > i + 48) { if (bm.close) bm.close(); cache.delete(k); } }); };
      const draw = i => { let k = i; while (k >= 0 && !cache.has(k)) k--; if (k < 0) return; if (k === shown) return; shown = k; c2.drawImage(cache.get(k), 0, 0, W, H); };
      let lastLab = '';
      const label = i => { const s2 = i + '|' + speed; if (s2 === lastLab) return; lastLab = s2; lab.textContent = `Frame ${i + 1} of ${n} · ${speed}× speed`; scrub.value = i; scrub.setAttribute('aria-valuetext', `Frame ${i + 1} of ${n}`); };
      const seek = async i => { i = Math.max(0, Math.min(n - 1, Math.round(i))); pos = i; await ensure(i); for (let k = 1; k <= 24; k++) if (i + k < n) ensure(i + k); draw(i); label(i); trim(i); };
      const setPlay = on => { playing = on; play.textContent = on ? 'Pause' : (pos >= n - 1 ? 'Replay' : 'Play'); play.setAttribute('aria-label', play.textContent); last = 0; if (on && !raf) raf = requestAnimationFrame(loop); };
      const loop = t => {
        raf = 0; if (gone || !playing) return;
        const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
        pos += dt * fps * speed; const i = Math.min(n - 1, Math.floor(pos));
        for (let k = 0; k < 40 && i + k < n; k += 4) ensure(i + k);
        draw(i); label(i); if (i % 8 === 0) trim(i);
        if (pos >= n - 1) { setPlay(false); return; }
        raf = requestAnimationFrame(loop);
      };
      play.onclick = () => { if (!playing && pos >= n - 1) { pos = 0; shown = -1; } setPlay(!playing); };
      scrub.oninput = () => { setPlay(false); seek(+scrub.value); };
      sel.onchange = () => { speed = +sel.value; label(Math.floor(pos)); };
      gifBtn.onclick = async () => { gifBtn.disabled = true; status.textContent = 'Building the GIF…'; try { await rec.downloadGif({ speed, onprogress: f => { status.textContent = `Building the GIF… ${Math.round(f * 100)}%`; } }); status.textContent = 'GIF downloaded.'; } catch (e) { status.textContent = 'Could not build the GIF here.'; } gifBtn.disabled = false; };
      const close = () => { gone = true; playing = false; cancelAnimationFrame(raf); cache.forEach(bm => { if (bm.close) bm.close(); }); cache.clear(); document.removeEventListener('keydown', onKey, true); modal.remove(); modal = null; inert.forEach(el => el.removeAttribute('inert')); document.body.classList.remove('has-dm'); if (opener && opener.focus) { try { opener.focus(); } catch (e) { /* gone */ } } };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key === ' ' && !['BUTTON', 'SELECT', 'INPUT'].includes(document.activeElement.tagName)) { e.preventDefault(); play.click(); return; }
        if (e.key !== 'Tab') return;
        const f = $$('button:not([disabled]), input, select', card); if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      };
      document.addEventListener('keydown', onKey, true);
      closeBtn.onclick = close; modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
      await seek(0);
      play.focus();
      rec._modal = { close, get playing() { return playing; }, get pos() { return pos; }, seek, setPlay };
      if (!Lab.reducedMotion() && ro.autoplay !== false) setPlay(true);   // reduced motion: starts paused, the student presses Play
      return rec._modal;
    };

    /* --- GIF --- */
    rec.gif = async function (go = {}) {
      await rec.restored; const list = rec.frames; if (list.length < 1) throw new Error('no frames');
      const speed = go.speed || 15, durCs = 100 / (fps * speed), keep = Math.max(1, Math.ceil(3 / durCs));
      let pick = list.filter((_, i) => i % keep === 0);
      const cap2 = go.maxFrames || 160; if (pick.length > cap2) { const k = Math.ceil(pick.length / cap2); pick = pick.filter((_, i) => i % k === 0); }
      const delay = Math.max(3, Math.round(durCs * keep * (list.length / Math.max(1, pick.length * keep))));
      const w = Math.min(go.width || W, W) || W, hh = Math.round(w * H / W), tmp = document.createElement('canvas'); tmp.width = w; tmp.height = hh; const tc = tmp.getContext('2d', { willReadFrequently: true });
      const read = async b => { const bm = await tlBitmap(b); tc.drawImage(bm, 0, 0, w, hh); if (bm.close) bm.close(); return tc.getImageData(0, 0, w, hh).data; };
      const enc = new GIF.Encoder(w, hh, { loop: 0 });
      const sample = [], k = Math.max(1, Math.ceil(pick.length / 10));
      for (let i = 0; i < pick.length; i += k) sample.push(await read(pick[i]));
      enc.setPalette(sample);
      for (let i = 0; i < pick.length; i++) { enc.addFrame(i % k === 0 && sample[i / k] ? sample[i / k] : await read(pick[i]), i === pick.length - 1 ? delay + 150 : delay); if (go.onprogress) go.onprogress((i + 1) / pick.length); if (i % 3 === 2) await tlYield(); }
      const bytes2 = enc.finish();
      return Object.assign(new Blob([bytes2], { type: 'image/gif' }), { frameCount: enc.frames, sourceFrames: pick.length });
    };
    rec.downloadGif = async function (go) { const blob = await rec.gif(go); downloadBlob(blob, reportFileBase().replace(/\.docx$/, '') + '_' + slugify(opts.label || key) + '_timelapse.gif'); return blob; };

    /* --- Buttons --- */
    rec.mount = function (el) {
      el = typeof el === 'string' ? $(el) : el;
      const status = h('span', { class: 'tl-status', role: 'status' });
      const rb = h('button', { class: 'btn btn--sm tl-replay', type: 'button', onclick: () => rec.replay({ opener: rb }) }, 'Replay my run');
      const gb = h('button', { class: 'btn btn--sm tl-gif', type: 'button', onclick: async () => { gb.disabled = true; const t0 = status.textContent; status.textContent = 'Building the GIF…'; try { await rec.downloadGif({ onprogress: f => { status.textContent = `Building the GIF… ${Math.round(f * 100)}%`; } }); Lab.toast('Downloaded your timelapse (GIF)', { type: 'ok', announce: false }); } catch (e) { Lab.toast('Could not build the GIF here.', { type: 'warn' }); } status.textContent = t0; sync(); } }, 'Download timelapse (GIF)');
      const box = h('div', { class: 'tl-bar', role: 'group', 'aria-label': `Timelapse of your run: ${opts.label}` }, status, rb, gb);
      const sync = () => { const n = rec.count; rb.disabled = gb.disabled = recording || n < 2; status.textContent = recording ? `Recording… ${n} frame${n === 1 ? '' : 's'}` : n < 2 ? 'Run it to record a timelapse.' : `Timelapse ready: ${n} frames.`; };
      ui.push(sync); sync(); el.append(box); return box;
    };
    TLS.push(rec);
    return rec;
  };
  Lab.timelapse.all = () => TLS.slice();
  Lab.timelapse.erase = tlEraseLab;
  Lab.timelapse.eraseAll = tlEraseAll;
  Lab.timelapse.withRun = () => TLS.filter(r => r.count > 1);

  /* ---------------- Predict vs. actual: Lab.predictCompare ----------------
     A side-by-side card for a Reflect part: the student's saved prediction on the left, a live snapshot of their own chart (or result
     text) on the right, and a highlighted "What happened" line underneath.
       Lab.predictCompare('#reflect-compare', {
         predictKey: 'predict-floatassay',               // the key of the Lab.prompt the prediction was written in
         chartEl: '#cup-chart',                          // a Lab.chart container to snapshot, and/or
         getResult: () => etRows.length ? { ctrl, treat } : null,   // anything; null/undefined = no result yet (chartEl alone: the chart's options)
         summarize: r => `Treated disks floated at ${r.treat} min; the control at ${r.ctrl} min.`,   // → the text under the snapshot
         delta: (r, prediction) => r.treat < r.ctrl ? 'They floated faster, as you predicted.' : null, // → "What happened"; null = just the summary
         part: 'Float assay', partId: 'float-assay',     // "Finish Float assay first" (partId makes it a link) when there is no result
         title: 'Your prediction vs. what happened',     // optional
       });  → { el, refresh(), destroy() }
     It re-reads on its own: when the chart redraws, when answers or tables change, when its part is shown and on a theme change. */
  let pvcCount = 0;   // (not Math.random: that stream is the student's seeded data)
  Lab.predictCompare = function (container, o = {}) {
    container = typeof container === 'string' ? $(container) : container;
    const uid = 'pvc-' + String(o.predictKey || 'x').replace(/[^\w-]/g, '') + '-' + (++pvcCount);
    const chartEl = () => (typeof o.chartEl === 'string' ? $(o.chartEl) : o.chartEl) || null;
    const entry = () => { const c = chartEl(); return c ? REG.charts.find(x => x.el === c) : null; };
    const prediction = () => { const t = document.getElementById('p-' + o.predictKey); const v = t ? t.value : store.get('field:' + o.predictKey); return String(v == null ? '' : v).trim(); };
    const result = () => {
      try {
        if (o.getResult) return o.getResult();
        const e = entry(); return e && chartHasData(e.opts) ? e.opts : null;
      } catch (e) { console.warn(e); return null; }
    };
    const part = o.part || 'the experiment';
    const wait = () => o.partId ? h('span', null, 'Finish ', h('a', { href: '#' + o.partId }, part), ' first') : h('span', null, `Finish ${part} first`);
    const quote = h('blockquote', { class: 'pvc-quote' }), none = h('p', { class: 'pvc-none' }, 'You did not write a prediction here. Next time, predict first.');
    const snap = h('div', { class: 'pvc-snap' }), sum = h('p', { class: 'pvc-sum' }), waiting = h('p', { class: 'pvc-wait' });
    const what = h('p', { class: 'pvc-what', role: 'status' });
    const el = h('section', { class: 'pvc', 'aria-labelledby': uid + '-h' },
      h('h3', { id: uid + '-h', class: 'pvc-title' }, o.title || 'Your prediction vs. what happened'),
      h('div', { class: 'pvc-grid' },
        h('div', { class: 'pvc-col pvc-left' }, h('h4', null, 'You predicted'), quote, none),
        h('div', { class: 'pvc-col pvc-right' }, h('h4', null, 'What your bench showed'), snap, sum, waiting)),
      what);
    let lastKey = '';
    function refresh() {
      const pred = prediction(), r = result(), has = r != null && r !== false && !(Array.isArray(r) && !r.length);
      const e = entry(), chartHtml = has && e && chartHasData(e.opts) ? e.html(560) : '';
      let text = '', delta = null;
      if (has) { try { text = String(o.summarize ? o.summarize(r) : ''); } catch (x) { console.warn(x); } try { delta = o.delta ? o.delta(r, pred) : null; } catch (x) { console.warn(x); } }
      const k = JSON.stringify([pred, has, text, delta, chartHtml.length, chartHtml.slice(0, 400), chartHtml.slice(-200)]);
      if (k === lastKey) return; lastKey = k;
      quote.hidden = !pred; none.hidden = !!pred; quote.textContent = pred ? '“' + pred + '”' : '';
      snap.hidden = !chartHtml; if (chartHtml) { snap.className = 'pvc-snap chart'; snap.innerHTML = chartHtml; snap.setAttribute('role', 'img'); snap.setAttribute('aria-label', 'Snapshot of your graph: ' + ((e && e.opts && e.opts.yLabel) ? tlPlain(String(e.opts.yLabel)) : 'results')); }
      sum.hidden = !has || !text; sum.textContent = text;
      waiting.hidden = has; waiting.textContent = ''; if (!has) waiting.append(wait());
      what.className = 'pvc-what' + (has ? '' : ' is-wait'); what.textContent = '';
      if (!has) what.append(h('strong', null, 'What happened: '), wait());
      else what.append(h('strong', null, 'What happened: '), delta != null && delta !== '' ? String(delta) : (text || 'Your result is in. Compare it with your prediction.'));
    }
    container.append(el); refresh();
    workListeners.push(refresh);
    const c = chartEl(); let mo = null;
    if (c && 'MutationObserver' in window) { mo = new MutationObserver(() => refresh()); mo.observe(c, { childList: true, subtree: true }); }
    const th = () => refresh(); window.addEventListener('aplab:theme', th);
    const un = Lab.onShow(el, refresh);
    const tick = setInterval(() => { if (el.isConnected && el.offsetParent) refresh(); }, 1500);   // result sources that no event announces (a page's own variables)
    return { el, refresh, destroy() { clearInterval(tick); if (mo) mo.disconnect(); window.removeEventListener('aplab:theme', th); const i = workListeners.indexOf(refresh); if (i >= 0) workListeners.splice(i, 1); try { un(); } catch (e) { /* ignore */ } el.remove(); } };
  };

  /* ---------------- "Bench-verified" stamp ----------------
     A small rotated ink-stamp seal (BENCH-VERIFIED, the Dataset ID and the date) drawn on a canvas, rough-edged and unevenly inked,
     about −8°, in stamp blue or red. It goes in the .docx page header and at the top of the PDF report view, beside (never over) the text.
       const s = Lab.stamp.png({ datasetId: 'K7M-2QX', date: new Date(), color: 'blue' | 'red' });
       s → { dataUrl, bytes: Uint8Array, width, height, alt }      Lab.stamp.render(opts) → the canvas itself
     The same inputs always give the same stamp (the roughness is seeded from the Dataset ID and date). */
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const stampDate = d => { d = d instanceof Date ? d : new Date(d || Date.now()); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  function stampRender(o = {}) {
    const S = 480, id = String(o.datasetId || SEED.datasetId || '').toUpperCase(), date = stampDate(o.date);
    const ink = o.color === 'red' ? '#a8231c' : '#1b4a9a';
    const rnd = mulberry32(hash32(id + '|' + date + '|stamp'));
    const clean = document.createElement('canvas'); clean.width = clean.height = S;
    const c = clean.getContext('2d'), cx = S / 2, cy = S / 2;
    c.fillStyle = c.strokeStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = 11; c.beginPath(); c.arc(cx, cy, 218, 0, 6.2832); c.stroke();
    c.lineWidth = 3.5; c.beginPath(); c.arc(cx, cy, 199, 0, 6.2832); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 120, 0, 6.2832); c.stroke();
    const arc = (text, r, mid, size, top) => {
      c.font = `900 ${size}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
      const sp = size * 0.16, ws = Array.from(text).map(ch => c.measureText(ch).width + sp), total = ws.reduce((a, b) => a + b, 0) - sp;
      let a = top ? mid - total / r / 2 : mid + total / r / 2;
      Array.from(text).forEach((ch, i) => {
        const w = ws[i] - sp, th = a + (top ? 1 : -1) * (w / 2) / r;
        c.save(); c.translate(cx + Math.cos(th) * r, cy + Math.sin(th) * r); c.rotate(top ? th + Math.PI / 2 : th - Math.PI / 2); c.fillText(ch, 0, 0); c.restore();
        a += (top ? 1 : -1) * ws[i] / r;
      });
    };
    arc('BENCH-VERIFIED', 152, -Math.PI / 2, 47, true);
    arc('★ AP BIO LAB BENCH ★', 152, Math.PI / 2, 30, false);
    c.font = '700 24px Consolas, "Courier New", monospace'; c.fillText('DATASET ID', cx, cy - 52);
    let fs = 60; c.font = `700 ${fs}px Consolas, "Courier New", monospace`;
    while (c.measureText(id).width > 200 && fs > 30) { fs -= 2; c.font = `700 ${fs}px Consolas, "Courier New", monospace`; }
    c.fillText(id, cx, cy - 4);
    c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 84, cy + 32); c.lineTo(cx + 84, cy + 32); c.stroke();
    c.font = '700 29px Consolas, "Courier New", monospace'; c.fillText(date, cx, cy + 58);
    // roughen: tilt −8°, jitter the edge, thin the ink unevenly (low-frequency blotches + pressure gradient + speckle)
    const out = document.createElement('canvas'); out.width = out.height = S;
    const x = out.getContext('2d');
    x.translate(cx, cy); x.rotate(-8 * Math.PI / 180); x.translate(-cx, -cy);
    [[0, 0, 1], [0.9, 0.4, 0.55], [-0.7, -0.6, 0.55]].forEach(([dx, dy, a]) => { x.globalAlpha = a; x.drawImage(clean, dx, dy); });
    x.globalAlpha = 1; x.setTransform(1, 0, 0, 1, 0, 0);
    const img = x.getImageData(0, 0, S, S), d = img.data;
    const G = 24, grid = new Float32Array((G + 2) * (G + 2)); for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    const vnoise = (px, py, f) => { const u = px / S * f, v = py / S * f, iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv, w = G + 2;
      const g = (i, j) => grid[(((j % w) + w) % w) * w + (((i % w) + w) % w)]; const sm = t => t * t * (3 - 2 * t);
      const a = g(iu, iv), b = g(iu + 1, iv), cc = g(iu, iv + 1), dd = g(iu + 1, iv + 1);
      return (a + (b - a) * sm(fu)) * (1 - sm(fv)) + (cc + (dd - cc) * sm(fu)) * sm(fv); };
    const tilt = rnd() * 6.283, tx = Math.cos(tilt), ty = Math.sin(tilt);
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const i = (py * S + px) * 4; if (!d[i + 3]) continue;
      const low = vnoise(px, py, 5), mid = vnoise(px + 40, py + 17, 14), hi = vnoise(px * 1.7, py * 1.3, 23);
      const press = 0.5 + ((px - cx) * tx + (py - cy) * ty) / S * 0.5; // heavier on one side, like a stamp pressed unevenly
      let a = d[i + 3] / 255 * (0.52 + 0.55 * low + 0.35 * press + 0.5 * (mid - 0.5) + 0.7 * (hi - 0.5));
      a = Math.min(1, Math.max(0, (a - 0.3) * 2.3));
      d[i + 3] = Math.round(a * 255);
    }
    x.putImageData(img, 0, 0);
    x.globalCompositeOperation = 'destination-out';   // flecks where the ink skipped
    for (let i = 0; i < 380; i++) { const a = rnd() * 6.283, rr = 60 + rnd() * 175; x.globalAlpha = 0.55 + rnd() * 0.45; x.beginPath(); x.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.6 + rnd() * rnd() * 3, 0, 6.283); x.fill(); }
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    return out;
  }
  function stampPng(o = {}) {
    const cv = stampRender(o), dataUrl = cv.toDataURL('image/png');
    const bin = atob(dataUrl.split(',')[1]), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { dataUrl, bytes, width: cv.width, height: cv.height, alt: `Bench-verified stamp: Dataset ID ${o.datasetId || SEED.datasetId}, ${stampDate(o.date)}` };
  }
  Lab.stamp = { png: stampPng, render: stampRender, date: stampDate };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountThemeSwitch); else mountThemeSwitch();

  window.Lab = Lab;
})();
