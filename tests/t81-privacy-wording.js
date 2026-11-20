/* Privacy wording (review L9). The page loads GoatCounter, so "Nothing you type is sent to the site" alone was
   incomplete. The wrap-up card now uses the site's standard line. */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1366,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','submit',server.url);
  try {
    const card = (await p.locator('.submit-card').textContent()).replace(/\s+/g,' ');
    T.ok(/counts anonymous page visits with GoatCounter \(no cookies\)\. Nothing you type, including your name and answers, is sent anywhere/.test(card), 'wrap-up card uses the standard privacy line');
    T.ok(!/Nothing you type is sent to the site/.test(await p.evaluate(() => document.body.innerText)), 'the old incomplete wording is gone');
    T.ok(await p.locator('script[src*="gc.zgo.at"]').count() === 1, 'GoatCounter is the analytics the wording names');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-privacy-wording');
})();
