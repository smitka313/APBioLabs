/* openscied-b2-peat-bog-lab.html (Peat Bog Carbon Lab) on an iPhone-sized screen in dark mode, in the engine picked by
   BROWSER=chromium|firefox|webkit. Catches Safari-only failures: an SVG picture that draws nothing, sliders that lose their styling or
   stop working, charts that do not draw, number boxes, the enlarge dialog. Prints errors so CI logs show the cause; screenshots go to test-artifacts/.
   Run: BROWSER=webkit NODE_PATH=./node_modules node tests/t98-webkit-b2-peat-bog.js */
const T = require('./_h');
const playwright = require('playwright');
const fs = require('fs'), path = require('path');
const PAGE = 'openscied-b2-peat-bog-lab.html';
const OUT = path.join(T.ROOT, 'test-artifacts'); fs.mkdirSync(OUT, { recursive: true });
const stub = ctx => ctx.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
(async () => {
  console.log('Engine: ' + T.BROWSER);
  const b = await T.launch(); console.log('Version: ' + b.version());
  const srv = await T.serve();
  const dev = T.BROWSER === 'firefox' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true } : playwright.devices['iPhone 15'];
  const ctx = await b.newContext({ ...dev, colorScheme: 'dark' });
  await T.routeLibs(ctx); await stub(ctx);
  await ctx.addInitScript(() => { try { localStorage.setItem('aplab:student', JSON.stringify({ name: 'Test Student', period: '3' })); localStorage.setItem('aplab:tour', JSON.stringify('done')); } catch (e) {} });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '')));
  p.on('console', m => { if (m.type() === 'error') errs.push('console.' + m.type() + ': ' + m.text()); });
  await p.goto(srv.url + PAGE + '#overview'); await p.waitForTimeout(2000);
  const go = async id => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForTimeout(1200); };
  const shot = async n => p.screenshot({ path: path.join(OUT, `t98-peat-${T.BROWSER}-${n}.png`), fullPage: true }).catch(e => console.log('screenshot failed: ' + e.message));
  const svgInfo = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { shapes: e.querySelectorAll('path, rect, circle, ellipse, line, text, g').length, w: Math.round(r.width), h: Math.round(r.height), texts: e.querySelectorAll('text').length }; }, sel);

  await go('bog'); await shot('bog');
  let r = await svgInfo('#bog-svg'); console.log('bog: ' + JSON.stringify(r));
  T.ok(r && r.shapes > 150 && r.texts > 8 && r.w > 300 && r.h > 100, 'the bog picture is drawn (' + JSON.stringify(r) + ')');
  const before = await p.locator('#pVal').innerText();
  await p.evaluate(() => { const s = document.getElementById('s-co2'); s.value = 1200; s.dispatchEvent(new Event('input', { bubbles: true })); });
  T.ok(await p.locator('#pVal').innerText() !== before && await p.locator('#n-co2').inputValue() === '1200', 'a slider changes the rates and its number box');
  await p.fill('#n-wet', '20'); await p.press('#n-wet', 'Enter');
  T.ok(await p.locator('#s-wet').inputValue() === '20', 'typing in a number box moves the slider');
  const th = await p.evaluate(() => document.getElementById('s-wet').getBoundingClientRect().height);
  T.ok(th >= 24, 'slider is a tall tap target ' + th);
  await p.click('#presets .btn:has-text("Zombie fire conditions")');
  await p.click('#record-bog');
  T.ok(await p.locator('#nav-count').innerText() === '1', 'Record this trial works');
  await go('graph'); await shot('graph');
  r = await svgInfo('#explore'); console.log('graph: ' + JSON.stringify(r));
  T.ok(r && r.shapes > 30 && r.w > 250, 'the graph is drawn ' + JSON.stringify(r));
  await go('zombie'); await p.click('[data-season="2"]'); await shot('zombie');
  r = await svgInfo('#zombie-svg'); console.log('zombie: ' + JSON.stringify(r));
  T.ok(r && r.shapes > 60 && /smolder/i.test(await p.locator('#zCaption').innerText()), 'the zombie fire picture and caption are drawn');
  await go('warming'); await shot('warming');
  for (const s of ['#gh-svg', '#c-co2', '#c-temp']) { r = await svgInfo(s); T.ok(r && r.shapes > 12 && r.w > 200, s + ' is drawn ' + JSON.stringify(r)); }
  await go('bog'); await p.click('[data-enlarge="bog"]'); await p.waitForTimeout(500);
  const big = await p.evaluate(() => { const s = document.querySelector('#enlarge-dialog #bog-svg'); if (!s) return null; const r = s.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth }; });
  T.ok(big && big.w > 0 && big.w <= big.vw, 'the enlarged picture fits the window ' + JSON.stringify(big));
  await shot('enlarged'); await p.click('#enlarge-close');
  await go('trials'); await shot('trials');
  T.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways page scrolling');
  console.log('--- page errors / console (' + errs.length + ') ---'); errs.forEach(e => console.log('  ' + e));
  T.ok(errs.length === 0, 'no page errors or console errors');
  await b.close(); srv.close();
  T.done('t98-webkit-b2-peat-bog [' + T.BROWSER + ']');
})().catch(e => { console.error(e); process.exit(1); });
