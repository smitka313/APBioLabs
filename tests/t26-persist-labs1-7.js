/* Issue A for Labs 1-7: computed results survive a reload. Run: NODE_PATH=$(npm root -g) node tests/t26-persist-labs1-7.js [lab01 ...] */
const { ok, done, launch, ctxFor, open } = require('./_h');
const T = {};
const txt = (p, s) => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', s);
const go = async (p, slug) => { await p.evaluate(s => Lab.pages.go(s), slug); await p.waitForTimeout(350); };
const reload = async p => { await p.reload(); await p.waitForTimeout(1500); };
const badgeIds = p => p.evaluate(() => [...document.querySelectorAll('.tab-badge')].filter(b => !b.hidden && getComputedStyle(b).display !== 'none').map(b => (b.closest('.sim-tab') || {}).id));
const badges = async p => { const a = await badgeIds(p); if (a.length) console.log('    badges on:', a.join(',')); return a.length; };
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


T.lab02 = async (b) => {
  const ctx = await ctxFor(b); const p = await open(ctx, 'lab02.html');
  ok(await p.inputValue('#cs-aa') === '' && await p.inputValue('#cs-ab') === '' && await p.inputValue('#cs-bb') === '', 'lab02: chi-square calculator starts empty');
  await go(p, 'card-model'); await p.click('#card-run5'); await p.click('#card-step'); await p.waitForTimeout(300);
  const cg = await txt(p, '#card-gen'), cp = await txt(p, '#card-p'), cgeno = await txt(p, '#card-geno');
  ok(cg === '6', 'lab02: card model at generation 6 (' + cg + ')');
  await go(p, 'build-the-model'); await p.fill('#p-predict-spreadsheet', 'p stays near start.'); await p.fill('#ss-n', '40'); await p.dispatchEvent('#ss-n', 'change'); await p.click('#ss-recalc'); await p.waitForTimeout(300);
  const sp = await txt(p, '#ss-newp'), sc = await txt(p, '#ss-chi');
  await go(p, 'many-generations'); await p.fill('#mg-g', '30').catch(() => {}); await p.evaluate(() => { const e = document.getElementById('mg-g'); e.value = 30; e.dispatchEvent(new Event('input')); });
  await p.fill('#p-predict-drift', 'Spread grows.'); await p.click('#mg-run'); await p.waitForFunction(() => /Done/.test(document.querySelector('#mg-status').textContent), null, { timeout: 60000 });
  const mm = await txt(p, '#mg-mean'), ms = await txt(p, '#mg-sd');
  await go(p, 'design'); await p.fill('#p-predict-design', 'Small N drifts more.'); await p.click('#dz-run'); await p.waitForTimeout(1500);
  const dn = await txt(p, '#dz-note'); ok(dn.length > 5, 'lab02: design experiment ran: ' + dn.slice(0, 40));
  await go(p, 'analyze'); await p.fill('#cs-aa', '30'); await p.fill('#cs-ab', '40'); await p.fill('#cs-bb', '30'); await p.click('#cs-run'); await p.waitForTimeout(300);
  const cst = await txt(p, '#cs-status'); ok(/χ²/.test(cst), 'lab02: chi-square computed');
  const ssm = await p.evaluate(() => localStorage.getItem('aplab:lab02:keyres:chi2-hw')); ok(!!ssm, 'lab02: key result stored for own data');
  await reload(p);
  await go(p, 'card-model');
  ok((await txt(p, '#card-gen')) === cg && (await txt(p, '#card-p')) === cp && (await txt(p, '#card-geno')) === cgeno, 'lab02: card model restored (gen ' + await txt(p, '#card-gen') + ', p ' + await txt(p, '#card-p') + ' vs ' + cp + ')');
  ok(await p.evaluate(() => document.querySelector('#card-chart svg, #card-chart canvas, #card-chart img') != null), 'lab02: card chart drawn');
  await go(p, 'build-the-model'); ok((await txt(p, '#ss-newp')) === sp && (await txt(p, '#ss-chi')) === sc && await p.inputValue('#ss-n') === '40', 'lab02: spreadsheet run restored (' + await txt(p, '#ss-newp') + ' vs ' + sp + ')');
  await go(p, 'many-generations'); ok((await txt(p, '#mg-mean')) === mm && (await txt(p, '#mg-sd')) === ms && await p.inputValue('#mg-g') === '30', 'lab02: many-generations run restored (' + await txt(p, '#mg-mean') + ' vs ' + mm + ')');
  await go(p, 'design'); ok((await txt(p, '#dz-note')) === dn, 'lab02: design note restored'); ok(await p.evaluate(() => document.querySelector('#dz-chart svg, #dz-chart canvas, #dz-chart img') != null && /restored/.test(document.querySelector('#dz-status').textContent)), 'lab02: design chart restored');
  await go(p, 'analyze'); ok((await txt(p, '#cs-status')) === cst.replace(/^/, '') && await p.inputValue('#cs-aa') === '30', 'lab02: chi-square result restored');
  ok((await badges(p)) === 0, 'lab02: no "new" badges after reload');
  await p.click('#cs-example'); ok(await p.locator('#cs-banner').isVisible(), 'lab02: example banner');
  await reload(p); await go(p, 'analyze'); ok(await p.inputValue('#cs-aa') === '30' && await p.locator('#cs-banner').isHidden(), 'lab02: example not saved');
  await p.click('#cs-example'); await p.click('#cs-clear-ex'); ok(await p.inputValue('#cs-aa') === '', 'lab02: Clear example blanks it');
  await p.click('#cs-mine'); ok(/χ²/.test(await txt(p, '#cs-status')) && await p.inputValue('#cs-aa') !== '', 'lab02: Use my data fills from spreadsheet run');
  ok(p.errors.length === 0, 'lab02: no page errors ' + p.errors.join('|'));
  await ctx.close();
};

if (require.main === module) (async () => {
  const want = process.argv.slice(2), b = await launch();
  for (const k of Object.keys(T)) { if (want.length && !want.includes(k)) continue; console.log('\n== ' + k); await T[k](b); }
  await b.close(); done('t26 persistence labs 1-7');
})().catch(e => { console.error(e); process.exit(1); });
