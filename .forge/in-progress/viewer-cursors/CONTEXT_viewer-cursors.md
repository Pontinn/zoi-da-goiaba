---
feature: viewer-cursors
language: pt-BR
code_identifier_language: en - mirrors-existing-codebase
generated: 2026-08-26
stack: Electron 43 + React 18 + TypeScript 5.9 (renderer via Vite/electron-vite), PeerJS 1.5.5 (WebRTC), Zustand 5, Vitest 4 (unit), Playwright 1.62 `_electron` (e2e)
---

## 0. Baseline (ancora de deriva)

- `HEAD`: `7c9e8a1c839a648de0e9faad3cb48ba9cfe920e0`
- IDEA fingerprint (sha256 de `IDEA_viewer-cursors.md`, valor reancorado apos o passo de finalizacao de 2026-08-26 - a IDEA foi de 124 para 184 linhas, `status: done`): `1759d1ffa0e13eb0702a4b9c02cb0fa9647f421b64b6098606f83443fc061f32`
- Arquivos de codigo analisados (git blob hash):
  - `src/shared/protocol.ts` - `f3496673b7f5f4692a43084fe22fcfe1bce75820`
  - `src/shared/ipc.ts` - `f2999e26e1f8b42c532227b7f74ad2326df455ee`
  - `src/shared/config.ts` - `cdea2594a08a52a61d4ef25fb571f7bafda00b0b`
  - `src/shared/codecs.ts` - `f485295f9c2f2a2966598ec27399e1e5ffbc24cd`
  - `src/main/index.ts` - `6f427b1666d095a1a5b536ec89928e6dfc49e0f0`
  - `src/main/ipc-handlers.ts` - `81988c330f4a0d0f62a02866698c6f6db0f363ae`
  - `src/main/capture.ts` - `3ac37d4b496fa89e9b1e83b82ad565d13c420058`
  - `src/main/settings.ts` - `0260ea3aeaed1a2c3abcd98792ad7d63e1a2d893`
  - `src/main/audio-exclusion.ts` - `ba55a3ee379552f9d7b74cf7c8e7599185235ea3`
  - `src/renderer/src/services/mesh.ts` - `dd40d0989e49c7882a8245f0fce6b334f50f5ed6`
  - `src/renderer/src/services/peer-manager.ts` - `9a6ed3a80adc130fc9991f633ff0e77419cfefdc`
  - `src/renderer/src/services/reconnection.ts` - `d0760bd2ee26524a21288c31d82a3ac8f73a080a`
  - `src/renderer/src/services/stats-monitor.ts` - `455f6d59b409d80c96bd2c0b77ae504fd0371411`
  - `src/renderer/src/services/session.ts` - `b4dfa32700e4a467d9b88d1861a38c8c53b6544d`
  - `src/renderer/src/services/media-manager.ts` - `30ff417df80f937b550af1242880f97bb1b39e45`
  - `src/renderer/src/core/room-state.ts` - `ad05a768e0d4b97764177294e346aa2bd825d2df`
  - `src/renderer/src/ui/screens/PlayerView.tsx` - `4c682a75d68b436a70cd8415fbdf38f7b44ebc43`
  - `src/renderer/src/ui/components/ParticipantCard.tsx` - `554551c367bd96cb0226f2dbbc05f46debdaaa87`
  - `src/renderer/src/ui/components/SourcePickerModal.tsx` - `37d0f58372feb617d1546aabb9d6ec36f214fea8`
  - `src/renderer/src/ui/components/TransmittingBar.tsx` - `f67ce03b30ef66b02a749321a83ae4d6e0e2f752`
  - `src/renderer/src/ui/theme.css` - `2e608de9e177dbbb754ca6d6621455b82e34f383`
  - `src/renderer/src/ui/screens/room.css` - `e48b6d8e4cb85fb6dfa4104b17d93c5007e669d9`
  - `tests/e2e/helpers/zoi-app.ts` - `b0a560c4b1bb3a896d88cba7e77ecb43dcbf97a1`
  - `.forge/LESSONS.md` - `fd80d0424a094d89a9f5bc317a71d356809ac687`
  - `src/renderer/src/ui/components/Toast.tsx` - `e3bd3a2f9115c97c07a9a4dd7a7fa7e42a93d8c0`
  - `src/renderer/src/store/app-store.ts` - `0404c9ec1f5436c6c489a1516fcab3b6e2f39d44`
  - `src/renderer/src/ui/components/StreamThumbnail.tsx` - `87623465ee5c671dac3532395a7c6b6250a7aea2`
  - `src/renderer/src/ui/components/TransmissionStatusCard.tsx` - `85759021a38a3307348123201d04972522ca3327`
  - `src/renderer/src/ui/components/components.css` - `5ddabd594454f701657686a09570b6836bf8b704`

