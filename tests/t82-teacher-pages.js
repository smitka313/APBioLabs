/* The teacher quick start, sample report and feedback pages share teachers.html's layout: a .t-hero header band (breadcrumb,
   eyebrow, h1, lede), content in .wrap.wrap--wide.gutter, the site footer, and no horizontal overflow on a phone or a laptop.
   Run: NODE_PATH=$(npm root -g) node tests/t82-teacher-pages.js */
const T = require('./_h');
const PAGES = ['getting-started.html', 'sample-report.html', 'feedback.html'];

(async () => {
  const b = await T.launch(); const srv = await T.serve();
  for (const [w, h, dark] of [[390, 844, true], [1366, 768, false]]) {
    const ctx = await T.ctxFor(b, { width: w, height: h, dark });
    for (const file of PAGES) {
      console.log(`${file} at ${w}px ${dark ? 'dark' : 'light'}`);
      const p = await T.open(ctx, file, '', srv.url);
      const r = await p.evaluate(() => {
        const hero = document.querySelector('body > header.t-hero');
        const q = s => hero && hero.querySelector(s);
        const heroBg = hero && getComputedStyle(hero).backgroundColor, bodyBg = getComputedStyle(document.body).backgroundColor;
        const main = document.querySelector('main#main');
        return {
          hero: !!hero, wrap: !!q(':scope > .wrap.wrap--wide.gutter'), crumbs: !!q('nav.crumbs[aria-label="Breadcrumb"] a[href="index.html"]') && !!q('nav.crumbs a[href="teachers.html"]'),
          eyebrow: !!(q('.eyebrow') && q('.eyebrow').textContent.trim()), h1: document.querySelectorAll('h1').length === 1 && !!q('h1'), lede: !!(q('p.lede') && q('p.lede').textContent.trim().length > 30),
          band: heroBg !== bodyBg, mainWrap: !!(main && main.querySelector(':scope > .wrap.wrap--wide.gutter')), sections: main ? main.querySelectorAll('section.tsec').length : 0,
          footer: !!document.querySelector('footer.site-footer .credit'), skip: !!document.querySelector('a.skip-link[href="#main"]'),
          theme: !!document.querySelector('.crumbs .theme-switch'),
          sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
          wide: [...document.querySelectorAll('main *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > innerWidth + 1 && !e.closest('.rv-paper .rv-table'); }).map(e => e.tagName + '.' + e.className).slice(0, 3),
        };
      });
      T.ok(r.hero && r.wrap, 'header band (.t-hero > .wrap.wrap--wide.gutter)');
      T.ok(r.band, 'header band has its own background');
      T.ok(r.crumbs && r.theme, 'breadcrumb links (All labs, For teachers) with the theme switch');
      T.ok(r.eyebrow && r.h1 && r.lede, 'eyebrow, a single h1 and a lede in the header');
      T.ok(r.mainWrap && r.sections >= 2, `content in main > .wrap.wrap--wide.gutter (${r.sections} sections)`);
      T.ok(r.footer && r.skip, 'site footer and skip link');
      T.ok(r.sw <= r.cw && !r.wide.length, `no horizontal overflow (${r.sw} <= ${r.cw})` + (r.wide.length ? ' ' + r.wide.join(', ') : ''));
      if (file === 'feedback.html') T.ok(await p.evaluate(() => !!document.querySelector('a[href^="mailto:rsmitka@roseville.k12.mi.us"]') && !!document.querySelector('a[href="https://github.com/smitka313/APBioLabs/issues/new"]')), 'feedback email and GitHub links kept');
      if (file === 'getting-started.html') T.ok(await p.evaluate(() => ['index.html', 'projector.html', 'teacher-dashboard.html', 'teachers.html'].every(h => document.querySelector(`main a[href="${h}"]`))), 'quick-start links kept');
      T.ok(!p.errors.length, 'no page errors' + (p.errors.length ? ': ' + p.errors.join(' | ') : ''));
      await p.close();
    }
    await ctx.close();
  }
  await b.close(); srv.close();
  T.done('t82-teacher-pages');
})().catch(e => { console.error(e); process.exit(1); });
