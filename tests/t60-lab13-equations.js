/* Lab 13 reaction equations (audit 5 re-audit, item 2). Every formula equation on the page must be atom-balanced; the word
   summary must be labeled "not balanced"; the page says "tetraguaiacol" is the textbook name for a mix of oxidation products.
   Guaiacol is C7H8O2 and textbook tetraguaiacol is C28H24O8. The test parses the rendered equations with its own formula parser.
   Run: NODE_PATH=$(npm root -g) node tests/t60-lab13-equations.js */
const { ok, done, launch, ctxFor, open } = require('./_h');

/* "C28H24O8" -> {C:28,H:24,O:8} */
function atoms(formula) {
  const out = {}, re = /([A-Z][a-z]?)(\d*)/g; let m;
  while ((m = re.exec(formula))) if (m[1]) out[m[1]] = (out[m[1]] || 0) + (m[2] ? +m[2] : 1);
  return out;
}
/* "4 C7H8O2 (guaiacol) + 4 H2O2" -> summed atom counts; names in parentheses are ignored */
function side(s) {
  const tot = {};
  s.replace(/\([^)]*\)/g, ' ').split(/\s\+\s/).forEach(term => {
    const m = term.trim().match(/^(\d+)?\s*([A-Z][A-Za-z0-9]*)$/);
    if (!m) throw new Error('cannot parse term "' + term + '"');
    const k = m[1] ? +m[1] : 1, a = atoms(m[2]);
    for (const el in a) tot[el] = (tot[el] || 0) + k * a[el];
  });
  return tot;
}
const same = (a, b) => JSON.stringify(Object.keys(a).sort().map(k => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map(k => [k, b[k]]));

(async () => {
  /* the parser itself */
  ok(same(atoms('C7H8O2'), { C: 7, H: 8, O: 2 }) && same(atoms('H2O2'), { H: 2, O: 2 }), 'parser reads C7H8O2 and H2O2');
  ok(!same(side('2 H2O2'), side('2 H2O + 2 O2')), 'parser catches an unbalanced equation');

  const b = await launch(), ctx = await ctxFor(b, { reduced: true });
  await ctx.route(/gc\.zgo\.at/, r => r.abort());
  const p = await open(ctx, 'lab13.html');
  const r = await p.evaluate(() => {
    document.querySelectorAll('details').forEach(d => { d.open = true; });
    const flat = s => s.replace(/\s+/g, ' ').trim();
    return {
      eqs: Array.from(document.querySelectorAll('#background .equation')).map(e => ({ cls: e.className, t: flat(e.textContent) })),
      bg: flat(document.getElementById('background').textContent),
      gloss: flat(document.querySelector('.glossary').textContent),
      quiz: flat(document.getElementById('prelab').textContent)
    };
  });
  const rx = r.eqs.filter(e => /guaiacol/i.test(e.t));
  ok(rx.length === 2, 'two reaction equations in Background: ' + rx.map(e => e.t).join(' || '));
  const words = rx.find(e => /eq-words/.test(e.cls)), bal = rx.find(e => /eq-balanced/.test(e.cls));
  ok(words && /not balanced/i.test(words.t) && !/\d\s*H2O2|[A-Z]\d/.test(words.t.replace(/^.*?:/, '')), 'word summary is labeled "not balanced" and has no formulas: ' + (words && words.t));
  /* every equation written with formulas must balance */
  rx.filter(e => /[A-Z][a-z]?\d/.test(e.t)).forEach(e => {
    const [l, rr] = e.t.split(/\s*—\s*peroxidase\s*→\s*|\s*→\s*/);
    let L, R; try { L = side(l); R = side(rr); } catch (err) { ok(false, err.message); return; }
    ok(same(L, R), 'atom-balanced: ' + e.t + '  [' + JSON.stringify(L) + ' vs ' + JSON.stringify(R) + ']');
  });
  ok(bal && /4 C7H8O2/.test(bal.t) && /4 H2O2/.test(bal.t) && /C28H24O8/.test(bal.t) && /8 H2O$/.test(bal.t), 'balanced form uses C7H8O2 and C28H24O8');
  ok(same(side('4 C7H8O2 + 4 H2O2'), { C: 28, H: 40, O: 16 }), 'hand check: left side is C28 H40 O16');
  ok(/traditional textbook name/i.test(r.bg) && /mixture of guaiacol oxidation products/i.test(r.bg) && /3,3′-dimethoxy-4,4′-biphenoquinone/.test(r.bg) && /simplified model/i.test(r.bg), 'honest note: textbook name, mixture of products, biphenoquinone, simplified model');
  ok(/textbook model calls them tetraguaiacol/.test(r.gloss), 'glossary matches the model note');
  ok(/textbook name: tetraguaiacol; really a mix of guaiacol oxidation products/.test(require('fs').readFileSync(require('path').join(require('./_h').ROOT, 'lab13.html'), 'utf8')), 'pre-lab explanation carries the same model note');
  ok(!/2 H2O2 → 2 H2O \+ O2/.test(r.bg), 'no catalase equation in the peroxidase background');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t60-lab13-equations');
})();
