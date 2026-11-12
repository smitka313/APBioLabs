/* Shared helpers for the Playwright tests. Run any test with:
     NODE_PATH=$(npm root -g) node tests/<name>.js
   They open the site from disk (file://), seed the sign-in and tour flags so nothing blocks the page,
   and exit non-zero if any check fails. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.log('  FAIL: ' + msg); } else console.log('  ok:   ' + msg); }
function done(name) { console.log(`\n${name}: ${checks - failures}/${checks} checks passed`); process.exitCode = failures ? 1 : 0; }

async function launch() { return chromium.launch(); }
/* New context: signed in, tour dismissed. opts: {width, height, dark, touch, seed: {key: value}} */
async function ctxFor(b, o = {}) {
  const ctx = await b.newContext({ viewport: { width: o.width || 1366, height: o.height || 768 }, colorScheme: o.dark ? 'dark' : 'light', hasTouch: !!o.touch, isMobile: !!o.mobile });
  await ctx.addInitScript(() => { try {
    if (!sessionStorage.getItem('__seeded') && !localStorage.getItem('aplab:student')) localStorage.setItem('aplab:student', JSON.stringify({ name: 'Test Student', period: '3' }));
    if (!localStorage.getItem('aplab:tour')) localStorage.setItem('aplab:tour', JSON.stringify({ seen: true, v: 1 }));
    sessionStorage.setItem('__seeded', '1');
  } catch (e) { /* ignore */ } });
  return ctx;
}
async function open(ctx, file, hash = '') {
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/gc\.zgo\.at|net::|Failed to load resource|fonts\.g/.test(m.text())) p.errors.push('console: ' + m.text()); });
  await p.goto('file://' + ROOT + '/' + file + (hash ? '#' + hash : ''));
  await p.waitForTimeout(900);
  return p;
}
const LABS = Array.from({ length: 13 }, (_, i) => 'lab' + String(i + 1).padStart(2, '0'));
module.exports = { ok, done, launch, ctxFor, open, LABS, ROOT };