## 1. Stack e build

Electron 43.4.1 (Chromium embutido) com `electron-vite` 5 orquestrando tres bundles (`main`, `preload`, `renderer`). Renderer em React 18 + Zustand 5 (sem router; maquina de telas manual em `App.tsx`). Sinalizacao/midia via PeerJS 1.5.5 sobre o servidor publico `0.peerjs.com`, sem TURN (decisao explicita, sem fallback alem do dial bidirecional). TypeScript 5.9 com dois `tsconfig` (`node` para main/preload, `web` para renderer) e paths `@shared/*` apontando para `src/shared`. Testes: Vitest 4 (`tests/unit`, roda so codigo puro: reducer, protocolo, mesh; nunca importa Electron) e Playwright 1.62 com `_electron` (`tests/e2e`, sobe o app buildado de verdade). Empacotamento via `electron-builder` (Windows only, `dist`).

## 2. Arquivos e modulos relevantes

**Canal de dados / malha**
- `src/shared/protocol.ts`: enum `MessageType`, envelope, type guards estruturais por tipo, `validateEnvelope` (regra geral de rejeicao).
- `src/renderer/src/services/mesh.ts`: uma `DataConnection` confiavel por par (corrida de dial, fila ate abrir), roteia `data` validado para `onMessage`. Expoe DUAS primitivas de envio, ambas relevantes aqui: `send(peerId, message)` (linha 267) manda para UM par especifico, enfileirando se o canal ainda nao abriu; `broadcast(message, exceptPeerId?)` (linha 277) serializa uma vez e manda para TODOS os pares conhecidos, com exclusao opcional de um peerId. Nao existe hoje uma terceira primitiva de "enviar para um subconjunto" (ex.: so quem assiste a um `txId`); um fan-out seletivo precisaria ou chamar `send()` uma vez por peerId do subconjunto, ou a SPEC decide adicionar um metodo novo no Mesh que aceite uma lista de peerIds. O material bruto para montar esse subconjunto ja existe: `state.watching` (`Record<peerId, txId|null>` em `room-state.ts`) mapeia quem assiste o que, e `viewersOf(state, txId)` (mesmo arquivo) ja itera esse record para contar espectadores de uma transmissao - a mesma iteracao, filtrando por igualdade de `txId` e coletando `peerId` em vez de contar, da a lista de destinatarios do fan-out seletivo por `send()`. Achado favoravel a IDEA: como o unicast `send()` ja existe e escala por destinatario (nao por sala inteira), a rota "so para quem assiste aquele `txId`" pedida pela IDEA final (secao 2, decisao de 2026-08-26) e diretamente viavel sem inventar infraestrutura de mesh nova - a decisao do SPEC (T3) e so entre usar `send()` em loop ou broadcast com filtro local do lado de quem recebe.
- `src/renderer/src/services/peer-manager.ts`: camada fina sobre PeerJS: member peer (mesh) + door peer (admissao), saude da sinalizacao, reconexao.
- `src/renderer/src/services/session.ts`: orquestra reducer + servicos; `LOCAL_TX_START` dispara `broadcast` do `TX_START`.
- `src/renderer/src/services/reconnection.ts`: heartbeat PING/PONG por par (2s/6s), unico precedente de mensagem PERIODICA no mesh hoje.
- `src/renderer/src/core/room-state.ts`: reducer puro (evento -> novo estado + `Effect[]`); e aqui que um novo tipo de evento/efeito para posicoes de cursor entraria.

