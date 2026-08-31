---
feature: audio-quality
language: pt-BR
code_identifier_language: en - mirrors-existing-codebase
generated: 2026-08-31
stack: Electron 43.4.1 + React 18.3.1 + TypeScript 5.9.3 (electron-vite 5), PeerJS 1.5.5 (WebRTC mesh P2P, sem TURN), Zustand 5, addon nativo C++/N-API `zoi-audio-capture` (WASAPI, so Windows), Vitest (unit) + Playwright `_electron` (e2e)
status: spec
prd_source: PRD_audio-quality.md @ sha256 7beb658aa37460a5f0b5084721f0da3d48975ec147bcf745a8fdbdbda36e8f8b
---

# SPEC - audio-quality

## 1. Baseline (ancora de drift)

- **HEAD**: `8db42a0db817d3e7939415676b4e478fb5f222aa` (branch `fix/audio-quality`)
- Arvore limpa neste HEAD. A PRD registra `0ba16e80bfd00084dd7c73dfd790ed26dc8fa197` como baseline dela; o unico commit entre os dois e `8db42a0 docs(forge): idea, context e prd da audio-quality`, que so acrescenta os proprios artefatos do forge. **Nenhum arquivo de codigo mudou entre a PRD e esta SPEC** (conferido hash a hash na tabela abaixo contra a secao 0 do CONTEXT).

**Documentos de entrada** (sha256, 64 caracteres, a convencao de fingerprint de documento deste projeto):

| Documento | Fingerprint (sha256) |
|---|---|
| `.forge/ideas/audio-quality/PRD_audio-quality.md` | `7beb658aa37460a5f0b5084721f0da3d48975ec147bcf745a8fdbdbda36e8f8b` |
| `.forge/ideas/audio-quality/CONTEXT_audio-quality.md` | `c171a0a55a4535eed9a2d65a4d20d2e7f0ea13aac45e9cb7b97a58143f5c858c` |
| `.forge/ideas/audio-quality/IDEA_audio-quality.md` | `f01c925f7f5ca1c4fa78e34bf819df0520b1e1e04a32c8fb1c68e77a32ea591e` |

Os fingerprints de IDEA e CONTEXT batem EXATAMENTE com os registrados na PRD (secao Baseline) e no CONTEXT (secao 0). **Sem drift de documento.**

**Arquivos de codigo dos quais esta SPEC depende** (`git hash-object`, sha1 de 40 caracteres):

| Arquivo | Fingerprint (sha1) |
|---|---|
| `native/zoi-audio-capture/src/mixer.cc` | `ec8ed03582172db8021cf0bd9bde5462c094a835` |
| `native/zoi-audio-capture/src/mixer.h` | `55323169bf27d49714b5538033c0c3d234d4401b` |
| `native/zoi-audio-capture/src/addon.cc` | `39a6208b230a0866e6f70658922eae8595e52938` |
| `native/zoi-audio-capture/src/capture_engine.cc` | `a0259bd21bbfedc639aa899bbc952384210398bc` |
| `native/zoi-audio-capture/src/capture_engine.h` | `aaf4fdac254658540c58ef6ae618242e9e5b09a9` |
| `native/zoi-audio-capture/src/session_tracker.cc` | `e0b2fc0c439b87ea8ba9e136f561dafca8ca3cab` |
| `native/zoi-audio-capture/src/session_tracker.h` | `8a64a8e759a4c6bdd6038fe798acac491f5971e8` |
| `src/main/audio-exclusion.ts` | `ba55a3ee379552f9d7b74cf7c8e7599185235ea3` |
| `src/main/audio-capture-worker.ts` | `52afdc3ff6670a205862a2b79c5e119703998cbd` |
| `src/main/file-logger.ts` | `ef18c057fc8150f8e4ee06fcd6d94c29b5e5a417` |
| `src/main/index.ts` | `676a22d6b34d48c2062939d77733a2f48b66d531` |
| `src/renderer/src/services/audio-exclusion.ts` | `88e88c82f469e686a19386784af4f5d393cff092` |
| `src/renderer/src/services/stats-monitor.ts` | `455f6d59b409d80c96bd2c0b77ae504fd0371411` |
| `src/renderer/src/services/media-manager.ts` | `9f9744f2056b67cfda154094d73ce42a32e2025e` |
| `src/renderer/src/ui/screens/RoomScreen.tsx` | `4e04bdde9ec9e8d45ebb922d1f03ea8f3c429b84` |
| `src/renderer/src/store/app-store.ts` | `0404c9ec1f5436c6c489a1516fcab3b6e2f39d44` |
| `src/renderer/src/ui/components/Toast.tsx` | `e3bd3a2f9115c97c07a9a4dd7a7fa7e42a93d8c0` |
| `src/shared/ipc.ts` | `e1d4a3e8e6aea5b3c49df780b57257be81faefd7` |
| `src/shared/config.ts` | `aea031edff4fe5430d9189a31f34187ef234aea3` |
| `package.json` | `744dad701f8d670c8b333e1b4731eeda8d194fb7` |
| `tests/e2e/helpers/zoi-app.ts` | `3bee4f82eaa5f5e9c9ea5d451e822b433126c363` |
| `scripts/audio-probe.mjs` | `7ec40440a723e0ee7b165403f6d9bea276cf9ff7` |
| `.forge/LESSONS.md` | `da5b5446fb33231b08ac09c64e8d1b2450547dc9` |

Mudanca em qualquer um destes arquivos invalida (ou exige reconferir) esta SPEC. `tests/e2e/helpers/zoi-app.ts` e `.forge/LESSONS.md` nao constavam da secao 0 do CONTEXT e foram acrescentados aqui; todos os demais batem hash a hash com o CONTEXT.

---
## 2. Visao geral do desenho

**Convencao de identificadores (obrigatoria para todos os agentes de implementacao)**: identificadores de codigo em INGLES, espelhando o repositorio (CONTEXT secao 6, `code_identifier_language: mirrors-existing-codebase (en)`). camelCase para funcoes/variaveis (`createThrottledCounter`, `writeFrame`, `applyFadeIn`), PascalCase para tipos e classes de TS e C++ (`ThrottledCounter`, `InboundAudioStats`, `MixerHealth`, `SessionScanner`), SCREAMING_SNAKE_CASE para constantes de configuracao (`AUDIO_LOG_WINDOW_MS`, `AUDIO_FADE_MS`), `kCamelCase` para constantes de arquivo em C++ (`kFadeMs`, `kHealthReportIntervalMs`, `kMaxScannedEndpoints`, o padrao ja usado em `capture_engine.cc:16-20`), kebab-case para arquivos novos de TS (`log-throttle.ts`, `audio-copy.ts`). **Prosa, comentarios, textos de log e strings de toast em pt-BR SEM acento e SEM travessao** (RNF-08).

**Prefixos de log desta feature** (obrigatorios, ver risco R6): `[audio]` (estado de captura por transmissao, renderer), `[audio-drop]` (descarte de frame no renderer), `[audio-stats]` (campos de audio do WebRTC), `[audio-native]` (linhas cuja origem e o motor C++, escritas pelo main) e `[audio-exclusion]` (ciclo de vida da sessao no main, prefixo que **ja existe** em `src/main/audio-exclusion.ts:59-62`, `:151`, `:197`, `:226`, `:236`).

### 2.1 A invariante que organiza tudo

Esta feature e um `fix` com quatro entregaveis (PRD secao 3), e os quatro se apoiam numa unica invariante nova:

> **Nada no caminho de audio pode acontecer sem deixar rastro, e nenhum rastro pode custar mais do que o evento que ele descreve.**

Dela saem as tres consequencias que valem para cada decisao abaixo:

1. **Todo ponto de descarte silencioso vira um contador COM JANELA.** Nunca uma linha por frame. O teto de 5 MB/dia do `file-logger.ts` (`MAX_FILE_BYTES`, `src/main/file-logger.ts:16`) nao e um limite de audio: quando ele estoura, `capped` (`:26`, checado em `:88`) silencia o log do APP INTEIRO pelo resto do dia. Um `console.warn` por frame a 100 frames/s estouraria esse teto em segundos. Por isso o rate-limit e MANDATORIO e nasce como um modulo proprio (`src/shared/log-throttle.ts`), porque nao existe helper reutilizavel hoje (CONTEXT secao 7).
2. **Os dois cliques comprovados sao o MESMO defeito em dois lugares**: uma forma de onda que salta entre sinal real e silencio sem rampa. No mixer nativo isso acontece DENTRO de um frame (a cauda de `mixed` que nunca e somada, `mixer.cc:155` mais `:160-165`); no renderer acontece ENTRE dois frames (o `writtenFrames` que cola o pedaco seguinte no anterior, `audio-exclusion.ts:96` e `:99`). A correcao e uma so, aplicada nos dois lugares: **uma rampa linear de 1 ms sempre que o sinal entra ou sai do silencio**, mais, no renderer, um relogio que ANDA sobre o buraco em vez de fingir que ele nao existiu.
3. **O que o sistema nao consegue ver nao vira aviso, vira transparencia.** O motor nativo hoje SABE quem esta capturando e quem foi recusado, e joga fora (`capture_engine.cc:519` chega ao `statusSink_`, mas `src/main/audio-exclusion.ts:161-166` descarta tudo que nao e `failed`). Isso e conserto de encanamento, nao de deteccao. Ja o modo exclusivo do WASAPI nao e verificado em lugar nenhum do codigo e continua assim: RF-23 manda entregar transparencia mais orientacao documentada, e nao um aviso que o sistema nao tem informacao para disparar.

### 2.2 Nao ha SPIKE nesta feature, e isso e uma decisao

A `viewer-cursors` e a `app-audio-capture` comecaram por sonda porque dependiam de uma capacidade de plataforma NUNCA executada (LESSONS 2026-08-25). Aqui nao e o caso: **todas as premissas de plataforma desta SPEC ja foram executadas em campo** pela `app-audio-capture` (Process Loopback ativa, o `MessagePort` entrega PCM, o `MediaStreamTrackGenerator` aceita `AudioData`). As decisoes que restam sao de LEITURA DE CODIGO (onde a forma de onda salta, onde o log morre) e nao de execucao, e a IDEA/PRD ja proibem chutar causa sem evidencia. A unica capacidade de plataforma que esta SPEC usa e que ainda nao foi executada neste projeto e `IMMDeviceEnumerator::EnumAudioEndpoints` (feature C3): ela **nao vira sonda** porque o desenho ja embute o proprio degrau de seguranca (se a enumeracao devolver zero dispositivos ou falhar, o codigo cai no `GetDefaultAudioEndpoint(eRender, eConsole)` de hoje, que e exatamente o comportamento atual) e porque a verificacao executavel dela ja existe pronta: `npm run audio:probe`.

### 2.3 As oito pecas

1. **`src/shared/log-throttle.ts` (NOVO, modulo PURO)** - `createThrottledCounter(windowMs)`. Conta ocorrencias e devolve um resumo no maximo uma vez por janela. Usado no renderer (descarte de frame, stats de audio) e disponivel para o main. Contrato 5.C1.
2. **Identidade de sessao de captura (`captureId`)** - o main passa a carimbar cada sessao de exclusao com um id proprio, devolvido no `AudioExclusionStartResult` e presente em toda linha de log do main e do renderer que fale do caminho `excluded`. O renderer, que e quem conhece o `txId`, escreve UMA linha de ponte ligando os dois. E isso que fecha RF-08 sem levar o `txId` para dentro do processo main. Contrato 5.A2.
3. **Estados novos no canal de status nativo -> main -> renderer** - `active` (composicao, ja emitido e hoje descartado), `health` (contadores de underrun e de descarte), `skipped` (sessoes vistas e nao capturadas, com motivo) e `app-skipped` (uma unica sessao recusada por motivo AVISAVEL). Contrato 5.A1.
4. **Rampa de 1 ms no mixer nativo (`mixer.cc`)** - fade-out na cauda de uma fonte que sofreu underrun e fade-in na retomada, por fonte, antes da soma. Nao muda a garantia de um frame por tique. Trade-off T2.
5. **Relogio honesto mais fade-in no renderer (`audio-exclusion.ts`)** - o `writtenFrames` passa a avancar sobre os frames descartados, e o primeiro frame escrito depois de um descarte entra com rampa. Trade-off T3.
6. **Separacao por `kind` mais campos de audio no `stats-monitor.ts`** - dentro do MESMO `stats.forEach` que ja existe (RNF-06), com o agregado de qualidade preservado por SOMA para nao mexer no `QUALITY_UPDATE`. Trade-off T4.
7. **Enumeracao de sessoes em TODOS os endpoints de render ativos (`session_tracker.cc`)** - superconjunto estrito do que e enumerado hoje, com degrau de seguranca para o comportamento atual. Trade-off T5.
8. **Redacao, tom e persistencia do aviso de inicio ja existente** - `src/renderer/src/ui/screens/RoomScreen.tsx:211-216`, sem nenhum toast novo para o mesmo cenario, mais um terceiro ramo no aviso de RUNTIME ja existente para o cenario DIFERENTE de RF-19. Trade-off T6.

### 2.4 Fluxo do caminho instrumentado (exemplo concreto)

Leo transmite no Windows 11 com audio, o jogo `game.exe` esta aberto e o Discord tambem.

```
MAIN (src/main/audio-exclusion.ts)
  startAudioExclusion() -> captureId = 'ax-<base36 do Date.now()>'
     -> logToFile info  '[audio-exclusion] sessao ax-m1k2 iniciada em process-exclusion'
     -> devolve { mode: 'process-exclusion', sampleRate, channels, captureId: 'ax-m1k2' }

RENDERER (media-manager.ts, logo apos resolver audioMode)
     -> console.info '[audio] transmissao 9f3c... captura=process-exclusion sessao=ax-m1k2'
        (o file-logger espelha via attachRendererLogging; e a PONTE txId <-> captureId)

NATIVO (capture_engine.cc, Reconcile)
  ve as sessoes de TODOS os endpoints de render ativos
     -> game.exe entra; discord.exe cai em IsForbidden; steam.exe cai por subarvore
     -> Report('active', 'capturas=1 endpoints=2 4812:game.exe')
     -> ReportRaw('skipped', 'vistas=3 6640:discord.exe=arvore-proibida 3120:steam.exe=subarvore-proibida')
     -> ReportRaw('app-skipped', 'steam.exe')            (so os motivos AVISAVEIS)
  a cada 15 s, se houver o que contar:
     -> ReportRaw('health', 'underruns=12 quadros=430 descartes-tsfn=0')

MAIN (worker.on('message'))
     -> logToFile info  '[audio-native] ax-m1k2 active (1 mudancas em 0 ms): capturas=1 endpoints=2 4812:game.exe'
     -> logToFile info  '[audio-native] ax-m1k2 skipped (1 mudancas em 0 ms): vistas=3 6640:discord.exe=...'
     -> logToFile warn  '[audio-native] ax-m1k2 health: underruns=12 quadros=430 mudos=0 descartes-tsfn=0'
     -> sendStatus({ state: 'app-not-captured', app: 'steam.exe', detail: 'steam.exe', captureId })
        (esta PRIMEIRA emissao quase sempre cai no vazio: o renderer ainda nao assinou, 3/T10)

NATIVO, ate 60 s apos o motor subir, a cada 10 s enquanto a recusa PERSISTIR (3/T10)
     -> ReportRaw('app-skipped', 'steam.exe') de novo -> main emite sendStatus de novo

RENDERER (RoomScreen.tsx, o MESMO useEffect de runtime de :113-131, terceiro ramo)
     -> ja assinado (o startTransmission resolveu), recebe a reemissao
     -> pushToast('warning', 'O som do steam.exe nao esta indo na transmissao...')  UMA vez por transmissao

RENDERER (audio-exclusion.ts writeFrame), quando o writer aplica backpressure
     -> pendingSkippedFrames += 480; needsFadeIn = true
     -> na proxima escrita: timestamp pula o buraco e o frame entra com rampa de 1 ms
     -> console.warn '[audio-drop] ax-m1k2 backpressure: 1000 quadros em 10000 ms'  (janela de 10 s)

RENDERER (stats-monitor.ts), so quando ha concealment ou perda de audio
     -> console.warn '[audio-stats] tx 9f3c... delta conceal=3 amostras=1440 descartados=0 perdidos=2 jitter=0.021'
        (os quatro campos apos `delta` sao DIFERENCAS desde o tique anterior; o jitter e absoluto)
```

### 2.5 Mecanismos deliberadamente NAO tocados

- **SDP e parametros do Opus**: `src/shared/codecs.ts` continua mexendo so em `m=video`; nenhum `maxaveragebitrate`, `stereo`, `useinbandfec` ou `dtx` e configurado. A PRD nao pede e RNF-02 desaconselha (ver T7).
- **Identidade da track de audio**: o `MediaStreamTrackGenerator` continua sendo criado UMA vez por sessao (`audio-exclusion.ts:142-143`); zero `replaceTrack`, zero renegociacao, zero redial. E o que mantem `expectNoDirectionFallbacks` fora de risco (RNF-02).
- **Pipeline de video inteiro**: presets, codecs, `applySenderParameters`, `chooseRoomCodec`, o rebaixamento por CPU. Nada disso e lido nem escrito por esta feature (RNF-04).
- **Cascata de degradacao do main** (`escalate`, `src/main/audio-exclusion.ts:190-219`): os degraus, a ordem e as condicoes ficam identicos. So o TEXTO das linhas de log ganha o `captureId`.
- **`app-sounds-volume`**: nenhum arquivo dessa feature e tocado (RNF-03).
- **Os dois gatilhos do aviso de RUNTIME** (`degraded-full-loopback` e `failed`, `RoomScreen.tsx:119-129`): texto e condicao permanecem LETRA POR LETRA como hoje (RF-16/AC-15). O que entra e um TERCEIRO ramo, para um cenario diferente.
- **`getDisplayMedia({ audio: true })` do estado C**: e pipeline do Chromium, fora do controle do app. Esta feature so o TORNA VISIVEL no log; nao tenta consertar nada dentro dele.

---

## 2b. Mapa de ciclo de vida das entidades

Esta feature **nao cria entidade de dominio nenhuma** (IDEA secao 6 e PRD secao 2, ambas `N/A`): nao ha campo novo em `AppSettings`, nao ha chave nova em `settings.json`, nao ha mensagem nova no protocolo do mesh, nao ha nada replicado entre pares. As linhas "Persistir" abaixo dizem `N/A` com o motivo. O que existe de verdade sao TRES ciclos de vida, todos de MEMORIA e todos escopados a uma sessao de captura ou a uma transmissao.

### 2b.1 `captureId` (identidade da sessao de captura, ESCOPO DE PROCESSO MAIN)

| Etapa | Onde | Como |
|---|---|---|
| Criar | `startAudioExclusion()` (`src/main/audio-exclusion.ts:221`), no MESMO ponto em que `spawnWorker('process-exclusion', 0)` tem sucesso (`:240-243`) | `ax-${Date.now().toString(36)}`. Um id por SESSAO de exclusao, nao por worker: a cascata re-forka o worker e o `captureId` continua o mesmo, que e exatamente o que permite ligar o degrau A->B a mesma transmissao |
| Ler (main) | `sendStatus` (`:58-64`), `escalate` (`:190-219`) e o handler `worker.on('message')` (`:157-170`) | Toda linha de `logToFile` do caminho de audio passa a cita-lo |
| Ler (renderer) | `AudioExclusionStartResult.captureId` e `AudioExclusionStatus.captureId` | O cliente de `audio-exclusion.ts` guarda no closure do `start()`; o `media-manager` escreve a linha-ponte com `txId` mais `captureId` |
| Atualizar | **Nunca.** E imutavel dentro da sessao | Um `captureId` novo so nasce num `startAudioExclusion()` novo |
| Destruir | `stopAudioExclusion()` (`:251-263`), que ja zera `session` | Nada a limpar alem do proprio objeto de sessao |
| Persistir | **N/A por decisao** | E um id de diagnostico valido enquanto o log daquele dia existir. O arquivo de log ja carrega data e timestamp ISO; guardar o id em disco nao acrescentaria nada |

### 2b.2 Contador com janela (`ThrottledCounter`, ESCOPO DE MEMORIA)

| Etapa | Onde | Como |
|---|---|---|
| Criar | uma instancia por PONTO instrumentado: `writeFrame` do renderer (uma por sessao, no closure do `start()`); `stats-monitor` (uma por `txId`, num `Map`) | `createThrottledCounter(AUDIO_LOG_WINDOW_MS)` |
| Atualizar | `record(now)` a cada ocorrencia | Devolve `{ count, sinceMs }` no maximo uma vez por janela; `null` no resto |
| Destruir (renderer) | `dispose()` do cliente (`audio-exclusion.ts:119-124`) | Morre com o closure; um `flush(now)` opcional NAO e usado (ver T1, "por que nao ha flush no fim") |
| Destruir (stats) | inicio de cada `sample()`, podando as chaves que nao estao mais em `inboundEntries()` | Sem poda, um `txId` que acabou deixaria a entrada viva pelo resto da sessao |
| Persistir | **N/A** | Contador de janela; o VALOR ja e persistido, em texto, na propria linha de log que ele libera |

### 2b.3 Dedupe de aviso por aplicativo (`warnedApps_` no C++ e `alreadyWarned` no React)

| Etapa | Onde | Como |
|---|---|---|
| Criar (nativo) | `Engine::warnedApps_`, criado com o motor | `std::unordered_set<uint64_t>`, chave `(pid * 256) + reasonCode` |
| Criar (renderer) | `alreadyWarned` (`RoomScreen.tsx:115`), JA EXISTE | `Set<string>` recriado a cada remontagem do efeito, ou seja a cada troca de `txId` |
| Atualizar | nativo: `insert` antes de emitir `app-skipped`; renderer: `add(status.state)` antes do `if` (`:117-118`), comportamento ja existente | Dupla rede: o C++ nao repete o aviso do MESMO pid pelo MESMO motivo, e o React nao repete o toast do mesmo `state` na mesma transmissao |
| Destruir | nativo: com o `Engine` (`Stop()`); renderer: com a remontagem do efeito | Um re-fork da cascata zera `warnedApps_`, o que e desejado: motor novo, diagnostico novo |
| Persistir | **N/A** | Estado de sessao. Guardar faria o aviso sumir para sempre depois da primeira vez |

### 2b.4 O que NAO tem ciclo de vida nesta feature

| Candidato | Por que N/A |
|---|---|
| Entidade de dominio nova | Nenhuma. Fix de qualidade de midia (IDEA secao 6, PRD secao 2) |
| Campo novo em `AppSettings` / `settings.json` | Nenhum. Nao ha preferencia de usuario nesta feature; o rate-limit e constante de codigo (5b) |
| Mensagem nova no protocolo do mesh (`src/shared/protocol.ts`) | Nenhuma. Nada desta feature viaja entre pares; `PROTOCOL_VERSION` fica em `1` e o arquivo nao e tocado (secao 5) |
| Papel/permissao de sala | Nenhuma. Dono e membro comum tem exatamente as mesmas capacidades aqui (PRD secao 2, nota) |
| Estado novo em `RoomState` | Nenhum. Nem os contadores nem o `captureId` entram no reducer: sao diagnostico, nao estado de sala |

---
## 3. Trade-offs e alternativas rejeitadas

**T1. Rate-limit: contador com JANELA num modulo puro compartilhado, nao amostragem nem log por evento (PRD RF-07, RNF-01, RNF-05; CONTEXT secao 7).**

Escolhido: `src/shared/log-throttle.ts` (NOVO, puro, sem DOM, sem Electron, importavel por `tests/unit`) exportando `createThrottledCounter(windowMs)`. A semantica e **contar sempre, escrever no maximo uma linha por janela, e a linha carrega o TOTAL acumulado desde a linha anterior**. A primeira ocorrencia sai NA HORA (com `count: 1`), porque "isto aconteceu pelo menos uma vez" e a informacao mais valiosa e a que hoje nao existe.

*Numeros, porque RNF-01 exige que isso seja verificavel e nao opinado.* Com `AUDIO_LOG_WINDOW_MS = 10_000`, o pior caso e uma sessao de 4 horas (14 400 s) com TODOS os pontos disparando o tempo todo e com 2 transmissoes recebidas simultaneas. Este e o inventario COMPLETO dos pontos que escrevem, sem omitir nenhum:

| Ponto | Onde | Cadencia maxima | Linhas em 4 h |
|---|---|---|---|
| `[audio-drop]` (backpressure) | renderer, B2.2 | 1 por janela de 10 s | 1 440 |
| `[audio-stats]` (concealment) | renderer, B2.3, POR `txId` | 1 por janela por `txId`, 2 `txId` | 2 880 |
| `[audio-native] ... active` | main, B2.1 (`activeLog`) | 1 por janela de 10 s | 1 440 |
| `[audio-native] ... skipped` | main, B2.1 (`skippedLog`) | 1 por janela de 10 s | 1 440 |
| `[audio-native] ... health` | nativo, C1.2 (`kHealthReportIntervalMs`) | 1 a cada 15 s | 960 |
| `[audio-native] ... app-skipped` | nativo, C1.2 (reemissao de 3/T10) | ate 6 por aplicativo, so nos primeiros 60 s | ~12 |
| `[audio]` (estado da transmissao) | renderer, B2.2 | 1 por transmissao | ~10 |
| **Total** | | | **8 182** |

A **140 bytes por linha** (o timestamp ISO mais o nivel ja custam ~30 caracteres, e a maior das formas literais de 5.A3 fica em torno de 110), isso da **cerca de 1,15 MB**, contra o teto de 5 MB (`MAX_FILE_BYTES`, `file-logger.ts:16`). Para comparacao, o log inteiro da sessao real de fim de semana pesou 442 KB (IDEA secao 7), entao o pior caso desta feature somado ao trafego normal do app fica em torno de 1,6 MB. **Sobram mais de 3 MB de folga**, e a flag `capped` nunca vira verdadeira por causa desta feature (AC-06). Note que este e um pior caso deliberadamente irreal: ele supoe descarte, concealment, mudanca de composicao e mudanca de recusa acontecendo SEM PARAR por quatro horas seguidas.

*Por que nao ha `flush` no fim da sessao.* O contador expoe `flush(now)` no contrato porque ele e trivial e testavel, mas **nenhum ponto de producao desta SPEC o chama**. O motivo e honesto: chamar `flush` no `dispose()` do renderer significaria escrever no console DEPOIS de o usuario parar a transmissao, num instante em que a janela pode estar sendo desmontada; o ganho (o rabo de ate 10 s de contagem) nao paga o risco de log fora de ciclo de vida. A consequencia declarada e que a ULTIMA janela parcial de contagem se perde. Isso e aceitavel porque a linha anterior ja provou que o fenomeno estava acontecendo, que e o que o diagnostico precisa.

Rejeitado: **amostragem ("logar 1 a cada N")**. Perde a MAGNITUDE, que e justamente o que separa "um descarte isolado" de "uma enxurrada de descartes", a distincao central para diagnosticar o estalo relatado (IDEA secao 7: "as vezes esparso, as vezes varios por minuto").
Rejeitado: **log so na MUDANCA de estado (de zero para nao-zero e vice-versa)**. Nao produz linha nenhuma durante um estouro sustentado, que e exatamente a janela de tempo que o diagnostico quer olhar.
Rejeitado: **usar o `POINTER_LOG_INTERVAL_MS` da `viewer-cursors`**. E outro dominio e outra frequencia; reusar a constante amarraria as duas features num numero so, e mexer numa quebraria a outra em silencio.
Rejeitado: **mexer no `file-logger.ts` para ele proprio throttlar**. O `file-logger` e infraestrutura compartilhada de TODO o app; embutir politica de audio la contaminaria o log de ICE, de sessao e de codec, que hoje funcionam bem sem throttle.

**T2. Mixer nativo: rampa linear de 1 ms por FONTE, aplicada antes da soma (PRD RF-09, RF-11).**

Escolhido: em `Mixer::Run` (`mixer.cc:144-178`), cada fonte passa a carregar DOIS pedacos de estado paralelos a `sources_`: um bit (`sourceSilenced_`) e o ULTIMO quadro entregue (`lastFrame_`, um valor por canal). A cada tique, depois de `AudioRingBuffer::Read` (`mixer.cc:160`), ha **tres** transicoes a tratar, nao duas:
- **fade-in** - `frames > 0` e a fonte estava silenciada no tique anterior: os primeiros `min(frames, fadeFrames_)` quadros de `scratch` recebem uma rampa de 0 para 1;
- **fade-out DENTRO do frame** - `0 < frames < framesPerTick_` (underrun parcial, a cauda de `mixed` vai ficar no zero do `std::fill` de `:155`): os ULTIMOS `min(frames, fadeFrames_)` quadros de `scratch` recebem uma rampa de 1 para 0;
- **cauda de decaimento no primeiro tique MUDO** - `frames == 0` e a fonte NAO estava silenciada no tique anterior: `scratch` recebe, nos primeiros `fadeFrames_` quadros, uma rampa que desce de `lastFrame_[canal]` ate 0, e essa cauda entra no mix normalmente.

E depois, sempre: `sourceSilenced_[i] = (frames < framesPerTick_)`, e, quando `frames > 0`, `lastFrame_[i]` guarda o ultimo quadro lido.

`fadeFrames_ = format_.sampleRate * kFadeMs / 1000`, com `kFadeMs = 1`, o que da **48 quadros a 48 kHz**.

