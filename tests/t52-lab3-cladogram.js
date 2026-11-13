/* Lab 3 Part 1: a complete, correct cladogram (any order of grouping) must finish every Morphology step.
   Reviewer's steps: tick the trait table, check it, build all five nodes, place the fossil, explain, saved.
   Run: NODE_PATH=$(npm root -g) node tests/t52-lab3-cladogram.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
const FULL = [  // the five nodes of the six-group tree (root first); trait text must match the select options
  [['ins', 'cru', 'cro', 'bir', 'rod', 'ape'], 'Heterotroph'], [['ins', 'cru'], 'Jointed exoskeleton'], [['cro', 'bir', 'rod', 'ape'], 'Vertebrae'],
  [['cro', 'bir'], 'Muscular gizzard'], [['rod', 'ape'], 'Fur']];
(async () => {
  const b = await launch();
  for (const order of ['top-down', 'bottom-up']) {
    const ctx = await ctxFor(b), p = await open(ctx, 'lab03.html', 'morphology');
    await p.evaluate(() => Lab.pages.go(document.getElementById('clade-sim')));
    await p.waitForTimeout(400);
    // 1. tick the trait table exactly as the data say, then check it
    const cells = await p.evaluate(() => Array.from(document.querySelectorAll('#matrix input[type=checkbox]')).map(c => c.id));
    const TR = [['ins', 'cru', 'cro', 'bir', 'rod', 'ape'], ['ins', 'cru'], ['cro', 'bir', 'rod', 'ape'], ['cro', 'bir'], ['rod', 'ape'], ['ins'], ['cru'], ['cro'], ['bir'], ['rod'], ['ape']];
    for (const id of cells) { const m = /mx-(\w+)-(\d+)/.exec(id); if (TR[+m[2]].includes(m[1])) await p.check('#' + id); }
    await p.click('#check-matrix');
    // 2. build the five nodes
    const seq = order === 'top-down' ? FULL : FULL.slice().reverse();
    for (const [mem, trait] of seq) {
      for (const id of mem) await p.click(`#chips .chip[data-id="${id}"]`);
      const val = await p.evaluate(t => Array.from(document.querySelectorAll('#trait-pick option')).find(o => o.textContent.startsWith(t)).value, trait);
      await p.selectOption('#trait-pick', val);
      await p.click('#add-clade');
    }
    // 3. fossil hypothesis + explanations
    const opt = await p.evaluate(() => Array.from(document.querySelectorAll('#fossil-hyp option')).filter(o => o.value)[1].value);
    await p.selectOption('#fossil-hyp', opt);
    await p.fill('#p-fossil-obs', 'It has feathers, teeth and a long bony tail.'); await p.fill('#p-fossil-hyp-why', 'Feathers are a derived character shared with birds, so it is sister to birds.');
    await p.waitForTimeout(1500);
    const st = await p.evaluate(() => Array.from(document.querySelectorAll('#clade-steps li')).map(li => li.textContent.replace(/\s+/g, ' ').trim()));
    console.log(order, JSON.stringify(st));
    ok(st.length === 5 && st.every(t => /\(done\)/.test(t)), `${order}: every Morphology step done after a complete correct tree (${st.filter(t => /next step/.test(t)).join('')})`);
    // a wrong tree must NOT complete the step
    await p.click('#reset-clade');
    for (const id of ['ins', 'ape']) await p.click(`#chips .chip[data-id="${id}"]`);
    await p.selectOption('#trait-pick', await p.evaluate(() => Array.from(document.querySelectorAll('#trait-pick option')).find(o => o.textContent.startsWith('Fur')).value));
    await p.click('#add-clade'); await p.waitForTimeout(1200);
    const st2 = await p.evaluate(() => Array.from(document.querySelectorAll('#clade-steps li')).map(li => li.textContent.replace(/\s+/g, ' ').trim()));
    ok(!/\(done\)/.test(st2[2]), `${order}: a wrong/incomplete tree does not mark the grouping step done`);
    ok(p.errors.length === 0, `${order}: no page errors ${p.errors.join('|')}`);
    await ctx.close();
  }
  await b.close(); done('t52-lab3-cladogram');
})();
