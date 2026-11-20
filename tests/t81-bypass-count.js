/* Skipped-checkpoint counting for the Round 2 "p53 is not working!" cards. A checkpoint the cell jumps over counts as
   skipped; one it lands on is checked and does not count. "Skip ahead two checkpoints" counts the one it jumps, not the
   one it checks, and with only the M Checkpoint left counts none. Board: G1 Checkpoint 7, G2 Checkpoint 24, M 25-29,
   M Checkpoint 30, FINISH 31. Cards: 9 move ahead 3, 10 skip the next checkpoint, 11 skip two checkpoints. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const full = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}});
const pl = (pos, score) => ({id:1,pos,score:score||full(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null});
const saved = (player, deck) => ({v:1,trials:[],fields:{},game:{schema:3,mode:'solo',players:1,round:2,active:0,turns:0,complete:false,
  playersState:[player],chanceDeck:deck||[],logs:[],lastDice:[],lastRollSummary:'',roundResults:{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}},chanceNotice:null,
  event:{title:'Ready',copy:'Test setup',icon:'',kicker:'Cell cycle'}}});
const AHEAD3 = 9, SKIP_NEXT = 10, SKIP_TWO = 11;
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
    return (await read()).playersState[0];
  };
  try {
    // From G2 space 4 (19) onto light-blue G2 space 5 (20); +3 = G2 space 8 (23): nothing skipped.
    let q = await (seed(saved(pl(19), [AHEAD3])).then(() => roll([1,2,3,4])));
    T.ok(q.pos === 23 && q.skipped === 0, `move ahead 3 that stops short of the G2 Checkpoint skips nothing (pos ${q.pos}, skipped ${q.skipped})`);
    // From G2 space 6 (21) onto G2 space 7 (22); +3 = 25 jumps the G2 Checkpoint (and its "must roll a 1").
    q = await (seed(saved(pl(21), [AHEAD3])).then(() => roll([1,2,3,4])));
    T.ok(q.pos === 25 && q.skipped === 1, `move ahead 3 past the G2 Checkpoint counts one skipped checkpoint (pos ${q.pos}, skipped ${q.skipped})`);
    // From G1 space 3 onto G1 space 4 (4); +3 = G1 Checkpoint (7): landed on, so checked and not counted.
    q = await (seed(saved(pl(3), [AHEAD3])).then(() => roll([1,2,3,4])));
    T.ok(q.pos === 7 && q.skipped === 0, `move ahead 3 onto the G1 Checkpoint is checked and passes; nothing skipped (pos ${q.pos}, skipped ${q.skipped})`);
    // From M space 3 onto M space 4 (28); +3 passes the M Checkpoint to FINISH: one skipped.
    q = await (seed(saved(pl(27), [AHEAD3])).then(() => roll([4,6,6,6])));
    T.ok(q.pos === 31 && q.skipped === 1 && q.blue === 1, `move ahead 3 past the M Checkpoint reaches FINISH with one skipped checkpoint (skipped ${q.skipped})`);
    q = await (seed(saved(pl(1), [SKIP_NEXT])).then(() => roll([1,2,3,4])));
    T.ok(q.pos === 8 && q.skipped === 1, `skip the next checkpoint counts one (pos ${q.pos}, skipped ${q.skipped})`);
    q = await (seed(saved(pl(1), [SKIP_TWO])).then(() => roll([1,2,3,4])));
    T.ok(q.pos === 24 && q.skipped === 1, `skip two checkpoints from G1 counts the G1 Checkpoint only; the G2 Checkpoint is checked (skipped ${q.skipped})`);
    q = await (seed(saved(pl(25), [SKIP_TWO])).then(() => roll([2,6,6,6])));
    T.ok(q.skipped === 0 && q.blue === 1, `in M phase only the M Checkpoint is left: it is checked, nothing counted as skipped (skipped ${q.skipped})`);
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-bypass-count');
})();
