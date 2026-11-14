/* Cross-browser smoke test (Audit 5 #2). Pick the engine with BROWSER=chromium|firefox|webkit (default chromium).
   CI runs it in Firefox and WebKit (Safari's engine); locally only Chromium is installed.
     1. Every page (index, teachers, dashboard, projector, 13 labs) loads with no page errors and no sideways scroll at 1366 and 390.
     2. One simulation per lab (the t59-drive fast paths): its data table fills, charts with data carry the "Simulated data" tag.
     3. Save → reload keeps a typed answer and the key results.
     4. .docx download (a real click, a real file) and the PDF/print preview (charts drawn to images, print media shows the report).
     5. Restore a progress file in a fresh browser profile.
     6. Unlock teacher notes encrypted by this test (tools/encrypt-notes.js, dummy password): Web Crypto PBKDF2 + AES-GCM.
   Pages are served from 127.0.0.1 (a secure context, like the https site).
   Run: BROWSER=webkit NODE_PATH=./node_modules node tests/t60-browsers.js [pages] [sims] [save] [notes]   (all parts by default) */
const T = require('./_h');
const D = require('./t59-drive');
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const parts = process.argv.slice(2), want = n => !parts.length || parts.includes(n);
const ENGINE = T.BROWSER;
const withTimeout = (pr, ms, what) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ': timed out after ' + ms / 1000 + ' s')), ms))]);
const PAGES = ['index.html', 'teachers.html', 'teacher-dashboard.html', 'projector.html', ...T.LABS.map(l => l + '.html')];

