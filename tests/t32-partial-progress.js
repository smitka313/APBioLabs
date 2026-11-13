/* Two-level progress: nav count and home card name the in-progress part with its item count; never "0 of N" once started. */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  const ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'lab05.html');
  const nav = () => p.evaluate(() => { const n = document.querySelector('.nav-progress'); return { long: n.querySelector('.np-long').textContent, part: (n.querySelector('.np-part') || {}).textContent || '', title: n.title }; });
  const n0 = await nav();
  T.ok(/^0 of \d+ parts done$/.test(n0.long) && !n0.part, 'no work: "' + n0.long + '" and no part item count');
  // find a part with at least two prompt boxes
  const target = await p.evaluate(() => {
    const secs = Array.from(document.querySelectorAll('section.step'));
    const s = secs.find(s => s.querySelectorAll('textarea[data-save]').length >= 2);
    const tas = Array.from(s.querySelectorAll('textarea[data-save]')).filter(t => !t.closest('.id-box'));
    return { id: s.id, name: s.dataset.step, n: tas.length, taId: tas[0].id };
  });
  await p.evaluate(id => Lab.pages.go(id), target.id);
  await p.waitForTimeout(400);
  await p.fill('#' + target.taId, 'My first answer');
  await p.waitForTimeout(900);
  const n1 = await nav();
  T.ok(n1.long === 'Started', 'after one answer, no part complete: nav says "' + n1.long + '" (not "0 of N")');
  const want = new RegExp('^ · ' + target.name + ' \\d+/\\d+ items$');
  T.ok(want.test(n1.part), 'nav names the part and items: "' + n1.part + '"');
  T.ok(/^Started · .+ \d+\/\d+ items$/.test(n1.title), 'nav tooltip: ' + n1.title);
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('aplab:progress:lab05')));
  T.ok(stored.partial && stored.partial.name === target.name && stored.items.done >= 1, 'summary stored with partial part: ' + JSON.stringify(stored.partial));
  const h = await ctx.newPage();
  await h.goto('file://' + T.ROOT + '/index.html'); await h.waitForTimeout(800);
  const card = (await h.textContent('[data-lab-progress="lab05"]')).trim();
  T.ok(new RegExp('^Started · ' + target.name + ' \\d+/\\d+ items$').test(card), 'home card: "' + card + '"');
  T.ok(!/0 of/.test(card), 'no "0 of N" on the card');
  const resume = (await h.textContent('#resume')).replace(/\s+/g, ' ');
  T.ok(/Started · /.test(resume), 'resume card says: ' + resume.slice(0, 140));
  T.ok(/Not started/.test(await h.textContent('[data-lab-progress="lab06"]')), 'untouched lab: Not started');
  // A completed part plus a part under way: "1 of N parts · name k/m items"
  await h.evaluate(() => localStorage.setItem('aplab:progress:lab07', JSON.stringify({ done: 3, total: 9, sections: 12, items: { done: 20, total: 40 }, partial: { id: 'root-tips', name: 'Root tips', done: 6, total: 11 }, t: Date.now() })));
  await h.reload(); await h.waitForTimeout(700);
  T.ok((await h.textContent('[data-lab-progress="lab07"]')).trim() === '3 of 9 parts · Root tips 6/11 items', 'home card: 3 of 9 parts · Root tips 6/11 items');
  await h.evaluate(() => localStorage.setItem('aplab:progress:lab08', JSON.stringify({ done: 0, total: 5, sections: 8, t: Date.now() })));
  await h.reload(); await h.waitForTimeout(700);
  T.ok(!/0 of/.test(await h.textContent('[data-lab-progress="lab08"]')), 'old summary with no work never shows "0 of N"');
  const t = await ctx.newPage(); await t.goto('file://' + T.ROOT + '/teachers.html');
  T.ok(/Two levels of progress/.test(await t.textContent('body')) && /Started &middot;|Started · /.test(await t.textContent('body')), 'teachers.html explains two-level progress');
  T.ok(p.errors.length === 0, 'no errors ' + p.errors.join(';'));
  await b.close(); T.done('t32-partial-progress');
})();
