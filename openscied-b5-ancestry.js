'use strict';
(()=>{
const $=id=>document.getElementById('ba-'+id), all=q=>[...document.querySelectorAll(q)], btn=(s)=>{const b=el('button',s);b.type='button';b.className='btn';return b;};
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const KEY='aplab:openscied:b5-ancestry:v1', routes=['traits','dna','tree','explain'], station=['profile','skull','teeth','claw'];
const bears={
 polar:{name:'Polar bear',file:'polar',data:'Polar_Bear',profile:'Long neck and small rounded ears. Hunts seals on sea ice.',skull:'A relatively long, low skull; notice the extended snout.',teeth:'Pointed canines and relatively sharp cheek teeth.',claw:'Thick, curved claw; useful for gripping.',mm:51},
 brown:{name:'Brown bear',file:'brown',data:'Brown_Bear',profile:'High shoulder hump. Eats a mix of plants and animals.',skull:'A broader, more robust skull; compare the steep rise above the snout with the black bear’s straighter slope.',teeth:'Broad crushing teeth. The last upper molar is widest toward the front in this example.',claw:'Longer, less curved front claw; useful for digging.',mm:82},
 black:{name:'American black bear',file:'black',data:'American_Black_Bear',profile:'No shoulder hump and relatively tall ears. Eats a mix of plants and animals.',skull:'Compare the gently sloping forehead with the steeper brown bear profile.',teeth:'Broad crushing teeth. The last upper molar is widest near the middle in this example.',claw:'Shorter, more curved front claw; useful for climbing.',mm:39}
};
const ids=Object.keys(bears), pairs=[['polar','brown'],['polar','black'],['brown','black']];
const short={polar:'Polar',brown:'Brown',black:'Black'}, pairLabel=i=>pairs[i].map(k=>short[k]).join(' + ');
const DNA=window.BearAncestrySequences, letters=k=>DNA[bears[k].data].slice(0,72);
const differences=pairs.map(([a,b])=>Array.from(letters(a),(x,i)=>x===letters(b)[i]?-1:i).filter(i=>i>=0));
const fresh=()=>({v:1,id:Array.from(crypto.getRandomValues(new Uint8Array(4)),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase(),step:'traits',lastSection:'traits',lastVisitedAt:0,notes:{},prediction:null,marks:[[],[],[]],checked:[],explored:[],tips:['','',''],treeGood:false,answers:{}});
const clean=v=>typeof v==='string'?v.slice(0,4000):'';
function validTree(t){return t[2]==='black'&&[t[0],t[1]].includes('polar')&&[t[0],t[1]].includes('brown');}
let s=fresh(),session,failed=false,st='profile',p=0,dp=0,pending=null,editing=false,selected='',zoom='',calc={},treeMismatch=false,canSave;
try{
  session=window.OpenSciEdSaveSession?.open(localStorage,'b5-ancestry',[KEY]);
  const raw=localStorage.getItem(KEY);
  if(raw){
    const v=JSON.parse(raw);if(v?.v!==1||!/^[A-F0-9]{8}$/.test(v.id))throw Error('invalid notebook');
    s.id=v.id;s.lastVisitedAt=Number(v.lastVisitedAt)||0;s.step=routes.includes(v.step)?v.step:'traits';
    for(const k of station)if(clean(v.notes?.[k]).trim())s.notes[k]=clean(v.notes[k]);
    s.prediction=Number.isInteger(v.prediction)&&pairs[v.prediction]&&Object.keys(s.notes).length?v.prediction:null;
    s.marks=s.marks.map((_,i)=>Array.isArray(v.marks?.[i])?[...new Set(v.marks[i].filter(n=>Number.isInteger(n)&&n>=0&&n<72))].sort((a,b)=>a-b):[]);
    s.checked=[...new Set((Array.isArray(v.checked)?v.checked:[]).filter(i=>Number.isInteger(i)&&differences[i]))];
    s.explored=(Array.isArray(v.explored)?v.explored:[]).filter(x=>typeof x==='string'&&x.split('|').length===2&&x.split('|').every(k=>Object.hasOwn(DNA,k))).slice(0,36);
    s.tips=s.tips.map((_,i)=>ids.includes(v.tips?.[i])&&v.tips.indexOf(v.tips[i])===i?v.tips[i]:'');
    s.treeGood=v.treeGood===true&&validTree(s.tips)&&s.checked.length===3;
    for(const k of ['conclusion','revise'])s.answers[k]=clean(v.answers?.[k]);
  }
}catch(_){failed=true;}
pending=s.prediction;
canSave=()=>!failed&&session?.check(KEY).ok;
const identity=window.OpenSciEdSaveSession?.reportIdentity?.(session,[KEY],()=>window.Lab?.identity?.get?.()??null)??(()=>null);
function announce(t){$('status').textContent=t;}
function save(){
  s.lastSection=s.step;s.lastVisitedAt=Date.now();
  if(!canSave()||!session.write(KEY,JSON.stringify(s)).ok)$('save').textContent='This tab cannot save. Preview your report to keep a copy.';
  $('reset').disabled=!canSave()||!Object.keys(s.notes).length;
}
const stationNames={profile:'Bear profiles',skull:'Skulls',teeth:'Teeth',claw:'Claws'};
const notesCount=()=>Object.values(s.notes).filter(v=>v.trim()).length;
function gate(k){return k==='traits'||(s.prediction!==null&&(k==='dna'||s.checked.length===3&&(k==='tree'||s.treeGood)));}
function nav(){
  const done=Number(s.prediction!==null)+Number(s.checked.length===3)+Number(s.treeGood)+Number(Boolean(s.answers.conclusion?.trim()&&s.answers.revise?.trim()));
  $('reset').disabled=!canSave()||!Object.keys(s.notes).length;
  $('progress').textContent=done+' of 4 steps complete.'+(!gate('dna')?' Save a first guess to unlock DNA.':!gate('tree')?' Check all three DNA comparisons to unlock the tree.':!gate('explain')?' Check the tree to unlock Explain.':'');
  all('[data-step],[data-go]').forEach(b=>{const k=b.dataset.step||b.dataset.go;b.disabled=!gate(k);if(b.dataset.step&&k===s.step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
}
function log(parent){
 const t=el('table');t.className='ba-log';
 const head=t.createTHead().insertRow();
 for(const x of ['Bear pair','Differences (of 72)']){const th=el('th',x);th.scope='col';head.append(th);}
 const body=t.createTBody();
 pairs.forEach((_,i)=>{const row=body.insertRow(),name=el('th',pairLabel(i));name.scope='row';row.append(name,el('td',s.checked.includes(i)?String(differences[i].length):'Not checked'));});
 parent.replaceChildren(t);
}
function step(k,persist=true){
  if(!routes.includes(k)||!gate(k))return;
  s.step=k;for(const id of routes)document.getElementById(id).hidden=id!==k;
  if(k==='tree')log($('tree-table'));if(k==='explain')recap();
  nav();
  if(persist){announce('');save();history.replaceState(null,'','#'+k);document.getElementById(k+'-title').focus();}
}
function buildPairButtons(where,fn){
 pairs.forEach((_,i)=>{const b=btn(pairLabel(i));b.dataset.pair=i;b.onclick=()=>fn(i);where.append(b);});
}
function pressed(where,v){
 [...where.children].forEach((b,i)=>b.setAttribute('aria-pressed',i===v));
}
const skulls={
 polar:'M22 113Q27 89 53 91L108 84Q133 74 146 48Q167 29 214 32Q249 34 269 55L275 80Q272 102 249 116L251 130Q231 147 209 133L168 120Q145 125 126 135L110 146L65 151Q41 155 23 144Z',
 brown:'M29 114Q33 89 73 90L104 91Q121 88 133 48Q151 12 195 20Q245 18 269 53L274 76Q273 102 251 118L252 135Q228 152 204 135L162 122Q145 128 124 141L102 151L59 154Q36 155 26 141Z',
 black:'M28 114Q35 96 70 92L107 82Q138 65 159 49Q174 37 204 38Q251 36 270 57L273 78Q272 98 250 116L251 133Q227 148 208 135L165 120Q146 126 126 139L106 149L59 150Q35 153 26 139Z'
};
function art(k,type){
  if(type==='claw'){
    const x=31+bears[k].mm*2.8, shape=k==='brown'?'Q110 46 190 62':k==='black'?'Q104 41 126 79':'Q111 43 154 73';
    return '<svg viewBox="0 0 300 185" aria-hidden="true"><path d="M31 61 '+shape+' Q'+(x-14)+' 95 '+x+' 126 Q'+(x-31)+' 104 99 108 Q57 115 31 119Z" fill="#624b37" stroke="#362c23" stroke-width="3"/><path d="M38 71Q104 60 '+(x-16)+' 108M38 96Q99 82 '+(x-10)+' 115" fill="none" stroke="#bd9f69" stroke-width="4" opacity=".72"/><path d="M31 148H283" stroke="#25574c" stroke-width="2"/>'+Array.from({length:10},(_,i)=>'<path d="M'+(31+i*28)+' 149v'+(i%2?6:11)+'" stroke="#25574c"/><text x="'+(31+i*28)+'" y="177" text-anchor="middle" font-size="12" fill="#173a34">'+i+'</text>').join('')+'<path class="ba-guide" d="M31 50V146m0-8h0m0-88v87" stroke="#0b776c" stroke-dasharray="4 4"/><line class="ba-jaw" x1="31" x2="31" y1="45" y2="147" stroke="#00635a" stroke-width="3"/></svg>';
  }
  if(type==='teeth'){
    const molar=k==='polar'?'q8-20 17-13l7-10 9 13 7-6 8 16-5 33q-9 8-17 0l-6-19-6 20q-7 4-12-3Z':'q4-14 16-17l16 0q15 0 17 13l-5 34q-8 8-16 1l-7-16-6 16q-6 7-14 0Z';
    const dorsal=k==='brown'?'M4 21Q1 39 13 42Q30 40 27 22Q28 10 21 3Q8 2 4 21Z':'M6 16Q-2 26 7 35Q15 45 23 36Q33 26 25 16Q22 7 15 4Q9 6 6 16Z';
    const inset=k==='polar'?'':'<g transform="translate(11 8)"><rect x="0" y="0" width="79" height="42" rx="5" fill="#ebe1bb" stroke="#a49c79"/><path d="'+dorsal+'" transform="translate(4 1) scale(.77)" fill="#fbf0ce" stroke="#786747" stroke-width="2"/><path d="M12 10q7 5 4 18m-5-2 12-7" fill="none" stroke="#ad9062"/><text x="28" y="16" font-size="8.5" fill="#173a34">Last molar</text><text x="28" y="29" font-size="8.5" fill="#173a34">top view</text></g>';
    return '<svg viewBox="0 0 300 185" aria-hidden="true"><path d="M17 100Q16 75 38 66L266 51Q284 52 285 76L276 98Q210 117 153 115L36 137Z" fill="#c6ad7b" stroke="#786747" stroke-width="3"/><path d="M42 93Q62 73 84 88Q92 103 72 139Q67 155 59 153Q53 151 55 138Q54 119 44 118Z" fill="#fff1c7" stroke="#887649" stroke-width="2"/><g transform="translate(112 102)" fill="#fff1c7" stroke="#887649" stroke-width="2"><path d="M0 0'+molar+'"/><path d="M56 -6'+molar+'"/><path d="M111 -12'+molar+'"/></g><g fill="#365d4d" font-size="13" font-weight="700"><text x="80" y="53">Canine</text><text x="159" y="26">Cheek teeth</text></g><path d="M92 55L66 84M209 32v46" stroke="#4c6c58" stroke-width="2" stroke-dasharray="3 3"/>'+inset+'</svg>';
  }
  return '<svg viewBox="0 0 300 185" aria-hidden="true"><path d="'+skulls[k]+'" fill="#dfca97" stroke="#746344" stroke-width="3"/><path d="M47 143q3 22 21 19l10-27m26 2 8 16 13-4 4-21m16-5 8 16 14-3 4-15" fill="#fbebc1" stroke="#8b7754" stroke-width="2"/><path d="M151 86q1-24 26-23 24 0 23 20-2 20-28 23-18-3-21-20Zm-112 25q23-13 31 2-12 15-31 12Z" fill="#526153"/><path d="M176 115q41 31 76-15m-77 35q46 31 75 5M66 102q24-8 47-7m96-53q33 3 48 25" fill="none" stroke="#a18e61" stroke-width="4"/><path d="M38 150q9 25 60 25l99-7q41-5 51-27-24 13-62 15L94 165q-36 5-56-15Z" fill="#dbc38e" stroke="#827050" stroke-width="2"/></svg>';
}
function specimens(){
  pressed($('trait-pairs'),p);
  all('[data-station]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.station===st));
  $('specimens').replaceChildren(...pairs[p].map(k=>{
    const f=el('figure');f.className='ba-specimen';f.dataset.zoom=String(zoom===k);
    if(st==='profile'){const img=el('img');img.src='assets/openscied-bear-profile-'+bears[k].file+'.svg';img.width=400;img.height=240;img.alt='';f.append(img);}
    else {const wrapper=el('div');wrapper.innerHTML=art(k,st);f.append(wrapper.firstElementChild);}
    const c=el('figcaption');c.append(el('strong',bears[k].name),el('span',bears[k][st]));f.append(c);
    if(st==='claw'){
      const input=el('input'), label=el('label','Move the caliper to the tip'), value=el('output');
      label.htmlFor='ba-caliper-'+k;input.id=label.htmlFor;input.type='range';input.min=0;input.max=90;input.value=calc[k]||0;
      function measure(){const x=31+Number(input.value)*2.8,l=f.querySelector('.ba-jaw');l.setAttribute('x1',x);l.setAttribute('x2',x);const delta=Number(input.value)-bears[k].mm;value.value=input.value+' mm · '+(Math.abs(delta)<=2?'At the illustrated tip':delta<0?'Move right to reach the tip':'Move left to reach the tip');calc[k]=input.value;}
      input.oninput=measure;
      let grip=null;
      input.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;
        e.preventDefault();input.focus();input.setPointerCapture(e.pointerId);
        grip={id:e.pointerId,x:e.clientX,value:Number(input.value)};
      });
      input.addEventListener('pointermove',e=>{
        if(!grip||e.pointerId!==grip.id||Math.abs(e.clientX-grip.x)<3)return;
        const distance=e.clientX-grip.x, width=Math.max(1,input.getBoundingClientRect().width-16);
        input.value=Math.max(0,Math.min(90,grip.value+Math.round(90*distance/width)));
        measure();
      });
      input.addEventListener('lostpointercapture',()=>{grip=null;});
      f.append(label,input,value);measure();
    }else{
      const z=btn(zoom===k?'Return to side-by-side':'Enlarge specimen');z.setAttribute('aria-label',z.textContent+': '+bears[k].name);z.onclick=()=>{zoom=zoom===k?'':k;specimens();$('specimens').querySelectorAll('button')[pairs[p].indexOf(k)].focus();};f.append(z);
    }
    return f;
  }));
  $('station-note').textContent=st==='claw'?'Drag to move from the current reading, or use the arrow keys. A tap alone won’t move it. The ruler shows centimeters; the reading gives millimeters. These are illustrated examples, not measurements from real individuals.':'Original illustrations emphasize visible traits; they are not to scale.';
}
function noteUI(){
 $('note-label').textContent='Your observation · '+stationNames[st];
 $('note').value=s.notes[st]||'';$('note-count').textContent=notesCount()+' of 4 stations have observations.';
}
function predictUI(){
 const frozen=s.prediction!==null&&!editing;
 $('lock').disabled=pending===null||!notesCount()||frozen;
 $('edit-guess').hidden=s.prediction===null||s.checked.length>0||editing;
 all('#ba-hypotheses input').forEach((n,i)=>{n.checked=pending===i;n.disabled=frozen;});
 $('lock-hint').textContent=s.prediction===null||editing?'Save one observation and choose a pair. Your first guess does not have to be right.':'First guess saved: '+pairLabel(s.prediction)+'. '+(s.checked.length?'You can revise it in Explain.':'You can edit it until your first DNA comparison passes.');
 $('first-guess').textContent=s.prediction===null?'':'Your first guess: '+pairLabel(s.prediction)+'.';
 nav();
}
buildPairButtons($('trait-pairs'),v=>{p=v;zoom='';specimens();});
all('[data-station]').forEach(b=>b.onclick=()=>{st=b.dataset.station;zoom='';specimens();noteUI();});
pairs.forEach((_,i)=>{const label=el('label'),input=el('input');input.type='radio';input.name='pair-guess';input.onchange=()=>{pending=i;predictUI();};label.append(input,pairLabel(i));$('hypotheses').append(label);});
$('note').oninput=e=>{
  if(clean(e.target.value).trim())s.notes[st]=clean(e.target.value);else if(s.prediction!==null&&notesCount()===1&&s.notes[st]){e.target.value=s.notes[st];announce('Keep at least one observation with your first guess. You can revise its wording.');return;}else delete s.notes[st];
  $('note-count').textContent=notesCount()+' of 4 stations have observations.';predictUI();save();
};
$('edit-guess').onclick=()=>{if(s.checked.length)return;editing=true;predictUI();$('hypotheses').querySelector('input:checked')?.focus();};
$('lock').onclick=()=>{if(pending===null||!notesCount())return;s.prediction=pending;editing=false;predictUI();announce('First guess saved. Now compare the DNA.');save();};
function dna(focus){
  const [a,b]=pairs[dp], aa=letters(a), bb=letters(b);
  pressed($('dna-pairs'),dp);$('dna-label').textContent=bears[a].name+' (top) · '+bears[b].name+' (bottom)';
  $('seq').replaceChildren(...Array.from(aa,(x,i)=>{
    const tile=btn('');tile.classList.add('ba-base');tile.dataset.base=i;tile.append(el('small',i+1),el('span',x),el('span',bb[i]));
    tile.tabIndex=i===0?0:-1;
    tile.onfocus=()=>{for(const sibling of $('seq').children)sibling.tabIndex=sibling===tile?0:-1;};
    tile.onkeydown=e=>{
      const cols=getComputedStyle($('seq')).gridTemplateColumns.split(' ').length,
        next={ArrowLeft:i-1,ArrowRight:i+1,ArrowUp:i-cols,ArrowDown:i+cols,Home:0,End:aa.length-1}[e.key];
      if(next===undefined)return;
      e.preventDefault();$('seq').children[Math.min(aa.length-1,Math.max(0,next))]?.focus();
    };
    tile.setAttribute('aria-label','Position '+(i+1)+': '+bears[a].name+' '+x+', '+bears[b].name+' '+bb[i]);tile.setAttribute('aria-pressed',s.marks[dp].includes(i));
    tile.onclick=()=>{
      const m=s.marks[dp],was=m.includes(i);
      s.marks[dp]=was?m.filter(x=>x!==i):[...m,i].sort((a,b)=>a-b);
      tile.setAttribute('aria-pressed',!was);$('dna-feedback').textContent='';save();
    };return tile;
  }));
  if(focus)$('seq').children[0].focus();
  log($('table'));
}
buildPairButtons($('dna-pairs'),v=>{dp=v;dna();$('dna-feedback').textContent=s.checked.includes(dp)?'This pair already passed. Try it again without losing your recorded result.':'';announce('');});
$('check').onclick=()=>{
  const got=s.marks[dp], want=differences[dp], extra=got.filter(i=>!want.includes(i)).length, missed=want.filter(i=>!got.includes(i)).length;
  if(extra||missed){$('dna-feedback').textContent=('Not yet. '+(extra?extra+' selected '+(extra===1?'column has':'columns have')+' matching letters. ':'')+(missed?missed+' '+(missed===1?'difference is':'differences are')+' still unmarked.':'')).trim()+(s.checked.includes(dp)?' Your earlier correct result and progress are still saved.':'');return;}
  if(!s.checked.includes(dp)){s.checked.push(dp);editing=false;pending=s.prediction;predictUI();}
  log($('table'));nav();save();
  $('dna-feedback').textContent='Comparison saved: '+want.length+' '+(want.length===1?'difference':'differences')+' out of 72. '+(s.checked.length===3?'All three pairs checked.':s.checked.length+' of 3 pairs checked.');
};
const alignmentCache=new Map();
function aligned(ka,kb){
  const key=ka+'|'+kb;
  if(alignmentCache.has(key))return alignmentCache.get(key);
  const a=DNA[ka],b=DNA[kb],stride=b.length+1,d=new Uint16Array((a.length+1)*stride);
  for(let i=0;i<=a.length;i++)d[i*stride]=i;for(let j=0;j<=b.length;j++)d[j]=j;
  // Keep a unit-cost alignment so the exact count is inspectable, not just an opaque score.
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){const at=i*stride+j;d[at]=Math.min(d[at-stride]+1,d[at-1]+1,d[at-stride-1]+Number(a[i-1]!==b[j-1]));}
  const top=[],bottom=[],middle=[];let i=a.length,j=b.length,subs=0,gaps=0;
  while(i||j){
   const at=i*stride+j;
   if(i&&j&&d[at]===d[at-stride-1]+Number(a[i-1]!==b[j-1])){
    const x=a[--i],y=b[--j];top.push(x);bottom.push(y);middle.push(x===y?'|':'×');subs+=Number(x!==y);
   }else if(i&&d[at]===d[at-stride]+1){
    top.push(a[--i]);bottom.push('–');middle.push('+');gaps++;
   }else{
    top.push('–');bottom.push(b[--j]);middle.push('+');gaps++;
   }
  }
  const row=seq=>seq.reverse().join('');
  const result={score:d[d.length-1],subs,gaps,rows:[row(top),row(middle),row(bottom)]};
  alignmentCache.set(key,result);return result;
}
const fullA=$('full-a'),fullB=$('full-b'),fullKeys=Object.keys(DNA),display=k=>k.replaceAll('_',' ').replace('Giant Panda Bear','Giant panda');
for(const sel of [fullA,fullB])for(const k of fullKeys){const o=el('option',display(k));o.value=k;sel.append(o);}
fullA.value='Polar_Bear';fullB.value='Brown_Bear';
function full(){
 const ka=fullA.value,kb=fullB.value,a=DNA[ka],b=DNA[kb],result=aligned(ka,kb);
 $('full-stat').textContent=display(ka)+' and '+display(kb)+': '+result.score+' minimum single-base changes ('+result.subs+' substitutions + '+result.gaps+' gap bases). Sequence lengths: '+a.length+' and '+b.length+' bases.';
 const chunks=[];for(let i=0;i<result.rows[0].length;i+=60)chunks.push('Columns '+(i+1)+'–'+Math.min(i+60,result.rows[0].length)+'\n'+result.rows.map(r=>r.slice(i,i+60)).join('\n'));
 const pre=el('pre',chunks.join('\n\n'));pre.tabIndex=0;pre.setAttribute('aria-label','Alignment: '+display(ka)+' on top, '+display(kb)+' below');$('aligned').replaceChildren(pre);
 if(ka!==kb){const key=[ka,kb].sort().join('|');if(!s.explored.includes(key)){s.explored.push(key);save();}}
 $('full-seq').replaceChildren(...[[ka,a],[kb,b]].map(([k,v])=>{const d=el('div'),c=el('code',v);c.tabIndex=0;c.setAttribute('aria-label',display(k)+' sequence');d.append(el('strong',display(k)),c);return d;}));
}
$('fasta').onclick=()=>{
 const body=fullKeys.map(k=>'>'+k+'\n'+DNA[k].match(/.{1,72}/g).join('\n')).join('\n\n')+'\n';
 const url=URL.createObjectURL(new Blob([body],{type:'text/plain;charset=utf-8'}));
 const a=el('a');a.href=url;a.download='openscied-lesson-3-bear-dna.fasta';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
};
fullA.onchange=full;fullB.onchange=full;$('full-a').closest('details').addEventListener('toggle',e=>{if(e.target.open)full();});
function tree(){
 for(const b of all('[data-bear]'))b.setAttribute('aria-pressed',b.dataset.bear===selected);
 all('[data-tip]').forEach((b,i)=>{const k=s.tips[i],title='Tip '+(i+1);b.textContent=k?bears[k].name:title+' · empty';b.setAttribute('aria-label',title+': '+(k?bears[k].name:'empty'));b.dataset.filled=String(Boolean(k));b.dataset.mismatch=String(treeMismatch&&i<2);});
}
for(const k of ids){
 const b=btn(''),img=el('img');img.src='assets/openscied-bear-profile-'+bears[k].file+'.svg';img.alt='';img.width=44;img.height=27;b.append(img,bears[k].name);b.draggable=true;b.dataset.bear=k;
 b.onclick=()=>{selected=selected===k?'':k;tree();announce(selected?bears[k].name+' selected. Choose a tip.':'Bear card deselected.');};
 b.ondragstart=e=>{selected=k;e.dataTransfer.setData('text/plain',k);e.dataTransfer.effectAllowed='move';tree();};$('tokens').append(b);
}
function place(i,k){
 if(!ids.includes(k)){$('tree-feedback').textContent='Choose a bear card, then choose a tip.';return;}
 const from=s.tips.indexOf(k), prev=s.tips[i];
 if(from===i){$('tree-feedback').textContent=bears[k].name+' is already on that tip.';return;}
 if(from>=0)s.tips[from]=prev;s.tips[i]=k;s.treeGood=false;treeMismatch=false;selected='';tree();nav();save();
 $('tree-feedback').textContent=(bears[k].name+' placed on tip '+(i+1)+'.'+(from>=0&&prev?' The two bears swapped tips.':prev?' '+bears[prev].name+' returned to the card tray.':''));
}
all('[data-tip]').forEach((b,i)=>{
  b.onclick=()=>place(i,selected);
  b.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';b.dataset.drag='true';};
  b.ondragleave=()=>delete b.dataset.drag;
  b.ondrop=e=>{e.preventDefault();delete b.dataset.drag;place(i,e.dataTransfer.getData('text/plain')||selected);};
});
$('tree-check').onclick=()=>{
 if(s.tips.some(x=>!x)){$('tree-feedback').textContent='Place all three bears before checking the tree.';return;}
 if(!validTree(s.tips)){
  const pair=pairs.findIndex(q=>q.every(k=>s.tips.slice(0,2).includes(k)));
  treeMismatch=true;tree();
  $('tree-feedback').textContent='Not yet. Tips 1 and 2 show '+pairLabel(pair)+', with '+differences[pair].length+' differences. Look for the pair with the fewest differences in your log and move those bears to the highlighted tips.';
  return;
 }
 s.treeGood=true;treeMismatch=false;tree();nav();save();$('tree-feedback').textContent='Tree checked. Your closest DNA pair shares the newer branch point.';
};
$('clear-tree').onclick=()=>{s.tips=['','',''];s.treeGood=false;treeMismatch=false;selected='';tree();nav();save();$('tree-feedback').textContent='All three tips cleared.';};
function recap(){
 const box=$('recap');box.replaceChildren(el('p','First guess: '+pairLabel(s.prediction)+'.'),...Object.entries(s.notes).filter(([,v])=>v.trim()).map(([k,v])=>el('p',stationNames[k]+': '+v)),el('p','Tree tips 1 and 2: '+s.tips.slice(0,2).map(k=>bears[k]?.name||'Empty').join(' + ')+'.'));log($('explain-table'));
}
for(const k of ['conclusion','revise']){
 const a=$(k);a.value=s.answers[k]||'';a.oninput=()=>{s.answers[k]=clean(a.value);nav();save();};
}
all('[data-step],[data-go]').forEach(b=>b.onclick=()=>step(b.dataset.step||b.dataset.go));
window.Lab?.identity?.mount?.('#ba-identity',{compact:true,sharedDevice:true});
$('reset').onclick=()=>{const input=$('reset-confirm');input.value='';$('reset-feedback').textContent='';$('clear-work').disabled=true;$('reset-dialog').showModal();};
$('keep-work').onclick=()=>$('reset-dialog').close();
$('reset-confirm').oninput=e=>{$('clear-work').disabled=e.target.value!=='ERASE';};
$('reset-form').onsubmit=e=>{
 e.preventDefault();if($('reset-confirm').value!=='ERASE')return;
 if(!canSave()||!session.reset(KEY).ok){$('reset-feedback').textContent='Could not clear this tab’s work. Reload the current saved notebook, then try again.';return;}
 history.replaceState(null,'',location.pathname+location.search);location.reload();
};
specimens();noteUI();predictUI();dna();tree();
const hash=location.hash.slice(1), start=routes.includes(hash)&&gate(hash)?hash:gate(s.step)?s.step:routes.findLast(gate);step(start,false);
if(!canSave())$('save').textContent='This browser could not open the saved notebook. You can still preview a report.';
window.OpenSciEdSubmission?.mount({target:'#ba-report',filename:'bear-ancestry',collect:()=>{
 const q1='Which bears share a more recent common ancestor? Explain one branch point and cite a DNA comparison.',q2='Did you keep or revise your first guess? Explain what the trait evidence can and cannot tell you.';
 const ordered=key=>key.split('|').sort().join('|');
 const featured=pairs.map(pair=>ordered(pair.map(k=>bears[k].data).join('|')));
 const reviewed=[...new Set([...featured,...s.explored])];
 const fullRows=reviewed.map(row=>{const [a,b]=row.split('|'),r=aligned(a,b);return [display(a)+' + '+display(b),String(r.score),String(r.subs),String(r.gaps)];});
 const missing=[];if(!s.treeGood)missing.push('Check your bear tree.');if(!s.answers.conclusion?.trim())missing.push(q1);if(!s.answers.revise?.trim())missing.push(q2);
 return {title:'Bear Ancestry Lab',unit:'OpenSciEd B.5 · Lesson 3 companion',source:'OpenSciEd B.5 Lesson 3 Bear DNA Sequences. Guided counts are for positions 1–72 of one noncoding region of transthyretin; branch lengths do not show time.',status:!canSave()?'recovery':missing.length?'draft':'final',student:identity(),datasetId:'BA-'+s.id,missing,sections:[
 {title:'First look: trait evidence',items:[{type:'answer',prompt:'First guess',value:s.prediction===null?'':pairLabel(s.prediction)},...Object.entries(s.notes).map(([k,v])=>({type:'answer',prompt:stationNames[k],value:v}))]},
 {title:'DNA evidence and branching tree',items:[{type:'table',columns:['Bear pair','Differences out of 72'],rows:pairs.map((_,i)=>[pairLabel(i),s.checked.includes(i)?String(differences[i].length):'Not checked'])},{type:'answer',prompt:'Tips 1 and 2 share the newer branch point',value:s.tips.slice(0,2).map(k=>bears[k]?.name||'Empty').join(' + ')},{type:'answer',prompt:'Tip 3',value:bears[s.tips[2]]?.name||''}]},
 {title:'Original dataset and what this model can show',items:[
  {type:'text',text:'The original lesson’s eight-species MAFFT alignment groups polar and brown bears together. This three-tip model cannot date their split or predict what happens as the Arctic changes. The dataset contains no human DNA.'},
  {type:'table',columns:['Original species','Sequence length (bases)'],rows:fullKeys.map(k=>[display(k),String(DNA[k].length)])},
  {type:'text',text:'The table below includes the three featured full-sequence comparisons and any additional pairs you opened. A simple minimum-change count is not a multi-species phylogenetic analysis.'},
  {type:'table',columns:['Full pair','Changes','Substitutions','Gap bases'],rows:fullRows}
 ]},
 {title:'Explain and revise',items:[{type:'answer',prompt:q1,value:s.answers.conclusion},{type:'answer',prompt:q2,value:s.answers.revise}]}
 ]};
}});
})();
