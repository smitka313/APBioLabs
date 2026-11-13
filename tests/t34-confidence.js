/* "Rate my confidence": on every lab's Reflect/Evaluate part, saved, a key result, in the report, on the dashboard; never required work. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  for (const lab of T.LABS) {
    const p = await T.open(ctx, lab + '.html');
    const r = await p.evaluate(() => { const sec = document.querySelector('.confidence') && document.querySelector('.confidence').closest('section.step'); return { part: sec && sec.dataset.step, n: document.querySelectorAll('.confidence').length, radios: Array.from(document.querySelectorAll('.confidence input')).map(i => i.nextElementSibling.nextElementSibling.textContent), prog: Lab.progress.update() }; });
    T.ok(r.n === 1 && /^(Reflect|Evaluate)$/.test(r.part || ''), `${lab}: one control, in the "${r.part}" part`);
    T.ok(r.radios.join('|') === 'I could teach this|I mostly get it|I’m lost', `${lab}: choices ${r.radios.join(' / ')}`);
    await p.evaluate(() => Lab.pages.go(document.querySelector('.confidence').closest('section.step')));
    await p.waitForTimeout(300);
    await p.locator('.conf-opt', { hasText: 'I mostly get it' }).click();
    await p.waitForTimeout(500);
    const a = await p.evaluate(() => ({ stored: JSON.parse(localStorage.getItem('aplab:' + Lab.page.id + ':confidence')), kr: Lab.keyResults().find(k => k.id === 'confidence'), prog: Lab.progress.update() }));
    T.ok(a.stored && a.stored.v === 2 && a.kr && a.kr.value === 2 && a.kr.label === 'Confidence', `${lab}: saved and reported as key result ${JSON.stringify(a.kr && [a.kr.value, a.kr.unit])}`);
    T.ok(a.prog.total === r.prog.total && a.prog.items.total === r.prog.items.total, `${lab}: part and item totals unchanged (${a.prog.total} parts, ${a.prog.items.total} items): not required work`);
    T.ok(p.errors.length === 0, `${lab}: no errors ${p.errors.join(';')}`);
    await p.close();
  }
  // Detail checks on lab 8
  const p = await T.open(ctx, 'lab08.html');
  await p.evaluate(() => Lab.pages.go(document.querySelector('.confidence').closest('section.step')));
  await p.waitForTimeout(300);
  T.ok(await p.locator('.confidence input[value="2"]').isChecked(), 'choice survives a reload');
  await p.locator('.conf-opt', { hasText: 'I’m lost' }).click(); await p.waitForTimeout(300);
  T.ok(await p.evaluate(() => Lab.keyResults().find(k => k.id === 'confidence').value) === 1, 'changing the choice updates the key result (1 = lost)');
  const rep = await p.evaluate(() => { const c = Lab.report.collect(); return JSON.stringify(c.keyResults || c.keys || c).includes('Confidence'); });
  T.ok(rep, 'the report data includes Confidence');
  await p.evaluate(() => Lab.report.open());
  await p.waitForTimeout(600);
  const rv = await p.evaluate(() => (document.querySelector('.report-view, #lab-report, [class*=report]') || document.body).innerText);
  T.ok(/Confidence/.test(rv) && /I’m lost/.test(rv), 'the report view lists "Confidence ... I’m lost"');
  const prog = await p.evaluate(() => JSON.stringify(Lab.progressFile.payload(true)));
  // Dashboard
  const d = await ctx.newPage(); d.errors = [];
  d.on('pageerror', e => d.errors.push(e.message));
  await d.goto('file://' + T.ROOT + '/teacher-dashboard.html'); await d.waitForTimeout(500);
  const two = JSON.parse(prog); two.student = { name: 'Second Student', period: '3' }; two.keyResults = two.keyResults.map(k => k.id === 'confidence' ? Object.assign({}, k, { value: 3, unit: '(I could teach this)' }) : k); two.datasetId = 'ZZZ-222';
  const three = JSON.parse(prog); three.student = { name: 'Third Student', period: '3' }; three.keyResults = three.keyResults.filter(k => k.id !== 'confidence'); three.datasetId = 'YYY-333'; three.data = Object.fromEntries(Object.entries(three.data).filter(([k]) => k !== 'keyres:confidence'));
  await d.evaluate(async ([a, b2, c]) => { await Dash.addFiles([new File([a], 'a.json'), new File([b2], 'b.json'), new File([c], 'c.json')]); }, [prog, JSON.stringify(two), JSON.stringify(three)]);
  await d.waitForTimeout(500);
  const heads = await d.$$eval('table.grid thead th', ths => ths.map(t => t.textContent.trim()));
  T.ok(heads.includes('Confidence'), 'dashboard has a Confidence column: ' + heads.join(' | '));
  const cells = await d.$$eval('table.grid tbody tr', trs => trs.map(tr => tr.innerText.replace(/\s+/g, ' ')));
  T.ok(cells.some(c => /I’m lost/.test(c)) && cells.some(c => /I could teach this/.test(c)), 'rows show the choice as text: ' + cells.map(c => c.slice(0, 60)).join(' || '));
  const sum = (await d.textContent('.conf-sum')).replace(/\s+/g, ' ');
  T.ok(/I could teach this ?1/.test(sum) && /I mostly get it ?0/.test(sum) && /I’m lost ?1/.test(sum) && /No answer ?1/.test(sum), 'per-lab summary counts: ' + sum);
  T.ok(!/Confidence \(/.test(heads.join('|')), 'confidence is not also listed as a generic key-result column');
  const csv = await d.evaluate(() => Dash.csv());
  T.ok(/Confidence \(1-3\),Confidence/.test(csv) && /I could teach this/.test(csv), 'CSV has the Confidence columns');
  T.ok(await d.evaluate(() => Dash.state.recs.every(r => !r.flags.some(f => /Identical key results/.test(f)))), 'identical confidence answers never flag copying');
  // sample data shows it too
  await d.click('#clear'); await d.click('#sample'); await d.waitForTimeout(400);
  T.ok(await d.locator('.conf-sum').count() >= 1, 'sample data shows the confidence summary');
  T.ok(d.errors.length === 0, 'dashboard: no errors ' + d.errors.join(';'));
  await b.close(); T.done('t34-confidence');
})();
