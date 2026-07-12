// Self-check da biblioteca de templates. Rodar: node test/templates.test.js
import assert from 'node:assert';
import {
  createTemplate, getTemplate, listTemplates, renameTemplate, deleteTemplate,
} from '../src/templates.js';

// nome distintivo pra não colidir com templates reais em data/
const NAME = 'zzz-test-' + 'abc';

const a = createTemplate({ name: NAME, html: '<b>{{nome}}</b>', placeholders: ['nome'] });
assert.ok(a.id, 'cria com id');
assert.strictEqual(getTemplate(a.id).html, '<b>{{nome}}</b>', 'get devolve html');

// upsert por nome normalizado: nome equivalente sobrescreve, mesmo id
const b = createTemplate({ name: '  ZZZ Test ABC ', html: '<i>{{x}}</i>', placeholders: ['x'] });
assert.strictEqual(b.id, a.id, 'upsert mantém o mesmo id');
assert.strictEqual(getTemplate(a.id).html, '<i>{{x}}</i>', 'upsert sobrescreveu o html');

// list contém e é leve (sem html)
const listed = listTemplates().find((t) => t.id === a.id);
assert.ok(listed && !('html' in listed), 'list é leve, sem html');

// rename
renameTemplate(a.id, NAME + '-renomeado');
assert.strictEqual(getTemplate(a.id).name, NAME + '-renomeado', 'rename aplicado');

// delete
assert.strictEqual(deleteTemplate(a.id), true, 'delete ok');
assert.strictEqual(getTemplate(a.id), null, 'get após delete -> null');
assert.strictEqual(getTemplate('../../etc/passwd'), null, 'path traversal -> null');

console.log('templates.test.js OK');
