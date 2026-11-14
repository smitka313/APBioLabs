/* Lab 13 chemistry and rate wording (audit 5, items 1-2): peroxidase uses H2O2 to oxidize guaiacol; no "oxygen released" turns it brown,
   the assay equation is not 2 H2O2 -> 2 H2O + O2, and "absolute rate" is now an absorbance-based rate (ΔA470/min) with a Beer-Lambert note.
   Run: NODE_PATH=$(npm root -g) node tests/t58-lab13-guaiacol.js */
const { ok, done, launch, ctxFor, open, ROOT } = require('./_h');
const fs = require('fs'), path = require('path');
(async () => {
  const src = fs.readFileSync(path.join(ROOT, 'lab13.html'), 'utf8');
  ok(!/oxygen released/i.test(src), 'source has no "oxygen released"');
  ok(!/absolute rate|<em>absolute<\/em>|\(absolute\)/i.test(src), 'source has no "absolute rate"');
  ok(!/2 H<sub>2<\/sub>O<sub>2<\/sub>[^\n]*peroxidase[^\n]*2 H<sub>2<\/sub>O \+ O<sub>2<\/sub>/.test(src), 'assay equation is not 2 H2O2 -> 2 H2O + O2');
  const b = await launch(), ctx = await ctxFor(b, { reduced: true }), p = await open(ctx, 'lab13.html');
  const r = await p.evaluate(() => {
    document.querySelectorAll('details').forEach(d => { d.open = true; });
    const flat = s => s.replace(/\s+/g, ' ');
    return {
      t: flat(document.body.textContent),
      eq: Array.from(document.querySelectorAll('.equation')).map(e => flat(e.textContent)),
      quiz: flat(document.getElementById('prelab').textContent),
      pal: (document.querySelector('label[for="p-a-palette"]') || {}).textContent || ''
    };
  });
  ok(!/oxygen released/i.test(r.t) && !/absolute rate/i.test(r.t), 'rendered page has no "oxygen released" or "absolute rate"');
  ok(/guaiacol/.test(r.eq[0]) && /tetraguaiacol/.test(r.eq[0]) && !/O2\s*$/.test(r.eq[0]), 'assay equation is H2O2 + guaiacol -> H2O + tetraguaiacol: ' + r.eq[0]);
  ok(/uses hydrogen peroxide to oxidize guaiacol/i.test(r.t), 'background says peroxidase uses H2O2 to oxidize guaiacol');
  ok(/absorbance-based rate/i.test(r.t) && /A = εlc/.test(r.t) && /calibration/i.test(r.t), 'background contrasts relative and absorbance-based rates and notes the Beer–Lambert calibration');
  ok(/Peroxidase uses H2O2 to oxidize it into brown tetraguaiacol/.test(r.quiz), 'pre-lab guaiacol question has the accurate answer');
  ok(/absorbance-based/.test(r.quiz) && !/absolute/.test(r.quiz), 'pre-lab rate question says "absorbance-based", not "absolute"');
  ok(/absorbance-based rate, ΔA₄₇₀\/min/.test(r.pal), 'a-palette prompt uses the absorbance-based wording');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t58-lab13-guaiacol');
})();
