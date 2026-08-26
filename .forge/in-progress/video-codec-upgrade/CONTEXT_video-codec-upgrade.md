---
feature: video-codec-upgrade
language: pt-BR
code_identifier_language: mirrors-existing-codebase (en)
generated: 2026-08-26
stack: Electron 43.4.1 + React 18 + Vite (electron-vite) + TypeScript, PeerJS 1.5.5, Windows-only
---

## 0. Baseline (ancora de drift)

- `HEAD`: `1e73ffa779cbce50ddd89f84543ccf663c847035` (inalterado)
- IDEA fingerprint (git hash-object): `48a931b77c3d6d048888e94b950056cd38ec7e8b` (re-baseline: a IDEA ganhou decisoes novas em 2026-08-26 apos a primeira geracao deste CONTEXT; hash anterior era `02cffe6ee132d79fa9becce1ac62753b6da370d3`)
- Arquivos de codigo analisados (path - fingerprint):
  - `src/renderer/src/services/media-manager.ts` - `9710f81317464c32df9317dd7045500b4844669b`
  - `src/renderer/src/services/peer-manager.ts` - `6a7bfd57fd771d35f82e5adc75af166dbad983f5`
  - `src/renderer/src/services/ice-diagnostics.ts` - `44dc0fe8e1ed757b5c90bca0e200cab44b9cc367`
  - `src/renderer/src/services/stats-monitor.ts` - `83b2ced2a483fb339204fe0c0a75ee28e23dd958`
  - `src/renderer/src/services/first-frame-watch.ts` - `5a9b7c50ec63ab2c050f34f2e6da56bb2c034275`
  - `src/shared/presets.ts` - `4e07c0a84df20cf850b77912216300b96d8307ea`
  - `src/shared/config.ts` - `a2a2e88a82252bba804ab6fafc69b12c0427a078`
  - `src/shared/protocol.ts` - `09bb2a5e555473cdf6c96a1dd6e254c76f3354b3`
  - `src/shared/ipc.ts` - `ffbc50d3a117f32c3407e823b970248a7e9c61ea`
  - `src/main/settings.ts` - `0a5dbdd9d64c488c5ac3da5dfd5cd25744725a25`
  - `src/renderer/src/ui/components/SettingsModal.tsx` - `10624f22d8f17c94d76841cfb153abf49ea4c475`
  - `src/renderer/src/ui/components/SourcePickerModal.tsx` - `37d0f58372feb617d1546aabb9d6ec36f214fea8`
  - `src/renderer/src/ui/components/TransmittingBar.tsx` - `d2c43378d3ac1de7c12d3a30ba9e62c1282c5f94`
  - `tests/e2e/helpers/zoi-app.ts` - `48df4f186ae4e384db7aa401a73ff98ee3fed79d`
  - `package.json` - `163a9ac74fb41313a515315ff185f570f6b61e67`

## 1. Stack e build

- Electron `43.4.1` (devDependency). Chromium bundlado NAO esta pinado em nenhum arquivo do repo (nao ha registro do numero exato); pela cadencia de release do Electron, a estimativa e Chromium na faixa de 140+, mas isso e uma inferencia externa, nao um fato do repositorio. Verificar em runtime com `process.versions.chrome` (main process) antes de assumir suporte a codec especifico e um dos pontos em aberto (ver secao 8).
- PeerJS `1.5.5` (dependency direta; unica lib WebRTC do projeto).
- React `18.3.1`, Vite `7.3.6` via `electron-vite` `5.0.0`, TypeScript `5.9.3`, Zustand `5.0.15`.
- Dois tsconfigs: `tsconfig.node.json` (main) e `tsconfig.web.json` (renderer + `tests/unit`, SEM types de node - testes unitarios nao podem importar modulos do main).
- Testes: `vitest` (~195 testes, `npx vitest run`), `@playwright/test` `1.62.1` para e2e (`npm run test:e2e`, builda antes: `electron-vite build && playwright test`), 5 specs em `tests/e2e/*.spec.ts`.
- `npm run dist` gera instalador NSIS via `electron-builder` `26.15.3`.

## 2. Arquivos e modulos relevantes

