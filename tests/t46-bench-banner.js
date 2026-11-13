/* Lab-bench banner on index.html: canvas scene draws, completed labs change their equipment, text stays readable, phones crop gracefully.
   Run: NODE_PATH=$(npm root -g) node tests/t46-bench-banner.js  (OUT=dir keeps screenshots) */
const T = require('./_h');
const OUT = process.env.OUT || '';
const prog = n => ['aplab:progress:lab' + String(n).padStart(2, '0'), JSON.stringify({ done: 5, total: 5, sections: 7, items: { done: 9, total: 9 }, partial: null, t: Date.now() })];
const ALL = Array.from({ length: 13 }, (_, i) => i + 1);

/* Pixel signature of a region of the bench canvas. */
const sig = async (p, r) => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250); return sig0(p, r); };
const sig0 = (p, r) => p.evaluate(r => { const c = document.getElementById('bench-scene'), k = c.width / c.getBoundingClientRect().width; const d = c.getContext('2d').getImageData(Math.max(0, r.x0 * k), Math.max(0, r.y0 * k), Math.max(1, (r.x1 - r.x0) * k), Math.max(1, (r.y1 - r.y0) * k)).data; let h = 0, s = 0; for (let i = 0; i < d.length; i += 4) { h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0; s += d[i] + d[i + 1] + d[i + 2]; } return { h, s }; }, r);
const item = (p, id) => p.evaluate(id => LabBench.items().find(i => i.id === id) || null, id);

