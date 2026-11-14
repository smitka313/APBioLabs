/* Audit 4 #6, Lab 10: once every plant in the flat is harvested the page offers "Plant a new set" (keeps the harvest data, says why a
   second age is needed for NPP) instead of leaving the student stuck on day 28. Erased state. LAB10_FILE overrides the page. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b, { width: 1920, height: 1080 });
  const p = await T.open(ctx, process.env.LAB10_FILE || 'lab10.html', 'part-1-npp');
  await p.evaluate(() => { Object.keys(localStorage).filter(k => /^aplab:lab10/.test(k)).forEach(k => localStorage.removeItem(k)); });
  await p.reload(); await p.waitForTimeout(900);
  const vis = () => p.evaluate(() => { const b = document.querySelector('#p1-newset'); return !!b && b.offsetParent !== null; });
  const left = () => p.evaluate(() => document.querySelector('#p1-left').textContent.trim());
  const nrows = () => p.evaluate(() => (Lab.store.get('p1raw') || []).length);
  await p.evaluate(() => { const t = document.querySelector('#p-p1-diagram'); t.value = 'energy in from light, out as respiration and biomass'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  const settled = () => p.waitForFunction(() => !document.querySelector('#p1-rd').textContent.includes('drying') && !document.querySelector('#p1-dry').disabled || /dried|g$/.test(document.querySelector('#p1-rd').textContent), null, { timeout: 20000 });
  for (let i = 0; i < 4; i++) { await p.click('#p1-plus7'); await p.waitForTimeout(600); }   // day 28 (clock stops there)
  for (let h = 0; h < 4; h++) {
    T.ok(!(await vis()), `before harvest ${h + 1} the new-set button is not offered (${await left()} plants left)`);
    await p.click('#p1-harvest'); await p.waitForTimeout(400); await p.click('#p1-dry');
    await p.waitForFunction(() => /^\d/.test(document.querySelector('#p1-rd').textContent) || /\d\.\d/.test(document.querySelector('#p1-rd').textContent), null, { timeout: 30000 }); await p.waitForTimeout(500);
  }
  T.ok(await left() === '0', 'all 40 plants harvested');
  const before = await nrows();
  T.ok(await vis(), 'the "Plant a new set" button is offered');
  const st = await p.evaluate(() => document.querySelector('#p1-status').textContent);
  T.ok(/different days/.test(st) && /data stays/.test(st), 'the status explains that data stays and NPP needs harvests on different days: ' + st.slice(0, 120));
  await p.click('#p1-newset'); await p.waitForTimeout(600);
  T.ok(await left() === '40' && await p.evaluate(() => document.querySelector('#p1-day').textContent.trim()) === '4', 'a new flat of 40 plants at day 4');
  T.ok(await nrows() === before && before === 40, 'all 40 earlier plant rows are still in the data (' + before + ')');
  T.ok(!(await vis()), 'the button goes away again');
  await p.click('#p1-plus7'); await p.waitForTimeout(600);
  await p.click('#p1-harvest'); await p.waitForTimeout(500);
  T.ok(await p.evaluate(() => (Lab.store.get('p1raw') || []).slice(-1)[0].hv) === 'H5', 'the next harvest is H5 (numbering continues)');
  await p.reload(); await p.waitForTimeout(900);
  T.ok(await left() === '30' && await nrows() === 50, 'a reload keeps the new set and the data');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab10 plant a new set');
})();
