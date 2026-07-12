'use strict';

// Self-check do shares.js: round-trip e ids inválidos. Rodar: node test/shares.test.js
import assert from 'node:assert';
import { createShare, getShare } from '../src/shares.js';

const data = { templateId: 't123', values: { nome: 'Ana', cargo: 'Dev' }, label: 'Ana' };
const id = createShare(data);
assert.deepStrictEqual(getShare(id), data, 'round-trip');
assert.strictEqual(getShare('nao-existe-mesmo'), null, 'id inexistente -> null');
assert.strictEqual(getShare('../../etc/passwd'), null, 'path traversal -> null');

console.log('shares.test.js OK');
