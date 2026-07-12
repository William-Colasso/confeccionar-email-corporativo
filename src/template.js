// Compila o template para HTML e extrai os placeholders {{coluna}}.
//
// Formatos de template ficam num registro (extensão -> handler). Cada handler
// recebe o Buffer BRUTO do arquivo e devolve HTML (string) ou, para formatos
// binários, um objeto { type, docx } — assim Word .docx pluga sem tocar em
// server.js. Handlers podem ser async (compileTemplate faz await).

import mjml2html from 'mjml';

const PLACEHOLDER_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

const TEMPLATE_FORMATS = {
  mjml: (buf) => mjml2html(buf.toString('utf8'), { validationLevel: 'soft' }).html,
  html: (buf) => buf.toString('utf8'),
  htm: (buf) => buf.toString('utf8'),
  // docx nunca vira HTML: guardamos o binário normalizado; exibição é docx-preview.
  docx: async (buf) => {
    const { normalizeDocx } = await import('./docx.js');
    return { type: 'docx', docx: await normalizeDocx(buf) };
  },
};

function extFromName(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '');
  return m ? m[1].toLowerCase() : '';
}

async function compileTemplate(filename, buffer) {
  let format = extFromName(filename);
  // Sem extensão: detecta MJML vs HTML pelo conteúdo (texto).
  if (!format) format = /<mjml[\s>]/i.test(buffer.toString('utf8')) ? 'mjml' : 'html';

  const handler = TEMPLATE_FORMATS[format];
  if (!handler) {
    throw new Error(
      `Formato de template não suportado: .${format}. ` +
      `Suportados: ${Object.keys(TEMPLATE_FORMATS).join(', ')}.`
    );
  }
  const out = await handler(buffer);
  return typeof out === 'string' ? { html: out, format } : { ...out, format };
}

// Retorna os nomes únicos dos placeholders, preservando a ordem de aparição.
function extractPlaceholders(html) {
  const seen = new Set();
  let match;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((match = PLACEHOLDER_RE.exec(html)) !== null) {
    seen.add(match[1]);
  }
  return [...seen];
}

export { compileTemplate, extractPlaceholders, TEMPLATE_FORMATS, PLACEHOLDER_RE };
