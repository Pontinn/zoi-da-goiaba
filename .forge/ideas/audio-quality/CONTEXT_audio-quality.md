---
feature: audio-quality
language: pt-BR
code_identifier_language: mirrors-existing-codebase (en)
generated: 2026-08-31
stack: Electron 43 + React 18 + TypeScript, PeerJS/WebRTC mesh P2P, addon nativo C++ (WASAPI) para captura de audio com exclusao
---

## 0. Baseline (drift anchor)

- HEAD commit: `0ba16e80bfd00084dd7c73dfd790ed26dc8fa197`
- IDEA fingerprint (sha256 de `IDEA_audio-quality.md` no momento da leitura, RECALCULADO nesta extensao apos edicao da IDEA): `f01c925f7f5ca1c4fa78e34bf819df0520b1e1e04a32c8fb1c68e77a32ea591e`
- Arquivos de codigo analisados (`path - git blob hash`):
  - `src/renderer/src/services/media-manager.ts - 9f9744f2056b67cfda154094d73ce42a32e2025e`
  - `src/main/audio-capture-worker.ts - 52afdc3ff6670a205862a2b79c5e119703998cbd`
  - `src/renderer/src/services/audio-exclusion.ts - 88e88c82f469e686a19386784af4f5d393cff092`
  - `src/main/audio-exclusion.ts - ba55a3ee379552f9d7b74cf7c8e7599185235ea3`
  - `src/renderer/src/services/stats-monitor.ts - 455f6d59b409d80c96bd2c0b77ae504fd0371411`
  - `src/shared/codecs.ts - f485295f9c2f2a2966598ec27399e1e5ffbc24cd`
  - `src/renderer/src/ui/screens/PlayerView.tsx - e99c66f52118a70b46e4c6f6627be32b48934696`
  - `native/zoi-audio-capture/src/capture_engine.cc - a0259bd21bbfedc639aa899bbc952384210398bc`
  - `native/zoi-audio-capture/src/mixer.cc - ec8ed03582172db8021cf0bd9bde5462c094a835`
  - `native/zoi-audio-capture/src/mixer.h - 55323169bf27d49714b5538033c0c3d234d4401b`
  - `native/zoi-audio-capture/src/addon.cc - 39a6208b230a0866e6f70658922eae8595e52938`
  - `native/zoi-audio-capture/src/session_tracker.cc - e0b2fc0c439b87ea8ba9e136f561dafca8ca3cab` (adicionado na extensao do sintoma jogo/YouTube)
  - `native/zoi-audio-capture/src/session_tracker.h - 8a64a8e759a4c6bdd6038fe798acac491f5971e8` (idem)
  - `native/zoi-audio-capture/src/capture_engine.h - aaf4fdac254658540c58ef6ae618242e9e5b09a9` (idem)
  - `src/renderer/src/ui/components/Toast.tsx - e3bd3a2f9115c97c07a9a4dd7a7fa7e42a93d8c0` (adicionado no fix do BLOCKER B1 do forge-review)
  - `src/renderer/src/store/app-store.ts - 0404c9ec1f5436c6c489a1516fcab3b6e2f39d44` (idem)
  - `src/renderer/src/ui/screens/RoomScreen.tsx - 4e04bdde9ec9e8d45ebb922d1f03ea8f3c429b84` (idem)
  - `src/shared/ipc.ts - e1d4a3e8e6aea5b3c49df780b57257be81faefd7`
  - `src/shared/config.ts - aea031edff4fe5430d9189a31f34187ef234aea3`
  - `src/main/index.ts - 676a22d6b34d48c2062939d77733a2f48b66d531`
  - `src/main/file-logger.ts - ef18c057fc8150f8e4ee06fcd6d94c29b5e5a417`
  - `src/renderer/src/services/cursor-hub.ts - 2c04df9567e32ed0566c1720d4eb1d82b5fa4c5c`
  - `package.json - 744dad701f8d670c8b333e1b4731eeda8d194fb7`
  - `scripts/audio-probe.mjs - 7ec40440a723e0ee7b165403f6d9bea276cf9ff7`
  - `.forge/complete/app-audio-capture/SPEC_app-audio-capture.md - 567d35b18a55f73a7f109650c0eeecfb2df1b82e`
  - `.forge/complete/app-audio-capture/SPIKE-RESULTS_app-audio-capture.md - cd9bae376b79a924141a264b432b46b3a392a4a6`
  - `.forge/complete/app-audio-capture/CHECKLIST_MANUAL_app-audio-capture.md - 5a19898affc30baa629199aadbae9f38ee0097b3`

## 1. Stack & build

- Electron 43.4.1, React 18.3.1, TypeScript 5.9.3, `electron-vite` 5.0.0, `peerjs` 1.5.5, `zustand` 5.0.15.
- Dependencia local: `zoi-audio-capture` (`file:native/zoi-audio-capture`), addon nativo N-API/C++ so para Windows (WASAPI), compilado via node-gyp. Empacotado com `asarUnpack` (o worker le o `.node` fora do asar).
- Testes: `vitest` (unit), `@playwright/test` (e2e). Scripts relevantes: `npm run audio:probe` (sonda executavel do motor nativo, fora do escopo de sessao real).
- `package.json` na raiz confirma `"version": "0.4.0"` (a mesma da sessao de campo relatada na IDEA).

## 2. Arquivos e modulos relevantes (por estagio do pipeline)

**Captura (transmissor)**
- `src/renderer/src/services/media-manager.ts` - `startTransmission()` monta a stream: video via `getDisplayMedia` (com preset), audio por DOIS caminhos possiveis (`AudioMode`): `excluded` (addon nativo com exclusao de processos) ou `full-loopback` (audio do `getDisplayMedia` classico, `audio: true` sem nenhuma constraint explicita de `echoCancellation`/`noiseSuppression`/`autoGainControl`/`sampleRate`/`channelCount`).
- `src/main/audio-exclusion.ts` - orquestra o worker nativo no processo main: cascata de degradacao `process-exclusion -> process-exclusion (retry) -> endpoint-loopback -> failed`. So aqui existe `logToFile` para os estados da sessao (nao para frame individual).
- `src/main/audio-capture-worker.ts` - entry do `utilityProcess` que hospeda o addon; so repassa PCM (`port.postMessage`) e status (`parentPort`), sem logica propria.
- `native/zoi-audio-capture/src/capture_engine.cc` - `CaptureStream` (uma por processo incluido ou pelo endpoint classico) usa WASAPI com buffer de 20 ms (`kBufferDuration = 200000` em unidades de 100ns) e thread propria por captura; `Engine::Reconcile` roda a cada 1 s (`kReconcileIntervalMs`) OU quando uma sessao de audio nasce/morre no Windows (evento do `session_tracker`), fechando/abrindo `CaptureStream`s.
- `native/zoi-audio-capture/src/mixer.cc` / `.h` - `AudioRingBuffer` (anel por captura) + `Mixer` com relogio proprio de 10 ms (`CreateWaitableTimerExW` de alta resolucao). A cada tique, LE `framesPerTick_` de cada fonte, SOMA com clamp `[-1,1]`, e emite SEMPRE um frame (mesmo vazio = silencio) via `PcmSink`.
- `native/zoi-audio-capture/src/addon.cc` - ponte N-API: `pcmSink` entrega cada frame por `Napi::ThreadSafeFunction::NonBlockingCall` com fila de 128 posicoes (~1s de audio a 10ms/frame, comentario do proprio codigo). Fila cheia = frame DESCARTADO, sem log nenhum.

