---
feature: black-screen-notice
language: pt-BR
generated: 2026-08-25
stack: Electron 43.4.1 (Chromium ~150.x) + React 18 + Vite 7 (electron-vite) + TypeScript 5.9, Windows-only, PeerJS 1.5.5 (WebRTC mesh), Zustand 5, Vitest 4 + Playwright 1.62 (_electron)
status: spec
prd_source: PRD_black-screen-notice.md @ d9eb4286bb35f8caa80533480c51cff84f442189
---

# SPEC - black-screen-notice

## 1. Baseline (ancora de drift)

- **HEAD**: `264318e6f7aeca748d7707e3308ec61256ceae7b` (branch `feature/black-screen-notice`)
- **Fingerprint PRD_black-screen-notice.md** (git hash-object): `d9eb4286bb35f8caa80533480c51cff84f442189` (revisao 2)
- **Fingerprint CONTEXT_black-screen-notice.md**: `3607b3266d176fe681c49b438bedabdfb8057d9e`
- **Fingerprint UISPEC_black-screen-notice.md**: `51da1650771a2f19543b9569cd0e6b5b2d54cf03` (source: render-captured; secao 6 e contrato de motion VINCULANTE para RF-18..RF-21)
- Arquivos de codigo dos quais este SPEC depende (mudanca em qualquer um exige reconferir):

| Arquivo | Fingerprint |
|---|---|
| `src/renderer/src/ui/screens/PlayerView.tsx` | `8c19aed07505b9e3c3ef946c6ae9381c646e196e` |
| `src/renderer/src/ui/components/ReconnectOverlay.tsx` | `905e6d388abf436aca091cdf8ee87aa3da54d9ec` |
| `src/renderer/src/ui/components/MediaFailureOverlay.tsx` | `cb48826f23d931a0b19188267ad24f1343d0ba58` |
| `src/renderer/src/services/media-manager.ts` | `40ffdb0b4231a910dcca48cbfd2f50f3d91978ac` |
| `src/renderer/src/services/stats-monitor.ts` | `282b4ff7f71b5054d731337fa4bc15769d075cf1` |
| `src/renderer/src/services/session.ts` | `f0c4dd84260e7d13713a56555cb39b982792a68e` |
| `src/renderer/src/store/room-store.ts` | `98a43aa50a2a946029e05cd6854d573cc57b2f46` |
| `src/renderer/src/ui/screens/RoomScreen.tsx` | `173beb6e384d52b421784a7deee947435a190206` |
| `src/shared/config.ts` | `9a3748749b649a05069dd6464a758ed1cdec033b` |
| `src/main/index.ts` | `3b41b87be749cca8ab2439a2fce3e1ec835a2bfd` |
| `src/main/file-logger.ts` | `ef18c057fc8150f8e4ee06fcd6d94c29b5e5a417` |
| `src/renderer/src/ui/theme.css` | `9bb42a60b97c49461c2d146f8dafc8fad42b3b2d` |
| `src/renderer/src/ui/components/components.css` | `5ddabd594454f701657686a09570b6836bf8b704` |
| `src/renderer/src/ui/screens/player.css` | `19f7ba2209601641f8c50478f30027f65ee5c6d5` |
| `tests/unit/media-manager.test.ts` | `1a467fefc613145243eacd8a75f1ba86c40d5a0a` |
| `tests/e2e/helpers/zoi-app.ts` | `48df4f186ae4e384db7aa401a73ff98ee3fed79d` |
| `tests/e2e/smoke-session.spec.ts` | `0b58e8d46021c71fe4f785b734b5a150556b8bbf` |

## 2. Design Overview

**Forma da feature**: este e um app desktop Electron P2P. NAO existe servidor HTTP nem API: esta feature cria ZERO endpoints, tem ZERO entidades persistidas e ZERO papeis/permissoes (as secoes 2b, 5, 5b e 5c dizem isso explicitamente em vez de inventar conteudo). Todo o trabalho e no processo RENDERER (frontend), com um unico ponto de observabilidade compartilhado: o log em arquivo, que ja existe (`src/main/file-logger.ts` espelha todo `console.*` do renderer, nada novo no processo main). Por isso este SPEC nao tem secao Backend (ver secao 6).

**Convencao de identificadores**: 100% em ingles (`code_identifier_language: en` no CONTEXT), estilo do repo (camelCase para funcoes/variaveis, PascalCase para classes/componentes, constantes de tempo em `SCREAMING_SNAKE` com sufixo `_MS` centralizadas em `src/shared/config.ts`, CSS com prefixo `z-` BEM-like). Prose e strings de UI em pt-BR sem acento e sem travessao.

**Arquitetura da solucao**, em tres pecas independentes que se encontram no `PlayerView`:

1. **Maquina de estados pura `FirstFrameWatch`** (`src/renderer/src/services/first-frame-watch.ts`, novo): relogio pausavel com carencia de 1,5s (`FIRST_FRAME_GRACE_MS`) e escalada aos 12s efetivos (`FIRST_FRAME_ESCALATE_MS`), prova dupla de quadro (pintado OU decodificado, RF-03/F2), reset por troca de faixa (F3) e emissao do log de diagnostico (RF-16/RF-17). Nao toca DOM nem WebRTC: recebe SINAIS por metodos (`reportFramePainted`, `reportFramesDecoded`, `setBlocked`, `reportTrackChange`, `dispose`). Isso a torna testavel no Vitest node (sem Testing Library, que o projeto nao tem) no mesmo estilo de fakes manuais de `tests/unit/media-manager.test.ts`.

2. **Extensao por-transmissao do coletor de stats existente** (RNF-05/F5): o `StatsMonitor` passa a receber as conexoes de entrada ETIQUETADAS por `txId` (`inboundEntries()` no lugar de `inboundConnections()`), e no MESMO laco de `sample()` que ja roda a cada 3s extrai, alem do agregado atual (intocado), um `ReadonlyMap<string, InboundVideoStats>` com `framesDecoded`/`framesReceived` do report `inbound-rtp` de video de cada conexao. Nenhuma chamada `getStats()` nova, nenhum segundo timer. O mapa flui `StatsMonitor -> Session (listener) -> room-store -> RoomScreen -> prop do PlayerView`, espelhando o caminho que `quality` ja percorre. Esta e a estrutura que a `video-codec-upgrade` vai estender (ver "forma da extensao" na Feature 2.1).

3. **`WaitingOverlay`** (`src/renderer/src/ui/components/WaitingOverlay.tsx`, novo): terceiro irmao de `ReconnectOverlay`/`MediaFailureOverlay`, herdando a classe base `.z-reconnect` (fundo `#000000a6`, nunca o `--failure`), com a logo do app como elemento caracteristico e os quatro momentos de motion definidos VERBATIM na secao 6.3 do UISPEC. Entra no JSX de `PlayerView.tsx` como TERCEIRO ramo de precedencia, depois de `reconnecting` (linha 167) e `failed` (linha 169), gated em nenhum dos dois estar ativo (RF-08). Anti-flash (decisao fechada com o usuario na revisao 2): depois que o aviso APARECEU, ele permanece visivel por pelo menos `WAITING_MIN_VISIBLE_MS` (300ms) antes de a saida comecar; sem isso, um quadro chegando em ~1,6s faria o aviso aparecer e sumir em ~100ms, um flash que le como defeito da interface, nao como informacao. Com o minimo, ou o usuario nao ve nada (quadro dentro da carencia) ou ve uma mensagem legivel seguida de revelacao suave; nao existe o meio termo que parece bug.

**INVARIANTE - o video nunca espera o overlay**: nem o minimo visivel nem a animacao de saida podem atrasar EM NADA a exibicao do video. O elemento `<video>` recebe `srcObject` e toca por baixo o tempo todo (effect das linhas 56-64 do `PlayerView`, intocado); o que sai devagar e apenas o VEU escuro do overlay (opacity), nunca um quadro retido. E proibido ao agente de implementacao inventar qualquer "espera a animacao terminar antes de mostrar o video": nao existe nenhum acoplamento entre o pipeline de midia e a coreografia de saida, apenas o overlay semitransparente desaparecendo por cima de um video que ja esta rodando.

**Resolucao das tres questoes delegadas pela PRD**:

