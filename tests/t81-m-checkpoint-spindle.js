/* M (spindle) checkpoint (review M2): it checks only chromosome attachment to the spindle and never sends an M-phase
   cell back to G1 or S. Before the fix a cell with unmet earlier requirements (left by a bypassed checkpoint) was sent
   back to G1 space 1 or the first S space. Now it divides, and the division is recorded as unchecked. */
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
    for (const [what, edit, label] of [
      ['G1 materials', s => { s.g1.proteins = 0; }, 'G1'],
      ['DNA copies', s => { s.s.chromosomes = 2; }, 'S'],
      ['G2 materials', s => { s.g2.organelles = 0; }, 'G2']]) {
      const score = full(); score.m.attachments = 4; edit(score);
      await seed(saved(2, pl(28, score)));
      await roll([1,2,3,4]);
      const q = (await read()).playersState[0];
      T.ok(q.pos === 30 && q.status === 'finished', `${what} missing at the M checkpoint: the cell is not sent back to ${label} (pos ${q.pos}, ${q.status})`);
      T.ok(q.unchecked === 1, `${what}: the division is recorded as an unchecked division (unchecked ${q.unchecked})`);
    }
    // A fully checked cell still divides as a regulated division.
    const okScore = full(); okScore.m.attachments = 4;
    await seed(saved(1, pl(28, okScore)));
    await roll([1,2,3,4]);
    let q = (await read()).playersState[0];
    T.ok(q.status === 'finished' && q.unchecked === 0, 'a cell that met every requirement completes a regulated division');
    // Missing attachments still hold the cell at the checkpoint.
    await seed(saved(1, pl(28, full())));
    await roll([1,2,3,4]);
    q = (await read()).playersState[0];
    T.ok(q.pos === 29 && q.status === 'playing', 'without four attachments the cell waits at the M checkpoint');
    const card = await p.locator('#checkpoint-requirements').textContent();
    T.ok(/Spindle attachments/.test(card) && !/G1 materials|DNA copies|G2 materials/.test(card), `the M checkpoint card lists only spindle attachments ("${card.replace(/\s+/g,' ').trim()}")`);
    const rules = await p.locator('.game-rules').textContent();
    const mRule = rules.split('M checkpoint:')[1].split('Round 2:')[0];
    T.ok(!/along with the G1, S, and G2 requirements/.test(mRule) && /only/i.test(mRule) && /never/i.test(mRule), 'rules text says the M checkpoint checks only spindle attachment and never sends a cell back');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-m-checkpoint-spindle');
})();