**Envio (transmissor -> rede)**
- `src/renderer/src/services/audio-exclusion.ts` - cliente do renderer: recebe PCM pelo `MessagePort`, escreve em `MediaStreamTrackGenerator({ kind: 'audio' })` via `WritableStreamDefaultWriter`. A identidade da track NUNCA muda (nenhum `replaceTrack`/renegociacao mesmo quando o worker re-forka na cascata).
- `src/renderer/src/services/media-manager.ts` - `callPeer()`/`applySenderParameters()` so tocam parametros do sender de VIDEO (`maxBitrate`, `maxFramerate`, `degradationPreference`); nenhum parametro de audio e ajustado em sender nenhum.
- `src/shared/codecs.ts` - `preferVideoCodec(sdp, codec)` reordena SOMENTE os payload types da secao `m=video` (localiza o indice do `m=video`, para no proximo `m=`). Nunca toca na secao `m=audio`.

**Recepcao e reproducao (espectador)**
- `src/renderer/src/services/media-manager.ts` - `bindIncoming()`/`onIncomingCall`/fallback de direcao (`startMediaPull`/`answerPull`): a stream chega inteira (video+audio) como MediaStream unica, guardada em `remoteStreams` por `txId`.
- `src/renderer/src/ui/screens/PlayerView.tsx` - um UNICO `<video>` recebe `element.srcObject = stream` (linha ~228), atribuido UMA vez por stream. Volume/mudo vivem SO no elemento (`element.volume`/`element.muted`, linhas ~246-247), nunca na stream, nunca via WebAudio/GainNode. Nao ha nenhum processamento de audio no lado do espectador (sem AudioContext, sem playbackRate manipulado).

**Observabilidade**
- `src/renderer/src/services/stats-monitor.ts` - tick de 3s (`QUALITY_UPDATE_INTERVAL_MS`). Le `inbound-rtp` mas SOMA `bytesReceived`/`packetsLost`/`packetsReceived` de TODOS os `kind` juntos (audio + video misturados no mesmo acumulador, sem filtro de `kind` nessas 3 linhas). Os campos de VIDEO (`framesDecoded`, `codec`, `decoderImplementation`) sao filtrados por `entry.kind !== 'video'`; NENHUM campo especifico de audio (`audioLevel`, `jitter`, `concealedSamples`, `concealmentEvents`, `insertedSamplesForDeceleration`, `removedSamplesForAcceleration`, `packetsDiscarded`) e lido, nem do lado inbound nem do outbound. **Ponto de extensao documentado no proprio arquivo** (linhas 59-67, comentario do bloco que antecede `InboundVideoStats`): "campos novos do MESMO report inbound-rtp entram AQUI... nunca um coletor paralelo" - ou seja, qualquer leitura nova de campo de audio deve ser adicionada dentro do MESMO laco de `stats.forEach` deste arquivo, nao num monitor separado. As interfaces existentes hoje sao nomeadas por VIDEO (`InboundVideoStats` linha 68, `RtpVideoStatsEntry` linha 48) - um trabalho de audio precisaria renomear/generalizar esses tipos (ou criar irmaos `InboundAudioStats`/`OutboundAudioStats` seguindo o MESMO padrao de nomeacao) para nao ferir a convencao ja estabelecida.
- `src/main/file-logger.ts` + `attachRendererLogging` (chamado em `src/main/index.ts`) - encaminha `console.*` do renderer para arquivo. Um `console.warn`/`console.info` novo em codigo TypeScript do renderer ou do main (a maioria do pipeline de audio: `media-manager.ts`, `audio-exclusion.ts` dos dois lados, `stats-monitor.ts`) JA cairia no log persistente sem trabalho extra de infraestrutura - hoje simplesmente NAO existe nenhuma chamada desse tipo nos pontos de descarte de frame do lado TS (ver secao 4). **Essa facilidade NAO vale para os pontos NATIVOS** (underrun do `Mixer` em `mixer.cc`, fila cheia do `ThreadSafeFunction` em `addon.cc`): o UNICO canal desses pontos ate o arquivo de log e `statusSink_` -> `statusCallback` (um SEGUNDO `ThreadSafeFunction`, fila de so 16 posicoes, `addon.cc` linhas 289-290) -> `audio-capture-worker.ts` (`parentPort`) -> `worker.on('message', ...)` em `src/main/audio-exclusion.ts` (linhas 157-170) -> `logToFile`. Hoje esse handler so age (e so loga, via `escalate`) quando `message.state === 'failed'`; qualquer outro estado (`active`, inclusive um `active` reaproveitado para carregar contadores de underrun/descarte) cai no `return` sem nenhum log (ver secao 4.D pergunta 5). Instrumentar os pontos nativos exige OU mudar esse filtro no handler do main, OU criar um canal novo - nao basta adicionar um `console.*`, porque C++ nao tem `console.*`.
- **Avisos ao usuario (toast) - infraestrutura ja existe e ja e usada para audio**: `src/renderer/src/ui/components/Toast.tsx` renderiza `ToastContainer`/`ToastRow` a partir de `useAppStore((state) => state.toasts)`; `src/renderer/src/store/app-store.ts` define `pushToast: (tone: ToastTone, text: string) => void` (linha 60, implementacao linhas 89-95, empilha em `toasts` com teto de 5 via `slice(-5)`) e `TOAST_TTL_MS = 4_000` (linha 17, auto-dismiss). `src/renderer/src/ui/screens/RoomScreen.tsx` JA usa `pushToast('warning', ...)` para avisar sobre degradacao de audio em DOIS pontos (ver secao 3 e 4.B): um no INICIO da transmissao (linhas 211-216) e um em RUNTIME durante a transmissao (linhas 113-131, com deduplicacao por `status.state` via `alreadyWarned`, resetada quando o `txId` muda).

## 3. Padroes existentes / decisoes ja tomadas (features completas)

