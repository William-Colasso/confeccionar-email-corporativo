'use strict';

// Wrappers dos endpoints. Cada um lança Error(data.error) em falha; o caller
// mostra o toast.

async function req(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro na requisição.');
  return data;
}

// ---- Templates ----
export function listTemplates() {
  return req('/api/templates');
}

export function uploadTemplate(file, name) {
  const form = new FormData();
  form.append('file', file);
  form.append('name', name);
  return req('/api/templates', { method: 'POST', body: form });
}

export function renameTemplate(id, name) {
  return req(`/api/templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function deleteTemplate(id) {
  return req(`/api/templates/${id}`, { method: 'DELETE' });
}

// ---- Geração ----
export function uploadData(file, templateId) {
  const form = new FormData();
  form.append('file', file);
  form.append('templateId', templateId);
  return req('/api/data', { method: 'POST', body: form });
}

export function render(token, mapping, labelColumn) {
  return req('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, mapping, labelColumn }),
  });
}
