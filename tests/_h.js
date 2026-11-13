/* Shared helpers for the Playwright tests. Run any test with:
     NODE_PATH=$(npm root -g) node tests/<name>.js
   They open the site from disk (file://), seed the sign-in and tour flags so nothing blocks the page,
   and exit non-zero if any check fails. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');

/* The sandbox blocks CDNs. Production pages load these pinned libraries from a CDN; tests answer those requests from disk.
   docx comes from the npm global modules; qrcode-generator and JSZip are vendored in tests/fixtures (tests only). */
const LIBS = [
  [/cdn\.jsdelivr\.net\/npm\/docx|unpkg\.com\/docx/, () => path.join(require('child_process').execSync('npm root -g').toString().trim(), 'docx/dist/index.umd.cjs')],
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/qrcode-generator\/1\.4\.4\//, () => path.join(__dirname, 'fixtures/qrcode-1.4.4.js')],
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/jszip\/3\.10\.1\//, () => path.join(__dirname, 'fixtures/jszip-3.10.1.min.js')],
];
async function routeLibs(ctx) {
  for (const [re, file] of LIBS) await ctx.route(re, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(file()) }));
}
/* Tiny static server so tests can open the site over http (a transfer link needs a real origin). Returns {url, close}. */
function serve() {
  const http = require('http');
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
  const srv = http.createServer((req, res) => {
    let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0])); if (f.endsWith(path.sep)) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ url: 'http://127.0.0.1:' + srv.address().port + '/', close: () => srv.close() })));
}

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.log('  FAIL: ' + msg); } else console.log('  ok:   ' + msg); }
function done(name) { console.log(`\n${name}: ${checks - failures}/${checks} checks passed`); process.exitCode = failures ? 1 : 0; }

async function launch() { return chromium.launch(); }
/* New context: signed in, tour dismissed. opts: {width, height, dark, touch, seed: {key: value}} */
async function ctxFor(b, o = {}) {
  const ctx = await b.newContext({ viewport: { width: o.width || 1366, height: o.height || 768 }, colorScheme: o.dark ? 'dark' : 'light', hasTouch: !!o.touch, isMobile: !!o.mobile });
  await routeLibs(ctx);
  await ctx.addInitScript(() => { try {
    if (!sessionStorage.getItem('__seeded') && !localStorage.getItem('aplab:student')) localStorage.setItem('aplab:student', JSON.stringify({ name: 'Test Student', period: '3' }));
    if (!localStorage.getItem('aplab:tour')) localStorage.setItem('aplab:tour', JSON.stringify({ seen: true, v: 1 }));
    sessionStorage.setItem('__seeded', '1');
  } catch (e) { /* ignore */ } });
  return ctx;
}
async function open(ctx, file, hash = '', base) {
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/gc\.zgo\.at|net::|Failed to load resource|fonts\.g/.test(m.text())) p.errors.push('console: ' + m.text()); });
  await p.goto((base || 'file://' + ROOT + '/') + file + (hash ? '#' + hash : ''));
  await p.waitForTimeout(900);
  return p;
}
const LABS = Array.from({ length: 13 }, (_, i) => 'lab' + String(i + 1).padStart(2, '0'));
module.exports = { ok, done, launch, ctxFor, open, LABS, ROOT, serve, routeLibs };
