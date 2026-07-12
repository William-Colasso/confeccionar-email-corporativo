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
import { extractDocxPlaceholders, fillDocx } from './src/docx.js';
import { sharePage, shareDocxPage } from './src/pages.js';
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
app.post('/api/templates', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    const compiled = await compileTemplate(req.file.originalname, req.file.buffer);
    const placeholders = compiled.type === 'docx'
      ? await extractDocxPlaceholders(compiled.docx)
      : extractPlaceholders(compiled.html);
    if (placeholders.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo {{coluna}} encontrado no template.' });
    }
    const name = (req.body.name && req.body.name.trim()) || baseName(req.file.originalname);
    const saved = createTemplate({
      name, html: compiled.html, placeholders, type: compiled.type, docx: compiled.docx,
    });
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
      const base = { index, label, shareId, url: `/s/${shareId}` };
      return template.type === 'docx'
        ? { ...base, type: 'docx', fileUrl: `/s/${shareId}/file` }
        : { ...base, html: fillResolved(template.html, values) };
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

  const label = String(share.label || 'Assinatura');
  const page = template.type === 'docx'
    ? shareDocxPage({ label, id: req.params.id })
    : sharePage({ label, html: fillResolved(template.html, share.values) });
  res.type('html').send(page);
});

// Arquivo .docx preenchido on-demand (download e fonte do preview docx-preview).
app.get('/s/:id/file', async (req, res) => {
  try {
    const share = getShare(req.params.id);
    const template = share && getTemplate(share.templateId);
    if (!share || !template || template.type !== 'docx') {
      return res.status(404).send('Arquivo não encontrado.');
    }
    const buffer = await fillDocx(Buffer.from(template.docx, 'base64'), share.values);
    const safeName = String(share.label || 'assinatura').replace(/[^\w.-]+/g, '_');
    res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.docx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).send('Falha ao gerar o arquivo: ' + err.message);
  }
});

// Vendors do preview de .docx, servidos direto de node_modules (sem build step).
app.get('/vendor/jszip.min.js', (req, res) =>
  res.sendFile(path.join(__dirname, 'node_modules', 'jszip', 'dist', 'jszip.min.js')));
app.get('/vendor/docx-preview.min.js', (req, res) =>
  res.sendFile(path.join(__dirname, 'node_modules', 'docx-preview', 'dist', 'docx-preview.min.js')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App rodando em http://localhost:${PORT}`);
});

export default app;
