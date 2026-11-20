/* Branding and attribution (review M4/M5). Titles must not lead with the OpenSciEd mark, and the credit, the source
   license (CC BY-NC 4.0), a note that changes were made, a link to OpenSciEd and the non-endorsement statement must be
   visible footer text on every section of the cell-cycle page and on the dashboard. Before the fix the disclaimer only
   appeared in section 6 and the dashboard had no license or non-endorsement line. */
const T = require('./_h');
const SECTIONS = ['overview','background','cell-game','growth-model','analyze','submit'];
async function footerChecks(p, where) {
  const f = p.locator('footer.site-footer');
  T.ok(await f.isVisible(), `${where}: site footer is visible`);
  const text = (await f.textContent()).replace(/\s+/g,' ');
  T.ok(/Independently developed by Robert Smitka\. Not affiliated with, endorsed by, or sponsored by OpenSciEd\. OpenSciEd is a trademark of its owner\./.test(text), `${where}: non-endorsement statement in the footer`);
  T.ok(/Created by Robert Smitka/.test(text) && await f.locator('a[href="https://creativecommons.org/licenses/by-nc-sa/4.0/"]').count() === 1, `${where}: site credit and CC BY-NC-SA 4.0 license`);
  T.ok(/CC BY-NC 4\.0/.test(text) && await f.locator('a[href="https://creativecommons.org/licenses/by-nc/4.0/"]').count() === 1, `${where}: source license CC BY-NC 4.0 is named and linked`);
  T.ok(await f.locator('a[href="https://www.openscied.org/"]').count() >= 1, `${where}: footer links to OpenSciEd`);
  T.ok(/Adapted and reorganized as an interactive companion/.test(text), `${where}: footer says changes were made`);
  T.ok(/counts anonymous page visits with GoatCounter \(no cookies\)\. Nothing you type, including your name and answers, is sent anywhere/.test(text), `${where}: standard privacy line`);
}
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1366,height:900,reduced:true});
  try {
    const p = await T.open(ctx,'openscied-b3-cell-cycle.html','',server.url);
    const title = await p.title();
    T.ok(!/^OpenSciEd/.test(title) && /Cell Cycle/.test(title) && /companion/i.test(title), `page title does not lead with OpenSciEd ("${title}")`);
    T.ok(!/^OpenSciEd/.test(await p.locator('meta[property="og:title"]').getAttribute('content')), 'og:title does not lead with OpenSciEd');
    for (const id of SECTIONS) {
      await p.locator('.step-nav a[href="#'+id+'"]').click();
      await p.waitForFunction(id => document.getElementById(id).classList.contains('is-current'), id);
      const text = (await p.locator('footer.site-footer').isVisible()) ? await p.locator('footer.site-footer').textContent() : '';
      T.ok(/Not affiliated with, endorsed by, or sponsored by OpenSciEd/.test(text), `section ${id}: non-endorsement statement visible`);
    }
    await footerChecks(p, 'cell-cycle page');
    const foot = (await p.locator('footer.site-footer').textContent()).replace(/\s+/g,' ');
    T.ok(/Biology Unit B\.3: Inheritance & Variation of Traits/.test(foot), 'footer names the unit by its official title');
    T.ok(!/Traits: Cancer/.test(await p.content()), 'no other unit title remains on the page');
    const ld = JSON.parse(await p.locator('script[type="application/ld+json"]').textContent());
    T.ok(ld['@graph'].find(n => /#webpage$/.test(n['@id'])).license === 'https://creativecommons.org/licenses/by-nc-sa/4.0/', 'JSON-LD license stays this site\'s CC BY-NC-SA 4.0');
    const body = await p.evaluate(() => document.body.innerText);
    T.ok(!/OpenSciEd[^.]*licensed under[^.]*(BY-NC-SA|Attribution 4\.0)/i.test(body), 'page text does not give OpenSciEd a different license');
    const crumb = await p.locator('.crumbs a[href="openscied-dashboard.html"]').textContent();
    T.ok(!/^OpenSciEd/.test(crumb.trim()), `breadcrumb to the dashboard does not lead with OpenSciEd ("${crumb}")`);
    const d = await T.open(ctx,'openscied-dashboard.html','',server.url);
    const dt = await d.title(), h1 = await d.locator('h1').textContent();
    T.ok(!/^OpenSciEd/.test(dt) && /Companion Activities/.test(dt), `dashboard title does not lead with OpenSciEd ("${dt}")`);
    T.ok(!/^OpenSciEd/.test(h1.trim()), `dashboard heading does not lead with OpenSciEd ("${h1}")`);
    T.ok(await d.locator('link[rel=canonical]').getAttribute('href') === 'https://biologylabbench.com/openscied-dashboard.html', 'dashboard URL is unchanged');
    await footerChecks(d, 'dashboard');
    T.ok(p.errors.length === 0 && d.errors.length === 0, 'no page errors: ' + p.errors.concat(d.errors).join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-branding-attribution');
})();
