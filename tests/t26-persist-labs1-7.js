/* Issue A for Labs 1-7: computed results survive a reload. Run: NODE_PATH=$(npm root -g) node tests/t26-persist-labs1-7.js [lab01 ...] */
const { ok, done, launch, ctxFor, open } = require('./_h');
const T = {};
const txt = (p, s) => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', s);
const go = async (p, slug) => { await p.evaluate(s => Lab.pages.go(s), slug); await p.waitForTimeout(350); };
const reload = async p => { await p.reload(); await p.waitForTimeout(1500); };
const badgeIds = p => p.evaluate(() => [...document.querySelectorAll('.tab-badge')].filter(b => !b.hidden && getComputedStyle(b).display !== 'none').map(b => (b.closest('.sim-tab') || {}).id));
const badges = async p => { await p.waitForTimeout(800); const a = await badgeIds(p); if (a.length) console.log('    badges on:', a.join(',')); return a.length; };
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


T.lab03 = async (b) => {
  const ctx = await ctxFor(b); const p = await open(ctx, 'lab03.html');
  await go(p, 'blast-the-genes'); await p.fill('#p-predict-blast', 'The chimp.'); await p.selectOption('#q-gene', 'B'); await p.click('#run-blast'); await p.waitForTimeout(800);
  const top = await txt(p, '#r-top'), idn = await txt(p, '#r-id'), nn = await txt(p, '#r-n'); ok(top && top !== '—', 'lab03: BLAST ran, top hit ' + top);
  await p.click('#log-blast'); await p.waitForTimeout(300);
  await go(p, 'design'); await p.fill('#p-predict-design', 'Slope is steeper for fast genes.'); await p.click('#d-run'); await p.waitForTimeout(800);
  const dq = await txt(p, '#d-q'), dn = await txt(p, '#d-n'); ok(/\d/.test(dn), 'lab03: design BLAST ran ' + dq + ' ' + dn);
  await reload(p);
  await go(p, 'blast-the-genes');
  ok((await txt(p, '#r-top')) === top && (await txt(p, '#r-id')) === idn && (await txt(p, '#r-n')) === nn, 'lab03: BLAST panel restored (' + await txt(p, '#r-top') + ')');
  ok(await p.inputValue('#q-gene') === 'B', 'lab03: query gene restored');
  ok((await p.locator('#blast-hits .hits tbody tr').count()) > 0, 'lab03: hit table restored');
  ok(await p.evaluate(() => !!document.querySelector('#blast-out svg.graphic')), 'lab03: graphic summary restored');
  await go(p, 'design'); ok((await txt(p, '#d-q')) === dq && (await txt(p, '#d-n')) === dn, 'lab03: design BLAST restored (' + await txt(p, '#d-q') + ')');
  ok((await badges(p)) === 0, 'lab03: no "new" badges after reload');
  for (const w of [1366, 1920]) {
    await p.setViewportSize({ width: w, height: 900 }); await go(p, 'blast-the-genes'); await p.waitForTimeout(500);
    const bad = await p.evaluate(() => { const out = []; document.querySelectorAll('section.is-current table').forEach(t => { const r = t.getBoundingClientRect(); let a = t.parentElement, cl = null; while (a && a !== document.body) { const cs = getComputedStyle(a); if (/(auto|scroll|hidden)/.test(cs.overflowX)) { cl = a; break; } a = a.parentElement; } const box = cl ? cl.getBoundingClientRect() : { right: window.innerWidth }; if (!cl && r.right > window.innerWidth + 1) out.push('page overflow ' + t.className + ' ' + Math.round(r.right)); if (cl && cl.scrollWidth > cl.clientWidth + 1) out.push('inner scroll ' + (cl.className || cl.tagName) + ' ' + cl.scrollWidth + '>' + cl.clientWidth); }); return out; });
    console.log('    tables at ' + w + ':', JSON.stringify(bad));
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'lab03: no horizontal page scroll at ' + w);
  }
  ok(p.errors.length === 0, 'lab03: no page errors ' + p.errors.join('|'));
  await ctx.close();
};