Midia (coracao da feature):
- `src/renderer/src/services/media-manager.ts` - `MediaManager`: `startTransmission` (captura + contentHint fixo `'motion'`), `callPeer` (chamada de saida), `applySenderParameters` (aplica `maxBitrate`/`maxFramerate`/`degradationPreference='maintain-framerate'` via `RTCRtpSender.setParameters`, com polling ate 20x250ms esperando o sender aparecer), `onIncomingCall`/`answerCall` (lado espectador), `answerPull`/`startMediaPull` (chamada reversa/pull), watchdog de midia recebida (`MEDIA_STALL_TIMEOUT_MS`), `createDummyStream` (stream ficticia do pull: canvas 2x2 `captureStream(0)` + audio mudo).
- `src/renderer/src/services/peer-manager.ts` - `PeerManager.call(peerId, stream, metadata)` chama `Peer.call()` do PeerJS direto (sem opcoes extras hoje); e o unico lugar que hoje monta as `CallOption` do PeerJS. `answer()` e chamado em `media-manager.ts` (`call.answer()`), nao aqui.
- `src/renderer/src/services/ice-diagnostics.ts` - `observeIce`/`observePeerJsIce`: liga listeners numa `RTCPeerConnection` (ou objeto do PeerJS que ainda nao tem uma), loga estado de conexao e UM `getStats()` pontual ao conectar/falhar. Ponto natural para logar o codec negociado (o report `outbound-rtp`/`inbound-rtp`/`codec` do mesmo `getStats()`).
- `src/renderer/src/services/stats-monitor.ts` - `StatsMonitor.sample()`: a cada 3s le `getStats()` das conexoes de ENTRADA (`inboundEntries()`), acumula bitrate/perda/RTT e ja extrai `framesDecoded`/`framesReceived` do `inbound-rtp` de video POR txId (comentario explicito no arquivo, linha ~27-31, apontando este exato ponto de extensao: campos novos tipo `decoderImplementation` entram aqui, e um `outboundEntries` simetrico serviria o lado de saida no MESMO monitor).
- `src/renderer/src/services/first-frame-watch.ts` - `FirstFrameWatch`: maquina de estados do aviso de "sem quadro" no player (nao le stats diretamente; recebe sinais via `reportFramePainted`/`reportFramesDecoded` de fora).

Config/protocolo:
- `src/shared/presets.ts` - `PRESETS`/`PRESET_LIST`/`DEFAULT_PRESET_ID`: cada preset define `width`/`height`/`frameRate`/`maxBitrate` (teto).
- `src/shared/config.ts` - constantes de timing; `PEER_OPTIONS` (unico ponto de config do cliente PeerJS: sem TURN, so STUN do Google).
- `src/shared/protocol.ts` - `PROTOCOL_VERSION = 1`, `TxStartPayload` (carrega `presetId`, nao carrega nada de codec hoje). Os type guards estruturais (`isTxStartPayload` etc.) checam apenas os campos OBRIGATORIOS de cada payload e TOLERAM campos extras nao verificados; o que rejeita e um enum FECHADO checado via `isOneOf` (ex.: `PresetId`, `SourceKind`). Ou seja: um campo NOVO e opcional (ex.: capability announcement de codec) e mudanca so-pra-frente segura desde que nao mexa em nenhum enum existente; mudar/estender um enum ja checado por `isOneOf` (como `PresetId`) e o que quebraria clientes antigos.
- `src/shared/ipc.ts` - contrato IPC main/preload/renderer; `AppSettings` (`nickname`, `installId`, `soundVolume`) e `SettingsSetRequest` (campos parciais, so os presentes sao aplicados).

Settings/persistencia:
- `src/main/settings.ts` - `getSettings`/`setNickname`/`setSoundVolume`: persistencia em `userData/settings.json`, escrita atomica (`.tmp` + rename), cache em memoria no main process. Adicionar o campo novo do escape "forcar VP8" (persistido; modo nitidez NAO persiste, ver secao 8) segue o MESMO padrao: estender `AppSettings`, uma funcao `setX` dedicada, `writeToDisk` com merge no objeto atual. DECIDIDO: esse escape nao e so local de transmissao, ele tambem afeta RECEPCAO - uma maquina com o escape ligado transmite VP8 E anuncia para a sala, pelo mesh, que so aceita VP8 (capability announcement), o que deve influenciar a escolha de codec do transmissor para aquele espectador. O campo do protocolo para esse anuncio e o mesmo tipo de extensao opcional discutida na secao 7 (compat via `TxStartPayload` ou payload novo, nunca mudando um enum fechado existente).
- Round-trip pela UI: `window.zoi.settings.set({...})` (IPC, ver `SettingsModal.tsx` linha ~52 e ~65) - NAO e `localStorage`, e IPC para o main process.

