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
  function assignedProgress(pairs, crosses) {
    const pending = pairs.filter(pair => !complete(crosses?.[pair.id]));
    return {total:pairs.length, done:pairs.length-pending.length, pending};
  }
  const phaseOf=p=>!p.parents.every(Boolean)?'parents':!p.headers.every(Boolean)?'headers':complete(p)?'done':'offspring';
  const availableAlleles=pair=>['R','B'].filter(letter=>pair.parents.some(rat=>rat.genotype.includes(letter)));
  function placements(pair,raw,source,destination) {
    const p=clean(raw), phase=phaseOf(p);
    const a=/^(parent)-(\d)$|^(allele)-([RB])$/.exec(source);
    const t=/^(parent)-(\d)$|^(header|cell)-(\d)-(\d)$/.exec(destination);
    if(!a||!t)return {error:'Choose a rat or allele chip, then choose an open slot.'};
    if(t[1]){
      const i=Number(t[2]);
      if(i>1||phase!=='parents'||p.parents[i])return {error:'Choose an open parent slot.'};
      if(a[1]!=='parent'||a[2]!==t[2])return {error:'This is the other parent’s slot. Match the numbered rat to its parent slot.'};
      p.parents[i]=true;return {progress:p,activity:'Parent '+(i+1)+' placed.'};
    }
    if(a[3]!=='allele')return {error:'Use an allele chip here.'};
    const letter=a[4], idx=Number(t[4]), side=Number(t[5]);
    if(side>1||!availableAlleles(pair).includes(letter))return {error:'Choose one of the displayed allele chips.'};
    if(t[3]==='header') {
      if(idx>1||phase!=='headers'||p.headers[idx*2+side])return {error:'Choose an open allele header.'};
      if(letter!==pair.parents[idx].genotype[side])return {error:'That letter does not match this header. Check Parent '+(idx+1)+'’s genotype.'};
      p.headers[idx*2+side]=true;return {progress:p,activity:'Allele header placed.'};
    }
    if(idx>3||phase!=='offspring'||p.cells[idx][side])return {error:'Choose an open allele slot in an offspring box.'};
    const expectedCopy=side===0?Math.floor(idx/2):idx%2;
    if(letter!==pair.parents[side].genotype[expectedCopy])
      return {error:'Use the letter shown in this box’s '+(side===0?'row':'column')+' header.'};
    p.cells[idx][side]=true;
    return {progress:p,activity:p.cells[idx].every(Boolean)?'Offspring box complete: '+pair.cells[idx]+'.':'Allele placed.'};
  }
  function mount(host,{pair,progress,onChange,announce,tokenUrl}) {
    const doc=host.ownerDocument, create=(tag,cls='',text='')=>{
      const item=doc.createElement(tag);item.className=cls;item.textContent=text;return item;
    };
    let p=clean(progress), selected='', gesture=null, feedback='';
    const shell=create('div','rg-cross-builder');
    shell.dataset.rgBuilder=pair.id;
    const instruction=create('p','rg-cross-instruction');
    const sources=create('div','rg-cross-sources');
    const parents=create('div','rg-cross-parents');
    const grid=create('div','rg-cross-grid');
    const visibleFeedback=create('p','rg-cross-feedback');
    visibleFeedback.id='rg-cross-feedback';
    shell.append(instruction,sources,visibleFeedback,parents,grid);
    host.replaceChildren(shell);
    function say(message,retry=false){feedback=message;visibleFeedback.textContent=message;visibleFeedback.toggleAttribute('data-retry',retry);announce?.(message);}
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
        ? 'Drag each numbered rat to its parent slot, or select the rat and then the slot.'
        : phase==='headers'?'Match Parent 1’s two letters on the left and Parent 2’s along the top. Reuse the same chip wherever its letter matches.'
        : phase==='offspring'?'Fill each offspring box with the letter from its row and the letter from its column. The chips can be reused.'
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
        for(const letter of availableAlleles(pair)){
          sources.append(source('allele-'+letter,letter,letter+' allele',letter));
        }
      }
      const header=(who,i)=>{
        const placed=p.headers[who*2+i], allele=pair.parents[who].genotype[i];
        return target('header-'+who+'-'+i,placed?allele:(who===0?'Row ':'Column ')+(i+1),
          (who===0?'Row ':'Column ')+(i+1)+': Parent '+(who+1)+' allele'+(placed?' placed: '+allele:''),
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
      for(const el of shell.querySelectorAll('[data-rg-rejected]'))el.removeAttribute('data-rg-rejected');
      if(result.error){
        shell.querySelector('[data-rg-target="'+slot+'"]')?.setAttribute('data-rg-rejected','');
        say('Not placed. '+result.error,true);return false;
      }
      p=result.progress;selected='';feedback=result.activity;
      if(complete(p))feedback+=' Cross complete.';
      render(keepFocus);onChange?.(p);say(feedback);return true;
    }
    const controlAt=element=>element?.closest('[data-rg-source], [data-rg-target]');
    function activate(control,keepFocus) {
      if(!control||control.disabled||!shell.contains(control))return;
      if(control.dataset.rgSource)choose(control.dataset.rgSource);
      else if(control.dataset.rgTarget)place(selected,control.dataset.rgTarget,keepFocus);
    }
    shell.addEventListener('click',event=>{
      // Pointer actions are handled on pointerup. A compatibility click may
      // follow that pointerup even after the drop has rebuilt the board.
      // Keyboard, assistive tech and button.click() still use native click.
      if(event.detail>0||event.pointerType)return;
      activate(controlAt(event.target),true);
    });
    shell.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&selected){event.preventDefault();choose(selected);}
    });
    shell.addEventListener('pointerdown',event=>{
      const control=controlAt(event.target);
      if(!control||control.disabled||event.button!==0||event.isPrimary===false||gesture)return;
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,control,key:control.dataset.rgSource,moved:false};
      // Keep drag events stable on the same element, even across the replaced
      // source/target buttons; the actual destination is hit-tested on up.
      try {shell.setPointerCapture(event.pointerId);} catch (_) {}
    });
    shell.addEventListener('pointermove',event=>{
      if(!gesture||gesture.id!==event.pointerId)return;
      if(!gesture.moved&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>7){
        gesture.moved=true;
        if(gesture.key){
          gesture.control.classList.add('is-dragging');
          gesture.ghost=create('span','rg-cross-source rg-cross-drag-ghost',gesture.control.textContent);
          gesture.ghost.setAttribute('aria-hidden','true');
          Object.assign(gesture.ghost.style,{position:'fixed',zIndex:'9999',pointerEvents:'none'});
          shell.append(gesture.ghost);
        }
      }
      if(gesture.ghost){
        event.preventDefault();
        gesture.ghost.style.left=event.clientX+10+'px';
        gesture.ghost.style.top=event.clientY+10+'px';
      }
    });
    function end(event,canceled=false) {
      if(!gesture||gesture.id!==event.pointerId)return;
      const last=gesture;
      gesture=null;
      last.control.classList.remove('is-dragging');last.ghost?.remove();
      if(canceled)return;
      const hit=controlAt(doc.elementFromPoint(event.clientX,event.clientY));
      if(!last.moved){
        if(hit===last.control)activate(hit,false);
        else if(last.key)say('Not placed. Choose a chip, then tap or drag it to an open slot.',true);
        return;
      }
      if(!last.key)return;
      if(!hit?.dataset.rgTarget||!shell.contains(hit)){say('Drop on a parent or allele slot, or tap a chip and then a slot.');return;}
      if(hit.disabled){say('Not placed. Choose an open slot for this part of the cross.',true);return;}
      place(last.key,hit.dataset.rgTarget,false);
    }
    shell.addEventListener('pointerup',event=>end(event));
    shell.addEventListener('pointercancel',event=>end(event,true));
    shell.addEventListener('lostpointercapture',event=>end(event,true));
    shell.addEventListener('dragstart',event=>event.preventDefault());
    // The live burrow and the workbench intentionally call the same placement.
    shell.placeParent=(role,ratId)=>{
      if(![0,1].includes(role)||pair.parents[role]?.id!==ratId)return false;
      return place('parent-'+role,'parent-'+role,false);
    };
    render();
    return shell;
  }
  return Object.freeze({blank,clean,cleanMap,complete,assignedProgress,availableAlleles,placements,mount});
});
