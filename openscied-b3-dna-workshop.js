/* Student manipulation and evidence for a short fictional message. Model owns all checks. */
(() => {
  'use strict';
  const M=window.DNAWorkshopLogic, $=(selector,scope=document)=>scope.querySelector(selector);
  const $$=(selector,scope=document)=>[...scope.querySelectorAll(selector)];
  const E=id=>$('#dw-'+id);
  const KEY='aplab:openscied:b3-dna-workshop:v1';
  const STEPS=['nucleotide','build','copy','rna','chain','sort'];
  const STEP_NAMES=['Nucleotide','Build DNA','Copy DNA','Make RNA','Build a chain','Match products to processes'];
  const SVG='http://www.w3.org/2000/svg', ICONS='assets/dna-workshop-molecules.svg';
  const COMPONENTS={
    phosphate:{label:'Phosphate',icon:'phosphate',short:'Phosphate'},
    sugar:{label:'Deoxyribose (DNA sugar)',icon:'sugar-deoxyribose',short:'DNA sugar'},
    base:{label:'Adenine (base A)',icon:'base-a',short:'Base A'}
  };
  const LABELS={...Object.fromEntries(Object.entries(COMPONENTS).map(([k,v])=>[k,v.label])),
    A:'A · adenine',T:'T · thymine',G:'G · guanine',C:'C · cytosine',U:'U · uracil',
    Met:'Methionine',Ala:'Alanine',Phe:'Phenylalanine',Stop:'Stop · no amino acid',
    'copy-product':'Two copies of DNA','rna-product':'One RNA message','chain-product':'An amino acid chain'
  };
  const LESSON={
    nucleotide:{title:'Assemble one nucleotide',task:'A nucleotide is one building block of DNA. Add a phosphate, a DNA sugar, and the base A. The pieces show their main shapes, not every atom.',prompt:'Which part connects directly to both the phosphate and the base?',ready:'You assembled one DNA nucleotide. Its sugar joins the phosphate and the base.',hint:'Find the spot named for that part. Phosphate and the base attach to the sugar, not directly to each other.'},
    build:{title:'Build DNA',task:'Each shape is a whole nucleotide. The letter is its base. Use the base-pairing key to complete the strand.',prompt:'Choose one pair you added. Which two letters paired?',ready:'You built a two-strand DNA fragment.',note:'The marks identify the actual strand ends. Follow each arrow from 5′ to 3′. The two DNA strands point in opposite directions.',hint:'Look at the DNA base directly across from this space and use the pairing key.'},
    copy:{title:'Copy DNA',task:'The two original strands pull apart. Add the missing DNA nucleotides alongside each original strand. This models a short DNA fragment and leaves out the enzymes that do the copying.',prompt:'What is the same about the two DNA products? What is old and what is new in each?',ready:'Your two DNA products each have one original strand and one new strand.',note:'The arrows show 5′ to 3′. New DNA grows toward its marked 3′ end, while the matching template runs the other way.',hint:'Match each empty space to the base directly across from it on the original strand.'},
    rna:{title:'Make RNA',task:'Use one DNA strand as the template. Fill the missing RNA nucleotides. RNA uses the sugar ribose, and its bases include U instead of T.',prompt:'Point to one DNA template base. What letter did you put across from it in RNA?',ready:'You made one RNA message from one DNA template.',note:'New RNA grows toward its marked 3′ end. We skip processing: in human cells, most mRNA gets a 5′ cap and a 3′ tail. Introns are removed if present. Not all RNA messages are processed the same way.',hint:'Use the DNA → RNA pairing key. This time your piece is RNA, not DNA.'},
    chain:{title:'Build a chain',task:'A ribosome reads the RNA message in groups of three bases, called codons. Use the key to place an amino acid under each codon, or Stop. This model builds the chain but does not show how it folds.',prompt:'Which codon ends the message? What happens at that spot in the chain?',ready:'Your chain has three amino acids. Stop ends the message and adds no amino acid.',note:'The ribosome reads the message from its marked 5′ end toward 3′.',hint:'Read the three RNA letters above this spot from left to right. Find that group in the small key.'},
    sort:{title:'Match products to processes',task:'Match a product to each process. Copying DNA prepares for cell division. Making RNA and reading it are two different steps that can build a chain.',prompt:'A classmate says, “Copying DNA makes a chain.” Use two products from your workshop to correct them.',ready:'Workshop complete. You matched each process with what it makes.',hint:'Compare this step with the product you made earlier. Your completed evidence is beside the board.'}
  };
  const DISCIPLINE={build:'DNA letter',copy:'DNA letter',rna:'RNA letter',chain:'RNA codon',sort:'Process'};
  const node=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
  function announce(message,tone='') {const el=E('feedback');el.textContent=message;el.dataset.tone=tone;}
  if(!M){announce('The workshop did not load. Reload this page to try again.','error');return;}
  const fresh=()=>({v:1,step:'nucleotide',progress:M.create(),actions:[],answers:{},person:{},lastVisitedAt:0});
  let state=fresh(), invalid=false, blocked=false, selected='', gesture=null, returnFocus=null;
  function decode(raw){
    const record=JSON.parse(raw);
    if(record?.v!==1||!record.progress||!Array.isArray(record.actions))throw Error('Not a workshop record');
    const restored=M.restore(record.progress);
    if(!restored)throw Error('Invalid workshop model');
    const safe=fresh();
    safe.progress=restored;
    const placed=restored.placed;
    safe.actions=[...new Set(record.actions.filter(slot=>typeof slot==='string'&&Object.hasOwn(placed,slot)))];
    for(const slot of Object.keys(placed))if(!safe.actions.includes(slot))safe.actions.push(slot);
    for(const step of STEPS)if(typeof record.answers?.[step]==='string')safe.answers[step]=record.answers[step].slice(0,2400);
    for(const [key,size] of [['name',100],['period',24]])if(typeof record.person?.[key]==='string')safe.person[key]=record.person[key].slice(0,size);
    safe.step=STEPS.includes(record.step)?record.step:'nucleotide';
    // Earlier versions start at Build. Keep their products and remember where to
    // take them back after the new first step, even through a partial-primer reload.
    const resume=record.resumeAfterPrimer||(safe.step!=='nucleotide'&&!M.complete('nucleotide',restored)?safe.step:'');
    if(resume!=='nucleotide'&&STEPS.includes(resume))safe.resumeAfterPrimer=resume;
    safe.lastVisitedAt=Number.isFinite(record.lastVisitedAt)?record.lastVisitedAt:0;
    return safe;
  }
  const scope='b3-dna-workshop', guard=window.OpenSciEdSaveSession;
  let saveSession;
  try {
    saveSession=guard?.open(localStorage,scope,[KEY]);
    const raw=saveSession?saveSession.read(KEY):localStorage.getItem(KEY);
    if(raw!==null)try{state=decode(raw);}catch(_){invalid=true;}
  } catch(_){blocked=true;}
  function conflict(result){
    if(!result||result.ok||result.reason==='unavailable')return false;
    const note=E('save-conflict');
    note.hidden=false;
    note.textContent=(result.reason==='erased'?'This workshop was cleared in another tab.':'This workshop was changed in another tab.')+
      ' This tab will not overwrite it. Download or copy your open work before reloading.';
    E('save').textContent='New changes in this tab are not saved.';
    return true;
  }
  function save(){
    if(invalid){E('save').textContent='A previous record is preserved. Download this record before leaving or choose Start over to replace it.';return;}
    state.lastVisitedAt=Date.now();
    const result=saveSession?.write(KEY,JSON.stringify({...state,progress:M.serialize(state.progress)}));
    if(result?.ok){blocked=false;E('save').textContent='Work saved on this device.';return;}
    if(!conflict(result)){blocked=true;E('save').textContent='Work could not be saved on this device. Download or copy it before leaving.';}
  }
  window.addEventListener('storage',event=>{
    if(saveSession&&(!event.key||[KEY,guard.globalKey,guard.scopeKey(scope),guard.resetKey(KEY)].includes(event.key))){
      conflict(saveSession.check(KEY));
    }
  });
  const complete=step=>M.complete(step,state.progress);
  const model=step=>M.stage(step);
  const available=step=>STEPS.includes(step)&&STEPS.slice(0,STEPS.indexOf(step)).every(complete);
  const pieceName=value=>LABELS[value]??String(value);
  const pieceText=(value,step)=>step==='sort'?pieceName(value):value==='Stop'?'Stop':value;
  const pieceKind=step=>step==='nucleotide'?'component':step==='chain'?'amino':step==='sort'?'product':'base';
  const slotElement=id=>$('[data-dw-slot="'+id+'"]',E('board'));
  function markPiece(n,value,step){
    const kind=pieceKind(step);
    n.dataset.pieceKind=kind;
    if(value&&kind==='base')n.dataset.base=value;
    if(value&&kind==='component')n.dataset.component=value;
    if(value&&kind==='amino')n.dataset.amino=value;
    return n;
  }
  function svg(tag,attrs={}){
    const el=document.createElementNS(SVG,tag);
    for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);
    return el;
  }
  function moleculeIcon(symbol,shape){
    const icon=svg('svg',{class:'dw-molecule-icon','data-shape':shape,viewBox:'0 0 64 64','aria-hidden':'true',focusable:'false'});
    icon.append(svg('use',{href:ICONS+'#'+symbol}));
    return icon;
  }
  function represent(host,value,step,kind=''){
    if(!value||value==='Stop'||step==='sort')return;
    if(kind==='codon'){
      const group=node('span','','dw-codon-icons');group.setAttribute('aria-hidden','true');
      for(const letter of value)group.append(moleculeIcon('nucleotide-rna-'+letter.toLowerCase(),'codon'));
      host.replaceChildren(group,node('span',value,'dw-chip-symbol'));return;
    }
    const shape=step==='nucleotide'?value:step==='chain'?'amino':step==='rna'?'rna':'dna';
    const symbol=step==='nucleotide'?COMPONENTS[value].icon:step==='chain'?'amino-'+value.toLowerCase():'nucleotide-'+shape+'-'+value.toLowerCase();
    const text=step==='nucleotide'?COMPONENTS[value].label:value;
    host.replaceChildren(moleculeIcon(symbol,shape),node('span',text,'dw-chip-symbol'));
  }
  function renderNucleotide(host){
    const info=model('nucleotide').schematic;
    const diagram=node('div','','dw-nucleotide-map dw-nucleotide-assembly');
    diagram.setAttribute('role','group');
    diagram.setAttribute('aria-label','Assemble one DNA nucleotide. Three labeled spots.');
    const bonds=svg('svg',{class:'dw-nucleotide-bonds',viewBox:'0 0 300 100',preserveAspectRatio:'none','aria-hidden':'true',focusable:'false'});
    const positions=Object.fromEntries(info.nodes.map((item,index)=>[item.id,50+index*100]));
    const slotIds=Object.fromEntries(info.nodes.map(item=>[item.id,item.slotId]));
    for(const [from,to] of info.bonds){
      const linked=!!state.progress.placed[slotIds[from]]&&!!state.progress.placed[slotIds[to]];
      bonds.append(svg('line',{'data-dw-bond':from+'-'+to,'data-dw-linked':String(linked),x1:positions[from],x2:positions[to],y1:47,y2:47}));
    }
    diagram.append(bonds);
    for(const part of info.nodes){
      const item=node('div','','dw-nucleotide-node');item.dataset.component=part.id;
      item.dataset.dwRow=part.slotId;
      const value=state.progress.placed[part.slotId], title=COMPONENTS[part.id].label;
      const b=markPiece(node('button',value?title:'＋','dw-slot dw-assembly-slot'),value,'nucleotide');
      b.type='button';b.dataset.dwSlot=part.slotId;b.dataset.component=part.id;
      b.setAttribute('aria-label',title+(value?' placed':', empty slot'));
      if(value){b.dataset.dwPlaced=value;b.dataset.dwValue=value;represent(b,value,'nucleotide');}
      item.append(b,node('span',COMPONENTS[part.id].short,'dw-component-label'));
      diagram.append(item);
    }
    host.append(diagram);
    const summary=node('p','The center sugar has one connection to phosphate and another to the base.','dw-nucleotide-takeaway');
    summary.dataset.dwNucleotideCount=complete('nucleotide')?'1':'0';
    host.append(summary);
  }
  function renderAnatomy(step){
    const host=E('anatomy');host.replaceChildren();
    host.hidden=!['build','copy','rna'].includes(step);
    if(host.hidden)return;
    const rna=step==='rna', lead=rna?'Two sugars':'A nucleotide, repeated';
    const graphics=node('div','','dw-anatomy-icons');
    function caption(symbol,shape,text){
      const label=node('span','','dw-molecule-kind');label.append(moleculeIcon(symbol,shape),node('span',text));
      graphics.append(label);
    }
    if(rna){
      caption('sugar-deoxyribose','sugar','DNA: deoxyribose');
      caption('sugar-ribose','sugar','RNA: ribose');
    }else{
      caption('nucleotide-dna-a','dna','DNA nucleotide A');
    }
    const note=rna?'The RNA strand has a sugar–phosphate backbone, too. Ribose has an extra oxygen–hydrogen group (OH) that DNA’s sugar lacks.':
      'Sugar and phosphate form the strand’s backbone. The base letters stick out and pair across the two strands.';
    host.append(node('strong',lead),graphics,node('p',note));
  }
  function orderRange(from,to){
    const direction=node('small','','dw-direction');
    direction.append(node('b',from),node('span',from==='3′'?' ← ':' → '),node('b',to));
    direction.setAttribute('role','img');
    direction.setAttribute('aria-label','Left end '+from+', right end '+to);
    return direction;
  }
  function makePalette(step,slots){
    const list=[...new Set(slots.flatMap(s=>s.choices))];
    const lead=step==='nucleotide'?'Three parts':step==='sort'?'Products':step==='chain'?'Amino acids and stop':step==='rna'?'RNA bases':'DNA bases';
    const palette=E('palette');
    palette.replaceChildren(node('span',lead,'dw-palette-label'));
    for(const value of list){
      const b=markPiece(node('button',pieceText(value,step),'dw-piece'),value,step);
      b.type='button';b.dataset.dwPiece=value;
      b.setAttribute('aria-label','Choose '+pieceName(value));
      b.setAttribute('aria-pressed',String(selected===value));
      represent(b,value,step);
      if(step==='sort')b.append(node('small',M.TILE_LABELS[value],'dw-piece-name'));
      if(step==='chain'&&value!=='Stop')b.append(node('small',pieceName(value),'dw-piece-name'));
      palette.append(b);
    }
  }
  function makeKey(step){
    const host=E('key');host.replaceChildren();
    if(['sort','nucleotide'].includes(step)){host.hidden=true;return;}
    host.hidden=false;
    const title=node('strong',step==='chain'?'Mini codon key':step==='rna'?'DNA → RNA pairing key':'DNA pairing key');
    const items=step==='chain'?M.CODONS.map(c=>c.codon+' → '+(c.stop?'Stop, no amino acid':c.value+(c.start?' (start)':''))):
      step==='rna'?['A → U','T → A','C → G','G → C']:['A pairs with T','C pairs with G'];
    const rules=node('div','','dw-key-items');
    for(const item of items)rules.append(node('span',item,'dw-key-rule'));
    host.append(title,rules);
    if(step==='chain')host.append(node('small','Only the codons in this message are shown.'));
  }
  function strand(row,step){
    const track=node('section','','dw-track');
    track.dataset.dwRow=row.id;
    const kind=row.kind==='sort'?'sort':row.kind==='amino'?'chain':['rna','codon'].includes(row.kind)?'rna':row.origin;
    track.dataset.strand=kind;
    const label=node('div','','dw-row-label');
    label.append(node('h4',row.label));
    if(row.direction?.length===2)label.append(orderRange(...row.direction));
    track.append(label);
    const sequence=node('div','','dw-sequence');
    if(row.direction?.length===2)sequence.dataset.dwHasEnds='true';
    function markEnd(tile,index){
      if(row.direction?.length!==2 || (index!==0&&index!==row.bases.length-1))return;
      const mark=node('span',row.direction[index===0?0:1],'dw-end');
      mark.dataset.dwEnd=index===0?'start':'finish';
      mark.setAttribute('aria-hidden','true');tile.append(mark);
    }
    track.append(sequence);
    const isCodonRow=row.kind==='codon';
    const useGroups=row.bases.length===12;
    let wrap=sequence;
    for(const base of row.bases){
      if(useGroups&&base.index%3===0){wrap=node('span','','dw-triplet');sequence.append(wrap);}
      const value=M.getValue(row,base.index,state.progress);
      const chipStep=step==='chain'&&kind!=='chain'?'rna':step;
      if(base.slotId){
        const name=step==='sort'?row.label:kind==='chain'?'Codon '+(base.index+1):row.label+', position '+(base.index+1);
        const b=markPiece(node('button',value?pieceText(value,step):'＋','dw-slot'),value,step);
        b.type='button';b.dataset.dwSlot=base.slotId;
        const reference={
          'pair-lower':'pair-upper',
          'copy-daughter-a-new':'copy-daughter-a-original',
          'copy-daughter-b-new':'copy-daughter-b-original',
          'rna-product':'rna-template',
          'chain-product':'chain-codons'
        }[row.id];
        const source=reference&&M.getValue(reference,base.index,state.progress);
        b.setAttribute('aria-label',name+(source?' across from '+source:'')+(value?', '+pieceName(value)+' placed':', empty slot'));
        if(value){b.dataset.dwPlaced=value;b.dataset.dwValue=value;}
        if(value==='Stop')b.dataset.stop='true';
        represent(b,value,step);
        markEnd(b,base.index);wrap.append(b);
      }else{
        const given=markPiece(node('span',String(value??''),'dw-given dw-fixed'),value,chipStep);
        if(value)given.dataset.dwValue=value;
        if(isCodonRow){delete given.dataset.base;given.dataset.pieceKind='codon';given.dataset.codon=value;}
        represent(given,value,step==='rna'&&row.kind==='dna'?'build':chipStep,row.kind);
        given.setAttribute('role','img');
        given.setAttribute('aria-label',(step==='rna'&&row.kind==='dna'?'Template DNA letter':DISCIPLINE[step])+' position '+(base.index+1)+': '+(value??'empty'));
        markEnd(given,base.index);wrap.append(given);
      }
    }
    return track;
  }
  function renderBoard(step){
    const data=model(step);const strands=E('strands');
    E('board').dataset.currentStage=step;
    strands.replaceChildren();
    if(step==='nucleotide'){renderNucleotide(strands);}
    else if(step==='copy'){
      for(const [i,pair] of [data.rows.slice(0,2),data.rows.slice(2,4)].entries()){
        const group=node('section','','dw-molecule');
        group.dataset.molecule='daughter-'+(i===0?'a':'b');
        group.append(node('h4','DNA product '+(i+1),'dw-molecule-title'));
        for(const row of pair)group.append(strand(row,step));
        strands.append(group);
      }
    }else for(const row of data.rows)strands.append(strand(row,step));
    if(step==='chain'){
      const {amino,stop}=M.snapshot(state.progress);
      const count=node('p',(amino.length===1?'1 amino acid':amino.length+' amino acids')+(stop?' · Stop adds none':''),'dw-chain-length');
      count.dataset.dwChainCount=String(amino.length);
      strands.append(count);
    }
    makePalette(step,data.slots);makeKey(step);renderAnatomy(step);
    const wheel=E('wheel');
    if(wheel){
      wheel.hidden=step!=='chain'||!window.DNACodonWheel;
      if(!wheel.hidden)window.DNACodonWheel.mount(E('wheel-mount'));
    }
  }
  function evidence(step){
    const data=model(step);
    const rows=data.rows.map(row=>{
      const values=row.bases.map(base=>M.getValue(row,base.index,state.progress));
      let result;
      if(row.kind==='component') {
        result=values[0]?pieceName(values[0])+' connected':'Not placed yet';
      }else if(row.kind==='amino') {
        const amino=values.filter(v=>v&&v!=='Stop').map(pieceName);
        result=amino.length?amino.join(' → '):'No amino acids placed yet';
        if(values.includes('Stop'))result+='; Stop ends the chain (adds no amino acid)';
      }else if(row.kind==='sort') {
        result=values[0]?pieceName(values[0]):'Not yet matched';
      }else if(row.kind==='codon') {
        result=values.map(v=>v||'·').join(' | ');
      }else {
        result=values.map(v=>v||'·').join('').match(/.{1,3}/gu).join(' ');
        if(row.direction)result=row.direction[0]+' '+result+' '+row.direction[1];
      }
      return {id:row.id,label:row.label,result};
    });
    return rows;
  }
  function renderEvidence(){
    const history=E('history');
    const wasOpen=new Set($$('details[open]',history).map(el=>el.dataset.step));
    history.replaceChildren();
    let shown=0;
    for(const step of STEPS){
      if(!complete(step))continue;
      shown++;
      const li=node('li','','dw-history-card');li.dataset.dwHistory=step;
      const showAll=state.step==='sort'&&['copy','rna','chain'].includes(step);
      const details=node('details');details.open=showAll||step===state.step||wasOpen.has(step);details.dataset.step=step;
      details.append(node('summary',LESSON[step].title),node('p',LESSON[step].ready,'dw-evidence-result'));
      const dl=node('dl','','dw-evidence-list');
      for(const row of evidence(step)){
        const item=node('div','','dw-evidence-row');item.dataset.dwEvidenceRow=row.id;
        item.append(node('dt',row.label),node('dd',row.result));dl.append(item);
      }
      details.append(dl);li.append(details);history.append(li);
    }
    E('evidence-now').textContent=shown
      ?complete(state.step)&&state.step!=='sort'?LESSON[state.step].ready:
        state.step==='sort'?'Compare the DNA copies, RNA message, and amino acid chain you made.':'Open a completed step to see your actual pieces.'
      :'Finish a step to collect its products here. You can also look at your pieces on the board.';
  }
  function controls(){
    const step=state.step, index=STEPS.indexOf(step), data=model(step), right=data.slots.filter(slot=>Object.hasOwn(state.progress.placed,slot.id)).length;
    E('progress').textContent=right+' of '+data.slots.length+' placed';
    for(const b of $$('[data-dw-go]')){
      const next=b.dataset.dwGo;b.disabled=!available(next);
      if(next===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
      if(complete(next)){b.dataset.oseComplete='true';b.setAttribute('aria-description','Complete');}
      else{delete b.dataset.oseComplete;b.removeAttribute('aria-description');}
      if(b.disabled)b.setAttribute('aria-describedby','dw-unlock');else b.removeAttribute('aria-describedby');
    }
    const unfinished=STEPS.findIndex(id=>!complete(id));
    const remaining=unfinished<0?0:model(STEPS[unfinished]).slots.length;
    const piece=unfinished===0?'parts':unfinished===STEPS.length-1?'products':'pieces';
    E('unlock').textContent=unfinished<0?'Workshop complete. You can revisit any step.':
      'Place all '+remaining+' '+piece+' in '+STEP_NAMES[unfinished]+' to '+
      (STEP_NAMES[unfinished+1]?'unlock '+STEP_NAMES[unfinished+1]:'finish the workshop')+'.';
    const resume=step==='nucleotide'&&state.resumeAfterPrimer&&available(state.resumeAfterPrimer)?state.resumeAfterPrimer:'';
    const onward=resume||STEPS[index+1];
    E('next').hidden=!onward;
    E('next').disabled=!onward||!complete(step);
    if(E('next').disabled) E('next').setAttribute('aria-describedby','dw-unlock');
    else E('next').removeAttribute('aria-describedby');
    E('next').dataset.dwTo=onward||'';
    if(onward) E('next').textContent=(resume?'Resume: ':'Next: ')+LESSON[onward].title;
    E('continue').hidden=step!=='sort'||!complete('sort');
    E('undo').disabled=right===0||step!=='nucleotide'&&STEPS.slice(index+1).some(id=>model(id).slots.some(slot=>Object.hasOwn(state.progress.placed,slot.id)));
  }
  function render(){
    const i=STEPS.indexOf(state.step), lesson=LESSON[state.step];
    E('title').textContent=lesson.title;
    E('stage-label').textContent='Step '+(i+1)+' of '+STEPS.length;
    E('task').textContent=lesson.task;
    E('model-note').hidden=!lesson.note;E('model-note').textContent=lesson.note||'';
    E('response-label').textContent=lesson.prompt;
    E('response').value=state.answers[state.step]||'';
    renderBoard(state.step);renderEvidence();controls();
  }
  function goto(step,{focus=true,persist=true}={}){
    if(!available(step))return false;
    state.step=step;if(step!=='nucleotide')delete state.resumeAfterPrimer;selected='';E('board').classList.remove('has-selection');render();
    announce(complete(step)?LESSON[step].ready:'',complete(step)?'success':'');
    if(location.hash!=='#'+step)history.replaceState(null,'','#'+step);
    if(persist&&(state.actions.length||state.lastVisitedAt))save();
    if(focus){E('title').focus({preventScroll:true});E('activity').scrollIntoView({block:'start'});}
    return true;
  }
  function choose(value){
    const clearing=selected===value;
    selected=clearing?'':value;
    for(const b of $$('[data-dw-piece]',E('palette')))b.setAttribute('aria-pressed',String(b.dataset.dwPiece===selected));
    E('board').classList.toggle('has-selection',!!selected);
    announce(clearing?pieceName(value)+' deselected. Choose a tile to continue.':pieceName(value)+' selected. Choose an empty space.','hint');
  }
  function place(value,id,keyboard=false){
    if(Object.hasOwn(state.progress.placed,id)){announce('This spot is already filled. Use Undo to take back your latest placement.','hint');return false;}
    if(!value){announce('Choose a tile first, then choose an empty space.','hint');return false;}
    const check=M.check(state.step,id,value);
    if(!check.ok){announce('Try another piece. '+(check.error||LESSON[state.step].hint),'error');return false;}
    const result=M.place(state.progress,id,value);
    if(!result.ok){announce(result.error||'That piece did not fit.','error');return false;}
    state.progress=result.progress;state.actions.push(id);selected='';
    E('board').classList.remove('has-selection');
    renderBoard(state.step);renderEvidence();controls();save();
    if(keyboard)slotElement(id)?.focus({preventScroll:true});
    const done=complete(state.step);
    const stop=value==='Stop'?' The Stop tile ends the message without adding an amino acid.':'';
    announce(done?LESSON[state.step].ready:pieceName(value)+' placed.'+stop,'success');
    return true;
  }
  function undo(){
    if(E('undo').disabled)return;
    const ids=new Set(model(state.step).slots.map(slot=>slot.id));
    const last=state.actions.findLastIndex(id=>ids.has(id));
    if(last<0)return;
    const id=state.actions[last], progress=M.serialize(state.progress);
    delete progress.placed[id];
    state.progress=M.restore(progress);state.actions.splice(last,1);selected='';
    E('board').classList.remove('has-selection');
    renderBoard(state.step);renderEvidence();controls();save();
    E('palette').querySelector('button')?.focus({preventScroll:true});
    announce('Last placement removed.');
  }
  const sharedIdentity=()=>window.Lab?.identity?.get?.()||{};
  function refreshIdentity(){
    const signedIn=sharedIdentity();
    for(const key of ['name','period']){
      const entry=E(key);
      if(document.activeElement!==entry)entry.value=(state.person[key]||'').trim()||signedIn[key]||'';
    }
  }
  function report(){
    const id=sharedIdentity();
    const name=(state.person.name||'').trim()||id.name||'';
    const period=(state.person.period||'').trim()||id.period||'';
    const lines=['DNA Workshop investigation','Fictional classroom model. Not an actual gene.'];
    if(name)lines.push('Name: '+name);
    if(period)lines.push('Class period: '+period);
    for(const step of STEPS){
      const data=model(step);
      const count=data.slots.filter(slot=>Object.hasOwn(state.progress.placed,slot.id)).length;
      lines.push('',LESSON[step].title+' ('+count+' of '+data.slots.length+' placed)');
      if(count){
        for(const row of evidence(step))lines.push(row.label+': '+row.result);
        if(complete(step))lines.push(LESSON[step].ready);
      }
      if(state.answers[step]?.trim())lines.push('Observation: '+state.answers[step].trim());
    }
    return lines.join('\n')+'\n';
  }
  function download(){
    const url=URL.createObjectURL(new Blob([report()],{type:'text/plain;charset=utf-8'}));
    const link=node('a');link.href=url;link.download='dna-workshop-investigation.txt';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    E('save').textContent='Workshop record downloaded.';
  }
  async function copy(){
    const record=report(), box=E('record'), field=E('record-text');
    field.value=record;box.hidden=false;box.open=true;
    try{await navigator.clipboard.writeText(record);E('save').textContent='Workshop record copied.';}
    catch(_){field.focus();field.select();E('save').textContent='Select Copy in your browser to copy the record below.';}
  }
  const mouseShell=E('board');
  const controlAt=el=>el?.closest('[data-dw-piece],[data-dw-slot],#dw-next,#dw-undo');
  function activate(control,keyboard){
    if(!control||!mouseShell.contains(control)||control.disabled)return;
    if(control===E('next'))goto(control.dataset.dwTo);
    else if(control===E('undo'))undo();
    else if(control.dataset.dwPiece)choose(control.dataset.dwPiece);
    else if(control.dataset.dwSlot)place(selected,control.dataset.dwSlot,keyboard);
  }
  mouseShell.addEventListener('click',event=>{
    // Pointerup handles mouse/touch on the stable board, including navigation
    // immediately after typing on a phone. A later compatibility click must not
    // place a second tile, undo twice, or advance a second step.
    if(event.detail>0||event.pointerType)return;
    activate(controlAt(event.target),true);
  });
  mouseShell.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&selected){event.preventDefault();choose(selected);}
  });
  mouseShell.addEventListener('pointerdown',event=>{
    const control=controlAt(event.target);
    if(!control||control.disabled||event.button!==0||!event.isPrimary||gesture)return;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,control,value:control.dataset.dwPiece,moved:false};
    try{mouseShell.setPointerCapture(event.pointerId);}catch(_){}
  });
  mouseShell.addEventListener('pointermove',event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    if(!gesture.moved&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>7){
      gesture.moved=true;
      if(gesture.value){
        gesture.control.classList.add('is-dragging');
        const ghost=markPiece(node('span',pieceText(gesture.value,state.step),'dw-piece dw-drag-ghost'),gesture.value,state.step);
        represent(ghost,gesture.value,state.step);
        ghost.setAttribute('aria-hidden','true');
        Object.assign(ghost.style,{position:'fixed',zIndex:'20',pointerEvents:'none'});
        mouseShell.append(ghost);gesture.ghost=ghost;
      }
    }
    if(gesture.ghost){
      event.preventDefault();
      gesture.ghost.style.left=event.clientX+10+'px';gesture.ghost.style.top=event.clientY+10+'px';
      const target=controlAt(document.elementFromPoint(event.clientX,event.clientY));
      const spot=target?.dataset.dwSlot&&!target.dataset.dwPlaced&&mouseShell.contains(target)?target:null;
      if(gesture.spot!==spot){if(gesture.spot)delete gesture.spot.dataset.dropActive;if(spot)spot.dataset.dropActive='true';gesture.spot=spot;}
    }
  });
  function endPointer(event,cancelled=false){
    if(!gesture||gesture.id!==event.pointerId)return;
    const last=gesture;gesture=null;
    last.control.classList.remove('is-dragging');last.ghost?.remove();
    if(last.spot)delete last.spot.dataset.dropActive;
    if(cancelled)return;
    const hit=controlAt(document.elementFromPoint(event.clientX,event.clientY));
    if(!last.moved){if(hit===last.control)activate(hit,false);return;}
    if(!last.value)return;
    if(!hit?.dataset.dwSlot||!mouseShell.contains(hit)){announce('Drop on a space, or tap a tile and then a space.','hint');return;}
    place(last.value,hit.dataset.dwSlot);
  }
  mouseShell.addEventListener('pointerup',event=>endPointer(event));
  mouseShell.addEventListener('pointercancel',event=>endPointer(event,true));
  mouseShell.addEventListener('lostpointercapture',event=>endPointer(event,true));
  mouseShell.addEventListener('dragstart',event=>event.preventDefault());
  for(const b of $$('[data-dw-go]'))b.addEventListener('click',()=>goto(b.dataset.dwGo));
  E('response').addEventListener('input',event=>{state.answers[state.step]=event.target.value.slice(0,2400);save();});
  refreshIdentity();
  for(const key of ['name','period']){
    const entry=E(key);
    entry.addEventListener('input',event=>{
      const value=event.target.value.slice(0,key==='name'?100:24);
      if(value.trim())state.person[key]=value;
      else delete state.person[key];
      save();
    });
    entry.addEventListener('blur',()=>{if(!state.person[key])entry.value=sharedIdentity()[key]||'';});
  }
  window.addEventListener('storage',event=>{if(!event.key||event.key==='aplab:student')refreshIdentity();});
  window.addEventListener('pageshow',refreshIdentity);
  E('download').addEventListener('click',download);
  E('copy').addEventListener('click',copy);
  E('reset').addEventListener('click',()=>{returnFocus=E('reset');E('reset-dialog').showModal();});
  E('reset-dialog').addEventListener('close',()=>{returnFocus?.focus({preventScroll:true});returnFocus=null;});
  E('reset-confirm').addEventListener('click',()=>{
    const cleared=saveSession?.reset(KEY);
    if(!cleared?.ok){
      if(!conflict(cleared))E('save').textContent='Could not clear the worksheet on this device. Your open work was not changed.';
      E('reset-dialog').close();
      return;
    }
    invalid=false;blocked=false;
    state=fresh();E('record-text').value='';refreshIdentity();
    E('record').open=false;E('record').hidden=true;
    if(blocked)E('save').textContent='Browser storage is unavailable. The open worksheet was reset.';
    else E('save').textContent='Workshop cleared on this device.';
    E('reset-dialog').close();returnFocus=E('title');goto('nucleotide',{persist:false});
  });
  window.addEventListener('hashchange',()=>{if(!goto(location.hash.slice(1),{focus:false}))goto(state.step,{focus:false,persist:false});});
  const first=location.hash.slice(1);
  goto(available(first)?first:available(state.step)?state.step:'nucleotide',{focus:false,persist:false});
  E('save').textContent=invalid?'A previous record is preserved. Download this record before leaving or choose Start over to replace it.':
    blocked?'Browser storage is unavailable. Download or copy your work before leaving.':
    state.lastVisitedAt?'Work saved on this device.':'Placements and writing save here as you work.';
})();