- `app-audio-capture` (`.forge/complete/app-audio-capture/`) e a feature que criou TODO o caminho `excluded`. Decisoes ja fixadas la, que o fix deve respeitar:
  - Buffer/mix em 10ms, 48kHz, 2 canais (`AUDIO_EXCLUSION_SAMPLE_RATE = 48000`, `AUDIO_EXCLUSION_CHANNELS = 2`, `AUDIO_EXCLUSION_FRAME_MS = 10`, `src/shared/ipc.ts` linhas 126-128).
  - SPEC secao 9 ja tinha um `[OPEN]` NUNCA fechado: "Latencia A/V exata do caminho addon -> port -> generator em maquina fraca: estimada em 30-60ms; se o smoke mostrar descolamento perceptivel, a correcao prevista e reduzir o buffer de mix e/ou aplicar offset fixo no timestampUs, sem mudanca de arquitetura." (linha 549). Nao e sobre estalo, mas mostra que a equipe ja sabia que esse caminho tinha risco de timing sem medicao real.
  - `CHECKLIST_MANUAL_app-audio-capture.md` item **2.2**: "Audio sem estalos, cortes ou robotizacao ao longo de 10+ minutos" - **PERMANECE `[ ]` (nunca marcado)** no artefato da feature completa. Ou seja, a verificacao manual de "sem estalos" nunca foi formalmente confirmada antes do ship; a sessao de campo do fim de semana e a primeira observacao real e prolongada dessa dimensao.
  - Motivacao de design documentada no proprio `mixer.h`: "Cheio, descarta o MAIS VELHO: atraso acumulado e pior que um estalo, porque descola o labio do video" - ou seja, a equipe ja aceitou a POSSIBILIDADE de estalo como troca deliberada contra o descolamento labial, mas nunca validou se esse estalo teorico e o que o usuario ouviu.
  - Frame continuo do mixer ("emite SEMPRE um frame, mesmo que ninguem esteja tocando nada") e o design que mantem a track viva; isso e uma boa pratica ja seguida (evita a track parar de vez), mas nao impede um TIQUE especifico de ser parcialmente silencio por underrun momentaneo de UMA fonte (ver secao 4).
- **Avisos de degradacao de audio no TRANSMISSOR JA EXISTEM hoje** (achado do forge-review, verificado): nao e uma lacuna a preencher do zero, e um aviso existente que precisa ser AVALIADO/AJUSTADO, nao criado. Dois pontos distintos em `RoomScreen.tsx`, os dois via `pushToast('warning', ...)`:
  - **Aviso de INICIO** (linhas 211-216): disparado uma vez, logo apos `startTransmission`/`switchSource` resolver, quando `transmission.audioMode === 'full-loopback'` - texto atual: "Nao foi possivel isolar o audio do Discord; a transmissao segue com o som do sistema inteiro." Cobre o caso em que a exclusao NUNCA chegou a se estabelecer (ver 4.B, estado C).
  - **Aviso de RUNTIME** (linhas 113-131): um `useEffect` assinado em `window.zoi.audioExclusion.onStatus(...)` enquanto `localTx?.audioMode === 'excluded'` (guarda `excludedTxId`, linha 112); mostra toast quando `status.state === 'degraded-full-loopback'` ("A captura de audio por aplicativo falhou; a transmissao segue com o som do sistema inteiro.") ou `status.state === 'failed'` ("O audio da transmissao caiu; pare e transmita de novo para restaurar o som."), UMA VEZ por estado por transmissao (`alreadyWarned`, um `Set` recriado a cada remontagem do efeito, isto e, a cada troca de `txId`). Cobre o caso em que a exclusao COMECOU boa e degradou depois, ainda DENTRO da mesma transmissao (ver 4.B, estado B).
  - Como esses dois avisos ja existem e cobrem os dois pontos de degradacao conhecidos do lado do transmissor, o requisito da IDEA para Windows 10 (maquina abaixo do build minimo do WASAPI Process Loopback) precisa ser tratado como AVALIAR/AJUSTAR o aviso de INICIO ja existente (ele dispara corretamente nesse caso, ver W1) e nao como CRIAR um aviso novo do zero.
- `app-sounds-volume` (`.forge/complete/app-sounds-volume/`) - so tem `IDEA`/`CHECKLIST`/`STATE`, sem SPEC dedicado (fast-path). Cobre o volume dos sons LOCAIS do proprio app (entrar/sair/transmitir), que ja sao explicitamente excluidos do mix de audio transmitido (ver item 1.6 do CHECKLIST_MANUAL acima) - nao e caminho de audio de rede, irrelevante para o estalo do espectador.
- `hq-presets` (`.forge/complete/hq-presets/`) - so `IDEA`/`CHECKLIST`/`STATE`; presets de video (resolucao/fps/bitrate), sem mencao a audio.
- `video-codec-upgrade` (`.forge/complete/video-codec-upgrade/`) - introduziu `sdpTransform` e a escada de codecs de VIDEO (AV1/VP9/H264/VP8) com renegociacao completa (redial) em troca de codec por CPU ou composicao de sala. Confirmado no codigo (`src/shared/codecs.ts`) que o `sdpTransform` so mexe na secao `m=video`; a troca de codec de video refaz TODAS as chamadas de saida (`applyCodecChange` -> `callPeer` de novo para cada peer), o que reabre a `RTCPeerConnection` inteira - se isso acontecer NO MEIO de uma sessao longa (rebaixamento por CPU, entrada de membro), a track de audio tambem e re-anexada numa oferta nova (mesma stream, mesma track, mas SDP/transceiver novos). Nao ha evidencia de bug aqui, mas e um ponto de renegociacao que acontece "por baixo" do audio sem o audio ser o motivo.

## 4. Arquitetura & dados: o caminho de audio ponta a ponta

### 4.A Caminho `excluded` (WASAPI Process Loopback com exclusao, o caminho novo)

```
[processo alvo, WASAPI]
  -> CaptureStream (thread propria, buffer 20ms, ring buffer capacityFrames = sampleRate/5 = ~200ms)
  -> Engine::Reconcile (1s OU evento de sessao nova/morta) abre/fecha CaptureStream por PID permitido
  -> Mixer::Run (thread propria, timer de ALTA RESOLUCAO a cada 10ms; mixer.cc linhas 144-177)
       - `std::fill(mixed.begin(), mixed.end(), 0.0f)` ZERA o buffer de saida no INICIO de
         CADA tique (linha 155), antes de somar qualquer fonte
       - para cada fonte: `AudioRingBuffer::Read(scratch, framesPerTick_)` (linha 160); se
         `availableFrames_ < framesPerTick_`, `Read` devolve MENOS `frames` do que o pedido
       - o laco de soma so percorre `frames * channels` amostras (linhas 162-164, `samples =
         frames * format_.channels`), NUNCA `framesPerTick_ * channels` inteiro - entao,
         havendo underrun, o TRECHO FINAL de `mixed` simplesmente nunca recebe soma nenhuma
         e permanece no zero do `std::fill` da linha 155 (nao e o `scratch` zerado sendo
         somado; e a regiao de `mixed` que nunca chega a ser tocada) -> o tique final tem
         uma FRONTEIRA ABRUPTA entre amostra real e zero dentro do MESMO frame de 10ms (ver
         secao 7)
       - soma todas as fontes com clamp [-1,1], SEMPRE emite um frame de 480x2 amostras
  -> addon.cc pcmSink -> Napi::ThreadSafeFunction::NonBlockingCall (fila de 128 frames)
       - fila cheia (~1s de atraso do lado JS) -> frame DESCARTADO sem log (linha 310-311)
  -> audio-capture-worker.ts (utilityProcess) -> port.postMessage (copia via structured clone)
  -> audio-exclusion.ts (renderer) onmessage -> writeFrame()
       - writer.desiredSize <= 0 (backpressure do WritableStream) -> frame DESCARTADO sem log
         (comentario "Fila cheia: descartar o frame e melhor do que acumular atraso")
       - timestamp da AudioData e calculado por writtenFrames (contagem PROPRIA, monotonica);
         um frame descartado NAO deixa buraco no timestamp da PROXIMA AudioData escrita, ela
         so "cola" o pedaco seguinte de PCM logo depois do anterior
  -> MediaStreamTrackGenerator (audio) -> mesma MediaStream do video -> RTCPeerConnection (PeerJS)
  -> rede (Opus, negociacao 100% padrao do Chromium, SEM sdpTransform, SEM bitrate/DTX/FEC configurados)
  -> RTCPeerConnection do espectador -> MediaStream recebida -> <video> (srcObject) -> alto-falantes
```

