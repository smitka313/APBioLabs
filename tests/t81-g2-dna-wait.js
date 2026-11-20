/* G2 checkpoint with unfinished DNA copying: the cell waits at the checkpoint (position 23) instead of going back
   to S phase. Each 4 rolled there copies one more chromosome; once copying and G2 materials are complete it passes. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:2},g2:{nutrients:1,proteins:1,organelles:1},m:{attachments:0}});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const go = async id => { await p.locator('.step-nav a[href="#'+id+'"]').click(); await p.waitForFunction(id => document.getElementById(id).classList.contains('is-current'), id); };
  const roll = async values => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).turns; await p.locator('#roll-dice').click({timeout: 5000});
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout: 8000});
    if (await p.locator('#chance-reveal-ack').isVisible().catch(() => false)) await p.locator('#chance-reveal-ack').click();
  };
  try {
    const player = {id:1,pos:23,score:sc(),status:'playing',divisions:0,unchecked:0,restarts:0,bypassed:0,skipTurns:0,bonusRolls:0};
    const game = {schema:2,mode:'solo',players:1,round:1,active:0,turns:0,complete:false,playersState:[player],chanceDeck:[11],logs:[],lastDice:[],lastRollSummary:'',roundResults:{},event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}};
    await p.evaluate(({key,game}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game})), {key:KEY,game});
    await p.reload(); await go('cell-game');
    await roll([1,2,3,5]); let g = await read();
    T.ok(g.playersState[0].pos === 23, `no 4 rolled: the cell stays at the G2 checkpoint (pos ${g.playersState[0].pos}, not sent back to S)`);
    T.ok(g.playersState[0].restarts === 0, 'it is not restarted');
    T.ok(/DNA copying|copying is not finished|wait/i.test(await p.locator('body').innerText()), 'the page explains the cell is waiting for DNA copying');
    await roll([4,1,2,3]); g = await read();
    T.ok(g.playersState[0].score.s.chromosomes === 3 && g.playersState[0].pos === 23, `one 4 copies one more chromosome (now ${g.playersState[0].score.s.chromosomes}) and the cell still waits`);
    await roll([4,4,1,2]); g = await read();
    T.ok(g.playersState[0].score.s.chromosomes === 4, `copying finishes at 4 chromosomes (${g.playersState[0].score.s.chromosomes}, never more)`);
    for (let i = 0; i < 4 && g.playersState[0].pos === 23; i++) { await roll([1,2,3,5]); g = await read(); }
    T.ok(g.playersState[0].pos > 23, `with copying done and G2 materials present, the cell moves on (pos ${g.playersState[0].pos})`);
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close && server.close(); T.done('t81-g2-dna-wait');
})();
