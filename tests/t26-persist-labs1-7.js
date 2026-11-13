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


T.lab05 = async (b) => {
  const ctx = await ctxFor(b); const p = await open(ctx, 'lab05.html');
  const pr = async (k) => { await p.evaluate(k => { const t = document.getElementById('p-' + k); if (t) { t.value = 'I predict a clear pattern because of photosynthesis.'; t.dispatchEvent(new Event('input', { bubbles: true })); } }, k); };
  for (const k of ['predict-floatassay', 'predict-design']) await pr(k);
  ok(await p.evaluate(() => document.querySelector('#cup-chart').classList.contains('is-empty')), 'lab05: float chart starts in the shared empty state');
  ok(await p.evaluate(() => document.querySelector('#d-chart').classList.contains('is-empty')), 'lab05: design chart starts in the shared empty state');
  await go(p, 'sink-disks'); await p.click('#inf-pull'); await p.waitForTimeout(3000);
  await reload(p); await go(p, 'sink-disks');
  ok(await p.evaluate(() => document.querySelector('#inf-pull').disabled && /Pulling/.test(document.querySelector('#inf-pull').textContent)), 'lab05: a vacuum in progress carries on after reload');
  await p.waitForFunction(() => !document.querySelector('#inf-pull').disabled, null, { timeout: 20000 });
  const ia = await txt(p, '#inf-a'), ib = await txt(p, '#inf-b'), inn = await txt(p, '#inf-n'); ok(inn === '1', 'lab05: vacuum finished, count 1');
  await reload(p); await go(p, 'sink-disks');
  ok((await txt(p, '#inf-a')) === ia && (await txt(p, '#inf-b')) === ib && (await txt(p, '#inf-n')) === '1', 'lab05: sunk disks restored (' + ia + ', ' + ib + ')');
  await p.click('#inf-pour'); await p.waitForTimeout(300);
  const na = await p.evaluate(() => JSON.parse(localStorage.getItem('aplab:lab05:cup-prep')).na);
  await go(p, 'float-assay');
  ok((await txt(p, '#et-half')) === (na / 2) + ' of ' + na, 'lab05: ET50 wording uses the cup n: ' + await txt(p, '#et-half'));
  await p.evaluate(() => { document.getElementById('cup-speed').value = '0.5'; }); await p.click('#cup-run'); await p.waitForTimeout(3000);
  const r1 = await p.locator('#cup-table tbody tr').count(); const t1 = parseFloat(await txt(p, '#cup-t'));
  await reload(p); await go(p, 'float-assay'); await p.waitForTimeout(300);
  const r2 = await p.locator('#cup-table tbody tr').count(); const t2 = parseFloat(await txt(p, '#cup-t'));
  ok(r2 >= r1 && t2 >= t1 - 0.5, 'lab05: timer carries on after reload (rows ' + r1 + ' -> ' + r2 + ', t ' + t1 + ' -> ' + t2 + ')');
  await p.waitForFunction(() => document.querySelectorAll('#cup-table tbody tr').length >= 21, null, { timeout: 30000 });
  const rows = await p.locator('#cup-table tbody tr').count(); ok(rows === 21, 'lab05: 21 rows (minutes 0-20) after a run split by a reload: ' + rows);
  await p.click('#cup-run'); await p.waitForTimeout(500);
  await p.evaluate(() => { const k = 'aplab:lab05:cup-run', v = JSON.parse(localStorage.getItem(k)); v.t0 -= 60000; localStorage.setItem(k, JSON.stringify(v)); });
  await reload(p); await go(p, 'float-assay');
  ok(await p.locator('#cup-table tbody tr').count() === 21 && /20\.0/.test(await txt(p, '#cup-t')), 'lab05: a run that finished while closed shows its end state (' + await txt(p, '#cup-t') + ')');
  ok(!(await p.evaluate(() => document.querySelector('#cup-chart').classList.contains('is-empty'))), 'lab05: float chart drawn');
  await p.fill('#et-in', '9.9'); await p.fill('#ret-in', '0.1'); await p.click('#et-check'); await p.waitForTimeout(200);
  const fb = await txt(p, '#et-fb'); ok(fb.length > 5, 'lab05: ET50 check feedback shown');
  await reload(p); await go(p, 'float-assay'); ok((await txt(p, '#et-fb')) === fb, 'lab05: ET50 check feedback restored');
  await go(p, 'design'); await p.click('#d-run'); await p.waitForTimeout(1500); await reload(p); await go(p, 'design');
  await p.waitForFunction(() => !/No data yet/.test(document.getElementById('d-raw').innerText), null, { timeout: 30000 });
  const dn = await p.locator('#d-raw tbody tr').count(), dt = await txt(p, '#d-t'); ok(dn > 0, 'lab05: design run interrupted by a reload still finishes (' + dn + ' cups, ' + dt + ')');
  await reload(p); await go(p, 'design');
  ok((await p.locator('#d-raw tbody tr').count()) === dn && (await txt(p, '#d-t')) === dt && !(await p.evaluate(() => document.querySelector('#d-chart').classList.contains('is-empty'))), 'lab05: design results and scene restored');
  ok((await badges(p)) === 0, 'lab05: no "new" badges after reload');
  ok(p.errors.length === 0, 'lab05: no page errors ' + p.errors.join('|'));
  await ctx.close();
};


