/* Lab 13: timed assays (Procedure 1, pH, design) keep running by the clock across a reload and finish; method and design
   settings persist; results panels open on Data; pH axes are 2-12; no "(no units)" anywhere. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'lab13.html', 'procedure-1');
  const say = async id => p.evaluate(i => { const t = document.querySelector('#p-' + i); t.value = 'because'; t.dispatchEvent(new Event('input', { bubbles: true })); }, id);
  T.ok(await p.evaluate(() => !/\(no units\)/.test(document.body.innerText) && !/no units/.test(document.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g, ''))), 'no "(no units)" on the page');
  await say('predict-assay');
  T.ok(await p.evaluate(() => document.querySelector('#p1-sim-tab-data').getAttribute('aria-selected') === 'true'), 'Procedure 1 results open on Data');
  // fastest clock so the test is short: 120x if present else default
  await p.evaluate(() => { const b = [...document.querySelectorAll('#sp1 button')].pop(); b.click(); });
  const speed = await p.evaluate(() => +document.querySelector('#sp1 button[aria-pressed="true"]').dataset.v);
  await p.click('#p1-run'); await p.waitForTimeout(1500);
  const t1 = await p.evaluate(() => document.querySelector('#p1-time').textContent);
  await p.reload(); await p.waitForTimeout(900);
  const st = await p.evaluate(() => ({ time: document.querySelector('#p1-time').textContent, status: document.querySelector('#p1-status').textContent, sp: document.querySelector('#sp1 button[aria-pressed="true"]').dataset.v }));
  T.ok(String(speed) === st.sp, 'clock speed remembered (' + st.sp + 'x)');
  T.ok(/running|done/i.test(st.status), 'trial running after reload: ' + st.status + ' (' + st.time + ', was ' + t1 + ')');
  await p.waitForFunction(() => (Lab.store.get('p1') || []).length >= 6, null, { timeout: 60000 });
  T.ok(true, 'trial finished and recorded 6 readings');
  await p.reload(); await p.waitForTimeout(800);
  T.ok(await p.evaluate(() => document.querySelector('#p1-trial').textContent === '1'), 'trial number restored after finish');
  // run left closed: back-date the start so it ended while the page was closed
  await say('predict-assay');
  await p.click('#p1-run'); await p.waitForTimeout(400);
  await p.evaluate(() => { const k = Object.keys(localStorage).find(k => /p1-run$/.test(k)); const v = JSON.parse(localStorage[k]); v.t0 -= 10 * 60 * 1000; localStorage[k] = JSON.stringify(v); });
  await p.reload(); await p.waitForTimeout(1500);
  T.ok(await p.evaluate(() => (Lab.store.get('p1') || []).length >= 12 && !Lab.store.get('p1-run')), 'a trial that ended while closed is recorded');
  // pH
  await p.evaluate(() => Lab.pages.go('procedure-2-ph')); await p.waitForTimeout(400);
  await say('p2-pred');
  T.ok(await p.evaluate(() => document.querySelector('#p2-sim-tab-data').getAttribute('aria-selected') === 'true'), 'pH results open on Data');
  await p.evaluate(() => { const c = document.querySelector('#ph-10'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.click('#p2-run'); await p.waitForTimeout(800);
  await p.reload(); await p.waitForTimeout(900);
  await p.evaluate(() => Lab.pages.go('procedure-2-ph')); await p.waitForTimeout(400);
  T.ok(await p.evaluate(() => !document.querySelector('#ph-10').checked), 'buffer choices remembered');
  await p.waitForFunction(() => (Lab.store.get('p2') || []).length >= 5, null, { timeout: 40000 });
  T.ok(true, 'pH trial recorded after reload (5 buffers)');
  const ax = await p.evaluate(() => { const t = [...document.querySelectorAll('#p2-chart svg text')].map(e => e.textContent); return t.join(' '); });
  T.ok(/\b12\b/.test(ax) && !/\b15\b/.test(ax), 'pH axis runs to 12, not 15: ' + ax.slice(0, 80));
  // design
  await p.evaluate(() => Lab.pages.go('design')); await p.waitForTimeout(400);
  await say('d-h');
  await p.evaluate(() => { const s = document.querySelector('#d-iv'); s.value = 'ph'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.click('#d-run'); await p.waitForTimeout(1500);
  await p.reload(); await p.waitForTimeout(900);
  await p.waitForFunction(() => !!Lab.store.get('d-res'), null, { timeout: 20000 });
  T.ok(true, 'design run finished after reload');
  await p.evaluate(() => Lab.pages.go('design')); await p.waitForTimeout(500);
  const dax = await p.evaluate(() => [...document.querySelectorAll('#d-chart2 svg text')].map(e => e.textContent).join(' '));
  T.ok(/\b12\b/.test(dax) && !/(^| )15( |$)/.test(dax), 'design pH axis 2-12: ' + dax.slice(0, 90));
  T.ok(await p.evaluate(() => document.querySelectorAll('#d-read .readout').length > 0), 'design readouts restored');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab13');
})();