*Por que a terceira transicao existe, e por que ela nao e "inventar audio" (W4).* Um anel que esvazia EXATAMENTE na fronteira do tique entrega `framesPerTick_` quadros cheios no tique N e ZERO no tique N+1. Sem a cauda, o resultado e amplitude total seguida de silencio absoluto, sem rampa nenhuma: e a MESMA classe de clique que esta feature existe para corrigir, so que na fronteira mais provavel de todas. A cauda nao repete conteudo nem extrapola forma de onda (foi por isso que "hold" e "repetir o ultimo pedaco" foram rejeitados abaixo): ela e uma reta de 1 ms que sai do ultimo valor real e chega a zero, exatamente o que o fade-out teria produzido se o codigo soubesse, no tique N, que aquele era o ultimo. O custo e guardar 2 floats por fonte por tique e 96 multiplicacoes no tique da transicao.

*A limitacao que fica, declarada com honestidade.* Quando uma captura e REMOVIDA da composicao (`PublishSources` apos um `Reconcile` que fechou um `CaptureStream`), o ponteiro do anel some do vetor e nao ha tique nenhum em que a cauda possa ser emitida: a fonte desaparece em amplitude total. **Esta SPEC nao trata esse caso.** A justificativa e de frequencia: mudanca de composicao acontece algumas vezes por sessao (quando um app abre ou fecha uma sessao de audio), enquanto underrun e drenagem de anel acontecem por tique. Tratar isso exigiria manter o anel vivo por mais um tique depois de removido, o que troca um clique raro por um ciclo de vida de ponteiro bem mais perigoso. Fica registrado aqui e no risco R4, no mesmo espirito da limitacao declarada em 3/T3.

*Exemplo trabalhado (o que a implementacao tem de reproduzir), com os tres casos.*
- **Underrun parcial.** Tique com `framesPerTick_ = 480` e `Read` devolvendo `frames = 300`. `fade = min(300, 48) = 48`; `start = frames - fade = 252`. Para `i` de 0 a 47, `gain = (fade - 1 - i) / (fade - 1)`, aplicado aos DOIS canais do quadro `start + i`. Ou seja `gain(i=0) = 1.0` no quadro 252 e `gain(i=47) = 0.0` no quadro 299. O quadro 299 sai EXATAMENTE zero, encostando sem degrau no zero que `:155` ja deixou em `mixed[600..959]`. Contadores: `underrunTicks_ += 1` e `underrunFrames_ += 480 - 300 = 180`.
- **Retomada.** No tique seguinte, se a fonte voltar com 480 quadros, `gain = i / (fade - 1)` nos quadros 0 a 47, subindo de 0.0 para 1.0. Nenhum contador e tocado (leitura cheia).
- **Drenagem exata.** Tique N devolve `frames = 480` (cheio, nenhuma rampa, `lastFrame_` guarda o quadro 479). Tique N+1 devolve `frames = 0` e a fonte NAO estava silenciada: `scratch` recebe, nos quadros 0 a 47, `lastFrame_[canal] * (fade - 1 - i) / (fade - 1)`, ou seja o valor real do quadro 479 no quadro 0 e zero no quadro 47, e o resto de `scratch` fica zerado. Contadores: `silentTicks_ += 1` se NENHUMA fonte entregou quadro nesse tique; `underrunTicks_` e `underrunFrames_` **nao sao tocados** (ver a nota de contabilidade abaixo).

*Nota de contabilidade dos contadores (o que separa underrun de silencio normal).* Uma fonte que devolve ZERO quadros e, na esmagadora maioria das vezes, um aplicativo que simplesmente **nao esta tocando nada** - a `CaptureStream` do WASAPI entrega buffers marcados como silenciosos enquanto o stream esta vivo (`ConvertAndStore(data, frames, silent)`, `capture_engine.h:56`), mas entre um fechamento de sessao e a proxima abertura o anel fica vazio por muitos tiques seguidos. Contar isso como underrun faria o relatorio `health` disparar a cada 15 s para sempre, em toda maquina saudavel, o oposto do que RF-01 quer. Portanto: **`underrunTicks_` e `underrunFrames_` contam SOMENTE leituras parciais (`0 < frames < framesPerTick_`)**, que sao o unico caso em que audio real foi perdido, e `silentTicks_` conta separadamente os tiques totalmente mudos, como CONTEXTO. O gatilho do relatorio `health` olha so para underruns reais e para descartes da fila (5.C6): silencio, sozinho, nunca gera linha.

*Por que 1 ms.* E o menor tempo que remove o degrau de forma audivelmente completa (uma rampa de 1 ms corta a energia do transiente muito abaixo do limiar de percepcao) e ainda assim e **um decimo** do proprio frame de 10 ms, entao nunca chega a soar como um corte de volume. Custo: 96 multiplicacoes float por borda, num tique que ja copia 960 floats.

*Por que a rampa vai em `scratch` e nunca em `mixed`.* `mixed` e a SOMA de todas as fontes. Uma fonte que sofre underrun enquanto outra continua tocando nao pode arrastar a outra para o silencio: se a rampa fosse aplicada em `mixed`, o audio do navegador seria atenuado por causa de um engasgo do jogo. Aplicando em `scratch`, cada fonte entra e sai do mix com a propria rampa, e o mix continua correto.

*RF-11 sai por CONSTRUCAO*: a rampa so multiplica `scratch` ANTES do laco de soma; `Mixer::Run` continua chamando `sink_(mixed.data(), sampleCount, timestampUs)` uma vez por tique, com `sampleCount` fixo, no `emittedFrames` de sempre (`:169-176`). Nao ha caminho novo que possa pular uma emissao.

Rejeitado: **repetir a ultima amostra (hold) ou repetir o ultimo pedaco (packet loss concealment caseiro)**. Produz zumbido metalico e, pior, inventa audio que nunca existiu. O projeto ja escolheu, no `mixer.h:23-27`, que atraso e pior que estalo; inventar sinal e pior que os dois.
Rejeitado: **buscar mais amostras (esperar o anel encher)**. Isso e exatamente acumular atraso, o que `mixer.h:25-26` proibe por escrito ("descola o labio do video").
Rejeitado: **rampa de 5 ms ou 10 ms**. Meio frame de fade seria audivel como um "fwup" de volume a cada engasgo, trocando um clique por um artefato pior e mais longo.
Rejeitado: **corrigir so o fade-out**. A retomada (silencio para sinal) e a MESMA descontinuidade na direcao oposta, e acontece exatamente uma vez para cada underrun. Corrigir so metade deixaria metade dos cliques.

**T3. Renderer: o relogio ANDA sobre o buraco, e o frame de retomada entra com rampa (PRD RF-10).**

Escolhido: em `writeFrame` (`audio-exclusion.ts:82-103`), duas variaveis novas no closure do `start()`, ao lado de `writtenFrames` (`:60`):
- `pendingSkippedFrames` - soma dos `numberOfFrames` dos frames que o `desiredSize <= 0` (`:89`) descartou desde a ultima escrita;
- `needsFadeIn` - comeca `true` (o primeiro frame da track tambem nasce de um silencio) e volta a `true` a cada descarte.

Na proxima escrita bem-sucedida, ANTES de montar o `AudioData`: `writtenFrames += pendingSkippedFrames; pendingSkippedFrames = 0`, e, se `needsFadeIn`, uma rampa de 0 para 1 sobre os primeiros `min(numberOfFrames, fadeFrames)` quadros da vista `Float32Array` do proprio `data`.

*O avanco tem TETO, e o teto e parte do contrato (W2).* `pendingSkippedFrames` e acumulado com clamp: `pendingSkippedFrames = Math.min(pendingSkippedFrames + numberOfFrames, maxSkipFrames)`, com `maxSkipFrames` derivado de `AUDIO_MAX_SKIP_MS = 200` (9 600 quadros a 48 kHz). Sem o teto, uma rajada de 1 000 descartes seguidos - que e o proprio pior caso usado em 3/T1 e no teste T6 - produziria um salto de timestamp de **10 segundos** para frente numa unica escrita, e a justificativa da premissa A2 ("o salto e da mesma ordem de grandeza do jitter que a track ja sofre") deixaria de valer. Acima de 200 ms de buraco a leitura muda de natureza: nao e mais um engasgo a ser declarado com honestidade, e um pipeline que parou, e um salto de varios segundos e mais arriscado para o consumidor do que a compressao que o codigo faz hoje. **Comportamento acima do teto, declarado**: o relogio avanca 200 ms e o resto do buraco e absorvido (a linha do tempo comprime, como hoje). A magnitude REAL nunca se perde: a linha `[audio-drop]` carrega a contagem verdadeira de quadros descartados, independente do teto.

*Exemplo trabalhado com numeros reais.* Quatro mensagens de 480 quadros; a terceira e descartada por backpressure.

| Mensagem | `writtenFrames` antes | `timestamp` HOJE | `timestamp` DEPOIS |
|---|---|---|---|
| 1 | 0 | 0 us | 0 us (com fade-in de entrada) |
| 2 | 480 | 10 000 us | 10 000 us |
| 3 (DESCARTADA) | 960 | (nao escreve) | (nao escreve; `pendingSkippedFrames = 480`) |
| 4 | 960 | **20 000 us** | **30 000 us** (com fade-in) |

Hoje a mensagem 4 e rotulada 20 000 us: o consumidor recebe dois pedacos de forma de onda que NAO sao contiguos no tempo real, emendados sem nenhuma marca. Isso e o "colar" que RF-10 nomeia, e e uma descontinuidade de amplitude arbitraria. Depois da correcao, o rotulo e 30 000 us: existe um buraco DECLARADO de 10 ms, o consumidor sabe que ele existe, e a retomada sobe do zero por rampa.

*A honestidade que falta e vai declarada.* Nao ha como aplicar fade-OUT na borda que ANTECEDE um descarte sem bufferizar um frame inteiro (10 ms) de lookahead, e adicionar 10 ms de latencia fixa ao caminho de audio contraria a decisao ja tomada em `mixer.h:25-26` e a nota `[OPEN]` da SPEC da `app-audio-capture` sobre latencia A/V. **Esta SPEC nao tenta.** O que fica: a borda de saida continua abrupta na entrada do buraco, a borda de entrada deixa de ser. Isso reduz o defeito pela metade num ponto e o elimina no outro (o mixer, T2), e e exatamente o escopo que RF-12/A3 delimitam: se o campo mostrar que sobrou clique, vira follow-up com dado em maos.

Rejeitado: **manter o relogio colado (comportamento de hoje)**. E a causa nomeada por RF-10.
Rejeitado: **escrever um frame de silencio no lugar do descartado**. Anularia o proposito do descarte, que e nao acumular atraso: escrever silencio ocupa exatamente a mesma vaga na fila do `WritableStream` que estava cheia.
Rejeitado: **deixar de descartar e simplesmente `await writer.write(...)`**. Faria o `onmessage` do `MessagePort` empilhar frames no thread principal do renderer, que e o pior lugar possivel (CONTEXT secao 7: o `writeFrame` de 10 ms ja divide esse thread com o tick de stats, o cursor hub e o React).
Rejeitado: **contar o buraco pelo `timestampUs` que o worker manda** (`AudioExclusionPcmMessage.timestampUs`). O comentario de `audio-exclusion.ts:55-59` e a licao de LESSONS 2026-08-25 dizem por que: o worker REINICIA esse relogio a cada re-fork da cascata, e usa-lo faria a linha do tempo andar para tras. O relogio proprio por contagem de amostras continua sendo a fonte da verdade; ele so passa a contar tambem o que foi pulado.

**T4. `stats-monitor.ts`: acumuladores separados por `kind` com o agregado preservado por SOMA (PRD RF-02, RF-03, RNF-06, RNF-03).**

Escolhido: dentro do MESMO `stats.forEach` que ja existe (`stats-monitor.ts:153-173`), os tres acumuladores de `:156-158` passam a ser dois conjuntos (`video` e `audio`) da mesma forma `{ bytes, packetsLost, packetsReceived }`, escolhidos por `entry.kind`. O que alimenta `onReport` e `inboundBitrateKbps` (`:207-228`) passa a ser a **SOMA dos dois**, que e numericamente identica ao que o codigo produz hoje.

*Por que a soma, e nao trocar o insumo do relatorio de qualidade.* `onReport` alimenta `LOCAL_QUALITY` e o broadcast de `QUALITY_UPDATE` (o callback comeca em `session.ts:305`), que e comportamento validado em campo. Trocar o insumo para "so video" mudaria a classificacao good/medium/bad de todo mundo, o que e regressao de produto disfarcada de refatoracao. RF-03 pede que os ACUMULADORES parem de misturar, e e isso que acontece; o relatorio agregado continua agregado, agora por uma soma explicita e visivel em vez de por acidente.

Escolhido para RF-02: um irmao `InboundAudioStats` ao lado de `InboundVideoStats` (`:68-75`) e um irmao `RtpAudioStatsEntry` ao lado de `RtpVideoStatsEntry` (`:48-57`), com um callback novo OPCIONAL `onInboundAudioStats?`. **As interfaces de video existentes nao sao renomeadas**: `InboundVideoStats` e `RtpVideoStatsEntry` sao consumidas por `session.ts:227`, `:303`, `:358-363`, `room-store.ts:84` e por 12 casos de `tests/unit/stats-monitor.test.ts`; renomear seria churn puro sem nenhum requisito pedindo. O comentario de ponto de extensao (`:59-67`) e ATUALIZADO para registrar que o irmao de audio nasceu aqui, no mesmo laco, e que continua proibido abrir coletor paralelo.

Escolhido para o LOG: o `stats-monitor` escreve `[audio-stats]` **so quando ha algo a contar** - delta de `concealmentEvents`, de `packetsDiscarded` ou de `packetsLost` de audio maior que zero - e ainda assim passando pelo `ThrottledCounter` por `txId`. Uma sessao com audio saudavel nao gera NENHUMA linha de stats, que e o comportamento certo: log de diagnostico existe para o dia ruim.
Rejeitado: **logar todo tick de 3 s**. 4 horas dariam 4800 linhas de ruido por transmissao, para nada.
Rejeitado: **um coletor separado so de audio**. Proibido explicitamente pelo comentario do proprio arquivo (`:59-67`) e por RNF-06/AC-25.

**T5. Enumeracao de sessoes: TODOS os endpoints de render ATIVOS, com degrau de seguranca para o comportamento de hoje (PRD RF-18, RF-20, RF-21; IDEA 11b).**

Escolhido: `SessionScanner::Reopen()` (`session_tracker.cc:234-260`) troca o `GetDefaultAudioEndpoint(eRender, eConsole, &device_)` unico (`:244`) por `EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE, ...)`, ativando um `IAudioSessionManager2` por dispositivo e registrando o `SessionNotifier` em cada um. `ListSessionPids` (`:277-310`) passa a UNIR os PIDs de todos eles no mesmo `std::unordered_set<DWORD> seen` que ja existe (`:289`).

*Por que isso e a resposta certa para RF-18, e por que ela nao espera dado de campo.* Das tres causas estruturais candidatas do jogo mudo (PRD RF-17), duas sao "a sessao vive num endpoint que a enumeracao nao olha": a variante de ROLE (`eMultimedia`/`eCommunications` apontando para outro lugar) e a variante de DISPOSITIVO (roteamento por aplicativo do Windows 11, CONTEXT 4.D pergunta 2). Enumerar todos os endpoints ativos fecha as DUAS de uma vez, e fecha por CONSTRUCAO em vez de por deteccao. E o resultado e um **superconjunto estrito**: tudo que era visto continua sendo visto, entao nao existe caminho pelo qual isso capture MENOS do que hoje (RNF-03).
*Por que nao e "reescrever a arquitetura" (fora de escopo da PRD secao 3)*: o addon, o mixer, a composicao por include e a regra de ancora continuam identicos. O que muda e de ONDE vem a lista de PIDs candidatos. A IDEA secao 11b autoriza exatamente isso, com estas palavras.

*RF-21 continua valendo por CONSTRUCAO.* A ancora continua sendo o PID que `ListSessionPids` devolveu, ou seja o processo que EFETIVAMENTE abriu a sessao de audio; os passos 1, 2 e 3 de `Engine::Reconcile` (`capture_engine.cc:448-477`) nao mudam uma linha, e `IsForbidden`/`SubtreeContainsAny` continuam filtrando qualquer PID novo exatamente como filtram os de hoje. Um endpoint a mais nunca vira ancora, e um ancestral nunca vira ancora.

*O degrau de seguranca, que e o que substitui uma sonda (2.2).* Se `EnumAudioEndpoints` falhar ou devolver zero dispositivos, `Reopen()` cai no `GetDefaultAudioEndpoint(eRender, eConsole)` de hoje. Se ISSO tambem falhar, devolve o HRESULT, e `RunControlThread` (`capture_engine.cc:397-402`) reporta `failed` exatamente como hoje. Ou seja: o pior caso desta mudanca e o comportamento atual.
*Ordem e teto.* O dispositivo padrao de `eConsole` e colocado no INDICE 0 da lista, e a lista e truncada em `kMaxScannedEndpoints = 8`. Sem isso, uma maquina com muitos dispositivos virtuais (cabo de audio, HDMI de cada monitor, placa de captura) poderia truncar justamente o dispositivo que funciona hoje. Com isso, o dispositivo de hoje e o unico que NUNCA pode ser cortado.
*Custo, medido em ordem de grandeza.* `Reconcile` roda a 1 Hz (`kReconcileIntervalMs = 1000`). Cada endpoint custa um `GetSessionEnumerator` mais um `GetCount` mais, por sessao, um `IsSystemSoundsSession`, um `GetState` e um `GetProcessId`. Com 4 endpoints e 15 sessoes cada, sao ~200 chamadas COM por segundo numa thread de controle dedicada, em MTA, que hoje ja faz um `ProcessSnapshot::Refresh` (Toolhelp32, varredura da tabela de processos inteira) no mesmo tique. A varredura de processos e, de longe, a parte cara; os endpoints extras somam pouco a ela.

Rejeitado: **so as tres ROLES do endpoint padrao (`eConsole`, `eMultimedia`, `eCommunications`)**. Fecha a variante de role e deixa a de dispositivo aberta, com praticamente o mesmo codigo e a mesma necessidade de dedup. Meio conserto pelo preco do conserto inteiro.
Rejeitado: **esperar o dado de campo antes de mexer** (a leitura literal do ramo condicional de RF-18). Seria defensavel, mas custa uma rodada inteira de campo com um amigo para entregar algo que ja e um superconjunto seguro, com degrau de fallback, e que a IDEA autoriza por escrito. Pelo criterio de desempate UX-first da PRD (secao 1), entregar o superconjunto agora e melhor: se a causa era essa, o jogo volta a sair na proxima sessao; se nao era, o log de RF-22 mostra qual e, e nada regrediu.
Rejeitado: **detectar modo exclusivo do WASAPI**. Nao ha, no codigo lido, nenhuma consulta de modo de compartilhamento de uma sessao de terceiro, e `IAudioSessionControl2` nao expoe isso. Continua sendo a causa estruturalmente invisivel de RF-23: transparencia mais nota documentada, nunca aviso automatico.

**T6. Vazamento Win10: o aviso de INICIO muda de TEXTO, de TOM e de DURACAO, e continua sendo UM SO (PRD RF-13, RF-14, RF-15, RF-16).**

O aviso ja dispara corretamente no caso relatado (CONTEXT 4.E passo 7): Windows 10 nunca atinge `MIN_WINDOWS_BUILD` (`src/main/audio-exclusion.ts:36`), `startAudioExclusion` devolve `unavailable('os-unsupported')` (`:231`), o `audioMode` resolve para `'full-loopback'` (`media-manager.ts:532`) e o toast de `RoomScreen.tsx:211-216` aparece. O defeito nao e de gatilho, e de EFICACIA. Tres mudancas, todas sobre o MESMO ponto de aviso:

1. **Texto (RF-13).** O texto de hoje - "Nao foi possivel isolar o audio do Discord; a transmissao segue com o som do sistema inteiro." - descreve a CAUSA e nunca a CONSEQUENCIA. Quem le entende "o Discord ficou de fora" quando o que aconteceu e o oposto. O texto novo nomeia o que vaza, com o Discord como exemplo concreto e nao como sujeito: **"Atencao: esta transmissao esta enviando o som do sistema INTEIRO. Tudo que tocar no seu PC vai junto, inclusive a sua conversa no Discord."** As strings finais vivem em `AUDIO_CAPTURE_COPY` (5.C3) e sao verificadas mecanicamente por teste unitario (T5 do Sprint T), no molde de `tests/unit/waiting-overlay-copy.test.ts`.
2. **Tom (RF-15).** De `'warning'` para `'danger'`. `ToastTone` (`room-state.ts:132`) ja tem os quatro tons e `'danger'` ja e usado em `RoomScreen.tsx:230` e `:232`; nao ha infraestrutura nova. Vazar a propria conversa para a sala inteira e, em consequencia, mais grave do que "a fonte nao pode ser capturada".
3. **Duracao (RF-15).** `TOAST_TTL_MS` e 4 000 ms (`app-store.ts:17`) para TODO toast. `ToastItem` (`:10-14`) ganha `ttlMs?: number` e `pushToast` ganha um terceiro parametro OPCIONAL; `ToastRow` (`Toast.tsx:9-12`) le `toast.ttlMs ?? TOAST_TTL_MS`. Este aviso passa a usar `TOAST_TTL_LONG_MS = 12_000`. Quatro segundos e o tempo de um aviso de status; doze e o tempo de LER duas frases enquanto se comeca a transmitir.

*Por que nada alem disso, apesar de RF-15 ser `[SHOULD]`.* A tentacao obvia e um marcador PERMANENTE na `TransmittingBar`, que seria mais eficaz que qualquer toast. **AC-13 proibe**: "existe exatamente um ponto de aviso de inicio ajustado, sem nenhum segundo toast/aviso paralelo criado para o mesmo cenario". Um marcador persistente e um segundo aviso. Se o campo mostrar que o toast de 12 s com tom `danger` ainda passa despercebido, AC-14 ja declara que isso vira follow-up de saliencia e nao falha desta entrega.
*RF-16 fica intocado e isso e verificavel.* Os dois ramos de `RoomScreen.tsx:119-129` (`degraded-full-loopback` e `failed`) mantem TEXTO, TOM e CONDICAO identicos aos de hoje. O que entra e um TERCEIRO ramo, para `'app-not-captured'`, que e outro cenario (um aplicativo especifico fora da captura) e nao uma segunda versao do aviso de sistema-inteiro.

**T7. Nenhuma mudanca em SDP, Opus ou parametros de sender de audio (PRD RF-12, RNF-02, RNF-04).**

Escolhido: **nao tocar**. A negociacao de audio continua 100% default do Chromium; `preferVideoCodec` (`src/shared/codecs.ts`) continua parando na proxima `m=` depois de `m=video`; `applySenderParameters` continua so no video.
Justificativa: a PRD nao pede (RF-12 `[WONT]` exclui explicitamente "parametros do codec Opus" do escopo), e qualquer mudanca de SDP em transmissao ja no ar exige renegociacao, que e o vetor de risco nomeado por RNF-02 (`expectNoDirectionFallbacks`) e pelo CONTEXT secao 7. O que esta feature entrega no lugar e VISIBILIDADE: com os campos de `inbound-rtp` de audio (T4) no log, a proxima sessao de campo dira se o Opus esta em regime de concealment agressivo, e ai a discussao sobre parametros comeca com dado em vez de palpite.
Rejeitado: **ligar `useinbandfec` ou subir `maxaveragebitrate` "ja que estamos aqui"**. E o tipo de mudanca que parece gratuita e reabre negociacao para 5 pares.

**T8. Os estados novos do canal de status: quatro nomes, tres so de log, um so de aviso (PRD RF-01, RF-06, RF-19, RF-22).**

Escolhido: o canal nativo -> worker -> main (`AudioWorkerEvent`, `audio-capture-worker.ts:20-21`, `state: string` livre) ganha `health`, `skipped` e `app-skipped`, alem do `active` que **ja existe e ja e emitido** (`capture_engine.cc:410` e `:519`) e hoje morre no `return` de `src/main/audio-exclusion.ts:165`. O main LOGA os quatro e ENCAMINHA ao renderer apenas `app-skipped`, convertido no estado tipado `'app-not-captured'` de `AudioExclusionStatus`.
*Por que `app-skipped` e uma mensagem separada de `skipped`, em vez de o main parsear a lista.* `skipped` carrega a lista INTEIRA de sessoes vistas e nao capturadas, para o log (RF-22); `app-skipped` carrega UM basename de executavel e nada mais, para o aviso (RF-19). Fazer o main extrair o nome de dentro da string de diagnostico seria parsing fragil de texto livre entre dois processos, o tipo de acoplamento que quebra em silencio quando alguem muda um separador.
*Por que NEM TODO motivo vira aviso.* Os motivos possiveis sao tres: `arvore-proibida` (o PID ou um ancestral bate em `IsForbidden`), `subarvore-proibida` (`SubtreeContainsAny`) e `falha-ativacao` (`StartProcessInclude` devolveu `FAILED`). O primeiro e o Discord e o proprio Zoi, ou seja **o comportamento pretendido da feature `app-audio-capture`**: avisar "o som do discord.exe nao esta indo na transmissao" seria alarmar o usuario com o funcionamento correto do produto, varias vezes por sessao. Os outros dois sao genuinamente surpreendentes e sao os que viram `app-skipped`. Os TRES vao para o log (RF-22/AC-31); so DOIS viram toast (RF-19/AC-18).
*Rate-limit dos tres, no proprio C++.* `active` ja e emitido so quando `changed` (`capture_engine.cc:517`); `skipped` so quando a ASSINATURA do conjunto de recusas muda (`lastSkippedSignature_`); `app-skipped` so uma vez por par (pid, motivo) (`warnedApps_`); `health` no maximo a cada `kHealthReportIntervalMs = 15000`, e so quando algum contador e diferente de zero. Nenhum deles pode virar enxurrada, o que importa porque a fila da `ThreadSafeFunction` de status tem apenas 16 posicoes (`addon.cc:290`).
Rejeitado: **um canal novo nativo -> main so para diagnostico**. O canal de status ja existe, ja e assincrono, ja e nao bloqueante e ja tem consumidor no main. Um segundo canal seria maquinaria nova para o mesmo trabalho.
Rejeitado: **`printf`/`OutputDebugString` no C++**. Nao chega ao arquivo de log do usuario, que e o unico lugar que importa para diagnostico de campo (LESSONS 2026-08-25).

**T9. `captureId` gerado no MAIN, ponte para o `txId` escrita no RENDERER (PRD RF-08, RF-04, RF-05).**

Escolhido: o main nao conhece `txId` e nao vai conhecer (o `txId` nasce em `media-manager.ts:526`, dentro do renderer, DEPOIS de a exclusao ja ter subido em `:470`). Em vez de plumbar o `txId` para dentro do processo main - o que exigiria um IPC novo e inverteria a ordem de inicializacao -, o main gera um id proprio de sessao de captura e o devolve no resultado do `start`. O renderer, que tem os dois, escreve UMA linha ligando-os.
*Consequencia declarada:* para cruzar uma linha `[audio-native]` com uma transmissao, quem le o log precisa de DUAS linhas (a linha-ponte e a linha do evento). E uma junta trivial de fazer com o olho, e evita um IPC novo e uma inversao de ordem de inicializacao para uma feature de diagnostico.
*RF-05 sai quase de graca:* `sendStatus` (`src/main/audio-exclusion.ts:58-64`) JA chama `logToFile` para todo estado, inclusive `degraded-full-loopback` vindo de `escalate` (`:213`). A transicao A->B ja aparece no log hoje. O que esta feature acrescenta e o `captureId` nessa mesma linha, que e o que a torna correlacionavel (AC-04). **Nada e removido nem enfraquecido**, como RF-05 exige.
Rejeitado: **IPC novo do renderer para o main levando o `txId`**. Canal novo, ordem de inicializacao invertida (a exclusao sobe ANTES de existir `txId`) e superficie de contrato nova, tudo para economizar uma junta de log.
Rejeitado: **usar o PID do utilityProcess como id**. Muda a cada re-fork da cascata, que e exatamente o momento em que a correlacao mais importa.

**T10. O aviso de RF-19 e REEMITIDO pelo motor nativo durante os primeiros 60 s, porque o assinante nasce depois do evento (PRD RF-19, AC-18).**

*O problema, verificado no codigo e nao suposto.* O motor nativo roda o PRIMEIRO `Reconcile` imediatamente depois do fork (`capture_engine.cc:405-406`, antes do `Report("active", "")` de `:410`), ou seja milissegundos depois de `startAudioExclusion` devolver. O UNICO assinante de `onStatus` no renderer e o `useEffect` de `RoomScreen.tsx:113-116`, e ele so existe quando `localTx?.audioMode === 'excluded'` (`:112`), o que so acontece depois de `startTransmission` resolver: entre o `await this.audioExclusion.start()` de `media-manager.ts:470` e o `this.local = transmission` de `:541` ainda acontecem o `selectSource`, o `getDisplayMedia` (`:487`) e o setup da track. Enquanto isso, `getWindow?.()?.webContents.send` (`src/main/audio-exclusion.ts:63`) entrega a mensagem a um renderer que **nao tem nenhum `ipcRenderer.on` registrado** para esse canal (o `on` mora DENTRO de `onStatus`, `src/preload/index.ts:65`) e ela e simplesmente descartada. Como `warnedApps_` marca o par (pid, motivo) para sempre, o `app-skipped` nunca mais e emitido. **Resultado do desenho anterior: no cenario relatado - o jogo ja aberto quando a transmissao comeca - o toast de RF-19 nunca apareceria.** O caso simetrico (aplicativo aberto DEPOIS, RF-20) funcionaria, o que tornava a falha ainda mais dificil de perceber.

