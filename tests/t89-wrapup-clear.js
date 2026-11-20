/* Play-test Nov 20, item 1: "Clear this activity" in Wrap Up did nothing. It relied on window.confirm, which the
   browser (or an automation tool) can suppress, so the click returned without clearing. It now uses the page's own
   confirm dialog (the same <dialog> as Restart / New game / End round), clears what the dashboard's Clear clears for
   this activity (its saved record; the site-wide sign-in stays), and reloads a fresh activity at the Overview. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','overview',server.url);
  try {
    // Saved work in every part: a game round, a growth set, an answer and the Quick check.
    await p.locator('.step-nav a[href="#cell-game"]').click();
    await p.locator('#start-round1').click();
    await p.locator('#roll-dice').click(); await p.waitForTimeout(700);
    await p.locator('.step-nav a[href="#growth-model"]').click();
    await p.locator('#run-trials').click(); await p.waitForTimeout(200);
    await p.locator('.step-nav a[href="#analyze"]').click();
    await p.locator('#analysis-design').fill('I changed only the age.');
    await p.locator('.step-nav a[href="#submit"]').click();
    await p.waitForFunction(() => document.getElementById('submit').classList.contains('is-current'));
    const saved = await p.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    T.ok(saved && saved.game.round === 1 && saved.trials.length === 3 && saved.fields['analysis-design'], 'setup: a round, a trial set and an answer are saved');
    // No native dialogs are involved any more: fail loudly if one appears.
    let nativeDialogs = 0; p.on('dialog', d => { nativeDialogs++; d.dismiss(); });
    await p.locator('#reset-work').click();
    const dialog = p.locator('#game-reset-dialog');
    T.ok(await dialog.evaluate(d => d.open), 'clicking "Clear this activity" opens the page\'s confirm dialog');
    T.ok((await p.locator('#game-reset-title').textContent()) === 'Clear this activity?' && (await p.locator('#confirm-game-reset').textContent()) === 'Clear this activity',
      'the dialog names the action on its title and confirm button');
    T.ok(/name and class period stay saved/.test(await p.locator('#game-reset-description').textContent()), 'the dialog says the sign-in is kept');
    await p.locator('#cancel-game-reset').click();
    T.ok(!(await dialog.evaluate(d => d.open)) && !!(await p.evaluate(key => localStorage.getItem(key), KEY)), 'Cancel closes the dialog and keeps the saved work');
    await p.locator('#reset-work').click();
    await Promise.all([p.waitForEvent('load'), p.locator('#confirm-game-reset').click()]);
    await p.waitForTimeout(700);
    T.ok(await p.evaluate(key => localStorage.getItem(key), KEY) === null, 'confirming removes the activity\'s saved record');
    T.ok(await p.evaluate(() => !!localStorage.getItem('aplab:student')), 'the site-wide sign-in (name and class period) is kept, as on the dashboard');
    T.ok(await p.evaluate(() => location.hash) === '#overview' && await p.locator('#overview').evaluate(s => s.classList.contains('is-current')), 'the page reloads at the Overview');
    T.ok(await p.locator('#game-setup').isVisible({timeout:100}).catch(() => false) || await p.evaluate(() => !document.getElementById('game-setup').hidden), 'the game is back to player setup');
    T.ok(await p.locator('#analysis-design').inputValue() === '' && (await p.locator('#trial-rows').textContent()).includes('Run trials'), 'answers and trials are blank');
    T.ok(nativeDialogs === 0, 'no native confirm() dialog is used');
    const d = await T.open(ctx,'openscied-dashboard.html','',server.url);
    T.ok((await d.locator('#cell-cycle-progress').textContent()) === 'Not started', 'the dashboard shows the activity as not started');
    T.ok(p.errors.length === 0 && d.errors.length === 0, 'no page errors: ' + p.errors.concat(d.errors).join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-wrapup-clear');
})();
