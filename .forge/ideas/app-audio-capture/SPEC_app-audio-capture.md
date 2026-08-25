---
feature: app-audio-capture
language: pt-BR
generated: 2026-08-25
stack: Electron 43.4.1 (Chromium ~150) + React 18 + Vite 7 (electron-vite 5) + TypeScript 5.9, Windows-only, PeerJS 1.5.5, Zustand 5, Vitest 4 + Playwright 1.62 (_electron), addon nativo N-API (C++/WASAPI) novo
status: spec
prd_source: PRD_app-audio-capture.md @ 4702d8be144e053a12d9f53a1fb3ddfbe5257d91
---

# SPEC - app-audio-capture

## 1. Baseline (ancora de drift)

- **HEAD**: `36f21efc468c46e71a39ac7d6a252b677e124aeb` (branch `feature/app-audio-capture`). Nota: a PRD registra HEAD `156693a...` porque foi escrita antes do commit do UISPEC nesta branch; o codigo-fonte relevante NAO mudou entre os dois commits (fingerprints abaixo conferem com o CONTEXT).
- **Fingerprints dos artefatos** (git hash-object):
  - `PRD_app-audio-capture.md` - `4702d8be144e053a12d9f53a1fb3ddfbe5257d91`
  - `CONTEXT_app-audio-capture.md` - `ebc5cadccadff0c82df48c6237a854067b4c5af0`
  - `UISPEC_app-audio-capture.md` - `1b885403796ce8fba6968697b339571200687285`
  - `IDEA_app-audio-capture.md` - `3ed100aaed33cb02c98963697f8233e95d17ae6e`
- **Arquivos de codigo dos quais este SPEC depende** (mudanca em qualquer um exige reconferir):
  - `src/main/capture.ts` - `3ac37d4b496fa89e9b1e83b82ad565d13c420058`
  - `src/main/ipc-handlers.ts` - `5d0f48db1086a944fc01f14e1be3e795abf9055a`
  - `src/main/index.ts` - `a4a055b713a7742e274940a0a53545d4f9529491`
  - `src/preload/index.ts` - `6d968fd838be6eb820de271449eaa63c23c107f9`
  - `src/preload/index.d.ts` - `82d61fc7f18dfd1e0bf009caf081847cbad129d3`
  - `src/shared/ipc.ts` - `0b17e0b8efa17f5b819494f3e4401cbefe34a11e`
  - `src/renderer/src/services/media-manager.ts` - `47d1c35310ce752099ded2954c2142cdb0e31a18`
  - `src/renderer/src/store/room-store.ts` - `f21906fbe413ebde74c96596302bc0b257246e41`
  - `src/renderer/src/store/app-store.ts` - `0404c9ec1f5436c6c489a1516fcab3b6e2f39d44`
  - `src/renderer/src/core/room-state.ts` - `ffd598b9535c3c54ca957d96062e813e484e2a54`
  - `src/renderer/src/ui/screens/RoomScreen.tsx` - `45af9289806e2d13f33faf2f750f37d646717dbc`
  - `src/renderer/src/ui/screens/PlayerView.tsx` - `8c19aed07505b9e3c3ef946c6ae9381c646e196e`
  - `src/renderer/src/ui/components/StreamThumbnail.tsx` - `5224206db3ecf801659b10505a85a3cf7fd8fed8`
  - `src/renderer/src/ui/components/DoorsTransition.tsx` - `d0be283337dd73fd4a397cb4d24f8f2ce66cdb11`
  - `src/renderer/src/ui/theme.css` - `392b80b68845fb29991a12e5ee931e0434b30ee1`
  - `src/renderer/src/ui/screens/room.css` - `168c9a76b74a9a5948fa858a6e30537f1ec74cdb`
  - `src/renderer/src/ui/components/components.css` - `37f54ac19ab23fd96973fdea3ec1a1e21e44abe5`
  - `package.json` - `32371b4ae7de4e7dbab6f1400ae124cf46fb427e`
  - `electron-builder.yml` - `f18548c5065e25448b90d763dd3b081409901b0f`
  - `electron.vite.config.ts` - `c1282fd9af643ab3ed113ccc6b15ee9b41f4c5a9`
  - `tests/e2e/helpers/zoi-app.ts` - `57bfbd23cd0257653df213531c813cf78017d978`
  - `tests/e2e/smoke-session.spec.ts` - `0b58e8d46021c71fe4f785b734b5a150556b8bbf`
  - `tests/unit/media-manager.test.ts` - `a26553009541d7c9edc38a977bfb1b207e1bae38`

## 2. Visao de design

### 2.1 Veredito da investigacao P2 (a decisao central deste SPEC)

**Pergunta**: o Electron 43.4.1 / Chromium ~150 consegue excluir a arvore de processos do Discord (e do Zoi) do loopback de audio do Windows sem codigo nativo?

**Veredito: NAO. E preciso um addon nativo N-API usando o WASAPI Process Loopback do Windows.**

Evidencias (verificadas nesta sessao):

1. **Typings oficiais instalados** (`node_modules/electron/electron.d.ts`, interface `Streams`, linhas 23740-23755): `setDisplayMediaRequestHandler` aceita para audio APENAS `'loopback' | 'loopbackWithMute' | WebFrameMain`. `WebFrameMain` captura audio de um frame do PROPRIO Electron, nunca de um processo externo. Nao existe nenhum campo de inclusao/exclusao de processo. `DisplayMediaRequestHandlerOpts` (linha 21643-21649) so tem `useSystemPicker` (macOS). O `desktopCapturer` (getSources) so trata video/thumbnails. Nenhuma outra API do d.ts (webContents, systemPreferences, app.commandLine) expoe filtragem de processo no loopback.
2. **Chromium ~150**: o unico mecanismo relacionado que chegou ao Chromium estavel e o constraint `restrictOwnAudio` do getDisplayMedia (Chrome 141+), que filtra SOMENTE o audio originado do proprio documento capturante; ele nao aceita processo arbitrario de terceiro (Discord), entao nao resolve o problema principal. Nao ha switch de linha de comando do Chromium que aplique exclude-por-processo ao loopback.
3. **API nativa alvo** (docs Microsoft): `ActivateAudioInterfaceAsync` + `AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK` com `AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS { TargetProcessId, ProcessLoopbackMode }`, modos `PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE` e `..._EXCLUDE_TARGET_PROCESS_TREE`. Disponivel desde Windows 10 build 20348 (todo o grupo esta em Win11, IDEA secao 2). **Restricao estrutural decisiva: cada ativacao aceita UM UNICO PID alvo.** O modo EXCLUDE exclui UMA arvore; a PRD exige excluir DUAS (Discord E Zoi, RF-01).

**Arquitetura escolhida: addon nativo com COMPOSICAO DE SESSOES INCLUDE ("tudo, menos os processos proibidos").** Em vez de um unico stream exclude (que so remove uma arvore), o addon compoe o mix a partir de capturas INCLUDE ancoradas nos PIDs das sessoes de audio. Regra central de seguranca: **a ancora de include e SEMPRE o proprio PID da sessao de audio, NUNCA um ancestral**. Subir a cadeia de ancestrais serve exclusivamente para DETECTAR que uma sessao pertence a uma arvore proibida; escolher um ancestral como ancora reintroduziria o vazamento (quase todo app do usuario, Discord incluido, compartilha ancestrais como `explorer.exe`: um include ancorado la capturaria a subarvore do Discord junto). Algoritmo exato:

1. **Enumeracao**: sessoes de audio ativas no endpoint de render padrao (`IAudioSessionManager2` + `IAudioSessionEnumerator` + `IAudioSessionControl2::GetProcessId`), ignorando sessoes de sistema (PID 0).
2. **Classificacao (deteccao de proibidos)**: um PID e PROIBIDO se ele mesmo OU qualquer ancestral seu (Toolhelp32 snapshot + checagem de tempo de criacao contra reuso de PID) tem executavel `discord.exe`, `discordptb.exe` ou `discordcanary.exe` (case-insensitive), ou pertence a arvore do proprio Zoi (PID raiz passado pelo main). Sessao com PID proibido NUNCA ganha captura.
3. **Pre-checagem de subarvore (invariante de abertura)**: antes de abrir um include para uma sessao permitida de PID P, o addon varre a SUBARVORE atual de P; se existir qualquer processo proibido dentro dela, o include NAO abre (direcao segura: perde-se o audio desse app, nunca vaza o Discord). Com o Discord aberto, isso bloqueia por construcao qualquer ancora do tipo shell/launcher (ex.: `explorer.exe` com sessao de som do sistema).
4. **Dedup por parentesco**: se duas sessoes permitidas A e B tem relacao ancestral-descendente (A ancestral de B), abre-se include SOMENTE na mais alta (A): `INCLUDE_TARGET_PROCESS_TREE` em A ja cobre B, e abrir B duplicaria o audio. Quando a sessao de A morre e a de B persiste, a reconciliacao abre B.
5. **Mix**: todas as capturas somadas num relogio unico de 10 ms (soma float com clamp), frames PCM continuos (silencio quando ninguem toca).
6. **Dinamica em tres redes de protecao**:
   - (i) `IAudioSessionNotification::OnSessionCreated` para TODA sessao nova: se classificada permitida e nao coberta por include existente, abre include (com a pre-checagem do passo 3); se classificada PROIBIDA, alem de nunca abrir include, o addon FECHA IMEDIATAMENTE qualquer include cuja subarvore contenha aquele PID (reacao event-driven no instante em que o caminho de audio proibido passa a existir).
   - (ii) Vigia de processos proibidos a cada 1 s (snapshot Toolhelp32, custo trivial): se um processo proibido aparecer como DESCENDENTE de uma ancora incluida (ex.: Discord lancado a partir de um app cuja sessao ja estava capturada), o include coberto e fechado na hora e permanece fechado enquanto o descendente proibido viver.
   - (iii) Varredura de reconciliacao a cada 5 s: re-enumera sessoes, abre includes que faltam (respeitando os passos 2-4), fecha capturas de sessoes/arvores mortas.

**Por que este desenho vence**: a invariante da PRD e "nunca vazamento silencioso das vozes do Discord" (RF-06/AC-19). Aqui ela vale assim: na ABERTURA de cada include, por construcao (classificacao + pre-checagem de subarvore + dedup); em RUNTIME, o unico cenario teorico de exposicao exige que um processo proibido seja criado como descendente de uma ancora ja incluida E emita audio antes da reacao das redes (i)/(ii), ou seja, em menos de ~1 s da criacao do processo, algo que o startup do Discord (varios segundos ate entrar em voz) nao consegue fazer; e a rede (i) reage no proprio evento de criacao da sessao de audio, antes de o som proibido se estabelecer. Discord fechado/reaberto NUNCA volta ao mix porque nao existe "reaplicar": ele simplesmente nunca entra na lista de inclusao. O modo de falha residual e sempre a direcao segura: audio de algum outro app faltando, nunca voz do Discord sobrando. Isso resolve P5 (RF-05/RF-06).

