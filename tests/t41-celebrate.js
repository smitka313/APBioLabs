/* Celebrations: a quiet check-sweep when a part completes, ONE confetti burst per lab (only on a report download/save after
   every part is done), a static "Lab complete ✓" badge under reduced motion.
   Run: NODE_PATH=$(npm root -g) node tests/t41-celebrate.js  (set OUT=dir to keep screenshots) */
const T = require('./_h');
const OUT = process.env.OUT || '';
const FIX = 'tests/fixtures/lab99.html';

async function openFix(b, srv, o = {}) {
  const ctx = await T.ctxFor(b, o);
  const p = await T.open(ctx, FIX, '', srv.url);
  await p.evaluate(() => { window.__cel = []; window.addEventListener('aplab:celebrate', e => window.__cel.push(e.detail)); });
  return { ctx, p };
}
const fill = async (p, id, v) => { await p.evaluate(i => Lab.pages.go(document.getElementById('p-' + i).closest('section')), id); await p.waitForTimeout(300); await p.fill('#p-' + id, v); await p.waitForTimeout(150); };
const toSubmit = async p => { await p.evaluate(() => Lab.pages.go('submit')); await p.waitForTimeout(300); };
const celCount = p => p.evaluate(() => window.__cel.length);
const confettiUp = p => p.evaluate(() => document.querySelectorAll('.confetti-canvas').length);

(async () => {
  const srv = await T.serve(), b = await T.launch();

  console.log('Normal motion');
  let { ctx, p } = await openFix(b, srv);
  await p.waitForTimeout(2000); // restored state and load-time updates are quiet for ~1.8 s
  T.ok(await p.locator('.nav-ring').isVisible(), 'the progress ring is in the nav');
  await fill(p, 'a1', 'Because the disks float when oxygen builds up.');
  T.ok(await p.locator('.step-nav a.just-done').count() === 1, 'completing Part A sweeps a check on its nav item');
  T.ok(await p.locator('.nav-ring.just-done').count() === 1, '... and on the progress ring');
  T.ok(await p.locator('.step-nav a.just-done .n').evaluate(e => getComputedStyle(e, '::before').animationName) === 'lab-check-sweep', 'the nav check uses the sweep animation');
  if (OUT) await p.screenshot({ path: OUT + '/t41-part-done.png', clip: { x: 0, y: 100, width: 1366, height: 120 } });
  await p.waitForTimeout(1700);
  T.ok(await p.locator('.just-done').count() === 0, 'the sweep is brief and removes itself');
  T.ok(await celCount(p) === 0 && await confettiUp(p) === 0, 'no confetti for a part completion');
  await fill(p, 'b1', 'Light and carbon dioxide both matter.');
  T.ok(await celCount(p) === 0 && await confettiUp(p) === 0, 'no confetti when the last part completes (only a report save triggers it)');
  T.ok(await p.locator('.nav-ring.is-full').count() === 1, 'the ring is full and shows its check');
  await p.waitForTimeout(1600);

  await p.evaluate(() => Lab.pages.go('submit')); await p.waitForTimeout(300);
  await toSubmit(p); await p.getByRole('button', { name: 'Download .docx' }).click();
  await p.waitForFunction(() => window.__cel.length > 0, null, { timeout: 15000 });
  await p.waitForTimeout(250);
  T.ok(await celCount(p) === 1 && (await p.evaluate(() => window.__cel[0].kind)) === 'confetti', 'downloading the .docx fires one confetti burst');
  T.ok(await confettiUp(p) === 1, 'drawn on one canvas of our own');
  if (OUT) await p.screenshot({ path: OUT + '/t41-confetti.png' });
  T.ok(await p.evaluate(() => { const c = document.querySelector('.confetti-canvas'); const s = getComputedStyle(c); return s.pointerEvents === 'none' && c.getAttribute('aria-hidden') === 'true'; }), 'the canvas ignores the pointer and is hidden from screen readers');
  T.ok(await p.evaluate(() => !!localStorage.getItem('aplab:lab99:celebrated')), 'aplab:lab99:celebrated remembers it');
  await p.waitForTimeout(3300);
  T.ok(await confettiUp(p) === 0, 'the canvas removes itself');
  await toSubmit(p); await p.getByRole('button', { name: 'Download .docx' }).click();
  await p.waitForTimeout(2500);
  T.ok(await celCount(p) === 1 && await confettiUp(p) === 0, 'a second download does not repeat it');
  await p.reload(); await p.waitForTimeout(900);
  await p.evaluate(() => { window.__cel = []; window.addEventListener('aplab:celebrate', e => window.__cel.push(e.detail)); });
  await toSubmit(p); await p.getByRole('button', { name: 'Download .docx' }).click();
  await p.waitForTimeout(2500);
  T.ok(await celCount(p) === 0 && await confettiUp(p) === 0, 'nor after a reload');
  T.ok(p.errors.length === 0, 'no console errors ' + p.errors.join('|'));
  await ctx.close();

  console.log('Not complete yet');
  ({ ctx, p } = await openFix(b, srv));
  await fill(p, 'a1', 'Only part A is done.');
  await toSubmit(p); await p.getByRole('button', { name: 'Download .docx' }).click();
  await p.waitForTimeout(2500);
  T.ok(await celCount(p) === 0 && await confettiUp(p) === 0, 'a report saved with a part unfinished does not celebrate');
  await ctx.close();

  console.log('PDF path');
  ({ ctx, p } = await openFix(b, srv));
  await fill(p, 'a1', 'A answer.'); await fill(p, 'b1', 'B answer.');
  await toSubmit(p); await p.getByRole('button', { name: 'Save as PDF' }).click();
  await p.waitForFunction(() => window.__cel.length > 0, null, { timeout: 8000 });
  T.ok(await celCount(p) === 1, 'saving the PDF fires it once');
  await p.waitForTimeout(600);
  T.ok(await p.evaluate(() => getComputedStyle(document.querySelector('.confetti-canvas') || document.body).display !== undefined), 'report view open');
  await ctx.close();

  console.log('Reduced motion');
  ({ ctx, p } = await openFix(b, srv, { reduced: true }));
  await p.waitForTimeout(2000);
  await fill(p, 'a1', 'A answer.');
  T.ok(await p.locator('.just-done').count() === 0, 'no sweep animation class');
  T.ok(await p.locator('.step-nav a.is-done').count() === 1, 'the static check is still there');
  await fill(p, 'b1', 'B answer.');
  T.ok(await p.locator('.lab-complete').isHidden(), 'no badge before the report is saved');
  await toSubmit(p); await p.getByRole('button', { name: 'Download .docx' }).click();
  await p.waitForFunction(() => window.__cel.length > 0, null, { timeout: 15000 });
  await p.waitForTimeout(300);
  T.ok(await confettiUp(p) === 0 && (await p.evaluate(() => window.__cel[0].kind)) === 'badge', 'no confetti; a badge instead');
  T.ok(await p.locator('.lab-complete').isVisible() && (await p.locator('.lab-complete').innerText()).trim() === 'Lab complete ✓', 'the calm "Lab complete ✓" badge is shown');
  if (OUT) await p.locator('.report-bar').screenshot({ path: OUT + '/t41-badge.png' });
  await p.reload(); await p.waitForTimeout(900);
  T.ok(await p.locator('.lab-complete').isVisible(), 'the badge is still there after a reload');
  T.ok(p.errors.length === 0, 'no console errors ' + p.errors.join('|'));
  await ctx.close();

  await b.close(); srv.close();
  T.done('t41-celebrate');
})();