UI:
- `src/renderer/src/ui/components/SettingsModal.tsx` - modal de configuracoes; hoje tem apelido, volume dos sons, versao/update, botao "abrir pasta de logs". Escape "forcar VP8" cabe aqui como mais um controle persistido via `window.zoi.settings.set`.
- `src/renderer/src/ui/components/SourcePickerModal.tsx` - modal de escolha de fonte; ja tem um segmented control de "Qualidade" (`PRESET_LIST`) e um switch de audio (`z-switch`, `role="switch"`, linhas 158-175). NAO e mais o destino do toggle "modo nitidez" (decidido: o toggle vive na `TransmittingBar`, ver bullet abaixo); este arquivo serve apenas de REFERENCIA VISUAL para o padrao `z-switch` a reaproveitar la.
- `src/renderer/src/ui/components/TransmittingBar.tsx` - barra fixa "voce esta transmitindo"; mostra `sourceLabel`/`presetLabel`/audio (memo simples, sem estado proprio hoje). DECIDIDO: e aqui que mora o toggle "modo nitidez" (`z-switch`, reaproveitando o padrao visual do audio-toggle do `SourcePickerModal`), trocavel AO VIVO durante a transmissao (contentHint/degradationPreference reaplicados no sender em runtime, sem parar/reiniciar a transmissao) e SEM persistencia: sempre comeca desligado a cada nova transmissao, nunca lembra a escolha anterior.

Testes:
- `tests/unit/media-manager.test.ts`, `tests/unit/stats-monitor.test.ts`, `tests/unit/ice-diagnostics.test.ts`, `tests/unit/presets.test.ts`, `tests/unit/protocol.test.ts` - cobrem os modulos centrais desta feature.
- `tests/e2e/helpers/zoi-app.ts` - `expectNoDirectionFallbacks` (linha 274-284) falha o teste se QUALQUER linha de console contiver `'media-pull'`, `'dialback'`, `'discando de volta'` ou `'na outra direcao'` (marcas definidas em `DIRECTION_FALLBACK_MARKS`, linha 49) - ou seja, os 5 specs e2e ja fazem uma assercao geral de "nenhum fallback de direcao disparou em rede saudavel"; qualquer log novo desta feature que reuse essas palavras por acidente quebraria testes existentes.

## 3. Padroes/features similares existentes

- **hq-presets** (`.forge/complete/hq-presets/`) e o precedente mais proximo: adicionou presets com bitrate maior aplicados via o MESMO `applySenderParameters` (RTCRtpSender.setParameters, RF-24: parametros identicos em todos os senders). O padrao "parametro novo -> mesma funcao de aplicacao, sem timing especial" e o que esta feature deve seguir para bitrate/framerate; codec e outra categoria (afeta a SDP antes da negociacao, nao os parametros do sender depois).
- **black-screen-notice** (`.forge/complete/black-screen-notice/`) e a referencia direta para diagnostico pos-conexao: `FirstFrameWatch` + `StatsMonitor.sample()` ja leem `framesDecoded`/`framesReceived` do `inbound-rtp` de video, por txId, no MESMO getStats (sem laco paralelo). O comentario em `stats-monitor.ts` (linhas 27-31) e um convite explicito do codigo: "campos novos do mesmo report inbound-rtp (ex.: decoderImplementation) entram AQUI; leitura do lado de saida ganha um outboundEntries simetrico neste MESMO monitor, nunca um coletor paralelo". Isso responde diretamente a P1 da IDEA (verificacao pos-conexao via getStats): reaproveitar `StatsMonitor`, nao criar estrutura nova.
- Watchdog de midia (`MEDIA_STALL_TIMEOUT_MS`, `IncomingWatch` em `media-manager.ts`) e o espirito que a IDEA quer para "CPU alta -> rebaixar codec": hoje ele so decide "chegou midia ou nao" e aciona `startMediaPull`; um gatilho de rebaixamento por `qualityLimitationReason=='cpu'` seria um vigia irmao, nao uma reforma do existente.
- Persistencia de settings (`src/main/settings.ts` + `src/shared/ipc.ts` + `SettingsModal.tsx`) e o padrao a copiar para o escape "forcar VP8": schema em `AppSettings`, setter dedicado no main, canal IPC (`settings:set`), controle na UI. DECIDIDO: o escape e bidirecional (transmite VP8 E anuncia "so aceito VP8" pelo mesh para influenciar o que o transmissor manda para essa maquina) - ver o cruzamento com o anuncio de capacidade via protocolo na secao 7.

