/* Game side panel: checkpoint requirement cards must not clip their label, count or meter (they used to be pill-shaped
   ovals), and the scorecard's player token and status must sit inside the panel, at common desktop sizes. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const states = {
  'division complete': { pos:30, status:'finished', divisions:1, score:{g1:{nutrients:1,proteins:4,organelles:4},s:{chromosomes:0},g2:{nutrients:0,proteins:0,organelles:0},m:{attachments:0}} },
  'G1 checkpoint (3 cards)': { pos:7, status:'playing', divisions:0, score:{g1:{nutrients:1,proteins:2,organelles:3},s:{chromosomes:0},g2:{nutrients:0,proteins:0,organelles:0},m:{attachments:0}} },
};
(async () => {
  const b = await T.launch(), server = await T.serve();
  for (const [w, h] of [[1920, 1000], [1366, 768], [1100, 700]]) for (const [name, st] of Object.entries(states)) {
    const ctx = await T.ctxFor(b, {width:w, height:h, reduced:true});
    const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'cell-game', server.url);
    const pl = Object.assign({id:1,unchecked:0,restarts:0,bypassed:0,skipTurns:0,bonusRolls:0}, st);
    const game = {schema:2,mode:'solo',players:1,round:1,active:0,turns:5,complete:st.status==='finished',playersState:[pl],chanceDeck:[11],logs:[],lastDice:[1,2,3,4],lastRollSummary:'',roundResults:{},event:{title:'Test',copy:'x',icon:'',kicker:'Cell cycle'}};
    await p.evaluate(({k,g}) => localStorage.setItem(k, JSON.stringify({v:1,trials:[],fields:{},game:g})), {k:KEY,g:game});
    await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const bad = [];
      for (const c of document.querySelectorAll('#checkpoint-requirements .requirement')) {
        const cr = c.getBoundingClientRect(), rad = parseFloat(getComputedStyle(c).borderTopLeftRadius) || 0;
        if (rad > Math.min(cr.width, cr.height) / 2 - 2) bad.push(`card corner radius ${rad}px on a ${Math.round(cr.width)}×${Math.round(cr.height)} card`);
        for (const k of c.children) { const kr = k.getBoundingClientRect(); if (kr.left < cr.left - 1 || kr.right > cr.right + 1 || kr.top < cr.top - 1 || kr.bottom > cr.bottom + 1) bad.push(`"${k.textContent.trim()}" sticks out of its card`); }
      }
      const panel = document.querySelector('.game-play-grid'), pr = panel.getBoundingClientRect();
      for (const el of document.querySelectorAll('.score-player .cell-token, .score-player small')) { const er = el.getBoundingClientRect();
        if (er.left < pr.left + 4 || er.right > pr.left + panel.clientWidth - 2) bad.push(`"${el.textContent.trim()}" touches the panel edge`); }
      return { n: document.querySelectorAll('#checkpoint-requirements .requirement').length, bad };
    });
    T.ok(r.bad.length === 0, `${w}×${h} ${name}: ${r.n} requirement card(s) and the scorecard fit (${r.bad.join('; ') || 'nothing clipped'})`);
    await ctx.close();
  }
  await b.close(); server.close(); T.done('t84-game-hud-fit');
})();
