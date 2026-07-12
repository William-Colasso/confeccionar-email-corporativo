'use strict';

// Busca um .docx e devolve só o HTML do CONTEÚDO, renderizado pelo docx-preview
// (globais `docx`/`JSZip` dos scripts em /vendor) num div solto — sem o "papel"
// (a <section class="docx"> traz tamanho/margens da página). O que se exibe é o
// mesmo que se copia. Puro: não conhece toast/DOM da página, como clipboard.js.
export async function renderDocxContent(fileUrl) {
  const blob = await (await fetch(fileUrl)).blob();
  const scratch = document.createElement('div');
  await window.docx.renderAsync(blob, scratch, null, { inWrapper: false });
  const section = scratch.querySelector('section.docx');
  return section ? section.innerHTML : scratch.innerHTML;
}
