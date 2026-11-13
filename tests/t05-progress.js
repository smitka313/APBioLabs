/* #5 One progress scheme: parts with student work, shared by nav, home cards and teachers.html */
const T = require('./_h');
const nav = p => p.evaluate(() => ({
  text: (document.querySelector('.nav-progress .np-long') || {}).textContent || '',
  links: Array.from(document.querySelectorAll('.step-nav ol a')).map(a => ({ name: a.querySelector('.nl').textContent, title: a.title, done: a.classList.contains('is-done'), work: a.classList.contains('has-work') })),
  upd: Lab.progress.update(),
}));
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const totals = {};
  console.log('Fresh load, then reload: nothing is partly done before the student touches anything');
  for (const lab of T.LABS) {
    const p = await T.open(ctx, lab + '.html');
    await p.waitForTimeout(800);
    let n = await nav(p);
    await p.reload(); await p.waitForTimeout(1200);
    n = await nav(p);
    const partly = n.links.filter(l => l.work && !/^0 of \d+ items done$/.test(l.title));
    T.ok(partly.length === 0, `${lab}: no part shows progress before any work ${partly.map(l => l.name + ' ' + l.title)}`);
    T.ok(n.links.every(l => !l.done), `${lab}: no part is done`);
    const withWork = n.links.filter(l => l.work).length;
    T.ok(n.text === `0 of ${withWork} parts done` && n.upd.total === withWork, `${lab}: nav says "${n.text}" = ${withWork} parts with work of ${n.links.length}`);
    totals[lab] = { sections: n.links.length, work: withWork };
    await p.close();
  }

  console.log('Lab 2: simulation steps move the count live and a reload keeps it');
  let p = await T.open(ctx, 'lab02.html', 'card-model');
  let before = (await nav(p)).links.find(l => l.name === 'Card model');
  await p.fill('#p-predict-card', 'I predict p stays near 0.5 because mating is random'); await p.waitForTimeout(600); // predict-first gate
  await p.click('#card-step'); await p.waitForTimeout(500);
  let after = (await nav(p)).links.find(l => l.name === 'Card model');
  const num = t => +/^(\d+) of/.exec(t)[1];
  T.ok(num(after.title) > num(before.title), `Card model "${before.title}" -> "${after.title}" live`);
  await p.click('#card-run5'); await p.waitForTimeout(500);
  const more = (await nav(p)).links.find(l => l.name === 'Card model');
  T.ok(num(more.title) > num(after.title), `a second step moves it again: "${more.title}"`);
  await p.reload(); await p.waitForTimeout(1500);
  const kept = (await nav(p)).links.find(l => l.name === 'Card model');
  T.ok(kept.title === more.title, `reload keeps it: "${kept.title}"`);
  // home card uses the same total
  const h = await T.open(ctx, 'index.html'); await h.waitForTimeout(500);
  const card = await h.textContent('[data-lab-progress="lab02"]');
  T.ok(new RegExp(`of ${totals.lab02.work} parts`).test(card) || new RegExp(`^All ${totals.lab02.work} parts`).test(card), `home card for Lab 2: "${card.trim()}" (${totals.lab02.work} parts with work)`);
  await h.close(); await p.close();

  console.log('Lab 1: finishing the Grow scoring step moves the count');
  p = await T.open(ctx, 'lab01.html', 'grow-and-score');
  before = (await nav(p)).links.find(l => l.name === 'Grow & score');
  await p.click('#autocount'); await p.waitForTimeout(3500);
  after = (await nav(p)).links.find(l => l.name === 'Grow & score');
  T.ok(num(after.title) > num(before.title), `Grow & score "${before.title}" -> "${after.title}"`);
  await p.reload(); await p.waitForTimeout(1500);
  const k1 = (await nav(p)).links.find(l => l.name === 'Grow & score');
  T.ok(num(k1.title) >= num(after.title), `still counted after reload: "${k1.title}"`);
  await p.close();

  console.log('Prompts and quizzes still count');
  p = await T.open(ctx, 'lab02.html', 'reflect');
  await p.fill('textarea[data-save]:visible', 'hello'); await p.waitForTimeout(700);
  const rf = (await nav(p)).links.find(l => l.name === 'Reflect');
  T.ok(num(rf.title) === 1, `Reflect: "${rf.title}"`);
  await p.close();
  await b.close();
  T.done('t05-progress');
})();
