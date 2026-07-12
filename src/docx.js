// Templates Word (.docx): edita os {{campos}} DENTRO do arquivo (partes XML de
// texto via jszip) — nunca converte o docx para HTML; a exibição é do
// docx-preview no navegador. mammoth entra só para extrair o texto (placeholders).

import JSZip from 'jszip';
import mammoth from 'mammoth';
import { PLACEHOLDER_RE, extractPlaceholders } from './template.js';
import { escapeHtml } from './render.js';

// Partes do docx que carregam texto visível (corpo, cabeçalhos, rodapés).
const TEXT_PARTS_RE = /^word\/(document|header\d*|footer\d*)\.xml$/;

// Aplica `transform(xml)` a cada parte de texto do docx e regrava o zip.
async function mapTextParts(buffer, transform) {
  const zip = await JSZip.loadAsync(buffer);
  const parts = Object.keys(zip.files).filter((f) => TEXT_PARTS_RE.test(f));
  if (!parts.includes('word/document.xml')) {
    throw new Error('Arquivo .docx inválido (sem word/document.xml).');
  }
  for (const part of parts) {
    zip.file(part, transform(await zip.file(part).async('string')));
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

// O Word costuma quebrar {{nome}} em vários runs (<w:t>{{</w:t>...<w:t>nome}}</w:t>).
// Casa {{...}} permitindo tags no meio (até 200 unidades — nomes são curtos;
// evita varrer o documento atrás de um }} distante) e remove as tags de dentro.
// ponytail: cobre o split comum (proofErr/rsid); casos exóticos pedem docxtemplater.
function joinSplitPlaceholders(xml) {
  return xml.replace(/\{\{(?:[^{}<]|<[^>]+>){0,200}?\}\}/g, (m) => m.replace(/<[^>]+>/g, ''));
}

// Normaliza o docx no upload: junta placeholders quebrados e regrava o zip.
function normalizeDocx(buffer) {
  return mapTextParts(buffer, joinSplitPlaceholders);
}

// Placeholders do corpo via texto do mammoth + cabeçalhos/rodapés via scan do
// XML (mammoth só extrai o corpo; docx já normalizado tem placeholders inteiros).
async function extractDocxPlaceholders(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  const zip = await JSZip.loadAsync(buffer);
  const extras = await Promise.all(
    Object.keys(zip.files)
      .filter((f) => TEXT_PARTS_RE.test(f) && f !== 'word/document.xml')
      .map((f) => zip.file(f).async('string')),
  );
  return [...new Set([value, ...extras].flatMap(extractPlaceholders))];
}

// Preenche os {{campos}} com valores XML-escaped (escapeHtml escapa & < > " ').
function fillDocx(buffer, values) {
  return mapTextParts(buffer, (xml) =>
    xml.replace(PLACEHOLDER_RE, (full, name) => {
      const v = values[name];
      return v === undefined || v === null ? '' : escapeHtml(v);
    }));
}

export { normalizeDocx, extractDocxPlaceholders, fillDocx };
