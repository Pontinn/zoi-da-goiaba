# Zói da Goiaba

Compartilhamento de tela P2P entre amigos, para Windows 10/11. Sem servidor de
midia e sem servidor de estado: o video vai direto de um participante para o
outro (mesh WebRTC) e a sala existe apenas enquanto alguem estiver nela.

- **Nome tecnico**: `ZoiDaGoiaba` (executavel `ZoiDaGoiaba.exe`)
- **Instalador**: `ZoiDaGoiaba-Setup.exe`
- **Plataforma**: Windows 10 e 11 (x64)

---

## Requisitos de desenvolvimento

- Node.js 22.12 ou superior
- Windows (o app usa captura de tela e loopback de audio do Windows)

## Instalacao das dependencias

```bash
npm install
```

Se o download do binario do Electron travar (proxy ou antivirus), aponte um
espelho antes de instalar:

```bash
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
```

O npm 11 pede aprovacao para scripts de instalacao. As aprovacoes necessarias
(`electron`, `esbuild`, `electron-winstaller`) ja estao registradas em
`package.json` no campo `allowScripts`.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Sobe o app em modo desenvolvimento (HMR no renderer) |
| `npm run build` | Compila main, preload e renderer em `out/` |
| `npm run typecheck` | TypeScript estrito nos dois alvos (node e web) |
| `npm run lint` | ESLint em todo o projeto |
| `npm run format` | Prettier |
| `npm test` | Suite unitaria (Vitest) dos modulos puros: protocolo, estado de sala, codecs, geometria do video, cores por pessoa e hub de ponteiros |
| `npm run test:e2e` | Compila e roda os specs Playwright (`_electron`) sobre o app real |
| `npm run icon` | Regenera `build/icon.ico` a partir de `logo/icone.png` |
| `npm run audio:probe` | Sonda de captura de audio do Windows (loopback por processo e motor de exclusao) |
| `npm run pointer:probe` | Sonda dos ponteiros: confirma que `setContentProtection` tira a janela de overlay da captura do proprio app e que uma fonte do `desktopCapturer` casa com um monitor fisico |
| `npm run dist` | Gera o instalador em `release/` (sem publicar nada) |

As duas sondas abrem o Electron de verdade e imprimem JSON: elas existem porque
premissa de API so vira fato quando executada. Nenhuma das duas emite som
audivel, e a `pointer:probe` abre por alguns segundos uma janela transparente com
um retangulo magenta (e o unico efeito visivel dela).

Hoje a suite unitaria tem 419 testes em 23 arquivos e a suite e2e tem 13 specs.

### Rodar varias instancias na mesma maquina

O app tem trava de instancia unica por perfil. Para abrir duas ou tres copias em
paralelo (util para testar uma sala), use um `userData` diferente em cada uma:

```bash
set ZOI_USER_DATA_DIR=C:\temp\zoi-a
npm run dev
```

---

## Gerar o instalador

```bash
npm run dist
```

O comando roda `electron-vite build && electron-builder --win --publish never`.
O `--publish never` e obrigatorio e garante que o build NAO interage com o
GitHub. Ao final, `release/` contem:

- `ZoiDaGoiaba-Setup.exe` - o instalador NSIS (wizard, escolha de pasta, atalhos
  na area de trabalho e no menu iniciar, instalacao por usuario e sem UAC)
- `latest.yml` - o manifesto que o auto-update le
- `ZoiDaGoiaba-Setup.exe.blockmap` - usado para download diferencial

## Publicar uma versao (passo MANUAL do usuario)

O projeto nunca publica nada sozinho: nao ha workflow de CI, nao ha push e nao
ha `--publish` no build. Para ativar o auto-update, publique a release a mao:

1. Suba a versao em `package.json` (ex.: `0.1.0` para `0.2.0`) e rode
   `npm run dist`.
2. No GitHub, em `Pontinn/zoi-da-goiaba`, crie uma **Release** nova com a tag
   `v<versao>` (ex.: `v0.2.0`), exatamente igual a versao do `package.json`.
3. Anexe a release **os dois arquivos**: `ZoiDaGoiaba-Setup.exe` e `latest.yml`.
   Sem o `latest.yml` o app instalado nao consegue detectar a atualizacao.
4. Publique a release (nao deixe como rascunho).

A partir dai, cada app instalado checa a atualizacao ao abrir e no botao
"verificar atualizacoes" das configuracoes. O download so comeca depois do
aceite do usuario, e a instalacao acontece ao reiniciar o app.

Enquanto nao existir nenhuma release publicada, a checagem termina em silencio
(estado `none` ou `error` apenas no log), sem qualquer aviso na interface.

## Aviso do SmartScreen

O instalador nao tem assinatura de codigo (code signing). Na primeira execucao,
o Windows SmartScreen pode exibir "O Windows protegeu o computador". Basta
clicar em **Mais informacoes** e depois em **Executar assim mesmo**. Isso e
esperado para um app privado distribuido entre amigos.

---

## Estrutura do projeto

