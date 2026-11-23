/* Optional, non-blocking checks shared by the two board views. */
(function (root) {
  'use strict';
  const questions = root.SerengetiChecks;
  if (!questions) return;
  const el = (tag, text, css) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    if (css) n.className = css;
    return n;
  };
  function mount(panels, notify) {
    let available = [], active = '', progress = {}, rendered = '', initialized = false;
    const refs = panels.filter(Boolean).map(panel => ({
      panel, cue:document.querySelector('[data-concept-cue][aria-controls="'+panel.id+'"]'), title:panel.querySelector('.sg-concept-status'), body:panel.querySelector('.sg-concept-body')
    }));
    refs.forEach(({panel,cue})=>cue?.addEventListener('click',()=>{
      panel.open=true;
      panel.querySelector('summary')?.focus({preventScroll:true});
      panel.scrollIntoView({block:'nearest',behavior:'auto'});
    }));
    function paint(focus = null) {
      const current = questions.get(active);
      const answered = available.filter(id => progress[id]?.correct).length;
      const key = JSON.stringify([available,active,progress]);
      for (const {panel, cue, title, body} of refs) {
        if(cue)cue.hidden=!current || Boolean(progress[current.id]?.correct);
        panel.hidden = !current;
        if (!current) { panel.open = false; continue; }
        if (key === rendered) continue;
        panel.dataset.question = current.id;
        title.textContent = current.title + ' · ' + answered + ' of ' + available.length + ' correct';
        body.replaceChildren();
        if (available.length > 1) {
          const wrap = el('label','Review a check','sg-concept-select');
          const list = el('select');
          available.forEach(id => {
            const op=el('option',questions.get(id).title);
            op.value=id;
            list.append(op);
          });
          list.value=active;
          list.addEventListener('change',()=>{active=list.value;paint({panel,select:true});});
          wrap.append(list);body.append(wrap);
          if(focus?.panel===panel && focus.select)list.focus({preventScroll:true});
        }
        const group = el('fieldset');
        group.append(el('legend',current.prompt));
        const result = progress[active];
        const answer = result && questions.answer(active,result.choiceId);
        current.choices.forEach(choice => {
          const b = el('button',choice.label,'sg-plain');
          b.type='button';b.dataset.choice=choice.id;
          b.setAttribute('aria-pressed',String(choice.id===result?.choiceId));
          b.setAttribute('aria-disabled',String(Boolean(result?.correct)));
          b.addEventListener('click',()=>{
            if(result?.correct)return;
            const response=questions.answer(active,choice.id);
            progress=questions.record(progress,active,choice.id);
            notify(progress,(response.correct?'Correct. ':'Try again. ')+response.feedback,panel);
            paint({panel,choice:choice.id});
          });
          group.append(b);
          if(focus?.panel===panel && focus.choice===choice.id) {
            // Focus after insertion so keyboard users keep their place.
            b.dataset.restoreFocus='true';
          }
        });
        body.append(group);
        if(answer){
          const feedback=el('p',(answer.correct?'Correct. ':'Try again. ')+answer.feedback,'sg-concept-feedback');
          feedback.dataset.correct=String(answer.correct);
          body.append(feedback);
        }
        if(focus?.panel===panel && focus.choice)body.querySelector('[data-restore-focus]')?.focus({preventScroll:true});
      }
      rendered=key;
    }
    return {
      update(state, phase, saved) {
        const next=questions.available({state,phase});
        const latest=next.filter(id=>!available.includes(id)).at(-1);
        available=next;progress=questions.restore(saved);
        if(latest||!available.includes(active))active=latest||available.at(-1)||'';
        paint();
        if(initialized && latest && !progress[latest])refs.forEach(({panel})=>{panel.open=true;});
        initialized=true;
      }
    };
  }
  root.SerengetiConceptView={mount};
})(window);
