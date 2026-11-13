/* Theme switch: Light / Dark / Auto.
   Run: NODE_PATH=$(npm root -g) node tests/t25-theme.js */
const T = require('./_h');
const fs = require('fs');
const path = require('path');

const KEY = 'aplab:pref:theme';
const PAGES = ['index.html', 'teachers.html', 'teacher-dashboard.html', ...T.LABS.map(l => l + '.html')];
const attr = p => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
const pressed = p => p.evaluate(() => Array.from(document.querySelectorAll('.theme-switch button')).filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.mode));
const stored = p => p.evaluate(k => localStorage.getItem(k), KEY);

(async () => {
  const srv = await T.serve(), b = await T.launch();

  console.log('Head script on every page');
  const SNIP = "localStorage.getItem('aplab:pref:theme')";
  for (const f of [...PAGES, '404.html']) {
    const html = fs.readFileSync(path.join(T.ROOT, f), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    const i = head.indexOf(SNIP), firstLink = head.search(/<link\b[^>]*stylesheet/);
    T.ok(i > 0 && (firstLink < 0 || i < firstLink) && (head.match(/aplab:pref:theme/g) || []).length === 1, f + ': inline theme script in <head>, before the stylesheets');
  }

  console.log('Modes apply and persist');
  let ctx = await T.ctxFor(b, { dark: false });
  let p = await T.open(ctx, 'index.html', '', srv.url);
  T.ok(await p.locator('.theme-switch').count() === 1, 'switch on the home page');
  T.ok(await attr(p) === null && (await pressed(p)).join() === 'auto', 'default is Auto: no data-theme, Auto pressed');
  const bg = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const lightBg = await bg();
  await p.getByRole('button', { name: 'Dark' }).click();
  T.ok(await attr(p) === 'dark' && await stored(p) === 'dark' && (await pressed(p)).join() === 'dark', 'Dark applies, is stored, aria-pressed follows');
  T.ok(await bg() !== lightBg, 'the page really changes colour (' + lightBg + ' → ' + await bg() + ')');
  await p.reload(); await p.waitForTimeout(500);
  T.ok(await attr(p) === 'dark' && (await pressed(p)).join() === 'dark', 'Dark survives a reload');
  for (const f of ['lab05.html', 'teachers.html', 'teacher-dashboard.html']) {
    await p.goto(srv.url + f); await p.waitForTimeout(600);
    T.ok(await attr(p) === 'dark' && (await pressed(p)).join() === 'dark' && await p.locator('.theme-switch').count() === 1, f + ': dark and switch present');
  }
  await p.getByRole('button', { name: 'Light' }).click();
  T.ok(await attr(p) === 'light' && await stored(p) === 'light', 'Light applies and is stored');
  await p.goto(srv.url + 'lab05.html'); await p.waitForTimeout(600);
  T.ok(await attr(p) === 'light', 'Light carries to a lab');
  await p.getByRole('button', { name: /^Auto/ }).click();
  T.ok(await attr(p) === null && await stored(p) === null && (await pressed(p)).join() === 'auto', 'Auto removes data-theme and the stored choice');
  // Auto follows the computer
  await p.emulateMedia({ colorScheme: 'dark' });
  T.ok(await p.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches) && await bg() !== lightBg, 'Auto follows the computer\'s dark setting');
  await p.emulateMedia({ colorScheme: 'light' });

  console.log('Accessibility');
  const sw = p.locator('.theme-switch');
  T.ok(await sw.getAttribute('role') === 'group' && await sw.getAttribute('aria-label') === 'Color theme', 'group labelled "Color theme"');
  await p.locator('.theme-opt[data-mode="light"]').focus(); await p.keyboard.press('Tab'); await p.keyboard.press('Enter');
  T.ok(await attr(p) === 'dark', 'keyboard: Tab to Dark and Enter applies it');
  await p.keyboard.press('Tab'); await p.keyboard.press('Space');
  T.ok(await attr(p) === null, 'keyboard: Space on Auto applies it');
  const ring = await p.evaluate(() => { const e = document.querySelector('.theme-opt[data-mode="auto"]'); e.focus(); const s = getComputedStyle(e); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
  T.ok(ring, 'visible focus ring');
  await ctx.close();

  console.log('No flash of the wrong theme');
  ctx = await T.ctxFor(b, { dark: false });
  await ctx.addInitScript(k => { try { localStorage.setItem(k, 'dark'); } catch (e) { /* ignore */ } }, KEY);
  for (const f of ['index.html', 'lab05.html', 'teachers.html']) {
    const pg = await ctx.newPage();
    await pg.route(/\/(lab\.js|style\.css)$/, r => r.abort());   // nothing but the inline head script can set it
    await pg.goto(srv.url + f, { waitUntil: 'domcontentloaded' });
    T.ok(await attr(pg) === 'dark', f + ': data-theme="dark" with lab.js and style.css blocked (set by the head script)');
    await pg.close();
  }
  await ctx.close();

  console.log('Charts and canvases redraw');
  ctx = await T.ctxFor(b, { dark: false });
  p = await T.open(ctx, 'lab05.html', '', srv.url);
  const res = await p.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.style.cssText = 'width:300px;height:100px;display:block'; document.body.append(cv);
    const c = Lab.canvas(cv, 0.3);
    let draws = 0; const draw = () => { draws++; c.ctx.fillStyle = Lab.color('--surface'); c.ctx.fillRect(0, 0, c.w, c.h); };
    c.onresize = draw; draw();
    const px = () => Array.from(c.ctx.getImageData(2, 2, 1, 1).data).join(',');
    const before = px(); let ev = 0; window.addEventListener('aplab:theme', () => ev++);
    Lab.theme.set('dark');
    return { before, after: px(), draws, ev, dark: document.documentElement.getAttribute('data-theme') };
  });
  T.ok(res.dark === 'dark' && res.ev === 1, 'switching fires the "aplab:theme" event once');
  T.ok(res.draws >= 2 && res.before !== res.after, `a Lab.color canvas repaints (${res.before} → ${res.after})`);
  await ctx.close();

  console.log('Sign out and Start over keep the preference');
  for (const mode of ['signout', 'startover']) {
    ctx = await T.ctxFor(b);
    await ctx.addInitScript(k => { try { if (!localStorage.getItem('__t')) { localStorage.setItem('__t', '1'); localStorage.setItem(k, 'dark'); localStorage.setItem('aplab:lab05:field:x', '"a"'); } } catch (e) { /* ignore */ } }, KEY);
    p = await T.open(ctx, 'index.html', '', srv.url);
    T.ok(await stored(p) === 'dark', mode + ': preference seeded');
    if (mode === 'signout') {
      await p.locator('.id-signout').click(); await p.locator('.dm-text').fill('Test');
    } else {
      await p.locator('.manage-data summary').click(); await p.locator('#md-startover').click(); await p.locator('.dm-text').fill('ERASE');
    }
    const nav = p.waitForNavigation({ waitUntil: 'load' }).catch(() => {});
    await p.locator('.dm-confirm').click(); await nav; await p.waitForTimeout(800);
    T.ok(await stored(p) === 'dark' && await attr(p) === 'dark', mode + ': Dark still stored and applied after the erase');
    T.ok(await p.evaluate(() => localStorage.getItem('aplab:lab05:field:x')) === null, mode + ': work really was erased');
    await ctx.close();
  }

  console.log('Sweep in both forced themes (400 px)');
  for (const mode of ['light', 'dark']) {
    ctx = await T.ctxFor(b, { width: 400, height: 800 });
    await ctx.addInitScript(a => { try { localStorage.setItem(a.k, a.m); } catch (e) { /* ignore */ } }, { k: KEY, m: mode });
    let bad = [];
    for (const f of PAGES) {
      const pg = await T.open(ctx, f, '', srv.url);
      const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const th = await attr(pg), n = await pg.locator('.theme-switch').count();
      if (pg.errors.length || ov > 0 || th !== mode || n !== 1) bad.push(`${f} (errors ${pg.errors.length} ${pg.errors[0] || ''}, overflow ${ov}, theme ${th}, switches ${n})`);
      await pg.close();
    }
    T.ok(bad.length === 0, `${mode}: ${PAGES.length} pages with zero errors, zero overflow, switch present` + (bad.length ? ' — ' + bad.join('; ') : ''));
    await ctx.close();
  }

  await b.close(); srv.close();
  T.done('t25-theme');
})();
