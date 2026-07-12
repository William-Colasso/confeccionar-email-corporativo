# confeccionar-email-corporativo

Gerador de assinaturas de e-mail corporativo. Você fornece **um template**
(MJML ou HTML gerado pelo MJML) com campos `{{coluna}}` e **uma planilha**
(Excel/CSV) com os dados dos colaboradores. O app preenche o template para cada
linha e oferece um botão **Copiar** que coloca a assinatura formatada na área de
transferência, pronta para colar no Outlook.

## Como rodar

```bash
npm install
npm start
```

Abra <http://localhost:3000>.

## Fluxo de uso

O app tem duas páginas: **Templates** (biblioteca reutilizável) e **Gerar
assinaturas**.

0. **Templates** (página `templates.html`) — envie um `.mjml` ou `.html` com campos
   handlebars (`{{nome}}`, `{{cargo}}`, etc.), dê um nome (default: nome do arquivo)
   e salve. Templates ficam salvos, podem ser renomeados/excluídos e são
   reutilizados nas gerações. Enviar com nome equivalente **sobrescreve** o existente
   (o app avisa antes).
1. **Template** — na página de geração, escolha um template salvo no dropdown.
   O app lista os campos dele.
2. **Planilha** — envie `.xlsx` ou `.csv`. Os cabeçalhos das colunas são casados
   automaticamente com os campos do template (sem diferenciar maiúsculas/acentos).
   Campos sem correspondência ficam destacados e podem ser remapeados manualmente.
   Escolha qual coluna serve de **nome** do colaborador.
3. **Assinaturas** — clique em *Gerar assinaturas*. Você vê:
   - uma **lista** com todos os colaboradores, cada um com botão *Copiar* e um
     **permalink** individual (`/s/:id`) para enviar a assinatura de uma pessoa;
   - uma **visualização individual** com preview ampliado e botão *Copiar*.

## Arquivos de exemplo

Em `fixtures/` há `exemplo.mjml` e `exemplo.csv` para testar o fluxo completo.

## Estrutura

```
server.js            Servidor Express + API (templates CRUD, /api/data, /api/render, /s/:id)
src/template.js      Registro de formatos de template (mjml/html → HTML) + placeholders {{...}}
src/spreadsheet.js   Registro de formatos de dados (xlsx/xls/csv → colunas+linhas)
src/render.js        Casa colunas com campos, resolve valores e preenche (escape de HTML)
src/templates.js     Biblioteca durável de templates em disco (upsert por nome)
src/shares.js        Permalinks de assinatura em disco ({templateId, values, label})
src/store.js         Sessão de geração em memória (token), com expiração
public/              Interface: index.html (gerar) + templates.html (biblioteca)
```

A sessão de geração fica em memória e expira após 1 hora. Templates e permalinks
de assinatura são gravados em disco (`data/`, gitignored) e sobrevivem a reinícios.
O permalink guarda só `{templateId, values}` e renderiza sob demanda — barato e
sempre coerente com o template atual (apagar o template órfã seus links).

### Adicionar um formato de entrada

Cada formato é uma entrada num registro `extensão → handler`, sem tocar em
`server.js`:

- **Template** (`src/template.js`, `TEMPLATE_FORMATS`): handler recebe o Buffer
  bruto e devolve HTML. Ex.: Word via
  `docx: (buf) => mammoth.convertToHtml({ buffer: buf })` (formato assíncrono
  exige tornar `compileTemplate` async).
- **Dados** (`src/spreadsheet.js`, `DATA_FORMATS`): handler recebe o Buffer e
  devolve `{ columns, rows }`. Ex.: `json: (buf) => ...`.

## Observação sobre imagens no Outlook

Imagens com `src` apontando para uma **URL pública** (ex.: logo hospedado) são
preservadas ao colar no Outlook. Imagens embutidas em **base64** podem ser
removidas pelo Outlook ao colar — prefira hospedar as imagens e referenciá-las
por URL no template.