**Processo main / janelas**
- `src/main/index.ts`: cria a UNICA `BrowserWindow` do app (nenhuma janela secundaria existe hoje). `setContentProtection` NAO e usado em lugar nenhum do codigo atual.
- `src/main/capture.ts`: enumera fontes via `desktopCapturer.getSources`; `CaptureSource.displayId` vem de `source.display_id` mas NUNCA e cruzado com `screen.getAllDisplays()`/`display.id` em lugar nenhum: esse mapeamento fonte-escolhida -> monitor fisico nao existe hoje e precisa ser construido do zero. `CaptureSource.kind` (`src/main/capture.ts:47`, tipado em `src/shared/ipc.ts:61` como `CaptureSourceKind = 'screen' | 'window'`) e o dado ja existente que distingue uma fonte de monitor de uma fonte de janela - e o que o toggle desabilitado do P1 usaria para decidir se mostra a explicacao.
- `src/main/audio-exclusion.ts`: unico precedente de processo auxiliar (utilityProcess) + canal de alta frequencia: usa `MessageChannelMain` para entregar um `MessagePort` ao renderer (frames PCM de 10ms). E o padrao mais proximo de "dado que chega em cadencia alta cruzando o boundary do Electron", embora na direcao worker -> renderer, nao renderer -> main.
- `src/main/settings.ts`: persistencia JSON simples (escrita atomica temp+rename), cache em memoria.

**IPC**
- `src/shared/ipc.ts`: objeto `IPC` com nomes de canal `kebab:colon`, tipagem de request/response por canal, superficie `window.zoi` inteira documentada aqui. Todo IPC hoje e request/response via `ipcMain.handle`/`invoke`: NENHUM canal de alta frequencia renderer->main existe. O unico fluxo de alta cadencia do app inteiro (audio PCM) vai na direcao OPOSTA (main/worker -> renderer) via MessagePort, nao via `ipcMain.handle`.
- `src/main/ipc-handlers.ts`: registro de todos os handlers (exceto `update:*`).

**Exibicao do video no espectador e nas outras superficies**
- `src/renderer/src/ui/screens/PlayerView.tsx`: elemento `<video>` com `object-fit: contain` (letterbox), `className="z-player__video"`. NAO existe hoje nenhum calculo de area real do video dentro do elemento (descontando as bordas pretas do letterbox): isso precisa ser construido (via `videoWidth`/`videoHeight` do elemento vs. `getBoundingClientRect()`, que so e usado hoje em `HomeScreen.tsx` para outro proposito).
- `src/renderer/src/ui/components/StreamThumbnail.tsx`: renderiza um `<video>` pequeno (miniatura da grade), sempre `muted`, `srcObject` atribuido uma vez por stream. NAO captura coordenada de mouse hoje, e a IDEA final (decisao de 2026-08-26) decide explicitamente que NUNCA deve capturar: o alvo e pequeno demais para apontar com precisao.
- `src/renderer/src/ui/components/TransmissionStatusCard.tsx`: ocupa o lugar do proprio tile de quem transmite (grid ou strip); comentario do proprio arquivo (linha 1-3) e explicito - "Sem `<video>` e sem stream: o custo por frame e zero". Ou seja, esta superficie nem chega a ter um elemento de video para capturar coordenada. A IDEA final tambem decide que apontar so vale no player grande; SPEC nao precisa (nem pode, no caso deste componente) inventar captura aqui.
- `src/renderer/src/ui/screens/player.css`, `room.css`: regras `object-fit: contain` repetidas em 3 lugares (player, thumbnails da grade).

**Identidade dos participantes - ACHADO QUE CONTRARIA A IDEA ORIGINAL (ja incorporado na IDEA final)**
- `src/renderer/src/ui/components/ParticipantCard.tsx`: bolinha com a inicial (`z-participant__avatar`).
- `src/renderer/src/ui/screens/room.css` linha 226-238: `.z-participant__avatar { background: var(--accent-soft); color: var(--accent-hover); }`: NAO existe cor por pessoa. TODOS os avatares usam a MESMA cor (o roxo de acento unico do app, `--accent`/`--accent-soft`/`--accent-hover`). Nao ha funcao de derivacao de cor por `peerId`/`installId` em lugar nenhum do codigo (busquei por `hue`, `colorFor`, `peerColor`, hash-to-color: nada encontrado). A premissa da IDEA original ("cada cursor usa a cor que a pessoa ja tem na lista de participantes") descrevia algo que nao existe: essa cor por pessoa precisa ser CRIADA como parte desta feature (hash deterministico de `peerId` -> matiz), e nao meramente "reutilizada". A IDEA final (secao 2, 2026-08-26) ja incorporou este achado e decide que a cor tambem se aplica de volta na bolinha da lista de participantes, colocando `ParticipantCard.tsx`/`room.css` na superficie de regressao.
- Nome: `nicknameOf(state, peerId)` em `room-state.ts`, fallback para `peerId.slice(0, 6)`.

