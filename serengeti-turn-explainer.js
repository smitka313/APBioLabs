/* Read-only explanations of the OpenSciEd Lesson 7 digital board. Facts come from the engine or the last committed action. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./serengeti-logic'));
  else root.SerengetiTurn = factory(root.SerengetiLogic);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L) {
  'use strict';
  const SEASONS=['Winter','Spring','Summer','Fall'];
  const ROLE={wildebeest:'Wildebeest',hyena:'Hyenas',lion:'Lions'};
  const TYPE={individual:'individual',smallGroup:'small group',herd:'herd',clan:'clan',pride:'pride'};
  const role=r=>ROLE[r]||'The team';
  const name=t=>t && (({wildebeest:'Wildebeest',hyena:'Hyena',lion:'Lion'}[t.species] || 'Animal')+' '+(TYPE[t.type]||'token'));
  const square=c=>c&&Number.isInteger(c.x)&&Number.isInteger(c.y)?'square '+(c.x+1)+', '+(c.y+1):'a new square';
  const phrase=n=>n<0?'−'+Math.abs(n):n>0?'+'+n:'0';
  const gain=n=>n===0?'The modeled wildebeest population did not change.':'Wildebeest population change: '+phrase(n)+'.';
  const logTotal=r=>Number.isInteger(r?.population)?'Wildebeest '+phrase(r.change||0)+' · '+phrase(r.population)+' cumulative.':'';
  const cap=s=>typeof s==='string'&&s?s[0].toUpperCase()+s.slice(1):'';
  const line=s=>s&&/[.!?]$/.test(s)?s:s?s+'.':'';
  const dice=n=>n===1?'1 die':n+' dice';
  const countPairs=r=>Number.isInteger(r?.count)?r.count:Array.isArray(r?.pairings)?r.pairings.length:null;
  function skipReason(v,which,state) {
    if(v==='noPrey') return 'No wildebeest tokens remain on the board.';
    if(v==='noHunters') return which+' have no individual or small-group tokens to hunt.';
    if(v==='noEligibleHunters'){
      const flood=which==='Lions'&&state&&L?.floodedCells?.(state);
      const inFlood=Array.isArray(flood)&&(state.tokens||[]).some(t=>t.species==='lion'&&['individual','smallGroup'].includes(t.type)&&flood.some(c=>c.x===t.cell?.x&&c.y===t.cell?.y));
      if(inFlood)return 'Flooding displaced a pride. Lions without their pride token cannot hunt.';
      return which==='Hyenas'?'The eligible sizes are present, but their territory has no clan token. Those hyenas cannot hunt.'
        :which==='Lions'?'The eligible sizes are present, but their territory has no pride token. Those lions cannot hunt.'
        :'The available predators lack a required clan or pride token.';
    }
    if(v==='noAdjacentPair'||v==='noAdjacency')return 'No eligible predator and wildebeest share a side.';
    if(typeof v==='string'&&v.includes(' '))return line(v);
    return 'A hunt requires an eligible predator and a wildebeest on squares that share a side.';
  }
  const cardsById=Object.fromEntries((L?.CARDS||[]).map(c=>[c.id,c]));
  const CARD_WHY={
    removeWildebeest:'The card directs you to remove one individual wildebeest. It does not start a separate dice hunt.',
    wildebeestFlee:'Short grass lets the group spot a predator. The card allows the group to move away.',
    scare:'Stomping can make a predator back away. Its token stays within its own territory.',
    removeHyena:'The card removes a hyena individual, not a wildebeest.',
    commute:'The card lets one small hyena group travel for this season. Sharing a side with wildebeest can start a hunt.',
    addHyena:'The card adds one hyena individual. It does not add any wildebeest.',
    removeClan:'Once the clan leaves, other hyenas in that territory cannot hunt.',
    removePride:'Once the pride leaves, other lions in the flooded territory cannot hunt.',
    lionDrought:'The card models a drought by allowing a lion to move closer to wildebeest. Sharing a side can start a hunt.',
    lionStalk:'Tall grass lets the lion group approach. Sharing a side with wildebeest can start a hunt.',
    addLion:'The card adds a small group of lions. It does not add any wildebeest.',
    removeLion:'The card removes one individual lion, not a wildebeest.'
  };
  function noTargetWhy(card,state) {
    const effect=card?.effect;
    const tokens=state?.tokens||[];
    const has=(species,type)=>tokens.some(t=>t.species===species&&(!type||t.type===type));
    return ({
      removeWildebeest:'This card removes an individual wildebeest, but none remain. A small group or herd does not count.',
      removeHyena:'There is no individual hyena token to remove. A small group or clan does not count.',
      removeLion:'There is no individual lion token to remove. A small group or pride does not count.',
      removeClan:'There is no hyena clan token left to displace.',
      removePride:'There is no lion pride token left to displace.',
      addHyena:'This card needs an empty square in hyena territory. No such square is available.',
      addLion:'This card needs an empty square in lion territory. No such square is available.',
      wildebeestFlee:!has('wildebeest','smallGroup')?'This card moves a small group of wildebeest, but none remain.'
        :!has('hyena')&&!has('lion')?'There is no predator token for the group to move away from.':'No small wildebeest group can reach an open square farther from a predator within three spaces.',
      scare:!has('wildebeest','smallGroup')?'There is no small wildebeest group to scare a predator away.':'No nearby predator can move farther from a small wildebeest group and stay in its territory.',
      commute:!has('hyena','smallGroup')?'No small hyena group is available for the temporary trip.':'No eligible small hyena group has an open path up to six spaces outside its territory.',
      lionDrought:!has('wildebeest')?'No wildebeest token remains for a lion to approach.':'No lion token can move to an open square one step closer to wildebeest within its territory.',
      lionStalk:!has('lion','smallGroup')?'No small group of lions remains to move.':!has('wildebeest')?'No wildebeest token remains for the group to approach.':'No small lion group can move to an open square one step closer to wildebeest within its territory.'
    })[effect] || 'The board had no legal target or destination for this event.';
  }
  function decisionNow(decision,state){
    if (!decision || !decision.type || !state) return null;
    if (Number.isInteger(decision.logLength) && decision.logLength!==(state.log||[]).length) return null;
    if (Number.isInteger(decision.season) && decision.season!==state.season) return null;
    return decision;
  }
  function explain(context={}) {
    const {state, phase={}, decision, review, readiness, nextLabel, selected, selectedToken, last, priorLabel, selectionPending, primaryDisabled, lastHuntMessage, selectedLabel, underlying}=context;
    const p=typeof phase==='string'?{kind:phase}:phase;
    const kind=p.kind||'setup';
    const season=context.seasonName||SEASONS[state?.season]||'Winter';
    const nextSeason=context.nextSeasonName||SEASONS[(state?.season ?? 3)+1]||'';
    const recent=decisionNow(decision,state);
    const logLast=last||(state?.log||[]).at(-1);
    const freshRow=logLast && logLast.season===state?.season ? logLast : null;
    const active=p.role||(kind==='hyenaMove'?'hyena':kind==='lionMove'?'lion':null);
    const activeName=role(active);
    const predName=active==='hyena'?'hyena':active==='lion'?'lion':'predator';
    const cta=fallback=>line(nextLabel)||fallback;
    function nextForPhase(){
      if(kind==='setup') return 'Assign the three roles. Then choose '+(nextLabel||'Start winter')+'.';
      if(kind==='migration') return 'Preview a formation or use the suggested one. Then choose '+(nextLabel||(season==='Winter'?'Place winter herd':'Migrate wildebeest'))+'.';
      if(kind==='card'){
        if(!p.card)return 'Pass the device to '+activeName.toLowerCase()+'. Choose '+(nextLabel||'Draw event card')+'.';
        if(selectionPending || (selectedToken && !selected))return 'Choose one of the marked destinations for the selected piece.';
        if(primaryDisabled)return 'Choose a legal piece and destination, or stay if the card allows it.';
        if(!(p.options||[]).some(x=>x.id!=='stay'))return cta('Continue without changing the board.');
        return selectedLabel ? 'Use “'+selectedLabel+'” and choose '+(nextLabel||'Apply event')+'.' : 'Choose a legal option if needed. Then choose '+(nextLabel||'Apply event')+'.';
      }
      if(kind==='hyenaMove'||kind==='lionMove'){
        if(selectionPending || (selectedToken&&!selected))return 'Choose a marked destination for the selected predator, or clear the selection.';
        if(countPairs(readiness)===0 && (p.options||[]).length) return 'Move a predator if you want to try for a shared side, or choose '+(nextLabel||'Continue without a hunt')+'.';
        return cta('Choose an optional move or begin the hunts.');
      }
      if(kind==='hunt')return cta((p.battle?.rounds?.length?'Roll the remaining dice.':'Roll the hunt dice.'));
      if(kind==='huntReview'){
        const sayNext=underlying?.kind==='hunt'?'set up the next eligible pairing'
          :underlying?.kind==='hyenaMove'?'check hyena hunting positions'
          :underlying?.kind==='lionMove'?'check lion hunting positions'
          :underlying?.kind==='card'?'return to the event-card turn'
          :underlying?.kind==='seasonEnd'?'review the season’s results':'continue the season';
        return 'Choose '+(nextLabel||'Done')+' to '+sayNext+'.';
      }
      if(kind==='seasonEnd')return cta(nextSeason?'Continue to '+nextSeason+'.':'Finish the year.');
      if(kind==='complete')return cta('Open Analyze and support a claim with one recorded event or hunt.');
      return cta('Follow the highlighted turn control.');
    }
    const next=nextForPhase();
    let what='',why='';
    if(kind==='setup'){
      what='Your team is ready to play one modeled year.';
      why='Wildebeest, hyenas and lions share the same board. The goal is to collect evidence, not pick an overall winner.';
    } else if(kind==='migration'){
      const prey=state?.tokens?.filter(t=>t.species==='wildebeest')||[];
      what=state && !prey.length?'No wildebeest tokens remain to move.'
         :selected?.cells?.length?'A formation is previewed in the '+season.toLowerCase()+' range. No pieces have moved yet.'
         :season==='Winter'?'The starting pieces are ready to place in winter.':'The next season is '+season+'. The surviving wildebeest are ready to move.';
      const returning=recent?.type==='nextSeason' && Array.isArray(recent.moved) && recent.moved.filter(m=>m.before?.species==='hyena' && m.after?.species==='hyena');
      if(returning?.length)what+=' '+(returning.length===1?'One traveling hyena group returned to its home territory.':returning.length+' traveling hyena groups returned to their territories.');
      const corner=selected?.cornerFallback||(!selected&&p.options?.some(o=>o.cornerFallback));
      why=state && prey.length===0?'There is no surviving piece to place. The rest of this season can still be recorded.'
        :state && prey.length===1?'Only one token survives, so the board has no second wildebeest for it to touch.'
        :corner?'This digital range can’t fit all survivors in side-touching groups, so the preview allows corner contact for this placement.'
        :'The board gives each season its own grazing range. Normally each wildebeest token shares a side with another.';
    } else if(kind==='huntReview'){
      const row=review?.row||freshRow||(p.battle&&p.battle.winner?{winner:p.battle.winner,change:p.battle.change,description:p.battle.description}:null);
      const battle=review?.battle||p.battle||state?.lastBattle;
      const winner=row?.winner||battle?.winner;
      const change=Number.isInteger(row?.change)?row.change:battle?.change;
      const subject=winner==='predator'?(activeName==='The team'?'The predator':activeName)+' won the hunt.':winner==='prey'?'The wildebeest escaped.':'The hunt finished.';
      what=review?.message ? (/^(the wildebeest escaped|hyenas? (won|succeeded)|lions? (won|succeeded)|the predator (won|succeeded))/i.test(review.message)?line(review.message):subject+' '+line(review.message)) : [subject,typeof change==='number'?'Population: '+phrase(change)+'.':'', line(row?.description||battle?.description||'')].filter(Boolean).join(' ');
      const latest=battle?.rounds?.at(-1)||row?.rounds?.at(-1);
      why=winner==='predator' && latest?.preyRemaining===0?'The wildebeest ran out of dice before the predator did.'
          :winner==='prey' && latest?.predatorRemaining===0?'The predator ran out of dice first, so the wildebeest stayed on the board.'
          :'After each comparison the lower die left play. The first side with no dice lost the hunt.';
    } else if(kind==='hunt'){
      const b=p.battle||state?.battle;
      const r=b?.rounds?.at(-1);
      if(r){
        what='Dice remaining: wildebeest '+dice(r.preyRemaining)+'; '+activeName.toLowerCase()+' '+dice(r.predatorRemaining)+'.';
        const comparable=(r.pairs||[]).map(x=>x.winner==='tie'?x.prey+' vs '+x.predator+': both stay'
          :x.winner==='predator'?cap(predName)+' '+x.predator+' beat wildebeest '+x.prey
          :'Wildebeest '+x.prey+' beat '+predName+' '+x.predator);
        const untouched=Math.abs((r.prey?.length||0)-(r.predator?.length||0));
        if(untouched)comparable.push(untouched===1?'1 unmatched die stays':untouched+' unmatched dice stay');
        why=comparable.length?comparable.join('; ')+'. The lower die in each matched pair leaves play.':'The lower die in each matched pair leaves play. Tied and unmatched dice stay.';
      }else{
        what=p.event && freshRow?.kind==='card' ? line(freshRow.description)+' This starts a hunt. '+logTotal(freshRow)
          :activeName+' and wildebeest are ready to roll'+(p.event?' for a card-triggered hunt.':'.');
        if(!p.event && freshRow?.kind==='hunt' && recent?.type==='roll')what='The previous hunt was recorded. '+what;
        why=b?'These pieces share a side. Their group sizes set the starting dice: wildebeest '+dice(b.preyDice)+', '+activeName.toLowerCase()+' '+dice(b.predatorDice)+'.'
          :'Hunts start only for eligible predators and wildebeest that share a side.';
      }
    } else if(kind==='card'&&p.card){
      what=activeName+' drew “'+(p.card.title||'an event card')+'.” The card has not been applied.';
      why=!(p.options||[]).some(x=>x.id!=='stay')?noTargetWhy(p.card,state)
        :CARD_WHY[p.card.effect]||'A card can affect a different role than the player who drew it.';
    } else if(kind==='seasonEnd'){
      const rows=(state?.log||[]).filter(r=>r.season===state?.season);
      const total=rows.reduce((n,r)=>n+(Number(r.change)||0),0);
      what=season+' is complete. '+gain(total);
      why=recent?.type==='beginHunts'&&recent.count===0?role(recent.role)+' did not hunt. '+skipReason(recent.skippedReason,role(recent.role),state)
        :'The season’s total combines population changes from its event cards and its resolved hunts.';
    } else if(kind==='complete'){
      const total=(state?.log||[]).reduce((n,r)=>n+(Number(r.change)||0),0);
      what='All four seasons are complete. '+gain(total);
      why='Use the log to distinguish effects of event cards, hunts and migration. This is one modeled year, not a real population forecast.';
    } else {
      // Drawn cards, optional moves and skipped hunts need an account of what just changed, not merely the incoming stage.
      const card=recent?.card||cardsById[freshRow?.cardId];
      if(recent?.type==='beginHunts' && (recent.count===0||recent.skippedReason)){
        const who=role(recent.role);
        what=who+' did not hunt. The wildebeest population did not change.';
        why=skipReason(recent.skippedReason,who,state);
      } else if(recent?.type==='resolveCard'||(!recent&&freshRow?.kind==='card')){
        const skipped=Boolean(recent?.noCardTarget)||/^No legal target/i.test(freshRow?.description||'');
        const stayed=(!skipped && (recent?.option?.id==='stay'||recent?.optionId==='stay'||/^No token moved/i.test(freshRow?.description||'')));
        const title=card?.title||freshRow?.title||'the event card';
        const result=logTotal(freshRow);
        what=skipped?'“'+title+'” was recorded without a board change. '+result
          :stayed?'“'+title+'” was recorded; the piece stayed in place. '+result
          :[line(freshRow?.description||('Applied “'+title+'”')),result].filter(Boolean).join(' ');
        why=skipped?noTargetWhy(card,state)
          :stayed?'Staying was an available choice. The card did not require moving this piece.'
          :CARD_WHY[card?.effect]||'The board changed according to the card’s directions.';
      } else if(recent?.type==='movePredator'){
        const move=Array.isArray(recent.moved)&&recent.moved.find(m=>m.before&&m.after);
        what=move?name(move.after)+' moved to '+square(move.after.cell)+'. No wildebeest were removed.'
          :role(recent.role||active)+' changed position. No wildebeest were removed.';
        const count=countPairs(readiness);
        why=count===0?'The move did not make an eligible predator and wildebeest share a side.'
          :count!=null?'The board now has '+count+' eligible '+(count===1?'pair':'pairs')+' for this predator. A pair must share a side.'
          :'A move can change which predators and wildebeest share a side.';
      } else if(freshRow?.kind==='hunt' && (!recent || recent.type==='roll' || recent.type==='acknowledgeHunt')){
        what=lastHuntMessage?line(lastHuntMessage):[line(freshRow.title||'The hunt finished'),logTotal(freshRow)].filter(Boolean).join(' ');
        why='The hunt was resolved when one side ran out of dice. Its result is saved in the field log.';
      } else if(freshRow?.kind==='migration' && kind==='card'){
        const prey=state?.tokens?.filter(t=>t.species==='wildebeest')||[];
        what=!prey.length?'No wildebeest tokens remained to place.':season==='Winter'?'Starting wildebeest were placed in the winter range.':'The surviving wildebeest moved into the '+season.toLowerCase()+' range.';
        what+=' '+logTotal(freshRow);
        why=!prey.length?'This board recorded the season change without moving pieces.'
          :freshRow.cornerFallback?'Corner contact was allowed because a side-touching formation did not fit.'
          :'Migration changes which predators are nearby. It does not directly change the modeled population.';
      } else if(kind==='hyenaMove'||kind==='lionMove'){
        const count=countPairs(readiness);
        what=count===0?activeName+' have no eligible hunting pairs yet.'
          :count!=null?activeName+' have '+count+' eligible hunting '+(count===1?'pair':'pairs')+'.':activeName+' are checking their hunting positions.';
        why=count===0?skipReason(readiness?.blocked,activeName,state):'Eligible individual or small-group predators hunt only beside a wildebeest. Clans and prides do not hunt.';
      } else if(kind==='card'){
        what='It is '+activeName.toLowerCase()+'’s turn to draw.';
        why='Each season uses three event cards, in order: wildebeest, hyena, lion.';
      } else {
        what=priorLabel?line(priorLabel):'The board is ready for the next action.';
        why='Use the current turn controls and the field log to follow changes.';
      }
    }
    return {what:cap(what.trim()),why:cap(why.trim()),next:cap(next.trim())};
  }
  return {explain};
});
