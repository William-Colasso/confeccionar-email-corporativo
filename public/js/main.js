'use strict';

import { listTemplates, uploadData, render } from './api.js';
import { copyHtml } from './clipboard.js';
import { renderDocxContent } from './docx-render.js';
import { toast, escapeAttr } from './ui.js';

const state = {
  templateId: null,
  placeholders: [],
  columns: [],
  mapping: {},
  signatures: [],
  templatesById: {},
};

const $ = (id) => document.getElementById(id);

function enableStep(sectionId, enabled) {
  $(sectionId).classList.toggle('disabled', !enabled);
}

async function copySignature(html, label) {
  try {
    await copyHtml(html);
    toast(`Assinatura de "${label}" copiada.`);
  } catch {
    toast('Não foi possível copiar automaticamente.', true);
  }
}

// Assinatura .docx: renderiza uma vez (docx-preview) e cacheia o HTML em
// sig.html — depois disso ela se comporta como uma assinatura HTML comum.
async function docxHtml(sig) {
  if (!sig.html) sig.html = await renderDocxContent(sig.fileUrl);
  return sig.html;
}

async function copyDocxSignature(sig) {
  try {
    await copySignature(await docxHtml(sig), sig.label);
  } catch {
    toast('Não foi possível renderizar o .docx.', true);
  }
}

// ---- Passo 1: escolher template salvo ----
async function loadTemplates() {
  const sel = $('template-select');
  try {
    const { templates } = await listTemplates();
    state.templatesById = Object.fromEntries(templates.map((t) => [t.id, t]));
    if (templates.length === 0) {
      sel.innerHTML = '<option value="">(nenhum template salvo)</option>';
      $('template-result').innerHTML =
        `<span class="tag warn">Nenhum template salvo. Crie um na <a href="templates.html">página de templates</a>.</span>`;
      return;
    }
    sel.innerHTML = `<option value="">Selecione…</option>` +
      templates.map((t) => `<option value="${t.id}">${escapeAttr(t.name)}</option>`).join('');
  } catch (err) {
    toast(err.message || 'Erro ao carregar templates.', true);
  }
}

$('template-select').addEventListener('change', (e) => {
  const t = state.templatesById[e.target.value];
  if (!t) {
    enableStep('step-data', false);
    $('data-file').disabled = true;
    $('btn-data').disabled = true;
    $('template-result').innerHTML = '';
    return;
  }
  state.templateId = t.id;
  state.placeholders = t.placeholders;
  $('template-result').innerHTML =
    `<div>Campos deste template:</div>` +
    t.placeholders.map((p) => `<span class="tag">{{${p}}}</span>`).join('');
  enableStep('step-data', true);
  $('data-file').disabled = false;
  $('btn-data').disabled = false;
});

// ---- Passo 2: Planilha ----
$('btn-data').addEventListener('click', async () => {
  const file = $('data-file').files[0];
  if (!file) return toast('Selecione uma planilha.', true);
  try {
    const data = await uploadData(file, state.templateId);
    state.token = data.token;
    state.columns = data.columns;
    state.mapping = data.mapping;

    renderMappingTable(data);
    buildLabelColumnSelect();

    enableStep('step-render', true);
    $('btn-render').disabled = false;
  } catch (err) {
    toast(err.message || 'Erro ao carregar planilha.', true);
  }
});

function renderMappingTable(data) {
  const optionsFor = (selected) =>
    `<option value="">(vazio)</option>` +
    state.columns
      .map((c) => `<option value="${escapeAttr(c)}" ${c === selected ? 'selected' : ''}>${escapeAttr(c)}</option>`)
      .join('');

  const rows = state.placeholders
    .map((ph) => {
      const col = state.mapping[ph] || '';
      const warn = col ? '' : 'class="warn"';
      return `<tr>
        <td><code>{{${ph}}}</code></td>
        <td><select data-ph="${escapeAttr(ph)}">${optionsFor(col)}</select></td>
        <td ${warn}>${col ? '✓' : '⚠ sem coluna'}</td>
      </tr>`;
    })
    .join('');

  const warnCount = data.unmatched.length;
  const summary = warnCount
    ? `<span class="tag warn">${warnCount} campo(s) sem correspondência — ajuste abaixo</span>`
    : `<span class="tag">Todos os campos casaram automaticamente ✓</span>`;

  $('data-result').innerHTML =
    `<div>${data.rowCount} colaborador(es) na planilha. ${summary}</div>` +
    `<table class="map-table">
       <thead><tr><th>Campo do template</th><th>Coluna da planilha</th><th>Status</th></tr></thead>
       <tbody>${rows}</tbody>
     </table>`;

  $('data-result').querySelectorAll('select[data-ph]').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const ph = e.target.dataset.ph;
      state.mapping[ph] = e.target.value || null;
      const statusCell = e.target.closest('tr').lastElementChild;
      if (e.target.value) {
        statusCell.textContent = '✓';
        statusCell.classList.remove('warn');
      } else {
        statusCell.textContent = '⚠ sem coluna';
        statusCell.classList.add('warn');
      }
    });
  });
}

