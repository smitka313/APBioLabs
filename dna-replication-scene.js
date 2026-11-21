/* DNA fork scene (OpenSciEd B.3 Lesson 5 companion): an original canvas drawing of a 24-letter piece of DNA being copied.
   Registers itself with openscied-b3-dna-p53.js (contract: docs/b3-dna-p53-scenes.md).

   WHAT IT MODELS (the same words appear on the page under "What this simulation models"):
   - Steps follow the Lesson 5 Simulation Guidance: unwind the bundle, unzip it with helicase, pair 5 letters by hand on each
     strand (A with T, G with C), then the model pairs the other 19 on its own and sometimes puts in a wrong letter (a
     substitution: red letter, black cross badge, shifted out of the strand), then try three versions of p53 and replace each
     letter p53 removes until both strands show 0 substitutions.
   - Pure logic (letters, seeded errors, p53 rule, counts) lives in openscied-b3-dna-p53-logic.js and is tested there.
   - Errors come from the student's Dataset ID (api.rng), so they are unique per student and identical after a reload. Every
     strand gets at least one substitution so the lesson works; the count varies from 1 to 6.
   - Simplified: substitutions only, one letter swapped for another. Real polymerases also proofread, real p53 does not pull letters
     out directly (it triggers repair, a pause in the cell cycle or cell death), and cancer chromosome differences are more than
     single substitutions. The model's data are simulated, never from a real cell.
   - Layout: a wide board (24 letters in a row) and a portrait board for phones (each strand wraps to two rows of 12).
   - Saved: api.saveFork() with the contract fields plus run and progress (site strings) so a reload resumes mid-way. */
