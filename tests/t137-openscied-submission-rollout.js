'use strict';
// The student report remains reachable before an investigation is finished.
// Exercise every adapter and verify that opening its preview never starts or modifies work.
const assert = require('node:assert/strict');
const T = require('./_h');
const pages = [
  'b1-migration','b1-carrying-capacity','b1-serengeti',
  'b2-burn-lab','b2-fires','b2-peat-bog-lab','b2-carbon-journey',
  'b3-cancer-rates','b3-cell-cycle','b3-dna-p53','b3-dna-workshop','b3-inheritance-environment',
  'b4-hawksbeard','b4-rat-generations','b4-junco'
];
const progress = page => page.evaluate(() => Object.keys(localStorage)
  .filter(key => key.startsWith('aplab:openscied'))
  .sort().map(key => [key, localStorage.getItem(key)]));
(async () => {
  const server = await T.serve();
  const browser = await T.launch();
  const failures = [];
  try {
    for (const [index, slug] of pages.entries()) {
      const phone = index % 4 === 0;
      const context = await T.ctxFor(browser, phone ? { width:390, height:844, dark:true, reduced:true } : { width:1366, height:900 });
      try {
        const page = await context.newPage();
        await page.route('https://gc.zgo.at/**', route => route.fulfill({body:''}));
        const errors = [];
        page.on('pageerror', err => errors.push(String(err)));
        await page.goto(server.url + 'openscied-' + slug + '.html');
        const launch = page.getByRole('button', {name:'Preview report', exact:true});
        await launch.waitFor({state:'visible'});
        assert.equal(await launch.count(),1,slug + ' uses one launcher instead of duplicating actions');
        assert.equal(await page.getByRole('button',{name:'Download Word (.docx)',exact:true}).count(),0,slug + ' does not expose Word as a competing main-page choice');
        assert.equal(await page.getByRole('button',{name:'Classroom report options',exact:true}).count(),0,slug + ' has no duplicate navigation to the report');
        if (slug === 'b2-peat-bog-lab') {
          await page.locator('.step-nav a[href="#trials"]').click();
          // The original launcher remains visible until the pager moves it into My trials.
          // Wait for that specific move, not for a launcher that may still be on the old step.
          const trialsLauncher = page.locator('#trials [data-ose-report-final]').getByRole('button',{name:'Preview report',exact:true});
          await trialsLauncher.waitFor({state:'visible', timeout:5000});
          assert.equal(await launch.count(),1,'Peat: moving into My trials does not duplicate the launcher');
          assert.equal(await trialsLauncher.count(),1,
            'Peat: the same launcher is in My trials near the recorded work');
          const other = page.getByText('Other downloads and backups',{exact:true});
          assert.ok(await other.isVisible());
          assert.equal(await page.locator('#download-work').isVisible(),false,'Peat: JSON does not compete with the default report');
          assert.equal(await page.locator('#print-work').isVisible(),false,'Peat: legacy print does not compete with the default report');
          await other.click();
          assert.equal(await page.locator('#download-work').isVisible(),true,'Peat: old recovery/analysis file remains accessible');
          await other.click();
        }
        const before = await progress(page);
        await launch.click();
        const dialog = page.getByRole('dialog').filter({has:page.getByRole('button', {name:'Close report'})});
        await dialog.waitFor();
        assert.equal(await dialog.locator('.osr-title:focus').count(), 1, slug + ' focuses the report title');
        const reportText = await dialog.innerText();
        assert.match(reportText, /In progress/i, slug + ' starts as a draft');
        assert.doesNotMatch(reportText, /Activity complete|Bench-verified stamp/i, slug + ' must not stamp empty work');
        assert.match(reportText, /Evidence source:/, slug + ' reports provenance');
        assert.match(reportText, /Class period/, slug + ' includes a student identity field');
        assert.equal(await dialog.getByRole('button', {name:'Print or save as PDF'}).count(), 1);
        assert.equal(await dialog.getByRole('button', {name:'Download Word (.docx)', exact:true}).count(), 0);
        await dialog.getByText('More formats', {exact:true}).click();
        assert.equal(await dialog.getByRole('button', {name:'Download Word (.docx)', exact:true}).count(), 1);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), slug + ' page fits the viewport');
        await page.keyboard.press('Escape');
        await dialog.waitFor({state:'hidden'});
        assert.ok(await launch.evaluate(el => document.activeElement === el), slug + ' returns focus to the launch button');
        assert.deepEqual(await progress(page), before, slug + ' preview never modifies stored work');
        assert.deepEqual(errors, [], slug + ' no uncaught browser errors');
        console.log('PASS ' + slug + ' ' + (phone?'390 dark':'1366 light'));
      } catch (error) {
        failures.push(slug + ': ' + (error && error.stack || String(error)));
      } finally {
        await context.close();
      }
    }
    if (failures.length) throw new Error(failures.join('\n\n'));
  } finally {
    await browser.close(); server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