- **Q1 (`requestVideoFrameCallback` em janela oculta)**: a spec do rVFC (WICG video-rvfc) roda os callbacks dentro dos rendering steps do documento; documento sem oportunidade de render nao pinta, logo o callback nao dispara enquanto oculto NUM NAVEGADOR COMUM. Mas este app ja roda com `backgroundThrottling: false` (verificado em `src/main/index.ts` linhas 63-68, decisao antiga por causa do heartbeat do PeerJS), e a documentacao oficial do Electron diz textualmente: com `backgroundThrottling` desabilitado, o `document.visibilityState` permanece `visible` mesmo com a janela minimizada, ocluida ou oculta, e animacoes/timers NAO sao estrangulados. Consequencia dupla para RF-04: (a) a condicao "janela oculta" nunca dispara via Page Visibility API neste app, e (b) exatamente por isso a pintura CONTINUA acontecendo minimizado, entao a prova de quadro pintado continua chegando e nao ha falso positivo a evitar. O design implementa a pausa por visibilidade mesmo assim (listener de `visibilitychange` + leitura de `document.visibilityState`), como ramo DEFENSIVO: se um dia `backgroundThrottling` voltar a `true`, a pausa passa a funcionar sozinha; enquanto nao volta, o ramo e inerte e o comportamento degrada com seguranca nas duas direcoes (nunca um aviso falso). A prova dupla (decodificado via `getStats`) e a segunda rede: cobre o cenario teorico de compositor sem apresentar frame com a janela ocluida. Registrado tambem como [ASSUMPTION] na secao 9.
- **Q2 (linha de log)**: emitida pela propria `FirstFrameWatch`, via `console.*` (que `attachRendererLogging`, `src/main/file-logger.ts` linhas 147-151, ja espelha no arquivo diario; zero plumbing novo). Prefixo de modulo `[player]`, seguindo a convencao `[media]`/`[stats]`/`[session]`. Caminho feliz, `console.info`: `[player] primeiro quadro de <txId> em <ms>ms (aviso: nenhum|espera|escalado)`, onde `<ms>` e tempo de PAREDE desde a abertura da visualizacao e o rotulo e o estagio maximo alcancado. Fechou sem nunca receber quadro, `console.warn` (destaca o desfecho anomalo no arquivo): `[player] visualizacao de <txId> fechada sem nenhum quadro apos <ms>ms (aviso: espera|escalado)`. Uma linha por visualizacao aberta, garantida por flag interno (o `dispose()` do unmount do `PlayerView`, que remonta por `key={txId}`, cobre fechar o player, trocar de transmissao e a troca de fonte).
- **Q3 (onde expor `framesDecoded` por-transmissao)**: extensao do `StatsMonitor` (peca 2 acima), nunca um segundo laco. A leitura por-txId e possivel porque cada `RTCPeerConnection` de entrada corresponde a exatamente uma transmissao (`incomingCalls: Map<txId, MediaConnection>`, `media-manager.ts` linha 174); o que faltava era so a etiqueta. A `video-codec-upgrade` estende o MESMO `InboundVideoStats` com campos novos do MESMO report (ex.: `decoderImplementation`) e, se precisar do lado de SAIDA (`encoderImplementation`, `qualityLimitationReason` vivem no `outbound-rtp` do transmissor), adiciona um `outboundEntries()` simetrico no mesmo monitor e mesmo tick, jamais um coletor paralelo.

**Decisao de sinal**: o evento `unmute` da track NAO e prova de quadro. Ele indica RTP chegando, nao quadro decodificavel; no cenario que a `video-codec-upgrade` teme (pacotes chegam mas o decoder falha), `unmute` dispararia e `framesDecoded` ficaria em zero, exatamente o caso em que o aviso PRECISA aparecer. A prova e so a dupla do RF-03: pintado (rVFC) OU decodificado (`framesDecoded > 0`). Bonus estrutural: nenhum listener novo em track/pconn e criado, o que zera o risco de interferir nos listeners do watchdog do `MediaManager` (restricao dura).

**O que NAO muda**: negociacao de midia, fallbacks de direcao, watchdog (`startIncomingWatch`/`markMediaFailure`/`startMediaPull`, `media-manager.ts` linhas 647-751) e `StreamThumbnail` ficam intocados. A unica mudanca em `media-manager.ts` e a assinatura do metodo de leitura `inboundConnections()` (linhas 757-764), que e consulta passiva para o monitor de qualidade, fora de qualquer caminho de decisao de conexao.

## 2b. Mapa de ciclo de vida de entidades

Nao ha NENHUMA entidade persistida nesta feature (nao ha banco, nao ha API). Os dois estados efemeros, ambos morrendo com a sessao, sao:

| Entidade | Create | List | Edit | Delete | Notas |
|---|---|---|---|---|---|
| Espera de primeiro quadro (por visualizacao) | Mount do `PlayerView` (`key={txId}`, RoomScreen linha 283) instancia `FirstFrameWatch` | N/A - estado singular do player aberto, nao ha colecao | N/A - nao ha edicao; o estado so avanca por sinais (quadro, pausa, troca de faixa) | Unmount do `PlayerView` chama `dispose()`, que emite o log de desfecho | RF-10: reabrir cria instancia nova do zero. Nada sobrevive ao unmount |
| Stats de video por transmissao (`InboundVideoStats`) | Tick de 3s do `StatsMonitor` popula o mapa | Mapa inteiro em `useRoomStore.inboundVideoStats` (leitura) | N/A - substituido inteiro a cada tick, nunca editado | `Session.teardown()` notifica mapa vazio; entrada some quando a conexao de entrada some | Estrutura de extensao da `video-codec-upgrade` |

Nao ha round-trip de edicao a proteger: nada e escrito que precise ser lido de volta por formulario.

## 3. Trade-offs e alternativas rejeitadas

1. **Deteccao no `MediaManager` (estender o watchdog existente)** -> REJEITADO. O watchdog (linhas 647-751) alimenta `mediaFailures` e dispara `startMediaPull` (fallback de direcao); acoplar o aviso calmo nele e o risco exato que o CONTEXT secao 7 aponta (segunda maquina de estados entrelacada com o caminho de fallback) e violaria a restricao dura de nao tocar essa maquinaria. Alem disso o sinal de PINTURA so existe no elemento `<video>` do DOM, fora do alcance do `MediaManager`.
2. **`getStats()` extra por txId direto no `MediaManager`** (opcao (a) do CONTEXT secao 7) -> REJEITADO. Duplicaria chamadas `getStats()` sobre as mesmas conexoes que o `StatsMonitor` ja consulta a cada 3s: e um segundo consumo concorrente em tudo menos no nome, e deixaria a `video-codec-upgrade` sem a extensao prometida. A opcao (b), estender o monitor sem somar cedo demais, custa uma mudanca de assinatura pequena e serve as duas features.
3. **`unmute` da track como prova de quadro** -> REJEITADO (ver secao 2): prova RTP, nao decodificacao; falharia exatamente no cenario da feature seguinte, e exigiria listeners novos em tracks que o watchdog ja escuta.
4. **Amostragem de pixels** -> PROIBIDA por decisao explicita da IDEA/PRD (RNF-01); nem considerada.
5. **Indicador de espera: spinner reusado vs logo pulsando** -> LOGO PULSANDO. A IDEA pede a logo como elemento caracteristico ("a logo pulsando de leve") e o spinner ja significa "reconectando" dentro do `ReconnectOverlay`: reusar o mesmo elemento visual tornaria os dois estados indistinguiveis num relance, ferindo o proposito (espera calma vs problema). O pulso e um `@keyframes` novo SO de opacity no espirito medido de `z-live-pulse` (UISPEC 6.3 momento 2, rota b, prevista como valida).
6. **Saida do overlay por `transition` de opacity vs `animation reverse` vs keyframe novo** -> KEYFRAME NOVO `z-fade-out` (rota 1 da secao 6.2 do UISPEC, na variante que ela mesma preve: "classe nova, keyframe identico invertido"). Motivo tecnico que descarta a transition: `.z-reconnect` ja tem `animation: z-fade-in ... both` (player.css linha 152), e `animation` com fill vence `transition` na mesma propriedade; uma transition de opacity no cartao seria ignorada. E o que descarta reaplicar o MESMO `z-fade-in` com `reverse both`: pela spec de CSS Animations (e no Chromium real), uma animacao so REINICIA quando o `animation-name` muda; trocar direction/fill de uma animacao ja terminada aplica retroativamente e o elemento SALTA para opacity 0, o corte seco que RF-21/AC-18 proibem. O nome novo reinicia a animacao e o fill `both` segura opacity 0 ate o unmount.
7. **Hook assinando `session` direto no `PlayerView` vs plumbing pela store** -> STORE. `PlayerView` hoje recebe tudo por props prontas do `RoomScreen` (stream, reconnecting, failed, quality); furar esse padrao criaria um segundo canal de dados para o mesmo componente. O mapa entra na `useRoomStore` como `mediaFailures` ja entra (room-store.ts linhas 72-74) e vira a prop `videoStats`.
8. **Crossfade do estagio 2 por remontagem com `key` (so entrada) vs sobreposicao real** -> SOBREPOSICAO REAL via grid stacking (os dois blocos de texto em `grid-area: 1 / 1`, o ativo com opacity 1, o outro com opacity 0, transition de opacity/transform). O UISPEC 6.3 momento 3 recomenda explicitamente o crossfade verdadeiro porque troca de FRASE corta mais que troca de numero; o grid stacking evita `position: absolute` com altura fixa manual (o container assume a altura do maior filho, sem pulo de layout).
9. **Pausa do relogio por `powerMonitor`/IPC novo para detectar minimizacao** -> REJEITADO. Exigiria canal IPC novo para um ramo que hoje e inerte (Q1: com `backgroundThrottling: false` a pintura continua minimizado e o aviso se resolve sozinho). O listener de `visibilitychange` custa zero e cobre o futuro.

## 4. Riscos

