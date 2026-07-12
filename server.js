import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';

import * as store from './src/store.js';
import { createShare, getShare } from './src/shares.js';
import {
  createTemplate, getTemplate, listTemplates, renameTemplate, deleteTemplate,
} from './src/templates.js';
import { compileTemplate, extractPlaceholders } from './src/template.js';
import { parseData } from './src/spreadsheet.js';
import { autoMapping, resolveValues, fillResolved, rowLabel } from './src/render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const baseName = (filename) => String(filename || 'template').replace(/\.[^.]+$/, '');

// ---- Biblioteca de templates ----

// Lista os templates salvos (para o dropdown e a página de templates).
app.get('/api/templates', (req, res) => {
  res.json({ templates: listTemplates() });
});

// Envia um template (.mjml/.html), compila e salva (upsert por nome).
app.post('/api/templates', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    const { html } = compileTemplate(req.file.originalname, req.file.buffer);
    const placeholders = extractPlaceholders(html);
    if (placeholders.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo {{coluna}} encontrado no template.' });
    }
    const name = (req.body.name && req.body.name.trim()) || baseName(req.file.originalname);
    const saved = createTemplate({ name, html, placeholders });
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao processar o template: ' + err.message });
  }
});

app.patch('/api/templates/:id', (req, res) => {
  const name = req.body.name && req.body.name.trim();
  if (!name) return res.status(400).json({ error: 'Nome vazio.' });
  const updated = renameTemplate(req.params.id, name);
  if (!updated) return res.status(404).json({ error: 'Template não encontrado.' });
  res.json(updated);
});

app.delete('/api/templates/:id', (req, res) => {
  if (!deleteTemplate(req.params.id)) {
    return res.status(404).json({ error: 'Template não encontrado.' });
  }
  res.json({ ok: true });
});

// ---- Geração de assinaturas ----

// Passo 1 (dados): escolhe um template salvo + planilha; casa colunas e guarda as linhas.
app.post('/api/data', upload.single('file'), (req, res) => {
  try {
    const template = getTemplate(req.body.templateId);
    if (!template) return res.status(400).json({ error: 'Template inválido ou removido.' });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const { columns, rows } = parseData(req.file.originalname, req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ error: 'A planilha está vazia.' });

    const mapping = autoMapping(template.placeholders, columns);
    const unmatched = template.placeholders.filter((ph) => !mapping[ph]);

    // Sessão transitória: só as linhas/colunas + a que template pertencem.
    const token = store.createEntry({ templateId: template.id, rows, columns });
    res.json({ token, columns, rowCount: rows.length, mapping, unmatched });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao ler a planilha: ' + err.message });
  }
});

// Passo 2 (render): aplica o mapeamento e cria um permalink por pessoa.
// O share guarda só { templateId, values, label } — barato; o /s/:id renderiza sob demanda.
app.post('/api/render', (req, res) => {
  try {
    const { token, mapping, labelColumn } = req.body;
    const entry = token && store.get(token);
    if (!entry || !entry.rows) {
      return res.status(400).json({ error: 'Sessão inválida. Refaça o passo anterior.' });
    }
    const template = getTemplate(entry.templateId);
    if (!template) return res.status(400).json({ error: 'Template removido. Recarregue a página.' });

    const finalMapping = mapping || autoMapping(template.placeholders, entry.columns);
    const signatures = entry.rows.map((row, index) => {
      const label = rowLabel(row, index, labelColumn);
      const values = resolveValues(template.placeholders, row, finalMapping);
      const shareId = createShare({ templateId: template.id, values, label });
      return { index, label, html: fillResolved(template.html, values), shareId, url: `/s/${shareId}` };
    });
    res.json({ signatures });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao renderizar: ' + err.message });
  }
});

// Permalink público de uma assinatura. Renderiza o template salvo com os valores
// guardados — não usa o token de sessão. Reusa /js/clipboard.js pro botão Copiar.
app.get('/s/:id', (req, res) => {
  const share = getShare(req.params.id);
  const template = share && getTemplate(share.templateId);
  if (!share || !template) return res.status(404).send('Assinatura não encontrada (template removido?).');

  const html = fillResolved(template.html, share.values);
  const label = String(share.label || 'Assinatura')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Assinatura — ${label}</title><link rel="stylesheet" href="/styles.css" /></head>
<body><main><section class="step">
<h2>Assinatura de ${label}</h2>
<button class="copy" id="btn-copy">Copiar assinatura</button>
<div class="preview-large" id="sig">${html}</div>
</section></main><div class="toast" id="toast" hidden></div>
<script type="module">
import { copyHtml } from '/js/clipboard.js';
const html = document.getElementById('sig').innerHTML;
document.getElementById('btn-copy').addEventListener('click', () => copyHtml(html, ${JSON.stringify(label)}));
</script></body></html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App rodando em http://localhost:${PORT}`);
});

export default app;
