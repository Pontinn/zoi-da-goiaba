---
feature: black-screen-notice
language: pt-BR
code_identifier_language: en - mirrors-existing-codebase
generated: 2026-08-25
stack: Electron 43.4.1 (Chromium ~150.x) + React 18 + Vite 7 (electron-vite) + TypeScript 5.9, Windows-only, PeerJS 1.5.5 (WebRTC mesh), Zustand 5, Vitest 4 + Playwright 1.62 (_electron)
---

## 0. Baseline (ancora de drift)

- HEAD: `6f1d2e53638f42d6261b4e255d7d41ce98a403fd` (branch `feature/black-screen-notice`, release v0.2.0)
- Fingerprint da IDEA (git hash-object): `81ca2b10dd10c74485bde6ca119925545b3a5852`
- Arquivos de codigo analisados (mudanca em qualquer um invalida este CONTEXT):
  - `src/renderer/src/ui/screens/PlayerView.tsx` - `8c19aed07505b9e3c3ef946c6ae9381c646e196e`
  - `src/renderer/src/ui/components/ReconnectOverlay.tsx` - `905e6d388abf436aca091cdf8ee87aa3da54d9ec`
  - `src/renderer/src/ui/components/MediaFailureOverlay.tsx` - `cb48826f23d931a0b19188267ad24f1343d0ba58`
  - `src/renderer/src/ui/components/StreamThumbnail.tsx` - `87623465ee5c671dac3532395a7c6b6250a7aea2`
  - `src/renderer/src/ui/components/TransmissionStatusCard.tsx` - `85759021a38a3307348123201d04972522ca3327`
  - `src/renderer/src/ui/screens/RoomScreen.tsx` - `173beb6e384d52b421784a7deee947435a190206`
  - `src/renderer/src/services/media-manager.ts` - `40ffdb0b4231a910dcca48cbfd2f50f3d91978ac`
  - `src/renderer/src/services/stats-monitor.ts` - `282b4ff7f71b5054d731337fa4bc15769d075cf1`
  - `src/renderer/src/store/room-store.ts` - `98a43aa50a2a946029e05cd6854d573cc57b2f46`
  - `src/renderer/src/core/room-state.ts` - `6305e45922f29c380910f398cada47f4f5df0fae`
  - `src/shared/config.ts` - `9a3748749b649a05069dd6464a758ed1cdec033b`
  - `src/main/file-logger.ts` - `ef18c057fc8150f8e4ee06fcd6d94c29b5e5a417`
  - `src/renderer/src/ui/theme.css` - `9bb42a60b97c49461c2d146f8dafc8fad42b3b2d`
  - `src/renderer/src/ui/components/components.css` - `5ddabd594454f701657686a09570b6836bf8b704`
  - `src/renderer/src/ui/screens/player.css` - `19f7ba2209601641f8c50478f30027f65ee5c6d5`
  - `tests/unit/media-manager.test.ts` - `1a467fefc613145243eacd8a75f1ba86c40d5a0a`
  - `tests/e2e/helpers/zoi-app.ts` - `48df4f186ae4e384db7aa401a73ff98ee3fed79d`
  - `package.json` - `1c99caa14f6dad367ff876906e74e2e4891f04ff`

## 1. Stack e build

