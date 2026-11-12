/* Saves are not lost on a quick reload: table rows, typed table cells, prompts */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'lab02.html', 'many-generations');
  // add a row and reload inside 100 ms
  await p.evaluate(() => {
    const d = document.createElement('div'); d.id = 'ft'; document.body.append(d);
    window.__t = Lab.table('#ft', { save: 'flushtest', columns: [{ key: 'a', label: 'A', num: true, editable: true }] });
    window.__t.addRow({ a: 7 });
  });
  await p.waitForTimeout(50);
  const stored = await p.evaluate(() => Lab.store.get('flushtest'));
  T.ok(stored && stored.length === 1 && stored[0].a === 7, 'row is in storage 50 ms after addRow');
  await p.evaluate(() => { const i = document.querySelector('#ft input'); i.value = '9'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  T.ok(await p.evaluate(() => Lab.store.get('flushtest')[0].a) === 9, 'typed cell value saved on input, before blur');
  // prompt typed then immediate reload (autosave debounce is 400 ms)
  await p.evaluate(() => { const t = document.querySelector('textarea[data-save]'); window.__key = t.dataset.save; t.value = 'quick answer'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  const key = await p.evaluate(() => window.__key);
  await p.reload(); await p.waitForTimeout(100);
  const after = await p.evaluate(k => ({ v: Lab.store.get('field:' + k), t: Lab.store.get('flushtest') }), key);
  T.ok(after.v === 'quick answer', 'prompt text typed <400 ms before reload is kept: ' + after.v);
  T.ok(after.t && after.t[0].a === 9, 'table row survives reload');
  await b.close();
  T.done('t16-save-flush');
})();
