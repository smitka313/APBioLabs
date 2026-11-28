/* Usability item 2: the OpenSciEd dashboard's unit chips use the same names as their unit headings.
   Run: NODE_PATH=$(npm root -g) node tests/t117-usability-dashboard-chips.js */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900, dark: false }), p = await ctx.newPage();
    await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
    await p.goto(server.url + 'openscied-dashboard.html'); await p.waitForTimeout(700);
    const m = await p.evaluate(() => {
      const name = id => { const h = document.getElementById(id); return h ? h.textContent.replace(/^\s*Unit\s*\d+\s*·\s*/, '').trim() : null; };
      const chip = href => { const a = document.querySelector('a[href="' + href + '"] .jump-name'); return a ? a.textContent.trim() : null; };
      const opt = v => { const o = document.querySelector('#activity-group option[value="' + v + '"]'); return o ? o.textContent.replace(/^\d+\s*·\s*/, '').trim() : null; };
      return { h3: name('unit3'), c3: chip('#unit3'), h5: name('unit5'), c5: chip('#unit5'), o3: opt('unit3'), o5: opt('unit5'),
        anchors: ['#unit1', '#unit2', '#unit3', '#unit4', '#unit5'].map(h => !!document.querySelector('a[href="' + h + '"]')) };
    });
    T.ok(m.c3 === 'Inheritance & Variation of Traits' && m.c3 === m.h3, 'Unit 3 chip matches its heading: "' + m.c3 + '" vs "' + m.h3 + '"');
    T.ok(m.c5 === 'Common Ancestry & Speciation' && m.c5 === m.h5, 'Unit 5 chip matches its heading: "' + m.c5 + '" vs "' + m.h5 + '"');
    T.ok(m.anchors.every(Boolean), 'chip anchors #unit1 to #unit5 are kept');
    T.ok(m.o3 === m.h3 && m.o5 === m.h5, 'unit filter options use the same unit names');
    await ctx.close();
  } finally { await browser.close(); server.close(); }
  T.done('t117-usability-dashboard-chips');
})().catch(e => { console.error(e); process.exitCode = 1; });
