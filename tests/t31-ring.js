/* "Show me where": a clearly visible ring lands on the target (closed details, other parts, hidden tabs), about 2.5 s. */
const T = require('./_h');
const fs = require('fs');
const OUT = process.env.SHOTS || '';
(async () => {
  const b = await T.launch();
  for (const dark of [false, true]) {
    const ctx = await T.ctxFor(b, { dark });
    let clicked = 0, ringed = 0, opened = 0, otherPart = 0, tab = 0, bad = [];
    for (const lab of T.LABS) {
      const p = await T.open(ctx, lab + '.html');
      const n = await p.evaluate(() => document.querySelectorAll('.si-show').length);
      const pick = dark ? [0] : Array.from(new Set([0, Math.floor(n / 2), n - 1])).filter(i => i >= 0);
      for (const i of pick) {
        // fresh state each time so closed details / hidden parts are really closed
        const info = await p.evaluate(i => {
          const btn = document.querySelectorAll('.si-show')[i];
          const sec0 = btn.closest('section.step');
          if (sec0) Lab.pages.go(sec0);
          return { part: sec0 && sec0.id, closed: document.querySelectorAll('details:not([open])').length };
        }, i);
        await p.waitForTimeout(250);
        const btn = (await p.$$('.si-show'))[i];
        if (!(await btn.isVisible())) continue;
        await btn.click(); clicked++;
        await p.waitForTimeout(900);
        const r = await p.evaluate(() => {
          const ring = document.querySelector('.lab-ring');
          if (!ring) return { none: true };
          const rr = ring.getBoundingClientRect(), cs = getComputedStyle(ring);
          const a = document.activeElement, ab = a && a.getBoundingClientRect();
          return { on: +cs.opacity, bw: parseFloat(cs.borderTopWidth), w: rr.width, h: rr.height, l: rr.left, t: rr.top, vw: innerWidth, vh: innerHeight, closedAfter: document.querySelectorAll('details:not([open])').length, part: Lab.pages.current && Lab.pages.current().id, a: a && a.tagName, ab: ab && [ab.left, ab.top, ab.width, ab.height] };
        });
        if (r.none) { bad.push(`${lab}#${i}: no ring`); continue; }
        const visible = r.on === 1 && r.bw >= 4 && r.w > 20 && r.h > 12 && r.l + r.w > 0 && r.t + r.h > 0 && r.l < r.vw && r.t < r.vh;
        if (!visible) bad.push(`${lab}#${i}: ring not visible ${JSON.stringify(r)}`); else ringed++;
        if (r.closedAfter < info.closed) opened++;
        if (r.part !== info.part) otherPart++;
        if (OUT && !dark && ringed === 1) await p.screenshot({ path: OUT + '/ring-light.png' });
        if (OUT && dark && ringed === 1) await p.screenshot({ path: OUT + '/ring-dark.png' });
        if (lab === 'lab05' && !dark) {
          const t0 = Date.now(); await p.waitForFunction(() => !document.querySelector('.lab-ring'), null, { timeout: 5000 });
          const life = Date.now() - t0 + 900; T.ok(life > 2000 && life < 4600, 'ring lasts about 2.5 s after settling (' + life + ' ms from click)');
        } else await p.evaluate(() => { const r = document.querySelector('.lab-ring'); if (r) r.remove(); });
      }
      if (p.errors.length) bad.push(lab + ' errors ' + p.errors.join(';'));
      await p.close();
    }
    T.ok(clicked > (dark ? 10 : 20), `${dark ? 'dark' : 'light'}: clicked ${clicked} Show me buttons`);
    T.ok(bad.length === 0, `${dark ? 'dark' : 'light'}: every ring visible (4px, opaque, on screen) and gone after ~2.5 s ${bad.slice(0, 5).join(' | ')}`);
    console.log('  info: ringed', ringed);
    // Hard cases, built on a lab page: a control inside a closed <details>, one in a hidden Data/Graph panel, one in another part.
    const q = await T.open(ctx, 'lab05.html');
    const cases = await q.evaluate(() => {
      const first = (sel, pred) => Array.from(document.querySelectorAll(sel)).find(pred || (() => true));
      const inClosed = first('details:not([open]) button, details:not([open]) input, details:not([open]) select');
      const inHiddenPanel = first('[role=tabpanel][hidden] .chart, [role=tabpanel][hidden] table, [role=tabpanel][hidden] .table-wrap, [role=tabpanel][hidden] input, [role=tabpanel][hidden] button');
      const here = document.querySelector('section.step.is-current');
      const other = first('section.step button, section.step textarea', e => e.closest('section.step') !== here && !e.closest('details:not([open])') && !e.closest('[hidden]'));
      const mk = (el, k) => { if (!el) return null; el.id = el.id || 'ring-case-' + k; return '#' + el.id; };
      return { closed: mk(inClosed, 'c'), panel: mk(inHiddenPanel, 'p'), other: mk(other, 'o') };
    });
    for (const [k, sel] of Object.entries(cases)) {
      T.ok(!!sel, `${dark ? 'dark' : 'light'}: found a ${k} target to test`);
      if (!sel) continue;
      await q.evaluate(() => { const first = document.querySelector('section.step'); Lab.pages.go(first); });
      await q.waitForTimeout(300);
      const before = await q.evaluate(sel => { const e = document.querySelector(sel); const sec = e.closest('section.step'); const det = e.closest('details'); const pan = e.closest('[role=tabpanel]'); return { part: sec && sec.id, cur: Lab.pages.current().id, det: det ? det.open : null, pan: pan ? pan.hidden : null }; }, sel);
      await q.evaluate(sel => { const box = document.createElement('div'); box.id = 'ring-steps'; document.querySelector('section.step.is-current').append(box); Lab.steps(box, [{ id: 'x', text: 'Test step', target: sel }], { pulse: false }); }, sel);
      await q.click('#ring-steps .si-show'); await q.waitForTimeout(1000);
      const r = await q.evaluate(sel => { const e = document.querySelector(sel), ring = document.querySelector('.lab-ring'); const det = e.closest('details'), pan = e.closest('[role=tabpanel]'); const rr = ring && ring.getBoundingClientRect(), er = e.getBoundingClientRect(); const vis = e.closest('section.step').classList.contains('is-current'); return { ring: !!ring, op: ring && +getComputedStyle(ring).opacity, vis, det: det ? det.open : null, pan: pan ? pan.hidden : null, overlap: !!rr && rr.left < er.right && rr.right > er.left && rr.top < er.bottom && rr.bottom > er.top, inView: !!rr && rr.top < innerHeight && rr.bottom > 0 && rr.left < innerWidth && rr.right > 0, w: rr && rr.width }; }, sel);
      T.ok(r.ring && r.op === 1 && r.overlap && r.inView, `${dark ? 'dark' : 'light'}: ${k} target (${sel}): ring is visible, on screen and around it ${JSON.stringify(r)}`);
      if (k === 'closed') T.ok(before.det === false && r.det === true, `${k}: the closed details opened`);
      if (k === 'panel') T.ok(before.pan === true && r.pan === false, `${k}: the hidden tab panel was switched on`);
      if (k === 'other') T.ok(before.part !== before.cur && r.vis, `${k}: its part (${before.part}) was opened from ${before.cur}`);
      if (OUT && !dark) await q.screenshot({ path: OUT + '/ring-' + k + '.png' });
      await q.evaluate(() => { const r = document.querySelector('.lab-ring'); if (r) r.remove(); document.getElementById('ring-steps').remove(); });
    }
    await ctx.close();
  }
  // Reduced motion: still a steady ring, no ::after pulse
  const ctx = await T.ctxFor(b);
  const p = await ctx.newPage();
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto('file://' + T.ROOT + '/lab05.html'); await p.waitForTimeout(900);
  await (await p.$('.si-show')).click(); await p.waitForTimeout(800);
  const rm = await p.evaluate(() => { const r = document.querySelector('.lab-ring'); return r && { still: r.classList.contains('is-still'), after: getComputedStyle(r, '::after').display, op: getComputedStyle(r).opacity }; });
  T.ok(rm && rm.still && rm.after === 'none' && rm.op === '1', 'reduced motion: steady ring, no pulse ' + JSON.stringify(rm));
  await b.close();
  T.done('t31-ring');
})();
