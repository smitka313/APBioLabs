/* Play-test Nov 20, item 10: card dialogs sometimes showed the board before the card's effect and sometimes after.
   Now always: while the Cellular Chance dialog is open, the board, scorecard and turn counter show the cell as it was
   when the card was drawn; "Follow the card & continue" applies the effect and finishes the turn. A pending card
   survives a reload. Card indices: 5 destroy, 7 DNA, 9 move ahead 3, 11 skip two checkpoints, 12 move to Finish. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = (g1 = [3,3,3], s = 4, g2 = [1,1,1]) => ({g1:{nutrients:g1[0],proteins:g1[1],organelles:g1[2]},s:{chromosomes:s},g2:{nutrients:g2[0],proteins:g2[1],organelles:g2[2]}});
const pl = (pos, score) => ({id:1,pos,score:score||sc(),status:'playing',turnsUsed:3,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null});
const saved = (player, deck) => ({v:1,trials:[],fields:{},game:{schema:3,mode:'solo',players:1,round:2,active:0,turns:3,complete:false,playersState:[player],chanceDeck:deck,logs:[],lastDice:[],lastRollSummary:'',
  roundResults:{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}}});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const seed = async s => { await p.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s}); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(150); };
  const roll = async values => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).turns;
    await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout:5000});
  };
  const shown = async () => ({pos: await p.locator('#position-label').textContent(), card: await p.locator('.player-score').first().textContent(), turn: await p.locator('#turn-count').textContent()});
  try {
    const cases = [
      [5, pl(1), [1,2,3,4], q => q.pos === 0 && q.destroyed === 1, 'destroy'],
      [7, pl(1, sc([0,0,0],0,[0,0,0])), [6,6,6,6], q => q.score.s.chromosomes === 4, 'DNA filled'],
      [9, pl(5, sc([0,0,0],0,[0,0,0])), [6,6,6,6], q => q.pos === 9 && q.skipped === 1, 'move ahead 3'],
      [11, pl(1), [1,2,3,4], q => q.pos === 24 && q.skipped === 1, 'skip two checkpoints'],
      [12, pl(1), [1,2,3,4], q => q.pos === 31 && q.red === 1, 'move to FINISH (red chip)'],
    ];
    for (const [idx, player, dice, applied, name] of cases) {
      await seed(saved(player, [idx])); await roll(dice);
      const g = await read(), q = g.playersState[0];
      T.ok(await p.locator('#chance-reveal').isVisible() && g.chanceNotice && g.chanceNotice.pending, name + ': the card dialog is open');
      T.ok(q.pos === player.pos + 1 && !applied(q), name + ': while it is open, the saved cell is where it landed, before the effect (pos ' + q.pos + ')');
      const before = await shown();
      T.ok(new RegExp('space ' + (player.pos === 5 ? 6 : 2)).test(before.pos) || /G1 space/.test(before.pos), name + ': the board shows the landing square (' + before.pos + ')');
      await p.locator('#chance-reveal-ack').click(); await p.waitForTimeout(100);
      const after = (await read()).playersState[0];
      T.ok(applied(after) && !(await read()).chanceNotice, name + ': "Follow the card & continue" applies the effect');
    }
    // A pending card survives a reload and is applied once.
    await seed(saved(pl(1), [5])); await roll([1,2,3,4]);
    await p.reload(); await p.waitForTimeout(300);   // the page opens at #cell-game with the card dialog over it
    T.ok(await p.locator('#chance-reveal').isVisible() && (await read()).playersState[0].pos === 2, 'after a reload the card is still waiting, effect not yet applied');
    await p.locator('#chance-reveal-ack').click(); await p.waitForTimeout(100);
    const q = (await read()).playersState[0];
    T.ok(q.pos === 0 && q.destroyed === 1, 'following it after the reload applies the effect exactly once');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-card-effect-order');
})();
