/* Usability item 6: the lab toolbar says "Name and period:", "Your data ID" and "Switch student".
   The change, new dataset and help controls stay.
   Run: NODE_PATH=$(npm root -g) node tests/t117-usability-toolbar-wording.js */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900, dark: false }), p = await ctx.newPage();
    await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
    await p.goto(server.url + 'lab01.html'); await p.waitForTimeout(700);
    const m = await p.evaluate(() => {
      const line = document.querySelector('.id-line');
      const sw = line && line.querySelector('.id-signout');
      return { text: line ? line.innerText.replace(/\s+/g, ' ').trim() : '', switchText: sw ? sw.textContent.trim() : null,
        change: !!(line && line.querySelector('.id-change')), newds: !!(line && line.querySelector('.id-newds')), help: !!(line && line.querySelector('.id-help')),
        dsCode: !!(line && line.querySelector('code.ds-id')) };
    });
    T.ok(/Name and period: Test Student/.test(m.text), 'toolbar starts "Name and period:" (' + m.text + ')');
    T.ok(/Your data ID [A-Z0-9]{3}-[A-Z0-9]{3}/.test(m.text), 'toolbar says "Your data ID" with the ID');
    T.ok(!/Signed in as|Dataset ID|Sign out/.test(m.text), 'toolbar no longer says "Signed in as", "Dataset ID" or "Sign out"');
    T.ok(m.switchText === 'Switch student' && /· Switch student/.test(m.text), 'sign-out control is labelled "Switch student" (' + m.switchText + ')');
    T.ok(m.change && m.newds && m.help && m.dsCode, 'change, new dataset values and help controls are kept');
    await ctx.close();
  } finally { await browser.close(); server.close(); }
  T.done('t117-usability-toolbar-wording');
})().catch(e => { console.error(e); process.exitCode = 1; });
