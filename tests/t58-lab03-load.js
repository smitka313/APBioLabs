/* Audit 5: Lab 3 froze on load: one 659 ms task (2.9 s at 4× CPU throttling). A CPU profile put ~500 ms of it in the plate
   artwork's paper-grain pass (a per-pixel sin() field over 800×480 px, recomputed for each of the six organism plates) and the
   rest in drawing the plates, all before first use: the plates sit in Part 4, not on the Overview.
   The grain field is now computed once, and the plates are drawn one per idle slice after load.
   Checks:
   1. No long task over 200 ms while Lab 3 loads (1366 px), and none over 600 ms with 4× CPU throttling.
   2. Every plate image, the BLAST database, Dataset ID and BLAST results are byte-identical to the baseline recorded from the
      old code (tests/fixtures/lab03-baseline.json), for 2 student identities. RECORD=1 rewrites the baseline.
   Run: NODE_PATH=$(npm root -g) node tests/t58-lab03-load.js */
const T = require('./_h');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const FIX = path.join(__dirname, 'fixtures/lab03-baseline.json');
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const IDS = [{ name: 'Ada Lovelace', period: '2' }, { name: 'Jordan Ortiz', period: '5' }];

(async () => {
  const srv = await T.serve(), b = await T.launch();
  const out = {};
  for (const idn of IDS) {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
    await T.routeLibs(ctx);
    await ctx.route(/gc\.zgo\.at|fonts\.g/, r => r.abort());
    await ctx.addInitScript(i => { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('aplab:student', JSON.stringify(i)); localStorage.setItem('aplab:tour', JSON.stringify({ seen: true, v: 1 })); sessionStorage.setItem('__s', 1); } }, idn);
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + 'lab03.html', { waitUntil: 'load' });
    // Plates are drawn after load, in idle time; show Part 4 and wait for them.
    await p.evaluate(() => { location.hash = '#morphology'; });
    await p.waitForFunction(() => { const im = [...document.querySelectorAll('#orgcards img.plate-svg')]; return im.length && im.every(i => /^data:image\/jpeg/.test(i.src) && i.complete && i.naturalWidth > 0); }, null, { timeout: 15000 });
    const r = await p.evaluate(() => {
      const res = { datasetId: Lab.identity.seed.datasetId, db: JSON.stringify(db), plates: {}, blast: {} };
      const grab = () => document.querySelectorAll('#orgcards img.plate-svg').forEach(i => { res.plates[i.alt] = i.src; });
      grab();
      Object.keys(GENES).forEach(g => Object.keys(PROGRAMS).forEach(pk => {
        res.blast[g + ':' + pk] = JSON.stringify(blast(db.fossil[g], targetsFor(g, ORG_IDS), pk).map(h => [h.id, h.bits.toFixed(6), h.E.toExponential(6), h.ident.toFixed(4), h.cover.toFixed(4), h.qStart, h.qEnd])); }));
      return res;
    });
    // The plant dataset has its own plates.
    const plant = await p.evaluate(async () => {
      const btn = [...document.querySelectorAll('#ds-seg button')].find(x => x.getAttribute('aria-pressed') !== 'true'); if (!btn) return {};
      btn.click();
      const t0 = Date.now();
      while (Date.now() - t0 < 10000) { const im = [...document.querySelectorAll('#orgcards img.plate-svg')]; if (im.length && im.every(i => /^data:image\/jpeg/.test(i.src))) break; await new Promise(z => setTimeout(z, 50)); }
      const o = {}; document.querySelectorAll('#orgcards img.plate-svg').forEach(i => { o[i.alt] = i.src; }); btn.click(); return o;
    });
    Object.assign(r.plates, plant);
    const key = idn.name;
    out[key] = { datasetId: r.datasetId, db: sha(r.db), blast: sha(JSON.stringify(r.blast)), plates: Object.fromEntries(Object.entries(r.plates).map(([k, v]) => [k, sha(v)])) };
    T.ok(errs.length === 0, `${key}: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  if (process.env.RECORD) { fs.writeFileSync(FIX, JSON.stringify(out, null, 1)); console.log('  recorded ' + FIX); }
  const base = JSON.parse(fs.readFileSync(FIX, 'utf8'));
  for (const k of Object.keys(base)) {
    const a = base[k], c = out[k] || {};
    T.ok(a.datasetId === c.datasetId, `${k}: Dataset ID unchanged (${a.datasetId} / ${c.datasetId})`);
    T.ok(a.db === c.db, `${k}: personalized BLAST database identical (${a.db} / ${c.db})`);
    T.ok(a.blast === c.blast, `${k}: BLAST results for every gene and program identical (${a.blast} / ${c.blast})`);
    const pk = Object.keys(a.plates);
    T.ok(pk.length >= 10 && pk.every(n => a.plates[n] === (c.plates || {})[n]), `${k}: all ${pk.length} plate images pixel-identical ${pk.filter(n => a.plates[n] !== (c.plates || {})[n]).join(', ')}`);
  }
  T.ok(base[IDS[0].name].db !== base[IDS[1].name].db, 'the two identities get different databases (the comparison is meaningful)');

  // Long tasks while loading.
  for (const cpu of [1, 4]) {
    const ctx = await T.ctxFor(b, { width: 1366, height: 768 });
    await ctx.route(/gc\.zgo\.at|fonts\.g/, r => r.abort());
    await ctx.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true }); });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await p.goto(srv.url + 'lab03.html', { waitUntil: 'load' });
    await p.waitForTimeout(4000 * cpu);
    const lt = await p.evaluate(() => window.__lt);
    const max = Math.max(0, ...lt), lim = cpu > 1 ? 600 : 200;
    T.ok(max <= lim, `lab03 load @ CPU ×${cpu}: longest task ${max} ms ≤ ${lim} ms (all: ${lt.join(', ')})`);
    await ctx.close();
  }
  await b.close(); srv.close();
  T.done('t58-lab03-load');
})();