### 2.2 Como o PCM chega ao WebRTC

- O addon roda dentro de um **`utilityProcess`** do Electron (isolamento de crash: um bug no C++ derruba o worker, nao o app; `utilityProcess.fork` existe no Electron 43, `electron.d.ts` linha 15688/15696, e carrega modulos nativos).
- O worker envia frames PCM (Float32 interleaved, 48 kHz, 2 canais, 480 amostras por frame de 10 ms) por **`MessagePort` direto worker -> renderer** (o main so faz o handshake dos ports; o dado nao passa pelo canal IPC principal). Custo: ~100 mensagens/s de ~3,8 KB, irrelevante (RNF-01).
- No renderer, um servico cria uma track de audio via **`MediaStreamTrackGenerator`** (Insertable Streams / breakout box do Chromium, presente no Chromium 150) e escreve um `AudioData` por frame com timestamp acumulado por contagem de amostras. Essa track e adicionada a `LocalTransmission.stream` ANTES do announce, entao os DOIS caminhos de midia (chamada direta `callPeer`, media-manager.ts linha 327, e chamada reversa `answerPull`, linha 585) herdam o audio automaticamente, sem tocar na mecanica de fallback de direcao (RNF-02/RNF-06).
- **Vantagem estrutural**: a track WebRTC e NOSSA e nunca muda de identidade. Reinicio do worker, rearme da captura ou degradacao interna trocam apenas a FONTE do PCM por tras da mesma track: zero renegociacao, zero replaceTrack, zero risco para os fallbacks de direcao.
- Quando a captura por processo nao esta disponivel (probe falha, addon nao carrega, env de teste), o fluxo degrada para o comportamento ATUAL: `selectSource` com `withAudio: true` + `getDisplayMedia` com `audio: 'loopback'` (capture.ts linhas 89-91, inalterado) + toast de aviso (RF-07/RF-08).
- Degradacao DURANTE a transmissao: **quem degrada e o MAIN, nunca o worker** (um worker que crashou nao consegue trocar de modo sozinho). O addon expoe o modo `endpoint-loopback` (WASAPI loopback classico do endpoint inteiro, sem process API, sempre disponivel), e a cascata do main (Sprint 3) reage a falha fatal ou exit inesperado do worker re-forkando: primeiro uma vez em `process-exclusion`, depois em `endpoint-loopback` (com novo handshake de port; o servico do renderer aceita port novo a qualquer momento e segue alimentando a MESMA track). O modo desejado viaja no campo `mode` do `start` main -> worker (secao 5.C). O renderer mostra o toast no evento de status (RF-08/AC-05). Se nem o `endpoint-loopback` subir, o renderer mostra toast de falha explicita; nunca mudo em silencio.

### 2.3 Bloqueio de auto-visualizacao (frontend)

Defesa em profundidade em TRES camadas, nos pontos exatos mapeados pelo CONTEXT:

1. **Camada de selecao (dados)**: `selectTransmission` (`room-store.ts` linhas 40-47) ganha guard: selecionar um txId cujo `peerId === room.selfPeerId` e ignorado. Nenhum caminho consegue montar o `PlayerView` com a propria stream.
2. **Camada de render (RoomScreen)**: no grid (`RoomScreen.tsx` linhas 271-296) o tile da propria transmissao e substituido pelo `TransmissionStatusCard`; na strip (linhas 236-257) a propria transmissao vira a variante compacta do card; na decisao do player (linhas 221-235), se `selected.peerId === room.selfPeerId` (defensivo, nao deveria ocorrer com a camada 1), renderiza o card em area cheia em vez do `PlayerView`.
3. **Camada de componente**: `StreamThumbnail.tsx` (linha 49) deixa de disparar `onSelect` quando `isSelf` e deixa de anexar a stream ao `<video>` quando `isSelf` (linhas 36-44).

PiP e fullscreen sao sub-estados do `PlayerView` (`pip-controller` opera sobre o `videoRef` do player; fullscreen sobre o container do player): bloqueado o mount do `PlayerView` para a propria transmissao, ambos ficam bloqueados por consequencia (mapeamento confirmado no CONTEXT secao 2). `switchSource` gera txId novo (media-manager.ts linhas 317-320) mas o guard e por `peerId`, entao ele nunca "escapa" na troca de fonte nem na retransmissao.

O card de status segue o UISPEC_app-audio-capture.md (secoes 4-7): identidade, tokens, contrato de motion, logo `logo-goiaba.png`. A contagem de espectadores vem de `room.watching` via novo selector puro `viewersOf` (nenhum dado novo trafega no mesh).

### 2.4 Convencao de identificadores (para os agentes da Stage 4)

- Identificadores de codigo 100% em INGLES (`audioExclusion`, `startProcessExclusion`, `TransmissionStatusCard`, `viewersOf`), camelCase TS, PascalCase para componentes, classes CSS `z-*` BEM-like (`z-status-card__logo`).
- Strings de UI e comentarios em pt-BR SEM acento e SEM travessao.
- Erros de dominio como classes com `name` proprio, capturadas por `instanceof`.
- Canais IPC no padrao existente `dominio:acao` (`audio-exclusion:start`).

## 2b. Mapa de ciclo de vida das entidades

**Esta feature nao gerencia nenhuma entidade persistida.** Por decisao da IDEA (P3/P4) e por RNF-07 da PRD, nada e escrito em `settings.json` nem em qualquer outro armazenamento: a exclusao e fixa, sempre ligada quando "audio do sistema" esta ativo, sem preferencia, sem toggle. A unica escape hatch e a variavel de ambiente `ZOI_DISABLE_AUDIO_EXCLUSION` (dev/testes), que nao e persistida nem exposta na UI.

O ciclo de vida relevante e o da TRANSMISSAO, cruzado com o armamento da exclusao e com o card:

| Evento da transmissao | Exclusao de audio | Card de status |
|---|---|---|
| Iniciar com audio | `audioExclusion.start()` antes do `getDisplayMedia`; sucesso: track gerada entra na stream (`audioMode: 'excluded'`); falha: degrada para loopback total + toast (`audioMode: 'full-loopback'`) | Card monta no lugar do proprio tile; animacao de entrada dispara UMA vez (key = txId) |
| Iniciar sem audio | Nada e armado (`audioMode: 'none'`) | Card monta igual, detalhe "sem audio" |
| Trocar fonte (`switchSource` = stop + start, txId NOVO) | Exclusao para e rearma inteira no start novo (RF-12/RF-14 por construcao) | Card remonta (key = txId novo), fonte atualizada; guard por peerId nunca abre janela de exposicao |
| Discord fecha durante a transmissao | Sessoes dele morrem; mix segue; nada a fazer (RF-05) | Sem mudanca |
| Discord reabre / processo novo | Nunca entra no include-set (RF-06); sessao proibida nova fecha na hora qualquer include que a cubra; vigia de 1 s fecha include com descendente proibido; processo novo permitido ganha captura via notificacao + varredura 5 s | Sem mudanca |
| Falha de runtime do motor | MAIN re-forka o worker (cascata: process-exclusion, depois endpoint-loopback) alimentando a MESMA track + status event -> toast; falha total -> toast de audio perdido | Sem mudanca |
| Parar | `stop()` do worker + track parada junto com a stream (stopTransmission ja para todas as tracks, media-manager.ts linha 310) | Card desmonta; area volta a grid/empty (RF-13) |
| Retransmitir | Ciclo completo se reaplica (start novo) | Card novo com animacao nova (RF-14) |
| Sair da sala / teardown | `teardown()` ja para a stream local (linha 755-758); worker e derrubado pelo main | Tela some inteira |

## 3. Trade-offs e alternativas rejeitadas

1. **Exclude unico (uma arvore) vs composicao include (escolhido)**: o modo `EXCLUDE_TARGET_PROCESS_TREE` so aceita UM PID raiz; excluiria Discord OU Zoi, nunca ambos (RF-01 exige ambos). Rejeitado.
2. **Subtracao de dois streams** (stream A = sistema menos Zoi; stream B = so Discord; saida = A - B): exige alinhamento sample-exato entre dois relogios de captura; qualquer divergencia de resampling deixa "fantasma" audivel do Discord, ou seja, VAZAMENTO SILENCIOSO, exatamente o que a PRD proibe. Rejeitado.
3. **`restrictOwnAudio` do Chromium 141+** como solucao: filtra so o audio do proprio documento capturante; nao cobre o Discord. Podia servir de defesa extra para o audio do Zoi, mas seu comportamento no caminho `setDisplayMediaRequestHandler` + `'loopback'` do Electron nao e documentado; nao dependemos dele (o probe do Sprint 1 registra o resultado por curiosidade tecnica, sem acoplamento).
4. **Addon no processo main vs `utilityProcess` (escolhido)**: no main, um crash do C++ derruba o app inteiro; no utility, o main detecta `exit`, reinicia e degrada com aviso. O custo (uma entry extra no build do main e handshake de MessagePort) vale o isolamento, dado o pilar "nada do que ja foi feito pode ser danificado".
5. **`AudioWorklet` + `createMediaStreamDestination` vs `MediaStreamTrackGenerator` (escolhido)**: o worklet acopla o PCM ao relogio do grafo de audio e exige servir o modulo do worklet pelo bundler; o generator e feito exatamente para injetar midia em WebRTC, roda no Chromium do Electron (nao ha problema de compatibilidade cross-browser) e dispensa AudioContext. O worklet fica documentado como plano B se o probe do Sprint 1 reprovar o generator.
6. **Trocar a track por `RTCRtpSender.replaceTrack` na degradacao vs manter a track e trocar a FONTE (escolhido)**: replaceTrack teria que ser aplicado em N senders (diretos + pulls) com corrida contra renegociacao; manter a track unica e alimentar por tras elimina a classe inteira de bug (RNF-02/RNF-06).
7. **Remover a stream local de `getStreams()`** (media-manager.ts linhas 189-193) para "esconder" a propria transmissao: rejeitado; mexeria no contrato de dados usado pelo pipeline e por testes, enquanto o bloqueio pertence a camada de selecao/render. O guard e feito na UI store e no RoomScreen, com o media pipeline intocado.
8. **Card so no grid vs card tambem na strip (escolhido)**: PRD RF-09/RF-10 listam a strip como caminho de exibicao; ocultar simplesmente a propria transmissao na strip deixaria o card "nao persistente" enquanto se assiste outra transmissao. A variante compacta na strip mantem o card visivel durante TODA a transmissao (decisao UX-first, diretriz da PRD secao 1).
9. **Prebuilds binarios commitados vs build no install (escolhido)**: binario em git envelhece e esconde a toolchain; o addon usa Node-API (ABI estavel) + `node-gyp rebuild` no install do pacote local, e o `electron-builder install-app-deps` garante o rebuild coerente no `npm run dist`. Requisito de maquina de dev documentado na secao 9.