*Escolhido: reemissao limitada no proprio C++.* `warnedApps_` deixa de ser um `set` de "ja avisei" e vira um `map` de chave para o tique da ultima emissao. Um `app-skipped` e emitido quando a chave e nova OU quando as tres condicoes valem juntas: a recusa AINDA persiste nesta volta do `Reconcile`, o motor tem menos de `kAppSkippedReplayWindowMs` (60 000 ms) de vida, e passaram-se pelo menos `kAppSkippedReplayMs` (10 000 ms) desde a ultima emissao daquela chave. Passados os 60 s, o comportamento volta a ser o de emitir uma unica vez por par (pid, motivo), como estava desenhado.

*Por que esta e a escolha certa entre as tres possiveis.*
- **Rejeitado: cache no main com replay no momento da assinatura.** E a solucao classica de assinante tardio, mas o main **nao tem como saber** que o renderer assinou: `onStatus` e um `ipcRenderer.on` puro, sem nenhuma ida ao main. Implementar exigiria um canal de IPC NOVO so para dizer "estou ouvindo", quebrando a declaracao de "nenhum canal novo" da secao 5 e acrescentando superficie de contrato a uma feature de diagnostico.
- **Rejeitado: carregar a lista inicial de recusas no resultado do `start()`.** `startAudioExclusion` devolve assim que o `spawnWorker` tem sucesso (`:240-243`), ANTES de o motor ter rodado o primeiro `Reconcile`. Nao ha nada para carregar naquele instante, e esperar o primeiro relatorio para responder colocaria uma espera de rede nativa no caminho critico de iniciar transmissao.
- **Rejeitado: um `setTimeout` no main reemitindo apos N ms.** Precisa adivinhar quanto tempo o `getDisplayMedia` vai demorar. Numa maquina lenta, ou com o usuario demorando no dialogo de fonte, o palpite erra e o defeito volta em silencio, que e o pior tipo de correcao.
- A reemissao no C++ nao adivinha nada: ela **continua anunciando enquanto a condicao for verdadeira**, e para sozinha. E o unico dos tres que nao depende de o receptor existir num instante especifico.

*Custo, e por que ele e desprezivel.* Recusas por motivo AVISAVEL sao raras (nao incluem o Discord nem o proprio Zoi, 3/T8). No pior caso, uma recusa que persista os 60 s inteiros gera 6 linhas de log e 6 `sendStatus` por aplicativo, uma unica vez por sessao de captura. Ja esta contabilizado na tabela de 3/T1 (~12 linhas).
*O toast continua sendo UM so.* O `alreadyWarned` de `RoomScreen.tsx:115-118` dedupica por `status.state`, entao as reemissoes que chegarem depois da primeira aceita nao geram toast nenhum.
*Borda coberta: a recusa acontece e NAO existe interface de transmissao nenhuma.* Se o usuario cancelar o seletor de fonte (`exclusion?.stop()`, `media-manager.ts:497`) ou a janela for destruida, `getWindow?.()?.webContents.send` ja e um no-op em toda a cadeia e nao ha transmissao sobre a qual avisar. **O log de RF-22 nao depende disso em momento nenhum**: `skipped` e escrito pelo main assim que chega, sem passar por assinante, e continua incondicional.

**T11. Onde a copy dos toasts mora: um modulo PURO, importavel pelo Vitest (PRD RNF-08, AC-27).**

Escolhido: `src/renderer/src/ui/screens/audio-copy.ts` (NOVO), sem NENHUM import, exportando `AUDIO_CAPTURE_COPY`. `RoomScreen.tsx` importa e usa; `tests/unit/audio-copy.test.ts` importa so ele.
Justificativa: o precedente do projeto e `WAITING_COPY`, exportado do proprio componente e testado em `tests/unit/waiting-overlay-copy.test.ts` (que documenta, no cabecalho, que o Vitest roda em ambiente node e nada ali RENDERIZA). Isso funciona para `WaitingOverlay`, que e pequeno; importar `RoomScreen.tsx` num teste node arrastaria a tela inteira e as dependencias dela. Um modulo de strings sem import nenhum tem custo zero e risco zero.
Rejeitado: **testar a copy por `grep` no `.tsx`**. Nao pega homoglifo nem prova que a string usada e a testada (LESSONS 2026-08-27: um caractere cirilico identico ao `a` latino passou horas despercebido; a defesa aceita e checagem mecanica sobre o VALOR, e o teste de ASCII imprimivel faz exatamente isso).

---

## 4. Riscos

| # | O que pode dar errado | Mitigacao |
|---|---|---|
| R1 | **A instrumentacao vira a fonte do problema** (RNF-05/AC-24): um log no caminho de 10 ms atrasa o `writeFrame` e AUMENTA o proprio numero de descartes que ele existe para medir. | O caminho quente ganha exatamente uma comparacao de inteiro por frame (`pendingSkippedFrames > 0`) e uma chamada de `record()` que, fora da janela, e uma soma e uma comparacao. Nenhuma formatacao de string acontece quando `record()` devolve `null`: a template string so e montada DENTRO do `if (summary)`. Verificacao: T6 do Sprint T conta as chamadas de `console.warn` num cenario de 1 000 descartes e exige no maximo 2; e AC-24 compara os contadores antes/depois no mesmo cenario local. |
| R2 | **O log novo estoura o teto de 5 MB e silencia o app inteiro** (`capped`, `file-logger.ts:26` e `:88`), levando junto ICE, sessao e codec. | Rate-limit obrigatorio em TODO ponto (T1), com o pior caso calculado ponto a ponto numa tabela de 7 linhas: **8 182 linhas, cerca de 1,15 MB em 4 horas**, contra o teto de 5 MB. Regra dura desta SPEC: **nenhuma chamada de `console.*` ou `logToFile` desta feature pode existir fora de um `ThrottledCounter`, de um gatilho de MUDANCA de estado, ou de um evento que acontece no maximo uma vez por transmissao.** Verificacao mecanica no Done when de cada feature de instrumentacao. |
| R3 | **Uma linha de log nova quebra os 7 specs e2e**: `expectNoDirectionFallbacks` (`tests/e2e/helpers/zoi-app.ts:591-601`) varre `consoleLines` procurando `media-pull`, `dialback`, `discando de volta` e `na outra direcao` (`:50`), em minusculas, e derruba o teste em qualquer ocorrencia. | Regra dura: as linhas novas usam so os prefixos de 2 e e PROIBIDO conter qualquer uma das quatro marcas. Verificacao mecanica no Done when de cada feature: `grep -niE "media-pull\|dialback\|discando de volta\|na outra direcao"` nos arquivos tocados, esperando zero ocorrencias novas. |
| R4 | **A rampa do mixer atenua audio bom**: aplicada no lugar errado (em `mixed` em vez de `scratch`), um engasgo de UMA fonte abaixaria o volume de TODAS. | 3/T2 fixa, com a palavra `scratch` em tres lugares, que a rampa e por fonte e acontece ANTES do laco de soma de `mixer.cc:162-164`; o codigo nunca toca `mixed` fora do `Clamp` que ja existe. A garantia principal e portanto ESTRUTURAL, e nao de teste. **O probe nao cobre isto**: `scripts/audio-probe.mjs` sobe um unico emissor de sinal por cenario (W5), entao a verificacao com DUAS fontes simultaneas e um item de escuta do checklist manual (T8), declarado como tal em vez de prometido em automacao. |
| R5 | **O relogio que avanca produz um buraco que o consumidor trata pior que a emenda** (o `MediaStreamTrackGenerator` pode reagir a um salto de timestamp de forma diferente da esperada). | O salto e sempre um MULTIPLO exato do frame de 10 ms e sempre para FRENTE (nunca para tras, que e o modo de falha que LESSONS 2026-08-25 registra como quebrando a track). E e da MESMA ordem de grandeza que o jitter que a track ja sofre hoje. Verificacao: T6 do Sprint T prova os timestamps exatos da tabela de 3/T3; a percepcao real fica no checklist manual e no campo (AC-09, declarado CAMPO na propria PRD). |
| R6 | **A enumeracao de todos os endpoints alarga a captura para algo que o usuario nao esperava** (um player tocando num dispositivo virtual entra no mix). | Os filtros nao mudam: `IsForbidden` e `SubtreeContainsAny` (`capture_engine.cc:452` e `:475`) valem para qualquer PID, venha de qual endpoint vier, entao Discord e o proprio Zoi continuam impossiveis por construcao. O que entra a mais e audio de aplicativo do proprio usuario, que e exatamente o que a feature captura hoje no endpoint padrao. A composicao efetiva passa a ser VISIVEL no log (RF-06), entao um alargamento inesperado deixa de ser silencioso. A limitacao e o comportamento novo vao nas notas da release. |
| R7 | **`EnumAudioEndpoints` devolve zero dispositivos, ou o `Activate` de `IAudioSessionManager2` falha em algum deles**, e a captura para de funcionar numa maquina onde funcionava. | Degrau de seguranca literal em 3/T5: falha ou lista vazia cai no `GetDefaultAudioEndpoint(eRender, eConsole)` de hoje; um `Activate` que falha em UM dispositivo so pula aquele dispositivo (`continue`), nunca derruba os outros. O pior caso e o comportamento atual. Verificacao executavel: `npm run audio:probe`, que ja coleta `statuses` do motor (`scripts/audio-probe.mjs:717`, `:738-739`). |
| R8 | **Toast de RF-19 vira spam** numa maquina com muitos processos recusados. | Dupla rede (2b.3): o C++ so emite `app-skipped` uma vez por par (pid, motivo) por motor, e o `alreadyWarned` do `RoomScreen` (`:115-118`, ja existente) so deixa UM toast por `state` por transmissao. **Consequencia declarada e aceita**: se dois aplicativos diferentes forem recusados na mesma transmissao, so o primeiro aparece no toast; os dois aparecem no log (RF-22). |
| R9 | **`arvore-proibida` vira aviso e o usuario le "o som do Discord nao esta indo" como defeito**, quando e a feature funcionando. | 3/T8 fixa: `arvore-proibida` NUNCA vira `app-skipped`. Guarda explicita para o agente de implementacao: se der vontade de "avisar tudo para ser transparente", a resposta e nao; a transparencia desse motivo mora no LOG, nao na tela. |
| R10 | **Alterar `pushToast` quebra as ~20 chamadas existentes.** | O parametro novo e o TERCEIRO e e OPCIONAL (`ttlMs?: number`), e `ToastItem.ttlMs` tambem e opcional; nenhuma chamada existente muda e `ToastRow` cai no `?? TOAST_TTL_MS`. Verificacao: `npm run typecheck` mais os testes existentes que tocam toast. |
| R11 | **O rebuild nativo nao acontece** e o agente valida C++ contra o binario VELHO, concluindo que a correcao "nao fez nada" (ou pior, que funcionou). | Todo Done when de feature nativa exige, nesta ordem: `npm rebuild zoi-audio-capture --foreground-scripts` (a entrada `"zoi-audio-capture@0.1.0": true` ja existe em `allowScripts` do `package.json` raiz; sem ela o npm 11 PULA o rebuild em silencio, fato registrado na SPEC da `app-audio-capture`), conferir que `native/zoi-audio-capture/build/Release/zoi_audio_capture.node` teve o mtime atualizado, e so entao `npm run audio:probe`. |
| R12 | **A instrumentacao de stats mascara uma regressao no relatorio de qualidade** ao trocar o insumo de `onReport`. | 3/T4 mantem o agregado por SOMA explicita dos dois `kind`, numericamente identico ao de hoje. Verificacao: os 12 casos existentes de `tests/unit/stats-monitor.test.ts` **nao podem ser alterados nem quebrar**; e o Sprint T acrescenta um caso que alimenta um `inbound-rtp` de audio e um de video e exige que `onReport` receba exatamente o mesmo `packetLoss` de antes. |
| R13 | **Regressao de `app-audio-capture` no caminho quente** (RNF-03): a rampa ou o contador introduz um erro que so aparece com audio real, que nenhum teste automatizado deste projeto reproduz. | Reconhecido e enderecado com honestidade (LESSONS 2026-08-26): o que e testavel em TS entra no Sprint T; o resto vai para o checklist manual com passos concretos (`npm run audio:probe` mais uma transmissao real de 10 minutos, que e justamente o item **2.2 do `CHECKLIST_MANUAL_app-audio-capture.md` que nunca foi marcado**). RNF-07/AC-26 ja preveem essa divisao. |
| R14 | **Ampliar a enumeracao (C1.3) faz um aplicativo ENTRAR no mix sem que o transmissor perceba.** O app so avisa quando algo sai da captura (RF-19), nunca quando algo entra. | Declarado, nao mitigado: **nao existe sinal na interface para "entrou audio novo"**, e esta feature nao cria um (seria um aviso a cada abertura de sessao de audio, ou seja ruido constante). A entrada e visivel em DOIS lugares: a linha `[audio-native] ... active`, que lista `pid:exe` de tudo que esta sendo capturado (RF-06), e a nota de release do passo 8 de F1.1, que diz com todas as letras que a captura passou a enxergar sessoes em todos os dispositivos de saida ativos. As arvores proibidas (Discord e o proprio Zoi) continuam impossiveis por construcao, entao o pior caso e audio de um aplicativo do proprio usuario, que e a categoria que a feature ja captura hoje. |

---
## 5. Contratos

Este app **nao tem backend HTTP**: nao existe rota REST, nao existe controller, nao existe `fetch` para servidor proprio. A superficie de contrato equivalente e de tres tipos: **(A) o canal de STATUS que vai do motor nativo ao renderer**, **(B) o IPC entre main e renderer** e **(C) as assinaturas internas** que um sprint produz e outro consome.

> **Declaracao explicita sobre o protocolo do mesh:** esta feature **NAO toca em `src/shared/protocol.ts`**. Nenhum `MessageType` novo, nenhum campo novo em payload existente, `PROTOCOL_VERSION` continua `1`, nada desta feature viaja entre pares. Diagnostico de audio e local a maquina que o gera. Consequencia direta: nao ha questao de compatibilidade com cliente antigo nesta feature, e o arquivo do protocolo nao aparece em nenhum passo de nenhum sprint.
>
> **Declaracao explicita sobre canais de IPC:** **nenhum canal novo**. Os tres canais de audio que ja existem (`IPC.audioExclusionStart`, `IPC.audioExclusionStop`, `IPC.audioExclusionStatus`, mais a entrega de `MessagePort` por `IPC.audioExclusionPort`) continuam sendo os unicos. O que muda sao os TIPOS que trafegam por dois deles (5.A2), de forma aditiva.

### 5.A O canal de status: nativo -> worker -> main -> renderer

#### A1. Estados emitidos pelo motor nativo (`capture_engine.cc`)

O canal e `Engine::statusSink_` -> `addon.cc:314-324` (`statusCallback.NonBlockingCall`, fila de 16, `addon.cc:290`) -> `audio-capture-worker.ts:74-76` (`emit({ type: 'status', state, detail })`) -> `worker.on('message')` em `src/main/audio-exclusion.ts:157-170`. O tipo `AudioWorkerEvent` (`audio-capture-worker.ts:20-21`) ja declara `state: string` livre e **nao muda**.

| `state` | Quando e emitido | Formato do `detail` | Destino |
|---|---|---|---|
| `active` | JA EXISTE (`capture_engine.cc:410` e `:519`), so quando `changed` | `capturas=<N> endpoints=<M> <pid>:<exe> ...` (ate 10 ancoras, depois `...`) | **log** (`[audio-native] ... active`) |
| `failed` | JA EXISTE (`:399`, `:548`, `:556`) | texto tecnico livre | **cascata** (`escalate`, comportamento de hoje, INALTERADO) mais log |
| `health` | NOVO. No maximo a cada `kHealthReportIntervalMs` (15 000 ms) e **so quando ha underrun REAL ou descarte de fila**; tique mudo, sozinho, nunca dispara | `underruns=<T> quadros=<F> mudos=<S> descartes-tsfn=<D>` | **log** (`[audio-native] ... health`) |
| `skipped` | NOVO. So quando a assinatura do conjunto de recusas MUDA | `vistas=<S> <pid>:<exe>=<motivo> ...` (ate 10, depois `...`) | **log** (`[audio-native] ... skipped`) |
| `app-skipped` | NOVO. Na primeira vez de cada par (pid, motivo) e, enquanto a recusa PERSISTIR, reemitido a cada `kAppSkippedReplayMs` (10 000 ms) durante os primeiros `kAppSkippedReplayWindowMs` (60 000 ms) de vida do motor (3/T10). **So para motivos avisaveis** | o basename do executavel, sozinho (ex.: `steam.exe`) | **encaminhado ao renderer** como `'app-not-captured'` mais log |

**Os quatro campos de `health`, um a um** (a distincao entre os dois primeiros e o terceiro e o que impede o relatorio de disparar para sempre numa maquina saudavel, ver a nota de contabilidade em 3/T2):

| Campo | Significado | Conta quando |
|---|---|---|
| `underruns=<T>` | tiques com perda de audio REAL | alguma fonte devolveu `0 < frames < framesPerTick_` |
| `quadros=<F>` | soma dos quadros que faltaram nesses tiques | idem, somando `framesPerTick_ - frames` |
| `mudos=<S>` | tiques em que NENHUMA fonte entregou quadro | contexto; e o estado normal de um aplicativo que nao esta tocando nada, e **nao dispara o relatorio sozinho** |
| `descartes-tsfn=<D>` | frames PCM perdidos pela fila cheia da `ThreadSafeFunction` | `NonBlockingCall` devolveu erro (`addon.cc:311`) |

**Regra de reemissao do `app-skipped` (RF-19, 3/T10), literal**: emitir quando a chave `(pid, motivo)` e NOVA, ou quando as tres valem juntas - a recusa aparece de novo nesta volta do `Reconcile`, o motor tem menos de `kAppSkippedReplayWindowMs` de vida, e passaram-se pelo menos `kAppSkippedReplayMs` desde a emissao anterior daquela chave. Depois da janela de 60 s, cada chave e emitida uma unica vez, como qualquer outra. **A regra vale so para `app-skipped`**: `skipped` (o log de RF-22) continua governado apenas pela mudanca de assinatura, e nunca fica condicionado a assinante nenhum.

**Os tres motivos** (`SkipReason`, enum de arquivo em `capture_engine.cc`), com o texto EXATO que vai no `detail` e se vira aviso:

| `SkipReason` | Texto no `detail` | Origem no codigo | Vira `app-skipped`? |
|---|---|---|---|
| `ForbiddenTree` | `arvore-proibida` | `snapshot->IsForbidden(pid, ...)` (`capture_engine.cc:452`) | **NAO** (e o Discord e o proprio Zoi; 3/T8 e risco R9) |
| `ForbiddenSubtree` | `subarvore-proibida` | `snapshot->SubtreeContainsAny(pid, forbidden)` (`:475`) | **SIM** |
| `ActivationFailed` | `falha-ativacao(0x<HRESULT em 8 hex maiusculos>)` | `FAILED(stream->StartProcessInclude(pid, &detail))` (`:509`) | **SIM** |

Uma sessao enumerada cujo PID nao esta no `ProcessSnapshot` (`:451`, processo ja morto) **nao entra na lista**: nao e recusa, e corrida normal entre a enumeracao e a tabela de processos.

#### A2. Tipos de IPC alterados (`src/shared/ipc.ts`), tudo ADITIVO

```ts
export type AudioExclusionStartResult =
  | { mode: 'process-exclusion'; sampleRate: 48000; channels: 2; captureId: string }
  | { mode: 'unavailable'; reason: AudioExclusionUnavailableReason }

export type AudioExclusionState =
  | 'active'
  | 'degraded-full-loopback'
  | 'failed'
  /**
   * Um aplicativo especifico foi visto pelo motor e NAO esta sendo capturado,
   * por um motivo que o sistema consegue detectar (RF-19). Nunca e emitido para
   * o motivo `arvore-proibida`, que e a exclusao PRETENDIDA (Discord e o proprio
   * Zoi): avisar sobre ele seria alarmar o usuario com o produto funcionando.
   */
  | 'app-not-captured'

export interface AudioExclusionStatus {
  state: AudioExclusionState
  /** Texto tecnico curto para log; a UI usa `state` e `app`. */
  detail: string | null
  /** Sessao de captura a que este status pertence (RF-08). Null antes de haver sessao. */
  captureId: string | null
  /** Basename do executavel; preenchido SO quando `state === 'app-not-captured'`. */
  app: string | null
}
```

`captureId` e `app` sao campos NOVOS e obrigatorios na interface (nao opcionais): todas as construcoes de `AudioExclusionStatus` vivem em `src/main/audio-exclusion.ts` e sao poucas, entao deixa-los obrigatorios faz o `typecheck` apontar qualquer ponto esquecido. `AudioExclusionStartResult` ganha `captureId` **so no ramo `process-exclusion`**: o ramo `unavailable` nao tem sessao.

**Formato do `captureId`**: `ax-${Date.now().toString(36)}`, gerado UMA vez por `startAudioExclusion()` bem-sucedido. Exemplo: `ax-m1k2z9qp`.

#### A3. As linhas de log, literais

Estas sao as formas EXATAS. Todas em pt-BR sem acento e sem travessao; nenhuma contem `media-pull`, `dialback`, `discando de volta` nem `na outra direcao` (risco R3).

| Origem | Nivel | Linha |
|---|---|---|
| main, `startAudioExclusion` | info | `[audio-exclusion] sessao <captureId> iniciada em process-exclusion` |
| main, `sendStatus` (JA EXISTE, `:59-62`, ganha o id) | info | `[audio-exclusion] sessao <captureId> estado <state>: <detail>` |
| main, `escalate` (JA EXISTE, `:197`, ganha o id) | warn | `[audio-exclusion] sessao <captureId> degradando: <reason>` |
| main, handler de `active` | info | `[audio-native] <captureId> active (<n> mudancas em <ms> ms): <detail>` |
| main, handler de `skipped` | info | `[audio-native] <captureId> skipped (<n> mudancas em <ms> ms): <detail>` |
| main, handler de `health` | warn | `[audio-native] <captureId> health: <detail>` |
| main, handler de `app-skipped` | warn | `[audio-native] <captureId> app-skipped: <detail>` |
| renderer, `media-manager` (estados A e B) | info | `[audio] transmissao <txId> captura=process-exclusion sessao=<captureId>` |
| renderer, `media-manager` (estado C) | info | `[audio] transmissao <txId> captura=full-loopback motivo=<reason>` |
| renderer, `media-manager` (sem audio) | info | `[audio] transmissao <txId> captura=none` |
| renderer, `writeFrame` | warn | `[audio-drop] <captureId> backpressure: <count> quadros em <sinceMs> ms` |
| renderer, `stats-monitor` | warn | `[audio-stats] tx <txId> delta conceal=<eventos> amostras=<concealedSamples> descartados=<packetsDiscarded> perdidos=<packetsLost> jitter=<jitter>` |

**Absoluto ou delta, para nao restar duvida (N2):** `InboundAudioStats` (contrato 5.C4) guarda os valores ABSOLUTOS do `getStats`, exatamente como o irmao de video ja faz. A LINHA DE LOG e outra coisa: os quatro campos que vem depois da palavra `delta` sao DIFERENCAS contra a amostra anterior daquele mesmo `txId` (e por isso que o primeiro tique de uma transmissao nunca gera linha: nao ha anterior). O `jitter` fica FORA do `delta` de proposito - ele ja e um valor instantaneo em segundos, e a diferenca dele nao significa nada.

**Como o log responde as tres perguntas de RF-04/AC-03 sem ambiguidade**: o estado A tem `captura=process-exclusion` e NENHUMA linha `degradando` para aquele `captureId`; o estado B tem `captura=process-exclusion` MAIS uma linha `estado degraded-full-loopback` com o mesmo `captureId`; o estado C tem `captura=full-loopback` e nao tem `captureId` nenhum (nunca houve sessao). Sao tres assinaturas distintas, nunca um booleano.

### 5.B IPC (`src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/ipc-handlers.ts`)

**Nenhum canal novo, nenhuma assinatura de preload alterada.** `window.zoi.audioExclusion.start()` continua devolvendo `Promise<AudioExclusionStartResult>` (`src/preload/index.ts:60`) e `onStatus` continua entregando `AudioExclusionStatus` (`src/preload/index.ts:62-68`); as duas mudam so no FORMATO do objeto (5.A2), que e tipado de ponta a ponta. `src/main/ipc-handlers.ts:92-98` nao muda.

### 5.C Assinaturas internas consumidas entre sprints

#### C1. `src/shared/log-throttle.ts` (NOVO, PURO)

```ts
export interface ThrottleSummary {
  /** Ocorrencias acumuladas desde a linha anterior, incluindo a atual. */
  count: number
  /** Milissegundos desde a linha anterior; 0 na primeira. */
  sinceMs: number
}

export interface ThrottledCounter {
  /** Registra uma ocorrencia. Devolve o resumo quando a janela abriu, senao null. */
  record(now: number): ThrottleSummary | null
  /** Resumo do que ficou pendente, ou null se nada ficou. NAO usado em producao (3/T1). */
  flush(now: number): ThrottleSummary | null
}

export function createThrottledCounter(windowMs: number): ThrottledCounter
```

Regras literais da implementacao:
1. Estado interno: `pending = 0` e `lastEmitAt: number | null = null`.
2. `record(now)`: `pending += 1`. Se `lastEmitAt === null`, monta `{ count: pending, sinceMs: 0 }`, zera `pending`, faz `lastEmitAt = now` e devolve. Senao, se `now - lastEmitAt >= windowMs`, monta `{ count: pending, sinceMs: now - lastEmitAt }`, zera `pending`, faz `lastEmitAt = now` e devolve. Senao devolve `null`.
3. `flush(now)`: se `pending === 0` devolve `null`; senao monta `{ count: pending, sinceMs: lastEmitAt === null ? 0 : now - lastEmitAt }`, zera `pending`, faz `lastEmitAt = now` e devolve.
4. `now` sempre vem de fora (o modulo **nao chama `Date.now()`**): e isso que torna o teste deterministico sem `vi.useFakeTimers`.
5. `windowMs <= 0` faz toda chamada de `record` devolver resumo (throttle desligado). Nao lanca.
6. Relogio para tras (`now < lastEmitAt`): `now - lastEmitAt` fica negativo, a comparacao com `windowMs` positivo e falsa e a funcao devolve `null`. Comportamento correto e sem trava: a proxima janela valida volta a emitir.

**Exemplo trabalhado** (o teste T1 do Sprint T reproduz este exatamente). `createThrottledCounter(10_000)`, um descarte a cada 10 ms a partir de `now = 0`:
- `record(0)` devolve `{ count: 1, sinceMs: 0 }` (a primeira ocorrencia SEMPRE sai).
- `record(10)`, `record(20)`, ..., `record(9990)`: 999 chamadas, todas `null`.
- `record(10_000)` devolve `{ count: 1000, sinceMs: 10_000 }`.
- `record(10_010)` devolve `null` de novo.

#### C2. `Mixer` (`native/zoi-audio-capture/src/mixer.h` e `.cc`)

```cpp
/** Contadores de saude do mix, drenados pela thread de controle do Engine. */
struct MixerHealth {
  /** Tiques com perda de audio REAL: alguma fonte devolveu 0 < frames < framesPerTick_. */
  uint64_t underrunTicks = 0;
  /** Soma dos quadros que faltaram nesses tiques (framesPerTick_ - frames). */
  uint64_t underrunFrames = 0;
  /**
   * Tiques em que NENHUMA fonte entregou quadro. NAO e underrun: e o estado
   * normal de um aplicativo que nao esta tocando nada. Vai no relatorio como
   * CONTEXTO e nunca dispara o relatorio sozinho (3/T2, nota de contabilidade).
   */
  uint64_t silentTicks = 0;
};
```

Acrescimos publicos ao `Mixer`:
- `MixerHealth TakeHealth();` - le e ZERA os tres contadores atomicamente; e chamada de OUTRA thread, entao os tres sao `std::atomic<uint64_t>`.
- `bool HasUnderrun() const;` - devolve `underrunTicks_.load() > 0` **sem drenar nada**. Existe porque o `Engine` precisa decidir se vale reportar ANTES de drenar (5.C6): sem ele, checar o gatilho ja apagaria os contadores.

Acrescimos privados: `size_t fadeFrames_ = 0;` (calculado em `Start` como `format_.sampleRate * kFadeMs / 1000`, com piso de 2 e teto de `framesPerTick_`), `std::vector<uint8_t> sourceSilenced_;` (paralelo a `sources_`) e `std::vector<float> lastFrame_;` (tambem paralelo a `sources_`, com `format_.channels` valores por fonte: o ULTIMO quadro que aquela fonte entregou, usado pela cauda de decaimento).