(async () => {
  const srv = await T.serve(), b = await T.launch();
  let ctx = await T.ctxFor(b);
  let p = await T.open(ctx, 'index.html', '', srv.url);

  console.log('Scene draws');
  const base = await p.evaluate(() => { const c = document.getElementById('bench-scene'); const r = c.getBoundingClientRect(); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let nz = 0, lum = 0; for (let i = 0; i < d.length; i += 40) { nz++; lum += d[i] + d[i + 1] + d[i + 2]; } return { w: r.width, h: r.height, avg: lum / nz / 3, ids: LabBench.items().map(i => i.id), label: c.getAttribute('aria-label') }; });
  T.ok(base.w > 1300 && base.h > 250, `the canvas fills the hero (${Math.round(base.w)}×${Math.round(base.h)})`);
  T.ok(base.avg > 15 && base.avg < 110, 'a dark bench (mean brightness ' + base.avg.toFixed(0) + ')');
  T.ok(base.ids.join() === 'flask,petri,gel,scope,balance,rack,vials', 'all seven pieces of equipment: ' + base.ids.join(', '));
  T.ok(/dark lab bench/.test(base.label) && /Finish a lab/.test(base.label), 'the canvas has an accessible description');
  T.ok(/Finish a lab/.test(await p.locator('#bench-note').innerText()), 'a visible note explains it');
  const items = await p.evaluate(() => LabBench.items());
  T.ok(items.every(i => i.level === 0), 'with nothing finished every object is in its plain state');
  const grid = await p.evaluate(() => [document.querySelectorAll('.card').length, document.querySelector('.cards').getBoundingClientRect().width]);
  T.ok(grid[0] === 13, 'the 13 lab cards are untouched');
  if (OUT) await p.locator('.hero').screenshot({ path: OUT + '/t46-banner-light-1366.png' });
  const before = {}; for (const i of items) before[i.id] = await sig(p, i);
  for (const i of items) before[i.id + '#core'] = await sig(p, Object.assign({}, i, { x0: i.x0 + (i.x1 - i.x0) * 0.25, x1: i.x1 - (i.x1 - i.x0) * 0.25 }));

  console.log('Completed labs change the equipment');
  const cases = [['gel', [9]], ['gel', [3, 9]], ['flask', [13]], ['flask', [5, 13]], ['petri', [8]], ['scope', [7]], ['vials', [12]], ['balance', [4]], ['rack', [6]]];
  for (const [id, labs] of cases) {
    const c2 = await T.ctxFor(b);
    await c2.addInitScript(arr => { arr.forEach(([k, v]) => { if (!localStorage.getItem('__bench_done')) localStorage.setItem(k, v); }); localStorage.setItem('__bench_done', '1'); }, labs.map(prog));
    const q = await T.open(c2, 'index.html', '', srv.url);
    const it = await item(q, id), s = await sig(q, it);
    T.ok(it.level === labs.length && JSON.stringify(await q.evaluate(() => LabBench.completed())) === JSON.stringify(labs), `${id}: labs ${labs.join(' + ')} done → level ${it.level}`);
    T.ok(s.h !== before[id].h, `${id} looks different once Lab ${labs.join(' and ')} is complete`);
    for (const other of base.ids.filter(x => x !== id && !(x === 'vials' && false))) {
      const oi0 = await item(q, other), oi = Object.assign({}, oi0, { x0: oi0.x0 + (oi0.x1 - oi0.x0) * 0.25, x1: oi0.x1 - (oi0.x1 - oi0.x0) * 0.25 }), os = await sig(q, oi);
      if (os.h !== before[other + '#core'].h) { T.ok(false, `${id} case changed an unrelated object: ${other}`); }
    }
    if (OUT && (id === 'gel' && labs.length === 2)) await q.locator('.hero').screenshot({ path: OUT + '/t46-banner-some.png' });
    T.ok(q.errors.length === 0, 'no console errors ' + q.errors.join('|'));
    await c2.close();
  }
  { // everything done
    const c2 = await T.ctxFor(b);
    await c2.addInitScript(arr => { if (!localStorage.getItem('__bench_done')) { arr.forEach(([k, v]) => localStorage.setItem(k, v)); localStorage.setItem('__bench_done', '1'); } }, ALL.map(prog));
    const q = await T.open(c2, 'index.html', '', srv.url);
    T.ok((await q.evaluate(() => LabBench.items())).every(i => i.level === i.labs.length), 'all 13 labs done: every object is fully changed');
    T.ok(/13 of 13/.test(await q.locator('#bench-note').innerText()), 'the note counts them: ' + await q.locator('#bench-note').innerText());
    if (OUT) await q.locator('.hero').screenshot({ path: OUT + '/t46-banner-all-light.png' });
    await q.evaluate(() => Lab.theme.set('dark')); await q.waitForTimeout(500);
    if (OUT) await q.locator('.hero').screenshot({ path: OUT + '/t46-banner-all-dark.png' });
    await c2.close();
  }

  console.log('Readable overlays, light and dark');
  const contrast = async q => q.evaluate(() => {
    const lum = c => { const v = c.map(n => { n /= 255; return n <= .03928 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
    const cv = document.getElementById('bench-scene'), k = cv.width / cv.getBoundingClientRect().width, ctx = cv.getContext('2d'), out = {};
    const parse = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    [['h1', '.hero h1'], ['lede', '.hero p.lede'], ['links', '.hero .hero-links a'], ['note', '#bench-note'], ['eyebrow', '.hero .eyebrow']].forEach(([n, sel]) => {
      const e = document.querySelector(sel), r = e.getBoundingClientRect(), hr = document.querySelector('.hero').getBoundingClientRect();
      const d = ctx.getImageData(Math.max(0, (r.left - hr.left) * k), Math.max(0, (r.top - hr.top) * k), Math.max(1, Math.min(r.width, 400) * k), Math.max(1, r.height * k)).data;
      let worst = 0; for (let i = 0; i < d.length; i += 16) { const L = lum([d[i], d[i + 1], d[i + 2]]); if (L > worst) worst = L; }
      const fg = lum(parse(getComputedStyle(e).color)); out[n] = +((fg + .05) / (worst + .05)).toFixed(1);
    });
    return out;
  });
  for (const dark of [false, true]) {
    const c2 = await T.ctxFor(b, { dark });
    const q = await T.open(c2, 'index.html', '', srv.url);
    const cr = await contrast(q);
    T.ok(Object.values(cr).every(v => v >= 4.5), `${dark ? 'dark' : 'light'}: text vs. the brightest bench pixel behind it: ` + JSON.stringify(cr));
    T.ok(await q.evaluate(() => { const s = document.querySelector('.hero .home-status'); const bg = getComputedStyle(s).backgroundColor; return !/rgba\(0, 0, 0, 0\)/.test(bg); }), 'the sign-in panel has its own surface');
    await c2.close();
  }
  { // pick-up card on top
    const c2 = await T.ctxFor(b, { dark: true });
    await c2.addInitScript(() => { if (!localStorage.getItem('__s')) { localStorage.setItem('aplab:last', JSON.stringify({ lab: 'lab05', step: 'float-assay', name: 'Float assay', title: 'Lab 5 · Photosynthesis', t: Date.now() })); localStorage.setItem('__s', '1'); } });
    const q = await T.open(c2, 'index.html', '', srv.url);
    T.ok(await q.locator('#resume').isVisible(), '"Pick up where you left off" shows over the bench');
    T.ok(await q.evaluate(() => { const r = document.querySelector('#resume').getBoundingClientRect(), it = LabBench.items(); return it.every(i => r.top >= i.y1 - 4 || r.left > i.x1 || r.right < i.x0); }), 'and does not sit on the equipment');
    if (OUT) await q.locator('.hero').screenshot({ path: OUT + '/t46-banner-pickup-dark.png' });
    await c2.close();
  }

  console.log('Phone');
  for (const dark of [false, true]) {
    const c2 = await T.ctxFor(b, { width: 400, height: 800, dark });
    await c2.addInitScript(arr => { if (!localStorage.getItem('__d')) { arr.forEach(([k, v]) => localStorage.setItem(k, v)); localStorage.setItem('__d', '1'); } }, [8, 9, 12].map(prog));
    const q = await T.open(c2, 'index.html', '', srv.url);
    const info = await q.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, items: LabBench.items().map(i => [i.id, Math.round(i.x0), Math.round(i.x1), i.level]), w: innerWidth }));
    T.ok(info.over <= 0, 'no sideways scroll at 400 px');
    T.ok(info.items.length >= 4 && info.items.every(([, a, z]) => a >= 0 && z <= info.w), 'the scene scales: ' + info.items.length + ' objects, all inside the screen');
    T.ok(['gel', 'petri', 'vials'].every(id => info.items.some(i => i[0] === id)), 'objects that show progress are the ones kept: ' + info.items.map(i => i[0]).join(', '));
    if (OUT) await q.locator('.hero').screenshot({ path: OUT + '/t46-banner-400-' + (dark ? 'dark' : 'light') + '.png' });
    await c2.close();
  }

  console.log('Reduced motion');
  { const c2 = await T.ctxFor(b, { reduced: true }); const q = await T.open(c2, 'index.html', '', srv.url);
    T.ok(await q.evaluate(() => getComputedStyle(document.querySelector('.bench-sheen')).display) === 'none', 'the faint sheen is off'); await c2.close(); }
  { const c2 = await T.ctxFor(b); const q = await T.open(c2, 'index.html', '', srv.url);
    T.ok(await q.evaluate(() => getComputedStyle(document.querySelector('.bench-sheen'), '::before').animationName) === 'bench-sheen', 'otherwise a very faint sheen drifts'); await c2.close(); }

  await b.close(); srv.close();
  T.done('t46-bench-banner');
})();
