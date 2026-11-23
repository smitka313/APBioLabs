/* Optional, unscored comparisons for OpenSciEd B.1 Lessons 3–4.
   Feedback reads the same published card and regional values as the explorer.
   It does not read, store, or evaluate students' written responses. */
(function (root) {
  'use strict';

  function create({cards=[], months=[], annual=[]}={}) {
    const checks=[];
    const byMonth=m=>cards.filter(c=>c.month===m).slice().sort((a,b)=>a.group-b.group);
    const june=byMonth(5), july=byMonth(6);
    const aboveZeroEqual=row=>row.length===3 && row[0].anthrax>0 && row.every(c=>c.anthrax===row[0].anthrax);
    if ([june,july].every(aboveZeroEqual)) {
      const compared=[june,july].map(row=>months[row[0].month]+' shows '+row[0].anthrax+'% in all three groups').join('; ')+'.';
      checks.push({
        id:'anthrax', answer:'absence', title:'Check how you read the anthrax evidence',
        question:'In June and July, what does the anthrax percentage tell you about the living and dead groups?',
        source:{collection:'cards',measure:'anthrax',month:5,label:'Compare June anthrax cards'},
        options:[
          {id:'higher-dead',text:'Anthrax was more common in the two groups that died.',note:compared+' Compare all three groups within one month, rather than just one group across months.'},
          {id:'same-groups',text:'The percentages did not distinguish the living and dead groups.',correct:true,note:compared+' This lack of a difference does not support anthrax as the main explanation in these cards. It does not prove anthrax never mattered.'},
          {id:'never-mattered',text:'Anthrax could not have affected any wildebeest.',note:compared+' The values do not separate these groups, but they cannot rule out a role for anthrax in individual animals or other years.'}
        ]
      });
    }
    const august=byMonth(7), may=byMonth(4);
    if (august.length===3 && may.length===3 && august[0].fat>Math.max(august[1].fat,august[2].fat) && may.every(c=>c.health==='Healthy')) {
      const compared='In August, the living group averaged '+august[0].fat+'% bone-marrow fat, versus '+august[1].fat+'% and '+august[2].fat+'% in the two dead groups.';
      checks.push({
        id:'nutrition', answer:'patterns', title:'Check a nutritional-health comparison',
        question:'What can you conclude by comparing the May and August cards?',
        source:{collection:'cards',measure:'fat',month:7,label:'Compare August nutrition cards'},
        options:[
          {id:'tracked-individuals',text:'The cards follow the same animals from May to August.',note:'These cards report monthly group averages, not the same animals followed over time. '+compared+' Start by comparing the groups within August.'},
          {id:'all-dead-unhealthy',text:'All groups that died were nutritionally unhealthy.',note:'Both dead groups in May are labeled healthy, at '+may[1].fat+'% and '+may[2].fat+'% bone-marrow fat. Look for exceptions to the pattern as well as differences.'},
          {id:'group-pattern',text:'Living wildebeest averaged more bone-marrow fat in August, but the two dead groups in May were labeled healthy.',correct:true,note:compared+' The healthy May groups are an exception. Lower fat is evidence of nutritional stress, not proof of what killed every animal.'}
        ]
      });
    }
    const north=annual.find(a=>a.region==='North'), south=annual.find(a=>a.region==='South');
    if (north && south && north.rain>south.rain && north.occupancy<south.occupancy) {
      const compared='North had '+north.rain.toLocaleString('en-US')+' mm of rain and '+north.occupancy+'% occupancy; South had '+south.rain.toLocaleString('en-US')+' mm and '+south.occupancy+'% occupancy.';
      checks.push({
        id:'rainfall', answer:'rain-claim', title:'Check the rainfall and occupancy claim',
        question:'What does the example year tell you about the claim that wildebeest always spend the most time in the wettest region?',
        source:{collection:'rainfall',label:'Compare the annual rainfall and occupancy table'},
        options:[
          {id:'counterexample',text:'This year is a counterexample. It does not settle what happens in other years.',correct:true,note:compared+' More annual rain did not mean more time in a region in this example. Compare more years before making a general claim.'},
          {id:'north-most',text:'The North was wettest, so the herds spent the most time there.',note:compared+' Read the rainfall and percent-of-year columns separately before comparing the regions.'},
          {id:'rain-never',text:'The example proves rainfall never matters for migration.',note:compared+' This example tests the word “always.” It cannot rule out rainfall affecting movement in particular months or years.'}
        ]
      });
    }
    return checks;
  }

  function evaluate(check, choice) {
    const option=check?.options.find(o=>o.id===choice);
    return option && {correct:option.correct===true, message:(option.correct?'Supported. ':'Recheck the evidence. ')+option.note};
  }

  function mount({cards,months,annual,announce,showEvidence}={}) {
    const node=(tag,cls,text)=>{
      const e=document.createElement(tag);
      if(cls)e.className=cls;
      if(text)e.textContent=text;
      return e;
    };
    for(const check of create({cards,months,annual})) {
      const host=document.getElementById('answer-'+check.answer)?.parentElement;
      if(!host || host.querySelector('[data-evidence-check]'))continue;
      const details=node('details','mx-evidence-check');
      details.dataset.evidenceCheck=check.id;
      const summary=node('summary',null,check.title);
      summary.append(node('span','mx-check-optional','Optional'));
      const form=node('form','mx-check-form');
      const set=node('fieldset');
      set.append(node('legend',null,check.question));
      for(const option of check.options) {
        const label=node('label','mx-check-option');
        const radio=node('input');
        radio.type='radio';radio.name='mx-check-'+check.id;radio.value=option.id;
        label.append(radio,node('span',null,option.text));
        set.append(label);
      }
      const buttons=node('div','mx-check-actions');
      const submit=node('button','mx-primary','Check this choice');
      submit.type='submit';
      const source=node('button',null,check.source.label);
      source.type='button';
      source.addEventListener('click',()=>showEvidence?.(check.source));
      buttons.append(submit,source);
      const feedback=node('p','mx-check-feedback');
      feedback.id='mx-check-feedback-'+check.id;
      feedback.hidden=true;
      form.append(node('p','mx-caption','For practice only. This does not score or change your written answer.'),set,buttons,feedback);
      set.addEventListener('change',()=>{
        feedback.hidden=true;
        feedback.textContent='';
        delete feedback.dataset.correct;
        set.removeAttribute('aria-describedby');
      });
      form.addEventListener('submit',event=>{
        event.preventDefault();
        const result=evaluate(check,set.querySelector('input:checked')?.value);
        const text=result?.message || 'Choose a statement to check it against the evidence.';
        feedback.hidden=false;
        feedback.textContent=text;
        feedback.dataset.correct=result?String(result.correct):'unanswered';
        set.setAttribute('aria-describedby',feedback.id);
        announce?.(text);
      });
      details.append(summary,form);
      host.append(details);
    }
  }

  const api=Object.freeze({create,evaluate,mount});
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.MigrationEvidenceChecks=api;
})(typeof window!=='undefined'?window:globalThis);
