/* Wide Data-panel tables: in every lab, at 1366 and 1920, every table in a results Data panel either fits its box
   or scrolls sideways with a visible "Scroll →" hint, a sticky first column, and a hint that goes away at the right end.
   Tables are filled with worst-case-ish rows (numbers like 1234.57, short text) so the widths are realistic. */
const { ok, done, launch, ctxFor, ROOT, LABS } = require('./_h.js');
(async () => {
  const b = await launch();
  const summary = [];
  for (const w of [1366, 1920]) for (const lab of LABS) {
    const ctx = await ctxFor(b, { width: w, height: w === 1366 ? 768 : 1080 });
    await ctx.addInitScript(() => { try { localStorage.setItem('aplab:ui:allParts', '1'); } catch (e) { /* ignore */ } });
    const p = await ctx.newPage();
    await p.goto('file://' + ROOT + '/' + lab + '.html'); await p.waitForTimeout(1100);
    const res = await p.evaluate(async () => {
      const out = [];
      for (const m of [...document.querySelectorAll('.sim-main.has-results')]) {
        const btn = m.querySelector('.sim-tab[data-tab=data]'); if (!btn) continue;
        btn.click(); await new Promise(x => setTimeout(x, 100));
        const panel = m.querySelector('.sim-panel--data');
        for (const reg of Lab._reg.tables) {
          if (!panel.contains(reg.el)) continue;
          const cols = reg.opts.columns, rows = reg.getRows().slice();
          for (let i = 0; i < 3; i++) { const o = {}; cols.forEach(c => { o[c.key] = c.num ? 1234.5678 + i : 'Sample 1'; }); rows.push(o); }
          try { reg.api.setRows(rows); } catch (e) { /* page onChange may reject fake rows */ }
        }
        await new Promise(x => setTimeout(x, 250));
        for (const t of panel.querySelectorAll('table')) {
          const wrap = t.closest('.table-wrap'), hint = wrap.nextElementSibling;
          const o = { sim: m.closest('.sim').id, tw: t.scrollWidth, cw: wrap.clientWidth, panelW: panel.clientWidth, scrollable: wrap.classList.contains('is-scrollable') };
          o.hintShown = !!(hint && hint.classList.contains('scroll-hint') && !hint.hidden && hint.offsetHeight > 0);
          o.fits = t.scrollWidth <= wrap.clientWidth + 2;
          if (o.scrollable) {
            const c = t.querySelector('tbody td:first-child, thead th:first-child');
            o.sticky = getComputedStyle(c).position === 'sticky';
            o.focusable = wrap.getAttribute('tabindex') === '0';
            wrap.scrollLeft = wrap.scrollWidth; wrap.dispatchEvent(new Event('scroll'));
            await new Promise(x => setTimeout(x, 60));
            o.hintAtEnd = !hint.hidden; o.atEndClass = wrap.classList.contains('at-end');
            wrap.scrollLeft = 0; wrap.dispatchEvent(new Event('scroll'));
          }
          o.pageOverflow = document.documentElement.scrollWidth - window.innerWidth;
          out.push(o);
        }
      }
      return out;
    });
    let nfit = 0, nscroll = 0;
    res.forEach((o, i) => {
      const id = `${lab} @${w} ${o.sim}#${i}`;
      if (o.fits) { nfit++; ok(!o.hintShown, `${id} fits (${o.tw}/${o.cw}px), no stray hint`); }
      else { nscroll++; ok(o.scrollable && o.hintShown && o.sticky && o.focusable && !o.hintAtEnd && o.atEndClass, `${id} scrolls (${o.tw}/${o.cw}px): hint shown, sticky first column, focusable, hint gone at the end`); }
      ok(o.pageOverflow <= 0, `${id} no page-level horizontal overflow`);
    });
    summary.push(`${lab} @${w}: ${res.length} tables, ${nfit} fit, ${nscroll} scroll with hint`);
    await ctx.close();
  }
  console.log('\n' + summary.join('\n'));
  await b.close();
  done('t48-tables');
})();
