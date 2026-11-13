/* Color-blind safety of the shared pieces: series colors stay apart under simulated deuteranopia and protanopia (Machado 2009 matrices),
   series also differ by marker / line pattern / fill pattern, and success / error / warning carry an icon, not only a color. */
const T = require('./_h');
const MAT = {
  deut: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  prot: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
};
const h2r = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const gam = c => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055; };
const sim = (rgb, k) => { if (!k) return rgb; const l = rgb.map(lin); return MAT[k].map(r => gam(r[0] * l[0] + r[1] * l[1] + r[2] * l[2])); };
function lab(rgb) {
  const [r, g, b] = rgb.map(lin);
  let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const de = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
(async () => {
  const b = await T.launch();
  for (const dark of [false, true]) {
    const ctx = await T.ctxFor(b, { dark });
    const p = await T.open(ctx, 'lab05.html');
    const toks = await p.evaluate(() => ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6'].map(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()));
    const cols = toks.map(h2r);
    for (const k of ['deut', 'prot']) {
      let min = 1e9, pair = '';
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) { const d = de(sim(cols[i], k), sim(cols[j], k)); if (d < min) { min = d; pair = `${i + 1}/${j + 1}`; } }
      T.ok(min >= 15, `${dark ? 'dark' : 'light'} ${k}: closest pair of series colors (${pair}) has dE ${min.toFixed(1)} (>= 15; the old palette had 3 to 6)`);
    }
    const r = await p.evaluate(() => {
      const d = document.createElement('div'); d.style.width = '640px'; document.body.append(d);
      Lab.chart(d, { xLabel: 'x', yLabel: 'y', series: [0, 1, 2, 3, 4, 5].map(k => ({ name: 'S' + k, points: [0, 1, 2].map(x => ({ x, y: x + k })) })) });
      const lines = Array.from(d.querySelectorAll('polyline')).map(l => l.getAttribute('stroke-dasharray') || 'solid');
      const shapes = new Set(Array.from(d.querySelectorAll('svg > g > *')).map(e => e.tagName));
      const sw = d.querySelectorAll('.legend .lg-sw').length;
      const e = document.createElement('div'); e.style.width = '640px'; document.body.append(e);
      Lab.chart(e, { type: 'bar', xLabel: 'x', yLabel: 'y', categories: ['A'], series: [0, 1, 2, 3].map(k => ({ name: 'G' + k, points: [{ x: 'A', y: 1 + k }] })) });
      const fills = Array.from(e.querySelectorAll('svg[role=img] rect[style*="url(#"]')).length, pats = e.querySelectorAll('svg[role=img] pattern').length;
      return { lines, shapes: Array.from(shapes), sw, fills, pats };
    });
    T.ok(new Set(r.lines).size >= 4, `${dark ? 'dark' : 'light'}: line series use different dash patterns ${JSON.stringify(r.lines)}`);
    T.ok(r.shapes.length >= 4, `${dark ? 'dark' : 'light'}: series use different marker shapes ${r.shapes}`);
    T.ok(r.sw === 6, `${dark ? 'dark' : 'light'}: the legend draws each marker and line pattern (${r.sw} swatches)`);
    T.ok(r.fills === 3 && r.pats === 3, `${dark ? 'dark' : 'light'}: grouped bars 2-4 have their own fill patterns (${r.fills} filled, ${r.pats} patterns)`);
    const ic = await p.evaluate(() => {
      const mk = c => { const e = document.createElement('p'); e.className = c; e.textContent = 'x'; document.body.append(e); return getComputedStyle(e, '::before').content; };
      return { ok: mk('feedback ok'), bad: mk('feedback bad'), pok: mk('pill ok'), pwarn: mk('pill warn'), pbad: mk('pill bad') };
    });
    T.ok(/✓/.test(ic.ok) && /✕/.test(ic.bad) && /✓/.test(ic.pok) && /!/.test(ic.pwarn) && /✕/.test(ic.pbad), `${dark ? 'dark' : 'light'}: feedback and pills carry icons ${JSON.stringify(ic)}`);
    await ctx.close();
  }
  await b.close(); T.done('t39-colorblind');
})();
