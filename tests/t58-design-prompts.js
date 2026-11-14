/* Audit 5, item 5: the experimental-design prompts added to labs 1-4 and 7-13 exist, keep their answers after a reload,
   and reach the exported .docx report (prompts are collected automatically).
   Run: NODE_PATH=$(npm root -g) node tests/t58-design-prompts.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
const JSZip = require('./fixtures/jszip-3.10.1.min.js');
const ADDED = {
  lab01: ['d-why-const'], lab02: ['dz-why-graph'], lab03: ['d-why-same'], lab04: ['d-why-const'], lab07: ['d-why-graph'],
  lab08: ['d-vars-dv', 'a-design-var'], lab09: ['e-followup'], lab10: ['d-why-const'], lab11: ['d-why-const'], lab12: ['d-dv-why'], lab13: ['d-why-const']
};
(async () => {
  const b = await launch();
  for (const [lab, keys] of Object.entries(ADDED)) {
    const ctx = await ctxFor(b, { reduced: true }), p = await open(ctx, lab + '.html');
    const answers = {};
    for (const k of keys) {
      answers[k] = `Answer for ${k} in ${lab}: 42 zebras`;
      const found = await p.evaluate(([k, v]) => {
        const t = document.getElementById('p-' + k); if (!t) return false;
        t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); return true;
      }, [k, answers[k]]);
      ok(found, `${lab}: prompt ${k} exists`);
    }
    await p.waitForTimeout(600);
    await p.reload(); await p.waitForTimeout(1200);
    for (const k of keys) {
      const v = await p.evaluate(k => { const t = document.getElementById('p-' + k); return t ? t.value : null; }, k);
      ok(v === answers[k], `${lab}: ${k} keeps its answer after reload`);
    }
    const b64 = await p.evaluate(async () => { const blob = await Lab.report.docx(); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); });
    const zip = await JSZip.loadAsync(Buffer.from(b64, 'base64'));
    const txt = (await zip.file('word/document.xml').async('string')).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
    for (const k of keys) ok(txt.includes(answers[k]), `${lab}: ${k} answer appears in the .docx`);
    ok(p.errors.length === 0, `${lab}: no page errors ${p.errors.join('|')}`);
    await ctx.close();
  }
  await b.close(); done('t58-design-prompts');
})();
