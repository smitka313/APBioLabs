/* Scenes 1 and 2 of openscied-b3-inheritance-environment.html (Lessons 8-9): Lakita's pedigree and the two-gene pedigree.
   Mounting, the people and symbols from the handout and key, solver feedback (correct, impossible, "could be either"), the chromosome
   view and the Punnett-style step-through, keyboard-only use, saving and restoring, the "Your data" boxes, the two-gene activities
   (read the chromosomes, both risk alleles, new mixes, trace with crossing over), no free-text inputs, and no page errors.
   Run: NODE_PATH=$(npm root -g) node tests/t97-pedigree-scene.js */
const T = require('./_h');
const PAGE = 'openscied-b3-inheritance-environment.html', KEY = 'aplab:openscied:b3-inheritance-environment:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); };
const P = '#pedigree-scene', G = '#two-gene-scene';
const person = (root, id) => root + ' [data-person="' + id + '"]';
const msg = (p, sel) => p.locator(sel).innerText();
(async () => {
  const browser = await T.launch();
  const server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900, reduced: true });
    const p = await ctx.newPage();
    const problems = [];
    p.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
    p.on('pageerror', e => problems.push('pageerror: ' + e.message));
    await stub(p);
    await p.goto(server.url + PAGE);
    await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current'));

    // --- mounting ---
    await go(p, 'lakita');
    T.ok(await p.locator('#pedigree-notice').isHidden() && await p.locator(P + ' svg.ped-svg').count() === 1, 'pedigree scene mounted and the coming-soon notice is gone');
    T.ok(await p.locator(P + ' canvas').count() === 0 && await p.locator(P + ' svg[role="group"][aria-label]').count() === 1, 'the drawing has a role and an accessible name');
    await go(p, 'twogene');
    T.ok(await p.locator('#two-gene-notice').isHidden() && await p.locator(G + ' svg.tg-svg').count() === 1, 'two-gene scene mounted and the notice is gone');
    T.ok(!await p.evaluate(() => document.querySelector('#pedigree-scene, #two-gene-scene').closest('main').querySelectorAll('[aria-live]').length > 1), 'no extra live region was added by the scenes');

    // --- pedigree: people and symbols from the handout and the key ---
    await go(p, 'lakita');
    const people = await p.$$eval(P + ' .ped-person', gs => gs.map(g => ({ id: g.dataset.person, sex: g.dataset.sex, shaded: g.dataset.shaded, dec: g.dataset.deceased, unt: g.dataset.untested })));
    const want = { grandfather: ['male', '0', '0', '0'], grandmother: ['female', '1', '1', '0'], aunt1: ['female', '0', '0', '1'], aunt2: ['female', '1', '1', '0'], uncle: ['male', '1', '1', '0'], aunt3: ['female', '0', '0', '1'], father: ['male', '1', '1', '0'], mother: ['female', '0', '0', '0'], lakita: ['female', '1', '0', '0'] };
    T.ok(people.length === 9 && people.every(x => want[x.id] && [x.sex, x.shaded, x.dec, x.unt].join() === want[x.id].join()), 'nine people with the right sex, shading, slash and "?" (matches the handout): ' + JSON.stringify(people.map(x => x.id)));
    T.ok(await p.locator(P + ' .ped-q').count() === 2 && await p.locator(P + ' .ped-slash').count() === 4 && await p.locator(P + ' .ped-sym.is-shaded').count() === 5, 'two "?" marks, four slashes, five shaded symbols');
    T.ok(await p.locator(P + ' rect.ped-sym').count() === 3 && await p.locator(P + ' circle.ped-sym').count() === 6, 'squares are males (3) and circles are females (6)');
    const aria = await p.getAttribute(person(P, 'lakita'), 'aria-label');
    T.ok(/^Lakita, daughter, shaded: cancer related to p53, no genotype guess yet$/.test(aria), 'aria text for Lakita: ' + aria);
    T.ok(/^Lakita’s father, male, shaded: cancer related to p53, deceased/.test(await p.getAttribute(person(P, 'father'), 'aria-label')) && /not tested/.test(await p.getAttribute(person(P, 'aunt1'), 'aria-label')), 'aria text for the father and an untested aunt');
    T.ok(/Text description: .*grandmother \(shaded, deceased\)/.test(await p.locator('#pedigree-desc').innerText()), 'text description is present');

    // --- solver feedback ---
    await p.click(person(P, 'lakita'));
    T.ok(/Pick every genotype/.test(await msg(p, P + ' .ped-msg')), 'choosing a person asks for genotypes');
    await p.click(P + ' .ped-chip[data-genotype="AA"]');
    let m = await msg(p, P + ' .ped-msg');
    T.ok(/AA is not possible/.test(m) && /at least one/.test(m) && await p.locator(P + ' .ped-chip[data-genotype="AA"].bad').count() === 1 && !/bad gene|defect/i.test(m), 'impossible guess for Lakita gets a short friendly reason: ' + m);
    T.ok(/not possible/.test(await p.getAttribute(person(P, 'lakita'), 'aria-label')), 'the person label says the guess is not possible');
    await p.click(P + ' .ped-chip[data-genotype="AA"]');
    await p.click(P + ' .ped-chip[data-genotype="AB"]');
    T.ok(/^Yes! Only AB fits/.test(await msg(p, P + ' .ped-msg')) && /matches the model/.test(await p.getAttribute(person(P, 'lakita'), 'aria-label')), 'correct guess for Lakita');
    await p.click(person(P, 'aunt1'));
    await p.click(P + ' .ped-chip[data-genotype="AA"]');
    T.ok(/not tested, so one more could also be true/.test(await msg(p, P + ' .ped-msg')), 'untested aunt with one right guess: one more is possible');
    await p.click(P + ' .ped-chip[data-genotype="AB"]');
    T.ok(/^Yes! Could be either AA or AB\. This person was not tested/.test(await msg(p, P + ' .ped-msg')), '"could be either" for an untested aunt: ' + await msg(p, P + ' .ped-msg'));
    await p.click(P + ' .ped-chip[data-genotype="BB"]');
    T.ok(/BB is not possible/.test(await msg(p, P + ' .ped-msg')) && /only A alleles/.test(await msg(p, P + ' .ped-msg')), 'BB for an aunt is explained through the grandfather');
    await p.click(P + ' .ped-chip[data-genotype="BB"]');
    await p.click(person(P, 'mother'));
    await p.click(P + ' .ped-chip[data-genotype="AB"]');
    T.ok(/testing found only/.test(await msg(p, P + ' .ped-msg')) || /genetic testing/.test(await msg(p, P + ' .ped-msg')), 'a tested person with the wrong guess: ' + await msg(p, P + ' .ped-msg'));
    await p.click(P + ' .ped-chip[data-genotype="AB"]');
    await p.click(P + ' .ped-chip[data-genotype="AA"]');
    T.ok(/^Yes! The lesson says testing found AA/.test(await msg(p, P + ' .ped-msg')), 'the mother (tested) is AA');
    await p.click(person(P, 'grandmother'));
    await p.click(P + ' .ped-chip[data-genotype="AB"]'); await p.click(P + ' .ped-chip[data-genotype="BB"]');
    T.ok(/Could be either AB or BB/.test(await msg(p, P + ' .ped-msg')), 'grandmother could be AB or BB');
    await p.click(P + ' .ped-actions .btn:has-text("Hint")');
    T.ok(/^Hint:/.test(await msg(p, P + ' .ped-msg')), 'the hint button gives a one-line hint');

    // --- your data box, saved state, reload ---
    const dataText = await p.locator('#data-pedigree-body').innerText();
    T.ok(/Lakita/.test(dataText) && /✓ Matches the model/.test(dataText) && /Lakita’s mother/.test(dataText), 'the "Your data" box fills from the scene: ' + dataText.replace(/\s+/g, ' ').slice(0, 140));
    const saved = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).pedigree, KEY);
    T.ok(saved && saved.guesses.lakita[0] === 'AB' && saved.guesses.aunt1.join() === 'AA,AB' && saved.guesses.grandmother.join() === 'AB,BB' && saved.view === 'pedigree' && typeof saved.updatedAt === 'number', 'saved state has the contract shape: ' + JSON.stringify(saved).slice(0, 150));
    await p.getByRole('button', { name: 'Chromosome 17 pair' }).click();
    T.ok(await p.evaluate(k => JSON.parse(localStorage.getItem(k)).pedigree.view, KEY) === 'chromosome' && await p.locator(P + ' .ped-chr').count() === 18, 'chromosome view draws a pair for every person and is saved');
    const lakitaBands = await p.$$eval(person(P, 'lakita') + ' .ped-band', b => b.map(x => x.getAttribute('class')));
    T.ok(lakitaBands.join() === 'ped-band A,ped-band B' && await p.locator(person(P, 'aunt3') + ' .ped-band.Q').count() === 2, 'Lakita shows A and B; an unpicked person shows "?"');
    await p.reload();
    await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current'));
    await go(p, 'lakita');
    T.ok(await p.locator(P + ' .ped-chr').count() === 18 && /matches the model/.test(await p.getAttribute(person(P, 'lakita'), 'aria-label')) && /genotype guess AA or AB, matches/.test(await p.getAttribute(person(P, 'aunt1'), 'aria-label')), 'view and guesses survive a reload');
    await p.getByRole('button', { name: 'Family tree' }).click();

    // --- Punnett-style step-through ---
    await p.getByRole('button', { name: 'Show how Lakita got her alleles' }).click();
    T.ok(/step 1 of 3/.test(await p.locator(P + ' .ped-panel h4').innerText()) && /father is AB/.test(await msg(p, P + ' .ped-msg')), 'step 1: the father gives one allele');
    T.ok(await p.locator(P + ' table.ped-punnett').count() === 1 && await p.locator(P + ' .ped-punnett tbody td').count() === 4, 'Punnett-style square with four boxes');
    await p.getByRole('button', { name: 'Next' }).click();
    T.ok(/mother is AA/.test(await msg(p, P + ' .ped-msg')), 'step 2: the mother gives an A');
    await p.getByRole('button', { name: 'Next' }).click();
    T.ok(/B from her father \+ A from her mother = AB/.test(await msg(p, P + ' .ped-msg')) && await p.locator(P + ' td.is-pick').count() === 1, 'step 3: Lakita is AB, her B came from her father');
    await p.getByRole('button', { name: 'Done' }).click();
    T.ok(await p.locator(P + ' table.ped-punnett').count() === 0, 'Done closes the step-through');

    // --- no free-text boxes, no creating a family ---
    for (const sc of [P, G]) T.ok(await p.locator(sc + ' input[type=text], ' + sc + ' textarea, ' + sc + ' [contenteditable]').count() === 0, sc + ': no free-text inputs');
    T.ok(!/bad gene|defective/i.test(await p.locator(P).innerText()) && !/bad gene|defective/i.test(await p.locator(G).innerText()), 'no "bad gene" wording');

    // --- keyboard only (pedigree) ---
    await p.evaluate(k => localStorage.removeItem(k), KEY);
    await p.reload();
    await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current'));
    await go(p, 'lakita');
    T.ok(await p.locator(P + ' .ped-person[tabindex="0"]').count() === 1 && await p.locator(P + ' .ped-person[tabindex="-1"]').count() === 8, 'roving tabindex: one tab stop in the tree');
    await p.focus(person(P, 'grandfather'));
    await p.keyboard.press('ArrowRight');
    T.ok(await p.evaluate(() => document.activeElement.dataset.person) === 'grandmother', 'ArrowRight moves to the next person');
    await p.keyboard.press('ArrowDown');
    T.ok(['aunt3', 'uncle'].includes(await p.evaluate(() => document.activeElement.dataset.person)), 'ArrowDown moves to the next generation');
    await p.keyboard.press('End'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowDown');
    T.ok(await p.evaluate(() => document.activeElement.dataset.person) === 'lakita', 'father, then down, reaches Lakita');
    await p.keyboard.press('ArrowUp');
    T.ok(await p.evaluate(() => document.activeElement.dataset.person) === 'father', 'ArrowUp goes back to a parent');
    await p.keyboard.press('Enter');
    T.ok(await p.evaluate(() => document.activeElement.classList.contains('ped-chip')) && /Lakita’s father/.test(await p.locator(P + ' .ped-panel h4').innerText()), 'Enter opens the chooser and focuses the first genotype');
    await p.keyboard.press('Tab'); await p.keyboard.press('Space');
    T.ok(await p.getAttribute(P + ' .ped-chip[data-genotype="AB"]', 'aria-pressed') === 'true' && /Yes! Only AB fits/.test(await msg(p, P + ' .ped-msg')), 'Tab and Space pick AB for the father with the keyboard');
    await p.keyboard.press('Escape');
    T.ok(await p.evaluate(() => document.activeElement.dataset && document.activeElement.dataset.person) === 'father', 'Escape returns to the person');
    T.ok(await p.locator('#announcer').innerText() !== '', 'announcements go to the page live region');

    // --- two-gene: the people and the key's alleles ---
    await go(p, 'twogene');
    const tg = await p.$$eval(G + ' .tg-person', gs => gs.map(g => ({ id: g.dataset.person, sex: g.dataset.sex, level: g.dataset.level, label: g.getAttribute('aria-label') })));
    T.ok(tg.map(x => x.id + ':' + x.sex).join() === 'father:male,mother:female,child1:male,child2:male,child3:female', 'father, mother and three children with the reference symbols (square, circle, square, square, circle)');
    T.ok(/chromosomes A–C and B–D, p53 AB, BRCA1 CD.*Higher/.test(tg[0].label) && /chromosomes A–C and A–C, p53 AA, BRCA1 CC.*Lower/.test(tg[1].label) && /chromosomes A–C and A–C.*Lower/.test(tg[2].label) &&
      /chromosomes B–C and A–C, p53 AB, BRCA1 CC.*Medium/.test(tg[3].label) && /chromosomes A–D and A–C, p53 AA, BRCA1 CD.*Medium/.test(tg[4].label), 'chromosomes, genotypes and likelihood match the reference and key: ' + tg.map(x => x.label).join(' | '));
    T.ok(await p.locator(G + ' .tg-chr').count() === 10 && await p.locator(G + ' .tg-legend').innerText().then(t => /Lower/.test(t) && /Medium/.test(t) && /Higher/.test(t)), 'ten chromosomes and a labelled likelihood scale');
    const bands = await p.$$eval(person(G, 'father') + ' text', ts => ts.map(t => t.textContent).filter(x => /^[ABCD]$/.test(x)).join(''));
    T.ok(bands === 'ACBD', 'the father’s letters read A, C, B, D (p53 above BRCA1 on each chromosome): ' + bands);

    // --- activity 1: read the chromosomes ---
    await p.click(person(G, 'father'));
    await p.click(G + ' .tg-chip[data-gene="p53"][data-genotype="AA"]');
    T.ok(/Not quite.*top spots \(p53\)/.test(await msg(p, G + ' .tg-msg')), 'a wrong p53 pick says where to look');
    await p.click(G + ' .tg-chip[data-gene="p53"][data-genotype="AB"]');
    T.ok(/^Yes\. Father has p53 AB/.test(await msg(p, G + ' .tg-msg')), 'a right p53 pick is confirmed');
    await p.click(G + ' .tg-chip[data-gene="brca1"][data-genotype="CD"]');
    T.ok(/^Yes! Father: p53 AB, BRCA1 CD\. Chance of cancer in the model: Higher/.test(await msg(p, G + ' .tg-msg')), 'both genes right: the likelihood is shown');
    await p.click(person(G, 'child3'));
    await p.click(G + ' .tg-chip[data-gene="p53"][data-genotype="AA"]'); await p.click(G + ' .tg-chip[data-gene="brca1"][data-genotype="CD"]');
    const twoText = await p.locator('#data-twogene-body').innerText();
    T.ok(/Father\s*AB\s*CD\s*Higher/.test(twoText.replace(/\n+/g, ' ')) && /Child 3\s*AA\s*CD\s*Medium/.test(twoText.replace(/\n+/g, ' ')), 'the two-gene "Your data" box fills from the scene: ' + twoText.replace(/\s+/g, ' ').slice(0, 120));
    T.ok(await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)).twoGene; return d.genotypes.father.p53 === 'AB' && d.genotypes.child3.brca1 === 'CD' && !d.genotypes.mother; }, KEY), 'saved genotypes are only the ones read correctly');

    // --- activity 2: who has both risk alleles ---
    await p.getByRole('button', { name: '2 Both risk alleles' }).click();
    await p.click(person(G, 'mother'));
    T.ok(/Not this one\. Mother has A, C: no risk alleles/.test(await msg(p, G + ' .tg-msg')), 'the mother does not have both');
    await p.click(person(G, 'child3'));
    T.ok(/Child 3 has A, C, D: only D/.test(await msg(p, G + ' .tg-msg')), 'child 3 has only D');
    await p.click(person(G, 'father'));
    T.ok(/^Yes\. Father has B \(p53\) and D \(BRCA1\)/.test(await msg(p, G + ' .tg-msg')), 'the father has both risk alleles');

    // --- activity 3: new mixes ---
    await p.getByRole('button', { name: '3 New mixes' }).click();
    await p.click(person(G, 'child1'));
    T.ok(/Not this one\. Child 1 got a whole chromosome from each parent/.test(await msg(p, G + ' .tg-msg')), 'child 1 needs no swap');
    await p.click(person(G, 'child2'));
    T.ok(/B–C matches neither parent’s chromosomes.*crossing over/.test(await msg(p, G + ' .tg-msg')), 'child 2 has a new chromosome');
    await p.click(person(G, 'child3'));
    const concl = await msg(p, G + ' .tg-msg');
    T.ok(/A–D matches neither parent/.test(concl) && /Children 2 and 3 each have a chromosome that neither parent has/.test(concl) && /a swap between the two chromosomes of a pair \(crossing over\) in the father/i.test(concl), 'conclusion names children 2 and 3 and crossing over in the father: ' + concl);
    T.ok(await p.evaluate(k => JSON.parse(localStorage.getItem(k)).twoGene.mismatch.join() + '|' + JSON.parse(localStorage.getItem(k)).twoGene.carrier, KEY) === 'child2,child3|father', 'carrier and mismatch are saved');
    T.ok(await p.locator(G + ' .tg-chr.is-new').count() === 2, 'the two new chromosomes are outlined');

    // --- activity 4: trace (reduced motion: static steps) ---
    await p.getByRole('button', { name: '4 Trace the chromosomes' }).click();
    T.ok(await p.locator(G + ' .tg-actions button:has-text("Play")').count() === 0, 'reduced motion: no autoplay button, only Back and Next');
    await p.click(person(G, 'child1'));
    T.ok(/step 1 of 3/.test(await p.locator(G + ' .tg-panel h4').innerText()) && /whole chromosome: A–C/.test(await msg(p, G + ' .tg-msg')), 'child 1: whole chromosomes, three steps');
    await p.click(person(G, 'child2'));
    T.ok(/step 1 of 5/.test(await p.locator(G + ' .tg-panel h4').innerText()), 'child 2 needs five steps (a swap)');
    await p.getByRole('button', { name: 'Next' }).click();
    T.ok(/Crossing over: the pair swap their lower pieces/.test(await msg(p, G + ' .tg-msg')) && await p.locator(G + ' svg.tg-trace[role="img"][aria-label*="after crossing over: A–D and B–C"]').count() === 1, 'step 2 shows the swap (A–D and B–C)');
    await p.getByRole('button', { name: 'Next' }).click(); await p.getByRole('button', { name: 'Next' }).click(); await p.getByRole('button', { name: 'Next' }).click();
    T.ok(/B–C and A–C\. B–C is on neither parent’s chromosomes/.test(await msg(p, G + ' .tg-msg')) && await p.evaluate(k => JSON.parse(localStorage.getItem(k)).twoGene.traced.child2, KEY) === true, 'last step names the new chromosome and is saved as traced');

    // --- two-gene reload and keyboard ---
    await p.reload();
    await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current'));
    await go(p, 'twogene');
    T.ok(await p.locator(G + ' .tg-chr.is-new').count() === 2 && /Father\s*AB\s*CD/.test((await p.locator('#data-twogene-body').innerText()).replace(/\n+/g, ' ')) && await p.locator(G + ' .tg-badge.ok').count() === 2, 'two-gene state survives a reload');
    await p.focus(person(G, 'father'));
    await p.keyboard.press('ArrowRight'); T.ok(await p.evaluate(() => document.activeElement.dataset.person) === 'mother', 'two-gene: ArrowRight');
    await p.keyboard.press('ArrowDown'); T.ok(['child2', 'child3'].includes(await p.evaluate(() => document.activeElement.dataset.person)), 'two-gene: ArrowDown');
    await p.getByRole('button', { name: '1 Read the chromosomes' }).click();
    await p.focus(person(G, 'child1')); await p.keyboard.press('Enter');
    T.ok(await p.evaluate(() => document.activeElement.classList.contains('tg-chip')), 'two-gene: Enter opens the chooser');

    T.ok(problems.length === 0, 'no page errors or console errors: ' + problems.join(' | '));
    await ctx.close();

    // --- animation on, then Play works and ends on the last step ---
    const ctx2 = await T.ctxFor(browser, { width: 1366, height: 900 });
    const q = await ctx2.newPage(); await stub(q);
    await q.goto(server.url + PAGE + '#twogene'); await q.waitForFunction(() => document.querySelector('#twogene.is-current') && window.B3Inh);
    await q.getByRole('button', { name: '4 Trace the chromosomes' }).click(); await q.click(person(G, 'child3'));
    T.ok(await q.locator(G + ' .tg-actions button:has-text("Play")').count() === 1, 'with motion allowed there is a Play button');
    await q.getByRole('button', { name: 'Play' }).click();
    await q.waitForFunction(g => /step 5 of 5/.test(document.querySelector(g + ' .tg-panel h4').textContent), G, { timeout: 15000 });
    T.ok(/A–D and A–C/.test(await msg(q, G + ' .tg-msg')), 'Play steps through to the end for child 3');
    await ctx2.close();
  } finally { await browser.close(); server.close(); }
  T.done('t97-pedigree-scene');
})().catch(e => { console.error(e); process.exit(1); });