T.lab06 = async (b) => {
  const ctx = await ctxFor(b); const p = await open(ctx, 'lab06.html');
  const pr = async (k) => { await p.evaluate(k => { const t = document.getElementById('p-' + k); if (t) { t.value = 'I predict a clear pattern because of respiration.'; t.dispatchEvent(new Event('input', { bubbles: true })); } }, k); };
  for (const k of ['predict-microresp', 'predict-gas', 'predict-design']) await pr(k);
  for (const id of ['p-chart', 'g-chart', 'd-chart']) ok(await p.evaluate(id => document.getElementById(id).classList.contains('is-empty'), id), 'lab06: ' + id + ' starts in the shared empty state');
  ok(!/20\.[0-9]|21\.[0-9]/.test(await p.evaluate(() => [...document.querySelectorAll('#g-chart svg text')].map(t => t.textContent).join(' '))), 'lab06: gas chart shows no placeholder y-axis numbers');
  ok(await p.inputValue('#q-t1') === '' && await p.inputValue('#q-t2') === '', 'lab06: Q10 calculator starts empty');
  await go(p, 'microrespirometer'); await p.click('#p-run'); await p.waitForTimeout(3500);
  const r1 = await p.locator('#p-table tbody tr').count(), tt1 = parseFloat(await txt(p, '#p-time'));
  await reload(p); await go(p, 'microrespirometer'); await p.waitForTimeout(300);
  const r2 = await p.locator('#p-table tbody tr').count(), tt2 = parseFloat(await txt(p, '#p-time'));
  ok(r2 >= r1 && tt2 >= tt1 - 0.5 && tt2 > 0, 'lab06: microrespirometer carries on after reload (rows ' + r1 + ' -> ' + r2 + ', t ' + tt1 + ' -> ' + tt2 + ')');
  await p.waitForFunction(() => document.querySelectorAll('#p-reps tbody tr').length >= 1 && !/No data/.test(document.getElementById('p-reps').innerText), null, { timeout: 40000 });
  ok(/25\.0/.test(await txt(p, '#p-time')) && (await p.locator('#p-table tbody tr').count()) === 6, 'lab06: run finished with 6 readings');
  await p.click('#p-run'); await p.waitForTimeout(500);
  await p.evaluate(() => { const k = 'aplab:lab06:p-run', v = JSON.parse(localStorage.getItem(k)); v.t0 -= 120000; localStorage.setItem(k, JSON.stringify(v)); });
  const repsBefore = await p.locator('#p-reps tbody tr').count();
  await reload(p); await go(p, 'microrespirometer');
  ok(/25\.0/.test(await txt(p, '#p-time')) && (await p.locator('#p-table tbody tr').count()) === 6, 'lab06: a run that finished while closed shows its end state (' + await txt(p, '#p-time') + ')');
  ok(!(await p.evaluate(() => document.getElementById('p-chart').classList.contains('is-empty'))), 'lab06: run chart drawn');
  const repsAfter = await p.locator('#p-reps tbody tr').count(); ok(repsAfter >= repsBefore, 'lab06: replicate table kept (' + repsBefore + ' -> ' + repsAfter + ')');
  await go(p, 'gas-sensors'); await p.click('#g-run'); await p.waitForTimeout(2000);
  const g1 = parseFloat(await txt(p, '#g-time'));
  await reload(p); await go(p, 'gas-sensors'); await p.waitForTimeout(300);
  const g2 = parseFloat(await txt(p, '#g-time')); ok(g2 >= g1 && g2 > 0, 'lab06: gas-sensor run carries on after reload (' + g1 + ' -> ' + g2 + ')');
  await p.waitForFunction(() => document.querySelectorAll('#g-table tbody tr').length >= 1 && !/No data/.test(document.getElementById('g-table').innerText), null, { timeout: 30000 });
  const gs = await txt(p, '#g-slope'), gt = await txt(p, '#g-time'); ok(/25\.0/.test(gt), 'lab06: gas run finished ' + gt + ' ' + gs);
  await reload(p); await go(p, 'gas-sensors');
  ok((await txt(p, '#g-slope')) === gs && (await txt(p, '#g-time')) === gt && !(await p.evaluate(() => document.getElementById('g-chart').classList.contains('is-empty'))), 'lab06: finished gas run restored (slope ' + await txt(p, '#g-slope') + ')');
  await go(p, 'design'); await p.click('#d-run'); await p.waitForTimeout(500);
  const dl = await txt(p, '#d-last'), dlg = await txt(p, '#d-lastg'), dn = await txt(p, '#d-n');
  await reload(p); await go(p, 'design');
  ok((await txt(p, '#d-last')) === dl && (await txt(p, '#d-lastg')) === dlg && (await txt(p, '#d-n')) === dn && dl !== '—', 'lab06: design readouts restored (' + dl + ', ' + dn + ' trials)');
  ok(!(await p.evaluate(() => document.getElementById('d-chart').classList.contains('is-empty'))), 'lab06: design chart drawn');
  await p.click('#q-example'); await p.waitForTimeout(200);
  ok(await p.locator('#q-banner').isVisible() && /EXAMPLE/.test(await txt(p, '#q-banner')) && /\d/.test(await txt(p, '#q-out')), 'lab06: worked example shows banner and Q10');
  await reload(p); await go(p, 'design');
  ok(await p.inputValue('#q-t1') === '' && await p.locator('#q-banner').isHidden(), 'lab06: example not saved');
  await p.click('#q-mine'); await p.waitForTimeout(200); const qm = await txt(p, '#q-msg'); ok(/Run the same organism|Filled from/.test(qm), 'lab06: Use my data responds: ' + qm.slice(0, 60));
  await p.fill('#q-t1', '15'); await p.fill('#q-r1', '2'); await p.fill('#q-t2', '25'); await p.fill('#q-r2', '5'); await p.waitForTimeout(200);
  const qo = await txt(p, '#q-out'); await reload(p); await go(p, 'design'); ok((await txt(p, '#q-out')) === qo && qo !== '—', 'lab06: Q10 result restored from saved inputs (' + qo + ')');
  ok((await badges(p)) === 0, 'lab06: no "new" badges after reload');
  ok(p.errors.length === 0, 'lab06: no page errors ' + p.errors.join('|'));
  await ctx.close();
};