**Toggles de UI existentes**
- `src/renderer/src/ui/components/SourcePickerModal.tsx`: padrao do toggle de audio: `<button className="z-switch ..." role="switch" aria-checked={...} data-testid="audio-toggle">` com track+thumb+label+hint, estado local do modal (`useState`), confirmado so no clique de "Transmitir".
- `src/renderer/src/ui/components/TransmittingBar.tsx`: toggle de nitidez (`sharpness-toggle`) recem-adicionado: mesma estrutura `z-switch`, variante `z-switch--bar` (cores adaptadas ao fundo solido `--danger` da barra). E o padrao mais recente e mais proximo do que a IDEA pede para o controle "durante a transmissao".
- **Estado desabilitado do `z-switch` e INEDITO**: buscando em `src/renderer/src/ui/components/components.css`, o unico CSS de estado `:disabled` existente e para `.z-btn:disabled` (linha 32-34: `opacity: 0.45; cursor: not-allowed;`) e `.z-input:disabled` (linha 196-198: `opacity: 0.6; cursor: not-allowed;`). Nao existe NENHUMA regra `.z-switch:disabled` ou `.z-switch--disabled` em lugar nenhum do CSS do projeto. O toggle desabilitado com explicacao que o P1 exige (fonte = janela) e uma variante visual nova a ser desenhada nesta feature, nao um padrao a reaproveitar; o SPEC pode se inspirar na opacidade+cursor dos dois padroes acima, mas precisa especificar a variante `z-switch` explicitamente.

**Aviso/toast: infraestrutura existente e regra de deduplicacao**
- `src/renderer/src/ui/components/Toast.tsx`: renderiza `useAppStore((state) => state.toasts)`; cada toast tem TTL fixo (`TOAST_TTL_MS`) e se auto-remove via `setTimeout` + `dismissToast(id)`. Nao ha logica de deduplicacao por TEXTO aqui: e so a renderizacao da lista.
- `src/renderer/src/store/app-store.ts`: `pushToast(tone, text)` cria um `ToastItem` com `id` sequencial (`toastSeq`) e mantem so os ULTIMOS 5 (`toasts.slice(-5)`); isso e um limite de QUANTIDADE, nao uma deduplicacao por conteudo - dois toasts com o MESMO texto empilham normalmente se `pushToast` for chamado duas vezes.
- `src/renderer/src/services/session.ts`: e a UNICA camada que decide QUANDO chamar `pushToast` (via `emitToast`, linha 1149-1152, chamado a partir do efeito `showToast` do reducer e de alguns eventos de transporte locais como queda/recuperacao da sinalizacao). A REGRA DE DEDUPLICACAO REAL do projeto nao vive no toast em si: vive em GUARDS DE ESTADO que decidem se o efeito `showToast` e sequer gerado. Exemplos concretos ja existentes: `entry.announced` (linha ~173 de `room-state.ts`, mesh) e `state.announcedPeers` (array de `peerId` ja anunciados, usado para tocar o som/toast de "entrou na sala" so uma vez por pessoa) sao flags booleanas/arrays que gatilham o efeito uma unica vez por condicao, nunca por mensagem recebida. Ha tambem um comentario explicito no `peer-manager.ts` linha 218 sobre um flag analogo para a porta: "Ja avisamos que a porta esta fechada? Evita repetir o toast a cada ciclo". Esse e o PADRAO a seguir para o aviso "Ponteiros desativados por quem transmite" do P3: o reducer/estado do espectador precisa de um flag do tipo "ja avisei este espectador para esta transmissao/toggle" antes de emitir o efeito `showToast`, porque nem `Toast.tsx` nem `pushToast` fazem essa deduplicacao sozinhos. Sem esse guard, qualquer reenvio de estado (ex.: reconexao, ROSTER_UPDATE) que reafirme "ponteiros desligados" geraria um toast novo por espectador a cada ocorrencia.