### 4.B TRES estados de captura, nao dois (correcao de premissa)

Revisao desta secao: `AudioMode` (campo do renderer, `LocalTransmission.audioMode`, `media-manager.ts` linha 79, valores `'excluded' | 'full-loopback' | 'none'`) e `CaptureMode` (campo INTERNO do addon nativo, `capture_engine.h` linha 26-31, valores `ProcessExclusion | EndpointLoopback`) sao DOIS CONCEITOS DIFERENTES com nomes parecidos, e a versao anterior desta secao os conflava. Sao TRES estados reais de captura, nao dois:

**Estado A - `AudioMode: 'excluded'` + `CaptureMode: ProcessExclusion` (caminho feliz).** E o caminho descrito inteiro em 4.A: WASAPI Process Loopback por processo, `Engine::Reconcile`, mixer de 10ms, `MessagePort`, `MediaStreamTrackGenerator`. Decidido em `media-manager.ts` linha 532 (`audioMode: !options.withAudio ? 'none' : exclusion ? 'excluded' : 'full-loopback'`) quando `this.audioExclusion.start()` devolve uma sessao valida (`exclusion !== null`) NO INICIO da transmissao.

**Estado B - `AudioMode: 'excluded'` (continua assim ate o fim) + `CaptureMode: EndpointLoopback` (degrau INTERNO do addon).** Acontece quando a exclusao por processo COMECOU boa (estado A) mas o worker nativo falha DURANTE a transmissao; a cascata em `src/main/audio-exclusion.ts` (`escalate()`, linhas 190-219) reforka o worker no modo `endpoint-loopback` (`spawnWorker('endpoint-loopback', ...)`, linha 210) e o addon passa a usar `Engine::ReconcileEndpoint()` (`capture_engine.cc` linhas 538-562) - loopback classico do endpoint padrao, capturando o SISTEMA INTEIRO (Discord incluso de novo) em vez de processos individuais. **O `AudioMode` no renderer NUNCA muda**: `LocalTransmission.audioMode` e escrito UMA VEZ em `startTransmission()` e nao ha nenhuma reatribuicao dele em nenhum outro ponto de `media-manager.ts` - o pipeline do renderer (mesma track do `MediaStreamTrackGenerator`, mesmo `MessagePort`, mesmo `WritableStreamDefaultWriter`) continua IDENTICO ao estado A; so a FONTE do PCM dentro do addon nativo trocou de N `CaptureStream`s por processo para 1 `CaptureStream` de endpoint inteiro. Esse degrau e reportado ao renderer via `sendStatus({ state: 'degraded-full-loopback', detail: reason })` (`audio-exclusion.ts` linha 213) - e exatamente o `status.state === 'degraded-full-loopback'` que o toast de RUNTIME de `RoomScreen.tsx` (linhas 119-123) mostra (ver secao 3).

**Estado C - `AudioMode: 'full-loopback'` (decidido no renderer, fora do addon).** Acontece quando `this.audioExclusion.start()` (cliente do renderer) NUNCA consegue uma sessao - `exclusion` fica `null` ANTES da captura de video/audio comecar (`media-manager.ts` linhas 468-478), seja porque `window.zoi.audioExclusion.start()` devolveu `{ mode: 'unavailable', reason }` de saida (SO nao suportado, addon ausente, worker nao subiu, ativacao WASAPI falhou - ver W1 abaixo) ou porque a cascata inteira falhou antes do primeiro `MessagePort` chegar. Nesse caso `useSystemLoopback = true` (linha 478) e o app usa `getDisplayMedia({ audio: true })` do PROPRIO CHROMIUM:

```
[audio do sistema inteiro] -> getDisplayMedia({ audio: true }) do Chromium
  -> pipeline de captura/encoder NATIVO do Chromium (fora do controle do app, NUNCA toca o addon)
  -> mesma MediaStream do video -> RTCPeerConnection (PeerJS) -> rede -> espectador -> <video>
```

Este caminho NAO passa pelo addon nativo, pelo `MessagePort`, nem pelo `MediaStreamTrackGenerator` em NENHUM momento - e o pipeline padrao do Chromium para audio de captura de tela, sem nenhuma constraint customizada (`audio: true` puro, sem objeto de constraints). E o estado que o toast de INICIO de `RoomScreen.tsx` (linhas 211-216, `transmission.audioMode === 'full-loopback'`) avisa.

**Por que a distincao importa para o diagnostico**: os estados A e B compartilham TODO o pipeline nativo/renderer de 4.A (mixer, `AudioRingBuffer`, `ThreadSafeFunction`, `MediaStreamTrackGenerator`, todos os pontos de descarte silencioso listados ali) - um estalo nesses dois estados tem os MESMOS candidatos de causa. O estado C e um pipeline TOTALMENTE diferente (Chromium puro) - um estalo nesse estado exigiria olhar para dentro do Chromium, fora do controle do codigo deste app. Nao ha, no codigo, forma de saber HOJE qual dos TRES estados estava ativo em qualquer sessao de campo relatada (ver secao 8, U1/U9 atualizados).

### 4.C Ponto de fusao

Os tres estados (A, B, C da secao 4.B) convergem na MESMA `MediaStream` (`transmission.stream`) entregue ao `RTCPeerConnection` via PeerJS (`session.callPeer`, chamado de `media-manager.ts`). Da rede para frente (SDP, Opus, jitter buffer do lado do espectador, elemento `<video>`) o comportamento e IDENTICO nos tres estados - se o estalo nascer dali para frente, ele afeta os tres igualmente; se nascer no `Mixer`/`ThreadSafeFunction`/`MediaStreamTrackGenerator`, so afeta os estados A e B (`AudioMode: 'excluded'`), nunca o estado C (`AudioMode: 'full-loopback'`).

### 4.D Como o conjunto de processos capturados e decidido (modo `excluded`)

Sintoma novo mapeado nesta extensao: transmissor Win11 transmitindo com audio; o JOGO nao aparecia no audio da transmissao, mas o YOUTUBE (no navegador) sim; o transmissor ouvia o jogo normalmente NA PROPRIA maquina; um unico dispositivo de saida (fone) ate onde se sabe.

**1. Include-list ou exclude-list, e de onde vem o conjunto de PIDs?**

E uma **lista de INCLUSAO por composicao** (nunca exclusao de um universo maior): `Engine::Reconcile` (`native/zoi-audio-capture/src/capture_engine.cc` linhas 436-521) parte de `scanner_.ListSessionPids(&sessionPids)` (`SessionScanner::ListSessionPids`, `native/zoi-audio-capture/src/session_tracker.cc` linhas 277-310), que enumera **apenas os PIDs que tem uma SESSAO DE AUDIO ATIVA no `IAudioSessionManager2` do endpoint de render PADRAO** (via `IAudioSessionEnumerator`, pulando `IsSystemSoundsSession()` e sessoes `AudioSessionStateExpired`). Um processo que NUNCA abriu uma sessao de audio nesse endpoint simplesmente nao aparece nessa lista - nao ha enumeracao de processos do SO aqui, so sessoes WASAPI.

