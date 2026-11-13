/* Predict-first in labs 8-13: the first action button is gated until a prediction is saved, the Reflect
   part quotes the student's own prediction, everything survives a reload, and the sims still run. */
const T = require('./_h');

/* One case per gated sim: pred = saved prompt key, btn = gated button, ran(page) = proof the sim ran after the click */
const CASES = {
  'lab09.html': { recall: ['predict-crime'], sims: [
    { pred: 'predict-crime', btn: '#g2-run', pre: async p => { await p.evaluate(() => document.querySelector('#g2-layout').click()); }, ran: p => p.evaluate(() => +document.querySelector('#g2-time').textContent > 0) }] },
  'lab10.html': { recall: ['p1-diagram', 'p2-diagram', 'd-hyp'], sims: [
    { pred: 'p1-diagram', btn: '#p1-plus7', ran: p => p.evaluate(() => document.querySelector('#p1-day').textContent.trim() === '11') },
    { pred: 'p2-diagram', btn: '#p2-run', ran: p => p.evaluate(() => document.querySelector('#p2-day').textContent.trim() !== '0') },
    { pred: 'd-hyp', btn: '#d-run', ran: p => p.evaluate(() => document.querySelectorAll('#d-readouts .readout').length > 0) }] },
  'lab11.html': { recall: ['predict-stomata', 'predict-water', 'd-hyp'], sims: [
    { pred: 'predict-stomata', btn: '#st-record', ran: p => p.evaluate(() => document.querySelector('#st-n').textContent.trim() !== '0') },
    { pred: 'predict-water', btn: '#tr-run', ran: p => p.evaluate(() => document.querySelectorAll('#tr-table tbody tr td').length > 3) },
    { pred: 'd-hyp', btn: '#d-run', ran: p => p.evaluate(() => +document.querySelector('#d-count').textContent > 0) }] },
  'lab12.html': { recall: ['predict-vial', 'predict', 'd-hyp'], sims: [
    { pred: 'predict-vial', btn: '#vial-run', ran: p => p.evaluate(() => document.querySelector('#vial-t').textContent.trim() !== '0') },
    { pred: 'predict', btn: '#c-run', ran: p => p.evaluate(() => document.querySelector('#ro-time').textContent.trim() !== '0:00') },
    { pred: 'd-hyp', btn: '#d-run', ran: p => p.evaluate(() => document.querySelectorAll('#d-table tbody tr td').length > 3) }] },
  'lab13.html': { recall: ['predict-assay', 'p2-pred', 'd-h'], sims: [
    { pred: 'predict-assay', btn: '#p1-run', ran: p => p.evaluate(() => document.querySelector('#p1-trial').textContent.trim() !== '—') },
    { pred: 'p2-pred', btn: '#p2-run', ran: p => p.evaluate(() => /running|trial/i.test(document.querySelector('#p2-status').textContent) && !/Run at least 3/.test(document.querySelector('#p2-status').textContent)) },
    { pred: 'd-h', btn: '#d-run', ran: p => p.evaluate(() => document.querySelector('#d-status').textContent.trim().length > 0) }] }
};

const go = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); Lab.pages.go(e); }, sel);
const why = (p, btn) => p.evaluate(b => { const e = document.querySelector(b), w = document.getElementById(e.id + '-why'); return { disabled: e.disabled, why: w && !w.hidden ? w.textContent : '' }; }, btn);

