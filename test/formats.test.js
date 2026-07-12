// Self-check dos registros de formato. Rodar: node test/formats.test.js
import assert from 'node:assert';
import { compileTemplate, extractPlaceholders } from '../src/template.js';
import { parseData } from '../src/spreadsheet.js';

// --- template ---
const html = compileTemplate('assin.html', Buffer.from('<b>{{nome}}</b>'));
assert.strictEqual(html.format, 'html');
assert.deepStrictEqual(extractPlaceholders(html.html), ['nome']);

const mjml = compileTemplate('assin.mjml', Buffer.from('<mjml><mj-body><mj-text>{{cargo}}</mj-text></mj-body></mjml>'));
assert.strictEqual(mjml.format, 'mjml');
assert.ok(mjml.html.includes('<'), 'mjml compila para html');

// sem extensão: detecta pelo conteúdo
const mjmlSniff = compileTemplate('', Buffer.from('<mjml><mj-body><mj-text>{{x}}</mj-text></mj-body></mjml>'));
assert.strictEqual(mjmlSniff.format, 'mjml');
assert.strictEqual(compileTemplate('', Buffer.from('<div>oi</div>')).format, 'html');

// formato não suportado falha alto e nomeia os suportados
assert.throws(
  () => compileTemplate('assin.docx', Buffer.from('PK\x03\x04binário')),
  /não suportado.*docx.*mjml/s,
  'docx deve ser rejeitado com mensagem clara'
);

// --- dados ---
const csv = parseData('dados.csv', Buffer.from('nome,cargo\nAna,Dev\nBia,Design\n'));
assert.deepStrictEqual(csv.columns, ['nome', 'cargo']);
assert.strictEqual(csv.rows.length, 2);
assert.strictEqual(csv.rows[0].nome, 'Ana');

console.log('formats.test.js OK');