**Preferencias persistidas**
- `src/main/settings.ts` + `src/shared/ipc.ts` (`AppSettings`, `SettingsSetRequest`): padrao: campo opcional em `SettingsSetRequest`, validado/normalizado por uma funcao `set<Campo>()` dedicada em `settings.ts`, valor ausente ou invalido no disco cai no default sem invalidar o arquivo inteiro (mesmo padrao usado para `forceVp8` em `video-codec-upgrade`, o precedente mais recente de "nova preferencia booleana persistida"). Nota: a IDEA final (P4) decide que esta feature NAO persiste preferencia nenhuma, entao este padrao serve so de referencia negativa (o que NAO sera necessario aqui).

**Performance / caminhos sensiveis**
- `src/renderer/src/services/stats-monitor.ts`: unico timer de tick curto relacionado a midia (3s, `QUALITY_UPDATE_INTERVAL_MS`), roda `getStats()` por conexao a cada tick; e o relogio que varias features reusam de proposito (RNF-07: "nenhum coletor novo").
- `src/renderer/src/services/first-frame-watch.ts` (nao lido por completo, mas referenciado por `PlayerView.tsx`): maquina de estados baseada em timers + `requestVideoFrameCallback`, outro precedente de "sinal, nao polling".
- Nao ha hoje `requestAnimationFrame` nem `setInterval` de alta frequencia (dezenas de Hz) em lugar nenhum do renderer. O ritmo mais rapido existente e o heartbeat de 2s (`reconnection.ts`) e o tick de stats de 3s. Um envio de posicao a 20-30/s (pedido pela IDEA) seria a cadencia mais alta ja introduzida no canal de dados.

**`prefers-reduced-motion`**
- `src/renderer/src/ui/theme.css` linha 62-73: ja respeitado GLOBALMENTE: zera `--dur-fast`, `--dur-enter`, `--dur-screen` e forca `animation-duration: 0.001ms !important` em `*`. Qualquer animacao nova que use essas variaveis (ou fique dentro do bloco `*`) herda o comportamento reduzido de graca; nao precisa de tratamento especial desde que a implementacao use os tokens de duracao existentes. A interpolacao de MOVIMENTO do cursor (por nao ser CSS puro, e sim posicao calculada quadro a quadro) precisa checar a media query explicitamente em JS, ja que o CSS reduzido nao alcanca esse calculo sozinho.

**Testes**
- `tests/unit/room-state.test.ts`, `protocol.test.ts`, `mesh.test.ts`: padrao de teste do reducer/protocolo puro, sem Electron.
- `tests/e2e/helpers/zoi-app.ts`: `launchInstance` sobe UMA instancia via `electron.launch()` e usa `app.firstWindow()` como a unica pagina testada. Nao ha hoje nenhum uso de `app.windows()` (lista completa de janelas) em lugar nenhum do helper ou dos specs: uma janela de overlay secundaria SERIA tecnicamente alcancavel via `app.windows()` do Playwright `_electron` (a API suporta), mas isso precisa ser adicionado ao helper; hoje nao existe wiring nenhum para uma segunda janela.
- `expectNoDirectionFallbacks` (linha 327 de `zoi-app.ts`) varre `consoleLines` de todas as instancias por marcas de texto fixas (`media-pull`, `dialback`, etc.): depende de logs existentes no console, nao de estado interno.

## 3. Padroes similares existentes

