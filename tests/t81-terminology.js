/* Terminology (review L7). Before the fix the dice key said "4 Chromosome" while the scorecard said "DNA copies" (four
   "copies" can read as copying DNA four times), the growth heading said "More cells" though the cell count is fixed,
   and the words proto-oncogene, oncogene and tumor suppressor never appeared. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  try {
    const score = {g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:2},g2:{nutrients:0,proteins:0,organelles:0},m:{attachments:0}};
    const game = {schema:2,mode:'solo',players:1,round:1,active:0,turns:0,complete:false,playersState:[{id:1,pos:12,score,status:'playing',divisions:0,unchecked:0,restarts:0,bypassed:0,skipTurns:0,bonusRolls:0}],
      chanceDeck:[],logs:[],lastDice:[],lastRollSummary:'',roundResults:{},event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}};
    await p.evaluate(({key,game}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game})), {key:KEY,game});
    await p.reload();
    const key = (await p.locator('.dice-key').textContent()).replace(/\s+/g,' ');
    const card = (await p.locator('#checkpoint-requirements').textContent()).replace(/\s+/g,' ');
    T.ok(/4 Chromosome copied/.test(key), `dice key: "4 Chromosome copied" (${key})`);
    T.ok(/Chromosomes copied/.test(card) && !/DNA copies/.test(card), `G2 checkpoint card uses the same term (${card})`);
    const page = await p.evaluate(() => document.body.innerText);
    T.ok(!/DNA cop(y|ies) in S|\b4 DNA copies/.test(page), 'no "DNA copies" counts remain in the game text');
    const heading = await p.locator('#growth-model h2').textContent();
    T.ok(!/More cells/.test(heading) && /renewal/i.test(heading), `growth heading avoids "More cells" ("${heading}")`);
    const changes = await p.evaluate(() => window.GrowthCellTypes.changes);
    T.ok(/proto-oncogene/.test(changes[0]) && /oncogene/.test(changes[0].replace('proto-oncogene','')), `growth-signal change is labelled proto-oncogene -> oncogene ("${changes[0]}")`);
    T.ok(/tumor-suppressor/.test(changes[1]) && /p53/.test(changes[1]), `checkpoint-brake change is labelled a tumor-suppressor change ("${changes[1]}")`);
    const vocab = await p.locator('#background details.disclose').textContent();
    T.ok(/Proto-oncogene/.test(vocab) && /Oncogene/.test(vocab) && /Tumor-suppressor gene/.test(vocab), 'vocabulary help defines proto-oncogene, oncogene and tumor-suppressor gene');
    T.ok(/proto-oncogene/.test(await p.locator('.model-assumptions').textContent()), 'model assumptions name the gene types');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-terminology');
})();
