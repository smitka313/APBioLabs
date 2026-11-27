/* Labels existing activity navigation states. A view or an unlocked step is
   never evidence of completion. Activity controllers still own navigation,
   prerequisites, and progress; this file does not read or write storage. */
(function () {
  'use strict';
  const selector = 'nav.step-nav, nav.sf-steps, nav.cc-nav, nav.mx-pages, nav.rp-steps, nav.sg-tabs, ' +
    'nav.journey-tabs, nav.cr-steps, nav.dw-stage-nav, nav.sd-steps, nav.hb-steps, nav.rg-steps, ' +
    'nav.ju-nav, nav.wc-nav, nav.wb-tabs, nav.th-tabs, nav.ba-steps, nav.ice-nav, nav.hy-nav';
  const hintSelector = '.ose-step-hint, .dw-unlock, .wc-step-hint, .ba-caption, .ice-caption, .hy-small';
  const adjacentHints = {
    'cr-steps': 'cr-step-hint', 'dw-stage-nav': 'dw-unlock', 'journey-tabs': 'budget-next-step',
    'ba-steps': 'ba-progress', 'hy-nav': 'hy-progress', 'ice-nav': 'ice-progress'
  };
  const knownState = ['true', 'step', 'page', 'location'];
  const attrs = ['aria-current', 'aria-pressed', 'aria-disabled', 'aria-description', 'aria-describedby',
    'disabled', 'class', 'hidden', 'data-ose-complete', 'data-hb-complete', 'data-nav-step-complete', 'data-nav-step-unlock'];
  const uniqueId = (prefix, start) => {
    let n = start;
    while (document.getElementById(prefix + n)) n++;
    return prefix + n;
  };
  function setDescription(el, id, on) {
    const before = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    const after = before.filter(x => x !== id);
    if (on) after.push(id);
    if (before.join(' ') === after.join(' ')) return;
    if (after.length) el.setAttribute('aria-describedby', after.join(' '));
    else el.removeAttribute('aria-describedby');
  }
  function stateOf(el, rail) {
    const locked = el.disabled || el.getAttribute('aria-disabled') === 'true';
    const current = !locked && (knownState.includes(el.getAttribute('aria-current')) ||
      (rail.classList.contains('journey-tabs') && el.getAttribute('aria-pressed') === 'true'));
    const completeFlag = (attr) => el.hasAttribute(attr) && el.getAttribute(attr) !== 'false';
    const complete = !locked && (el.classList.contains('is-done') || completeFlag('data-ose-complete') ||
      completeFlag('data-hb-complete') || completeFlag('data-nav-step-complete'));
    return { locked, current, complete };
  }
  function isVisible(el) {
    return !!el && !el.closest('[hidden], .sr-only, [aria-hidden="true"]') && el.getClientRects().length > 0;
  }
  function mount(rail, index) {
    if (rail.hasAttribute('data-blb-step-nav')) return;
    rail.setAttribute('data-blb-step-nav', '');
    const internalHint = rail.nextElementSibling?.matches(hintSelector) ? rail.nextElementSibling : null;
    const linkedHints = (rail.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
      .map(id => document.getElementById(id)).filter(Boolean);
    const activityHint = Object.entries(adjacentHints).find(([cls]) => rail.classList.contains(cls));
    const hints = [...new Set([internalHint, activityHint && document.getElementById(activityHint[1]), ...linkedHints].filter(Boolean))];
    const words = document.createElement('small');
    words.id = uniqueId('blb-step-desc-', index);
    words.hidden = true; // A referenced hidden node supplies description without repeating it in the reading order.
    words.textContent = 'Complete.';
    rail.append(words);
    let unlock;
    function unlockText(el) {
      const direct = (el.getAttribute('data-nav-step-unlock') || el.getAttribute('aria-description') || '').trim();
      if (direct && !/^complete[.!]?$/i.test(direct)) return direct;
      const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      return ids.map(id => document.getElementById(id)).filter(node => node && node !== words)
        .map(node => node.textContent.trim()).filter(Boolean).join(' ');
    }
    function draw() {
      const controls = rail.querySelectorAll(rail.classList.contains('step-nav') ?
        'ol li > a[href^="#"]' : ':scope > button');
      let firstReason = '';
      for (const el of controls) {
        const { locked, current, complete } = stateOf(el, rail);
        const value = locked ? 'Locked' : current ? (complete ? 'Current ✓' : 'Current') : complete ? 'Complete' : '';
        const kind = locked ? 'locked' : current ? 'current' : complete ? 'complete' : 'open';
        // Keep the actual step label unchanged. Progress and accessibility readers use it.
        const label = el;
        if (el.getAttribute('data-blb-step-state') !== kind) el.setAttribute('data-blb-step-state', kind);
        let status = label.querySelector(':scope > .blb-step-status');
        if (value && !status) {
          status = document.createElement('small');
          status.className = 'blb-step-status';
          status.setAttribute('aria-hidden', 'true'); // Keep the original control name stable.
          label.append(status);
        }
        if (status) {
          if (status.textContent !== value) status.textContent = value;
          if (status.hidden === Boolean(value)) status.hidden = !value;
        }
        // Preserve descriptions from activity code and the AP link's existing SR-only completion name.
        const nativeComplete = /\bcomplete\b/i.test(el.getAttribute('aria-description') || '') ||
          Array.from(el.querySelectorAll('.done-sr, .hb-step-completion')).some(x => !x.hidden && x.textContent.trim());
        setDescription(el, words.id, complete && !nativeComplete);
        if (locked && !firstReason) firstReason = unlockText(el);
      }
      const seen = hints.find(el => isVisible(el) && el.textContent.trim());
      if (firstReason && !seen && !unlock) {
        unlock = document.createElement('p');
        unlock.className = 'blb-step-unlock';
        unlock.id = uniqueId('blb-step-unlock-', index);
        rail.after(unlock);
      }
      if (unlock) {
        const show = Boolean(firstReason && !seen);
        if (show && unlock.textContent !== firstReason) unlock.textContent = firstReason;
        if (unlock.hidden === show) unlock.hidden = !show;
        setDescription(rail, unlock.id, show);
      }
    }
    let queued = false;
    const request = () => {
      if (queued) return;
      queued = true;
      // Batch a controller's current/completion/lock changes into one paint.
      requestAnimationFrame(() => { queued = false; draw(); });
    };
    const observer = new MutationObserver(request);
    observer.observe(rail, { childList: true, subtree: true, characterData: true, attributeFilter: attrs });
    hints.forEach(el => observer.observe(el, { childList: true, subtree: true, characterData: true, attributeFilter: attrs }));
    draw();
  }
  function start() {
    document.querySelectorAll(selector).forEach(mount);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}());
