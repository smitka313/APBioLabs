/* The "Cell cycle data" reference panel (OpenSciEd B.3 Lesson 3, Cell Cycle Data handout; TE step 14) sits with the
   Lesson 3 Making Sense work. It recreates both figures with the handout's values: Figure 1, the same cell at 54, 64,
   72 and 80 h on a 15–45 µm² size key (blue → green → yellow, then two dark-blue cells); Figure 2, relative genetic
   material 1 in G1, rising to 2 in S, 2 in G2. Each figure has a caption, and the panel carries the CC BY-NC 4.0
   attribution and a link to openscied.org. It fits at phone width in both themes. */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const o of [{ width: 1366, dark: false }, { width: 390, dark: true }]) {
      const ctx = await T.ctxFor(browser, { width: o.width, height: 900, dark: o.dark, reduced: true });
      const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'cell-game', server.url);
      const tag = o.width + 'px ' + (o.dark ? 'dark' : 'light') + ': ';
      const panel = p.locator('#cell-cycle-data');
      T.ok(await panel.count() === 1 && await p.locator('#making-sense #cell-cycle-data').count() === 1, tag + 'the Cell cycle data panel is inside the Lesson 3 Making Sense section');
      T.ok((await p.getByRole('heading', { name: 'Cell cycle data', exact: true }).count()) === 1, tag + 'it has a "Cell cycle data" heading');
      const rows = await p.locator('#cycle-data-size-table tbody tr').evaluateAll(trs => trs.map(tr => Array.from(tr.cells).map(c => c.textContent.trim())));
      T.ok(JSON.stringify(rows) === JSON.stringify([['54 h','1 cell','Blue · small'],['64 h','1 cell','Green · medium'],['72 h','1 cell','Yellow · larger'],['80 h','2 cells (it divided)','Dark blue · smallest']]), tag + 'Figure 1 table: 54/64/72/80 h, blue → green → yellow → two dark-blue cells');
      T.ok(/15 square micrometres/.test(await p.locator('.size-key').getAttribute('aria-label')) && /45 µm²/.test(await p.locator('.size-key').textContent()), tag + 'size key runs 15–45 µm²');
      T.ok(/10 µm/.test(await p.locator('#cycle-data-size .cycle-data-note').textContent()) && /do not give an exact area/.test(await p.locator('#cycle-data-size .cycle-data-note').textContent()), tag + 'Figure 1 says sizes are colours only (no exact areas) and keeps the 10 µm scale bar');
      const dna = await p.locator('#cycle-data-dna-table tbody tr').evaluateAll(trs => trs.map(tr => Array.from(tr.cells).map(c => c.textContent.trim())));
      T.ok(JSON.stringify(dna) === JSON.stringify([['G1','1'],['S','Rises from 1 to 2'],['G2','2']]), tag + 'Figure 2 table: G1 = 1, S rises 1 → 2, G2 = 2');
      const chart = p.locator('svg.dna-chart');
      T.ok(await chart.getAttribute('role') === 'img' && /G1: relative amount 1\. S: rises steadily from 1 to 2\. G2: relative amount 2/.test(await p.locator('#dna-chart-desc').textContent()), tag + 'the chart is an image with a text description of its values');
      // The line sits at y=1 through G1, climbs across S, and holds at y=2 through G2 (y=150 is 1, y=75 is 2, y=225 is 0).
      T.ok(await p.locator('.dna-line').getAttribute('points') === '70,150 275,150 426,75 500,75', tag + 'chart line plots 1 → 1 → 2 → 2 at the phase boundaries');
      const captions = await p.locator('#cell-cycle-data figcaption').allTextContents();
      T.ok(captions.length === 2 && /grows larger.*divides into two/.test(captions[0]) && /doubles, from 1 to 2, during S phase/.test(captions[1]), tag + 'each figure has a one-line caption saying what it shows');
      const credit = p.locator('.cycle-data-credit');
      T.ok(/Data from OpenSciEd Biology B\.3 Lesson 3, CC BY-NC 4\.0/.test(await credit.textContent()) && await credit.locator('a').getAttribute('href') === 'https://www.openscied.org/', tag + 'attribution with CC BY-NC 4.0 and a link to openscied.org');
      T.ok(await p.locator('#cell-cycle-data embed, #cell-cycle-data iframe, #cell-cycle-data object, #cell-cycle-data a[href$=".pdf"]').count() === 0, tag + 'the PDF itself is not embedded or linked');
      await panel.scrollIntoViewIfNeeded();
      const fit = await panel.evaluate(el => { const r = el.getBoundingClientRect(); return { r: r.right, w: innerWidth, sw: document.documentElement.scrollWidth }; });
      T.ok(fit.r <= fit.w && fit.sw <= fit.w, tag + 'panel fits the viewport with no sideways scroll');
      const wraps = await p.locator('#cell-cycle-data .table-wrap').evaluateAll(ws => ws.every(w => w.scrollWidth <= w.clientWidth + 1));
      T.ok(wraps, tag + 'both data tables fit without sideways scrolling');
      const label = await p.locator('.dna-chart .dna-axis-label').first().evaluate(el => { const b = el.getBBox(); return b.x + b.width; });
      T.ok(label <= 520, tag + 'the chart axis label fits inside the chart (' + Math.round(label) + ' of 520)');
      const stroke = await p.locator('.dna-line').evaluate(el => getComputedStyle(el).stroke);
      T.ok(stroke && stroke !== 'none', tag + 'chart line is drawn with the theme accent (' + stroke + ')');
      T.ok(p.errors.length === 0, tag + 'no page errors ' + JSON.stringify(p.errors));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t87-cell-cycle-data');
})().catch(e => { console.error(e); process.exitCode = 1; });