**Invariante que a implementacao nao pode quebrar**: `sourceSilenced_.size() == sources_.size()` e `lastFrame_.size() == sources_.size() * format_.channels` SEMPRE, porque os tres so sao escritos dentro de `SetSources` (`mixer.cc:139-142`) e lidos dentro do bloco que ja segura `sourcesMutex_` (`:156-167`). `SetSources` redimensiona e ZERA os dois vetores auxiliares: uma composicao nova comeca com todas as fontes marcadas como vindas do silencio, o que faz a PRIMEIRA entrega de cada fonte nova subir com rampa. Isso e desejado (uma captura recem-aberta entrando no mix e exatamente uma transicao silencio -> sinal).

**Rampa, literal** (`channels` e `format_.channels`; `index` e a posicao da fonte no vetor). **Os ganhos sao calculados em `float`: o cast esta escrito no pseudo-codigo de proposito, porque `i / (fade - 1)` entre inteiros da zero.**
```
fade = min(frames, fadeFrames_)

// (1) fade-in: frames > 0 e sourceSilenced_[index] era 1
para i de 0 a fade-1:
    gain = static_cast<float>(i) / static_cast<float>(fade - 1)
    scratch[i * channels + c] *= gain, para cada canal c

// (2) fade-out no frame: 0 < frames < framesPerTick_
start = frames - fade
para i de 0 a fade-1:
    gain = static_cast<float>(fade - 1 - i) / static_cast<float>(fade - 1)
    scratch[(start + i) * channels + c] *= gain, para cada canal c

// (3) cauda de decaimento: frames == 0 e sourceSilenced_[index] era 0
//     (aqui `fade` e fadeFrames_ inteiro, porque nao ha quadro lido para limitar)
para i de 0 a fadeFrames_-1:
    gain = static_cast<float>(fadeFrames_ - 1 - i) / static_cast<float>(fadeFrames_ - 1)
    scratch[i * channels + c] = lastFrame_[index * channels + c] * gain, para cada canal c
    (ATRIBUICAO, nao multiplicacao: scratch acabou de ser zerado e nao ha quadro lido)
```
Se `fade < 2` (ou `fadeFrames_ < 2`), as rampas correspondentes sao PULADAS, para nao dividir por zero, e o comportamento e o de hoje. Os casos (1) e (2) podem acontecer no MESMO tique (a fonte voltou e ja engasgou de novo); quando `frames < 2 * fade` as duas regioes se sobrepoem, e isso e aceito: o resultado e um pico atenuado, melhor do que os dois degraus. O caso (3) e mutuamente exclusivo com os outros dois (ele so existe quando `frames == 0`), e **depois dele o laco de soma normal ainda precisa rodar**, porque a cauda vive em `scratch` e tem de entrar no mix como qualquer outra contribuicao: nesse tique o laco soma `fadeFrames_ * channels` amostras, e nao `frames * channels`.

**Atualizacao de estado ao fim de cada fonte, na ordem**: quando `frames > 0`, copiar o quadro `frames - 1` de `scratch` para `lastFrame_[index]` **antes** de aplicar o fade-out (senao o valor guardado ja viria atenuado); depois `sourceSilenced_[index] = (frames < framesPerTick_) ? 1 : 0`. Quando `frames == 0`, `sourceSilenced_[index] = 1` e `lastFrame_` fica como esta.

**Contabilidade dos contadores, literal**: `underrunTicks_` e incrementado UMA vez por tique (nao por fonte) se alguma fonte teve `0 < frames < framesPerTick_`; `underrunFrames_` soma `framesPerTick_ - frames` dessas mesmas fontes; `silentTicks_` e incrementado se NENHUMA fonte entregou quadro no tique. **`frames == 0` nunca incrementa `underrunTicks_` nem `underrunFrames_`.**

#### C3. `src/renderer/src/ui/screens/audio-copy.ts` (NOVO, sem imports)

```ts
/**
 * Textos dos avisos de captura de audio. Modulo sem NENHUM import de proposito:
 * o teste unitario (ambiente node) importa so isto, sem arrastar a tela.
 * Regra do projeto: pt-BR, SEM acento e SEM travessao (RNF-08).
 */
export const AUDIO_CAPTURE_COPY = {
  /** Estado C: a captura por aplicativo nunca vigorou (inclui Windows 10). RF-13. */
  fullLoopbackStart:
    'Atencao: esta transmissao esta enviando o som do sistema INTEIRO. Tudo que tocar no seu PC vai junto, inclusive a sua conversa no Discord.',
  /** Estado B: degradou em runtime. TEXTO IDENTICO ao de hoje (RF-16/AC-15). */
  degradedRuntime:
    'A captura de audio por aplicativo falhou; a transmissao segue com o som do sistema inteiro.',
  /** Falha total do motor. TEXTO IDENTICO ao de hoje (RF-16/AC-15). */
  failedRuntime: 'O audio da transmissao caiu; pare e transmita de novo para restaurar o som.',
  /** RF-19: um aplicativo especifico ficou de fora, por motivo detectavel. */
  appNotCaptured: (app: string): string =>
    `O som de ${app} nao esta indo na transmissao; os outros aplicativos seguem normalmente.`,
  /** Captura de audio pedida e nao obtida. TEXTO IDENTICO ao de hoje. */
  noAudio: 'Nao foi possivel capturar o audio do sistema; a transmissao segue so com video.'
} as const
```

`degradedRuntime`, `failedRuntime` e `noAudio` entram aqui **so para ficarem sob a mesma checagem mecanica de escrita**; os textos sao copias LETRA POR LETRA dos que ja estao em `RoomScreen.tsx:122`, `:127` e `:209`. Mudar qualquer um deles quebra AC-15.

#### C4. `stats-monitor.ts`: os tipos irmaos de audio

```ts
/** Irmao de `RtpVideoStatsEntry` (:48-57), para os campos que o lib.dom nao declara. */
interface RtpAudioStatsEntry {
  type?: string
  kind?: string
  codecId?: string
  mimeType?: string
  jitter?: number
  audioLevel?: number
  concealedSamples?: number
  concealmentEvents?: number
  insertedSamplesForDeceleration?: number
  removedSamplesForAcceleration?: number
  packetsDiscarded?: number
}

/**
 * Irmao de `InboundVideoStats` (:68-75). Valores ABSOLUTOS do getStats, como os
 * do irmao de video: quem precisa de delta guarda a amostra anterior.
 */
export interface InboundAudioStats {
  at: number
  jitter: number | null
  audioLevel: number | null
  concealedSamples: number
  concealmentEvents: number
  insertedSamplesForDeceleration: number
  removedSamplesForAcceleration: number
  packetsDiscarded: number
  packetsLost: number
  packetsReceived: number
  bytesReceived: number
  codec: string | null
}

/** Totais de UM `kind` numa amostra. Substitui os tres campos soltos de `InboundSample`. */
interface KindTotals {
  bytes: number
  packetsLost: number
  packetsReceived: number
}

interface InboundSample {
  at: number
  video: KindTotals
  audio: KindTotals
}
```

Callback novo em `StatsMonitorCallbacks`: `onInboundAudioStats?(stats: ReadonlyMap<string, InboundAudioStats>): void` - **opcional**, exatamente como o irmao `onInboundVideoStats?` (`:86`), para nao quebrar os 12 literais de `tests/unit/stats-monitor.test.ts`.

**Regra de agregacao (3/T4), literal**: onde hoje se le `bytes`, `packetsLost` e `packetsReceived` em `:207-222`, passa a se ler `video.bytes + audio.bytes`, `video.packetsLost + audio.packetsLost` e `video.packetsReceived + audio.packetsReceived`. O objeto guardado em `this.previous` (`:222`) e o `InboundSample` novo. **`onReport` nao muda de forma nem de valor.**

**Regra de deduplicacao por `txId`**: o irmao de video se protege de multiplos `inbound-rtp` de video na mesma conexao comparando `framesDecoded` (`:163-164`). O de audio usa o mesmo espirito com o campo equivalente: se ja existe entrada para aquele `txId` e o `packetsReceived` do report atual **nao e maior** que o ja guardado, o report e ignorado.

#### C5. `SessionScanner`: multiplos endpoints (`session_tracker.h` e `.cc`)

```cpp
/** Um endpoint de render aberto: o dispositivo, o gerenciador de sessoes e a notificacao. */
struct EndpointBinding {
  Microsoft::WRL::ComPtr<IMMDevice> device;
  Microsoft::WRL::ComPtr<IAudioSessionManager2> manager;
  Microsoft::WRL::ComPtr<IAudioSessionNotification> notifier;
};
```

O campo trio `device_` / `manager_` / `sessionNotifier_` (`session_tracker.h:112-114`) e substituido por `std::vector<EndpointBinding> endpoints_;`. `enumerator_` e `deviceNotifier_` ficam como estao.

`Reopen()` (`session_tracker.cc:234-260`), na ordem literal:
1. Para cada binding existente, `manager->UnregisterSessionNotification(notifier.Get())` quando os dois existem; depois `endpoints_.clear()`.
2. `enumerator_->EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE, &collection)`; se falhar, pular para o passo 6.
3. `collection->GetCount(&count)`. Resolver o dispositivo padrao de console (`GetDefaultAudioEndpoint(eRender, eConsole, &defaultDevice)`) e o `GetId` dele; e o unico que **nao pode** ser cortado pelo teto nem perdido em silencio. **`IMMDevice::GetId` devolve um `LPWSTR` alocado com `CoTaskMemAlloc`: a string precisa de `CoTaskMemFree` depois da comparacao, em TODOS os caminhos de saida** (o mesmo vale para cada `GetId` chamado no passo 4). Sem isso a funcao vaza memoria a cada `Reopen`, e `Reopen` roda a cada troca de dispositivo padrao.
4. Iterar `collection->Item(index, &device)`; comparar `device->GetId` com o id padrao. O padrao vai para a POSICAO 0 de `endpoints_`; os demais entram na ordem em que vierem, ate `endpoints_.size() == kMaxScannedEndpoints` (8). Manter um `bool defaultBound = false`, marcado como `true` **so quando o binding do dispositivo padrao for concluido com sucesso** no passo 5.
5. Para cada dispositivo aceito: `device->Activate(__uuidof(IAudioSessionManager2), CLSCTX_ALL, nullptr, &manager)`; se falhar, `continue` (um dispositivo problematico nunca derruba os outros). Chamar `manager->GetSessionEnumerator(&sessions)` uma vez, como HOJE (`:252-253`), porque a enumeracao inicial e pre-requisito documentado para o `OnSessionCreated` comecar a sair. `Make<SessionNotifier>(wakeEvent_)` e `manager->RegisterSessionNotification(...)`; se o registro falhar, guardar o binding do mesmo jeito com `notifier` nulo (a rede do poll de 1 s cobre).
6. **Degrau de seguranca, em DOIS niveis** (o segundo nivel e o que impede a regressao silenciosa descrita abaixo):
   - **6a, dispositivo padrao.** Se `defaultBound` for `false` - porque o `EnumAudioEndpoints` falhou, ou porque o padrao nao apareceu na colecao, ou porque o `Activate` dele falhou - tentar EXPLICITAMENTE o caminho de HOJE (`GetDefaultAudioEndpoint(eRender, eConsole)` mais `Activate` mais `GetSessionEnumerator` mais registro) e, dando certo, INSERIR na posicao 0. **Este passo roda mesmo com `endpoints_` ja nao vazio.** Sem ele, um `Activate` que falhasse so no dispositivo padrao enquanto outro dispositivo funcionasse deixaria `endpoints_` cheio, o degrau nunca rodaria, e o unico dispositivo que a versao anterior do app escaneava sumiria **sem erro e sem log** - uma regressao pior do que a falha que o codigo de hoje reporta como `failed`.
   - **6b, ultimo recurso.** Se depois de 6a `endpoints_` continuar VAZIO, devolver o HRESULT da falha do padrao, que e exatamente o que `RunControlThread` (`capture_engine.cc:397-402`) ja transforma em `Report("failed", ...)` hoje.
7. Devolver `S_OK` quando `endpoints_` tem pelo menos um binding. **Guardar `defaultBound` (ja considerando 6a) num campo**, porque ele entra no log: e a unica forma de quem le o arquivo saber que a captura esta rodando SEM o dispositivo padrao do sistema.

`ListSessionPids` (`:277-310`): `if (endpoints_.empty()) return E_UNEXPECTED;` no lugar de `if (!manager_)` (`:279`). O laco de sessoes de hoje (`:281-307`) vira o corpo de um laco externo sobre `endpoints_`, com o MESMO `std::unordered_set<DWORD> seen` (`:289`) declarado FORA do laco externo (e ele que faz a uniao sem repeticao). Um endpoint cujo `GetSessionEnumerator` falha e pulado; a funcao so devolve erro se NENHUM endpoint respondeu.
`Close()` (`:262-275`): desregistra o notifier de cada binding, limpa `endpoints_` e mantem o resto igual.
`GetDefaultDevice()` (`:312-315`): **INALTERADA**. Ela serve so ao modo `endpoint-loopback` (`capture_engine.cc:547`), onde "sistema inteiro" quer dizer o dispositivo padrao do sistema, nao a uniao de todos.
Metodos novos: `std::string DescribeEndpoints() const;` devolvendo so a contagem (`std::to_string(endpoints_.size())`) e `bool DefaultEndpointBound() const;` devolvendo o flag do passo 7. Os dois sao consumidos por `Engine::DescribeAnchors`, que passa a compor `capturas=<N> endpoints=<M>` e, **somente quando `DefaultEndpointBound()` for falso**, acrescenta `padrao=nao`. A ausencia do campo significa o caso normal; a presenca dele e o sinal, no log de campo, de que o dispositivo padrao do sistema ficou de fora (N5).

#### C6. `Engine`: contadores, motivos e relatorios (`capture_engine.h` e `.cc`)

Publico novo:
```cpp
/** Contador de frames PCM descartados pela fila cheia da TSFN (RF-01). */
void SetPcmDropCounter(std::shared_ptr<std::atomic<uint64_t>> counter);
```
Privado novo: `void ReportRaw(const std::string& state, const std::string& detail);` (identico a `Report` de `:378-382` **sem** a logica de `lastState_`: os estados de diagnostico nunca podem ser suprimidos por igualdade nem podem corromper o `lastState_` do ciclo de vida), `void ReportHealth();`, `std::string DescribeSkipped(const ProcessSnapshot& snapshot, size_t seenCount) const;`, mais os campos:
```cpp
std::shared_ptr<std::atomic<uint64_t>> pcmDropCounter_;
ULONGLONG engineStartedAt_ = 0;   // GetTickCount64() no inicio de RunControlThread
ULONGLONG lastHealthAt_ = 0;
std::string lastSkippedSignature_;
/** chave -> tique da ULTIMA emissao de app-skipped daquela chave (3/T10). */
std::unordered_map<uint64_t, ULONGLONG> warnedApps_;
/** pid, motivo e HRESULT (0 quando nao se aplica), recolhido no Reconcile corrente. */
struct SkipEntry { DWORD pid; int reason; HRESULT hr; };
std::vector<SkipEntry> skipped_;
```

**`DescribeSkipped` recebe `seenCount` de proposito (W1)**: o `vistas=<S>` da tabela de 5.A1 e a quantidade de sessoes ENUMERADAS naquela volta, e esse numero mora em `sessionPids` (`capture_engine.cc:439`), que e local de `Reconcile` e invisivel para um metodo que so recebe o `ProcessSnapshot`. Sem o parametro, a implementacao acabaria emitindo `skipped_.size()`, que e a quantidade de RECUSAS e nao de sessoes vistas, e o exemplo `vistas=3` com duas entradas (2.4) deixaria de fazer sentido. A chamada e `DescribeSkipped(*snapshot, sessionPids.size())`.

**Chave de `warnedApps_`, literal (N4)**: `const uint64_t key = static_cast<uint64_t>(pid) * 256ull + static_cast<uint64_t>(reason);` - o cast e obrigatorio porque `pid` e `DWORD` (32 bits) e a multiplicacao por 256 sem cast estouraria para PIDs altos.

`addon.cc`, em `Start` (`:270-336`): criar `auto pcmDrops = std::make_shared<std::atomic<uint64_t>>(0);`, capturar por valor no lambda `pcmSink` (`:295-312`) e trocar o `if (status != napi_ok) delete frame;` (`:311`) por `if (status != napi_ok) { pcmDrops->fetch_add(1); delete frame; }`. Antes de `session->engine.Start(...)` (`:326`), chamar `session->engine.SetPcmDropCounter(pcmDrops);`.

`RunControlThread` (`capture_engine.cc:393-434`): gravar `engineStartedAt_ = GetTickCount64()` antes do `while` de `:413`; depois de cada `Reconcile`/`ReconcileEndpoint` dentro do laco (`:417-425`), chamar `ReportHealth()`.

**`ReportHealth`, na ordem literal (a ordem E o contrato):**
1. `const ULONGLONG now = GetTickCount64();`
2. **Janela**: se `lastHealthAt_ != 0 && now - lastHealthAt_ < kHealthReportIntervalMs`, `return` **sem tocar em contador nenhum**.
3. **Gatilho, por PEEK e nao por drenagem**: `const bool worth = mixer_.HasUnderrun() || (pcmDropCounter_ && pcmDropCounter_->load() > 0);` Se `worth` for falso, `return` **sem drenar e sem atualizar `lastHealthAt_`**, para que o primeiro evento real saia na hora em vez de esperar a proxima janela.
4. So agora drenar: `const MixerHealth health = mixer_.TakeHealth();` e `const uint64_t drops = pcmDropCounter_ ? pcmDropCounter_->exchange(0) : 0;`
5. `ReportRaw("health", "underruns=<T> quadros=<F> mudos=<S> descartes-tsfn=<D>")` e `lastHealthAt_ = now;`

**Por que o passo 3 faz PEEK e nao drena**: `TakeHealth()` e `exchange(0)` ZERAM os contadores; checar o gatilho drenando apagaria justamente os eventos que se quer reportar quando a janela ainda nao abriu. E **por que `silentTicks` NAO entra no gatilho**: tique mudo e o estado normal de um aplicativo que nao esta tocando nada (3/T2, nota de contabilidade). Se ele disparasse o relatorio, `health` sairia a cada 15 s para sempre, em qualquer maquina, contradizendo o proprio Done when de C1.2 e o item de T2 que exige ZERO linhas `health` numa maquina saudavel. `silentTicks` vai no `detail` como contexto e e drenado junto, nunca como gatilho.

`Reconcile` (`:436-521`): `skipped_.clear()` no inicio; `skipped_.push_back({pid, kForbiddenTree, S_OK})` no `continue` de `:452`; `{pid, kForbiddenSubtree, S_OK}` no `continue` de `:475`; `{pid, kActivationFailed, hr}` no `continue` de `:511`. No fim, montar `DescribeSkipped(*snapshot, sessionPids.size())`, comparar com `lastSkippedSignature_` e, se mudou, `ReportRaw("skipped", ...)` e guardar. **Este caminho e incondicional e nao depende de assinante nenhum: e o log de RF-22.**

Depois, a emissao dos avisos (3/T10), para cada entrada de motivo AVISAVEL (`kForbiddenSubtree` e `kActivationFailed`, **nunca** `kForbiddenTree`), com `now = GetTickCount64()` e a `key` definida acima:
```
achou       = warnedApps_.find(key)
novo        = (achou == warnedApps_.end())
naJanela    = (now - engineStartedAt_) < kAppSkippedReplayWindowMs
podeRepetir = !novo && naJanela && (now - achou->second) >= kAppSkippedReplayMs
se (novo || podeRepetir):
    warnedApps_[key] = now
    ReportRaw("app-skipped", <basename do exe do snapshot>)
```

---

## 5b. Dependencias e configuracao

**Nenhuma dependencia nova**, nem de runtime nem de desenvolvimento. Nada de biblioteca de log, nada de DSP. `node-addon-api` continua na versao que ja esta em `native/zoi-audio-capture/package.json`. `binding.gyp` **nao muda**: nenhum arquivo `.cc` novo entra no addon (todas as mudancas nativas sao nos quatro arquivos que ja estao listados como `sources`).

**Constantes novas, por NOME**, todas em `src/shared/config.ts`, junto das demais, cada uma com comentario curto dizendo a unidade e o porque do numero:
- `AUDIO_LOG_WINDOW_MS` - janela minima entre duas linhas de log de um mesmo ponto instrumentado. Valor `10_000`. Justificativa numerica em 3/T1.
- `AUDIO_FADE_MS` - duracao da rampa de entrada e saida do silencio no lado do renderer. Valor `1`. Justificativa em 3/T2.
- `AUDIO_MAX_SKIP_MS` - teto de quanto o relogio da track pode avancar de uma vez para cobrir frames descartados. Valor `200`. Justificativa e comportamento acima do teto em 3/T3.

**Constante nova em `src/renderer/src/store/app-store.ts`**, ao lado de `TOAST_TTL_MS` (`:17`):
- `TOAST_TTL_LONG_MS` - duracao de um toast que precisa ser LIDO, nao so notado. Valor `12_000`. Justificativa em 3/T6.

**Constantes novas em C++** (constantes de arquivo, no bloco anonimo de `capture_engine.cc:13-21`, junto de `kActivationTimeoutMs`/`kBufferDuration`/`kReconcileIntervalMs`):
- `kHealthReportIntervalMs = 15000` - janela minima entre dois relatorios `health`.
- `kAppSkippedReplayMs = 10000` - janela minima entre duas emissoes de `app-skipped` da MESMA chave (3/T10).
- `kAppSkippedReplayWindowMs = 60000` - por quanto tempo, a partir da subida do motor, a reemissao acontece. Depois disso cada chave e emitida uma unica vez. O numero e ~30x o tempo tipico entre o fork do worker e o `RoomScreen` assinar o `onStatus` (`getDisplayMedia` mais setup de track), com folga deliberada para maquina lenta ou usuario demorando no seletor de fonte.
Em `session_tracker.cc` (bloco anonimo):
- `kMaxScannedEndpoints = 8` - teto de endpoints de render escaneados por volta.
Em `mixer.cc` (bloco anonimo, junto de `Clamp`):
- `kFadeMs = 1` - duracao da rampa. **Duplicacao consciente** de `AUDIO_FADE_MS`: C++ nao importa TypeScript e criar um cabecalho gerado para UM numero seria maquinaria maior que o problema. As duas declaracoes carregam um comentario apontando uma para a outra.

**Nenhuma chave nova em `settings.json`**, nenhuma variavel de ambiente nova, nenhum script novo em `package.json` (o `audio:probe` que esta feature usa **ja existe**), nenhuma constante nova em `@shared/presets` ou `@shared/codecs`, nenhum token novo de CSS.

**Rebuild nativo** (obrigatorio nas features C1, C2 e C3, ver risco R11): `npm rebuild zoi-audio-capture --foreground-scripts` a partir da raiz. A entrada `"zoi-audio-capture@0.1.0": true` ja existe em `allowScripts` do `package.json` raiz; sem ela o npm 11 pula o `node-gyp rebuild` **em silencio**. Requisito de maquina: MSVC Build Tools mais Python 3.x, ja documentado na SPEC da `app-audio-capture`. Verificacao de que o rebuild aconteceu: o mtime de `native/zoi-audio-capture/build/Release/zoi_audio_capture.node` avancou.

---

## 5c. Matriz de confianca

Esta feature **nao tem papeis nem autenticacao**: dono e membro comum tem exatamente as mesmas capacidades aqui (PRD secao 2, nota final), e **nada do que ela produz atravessa a rede** (secao 5, declaracao sobre o protocolo). A superficie de confianca que sobra e INTERNA a maquina: quem pode emitir cada mensagem dos canais tocados, o que o receptor verifica, e o que acontece quando a verificacao falha.

**Regra geral que vale para toda a tabela**: um status malformado ou desconhecido e **descartado em silencio, sem efeito colateral**. Nunca derruba o worker, nunca dispara a cascata de degradacao, nunca lanca. A cascata continua tendo exatamente DOIS gatilhos, os de hoje: `state === 'failed'` e `type === 'fatal'`.

| Mensagem / canal | Quem PODE emitir | O que o receptor VERIFICA antes de agir | O que acontece se a checagem falhar |
|---|---|---|---|
| `AudioWorkerEvent { type: 'status' }` com `state` NOVO (`health`, `skipped`, `app-skipped`) | so o `utilityProcess` de captura, forkado pelo proprio main (`:145-149`) | `worker.on('message')` ja checa `message && typeof message.type === 'string'` (`:158`) e `session === created` (`:159`); o ramo novo checa que `state` e um dos quatro nomes conhecidos | `state` desconhecido: **nenhum log, nenhum encaminhamento, `return`**. E o comportamento de hoje para tudo que nao e `failed`, preservado como default |
| `state: 'failed'` | idem | INALTERADO (`:162-164`) | INALTERADO: `escalate(...)`. **Nenhum estado novo pode disparar a cascata** |
| `state: 'app-skipped'` | idem | o `detail` e tratado como TEXTO OPACO e so e usado como nome de aplicativo; o main nao parseia nada dele (3/T8) | `detail` vazio: a mensagem e logada e **nao** e encaminhada ao renderer (um toast sem nome de app nao ajuda ninguem) |
| `AudioExclusionStatus` com `state: 'app-not-captured'` (main -> renderer, canal `IPC.audioExclusionStatus` ja existente) | so o processo main, pelo `webContents.send` de `:63` | `RoomScreen` ja exige `localTx?.audioMode === 'excluded'` para sequer assinar (`:112`) e ja dedupica por `status.state` (`:117-118`) | fora de uma transmissao com `audioMode === 'excluded'`, **nao ha nenhum `ipcRenderer.on` registrado** (o `on` mora dentro de `onStatus`, `src/preload/index.ts:65`) e a mensagem e descartada pelo Chromium, sem erro. **E por isso que existe a reemissao de 3/T10**: a primeira emissao acontece antes de o assinante nascer e some. O LOG dessa mesma recusa (`skipped`) nao passa por aqui e e escrito de qualquer jeito (RF-22 incondicional) |
| Reemissao de `app-skipped` (3/T10) chegando ao renderer depois de o toast ja ter sido mostrado | so o motor nativo, ate 60 s de vida | o `alreadyWarned` de `RoomScreen.tsx:115-118` dedupica por `status.state` | descarte silencioso no renderer: **um toast por transmissao**, quantas reemissoes venham. O log guarda todas |
| `status.app` renderizado no toast | so o main | e um basename de executavel vindo do `ProcessSnapshot` do proprio Windows (`ToLowerBaseName`, `session_tracker.h:119`) | e texto, renderizado por React como texto (nunca `dangerouslySetInnerHTML`), entao nao ha superficie de injecao. `app` nulo ou vazio: **nenhum toast** |
| `AudioExclusionStartResult.captureId` | so o main | o renderer so o usa para compor linha de log | ausente (nao pode acontecer com o tipo obrigatorio): as linhas sairiam com `undefined`, o que e feio e inofensivo. Nao ha caminho de decisao que dependa dele |
| Frame PCM pelo `MessagePort` (INALTERADO) | so o worker | `writeFrame` ja checa `payload.type === 'pcm'`, `payload.data` presente (`audio-exclusion.ts:76`) e `Number.isInteger(numberOfFrames) && numberOfFrames > 0` (`:85`) | INALTERADO: `return` silencioso. **O contador de descarte NAO conta esses casos**: ele conta so o descarte por backpressure (`:89`), que e o unico que representa audio perdido |
| Linha de log escrita pelo renderer | so o proprio renderer | `attachRendererLogging` (`file-logger.ts:147-151`) grava tudo que chega em `console-message` | nenhuma checagem nova. A protecao aqui e de VOLUME (risco R2) e de CONTEUDO (risco R3), garantida pelas regras da secao 6, nao por validacao em runtime |
| **Envio de qualquer dado de audio para outro par** | **ninguem, nunca** | nao existe caminho: nenhuma mensagem de protocolo nova, nenhum `mesh.send`, nenhum `broadcast` em nenhum passo desta SPEC | **Guarda desta SPEC**: se um agente de implementacao sentir vontade de "mandar os contadores para o transmissor ver", a resposta e nao. Diagnostico de audio e local a maquina que o gera |

---
## 6. Backend e Frontend: divisao do trabalho

**Ordem obrigatoria: Backend inteiro (B1, B2, C1), depois Frontend (F1), depois o Sprint de testes.** O frontend so consome contratos que ja existem no codigo quando ele comeca: o toast de RF-19 depende do estado `'app-not-captured'` existir no tipo (B1.1), de o main encaminha-lo (B2.1) e de o motor nativo emiti-lo (C1.2).

### 6.1 Backend (Sprints B1, B2, C1)

Cobre tudo o que nao e pixel: o modulo puro de rate-limit, os tipos de IPC, a identidade de sessao de captura, a instrumentacao nos tres processos (main, renderer de servico, motor nativo), as duas correcoes de forma de onda e a enumeracao ampliada de endpoints. Sete arquivos de TypeScript e cinco de C++.

**Sobre o C++ (Sprint C1), regra dura:** as tres features nativas exigem rebuild (5b, risco R11). Nenhuma delas pode ser dada como pronta com base em leitura de codigo: o Done when de cada uma exige `npm rebuild zoi-audio-capture --foreground-scripts`, a conferencia do mtime do `.node` e uma execucao de `npm run audio:probe`. Se a toolchain nativa nao estiver disponivel na maquina, **nao commite**: reporte o estado (LESSONS 2026-08-25, "green tem dentes").

