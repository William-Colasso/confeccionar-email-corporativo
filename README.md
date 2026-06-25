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

1. **Template** — envie um arquivo `.mjml` (compilado automaticamente) ou `.html`.
   Use campos no formato handlebars: `{{nome}}`, `{{cargo}}`, `{{email}}`, etc.
   O app detecta e lista os campos encontrados.
2. **Planilha** — envie `.xlsx` ou `.csv`. Os cabeçalhos das colunas são casados
   automaticamente com os campos do template (sem diferenciar maiúsculas/acentos).
   Campos sem correspondência ficam destacados e podem ser remapeados manualmente.
   Escolha qual coluna serve de **nome** do colaborador.
3. **Assinaturas** — clique em *Gerar assinaturas*. Você vê:
   - uma **lista** com todos os colaboradores, cada um com um botão *Copiar*;
   - uma **visualização individual** com preview ampliado e botão *Copiar*.

## Arquivos de exemplo

Em `fixtures/` há `exemplo.mjml` e `exemplo.csv` para testar o fluxo completo.

## Estrutura

```
server.js            Servidor Express + API (/api/template, /api/data, /api/render)
src/template.js      Compila MJML→HTML e extrai os placeholders {{...}}
src/spreadsheet.js   Lê .xlsx/.csv (SheetJS)
src/render.js        Casa colunas com campos e preenche o template (com escape de HTML)
src/store.js         Estado em memória por sessão (token), com expiração
public/              Interface (HTML/CSS/JS puro)
```

Não há banco de dados: o template e os dados ficam em memória por sessão e
expiram após 1 hora de inatividade.

## Observação sobre imagens no Outlook

Imagens com `src` apontando para uma **URL pública** (ex.: logo hospedado) são
preservadas ao colar no Outlook. Imagens embutidas em **base64** podem ser
removidas pelo Outlook ao colar — prefira hospedar as imagens e referenciá-las
por URL no template.
