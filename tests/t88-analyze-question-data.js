/* Analyze: each question shows the recorded data it asks about, beside the question, and the section is split into
   four shorter parts whose bottom "Next" brings the new part into view. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const tr = (age, size, tissue, d, c) => ({age, size, tissue, divisions:d, opportunities:d, modelVersion:2, cancerCount:c});
const sc = {g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}};
const pl = id => ({id,pos:3,score:sc,status:'playing',turnsUsed:10,blue:1,red:2,destroyed:1,sentBack:1,skipped:2,skipTurns:0,bonusRolls:0,lastChip:null});
(async () => {
  const b = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(b, {width:1366, height:768, reduced:true});
  const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'analyze', server.url);
  await p.locator('.step-nav a[href="#analyze"]').click(); await p.waitForTimeout(400);
  const box = id => p.evaluate(id => { const e = document.getElementById('qe-' + id); return e ? e.innerText.replace(/\s+/g, ' ') : ''; }, id);
  T.ok(/Run three trials|Collect two sets/.test(await box('analysis-design')), 'with no data, the box says what to collect');
  const trials = [tr(50,'average','colon',540,0), tr(50,'average','colon',532,1), tr(50,'average','colon',551,0), tr(50,'average','skin',160,0), tr(50,'average','skin',158,0), tr(50,'average','skin',171,0)];
  await p.evaluate(({k, s}) => localStorage.setItem(k, JSON.stringify(s)), {k:KEY, s:{v:1,trials,fields:{},game:{schema:3,mode:'group',players:2,round:2,active:0,turns:20,complete:false,playersState:[pl(1),pl(2)],chanceDeck:[7],logs:[],lastDice:[],lastRollSummary:'',roundResults:{1:{blue:3,red:0,destroyed:2,sentBack:4,skipped:0,turns:150,players:2}},chanceNotice:null,event:{title:'Ready',copy:'x',icon:'',kicker:'Cell cycle'}}}});
  await p.reload(); await p.locator('.step-nav a[href="#analyze"]').click(); await p.waitForTimeout(500);
  T.ok(/Set 1: age 50/.test(await box('analysis-design')) && /Changed: cell type/.test(await box('analysis-design')), 'Q1 shows the two compared sets and what changed');
  T.ok(/540, 532, 551/.test(await box('analysis-variation')) && /541\.0/.test(await box('analysis-variation')), 'Q2 shows one set\'s three trial counts and mean');
  T.ok(/Colon lining: Set 1 mean 541\.0/.test(await box('analysis-celltypes')) && /Skin: Set 2 mean 163\.0/.test(await box('analysis-celltypes')), 'Q3 shows each cell type\'s mean');
  T.ok(/differ only in age/.test(await box('explanation')) && /differ only in body size/.test(await box('explanation-size')), 'Q4a and Q4b say what to collect when no age or size pattern exists yet');
  T.ok(/0, 1, 0/.test(await box('analysis-cancer')), 'Q5 shows cancer-state counts');
  T.ok(/Round 1: 3 blue and 0 red/.test(await box('analysis-checkpoints')) && /Round 2 \(in progress\): 2 blue and 4 red/.test(await box('analysis-checkpoints')), 'Q6 shows both game rounds\' tallies');
  T.ok(/Round 1/.test(await box('model-revision')) && /Set 2/.test(await box('model-prediction')), 'Q7 and Q8 summarize the evidence');
  const placed = await p.evaluate(() => ['analysis-design','analysis-celltypes','analysis-checkpoints','model-prediction'].every(id => { const e = document.getElementById('qe-' + id); return e && e.nextElementSibling && e.nextElementSibling.id === id; }));
  T.ok(placed, 'each data box sits directly above its answer box');
  await p.locator('#analysis-next').click(); await p.locator('#analysis-next').click(); await p.locator('#analysis-next').click();
  T.ok(/Part 4 of 4/.test(await p.locator('#analysis-page-status').textContent()), 'the section has four parts');
  await p.locator('#analysis-prev').click(); await p.locator('#analysis-prev').click(); await p.locator('#analysis-prev').click();
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.locator('#analysis-next-bottom').click(); await p.waitForTimeout(500);
  const top = await p.evaluate(() => document.getElementById('analysis-page-status').getBoundingClientRect().top);
  T.ok(top >= 0 && top < 200, `bottom Next brings the next part's start into view (y=${Math.round(top)})`);
  T.ok(await p.evaluate(() => !document.querySelector('.comparison-selectors').offsetParent), 'the comparison tools appear only on Part 1');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join('; '));
  await b.close(); server.close(); T.done('t88-analyze-question-data');
})();
