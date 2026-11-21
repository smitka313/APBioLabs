/* The Cell Cycle & Cancer game must be playable on a phone without "Enlarge model": below 900 px the canvas is redrawn as a tall
   portrait composition shown at about 1 canvas px = 1 CSS px. At 390 and 360 px wide (and 844x390 landscape, 768x1024):
   no sideways scrolling, every drawn text is >= 11 CSS px on screen, tap targets are >= 24 px, the Roll button and a checkpoint
   card are reachable, and the red-chip finish shows the CHANGED tag and a red changed chromosome. Desktop keeps the wide board. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = (g1, s, g2) => ({ g1: { nutrients: g1, proteins: g1, organelles: g1 }, s: { chromosomes: s }, g2: { nutrients: g2, proteins: g2, organelles: g2 } });
const pl = (id, pos, score, x) => Object.assign({ id, pos, score, status: 'playing', turnsUsed: 3, blue: 0, red: 0, destroyed: 0, sentBack: 0, skipped: 0, skipTurns: 0, bonusRolls: 0, lastChip: null }, x || {});
const saved = (round, players, dice) => ({ v: 1, trials: [], fields: {}, lastSection: 'cell-game', game: { schema: 3, mode: 'solo', players: players.length, round, active: 0, turns: 5, complete: false, playersState: players,
  chanceDeck: [1, 2, 3, 4, 5], logs: [], lastDice: dice || [], lastRollSummary: '', roundResults: round === 2 ? { 1: { blue: 1, red: 0, destroyed: 0, sentBack: 0, skipped: 0, turns: 75, players: 1 } } : {}, chanceNotice: null, checkpointNotice: null,
  event: { title: 'Ready', copy: 'Test', icon: '', kicker: 'Cell cycle' } } });
const STATES = {
  'start of Round 1': saved(1, [pl(1, 0, sc(0, 0, 0)), pl(2, 0, sc(0, 0, 0))]),
  'mid Round 2 with a chance square': saved(2, [pl(1, 11, sc(3, 2, 0), { blue: 1 }), pl(2, 9, sc(2, 1, 0), { red: 1 }), pl(3, 26, sc(3, 4, 1)), pl(4, 2, sc(1, 0, 0))], [2, 4, 1, 3]),
  'red-chip finish': saved(2, [pl(1, 31, sc(3, 4, 1), { red: 1, lastChip: 'red' })], [1, 2, 3, 4]),
};
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [w, h, dark] of [[390, 844, true], [390, 844, false], [360, 740, false], [360, 740, true], [844, 390, true], [768, 1024, false]]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, dark, reduced: true, touch: true, mobile: w < 500 });
      const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'cell-game', server.url);
      for (const [name, s] of Object.entries(STATES)) {
        const tag = `${w}x${h}${dark ? ' dark' : ''}, ${name}: `;
        await p.evaluate(({ key, s }) => localStorage.setItem(key, JSON.stringify(s)), { key: KEY, s });
        await p.reload(); await p.waitForTimeout(500);
        await p.locator('#cell-board').scrollIntoViewIfNeeded(); await p.waitForTimeout(250);
        const m = await p.evaluate(() => {
          const c = document.getElementById('cycle-scene'), r = c.getBoundingClientRect(), st = window.CellCycleScene.state(), roll = document.getElementById('roll-dice').getBoundingClientRect(), ex = document.getElementById('enlarge-scene').getBoundingClientRect();
          return { st, cssW: r.width, cssH: r.height, bufW: c.width, bufH: c.height, dpr: window.devicePixelRatio, overflow: document.documentElement.scrollWidth - window.innerWidth,
            rollH: roll.height, rollW: roll.width, rollRight: roll.right, rollLeft: roll.left, exH: ex.height, exW: ex.width, label: c.getAttribute('aria-label'), desc: document.getElementById('scene-description').textContent, role: c.getAttribute('role') };
        });
        T.ok(m.st.layout === 'portrait' && m.st.logicalWidth === 360, tag + 'phone layout is the portrait composition');
        T.ok(m.overflow <= 0, tag + `no sideways scrolling (${m.overflow})`);
        const effective = m.st.minFont * m.cssW / m.st.logicalWidth;
        T.ok(effective >= 11, tag + `smallest drawn text is ${effective.toFixed(1)} CSS px (>= 11)`);
        T.ok(m.bufW >= Math.round(m.cssW) && Math.abs(m.bufH / m.bufW - 612 / 360) < .01, tag + `canvas buffer scaled for the screen (${m.bufW}x${m.bufH} for ${Math.round(m.cssW)}x${Math.round(m.cssH)} CSS px)`);
        T.ok(m.rollH >= 24 && m.rollW >= 24 && m.exH >= 24 && m.exW >= 24, tag + `tap targets: Roll ${Math.round(m.rollW)}x${Math.round(m.rollH)}, Enlarge ${Math.round(m.exW)}x${Math.round(m.exH)} (>= 24)`);
        T.ok(m.rollLeft >= 0 && m.rollRight <= w + .5, tag + 'the Roll button is inside the window width');
        T.ok(m.role === 'img' && /rounded track/.test(m.label) && m.desc.length > 20, tag + 'canvas keeps its role, a portrait aria-label and the text description');
        if (name === 'red-chip finish') {
          T.ok(m.st.view === 'daughters' && m.st.changedAt && /CHANGED/.test(m.desc) && /Magnified view now: Daughter cells · one carries changed DNA/.test(m.label), tag + 'red chip: daughters shown, changed chromosome marked, label and description say so');
          const px = await p.evaluate(at => {
            const c = document.getElementById('cycle-scene'), g = c.getContext('2d'), sx = c.width / 360, sy = c.height / 612;
            const d = g.getImageData(Math.round(at.x * sx - 5 * sx), Math.round(at.y * sy - 5 * sx), Math.round(10 * sx), Math.round(10 * sx)).data; let best = [0, 0, 0, -999];
            for (let i = 0; i < d.length; i += 4) { const score = d[i] - Math.max(d[i + 1], d[i + 2]); if (score > best[3]) best[3] = score, best = [d[i], d[i + 1], d[i + 2], score]; }
            return best;
          }, m.st.changedAt);
          T.ok(px[0] > 200 && px[1] < 120 && px[2] < 120, tag + 'canvas pixel at the changed section is red ' + JSON.stringify(px.slice(0, 3)));
          // The CHANGED tag is drawn above the left daughter, inside the canvas, at >= 11 CSS px.
          T.ok(m.st.minFont * m.cssW / 360 >= 11 && m.st.changedAt.x > 0 && m.st.changedAt.y > 150 && m.st.changedAt.y < 330, tag + 'the changed chromosome is inside the left daughter cell and the tag text is readable');
        } else T.ok(m.st.view === 'cell' && /rounded track/.test(m.label), tag + 'one magnified cell is drawn');
      }
      // A checkpoint card opens and its button is reachable without sideways scrolling.
      await p.evaluate(({ key, s }) => localStorage.setItem(key, JSON.stringify(s)), { key: KEY, s: saved(1, [pl(1, 6, sc(1, 0, 0))]) });
      await p.reload(); await p.waitForTimeout(500);
      await p.evaluate(() => { Math.random = () => .4; });
      await p.locator('#roll-dice').scrollIntoViewIfNeeded(); await p.locator('#roll-dice').click(); await p.waitForTimeout(900);
      const ack = p.locator('#checkpoint-reveal-ack');
      T.ok(await ack.isVisible(), `${w}x${h}: the checkpoint card opens`);
      await ack.scrollIntoViewIfNeeded();
      const box = await ack.boundingBox(), over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      T.ok(box && box.x >= 0 && box.x + box.width <= w + .5 && box.height >= 24 && over <= 0, `${w}x${h}: card button inside the window (${Math.round(box.width)}x${Math.round(box.height)}), no sideways scrolling`);
      await ack.click(); await p.waitForTimeout(300);
      T.ok(p.errors.length === 0, `${w}x${h}: no page errors ${p.errors.join('; ')}`);
      await ctx.close();
    }
    // Desktop keeps the wide board.
    const ctx = await T.ctxFor(browser, { width: 1366, height: 768, reduced: true });
    const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'cell-game', server.url);
    await p.evaluate(({ key, s }) => localStorage.setItem(key, JSON.stringify(s)), { key: KEY, s: STATES['start of Round 1'] });
    await p.reload(); await p.waitForTimeout(500);
    const st = await p.evaluate(() => window.CellCycleScene.state());
    T.ok(st.layout === 'wide' && st.logicalWidth === 1160, '1366 wide: desktop keeps the wide board');
    await ctx.close();
  } finally { await browser.close(); server.close(); }
  T.done('t91-phone-game');
})();
