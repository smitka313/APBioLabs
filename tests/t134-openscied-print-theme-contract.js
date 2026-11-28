/* Isolate the actual shared print/theme functions and storage callback; no browser/account writes. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(process.argv[2] || 'lab.js','utf8');
const cut=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const themeScript=cut("  const THEME_KEY = 'aplab:pref:theme';","  /* ---------------- Sound (off by default)");
const printScript=cut('  function forceLight(', '  function lightTokenResolver()');
function simulate(start,osDark,target,mode){
  const key='aplab:pref:theme', attrs=new Map(), listeners=new Map(), storage=new Map();
  if(start!=='auto')attrs.set('data-theme',start);storage.set(key,start);  // lab.js stores 'auto' explicitly; a missing key now means the dark default
  const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  const context={Lab:{},PAGE:{id:'openscied-b3-dna-p53'},localStorage,
    document:{documentElement:{getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)}},
    window:{dispatchEvent(){},addEventListener:(k,v)=>listeners.set(k,v),matchMedia:()=>({})},
    Event,quietBadges(){},$$:()=>[],CANVASES:[],REG:{charts:[]},flushResize(){},flushFrames(){},
    isDarkNow:()=>attrs.get('data-theme')==='dark'||!attrs.has('data-theme')&&osDark};
  vm.createContext(context);
  vm.runInContext('let restoreTheme = null;\n'+themeScript+'\n'+printScript,context);
  const expectMode=x=>assert.equal(attrs.get('data-theme'),x==='auto'?undefined:x);
  if(mode==='print') vm.runInContext('printPrepare()',context);
  else vm.runInContext('restoreTheme=forceLight(true)',context);
  const whileTemporary=attrs.get('data-theme');
  assert.equal(storage.get(key), start,'temporarily using paper colors does not persist a setting');
  storage.set(key,target);
  listeners.get('storage')({key});
  const beforeRestore=attrs.get('data-theme');
  if(mode==='print')vm.runInContext('printRestore()',context);
  else vm.runInContext('restoreTheme(); restoreTheme=null;',context);
  expectMode(target); assert.equal(whileTemporary,'light'); assert.equal(beforeRestore,'light','second-tab change should not switch the in-progress print/report to dark');
}
const scenarios=[['dark',true,'light','print'],['light',false,'dark','print'],['dark',true,'auto','print'],
  ['dark',true,'light','report'],['light',false,'dark','report'],['auto',true,'dark','report']];
let failures=0;
for(const args of scenarios){try{simulate(...args);console.log('PASS',args.join(' → '));}catch(error){failures++;console.error('FAIL',args.join(' → '), error.message);}}
process.exitCode=failures?1:0;
