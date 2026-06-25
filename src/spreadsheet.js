'use strict';

// Lê uma planilha (.xlsx ou .csv) a partir de um Buffer e devolve as colunas
// (cabeçalho) e as linhas como objetos { coluna: valor }.

const xlsx = require('xlsx');

function parseSpreadsheet(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { columns: [], rows: [] };
  }
  const sheet = workbook.Sheets[firstSheetName];

  // Linhas como objetos, com strings vazias para células ausentes.
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });

  // Colunas na ordem do cabeçalho (linha 1).
  const header = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0 })[0] || [];
  const columns = header.map((c) => String(c).trim()).filter((c) => c.length > 0);

  return { columns, rows };
}

module.exports = { parseSpreadsheet };
