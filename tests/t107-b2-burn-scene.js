/* Burn demonstration scene (openscied-b2-burn-lab.html #burn-scene): the flow is weigh and read the temperature (before), burn, then lift the dome and weigh and read the
   temperature again (after), tap observations, record. The laser thermometer is used ONLY at the two weighings (no live reading while it burns); the before reading is stored and
   survives a reload; the after reading is only available once the burn has finished. The drawing and text description follow the model, the table matches the model, a second
   sample differs, three samples per fuel at most, Start over, reduced motion shows the finished burn, canvas not blank.
   Run: NODE_PATH=$(npm root -g) node tests/t107-b2-burn-scene.js */
const T = require('./_h');
const PAGE = 'openscied-b2-burn-lab.html', KEY = 'aplab:openscied:b2-burn-lab:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); await p.waitForTimeout(200); };
const ink = p => p.evaluate(() => { const c = document.querySelector('#burn-scene canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, m = new Map(); let n = 0; for (let i = 0; i < d.length; i += 16) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; m.set(k, (m.get(k) || 0) + 1); n++; } let top = 0; m.forEach(v => { if (v > top) top = v; }); return { colours: m.size, ink: 1 - top / n }; });
const label = p => p.locator('#burn-scene canvas').getAttribute('aria-label');
// where the laser dot is, and the drawn area of the fuel (before) or the ash (after), as the scene measured them from its own geometry
const laser = async p => { const t = await p.locator('#burn-scene canvas').getAttribute('data-laser'); return t ? JSON.parse(t) : null; };
const dotInArea = l => !!l && Math.hypot(l.x - l.area.x, l.y - l.area.y) <= l.area.r && l.area.r > 4;
const tempIn = lab => { const m = /reads (\d+) degrees/.exec(lab); return m ? +m[1] : null; };
const weigh = p => p.locator('[data-bn="weigh"]').click();
const finishAndRecord = async (p, obs) => { await p.locator('[data-bn="skip"]').click(); await p.locator('[data-bn="after"]').click(); for (const o of obs || []) await p.locator('fieldset.bn-obs .bn-chip', { hasText: o }).click(); await p.locator('[data-bn="record"]').click(); };
const burnFuel = async (p, fuel, obs) => { await p.selectOption('#bn-fuel', fuel); await weigh(p); await p.locator('[data-bn="burn"]').click(); await finishAndRecord(p, obs); };
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900 });
    const p = await ctx.newPage(); await stub(p);
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(server.url + PAGE); await p.waitForFunction(() => window.B2Burn && document.querySelector('#burn-scene').dataset.mounted === '1');
    await go(p, 'burn');
    T.ok(await p.locator('#burn-notice').isHidden(), 'scene mounted, no failure notice');

    // ----- ready, not weighed yet: the laser rests, the balance shows nothing
    const lab0 = await label(p), desc0 = await p.locator('#burn-desc').innerText();
    T.ok(/half-sphere glass bowl, upside down/.test(lab0) && /dome/.test(lab0) && /dish of BTB inside/.test(lab0) && /half-sphere glass bowl, upside down/.test(desc0) && /dome/.test(desc0) && /dish/.test(desc0) && !/flask/i.test(lab0 + desc0), 'aria-label and description say a half-sphere glass bowl, upside down (the dome) with a BTB dish, never a flask: ' + lab0.slice(0, 120));
    T.ok(/not weighed yet/.test(lab0) && /laser thermometer rests on the bench/.test(lab0) && tempIn(lab0) === null, 'before weighing: not weighed yet and the laser thermometer rests (no reading)');
    let c = await ink(p); T.ok(c.ink > 0.01 && c.colours > 8, 'canvas is drawn before the burn (ink ' + c.ink.toFixed(3) + ')');
    T.ok(await p.locator('#bn-fuel option').count() === 5 && await p.locator('[data-bn="record"]').count() === 0 && await p.locator('[data-bn="after"]').count() === 0, 'five fuels to pick, nothing to record yet');
    T.ok(await p.locator('[data-bn="weigh"]').isEnabled() && await p.locator('[data-bn="burn"]').isDisabled(), 'Weigh and read is offered; Burn waits until the before reading is taken');
    T.ok(/Weigh and read temperature \(before\)/.test(await p.locator('[data-bn="weigh"]').innerText()), 'button says what it does');
    const readyRead = await p.locator('.bn-read').first().innerText();
    T.ok(/Mass on the balance \(before\)\s*—/.test(readyRead.replace(/\n/g, ' ')) && /Fuel temperature, laser \(before\)\s*—/.test(readyRead.replace(/\n/g, ' ')), 'readouts are blank before the first weighing');
    T.ok(/Step 1: weigh the handful and read the temperature\. Step 2: burn it\. Step 3: weigh and read the temperature again/.test(await p.locator('.bn-panel').first().innerText()), 'the steps are stated');

    // ----- BEFORE: weigh and read
    const model = await p.evaluate(() => { const L = B2Burn.logic, r = L.burnResult(B2Burn.seed('burn'), 'grass', 1); return { mb: r.massBefore.toFixed(1), tb: r.tempBefore, ma: r.massAfter.toFixed(1), ta: r.tempAfter }; });
    await p.selectOption('#bn-fuel', 'grass'); await weigh(p);
    const st1 = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(st1.burn.weighed && st1.burn.weighed.fuel === 'grass' && st1.burn.weighed.n === 1 && st1.burn.current === null && !('tempBefore' in st1.burn), 'the before weighing is stored (fuel and sample number only; the numbers are recomputed)');
    const labW = await label(p);
    T.ok(tempIn(labW) === model.tb && new RegExp('the balance read ' + model.mb + ' grams').test(labW) && /aimed at the fuel, through the dome glass/.test(labW) && /\(before the burn\)/.test(labW) && !/aimed at the dome glass/.test(labW), 'before: the picture says the balance read ' + model.mb + ' g and the laser reads ' + model.tb + ' °C');
    const lb = await laser(p);
    T.ok(lb && lb.target === 'fuel' && dotInArea(lb), 'before: the laser dot lies inside the drawn fuel sample (' + JSON.stringify(lb) + ')');
    const rw = (await p.locator('.bn-read').first().innerText()).replace(/\n/g, ' ');
    T.ok(rw.includes(model.mb + ' g') && rw.includes(model.tb + ' °C'), 'readouts equal the model at the first weighing');
    T.ok(await p.locator('[data-bn="burn"]').isEnabled() && await p.locator('[data-bn="weigh"]').isDisabled(), 'after the before reading, Burn is enabled and the weigh button is done');
    await p.reload(); await p.waitForFunction(() => window.B2Burn && document.querySelector('#burn-scene').dataset.mounted === '1'); await go(p, 'burn');
    T.ok(await p.locator('[data-bn="burn"]').isEnabled() && tempIn(await label(p)) === model.tb, 'the before reading survives a reload');
    await p.selectOption('#bn-fuel', 'peat');
    T.ok(await p.locator('[data-bn="burn"]').isDisabled() && /not weighed yet/.test(await label(p)), 'another fuel is not weighed yet; its Burn is off');
    await p.selectOption('#bn-fuel', 'grass');

    // ----- burn: no live reading, the laser is put down
    await p.locator('[data-bn="burn"]').click();
    const st = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(st.burn.current && st.burn.current.fuel === 'grass' && st.burn.current.n === 1 && typeof st.burn.current.startedAt === 'number' && st.burn.current.skipped === false && !st.burn.current.after && !st.burn.weighed && !('tempAfter' in st.burn), 'a start timestamp is saved, no numbers are stored');
    await p.waitForTimeout(1800);
    T.ok(/Burning|lit/.test(await p.locator('[data-bn="stage"]').innerText()) && /Burn time \d+ s/.test(await p.locator('[data-bn="clock"]').innerText()), 'clock and stage show while it runs');
    T.ok(/laser thermometer is put down while it burns/.test(await p.locator('.bn-clock').innerText()), 'the panel says the laser is put down while it burns');
    T.ok(await laser(p) === null, 'no laser beam or dot while it burns');
    const mid = await label(p);
    T.ok(/half-sphere glass bowl, upside down \(the dome\), over burning dried grass/.test(mid) && /grams/.test(mid) && /BTB in the dish inside the dome/.test(mid) && /put down on the bench and the balance shows no reading/.test(mid) && tempIn(mid) === null && !/flask/i.test(mid), 'during the burn: no live temperature, the laser is put down, the balance shows no reading: ' + mid.slice(0, 110));
    T.ok(await p.locator('[data-bn="weigh"]').count() === 0 && await p.locator('[data-bn="after"]').count() === 0, 'no weighing buttons while it burns');
    const during = await p.evaluate(() => B2Burn.logic.stateAt(B2Burn.logic.burnResult(B2Burn.getState().burn.seed, 'grass', 1), 1).temp);
    T.ok(Number.isFinite(during) && !/degrees Celsius/.test(await p.locator('#burn-desc').innerText()), 'the text description has no temperature reading mid-burn');
    // reload in the middle: the clock continues from the timestamp
    const before = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).burn.current.startedAt, KEY);
    await p.reload(); await p.waitForFunction(() => window.B2Burn && document.querySelector('#burn-scene').dataset.mounted === '1'); await go(p, 'burn');
    const after0 = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).burn.current.startedAt, KEY);
    T.ok(before === after0, 'a reload keeps the same start timestamp');

    // ----- finished, dome still down: the after reading is available only now
    if (await p.locator('[data-bn="skip"]').count()) await p.locator('[data-bn="skip"]').click();
    T.ok(await p.locator('[data-bn="after"]').isVisible() && await p.locator('[data-bn="record"]').count() === 0 && await p.locator('[data-bn="burn"]').count() === 0, 'finished: Lift the dome, weigh and read temperature (after) is offered; Record and Burn are not yet');
    const labF = await label(p);
    T.ok(/still over the ash/.test(labF) && /rests on the bench until you weigh again/.test(labF) && tempIn(labF) === null && !/flask/i.test(labF), 'finished, before the second weighing: the dome is still down, no temperature reading');
    const rf = (await p.locator('.bn-read').first().innerText()).replace(/\n/g, ' ');
    T.ok(/not read yet/.test(rf) && /not weighed yet/.test(rf), 'the instruments show "not read yet" until the second weighing');
    // ----- AFTER: lift the dome, weigh and read
    await p.locator('[data-bn="after"]').click();
    const stA = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(stA.burn.current && stA.burn.current.after === true, 'the after weighing is stored');
    const labA = await label(p);
    T.ok(/lifted off the cooled dried grass/.test(labA) && tempIn(labA) === model.ta && new RegExp('which reads ' + model.ma + ' grams').test(labA) && /aimed at the ash reads/.test(labA) && /\(after the burn\)/.test(labA) && !/dome glass reads/.test(labA) && tempIn(labA) > tempIn(labW), 'after: the dome is lifted, the ash on the balance reads ' + model.ma + ' g and the laser reads ' + model.ta + ' °C (above the before reading ' + model.tb + ')');
    const la = await laser(p);
    T.ok(la && la.target === 'ash' && dotInArea(la), 'after: the laser dot lies inside the drawn ash on the balance (' + JSON.stringify(la) + ')');
    T.ok(!/dome glass/i.test(await p.locator('#burn-scene').innerText()) || /inside the dome|Glass dome/.test(await p.locator('#burn-scene').innerText()), 'the panels never say the reading is of the dome glass');
    const ra = (await p.locator('.bn-read').first().innerText()).replace(/\n/g, ' ');
    T.ok(ra.includes(model.tb + ' → ' + model.ta + ' °C') && ra.includes(model.mb + ' → ' + model.ma + ' g'), 'readouts show both weighings and equal the model');
    T.ok(await p.locator('[data-bn="record"]').isVisible() && /both weighings/.test(await p.locator('[data-bn="record"]').innerText()), 'Record results (both weighings) is offered');
    await p.reload(); await p.waitForFunction(() => window.B2Burn && document.querySelector('#burn-scene').dataset.mounted === '1'); await go(p, 'burn');
    T.ok(await p.locator('[data-bn="record"]').isVisible() && tempIn(await label(p)) === model.ta, 'the after reading survives a reload');
    c = await ink(p); T.ok(c.ink > 0.01, 'canvas drawn when finished');
    T.ok(await p.locator('fieldset.bn-obs .bn-chip', { hasText: 'Droplets on the glass' }).count() === 1, 'a Droplets on the glass chip is offered');
    await p.locator('.bn-chip', { hasText: 'Bright flame' }).click(); await p.locator('.bn-chip', { hasText: 'Smoke' }).click();
    T.ok(await p.locator('fieldset.bn-obs .bn-chip[aria-pressed="true"]').count() === 2, 'observation chips toggle with a ✓ and aria-pressed');
    await p.locator('[data-bn="record"]').click();
    const r1 = await p.evaluate(() => { const s = B2Burn.getState().burn; return B2Burn.logic.burnResult(s.seed, 'grass', 1); });
    const row = await p.locator('.bn-table tbody tr').first().innerText();
    T.ok(row.includes('Dried grass (1)') && row.includes(String(r1.igniteS)) && row.includes(r1.btbLabelAfter + ' (' + r1.btbAfter.toFixed(1) + ')') && row.includes(r1.tempBefore + ' → ' + r1.tempAfter) && row.includes(r1.massBefore.toFixed(1) + ' → ' + r1.massAfter.toFixed(1)) && /Bright flame, Smoke/.test(row), 'the table row holds both weighings (temperature and mass before → after) and the chips: ' + row.replace(/\s+/g, ' '));
    await p.waitForTimeout(150);
    T.ok(/Recorded dried grass/.test(await p.locator('#announcer').innerText()), 'recording is announced');
    T.ok(await p.locator('.bn-table tbody tr').count() === 1 && /1 sample recorded/.test(await p.locator('.bn-table caption').innerText()), 'caption counts samples (singular)');
    const stR = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(stR.burn.current === null && !stR.burn.weighed, 'after recording, nothing is left over: the next sample must be weighed again');

    // ----- a second sample of the same fuel differs; three at most
    await p.selectOption('#bn-fuel', 'grass');
    T.ok(/Sample 2 of dried grass/.test(await p.locator('.bn-read').first().innerText()), 'next sample is sample 2');
    for (let i = 0; i < 2; i++) { await weigh(p); await p.locator('[data-bn="burn"]').click(); await finishAndRecord(p); }
    T.ok(await p.locator('.bn-table tbody tr').count() === 3 && await p.locator('[data-bn="burn"]').isDisabled() && await p.locator('[data-bn="weigh"]').isDisabled(), 'three grass samples recorded, the fourth is not allowed');
    const rows = await p.evaluate(() => B2Burn.logic.tableRows(B2Burn.getState().burn));
    T.ok(new Set(rows.map(r => r.igniteS + ':' + r.burnS + ':' + r.massAfter + ':' + r.btbAfter)).size >= 2, 'samples of the same fuel differ a little');
    T.ok(/burned 3 of 3/.test(await p.locator('#bn-fuel option:checked').innerText()), 'the dropdown shows how many samples are used');

    // ----- all five fuels: chart bars match the table; a missing fuel has no bar
    await burnFuel(p, 'peat');
    const chartTitles = await p.evaluate(() => Array.from(document.querySelectorAll('#burn-scene .bn-chart svg title')).map(t => t.textContent));
    T.ok(chartTitles.some(t => /Grass|Sample 1/.test(t)) && chartTitles.some(t => /Peat/.test(t)) && !chartTitles.some(t => /Charcoal/.test(t)), 'chart has bars for grass and peat only: ' + chartTitles.slice(0, 5).join(' | '));
    await p.locator('.bn-chip', { hasText: 'Mass lost' }).click();
    T.ok(await p.locator('.bn-chip[aria-pressed="true"]').innerText().then(t => /Mass lost/.test(t)), 'chart metric chips switch');
    const axis = await p.locator('#burn-scene .bn-chart svg[role=img]').textContent();
    T.ok(/Mass lost \(g, simulated\)/.test(axis) && /Fuel/.test(axis), 'chart axis titles carry units and "simulated"');
    T.ok(/Sample 1/.test(await p.locator('#burn-scene .bn-chart').innerText()) && /Sample 3/.test(await p.locator('#burn-scene .bn-chart').innerText()), 'chart legend names the samples');
    for (const f of ['leaves', 'wood', 'charcoal']) await burnFuel(p, f);
    const finalRows = await p.evaluate(() => B2Burn.logic.tableRows(B2Burn.getState().burn));
    T.ok(finalRows.length === 7 && finalRows.every(r => r.massAfter < r.massBefore && r.tempAfter >= r.tempBefore && r.btbAfter > r.btbBefore), 'all recorded samples are physically possible');
    T.ok(await p.evaluate(() => B2Burn.logic.byFuel(B2Burn.logic.tableRows(B2Burn.getState().burn)).length) === 5, 'five fuels in the summary');

    // ----- Start over; mid-burn pictures differ by fuel
    await p.locator('[data-bn="reset"]').click(); await p.locator('[data-bn="reset-yes"]').click();
    T.ok(await p.evaluate(k => localStorage.getItem(k), KEY).then(v => !v || !JSON.parse(v).burn), 'Start over erases the burns');
    T.ok(await p.locator('.bn-table tbody tr').count() === 1 && /Burn a fuel and record it/.test(await p.locator('.bn-table tbody').innerText()), 'table is empty again');
    const picture = async fuel => {
      await p.selectOption('#bn-fuel', fuel); await weigh(p); await p.locator('[data-bn="burn"]').click();
      await p.evaluate(() => { const s = B2Burn.getState().burn, L = B2Burn.logic, r = L.burnResult(s.seed, s.current.fuel, s.current.n); s.current.startedAt = Date.now() - (r.igniteS + r.burnS * 0.4) / L.RATE * 1000; B2Burn.saveState('burn', s); });
      await p.reload(); await p.waitForFunction(() => document.querySelector('#burn-scene').dataset.mounted === '1'); await go(p, 'burn'); await p.waitForTimeout(150);
      const lab = await label(p), i = await ink(p); await finishAndRecord(p); return { lab, i };
    };
    const peat = await picture('peat'), char = await picture('charcoal'), grass = await picture('grass');
    T.ok(/\(the dome\), over burning peat/.test(peat.lab) && /lots of smoke/.test(peat.lab) && /a glowing ember/.test(peat.lab) && /a small flame/.test(peat.lab), 'peat picture: dome, smoke, ember, small flame (' + peat.lab.slice(60, 200) + ')');
    T.ok(/ (no flame|a small flame)/.test(char.lab) && !/ (lots of|a little) smoke/.test(char.lab) && /glowing ember/.test(char.lab), 'charcoal picture: glow, no smoke');
    T.ok(/a bright flame/.test(grass.lab) && !/glowing ember/.test(grass.lab), 'grass picture: bright flame');
    T.ok([peat, char, grass].every(x => tempIn(x.lab) === null && /put down on the bench/.test(x.lab)), 'no live temperature mid-burn for any fuel: the laser is put down');
    T.ok(/Droplets of water have formed on the inside of the dome/.test(peat.lab) && /Droplets of water have formed on the inside of the dome/.test(grass.lab) && /Carbon dioxide is collecting under the dome/.test(peat.lab), 'droplets inside the dome and carbon dioxide under it are in the picture description when made');
    T.ok([peat, char, grass].every(x => x.i.ink > 0.01), 'mid-burn canvases are drawn');
    await p.selectOption('#bn-fuel', 'peat'); await weigh(p);
    const peatReady = await p.evaluate(() => { const r = B2Burn.logic.burnResult(B2Burn.seed('burn'), 'peat', 2); return r.massBefore.toFixed(1); });
    T.ok(/^(29\.[89]|30\.[01])$/.test(peatReady) && (await p.locator('.bn-read').first().innerText()).replace(/\n/g, ' ').includes(peatReady + ' g'), 'peat is a 30 g handful on the balance (' + peatReady + ' g); the others are not 10 g');
    T.ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
    await ctx.close();

    // reduced motion: the burn is shown finished at once; the second weighing is still the student's step
    const rctx = await T.ctxFor(browser, { width: 1366, height: 900, reduced: true });
    const q = await rctx.newPage(); await stub(q);
    await q.goto(server.url + PAGE); await q.waitForFunction(() => document.querySelector('#burn-scene').dataset.mounted === '1'); await go(q, 'burn');
    await q.selectOption('#bn-fuel', 'peat'); await weigh(q); await q.locator('[data-bn="burn"]').click(); await q.waitForTimeout(150);
    T.ok(await q.locator('[data-bn="after"]').isVisible() && await q.locator('[data-bn="skip"]').count() === 0, 'reduced motion: the finished burn is shown at once, with the after weighing to do');
    T.ok(/Reduced motion is on/.test(await q.locator('#announcer').innerText()), 'reduced motion is announced');
    T.ok(/Only ash is left, still under the dome/.test(await label(q)), 'final state looks complete (the ash, the dome still down)');
    await q.locator('[data-bn="after"]').click();
    T.ok(/lifted off the cooled peat/.test(await label(q)) && tempIn(await label(q)) !== null, 'after the second weighing the dome is lifted and the laser reads');
    await rctx.close();
  } finally { await browser.close(); server.close(); }
  T.done('t107-b2-burn-scene');
})().catch(e => { console.error(e); process.exit(1); });