A partir dessa lista, `Reconcile` (capture_engine.cc):
- Passo 1 (linhas 449-454): mantem so PIDs vivos no `ProcessSnapshot` (Toolhelp32) e FORA de qualquer arvore proibida (`IsForbidden`, verifica o proprio PID e cada ancestral ate a raiz, ate 64 niveis - `session_tracker.cc` linhas 118-138).
- Passo 2 (linhas 456-469): dedup por parentesco - se um PID permitido e ANCESTRAL de outro PID permitido (`IsAncestorOf`, resistente a reuso de PID via `CreationTime`), o descendente e descartado da lista de ancoras; so o mais alto (`anchors`) sobra. Isso so acontece se AMBOS tiverem sessao de audio propria; um launcher sem sessao de audio propria nunca entra nesse calculo.
- Passo 3 (linhas 471-477): pre-checagem - se existir QUALQUER PID proibido dentro da subarvore da ancora (`SubtreeContainsAny`), a ancora inteira e recusada.
- Abertura (linhas 502-515): para cada PID final em `keep`, `StartProcessInclude(pid)` (`capture_engine.cc` linhas 87-144) ativa `AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK` com `PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE` (linha 94) - ou seja, uma vez ancorada, a captura SEGUE A ARVORE (processos filhos do PID ancora entram automaticamente, sem nova ancora).

**Regra central documentada no proprio header** (`capture_engine.h` linhas 3-6): "a ancora de um include e SEMPRE o proprio PID da sessao de audio, NUNCA um ancestral. Subir a arvore serve so para detectar arvore proibida." Ou seja: a ancora e sempre o PID que **efetivamente abriu a sessao de audio** (o processo do jogo, ou um subprocesso dele que renderiza som), nunca o launcher acima. Se o jogo real que toca som roda como um PID cuja sessao aparece na lista, ele vira ancora direta e sua arvore de FILHOS entra; ancestrais (launcher, Steam, Epic) nunca sao usados para expandir a captura.

`src/main/audio-exclusion.ts` NAO participa dessa decisao de QUAIS PIDs: ele so monta a config estatica (`excludedExecutables`, `excludedRootPids: [process.pid]`, linhas 87-98) e repassa ao worker; toda a logica de inclusao/exclusao de PID roda dentro do addon nativo, no `Engine::Reconcile`.

**2. A captura e amarrada a um dispositivo de render especifico, ou e por sessao independente de dispositivo?**

E amarrada ao **endpoint de render PADRAO da role `eConsole`**, e SOMENTE a ele. `SessionScanner::Reopen()` (`session_tracker.cc` linhas 234-260) chama `enumerator_->GetDefaultAudioEndpoint(eRender, eConsole, &device_)` (linha 244) e so entao `device_->Activate(IAudioSessionManager2, ...)` (linha 247) - o `IAudioSessionEnumerator` usado em `ListSessionPids` vem DESSE `manager_`, isto e, so enxerga sessoes que vivem no endpoint que e o padrao PARA A ROLE CONSOLE no momento.

Duas situacoes ficam **invisiveis para a enumeracao atual, mesmo com um unico dispositivo fisico de saida**:
- **Role diferente**: o Windows permite que o padrao de render seja configurado por ROLE (`eConsole`, `eMultimedia`, `eCommunications`) de forma independente, mesmo apontando fisicamente para o MESMO dispositivo em geral - mas nada no codigo consulta `eMultimedia`/`eCommunications`; so `eConsole` e usado tanto em `SessionScanner` quanto em `GetDefaultDevice()` (linha 314, usado pelo modo `endpoint-loopback`). Se por qualquer razao (perfil de audio espacial, gerenciador de audio de terceiros, roteamento por app do proprio Windows 11 "escolher saida de audio do app") a sessao do jogo for aberta associada a uma role/endpoint diferente do que `eConsole` resolve, ela nunca aparece em `ListSessionPids`.
- **Dispositivo de saida por app diferente do padrao do sistema**: o Windows 11 tem um seletor de saida DE AUDIO POR APLICATIVO (Configuracoes de Som > Volume do aplicativo e preferencias de dispositivo). Se o jogo estiver configurado (mesmo sem o usuario perceber, por exemplo um default herdado de uma sessao anterior com fone bluetooth diferente) para um dispositivo de render que NAO e o atual `GetDefaultAudioEndpoint(eRender, eConsole)`, a sessao dele vive no `IAudioSessionManager2` de OUTRO device - a `SessionScanner` desta engine NUNCA abre esse outro device, nunca o enumera, e nao existe fallback ou segunda varredura por outros dispositivos em lugar nenhum do codigo.

**Modo exclusivo (WASAPI exclusive mode)**: o codigo nao trata nem discrimina esse caso explicitamente; nao ha, nos arquivos lidos, nenhuma chamada que verifique o modo de compartilhamento da sessao do processo capturado. Fica como ponto em aberto (secao 8): nao da para confirmar so pelo codigo se uma sessao aberta em modo exclusivo aparece no `IAudioSessionEnumerator` do `IAudioSessionManager2` do jeito que este scanner consulta.

**3. Quando uma sessao nova aparece no meio da captura (jogo abre depois da transmissao ja iniciada), qual o caminho e a latencia?**

Dois gatilhos de reconciliacao, ambos convergindo no MESMO `Reconcile()`:
- **Evento** (`SessionNotifier::OnSessionCreated`, `session_tracker.cc` linhas 167-182): callback COM que dispara em thread arbitraria do WASAPI so quando uma sessao NOVA nasce no endpoint padrao ATUALMENTE aberto pelo scanner; ele so sinaliza `wakeEvent_` (nenhum trabalho pesado ali). Em `Engine::RunControlThread` (`capture_engine.cc` linhas 412-426), o `WaitForMultipleObjects` acorda no `wakeEvent_`, chama `scanner_.Reopen()` (linha 420, comentario: "Sessao nova ou troca de endpoint: reabre o manager antes de olhar") e entao `Reconcile(&snapshot)` - latencia tipicamente sub-segundo (limitada pelo agendamento de thread do SO, nao por polling).
- **Poll periodico** (`kReconcileIntervalMs = 1000`, linha 20): mesmo sem evento, o `WaitForMultipleObjects` tem timeout de 1s, entao `Reconcile` roda a cada 1s de qualquer forma como rede de seguranca.

