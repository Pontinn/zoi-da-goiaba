---
feature: app-audio-capture
language: pt-BR
code_identifier_language: en - mirrors-existing-codebase
generated: 2026-08-25
stack: Electron 43.4.1 (Chromium ~150.x) + React 18 + Vite 7 (electron-vite) + TypeScript 5.9, Windows-only, PeerJS 1.5.5 (WebRTC mesh), Zustand 5, Vitest 4 + Playwright 1.62 (_electron)
---

## 0. Baseline (drift anchor)

- HEAD commit: `156693a385f3492d3efbbf9f7ac7f626a4c42826`
- IDEA fingerprint (git hash-object): `b5500edf04ddb713b12b0723486ee05b50005418` (recalculado 2026-08-25 apos edicoes de finalizacao da Stage 1; conteudo do CONTEXT confere com a IDEA atual, validado pelo forge-review)
- Arquivos de codigo analisados (mudanca em qualquer um invalida este CONTEXT):
  - `src/main/capture.ts` - `3ac37d4b496fa89e9b1e83b82ad565d13c420058`
  - `src/main/ipc-handlers.ts` - `5d0f48db1086a944fc01f14e1be3e795abf9055a`
  - `src/main/settings.ts` - `0a5dbdd9d64c488c5ac3da5dfd5cd25744725a25`
  - `src/renderer/src/services/media-manager.ts` - `47d1c35310ce752099ded2954c2142cdb0e31a18`
  - `src/renderer/src/services/pip-controller.ts` - `bf802f1944b0019edbc7d690040d5dfdfb52102b`
  - `src/renderer/src/store/room-store.ts` - `f21906fbe413ebde74c96596302bc0b257246e41`
  - `src/renderer/src/core/room-state.ts` - `ffd598b9535c3c54ca957d96062e813e484e2a54`
  - `src/renderer/src/ui/screens/RoomScreen.tsx` - `45af9289806e2d13f33faf2f750f37d646717dbc`
  - `src/renderer/src/ui/screens/PlayerView.tsx` - `8c19aed07505b9e3c3ef946c6ae9381c646e196e`
  - `src/renderer/src/ui/components/StreamThumbnail.tsx` - `5224206db3ecf801659b10505a85a3cf7fd8fed8`
  - `src/renderer/src/ui/components/TransmittingBar.tsx` - `d2c43378d3ac1de7c12d3a30ba9e62c1282c5f94`
  - `src/renderer/src/ui/components/SourcePickerModal.tsx` - `37d0f58372feb617d1546aabb9d6ec36f214fea8`
  - `src/renderer/src/ui/components/SettingsModal.tsx` - `10624f22d8f17c94d76841cfb153abf49ea4c475`
  - `src/renderer/src/ui/components/ParticipantCard.tsx` - `554551c367bd96cb0226f2dbbc05f46debdaaa87`
  - `src/renderer/src/ui/components/MediaFailureOverlay.tsx` - `cb48826f23d931a0b19188267ad24f1343d0ba58`
  - `src/renderer/src/ui/components/Toast.tsx` - `e3bd3a2f9115c97c07a9a4dd7a7fa7e42a93d8c0`
  - `package.json` - `32371b4ae7de4e7dbab6f1400ae124cf46fb427e`

## 1. Stack & build

- `package.json`: `electron@43.4.1`, `electron-vite@5.0.0`, `electron-builder@26.15.3`, `peerjs@1.5.5`, `react@18.3.1`, `zustand@5.0.15`, `typescript@5.9.3`, `vitest@4.1.11`, `@playwright/test@1.62.1`. Node engine `>=22.12.0`.
- Chromium embutido no Electron 43.4.1: **~150.x** (Electron 43 subiu de Chromium 148.0.7778.96 para 150.0.7871.46 conforme changelog oficial; fato obtido por busca externa, NAO pelos typings locais - ver secao 8 sobre confiabilidade).
- Scripts relevantes: `npm run typecheck` (node+web separados), `npm run lint`, `npx vitest run` (~195 testes), `npm run test:e2e` (electron-vite build + Playwright `_electron`), `npm run dist` (electron-vite build + electron-builder --win, gera NSIS).
- `tsconfig.node.json` (main) vs `tsconfig.web.json` (renderer): testes unitarios sao typechecados pelo projeto WEB, sem types de `node`/`electron` - nao importar `src/main/*` em `tests/unit`.

