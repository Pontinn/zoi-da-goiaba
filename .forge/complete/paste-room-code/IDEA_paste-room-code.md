---
feature: paste-room-code
language: pt-BR
type: change
mode: quick
status: done
created: 2026-11-09
---
# IDEA - paste-room-code (quick)

## 1. Objetivo
Na tela "Entrar com codigo", um botao que cola o codigo copiado da area de transferencia no campo,
sem precisar de Ctrl+V. Nas palavras do Pontin: "adicione um botao de colar o codigo copiado sem
precisar dar ctrl+v para entrar na sala".

## 2. Plano inline
1. `src/renderer/src/ui/clipboard.ts`: acrescentar `readText(): Promise<string | null>` espelhando
   `copyText` (try/catch em volta de `navigator.clipboard.readText()`, null em falha).
2. `src/renderer/src/ui/components/icons.tsx`: novo `PasteIcon` no mesmo estilo/tamanho do `CopyIcon`.
3. `src/renderer/src/ui/screens/JoinRoomScreen.tsx`: `IconButton` "Colar codigo" ao lado do campo,
   seguindo o padrao do botao de copiar da tela Criar sala (`z-code-row__buttons`, icone 18) ou a
   prop `trailing` do `TextInput`, o que ficar mais fiel a identidade da tela. Ao clicar: le a area
   de transferencia, aplica a MESMA normalizacao do onChange (`normalize` + remover espacos),
   preenche o campo, limpa o erro e devolve o foco ao campo. NAO entra na sala sozinho: o Pontin
   confirma com Enter ou no botao Entrar (decisao do orquestrador, UX previsivel; se ele quiser
   "colar e entrar", vira ajuste).
4. Caminhos tristes: area de transferencia vazia ou leitura negada -> toast de aviso
   ("Nao consegui ler a area de transferencia; use Ctrl+V."), campo intacto; conteudo que nao e
   um codigo valido -> preenche mesmo assim e mostra a mensagem de validacao existente
   (`ROOM_CODE_MESSAGES`), para a pessoa ver o que veio.
5. Se `navigator.clipboard.readText` for bloqueado no renderer do Electron, cair para leitura via
   IPC (modulo `clipboard` do main), seguindo o padrao de `src/shared/ipc.ts` e do preload. Verificar
   em runtime real, nao assumir.
6. Testes proporcionais: unit do `readText` (mock de navigator.clipboard); smoke de render no Electron
   real (Playwright _electron, janela oculta, mudo): preencher a area de transferencia, clicar no
   botao e ver o campo preenchido e normalizado; conferir zero erro de console.
7. Um commit atomico com caminhos explicitos.

## 3. Fora de escopo
- Entrar automaticamente apos colar; mudar validacao de codigo; outras telas; CSS global novo.

## 4. Regressao
- Fluxo atual de digitar/colar com Ctrl+V e Enter continua igual; e2e que usa `join-code-input`
  (tests/e2e/helpers/zoi-app.ts) continua passando.

## 5. Referencia de UI
Identidade da propria tela Entrar com codigo e o botao de copiar da tela Criar sala
(`CreateRoomScreen.tsx`, `IconButton` + `CopyIcon`).
