/* Fixed introductory classroom puzzle for DNA, RNA, and peptide reading.
 * The 12-letter fragment is an invented toy, not a real gene or a functional
 * design. Scaffolds omit molecular enzymes, timing, RNA processing, and how
 * complementary DNA is synthesized at a replication fork. The learner may
 * fill any blank on the board; that order does not model synthesis direction.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports=factory();
  else root.DNAWorkshopLogic=root.DnaWorkshopLogic=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const frozen=Object.freeze;
  const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
  const DNA=frozen(['A','T','C','G']);
  const RNA=frozen(['A','U','C','G']);
  const CHAIN=frozen(['Met','Ala','Phe','Stop']);
  const SORT=frozen(['copy-product','rna-product','chain-product']);
  const PALETTES=frozen({dna:DNA,rna:RNA,amino:CHAIN,sort:SORT});
  const TILE_LABELS=frozen({A:'A',T:'T',C:'C',G:'G',U:'U',Met:'Met · Methionine',Ala:'Ala · Alanine',
    Phe:'Phe · Phenylalanine',Stop:'Stop · no amino acid',
    'copy-product':'DNA → DNA','rna-product':'DNA → RNA','chain-product':'RNA → amino acid chain'});
  const TOY=frozen({
    coding:'ATGGCTTTTTAA',
    template:'TACCGAAAAATT',
    mrna:'AUGGCUUUUUAA',
    codingDirection:frozen(['5′','3′']),
    templateDirection:frozen(['3′','5′'])
  });
  const CODONS=frozen([
    {codon:'AUG',value:'Met',label:'Methionine',amino:'Met',start:true},
    {codon:'GCU',value:'Ala',label:'Alanine',amino:'Ala'},
    {codon:'UUU',value:'Phe',label:'Phenylalanine',amino:'Phe'},
    {codon:'UAA',value:'Stop',label:'Stop · no amino acid',amino:null,stop:true}
  ].map(frozen));
  const SOURCES=frozen({
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
      slots.push(frozen({id:slotId,index,row:id,rowLabel:label,kind,choices:PALETTES[kind],expected:value}));
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
  const STAGES=frozen([
    make('pair','Pair the DNA bases',[
      originalRow('pair-upper','Original strand A',forward,TOY.coding),
      originalRow('pair-lower','Original strand B',reverse,TOY.template,[0,1,2,4])
    ],{hint:'Match across the strands: A with T, and C with G. The two strands point in opposite directions.',
       takeaway:'DNA has complementary bases and its two strands are antiparallel.'}),
    make('copy','Copy both original DNA strands',[
      originalRow('copy-daughter-a-original','Daughter A · original strand A',forward,TOY.coding,[],{daughter:'A'}),
      newRow('copy-daughter-a-new','Daughter A · new complementary strand','dna',reverse,TOY.template,[2,3],{daughter:'A'}),
      newRow('copy-daughter-b-new','Daughter B · new complementary strand','dna',forward,TOY.coding,[0,4],{daughter:'B'}),
      originalRow('copy-daughter-b-original','Daughter B · original strand B',reverse,TOY.template,[],{daughter:'B'})
    ],{hint:'After the original strands separate, each one is a template for a new DNA strand.',
       takeaway:'Each daughter DNA molecule contains one original strand and one new strand.'}),
    make('transcribe','Make a messenger RNA strand',[
      originalRow('rna-template','DNA template for this message',reverse,TOY.template),
      newRow('rna-product','New mRNA','rna',forward,TOY.mrna,[0,1,2,4])
    ],{hint:'Read the provided DNA template from 3′ to 5′. Build new mRNA from 5′ to 3′ using U where DNA would use T.',
       takeaway:'Transcription uses one DNA strand as the template. The finished RNA leaves the DNA as a single strand.'}),
    make('translate','Read codons to build a chain',[
      row('chain-codons','Ribosome reads mRNA in groups of three','codon',forward,CODONS.map(item=>item.codon)),
      newRow('chain-product','Amino acids or stop signal','amino',null,CODONS.map(item=>item.value),[0,1,2,3])
    ],{hint:'Use the four-codon key. AUG starts this example. A stop signal does not add an amino acid.',
       takeaway:'The ribosome reads mRNA in the 5′ to 3′ direction. This toy message gives three amino acids followed by a stop signal.'}),
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
  function stage(id) { return typeof id==='string'&&own(stages,id)?stages[id]:null; }
  const state=placed=>frozen({v:1,placed:frozen(placed)});
  function create() { return state({}); }
  function restore(raw) {
    if(raw==null)return create();
    try{
      const saved=typeof raw==='string'?JSON.parse(raw):raw;
      if(saved?.v!==1||!saved.placed||typeof saved.placed!=='object'||Array.isArray(saved.placed))return null;
      const copy={};
      for(const [id,value] of Object.entries(saved.placed)){
        if(!own(bySlot,id)||bySlot[id].expected!==value)return null;
        copy[id]=value;
      }
      return state(copy);
    }catch(_){return null;}
  }
  function serialize(progress) { return {v:1,placed:{...progress.placed}}; }
  function check(stageId,slotId,value) {
    const pick=stageId==null?null:stage(typeof stageId==='string'?stageId:stageId.id);
    const slot=own(bySlot,slotId)?bySlot[slotId]:null;
    if(!slot||(stageId!=null&&(!pick||!pick.slots.includes(slot))))
      return {ok:false,error:'Choose an active position in this part of the workshop.',slot:null};
    if(!slot.choices.includes(value))return {ok:false,error:'That tile is not used in this part of the workshop.',slot};
    if(slot.expected!==value){
      const hints={dna:'Look at the base across from this blank and use its DNA partner.',
        rna:'Look at the DNA template base across from this blank. Remember that mRNA uses U, not T.',
        amino:'Read all three RNA letters in order and check the codon key. A stop signal is not an amino acid.',
        sort:'Read what goes in and what comes out. Match both to the name of the process.'};
      return {ok:false,error:hints[slot.kind],slot};
    }
    return {ok:true,error:'',slot};
  }
  function place(progress,slotId,value) {
    const result=check(null,slotId,value), previous=restore(progress);
    if(!previous)return {...result,ok:false,error:'This workshop record could not be read.',progress};
    if(!result.ok)return {...result,progress};
    if(previous.placed[slotId]===value)return {...result,progress};
    return {...result,progress:state({...previous.placed,[slotId]:value})};
  }
  function getValue(rowId,index,progress) {
    const r=typeof rowId==='string'?(own(byRow,rowId)?byRow[rowId]:null):rowId;
    const cell=r?.bases?.[index];
    if(!cell)return null;
    if(!cell.slotId)return cell.value;
    const slot=own(bySlot,cell.slotId)?bySlot[cell.slotId]:null, value=progress?.placed?.[cell.slotId];
    return slot&&slot.expected===value?value:null;
  }
  function complete(stageId,progress) {
    const target=stage(typeof stageId==='string'?stageId:stageId?.id);
    return !!target&&target.slots.every(slot=>progress?.placed?.[slot.id]===slot.expected);
  }
  function snapshot(progress) {
    const resolved=id=>{const r=byRow[id];const bases=r.bases.map((_,i)=>getValue(r,i,progress));return bases.every(v=>v!=null)?bases.join(''):null;};
    const chainRow=byRow['chain-product'];
    // The stop tile is kept separate. It never appears in the amino acid list.
    const amino=[];
    for(const [index,codon] of CODONS.entries()){
      if(!codon.amino||!getValue(chainRow,index,progress))break;
      amino.push(codon.amino);
    }
    return {paired:resolved('pair-lower'),daughterA:resolved('copy-daughter-a-new'),daughterB:resolved('copy-daughter-b-new'),
      mrna:resolved('rna-product'),amino,stop:getValue(chainRow,3,progress)==='Stop'};
  }
  return frozen({STAGES,stages,PALETTES,TILE_LABELS,TOY,CODONS,SOURCES,
    stage,check,create,restore,serialize,place,getValue,complete,snapshot});
});
