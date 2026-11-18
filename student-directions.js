/* The guides remain readable and printable with JavaScript disabled. */
'use strict';
const printDirections = document.getElementById('print-directions');
if (printDirections) {
  printDirections.hidden = false;
  printDirections.addEventListener('click', () => window.print());
}
