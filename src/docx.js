// Templates Word (.docx): edita os {{campos}} DENTRO do arquivo (word/document.xml
// via jszip) — nunca converte o docx para HTML; a exibição é do docx-preview no
// navegador. mammoth entra só para extrair o texto (placeholders).

import JSZip from 'jszip';
import mammoth from 'mammoth';
import { PLACEHOLDER_RE } from './template.js';
import { escapeHtml } from './render.js';

const DOC_XML = 'word/document.xml';

async function readDocXml(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file(DOC_XML);
  if (!entry) throw new Error('Arquivo .docx inválido (sem word/document.xml).');
  return { zip, xml: await entry.async('string') };
}

async function writeDocXml(zip, xml) {
  zip.file(DOC_XML, xml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

// O Word costuma quebrar {{nome}} em vários runs (<w:t>{{</w:t>...<w:t>nome}}</w:t>).
// Colapsa as tags XML que caem no meio de um placeholder até estabilizar.
// ponytail: cobre o split comum (proofErr/rsid); casos exóticos pedem docxtemplater.
function joinSplitPlaceholders(xml) {
  // Casa {{...}} permitindo tags no meio (até 200 unidades — nomes são curtos;
  // evita varrer o documento atrás de um }} distante) e remove as tags de dentro.
  return xml.replace(/\{\{(?:[^{}<]|<[^>]+>){0,200}?\}\}/g, (m) => m.replace(/<[^>]+>/g, ''));
}

// Normaliza o docx no upload: junta placeholders quebrados e regrava o zip.
async function normalizeDocx(buffer) {
  const { zip, xml } = await readDocXml(buffer);
  return writeDocXml(zip, joinSplitPlaceholders(xml));
}

// Placeholders via texto extraído pelo mammoth (docx já normalizado).
async function extractDocxPlaceholders(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  const seen = new Set();
  let m;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(value)) !== null) seen.add(m[1]);
  return [...seen];
}

// Preenche os {{campos}} no document.xml com valores XML-escaped.
async function fillDocx(buffer, values) {
  const { zip, xml } = await readDocXml(buffer);
  const filled = xml.replace(PLACEHOLDER_RE, (full, name) => {
    const v = values[name];
    return v === undefined || v === null ? '' : escapeHtml(v);
  });
  return writeDocXml(zip, filled);
}

export { normalizeDocx, extractDocxPlaceholders, fillDocx };