## 2. Arquivos e modulos relevantes

### Pipeline de captura de audio (main + renderer)
- `src/main/capture.ts`: arma a fonte escolhida (`selectSource`) e registra `session.defaultSession.setDisplayMediaRequestHandler` (`registerDisplayMediaHandler`, linha 68-101). Hoje resolve com `{ video: source, audio: 'loopback' }` (linha 90) quando `withAudio=true`. E o ponto de entrada para qualquer nova logica de exclusao de processo.
- `src/main/ipc-handlers.ts`: registra `IPC.captureListSources` e `IPC.captureSelectSource` chamando `listSources`/`selectSource` de `capture.ts`. Handler fino, sem logica propria.
- `src/renderer/src/services/media-manager.ts`: `MediaManager.startTransmission` (linha 229) chama `window.zoi.capture.selectSource` e depois `navigator.mediaDevices.getDisplayMedia({ video, audio: options.withAudio })` (linha 240). `hasAudio` e derivado de `stream.getAudioTracks().length > 0` (linha 260); se `withAudio` pedido mas sem faixa, so loga warn (RNF-10, degradacao silenciosa ja existente - padrao a reaproveitar para o aviso de degradacao desta feature).
- `src/shared/ipc.ts`: tipos `CaptureSelectSourceRequest`, `CaptureListSourcesRequest`, `CaptureSource`, `CAPTURE_SELECTION_TTL_MS` (30s) partilhados main/renderer.

### Streams de audio auxiliares (chamada reversa)
- `attachSilentAudio` / `createDummyStream` (`media-manager.ts` linha 82-127): a stream ficticia do PULL ja injeta uma faixa de audio MUDA via `AudioContext` + `createMediaStreamDestination`. E o precedente direto de "injetar uma track de audio sintetica no fluxo WebRTC" caso a solucao final para excluir o Discord precise trocar a MediaStreamTrack de audio por uma gerada (ex.: via addon nativo + `MediaStreamTrackGenerator`/Insertable Streams). Comentario no codigo ja avisa: custo de uma track sem fonte ligada e praticamente zero.

### Stream rendering/playback (tiles, fullscreen, PiP) - MAPEAMENTO CRITICO
- `src/renderer/src/services/media-manager.ts`, `getStreams()` (linha 189-193): o mapa devolvido para a UI **inclui a propria transmissao local** (`all.set(this.local.txId, this.local.stream)`), lado a lado com as remotas. Nao ha filtragem de "e minha" nesse nivel.
- `src/renderer/src/ui/screens/RoomScreen.tsx`:
  - Grid principal (linha 271-296): `transmissions.map(...)` renderiza `StreamThumbnail` para TODAS as transmissoes do roster (inclusive a propria, `transmission.peerId === room.selfPeerId` vira a prop `isSelf`), com `onSelect={selectTransmission}` sem nenhum guard contra self.
  - Faixa lateral no modo player (linha 236-257, `.z-strip`): mesma coisa, `StreamThumbnail` de todas as OUTRAS transmissoes (exceto a selecionada), tambem sem excluir a propria se ela nao for a selecionada.
  - `PlayerView` (linha 221-235): renderizado quando `selected` (calculado de `selectedTxId`) existe, **sem nenhuma checagem de `selected.peerId === room.selfPeerId`**. Se o proprio `txId` foi selecionado, o player toca a stream normalmente.
- `src/renderer/src/ui/components/StreamThumbnail.tsx`: memoized, sempre `<video muted>` (linha 54) - a MINIATURA nunca toca audio, so mostra o rotulo "sua transmissao" (linha 55, `isSelf`) quando `isSelf`. **Mas o botao continua clicavel e chama `onSelect(txId)` mesmo quando `isSelf` e verdadeiro** - nada impede o clique que abre o `PlayerView`.
- `src/renderer/src/ui/screens/PlayerView.tsx`: **NAO recebe nem checa `isSelf`**. O `<video>` (linha 149-155) NAO e `muted` por padrao (`muted` vem de `sessionMuted` que comeca `false`, linha 13/52) e faz `autoPlay`. Este e o componente que causa o loop de retorno relatado: transmissor clica na propria miniatura (grid ou strip) -> `selectTransmission(txId)` -> `PlayerView` monta com a stream local, sem mute -> autoplay com audio -> loopback do sistema recaptura -> eco crescente.
- `src/renderer/src/services/pip-controller.ts`: `openPip` (linha 31-59) so opera sobre o `<video>` do `PlayerView` (`videoRef.current`, passado por `PlayerView.togglePip`, linha 123-137). Como o PiP usa o MESMO elemento de video do player, se o player esta mostrando a propria stream (bug acima), o PiP tambem mostra/reproduz a propria transmissao - nao ha caminho de exibicao separado a considerar; bloquear o `PlayerView` para o proprio txId bloqueia o PiP por consequencia.
- Conclusao do mapeamento: **existe HOJE um unico ponto de entrada para "ver a propria transmissao ampliada com audio": clicar na propria miniatura em `RoomScreen` (grid ou strip), que chama `selectTransmission(txId)` e monta `PlayerView` sem guard.** A miniatura em si (thumbnail) e segura (sempre muted) e so mostra o rotulo. PiP e fullscreen sao subestados do MESMO `PlayerView`, portanto herdam o bug e a correcao juntos. Nao ha um segundo caminho independente (ex.: nao existe overlay de fullscreen separado).