(function () {
  'use strict';
  (window.B3DnaP53Scenes = window.B3DnaP53Scenes || []).push({ id: 'fork', mount: mount });

  const N = 24, MANUAL = 5;
  const FEATURE = { A: 'tabTri', T: 'sockTri', G: 'tabRound', C: 'sockRound' };
  const P53_PATH = {
    a: 'M22 21C17 5 3 4 3 14C3 20 12 22 22 22Z M22 21C27 5 41 4 41 14C41 20 32 22 22 22Z M22 22C14 22 6 26 8 34C10 40 19 37 22 29Z M22 22C30 22 38 26 36 34C34 40 25 37 22 29Z M18 30L22 45L26 30Z',
    b: 'M22 21C17 5 3 4 3 14C3 20 12 22 22 22Z M22 21C27 8 34 5 41 11L34 15L41 20C34 22 28 22 22 22Z M22 22C14 22 6 26 8 34C10 40 19 37 22 29Z M22 22C30 22 38 26 36 34C34 40 25 37 22 29Z M16 36A6 6 0 1 0 28 36A6 6 0 1 0 16 36Z',
    c: 'M22 21C15 5 9 3 8 10C8 17 14 22 22 22Z M22 21C29 5 35 3 36 10C36 17 30 22 22 22Z M22 22C16 24 14 30 17 36C20 38 22 34 22 29Z M22 22C28 24 30 30 27 36C24 38 22 34 22 29Z M16 31H28V44H16Z'
  };
  const P53_VAR = { a: '--s2', b: '--s3', c: '--stain' };
  const NAME = { top: 'top strand', bottom: 'bottom strand' };
  const CSS = '.fork-ui{display:grid;gap:10px}.fork-next{margin:0;font-weight:600}.fork-hint{margin:0;font-size:.9rem;color:var(--muted);min-height:1.3em}' +
    '.fork-actions,.fork-letters,.fork-p53{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '.fork-lbl{font-weight:700;font-size:.9rem;min-width:7.5em}.fork-letters .btn{min-width:44px;min-height:44px;justify-content:center;font-family:var(--f-mono);font-size:1.05rem}' +
    '.fork-p53 .p53-card{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:var(--r-sm);padding:6px 8px;background:var(--surface)}' +
    '.fork-p53 .p53-card svg{flex:none}.fork-p53 .p53-name{font-weight:700;font-size:.9rem}.fork-p53 .btn{min-height:36px;padding:4px 10px;font-size:.88rem}' +
    '.fork-legend{margin:0;font-size:.88rem;color:var(--muted)}.fork-legend b{color:var(--ink)}.fork-counts{display:grid;gap:8px}.fork-counts[hidden],.fork-ui [hidden]{display:none}' +
    '.fork-counts table caption{caption-side:top;text-align:left;font-weight:700;padding:6px 0}.fork-note{margin:0;font-size:.88rem;color:var(--muted)}' +
    '.scene-host canvas.fork-canvas{touch-action:pan-y;aspect-ratio:auto;margin-inline:auto;cursor:default}.scene-host.fork-portrait canvas.fork-canvas{max-width:520px}' +
    '.fork-counts table.data th,.fork-counts table.data td{white-space:normal}@media(max-width:560px){.fork-lbl{min-width:100%}.fork-counts table.data th,.fork-counts table.data td{padding:6px 5px;font-size:.8rem}}';

  function mount(host, api) {
    const L = api.logic;
    const canvas = host.querySelector('canvas'), desc = host.querySelector('.scene-desc');
    if (!canvas) throw new Error('fork scene needs a canvas');
    const ctx = canvas.getContext('2d');
    if (!document.getElementById('fork-scene-css')) { const st = document.createElement('style'); st.id = 'fork-scene-css'; st.textContent = CSS; document.head.appendChild(st); }
    canvas.classList.add('fork-canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'DNA fork model. A 24-letter piece of DNA is unwound, unzipped, and copied by pairing A with T and G with C. Correct new letters are green with a check mark; substitutions are red with a cross. Read the text description below the picture for the current state.');
    const reducedMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

    /* ---------- model state ---------- */
    let run = 0, plan = null, seed = 0;
    let sites = { top: 'e'.repeat(N), bottom: 'e'.repeat(N) };
    let steps = { unwound: false, unzipped: false };
    let p53 = { a: { tried: 0, removed: 0 }, b: { tried: 0, removed: 0 }, c: { tried: 0, removed: 0 } };
    let lastResult = '', held = null, busy = false, announced = '';
    const anim = { unwind: null, unzip: null, auto: null, fly: null, p53: null };
    const born = { top: [], bottom: [] };
    let now = performance.now(), raf = 0, visible = true, LY = null, hits = [], drag = null;

    function saltFor(r) { return r ? 'fork#' + r : 'fork'; }
    function newRun(r) {
      run = r; seed = api.seed(saltFor(r));
      plan = L.forkPlan(api.rng(saltFor(r)).uniform);
      sites = { top: 'e'.repeat(N), bottom: 'e'.repeat(N) };
      steps = { unwound: false, unzipped: false };
      p53 = { a: { tried: 0, removed: 0 }, b: { tried: 0, removed: 0 }, c: { tried: 0, removed: 0 } };
      lastResult = ''; held = null; busy = false;
      anim.unwind = anim.unzip = anim.auto = anim.fly = anim.p53 = null;
      born.top = []; born.bottom = [];
    }
    function restore() {
      const saved = api.getState().fork;
      const r = saved && Number.isInteger(saved.run) && saved.run >= 0 ? saved.run : 0;
      newRun(r);
      const pr = saved && saved.progress;
      if (!pr || pr.run !== r || !pr.sites || !L.sitesValid(pr.sites.top, plan, 'top') || !L.sitesValid(pr.sites.bottom, plan, 'bottom')) return;
      sites = { top: pr.sites.top, bottom: pr.sites.bottom };
      const any = /[^e]/.test(sites.top + sites.bottom);
      steps.unzipped = !!(saved.steps && saved.steps.unzipped) || any;
      steps.unwound = !!(saved.steps && saved.steps.unwound) || steps.unzipped;
      ['a', 'b', 'c'].forEach(v => { const p = saved.p53 && saved.p53[v] || {}; p53[v] = { tried: wholeNumber(p.tried), removed: wholeNumber(p.removed) }; });
    }
    function wholeNumber(n) { n = Number(n); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; }
    function manualDone(k) { const i = sites[k].indexOf('e'); return i < 0 ? N : Math.min(i, MANUAL); }
    function isPaired() { return !/e/.test(sites.top + sites.bottom); }
    function gaps(k) { return (sites[k].match(/x/g) || []).length; }
    function cnt(k) { return L.siteCounts(sites[k]); }
    function stage() {
      if (!steps.unwound) return 'wound';
      if (!steps.unzipped) return 'zipped';
      if (!isPaired()) return anim.auto || (manualDone('top') >= MANUAL && manualDone('bottom') >= MANUAL) ? 'auto' : 'pairing';
      const subs = cnt('top').substitutions + cnt('bottom').substitutions, gp = gaps('top') + gaps('bottom');
      if (!subs && !gp) return 'complete';
      return 'p53';
    }
    function triedAny() { return ['a', 'b', 'c'].some(v => p53[v].tried > 0); }
    function persist() {
      const z = { correct: 0, substitutions: 0 };
      const paired = isPaired();
      const before = paired ? { top: planCounts('top'), bottom: planCounts('bottom') } : { top: z, bottom: z };
      const showAfter = paired && p53.a.removed > 0 && !gaps('top') && !gaps('bottom');
      const after = showAfter ? { top: cnt('top'), bottom: cnt('bottom') } : { top: z, bottom: z };
      api.saveFork({ seed, run, steps: { unwound: steps.unwound, unzipped: steps.unzipped }, before, p53: JSON.parse(JSON.stringify(p53)), after,
        progress: { run, sites: { top: sites.top, bottom: sites.bottom } }, updatedAt: Date.now() });
    }
    function planCounts(k) { const s = plan.subs[k].filter(Boolean).length; return { correct: N - s, substitutions: s }; }

    /* ---------- text ---------- */
    function positions(k, ch) { const out = []; for (let i = 0; i < N; i++) if (sites[k][i] === ch) out.push(i + 1); return out; }
    function listNums(a) { return a.length === 1 ? 'letter ' + a[0] : 'letters ' + a.join(', '); }
    function strandLine(k) {
      const c = cnt(k), bad = positions(k, 'b'), gp = positions(k, 'x');
      let s = 'The ' + NAME[k] + ' has ' + c.correct + ' correct pair' + (c.correct === 1 ? '' : 's') + ' and ' + c.substitutions + ' substitution' + (c.substitutions === 1 ? '' : 's');
      if (bad.length) s += ' (' + listNums(bad) + '; marked with a red cross and the label mismatch)';
      if (gp.length) s += '; ' + (gp.length === 1 ? 'one gap is' : gp.length + ' gaps are') + ' waiting for a correct letter (' + listNums(gp) + ')';
      return s + '.';
    }
    function nextText() {
      const st = stage(), sel = held ? (held.kind === 'letter' ? 'letter ' + held.v + ' selected' : held.kind === 'p53' ? 'p53 (' + held.v + ') selected' : '') : '';
      if (st === 'wound') return 'Step 1 of 5 · Unwind. The DNA is wound into a bundle. Press “Unwind the DNA”, or click the light-blue center of the bundle.';
      if (st === 'zipped') return 'Step 2 of 5 · Unzip. Press “Add helicase”, or drag the helicase to the left end of the DNA. Helicase unzips the two strands, like a zipper.';
      if (st === 'pairing') return 'Step 3 of 5 · Pair the letters by hand: A goes with T and G goes with C. Top strand ' + manualDone('top') + ' of ' + MANUAL + ', bottom strand ' + manualDone('bottom') + ' of ' + MANUAL + '. Pick the partner for the letter at each arrow.' + (sel ? ' (' + sel + ': now click a strand.)' : '');
      if (st === 'auto') return 'Step 3 of 5 · The model speeds up and pairs the rest of the letters on its own. Watch for red letters.';
      if (st === 'complete') return 'Done. Both strands show 0 substitutions: two double strands, each with an old strand and a new strand that match. Use “Start over” to copy again (the model re-randomizes).';
      if (!triedAny()) return 'Step 4 of 5 · Count the substitutions. Red letters with a cross are substitutions. Your counts are in the table below. Then go on to step 5.';
      return 'Step 5 of 5 · Try p53. Add each version to each strand. Replace every letter that p53 removes with its correct partner until both strands show 0 substitutions.' + (sel ? ' (' + sel + ': now click a strand.)' : '');
    }
    function descText() {
      const st = stage(); let s = '';
      if (st === 'wound') s = 'The 24-letter piece of DNA is wound up in a spiral bundle. Letters cannot be read yet.';
      else if (st === 'zipped') s = 'The DNA is unwound into one double strand of 24 letter pairs, top letters A C G T paired with bottom letters. Helicase waits at the right; the left end of the DNA is where it goes.';
      else {
        s = 'The DNA is unzipped into two old strands. Old top strand: ' + plan.top.join('') + '. Old bottom strand: ' + plan.bottom.join('') + '. ';
        if (st === 'pairing') s += 'New partner letters are being placed: top strand ' + manualDone('top') + ' of ' + MANUAL + ' by hand, bottom strand ' + manualDone('bottom') + ' of ' + MANUAL + '.';
        else if (st === 'auto') s += 'The model is pairing the remaining letters automatically.';
        else s += strandLine('top') + ' ' + strandLine('bottom');
        if (st === 'complete') s += ' Both strands are copied correctly: two double strands.';
      }
      if (lastResult) s += ' Last p53 result: ' + lastResult;
      return s;
    }
    const ui = buildUI();
    function refresh(opts) {
      desc.textContent = descText();
      ui.next.textContent = nextText();
      const st = stage(), pairing = st === 'pairing', fixing = st === 'p53';
      ui.unwind.hidden = st !== 'wound'; ui.helicase.hidden = st !== 'zipped'; ui.actions.hidden = st !== 'wound' && st !== 'zipped';
      ['top', 'bottom'].forEach(k => {
        const row = ui.letters[k], gp = gaps(k) > 0;
        row.el.hidden = !(pairing || gp || (fixing && false));
        const active = pairing ? manualDone(k) < MANUAL : gp;
        row.btns.forEach(b => { b.disabled = !active; });
        row.status.textContent = pairing ? (active ? 'next: letter ' + (manualDone(k) + 1) : 'done (5 of 5)') : (gp ? 'replace the removed letter: letter ' + (sites[k].indexOf('x') + 1) : '');
      });
      ui.p53.el.hidden = !(st === 'p53' || st === 'complete');
      ui.counts.hidden = !isPaired();
      ui.result.hidden = !lastResult || !isPaired(); ui.result.textContent = lastResult ? 'Last p53 result: ' + lastResult : '';
      ui.reset.hidden = !steps.unwound;
      fillCounts();
      ui.hint.textContent = held ? 'Selected: ' + (held.kind === 'p53' ? 'p53 (' + held.v + ')' : 'letter ' + held.v) + '. Click a strand to drop it, or press Escape to cancel.' : '';
      fixFocus();
      draw();
      kick();
    }
    function fixFocus() {
      if (!lastFocus || ui.dialog.open) return;
      const a = document.activeElement;
      if (a && a !== document.body && host.contains(a) && !a.disabled && !a.closest('[hidden]')) return;
      if (a && a !== document.body && !host.contains(a)) return;
      const b = Array.from(ui.root.querySelectorAll('button')).find(x => !x.disabled && !x.closest('[hidden]'));
      if (b) b.focus();
    }
    let lastFocus = false;
    host.addEventListener('focusin', () => { lastFocus = true; });
    function say(text) { if (text) api.announce(text); }

    /* ---------- DOM controls ---------- */
    function buildUI() {
      const root = document.createElement('div'); root.className = 'fork-ui';
      const next = el('p', 'fork-next'); const hint = el('p', 'fork-hint');
      const actions = el('div', 'fork-actions'); actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', 'Model steps');
      const unwind = btn('Unwind the DNA', 'btn btn--primary'), helicase = btn('Add helicase to the left end', 'btn btn--primary');
      unwind.dataset.act = 'unwind'; helicase.dataset.act = 'helicase';
      actions.append(unwind, helicase);
      const letters = {};
      const lettersWrap = el('div'); lettersWrap.style.display = 'grid'; lettersWrap.style.gap = '6px';
      ['top', 'bottom'].forEach(k => {
        const e = el('div', 'fork-letters'); e.setAttribute('role', 'group'); e.setAttribute('aria-label', (k === 'top' ? 'Top' : 'Bottom') + ' strand: place the partner letter');
        const lbl = el('span', 'fork-lbl', (k === 'top' ? 'Top' : 'Bottom') + ' strand'); e.appendChild(lbl);
        const btns = 'ACGT'.split('').map(l => { const b = btn(l, 'btn'); b.setAttribute('aria-label', 'Place ' + l + ' on the ' + NAME[k]); b.dataset.letter = l; b.dataset.strand = k; e.appendChild(b); return b; });
        const status = el('span', 'small muted'); e.appendChild(status);
        lettersWrap.appendChild(e); letters[k] = { el: e, btns, status };
      });
      const p53el = el('div', 'fork-p53'); p53el.setAttribute('role', 'group'); p53el.setAttribute('aria-label', 'Try a version of p53 on a strand');
      ['a', 'b', 'c'].forEach(v => {
        const card = el('div', 'p53-card');
        card.appendChild(p53Svg(v));
        card.appendChild(el('span', 'p53-name', 'p53 (' + v + ')'));
        ['top', 'bottom'].forEach(k => { const b = btn(k === 'top' ? 'Top strand' : 'Bottom strand', 'btn btn--sm'); b.setAttribute('aria-label', 'Add p53 (' + v + ') to the ' + NAME[k]); b.dataset.p53 = v; b.dataset.strand = k; card.appendChild(b); });
        p53el.appendChild(card);
      });
      const result = el('p', 'fork-result'); result.style.cssText = 'margin:0;font-weight:600'; result.hidden = true;
      const counts = el('div', 'fork-counts');
      const tBefore = countTable('After pairing, before p53'), tAfter = countTable('After p53 and replacing letters');
      counts.append(tBefore.wrap, tAfter.wrap, el('p', 'fork-note', 'Simulated counts. Substitution rate = 100 × substitutions ÷ (correctly paired + substitutions). They also appear in “Your data from the DNA fork” below.'));
      const legend = el('p', 'fork-legend'); legend.innerHTML = '<b>✓ green</b> = correct pair (A with T, G with C) · <b>✕ red</b> = substitution (mismatch: the letter does not fit its partner) · dashed box = empty place or gap · arrow = next place to fill.';
      const model = el('p', 'fork-note'); model.textContent = 'This is a simplified model: it shows only one kind of copying difference, a swapped letter (a substitution). Real copying enzymes also proofread as they go, and real p53 does not pull letters out directly: it senses DNA damage and triggers repair, a pause in the cell cycle or cell death. Chromosome differences in cancer are more than single substitutions. Differences that are not fixed are copied into new cells, and some of those cells can become cancer cells, but cancer is not inevitable.';
      const reset = btn('Start over (new copy)', 'btn btn--sm'); const resetRow = el('div', 'row'); resetRow.appendChild(reset);
      const dialog = document.createElement('dialog'); dialog.className = 'reset-dialog'; dialog.setAttribute('aria-labelledby', 'fork-reset-title');
      dialog.innerHTML = '<h2 id="fork-reset-title">Start the DNA fork over?</h2><p>The model starts again with a fresh copy (new random mismatches). The counts you have so far in this model will be replaced. Your written answers stay.</p><div class="row"></div>';
      const cancel = btn('Cancel', 'btn'), ok = btn('Start over', 'btn btn--danger'); dialog.querySelector('.row').append(cancel, ok);
      root.append(next, hint, actions, lettersWrap, p53el, result, counts, legend, resetRow, model);
      desc.insertAdjacentElement('afterend', root);
      root.appendChild(dialog);
      unwind.addEventListener('click', doUnwind); helicase.addEventListener('click', doHelicase);
      lettersWrap.addEventListener('click', e => { const b = e.target.closest('button[data-letter]'); if (b && !b.disabled) doLetter(b.dataset.strand, b.dataset.letter); });
      p53el.addEventListener('click', e => { const b = e.target.closest('button[data-p53]'); if (b) doP53(b.dataset.p53, b.dataset.strand); });
      reset.addEventListener('click', () => { if (stage() === 'complete' || steps.unwound) { dialog.showModal(); cancel.focus(); } });
      cancel.addEventListener('click', () => dialog.close());
      ok.addEventListener('click', () => { dialog.close(); doReset(); });
      return { root, next, hint, actions, result, unwind, helicase, letters, p53: { el: p53el }, counts, reset, dialog, tBefore, tAfter };
    }
    function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function btn(text, cls) { const b = el('button', cls, text); b.type = 'button'; return b; }
    function p53Svg(v) {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 44 46'); s.setAttribute('width', '32'); s.setAttribute('height', '34'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', P53_PATH[v]); p.setAttribute('fill', 'var(' + P53_VAR[v] + ')'); p.setAttribute('stroke', 'var(--ink)'); p.setAttribute('stroke-width', '1.2'); p.setAttribute('stroke-linejoin', 'round'); s.appendChild(p); return s;
    }
    function countTable(caption) {
      const wrap = el('div', 'table-wrap'), t = el('table', 'data'); t.appendChild(el('caption', '', caption));
      const hr = el('tr'); ['Strand', 'Correctly paired', 'Substitutions', 'Substitution rate'].forEach(h => { const th = el('th', '', h); th.scope = 'col'; hr.appendChild(th); });
      const thead = el('thead'); thead.appendChild(hr); t.appendChild(thead);
      const tb = el('tbody'), cells = {};
      ['top', 'bottom'].forEach(k => { const tr = el('tr'); const th = el('th', '', k === 'top' ? 'Top strand' : 'Bottom strand'); th.scope = 'row'; tr.appendChild(th); cells[k] = ['c', 's', 'r'].map(() => { const td = el('td', 'num'); tr.appendChild(td); return td; }); tb.appendChild(tr); });
      t.appendChild(tb); wrap.appendChild(t); return { wrap, cells };
    }
    function fillCounts() {
      const paired = isPaired();
      const put = (tbl, c) => ['top', 'bottom'].forEach(k => { const x = c[k], r = L.substitutionRate(x.correct, x.substitutions); tbl.cells[k][0].textContent = x.correct; tbl.cells[k][1].textContent = x.substitutions; tbl.cells[k][2].textContent = r == null ? 'n/a' : r.toFixed(1) + '%'; });
      put(ui.tBefore, { top: planCounts('top'), bottom: planCounts('bottom') });
      ui.tBefore.wrap.hidden = !paired;
      const showAfter = paired && p53.a.removed > 0 && !gaps('top') && !gaps('bottom');
      put(ui.tAfter, { top: cnt('top'), bottom: cnt('bottom') });
      ui.tAfter.wrap.hidden = !showAfter;
    }

    /* ---------- actions ---------- */
    const dur = ms => reducedMQ.matches ? 0 : ms;
    function doUnwind() {
      if (busy || stage() !== 'wound') return;
      busy = true; announced = '';
      const d = dur(1000);
      if (!d) { finishUnwind(); return; }
      anim.unwind = { t0: performance.now(), dur: d }; refresh();
    }
    function finishUnwind() { anim.unwind = null; steps.unwound = true; busy = false; persist(); say('The DNA is unwound into one double strand of 24 letter pairs. Next, add helicase to the left end.'); refresh(); }
    function doHelicase() {
      if (busy || stage() !== 'zipped') return;
      busy = true;
      const d = dur(2400);
      if (!d) { finishUnzip(); return; }
      anim.unzip = { t0: performance.now(), dur: d }; refresh();
    }
    function finishUnzip() { anim.unzip = null; steps.unzipped = true; busy = false; persist(); say('Helicase unzipped the DNA into two old strands. Now pair letters by hand: five on the top strand and five on the bottom strand. A goes with T, G goes with C.'); refresh(); }
    function doLetter(k, letter) {
      if (busy || (stage() !== 'pairing' && stage() !== 'p53')) return;
      const pairing = stage() === 'pairing';
      const idx = pairing ? manualDone(k) : sites[k].indexOf('x');
      if (idx < 0 || (pairing && idx >= MANUAL)) return;
      const need = L.forkNeeded(plan, k)[idx], fits = letter === need;
      held = null; busy = true;
      const d = dur(520);
      const finish = () => {
        anim.fly = null; busy = false;
        if (fits) {
          const arr = sites[k].split(''); arr[idx] = 'g'; sites[k] = arr.join(''); born[k][idx] = performance.now();
          persist();
          if (pairing) {
            const m = manualDone(k);
            say(letter + ' pairs with ' + L.partnerOf(letter) + '. ' + (m < MANUAL ? 'The ' + NAME[k] + ' has ' + m + ' of ' + MANUAL + ' pairs.' : 'The ' + NAME[k] + ' has all ' + MANUAL + ' by-hand pairs.'));
            if (manualDone('top') >= MANUAL && manualDone('bottom') >= MANUAL) { startAuto(); return; }
          } else {
            const left = gaps('top') + gaps('bottom');
            say('Correct. ' + letter + ' fills the gap at ' + NAME[k] + ' letter ' + (idx + 1) + '. ' + (left ? left + ' gap' + (left === 1 ? '' : 's') + ' left.' : stage() === 'complete' ? 'Both strands now show 0 substitutions: two double strands.' : 'No gaps left.'));
          }
        } else say(letter + ' does not fit ' + (pairing ? 'the old letter here' : 'this gap') + '. The old letter is ' + (k === 'top' ? plan.top : plan.bottom)[idx] + ', which pairs with ' + need + '. Try again.');
        refresh();
      };
      if (!d) { finish(); return; }
      anim.fly = { t0: performance.now(), dur: d, strand: k, idx, letter, fits, finish }; refresh();
    }
    function startAuto() {
      busy = true;
      if (reducedMQ.matches) { for (let i = MANUAL; i < N; i++) autoStep(i); finishAuto(); return; }
      anim.auto = { t0: performance.now(), idx: MANUAL }; refresh();
    }
    function autoStep(i) {
      ['top', 'bottom'].forEach(k => { if (sites[k][i] === 'e') { const a = sites[k].split(''); a[i] = L.autoSite(plan, k, i); sites[k] = a.join(''); born[k][i] = performance.now(); } });
    }
    function finishAuto() {
      anim.auto = null; busy = false; persist();
      const t = cnt('top'), b = cnt('bottom');
      say('The model finished pairing. Top strand: ' + t.correct + ' correct, ' + t.substitutions + ' substitution' + (t.substitutions === 1 ? '' : 's') + '. Bottom strand: ' + b.correct + ' correct, ' + b.substitutions + ' substitution' + (b.substitutions === 1 ? '' : 's') + '. Red letters with a cross are substitutions.');
      refresh();
    }
    function doP53(v, k) {
      if (busy || stage() !== 'p53' || !P53_PATH[v] || !NAME[k]) return;
      const r = L.p53Apply(sites[k], v);
      held = null; busy = true;
      p53[v].tried++; if (r.removed) p53[v].removed++;
      const place = r.index >= 0 ? ' at ' + NAME[k] + ' letter ' + (r.index + 1) : '';
      lastResult = r.index < 0 ? 'p53 (' + v + ') on the ' + NAME[k] + ': no substitution there.' : r.fits ? 'p53 (' + v + ') fit the notch' + place + ' and removed the wrong letter.' : 'p53 (' + v + ') did not fit the notch' + place + '; nothing was removed.';
      const prev = sites[k]; sites[k] = r.sites;
      persist();
      const finish = () => {
        anim.p53 = null; busy = false;
        say(lastResult + (r.removed ? ' Replace it with the correct letter.' : ''));
        refresh();
      };
      const d = dur(1500);
      if (!d || r.index < 0) { finish(); return; }
      anim.p53 = { t0: performance.now(), dur: d, v, strand: k, idx: r.index, fits: r.fits, prev, finish }; refresh();
    }
    function doReset() { newRun(run + 1); persist(); say('The model is reset with a new copy. Step 1: unwind the DNA.'); refresh(); }

    /* ---------- layout ---------- */
    function layout() {
      const cssW = Math.floor(host.clientWidth);
      if (cssW < 40) return false;
      const wide = cssW >= 700;
      const o = wide
        ? { wide: true, W: 800, H: 392, cw: 28.5, x0: 100, bw: 25, bh: 32, D: 39, rows: { top: { t: [56], n: [95] }, bottom: { n: [297], t: [336] } }, yJ: [196], trayY: 196, font: 15, lab: 13, rail: 7, cols: 24 }
        : { wide: false, W: 340, H: 500, cw: 26.5, x0: 11, bw: 22, bh: 28, D: 35, rows: { top: { t: [40, 126], n: [75, 161] }, bottom: { n: [339, 425], t: [374, 460] } }, yJ: [135, 365], trayY: 250, font: 14, lab: 12, rail: 6, cols: 12 };
      const w = wide ? cssW : Math.min(cssW, 520), s = w / o.W;
      const dpr = window.devicePixelRatio || 1;
      o.s = s; o.cssW = w; o.cssH = Math.round(o.H * s); o.dpr = dpr;
      host.classList.toggle('fork-portrait', !wide);
      canvas.style.width = w + 'px'; canvas.style.height = o.cssH + 'px';
      const bw = Math.round(w * dpr), bh = Math.round(o.cssH * dpr);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      // wound bundle: 24 rungs along a flat spiral around the center
      const cx = o.W / 2, cy = wide ? 196 : 250, rungs = [];
      let th = 0, r = 48; const k = 9.5, arc = 25;
      for (let i = 0; i < N; i++) { rungs.push({ th, r, cx, cy }); const rr = r; th += arc / rr; r = 48 + k * th; }
      o.spiral = rungs; o.cx = cx; o.cy = cy;
      LY = o; return true;
    }
    const colOf = i => LY.wide ? i : i % LY.cols;
    const segOf = i => LY.wide ? 0 : Math.floor(i / LY.cols);
    const xOf = i => LY.x0 + LY.cw * (colOf(i) + 0.5);
    const rowY = (k, kind, i) => LY.rows[k][kind][segOf(i)];
    const joinY = (k, i) => LY.yJ[segOf(i)] + (k === 'top' ? -LY.D / 2 : LY.D / 2);
    const leftEnd = () => LY.wide ? { x: xOf(0) - LY.cw * 0.9 + 8, y: LY.yJ[0] } : { x: xOf(0), y: LY.yJ[0] };   // where helicase goes
    const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
    const lerp = (a, b, t) => a + (b - a) * t;
    function unwindT() { if (steps.unwound) return 1; return anim.unwind ? ease((now - anim.unwind.t0) / anim.unwind.dur) : 0; }
    function unzipU() { if (steps.unzipped) return 1; return anim.unzip ? Math.min(1, (now - anim.unzip.t0) / anim.unzip.dur) : 0; }
    const unzipS = (i, u) => ease(Math.max(0, Math.min(1, u * 1.5 - (i / (N - 1)) * 0.5)));
    // template cell position and drawing parameters (spiral -> straight -> unzipped)
    function tmplPoint(k, i) {
      const ut = unwindT(), u = unzipU(), s = unzipS(i, u);
      const lx = xOf(i), ly = lerp(joinY(k, i), rowY(k, 't', i), s);
      if (ut >= 1) return { x: lx, y: ly, rot: 0, sc: 1, th: 0 };
      const sp = LY.spiral[i], rr = sp.r + (k === 'top' ? 1 : -1) * (LY.wide ? 9 : 8);
      const px = sp.cx + Math.cos(sp.th) * rr, py = sp.cy + Math.sin(sp.th) * rr;
      return { x: lerp(px, lx, ut), y: lerp(py, ly, ut), rot: (k === 'top' ? sp.th + Math.PI / 2 : sp.th + Math.PI / 2) * (1 - ut), sc: lerp(0.34, 1, ut), th: sp.th, sp: true };
    }

    /* ---------- drawing ---------- */
    let C = null;
    function palette() {
      const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
      C = { bg: g('--surface-2') || '#e8eeea', surface: g('--surface') || '#fff', ink: g('--ink') || '#14211c', muted: g('--muted') || '#56665f', line: g('--line') || '#cfd9d3', accent: g('--accent') || '#0d6e55', accentSoft: g('--accent-soft') || '#d9efe6',
        ok: g('--ok') || '#1f7a3d', okSoft: g('--ok-soft') || '#dff1e4', bad: g('--bad') || '#b3261e', badSoft: g('--bad-soft') || '#f9e0de', warn: g('--warn') || '#9a5b00', warnSoft: g('--warn-soft') || '#fbedd5',
        s2: g('--s2'), s3: g('--s3'), stain: g('--stain'), mono: g('--f-mono') || 'ui-monospace, Menlo, monospace', body: g('--f-body') || 'system-ui, sans-serif', dark: document.documentElement.getAttribute('data-theme') === 'dark' || (document.documentElement.getAttribute('data-theme') !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) };
    }
    function featPts(f, hh) {   // right to left along the partner edge
      const out = [];
      if (f === 'tabTri') out.push([6, hh], [0, hh + 5.5], [-6, hh]);
      else if (f === 'sockTri') out.push([6, hh], [0, hh - 6.5], [-6, hh]);
      else { const sg = f === 'tabRound' ? 1 : -1; for (let a = 0; a <= 6; a++) { const t = a / 6 * Math.PI; out.push([Math.cos(t) * 5.5, hh + sg * Math.sin(t) * (sg > 0 ? 5.5 : 6.5)]); } }
      return out;
    }
    function bodyPath(w, h, face, feat, notch) {
      const hw = w / 2, hh = h / 2, r = 4, V = [];
      V.push([-hw, -hh, r]);
      if (notch) V.push([-4.5, -hh, 0], [0, -hh + 9, 0], [4.5, -hh, 0]);
      V.push([hw, -hh, r], [hw, hh, r]);
      if (feat) featPts(feat, hh).forEach(p => V.push([p[0], p[1], 0]));
      V.push([-hw, hh, r]);
      V.forEach(v => { v[1] *= face; });
      const n = V.length;
      ctx.beginPath(); ctx.moveTo((V[n - 1][0] + V[0][0]) / 2, (V[n - 1][1] + V[0][1]) / 2);
      for (let i = 0; i < n; i++) { const v = V[i], nx = V[(i + 1) % n]; if (v[2] > 0) ctx.arcTo(v[0], v[1], (v[0] + nx[0]) / 2, (v[1] + nx[1]) / 2, v[2]); else ctx.lineTo(v[0], v[1]); }
      ctx.closePath();
    }
    function badge(x, y, kind) {
      ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = kind === 'ok' ? C.ok : C.bad; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = C.dark ? '#0f1613' : '#ffffff'; ctx.stroke();
      ctx.beginPath(); ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.strokeStyle = C.dark ? '#0f1613' : '#ffffff';
      if (kind === 'ok') { ctx.moveTo(-2.4, 0.2); ctx.lineTo(-0.6, 2.1); ctx.lineTo(2.6, -2); } else { ctx.moveTo(-2.2, -2.2); ctx.lineTo(2.2, 2.2); ctx.moveTo(2.2, -2.2); ctx.lineTo(-2.2, 2.2); }
      ctx.stroke(); ctx.restore();
    }
    // One base: mode 'tmpl' | 'good' | 'bad' | 'tok'; face = which side its partner is on (+1 below, -1 above)
    function cell(x, y, o) {
      ctx.save(); ctx.translate(x, y);
      if (o.rot) ctx.rotate(o.rot);
      if (o.sc != null && o.sc !== 1) ctx.scale(o.sc, o.sc);
      if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      const m = o.mode, bad = m === 'bad', face = o.face;
      if (bad) { ctx.translate(0, -face * 5); ctx.rotate(0.07 * (o.i % 2 ? 1 : -1)); }
      bodyPath(LY.bw, LY.bh, face, FEATURE[o.letter], bad && o.notch !== false);
      ctx.fillStyle = m === 'good' ? C.okSoft : bad ? C.badSoft : m === 'tok' ? C.accentSoft : C.surface;
      ctx.strokeStyle = m === 'good' ? C.ok : bad ? C.bad : C.accent; ctx.lineWidth = bad ? 2 : 1.6;
      ctx.fill(); ctx.stroke();
      if (o.sel) { ctx.lineWidth = 3.2; ctx.strokeStyle = C.ink; ctx.stroke(); }
      if (o.showLetter !== false) { ctx.fillStyle = C.ink; ctx.font = '700 ' + LY.font + 'px ' + C.mono; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.letter, 0, 1.5 * face * 0 + 1); }
      if (m === 'good') badge(LY.bw / 2 - 3, -face * (LY.bh / 2 - 4.5), 'ok');
      if (bad) badge(LY.bw / 2 - 3, -face * (LY.bh / 2 - 4.5), 'bad');
      ctx.restore();
    }
    function slot(x, y, face, arrow) {
      ctx.save(); ctx.translate(x, y);
      bodyPath(LY.bw, LY.bh, face, null, false); ctx.setLineDash([4, 3]); ctx.lineWidth = 1.4; ctx.strokeStyle = arrow ? C.warn : C.muted; ctx.globalAlpha = arrow ? 1 : 0.55; ctx.stroke(); ctx.setLineDash([]);
      if (arrow) {   // an arrow on the tray side pointing into the empty place
        const out = -face, pulse = reducedMQ.matches ? 0 : Math.sin(now / 260) * 2.5;
        const tip = out * (LY.bh / 2 + 4 + pulse), baseY = out * (LY.bh / 2 + 17 + pulse);
        ctx.globalAlpha = 1; ctx.fillStyle = C.warn;
        ctx.beginPath(); ctx.moveTo(0, tip); ctx.lineTo(-6, baseY); ctx.lineTo(6, baseY); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    function rail(points, outward, col, off) {
      if (points.length < 1) return;
      const pts = points.map(p => ({ x: p.x + (p.ox || 0), y: p.y + (p.oy != null ? p.oy : outward * off) }));
      const draw = (w, c, dy) => { ctx.beginPath(); pts.forEach((p, j) => { if (j) ctx.lineTo(p.x, p.y + dy); else ctx.moveTo(p.x, p.y + dy); }); ctx.lineWidth = w; ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); };
      if (pts.length === 1) { pts.push({ x: pts[0].x + 0.01, y: pts[0].y }); }
      ctx.save(); ctx.globalAlpha *= 0.95;
      draw(LY.rail - 0.5, col, 0); draw(2, C.dark ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.6)', -1.4);
      ctx.restore();
    }
    function helix(x, y, sc, alpha, label) {   // helicase: a ring of six subunits with a wedge that opens the strands
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.globalAlpha *= alpha;
      for (let a = 0; a < 6; a++) { const t = a * Math.PI / 3; ctx.beginPath(); ctx.arc(Math.cos(t) * 13, Math.sin(t) * 13, 8, 0, Math.PI * 2); ctx.fillStyle = C.s3; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = C.ink; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fillStyle = C.bg; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, -9); ctx.lineTo(30, 0); ctx.lineTo(8, 9); ctx.closePath(); ctx.fillStyle = C.s3; ctx.fill(); ctx.stroke();
      ctx.restore();
      return { x, y };
    }
    function p53Shape(v, x, y, flip, sc, alpha, sel) {   // flip -1: foot points up
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, flip * sc); ctx.translate(-22, -23); ctx.globalAlpha *= alpha == null ? 1 : alpha;
      const p = new Path2D(P53_PATH[v]); ctx.fillStyle = C[P53_VAR[v] === '--s2' ? 's2' : P53_VAR[v] === '--s3' ? 's3' : 'stain']; ctx.fill(p);
      ctx.lineWidth = (sel ? 3 : 1.4) / sc; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke(p);
      ctx.restore();
    }
    function label(txt, x, y, o) {
      o = o || {};
      ctx.save(); ctx.font = (o.weight || 600) + ' ' + (o.size || LY.lab) + 'px ' + C.body; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle';
      if (o.halo !== false) { ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = C.bg; ctx.strokeText(txt, x, y); }
      ctx.fillStyle = o.color || C.ink; ctx.fillText(txt, x, y); ctx.restore();
    }
    function callout(txt, ax, ay, lx, ly, color, later) {   // leader line from a label to the exact anchor point, with a dot on the anchor
      const sgn = ly < ay ? 1 : -1;
      ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(lx, ly + sgn * 8); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.beginPath(); ctx.arc(ax, ay, 2.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (later) later.push(() => label(txt, lx, ly, { align: 'center', color: C.ink })); else label(txt, lx, ly, { align: 'center', color: C.ink });
    }

    function siteChar(k, i) {
      const a = anim.p53;
      if (a && a.strand === k && a.idx === i && a.prev && now - a.t0 < a.dur * 0.62) return 'b';
      return sites[k][i];
    }
    function draw() {
      if (!LY && !layout()) return;
      palette();
      const s = LY.s, dpr = LY.dpr;
      ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
      ctx.clearRect(0, 0, LY.W, LY.H);
      hits = [];
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, LY.W, LY.H);
      // faint lab-bench dot grid
      ctx.fillStyle = C.dark ? 'rgba(255,255,255,.05)' : 'rgba(20,33,28,.06)';
      for (let gx = 12; gx < LY.W; gx += 24) for (let gy = 12; gy < LY.H; gy += 24) ctx.fillRect(gx, gy, 1.4, 1.4);
      const st = stage(), ut = unwindT(), u = unzipU(), unzipped = steps.unzipped || !!anim.unzip;
      const o = LY;
      // ----- template strands and (when present) new strands, per strand
      const tPts = { top: [], bottom: [] };
      for (let i = 0; i < N; i++) ['top', 'bottom'].forEach(k => tPts[k].push(tmplPoint(k, i)));
      ['top', 'bottom'].forEach(k => {
        const face = k === 'top' ? 1 : -1, off = o.bh / 2 + o.rail + 1;
        // rails (sugar-phosphate backbone) per row segment
        for (let g = 0; g < (o.wide ? 1 : 2); g++) {
          const idxs = []; for (let i = 0; i < N; i++) if (segOf(i) === g) idxs.push(i);
          const pts = idxs.map(i => { const p = tPts[k][i]; if (p.sp && ut < 1) { const dir = (k === 'top' ? 1 : -1); return { x: p.x + Math.cos(p.th) * dir * 9 * (1 - ut) * p.sc, y: p.y + Math.sin(p.th) * dir * 9 * (1 - ut) * p.sc + (-face * off) * ut }; } return { x: p.x, y: p.y - face * off }; });
          rail(pts.map(p => ({ x: p.x, y: p.y, oy: 0 })), 0, C.accent, 0);
        }
      });
      // hydrogen bonds between the two old strands while they are still joined
      if (!(u >= 1)) {
        for (let i = 0; i < N; i++) {
          const s0 = steps.unzipped ? 1 : unzipS(i, u), a = tPts.top[i], b = tPts.bottom[i];
          if (s0 >= 1 || ut < 0.5) continue;
          ctx.save(); ctx.globalAlpha = (1 - s0) * Math.min(1, (ut - 0.5) * 2); ctx.strokeStyle = C.muted; ctx.lineWidth = 1.6; ctx.setLineDash([2, 3]);
          const n = plan.top[i] === 'G' || plan.top[i] === 'C' ? 3 : 2;
          for (let q = 0; q < n; q++) { const bx = a.x + (q - (n - 1) / 2) * 7.5 + (n === 2 ? 0 : 0); ctx.beginPath(); ctx.moveTo(bx, a.y + o.bh / 2 + 3); ctx.lineTo(bx, b.y - o.bh / 2 - 3); ctx.stroke(); }
          ctx.restore();
        }
      }
      // new strands: rails, empty places, cells, bonds
      if (unzipped && u >= 0.999 || steps.unzipped) {
        ['top', 'bottom'].forEach(k => {
          const face = k === 'top' ? -1 : 1, tface = -face;
          for (let g = 0; g < (o.wide ? 1 : 2); g++) {
            let run = [];
            const flush = () => { if (run.length) rail(run, 0, C.ok, 0); run = []; };
            for (let i = 0; i < N; i++) {
              if (segOf(i) !== g) continue;
              const ch = siteChar(k, i), y = rowY(k, 'n', i);
              if (ch === 'g' || ch === 'b') run.push({ x: xOf(i), y: y - face * (o.bh / 2 + o.rail + 1), oy: 0, bad: ch === 'b' });
              else flush();
            }
            flush();
          }
          for (let i = 0; i < N; i++) {
            const ch = siteChar(k, i), x = xOf(i), y = rowY(k, 'n', i), need = L.forkNeeded(plan, k)[i];
            const bt = born[k][i], age = bt ? now - bt : 999, grow = reducedMQ.matches ? 1 : Math.min(1, age / 260);
            const pop = grow < 1 ? 0.55 + 0.45 * (1 - Math.pow(1 - grow, 3)) : 1;
            if (ch === 'e') { slot(x, y, face, false); continue; }
            if (ch === 'x') { slot(x, y, face, false); continue; }
            // hydrogen bonds between old letter and new letter (2 for A-T, 3 for G-C); none at a substitution
            if (ch === 'g') {
              const tx = (k === 'top' ? plan.top : plan.bottom)[i], n = tx === 'G' || tx === 'C' ? 3 : 2;
              ctx.save(); ctx.fillStyle = C.muted; ctx.globalAlpha = grow;
              const ym = (rowY(k, 't', i) + y) / 2;
              for (let q = 0; q < n; q++) { const bx = x + (n === 2 ? (q ? 9.5 : -9.5) : (q - 1) * 9.5 + (q === 1 ? 0 : 0)); if (n === 3 && q === 1) continue; ctx.beginPath(); ctx.arc(bx, ym, 1.7, 0, Math.PI * 2); ctx.fill(); }
              ctx.restore();
            }
            cell(x, y, { letter: ch === 'b' ? plan.subs[k][i] : need, face, mode: ch === 'g' ? 'good' : 'bad', sc: pop, alpha: Math.min(1, grow * 1.4), i });
          }
        });
      }
      // template cells
      for (let i = 0; i < N; i++) ['top', 'bottom'].forEach(k => {
        const p = tPts[k][i], face = k === 'top' ? 1 : -1, letter = (k === 'top' ? plan.top : plan.bottom)[i];
        cell(p.x, p.y, { letter, face, mode: 'tmpl', rot: p.rot, sc: p.sc, showLetter: ut > 0.45, alpha: 1, i });
      });
      // ----- row labels
      if (o.wide && ut >= 1) {
        if (steps.unzipped) {
          label('Old strand', 12, rowY('top', 't', 0), { weight: 700 }); label('New strand', 12, rowY('top', 'n', 0), { weight: 700 });
          label('New strand', 12, rowY('bottom', 'n', 0), { weight: 700 }); label('Old strand', 12, rowY('bottom', 't', 0), { weight: 700 });
        } else label('Old DNA', 12, o.yJ[0], { weight: 700 });
      }
      if (!o.wide && ut >= 1 && steps.unzipped) {
        label('Top copy: old strand above, new strand below', o.W / 2, 12, { align: 'center', color: C.muted });
        label('Bottom copy: new strand above, old strand below', o.W / 2, o.H - 10, { align: 'center', color: C.muted });
      }
      // ----- wound bundle: the center is the "unwind" control
      if (st === 'wound' || anim.unwind) {
        const a = 1 - ut;
        if (a > 0.02) {
          ctx.save(); ctx.globalAlpha = a;
          const pulse = reducedMQ.matches ? 0 : (Math.sin(now / 300) + 1) / 2;
          ctx.beginPath(); ctx.arc(o.cx, o.cy, 19 + pulse * 3, 0, Math.PI * 2); ctx.fillStyle = C.dark ? '#2a6fa0' : '#9fd6f2'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.s3; ctx.stroke();
          ctx.beginPath(); ctx.arc(o.cx, o.cy, 26 + pulse * 5, 0, Math.PI * 2); ctx.globalAlpha = a * 0.5; ctx.lineWidth = 1.6; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
          ctx.restore();
          if (st === 'wound') hits.push({ kind: 'bundle', x: o.cx, y: o.cy, w: 60, h: 60 });
          if (st === 'wound') { callout('Click here to unwind', o.cx, o.cy - 22, o.cx, o.cy - (o.wide ? 150 : 150), C.s3); }
          label('24-letter DNA, wound up', o.W / 2, o.H - 14, { align: 'center', color: C.muted });
        }
      }
      // ----- helicase
      if (st === 'zipped' || anim.unzip) {
        const left = leftEnd();
        let hx, hy, sc = 1;
        if (anim.unzip) { const f = u * (N - 1), f0 = Math.floor(f), f1 = Math.min(N - 1, f0 + 1); hx = segOf(f0) === segOf(f1) ? lerp(xOf(f0), xOf(f1), f - f0) : xOf(f0); hy = o.yJ[segOf(f0)]; hx -= o.cw * 0.2; }
        else if (drag && drag.item.kind === 'helicase') { hx = drag.x; hy = drag.y; }
        else { hx = o.wide ? o.W - 70 : o.W / 2; hy = o.wide ? 300 : o.trayY; }
        if (!anim.unzip) {
          // target ring on the left end
          const pulse = reducedMQ.matches ? 0 : (Math.sin(now / 280) + 1) / 2;
          ctx.save(); ctx.strokeStyle = C.warn; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(left.x, left.y, 22 + pulse * 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
          if (o.wide) callout('Left end: drop helicase here', left.x, left.y - 22, left.x + 40, left.y - 72, C.warn);
          else callout('Left end', left.x, left.y - 22, left.x + 34, left.y - 62, C.warn);
        }
        const hp = helix(hx, hy, 0.95, 1);
        if (!anim.unzip) {
          hits.push({ kind: 'helicase', x: hx, y: hy, w: 56, h: 56 });
          callout('helicase', hx - 6, hy + 14, hx - 6, hy + 44, C.s3);
        } else callout('helicase', hx - 4, hy - 14, hx + 30, hy - 56, C.s3);
        void hp;
      }
      // ----- tray: letter tokens and p53 tokens
      if (steps.unzipped) {
        const letterNeeded = st === 'pairing' || (st === 'p53' && (gaps('top') + gaps('bottom') > 0));
        const showP53 = st === 'p53' || st === 'complete';
        const ty = o.trayY;
        if (st === 'pairing' || letterNeeded) {
          const baseX = (showP53 ? o.W * (o.wide ? 0.70 : 0.72) : o.W / 2), gapx = o.wide ? 46 : 33;
          'ACGT'.split('').forEach((l, q) => {
            const x = baseX + (q - 1.5) * gapx, y = ty - 4, isHeld = held && held.kind === 'letter' && held.v === l;
            let px = x, py = y; if (drag && drag.item.kind === 'letter' && drag.item.v === l) { px = drag.x; py = drag.y; }
            cell(px, py, { letter: l, face: -1, mode: 'tok', sel: isHeld, i: q });
            hits.push({ kind: 'letter', v: l, x: x, y: y, w: Math.max(30, o.bw + 8), h: o.bh + 8 });
          });
          // red arrows (warn colour + arrow shape + dashed box) at the next place on each strand are drawn with the new strand slots below
        }
        if (showP53) {
          const baseX = (letterNeeded ? o.W * (o.wide ? 0.27 : 0.25) : o.W / 2), gapx = o.wide ? 82 : 58;
          ['a', 'b', 'c'].forEach((v, q) => {
            const x = baseX + (q - 1) * gapx, y = ty - 2, isHeld = held && held.kind === 'p53' && held.v === v;
            let px = x, py = y; if (drag && drag.item.kind === 'p53' && drag.item.v === v) { px = drag.x; py = drag.y; }
            p53Shape(v, px, py, 1, 0.78, 1, isHeld);
            label('p53 (' + v + ')', x, ty + 26, { align: 'center', weight: 700 });
            hits.push({ kind: 'p53', v, x, y: y, w: 44, h: 52 });
          });
        }
        // arrows at next places
        if (st === 'pairing') ['top', 'bottom'].forEach(k => { const m = manualDone(k); if (m < MANUAL && !(anim.fly && anim.fly.strand === k)) slot(xOf(m), rowY(k, 'n', m), k === 'top' ? -1 : 1, true); });
        if (st === 'p53') ['top', 'bottom'].forEach(k => { const g = sites[k].indexOf('x'); if (g >= 0 && !(anim.fly && anim.fly.strand === k)) slot(xOf(g), rowY(k, 'n', g), k === 'top' ? -1 : 1, true); });
        // result / banner text in the tray
        const msg = st === 'complete' ? '✓ Copy complete: two double strands, 0 substitutions' : '';
        if (msg) {
          const words = msg, maxW = o.W - (o.wide ? 120 : 24);
          ctx.save(); ctx.font = '600 ' + o.lab + 'px ' + C.body;
          const lines = wrapText(words, maxW); ctx.restore();
          lines.forEach((ln, q) => label(ln, o.W / 2, ty + (o.wide ? 50 : 42) + q * (o.lab + 3), { align: 'center', color: st === 'complete' ? C.ok : C.ink }));
        }
        // callouts for every substitution (wide board: room next to the strand; labels are placed in two lanes so they never overlap)
        if (o.wide && (st === 'p53' || st === 'complete' || st === 'auto' || st === 'pairing') && !anim.auto) {
          ctx.save(); ctx.font = '600 ' + o.lab + 'px ' + C.body; const later = [];
          ['top', 'bottom'].forEach(k => {
            const out = k === 'top' ? 1 : -1, lanes = [[], []];
            for (let i = 0; i < N; i++) {
              if (sites[k][i] !== 'b' || (anim.p53 && anim.p53.strand === k && anim.p53.idx === i)) continue;
              const x = xOf(i), ny = rowY(k, 'n', i), first = !lanes[0].length && !lanes[1].length;
              const txt = first ? 'mismatch ✕: ' + plan.subs[k][i] + ' does not pair with ' + (k === 'top' ? plan.top : plan.bottom)[i] : 'mismatch ✕';
              const w = ctx.measureText(txt).width + 12, lx = Math.max(w / 2 + 4, Math.min(o.W - w / 2 - 4, x));
              const lane = lanes.findIndex(l => l.every(iv => lx - w / 2 > iv[1] || lx + w / 2 < iv[0])); if (lane < 0) continue;
              lanes[lane].push([lx - w / 2, lx + w / 2]);
              ctx.save(); callout(txt, x, ny + out * (o.bh / 2 + 5), lx, ny + out * (o.bh / 2 + 27 + lane * 16), C.bad, later); ctx.restore();
            }
          });
          later.forEach(f => f());
          ctx.restore();
        }
        // phone board: no room beside the strands, so one text line in the tray names every substitution
        if (!o.wide && (st === 'p53' || st === 'complete') && (cnt('top').substitutions + cnt('bottom').substitutions) > 0) {
          const part = k => { const p = positions(k, 'b'); return p.length ? (k === 'top' ? 'top ' : 'bottom ') + p.join(', ') : ''; };
          ctx.save(); ctx.font = '700 ' + o.lab + 'px ' + C.body;
          const cap = wrapText('✕ mismatch at ' + [part('top'), part('bottom')].filter(Boolean).join(' · '), o.W - 24); ctx.restore();
          cap.forEach((ln, q) => label(ln, o.W / 2, ty - 54 - (cap.length - 1 - q) * (o.lab + 3), { align: 'center', color: C.bad, weight: 700 }));
        }
      }
      // ----- flying letter and p53 animations
      if (anim.fly) {
        const f = anim.fly, t = Math.min(1, (now - f.t0) / f.dur), e = ease(t < 0.7 ? t / 0.7 : 1);
        const tok = hits.find(h => h.kind === 'letter' && h.v === f.letter), tx = xOf(f.idx), ty2 = rowY(f.strand, 'n', f.idx), bx = tok ? tok.x : o.W / 2, by = tok ? tok.y : o.trayY;
        let x = lerp(bx, tx, e), y = lerp(by, ty2, e);
        if (!f.fits && t > 0.7) { const q = (t - 0.7) / 0.3; x = tx + Math.sin(q * Math.PI * 4) * 4 * (1 - q); y = lerp(ty2, by, ease(q)); x = lerp(x, bx, ease(q)); }
        cell(x, y, { letter: f.letter, face: f.strand === 'top' ? -1 : 1, mode: 'tok', i: 0 });
      }
      if (anim.p53) drawP53Anim();
      // keep the label of the wound state readable
      if (!isPaired() && steps.unzipped && st !== 'auto' && !o.wide) { /* phone board keeps the prompt in the text above the picture */ }
    }
    function wrapText(txt, maxW) {
      const words = txt.split(' '), lines = []; let cur = '';
      words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
      if (cur) lines.push(cur); return lines;
    }
    function drawP53Anim() {
      const a = anim.p53, o = LY, t = Math.min(1, (now - a.t0) / a.dur), top = a.strand === 'top', flip = top ? -1 : 1, out = top ? 1 : -1;
      const tx = xOf(a.idx), ny = rowY(a.strand, 'n', a.idx);
      const dockY = ny + out * (o.bh / 2 + 13), appY = dockY + out * 24, bump = dockY + out * 5;   // the foot's tip meets the notch at dockY
      const tok = hits.find(h => h.kind === 'p53' && h.v === a.v), sx = tok ? tok.x : o.W / 2, sy = tok ? tok.y : o.trayY - 2;
      let x, y;
      if (t < 0.45) { const e = ease(t / 0.45); x = lerp(sx, tx, e); y = lerp(sy, appY, e); }
      else if (t < 0.62) { const e = ease((t - 0.45) / 0.17); x = tx; y = lerp(appY, a.fits ? dockY : bump, e); }
      else if (t < 0.8) { const e = (t - 0.62) / 0.18; x = tx + (a.fits ? 0 : Math.sin(e * Math.PI * 5) * 3); y = a.fits ? dockY : lerp(bump, appY, ease(e)); }
      else { const e = ease((t - 0.8) / 0.2); x = lerp(tx, sx, e); y = lerp(a.fits ? dockY : appY, sy, e); }
      p53Shape(a.v, x, y, flip, 0.78, 1, false);
      label('p53 (' + a.v + ')', Math.min(o.W - 60, x + 26), y, { weight: 700 });
      if (a.fits && t >= 0.62 && t < 0.95) {   // the removed letter drifts sideways and fades
        const e = (t - 0.62) / 0.33;
        cell(tx + (a.idx % 2 ? 1 : -1) * e * 30, ny - out * 0 + out * e * 6, { letter: plan.subs[a.strand][a.idx], face: -out, mode: 'bad', alpha: 1 - e, sc: 1 - 0.3 * e, i: a.idx, notch: false });
      }
      if (!a.fits && t >= 0.62) label('does not fit ✕', x, y + out * 30, { align: 'center', color: C.bad, weight: 700 });
    }

    /* ---------- frame loop ---------- */
    function tick() {
      if (anim.unwind && now >= anim.unwind.t0 + anim.unwind.dur) finishUnwind();
      if (anim.unzip && now >= anim.unzip.t0 + anim.unzip.dur) finishUnzip();
      if (anim.fly && now >= anim.fly.t0 + anim.fly.dur) anim.fly.finish();
      if (anim.p53 && now >= anim.p53.t0 + anim.p53.dur) anim.p53.finish();
      if (anim.auto) {
        const a = anim.auto, due = MANUAL + Math.floor((now - a.t0) / 150);
        while (a.idx < N && a.idx <= due) { autoStep(a.idx); a.idx++; }
        if (a.idx >= N && now - a.t0 > (N - MANUAL) * 150 + 280) finishAuto();
      }
    }
    function needsFrame() {
      if (!visible || document.hidden) return false;
      if (busy || anim.unwind || anim.unzip || anim.auto || anim.fly || anim.p53) return true;
      if (!reducedMQ.matches) { const st = stage(); if (st === 'wound' || st === 'zipped' || st === 'pairing' || (st === 'p53' && gaps('top') + gaps('bottom') > 0)) return true; }
      for (const k of ['top', 'bottom']) for (let i = 0; i < N; i++) if (born[k][i] && now - born[k][i] < 320) return true;
      return false;
    }
    function frame(t) { raf = 0; now = t; tick(); draw(); if (needsFrame()) raf = requestAnimationFrame(frame); }
    function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

    /* ---------- pointer input on the canvas ---------- */
    function toLogical(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * LY.W, y: (e.clientY - r.top) / r.height * LY.H }; }
    function hitAt(p) { for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (Math.abs(p.x - h.x) <= h.w / 2 && Math.abs(p.y - h.y) <= h.h / 2) return h; } return null; }
    function zoneStrand(p) { return p.y < LY.trayY ? 'top' : 'bottom'; }
    function dropHeld(item, p, wasDrag) {
      const st = stage();
      if (item.kind === 'bundle') { doUnwind(); return; }
      if (item.kind === 'helicase') {
        const left = leftEnd();
        if (!wasDrag || Math.hypot(p.x - left.x, p.y - left.y) < 70) doHelicase(); else say('Drop the helicase on the left end of the DNA, or press Add helicase.');
        return;
      }
      if (item.kind === 'letter') {
        if (st === 'pairing') {
          const need = ['top', 'bottom'].filter(k => manualDone(k) < MANUAL);
          if (need.length === 1) { doLetter(need[0], item.v); return; }
          if (wasDrag) doLetter(zoneStrand(p), item.v); else { held = item; refresh(); }
        } else if (st === 'p53') {
          const need = ['top', 'bottom'].filter(k => gaps(k) > 0);
          if (need.length === 1) doLetter(need[0], item.v); else if (need.length) { if (wasDrag) doLetter(zoneStrand(p), item.v); else { held = item; refresh(); } }
        }
        return;
      }
      if (item.kind === 'p53') { if (wasDrag) doP53(item.v, zoneStrand(p)); else { held = item; refresh(); } }
    }
    canvas.addEventListener('pointerdown', e => {
      if (!LY || e.button > 0) return;
      const p = toLogical(e), h = hitAt(p);
      if (!h) {
        if (held && !busy) {
          const it = held, k = zoneStrand(p); held = null;
          if (it.kind === 'letter') doLetter(k, it.v); else if (it.kind === 'p53') doP53(it.v, k);
          refresh();
        }
        return;
      }
      if (busy) return;
      drag = { item: h, sx: p.x, sy: p.y, x: p.x, y: p.y, moved: false, id: e.pointerId };
      try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      draw();
    });
    canvas.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = toLogical(e); drag.x = p.x; drag.y = p.y;
      if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) drag.moved = true;
      if (drag.moved) { canvas.style.cursor = 'grabbing'; draw(); }
    });
    function endDrag(e, cancel) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const d = drag; drag = null; canvas.style.cursor = '';
      if (cancel) { draw(); return; }
      const p = e ? toLogical(e) : { x: d.x, y: d.y };
      dropHeld(d.item, p, d.moved);
      draw();
    }
    canvas.addEventListener('pointerup', e => endDrag(e, false));
    canvas.addEventListener('pointercancel', e => endDrag(e, true));
    canvas.addEventListener('pointermove', e => { if (drag) return; if (LY && !busy) { const h = hitAt(toLogical(e)); canvas.style.cursor = h ? 'grab' : (held ? 'copy' : ''); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && held) { held = null; refresh(); } });

    /* ---------- sizing, visibility, theme ---------- */
    function relayout() { LY = null; if (layout()) { draw(); kick(); } }
    if (window.ResizeObserver) new ResizeObserver(() => relayout()).observe(host); else window.addEventListener('resize', relayout);
    if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es.some(x => x.isIntersecting); if (visible) { now = performance.now(); draw(); kick(); } }, { rootMargin: '100px' }).observe(canvas);
    document.addEventListener('companion:show', () => requestAnimationFrame(relayout));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    new MutationObserver(() => draw()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.matchMedia) { const m = matchMedia('(prefers-color-scheme: dark)'); if (m.addEventListener) m.addEventListener('change', () => draw()); }
    if (reducedMQ.addEventListener) reducedMQ.addEventListener('change', () => { kick(); draw(); });

    /* ---------- start ---------- */
    restore();
    // Read-only view of the model for the browser tests (nothing here changes the model).
    window.B3DnaForkScene = {
      state: () => JSON.parse(JSON.stringify({ run, seed, plan, sites, steps, p53, stage: stage(), busy })),
      layout: () => LY ? { wide: LY.wide, s: LY.s, font: LY.font, lab: LY.lab, W: LY.W, H: LY.H, cssW: LY.cssW, cssH: LY.cssH, trayY: LY.trayY } : null,
      hits: () => hits.map(h => Object.assign({}, h)),
      sitePoint: (k, i) => ({ x: xOf(i), y: rowY(k, 'n', i) })
    };
    if (isPaired() === false && steps.unzipped && manualDone('top') >= MANUAL && manualDone('bottom') >= MANUAL) startAuto();   // resume an interrupted automatic pairing
    refresh();
    relayout();
  }
})();
