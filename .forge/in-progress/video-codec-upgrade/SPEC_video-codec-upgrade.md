---
feature: video-codec-upgrade
language: pt-BR
generated: 2026-08-26
stack: Electron 43.4.1 + React 18 + Vite (electron-vite) + TypeScript 5.9, PeerJS 1.5.5, Vitest + Playwright _electron, Windows-only
status: spec
prd_source: PRD_video-codec-upgrade.md @ c4fb5675bbc6b70e5dc21bbb3a26febce916b7b1
---

# SPEC - video-codec-upgrade

## 1. Baseline (ancora de drift)

- **HEAD**: `a947d00eee99f7bdd66509f3c25d499c10e9d96b`
- Documentos de entrada (git hash-object):
  - `.forge/ideas/video-codec-upgrade/PRD_video-codec-upgrade.md` - `c4fb5675bbc6b70e5dc21bbb3a26febce916b7b1`
  - `.forge/ideas/video-codec-upgrade/CONTEXT_video-codec-upgrade.md` - `d2c7b857fef567db36c5f1ab46204c00b67e02db`
  - `.forge/ideas/video-codec-upgrade/UISPEC_video-codec-upgrade.md` - `5e449eded69dd1f981df1156f713d17444b4d8e2`
  - `.forge/ideas/video-codec-upgrade/IDEA_video-codec-upgrade.md` - `febc949c459df55f4f722b44fc5e46958722df18`
  - `.forge/LESSONS.md` - `fd80d0424a094d89a9f5bc317a71d356809ac687`
- Arquivos de codigo dos quais esta SPEC depende (path - fingerprint):
  - `src/renderer/src/services/media-manager.ts` - `9710f81317464c32df9317dd7045500b4844669b`
  - `src/renderer/src/services/peer-manager.ts` - `6a7bfd57fd771d35f82e5adc75af166dbad983f5`
  - `src/renderer/src/services/session.ts` - `735865c17f23ec28db0087bad82229b110d6489e`
  - `src/renderer/src/services/stats-monitor.ts` - `83b2ced2a483fb339204fe0c0a75ee28e23dd958`
  - `src/renderer/src/services/ice-diagnostics.ts` - `44dc0fe8e1ed757b5c90bca0e200cab44b9cc367`
  - `src/renderer/src/services/sound-player.ts` - `1ecf3b04f9490406e95d0edfd6060ae67ab3ab6e`
  - `src/renderer/src/core/room-state.ts` - `6305e45922f29c380910f398cada47f4f5df0fae`
  - `src/shared/protocol.ts` - `09bb2a5e555473cdf6c96a1dd6e254c76f3354b3`
  - `src/shared/ipc.ts` - `ffbc50d3a117f32c3407e823b970248a7e9c61ea`
  - `src/shared/config.ts` - `a2a2e88a82252bba804ab6fafc69b12c0427a078`
  - `src/shared/presets.ts` - `4e07c0a84df20cf850b77912216300b96d8307ea`
  - `src/shared/sounds.ts` - `6036242f5a185e668fb49d6371693122a9921941`
  - `src/main/settings.ts` - `0a5dbdd9d64c488c5ac3da5dfd5cd25744725a25`
  - `src/main/ipc-handlers.ts` - `a4fab1988b05f264b8aa63e34dddfdf357496d71`
  - `src/main/index.ts` - `3b41b87be749cca8ab2439a2fce3e1ec835a2bfd`
  - `src/preload/index.ts` - `3b47597a76b46c4eddabfda294d9c737fe226bd6`
  - `src/renderer/src/App.tsx` - `da01bc992ed0d2a276e973f0a86077e0db9437b7`
  - `src/renderer/src/ui/components/SettingsModal.tsx` - `10624f22d8f17c94d76841cfb153abf49ea4c475`
  - `src/renderer/src/ui/components/TransmittingBar.tsx` - `d2c43378d3ac1de7c12d3a30ba9e62c1282c5f94`
  - `src/renderer/src/ui/components/SourcePickerModal.tsx` - `37d0f58372feb617d1546aabb9d6ec36f214fea8`
  - `src/renderer/src/ui/screens/RoomScreen.tsx` - `8ab4a7a00d5122c1050fe5e0fc3ae34e0168020f`
  - `src/renderer/src/ui/screens/room.css` - `6c8d1f62744a37feb513e96d15421eb86db49e0c`
  - `tests/e2e/helpers/zoi-app.ts` - `48df4f186ae4e384db7aa401a73ff98ee3fed79d`
  - `package.json` - `163a9ac74fb41313a515315ff185f570f6b61e67`

Sem drift de codigo: todos os fingerprints de codigo batem com os registrados no CONTEXT (baseline `1e73ffa`). Os commits entre `1e73ffa` e `a947d00` sao so documentacao do forge.

Caminho do `z-switch`: `src/renderer/src/ui/screens/room.css`, bloco `.z-switch` nas linhas 578-643 (verificado por leitura). O UISPEC ja carrega esse caminho corrigido na revisao de 2026-08-26 registrada acima.

---

## 2. Visao geral do desenho

**Convencao de identificadores**: identificadores de codigo (tipos, funcoes, variaveis, campos de payload, classes CSS) em INGLES, camelCase para funcoes/variaveis, PascalCase para tipos/classes/componentes, SCREAMING_SNAKE para constantes - espelhando o codigo existente (`startTransmission`, `applySenderParameters`, `InboundVideoStats`, `MEDIA_STALL_TIMEOUT_MS`). Strings de UI, comentarios de codigo, mensagens de log e mensagens de commit em pt-BR SEM acentos e SEM travessao.

A feature tem cinco pecas, todas penduradas em mecanismos que ja existem:

1. **Sondagem de capacidade (por maquina)** - modulo novo `codec-capabilities.ts` no renderer, com DUAS sondagens separadas de proposito, porque servem a papeis diferentes:
   - **DECODE** (`ensureDecodeProbe()`): roda UMA vez no BOOT do app, nao depende de preset nem de estar transmitindo. E o que alimenta o anuncio `decodes` de todo membro, inclusive de quem nunca transmite (o caso primario: 1 transmissor + N espectadores). Usa uma configuracao de referencia fixa (`DECODE_PROBE_VIDEO`), porque decodificar e propriedade da MAQUINA, nao do preset que outra pessoa escolheu.
   - **ENCODE** (`ensureEncodeProbe(presetId)`): roda quando a maquina vai TRANSMITIR, cacheada por preset, porque `encodingInfo` recebe largura/altura/fps/bitrate do preset escolhido.
   As duas usam `navigator.mediaCapabilities` cruzado com `RTCRtpSender.getCapabilities('video')`. Nada roda por quadro.
2. **Anuncio de capacidade de decodificacao pelo mesh** - campo NOVO e OPCIONAL `decodes` no payload `QUALITY_UPDATE`, que TODO membro ja transmite a cada 3s (`StatsMonitor.sample` -> `LOCAL_QUALITY` -> broadcast). Zero mensagem nova, zero enum tocado. O reducer guarda em `RoomState.decodeCapabilities`, espelhando exatamente o que ja faz com `quality`.
3. **Escolha e aplicacao do codec** - o transmissor escolhe UM codec para a sala (funcao pura `pickRoomCodec`) e aplica por SDP munging via `options.sdpTransform` do PeerJS. **Quando o codec escolhido e VP8, NENHUM `sdpTransform` e passado em lugar nenhum**: o caminho continua byte a byte identico ao de hoje (que ja negocia VP8 sem munging), o que protege a persona mais fraca e faz do modo compatibilidade um retorno exato ao comportamento atual. O codec escolhido viaja no campo NOVO e OPCIONAL `videoCodec` do `TX_START`, para o espectador saber o que pedir quando ELE for o ofertante (caminho pull).
4. **Observabilidade e rebaixamento automatico** - o `StatsMonitor` ganha um laco simetrico de SAIDA (`outboundEntries`) no MESMO tick de 3s que ja existe. De la saem os logs de RF-11/RF-21 e o gatilho de `qualityLimitationReason === 'cpu'` persistente, que rebaixa o codec e refaz as chamadas de saida usando o mesmo `callPeer` de sempre.
5. **Modo nitidez** - estado de sessao no `MediaManager`, aplicado ao vivo (`videoTrack.contentHint` + `degradationPreference` do sender), com toggle na TransmittingBar.

Mecanismos deliberadamente NAO tocados: mesh race-to-open, dial-back de admissao, `startMediaPull`/`markMediaFailure` (o watchdog de midia recebida), `FirstFrameWatch`, presets, audio.

Fluxo do caminho feliz (transmissor A, espectadores B e C):

```
A, B e C: boot do app
   -> ensureDecodeProbe()   (uma vez, sem preset, transmitindo ou nao)
B e C: a cada 3s na sala
   -> QUALITY_UPDATE { ..., decodes: ['AV1','VP9','H264','VP8'] }
A: startTransmission
   -> ensureEncodeProbe(presetId)           (cacheado por preset)
   -> pickRoomCodec(candidatos de A, decodes de B e C)  => 'AV1'
   -> transmission.videoCodec = 'AV1'
   -> announceTransmissionStart({..., videoCodec: 'AV1'})    (TX_START pelo mesh)
   -> callPeer(B) / callPeer(C) com sdpTransform = preferVideoCodec(sdp, 'AV1')
      (se o codec fosse 'VP8', NENHUM sdpTransform seria passado)
B: onIncomingCall -> answerCall
   -> call.answer()   (intocado: a resposta do Chromium ja espelha a ordem da oferta)
A: StatsMonitor tick (3s)
   -> outbound-rtp: codec=video/AV1 encoderImplementation=... qualityLimitationReason=none
   -> log [codec] por conexao; watcher de cpu; reviewRoomCodec()
```

---

## 2b. Mapa de ciclo de vida das entidades

### 2b.1 `forceVp8` (escape "modo compatibilidade", PERSISTIDO)

| Etapa | Onde | Como |
|---|---|---|
| Criar | `src/main/settings.ts` `getSettings()` | Primeira execucao grava `forceVp8: false` junto de `installId`. Arquivo antigo sem o campo: `normalizeForceVp8(undefined)` devolve `false` (nunca invalida o arquivo, mesmo tratamento do `soundVolume`). |
| Ler (boot) | `src/renderer/src/App.tsx` `bootstrap()` | `window.zoi.settings.get()` ja e chamado; passa `settings.forceVp8` para `setForceVp8(...)` do modulo `codec-capabilities.ts` (espelho exato de `setSoundVolume(settings.soundVolume)`). |
| Ler (UI) | `SettingsModal.tsx` | `useState(() => isForceVp8())` no mount do formulario. O modal so monta aberto, entao nasce sempre com o valor vigente (mesmo padrao do slider de volume). |
| Atualizar | `SettingsModal.tsx` -> `setForceVp8(next)` + `window.zoi.settings.set({ forceVp8: next })` | Estado local do modulo muda na hora (o anuncio do proximo tick de 3s ja sai VP8-only); a persistencia e assincrona. Falha do IPC: reverte o estado local e mostra toast. |
| Propagar | `subscribeForceVp8` | `MediaManager` assina no construtor: ligar o escape durante uma transmissao rebaixa para VP8 imediatamente (mesma mecanica de rebaixamento). Desligar NAO promove nada (regra monotonica, secao 6). |
| Apagar | N/A | O campo nunca e removido; so some se o usuario apagar `settings.json` (ai volta ao default `false`). |

Prova de ida e volta (RF-15/AC-13): ligar -> fechar o app -> reabrir -> `settings.get()` devolve `true` -> `isForceVp8()` devolve `true` -> o switch do modal nasce ligado.

### 2b.2 `sharpness` (modo nitidez, ESCOPO DE SESSAO)

| Etapa | Onde | Como |
|---|---|---|
| Criar | `MediaManager.startTransmission` | `this.sharpness = false` SEMPRE, na primeira linha depois da checagem de `TransmissionInProgressError` (RF-19: toda transmissao nova comeca desligada). |
| Ler | `MediaManager.applySenderParameters` e `TransmittingBar` | O sender novo (membro que entrou, redial de rebaixamento) herda o estado corrente. A UI le do estado local do `RoomScreen`. |
| Atualizar | `MediaManager.setSharpnessMode(on)` | Ao vivo: `contentHint` na track + `degradationPreference` em todos os senders de video das chamadas de saida. Sem parar/reiniciar a transmissao. |
| Destruir | `stopTransmission` / `teardown` | `this.sharpness = false`. O `RoomScreen` zera o estado local quando `localTx?.txId` muda. |
| Persistir | N/A por decisao | Nunca vai para `AppSettings` nem para `localStorage` (RF-19). |

### 2b.3 `decodeCapabilities` (anuncio por par, ESCOPO DE SALA)

| Etapa | Onde | Como |
|---|---|---|
| Criar | `room-state.ts`, case `QUALITY_UPDATE` | Primeiro `QUALITY_UPDATE` de um membro com `decodes` cria a entrada `peerId -> VideoCodecId[]`. Membro sem o campo (versao antiga): entrada NAO criada; o consumidor le a ausencia como `['VP8']` (RF-06). |
| Ler | `MediaManager` via `session.getState().decodeCapabilities` | Sempre pelo helper `memberDecodes(now)` (5.C6), em `startTransmission` e em `reviewRoomCodec()` (tick de 3s). Membro sem entrada e tratado por CARENCIA POR MEMBRO: dentro de `CODEC_MEMBER_GRACE_MS` desde que foi visto no roster pela primeira vez, ele fica FORA da conta (ainda pode estar a caminho); depois disso, conta como `['VP8']` (RF-06). |
| Atualizar | mesmo case | Cada tick de 3s do par sobrescreve a lista (e como o escape ligado ao vivo converge em <= 3s). |
| Apagar | 3 pontos de poda ja existentes | `room-state.ts:919-920` (ROSTER_UPDATE com membros removidos), `:1142-1143` (dono que saiu), `:1278-1279` (remocao/kick/ban): adicionar `decodeCapabilities: withoutKeys(...)` ao lado de `quality:`. Sala nova zera pelo `createInitialState`. |
| Persistir | N/A por decisao | E estado volatil de sala; reanunciado a cada 3s. |

---

## 3. Trade-offs e alternativas rejeitadas

**T1. sdpTransform vs upgrade do PeerJS vs fork (COMO aplicar a preferencia).**
Escolhido: `options.sdpTransform` do PeerJS 1.5.5, com reordenacao (nunca remocao) dos payload types da secao `m=video`.
Rejeitado: `RTCRtpTransceiver.setCodecPreferences()` - o CONTEXT provou no bundle instalado (`node_modules/peerjs/dist/bundler.mjs`) que `Peer.call()` chama `Negotiator.startConnection()` de forma sincrona e que `_makeOffer` ja executou `createOffer()` antes de o app receber o objeto `MediaConnection`: a janela para `setCodecPreferences` ja fechou. Rejeitado: subir de versao do PeerJS ou forkar - custo e risco de regressao no caminho de midia recem estabilizado em campo (fallbacks de direcao) sem ganho comprovado; `sdpTransform` esta presente e simetrico nos dois sentidos (`bundler.mjs:837` na oferta, `:879` na resposta, `:1057` no merge do `answer`). Rejeitado: SDP munging que REMOVE payload types (forcaria o codec de forma mais dura na resposta do pull) - remover PT quebra a negociacao com facilidade e nao ha teste de campo barato; a reordenacao e a tecnica classica, aceita pelo `setLocalDescription` do Chromium, e o proprio PeerJS ja protege (`offer.sdp = transform(offer.sdp) || offer.sdp`, ou seja, retorno falsy mantem o SDP original).

**T2. AV1-first vs VP9-first vs "so hardware" (P2).**
Escolhido: escada unica de prioridade `AV1 > VP9 > H264 > VP8`, com um filtro duro: **so entra na escada o codec cujo encoder e de HARDWARE nesta maquina** (`encodingInfo.powerEfficient === true`). Sem nenhum encoder de hardware elegivel, a maquina fica em **VP8**, exatamente como hoje.
Rejeitado: VP9 por software como degrau intermediario ("VP9 e um bom equilibrio em software"). Motivo: a PRD (RF-02) manda nunca forcar codec pesado por software e, em duvida, permanecer em VP8; a metrica de nao-regressao (RNF-01/AC-20) e observacional, sem harness de benchmark, entao adotar software seria adotar risco de queda de fps sem instrumento para provar o contrario ANTES do campo. Rejeitado tambem "AV1 sempre que negociavel": AV1 por software e justamente o cenario que a IDEA teme no notebook fraco. Consequencia aceita: numa maquina forte SEM encoder de hardware moderno (ex.: GPU antiga), a feature nao melhora a imagem - fica igual a hoje. E a troca UX-first correta: nunca piorar fluidez para tentar melhorar imagem.

**T3. Codec unico da sala vs por espectador (P6).**
Escolhido: **um codec por transmissao, valendo para todas as N conexoes**.
Rejeitado: negociar por espectador (tecnicamente possivel, sao N `RTCPeerConnection` independentes). Motivos: (a) e a decisao de produto ja fechada na IDEA/PRD (RF-05); (b) custo de CPU no transmissor e pilar do projeto e o CONTEXT nao conseguiu verificar se o Chromium do Electron 43 compartilha encoder entre senders da mesma track - com codecs DIFERENTES por conexao o compartilhamento fica impossivel POR CONSTRUCAO, enquanto com codec unico ele continua ao menos possivel (ver [ASSUMPTION A2]); (c) mantem o espirito do RF-24 (parametros identicos em todos os senders) e um unico caminho de log/diagnostico. Consequencia aceita (ja registrada na IDEA em 2026-08-26): um membro com o escape ligado leva a sala inteira para VP8.

