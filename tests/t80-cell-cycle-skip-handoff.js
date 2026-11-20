/* Multiplayer turn hand-off. When the player who rolls uses their last turn of the round and the next player has a
   skipped turn waiting ("p53 will not let you pass. You lose a turn!"), the dice must pass to a player who is still
   playing. Before the original fix the dice could go back to a finished player, Roll did nothing, and the saved round
   stayed stuck after reloading. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const full = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}});
const pl = (id, pos, extra) => Object.assign({id,pos,score:full(),status:'playing',turnsUsed:10,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}, extra);
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
    // Player 1 is on its 75th (last) turn on M space 5; Player 2 has a skipped turn waiting; Player 3 is playing.
    const game = {schema:3,mode:'group',players:3,round:1,active:0,turns:0,complete:false,playersState:[pl(1,29,{turnsUsed:74}),pl(2,5,{skipTurns:1}),pl(3,12)],
      chanceDeck:[],logs:[],lastDice:[],lastRollSummary:'',roundResults:{},chanceNotice:null,event:{title:'Ready',copy:'Test setup',icon:'',kicker:'Cell cycle'}};
    await p.evaluate(({key,game}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game})), {key:KEY,game});
    await p.reload(); await go('cell-game');
    T.ok(await roll([1,2,3,4]), 'setup: Player 1 takes its last turn');
    let g = await read();
    T.ok(g.playersState[0].status === 'done' && g.playersState[0].blue === 1, `Player 1 divides on its last turn and is done (status ${g.playersState[0].status}, blue ${g.playersState[0].blue})`);
    T.ok(g.playersState[1].skipTurns === 0 && g.playersState[1].turnsUsed === 11, 'Player 2 loses its turn (the skipped turn is used up)');
    T.ok(g.active === 2 && !g.complete, `the dice pass to Player 3, who is still playing (active = ${g.active})`);
    const label = await p.locator('#active-player-label').textContent();
    T.ok(/Player 3/.test(label), `header names Player 3's turn ("${label.trim()}")`);
    T.ok(await roll([1,2,3,4]), 'Roll works for Player 3 (the round is not stuck)');
    g = await read();
    T.ok(g.active === 1, `after Player 3, the finished Player 1 is passed over and Player 2 rolls (active = ${g.active})`);
    await p.reload(); await go('cell-game');
    T.ok(await roll([1,2,3,4]), 'after a reload, the saved round still rolls');
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close && server.close(); T.done('t80-cell-cycle-skip-handoff');
})();
