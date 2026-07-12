// Biblioteca durável de templates (compilados). Diferente da sessão de edição
// (store.js, em memória), templates são reutilizados entre gerações e ficam em
// disco: data/templates/<id>.json (gitignored).
//
// ponytail: file-store + scan O(n) por nome; troque por SQLite/índice se a
// biblioteca crescer muito.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from './render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'data', 'templates');

const fileFor = (id) => path.join(DIR, id + '.json');
const isId = (id) => /^[A-Za-z0-9_-]+$/.test(String(id));

function readAll() {
  try {
    return fs.readdirSync(DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
  } catch {
    return [];
  }
}

// Upsert por nome normalizado: enviar um template com nome equivalente
// sobrescreve o existente (mantém o mesmo id).
function createTemplate({ name, html, placeholders }) {
  fs.mkdirSync(DIR, { recursive: true });
  const existing = readAll().find((t) => normalize(t.name) === normalize(name));
  const id = existing ? existing.id : crypto.randomBytes(9).toString('base64url');
  const record = { id, name, html, placeholders, updatedAt: Date.now() };
  fs.writeFileSync(fileFor(id), JSON.stringify(record), 'utf8');
  return { id, name, placeholders };
}

function getTemplate(id) {
  if (!isId(id)) return null;
  try {
    return JSON.parse(fs.readFileSync(fileFor(id), 'utf8'));
  } catch {
    return null;
  }
}

// Lista leve (sem o html) para o dropdown e a página de templates.
function listTemplates() {
  return readAll()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map((t) => ({ id: t.id, name: t.name, placeholders: t.placeholders }));
}

function renameTemplate(id, name) {
  const t = getTemplate(id);
  if (!t) return null;
  t.name = name;
  t.updatedAt = Date.now();
  fs.writeFileSync(fileFor(id), JSON.stringify(t), 'utf8');
  return { id, name };
}

function deleteTemplate(id) {
  if (!isId(id)) return false;
  try {
    fs.unlinkSync(fileFor(id));
    return true;
  } catch {
    return false;
  }
}

export { createTemplate, getTemplate, listTemplates, renameTemplate, deleteTemplate };