### 6.2 Frontend (Sprint F1)

**Esta feature NAO tem UISPEC, e isso e deliberado** (a Stage 3b foi pulada): o trabalho visual e uma unica string, um tom e uma duracao num toast que **ja existe, ja dispara e ja esta estilizado**. Nao ha identidade nova a derivar. O agente de frontend, portanto, NAO inventa vocabulario visual: ele reusa o que ja esta contratado.

- **Componente**: `src/renderer/src/ui/components/Toast.tsx` (`ToastContainer`/`ToastRow`), sem nenhuma classe CSS nova. Os tons vem de `ToastTone` (`src/renderer/src/core/room-state.ts:132`), que ja tem `'info' | 'success' | 'warning' | 'danger'`, e as regras `.z-toast--<tone>` ja existem na folha de componentes (o toast de `'danger'` ja e usado hoje em `RoomScreen.tsx:230` e `:232`).
- **Precedente de UISPEC herdado**: o padrao de toast e o da `viewer-cursors` (canto inferior direito, entrada `translateY` mais fade em 180 ms, auto-dismiss), documentado no cabecalho de `Toast.tsx:1-2` e no UISPEC daquela feature. Esta SPEC muda **uma** coisa nesse padrao: a duracao deixa de ser global e passa a ser por toast, com o valor de hoje como default (3/T6).
- **Proibido nesta feature**: criar componente novo, criar classe CSS nova, criar token novo, criar um segundo ponto de aviso para o cenario de sistema-inteiro (AC-13), mexer no texto ou na condicao dos dois ramos de runtime ja existentes (AC-15).

### 6.3 Regras que valem para TODA feature deste plano

**Regra GREEN (LESSONS 2026-08-25):** antes do commit, alem de `npm run typecheck` e `npm run lint`, a feature precisa ser EXERCITADA pelo caminho descrito em "Done when". Build passando NAO e exercicio. Se o orcamento acabar antes do exercicio, **NAO commite**: reporte o estado. Para modulo puro, o exercicio aceito e um arquivo temporario `tests/unit/__scratch-<assunto>.test.ts`, rodado com `npx vitest run tests/unit/__scratch-<assunto>.test.ts` e **APAGADO antes do commit** (os testes definitivos sao do Sprint T).

**Regra de commit (LESSONS 2026-08-25):** `git add` sempre com caminhos EXPLICITOS, nunca `-A`; **nunca** rodar `npm run format` (o glob dele e `"src/**/*.{ts,tsx,css}"`, que reformata a base inteira e ja arrastou 9 arquivos fora de escopo uma vez). Conventional Commits em pt-BR, sem acento, sem travessao, **sem assinatura do Claude**.

**Regra de log (risco R2 e R3):** toda linha nova usa um dos cinco prefixos de 2, e e PROIBIDO conter `media-pull`, `dialback`, `discando de volta` ou `na outra direcao`. Toda chamada de `console.*`/`logToFile` nova vive dentro de um `ThrottledCounter`, de um gatilho de MUDANCA, ou de um evento que acontece no maximo uma vez por transmissao. Verificacao mecanica no Done when.

**Regra de silencio (RNF-11, regra permanente do usuario, LESSONS 2026-08-25):** qualquer execucao de Playwright roda MUDA. O helper ja garante isso com `--mute-audio` (`tests/e2e/helpers/zoi-app.ts:286`) e `soundVolume: 0` no perfil semeado (`:86`); nenhuma feature pode remover ou contornar os dois. Nenhum passo desta SPEC reproduz tom audivel: o `audio-probe.mjs` usa um sinal de 1 Hz inaudivel por decisao ja registrada no cabecalho dele (`:12-16`), e continua assim.

**Regra de escopo (RNF-04):** nenhum arquivo do pipeline de VIDEO e tocado. `src/shared/codecs.ts`, `src/shared/presets.ts`, `PlayerView.tsx`, `first-frame-watch.ts` e todo o caminho de codec de `media-manager.ts` ficam fora. As UNICAS linhas novas em `media-manager.ts` sao as tres de log de estado de captura e o `let` que carrega o motivo e o `captureId`.

---

## 7. Plano de execucao

## Backend

### Sprint B1 - Fundacao: rate-limit, constantes e identidade de sessao

#### Feature B1.1 - Contador com janela, constantes e `captureId` `[core]`

**Traces**: RF-07, RF-08, RNF-01, RNF-08; precondicao de RF-01, RF-04, RF-05, RF-06, RF-19, RF-22.

**Steps**
1. Criar `src/shared/log-throttle.ts` com o cabecalho de comentario no estilo do projeto (pt-BR sem acento) explicando: modulo PURO (sem DOM, sem Electron, importavel por `tests/unit`), por que ele existe (o teto de 5 MB/dia do `file-logger.ts` silencia o log do APP INTEIRO quando estoura, e nao existe helper de throttle no projeto) e por que `now` vem de fora (determinismo em teste).
2. Implementar `ThrottleSummary`, `ThrottledCounter` e `createThrottledCounter` exatamente como o contrato 5.C1 descreve, incluindo as seis regras literais. **`Date.now()` nao pode aparecer neste arquivo.**
3. Acrescentar em `src/shared/config.ts`, junto das demais constantes de temporizacao e seguindo o padrao de comentario em bloco que o arquivo ja usa: `AUDIO_LOG_WINDOW_MS = 10_000` (janela minima entre duas linhas de um mesmo ponto instrumentado; o calculo do pior caso esta em 3/T1) e `AUDIO_FADE_MS = 1` (rampa de entrada e saida do silencio no renderer; o C++ tem a propria copia em `kFadeMs`, ver 5b).
4. `src/shared/ipc.ts`: aplicar as tres mudancas do contrato 5.A2 - `captureId: string` no ramo `process-exclusion` de `AudioExclusionStartResult` (`:110-112`), o valor `'app-not-captured'` em `AudioExclusionState` (`:114`) com o comentario literal do contrato, e os campos `captureId: string | null` e `app: string | null` em `AudioExclusionStatus` (`:116-120`). **Nao mexer** em `AudioExclusionUnavailableReason` (`:98-108`) nem nas constantes de `:123-128`.
5. `src/main/audio-exclusion.ts`: acrescentar `captureId: string` em `ExclusionSession` (`:40-47`); trocar a assinatura de `spawnWorker(mode, restarts)` (`:142`) para `spawnWorker(mode, restarts, captureId)` e gravar o id no objeto `created` (`:155`); em `escalate` (`:190-219`) repassar `previous.captureId` nos dois `spawnWorker` (`:201`, `:210`) - **o id sobrevive a cascata, e o que liga o degrau A->B a mesma transmissao** (2b.1). Em `startAudioExclusion` (`:221-249`), gerar `const captureId = \`ax-${Date.now().toString(36)}\`` antes do `spawnWorker` de `:240`, passa-lo, e devolve-lo no objeto de `:244-248`.
6. Mesmo arquivo: `sendStatus` (`:58-64`) passa a receber o `AudioExclusionStatus` completo e a linha de `logToFile` de `:59-62` vira a forma literal de 5.A3 (`[audio-exclusion] sessao <captureId> estado <state>: <detail>`). As duas chamadas de `escalate` (`:213`, `:218`) passam a incluir `captureId: previous.captureId` e `app: null`. A linha de `:197` vira `[audio-exclusion] sessao <captureId> degradando: <reason>`. Acrescentar, logo apos `session = started` (`:243`), um `logToFile('info', ...)` com a linha `[audio-exclusion] sessao <captureId> iniciada em process-exclusion`.
7. `src/renderer/src/services/audio-exclusion.ts`: acrescentar `captureId: string | null` em `AudioExclusionStartOutcome` (`:22-26`) e preenche-lo nos tres `return` de `start()` (`:129` e `:139` com `null`, `:146-161` com `result.captureId`). Nenhuma outra mudanca neste arquivo nesta feature.

**Edge cases** (categoria: modulo puro mais tipos)
- `createThrottledCounter(0)`: toda chamada de `record` devolve resumo. Nao lanca, nao entra em laco.
- `createThrottledCounter(-1)`: idem (a comparacao `>= windowMs` e sempre verdadeira). Nao lanca.
- `record` chamado duas vezes com o MESMO `now` na primeira janela: a primeira devolve `{ count: 1, sinceMs: 0 }`, a segunda devolve `null` (`now - lastEmitAt` e 0, que nao e `>= 10_000`).
- `flush` sem nenhuma ocorrencia pendente: devolve `null`, e nao um resumo de contagem zero.
- `flush` logo depois de um `record` que emitiu: `pending` e 0, devolve `null`.
- Relogio para tras (`record(100)` depois de `record(20_000)`): devolve `null`, sem travar. A proxima chamada com `now` valido volta a emitir.
- `Date.now()` colidindo entre duas sessoes de captura no MESMO milissegundo: impossivel na pratica (`stopAudioExclusion()` roda antes de todo `start`, `:223`, entao nunca ha duas sessoes vivas), e o pior efeito seria dois ids iguais em linhas separadas por timestamp ISO no arquivo.
- `AudioExclusionStatus` construido sem `captureId`/`app`: **nao compila**, que e o objetivo de os campos serem obrigatorios.

**Done when**
- `npm run typecheck` e `npm run lint` verdes. `npx vitest run` verde: **nenhum teste existente pode quebrar**; em particular `tests/unit/audio-exclusion-client.test.ts`, que constroi resultados de `start()` e agora precisa do campo novo se ele for lido (conferir e, se o teste montar o objeto de resultado, acrescentar `captureId` ali).
- Exercicio (scratch test, apagado antes do commit) provando o **exemplo trabalhado de 5.C1**: com janela de 10 000, `record(0)` devolve `{ count: 1, sinceMs: 0 }`; as 999 chamadas de `record(10)` a `record(9990)` devolvem todas `null`; `record(10_000)` devolve exatamente `{ count: 1000, sinceMs: 10_000 }`.
- `grep -n "Date.now" src/shared/log-throttle.ts`: zero ocorrencias.
- `grep -niE "media-pull|dialback|discando de volta|na outra direcao"` nos arquivos tocados: zero ocorrencias novas.

**Commit**: `feat(audio): adiciona contador com janela para log e identidade de sessao de captura`
**Rollback**: reverter o commit. `log-throttle.ts` ainda nao tem consumidor e os campos novos de IPC sao carregados de ponta a ponta pelo typecheck, entao a reversao e mecanica.

---

### Sprint B2 - Observabilidade no TypeScript

#### Feature B2.1 - O main persiste os quatro estados nativos e encaminha o avisavel `[core]`

**Traces**: RF-01 (ponto nativo, transporte), RF-04, RF-05, RF-06, RF-07, RF-08, RF-19 (transporte), RF-22 (transporte), RNF-01, RNF-08.

**Steps**
1. `src/main/audio-exclusion.ts`: importar `AUDIO_LOG_WINDOW_MS` de `@shared/config` e `createThrottledCounter` de `@shared/log-throttle` (o alias `@shared` ja resolve no projeto do main: `src/main/ipc-handlers.ts:3` e a prova).
2. Acrescentar em `ExclusionSession` (`:40-47`) quatro campos de diagnostico: `activeLog: ThrottledCounter`, `skippedLog: ThrottledCounter`, `lastActiveDetail: string` e `lastSkippedDetail: string`. Os dois contadores nascem em `spawnWorker` (`:155`) com `createThrottledCounter(AUDIO_LOG_WINDOW_MS)`; os dois textos nascem vazios.
3. Reescrever o ramo `message.type === 'status'` do handler (`:161-166`) mantendo o comportamento de hoje como PRIMEIRA clausula e sem nenhum `else` que possa desviar dela:
   - `if (message.state === 'failed') { escalate(created, message.detail || 'motor de captura falhou'); return }` - **linha identica a de hoje** (`:162-164`).
   - `active`: guardar `created.lastActiveDetail = message.detail`; `const summary = created.activeLog.record(Date.now())`; se `summary`, `logToFile('info', ...)` na forma literal de 5.A3.
   - `skipped`: mesmo padrao com `skippedLog` e `lastSkippedDetail`.
   - `health`: `logToFile('warn', \`[audio-native] ${created.captureId} health: ${message.detail}\`)` **sem throttle** (o C++ ja limita a uma a cada 15 s, 5.C6).
   - `app-skipped`: `logToFile('warn', ...)` e, **so se `message.detail` nao for vazio**, `sendStatus({ state: 'app-not-captured', detail: message.detail, captureId: created.captureId, app: message.detail })`.
   - qualquer outro `state`: `return` sem nada (default de hoje preservado, matriz 5c).
4. **Guarda obrigatoria**: o ramo `message.type === 'fatal'` (`:167-169`) fica INALTERADO, e nenhum estado novo pode chamar `escalate`. Um `health` com numeros ruins e diagnostico, nao falha.
5. Conferir a leitura por olho: com esta feature, `sendStatus` (`:58-64`) e chamado de TRES lugares (`escalate` duas vezes e o ramo novo de `app-skipped`), e continua sendo o unico ponto que fala com o renderer.

**Edge cases** (categoria: transporte e log)
- `message.detail` vazio em `active` (acontece hoje no `Report("active", "")` de `capture_engine.cc:410`): a linha e escrita mesmo assim, com detalhe vazio - e informacao valida ("o motor subiu"). O `lastActiveDetail` guarda a string vazia.
- Rajada de `active` (um app abrindo e fechando sessao de audio varias vezes por segundo): a primeira sai na hora, as seguintes colapsam em UMA linha a cada 10 s carregando a composicao MAIS RECENTE e a contagem de mudancas suprimidas. E o comportamento desejado: quem le o log quer saber o estado atual e quantas vezes ele mexeu.
- `state` desconhecido (versao futura do addon): `return` silencioso, sem log e sem encaminhamento.
- Mensagem chegando de um worker que ja nao e o da sessao atual: `session !== created` ja barra em `:159`, INALTERADO.
- `app-skipped` com detalhe vazio: log sim, `sendStatus` nao (matriz 5c).
- Re-fork da cascata: `spawnWorker` cria contadores NOVOS, entao a primeira linha depois do re-fork sai na hora. Desejado.
- Janela do renderer destruida: `getWindow?.()?.webContents.send` (`:63`) ja e opcional em toda a cadeia, INALTERADO.

**Done when**
- `npm run typecheck`, `npm run lint` e `npx vitest run` verdes.
- Exercicio real, sem addon nativo: rodar `npm run dev` com `ZOI_DISABLE_AUDIO_EXCLUSION` **ausente** numa maquina Windows 11 com o binario nativo presente, iniciar uma transmissao com audio, parar, e abrir o arquivo do dia em `%APPDATA%/<app>/logs/zoi-<data>.log`. **Esperado**: pelo menos uma linha `[audio-exclusion] sessao ax-... iniciada em process-exclusion` e pelo menos uma linha `[audio-native] ax-... active`. Se a maquina nao tiver o binario, o exercicio aceito e o do Sprint C1 (o `audio:probe` ja imprime os `statuses`), e **esta feature nao pode ser commitada como verificada antes disso**.
- Conferencia mecanica de que a cascata nao mudou: `grep -n "escalate(" src/main/audio-exclusion.ts` continua devolvendo exatamente as mesmas 3 ocorrencias de chamada de hoje (`:163`, `:168`, `:174`) mais a definicao.
- `grep -niE "media-pull|dialback|discando de volta|na outra direcao" src/main/audio-exclusion.ts`: zero.

**Commit**: `feat(audio): persiste no log os relatorios do motor nativo e encaminha o aviso por aplicativo`
**Rollback**: reverter o commit. Nada fora deste arquivo depende dele ainda (o toast de RF-19 so entra em F1.1).

#### Feature B2.2 - Renderer: correlacao, descarte visivel e emenda sem estalo `[core]`

**Traces**: RF-01 (ponto do renderer), RF-04, RF-07, RF-08, RF-10, RF-11, RNF-05, RNF-08.

**Steps**
1. `src/renderer/src/services/audio-exclusion.ts`: acrescentar aos imports que ja existem (`:7-12`) o `AUDIO_FADE_MS` e o `AUDIO_LOG_WINDOW_MS` de `@shared/config` e o `createThrottledCounter` de `@shared/log-throttle`. `AUDIO_EXCLUSION_SAMPLE_RATE` e `AUDIO_EXCLUSION_CHANNELS` ja estao importados de `@shared/ipc` e continuam de onde estao.
2. No closure de `start()`, ao lado de `writtenFrames` (`:60`), declarar: `let pendingSkippedFrames = 0`, `let needsFadeIn = true` (o PRIMEIRO frame da track tambem nasce de um silencio), `let captureId: string | null = null` e `const dropCounter = createThrottledCounter(AUDIO_LOG_WINDOW_MS)`. Calcular uma vez `const fadeFrames = Math.max(2, Math.round((AUDIO_EXCLUSION_SAMPLE_RATE * AUDIO_FADE_MS) / 1000))` (48 a 48 kHz) e `const maxSkipFrames = Math.round((AUDIO_EXCLUSION_SAMPLE_RATE * AUDIO_MAX_SKIP_MS) / 1000)` (9 600 a 48 kHz, o teto de 3/T3).
3. Preencher `captureId` logo depois de `const result = await window.zoi.audioExclusion.start()` (`:126`), no ramo em que `result.mode !== 'unavailable'`.
4. Reescrever `writeFrame` (`:82-103`) nesta ordem exata:
   - as duas guardas de hoje (`!writer || stopped`, `:83`; `numberOfFrames` invalido, `:84-85`) ficam IDENTICAS e continuam sendo `return` mudo - elas nao representam audio perdido (matriz 5c);
   - o descarte por backpressure (`:89`) passa a ser: `pendingSkippedFrames = Math.min(pendingSkippedFrames + numberOfFrames, maxSkipFrames); needsFadeIn = true; const summary = dropCounter.record(Date.now()); if (summary) console.warn(\`[audio-drop] ${captureId ?? 'sem-sessao'} backpressure: ${summary.count} quadros em ${summary.sinceMs} ms\`); return`. **O `Math.min` e o teto de 3/T3 e nao pode ser omitido**; **a template string so e montada dentro do `if`** (risco R1). Note que `summary.count` continua contando os descartes REAIS, sem teto: so o AVANCO DO RELOGIO e limitado, nunca a contagem;
   - antes de montar o `AudioData`: `writtenFrames += pendingSkippedFrames; pendingSkippedFrames = 0`;
   - se `needsFadeIn`: `const fade = Math.min(numberOfFrames, fadeFrames)`; se `fade >= 2`, criar `const view = new Float32Array(data)` e, para `i` de 0 a `fade - 1`, multiplicar `view[i * AUDIO_EXCLUSION_CHANNELS + c]` por `i / (fade - 1)` para cada canal `c`; depois `needsFadeIn = false`. **O formato e `'f32'`, ou seja INTERLEAVED**: o quadro `i` ocupa os indices `i * 2` e `i * 2 + 1`;
   - o resto (construcao do `AudioData` com o `timestamp` ja calculado a partir do `writtenFrames` corrigido, o `writtenFrames += numberOfFrames` e o `writer.write(...).catch(...)`) fica como esta hoje (`:91-102`).
5. Atualizar o comentario de bloco de `:55-59` para registrar que o relogio agora tambem conta o que foi PULADO, e o de `:87-88` para registrar a rampa. Manter a explicacao existente de por que o `timestampUs` do worker nao e usado (e LESSONS 2026-08-25).
6. `src/renderer/src/services/media-manager.ts`: em `startTransmission`, hoistar duas variaveis ao lado de `let exclusion` (`:468`): `let exclusionReason: AudioExclusionUnavailableReason | null = null` e `let captureId: string | null = null`, preenchidas dentro do bloco de `:469-477` a partir de `outcome`. O `console.warn` de `:473-475` fica INALTERADO.
7. Mesmo arquivo, logo apos o `console.info('[codec] ...')` de `:542`, escrever a linha de estado de captura (RF-04/RF-08), nas tres formas literais de 5.A3, escolhidas por `transmission.audioMode`: `'excluded'` usa `captura=process-exclusion sessao=<captureId>`, `'full-loopback'` usa `captura=full-loopback motivo=<exclusionReason ?? 'sem-motivo'>` e `'none'` usa `captura=none`. **Uma linha por transmissao, sem throttle**: o evento e raro por definicao.

**Edge cases** (categoria: caminho quente do renderer)
- Descarte no PRIMEIRO frame de todos (writer nasce cheio): `pendingSkippedFrames` acumula e o primeiro frame ESCRITO ja sai com timestamp deslocado. Correto: o buraco existiu de verdade.
- Descartes consecutivos (10 seguidos): `pendingSkippedFrames` vira 4800 e o proximo frame escrito pula 100 ms. Correto e desejado (abaixo do teto).
- **Rajada acima do teto (1 000 descartes seguidos)**: `pendingSkippedFrames` para em `maxSkipFrames` (9 600, ou 200 ms) e o proximo frame escrito pula 200 ms, e nao 10 segundos. A contagem verdadeira (1 000) continua saindo na linha `[audio-drop]`. Comportamento declarado em 3/T3.
- `numberOfFrames` menor que `fadeFrames` (nunca acontece com 480, mas o codigo nao pode assumir): `fade = numberOfFrames`, e a rampa cobre o frame inteiro.
- `numberOfFrames === 1`: `fade` seria 1 e a divisao por `fade - 1` seria por zero. A guarda `fade >= 2` cobre; nesse caso nao ha rampa.
- `captureId` nulo (o `start()` resolveu por um caminho que nao devolveu id): a linha sai com `sem-sessao` em vez de quebrar.
- Troca de port pela cascata (`attachPort`, `:67-80`): `writtenFrames`, `pendingSkippedFrames` e `needsFadeIn` vivem no closure do `start()` e **nao sao zerados**. E exatamente o que precisa acontecer: o relogio da track e continuo por cima do re-fork (LESSONS 2026-08-25).
- `stop()` com contagem pendente: nada e escrito (3/T1, "por que nao ha flush"). Consequencia declarada.
- `audioMode: 'none'`: a linha de estado sai igual, com `captura=none`. E ela que da ao e2e uma assercao deterministica (Sprint T, T7).

**Done when**
- `npm run typecheck`, `npm run lint` e `npx vitest run` verdes; **os casos existentes de `tests/unit/audio-exclusion-client.test.ts` nao podem quebrar** (em especial os que provam o relogio monotonico atraves do re-fork).
- Exercicio (scratch test, apagado antes do commit) usando o harness que **ja existe** naquele arquivo (`FakePort`, `FakeWriter` com `desiredSize` mutavel, `FakeGenerator`) e provando a **tabela de 3/T3**: quatro entregas de 480 quadros com `desiredSize = 0` na terceira produzem exatamente tres escritas com `timestamp` 0, 10 000 e **30 000** (nunca 20 000).
- Exercicio no mesmo arquivo provando que o primeiro quadro da terceira escrita e ZERO (fade-in aplicado) e o quadragesimo oitavo tem ganho 1.
- Exercicio provando RNF-05/risco R1: 1 000 descartes seguidos produzem no maximo 2 chamadas de `console.warn`.
- `grep -niE "media-pull|dialback|discando de volta|na outra direcao"` nos dois arquivos tocados: zero.

**Commit**: `fix(audio): torna o descarte de quadro visivel e emenda o audio sem estalo apos o descarte`
**Rollback**: reverter o commit. O comportamento volta a ser o relogio colado de hoje; nada mais depende das variaveis novas.

#### Feature B2.3 - `stats-monitor`: separacao por kind e campos de audio `[core]`

**Traces**: RF-02, RF-03, RF-07, RF-08, RNF-01, RNF-05, RNF-06, RNF-08.

**Steps**
1. `src/renderer/src/services/stats-monitor.ts`: acrescentar `RtpAudioStatsEntry`, `InboundAudioStats`, `KindTotals` e o `InboundSample` novo, exatamente como o contrato 5.C4 declara. Colocar `RtpAudioStatsEntry` logo depois de `RtpVideoStatsEntry` (`:57`) e `InboundAudioStats` logo depois de `InboundVideoStats` (`:75`). **Nao renomear nada de video** (3/T4).
2. **Atualizar o comentario de ponto de extensao** (`:59-67`) para registrar que o irmao de audio nasceu neste MESMO laco, e reafirmar que continua proibido abrir coletor paralelo (RNF-06/AC-25). Esse comentario e contrato vivo do projeto.
3. Acrescentar `onInboundAudioStats?(stats: ReadonlyMap<string, InboundAudioStats>): void` em `StatsMonitorCallbacks`, ao lado do irmao opcional de video (`:86`).
4. Em `sample()` (`:140-229`), trocar os tres acumuladores soltos (`:145-147`) por `const video: KindTotals` e `const audio: KindTotals` zerados, e um `const perTxAudio = new Map<string, InboundAudioStats>()` ao lado do `perTx` de video (`:148`).
5. Dentro do `stats.forEach` que ja existe (`:153-173`), **sem abrir laco novo**: as tres somas de `:156-158` passam a escolher o alvo por `entry.kind` (`'audio'` para o conjunto de audio, qualquer outra coisa para o de video, preservando o comportamento de hoje para reports sem `kind`). Depois do `if (entry.kind !== 'video') return` de `:161`, que continua guardando o bloco de video, acrescentar ANTES dele um bloco simetrico para `kind === 'audio'` que preenche `perTxAudio` a partir de `report as RtpAudioStatsEntry` com os onze campos de `InboundAudioStats`, aplicando a regra de deduplicacao por `packetsReceived` de 5.C4.
6. Chamar `this.callbacks.onInboundAudioStats?.(perTxAudio)` logo apos o `onInboundVideoStats?.(perTx)` de `:179`.
7. Trocar, em `:207-222`, as leituras de `bytes`/`packetsLost`/`packetsReceived` pelas SOMAS dos dois `kind` e guardar o `InboundSample` novo em `this.previous`. **`onReport` (`:224-228`) nao muda uma linha.**
8. Log (RF-01 do lado de recepcao): um campo privado `private readonly audioLogByTx = new Map<string, ThrottledCounter>()`. No inicio de `sample()`, podar as chaves que nao estao mais em `connections`. Depois de montar `perTxAudio`, para cada `txId` cujo delta de `concealmentEvents`, de `packetsDiscarded` ou de `packetsLost` contra a amostra anterior daquele `txId` for maior que zero, chamar `record(Date.now())` no contador daquele `txId` e, quando houver resumo, escrever a linha `[audio-stats]` na forma literal de 5.A3. Guardar a amostra anterior por `txId` num `Map` privado irmao, podado junto.
9. `stop()` (`:132-138`) limpa os dois `Map` novos, junto do `this.previous = null` que ja existe.

**Edge cases** (categoria: coletor de estatisticas)
- Report `inbound-rtp` sem `kind` (navegador antigo ou report parcial): cai no conjunto de VIDEO, que e o comportamento de hoje (tudo somava junto). Nunca some do agregado.
- Conexao sem faixa de audio (transmissao com `audioMode: 'none'`): `perTxAudio` fica vazio para aquele `txId`, o callback e chamado com o mapa vazio, e nenhuma linha de log sai.
- Primeiro tick (sem amostra anterior): nenhum delta e calculavel, entao **nenhuma linha `[audio-stats]`**. Correto: a primeira leitura de contadores absolutos nao diz nada sobre o intervalo.
- `txId` que some no meio da sessao: podado no inicio do `sample()` seguinte, nos dois mapas.
- Dois `inbound-rtp` de audio na mesma conexao: a deduplicacao por `packetsReceived` mantem o de maior contagem.
- `getStats()` lancando: o `catch` de `:174-176` ja cobre e continua igual; os acumuladores daquela conexao ficam como estavam.
- `jitter`/`audioLevel` ausentes: gravados como `null`, nunca como `0` (zero e um valor legitimo e mentir sobre ele estragaria o diagnostico).

**Done when**
- `npm run typecheck`, `npm run lint` e `npx vitest run` verdes. **Os 12 casos existentes de `tests/unit/stats-monitor.test.ts` nao podem ser alterados nem quebrar** (risco R12): `onInboundAudioStats` e opcional e o agregado de `onReport` e identico por soma.
- Exercicio (scratch test, apagado antes do commit) alimentando UMA conexao com dois reports `inbound-rtp`, um de `kind: 'video'` (`bytesReceived: 1000`, `packetsLost: 2`, `packetsReceived: 100`) e um de `kind: 'audio'` (`bytesReceived: 200`, `packetsLost: 1`, `packetsReceived: 50`), e provando as duas coisas ao mesmo tempo: (a) `onInboundAudioStats` recebe uma entrada com `packetsReceived: 50` e `bytesReceived: 200`, separada do video; (b) o `packetLoss` que chega em `onReport` no segundo tick e calculado sobre os TOTAIS (`3` perdidos e `150` recebidos), exatamente como antes desta feature.
- Exercicio provando que uma conexao saudavel (deltas zerados) nao gera nenhuma linha `[audio-stats]`.
- `grep -n "setInterval\|new StatsMonitor" src/renderer/src/services/stats-monitor.ts`: continua existindo exatamente UM `setInterval` (`:127`), prova mecanica de RNF-06/AC-25.
- `grep -niE "media-pull|dialback|discando de volta|na outra direcao" src/renderer/src/services/stats-monitor.ts`: zero.

**Commit**: `feat(audio): separa as estatisticas por kind e coleta os campos de audio do webrtc`
**Rollback**: reverter o commit. `onInboundAudioStats` nao tem consumidor de producao (o log sai do proprio monitor), entao a reversao nao deixa ponta solta.

