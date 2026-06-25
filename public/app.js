'use strict';

const state = {
  token: null,
  placeholders: [],
  columns: [],
  mapping: {},
  signatures: [],
};

const $ = (id) => document.getElementById(id);

function toast(message, isError = false) {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2600);
}

function enableStep(sectionId, enabled) {
  $(sectionId).classList.toggle('disabled', !enabled);
}

// ---- Passo 1: Template ----
$('btn-template').addEventListener('click', async () => {
  const file = $('template-file').files[0];
  if (!file) return toast('Selecione um arquivo de template.', true);

  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch('/api/template', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.token = data.token;
    state.placeholders = data.placeholders;

    $('template-result').innerHTML =
      `<div>Formato: <strong>${data.format.toUpperCase()}</strong>. Campos detectados:</div>` +
      data.placeholders.map((p) => `<span class="tag">{{${p}}}</span>`).join('');

    // Libera o passo 2
    enableStep('step-data', true);
    $('data-file').disabled = false;
    $('btn-data').disabled = false;
  } catch (err) {
    toast(err.message || 'Erro ao carregar template.', true);
  }
});

// ---- Passo 2: Planilha ----
$('btn-data').addEventListener('click', async () => {
  const file = $('data-file').files[0];
  if (!file) return toast('Selecione uma planilha.', true);

  const form = new FormData();
  form.append('file', file);
  form.append('token', state.token);
  try {
    const res = await fetch('/api/data', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

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
      .map((c) => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`)
      .join('');

  const rows = state.placeholders
    .map((ph) => {
      const col = state.mapping[ph] || '';
      const warn = col ? '' : 'class="warn"';
      return `<tr>
        <td><code>{{${ph}}}</code></td>
        <td><select data-ph="${ph}">${optionsFor(col)}</select></td>
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

  // Atualiza o mapeamento quando o usuário troca uma coluna
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
  // Heurística: escolhe coluna parecida com "nome" se existir.
  const guess = state.columns.find((c) => /nome|name/i.test(c)) || state.columns[0];
  sel.innerHTML = state.columns
    .map((c) => `<option value="${c}" ${c === guess ? 'selected' : ''}>${c}</option>`)
    .join('');
}

// ---- Passo 3: Render ----
$('btn-render').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: state.token,
        mapping: state.mapping,
        labelColumn: $('label-column').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

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
  $('preview-large').innerHTML = sig.html;
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
    mini.innerHTML = sig.html;
    info.appendChild(name);
    info.appendChild(mini);

    const btn = document.createElement('button');
    btn.className = 'copy';
    btn.textContent = 'Copiar';
    btn.addEventListener('click', () => copyHtml(sig.html, sig.label));

    card.appendChild(info);
    card.appendChild(btn);
    list.appendChild(card);
  });
}

$('btn-copy-individual').addEventListener('click', () => {
  const index = Number($('individual-select').value);
  const sig = state.signatures.find((s) => s.index === index);
  if (sig) copyHtml(sig.html, sig.label);
});

// Copia como HTML rico (text/html) + texto puro, pronto p/ colar no Outlook.
async function copyHtml(html, label) {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([htmlToText(html)], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
    } else {
      await legacyCopy(html);
    }
    toast(`Assinatura de "${label}" copiada.`);
  } catch (err) {
    try {
      await legacyCopy(html);
      toast(`Assinatura de "${label}" copiada.`);
    } catch (e) {
      toast('Não foi possível copiar automaticamente.', true);
    }
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

function htmlToText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || '';
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
