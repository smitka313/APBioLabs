/* AP Biology course hero: responsive artwork, readable copy, and independent saved work. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('./_h');
const OUT = process.env.OUT;
const mobile = 'bench-ap-studio-mobile.webp', desktop = 'bench-ap-studio.webp';
const completion = { done: 5, total: 5, sections: 7, items: { done: 9, total: 9 }, partial: null, t: Date.now() };
async function art(page) {
  return page.locator('.bench-ap-picture img').evaluate(async img => {
    await img.decode();
    const r = img.getBoundingClientRect(), copy = document.querySelector('.hero-grid').getBoundingClientRect();
    return { file: new URL(img.currentSrc).pathname.split('/').pop(), natural: [img.naturalWidth, img.naturalHeight],
      w: r.width, h: r.height, noOverlap: r.bottom <= copy.top, full: r.left >= 0 && r.right <= innerWidth, alt: img.alt };
  });
}
(async () => {
  const server = await T.serve(), browser = await T.launch();
  try {
    for (const [width, dark] of [[375, true], [430, false], [600, false], [601, true], [1366, false], [1920, true]]) {
      const ctx = await T.ctxFor(browser, { width, height: 900, dark, reduced: width === 375 });
      try {
        await ctx.addInitScript(({ dark, completion }) => {
          localStorage.setItem('aplab:pref:theme', dark ? 'dark' : 'light');
          localStorage.setItem('aplab:progress:lab05', JSON.stringify(completion));
          localStorage.setItem('aplab:last', JSON.stringify({ lab: 'lab05', step: 'float-assay', name: 'Float assay', title: 'Lab 5 · Photosynthesis', t: Date.now() }));
        }, { dark, completion });
        const p = await T.open(ctx, 'ap-biology.html', '', server.url);
        const image = await art(p);
        const expected = width <= 600 ? [1120, 545] : [1800, 456];
        assert.equal(image.file, width <= 600 ? mobile : desktop);
        assert.deepEqual(image.natural, expected);
        assert.ok(image.full && image.noOverlap && Math.abs(image.h - image.w * expected[1] / expected[0]) <= 1,
          'art is not clipped, distorted, or behind the title');
        assert.match(image.alt, /Microscope.*agar plates.*flask.*gel electrophoresis/i);
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        assert.equal(await p.locator('#labs .card').count(), 13);
        assert.equal(await p.locator('#bench-note, #bench-preview, #migration-help').count(), 0);
        assert.equal(await p.locator('[data-lab-progress="lab05"] .prog-bar i').evaluate(el => el.style.width), '100%');
        assert.ok(await p.locator('#resume').isVisible(), 'saved work remains resumable independently of the banner');
        const ratios = await p.evaluate(() => {
          const lum = css => {
            const [r,g,b] = css.match(/[0-9.]+/g).slice(0,3).map(n => {
              const v = +n / 255; return v <= .04045 ? v / 12.92 : ((v+.055)/1.055)**2.4;
            });
            return r*.2126 + g*.7152 + b*.0722;
          };
          const bg = lum(getComputedStyle(document.querySelector('.hero')).backgroundColor);
          return ['h1', '.eyebrow', 'p.lede', '.hero-links a', '.hero-browse'].map(sel => {
            const fg = lum(getComputedStyle(document.querySelector('.hero ' + sel)).color);
            return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
          });
        });
        assert.ok(ratios.every(n => n >= 4.5), 'copy meets AA contrast against the solid hero surface');
        assert.deepEqual(p.errors, []);
        if (OUT) { fs.mkdirSync(OUT, { recursive: true }); await p.locator('.hero').screenshot({ path: path.join(OUT, 'ap-bench-' + width + '.png') }); }
        await p.emulateMedia({ media: 'print' });
        assert.ok(await p.locator('.bench-ap-picture').isHidden(), 'print does not include decorative artwork');
        console.log('AP bench: ' + width + 'px ' + (dark ? 'dark' : 'light') + ' passed');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); server.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });

