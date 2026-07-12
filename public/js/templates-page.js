'use strict';

import { listTemplates, uploadTemplate, renameTemplate, deleteTemplate } from './api.js';
import { toast, escapeAttr } from './ui.js';

const $ = (id) => document.getElementById(id);
let templates = []; // lista em memória (para o aviso de sobrescrita)

// Mesma normalização do servidor (render.js): p/ o aviso de sobrescrita bater
// com o upsert por nome.
function normalize(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

const baseName = (filename) => String(filename || '').replace(/\.[^.]+$/, '');

function currentName() {
  return $('tpl-name').value.trim() || baseName($('tpl-file').files[0]?.name || '');
}

// Aviso in-memory: se já existe um template com nome equivalente, salvar sobrescreve.
function refreshOverwriteWarning() {
  const name = currentName();
  const hit = name && templates.find((t) => normalize(t.name) === normalize(name));
  $('overwrite-warn').innerHTML = hit
    ? `<span class="tag warn">Já existe "${escapeAttr(hit.name)}" — salvar vai sobrescrever.</span>`
    : '';
}

$('tpl-file').addEventListener('change', () => {
  if (!$('tpl-name').value.trim()) $('tpl-name').value = baseName($('tpl-file').files[0]?.name || '');
  refreshOverwriteWarning();
});
$('tpl-name').addEventListener('input', refreshOverwriteWarning);

$('btn-upload').addEventListener('click', async () => {
  const file = $('tpl-file').files[0];
  if (!file) return toast('Selecione um arquivo.', true);
  const name = currentName();
  if (!name) return toast('Informe um nome.', true);
  try {
    const saved = await uploadTemplate(file, name);
    toast(`Template "${saved.name}" salvo.`);
    $('tpl-file').value = '';
    $('tpl-name').value = '';
    $('overwrite-warn').innerHTML = '';
    await load();
  } catch (err) {
    toast(err.message || 'Erro ao salvar.', true);
  }
});

async function load() {
  try {
    const res = await listTemplates();
    templates = res.templates;
    render();
    refreshOverwriteWarning();
  } catch (err) {
    toast(err.message || 'Erro ao carregar.', true);
  }
}

function render() {
  const list = $('template-list');
  list.innerHTML = '';
  if (templates.length === 0) {
    list.innerHTML = '<p class="muted">Nenhum template salvo ainda.</p>';
    return;
  }
  templates.forEach((t) => list.appendChild(row(t)));
}

function row(t) {
  const el = document.createElement('div');
  el.className = 'sig-card';

  const info = document.createElement('div');
  info.className = 'sig-info';
  const name = document.createElement('div');
  name.className = 'sig-name';
  name.textContent = t.name;
  const tags = document.createElement('div');
  tags.innerHTML = t.placeholders.map((p) => `<span class="tag">{{${p}}}</span>`).join('');
  info.appendChild(name);
  info.appendChild(tags);

  const actions = document.createElement('div');
  actions.className = 'tpl-actions';
  actions.appendChild(button('Renomear', 'copy', () => startRename(el, t)));
  actions.appendChild(button('Excluir', 'copy danger', (btn) => confirmDelete(btn, t)));

  el.appendChild(info);
  el.appendChild(actions);
  return el;
}

function startRename(el, t) {
  const name = el.querySelector('.sig-name');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = t.name;
  const save = button('Salvar', 'copy', async () => {
    const v = input.value.trim();
    if (!v) return toast('Nome vazio.', true);
    try {
      await renameTemplate(t.id, v);
      toast('Renomeado.');
      await load();
    } catch (err) {
      toast(err.message || 'Erro ao renomear.', true);
    }
  });
  name.replaceWith(input);
  el.querySelector('.tpl-actions').replaceChildren(save, button('Cancelar', 'copy', () => load()));
  input.focus();
}

// Exclusão em dois cliques (sem modal): 1º arma, 2º confirma.
function confirmDelete(btn, t) {
  if (btn.dataset.armed) {
    deleteTemplate(t.id)
      .then(() => { toast(`"${t.name}" excluído.`); return load(); })
      .catch((err) => toast(err.message || 'Erro ao excluir.', true));
    return;
  }
  btn.dataset.armed = '1';
  btn.textContent = 'Confirmar exclusão';
  setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Excluir'; } }, 3000);
}

function button(text, className, onClick) {
  const b = document.createElement('button');
  b.className = className;
  b.textContent = text;
  b.addEventListener('click', () => onClick(b));
  return b;
}

load();
