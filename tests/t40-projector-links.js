/* Projector mode entry points: teachers.html, index footer, a quiet link in every lab header (not on other pages). */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  for (const lab of T.LABS) {
    const p = await T.open(ctx, lab + '.html');
    const l = await p.evaluate(() => { const a = document.querySelector('.lab-header .crumbs .project-link'); return a && { href: a.getAttribute('href'), title: a.title, text: a.textContent.trim(), inCrumbs: true }; });
    T.ok(l && l.href === `projector.html#${lab}` && /Open projector mode for this lab \(for teachers\)/.test(l.title) && /Project this lab/.test(l.text), `${lab}: "Project this lab" link to projector.html#${lab}`);
    T.ok(await p.locator('.project-link').count() === 1 && p.errors.length === 0, `${lab}: exactly one, no errors`);
    await p.close();
  }
  for (const f of ['index.html', 'teachers.html', 'teacher-dashboard.html', 'teacher-lab05.html']) {
    const p = await T.open(ctx, f);
    T.ok(await p.locator('.project-link').count() === 0, `${f}: no "Project this lab" link`);
    await p.close();
  }
  let p = await T.open(ctx, 'teachers.html');
  T.ok(await p.locator('#projector-btn').getAttribute('href') === 'projector.html' && await p.locator('#projector-btn').isVisible(), 'teachers.html: prominent Projector mode button');
  const txt = await p.locator('#projector').innerText();
  T.ok(/Open Projector mode/.test(txt) && /tick today/.test(txt) && /press F for full screen/.test(txt) && /Space starts or pauses/.test(txt) && /Esc goes back/.test(txt) && /projector\.html#lab05/.test(txt) && /remembers your last setup/.test(txt), 'teachers.html: Using projector mode section (3 steps, #lab05 bookmark, remembers setup)');
  T.ok(await p.locator('.toc a[href="#projector"]').count() === 1, 'teachers.html: in the contents list');
  p = await T.open(ctx, 'index.html');
  T.ok(await p.locator('.site-footer a[href="projector.html"]').count() === 1, 'index.html footer links to Projector mode');
  p = await T.open(ctx, 'lab05.html');
  await p.click('.project-link'); await p.waitForTimeout(800);
  T.ok(/projector\.html#lab05$/.test(p.url()), 'the link opens projector.html#lab05: ' + p.url());
  await b.close(); T.done('t40-projector-links');
})();
