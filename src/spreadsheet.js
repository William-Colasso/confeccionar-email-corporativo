// Lê os dados dos colaboradores e devolve { columns, rows } (rows = objetos
// { coluna: valor }).
//
// Formatos de entrada ficam num registro (extensão -> parser). Cada parser
// recebe o Buffer e devolve { columns, rows }. Adicionar JSON, por exemplo:
//   json: (buf) => { const arr = JSON.parse(buf.toString('utf8'));
//                    return { columns: Object.keys(arr[0] || {}), rows: arr }; }

import xlsx from 'xlsx';

// SheetJS lê .xlsx, .xls e .csv a partir do mesmo Buffer.
function parseXlsx(buffer) {
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

const DATA_FORMATS = {
  xlsx: parseXlsx,
  xls: parseXlsx,
  csv: parseXlsx,
};

function parseData(filename, buffer) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '');
  const format = m ? m[1].toLowerCase() : '';
  // ponytail: extensão desconhecida cai no xlsx, que sabe farejar o conteúdo
  // binário; troque por throw se quiser rejeitar formatos não registrados.
  const parser = DATA_FORMATS[format] || parseXlsx;
  return parser(buffer);
}

export { parseData, DATA_FORMATS };
