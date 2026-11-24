/* Lesson 4 alignment: the class word "mutation" is named. The legend and the model-assumptions text say a control
   change in this model is a mutation; Questions 4a, 4b and 5 and their hints use the word; the careful framing stays.
   T92_ROOT=<dir> runs the checks against another copy of the site. */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve(process.env.T92_ROOT || undefined);
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900, reduced: true });
    const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'growth-model', server.url);
    const text = sel => p.locator(sel).first().textContent().then(t => t.replace(/\s+/g, ' ')).catch(() => '');
    const legend = await text('.cell-state-legend');
    T.ok(/In this model, a control change is a mutation/.test(legend), 'the legend says a control change is a mutation');
    T.ok(/One mutation is not enough/.test(legend) && /cancerous state/.test(legend), 'the legend keeps "one change is not enough" and the cancer-state wording');
    const assume = await p.locator('.model-assumptions').evaluate(e => e.textContent.replace(/\s+/g, ' '));
    T.ok(/In this model, a control change is a mutation/.test(assume), 'the model-assumptions text says it too');
    T.ok(/cancer is not inevitable/i.test(assume) && /not a prediction for any individual/i.test(assume) && /A single change does not turn it cancerous/.test(assume), 'the careful framing is intact (not inevitable, single change not enough, no individual prediction)');
    const q = id => p.evaluate(id => { const f = document.getElementById(id), l = document.querySelector('label[for="' + id + '"]'); const ids = (f.getAttribute('aria-describedby') || '').split(' ').map(i => (document.getElementById(i) || { textContent: '' }).textContent); return l.textContent + ' ' + ids.join(' ') + ' ' + f.placeholder; }, id);
    T.ok(/mutation/i.test(await q('explanation')), 'Question 4a and its hint use the word "mutation"');
    T.ok(/mutation/i.test(await q('explanation-size').catch(() => '')), 'Question 4b and its hint use the word "mutation"');
    T.ok(/mutation/i.test(await q('analysis-cancer')) && /single mutation is not enough/i.test(await q('analysis-cancer')), 'Question 5 and its hint use "mutation" and say one is not enough');
    T.ok(/mutation/i.test(await text('.growth-model-intro, #growth-model .prose')) , 'the section intro mentions that every division is a chance for a mutation');
    T.ok(/more starting cells or more time usually lead to more divisions/i.test(await text('#growth-model .prose')), 'the Lesson 4 intro says more cells or time generally lead to more divisions in the model');
    T.ok(/does not guarantee a mutation or cancer/.test(assume), 'the text still says a division does not guarantee a mutation or cancer');
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t92-mutation-wording');
})();