## 4. Riscos

| Risco | O que pode dar errado | Mitigacao |
|---|---|---|
| Regressao dos fallbacks de direcao (race-to-open, media pull, dial-back) | Mudanca na origem da track de audio quebra a chamada reversa ou gera renegociacao | A track gerada entra na `LocalTransmission.stream` UMA vez, antes do announce; `callPeer` e `answerPull` seguem consumindo a MESMA stream (nenhuma linha dos caminhos de pull muda); e2e `expectNoDirectionFallbacks` (tests/e2e/helpers/zoi-app.ts linha 274, usado em smoke-session.spec.ts linha 109) obrigatorio verde no Sprint 7 |
| Addon nativo quebra o instalador NSIS / auto-update | `.node` dentro do asar nao carrega; toolchain ausente no `npm run dist`; latest.yml/blockmap divergem | Sprint 1 ja valida `npm run dist` com o esqueleto do addon (risco retirado ANTES da implementacao); `asarUnpack: "**/*.node"` explicito no electron-builder.yml; addon como dependencia local `file:` para o electron-builder tratar como native dep |
| Dessincronizacao A/V | PCM do addon chega com atraso/jitter e o labio descola do video | Cadencia fixa de 10 ms clockada no worker (frames continuos, silencio incluido), timestamps por contagem de amostras a 48 kHz, latencia fim-a-fim estimada 30-60 ms (mesma ordem da captura de video); jitter absorvido pelo NetEQ do receptor; validacao perceptual no smoke manual do Sprint 4 |
| Custo de frames de video (RNF-01) | Captura/mixagem rouba CPU do pipeline de video | Todo o trabalho WASAPI roda em threads do utilityProcess (fora do main e do renderer); no renderer so ha 100 writes/s triviais; nenhuma alocacao por frame de video; sem processamento de audio no caminho de render |
| Vazamento silencioso do Discord | Corrida na reaplicacao da exclusao deixa a voz passar; ou um include ancorado alto demais captura a subarvore do Discord junto | Ancora de include = PID da propria sessao (nunca ancestral) + pre-checagem de subarvore na abertura + reacao event-driven no OnSessionCreated de sessao proibida + vigia de processos proibidos a cada 1 s (secao 2.1); exposicao exigiria o Discord emitir audio em menos de ~1 s da criacao do processo dentro de uma ancora incluida, abaixo do tempo real de startup dele |
| Transmissao muda silenciosa | Motor cai e ninguem percebe | Worker emite status a cada transicao; renderer mostra toast em `degraded-full-loopback` e `failed`; cascata: rearme -> endpoint-loopback -> toast de falha explicita (RF-08) |
| Audio de app legitimo faltando | App novo demora a ganhar captura; sessao em endpoint nao-padrao fica de fora | Notificacao OnSessionCreated + varredura de reconciliacao 5 s; janela de perda de no maximo segundos, direcao segura (nunca vaza Discord); comportamento igual ou melhor que o loopback atual documentado como limite |
| PID reuse engana a classificacao de arvore | PID de ancestral reciclado aponta para exe errado | Checagem de tempo de criacao (ancestral precisa ser mais velho que o filho) no walk de ancestralidade |
| Toolchain nativa ausente na maquina de dev | `npm install` falha no node-gyp | Requisito documentado (VS Build Tools + Python via node-gyp); `ZOI_DISABLE_AUDIO_EXCLUSION=1` permite rodar dev/testes mesmo se o build nativo falhar localmente (com stub JS de fallback no pacote, ver Sprint 1) |
| E2E instavel por depender de audio real | Playwright arma captura real de audio na maquina de CI/dev | Helper e2e injeta `ZOI_DISABLE_AUDIO_EXCLUSION=1`: e2e cobre a UI e o caminho degradado deterministico; o caminho nativo e coberto por probe + unit com stubs |
| Animacao do card custa fps (RNF-09) | Keyframes com layout/paint, loop continuo | Contrato do UISPEC secao 6: SOMENTE transform/opacity, entrada unica por txId, sem loop, `prefers-reduced-motion` coberto pela regra global de theme.css linhas 62-77 |

## 5. Contrato de interfaces

**Esta feature NAO tem endpoints HTTP** (o app nao tem servidor proprio; toda comunicacao de rede e o mesh WebRTC ja existente, que nao ganha mensagens novas). Os contratos reais sao IPC do Electron, superficie do preload e o handoff de audio worker -> renderer.

### 5.A Canais IPC novos (todos registrados em `src/main/ipc-handlers.ts`, tipos em `src/shared/ipc.ts`)

Constantes novas no objeto `IPC` (src/shared/ipc.ts linhas 4-15):

```ts
audioExclusionStart: 'audio-exclusion:start',
audioExclusionStop: 'audio-exclusion:stop',
audioExclusionStatus: 'audio-exclusion:status',
audioExclusionPort: 'audio-exclusion:port'
```

| Canal | Direcao | Tipo | Request | Response / Payload | Erros |
|---|---|---|---|---|---|
| `audio-exclusion:start` | renderer -> main | `invoke` | sem payload | `AudioExclusionStartResult` | Nunca lanca: falha vira `{ mode: 'unavailable', reason }` (RF-07: sem erro cru) |
| `audio-exclusion:stop` | renderer -> main | `invoke` | sem payload | `void` (idempotente: parar sem captura ativa e no-op) | Nunca lanca |
| `audio-exclusion:status` | main -> renderer | `send` (evento) | n/a | `AudioExclusionStatus` | n/a |
| `audio-exclusion:port` | main -> renderer | `webContents.postMessage` com 1 `MessagePort` | n/a | mensagem `{ channel: 'zoi:audio-exclusion-port' }` + port transferido | n/a |

Tipos novos (src/shared/ipc.ts):

```ts
export type AudioExclusionUnavailableReason =
  | 'disabled-by-env'      // ZOI_DISABLE_AUDIO_EXCLUSION=1
  | 'os-unsupported'       // build do Windows abaixo de 20348
  | 'addon-load-failed'    // require do addon falhou (build nativo ausente)
  | 'worker-spawn-failed'  // utilityProcess nao subiu
  | 'activation-failed'    // probe/ativacao WASAPI devolveu erro

export type AudioExclusionStartResult =
  | { mode: 'process-exclusion'; sampleRate: 48000; channels: 2 }
  | { mode: 'unavailable'; reason: AudioExclusionUnavailableReason }

export type AudioExclusionState = 'active' | 'degraded-full-loopback' | 'failed'

export interface AudioExclusionStatus {
  state: AudioExclusionState
  /** Texto tecnico curto para log; a UI usa so `state`. */
  detail: string | null
}
```

### 5.B Superficie do preload (`window.zoi.audioExclusion`, em `ZoiApi` de src/shared/ipc.ts linhas 93-126)

```ts
audioExclusion: {
  start(): Promise<AudioExclusionStartResult>
  stop(): Promise<void>
  /** Registra listener de audio-exclusion:status; retorna a funcao de descarte. */
  onStatus(listener: (status: AudioExclusionStatus) => void): () => void
}
```

Entrega do MessagePort ao mundo isolado: o preload (src/preload/index.ts) escuta `ipcRenderer.on(IPC.audioExclusionPort, ...)` e reposta ao main world com `window.postMessage({ channel: 'zoi:audio-exclusion-port' }, '*', event.ports)`; o servico do renderer escuta `window.addEventListener('message', ...)` filtrando por `channel`. Padrao documentado do Electron para sandbox: true (confirmado em src/main/index.ts linha 60). **REGRA DE ORDEM (anti-corrida)**: o main posta o port ANTES de o invoke `start()` resolver, e `postMessage` NAO bufferiza para listener ausente; portanto o servico do renderer DEVE registrar o listener de `message` ANTES de invocar `start()`, e o listener fica registrado durante toda a sessao de exclusao (tambem e ele que recebe os ports NOVOS dos re-forks da cascata). O `start()` do servico so resolve quando o par (invoke ok + port recebido) estiver completo, com timeout defensivo que degrada como `activation-failed`.

### 5.C Handoff de audio worker -> renderer (protocolo do MessagePort)

Mensagens do worker no port (unica direcao com dados; o renderer nao escreve no port):

```ts
// Frame PCM de 10 ms. `data` e um ArrayBuffer TRANSFERIDO (sem copia),
// Float32 interleaved LR, 48000 Hz, 2 canais, 480 amostras por canal.
{ type: 'pcm'; timestampUs: number; data: ArrayBuffer }
```

Status NAO trafega pelo port: o worker fala com o main por `parentPort` (`{ type: 'status', state, detail }` e `{ type: 'fatal', error }`) e o main repassa ao renderer por `audio-exclusion:status`. O port carrega exclusivamente PCM (fluxo quente separado do fluxo de controle).

Protocolo main -> worker (via `utilityProcess.postMessage`):

```ts
{ type: 'start'; config: {
    mode: 'process-exclusion' | 'endpoint-loopback'  // decidido pela cascata do MAIN (secao 2.2)
    excludedExecutables: string[]   // ['discord.exe','discordptb.exe','discordcanary.exe']
    excludedRootPids: number[]      // [process.pid do main] - arvore do proprio Zoi (dev e prod)
    sampleRate: 48000; channels: 2; frameMs: 10
  } }                                // port do renderer vai junto no transfer
{ type: 'stop' }
```

### 5.D Superficie N-API do addon (`native/zoi-audio-capture`, consumida SO pelo worker)

```ts
probe(): { ok: boolean; error: string | null }
// Tenta uma ativacao EXCLUDE no proprio PID e descarta: e o teste real de disponibilidade.

start(options: {
  mode: 'process-exclusion' | 'endpoint-loopback'
  excludedExecutables: string[]
  excludedRootPids: number[]
  sampleRate: number; channels: number; frameMs: number
}, onPcm: (data: ArrayBuffer, timestampUs: number) => void,
   onStatus: (state: string, detail: string) => void): number  // handle

stop(handle: number): void
```

Callbacks entregues via `Napi::ThreadSafeFunction`. Em `endpoint-loopback` as listas de exclusao sao ignoradas (loopback classico do endpoint padrao).

### 5.E Canais/contratos EXISTENTES tocados

