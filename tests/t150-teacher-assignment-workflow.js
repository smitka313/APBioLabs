'use strict';

// Focused smoke on a repository export. Copy into tests/ and run with browser dependencies installed.
// No production network, real users, fixture passwords, or seeded localStorage. --contract only
// validates launch shape; it does not claim a Chromium pass.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HUB = 'teacher-hub.html';
const HELP = 'privacy-help.html';
const SAMPLE = 'sample-student-report.html';
const MIGRATION = 'openscied-b1-migration.html';
const DASHBOARD = 'openscied-dashboard.html';
const KEY = 'aplab:openscied:b1-migration:v1';
const ORIGIN = 'https://biologylabbench.com';
const note = 'January example: I noticed the modeled herd stays on the southern plains.';
const helpAnchors = ['saving', 'sharing-devices', 'reports', 'tracking', 'blocked'];
const views = [
  { viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' },
  { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' }
];

function read(root, file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function hasId(raw, s) { return new RegExp('\\bid=["\\\']' + s + '["\\\']').test(raw); }

async function contract(root) {
  const hub = read(root,HUB), help = read(root,HELP), sample = read(root,SAMPLE);
  for (const id of ['ap', 'openscied', 'assign-status', 'assign-copy-dialog', 'assign-copy-url']) assert.ok(hasId(hub,id), id);
  for (const id of helpAnchors) assert.ok(hasId(help,id), HELP+'#'+id);
  for (const f of [HELP,SAMPLE,MIGRATION,'lab01.html']) assert.match(hub,new RegExp('href="'+f.replace('.','\\.')+'(?:#[-\\w]+)?"'),f);
  const copyTargets = [...hub.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*\bdata-assignment\b[^>]*>/g)].map(m=>m[1]);
  assert.equal(copyTargets.length, 37, '13 AP + 24 companion activities');
  assert.equal(new Set(copyTargets).size, copyTargets.length, 'no duplicated assignment routes');
  for (const f of copyTargets) assert.match(f,/^(?:lab\d\d|openscied-b[1-5]-[a-z\d-]+)\.html$/);
  assert.match(sample,/fictional/i);
  assert.doesNotMatch(sample,/sample-report-lab05|53V-BFN|sample-report:start/i);
  const cards = [...hub.matchAll(/<article class="assign-card">[\s\S]*?<\/article>/g)].map(m => m[0]);
  assert.equal(cards.length, 37, 'all activities have an assignment');
  for (const name of ['assign-copy-title', 'assign-copy-url-label', 'assign-copy-text', 'assign-copy-text-label']) {
    assert.ok(hasId(hub, name), 'copy dialog includes ' + name);
  }
  for (const [guide, course] of [['teachers.html','ap'],['openscied-teacher-guide.html','openscied']]) {
    assert.ok(read(root, guide).includes('href="teacher-hub.html#' + course + '"'), 'guide links to its assignment list');
  }
  const js=read(root,'teacher-hub.js');
  // Exercise the shipped click handler using each real card's public text.
  // This contract alone does not test native clipboard permission or dialog rendering.
  for (const [i, raw] of cards.entries()) {
    assert.match(raw, /<button\b[^>]*\bdata-copy-assignment\b[^>]*>Copy assignment/);
    const text = value => ({textContent:value.replace(/&amp;/g, '&')});
    const titleText = raw.match(/<h4>([^<]+)<\/h4>/)[1];
    assert.ok(raw.includes('aria-label="Copy assignment: ' + titleText + '"'), 'report the exact activity title to assistive technology');
    const timing = raw.match(/<p class="assign-meta">.*?<span>([^<]+)<\/span>/s)[1];
    const turnIn = raw.match(/<p class="assign-turnin"><strong>Turn in:<\/strong> ([^<]+)/)[1];
    for (const full of [false,true]) for (const clipboard of [true,false]) {
      let copied, focused=false, open=false, fallbackOnClose, handler;
      const status={textContent:''}, title={textContent:''};
      const field = () => ({value:'', selected:false, focus(){}, select(){this.selected=true;}});
      const urlField=field(), textField=field(), urlLabel={}, textLabel={};
      const dialog={addEventListener(type,fn){assert.equal(type,'close');fallbackOnClose=fn;},showModal(){open=true;}};
      const ct={
        '[data-assignment]':{getAttribute(){return copyTargets[i];}},
        'h4':text(titleText), '.assign-meta span':text(timing), '.assign-turnin':text('Turn in: ' + turnIn),
      };
      const button={
        hidden:true,hasAttribute(){return full;},addEventListener(type,fn){assert.equal(type,'click');handler=fn;},
        focus(){focused=true;},closest(){return {querySelector(selector){return ct[selector];}};},
      };
      const els={
        '.teacher-hub':{querySelectorAll(){return [button];}}, '#assign-status':status, '#assign-copy-dialog':dialog,
        '#assign-copy-title':title, '#assign-copy-url':urlField, '#assign-copy-url-label':urlLabel,
        '#assign-copy-text':textField, '#assign-copy-text-label':textLabel,
      };
      vm.runInNewContext(js,{document:{querySelector(s){return els[s];}},
        navigator:{clipboard:{writeText:async value=>{if(!clipboard) throw new Error('clipboard denied'); copied=value;}}},
        URL,setTimeout(){return 1;},clearTimeout(){}});
      assert.equal(button.hidden,false);
      await handler();
      const url=ORIGIN+'/'+copyTargets[i].replace(/\.html$/,'');
      const usedField=full?textField:urlField;
      const value=clipboard?copied:usedField.value;
      if (full) {
        assert.ok(value.startsWith(text(titleText).textContent + '\n\n'));
        assert.ok(value.includes('Open the activity: ' + url + '\n\n'));
        assert.ok(value.includes('Estimated time: ' + text(timing).textContent));
        assert.ok(value.includes('Turn in: ' + text(turnIn).textContent));
        if (copyTargets[i] === 'openscied-b4-junco.html') {
          assert.match(value, /Turn in: A field observation, an aviary prediction, an evidence-based explanation, and one limit or next question[.]/);
          assert.match(value, /Virtual trials are optional[.]/);
          assert.doesNotMatch(value, /Turn in: Trial observations/);
        }
        assert.match(value,/Upload one file to this Schoology assignment[.]$/);
        assert.doesNotMatch(value,/teacher-(?:lab|notes)|aplab:/);
      } else assert.equal(value,url);
      if (clipboard) {
        assert.match(status.textContent,/copied/i); assert.equal(open,false);
      } else {
        assert.equal(open,true); assert.equal(usedField.selected,true);
        assert.equal(urlLabel.hidden,full); assert.equal(textLabel.hidden,!full);
        fallbackOnClose();
        assert.equal(focused,true); assert.equal(usedField.value,'');
      }
    }
  }
  console.log('PASS HTML contracts and isolated copy success/fallback logic');
}

async function assertFits(page, label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), label+' has horizontal page overflow at width '+(page.viewportSize()?.width||'?'));
}
function localLink(scope, dest) {
  return scope.locator('a[href="'+dest+'"]').filter({visible:true}).first();
}
async function checkViews(browser,base,opt,routeLibs) {
  const context=await browser.newContext({ ...opt,acceptDownloads:true });
  const origin=new URL(base).origin, blocked=[];
  // No tracking pings, outside fonts, iframes or external library requests.
  // Force media and Word-export failures so fallback UI gets checked.
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin===origin)return route.continue();
    blocked.push(url.href);
    return route.abort('blockedbyclient');
  });
  try {
    const page=await context.newPage();page.setDefaultTimeout(9000);
    const errors=[];page.on('pageerror',x=>errors.push(x.message));
    const go=f=>page.goto(new URL(f,base).href, {waitUntil:'domcontentloaded'});
    const testClipboard=async deny=>page.addInitScript(deny=> {
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
        writeText:async text=>{ if(deny)throw new DOMException('Blocked in regression test','NotAllowedError'); window.__blbTestCopy=text; }
      }});
    },deny);
    await testClipboard(false);
    await go('index.html');await localLink(page,HUB).click();
    await page.locator('#ap').waitFor();
    assert.equal(await page.locator('#ap .assign-card').count(),13);
    assert.equal(await page.locator('#openscied .assign-card').count(),24);
    await assertFits(page,HUB);
    const cardFor=dest=>page.locator('.assign-card').filter({has: page.locator('[data-assignment][href="'+dest+'"]')});
    const migrationCard=cardFor(MIGRATION), copy=migrationCard.locator('[data-copy]');
    await copy.click();
    await page.waitForFunction(()=>document.querySelector('#assign-status')?.textContent.includes('copied'));
    const copied=await page.evaluate(()=>window.__blbTestCopy);
    assert.equal(copied,ORIGIN+'/'+MIGRATION.replace(/\.html$/,''));
    assert.equal(new URL(copied).search+new URL(copied).hash,'');

    const fullCopy=migrationCard.getByRole('button',{name:'Copy assignment: Migration Map Explorer',exact:true});
    await fullCopy.press('Enter');
    await page.waitForFunction(()=>window.__blbTestCopy?.startsWith('Migration Map Explorer\n'));
    const migrationText=await page.evaluate(()=>window.__blbTestCopy);
    assert.ok(migrationText.includes(copied));
    assert.match(migrationText,/Estimated time: 40–50 min for selected questions/);
    assert.match(migrationText,/Schoology assignment/);
    await cardFor('lab01.html').locator('[data-copy-assignment]').click();
    await page.waitForFunction(()=>window.__blbTestCopy?.startsWith('Artificial Selection\n'));
    const apText=await page.evaluate(()=>window.__blbTestCopy);
    assert.match(apText,/Estimated time: 115 min/);
    assert.match(apText,/In Submit, download your report as Word/);
    await localLink(page,SAMPLE).click();
    await page.getByRole('heading',{level:1,name:/sample student report/i}).waitFor();
    assert.match(await page.locator('main').innerText(),/fictional/i);
    assert.equal(await page.locator('main input[type=password]').count(),0);
    await assertFits(page,SAMPLE);
    for(const id of helpAnchors) {
      await go(HELP+'#'+id);
      const target=page.locator('#'+id);
      assert.equal(await target.count(),1);await target.waitFor({state:'visible'});
      assert.equal(new URL(page.url()).hash,'#'+id);
      await assertFits(page,HELP+'#'+id);
    }

    // Text and native-link paths are both available without a login.
    await go(HUB+'#ap');await cardFor('lab01.html').locator('[data-assignment]').click();
    await page.getByRole('heading',{level:1,name:/artificial selection/i}).waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('aplab:student')),null,
      'assignment path should not autofill an identity');
    await go(HUB+'#openscied');
    await migrationCard.locator('[data-assignment]').click();
    await page.locator('#observation').fill(note);
    await page.locator('#record').click();
    await page.waitForFunction(({key,note})=>JSON.parse(localStorage.getItem(key)||'null')?.notes?.some(n=>n.observation===note),{key:KEY,note});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(({key,note})=>JSON.parse(localStorage.getItem(key)||'null')?.notes?.some(n=>n.observation===note),{key:KEY,note});
    await page.locator('[data-page="evidence"]').click();
    const blockedVideo=page.waitForEvent('requestfailed',{predicate:req=>req.url().includes('youtube-nocookie.com/embed/')});
    await page.locator('details.ose-video summary').click();
    await blockedVideo;
    assert.ok(await page.locator('.ose-video-fallback a').first().isVisible());
    assert.ok(await page.locator('#card-groups').isVisible(),'source card alternative visible when player request is blocked');
    await page.locator('[data-page="explain"]').click();
    await page.getByRole('button',{name:'Preview report',exact:true}).filter({visible:true}).first().click();
    const report=page.locator('dialog.osr-dialog[open]');
    await report.waitFor();
    assert.ok((await report.innerText()).includes(note),'saved note appears in report preview');
    const wordAction=report.getByRole('button',{name:'Download Word (.docx)',exact:true});
    assert.ok(await wordAction.isVisible(),'Word download is available directly in the report preview');
    await wordAction.click();
    await report.getByText(/Could not download the Word file/i).waitFor({timeout:18000});
    assert.ok(await report.getByRole('button',{name:'Print or save as PDF',exact:true}).isVisible());
    assert.ok(blocked.some(u=>u.includes('docx@')),'Word exporter requests actually blocked');
    // Permit only the same Word library from the repository's installed test dependencies.
    // The page must recover after the earlier failure; no external request is sent.
    await routeLibs(context);
    const downloaded=page.waitForEvent('download',{timeout:18000});
    await report.getByRole('button',{name:'Download Word (.docx)',exact:true}).click();
    const file=await downloaded;
    assert.match(file.suggestedFilename(),/^migration-investigation-draft\.docx$/);
    assert.equal(await file.failure(),null);
    const bytes=fs.readFileSync(await file.path());
    assert.equal(bytes.subarray(0,2).toString(),'PK','downloads a nonempty Word archive');
    assert.ok(bytes.length>1024);
    await report.getByRole('button',{name:'Close report',exact:true}).click();
    await go(DASHBOARD);
    const resume=page.locator('#openscied-resume-link');
    await resume.waitFor();
    assert.ok(new URL(await resume.getAttribute('href'),base).pathname.endsWith('/'+MIGRATION));
    await resume.click();
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null').notes[0].observation,KEY),note);
    assert.deepEqual(errors,[],'uncaught JavaScript errors');

    // Separate fresh context = different browser/profile. No fixture storage can conceal leakage.
    const other=await browser.newContext(opt);
    try {
      await other.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
      const guest=await other.newPage();guest.setDefaultTimeout(9000);
      await guest.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{
        configurable:true,value:{writeText:async()=>{throw new DOMException('Blocked','NotAllowedError');}}
      }));
      await guest.goto(new URL(DASHBOARD,base).href);
      await guest.waitForFunction(()=>document.querySelector('#openscied-results-status')?.textContent.includes('No saved work yet'));
      assert.ok(await guest.locator('#openscied-resume').isHidden());
      assert.equal(await guest.evaluate(key=>localStorage.getItem(key),KEY),null);
      await guest.goto(new URL(HUB,base).href);
      const trigger=guest.locator('.assign-card').filter({has:guest.locator('[data-assignment][href="'+MIGRATION+'"]')}).locator('[data-copy]');
      await trigger.press('Enter');
      const dialog=guest.locator('#assign-copy-dialog[open]');
      await dialog.waitFor();
      const value=dialog.locator('#assign-copy-url');
      assert.equal(await value.inputValue(),copied);
      assert.equal(await value.evaluate(el=>el.readOnly),true);
      await dialog.getByRole('button',{name:/close/i}).press('Enter');
      await dialog.waitFor({state:'hidden'});
      assert.ok(await trigger.evaluate(el=>el===document.activeElement),'restore focus after clipboard failure');
      const fullTrigger=guest.locator('.assign-card').filter({has:guest.locator('[data-assignment][href="'+MIGRATION+'"]')}).locator('[data-copy-assignment]');
      await fullTrigger.press('Enter');
      await dialog.waitFor();
      const textValue=dialog.getByRole('textbox',{name:'Assignment text'});
      assert.equal(await textValue.inputValue(),migrationText);
      assert.equal(await textValue.evaluate(el=>el.selectionEnd-el.selectionStart),migrationText.length);
      assert.ok(await value.isHidden());
      await dialog.getByRole('button',{name:/close/i}).press('Enter');
      await dialog.waitFor({state:'hidden'});
      assert.ok(await fullTrigger.evaluate(el=>el===document.activeElement),'restore focus to Copy assignment');
    } finally {await other.close();}
    console.log('PASS assignment, privacy, sample, saved work, resume and blocked-media/export fallback at '+opt.viewport.width+'px');
  } finally {await context.close();}
}

(async()=>{
  if(process.argv[2]==='--contract')return contract(path.resolve(process.argv[3]||'.'));
  const {chromium}=require('playwright');
  const {ROOT,serve,routeLibs}=require('./_h');
  await contract(ROOT);
  const server=await serve();
  let browser;
  try {
    const executablePath=process.env.CHROMIUM_PATH||process.env.CHROMIUM_EXECUTABLE;
    browser=await chromium.launch(executablePath?{executablePath}:{});
    for(const opt of views)await checkViews(browser,server.url,opt,routeLibs);
  } finally {
    if(browser)await browser.close();
    server.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