- **Toggle persistido + escape de ambiente**: `forceVp8` (modo compatibilidade) em `settings.ts`/`ipc.ts`/`SettingsModal.tsx` e o precedente mais proximo de "nova preferencia booleana com efeito perceptivel na transmissao", incluindo o padrao de campo aditivo opcional no protocolo (`videoCodec?`, `decodes?`) para nao quebrar cliente antigo.
- **Campo aditivo aberto no protocolo**: `TxStartPayload.videoCodec` e `QualityUpdatePayload.decodes` sao a REFERENCIA de como adicionar um campo opcional sem quebrar clientes antigos (tipo `string`/`string[]` aberto, nunca enum fechado, guard aceita `undefined`). Qualquer novo `MessageType` de cursor deveria seguir o padrao oposto e mais critico: como `MessageType` e um ENUM FECHADO validado por `isOneOf(raw['type'], MESSAGE_TYPES)`, um cliente antigo que recebe um envelope com um `type` que ele nao conhece cai em `validateEnvelope` -> `{ ok: false, reason: 'unknown_type' }` e a mensagem inteira e descartada (nao derruba a conexao, so ignora aquele envelope: confirma a licao ja registrada no LESSONS).
- **UI/visual (nao ha distincao Home vs Painel neste app: projeto single-surface)**: a area visual afetada e a TELA DE SALA (`RoomScreen.tsx` + `room.css`), especificamente o roster (`ParticipantCard.tsx`) para a cor por pessoa, `SourcePickerModal.tsx` para o toggle pre-transmissao, e `TransmittingBar.tsx` para o toggle durante a transmissao. Referencia de identidade visual: tema escuro roxo ja documentado em `theme.css` (tokens `--accent`, `--accent-soft`, `--accent-hover`, `--bg-elevated`, `--border`, `--dur-*`). Nao ha uma segunda "area" (tipo admin vs publico); e tudo a mesma superficie da sala.

## 4. Arquitetura e dados

- **Fluxo de transmissao hoje**: `LOCAL_TX_START` (evento local) -> reducer cria `TransmissionState` local e devolve efeito `broadcast` de `TX_START` -> `mesh.broadcast()` serializa o envelope UMA vez e envia a todos os pares conhecidos. E o padrao que uma feature de "ligar/desligar cursores" (efeito colateral de estado local + broadcast) replicaria para o TOGGLE (evento raro, broadcast faz sentido); ja o FLUXO DE POSICOES (evento frequente, escopado por `txId`) deveria preferir o unicast `mesh.send()` para so os espectadores daquela transmissao, ver secao 2.
- **`RoomState`** (`room-state.ts`) ja indexa `members: RosterMember[]` (com `peerId`, `nickname`, `installId`) e `transmissions: Record<txId, TransmissionState>`. Nao ha hoje nenhum campo para posicao de cursor/participante; teria que ser um novo slice do estado (efemero, nao precisa entrar no `ROSTER_UPDATE`/snapshot, ja que e dado de altissima frequencia e local a cada sessao de assistir).
- **`watching: Record<peerId, txId|null>`** ja existe e e exatamente "quem esta assistindo o que": dado estruturalmente necessario para "de qual transmissao vem este cursor" e para decidir que o overlay do transmissor so desenha cursores de quem esta assistindo a TX dele, e tambem a base para montar a lista de destinatarios do `mesh.send()` seletivo (secao 2).
- **Sem servidor de midia**: tudo e P2P mesh (uma `DataConnection` por par, nao uma estrela via transmissor). Ponto que a IDEA final delega ao SPEC (T3, ex-P6): hoje o mesh ja conecta todo mundo com todo mundo (roster completo), entao tecnicamente as posicoes PODERIAM viajar direto entre espectadores sem passar pelo transmissor, usando o unicast `mesh.send()` ja existente - mas o mesh de dados e separado da conexao de MIDIA (que e so transmissor<->espectador). Isso e uma decisao de SPEC, nao uma limitacao tecnica: a infraestrutura de mesh ja suporta ambos os caminhos.

## 5. Pontos de integracao / servicos externos

- PeerJS publico (`0.peerjs.com`) para sinalizacao; sem TURN. Qualquer novo tipo de mensagem no mesh trafega pelo MESMO canal de dados ja estabelecido (nao e uma integracao nova).
- `zoi-audio-capture` (addon nativo local, `native/zoi-audio-capture`): nao relevante a esta feature alem de ser o precedente de "sondar capacidade de plataforma antes de assumir" (ver LESSONS).
- Nenhuma API de terceiros nova seria necessaria; `setContentProtection`, `desktopCapturer`, `screen.getAllDisplays()` sao todas API nativas do Electron ja disponivel na versao instalada (43.4.1), mas NENHUMA das tres e usada hoje em lugar nenhum do codigo: todas precisam de sonda, conforme a IDEA final ja exige (T2, ambas obrigatorias e bloqueantes).

