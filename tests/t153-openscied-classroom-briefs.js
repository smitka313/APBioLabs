'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const file = 'openscied-classroom-briefs.html';
const raw = fs.readFileSync(path.join(root, file), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'tools/openscied-classroom-briefs.json'), 'utf8'));
const ids = data.map(d => d.id);
const hub = fs.readFileSync(path.join(root, 'teacher-hub.html'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'openscied-teacher-guide.html'), 'utf8');
assert.equal(new Set(ids).size, 24);
assert.deepEqual([...raw.matchAll(/<article class="brief-sheet" id="([^"]+)"/g)].map(x => x[1]), ids);
assert.deepEqual([...hub.matchAll(/openscied-classroom-briefs\.html#(openscied-b[1-5]-[a-z\d-]+)/g)].map(x => x[1]), ids);
assert.match(guide, /href="openscied-classroom-briefs.html"/);
assert.match(raw, /data-goatcounter=/);
assert.doesNotMatch(raw, /teacher-notes\.html|password|answer key/i);
for (const id of ids) {
  assert.ok(raw.includes('https://biologylabbench.com/' + id));
  if (!process.argv.includes('--contract')) assert.ok(fs.existsSync(path.join(root, id + '.html')));
}
execFileSync('python3', ['tools/build-classroom-briefs.py','--check'], { cwd: root });
console.log('24 briefs match the generator and all teacher hub links');
if (process.argv.includes('--contract')) process.exit(0);

const {chromium} = require('playwright');
const {serve} = require('./_h');
(async () => {
  const {url,close} = await serve();
  let browser;
  try {
    browser = await chromium.launch();
    for (const width of [390, 1366]) {
      const ctx = await browser.newContext({viewport:{width,height:844}});
      try {
        const base = new URL(url).origin;
        await ctx.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
        const page = await ctx.newPage();
        await page.addInitScript(fallback => {
          Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{
            if (fallback) throw new Error('clipboard blocked'); window.__copiedBrief = value;
          }}});
          window.print = () => { window.__printedBrief = true; };
        }, width===390);
        const longest = data.reduce((a,b) => JSON.stringify(b).length > JSON.stringify(a).length ? b : a);
        const selected = width===390 ? ids[0] : longest.id;
        await page.goto(url+file+'#'+selected);
        const card = page.locator('#'+selected);
        await card.locator('[data-brief-copy]').click();
        if (width===390) {
          const dialog=page.locator('#brief-copy-dialog[open]');
          await dialog.waitFor();
          assert.match(await dialog.locator('textarea').inputValue(), /https:\/\/biologylabbench\.com\/openscied-/);
          await dialog.getByRole('button',{name:'Close'}).click();
          await dialog.waitFor({state:'hidden'});
          assert.ok(await card.locator('[data-brief-copy]').evaluate(el=>document.activeElement===el));
        } else {
          await page.waitForFunction(() => window.__copiedBrief?.includes('Turn in:'));
          assert.match(await page.evaluate(()=>window.__copiedBrief), /If a resource is blocked:/);
        }
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        await card.locator('[data-brief-print]').click();
        await page.waitForFunction(()=>window.__printedBrief);
        await page.emulateMedia({media:'print'});
        assert.equal(await page.locator('.brief-sheet:visible').count(),1);
        assert.ok(await card.locator('.print-link').isVisible());
        if (width===1366) {
          // Chromium can render the selected print view directly, with no OS dialog.
          const pdf = await page.pdf({format:'Letter',printBackground:true});
          assert.equal(pdf.subarray(0,4).toString(),'%PDF');
          assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1);
        }
        await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
        assert.equal(await page.locator('body[data-print-brief]').count(),0);
      } finally { await ctx.close(); }
    }
    console.log('Copy paths and selected single-page print at desktop and phone widths passed');
  } finally { if (browser) await browser.close(); close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
