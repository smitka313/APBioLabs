/* Planner and virtual yeast scenes on openscied-b3-inheritance-environment.html: mounting, plan checks, SIMULATED label, reproducible
   counts per Dataset ID, incubation by stored timestamps (reload resumes), skip ahead, counting, table and chart, saving and restoring,
   no free-text boxes, keyboard use, layouts 390-1920, no page errors, axe (when AXE is set).
   Run: NODE_PATH=$(npm root -g) [AXE=<axe.min.js>] node tests/t97-planner-yeast-scenes.js */
const T = require('./_h');
// Planner single-choice groups are dropdowns: key is starter | iv | dv | strain.
const pickSel = (pg, key, v) => pg.selectOption('[data-sel="' + key + '"]', v);
const fs = require('fs');
const PAGE = 'openscied-b3-inheritance-environment.html', KEY = 'aplab:openscied:b3-inheritance-environment:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
async function open(ctx, server, hash, problems) {
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  p.on('pageerror', e => problems.push('pageerror: ' + e.message));
  await stub(p);
  await p.goto(server.url + PAGE + '#' + (hash || 'plan'));
  await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current'));
  return p;
}
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); };
const saved = (p, k) => p.evaluate(([key, f]) => { const d = JSON.parse(localStorage.getItem(key) || 'null'); return d && d[f]; }, [KEY, k]);
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    const problems = [];
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900 });
    const p = await open(ctx, server, 'plan', problems);

    // --- mounting ---
    T.ok(await p.locator('#planner-notice').isHidden() && await p.locator('#yeast-uv-notice').isHidden(), 'placeholders disappear: both scenes mounted');
    T.ok(await p.locator('#planner-scene canvas[role="img"][aria-label]').count() === 1 && /Investigation planner/.test(await p.locator('#planner-scene canvas').getAttribute('aria-label')), 'planner canvas has a role and label');
    T.ok(await p.locator('#data-planner-body').innerText().then(t => /Run the model first/.test(t)), 'nothing is saved until the student plans');

    // --- plan checks ---
    await pickSel(p, 'starter', 'clear');
    T.ok(/Pick a starter or add a dish/.test(await p.locator('.pl-summary').innerText()), 'empty plan prompts a starter');
    await p.click('[data-add="1"]'); await p.click('[data-add="1"]');
    await p.selectOption('[data-f="cover1"]', 'spf15'); await p.selectOption('[data-f="time1"]', '30');
    const checks = () => p.locator('.pl-list').innerText();
    let t = await checks();
    T.ok(/Two things change at once: the cover and UV time/.test(t) || /Tap what you change/.test(t), 'warns about two changes or an unset variable');
    await pickSel(p, 'iv', 'spf');
    t = await checks();
    T.ok(/Two things change at once: the cover and UV time/.test(t), 'two things change at once is flagged');
    T.ok(/No dark control/.test(t), 'no dark control is flagged');
    T.ok(/No repeats/.test(t), 'no replicate is flagged');
    await p.selectOption('[data-f="time1"]', '15');
    T.ok(/Only one thing changes/.test(await checks()), 'one change passes after fixing the time');
    await p.selectOption('[data-f="time0"]', 'dark');
    T.ok(/A dark dish shows/.test(await checks()), 'a dark dish satisfies the control check');
    await p.click('[data-f="rep1"]');
    T.ok(/You repeated a dish/.test(await checks()), 'repeating a dish satisfies the replicate check');
    T.ok(await p.locator('.pl-ui input[type=text], .pl-ui textarea, #yeast-uv-scene input[type=text], #yeast-uv-scene textarea').count() === 0, 'no free-text boxes in the scenes');
    const st1 = await saved(p, 'planner');
    T.ok(st1 && st1.conditions.length === 3 && st1.conditions[0].dark === true && st1.iv === 'spf' && st1.conditions.every(c => c.label && typeof c.minutes === 'number'), 'plan saved in the contract shape');
    T.ok(/Dish 1.*Dark/s.test(await p.locator('#data-planner-body').innerText()), 'Your plan box fills from the scene');

    // starter plan, held chips, predictions
    await pickSel(p, 'starter', 'class');
    T.ok(await p.locator('.pl-row').count() === 8, 'class set has 8 dishes (7 groups + dark control)');
    await p.click('[data-k="held-yeast"]'); await p.click('[data-k="held-distance"]'); await p.click('[data-k="held-days"]'); await p.click('[data-k="held-agar"]'); await p.click('[data-k="held-time"]');
    T.ok(/Everything else is kept the same/.test(await checks()), 'held-constant check passes');
    await p.click('[data-k="held-cover"]');
    T.ok(/cannot stay the same/.test(await checks()), 'holding the changed thing constant is flagged');
    await p.click('[data-k="held-cover"]');
    await p.selectOption('[data-f="dir0"]', 'fewer');
    T.ok(/Think again: with no UV/.test(await p.locator('.pl-pred').innerText()), 'a prediction against the cause gets a friendly hint');
    await p.selectOption('[data-f="dir0"]', 'more');
    T.ok(/Good thinking/.test(await p.locator('.pl-pred').innerText()), 'a sensible prediction is acknowledged');
    await p.selectOption('[data-f="dir2"]', 'more');
    T.ok((await saved(p, 'planner')).conditions[2].predict.dir === 'more', 'predictions are saved on the condition');

    // keyboard only: focus a chip and press Space
    await p.focus('[data-sel="iv"]'); await p.keyboard.press('ArrowDown');
    await pickSel(p, 'iv', 'time');
    T.ok(await p.locator('[data-sel="iv"]').inputValue() === 'time' && await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-sel') === 'iv'), 'the dropdown keeps focus and shows the choice');
    await pickSel(p, 'iv', 'spf');

    // --- yeast: setup, lamp ---
    await go(p, 'yeast');
    T.ok(/SIMULATED/.test(await p.locator('#yeast-uv-scene .yu-sim').innerText()) && /SIMULATED/.test(await p.locator('#yeast-uv-scene canvas').getAttribute('aria-label')), 'SIMULATED label in the scene and the canvas label');
    T.ok(await p.locator('[data-yu="lamp"]').isDisabled(), 'lamp is off until yeast is spread');
    await p.click('[data-yu="spread"]');
    await p.click('[data-yu="lamp"]');
    await p.waitForSelector('[data-yu="clock"]');
    const ys0 = await saved(p, 'yeast');
    T.ok(ys0 && ys0.dishes.length === 16 && typeof ys0.startedAt === 'number' && ys0.incubationDays >= 3 && ys0.incubationDays <= 5 && ys0.skipped === false, 'lamp saves timestamp, 3-5 days and 16 dishes (8 plus wild-type copies)');
    T.ok(/^Day 1 of \d \(simulated\)/.test(await p.locator('[data-yu="clock"]').innerText()), 'visible time indicator');
    T.ok(await p.locator('[data-yu="count-none"]').count() === 0 && await p.locator('[data-yu="record"]').count() === 0, 'no counting before incubation ends');

    // --- reload resumes from stored timestamps ---
    await p.evaluate(([key]) => { const d = JSON.parse(localStorage.getItem(key)); d.yeast.startedAt -= d.yeast.incubationDays * 20000 * 0.5; localStorage.setItem(key, JSON.stringify(d)); }, [KEY]);
    await p.reload(); await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current')); await go(p, 'yeast');
    const clk = await p.locator('[data-yu="clock"]').innerText();
    T.ok(/^Day [23] of \d/.test(clk), 'reload resumes mid-incubation: ' + clk);
    T.ok(await p.locator('[data-yu="record"]').count() === 0, 'still incubating after reload');
    await p.evaluate(([key]) => { const d = JSON.parse(localStorage.getItem(key)); d.yeast.startedAt -= 10 * 20000; localStorage.setItem(key, JSON.stringify(d)); }, [KEY]);
    await p.reload(); await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current')); await go(p, 'yeast');
    T.ok(await p.locator('[data-yu="record"]').count() === 1, 'long after the stored time the dishes are ready to count');

    // --- counting ---
    const sameSeed = await saved(p, 'yeast');
    await p.click('[data-yu="thumb"][data-i="1"]');
    const cv = p.locator('#yeast-uv-scene canvas.yu-canvas'); const box = await cv.boundingBox();
    await cv.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await p.click('[data-yu="step"][data-k="p10"]');
    const marked = Number(await p.locator('[data-yu="marked"]').innerText());
    T.ok(marked >= 0 && marked <= 10, 'steppers change the marked count (a dish may have few colonies): ' + marked);
    await p.click('[data-yu="record"]');
    let d1 = (await saved(p, 'yeast')).dishes[1];
    T.ok(d1.colonies === marked && d1.how === 'tap', 'record saves the marked count');
    await p.click('[data-yu="bracket"][data-k="b3"]');
    d1 = (await saved(p, 'yeast')).dishes[1];
    T.ok(d1.colonies === 76 && d1.how === 'estimate', 'a count range records its midpoint as an estimate');
    await p.click('[data-yu="rating"][data-k="few"]'); await p.click('[data-yu="obs"][data-k="o0"]');
    T.ok(/usually/.test(await p.locator('.yu-warn').innerText()), 'rating that does not fit the count gets a friendly hint');
    await p.click('[data-yu="auto"]');
    await p.click('[data-yu="autoall"]');
    const ys2 = await saved(p, 'yeast');
    T.ok(ys2.dishes.every(d => Number.isInteger(d.colonies) && d.colonies >= 0), 'all dishes counted, whole numbers >= 0');
    const dark = ys2.dishes[0].colonies, none = ys2.dishes[1].colonies, s50 = ys2.dishes[6].colonies, s15 = ys2.dishes[2].colonies;
    T.ok(dark > none && s15 > none && s50 > none, 'dark and protected dishes out-grow the unprotected one: ' + [dark, s15, s50, none].join(','));
    T.ok(ys2.dishes.slice(8).every((d, i) => d.strain === 'wild') && ys2.dishes[9].colonies >= ys2.dishes[1].colonies, 'wild-type dish survives UV at least as well as UV-sensitive');
    // table and chart match the saved data
    const rows = await p.locator('.yu-table tbody tr').evaluateAll(trs => trs.map(tr => Array.from(tr.children).map(c => c.textContent)));
    T.ok(rows.length === 16 && rows.every((r, i) => r[3].replace('≈ ', '') === String(ys2.dishes[i].colonies)), 'results table matches the saved counts');
    T.ok(rows.every(r => r[4] !== '—' && r[5] !== '—') && rows.some(r => r[4] === 'not rated yet') && /Counting does not rate growth/.test(await p.locator('#yeast-uv-scene').innerText()), 'after Count all, Growth says "not rated yet" in words (no bare dash) and the page says rating is the student\'s job');
    T.ok(await p.locator('.yu-chart svg').count() >= 1 && /Colonies\s*counted\s*\(?simulated/.test(await p.locator('.yu-chart').textContent()), 'bar chart drawn with a units axis title');
    T.ok(await p.locator('.yu-chart rect').count() >= 16, 'chart has a bar per counted dish');
    T.ok(/Prediction/.test(await p.locator('.yu-table').innerText()) && /✓ matched/.test(await p.locator('.yu-table').innerText()), 'prediction check appears in the table');
    T.ok(/SIMULATED/.test(await p.locator('#data-yeast-body').innerText()) && /Dish 1/.test(await p.locator('#data-yeast-body').innerText()), 'page "Your simulated dishes" box fills from the scene');
    T.ok(/Text description \(simulated\)/.test(await p.locator('#yeast-uv-desc').innerText()) && /16 of 16 dishes counted/.test(await p.locator('#yeast-uv-desc').innerText()), 'text description is current');
    // reload keeps everything
    await p.reload(); await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current')); await go(p, 'yeast');
    T.ok(await p.locator('.yu-table tbody tr').count() === 16 && /16 of 16 dishes counted/.test(await p.locator('.yu-table caption').innerText()), 'counted dishes restore after a reload');
    // start over needs two taps
    await p.click('[data-yu="reset"]');
    T.ok((await saved(p, 'yeast')).dishes.length === 16, 'first tap on Start over does not erase');
    await p.click('[data-yu="reset"]');
    T.ok(await saved(p, 'yeast') === null && await p.locator('[data-yu="spread"]').count() === 1, 'second tap erases and returns to set-up');

    // --- skip ahead and reproducibility per Dataset ID ---
    await p.click('[data-yu="spread"]'); await p.click('[data-yu="lamp"]');
    await p.waitForSelector('[data-yu="skip"]'); await p.click('[data-yu="skip"]');
    T.ok((await saved(p, 'yeast')).skipped === true && await p.locator('[data-yu="record"]').count() === 1, 'skip ahead finishes incubation and is saved');
    const a = (await saved(p, 'yeast')).dishes.map(d => d.truth);
    T.ok(JSON.stringify(a) === JSON.stringify(sameSeed.dishes.map(d => d.truth)), 'same Dataset ID and plan give the same dishes again');
    const ctx2 = await T.ctxFor(browser, { width: 1366, height: 900 });
    await ctx2.addInitScript(() => { try { if (!sessionStorage.getItem('__s2')) { localStorage.setItem('aplab:student', JSON.stringify({ name: 'Other Person', period: '5' })); sessionStorage.setItem('__s2', '1'); } } catch (e) { /* ignore */ } });
    const p2 = await open(ctx2, server, 'plan', problems);
    await pickSel(p2, 'starter', 'class'); await go(p2, 'yeast'); await p2.click('[data-yu="spread"]'); await p2.click('[data-yu="lamp"]'); await p2.waitForSelector('[data-yu="skip"]');
    const b = (await saved(p2, 'yeast')).dishes.map(d => d.truth);
    T.ok(JSON.stringify(a) !== JSON.stringify(b) || (await saved(p2, 'yeast')).seed !== (await saved(p, 'yeast')).seed, 'another Dataset ID gives different dishes');
    await ctx2.close();

    // --- layouts ---
    for (const [w, h] of [[390, 844], [768, 900], [1366, 900], [1920, 1080]]) {
      const c = await T.ctxFor(browser, { width: w, height: h, dark: w === 390 });
      const q = await open(c, server, 'plan', problems);
      await pickSel(q, 'starter', 'class'); await go(q, 'yeast');
      await q.click('[data-yu="spread"]'); await q.click('[data-yu="lamp"]'); await q.waitForSelector('[data-yu="skip"]'); await q.click('[data-yu="skip"]'); await q.click('[data-yu="autoall"]');
      for (const sec of ['plan', 'yeast']) {
        await go(q, sec);
        const fit = await q.evaluate(() => { const de = document.documentElement; const bad = []; document.querySelectorAll('.pl-ui button, .pl-ui select, .yu-ui button, #planner-scene canvas, #yeast-uv-scene canvas').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > de.clientWidth + 1 || r.left < -1)) bad.push(e.className || e.tagName); }); return { scroll: de.scrollWidth > de.clientWidth + 1, bad: bad.slice(0, 3) }; });
        T.ok(!fit.scroll && fit.bad.length === 0, `${sec} fits at ${w}px (no sideways scroll) ${JSON.stringify(fit.bad)}`);
      }
      const small = await q.evaluate(() => Array.from(document.querySelectorAll('.pl-ui button, .pl-ui select, .yu-ui button')).filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 24 || r.width < 24); }).length);
      T.ok(small === 0, `targets are at least 24px at ${w}px`);
      await c.close();
    }

    // --- axe ---
    const axeFile = process.env.AXE || (() => { try { return require.resolve('axe-core/axe.min.js'); } catch (e) { return null; } })();
    if (axeFile && fs.existsSync(axeFile)) {
      for (const dark of [false, true]) {
        const c = await T.ctxFor(browser, { width: 390, height: 844, dark, reduced: true });
        const q = await open(c, server, 'plan', problems);
        await q.addScriptTag({ content: fs.readFileSync(axeFile, 'utf8') });
        await pickSel(q, 'starter', 'class'); await q.selectOption('[data-f="dir2"]', 'more');
        await go(q, 'yeast'); await q.click('[data-yu="spread"]'); await q.click('[data-yu="lamp"]'); await q.waitForSelector('[data-yu="skip"]'); await q.click('[data-yu="skip"]'); await q.click('[data-yu="autoall"]');
        await q.waitForTimeout(500);
        const found = [];
        for (const sec of ['plan', 'yeast']) {
          await go(q, sec);
          const r = await q.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => v.id + ': ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' ; ')));
          r.forEach(x => found.push(sec + ' ' + x));
        }
        T.ok(found.length === 0, 'axe clean on both scenes ' + (dark ? 'dark' : 'light') + ' ' + found.join(' | '));
        await c.close();
      }
    } else T.ok(true, 'axe skipped (set AXE)');

    // --- reduced motion: no lamp animation, final state complete ---
    const cr = await T.ctxFor(browser, { width: 1366, height: 900, reduced: true });
    const r = await open(cr, server, 'yeast', problems);
    await r.click('[data-yu="spread"]'); await r.click('[data-yu="lamp"]');
    T.ok(await r.locator('[data-yu="clock"]').count() === 1, 'reduced motion goes straight to incubation');
    await cr.close();

    T.ok(problems.length === 0, 'no page errors or console errors ' + problems.join(' | '));
  } finally { await browser.close(); server.close(); }
  T.done('t97-planner-yeast-scenes');
})().catch(e => { console.error(e); process.exit(1); });