- `capture:select-source` (request `CaptureSelectSourceRequest { sourceId, withAudio }`): **shape inalterado, nenhum campo novo**. Muda apenas o VALOR passado pelo renderer: com exclusao ativa, `withAudio: false` (o video vem do getDisplayMedia, o audio vem da track gerada); no caminho degradado, `withAudio: true` como hoje. `src/main/capture.ts` NAO muda.
- `LocalTransmission` (media-manager.ts linhas 24-32) ganha DOIS campos novos: `audioMode: 'excluded' | 'full-loopback' | 'none'` (para a UI decidir o toast de degradacao no start) e `stopAudioExclusion: (() => void) | null` (descarte do writer/port no stop). Nenhum campo existente muda; `TransmissionState` do mesh NAO muda (o protocolo de rede fica intacto, sem risco de cliente antigo, LESSONS sobre enum de protocolo).

## 5b. Dependencias e configuracao

- **Pacote novo (dependencia de producao, local)**: `zoi-audio-capture` em `native/zoi-audio-capture`, referenciado como `"zoi-audio-capture": "file:native/zoi-audio-capture"` em `dependencies`. Conteudo: `binding.gyp`, C++ (Node-API via `node-addon-api` ^8, dependencia do proprio pacote), `index.js` (carrega o `.node`; se o binario nao existir, exporta stub que devolve `probe -> { ok: false, error: 'native-binary-missing' }`, mantendo o app funcional degradado), `index.d.ts`.
- **Toolchain**: `node-gyp` (script `install` do pacote local), MSVC Build Tools + Python na maquina de build; ABI estavel por Node-API (sem electron-rebuild por versao). Script novo no package.json raiz: `"postinstall": "electron-builder install-app-deps"` (padrao electron-builder para deps nativas).
- **electron-builder.yml**: adicionar `asarUnpack: ["**/*.node"]` (o binario nativo nao carrega de dentro do asar). Nada mais muda; NSIS/auto-update intactos.
- **electron.vite.config.ts**: segunda entry do main: `'audio-capture-worker': resolve(__dirname, 'src/main/audio-capture-worker.ts')` (linhas 12-16).
- **Config por NOME apenas**: variavel de ambiente `ZOI_DISABLE_AUDIO_EXCLUSION` (kill-switch dev/teste; qualquer valor nao vazio desativa e forca o caminho degradado SEM toast de erro cru, com reason `disabled-by-env`).
- **Sem migracoes de banco**: o projeto nao tem banco de dados; nada a migrar. **Sem chave nova em settings.json** (RNF-07).

## 5c. Matriz de autorizacao

**Nao ha endpoints HTTP e nao ha distincao de papel**: a PRD (secao 4, nota sobre papeis, e RF-21) define comportamento identico para dono e membro; toda a logica e local a maquina do transmissor. Nao existe matriz papel x recurso a definir. O que existe e a fronteira de confianca IPC (renderer e tratado como semi-confiavel; o main valida):

| Canal | Chamador | Validacao no main |
|---|---|---|
| `audio-exclusion:start` | renderer (sem payload) | Nenhum input a validar; o main IGNORA qualquer argumento recebido e monta a config inteira sozinho (lista de executaveis fixa no main, PID raiz = `process.pid`); o renderer nao consegue influenciar QUAIS processos sao excluidos |
| `audio-exclusion:stop` | renderer (sem payload) | Idempotente; sem input |
| `audio-exclusion:status` / `audio-exclusion:port` | main -> renderer | n/a (saida) |
| mensagens do worker | utilityProcess (codigo nosso) | main valida `type` contra o conjunto conhecido antes de repassar; payload de status e reduzido aos campos tipados |

## 6. Divisao do trabalho

## Backend

Electron main + utilityProcess + addon nativo + integracao do pipeline de midia no renderer (o media-manager e "backend do renderer": pipeline, nao UI).

### Sprint 1 - Spike: veredito P2 executavel + esqueleto do addon + prova de empacotamento

- **Descricao**: transformar o veredito estatico da secao 2.1 em certeza executavel ANTES de implementar: probe real do WASAPI Process Loopback na maquina de dev, probe do `MediaStreamTrackGenerator` no renderer do Electron 43, e prova de que um addon nativo minimo atravessa `npm run dist` sem quebrar o NSIS. Se qualquer probe reprovar, PARAR e reportar ao orquestrador antes dos Sprints 2-4 (o plano B de cada probe esta na secao 3).
- **Deliverable**: pacote `native/zoi-audio-capture` compilando com `probe()` funcional; `SPIKE-RESULTS_app-audio-capture.md` no FEATURE_DIR com os resultados (probe WASAPI ok/erro + HRESULT, generator ok, dist ok, resultado informativo do `restrictOwnAudio`); instalador gerado com sucesso.
- **Risco**: alto (e o sprint que existe para reduzir risco).
- **Prerequisito**: nenhum.
- **Files**:
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\native\zoi-audio-capture\package.json` - create
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\native\zoi-audio-capture\binding.gyp` - create
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\native\zoi-audio-capture\src\addon.cc` - create (probe + stubs de start/stop)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\native\zoi-audio-capture\index.js` - create (carga do .node com fallback stub)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\native\zoi-audio-capture\index.d.ts` - create
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\package.json` - modify (dependencia `file:`, script `postinstall`)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\electron-builder.yml` - modify (asarUnpack, apos a chave `files` linha 10-12)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\scripts\audio-probe.mjs` - create (roda o probe via `electron` CLI e imprime JSON)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\.forge\ideas\app-audio-capture\SPIKE-RESULTS_app-audio-capture.md` - create

- **Feature 1.1** `[category: native-addon-spike]`
  - **Traces**: RF-07 (probe de disponibilidade), riscos NSIS e P2 da PRD (Questoes em Aberto 1 e 4).
  - **Steps**:
    1. Criar `native/zoi-audio-capture/package.json` (`name: zoi-audio-capture`, `main: index.js`, `scripts.install: node-gyp rebuild`, dependencia `node-addon-api`).
    2. `binding.gyp`: target `zoi_audio_capture`, sources `src/addon.cc`, defines `NAPI_DISABLE_CPP_EXCEPTIONS`, libs `mmdevapi.lib`, `ole32.lib` (ou LoadLibrary de `ActivateAudioInterfaceAsync` via `mmdevapi`), C++17.
    3. `addon.cc`: implementar `probe()` real: `ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK, ...)` com `AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS { TargetProcessId: GetCurrentProcessId(), ProcessLoopbackMode: PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE }`, `IAudioClient::Initialize` com WAVEFORMATEX explicito (48 kHz, 2ch, float32; `GetMixFormat` retorna E_NOTIMPL nesse modo, formato DEVE ser explicito), `Start` + `Stop`, devolver ok/HRESULT formatado. `start`/`stop` como stubs que lancam `not-implemented`.
    4. `index.js`: `try { module.exports = require('./build/Release/zoi_audio_capture.node') } catch { module.exports = stub }` (stub: `probe -> { ok: false, error: 'native-binary-missing' }`).
    5. Raiz: adicionar a dependencia `file:native/zoi-audio-capture` e `postinstall`; rodar `npm install` e confirmar build do addon.
    6. `scripts/audio-probe.mjs`: sobe Electron headless (sem janela) e roda: (a) `require('zoi-audio-capture').probe()` no main; (b) abre uma BrowserWindow oculta e avalia `typeof MediaStreamTrackGenerator` e `new MediaStreamTrackGenerator({ kind: 'audio' })` no renderer; (c) informativo: `getDisplayMedia` com `audio: { restrictOwnAudio: true }` sobre o handler `'loopback'` para registrar se o Chromium do Electron aceita o constraint. Imprimir JSON dos tres resultados.
    7. Rodar `npm run dist` e confirmar: build passa, `release/ZoiDaGoiaba-Setup.exe` gerado, `.node` presente em `app.asar.unpacked` (inspecionar o diretorio `release/win-unpacked/resources`).
    8. Escrever `SPIKE-RESULTS_app-audio-capture.md` com os resultados brutos e o veredito final por item.
  - **Edge cases**: baseline native-addon (maquina sem toolchain: install do pacote falha mas `index.js` stub mantem o app rodando; documentar no resultado) + especificos: probe em maquina sem sessao de audio ativa (deve dar ok mesmo assim: exclude do proprio PID nao depende de audio tocando); HRESULT `E_NOTIMPL` no GetMixFormat e esperado e nao e falha.
  - **Consumes**: n/a (main/worker; nao consome IPC).
  - **Done when**: `node scripts/audio-probe.mjs` imprime os tres resultados; `npm run dist` gera o instalador com o `.node` desempacotado; SPIKE-RESULTS escrito; typecheck/lint/vitest/e2e existentes verdes (nada do app foi tocado alem de package.json/builder).
  - **Commit**: `chore(audio): sonda o process loopback e prepara o esqueleto do addon nativo`
  - **Rollback**: reverter o commit; remover `native/` e as chaves novas de package.json/electron-builder.yml.

### Sprint 2 - Addon nativo completo: composicao include com exclusao de arvores

- **Descricao**: implementar o motor C++ da secao 2.1: rastreador de sessoes, classificador de arvores, capturas include por arvore permitida, mixer de cadencia fixa, modo endpoint-loopback e eventos de status.
- **Deliverable**: `zoi-audio-capture` com `start`/`stop` funcionais nos dois modos, entregando PCM continuo com Discord/Zoi ausentes do mix.
- **Risco**: alto (C++/COM/threading).
- **Prerequisito**: Sprint 1 aprovado (probe ok).
- **Files**:
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\native\zoi-audio-capture\src\addon.cc` - modify (superficie N-API completa, ThreadSafeFunction)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\native\zoi-audio-capture\src\session_tracker.h` / `session_tracker.cc` - create (enumeracao de sessoes, ancestralidade, classificacao)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\native\zoi-audio-capture\src\capture_engine.h` / `capture_engine.cc` - create (capturas process-loopback e endpoint-loopback)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\native\zoi-audio-capture\src\mixer.h` / `mixer.cc` - create (soma float com clamp, cadencia 10 ms)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\native\zoi-audio-capture\binding.gyp` - modify (sources novos)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\native\zoi-audio-capture\index.d.ts` - modify (tipos finais da secao 5.D)

- **Feature 2.1** `[category: native-addon]` Motor de captura com exclusao por construcao
  - **Traces**: RF-01, RF-02, RF-04, RF-05, RF-06, RF-17, RNF-01.
  - **Steps**:
    1. `session_tracker`: enumerar sessoes do endpoint de render padrao (`IMMDeviceEnumerator::GetDefaultAudioEndpoint(eRender, eConsole)` -> `IAudioSessionManager2` -> `IAudioSessionEnumerator`), extrair PID de cada `IAudioSessionControl2` (ignorar sessoes de sistema, PID 0).
    2. Classificacao (deteccao, NUNCA escolha de ancora): para cada PID de sessao, resolver a cadeia de ancestrais via `CreateToolhelp32Snapshot` (PID pai + `GetProcessTimes` para invalidar pai reciclado mais novo que o filho) e o executavel de cada elo via `QueryFullProcessImageNameW` (basename lowercase). PID PROIBIDO se ele mesmo ou qualquer ancestral tem basename em `excludedExecutables` OU PID em `excludedRootPids` (cobre o Zoi em dev, onde o exe e `electron.exe`, e em prod `ZoiDaGoiaba.exe`; a exclusao por PID raiz e a autoritativa para o Zoi). Sessao proibida jamais ganha captura.
    3. Ancora de include = o PROPRIO PID da sessao (secao 2.1, regra central): antes de abrir `INCLUDE_TARGET_PROCESS_TREE` na sessao permitida P, varrer a subarvore atual de P (snapshot Toolhelp32); se houver processo proibido dentro dela, NAO abrir (skip com log no detail). Nunca ancorar em ancestral de P.
    4. Dedup por parentesco entre SESSOES: se a sessao permitida A e ancestral da sessao permitida B, abrir include SOMENTE em A (a arvore de A ja cobre B; abrir B duplicaria o audio). Registrar o vinculo para a reconciliacao reabrir B se a sessao de A morrer.
    5. `capture_engine`: uma captura por ancora aprovada nos passos 2-4, formato explicito 48 kHz/2ch/float32, `IAudioCaptureClient` em loop event-driven por captura.
    6. `mixer`: thread de cadencia com waitable timer de 10 ms; a cada tique, drena os buffers de cada captura, soma em float com clamp [-1, 1], emite SEMPRE um frame de 480x2 amostras (silencio se nada chegou) com `timestampUs` acumulado; entrega via ThreadSafeFunction (`onPcm`).
    7. Dinamica (tres redes, secao 2.1 passo 6): (i) `IAudioSessionNotification::OnSessionCreated`: sessao nova permitida e nao coberta -> abre include com os passos 2-4; sessao nova PROIBIDA -> fecha imediatamente qualquer include cuja subarvore contenha aquele PID; (ii) vigia de processos proibidos a cada 1 s: processo proibido detectado como descendente de uma ancora incluida -> fecha o include na hora e mantem fechado enquanto o descendente viver; (iii) reconciliacao a cada 5 s: re-enumera, abre includes que faltam, fecha capturas de sessoes mortas; trocar de endpoint padrao (`IMMNotificationClient::OnDefaultDeviceChanged`) dispara reconciliacao imediata.
    8. Falhas: erro fatal do motor (COM morreu, todas as capturas falhando) -> `onStatus('failed', detalhe)` e o motor para; falha parcial (uma captura nao abre) -> loga no detalhe, segue com as demais.
    9. `endpoint-loopback` mode: `IAudioClient::Initialize(AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, ...)` no endpoint padrao, mesma cadencia e mesmo callback (usado pela cascata de degradacao do main no Sprint 3).
    10. `stop(handle)`: derruba threads, fecha COM, libera ThreadSafeFunctions (idempotente).
  - **Edge cases**: baseline native-addon (COM apartment por thread; HRESULTs sempre logados no detail; nenhuma chamada bloqueante no thread do N-API) + especificos: Discord ja aberto ANTES do start (classificado na enumeracao inicial; nenhum include abre cobrindo ele, incluindo `explorer.exe` com sessao de sons do sistema, bloqueado pela pre-checagem de subarvore); Discord abre DEPOIS (OnSessionCreated do proprio Discord classifica proibido e fecha includes que o cubram; vigia de 1 s fecha includes assim que o PID proibido aparece como descendente); Discord lancado a partir de um app cuja sessao ja estava incluida (vigia de 1 s fecha o include coberto e mantem fechado); duas variantes do Discord abertas ao mesmo tempo (ambos os basenames estao na lista); duas sessoes com relacao ancestral-descendente (dedup do passo 4: so a mais alta abre; morte da ancestral reabre a descendente na reconciliacao); processo permitido que morre (captura fecha na reconciliacao, sem crash); sessao com PID de processo ja finalizado (skip); nenhum processo permitido tocando (frames de silencio continuam saindo, transmissao nao fica "sem track").
  - **Consumes**: n/a (superficie N-API da secao 5.D, lado implementador).
  - **Done when**: teste manual com o probe estendido (script do Sprint 1 atualizado): tocando audio num player qualquer + Discord com som, o PCM entregue contem o player e NAO contem o Discord; fechar/reabrir o Discord durante a captura nunca o traz de volta; `stop` nao vaza handle (rodar 10 ciclos start/stop).
  - **Commit**: `feat(audio): addon nativo de captura com exclusao das arvores do discord e do zoi`
  - **Rollback**: reverter o commit (o app ainda nao consome o addon; zero impacto de runtime).

### Sprint 3 - Worker no utilityProcess + contrato IPC + preload

- **Descricao**: ligar o addon ao app: worker `audio-capture-worker` fork-ado pelo main, handshake de MessagePort ate o renderer, canais IPC da secao 5.A, probe/kill-switch e cascata de degradacao runtime.
- **Deliverable**: `window.zoi.audioExclusion.{start,stop,onStatus}` funcionando ponta a ponta com PCM chegando ao renderer.
- **Risco**: medio.
- **Prerequisito**: Sprint 2.
- **Files**:
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\main\audio-exclusion.ts` - create (orquestrador: probe, fork, ports, cascata, relay de status)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\main\audio-capture-worker.ts` - create (entry do utilityProcess: carrega o addon, obedece start/stop, empurra PCM no port)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\shared\ipc.ts` - modify (constantes `IPC` linhas 4-15; tipos da secao 5.A; `ZoiApi` linhas 93-126)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\main\ipc-handlers.ts` - modify (`registerIpcHandlers` linha 15: handlers novos; recebera um getter da BrowserWindow como o updater ja recebe, ver `registerUpdaterIpc(() => mainWindow)` em src/main/index.ts linha 120)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\main\index.ts` - modify (bloco `whenReady` linhas 115-139: passar o getter da janela; encerrar o worker no `window-all-closed` linhas 141-143)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\preload\index.ts` - modify (objeto `api` linhas 15-53: bloco `audioExclusion`; listener do port)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\electron.vite.config.ts` - modify (input do main linhas 12-16)