| Risco | Mitigacao |
|---|---|
| rVFC nao disparar em algum cenario de janela ocluida apesar de `backgroundThrottling: false` (comportamento de compositor nao documentado) | Prova dupla: `framesDecoded` via stats encerra a espera mesmo sem pintura (RF-03). Errar aqui nunca gera aviso falso, no maximo o aviso fica visivel ate o proximo tick de 3s |
| Mudanca de assinatura `inboundConnections -> inboundEntries` quebrar consumidores | Lista fechada e verificada de consumidores: `session.ts` linhas 134, 181, 263; `stats-monitor.ts` linhas 20, 63; `media-manager.test.ts` linhas 510, 623. Todos atualizados na Feature 2.1; typecheck pega qualquer esquecimento |
| Estagio 2 (12s) cruzar com o `MediaFailureOverlay` (10s) e parecer bug | Comportamento esperado e documentado (CONTEXT secao 6): se a midia falhou tecnicamente, `failed` assume aos ~10s e PAUSA o relogio da espera (RF-04); quem chega ao estagio 2 e quem nao falhou, so nao pintou. Teste unitario cobre a pausa |
| Overlay piscar quando o quadro chega logo apos 1,5s (ex.: quadro em ~1,6s = flash de ~100ms que le como defeito) | MITIGADO (decisao fechada com o usuario, revisao 2): tempo minimo visivel `WAITING_MIN_VISIBLE_MS = 300` na `FirstFrameWatch`; o aviso que apareceu fica legivel por pelo menos 300ms antes de o fade de saida (180ms) comecar, e quadro dentro da carencia continua sem mostrar nada. O video nunca e segurado: so o veu do overlay sai com calma |
| Novo listener/callback rodando apos unmount (vazamento) | `dispose()` cancela timer interno; o hook cancela o rVFC pendente (`cancelVideoFrameCallback`) e remove o listener de `visibilitychange` no cleanup do effect |
| Re-render a cada 3s pelo mapa novo na store | Ja existe re-render periodico equivalente (`LOCAL_QUALITY` a cada 3s + `qualityTick`); os selectors granulares do zustand limitam o alcance. Custo marginal ~zero |
| E2e flaky ao asser presenca do overlay (janela de 1,5s e curta em rede local) | O e2e NUNCA assere presenca do overlay no caminho feliz: assere AUSENCIA apos o video fluir e a linha de log do primeiro quadro em `consoleLines`. Os dois estagios sao provados em unit com fake timers |
| Regressao nos fallbacks de direcao | Nenhum codigo novo dentro do caminho de conexao; `expectNoDirectionFallbacks` (zoi-app.ts linhas 274-284) continua no smoke e2e (AC-22) |

## 5. Contrato de Endpoints

**Nenhum endpoint novo e nenhum endpoint modificado.** O app nao possui API HTTP nem servidor proprio (desktop P2P; a unica infraestrutura externa, servidor publico de sinalizacao PeerJS + STUN, nao e tocada). Esta feature tambem NAO adiciona nenhuma mensagem nova ao protocolo do mesh (RF-14 proibe sinalizar a espera ao transmissor). Nao ha round-trip de edicao a garantir.

## 5b. Dependencias e Config

- **Dependencias novas: NENHUMA.** Tudo usa APIs nativas do Chromium (`requestVideoFrameCallback`, `getStats`) e o que ja esta no projeto. `HTMLVideoElement.requestVideoFrameCallback` e `RTCInboundRtpStreamStats.framesDecoded/framesReceived` ja existem no `lib.dom.d.ts` do TypeScript 5.9 do repo (verificado em `node_modules/typescript/lib/lib.dom.d.ts` linhas 17719 e 1755/1758): sem casts, sem polyfill.
- **Config novas** (NOMES; valores documentados por serem constantes de produto da PRD, nao segredos), em `src/shared/config.ts`, ao lado de `MEDIA_STALL_TIMEOUT_MS` (linha 110), com comentario do PORQUE como manda a convencao:
  - `FIRST_FRAME_GRACE_MS = 1_500` (carencia antes do aviso, RF-01; evita piscar em abertura rapida)
  - `FIRST_FRAME_ESCALATE_MS = 12_000` (tempo EFETIVO total ate o estagio 2, RF-05; deliberadamente maior que `MEDIA_STALL_TIMEOUT_MS` de 10s: falha tecnica vira `MediaFailureOverlay` antes, e quem escala aqui e espera sem falha)
  - `WAITING_MIN_VISIBLE_MS = 300` (tempo minimo que o aviso, uma vez visivel, permanece na tela antes de a saida comecar; decisao fechada com o usuario na revisao 2 para o quadro que chega logo apos a carencia nao virar flash; NUNCA atrasa o video em si, so o veu do overlay)
- **Env vars novas: NENHUMA.**
- **Migrations: N/A** (nao ha banco de dados no projeto).

## 5c. Matriz de autorizacao

**N/A por construcao**: nao ha endpoints (secao 5), nao ha papeis (PRD secao 4, nota: dono e membro identicos como espectador; o transmissor nunca ve o aviso porque o bloqueio de auto-visualizacao ja impede o player com a propria stream, room-store.ts linhas 44-47) e nao ha recurso de usuario a proteger contra IDOR. Todo o comportamento e local ao processo do espectador. O forge-test nao tem grade endpoint x papel a validar nesta feature.

## 6. Divisao de trabalho

**Backend: NAO HA.** Nenhum codigo do processo main muda (o espelhamento de `console.*` para arquivo ja existe em `src/main/file-logger.ts` linhas 147-151) e nao existe servidor. A secao Backend e omitida por isso; todos os sprints abaixo sao do agente FRONTEND.

**Frontend**: contrato visual VINCULANTE em `UISPEC_black-screen-notice.md` (source: render-captured). Referencias que os sprints citam sem re-derivar: identidade da familia `.z-reconnect` (UISPEC secoes 3-5, renders 12/13), contrato de motion dos quatro momentos (UISPEC secao 6.3, medido), guardrails de performance (UISPEC 6.4), Do/Don't (UISPEC 7).

---

## Frontend

### Sprint 1 - Nucleo de deteccao (maquina de estados pura)

- Descricao: cria a maquina de espera do primeiro quadro como classe pura, testavel sem DOM, com relogio pausavel, prova dupla, reset por faixa e log de diagnostico. Nada de UI ainda.
- Entregavel: `FirstFrameWatch` funcional + constantes de tempo em config, typecheck e lint verdes.
- Risco: baixo.
- Prerequisito: nenhum.
- Arquivos:
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\shared\config.ts` - modify - inserir as tres constantes novas imediatamente apos `MEDIA_STALL_TIMEOUT_MS` (linha 110, antes do comentario da linha 112)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\first-frame-watch.ts` - create

#### Feature 1.1 - Maquina `FirstFrameWatch` com relogio pausavel e log `[category: outro]`

- `Traces:` RF-01, RF-02 (limiares), RF-03 (prova dupla), RF-04 (pausa/retomada), RF-05 (escalada), RF-06/RF-07 (semantica por faixa), RF-15 (freeze nunca reabre, por design terminal), RF-16, RF-17 (log), RNF-01 (so sinais de fluxo), parte de RNF-02 (contrato de um-disparo documentado na API).
- `Steps:`
  1. Em `src/shared/config.ts`, apos a linha 110, adicionar `FIRST_FRAME_GRACE_MS = 1_500`, `FIRST_FRAME_ESCALATE_MS = 12_000` e `WAITING_MIN_VISIBLE_MS = 300` (export const, comentario de bloco explicando o porque de cada valor: os dois primeiros como descrito na secao 5b; o terceiro e o tempo minimo que o aviso, uma vez visivel, permanece na tela antes de a saida comecar, para o quadro que chega logo apos a carencia nao virar um flash de ~100ms que le como defeito).
  2. Criar `src/renderer/src/services/first-frame-watch.ts` exportando:
     - `export type FirstFrameStage = 'grace' | 'notice' | 'escalated' | 'done'`
     - `export interface FirstFrameWatchCallbacks { onStageChange(stage: FirstFrameStage): void }`
     - `export class FirstFrameWatch { constructor(txId: string, callbacks: FirstFrameWatchCallbacks) ... }` com os metodos publicos: `setBlocked(blocked: boolean): void`, `reportFramePainted(): void`, `reportFramesDecoded(frames: number): void`, `reportTrackChange(trackId: string | null): void`, `dispose(): void`, e o getter `get stage(): FirstFrameStage`.
  3. Estado interno: `stage` (inicia `'grace'`), `accumulatedMs` (tempo efetivo ja contado), `runningSince: number | null` (timestamp `Date.now()` de quando o relogio voltou a correr; `null` = pausado), `openedAt = Date.now()` (tempo de parede para o log), `maxStage: 'nenhum' | 'espera' | 'escalado'` (inicia `'nenhum'`), `timer: ReturnType<typeof setTimeout> | null`, `currentTrackId: string | null`, `logged = false`, `disposed = false`, `shownAt: number | null` (timestamp de parede de quando o aviso ficou visivel, setado na transicao `grace -> notice`; insumo do minimo visivel do passo 6), `minVisibleTimer: ReturnType<typeof setTimeout> | null` (segura a notificacao de `done` ate completar `WAITING_MIN_VISIBLE_MS`), `completed = false` (prova ja recebida, mesmo que `done` ainda nao tenha sido notificado).
  4. Relogio: funcao privada `effectiveMs()` = `accumulatedMs + (runningSince !== null ? Date.now() - runningSince : 0)`. `scheduleNext()` arma UM `setTimeout` para a proxima fronteira (`FIRST_FRAME_GRACE_MS - effectiveMs()` quando `stage === 'grace'`; `FIRST_FRAME_ESCALATE_MS - effectiveMs()` quando `stage === 'notice'`; nada quando `'escalated'`/`'done'`), com clamp em zero. O callback do timer avanca o estagio (`grace -> notice` com `maxStage = 'espera'` e `shownAt = Date.now()`, o marco do minimo visivel do passo 6; `notice -> escalated` com `maxStage = 'escalado'`), notifica `onStageChange` e re-agenda. A escalada e medida do ZERO EFETIVO total (12s efetivos desde a abertura, nao 12s apos o aviso), como definem RF-05/AC-05.
  5. `setBlocked(true)`: se ja pausado ou `completed`, no-op; senao `accumulatedMs += Date.now() - runningSince`, `runningSince = null`, cancela o timer. `setBlocked(false)`: se ja rodando ou `completed`, no-op; senao `runningSince = Date.now()` e `scheduleNext()`. Construtor inicia RODANDO (o hook ajusta o estado real de bloqueio logo apos criar). Isso implementa RF-04 para AMBAS as causas de pausa (overlay de precedencia e janela oculta): a classe nao sabe o motivo, recebe um booleano ja combinado.
  6. Prova de quadro: `reportFramePainted()` e `reportFramesDecoded(frames)` com `frames > 0` chamam o privado `complete()`; `reportFramesDecoded(0)` e no-op. `complete()`: se `completed`, no-op (idempotente); senao `completed = true`, cancela o timer de estagio e emite UMA vez, IMEDIATAMENTE (`logged` como guarda; o log registra o instante REAL do primeiro quadro, nunca atrasado pela coreografia): `console.info('[player] primeiro quadro de ' + txId + ' em ' + (Date.now() - openedAt) + 'ms (aviso: ' + maxStage + ')')`. Em seguida, o MINIMO VISIVEL (decisao fechada com o usuario, revisao 2): se `maxStage === 'nenhum'` (o aviso nunca chegou a aparecer, quadro dentro da carencia), transicao imediata `stage = 'done'` + `onStageChange('done')`, SEM nenhum atraso (AC-01 caminho rapido intocado). Se o aviso APARECEU (`shownAt !== null`), calcular `remaining = Math.max(0, WAITING_MIN_VISIBLE_MS - (Date.now() - shownAt))`: com `remaining === 0` notifica `done` na hora; senao arma `minVisibleTimer` de `remaining` ms e so entao `stage = 'done'` + `onStageChange('done')` (a saida do overlay, RF-21, comeca ao receber esse `done`). INVARIANTE (secao 2): este atraso segura apenas o VEU do overlay; o video ja esta tocando por baixo desde o attach, nenhum quadro e retido. Enquanto `minVisibleTimer` corre, `setBlocked`/`reportTrackChange`/provas novas sao no-op (`completed` guarda tudo).
  7. `reportTrackChange(trackId)`: regra F3 exata. Se `completed`, no-op (faixa que ja pintou nesta visualizacao nunca reabre o aviso, RF-07; troca de FONTE gera txId novo e portanto instancia nova via remount, RF-06). Se `currentTrackId === null` ou `trackId === null` ou `trackId === currentTrackId`, apenas atualiza `currentTrackId` SEM reset (a chegada da primeira faixa nao zera a espera que comecou na abertura do player). Se as duas forem nao-nulas e diferentes (faixa substituida antes do primeiro quadro, ex.: chamada reversa de pull): reset completo, `accumulatedMs = 0`, `maxStage = 'nenhum'`, `stage = 'grace'`, notifica `onStageChange('grace')`, re-agenda respeitando o estado de pausa vigente.
  8. `dispose()`: idempotente (`disposed` como guarda). Cancela o timer de estagio E o `minVisibleTimer` (unmount no meio da espera do minimo nao pode deixar timer orfao; nesse caso o log info ja saiu no `complete()` e nada mais e emitido). Se `!completed` e `!logged`: emite `console.warn('[player] visualizacao de ' + txId + ' fechada sem nenhum quadro apos ' + (Date.now() - openedAt) + 'ms (aviso: ' + maxStage + ')')` e marca `logged` (RF-17; cobre tambem `maxStage === 'nenhum'` se fechou dentro da carencia, linha registrada mesmo assim para o instrumento nao contar so historias completas).
  9. Comentario de cabecalho do arquivo citando a licao de `.forge/LESSONS.md` que originou a feature ("receber o objeto de midia NAO prova midia fluindo") e a licao "instrumentar ANTES de tentar corrigir" como razao do log (nota ao SPEC da PRD apos RF-17).