## 4. Arquitetura e dados

- **Chamada direta (transmissor -> espectador)**: `MediaManager.startTransmission` captura -> `session.announceTransmissionStart` (TX_START pelo mesh) -> `callPeer(peerId)` para cada membro -> `PeerManager.call()` -> `Peer.call(peerId, stream, { metadata: { txId } })` do PeerJS. **O transmissor e o originador da oferta (SDP offer)** nesse caminho.
- **Resposta do espectador**: `onIncomingCall` -> `answerCall` -> `call.answer()` (sem stream, chamada unidirecional) -> PeerJS cria a resposta (SDP answer) na `RTCPeerConnection` do ESPECTADOR.
- **Chamada reversa/pull** (fallback de direcao, quando o ICE da chamada direta nunca fecha): `startMediaPull` roda no ESPECTADOR, cria uma stream ficticia (`createDummyStream`) e chama `session.callPeer(txPeerId, dummy.stream, { txId, pull: true })` - **aqui o ESPECTADOR e o originador da oferta**. O transmissor recebe em `onIncomingCall` -> detecta `metadata.pull === true` -> `answerPull` -> `call.answer(transmission.stream)` **com a stream REAL de transmissao** na resposta. Ou seja: a direcao de quem oferta/responde se INVERTE no pull, mas quem tem a midia "de verdade" (a stream de tela) e sempre o transmissor, seja como originador (chamada direta) ou como quem responde (pull). Qualquer preferencia de codec centrada no "lado transmissor" precisa vestir os DOIS papeis: originador em `callPeer`/`PeerManager.call()`, e respondente em `answerPull`/`call.answer()`.
- **Renegociacao ao trocar fonte/preset**: `switchSource` = `stopTransmission` + `startTransmission` inteiro (fecha todas as chamadas de saida e abre novas do zero, com um `txId` novo). Nao ha renegociacao SDP incremental hoje - e "parar e comecar de novo", entao qualquer decisao de codec recalculada na troca de fonte e naturalmente coberta (roda tudo de novo, mesmo caminho do `startTransmission`).
- **Onde a `RTCPeerConnection` fica acessivel**: via `call.peerConnection` (propriedade do PeerJS `MediaConnection`), que so existe depois que `Negotiator.startConnection()` roda (ver secao 7 para o timing exato). `applySenderParameters` ja poll-a essa propriedade com retry (`setTimeout(apply, 250)`, ate 20 tentativas) porque a implementacao considera que o sender pode nao estar pronto ainda; `observePeerJsIce`/`observeIce` fazem o mesmo padrao de espera para instrumentar a conexao.
- Nenhum SFU/media server: N conexoes diretas do transmissor (uma por espectador), mesmo codec teria que ser recalculado ou reusado por conexao/sender individualmente se a escolha variar por par.

## 5. Pontos de integracao / servicos externos

- Servidor de sinalizacao publico do PeerJS: `0.peerjs.com` (nenhuma URL custom em `PEER_OPTIONS`, so o STUN).
- STUN publico do Google (`stun.l.google.com:19302`, `stun1.l.google.com:19302`). Sem TURN (decisao RF-42, documentada na IDEA).
- GitHub Releases (`Pontinn/zoi-da-goiaba`) para auto-update via `electron-updater`.
- Nenhum servico externo de codec/hardware detection; tudo seria via APIs nativas do Chromium (`navigator.mediaCapabilities`, `RTCRtpSender.getCapabilities`) embutidas no proprio Electron.

## 6. Convencoes

