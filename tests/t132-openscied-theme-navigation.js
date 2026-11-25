'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium } = require('playwright');
const { serve } = require('./_h');

const DASHBOARD = 'openscied-dashboard.html';
const ACTIVITY = 'openscied-b2-fires.html';
const CLEAN_ACTIVITY = ACTIVITY.replace(/\.html$/,'');
const KEY = 'aplab:pref:theme';
let checks = 0;
function ok(value, label) {
  assert.ok(value, label);
  checks++;
  console.log('ok: ' + label);
}
const control = (page, theme) => page.locator('.theme-switch button[data-mode="' + theme + '"]').first();

async function themeState(page, mode) {
  await page.waitForFunction(expected => {
    const root = document.documentElement;
    const pressed = [...document.querySelectorAll('.theme-switch button[aria-pressed="true"]')];
    return root.getAttribute('data-theme') === (expected === 'auto' ? null : expected) &&
      pressed.length > 0 && pressed.every(button => button.dataset.mode === expected);
  }, mode);
}

async function hop(browser, base, os, mode, cleanRoute) {
  const context = await browser.newContext({ colorScheme: os, reducedMotion:'reduce' });
  const origin = new URL(base).origin;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  await context.addInitScript(() => {
    try {
      if (!localStorage.getItem('aplab:student')) localStorage.setItem('aplab:student', JSON.stringify({
        name:'Theme QA', period:'3'
      }));
      if (!localStorage.getItem('aplab:tour')) localStorage.setItem('aplab:tour', '{"seen":true,"v":1}');
    } catch (_) { /* About:blank */ }
  });
  try {
    const page = await context.newPage();
    await page.goto(base + DASHBOARD);
    await themeState(page,'dark');
    ok(await page.evaluate(key=>localStorage.getItem(key),KEY)==='dark',
      'the fresh dashboard starts in Dark before a choice is made');
    await control(page,'auto').click();
    await themeState(page,'auto');
    const switcher = control(page,mode);
    await switcher.click();
    await themeState(page,mode);
    ok(await page.evaluate(key => localStorage.getItem(key),KEY) === mode,
      'dashboard records explicit ' + mode + ' against a ' + os + ' system theme');

    const target = new URL(base + (cleanRoute ? CLEAN_ACTIVITY : ACTIVITY));
    let unlockCSS;
    const held = new Promise(resolve => { unlockCSS=resolve; });
    const stylesheet = /\/style\.css(?:[?#]|$)/;
    const delaySheet = async route => { await held; await route.continue(); };
    await page.route(stylesheet,delaySheet,{ times:1 });
    try {
      await Promise.all([
        page.waitForRequest(request=>stylesheet.test(request.url()),{ timeout:8000 }),
        page.waitForURL(url=>url.origin===target.origin&&url.pathname===target.pathname,{ waitUntil:'commit', timeout:8000 }),
        page.locator('#b2-fires-open').click({ noWaitAfter:true })
      ]);
      // The first shared CSS request is still blocked. The destination's theme
      // must already be set without its own later inline script or lab.js.
      // Poll on a timer, since animation-frame callbacks can stall while the
      // first paint is deliberately blocked by the intercepted stylesheet.
      await page.waitForFunction(wanted=>document.documentElement.getAttribute('data-theme')===wanted,mode,{polling:50,timeout:5000});
      ok(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === mode,
        mode+' applies in the incoming document before its first stylesheet ('+
        (cleanRoute?'clean URL redirect':'.html link')+')');
    } finally {
      unlockCSS();
    }
    await themeState(page,mode);
    ok(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme.includes('dark')) === (mode==='dark'),
      'the rendered OpenSciEd activity uses the chosen appearance on the first visit');

    // Simulate a restored/parked document that missed a newer preference.
    // An in-document storage write does not dispatch a storage event; use
    // pageshow.persisted to exercise that otherwise timing-dependent branch.
    await page.evaluate(({key,next})=>{
      localStorage.setItem(key,next);
      window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:false}));
    },{key:KEY,next:os});
    ok(await page.locator('html').getAttribute('data-theme')===mode,
      'an ordinary pageshow leaves the already mounted activity alone');
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    await themeState(page,os);
    ok(await control(page,os).getAttribute('aria-pressed')==='true',
      'history restore reconciles the saved theme and control immediately');

    await control(page,'auto').click();
    await themeState(page,'auto');
    ok(await page.evaluate(key=>localStorage.getItem(key),KEY)==='auto' &&
      await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme.includes('dark'))===(os==='dark'),
      'Auto tracks the system appearance and persists as an explicit preference');

    await control(page,mode).click();
    await page.goto(base+'lab01.html');
    await themeState(page,mode);
    await control(page,'auto').click();
    await themeState(page,'auto');
    ok(await page.evaluate(key=>localStorage.getItem(key),KEY)==='auto',
      'the AP page still shares the same preference and retains its Light/Dark/Auto control');
  } finally {
    await context.close();
  }
}