- **Feature 3.1** `[category: ipc]` Orquestracao main + worker + port
  - **Traces**: RF-03, RF-07, RF-08 (metade de deteccao/degradacao), RNF-01, RNF-07.
  - **Steps**:
    1. `audio-exclusion.ts`: `startAudioExclusion(getWindow): Promise<AudioExclusionStartResult>`: (a) se `process.env['ZOI_DISABLE_AUDIO_EXCLUSION']` -> `{ mode: 'unavailable', reason: 'disabled-by-env' }`; (b) checar build do SO (parse de `os.release()`, exigir >= 10.0.20348) -> `os-unsupported`; (c) `require('zoi-audio-capture')` e `probe()` -> `addon-load-failed` / `activation-failed`; (d) `utilityProcess.fork(join(__dirname, 'audio-capture-worker.js'))` -> `worker-spawn-failed`; (e) `MessageChannelMain`: port1 vai no `postMessage({ type: 'start', config })` ao worker (config com `mode: 'process-exclusion'` neste caminho feliz), port2 vai ao renderer via `getWindow().webContents.postMessage(IPC.audioExclusionPort, { channel: 'zoi:audio-exclusion-port' }, [port2])`; (f) devolver `{ mode: 'process-exclusion', sampleRate: 48000, channels: 2 }`. Config montada 100% no main: `mode` decidido pela cascata, `excludedExecutables` fixo, `excludedRootPids: [process.pid]`.
    2. Cascata de runtime no main: worker emite `{ type: 'status', state: 'failed' }` ou `exit` inesperado -> tentar UMA vez re-fork em modo `process-exclusion`; se falhar de novo -> re-fork em `endpoint-loopback` (degradacao) e enviar `audio-exclusion:status { state: 'degraded-full-loopback' }`; se nem o endpoint-loopback subir -> `{ state: 'failed' }`. Cada re-fork refaz o handshake do port com o renderer (mesma sequencia do passo 1e; o servico do renderer aceita port novo a qualquer momento, ver Sprint 4).
    3. `stopAudioExclusion()`: `postMessage({ type: 'stop' })` + `kill()` do worker apos timeout curto; idempotente; chamado tambem em `window-all-closed`.
    4. `audio-capture-worker.ts`: `process.parentPort.on('message', ...)`; no `start`, chama `addon.start(...)` com `onPcm` repassando `{ type: 'pcm', timestampUs, data }` no port do renderer com transfer do ArrayBuffer; `onStatus` repassando ao parentPort. Nenhum trabalho alem de repassar (o peso fica nas threads do addon).
    5. `ipc-handlers.ts`: `ipcMain.handle(IPC.audioExclusionStart, ...)` e `...Stop` delegando ao modulo; relay de status via `getWindow()?.webContents.send(IPC.audioExclusionStatus, status)`.
    6. `preload/index.ts`: bloco `audioExclusion` (secao 5.B) + listener de `IPC.audioExclusionPort` repostando ao main world com os ports.
    7. `electron.vite.config.ts`: entry `audio-capture-worker`. Confirmar que `out/main/audio-capture-worker.js` sai no build e no dist.
  - **Edge cases**: baseline ipc (renderer nao influencia a config de exclusao; mensagens do worker validadas por `type` antes do relay; handlers nunca lancam erro cru ao renderer) + especificos: dois `start` seguidos sem `stop` (o segundo derruba o worker anterior antes de subir o novo: uma captura por vez, espelhando a regra de transmissao unica); janela fechada durante captura ativa (stop no `window-all-closed`); start durante e2e (`ZOI_DISABLE_AUDIO_EXCLUSION` -> caminho `unavailable` deterministico); worker que morre no intervalo entre start e primeiro PCM (cascata cobre).
  - **Consumes**: n/a (define os contratos da secao 5).
  - **Done when**: com um harness manual (devtools), `window.zoi.audioExclusion.start()` devolve `process-exclusion`, o renderer recebe o port e frames `pcm` a ~100/s; matar o worker no Gerenciador de Tarefas dispara a cascata e o evento `degraded-full-loopback` chega ao renderer; `stop()` encerra tudo; typecheck node+web verdes.
  - **Commit**: `feat(audio): worker de captura no utility process e contrato ipc da exclusao`
  - **Rollback**: reverter o commit; canais novos somem, nada mais os consome ainda.

### Sprint 4 - Integracao no pipeline de midia (media-manager) + avisos de degradacao

