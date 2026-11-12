/* #13 Home page images paint immediately; below-the-fold ones may stay lazy but reserve their space */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  for (const [w, h] of [[1366, 768], [1440, 900], [400, 800]]) {
    console.log(`Viewport ${w}x${h}`);
    const ctx = await T.ctxFor(b, { width: w, height: h });
    const p = await ctx.newPage(); p.errors = [];
    p.on('pageerror', e => p.errors.push(e.message));
    await p.goto('file://' + T.ROOT + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(700);   // no scrolling at all
    const r = await p.evaluate(() => Array.from(document.querySelectorAll('img.thumb')).map(i => {
      const rc = i.getBoundingClientRect();
      return { src: i.getAttribute('src'), done: i.complete && i.naturalWidth > 0, top: rc.top, lazy: i.loading === 'lazy', w: i.getAttribute('width'), h: i.getAttribute('height'), box: rc.height };
    }));
    T.ok(r.length === 13, '13 card images');
    const fold = h * 1.25;
    const above = r.filter(i => i.top < fold);
    T.ok(above.length >= 1 && above.every(i => i.done), `every image in or near the first screen (${above.length}) has loaded without scrolling: ` + above.filter(i => !i.done).map(i => i.src));
    T.ok(above.every(i => !i.lazy), 'none of those is loading="lazy"');
    T.ok(r.every(i => i.w && i.h && i.box > 40), 'all images have width and height attributes and a reserved box');
    // shift check: layout height must not change after every image has loaded
    const before = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } });
    await p.waitForTimeout(600);
    const after = await p.evaluate(() => document.documentElement.scrollHeight);
    T.ok(before === after, `page height does not change while images load (${before} -> ${after})`);
    const all = await p.evaluate(() => Array.from(document.querySelectorAll('img.thumb')).every(i => i.complete && i.naturalWidth > 0));
    T.ok(all, 'every image paints once scrolled to');
    // no animation/opacity trick hides them
    const op = await p.evaluate(() => Array.from(document.querySelectorAll('img.thumb')).every(i => getComputedStyle(i).opacity === '1' && getComputedStyle(i).visibility === 'visible'));
    T.ok(op, 'images are fully opaque');
    T.ok(p.errors.length === 0, 'no page errors');
    await ctx.close();
  }
  await b.close();
  T.done('t13-home-images');
})();
