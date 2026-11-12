/* #8 Step "go to" buttons are labelled "Show me" and pulse + focus the target on arrival */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  let total = 0;
  for (const lab of T.LABS) {
    const p = await T.open(ctx, lab + '.html');
    T.ok(await p.evaluate(() => document.querySelectorAll('.si-go').length) === 0, `${lab}: no unlabelled go-to buttons (.si-go)`);
    const info = await p.evaluate(() => Array.from(document.querySelectorAll('.steps-box')).map(b => ({ id: b.id, n: b.querySelectorAll('.si-show').length, bad: Array.from(b.querySelectorAll('.si-show')).filter(x => !/^Show me/.test(x.textContent)).length })));
    info.forEach(i => T.ok(i.bad === 0, `${lab} #${i.id}: ${i.n} "Show me" buttons`));
    total += info.reduce((a, i) => a + i.n, 0);
    // click the last non-current one in the first steps box that has any
    const box = info.find(i => i.n > 1) || info.find(i => i.n);
    if (box) {
      const sec = await p.evaluate(id => { const s = document.getElementById(id).closest('section.step'); Lab.pages.go(s); return s.id; }, box.id);
      await p.waitForTimeout(400);
      const btns = await p.$$(`#${box.id} .si-show`);
      for (let k = btns.length - 1; k >= 0; k--) { await btns[k].click(); await p.waitForTimeout(600); if (await p.evaluate(() => !document.activeElement.classList.contains('si-show'))) break; } /* a target that does not exist yet (e.g. a table input before any row) just does nothing */
      const r = await p.evaluate(() => { const a = document.activeElement; return { tag: a && a.tagName, pulse: Array.from(document.querySelectorAll('.lab-pulse')).some(e => e === a || e.contains(a) || a.contains(e) || a.parentElement === e), inView: a && a.getBoundingClientRect().top < innerHeight && a.getBoundingClientRect().bottom > 0, notBody: a !== document.body }; });
      T.ok(r.notBody && r.pulse, `${lab}: after "Show me" focus is on ${r.tag} and a control pulses`);
    }
    T.ok(p.errors.length === 0, `${lab}: no page errors ${p.errors.join(';')}`);
    await p.close();
  }
  T.ok(total > 20, `${total} Show me buttons across the labs`);
  await b.close();
  T.done('t08-show-me');
})();