### Ciclo de vida da transmissao (start/stop/switch)
- `MediaManager.startTransmission` / `stopTransmission` / `switchSource` (`media-manager.ts` linhas 229-320): unica transmissao local por vez (`TransmissionInProgressError`); `switchSource` = stop + start (linha 317-320), ou seja gera um `txId` NOVO a cada troca. Qualquer bloqueio de auto-visualizacao baseado em `txId` precisa reavaliar a cada `LOCAL_TX_START`/troca, nao pode depender de um `txId` fixo cacheado.
- `RoomScreen.tsx`, `startTransmission`/`stopTransmission`/`SourcePickerModal onConfirm` (linhas 91-124): fluxo de UI que chama o manager e sincroniza `localTx` via `refreshLocalTransmission()` (`room-store.ts` linha 88-90).
- `src/renderer/src/core/room-state.ts`: reducer puro. `LOCAL_TX_START`/`LOCAL_TX_STOP` (linhas 1330-1384) atualizam `state.transmissions` e emitem `TX_START`/`TX_STOP` via `broadcast`. `TX_START`/`TX_STOP` remotos (linhas 538-599) fazem o mesmo espelhando outros peers. `selfWatchingTxId` e limpo automaticamente quando a transmissao que se assistia some (linhas 557-559, 583-589) - padrao reaproveitavel para "se eu estava assistindo alguem que virou minha propria transmissao (nao deveria acontecer, mas defensivamente)".

### Caminho de chamada reversa (pull)
- `media-manager.ts`, `startMediaPull`/`answerPull`/`createDummyStream` (linhas 527-603): TODA a mecanica de fallback de direcao (fallback de NAT assimetrico). O transmissor responde `call.answer(transmission.stream)` (linha 585) com a MESMA `LocalTransmission.stream` usada na chamada direta - ou seja, a track de audio substituta desta feature (exclusao de processo) so precisa ser aplicada UMA vez, na criacao de `LocalTransmission.stream` em `startTransmission`; os dois caminhos (direto e pull) a herdam automaticamente. Nao ha logica de audio duplicada a mexer no pull.

### Contagem de espectadores (para o card de status)
- `room.watching: Record<peerId, txId | null>` (`room-state.ts` linha 81, populado por `WATCHING_UPDATE` linha 601-610 e por `LOCAL_WATCHING`/`applyLocalWatching` linha 1386-1401) ja existe no estado replicado. **A contagem de espectadores de uma transmissao = `Object.values(room.watching).filter(txId => txId === meuTxId).length`** - o mesmo padrao ja usado em `RoomScreen.tsx` para montar `watchingLabels` (linhas 54-65). Nenhum dado novo precisa ser criado; so agregar o que ja chega pelo mesh.
- `TransmissionState.hasAudio` (`room-state.ts` linha 47) e `LocalTransmission.hasAudio` (`media-manager.ts` linha 30) ja carregam "com/sem audio" prontos para o card.
- `sourceLabel`/`sourceKind` ja existem em `LocalTransmission` (`media-manager.ts` linhas 27-29) e em `TransmissionState`.

