/* Game announcements (review M3): one live region carries each roll's result and whose turn is next. Before the fix
   #dice-result and #turn-event were both live (the roll was read twice) and the turn change was never announced. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const roll = async values => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).turns;
    await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout:5000}).catch(() => {});
    await p.waitForTimeout(100);
  };
  try {
    await p.locator('input[name="game-mode"][value="group"]').check();
    await p.locator('#group-size').selectOption('2');
    await p.locator('#start-round1').click();
    const live = await p.evaluate(() => Array.from(document.querySelectorAll('#game-panel [aria-live], #game-panel [role="status"], #game-panel [role="alert"]'))
      .filter(el => !el.closest('.mechanism-check') && !el.closest('#cell-board')).map(el => el.id || el.className));
    T.ok(live.length === 1, `exactly one live region announces the game (${live.join(', ')})`);
    for (const id of ['dice-result','turn-event','round-summary'])
      T.ok(!(await p.locator('#'+id).evaluate(el => el.hasAttribute('aria-live') || el.getAttribute('role') === 'status')), `#${id} is not a second live region`);
    await roll([1,2,3,4]);
    const said = await p.locator('#game-announcer').textContent().catch(() => '');
    T.ok(/1, 2, 3, 4/.test(said), `the announcement includes the roll ("${said}")`);
    T.ok(/Player 2.s turn/.test(said), 'the announcement says it is Player 2\'s turn');
    T.ok(said.split(/Player 1 rolled/).length - 1 === 1, 'the roll is announced once');
    await roll([1,2,3,4]);
    T.ok(/Player 1.s turn/.test(await p.locator('#game-announcer').textContent().catch(() => '')), 'after Player 2 rolls, the announcement says Player 1\'s turn');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-game-announcer');
})();
