/* One section at a time, using the Lab Bench's existing pager styles. */
(function(){
  'use strict';
  function init(){
    const sections=Array.from(document.querySelectorAll('main > section.step'));
    const links=Array.from(document.querySelectorAll('.step-nav a[href^="#"]'));
    if(!sections.length)return;
    let current=sections[0];
    function fromHash(hash){
      let id;try{id=decodeURIComponent((hash||'').replace(/^#/,''));}catch(e){return null;}
      const target=id&&document.getElementById(id);
      const section=target&&target.closest('section.step');
      return sections.includes(section)?section:null;
    }
    function show(section,move){
      if(!sections.includes(section))return;
      current=section;
      sections.forEach(s=>{s.classList.toggle('is-current',s===section);s.inert=s!==section;});
      links.forEach(a=>a.setAttribute('aria-current',a.getAttribute('href')==='#'+section.id?'true':'false'));
      document.body.classList.add('paged','companion-paged');
      requestAnimationFrame(function(){
        window.dispatchEvent(new Event('resize'));
        section.dispatchEvent(new CustomEvent('companion:show',{bubbles:true}));
        if(move){
          const header=section.querySelector(':scope > header h2')||section;
          header.tabIndex=-1;header.focus({preventScroll:true});
          const nav=document.querySelector('.step-nav'),height=nav?nav.getBoundingClientRect().height:0;
          window.scrollTo({top:Math.max(0,section.getBoundingClientRect().top+window.scrollY-height-8),behavior:'instant'});
          const active=links.find(a=>a.getAttribute('href')==='#'+section.id),ol=active&&active.closest('ol');
          if(active&&ol){const rect=active.getBoundingClientRect(),frame=ol.getBoundingClientRect();if(rect.left<frame.left||rect.right>frame.right)ol.scrollLeft+=(rect.left+rect.right-frame.left-frame.right)/2;}
        }
      });
    }
    function go(section){
      if(typeof section==='string')section=fromHash(section);
      if(!sections.includes(section))return;
      if(location.hash==='#'+section.id){show(section,true);return;}
      location.hash=section.id;
    }
    function button(section,label,rel){
      const a=document.createElement('a');a.className='btn pager-'+rel+(rel==='next'?' btn--primary':'');a.href='#'+section.id;a.rel=rel;
      a.textContent=label+': '+section.dataset.step;return a;
    }
    sections.forEach(function(section,index){
      if(section.querySelector(':scope > .pager'))return;
      const pager=document.createElement('nav');pager.className='pager companion-pager';pager.setAttribute('aria-label','Move between activity sections');
      if(index)pager.appendChild(button(sections[index-1],'← Back','prev'));
      else{const gap=document.createElement('span');gap.className='pager-gap';pager.appendChild(gap);}
      const position=document.createElement('span');position.className='pager-mid';position.textContent='Section '+(index+1)+' of '+sections.length;pager.appendChild(position);
      if(index<sections.length-1)pager.appendChild(button(sections[index+1],'Next →','next'));
      section.appendChild(pager);
    });
    window.addEventListener('hashchange',function(){const next=fromHash(location.hash);if(next)show(next,true);});
    document.addEventListener('click',function(event){
      if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      const a=event.target.closest&&event.target.closest('a[href^="#"]');
      if(!a)return;
      const next=fromHash(a.getAttribute('href'));
      if(!next)return;
      // Let the browser create normal history entries; handle repeated clicks ourselves.
      if(a.getAttribute('href')===location.hash){event.preventDefault();show(next,true);}
    });
    document.addEventListener('keydown',function(event){
      if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
      const target=event.target;
      if(target&&target.closest&&target.closest('input,textarea,select,button,canvas,summary,audio,video,[contenteditable="true"],[role="dialog"]'))return;
      const index=sections.indexOf(current)+(event.key==='ArrowRight'?1:-1);
      if(index<0||index>=sections.length)return;
      event.preventDefault();go(sections[index]);
    });
    const initial=fromHash(location.hash)||sections[0];show(initial,!!fromHash(location.hash));
    window.CompanionPages={go:go,current:()=>current,list:()=>sections.slice()};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
