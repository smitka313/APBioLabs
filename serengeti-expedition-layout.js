/* Responsive entry only. Move the actual control rail, never the board, and keep DOM order equal to reading order on phones. */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const play = byId('sg-play'), board = byId('sg-map-panel'), rail = byId('sg-expedition-rail');
  if (!play || !board || !rail || typeof matchMedia!=='function') return;
  const phone = matchMedia('(max-width: 700px)');
  const game = board.parentNode;
  let previousPhase = play.dataset.phase || 'setup';
  function sync() {
    const phase = play.dataset.phase || 'setup';
    const roleFirst = phone.matches && phase === 'setup';
    const startedOnPhone = phone.matches && previousPhase === 'setup' && phase !== 'setup' && !play.hidden;
    previousPhase = phase;
    const focused = document.activeElement;
    let moved = false;
    if (roleFirst && rail.nextElementSibling !== board) { game.insertBefore(rail,board); moved=true; }
    if (!roleFirst && board.nextElementSibling !== rail) { game.append(rail); moved=true; }
    play.classList.toggle('sg-role-first',roleFirst);
    if ((roleFirst || startedOnPhone) && game.classList.contains('sg-map-collapsed')) byId('sg-toggle-map')?.click();
    if (moved && focused && rail.contains(focused) && focused.isConnected) focused.focus({preventScroll:true});
    if (startedOnPhone) {
      requestAnimationFrame(() => {
        if (play.hidden || previousPhase === 'setup') return;
        const modal = byId('sg-board-dialog');
        if (modal && modal.open) return; // Starting inside the enlarged board keeps it open.
        board.scrollIntoView({block:'start',behavior:'auto'});
        byId('sg-board-title')?.focus({preventScroll:true});
      });
    }
  }
  play.addEventListener('sg:turnchange',sync);
  phone.addEventListener?.('change',sync);
  sync();
})();