- **Descricao**: a transmissao com audio passa a usar a exclusao: track gerada entra na stream local unica; degradacao no start e em runtime vira toast discreto; ciclo start/stop/switch rearma tudo.
- **Deliverable**: transmitir com audio exclui Discord/Zoi de ponta a ponta; falhas degradam com aviso; fallbacks de direcao intactos.
- **Risco**: medio-alto (toca o coracao do pipeline; mitigado pela track unica).
- **Prerequisito**: Sprint 3. (Independente dos Sprints 5-6 de frontend.) NOTA DE DRIFT DE LINHAS: os Sprints 5-6 podem ter sido implementados ANTES deste (sao independentes e priorizados) e tambem editam `RoomScreen.tsx`; se ja tiverem aterrissado, os numeros de linha citados aqui (91-119 etc.) estarao deslocados: o agente deve localizar os pontos de edicao PELO CONTEUDO (funcao `startTransmission`, bloco do toast de audio, hooks no topo do componente), nao pelos numeros.
- **Files**:
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\audio-exclusion.ts` - create (cliente: recebe port, cria a track `MediaStreamTrackGenerator`, alimenta, expoe interface injetavel)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\types\insertable-streams.d.ts` - create (declaracao minima de `MediaStreamTrackGenerator` e `AudioData` para o tsconfig.web)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\media-manager.ts` - modify (`LocalTransmission` linhas 24-32; construtor linhas 173-177: injecao do cliente; `startTransmission` linhas 229-297; `stopTransmission` linhas 300-314)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\RoomScreen.tsx` - modify (`startTransmission` linhas 91-119: toast de degradacao no start; novo `useEffect` de assinatura de `onStatus` para toasts de runtime)

- **Feature 4.1** `[category: media-pipeline]` Track de audio com exclusao na stream local unica
  - **Traces**: RF-01, RF-03, RF-08, RF-16, RF-17, RNF-01, RNF-02, RNF-06, RNF-07.
  - **Steps**:
    1. `audio-exclusion.ts` (renderer): interface `AudioExclusionClient { start(): Promise<AudioExclusionSession | null>; }` com `AudioExclusionSession { track: MediaStreamTrack; stop(): void }`. Implementacao real, NA ORDEM (regra anti-corrida da secao 5.B): (a) registrar PRIMEIRO o listener `window.addEventListener('message', ...)` filtrando `channel === 'zoi:audio-exclusion-port'` (o port pode chegar antes de o invoke resolver; o listener permanece registrado durante toda a sessao e aceita port NOVO a qualquer momento para os re-forks da cascata); (b) so entao chamar `window.zoi.audioExclusion.start()`; se `unavailable`, remover o listener e devolver `null` com o reason acessivel (retornar `{ session: null, reason }` para o chamador montar o toast); (c) se ok, resolver quando invoke E port estiverem completos (timeout defensivo curto -> tratar como `activation-failed`); (d) criar `MediaStreamTrackGenerator({ kind: 'audio' })` e, para cada mensagem `pcm`, escrever `new AudioData({ format: 'f32', sampleRate: 48000, numberOfFrames: 480, numberOfChannels: 2, timestamp: timestampUs, data })` no writer. `stop()` fecha o writer, remove listeners e chama `window.zoi.audioExclusion.stop()`.
    2. `media-manager.ts`: construtor ganha parametro injetavel `audioExclusion: AudioExclusionClient` (default: implementacao real; testes injetam stub, mesmo padrao do `createPullStream` linha 176).
    3. `startTransmission` (linha 229): quando `options.withAudio`, tentar `this.audioExclusion.start()` ANTES de `window.zoi.capture.selectSource` (linha 233). Caso `process-exclusion`: `selectSource({ sourceId, withAudio: false })`, `getDisplayMedia` com `audio: false` (linha 246), depois `stream.addTrack(session.track)`; `hasAudio = true`; `audioMode = 'excluded'`; `stopAudioExclusion = session.stop`. Caso `null`/falha: fluxo ATUAL intacto (`withAudio: true`, `audio: options.withAudio`), `audioMode = 'full-loopback'`. Sem audio pedido: `audioMode = 'none'`. Os campos novos entram no objeto `transmission` (linha 271-279). IMPORTANTE: o announce (linha 283) e os `callPeer` (linha 291-293) NAO mudam; a track ja esta na stream antes deles.
    4. Falha do `getDisplayMedia` com exclusao ja armada: `session.stop()` antes de relancar `CaptureFailedError` (nao vazar worker armado).
    5. `stopTransmission` (linha 300): apos parar as tracks (linha 310), chamar `transmission.stopAudioExclusion?.()`. `switchSource` (linhas 317-320) nao muda: stop + start ja rearma (RF-12/RF-14).
    6. `teardown` (linha 734): tambem chama `stopAudioExclusion` da local, se houver.
    7. `RoomScreen.tsx` `startTransmission` (linhas 91-119): apos sucesso, se `choice.withAudio && transmission.audioMode === 'full-loopback'` -> `pushToast('warning', 'Nao foi possivel isolar o audio do Discord; a transmissao segue com o som do sistema inteiro.')`. O toast existente de "sem audio" (linhas 100-105) permanece para o caso de o loopback degradado tambem falhar.
    8. `RoomScreen.tsx`: `useEffect` que assina `window.zoi.audioExclusion.onStatus` enquanto `localTx?.audioMode === 'excluded'`: `degraded-full-loopback` -> `pushToast('warning', 'A captura de audio por aplicativo falhou; a transmissao segue com o som do sistema inteiro.')`; `failed` -> `pushToast('warning', 'O audio da transmissao caiu; pare e transmita de novo para restaurar o som.')`. Cada estado gera no maximo UM toast por transmissao (guard por ref).
  - **Edge cases**: baseline media-pipeline (stream unica compartilhada entre chamada direta e pull; nenhuma renegociacao; tracks sempre paradas no stop) + especificos: exclusao armada mas usuario cancela o picker do SO (TTL de 30 s do armed selection, capture.ts linhas 36-40: o `session.stop()` do passo 4 cobre); transmitir sem audio nao arma nada; duas transmissoes seguidas rapidas (stop sempre antes do start novo, garantido por `TransmissionInProgressError` linha 230); status event chegando APOS o stop (ignorado: guard por `localTx`); e2e com `ZOI_DISABLE_AUDIO_EXCLUSION` (caminho full-loopback identico ao atual: `expectNoDirectionFallbacks` continua representativo).
  - **Consumes** (verbatim da secao 5):
    - `audio-exclusion:start` -> `AudioExclusionStartResult`
    - `audio-exclusion:stop` -> `void`
    - `audio-exclusion:status` -> `AudioExclusionStatus`
    - `audio-exclusion:port` -> mensagem `{ channel: 'zoi:audio-exclusion-port' }` + MessagePort
    - Port: `{ type: 'pcm'; timestampUs: number; data: ArrayBuffer }`
  - **Done when**: teste real na maquina de dev: transmitir com audio + Discord tocando voz -> espectador (segunda instancia) nao ouve o Discord e ouve o resto; matar o worker degrada com toast e o som continua (loopback total); parar/retransmitir/trocar fonte rearma; typecheck, lint, vitest e `npm run test:e2e` verdes (incluindo `expectNoDirectionFallbacks`).
  - **Commit**: `feat(audio): transmissao usa a captura com exclusao e degrada com aviso`
  - **Rollback**: reverter o commit; a transmissao volta ao loopback total atual (comportamento de hoje), sem residuo.

## Frontend

Renderer/React/CSS. Identidade visual, tokens, componentes e CONTRATO DE MOTION: seguir `UISPEC_app-audio-capture.md` (secoes 3-7) como fonte unica; este SPEC nao repete o contrato visual, apenas o referencia. **INDEPENDENCIA EXPLICITA: os Sprints 5 e 6 nao dependem dos Sprints 2-4 (apenas de codigo ja existente no repo) e podem ser implementados e entregues ANTES do caminho de audio nativo. Eles sao a correcao visivel do loop ensurdecedor (segundo problema da PRD) e nao ficam refens do trabalho nativo. Se o audio atrasar, estes dois sprints ja valem release.**

### Sprint 5 - Bloqueio de auto-visualizacao (guard em profundidade)

- **Descricao**: o transmissor nunca ve nem ouve a propria transmissao por nenhum caminho: guard na selecao (store), no render (RoomScreen) e no componente (StreamThumbnail). Inclui o selector `viewersOf` que o card do Sprint 6 consome. Nesta sprint o "card" e um placeholder minimo (`div` com `data-testid="tx-status-card"` e o texto "Transmissao iniciada"), substituido pelo componente final no Sprint 6, para que o guard seja verificavel de imediato.
- **Deliverable**: clicar/selecionar a propria transmissao e impossivel; tile proprio mostra o placeholder; PiP/fullscreen proprios inalcancaveis; assistir terceiros intacto.
- **Risco**: baixo.
- **Prerequisito**: nenhum (independente do backend).
- **Files**:
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\store\room-store.ts` - modify (`selectTransmission` linhas 40-47)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\core\room-state.ts` - modify (novo export `viewersOf` apos `nicknameOf`, linha 268-270)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\RoomScreen.tsx` - modify (`selected` linha 67; bloco do player linhas 221-235; strip linhas 236-257; grid linhas 271-296)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\StreamThumbnail.tsx` - modify (attach linhas 36-44; onClick linha 49)

