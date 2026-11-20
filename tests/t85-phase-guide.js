/* The "What each phase needs" guide shows the G1, S, G2 and M requirements at all times, highlights the active
   player's phase, marks met requirements, and matches the numbers the checkpoints actually use. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const b = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(b, {width:1366, height:768, reduced:true});
  const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'cell-game', server.url);
  await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(400);
  const cards = () => p.evaluate(() => [...document.querySelectorAll('#phase-guide .phase-card')].map(c => ({ ph: c.dataset.phase, cur: c.classList.contains('is-current'), met: c.classList.contains('is-met'), status: c.querySelector('.phase-status').textContent, text: c.textContent, visible: c.getBoundingClientRect().height > 0 })));
  let c = await cards();
  T.ok(c.length === 4 && c.map(x => x.ph).join() === 'g1,s,g2,m' && c.every(x => x.visible), 'before the game starts, the guide shows G1, S, G2 and M');
  T.ok(/3 nutrients, 3 proteins and 3 organelles/.test(c[0].text) && /4 DNA/.test(c[1].text) && /4 DNA and at least 1 nutrient, 1 protein and 1 organelle/.test(c[2].text) && /double-check the whole scorecard/.test(c[3].text), 'each card states its checkpoint requirement, as on the checkpoint cards');
  T.ok(/go back 3 spaces/.test(c[0].text) && /go back 5 spaces/.test(c[0].text) && /destroyed by p53, back to the START/.test(c[0].text), 'G1 card gives the go-back-3, go-back-5 and destroyed-by-p53 outcomes');
  T.ok(/back to the first S space/.test(c[2].text) && /destroyed by p53/.test(c[2].text), 'G2 card gives the first-S-space and destroyed-by-p53 outcomes');
  T.ok(/Must roll 1 to 5/.test(c[3].text) && /must roll a 1/.test(c[3].text) && /blue cell chip/.test(c[3].text), 'M card gives the 1-5 sequence and the blue chip');
  T.ok(c.every(x => /Why:/.test(x.text)) && c.filter(x => /p53/.test(x.text)).length >= 3, 'each card explains why it matters, naming p53 at the checkpoints');
  const sc = {g1:{nutrients:3,proteins:4,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:0,organelles:2}};
  const game = {schema:3,mode:'solo',players:1,round:1,active:0,turns:9,complete:false,playersState:[{id:1,pos:20,score:sc,status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}],chanceDeck:[11],logs:[],lastDice:[1,2,3,4],lastRollSummary:'',roundResults:{},event:{title:'G2',copy:'x',icon:'',kicker:'Cell cycle'}};
  await p.evaluate(({k,g}) => localStorage.setItem(k, JSON.stringify({v:1,trials:[],fields:{},game:g})), {k:KEY,g:game});
  await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(500);
  c = await cards();
  T.ok(c.filter(x => x.cur).map(x => x.ph).join() === 'g2', `in G2 only the G2 card is highlighted (${c.filter(x => x.cur).map(x => x.ph)})`);
  T.ok(c[0].met && c[1].met && !c[2].met && !c[3].met, 'G1 and S are marked met; G2 (protein missing) and M are not');
  T.ok(/Now/.test(c[2].status) && /0\/1/.test(c[2].status) && /roll 1–5 in order/.test(c[3].status), `status text: G2 "${c[2].status}", M "${c[3].status}"`);
  T.ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'no horizontal overflow');
  await b.close(); server.close(); T.done('t85-phase-guide');
})();
