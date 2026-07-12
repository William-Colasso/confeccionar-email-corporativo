// Compila o template para HTML e extrai os placeholders {{coluna}}.
//
// Formatos de template ficam num registro (extensão -> handler). Cada handler
// recebe o Buffer BRUTO do arquivo e devolve HTML — assim formatos binários
// (Word .docx, PowerPoint .pptx) plugam sem tocar em server.js. Adicionar um:
//   docx: (buf) => mammoth.convertToHtml({ buffer: buf }).then(r => r.value)
// (formatos async precisam tornar compileTemplate async; hoje todos são sync.)

import mjml2html from 'mjml';

const PLACEHOLDER_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

const TEMPLATE_FORMATS = {
  mjml: (buf) => mjml2html(buf.toString('utf8'), { validationLevel: 'soft' }).html,
  html: (buf) => buf.toString('utf8'),
  htm: (buf) => buf.toString('utf8'),
};

function extFromName(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '');
  return m ? m[1].toLowerCase() : '';
}

function compileTemplate(filename, buffer) {
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
  return { html: handler(buffer), format };
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