- **Identificadores de codigo em ingles**, estilo camelCase para funcoes/variaveis, PascalCase para classes/tipos/componentes React. Evidencia real: `startTransmission`, `applySenderParameters`, `MediaManager`, `PeerManager`, `StatsMonitor`, `FirstFrameWatch`, `InboundVideoStats`, `CallMetadata`.
- Comentarios e strings de UI: pt-BR sem acentos, sem travessao (em dash) - regra do usuario, ja seguida 100% nos arquivos lidos.
- Modulos de servico sao classes com metodos publicos de consulta/comando e privados de mecanismo interno (`MediaManager`, `PeerManager`, `StatsMonitor` seguem esse molde); efeitos colaterais (timers, listeners) sempre tem uma funcao de descarte explicita retornada (`observeIce` retorna `() => void`, `subscribeStreams` retorna unsubscribe).
- Erros de dominio sao classes proprias (`TransmissionInProgressError`, `CaptureFailedError`, `SignalingError`, `RoomCodeUnavailableError`, `NicknameValidationError`) com `.name` setado manualmente.
- Testes unitarios: um arquivo por modulo de servico em `tests/unit/`, nomeados igual ao modulo (`media-manager.test.ts` para `media-manager.ts`). Vitest, ambiente node/jsdom conforme `tsconfig.web.json` (sem tipos de node - nada de `import` de modulos do main em teste unit).
- E2E: Playwright `_electron`, specs em `tests/e2e/*.spec.ts`, helper central `tests/e2e/helpers/zoi-app.ts` com utilitarios como `expectNoDirectionFallbacks`, `wakePlayerControls`, `pace()` (pacing controlavel por env var para execucao "assistida").

## 7. Restricoes e riscos

- **Timing do PeerJS 1.5.5 e um risco tecnico central, verificado no codigo-fonte instalado** (`node_modules/peerjs/dist/bundler.mjs`):
  - `Peer.call(peer, stream, options)` constroi um `MediaConnection` de forma SINCRONA, cujo construtor chama `Negotiator.startConnection()` tambem de forma sincrona. `startConnection` cria a `RTCPeerConnection`, ja atribui `connection.peerConnection` e ja adiciona as tracks (`addTrack`) - tudo isso ANTES de `call()` devolver o objeto ao chamador. Ou seja, `call.peerConnection` e os `senders` JA existem no mesmo tick em que `session.callPeer()`/`PeerManager.call()` retornam (o polling de 250ms em `applySenderParameters` parece defensivo/legado, nao estritamente necessario para o caso feliz - mas nao ha garantia formal disso em toda plataforma, entao manter o padrao de retry e mais seguro).
  - Logo depois, ainda de forma sincrona dentro do construtor, `startConnection` chama `this._makeOffer()` (funcao `async`, NAO aguardada = "fire and forget"). Funcoes `async` em JS executam de forma SINCRONA ate o primeiro `await`; a primeira linha de `_makeOffer` e `await peerConnection.createOffer(...)`. **Isso significa que `createOffer()` ja foi CHAMADO antes de `Peer.call()` devolver o `MediaConnection` ao codigo do app.** Nao ha nenhuma janela, de fora do PeerJS, para chamar `RTCRtpTransceiver.setCodecPreferences()` ANTES da oferta ser criada - a API de preferencia de codec via transceiver so funciona se chamada antes de `createOffer`, e essa janela ja fechou pelo momento em que o app tem acesso a `call`/`call.peerConnection`.
  - **O hook que o PeerJS 1.5.5 realmente oferece e `options.sdpTransform` (uma `Function`)**, aceito TANTO em `Peer.call(peer, stream, { sdpTransform })` (aplicado em `_makeOffer`, apos `createOffer` e antes de `setLocalDescription`, linha ~837 do bundler) QUANTO em `call.answer(stream, { sdpTransform })` (aplicado em `_makeAnswer`, mesmo padrao, linha ~879, e `answer()` mescla essa opcao em `this.options.sdpTransform` mesmo chegando depois do `_negotiator` ja existir). Confirmado nos tipos publicos (`node_modules/peerjs/dist/types.d.ts`, `CallOption.sdpTransform` linha 377, `AnswerOption.sdpTransform` linha 335) e usado simetricamente nos dois sentidos.
  - **Conclusao pratica para a SPEC**: a via viavel com a versao instalada e SDP munging via `sdpTransform` (reordenar as linhas `m=video`/payload types no texto do SDP para colocar o codec preferido primeiro), passado tanto em `PeerManager.call()` (oferta do transmissor OU do espectador no pull) quanto em `call.answer()` (resposta do espectador OU do transmissor no pull). `RTCRtpSender.getCapabilities('video')` continua util so para SABER quais codecs/perfis o browser local declara suportar (nao para aplicar preferencia via transceiver, dado o timing acima). Se `setCodecPreferences` for mesmo desejado (mais robusto que munging de texto), a unica forma seria alguma tecnica de pre-criar a `RTCPeerConnection`/transceivers ANTES de chamar `peer.call()` - o que a API publica do PeerJS 1.5.5 nao expoe (nao ha hook de "peerConnection factory" nem de "before offer"); teria que ser investigado se um upgrade de versao do PeerJS muda isso, ou se compensa uma pequena camada propria por cima do `Peer.call` (fora do escopo de investigacao deste CONTEXT).
