'use strict';

const path = require('path');
const express = require('express');
const multer = require('multer');

const store = require('./src/store');
const { compileTemplate, extractPlaceholders } = require('./src/template');
const { parseSpreadsheet } = require('./src/spreadsheet');
const { autoMapping, renderAll } = require('./src/render');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Passo 1: recebe o template (.mjml ou .html), compila e extrai placeholders.
app.post('/api/template', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    const content = req.file.buffer.toString('utf8');
    const { html, format } = compileTemplate(req.file.originalname, content);
    const placeholders = extractPlaceholders(html);
    if (placeholders.length === 0) {
      return res.status(400).json({
        error: 'Nenhum campo {{coluna}} encontrado no template.',
      });
    }
    const token = store.createEntry({ html, placeholders });
    res.json({ token, format, placeholders });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao processar o template: ' + err.message });
  }
});

// Passo 2: recebe a planilha, casa colunas com placeholders e guarda as linhas.
app.post('/api/data', upload.single('file'), (req, res) => {
  try {
    const token = req.body.token;
    const entry = token && store.get(token);
    if (!entry) return res.status(400).json({ error: 'Sessão inválida. Recarregue o template.' });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const { columns, rows } = parseSpreadsheet(req.file.buffer);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'A planilha está vazia.' });
    }

    const mapping = autoMapping(entry.placeholders, columns);
    const unmatched = entry.placeholders.filter((ph) => !mapping[ph]);

    store.set(token, { rows, columns });
    res.json({ columns, rowCount: rows.length, mapping, unmatched });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao ler a planilha: ' + err.message });
  }
});

// Passo 3: renderiza as assinaturas aplicando o mapeamento (com overrides).
app.post('/api/render', (req, res) => {
  try {
    const { token, mapping, labelColumn } = req.body;
    const entry = token && store.get(token);
    if (!entry || !entry.rows) {
      return res.status(400).json({ error: 'Sessão inválida. Refaça os passos 1 e 2.' });
    }
    const finalMapping = mapping || autoMapping(entry.placeholders, entry.columns);
    const signatures = renderAll(entry.html, entry.rows, finalMapping, labelColumn);
    res.json({ signatures });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao renderizar: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App rodando em http://localhost:${PORT}`);
});

module.exports = app;