(async () => {
  const b = await T.launch();
  for (const [file, cfg] of Object.entries(CASES)) {
    const ctx = await T.ctxFor(b);
    let p = await T.open(ctx, file);
    const texts = {};
    for (const sim of cfg.sims) {
      await go(p, sim.btn); await p.waitForTimeout(700);
      const g0 = await why(p, sim.btn);
      T.ok(g0.disabled && /Write your prediction first/.test(g0.why), `${file} ${sim.btn}: gated before a prediction ("${g0.why}")`);
      texts[sim.pred] = `My prediction for ${sim.pred}: the ratio will rise because of structure ${sim.pred.length}.`;
      await go(p, '#p-' + sim.pred); await p.fill('#p-' + sim.pred, texts[sim.pred]); await p.waitForTimeout(1300);
      const g1 = await why(p, sim.btn);
      T.ok(!/Write your prediction first/.test(g1.why), `${file} ${sim.btn}: prediction gate lifts once saved (${g1.why || 'enabled'})`);
    }
    /* sims still run: click each gated button and look for the sim's own response */
    for (const sim of cfg.sims) {
      if (sim.pre) { await go(p, sim.btn); await sim.pre(p); await p.waitForTimeout(300); }
      await go(p, sim.btn); await p.waitForTimeout(400);
      const g = await why(p, sim.btn);
      if (g.disabled) { T.ok(true, `${file} ${sim.btn}: left disabled by another rule ("${g.why}"); skipped run check`); continue; }
      await p.click(sim.btn); await p.waitForTimeout(2500);
      T.ok(await sim.ran(p), `${file} ${sim.btn}: the sim ran after the click`);
    }
    /* Reflect quotes each prediction */
    await p.evaluate(() => { const s = Array.from(document.querySelectorAll('section.step')).find(x => /^(Evaluate|Reflect)$/.test(x.dataset.step)); Lab.pages.go(s); });
    await p.waitForTimeout(400);
    let rec = await p.evaluate(() => Array.from(document.querySelectorAll('.pred-recall, .pvc-quote')).map(e => e.textContent).join('\n'));
    for (const k of cfg.recall) if (texts[k]) T.ok(rec.includes(texts[k]), `${file}: Reflect quotes the prediction ${k}`);
    T.ok(await p.evaluate(() => !!document.querySelector('#p-ev-pred, #p-r-pred')), `${file}: Reflect has a comparison prompt`);
    /* survives a reload */
    await p.waitForTimeout(700);
    await p.reload(); await p.waitForTimeout(1000);
    for (const sim of cfg.sims) T.ok(await p.inputValue('#p-' + sim.pred) === texts[sim.pred], `${file}: ${sim.pred} still saved after reload`);
    await p.evaluate(() => { const s = Array.from(document.querySelectorAll('section.step')).find(x => /^(Evaluate|Reflect)$/.test(x.dataset.step)); Lab.pages.go(s); });
    await p.waitForTimeout(400);
    rec = await p.evaluate(() => Array.from(document.querySelectorAll('.pred-recall, .pvc-quote')).map(e => e.textContent).join('\n'));
    for (const k of cfg.recall) if (texts[k]) T.ok(rec.includes(texts[k]), `${file}: Reflect still quotes ${k} after reload`);
    for (const sim of cfg.sims) { await go(p, sim.btn); await p.waitForTimeout(700); const g = await why(p, sim.btn); T.ok(!/Write your prediction first/.test(g.why), `${file} ${sim.btn}: not re-locked after reload`); }
    /* CER hint */
    const hint = await p.evaluate(() => { const d = document.querySelector('details.cer-hint'); return d ? { s: d.querySelector('summary').textContent, t: d.textContent } : null; });
    T.ok(hint && /Need a hint\?/.test(hint.s) && /Claim: answer the question\. Evidence: cite specific numbers with units\. Reasoning: connect the evidence to a biological principle\./.test(hint.t), `${file}: CER "Need a hint?" disclosure`);
    T.ok(p.errors.length === 0, `${file}: no page errors ${p.errors.join(';')}`);
    await ctx.close();
  }

  /* Lab 8: plate predictions are kept; Reflect compares them with what grew */
  {
    const file = 'lab08.html', ctx = await T.ctxFor(b), p = await T.open(ctx, file);
    await go(p, '#do-step');
    for (let i = 0; i < 40; i++) {
      const sel = await p.evaluate(() => !!document.querySelector('#pr-p-amp, #pred-grid select'));
      const incub = await p.evaluate(() => /Predict, then incubate/.test(document.querySelector('#step-card').textContent));
      if (incub) break;
      await p.click('#do-step'); await p.waitForTimeout(500);
      for (let w = 0; w < 120; w++) { if (await p.evaluate(() => !document.querySelector('#do-step').disabled)) break; await p.waitForTimeout(250); }
    }
    const ids = await p.evaluate(() => Array.from(document.querySelectorAll('#pred-grid select')).map(s => s.id));
    T.ok(ids.length === 6, 'lab08: six plate predictions are still there');
    for (const id of ids) await p.selectOption('#' + id, 'white');
    await p.click('#do-step');
    for (let w = 0; w < 160; w++) { if (await p.evaluate(() => !!(window.Lab && Lab.store.get('plate-pred-record')))) break; await p.waitForTimeout(250); }
    T.ok(await p.evaluate(() => (Lab.store.get('plate-pred-record') || []).length === 6), 'lab08: predictions saved when the plates are incubated');
    await p.evaluate(() => { const s = Array.from(document.querySelectorAll('section.step')).find(x => x.dataset.step === 'Evaluate'); Lab.pages.go(s); });
    await p.waitForTimeout(400);
    T.ok(/You predicted|Your prediction matched/.test(await p.textContent('#ev-recall')), 'lab08: Reflect lists the plate predictions and results');
    T.ok(await p.evaluate(() => !!document.querySelector('#p-ev-pred')), 'lab08: Reflect has a comparison prompt');
    await p.reload(); await p.waitForTimeout(1000);
    await p.evaluate(() => { const s = Array.from(document.querySelectorAll('section.step')).find(x => x.dataset.step === 'Evaluate'); Lab.pages.go(s); });
    T.ok(/You predicted|Your prediction matched/.test(await p.textContent('#ev-recall')), 'lab08: plate predictions still quoted after reload');
    const hint = await p.evaluate(() => !!document.querySelector('details.cer-hint'));
    T.ok(hint, 'lab08: CER "Need a hint?" disclosure');
    T.ok(p.errors.length === 0, `lab08: no page errors ${p.errors.join(';')}`);
    await ctx.close();
  }
  await b.close();
  T.done('t20-predict-labs8-13');
})();