- `electron@43.4.1`, `electron-vite@5.0.0`, `electron-builder@26.15.3`, `peerjs@1.5.5`, `react@18.3.1`, `zustand@5.0.15`, `typescript@5.9.3`, `vitest@4.1.11`, `@playwright/test@1.62.1`. Sem libs de UI/animacao externas (motion e so CSS + `@keyframes`).
- Scripts: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run test:e2e` (build + Playwright `_electron`), `npm run dist`.
- `tsconfig.web.json` tipa os testes unitarios (sem `node`/`electron`); nao importar `src/main/*` em `tests/unit`.
- Nova dependencia desde o ultimo CONTEXT (app-audio-capture): `zoi-audio-capture` (`file:native/zoi-audio-capture`), addon nativo ja integrado e fora do escopo desta feature.

## 2. Arquivos e modulos relevantes

### Player e overlays (onde o aviso entra)
- `src/renderer/src/ui/screens/PlayerView.tsx`: monta o `<video>` (linha 149-155, `autoPlay`, `playsInline`, sem `muted` por padrao) e recebe `stream`, `reconnecting`, `failed` como props ja prontas vindas do `RoomScreen`. `attachedRef` garante que `srcObject` so e atribuido UMA vez por stream (linha 56-64, regra de performance). Overlays hoje: `{reconnecting ? <ReconnectOverlay/> : null}` e `{!reconnecting && failed ? <MediaFailureOverlay/> : null}` (linhas 167-169) - JA existe uma precedencia explicita entre os dois; o aviso desta feature entra como um TERCEIRO ramo, condicionado a nao ter nem `reconnecting` nem `failed` (e a ainda nao ter pintado o primeiro quadro).
- `src/renderer/src/ui/components/ReconnectOverlay.tsx` e `MediaFailureOverlay.tsx`: cartao central `role="status"`, classes `z-reconnect`/`z-reconnect--failure`, icone + texto + hint. Este e o "terceiro estado da familia" citado na IDEA secao 9.
- `src/renderer/src/ui/screens/player.css`: `.z-reconnect` (linha 142-165, overlay `position: absolute; inset: 0` sobre o `.z-player`, fundo `#000000a6`, `animation: z-fade-in`), `.z-reconnect--failure` (fundo mais opaco), `.z-reconnect__icon`/`__text`/`__hint`. Vocabulario pronto pra reaproveitar na aparencia do novo aviso.
- `src/renderer/src/ui/components/StreamThumbnail.tsx`: ja tem uma versao INGENUA de "aguardando" na miniatura (linha 68-72, `stream ? null : <span>conectando video...</span>`) baseada so em existir o objeto `MediaStream`, nao em quadro pintado. A IDEA escopa o aviso so para o PLAYER (nao pede mudanca na miniatura), mas vale citar como precedente de copy e como algo que NAO deve ser confundido com a deteccao nova (o objeto `MediaStream` chegar nao prova midia fluindo, mesma licao do watchdog).

### Watchdog de midia ja existente (reaproveitavel/coexistente)
- `src/renderer/src/services/media-manager.ts`, secao "vigia da midia recebida (tela preta silenciosa)" (linhas 647-751): `startIncomingWatch` arma um timer de `MEDIA_STALL_TIMEOUT_MS` (10s, `src/shared/config.ts` linha 110) e escuta `connectionstatechange` (`trackConnectionState`, linha 668-687) e o evento `unmute` da track de video (`watchIncomingTrack`, linha 690-700). `isIncomingHealthy` (linha 703-710) so retorna saudavel quando `connectionState === 'connected'` E `!track.muted`. Isso e EXATAMENTE o par de sinais (`connectionState` + `track.muted`/`unmute`) que a IDEA pede para a deteccao - ja existe, mas hoje so alimenta `mediaFailures` (o terceiro overlay, mais grave, com prazo de 10s) e dispara `startMediaPull` (fallback de direcao). NAO deve ser tocado/duplicado: a feature nova PRECISA de um sinal equivalente, mas para um proposito diferente (aviso calmo, nao fallback), e ainda precisa do sinal de PINTURA (`requestVideoFrameCallback`), que so existe no elemento `<video>` do DOM, fora do alcance do `MediaManager` (que so ve `MediaStream`/`RTCPeerConnection`).
- `mediaFailures: ReadonlySet<string>` chega em `useRoomStore` via `subscribeMediaFailures` (`room-store.ts` linha 72-73) e alimenta a prop `failed` do `RoomScreen` (linha 290). `reconnecting` vem de outro lugar: `TransmissionState.status` (`room-state.ts` linha 40, `'live' | 'reconnecting'`), setado por `PEER_LINK`/heartbeat (linha 1018-1054), reflete o link de SINALIZACAO do peer dono da transmissao, nao a midia em si. Os dois sinais sao INDEPENDENTES e ja convivem hoje: o aviso novo e um terceiro, mais fraco, que so aparece quando nenhum dos dois esta ativo.

### Coletor de `getStats()` (qualidade da sala)
- `src/renderer/src/services/stats-monitor.ts`: `StatsMonitor.sample()` (linha 62-107) roda a cada `QUALITY_UPDATE_INTERVAL_MS` (3s) e itera `callbacks.inboundConnections()` (todas as `RTCPeerConnection` de ENTRADA, de `media-manager.ts` `inboundConnections()` linha 758-764) somando `bytesReceived`/`packetsLost`/`packetsReceived` de reports `inbound-rtp` de TODAS as conexoes JUNTAS num unico `QualityReport` agregado (nao ha leitura por-transmissao hoje). Esse agregado unico alimenta `room.quality` (indexado por `peerId`, nao por `txId`) via `onReport` -> broadcast `QUALITY_UPDATE`.
- ACHADO IMPORTANTE para o planejamento: como o coletor soma TODAS as conexoes de entrada num so relatorio, ele NAO DA para extrair `framesDecoded`/`framesReceived` POR transmissao sem alguma restruturacao (mesmo que pequena: por exemplo, o `inbound-rtp` report do `getStats()` de uma pconn especifica corresponde a UMA transmissao, entao a leitura por-txId e possivel se o `StatsMonitor` (ou um coletor novo ao lado dele) iterar conexao-a-conexao em vez de somar cedo demais). A IDEA explicitamente pede reaproveitar esta MESMA estrutura para a `video-codec-upgrade` (que le `encoderImplementation`/`qualityLimitationReason`, tambem por-transmissao). Portanto: o SPEC desta feature precisa decidir se estende `StatsMonitor` para expor por-txId (quebrando a soma cedo) ou se cria um segundo consumo do MESMO `getStats()` já chamado por conexao, sem abrir uma segunda chamada `getStats()` concorrente (custo).
- `RTCInboundRtpStreamStats` no `lib.dom` do TS ja expoe `framesDecoded`/`framesReceived`/`framesDropped`/`freezeCount` (mesma interface hoje usada so para `bytesReceived`/`packetsLost`/`packetsReceived` em `stats-monitor.ts` linha 74-79); nao ha nenhum polyfill nem cast estranho no meio, e trivial ler os campos novos do mesmo objeto `report`.

### Logging persistente (registrar tempo ate o primeiro quadro)
- `src/main/file-logger.ts`: `attachRendererLogging` (linha 147-151) espelha automaticamente TODO `console.*` do renderer (via evento `console-message` do `webContents`) para `userData/logs/zoi-AAAA-MM-DD.log`. Ou seja, NAO existe (nem precisa existir) uma API de log dedicada do lado do renderer: registrar o tempo ate o primeiro quadro e so um `console.info('[player] primeiro quadro em Xms', ...)` (ou nivel equivalente) no ponto certo do PlayerView/media-manager - o arquivo em disco recebe automaticamente. Precedente de formato: `console.info('[media] ...')`/`console.warn('[media] ...')` com prefixo de modulo entre colchetes, ja convencao em todo `media-manager.ts` e `stats-monitor.ts`.
- Nao ha botao "abrir logs" no codigo do renderer pesquisado diretamente por esse texto; a pasta e exposta via `getLogDirectory()`/IPC (`ipc-handlers.ts`) - fora do escopo desta feature tocar a UI de logs, so USAR o `console.*` existente.

## 3. Padroes existentes similares

- **Familia de overlays do player** (`ReconnectOverlay`, `MediaFailureOverlay`): cartao central sobre o video, `role="status"`, `data-testid` proprio, classes base `z-reconnect` + modificador. O aviso novo deve nascer como um TERCEIRO componente irmao (ex.: algo como `FirstFrameOverlay`/`WaitingOverlay`, nome a decidir no SPEC), reaproveitando `.z-reconnect` como base e adicionando so o que for exclusivo dele (progress indicator, logo, crossfade de estagio).
- **Card de status com logo animada** (`TransmissionStatusCard.tsx` + `.z-status-card` em `components.css` linha 743-861): referencia DIRETA de motion pedida pela IDEA secao 9 ("no espirito do bounce ja usado no card de status"). A logo usa `animation: z-status-bounce-in 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both` (unica excecao de easing do app, comentario no proprio CSS linha 241-245 do `theme.css`); titulo com `z-fade-rise` com delay; contagem com `z-count-roll-in`. Isso e o vocabulario de entrada a imitar na aparicao do aviso apos a carencia de 1,5s.
- **UI/visual area**: o player (`PlayerView.tsx` + `player.css`), especificamente a area do overlay central `.z-reconnect` dentro de `.z-player`. Referencia de identidade: `ReconnectOverlay.tsx`/`MediaFailureOverlay.tsx` (estrutura e classes) e `TransmissionStatusCard.tsx` (motion da logo/marca). Tema escuro + roxo `--accent: #9d00ff` (`theme.css` linha 20), ja documentado.
- **Loop continuo leve e ja usado e aceito**: `.z-spinner`/`.z-spinner--lg` (`components.css` linha 728-741, `animation: z-spin 800ms linear infinite`, so `transform: rotate`) dentro do proprio `ReconnectOverlay`; e `z-live-pulse` (`theme.css` linha 206-215, so `opacity`) no ponto "ao vivo". Sao os DOIS precedentes diretos para o "indicador de progresso vivo" pedido na IDEA secao 9 para o estagio de espera (loop continuo justificado, mas leve: so `transform`/`opacity`).
- **`prefers-reduced-motion`**: tratado GLOBALMENTE em `theme.css` linhas 62-77 (zera todas as duracoes e `animation-iteration-count: 1`) - nenhuma tela precisa reimplementar a checagem, mas o SPEC deve confirmar que o LOOP do indicador de espera nao vira "trava visualmente estranha" quando a duracao zera (ex.: um spinner com `iteration-count: 1` para no meio do giro); o app ja convive com isso no `.z-spinner` existente, entao ha precedente de como esse caso e aceito hoje.

## 4. Arquitetura e dados

Fluxo de uma transmissao remota do ponto de vista de quem assiste:
1. `MediaManager.onIncomingCall` autoriza a chamada (roster + txId anunciado) e chama `bindIncoming` (linha 537), que registra `call.on('stream', ...)` -> guarda em `remoteStreams` (Map txId -> MediaStream) e notifica via `notifyStreams()`.
2. Em PARALELO, `startIncomingWatch` (linha 649) arma o vigia: timer de 10s + `connectionstatechange` + `unmute` da track.
3. `room-store.ts` espelha `remoteStreams` em `useRoomStore.streams` e `mediaFailures` em `useRoomStore.mediaFailures`; `room.transmissions[txId].status` (`'live'|'reconnecting'`) chega via reducer puro (`room-state.ts`) alimentado pelo broadcast do mesh (independente do `MediaManager`).
4. `RoomScreen.tsx` le os tres (`streams`, `mediaFailures`, `room.transmissions[..].status`) e monta `PlayerView` com `stream`, `reconnecting`, `failed` prontos (linha 282-294).
5. `PlayerView` atribui `srcObject` UMA vez (linha 56-64) e decide os overlays por precedencia manual no JSX (linha 167-169).

Onde o novo estado entra: o `PlayerView` (ou um hook novo dedicado, ex.: `useFirstFrameSignal(videoRef, stream)`) precisa combinar tres fontes que HOJE NAO se cruzam nenhuma com a outra:
- o proprio elemento `<video>` (via `requestVideoFrameCallback`, sinal de PINTURA, so existe no DOM);
- a track de video da `stream` recebida como prop (`track.muted`/`unmute`, MESMO sinal que o watchdog do `MediaManager` ja escuta, mas de forma independente - o `PlayerView` nao tem acesso direto ao `IncomingWatch` interno do `MediaManager`, so a `MediaStream` publica via `streams.get(txId)`);
- opcionalmente `getStats()` do lado do RECEPTOR para `framesDecoded`/`framesReceived` (hoje so acessivel via `RTCPeerConnection`, que o `MediaManager` tem mas NAO expoe por txId para a UI - so agregado via `StatsMonitor`).

Isso significa que o SPEC provavelmente precisa de UM NOVO PONTO de leitura por-txId (seja expandindo o que o `MediaManager` expoe para a UI, seja lendo so do lado do DOM com `requestVideoFrameCallback` + `track.muted` sem precisar de `getStats()` para a deteccao em si, usando o `getStats()` so pra log/instrumento). A IDEA pede os tres sinais combinados, mas note que `requestVideoFrameCallback` sozinho ja responde com precisao "o quadro foi pintado" - vale o SPEC decidir o peso relativo de cada sinal (ex.: `requestVideoFrameCallback` como fonte de verdade da UI, track `muted`/`unmute` e `getStats()` como reforco/log).

## 5. Pontos de integracao

- Nenhum servico externo novo. Toda a deteccao e local ao processo do RENDERER (WebRTC nativo do Chromium via `RTCPeerConnection`/`MediaStreamTrack`/`HTMLVideoElement`), sem IPC novo com o `main` (o `file-logger.ts` ja espelha `console.*` automaticamente, entao nao precisa de canal novo para logging).
- PeerJS/STUN/GitHub Releases: nao tocados por esta feature (citados so por nao-regressao, igual ao CONTEXT anterior).

## 6. Convencoes

- **Identificadores de codigo**: 100% em ingles. Exemplos do repo: `startIncomingWatch`, `isIncomingHealthy`, `MEDIA_STALL_TIMEOUT_MS`, `subscribeMediaFailures`, `watchIncomingTrack`. `code_identifier_language: en`.
- **Comentarios e strings de UI**: pt-BR sem acento, sem travessao (ex.: `"reconectando..."`, `"O video de {nickname} nao chegou ate voce"`, `"conectando video..."`). O texto do novo aviso deve seguir o MESMO tom (frases curtas, sem acento, sem travessao, ja verificado em `ReconnectOverlay`/`MediaFailureOverlay`).
- **Componentes**: `memo(function Nome(...))` quando repetido em lista (`StreamThumbnail`); componentes de overlay unico (`ReconnectOverlay`, `MediaFailureOverlay`) sao funcoes simples sem memo (baixo custo, montagem/desmontagem rara).
- **CSS**: prefixo `z-`, BEM-like (`z-reconnect__hint`, `z-status-card--tile`), tokens SEMPRE via variavel (`var(--accent)`, `var(--dur-enter)`, `var(--ease)`), nunca valor cru fora de excecoes documentadas (ex.: o easing "bounce" da logo e a UNICA excecao citada no proprio CSS).
- **Constantes de tempo**: todas centralizadas em `src/shared/config.ts`, exportadas com sufixo `_MS`, com comentario explicando o PORQUE do valor (nao so o valor). Os dois novos limiares desta feature (1500ms de carencia, 12000ms de escalada) devem entrar la, do lado de `MEDIA_STALL_TIMEOUT_MS` (10s) - repare que o segundo estagio (12s) e ligeiramente MAIOR que o timeout de falha de midia (10s): na pratica, se a midia realmente nao chegar, o `MediaFailureOverlay` (mais severo, com hint de "peca pra reiniciar") ja teria assumido por volta dos 10s, ANTES do segundo estagio deste aviso (12s) aparecer - a IDEA ja decidiu que os overlays existentes tem precedencia, entao esse cruzamento de tempos e esperado e nao um bug: em geral quem chega ao estagio 2 do aviso de espera e porque a midia NAO caiu tecnicamente (nao vira `failed`), so ainda nao pintou nada (ex.: decodificacao lenta, resolucao alta, maquina fraca).
- **Testes unitarios**: `tests/unit/media-manager.test.ts` mostra o padrao de fakes manuais (`FakePeerConnection`, `FakeTrack` com `muted`/`unmute`, `FakeStream`) SEM biblioteca de mock de WebRTC, com `vi.useFakeTimers()` para avancar os prazos. Um teste para o novo hook/logica de primeiro-quadro deve seguir o MESMO estilo (fake de `HTMLVideoElement`/`requestVideoFrameCallback` manual, sem jsdom-real de video). Vitest roda no projeto WEB (sem `document`/`AudioContext` reais por padrao - precisa de `vi.stubGlobal` como ja feito na secao "stream ficticia da chamada reversa", linhas 748-757 do `media-manager.test.ts`, para simular `document`/`AudioContext`; o mesmo se aplica a `HTMLVideoElement.prototype.requestVideoFrameCallback`, que nao existe no ambiente Node/jsdom do Vitest sem stub).
- **Testes e2e**: `tests/e2e/*.spec.ts` com `_electron`, helper `tests/e2e/helpers/zoi-app.ts`, `expectNoDirectionFallbacks` (linha 274) para provar que fallbacks de direcao NAO dispararam num caminho saudavel. `MEDIA_TIMEOUT_MS = 90_000` (linha 29) ja e o tempo que os specs esperam ate "o primeiro frame do outro lado" (comentario da propria constante), mas hoje NAO ha um helper que leia `videoWidth`/`requestVideoFrameCallback` diretamente - o e2e provavelmente so aguarda o `.z-player`/ausencia de overlays via seletor. Simular "nunca chega quadro" em e2e real e caro (precisaria de um par que trava a midia de proposito); a rota mais barata para testar os DOIS estagios do aviso e unit/component-level (fake de `HTMLVideoElement` e `MediaStreamTrack`), reservando o e2e para checar que os overlays existentes (`reconnecting`/`failed`) continuam com precedencia (jah coberto indiretamente por specs existentes) e que o app buildado nao quebra com o aviso novo no caminho feliz.
- Convencao geral do apendice da IDEA: aguardar `.z-doors` sumir antes de asserir na tela de sala nos specs e2e (transicao de entrada da sala).

## 7. Restricoes e riscos

- **Nao duplicar o watchdog de midia**: ja existe um vigia com timer + `connectionstatechange` + `unmute` em `MediaManager` (secao 647-751), com objetivo DIFERENTE (fallback de direcao + overlay de falha definitiva, 10s). O aviso novo precisa de sinais PARECIDOS mas para um proposito mais brando (informar espera, nunca acionar pull nem marcar falha) - risco real de acabar como uma segunda maquina de estados paralela se o SPEC nao deixar claro que fonte de dado cada overlay consome. Reaproveitar o MESMO evento (`unmute`) como entrada nao e proibido, mas o codigo que REAGE a ele (o que dispara quando) tem que ficar separado do `markMediaFailure`/`startMediaPull`.
- **`StatsMonitor` agrega TODAS as conexoes de entrada num relatorio so** (secao 4 acima): usar `getStats()` por-txId para o log do tempo-ate-primeiro-quadro (ou para reforcar a deteccao) exige ou (a) uma chamada `getStats()` adicional direta na `RTCPeerConnection` daquele txId (o `MediaManager` ja tem acesso via `watch.call.peerConnection`), ou (b) estender o `StatsMonitor` para nao agregar cedo demais - decisao de arquitetura que o SPEC precisa tomar, ciente que a `video-codec-upgrade` (proxima feature) vai querer a MESMA extensao por-txId (`encoderImplementation`/`qualityLimitationReason`). Fazer a extensao pensando nas duas evita retrabalho.
- **Fallbacks de direcao (NAO regredir)**: `expectNoDirectionFallbacks` no e2e prova que em rede saudavel nada de `media-pull`/`dialback` aparece no console. Como esta feature e OBSERVACIONAL (nao mexe em `startTransmission`/`callPeer`/`answerPull`/`startMediaPull`), o risco e baixo, mas qualquer novo listener em `MediaStreamTrack`/`RTCPeerConnection` colocado por engano DENTRO do `MediaManager` (em vez de no `PlayerView`/hook de UI) pode interferir com os listeners que ja existem la se nao for cuidadoso com `addEventListener`/`removeEventListener` duplicados no mesmo track.
- **Performance no caminho de render de video**: `requestVideoFrameCallback` roda a CADA quadro decodificado enquanto agendado; a IDEA exige que ele so sirva para capturar o instante do PRIMEIRO quadro e entao pare de se reagendar (nunca continuar chamando `requestVideoFrameCallback` durante a exibicao normal, ou o custo por frame vira permanente, ferindo o pilar de performance). Isso e uma escolha de implementacao critica: agendar so ATE o primeiro sucesso, cancelar (`cancelVideoFrameCallback`) se o componente desmontar ou o `txId`/stream trocar antes disso.
- **Troca de fonte / renegociacao (RF citada na IDEA secao 8)**: `switchSource` gera `txId` NOVO (`stopTransmission` + `startTransmission`, ja documentado no CONTEXT da app-audio-capture); do lado de quem assiste, isso significa uma NOVA `LocalTransmission`/nova chamada, ou seja, o `PlayerView` remonta com `key={selected.txId}` (RoomScreen linha 282-283 ja usa `key`) - o hook de primeiro-quadro reinicia do zero automaticamente gracas a esse `key`, sem precisar de logica extra de reset. Confirmar isso no SPEC evita reinventar um reset manual.
- **Aba em segundo plano**: o Chromium pode atrasar/pausar callbacks de rAF-like (`requestVideoFrameCallback` tende a continuar rodando mesmo em background para video, mas o SPEC deve validar; se atrasar, o aviso nao pode disparar falso so por causa de throttling de aba oculta - a IDEA ja lista isso como caso de borda a NAO QUEBRAR, sem solução determinada aqui).

## 8. Pontos em aberto (o codigo nao responde)

1. Se `requestVideoFrameCallback` do Chromium embutido no Electron 43 (~Chromium 150.x) sofre throttling perceptivel quando a janela do app esta em segundo plano/minimizada, e se isso poderia atrasar o "primeiro quadro pintado" o suficiente para disparar o aviso por engano (a IDEA pede que isso NAO aconteca, mas o codigo atual nao tem nenhum precedente de throttling de video em background para consultar).
2. Formato exato do texto de log do tempo-ate-primeiro-quadro (nivel `info`/`debug`, se agrega por txId ou por peerId, se some do log quando a transmissao para) - a infraestrutura (`console.*` -> arquivo) existe, mas o formato da linha em si e decisao de SPEC.
3. Se o segundo estagio (12s) deve reiniciar a contagem quando `reconnecting`/`failed` some no meio da espera (ex.: a midia ficou `reconnecting` por 3s dentro da janela de espera, volta a `live`, e so entao o relogio de 12s do aviso calmo comeca a contar) - a IDEA resolve a PRECEDENCIA visual mas nao deixa explicito se o cronometro do aviso PAUSA ou CONTINUA rodando por baixo enquanto os overlays mais graves estao na frente.
4. Onde exatamente expor a leitura de `framesDecoded`/`framesReceived` por-txId para a UI sem duplicar `getStats()` (extensao do `StatsMonitor` vs. leitura direta no `MediaManager`/hook) - ponto tecnico que o SPEC precisa fechar antes de codar, ja adiantado na secao 4/7 acima.

## Nota de seguranca

Nenhum segredo, credencial, chave, token ou valor de variavel de ambiente foi encontrado ou incluido neste documento. Nomes de servicos (PeerJS, STUN) citados so pelo nome.