---

### Sprint C1 - Motor nativo (C++, exige rebuild)

> **Regra deste sprint (nao negociavel, risco R11).** Toda feature aqui termina com `npm rebuild zoi-audio-capture --foreground-scripts`, conferencia de que o mtime de `native/zoi-audio-capture/build/Release/zoi_audio_capture.node` avancou, e `npm run audio:probe`. Sem os tres, **nao commite**: reporte o estado. Ler o codigo e concluir que "esta certo" nao e exercicio (LESSONS 2026-08-25).

#### Feature C1.1 - Rampa de 1 ms e contadores de saude no mixer `[core]`

**Traces**: RF-01 (underrun), RF-09, RF-11, RNF-03.

**Steps**
1. `native/zoi-audio-capture/src/mixer.h`: acrescentar `#include <atomic>`; declarar `struct MixerHealth` exatamente como 5.C2, com os comentarios por campo; acrescentar `MixerHealth TakeHealth();` **e `bool HasUnderrun() const;`** ao publico do `Mixer` (o segundo existe para o `Engine` checar o gatilho sem drenar, 5.C6); acrescentar os privados `size_t fadeFrames_ = 0;`, `std::vector<uint8_t> sourceSilenced_;`, `std::vector<float> lastFrame_;` e os tres `std::atomic<uint64_t> underrunTicks_{0}; underrunFrames_{0}; silentTicks_{0};`. Atualizar o comentario de cabecalho do arquivo (`:1-5`) para registrar a rampa: **emitir sempre um frame continua sendo a regra; o que muda e que uma fonte nunca entra nem sai do silencio por degrau**.
2. `native/zoi-audio-capture/src/mixer.cc`: no bloco anonimo (junto de `Clamp`, `:14-18`), acrescentar `constexpr uint32_t kFadeMs = 1;` com o comentario apontando para `AUDIO_FADE_MS` em `src/shared/config.ts` (5b).
3. Em `Mixer::Start` (`:82-118`), depois de calcular `framesPerTick_` (`:87`), calcular `fadeFrames_` = `format_.sampleRate * kFadeMs / 1000`, com piso 2 e teto `framesPerTick_`.
4. Em `Mixer::SetSources` (`:139-142`), dentro do lock que ja existe, redimensionar e **zerar** `sourceSilenced_` (tamanho de `sources_`) e `lastFrame_` (tamanho `sources_.size() * format_.channels`).
5. Em `Mixer::Run` (`:144-178`), dentro do bloco que ja segura `sourcesMutex_` (`:156-167`), trocar o `for (AudioRingBuffer* source : sources_)` por um laco INDEXADO (o indice e necessario para chegar em `sourceSilenced_` e em `lastFrame_`). Por fonte, na ordem EXATA:
   - `const size_t frames = sources_[index]->Read(scratch.data(), framesPerTick_);` (a linha `:160` de hoje);
   - **se `frames == 0`**: se `sourceSilenced_[index]` era `0`, escrever a **cauda de decaimento** (caso 3 de 5.C2) nos primeiros `fadeFrames_` quadros de `scratch` a partir de `lastFrame_[index]`, somar essas `fadeFrames_ * channels` amostras em `mixed` e marcar `sourceSilenced_[index] = 1`; se ja era `1`, apenas `continue` (nada a somar). **Em nenhum dos dois casos `underrunTicks_`/`underrunFrames_` sao tocados** (ver passo 6);
   - **se `frames > 0`**: guardar o quadro `frames - 1` de `scratch` em `lastFrame_[index]` **ANTES** de qualquer rampa; aplicar o fade-in (caso 1) se `sourceSilenced_[index]` era `1`; aplicar o fade-out (caso 2) se `frames < framesPerTick_`; marcar `sourceSilenced_[index] = (frames < framesPerTick_) ? 1 : 0`; e entao a soma de `:162-164`, **inalterada**.
   As tres rampas seguem a formula literal de 5.C2, **com os `static_cast<float>` escritos como estao la** (sem eles a divisao e inteira e o ganho vira zero).
6. Contadores, no mesmo laco, com a contabilidade literal de 5.C2: **somente quando `0 < frames < framesPerTick_`**, incrementar `underrunFrames_` em `framesPerTick_ - frames` e marcar um flag local de "houve underrun neste tique". Depois do laco: se o flag estiver marcado, `underrunTicks_ += 1` (uma vez por tique, nao por fonte); se NENHUMA fonte devolveu quadro, `silentTicks_ += 1`. **`frames == 0` NUNCA conta como underrun** - e o estado normal de um aplicativo que nao esta tocando nada, e conta-lo faria o relatorio `health` disparar a cada 15 s para sempre, contradizendo o Done when de C1.2 e o item de T2.
7. Implementar `MixerHealth Mixer::TakeHealth()` com tres `exchange(0)` e `bool Mixer::HasUnderrun() const` com um `underrunTicks_.load() > 0` (sem drenar nada).
8. **Nao tocar** em `AudioRingBuffer` (`:26-72`), no `Clamp` (`:169-171`), no calculo de `timestampUs` (`:173-174`) nem na chamada de `sink_` (`:175-176`).

**Edge cases** (categoria: DSP em tempo real)
- `sources_` vazio: o laco nao roda, `silentTicks_` incrementa, `mixed` continua todo zero e o frame **e emitido do mesmo jeito** (RF-11/AC-10). Nenhum caminho novo pula a emissao. E, como `silentTicks_` nao e gatilho, isso **nao** gera linha de `health`.
- Aplicativo parado por horas (o caso mais comum de todos): todo tique tem `frames == 0`, `silentTicks_` sobe, `underrunTicks_` fica em zero e **nenhuma linha `health` e escrita**. Este e o edge case que a contabilidade de 5.C2 existe para proteger.
- **Drenagem exata na fronteira do tique**: tique cheio seguido de tique com `frames == 0`. A cauda de decaimento (caso 3) cobre; sem ela seria amplitude total para silencio absoluto, a mesma classe de clique que a feature corrige (3/T2, W4).
- Captura REMOVIDA da composicao (`PublishSources` depois de um `Reconcile` que fechou um `CaptureStream`): o ponteiro some do vetor e nao ha tique em que a cauda possa ser emitida. **Limitacao declarada, nao tratada** (3/T2 e risco R4), justificada por frequencia: composicao muda algumas vezes por sessao, underrun acontece por tique.
- `SetSources` chamado no meio de um tique: impossivel, os dois seguram `sourcesMutex_`. Os vetores novos entram zerados, entao a fonte nova sobe com rampa e o `lastFrame_` dela comeca em zero (a cauda dela, se vier antes de qualquer leitura, e uma rampa de zero para zero, ou seja inofensiva).
- `frames == framesPerTick_` (caminho feliz, a esmagadora maioria dos tiques): nenhuma rampa, nenhum contador, custo alem da soma e uma comparacao, um teste de bit e a copia de 2 floats para `lastFrame_`.
- `frames` pequeno (por exemplo 30, menor que `2 * fadeFrames_ = 96`) com fade-in E fade-out no mesmo tique: as regioes se sobrepoem e o resultado e um pico atenuado. Aceito por 5.C2.
- `format_.sampleRate` muito baixo (8 000, o minimo aceito em `addon.cc:253`): `fadeFrames_` daria 8; o piso de 2 nao chega a agir e a rampa fica curta mas valida.
- `frames == 1`: `fade` seria 1 e a divisao por `fade - 1` explodiria. A guarda `fade >= 2` de 5.C2 cobre.
- Overflow dos contadores: `uint64_t` a 100 tiques por segundo nao estoura em nenhum horizonte real.
- `TakeHealth()` concorrente com o tique: os tres campos sao atomicos e a leitura e `exchange`; no pior caso um evento cai na janela seguinte, que e irrelevante para diagnostico.

**Done when**
- Rebuild feito e conferido (regra do sprint).
- `npm run audio:probe` roda ate o fim e o item de captura continua **verde**: o motor abre, captura o processo permitido e nao captura o proibido. **Uma regressao aqui e regressao de `app-audio-capture` (RNF-03) e bloqueia o commit.**
- Exercicio de leitura dirigido, registrado no corpo do commit: confirmar no codigo compilado que `sink_` continua sendo chamado exatamente uma vez por volta do `while` e que nenhum `continue` novo fica ANTES dele (RF-11).
- `npm run typecheck`, `npm run lint` e `npx vitest run` verdes (nao devem ser afetados, mas o projeto exige a suite verde a cada commit, RNF-09).

**Commit**: `fix(audio): aplica rampa de 1 ms na entrada e na saida do silencio de cada fonte do mixer`
**Rollback**: reverter o commit e rebuildar. O mixer volta ao corte seco de hoje.

#### Feature C1.2 - Contadores, composicao e sessoes recusadas chegam ao canal de status `[core]`

**Traces**: RF-01 (fila da TSFN), RF-06, RF-07, RF-17, RF-19 (emissao), RF-22, RNF-08.

**Steps**
1. `native/zoi-audio-capture/src/addon.cc`: aplicar as tres mudancas de 5.C6 (criar o `shared_ptr<atomic<uint64_t>>`, contar no `if (status != napi_ok)` de `:311`, injetar com `SetPcmDropCounter` antes do `Start` de `:326`). O comentario de `:310` passa a dizer que o descarte continua sendo a escolha certa **e agora e contado**.
2. `native/zoi-audio-capture/src/capture_engine.h`: acrescentar `#include <unordered_map>`; declarar o publico `SetPcmDropCounter` e os privados `ReportRaw`, `ReportHealth`, `DescribeSkipped(const ProcessSnapshot&, size_t seenCount)`, a `struct SkipEntry`, mais os seis campos de 5.C6 (`pcmDropCounter_`, `engineStartedAt_`, `lastHealthAt_`, `lastSkippedSignature_`, `warnedApps_` como `unordered_map`, `skipped_`).
3. `native/zoi-audio-capture/src/capture_engine.cc`: no bloco anonimo, acrescentar `constexpr ULONGLONG kHealthReportIntervalMs = 15000;`, `constexpr ULONGLONG kAppSkippedReplayMs = 10000;`, `constexpr ULONGLONG kAppSkippedReplayWindowMs = 60000;` e o enum de arquivo `enum SkipReason { kForbiddenTree = 0, kForbiddenSubtree = 1, kActivationFailed = 2 };` com uma funcao `const char* SkipReasonText(int reason)` devolvendo os textos literais da tabela de 5.A1.
4. Implementar `ReportRaw` (chama `statusSink_` direto, **sem** tocar em `lastState_`) e `SetPcmDropCounter`.
5. Implementar `ReportHealth` com **os cinco passos na ordem literal de 5.C6**: janela; gatilho por PEEK (`mixer_.HasUnderrun()` ou `pcmDropCounter_->load() > 0`), saindo **sem drenar e sem atualizar `lastHealthAt_`** quando nao vale a pena; so entao drenar `mixer_.TakeHealth()` e `pcmDropCounter_->exchange(0)`; e reportar `underruns=<T> quadros=<F> mudos=<S> descartes-tsfn=<D>` (**QUATRO** campos). Usar `snprintf` num buffer local, como `FormatHr` (`:22-27`) ja faz. **`mudos` entra no texto mas NUNCA no gatilho**: tique mudo e o estado normal de um aplicativo parado, e coloca-lo no gatilho faria `health` sair a cada 15 s para sempre em toda maquina, contradizendo o Done when abaixo e o item de T2.
6. Gravar `engineStartedAt_ = GetTickCount64()` no inicio de `RunControlThread`, antes do `while` de `:413`, e chamar `ReportHealth()` dentro do laco, depois do `Reconcile`/`ReconcileEndpoint` de `:417-425`.
7. Em `Engine::Reconcile` (`:436-521`): `skipped_.clear()` logo apos o `Refresh` de `:437`; registrar `{pid, motivo, hr}` nos tres pontos de recusa (`:452`, `:475`, `:509-512`), guardando o HRESULT no caso de ativacao. Depois do bloco de `changed` (`:517-520`), montar `DescribeSkipped(*snapshot, sessionPids.size())`, comparar com `lastSkippedSignature_`, e se mudou emitir `ReportRaw("skipped", ...)` e guardar - **este caminho e incondicional e e o log de RF-22**. Em seguida, para cada recusa de motivo AVISAVEL (`kForbiddenSubtree` e `kActivationFailed`, **nunca** `kForbiddenTree`), aplicar o bloco de decisao literal de 5.C6 (`novo || podeRepetir`), que emite `ReportRaw("app-skipped", <basename do exe do snapshot>)` na primeira vez **e REEMITE a cada `kAppSkippedReplayMs` enquanto a recusa persistir, durante os primeiros `kAppSkippedReplayWindowMs` de vida do motor**. Sem essa reemissao o toast de RF-19 **nunca chega ao usuario** no cenario relatado (3/T10): o primeiro `Reconcile` roda em `:405-406`, muito antes de o `RoomScreen` assinar o `onStatus`.
8. Implementar `DescribeSkipped(const ProcessSnapshot& snapshot, size_t seenCount)` no molde EXATO de `DescribeAnchors` (`:523-536`): prefixo `vistas=<seenCount>` - **a contagem de sessoes ENUMERADAS, que vem de `sessionPids.size()` (`:439`) e NAO de `skipped_.size()`**, que e a contagem de recusas (W1) -, ate 10 entradas `<pid>:<exe>=<motivo>`, depois `...`. Usar `snapshot.Find(pid)` e `ToUtf8(entry->exeName)` como `DescribeAnchors` ja faz, com `?` quando o processo nao esta no snapshot.
9. Acrescentar `endpoints=<M>` ao `detail` de `DescribeAnchors`, logo depois de `capturas=<N>` (a contagem vem de `scanner_.DescribeEndpoints()`, criado em C1.3; **se C1.3 ainda nao foi implementada, este passo fica para ela** e o `detail` sai sem o campo). Ver a nota de ordem abaixo.
10. **Nao tocar** em `Report` (`:378-382`), em `escalate` do lado TS, nem nos pontos que emitem `failed` (`:399`, `:548`, `:556`).

> **Nota de ordem entre C1.2 e C1.3.** O passo 9 e o unico ponto de acoplamento entre as duas. Implementar C1.2 primeiro e deixar o `endpoints=<M>` para C1.3 e o caminho recomendado (commit menor, sem dependencia). Se o agente preferir fazer C1.3 antes, o passo 9 vem junto e C1.2 nao precisa mencionar endpoints. **O que nao pode e o `detail` de `active` prometer `endpoints=` num commit em que `DescribeEndpoints` ainda nao existe.**

**Edge cases** (categoria: motor nativo e canal de status)
- Fila de status cheia (16 posicoes, `addon.cc:290`): `NonBlockingCall` devolve erro e a mensagem e deletada (`:323`), como hoje. Com os limites de 5.A1 (uma a cada 15 s, mais mudancas de composicao), encher 16 posicoes exige o thread do JS travado por segundos, cenario em que perder uma linha de diagnostico e o menor dos problemas.
- Nenhuma recusa numa maquina com sessoes ativas: `DescribeSkipped` devolve so `vistas=<N>` sem nenhuma entrada, o que difere da assinatura vazia inicial, entao **uma** linha sai e nenhuma depois enquanto `N` nao mudar. Aceitavel e informativo.
- **Recusa que persiste os 60 s inteiros**: no maximo 6 emissoes de `app-skipped` daquela chave (uma inicial mais 5 reemissoes a cada 10 s), depois nenhuma. Ja contabilizado na tabela de 3/T1.
- **Recusa que aparece depois dos 60 s** (aplicativo aberto no meio da transmissao): chave nova, emissao imediata, sem reemissao. Correto: nesse instante o `RoomScreen` ja esta assinado ha muito tempo.
- Motor re-forkado pela cascata: `Engine` novo, `warnedApps_` vazio e `engineStartedAt_` novo, entao a janela de reemissao recomeca. Desejado: o assinante do renderer tambem pode ter mudado.
- Discord aberto o tempo todo: entra em `skipped` com `arvore-proibida`, a assinatura fica estavel e **uma** linha sai. Nunca vira `app-skipped` (risco R9).
- Discord fechado e reaberto: PID novo, assinatura nova, uma linha nova. Correto.
- `StartProcessInclude` falhando repetidamente para o mesmo PID (a cada volta de 1 s): `warnedApps_` barra o `app-skipped` depois do primeiro, e a assinatura de `skipped` nao muda, entao nao ha enxurrada.
- `pcmDropCounter_` nulo (nunca acontece pelo caminho do `addon.cc`, mas o `Engine` e uma classe): `ReportHealth` checa antes de desreferenciar.
- Modo `endpoint-loopback`: `Reconcile` nao roda, entao nao ha `skipped` nem `app-skipped`; `ReportHealth` roda igual e continua reportando underrun e descarte, que existem nos dois modos.
- `Stop()` no meio de um `ReportHealth`: `statusSink_` e zerado em `:374` depois do `join` da thread de controle (`:362`), entao a ordem ja garante que nao ha chamada em voo.

**Done when**
- Rebuild feito e conferido (regra do sprint).
- `npm run audio:probe` roda ate o fim e o JSON de saida contem, em `statuses`, **pelo menos um `state: 'active'` com `detail` comecando por `capturas=`**. Se a maquina tiver o Discord aberto, conferir tambem uma entrada `skipped` com `arvore-proibida` e **nenhuma** entrada `app-skipped` para ele (risco R9, verificacao direta).
- Exercicio dirigido de `health`: rodar o probe com um aplicativo PARADO (sem tocar nada) por pelo menos 60 s e conferir que **nenhuma** linha `health` aparece em `statuses`. A ausencia e o resultado esperado e e a prova de que tique mudo nao entra no gatilho (B2): se aparecer uma linha `health` a cada 15 s com `underruns=0`, a contabilidade do passo 6 de C1.1 esta errada e o commit esta bloqueado.
- Exercicio dirigido da REEMISSAO (3/T10): com um cenario que produza uma recusa avisavel, conferir em `statuses` que a MESMA entrada `app-skipped` aparece mais de uma vez dentro do primeiro minuto (uma a cada ~10 s) e para de aparecer depois. Se aparecer uma unica vez, a reemissao nao foi implementada e o toast de RF-19 nunca chegara ao usuario.
- `npm run typecheck`, `npm run lint` e `npx vitest run` verdes.

**Commit**: `feat(audio): reporta composicao, sessoes recusadas e contadores de saude do motor nativo`
**Rollback**: reverter o commit e rebuildar. Os relatorios somem e o main volta a nao ter o que logar; o `worker.on('message')` de B2.1 simplesmente para de receber os estados novos, sem erro.

#### Feature C1.3 - Enumeracao de sessoes em todos os endpoints de render ativos `[core]`

**Traces**: RF-17, RF-18, RF-20, RF-21, RF-23, RNF-03.

**Steps**
1. `native/zoi-audio-capture/src/session_tracker.h`: declarar `struct EndpointBinding` (5.C5); trocar os campos `device_`/`manager_`/`sessionNotifier_` (`:112-114`) por `std::vector<EndpointBinding> endpoints_;`; declarar `std::string DescribeEndpoints() const;`. Atualizar o comentario de cabecalho (`:6-7`, "quais PIDs tem sessao de audio no endpoint de render padrao") para dizer **endpoints de render ATIVOS**, e registrar em uma frase por que: uma sessao roteada para outro dispositivo ou outra role era invisivel, e essa e uma das causas candidatas do sintoma de aplicativo mudo.
2. `native/zoi-audio-capture/src/session_tracker.cc`: no bloco anonimo, `constexpr size_t kMaxScannedEndpoints = 8;`.
3. Reescrever `Reopen()` (`:234-260`) com os sete passos literais de 5.C5, **incluindo os DOIS niveis do degrau de seguranca do passo 6**. O nivel 6a nao e opcional: ele roda quando o dispositivo padrao nao foi vinculado, **mesmo com `endpoints_` ja cheio de outros dispositivos**. Sem ele, um `Activate` que falhasse so no padrao enquanto outro dispositivo funcionasse faria o unico endpoint que a versao anterior escaneava sumir sem erro e sem log, o que e pior que a falha que o codigo de hoje reporta como `failed` (N5, risco R7). **Cada `IMMDevice::GetId` precisa de `CoTaskMemFree` em todos os caminhos de saida** (5.C5 passo 3).
4. Reescrever `ListSessionPids` (`:277-310`) com a uniao de 5.C5: o `std::unordered_set<DWORD> seen` (`:289`) sai para FORA do laco de endpoints e o corpo de `:281-307` vira o corpo interno. As cinco guardas por sessao (`GetSession`, `As<IAudioSessionControl2>`, `IsSystemSoundsSession`, `AudioSessionStateExpired`, `GetProcessId`) ficam IDENTICAS.
5. Ajustar `Close()` (`:262-275`) para desregistrar o notifier de cada binding e limpar `endpoints_`.
6. Implementar `DescribeEndpoints()` (a contagem) e `DefaultEndpointBound()` (o flag do passo 7 de 5.C5), e ligar os dois em `Engine::DescribeAnchors`: `endpoints=<M>` sempre, e `padrao=nao` **somente quando `DefaultEndpointBound()` for falso** (passo 9 de C1.2, se ainda nao foi feito). E a unica forma de o log de campo mostrar que a captura esta rodando SEM o dispositivo padrao do sistema.
7. **Nao tocar** em `GetDefaultDevice()` (`:312-315`): o modo `endpoint-loopback` continua no dispositivo padrao do sistema (5.C5).
8. **Nao tocar** em `Engine::Reconcile`: os passos 1, 2 e 3 (`capture_engine.cc:448-477`) e a regra de ancora ficam identicos. A unica coisa que muda e o tamanho da lista que chega em `sessionPids` (`:439-444`). Isso e o que preserva RF-21 por construcao.

**Edge cases** (categoria: COM e enumeracao de dispositivos)
- Maquina com UM dispositivo de saida: `EnumAudioEndpoints` devolve 1, que e o mesmo do `GetDefaultAudioEndpoint`. Comportamento identico ao de hoje.
- Maquina com muitos dispositivos virtuais (HDMI por monitor, cabo de audio, placa de captura): a lista e truncada em 8, **com o padrao de console garantidamente no indice 0** (5.C5 passo 4). O dispositivo que funciona hoje nunca e cortado.
- `EnumAudioEndpoints` falha: cai no degrau de seguranca (passo 6) e o comportamento e o de hoje.
- `Activate(IAudioSessionManager2)` falha em UM dispositivo SECUNDARIO (driver com problema): `continue`; os outros continuam. Nunca derruba o motor.
- **`Activate` falha no dispositivo PADRAO enquanto outro funciona**: o passo 6a tenta o caminho explicito de hoje; se conseguir, o padrao entra na posicao 0; se nao, `endpoints_` fica so com os outros, `DefaultEndpointBound()` fica falso e o `detail` de `active` passa a carregar `padrao=nao`. **O que nao pode acontecer e o padrao sumir em silencio** (N5).
- **`Activate` falha no padrao e nao ha nenhum outro**: `endpoints_` vazio depois de 6a, `Reopen` devolve o HRESULT e `RunControlThread` (`:397-402`) reporta `failed`, exatamente como hoje.
- `RegisterSessionNotification` falha num binding: o binding fica sem notifier e a deteccao de sessao nova naquele dispositivo passa a depender so do poll de 1 s (`kReconcileIntervalMs`), que **ja e a rede de seguranca declarada** em CONTEXT 4.D pergunta 3. Degradacao suave, nunca perda.
- Troca do dispositivo padrao no meio da transmissao: o `DeviceNotifier` (`:184-208`) ja acorda a thread de controle e `RunControlThread:420` ja chama `Reopen()`, que agora reabre a lista inteira. Caminho ja existente, sem mudanca.
- O MESMO processo com sessao em DOIS dispositivos: o `seen` deduplica pelo PID e uma unica ancora e aberta. Correto: o `PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE` captura o que o processo renderiza, nao o que um dispositivo toca.
- Aplicativo aberto DEPOIS do inicio da transmissao (RF-20/AC-19): mesmo caminho de sempre (`OnSessionCreated` naquele endpoint, ou o poll de 1 s), agora tambem para os endpoints que antes eram invisiveis.
- Aplicativo em modo EXCLUSIVO do WASAPI: **continua invisivel, por decisao** (RF-23). Nao ha passo nenhum nesta feature tentando detectar isso, e a limitacao vai para as notas da release.

**Done when**
- Rebuild feito e conferido (regra do sprint).
- `npm run audio:probe` roda ate o fim e o item de captura continua **verde** (nao regrediu). O `detail` de `active` nos `statuses` passa a conter `endpoints=<M>` com `M >= 1`.
- Exercicio dirigido na maquina de dev: rodar o probe com um segundo dispositivo de saida presente (ou com o HDMI de um monitor ativo) e conferir que `M` reflete a contagem real de dispositivos de render ativos, e nao 1 fixo.
- Exercicio de nao-regressao do proibido: o item do probe que prova "nao captura o proibido" continua verde. **E o unico item que, se falhar, significa que a ampliacao vazou audio proibido** e bloqueia o commit.
- `npm run typecheck`, `npm run lint` e `npx vitest run` verdes.

**Commit**: `feat(audio): enumera sessoes em todos os endpoints de render ativos, nao so no padrao`
**Rollback**: reverter o commit e rebuildar. A enumeracao volta ao `eConsole` unico de hoje.

---
## Frontend

### Sprint F1 - Eficacia do aviso de captura

#### Feature F1.1 - Redacao, tom, duracao e o aviso por aplicativo `[frontend]`

**Traces**: RF-13, RF-14, RF-15, RF-16, RF-19 (interface), RF-23 (a nota de release), RNF-08, RNF-10.

**Steps**
1. Criar `src/renderer/src/ui/screens/audio-copy.ts` com o conteudo literal do contrato 5.C3, incluindo o cabecalho de comentario e os comentarios por chave. **O arquivo nao tem nenhum `import`.**
2. `src/renderer/src/store/app-store.ts`: acrescentar `ttlMs?: number` em `ToastItem` (`:10-14`) com o comentario "duracao propria; ausente usa `TOAST_TTL_MS`"; acrescentar `export const TOAST_TTL_LONG_MS = 12_000` logo abaixo de `TOAST_TTL_MS` (`:17`) com o comentario de 3/T6 (quatro segundos e o tempo de NOTAR um aviso; doze e o de LER duas frases); trocar a assinatura de `pushToast` (`:60`) para `(tone: ToastTone, text: string, ttlMs?: number) => void` e a implementacao (`:89-95`) para empilhar `{ id: toastSeq, tone, text, ttlMs }`. O teto de 5 (`slice(-5)`, `:94`) fica INALTERADO.
3. `src/renderer/src/ui/components/Toast.tsx`: no `useEffect` de `:9-12`, trocar `TOAST_TTL_MS` por `toast.ttlMs ?? TOAST_TTL_MS` e acrescentar `toast.ttlMs` ao array de dependencias. Atualizar o comentario de `:1-2` ("auto-dismiss em 4s") para dizer que o padrao e 4 s e que um toast pode pedir mais. Nenhuma mudanca de marcacao nem de classe.
4. `src/renderer/src/ui/screens/RoomScreen.tsx`: importar `AUDIO_CAPTURE_COPY` e `TOAST_TTL_LONG_MS`.
5. Mesmo arquivo, aviso de INICIO (`:206-216`): trocar as duas strings inline pelas chaves da copy - o ramo de `:206-210` passa a usar `AUDIO_CAPTURE_COPY.noAudio` com o MESMO tom `'warning'` (texto identico, so mudou de lugar), e o ramo de `:211-216` passa a `pushToast('danger', AUDIO_CAPTURE_COPY.fullLoopbackStart, TOAST_TTL_LONG_MS)`. **A CONDICAO dos dois ramos (`choice.withAudio && !transmission.hasAudio`, e o `else if (transmission.audioMode === 'full-loopback')`) nao muda.**
6. Mesmo arquivo, aviso de RUNTIME (`:113-131`): os dois ramos existentes (`:119-123` e `:124-129`) trocam as strings inline por `AUDIO_CAPTURE_COPY.degradedRuntime` e `AUDIO_CAPTURE_COPY.failedRuntime`, **mantendo tom `'warning'` e condicao IDENTICOS** (AC-15). Acrescentar um TERCEIRO ramo, depois deles: `else if (status.state === 'app-not-captured') { pushToast('warning', AUDIO_CAPTURE_COPY.appNotCaptured(status.app)) }`.
7. **Ordem da deduplicacao, obrigatoria.** O guarda de hoje (`:117-118`) consome a chave ANTES de qualquer ramo: `if (alreadyWarned.has(status.state)) return; alreadyWarned.add(status.state)`. Com o estado novo isso vira um defeito real: um `app-not-captured` que chegue com `app` vazio queimaria a chave `'app-not-captured'` e **suprimiria para sempre** a reemissao seguinte, que viria com o nome preenchido - e a reemissao de 3/T10 e justamente o que faz o aviso funcionar. Correcao: acrescentar, como PRIMEIRA linha do callback (`:117`, **antes** do `alreadyWarned.has`), o descarte `if (status.state === 'app-not-captured' && !status.app) return`. **As duas linhas de deduplicacao ficam onde estao, sem alteracao**, e o comportamento dos dois estados existentes fica identico ao de hoje (AC-15); so um status que de fato vai gerar toast passa a consumir a chave.
8. Notas de release (RF-23/AC-32 e riscos R6 e R14): acrescentar ao rascunho de notas da versao os tres pontos, em pt-BR sem acento: (a) o audio de um aplicativo em modo EXCLUSIVO do WASAPI nunca entra na transmissao, em nenhum dos modos de captura, e o app nao tem como detectar isso; (b) uma sessao de audio que viva fora dos dispositivos de render ATIVOS do sistema continua invisivel; (c) a captura por aplicativo passou a enxergar sessoes em todos os dispositivos de saida ativos, e nao so no padrao, entao pode entrar audio de aplicativo que antes ficava de fora (Discord e o proprio Zoi continuam sempre excluidos).