**T4. Troca de codec no meio da transmissao: redial vs renegociacao (P7).**
Escolhido: **redial** - fechar a chamada de saida daquele par e abrir outra com o `sdpTransform` novo, reusando `callPeer()`, que ja faz `closeOutgoing(peerId)` antes de discar e ja e o caminho usado por `onMemberJoined`/`onPeerRecovered`.
Rejeitado: renegociacao SDP incremental - o PeerJS 1.5.5 nao renegocia (o proprio codigo do projeto registra isso: "o PeerJS nao renegocia", `media-manager.ts:93-97`), e a arquitetura ja trata troca de fonte/preset como parar-e-comecar (`switchSource`). Rejeitado: recriar a stream/captura - desnecessario, a track continua valida.

**T5. mediaCapabilities vs so getCapabilities (P1).**
Escolhido: os DOIS, com papeis distintos. `RTCRtpSender.getCapabilities('video')` responde "esse codec e NEGOCIAVEL aqui?" (e de onde saem os `mimeType`/`sdpFmtpLine` reais para montar o `contentType`); `navigator.mediaCapabilities.encodingInfo({ type: 'webrtc', ... })` responde "esse codec e de HARDWARE aqui?" (`powerEfficient`). Um codec so entra na escada se passar nos dois.
Rejeitado: so `getCapabilities` - ele lista tambem codecs implementados por software, e adotar AV1 por software e o pior cenario da feature. Rejeitado: so `mediaCapabilities` - ele nao garante que o codec aparece na SDP gerada (sem PT na `m=video`, a reordenacao seria inocua e o log mentiria).

**T6. Carona do anuncio no `QUALITY_UPDATE` vs mensagem nova vs `HELLO`.**
Escolhido: campo opcional no `QUALITY_UPDATE`, que ja e broadcast por TODO membro a cada 3s.
Rejeitado: tipo de mensagem novo (`CODEC_HELLO`) - obrigaria adicionar valor ao enum FECHADO `MESSAGE_TYPES`, que o `validateEnvelope` checa com `isOneOf`; cliente antigo descartaria a mensagem inteira com `unknown_type`, e a LESSONS de 2026-08-25 e explicita sobre o custo de mexer em enum fechado de protocolo. Rejeitado: carona no `HELLO` - so cobre a direcao "quem entra -> quem ja estava", exigiria mexer em `applyHello` e na quarentena de HELLO (mecanismo delicado) e mesmo assim precisaria de um segundo canal para o caso do escape ligado no meio da sessao. Consequencia aceita: ha uma janela de ate 3s apos alguem entrar (mais o tempo de o mesh dele abrir) em que a capacidade e desconhecida. Tratamento adotado: **carencia POR MEMBRO** (`CODEC_MEMBER_GRACE_MS = 6_000`, o dobro do tick). Dentro da carencia o membro desconhecido e EXCLUIDO da conta (nao arrasta a sala para VP8 so por ter acabado de chegar); passada a carencia ele conta como `['VP8']`, cumprindo RF-06 de forma permanente para qualquer par de versao antiga, tenha ele entrado antes ou depois de a transmissao comecar. Rejeitada a alternativa anterior desta SPEC (janela GLOBAL de acomodacao no inicio da transmissao): ela ignorava para sempre quem entrasse depois da janela, o que quebrava RF-06/RF-07 justamente no par de versao antiga que chega tarde.

**T7. Rebaixamento por CPU: sinal e granularidade.**
Escolhido: contar amostras CONSECUTIVAS do tick de 3s que ja existe, com aquecimento e teto de rebaixamentos (numeros na secao 6, feature 4.2).
Rejeitado: reagir a primeira amostra `'cpu'` - o proprio arranque do encoder produz `'cpu'` transitorio; seria flapping garantido (AC-10 proibe). Rejeitado: laco proprio de `getStats()` mais rapido - RNF-07 proibe segundo coletor, e o comentario em `stats-monitor.ts:24-32` pede explicitamente a extensao no MESMO monitor.

**T8. Reanuncio silencioso do codec apos rebaixamento.**
Escolhido: depois de QUALQUER troca de codec, o transmissor reenvia `TX_START` (mesmo `txId`, campo `videoCodec` atualizado) para cada membro, e o reducer passa a tratar `TX_START` de uma transmissao JA CONHECIDA do mesmo remetente como ATUALIZACAO silenciosa: sem som, sem toast, sem mexer em `startedAt`/`status`.
Rejeitado: nao reanunciar (opcao da revisao anterior desta SPEC). Motivo do descarte: sem reanuncio, o `TransmissionState.videoCodec` do espectador fica preso no codec ABANDONADO; se depois disso o watchdog de midia dele disparar um pull de verdade, ele ofertaria justamente o codec que o transmissor acabou de abandonar por saturar a CPU - e com o teto de rebaixamentos ja gasto nao haveria caminho de correcao. Rejeitado tambem re-dispatch de `LOCAL_TX_START` no proprio transmissor: ele repetiria o som "transmitindo" a cada rebaixamento. O ganho colateral da idempotencia no reducer e corrigir um efeito duplicado latente que ja existia no reenvio de `onMemberJoined`.

**T9. Escape "modo compatibilidade" = zero munging, em vez de forcar VP8 na SDP.**
Escolhido: com o escape ligado a maquina anuncia `['VP8']`, o transmissor escolhe VP8 por `pickRoomCodec` e **nenhum `sdpTransform` e passado em ponto nenhum** (a funcao `codecTransform` devolve `undefined` tanto para `null` quanto para `'VP8'`). O resultado e, por construcao, a negociacao de hoje - que a propria PRD descreve como "hoje negocia sempre VP8" sem munging nenhum.
Rejeitado: munjir a resposta do espectador (`answerCall`) para empurrar VP8 na frente quando o escape esta ligado. Motivo: o escape e o ULTIMO recurso de quem ja esta com problema (risco R1/R5); fazer justamente essa maquina executar a unica manipulacao de SDP do sistema e o oposto do que se quer. Com a rejeicao, `answerCall` fica intocado. Consequencia aceita: a garantia de "sempre recebe VP8" (AC-15) passa a depender so da convergencia do anuncio, com transitorio limitado descrito no risco R11.

---

## 4. Riscos

| # | O que pode dar errado | Mitigacao |
|---|---|---|
| R1 | **Driver de encoder de hardware com bug**: negocia AV1/H264 por hardware e cospe tela preta ou artefatos no espectador. | Nao ha deteccao automatica (RF-22 [WONT]). O sintoma e visivel pelo aviso da `black-screen-notice` do lado de quem assiste; o log novo `[codec]` diz o codec e o `encoderImplementation` das duas pontas, o que separa "nao chegou nada" de "chegou lixo"; a pessoa afetada liga o escape em Configuracoes e volta para VP8 (RF-20). O escape e persistido, entao resolve tambem depois de reiniciar. |
| R2 | **Par de versao antiga** nao entende `decodes`/`videoCodec`. | Os dois sao campos OPCIONAIS em payloads existentes; os guards estruturais toleram campo extra nao verificado e nenhum enum fechado foi tocado (RNF-06). O cliente antigo ignora, nunca anuncia, e por isso e tratado como VP8-only (RF-06) - a sala converge para VP8 e a chamada completa normalmente (RF-07). Inverso: o cliente antigo transmite VP8 como sempre, e o cliente novo apenas responde (o `sdpTransform` da resposta so age se o escape local estiver ligado, e VP8 ja seria o resultado). |
| R3 | **Colisao de log com `expectNoDirectionFallbacks`**: qualquer linha nova contendo `media-pull`, `dialback`, `discando de volta` ou `na outra direcao` (comparacao em minusculas, `tests/e2e/helpers/zoi-app.ts:49` e `:274-284`) quebra os 5 specs e2e. | Regra dura desta SPEC: TODA linha de log nova usa o prefixo `[codec ...]` e e PROIBIDO incluir a tag de ICE da conexao (as tags do pull sao `media-pull-out:`/`media-pull-in:`, que contem a marca). Identifique a conexao por `shortPeerId(peerId)`. Ao escrever a mensagem do rebaixamento, use "refazendo as chamadas", nunca "discando de volta"/"na outra direcao". Verificacao mecanica no final de cada feature: `grep -niE "media-pull|dialback|discando de volta|na outra direcao"` nos arquivos tocados, esperando zero ocorrencias fora dos trechos ja existentes. |
| R4 | **Custo de CPU do fanout N**: o transmissor abre uma `RTCPeerConnection` por espectador; se o Chromium nao compartilhar encoder, trocar VP8 por AV1 multiplica um custo maior por N. | Escolha por maquina condicionada a encoder de HARDWARE (T2): encoder de hardware e justamente o que nao consome CPU. Codec unico para a sala (T3) preserva a chance de compartilhamento. Rede de seguranca em runtime: o watcher de `qualityLimitationReason === 'cpu'` rebaixa sozinho (RF-09). Marcado como [ASSUMPTION A2]. |
| R5 | **Reordenacao de SDP recusada pelo `setLocalDescription`** em alguma versao do Chromium, quebrando a negociacao. | `preferVideoCodec` e defensiva por construcao: envolve tudo em try/catch, so REORDENA payload types que ja estavam na `m=video`, e devolve o SDP ORIGINAL em qualquer duvida (secao sem `m=video`, nenhum PT do codec, todos os PT do codec, excecao). Como camada extra, o PeerJS mantem o SDP original se a funcao devolver falsy. Se mesmo assim falhar em campo, o escape VP8 e o desligamento total (VP8 e o default do Chromium: com o escape ligado a reordenacao vira no-op na pratica). |
| R6 | **Redial do rebaixamento cai no watchdog do espectador** e dispara `startMediaPull` (que loga marca vigiada e ainda por cima e um fallback de direcao real). | O redial usa exatamente o `callPeer()` de sempre, que ja e o caminho de `onMemberJoined`/`onPeerRecovered` (o espectador ja lida com chamada substituida hoje). O watchdog de 10s so dispara se a chamada NOVA nao entregar midia - o que seria falha real, nao efeito do codec. Teto de 2 rebaixamentos por transmissao evita cadeia de redials. Em rede saudavel (cenario do e2e) o rebaixamento nao dispara: exige 4 amostras consecutivas de `'cpu'` depois do aquecimento. |
| R7 | **Piscada no espectador** a cada troca de codec (a stream e refeita). | Trocas sao raras e limitadas: o codec so DESCE durante uma transmissao (nunca sobe), com teto de 2 rebaixamentos por CPU mais, no maximo, os rebaixamentos por composicao da sala (que dependem de gente entrando). O `FirstFrameWatch` ja tem carencia de 1,5s antes de mostrar qualquer aviso (`FIRST_FRAME_GRACE_MS`), entao a reconexao rapida normalmente nem aparece. |
| R8 | **Sondagem de capacidade assincrona ainda nao resolvida** na hora em que o valor e lido (ou API ausente no ambiente de teste). | ENCODE: `startTransmission` e `async` e AGUARDA `ensureEncodeProbe(presetId)` antes de escolher. DECODE: a sonda de boot nao e aguardada de proposito (nao atrasar o boot); enquanto ela nao resolve a maquina anuncia `['VP8']` e o tick seguinte (3s) ja anuncia a lista real - o unico efeito e uma escolha conservadora nos primeiros segundos de app aberto. **Corrida de baixa probabilidade, registrada de propria vontade**: se o par chegar a anunciar ANTES de a sonda dele resolver, ele anuncia `['VP8']` e passa a TER entrada em `decodeCapabilities` - a carencia por membro nao o protege (ela so vale para quem nunca anunciou), e a regra monotonica impede promocao, entao uma transmissao iniciada nessa janela fica em VP8 ate um stop/start. Consequencia: qualidade de hoje, nunca falha; e a razao de a sonda de decode disparar no BOOT, e nao ao entrar na sala. Qualquer falha, excecao ou API ausente devolve `['VP8']`: nunca lanca, nunca bloqueia. |
| R9 | **e2e passa a exercitar um codec de hardware** na maquina do dev e fica sensivel a driver. | E desejado (e o caminho real), mas existe valvula: `ZOI_FORCE_VP8=1` faz `getSettings()` devolver `forceVp8: true` sem persistir (mesmo precedente de `ZOI_DISABLE_AUDIO_EXCLUSION`). Default desligado. |
| R10 | **Anuncio forjado/malformado** de um par. | Ver matriz 5c. |
| R11 | **Transitorio de ate ~12s** em que um espectador com o escape ligado (ou uma maquina que so decodifica VP8) ainda recebe um codec que nao aguenta: ele entrou ha pouco (dentro de `CODEC_MEMBER_GRACE_MS`, quando fica fora da conta) e o transmissor so corrige num tick seguinte. | E o preco explicito da carencia por membro (T6) somado ao "escape = zero munging" (T9), e vale a pena: sem a carencia, TODA entrada de gente derrubaria a sala para VP8 por alguns segundos. O transitorio se auto-corrige e a experiencia nesse intervalo e coberta pelo aviso da `black-screen-notice`. O limite superior e a soma de tres parcelas, nao duas: ate um tick (3s) ate o `syncMemberSeen` registrar o recem chegado em `memberFirstSeenAt`, mais a carencia (6s) contada A PARTIR desse registro, mais o tick (3s) em que o rebaixamento por composicao da sala roda - cerca de 12s no pior caso. Se o campo mostrar que incomoda, `CODEC_MEMBER_GRACE_MS` esta em `config.ts`, num lugar so. |

---

## 5. Contratos

Este app e P2P e NAO tem backend HTTP: a superficie de contrato equivalente sao (A) os envelopes do mesh, (B) o IPC main/preload/renderer, (C) os contratos de negociacao WebRTC e as assinaturas internas consumidas por outro sprint.

### 5.A Envelopes do protocolo (`src/shared/protocol.ts`)

Nenhum tipo de mensagem novo. Nenhum enum fechado alterado. `PROTOCOL_VERSION` continua `1`.

**A1. `QUALITY_UPDATE` - anuncio de capacidade de decodificacao (aditivo)**

```ts
export interface QualityUpdatePayload {
  level: QualityLevel
  rttMs: number
  inboundBitrateKbps: number | null
  /**
   * Codecs de video que ESTA maquina decodifica bem (RF-05/RF-06). Campo
   * OPCIONAL e de tipo aberto (string[]): um cliente futuro pode anunciar um
   * nome que este aqui nao conhece sem que a mensagem inteira seja descartada.
   * Ausente = versao antiga (ou sondagem ainda nao resolvida): o consumidor le
   * como ['VP8'].
   */
  decodes?: string[]
}
```

- Guard `isQualityUpdatePayload`: acrescentar `(value['decodes'] === undefined || isArrayOf(value['decodes'], isString))`. **Proibido** validar com `isOneOf`/enum fechado: um valor desconhecido dentro do array NUNCA pode invalidar a mensagem (LESSONS 2026-08-25, preset novo cegando cliente antigo).
- Quem envia: TODO membro, a cada `QUALITY_UPDATE_INTERVAL_MS` (3s), enquanto a sala estiver `active`. Origem do valor: `getLocalDecodeCodecs()` (secao 5.C).
- Quem consome: o reducer (`room-state.ts`, case `QUALITY_UPDATE`), que normaliza com `normalizeDecodeAnnouncement` e guarda em `RoomState.decodeCapabilities[from]`.
- Compat com versao antiga: cliente antigo ignora o campo extra (o guard dele so checa os obrigatorios) e continua processando `level`/`rttMs`/`inboundBitrateKbps` normalmente (AC-24).

**A2. `TX_START` - codec escolhido para a transmissao (aditivo)**

```ts
export interface TxStartPayload {
  txId: string
  presetId: PresetId
  hasAudio: boolean
  sourceKind: SourceKind
  sourceLabel: string
  startedAt: number
  /**
   * Codec que o transmissor esta usando nesta transmissao. Tipo ABERTO (string)
   * pelo mesmo motivo de `decodes`. Serve ao espectador que precisa OFERTAR na
   * chamada reversa (pull): sem isso a oferta dele sairia na ordem default do
   * Chromium e o transmissor acabaria enviando VP8.
   */
  videoCodec?: string
}
```

