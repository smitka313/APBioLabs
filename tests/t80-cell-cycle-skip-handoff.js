/* Multiplayer: when the player who rolls finishes their division and every other active player has a skipped turn
   waiting, the dice must pass to a player who is still playing. Before the fix the dice went back to the finished
   player, Roll did nothing, and the saved round stayed stuck after reloading. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const full = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1},m:{attachments:4}});
const pl = (id, pos, skip) => ({id,pos,score:full(),status:'playing',divisions:0,unchecked:0,restarts:0,bypassed:0,skipTurns:skip,bonusRolls:0});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const go = async id => { await p.locator('.step-nav a[href="#'+id+'"]').click(); await p.waitForFunction(id => document.getElementById(id).classList.contains('is-current'), id); };
  const roll = async values => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).turns;
    await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout: 5000}).catch(() => {});
    return (await read()).turns > before;
  };
  try {
    // Player 1 sits just before the final (M) checkpoint with a full scorecard; Player 2 has a skipped turn waiting.
    const game = {schema:2,mode:'multi',players:2,round:1,active:0,turns:0,complete:false,playersState:[pl(1,28,0),pl(2,5,1)],
      chanceDeck:[11],logs:[],lastDice:[],lastRollSummary:'',roundResults:{},event:{title:'Ready',copy:'Test setup',icon:'',kicker:'Cell cycle'}};
    await p.evaluate(({key,game}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game})), {key:KEY,game});
    await p.reload(); await go('cell-game');
    let tries = 0, g = await read();
    while (g.playersState[0].status === 'playing' && tries++ < 6) { await roll([5,6,5,6]); g = await read(); }
    T.ok(g.playersState[0].status === 'finished', `setup: Player 1 completes division (pos ${g.playersState[0].pos}, status ${g.playersState[0].status})`);
    T.ok(g.playersState[1].skipTurns === 0, 'Player 2 used up the skipped turn');
    T.ok(g.active === 1, `the dice pass to Player 2, who is still playing (active = ${g.active})`);
    const label = await p.locator('#active-player-label').textContent();
    T.ok(/Player 2/.test(label), `header names Player 2's turn ("${label.trim()}")`);
    T.ok(await roll([1,2,3,4]), 'Roll works for Player 2 (the round is not stuck)');
    await p.reload(); await go('cell-game');
    T.ok(await roll([1,2,3,4]), 'after a reload, the saved round still rolls');
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close && server.close(); T.done('t80-cell-cycle-skip-handoff');
})();