**Edge cases** (categoria: interface e copy)
- `status.app` nulo ou vazio: nenhum toast E **a chave de deduplicacao nao e consumida** (passo 7). O main ja nao encaminha nesse caso (matriz 5c), entao esta e a segunda rede; o que ela protege e a reemissao seguinte, que viria com o nome preenchido.
- Reemissao de `app-skipped` chegando depois de o toast ja ter aparecido (3/T10): `alreadyWarned` ja tem a chave e o callback sai no `return` de `:117`. **Um toast por transmissao**, quantas reemissoes venham.
- Dois aplicativos recusados na mesma transmissao: **so o primeiro vira toast** (o `alreadyWarned` e por `state`). Consequencia declarada em risco R8 e em Q2; os dois aparecem no log.
- `app-not-captured` chegando quando o `audioMode` nao e `'excluded'`: o efeito nem esta assinado (`excludedTxId`, `:112`).
- Toast com `ttlMs` chegando junto de toasts normais: cada `ToastRow` tem o proprio `setTimeout`, entao um toast de 12 s convive com um de 4 s sem nenhuma coordenacao.
- Cinco toasts na tela e o de vazamento e o sexto: o `slice(-5)` (`:94`) descarta o mais VELHO, entao o mais novo (o de vazamento) sobrevive. Comportamento de hoje, favoravel neste caso.
- `prefers-reduced-motion`: nao ha animacao nova; o bloco global do `theme.css` continua valendo sem nenhuma linha desta feature.
- Texto longo no toast: `fullLoopbackStart` tem duas frases. O container do toast ja quebra linha (nao ha `white-space: nowrap` no padrao usado hoje). **Conferencia obrigatoria no exercicio com render**, e nao por leitura.

**Done when**
- `npm run typecheck`, `npm run lint` e `npx vitest run` verdes.
- **Exercicio COM RENDER, obrigatorio** (LESSONS 2026-08-25, "para o frontend o exercicio inclui ver a coisa RENDERIZADA"): rodar `npm run dev` com `ZOI_DISABLE_AUDIO_EXCLUSION=1` (que forca deterministicamente o `audioMode: 'full-loopback'`), criar uma sala, transmitir um monitor **com o toggle de audio LIGADO**, e conferir com os proprios olhos: (a) o toast aparece com o tom `danger`; (b) o texto completo cabe, quebra linha e nao e cortado; (c) ele permanece na tela por volta de 12 s, nao 4.
- Exercicio de nao-regressao dos dois avisos de runtime: conferir por leitura lado a lado que `AUDIO_CAPTURE_COPY.degradedRuntime` e `AUDIO_CAPTURE_COPY.failedRuntime` sao IDENTICOS, caractere a caractere, aos textos de `RoomScreen.tsx:122` e `:127` antes desta feature (usar `git diff` para conferir que as strings so mudaram de arquivo).
- `grep -c "pushToast(" src/renderer/src/ui/screens/RoomScreen.tsx`: exatamente UMA chamada a mais do que antes desta feature (o ramo novo de `app-not-captured`), prova mecanica de que nenhum segundo aviso paralelo foi criado para o cenario de sistema-inteiro (AC-13).

**Commit**: `feat(audio): reescreve o aviso de captura do sistema inteiro e avisa quando um aplicativo fica de fora`
**Rollback**: reverter o commit. Os textos voltam para dentro do `RoomScreen`, o toast volta a 4 s e o ramo novo some; nada mais depende de `audio-copy.ts`.

---

### Sprint T - Testes (DEFINIDOS aqui, ESCRITOS no sprint de testes)