- **Nao regredir os fallbacks de direcao**: `expectNoDirectionFallbacks` (`tests/e2e/helpers/zoi-app.ts:274`) falha se aparecer `'media-pull'`, `'dialback'`, `'discando de volta'` ou `'na outra direcao'` no console em qualquer um dos 5 specs e2e. A introducao de `sdpTransform`/deteccao de codec no `answerPull`/`startMediaPull` nao pode, por si so, gerar log com essas marcas fora do caminho de fallback real.
- **Compat de protocolo**: `PROTOCOL_VERSION = 1`; qualquer anuncio de capacidade de codec pelo mesh (incluindo o anuncio "so aceito VP8" do escape de compatibilidade, DECIDIDO como bidirecional - ver secao 2/3) precisa ser um campo NOVO e opcional em algum payload (ex. `TxStartPayload`, ou um payload novo) para nao quebrar `isTxStartPayload`/clientes antigos - os guards toleram campo extra nao verificado; o que quebraria a compat so-pra-frente e mudar um enum FECHADO ja checado por `isOneOf` (ex. `PresetId`), nao adicionar um campo.
- **Custo de CPU no transmissor**: pilar do projeto. N copias = N `RTCPeerConnection`/encoders logicos (mas WebRTC tipicamente reusa UM encoder de video compartilhado entre simulcast/multiplos senders da MESMA track quando os parametros sao iguais - a extensao real depende de como o Chromium implementa; nao verificado no codigo do projeto, e comportamento do proprio Chromium). Trocar para AV1/VP9 em SOFTWARE e o cenario que a IDEA explicitamente teme (pode piorar o travamento em maquina fraca); a decisao de codec **precisa** ser por maquina, nunca fixa global (ja e requisito confirmado na IDEA, secao 2, decisao de 2026-08-25).
- **Presets sao apenas resolucao/fps/bitrate hoje**: `QualityPreset` (`src/shared/presets.ts`) nao tem campo de codec. Se a escolha de codec ficar amarrada ao preset (em vez de a maquina), isso implica estender essa interface - decisao de SPEC, nao resolvida aqui.

## 8. Pontos em aberto (o codigo nao responde)

- Chromium major exato empacotado no Electron 43.4.1 (nao esta pinado em nenhum arquivo do repo; so verificavel em runtime via `process.versions.chrome`).
- Disponibilidade real de encoder de hardware (AV1/VP9/H264 QuickSync) nas maquinas dos amigos do grupo - so testavel em campo, nao inferivel do codigo.
- Se `RTCRtpTransceiver.setCodecPreferences` e mesmo necessario (vs. `sdpTransform` bastar) - depende de quanto controle fino a SPEC decidir que precisa; nao resolvido pelo codigo instalado.
- Se compensa investigar upgrade do PeerJS (>1.5.5) para expor algum hook "antes da oferta" mais limpo - nao verificado (fora do escopo desta exploracao; so o 1.5.5 instalado foi inspecionado).
- Se o Chromium do Electron 43 realmente compartilha UM encoder por track entre as N `RTCPeerConnection` do fanout, ou se paga N vezes o custo de encode - comportamento interno do Chromium, nao verificavel no codigo do projeto.
