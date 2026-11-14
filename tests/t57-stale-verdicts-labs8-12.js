/* Audit 4 #2 (stale derived text), Labs 8, 11, 12: a verdict or feedback line is invalidated the moment the data behind it changes,
   and nothing derived is shown on load that the stored data no longer supports. Each case starts from erased or stored state.
   FILES_DIR-style override: OLD_PREFIX (e.g. "old/") is prepended to the page names. */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  const pre = process.env.OLD_PREFIX || '';
  const setv = (p, sel, v, ev = ['input']) => p.evaluate(([s, v, ev]) => { const e = document.querySelector(s); e.value = v; ev.forEach(n => e.dispatchEvent(new Event(n, { bubbles: true }))); }, [sel, v, ev]);

  // ---- Lab 8: the calculator's "✓ correct" lines go as soon as an input changes
  {
    const ctx = await T.ctxFor(b), p = await T.open(ctx, pre + 'lab08.html', 'transform');
    await p.evaluate(() => { Object.keys(localStorage).filter(k => /^aplab:lab08/.test(k)).forEach(k => localStorage.removeItem(k)); }); await p.reload(); await p.waitForTimeout(900);
    const idle = () => p.waitForFunction(() => !document.querySelector('#do-step').disabled, null, { timeout: 60000 });
    for (let i = 0; i < 9; i++) { await p.click('#do-step'); await idle(); await p.waitForTimeout(80); }
    await p.evaluate(() => { document.querySelectorAll('#pred-grid select').forEach(s => { s.value = 'none'; s.dispatchEvent(new Event('change', { bubbles: true })); }); });
    await p.click('#do-step'); await p.waitForFunction(() => /Incubated/.test(document.querySelector('#ro-status').textContent), null, { timeout: 60000 }); await p.waitForTimeout(800);
    const cnt = await p.evaluate(() => plates['p-amp'].count);
    await setv(p, '#c-count', String(cnt)); await p.click('#calc-check'); await p.waitForTimeout(300);
    const fb = () => p.evaluate(() => document.querySelector('#calc-fb').textContent.trim());
    T.ok(/colony count is reasonable/.test(await fb()), 'Lab 8: after Check the feedback says the count is reasonable');
    await setv(p, '#c-count', String(cnt + 40)); await p.waitForTimeout(300);
    const f2 = await fb(); console.log('fb after edit:', f2); T.ok(!/reasonable/.test(f2), 'Lab 8: editing the count clears the old verdict');
    await ctx.close();
  }

  // ---- Lab 11: leaf-area feedback, and stored verdicts on load
  {
    const ctx = await T.ctxFor(b), p = await T.open(ctx, pre + 'lab11.html', 'leaf-area');
    await p.evaluate(() => { Object.keys(localStorage).filter(k => /^aplab:lab11/.test(k)).forEach(k => localStorage.removeItem(k)); }); await p.reload(); await p.waitForTimeout(900);
    await p.evaluate(() => { const c = document.querySelector('#la-show'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
    const sh = await p.evaluate(() => document.querySelector('#la-msg').textContent.match(/(\d+) full squares.*?(\d+) partial/)); const lf = { f: +sh[1], p: +sh[2] };
    await p.evaluate(() => { const c = document.querySelector('#la-show'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
    await setv(p, '#la-full', String(lf.f)); await setv(p, '#la-part', String(lf.p)); await p.click('#la-calc'); await p.waitForTimeout(300);
    const msg = () => p.evaluate(() => document.querySelector('#la-msg').textContent.trim());
    T.ok(/Good count/.test(await msg()), 'Lab 11: a right count says "Good count"');
    await setv(p, '#la-full', String(lf.f + 30)); await p.waitForTimeout(300);
    const m2 = await msg(); T.ok(!/Good count/.test(m2), 'Lab 11: editing the count removes "Good count" (now: "' + m2.slice(0, 50) + '")');
    await p.reload(); await p.waitForTimeout(900);
    const m3 = await msg(); T.ok(!/Good count/.test(m3), 'Lab 11: after a reload the edited (wrong) count is not praised (now: "' + m3.slice(0, 50) + '")');
    // stored density verdict that the stored data does not support
    await p.evaluate(() => { Lab.store.set('st-dens-msg', { h: 'Correct: 40 stomata per field ÷ 0.159 mm² = 252 per mm².', c: 'status ok' }); Lab.store.set('tr-check-msg', { t: '3 of 3 correct.', c: 'status ok' }); });
    await p.evaluate(() => { location.hash = '#stomata'; }); await p.reload(); await p.waitForTimeout(900);
    const st = await p.evaluate(() => [document.querySelector('#st-dens-msg').textContent.trim(), document.querySelector('#tr-check-msg').textContent.trim()]);
    T.ok(st[0] === '', 'Lab 11: a stored "Correct" density verdict with no recorded fields is not shown on load: "' + st[0].slice(0, 40) + '"');
    T.ok(st[1] === '', 'Lab 11: a stored "3 of 3 correct" with no plants is not shown on load: "' + st[1] + '"');
    await ctx.close();
  }

  // ---- Lab 12: the calibration line under the chamber goes when the student edits the count it quotes
  {
    const ctx = await T.ctxFor(b), p = await T.open(ctx, pre + 'lab12.html', 'choice-chamber');
    await p.evaluate(() => { Object.keys(localStorage).filter(k => /^aplab:lab12/.test(k)).forEach(k => localStorage.removeItem(k)); }); await p.reload(); await p.waitForTimeout(900);
    await setv(p, '#p-predict', 'The flies will prefer banana.');
    await p.evaluate(() => { const s = document.querySelector('#c-speed button[data-v="40"]'); if (s) s.click(); });
    await p.click('#c-run'); await p.waitForFunction(() => !document.querySelector('#count-panel').hidden, null, { timeout: 30000 });
    const n = await p.evaluate(() => +document.querySelector('#c-n').value);
    await setv(p, '#cnt-a', String(Math.floor(n / 2))); await setv(p, '#cnt-b', String(n - Math.floor(n / 2))); await p.click('#cnt-rec'); await p.waitForTimeout(400);
    const m = () => p.evaluate(() => { const e = document.querySelector('#ch-msg'); return e && !e.hidden ? e.textContent : ''; });
    if (pre === '') {
      T.ok(/you counted/.test(await m()), 'Lab 12: calibration line is up after recording a minute');
      await p.locator('#int-table input').first().fill('1'); await p.waitForTimeout(300);
      T.ok(!/you counted/.test(await m()), 'Lab 12: editing the counted cell clears the calibration line quoting the old count');
    }
    await ctx.close();
  }
  await b.close(); T.done('stale verdicts labs 8, 11, 12');
})();
