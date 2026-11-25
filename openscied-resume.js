/* Local-only metadata for OpenSciEd Resume. Student answers stay in their original saves. */
(function (root) {
  'use strict';
  const META_KEY = 'aplab:pref:openscied-resume:v1';
  const saveEpoch = 'aplab:pref:openscied-save-session:v1:';
  const pref = 'aplab:openscied:';
  // Evidence fields only: looking at another section, rearranging a view, or mounting a saved page
  // must not promote an activity above work that was actually changed.
  const claimChecks = ['cer-ev-1','cer-ev-2','cer-ev-3','cer-ev-4','cer-ev-5','cer-caveat'];
  const sources = {
    'b1-migration': [[pref+'b1-migration:v1','notes answers observations']],
    'b1-carrying-capacity': [
      ['aplab:openscied-b1-carrying-capacity:run-v1','baseline comparison answers checks grass'],
      [pref+'b1-carrying-capacity:range:v1','baseline comparison note'],
      [pref+'b1-carrying-capacity:habitat:v1','scenario prediction a b'],
      [pref+'b1-carrying-capacity:field:v1','entries']
    ],
    'b1-serengeti': [['aplab:openscied-b1-serengeti:preview-v1','game answers']],
    'b1-ripple': [[pref+'b1-ripple:v1','answers checked choice reason predicted usual fewer claim limit finished']],
    'b2-burn-lab': [[pref+'b2-burn-lab:v1','fields burn',claimChecks]],
    'b2-fires': [[pref+'b2-fires:v1','fields cards decomp tilt',claimChecks]],
    'b2-peat-bog-lab': [[pref+'b2-peat-bog:v1','settings climate warmingUsed trials trialLabel']],
    'b2-carbon-journey': [
      [pref+'b2-carbon-journey:v1','rows answers pending done presentation coverageReviewed'],
      [pref+'b2-carbon-journey:budget:v1','furthest prediction explanation']
    ],
    'b3-screening': [[pref+'b3-screening:v1','started plan trial caseChecks claim limit finished']],
    'b3-cancer-rates': [[pref+'b3-cancer-rates:v1','casework prediction evidence claim limits completed design ret']],
    'b3-cell-cycle': [[pref+'b3-cell-cycle:v1','game trials fields quick mechanism']],
    'b3-dna-workshop': [[pref+'b3-dna-workshop:v1','progress answers']],
    'b3-dna-p53': [[pref+'b3-dna-p53:v1','fork expression fields feedback']],
    'b3-inheritance-environment': [[pref+'b3-inheritance-environment:v1','fields question pedigree twoGene meiosis skin planner yeast']],
    'b4-hawksbeard': [[pref+'b4-hawksbeard:v1','prediction released answers']],
    'b4-rat-generations': [[pref+'b4-rat-generations:v1','prediction action answers crosses analysisChecked']],
    'b4-junco': [[pref+'b4-junco:v1','prediction revealed reason observation claim limits sim']],
    'b4-wildlife-corridor': [[pref+'b4-wildlife-corridor:v1','prediction generations crossing claim limits finished']]
  };
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const safeDate = (n, now) => Number.isFinite(n) && n > 0 && n <= now ? n : 0;
  const nestedUI = new Set(['updatedAt','lastVisitedAt','openedAt','lastSection','scrollTop','lastViewed','endNotice']);
  function route(path) {
    const m = /(?:^|\/)openscied-(b[1-5]-[a-z0-9-]+)(?:\.html)?\/?$/.exec(path || '');
    return m && Object.hasOwn(sources,m[1]) ? m[1] : '';
  }
  function normalize(value) {
    if (typeof value === 'string') return value.trim() || undefined;
    if (typeof value === 'boolean') return value ? true : undefined;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (Array.isArray(value)) return value.length ? value.map(v => normalize(v) ?? null) : undefined;
    if (!record(value)) return undefined;
    const pairs = Object.keys(value).sort().filter(k => !nestedUI.has(k))
      .map(k => [k,normalize(value[k])]).filter(([,v])=>v!==undefined);
    return pairs.length ? Object.fromEntries(pairs) : undefined;
  }
  function project(saved, keys, extraFields=[]) {
    return Object.fromEntries(keys.split(' ').map(k=>{
      let value=saved[k];
      if (k==='fields' && Array.isArray(saved.responseIds) && saved.responseIds.length && value) {
        value=Object.fromEntries([...new Set([...saved.responseIds,...extraFields])].filter(id=>typeof id==='string' && Object.hasOwn(value,id)).map(id=>[id,value[id]]));
      }
      if (k==='casework' && value) {
        const { opened, ...evidence }=value;
        value=evidence;
      }
      if (k==='sim' && record(value)) {
        // Setup selectors and canceled trial IDs are not evidence; completed trials live in results.
        value={active:value.active?.finished===false ? value.active : undefined, results:value.results};
      }
      return [k,normalize(value)];
    }).filter(([,v])=>v!==undefined));
  }
  function fingerprint(value) {
    // Two short rolling hashes, not duplicate student answers. Order of object keys is normalized.
    let a=0x811c9dc5,b=0x9e3779b9;
    for(let i=0;i<value.length;i++){
      const code=value.charCodeAt(i);
      a=Math.imul(a^code,0x01000193);
      b=Math.imul(b^code,0x85ebca6b);
    }
    return (a>>>0).toString(36)+'.'+(b>>>0).toString(36);
  }
  function connect(storage, clock=Date.now, {scope=null}={}) {
    // Activity lifecycle listeners from a cleared tab must not inspect the next
    // student's records. The dashboard intentionally reconnects to current work.
    const keys=scope ? [saveEpoch+'global',saveEpoch+'scope:'+scope] : [];
    let baseline;
    try { baseline=keys.map(key=>storage.getItem(key)); } catch (_) {}
    const current=()=>!!baseline&&keys.every((key,index)=>storage.getItem(key)===baseline[index]);
    function book() {
      try { const value=JSON.parse(storage.getItem(META_KEY)); return record(value) ? value : {}; }
      catch (_) { return {}; }
    }
    function snapshot(path, mode='dashboard') {
      const id=route(path);
      if (!id) return {};
      try {
        if (!current()) return {};
        const now=clock(), notes=book(), old=notes[id]||{};
        let stamp=0;
        const data=sources[id].map(([key,fields,extraFields])=>{
          try {
            const raw=JSON.parse(storage.getItem(key));
            if (!record(raw)) return null;
            stamp=Math.max(stamp,safeDate(raw.lastVisitedAt,now));
            const p=project(raw,fields,extraFields);
            return Object.keys(p).length ? p : null;
          } catch (_) { return null; }
        });
        const signature=data.some(Boolean) ? fingerprint(JSON.stringify(data)) : '';
        const previous=safeDate(old.changed,now);
        const changed=signature ? old.signature===signature ? previous :
          mode==='exit' && old.signature!==undefined ? now : stamp || (old.signature!==undefined ? now : 0) : 0;
        const opened=mode==='open' ? now : safeDate(old.opened,now);
        const next={signature,changed,opened};
        if (current() && (next.signature!==old.signature || next.changed!==old.changed || next.opened!==old.opened)) {
          notes[id]=next;
          storage.setItem(META_KEY,JSON.stringify(notes));
        }
        return {changed,opened,legacy:stamp};
      } catch (_) { return {}; } // A metadata write failure must not prevent use of existing saved work.
    }
    return {snapshot};
  }
  const api={META_KEY,connect,route};
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  root.OpenSciEdResume=api;
  const path=root.location.pathname;
  const scope=route(path);
  if(!scope)return; // The dashboard calls snapshot for each card directly.
  let tracker;
  try { tracker=connect(root.localStorage,Date.now,{scope}); } catch (_) { return; }
  const open=()=>tracker.snapshot(path,'open');
  const exit=()=>tracker.snapshot(path,'exit');
  open();
  root.addEventListener('pageshow',event=>{if(event.persisted)open();});
  root.addEventListener('pagehide',exit);
  root.document.addEventListener('visibilitychange',()=>{if(root.document.visibilityState==='hidden')exit();});
})(typeof window==='object'?window:globalThis);