- Guard `isTxStartPayload`: acrescentar `(value['videoCodec'] === undefined || isString(value['videoCodec']))`. Mesma proibicao de enum fechado.
- Quem envia: o transmissor, em TRES momentos - no broadcast de `applyLocalTxStart`, no reenvio direto de `MediaManager.onMemberJoined` (`media-manager.ts:437-453`) e no REANUNCIO silencioso apos qualquer troca de codec (feature 4.2, trade-off T8).
- Quem consome: o reducer guarda em `TransmissionState.videoCodec`; `MediaManager.startMediaPull` le para montar o `sdpTransform` da oferta ficticia.
- **Regra de idempotencia (nova, exigida pelo reanuncio)**: um `TX_START` cujo `txId` JA existe no estado e cujo dono e o mesmo remetente e uma ATUALIZACAO, nao uma transmissao nova. Nesse caso o reducer atualiza os campos do `TransmissionState` (`videoCodec`, `presetId`, `hasAudio`, `sourceKind`, `sourceLabel`), PRESERVA `startedAt` e `status`, nao mexe em `selfWatchingTxId` e devolve **lista de efeitos VAZIA**: sem som `transmitting`, sem toast "comecou a transmitir". Sem essa regra o reanuncio faria a sala inteira ouvir o som de novo a cada rebaixamento. Efeito colateral bem-vindo: corrige um som/toast duplicado latente que o reenvio de `onMemberJoined` ja podia causar num par que reconecta.
- Compat: cliente antigo ignora o campo `videoCodec`; ele nao tem a regra de idempotencia e, no reanuncio, vai repetir som e toast. E o unico incomodo conhecido da janela de versoes mistas (que a IDEA registra como curta, de dias) e nao quebra nada.

**A3. Estado derivado (`src/renderer/src/core/room-state.ts`)**

```ts
export interface TransmissionState {
  // ... campos atuais ...
  /** Codec anunciado pelo transmissor; null = versao antiga ou nao informado. */
  videoCodec: VideoCodecId | null
}

export interface RoomState {
  // ... campos atuais ...
  /** peerId -> codecs que ele anunciou decodificar bem (RF-05). */
  decodeCapabilities: Record<string, VideoCodecId[]>
}
```

Regra de leitura obrigatoria para o consumidor: NUNCA leia `decodeCapabilities` direto; use o helper `memberDecodes(now)` (5.C6), que aplica a carencia por membro e o default `['VP8']` do RF-06. Nota de honestidade: para a PROPRIA transmissao local, `TransmissionState.videoCodec` guarda o codec do inicio e nao acompanha rebaixamentos (o transmissor nao redispara `LOCAL_TX_START` para nao repetir o som "transmitindo" nele mesmo). Isso e inofensivo porque a verdade local e `MediaManager.getLocalTransmission().videoCodec`, e nos ESPECTADORES o campo fica sempre atual gracas ao reanuncio silencioso (T8).

### 5.B IPC (`src/shared/ipc.ts` + `src/main/settings.ts` + `src/main/ipc-handlers.ts`)

Nenhum canal novo. `settings:get` e `settings:set` ja existem e sao genericos; `src/preload/index.ts` repassa o objeto inteiro e NAO precisa de alteracao.

```ts
export interface AppSettings {
  nickname: string | null
  installId: string
  soundVolume: number
  /** Escape "modo compatibilidade": transmite E recebe sempre VP8 (RF-12..RF-14). */
  forceVp8: boolean
}

/** Cada campo presente e aplicado; os ausentes ficam como estao. */
export interface SettingsSetRequest {
  nickname?: string
  soundVolume?: number
  forceVp8?: boolean
}
```

- `src/shared/codecs.ts` exporta `DEFAULT_FORCE_VP8 = false` e `normalizeForceVp8(value: unknown): boolean` (`value === true`), no mesmo molde de `clampSoundVolume` em `@shared/sounds` (importado hoje pelo main).
- `src/main/settings.ts`: `readFromDisk` devolve `forceVp8: normalizeForceVp8(parsed.forceVp8)`; `getSettings()` cria com `DEFAULT_FORCE_VP8`; funcao nova `setForceVp8(raw: unknown): AppSettings` no molde exato de `setSoundVolume` (`settings.ts:108-114`); valvula de e2e: se `process.env.ZOI_FORCE_VP8 === '1'`, `getSettings()` devolve `{ ...cache, forceVp8: true }` SEM gravar em disco.
- `src/main/ipc-handlers.ts:20-34`: acrescentar `if (request?.forceVp8 !== undefined) settings = setForceVp8(request.forceVp8)` depois da linha do `soundVolume`.
- **Regra de ida e volta**: `settings:set` SEMPRE devolve o `AppSettings` completo ja persistido; a UI usa o retorno como verdade. `settings:get` no boot alimenta `setForceVp8(...)` do modulo do renderer, que e a fonte de verdade em runtime para o media path.

### 5.C Contratos de negociacao WebRTC e assinaturas internas

**C1. `sdpTransform` nos pontos de negociacao.** Verificado no bundle instalado (`node_modules/peerjs/dist/bundler.mjs:837`, `:879`, `:1057`).

**Regra que vale para TODAS as linhas da tabela**: o transform e produzido por `codecTransform(codec)`, que devolve `undefined` quando `codec` e `null` OU `'VP8'`. Ou seja, no caminho VP8 (linha de base de hoje, modo compatibilidade, par de versao antiga) NENHUM `sdpTransform` chega ao PeerJS e a negociacao fica byte a byte igual a de hoje.

| # | Papel | Arquivo/linha | Chamada | Codec pedido ao `codecTransform` |
|---|---|---|---|---|
| 1 | Transmissor OFERTA (chamada direta) | `media-manager.ts:370-372` (`callPeer`) | `session.callPeer(peerId, stream, meta, transform)` | `transmission.videoCodec` |
| 2 | Espectador RESPONDE (chamada direta) | `media-manager.ts:529-535` (`answerCall`) | `call.answer()` **INTOCADO** | nenhum (ver T9) |
| 3 | Espectador OFERTA (pull) | `media-manager.ts:590` (`startMediaPull`) | `session.callPeer(txPeerId, dummy.stream, meta, transform)` | `isForceVp8() ? 'VP8' : (state.transmissions[txId]?.videoCodec ?? null)` |
| 4 | Transmissor RESPONDE (pull) | `media-manager.ts:628` (`answerPull`) | `call.answer(transmission.stream, { sdpTransform })` | `transmission.videoCodec` |

Notas tecnicas que o implementador NAO deve "simplificar":
- **Por que a linha 3 existe**: no WebRTC quem envia escolhe o codec a partir da descricao REMOTA. Na chamada direta o Chromium do espectador gera a resposta na ordem da oferta, entao munjir a oferta (linha 1) basta. No pull quem oferta e o ESPECTADOR: sem o `videoCodec` do `TX_START` na oferta dele, o transmissor cairia no default. A linha 3 e o que cobre RF-01 no caminho reverso.
- **Por que a linha 4 nao substitui a 3**: munjir a propria RESPOSTA nao dirige o que o transmissor ENVIA (isso quem dita e a oferta do outro lado). A linha 4 e simetria defensiva barata (ajuda quando o outro lado nao e Chromium ou muda de comportamento), nunca a cobertura de RF-01.
- **Por que a linha 2 sumiu**: com o escape resolvido por anuncio (T9), o unico transform que ela teria seria VP8, que agora e sempre `undefined`. `answerCall` fica exatamente como esta hoje.

**C2. Assinaturas alteradas (contrato interno consumido por outras camadas).**

```ts
// src/renderer/src/services/peer-manager.ts (hoje linha 277-279)
call(
  peerId: string,
  stream: MediaStream,
  metadata: CallMetadata,
  sdpTransform?: (sdp: string) => string
): MediaConnection

// src/renderer/src/services/session.ts (hoje linha 490-492)
callPeer(
  peerId: string,
  stream: MediaStream,
  metadata: CallMetadata,
  sdpTransform?: (sdp: string) => string
): MediaConnection

// src/renderer/src/services/session.ts (hoje linha 464-472): campo novo no argumento
announceTransmissionStart(payload: {
  txId: string
  presetId: PresetId
  hasAudio: boolean
  sourceKind: SourceKind
  sourceLabel: string
  videoCodec: VideoCodecId   // novo; repassado ao LOCAL_TX_START e ao broadcast
}): void

// src/renderer/src/services/session.ts, interface MediaHooks (hoje 122-137): DOIS metodos novos
interface MediaHooks {
  // ... metodos atuais ...
  /** Conexoes de SAIDA da transmissao local, etiquetadas por par (RF-11/RF-21). */
  outboundEntries(): OutboundEntry[]
  /** Amostra de saida do MESMO tick de 3s do monitor de qualidade. */
  onOutboundVideoStats(stats: ReadonlyMap<string, OutboundVideoStats>): void
}
```

`noopMediaHooks` (`session.ts:175-183`) ganha `outboundEntries: () => []` e `onOutboundVideoStats: () => {}`. Qualquer literal de `MediaHooks` em teste precisa dos dois campos.

**C3. `StatsMonitor` (`src/renderer/src/services/stats-monitor.ts`).**

```ts
/** Conexao de SAIDA etiquetada pelo par que a recebe. */
export interface OutboundEntry {
  peerId: string
  txId: string
  connection: RTCPeerConnection
}

/** Leitura do `outbound-rtp` de video de UMA conexao de saida. */
export interface OutboundVideoStats {
  txId: string
  /** `mimeType` do report `codec` apontado por `codecId`, ex 'video/VP9'. */
  codec: string | null
  encoderImplementation: string | null
  qualityLimitationReason: string | null
  framesPerSecond: number | null
  at: number
}

export interface InboundVideoStats {
  framesDecoded: number
  framesReceived: number
  at: number
  /** OPCIONAIS de proposito: nao quebram literais existentes em testes. */
  codec?: string | null
  decoderImplementation?: string | null
}

export interface StatsMonitorCallbacks {
  inboundEntries(): InboundEntry[]
  /** Novo: conexoes de saida da transmissao local (vazio quando nao transmite). */
  outboundEntries(): OutboundEntry[]
  averageRttMs(): number
  onReport(report: QualityReport): void
  onInboundVideoStats?(stats: ReadonlyMap<string, InboundVideoStats>): void
  /**
   * Novo: chaveado por peerId. OBRIGATORIO (sem `?`), ao contrario do irmao de
   * entrada: alem de publicar as amostras, este callback e o RELOGIO de 3s que
   * alimenta `memberFirstSeenAt` no consumidor, entao ele e chamado a cada tick
   * mesmo com o mapa vazio e nao pode ser deixado de fora.
   */
  onOutboundVideoStats(stats: ReadonlyMap<string, OutboundVideoStats>): void
}
```

Invariante RNF-07: o laco de saida roda DENTRO do mesmo `sample()`, depois do laco de entrada, com UM `getStats()` por conexao por tick. Nenhum `setInterval` novo em lugar nenhum.

**C4. `src/shared/codecs.ts` (modulo puro novo; sem DOM, sem Electron - o main tambem importa).**

```ts
export type VideoCodecId = 'AV1' | 'VP9' | 'H264' | 'VP8'

/** Do mais eficiente por bit ao mais compativel. VP8 e o piso universal. */
export const VIDEO_CODEC_PRIORITY: readonly VideoCodecId[] = ['AV1', 'VP9', 'H264', 'VP8']

/** Nomes possiveis no `a=rtpmap` de cada codec (o AV1 ja se chamou AV1X). */
/** Nomes que cada codec pode ter no `a=rtpmap` (o AV1 ja se chamou AV1X). */
export const CODEC_RTPMAP_NAMES = {
  AV1: ['AV1', 'AV1X'],
  VP9: ['VP9'],
  H264: ['H264'],
  VP8: ['VP8']
} as const satisfies Record<VideoCodecId, readonly string[]>

export function isVideoCodecId(value: unknown): value is VideoCodecId

/**
 * Anuncio recebido -> lista confiavel. Filtra desconhecidos, remove repetidos,
 * garante 'VP8' e corta em 8 entradas (limite anti-abuso).
 */
export function normalizeDecodeAnnouncement(value: readonly string[] | undefined): VideoCodecId[]

/** Melhor codec que ESTA maquina codifica e que TODOS os membros decodificam. */
export function pickRoomCodec(
  localEncodeCandidates: readonly VideoCodecId[],
  memberDecodes: readonly (readonly VideoCodecId[])[]
): VideoCodecId

/** Proximo degrau ABAIXO de `current` que ainda serve a sala; null se nao houver. */
export function nextLowerCodec(
  current: VideoCodecId,
  localEncodeCandidates: readonly VideoCodecId[],
  memberDecodes: readonly (readonly VideoCodecId[])[]
): VideoCodecId | null

/** Reordena os payload types da secao `m=video`. NUNCA remove. Nunca lanca. */
export function preferVideoCodec(sdp: string, codec: VideoCodecId): string

/**
 * Configuracao de referencia da sonda de DECODIFICACAO. Decodificar e
 * propriedade da maquina, nao do preset que outra pessoa escolheu: um numero
 * fixo (o do preset padrao 1080p30) evita ter que sondar 5 combinacoes e evita
 * depender de saber, no boot, o que alguem vai transmitir depois.
 */
export const DECODE_PROBE_VIDEO = {
  width: 1920,
  height: 1080,
  framerate: 30,
  bitrate: 4_000_000
} as const

export const DEFAULT_FORCE_VP8 = false
export function normalizeForceVp8(value: unknown): boolean
```

**C5. `src/renderer/src/services/codec-capabilities.ts` (modulo novo do renderer).**

```ts
/** Estado do escape, espelho do padrao de `sound-player.ts:38-50`. */
export function isForceVp8(): boolean
export function setForceVp8(value: boolean): void
export function subscribeForceVp8(listener: (value: boolean) => void): () => void

/**
 * Sonda de DECODIFICACAO. Roda UMA vez por sessao do app, no boot, sem preset e
 * sem depender de transmitir: quem so assiste PRECISA anunciar o que decodifica,
 * senao a sala inteira degenera para VP8. Idempotente (promessa cacheada), nunca
 * lanca, nunca bloqueia o boot (chamada com `void`).
 */
export function ensureDecodeProbe(): Promise<void>

/**
 * Sonda de CODIFICACAO, cacheada POR PRESET (o `encodingInfo` recebe
 * largura/altura/fps/bitrate do preset). Chamada em `startTransmission`.
 */
export function ensureEncodeProbe(presetId: PresetId): Promise<void>

/** Codecs com encoder de HARDWARE nesta maquina, na ordem de prioridade. */
export function getEncodeCandidates(): VideoCodecId[]

/** O que esta maquina anuncia decodificar bem. ['VP8'] com o escape ligado. */
export function getLocalDecodeCodecs(): VideoCodecId[]

/** Somente diagnostico: instantaneo cru da ultima sondagem (para __zoiDebug). */
export function describeCodecProbe(): Record<string, unknown>
```

**C6. `MediaManager` (API publica consumida pelo frontend).**

```ts
export interface LocalTransmission {
  // ... campos atuais ...
  /** Codec em uso AGORA (muda em rebaixamento/acomodacao). */
  videoCodec: VideoCodecId
}

class MediaManager {
  /** RF-16..RF-19: liga/desliga o modo nitidez AO VIVO. Idempotente. */
  setSharpnessMode(on: boolean): void
  /** Estado corrente do modo nitidez (sempre false fora de transmissao). */
  isSharpnessMode(): boolean
}
```

Helpers PRIVADOS do `MediaManager` com assinatura FIXA (usados de forma identica nas features 3.1 e 4.2; nao invente variacao):

```ts
/**
 * Registra em `memberFirstSeenAt` todo membro do roster ainda desconhecido e
 * apaga quem saiu. Roda a CADA tick de 3s, transmitindo ou nao: sem isso, a
 * primeira leitura aconteceria dentro do `startTransmission` e TODO mundo
 * pareceria "recem chegado", inclusive o par de versao antiga que esta na sala
 * ha dez minutos - e o RF-06 falharia justamente onde mais importa.
 */
private syncMemberSeen(now: number): void

/**
 * Listas de decodificacao dos OUTROS membros, ja aplicando a carencia por
 * membro: quem nunca anunciou e esta ha menos de CODEC_MEMBER_GRACE_MS no
 * roster fica FORA da lista; passada a carencia, entra como ['VP8'] (RF-06).
 * Chama `syncMemberSeen(now)` antes de montar a lista.
 * `now` e parametro (nao `Date.now()` interno) para o teste ser deterministico.
 */
private memberDecodes(now: number): VideoCodecId[][]

/** pickRoomCodec(getEncodeCandidates(), this.memberDecodes(now)). */
private chooseRoomCodec(now: number): VideoCodecId

/** Transform do PeerJS, ou undefined quando `codec` e null ou 'VP8'. */
private codecTransform(codec: VideoCodecId | null): ((sdp: string) => string) | undefined
```

Nota para quem implementa: NAO existe parametro `includeUnknown` em lugar nenhum. A decisao sobre membro desconhecido vive INTEIRA dentro de `memberDecodes(now)`, na forma da carencia por membro. Duas assinaturas diferentes para a mesma pergunta foi exatamente o defeito apontado na revisao desta SPEC.

### 5b. Dependencias e configuracao

**Nenhuma dependencia nova** (nem runtime, nem dev). Tudo usa APIs nativas do Chromium do Electron (`navigator.mediaCapabilities`, `RTCRtpSender.getCapabilities`, `getStats`) e o PeerJS 1.5.5 ja instalado.

Chaves de configuracao novas, por NOME (todas em `src/shared/config.ts`, junto das demais constantes de temporizacao):

- `CODEC_CPU_WARMUP_SAMPLES` = 3 - amostras ignoradas depois de comecar/trocar de codec.
- `CODEC_CPU_PERSISTENT_SAMPLES` = 4 - amostras consecutivas de `'cpu'` que configuram "persistente".
- `CODEC_MAX_DOWNGRADES` = 2 - teto de rebaixamentos por transmissao.
- `CODEC_LOG_EVERY_N_SAMPLES` = 5 - cadencia do log periodico (RF-21).
- `CODEC_MEMBER_GRACE_MS` = 6_000 - carencia POR MEMBRO ate um par que nunca anunciou passar a contar como `['VP8']`. Dobro do tick de 3s: cobre o tempo de o mesh dele abrir mais um `QUALITY_UPDATE`.

