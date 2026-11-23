/* Interactive view of the engine's assigned parents and four expected outcomes.
 * A placement is instructional only; it never changes a pairing or offspring. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.RatCrossBuilder=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const blank=()=>({parents:[false,false],headers:[false,false,false,false],cells:Array.from({length:4},()=>[false,false])});
  function clean(raw) {
    const copy=blank();
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return copy;
    copy.parents=copy.parents.map((_,i)=>raw.parents?.[i]===true);
    if(copy.parents.every(Boolean))copy.headers=copy.headers.map((_,i)=>raw.headers?.[i]===true);
    if(copy.headers.every(Boolean))copy.cells=copy.cells.map((pair,i)=>pair.map((_,j)=>raw.cells?.[i]?.[j]===true));
    return copy;
  }
  function cleanMap(raw) {
    const out={};
    if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
      for(const [key,value] of Object.entries(raw).slice(0,40)){
        if(/^g[2-5]-pair[1-8]$/.test(key))out[key]=clean(value);
      }
    }
    return out;
  }
  const complete=p=>!!p&&p.parents?.length===2&&p.parents.every(Boolean)&&p.headers?.length===4&&p.headers.every(Boolean)&&
    p.cells?.length===4&&p.cells.every(pair=>pair?.length===2&&pair.every(Boolean));
  const phaseOf=p=>!p.parents.every(Boolean)?'parents':!p.headers.every(Boolean)?'headers':complete(p)?'done':'offspring';
  function placements(pair,raw,source,destination) {
    const p=clean(raw), phase=phaseOf(p);
    const a=/^(parent)-(\d)$|^(allele)-(\d)-(\d)$/.exec(source);
    const t=/^(parent)-(\d)$|^(header|cell)-(\d)-(\d)$/.exec(destination);
    if(!a||!t)return {error:'Choose a rat or allele chip, then choose an open slot.'};
    if(t[1]){
      const i=Number(t[2]);
      if(i>1||phase!=='parents'||p.parents[i])return {error:'Choose an open parent slot.'};
      if(a[1]!=='parent'||a[2]!==t[2])return {error:'This is the other parent’s slot. Match the numbered rat to its parent slot.'};
      p.parents[i]=true;return {progress:p,activity:'Parent '+(i+1)+' placed.'};
    }
    if(a[3]!=='allele')return {error:'Use one of the parent’s allele chips here.'};
    const who=Number(a[4]), which=Number(a[5]), idx=Number(t[4]), side=Number(t[5]);
    if(who>1||which>1||side>1)return {error:'Choose one of the displayed allele chips.'};
    if(t[3]==='header') {
      if(idx>1||phase!=='headers'||p.headers[idx*2+side])return {error:'Choose an open allele header.'};
      if(who!==idx||which!==side)return {error:'Match the chip’s parent and copy number to the row or column header.'};
      p.headers[idx*2+side]=true;return {progress:p,activity:'Allele header placed.'};
    }
    if(idx>3||phase!=='offspring'||p.cells[idx][side])return {error:'Choose an open allele slot in an offspring box.'};
    if(who!==side)return {error:'This slot needs an allele from Parent '+(side+1)+'.'};
    const expectedCopy=side===0?Math.floor(idx/2):idx%2;
    if(pair.parents[who].genotype[which]!==pair.parents[side].genotype[expectedCopy])
      return {error:'Use the allele shown in this box’s '+(side===0?'row':'column')+' header.'};
    p.cells[idx][side]=true;
    return {progress:p,activity:p.cells[idx].every(Boolean)?'Offspring box complete: '+pair.cells[idx]+'.':'Allele placed.'};
  }
  function mount(host,{pair,progress,required,onChange,announce,tokenUrl}) {
    const doc=host.ownerDocument, create=(tag,cls='',text='')=>{
      const item=doc.createElement(tag);item.className=cls;item.textContent=text;return item;
    };
    let p=clean(progress), selected='', drag=null, mutedClickUntil=0, feedback='';
    const shell=create('div','rg-cross-builder');
    shell.dataset.rgBuilder=pair.id;
    const instruction=create('p','rg-cross-instruction');
    const sources=create('div','rg-cross-sources');
    const parents=create('div','rg-cross-parents');
    const grid=create('div','rg-cross-grid');
    const visibleFeedback=create('p','rg-cross-feedback');
    visibleFeedback.id='rg-cross-feedback';
    shell.append(instruction,sources,parents,grid,visibleFeedback);
    host.replaceChildren(shell);
    function say(message){feedback=message;visibleFeedback.textContent=message;announce?.(message);}
    function makeButton(cls,visible,label) {
      const b=create('button',cls,visible);b.type='button';b.setAttribute('aria-label',label);
      return b;
    }
    function identify(rat){
      const m=/^g(\d+)-r(\d+)$/.exec(rat.id);
      return m?'G'+m[1]+' rat '+m[2]:rat.id;
    }
    function source(key,text,label,value='',withArt=false) {
      const b=makeButton('rg-cross-source',text,label);
      b.dataset.rgSource=key;
      if(value)b.dataset.rgValue=value;
      b.setAttribute('aria-pressed',String(selected===key));
      if(withArt&&tokenUrl){const img=create('img');img.alt='';img.src=tokenUrl;img.width=36;img.height=26;img.draggable=false;b.prepend(img);}
      return b;
    }
    function target(key,text,label,placed,enabled,value='') {
      const b=makeButton('rg-cross-target',text,label);
      b.dataset.rgTarget=key;b.dataset.rgPlaced=String(placed);
      if(value)b.dataset.rgValue=value;
      b.disabled=placed||!enabled;
      return b;
    }
    function render(keepFocus=false){
      const phase=phaseOf(p);
      shell.dataset.rgReady=String(phase==='done');
      shell.dataset.rgPhase=phase==='parents'?'parents':phase==='done'?'done':'alleles';
      instruction.textContent=phase==='parents'
        ? (required?'Build one complete cross before continuing. ':'Optional: build this cross or continue. ')+'Drag each numbered rat to its parent slot, or select the rat and then the slot.'
        : phase==='headers'?'Place the two allele copies from Parent 1 at the left and from Parent 2 across the top.'
        : phase==='offspring'?'Fill each offspring box with one allele from its row and one from its column. Select or drag the chips again as needed.'
        : 'Cross complete. Each box represents one expected offspring in this model.';
      sources.replaceChildren();parents.replaceChildren();grid.replaceChildren();
      pair.parents.forEach((rat,i)=>{
        if(phase==='parents'&&!p.parents[i])sources.append(source('parent-'+i,(i+1)+' · '+identify(rat)+' · '+rat.genotype,
          'Rat for Parent '+(i+1)+': '+identify(rat)+', '+rat.genotype,'',true));
        const text=p.parents[i]?'Parent '+(i+1)+' · '+rat.genotype:'Parent '+(i+1)+' slot';
        const desc=p.parents[i]?text+' · '+identify(rat):text+' · place rat '+(i+1);
        parents.append(target('parent-'+i,text,desc,p.parents[i],phase==='parents'));
      });
      if(phase==='headers'||phase==='offspring'){
        pair.parents.forEach((rat,who)=>{
          for(const [which,value] of [...rat.genotype].entries()){
            if(phase==='headers'&&p.headers[who*2+which])continue;
            sources.append(source('allele-'+who+'-'+which,'P'+(who+1)+' · '+value+(which===0?' ¹':' ²'),
              'Parent '+(who+1)+', allele copy '+(which+1)+': '+value,value));
          }
        });
      }
      const header=(who,i)=>{
        const placed=p.headers[who*2+i], allele=pair.parents[who].genotype[i];
        return target('header-'+who+'-'+i,placed?allele:(who===0?'Row ':'Column ')+(i+1),
          (who===0?'Row ':'Column ')+(i+1)+': Parent '+(who+1)+', allele copy '+(i+1)+(placed?' placed: '+allele:''),
          placed,phase==='headers',placed?allele:'');
      };
      grid.append(create('span','rg-cross-corner','×'),header(1,0),header(1,1));
      for(let i=0;i<4;i++){
        if(i%2===0)grid.append(header(0,Math.floor(i/2)));
        const cell=create('div','rg-cross-cell');cell.dataset.rgOffspring=String(i);
        cell.setAttribute('role','group');cell.setAttribute('aria-label','Offspring '+(i+1));
        for(let side=0;side<2;side++){
          const placed=p.cells[i][side], copy=side===0?Math.floor(i/2):i%2, allele=pair.parents[side].genotype[copy];
          cell.append(target('cell-'+i+'-'+side,placed?allele:'P'+(side+1),
            'Offspring '+(i+1)+': Parent '+(side+1)+' allele'+(placed?' placed: '+allele:''),
            placed,phase==='offspring',placed?allele:''));
        }
        if(p.cells[i].every(Boolean)){
          const genotype=pair.cells[i];
          const result=create('strong','rg-cross-result',genotype);result.dataset.rgCell=genotype;
          cell.append(result);
        }
        grid.append(cell);
      }
      visibleFeedback.textContent=feedback;
      if(keepFocus){
        const next=sources.querySelector('button')||instruction;
        if(next===instruction)next.tabIndex=-1;
        next.focus({preventScroll:true});
      }
    }
    function choose(key) {
      selected=selected===key?'':key;
      for(const chip of sources.querySelectorAll('[data-rg-source]'))chip.setAttribute('aria-pressed',String(chip.dataset.rgSource===selected));
      if(selected){
        const chip=sources.querySelector('[data-rg-source="'+selected+'"]');
        say(chip?.getAttribute('aria-label')+' selected. Choose a matching slot.');
      }else say('Selection cleared.');
    }
    function place(key,slot,keepFocus) {
      const result=placements(pair,p,key,slot);
      if(result.error){say(result.error);return false;}
      p=result.progress;selected='';feedback=result.activity;
      if(complete(p))feedback+=' Cross complete.';
      render(keepFocus);onChange?.(p);say(feedback);return true;
    }
    shell.addEventListener('click',event=>{
      if(event.detail&&Date.now()<mutedClickUntil){event.preventDefault();return;}
      const token=event.target.closest('[data-rg-source]');
      if(token){choose(token.dataset.rgSource);return;}
      const slot=event.target.closest('[data-rg-target]');
      if(slot&&!slot.disabled)place(selected,slot.dataset.rgTarget,true);
    });
    shell.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&selected){event.preventDefault();choose(selected);}
    });
    shell.addEventListener('pointerdown',event=>{
      // A fresh deliberate pointer click must not inherit the drag's click guard.
      mutedClickUntil=0;
      const chip=event.target.closest('[data-rg-source]');
      if(!chip||event.button!==0||event.isPrimary===false)return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,chip,key:chip.dataset.rgSource,moved:false};
      try {chip.setPointerCapture(event.pointerId);} catch (_) {}
    });
    shell.addEventListener('pointermove',event=>{
      if(!drag||drag.id!==event.pointerId)return;
      if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>7){
        drag.moved=true;drag.chip.classList.add('is-dragging');
        drag.ghost=create('span','rg-cross-source rg-cross-drag-ghost',drag.chip.textContent);
        drag.ghost.setAttribute('aria-hidden','true');
        Object.assign(drag.ghost.style,{position:'fixed',zIndex:'9999',pointerEvents:'none'});
        shell.append(drag.ghost);
      }
      if(drag.moved){
        event.preventDefault();
        drag.ghost.style.left=event.clientX+10+'px';
        drag.ghost.style.top=event.clientY+10+'px';
      }
    });
    function end(event,canceled=false){
      if(!drag||drag.id!==event.pointerId)return;
      const last=drag;drag=null;last.chip.classList.remove('is-dragging');last.ghost?.remove();
      if(canceled||!last.moved)return;
      mutedClickUntil=Date.now()+300;
      const slot=doc.elementFromPoint(event.clientX,event.clientY)?.closest('[data-rg-target]');
      if(!slot||!shell.contains(slot)){say('Drop on a parent or allele slot, or tap a chip and then a slot.');return;}
      if(slot.disabled){say('Choose an open slot for this part of the cross.');return;}
      place(last.key,slot.dataset.rgTarget,false);
    }
    shell.addEventListener('pointerup',event=>end(event));
    shell.addEventListener('pointercancel',event=>end(event,true));
    shell.addEventListener('lostpointercapture',event=>end(event,true));
    shell.addEventListener('dragstart',event=>event.preventDefault());
    render();
    return shell;
  }
  return Object.freeze({blank,clean,cleanMap,complete,placements,mount});
});