Comandos: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run test:e2e`.
**Toda execucao de Playwright roda MUDA** (RNF-11/AC-33): os specs usam `launchInstance` do helper, que ja passa `--mute-audio` (`tests/e2e/helpers/zoi-app.ts:286`) e semeia `soundVolume: 0` (`:86`). Nenhum spec pode subir o app por outro caminho, e **nenhum teste desta feature reproduz tom audivel**.

**T1. `tests/unit/log-throttle.test.ts` (NOVO)** - `@shared/log-throttle`, RF-07/RNF-01/AC-06. Sem `vi.useFakeTimers`: o `now` e argumento.
- O **exemplo trabalhado de 5.C1**, literal: janela 10 000; `record(0)` devolve `{ count: 1, sinceMs: 0 }`; as 999 chamadas de `record(10)` a `record(9990)` devolvem `null`; `record(10_000)` devolve exatamente `{ count: 1000, sinceMs: 10_000 }`. **Este caso falha se alguem trocar a semantica de "acumula e resume" por amostragem.**
- Segunda janela: `record(10_010)` devolve `null`; `record(20_000)` devolve `{ count: 2, sinceMs: 10_000 }`.
- Primeira ocorrencia SEMPRE sai: um contador recem-criado emite no primeiro `record`, qualquer que seja o `now`.
- `record` duas vezes com o mesmo `now` inicial: a segunda devolve `null`.
- Fronteira exata: `record(10_000)` emite (`>=`), `record(9_999)` nao.
- `flush` sem pendencia devolve `null`; `flush` com 3 pendentes devolve `{ count: 3, sinceMs: <delta> }` e o `flush` seguinte devolve `null`.
- `createThrottledCounter(0)` emite em toda chamada; `createThrottledCounter(-1)` idem. Nenhum lanca.
- Relogio para tras: depois de `record(20_000)`, um `record(100)` devolve `null` e nao trava; o `record(30_000)` seguinte volta a emitir.
- **Sem `Date.now`**: caso que congela `Date.now` com `vi.spyOn` e prova que ele **nao e chamado** durante 50 `record`.

**T2. Verificacao do motor nativo (`npm run audio:probe`, NAO automatizavel em Vitest)** - RNF-07/AC-26, RF-09/AC-08, RF-11/AC-10, RF-06/AC-05, RF-22/AC-31, RF-18, RF-21/AC-20.
`tests/unit` e typechecado pelo projeto WEB e roda em node sem Electron: **nao existe caminho para um teste de Vitest carregar o addon nativo**. Os itens abaixo sao executados a mao, pelo probe, e o resultado vai no checklist manual desta feature:
- Captura do permitido e ausencia do proibido continuam verdes (nao-regressao de `app-audio-capture`, RNF-03). **Este e o item bloqueante.**
- `statuses` contem `active` com `detail` comecando por `capturas=` e com `endpoints=<M>`, `M >= 1` (RF-06/AC-05).
- Com o Discord aberto, `statuses` contem `skipped` com `arvore-proibida` para ele e **nenhum** `app-skipped` para ele (RF-22/AC-31 mais risco R9).
- `detail` de `active` contem `endpoints=<M>` com `M >= 1` e **nao** contem `padrao=nao` numa maquina normal (N5: a presenca desse campo significa que o dispositivo padrao ficou de fora).
- **Maquina saudavel com um aplicativo PARADO por 60 s ou mais: NENHUMA linha `health`.** E o item que prova a contabilidade de underrun de B2/5.C2: se `health` sair a cada 15 s com `underruns=0`, silencio normal esta sendo contado como underrun.
- **Reemissao de `app-skipped`** (3/T10): num cenario com recusa avisavel, a mesma entrada aparece mais de uma vez no primeiro minuto e para depois. Se aparecer uma unica vez, o toast de RF-19 nunca chegaria ao usuario.
- O mixer continua emitindo um frame por tique com ZERO fontes (RF-11/AC-10): conferido pela contagem de frames PCM recebidos no probe ao longo de um intervalo sem nenhum processo tocando.

**O que este item NAO cobre, e por que (W5):** `scripts/audio-probe.mjs` sobe **um unico** emissor de sinal por cenario, e nenhum passo desta SPEC o estende (o arquivo nao esta no inventario de modificados). Portanto **nao existe verificacao automatizada com DUAS fontes simultaneas**, e a garantia de que a rampa de uma fonte nao atenua a outra e ESTRUTURAL (a rampa vive em `scratch`, nunca em `mixed`, 3/T2 e risco R4) mais um item de escuta do checklist manual (T8). Prometer aqui um cenario de duas fontes seria prometer automacao que nao existe.

**T3. `tests/unit/stats-monitor.test.ts` (ESTENDER)** - RF-02, RF-03, RNF-06, AC-02, AC-25, risco R12.
- **Separacao por kind**: uma conexao com um `inbound-rtp` de video (`bytesReceived: 1000`, `packetsLost: 2`, `packetsReceived: 100`) e um de audio (`bytesReceived: 200`, `packetsLost: 1`, `packetsReceived: 50`) faz `onInboundAudioStats` receber UMA entrada com `bytesReceived: 200` e `packetsReceived: 50`, e `onInboundVideoStats` continuar recebendo so o de video.
- **Agregado preservado (o teste que impede a regressao de R12)**: no segundo tick, o `packetLoss` que chega em `onReport` e calculado sobre os TOTAIS (3 perdidos, 150 recebidos), **numericamente identico ao que o codigo produzia antes desta feature**.
- Campos de audio: `jitter`, `audioLevel`, `concealedSamples`, `concealmentEvents`, `insertedSamplesForDeceleration`, `removedSamplesForAcceleration` e `packetsDiscarded` chegam com os valores do report; ausentes viram `null` (os dois primeiros) ou `0` (os contadores).
- Report `inbound-rtp` SEM `kind`: soma no conjunto de video, e o total nao muda (compatibilidade com o comportamento de hoje).
- Dois `inbound-rtp` de audio na mesma conexao: fica o de maior `packetsReceived`.
- Sem consumidor: um `StatsMonitor` construido **sem** `onInboundAudioStats` roda o tick inteiro sem lancar (prova de que o callback e opcional de verdade).
- **Sem log quando esta tudo bem**: com deltas zerados entre dois ticks, `console.warn` nao e chamado com nenhuma string comecando por `[audio-stats]`.
- **Com log quando ha concealment**: um segundo tick com `concealmentEvents` maior que o primeiro produz exatamente UMA chamada de `console.warn` com `[audio-stats]`, e o terceiro tick dentro da janela **nao** produz outra.
- Poda: um `txId` que sai de `inboundEntries()` nao deixa entrada nos mapas internos (verificavel por nao gerar linha ao voltar com contadores zerados).
- **Os 12 casos que ja existem no arquivo nao podem ser alterados.**

**T4. `tests/unit/media-manager.test.ts` (ESTENDER)** - RF-04, RF-08, AC-03, AC-07.
- Espionando `console.info`: uma transmissao com `withAudio: false` produz exatamente uma linha `[audio] transmissao <txId> captura=none`, com o `txId` igual ao da transmissao devolvida.
- Uma transmissao em que o cliente de exclusao devolve `{ session: null, reason: 'os-unsupported', captureId: null }` produz `[audio] transmissao <txId> captura=full-loopback motivo=os-unsupported`.
- Uma transmissao em que o cliente devolve sessao com `captureId: 'ax-teste'` produz `[audio] transmissao <txId> captura=process-exclusion sessao=ax-teste`.
- **As tres formas sao distintas entre si** (o teste compara as strings), que e a prova de nivel de unidade de AC-03 ("identificar sem ambiguidade qual dos tres estava ativo").
- Nenhuma das tres contem `media-pull`, `dialback`, `discando de volta` nem `na outra direcao` (prova mecanica de RNF-02 no ponto mais provavel de colisao).

**T5. `tests/unit/audio-copy.test.ts` (NOVO)** - `@renderer/ui/screens/audio-copy`, RF-13/RF-16/RNF-08, AC-12, AC-15, AC-27. No molde EXATO de `tests/unit/waiting-overlay-copy.test.ts`, incluindo o `ASCII_ONLY = /^[\x20-\x7E]+$/` e as assercoes explicitas contra travessao e en-dash (LESSONS 2026-08-27, homoglifos).
- Todas as strings (e o retorno de `appNotCaptured('steam.exe')`) sao 100% ASCII imprimivel, sem travessao e sem en-dash.
- Nenhuma string e vazia.
- **RF-13, o criterio central**: `fullLoopbackStart` contem `sistema` E contem `Discord`, e **nao** contem a frase antiga `Nao foi possivel isolar`. O teste falha se alguem restaurar o texto que nao funcionou em campo.
- **RF-16/AC-15, o congelamento**: `degradedRuntime` e exatamente `'A captura de audio por aplicativo falhou; a transmissao segue com o som do sistema inteiro.'` e `failedRuntime` e exatamente `'O audio da transmissao caiu; pare e transmita de novo para restaurar o som.'`, comparados com `toBe` contra literais escritos no proprio teste. Qualquer edicao futura nesses dois quebra o teste, que e o ponto.
- `appNotCaptured` interpola o nome recebido: `appNotCaptured('steam.exe')` contem `steam.exe`.

**T6. `tests/unit/audio-exclusion-client.test.ts` (ESTENDER)** - RF-01, RF-07, RF-10, RNF-05, AC-01, AC-06, AC-09, AC-24. O harness necessario (`FakePort`, `FakeWriter` com `desiredSize` mutavel, `FakeGenerator`) **ja existe no arquivo**; nenhum preparo novo de ambiente e preciso alem de espionar `console.warn`.
- **A tabela de 3/T3, literal**: quatro entregas de 480 quadros, com `desiredSize = 0` na terceira, produzem exatamente TRES escritas com `timestamp` `0`, `10_000` e `30_000`. **O caso falha se o valor for 20 000**, que e o comportamento de hoje. Este e o teste central de RF-10.
- Sem descarte nenhum, os timestamps continuam `0`, `10_000`, `20_000`, `30_000` (prova de que a correcao nao desloca o caminho feliz).
- Dez descartes seguidos: a proxima escrita tem `timestamp` `100_000` a mais que a anterior (100 ms, abaixo do teto).
- **Teto do avanco (W2)**: 1 000 descartes seguidos fazem a escrita seguinte avancar exatamente `200_000` us (`AUDIO_MAX_SKIP_MS`), e **nao** 10 000 000. O mesmo caso confere que a linha `[audio-drop]` continua reportando a contagem VERDADEIRA de descartes, sem teto: o clamp e do relogio, nunca do contador.
- **Fade-in**: na escrita seguinte a um descarte, a amostra do quadro 0 (indices 0 e 1 do `Float32Array`) e exatamente `0`, e a do quadro `fadeFrames - 1` (47) e o valor original (ganho 1). Os quadros a partir de 48 ficam intactos. O `FakeWriter` precisa passar a guardar o `data` do frame, alem dos campos que ja guarda.
- **Primeiro frame da track tambem entra com rampa**: a primeira escrita de todas tem o quadro 0 zerado.
- **Rate-limit (AC-06 e risco R1)**: 1 000 descartes consecutivos (com o `Date.now` avancando pouco) produzem no maximo 2 chamadas de `console.warn` comecando por `[audio-drop]`.
- **RNF-05**: nenhum `console.warn` e chamado nas escritas bem-sucedidas; o caminho feliz continua mudo.
- Guardas que NAO contam como descarte: `payload.type !== 'pcm'`, `data` ausente e `numberOfFrames` nao inteiro nao incrementam o contador nem deslocam o relogio (matriz 5c).
- **Nao-regressao**: os casos existentes que provam o relogio monotonico atraves da troca de port pela cascata continuam passando **sem alteracao**.

**T7. e2e - `tests/e2e/smoke-session.spec.ts` (ESTENDER, sem spec novo)** - RF-04, RF-08, RNF-02, AC-03, AC-21.

**Por que nao ha spec novo, declarado e nao omitido**: os dois caminhos que esta feature toca sao inalcancaveis de forma deterministica pelo e2e. O caminho `excluded` inteiro esta desligado por `ZOI_DISABLE_AUDIO_EXCLUSION: '1'` (`zoi-app.ts:293`), e a transmissao COM audio depende de dispositivo de saida ativo na maquina, o que o proprio helper ja documenta como nao-deterministico (`zoi-app.ts:471-476`) e por isso mantem `withAudio = false` por padrao (`:541`). Forcar `withAudio: true` num spec deixaria o teste dependente da placa de som de quem roda, que e exatamente o tipo de assercao que "passa por acidente" (LESSONS 2026-08-27). O que E deterministico e a linha de estado de captura do caso `none`, e e ela que entra:
- Logo depois do `startTransmission(owner, { presetId: 'p720_30', withAudio: false })` de `smoke-session.spec.ts:73`, acrescentar um passo **6b** afirmando que `owner.consoleLines` contem uma linha casando com `/\[audio\] transmissao [0-9a-f-]{36} captura=none/`. E o mesmo padrao que o passo **8c** daquele spec ja usa para provar a linha de diagnostico do primeiro quadro, entao nao ha helper novo nem arranjo novo.
- `expectNoDirectionFallbacks` continua no fim do spec, **sem alteracao** (AC-21).
- Os outros 6 specs e2e continuam **inalterados** e verdes.

**T8. Checklist manual (o que teste local NAO prova, LESSONS 2026-08-26 e RNF-07/AC-26)**:
- **AC-08/RF-09, a percepcao do estalo**: transmissao real de 10 minutos ou mais, com CPU carregada, e confirmacao auditiva de que nao ha estalo. **E exatamente o item 2.2 do `CHECKLIST_MANUAL_app-audio-capture.md` que nunca foi marcado**, e ele volta como item desta feature.
- **RF-09 com DUAS fontes, o item que o probe nao alcanca (W5, risco R4)**: transmitir com o navegador tocando musica E um jogo tocando som ao mesmo tempo; confirmar por escuta que um engasgo em um dos dois **nao abaixa o volume do outro**. E a verificacao de que a rampa ficou em `scratch` e nao em `mixed`. Nao ha forma automatizada disto neste projeto.
- **AC-03/RF-04 em campo**: apos uma sessao real, abrir o log do dia e apontar, para cada transmissao, qual dos tres estados estava ativo.
- **AC-05/AC-31, RF-06/RF-22 em campo**: no log de uma sessao real com o jogo aberto, procurar `game.exe` nas linhas `[audio-native] ... active` e `... skipped`. **E esta linha, e nao outra, que responde a questao 3 em aberto da PRD.**
- **AC-12/AC-14, RF-13/RF-15**: o amigo de Windows 10 transmite numa sessao real e diz se percebeu o aviso. Se nao perceber, vira follow-up de saliencia (AC-14), nao falha desta entrega.
- **AC-17/AC-18, RF-18/RF-19**: o amigo com o jogo mudo transmite de novo. Ou o jogo passa a sair (a enumeracao ampliada era a causa) ou o log aponta qual das causas restantes esta em jogo.
- **AC-22/RNF-03**: exercitar `app-audio-capture` (transmitir com audio e conferir que o Discord continua fora) e o volume dos sons locais.
- **AC-23/RNF-04**: conferir qualidade e fluidez de video iguais as da v0.4.0.
- **AC-06/RNF-01**: depois de uma sessao longa, conferir o tamanho do arquivo de log do dia e que **nao existe** a linha `[log] arquivo passou de 5 MB`.
- **AC-24/RNF-05**: comparar os contadores de `[audio-drop]` e `health` no mesmo cenario local antes e depois, na mesma maquina e mesma transmissao de teste.
- **AC-29/RNF-10**: conferir que toda degradacao de audio continua gerando aviso visivel.
- **AC-32/RF-23**: conferir que as tres notas de release do passo 8 de F1.1 estao escritas e que o app **nao tenta** detectar modo exclusivo em lugar nenhum.

---
## 8. Matriz de cobertura da PRD

23 requisitos funcionais (RF-01 a RF-23) e 11 nao-funcionais (RNF-01 a RNF-11) = **34 requisitos, 34 linhas. Sem orfaos.**

| Req | Onde e coberto |
|---|---|
| RF-01 | Os TRES pontos, um por feature: underrun do mixer em **C1.1** passos 5 e 6 (`underrunTicks_`/`underrunFrames_`, contando **somente leituras parciais**, com o tique mudo separado em `silentTicks_`); fila cheia da TSFN em **C1.2** passo 1 (`pcmDrops->fetch_add(1)` no `addon.cc:311`); backpressure do renderer em **B2.2** passo 4. O transporte dos dois primeiros ate o arquivo e **B2.1** passo 3 (`health`), com o gatilho de 5.C6 que impede o relatorio de disparar por silencio normal. Testes: T6 (renderer), T2 (nativo, incluindo o item de ZERO linhas `health` com aplicativo parado) |
| RF-02 | **B2.3** passos 1, 5 e 6: `RtpAudioStatsEntry` e `InboundAudioStats` (contrato 5.C4) lidos do MESMO `stats.forEach`, com os sete campos que a PRD lista. Teste: T3 |
| RF-03 | **B2.3** passos 4, 5 e 7: `KindTotals` separado por `entry.kind`, com o agregado de `onReport` preservado por SOMA explicita (3/T4, risco R12). Teste: T3, com o caso que prova que o `packetLoss` de `onReport` nao mudou |
| RF-04 | **B2.2** passo 7 (as tres formas literais de 5.A3, uma por `audioMode`) mais **B2.1** passo 3 (a linha `degraded-full-loopback` que distingue B de A). A regra de leitura das tres assinaturas esta no fim de 5.A3. Testes: T4 (as tres formas distintas) e T7 (a forma `none` no app buildado) |
| RF-05 | **B1.1** passos 5 e 6: `sendStatus` (`:58-64`) **ja** chamava `logToFile` para todo estado, inclusive o `degraded-full-loopback` de `escalate` (`:213`); o que entra e o `captureId` nessa mesma linha, e o `captureId` SOBREVIVE ao re-fork (2b.1). **Nada e removido nem enfraquecido**, como o proprio RF-05 exige. Justificativa em 3/T9 |
| RF-06 | **C1.2** passos 7 e 9 (o `active` com `capturas=` e `endpoints=` que ja era emitido em `capture_engine.cc:519`) mais **B2.1** passo 3 (o ramo que **para de descartar** o que `src/main/audio-exclusion.ts:165` descarta hoje). Teste: T2 |
| RF-07 | **B1.1** passos 1 e 2 (`createThrottledCounter`), aplicado em **B2.1** passo 3 (`active` e `skipped`), **B2.2** passo 4 (`[audio-drop]`) e **B2.3** passo 8 (`[audio-stats]`); no lado nativo o limite e estrutural (**C1.2** passo 5, `kHealthReportIntervalMs`; assinatura de `skipped`; `warnedApps_`). Calculo do pior caso em 3/T1. Testes: T1, T6, T3 |
| RF-08 | **B1.1** passo 5 (o `captureId`), **B2.2** passo 7 (a linha-ponte `txId` mais `captureId`), 5.A3 (toda linha nova cita um dos dois). Decisao e consequencia declarada em 3/T9. Testes: T4, T6 |
| RF-09 | **C1.1** passo 5, com as TRES transicoes (fade-in, fade-out no frame e cauda de decaimento no primeiro tique mudo) e os tres exemplos trabalhados em 3/T2 e 5.C2. A terceira existe porque um anel que drena exatamente na fronteira do tique iria de amplitude total a silencio sem rampa (W4). A limitacao que fica (fonte REMOVIDA da composicao) esta declarada em 3/T2 e no risco R4. Verificacao: T2, e T8 para a percepcao (declarada CAMPO pela propria PRD em AC-08) e para o caso de duas fontes |
| RF-10 | **B2.2** passo 4, com a tabela de timestamps (0, 10 000, **30 000**, nunca 20 000) em 3/T3, e com o TETO de avanco (`AUDIO_MAX_SKIP_MS = 200`) que impede uma rajada de virar um salto de 10 s. As duas limitacoes aceitas (nao ha fade-out sem lookahead; acima do teto a linha do tempo comprime) estao declaradas no mesmo trade-off. Teste: T6, que falha se o valor voltar a ser 20 000 e que confere o teto na rajada de 1 000 |
| RF-11 | **C1.1** passo 8 e edge case de `sources_` vazio: a rampa so multiplica `scratch` ANTES do laco de soma, e nenhum caminho novo fica entre o `while` e o `sink_` (`mixer.cc:169-176`). Garantia por CONSTRUCAO, nao por cuidado. Verificacao: T2 e o exercicio de leitura dirigido do Done when de C1.1 |
| RF-12 `[WONT]` | **Explicitamente NAO implementado.** 3/T7: nenhum passo desta SPEC toca SDP, Opus, `sdpTransform` ou parametros de sender de audio; 2.5 lista isso como intocado. **Guarda para os agentes de implementacao**: se surgir a vontade de "so ligar o FEC ja que estamos aqui", a resposta e nao (AC-11) |
| RF-13 | **F1.1** passos 1 e 5, com o texto literal em 5.C3 (`fullLoopbackStart`) e a analise de por que o texto de hoje falhou em 3/T6. Teste: T5, que exige as palavras `sistema` e `Discord` e proibe a frase antiga |
| RF-14 | **F1.1** passo 5: o ponto de aviso continua sendo `RoomScreen.tsx:211-216`, com a MESMA condicao. Prova mecanica no Done when de F1.1: `grep -c "pushToast("` cresce exatamente 1, e esse 1 e o ramo de RF-19 (cenario diferente). Rejeicao explicita do marcador permanente em 3/T6 (AC-13) |
| RF-15 | **F1.1** passos 2, 3 e 5: tom `'danger'` e `TOAST_TTL_LONG_MS = 12_000`, os dois sobre a infraestrutura existente (`ToastTone` de `room-state.ts:132`, `ToastRow` de `Toast.tsx:9-12`). Verificacao: o exercicio COM RENDER do Done when de F1.1; a percepcao real e CAMPO por AC-14 |
| RF-16 | **F1.1** passo 6: os dois ramos de `RoomScreen.tsx:119-129` mantem tom e condicao, e os textos viram constantes com valor IDENTICO (5.C3). Teste: T5, que compara `degradedRuntime` e `failedRuntime` com `toBe` contra os literais de hoje (AC-15) |
| RF-17 | A informacao necessaria vem de tres lugares que so juntos respondem a pergunta: **C1.2** (`active` mais `skipped` mais `app-skipped`), **C1.3** (o `endpoints=<M>`, que diz se a sessao estava fora do alcance da enumeracao) e **B2.1** (tudo isso chegando ao arquivo). Verificacao: T8, item de campo do `game.exe` |
| RF-18 | **C1.3** inteira, com a justificativa de por que a correcao entra AGORA e nao depois do dado de campo em 3/T5 (superconjunto estrito mais degrau de seguranca mais autorizacao explicita da IDEA 11b). Riscos R6 e R7. Testes: T2 (nao-regressao e `M >= 1`) e T8 (AC-17, campo) |
| RF-19 | Quatro camadas: **C1.2** passo 7 emite `app-skipped` **so para os dois motivos avisaveis** e o REEMITE a cada 10 s durante os primeiros 60 s de vida do motor; **B2.1** passo 3 encaminha como `'app-not-captured'`; **F1.1** passo 6 mostra o toast e o passo 7 corrige a ordem da deduplicacao para o estado novo. A reemissao nao e enfeite: sem ela o aviso **nunca** chegaria no cenario relatado, porque o primeiro `Reconcile` (`capture_engine.cc:405-406`) roda antes de o `RoomScreen` assinar o `onStatus` - analise completa e alternativas rejeitadas em 3/T10. A exclusao deliberada do motivo `arvore-proibida` esta em 3/T8 e no risco R9. Verificacao: T2 (o Discord nao gera aviso; a reemissao aparece mais de uma vez no primeiro minuto) e T8 (AC-18, campo) |
| RF-20 | **C1.3** edge cases: o caminho de deteccao por evento (`OnSessionCreated`, `session_tracker.cc:167-182`) e o poll de 1 s (`kReconcileIntervalMs`) **ja cobrem** o app aberto depois, e agora cobrem tambem os endpoints que antes eram invisiveis, porque o `SessionNotifier` passa a ser registrado em cada binding (5.C5 passo 5). Nenhum caminho novo foi criado. Verificacao: T8 (AC-19) |
| RF-21 | **C1.3** passo 8: `Engine::Reconcile` (`capture_engine.cc:448-477`) **nao muda uma linha**; a ancora continua sendo o PID que abriu a sessao, e subir a arvore continua servindo so para DETECTAR proibido. A unica coisa que muda e o tamanho da lista de entrada. Garantia por CONSTRUCAO. Teste: T2 (o item "nao captura o proibido", bloqueante) |
| RF-22 | **C1.2** passos 7 e 8 (`DescribeSkipped` com os TRES motivos, no molde de `DescribeAnchors`) mais **B2.1** passo 3 (o `skipped` chegando ao arquivo). Os textos dos motivos estao tabelados em 5.A1. Teste: T2 (AC-31, com o Discord como caso concreto) |
| RF-23 | **F1.1** passo 8 (as tres notas de release), mais a rejeicao explicita de tentar detectar modo exclusivo em 3/T5 e no edge case final de C1.3. A transparencia que substitui o aviso impossivel e RF-06 mais RF-22. **Guarda para os agentes**: nao existe, e nao pode passar a existir, nenhuma heuristica de deteccao de modo exclusivo nesta feature (AC-32) |
| RNF-01 | 3/T1 com a tabela de pior caso ponto a ponto, **incluindo os dois pontos do processo main** (`activeLog` e `skippedLog`) e a reemissao de `app-skipped`: 8 182 linhas, cerca de 1,15 MB em 4 horas contra o teto de 5 MB. Risco R2 com a regra dura de que nenhum log novo pode existir fora de um throttle, de uma mudanca de estado ou de um evento unico por transmissao. Testes: T1 (a semantica), T3 e T6 (a contagem de linhas), T8 (a conferencia do arquivo real, AC-06) |
| RNF-02 | 2.5 (a identidade da track nao muda, zero `replaceTrack`, zero renegociacao, zero redial), risco R3 (as quatro marcas proibidas), `grep` mecanico no Done when de B1.1, B2.1, B2.2 e B2.3, e T4 (as tres linhas novas checadas contra as quatro marcas). T7 mantem `expectNoDirectionFallbacks` intocado no spec estendido e nos outros 6 (AC-21) |
| RNF-03 | 2.5 (nenhum arquivo de `app-sounds-volume` e tocado; a cascata de degradacao fica identica), C1.3 3/T5 (a ampliacao e superconjunto estrito e os filtros de proibido nao mudam, risco R6). Verificacao: o item bloqueante de T2 (`npm run audio:probe` continua capturando o permitido e **nao** capturando o proibido) e T8 (AC-22) |
| RNF-04 | 2.5 e a regra de escopo de 6.3: nenhum arquivo do pipeline de video e aberto. As UNICAS linhas novas em `media-manager.ts` sao as tres de log de estado e as duas variaveis que as alimentam (B2.2 passos 6 e 7). Verificacao: `npx vitest run` e `npm run test:e2e` verdes no Done when de toda feature, mais T8 (AC-23) |
| RNF-05 | Risco R1 com a mitigacao concreta (uma comparacao de inteiro por frame; a template string so e montada dentro do `if (summary)`), B2.2 passo 4 (a ordem exata das operacoes em `writeFrame`), 3/T2 (96 multiplicacoes por borda, so nas bordas). Testes: T6 (no maximo 2 `console.warn` em 1 000 descartes, e nenhum no caminho feliz) e T8 (AC-24, a comparacao antes/depois no mesmo cenario local) |
| RNF-06 | **B2.3** passos 2 e 5: a leitura de audio entra DENTRO do `stats.forEach` que ja existe (`:153-173`) e o comentario de ponto de extensao (`:59-67`) e atualizado em vez de contornado. Prova mecanica no Done when de B2.3: continua existindo exatamente UM `setInterval` no arquivo (AC-25) |
| RNF-07 | 6.1 (regra dura de rebuild e exercicio para o Sprint C1), risco R11, T2 (a lista explicita do que so o probe prova) e T8 (o que so campo prova). A divisao entre automatizavel e manual esta declarada item a item, e nao presumida (AC-26) |
| RNF-08 | Todas as strings novas estao escritas por extenso nesta SPEC (5.A3 para os logs, 5.C3 para os toasts), em pt-BR sem acento e sem travessao. Teste: T5, que roda `ASCII_ONLY = /^[\x20-\x7E]+$/` sobre o VALOR de cada string, no molde de `waiting-overlay-copy.test.ts` (LESSONS 2026-08-27, homoglifos). Para as linhas de log, a conferencia e o `grep` do Done when e a leitura do arquivo real (AC-27) |
| RNF-09 | `npm run typecheck`, `npm run lint` e `npx vitest run` no Done when de TODAS as 8 features; `npm run test:e2e` no Sprint T. A regra GREEN de 6.3 proibe commitar sem exercicio (AC-28) |
| RNF-10 | **F1.1**: nenhuma degradacao perde aviso. Os dois avisos de runtime continuam com condicao identica (RF-16), o de inicio fica MAIS visivel (RF-15) e um caso que hoje e totalmente silencioso (aplicativo fora da captura) passa a avisar (RF-19). A politica so melhora, nunca reduz (AC-29) |
| RNF-11 | Regra de silencio de 6.3 e cabecalho do Sprint T: toda execucao de Playwright usa `launchInstance`, que ja passa `--mute-audio` (`zoi-app.ts:286`) e semeia `soundVolume: 0` (`:86`). **Nenhum teste desta feature reproduz tom audivel**, e T7 declara por escrito por que nem sequer forca `withAudio: true`. O `audio-probe.mjs` continua com o sinal inaudivel de 1 Hz que o cabecalho dele (`:12-16`) proibe trocar (AC-33) |

---

## 9. Premissas e questoes em aberto

**[ASSUMPTION A1] Uma rampa linear de 1 ms elimina a percepcao do clique nas duas bordas.** Base: 1 ms e uma ordem de grandeza abaixo do frame de 10 ms (nao soa como corte de volume) e uma ordem de grandeza acima do periodo de amostragem (20,8 us a 48 kHz), o que espalha o transiente por 48 amostras em vez de concentra-lo em uma. **Nao bloqueia nada e e calibravel por UMA linha**: `kFadeMs` em `mixer.cc` e `AUDIO_FADE_MS` em `config.ts`. Se o campo mostrar que 1 ms nao bastou, o proximo degrau (2 ms) e uma constante; se mostrar que 1 ms ja atenua demais, o degrau para baixo tambem. Confirmacao real: T8, item 1 (o item 2.2 do checklist manual da `app-audio-capture`, que nunca foi marcado).

**[ASSUMPTION A2] O `MediaStreamTrackGenerator` aceita um salto de timestamp para FRENTE, multiplo do frame e limitado a 200 ms, sem quebrar a track.** E a premissa que sustenta 3/T3. **Consequencia se estiver errada, ja desenhada**: o salto e sempre para frente (nunca para tras, o modo de falha que LESSONS 2026-08-25 registra como quebrando a track), sempre multiplo exato de 10 ms e **sempre limitado por `AUDIO_MAX_SKIP_MS`**; no pior caso o consumidor trata o buraco como o jitter que ele ja trata hoje. O teto e o que torna a premissa defensavel: sem ele, o proprio pior caso de 3/T1 (1 000 descartes seguidos) produziria um salto de 10 segundos, que nao e "da ordem do jitter" em horizonte nenhum. Verificacao parcial e LOCAL: T6 prova os timestamps produzidos; a reacao real do encoder e do lado do espectador so aparece em campo, e a PRD ja declara AC-09 como CAMPO. Degradacao suave: se o buraco incomodar mais que a emenda, reverter B2.2 e um `git revert` de um commit isolado.

**[ASSUMPTION A3] `EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)` devolve os dispositivos por onde as sessoes de audio efetivamente vivem, e ativar um `IAudioSessionManager2` em cada um e barato o bastante para o tique de 1 s.** **Nao fica como premissa aberta de verdade**: e o item de C1.3 que `npm run audio:probe` verifica (`M >= 1`, ausencia de `padrao=nao`, mais o exercicio dirigido com um segundo dispositivo), e o degrau de seguranca de DOIS niveis de 5.C5 passo 6 garante que o pior caso e o comportamento de hoje - inclusive no caso torto em que so o dispositivo PADRAO falha e os outros funcionam, que o nivel 6a cobre explicitamente para o padrao nunca sumir em silencio. O que o probe NAO consegue provar e o custo numa maquina fraca com muitos dispositivos virtuais; se aparecer, o degrau de ajuste ja esta identificado e e uma constante (`kMaxScannedEndpoints`).

**[ASSUMPTION A4] `console.warn`/`console.info` do renderer continuam chegando ao arquivo por `attachRendererLogging`.** Isso e FATO verificado no codigo (`file-logger.ts:147-151`, chamado de `src/main/index.ts`), nao suposicao, e e o que permite a esta feature instrumentar o renderer sem canal novo. Fica registrado aqui porque **toda a observabilidade do lado do renderer depende disso**: se alguem remover `attachRendererLogging`, tres dos cinco prefixos de log desta feature somem em silencio.

**[ASSUMPTION A5] Nenhuma das quatro marcas de `DIRECTION_FALLBACK_MARKS` aparece por acidente nas linhas novas.** Conferido a olho contra as 12 formas literais de 5.A3 e travado por `grep` mecanico no Done when de cada feature. Registrado como premissa e nao como fato porque a lista de marcas mora no arquivo de teste (`zoi-app.ts:50`) e pode crescer numa feature futura sem que ninguem releia esta SPEC.

**[ASSUMPTION A6] Sessenta segundos bastam para o `RoomScreen` assinar o `onStatus` depois do fork do worker.** E o dimensionamento de `kAppSkippedReplayWindowMs` (3/T10). O intervalo real e o do `selectSource` mais `getDisplayMedia` mais setup de track (`media-manager.ts:470` a `:541`), tipicamente abaixo de dois segundos. **Consequencia se estiver errada**: o toast de RF-19 nao aparece naquela transmissao, exatamente como acontece hoje, mas o log de RF-22 continua completo e o diagnostico nao se perde. Calibravel por uma constante. Registrado como premissa, e nao como fato, porque o unico caminho que poderia estourar 60 s (usuario parado no dialogo de selecao de fonte do sistema) nao foi cronometrado.

**[OPEN Q1] O valor de `AUDIO_LOG_WINDOW_MS = 10_000`.** Escolhido pela tabela de pior caso de 3/T1 (8 182 linhas, cerca de 1,15 MB em 4 horas) com folga de mais de 3 MB sobre o teto. A primeira sessao de campo pode mostrar que 5 s da resolucao temporal melhor sem chegar perto do teto, ou que 30 s bastam. **Nao bloqueia nada**: e uma constante em `src/shared/config.ts`, num lugar so, e o teste T1 verifica a SEMANTICA do contador, nao o numero literal.

**[OPEN Q2] O toast de RF-19 nomeia apenas o PRIMEIRO aplicativo recusado por transmissao.** Consequencia direta de reusar o `alreadyWarned` por `status.state` que ja existe (risco R8). A alternativa (dedupe por `state` mais `app`) daria mais informacao e mais risco de spam. Escolhido o lado conservador porque a informacao COMPLETA ja esta no log (RF-22). Se o campo mostrar que um toast so nao basta, a mudanca e local ao `useEffect` de `RoomScreen.tsx:113-131`.

**[OPEN Q3] Causa raiz exata do jogo mudo (a questao 3 da PRD, que continua em aberto).** Esta SPEC fecha estruturalmente DUAS das tres candidatas (role diferente e dispositivo diferente, as duas por C1.3) e instrumenta a terceira (falha silenciosa de inclusao, por RF-22). A que sobra estruturalmente invisivel e o modo EXCLUSIVO do WASAPI, que RF-23 trata com transparencia mais nota de release, nao com aviso. **Nao bloqueia a implementacao**: os dois ramos possiveis (corrigir e avisar) estao implementados. O que continua dependendo de campo e saber QUAL deles se aplicou ao caso relatado, exatamente como a PRD ja declara.

**[OPEN Q4] O estalo pode ter outra causa alem das duas comprovadas (RF-12/A3).** Declarado na PRD e reafirmado aqui: se a proxima sessao real mostrar estalo com os contadores de `[audio-drop]` e `health` ZERADOS, a causa esta fora das duas corrigidas e vira follow-up separado, com o dado em maos. **A instrumentacao desta feature e justamente o que torna essa pergunta respondivel**: hoje ela nao seria.

### Inventario de arquivos

**4 arquivos NOVOS**: `src/shared/log-throttle.ts`; `src/renderer/src/ui/screens/audio-copy.ts`; `tests/unit/log-throttle.test.ts`; `tests/unit/audio-copy.test.ts`.

**20 arquivos MODIFICADOS**
- TypeScript (9): `src/shared/config.ts`; `src/shared/ipc.ts`; `src/main/audio-exclusion.ts`; `src/renderer/src/services/audio-exclusion.ts`; `src/renderer/src/services/media-manager.ts`; `src/renderer/src/services/stats-monitor.ts`; `src/renderer/src/store/app-store.ts`; `src/renderer/src/ui/components/Toast.tsx`; `src/renderer/src/ui/screens/RoomScreen.tsx`.
- C++ (7): `native/zoi-audio-capture/src/mixer.h`; `mixer.cc`; `addon.cc`; `capture_engine.h`; `capture_engine.cc`; `session_tracker.h`; `session_tracker.cc`.
- Testes (4): `tests/unit/audio-exclusion-client.test.ts`; `tests/unit/stats-monitor.test.ts`; `tests/unit/media-manager.test.ts`; `tests/e2e/smoke-session.spec.ts`.

**Explicitamente NAO tocados** (e a lista e contrato): `src/shared/protocol.ts`, `src/shared/codecs.ts`, `src/shared/presets.ts`, `src/preload/index.ts`, `src/main/ipc-handlers.ts`, `src/main/index.ts`, `src/renderer/src/core/room-state.ts`, `src/renderer/src/services/session.ts`, `src/renderer/src/ui/screens/PlayerView.tsx`, `native/zoi-audio-capture/binding.gyp`, `package.json`.

Total: **24 arquivos**, em **5 sprints** (B1, B2, C1, F1, T) e **8 features** de implementacao mais 8 grupos de teste definidos no Sprint T.

### Self-check

Reli a SPEC do ponto de vista de um agente de implementacao com contexto limpo, conhecendo apenas SPEC, PRD e CONTEXT, perguntando feature a feature "eu conseguiria implementar isto sem fazer uma unica pergunta?". Buracos encontrados e **corrigidos durante a redacao**:

1. **`AudioExclusionStatus` com campos obrigatorios quebraria o typecheck no meio do sprint B2.** Os dois `sendStatus` de `escalate` (`:213`, `:218`) e o `AudioExclusionStartResult` de `:244-248` sao construidos no MESMO arquivo em que os tipos passam a exigir os campos novos. Corrigido: B1.1 nao e "so tipos", ela ja acerta as tres construcoes e gera o `captureId`, entao o typecheck fecha dentro do proprio commit.
2. **O ramo de `app-skipped` no main precisava do nome do aplicativo, e a versao anterior mandava o main parsear a string de diagnostico.** Corrigido antes de virar codigo: 3/T8 e 5.A1 separam `skipped` (lista, so log) de `app-skipped` (um basename, sem prefixo nenhum), e a matriz 5c trata o `detail` como texto opaco.
3. **`arvore-proibida` viraria toast do Discord.** Seria o produto avisando que esta funcionando, varias vezes por sessao. Corrigido e travado em TRES lugares (3/T8, risco R9, e o passo 7 de C1.2 com a palavra "nunca"), porque e o erro que um agente bem-intencionado cometeria sozinho em nome da transparencia.
4. **`ReportHealth` drenaria os contadores antes de checar a janela**, e todo evento de um intervalo suprimido sumiria. Corrigido com uma nota explicita de ORDEM em 5.C6 e no passo 5 de C1.2.
5. **O `Reconcile` de `active` teria que prometer `endpoints=<M>` num commit em que `DescribeEndpoints` ainda nao existe** (acoplamento entre C1.2 e C1.3). Corrigido com a nota de ordem entre as duas features, que diz o que fazer em cada uma das duas ordens possiveis.
6. **`sourceSilenced_` poderia dessincronizar de `sources_`** e indexar fora do vetor. Corrigido: 5.C2 declara a invariante e amarra as duas escritas ao mesmo `sourcesMutex_`, e o passo 4 de C1.1 poe o redimensionamento dentro do lock que ja existe em `SetSources`.
7. **A rampa aplicada em `mixed` atenuaria audio bom de outras fontes.** Corrigido em 3/T2 com a justificativa por extenso, no risco R4 e no passo 5 de C1.1, os tres dizendo `scratch`.
8. **O e2e "obvio" (transmitir com `withAudio: true` para ver o toast novo) seria flaky por dependencia de placa de som**, e o proprio helper ja documenta isso. Corrigido: T7 declara por escrito por que nao existe spec novo, e a assercao deterministica virou a linha `captura=none` no spec que ja transmite.
9. **A verificacao do texto do toast nao tinha onde morar** (importar `RoomScreen.tsx` num teste node arrastaria a tela inteira). Corrigido com 3/T11 e o modulo `audio-copy.ts` sem imports, no molde do `WAITING_COPY` que ja existe.
10. **`fade - 1` como divisor explodiria com `fade = 1`.** Corrigido com a guarda `fade >= 2` declarada nos dois lados (5.C2 para o C++, passo 4 de B2.2 para o TS) e nos edge cases das duas features.
11. **A separacao por `kind` mudaria silenciosamente o insumo do relatorio de qualidade.** Corrigido em 3/T4 (soma explicita), no risco R12 e no teste T3, que compara o `packetLoss` resultante com o de antes.

Verificacoes mecanicas feitas ao final:
- **Todo caminho de arquivo citado existe** no HEAD `8db42a0db817d3e7939415676b4e478fb5f222aa` (os que nao existem estao marcados como NOVOS no inventario acima).
- **Todos os numeros de linha citados foram conferidos por leitura no HEAD desta SPEC.** A superficie que um revisor precisa recontar para invalidar esta afirmacao: `mixer.cc` 14-18, 82-118, 87, 139-142, 144-178, 155, 156-167, 160, 161, 162-165, 169-176; `mixer.h` 1-5, 23-27, 25-26; `addon.cc` 253, 270-336, 290, 295-312, 310, 311, 314-324, 326; `capture_engine.cc` 13-21, 16-20, 22-27, 378-382, 393-434, 397-402, 405-406, 410, 412, 413, 417-425, 436-521, 437, 439, 439-444, 448-477, 451, 452, 475, 509, 509-512, 511, 517-520, 519, 523-536, 538-562, 547, 548, 556; `capture_engine.h` 3-6, 56; `session_tracker.cc` 118-138, 148-154, 167-182, 184-208, 234-260, 244, 252-253, 262-275, 277-310, 279, 281-307, 289, 312-315; `session_tracker.h` 6-7, 112-114, 119; `src/main/audio-exclusion.ts` 36, 40-47, 58-64, 59-62, 67-72, 142, 145-149, 151, 155, 157-170, 158, 159, 161-166, 162-164, 163, 165, 167-169, 168, 174, 190-219, 197, 201, 210, 213, 218, 221-249, 223, 226, 231, 236, 240, 240-243, 243, 244-248, 251-263; `src/main/file-logger.ts` 16, 18, 26, 80-105, 88, 93-100, 147-151; `src/main/ipc-handlers.ts` 3, 92-98; `src/preload/index.ts` 60, 62-68, 65; `src/renderer/src/services/audio-exclusion.ts` 7-12, 22-26, 55-59, 60, 67-80, 76, 82-103, 83, 84-85, 87-88, 89, 91-102, 96, 99, 119-124, 126, 129, 139, 142-143, 146-161; `src/renderer/src/services/media-manager.ts` 468, 469-477, 470, 473-475, 487, 497, 526, 532, 541, 542, 1133; `src/renderer/src/services/stats-monitor.ts` 48-57, 57, 59-67, 68-75, 75, 86, 96-101, 127, 132-138, 140-229, 145-147, 148, 153-173, 156-158, 161, 163-164, 174-176, 179, 207-222, 207-228, 224-228; `src/renderer/src/services/session.ts` 227, 299, 303, 305, 358-363; `src/renderer/src/core/room-state.ts` 132; `src/renderer/src/store/app-store.ts` 10-14, 17, 60, 89-95, 94; `src/renderer/src/ui/components/Toast.tsx` 1-2, 9-12; `src/renderer/src/ui/screens/RoomScreen.tsx` 112, 113-116, 113-131, 117, 115-118, 117-118, 119-123, 119-129, 122, 124-129, 127, 206-210, 206-216, 209, 211-216, 230, 232; `src/shared/ipc.ts` 98-108, 110-112, 114, 116-120, 123-128; `src/renderer/src/store/room-store.ts` 84; `tests/e2e/helpers/zoi-app.ts` 50, 86, 286, 293, 471-476, 541, 591-601; `tests/e2e/smoke-session.spec.ts` 73; `scripts/audio-probe.mjs` 12-16, 717, 738-739.
- **Toda regra quantitativa carrega exemplo trabalhado**, e os passos implementam esse mesmo modelo: o contador com janela (5.C1 e T1: `record(0)` da `count: 1`, `record(10_000)` da `count: 1000`), as TRES transicoes do mixer (3/T2 e 5.C2: underrun parcial com `frames = 300` e ganho 1.0 no quadro 252 e 0.0 no 299; retomada; e drenagem exata com a cauda saindo de `lastFrame_`), o relogio do renderer (3/T3 e T6: a tabela 0 / 10 000 / 30 000, mais o teto de 200 ms na rajada de 1 000), a separacao por `kind` (B2.3 e T3: 1000 mais 200 bytes, 3 perdidos e 150 recebidos no agregado) e o pior caso de volume de log (3/T1: tabela de sete pontos, 8 182 linhas e cerca de 1,15 MB em 4 horas contra 5 MB).
- **Todo estado e todo canal novos aparecem na matriz 5c**: os quatro estados nativos (`active`, `health`, `skipped`, `app-skipped`), o estado tipado `'app-not-captured'`, o campo `app`, o campo `captureId`, o frame PCM inalterado, a linha de log do renderer, e a linha explicita de que **nada de audio viaja entre pares**.
- **Cobertura sem orfaos**: 23 RF mais 11 RNF = 34 requisitos, 34 linhas na matriz da secao 8. Os `[WONT]` (RF-12) e os requisitos de nao-fazer (RF-14, RF-23) tem linha com guarda explicita para os agentes de implementacao, e nao apenas ausencia.
- **Zero caracteres acentuados e zero travessoes** neste documento, conferido mecanicamente.
- **Todos os fingerprints da secao 1 estao completos**: 64 caracteres para os tres sha256 de documento, 40 para os 23 `git hash-object` de codigo, nenhum truncado.

**Self-check: PASS** (11 buracos encontrados na propria redacao e 14 itens da rodada de revisao de contexto limpo, todos corrigidos antes de o documento ser fechado).

### Rodada de revisao (contexto limpo) - NEEDS-CHANGES atendido

Uma revisao independente releu esta SPEC contra o codigo, conferiu as 196 citacoes de linha (todas exatas) e validou o desenho da enumeracao ampliada de C1.3 contra o risco de captura excessiva (aprovado como desenhado). O que a revisao apontou e foi corrigido nesta versao:

1. **(BLOCKER) O toast de RF-19 nunca chegaria ao usuario no cenario relatado.** O motor emite `app-skipped` no PRIMEIRO `Reconcile` (`capture_engine.cc:405-406`), milissegundos apos o fork, enquanto o unico assinante de `onStatus` (`RoomScreen.tsx:113-116`) so nasce depois de `startTransmission` resolver (`media-manager.ts:470` ate `:541`, com `getDisplayMedia` no meio). Sem `ipcRenderer.on` registrado, o `webContents.send` e descartado, e `warnedApps_` nunca reemitia. Corrigido com o trade-off **3/T10** (reemissao a cada 10 s durante os primeiros 60 s de vida do motor, no proprio C++), com as duas alternativas rejeitadas e o motivo de cada uma, mais 5.A1 (regra de reemissao), 5.C6 (bloco de decisao literal), 5c (duas linhas novas), C1.2 passos 3 e 7, o Done when de C1.2 e a linha RF-19 da matriz. **O log de RF-22 continua incondicional e nao depende de assinante nenhum**, o que esta dito com todas as letras nos tres lugares.
2. **(BLOCKER) Silencio normal era contado como underrun.** `frames == 0` e o estado ordinario de um aplicativo parado, e incrementar `underrunFrames_` nele faria `health` sair a cada 15 s para sempre, contradizendo o proprio Done when de C1.2 e o item de T2. Alem disso `silentTicks` era drenado e jogado fora (o formato tinha tres campos). Corrigido: contabilidade literal em 5.C2 e nota dedicada em 3/T2 (**underrun so em leitura PARCIAL**), quarto campo `mudos=<S>` no formato de 5.A1 com tabela campo a campo, gatilho por PEEK (`Mixer::HasUnderrun()`) em 5.C6 para nao drenar ao checar, C1.1 passos 1, 5, 6 e 7, edge case explicito do aplicativo parado por horas, e dois itens novos de T2.
3. **(W1) `DescribeSkipped` nao tinha acesso ao `vistas=<S>`.** A assinatura so recebia o `ProcessSnapshot`, e `sessionPids` e local de `Reconcile`: o implementador acabaria emitindo `skipped_.size()` (recusas) no lugar de sessoes enumeradas, quebrando o exemplo `vistas=3` de 2.4. Corrigido: `DescribeSkipped(const ProcessSnapshot&, size_t seenCount)` em 5.C6 e em C1.2 passos 2, 7 e 8, com a chamada literal `DescribeSkipped(*snapshot, sessionPids.size())`.
4. **(W2) O avanco do relogio nao tinha teto.** A propria rajada de 1 000 descartes usada em 3/T1 e em T6 produziria um salto unico de 10 segundos, invalidando a justificativa da premissa A2. Corrigido com `AUDIO_MAX_SKIP_MS = 200` (3/T3, 5b, B2.2 passos 2 e 4, edge case da rajada, caso novo em T6, linha RF-10 da matriz e a propria A2), deixando explicito que o teto limita o RELOGIO e nunca a contagem reportada.
5. **(W3) A conta de volume de log omitia dois pontos.** Faltavam o `activeLog` e o `skippedLog` do processo main, e o lado nativo estava calculado com 160 B por linha. Corrigido com uma tabela de sete linhas em 3/T1: **8 182 linhas, cerca de 1,15 MB em 4 horas**, propagado para o risco R2, a linha RNF-01 da matriz e a questao Q1. A conclusao contra o teto de 5 MB sobrevive com mais de 3 MB de folga.
6. **(W4) A drenagem exata na fronteira do tique nao tinha rampa.** Um anel que esvazia em cima da fronteira entrega um tique cheio seguido de um tique zerado: amplitude total para silencio, a mesma classe de clique que a feature corrige. Corrigido com a terceira transicao (cauda de decaimento a partir de `lastFrame_`) em 3/T2, 5.C2 (caso 3, com a nota de que ela e ATRIBUICAO e precisa entrar na soma), C1.1 passos 1, 4 e 5, e edge cases. A limitacao que sobra (fonte REMOVIDA da composicao) fica declarada com honestidade, no mesmo molde da limitacao de lookahead de 3/T3.
7. **(W5) O probe nao consegue exercitar duas fontes.** `scripts/audio-probe.mjs` sobe um unico emissor por cenario e nao esta no inventario de modificados. Corrigido sem prometer automacao inexistente: T2 ganhou um paragrafo dizendo o que ele NAO cobre e por que, a garantia passou a ser estrutural (rampa em `scratch`, risco R4 reescrito) e a escuta com duas fontes virou item de T8.
8. **(N1)** Os `static_cast<float>` entraram DENTRO do pseudo-codigo de 5.C2 e sao citados em C1.1 passo 5 (LESSONS 2026-08-26: o agente segue o trecho literal, nao a prosa ao lado).
9. **(N2)** 5.A3 ganhou um paragrafo dizendo que `InboundAudioStats` guarda ABSOLUTOS e que a linha de log carrega DELTAS (com o `jitter` de fora, porque delta de jitter nao significa nada), e o exemplo de 2.4 foi reescrito com a palavra `delta` e o campo `descartados`.
10. **(N3)** A linha `active` do passo a passo de 2.4 ganhou o sufixo `(<n> mudancas em <ms> ms)` que 5.A3 exige, e a linha `health` ganhou os quatro campos.
11. **(N4)** A chave de `warnedApps_` esta escrita com o cast (`static_cast<uint64_t>(pid) * 256ull + ...`) em 5.C6, e 5.C5 passo 3 exige `CoTaskMemFree` para cada `IMMDevice::GetId`, em todos os caminhos de saida.
12. **(N5)** Falha de `Activate` SO no dispositivo padrao deixaria `endpoints_` nao vazio, o degrau nunca rodaria e o unico endpoint que a versao anterior escaneava sumiria sem erro e sem log. Corrigido com o degrau em DOIS niveis (5.C5 passo 6a e 6b), o flag `DefaultEndpointBound()`, o campo `padrao=nao` no `detail` de `active`, tres edge cases novos em C1.3 e um item novo em T2.
13. **(N6)** Risco **R14** novo: nao existe sinal na interface quando um aplicativo ENTRA no mix pela enumeracao ampliada; a transparencia e o log de composicao mais a nota de release, e isso esta dito em uma frase.
14. **(passagem da revisao) Ordem da deduplicacao no `RoomScreen`.** `:117-118` consome a chave antes de qualquer ramo, entao um `app-not-captured` com `app` vazio queimaria a chave e suprimiria a reemissao seguinte, justamente a que faz o aviso funcionar. Corrigido em F1.1 passo 7 com um descarte antes do `alreadyWarned.has`, **sem mover as duas linhas existentes** (AC-15 preservado).

**Sem cascata**: nenhuma correcao acima muda a PRD. Nenhum RF, RNF ou AC foi reinterpretado; o que mudou foi o COMO. A matriz da secao 8 continua com 34 linhas e sem orfaos, e o Baseline da secao 1 continua valido (nenhum arquivo de codigo foi tocado por esta revisao).

