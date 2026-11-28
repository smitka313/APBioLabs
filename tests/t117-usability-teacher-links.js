/* Usability items 7 and 8: projector.html has a visible "Back to the teacher guide" link near the top;
   teacher-hub.html calls the printable directions "Printable student directions" (the OpenSciEd "Teaching guide" links stay).
   Run: NODE_PATH=$(npm root -g) node tests/t117-usability-teacher-links.js */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 390, height: 844, dark: false }), p = await ctx.newPage();
    await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
    await p.goto(server.url + 'projector.html'); await p.waitForTimeout(500);
    const back = await p.evaluate(() => {
      const a = Array.from(document.querySelectorAll('a')).find(x => x.textContent.trim() === 'Back to the teacher guide');
      if (!a) return null;
      const r = a.getBoundingClientRect();
      return { href: a.getAttribute('href'), top: r.top, visible: r.width > 0 && r.height > 0 && getComputedStyle(a).visibility !== 'hidden' };
    });
    T.ok(back && back.href === 'teachers.html' && back.visible, 'projector.html has a visible "Back to the teacher guide" link to teachers.html');
    T.ok(back && back.top >= 0 && back.top < 300, 'the back link sits near the top of the page (top ' + (back && Math.round(back.top)) + 'px)');
    await p.goto(server.url + 'teacher-hub.html'); await p.waitForTimeout(500);
    const hub = await p.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const dirs = links.filter(a => /directions-lab\d\d\.html$/.test(a.getAttribute('href') || ''));
      return { printable: dirs.filter(a => a.textContent.replace(/\s+/g, ' ').trim().startsWith('Printable student directions')).length,
        dirsTotal: dirs.length, dirsTeaching: dirs.filter(a => /Teaching guide/.test(a.textContent)).length,
        osTeaching: links.filter(a => /openscied-teacher-guide\.html#/.test(a.getAttribute('href') || '') && /Teaching guide/.test(a.textContent)).length };
    });
    T.ok(hub.dirsTotal === 13 && hub.printable === 13, 'teacher hub labels all 13 directions links "Printable student directions" (' + hub.printable + '/' + hub.dirsTotal + ')');
    T.ok(hub.dirsTeaching === 0, 'no directions link is still labelled "Teaching guide" (' + hub.dirsTeaching + ')');
    T.ok(hub.osTeaching > 0, 'OpenSciEd guide links keep their "Teaching guide" label (' + hub.osTeaching + ')');
    await ctx.close();
  } finally { await browser.close(); server.close(); }
  T.done('t117-usability-teacher-links');
})().catch(e => { console.error(e); process.exitCode = 1; });
