/* B.2 Fires scenes: Matter Energy Cards, yeast decomposition test, tilt test with BTB. Mount, tap flow, stored timestamps and resume after reload,
   skip ahead, recorded readings match the model, chart and table, drawing not blank, reduced motion, themes, same seed same data.
   Run: NODE_PATH=$(npm root -g) node tests/t103-b2-fires-scenes.js */
const T = require('./_h');
const PAGE = 'openscied-b2-fires.html', KEY = 'aplab:openscied:b2-fires:v1';
const L = require('../openscied-b2-fires-logic.js');
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); await p.waitForTimeout(150); };
const ink = (p, sel) => p.evaluate(s => { const c = document.querySelector(s + ' canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const m = new Map(); let n = 0; for (let i = 0; i < d.length; i += 16) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; m.set(k, (m.get(k) || 0) + 1); n++; } let top = 0; m.forEach(v => { if (v > top) top = v; }); return { colours: m.size, ink: 1 - top / n }; }, sel);
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900 });
    const p = await ctx.newPage();
    const problems = [];
    p.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
    p.on('pageerror', e => problems.push('pageerror: ' + e.message));
    await stub(p);
    await p.goto(server.url + PAGE);
    await p.waitForFunction(() => window.B2Fires && document.querySelector('.step.is-current'));
    T.ok(await p.evaluate(() => Array.from(document.querySelectorAll('.scene-host')).every(h => h.dataset.mounted === '1')) && await p.locator('.scene-notice:visible').count() === 0, 'all three scenes mounted, no notice');

    // ---- cards ----
    await go(p, 'cards');
    T.ok(await p.locator('.mc-card').count() === 5 && await p.locator('.mc-card.mc-energy').count() === 1 && await p.locator('.mc-card svg').count() === 5, 'five cards, the energy card is different');
    const tap = async (card, zone) => p.locator('.mc-card[data-card="' + card + '"] [data-zone="' + zone + '"]').click();
    await tap('sugar', 'out');
    T.ok(/^Try again/.test(await p.locator('.mc-card[data-card="sugar"] .mc-fb').innerText()) && await p.locator('.mc-card[data-card="sugar"]').getAttribute('data-state') === 'wrong', 'wrong side has a reason and a text mark');
    await tap('sugar', 'in'); await tap('oxygen', 'in'); await tap('carbon-dioxide', 'out'); await tap('water', 'out');
    T.ok(!(await p.locator('.mc-sentence').innerText()).includes('This is cellular respiration'), 'no "this is the reaction" until all five are right');
    await tap('energy', 'out');
    T.ok(/Sugar \+ oxygen → carbon dioxide \+ water \+ energy transferred/.test(await p.locator('.mc-sentence').innerText()) && /This is the reaction/.test(await p.locator('.mc-eq h4').innerText()), 'reaction sentence when right');
    T.ok(await p.locator('.mc-eq circle.mc-dot').count() === 5, 'one anchor dot per drawn molecule');
    const stc = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).cards, KEY);
    T.ok(stc.solved === true && stc.placed.energy === 'out', 'cards saved');
    await tap('water', 'in');
    T.ok(!(await p.locator('.mc-sentence').innerText()).includes('cellular respiration') && await p.evaluate(k => JSON.parse(localStorage.getItem(k)).cards.solved, KEY) === false, 'stale "correct" removed as soon as a card moves');
    await tap('water', 'out');

    // ---- decomposition ----
    await go(p, 'yeast');
    T.ok((await ink(p, '#decomp-scene')).ink > 0.02, 'beakers are drawn before the test starts');
    await p.selectOption('#dc-temp-2', '35');
    await p.selectOption('#dc-temp-2', '43');
    await p.locator('[data-dc="start"]').click();
    await p.waitForSelector('[data-dc="clock"]');
    const st0 = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).decomp, KEY);
    T.ok(typeof st0.startedAt === 'number' && st0.recorded.length === 0 && st0.temps.join() === '18,27,43' && st0.seed > 0, 'start stores a timestamp, not a timer');
    T.ok(await p.locator('[data-dc="record"]').isEnabled(), 'the 0 minute reading is ready at once');
    await p.locator('[data-dc="record"]').click();
    T.ok(await p.locator('.dc-table tbody tr').first().innerText().then(t => /0\s+0\s+0\s+0/.test(t)), '0 min reading is 0 mm');
    // reload mid-run: the clock continues from the stored timestamp
    await p.waitForTimeout(4600);
    await p.reload(); await p.waitForFunction(() => window.B2Fires); await go(p, 'yeast');
    const m1 = await p.locator('[data-dc="clock"]').innerText();
    T.ok(/Minute [0-9]+ of 20/.test(m1) && !/Minute 0 /.test(m1), 'reload keeps the running clock: ' + m1);
    T.ok(await p.locator('.dc-table tbody tr td.dc-miss').count() > 0 && await p.evaluate(k => JSON.parse(localStorage.getItem(k)).decomp.recorded.join(), KEY) === '0', 'recorded readings survive');
    T.ok(await p.locator('[data-dc="record-all"]').count() === 1, 'Record all button');
    await p.locator('[data-dc="skip"]').click();
    T.ok(/Finished/.test(await p.locator('[data-dc="clock"]').innerText()), 'skip ahead finishes the test');
    await p.locator('[data-dc="record-all"]').click();
    const rows = await p.locator('.dc-table tbody tr').evaluateAll(trs => trs.map(tr => Array.from(tr.children).map(c => c.textContent.trim())));
    const dstate = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).decomp, KEY);
    const expect = [18, 27, 43].map((t, i) => L.foamSeries(dstate.seed, i, t));
    T.ok(rows.length === 11 && rows.every((r, k) => r[1] === String(expect[0][k]) && r[2] === String(expect[1][k]) && r[3] === String(expect[2][k])), 'table equals the model for this seed');
    const last = rows[10].slice(1).map(Number);
    T.ok(last[0] < last[1] && last[1] < last[2] && last[0] >= 5 && last[2] <= 80 && last[2] >= 50, 'cold < room < warm, realistic mm: ' + last.join(', '));
    T.ok(/Foam 0?\s?[0-9]+ mm/.test(await p.locator('#decomp-desc').innerText()) || /mm of foam/.test(await p.locator('#decomp-desc').innerText()), 'text description is current');
    T.ok(await p.locator('#decomp-scene canvas').evaluate(c => /Beaker 3 at 43 °C has \d+ millimeters of foam/.test(c.getAttribute('aria-label')) && c.getAttribute('role') === 'img'), 'canvas role and label name the foam heights');
    const peak = await ink(p, '#decomp-scene');
    T.ok(peak.ink > 0.05 && peak.colours > 20, 'foam beakers drawn (ink ' + peak.ink.toFixed(3) + ')');
    T.ok(await p.locator('.dc-chart svg').count() >= 1 && /Time \(min\)/.test(await p.locator('.dc-chart').innerText()) && /Foam height/.test(await p.locator('.dc-chart').innerText()) && /Simulated data/i.test(await p.locator('.dc-chart').innerText()), 'chart has axis titles with units and the simulated tag');
    T.ok(await p.locator('.dc-chart .lg-sw, .dc-chart .chart-legend').count() >= 3 || /Beaker 1/.test(await p.locator('.dc-chart').innerText()), 'chart legend names the beakers');
    await p.locator('.dc-chip', { hasText: 'Carbon dioxide made' }).click();
    T.ok(/Carbon dioxide made/.test(await p.locator('.dc-chart').innerText()), 'chart can show relative carbon dioxide');
    T.ok(/Foam at the last reading \(20 min\)/.test(await p.locator('#data-decomp-body').innerText()) && /SIMULATED/.test(await p.locator('#data-decomp-body').innerText()), 'Your data box shows the last reading, labeled simulated');
    // prediction check uses the recorded data
    await go(p, 'plan'); await p.selectOption('#pred-fastest', 'warm');
    await go(p, 'sense3');
    T.ok(/^✓ You predicted Beaker 3 \(43 °C\)/.test(await p.locator('#pred-note').innerText()), 'prediction check: ' + await p.locator('#pred-note').innerText());
    // start over needs a second tap
    await go(p, 'yeast');
    await p.locator('[data-dc="reset"]').click();
    T.ok(await p.locator('[data-dc="reset-yes"]').count() === 1 && await p.evaluate(k => !!JSON.parse(localStorage.getItem(k)).decomp, KEY), 'start over asks first and keeps the data until confirmed');
    await p.locator('[data-dc="reset-yes"]').click();
    T.ok(await p.locator('[data-dc="start"]').count() === 1 && await p.evaluate(k => JSON.parse(localStorage.getItem(k)).decomp, KEY) === null, 'start over clears the test');
    T.ok(/Run the test first/.test(await p.locator('#data-decomp-body').innerText()) && await p.locator('#pred-note').isHidden(), 'derived boxes empty again');
    // Skipping to the end before recording any sample must distinguish the backlog from the clock.
    await p.locator('[data-dc="start"]').click();
    await p.locator('[data-dc="skip"]').click();
    T.ok(/Finished: 20 of 20 min/.test(await p.locator('[data-dc="clock"]').innerText()) &&
      /Record next unrecorded sample \(0 min\)/.test(await p.locator('[data-dc="record"]').innerText()) &&
      /run is finished.*Record all missing readings.*starting at minute 0/.test(await p.locator('[data-dc="hint"]').innerText()) &&
      /Record all 11 missing readings/.test(await p.locator('[data-dc="record-all"].btn--primary').innerText()),
      'the clock and queued 0-minute sample are separately labeled');
    await p.locator('[data-dc="record"]').click();
    T.ok(/Record next unrecorded sample \(2 min\)/.test(await p.locator('[data-dc="record"]').innerText()) &&
      await p.evaluate(k => JSON.parse(localStorage.getItem(k)).decomp.recorded.join(), KEY) === '0',
      'the single-record button still uses the original time order');
    await p.locator('[data-dc="record-all"]').click();
    T.ok(await p.evaluate(k => JSON.parse(localStorage.getItem(k)).decomp.recorded.length, KEY) === L.TIMES.length,
      'all readings are recorded with the catch-up button');


    // ---- tilt ----
    await go(p, 'tilt');
    T.ok(await p.locator('[data-tl="start"]').isDisabled(), 'cannot start until every tube has a light');
    await p.selectOption('#tl-light-0', 'direct'); await p.selectOption('#tl-light-1', 'direct'); await p.selectOption('#tl-light-2', 'direct');
    T.ok(/same setting/.test(await p.locator('[data-tl="msg"]').innerText()) && await p.locator('[data-tl="start"]').isEnabled(), 'repeat setup allowed with a note');
    await p.locator('[data-tl="plan"]').click();
    T.ok(await p.inputValue('#tl-light-2') === 'foil' && /Good plan/.test(await p.locator('[data-tl="msg"]').innerText()), 'class plan fills A direct, B 45 degrees, C foil');
    await p.locator('[data-tl="start"]').click();
    await p.waitForSelector('[data-tl="clock"]');
    const t0 = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).tilt, KEY);
    T.ok(typeof t0.startedAt === 'number' && t0.settings.join() === 'direct,tilt45,foil' && t0.recorded === false, 'tilt start stores a timestamp and settings');
    T.ok(await p.locator('[data-tl="unwrap"]').isDisabled(), 'tubes cannot be read before morning');
    T.ok(/hidden under foil/.test(await p.locator('#tilt-scene canvas').getAttribute('aria-label')) || /hidden under foil/.test(await p.locator('#tilt-desc').innerText()), 'foil tube color stays hidden');
    await p.reload(); await p.waitForFunction(() => window.B2Fires); await go(p, 'tilt');
    T.ok(/Hour \d+ of 12|Morning/.test(await p.locator('[data-tl="clock"]').innerText()) && await p.locator('[data-tl="skip"]').count() === 1, 'reload keeps the night running');
    await p.locator('[data-tl="skip"]').click();
    await p.locator('[data-tl="unwrap"]').click();
    const trows = await p.locator('.tl-table tbody tr').evaluateAll(trs => trs.map(tr => Array.from(tr.children).map(c => c.textContent.trim())));
    const exp = L.tiltResults(t0.seed, t0.settings);
    T.ok(trows.length === 3 && trows.every((r, i) => r[0] === 'Tube ' + exp[i].tube && r[3] === exp[i].btb.toFixed(1) && r[4] === exp[i].btbLabel), 'table equals the model: ' + JSON.stringify(trows.map(r => r[3] + ' ' + r[4])));
    const readoutA = p.locator('[data-tube-readout="A"]'), readoutB = p.locator('[data-tube-readout="B"]');
    T.ok(await readoutA.isVisible() && await readoutB.isVisible() &&
      (await readoutA.innerText()).includes('Direct (0°) · 100% light') &&
      (await readoutB.innerText()).includes('Tilted (45°) · 71% light') &&
      (await readoutA.innerText()).includes('BTB ' + exp[0].btb.toFixed(1)) &&
      (await readoutB.innerText()).includes('BTB ' + exp[1].btb.toFixed(1)),
      'different light exposures and the actual BTB values are visible without telling colors apart');
    T.ok(/same color.*different readings/.test(await p.locator('[data-tl="hint"]').innerText()),
      'students are prompted to compare numeric readings even when the colors look the same');

    T.ok(Number(trows[0][3]) <= Number(trows[1][3]) && Number(trows[1][3]) < Number(trows[2][3]) && Number(trows[2][3]) >= 5.3, 'direct bluest, foil yellowest');
    T.ok(await p.locator('.tl-chart svg').count() >= 1 && /BTB reading/.test(await p.locator('.tl-chart').innerText()), 'bar chart with axis titles');
    T.ok((await ink(p, '#tilt-scene')).ink > 0.05, 'tubes drawn');
    T.ok(await p.locator('#tilt-scene canvas').evaluate(c => /Tube C: Foil \(no light\), BTB 5|Tube C: Foil \(no light\), BTB 6/.test(c.getAttribute('aria-label'))), 'canvas label reports the unwrapped foil tube');
    await p.locator('[data-tl="starch"]').click();
    T.ok(await p.locator('.tl-leaf').count() === 3 && /starch/.test(await p.locator('.tl-table').innerText()), 'starch test adds leaves and a column');
    const sres = exp.map(x => x.starchLabel);
    T.ok(sres[2] === 'none' && sres[0] !== 'none', 'starch: none under foil, some in light');
    await go(p, 'sense5');
    T.ok(/Tube A\s+Direct/.test(await p.locator('#data-tilt-body').innerText()) && /SIMULATED/.test(await p.locator('#data-tilt-body').innerText()), 'Your data box filled and labeled simulated');
    await p.selectOption('#sense-bluest', 'direct');
    T.ok(/^Yes/.test(await p.locator('#feedback-sense-bluest').innerText()), 'data-based row passes');
    T.ok(problems.length === 0, 'no console errors: ' + problems.join(' | '));
    await ctx.close();

    // ---- determinism across contexts, reduced motion, dark ----
    for (const [name, o] of [['reduced motion', { reduced: true }], ['dark', { dark: true }]]) {
      const c = await T.ctxFor(browser, Object.assign({ width: 390, height: 844 }, o)); const q = await c.newPage(); await stub(q);
      await q.goto(server.url + PAGE); await q.waitForFunction(() => window.B2Fires);
      await go(q, 'yeast'); await q.locator('[data-dc="start"]').click(); await q.locator('[data-dc="skip"]').click(); await q.locator('[data-dc="record-all"]').click();
      T.ok((await ink(q, '#decomp-scene')).ink > 0.05 && await q.locator('.dc-table tbody tr').count() === 11, name + ': final state is complete without animation');
      await go(q, 'tilt'); await q.locator('[data-tl="plan"]').click(); await q.locator('[data-tl="start"]').click(); await q.locator('[data-tl="skip"]').click(); await q.locator('[data-tl="unwrap"]').click();
      T.ok((await ink(q, '#tilt-scene')).ink > 0.05 && await q.locator('.tl-table tbody tr').count() === 3, name + ': tilt final state complete');
      const a = await q.evaluate(() => B2Fires.getState());
      const q2 = await c.newPage(); await stub(q2); await q2.goto(server.url + PAGE); await q2.waitForFunction(() => window.B2Fires);
      const same = await q2.evaluate(() => B2Fires.getState().decomp.seed);
      T.ok(a.decomp.seed === same, name + ': the same student gets the same seed in a new tab');
      await c.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t103-b2-fires-scenes');
})().catch(e => { console.error(e); process.exit(1); });
