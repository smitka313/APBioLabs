/* Issue A for Labs 1-7: computed results survive a reload. Run: NODE_PATH=$(npm root -g) node tests/t26-persist-labs1-7.js [lab01 ...] */
const { ok, done, launch, ctxFor, open } = require('./_h');
const T = {};
const txt = (p, s) => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', s);
const go = async (p, slug) => { await p.evaluate(s => Lab.pages.go(s), slug); await p.waitForTimeout(350); };
const reload = async p => { await p.reload(); await p.waitForTimeout(1500); };
const badges = p => p.evaluate(() => [...document.querySelectorAll('.tab-badge')].filter(b => !b.hidden && getComputedStyle(b).display !== 'none').length);
module.exports = { T, txt, go, reload, badges };

T.lab01 = async (b) => {
  const ctx = await ctxFor(b); const p = await open(ctx, 'lab01.html');
  await go(p, 'grow-and-score'); await p.click('#autocount'); await p.waitForTimeout(400);
  await go(p, 'select-and-pollinate'); await p.fill('#p-predict-selection', 'Higher, because heritable.');
  await p.click('#select-btn'); await p.waitForTimeout(300); await p.click('#pollinate');
  await p.waitForFunction(() => /seed|pollinat/i.test(document.querySelector('#sel-status').textContent) && !/Brushing/.test(document.querySelector('#sel-status').textContent), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(800); await p.click('#grow'); await p.waitForTimeout(400);
  await go(p, 'generation-2'); await p.click('#score2'); await p.waitForTimeout(600);
  const ct = await txt(p, '#c-t'); ok(/\d/.test(ct), 'lab01: Gen2 Welch t computed ' + ct);
  await p.fill('#in-S', '8'); await p.fill('#in-R', '3'); await p.fill('#in-h2', '0.4'); await p.click('#check-calc'); await p.waitForTimeout(200);
  const cs = await txt(p, '#calc-status'); ok(cs.length > 3, 'lab01: calc check status ' + cs);
  await go(p, 'design'); await p.fill('#p-predict-design', 'It will rise.').catch(() => {});
  await p.click('#d-run'); await p.waitForTimeout(1500);
  const r1 = await txt(p, '#d-r1'), rt = await txt(p, '#d-rt'); ok(/\d/.test(r1) && /\d/.test(rt), 'lab01: design readouts ' + r1 + ' / ' + rt);
  await go(p, 'analyze');
  ok(await p.inputValue('#ta-m') === '', 'lab01: t-test starts empty');
  await p.click('#tt-fill'); await p.waitForTimeout(300); const tt = await txt(p, '#tt-t'); ok(/\d/.test(tt), 'lab01: t calculated ' + tt);
  await reload(p);
  ok((await txt(p, '#c-t')) === ct, 'lab01: c-t survives reload (' + await txt(p, '#c-t') + ')');
  ok((await txt(p, '#d-r1')) === r1 && (await txt(p, '#d-rt')) === rt, 'lab01: design readouts survive reload');
  ok((await txt(p, '#tt-t')) === tt, 'lab01: t-test result survives reload');
  ok((await txt(p, '#calc-status')) === cs, 'lab01: calc check status survives reload');
  ok(await p.evaluate(() => document.querySelector('#d-chart svg, #d-chart canvas, #d-chart img') != null), 'lab01: design chart redrawn');
  ok((await badges(p)) === 0, 'lab01: no "new" badges after reload');
  // worked example
  await go(p, 'analyze');
  await p.click('#tt-example'); await p.waitForTimeout(300);
  ok(await p.locator('#tt-banner').isVisible() && /EXAMPLE/.test(await txt(p, '#tt-banner')), 'lab01: example banner shown');
  await reload(p);
  ok(await p.locator('#tt-banner').isHidden(), 'lab01: example banner not restored');
  ok((await txt(p, '#tt-t')) === tt, 'lab01: example was not saved as student work (t back to mine)');
  await p.click('#tt-example'); await p.click('#tt-clear-ex'); await p.waitForTimeout(200);
  ok(await p.inputValue('#ta-m') === '' && (await txt(p, '#tt-t')) === '—', 'lab01: Clear example blanks the calculator');
  ok(p.errors.length === 0, 'lab01: no page errors ' + p.errors.join('|'));
  await ctx.close();
};

if (require.main === module) (async () => {
  const want = process.argv.slice(2), b = await launch();
  for (const k of Object.keys(T)) { if (want.length && !want.includes(k)) continue; console.log('\n== ' + k); await T[k](b); }
  await b.close(); done('t26 persistence labs 1-7');
})().catch(e => { console.error(e); process.exit(1); });