Chave de settings nova (persistida em `userData/settings.json`): `forceVp8`.
Variavel de ambiente nova (so main, so valvula de teste): `ZOI_FORCE_VP8`.

### 5c. Matriz de confianca (equivalente da matriz de autorizacao)

**O app nao tem papeis nem autenticacao para esta feature.** A escolha de codec e automatica e por maquina; o modo nitidez e local do transmissor; o escape e local da maquina. Dono e membro comum tem exatamente as mesmas capacidades aqui (PRD secao 4, nota introdutoria). A unica autorizacao existente e a de sala (admissao/kick/ban), que ja e do reducer e nao muda.

O que muda e a superficie de ABUSO do anuncio novo:

| Entrada suspeita | O que acontece hoje | Comportamento exigido |
|---|---|---|
| `QUALITY_UPDATE` com `decodes` de tipo errado (numero, objeto, `['VP9', 3]`) | - | O guard rejeita o payload inteiro; `validateEnvelope` devolve `invalid_payload` e o `mesh` ja loga `envelope descartado`. A capacidade daquele par permanece desconhecida = `['VP8']`. Degradacao segura, sem excecao. |
| `decodes` com nomes desconhecidos (`['H265','AV2']`) | - | `normalizeDecodeAnnouncement` descarta os desconhecidos e garante `VP8`. Resultado: `['VP8']`. Nunca lanca. |
| `decodes` gigante (`Array(10000)`) | - | Corte em 8 entradas na normalizacao; o resto e ignorado. O tamanho do payload continua limitado pelo proprio DataChannel confiavel, como qualquer outra mensagem. |
| `decodes` MENTIROSO (anuncia AV1 sem saber decodificar) | - | O mentiroso e o unico prejudicado enquanto a sala inteira consegue decodificar: quem nao decodifica ve tela preta e recebe o aviso da `black-screen-notice`. Nao ha remedio automatico (RF-22); o dono pode remover o par. |
| `decodes` restritivo de proposito (`[]` -> vira `['VP8']`) | - | Negacao de QUALIDADE, nao de servico: a sala inteira cai para VP8, exatamente como se o par tivesse o escape ligado. E indistinguivel do uso legitimo do escape e, num grupo fechado de amigos com admissao pelo dono, e risco aceito e documentado. |
| `QUALITY_UPDATE` de quem nao esta no roster | ja rejeitado (`rejectFrom`, `room-state.ts:625`) | Inalterado: nenhuma capacidade e registrada para nao-membro. |
| `TX_START` com `videoCodec` desconhecido/forjado | - | O reducer normaliza com `isVideoCodecId`: desconhecido vira `null` e o pull nao aplica transform (cai no default do Chromium). Um `videoCodec` forjado por um par so influencia a oferta do PULL para AQUELE par, e o transmissor so responde a pull de transmissao local ativa (`answerPull`, checagem ja existente em `media-manager.ts:610-615`). |

---

## 6. Plano de execucao

Ordem obrigatoria: **Backend inteiro, depois Frontend, depois o sprint de testes**. O frontend so consome contratos que ja existem no codigo.

**Regra GREEN (vale para TODA feature, sem excecao):** antes do commit, alem de `npm run typecheck` e `npm run lint`, a feature precisa ser EXERCITADA de verdade pelo caminho descrito em "Done when". Build passando nao e exercicio. Se o orcamento acabar antes do exercicio, NAO commite: reporte o estado (LESSONS 2026-08-25). Para modulos puros, o exercicio aceito e um arquivo temporario `tests/unit/__scratch-<assunto>.test.ts` rodado com `npx vitest run tests/unit/__scratch-<assunto>.test.ts` e **APAGADO antes do commit** (os testes definitivos sao do Sprint T).

**Regra de commit:** `git add` sempre com caminhos EXPLICITOS (nunca `-A`); nunca rodar formatador com glob amplo (LESSONS 2026-08-25). Conventional Commits em pt-BR sem acentos, sem assinatura.

---

## Backend

### Sprint B1 - Fundacao pura e contratos persistidos

#### Feature 1.1 - Modulo puro de codecs `[core]`

**Traces**: RF-02, RF-03, RF-04, RF-05, RF-06, RNF-04, RNF-06.

**Steps**
1. Criar `src/shared/codecs.ts` com o cabecalho de comentario no estilo do projeto (pt-BR sem acento) explicando: modulo PURO (sem DOM, sem Electron, importado tambem pelo main), escada de prioridade e a regra "VP8 e piso universal".
2. Implementar exatamente a API do contrato 5.C4. Detalhes obrigatorios:
   - `CODEC_RTPMAP_NAMES = { AV1: ['AV1', 'AV1X'], VP9: ['VP9'], H264: ['H264'], VP8: ['VP8'] }`.
   - `normalizeDecodeAnnouncement`: `undefined` -> `['VP8']`; filtra por `isVideoCodecId`; remove duplicados preservando a ordem de `VIDEO_CODEC_PRIORITY`; garante `VP8` no fim se faltar; corta em 8.
   - `pickRoomCodec`: percorre `VIDEO_CODEC_PRIORITY`, pula o que nao esta em `localEncodeCandidates`, exige `memberDecodes.every((list) => list.includes(codec))`, e devolve `'VP8'` se nada casar.
   - `nextLowerCodec`: mesma varredura comecando em `indexOf(current) + 1`; devolve `null` quando nao ha degrau (ou seja, quando `current === 'VP8'`).
3. Implementar `preferVideoCodec(sdp, codec)` com esta logica literal (o texto abaixo E o algoritmo, nao ilustracao):
   - `const lines = sdp.split(/\r\n|\r|\n/)`;
   - achar `mIndex` = primeira linha que comeca com `'m=video '`; se nao houver, devolver `sdp`;
   - achar `end` = proxima linha que comeca com `'m='` depois de `mIndex` (ou `lines.length`);
   - varrer `mIndex+1..end-1` casando `/^a=rtpmap:(\d+) ([^/]+)\//`; se o nome (em maiusculas) estiver em `CODEC_RTPMAP_NAMES[codec]`, guardar o payload type num `Set<string>`;
   - se o conjunto estiver vazio, devolver `sdp`;
   - quebrar `lines[mIndex]` por espaco: os 3 primeiros campos sao cabecalho, o resto sao payload types; separar em `preferred` (na ordem original) e `rest`;
   - se `preferred.length === 0` ou `preferred.length === payloads.length`, devolver `sdp` (nada a reordenar);
   - reescrever a linha como `[...header, ...preferred, ...rest].join(' ')` e devolver `lines.join('\r\n')`;
   - TUDO dentro de um `try { ... } catch { return sdp }`.
4. Implementar `DEFAULT_FORCE_VP8` e `normalizeForceVp8` (retorna `value === true`).

**Edge cases** (categoria: modulo puro de dominio)
- SDP sem secao `m=video` (oferta so de audio): devolve o original.
- SDP com duas secoes `m=` (video + audio): so a primeira `m=video` e reescrita; a varredura de `a=rtpmap` para na proxima `m=`.
- Codec pedido que nao tem PT na oferta (ex.: AV1 num Chromium sem AV1): devolve o original, sem log de erro.
- SDP com `\n` puro (fixture de teste): normalizado para `\r\n` na volta, sem perder linhas.
- `pickRoomCodec` com `memberDecodes` vazio (sala de uma pessoa so): a condicao `every` de array vazio e verdadeira, entao vale so a capacidade local - correto e intencional.
- `normalizeDecodeAnnouncement([])`: devolve `['VP8']`.

**Done when**
- `npm run typecheck` e `npm run lint` verdes.
- Exercicio: scratch test cobrindo (a) reordenacao real de um SDP de oferta do Chromium com VP8/VP9/H264/AV1, provando que os PT do codec pedido vao para a frente e que NENHUM PT sumiu; (b) `pickRoomCodec` com o exemplo trabalhado do AC-05 (local `['AV1','VP9','H264','VP8']`, membros `[['AV1','VP9','H264','VP8'], ['H264','VP8']]` => `'H264'`); (c) `nextLowerCodec('AV1', ...)` do mesmo cenario => `'H264'`. Rodar, ver verde, APAGAR o scratch.

**Commit**: `feat(codec): adiciona modulo puro de escolha e preferencia de codec de video`
**Rollback**: apagar `src/shared/codecs.ts` (nenhum outro arquivo importa ainda).

#### Feature 1.2 - Protocolo aditivo, settings persistidos e log de ambiente `[api-like]`

**Traces**: RF-12, RF-15, RNF-06, RNF-03, RF-11 (parte de ambiente).

**Steps**
1. `src/shared/protocol.ts`: acrescentar `decodes?: string[]` em `QualityUpdatePayload` (linhas 139-143) e `videoCodec?: string` em `TxStartPayload` (linhas 121-128), cada um com o comentario de compat do contrato 5.A. Atualizar `isQualityUpdatePayload` (358-365) e `isTxStartPayload` (332-343) com as clausulas OPCIONAIS e ABERTAS do contrato. Nao mexer em `MESSAGE_TYPES`, `PRESET_IDS` nem em qualquer outro enum.
2. `src/shared/ipc.ts`: acrescentar `forceVp8: boolean` em `AppSettings` (27-34) e `forceVp8?: boolean` em `SettingsSetRequest` (36-40), com comentario curto.
3. `src/main/settings.ts`: importar `DEFAULT_FORCE_VP8` e `normalizeForceVp8` de `@shared/codecs`; incluir `forceVp8?: unknown` em `isValidPersistedShape` (36-40); devolver `forceVp8` normalizado em `readFromDisk` (59); incluir `forceVp8: DEFAULT_FORCE_VP8` no objeto de primeira execucao em `getSettings` (89); criar `setForceVp8(rawValue: unknown): AppSettings` copiando o molde de `setSoundVolume` (108-114).
4. `src/main/settings.ts`: valvula de e2e em `getSettings()` - se `process.env.ZOI_FORCE_VP8 === '1'`, devolver `{ ...cache, forceVp8: true }` sem gravar. Comentario explicando que e o mesmo precedente de `ZOI_DISABLE_AUDIO_EXCLUSION` e que o default e desligado.
5. `src/main/ipc-handlers.ts`: importar `setForceVp8` (linha 15) e aplicar em `settings:set` (depois da linha 25).
6. `src/main/index.ts`: logo apos `startFileLogger()` (linha 118), acrescentar `logToFile('info', \`[codec] chromium ${process.versions.chrome} electron ${process.versions.electron}\`)`. Importar `logToFile` se ainda nao estiver importado. Isso resolve em campo o [ASSUMPTION A1] sem hardcode nenhum.
7. `src/shared/config.ts`: acrescentar as 5 constantes de 5b, cada uma com comentario curto explicando a unidade (amostras do tick de 3s) e o porque do numero.

**Edge cases** (categoria: api-like)
- `settings.json` de versao antiga (sem `forceVp8`): le como `false`, nao invalida o arquivo, nao cai no caminho de `.bak`.
- `settings.json` com `forceVp8: "sim"` (tipo errado): `normalizeForceVp8` devolve `false`.
- `settings:set({})` (nenhum campo): continua devolvendo o `AppSettings` atual, sem escrita.
- `settings:set({ forceVp8: true, nickname: 'x' })`: os dois sao aplicados, na ordem do handler.
- Envelope `QUALITY_UPDATE` sem `decodes` (versao antiga): guard aceita.
- Envelope `QUALITY_UPDATE` com `decodes: 'VP9'` (string em vez de array): guard rejeita o payload inteiro - comportamento desejado e documentado em 5c.
- Envelope `TX_START` com `videoCodec: 42`: guard rejeita o payload; o TX_START e descartado. Aceitavel: so um cliente adulterado produziria isso.

**Done when**
- `npm run typecheck`, `npm run lint` e `npx vitest run` verdes (a suite atual de `protocol.test.ts` nao pode quebrar: os campos sao opcionais).
- Exercicio da ida e volta do settings (RF-15), sem UI ainda: `npm run dev`, no DevTools do renderer rodar `await window.zoi.settings.set({ forceVp8: true })` e `await window.zoi.settings.get()`; fechar o app; `npm run dev` de novo; `await window.zoi.settings.get()` deve mostrar `forceVp8: true`. Depois voltar para `false`. Registrar no relato o valor visto nas duas leituras.
- Exercicio do log de ambiente: conferir no arquivo do dia em `%APPDATA%/Zoi da Goiaba/logs/` a linha `[codec] chromium ...` e ANOTAR o major do Chromium no relato (fecha o [ASSUMPTION A1]).

**Commit**: `feat(protocolo): abre campos opcionais de codec e persiste o modo compatibilidade`
**Rollback**: reverter o commit; os campos sao aditivos e ninguem os consome ainda.

---

### Sprint B2 - Deteccao de capacidade e anuncio pela sala

#### Feature 2.1 - Sondagem de capacidade por maquina `[core]`

**Traces**: RF-02, RF-03, RF-04, RF-13, RF-14, RNF-04.

**Steps**
1. Criar `src/renderer/src/services/codec-capabilities.ts` implementando 5.C5. Cabecalho de comentario explicando: DUAS sondas separadas (decode no boot sem preset, encode por preset ao transmitir), cacheadas, nunca por quadro; `powerEfficient` no encode e o criterio de "tem encoder de hardware" (P1); qualquer falha degrada para `['VP8']`.
2. Estado do modulo: `let forceVp8 = DEFAULT_FORCE_VP8`, `const forceListeners = new Set<(value: boolean) => void>()`, `let encodeCandidates: VideoCodecId[] = ['VP8']`, `let decodeCodecs: VideoCodecId[] = ['VP8']`, `let decodeProbe: Promise<void> | null = null`, `const encodeProbes = new Map<PresetId, Promise<void>>()`, `let lastProbe: Record<string, unknown> = {}`.
3. `isForceVp8`/`setForceVp8`/`subscribeForceVp8` no molde de `sound-player.ts:38-50`. `setForceVp8` so notifica quando o valor MUDA.
4. `negotiableCodecs()` (privada): le `RTCRtpSender.getCapabilities('video')`; para cada entrada monta `{ codec: VideoCodecId, contentType: string }` onde `contentType = sdpFmtpLine ? \`${mimeType};${sdpFmtpLine}\` : mimeType`, mapeando o `mimeType` (`video/AV1`, `video/VP9`, `video/H264`, `video/VP8`) para o `VideoCodecId`. Ignora o que nao mapeia (rtx, red, ulpfec). Tudo dentro de `try/catch` com retorno `[]`.
5. `ensureDecodeProbe()`: se `decodeProbe` ja existir, devolve. Senao cria e guarda uma promessa que:
   - para cada candidato de `negotiableCodecs()`, chama `navigator.mediaCapabilities.decodingInfo({ type: 'webrtc', video: { contentType, ...DECODE_PROBE_VIDEO } })`. "Decodifica bem" = `supported === true && smooth === true` (`powerEfficient` de decode e so registrado no diagnostico, nao exigido: maquina forte decodifica bem por software);
   - guarda `decodeCodecs` = aprovados ordenados por `VIDEO_CODEC_PRIORITY`, com `'VP8'` sempre presente no fim;
   - acumula o resultado cru em `lastProbe`;
   - loga UMA linha: `console.info('[codec] sonda de decodificacao: [...]')`;
   - `catch`: mantem `['VP8']` e loga `console.warn('[codec] sonda de decodificacao indisponivel; anunciando so VP8:', error)`.
6. `ensureEncodeProbe(presetId)`: se ja houver promessa para esse preset, devolve. Senao cria e guarda uma promessa que:
   - monta a configuracao do preset (`PRESETS[presetId]`: `width`, `height`, `frameRate`, `maxBitrate`);
   - para cada candidato, chama `navigator.mediaCapabilities.encodingInfo({ type: 'webrtc', video: { contentType, width, height, bitrate: maxBitrate, framerate: frameRate } })`. Elegivel a escada = `supported === true && powerEfficient === true`. Se um codec tiver varias entradas (H264 com perfis diferentes), basta UMA elegivel;
   - guarda `encodeCandidates` = elegiveis ordenados por `VIDEO_CODEC_PRIORITY`, com `'VP8'` sempre presente no fim;
   - acumula em `lastProbe`; loga `console.info('[codec] sonda de codificacao <presetId>: [...]')`;
   - `catch`: mantem `['VP8']` e loga `console.warn('[codec] sonda de codificacao indisponivel; seguindo em VP8:', error)`.
7. `getEncodeCandidates()`: se `forceVp8`, devolve `['VP8']`; senao devolve copia de `encodeCandidates`.
8. `getLocalDecodeCodecs()`: se `forceVp8`, devolve `['VP8']`; senao copia de `decodeCodecs`.
9. `src/renderer/src/App.tsx` (import novo: `{ ensureDecodeProbe, setForceVp8 }` de `./services/codec-capabilities`): no `bootstrap()` (linhas 56-70), ao lado de `setSoundVolume(settings.soundVolume)` (linha 64), chamar `setForceVp8(settings.forceVp8)` e, LOGO DEPOIS, `void ensureDecodeProbe()`. A ordem importa: `setForceVp8` primeiro para que a sonda ja saia com o escape valendo. E `void` de proposito: o boot NAO espera a sonda; enquanto ela nao resolve, o anuncio sai `['VP8']` e o tick seguinte (3s) ja corrige.
10. `src/renderer/src/services/session.ts:1148-1154`: acrescentar `codecs: () => describeCodecProbe()` ao objeto `__zoiDebug` (mesmo espirito de `dropSignaling`/`health`).