async function unit2SectionThemes(browser,base) {
  const ctx=await browser.newContext({colorScheme:'dark',reducedMotion:'reduce'});
  const origin=new URL(base).origin;
  await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  try {
    const page=await ctx.newPage();
    const cases=[
      ['openscied-b2-burn-lab.html','ideas','fuels','burn'],
      ['openscied-b2-fires.html','plan','yeast','cards'],
      ['openscied-b2-peat-bog-lab.html','bog','graph','zombie']
    ];
    const appearance=()=>page.evaluate(key=>{
      const root=document.documentElement,css=getComputedStyle(root);
      return {
        stored:localStorage.getItem(key),
        attr:root.getAttribute('data-theme'),
        pressed:document.querySelector('.theme-switch [aria-pressed="true"]')?.dataset.mode,
        scheme:css.colorScheme,background:css.getPropertyValue('--bg').trim(),
        body:getComputedStyle(document.body).backgroundColor
      };
    },KEY);
    for(const [file,first,second,third] of cases) {
      await page.goto(base+file);
      for(const [mode,section,nextHash] of [
        ['light',first,second],['dark',second,third],['auto',third,first]
      ]) {
        await control(page,mode).click();
        await themeState(page,mode);
        const before=await appearance();
        await page.locator('.step-nav a[href="#'+section+'"]').click();
        await page.locator('#'+section).waitFor({state:'visible'});
        assert.equal(new URL(page.url()).hash,'#'+section);
        assert.deepEqual(await appearance(),before);
        await page.evaluate(target=>{location.hash=target;},nextHash);
        await page.locator('#'+nextHash).waitFor({state:'visible'});
        assert.equal(new URL(page.url()).hash,'#'+nextHash);
        assert.deepEqual(await appearance(),before);
        ok(true,file+' '+mode+' preserves the preference, control and actual page colors across section links and hashes');
      }
    }
  } finally {
    await ctx.close();
  }
}

// Use an actual HTTP redirect: a Playwright route handler registered for the
// redirected URL does not intercept a request already following a redirect.
function serveCleanRoute(fixtures) {
  const server=http.createServer((req,res)=>{
    const here=new URL(req.url,'http://127.0.0.1');
    if(here.pathname==='/'+ACTIVITY){
      res.writeHead(302,{ location:'/'+CLEAN_ACTIVITY+here.search });
      res.end();
      return;
    }
    const upstream=new URL(fixtures);
    upstream.pathname=here.pathname==='/'+CLEAN_ACTIVITY?'/'+ACTIVITY:here.pathname;
    upstream.search=here.search;
    http.get(upstream,upstreamRes=>{
      res.writeHead(upstreamRes.statusCode,upstreamRes.headers);
      upstreamRes.pipe(res);
    }).on('error',()=>{res.writeHead(502);res.end('Fixture server unavailable');});
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({
    url:'http://127.0.0.1:'+server.address().port+'/',
    close:()=>server.close()
  })));
}

(async()=>{
  const server=await serve();
  const clean=await serveCleanRoute(server.url);
  let browser;
  try {
    browser=await chromium.launch();
    await hop(browser,server.url,'light','dark',false);
    await hop(browser,clean.url,'dark','light',true);
    await unit2SectionThemes(browser,server.url);
    console.log('openscied-theme-navigation-browser: '+checks+' checks passed');
  } finally {
    if(browser)await browser.close();
    clean.close();
    server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
