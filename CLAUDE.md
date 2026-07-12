# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Gerador de assinaturas de e-mail corporativo: recebe um template (MJML/HTML com
campos `{{coluna}}`) + uma planilha (Excel/CSV), preenche o template por linha e
oferece "Copiar" (HTML rico pro Outlook) e um permalink por pessoa.

## Comandos

```bash
npm start                    # servidor em http://localhost:3000
npm run dev                  # idem, com --watch
node test/formats.test.js    # testes (não há `npm test`) — rode cada um
node test/shares.test.js
node test/templates.test.js
```

Testes são scripts `node` puros com `assert` — sem framework, sem runner. Cada
arquivo `test/*.js` é executado diretamente e imprime `... OK` no sucesso.

## Arquitetura

**ESM em todo o projeto** (`"type": "module"`). Consequências ao editar:
- imports relativos **precisam da extensão** `.js` (ex.: `./src/render.js`);
- não há `__dirname` — `server.js` e `src/shares.js` reconstroem via
  `path.dirname(fileURLToPath(import.meta.url))`;
- deps CommonJS (`express`, `multer`, `xlsx`, `mjml`) entram como default import.

**Duas páginas.** `public/index.html` (gerar assinaturas) e
`public/templates.html` (gerenciar a biblioteca de templates). Templates são um
recurso persistente e reutilizável — a geração escolhe de templates já salvos.

**Fluxo de geração, com estado por token.** Templates já existem na biblioteca; a
geração é sequencial e amarrada por um `token` de sessão:
1. Escolher um template salvo (dropdown, `GET /api/templates`).
2. `POST /api/data` (envia `templateId` + planilha) → parseia, casa colunas com os
   placeholders do template (`autoMapping`), cria a sessão `{templateId, rows, columns}`.
3. `POST /api/render` (envia `token` + `mapping`) → resolve cada linha em valores
   por placeholder e cria um permalink por pessoa.

**Três armazenamentos distintos** (não confundir propósito/tempo de vida):
- `src/store.js` — sessão de geração (`{templateId, rows, columns}`), **em memória**
  com TTL de 1h. Transitório; morre no restart.
- `src/templates.js` — biblioteca de templates compilados, **em disco**
  (`data/templates/<id>.json`). `createTemplate` faz **upsert por nome normalizado**
  (enviar nome equivalente sobrescreve, mesmo id). Reutilizado entre gerações.
- `src/shares.js` — permalinks de assinatura (`/s/:id`), **em disco**
  (`data/shares/<id>.json`). Guarda só `{templateId, values, label}` (barato); o
  `/s/:id` **renderiza sob demanda** buscando o template e aplicando `fillResolved`.
  Consequência: apagar um template órfã seus links (o `/s/:id` responde 404).

Ambos os stores em disco expõem um contrato pequeno — a costura para trocar por
SQLite/Postgres depois.

**Formatos de entrada são registros extensíveis** (a razão da última refatoração):
- `TEMPLATE_FORMATS` em `src/template.js` — `extensão → (Buffer) => html`.
- `DATA_FORMATS` em `src/spreadsheet.js` — `extensão → (Buffer) => { columns, rows }`.
Handlers recebem o **Buffer bruto** (não string), então formatos binários como
`.docx`/`.pptx` cabem. Adicionar um formato = uma entrada no registro, sem tocar
em `server.js`. Extensão não registrada → erro claro (template) ou fallback xlsx
(dados).

**Placeholders.** `PLACEHOLDER_RE` (`{{coluna}}`, em `src/template.js`) é a fonte
única — reutilizada por `render.js`. O casamento coluna↔placeholder é
insensível a caixa/acentos via `normalize()` em `src/render.js`.

**Escape de HTML.** `fillResolved` (`render.js`) escapa os valores na saída, tanto
na geração quanto no `/s/:id`. No frontend, `escapeAttr` cobre nomes de coluna e de
template inseridos em atributos.

**Frontend sem build step.** `public/js/*.js` são ES modules nativos carregados
via `<script type="module">`. `clipboard.js` é puro (resolve/rejeita, não conhece
toast/DOM da página) justamente para ser reusado tanto pelo `main.js` quanto pela
página standalone `/s/:id` servida por `server.js`.