function buildLabelColumnSelect() {
  const sel = $('label-column');
  const guess = state.columns.find((c) => /nome|name/i.test(c)) || state.columns[0];
  sel.innerHTML = state.columns
    .map((c) => `<option value="${escapeAttr(c)}" ${c === guess ? 'selected' : ''}>${escapeAttr(c)}</option>`)
    .join('');
}

// ---- Passo 3: Render ----
$('btn-render').addEventListener('click', async () => {
  try {
    const data = await render(state.token, state.mapping, $('label-column').value);
    state.signatures = data.signatures;
    $('render-views').hidden = false;
    buildIndividualSelect();
    showIndividual(0);
    buildSignatureList();
    toast(`${data.signatures.length} assinatura(s) gerada(s).`);
  } catch (err) {
    toast(err.message || 'Erro ao gerar assinaturas.', true);
  }
});

function buildIndividualSelect() {
  const sel = $('individual-select');
  sel.innerHTML = state.signatures
    .map((s) => `<option value="${s.index}">${escapeAttr(s.label)}</option>`)
    .join('');
  sel.onchange = () => showIndividual(Number(sel.value));
}

function showIndividual(index) {
  const sig = state.signatures.find((s) => s.index === index);
  if (!sig) return;
  if (sig.type === 'docx') {
    $('preview-large').innerHTML = '';
    docxHtml(sig)
      .then((html) => { $('preview-large').innerHTML = html; })
      .catch(() => toast('Não foi possível renderizar o .docx.', true));
  } else {
    $('preview-large').innerHTML = sig.html;
  }
}

function buildSignatureList() {
  const list = $('signature-list');
  list.innerHTML = '';
  state.signatures.forEach((sig) => {
    const card = document.createElement('div');
    card.className = 'sig-card';

    const info = document.createElement('div');
    info.className = 'sig-info';
    const name = document.createElement('div');
    name.className = 'sig-name';
    name.textContent = sig.label;
    const mini = document.createElement('div');
    mini.className = 'sig-mini';
    if (sig.type === 'docx') {
      mini.textContent = 'Renderizando…';
      docxHtml(sig)
        .then((html) => { mini.innerHTML = html; })
        .catch(() => { mini.textContent = 'Falha ao renderizar o .docx.'; });
    } else {
      mini.innerHTML = sig.html;
    }
    info.appendChild(name);
    info.appendChild(mini);
    if (sig.url) info.appendChild(buildLinkRow(sig));

    const btn = document.createElement('button');
    btn.className = 'copy';
    btn.textContent = 'Copiar';
    btn.addEventListener('click', () =>
      sig.type === 'docx' ? copyDocxSignature(sig) : copySignature(sig.html, sig.label));

    card.appendChild(info);
    card.appendChild(btn);
    list.appendChild(card);
  });
}

// Linha com o permalink da assinatura e um botão "Copiar link".
function buildLinkRow(sig) {
  const fullUrl = location.origin + sig.url;
  const row = document.createElement('div');
  row.className = 'sig-link';
  const a = document.createElement('a');
  a.href = sig.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = fullUrl;
  const copyLink = document.createElement('button');
  copyLink.className = 'copy';
  copyLink.textContent = 'Copiar link';
  copyLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast('Link copiado.');
    } catch {
      toast('Não foi possível copiar o link.', true);
    }
  });
  row.appendChild(a);
  row.appendChild(copyLink);
  if (sig.fileUrl) {
    const dl = document.createElement('a');
    dl.href = sig.fileUrl;
    dl.className = 'copy';
    dl.textContent = 'Baixar .docx';
    row.appendChild(dl);
  }
  return row;
}

$('btn-copy-individual').addEventListener('click', () => {
  const index = Number($('individual-select').value);
  const sig = state.signatures.find((s) => s.index === index);
  if (!sig) return;
  if (sig.type === 'docx') copyDocxSignature(sig);
  else copySignature(sig.html, sig.label);
});

loadTemplates();
