/* Interactive art for the fixed Lesson 3 model. Sprites are the model's
 * existing individuals; moving one to a nest does not choose a new parent. */
(function(root){
  'use strict';
  const ART='assets/rat-generations-burrow.svg', TOKEN='assets/rat-generations-token.svg', ALERT='assets/rat-generations-rat-alert.svg';
  const GEOMETRY=Object.freeze({width:960,height:528,
    colony:Object.freeze({left:6.5,right:30.5,top:48,bottom:81}),
    parents:Object.freeze([Object.freeze({x:10,y:62}),Object.freeze({x:25,y:62})]),
    nests:Object.freeze([Object.freeze({x:100*426/960,y:100*402/528}),Object.freeze({x:100*548/960,y:100*402/528})]),
    nursery:Object.freeze([[77.5,64],[89,64],[77.5,78],[89,78]].map(([x,y])=>Object.freeze({x,y})))
  });
  function mount(host,initial={}){
    const doc=host.ownerDocument, win=doc.defaultView||root;
    const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)');
    const node=(tag,className,text)=>{
      const n=doc.createElement(tag);
      if(className)n.className=className;
      if(text!=null)n.textContent=text;
      return n;
    };
    const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
    const shell=node('section','rg-burrow');
    shell.setAttribute('aria-label','Rat colony and parent nests');
    const board=node('div','rg-burrow-board');
    const art=node('img','rg-burrow-art');
    art.alt='';art.draggable=false;art.width=GEOMETRY.width;art.height=GEOMETRY.height;
    const colony=node('div','rg-burrow-colony');
    const nests=node('div','rg-burrow-nests');
    const zones=node('div','rg-burrow-zones');
    zones.setAttribute('aria-hidden','true');
    for(const [name,label] of [['colony','Colony'],['nests','Parent nests'],['nursery','Nursery']]){
      const item=node('span','rg-burrow-zone',label);
      item.dataset.zone=name;zones.append(item);
    }
    board.append(art,zones,colony,nests);
    const note=node('div','rg-burrow-caption');
    const instruction=node('p','rg-burrow-instruction');
    const legend=node('p','rg-burrow-legend');
    const feedback=node('p','rg-burrow-feedback');
    note.append(instruction,legend);
    shell.append(feedback,board,note);
    host.replaceChildren(shell);
    let view={}, selected='', gesture=null, signature='', shownPair=null;
    const phase=()=>['start','born','survived'].includes(view.phase)?view.phase:'start';
    const rats=()=>Array.isArray(view.rats)?view.rats:[];
    const parents=()=>view.pair?.parents??[];
    const filled=()=>[view.progress?.parents?.[0]===true,view.progress?.parents?.[1]===true];
    const geometry=()=>view.layout??GEOMETRY;
    const canMove=()=>!!view.canMove&&typeof view.onParent==='function'&&parents().length===2;
    const motion=()=>!reduced?.matches;
    const roleOf=id=>parents().findIndex(r=>r.id===id);
    const near=element=>element?.closest?.('[data-rg-burrow-rat], [data-rg-burrow-target]');
    function say(text,alert=true){
      feedback.textContent=text;
      feedback.toggleAttribute('data-retry',text.startsWith('Not placed.'));
      if(alert)view.announce?.(text);
    }
    function format(rat){
      const m=/^g(\d+)-r(\d+)$/.exec(rat.id);
      return m?'Generation '+m[1]+' rat '+m[2]:rat.id;
    }
    function point(n,pos){
      n.style.setProperty('--rg-x',pos.x+'%');n.style.setProperty('--rg-y',pos.y+'%');
    }
    function button(cls,label){
      const b=node('button',cls);b.type='button';b.setAttribute('aria-label',label);return b;
    }
    function ratImage(cls,rat){
      const img=node('img',cls);
      // Posture is stable per individual, never attributed to its genotype.
      img.alt='';img.src=view.tokenUrl||(rat&&hex(rat.id)%4===0?ALERT:TOKEN);img.width=64;img.height=44;img.draggable=false;
      if(rat)img.dataset.rgGenotype=rat.genotype;
      return img;
    }
    function hex(id) {
      let n=5381;
      for(const c of String(id))n=((n<<5)+n)^c.charCodeAt(0);
      return n>>>0;
    }
    function points(list) {
      const area=geometry().colony, cols=list.length<=4?2:list.length<=10?3:4;
      const rows=Math.ceil(list.length/cols), xGap=(area.right-area.left)/Math.max(1,cols-1);
      const yGap=(area.bottom-area.top)/Math.max(1,rows-1);
      return list.map((rat,i)=>{
        const h=hex(rat.id), x=area.left+(i%cols)*xGap, y=rows===1?(area.top+area.bottom)/2:area.top+Math.floor(i/cols)*yGap;
        return {x:x+((h%5)-2)*.65,y:y+(((h>>>5)%7)-3)*.62};
      });
    }
    function displayRats(){
      const current=rats();
      const fromSelection=view.selection?.born;
      if(phase()!=='survived'||!Array.isArray(fromSelection))return current;
      const survivors=new Set((view.selection.survivors??current).map(r=>r.id));
      return fromSelection.map(r=>({id:r.id,genotype:r.genotype,excluded:!survivors.has(r.id)}));
    }
    function animateArrival(el,animation,opts){
      if(motion())try{el.animate(animation,opts);}catch(_){}
    }
    function render({transition=false}={}){
      const list=displayRats(), enabled=canMove(), seats=filled(), stage=phase(), g=geometry();
      shell.dataset.rgBurrowPhase=stage;
      board.dataset.rgBurrowPhase=stage;
      board.style.setProperty('--rg-burrow-ratio',g.width+' / '+g.height);
      art.src=view.artUrl||ART;art.width=g.width;art.height=g.height;
      const max=Math.min(16,list.length);
      const first=list.slice(0,max);
      // The engine currently yields at most 16. Always keep assigned rats
      // addressable if a future replay contains more than can fit at once.
      for(const rat of parents()){
        if(first.some(r=>r.id===rat.id))continue;
        if(!list.some(r=>r.id===rat.id&&!r.excluded))continue;
        const removable=first.findLastIndex(r=>roleOf(r.id)<0);
        if(removable>=0)first[removable]=rat;
      }
      // Reserve safe, separate targets for actual assigned parents. Display
      // some other newborns in the illustrated nursery without duplicating
      // them in the colony. All other sprites are one record, one mark.
      const fixed=g.parents??GEOMETRY.parents, nurseryGeometry=g.nursery??GEOMETRY.nursery;
      const nurseryIds=new Set(stage==='start'?[]:first.filter(r=>roleOf(r.id)<0).slice(0,nurseryGeometry.length).map(r=>r.id));
      const left=first.filter(r=>!nurseryIds.has(r.id)&&(!enabled||roleOf(r.id)<0));
      let leftPoints=points(left);
      if(enabled&&left.length){
        const area=g.colony;
        const candidates=[.03,.20,.65,.97].flatMap(y=>
          [0,.32,.65,1].map(x=>({x:area.left+x*(area.right-area.left),y:area.top+y*(area.bottom-area.top)})));
        const separate=p=>fixed.every(q=>Math.abs(p.x-q.x)>7||Math.abs(p.y-q.y)>8);
        const available=candidates.filter(separate);
        if(available.length>=left.length)leftPoints=available.slice(0,left.length);
      }
      let line=0,nurseryCount=0;
      colony.replaceChildren();
      first.forEach((rat,i)=>{
        const role=roleOf(rat.id), movable=enabled&&!rat.excluded&&role>=0&&!seats[role];
        const nursery=nurseryIds.has(rat.id);
        const pos=nursery?nurseryGeometry[nurseryCount++]:enabled&&role>=0?fixed[role]:leftPoints[line++];
        if(!rat.excluded&&role>=0&&seats[role])return;
        const item=movable
          ? button('rg-burrow-rat',format(rat)+' '+rat.genotype+', assigned to Parent '+(role+1))
          : node('div','rg-burrow-rat');
        item.dataset.rgBurrowRat=rat.id;
        item.dataset.rgGenotype=rat.genotype;
        item.dataset.rgAssigned=String(role>=0&&!rat.excluded);
        if(movable){
          item.dataset.rgBurrowSource=rat.id;
          item.setAttribute('aria-pressed',String(rat.id===selected));
        }else{
          item.setAttribute('role','img');
          item.setAttribute('aria-label',format(rat)+' '+rat.genotype+
            (rat.excluded?', did not survive the modeled selection':stage==='born'?', newborn':''));
        }
        if(rat.excluded)item.dataset.rgBurrowExcluded='true';
        if(stage==='born')item.dataset.rgBurrowNewborn='true';
        item.dataset.rgBurrowZone=nursery?'nursery':'colony';
        item.style.setProperty('--rg-rat-scale',movable ? 1 : nursery ? .88 : left.length>9 ? .70 : stage==='born' ? .83 : 1);
        point(item,pos);
        item.append(ratImage('rg-burrow-rat-art',rat),node('span','rg-burrow-rat-label',rat.genotype));
        if(role>=0&&!rat.excluded)item.append(node('span','rg-burrow-role',String(role+1)));
        colony.append(item);
        if(transition&&stage==='born')animateArrival(item,[{opacity:0},{opacity:1}],{duration:260,delay:Math.min(i*27,250),fill:'backwards'});
        if(transition&&rat.excluded)animateArrival(item,[{opacity:1},{opacity:.28}],{duration:400,fill:'backwards'});
      });
      nests.replaceChildren();
      g.nests.forEach((pos,slot)=>{
        const rat=parents()[slot], has=!!rat&&seats[slot];
        const label='Parent '+(slot+1)+' nest'+(has?': '+format(rat)+' '+rat.genotype:rat?', empty':'');
        const n=enabled?button('rg-burrow-nest',label):node('div','rg-burrow-nest');
        n.dataset.rgBurrowTarget=String(slot);
        n.dataset.rgPlaced=String(has);
        if(enabled)n.disabled=has;
        else {n.setAttribute('role','img');n.setAttribute('aria-label',label);}
        point(n,pos);
        n.append(node('span','rg-burrow-nest-number',String(slot+1)));
        if(has){
          const img=ratImage('rg-burrow-nest-rat',rat);
          img.dataset.rgBurrowNestRat=rat.id;
          n.append(img,node('span','rg-burrow-rat-label',rat.genotype));
        }
        nests.append(n);
      });
      if(enabled)instruction.textContent=seats.every(Boolean)
        ? 'Both assigned rats are in their nests. Use their allele chips to build the cross.'
        : 'Move the two numbered rats into their matching nests. Drag, or select a rat and then its nest.';
      else instruction.textContent=stage==='survived'
        ? 'Only surviving rats can parent the next generation in this model.'
        : stage==='born'?'The newborn colony replaces the parent generation.':'This is the starting colony.';
      const count=view.counts?.total??rats().length;
      const excluded=list.filter(r=>r.excluded).length;
      legend.textContent=(stage==='survived'?'Survived: ':'Colony: ')+count+(count===1?' rat':' rats')+
        (excluded?' · '+excluded+' faded outlines did not survive the model.':'.')+
        (max<list.length?' '+(list.length-max)+' more not drawn.':'');
    }
    function syncPressed(){
      for(const chip of colony.querySelectorAll('[data-rg-burrow-source]'))
        chip.setAttribute('aria-pressed',String(chip.dataset.rgBurrowSource===selected));
    }
    function choose(id){
      if(!canMove())return;
      const role=roleOf(id);
      if(role<0){say('This rat is not assigned to this pair. Choose a numbered rat.');return;}
      if(filled()[role])return;
      selected=selected===id?'':id;
      syncPressed();
      say(selected?'Rat '+(role+1)+' selected. Choose Parent '+(role+1)+' nest.':'Selection cleared.');
    }
    function flyingSprite(rat,start,end){
      if(!motion()||!start||!end||start.width<1||end.width<1)return;
      const img=ratImage('rg-burrow-ghost rg-burrow-flying',rat);
      img.setAttribute('aria-hidden','true');
      const x=start.left+start.width/2, y=start.top+start.height/2;
      const dx=end.left+end.width/2-x,dy=end.top+end.height/2-y;
      Object.assign(img.style,{position:'fixed',left:x+'px',top:y+'px',width:start.width+'px',height:start.height+'px',
        pointerEvents:'none',zIndex:'900',transform:'translate(-50%, -50%)'});
      shell.append(img);
      try{
        const animation=img.animate([
          {transform:'translate(-50%, -50%)',opacity:1},
          {transform:'translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px)) scale(.78)',opacity:.35}
        ],{duration:320,easing:'cubic-bezier(.3,.2,.5,1)'});
        animation.finished.then(()=>img.remove(),()=>img.remove());
      }catch(_){img.remove();}
    }
    function place(id,slot,{focus=false,start=null}={}){
      if(!canMove())return false;
      if(!id){say('Choose a numbered rat first, then its nest.');return false;}
      const role=roleOf(id);
      if(role<0){say('That rat is not assigned to this pair. Choose a numbered rat.');return false;}
      if(role!==slot){say('Not placed. This rat belongs in the Parent '+(role+1)+' nest.');return false;}
      if(filled()[slot]){say('This rat is already in its nest.');return false;}
      const rat=parents()[slot], pairKey=view.pair?.id;
      const token=[...colony.querySelectorAll('[data-rg-burrow-rat]')].find(r=>r.dataset.rgBurrowRat===id);
      const origin=start??token?.getBoundingClientRect();
      selected='';
      if(view.onParent(slot,id)===false){syncPressed();say('That placement did not fit the current cross.');return false;}
      if(view.pair?.id===pairKey&&!filled()[slot]){
        const next=filled();next[slot]=true;
        update({progress:{...view.progress,parents:next}});
      }
      const nest=nests.querySelector('[data-rg-burrow-target="'+slot+'"]');
      const landing=nest?.querySelector('[data-rg-burrow-nest-rat]')??nest;
      flyingSprite(rat,origin,landing?.getBoundingClientRect());
      say('Rat placed in Parent '+(slot+1)+' nest.');
      if(focus){
        const next=colony.querySelector('[data-rg-burrow-source]');
        if(next)next.focus({preventScroll:true});
        else {instruction.tabIndex=-1;instruction.focus({preventScroll:true});}
      }
      return true;
    }
    function activate(el,focus=false){
      if(!el||el.disabled||!board.contains(el))return;
      if(own(el.dataset,'rgBurrowTarget'))place(selected,Number(el.dataset.rgBurrowTarget),{focus});
      else if(el.dataset.rgBurrowRat&&!own(el.dataset,'rgBurrowExcluded'))choose(el.dataset.rgBurrowRat);
    }
    board.addEventListener('click',event=>{
      // Real pointers are consumed once on up, not by compatibility clicks.
      if(event.detail>0||event.pointerType)return;
      activate(near(event.target),true);
    });
    board.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&selected){event.preventDefault();choose(selected);}
    });
    board.addEventListener('pointerdown',event=>{
      const el=near(event.target);
      if(!canMove()||!el||el.disabled||event.button!==0||event.isPrimary===false||gesture)return;
      gesture={pointer:event.pointerId,startX:event.clientX,startY:event.clientY,el,id:el.dataset.rgBurrowRat,moved:false};
      try{board.setPointerCapture(event.pointerId);}catch(_){}
    });
    board.addEventListener('pointermove',event=>{
      if(!gesture||gesture.pointer!==event.pointerId)return;
      if(!gesture.moved&&Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)>7){
        gesture.moved=true;
        if(gesture.id&&gesture.el.dataset.rgBurrowSource){
          gesture.el.classList.add('is-dragging');
          const item=parents()[roleOf(gesture.id)];
          gesture.ghost=ratImage('rg-burrow-ghost',item);
          gesture.ghost.setAttribute('aria-hidden','true');
          Object.assign(gesture.ghost.style,{position:'fixed',pointerEvents:'none',zIndex:'999',width:'54px',maxWidth:'none',transform:'translate(-50%, -50%)'});
          shell.append(gesture.ghost);
        }
      }
      if(gesture.ghost){
        event.preventDefault();
        gesture.ghost.style.left=event.clientX+'px';gesture.ghost.style.top=event.clientY+'px';
        const hit=near(doc.elementFromPoint(event.clientX,event.clientY));
        for(const n of nests.children)n.classList.toggle('is-drop-active',hit===n&&!n.disabled);
      }
    });
    function end(event,cancel=false){
      if(!gesture||gesture.pointer!==event.pointerId)return;
      const g=gesture;gesture=null;
      const start=g.ghost?.getBoundingClientRect();
      g.ghost?.remove();g.el.classList.remove('is-dragging');
      for(const n of nests.children)n.classList.remove('is-drop-active');
      if(cancel)return;
      const hit=near(doc.elementFromPoint(event.clientX,event.clientY));
      if(!g.moved){if(hit===g.el)activate(hit);return;}
      if(!g.id||!hit||!own(hit.dataset,'rgBurrowTarget')||!board.contains(hit)){
        if(g.id)say('Drop the numbered rat on a parent nest, or tap a rat and then its nest.');
        return;
      }
      place(g.id,Number(hit.dataset.rgBurrowTarget),{start});
    }
    board.addEventListener('pointerup',event=>end(event));
    board.addEventListener('pointercancel',event=>end(event,true));
    board.addEventListener('lostpointercapture',event=>end(event,true));
    board.addEventListener('dragstart',event=>event.preventDefault());
    function update(next={}){
      view={...view,...next};
      const pair=view.pair?.id??null;
      if(pair!==shownPair){selected='';say('',false);}
      else if(selected&&filled()[roleOf(selected)])selected='';
      shownPair=pair;
      const key=JSON.stringify([rats(),view.selection,filled(),phase(),pair,canMove(),view.counts,
        view.artUrl,view.tokenUrl,geometry()]);
      if(key===signature)return;
      const old=signature;signature=key;
      render({transition:!!old&&next.animate===true});
    }
    function destroy(){
      gesture?.ghost?.remove();gesture=null;shell.remove();
    }
    update(initial);
    return {update,destroy};
  }
  root.RatBurrow=Object.freeze({mount,GEOMETRY});
})(typeof globalThis!=='undefined'?globalThis:this);