T.lab04 = async (b) => {
  const ctx = await ctxFor(b); const p = await open(ctx, 'lab04.html');
  const rows = (sel) => p.locator(sel + ' tbody tr').count();
  const pr = async (k) => { await p.evaluate(k => { const t = document.getElementById('p-' + k); if (t) { t.value = 'I predict a clear pattern because of diffusion.'; t.dispatchEvent(new Event('input', { bubbles: true })); } }, k); };
  for (const k of ['predict-sav', 'predict-bags', 'predict-plasmo', 'predict-soak', 'predict-design']) await pr(k);
  await go(p, 'sa-v'); await p.click('#p1-run'); await p.waitForTimeout(3500);
  const p1 = [await txt(p, '#p1-time'), await txt(p, '#p1-depth'), await txt(p, '#p1-rate')]; ok(/10\.0/.test(p1[0]), 'lab04: p1 soak finished ' + p1);
  await go(p, 'model-cells'); await p.click('#p2-run'); await p.waitForTimeout(4500);
  const p2 = [await txt(p, '#p2-time'), await txt(p, '#p2-max'), await txt(p, '#p2-min')]; ok(/30 min/.test(p2[0]), 'lab04: p2 run finished ' + p2);
  await go(p, 'plasmolysis'); await p.selectOption('#p3a-sol', 's10'); await p.click('#p3a-run'); await p.waitForTimeout(9500);
  const p3 = [await txt(p, '#p3a-now'), await txt(p, '#p3a-time')]; ok(parseFloat(p3[1]) > 60, 'lab04: plasmolysis ran ' + p3);
  await go(p, 'water-potential'); await p.click('#p3b-id'); await p.waitForTimeout(3800);
  const idn = await rows('#p3b-idtable'); ok(idn === 6, 'lab04: water-bag test table has 6 rows');
  const idtxt = await p.locator('#p3b-idtable tbody').innerText();
  await p.click('#p3b-run'); await p.waitForTimeout(3200);
  const soakN = await rows('#p3b-table'); ok(soakN === 6, 'lab04: soak table has 6 rows');
  await p.evaluate(() => { const e = document.getElementById('wp-c'); e.value = 0.9; e.dispatchEvent(new Event('input', { bubbles: true })); const t = document.getElementById('wp-i'); t.value = '2'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  const wp = await txt(p, '#wp-psi'); const tm = await txt(p, '#p3b-time');
  await go(p, 'design'); await p.click('#d-run'); await p.waitForTimeout(3200);
  const dsl = await txt(p, '#d-slope'); const dn = await rows('#d-raw');
  // mid-animation: start a second p1 run and reload at once
  await go(p, 'sa-v'); const before = await rows('#p1-table'); await p.click('#p1-run'); await p.waitForTimeout(300);
  await reload(p);
  await go(p, 'sa-v'); const after = await rows('#p1-table'); ok(after === before + 3, 'lab04: a soak interrupted by a reload is finished, not lost (' + before + ' -> ' + after + ')');
  ok((await txt(p, '#p1-time')).includes('10.0'), 'lab04: p1 readouts at end state after mid-run reload');
  await go(p, 'model-cells'); ok(JSON.stringify([await txt(p, '#p2-time'), await txt(p, '#p2-max'), await txt(p, '#p2-min')]) === JSON.stringify(p2), 'lab04: p2 readouts restored');
  await go(p, 'plasmolysis'); ok(parseFloat(await txt(p, '#p3a-time')) >= parseFloat(p3[1]) && (await txt(p, '#p3a-now')) === p3[0], 'lab04: plasmolysis restored (' + await txt(p, '#p3a-now') + ' ' + await txt(p, '#p3a-time') + ')');
  await go(p, 'water-potential');
  ok((await p.locator('#p3b-idtable tbody').innerText()) === idtxt, 'lab04: water-bag table restored identically');
  ok((await txt(p, '#p3b-time')) === tm && await p.inputValue('#wp-c') === '0.9' && (await txt(p, '#wp-psi')) === wp, 'lab04: soak scene and calculator restored (' + await txt(p, '#wp-psi') + ' vs ' + wp + ')');
  await go(p, 'design'); ok((await txt(p, '#d-slope')) === dsl && dsl !== '—', 'lab04: design analysis restored ' + dsl);
  // a plasmolysis run restored while still in progress carries on
  await go(p, 'plasmolysis'); await p.click('#p3a-rinse'); await p.waitForTimeout(2500); await reload(p); await go(p, 'plasmolysis');
  const t1 = await txt(p, '#p3a-time'); await p.waitForTimeout(1500); const t2 = await txt(p, '#p3a-time');
  ok(parseFloat(t1) > 0 && parseFloat(t2) >= parseFloat(t1), 'lab04: in-progress plasmolysis resumes from the clock (' + t1 + ' -> ' + t2 + ')');
  ok((await badges(p)) === 0, 'lab04: no "new" badges after reload');
  ok(p.errors.length === 0, 'lab04: no page errors ' + p.errors.join('|'));
  await ctx.close();
};

if (require.main === module) (async () => {
  const want = process.argv.slice(2), b = await launch();
  for (const k of Object.keys(T)) { if (want.length && !want.includes(k)) continue; console.log('\n== ' + k); await T[k](b); }
  await b.close(); done('t26 persistence labs 1-7');
})().catch(e => { console.error(e); process.exit(1); });
