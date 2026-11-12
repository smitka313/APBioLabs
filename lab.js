/* AP Bio Lab Bench — shared toolkit. Exposes window.Lab.
   No dependencies. Every API is documented in KIT.md. */
(function () {
  'use strict';
  const Lab = {};
  let LAB_ID = 'lab';

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
    let s = (seed == null ? Math.floor(Math.random() * 2 ** 31) : seed) >>> 0;
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

  Lab.chart = function (el, opts) {
    if (typeof el === 'string') el = $(el);
    el.classList.add('chart');
    let cur = Object.assign({}, opts);
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
        const clipId = 'c' + Math.random().toString(36).slice(2, 8);
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
    function changed(rerender = true) { if (opts.save) store.set(opts.save, rows); if (rerender) render(); else if (opts.footer) render(); opts.onChange && opts.onChange(rows); }
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
        updateScore();
      }
      box.append(h('div', { class: 'row' }, h('button', { class: 'btn btn--sm', type: 'button', onclick: () => grade(true) }, 'Check answer')), fb);
      el.append(box);
      if (saved[qi]) grade(false);
    });
    el.append(scoreEl);
    updateScore();
  };

  /* ---------------- Autosave for [data-save] fields ---------------- */
  function bindAutosave(root = document) {
    $$('[data-save]', root).forEach(f => {
      if (f._bound) return; f._bound = true;
      const key = 'field:' + f.dataset.save;
      const v = store.get(key);
      if (v != null) { if (f.type === 'checkbox') f.checked = v; else f.value = v; }
      let t; const status = f.closest('.prompt') && $('.saved', f.closest('.prompt'));
      const save = () => { store.set(key, f.type === 'checkbox' ? f.checked : f.value); if (status) status.textContent = 'Saved on this device'; };
      f.addEventListener('input', () => { clearTimeout(t); t = setTimeout(save, 400); });
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
    el.append(wrap); bindAutosave(wrap); return wrap;
  };

  /* ---------------- Responses toolbar: copy all work ---------------- */
  function collectText() {
    const title = document.title;
    const lines = [title, '='.repeat(title.length), ''];
    const nameField = $('#student-name');
    if (nameField && nameField.value) lines.push('Name: ' + nameField.value, '');
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
  };

  /* ---------------- Step navigation ---------------- */
  function buildNav() {
    const nav = $('.step-nav ol'); if (!nav) return;
    const steps = $$('section.step');
    steps.forEach((s, i) => {
      if (!s.id) s.id = 'step-' + (i + 1);
      nav.append(h('li', null, h('a', { href: '#' + s.id }, h('span', { class: 'n' }, String(i + 1)), s.dataset.step || ('Step ' + (i + 1)))));
    });
    const links = $$('a', nav);
    const setActive = id => links.forEach(a => {
      const on = a.getAttribute('href') === '#' + id; a.setAttribute('aria-current', on ? 'true' : 'false');
      if (on) { const r = a.getBoundingClientRect(), nr = nav.getBoundingClientRect(); if (r.left < nr.left || r.right > nr.right) nav.scrollLeft += r.left - nr.left - 16; }
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => { es.filter(e => e.isIntersecting).forEach(e => setActive(e.target.id)); }, { rootMargin: '-30% 0px -60% 0px' });
      steps.forEach(s => io.observe(s));
    }
    if (steps[0]) setActive(steps[0].id);
  }

  /* ---------------- Init ---------------- */
  Lab.init = function (o = {}) {
    LAB_ID = o.id || LAB_ID;
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
