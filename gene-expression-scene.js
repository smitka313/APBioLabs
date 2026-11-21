/* Gene expression scene for the OpenSciEd B.3 Lessons 5-6 companion (openscied-b3-dna-p53.html, section "Gene expression").
   A digital version of the Lesson 6 kinesthetic model. Original drawing in canvas; the controls are real buttons so the
   whole activity works with a keyboard, a mouse or a touch screen (nothing is drag-only).

   WHAT IT MODELS (the same assumptions are written in the page's "What this simulation models" note):
   - Location 1 (the nucleus): the student pairs each DNA base with its RNA partner (T-A, A-U, G-C, C-G) to build the copy.
     Every pairing is checked at once; a wrong base is flagged with a glyph and words, never by colour alone.
   - Edit: groups 2, 3, 5 and 6 of the copy are crossed out. This is the handout's simplified stand-in for RNA splicing.
     Real introns and exons differ in length and position.
   - Location 2 (the ribosome): each group of three is matched to the card with the complementary code. The card's amino
     acid is added to a chain and its word to a sentence. The card words are kept exactly as printed so the sentence agrees
     with the lesson key. One official card (RNA group CUU) says Pro where the standard genetic code says Leu; the real amino
     acid is shown next to it, marked with a dagger, with a note.
   - Protein shape: a real protein folds in 3-D from a far longer chain. The picture here is a STAND-IN: a ribbon whose
     path is built from the chain. Strand A's chain gives the "butterfly" reference; each residue that differs from it bends
     the ribbon away from that reference, and a missing last residue leaves a gap ("missing a piece").
   - "Inject an error": a seeded one-base substitution arises while the copy is made (a copying slip, as in Lesson 5). The
     error is chosen with api.rng, so the same student and the same strand get the same error after a reload. Only
     substitutions whose new group still matches a card are offered, so the changed sentence can always be read.
   All results come from the student's own choices and the seeded error; nothing here is measured data or a prediction
   about a person. Work in progress is not saved; every finished run is saved with api.addExpressionRun and is restored
   (as the last finished run) when the page is reloaded. */
