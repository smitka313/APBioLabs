/* Gene expression scene (openscied-b3-dna-p53.html): layout at 390, 768 and 1366 px, reduced motion, crisp canvas, targets,
   protein shape differs for strands A, B and C, dark mode.
   Run: NODE_PATH=$(npm root -g) node tests/t95-gene-expression-layout.js */
const T = require('./_h');
const PAGE = 'openscied-b3-dna-p53.html';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
(async () => {
  const browser = await T.launch(), server = await T.serve();
  async function open(o) {
    const ctx = await T.ctxFor(browser, o), p = await ctx.newPage(); p.problems = [];
    p.on('console', m => { if (m.type() === 'error') p.problems.push(m.text()); }); p.on('pageerror', e => p.problems.push(e.message));
    await stub(p); await p.goto(server.url + PAGE + '#expression'); await p.waitForSelector('#gene-expression-scene[data-ge-ready]');
    return { ctx, p };
  }
  const finish = async (p, k) => { await p.click('[data-strand=' + k + ']'); await p.click('#ge-copy-rest'); await p.click('#ge-cross-all'); await p.click('#ge-send'); await p.click('#ge-match-all'); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  try {
    // widths: nothing overflows sideways, the canvas fits its host, targets are big enough, in every stage
    for (const [w, h, dark] of [[390, 844, true], [768, 900, false], [1366, 900, false], [1920, 1080, false]]) {
      const { ctx, p } = await open({ width: w, height: h, dark, reduced: true });
      const tag = w + (dark ? ' dark' : '') + ': ';
      const check = async when => {
        const m = await p.evaluate(() => {
          const host = document.querySelector('#gene-expression-scene'), c = host.querySelector('canvas'), r = host.getBoundingClientRect(), cr = c.getBoundingClientRect();
          const small = Array.from(host.querySelectorAll('button')).filter(b => b.offsetParent && (b.getBoundingClientRect().width < 24 || b.getBoundingClientRect().height < 24)).length;
          const wide = Array.from(host.querySelectorAll('*')).filter(e => e.offsetParent && e.getBoundingClientRect().right > r.right + 1 && getComputedStyle(e).position !== 'absolute').length;
          return { sx: document.documentElement.scrollWidth - document.documentElement.clientWidth, cw: cr.width, hw: r.width, ch: cr.height, bw: c.width, dpr: devicePixelRatio, small, wide };
        });
        T.ok(m.sx <= 0, tag + when + ': no sideways page scroll (' + m.sx + ')');
        T.ok(Math.abs(m.cw - m.hw) < 2 && m.ch > 150, tag + when + ': canvas fills the host (' + Math.round(m.cw) + 'x' + Math.round(m.ch) + ')');
        T.ok(Math.abs(m.bw - m.cw * m.dpr) < 2, tag + when + ': canvas is scaled for devicePixelRatio');
        T.ok(m.small === 0 && m.wide === 0, tag + when + ': targets >= 24 px and nothing sticks out of the host (' + m.small + ', ' + m.wide + ')');
      };
      await check('empty');
      await p.click('[data-strand=A]'); await check('copy');
      await p.click('#ge-copy-rest'); await check('edit');
      await p.click('#ge-cross-all'); await check('send');
      await p.click('#ge-send'); await check('match');
      await p.click('#ge-match-all'); await check('done');
      T.ok(p.problems.length === 0, tag + 'no console errors ' + p.problems.join('|'));
      await ctx.close();
    }
    // phone: stage panel and result are reachable (not hidden behind the sticky nav) and the cards are tappable
    {
      const { ctx, p } = await open({ width: 390, height: 844, reduced: true, touch: true });
      await p.click('[data-strand=B]'); await p.click('#ge-copy-rest'); await p.click('#ge-cross-all'); await p.click('#ge-send');
      const box = await p.locator('.ge-card[data-code=AAG]').boundingBox();
      T.ok(box.width >= 44 && box.height >= 44, 'phone: card buttons are at least 44 px');
      await p.locator('.ge-card[data-code=AAG]').tap();
      T.ok((await p.locator('#ge-result').innerText()).includes('Phe'), 'phone: tapping a card works');
      await ctx.close();
    }
    // reduced motion: each step shows its final state at once (no animation frames needed); full motion animates then settles
    {
      const { ctx, p } = await open({ width: 1366, height: 900, reduced: true });
      await finish(p, 'A');
      T.ok(await p.locator('#gene-expression-scene canvas').getAttribute('data-shape') !== '', 'reduced motion: the finished shape is drawn at once');
      await ctx.close();
      const m = await open({ width: 1366, height: 900 });
      await m.p.click('[data-strand=A]'); await m.p.click('#ge-copy-rest'); await m.p.click('#ge-cross-all'); await m.p.click('#ge-send');
      const t0 = Date.now(); await m.p.click('#ge-match-all');
      await m.p.waitForTimeout(1300);
      T.ok(/butterfly/.test(await m.p.locator('#ge-result').innerText()), 'full motion: the run completes and settles');
      T.ok(Date.now() - t0 < 4000, 'full motion: no long stall');
      await m.ctx.close();
    }
    // the protein picture differs between A, B and C (and an injected error), and matches the sequence
    {
      const { ctx, p } = await open({ width: 1366, height: 900, reduced: true });
      const shapes = {}, pics = {};
      for (const k of 'ABC') {
        await finish(p, k);
        shapes[k] = await p.locator('#gene-expression-scene canvas').getAttribute('data-shape');
        pics[k] = await p.evaluate(() => { const c = document.querySelector('#gene-expression-scene canvas'); return c.toDataURL().length + ':' + c.toDataURL().slice(-400); });
      }
      T.ok(new Set(Object.values(shapes)).size === 3, 'ribbon geometry differs for strands A, B and C');
      T.ok(new Set(Object.values(pics)).size === 3, 'the drawn canvas differs for strands A, B and C');
      T.ok(shapes.A.split(' ').length === 9 && shapes.B.split(' ').length === 8 && shapes.C.split(' ').length === 9, 'chain lengths 9, 8 and 9 (B is missing a piece): ' + Object.values(shapes).map(s => s.split(' ').length));
      const diff = shapes.A.split(' ').map((s, i) => s === shapes.C.split(' ')[i] ? 0 : 1).reduce((a, b) => a + b, 0);
      T.ok(diff === 1, 'strand C differs from A at exactly one residue (Glu to Lys): ' + diff);
      const aDesc = await (async () => { await finish(p, 'A'); return p.locator('#gene-expression-desc').innerText(); })();
      T.ok(/a butterfly shape/.test(aDesc), 'text description names the butterfly shape for A');
      await finish(p, 'B'); T.ok(/missing a piece/.test(await p.locator('#gene-expression-desc').innerText()), 'text description says the ribbon is missing a piece for B');
      await finish(p, 'C'); T.ok(/different shape/.test(await p.locator('#gene-expression-desc').innerText()), 'text description says a different shape for C');
      await p.click('[data-strand=A]'); await p.click('#ge-inject'); await p.click('#ge-copy-rest'); await p.click('#ge-cross-all'); await p.click('#ge-send'); await p.click('#ge-match-all'); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      T.ok(await p.locator('#gene-expression-scene canvas').getAttribute('data-shape') !== shapes.A, 'an injected error changes the shape');
      T.ok(p.problems.length === 0, 'no console errors ' + p.problems.join('|'));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t95-gene-expression-layout');
})().catch(e => { console.error(e); process.exit(1); });
