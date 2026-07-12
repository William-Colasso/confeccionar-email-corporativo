'use strict';

// Copia uma assinatura como HTML rico (text/html) + texto puro, pronto p/ colar
// no Outlook. Puro: não conhece toast nem DOM da página — resolve/rejeita e o
// caller dá o feedback.

export async function copyHtml(html) {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([htmlToText(html)], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return;
    }
    await legacyCopy(html);
  } catch (err) {
    await legacyCopy(html); // última tentativa; se falhar, propaga pro caller
  }
}

// Fallback: seleciona um nó com o HTML renderizado e usa execCommand('copy').
function legacyCopy(html) {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.innerHTML = html;
    document.body.appendChild(container);
    const range = document.createRange();
    range.selectNodeContents(container);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const ok = document.execCommand('copy');
    sel.removeAllRanges();
    document.body.removeChild(container);
    ok ? resolve() : reject(new Error('execCommand falhou'));
  });
}

export function htmlToText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || '';
}
