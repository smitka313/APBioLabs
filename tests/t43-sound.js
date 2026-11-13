/* Sound: off by default, Web Audio only, speaker toggle beside the theme switch, stored in aplab:pref:sound and kept by Sign out / Start over.
   Run: NODE_PATH=$(npm root -g) node tests/t43-sound.js */
const T = require('./_h');
const FIX = 'tests/fixtures/lab99.html';
const KEY = 'aplab:pref:sound';
const get = p => p.evaluate(k => localStorage.getItem(k), KEY);

(async () => {
  const srv = await T.serve(), b = await T.launch();
  let ctx = await T.ctxFor(b);
  let p = await T.open(ctx, FIX, '', srv.url);

  console.log('Toggle');
  const tog = p.locator('.crumbs .sound-toggle');
  T.ok(await tog.count() === 1, 'a speaker button is in the header crumbs');
  T.ok(await p.evaluate(() => { const s = document.querySelector('.crumbs .theme-switch'); return !!s && s.nextElementSibling === document.querySelector('.sound-toggle'); }), 'directly after the theme switch');
  T.ok(await tog.getAttribute('aria-pressed') === 'false' && await get(p) === null, 'off by default, nothing stored');
  T.ok(/off/.test(await tog.getAttribute('title')) && !!(await tog.getAttribute('aria-label')), 'has a label and a state title');

  console.log('Audio only after a gesture, only when on');
  T.ok(await p.evaluate(() => Lab.sound.play('beep')) === false, 'play() is silent while the toggle is off');
  { // Playwright's evaluate() counts as a user gesture, so hide the browser's activation flag in a second page: only a real click may unlock audio
    const c2 = await T.ctxFor(b);
    await c2.addInitScript(() => { window.__ac = 0; const AC = window.AudioContext; window.AudioContext = function (...a) { window.__ac++; return new AC(...a); }; Object.defineProperty(Navigator.prototype, 'userActivation', { get() { return { hasBeenActive: false, isActive: false }; } }); });
    const q = await T.open(c2, FIX, '', srv.url);
    await q.evaluate(k => localStorage.setItem(k, 'on'), KEY);
    T.ok(await q.evaluate(() => Lab.sound.play('beep')) === false && await q.evaluate(() => window.__ac) === 0, 'with the preference on but no user gesture yet: silent and no AudioContext is created');
    await q.mouse.click(20, 300);
    T.ok(await q.evaluate(() => Lab.sound.play('beep')) === true && await q.evaluate(() => window.__ac) === 1, 'after a real click it plays (one AudioContext)');
    await c2.close();
  }
  await tog.click();
  T.ok(await tog.getAttribute('aria-pressed') === 'true' && await get(p) === 'on', 'clicking turns it on and stores aplab:pref:sound');
  T.ok(await p.evaluate(() => Lab.sound.enabled), 'Lab.sound.enabled');
  await p.waitForTimeout(80);
  const names = await p.evaluate(() => Lab.sound.names);
  T.ok(['click', 'hiss', 'beep', 'pop', 'chime', 'buzz', 'tick'].every(n => names.includes(n)) && names.length === 7, 'the seven sounds: ' + names.join(', '));
  let played = 0;
  for (const n of names) { if (await p.evaluate(n => Lab.sound.play(n), n)) played++; await p.waitForTimeout(60); }
  T.ok(played === 7, 'every sound starts after a gesture (' + played + '/7)');
  T.ok(await p.evaluate(() => Lab.sound.play('nope')) === false, 'an unknown name is ignored');
  T.ok(await p.evaluate(() => !document.querySelector('audio, source') && !performance.getEntriesByType('resource').some(r => /\.(mp3|wav|ogg|m4a)/i.test(r.name))), 'no audio files');

  console.log('Soft and short (rendered offline)');
  for (const n of names) {
    const r = await p.evaluate(n => Lab.sound.render(n), n);
    T.ok(r && r.peak > 0.01 && r.peak <= 0.16 && r.seconds < 1 && r.rms < 0.1, `${n}: peak ${r && r.peak.toFixed(3)} (${r && (20 * Math.log10(r.peak)).toFixed(1)} dBFS), ${r && r.seconds.toFixed(2)} s`);
  }

  console.log('Lab.loop tick');
  const ticks = await p.evaluate(async () => {
    let n = 0; const orig = Lab.sound.play; Lab.sound.play = name => { if (name === 'tick') n++; return orig(name); };
    const lp = Lab.loop(() => {}, { tick: 0.2 }); lp.start(); await new Promise(r => setTimeout(r, 1300)); lp.stop();
    const lp2 = Lab.loop(() => {}); lp2.start(); const before = n; await new Promise(r => setTimeout(r, 600)); lp2.stop();
    Lab.sound.play = orig; return [n, n - before];
  });
  T.ok(ticks[0] >= 4 && ticks[0] <= 7, 'a loop that opts in ticks about every interval (' + ticks[0] + ' in 1.3 s)');
  T.ok(ticks[1] === 0, 'a loop that does not opt in never ticks');

  console.log('Persistence');
  await p.reload(); await p.waitForTimeout(700);
  T.ok(await p.locator('.sound-toggle').getAttribute('aria-pressed') === 'true', 'still on after a reload');
  await p.locator('.sound-toggle').click();
  T.ok(await get(p) === null && await p.locator('.sound-toggle').getAttribute('aria-pressed') === 'false', 'turning it off removes the key');
  T.ok(await p.evaluate(() => Lab.sound.play('click')) === false, 'and silences everything');
  await p.locator('.sound-toggle').click();
  T.ok(p.errors.length === 0, 'no console errors ' + p.errors.join('|'));
  await ctx.close();

  console.log('Survives Sign out and Start over');
  ctx = await T.ctxFor(b, { seed: {} });
  p = await T.open(ctx, 'lab05.html', '', srv.url);
  await p.evaluate(k => { localStorage.setItem(k, 'on'); localStorage.setItem('aplab:lab05:field:zz-test', JSON.stringify('x')); }, KEY);
  await p.reload(); await p.waitForTimeout(700);
  T.ok(await p.locator('.sound-toggle').getAttribute('aria-pressed') === 'true', 'lab 5 shows it on');
  // Start over (this lab)
  await p.evaluate(() => Lab.pages.go('submit')); await p.waitForTimeout(300);
  await p.locator('.responses-bar .btn-startover').click();
  await p.locator('.dm-card input[type=checkbox]').check();
  let nav = p.waitForNavigation({ waitUntil: 'load' }).catch(() => {});
  await p.locator('.dm-confirm').click(); await nav; await p.waitForTimeout(900);
  T.ok(await get(p) === 'on' && await p.evaluate(() => localStorage.getItem('aplab:lab05:field:zz-test')) === null, 'Start over (lab): the lab is erased, sound stays on');
  // Start over (all labs), from home
  await p.goto(srv.url + 'index.html'); await p.waitForTimeout(800);
  await p.locator('.manage-data summary').click(); await p.locator('#md-startover').click();
  await p.locator('.dm-text').fill('ERASE');
  nav = p.waitForNavigation({ waitUntil: 'load' }).catch(() => {});
  await p.locator('.dm-confirm').click(); await nav; await p.waitForTimeout(900);
  T.ok(await get(p) === 'on', 'Start over (all labs): sound stays on');
  // Sign out
  await p.locator('#home-identity .id-signout').click();
  await p.locator('.dm-text').fill('Test');
  nav = p.waitForNavigation({ waitUntil: 'load' }).catch(() => {});
  await p.locator('.dm-confirm').click(); await nav; await p.waitForTimeout(900);
  T.ok(await p.evaluate(() => !localStorage.getItem('aplab:student')), 'signed out (the student is gone)');
  T.ok(await get(p) === 'on', 'Sign out keeps aplab:pref:sound');
  await p.goto(srv.url + 'lab05.html'); await p.waitForTimeout(700);
  T.ok(await p.locator('.sound-toggle').getAttribute('aria-pressed') === 'true', 'and the next student still sees the speaker on');
  await ctx.close();

  console.log('Reduced motion keeps sound available');
  ctx = await T.ctxFor(b, { reduced: true });
  p = await T.open(ctx, FIX, '', srv.url);
  T.ok(await p.locator('.sound-toggle').isVisible(), 'the toggle is still offered');
  await p.locator('.sound-toggle').click(); await p.waitForTimeout(80);
  T.ok(await p.evaluate(() => Lab.sound.play('chime')), 'and works once on');
  await ctx.close();

  await b.close(); srv.close();
  T.done('t43-sound');
})();
