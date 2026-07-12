// Páginas HTML do permalink público /s/:id — fora do server.js para o
// roteamento ficar só com roteamento. `id` já foi validado pelo getShare
// (alfabeto base64url); `label` é escapado aqui.

import { escapeHtml } from './render.js';

const shell = (label, body) => `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Assinatura — ${label}</title><link rel="stylesheet" href="/styles.css" /></head>
<body><main><section class="step">
<h2>Assinatura de ${label}</h2>
${body}
</section></main><div class="toast" id="toast" hidden></div>`;

// Assinatura HTML: o conteúdo já vem renderizado do servidor.
function sharePage({ label, html }) {
  return `${shell(escapeHtml(label), `<button class="copy" id="btn-copy">Copiar assinatura</button>
<div class="preview-large" id="sig">${html}</div>`)}
<script type="module">
import { copyHtml } from '/js/clipboard.js';
const html = document.getElementById('sig').innerHTML;
document.getElementById('btn-copy').addEventListener('click', () => copyHtml(html));
</script></body></html>`;
}

// Assinatura .docx: exibida no navegador pelo docx-preview (nunca convertida
// para HTML no servidor); Copiar usa só o conteúdo, Baixar entrega o arquivo.
function shareDocxPage({ label, id }) {
  return `${shell(escapeHtml(label), `<button class="copy" id="btn-copy">Copiar assinatura</button>
<a class="copy" id="btn-download" href="/s/${id}/file" download>Baixar .docx</a>
<div class="preview-large" id="sig"></div>`)}
<script src="/vendor/jszip.min.js"></script>
<script src="/vendor/docx-preview.min.js"></script>
<script type="module">
import { copyHtml } from '/js/clipboard.js';
import { renderDocxContent } from '/js/docx-render.js';
const sig = document.getElementById('sig');
sig.innerHTML = await renderDocxContent('/s/${id}/file');
document.getElementById('btn-copy').addEventListener('click', () => copyHtml(sig.innerHTML));
</script></body></html>`;
}

export { sharePage, shareDocxPage };
