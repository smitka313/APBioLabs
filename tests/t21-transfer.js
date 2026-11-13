/* "Get my transfer code": big code + QR, and the #resume=<code> link restoring work in a fresh browser */
const T = require('./_h');
const OUT = process.env.OUT || require('os').tmpdir();
(async () => {
  const srv = await T.serve(), b = await T.launch();
  const ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'lab05.html', 'analyze', srv.url);
  const ta = p.locator('section.step.is-current textarea[data-save]').first();
  await ta.fill('Transfer test answer: the disks rose sooner with CO2.'); await p.waitForTimeout(700);
  const taId = await ta.getAttribute('id');
  await p.evaluate(() => { Lab.keyResult('et50', { label: 'ET₅₀ (with CO₂)', value: 10.4, unit: 'min', part: 'float-assay' }); Lab.keyResult('frq-score', { label: 'FRQ self-score', value: 3, unit: 'of 4' }); });

  // key results contract
  const kr = await p.evaluate(() => ({ raw: JSON.parse(localStorage.getItem('aplab:lab05:keyres:et50')), all: Lab.keyResults() }));
  T.ok(kr.raw.label === 'ET₅₀ (with CO₂)' && kr.raw.value === 10.4 && kr.raw.unit === 'min' && kr.raw.part === 'float-assay' && typeof kr.raw.t === 'number', 'keyResult stored as keyres:<id> {label,value,unit,part,t}');
  T.ok(kr.all.length === 2 && kr.all.some(r => r.id === 'frq-score' && r.value === 3), 'Lab.keyResults() returns all of them');
  const prog = await p.evaluate(() => Lab.progressFile.payload(true));
  T.ok(prog.data['keyres:et50'] && prog.keyResults.length === 2 && prog.datasetId, 'progress file carries key results, dataset id');

  // ---- Submit part: transfer code ----
  await p.goto(srv.url + 'lab05.html#submit'); await p.waitForTimeout(700);
  const btn = p.locator('section.step.is-current .transfer-btn');
  T.ok(await btn.count() === 1 && /Get my transfer code/.test(await btn.innerText()), 'Submit part has a "Get my transfer code" button');
  await btn.click();
  await p.waitForSelector('section.step.is-current .transfer-qr svg', { timeout: 5000 });
  const info = await p.evaluate(() => { const q = document.querySelector('section.step.is-current .transfer-qr'); const c = document.querySelector('section.step.is-current .transfer-code'); const r = q.getBoundingClientRect(); return { url: q.dataset.url, modules: +q.dataset.modules, code: c.textContent, w: r.width, fs: getComputedStyle(c).fontSize, text: document.querySelector('section.step.is-current .transfer-out').innerText }; });
  T.ok(info.url === srv.url + 'lab05.html#resume=' + info.code, 'QR encodes <origin>/lab05.html#resume=<code>: ' + info.url.slice(0, 70) + '…');
  T.ok(/^LB1[zb]\./.test(info.code), 'code is the existing resume code format');
  T.ok(info.modules >= 21 && info.w >= 240, `QR drawn (${info.modules} modules, ${Math.round(info.w)}px)`);
  T.ok(/Take a photo of this with your phone\./.test(info.text), 'photo instruction shown');
  T.ok(parseFloat(info.fs) >= 17, 'code in large type (' + info.fs + ')');
  await p.locator('section.step.is-current .transfer').scrollIntoViewIfNeeded();
  await p.screenshot({ path: OUT + '/transfer-1366.png' });
  const m = await T.ctxFor(b, { width: 400, height: 800, dark: true });
  const pm = await T.open(m, 'lab05.html', 'submit', srv.url);
  await pm.locator('.transfer-btn').click(); await pm.waitForSelector('.transfer-qr svg');
  await pm.locator('.transfer').scrollIntoViewIfNeeded();
  T.ok(await pm.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 400px');
  await pm.screenshot({ path: OUT + '/transfer-400-dark.png' });
  await m.close();

  // ---- the link restores work in a fresh browser context (a "phone") ----
  const phone = await b.newContext({ viewport: { width: 400, height: 800 } });
  await T.routeLibs(phone);
  await phone.addInitScript(() => { try { if (!localStorage.getItem('aplab:tour')) localStorage.setItem('aplab:tour', JSON.stringify({ seen: true, v: 1 })); } catch (e) { /* ignore */ } });
  const ph = await phone.newPage(); const errs = []; ph.on('pageerror', e => errs.push(e.message));
  await ph.goto(info.url); await ph.waitForTimeout(900);
  T.ok(await ph.evaluate(() => location.hash === ''), 'hash cleaned from the address bar on load');
  const ban = ph.locator('#resume-banner');
  T.ok(await ban.count() === 1 && /Replace your work on this lab/.test(await ban.innerText()), 'inline confirm shown');
  T.ok(await ph.evaluate(() => !localStorage.getItem('aplab:lab05:field:p-analyze') && !Object.keys(localStorage).some(k => k.startsWith('aplab:lab05:field'))), 'nothing restored before confirming');
  await ph.screenshot({ path: OUT + '/resume-banner.png' });
  await ph.click('#resume-apply'); await ph.waitForLoadState('load'); await ph.waitForTimeout(1500);
  const got = await ph.evaluate(id => ({ v: (document.getElementById(id) || {}).value, name: (JSON.parse(localStorage.getItem('aplab:student')) || {}).name, hash: location.hash, kr: Lab.keyResults().length, banner: !!document.getElementById('resume-banner') }), taId);
  T.ok(/Transfer test answer/.test(got.v || ''), 'answer restored on the phone: ' + (got.v || '').slice(0, 30));
  T.ok(got.name === 'Test Student' && got.kr === 2 && !got.banner && got.hash === '', 'identity and key results restored, banner and hash gone');
  T.ok(errs.length === 0, 'no page errors ' + errs.join('|'));

  // Cancel path and wrong-lab path
  const p2 = await phone.newPage(); await p2.goto(info.url.replace('lab05.html', 'lab06.html')); await p2.waitForTimeout(800);
  const wrong = await p2.evaluate(() => { const bn = document.getElementById('resume-banner'); const a = bn && bn.querySelector('a'); return { text: bn && bn.innerText, href: a && a.getAttribute('href') }; });
  T.ok(/Lab 5/.test(wrong.text || '') && /lab05\.html#resume=/.test(wrong.href || ''), 'link opened on the wrong lab offers to open Lab 5');
  const p3 = await phone.newPage(); await p3.goto(srv.url + 'lab05.html#resume=LB1z.notacode'); await p3.waitForTimeout(800);
  T.ok(/resume code|damaged|incomplete/i.test(await p3.locator('#resume-banner').innerText()), 'damaged code gives a clear message');
  const p4 = await phone.newPage(); await p4.goto(info.url); await p4.waitForTimeout(800);
  await p4.getByRole('button', { name: 'Keep my work' }).click();
  T.ok(await p4.locator('#resume-banner').count() === 0, 'Keep my work dismisses the banner');
  const p5 = await phone.newPage(); await p5.goto(srv.url + 'lab05.html#float-assay'); await p5.waitForTimeout(800);
  T.ok(await p5.evaluate(() => Lab.pages.current().id === 'float-assay'), 'part-slug routing unaffected');

  // ---- too much data for a QR code ----
  const big = await T.ctxFor(b);
  const pb = await T.open(big, 'lab05.html', 'submit', srv.url);
  await pb.evaluate(() => { let s = ''; for (let i = 0; i < 12000; i++) s += Math.random().toString(36).slice(2); localStorage.setItem('aplab:lab05:field:blob', JSON.stringify(s)); });
  await pb.locator('.transfer-btn').click(); await pb.waitForSelector('.transfer-code');
  T.ok(/Too much data for a QR code — save a progress file instead\./.test(await pb.locator('.transfer-qr').innerText()), 'oversized work shows the progress-file message');
  T.ok(await pb.locator('.transfer-code').count() === 1, 'the code itself is still shown');

  await b.close(); srv.close();
  T.done('t21-transfer');
})();