### UI/persistencia de settings
- `src/main/settings.ts`: persiste `nickname`, `installId`, `soundVolume` em `userData/settings.json` (escrita atomica tmp+rename, cache em memoria). Padrao de `setXxx` + `getSettings()` + `IPC.settingsSet` parcial (`ipc-handlers.ts` linhas 18-32) e o modelo a seguir SE a feature precisar persistir algo (a IDEA ja decidiu P4: nada a persistir - sem preferencia de audio, sem toggle).
- `src/renderer/src/ui/components/SourcePickerModal.tsx`: toggle "Transmitir o audio do sistema" (`data-testid="audio-toggle"`, linhas 159-175) e onde hoje se liga/desliga o loopback; a exclusao do Discord/Zoi passa a ser IMPLICITA sempre que este toggle estiver ligado (sem novo controle, por decisao da IDEA).
- `src/renderer/src/ui/components/SettingsModal.tsx`: modelo de modal com `Modal` + `Button` + estado local (`soundVolume`, round-trip de nickname). Referencia de estilo para qualquer texto de aviso permanente, mas a IDEA nao pede nova secao aqui (sem UI de escolha).

## 3. Padroes existentes reaproveitaveis

- **Aviso de degradacao (RNF-10 ja existe)**: `RoomScreen.startTransmission` (linhas 100-105) ja mostra `pushToast('warning', 'Nao foi possivel capturar o audio do sistema; a transmissao segue so com video.')` quando `withAudio` foi pedido mas a stream voltou sem faixa de audio. O aviso de degradacao desta feature (captura por processo falhou, caiu para loopback total) deve seguir o MESMO padrao: `useAppStore.pushToast(tone, texto)` -> `ToastContainer` (`Toast.tsx`), tom `warning`, auto-dismiss em `TOAST_TTL_MS` (4s).
- **Overlays de status sobre o player**: `ReconnectOverlay.tsx` e `MediaFailureOverlay.tsx` sao o padrao visual de "cartao central com icone + titulo + texto explicativo" (`z-reconnect`, `z-reconnect--failure`, `role="status"`) sobreposto ao video. O card "Transmissao iniciada" desta feature deve mirar essa MESMA identidade visual (mesmas classes-base `z-reconnect`/`z-empty`, tema escuro + roxo `#9d00ff`), mas ocupando o LUGAR do tile/player (nao um overlay por cima de video, pois nao havera video).
- **Rotulo "sua transmissao"**: `StreamThumbnail.tsx` linha 55 (`isSelf ? <span className="z-thumb__self">sua transmissao</span>`) e o precedente textual mais proximo ao pedido do card ("Transmissao iniciada").
- **Badge "ao vivo" / contagem**: `ParticipantCard.tsx` usa `z-badge z-badge--danger` com `z-live-dot` para "ao vivo" (linhas 81-85) e `EyeIcon` + label para "assistindo X" (linhas 86-90) - vocabulario visual pronto para compor "N espectadores" no card novo.
- **Empty state da sala**: `.z-empty` em `RoomScreen.tsx` (linhas 260-269) e o padrao de bloco centralizado com icone + titulo + texto quando nao ha transmissao selecionada - estruturalmente parecido com o que o card de status precisa ser.

## 4. Arquitetura e dados: fluxo da propria stream

1. `MediaManager.startTransmission` cria `LocalTransmission` (com `stream: MediaStream` de `getDisplayMedia`) e guarda em `this.local` (`media-manager.ts` linha 280).
2. `getStreams()` publica esse `local.stream` no MESMO mapa `streams` que as remotas (linha 189-193), sem marca de "e local" alem do `txId` bater com `room.selfPeerId` via `room.transmissions[txId].peerId`.
3. `room-store.ts` espelha isso em `useRoomStore.streams` (Zustand) via `mediaManager.subscribeStreams`.
4. `RoomScreen.tsx` le `streams` e `room.transmissions` e monta `StreamThumbnail` para cada transmissao (inclusive a propria) marcando `isSelf` so para fins de rotulo/estilo, nunca para bloquear selecao.
5. `selectTransmission(txId)` (`room-store.ts` linha 40-47) so seta `selectedTxId` e dispara `session.watch(txId)` com debounce - nao ha nenhum guard de "nao selecionar a propria" em lugar nenhum da cadeia.
6. `PlayerView` monta incondicionalmente com a stream resolvida (`streams.get(selected.txId)`), sem checar de quem e o `peerId`.
7. Outros participantes (Bruna, Joao) recebem a mesma `LocalTransmission.stream` via `RTCPeerConnection` (`callPeer`, linha 322-344) ou via pull (`answerPull`, linha 566-593) e a visualizam normalmente pelo MESMO `RoomScreen`/`PlayerView` - a visao deles nao deve mudar; o bloqueio tem que ser condicionado a `peerId === room.selfPeerId`, nunca global.

