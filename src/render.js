// Casa colunas da planilha com os placeholders do template e preenche o HTML.

import { PLACEHOLDER_RE } from './template.js';

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

// Resolve uma linha da planilha em valores por placeholder (placeholder -> valor
// bruto), aplicando o mapeamento. É só isto que guardamos no share — não o HTML
// renderizado. Valores ausentes viram string vazia.
function resolveValues(placeholders, row, mapping) {
  const values = {};
  for (const ph of placeholders) {
    const column = mapping[ph];
    const v = column ? row[column] : undefined;
    values[ph] = v === undefined || v === null ? '' : v;
  }
  return values;
}

// Preenche o template a partir dos valores já resolvidos (placeholder -> valor),
// escapando na saída. Usado tanto na geração quanto no permalink /s/:id.
function fillResolved(html, values) {
  return html.replace(PLACEHOLDER_RE, (full, name) => {
    const v = values[name];
    return v === undefined || v === null ? '' : escapeHtml(v);
  });
}

// Rótulo exibido na UI para uma linha (coluna escolhida como "nome", ou fallback).
function rowLabel(row, index, labelColumn) {
  return labelColumn && row[labelColumn] != null && String(row[labelColumn]).trim()
    ? String(row[labelColumn])
    : `Colaborador ${index + 1}`;
}

export { normalize, autoMapping, escapeHtml, resolveValues, fillResolved, rowLabel };
