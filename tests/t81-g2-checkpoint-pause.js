/* G2 checkpoint (review M1): a missing G2 material pauses the cell at the checkpoint to gather materials, as G1 does.
   Before the fix it restarted the cell at START with an empty scorecard. The DNA-damage chance card still restarts. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const full = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1},m:{attachments:0}});
const pl = (pos, score) => ({id:1,pos,score:score||full(),status:'playing',divisions:0,unchecked:0,restarts:0,bypassed:0,skipTurns:0,bonusRolls:0});
const saved = (round, player, deck) => ({v:1,trials:[],fields:{},game:{schema:2,mode:'solo',players:1,round,active:0,turns:0,complete:false,
  playersState:[player],chanceDeck:deck||[],logs:[],lastDice:[],lastRollSummary:'',roundResults:round===2?{1:{divisions:1,unchecked:0,restarts:0,bypassed:0,rolls:40}}:{},
  event:{title:'Ready',copy:'Test setup',icon:'',kicker:'Cell cycle'}}});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const go = async id => { await p.locator('.step-nav a[href="#'+id+'"]').click(); await p.waitForFunction(id => document.getElementById(id).classList.contains('is-current'), id); };
  const seed = async s => { await p.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s}); await p.reload(); await go('cell-game'); };
  const roll = async values => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).turns;
    await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout:5000}).catch(() => {});
    const ack = p.locator('#chance-reveal-ack'); if (await ack.isVisible()) await ack.click();
  };
  try {
    const score = full(); score.g2.organelles = 0;
    await seed(saved(1, pl(22, score)));
    await roll([1,2,4,4]);  // no organelle rolled on the way in
    let g = await read(), q = g.playersState[0];
    T.ok(q.pos === 23, `missing G2 organelle: the cell stays at the G2 checkpoint (pos ${q.pos})`);
    T.ok(q.restarts === 0 && q.score.g1.nutrients >= 3 && q.score.s.chromosomes === 4, 'the cell is not restarted; its scorecard is kept');
    T.ok(/pause|gather/i.test(g.event.title + g.event.copy) && !/starts again|fresh scorecard/i.test(g.event.copy), `event explains a pause ("${g.event.title}")`);
    T.ok(/G2 checkpoint pause/i.test(await p.locator('#turn-instruction').textContent()), 'turn instruction tells the player to gather at G2');
    await roll([1,2,4,4]);  // still no organelle: stays paused, no movement
    q = (await read()).playersState[0];
    T.ok(q.pos === 23 && q.score.g2.organelles === 0 && q.score.g2.nutrients >= 2, `a roll at the paused checkpoint gathers G2 materials without moving (pos ${q.pos}, nutrients ${q.score.g2.nutrients})`);
    await roll([3,1,2,4]);  // organelle arrives: passes the check
    g = await read(); q = g.playersState[0];
    T.ok(q.pos === 23 && q.score.g2.organelles === 1 && g.event.kicker === 'Checkpoint passed', `gathering the missing organelle passes the G2 checkpoint (${g.event.title})`);
    await roll([5,1,2,3]);
    T.ok((await read()).playersState[0].pos === 24, 'after passing, the next roll moves into M phase');
    // DNA-damage card keeps its full restart.
    const damaged = pl(25); damaged.score.m.attachments = 1;
    await seed(saved(2, damaged, [5]));
    await roll([5,1,2,4]);
    q = (await read()).playersState[0];
    T.ok(q.pos === 0 && q.restarts === 1, 'the DNA-damage chance card still restarts the cell');
    const rules = await p.locator('.game-rules').textContent();
    T.ok(/G2 material is missing, the cell stays paused/i.test(rules) && !/missing G2 material restarts/i.test(rules), 'rules text describes the G2 pause, not a restart');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-g2-checkpoint-pause');
})();