**Onde a correcao entra**: o guard mais natural, dado o mapeamento acima, e em dois pontos que se reforcam:
- Impedir que `StreamThumbnail` da propria transmissao dispare `onSelect` (ou o `RoomScreen` simplesmente nao passar `onSelect` quando `isSelf`), cobrindo o clique no grid e na strip.
- Em `RoomScreen`, ao decidir `selected`/renderizar `PlayerView`, checar `selected.peerId === room.selfPeerId` e renderizar o CARD DE STATUS no lugar (tanto quando a propria transmissao esta selecionada quanto - defensivamente - quando ela aparece no grid) em vez do `StreamThumbnail`/`PlayerView` normal.
Como PiP e fullscreen sao sub-estados do `PlayerView` (secao 2), resolver esses dois pontos fecha TODOS os caminhos listados na IDEA (tile normal, PiP, apos trocar de fonte - `switchSource` gera novo `txId` mas o `peerId` continua sendo o proprio, apos parar e retransmitir - mesma logica, `LocalTransmission` novo cai no mesmo guard por `peerId`).

## 5. Pontos de integracao

- Servidor de sinalizacao PeerJS: publico (nome do host nao versionado aqui; ver `src/shared/config.ts` se precisar do valor).
- STUN: Google (publico), sem TURN (RF-42, decisao deliberada do projeto - impacta os fallbacks de direcao, nao esta feature).
- Auto-update: GitHub Releases, repo `Pontinn/zoi-da-goiaba`, via `electron-updater` (`src/main/updater.ts`).
- Nenhum destes pontos e tocado por esta feature; citados so como referencia de nao-regressao.

## 6. Convencoes

- Identificadores de codigo 100% em ingles (`selectSource`, `hasAudio`, `withAudio`, `startTransmission`, `LocalTransmission`); comentarios de codigo em pt-BR SEM acento e SEM travessao (todo o arquivo `media-manager.ts`, `capture.ts` etc. seguem isso a risca).
- Strings de UI tambem pt-BR sem acento (ex.: `"Voce esta transmitindo"`, `"sua transmissao"`, `"Nao foi possivel..."`).
- Componentes React: `memo(function Nome(...))` quando renderizados em lista (`StreamThumbnail`, `TransmittingBar`, `ParticipantCard`) - custo de render importa (pilar de performance).
- Classes CSS com prefixo `z-` (`z-thumb`, `z-player`, `z-reconnect`, `z-badge`, `z-empty`) e BEM-like (`z-thumb__self`, `z-thumb--watching`).
- Erros de dominio como classes (`TransmissionInProgressError`, `CaptureFailedError`, `NicknameValidationError`) com `name` proprio, capturadas por `instanceof` na UI.
- Testes: `tests/unit/*.test.ts` (Vitest, reducer puro `room-state.ts` e servicos sem DOM real quando possivel - ex. `media-manager.test.ts` ja existe e cobre o caminho pull via factory `pullingManager` (linhas 224-241), que instancia `MediaManager` com sessao fake e uma factory de stream ficticia injetada (FakeOutStream video+audio mudo)); `tests/e2e/*.spec.ts` (Playwright `_electron`, `ZOI_USER_DATA_DIR` para instancias isoladas, helper `tests/e2e/helpers/zoi-app.ts`). `expectNoDirectionFallbacks` aparece em `tests/e2e/smoke-session.spec.ts` e no helper.

## 7. Restricoes e riscos