**Condicao de "visto mas nunca capturado, silenciosamente"**: se a sessao aparecer em `ListSessionPids` (isto e, esta no endpoint certo) mas o PID cair em qualquer dos filtros de recusa - `IsForbidden` (arvore proibida) ou `SubtreeContainsAny` (proibido dentro da propria subarvore) - `Reconcile` simplesmente NAO abre `CaptureStream` para ele, sem nenhum log especifico do PID recusado (so o `DescribeAnchors` dos que FORAM abertos e reportado, ver pergunta 5). E se `StartProcessInclude` falhar (`FAILED(...)`) por qualquer HRESULT, o codigo so faz `continue` (linha 510-512 do `capture_engine.cc`) - **falha parcial de abertura de uma captura individual nao gera NENHUM log, nem em `active` nem em lugar nenhum**; o comentario da o motivo ("Falha parcial nao derruba o motor: segue com as outras capturas"), mas isso tambem apaga qualquer evidencia de que aquela tentativa aconteceu. Ja a condicao descrita na pergunta 2 (sessao em outro device/role) nunca chega nem a esse ponto: `ListSessionPids` nunca a devolve, entao nem `Reconcile` nem o poll de 1s a veem - permanece invisivel indefinidamente, sem log, sem retry, sem fallback para outro device.

**4. Nos OUTROS dois estados de captura (secao 4.B), o audio do jogo seria capturado?**

Correcao de premissa: a pergunta original tratava "full-loopback" como um unico modo; na verdade ha DOIS estados distintos que usam loopback de endpoint inteiro (secao 4.B), com respostas ligeiramente diferentes:

- **Estado B** (`AudioMode: 'excluded'` com `CaptureMode: EndpointLoopback` INTERNO, degrau da cascata `escalate()`): `Engine::ReconcileEndpoint()` (`capture_engine.cc` linhas 538-562) usa `scanner_.GetDefaultDevice()` - que resolve `eRender`/`eConsole`, `session_tracker.cc` linha 314, o MESMO endpoint que `SessionScanner` ja consultava no estado A - e abre `AUDCLNT_STREAMFLAGS_LOOPBACK` nesse endpoint padrao.
- **Estado C** (`AudioMode: 'full-loopback'`, decidido no renderer, fora do addon): usa o loopback NATIVO do Chromium via `getDisplayMedia({ audio: true })`, que tambem tende a resolver o dispositivo de render padrao do sistema (fora do controle/visibilidade do codigo deste app).

Nos DOIS casos, loopback classico captura a MISTURA pos-motor de audio de TODAS as sessoes em modo COMPARTILHADO roteadas para aquele device (independente de qual role cada sessao individual usa, contanto que caiam no mesmo device fisico) - entao se a causa do sumico do jogo no estado A (secao 4.D pergunta 2) for so uma ROLE diferente no MESMO dispositivo fisico, tanto o estado B quanto o estado C tendem a pegar o jogo onde o estado A perderia. Se a causa for um DEVICE fisico diferente, ou o jogo rodando em modo EXCLUSIVO do WASAPI (que passa ao largo do motor de mixagem compartilhado nos TRES estados), nem B nem C pegariam - a limitacao de dispositivo/modo exclusivo nao e exclusiva do estado A, ela persegue qualquer captura ancorada no endpoint padrao do sistema, seja por processo ou por loopback classico.

**5. Alguma dessas decisoes (add/remove de processo capturado) gera log visivel no log de campo?**

**Nao chega ao log de campo hoje, apesar de a informacao existir e ser precisa em C++.** `Reconcile` chama `Report("active", DescribeAnchors(*snapshot))` (linha 519) toda vez que `changed = true` (processo entrou ou saiu do conjunto capturado); `DescribeAnchors` (linhas 523-536) monta uma string tipo `capturas=N <pid>:<exe> <pid>:<exe> ...` com ate 10 ancoras nomeadas - ESSA informacao seria exatamente a evidencia necessaria para confirmar se `jogo.exe` chegou a ser capturado. `Engine::Report` (linhas 378-382) encaminha isso para `statusSink_`, que em `addon.cc` (linhas 314-324) vira uma chamada `statusCallback.NonBlockingCall(...)`, que chega no worker (`audio-capture-worker.ts` linha 74-76) como `emit({ type: 'status', state, detail })` via `parentPort`.

**O ponto onde a informacao morre**: `src/main/audio-exclusion.ts`, handler `worker.on('message', ...)` (linhas 157-170) - `if (message.type === 'status') { if (message.state === 'failed') { escalate(...) } return }`. Qualquer status com `state !== 'failed'` (isto e, TODO status `'active'`, incluindo cada mudanca de composicao com `DescribeAnchors` detalhado) cai no `return` sem nenhuma chamada a `logToFile` ou a qualquer log. So os estados `failed`/degradacao (via `escalate` -> `sendStatus` -> `logToFile`, linhas 190-219) chegam ao arquivo. Ou seja: o motor nativo SABE e REPORTA, frame a frame de composicao, quais PIDs/executaveis estao sendo capturados agora - mas nenhuma dessas mensagens de rotina e persistida; hoje nao ha como abrir o log de campo depois e responder "o audio-exclusion chegou a enxergar/capturar o jogo.exe em algum momento da sessao?".

### 4.E Cadeia de codigo do vazamento no Windows 10 (estado C desde o boot)

Sintoma do relato adicional da IDEA: amigo em Windows 10 transmitindo com audio, espectador ouvindo a PROPRIA VOZ do Discord dele na transmissao (a exclusao nunca vigorou). Cadeia completa, ponta a ponta:

1. `src/main/audio-exclusion.ts` linha 36: `const MIN_WINDOWS_BUILD = 20348` - o build minimo do Windows com WASAPI Process Loopback (Windows 11, todas as edicoes; Windows 10 NUNCA atinge esse build, o maior build de Windows 10 e 19045).
2. `isSupportedWindows()` (linhas 67-71): `if (process.platform !== 'win32') return false; ... return Number.isFinite(build) && build >= MIN_WINDOWS_BUILD` - faz o parse de `os.release()` e compara. Numa maquina Windows 10, isso e SEMPRE `false`.
3. `startAudioExclusion()` (linha 231): `if (!isSupportedWindows()) return unavailable('os-unsupported')` - retorna IMEDIATAMENTE, ANTES de tentar `probeAddon()` ou `spawnWorker(...)`. Numa maquina Windows 10 o worker nativo NUNCA E INICIADO, nem uma vez.
4. `src/shared/ipc.ts` linhas 98-108, tipo `AudioExclusionUnavailableReason`: `'os-unsupported'` e um dos 5 motivos possiveis (`'disabled-by-env' | 'os-unsupported' | 'addon-load-failed' | 'worker-spawn-failed' | 'activation-failed'`), documentado na linha 101-102 como "Build do Windows abaixo de 10.0.20348: sem WASAPI Process Loopback" - o motivo chega ATE o renderer com essa granularidade, mas so como STRING tecnica (nunca vira texto de UI diferenciado; ver passo 5).
5. `src/renderer/src/services/media-manager.ts` linhas 468-478: `const outcome = await this.audioExclusion.start(); exclusion = outcome.session` (fica `null`); `if (!exclusion) { console.warn(\`[media] captura por aplicativo indisponivel (${outcome.reason ?? 'sem motivo'})\`) }` (linhas 472-476) - o `reason` (`'os-unsupported'` neste caso) so aparece nesse `console.warn`, que so existe no log tecnico (DevTools/arquivo de log via `attachRendererLogging`), NUNCA na interface. `const useSystemLoopback = options.withAudio && exclusion === null` (linha 478) fica `true`.
6. Linha 532: `audioMode: !options.withAudio ? 'none' : exclusion ? 'excluded' : 'full-loopback'` resolve para `'full-loopback'` (estado C da secao 4.B) - a transmissao inteira, do PRIMEIRO frame, usa `getDisplayMedia({ audio: true })` do Chromium, sistema inteiro, Discord incluso.
7. O UNICO aviso VISIVEL ao transmissor sobre isso e o toast de INICIO ja mapeado no B2/secao 3 (`RoomScreen.tsx` linhas 211-216, disparado por `transmission.audioMode === 'full-loopback'`) - texto atual "Nao foi possivel isolar o audio do Discord; a transmissao segue com o som do sistema inteiro." Esse toast NAO diferencia a CAUSA (`os-unsupported` vs qualquer outro `AudioExclusionUnavailableReason`) nem persiste alem do `TOAST_TTL_MS` de 4s (`app-store.ts` linha 17) - e o unico ponto de contato entre o `reason` tecnico do passo 4 e o usuario. Isso e exatamente o que a IDEA aponta como MUST re-enquadrado: nao existe aviso a CRIAR (o aviso ja dispara neste caso), existe eficacia a AVALIAR (o amigo de Win10 nao percebeu, mesmo com o toast tendo disparado).

