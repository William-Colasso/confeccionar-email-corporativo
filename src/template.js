'use strict';

// Compila o template (MJML -> HTML, ou usa HTML direto) e extrai os
// placeholders no formato {{coluna}}.

const mjml2html = require('mjml');

const PLACEHOLDER_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

// Detecta se o conteúdo é MJML. Usa a extensão como pista principal e,
// na ausência dela, procura a tag <mjml>.
function isMjml(filename, content) {
  if (filename && /\.mjml$/i.test(filename)) return true;
  if (filename && /\.html?$/i.test(filename)) return false;
  return /<mjml[\s>]/i.test(content);
}

function compileTemplate(filename, content) {
  if (isMjml(filename, content)) {
    const result = mjml2html(content, { validationLevel: 'soft' });
    return { html: result.html, format: 'mjml' };
  }
  return { html: content, format: 'html' };
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

module.exports = { compileTemplate, extractPlaceholders, PLACEHOLDER_RE };