(async () => {
  console.log(`Engine: ${ENGINE}`);
  const b = await T.launch();
  console.log(`Version: ${b.version()}`);
  const srv = await T.serve();

  /* 1. Pages: load, no errors, no sideways scroll at 1366 and 390. */
  if (want('pages')) for (const width of [1366, 390]) {
    const ctx = await T.ctxFor(b, { width, height: width > 500 ? 768 : 844 });
    for (const f of PAGES) {
      const p = await T.open(ctx, f, '', srv.url);
      await p.waitForTimeout(300);
      const r = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, main: !!document.querySelector('main'), lab: !!window.Lab }));
      T.ok(p.errors.length === 0, `${f} @${width}: no page errors ${p.errors.join(' | ')}`);
      T.ok(r.over <= 0, `${f} @${width}: no sideways scroll (${r.over}px)`);
      T.ok(r.main, `${f} @${width}: rendered`);
      await p.close();
    }
    await ctx.close();
  }

  /* 2. One simulation per lab. */
  if (want('sims')) {
    for (const lab of T.LABS) {
      const ctx = await T.ctxFor(b);
      const p = await T.open(ctx, lab + '.html', '', srv.url);
      const t0 = Date.now();
      try {
        await withTimeout(D.RUN[lab](p), 150000, lab + ' run');
        if (D.SAVE_ROWS[lab]) await withTimeout(D.SAVE_ROWS[lab](p), 60000, lab + ' record rows');
        const d = await D.dump(p);
        const filled = d.tables.filter(t => t.rows.length > 0).length;
        T.ok(filled > 0, `${lab}: simulation ran, ${filled} table(s) with data (${Math.round((Date.now() - t0) / 1000)} s)`);
        await p.evaluate(() => Lab.pages && Lab.pages.showAll && Lab.pages.showAll(true)); await p.waitForTimeout(300);
        const ch = await p.evaluate(() => Array.from(document.querySelectorAll('.chart:not(.is-empty) > svg')).map(s => {
          const t = s.querySelector('.sim-tag-svg'); if (!t) return { tag: false };
          const tr = t.getBoundingClientRect(); if (!tr.width) return { tag: true, hit: false };
          const hit = Array.from(s.querySelectorAll('text:not(.sim-tag-svg)')).some(x => { const r = x.getBoundingClientRect(); return r.width && r.left < tr.right && r.right > tr.left && r.top < tr.bottom && r.bottom > tr.top; });
          return { tag: true, hit };
        }));
        T.ok(ch.every(c => c.tag && !c.hit), `${lab}: ${ch.length} chart(s) with data, each tagged "Simulated data", tag clear of other text`);
      } catch (e) { T.ok(false, `${lab}: simulation: ${e.message.split('\n')[0]}`); }
      T.ok(p.errors.length === 0, `${lab}: no page errors during the run ${p.errors.join(' | ')}`);
      await ctx.close();
    }
  }

  /* 3-5. Save → reload, .docx, preview/print, progress file restore (Lab 5). */
  if (want('save')) {
    const ctx = await T.ctxFor(b);
    const p = await T.open(ctx, 'lab05.html', '', srv.url);
    await withTimeout(D.RUN.lab05(p), 150000, 'lab05 run').catch(e => T.ok(false, 'lab05 run: ' + e.message));
    await p.evaluate(() => Lab.pages && Lab.pages.showAll && Lab.pages.showAll(true));
    const ta = await p.evaluate(() => Array.from(document.querySelectorAll('textarea[data-save]')).find(x => !x.closest('.id-box') && !x.closest('.predict')).id);
    await p.fill('#' + ta, 'Cross-browser answer'); await p.waitForTimeout(900);
    const kr1 = await p.evaluate(() => Lab.keyResults().map(r => r.id + '=' + r.value).sort().join(';'));
    await p.reload(); await p.waitForTimeout(1200);
    await p.evaluate(() => Lab.pages && Lab.pages.showAll && Lab.pages.showAll(true));
    T.ok(await p.inputValue('#' + ta) === 'Cross-browser answer', 'save → reload: typed answer kept');
    const kr2 = await p.evaluate(() => Lab.keyResults().map(r => r.id + '=' + r.value).sort().join(';'));
    T.ok(kr1.length > 0 && kr1 === kr2, 'save → reload: key results kept (' + kr2.split(';').length + ')');
    // "Rate my confidence": the chosen option is marked by a class too (its :has() style is dropped where :has() is missing).
    await p.click('.conf-opt[data-v="2"]'); await p.waitForTimeout(300);
    T.ok(await p.evaluate(() => Array.from(document.querySelectorAll('.conf-opt.is-checked')).map(l => l.dataset.v).join()) === '2', 'confidence choice marked with .is-checked');

    // .docx through the real button and the real download path.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't60-'));
    await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Download .docx'); b.scrollIntoView({ block: 'center' }); });
    try {
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('button:has-text("Download .docx")')]);
      const f = path.join(dir, dl.suggestedFilename()); await dl.saveAs(f);
      const buf = fs.readFileSync(f);
      T.ok(/\.docx$/.test(dl.suggestedFilename()) && buf.length > 5000 && buf.slice(0, 2).toString() === 'PK', `.docx downloaded: ${dl.suggestedFilename()} (${buf.length} bytes)`);
      const JSZip = require('./fixtures/jszip-3.10.1.min.js');
      const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml').async('string');
      T.ok(xml.includes('Cross-browser answer') && xml.includes('computer simulation'), '.docx holds the answer and the simulated-data line');
    } catch (e) { T.ok(false, '.docx download: ' + e.message.split('\n')[0]); }

    // PDF / print preview: charts become images; print media shows only the report.
    await p.evaluate(() => Lab.report.open()); await p.waitForTimeout(1500);
    const pv = await p.evaluate(() => { const r = document.querySelector('#lab-report'); const imgs = r ? Array.from(r.querySelectorAll('img')) : []; return { shown: !!r && r.getBoundingClientRect().height > 200, imgs: imgs.length, loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length, text: r ? r.textContent : '' }; });
    T.ok(pv.shown && /Cross-browser answer/.test(pv.text), 'report preview opens with the answer');
    T.ok(pv.imgs > 0 && pv.loaded === pv.imgs, `report preview: ${pv.loaded}/${pv.imgs} chart image(s) drawn`);
    await p.emulateMedia({ media: 'print' });
    const pm = await p.evaluate(() => ({ report: getComputedStyle(document.querySelector('#lab-report')).display !== 'none', main: (document.querySelector('main') ? getComputedStyle(document.querySelector('main')).display : 'none') }));
    T.ok(pm.report && pm.main === 'none', 'print media: only the report prints');
    await p.emulateMedia({ media: 'screen' });
    await p.evaluate(() => Lab.report.close());

    // Progress file → a fresh profile.
    const pay = await p.evaluate(() => Lab.progressFile.payload(true));
    const pf = path.join(dir, 'progress.json'); fs.writeFileSync(pf, JSON.stringify(pay));
    const ctx2 = await T.ctxFor(b);
    const q = await T.open(ctx2, 'lab05.html', '', srv.url);
    await q.evaluate(() => Lab.pages && Lab.pages.showAll && Lab.pages.showAll(true));
    await q.click('.move-work summary').catch(() => {});
    await q.setInputFiles('.move-work input[type=file]', pf); await q.waitForTimeout(500);
    try {
      await Promise.all([q.waitForEvent('load', { timeout: 15000 }), q.click('.move-work .id-confirm .restore-apply')]); await q.waitForTimeout(1200);
      await q.evaluate(() => Lab.pages && Lab.pages.showAll && Lab.pages.showAll(true));
      T.ok(await q.inputValue('#' + ta) === 'Cross-browser answer', 'progress file restored in a fresh browser');
      T.ok(await q.evaluate(() => Lab.identity.seed.datasetId) === await p.evaluate(() => Lab.identity.seed.datasetId), 'same Dataset ID after the restore');
    } catch (e) { T.ok(false, 'restore: ' + e.message.split('\n')[0]); }
    T.ok(p.errors.length === 0 && q.errors.length === 0, 'save/export/restore: no page errors ' + p.errors.concat(q.errors).join(' | '));
    await ctx2.close(); await ctx.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }

  /* 6. Teacher notes: encrypt a sample with a dummy password, unlock it (PBKDF2 + AES-GCM in this engine). */
  if (want('notes')) {
    const PW = 'cross-browser-dummy';
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't60-notes-')), src = path.join(tmp, 'src'), out = path.join(tmp, 'out');
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, 'teacher-notes.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Teacher notes</title></head><body><main><h1>Teacher notes</h1><p id="secret">SAMPLE-SECRET ✓ é</p></main></body></html>');
    execFileSync(process.execPath, [path.join(T.ROOT, 'tools/encrypt-notes.js'), src, out], { env: Object.assign({}, process.env, { NOTES_PASSWORD: PW }) });
    for (const f of ['style.css', 'lab.js']) if (fs.existsSync(path.join(T.ROOT, f))) fs.copyFileSync(path.join(T.ROOT, f), path.join(out, f));
    const ns = await T.serve(out);
    const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(ns.url + 'teacher-notes.html');
    await p.fill('#pw', 'wrong-password'); await p.click('button[type=submit]'); await p.waitForTimeout(1500);
    T.ok(await p.locator('#secret').count() === 0, 'notes: a wrong password does not unlock');
    await p.fill('#pw', PW); await p.click('button[type=submit]');
    const ok = await p.waitForSelector('#secret', { timeout: 20000 }).then(() => true, () => false);
    T.ok(ok && (await p.textContent('#secret')) === 'SAMPLE-SECRET ✓ é', 'notes: the right password decrypts (PBKDF2 + AES-GCM), text intact');
    T.ok(errs.length === 0, 'notes: no page errors ' + errs.join(' | '));
    await ctx.close(); ns.close(); fs.rmSync(tmp, { recursive: true, force: true });
  }

  srv.close(); await b.close(); T.done(`t60-browsers (${ENGINE})`);
})();