- `Edge cases:` prova durante a carencia (fica `done` sem nunca notificar `notice`, log com `aviso: nenhum`, ZERO atraso de minimo visivel); provas duplicadas e prova apos `completed` (no-op, um log so); `reportFramesDecoded(0)` nao encerra; `setBlocked` redundante (no-op, sem dupla contagem); timer disparando apos `dispose` (guarda `disposed`); pausa exatamente na fronteira (clamp em zero re-agenda imediato ao retomar); troca de faixa durante pausa (reset mantem o relogio pausado); `dispose` antes de qualquer estagio (log warn com `aviso: nenhum`); prova chegando com o aviso visivel ha menos de `WAITING_MIN_VISIBLE_MS` (log imediato, `done` notificado so ao completar o minimo); unmount durante o `minVisibleTimer` (`dispose` cancela, sem callback orfao e sem segundo log); prova chegando ja em `escalated` (minimo conta desde o `shownAt` original do estagio 1, que a essa altura ja passou de 300ms: `done` imediato).
- `Done when:` typecheck e lint verdes; a classe cobre AC-01..AC-05, AC-07, AC-10 (semantica), AC-14 e o minimo visivel de `WAITING_MIN_VISIBLE_MS` no nivel de unidade (testes formais ficam no Sprint 4, mas a API deve permitir cada cenario sem gambiarras).
- `Commit:` `feat(player): maquina de espera do primeiro quadro com carencia, escalada e log`
- `Rollback:` `git revert <hash>` (arquivo novo + tres constantes; sem efeito colateral).

### Sprint 2 - Stats por transmissao (extensao do coletor existente)

- Descricao: etiqueta as conexoes de entrada por txId e extrai `framesDecoded`/`framesReceived` por transmissao dentro do MESMO tick do `StatsMonitor`, expondo o mapa ate a prop do player. Estrutura desenhada para a `video-codec-upgrade` estender.
- Entregavel: `useRoomStore.inboundVideoStats` populado a cada 3s durante sessao ativa; agregado de qualidade identico ao atual.
- Risco: medio (mudanca de assinatura com 6 pontos de consumo verificados).
- Prerequisito: nenhum (independente do Sprint 1).
- Arquivos:
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\stats-monitor.ts` - modify - interface `StatsMonitorCallbacks` (linhas 18-24), metodo `sample()` (linhas 62-107)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\media-manager.ts` - modify - `inboundConnections()` (linhas 757-764)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\session.ts` - modify - `MediaHooks` (linha 134), `noopMediaHooks` (linha 181), construcao do `StatsMonitor` (linhas 262-275), novo listener no padrao de `onHealth` (linhas 304-307), `teardown()` (linha 1101)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\store\room-store.ts` - modify - interface `RoomStore` (linhas 10-22), estado inicial (linhas 24-32), `attachRoomStore()` (linhas 56-91)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\media-manager.test.ts` - modify - asserts das linhas 510 e 623

#### Feature 2.1 - `inboundEntries` etiquetado e `InboundVideoStats` por txId `[category: outro]`

- `Traces:` RNF-05 (F5, sem segundo laco), RF-03 (fonte da prova "decodificado"), RNF-07 (leitura passiva, zero mudanca de comportamento de conexao), AC-21.
- `Steps:`
  1. Em `stats-monitor.ts`, exportar os tipos novos junto de `QualityReport`:
     - `export interface InboundEntry { txId: string; connection: RTCPeerConnection }`
     - `export interface InboundVideoStats { framesDecoded: number; framesReceived: number; at: number }` com comentario: "Ponto de extensao da video-codec-upgrade: campos novos do mesmo report inbound-rtp (ex.: decoderImplementation) entram AQUI; leitura do lado de saida ganha um outboundEntries simetrico neste MESMO monitor, nunca um coletor paralelo."
  2. Na interface `StatsMonitorCallbacks` (linha 20), trocar `inboundConnections(): RTCPeerConnection[]` por `inboundEntries(): InboundEntry[]` e adicionar `onInboundVideoStats?(stats: ReadonlyMap<string, InboundVideoStats>): void` (opcional: o monitor funciona sem consumidor per-tx).
  3. Em `sample()` (linha 62): iterar as entradas etiquetadas no MESMO laco unico (linha 70), com a variavel do laco chamada `inbound` (tipo `InboundEntry`) para NAO colidir com o `const entry = report as RTCInboundRtpStreamStats` que ja existe na linha 75 e permanece intocado. Hoistear `const sampledAt = Date.now()` no INICIO de `sample()` (o `const now` da linha 85 continua exatamente onde esta: o Done-when exige as linhas 85-106 intocadas). O acumulado agregado (`bytes`, `packetsLost`, `packetsReceived`) permanece IDENTICO. Dentro do mesmo `stats.forEach`, quando `report.type === 'inbound-rtp'` e `entry.kind === 'video'`, registrar para `inbound.txId` o par `{ framesDecoded: entry.framesDecoded ?? 0, framesReceived: entry.framesReceived ?? 0, at: sampledAt }` num `Map` local `perTx`; se houver mais de um report de video na mesma conexao (nao esperado), manter o de maior `framesDecoded`. Apos o laco, chamar `this.callbacks.onInboundVideoStats?.(perTx)` ANTES do `onReport` agregado.
  4. Em `media-manager.ts` (linhas 757-764), renomear para `inboundEntries(): InboundEntry[]` (import type de `./stats-monitor`), iterando `this.incomingCalls.entries()` e devolvendo `{ txId, connection: call.peerConnection }` para cada call com `peerConnection` presente. Atualizar o comentario da linha 757. NADA mais muda no arquivo.
  5. Em `session.ts`: atualizar `MediaHooks` (linha 134) para `inboundEntries(): InboundEntry[]`; `noopMediaHooks` (linha 181) para `inboundEntries: () => []`; a construcao do monitor (linha 263) para `inboundEntries: () => this.mediaHooks.inboundEntries()` e adicionar `onInboundVideoStats: (stats) => this.notifyInboundVideoStats(stats)` no objeto de callbacks (linhas 262-275). Criar, no padrao exato de `onHealth` (linhas 304-307): `private readonly inboundVideoStatsListeners = new Set<(stats: ReadonlyMap<string, InboundVideoStats>) => void>()`, metodo publico `onInboundVideoStats(listener): () => void` e privado `notifyInboundVideoStats(stats)`. Em `teardown()` (apos `this.statsMonitor.stop()`, linha 1101), chamar `this.notifyInboundVideoStats(new Map())` para zerar consumidores.
  6. Em `room-store.ts`: adicionar `inboundVideoStats: ReadonlyMap<string, InboundVideoStats>` a interface `RoomStore` (com doc-comment "contadores de quadro por transmissao; prova 'decodificado' do aviso de espera e insumo da video-codec-upgrade"), inicial `new Map()` (linha 31), e em `attachRoomStore()` (apos o bloco das linhas 72-74) `const unsubscribeVideoStats = session.onInboundVideoStats((inboundVideoStats) => { useRoomStore.setState({ inboundVideoStats }) })`, com o unsubscribe correspondente no retorno (linhas 84-90).
  7. Em `tests/unit/media-manager.test.ts`: linha 510 vira `expect(manager.inboundEntries()).toHaveLength(1)` (e assere que a entrada carrega `txId: 'tx1'`, ganhando a prova da etiqueta); linha 623 vira `expect(manager.inboundEntries()).toEqual([])`.
- `Edge cases:` `getStats()` rejeitando (try/catch por conexao ja existe, linhas 71-82: a entrada per-tx daquela conexao e omitida no tick, o agregado segue, nenhum throw); call sem `peerConnection` ainda (filtrada no `inboundEntries`, comportamento atual preservado); report `inbound-rtp` de audio (ignorado pelo filtro `kind === 'video'`); `framesDecoded` ausente no report (coalesce para 0, que NAO conta como prova); consumidor per-tx ausente (`onInboundVideoStats?.` opcional); sessao sem transmissoes (mapa vazio notificado, overlay nunca ve valor); teardown no meio de um `sample()` em voo (o `setState` num store ja detachado e inofensivo; o mapa vazio final prevalece no proximo attach).
- `Done when:` typecheck, lint e `npx vitest run` verdes com os dois asserts atualizados; `QualityReport` agregado byte-a-byte identico ao comportamento anterior (mesmas contas, linhas 85-106 intocadas); nenhum `setInterval`/`getStats` novo no diff (AC-21 verificavel por inspecao do diff).
- `Commit:` `feat(stats): expoe contadores de quadro por transmissao no coletor existente`
- `Rollback:` `git revert <hash>` (mudanca de assinatura reversivel; nenhum dado persistido).

### Sprint 3 - Overlay de espera e integracao no player

- Descricao: cria o `WaitingOverlay` (terceiro irmao da familia, contrato de motion do UISPEC secao 6.3) e liga a maquina do Sprint 1 + a prova do Sprint 2 ao `PlayerView`, com a precedencia RF-08.
- Entregavel: espectador ve o aviso nos dois estagios com as quatro animacoes; some no primeiro quadro; log no arquivo.
- Risco: medio (unico sprint que toca o caminho de render do player).
- Prerequisito: Sprints 1 e 2.
- Arquivos:
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\WaitingOverlay.tsx` - create
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\player.css` - modify - bloco novo apos `.z-reconnect__icon` (linha 181)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\theme.css` - modify - dois `@keyframes` novos na secao de animacoes: `z-waiting-pulse` (apos `z-live-pulse`, linha 215) e `z-fade-out` (apos `z-fade-in`, linhas 177-185)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\PlayerView.tsx` - modify - props (linhas 17-29), effect de attach (linhas 56-64), JSX de overlays (linhas 167-169)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\RoomScreen.tsx` - modify - selectors (linhas 27-33) e props do `PlayerView` (linhas 282-294)

