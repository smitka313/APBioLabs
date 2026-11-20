/* Play-test Nov 20, item 8: at FINISH the panel said "The cell divided" even for a red chip. A red chip now reads
   "The cell divided anyway: cancer cell in this game model"; a blue chip still reads as a plain division. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}});
const pl = chip => ({id:1,pos:31,score:sc(),status:'playing',turnsUsed:20,blue:chip==='blue'?1:0,red:chip==='red'?1:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:chip});
const saved = chip => ({v:1,trials:[],fields:{},game:{schema:3,mode:'solo',players:1,round:2,active:0,turns:20,complete:false,playersState:[pl(chip)],chanceDeck:[0],logs:[],lastDice:[],lastRollSummary:'',
  roundResults:{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}}});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const seed = async s => { await p.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s}); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(150); };
  try {
    await seed(saved('red'));
    const red = await p.locator('#checkpoint-subtitle').textContent(), redPill = await p.locator('#checkpoint-status').textContent(), redPhase = await p.locator('#phase-label').textContent();
    T.ok(/^The cell divided anyway: cancer cell in this game model/.test(red), `red chip: "${red}"`);
    T.ok(/anyway/.test(redPill) && /red/.test(redPill) && /anyway/.test(redPhase), `red chip: the status pill and phase label say "divided anyway" ("${redPill}", "${redPhase}")`);
    T.ok(/divided anyway/.test(await p.locator('#checkpoint-card').getAttribute('aria-label')), 'red chip: the panel\'s accessible name says it too');
    await seed(saved('blue'));
    const blue = await p.locator('#checkpoint-subtitle').textContent();
    T.ok(/^The cell divided: a non-cancer cell/.test(blue) && !/anyway/.test(blue) && !/anyway/.test(await p.locator('#checkpoint-status').textContent()), `blue chip: a plain division ("${blue}")`);
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-finish-red-wording');
})();