**Edge cases** (categoria: plataforma)
- `navigator.mediaCapabilities` inexistente (ambiente de teste, jsdom): `typeof navigator === 'undefined' || !navigator.mediaCapabilities` -> `['VP8']`, sem excecao. NENHUM acesso a `navigator` em tempo de import (o modulo e importado por `session.ts`, que roda em teste unitario).
- `RTCRtpSender` inexistente: idem.
- `encodingInfo`/`decodingInfo` que rejeita para um codec especifico: aquele codec e descartado, os outros continuam.
- Preset trocado no meio da sessao: nova entrada no mapa de sondas de ENCODE, sem invalidar a anterior; a sonda de decode nao e afetada (nao depende de preset).
- Escape ligado com sonda em andamento: `getEncodeCandidates`/`getLocalDecodeCodecs` ja devolvem `['VP8']` antes mesmo de a sonda terminar.
- Maquina que NUNCA transmite: `ensureEncodeProbe` nunca roda e `encodeCandidates` fica em `['VP8']` - correto e irrelevante, porque so quem transmite le esse valor. O que essa maquina precisa (`decodeCodecs`) ja foi resolvido no boot.
- Primeiro `QUALITY_UPDATE` disparando antes de a sonda de decode resolver: anuncia `['VP8']`; o tick seguinte anuncia a lista real. Convergencia em ate 3s, sem nenhum estado preso.

**Done when**
- `npm run typecheck`, `npm run lint`, `npx vitest run` verdes.
- Exercicio real 1 (ENCODE): `npm run dev`, iniciar uma transmissao local e rodar `__zoiDebug.codecs()` no DevTools; ANOTAR no relato quais codecs sairam com `powerEfficient` nesta maquina. Esse dado alimenta P2 na sessao real do grupo.
- Exercicio real 2 (DECODE, o que a revisao pegou): `npm run dev` e rodar `__zoiDebug.codecs()` **SEM nunca ter transmitido nesta execucao** (nem entrar em sala e preciso). A lista de decodificacao precisa vir POPULADA. Se vier `['VP8']` numa maquina que decodifica VP9/AV1, a sonda de boot nao esta rodando e a feature esta ERRADA: nao commite.

**Commit**: `feat(codec): sonda encoder e decoder de hardware por maquina`
**Rollback**: reverter o commit; nenhum caminho de midia consome o modulo ainda (so `__zoiDebug`).

#### Feature 2.2 - Anuncio de decodificacao pela sala `[api-like]`

**Traces**: RF-05, RF-06, RF-14, RNF-06, RNF-07.

**Steps**
1. `src/renderer/src/core/room-state.ts`:
   - importar `normalizeDecodeAnnouncement`, `isVideoCodecId` e o tipo `VideoCodecId` de `@shared/codecs`;
   - acrescentar `decodeCapabilities: Record<string, VideoCodecId[]>` em `RoomState` (68-89) e `decodeCapabilities: {}` em `createInitialState` (92-111);
   - acrescentar `videoCodec: VideoCodecId | null` em `TransmissionState` (42-52);
   - case `TX_START` (550-581): preencher `videoCodec: isVideoCodecId(payload.videoCodec) ? payload.videoCodec : null`;
   - case `QUALITY_UPDATE` (624-640): alem do que ja faz, gravar `decodeCapabilities: { ...state.decodeCapabilities, [from]: normalizeDecodeAnnouncement(message.payload.decodes) }`;
   - `LocalQualityEvent` (228-234): campo novo `decodes: VideoCodecId[]`;
   - `applyLocalQuality` (1415-1432): incluir `decodes: event.decodes` no payload do broadcast;
   - `applyLocalTxStart` (1342-1378): preencher `videoCodec: null` no `TransmissionState` local (o valor real do transmissor local vem na feature 3.1, junto com quem sabe escolher o codec; aqui so o TIPO precisa fechar);
   - poda: acrescentar `decodeCapabilities: withoutKeys(state.decodeCapabilities, <mesma lista de peerIds>)` imediatamente abaixo de cada `quality: withoutKeys(...)` nas linhas 920, 1143 e 1279.
2. `src/renderer/src/services/session.ts`:
   - importar `getLocalDecodeCodecs` de `./codec-capabilities`;
   - no callback `onReport` do `StatsMonitor` (265-279), incluir `decodes: getLocalDecodeCodecs()` no `dispatch` de `LOCAL_QUALITY`.
3. NAO mexer aqui em `LocalTxStartEvent`, `announceTransmissionStart` nem em `MediaManager.onMemberJoined`: a emissao LOCAL de `videoCodec` e da feature 3.1, que e quem passa a saber escolher o codec. Mexer antes deixaria `announceTransmissionStart` exigindo um argumento que nenhum chamador tem, e o `typecheck` quebraria no fim desta feature.
4. `src/renderer/src/services/session.ts:1148-1154`: acrescentar `codecRoom: () => session.getState().decodeCapabilities` ao objeto `__zoiDebug` (diagnostico permanente, mesmo espirito de `health()`; e o que torna esta feature exercitavel).

**Edge cases** (categoria: api-like / reducer puro)
- Membro que nunca anuncia: nao ha entrada em `decodeCapabilities`; leitura devolve `['VP8']`.
- `QUALITY_UPDATE` de nao-membro: ja rejeitado antes de chegar aqui (`rejectFrom`), nenhuma capacidade gravada.
- Membro sai e volta com o mesmo peerId: a poda apagou a entrada; o proximo tick recria.
- Dois `QUALITY_UPDATE` no mesmo tick: o ultimo vence (sobrescrita simples).
- Sala com 8 membros: 8 entradas no mapa, uma linha por membro, custo desprezivel.
- Imutabilidade: sempre criar objeto novo (`{ ...state.decodeCapabilities, [from]: ... }`); a UI compara por identidade.

**Done when**
- `npm run typecheck`, `npm run lint`, `npx vitest run` verdes (a suite de `room-state.test.ts` e `session.test.ts` NAO pode quebrar; se algum literal de estado inicial for comparado por igualdade profunda, ajuste o teste existente e diga isso no relato).
- Exercicio real com DUAS instancias: `npm run dev` numa janela e uma segunda instancia com `ZOI_USER_DATA_DIR` proprio; entrar na mesma sala; **NINGUEM transmite**; no DevTools de uma delas, rodar `__zoiDebug.codecRoom()` e conferir que, em ate 3s, existe a entrada do OUTRO peerId com a lista REAL de codecs dele. Colar a saida no relato.
- **Gate anti-regressao (a revisao desta SPEC pegou exatamente isto)**: se `codecRoom()` mostrar `['VP8']` para um par que sabidamente decodifica VP9/AV1 (compare com o `__zoiDebug.codecs()` da propria maquina dele), a feature esta ERRADA - provavelmente a sonda de decodificacao nao esta rodando no boot, so ao transmitir. Nesse estado a sala inteira degeneraria para VP8 no cenario primario (1 transmissor + N espectadores) sem nenhum sintoma visivel. NAO commite; corrija a feature 2.1 antes.

**Commit**: `feat(codec): anuncia pela sala o que cada maquina decodifica bem`
**Rollback**: reverter o commit; o campo do protocolo continua opcional e ninguem o consome.

---

### Sprint B3 - Preferencia de codec na negociacao e modo nitidez

#### Feature 3.1 - Codec da sala aplicado na negociacao `[core]`

**Traces**: RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-13, RF-14, RNF-03, RNF-04.

**Steps**
1. `src/renderer/src/services/peer-manager.ts:277-279`: `call(peerId, stream, metadata, sdpTransform?)` -> `this.requireMemberPeer().call(peerId, stream, sdpTransform ? { metadata, sdpTransform } : { metadata })`. Comentario curto explicando que `sdpTransform` e o UNICO gancho de preferencia de codec do PeerJS 1.5.5 (a oferta ja foi criada quando `call()` retorna).
2. `src/renderer/src/services/session.ts:490-492`: `callPeer(peerId, stream, metadata, sdpTransform?)` repassa o 4o argumento.
3. `src/renderer/src/services/media-manager.ts` (imports novos: `preferVideoCodec`, `pickRoomCodec`, tipo `VideoCodecId` de `@shared/codecs`; `CODEC_MEMBER_GRACE_MS` de `@shared/config`; `ensureEncodeProbe`, `getEncodeCandidates`, `isForceVp8` de `./codec-capabilities`):
   - `LocalTransmission` (37-48): campo novo `videoCodec: VideoCodecId`;
   - campo `private readonly memberFirstSeenAt = new Map<string, number>()`: quando cada par do roster foi visto pela primeira vez por ESTA maquina. E a base da carencia por membro;
   - metodo privado `codecTransform(codec)` exatamente como em 5.C6: **devolve `undefined` quando `codec` e `null` OU `'VP8'`**. Comentario obrigatorio explicando o porque: VP8 e o que o Chromium ja negocia sozinho, entao o caminho de base fica sem nenhuma manipulacao de SDP (protege a persona mais fraca, risco R5, e faz o modo compatibilidade voltar ao comportamento exato de hoje);
   - metodos privados `syncMemberSeen(now)` e `memberDecodes(now)` conforme 5.C6: `syncMemberSeen` registra em `memberFirstSeenAt` cada membro do roster que nao seja o proprio e apaga quem saiu; `memberDecodes` chama `syncMemberSeen(now)` e entao devolve, por membro, a lista anunciada quando existir e, quando NAO existir, `['VP8']` se `now - firstSeenAt >= CODEC_MEMBER_GRACE_MS`, **omitindo o membro** enquanto a carencia nao vencer;
   - metodo privado `chooseRoomCodec(now)`: `pickRoomCodec(getEncodeCandidates(), this.memberDecodes(now))`;
   - `startTransmission` (247-339): logo apos `const preset = PRESETS[options.presetId]`, `await ensureEncodeProbe(options.presetId)`; ao montar `transmission` (311-321), `videoCodec: this.chooseRoomCodec(Date.now())`; incluir `videoCodec: transmission.videoCodec` no `announceTransmissionStart` (325-331); logar `console.info(\`[codec] transmissao ${txId} vai sair em ${videoCodec}\`)`;
   - `callPeer` (365-387): passar `this.codecTransform(transmission.videoCodec)` como 4o argumento de `session.callPeer`;
   - `answerCall` (529-535): **NAO MEXER**. Com o escape resolvido por anuncio (T9), o unico transform possivel aqui seria VP8, que ja vira `undefined`;
   - `startMediaPull` (577-603): `const wanted = isForceVp8() ? 'VP8' : (state.transmissions[txId]?.videoCodec ?? null)` e passar `this.codecTransform(wanted)` no `session.callPeer` (com escape ligado ou com transmissao em VP8 isso vira `undefined` e a oferta sai exatamente como hoje). NAO mexer em nenhum log existente deste metodo;
   - `answerPull` (609-636): `call.answer(transmission.stream, { sdpTransform: this.codecTransform(transmission.videoCodec) })`;
   - `onMemberJoined` (437-453): incluir `videoCodec: transmission.videoCodec` no `TX_START` reenviado.
4. `src/renderer/src/services/session.ts` (464-472) e `src/renderer/src/core/room-state.ts` (`LocalTxStartEvent` 206-214 e `applyLocalTxStart` 1342-1378): acrescentar o campo `videoCodec: VideoCodecId` no argumento de `announceTransmissionStart`, no evento e no `TransmissionState` local, e inclui-lo no payload do broadcast de `TX_START` (contrato 5.C2). Este e o passo que a feature 2.2 deixou de proposito para ca.
5. Conferir que `switchSource` (360-363) nao precisa de nada: ela chama `stopTransmission` + `startTransmission`, entao a escolha e recalculada por construcao (RF-08).

**Edge cases** (categoria: caminho de midia)
- Espectador de versao antiga que ja passou da carencia: entra na conta como `['VP8']`, o codec da sala vira VP8, nenhum transform e aplicado e a negociacao com ele fica identica a de hoje (RF-06/RF-07).
- Espectador de versao antiga que entrou ha menos de `CODEC_MEMBER_GRACE_MS`: fica de fora da conta e pode receber uma oferta reordenada (ex.: AV1 na frente). Isso NAO quebra a chamada, porque a reordenacao nunca remove VP8 da `m=video`: ele responde VP8 e a midia flui. O rebaixamento por composicao da sala (feature 4.2) acerta o codec no primeiro tick depois de a carencia vencer.
- Transmissor de versao antiga chamando um cliente novo: o cliente novo so responde, e `answerCall` esta intocado; negocia VP8 como sempre.
- Escape ligado NESTA maquina: `getEncodeCandidates()` devolve `['VP8']`, `pickRoomCodec` devolve `'VP8'`, `codecTransform` devolve `undefined` e nenhuma linha de SDP e tocada em ponta nenhuma (AC-14).
- Escape ligado num ESPECTADOR enquanto o transmissor ja esta em AV1: o anuncio dele chega em ate 3s e o rebaixamento da feature 4.2 leva a sala para VP8 no tick seguinte. Transitorio conhecido e limitado (risco R11), sem munging do lado do espectador por decisao explicita (T9).
- Pull de uma transmissao cujo `videoCodec` e `null` (transmissor antigo) ou `'VP8'`: sem transform, comportamento identico ao de hoje.
- `chooseRoomCodec` com sala de uma pessoa: `memberDecodes` vazio, vale so a capacidade local.
- Transmitir nos primeiros 3s depois de entrar na sala (antes do primeiro tick do `StatsMonitor`, que e quem alimenta `memberFirstSeenAt`): todo mundo aparece como recem chegado e fica de fora da conta, entao a escolha nasce otimista. Autocorrige em ate carencia + um tick (risco R11). Da segunda transmissao em diante o mapa ja esta quente, porque ele NAO e limpo no `stopTransmission`.
- Sonda de ENCODE ainda nao resolvida no primeiro `startTransmission`: o `await ensureEncodeProbe` garante que resolveu; na pior hipotese ela resolveu com `['VP8']`.

**Done when**
- `npm run typecheck`, `npm run lint`, `npx vitest run` verdes.
- Exercicio real obrigatorio com DUAS instancias na mesma sala e transmissao de verdade. Precisa constar no relato:
  (a) a linha `[codec] transmissao <txId> vai sair em <CODEC>` do transmissor;
  (b) a imagem chegando no espectador (transmissao visivel, sem tela preta);
  (c) o log do ESPECTADOR sem nenhuma das 4 marcas vigiadas (`grep -niE` no arquivo do dia): a reordenacao de SDP nao pode ter empurrado a midia para o caminho de fallback.
  A prova definitiva por `getStats` (codec + `encoderImplementation` vindos do Chromium) e o exercicio da feature 4.1, que e onde o AC-12 fecha; aqui a evidencia e o log de escolha + midia fluindo.
- Numa maquina SEM encoder de hardware, o resultado esperado e `VP8` e imagem igual a de hoje: isso tambem e um resultado valido e precisa ser relatado como tal (nao e falha).
- Verificacao do caminho de base (fix da revisao): com o codec escolhido igual a `'VP8'` (force o cenario ligando o modo compatibilidade pelo DevTools com `settings.set({ forceVp8: true })` e reiniciando), confirmar que `session.callPeer` recebe `undefined` como 4o argumento - um `console.info` temporario no `codecTransform` serve, desde que seja REMOVIDO antes do commit. O caminho VP8 tem que ficar sem nenhum `sdpTransform`.
- Verificacao de colisao de log: `grep -niE "media-pull|dialback|discando de volta|na outra direcao" src/renderer/src/services/media-manager.ts` nao pode ter NENHUMA ocorrencia nova alem das que ja existiam nas linhas 598, 602, 618 e 623.
- `npm run test:e2e` verde (este e o sprint que mexe no coracao do caminho de midia; nao passe adiante sem os 5 specs verdes).

**Commit**: `feat(codec): aplica a preferencia de codec na negociacao de midia`
**Rollback**: reverter o commit. O sistema volta a negociar VP8 por default do PeerJS; nenhum estado persistido fica invalido (`forceVp8` continua so ignorado).

#### Feature 3.2 - Modo nitidez ao vivo (backend) `[core]`

**Traces**: RF-16, RF-17, RF-18, RF-19, RNF-04.

**Steps**
1. `src/renderer/src/services/media-manager.ts`: campo `private sharpness = false`.
2. `applySenderParameters` (402-432): trocar a linha 425 por `parameters.degradationPreference = this.sharpness ? 'maintain-resolution' : 'maintain-framerate'`. Comentario: quem entra depois (membro novo, redial de rebaixamento) herda o modo corrente.
3. Metodo publico:
   ```
   setSharpnessMode(on: boolean): void
   ```
   - se nao houver `this.local`, so guarda `this.sharpness = on` e retorna;
   - `this.sharpness = on`;
   - `videoTrack.contentHint = on ? 'detail' : 'motion'` no primeiro video track de `this.local.stream`;
   - para cada `outgoing` de `this.outgoingCalls`: pegar o sender de video de `outgoing.call.peerConnection`, `const parameters = sender.getParameters()`, setar `parameters.degradationPreference` e chamar `sender.setParameters(parameters).catch((error) => console.warn('[media] falha ao aplicar o modo nitidez:', error))`. NAO tocar em `encodings` aqui (bitrate/framerate sao do preset);
   - logar `console.info(\`[codec] modo nitidez ${on ? 'ligado' : 'desligado'}\`)`.