## 5. Integracao / servicos externos

- PeerJS (sinalizacao + wrapper de WebRTC) - mesh P2P, sem servidor de midia (SFU/TURN nao usados hoje, ver secao 7).
- WASAPI (Windows Audio Session API) via `AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK` (Process Loopback, Windows build >= 20348) e loopback classico de endpoint.
- Nenhum servico de nuvem/terceiro no caminho de audio.

## 6. Convencoes

- Identificadores de codigo em **ingles** em toda a base (`MediaManager`, `AudioRingBuffer`, `startTransmission`, `writeFrame`), inclusive nos arquivos novos do addon nativo (`CaptureStream`, `Engine::Reconcile`). Evidencia: `src/renderer/src/services/media-manager.ts` (classe `MediaManager`, metodo `startTransmission`), `native/zoi-audio-capture/src/mixer.h` (classe `AudioRingBuffer`, metodo `Read`), `src/renderer/src/services/audio-exclusion.ts` (funcao `writeFrame`).
- Comentarios e mensagens de log/console/toast em **pt-BR sem acento** (regra do projeto, confirmada em dezenas de `console.warn`/`console.info`/`logToFile` nos arquivos lidos, ex.: `'[media] falha ao aplicar parametros do sender:'`, `'[audio-exclusion] degradando:'`).
- Artefatos do forge (IDEA/CONTEXT/SPEC/CHECKLIST) tambem em pt-BR sem acento - confirmado em `.forge/complete/app-audio-capture/*.md`.
- `code_identifier_language` desta feature: **mirrors-existing-codebase (en)** - qualquer identificador novo do fix deve seguir ingles, comentarios/logs em pt-BR sem acento.

## 7. Restricoes e riscos

- **Superficie de regressao explicita da IDEA**: `app-audio-capture` (captura com exclusao) e `app-sounds-volume` (volume dos sons locais) nao podem quebrar; qualidade/fluidez de video validadas em campo na v0.4.0 sao intocaveis.
- **Guarda e2e critica**: `expectNoDirectionFallbacks` (mencionada em varios CHECKLISTs e no LESSONS) - qualquer mudanca que force reabertura de chamada (`callPeer` de novo, redial) precisa continuar sem disparar o fallback de direcao (pull reverso) em teste. `applyCodecChange` (video) ja refaz TODAS as chamadas de saida; um fix de audio que tambem force redial herda esse mesmo risco.
- **Regra distribuida do projeto**: qualquer degradacao/mudanca silenciosa de estado de midia deve avisar visivelmente (ja documentada nas licoes do `app-audio-capture`: "nunca ficar mudo em silencio"). Um fix que passe a inserir silencio deliberado (crossfade, por exemplo) para evitar clique precisa continuar essa politica de nunca reduzir a percepcao de "esta tudo bem" quando NAO esta.
- **Pilar de performance do projeto**: nada no pipeline de audio roda "por frame" no sentido de trabalho pesado no thread principal do renderer HOJE, exceto o proprio `writeFrame()` de `audio-exclusion.ts`, que roda a cada 10ms no thread principal do renderer (via `onmessage` do `MessagePort`) quando o modo `excluded` esta ativo. Esse mesmo thread principal tambem hospeda: o tick de stats (`QUALITY_UPDATE_INTERVAL_MS = 3000`, com `await getStats()` por conexao), o cursor hub (`CURSOR_SEND_INTERVAL_MS = 40` -> 25Hz de envio, `POINTER_OVERLAY_FRAME_MS = 33` -> ~30Hz de frame agregado quando ponteiros estao ligados), e o React render loop normal do app. Nenhuma medicao existe hoje de quanto esses processos competem pelo main thread do renderer no momento exato em que um frame PCM de 10ms chega e precisa ser escrito no `MediaStreamTrackGenerator` antes do proximo.
- **Downgrade de codec de video por CPU** (`video-codec-upgrade`, `CODEC_CPU_PERSISTENT_SAMPLES`/`CODEC_MAX_DOWNGRADES` em `src/shared/config.ts`) e evidencia INDIRETA de que a maquina do transmissor PODE ficar CPU-limitada durante uma transmissao real (a logica so existe porque isso acontece em campo); CPU-limitada e exatamente a condicao em que threads de captura/mixer nativos (que dependem de agendamento de SO em tempo habil) tendem a atrasar e o `AudioRingBuffer` do lado nativo tende a underrun.
- **5 pessoas simultaneas** na sessao relatada aumenta a carga de: encoding de video de saida (se o relator tambem transmitiu em algum momento), decoding de multiplas streams recebidas, `getStats()` de multiplas conexoes a cada 3s, e potencialmente o `Engine::Reconcile` nativo reagindo a mais sessoes de audio do Windows nascendo/morrendo (jogos/apps de voz abrindo sessoes WASAPI novas) - todos fatores que pressionam exatamente os pontos de descarte silencioso listados na secao 4.
- **Native addon so builda/roda em Windows** (`process.platform !== 'win32'` desativa a exclusao); qualquer fix no C++ exige rebuild nativo (`node-gyp`, toolchain documentada no SPEC da `app-audio-capture`) e nao pode ser validado em CI generico sem essa toolchain.
- **Restricao dura do `file-logger.ts` sobre QUALQUER instrumentacao nova**: `MAX_FILE_BYTES = 5 * 1024 * 1024` (linha 16, 5 MB por dia) e a flag `capped` (linha 26); em `logToFile` (linhas 80-105), quando `currentBytes >= MAX_FILE_BYTES` (linha 93) o modulo escreve UM aviso de teto (linha 96) e entao `capped = true` - a partir dai TODA chamada a `logToFile` pelo resto do dia (ate a virada de arquivo, linha 83-87) e um NO-OP silencioso (`if (capped) return`, linha 88), incluindo logs de outras partes do app, nao so de audio. **Nao existe, em lugar nenhum do arquivo, nenhum mecanismo de throttle/rate-limit/amostragem** (nenhuma funcao de debounce, nenhum contador por-origem, nenhum "logar so 1 a cada N"): a unica defesa contra mensagem individual gigante e o corte por tamanho de UMA linha (`MAX_MESSAGE_LENGTH = 4_000`, linha 18), nao por FREQUENCIA de linhas. Isso significa que qualquer instrumentacao nova que logue por FRAME (a cada 10ms, o mixer nativo, o `ThreadSafeFunction`, o `writeFrame` do renderer) pode sozinha estourar o teto de 5MB/dia em SEGUNDOS se chamada sem um rate-limit proprio, e ao estourar SILENCIA o log do dia inteiro para o app inteiro (nao so para audio) - um rate-limit (amostragem por tempo, contagem, ou log so em MUDANCA de estado em vez de por frame) e MANDATORIO para qualquer log novo no caminho de audio, e precisa ser escrito do zero (nao ha helper reutilizavel hoje).

