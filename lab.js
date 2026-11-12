/* AP Bio Lab Bench — shared toolkit. Exposes window.Lab.
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
    if ((m = t.match(/^Lab (\d+) Teacher Notes/i))) return { kind: 'teacher', id: 'teacher-lab' + m[1].padStart(2, '0') };
    if ((m = t.match(/^Lab (\d+) ·/))) return { kind: 'lab', id: 'lab' + m[1].padStart(2, '0') };
    if (/^AP Bio Lab Bench/.test(t)) return { kind: 'home', id: 'home' };
    return { kind: 'other', id: FILE.replace(/\.html?$/, '') || 'page' };
  })();
  if (PAGE.kind === 'lab' || PAGE.kind === 'teacher') LAB_ID = PAGE.id;
  const IS_LAB = PAGE.kind === 'lab';
  Lab.page = PAGE;

  /* Site-wide storage (not namespaced to one lab): identity, dataset numbers, progress summaries. */
  const gstore = {
    get(key, fallback = null) { try { const v = localStorage.getItem('aplab:' + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(key, val) { try { localStorage.setItem('aplab:' + key, JSON.stringify(val)); return true; } catch (e) { return false; } },
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
  const SEED = (function () {
    const idn = effectiveIdentity();
    let basis;
    if (idn) basis = studentKey(idn);
    else {
      let a = gstore.get('anon');
      if (!a) { a = Math.floor(nativeRandom() * 4294967296).toString(36); gstore.set('anon', a); }
      basis = 'anon:' + a;
    }
    const ds = datasetNo(idn);
    const str = [basis, PAGE.id, ds].join('|');
    return { seed: hash32(str), str, basis, datasetNumber: ds, datasetId: datasetCode(hash32(str + '#dataset-id')), student: !!idn };
  })();
  let rngCount = 0;
  if (IS_LAB) Math.random = mulberry32(SEED.seed);
  /* Seed for an unseeded Lab.rng(): the n-th call on a page always gets the same seed for the same student. */
  const autoSeed = () => IS_LAB ? hash32(SEED.str + ':rng:' + (rngCount++)) : Math.floor(nativeRandom() * 2 ** 31);

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
    set(key, val) { try { localStorage.setItem(`aplab:${LAB_ID}:${key}`, JSON.stringify(val)); } catch (e) { /* storage blocked */ } },
    clearLab() {
      try { Object.keys(localStorage).filter(k => k.startsWith(`aplab:${LAB_ID}:`)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    }
  };
  Lab.store = store;

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
  function niceStep(range, ticks) {
    const raw = range / Math.max(1, ticks), mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    return (r >= 5 ? 10 : r >= 2 ? 5 : r >= 1 ? 2 : 1) * mag;
  }
  function niceRange(lo, hi, ticks = 5) {
    if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
    if (lo === hi) { hi = lo + 1; lo = lo - (lo === 0 ? 0 : 1); }
    const step = niceStep(hi - lo, ticks);
    return { lo: Math.floor(lo / step + 1e-9) * step, hi: Math.ceil(hi / step - 1e-9) * step, step };
  }
  const tickFmt = (v, step) => { const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); return Lab.fmt(v, Math.min(d, 4)); };

  let clipCount = 0;
  /* Callbacks run (debounced) whenever student work changes: progress marks use this. */
  const workListeners = []; let workTimer = null;
  function workChanged() { clearTimeout(workTimer); workTimer = setTimeout(() => workListeners.forEach(f => { try { f(); } catch (e) { console.warn(e); } }), 120); }
  const REG = { charts: [], tables: [], quizzes: [], prompts: [] }; // used by reports, worksheets and progress
  Lab.chart = function (el, opts) {
    if (typeof el === 'string') el = $(el);
    el.classList.add('chart');
    let cur = Object.assign({}, opts);
    REG.charts.push({ el, get opts() { return cur; } });
    function render() {
      const o = cur, W = 640, H = o.height || 360, m = { t: 16, r: 18, b: 54, l: 64 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const series = (o.series || []).map((s, i) => Object.assign({ color: SERIES[i % SERIES.length], line: o.type !== 'bar', dots: true }, s));
      let svg = '';
      if (o.type === 'bar') {
        const cats = o.categories || (series[0] ? series[0].points.map(p => p.x) : []);
        let yMax = -Infinity, yMin = 0;
        series.forEach(s => s.points.forEach(p => { yMax = Math.max(yMax, p.y + (p.err || 0)); yMin = Math.min(yMin, p.y - (p.err || 0)); }));
        const yr = niceRange(o.yMin != null ? o.yMin : yMin, o.yMax != null ? o.yMax : (isFinite(yMax) ? yMax : 1));
        const Y = v => m.t + ih - (v - yr.lo) / (yr.hi - yr.lo) * ih;
        for (let v = yr.lo; v <= yr.hi + 1e-9; v += yr.step) svg += `<line class="gridline" x1="${m.l}" x2="${m.l + iw}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${tickFmt(v, yr.step)}</text>`;
        const gw = iw / Math.max(1, cats.length), bw = Math.min(56, (gw * 0.72) / Math.max(1, series.length));
        cats.forEach((c, ci) => {
          const gx = m.l + gw * ci + gw / 2;
          svg += `<text x="${gx}" y="${m.t + ih + 18}" text-anchor="middle">${esc(c)}</text>`;
          series.forEach((s, si) => {
            const p = s.points.find(pp => pp.x === c) || s.points[ci]; if (!p || !isFinite(p.y)) return;
            const x = gx - (bw * series.length) / 2 + bw * si, y0 = Y(Math.max(0, yr.lo)), y1 = Y(p.y);
            svg += `<rect x="${x + 2}" y="${Math.min(y0, y1)}" width="${bw - 4}" height="${Math.abs(y0 - y1)}" rx="3" style="fill:${s.color}"><title>${esc(s.name || '')} ${esc(c)}: ${Lab.fmt(p.y, 3)}</title></rect>`;
            if (p.err) { const cx = x + bw / 2; svg += `<g style="stroke:var(--ink)" stroke-width="1.4"><line x1="${cx}" x2="${cx}" y1="${Y(p.y - p.err)}" y2="${Y(p.y + p.err)}"/><line x1="${cx - 5}" x2="${cx + 5}" y1="${Y(p.y - p.err)}" y2="${Y(p.y - p.err)}"/><line x1="${cx - 5}" x2="${cx + 5}" y1="${Y(p.y + p.err)}" y2="${Y(p.y + p.err)}"/></g>`; }
          });
        });
        svg += `<line class="axis" x1="${m.l}" x2="${m.l + iw}" y1="${Y(Math.max(0, yr.lo))}" y2="${Y(Math.max(0, yr.lo))}"/>`;
      } else {
        let xs = [], ys = [];
        series.forEach(s => s.points.forEach(p => { if (isFinite(p.x) && isFinite(p.y)) { xs.push(p.x); ys.push(p.y - (p.err || 0), p.y + (p.err || 0)); } }));
        (o.hLines || []).forEach(l => ys.push(l.y));
        const xr = niceRange(o.xMin != null ? o.xMin : Math.min(0, ...(xs.length ? xs : [0])), o.xMax != null ? o.xMax : Math.max(...(xs.length ? xs : [1])), 6);
        const yr = niceRange(o.yMin != null ? o.yMin : Math.min(0, ...(ys.length ? ys : [0])), o.yMax != null ? o.yMax : Math.max(...(ys.length ? ys : [1])), 5);
        const X = v => m.l + (v - xr.lo) / (xr.hi - xr.lo) * iw, Y = v => m.t + ih - (v - yr.lo) / (yr.hi - yr.lo) * ih;
        for (let v = yr.lo; v <= yr.hi + 1e-9; v += yr.step) svg += `<line class="gridline" x1="${m.l}" x2="${m.l + iw}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${tickFmt(v, yr.step)}</text>`;
        for (let v = xr.lo; v <= xr.hi + 1e-9; v += xr.step) svg += `<line class="gridline" x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${m.t + ih}"/><text x="${X(v)}" y="${m.t + ih + 18}" text-anchor="middle">${tickFmt(v, xr.step)}</text>`;
        if (yr.lo < 0 && yr.hi > 0) svg += `<line class="axis" x1="${m.l}" x2="${m.l + iw}" y1="${Y(0)}" y2="${Y(0)}"/>`;
        svg += `<line class="axis" x1="${m.l}" x2="${m.l + iw}" y1="${m.t + ih}" y2="${m.t + ih}"/><line class="axis" x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${m.t + ih}"/>`;
        (o.hLines || []).forEach(l => { svg += `<line x1="${m.l}" x2="${m.l + iw}" y1="${Y(l.y)}" y2="${Y(l.y)}" style="stroke:var(--muted)" stroke-dasharray="5 4"/>${l.label ? `<text x="${m.l + iw - 4}" y="${Y(l.y) - 5}" text-anchor="end">${esc(l.label)}</text>` : ''}`; });
        (o.annotations || []).forEach(a => { svg += `<line x1="${X(a.x)}" x2="${X(a.x)}" y1="${m.t}" y2="${m.t + ih}" style="stroke:var(--stain)" stroke-dasharray="4 4"/>${a.label ? `<text x="${X(a.x) + 5}" y="${m.t + 12}" style="fill:var(--stain)">${esc(a.label)}</text>` : ''}`; });
        const clipId = 'lc' + (++clipCount); // not Math.random: keeps the seeded stream for simulations
        svg += `<defs><clipPath id="${clipId}"><rect x="${m.l}" y="${m.t - 6}" width="${iw + 6}" height="${ih + 12}"/></clipPath></defs><g clip-path="url(#${clipId})">`;
        series.forEach(s => {
          const pts = s.points.filter(p => isFinite(p.x) && isFinite(p.y)).slice().sort((a, b) => a.x - b.x);
          if (s.line && pts.length > 1) svg += `<polyline fill="none" style="stroke:${s.color}" stroke-width="2.2" ${s.dash ? 'stroke-dasharray="6 5"' : ''} stroke-linejoin="round" points="${pts.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')}"/>`;
          pts.forEach(p => { if (p.err) svg += `<g style="stroke:${s.color}" stroke-width="1.3"><line x1="${X(p.x)}" x2="${X(p.x)}" y1="${Y(p.y - p.err)}" y2="${Y(p.y + p.err)}"/><line x1="${X(p.x) - 4}" x2="${X(p.x) + 4}" y1="${Y(p.y - p.err)}" y2="${Y(p.y - p.err)}"/><line x1="${X(p.x) - 4}" x2="${X(p.x) + 4}" y1="${Y(p.y + p.err)}" y2="${Y(p.y + p.err)}"/></g>`; });
          if (s.dots && pts.length <= 120) pts.forEach(p => { svg += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3.8" style="fill:${s.color};stroke:var(--surface)" stroke-width="1.5"><title>${esc(s.name || '')} (${Lab.fmt(p.x, 3)}, ${Lab.fmt(p.y, 3)})</title></circle>`; });
          if (s.fit === 'linear' && pts.length > 1) {
            const f = stats.linreg(pts.map(p => p.x), pts.map(p => p.y));
            if (isFinite(f.m) && isFinite(f.b)) svg += `<line x1="${X(xr.lo)}" x2="${X(xr.hi)}" y1="${Y(f.predict(xr.lo))}" y2="${Y(f.predict(xr.hi))}" style="stroke:${s.color}" stroke-width="1.5" stroke-dasharray="6 4" opacity=".8"/>`;
            if (isFinite(f.m)) s._fit = f;
          }
        });
        svg += '</g>';
      }
      svg += `<text class="axis-label" x="${m.l + iw / 2}" y="${H - 10}" text-anchor="middle">${esc(o.xLabel || '')}</text>`;
      svg += `<text class="axis-label" transform="translate(16 ${m.t + ih / 2}) rotate(-90)" text-anchor="middle">${esc(o.yLabel || '')}</text>`;
      const named = series.filter(s => s.name);
      const legend = named.length > 1 || (named.length === 1 && o.type !== 'bar') ? `<div class="legend">${named.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
      const fits = series.filter(s => s._fit).map(s => `${esc(s.name || 'fit')}: y = ${Lab.fmt(s._fit.m, 4)}x ${s._fit.b < 0 ? '−' : '+'} ${Lab.fmt(Math.abs(s._fit.b), 4)}  (R² = ${Lab.fmt(s._fit.r2, 3)})`);
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc((o.yLabel || '') + ' vs ' + (o.xLabel || ''))}">${svg}</svg>${legend}${fits.length ? `<div class="chart-note">${fits.join('<br>')}</div>` : ''}`;
    }
    render();
    return { update(next) { cur = Object.assign({}, cur, next); render(); }, el };
  };

  /* ---------------- Data table ----------------
     Lab.table(el, { columns:[{key,label,unit,num:true,digits:2,editable:false}], rows:[], save:'key', onChange(rows), footer:(rows)=>[...cells] })
     → { setRows(rows), getRows(), addRow(row) } */
  Lab.table = function (el, opts) {
    if (typeof el === 'string') el = $(el);
    let rows = (opts.save && store.get(opts.save)) || (opts.rows || []).map(r => Object.assign({}, r));
    REG.tables.push({ el, opts, getRows: () => rows });
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
      $$('input[data-r]', el).forEach(inp => inp.addEventListener('change', () => {
        const r = rows[+inp.dataset.r], c = cols.find(cc => cc.key === inp.dataset.k);
        r[inp.dataset.k] = c.num ? (inp.value === '' ? null : parseFloat(inp.value)) : inp.value;
        changed(false);
      }));
    }
    function changed(rerender = true) { if (opts.save) store.set(opts.save, rows); if (rerender) render(); else if (opts.footer) render(); opts.onChange && opts.onChange(rows); workChanged(); }
    render();
    if (rows.length && opts.onChange) setTimeout(() => opts.onChange(rows), 0);
    return {
      setRows(r) { rows = r.map(x => Object.assign({}, x)); changed(); },
      addRow(r) { rows.push(Object.assign({}, r)); changed(); },
      getRows() { return rows; },
      clear() { rows = []; changed(); },
    };
  };

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
      }
      box.append(h('div', { class: 'row' }, h('button', { class: 'btn btn--sm', type: 'button', onclick: () => grade(true) }, 'Check answer')), fb);
      el.append(box);
      if (saved[qi]) grade(false);
    });
    el.append(scoreEl);
    updateScore();
  };

  /* ---------------- Autosave for [data-save] fields ---------------- */
  const saveFns = []; // flushed before a reload so nothing typed is lost
  function bindAutosave(root = document) {
    $$('[data-save]', root).forEach(f => {
      if (f._bound) return; f._bound = true;
      const key = 'field:' + f.dataset.save;
      const v = store.get(key);
      if (v != null) { if (f.type === 'checkbox') f.checked = v; else f.value = v; }
      let t; const status = f.closest('.prompt') && $('.saved', f.closest('.prompt'));
      const save = () => { store.set(key, f.type === 'checkbox' ? f.checked : f.value); if (status) status.textContent = 'Saved on this device'; };
      saveFns.push(() => { clearTimeout(t); save(); });
      f.addEventListener('input', () => { clearTimeout(t); t = setTimeout(save, 400); workChanged(); });
      f.addEventListener('change', save);
    });
  }
  Lab.bindAutosave = bindAutosave;

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
  function flushSaves() { saveFns.forEach(f => { try { f(); } catch (e) { /* ignore */ } }); }
  function setIdentity(idn) {
    const clean = { name: normName(idn.name), period: String(idn.period || '') };
    const ok = gstore.set('student', clean);
    memIdentity = ok ? null : clean;
    return ok;
  }
  function reloadForSeed() { flushSaves(); location.reload(); }
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
          h('div', { class: 'field id-f-name' }, h('label', { for: uid + '-name' }, 'Enter your name as it appears in Schoology'), nameIn),
          h('div', { class: 'field id-f-period' }, h('label', { for: uid + '-period' }, 'Class period'), perSel),
          h('div', { class: 'id-actions' }, h('button', { class: 'btn btn--primary', type: 'submit' }, 'Save'),
            idn || box._compact ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { renderIdentity(box); focusIn(box, '.id-change'); } }, 'Cancel') : null)),
        err);
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const name = normName(nameIn.value), period = perSel.value;
        if (name.length < 2) { err.textContent = 'Type your name as it appears in Schoology.'; nameIn.focus(); return; }
        if (!period) { err.textContent = 'Choose your class period.'; perSel.focus(); return; }
        const ok = setIdentity({ name, period });
        if (ok && IS_LAB && studentKey({ name, period }) !== SEED.basis) { // seeding must change: reload once
          err.textContent = 'Saved. Setting up your own data…';
          reloadForSeed(); return;
        }
        idHosts.forEach(b => renderIdentity(b));
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
    box.append(line); if (confirmRow) box.append(confirmRow);
  }
  Lab.identity = {
    get: () => { const e = effectiveIdentity(); return e ? { name: e.name, period: e.period } : null; },
    set(idn) { const ok = setIdentity(idn); idHosts.forEach(b => renderIdentity(b)); return ok; },
    mount(el, opts = {}) {
      if (typeof el === 'string') el = $(el);
      if (!el || PAGE.kind === 'teacher') return null;
      const box = h('div', { class: 'id-box' }); box._compact = !!opts.compact; idHosts.push(box); el.append(box); renderIdentity(box); return box;
    },
    newDataset() {
      const idn = effectiveIdentity(); if (!idn || !IS_LAB) return false;
      if (!gstore.set(dsKey(idn), SEED.datasetNumber + 1)) return false;
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

  /* ---------------- Responses toolbar: copy all work ---------------- */
  function collectText() {
    const title = document.title;
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
    const confirmRow = h('div', { class: 'row', hidden: true },
      h('span', { class: 'small' }, 'Erase every answer and data table on this lab?'),
      h('button', { class: 'btn btn--sm btn--danger', type: 'button', onclick: () => { store.clearLab(); location.reload(); } }, 'Erase my work'),
      h('button', { class: 'btn btn--sm', type: 'button', onclick: () => { confirmRow.hidden = true; } }, 'Keep it'));
    const copyBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
      const text = collectText();
      try { await navigator.clipboard.writeText(text); msg.textContent = 'Copied. Paste it into your document or LMS.'; fallback.hidden = true; }
      catch (e) { fallback.value = text; fallback.hidden = false; fallback.focus(); fallback.select(); msg.textContent = 'Copy is blocked here. Your text is selected below: press Ctrl+C (or ⌘C).'; }
    } }, 'Copy all my responses');
    const clearBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => { confirmRow.hidden = false; } }, 'Start over');
    el.append(h('div', { class: 'responses-bar' }, msg, copyBtn, clearBtn), confirmRow, fallback);
    if (PAGE.kind !== 'teacher') el.append(...reportTools(), moveWorkPanel());
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
  const labTag = () => { const m = /^lab(\d\d)$/.exec(PAGE.id); return m ? 'Lab' + m[1] : 'Lab'; };
  function reportFileBase() {
    const who = reportIdentity().name;
    let first = '', last = '';
    if (who.includes(',')) { [last, first] = who.split(',').map(s => s.trim()); }
    else { const parts = who.split(' ').filter(Boolean); if (parts.length > 1) { last = parts.pop(); first = parts.join(' '); } else last = parts[0] || ''; }
    const clean = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    return [labTag(), clean(last), clean(first)].filter(Boolean).join('_') || labTag();
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
        if (n.matches('.chart')) { const c = chartByEl.get(n); if (c && $('svg', n) && chartHasData(c.opts)) items.push({ kind: 'chart', el: n, opts: c.opts }); return; }
        if (n.matches('table.data')) { const t = tableItem(n); if (t) items.push(t); return; }
        if (n.id === 'student-name' || !(n.tagName === 'TEXTAREA' || n.dataset.label)) return;
        items.push({ kind: 'answer', q: fieldLabel(n), a: fieldValue(n) });
      });
      const h2 = $(':scope > header h2', sec);
      if (items.length) sections.push({ name: sec.dataset.step || '', heading: h2 ? h2.textContent.trim() : '', items });
    });
    return {
      title, docTitle: document.title, lab: PAGE.id, labNo: labTag().replace('Lab', ''),
      name: who.name, period: who.period, datasetId: who.datasetId,
      date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      sections,
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
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun, ShadingType, BorderStyle } = D;
    const P = (text, o = {}) => new Paragraph(Object.assign({ children: [new TextRun(Object.assign({ text: String(text) }, o.run || {}))] }, o.para || {}));
    const kids = [];
    kids.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(rep.docTitle || rep.title)] }));
    const info = [['Name', rep.name || '(not entered)'], ['Class period', rep.period || '—'], ['Date', rep.date], ['Dataset ID', rep.datasetId]];
    info.forEach(([k, v]) => kids.push(new Paragraph({ children: [new TextRun({ text: k + ': ', bold: true }), new TextRun(String(v))] })));
    const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
    const borders = { top: border, bottom: border, left: border, right: border };
    const cell = (t, head) => new TableCell({ borders, shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E8EEEA' } : undefined, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: String(t == null ? '' : t), bold: !!head, size: 18 })] })] });
    for (const s of rep.sections) {
      kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320 }, children: [new TextRun(s.name + (s.heading && s.heading !== s.name ? ': ' + s.heading : ''))] }));
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
    const doc = new Document({
      creator: rep.name || 'Student', title: rep.docTitle || rep.title,
      styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
      sections: [{ properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } }, children: kids }],
    });
    return Packer.toBlob(doc);
  }

  /* Print-styled report view (body.report-mode) for Save as PDF. */
  let reportOpener = null, restoreTheme = null;
  function reportHtml(rep) {
    const out = [];
    out.push(`<header class="rv-head"><p class="rv-eyebrow">AP Biology lab report</p><h1 id="rv-title">${esc(rep.docTitle || rep.title)}</h1>
      <dl class="rv-info"><div><dt>Name</dt><dd>${esc(rep.name || '(not entered)')}</dd></div><div><dt>Class period</dt><dd>${esc(rep.period || '—')}</dd></div><div><dt>Date</dt><dd>${esc(rep.date)}</dd></div><div><dt>Dataset ID</dt><dd>${esc(rep.datasetId)}</dd></div></dl></header>`);
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
    document.body.classList.remove('report-mode');
    if (restoreTheme) { restoreTheme(); restoreTheme = null; }
    document.removeEventListener('keydown', reportKey);
    if (reportOpener) { try { reportOpener.focus(); } catch (e) { /* gone */ } reportOpener = null; }
  }
  function reportKey(e) { if (e.key === 'Escape') closeReport(); }
  async function openReport(o = {}) {
    closeReport(); flushSaves();
    reportOpener = o.opener || document.activeElement;
    const rep = await renderCharts(collectReport());
    restoreTheme = forceLight();
    const note = previewNote(true);
    const status = h('p', { class: 'rv-status', 'aria-live': 'polite' });
    const doPrint = () => tryPrint(() => { note.hidden = false; });
    const view = h('div', { id: 'lab-report', class: 'report-view', role: 'region', 'aria-labelledby': 'rv-title' },
      h('div', { class: 'rv-tools' },
        h('div', { class: 'row' },
          h('button', { class: 'btn btn--primary', type: 'button', onclick: doPrint }, 'Print or save as PDF'),
          h('button', { class: 'btn', type: 'button', onclick: closeReport }, 'Close report')),
        h('p', { class: 'small' }, 'In the print window, set the printer (Destination) to “Save as PDF” or “Microsoft Print to PDF”, then upload the PDF to Schoology.'),
        note, status),
      h('article', { class: 'rv-paper', html: reportHtml(rep) }));
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
    async docx() { const rep = await renderCharts(collectReport()); return withNativeRandom(() => buildDocx(rep)); },
    docxUrls: DOCX_URLS,
  };

  /* ---------------- Save / resume (progress file + resume code) ----------------
     Payload: {app:'aplab', v:1, lab, title, savedAt, student:{name,period}|null, dataset, data:{key: value}}
     data holds every localStorage value this lab saves (aplab:<lab>:*). */
  function progressPayload() {
    flushSaves();
    const data = {}, pre = `aplab:${LAB_ID}:`;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(pre)) { try { data[k.slice(pre.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* skip bad value */ } }
      }
    } catch (e) { /* storage blocked */ }
    const idn = effectiveIdentity();
    return { app: 'aplab', v: 1, lab: LAB_ID, title: document.title, savedAt: new Date().toISOString(), student: idn ? { name: idn.name, period: idn.period } : null, dataset: SEED.datasetNumber, data };
  }
  function parseProgress(text) {
    let o;
    try { o = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { throw new Error('That is not a progress file. Choose the .json file you saved from this lab.'); }
    if (!o || typeof o !== 'object' || o.app !== 'aplab' || !o.data || typeof o.data !== 'object' || Array.isArray(o.data)) throw new Error('That does not look like a Lab Bench progress file.');
    if (typeof o.v !== 'number' || o.v > 1) throw new Error('That progress file was made by a newer version of this site. Reload the page and try again.');
    if (typeof o.lab !== 'string') throw new Error('That progress file is missing its lab number.');
    if (o.lab !== LAB_ID) { const m = /^lab(\d\d)$/.exec(o.lab); throw new Error(m ? `That progress file is for Lab ${+m[1]}. Open Lab ${+m[1]} and load it there.` : 'That progress file is for a different page.'); }
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
    location.reload();
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
  async function readResumeCode(code) {
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
    return parseProgress(text);
  }
  Lab.progressFile = { payload: progressPayload, parse: parseProgress, apply: applyProgress, makeCode: makeResumeCode, readCode: readResumeCode };

  function moveWorkPanel() {
    const status = h('p', { class: 'tool-status', 'aria-live': 'polite' });
    const say = (t, bad) => { status.textContent = t; status.classList.toggle('is-bad', !!bad); };
    const note = previewNote(true);
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-hidden': 'true', tabindex: '-1' });
    const codeOut = h('textarea', { class: 'code-box', readonly: true, rows: 3, hidden: true, 'aria-label': 'Your resume code' });
    const copyCode = h('button', { class: 'btn btn--sm', type: 'button', hidden: true, onclick: async () => {
      try { await navigator.clipboard.writeText(codeOut.value); say('Resume code copied. Paste it somewhere you can reach from the other computer (for example, an email to yourself).'); }
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
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => {
            const p = progressPayload();
            downloadBlob(new Blob([JSON.stringify(p)], { type: 'application/json' }), reportFileBase() + '_progress.json');
            say(`Saved ${reportFileBase()}_progress.json to your Downloads folder.`); if (LIKELY_PREVIEW) note.hidden = false;
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
        say(`Downloaded ${name}. Upload it to Schoology.` + nameWarn());
        if (LIKELY_PREVIEW) note.hidden = false;
      } catch (e) {
        if (e && e.message === 'docx-load') { say('Could not load the Word file tool. Check your internet connection, or use Save as PDF.', true); note.hidden = false; }
        else { console.error(e); say('Something went wrong building the Word file. Use Save as PDF instead.', true); }
      } finally { docxBtn.disabled = false; }
    } }, 'Download .docx');
    const pdfBtn = h('button', { class: 'btn', type: 'button', onclick: () => openReport({ print: true, opener: pdfBtn }) }, 'Save as PDF');
    const bar = h('div', { class: 'responses-bar report-bar' },
      h('span', { class: 'grow' }, 'Hand in on Schoology: download a Word file, or save a PDF from the print window.'), docxBtn, pdfBtn,
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: printWorksheet }, 'Print worksheet'));
    return [bar, status, note];
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
      let img = null;
      if (!wasDark) { try { img = h('img', { src: origCanvases[i].toDataURL('image/png'), alt: origCanvases[i].getAttribute('aria-label') || '', class: 'ws-img' }); } catch (e) { img = null; } }
      if (img) cv.replaceWith(img); else cv.remove();
    });
    $$('button, input, select, textarea, script, .sim, [hidden], .link-tools', clone).forEach(e => e.remove());
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
    const wasDark = isDarkNow();
    const restore = forceLight();
    const note = previewNote(true);
    const hd = $('.lab-header h1');
    const titleText = (document.title || (hd ? hd.textContent : 'Lab')).replace(/["\\]/g, '');
    const style = h('style', { id: 'ws-page-style', text: `@page { size: letter; margin: .7in .6in .6in; @top-left { content: "${titleText}"; font: 9pt Arial, sans-serif; color: #444; } @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9pt Arial, sans-serif; color: #444; } }` });
    const root = h('div', { id: 'lab-worksheet', class: 'worksheet', role: 'region', 'aria-label': 'Printable worksheet' },
      h('div', { class: 'ws-tools' },
        h('div', { class: 'row' },
          h('button', { class: 'btn btn--primary', type: 'button', onclick: () => tryPrint(() => { note.hidden = false; }) }, 'Print worksheet'),
          h('button', { class: 'btn', type: 'button', onclick: exitWorksheet }, 'Back to the lab')),
        note),
      h('article', { class: 'ws-paper', html: buildWorksheet(wasDark) }));
    document.head.append(style);
    document.body.append(root);
    document.body.classList.add('worksheet-mode');
    wsState = { restore, root, style, scrollY: window.scrollY, opener: document.activeElement };
    document.addEventListener('keydown', wsKey);
    window.scrollTo(0, 0);
    return root;
  }
  function wsKey(e) { if (e.key === 'Escape') exitWorksheet(); }
  function exitWorksheet() {
    if (!wsState) return;
    const s = wsState; wsState = null;
    s.root.remove(); s.style.remove(); s.restore();
    document.body.classList.remove('worksheet-mode');
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
  function hashTarget() {
    let raw = ''; try { raw = decodeURIComponent(location.hash.slice(1)); } catch (e) { raw = location.hash.slice(1); }
    if (!raw) return null;
    let el = document.getElementById(raw);
    const m = /^step-(\d+)$/.exec(raw);
    if (!el && m) el = $$('section.step')[+m[1] - 1] || null;
    return el;
  }
  let userScrolled = false;
  function scrollToHash() { const el = hashTarget(); if (el && el.matches('section.step')) el.scrollIntoView({ block: 'start' }); }
  function setupDeepLinks() {
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(ev => window.addEventListener(ev, () => { userScrolled = true; }, { passive: true }));
    window.addEventListener('hashchange', () => { scrollToHash(); });
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
        try { await navigator.clipboard.writeText(url); status.textContent = 'Link copied'; }
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
    REG.tables.forEach(t => { if (!t.opts.save || !sec.contains(t.el)) return; total++; if (t.getRows().length) done++; });
    return { total, done };
  }
  let navProgressEl = null, lastSummary = '';
  function updateProgress() {
    const nav = $('.step-nav ol'); if (!nav) return null;
    let parts = 0, complete = 0;
    $$('section.step').forEach(s => {
      const link = $$('a', nav).find(a => a.getAttribute('href') === '#' + s.id); if (!link) return;
      const r = sectionWork(s), sr = $('.done-sr', link);
      if (!r.total) { link.classList.remove('is-done', 'has-work'); if (sr) sr.textContent = ''; link.removeAttribute('title'); return; }
      parts++; const ok = r.done === r.total; if (ok) complete++;
      link.classList.add('has-work'); link.classList.toggle('is-done', ok);
      if (sr) sr.textContent = ok ? ' (done)' : '';
      link.title = ok ? 'Done' : `${r.done} of ${r.total} items done`;
    });
    if (navProgressEl) { navProgressEl.hidden = !parts; navProgressEl.innerHTML = `${complete} of ${parts}<span class="np-long"> parts</span> done`; }
    const sum = JSON.stringify([complete, parts]);
    if (sum !== lastSummary && parts) { lastSummary = sum; gstore.set('progress:' + PAGE.id, { done: complete, total: parts, t: Date.now() }); }
    return { done: complete, total: parts };
  }
  function buildNav() {
    const nav = $('.step-nav ol');
    const steps = $$('section.step');
    assignStepIds(steps);
    setupDeepLinks();
    if (!nav) return;
    steps.forEach((s, i) => {
      nav.append(h('li', null, h('a', { href: '#' + s.id }, h('span', { class: 'n' }, String(i + 1)), s.dataset.step || ('Step ' + (i + 1)), IS_LAB ? h('span', { class: 'sr-only done-sr' }) : null)));
    });
    const links = $$('a', nav);
    let lastId = null;
    const setActive = id => {
      links.forEach(a => {
        const on = a.getAttribute('href') === '#' + id; a.setAttribute('aria-current', on ? 'true' : 'false');
        if (on) { const r = a.getBoundingClientRect(), nr = nav.getBoundingClientRect(); if (r.left < nr.left || r.right > nr.right) nav.scrollLeft += r.left - nr.left - 16; }
      });
      if (IS_LAB && id !== lastId) { lastId = id; const s = document.getElementById(id); gstore.set('last', { lab: PAGE.id, step: id, name: s ? s.dataset.step || '' : '', title: document.title, t: Date.now() }); }
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => { es.filter(e => e.isIntersecting).forEach(e => setActive(e.target.id)); }, { rootMargin: '-30% 0px -60% 0px' });
      steps.forEach(s => io.observe(s));
    }
    const first = hashTarget();
    if (steps[0]) setActive(first && first.matches('section.step') ? first.id : steps[0].id);
    if (IS_LAB) {
      const wrap = nav.parentElement;
      navProgressEl = h('p', { class: 'nav-progress', hidden: true });
      wrap.classList.add('has-progress'); wrap.append(navProgressEl);
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
      try { started = Object.keys(localStorage).some(k => k.startsWith(`aplab:${id}:`) && !k.endsWith(':field:student-name')); } catch (e) { /* blocked */ }
      if (p && p.total) return Object.assign({ started }, p);
      return started ? { started: true } : null;
    },
    last: () => gstore.get('last'),
  };

  /* Home page (index.html): identity line, per-lab progress on [data-lab-progress] elements, resume link. */
  Lab.home = function (o = {}) {
    if (o.identity) { const host = typeof o.identity === 'string' ? $(o.identity) : o.identity; Lab.identity.mount(host, { compact: true }); }
    $$('[data-lab-progress]').forEach(el => {
      const p = Lab.progress.forLab(el.dataset.labProgress);
      el.innerHTML = '';
      if (!p || (p.total && !p.done && !p.started)) { el.append(h('span', { class: 'prog-text' }, 'Not started')); return; }
      if (!p.total) { el.append(h('span', { class: 'prog-text' }, 'Started')); return; }
      const pct = Math.round(100 * p.done / p.total);
      el.append(h('span', { class: 'prog-text' }, p.done === p.total ? `All ${p.total} parts done` : `${p.done} of ${p.total} parts`),
        h('span', { class: 'prog-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${pct}%` })));
    });
    if (o.resume) {
      const el = typeof o.resume === 'string' ? $(o.resume) : o.resume;
      const last = gstore.get('last');
      if (el && last && /^lab\d\d$/.test(last.lab)) {
        const labName = String(last.title || last.lab);
        el.innerHTML = '';
        el.append(h('a', { class: 'btn btn--primary resume-link', href: `${last.lab}.html${last.step ? '#' + encodeURIComponent(last.step) : ''}` }, 'Resume where you left off'),
          h('span', { class: 'small muted' }, labName + (last.name ? ' · ' + last.name : '')));
        el.hidden = false;
      }
    }
  };

  /* ---------------- Init ---------------- */
  Lab.init = function (o = {}) {
    LAB_ID = o.id || LAB_ID;
    if (IS_LAB) { mountLabIdentity(); addHeaderPrintButton(); }
    buildNav();
    bindAutosave();
    $$('[data-responses]').forEach(el => Lab.responses(el));
  };

  /* Animation loop helper that respects reduced motion & visibility.
     const loop = Lab.loop(dt => {...}); loop.start(); loop.stop(); */
  Lab.loop = function (fn) {
    let raf = null, last = 0;
    const tick = t => { const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t; if (fn(dt) === false) { raf = null; return; } raf = requestAnimationFrame(tick); };
    return { start() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }, stop() { if (raf) cancelAnimationFrame(raf); raf = null; }, get running() { return !!raf; } };
  };
  Lab.reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Canvas helper: crisp canvas sized to CSS width. Returns {ctx, w, h, resize()} */
  Lab.canvas = function (canvas, aspect = 0.56) {
    if (typeof canvas === 'string') canvas = $(canvas);
    const ctx = canvas.getContext('2d');
    const o = { canvas, ctx, w: 0, h: 0 };
    o.resize = () => {
      const w = Math.max(200, canvas.clientWidth || canvas.parentElement.clientWidth); const hh = Math.round(w * aspect);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); canvas.style.height = hh + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); o.w = w; o.h = hh;
    };
    o.resize();
    if ('ResizeObserver' in window) new ResizeObserver(() => { const pw = canvas.clientWidth; if (Math.abs(pw - o.w) > 1) { o.resize(); o.onresize && o.onresize(); } }).observe(canvas);
    return o;
  };
  /* Read a CSS color token for canvas drawing: Lab.color('--accent') (call at draw time so theme changes apply) */
  Lab.color = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';

  window.Lab = Lab;
})();