T.lab07 = async (b) => {
  const ctx = await ctxFor(b); const p = await open(ctx, 'lab07.html');
  const pr = async (k) => { await p.evaluate(k => { const t = document.getElementById('p-' + k); if (t) { t.value = 'I predict a clear pattern because of the cell cycle.'; t.dispatchEvent(new Event('input', { bubbles: true })); } }, k); };
  for (const k of ['predict-roottips', 'predict-meiosis', 'predict-sordaria', 'predict-design']) await pr(k);
  const sig = (sel) => p.evaluate(sel => document.querySelector(sel).innerHTML.length + ':' + [...document.querySelectorAll(sel + ' [transform], ' + sel + ' g')].slice(0, 40).map(e => e.getAttribute('transform') || '').join(''), sel);
  ok(await p.inputValue('#cs-o-0') === '' && await p.inputValue('#cs-e-0') === '' && await p.inputValue('#cs-l-0') === '', 'lab07: chi-square calculator starts empty');
  // ---- mitosis model
  await go(p, 'mitosis-model');
  for (let i = 0; i < 3; i++) { await p.click('#mit-next'); }
  await p.click('#mit-align'); await p.waitForTimeout(1200); await p.click('#mit-next'); await p.click('#mit-pull'); await p.waitForTimeout(1200);
  const mitStage = await txt(p, '#mit-stage'), mitSig = await sig('#mit-svg');
  ok(/Anaphase/.test(mitStage), 'lab07: mitosis model reached anaphase (' + mitStage + ')');
  await p.evaluate(() => { const ins = [...document.querySelectorAll('#mit-table input')]; ins.forEach((i, k) => { i.value = String([4, 4, 2][k % 3]); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); });
  await p.click('#mit-check-table'); await p.waitForTimeout(200);
  const pill = await txt(p, '#mit-table-pill'); ok(/of \d+ correct/.test(pill), 'lab07: table checked: ' + pill);
  // ---- sorting
  await p.click('#sort-card-0'); await p.click('#sort-card-1'); await p.click('#sort-check'); await p.waitForTimeout(200);
  const sortMsg = await txt(p, '#sort-msg'), sortOrder = await p.evaluate(() => localStorage.getItem('aplab:lab07:sort'));
  // ---- root tips
  await go(p, 'root-tips'); await p.click('#rt-prep'); await p.waitForTimeout(400); await p.evaluate(() => document.getElementById('rt-auto').click()); await p.waitForTimeout(300);
  const rt = await p.evaluate(() => ['I', 'P', 'M', 'A', 'T', 'left'].map(k => document.getElementById('rt-n-' + k).textContent).join(',') + '|' + document.getElementById('rt-mi').textContent);
  ok(!/^0,0,0,0,0/.test(rt), 'lab07: cells marked ' + rt);
  await p.click('#rt-record'); await p.waitForTimeout(200); await p.click('#rt-class'); await p.waitForTimeout(400);
  await p.evaluate(() => { document.getElementById('chi-e-0').value = '100'; document.getElementById('chi-e-0').dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('chi-e-1').value = '60'; document.getElementById('chi-e-1').dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('#chi-run'); await p.waitForTimeout(300);
  const chiOut = await txt(p, '#chi-out'); ok(/critical value/.test(chiOut), 'lab07: chi-square computed');
  const mean = await txt(p, '#rt-mean-c');
  // ---- karyotypes
  await go(p, 'cancer-karyotypes'); await p.click('button[data-k="hela"]'); await p.click('#k-view-kary'); await p.waitForTimeout(300);
  await p.evaluate(() => { const g = document.querySelectorAll('#k-svg .chr'); [0, 1, 2].forEach(i => g[i].dispatchEvent(new MouseEvent('click', { bubbles: true }))); });
  const kc = await txt(p, '#k-count'); ok(kc === '3', 'lab07: three chromosomes counted');
  await p.evaluate(() => { const i = document.querySelector('#k-table input[data-k="n"]'); i.value = '46'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.click('#k-check'); await p.waitForTimeout(200); const kmsg = await txt(p, '#k-check-msg');
  // ---- meiosis
  await go(p, 'meiosis-model');
  for (let i = 0; i < 4; i++) await p.click('#mei-next');
  await p.waitForTimeout(900); const meiStage = await txt(p, '#mei-stage-name');
  await go(p, 'meiosis-model'); await p.click('#mei-run'); await p.waitForTimeout(300);
  const meiOut = await txt(p, '#mei-run-out'); ok(/800 gametes/.test(meiOut), 'lab07: 200 meioses run');
  // ---- sordaria
  await go(p, 'sordaria'); await p.evaluate(() => document.getElementById('s-auto').click()); await p.waitForTimeout(200);
  const sc = [await txt(p, '#s-n-P'), await txt(p, '#s-n-R'), await txt(p, '#s-n-left')];
  await p.click('#s-record'); await p.waitForTimeout(200); await p.click('#s-class'); await p.waitForTimeout(300);
  ok(+sc[0] + +sc[1] > 0, 'lab07: asci scored ' + sc);
  const fno = await p.evaluate(() => (document.querySelector('#s-canvas') || {}).id);
  // ---- design
  await go(p, 'design'); await p.click('#d-run'); await p.waitForTimeout(800);
  const dcap = await txt(p, '#d-field-cap'), dn = await p.locator('#d-table tbody tr').count(); ok(dn > 0 && /One field/.test(dcap), 'lab07: design run ' + dcap.slice(0, 40));
  // ---- chi-square calculator: own data
  await go(p, 'analyze'); await p.click('#cs-mine'); await p.waitForTimeout(300);
  const csOut = await txt(p, '#cs-out'); ok(/critical value/.test(csOut), 'lab07: Use my root-tip data fills and runs the calculator');
  const csL = await p.inputValue('#cs-l-0'), csO = await p.inputValue('#cs-o-0');
  await reload(p);
  // ---- everything again after a reload
  await go(p, 'mitosis-model');
  ok((await txt(p, '#mit-stage')) === mitStage && (await sig('#mit-svg')) === mitSig, 'lab07: mitosis model restored to the same stage and positions (' + await txt(p, '#mit-stage') + ')');
  ok((await txt(p, '#mit-table-pill')) === pill, 'lab07: table check result restored');
  ok((await p.evaluate(() => localStorage.getItem('aplab:lab07:sort'))) === sortOrder && (await txt(p, '#sort-msg')) === sortMsg, 'lab07: sorting order and check restored');
  await go(p, 'root-tips');
  const rt2 = await p.evaluate(() => ['I', 'P', 'M', 'A', 'T', 'left'].map(k => document.getElementById('rt-n-' + k).textContent).join(',') + '|' + document.getElementById('rt-mi').textContent);
  ok(rt2 === rt, 'lab07: marked cells restored (' + rt2 + ')');
  ok((await txt(p, '#chi-out')) === chiOut && (await txt(p, '#rt-mean-c')) === mean && mean !== '—', 'lab07: class data, chart numbers and chi-square result restored');
  await go(p, 'cancer-karyotypes');
  ok((await txt(p, '#k-count')) === kc && await p.evaluate(() => document.getElementById('k-view-kary').getAttribute('aria-pressed') === 'true') && (await txt(p, '#k-check-msg')) === kmsg, 'lab07: karyotype choice, view, tally and check restored');
  await go(p, 'meiosis-model');
  ok((await txt(p, '#mei-stage-name')) === meiStage && (await txt(p, '#mei-run-out')) === meiOut, 'lab07: meiosis stage and 200-meiosis result restored (' + meiStage + ')');
  await go(p, 'sordaria');
  ok(JSON.stringify([await txt(p, '#s-n-P'), await txt(p, '#s-n-R'), await txt(p, '#s-n-left')]) === JSON.stringify(sc), 'lab07: Sordaria scoring restored ' + [await txt(p, '#s-n-P'), await txt(p, '#s-n-R')]);
  await go(p, 'design'); ok((await txt(p, '#d-field-cap')) === dcap, 'lab07: design field caption restored');
  await go(p, 'analyze');
  ok((await txt(p, '#cs-out')) === csOut && await p.inputValue('#cs-l-0') === csL && await p.inputValue('#cs-o-0') === csO, 'lab07: chi-square calculator restored from saved inputs');
  await p.click('#cs-clear-ex').catch(() => {}); await p.click('#cs-example'); await p.waitForTimeout(300);
  ok(await p.locator('#cs-banner').isVisible() && /EXAMPLE/.test(await txt(p, '#cs-out')), 'lab07: worked example banner shown on the calculator');
  const keyBefore = await p.evaluate(() => localStorage.getItem('aplab:lab07:keyres:chi2-lectin'));
  await reload(p); await go(p, 'analyze');
  ok(await p.locator('#cs-banner').isHidden() && await p.inputValue('#cs-l-0') === csL, 'lab07: example not saved as student work');
  ok((await badges(p)) === 0, 'lab07: no "new" badges after reload');
  ok(p.errors.length === 0, 'lab07: no page errors ' + p.errors.join('|'));
  await ctx.close();
};

if (require.main === module) (async () => {
  const want = process.argv.slice(2), b = await launch();
  for (const k of Object.keys(T)) { if (want.length && !want.includes(k)) continue; console.log('\n== ' + k); await T[k](b); }
  await b.close(); done('t26 persistence labs 1-7');
})().catch(e => { console.error(e); process.exit(1); });