- **Feature 5.1** `[category: ui-guard]` Guard de selecao e de render
  - **Traces**: RF-09, RF-11 (selector), RF-12, RF-13, RF-14, RF-15, RF-16, RF-21, RNF-02.
  - **Steps**:
    1. `room-store.ts` `selectTransmission` (linha 40): no inicio, `const { room } = useRoomStore.getState()`; se `txId !== null && room.transmissions[txId]?.peerId === room.selfPeerId`, retornar sem setar nada (nem `selectedTxId`, nem `session.watch`).
    2. `room-state.ts`: apos `nicknameOf` (linha 268-270), exportar `viewersOf(state: RoomState, txId: string): number` contando `Object.values(state.watching)` iguais ao txId (mesma fonte de `watchingLabels`, RoomScreen linhas 55-65).
    3. `RoomScreen.tsx`: derivar `const isSelfSelected = selected !== null && selected.peerId === room.selfPeerId`. No bloco do player (linha 221): se `isSelfSelected`, renderizar o placeholder do card em area cheia no lugar do `<PlayerView>` (defensivo; com o passo 1 isso nao deve ocorrer).
    4. Grid (linhas 272-294): quando `transmission.peerId === room.selfPeerId`, renderizar o placeholder do card na celula (mesmo wrapper `z-item-enter` com `--z-delay`), em vez de `StreamThumbnail`.
    5. Strip (linhas 238-255): quando `transmission.peerId === room.selfPeerId`, renderizar o placeholder compacto na celula `z-strip__item`, em vez de `StreamThumbnail`.
    6. `StreamThumbnail.tsx` (cinto de seguranca): `onClick={() => { if (!isSelf) onSelect(txId) }}` (linha 49) e early-return no `useEffect` de attach quando `isSelf` (linha 36-44), garantindo que NENHUM uso futuro do componente com `isSelf` mostre ou selecione a propria stream.
    7. Confirmar os cenarios de ciclo de vida: parar (placeholder some junto com a transmissao: `transmissions` do roster ja remove o proprio tx, room-state linhas 1369-1384); retransmitir e trocar fonte (novo txId cai nos mesmos guards por peerId).
  - **Edge cases**: baseline ui-guard (guard por `peerId`, nunca por txId cacheado; comportamento identico para dono e membro; zero mudanca para espectadores) + especificos: so a propria transmissao existe (grid mostra apenas o placeholder; o ramo `.z-empty` linha 259 nao dispara, correto); transmissor assistindo outro enquanto transmite (player mostra o outro; strip mostra o placeholder proprio no lugar do tile proprio); `selectedTxId` apontando para o proprio tx por estado legado (camada 3 do render cobre); `room.watching` sem entradas (viewersOf devolve 0).
  - **Consumes**: nenhum canal IPC (feature puramente de renderer).
  - **Done when**: manual com 2 instancias: transmissor clica no proprio tile e NADA abre (placeholder permanece); PiP/fullscreen inalcancaveis para a propria; espectador ve tudo como antes; typecheck/lint/vitest verdes.
  - **Commit**: `fix(ui): transmissor nunca ve nem ouve a propria transmissao`
  - **Rollback**: reverter o commit (volta ao comportamento atual com o bug de loop).

### Sprint 6 - TransmissionStatusCard com o contrato de motion do UISPEC

- **Descricao**: substituir o placeholder do Sprint 5 pelo card definitivo: logo com bounce, titulo com fade/slide, detalhes escalonados, contagem animada, variantes `tile` (grid/area cheia) e `strip` (compacta). Motion e identidade EXATAMENTE conforme UISPEC secoes 6.2-6.4 (keyframes, duracoes, easing easeOutBack `cubic-bezier(0.34, 1.56, 0.64, 1)` como excecao unica, stagger via `.z-item-enter` + `--z-delay`, logo `logo-goiaba.png` importada do mesmo caminho de `DoorsTransition.tsx` linha 5 e dimensionada via CSS).
- **Deliverable**: card final com motion de alto nivel, sem custo de fps, respeitando `prefers-reduced-motion`.
- **Risco**: baixo.
- **Prerequisito**: Sprint 5.
- **Files**:
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\TransmissionStatusCard.tsx` - create
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\theme.css` - modify (secao de animacoes: novos keyframes apos `z-slide-left` linhas 229-239)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\components.css` - modify (bloco `z-status-card` ao final, apos linha 741)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\RoomScreen.tsx` - modify (trocar os tres placeholders do Sprint 5 pelo componente; memo do `viewerCount`)

