'use strict';

const { PLACEHOLDER_RE } = require('./template');

// Normaliza um nome para casar coluna x placeholder:
// minúsculas, sem acentos, só alfanuméricos.
function normalize(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Monta o mapeamento automático placeholder -> coluna (ou null se não casar).
function autoMapping(placeholders, columns) {
  const byNorm = new Map();
  for (const col of columns) {
    byNorm.set(normalize(col), col);
  }
  const mapping = {};
  for (const ph of placeholders) {
    mapping[ph] = byNorm.get(normalize(ph)) || null;
  }
  return mapping;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Preenche o template HTML para uma linha, usando o mapeamento
// placeholder -> coluna. Valores ausentes viram string vazia.
function fillTemplate(html, row, mapping) {
  return html.replace(PLACEHOLDER_RE, (full, name) => {
    const column = mapping[name];
    if (!column) return '';
    const value = row[column];
    if (value === undefined || value === null) return '';
    return escapeHtml(value);
  });
}

// Renderiza todas as assinaturas. labelColumn define o rótulo exibido na UI.
function renderAll(html, rows, mapping, labelColumn) {
  return rows.map((row, index) => {
    const label = labelColumn && row[labelColumn] != null && String(row[labelColumn]).trim()
      ? String(row[labelColumn])
      : `Colaborador ${index + 1}`;
    return { index, label, html: fillTemplate(html, row, mapping) };
  });
}

module.exports = { normalize, autoMapping, fillTemplate, renderAll, escapeHtml };
