'use strict';

// Armazenamento durável dos links de assinatura (permalink por pessoa).
// Diferente de store.js (sessão de edição, em memória com TTL), estes artefatos
// precisam sobreviver a restart do servidor — um link enviado é aberto depois.
//
// ponytail: file-store single-process; troque a impl por SQLite/Postgres atrás
// de createShare/getShare quando houver concorrência ou multi-instância.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'data', 'shares');

function fileFor(id) {
  return path.join(DIR, id + '.json');
}

// Cria um link e devolve seu id. `data` = { templateId, values, label } — dados
// mínimos; o /s/:id renderiza o template salvo com esses valores sob demanda.
function createShare(data) {
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomBytes(9).toString('base64url'); // 12 chars URL-safe
  fs.writeFileSync(fileFor(id), JSON.stringify(data), 'utf8');
  return id;
}

// Devolve o objeto guardado ou null se o id não existe.
function getShare(id) {
  // Barra path traversal: só aceita o alfabeto do base64url que geramos.
  if (!/^[A-Za-z0-9_-]+$/.test(String(id))) return null;
  try {
    return JSON.parse(fs.readFileSync(fileFor(id), 'utf8'));
  } catch {
    return null;
  }
}

export { createShare, getShare };
