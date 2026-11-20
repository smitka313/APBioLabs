/* Play-test Nov 20, item 11: the growth inspector said "1 divisions". Counts now take the right singular or plural
   form in the inspector, the playback status and the game evidence lines ("1 blue chip", "1 new cell was"). */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const row = (year, cumulative, cells, cancer) => ({year, cumulative, cells, changes:Array(20).fill(0), cancerCells:cancer||[], newCancerCells:[], cancerCount:(cancer||[]).length});
// Unit 1 divides once (age 21); unit 2 divides twice (ages 21 and 22). Three identical trials make one set.
const trial = () => ({modelVersion:2, age:22, size:'small', tissue:'skin', divisions:3, opportunities:3, cancerCount:0, firstCancerAge:null,
  timeline:[row(20,0,[]), row(21,2,[0,1]), row(22,3,[1])]});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','overview',server.url);
  try {
    await p.evaluate(({key,t}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[t,t,t],fields:{},game:{schema:3,mode:'solo',players:1,round:0,active:0,turns:0,complete:false,playersState:[],chanceDeck:[],logs:[],lastDice:[],lastRollSummary:'',
      roundResults:{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1},2:{blue:0,red:1,destroyed:0,sentBack:0,skipped:1,turns:75,players:1}},chanceNotice:null,event:{title:'',copy:'',icon:'',kicker:''}}})), {key:KEY,t:trial()});
    await p.reload(); await p.locator('.step-nav a[href="#growth-model"]').click(); await p.waitForTimeout(150);
    await p.locator('#replay-growth').click(); await p.waitForTimeout(150);
    const canvas = p.locator('#growth-scene');
    await canvas.focus(); await p.keyboard.press('Home');
    const one = await p.locator('#growth-tip').textContent();
    T.ok(/unit 1 · 1 division by age 22\./.test(one) && !/1 divisions/.test(one), `inspector: "1 division" (got "${one.slice(0,60)}")`);
    await p.keyboard.press('ArrowRight');
    T.ok(/unit 2 · 2 divisions by age 22\./.test(await p.locator('#growth-tip').textContent()), 'inspector: "2 divisions" stays plural');
    await p.keyboard.press('ArrowRight');
    T.ok(/unit 3 · 0 divisions by age 22\./.test(await p.locator('#growth-tip').textContent()), 'inspector: "0 divisions" stays plural');
    // Playback status while scrubbing (age 21: 2 divisions, 0 cancer-state units).
    await p.locator('#growth-scrub').evaluate(el => { el.value = 21; el.dispatchEvent(new Event('input', {bubbles:true})); });
    const status = await p.locator('#growth-status').textContent();
    T.ok(/2 recorded divisions\. 0 cancer-state units/.test(status), `playback status keeps plurals ("${status}")`);
    // Game evidence lines.
    await p.locator('.step-nav a[href="#analyze"]').click(); await p.waitForTimeout(150);
    const ref = await p.locator('#analysis-reference-data').textContent();
    T.ok(/Round 1 \(complete\): 1 blue chip \(non-cancer cells\), 0 red chips/.test(ref), 'evidence: "1 blue chip", "0 red chips"');
    T.ok(/0% of the 1 new cell was a cancer cell/.test(ref) && /100% of the 1 new cell was a cancer cell/.test(ref), 'evidence: "of the 1 new cell was"');
    T.ok(!/\b1 (divisions|blue chips|red chips|new cells)\b/.test(ref + one), 'no "1 …s" left in these texts');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-plurals');
})();