## 8. Pontos em aberto (o codigo nao responde)

- **U1**: Qual dos TRES estados de captura da secao 4.B (A - `excluded`/`ProcessExclusion`; B - `excluded`/`EndpointLoopback` degradado em runtime; C - `full-loopback` desde o inicio) estava ativo na maquina do transmissor durante a sessao de campo relatada? Nenhum log de campo foi citado na IDEA; sem isso, nao da para saber se o candidato e o pipeline nativo custom (estados A/B, que compartilham todo o `Mixer`/`ThreadSafeFunction`/`MediaStreamTrackGenerator`) ou o pipeline padrao do Chromium (estado C, fora do controle do app).
- **U2**: Nenhum ponto de descarte de frame nos estados A/B (`AudioMode: 'excluded'`) tem log hoje: nem o underrun de `AudioRingBuffer::Read` no `Mixer` (native, silencioso por design), nem o `ThreadSafeFunction` de PCM cheio em `addon.cc` (linha 310-311, `if (status != napi_ok) delete frame` sem nenhum log), nem o `writer.desiredSize <= 0` em `audio-exclusion.ts` (renderer, mesmo comentario sem log). Hoje literalmente NENHUMA evidencia poderia confirmar ou descartar esses tres pontos como causa, mesmo relendo os logs da sessao de campo. Qualquer log novo nesses pontos por-frame precisa nascer com rate-limit proprio (ver secao 7, restricao do `file-logger.ts`).
- **U3**: `stats-monitor.ts` nao coleta NENHUM campo especifico de audio do `getStats()` (nem inbound: `audioLevel`, `jitter`, `concealedSamples`, `concealmentEvents`, `insertedSamplesForDeceleration`, `removedSamplesForAcceleration`, `packetsDiscarded`; nem outbound de audio). `packetsLost`/`packetsReceived`/`bytesReceived` sao somados MISTURANDO audio e video no mesmo acumulador, sem filtro de `kind`. Mesmo que uma sessao futura seja instrumentada, os logs atuais nao teriam como isolar perda/concealment especificos do audio.
- **U4**: O item manual "2.2 Audio sem estalos, cortes ou robotizacao ao longo de 10+ minutos" do `CHECKLIST_MANUAL_app-audio-capture.md` nunca foi marcado (`[ ]`). Nao ha registro de que esse teste tenha sido de fato executado antes do ship da v0.4.0 nem depois - a sessao de fim de semana pode ser a primeira observacao longa dessa dimensao.
- **U5**: O padrao relatado ("as vezes esparso, as vezes varios por minuto") nao tem correlacao conhecida com nenhum evento especifico (entrada/saida de membro, troca de fonte de audio no transmissor, apps abrindo/fechando sessoes WASAPI, picos de CPU). Sem instrumentacao nova, nao da para saber se o padrao segue o `Engine::Reconcile` (1s ou por evento de sessao), o tick de stats (3s), ou e independente de tudo isso.
- **U6**: Nao ha confirmacao de que o(s) OUTRO(s) espectador(es) da sessao tambem ouviram o estalo (P3 da IDEA, ainda sem resposta do usuario) - isso ajudaria a distinguir causa de REDE/RECEPCAO (afetaria so quem tem jitter ruim) de causa de CAPTURA/ENVIO no transmissor (afetaria todo mundo igualmente).
- **U7**: Nao ha registro de qual PC transmitia no momento exato do estalo, nem se era sempre o mesmo transmissor ou variava (P2 da IDEA).
- **U8**: Bitrate/parametros de audio Opus sao 100% o default negociado pelo Chromium (nenhum `maxaveragebitrate`, `stereo`, `useinbandfec`, `dtx` configurado no codigo) - nao ha visibilidade de qual bitrate efetivo o Opus escolheu em campo, nem se caiu para um regime mais agressivo de compressao/PLC (packet loss concealment) sob a carga de 5 pessoas.
- **U9** (do sintoma jogo sem audio / YouTube com audio): qual dos TRES estados da secao 4.B estava ativo nessa sessao especifica - A (`excluded`/`ProcessExclusion`), B (`excluded`/`EndpointLoopback` degradado) ou C (`full-loopback` desde o inicio)? A resposta muda o diagnostico inteiro: so o estado A tem a limitacao fina de composicao por-processo da secao 4.D (perguntas 1-3); os estados B e C dependem so da limitacao de endpoint/role/modo-exclusivo (4.D pergunta 4 revisada), que e mais ampla mas tambem mais simples de checar.
- **U10**: o dispositivo de render efetivo (endpoint + ROLE `eConsole`) do jogo, no momento da transmissao, era de fato o mesmo que `SessionScanner` estava consultando? Nao da para confirmar via codigo; exigiria checar em campo (Configuracoes de Som do Windows > Volume do aplicativo e preferencias de dispositivo, e o mixer de volume por app) se o jogo tinha uma saida diferente configurada (mesmo com "um unico fone" como dispositivo fisico, Windows permite reassociar sessoes por ROLE e por app independentemente do dispositivo fisico ligado).
- **U11**: o jogo relatado usa modo EXCLUSIVO do WASAPI (comum em alguns engines/launchers com "modo exclusivo de audio" ou "audio de baixa latencia")? O codigo nao verifica nem distingue isso em lugar nenhum dos arquivos lidos; se for o caso, nem `excluded` nem `full-loopback` (endpoint classico) capturariam esse audio, porque ambos dependem do motor de mixagem COMPARTILHADO do WASAPI.
- **U12**: nao ha, hoje, log de campo que confirme se `game.exe` chegou a aparecer em `DescribeAnchors`/`capturas=N ...` em algum momento da sessao relatada - a mensagem de status "active" com a composicao detalhada existe no motor nativo mas e descartada sem log em `src/main/audio-exclusion.ts` (`worker.on('message', ...)`, so trata `state === 'failed'`). Sem instrumentar esse ponto, uma sessao de campo futura tambem nao teria como provar isso.
- **U13**: o processo do jogo foi lancado ANTES ou DEPOIS do inicio da transmissao? Se depois, isso testaria o caminho de deteccao por evento/poll da secao 4.D pergunta 3; se antes, o jogo deveria ter sido pego na primeira `Reconcile` da sessao (o mesmo caminho, so que na largada em vez de no meio).
