// Self-check do suporte a templates .docx. Rodar: node test/docx.test.js
import assert from 'node:assert';
import JSZip from 'jszip';
import { normalizeDocx, extractDocxPlaceholders, fillDocx } from '../src/docx.js';

// docx mínimo: {{nome}} inteiro e {{cargo}} quebrado em runs (como o Word faz).
const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>Olá {{nome}}</w:t></w:r></w:p>
<w:p><w:r><w:t>{{</w:t></w:r><w:proofErr w:type="spellStart"/><w:r><w:t>cargo</w:t></w:r><w:proofErr w:type="spellEnd"/><w:r><w:t>}}</w:t></w:r></w:p>
</w:body>
</w:document>`;

const zip = new JSZip();
zip.file('word/document.xml', documentXml);
zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
const raw = await zip.generateAsync({ type: 'nodebuffer' });

// normalizeDocx junta o placeholder quebrado em runs
const normalized = await normalizeDocx(raw);
const normXml = await (await JSZip.loadAsync(normalized)).file('word/document.xml').async('string');
assert.ok(normXml.includes('{{cargo}}'), 'placeholder quebrado deve ser juntado');
assert.ok(normXml.includes('{{nome}}'), 'placeholder inteiro segue intacto');

// extractDocxPlaceholders acha os dois (via mammoth)
const placeholders = await extractDocxPlaceholders(normalized);
assert.deepStrictEqual([...placeholders].sort(), ['cargo', 'nome']);

// fillDocx substitui e escapa XML
const filled = await fillDocx(normalized, { nome: 'Ana & Cia <Dev>', cargo: 'Design' });
const filledXml = await (await JSZip.loadAsync(filled)).file('word/document.xml').async('string');
assert.ok(filledXml.includes('Ana &amp; Cia &lt;Dev&gt;'), 'valor deve ser XML-escaped');
assert.ok(filledXml.includes('Design'));
assert.ok(!/\{\{/.test(filledXml), 'nenhum placeholder deve sobrar');

console.log('docx.test.js OK');
