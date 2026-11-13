/* Labs 1-7: per-student starting values, personal-data prompts, AP FRQ + rubric, key results, reload survival.
   Run: NODE_PATH=$(npm root -g) node tests/t21-labs1-7-personal.js [labNN ...] */
const { ok, done, launch, ctxFor, open } = require('./_h');

async function ctxAs(b, name, period, o = {}) {
  const ctx = await ctxFor(b, o);
  await ctx.addInitScript(([n, p]) => { try { if (!sessionStorage.getItem('__id')) { localStorage.setItem('aplab:student', JSON.stringify({ name: n, period: p })); sessionStorage.setItem('__id', '1'); } } catch (e) { /* */ } }, [name, period]);
  return ctx;
}
const keyres = (p, lab, id) => p.evaluate(([l, i]) => { try { return JSON.parse(localStorage.getItem('aplab:' + l + ':keyres:' + i)); } catch (e) { return null; } }, [lab, id]);
const ownText = (p, k) => p.evaluate(k => { const w = document.querySelector('[data-own="' + k + '"]'); return w ? w.querySelector('label').textContent : null; }, k);

/* Shared FRQ checks. Page must already be loaded. */
async function frqChecks(p, lab) {
  await p.evaluate(() => Lab.pages && Lab.pages.go('reflect'));
  await p.waitForTimeout(300);
  ok(await p.locator('#frq-rubric').isHidden(), lab + ': FRQ rubric hidden before saving');
  await p.click('#frq-save');
  ok(await p.locator('#frq-rubric').isHidden(), lab + ': rubric stays hidden when answer incomplete');
  for (const l of ['a', 'b', 'c', 'd']) await p.fill('#p-frq-' + l, 'Answer for part ' + l + ' with enough text.');
  await p.click('#frq-save');
  ok(await p.locator('#frq-rubric').isVisible(), lab + ': rubric appears after saving');
  ok((await p.locator('#frq-rubric input[type=checkbox]').count()) === 4, lab + ': rubric has 4 checkboxes');
  await p.check('#frq-r1'); await p.check('#frq-r3');
  await p.waitForTimeout(300);
  const k = await keyres(p, lab, 'frq-score');
  ok(k && k.value === 2 && k.unit === 'of 4' && k.label === 'FRQ self-score', lab + ': frq-score stored = 2 (' + JSON.stringify(k) + ')');
}
async function frqReload(p, lab) {
  await p.reload(); await p.waitForTimeout(900);
  await p.evaluate(() => Lab.pages && Lab.pages.go('reflect')); await p.waitForTimeout(300);
  ok(await p.locator('#frq-rubric').isVisible(), lab + ': rubric still visible after reload');
  ok(await p.locator('#frq-r1').isChecked() && !(await p.locator('#frq-r2').isChecked()) && await p.locator('#frq-r3').isChecked(), lab + ': rubric ticks survive reload');
  ok((await p.inputValue('#p-frq-a')).includes('part a'), lab + ': FRQ answer survives reload');
  const k = await keyres(p, lab, 'frq-score');
  ok(k && k.value === 2, lab + ': frq-score survives reload');
  ok(p.errors.length === 0, lab + ': no page errors ' + p.errors.join(' | '));
}

const LABS = {};
module.exports = { ok, done, launch, ctxAs, open, keyres, ownText, frqChecks, frqReload, LABS };

if (require.main === module) {
  (async () => {
    const want = process.argv.slice(2);
    const b = await launch();
    for (const f of ['lab01', 'lab02', 'lab03', 'lab04', 'lab05', 'lab06', 'lab07']) {
      if (want.length && !want.includes(f)) continue;
      console.log('\n== ' + f);
      await require('./t21/' + f + '.js')({ b, ok, ctxAs, open, keyres, ownText, frqChecks, frqReload });
    }
    await b.close();
    done('t21 labs 1-7');
  })().catch(e => { console.error(e); process.exit(1); });
}
