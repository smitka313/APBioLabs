/* Lab 4–6 optional reasoning checklist: native, keyboard-operable reflection only.
   Selections are deliberately not saved or included in student reports. */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  try {
    for (const lab of ['04', '05', '06']) {
      const ctx = await T.ctxFor(b);
      const p = await T.open(ctx, 'lab' + lab + '.html', 'analyze');
      const section = p.locator('details').filter({ hasText: 'Scientific reasoning self-check (optional)' });
      T.ok(await section.count() === 1, 'lab' + lab + ': optional self-check is available');
      await section.locator('summary').click();
      const boxes = section.locator('.reasoning-checklist input[type="checkbox"]');
      T.ok(await boxes.count() === 4, 'lab' + lab + ': four self-reflection checkpoints');
      T.ok(await p.getByRole('checkbox', { name: /My claim/ }).count() === 1, 'lab' + lab + ': checkbox has an accessible label');
      const wellFormed = await section.evaluate(el => {
        const fieldset = el.querySelector('fieldset.reasoning-checklist');
        const inputs = [...fieldset.querySelectorAll('input[type=checkbox]')];
        return !!fieldset.querySelector('legend') && inputs.length === 4 &&
          inputs.every(input => input.labels && input.labels.length === 1 && input.closest('label'));
      });
      T.ok(wellFormed, 'lab' + lab + ': checklist uses a labeled fieldset and native checkboxes');
      await boxes.first().focus();
      await p.keyboard.press('Space');
      T.ok(await boxes.first().isChecked(), 'lab' + lab + ': checkbox works with the keyboard');
      const excluded = await p.evaluate(() => {
        const inputs = [...document.querySelectorAll('.reasoning-checklist input[type=checkbox]')];
        return inputs.every(input => !input.hasAttribute('data-save') &&
          !input.closest('[data-responses]') &&
          !Lab._reg.prompts.some(prompt => prompt.el.contains(input)));
      });
      T.ok(excluded, 'lab' + lab + ': checkmarks are outside saved answers and reports');
      await p.reload();
      const reloaded = p.locator('details').filter({ hasText: 'Scientific reasoning self-check (optional)' });
      await reloaded.locator('summary').click();
      T.ok(!(await reloaded.locator('.reasoning-checklist input[type="checkbox"]').first().isChecked()),
        'lab' + lab + ': reflection checkmarks are not saved');
      T.ok(p.errors.length === 0, 'lab' + lab + ': no page errors');
      await ctx.close();
    }
  } finally { await b.close(); }
  T.done('lab4-6-reasoning-self-checks');
})().catch(e => { console.error(e); process.exitCode = 1; });