#### Feature 3.1 - Componente `WaitingOverlay` + CSS dos quatro momentos `[category: frontend]`

- `Traces:` RF-02, RF-05, RF-12, RF-13, RF-18, RF-19, RF-20, RF-21, RNF-03, RNF-04, RNF-08, RNF-09, AC-15..AC-18, AC-20, AC-24, AC-25.
- Referencia visual VINCULANTE: UISPEC secoes 3 (tokens), 4 (inventario: base `.z-reconnect` de player.css linhas 142-153, logo `logo-goiaba.png` importada como em `TransmissionStatusCard.tsx` linha 10), 5 (layout `inset: 0` no `.z-player`, nunca `fixed`), 6.3 (os quatro momentos, medidos) e 7 (Do/Don't). NAO re-derivar identidade aqui.
- `Steps:`
  1. Criar `WaitingOverlay.tsx` exportando o componente e a copy como constante testavel:
     ```
     export const WAITING_COPY = {
       noticeText: 'conectando a transmissao...',
       noticeHint: (nickname: string) => 'A tela de ' + nickname + ' costuma aparecer em poucos segundos. Aguarde mais um pouco.',
       escalatedText: 'A transmissao esta demorando mais que o normal',
       escalatedHint: (nickname: string) => 'Nenhuma imagem de ' + nickname + ' chegou ate agora. Feche e abra a transmissao de novo; isso costuma resolver.'
     }
     ```
     (pt-BR sem acento, sem travessao, tom dos irmaos; segundo estagio SO texto com sugestao de fechar/abrir, SEM botao, RF-12/RF-13.)
  2. Props: `{ nickname: string; stage: 'notice' | 'escalated'; exiting: boolean }`. JSX raiz: `<div className={'z-reconnect z-reconnect--waiting' + (exiting ? ' z-reconnect--waiting-exit' : '')} role="status" data-testid="waiting-overlay" data-stage={stage}>`. Filhos, na composicao da familia (icone/marca, texto, hint):
     - `<span className={'z-waiting__logo-wrap' + (stage === 'notice' ? ' z-waiting__logo-wrap--pulse' : '')}><img className="z-waiting__logo" src={logoGoiaba} alt="" aria-hidden="true" /></span>`
     - bloco de troca: `<span className="z-waiting__swap">` com DOIS filhos sempre montados, cada um `<span className={'z-waiting__stage' + (ativo ? ' z-waiting__stage--active' : '')}>` contendo `<span className="z-reconnect__text">...</span><span className="z-reconnect__hint">...</span>` com a copy do seu estagio.
  3. Momento 1 (entrada, RF-18/AC-15): a entrada do cartao vem DE GRACA da base `.z-reconnect` (`animation: z-fade-in var(--dur-enter) var(--ease) both`, player.css linha 152). Em player.css, apos a linha 181, adicionar:
     - `.z-waiting__logo { width: 84px; height: 84px; object-fit: contain; animation: z-status-bounce-in 480ms cubic-bezier(0.34, 1.56, 0.64, 1) 60ms both; }` (reuso POR NOME do keyframe de theme.css linhas 246-256 e do unico easing-excecao do app; delay 60ms para nao competir com o fade do cartao, faixa 0-80ms do UISPEC).
     - entrada do TEXTO no mount (momento 1): regra dedicada `.z-reconnect--waiting .z-waiting__swap { animation: z-fade-rise 220ms var(--ease) 160ms both; }` (mesmo padrao do titulo do status card, components.css linhas 794-797; keyframe `z-fade-rise` reusado por nome, theme.css linhas 165-175). O mecanismo e uma ANIMACAO no CONTAINER `.z-waiting__swap`, que monta junto com o cartao e roda exatamente uma vez: transition nao serviria aqui porque transition nao roda no mount inicial (o estagio ativo ja nasce com a classe ativa). Nao ha conflito com o crossfade do passo 5, que e feito por TRANSITION nos FILHOS `.z-waiting__stage` (elementos distintos, mecanismos independentes), e a animacao nao re-dispara na troca de estagio (as classes do swap nunca mudam).
  4. Momento 2 (indicador vivo, RF-19/AC-16): em theme.css, apos `z-live-pulse` (linha 215), adicionar `@keyframes z-waiting-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }` (SO opacity, espirito medido de `z-live-pulse`, que nao pode ser reusado 1:1 por semantica "ao vivo"). Em player.css: `.z-waiting__logo-wrap--pulse { animation: z-waiting-pulse 2s ease-in-out 1200ms infinite; }`. O pulso fica no WRAP e o bounce na IMG: remover a classe `--pulse` (na escalada) nao reinicia o bounce da logo. Delay 1200ms deixa o bounce (480ms + delay) terminar antes do primeiro vale. O loop e desmontado junto com o overlay (nunca `display:none` rodando), e roda apenas no estagio 1.
  5. Momento 3 (crossfade aos 12s, RF-20/AC-17): `.z-waiting__swap { display: grid; justify-items: center; }` e `.z-waiting__stage { grid-area: 1 / 1; display: flex; flex-direction: column; align-items: center; gap: var(--space-3); opacity: 0; transform: translateY(6px); transition: opacity var(--dur-enter) var(--ease), transform var(--dur-enter) var(--ease); pointer-events: none; }` e `.z-waiting__stage--active { opacity: 1; transform: translateY(0); }`. Os dois blocos ocupam a mesma celula: o ativo funde para dentro enquanto o outro funde para fora, sobreposicao real de ~180ms, easing `var(--ease)` (bounce reservado a logo, UISPEC Don't). O container assume a altura do maior filho: sem pulo de layout.
  6. Momento 4 (saida, RF-21/AC-18): declarar em theme.css, junto dos demais keyframes (logo apos `z-fade-in`, linhas 177-185), o keyframe NOVO `@keyframes z-fade-out { from { opacity: 1; } to { opacity: 0; } }` (identico invertido, rota 1 da secao 6.2 do UISPEC); em player.css, `.z-reconnect--waiting-exit { animation: z-fade-out var(--dur-enter) var(--ease) both; }`. O NOME novo e OBRIGATORIO, nao estilo: a base `.z-reconnect` ja terminou `z-fade-in ... both` e (a) `animation` com fill vence `transition` na mesma propriedade, e (b) reaplicar o mesmo nome com `reverse` NAO reinicia (so mudanca de `animation-name` reinicia; direction/fill retroativos fariam o cartao saltar para opacity 0, corte seco proibido por RF-21). Ver trade-off 6. Saida discreta, so opacity, sem scale/translate.
  7. `prefers-reduced-motion`: NADA a fazer localmente; o bloco global de theme.css linhas 62-77 zera duracoes e forca `animation-iteration-count: 1` (o pulso para na primeira iteracao, precedente aceito do `.z-spinner`). A mensagem e portada pelo TEXTO (RNF-04/AC-20): nenhum passo acima faz a informacao depender de movimento.
  8. Restricao de propriedades (RNF-03, UISPEC 6.4): todo CSS novo usa exclusivamente `opacity`/`transform`; proibido `width/height/top/left/box-shadow/filter/backdrop-filter` em animacao. `will-change` NAO e usado (janela curta, elementos ja em camada propria sobre o video).
- `Edge cases:` (frontend baseline) estado de carregamento = o proprio overlay (e a feature); estado vazio/erro N/A (componente puramente apresentacional, sem fetch, sem form, sem API a espelhar; erros de deteccao nunca chegam aqui porque a maquina so avanca estagios); offline N/A (overlay local); nickname longo (herda `max-width: 46ch` do `.z-reconnect__hint`, player.css linhas 160-165, com `text-align: center`); os dois estagios montados simultaneamente nao podem capturar clique (`pointer-events: none` no `.z-waiting__stage`, os controles do player continuam operaveis por cima, UISPEC 5); troca `notice -> escalated` durante reduced-motion (transition de 0.001ms = troca imediata porem legivel).
- `Done when:` overlay renderiza os dois estagios com a copy exata de `WAITING_COPY`, os quatro momentos seguem o UISPEC 6.3 (conferiveis por inspecao das classes/keyframes citados POR NOME), `data-testid="waiting-overlay"` e `data-stage` presentes; typecheck/lint verdes. AC-24/AC-25 conferiveis por leitura (copy ASCII, tokens da familia).
- `Commit:` `feat(player): overlay de espera do primeiro quadro na familia dos overlays`
- `Rollback:` `git revert <hash>` (componente novo + CSS aditivo; nada existente muda de comportamento).

#### Feature 3.2 - Integracao no `PlayerView` com precedencia e prova dupla `[category: frontend]`

- `Traces:` RF-01..RF-11, RF-14 (nenhum dado novo enviado: verificavel pela ausencia de qualquer chamada de envio no diff), RF-16/RF-17 (log emitido no ciclo real), RNF-02 (rVFC de um disparo), RNF-06/RNF-07 (nenhum toque no caminho de midia), AC-01..AC-11, AC-13, AC-19, AC-22.
- `Consumes endpoints:` N/A - nao existem endpoints neste projeto (secao 5); os insumos sao props (`stream`, `reconnecting`, `failed`, `videoStats`) e o elemento `<video>` local.
- `Steps:`
  1. Em `RoomScreen.tsx`: adicionar o selector `const inboundVideoStats = useRoomStore((state) => state.inboundVideoStats)` junto aos existentes (linhas 27-33) e a prop `videoStats={inboundVideoStats.get(selected.txId)}` no `PlayerView` (bloco das linhas 282-294). O `key={selected.txId}` da linha 283 permanece: e ele que garante RF-06/RF-10 por remontagem (confirmado no CONTEXT secao 7).
  2. Em `PlayerView.tsx`: adicionar `videoStats: InboundVideoStats | undefined` a `PlayerViewProps` (linhas 17-29, import type de `../../services/stats-monitor`).
  3. Criar, NO MESMO ARQUIVO (o projeto nao tem pasta de hooks; precedente de logica local do proprio arquivo, linhas 11-15), o hook local `useFirstFrameWatch(txId, videoRef, stream, reconnecting, failed, videoStats)` retornando `{ waitStage, exiting }`:
     - Instancia unica por mount: `const watchRef = useRef<FirstFrameWatch | null>(null)` + criacao lazy com `onStageChange: setWaitStage` (`useState<FirstFrameStage>('grace')`). Effect de unmount chama `watchRef.current.dispose()` (log do desfecho, RF-17).
     - Effect de bloqueio (deps `[reconnecting, failed, stream]`): computa `blocked = reconnecting || failed || document.visibilityState === 'hidden' || (stream !== null && stream.getVideoTracks().length === 0)` e chama `setBlocked(blocked)`; registra listener de `visibilitychange` que recomputa, removido no cleanup. Nota em comentario (decisao Q1): com `backgroundThrottling: false` (src/main/index.ts linha 68) o `visibilityState` fica sempre `visible` e este ramo e defensivo; a pausa por overlay de precedencia e a que atua hoje (RF-04/AC-04/AC-08). O ramo `sem faixa de video` implementa RF-09/AC-09 (stream presente sem video = relogio pausado para sempre, aviso nunca aparece, nada quebra); stream ainda `null` CONTA tempo (o espectador ja esta encarando preto).
     - Effect de faixa (deps `[stream]`): `watch.reportTrackChange(stream?.getVideoTracks()[0]?.id ?? null)`.
     - Effect do rVFC (deps `[stream]`), rodando APOS o effect de attach existente (linhas 56-64, intocado): se `stage` ja `done`, no-op; senao, com `element = videoRef.current` presente, `const id = element.requestVideoFrameCallback(() => watch.reportFramePainted())` guardado em ref; cleanup chama `element.cancelVideoFrameCallback(id)`. O callback NUNCA se re-agenda (RNF-02/AC-16: um disparo captura o instante e para; a tipagem existe no lib.dom do TS 5.9, sem cast). Re-armar somente quando a prop `stream` trocar de instancia (novo attach nas linhas 56-64) e a espera nao estiver `done`.
     - Effect da prova decodificada (deps `[videoStats]`): `if (videoStats && videoStats.framesDecoded > 0) watch.reportFramesDecoded(videoStats.framesDecoded)` (RF-03/AC-03: qualquer prova basta; granularidade de 3s do tick e aceitavel porque a pintura e o caminho rapido).
     - Saida suave: `const [exiting, setExiting] = useState(false)`; quando `waitStage` vira `'done'` VINDO de `'notice'`/`'escalated'` (ref do estagio anterior), `setExiting(true)` e `setTimeout` de `WAITING_EXIT_MS = 200` (const local do arquivo; 180ms de `--dur-enter` + folga) para esconder de vez; cleanup limpa o timeout. `done` vindo de `'grace'` nao mostra nem anima nada (AC-01 caminho rapido). O minimo visivel NAO e implementado aqui: a `FirstFrameWatch` ja segura a notificacao de `'done'` ate completar `WAITING_MIN_VISIBLE_MS` (Feature 1.1 passo 6), entao o hook so reage. INVARIANTE (secao 2): nada disso toca o video; o elemento `<video>` ja esta com `srcObject` e tocando por baixo (linhas 56-64, intocadas), o atraso e exclusivamente do veu do overlay e nenhum quadro fica retido esperando animacao.
  4. JSX: apos a linha 169, adicionar o TERCEIRO ramo, na ordem de precedencia existente. O stage exibido durante a saida CONGELA no ultimo estagio visivel: manter `const lastShownStageRef = useRef<'notice' | 'escalated'>('notice')`, atualizada num effect sempre que `waitStage` for `'notice'` ou `'escalated'`, e derivar `const shownStage = waitStage === 'notice' || waitStage === 'escalated' ? waitStage : lastShownStageRef.current`. Ramo: `{!reconnecting && !failed && (waitStage === 'notice' || waitStage === 'escalated' || exiting) ? (<WaitingOverlay nickname={nickname} stage={shownStage} exiting={exiting} />) : null}`. (Sem a ref, `waitStage === 'done'` durante o fade colapsaria para `'notice'` e um overlay que estava ESCALADO piscaria a copy do estagio 1 na saida.) Os dois overlays existentes (linhas 167-169) NAO mudam: RF-08/AC-08 por construcao JSX, o padrao ja usado entre eles (CONTEXT secao 2).
  5. RF-11/AC-11: nenhum codigo extra: o overlay vive dentro do `.z-player` (`position: absolute; inset: 0`), que e o proprio container do fullscreen (`containerRef`, linhas 115-121), logo aparece em janela normal e fullscreen. No PiP (video cru do Chromium em janela propria, `pip-controller`), a camada do app nao existe na janelinha e a ausencia la e aceita pela PRD; na janela principal o comportamento segue o mesmo dos irmaos (que tambem nao tratam `pipActive`), consistencia deliberada.
  6. Verificacao de nao-regressao (RNF-06/RNF-07/AC-22): o diff deste sprint nao pode conter NENHUMA linha em `media-manager.ts` alem das do Sprint 2, nenhum listener novo em `MediaStreamTrack`/`RTCPeerConnection` (a prova pintada vem do elemento `<video>`, a decodificada da prop), nenhuma mensagem nova no mesh (RF-14/AC-12).
- `Edge cases:` (frontend baseline) loading = o overlay em si; erro de API N/A (sem API; a unica falha assincrona possivel, `getStats`, ja degrada no Sprint 2 sem alcancar a UI); estado vazio = `stream null` (conta tempo, mostra aviso apos carencia: e o proprio caso de uso); offline/queda real = `reconnecting`/`failed` assumem e PAUSAM o relogio (AC-04/AC-08); form validation N/A (nao ha form). Especificos: `requestVideoFrameCallback` indisponivel no elemento fake de teste (guard `typeof === 'function'` antes de armar; sem rVFC a prova decodificada sustenta a deteccao sozinha); prova chegando durante `exiting` (no-op, ja `done`); troca de faixa pre-quadro reseta e o overlay ja visivel desaparece para nova carencia (AC-06, sem piscar dentro da mesma faixa); unmount no meio do timeout de saida (cleanup); video congelando pos-primeiro-quadro por qualquer tempo (estado `done` e terminal na instancia, AC-07/AC-13); cena legitimamente escura (quadros pintam, rVFC dispara no primeiro, aviso nunca aparece, AC-19, garantido por design sem pixels).
- `Done when:` fluxo manual de duas instancias mostra: abrir transmissao lenta exibe estagio 1 apos 1,5s com logo bounce + pulso; quadro chegando remove com fade; log `[player] primeiro quadro` aparece no arquivo de log do dia; `reconnecting`/`failed` nunca coexistem com o aviso; typecheck/lint/vitest verdes.
- `Commit:` `feat(player): liga a deteccao de primeiro quadro ao player com precedencia`
- `Rollback:` `git revert <hash>`.

### Sprint 4 - Testes (dedicado)

- Descricao: define TODOS os testes da feature nos frameworks ja detectados no projeto: Vitest (`tests/unit`, ambiente node, fakes manuais, SEM Testing Library: componente React nao e testavel em unit neste projeto, cobertura de componente vai por e2e com `data-testid` + copy exportada) e Playwright `_electron` (`tests/e2e`, headless, excecao registrada do projeto). Nenhum framework novo.
- Entregavel: suites novas + suite completa verde (RNF-10/AC-23).
- Risco: baixo.
- Prerequisito: Sprints 1, 2 e 3.
- Arquivos:
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\first-frame-watch.test.ts` - create
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\stats-monitor.test.ts` - create (hoje NAO existe teste do monitor)
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\waiting-overlay-copy.test.ts` - create
  - `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\e2e\smoke-session.spec.ts` - modify - passo 8 do teste (linhas 81-94) e bloco final (linhas 107-110)

#### Feature 4.1 - Unit: `first-frame-watch.test.ts` `[category: outro]`

- `Traces:` AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-10, AC-13, AC-14, AC-19 (nivel de sinal), RF-15.
- `Steps:` (definicao; escrita na implementacao) arquivo com `vi.useFakeTimers()` em `beforeEach` (padrao de `media-manager.test.ts`) e `vi.spyOn(console, 'info'/'warn')`. Estagios observados por um array alimentado pelo `onStageChange`. Cenarios obrigatorios:
  1. Prova pintada em 1,0s: nunca notifica `notice`, log info com `aviso: nenhum` (AC-01 caminho rapido).
  2. Sem prova: `notice` exatamente aos 1500ms efetivos (AC-02) e `escalated` aos 12000ms efetivos (AC-05).
  3. Prova decodificada sozinha (`reportFramesDecoded(7)` sem pintura) encerra; `reportFramesDecoded(0)` NAO encerra (AC-03/RF-03). Cenario da tela preta que nunca entrega quadro: avancar 20s sem prova, estagios `notice` e `escalated` na ordem, e SO eles: este e o teste deterministico de "faixa que nunca entrega quadro" exigido.
  4. Cena escura legitima no nivel de sinal: quadros fluem (prova aos 900ms), avancar 60s, NENHUM estagio de aviso jamais notificado (AC-19; a garantia de pixels e por design: a classe nao tem acesso a conteudo de quadro).
  5. Pausa e retomada (AC-04): correr 1000ms, `setBlocked(true)`, avancar 30000ms, `setBlocked(false)`, `notice` so 500ms depois; mesmo padrao cruzando a fronteira de 12s.
  6. Freeze pos-primeiro-quadro nunca reabre (AC-07/AC-13/RF-15): prova aos 3s, avancar 120s, `reportTrackChange` com o MESMO id, estado permanece `done`, nenhum log extra.
  7. Troca de faixa pre-quadro reseta (AC-06): aos 5s (em `notice`), `reportTrackChange('track-b')` volta a `grace`; `notice` de novo so apos +1500ms efetivos. E: `null -> 'track-a'` NAO reseta o relogio ja corrido.
  8. `dispose()` sem quadro aos 15s: `console.warn` unico contendo o txId, `sem nenhum quadro` e `aviso: escalado` (AC-14 desfecho triste); `dispose()` duplo nao loga duas vezes; timers limpos (nenhum estagio apos dispose).
  9. Idempotencia: pintada duas vezes + decodificada depois de `done` = um unico log info (AC-14 uma linha por visualizacao).
  10. Minimo visivel (anti-flash, revisao 2): sem prova ate 1500ms (`notice` notificado), prova pintada aos 1600ms: o log info sai IMEDIATAMENTE aos 1600ms, mas `done` so e notificado aos 1900ms (`WAITING_MIN_VISIBLE_MS = 300` apos o `shownAt` de 1500ms); nenhum estagio intermediario entre eles. Contraprova rapida: prova aos 1000ms (dentro da carencia) notifica `done` na hora, sem atraso nenhum. E cleanup: mesmo cenario do atraso, com `dispose()` aos 1700ms: nenhum `done` notificado depois, nenhum segundo log.
- Mocks/limites: nenhum DOM, nenhum WebRTC: a classe recebe sinais puros (esta e a fronteira de mock). Cobertura alvo: 100% de linhas da classe.
- `Done when:` `npx vitest run tests/unit/first-frame-watch.test.ts` verde com os 10 cenarios.
- `Commit:` `test(player): cobre a maquina de espera do primeiro quadro`
- `Rollback:` `git revert <hash>`.

#### Feature 4.2 - Unit: `stats-monitor.test.ts` `[category: outro]`

- `Traces:` AC-21, RNF-05, RF-03 (fonte decodificada), RNF-07.
- `Steps:` fakes manuais no estilo de `FakePeerConnection` de `media-manager.test.ts` (linhas 19-58), com `getStats()` devolvendo `Map` de reports simulados; `vi.useFakeTimers()` + `advanceTimersByTimeAsync(3000)` para os ticks. Cenarios:
  1. Duas conexoes etiquetadas (`tx1`, `tx2`) com reports `inbound-rtp` de video: `onInboundVideoStats` recebe mapa com `framesDecoded`/`framesReceived` corretos POR txId, no mesmo tick do `onReport` agregado (prova de laco unico: um `getStats` por conexao por tick, contavel no fake).
  2. Agregado inalterado: bitrate/packet-loss entre dois ticks identicos ao calculo atual (regressao das linhas 85-106).
  3. Report de audio ignorado; report sem `framesDecoded` vira 0.
  4. `getStats` rejeitando numa conexao: entrada omitida do mapa, agregado das demais segue, nenhum unhandled rejection.
  5. Callback `onInboundVideoStats` ausente: nenhum throw (opcional de verdade).
- Mocks/limites: `RTCPeerConnection` e reports 100% fake; nenhum Electron. Cobertura alvo: ramos novos de `sample()` + `classify` existente intocado.
- `Done when:` `npx vitest run tests/unit/stats-monitor.test.ts` verde com os 5 cenarios.
- `Commit:` `test(stats): cobre a extracao por transmissao do monitor de qualidade`
- `Rollback:` `git revert <hash>`.

#### Feature 4.3 - Copy + e2e do caminho feliz `[category: frontend]`

- `Traces:` AC-08 (precedencia estrutural re-verificada), AC-14 (linha de log real), AC-22 (fallbacks), AC-23 (suite completa), AC-24 (copy), RNF-06, RNF-08, RNF-10, RF-16.
- `Steps:`
  1. `tests/unit/waiting-overlay-copy.test.ts`: importa `WAITING_COPY` de `@renderer/ui/components/WaitingOverlay` (import de .tsx compila no Vitest sem renderizar). Asserts: cada string (hints avaliados com nickname de fixture) e 100% ASCII (`/^[\x20-\x7E]+$/`, o que proibe acentos E travessao/en-dash de uma vez, AC-24/RNF-08); `escalatedHint` contem `Feche e abra` (RF-12); nenhuma string vazia.
  2. `tests/e2e/smoke-session.spec.ts`, dentro do teste existente (linha 49), apos o player abrir (passo 8, linhas 81-84):
     - `await expect(guest.page.getByTestId('waiting-overlay')).toHaveCount(0, { timeout: TIMEOUTS.media })`: com o video fluindo, o aviso esta AUSENTE nesse estado final do caminho feliz (e o que o assert de fato prova; uma presenca transitoria anterior, amortecida pela carencia e pelo minimo visivel, e aceitavel e nao e negada por ele); junto com os overlays existentes ausentes, cobre a precedencia no app buildado.
     - poll de `guest.consoleLines` (helper ja expoe, zoi-app.ts linha 41) ate conter `"[player] primeiro quadro"` (via `expect.poll`, timeout `TIMEOUTS.media`): prova AC-14/RF-16 fim-a-fim no app real, arquivo de log incluso por transitividade (`attachRendererLogging` espelha tudo).
     - O `expectNoDirectionFallbacks([owner, guest])` existente (linha 109) permanece e DEVE continuar verde (AC-22/RNF-06): nenhuma alteracao nele.
     - Trap registrado do projeto: qualquer assert novo na tela de sala ja acontece apos os helpers atuais que aguardam `.z-doors` sumir; nao introduzir screenshot/assert antes disso.
  3. Rodar a suite completa na ordem do projeto: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run test:e2e` (RNF-10/AC-23). Nota: simular "quadro que nunca chega" em e2e real exigiria travar midia de proposito entre instancias reais; essa prova e deterministica no unit (Feature 4.1 cenario 3), decisao ja apontada pelo CONTEXT secao 6.
- Mocks/limites: e2e sem mock (app buildado, 2 instancias reais); unit de copy sem render.
- `Done when:` `npm run typecheck && npm run lint && npx vitest run && npm run test:e2e` tudo verde, incluindo os asserts novos e `expectNoDirectionFallbacks`.
- `Commit:` `test(player): valida copy do aviso e caminho feliz e2e com log de primeiro quadro`
- `Rollback:` `git revert <hash>`.

## 8. Matriz de cobertura da PRD

| RF/RNF | Sprint.Feature | Como e satisfeito |
|---|---|---|
| RF-01 | 1.1, 3.2 | `FIRST_FRAME_GRACE_MS = 1_500` na maquina; overlay so monta em `notice`/`escalated` |
| RF-02 | 1.1, 3.1, 3.2 | Fronteira `grace -> notice`; copy calma `WAITING_COPY.noticeText/noticeHint` |
| RF-03 | 1.1, 2.1, 3.2 | `reportFramePainted` (rVFC) OU `reportFramesDecoded > 0` (stats por txId), qualquer um encerra |
| RF-04 | 1.1, 3.2 | `setBlocked` acumula/retoma; wiring combina `reconnecting || failed || hidden || sem faixa` |
| RF-05 | 1.1, 3.1 | `FIRST_FRAME_ESCALATE_MS = 12_000` efetivos; estagio `escalated` |
| RF-06 | 1.1, 3.2 | Reset por faixa nova pre-quadro; troca de fonte = txId novo = remount por `key` |
| RF-07 | 1.1 | `done` e terminal na instancia; `reportTrackChange` pos-done e no-op |
| RF-08 | 3.2 | Terceiro ramo JSX gated em `!reconnecting && !failed`, padrao existente das linhas 167-169 |
| RF-09 | 3.2 | Stream com zero faixas de video = `setBlocked(true)` permanente, aviso nunca monta |
| RF-10 | 3.2 (2b) | Instancia da maquina por mount; `key={txId}` remonta; nada sobrevive |
| RF-11 | 3.2 | Overlay `inset: 0` dentro do `.z-player` (container do fullscreen); PiP cru sem camada do app = ausencia aceita |
| RF-12 | 3.1 | Estagio 2 so texto com sugestao de fechar/abrir (`escalatedText/escalatedHint`) |
| RF-13 | 3.1 | Nenhum elemento interativo no componente; `pointer-events: none` nos blocos de texto |
| RF-14 | 3.2 | Nenhuma mensagem nova no mesh; verificado por diff e pelo e2e sem fallbacks |
| RF-15 | 1.1, 4.1 | Freeze pos-quadro nao reabre (design terminal) e cenario 6 do unit prova |
| RF-16 | 1.1, 4.3 | `console.info('[player] primeiro quadro de <txId> em <ms>ms (aviso: ...)')`; e2e assere a linha |
| RF-17 | 1.1, 4.1 | `console.warn(... fechada sem nenhum quadro ...)` no `dispose()`; cenario 8 do unit |
| RF-18 | 3.1 | Momento 1: `z-fade-in` do cartao (herdado) + logo `z-status-bounce-in` por nome, delay 60ms |
| RF-19 | 3.1 | Momento 2: `z-waiting-pulse` (so opacity) no wrap da logo, apenas no estagio 1, desmontado ao sair |
| RF-20 | 3.1 | Momento 3: crossfade real por grid stacking, 180ms, `var(--ease)` |
| RF-21 | 1.1, 3.1, 3.2 | Momento 4: keyframe novo `z-fade-out` (nome novo reinicia; reverse do mesmo nome saltaria para opacity 0) + unmount em 200ms, iniciado so apos `WAITING_MIN_VISIBLE_MS` de aviso visivel (anti-flash) |
| RNF-01 | 1.1, 3.2 | Somente rVFC + `framesDecoded` + estado de overlays; zero leitura de pixels (nao ha canvas/ImageData em lugar nenhum) |
| RNF-02 | 3.2 | rVFC armado uma vez, sem re-agendamento; `cancelVideoFrameCallback` no cleanup |
| RNF-03 | 3.1 | So `opacity`/`transform` em todo CSS novo; reduced-motion global de theme.css 62-77 se aplica sozinho |
| RNF-04 | 3.1 | Texto porta a informacao; pulso parado com reduce e precedente aceito do `.z-spinner` |
| RNF-05 | 2.1, 4.2 | Mesmo tick/`getStats` do `StatsMonitor`; teste conta chamadas por tick |
| RNF-06 | 3.2, 4.3 | Zero mudanca no caminho de conexao; `expectNoDirectionFallbacks` mantido verde |
| RNF-07 | 2.1, 3.2 | Leitura passiva etiquetada + observacao no DOM; nenhum comportamento de conexao alterado |
| RNF-08 | 3.1, 4.3 | Copy ASCII pt-BR sem acento/travessao; teste de copy prova mecanicamente |
| RNF-09 | 3.1 | Base `.z-reconnect` + tokens/keyframes por nome (UISPEC 3/4/6), fundo `#000000a6` |
| RNF-10 | 4.1-4.3 | Sprint dedicado; done-when final roda a suite completa |

Nenhum RF/RNF orfao (21 RF + 10 RNF, todos mapeados).

## 9. Assumptions e questoes em aberto

- `[ASSUMPTION]` **Q1/rVFC em background**: baseado na spec WICG (callbacks nos rendering steps) e na documentacao oficial do Electron ("If backgroundThrottling is disabled, the visibility state will remain visible even if the window is minimized, occluded, or hidden"), assumo que com o `backgroundThrottling: false` ja configurado (src/main/index.ts linha 68) a pintura e o rVFC continuam rodando com a janela minimizada, e que portanto o ramo de pausa por visibilidade e inerte hoje. Nao foi feita medicao empirica no Electron 43 nesta maquina. Se a assumption estiver errada em algum cenario de oclusao, a degradacao e SEGURA por design: o relogio pausa via `visibilitychange` quando o Chromium reportar oculto, e a prova decodificada (independente de pintura) encerra a espera; nenhum dos dois erros possiveis produz aviso falso, no pior caso o aviso aparece correto (o espectador realmente nao esta vendo quadro).
- `[ASSUMPTION]` **Nivel do log**: `info` para o caminho feliz e `warn` para "fechou sem quadro", sem retencao propria (herda a rotacao diaria + purge do `file-logger`). A PRD delega o formato ao SPEC; o par info/warn segue o precedente `[media]` (info para progresso, warn para anomalia).
- `[ASSUMPTION]` **Tempo logado e de parede** (desde a abertura da visualizacao), nao o efetivo descontado de pausas: e o numero que a `video-codec-upgrade` precisa (quanto o usuario esperou de verdade). O estagio maximo logado ja carrega a informacao de escalada efetiva.
- `[ASSUMPTION]` **`WAITING_EXIT_MS = 200` local no `PlayerView`** (nao em config): e detalhe de coreografia acoplado ao `--dur-enter` de 180ms do CSS, nao um limiar de produto; muda junto com o CSS se mudar. Ja `WAITING_MIN_VISIBLE_MS = 300` e limiar de PRODUTO e vive em `src/shared/config.ts` com os outros dois.
- **DECISAO (fechada com o usuario, revisao 2) - minimo visivel do aviso**: o risco de flash (quadro chegando logo apos a carencia, aviso aparecendo e sumindo em ~100ms) deixou de ser aceito. Custo assumido conscientemente: no pior caso o veu escuro do overlay fica sobre o video ja em reproducao por ate ~300ms de minimo mais ~180ms de fade (~480ms totais), considerado preferivel ao flash que le como defeito da interface. O video NUNCA e atrasado: toca por baixo do veu o tempo todo, e o log do primeiro quadro registra o instante real, sem o atraso da coreografia.
- `[OPEN]` Nenhuma questao aberta bloqueante: as tres questoes delegadas pela PRD estao resolvidas na secao 2 (Q1 com a assumption acima; Q2 e Q3 fechadas por verificacao de codigo).

Self-check: PASS (revalidado na revisao 3, achados do forge-review aplicados: saida corrigida para o keyframe NOVO `z-fade-out` declarado em theme.css, porque reaplicar `z-fade-in` com `reverse` nao reinicia animacao terminada e saltaria para opacity 0; entrada do texto do momento 1 definida sem ambiguidade como animacao unica no container `.z-waiting__swap`; snippet do JSX corrigido para congelar o ultimo estagio visivel via `lastShownStageRef`; contagem de constantes do Sprint 1, colisao de `entry`/`now` no `sample()` e redacao do assert e2e ajustadas. Revisao 2: minimo visivel `WAITING_MIN_VISIBLE_MS` implementado na `FirstFrameWatch` para continuar unit-testavel, log nunca atrasado, invariante de nao segurar o video registrada nas secoes 2, 4, 5b e nas Features 1.1/3.2, cenario 10 adicionado a Feature 4.1 sem renumerar, matriz da secao 8 sem orfaos) - dry-run de implementabilidade feito feature a feature (nomes, assinaturas, linhas e ordem definidos sem lacuna); correcoes aplicadas durante o proprio dry-run: (1) a saida do overlay trocada de `transition` para keyframe dedicado de fade-out ao verificar que `.z-reconnect` linha 152 tem `animation ... both` que venceria a transition (solucao final: `z-fade-out`, revisao 3); (2) pulso movido para um wrap da logo para a remocao na escalada nao reiniciar o bounce; (3) asserts de `inboundConnections` nas linhas 510/623 do teste existente incluidos na Feature 2.1 apos grep de consumidores. Verificacao mecanica: secao 5 sem endpoints e 5c coerente (N/A dos dois lados); `Consumes endpoints` unico (3.2) aponta o N/A da secao 5; 2b sem celula de Edit orfa (nao ha round-trip); matriz da secao 8 sem orfaos (21 RF + 10 RNF); regras quantitativas com modelo explicito (1,5s de carencia e 12s EFETIVOS TOTAIS desde o zero, com o exemplo AC-01 do quadro aos 3s coberto no cenario 1 da Feature 4.1); todos os paths absolutos existem e todas as linhas citadas foram conferidas por Read/grep neste commit.