## 6. Convencoes

- **Comentarios e strings de UI**: portugues sem acento (`nao`, `voce`), nunca travessao.
- **Nomes de arquivo**: kebab-case (`peer-manager.ts`, `stats-monitor.ts`, `first-frame-watch.ts`).
- **Codigo**: identificadores em ingles. Exemplos reais: `RosterMember`, `applyLocalTxStart`, `viewersOf(state, txId)`, `MESH_RACE_GRACE_MS`, `checkSignalingHealth()`.
- **Estilo**: PascalCase para tipos/interfaces/componentes React (`TransmissionState`, `PlayerView`), camelCase para funcoes/variaveis, SCREAMING_SNAKE_CASE para constantes de configuracao/protocolo (`src/shared/config.ts`, `PROTOCOL_VERSION`, `MessageType` valores tipo `'TX_START'`).
- **CSS**: prefixo `z-` para todas as classes (`z-switch`, `z-participant__avatar`, `z-player__video`), BEM-like com `__` e `--` para modificador (`z-switch--on`, `z-switch--bar`).
- **`data-testid`**: kebab-case, usado extensivamente para hooks de E2E (`sharpness-toggle`, `audio-toggle`, `transmitting-bar`).

**`code_identifier_language` (obrigatorio)**: ingles, estilo camelCase/PascalCase/SCREAMING_SNAKE_CASE conforme o tipo do identificador: espelha o padrao ja estabelecido no repositorio (nao e projeto novo). Evidencia: `RosterMember`, `MESH_RACE_GRACE_MS`, `applyLocalTxStart`. Toda a superficie nova desta feature (novo `MessageType`, novos campos de payload, novo evento/efeito do reducer, nomes de componentes/CSS) deve seguir este mesmo padrao; prosa/strings de UI continuam em pt-BR sem acento.

## 7. Restricoes e riscos

