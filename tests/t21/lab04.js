module.exports = async ({ b, ok, ctxAs, open, keyres, ownText, frqChecks, frqReload }) => {
  const L = 'lab04';
  const field = async p => { await p.evaluate(() => Lab.pages.go('plasmolysis')); await p.waitForTimeout(600); return p.evaluate(() => { const c = document.getElementById('p3a-viz'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; }); };
  const c1 = await ctxAs(b, 'Ada Lovelace', '3'), c2 = await ctxAs(b, 'Grace Hopper', '3');
  const p = await open(c1, 'lab04.html'), p2 = await open(c2, 'lab04.html');
  const f1 = await field(p), f2 = await field(p2);
  ok(f1 !== f2, 'two students get different plasmolysis cell fields (canvas hash ' + f1 + ' vs ' + f2 + ')');
  const pb = await open(c1, 'lab04.html');
  ok((await field(pb)) === f1, 'same student gets the same cell field after reload');
  await p2.close(); await pb.close();
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(300);
  ok(/Finish Water potential/.test(await ownText(p, 'own-core')), 'own-core waits for data');
  ok(/Finish Plasmolysis/.test(await ownText(p, 'own-plasmo')), 'own-plasmo waits for data');
  await p.evaluate(() => ['predict-soak', 'predict-plasmo'].forEach(k => { const t = document.getElementById('p-' + k); t.value = 'I predict cells shrink in strong sucrose.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }));
  // plasmolysis: three solutions, record, type counts
  await p.evaluate(() => Lab.pages.go('plasmolysis')); await p.waitForTimeout(400);
  for (const sol of ['w', 's2', 's4', 's6', 's10']) {
    await p.selectOption('#p3a-sol', sol); await p.click('#p3a-run'); await p.waitForTimeout(1200);
    await p.evaluate(() => { document.getElementById('p3a-rec').click(); }); await p.waitForTimeout(200);
  }
  const counts = [0, 2, 8, 16, 28];
  await p.evaluate(counts => counts.forEach((v, i) => { const inp = document.querySelector('#p3a-table input[data-k=plz][data-r="' + i + '"]'); inp.value = String(v); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }), counts);
  await p.waitForTimeout(300);
  // cores
  await p.evaluate(() => Lab.pages.go('water-potential')); await p.waitForTimeout(400);
  await p.click('#p3b-run'); await p.waitForTimeout(4000);
  await p.evaluate(() => document.getElementById('p3b-reveal').click()); await p.waitForTimeout(500);
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(2200);
  const o1 = await ownText(p, 'own-core'), o2 = await ownText(p, 'own-plasmo');
  ok(/core in \d\.\d M sucrose/.test(o1) && /%/.test(o1), 'own-core quotes real data: ' + o1.slice(0, 140));
  ok(/of \d+ cells \(\d+%\)/.test(o2), 'own-plasmo quotes real data: ' + o2.slice(0, 140));
  const k1 = await keyres(p, L, 'isotonic-point'), k2 = await keyres(p, L, 'psi-tissue'), k3 = await keyres(p, L, 'incipient-psi');
  ok(k1 && k1.value > 0.1 && k1.value < 0.8 && k1.unit === 'M', 'isotonic-point stored in a realistic range ' + JSON.stringify(k1));
  ok(k2 && k2.value < 0, 'psi-tissue stored ' + JSON.stringify(k2));
  ok(k3 && k3.value < 0, 'incipient-psi stored ' + JSON.stringify(k3));
  await frqChecks(p, L);
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(2200);
  const o1b = await ownText(p, 'own-core'); ok(/core in \d\.\d M sucrose/.test(o1b), 'personal prompt quotes values after reload: ' + o1b.slice(0, 90));
  ok((await keyres(p, L, 'isotonic-point')).value === k1.value, 'key results survive reload');
  await frqReload(p, L);
  await c1.close(); await c2.close();
};