4. `isSharpnessMode(): boolean` devolve `this.sharpness`.
5. `startTransmission`: `this.sharpness = false` logo depois da checagem de `TransmissionInProgressError` (RF-19). `stopTransmission` e `teardown`: `this.sharpness = false`.
6. `session.ts:1148-1154`: acrescentar `sharpness: (on: boolean) => mediaManager.setSharpnessMode(on)` ao `__zoiDebug`? NAO - `session.ts` nao importa `mediaManager` (a dependencia e ao contrario). Em vez disso, exportar o gancho de `media-manager.ts`, no fim do arquivo, ao lado da instancia unica (linha 813): `if (typeof window !== 'undefined') { (window as unknown as { __zoiDebugMedia: unknown }).__zoiDebugMedia = { sharpness: (on: boolean) => mediaManager.setSharpnessMode(on) } }`.

**Edge cases** (categoria: caminho de midia)
- Toggle sem transmissao ativa: guarda o valor e nao lanca (a UI so mostra o toggle com transmissao ativa, mas o metodo precisa ser seguro).
- Toggle chamado duas vezes com o mesmo valor: idempotente, reaplica sem efeito colateral.
- `setParameters` rejeitado por alguma versao do Chromium: log de warn, `contentHint` continua valendo, transmissao NAO para ([ASSUMPTION A3]).
- Chamada de saida ainda sem `peerConnection`/sender (recem criada): ignorada aqui; ela ja vai receber o valor correto pelo `applySenderParameters` dela.
- Nova transmissao depois de uma com nitidez ligada: comeca desligada (RF-19).

**Done when**
- `npm run typecheck`, `npm run lint`, `npx vitest run` verdes.
- Exercicio real com transmissao ativa entre duas instancias: no DevTools do transmissor, `__zoiDebugMedia.sharpness(true)`; conferir no console a linha `[codec] modo nitidez ligado`, conferir que a imagem no espectador NAO piscou nem caiu, e provar a aplicacao lendo `contentHint` da track local (`mediaManager` nao esta no escopo global; use o proprio log + a inspecao visual). Depois `__zoiDebugMedia.sharpness(false)` e conferir a volta. Relatar se `setParameters` aceitou a troca de `degradationPreference` ao vivo (fecha o [ASSUMPTION A3]).

**Commit**: `feat(nitidez): permite alternar prioridade de nitidez durante a transmissao`
**Rollback**: reverter o commit; `degradationPreference` volta a ser fixo `maintain-framerate`.

---

### Sprint B4 - Observabilidade de saida e rebaixamento automatico

#### Feature 4.1 - Estatisticas de saida e log de codec `[core]`

**Traces**: RF-11, RF-21, RNF-01, RNF-05, RNF-07.

**Steps**
1. `src/renderer/src/services/stats-monitor.ts`: acrescentar `OutboundEntry` e `OutboundVideoStats` (contrato 5.C3); acrescentar `codec?: string | null` e `decoderImplementation?: string | null` (opcionais!) em `InboundVideoStats`; acrescentar `outboundEntries()` e `onOutboundVideoStats` (este SEM `?`: e obrigatorio, ver 5.C3) em `StatsMonitorCallbacks`.
   **Tipagem**: NAO confie no `lib.dom` para `encoderImplementation`, `decoderImplementation` e `codecId` (nem toda versao do TypeScript declara esses campos em `RTCOutboundRtpStreamStats`/`RTCInboundRtpStreamStats`, e o `typecheck` quebraria). Siga o padrao que o projeto ja usa em `ice-diagnostics.ts:16-31`: declare interfaces locais estreitas (ex.: `interface RtpVideoStatsEntry { type?: string; kind?: string; codecId?: string; encoderImplementation?: string; decoderImplementation?: string; qualityLimitationReason?: string; framesPerSecond?: number; framesDecoded?: number; framesReceived?: number }`) e faca o cast uma vez, como o codigo ja faz com `RTCInboundRtpStreamStats` na linha 100.
2. `sample()` (85-145):
   - no laco de entrada ja existente (95-119), ao montar o `InboundVideoStats`, incluir `decoderImplementation: entry.decoderImplementation ?? null` e `codec: codecMimeOf(stats, entry.codecId)`;
   - helper privado `codecMimeOf(report: RTCStatsReport, codecId: string | undefined): string | null` - procura o report `type === 'codec'` com aquele `id` e devolve `mimeType`, ou `null`;
   - DEPOIS do laco de entrada e ANTES do `onReport`, um laco novo sobre `this.callbacks.outboundEntries()`: um `getStats()` por conexao, procurando `report.type === 'outbound-rtp' && kind === 'video'`, montando `OutboundVideoStats` com `codec`, `encoderImplementation ?? null`, `qualityLimitationReason ?? null`, `framesPerSecond ?? null`, `at: sampledAt`; publicar por `this.callbacks.onOutboundVideoStats(perPeer)` (sem `?.`, o callback e obrigatorio);
   - o laco novo comeca com `const perPeer = new Map<string, OutboundVideoStats>()` e usa `perPeer.set(outbound.peerId, {...})`;
   - o callback e chamado a CADA tick, inclusive com o mapa VAZIO (sem transmissao local). Isso e contrato, nao detalhe: o consumidor usa esse tick como relogio para o mapa de membros vistos (5.C6);
   - `try/catch` por conexao igual ao laco de entrada (log `console.warn('[stats] falha ao coletar getStats:', error)`);
   - comentario reforcando RNF-07: mesmo tick, mesmo metodo, nenhum timer novo.
3. `src/renderer/src/services/media-manager.ts`:
   - `outboundEntries(): OutboundEntry[]` - percorre `this.outgoingCalls`, devolve `{ peerId, txId: this.local.txId, connection }` para as que ja tem `peerConnection`; array vazio sem transmissao local;
   - `onOutboundVideoStats(stats)` - **primeira linha, SEMPRE, antes de qualquer saida antecipada: `this.syncMemberSeen(Date.now())`** (o mapa de "visto pela primeira vez" precisa ser alimentado mesmo sem transmissao local; ver 5.C6). Depois disso, se nao houver `this.local`, retorna. O resto e o LOG (o rebaixamento entra na 4.2):
     - manter `private readonly codecLogState = new Map<string, { samples: number; signature: string }>()`;
     - para cada `[peerId, entry]`: `signature = \`${entry.codec}|${entry.encoderImplementation}|${entry.qualityLimitationReason}\``; se nao houver estado para o peer OU a assinatura mudou OU `samples % CODEC_LOG_EVERY_N_SAMPLES === 0`, logar
       `console.info(\`[codec] envio ${shortPeerId(peerId)}: ${entry.codec ?? 'desconhecido'} impl=${entry.encoderImplementation ?? 'desconhecida'} fps=${entry.framesPerSecond ?? '?'} limite=${entry.qualityLimitationReason ?? 'nenhum'}\`)`;
     - incrementar `samples`; limpar a entrada em `closeOutgoing`, `stopTransmission` e `teardown`;
4. Log simetrico de ENTRADA (lado de quem assiste), em `src/renderer/src/services/session.ts`, dentro de `notifyInboundVideoStats` (1065-1067): mesma regra de cadencia (`CODEC_LOG_EVERY_N_SAMPLES` ou mudanca de assinatura), formato `console.info(\`[codec] recepcao ${txId.slice(0, 8)}: ${codec ?? 'desconhecido'} impl=${decoderImplementation ?? 'desconhecida'} quadros=${framesDecoded}\`)`. A contagem por txId vive num `Map<string, number>` privado da `Session`, limpo no `teardown` (1105-1130). Esta escolha evita mexer em `MediaHooks` so por causa de um log e mantem o lado receptor instrumentado (util para separar "nao chegou" de "chegou lixo" quando o driver do encoder tem bug).
5. `session.ts` (265-279): ligar `outboundEntries: () => this.mediaHooks.outboundEntries()` e `onOutboundVideoStats: (stats) => this.mediaHooks.onOutboundVideoStats(stats)` nos callbacks do `StatsMonitor`. Acrescentar os dois metodos em `MediaHooks` (122-137) e em `noopMediaHooks` (175-183).

**PROIBIDO** em qualquer string desta feature: `media-pull`, `dialback`, `discando de volta`, `na outra direcao`. Identifique conexoes por `shortPeerId`, nunca pela tag de ICE.

**Edge cases** (categoria: telemetria)
- Sem transmissao local: `outboundEntries()` devolve `[]` e o laco novo nao faz nenhum `getStats()`.
- Conexao de saida ainda sem `peerConnection`: fora da lista, como ja acontece em `inboundEntries` (764-770).
- `outbound-rtp` sem `qualityLimitationReason` (nem todo Chromium preenche): `null`, e o watcher da 4.2 trata `null` como "nao e cpu".
- `getStats()` que rejeita: warn e segue para a proxima conexao, sem derrubar o tick.
- 7 espectadores: 7 `getStats()` extras por tick de 3s; aceitavel e ainda longe de trabalho por quadro (RNF-04).
- Conexao substituida por redial: a chave e o `peerId`, entao a assinatura muda e o log sai na hora (que e o que se quer ver).

**Done when**
- `npm run typecheck`, `npm run lint`, `npx vitest run` verdes.
- Exercicio real com duas instancias transmitindo: o log do transmissor precisa mostrar `[codec] envio <peer>: video/<CODEC> impl=<...> fps=<...> limite=nenhum` e o do espectador `[codec] recepcao <tx>: video/<CODEC> impl=<...>`. COLAR as duas linhas reais no relato (e a evidencia de AC-12/AC-28 e a base de P2).
- `grep -niE "media-pull|dialback|discando de volta|na outra direcao"` nos arquivos tocados sem ocorrencia nova.

**Commit**: `feat(codec): registra codec, encoder e fps por conexao no monitor existente`
**Rollback**: reverter o commit; o monitor volta a ler so a entrada.

#### Feature 4.2 - Rebaixamento automatico por CPU e por composicao da sala `[core]`

**Traces**: RF-05, RF-06, RF-09, RF-10, RF-13, RF-14, RNF-02, RNF-05.

**Regra quantitativa (com exemplo trabalhado).** Tick = `QUALITY_UPDATE_INTERVAL_MS` = 3s.

- `samplesSinceCodecChange` conta amostras desde o inicio da transmissao ou desde a ultima troca de codec.
- Enquanto `samplesSinceCodecChange <= CODEC_CPU_WARMUP_SAMPLES` (3), o watcher NAO avalia cpu (o arranque do encoder gera `'cpu'` transitorio).
- Uma amostra e "cpu" se ALGUMA conexao de saida daquele tick tiver `qualityLimitationReason === 'cpu'`.
- `cpuStreak` incrementa em amostra "cpu" e **zera** em qualquer amostra que nao seja "cpu" (isso e o anti-flapping do AC-10).
- Quando `cpuStreak >= CODEC_CPU_PERSISTENT_SAMPLES` (4) E `downgrades < CODEC_MAX_DOWNGRADES` (2): rebaixa.
- Rebaixar = `nextLowerCodec(atual, getEncodeCandidates(), memberDecodes)`; se devolver `null` (ja esta em VP8), NAO faz nada e o watcher para de avaliar ate a proxima troca.
- Toda troca de codec zera `cpuStreak` e `samplesSinceCodecChange`.

**Exemplo trabalhado (AC-09/AC-10)**: transmissao comeca em AV1 em t=0.
t=3s, 6s, 9s (amostras 1,2,3) - aquecimento, ignoradas mesmo com `'cpu'`.
t=12s amostra 4 `'cpu'` -> streak 1. t=15s `'cpu'` -> 2. t=18s `'bandwidth'` -> **streak zera** (nao rebaixa: e o caso do AC-10).
t=21s `'cpu'` -> 1. t=24s `'cpu'` -> 2. t=27s `'cpu'` -> 3. t=30s `'cpu'` -> 4 -> **rebaixa AV1 -> H264** (`downgrades = 1`), refaz as chamadas, zera contadores.
Se a cadeia se repetir, o segundo rebaixamento leva a VP8 (`downgrades = 2`) e o terceiro nunca acontece (teto), nem existiria degrau abaixo de VP8.

**Composicao da sala (`reviewRoomCodec`, roda no MESMO tick).**
- `desired = this.chooseRoomCodec(Date.now())`, ou seja, `pickRoomCodec` sobre `memberDecodes(now)` - que ja aplica a CARENCIA POR MEMBRO: quem nunca anunciou e esta ha menos de `CODEC_MEMBER_GRACE_MS` (6s) no roster fica fora da conta; passada a carencia, conta como `['VP8']` PARA SEMPRE, tenha entrado antes ou depois de a transmissao comecar (RF-06).
- Se `desired` for MAIS BAIXO que o atual: troca (rebaixamento por composicao da sala). NAO consome o teto de `CODEC_MAX_DOWNGRADES`, que e so do gatilho de cpu.
- Se `desired` for MAIS ALTO que o atual: **nunca promove**. O codec so desce durante uma transmissao (regra monotonica); subir exigiria refazer as chamadas para melhorar algo que ja esta funcionando.
- Nao existe mais janela GLOBAL de acomodacao: a carencia e por MEMBRO. Era exatamente o defeito apontado na revisao desta SPEC - com janela global, um par de versao antiga que entrasse depois dela ficaria ignorado para sempre enquanto `onMemberJoined` ja o estaria chamando em AV1.
- **Exemplo trabalhado (carencia por membro)**: `CODEC_MEMBER_GRACE_MS = 6_000`, tick de 3s.
  - t=0s: B entra na sala. A (transmissor em potencial) registra `memberFirstSeenAt[B] = 0`.
  - t=1s: A comeca a transmitir. B esta ha 1s no roster e nunca anunciou -> FORA da conta -> `memberDecodes = []` -> codec da sala = melhor de A = `AV1`. As chamadas saem em AV1.
  - t=3s: chega o `QUALITY_UPDATE` de B com `['AV1','VP9','H264','VP8']`. `desired = AV1` = atual -> nada acontece. Nenhuma troca, nenhuma piscada.
  - t=40s: C entra (versao ANTIGA, nunca vai anunciar). `memberFirstSeenAt[C] = 40s`. `onMemberJoined` chama C em AV1; C responde VP8 na SDP e a midia dele funciona (a reordenacao nunca remove VP8).
  - t=42s (tick): C esta ha 2s no roster, dentro da carencia -> fora da conta -> `desired = AV1` -> nada muda.
  - t=48s (tick): C esta ha 8s no roster, carencia VENCIDA -> conta como `['VP8']` -> `desired = VP8` < AV1 -> **rebaixa a sala para VP8**, refaz as chamadas de A para B e C, reanuncia `TX_START` com `videoCodec: 'VP8'`. Daqui para a frente C nunca mais some da conta, e o RF-06 vale de forma permanente.
  - Variante: se B (que anuncia) sai da sala em t=60s, `desired` poderia voltar a AV1, mas a regra monotonica impede a promocao; a proxima transmissao (ou uma troca de fonte) ja nasce em AV1.

**Steps**
1. `src/renderer/src/core/room-state.ts`, case `TX_START` (550-581): implementar a REGRA DE IDEMPOTENCIA do contrato 5.A2. Logo no inicio do case, se `state.transmissions[payload.txId]` existir E `.peerId === from`, devolver o estado com esse `TransmissionState` ATUALIZADO (`videoCodec`, `presetId`, `hasAudio`, `sourceKind`, `sourceLabel`), preservando `startedAt` e `status`, sem tocar em `selfWatchingTxId` e com `effects: []`. So o caminho de transmissao NOVA continua emitindo som e toast. Sem este passo, o reanuncio do passo 4 faria a sala inteira ouvir "comecou a transmitir" a cada rebaixamento.
2. `src/renderer/src/services/media-manager.ts` (imports novos: `nextLowerCodec` e `VIDEO_CODEC_PRIORITY` de `@shared/codecs`; `CODEC_CPU_WARMUP_SAMPLES`, `CODEC_CPU_PERSISTENT_SAMPLES`, `CODEC_MAX_DOWNGRADES` de `@shared/config`; `subscribeForceVp8` de `./codec-capabilities`): campos `private cpuStreak = 0`, `private samplesSinceCodecChange = 0`, `private downgrades = 0`, zerados em `startTransmission`, `stopTransmission` e `teardown`. **`memberFirstSeenAt` NAO entra nessa lista**: ele so e limpo no `teardown` (saida da sala). Limpar no `stopTransmission` faria a transmissao seguinte enxergar todo mundo como recem chegado e ignorar de novo o par de versao antiga - o mesmo defeito que a carencia por membro veio corrigir.
3. Metodo privado `applyCodecChange(next: VideoCodecId, reason: string): boolean` - devolve `true` SO quando a troca aconteceu de fato (mesma convencao de `reviewRoomCodec`, para o chamador nunca ter que adivinhar):
   - se nao houver `this.local` ou `next === this.local.videoCodec`, devolve `false` sem fazer nada;
   - `console.info(\`[codec] trocando de ${atual} para ${next} (${reason}); refazendo as chamadas de saida\`)` - `reason` chega em pt-BR do chamador (`'cpu limitada'`, `'sala mudou'`, `'modo compatibilidade'`, `'diagnostico'`);
   - `this.local.videoCodec = next`;
   - zera `cpuStreak` e `samplesSinceCodecChange`;
   - para cada `peerId` das chamadas de saida atuais (copiar as chaves ANTES de iterar, porque `callPeer` mexe no mapa): `this.callPeer(peerId)`;
   - por fim, REANUNCIO silencioso (T8): para cada `peerId` de `this.session.otherMemberPeerIds()`, `this.session.sendTo(peerId, { type: 'TX_START', payload: { txId, presetId, hasAudio, sourceKind, sourceLabel, startedAt: Date.now(), videoCodec: next } })`, exatamente no molde do reenvio que `onMemberJoined` ja faz (`media-manager.ts:437-453`). O `startedAt` enviado e ignorado pelo receptor por causa do passo 1, que preserva o original;
   - devolve `true`.
