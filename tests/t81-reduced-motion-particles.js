/* Reduced motion (review L6): with prefers-reduced-motion, collecting materials must not fly "particles" across the
   board. Before the fix they animated for 850 ms regardless. Without reduced motion they still appear. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
async function particlesAfterRoll(browser, server, reduced) {
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  await p.locator('#start-round1').click();
  await p.evaluate(() => { let i = 0; const v = [1,2,3,1]; Math.random = () => (v[i++ % 4] - .5) / 6; });
  // Count particle draws: drawParticles paints each one with a shadow of the particle colour.
  await p.evaluate(() => { window.__particles = 0; const c = document.getElementById('cycle-scene').getContext('2d');
    for (const name of ['arc','ellipse']) { const fn = c[name]; c[name] = function () { if (c.shadowBlur === 8 && /9ee9bf|d1b3ee/i.test(String(c.shadowColor))) window.__particles++; return fn.apply(this, arguments); }; } });
  await p.locator('#roll-dice').click();
  await p.waitForFunction(key => JSON.parse(localStorage.getItem(key)).game.turns > 0, KEY);
  await p.waitForTimeout(500);
  const n = await p.evaluate(() => window.__particles), errors = p.errors;
  await ctx.close();
  return {n, errors};
}
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    const moving = await particlesAfterRoll(browser, server, false);
    const still = await particlesAfterRoll(browser, server, true);
    T.ok(moving.n > 0, `without reduced motion, collected materials animate (${moving.n} particle draws)`);
    T.ok(still.n === 0, `with reduced motion, no particles are drawn (${still.n} particle draws)`);
    T.ok(moving.errors.length + still.errors.length === 0, 'no page errors: ' + moving.errors.concat(still.errors).join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-reduced-motion-particles');
})();
