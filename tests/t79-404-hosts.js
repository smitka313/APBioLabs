/* The 404 page is served for any missing address, at any depth, on both hosts:
   biologylabbench.com (site at the root, Cloudflare Pages) and smitka313.github.io/APBioLabs/ (legacy GitHub Pages).
   It must load its stylesheet, icon and lab.js, and link to the labs and teacher guide, on both. */
const T = require('./_h');
const http = require('http'), fs = require('fs'), path = require('path');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
function server(prefix) {
  return http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (prefix) { if (!p.startsWith(prefix)) { r.writeHead(404); return r.end(); } p = p.slice(prefix.length - 1); }
    let f = path.join(T.ROOT, p); const missing = !f.startsWith(T.ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory();
    if (missing) f = path.join(T.ROOT, '404.html');
    r.writeHead(missing ? 404 : 200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
}
(async () => {
  const b = await T.launch();
  for (const [label, prefix, host] of [['biologylabbench.com layout', '', null], ['github.io layout', '/APBioLabs/', 'smitka313.github.io']]) {
    const s = server(prefix); await new Promise(ok => s.listen(0, ok)); const port = s.address().port;
    const origin = host ? `http://${host}:${port}` : `http://127.0.0.1:${port}`;
    const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } });
    // A visitor with saved work stays on the old host (no redirect), so the old-host page itself is exercised.
    await ctx.addInitScript(() => { try { localStorage.setItem('aplab:lab05:a1', '"x"'); localStorage.setItem('aplab:tour', 'done'); } catch (e) {} });
    const p = await ctx.newPage(), bad = [], errs = [];
    if (host) await p.route(`${origin}/**`, async r => r.fulfill({ response: await ctx.request.fetch(r.request().url().replace(`${host}:${port}`, `127.0.0.1:${port}`)) }));
    await p.route(u => !String(u).startsWith(origin), r => r.abort());
    p.on('response', r => { if (r.status() >= 400 && !r.url().includes('/deep/missing')) bad.push(r.status() + ' ' + r.url().slice(origin.length)); });
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(`${origin}${prefix || '/'}deep/missing/page`); await p.waitForTimeout(800);
    const root = prefix || '/';
    const info = await p.evaluate(() => ({
      styled: getComputedStyle(document.querySelector('.btn--primary')).paddingTop !== '0px',
      links: [...document.querySelectorAll('.nf .btn')].map(a => new URL(a.href).pathname),
      img: new URL(document.querySelector('.flask').src).pathname,
      skip: !!document.getElementById('main'), lab: typeof window.Lab === 'object' }));
    T.ok(bad.length === 0, `${label}: every asset loads (${bad.join(', ') || 'no failed requests'})`);
    T.ok(info.styled, `${label}: the site stylesheet is applied`);
    T.ok(info.links[0] === root + 'index.html' && info.links[1] === root + 'teachers.html', `${label}: buttons go to ${root}index.html and ${root}teachers.html (${info.links.join(', ')})`);
    T.ok(info.img === root + 'favicon.svg', `${label}: icon comes from ${root}favicon.svg`);
    T.ok(info.lab, `${label}: lab.js runs (theme switch and preferences)`);
    T.ok(info.skip, `${label}: the skip link has a target`);
    T.ok(errs.length === 0, `${label}: no page errors ${errs.join(' | ')}`);
    await ctx.close(); s.close();
  }
  await b.close(); T.done('t79-404-hosts');
})();
