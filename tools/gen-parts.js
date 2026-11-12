/* Rewrites the "Parts" column of the table in teachers.html from the live lab pages, so it always uses the same
   numbers as each lab's progress count (parts that contain student work: prompts, quizzes, tables or simulation steps).
   Run after changing the parts of any lab:   NODE_PATH=$(npm root -g) node tools/gen-parts.js
   tests/t05b-teachers.js fails if teachers.html and the labs disagree. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('aplab:student', JSON.stringify({ name: 'Counter', period: '1' })); localStorage.setItem('aplab:tour', JSON.stringify({ seen: true, v: 1 })); } catch (e) { /* ignore */ } });
  let html = fs.readFileSync(path.join(ROOT, 'teachers.html'), 'utf8');
  for (let i = 1; i <= 13; i++) {
    const id = 'lab' + String(i).padStart(2, '0'), p = await ctx.newPage();
    await p.goto('file://' + ROOT + '/' + id + '.html'); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => Lab.progress.update());
    await p.close();
    const re = new RegExp('(<th scope="row"><a href="' + id + '\\.html">[^<]*</a></th>.*?)<td class="num">[^<]*</td></tr>');
    if (!re.test(html)) throw new Error('row not found for ' + id);
    html = html.replace(re, `$1<td class="num">${r.sections} parts (${r.total} with work)</td></tr>`);
    console.log(id, r.sections, 'parts,', r.total, 'with work');
  }
  fs.writeFileSync(path.join(ROOT, 'teachers.html'), html);
  await b.close();
})();