- **Enum fechado do protocolo**: `MessageType` e validado por `isOneOf` contra uma lista fixa (`MESSAGE_TYPES`). Um novo tipo de mensagem para posicao de cursor (`CURSOR_MOVE` ou similar) fara um CLIENTE ANTIGO descartar o envelope inteiro (`unknown_type`) sem qualquer feedback ao remetente: consistente com a licao ja registrada no LESSONS (2026-08-25, p2p-screen-share-mvp): "toda adicao de valor a um enum de protocolo exige investigar e documentar o comportamento do cliente antigo nas notas da release". Aqui isso e ainda mais simples que o caso do preset (que quebrava a transmissao inteira): uma mensagem de cursor ignorada por um cliente antigo apenas significa "aquele cliente nao ve os cursores", sem quebrar mais nada; mas precisa ser DOCUMENTADO explicitamente, nao assumido.
- **Sonda antes de assumir capacidade de API** (LESSONS, app-audio-capture): a IDEA final ja exige isso para AS DUAS sondas (`setContentProtection` e o mapeamento `display_id` -> `screen.getAllDisplays()`), com o mesmo tratamento: falha de qualquer uma para o pipeline e volta para conversa com o usuario, sem plano B improvisado.
- **Cor por pessoa nao existia e foi criada na propria IDEA**: ver achado da secao 2 ("Identidade dos participantes"). A IDEA final ja incorporou esse achado (requisito deterministico + matizes separados + aplicacao tambem na lista de participantes), mas o algoritmo em si (equilibrio entre matizes bem separados e estabilidade quando alguem entra na sala) continua em aberto para o SPEC (T1).
- **Nenhum canal de alta frequencia renderer->main existe hoje**: se o desenho do overlay do transmissor precisar que o MAIN receba posicoes vindas do mesh (que roda no renderer) para desenhar na janela de overlay, esse seria um IPC novo de cadencia alta (~20-30 Hz) nunca testado neste sentido (o unico precedente de streaming e worker->renderer via MessagePort, nao renderer->main via `ipcMain`). Vale considerar se a janela de overlay pode ser controlada via `webContents` compartilhado/BrowserView, ou se de fato precisa de mensagens IPC dedicadas e o quanto isso custa.
- **Nenhuma janela secundaria existe hoje**: `src/main/index.ts` so cria UMA `BrowserWindow`. Uma janela de overlay transparente/click-through/sempre-no-topo e uma peca de infraestrutura totalmente nova em `main/`, incluindo lidar com fechamento no `window-all-closed`, ciclo de vida atrelado a transmissao (subir/descer), e nao deixar "janela orfa" (mencionado como caso de borda na IDEA secao 8).
- **`visibilityState` fica SEMPRE `visible` neste app: armadilha ja documentada no proprio codigo**. `PlayerView.tsx` linhas 124-131 tem um comentario explicito: com `backgroundThrottling: false` (definido em `src/main/index.ts` para o heartbeat do PeerJS nao ser estrangulado quando a janela e minimizada), `document.visibilityState` fica sempre `'visible'` neste app - o ramo de visibilidade do `useFirstFrameWatch` e tratado ali como DEFENSIVO, nao como mecanismo funcional hoje. Isso importa diretamente para o caso de borda da IDEA "espectador com a janela em segundo plano ou minimizada: nao faz sentido continuar enviando posicao" (secao 8): se o SPEC tentar resolver esse caso checando `document.visibilityState`/`document.hidden`, o sinal NUNCA vai disparar nesta app, exatamente pelo mesmo motivo ja documentado em `PlayerView.tsx`. Um sinal que efetivamente funciona com `backgroundThrottling: false` ligado seria `window.onblur`/`window.onfocus` (perda de foco do SO), que e diferente de `visibilitychange` e nao e suprimido pela mesma configuracao; o SPEC precisa escolher explicitamente esse ou outro mecanismo, nao pode reusar o padrao de `PlayerView.tsx` como se ele fosse funcional aqui.
- **Toast sem deduplicacao embutida**: ver achado da secao 2 ("Aviso/toast"). `pushToast`/`ToastContainer` nao deduplicam por texto; o aviso "Ponteiros desativados por quem transmite" (P3) precisa do MESMO padrao de guard-por-flag ja usado para "entrou na sala" (`announcedPeers`) e para a porta fechada (`peer-manager.ts:218`), senao reemissoes de estado gerariam toast duplicado por espectador.
- **Superficie de regressao explicita da IDEA (secao 4)**: fallbacks de direcao (`expectNoDirectionFallbacks` no e2e), watchdog de midia, card de status do transmissor, exclusao de audio, aviso de tela preta, E AGORA a lista de participantes (`ParticipantCard.tsx`/`room.css`, por causa da cor por pessoa): nenhum codigo desta feature deve tocar os arquivos que implementam os itens de midia/fallback (`reconnection.ts`, `first-frame-watch.ts`, `media-manager.ts` no que toca watchdog, `audio-exclusion.ts`), e a mudanca na lista de participantes nao pode quebrar contraste, legibilidade da inicial nem o layout existente.
- **`git add`/formatador com glob amplo** (LESSONS, app-audio-capture): usar caminhos explicitos no `git add`, nunca `prettier --write "src/**/*.ts"` dentro desta feature.

## 8. Pontos em aberto (do ponto de vista do codigo)

- O algoritmo de cor deterministica por pessoa (T1): equilibrio entre matizes bem separados e estabilidade quando alguem entra na sala; nenhum precedente de codigo existe para basear a escolha.
- Confirmacao das duas sondas obrigatorias (T2): `setContentProtection` e o mapeamento `display_id` -> `screen.getAllDisplays()`; nenhum precedente de codigo existe para nenhuma das duas.
- Se o overlay do transmissor for uma `BrowserWindow` nova, como o Playwright `_electron` a alcancaria em teste (T5, via `app.windows()`, nao usado hoje): impacto no helper `tests/e2e/helpers/zoi-app.ts`.
- Se o calculo de area real do video (descontando letterbox, T4) vai virar um utilitario compartilhado entre `PlayerView.tsx` e o overlay do transmissor, ou dois calculos separados (um em CSS/DOM no renderer, outro em pixels de tela real no main).
- Se a rota das posicoes (T3) usa `mesh.send()` em loop por espectador do `txId`, ou um novo metodo de fan-out seletivo no `Mesh`, e como isso se compara em custo a um `broadcast()` com filtro local do lado de quem recebe.
