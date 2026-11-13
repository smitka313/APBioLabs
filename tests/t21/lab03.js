module.exports = async ({ b, ok, ctxAs, open, keyres, ownText, frqChecks, frqReload }) => {
  const L = 'lab03';
  const seqs = p => p.evaluate(() => ['A', 'B', 'C'].map(g => db.fossil[g].slice(0, 400) + '|' + db.human[g] + '|' + db.chicken[g]).join('#'));
  const c1 = await ctxAs(b, 'Ada Lovelace', '3'), c2 = await ctxAs(b, 'Grace Hopper', '3');
  const p = await open(c1, 'lab03.html'), p2 = await open(c2, 'lab03.html');
  const a1 = await seqs(p), a2 = await seqs(p2);
  ok(a1 !== a2, 'two students get different BLAST sequences');
  const diff = await p.evaluate(() => { const base = buildDB(); let n = 0; ['A', 'B', 'C'].forEach(g => Object.keys(base).forEach(id => { for (let i = 0; i < base[id][g].length; i++) if (base[id][g][i] !== db[id][g][i]) n++; })); return n; });
  ok(diff > 40 && diff < 200, 'student sequences differ from the base database by a few bases each (' + diff + ' total changes over 57 sequences)');
  // science preserved: ranking of groups for each gene across many seeds
  const rob = await p.evaluate(() => {
    const chk = d => { const out = []; ['A', 'B', 'C'].forEach(g => { const hits = blast(d.fossil[g], ORG_IDS.map(id => ({ id, gene: g, seq: d[id][g] })), 'blastn'); const bird = Math.max(...hits.filter(h => ORGS[h.id][2] === 'Birds').map(h => h.ident)), other = Math.max(...hits.filter(h => ORGS[h.id][2] !== 'Birds').map(h => h.ident)); out.push({ g, topBird: ORGS[hits[0].id][2] === 'Birds', margin: bird - other }); }); return out; };
    const base = chk(buildDB()); let good = 0, N = 25, minM = 99;
    for (let s = 1; s <= N; s++) { const r = chk(personalizeDB(buildDB(), s * 7919 + 13)); if (r.every(x => x.topBird)) good++; r.forEach(x => { minM = Math.min(minM, x.margin); }); }
    return { base, good, N, minM };
  });
  ok(rob.good === rob.N && rob.minM > 2, 'Birds stay the top hit for every gene in ' + rob.N + ' random seeds; smallest bird margin ' + rob.minM.toFixed(1) + ' points (base ' + rob.base.map(x => x.margin.toFixed(1)).join('/') + ')');
  await p.reload(); await p.waitForTimeout(900);
  ok((await seqs(p)) === a1, 'same student gets identical sequences after reload');
  await p2.close();

  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(300);
  ok(/Finish BLAST the genes/.test(await ownText(p, 'own-identity')), 'own-identity waits for data');
  ok(/Finish Design/.test(await ownText(p, 'own-clock')), 'own-clock waits for data');
  await p.evaluate(() => ['predict-blast', 'predict-design'].forEach(k => { const t = document.getElementById('p-' + k); t.value = 'I predict birds because similar DNA.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }));
  await p.evaluate(() => Lab.pages.go('blast-the-genes')); await p.waitForTimeout(300);
  for (const g of ['A', 'C']) { await p.selectOption('#q-gene', g); await p.click('#run-blast'); await p.waitForTimeout(800); await p.click('#log-blast'); await p.waitForTimeout(300); }
  await p.evaluate(() => Lab.pages.go('design')); await p.waitForTimeout(300);
  await p.click('#d-run'); await p.waitForTimeout(1500);
  await p.click('#d-log'); await p.waitForTimeout(800);
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(2000);
  const o1 = await ownText(p, 'own-identity'), o2 = await ownText(p, 'own-clock');
  ok(/% identity|\d%\./.test(o1) && /gene [AC]/.test(o1), 'own-identity quotes real data: ' + o1.slice(0, 130));
  ok(/Your weirdest clock point/.test(o2) && /points (above|below)/.test(o2), 'own-clock quotes real data: ' + o2.slice(0, 130));
  const ka = await keyres(p, L, 'top-ident-A'), kc = await keyres(p, L, 'top-ident-C'), ks = await keyres(p, L, 'clock-slope');
  ok(ka && ka.value > 80 && ka.unit === '%', 'top-ident-A stored ' + JSON.stringify(ka));
  ok(kc && kc.value > 50, 'top-ident-C stored');
  ok(ks && isFinite(ks.value), 'clock-slope stored ' + JSON.stringify(ks));
  await frqChecks(p, L);
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(2000);
  ok(/gene [AC]/.test(await ownText(p, 'own-identity')), 'personal prompt quotes values after reload');
  ok((await keyres(p, L, 'top-ident-A')).value === ka.value, 'key results survive reload');
  await frqReload(p, L);
  await c1.close(); await c2.close();
};