(function () {
  'use strict';
  (window.B3DnaP53Scenes = window.B3DnaP53Scenes || []).push({ id: 'expression', mount: mount });

  const STAGES = [['copy', 'Copy the DNA'], ['edit', 'Edit the copy'], ['move', 'Send it to the ribosome'], ['match', 'Match the cards'], ['done', 'Read the result']];
  const BASE_VAR = { A: '--s3', T: '--s2', U: '--s2', G: '--s1', C: '--stain' };
  const SECTION = 'expression';
  const DESC_ID = 'gene-expression-desc';

  function mount(host, api) {
    const L = api.logic;
    const canvas = host.querySelector('canvas');
    const desc = host.querySelector('.scene-desc') || document.getElementById(DESC_ID);
    if (!canvas || !desc || !L) throw new Error('gene expression scene: host is incomplete');
    const ctx = canvas.getContext('2d');
    const BASE_LABEL = 'Gene expression model: DNA in the nucleus is copied into RNA, edited, and read in groups of three at a ribosome to make a chain of amino acids and a protein shape.';
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const reduced = () => !!mq.matches;
    const $el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

    /* ------------------------------------------------------------------ state */
    let S = fresh(null);
    function fresh(strand) {
      return { strand, dna: strand ? L.STRANDS[strand] : '', copy: '', err: null, errFired: false, errPos: -1, wrong: null, crossed: [], crossMsg: '',
        moved: false, matched: [], wrongCard: null, saved: false, restored: false, msg: '', msgBad: false };
    }
    const nGroups = () => S.dna.length / 3;
    const EMPTY = { copy: [], edited: [], cards: [], aminoCards: [], aminoReal: [], sentence: '' };
    const result = () => (S.strand ? L.expressCopy(S.copy.slice(0, Math.floor(S.copy.length / 3) * 3)) : null) || EMPTY;
    function stage() {
      if (!S.strand) return 'choose';
      if (S.copy.length < S.dna.length) return 'copy';
      if (!L.crossCheck(S.crossed, nGroups()).complete) return 'edit';
      if (!S.moved) return 'move';
      if (S.matched.length < result().edited.length) return 'match';
      return 'done';
    }
    const savedRuns = () => (api.getState().expression || { runs: [] }).runs || [];
    const clean = () => (S.strand ? L.transcribe(S.dna) : '');
    function say(text, bad, speak) { S.msg = text; S.msgBad = !!bad; if (speak) api.announce(text); }

    /* ------------------------------------------------------------------ actions */
    function chooseStrand(k) {
      if (!L.STRANDS[k]) return;
      S = fresh(k); moveStart = -1; foldStart = -1;
      say('Strand ' + k + ' chosen. It has ' + S.dna.length + ' DNA letters in ' + nGroups() + ' groups of three. Copy each letter, starting at the left.', false, true);
      render(true);
    }
    function startOver() {
      const k = S.strand; S = fresh(k); moveStart = -1; foldStart = -1;
      say(k ? 'Started over with Strand ' + k + '.' : 'Choose a strand to begin.', false, true);
      render(true);
    }
    function settleSlip() {
      // The copying slip happens on its own, as in a cell: the model writes the wrong base at the chosen place.
      while (S.err && !S.errFired && S.copy.length === S.err.position) {
        S.copy += S.err.to; S.errFired = true; S.errPos = S.err.position;
        say('⚠ Copying error: at letter ' + (S.err.position + 1) + ' (group ' + S.err.group + ') the model wrote ' + S.err.to + ' where ' + S.err.from + ' belonged. This is a new mistake, like a substitution in Lesson 5.', true, true);
      }
    }
    function addBase(ch) {
      if (stage() !== 'copy') return;
      const pos = S.copy.length, chk = L.pairCheck(S.dna[pos], ch);
      if (!chk.ok) { S.wrong = { pos, ch: String(ch).toUpperCase() }; say('✕ ' + chk.message, true, true); render(false); return; }
      const before = stage();
      S.wrong = null; S.copy += chk.expected; say('✓ ' + chk.message, false, false);
      settleSlip();
      afterAction(before);
    }
    function copyGroup() {
      if (stage() !== 'copy') return;
      const before = stage(); S.wrong = null;
      do { S.copy += L.transcribe(S.dna[S.copy.length]); settleSlip(); } while (S.copy.length % 3 && S.copy.length < S.dna.length);
      if (!S.msgBad) say('✓ Copied group ' + Math.ceil(S.copy.length / 3) + '.', false, false);
      afterAction(before);
    }
    function copyRest() {
      if (stage() !== 'copy') return;
      const before = stage(); S.wrong = null;
      while (S.copy.length < S.dna.length) { S.copy += L.transcribe(S.dna[S.copy.length]); settleSlip(); }
      afterAction(before);
    }
    function injectError() {
      if (!S.strand) return;
      const salt = 'expression-error:' + S.strand + ':' + savedRuns().filter(r => r.strand === S.strand && r.injectedError).length;
      const e = L.pickInjectedError(S.dna, api.rng(salt).uniform());
      if (!e) return;
      let reset = false;
      if (S.copy.length > e.position || S.errFired || stage() !== 'copy') { const k = S.strand; S = fresh(k); moveStart = -1; foldStart = -1; reset = true; }
      S.err = e; S.errFired = false;
      say(reset ? 'Started over with a copying error added to Strand ' + S.strand + '. It will happen while you copy.' : 'A copying error is added. It will happen while you copy Strand ' + S.strand + '.', false, true);
      const before = stage(); settleSlip(); afterAction(before, true);
    }
    function toggleGroup(n) {
      if (stage() !== 'edit') return;
      const i = S.crossed.indexOf(n); if (i < 0) S.crossed.push(n); else S.crossed.splice(i, 1);
      const before = 'edit', c = L.crossCheck(S.crossed, nGroups());
      if (c.complete) say('✓ Groups 2, 3, 5 and 6 are crossed out. The rest is the edited copy.', false, true);
      else if (c.wrong.length) say('✕ ' + (c.wrong.length > 1 ? 'Groups ' + listNums(c.wrong) + ' should stay.' : 'Group ' + c.wrong[0] + ' should stay.') + ' Press it again to put it back.', true, true);
      else say(S.crossed.length ? 'So far so good. Still to cross out: groups ' + listNums(c.missing) + '.' : 'Cross out groups 2, 3, 5 and 6.', false, false);
      afterAction(before);
    }
    function crossForMe() {
      if (stage() !== 'edit') return;
      S.crossed = L.EDIT_REMOVES.filter(g => g <= nGroups());
      say('✓ Groups 2, 3, 5 and 6 are crossed out. The rest is the edited copy.', false, true);
      afterAction('edit');
    }
    function sendCopy() {
      if (stage() !== 'move') return;
      S.moved = true; moveStart = reduced() ? 0 : performance.now();
      say('The edited copy leaves the nucleus through a pore and reaches the ribosome at Location 2. Now match each group of three to a card.', false, true);
      afterAction('move');
    }
    function pickCard(code) {
      if (stage() !== 'match') return;
      const res = result(), col = S.matched.length, codon = res.edited[col], need = L.anticodon(codon);
      if (code !== need) {
        const card = L.CARD_DECK.find(c => c[0] === code);
        S.wrongCard = { col, code };
        say('✕ Card ' + code + (card ? ' (' + card[2] + ')' : '') + ' is not the complement of ' + codon + '. Pair the letters: the complement of ' + codon + ' is ' + need + '.', true, true);
        render(false); return;
      }
      S.wrongCard = null; S.matched.push(code);
      const card = L.cardFor(codon);
      const m = S.matched.length, total = res.edited.length;
      say('✓ ' + codon + ' pairs with card ' + code + ': ' + card.amino + ', "' + card.word + '". ' + (m < total ? (total - m) + ' to go.' : 'The chain is complete.'), false, m === total ? false : false);
      afterAction('match');
    }
    function matchForMe(all) {
      if (stage() !== 'match') return;
      const res = result();
      do { const col = S.matched.length; S.matched.push(L.anticodon(res.edited[col])); } while (all && S.matched.length < res.edited.length);
      S.wrongCard = null;
      say('✓ Matched ' + (all ? 'the rest' : 'one group') + '.', false, false);
      afterAction('match');
    }
    function listNums(a) { return a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : String(a[0]); }
    // Called after every user action. Starts the save and announcements when a stage ends; moves focus into the next stage.
    function afterAction(before, force) {
      const now = stage();
      if (now === 'done' && !S.saved) finishRun();
      else if (now !== before) {
        const next = ({ edit: 'Copy complete (' + S.dna.length + ' letters). Next, edit the copy: cross out groups 2, 3, 5 and 6.', move: 'Edit complete. Send the edited copy to the ribosome.', match: 'The edited copy is at the ribosome. Match each group of three to a card, in order.' })[now];
        if (next) { S.msgBad = false; S.msg = next; api.announce(next); }
      }
      render(now !== before || !!force);
    }
    function finishRun() {
      const res = result(), run = L.buildRun(S.strand, S.dna, S.copy, S.errFired, Date.now());
      S.saved = true; foldStart = reduced() ? 0 : performance.now();
      if (run) api.addExpressionRun(run);
      const n = savedRuns().length;
      const msg = (run && run.matchesKey ? '✓ Done. Strand ' + S.strand + ' made: "' + res.sentence + '" This matches the key.' : '✕ Done. The sentence is "' + res.sentence + '" It does not match the key for Strand ' + S.strand + '. A mistake in the copy changed the amino acids.') + ' Run saved (' + n + ' in all).';
      say(msg, !(run && run.matchesKey), true);
    }
    function restoreLast() {
      const runs = savedRuns(), r = runs[runs.length - 1];
      if (!r || !L.STRANDS[r.strand] || typeof r.copy !== 'string') return false;
      const copy = r.copy.replace(/[^ACGU]/g, ''), dna = L.STRANDS[r.strand];
      if (copy.length !== dna.length || !L.expressCopy(copy)) return false;
      S = fresh(r.strand); S.copy = copy; S.crossed = L.EDIT_REMOVES.filter(g => g <= nGroups()); S.moved = true; S.saved = true; S.restored = true;
      const res = L.expressCopy(copy); S.matched = res.edited.map(c => L.anticodon(c));
      const clean0 = L.transcribe(dna);
      for (let i = 0; i < copy.length; i++) if (copy[i] !== clean0[i]) { S.errPos = i; S.errFired = true; S.err = { position: i, group: Math.floor(i / 3) + 1, from: clean0[i], to: copy[i] }; break; }
      S.msg = 'Showing your last saved run (Strand ' + r.strand + '). Choose a strand or press Start over to run another.';
      return true;
    }

    /* ------------------------------------------------------------------ DOM */
    const style = $el('style');
    style.textContent = `
.ge-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin:0 0 2px}
.ge-bar .ge-label{font-weight:700;margin-right:2px}
.ge-seg{display:inline-flex;flex-wrap:wrap;gap:6px}
.ge-bar .btn,.ge-tools .btn{min-height:36px}
.ge-bar .btn[aria-pressed=true]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.ge-bar .btn[aria-pressed=true]::before{content:"✓ "}
.ge-bar .ge-spacer{flex:1 1 20px}
.ge-panel{display:grid;gap:8px;padding:12px 14px;border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:var(--r);background:var(--surface);min-width:0}
.ge-panel h4{margin:0;font-size:1rem}
.ge-panel p{margin:0}
.ge-steps{display:flex;flex-wrap:wrap;gap:4px 14px;margin:0;padding:0;list-style:none;font-size:.86rem;color:var(--muted)}
.ge-steps li{display:inline-flex;gap:5px;align-items:center}
.ge-steps li[data-s=done]{color:var(--ok)}
.ge-steps li[data-s=current]{color:var(--ink);font-weight:700;text-decoration:underline;text-underline-offset:3px}
.ge-help{max-width:75ch}
.ge-tools{display:grid;gap:8px;min-width:0}
.ge-tools[hidden]{display:none}
.ge-row{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center}
.ge-base{min-width:44px;min-height:44px;font:700 1.2rem var(--f-mono);justify-content:center}
.ge-groups{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}
.ge-group{display:grid;gap:1px;justify-items:start;text-align:left;min-height:52px;padding:5px 8px;font-family:var(--f-mono)}
.ge-group .n{font:700 .78rem var(--f-body);color:var(--muted)}
.ge-group .t{font-weight:700;letter-spacing:.08em}
.ge-group .s{font:600 .74rem var(--f-body);min-height:1em}
.ge-group[aria-pressed=true]{text-decoration:line-through;background:var(--surface-2)}
.ge-group[aria-pressed=true] .s{text-decoration:none;display:inline-block}
.ge-group.is-wrong{border-color:var(--bad);background:var(--bad-soft);color:var(--ink)}
.ge-deck{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px}
.ge-card{display:grid;gap:1px;justify-items:start;text-align:left;min-height:60px;padding:6px 8px}
.ge-card .c{font:700 1rem var(--f-mono);letter-spacing:.1em}
.ge-card .a{font:700 .8rem var(--f-body);color:var(--accent)}
.ge-card .w{font:.84rem var(--f-body);color:var(--muted)}
.ge-card.is-wrong{border-color:var(--bad);background:var(--bad-soft)}
.ge-feedback{min-height:1.4em;font-weight:600}
.ge-feedback[data-bad=true]{color:var(--bad)}
.ge-feedback[data-bad=false]{color:var(--ink)}
.ge-result{display:grid;gap:6px;min-height:9.5em}
.ge-result dl{display:grid;grid-template-columns:max-content 1fr;gap:3px 12px;margin:0}
.ge-result dt{font-weight:700}
.ge-result dd{margin:0;overflow-wrap:anywhere}
.ge-result .ge-sentence{font:700 1.08rem var(--f-body);color:var(--ink)}
.ge-result .ge-sentence[data-key=true]::before{content:"✓ ";color:var(--ok)}
.ge-result .ge-sentence[data-key=false]::before{content:"✕ ";color:var(--bad)}
.ge-note{font-size:.88rem;color:var(--muted)}
@media (max-width:520px){.ge-bar .btn{flex:1 1 auto;justify-content:center}.ge-result dl{grid-template-columns:1fr}.ge-result dt{margin-top:4px}}
`;
    host.appendChild(style);
    // toolbar
    const bar = $el('div', 'ge-bar'); bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Choose a DNA strand and manage the run');
    bar.appendChild($el('span', 'ge-label', 'DNA strand:'));
    const seg = $el('span', 'ge-seg'); bar.appendChild(seg);
    const strandBtns = {};
    Object.keys(L.STRANDS).forEach(k => {
      const b = $el('button', 'btn', 'Strand ' + k); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.dataset.strand = k;
      b.addEventListener('click', () => chooseStrand(k)); seg.appendChild(b); strandBtns[k] = b;
    });
    bar.appendChild($el('span', 'ge-spacer'));
    const injectBtn = $el('button', 'btn', 'Inject an error'); injectBtn.type = 'button'; injectBtn.id = 'ge-inject';
    injectBtn.addEventListener('click', injectError); injectBtn.setAttribute('aria-describedby', 'ge-inject-help');
    const resetBtn = $el('button', 'btn', 'Start over'); resetBtn.type = 'button'; resetBtn.id = 'ge-reset';
    resetBtn.addEventListener('click', startOver);
    bar.append(injectBtn, resetBtn);
    host.insertBefore(bar, canvas);
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', BASE_LABEL);

    // stage panel
    const panel = $el('div', 'ge-panel'); panel.id = 'ge-stage';
    const stepList = $el('ol', 'ge-steps'); stepList.setAttribute('aria-label', 'Steps');
    const stepItems = STAGES.map(s => { const li = $el('li'); li.dataset.step = s[0]; stepList.appendChild(li); return li; });
    const stepTitle = $el('h4'), help = $el('p', 'ge-help');
    const fb = $el('p', 'ge-feedback'); fb.id = 'ge-feedback';
    // copy tools
    const copyTools = $el('div', 'ge-tools'); copyTools.id = 'ge-copy-tools';
    copyTools.setAttribute('role', 'group'); copyTools.setAttribute('aria-label', 'Pick the partner for the highlighted DNA letter');
    const baseRow = $el('div', 'ge-row');
    const baseBtns = ['A', 'U', 'G', 'C'].map(ch => { const b = $el('button', 'btn ge-base', ch); b.type = 'button'; b.dataset.base = ch; b.setAttribute('aria-label', ch === 'U' ? 'U (uracil)' : ch); b.addEventListener('click', () => addBase(ch)); baseRow.appendChild(b); return b; });
    const rowAuto = $el('div', 'ge-row');
    const gBtn = $el('button', 'btn', 'Copy the next group for me'), rBtn = $el('button', 'btn', 'Copy the rest for me');
    [gBtn, rBtn].forEach(b => { b.type = 'button'; });
    gBtn.id = 'ge-copy-group'; rBtn.id = 'ge-copy-rest';
    gBtn.addEventListener('click', copyGroup); rBtn.addEventListener('click', copyRest); rowAuto.append(gBtn, rBtn);
    copyTools.append(baseRow, rowAuto);
    // typing A, U, G or C also works while focus is in the copy tools
    copyTools.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const k = e.key.toUpperCase();
      if ('AUGCT'.includes(k)) { e.preventDefault(); addBase(k); }
    });
    // edit tools
    const editTools = $el('div', 'ge-tools'); editTools.id = 'ge-edit-tools';
    const groupGrid = $el('div', 'ge-groups'); groupGrid.setAttribute('role', 'group'); groupGrid.setAttribute('aria-label', 'Groups of three in your copy. Press a group to cross it out.');
    const crossBtn = $el('button', 'btn', 'Cross out groups 2, 3, 5 and 6 for me'); crossBtn.type = 'button'; crossBtn.id = 'ge-cross-all';
    crossBtn.addEventListener('click', crossForMe);
    editTools.append(groupGrid, crossBtn);
    let groupBtns = [];
    // move tools
    const moveTools = $el('div', 'ge-tools'); moveTools.id = 'ge-move-tools';
    const sendBtn = $el('button', 'btn btn--primary', 'Send the edited copy to the ribosome'); sendBtn.type = 'button'; sendBtn.id = 'ge-send';
    sendBtn.addEventListener('click', sendCopy); moveTools.appendChild(sendBtn);
    // match tools
    const matchTools = $el('div', 'ge-tools'); matchTools.id = 'ge-match-tools';
    const deck = $el('div', 'ge-deck'); deck.setAttribute('role', 'group'); deck.setAttribute('aria-label', 'Amino acid cards at Location 2');
    const cardBtns = L.CARD_DECK.map(c => {
      const b = $el('button', 'btn ge-card'); b.type = 'button'; b.dataset.code = c[0];
      b.append($el('span', 'c', c[0]), $el('span', 'a', c[1]), $el('span', 'w', '“' + c[2] + '”'));
      b.setAttribute('aria-label', 'Card ' + c[0].split('').join(' ') + ', ' + c[1] + ', word ' + c[2]);
      b.addEventListener('click', () => pickCard(c[0])); deck.appendChild(b); return b;
    });
    const rowM = $el('div', 'ge-row');
    const mOne = $el('button', 'btn', 'Match this group for me'), mAll = $el('button', 'btn', 'Match the rest for me');
    [mOne, mAll].forEach(b => { b.type = 'button'; }); mOne.id = 'ge-match-one'; mAll.id = 'ge-match-all';
    mOne.addEventListener('click', () => matchForMe(false)); mAll.addEventListener('click', () => matchForMe(true)); rowM.append(mOne, mAll);
    matchTools.append(deck, rowM);
    panel.append(stepList, stepTitle, help, copyTools, editTools, moveTools, matchTools, fb);

    // result panel
    const resBox = $el('div', 'ge-panel ge-result'); resBox.id = 'ge-result'; resBox.setAttribute('aria-label', 'Result of this run');
    resBox.appendChild($el('h4', '', 'Result of this run'));
    const resBody = $el('div'); resBox.appendChild(resBody);
    const place = desc.nextElementSibling;
    desc.after(panel); panel.after(resBox);
    void place;

    /* ------------------------------------------------------------------ text panels */
    function updatePanels() {
      const st = stage(), cur = STAGES.findIndex(s => s[0] === st);
      Object.keys(strandBtns).forEach(k => strandBtns[k].setAttribute('aria-pressed', String(S.strand === k)));
      stepItems.forEach((li, i) => {
        const state = !S.strand ? 'todo' : i < cur ? 'done' : i === cur ? 'current' : 'todo';
        li.dataset.s = state; li.textContent = (state === 'done' ? '✓ ' : '') + (i + 1) + '. ' + STAGES[i][1];
        if (state === 'current') li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      const titles = { choose: 'Choose a DNA strand', copy: 'Step 1 · Location 1, the nucleus: copy the DNA', edit: 'Step 2 · Edit the copy', move: 'Step 3 · Go to Location 2', match: 'Step 4 · Location 2, the ribosome: match each group to a card', done: 'Step 5 · Read what the cards say' };
      const helps = {
        choose: 'Pick Strand A, B or C above. They are almost the same. Then follow the gene from DNA to protein.',
        copy: 'Each DNA letter has a partner in the copy: T pairs with A, A pairs with U (RNA has U instead of T), G pairs with C and C pairs with G. Press the partner of the highlighted letter, or type A, U, G or C.',
        edit: 'The copy is in groups of three letters. Press groups 2, 3, 5 and 6 to cross them out. This stands in for the parts of real RNA that are cut out before it leaves the nucleus (a simplified stand-in for splicing).',
        move: 'What is left is the edited copy. In a cell it leaves the nucleus and reaches a ribosome.',
        match: 'For the highlighted group of three at the ribosome, find the card whose code is its complement. The card gives an amino acid for the chain and a word for the sentence.',
        done: S.restored ? 'This is your last saved run. Choose a strand, or press Start over, to run another.' : 'Compare the sentence with the key. Try another strand, or press “Inject an error” to see what a copying mistake does.'
      };
      stepTitle.textContent = titles[st]; help.textContent = helps[st];
      fb.textContent = S.msg; fb.dataset.bad = String(S.msgBad);
      copyTools.hidden = st !== 'copy'; editTools.hidden = st !== 'edit'; moveTools.hidden = st !== 'move'; matchTools.hidden = st !== 'match';
      // copy
      if (st === 'copy') {
        const d = S.dna[S.copy.length];
        copyTools.setAttribute('aria-label', 'Pick the partner for DNA letter ' + d + ' (letter ' + (S.copy.length + 1) + ' of ' + S.dna.length + ')');
        baseBtns.forEach(b => { b.classList.toggle('is-wrong', !!(S.wrong && S.wrong.ch === b.dataset.base)); });
      }
      // edit
      if (st === 'edit') {
        const res = result(), c = L.crossCheck(S.crossed, nGroups());
        if (groupBtns.length !== nGroups()) {
          groupGrid.replaceChildren(); groupBtns = [];
          for (let g = 1; g <= nGroups(); g++) {
            const b = $el('button', 'btn ge-group'); b.type = 'button'; b.dataset.g = g;
            b.append($el('span', 'n', 'Group ' + g), $el('span', 't'), $el('span', 's'));
            b.addEventListener('click', () => toggleGroup(g)); groupGrid.appendChild(b); groupBtns.push(b);
          }
        }
        groupBtns.forEach((b, i) => {
          const g = i + 1, on = S.crossed.includes(g), bad = c.wrong.includes(g);
          b.querySelector('.t').textContent = res.copy[i]; b.setAttribute('aria-pressed', String(on));
          b.classList.toggle('is-wrong', bad);
          b.querySelector('.s').textContent = bad ? '✕ should stay' : on ? '✕ crossed out' : '';
          b.setAttribute('aria-label', 'Group ' + g + ', ' + res.copy[i] + (bad ? ', crossed out by mistake, should stay' : on ? ', crossed out' : ', kept'));
        });
      }
      // match
      if (st === 'match') {
        const res = result(), col = S.matched.length;
        matchTools.setAttribute('aria-label', 'Match group ' + (col + 1) + ' of ' + res.edited.length);
        deck.setAttribute('aria-label', 'Amino acid cards at Location 2. Find the complement of ' + res.edited[col] + '.');
        cardBtns.forEach(b => b.classList.toggle('is-wrong', !!(S.wrongCard && S.wrongCard.code === b.dataset.code)));
      }
      // injectable?
      injectBtn.textContent = S.err ? 'Error added ⚠' : 'Inject an error';
      injectBtn.disabled = !S.strand;
            resetBtn.disabled = !S.strand;
      renderResult();
    }
    function renderResult() {
      resBody.replaceChildren();
      const res = result(), st = stage();
      if (!S.strand) { resBody.appendChild($el('p', 'muted', 'Choose a strand and finish a run. The strand, amino acids and sentence appear here.')); return; }
      const dl = $el('dl');
      const row = (t, v) => { dl.appendChild($el('dt', '', t)); const d = $el('dd'); if (v && v.nodeType) d.appendChild(v); else d.textContent = v; dl.appendChild(d); };
      row('Strand', 'Strand ' + S.strand + ': ' + S.dna.length + ' DNA letters, ' + nGroups() + ' groups of three' + (S.errFired ? '. A copying error was added.' : '.'));
      if (S.copy.length) row('Copy (RNA)', res.copy.join('-') + (S.copy.length % 3 ? '-' + S.copy.slice(res.copy.length * 3) : ''));
      if (st !== 'copy' && st !== 'edit') row('Edited copy', res.edited.join('-') + ' (groups ' + S.crossed.slice().sort((a, b) => a - b).join(', ') + ' crossed out)');
      if (S.matched.length) {
        const e = result(), cards = e.cards.slice(0, S.matched.length);
        row('Amino acids', cards.map(c => c.amino).join('-') + (S.matched.length < e.edited.length ? '-…' : ''));
        const words = cards.map(c => c.word).join(' ');
        const p = $el('span', 'ge-sentence'); p.textContent = S.matched.length < e.edited.length ? words + ' …' : e.sentence;
        if (st === 'done') { const ok = L.checkSentence(S.strand, e.sentence) === 'match'; p.dataset.key = String(ok); }
        row('Sentence', p);
      }
      if (st === 'done') {
        const e = result(), ok = L.checkSentence(S.strand, e.sentence) === 'match', base = L.express(S.dna);
        let cmp = ok ? '✓ Matches the lesson key for Strand ' + S.strand + '.' : '✕ Differs from the key for Strand ' + S.strand + ' (“' + L.KEY_SENTENCE[S.strand] + '”).';
        if (!ok && S.errFired) {
          const g = S.err.group, k = base.edited.map((c, i) => c).findIndex((c, i) => c !== e.edited[i]);
          cmp += ' A copying error at letter ' + (S.err.position + 1) + ' (group ' + g + ', ' + S.err.from + ' became ' + S.err.to + ') changed ' + (k >= 0 ? base.aminoCards[k] + ' to ' + e.aminoCards[k] : 'the chain') + '.';
        }
        row('Compared with the key', cmp);
        const dis = L.cardDisagreements(e);
        if (dis.length) row('† Card note', dis.map(d => 'Group ' + d.codon + ': the official card says ' + d.card + '; the standard genetic code gives ' + d.real + '.').join(' ') + ' This model keeps the card so the sentence matches the lesson.');
        row('Saved', 'This run is saved on this device (' + savedRuns().length + ' in all, see “Your data” below). The numbers are simulated by this model.');
      }
      resBody.appendChild(dl);
      if (st === 'done' && S.errFired) resBody.appendChild($el('p', 'ge-note', 'Mistakes like this can happen while a gene is expressed, not only while DNA is copied. A different amino acid can give a different shape, which can change how the protein works.'));
    }

    /* ------------------------------------------------------------------ drawing */
    let moveStart = -1, foldStart = -1, dirty = true, raf = 0, visible = true, M = null, theme = null;
    const ease = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
    function tokens() {
      const cs = getComputedStyle(document.documentElement), g = (n, f) => cs.getPropertyValue(n).trim() || f;
      return { bg: g('--surface-2', '#e8eeea'), surface: g('--surface', '#fff'), ink: g('--ink', '#14211c'), muted: g('--muted', '#56665f'), line: g('--line', '#cfd9d3'),
        accent: g('--accent', '#0d6e55'), accentSoft: g('--accent-soft', '#d9efe6'), stain: g('--stain', '#a8326b'), bad: g('--bad', '#b3261e'), badSoft: g('--bad-soft', '#f9e0de'),
        ok: g('--ok', '#1f7a3d'), warn: g('--warn', '#9a5b00'), warnSoft: g('--warn-soft', '#fbedd5'), mono: g('--f-mono', 'ui-monospace, monospace'), body: g('--f-body', 'system-ui, sans-serif'),
        s1: g('--s1', '#0d6e55'), s2: g('--s2', '#d55e00'), s3: g('--s3', '#0072b2'), s5: g('--s5', '#00798c') };
    }
    function rgba(hex, a) {
      const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex;
      let h = m[1]; if (h.length === 3) h = h.split('').map(c => c + c).join('');
      return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
    }
    const baseColor = ch => theme[BASE_VAR[ch] ? BASE_VAR[ch].replace('--', '') : 'ink'] || theme.ink;
    const font = (px, w, mono) => (w || 600) + ' ' + px + 'px ' + (mono ? theme.mono : theme.body);

    // Layout: one composition for wide canvases (everything in rows and columns) and a phone composition where the
    // ribosome part runs top to bottom as a list. All coordinates come from here, so labels follow the drawn shapes.
    function layout(W) {
      const L1 = { W, pad: W < 520 ? 12 : 18, gap: 10 }, n = S.strand ? nGroups() : 13;
      L1.narrow = W < 720;
      L1.cw = L1.narrow ? 15 : Math.max(11, Math.min(17, Math.floor(((W - 2 * L1.pad) / 13 - L1.gap) / 3)));
      L1.fs = Math.max(11, Math.round(L1.cw * 0.86)); L1.th = Math.round(L1.cw * 1.45);
      L1.gw = 3 * L1.cw + L1.gap;
      const perRow = L1.narrow ? Math.ceil(n / Math.ceil(n / Math.max(1, Math.floor((W - 2 * L1.pad + L1.gap) / L1.gw)))) : n;
      L1.perRow = perRow; L1.rows = Math.ceil(n / perRow);
      L1.blockH = 22 + L1.th + 14 + L1.th + 16;
      L1.aTop = 8; L1.aH = 30 + L1.rows * L1.blockH + 8;
      L1.bTop = L1.aTop + L1.aH + 34;
      const kept = Math.max(1, S.strand ? L.expressCopy(L.transcribe(S.dna)).edited.length : 9);
      L1.kept = kept;
      L1.side = !L1.narrow && W >= 980;
      if (!L1.narrow) {
        L1.bW = L1.side ? W - 2 * L1.pad - 300 : W - 2 * L1.pad;
        L1.colW = Math.min(104, (L1.bW - 16) / kept);
        L1.bH = 40 + 190;
      } else { L1.rowH = 31; L1.bW = W - 2 * L1.pad; L1.bH = 36 + kept * L1.rowH + 12; }
      if (L1.side) { L1.cX = L1.pad + L1.bW + 14; L1.cY = L1.bTop; L1.cW = 300 - 14; L1.cH = L1.bH; L1.H = L1.bTop + L1.bH + 10; }
      else { L1.cX = L1.pad; L1.cY = L1.bTop + L1.bH + 16; L1.cW = W - 2 * L1.pad; L1.cH = L1.narrow ? Math.min(W - 2 * L1.pad + 40, 330) : 250; L1.H = L1.cY + L1.cH + 10; }
      return L1;
    }
    // position of group g (0-based index among all groups) in the nucleus panel
    function groupXY(g) {
      const row = Math.floor(g / M.perRow), col = g % M.perRow, rowN = Math.min(M.perRow, nGroups() - row * M.perRow);
      const totalW = M.perRow * M.gw - M.gap, x0 = M.pad + (M.W - 2 * M.pad - totalW) / 2;
      return { x: x0 + col * M.gw, y: M.aTop + 30 + row * M.blockH, rowN };
    }
    // slot k (0-based among kept groups) in the ribosome panel: codon, card, bead and word positions
    function slotXY(k) {
      if (!M.narrow) {
        const x0 = M.pad + 8, cx = x0 + (k + 0.5) * M.colW, y0 = M.bTop + 40;
        return { cx, codon: { x: cx, y: y0 + 14 }, card: { x: cx, y: y0 + 58 }, bead: { x: cx, y: y0 + 108 }, word: { x: cx, y: y0 + 146 }, w: M.colW };
      }
      const y = M.bTop + 36 + (k + 0.5) * M.rowH;
      return { cy: y, num: { x: M.pad + 2, y }, codon: { x: M.pad + 42, y }, card: { x: M.pad + 112, y }, bead: { x: M.pad + 168, y }, word: { x: M.pad + 190, y }, w: M.bW };
    }
    function cardBox() { return M.narrow ? { w: 70, h: 24 } : { w: 46, h: 32 }; }
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
    function txt(s, x, y, px, color, align, weight, mono, base) { ctx.font = font(px, weight, mono); ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = base || 'middle'; ctx.fillText(s, x, y); }
    function tile(x, y, w, h, ch, kind, fs) {
      const col = ch ? baseColor(ch) : theme.line;
      rr(x, y, w, h, 4);
      if (kind === 'empty') { ctx.setLineDash([3, 3]); ctx.strokeStyle = theme.muted; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); return; }
      ctx.fillStyle = kind === 'error' ? theme.badSoft : rgba(col, 0.22); ctx.fill();
      ctx.strokeStyle = kind === 'error' ? theme.bad : col; ctx.lineWidth = kind === 'error' ? 2 : 1.3;
      if (kind === 'error') ctx.setLineDash([4, 2]); ctx.stroke(); ctx.setLineDash([]);
      txt(ch, x + w / 2, y + h / 2 + 1, fs, theme.ink, 'center', 700, true);
    }
    function panelBox(x, y, w, h, title, rightTitle) {
      rr(x, y, w, h, 16); ctx.fillStyle = theme.surface; ctx.fill(); ctx.strokeStyle = theme.line; ctx.lineWidth = 1; ctx.stroke();
      txt(title, x + 12, y + 16, 11, theme.muted, 'left', 700, true);
      if (rightTitle) txt(rightTitle, x + w - 12, y + 16, 11, theme.muted, 'right', 600, true);
    }
    function draw() {
      dirty = false;
      const W = Math.floor(host.clientWidth || 0);
      if (W < 40) return;
      theme = tokens(); M = layout(W);
      const dpr = window.devicePixelRatio || 1, H = Math.round(M.H);
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      canvas.style.width = '100%'; canvas.style.height = 'auto'; canvas.style.aspectRatio = W + ' / ' + H; canvas.style.minHeight = '0';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, W, H);
      const now = performance.now(), mv = moveStart < 0 ? 1 : ease((now - moveStart) / 900), fv = foldStart < 0 ? 1 : ease((now - foldStart) / 1000);
      drawNucleus(mv); drawRibosome(mv); drawRibbon(fv);
      if ((moveStart >= 0 && now - moveStart < 900) || (foldStart >= 0 && now - foldStart < 1000)) request();
    }
    function drawNucleus(mv) {
      const x = M.pad, y = M.aTop, w = M.W - 2 * M.pad, h = M.aH, st = stage();
      // nucleus: double membrane with a soft inner glow and nuclear pores along the lower edge
      const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, rgba(theme.accent, 0.1)); gr.addColorStop(1, rgba(theme.accent, 0.2));
      rr(x, y, w, h, 26); ctx.fillStyle = theme.surface; ctx.fill(); ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = theme.accent; ctx.lineWidth = 2.5; ctx.stroke();
      rr(x + 4, y + 4, w - 8, h - 8, 22); ctx.lineWidth = 1; ctx.strokeStyle = rgba(theme.accent, 0.55); ctx.stroke();
      txt('LOCATION 1 · NUCLEUS', x + 18, y + 17, 11, theme.accent, 'left', 700, true);
      txt(S.strand && !M.narrow ? 'Strand ' + S.strand + ' · ' + S.dna.length + ' DNA letters' : '', x + w - 18, y + 17, 11, theme.muted, 'right', 600, true);
      const pores = [0.3, 0.5, 0.7];
      pores.forEach((p, i) => { const px = x + w * p, active = i === 1 && (st === 'move' || (moveStart >= 0 && mv < 1)); ctx.fillStyle = theme.surface; ctx.fillRect(px - 10, y + h - 4, 20, 8);
        ctx.strokeStyle = active ? theme.warn : theme.accent; ctx.lineWidth = active ? 2.5 : 1.5; ctx.beginPath(); ctx.moveTo(px - 10, y + h - 6); ctx.lineTo(px - 10, y + h + 4); ctx.moveTo(px + 10, y + h - 6); ctx.lineTo(px + 10, y + h + 4); ctx.stroke(); });
      if (!S.strand) { txt('Choose Strand A, B or C to begin.', x + w / 2, y + h / 2 + 6, 15, theme.ink, 'center', 600); return; }
      const res = L.expressCopy(S.copy.slice(0, Math.floor(S.copy.length / 3) * 3)) || { copy: [] };
      for (let g = 0; g < nGroups(); g++) {
        const p = groupXY(g), isKept = !L.EDIT_REMOVES.includes(g + 1), crossed = S.crossed.includes(g + 1), wrongCross = crossed && isKept;
        // group number and rungs
        txt(String(g + 1), p.x + (3 * M.cw) / 2, p.y + 5, 11, crossed ? theme.bad : theme.muted, 'center', 700, true);
        for (let j = 0; j < 3; j++) {
          const i = g * 3 + j, lx = p.x + j * M.cw, ty = p.y + 20, by = ty + M.th + 14;
          const d = S.dna[i], copied = i < S.copy.length, c = S.copy[i], isErr = S.errFired && i === S.errPos;
          tile(lx + 1, ty, M.cw - 2, M.th, d, 'dna', M.fs);
          // pairing rungs: two for A-T, three for G-C
          const n = d === 'G' || d === 'C' ? 3 : 2; ctx.strokeStyle = copied ? theme.muted : theme.line; ctx.lineWidth = 1;
          for (let r = 0; r < n; r++) { const rx = lx + M.cw / 2 + (r - (n - 1) / 2) * 3.4; ctx.beginPath(); ctx.moveTo(rx, ty + M.th + 2); ctx.lineTo(rx, by - 2); ctx.stroke(); }
          let fade = 1;
          if (copied) {
            if (S.moved && isKept && !S.crossed.includes(g + 1)) fade = 1 - 0.6 * mv;
            ctx.globalAlpha = fade; tile(lx + 1, by, M.cw - 2, M.th, c, isErr ? 'error' : 'copy', M.fs);
            if (isErr) { txt('⚠', lx + M.cw / 2, by + M.th + 9, 12, theme.bad, 'center', 700); }
            ctx.globalAlpha = 1;
          } else if (S.wrong && S.wrong.pos === i) {
            rr(lx + 1, by, M.cw - 2, M.th, 4); ctx.fillStyle = theme.badSoft; ctx.fill(); ctx.strokeStyle = theme.bad; ctx.lineWidth = 2; ctx.stroke();
            txt('✕', lx + M.cw / 2, by + M.th / 2 + 1, M.fs, theme.bad, 'center', 800);
            txt(S.wrong.ch, lx + M.cw / 2, by + M.th + 9, 11, theme.bad, 'center', 700, true);
          } else tile(lx + 1, by, M.cw - 2, M.th, null, 'empty', M.fs);
          if (i === S.copy.length && st === 'copy') {            // the letter being copied right now
            ctx.strokeStyle = theme.accent; ctx.lineWidth = 2.5; rr(lx - 1, ty - 2, M.cw + 2, M.th + 4, 5); ctx.stroke();
            txt('▼', lx + M.cw / 2, ty - 5, 11, theme.accent, 'center', 700);
            ctx.setLineDash([2, 2]); ctx.strokeStyle = theme.accent; rr(lx - 1, by - 2, M.cw + 2, M.th + 4, 5); ctx.stroke(); ctx.setLineDash([]);
          }
        }
        if (crossed) {                                            // cross-out: a line through the copy tiles plus an ✕ above
          const by = p.y + 20 + M.th + 14;
          ctx.strokeStyle = wrongCross ? theme.bad : theme.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p.x - 1, by + M.th / 2); ctx.lineTo(p.x + 3 * M.cw + 1, by + M.th / 2); ctx.stroke();
          if (wrongCross) { rr(p.x - 2, p.y + 10, 3 * M.cw + 4, 2 * M.th + 20, 6); ctx.strokeStyle = theme.bad; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); txt('✕ keep', p.x + 3 * M.cw / 2, p.y + 2 * M.th + 42, 11, theme.bad, 'center', 700); }
        }
        if (S.moved && isKept && !crossed && mv >= 1) txt('sent', p.x + 3 * M.cw / 2, p.y + 2 * M.th + 40, 11, theme.muted, 'center', 600);
      }
      // row captions
      const p0 = groupXY(0);
      if (!M.narrow) { txt('DNA', p0.x - 6, p0.y + 20 + M.th / 2, 11, theme.muted, 'right', 700, true); txt('copy', p0.x - 6, p0.y + 34 + M.th * 1.5, 11, theme.muted, 'right', 700, true); }
    }
    // flying groups during the move, drawn above both panels
    function drawFlying(mv) {
      if (moveStart < 0 || mv >= 1) return;
      const res = L.expressCopy(S.copy); let k = 0;
      for (let g = 0; g < nGroups(); g++) {
        if (L.EDIT_REMOVES.includes(g + 1)) continue;
        const a = groupXY(g), b = slotXY(k), ax = a.x + 1.5 * M.cw, ay = a.y + 20 + M.th + 14 + M.th / 2, bx = b.codon.x + (M.narrow ? 0 : 0), by = b.codon.y;
        const t = Math.min(1, Math.max(0, mv * 1.2 - k * 0.02)), x = ax + (bx - ax) * t, y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 18;
        const cw = 3 * (M.narrow ? 8 : 8.5) + 10; rr(x - cw / 2, y - 10, cw, 20, 5); ctx.fillStyle = rgba(theme.accent, 0.25); ctx.fill(); ctx.strokeStyle = theme.accent; ctx.lineWidth = 1.5; ctx.stroke();
        txt(res.edited[k], x, y + 1, 12, theme.ink, 'center', 700, true); k++;
      }
    }
    function drawRibosome(mv) {
      const st = stage(), x = M.pad, y = M.bTop, w = M.bW, h = M.bH;
      panelBox(x, y, w, h, 'LOCATION 2 · RIBOSOME', S.strand && S.moved && !M.narrow ? 'READ IN GROUPS OF THREE' : '');
      if (!S.strand || !S.moved || mv < 0.001 && moveStart >= 0) {
        txt(!S.strand ? 'The edited copy will arrive here.' : st === 'copy' || st === 'edit' ? 'The edited copy will arrive here after Steps 1 and 2.' : 'Waiting for the edited copy…', x + w / 2, y + h / 2 + 8, 14, theme.muted, 'center', 600);
                return;
      }
      const res = L.expressCopy(S.copy), base = L.express(S.dna), kept = res.edited.length, col = S.matched.length;
      // ribosome: a large subunit above and a small subunit below the active group, with the mRNA threaded between
      const active = Math.min(col, kept - 1), a = slotXY(active), opening = mv >= 1;
      if (opening && st !== 'done') {
        ctx.save(); ctx.globalAlpha = 0.95;
        if (!M.narrow) {
          const rw = Math.min(a.w * 0.92, 110), cy0 = a.codon.y;
          ctx.beginPath(); ctx.ellipse(a.cx, cy0 - 14, rw / 2, 22, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = rgba(theme.accent, 0.2); ctx.fill(); ctx.strokeStyle = theme.accent; ctx.lineWidth = 2; ctx.stroke();
          ctx.beginPath(); ctx.ellipse(a.cx, cy0 + 14, rw / 2 - 8, 14, 0, 0, Math.PI); ctx.closePath(); ctx.fillStyle = rgba(theme.accent, 0.12); ctx.fill(); ctx.stroke();
          txt('ribosome', a.cx, cy0 - 26, 11, theme.accent, 'center', 700);
        } else {
          rr(x + 6, a.cy - 14, a.bead.x + 22 - (x + 6), 28, 14); ctx.fillStyle = rgba(theme.accent, 0.16); ctx.fill(); ctx.strokeStyle = theme.accent; ctx.lineWidth = 2; ctx.stroke();
          txt('← ribosome', a.word.x, a.cy, 11, theme.accent, 'left', 700);
        }
        ctx.restore();
      }
      // mRNA backbone through the codons
      ctx.strokeStyle = rgba(theme.muted, 0.6); ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k < kept; k++) { const s = slotXY(k); const c = s.codon, c2 = M.narrow ? { x: c.x, y: c.y } : { x: c.x, y: c.y }; if (k === 0) ctx.moveTo(c2.x - (M.narrow ? 0 : 0), c2.y); else ctx.lineTo(c2.x, c2.y); }
      ctx.stroke();
      if (col > 0 && !(moveStart >= 0 && mv < 1)) {            // bonds of the growing chain first, so no bond crosses a label
        ctx.strokeStyle = theme.accent; ctx.lineWidth = 4; ctx.beginPath();
        for (let k = 0; k < col; k++) { const b = slotXY(k).bead; if (k) ctx.lineTo(b.x, b.y); else ctx.moveTo(b.x, b.y); }
        ctx.stroke();
      }
      let prevBead = null;
      for (let k = 0; k < kept; k++) {
        const s = slotXY(k), matched = k < col, isCur = k === col && st === 'match';
        const codonW = 3 * (M.narrow ? 8.2 : 9.2) + 12, changed = S.errFired && res.edited[k] !== base.edited[k] || (S.errFired && res.aminoCards[k] !== base.aminoCards[k]);
        // codon tile
        const fly = moveStart >= 0 && mv < 1;
        if (!fly) {
          rr(s.codon.x - codonW / 2, s.codon.y - 11, codonW, 22, 5); ctx.fillStyle = theme.surface; ctx.fill(); ctx.fillStyle = changed ? theme.badSoft : rgba(theme.accent, isCur ? 0.3 : 0.14); ctx.fill();
          ctx.strokeStyle = changed ? theme.bad : theme.accent; ctx.lineWidth = isCur ? 2.5 : 1.3; if (changed) ctx.setLineDash([4, 2]); ctx.stroke(); ctx.setLineDash([]);
          txt(res.edited[k], s.codon.x, s.codon.y + 1, 13, theme.ink, 'center', 700, true);
          if (M.narrow) txt(String(k + 1), s.num.x, s.num.y, 11, theme.muted, 'left', 700, true);
          if (changed) txt('⚠', s.codon.x + codonW / 2 + (M.narrow ? 8 : 0) - (M.narrow ? 0 : 0), s.codon.y - (M.narrow ? 0 : 16), 12, theme.bad, 'center', 700);
        }
        if (fly) continue;
        const drawCard = () => {
          const cb = cardBox(), cw = cb.w, ch = cb.h, cx = s.card.x, cy = s.card.y, card = res.cards[k];
          if (!M.narrow) { ctx.beginPath(); ctx.moveTo(cx - 6, cy - ch / 2); ctx.lineTo(cx, cy - ch / 2 - 6); ctx.lineTo(cx + 6, cy - ch / 2); ctx.closePath(); ctx.fillStyle = theme.surface; ctx.fill(); ctx.strokeStyle = theme.stain; ctx.lineWidth = 1.6; ctx.stroke(); }
          rr(cx - cw / 2, cy - ch / 2, cw, ch, 5); ctx.fillStyle = theme.surface; ctx.fill(); ctx.strokeStyle = theme.stain; ctx.lineWidth = 1.6; ctx.stroke();
          if (!M.narrow) { ctx.fillStyle = theme.surface; ctx.fillRect(cx - 5, cy - ch / 2 - 1, 10, 3); }
          if (M.narrow) { txt(card ? card.code : '???', cx - 14, cy + 1, 12, theme.ink, 'center', 700, true); txt(card ? card.amino : '?', cx + 18, cy + 1, 11, theme.stain, 'center', 700); }
          else { txt(card ? card.code : '???', cx, cy - 7, 12, theme.ink, 'center', 700, true); txt(card ? card.amino : '?', cx, cy + 9, 11, theme.stain, 'center', 700); }
        };
        if (matched) {
          drawCard();
          const card = res.cards[k], real = res.aminoReal[k], dis = real !== card.amino;
          const bx = s.bead.x, by = s.bead.y;
          // growing chain: bonds first, then beads
          ctx.beginPath(); ctx.arc(bx, by, 14, 0, Math.PI * 2); const gb = ctx.createRadialGradient(bx - 4, by - 5, 2, bx, by, 15); gb.addColorStop(0, rgba(theme.accent, 0.1)); gb.addColorStop(1, rgba(theme.accent, 0.45));
          ctx.fillStyle = theme.surface; ctx.fill(); ctx.fillStyle = gb; ctx.fill(); ctx.strokeStyle = changed ? theme.bad : theme.accent; ctx.lineWidth = 2; if (dis) ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]);
          txt(card.amino, bx, by + 1, 11, theme.ink, 'center', 700);
          if (dis) txt('†', bx + 14, by - 12, 13, theme.warn, 'center', 800);
          const wx = s.word.x, wy = s.word.y;
          if (!M.narrow) {
            txt('“' + card.word + '”', wx, wy, 13, changed ? theme.bad : theme.ink, 'center', 700);
            if (dis) txt('real: ' + real, wx, wy + 16, 11, theme.warn, 'center', 600);
            if (changed) txt('CHANGED', wx, wy + (dis ? 30 : 16), 11, theme.bad, 'center', 800);
          } else {
            const wt = '“' + card.word + '”'; txt(wt, wx + 12, wy, 12, changed ? theme.bad : theme.ink, 'left', 700);
            let ex = wx + 12 + ctx.measureText(wt).width + 6;
            if (changed) { txt('CHANGED', ex, wy, 11, theme.bad, 'left', 800); ex += ctx.measureText('CHANGED').width + 6; }
            if (dis) { const rt = '† real: ' + real; ctx.font = font(11, 600); if (ex + ctx.measureText(rt).width < M.W - M.pad - 4) txt(rt, ex, wy, 11, theme.warn, 'left', 600); }
          }
          prevBead = { x: bx, y: by };
        } else if (isCur) {
          const wr = S.wrongCard && S.wrongCard.col === k;
          rr(s.card.x - cardBox().w / 2, s.card.y - cardBox().h / 2, cardBox().w, cardBox().h, 5); ctx.setLineDash([4, 3]); ctx.strokeStyle = wr ? theme.bad : theme.accent; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
          txt(wr ? '✕' : '?', s.card.x, s.card.y + 1, 15, wr ? theme.bad : theme.accent, 'center', 800);
        } else {
          rr(s.card.x - cardBox().w / 2, s.card.y - cardBox().h / 2, cardBox().w, cardBox().h, 5); ctx.setLineDash([3, 3]); ctx.strokeStyle = theme.line; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
        }
      }
      if (moveStart >= 0 && mv < 1) drawFlying(mv);
    }
    // ----- protein shape: a stand-in ribbon built from the chain (see the header comment)
    function lemniscate(i, n) { const t = 2 * Math.PI * i / n, s = Math.sin(t), c = Math.cos(t), d = 1 + s * s; return [c / d, 1.7 * s * c / d]; }
    function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    // Points (unit square, y up) for the chain of amino acids. Residues equal to Strand A's chain sit on the butterfly
    // reference; any other residue is bent away from it by an amount set by its name and place.
    function shapePoints(chain) {
      const ref = L.express(L.STRANDS.A).aminoCards, N = ref.length;
      return chain.map((aa, i) => {
        const p = lemniscate(i, N);
        if (aa === ref[i]) return p;
        const ang = (hashStr(aa + ':' + i) % 3600) / 3600 * 2 * Math.PI;
        return [Math.max(-1.05, Math.min(1.05, p[0] + 0.4 * Math.cos(ang))), Math.max(-1.0, Math.min(1.0, p[1] + 0.4 * Math.sin(ang)))];
      });
    }
    function spline(pts, closed) {          // Catmull-Rom through the points, as cubic Bezier segments
      const n = pts.length, P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))], segs = closed ? n : n - 1, out = [];
      for (let i = 0; i < segs; i++) {
        const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
        out.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]);
      }
      return out;
    }
    function strokeSpline(segs, to) {
      ctx.beginPath(); segs.forEach((s, i) => { if (!i) ctx.moveTo(to(s[0])[0], to(s[0])[1]); ctx.bezierCurveTo(to(s[1])[0], to(s[1])[1], to(s[2])[0], to(s[2])[1], to(s[3])[0], to(s[3])[1]); });
    }
    function drawRibbon(fv) {
      const x = M.cX, y = M.cY, w = M.cW, h = M.cH, st = stage();
      panelBox(x, y, w, h, 'PROTEIN SHAPE', 'STAND-IN PICTURE');
      const size = Math.min(w - 20, h - 48), cx = x + w / 2, cy = y + 24 + (h - 24 - 22) / 2, sc = size / 2.5;
      const to = p => [cx + p[0] * sc, cy - p[1] * sc];
      const N = 9, refPts = Array.from({ length: N }, (_, i) => lemniscate(i, N));
      // reference: the "butterfly" shape of Strand A (dashed outline, body and feelers)
      ctx.save(); ctx.globalAlpha = 0.9; ctx.setLineDash([5, 4]); ctx.strokeStyle = theme.muted; ctx.lineWidth = 1.4; strokeSpline(spline(refPts, true), to); ctx.stroke(); ctx.setLineDash([]);
      const c0 = to([0, 0]); ctx.strokeStyle = theme.muted; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c0[0], c0[1] - 0.45 * sc); ctx.lineTo(c0[0], c0[1] + 0.45 * sc); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(c0[0], c0[1] - 0.45 * sc); ctx.quadraticCurveTo(c0[0] - 0.12 * sc, c0[1] - 0.7 * sc, c0[0] - 0.22 * sc, c0[1] - 0.72 * sc); ctx.moveTo(c0[0], c0[1] - 0.45 * sc); ctx.quadraticCurveTo(c0[0] + 0.12 * sc, c0[1] - 0.7 * sc, c0[0] + 0.22 * sc, c0[1] - 0.72 * sc); ctx.stroke(); ctx.restore();
      txt('dashed: Strand A (butterfly)', x + 12, y + h - 12, 11, theme.muted, 'left', 600);
      if (!S.strand || st !== 'done') {
        const n = S.matched.length;
        txt(!S.strand ? 'Choose a strand' : S.moved ? 'Folds when the chain is done (' + n + ' of ' + result().edited.length + ')' : 'Folds once the chain is built', x + w / 2, y + 34, 12, theme.muted, 'center', 600);
        canvas.dataset.shape = ''; return;
      }
      const res = result(), chain = res.aminoCards, pts = shapePoints(chain), open = chain.length < N;
      // fold animation: from a straight chain to the final shape
      const line = chain.map((_, i) => [-1 + 2 * i / Math.max(1, N - 1), -1.15]), cur = pts.map((p, i) => [line[i][0] + (p[0] - line[i][0]) * fv, line[i][1] + (p[1] - line[i][1]) * fv]);
      canvas.dataset.shape = pts.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
      if (open) {                                  // the piece that is missing, drawn as a dotted gap with a ✕
        ctx.save(); ctx.setLineDash([2, 6]); ctx.lineCap = 'round'; ctx.strokeStyle = theme.bad; ctx.lineWidth = 3;
        const last = cur[cur.length - 1], first = cur[0], ghost = refPts.slice(chain.length);
        ctx.beginPath(); const l0 = to(last); ctx.moveTo(l0[0], l0[1]); ghost.forEach(g => { const q = to(g); ctx.lineTo(q[0], q[1]); }); const f0 = to(first); ctx.lineTo(f0[0], f0[1]); ctx.stroke(); ctx.restore();
        const mp = to(ghost[Math.floor(ghost.length / 2)] || last); txt('✕ missing piece', mp[0], mp[1] + (mp[1] < cy ? 24 : -18), 12, theme.bad, 'center', 800);
      }
      const segs = spline(cur, !open && fv >= 1);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4; ctx.strokeStyle = theme.accent; ctx.lineWidth = 13; strokeSpline(segs, to); ctx.stroke();
      ctx.shadowColor = 'transparent'; ctx.strokeStyle = rgba(theme.surface, 0.55); ctx.lineWidth = 7; strokeSpline(segs, to); ctx.stroke();
      ctx.strokeStyle = theme.accent; ctx.lineWidth = 2; strokeSpline(segs, to); ctx.stroke(); ctx.restore();
      // residues
      const base = L.express(S.dna), key = L.express(L.STRANDS[S.strand]);
      cur.forEach((p, i) => {
        const q = to(p), ref = L.express(L.STRANDS.A).aminoCards[i], diff = chain[i] !== ref;
        ctx.beginPath(); ctx.arc(q[0], q[1], 11.5, 0, Math.PI * 2); ctx.fillStyle = theme.surface; ctx.fill(); ctx.strokeStyle = diff ? theme.stain : theme.accent; ctx.lineWidth = 2; if (diff) ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]);
        txt(chain[i], q[0], q[1] + 1, 11, theme.ink, 'center', 700);
      });
      void base; void key;
      txt(open ? 'Shorter chain: ' + chain.length + ' amino acids' : '9 amino acids' + (chain.every((a, i) => a === L.express(L.STRANDS.A).aminoCards[i]) ? '' : ' · dashed rings differ from Strand A'), x + 12, y + h - 28, 11, theme.muted, 'left', 600);
    }
    function request() { dirty = true; if (!raf && visible) raf = requestAnimationFrame(frame); }
    function frame() { raf = 0; if (dirty && visible) draw(); }

    function describe() {
      const st = stage();
      let s;
      if (!S.strand) s = 'Text description: no strand chosen yet. The nucleus is empty. Choose Strand A, B or C.';
      else {
        const res = result(), parts = ['Text description: Strand ' + S.strand + ', ' + S.dna.length + ' DNA letters in ' + nGroups() + ' groups of three.'];
        parts.push('Step ' + (STAGES.findIndex(x => x[0] === st) + 1) + ' of 5, ' + STAGES.find(x => x[0] === st)[1].toLowerCase() + '.');
        if (S.copy.length < S.dna.length) parts.push(S.copy.length + ' of ' + S.dna.length + ' letters copied' + (S.errFired ? ', including one copying error at letter ' + (S.errPos + 1) : '') + '.');
        else {
          parts.push('The copy is ' + res.copy.join(' ') + (S.errFired ? ', with a copying error at letter ' + (S.errPos + 1) + ' (' + S.err.from + ' became ' + S.err.to + ')' : '') + '.');
          parts.push(S.crossed.length ? 'Crossed out groups: ' + S.crossed.slice().sort((a, b) => a - b).join(', ') + '.' : 'No groups crossed out yet.');
        }
        if (S.moved) parts.push('The edited copy ' + result().edited.join(' ') + ' is at the ribosome; ' + S.matched.length + ' of ' + result().edited.length + ' groups matched to cards.');
        if (st === 'done') parts.push('Amino acid chain ' + res.aminoCards.join('-') + '. Sentence: ' + res.sentence + ' Protein shape picture: ' + (res.aminoCards.length < 9 ? 'the ribbon is missing a piece.' : res.aminoCards.every((a, i) => a === L.express(L.STRANDS.A).aminoCards[i]) ? 'a butterfly shape.' : 'a different shape from the butterfly.'));
        parts.push('This is a simplified model with simulated results.');
        s = parts.join(' ');
      }
      desc.textContent = s;
      canvas.setAttribute('aria-label', BASE_LABEL + (S.strand ? ' Now showing Strand ' + S.strand + ', ' + STAGES.find(x => x[0] === st)[1].toLowerCase() + '.' : ''));
    }

    let firstFocus = false;
    function render(moveFocus) {
      updatePanels(); describe(); request();
      if (moveFocus && firstFocus) {
        const st = stage(), t = ({ copy: baseBtns[0], edit: groupBtns[0], move: sendBtn, match: cardBtns[0], done: resetBtn, choose: strandBtns.A })[st];
        if (t && !t.disabled && !t.closest('[hidden]')) try { t.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }
    // events
    function onRedraw() { request(); }
    if ('ResizeObserver' in window) new ResizeObserver(onRedraw).observe(host); else window.addEventListener('resize', onRedraw);
    document.addEventListener('companion:show', onRedraw);
    new MutationObserver(onRedraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (mq.addEventListener) { mq.addEventListener('change', onRedraw); }
    if (window.matchMedia) { const dm = matchMedia('(prefers-color-scheme: dark)'); if (dm.addEventListener) dm.addEventListener('change', onRedraw); }
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); if (visible) request(); }, { rootMargin: '200px' }).observe(host);
    canvas.style.aspectRatio = '960 / 430'; canvas.style.minHeight = '0';
    const injectHelp = $el('span', 'sr-only', 'Adds a seeded one-letter copying error while you copy this strand.'); injectHelp.id = 'ge-inject-help'; bar.appendChild(injectHelp);
    // first view: restore the last saved run, if any
    if (!restoreLast()) S.msg = '';
    render(false); firstFocus = true;
    host.dataset.geReady = '1';
    void SECTION;
  }
})();
