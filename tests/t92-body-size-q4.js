/* Lesson 4 alignment: body size is tied to height ("a taller person has more cells of each type"), and Question 4 asks
   about age (4a, id "explanation") and body size (4b, new id "explanation-size") separately, each with its own data box.
   Old saves (no 4b field) still work and the saved option values are unchanged.
   T92_ROOT=<dir> runs the checks against another copy of the site. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const tr = (age, size, tissue, d) => ({ age, size, tissue, divisions: d, opportunities: d, modelVersion: 2, cancerCount: 0, controlChanges: 3 });
(async () => {
  const browser = await T.launch(), server = await T.serve(process.env.T92_ROOT || undefined);
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900, reduced: true });
    const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'growth-model', server.url);
    const opts = await p.locator('#body-size option').evaluateAll(o => o.map(x => [x.value, x.textContent]));
    T.ok(opts.map(o => o[0]).join() === 'small,average,large', 'the saved option values are unchanged (small, average, large)');
    T.ok(/shorter/i.test(opts[0][1]) && /average height/i.test(opts[1][1]) && /taller/i.test(opts[2][1]) && opts.map(o => o[1]).join().match(/20.*30.*40/), 'the options say shorter / average height / taller and keep the cell-unit counts');
    const note = await p.locator('#body-size-note').textContent().catch(() => '');
    T.ok(/taller person has more cells of each type/i.test(note) && /model, not a prediction for any individual/i.test(note), 'a caption says a taller person has more cells of each type, in a model, not a prediction');
    T.ok(await p.locator('#body-size').getAttribute('aria-describedby') === 'body-size-note', 'the caption is attached to the select for screen readers');
    T.ok(/height/i.test(await p.locator('label[for="body-size"]').textContent()), 'the label mentions height');
    T.ok(/taller person has more cells of each type/i.test(await p.locator('.model-assumptions').evaluate(e => e.textContent)), 'the model-assumptions text says it too');
    // Data: two sets differing only in age, two only in body size, one in cell type.
    const trials = [
      ...[300, 310, 305].map(d => tr(50, 'average', 'colon', d)), ...[480, 470, 490].map(d => tr(80, 'average', 'colon', d)),
      ...[200, 210, 205].map(d => tr(50, 'small', 'colon', d)), ...[160, 150, 170].map(d => tr(50, 'average', 'skin', d))];
    await p.evaluate(({ k, trials }) => localStorage.setItem(k, JSON.stringify({ v: 1, trials, fields: {}, lastSection: 'analyze' })), { k: KEY, trials });
    await p.reload(); await p.waitForTimeout(600);
    await p.locator('.step-nav a[href="#analyze"]').click(); await p.locator('#analyze').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.locator('#analysis-next').click(); await p.waitForTimeout(300);
    const q = await p.evaluate(() => ['explanation', 'explanation-size'].map(id => { const f = document.getElementById(id), l = document.querySelector('label[for="' + id + '"]'); return f ? { label: l.textContent, data: (document.getElementById('qe-' + id) || { innerText: '' }).innerText.replace(/\s+/g, ' '), visible: !!f.offsetParent, adjacent: !!document.getElementById('qe-' + id) && document.getElementById('qe-' + id).nextElementSibling === f } : null; }));
    T.ok(q[0] && q[1] && q[0].visible && q[1].visible, 'Questions 4a and 4b are both on Part 2 as separate answer boxes');
    T.ok(q[0] && /4a/.test(q[0].label) && /age/i.test(q[0].label) && !/body size/i.test(q[0].label), 'Question 4a asks only about age: ' + (q[0] && q[0].label));
    T.ok(q[1] && /4b/.test(q[1].label) && /body size/i.test(q[1].label) && !/\bage\b/i.test(q[1].label), 'Question 4b asks only about body size: ' + (q[1] && q[1].label));
    T.ok(q[0] && /Set 1: age 50 · Average body · Colon lining → mean 305\.0/.test(q[0].data) && /Set 2: age 80 · Average body · Colon lining → mean 480\.0/.test(q[0].data) && !/Set 3|Set 4/.test(q[0].data), '4a data box shows only the sets that differ only in age: ' + (q[0] && q[0].data));
    T.ok(q[1] && /Set 3: age 50 · Smaller body · Colon lining → mean 205\.0/.test(q[1].data) && /Set 1: .*Average body/.test(q[1].data) && !/Set 2|Set 4/.test(q[1].data), '4b data box shows only the sets that differ only in body size: ' + (q[1] && q[1].data));
    T.ok(q[0] && q[1] && q[0].adjacent && q[1].adjacent, 'each data box sits directly above its answer box');
    await p.locator('#explanation-size').fill('A taller person has more cells so more divisions.');
    await p.locator('#explanation').fill('Older means more years of division.');
    await p.waitForFunction(k => /taller person has more cells/.test(localStorage.getItem(k) || ''), KEY);
    const saved = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(saved.fields.explanation === 'Older means more years of division.' && saved.fields['explanation-size'].includes('taller') && saved.responseIds.includes('explanation-size') && saved.responseIds.includes('explanation'), 'both answers save, and both ids are in the response list (dashboard count)');
    await p.reload(); await p.waitForTimeout(500);
    T.ok(await p.locator('#explanation-size').inputValue() !== '' && await p.locator('#explanation').inputValue() !== '', 'both answers restore after a reload');
    // Old save: only the age answer, no 4b field.
    await p.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 1, trials: [], fields: { explanation: 'old answer', 'body-size': 'large' }, lastSection: 'analyze' })), KEY);
    await p.reload(); await p.waitForTimeout(500);
    T.ok(await p.locator('#explanation').inputValue() === 'old answer' && await p.locator('#explanation-size').inputValue() === '' && await p.locator('#body-size').inputValue() === 'large' && p.errors.length === 0, 'an old save keeps its age answer and body size; 4b is empty; no errors ' + p.errors.join(';'));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t92-body-size-q4');
})();