```
src/
  main/       processo principal (janela, settings, captura, updater e a janela
              de overlay dos ponteiros em `pointer-overlay.ts`)
  preload/    ponte tipada `window.zoi` (contextIsolation + sandbox)
  renderer/
    index.html    entry da janela principal
    overlay.html  entry da SEGUNDA janela: o overlay de ponteiros do transmissor
    src/
      core/       nucleo PURO: protocolo, estado de sala, admissao, eleicao
      services/   transporte: PeerJS, mesh, reconexao, midia, codec, sons e
                  `cursor-hub.ts` (entrada e saida das posicoes de cursor)
      overlay/    app React da janela de overlay, separado do app principal
      ui/         telas e componentes
  shared/     contratos usados pelos tres processos (IPC, protocolo, presets,
              `codecs.ts`, `geometry.ts` e `person-colors.ts`)
native/       addon nativo da captura de audio do Windows (zoi-audio-capture)
scripts/      utilitarios fora do bundle: icone, e2e assistido e as duas sondas
tests/unit/   suite Vitest dos modulos puros
tests/e2e/    specs Playwright (`_electron`) sobre o build de `out/`
audios/       fonte canonica dos 7 sons (copiados para o bundle do renderer)
logo/         arte de origem do icone
build/        icone gerado (icon.ico / icon.png)
```

O `electron.vite.config.ts` declara os dois entries de renderer (`index` e
`overlay`). Quem acrescentar uma terceira janela precisa passar por ali.

## Notas de arquitetura

- Sinalizacao pelo servidor publico do PeerJS; STUN publico do Google. Sem TURN:
  quando a conexao direta falha (NAT simetrico), o app avisa quem nao conectou.
- O estado da sala (participantes, dono, banidos) vive nos clientes e morre com
  a sala. O cliente do dono e a autoridade de roster e moderacao.
- Toda a decisao de sala fica em `renderer/src/core`, sem dependencia de
  PeerJS, DOM ou Electron, e e coberta por testes unitarios.
- Codec de video: escada AV1 > VP9 > H264 > VP8 em `shared/codecs.ts`. A escolha
  e por MAQUINA (so entra na escada o codec com encoder de hardware de verdade) e
  pela SALA (o transmissor usa o melhor codec que TODOS os presentes anunciam
  decodificar). VP8 e o piso universal: em qualquer duvida (anuncio ausente,
  cliente de versao antiga, nome desconhecido) a resposta e VP8. O "Modo
  compatibilidade" das configuracoes e o escape manual e vale nos dois sentidos,
  transmitir e receber.
- Ponteiros dos espectadores: a posicao viaja como DADO pelo canal que ja existe,
  nunca como pixel dentro do video, e cada cliente desenha os ponteiros dos
  OUTROS. No lado de quem transmite, o desenho vai para uma `BrowserWindow`
  transparente, sempre no topo, click-through e com `setContentProtection(true)`,
  que e o que a tira da captura do proprio app (`main/pointer-overlay.ts`).
- As posicoes sao normalizadas como fracao do conteudo (`shared/geometry.ts`,
  que desconta as faixas pretas do `object-fit: contain`) e NAO passam pelo
  reducer de sala: `services/cursor-hub.ts` e o ponto unico de entrada e saida,
  com dois timers fixos e nenhum `requestAnimationFrame`.
- Cor por pessoa (`shared/person-colors.ts`): paleta fixa de 10 slots escolhida
  por hash do `peerId`, com colisao entre presentes resolvida pelo roster. A cor
  nunca viaja pela rede, cada cliente deriva a mesma sozinho, e ela aparece tanto
  no ponteiro quanto no avatar da lista de participantes.

## Diagnostico de audio nos logs (feature audio-quality)

O caminho de audio ganhou instrumentacao propria no log de arquivo (a mesma
pasta citada no botao de logs das configuracoes, `userData/logs`). Cinco
prefixos novos, cada um com uma origem fixa:

| Prefixo | Arquivo | O que significa |
|---|---|---|
| `[audio]` | `services/media-manager.ts` | Uma linha por transmissao ligando o `txId` ao estado de captura: `captura=process-exclusion sessao=...` (estado A), `captura=full-loopback motivo=...` (estado C, inclui degradacao em runtime) ou `captura=none` |
| `[audio-exclusion]` | `main/audio-exclusion.ts` | Ciclo de vida da sessao de captura por exclusao: sessao iniciada, degradando (com o motivo), indisponivel, ou falha do worker nativo |
| `[audio-native]` | `main/audio-exclusion.ts` | Relatorios do motor nativo (C++): composicao `active` (processos efetivamente capturados), `skipped` (processos vistos e recusados, com o motivo: arvore proibida, subarvore proibida, falha de ativacao), `health` (underrun/fila cheia do lado nativo) e `app-skipped` (recusa avisavel ao transmissor) |
| `[audio-drop]` | `services/audio-exclusion.ts` (renderer) | Backpressure no `WritableStream` do renderer: quadro PCM descartado porque o consumidor nao drenou a tempo |
| `[audio-stats]` | `services/stats-monitor.ts` | Delta dos campos de audio do `inbound-rtp` do WebRTC (concealment, amostras descartadas/perdidas, jitter), separados por `kind` dos campos de video no mesmo coletor |

Todo ponto que pode logar por frame ou em alta frequencia (`[audio-native]
active/skipped`, o descarte de `[audio-drop]`) passa por um contador com
janela (`shared/log-throttle.ts`, modulo puro sem Electron): conta sempre,
escreve no maximo uma linha a cada `AUDIO_LOG_WINDOW_MS` (10 s, `shared/config.ts`),
e essa linha carrega o total acumulado desde a anterior, nunca uma amostra que
perderia a magnitude do problema (mil descartes em 10 s viram uma linha so,
com o total 1000).

Isso existe por causa do teto do proprio log de arquivo (`main/file-logger.ts`,
`MAX_FILE_BYTES`, 5 MB por dia): ao estourar, o app inteiro para de gravar log
pelo resto do dia, nao so a parte de audio, entao nenhum ponto novo de
instrumentacao pode gerar volume sem controle.
