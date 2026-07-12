'use strict';

// Alterna data-theme no <html> e persiste a escolha. O valor inicial já foi
// aplicado por um script inline no <head> (evita flash do tema errado).

const root = document.documentElement;
const btn = document.getElementById('theme-toggle');

btn.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});