- **Fallbacks de direcao (NAO regredir)**: mesh race-to-open, media pull (`startMediaPull`/`answerPull`), dial-back de admissao - estabilizados com teste de campo caro, cobertos por `expectNoDirectionFallbacks` no E2E do caminho feliz. Qualquer mudanca na criacao/troca da `LocalTransmission.stream` (para trocar a origem do audio) precisa preservar que a MESMA `stream` segue disponivel para `callPeer` E para `answerPull` sem introduzir latencia ou re-negociacao extra.
- **Pilar de performance**: captura/filtragem de audio nao pode custar frames de video. Precedente: `attachSilentAudio`/`createDummyStream` ja documentam que uma track sem fonte ligada custa "praticamente zero"; qualquer processamento de audio (ex.: addon nativo escrevendo PCM) deve rodar fora do caminho de render de video e nunca no mesmo processo/thread que teria custo de frame.
- **Risco de addon nativo**: se a investigacao (secao 8/P2) concluir que Electron/Chromium NAO expoe exclusao de processo, um addon N-API (WASAPI Process Loopback, `PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE`) precisa ser compilado e empacotado pelo `electron-builder` (`npm run dist`, NSIS) sem quebrar o instalador - risco de build (node-gyp/prebuild, arquitetura x64, assinatura) nao coberto por nada hoje no repo (nao ha nenhum addon nativo atualmente, `dependencies` so tem `electron-updater`).
- **Fallback obrigatorio em runtime**: se a captura por processo falhar depois de armada, a IDEA exige degradar para o loopback atual COM AVISO (nunca mudo em silencio) - o padrao de toast (secao 3) resolve o "aviso"; falta decidir ONDE detectar a falha em runtime (o `getDisplayMedia` de hoje so falha na abertura, nao durante a transmissao already-in-course).
- **`switchSource` gera `txId` novo a cada troca** (`stopTransmission` + `startTransmission`): qualquer estado de UI amarrado ao `txId` antigo (ex. um guard cacheado) precisa ser recalculado, nao versionado por txId fixo.

## 8. Pontos em aberto (o codigo nao responde)

1. **P2 - veredito tecnico (MAIS IMPORTANTE)**: os typings instalados de `electron@43.4.1` (`node_modules/electron/electron.d.ts`, interface `Streams`, linhas ~23740-23755) mostram que `setDisplayMediaRequestHandler` so aceita `audio?: ('loopback' | 'loopbackWithMute') | WebFrameMain`. `WebFrameMain` so captura audio de um FRAME do proprio Electron (ex.: uma `webContents` interna), NUNCA de um processo externo arbitrario como o Discord. **Nao ha, nos typings/docs locais instalados, nenhuma opcao de excluir/incluir a arvore de processos de um app de terceiros no loopback do Windows.** Isso e uma evidencia forte (baseada nos tipos oficiais instalados, fonte primaria) de que Electron 43/Chromium NAO expoe o Process Loopback Exclude nativamente para uso do app - mas nao e 100% conclusivo porque (a) o `desktopCapturer`/Chromium podem ter comportamento nao documentado nos `.d.ts` (os tipos documentam a API do Electron, nao necessariamente cada flag interna do Chromium), e (b) a versao exata do Chromium embutido (~150.x, obtida por busca externa, nao pelos arquivos locais) precisaria ser cruzada com as release notes do Chromium sobre "window/system audio capture exclusion" para fechar 100%. Recomendacao: tratar como "quase certo que precisa de addon nativo", mas vale um teste rapido de runtime (probe) antes de comprometer a arquitetura.
2. Comportamento exato quando o app de audio (Discord) fecha no meio da transmissao (P5 da IDEA, secao 8): nao ha nenhum precedente no codigo para "voltar ao loopback total em runtime" - hoje toda decisao de audio e tomada uma vez, no `startTransmission`.
3. Identificacao robusta da arvore de processos do Discord (Discord/PTB/Canary, ou Discord aberto no navegador): fora do escopo do que o codigo atual sabe - nenhum modulo hoje enumera processos do SO.
4. Sincronizacao A/V e resampling caso a track de audio venha de um addon nativo (PCM bruto) em vez do `getDisplayMedia` nativo - nenhum precedente no repo de manipulacao de audio raw.
5. Exato mecanismo de "runtime probe" para decidir, na maquina do usuario, se o Process Loopback Exclude esta disponivel antes de tentar usa-lo (a IDEA pede investigacao previa disso, mas nao ha specs tecnicas ainda de COMO sondar).
6. Onde exatamente inserir a checagem de `peerId === room.selfPeerId` sem quebrar a UX do grid quando SO existe a propria transmissao (hoje cai no ramo `transmissions.length === 0` que mostra o empty-state "ninguem esta transmitindo" - com a propria transmissao ativa esse ramo nunca dispara porque `transmissions` inclui a propria; precisa decisao de produto/UX sobre se o card de status substitui esse empty-state ou aparece em paralelo a ele).

## Nota de seguranca

Nenhum segredo, credencial, chave, token ou valor de variavel de ambiente foi encontrado ou incluido neste documento. Nomes de hosts/servicos (PeerJS, STUN, GitHub Releases) foram citados apenas pelo nome, sem URLs privadas nem valores de configuracao.
