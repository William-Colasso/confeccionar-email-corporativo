'use strict';

// Armazenamento em memória por token, com expiração simples (TTL).
// Cada entrada guarda o HTML compilado do template, os placeholders detectados
// e (depois do passo 2) as linhas da planilha.

const crypto = require('crypto');

const TTL_MS = 1000 * 60 * 60; // 1 hora
const store = new Map();

function createToken() {
  return crypto.randomBytes(16).toString('hex');
}

function purgeExpired() {
  const now = Date.now();
  for (const [token, entry] of store) {
    if (now - entry.updatedAt > TTL_MS) {
      store.delete(token);
    }
  }
}

function set(token, data) {
  purgeExpired();
  const existing = store.get(token) || {};
  store.set(token, { ...existing, ...data, updatedAt: Date.now() });
}

function get(token) {
  purgeExpired();
  return store.get(token);
}

function createEntry(data) {
  const token = createToken();
  set(token, data);
  return token;
}

module.exports = { createEntry, set, get };