4. Metodo privado `reviewRoomCodec(now: number): boolean` (devolve se houve troca): `const desired = this.chooseRoomCodec(now)`; se `VIDEO_CODEC_PRIORITY.indexOf(desired) > VIDEO_CODEC_PRIORITY.indexOf(atual)` (ou seja, desired e mais BAIXO), devolve o retorno de `applyCodecChange(desired, 'sala mudou')`; caso contrario devolve `false` (jamais promove).
5. Estender `onOutboundVideoStats(stats)` (feature 4.1) para, depois do log (e sempre DEPOIS do `syncMemberSeen` que ja e a primeira linha do metodo): incrementar `samplesSinceCodecChange`; `const now = Date.now()`; se `this.reviewRoomCodec(now)` devolver `true`, terminar o tick aqui (a troca ja zerou os contadores); senao rodar o watcher de cpu descrito acima e, batendo o criterio, calcular `next = nextLowerCodec(atual, getEncodeCandidates(), this.memberDecodes(now))` e, com `next` diferente de `null`, fazer `if (this.applyCodecChange(next, 'cpu limitada')) this.downgrades += 1`. O contador SO anda quando o retorno e `true`: assim uma troca que nao aconteceu nunca gasta o teto.
6. Reacao ao escape ao vivo: no construtor do `MediaManager`, `subscribeForceVp8((value) => { if (value && this.local && this.local.videoCodec !== 'VP8') this.applyCodecChange('VP8', 'modo compatibilidade') })`. Desligar o escape nao promove nada (vale na proxima transmissao).
7. Gancho de diagnostico permanente (precedente `debugDropSignaling`): acrescentar ao `__zoiDebugMedia` criado na feature 3.2 o metodo `downgrade: () => mediaManager.debugDowngradeCodec()`. O metodo publico `debugDowngradeCodec(): void` calcula `const next = nextLowerCodec(this.local?.videoCodec ?? 'VP8', getEncodeCandidates(), this.memberDecodes(Date.now()))` e **so chama `applyCodecChange` se `next !== null`**; com `null` (ja em VP8, ou sem transmissao), loga `console.info('[codec] nao ha degrau abaixo do codec atual')` e retorna. E o unico jeito honesto de exercitar o redial sem uma CPU realmente saturada.

**Edge cases** (categoria: caminho de midia / concorrencia)
- Nenhuma conexao de saida no tick (todo mundo saiu): nada e avaliado, contadores seguem.
- Transmissao parada no meio do tick: `this.local` e `null` -> `onOutboundVideoStats` retorna cedo.
- `qualityLimitationReason` ausente/`null`: nao conta como cpu.
- Ja em VP8 com cpu persistente: `nextLowerCodec` devolve `null`, nada acontece, e isso e correto (VP8 e o comportamento pre-feature; RNF-01 nao promete melhorar o que ja era o piso).
- Membro sai durante o rebaixamento: `callPeer` para um peer que sumiu do roster ja e tratado com `try/catch` e warn (`media-manager.ts:384-386`).
- Rebaixamento com o pull ativo naquele par: `callPeer` faz `closeOutgoing` antes, e o pull daquele par e substituido pela chamada nova; o espectador segue o caminho normal de chamada recebida.
- `switchSource` durante uma cadeia de rebaixamentos: `stopTransmission` zera tudo, a transmissao nova recomeca do zero (RF-08).
- `debugDowngradeCodec()` sem transmissao ativa ou ja em VP8: `nextLowerCodec` devolve `null`, o metodo loga e retorna sem chamar `applyCodecChange`.
- Reanuncio para um par de versao ANTIGA: ele nao tem a regra de idempotencia e vai repetir som/toast de "comecou a transmitir". Incomodo conhecido e limitado a janela de versoes mistas (5.A2).
- Reanuncio com o mesh de um par caido: `session.sendTo` enfileira ou descarta como qualquer outra mensagem; nada aqui pode lancar.

**Done when**
- `npm run typecheck`, `npm run lint`, `npx vitest run` verdes.
- Exercicio real com duas instancias transmitindo: `__zoiDebugMedia.downgrade()` no transmissor. Precisa constar no relato: (a) a linha `[codec] trocando de X para Y (diagnostico); refazendo as chamadas de saida`; (b) o video no espectador voltou sozinho em poucos segundos; (c) o log do ESPECTADOR nao contem nenhuma das 4 marcas vigiadas (`grep -niE` no arquivo do dia dele) - essa e a prova direta do RF-10/AC-11; (d) o espectador NAO tocou o som de "comecou a transmitir" nem mostrou o toast na troca (prova da idempotencia do passo 1) e, no DevTools dele, `session.getState().transmissions[<txId>].videoCodec` (ou o proprio log) mostra o codec NOVO, nao o abandonado.
- `npm run test:e2e` verde (os 5 specs, com `expectNoDirectionFallbacks`).

**Commit**: `feat(codec): rebaixa o codec sozinho por cpu saturada ou por quem entra na sala`
**Rollback**: reverter o commit; o codec volta a ser escolhido so na abertura da transmissao (a feature 3.1 continua valendo) e o `TX_START` volta a nao ser idempotente.

---

## Frontend

Toda a identidade visual vem do `UISPEC_video-codec-upgrade.md` (fingerprint na secao 1). Nao re-derive cor, raio, espacamento ou tipografia a partir de screenshot ou de intuicao: use os tokens de `theme.css` listados na secao 3 do UISPEC e os componentes do inventario (secao 4). Regras "Faca / Nao faca" do UISPEC (secao 7) sao normativas.

**Decisao de design que o UISPEC delegou** (UISPEC secao 4, bullet dos botoes de barra): o toggle de nitidez dentro da TransmittingBar **reusa a estrutura HTML e as classes do `z-switch` byte a byte** (`<button class="z-switch z-switch--bar" role="switch" aria-checked>` + `z-switch__track` + `z-switch__thumb` + `z-switch__label`) e ganha APENAS um modificador de COR e escala, `z-switch--bar`, porque os tokens de superficie escura do switch original (`--bg-elevated`, `--border`, `--accent`) somem sobre o fundo solido `--danger` da barra. O modificador usa os mesmos brancos translucidos que os botoes da barra ja usam (`#ffffff26`, `#ffffff59`, `#ffffff`), que ja fazem parte da identidade da barra. Nada de estrutura nova, nada de cor fora da paleta, fundo da barra intocado.

### Sprint F1 - Superficie de UI da feature

#### Feature F1.1 - Toggle de nitidez na TransmittingBar `[frontend]`

**Traces**: RF-16, RF-17, RF-18, RF-19, RNF-08.

**Consumes contracts** (todos ja existentes no codigo apos o Backend, verbatim da secao 5.C6):
- `mediaManager.setSharpnessMode(on: boolean): void`
- `mediaManager.isSharpnessMode(): boolean`

**Steps**
1. `src/renderer/src/ui/screens/room.css`, no FIM do arquivo (apos a linha 643, logo abaixo do bloco `.z-switch__hint`), acrescentar o modificador com comentario em pt-BR sem acento explicando por que existe:
   ```css
   .z-switch--bar {
     width: auto;
     padding: 0;
     border: 0;
     background: transparent;
     color: #ffffff;
     gap: var(--space-2);
     font-size: var(--text-meta);
     font-weight: 500;
   }
   .z-switch--bar:hover { background: transparent; }
   .z-switch--bar .z-switch__track {
     width: 30px;
     height: 18px;
     background: #ffffff26;
     border-color: #ffffff59;
   }
   .z-switch--bar .z-switch__thumb { width: 12px; height: 12px; background: #ffffffcc; }
   .z-switch--bar.z-switch--on .z-switch__track { background: #ffffff59; border-color: #ffffff; }
   .z-switch--bar.z-switch--on .z-switch__thumb { background: #ffffff; transform: translateX(12px); }
   ```
   (O `translateX(12px)` sai da mesma conta do switch original: trilho 30px, bordas 1px, thumb 12px, folga 2px de cada lado.)
2. `src/renderer/src/ui/components/TransmittingBar.tsx`: props novas `sharpness: boolean` e `onSharpnessChange: (next: boolean) => void`. Inserir o toggle ENTRE o `z-transmitting-bar__spacer` (linha 30) e o botao "Trocar fonte" (linha 31), preservando a ordem metadados-esquerda / acoes-direita do UISPEC:
   ```tsx
   <button
     className={sharpness ? 'z-switch z-switch--bar z-switch--on' : 'z-switch z-switch--bar'}
     role="switch"
     aria-checked={sharpness}
     onClick={() => onSharpnessChange(!sharpness)}
     data-testid="sharpness-toggle"
   >
     <span className="z-switch__track">
       <span className="z-switch__thumb" />
     </span>
     <span className="z-switch__label">
       <span>Nitidez</span>
     </span>
   </button>
   ```
3. `src/renderer/src/ui/screens/RoomScreen.tsx`: estado `const [sharpness, setSharpness] = useState(false)`; efeito que zera quando a transmissao muda: `useEffect(() => { setSharpness(false) }, [localTx?.txId])`; passar para a `TransmittingBar` (linhas 181-187) `sharpness={sharpness}` e `onSharpnessChange={(next) => { setSharpness(next); mediaManager.setSharpnessMode(next) }}` (`mediaManager` ja e importado neste arquivo).

**Edge cases** (categoria: frontend)
- Sem transmissao ativa: a barra inteira nao renderiza, entao o toggle nao existe (RF-16 pede visivel "enquanto a transmissao estiver ativa").
- Transmissao nova depois de uma com nitidez ligada: o efeito por `txId` zera o estado e o backend tambem zera no `startTransmission` - as duas pontas concordam (RF-19).
- Cliques rapidissimos: `setSharpnessMode` e idempotente e nao faz I/O; nao ha estado de "carregando".
- Falha do `setParameters` no backend: log de warn, a UI permanece no estado que o usuario escolheu e o `contentHint` ja mudou (degradacao parcial silenciosa, aceita).
- Fonte com nome longo: o toggle fica depois do `spacer`, entao a elipse do `z-transmitting-bar__source` (max-width 40vw) continua absorvendo o excesso.
- Estado vazio/erro: nao se aplica (nao ha dado assincrono nesta superficie).

**Done when**
- `npm run typecheck`, `npm run lint`, `npx vitest run` verdes.
- Exercicio VISUAL obrigatorio (Playwright `_electron`, `headless: false`, `slowMo: 2000` conforme a regra global do usuario; em modo autonomo vale a excecao de headless registrada na memoria do projeto): abrir o app, criar sala, iniciar transmissao real, tirar screenshot da barra com o toggle DESLIGADO e outro com ele LIGADO, e conferir contra `ui-refs/07-transmitting-bar-closeup.png` que nada mais na barra mudou de posicao ou cor. Anexar os dois caminhos de screenshot no relato.
- Conferir strings: sem acento, sem travessao.

**Commit**: `feat(nitidez): adiciona o toggle de nitidez na barra de transmissao`
**Rollback**: reverter o commit; a barra volta ao estado do UISPEC.

#### Feature F1.2 - Linha "modo compatibilidade" nas Configuracoes `[frontend]`

**Traces**: RF-12, RF-13, RF-14, RF-15, RF-20, RNF-08.

**Consumes contracts** (verbatim das secoes 5.B e 5.C5):
- `window.zoi.settings.set({ forceVp8: boolean }): Promise<AppSettings>` (devolve o objeto completo ja persistido)
- `isForceVp8(): boolean` e `setForceVp8(value: boolean): void` de `../../services/codec-capabilities`

**Steps**
1. `src/renderer/src/ui/screens/room.css`, logo abaixo do bloco `z-switch--bar` da feature F1.1, acrescentar o modificador compacto para caber no lado direito de uma `z-row-between`:
   ```css
   .z-switch--inline {
     width: auto;
     padding: 0;
     border: 0;
     background: transparent;
     gap: 0;
   }
   .z-switch--inline:hover { background: transparent; }
   ```
2. `src/renderer/src/ui/components/SettingsModal.tsx`: estado `const [forceVp8, setForceVp8Draft] = useState(() => isForceVp8())` junto dos demais `useState` (linhas 30-36).
3. Handler:
   ```tsx
   const toggleForceVp8 = (next: boolean): void => {
     setForceVp8Draft(next)
     setForceVp8(next)
     void window.zoi.settings.set({ forceVp8: next }).catch(() => {
       setForceVp8Draft(!next)
       setForceVp8(!next)
       pushToast('warning', 'Nao foi possivel salvar o modo compatibilidade.')
     })
   }
   ```
4. Linha nova no corpo do modal, DEPOIS da linha de "Diagnostico" (apos a linha 213), no mesmo molde `z-row-between` + `marginTop: 'var(--space-3)'` das linhas de volume/versao/diagnostico:
   ```tsx
   <div className="z-row-between" style={{ marginTop: 'var(--space-3)' }}>
     <div>
       <div className="z-secondary" style={{ fontSize: 'var(--text-secondary-size)' }}>
         Modo compatibilidade
       </div>
       <div className="z-secondary" style={{ fontSize: 'var(--text-meta)' }}>
         Transmite e recebe sempre no codec antigo. Ligue so se o video travar ou aparecer preto.
       </div>
     </div>
     <button
       className={forceVp8 ? 'z-switch z-switch--inline z-switch--on' : 'z-switch z-switch--inline'}
       role="switch"
       aria-checked={forceVp8}
       aria-label="Modo compatibilidade"
       onClick={() => toggleForceVp8(!forceVp8)}
       data-testid="settings-force-vp8"
     >
       <span className="z-switch__track">
         <span className="z-switch__thumb" />
       </span>
     </button>
   </div>
   ```
5. Atualizar o `subtitle` do modal (linha 111) para continuar honesto com o conteudo: `"Seu apelido, os sons e a compatibilidade de video."`.

**Edge cases** (categoria: frontend)
- Modal reaberto: o `useState` inicial le `isForceVp8()`, que ja foi alimentado no boot pelo `settings.get()` (RF-15/AC-13).
- Falha do IPC ao salvar: reverte o desenho E o estado do modulo, e avisa por toast (sem estado "meio ligado").
- Clique duplo rapido: cada clique dispara um `set` proprio; o ultimo a chegar ao main vence e o estado local ja refletiu o ultimo clique. Aceitavel (mesma postura do slider de volume).
- Ligar com transmissao ativa: o backend (feature 4.2) rebaixa para VP8 na hora; a UI nao precisa fazer nada.
- Cancelar o modal depois de mexer no toggle: o toggle e commit IMEDIATO (como o volume), nao depende do botao Salvar - o botao Salvar continua sendo so do apelido. Isso e coerente com o padrao ja existente do modal.
- Sem sala aberta: funciona igual; o escape e da maquina, nao da sala.

**Done when**
- `npm run typecheck`, `npm run lint`, `npx vitest run` verdes.
- Exercicio VISUAL + ida e volta real: abrir o app, abrir Configuracoes, ligar o toggle, tirar screenshot, FECHAR o app, reabrir, abrir Configuracoes e conferir que nasce ligado (screenshot 2). Anexar os dois caminhos no relato. Depois desligar.
- Conferir strings: sem acento, sem travessao.

**Commit**: `feat(config): adiciona o escape de modo compatibilidade nas configuracoes`
**Rollback**: reverter o commit; o campo persistido continua existindo e simplesmente nao e mais editavel pela UI.

---

### Sprint T - Testes (DEFINIDO aqui, escrito no sprint de testes)

