/* Fixed introductory classroom puzzle for DNA, RNA, and peptide reading.
 * The 12-letter fragment is an invented toy, not a real gene or a functional
 * design. The separate RNA reading puzzle is also fictional. Scaffolds omit
 * molecular enzymes, timing, RNA processing, and how
 * complementary DNA is synthesized at a replication fork. The learner may
 * fill any blank on the board; that order does not model synthesis direction.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports=factory(root,require('./openscied-b3-dna-workshop-codon-wheel.js'));
  else root.DNAWorkshopLogic=root.DnaWorkshopLogic=factory(root,root.DNACodonWheel);
})(typeof globalThis!=='undefined'?globalThis:this,function(root,wheel){
  'use strict';
  const frozen=Object.freeze;
  const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
  const DNA=frozen(['A','T','C','G']);
  const RNA=frozen(['A','U','C','G']);
  const SHORT_PALETTE=frozen(['Met','Ala','Phe','Stop']);
  const decoded=frozen(wheel.BASES.flatMap(a=>wheel.BASES.flatMap(b=>wheel.BASES.map(c=>wheel.translate(a+b+c)))).map(frozen));
  const SENSE=frozen(decoded.filter(x=>!x.stop&&!x.start));
  const STOPS=frozen(decoded.filter(x=>x.stop));
  const aminoNames=frozen(Object.fromEntries(decoded.filter(x=>!x.stop).map(x=>[x.abbreviation,x.name])));
  const CHAIN=frozen([...Object.keys(aminoNames).sort((a,b)=>aminoNames[a].localeCompare(aminoNames[b],'en')), 'Stop']);
  const SORT=frozen(['copy-product','rna-product','chain-product']);
  const COMPONENTS=frozen(['phosphate','sugar','base']);
  const PALETTES=frozen({component:COMPONENTS,dna:DNA,rna:RNA,amino:CHAIN,sort:SORT});
  const TILE_LABELS=frozen({phosphate:'Phosphate',sugar:'Deoxyribose (DNA sugar)',base:'Adenine (A)',
    A:'A',T:'T',C:'C',G:'G',U:'U',
    ...Object.fromEntries(Object.entries(aminoNames).map(([abbr,name])=>[abbr,abbr+' · '+name])),
    Stop:'Stop · no amino acid',
    'copy-product':'DNA → DNA','rna-product':'DNA → RNA','chain-product':'RNA → amino acid chain'});
  const TOY=frozen({
    coding:'ATGGCTTTTTAA',
    template:'TACCGAAAAATT',
    mrna:'AUGGCUUUUUAA',
    codingDirection:frozen(['5′','3′']),
    templateDirection:frozen(['3′','5′'])
  });
  function asCodon({codon,abbreviation,name,start,stop}) {
    return frozen({codon,value:abbreviation,label:stop?'Stop · no amino acid':name,amino:stop?null:abbreviation,
      ...(start?{start:true}:{}),...(stop?{stop:true}:{})});
  }
  const SHORT_CODONS=frozen(['AUG','GCU','UUU','UAA'].map(c=>asCodon(wheel.translate(c))));
  const MAX_SEED=0xffffffff, isSeed=n=>Number.isInteger(n)&&n>=0&&n<=MAX_SEED;
  const DEFAULT_SEED=0;
  function newSeed() {
    if(root.crypto?.getRandomValues)return root.crypto.getRandomValues(new Uint32Array(1))[0];
    return Math.floor(Math.random()*(MAX_SEED+1));
  }
  function practiceCodons(seed) {
    let n=seed>>>0;
    const next=()=>{
      n=(n+0x6d2b79f5)>>>0;
      let t=Math.imul(n^(n>>>15),1|n);
      t^=t+Math.imul(t^(t>>>7),61|t);
      return ((t^(t>>>14))>>>0)/(MAX_SEED+1);
    };
    const pool=SENSE.slice(), entries=[SHORT_CODONS[0]];
    for(let i=0;i<7;i++)entries.push(asCodon(pool.splice(Math.floor(next()*pool.length),1)[0]));
    entries.push(asCodon(STOPS[Math.floor(next()*STOPS.length)]));
    return frozen(entries);
  }
  const CODONS=practiceCodons(DEFAULT_SEED);
  const SOURCES=frozen({
    nucleotide:'https://www.genome.gov/genetics-glossary/Nucleotide',
    replication:'https://www.genome.gov/25520258/online-education-kit-1958-semiconservative-replication-of-dna',
    pairing:'https://www.ncbi.nlm.nih.gov/books/NBK26850/',
    transcription:'https://www.ncbi.nlm.nih.gov/books/NBK26887/',
    code:'https://www.ncbi.nlm.nih.gov/sites/books/NBK2327/bin/stdcode.pdf'
  });
  function row(id,label,kind,direction,values,indices=[],opts={}) {
    const slots=[];
    const bases=[...values].map((value,index)=>{
      if(!indices.includes(index))return frozen({index,value,slotId:null});
      const slotId=opts.slotId??id+'-'+index;
      slots.push(frozen({id:slotId,index,row:id,rowLabel:label,kind,choices:opts.choices??PALETTES[kind],expected:value}));
      return frozen({index,value:null,slotId});
    });
    return {row:frozen({id,label,kind,direction,bases:frozen(bases),origin:opts.origin??null,daughter:opts.daughter??null}),
      slots:frozen(slots)};
  }
  const forward=TOY.codingDirection, reverse=TOY.templateDirection;
  const original=frozen({origin:'original'}), newlyMade=frozen({origin:'new'});
  const originalRow=(id,label,dir,data,indices=[],opts={})=>row(id,label,'dna',dir,data,indices,{...original,...opts});
  const newRow=(id,label,kind,dir,data,indices,opts={})=>row(id,label,kind,dir,data,indices,{...newlyMade,...opts});
  function make(id,title,rows,info){
    return frozen({id,title,rows:frozen(rows.map(r=>r.row)),slots:frozen(rows.flatMap(r=>r.slots)),...info});
  }
  function makeTranslation(codons,practice) {
    const indices=codons.map((_,i)=>i), palette=practice?CHAIN:SHORT_PALETTE;
    return make('translate','Read codons to build a chain',[
      row('chain-codons','Ribosome reads mRNA in groups of three','codon',forward,codons.map(item=>item.codon)),
      newRow('chain-product','Amino acids or stop signal','amino',null,codons.map(item=>item.value),indices,{choices:palette})
    ],{codons,practice,hint:'Use the codon key. AUG starts this example. A stop signal does not add an amino acid.',
       takeaway:'The ribosome reads mRNA from 5′ to 3′. This example gives '+(codons.length-1)+' amino acids followed by a stop signal.'});
  }
  const shortTranslation=makeTranslation(SHORT_CODONS,false);
  const NUCLEOTIDE=frozen({
    nodes:frozen([
      {id:'phosphate',slotId:'nucleotide-phosphate',label:'Phosphate',description:'The phosphate group attaches to the DNA sugar.'},
      {id:'sugar',slotId:'nucleotide-sugar',label:'Deoxyribose (DNA sugar)',description:'This sugar is the part that both the phosphate and base attach to.'},
      {id:'base',slotId:'nucleotide-base',label:'Adenine (A)',description:'Adenine is one example of a DNA base.'}
    ].map(frozen)),
    bonds:frozen([frozen(['phosphate','sugar']),frozen(['sugar','base'])])
  });
  function makePair(legacyBlanks) {
    const indices=legacyBlanks?[0,1,2,4]:[0,1,2,4,5,7,8,10];
    return make('pair','Pair the DNA bases',[
      originalRow('pair-upper','Original strand A',forward,TOY.coding),
      originalRow('pair-lower','Original strand B',reverse,TOY.template,indices)
    ],{legacyBlanks,hint:'Match across the strands: A with T, and C with G. The two strands point in opposite directions.',
       takeaway:'DNA has complementary bases and its two strands are antiparallel.'});
  }
  function makeRNA(legacyBlanks) {
    const indices=legacyBlanks?[0,1,2,4]:[0,1,2,4,5,7,8,10];
    return make('transcribe','Make a messenger RNA strand',[
      originalRow('rna-template','DNA template for this message',reverse,TOY.template),
      newRow('rna-product','New mRNA','rna',forward,TOY.mrna,indices)
    ],{legacyBlanks,hint:'Read the provided DNA template from 3′ to 5′. Build new mRNA from 5′ to 3′ using U where DNA would use T.',
       takeaway:'Transcription uses one DNA strand as the template. The finished RNA leaves the DNA as a single strand.'});
  }
  const shortPair=makePair(true), shortRNA=makeRNA(true);
  const STAGES=frozen([
    make('nucleotide','Build one DNA nucleotide',NUCLEOTIDE.nodes.map(part=>
      row(part.slotId,part.label,'component',null,[part.id],[0],{slotId:part.slotId})
    ),{schematic:NUCLEOTIDE,hint:'The DNA sugar is in the middle. The phosphate and the base attach to the sugar.',
       takeaway:'A DNA nucleotide has three parts: a phosphate group, a deoxyribose sugar, and one base. A is the base in this example.'}),
    makePair(false),
    make('copy','Copy both original DNA strands',[
      originalRow('copy-daughter-a-original','Daughter A · original strand A',forward,TOY.coding,[],{daughter:'A'}),
      newRow('copy-daughter-a-new','Daughter A · new complementary strand','dna',reverse,TOY.template,[2,3],{daughter:'A'}),
      newRow('copy-daughter-b-new','Daughter B · new complementary strand','dna',forward,TOY.coding,[0,4],{daughter:'B'}),
      originalRow('copy-daughter-b-original','Daughter B · original strand B',reverse,TOY.template,[],{daughter:'B'})
    ],{hint:'After the original strands separate, each one is a template for a new DNA strand.',
       takeaway:'Each daughter DNA molecule contains one original strand and one new strand.'}),
    makeRNA(false),
    makeTranslation(CODONS,true),
    make('sort','Compare the three processes',[
      row('sort-copy','Copy DNA','sort',null,['copy-product'],[0],{slotId:'sort-copy'}),
      row('sort-rna','Make RNA','sort',null,['rna-product'],[0],{slotId:'sort-rna'}),
      row('sort-chain','Build a chain','sort',null,['chain-product'],[0],{slotId:'sort-chain'})
    ],{hint:'Read the input and product on the tile before choosing a process.',
       takeaway:'Copying DNA prepares DNA for cell division. Making RNA and building a chain are steps in reading a message.'})
  ]);
  const lookup=frozen(Object.fromEntries(STAGES.map(item=>[item.id,item])));
  const stages=frozen({...lookup,build:lookup.pair,rna:lookup.transcribe,chain:lookup.translate});
  const byRow=frozen(Object.fromEntries(STAGES.flatMap(s=>s.rows.map(row=>[row.id,row]))));
  const bySlot=frozen(Object.fromEntries(STAGES.flatMap(s=>s.slots.map(slot=>[slot.id,slot]))));
  let cachedSeed, cachedTranslation;
  const isChain=id=>typeof id==='string'&&id.startsWith('chain-product-');
  const isBuild=id=>typeof id==='string'&&id.startsWith('pair-');
  const isRNA=id=>typeof id==='string'&&id.startsWith('rna-');
  function legacyBoard(progress,key,predicate) {
    return typeof progress?.[key]==='boolean'?progress[key]:
      !own(progress??{},'seed')&&Object.keys(progress?.placed??{}).some(predicate);
  }
  function variantOf(progress) {
    if(progress?.variant==='practice'||progress?.variant==='short')return progress.variant;
    return Object.keys(progress?.placed??{}).some(id=>isChain(id)||id.startsWith('sort-'))?'short':'practice';
  }
  function stateParameters(progress) {
    // Unseeded older saves get a deterministic seed if they reach the new practice.
    return {variant:variantOf(progress),seed:isSeed(progress?.seed)?progress.seed:DEFAULT_SEED,
      legacyBuild:legacyBoard(progress,'legacyBuild',isBuild),legacyRNA:legacyBoard(progress,'legacyRNA',isRNA)};
  }
  function stage(id,progress) {
    const found=typeof id==='string'&&own(stages,id)?stages[id]:null;
    if(found?.id==='translate'){
      const {variant,seed}=stateParameters(progress);
      if(variant==='short')return shortTranslation;
      if(seed===DEFAULT_SEED)return found;
      if(seed!==cachedSeed){cachedSeed=seed;cachedTranslation=makeTranslation(practiceCodons(seed),true);}
      return cachedTranslation;
    }
    if(found?.id==='pair'&&legacyBoard(progress,'legacyBuild',isBuild))return shortPair;
    if(found?.id==='transcribe'&&legacyBoard(progress,'legacyRNA',isRNA))return shortRNA;
    return found;
  }
  function activeSlot(id,progress) {
    const name=isChain(id)?'chain':isBuild(id)?'build':isRNA(id)?'rna':null;
    return name?stage(name,progress).slots.find(slot=>slot.id===id)??null:own(bySlot,id)?bySlot[id]:null;
  }
  function activeRow(id,progress) {
    const name=typeof id==='string'&&id.startsWith('chain-')?'chain':isBuild(id)?'build':isRNA(id)?'rna':null;
    return name?stage(name,progress).rows.find(r=>r.id===id)??null:own(byRow,id)?byRow[id]:null;
  }
  const state=(placed,context)=>frozen({v:1,...context,placed:frozen(placed)});
  function create(seed) {
    return state({},{variant:'practice',seed:isSeed(seed)?seed:newSeed(),legacyBuild:false,legacyRNA:false});
  }
  function restore(raw) {
    if(raw==null)return create();
    try{
      const saved=typeof raw==='string'?JSON.parse(raw):raw;
      if(saved?.v!==1||!saved.placed||typeof saved.placed!=='object'||Array.isArray(saved.placed))return null;
      if(own(saved,'variant')&&!['practice','short'].includes(saved.variant))return null;
      if(own(saved,'seed')&&!isSeed(saved.seed))return null;
      if(['legacyBuild','legacyRNA'].some(key=>own(saved,key)&&typeof saved[key]!=='boolean'))return null;
      const context=stateParameters(saved),copy={};
      for(const [id,value] of Object.entries(saved.placed)){
        const slot=activeSlot(id,context);
        if(!slot||slot.expected!==value)return null;
        copy[id]=value;
      }
      return state(copy,context);
    }catch(_){return null;}
  }
  function serialize(progress) { return {v:1,...stateParameters(progress),placed:{...progress.placed}}; }
  function check(stageId,slotId,value,progress) {
    const pick=stageId==null?null:typeof stageId==='string'?stage(stageId,progress):progress?stage(stageId.id,progress):stageId;
    const slot=stageId==null?activeSlot(slotId,progress):pick?.slots?.find(x=>x.id===slotId)??null;
    if(!slot)
      return {ok:false,error:'Choose an active position in this part of the workshop.',slot:null};
    if(!slot.choices.includes(value))return {ok:false,error:'That tile is not used in this part of the workshop.',slot};
    if(slot.expected!==value){
      const hints={component:'Match the part name to its slot. Both the phosphate and the base attach to the DNA sugar.',
        dna:'Look at the base across from this blank and use its DNA partner.',
        rna:'Look at the DNA template base across from this blank. Remember that mRNA uses U, not T.',
        amino:'Read all three RNA letters in order and check the codon key. A stop signal is not an amino acid.',
        sort:'Read what goes in and what comes out. Match both to the name of the process.'};
      return {ok:false,error:hints[slot.kind],slot};
    }
    return {ok:true,error:'',slot};
  }
  function place(progress,slotId,value) {
    const previous=restore(progress), result=check(null,slotId,value,previous);
    if(!previous)return {...result,ok:false,error:'This workshop record could not be read.',progress};
    if(!result.ok)return {...result,progress};
    if(previous.placed[slotId]===value)return {...result,progress};
    return {...result,progress:state({...previous.placed,[slotId]:value},stateParameters(previous))};
  }
  function getValue(rowId,index,progress) {
    const r=typeof rowId==='string'?activeRow(rowId,progress):rowId;
    const cell=r?.bases?.[index];
    if(!cell)return null;
    if(!cell.slotId)return cell.value;
    const slot=activeSlot(cell.slotId,progress), value=progress?.placed?.[cell.slotId];
    return slot&&slot.expected===value?value:null;
  }
  function complete(stageId,progress) {
    const target=stage(typeof stageId==='string'?stageId:stageId?.id,progress);
    return !!target&&target.slots.every(slot=>progress?.placed?.[slot.id]===slot.expected);
  }
  function snapshot(progress) {
    const resolved=id=>{const r=byRow[id];const bases=r.bases.map((_,i)=>getValue(r,i,progress));return bases.every(v=>v!=null)?bases.join(''):null;};
    const {codons,rows:[,chainRow]}=stage('chain',progress);
    // The stop tile is kept separate. It never appears in the amino acid list.
    const amino=[];
    for(const [index,codon] of codons.entries()){
      if(!codon.amino||!getValue(chainRow,index,progress))break;
      amino.push(codon.amino);
    }
    return {paired:resolved('pair-lower'),daughterA:resolved('copy-daughter-a-new'),daughterB:resolved('copy-daughter-b-new'),
      mrna:resolved('rna-product'),amino,stop:getValue(chainRow,codons.length-1,progress)==='Stop'};
  }
  return frozen({STAGES,stages,PALETTES,TILE_LABELS,TOY,CODONS,SOURCES,
    stage,check,create,restore,serialize,place,getValue,complete,snapshot});
});
