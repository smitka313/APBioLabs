/* Lab 5 (audit 5, item 3): the inverse square law is presented as an approximation for a small light source, with the real-lamp caveat,
   a light-meter tip, and a note that the simulation uses it as its model.
   Run: NODE_PATH=$(npm root -g) node tests/t58-lab5-inverse-square.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
(async () => {
  const b = await launch(), ctx = await ctxFor(b, { reduced: true }), p = await open(ctx, 'lab05.html');
  const r = await p.evaluate(() => {
    document.querySelectorAll('details').forEach(d => { d.open = true; });
    const flat = s => s.replace(/\s+/g, ' ');
    const bg = document.querySelector('[data-step="Background"]');
    return { bg: flat(bg.textContent), quiz: flat(document.getElementById('prelab') ? document.getElementById('prelab').textContent : document.body.textContent) };
  });
  ok(/For a small light source, light intensity approximately follows the inverse square law/.test(r.bg), 'background calls the inverse square law an approximation for a small source');
  ok(/Real classroom lamps may behave differently because of their shape, reflectors, and surrounding light/.test(r.bg), 'background gives the real-lamp caveat');
  ok(/light meter/i.test(r.bg), 'background suggests a light meter');
  ok(/simulation uses the inverse square law as its model/i.test(r.bg), 'background says the inverse square law is the simulation’s model');
  ok(!/Light intensity from a small lamp follows the inverse square law/.test(r.bg) && !/Light intensity ∝ 1\/\(distance\)2: twice/.test(r.bg), 'no unqualified "follows the inverse square law" wording remains');
  ok(/approximately/.test(r.bg.match(/Inverse square law[^.]*/g).join(' ')), 'glossary entry is qualified');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t58-lab5-inverse-square');
})();