Comandos: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run test:e2e`.

**T1. `tests/unit/codecs.test.ts` (novo)** - modulo puro `@shared/codecs`:
- `preferVideoCodec`: reordena os PT do codec pedido para a frente preservando a ordem relativa; NAO remove nenhum PT; devolve o SDP original quando nao ha `m=video`, quando o codec nao tem PT, e quando ja esta todo na frente; nao corrompe a secao de audio; sobrevive a entrada lixo (`''`, `'m=video'` sem PT).
- `pickRoomCodec`: exemplo do AC-05 (AV1 local + espectador so H264/VP8 => H264); exemplo do AC-04 (so H264 elegivel => H264); sala sem membros; membro desconhecido tratado como VP8 (AC-06).
- `nextLowerCodec`: AV1 -> H264 quando VP9 nao e elegivel; VP8 -> `null`.
- `normalizeDecodeAnnouncement`: `undefined` -> `['VP8']`; desconhecidos filtrados; duplicados removidos; corte em 8.
- `normalizeForceVp8`: `true`/`'true'`/`undefined`/`1`.

**T2. `tests/unit/protocol.test.ts` (estender)** - AC-24/RNF-06:
- `isQualityUpdatePayload` aceita payload SEM `decodes` (cliente antigo) e COM `decodes` valido; rejeita `decodes` que nao e array de string.
- `isTxStartPayload` aceita sem `videoCodec`, com `videoCodec` string desconhecida (`'H265'`) e rejeita `videoCodec` numerico.
- Nenhum enum fechado mudou: o teste existente de `PresetId` continua igual.

**T3. `tests/unit/room-state.test.ts` (estender)**:
- `QUALITY_UPDATE` com `decodes` grava `decodeCapabilities`; sem `decodes` nao grava.
- `TX_START` com `videoCodec` desconhecido grava `null`.
- **Idempotencia do `TX_START` (T8)**: um segundo `TX_START` do MESMO remetente com o MESMO `txId` e `videoCodec` diferente atualiza `videoCodec`, PRESERVA `startedAt`/`status` e devolve `effects: []` (nem `playSound` nem `showToast`); ja um `TX_START` com `txId` NOVO continua emitindo som e toast; e um `TX_START` com `txId` conhecido vindo de OUTRO peer nao vira atualizacao.
- Poda: membro removido por ROSTER_UPDATE, por saida do dono e por kick some de `decodeCapabilities` (os 3 pontos).
- `applyLocalQuality` inclui `decodes` no broadcast.

**T4. `tests/unit/stats-monitor.test.ts` (estender)** - RNF-07/RF-11/RF-21:
- UM `getStats()` por conexao de saida por tick (contador do fake), no MESMO tick da entrada.
- `OutboundVideoStats` extrai `codec` (via report `codec` + `codecId`), `encoderImplementation`, `qualityLimitationReason`, `framesPerSecond`.
- `InboundVideoStats` ganha `decoderImplementation`/`codec` sem quebrar os casos existentes.
- Conexao de saida que rejeita `getStats` nao derruba o tick.

**T5. `tests/unit/media-manager.test.ts` (estender)** - o coracao:
Regra para este arquivo: cada caso precisa DISCRIMINAR, isto e, falhar se a regra for invertida. Assercao do tipo "e uma funcao" nao serve, porque `chooseRoomCodec` nunca devolve `null` e o transform seria funcao em qualquer implementacao.
- **Caminho VP8 sem munging** (fix da revisao): com `getEncodeCandidates()` retornando `['VP8']` (escape ligado, ou nenhuma sonda de hardware), `session.callPeer` e chamado com o 4o argumento `undefined`. O teste falha se vier funcao.
- **Caminho de hardware com munging**: com candidatos `['AV1','VP8']` e todos os membros anunciando AV1, `session.callPeer` recebe uma FUNCAO, e aplicar essa funcao a um SDP de fixture com PT de VP8/VP9/AV1 devolve uma `m=video` com os PT de AV1 na frente e nenhum PT perdido.
- `answerCall` NAO recebe `sdpTransform` em nenhum cenario (nem com o escape ligado): `call.answer` e chamado sem segundo argumento (T9).
- `startMediaPull`: com `TransmissionState.videoCodec = 'AV1'` passa funcao; com `null` ou `'VP8'` passa `undefined`; com escape local ligado passa `undefined` mesmo que a transmissao seja AV1.
- `answerPull` passa `sdpTransform` com o codec da transmissao local, e `undefined` quando esse codec e VP8.
- Watcher de cpu: alimentar `onOutboundVideoStats` com amostras sinteticas e verificar (a) nada acontece durante o aquecimento; (b) 4 consecutivas rebaixam uma vez; (c) uma amostra nao-cpu no meio zera o streak (AC-10); (d) teto de 2 rebaixamentos; (e) em VP8 nao rebaixa mais (`nextLowerCodec` devolve `null`).
- **Carencia por membro** (com `vi.useFakeTimers()`): (a) membro que entrou ha 1s e nunca anunciou NAO derruba o codec (fica fora da conta); (b) o MESMO membro, passados 6s, derruba a sala para VP8 no tick seguinte; (c) membro que anuncia dentro da carencia entra com a lista real; (d) nunca ha promocao: com o membro fraco removido do roster, o codec permanece VP8.
- **Reanuncio (T8)**: apos um rebaixamento, `session.sendTo` foi chamado para cada membro com um `TX_START` cujo `videoCodec` e o codec NOVO e cujo `txId` e o mesmo.
- **`syncMemberSeen` sem transmissao**: chamar `onOutboundVideoStats(new Map())` (mapa vazio, ninguem transmitindo) com um membro no roster e, 6s depois, iniciar a transmissao: esse membro ja conta como `['VP8']` e o codec nasce VP8. O teste falha se o mapa de "visto pela primeira vez" so for alimentado durante a transmissao.
- **`memberFirstSeenAt` sobrevive ao `stopTransmission`**: parar e recomecar a transmissao NAO devolve o membro antigo para dentro da carencia.
- `setSharpnessMode`: troca `contentHint` e chama `setParameters` com `maintain-resolution`/`maintain-framerate`; `startTransmission` sempre comeca desligado.
- Escape ligado ao vivo com transmissao em AV1 rebaixa para VP8.
- `debugDowngradeCodec()` com a transmissao ja em VP8 nao chama `callPeer` nenhuma vez.

**T5b. `tests/unit/codec-capabilities.test.ts` (novo)** - o blocker que a revisao pegou:
- `ensureDecodeProbe()` com `navigator.mediaCapabilities` falso (stub) popula `getLocalDecodeCodecs()` com a lista real **sem que `ensureEncodeProbe` seja chamado nenhuma vez** (prova de que quem so assiste anuncia direito).
- `getLocalDecodeCodecs()` antes de qualquer sonda devolve `['VP8']`.
- Com o escape ligado, `getLocalDecodeCodecs()` e `getEncodeCandidates()` devolvem `['VP8']` mesmo com a sonda aprovando AV1.
- `ensureDecodeProbe()` chamado duas vezes sonda uma vez so (promessa cacheada).
- `navigator.mediaCapabilities` ausente ou `decodingInfo` que rejeita: `['VP8']`, sem excecao vazando.

**T6. `tests/unit/settings-*.test.ts`**: NAO criar. `src/main/settings.ts` e modulo do MAIN e `tests/unit` e typechecado pelo projeto WEB (sem tipos de node): importar main em teste unitario quebra o typecheck. A cobertura do round-trip de `forceVp8` fica no e2e (T7) e no exercicio manual da feature 1.2.

**T7. e2e (`tests/e2e/`)**:
- Estender `smoke-session.spec.ts` (ou spec novo curto) com: apos a transmissao estabelecida, procurar nas `consoleLines` do transmissor uma linha que case `/\[codec\] envio .*impl=/` e outra no espectador que case `/\[codec\] recepcao /` - prova de AC-12/AC-28 sem depender de hardware especifico.
- `expectNoDirectionFallbacks` continua sendo chamado em TODOS os specs, inalterado (AC-21).
- Spec novo curto de round-trip do escape (AC-13): a engrenagem de Configuracoes SO existe no rodape da sidebar da sala (`RoomScreen.tsx:260-267`), entao o roteiro e: criar sala -> abrir Configuracoes -> ligar `settings-force-vp8` -> fechar a instancia -> reabrir com o MESMO `ZOI_USER_DATA_DIR` -> criar sala de novo (codigo novo, ver `roomCode()` do helper) -> abrir Configuracoes -> conferir `aria-checked="true"`.
- Toggle de nitidez: com transmissao ativa, clicar em `sharpness-toggle` duas vezes e conferir que `transmitting-bar` continua visivel e que nenhum erro de console apareceu (AC-16/AC-17 no que e verificavel por automacao).

**T8. Checklist manual (nao automatizavel - honestidade sobre o que teste local NAO prova, LESSONS 2026-08-26)**:
- Qualidade percebida igual ou melhor na sessao real do grupo (AC-27, metrica de sucesso da secao 1 da PRD).
- Ausencia de regressao de fps por comparacao dos logs `[codec] envio ... fps=` antes/depois, por maquina (AC-20).
- Notebook fraco do grupo: confirmar que o codec negociado tem `impl=` de hardware e que a transmissao parou de travar.
- Bug de driver (R1/AC-19): so aparece se aparecer; o caminho de mitigacao (ligar o escape) precisa ser exercitado uma vez por alguem do grupo.
- Rebaixamento automatico em CPU real (AC-09): a maquina do dev provavelmente nao satura; o gancho `__zoiDebugMedia.downgrade()` prova a MECANICA, mas o gatilho real so se confirma em campo.

---

## 8. Matriz de cobertura da PRD

| Req | Onde e coberto |
|---|---|
| RF-01 | B3/3.1 step 3 (`sdpTransform` na oferta direta, na oferta do pull e na resposta do pull), contrato 5.C1 - com a nota de que a linha 3 da tabela e o que cobre o sentido reverso |
| RF-02 | B2/2.1 (sonda por maquina, `powerEfficient`), T2 desta SPEC (secao 3), B3/3.1 `chooseRoomCodec` |
| RF-03 | B2/2.1 + B3/3.1 (`pickRoomCodec` com AV1 no topo da escada) |
| RF-04 | Secao 3 T2 (so hardware entra na escada; software nunca sobe acima de VP8), B2/2.1 |
| RF-05 | B2/2.2 (anuncio) + B3/3.1 (`chooseRoomCodec` cruza a sala inteira) + B4/4.2 (`reviewRoomCodec`) |
| RF-06 | Helper `memberDecodes(now)` com carencia POR MEMBRO (5.C6, B3/3.1 step 3, B4/4.2): passada a carencia, membro sem anuncio conta como `['VP8']` para sempre, tenha entrado antes ou depois da transmissao |
| RF-07 | B3/3.1 edge cases (par antigo) + `preferVideoCodec` que nunca remove PT; risco R2 |
| RF-08 | B3/3.1 step 4 (`switchSource` = stop+start, recalculo por construcao) |
| RF-09 | B4/4.2 (watcher de cpu + `applyCodecChange` + redial por `callPeer`) |
| RF-10 | B4/4.1 e B4/4.2: prefixo `[codec]`, proibicao das 4 marcas, `grep` no Done when, risco R3 |
| RF-11 | B4/4.1 (log `[codec] envio ...` com codec + `encoderImplementation`; e `[codec] recepcao ...` com `decoderImplementation`) |
| RF-12 | 5.B + B1/1.2 (persistencia) + F1/F1.2 (controle na tela) |
| RF-13 | B2/2.1 (`getEncodeCandidates` devolve `['VP8']` com escape ligado) + B4/4.2 step 6 (rebaixa ao vivo) |
| RF-14 | B2/2.1 (`getLocalDecodeCodecs` -> `['VP8']`, anunciado a cada 3s pelo `QUALITY_UPDATE`) + B4/4.2 (o transmissor rebaixa a sala no tick seguinte ao anuncio). Trade-off T9 registra por que NAO ha munging local no espectador, e o risco R11 registra o transitorio |
| RF-15 | 5.B regra de ida e volta + B1/1.2 Done when + F1/F1.2 Done when + T7 |
| RF-16 | F1/F1.1 (toggle na TransmittingBar) |
| RF-17 | B3/3.2 (`setSharpnessMode` ao vivo: `contentHint` + `degradationPreference`) |
| RF-18 | B3/3.2 (mesmo metodo com `false` restaura `motion`/`maintain-framerate`) |
| RF-19 | B3/3.2 step 5 (zera no `startTransmission`) + F1/F1.1 step 3 (efeito por `txId`); nada persistido |
| RF-20 | Risco R1 + F1/F1.2 (copia da descricao aponta o sintoma) + B4/4.2 (rebaixa ao vivo ao ligar) |
| RF-21 | B4/4.1 (log periodico com `framesPerSecond` e `qualityLimitationReason`, cadencia `CODEC_LOG_EVERY_N_SAMPLES`) |
| RF-22 [WONT] | **Explicitamente NAO implementado.** Guarda desta SPEC: nenhuma feature deste plano contem heuristica de deteccao de bug de driver, e nenhuma reage a tela preta automaticamente. O unico caminho e manual (escape + aviso ja entregue pela `black-screen-notice`), registrado no risco R1 e no checklist manual T8. Se um implementador sentir vontade de "detectar sozinho", a resposta e nao. |
| RNF-01 | B4/4.1 (log de `framesPerSecond` por conexao) + T8 (comparacao antes/depois na sessao real) + secao 3 T2 (nunca adotar software) |
| RNF-02 | B3/3.1 e B4/4.2 Done when exigem `npm run test:e2e` verde; risco R3 e R6; nenhum arquivo de fallback de direcao e alterado |
| RNF-03 | 5.A (campos opcionais, guards abertos) + risco R2 + T2 |
| RNF-04 | Sonda cacheada por preset, decisao so na negociacao e no tick de 3s ja existente; nenhum codigo novo por quadro (declarado em B2/2.1, B3/3.1, B4/4.1) |
| RNF-05 | B4/4.2 (rebaixa em cpu persistente) + B4/4.1 (log de `qualityLimitationReason` prova o estado) |
| RNF-06 | 5.A (campos novos OPCIONAIS em payloads existentes, guards abertos, nenhum enum tocado) + trade-off T6 + T2 do sprint de testes |
| RNF-07 | 5.C3 (laco de saida DENTRO do mesmo `sample()`, sem timer novo) + T4 do sprint de testes |
| RNF-08 | Strings de UI em F1/F1.1 e F1/F1.2, conferidas no Done when de cada uma |
| RNF-09 | `typecheck` + `lint` + `vitest` no Done when de TODA feature; `test:e2e` no Done when de B3/3.1, B4/4.2 e do sprint T |

Sem orfaos: RF-01..RF-22 e RNF-01..RNF-09 mapeados (22 + 9 = 31 requisitos, 31 linhas).

---

## 9. Premissas e questoes em aberto

**[ASSUMPTION A1] Chromium major do Electron 43.4.1.** Nao esta pinado em nenhum arquivo do repo (confirmado). A estimativa externa e a faixa 140+. **Nada nesta SPEC depende do numero**: a disponibilidade de codec e SEMPRE decidida em runtime por `RTCRtpSender.getCapabilities` + `mediaCapabilities`, nunca por versao. Fallback seguro: sem deteccao, VP8. O valor real e registrado no log de boot pela feature 1.2 e deve ser anotado no relato dela.

**[ASSUMPTION A2] Compartilhamento de encoder entre as N conexoes do fanout.** O CONTEXT nao conseguiu verificar se o Chromium reusa UM encoder de video entre senders da mesma track em `RTCPeerConnection` diferentes. Escolha conservadora adotada: codec UNICO para a sala (T3), o que preserva a possibilidade de compartilhamento; e filtro de hardware (T2), que torna o custo por copia pequeno mesmo sem compartilhamento. Rede de seguranca em runtime: o rebaixamento por cpu (RF-09). Verificacao possivel em campo: comparar o `framesPerSecond` do log com 1 espectador e com 4.

**[ASSUMPTION A3] `degradationPreference` alteravel ao vivo por `setParameters`.** A especificacao permite (o campo nao esta na lista de imutaveis do `setParameters`), e `contentHint` e propriedade de track que vale imediatamente. Se em runtime o `setParameters` rejeitar, o comportamento degradado ja esta definido: warn no log, `contentHint` continua valendo, transmissao NAO para. O exercicio da feature 3.2 confirma ou refuta isso na primeira execucao real.

**[OPEN Q1] AV1 vs VP9 como alvo primario nas maquinas reais do grupo (P2 da IDEA).** Esta SPEC decide a REGRA (escada `AV1 > VP9 > H264 > VP8`, so hardware). Qual degrau cada maquina do grupo alcanca de fato so se sabe com os logs `[codec] sonda ...` e `[codec] envio ...` da sessao real. Nao bloqueia a implementacao: a regra funciona qualquer que seja a resposta. O que a sessao real pode mudar depois e a ORDEM entre AV1 e VP9, se AV1 por hardware se mostrar pior em campo (troca de uma linha em `VIDEO_CODEC_PRIORITY`).

**[OPEN Q2] Numeros exatos do watcher de cpu.** `CODEC_CPU_WARMUP_SAMPLES=3`, `CODEC_CPU_PERSISTENT_SAMPLES=4`, `CODEC_MAX_DOWNGRADES=2` e `CODEC_MEMBER_GRACE_MS=6_000` sao calibraveis, no mesmo espirito da assumption A5 dos thresholds de qualidade que ja existem em `config.ts`. Estao definidos com exemplo trabalhado e nao bloqueiam nada; a sessao real do grupo pode pedir ajuste (por isso vivem em `config.ts`, num lugar so).

**[OPEN Q3] Cadencia do log em sessao longa.** `CODEC_LOG_EVERY_N_SAMPLES=5` (15s por conexao) foi escolhido para o log do dia continuar legivel numa sessao de horas com 4 espectadores (cerca de 960 linhas/hora). Se em campo isso incomodar, e uma constante.

Self-check: PASS
