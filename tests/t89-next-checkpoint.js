/* Play-test Nov 20, item 3: the "Next checkpoint" panel kept naming the checkpoint the cell had just passed (the
   piece stands on the checkpoint until its next turn), so it lagged a turn behind going into S and into M. It now
   always names the upcoming checkpoint and shows that checkpoint's requirements.
   Board: G1 1-6, G1 Checkpoint 7, S 8-15, G2 16-23, G2 Checkpoint 24, M 25-29, M Checkpoint 30, FINISH 31. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const full = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}});
const pl = (pos, extra) => Object.assign({id:1,pos,score:full(),status:'playing',turnsUsed:5,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}, extra||{});
const game = players => ({schema:3,mode:'solo',players:1,round:1,active:0,turns:5,complete:false,playersState:players,chanceDeck:[],logs:[],lastDice:[],lastRollSummary:'',roundResults:{},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const seed = async g => { await p.evaluate(({key,g}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game:g})), {key:KEY,g}); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(150); };
  const panel = async () => ({title: await p.locator('#checkpoint-title').textContent(), reqs: await p.locator('#checkpoint-requirements').textContent(), pill: await p.locator('#checkpoint-status').textContent()});
  try {
    const want = {0:'G1',3:'G1',6:'G1',7:'G2',8:'G2',15:'G2',20:'G2',23:'G2',24:'M',25:'M',29:'M'};
    const wrong = [];
    for (const [pos, cp] of Object.entries(want)) {
      await seed(game([pl(Number(pos))]));
      const s = await panel();
      const reqOk = cp === 'G1' ? /Nutrients.*Proteins.*Organelles/.test(s.reqs) && !/DNA/.test(s.reqs) : cp === 'G2' ? /DNA/.test(s.reqs) : /G1 · 3 of each/.test(s.reqs);
      if (s.title !== 'Next checkpoint · ' + cp + ' Checkpoint' || s.pill !== cp + ' Checkpoint ahead' || !reqOk) wrong.push(pos + ': ' + s.title + ' / ' + s.pill);
    }
    T.ok(!wrong.length, 'every position names the upcoming checkpoint with its requirements' + (wrong.length ? ' (wrong at ' + wrong.join('; ') + ')' : ''));
    // In play: passing the G1 Checkpoint moves the panel straight on to the G2 Checkpoint, and passing G2 on to M.
    await seed(game([pl(6)]));
    await p.locator('#roll-dice').click(); await p.waitForFunction(key => JSON.parse(localStorage.getItem(key)).game.turns > 5, KEY);
    T.ok((await read()).playersState[0].pos === 7 && (await panel()).title === 'Next checkpoint · G2 Checkpoint', 'after passing the G1 Checkpoint the panel shows the G2 Checkpoint');
    await seed(game([pl(23)]));
    await p.locator('#roll-dice').click(); await p.waitForFunction(key => JSON.parse(localStorage.getItem(key)).game.turns > 5, KEY);
    T.ok((await read()).playersState[0].pos === 24 && (await panel()).title === 'Next checkpoint · M Checkpoint', 'after passing the G2 Checkpoint the panel shows the M Checkpoint');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-next-checkpoint');
})();
