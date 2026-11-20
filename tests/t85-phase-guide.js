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
  T.ok(/3 nutrients, 3 proteins and 3 organelles/.test(c[0].text) && /all 4 chromosomes copied/.test(c[1].text) && /1 nutrient, 1 protein and 1 organelle/.test(c[2].text) && /all 4 chromosomes attached/.test(c[3].text), 'each card states its checkpoint requirement');
  T.ok(c.every(x => /Why:/.test(x.text)), 'each card explains why the requirement matters');
  const sc = {g1:{nutrients:3,proteins:4,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:0,organelles:2},m:{attachments:0}};
  const game = {schema:2,mode:'solo',players:1,round:1,active:0,turns:9,complete:false,playersState:[{id:1,pos:20,score:sc,status:'playing',divisions:0,unchecked:0,restarts:0,bypassed:0,skipTurns:0,bonusRolls:0}],chanceDeck:[11],logs:[],lastDice:[1,2,3,4],lastRollSummary:'',roundResults:{},event:{title:'G2',copy:'x',icon:'',kicker:'Cell cycle'}};
  await p.evaluate(({k,g}) => localStorage.setItem(k, JSON.stringify({v:1,trials:[],fields:{},game:g})), {k:KEY,g:game});
  await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(500);
  c = await cards();
  T.ok(c.filter(x => x.cur).map(x => x.ph).join() === 'g2', `in G2 only the G2 card is highlighted (${c.filter(x => x.cur).map(x => x.ph)})`);
  T.ok(c[0].met && c[1].met && !c[2].met && !c[3].met, 'G1 and S are marked met; G2 (protein missing) and M are not');
  T.ok(/Now/.test(c[2].status) && /0\/4 attached/.test(c[3].status), `status text: G2 "${c[2].status}", M "${c[3].status}"`);
  T.ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'no horizontal overflow');
  await b.close(); server.close(); T.done('t85-phase-guide');
})();