- **Feature 6.1** `[category: ui-component-motion]` Card de status persistente
  - **Traces**: RF-10, RF-11, RF-12, RF-18, RF-19, RF-20, RNF-04, RNF-05, RNF-08, RNF-09.
  - **Steps**:
    1. `TransmissionStatusCard.tsx`: `memo(function TransmissionStatusCard(props))` com props `{ txId: string; sourceLabel: string; hasAudio: boolean; viewerCount: number; variant: 'tile' | 'strip' }`. Sem `<video>`, sem stream, sem efeito continuo.
    2. Estrutura `tile`: container `z-status-card` (base visual `.z-empty`/`.z-reconnect` conforme UISPEC secao 4) com: `<img>` da logo (`z-status-card__logo`, 72-96px via CSS, `alt=""` `aria-hidden`), titulo "Transmissao iniciada" (`z-status-card__title`), linha de detalhes escalonados (`z-status-card__detail` x3: fonte `sourceLabel`; "com audio"/"sem audio"; contagem "N espectadores" com plural correto: "1 espectador"), e texto auxiliar curto (`z-status-card__hint`): "Voce nao assiste a propria transmissao; isso evita o retorno de audio.". `role="status"`, `data-testid="tx-status-card"`, contagem com `data-testid="tx-status-viewers"`.
    3. Motion de entrada (dispara SO na montagem; o mount e keyed por `txId` nos tres pontos do RoomScreen, entao troca de fonte = entrada nova): logo com keyframe novo `z-status-bounce-in` (scale 0.7 -> 1 + opacity, 480ms, `animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1)`, forma simples recomendada pelo UISPEC 6.2); titulo com `z-fade-rise` 220ms delay 160ms `var(--ease)`; detalhes com `.z-item-enter` + `--z-delay: 220 + i * 60ms` inline (mecanismo de stagger existente, theme.css linha 254-257).
    4. Contagem animada (RF-19): `<span key={viewerCount}>` dentro de wrapper `overflow: hidden` de 1 linha; keyframe `z-count-roll-in` (translateY(6px) -> 0 + opacity, 120ms `var(--dur-fast)` `var(--ease)`), conforme UISPEC 6.2 fase 2 (variante simples de entrada unica; sem animar o valor que sai, mantendo o padrao do app de nao animar saidas, UISPEC 6.2 fase 3).
    5. Variante `strip`: layout compacto horizontal (logo 24px + "sua transmissao" + contagem com o mesmo span animado), entrada apenas `z-fade-rise` padrao, sem stagger.
    6. CSS novo em components.css (apos linha 741): SOMENTE transform/opacity nos keyframes/animacoes; sem `filter`, sem `backdrop-filter`, sem box-shadow animado; `will-change` NAO fica residente (nao usar, ou remover via `animationend`); sem `!important` (a regra global de `prefers-reduced-motion` de theme.css linhas 70-76 zera as duracoes hardcoded automaticamente).
    7. Keyframes novos em theme.css na secao de animacoes (apos linha 239, fim do bloco de `z-slide-left`): `z-status-bounce-in`, `z-count-roll-in`.
    8. `RoomScreen.tsx`: `const viewerCount = useMemo(() => (localTx ? viewersOf(room, localTx.txId) : 0), [room.watching, localTx])` (usando `viewersOf` do Sprint 5); substituir os tres placeholders: grid -> `variant="tile"`, area cheia defensiva -> `variant="tile"`, strip -> `variant="strip"`; props vindas de `localTx` (`sourceLabel`, `hasAudio`) com fallback para o `TransmissionState` do roster quando `localTx` ainda nao refletiu (`refreshLocalTransmission` e sincrono apos start, room-store linha 88-90; fallback cobre corrida de primeiro render).
  - **Edge cases**: baseline ui-component-motion (`prefers-reduced-motion` verificado manualmente com a config do SO; nenhuma animacao em loop; memo obrigatorio) + especificos: `room.watching` vazio no primeiro render (mostrar "0 espectadores", nunca vazio, UISPEC secao 7 Don't); contagem muda durante a animacao de entrada (span keyed anima independente); troca de fonte com labels longos (ellipsis no `sourceLabel`, mesmo tratamento visual da strip/TransmittingBar); transmissao sem audio (detalhe "sem audio" presente, card identico no resto).
  - **Consumes**: nenhum canal IPC (dados 100% locais: `localTx` + `room.watching`).
  - **Done when**: manual com 2 instancias: entrada do card mostra logo com bounce + titulo suave + detalhes escalonados; espectador entrando/saindo anima a contagem em tempo real (AC-04/AC-18); com `prefers-reduced-motion` tudo aparece instantaneo; fps do video sem queda perceptivel durante a entrada (comparacao com a animacao desativada); typecheck/lint/vitest verdes.
  - **Commit**: `feat(ui): card de status da transmissao com motion e logo`
  - **Rollback**: reverter o commit (o placeholder do Sprint 5 volta; o guard continua integro).

### Sprint 7 - Testes (DEFINIDOS aqui, nao escritos: ultimo sprint, executado pelo agente de testes)

- **Descricao**: cobrir guard, card, selector, integracao do media-manager e caminho degradado. Regras do projeto: `tests/unit` e typechecado pelo projeto WEB sem types de node: NAO importar `src/main/*` nem o addon em unit; e2e Playwright `_electron` com instancias isoladas; ao chegar na Room, aguardar o overlay `.z-doors` (DoorsTransition) DESANEXAR antes de asserts/screenshots (licao real de execucao recente).
- **Deliverable**: suites novas + suite inteira verde (`npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run test:e2e`).
- **Risco**: baixo.
- **Prerequisito**: Sprints 4, 5 e 6.
- **Files**:
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\room-state.test.ts` - modify (bloco `viewersOf`)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\room-store.test.ts` - create (guard de selecao)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\media-manager.test.ts` - modify (exclusao injetada; 811 linhas hoje, factory `pullingManager` linhas 224-241 como referencia de injecao)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\audio-exclusion-client.test.ts` - create (servico do renderer com port fake e generator fake)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\e2e\self-view-block.spec.ts` - create
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\e2e\helpers\zoi-app.ts` - modify (`launchInstance` linhas 90-97: adicionar `ZOI_DISABLE_AUDIO_EXCLUSION: '1'` ao env)

- **Feature 7.1** `[category: tests]` Definicao das suites
  - **Traces**: RNF-02, RNF-03, RNF-07 (AC-21), mais a verificacao automatizada de RF-09/RF-10/RF-11/RF-13/RF-14.
  - **Steps** (cada item = cenarios a implementar):
    1. `room-state.test.ts` + `viewersOf`: contagem 0 sem watchers; conta apenas o txId pedido; ignora `null`; sobe/desce com WATCHING_UPDATE aplicado via `reduce` (reaproveitar os builders de estado existentes do arquivo).
    2. `room-store.test.ts`: com `room.transmissions` contendo tx proprio e tx remoto (estado montado direto via `useRoomStore.setState`), `selectTransmission(txProprio)` NAO altera `selectedTxId` nem agenda `session.watch` (mock de timer); `selectTransmission(txRemoto)` funciona; `selectTransmission(null)` funciona.
    3. `media-manager.test.ts` (novos casos, com `AudioExclusionClient` stub injetado + `window.zoi` fake ja usado pelo arquivo): (a) start com audio e stub devolvendo session: `selectSource` chamado com `withAudio: false`, track do stub presente na stream, `audioMode === 'excluded'`, `hasAudio === true`; (b) stub devolvendo null: `selectSource` com `withAudio: true`, `audioMode === 'full-loopback'`; (c) stop chama `session.stop`; (d) switchSource rearma (stub chamado 2x); (e) getDisplayMedia falhando com exclusao armada chama `session.stop` (sem vazamento); (f) pull continua respondendo com a MESMA stream (garante RNF-06: assert de identidade da stream no `answerPull`, cenario ja coberto pelo `pullingManager`, estendido para stream com track do stub).
    4. `audio-exclusion-client.test.ts`: com `MediaStreamTrackGenerator` fake global e port simulado (`MessageChannel` do jsdom): start resolve apos o port chegar; mensagens `pcm` viram writes no writer fake (contagem/formato); port novo substitui o antigo sem quebrar; stop fecha writer e chama `window.zoi.audioExclusion.stop`.
    5. `self-view-block.spec.ts` (e2e, 2 instancias, padrao de `moderation-session.spec.ts`): dono cria sala, membro entra (aguardar `.z-doors` desanexar nas DUAS instancias antes de qualquer assert); dono transmite SEM audio (picker via testids `capture-source`/`picker-confirm`); asserts: (a) no dono, `tx-status-card` visivel e NENHUM `stream-thumb` proprio clicavel que abra `player` (clicar no card nao monta `[data-testid="player"]`); (b) no membro, `stream-thumb` do dono presente e abrivel normalmente (player monta); (c) membro assiste -> `tx-status-viewers` do dono atinge "1 espectador"; membro volta -> "0 espectadores"; (d) dono para a transmissao -> card some e `.z-empty` volta; (e) dono retransmite -> card volta (RF-14); (f) AC-21: ler o `settings.json` do perfil isolado (dentro do `userDataDir` da instancia) antes e depois e assertar que nenhuma chave nova de audio apareceu; (g) `expectNoDirectionFallbacks([owner, guest])` ao final (RNF-02).
    6. `zoi-app.ts`: incluir `ZOI_DISABLE_AUDIO_EXCLUSION: '1'` no env do `launchInstance` (linha 95) para os e2e serem deterministas independentemente do hardware de audio.
    7. Smoke existente (`smoke-session.spec.ts`) permanece intocado e obrigatorio verde.
  - **Edge cases**: baseline tests (sem sleeps cegos: usar expects com polling do Playwright; perfis isolados; sem dependencia de ordem) + especificos: contagem no e2e depende do debounce do WATCHING_UPDATE (`WATCHING_UPDATE_DEBOUNCE_MS`): usar timeout folgado no expect; e2e roda com o kill-switch, entao NENHUM assert pode depender do worker nativo.
  - **Consumes**: contratos da secao 5 apenas via stubs/fakes (unit) e kill-switch (e2e).
  - **Done when**: todos os cenarios acima implementados; `npm run typecheck && npm run lint && npx vitest run && npm run test:e2e` verdes.
  - **Commit**: `test(audio): cobre exclusao de audio, bloqueio de auto-visualizacao e card de status`
  - **Rollback**: reverter o commit (testes apenas).

## 8. Matriz de cobertura do PRD

| RF/RNF | Sprint.Feature | Como e satisfeito |
|---|---|---|
| RF-01 | 2.1 + 4.1 | Composicao include exclui as arvores Discord (3 variantes) e Zoi por construcao; track gerada substitui o loopback na stream local |
| RF-02 | 2.1 | `INCLUDE_TARGET_PROCESS_TREE` + classificacao por ancestralidade cobre arvore inteira (raiz + filhos) |
| RF-03 | 3.1 + 4.1 | Sem toggle/UI/persistencia; exclusao sempre tentada quando `withAudio`; nada escrito em settings |
| RF-04 | 2.1 | Lista de exclusao so tem executaveis desktop do Discord; navegador fica fora (limitacao documentada, AC-16) |
| RF-05 | 2.1 | Sessoes do Discord morrem sem afetar o mixer; transmissao segue; falha real cai na cascata do 3.1 |
| RF-06 | 2.1 | Discord reaberto/processos novos NUNCA entram no include-set; sessao proibida nova fecha event-driven os includes que a cubram + vigia 1 s; notificacao + varredura 5 s cobrem novos apps permitidos; sem vazamento nem mudez silenciosa |
| RF-07 | 3.1 + 4.1 | Probe (env, build do SO, addon, ativacao) -> `unavailable` -> degradacao para loopback total + toast, sem erro cru |
| RF-08 | 3.1 + 4.1 | Cascata: rearme -> endpoint-loopback (mesma track) -> toast; toasts de start e runtime definidos |
| RF-09 | 5.1 | Guard em 3 camadas (store, RoomScreen, StreamThumbnail); PiP/fullscreen bloqueados por serem sub-estados do PlayerView |
| RF-10 | 6.1 | Card com mensagem, fonte, com/sem audio e contagem nas variantes tile/strip |
| RF-11 | 5.1 + 6.1 | `viewersOf(room.watching)` em tempo real (mesmo dado do mesh ja existente) |
| RF-12 | 5.1 + 6.1 | Guard por peerId (imune a txId novo); card keyed por txId atualiza fonte sem janela de exposicao |
| RF-13 | 5.1 | Transmissao removida do roster remove o card; grid/empty voltam |
| RF-14 | 5.1 | Retransmissao cai nos mesmos guards; card remonta com entrada nova |
| RF-15 | 5.1 | Guard condicionado a `peerId === selfPeerId`; transmissoes alheias intocadas |
| RF-16 | 5.1 + 4.1 | Assistir terceiro enquanto transmite funciona (player do outro + card proprio na strip) |
| RF-17 | 2.1 | Arvore do Zoi excluida da captura: audio da transmissao alheia assistida nao entra no mix |
| RF-18 | 6.1 | Bounce da logo + fade/slide do titulo + stagger dos detalhes (UISPEC 6.2 fase 1) |
| RF-19 | 6.1 | Span keyed por count com `z-count-roll-in` (UISPEC 6.2 fase 2) |
| RF-20 | 6.1 | `logo-goiaba.png` como elemento central da entrada (UISPEC 6.4) |
| RF-21 | 5.1 + 6.1 | Nenhum branch por papel em nenhum ponto novo |
| RNF-01 | 2.1 + 3.1 + 4.1 | Captura/mix em threads do utilityProcess; renderer so escreve frames triviais; validacao em 4.1/7.1 |
| RNF-02 | 4.1 + 7.1 | Stream local unica intocada nos caminhos de chamada; e2e `expectNoDirectionFallbacks` obrigatorio |
| RNF-03 | 7.1 | Suite completa verde como Done do sprint final |
| RNF-04 | 4.1 + 6.1 | Todas as strings novas em pt-BR sem acento (toasts e card definidos neste SPEC) |
| RNF-05 | 6.1 | Card baseado em `.z-empty`/`.z-reconnect` + tokens do UISPEC; toast warning padrao |
| RNF-06 | 4.1 | Track adicionada antes do announce; zero renegociacao; pull consome a mesma stream (assert em 7.1) |
| RNF-07 | 4.1 + 7.1 | Nada persistido; AC-21 automatizado no e2e (inspecao do settings.json) |
| RNF-08 | 6.1 | Card `memo()`, sem video, sem loop, dados de baixa frequencia |
| RNF-09 | 6.1 | Keyframes so transform/opacity, entrada unica, reduced-motion coberto pela regra global, validacao de fps no Done |

## 9. Premissas e questoes em aberto

- `[ASSUMPTION]` A maquina de dev do Pontin consegue compilar o addon (VS Build Tools + Python para o node-gyp). Bloqueia: Sprints 1-2. Mitigacao ja no desenho: stub JS no `index.js` mantem o app e os testes funcionando degradado se o binario faltar; o Sprint 1 confirma a toolchain no primeiro dia.
- `[ASSUMPTION]` `MediaStreamTrackGenerator` de audio funciona no renderer do Electron 43 e a track resultante e aceita pelo RTCPeerConnection do PeerJS (e API estavel do Chromium desde a era 94; consideramos risco baixo). Bloqueia: Sprint 4. O probe do Sprint 1 confirma; plano B documentado (AudioWorklet + `createMediaStreamDestination`, secao 3 item 5).
- `[ASSUMPTION]` Capturas process-loopback INCLUDE entregam o audio do processo independentemente do endpoint em que ele renderiza (a ativacao usa o dispositivo virtual de processo, nao um endpoint). Se na pratica for por-endpoint, o efeito e apenas audio faltante de apps em endpoints nao-padrao (direcao segura, igual ao loopback atual que tambem e do endpoint padrao). Verificado empiricamente no Sprint 2.
- `[OPEN]` Comportamento do constraint `restrictOwnAudio` no caminho `setDisplayMediaRequestHandler` + `'loopback'` do Electron: registrado pelo probe do Sprint 1 apenas como informacao; NENHUM sprint depende dele.
- `[OPEN]` Latencia A/V exata do caminho addon -> port -> generator em maquina fraca: estimada em 30-60 ms (secao 4); se o smoke do Sprint 4 mostrar descolamento perceptivel, a correcao prevista e reduzir o buffer de mix e/ou aplicar offset fixo no `timestampUs`, sem mudanca de arquitetura.
- Nota de seguranca: nenhum segredo, token ou valor de env neste documento; nomes apenas (`ZOI_DISABLE_AUDIO_EXCLUSION`). O renderer nao controla quais processos sao excluidos (secao 5c).

Self-check: PASS apos revisao do forge-review. Corrigido: (1) BLOCKER do algoritmo de composicao: ancora de include agora e SEMPRE o PID da propria sessao (nunca ancestral, que capturaria a subarvore do Discord via ancestrais comuns como explorer.exe), com pre-checagem de subarvore na abertura, dedup por parentesco entre sessoes e tres redes de runtime (OnSessionCreated event-driven, vigia de proibidos 1 s, reconciliacao 5 s), refletido em 2.1, Feature 2.1, riscos e matriz; (2) degradacao de runtime unificada: quem degrada e o MAIN via re-fork da cascata (2.2, 2b e Sprint 3 concordam) e o campo `mode` entrou no protocolo `start` da secao 5.C; (3) corrida do MessagePort eliminada: listener registrado ANTES do invoke `start()` e mantido pela sessao inteira (5.B e Feature 4.1); (4) referencia de linha do bloco `z-slide-left` corrigida para 229-239 (insercao apos linha 239, verificado no arquivo); (5) nota de drift de linhas no Sprint 4: relocalizar edicoes de RoomScreen.tsx por conteudo se os Sprints 5-6 aterrissarem antes. Reverificado: `Consumes:` frontend verbatim na secao 5 (incluindo o `mode` novo, que e main->worker e nao muda os canais consumidos), caminhos e linhas conferidos, matriz completa sem orfaos (21 RF + 9 RNF), identificadores em ingles.
