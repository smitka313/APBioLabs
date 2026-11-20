/* Play-test Nov 20: the scenarios the tester did not reach. G2 and M Checkpoint failures, a blue-chip division in
   Round 2, 3- and 4-player games played through the UI, every section at 390px in dark mode, and console errors
   throughout. Board: G1 1-6, G1 Checkpoint 7, S 8-15, G2 16-23, G2 Checkpoint 24, M 25-29, M Checkpoint 30, FINISH 31. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = (g1 = [3,3,3], s = 4, g2 = [1,1,1]) => ({g1:{nutrients:g1[0],proteins:g1[1],organelles:g1[2]},s:{chromosomes:s},g2:{nutrients:g2[0],proteins:g2[1],organelles:g2[2]}});
const pl = (pos, score, extra) => Object.assign({id:1,pos,score:score||sc(),status:'playing',turnsUsed:5,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}, extra||{});
const game = (round, player) => ({schema:3,mode:'solo',players:1,round,active:0,turns:5,complete:false,playersState:[player],chanceDeck:[0],logs:[],lastDice:[],lastRollSummary:'',
  roundResults:round === 2 ? {1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}} : {},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  let ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  let p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const errors = [];
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const seed = async g => { await p.evaluate(({key,g}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game:g})), {key:KEY,g}); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(150); };
  const roll = async values => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).turns; await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}); await p.waitForTimeout(60);
    if (await p.locator('#chance-reveal').isVisible()) { await p.locator('#chance-reveal-ack').click(); await p.waitForTimeout(60); }
    if (await p.locator('#round-end-dialog').evaluate(d => d.open)) await p.keyboard.press('Escape');
    return read();
  };
  try {
    // G2 Checkpoint failures.
    await seed(game(1, pl(23, sc([3,3,3],3,[1,1,1]))));
    let q = (await roll([6,6,6,6])).playersState[0];
    T.ok(q.pos === 8 && q.sentBack === 1 && q.score.s.chromosomes === 3 && /GO BACK TO THE FIRST SPACE/.test(await p.locator('#event-title').textContent()), 'G2 Checkpoint, 3 DNA: back to the first S space, check marks kept');
    T.ok((await p.locator('#checkpoint-title').textContent()) === 'Next checkpoint · G2 Checkpoint', 'after being sent back, the panel shows the G2 Checkpoint ahead again');
    await seed(game(1, pl(23, sc([3,3,3],4,[1,0,1]))));
    q = (await roll([6,6,6,6])).playersState[0];
    T.ok(q.pos === 0 && q.destroyed === 1 && q.score.s.chromosomes === 0 && /DESTROYED/.test(await p.locator('#event-title').textContent()), 'G2 Checkpoint, a 0 protein: destroyed by p53, back to START with a new scorecard');
    // M Checkpoint failure (Round 2, after a card skipped a check with requirements missing).
    await seed(game(2, pl(29, sc([3,3,3],4,[1,1,0]))));
    q = (await roll([6,6,6,6])).playersState[0];
    T.ok(q.pos === 0 && q.destroyed === 1 && q.blue === 0 && q.red === 0 && /M Checkpoint: destroyed by p53/.test(await p.locator('#event-title').textContent()), 'M Checkpoint with a requirement missing: p53 destroys the cell, no chip');
    // Blue-chip division in Round 2.
    await seed(game(2, pl(29)));
    q = (await roll([6,6,6,6])).playersState[0];
    T.ok(q.pos === 31 && q.blue === 1 && q.lastChip === 'blue' && /SUCCESSFULLY DIVIDED/.test(await p.locator('#event-title').textContent()), 'Round 2: a complete scorecard passes the M Checkpoint and takes a blue chip');
    T.ok(/^The cell divided: a non-cancer cell/.test(await p.locator('#checkpoint-subtitle').textContent()), 'Round 2 blue chip: FINISH reads as a plain division');
    const scene = await p.evaluate(() => window.CellCycleScene.state());
    T.ok(scene.view === 'daughters' && scene.daughters.every(d => !d.changed), 'Round 2 blue chip: the magnified view shows two identical daughter cells');
    q = (await roll([1,1,1,1])).playersState[0];
    T.ok(q.pos === 1 && q.score.g1.nutrients === 4 && q.score.s.chromosomes === 0, 'the next turn starts a new cell on G1 space 1');
    errors.push(...p.errors);
    // 3 and 4 players, set up and played through the UI, Round 1 and Round 2.
    for (const n of [3, 4]) {
      await p.evaluate(key => localStorage.removeItem(key), KEY); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click();
      await p.locator('input[name="game-mode"][value="group"]').check(); await p.locator('#group-size').selectOption(String(n));
      await p.locator('#start-round1').click();
      const order = [];
      for (let i = 0; i < n * 3; i++) { order.push((await read()).active + 1); await roll([1,2,3,4]); }
      T.ok(order.join('') === Array.from({length:3}, () => Array.from({length:n}, (_, i) => i + 1).join('')).join(''), `${n} players: turns go round in player order (${order.join('')})`);
      T.ok((await p.locator('.player-score').count()) === n && (await read()).playersState.every(x => x.turnsUsed === 3), `${n} players: ${n} scorecards, 3 turns each`);
      await p.locator('#end-round').click(); await p.locator('#confirm-game-reset').click(); await p.waitForTimeout(100);
      await p.locator('#round-end-next').click(); await p.waitForTimeout(100);
      const g = await read();
      T.ok(g.round === 2 && g.playersState.length === n, `${n} players: Round 2 starts with the same ${n} players`);
      for (let i = 0; i < n * 2; i++) await roll([1,2,3,4]);
      T.ok((await read()).playersState.every(x => x.turnsUsed >= 2), `${n} players: Round 2 turns go round (cards on light-blue squares included)`);
      T.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${n} players at 1919px: no horizontal scroll`);
    }
    errors.push(...p.errors);
    await ctx.close();
    // 390px, dark: every section, a running 4-player game and a card dialog.
    ctx = await T.ctxFor(browser, {width:390,height:844,reduced:true,dark:true});
    p = await T.open(ctx,'openscied-b3-cell-cycle.html','overview',server.url);
    await p.locator('.step-nav a[href="#growth-model"]').click(); await p.locator('#run-trials').click(); await p.waitForTimeout(100);
    const g4 = game(2, pl(1)); g4.mode = 'group'; g4.players = 4; g4.playersState = [1,2,3,4].map(id => pl(1 + id, null, {id})); g4.playersState[0].pos = 1; g4.chanceDeck = [11];
    await p.evaluate(({key,g}) => { const s = JSON.parse(localStorage.getItem(key)); s.game = g; localStorage.setItem(key, JSON.stringify(s)); }, {key:KEY,g:g4});
    await p.reload(); await p.waitForTimeout(200);   // load the seeded 4-player game
    const over = [];
    for (const id of ['overview','background','cell-game','growth-model','analyze','submit']) {
      await p.locator('.step-nav a[href="#' + id + '"]').click(); await p.waitForTimeout(250);
      if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) over.push(id);
      const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
      if (/255, 255, 255/.test(bg)) over.push(id + ' (light background)');
    }
    T.ok(!over.length, '390px dark: no horizontal scroll and dark background in every section' + (over.length ? ': ' + over.join(', ') : ''));
    await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(250);
    await p.evaluate(() => { let i = 0; const v = [1,2,3,4]; Math.random = () => (v[i++ % 4] - .5) / 6; });
    await p.locator('#roll-dice').click(); await p.waitForTimeout(700);
    const box = await p.locator('.chance-reveal-panel').boundingBox();
    T.ok(box && box.x >= 0 && box.x + box.width <= 390 && /Skip two checkpoints/.test(await p.locator('#chance-reveal-label').textContent()), '390px dark: the card dialog with its effect label fits');
    await p.locator('#chance-reveal-ack').click();
    T.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && (await p.locator('.player-score').count()) === 4, '390px dark: 4-player scorecards fit');
    errors.push(...p.errors);
    T.ok(errors.length === 0, 'no console errors or page errors in any of these: ' + errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-playtest-gaps');
})();
