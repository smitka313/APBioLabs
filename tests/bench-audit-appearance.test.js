'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const script=fs.readFileSync(path.join(root,'bench-footer.js'),'utf8');
function draw(page, initial, tracking=true) {
 const create=tag=>({
  tag, children:[], attrs:{}, parent:null, _text:'',
  set textContent(value){this._text=value;},
  get textContent(){return this._text+this.children.map(n=>n.textContent??n).join('');},
  get nodeValue(){return this._text;},
  set nodeValue(value){this._text=value;},
  setAttribute(k,v){this.attrs[k]=v;},
  matches(sel){return this.tag==='a'&&sel.includes('skip-link')&&this.className==='skip-link';},
  querySelector(){return null;},
  querySelectorAll(sel){return this.children.filter(n=>n.tag===sel);},
  appendChild(el){this.append(el);return el;},
  append(...els){els.forEach(el=>{if(typeof el==='object')el.parent=this;this.children.push(el);});},
  prepend(el){el.parent=this;this.children.unshift(el);},
  after(el){el.parent=this.parent;this.parent.children.splice(this.parent.children.indexOf(this)+1,0,el);},
  remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}
 });
 const body=create('body'),head=create('head'),footer=create('footer');
 const skip=create('a');skip.className='skip-link';
 const link=create('a');link.href='https://creativecommons.org/licenses/by-nc/4.0/';link.textContent='Source license';
 const credit=create('p');credit.append(link);footer.append(credit);
 if(initial){const p=create('p');p.textContent=initial;footer.append(p);}
 body.append(skip,create('main'),footer);
 const document={
  readyState:'complete',currentScript:{src:'https://example.test/course/bench-footer.js'},
  body,head,createElement:create,
  createTreeWalker(p){let once=false;return {nextNode(){if(once||!p.nodeValue)return null;once=true;return p;}};},
  querySelector(sel){
   if(sel==='footer.site-footer')return footer;
   if(sel==='script[data-goatcounter]')return tracking?{}:null;
   return null;
  }
 };
 vm.runInNewContext(script,{document,location:{pathname:'/course/'+page},URL,NodeFilter:{SHOW_TEXT:4}});
 return {body,footer,link};
}
const privacy='This site counts page visits without cookies. Student names and answers stay in this browser unless you choose to share them.';
test('brand routes include both activities with and without .html, and leave the skip link first',()=>{
 for(const [slug,label] of [['lab01.html','AP Biology labs'],['openscied-b1-serengeti','Unit 1'],['openscied-b4-junco.html','Unit 4']]){
  const {body}=draw(slug,null);
  assert.equal(body.children[0].className,'skip-link');
  const masthead=body.children[1];
  assert.equal(masthead.className,'bench-activity-bar');
  const [,course,help]=masthead.children[0].children;
  assert.ok(course.textContent.endsWith(label));
  assert.equal(course.tag,'a');
  assert.equal(course.href,'https://example.test/course/'+(slug.startsWith('lab')?'ap-biology.html':'openscied-dashboard.html'));
  assert.equal(help.tag,'a');
  assert.equal(help.textContent,'Saving & help');
  assert.equal(help.href,'https://example.test/course/privacy-help.html#saving');
  assert.equal(masthead.children[0].children[0].href,'https://example.test/course/index.html');
  assert.equal(masthead.children[0].children[0].children.length,2);
 }
 for(const slug of ['ap-biology.html','openscied-dashboard','teacher-lab01.html','directions-lab01.html']){
  assert.equal(draw(slug,null).body.children[1].tag,'main');
 }
});
test('privacy statement is consistent, never added to an untracked page, and preserves source credit links',()=>{
 for(const old of [null,privacy,'Analytics count page visits only.','This site counts anonymous page visits with GoatCounter (no cookies). Nothing you type, including your name and answers, is sent anywhere.']){
  const {footer,link}=draw('lab01.html',old);
  assert.equal(footer.textContent.split(privacy).length-1,1);
  assert.ok(!/GoatCounter/i.test(footer.textContent));
  assert.equal(footer.querySelectorAll('p')[0].children[0],link);
 }
 assert.ok(!draw('lab01.html',null,false).footer.textContent.includes(privacy));
});
