---
feature: viewer-cursors
language: pt-BR
code_identifier_language: en - mirrors-existing-codebase
generated: 2026-08-27
stack: Electron 43.4.1 + React 18 + TypeScript 5.9 (electron-vite), PeerJS 1.5.5 (WebRTC mesh, sinalizacao publica, sem TURN), Zustand 5, Vitest 4 (unit) + Playwright 1.62 `_electron` (e2e), Windows-only
status: spec
prd_source: PRD_viewer-cursors.md @ 03b731b29ab294fe23e2c468555a6d7ba060d0dd
---

# SPEC - viewer-cursors

## 1. Baseline (ancora de drift)

- **HEAD**: `39dbc8d44e177aa2667388d16497b452b2de7910` (branch `feature/viewer-cursors`)
- Arvore limpa neste HEAD, exceto o proprio `UISPEC_viewer-cursors.md` (que era untracked quando esta SPEC comecou) e os artefatos do forge.

**Documentos de entrada** (`git hash-object`, sha1 de 40 caracteres, todos conferidos completos):

| Documento | Fingerprint |
|---|---|
| `.forge/ideas/viewer-cursors/PRD_viewer-cursors.md` | `03b731b29ab294fe23e2c468555a6d7ba060d0dd` |
| `.forge/ideas/viewer-cursors/CONTEXT_viewer-cursors.md` | `8a7c6583e770e171f1db78434577614d14e6df53` |
| `.forge/ideas/viewer-cursors/UISPEC_viewer-cursors.md` | `0bbddbe466cf78d9e02289bfb93fcc8c5996a3b6` |
| `.forge/ideas/viewer-cursors/IDEA_viewer-cursors.md` | `29a6866735df48dc25bb95e1b6cf1366ad46a5db` |
| `.forge/LESSONS.md` | `fd80d0424a094d89a9f5bc317a71d356809ac687` |

Nota sobre algoritmo: a PRD e o CONTEXT registram os fingerprints da IDEA/CONTEXT em **sha256** (64 caracteres), nao em sha1. Reconferido nesta SPEC: `sha256(IDEA) = 1759d1ffa0e13eb0702a4b9c02cb0fa9647f421b64b6098606f83443fc061f32` e `sha256(CONTEXT) = 24bafa755a3236e65f4406ad70d154622842a62e5ef8011c1338a8f521bcaa33`, identicos aos registrados na PRD (secao Baseline) e no CONTEXT (secao 0). **Sem drift de documento.** A tabela acima usa `git hash-object` (sha1) por ser a convencao das SPECs anteriores deste projeto; os dois valores convivem, sao algoritmos diferentes sobre o mesmo arquivo.

**Arquivos de codigo dos quais esta SPEC depende** (`git hash-object`, sha1 de 40 caracteres):

| Arquivo | Fingerprint |
|---|---|
| `src/shared/protocol.ts` | `f3496673b7f5f4692a43084fe22fcfe1bce75820` |
| `src/shared/ipc.ts` | `f2999e26e1f8b42c532227b7f74ad2326df455ee` |
| `src/shared/config.ts` | `cdea2594a08a52a61d4ef25fb571f7bafda00b0b` |
| `src/main/index.ts` | `6f427b1666d095a1a5b536ec89928e6dfc49e0f0` |
| `src/main/ipc-handlers.ts` | `81988c330f4a0d0f62a02866698c6f6db0f363ae` |
| `src/main/capture.ts` | `3ac37d4b496fa89e9b1e83b82ad565d13c420058` |
| `src/preload/index.ts` | `3b47597a76b46c4eddabfda294d9c737fe226bd6` |
| `src/renderer/src/services/mesh.ts` | `dd40d0989e49c7882a8245f0fce6b334f50f5ed6` |
| `src/renderer/src/services/session.ts` | `b4dfa32700e4a467d9b88d1861a38c8c53b6544d` |
| `src/renderer/src/services/media-manager.ts` | `30ff417df80f937b550af1242880f97bb1b39e45` |
| `src/renderer/src/services/peer-manager.ts` | `9a6ed3a80adc130fc9991f633ff0e77419cfefdc` |
| `src/renderer/src/services/pip-controller.ts` | `bf802f1944b0019edbc7d690040d5dfdfb52102b` |
| `src/renderer/src/core/room-state.ts` | `ad05a768e0d4b97764177294e346aa2bd825d2df` |
| `src/renderer/src/store/app-store.ts` | `0404c9ec1f5436c6c489a1516fcab3b6e2f39d44` |
| `src/renderer/src/ui/screens/PlayerView.tsx` | `4c682a75d68b436a70cd8415fbdf38f7b44ebc43` |
| `src/renderer/src/ui/screens/player.css` | `061724847ce311a7d3bdcf34279936a4ec1db157` |
| `src/renderer/src/ui/screens/room.css` | `e48b6d8e4cb85fb6dfa4104b17d93c5007e669d9` |
| `src/renderer/src/ui/screens/RoomScreen.tsx` | `db8c1cba2545c8a6e494cde309b4bb5c4b8b7aab` |
| `src/renderer/src/ui/components/ParticipantCard.tsx` | `554551c367bd96cb0226f2dbbc05f46debdaaa87` |
| `src/renderer/src/ui/components/SourcePickerModal.tsx` | `37d0f58372feb617d1546aabb9d6ec36f214fea8` |
| `src/renderer/src/ui/components/TransmittingBar.tsx` | `f67ce03b30ef66b02a749321a83ae4d6e0e2f752` |
| `src/renderer/src/ui/components/Toast.tsx` | `e3bd3a2f9115c97c07a9a4dd7a7fa7e42a93d8c0` |
| `src/renderer/src/ui/components/components.css` | `5ddabd594454f701657686a09570b6836bf8b704` |
| `src/renderer/src/ui/theme.css` | `2e608de9e177dbbb754ca6d6621455b82e34f383` |
| `tests/e2e/helpers/zoi-app.ts` | `b0a560c4b1bb3a896d88cba7e77ecb43dcbf97a1` |
| `src/renderer/src/ui/screens/screens.css` | `f507ca04850c7d10d5e3e8fa77dd59332b960ffd` |
| `src/renderer/index.html` | `093e9615088e831676b7ecf5aea3d7d5a4e1df48` |
| `electron.vite.config.ts` | `c0e2bc6482bf3a6cd1d603c53749e269f1b82532` |

**Sem drift de codigo**: todos os hashes acima que tambem constam no CONTEXT (secao 0) e no UISPEC (secao 1) batem exatamente. Adicoes desta SPEC que os documentos anteriores nao listavam individualmente: `src/preload/index.ts`, `src/renderer/src/services/pip-controller.ts`, `src/renderer/src/ui/screens/RoomScreen.tsx` (e `player.css`, que o UISPEC ja havia acrescentado). Mudanca em qualquer um destes arquivos invalida (ou exige reconferir) esta SPEC.

---

## 2. Visao geral do desenho

**Convencao de identificadores (obrigatoria para todos os agentes das Stages 4 e 5)**: identificadores de codigo (tipos, funcoes, variaveis, campos de payload, constantes, classes CSS, `data-testid`) em INGLES, espelhando o repositorio: camelCase para funcoes/variaveis (`normalizedPointIn`, `viewerPeerIdsOf`), PascalCase para tipos/componentes (`CursorMovePayload`, `CursorLayer`), SCREAMING_SNAKE_CASE para constantes de configuracao/protocolo (`CURSOR_SEND_INTERVAL_MS`, `CURSOR_MOVE`), kebab-case para arquivos (`cursor-hub.ts`) e para `data-testid` (`pointer-toggle`), prefixo `z-` BEM-like para CSS (`z-cursor`, `z-cursor__name`, `z-switch--disabled`). Prosa, comentarios de codigo, strings de UI, textos de log e mensagens de commit em **pt-BR SEM acentos e SEM travessao**.

### 2.1 A invariante que organiza tudo

A feature inteira gira em torno de RF-05: **a posicao do cursor viaja como DADO e nunca como PIXEL**. Isso produz tres consequencias de arquitetura que valem para cada decisao abaixo:

1. O overlay do transmissor precisa ficar comprovadamente FORA da propria captura (`setContentProtection`), senao o cursor volta dentro do video e cada espectador ve o proprio fantasma atrasado. Isso e a Sonda A.
2. O overlay precisa saber QUAL monitor fisico cobrir, partindo da fonte escolhida no `desktopCapturer`. Essa ponte nao existe no codigo. Isso e a Sonda B.
3. Cada cliente desenha localmente e simplesmente NAO desenha o proprio cursor. Nenhum video por espectador, nenhuma diferenciacao de stream.

### 2.2 Sprint 1 e um SPIKE e ele e PRECONDICAO (PRD RNF-11, AC-40)

**Nada abaixo pode ser implementado antes de as duas sondas passarem.** As duas sao executadas por um script proprio no molde de `scripts/audio-probe.mjs` (precedente da feature `app-audio-capture`), e o resultado e registrado em `.forge/ideas/viewer-cursors/SPIKE-RESULTS_viewer-cursors.md`, no formato de `.forge/complete/app-audio-capture/SPIKE-RESULTS_app-audio-capture.md` (tabela "veredito por item" seguida de uma secao por sonda com a saida real).

- **Sonda A - `setContentProtection` tira a janela da PROPRIA captura.** Uma `BrowserWindow` transparente com `setContentProtection(true)` some do `desktopCapturer` do MESMO processo, no Electron 43.4.1, sem efeito colateral (a janela continua visivel ao olho humano, continua click-through, e a captura do monitor continua entregando o resto da tela).
- **Sonda B - fonte do `desktopCapturer` para monitor fisico.** `CaptureSource.displayId` (vem de `source.display_id`, `src/main/capture.ts:49`, tipado em `src/shared/ipc.ts:63`) casa com algum `display.id` de `screen.getAllDisplays()`, e o `display.bounds` resultante posiciona a janela exatamente sobre aquele monitor. `screen.getAllDisplays()` nao aparece em lugar nenhum do codigo hoje.
- **Se QUALQUER uma falhar, o pipeline PARA e volta para conversa com o usuario.** Nao existe plano B nesta SPEC, por decisao explicita da IDEA (secao 2, 2026-08-26) e pela licao ja registrada no `LESSONS.md` (2026-08-25, `app-audio-capture`: premissa de API vira fato so quando executada). E proibido a qualquer agente de implementacao improvisar um caminho alternativo (desenhar dentro do video, usar `setIgnoreMouseEvents` sem `setContentProtection`, cobrir todos os monitores, e assim por diante).

### 2.3 As sete pecas

1. **Cor por pessoa (`src/shared/person-colors.ts`, modulo PURO, novo)** - paleta fixa de 10 cores de familia mais resolucao deterministica de colisao pelo roster. Detalhe e justificativa da tensao (ii) contra (iii) em 3/T1. Consumida por `ParticipantCard` (RF-22), pela camada de cursores do espectador e pelo overlay do transmissor.
2. **Geometria do letterbox (`src/shared/geometry.ts`, modulo PURO, novo)** - `contentRectOf(...)`, a matematica de `object-fit: contain` (RF-19). Detalhe em 3/T4.
3. **Protocolo** - dois `MessageType` NOVOS (`CURSOR_MOVE`, `CURSOR_END`) e UM campo aditivo opcional (`pointers?: boolean` em `TxStartPayload`). O toggle pega carona no `TX_START` justamente para nao gastar um terceiro valor de enum e para reusar o caminho de REANUNCIO IDEMPOTENTE que ja existe no reducer (`room-state.ts:569-591`). Detalhe em 5.A.
4. **Rota das posicoes (`Mesh.sendMany`, novo)** - fan-out seletivo so para quem participa daquele `txId`. Detalhe em 3/T3.
5. **`CursorHub` (`src/renderer/src/services/cursor-hub.ts`, novo)** - o unico lugar por onde posicao de cursor entra e sai. **Nao passa pelo reducer**, exatamente como o heartbeat PING/PONG ja nao passa (`session.ts:899-901`, comentario "Heartbeat nao passa pelo reducer: e puro transporte"). E o que protege RNF-01 (nenhum `reduce()` mais `notify()` mais re-render de React a 25 Hz por espectador) e RNF-06 (o carimbo de `txId` das posicoes nunca toca `transmissions`/`selfWatchingTxId`).
6. **Camada de desenho do espectador (`CursorLayer`, componente React novo dentro de `.z-player`)** - irmao transparente entre o `<video>` e o `PlayerControls`, conforme o UISPEC (secao 4, bloco "EMPILHAMENTO").
7. **Overlay do transmissor (`src/main/pointer-overlay.ts` mais a segunda entry de renderer `overlay.html`)** - `BrowserWindow` transparente, sempre no topo, click-through, protegida da captura, cobrindo SO o monitor compartilhado, que sobe quando o toggle liga e desce quando desliga, para ou troca de fonte.

### 2.4 Fluxo do caminho feliz

Leo transmite o monitor 1 com ponteiros LIGADOS (txId A). Bruna e Joao assistem A.

```
LEO (transmissor)
  toggle ligado -> session.setTransmissionPointers(true) -> LOCAL_TX_POINTERS
     -> reducer marca transmissions[A].pointersEnabled = true
     -> broadcast TX_START { txId: A, ..., pointers: true }   (reanuncio, sem som)
     -> efeito pointerOverlay { action: 'show', displayId }
     -> main: cria a BrowserWindow do overlay sobre o monitor 1

BRUNA (espectadora de A)
  mousemove sobre .z-player
     -> contentRectOf(video) -> (x, y) normalizados no CONTEUDO real
     -> CursorHub guarda a ultima posicao (nao envia ainda)
  timer de 40 ms (25 Hz, RF-32)
     -> mesh.sendMany([Leo, Joao], CURSOR_MOVE { txId: A, x, y })

JOAO (espectador de A)
  handleMeshMessage intercepta CURSOR_MOVE ANTES do dispatch
     -> checagens de confianca (5c) -> CursorHub.applyRemote(Bruna, A, x, y)
     -> CursorLayer move o marcador com transform mais transicao de 32 ms linear

LEO
  mesmo caminho ate o CursorHub
     -> a cada 33 ms o CursorHub emite UM frame agregado por IPC
        window.zoi.pointerOverlay.sendFrame({ txId: A, pointers: [...] })
     -> main relaya para a webContents do overlay
     -> overlay desenha o marcador da Bruna na cor dela, com o nome
```

### 2.5 Mecanismos deliberadamente NAO tocados

`reconnection.ts` (heartbeat e fallbacks), `first-frame-watch.ts`, `media-manager.ts` no que toca watchdog, codec, negociacao e `applySenderParameters`, `audio-exclusion.ts`, `stats-monitor.ts`, `TransmissionStatusCard.tsx`, `StreamThumbnail.tsx`, o bloqueio de auto-visualizacao (`isSelfSelected`, `RoomScreen.tsx:74`) e todo o fluxo de admissao/`door`. As unicas linhas novas em `media-manager.ts` sao o campo `pointers` no `LocalTransmission` e o repasse desse campo no reenvio de `TX_START` de `onMemberJoined` (`media-manager.ts:677-694`).

---

## 2b. Mapa de ciclo de vida das entidades

Esta feature **nao persiste nada** (PRD RF-03, P4): nao ha campo novo em `AppSettings`, nao ha chave nova em `settings.json`, nao ha `localStorage`. As linhas "Persistir" abaixo dizem `N/A` com o motivo. O que existe de verdade sao tres ciclos: o do TOGGLE por transmissao, o do PONTEIRO por espectador e o da JANELA de overlay.

### 2b.1 `pointersEnabled` (toggle, ESCOPO DE TRANSMISSAO)

| Etapa | Onde | Como |
|---|---|---|
| Criar | `SourcePickerModal` (estado local `useState(false)`) e `MediaManager.startTransmission` (`media-manager.ts:428`) | A transmissao nasce SEMPRE com `false`; o valor escolhido no modal so vira `true` DEPOIS de o overlay subir de fato (`await setPointersMode(true)`, feature B3.2 passo 3), e nunca quando a fonte e `window` (RF-04). O modal nasce desligado a cada abertura porque `SourcePickerModal` so monta quando aberto (`SourcePickerModal.tsx:213`, `if (!open) return null`) - o mesmo motivo pelo qual a lista de fontes e sempre fresca. Isso ja garante RF-03 sem uma linha de codigo de "esquecer". |
| Ler (transmissor) | `RoomScreen`, estado `pointersOfTx: { txId: string; on: boolean } \| null` | Copia EXATA do padrao `sharpnessOfTx` (`RoomScreen.tsx:48` e `:115`): o `txId` fica guardado junto do valor, entao qualquer transmissao nova le desligado na propria renderizacao, sem efeito que zera. |
| Ler (espectador) | `RoomState.transmissions[txId].pointersEnabled` | Preenchido pelo `TX_START` (campo `pointers`, contrato 5.A1). Ausente (cliente antigo) vale `false`. |
| Atualizar | `session.setTransmissionPointers(on)` -> evento `LOCAL_TX_POINTERS` -> reducer | Atualiza `transmissions[txId].pointersEnabled` local e devolve `broadcast` de `TX_START` com o campo novo mais o efeito `pointerOverlay`. **Sem `playSound` e sem `showToast`** do lado de quem liga. |
| Propagar para quem entra depois | `MediaManager.onMemberJoined` (`media-manager.ts:677-694`) | O reenvio direto de `TX_START` passa a incluir `pointers: transmission.pointers`. Sem isso, um espectador que entra com os ponteiros JA ligados nunca saberia. |
| Destruir | `MediaManager.stopTransmission` (`media-manager.ts:535`) e `switchSource` (`media-manager.ts:594`) | `switchSource` e `stopTransmission` mais `startTransmission`, entao a transmissao nova nasce com o valor escolhido no NOVO modal e nunca herda coordenada nem toggle da fonte antiga (RF-11). No espectador, o `TX_STOP` remove a transmissao inteira do estado (`room-state.ts:626-650`). |
| Persistir | **N/A por decisao (RF-03)** | Nunca vai para `AppSettings` nem para disco. O padrao de `forceVp8` em `src/main/settings.ts` serve aqui so como referencia NEGATIVA: nada daquilo e necessario. |

### 2b.2 Ponteiro de um espectador (`CursorEntry`, ESCOPO DE MEMORIA, POR `txId`)

Vive so no `CursorHub` (renderer da janela principal) e no estado da janela de overlay. Nunca entra em `RoomState`, nunca vai para disco, nunca entra em `ROSTER_UPDATE`.

| Etapa | Onde | Como |
|---|---|---|
| Criar (lado de quem aponta) | `CursorLayer`, `onMouseMove` sobre `.z-player` | So existe se TODAS estas forem verdadeiras: `transmissions[txId].pointersEnabled === true`, `selfWatchingTxId === txId`, `pipActive === false`, a janela tem foco, e o ponto cai DENTRO do retangulo de conteudo real. |
| Enviar | `CursorHub.flush()`, timer de `CURSOR_SEND_INTERVAL_MS` (40 ms) | Envia a ultima posicao SO se ela mudou desde o ultimo flush. Cadencia maxima 25/s (RF-32). |
| Criar (lado de quem desenha) | `CursorHub.applyRemote(peerId, txId, x, y)` | A primeira posicao valida de um peer cria a entrada com `enteredAt = now`, o que dispara a animacao de entrada (fade mais escala). |
| Atualizar | mesma funcao | Sobrescreve `x`, `y`, `lastAt`. O marcador desliza por transicao CSS de 32 ms linear (excecao de motion, 3/T6). |
| Esmaecer (inatividade) | `CursorHub` marca `idle` quando `now - lastAt >= CURSOR_IDLE_MS` (5 000 ms) | Fade out por `opacity` (RF-26). Volta a `idle: false` na proxima posicao (fade in). O relogio que avalia isso e o MESMO tick de 33 ms do frame de saida: nenhum timer novo. |
| Apagar (explicito) | `CURSOR_END` recebido | Remove a entrada com a animacao de saida definitiva. Enviado em SEIS gatilhos: mouse saiu da area valida (RF-17), `mouseleave` do player, `blur` da janela (RF-20), entrada em PiP (T9), troca de `txId` (RF-18), desmontagem do `PlayerView`. |
| Apagar (implicito) | `CursorHub.pruneAgainstRoster(members)` | Assinado em `session.subscribe` (baixa frequencia): peer que saiu do roster perde o ponteiro na hora (RF-29). |
| Apagar (coletivo) | `pointersEnabled` virou `false`, ou a transmissao sumiu de `transmissions` | O `CursorHub` limpa TODAS as entradas daquele `txId` de uma vez, com transicao coletiva (RF-27). |
| Persistir | **N/A por decisao** | Dado de altissima frequencia, valido so enquanto o mouse esta parado ali. Guardar seria errado em qualquer horizonte. |

### 2b.3 Janela de overlay do transmissor (`pointerOverlayWindow`, ESCOPO DE PROCESSO MAIN)

| Etapa | Onde | Como |
|---|---|---|
| Criar | `src/main/pointer-overlay.ts`, `showPointerOverlay({ displayId })` | So no momento em que o toggle LIGA numa transmissao de MONITOR (RF-07: nao existe janela invisivel permanente). Posicao e tamanho vindos do `display.bounds` resolvido pela Sonda B. |
| Proteger | `window.setContentProtection(true)` ANTES de `show()` | Invariante RF-05. Se a chamada lancar, a janela e destruida e nada e mostrado (risco R1). |
| Atravessar cliques | `window.setIgnoreMouseEvents(true)` (SEM `{ forward: true }`) | RF-09. `forward: true` faria o Chromium continuar entregando eventos de mouse a pagina, que e exatamente o que nao se quer aqui. |
| Alimentar | `IPC.pointerOverlayFrame` (renderer para main para `overlayWindow.webContents.send`) | Um frame agregado a cada 33 ms, com TODOS os ponteiros. Nunca uma mensagem por posicao recebida. |
| Reposicionar | `screen.on('display-metrics-changed')` e `screen.on('display-removed')` | Monitor que muda de resolucao ou posicao move a janela; monitor compartilhado que SOME derruba a janela (nao ha o que cobrir). |
| Destruir | `hidePointerOverlay()` | Chamado por: toggle desligado, `stopTransmission` (qualquer motivo, inclusive `source_switch` e `leaving`), `mainWindow` fechada, `app.on('before-quit')`. RF-10, e o guarda contra janela orfa (risco R2). |
| Persistir | **N/A** | Janela do sistema; nao existe estado a guardar. |

---

## 3. Trade-offs e alternativas rejeitadas

**T1. Algoritmo da cor por pessoa: paleta fixa de 10 mais desempate deterministico pelo roster (PRD RF-21, RF-22, RF-23, RNF-05).**

A PRD registra QUATRO propriedades e uma tensao explicita entre (ii) matizes bem separados e (iii) estabilidade. A decisao desta SPEC:

*Camada 1, identidade permanente.* `slotOf(peerId) = hash32(peerId) % PERSON_COLOR_COUNT`, com `PERSON_COLOR_COUNT = 10` e `hash32` sendo FNV-1a de 32 bits sobre os code units do `peerId` (deterministico, sem dependencia externa, identico em qualquer maquina). Isso sozinho ja satisfaz (i) e (iii) de forma absoluta.

*Camada 2, desempate por colisao, escopado ao roster.* Quando duas ou mais pessoas PRESENTES caem no mesmo slot, e so entao, o desempate e resolvido assim:
- ordena os colidentes por `joinedAt` crescente, com `peerId` lexicografico como criterio de desempate (os dois campos ja vem replicados em `RosterMember`, `protocol.ts:37-43`, entao todo cliente calcula igual);
- o PRIMEIRO da ordem FICA com o slot;
- cada um dos demais anda pela paleta a partir de `slot + 1` (modulo 10) ate achar o primeiro slot livre.

*Por que essa e a escolha certa:*
- **A separacao vence a estabilidade absoluta, mas o preco pago e o menor possivel.** Duas pessoas com a MESMA cor destroem o proposito da feature (o ponto de ter cor e reconhecer quem aponta sem ler o nome, IDEA secao 7). Ja uma troca de cor e um incomodo pontual. Entre "sempre distinguivel" e "nunca muda", o desempate UX-first manda escolher sempre distinguivel.
- **Um membro NOVO nunca muda a cor de ninguem.** Como o criterio de posse e `joinedAt` crescente, quem chega e sempre o ultimo da ordem e portanto sempre o deslocado. Esta e a diferenca pratica em relacao a um desempate puramente lexicografico: entradas sao o evento comum, e elas ficam de graca.
- **Nenhuma colisao e possivel com a sala cheia.** `ROOM_MAX_LIMIT = 8` (`src/shared/config.ts:158`) e a paleta tem 10 slots: a caminhada sempre acha slot livre, entao duas pessoas presentes NUNCA compartilham cor. E uma garantia estrutural, nao estatistica.
- **Consequencia aceita e documentada (RF-23, AC-22):** quando alguem SAI da sala, um deslocado pode voltar ao slot canonico dele e mudar de cor. E raro, e sempre uma volta para a cor propria da pessoa, e acontece num instante em que a sala ja mudou visivelmente (o toast e o som de saida ja existem hoje).
- **Janela de divergencia transitoria**, registrada com honestidade: enquanto um `ROSTER_UPDATE` esta em transito, dois clientes podem calcular cores diferentes por alguns milissegundos. Como a cor nunca e enviada pela rede (cada cliente calcula do `peerId` mais o roster), a convergencia e automatica no proximo roster. Nada quebra: no maximo um piscar de cor.

*A familia visual (propriedade iv), com verificacao numerica.* Cada slot e definido por `{ hue, light }` e as duas cores concretas saem de uma formula FIXA que reproduz exatamente o par atual do avatar quando `hue = 277`:
- preenchimento (cursor, texto da inicial do avatar): `hsl(H, 100%, L%)`
- fundo do avatar: `hsl(H, 100%, 50%)` com alpha `0.15`

Em `H = 277, L = 62` isso da `#b53dff` sobre `#230935`, que e o par do avatar de hoje a menos de um arredondamento: `--accent-hover` e `#b23dff` (`theme.css:21`) e `hsl(277 100% 62%)` cai em `#b53dff`, tres unidades de vermelho de diferenca, imperceptivel e sem efeito no contraste. Ou seja, **o avatar de hoje vira, na pratica, um membro da nova familia, e nao um caso a parte**. Os 10 slots (todos fora da faixa de matiz de `--danger` `#ff3d5e`, matiz aproximadamente 349, conforme o Don't do UISPEC secao 7) e o contraste da inicial contra o proprio fundo do avatar sobre `--bg-app` `#0e0b12` (que e o `background` de `.z-participant`, `room.css:206-216`):

| # | hue | light | preenchimento | fundo do avatar | contraste da inicial |
|---|---|---|---|---|---|
| 0 | 20 | 62% | `#ff7e3d` | `#32160f` | 6.60:1 |
| 1 | 52 | 62% | `#ffe53d` | `#322b0f` | 11.11:1 |
| 2 | 85 | 62% | `#aeff3d` | `#22300f` | 11.47:1 |
| 3 | 117 | 62% | `#47ff3d` | `#0e300f` | 10.80:1 |
| 4 | 150 | 62% | `#3dff9e` | `#0c3023` | 10.94:1 |
| 5 | 182 | 62% | `#3df9ff` | `#0c2e36` | 11.09:1 |
| 6 | 215 | 62% | `#3d8eff` | `#0c1936` | 5.39:1 |
| 7 | 247 | 72% | `#8170ff` | `#100936` | 5.11:1 |
| 8 | 280 | 68% | `#c95cff` | `#250936` | 5.52:1 |
| 9 | 312 | 62% | `#ff3dd8` | `#32092e` | 5.69:1 |

Referencia atual para comparacao, calculada com o `--accent-hover` REAL (`#b23dff`) sobre o `--accent-soft` REAL composto (`#9d00ff` com alpha `0x26/255 = 0.149` sobre `#0e0b12`, o que da `#230935`): **4.31:1**. **Todos os 10 slots ficam ACIMA do que o app entrega hoje**, e o pior deles (5.11:1) tem folga de 13% sobre o minimo de 4.5:1 e de 19% sobre a referencia atual. Isso e o que fecha RF-23, RNF-05 e AC-22/AC-35 de forma verificavel em teste unitario, e nao por opiniao. Os matizes 215, 247 e 280 ganham `light` maior de proposito: azul e roxo puros tem luminancia baixa e cairiam abaixo da referencia atual com `light: 62%`.

*Rejeitado: matiz continua por hash (`hue = hash % 360`).* Determinismo e estabilidade perfeitos, mas com 8 pessoas a chance de duas cairem a menos de 20 graus uma da outra e de aproximadamente 98% (a formula `(1 - n*d/360)^(n-1)` com `n = 8` e `d = 20` da 0.017 de chance de NAO colidir). Falha a propriedade (ii) na pratica quase sempre.

*Rejeitado: paleta fixa sem desempate nenhum.* Com 10 slots e 4 pessoas, aproximadamente 50% de chance de duas pessoas com a MESMA cor. Estabilidade perfeita, mas mata o proposito da feature.

*Rejeitado: reindexacao total por posicao no roster ordenado (`rank = indice`).* Da separacao maxima, mas QUALQUER entrada ou saida no meio da lista muda a cor de todo mundo depois dela. E a versao mais agressiva da tensao e a pior para o usuario.

*Rejeitado: sortear a cor no cliente e anunciar pelo mesh.* Precisaria de mensagem nova, de resolucao de conflito e de estado replicado. Contraria explicitamente a propriedade (i) e a decisao da IDEA de 2026-08-26.

**T2. As duas sondas: script proprio, nao teste automatizado, e nenhum plano B.**
Escolhido: um script `scripts/pointer-probe.mjs` no molde EXATO de `scripts/audio-probe.mjs` (que existe e e o precedente do projeto), rodado por `npm run pointer:probe`, com resultado registrado num `SPIKE-RESULTS_viewer-cursors.md`.
Rejeitado: virar teste de Vitest. `setContentProtection`, `desktopCapturer` e `screen` sao APIs do MAIN, e `tests/unit` e typechecado pelo projeto WEB, entao importar main de la quebra o typecheck (a SPEC anterior ja registrou essa mesma restricao no item T6 do sprint de testes dela).
Rejeitado: virar spec de Playwright. A Sonda A precisa comparar dois quadros de captura da propria tela, o que nao e o que o `_electron` serve para fazer, e a Sonda B precisa de dois monitores fisicos.
Rejeitado: sondar durante a implementacao. E exatamente o erro que a `app-audio-capture` pagou caro e que virou licao no `LESSONS.md`.

**T3. Rota das posicoes: fan-out seletivo por `Mesh.sendMany`, nunca broadcast (PRD RF-32, RNF-01, RNF-03).**
Escolhido: metodo NOVO `Mesh.sendMany(peerIds, message)`, espelho literal de `broadcast` (`mesh.ts:277-288`) trocando o laco sobre `this.entries` por um laco sobre a lista recebida. Serializa o envelope UMA vez (`createEnvelope`) e chama o mesmo `deliver()`. Os destinatarios de uma posicao de `txId` sao: **o transmissor daquele `txId` mais os OUTROS espectadores do mesmo `txId`**, calculados por um helper puro novo `viewerPeerIdsOf(state, txId)` em `room-state.ts`, irmao de `viewersOf` (`room-state.ts:290-296`) mas **NAO uma copia dele**: `viewersOf` itera `Object.values(state.watching)` porque so precisa CONTAR, e `viewerPeerIdsOf` precisa do peerId, entao itera `Object.entries(state.watching)` e coleta a chave. Copiar o `Object.values` daria uma lista de `txId`, nao de destinatarios.
Rejeitado: `broadcast()` com filtro do lado de quem recebe. Numa sala cheia (`ROOM_MAX_LIMIT = 8`) isso empurraria 25 mensagens por segundo por espectador para 7 pares, ou seja 175 envios por segundo no canal CONFIAVEL e ORDENADO que tambem carrega roster, `TX_START` e heartbeat, e a maioria seria descartada na chegada. Contraria o pilar de performance (RNF-01) sem nenhum ganho.
Rejeitado: `send()` em laco no chamador (`mesh.ts:267-274`). Funciona, mas cria um envelope novo por destinatario a cada 40 ms; `sendMany` custa um objeto por FLUSH em vez de um por destinatario, mantendo a simetria com `broadcast` que qualquer leitor do `Mesh` ja conhece.
Rejeitado: rotear tudo pelo transmissor (topologia estrela). O mesh de DADOS ja e completo (todo mundo com todo mundo, o `Mesh` mantem uma `DataConnection` por par), entao a estrela so acrescentaria um salto de latencia e faria a maquina do transmissor pagar o reenvio - exatamente a maquina que nao pode perder frame.
**Comportamento em cliente antigo (RNF-03, AC-33), verificado no codigo:** `validateEnvelope` checa `isOneOf(raw['type'], MESSAGE_TYPES)` em `src/shared/protocol.ts:463` e devolve `{ ok: false, reason: 'unknown_type' }` ANTES de qualquer guard de payload. O `Mesh` chama `callbacks.onInvalid` e o envelope inteiro e descartado; **a conexao NAO e fechada** e nenhuma outra mensagem e afetada. Resultado pratico: um cliente antigo simplesmente nao ve os cursores e nao aparece com cursor para ninguem, sem erro visivel para nenhum dos lados. Isso vai VERBATIM nas notas da release, junto da limitacao de jogo em tela cheia exclusiva (RF-31) e da pausa em PiP (T9).

**T4. Area real do video: um modulo puro compartilhado, usado SO no lado do espectador (PRD RF-19).**
Escolhido: `src/shared/geometry.ts` (novo, puro, sem DOM e sem Electron) exportando `contentRectOf(boxWidth, boxHeight, videoWidth, videoHeight)` e `normalizedPointIn(rect, offsetX, offsetY)`. O espectador mede `getBoundingClientRect()` do PROPRIO `<video>` (`.z-player__video`), **nunca de `.z-player`**: o container tem `border: 1px solid var(--border)` (`player.css:12`) que SOME em `.z-player--fullscreen` (`player.css:17-20`), o que introduziria um erro sistematico de 1 a 2 px que ainda por cima MUDA entre os dois modos.
O overlay do transmissor **nao usa esse utilitario**: ele cobre o monitor compartilhado inteiro, e o conteudo compartilhado E o monitor inteiro, entao `x` e `y` normalizados mapeiam direto para `x * larguraDoOverlay` e `y * alturaDoOverlay`, sem letterbox nenhum. Isso e verificado como item 3 da Sonda B (conferir que a proporcao de `videoWidth`/`videoHeight` da track capturada bate com a proporcao de `display.bounds`, ou seja, que o `getDisplayMedia` ESCALA e nao PREENCHE com barras).
Por que o modulo mora em `src/shared` mesmo sendo usado de um lado so: (a) e assim que o teste unitario de `tests/unit` consegue importa-lo sem tocar em modulo do main; (b) quando o compartilhamento de JANELA entrar (evolucao futura declarada fora de escopo), o overlay passa a precisar exatamente da mesma matematica.
Rejeitado: calcular por CSS (um wrapper com `aspect-ratio`). Daria o retangulo certo visualmente, mas nao entrega os NUMEROS para normalizar a coordenada, que e o que RF-19 pede.
Rejeitado: calcular dos dois lados com codigo duplicado. A formula e curta, mas um erro de sinal num offset e invisivel ate alguem apontar torto em campo.

**T5. e2e alcancando a segunda janela: `app.windows()` filtrado por titulo.**
Escolhido: helper novo `pointerOverlayPage(instance, timeoutMs)` em `tests/e2e/helpers/zoi-app.ts`, que faz polling de `instance.app.windows()` e devolve a `Page` cujo `await page.title()` seja `zoi-pointer-overlay` (titulo fixo no `<title>` de `overlay.html`). Helper irmao `expectNoPointerOverlay(instance)` afirmando que nenhuma janela com esse titulo existe (AC-11, AC-12). Hoje `zoi-app.ts:142` so usa `app.firstWindow()` e `.windows()` nao aparece em `tests/` em lugar nenhum.
Rejeitado: identificar pela URL. A URL do renderer buildado e um `file://` com caminho absoluto que muda entre dev e `out/`; o titulo e estavel e legivel.
Rejeitado: nao testar a segunda janela e mandar tudo para o checklist manual. AC-11 e AC-12 sao verificaveis por automacao (a janela existe ou nao existe) e sao justamente os criterios de "nao deixar janela orfa", o defeito mais provavel desta feature.

**T6. Deslize do cursor por TRANSICAO CSS de 32 ms linear, nao por interpolacao em `requestAnimationFrame` (PRD RF-25, RNF-07, RNF-08).**
Escolhido: o marcador e um elemento posicionado por `transform: translate3d(...)` com `transition: transform var(--dur-cursor-glide) linear`, onde `--dur-cursor-glide: 32ms` e um token NOVO em `theme.css`. A cada posicao recebida so o `transform` muda.
Justificativa dupla, e as duas importam:
- **RNF-01 e RNF-07 (nao custar frame):** nao existe laco continuo nenhum. Sem `requestAnimationFrame`, sem interpolacao por quadro em JS. A composicao do `transform` fica no compositor da GPU.
- **RNF-08 sai de graca e CORRIGE uma armadilha da PRD.** A PRD (nota de RNF-08) e o UISPEC assumem que a interpolacao seria em JS e por isso exigem checar `matchMedia` explicitamente. Com transicao CSS, o bloco global de `theme.css` (linhas 62-77) ja forca `transition-duration: 0.001ms !important` em `*`, `*::before` e `*::after`: com `prefers-reduced-motion: reduce` o marcador **salta** para a posicao nova, que e exatamente o resultado observavel que RNF-08 exige, sem uma linha de JS. **Consequencia obrigatoria para a implementacao: e PROIBIDO interpolar posicao em JS nesta feature.** Se alguem trocar a transicao por um laco de rAF, RNF-08 quebra silenciosamente e volta a exigir `matchMedia`.
Por que 32 ms e linear, e nao os tokens normais: as posicoes chegam a cada 40 ms (`CURSOR_SEND_INTERVAL_MS`). `--dur-fast` (120 ms) e `--dur-enter` (180 ms) sao MAIORES que o intervalo, entao cada transicao seria interrompida pela proxima e o marcador ficaria permanentemente atrasado; e `--ease` (`cubic-bezier(0.2, 0, 0, 1)`) desacelera no fim de CADA trecho, produzindo solavanco a cada 40 ms em vez de deslize. 32 ms fecha antes de o proximo update chegar, e `linear` emenda os trechos sem degrau. As DEMAIS animacoes (entrada, saida por inatividade, saida definitiva, transicao coletiva de ligar e desligar) usam `--dur-fast` e `--dur-enter` com `--ease` normalmente, como manda o UISPEC.
Rejeitado: transicao com os tokens existentes. Atraso acumulado, descrito acima.
Rejeitado: interpolacao em rAF. Laco continuo (contraria RNF-07), `matchMedia` extra (RNF-08) e nenhum ganho visual sobre a transicao.

**T7. Posicoes FORA do reducer (`CursorHub`), toggle DENTRO do reducer.**
Escolhido: `CURSOR_MOVE` e `CURSOR_END` sao interceptados em `Session.handleMeshMessage` (`session.ts:899`) antes do `dispatch`, exatamente como PING e PONG ja sao (`session.ts:900-910`), e vao para o `CursorHub`. O toggle, ao contrario, e evento raro e vai pelo reducer normalmente.
Justificativa: `dispatch` (`session.ts:916-940`) roda `reduce()`, varre `previousTxIds`, varre `previousMembers` e chama `notify()`, que dispara TODOS os `stateListeners` e portanto um ciclo de render do React. A 25 mensagens por segundo por espectador, com ate 7 espectadores, isso seria ate 175 ciclos de render por segundo na maquina do transmissor, a mesma maquina que esta codificando video. Contraria RNF-01 de forma direta.
Beneficio colateral que fecha RNF-06 por CONSTRUCAO: como nenhuma posicao entra no reducer, o carimbo de `txId` das posicoes **nao tem como** confundir ou corromper `transmissions` ou `selfWatchingTxId`. Nao e uma promessa de cuidado, e uma impossibilidade estrutural.
Rejeitado: slice novo em `RoomState` (`cursors: Record<...>`). Alem do custo de render acima, obrigaria decidir poda em cinco lugares do reducer e entraria na superficie que `tests/unit/room-state.test.ts` ja cobre, aumentando a chance de regressao no que ja funciona.

**T8. Toggle pegando carona em `TX_START`, com o toast derivado da TRANSICAO de estado (PRD RF-27, RF-28).**
Escolhido: campo aditivo `pointers?: boolean` em `TxStartPayload`, transportado pelo caminho de REANUNCIO que o reducer ja implementa (`room-state.ts:569-591`: um `TX_START` de `txId` ja conhecido e do MESMO remetente e ATUALIZACAO silenciosa, com `effects: []`). Esse branch passa a emitir `showToast` **em uma unica condicao**: `known.pointersEnabled === true && next === false && state.selfWatchingTxId === payload.txId`.
Por que isso resolve a deduplicacao que a PRD exige (RF-28) sem inventar mecanismo novo: o gatilho e uma TRANSICAO, nao a chegada de uma mensagem. Um reenvio de estado que reafirma `pointers: false` (reconexao, `onMemberJoined`, atualizacao de roster) encontra `known.pointersEnabled` ja em `false`, nao ha transicao e nenhum toast e emitido. E o mesmo espirito dos guards que o projeto ja usa (`state.announcedPeers`, `entry.announced`, o flag `doorWarned` da porta em `session.ts:219` (usado em `:1074-1075` e `:1083-1084`)), aplicado no lugar onde ele fica mais barato. `pushToast` (`app-store.ts:89-94`) continua sem deduplicacao propria, como sempre foi.
Rejeitado: `MessageType` novo (`POINTERS_TOGGLE`). Gastaria um terceiro valor no enum FECHADO por um evento que acontece uma ou duas vezes por transmissao, e exigiria um caminho proprio de reenvio para quem entra depois. O `TX_START` ja tem esse caminho pronto (`media-manager.ts:677-694`).
Rejeitado: um flag `alreadyWarned` por espectador em `RoomState`. Seria estado novo a podar em tres lugares para resolver um problema que a transicao ja resolve de graca.

**T9. Picture-in-Picture: apontar PAUSA enquanto o PiP esta ativo.**
Escolhido: com `pipActive === true` (`PlayerView.tsx:194`, `:275-289`) o espectador para de capturar coordenada e envia UM `CURSOR_END`; a `CursorLayer` nao e renderizada; ao fechar o PiP, tudo volta na proxima movimentacao do mouse.
Justificativa: o PiP deste app e o NATIVO do elemento (`src/renderer/src/services/pip-controller.ts`, cujo cabecalho registra que o Document PiP DERRUBA o renderer no Electron 43.4.1 e foi abandonado por isso). Em PiP nativo o conteudo visual sai para uma janela do sistema operacional sobre a qual o app NAO desenha HTML, e o lugar do video no `.z-player` passa a mostrar `.z-player__pip-note` (`PlayerView.tsx:309-317`). Ou seja: nao ha conteudo real para apontar dentro do player grande, e RF-17 ja manda nao gerar posicao fora da area valida. Apontar ali produziria uma coordenada correta em relacao a um retangulo que o usuario nao esta vendo, o que e pior do que nao apontar.
Consequencia declarada nas notas da release: com a transmissao na janela flutuante, o ponteiro fica pausado; volte para o player grande para apontar.
Rejeitado: manter a captura usando o retangulo do `<video>` invisivel. O elemento continua montado com o tamanho de antes, entao a coordenada seria calculada sobre um retangulo que nao corresponde a nada visivel: um erro silencioso, do tipo que so aparece em campo.
Rejeitado: desabilitar o botao de PiP quando os ponteiros estao ligados. Tira uma funcao que ja existe e funciona por causa de outra que e opcional.

**T10. Sinal de foco para RF-20: `blur` e `focus` da janela, com o esmaecimento de 5 s como segunda rede.**
Escolhido: `window.addEventListener('blur', ...)` envia um `CURSOR_END` e para a captura; `focus` reabilita (o envio volta na proxima movimentacao, exatamente como RF-20 descreve).
Justificativa: `document.visibilityState` e comprovadamente inutilizavel neste app. `backgroundThrottling: false` (`src/main/index.ts:68`) o mantem permanentemente em `'visible'`, e o proprio codigo ja documenta isso em `PlayerView.tsx:124-131`, onde o ramo de visibilidade e explicitamente tratado como DEFENSIVO e nao funcional. `blur` e foco do sistema operacional e nao e suprimido por aquela flag.
Segunda rede deliberada: mesmo que `blur` nao dispare em alguma situacao de minimizacao, o envio ja para sozinho, porque uma posicao so e enviada quando ela MUDA e uma janela minimizada nao recebe `mousemove`; e passados 5 s o ponteiro esmaece por RF-26. Ou seja, o pior caso e o ponteiro sumir em 5 s em vez de imediatamente: degradacao suave, nunca ponteiro preso para sempre.
Rejeitado: `document.visibilitychange`. O sinal nunca dispara aqui (armadilha ja documentada duas vezes no repositorio).
Rejeitado: um IPC novo do main repassando `browserWindow.on('blur')`. Canal novo, preload novo e ciclo de vida novo para um sinal que o renderer ja tem nativamente.

**T11. IPC renderer para main de FRAME AGREGADO, nao de posicao.**
Escolhido: canal novo `pointer-overlay:frame` por `ipcRenderer.send` (fire and forget, sem `invoke`), com UMA mensagem a cada `POINTER_OVERLAY_FRAME_MS` (33 ms, aproximadamente 30 Hz) contendo TODOS os ponteiros ativos daquele `txId`. O main so relaya para `overlayWindow.webContents.send`.
Justificativa: o CONTEXT registra (secao 7) que NENHUM canal de alta frequencia renderer para main existe hoje. Agregar por frame torna o custo independente do numero de espectadores: 30 mensagens por segundo de um objeto pequeno, contra ate 175 por segundo se fosse uma mensagem por posicao recebida. Para comparacao de ordem de grandeza, o unico precedente de canal continuo do projeto (`src/main/audio-exclusion.ts`) entrega 100 frames PCM de 3 840 bytes por segundo pelo `MessagePort`, e isso ja e considerado aceitavel no app.
Rejeitado: `ipcRenderer.invoke`. Request/response cria uma promessa por frame sem que ninguem precise da resposta.
Rejeitado: `MessageChannelMain`/`MessagePort` como no audio. Maquinaria consideravelmente maior (o port precisa ser entregue pelo preload via `window.postMessage`, ver `src/preload/index.ts:86-88`) para um volume duas ordens de grandeza menor.
Rejeitado: fazer a janela de overlay falar direto com o mesh. Ela e outro processo de renderer, sem PeerJS e sem sessao.

**T12. `data-testid` e ganchos de teste da camada de cursores.**
Escolhido: `pointer-toggle` no `SourcePickerModal` e `pointer-toggle-bar` na `TransmittingBar` (kebab-case, no molde de `audio-toggle` e `sharpness-toggle`); `cursor-layer` no container da camada e `cursor-marker` em cada marcador, com `data-peer-id` (mesmo padrao de `ParticipantCard.tsx:64`, que ja usa `data-peer-id`).
Justificativa: sem `data-peer-id` no marcador, o e2e nao consegue provar "o cursor da Bruna aparece para o Joao mas nao para a Bruna" (AC-06, AC-07), que e o criterio central da feature.

---

## 4. Riscos

| # | O que pode dar errado | Mitigacao |
|---|---|---|
| R1 | **Sonda A falha**: `setContentProtection` nao remove a janela da propria captura no Electron 43.4.1, ou remove mas com efeito colateral (a janela some tambem para o olho humano, ou a captura do monitor inteiro para de funcionar). O cursor entraria no video e cada espectador veria o proprio fantasma atrasado, o defeito exato que esta feature existe para evitar. | **O pipeline PARA e volta para conversa com o usuario** (PRD RNF-11, AC-40; IDEA secao 2). Nenhum plano B nesta SPEC. E proibido a qualquer agente improvisar (desenhar dentro do video, aceitar o fantasma, filtrar por espectador). O Sprint 1 existe justamente para descobrir isso antes de qualquer linha de feature. |
| R2 | **Janela orfa de overlay**: `app.on('window-all-closed')` (`src/main/index.ts:150-155`) so dispara quando TODAS as janelas fecham. Com a janela principal fechada e o overlay ainda de pe, o evento nao dispara, o app nao encerra e sobra uma janela transparente sempre no topo. `app.on('activate')` (`src/main/index.ts:143-147`) tambem checa `getAllWindows().length === 0` e nao recriaria a janela principal. | `registerPointerOverlay(() => mainWindow)` instala `mainWindow.on('closed', hidePointerOverlay)` e `app.on('before-quit', hidePointerOverlay)`, alem das quedas normais por `stopTransmission` e por toggle. `hidePointerOverlay()` e IDEMPOTENTE. O e2e cobre isso com `expectNoPointerOverlay` depois de parar a transmissao (T5, AC-12). |
| R3 | **Sonda B falha**: `display_id` do `desktopCapturer` nao casa com nenhum `display.id` de `screen.getAllDisplays()` (formatos diferentes, string vazia em algum caso), e o overlay nao sabe qual monitor cobrir. | Mesma regra de R1: **para e volta para conversa**. Caso especifico ja previsto na sonda: quando existe UM SO monitor, `display_id` pode vir vazio; a sonda precisa registrar esse caso separadamente, porque com um monitor so o alvo e trivialmente `screen.getPrimaryDisplay()`. Se a sonda so falhar no caso multi-monitor, isso e falha de sonda do mesmo jeito (RF-08 e `[MUST]`). |
| R4 | **Regressao de fps por causa do trafego novo** (RNF-01): 25 mensagens por segundo por espectador no MESMO DataChannel confiavel e ordenado que carrega roster, `TX_START` e heartbeat. | Fan-out seletivo (T3) em vez de broadcast; payload minimo (3 campos, sem nickname e sem cor, porque o receptor deriva os dois do roster); envio so quando a posicao MUDA; frame agregado no IPC (T11); zero laco de rAF (T6); nenhum coletor de estatisticas novo. Verificacao: comparacao antes e depois de `framesPerSecond` e `qualityLimitationReason` nos logs do `stats-monitor`, que ja existem, exatamente como RNF-01 define. |
| R5 | **Cursor preso** na tela do transmissor porque o `CURSOR_END` se perdeu ou o espectador sumiu sem avisar. | Tres camadas independentes: (a) `CURSOR_END` explicito nos seis gatilhos de 2b.2; (b) poda contra o roster em `session.subscribe` (RF-29); (c) esmaecimento por inatividade em 5 s (RF-26), que e o piso: nenhum ponteiro sobrevive mais de 5 s sem posicao nova. |
| R6 | **Colisao de log com `expectNoDirectionFallbacks`**: o helper varre `consoleLines` procurando `media-pull`, `dialback`, `discando de volta` e `na outra direcao` (`tests/e2e/helpers/zoi-app.ts:50` e `:327-341`), em minusculas. Qualquer linha nova que contenha uma dessas marcas quebra os 5 specs e2e. | Regra dura desta SPEC: TODA linha de log nova usa o prefixo `[pointer]` e e PROIBIDO usar as quatro marcas. Verificacao mecanica no Done when de cada feature: `grep -niE "media-pull\|dialback\|discando de volta\|na outra direcao"` nos arquivos tocados, esperando zero ocorrencias novas. |
| R7 | **Enxurrada de log** a 25 mensagens por segundo: um `console.warn` por mensagem descartada encheria o log do dia (gravado em arquivo por `attachRendererLogging`, `src/main/index.ts:74`) e derrubaria a legibilidade do diagnostico de campo. | Regra dura: os descartes de `CURSOR_MOVE` e `CURSOR_END` da matriz 5c sao SILENCIOSOS. Nenhum `console` por mensagem. O unico log permitido no caminho de posicao e um resumo com no maximo uma linha a cada `POINTER_LOG_INTERVAL_MS` (10 000 ms) por peer, e so quando houve descarte. |
| R8 | **Fechar a conexao por engano** ao receber posicao de quem nao esta no roster: `rejectFrom` (`room-state.ts:733-744`) empurra `closeConnection` quando o remetente nao e membro. Aplicado a uma mensagem de 25 Hz, uma janela de roster desatualizado derrubaria o link de mesh. | `CURSOR_MOVE` e `CURSOR_END` **nunca passam por `rejectFrom`** e nunca geram `closeConnection`: eles nem chegam ao reducer (T7). O descarte e local, silencioso e sem efeito colateral. Isto esta na matriz 5c como regra explicita. |
| R9 | **Jogo em tela cheia exclusiva** engole o overlay (o Windows normalmente nao deixa desenhar por cima). | Nao ha deteccao (RF-31 `[WONT]`, P5 resolvido). A limitacao vai documentada nas notas da release. Nenhum agente de implementacao deve tentar detectar. |
| R10 | **Contraste da inicial do avatar** quebrado por alguma cor da paleta nova (RNF-05, RF-23). | Os 10 slots tem contraste calculado e tabelado em 3/T1 (pior caso 5.11:1, contra 4.31:1 do app hoje), e um teste unitario recalcula os 10 e falha abaixo de 4.5:1. A geometria do avatar (34x34, `flex: none`, raio 50%, peso 600, uppercase, tamanho de fonte herdado) fica INTOCADA: so `background` e `color` mudam. |
| R11 | **Overlay cobre o monitor errado** quando o usuario troca de monitor principal, muda a resolucao ou desconecta um monitor no meio da transmissao. | `screen.on('display-metrics-changed')` reposiciona pelo `bounds` novo; `screen.on('display-removed')` derruba a janela se o monitor compartilhado sumiu. A troca de FONTE ja e coberta por construcao (`switchSource` e stop mais start, `media-manager.ts:594-597`), e a transmissao nova nasce com o toggle desligado. |
| R12 | **`transparent: true` com `alwaysOnTop` produzindo artefato ou capturando clique** em alguma configuracao de Windows (composicao desligada, escala de DPI diferente de 100%). | `setIgnoreMouseEvents(true)` sem `forward` e a garantia de RF-09 e e verificada na Sonda A (item 4: clicar atraves da janela chega ao aplicativo por baixo). DPI: a janela e posicionada por `display.bounds`, que ja vem em pontos independentes de dispositivo (o mesmo espaco de coordenadas de `BrowserWindow.setBounds`), entao nao ha conversao manual, e isso tambem e item da Sonda B. |
| R13 | **Divergencia transitoria de cor** entre clientes enquanto o `ROSTER_UPDATE` esta em transito (o desempate de T1 depende do roster). | Aceito e documentado. A cor nunca viaja pela rede; cada cliente recalcula a cada mudanca de roster e converge sozinho. Efeito maximo: um piscar de cor por alguns milissegundos, no mesmo instante em que a lista de participantes ja esta mudando na tela. |

---

## 5. Contratos

Este app **nao tem backend HTTP**: nao existe rota REST, nao existe controller, nao existe `fetch` para servidor proprio. A superficie de contrato equivalente sao tres: **(A) as mensagens do protocolo do mesh** (`src/shared/protocol.ts`), **(B) o IPC** (`src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/ipc-handlers.ts`) e **(C) as assinaturas internas** que um sprint produz e outro consome. Tudo abaixo e literal: os agentes das Stages 4 e 5 devem implementar exatamente estas formas.

### 5.A Mensagens do protocolo (`src/shared/protocol.ts`)

`PROTOCOL_VERSION` continua `1`. Sao **dois valores novos** no enum fechado `MessageType` e **um campo aditivo opcional** num payload existente.

#### A1. `TX_START` - campo aditivo `pointers` (toggle da transmissao)

```ts
export interface TxStartPayload {
  txId: string
  presetId: PresetId
  hasAudio: boolean
  sourceKind: SourceKind
  sourceLabel: string
  startedAt: number
  videoCodec?: string
  /**
   * Ponteiros dos espectadores LIGADOS nesta transmissao (RF-01/RF-02/RF-27).
   * Campo OPCIONAL: ausente = cliente antigo, ou transmissao com a opcao
   * desligada. O consumidor le a ausencia como `false`. Nunca e `true` quando
   * `sourceKind === 'window'` (RF-04), mas o guard NAO cruza os dois campos:
   * a regra vive em quem produz, e um payload inconsistente e inofensivo
   * (o overlay de janela simplesmente nunca sobe).
   */
  pointers?: boolean
}
```

- Guard `isTxStartPayload` (`protocol.ts:347-362`): acrescentar a clausula `(value['pointers'] === undefined || isBoolean(value['pointers']))`. **Proibido** usar `isOneOf` ou qualquer enum aqui.
- **Quem envia**: SO o transmissor da transmissao, em TRES momentos, todos ja existentes: (1) o broadcast de `applyLocalTxStart` (`room-state.ts:1397-1437`); (2) o reenvio direto de `MediaManager.onMemberJoined` (`media-manager.ts:677-694`); (3) o reanuncio do novo evento `LOCAL_TX_POINTERS` (contrato C3).
- **Quem consome**: o reducer, no case `TX_START` (`room-state.ts:564-623`), gravando em `TransmissionState.pointersEnabled`.
- **O que o receptor faz com o inesperado**: `pointers` de tipo errado (numero, string, objeto) faz o guard rejeitar o payload INTEIRO; `validateEnvelope` devolve `invalid_payload` e o `Mesh` ja loga o descarte. Consequencia: aquele `TX_START` e ignorado. Aceitavel, porque so um cliente adulterado produziria isso, e e exatamente o mesmo tratamento que `videoCodec: 42` ja recebe hoje.
- **Compat com cliente antigo**: ele ignora o campo extra (o guard dele so checa os obrigatorios) e continua processando a transmissao normalmente; simplesmente nunca sabe que os ponteiros estao ligados, e por isso nunca desenha nem envia nada.

#### A2. `CURSOR_MOVE` - tipo NOVO (posicao normalizada, alta frequencia)

```ts
export interface CursorMovePayload {
  /** A transmissao a que esta posicao pertence (RF-16). */
  txId: string
  /** Fracao [0..1] da LARGURA do conteudo real compartilhado (sem letterbox). */
  x: number
  /** Fracao [0..1] da ALTURA do conteudo real compartilhado (sem letterbox). */
  y: number
}

export function isCursorMovePayload(value: unknown): value is CursorMovePayload {
  return (
    isRecord(value) &&
    isString(value['txId']) &&
    value['txId'].length > 0 &&
    isFiniteNumber(value['x']) &&
    isFiniteNumber(value['y'])
  )
}
```

- O guard e ESTRUTURAL, como todos os outros deste arquivo: ele NAO checa a faixa `[0..1]`. A checagem de faixa e semantica e vive no `CursorHub` (matriz 5c), porque um valor fora da faixa deve ser DESCARTADO em silencio, sem invalidar a conexao nem gerar log.
- **Quem envia**: qualquer membro que esteja assistindo a `txId` com os ponteiros ligados, a no maximo `1000 / CURSOR_SEND_INTERVAL_MS` = **25 mensagens por segundo** (RF-32).
- **Quem aceita**: o transmissor de `txId` e os demais espectadores de `txId`. Ninguem mais recebe (fan-out seletivo, T3), e quem receber por engano descarta pela matriz 5c.
- **Rota**: `mesh.sendMany(viewerPeerIdsOf(state, txId) mais o transmissor, menos o proprio)`, contrato C1.
- **Onde e tratado no receptor**: `Session.handleMeshMessage` (`session.ts:899`), ANTES do `dispatch`, no mesmo lugar onde PING e PONG ja sao interceptados (`session.ts:900-910`). **Nunca entra no reducer.**

#### A3. `CURSOR_END` - tipo NOVO (o meu ponteiro deixou de valer nesta transmissao)

```ts
export interface CursorEndPayload {
  txId: string
}

export function isCursorEndPayload(value: unknown): value is CursorEndPayload {
  return isRecord(value) && isString(value['txId']) && value['txId'].length > 0
}
```

- **Quem envia**: o mesmo espectador, uma unica vez, em cada um dos SEIS gatilhos de 2b.2 (fora da area valida, `mouseleave`, `blur` da janela, entrada em PiP, troca de `txId`, desmontagem do `PlayerView`).
- **Quem aceita**: os mesmos destinatarios de `CURSOR_MOVE`, com as mesmas checagens, **exceto** a checagem de `state.watching[from] === txId`: um `CURSOR_END` precisa ser aceito justamente quando o remetente JA parou de assistir (RF-18). A regra completa esta em 5c.
- **Perda**: se este envelope se perder ou nao chegar, o ponteiro some sozinho em 5 s por inatividade (RF-26). Nao ha retransmissao nem confirmacao.

#### A4. Alteracoes no enum e nas tabelas do arquivo

Cinco pontos, todos verificados por leitura:

| Onde | Linha atual | O que fazer |
|---|---|---|
| `export type MessageType` | `protocol.ts:6-21` | acrescentar `| 'CURSOR_MOVE'` e `| 'CURSOR_END'` |
| `export interface PayloadByType` | `protocol.ts:177-193` | acrescentar `CURSOR_MOVE: CursorMovePayload` e `CURSOR_END: CursorEndPayload` |
| `export const MESSAGE_TYPES` | `protocol.ts:255-271` | acrescentar as duas strings (a lista precisa continuar cobrindo o union inteiro, senao o typecheck quebra) |
| `const PAYLOAD_GUARDS` | `protocol.ts:410-426` | acrescentar `CURSOR_MOVE: isCursorMovePayload` e `CURSOR_END: isCursorEndPayload` |
| `isTxStartPayload` | `protocol.ts:347-362` | acrescentar a clausula opcional de `pointers` |

**Comportamento verificado em cliente de versao ANTIGA (RNF-03, AC-33)**: um cliente sem estes tipos executa `validateEnvelope` (`protocol.ts:460-481`), falha em `isOneOf(raw['type'], MESSAGE_TYPES)` na **linha 463** e devolve `{ ok: false, reason: 'unknown_type' }` **antes de qualquer guard de payload**. O `Mesh` roteia isso para `callbacks.onInvalid` e descarta o envelope inteiro; **a `DataConnection` NAO e fechada** e nenhuma outra mensagem e afetada. Texto exato que vai para as notas da release: "Quem estiver numa versao anterior a esta simplesmente nao ve os ponteiros nem aparece com ponteiro para os outros. As mensagens de posicao sao descartadas pelo cliente antigo sem erro visivel e sem derrubar a conexao; tudo o mais na sala continua funcionando entre as duas versoes."

#### A5. Estado derivado (`src/renderer/src/core/room-state.ts`)

```ts
export interface TransmissionState {
  // ... campos atuais (room-state.ts:47-59) ...
  /**
   * Ponteiros dos espectadores ligados nesta transmissao. `false` tambem para
   * transmissao de cliente antigo (campo ausente no TX_START). NUNCA persistido.
   */
  pointersEnabled: boolean
}
```

Pontos de escrita, todos ja existentes e verificados:
- `applyLocalTxStart` (`room-state.ts:1397`): `pointersEnabled: event.pointers` (o evento ja carrega o valor escolhido no modal).
- `TX_START` novo (`room-state.ts:594-610`): `pointersEnabled: payload.pointers === true`.
- `TX_START` de reanuncio (`room-state.ts:574-591`): atualiza `pointersEnabled` junto de `presetId`/`hasAudio`/`sourceKind`/`sourceLabel`/`videoCodec`, **preservando `startedAt` e `status`**, e passa a devolver o efeito de toast SO na transicao descrita em C3.
- `applySnapshot`/`applyRosterUpdate`: nenhum toque. `pointersEnabled` nao entra em `ROSTER_UPDATE` nem em nenhum snapshot; ele so existe dentro de `TransmissionState`, que ja e reconstruido pelos caminhos acima.

**Nenhum campo novo em `RoomState`.** Posicoes de cursor nao existem no reducer (T7), e e isso que fecha RNF-06 por construcao.

### 5.B IPC (`src/shared/ipc.ts` + `src/preload/index.ts` + `src/main/ipc-handlers.ts`)

**Nenhum canal existente e modificado.** `settings:get`/`settings:set` ficam intocados (esta feature nao persiste nada, RF-03). Sao QUATRO canais novos.

```ts
export const IPC = {
  // ... 14 canais atuais (ipc.ts:4-19) ...
  pointerOverlayShow: 'pointer-overlay:show',
  pointerOverlayHide: 'pointer-overlay:hide',
  pointerOverlayFrame: 'pointer-overlay:frame',
  pointerOverlayRender: 'pointer-overlay:render'
} as const
```

```ts
/** Um ponteiro ja resolvido para desenho: nickname e cor vem do renderer principal. */
export interface PointerOverlayPointer {
  peerId: string
  nickname: string
  /**
   * Cor de PREENCHIMENTO ja resolvida, no formato `hsl(H 100% L%)`. E o campo
   * `fill` de `PersonColor`, e nao o objeto inteiro: a janela de overlay nao tem
   * roster nem desenha avatar, entao o `soft` nao serve para nada la. O nome do
   * campo casa com a prop `fill` do `CursorMarker` (feature F2.1) de proposito.
   */
  fill: string
  /** Fracao [0..1] da largura/altura do monitor compartilhado. */
  x: number
  y: number
  /** Parado ha mais de CURSOR_IDLE_MS: o overlay desenha esmaecido (RF-26). */
  idle: boolean
}

export interface PointerOverlayFrame {
  txId: string
  pointers: PointerOverlayPointer[]
}

export interface PointerOverlayShowRequest {
  /** `displayId` da fonte escolhida (`CaptureSource.displayId`). */
  displayId: string | null
}

export type PointerOverlayShowResult =
  | { ok: true }
  | { ok: false; reason: 'display-not-found' | 'content-protection-failed' | 'window-failed' }

/** Titulo fixo da janela de overlay; e por ele que o e2e a encontra (T5). */
export const POINTER_OVERLAY_TITLE = 'zoi-pointer-overlay'
```

| Canal | Direcao | Mecanismo | Quem manda | Quem aceita | Payload |
|---|---|---|---|---|---|
| `pointer-overlay:show` | renderer principal para main | `ipcMain.handle` / `invoke` | so o renderer principal, so quando o toggle liga numa transmissao de MONITOR | `registerIpcHandlers()` | `PointerOverlayShowRequest` -> `PointerOverlayShowResult` |
| `pointer-overlay:hide` | renderer principal para main | `ipcMain.handle` / `invoke` | renderer principal | `registerIpcHandlers()` | sem payload -> `void`. **Idempotente**: chamar sem overlay no ar e no-op |
| `pointer-overlay:frame` | renderer principal para main | `ipcMain.on` / `ipcRenderer.send` (fire and forget) | renderer principal, no maximo 1 a cada 33 ms | main, que so relaya | `PointerOverlayFrame` |
| `pointer-overlay:render` | main para renderer do OVERLAY | `webContents.send` / `ipcRenderer.on` | so o main | so a janela de overlay | `PointerOverlayFrame` |

Superficie no `window.zoi` (`ZoiApi`, `ipc.ts:142-185`):

```ts
pointerOverlay: {
  /** Sobe o overlay sobre o monitor da fonte. Nunca lanca: falha vira `{ ok: false }`. */
  show(request: PointerOverlayShowRequest): Promise<PointerOverlayShowResult>
  /** Derruba o overlay. Idempotente. */
  hide(): Promise<void>
  /** Entrega um frame agregado ao overlay. Fire and forget, sem resposta. */
  sendFrame(frame: PointerOverlayFrame): void
  /** SO a janela de overlay usa. Registra o listener; devolve o descarte. */
  onRender(listener: (frame: PointerOverlayFrame) => void): () => void
}
```

O preload e UM SO para as duas janelas (a principal e a de overlay): expor `onRender` tambem na principal e inofensivo (o main nunca envia `pointer-overlay:render` para ela) e evita um segundo arquivo de preload e uma segunda entry de build.

**Validacao no main (`ipc-handlers.ts`)**: `pointer-overlay:show` normaliza `request?.displayId` para `string | null` (qualquer outro tipo vira `null`); `pointer-overlay:frame` valida a forma antes de relayar (ver 5c) e descarta em silencio o que nao casar.

### 5.C Assinaturas internas consumidas entre sprints

**C1. `Mesh.sendMany` (`src/renderer/src/services/mesh.ts`, metodo NOVO, ao lado de `broadcast` na linha 277)**

```ts
/**
 * Envia para um SUBCONJUNTO de pares, serializando o envelope UMA vez. Espelho
 * de `broadcast`, so que a lista de destinatarios e explicita: e o que permite
 * um fan-out por transmissao sem pagar o custo da sala inteira (RNF-01).
 * peerId desconhecido na lista e simplesmente ignorado.
 */
sendMany(peerIds: readonly string[], message: ProtocolMessage): void
```

Corpo obrigatorio (e o algoritmo, nao ilustracao): criar o envelope com `createEnvelope(message.type, message.payload as never, this.selfPeerId, Date.now())`; para cada `peerId` da lista, buscar `this.entries.get(peerId)` e, se existir, chamar `this.deliver(entry, envelope)`. Nada mais. Note que `deliver` (`mesh.ts:257-264`) ENFILEIRA quando o canal ainda nao abriu; isso e aceitavel e desejado para o toggle, e inofensivo para posicoes (a fila e curta e o proximo flush chega em 40 ms).

**C2. `viewerPeerIdsOf` (`src/renderer/src/core/room-state.ts`, funcao pura NOVA, ao lado de `viewersOf` na linha 290)**

```ts
/**
 * peerIds das pessoas que estao assistindo `txId` agora. Mesma FONTE de dados de
 * `viewersOf` (`state.watching`), sem nada novo no mesh, mas iteracao DIFERENTE:
 * `viewersOf` usa `Object.values` porque so conta; aqui e preciso a CHAVE, entao
 * o laco e sobre `Object.entries(state.watching)` coletando `peerId` quando o
 * valor bate com `txId`. Copiar o `Object.values` devolveria txIds, nao peerIds.
 */
export function viewerPeerIdsOf(state: RoomState, txId: string): string[]
```

Regra de montagem dos destinatarios de uma posicao (usada pelo `CursorHub`):
`destinatarios = [...viewerPeerIdsOf(state, txId), state.transmissions[txId]?.peerId].filter(id => id !== undefined && id !== state.selfPeerId)`, com duplicatas removidas. Exemplo trabalhado: sala com Leo (transmissor de A), Bruna, Joao e Carla; Bruna e Joao assistem A, Carla assiste B. Bruna aponta em A. `viewerPeerIdsOf(state, A)` devolve `['Bruna','Joao']`; somando `Leo` e tirando a propria Bruna, a lista final e `['Joao','Leo']`. **Dois envios**, nao quatro (que e o que um `broadcast` faria) e nao tres.

**C3. Evento e caminho do toggle**

```ts
// src/renderer/src/core/room-state.ts, novo membro do union RoomEvent
export interface LocalTxPointersEvent {
  kind: 'LOCAL_TX_POINTERS'
  on: boolean
  now: number
}
```

`applyLocalTxPointers(state, event)`:
1. acha a transmissao local (`transmissionsOf(state, state.selfPeerId)`, `room-state.ts:325-329`); se nao houver, devolve `{ state, effects: [] }`;
2. se `transmission.sourceKind === 'window'`, forca `on = false` (RF-04 defensivo);
3. se `transmission.pointersEnabled === event.on`, devolve `{ state, effects: [] }` (idempotente, nao reanuncia a toa);
4. grava `pointersEnabled: on` e devolve UM efeito `broadcast` de `TX_START` com TODOS os campos da transmissao atual mais `pointers: on`. **Conversao obrigatoria de tipo neste ponto**: `TransmissionState.videoCodec` e `VideoCodecId | null` (`room-state.ts:57-58`) e `TxStartPayload.videoCodec` e `string | undefined` (`protocol.ts:121-135`, campo na linha 134), entao o payload precisa levar `videoCodec: transmission.videoCodec ?? undefined`. Mandar `null` faria `isTxStartPayload` (`protocol.ts:347-362`) rejeitar o payload inteiro e o reanuncio sumiria em silencio, levando o toggle junto. **Nenhum `playSound`, nenhum `showToast`** no lado de quem liga.

`Session.setTransmissionPointers(on: boolean): void` faz `this.dispatch({ kind: 'LOCAL_TX_POINTERS', on, now: Date.now() })` (molde de `watch`, `session.ts:481-483`).

**Toast do espectador (RF-27/RF-28), no branch de reanuncio do `TX_START`** (`room-state.ts:574-591`): o branch passa a calcular `const nextPointers = payload.pointers === true` e, ao montar o resultado, emite

```
effects: (known.pointersEnabled && !nextPointers && state.selfWatchingTxId === payload.txId)
  ? [{ kind: 'showToast', tone: 'warning', text: 'Ponteiros desativados por quem transmite.' }]
  : []
```

Em qualquer outro caso o branch continua devolvendo `effects: []` exatamente como hoje. **Este e o guard de deduplicacao inteiro**: o gatilho e a TRANSICAO `true -> false`, entao um reenvio que reafirma `false` nao produz toast nenhum (RF-28, AC-26).

**C4. `src/shared/geometry.ts` (modulo NOVO, puro)**

```ts
export interface ContentRect {
  /** Deslocamento do conteudo dentro da caixa, em px. */
  left: number
  top: number
  /** Tamanho do conteudo real (sem as barras pretas), em px. */
  width: number
  height: number
}

/**
 * Retangulo do conteudo real dentro de um elemento com `object-fit: contain`
 * (RF-19). Devolve `null` quando qualquer dimensao e invalida (video ainda sem
 * metadata, elemento com tamanho zero): quem chama trata `null` como
 * "nao ha area valida agora" e nao gera posicao.
 */
export function contentRectOf(
  boxWidth: number,
  boxHeight: number,
  videoWidth: number,
  videoHeight: number
): ContentRect | null

/**
 * Converte um ponto em coordenadas do ELEMENTO para fracao [0..1] do conteudo.
 * Devolve `null` quando o ponto cai FORA do conteudo (barra preta do letterbox,
 * RF-17): nunca clampa, porque clampar prenderia o ponteiro na borda.
 */
export function normalizedPointIn(
  rect: ContentRect,
  offsetX: number,
  offsetY: number
): { x: number; y: number } | null
```

Algoritmo literal de `contentRectOf`: se qualquer um dos quatro argumentos nao for finito ou for `<= 0`, devolver `null`; `scale = Math.min(boxWidth / videoWidth, boxHeight / videoHeight)`; `width = videoWidth * scale`; `height = videoHeight * scale`; `left = (boxWidth - width) / 2`; `top = (boxHeight - height) / 2`.

**Exemplo trabalhado (o mesmo medido no UISPEC, secao 3, e visivel em `ui-refs/03-playerview-remote-stream.png`)**: caixa do `<video>` de 1104 x 820 px, stream 720p (1280 x 720). `scale = min(1104/1280, 820/720) = min(0.8625, 1.1389) = 0.8625`. `width = 1280 * 0.8625 = 1104`, `height = 720 * 0.8625 = 621`, `left = 0`, `top = (820 - 621) / 2 = 99.5`. Bate exatamente com os 99,5 px de faixa preta que o UISPEC mediu. Um ponto a `offsetY = 50` cai na faixa preta e `normalizedPointIn` devolve `null` (RF-17). Um ponto a `(386.4, 472.1)` devolve `x = 386.4 / 1104 = 0.35` e `y = (472.1 - 99.5) / 621 = 0.60`, que e o par do exemplo do AC-18.

**C5. `src/shared/person-colors.ts` (modulo NOVO, puro)**

```ts
export interface PersonColorSlot {
  hue: number
  light: number
}

/** Paleta fixa de 10 slots (3/T1). Ordem e valores sao contrato. */
export const PERSON_COLOR_SLOTS: readonly PersonColorSlot[] = [
  { hue: 20, light: 62 },
  { hue: 52, light: 62 },
  { hue: 85, light: 62 },
  { hue: 117, light: 62 },
  { hue: 150, light: 62 },
  { hue: 182, light: 62 },
  { hue: 215, light: 62 },
  { hue: 247, light: 72 },
  { hue: 280, light: 68 },
  { hue: 312, light: 62 }
]

export interface PersonColor {
  /** Preenchimento: cursor e texto da inicial. `hsl(H 100% L%)`. */
  fill: string
  /** Fundo do avatar. `hsl(H 100% 50% / 0.15)`. */
  soft: string
}

/** FNV-1a de 32 bits sobre os code units da string. Deterministico e sem deps. */
export function hash32(value: string): number

/** Slot canonico de um peerId, ignorando o roster. */
export function baseSlotOf(peerId: string): number

/**
 * Slot de cada pessoa PRESENTE, com o desempate de colisao de 3/T1: ordena os
 * colidentes por (`joinedAt`, `peerId`), o primeiro fica com o slot e os demais
 * andam pela paleta ate o primeiro slot livre. Devolve `peerId -> slot`.
 */
export function resolvePersonSlots(
  members: readonly { peerId: string; joinedAt: number }[]
): Record<string, number>

/** Converte um slot em cores concretas. */
export function colorOfSlot(slot: number): PersonColor
```

Algoritmo literal de `resolvePersonSlots`:
1. `const ordered = [...members].sort((a, b) => a.joinedAt - b.joinedAt || (a.peerId < b.peerId ? -1 : a.peerId > b.peerId ? 1 : 0))`;
2. `const taken = new Set<number>()`, `const result: Record<string, number> = {}`;
3. para cada `member` de `ordered`: partindo de `start = baseSlotOf(member.peerId)`, procurar o menor `k` em `0..PERSON_COLOR_SLOTS.length - 1` tal que `(start + k) % PERSON_COLOR_SLOTS.length` nao esteja em `taken`; gravar esse slot em `result` e em `taken`;
4. se a lista for maior que a paleta (impossivel com `ROOM_MAX_LIMIT = 8`, mas o codigo nao pode entrar em laco infinito), o membro excedente recebe `start` mesmo ocupado.

`colorOfSlot(slot)` usa `PERSON_COLOR_SLOTS[slot % PERSON_COLOR_SLOTS.length]` e devolve
`{ fill: 'hsl(' + hue + ' 100% ' + light + '%)', soft: 'hsl(' + hue + ' 100% 50% / 0.15)' }`.

**Exemplo trabalhado do desempate**: Bruna (`joinedAt: 1000`) e Joao (`joinedAt: 2000`) caem os dois no slot 3. Ordenados por `joinedAt`, Bruna vem antes: Bruna fica com 3, Joao anda para 4. Carla entra depois (`joinedAt: 3000`) com base 7: pega 7, e nem Bruna nem Joao mudam de cor. Se Bruna SAIR, o recalculo da Joao o slot 3 (a cor canonica dele) - a unica troca de cor prevista, registrada em 3/T1 e coberta por AC-22.

**Onde vive o resultado no renderer**: um `useMemo` em `RoomScreen` sobre `room.members` (que ja e memoizado ali para outras coisas, `RoomScreen.tsx:54-67`), passado como prop `color: PersonColor` para `ParticipantCard` e disponivel para o `CursorHub` via a mesma assinatura de roster.

**C6. `src/renderer/src/services/cursor-hub.ts` (servico NOVO)**

```ts
export interface CursorEntry {
  peerId: string
  x: number
  y: number
  /** epoch ms da ultima posicao recebida. */
  lastAt: number
  /** epoch ms da primeira posicao desta aparicao (dispara a animacao de entrada). */
  enteredAt: number
  /** Parado ha mais de CURSOR_IDLE_MS. */
  idle: boolean
}

/**
 * PORTA para a sessao, declarada AQUI de proposito. `Session` a satisfaz
 * estruturalmente, entao este modulo NAO importa `session.ts` (nem com
 * `import type`) e nao existe ciclo nem risco de TDZ no boot. Ver a regra de
 * dependencia do Sprint B2.
 */
export interface CursorSessionPort {
  getState(): RoomState
  subscribe(listener: (state: RoomState) => void): () => void
  sendCursor(peerIds: readonly string[], message: ProtocolMessage): void
}

export class CursorHub {
  /** Liga a porta e assina o estado. Chamado UMA vez, do rodape de `media-manager.ts`. */
  attach(port: CursorSessionPort): void

  /** Contexto de quem APONTA. `enabled` reune todas as condicoes de 2b.2. */
  setSendContext(context: { txId: string | null; enabled: boolean }): void

  /** Uma posicao ja normalizada e validada pela CursorLayer. */
  reportLocalPoint(x: number, y: number): void

  /** Encerra o ponteiro local naquele txId (os SEIS gatilhos de 2b.2). */
  endLocal(txId?: string): void

  /** Entrada vinda do mesh; ja passou pelas checagens de 5c. */
  applyRemote(from: string, message: ProtocolMessage): void

  /** Conjunto de peers com ponteiro visivel neste txId. BAIXA frequencia. */
  subscribeRoster(txId: string, listener: (peerIds: string[]) => void): () => void

  /** Posicoes a cada POINTER_OVERLAY_FRAME_MS. ALTA frequencia, imperativo. */
  subscribeFrame(txId: string, listener: (entries: readonly CursorEntry[]) => void): () => void

  /** Contexto de quem TRANSMITE: liga o envio do frame agregado por IPC. */
  setOverlayContext(context: { txId: string | null; enabled: boolean }): void

  /** Limpa entradas, timers e listeners. PRESERVA a porta (ver B2.2). */
  reset(): void

  /** So para teste: alem do `reset`, zera a porta. Nunca chamado em runtime. */
  dispose(): void

  /** Leitura pura para o gancho `__zoiDebugMedia.cursors()`. */
  debugSnapshot(): Record<string, CursorEntry[]>
}

export const cursorHub = new CursorHub()
```

Regras de implementacao que **nao sao negociaveis**:
- **UM unico timer** de `POINTER_OVERLAY_FRAME_MS` (33 ms), ligado so quando ha ponteiro ativo ou envio ativo, que faz tres coisas por tick: recalcula `idle`, chama os `subscribeFrame`, e emite o frame IPC quando `setOverlayContext` esta ligado. **Mais um** timer de `CURSOR_SEND_INTERVAL_MS` (40 ms) so para o flush de envio. Nenhum `requestAnimationFrame` em lugar nenhum.
- `subscribeRoster` so dispara quando o CONJUNTO de peers (ou o flag `idle` de algum) muda. E o unico caminho que causa re-render de React.
- `subscribeFrame` e consumido de forma IMPERATIVA pela `CursorLayer`: o listener escreve `element.style.transform` direto no `ref` de cada marcador. **Proibido** usar `setState` por posicao (seria re-render a 30 Hz e mataria RNF-01).

**C6b. Ganchos de cursor no `Session` (`src/renderer/src/services/session.ts`)**

Molde literal do que ja existe para midia (`MediaHooks` em `session.ts:131`, `noopMediaHooks` em `:188`, o campo em `:204`, `setMediaHooks` em `:360-362`). **`session.ts` continua sem importar `cursor-hub.ts`.**

```ts
export interface CursorHooks {
  /** CURSOR_MOVE ou CURSOR_END recebido pelo mesh. Nunca passa pelo reducer. */
  onCursorMessage(from: string, message: ProtocolMessage): void
  /** Chamado no `teardown`. Preserva a porta do hub (ver B2.2). */
  reset(): void
}

const noopCursorHooks: CursorHooks = {
  onCursorMessage: () => {},
  reset: () => {}
}

// dentro da classe Session
private cursorHooks: CursorHooks = noopCursorHooks
setCursorHooks(hooks: CursorHooks): void { this.cursorHooks = hooks }
sendCursor(peerIds: readonly string[], message: ProtocolMessage): void {
  this.mesh.sendMany(peerIds, message)
}
```

Ponto de ligacao UNICO, no rodape de `src/renderer/src/services/media-manager.ts`, logo depois de `session.setMediaHooks(mediaManager)` (`media-manager.ts:1145`):

```ts
session.setCursorHooks(cursorHub)
cursorHub.attach(session)
```

E o mesmo lugar e o mesmo motivo do comentario que ja esta em `media-manager.ts:1147-1149`: `session.ts` nao importa nem o `mediaManager` nem o `cursorHub`; a dependencia e sempre ao contrario.

**C7. `src/main/pointer-overlay.ts` (modulo NOVO do main)**

```ts
/** Instala os ganchos de ciclo de vida; chamado uma vez em `app.whenReady()`. */
export function registerPointerOverlay(getMainWindow: () => BrowserWindow | null): void

/** Sobe o overlay sobre o monitor da fonte. Nunca lanca. */
export function showPointerOverlay(
  request: PointerOverlayShowRequest
): Promise<PointerOverlayShowResult>

/** Derruba o overlay. Idempotente: sem janela no ar e no-op. */
export function hidePointerOverlay(): void

/** Relaya um frame para a janela de overlay. No-op se ela nao existir. */
export function forwardPointerOverlayFrame(frame: PointerOverlayFrame): void
```

Opcoes obrigatorias da `BrowserWindow` do overlay (cada uma com o requisito que ela atende):

```ts
new BrowserWindow({
  x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, // RF-08
  frame: false,
  transparent: true,
  backgroundColor: '#00000000',
  hasShadow: false,
  resizable: false,
  movable: false,
  minimizable: false,
  maximizable: false,
  fullscreenable: false,
  skipTaskbar: true,
  focusable: false,          // nunca rouba foco de quem esta usando a maquina
  show: false,               // so aparece depois do setContentProtection (RF-05)
  title: POINTER_OVERLAY_TITLE,
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    devTools: !app.isPackaged,
    backgroundThrottling: false   // mesma razao da janela principal
  }
})
```

Sequencia obrigatoria de `showPointerOverlay`:
1. resolver o monitor: `screen.getAllDisplays().find(d => String(d.id) === request.displayId)`; se `displayId` for `null` ou nao casar e houver apenas UM display, usar `screen.getPrimaryDisplay()`; se nao casar com varios displays, devolver `{ ok: false, reason: 'display-not-found' }` sem criar janela;
2. se ja existir overlay, derrubar antes (idempotencia);
3. criar a janela com as opcoes acima;
4. `window.setContentProtection(true)` dentro de `try/catch`; se lancar, `window.destroy()` e devolver `{ ok: false, reason: 'content-protection-failed' }`;
5. `window.setIgnoreMouseEvents(true)` (RF-09) e `window.setAlwaysOnTop(true, 'screen-saver')`;
6. `await window.loadFile(join(__dirname, '../renderer/overlay.html'))`;
7. `window.showInactive()` (mostra sem roubar foco);
8. devolver `{ ok: true }`.

**C8. Segunda entry de renderer (`electron.vite.config.ts`)**

`renderer.build.rollupOptions.input` (hoje `{ index: resolve(__dirname, 'src/renderer/index.html') }`, linha 46 do arquivo) passa a ter tambem `overlay: resolve(__dirname, 'src/renderer/overlay.html')`. O `overlay.html` repete a MESMA meta de CSP do `index.html` (`src/renderer/index.html`, linhas 6-9), define `<title>zoi-pointer-overlay</title>` e monta `src/renderer/src/overlay/main.tsx`, que importa `theme.css` (para herdar tokens e o bloco de `prefers-reduced-motion`) e a folha nova `overlay.css`.

### 5b. Dependencias e configuracao

**Nenhuma dependencia nova**, nem de runtime nem de desenvolvimento. Tudo usa API nativa do Electron 43.4.1 (`BrowserWindow`, `screen`, `setContentProtection`, `setIgnoreMouseEvents`, `desktopCapturer`) e do Chromium ja embutido. PeerJS 1.5.5 continua como esta.

Constantes novas, **por NOME** (todas em `src/shared/config.ts`, junto das demais):

- `CURSOR_SEND_INTERVAL_MS` - intervalo do flush de envio de posicao.
- `CURSOR_IDLE_MS` - tempo parado ate o ponteiro esmaecer.
- `CURSOR_RECEIVE_MIN_GAP_MS` - piso de intervalo aceito por peer no recebimento (defesa contra enxurrada, matriz 5c).
- `POINTER_OVERLAY_FRAME_MS` - intervalo do frame agregado (tick unico do `CursorHub`).
- `POINTER_LOG_INTERVAL_MS` - janela minima entre duas linhas de log de descarte por peer.

Token de CSS novo (em `src/renderer/src/ui/theme.css`, bloco `:root`, junto de `--dur-fast`/`--dur-enter`/`--dur-screen` nas linhas 55-58): `--dur-cursor-glide`. **Nao deve ser zerado no bloco de `prefers-reduced-motion`** (linhas 62-77): o `transition-duration: 0.001ms !important` do seletor universal ja cobre o caso, e zerar tambem a variavel seria redundante.

Nenhuma chave nova em `settings.json`. Nenhuma variavel de ambiente nova. Nenhuma constante em `@shared/presets` ou `@shared/codecs`.

Script novo em `package.json`: `"pointer:probe": "node scripts/pointer-probe.mjs"`, no molde exato de `"audio:probe"` que ja existe.

### 5c. Matriz de confianca

Esta feature **nao tem papeis nem autenticacao**: dono e membro comum tem exatamente as mesmas capacidades aqui (PRD secao 4, nota introdutoria). A unica decisao de permissao e a de quem transmite, sobre a propria transmissao. O que a matriz cobre e o ABUSO das mensagens e canais novos.

**Regra geral que vale para toda a tabela de `CURSOR_MOVE`/`CURSOR_END`**: o descarte e **SILENCIOSO, LOCAL e SEM EFEITO COLATERAL**. Nunca `closeConnection`, nunca `rejectFrom` (`room-state.ts:733-744`), nunca `console` por mensagem (risco R7 e R8). Um contador por peer pode gerar UMA linha `[pointer] ...` a cada `POINTER_LOG_INTERVAL_MS`, e so.

| Mensagem / canal | Quem PODE mandar | O que o receptor VERIFICA antes de agir | O que acontece se a checagem falhar |
|---|---|---|---|
| `CURSOR_MOVE` | qualquer membro do roster que esteja assistindo aquele `txId` com os ponteiros ligados | (1) `from` esta em `state.members`; (2) `state.transmissions[txId]` existe; (3) `state.transmissions[txId].pointersEnabled === true`; (4) `state.watching[from] === txId` (o remetente e MESMO espectador daquela transmissao); (5) o receptor participa daquele `txId` (e o transmissor dele ou tem `selfWatchingTxId === txId`); (6) `x` e `y` estao em `[0, 1]`; (7) `from !== state.selfPeerId`; (8) o intervalo desde a ultima mensagem aceita daquele peer e `>= CURSOR_RECEIVE_MIN_GAP_MS` | descarte silencioso. Nada e desenhado, nada e enviado de volta, a conexao continua aberta |
| `CURSOR_END` | os mesmos | as checagens (1), (2), (5) e (7). **A checagem (4) NAO se aplica**: um `CURSOR_END` precisa ser aceito exatamente quando o remetente ja parou de assistir (RF-18); e a (3) tambem nao, porque um `CURSOR_END` que chega depois de o toggle desligar ainda deve limpar o ponteiro | descarte silencioso |
| `CURSOR_MOVE` com payload malformado (`x: '0.3'`, `txId: ''`, campo ausente) | - | `isCursorMovePayload` (guard estrutural, contrato A2) roda dentro de `validateEnvelope` | `invalid_payload`; o `Mesh` ja loga UMA linha de envelope descartado pelo caminho existente, sem mudanca |
| `CURSOR_MOVE` de quem NAO esta no roster | ninguem | checagem (1) | descarte silencioso. **Nunca `closeConnection`** (risco R8): ao contrario de `TX_START` e `QUALITY_UPDATE`, esta mensagem nao passa pelo reducer e portanto nao toca `rejectFrom` |
| `CURSOR_MOVE` de um `txId` de OUTRA transmissao simultanea | qualquer membro | checagem (5) | descarte silencioso. E o que garante RF-16/AC-08: quem assiste B nunca ve ponteiro de quem aponta em A |
| `CURSOR_MOVE` com `txId` da propria transmissao LOCAL, mandado por quem nao esta assistindo | - | checagem (4) | descarte silencioso: um par que nao anunciou `WATCHING_UPDATE` para aquele `txId` nao aponta nele |

**Janela conhecida da checagem (4), registrada de proposito.** `state.watching[from]` so existe depois de o `WATCHING_UPDATE` daquele par chegar, e esse anuncio tem debounce de `WATCHING_UPDATE_DEBOUNCE_MS = 300` (`src/shared/config.ts:154`) mais o tempo de rede. Existe portanto uma janela inicial, tipicamente abaixo de meio segundo depois de o espectador abrir o player, em que TODA posicao dele e descartada em silencio. **Nao quebra nenhum requisito e se resolve sozinha** (o proximo flush, 40 ms depois, ja passa), e trocar a checagem por algo mais frouxo abriria a porta para um nao-espectador desenhar na transmissao alheia. A consequencia pratica esta em UM lugar so: o e2e do Sprint T precisa esperar o `watching` estabilizar antes do primeiro `page.mouse.move`, senao o AC-06/AC-07 fica intermitente (ver T7).
| `CURSOR_MOVE` com `x: 5000` ou `y: -3` | - | checagem (6) | descarte silencioso, **sem clamp**. Clampar prenderia um ponteiro na borda da tela, que e exatamente o defeito que RF-17 proibe |
| Enxurrada de `CURSOR_MOVE` (cliente adulterado a 1000/s) | - | checagem (8), por peer | as mensagens acima do teto sao descartadas na entrada, antes de qualquer trabalho de desenho. O custo por mensagem descartada e uma comparacao de numero. O canal em si continua limitado pelo proprio DataChannel confiavel, como qualquer outra mensagem do app |
| `CURSOR_MOVE` que o proprio cliente enviou, voltando por engano | - | checagem (7) | descarte silencioso. E a ultima rede de RF-14 (ninguem ve o proprio cursor); as duas primeiras sao nao se incluir na lista de destinatarios (C2) e nao desenhar a si mesmo na `CursorLayer` |
| `TX_START` com `pointers: true` mandado por quem NAO e o dono daquela transmissao | so o transmissor | o reducer ja exige `senderIsMember` (`room-state.ts:565`) e, no branch de reanuncio, `known.peerId === from` (`room-state.ts:574`) | um `TX_START` de `txId` conhecido vindo de OUTRO peer nao cai no branch de reanuncio; ele cai no branch de transmissao nova e cria uma transmissao com o `peerId` do remetente, exatamente como hoje. Nenhum caminho permite um terceiro ligar ponteiros na transmissao alheia |
| `TX_START` com `pointers: true` e `sourceKind: 'window'` | so o transmissor | nao ha cruzamento no guard (contrato A1) | inofensivo por construcao: o overlay so sobe na maquina de QUEM TRANSMITE, e la a regra e local (`applyLocalTxPointers` passo 2). No espectador, o unico efeito seria enviar posicoes que ninguem desenha |
| `pointer-overlay:show` / `:hide` (IPC) | so o renderer da janela principal do proprio app | `contextIsolation: true` mais `sandbox: true` mais preload minimo: nao existe caminho para conteudo remoto chamar isso. O main normaliza `displayId` para `string \| null` | `displayId` que nao casa com nenhum display e ha mais de um monitor: `{ ok: false, reason: 'display-not-found' }`, nenhuma janela criada |
| `pointer-overlay:frame` (IPC) | so o renderer da janela principal | o main verifica que `frame` e objeto, que `txId` e string nao vazia, que `pointers` e array com no maximo `ROOM_MAX_LIMIT` itens, e que cada item tem `peerId`/`nickname`/`fill` string e `x`/`y` numeros finitos em `[0, 1]` | descarte silencioso do frame inteiro; o overlay simplesmente mantem o ultimo frame valido ate o proximo |
| `pointer-overlay:render` (IPC) | so o main | a janela de overlay so registra o listener; nenhum outro processo consegue emitir neste canal | N/A |
| **Controle remoto de mouse ou teclado** (RF-33 `[WONT]`) | **ninguem, nunca** | nao existe API para isso em lugar nenhum desta feature: o overlay tem `setIgnoreMouseEvents(true)` e `focusable: false`, e nenhum modulo importa `robotjs`, `nut.js`, `sendInput` ou equivalente | **Guarda desta SPEC**: se um agente de implementacao sentir vontade de "so clicar onde o outro apontou", a resposta e nao. As posicoes sao dados de desenho e nada mais |

---

## 6. Backend e Frontend: divisao do trabalho

**Ordem obrigatoria: SPIKE, depois Backend inteiro, depois Frontend, depois o sprint de testes.** O frontend so consome contratos que ja existem no codigo quando ele comeca.

### 6.1 Backend (Sprints S1, B1, B2, B3)

Cobre tudo o que nao e pixel: as duas sondas, os dois modulos puros, o protocolo, a rota das posicoes no mesh, o `CursorHub`, a janela de overlay no processo main e o IPC. Nenhuma dessas features renderiza nada visivel alem da janela de overlay VAZIA (que o Sprint F2 preenche).

### 6.2 Frontend (Sprints F1, F2)

**A identidade visual desta feature ja esta contratada no `UISPEC_viewer-cursors.md` (fingerprint `0bbddbe466cf78d9e02289bfb93fcc8c5996a3b6`, registrado na secao 1) e nas 8 capturas em `.forge/ideas/viewer-cursors/ui-refs/`. Esta SPEC NAO redefine tokens, geometria nem vocabulario visual: ela aponta.** O agente de frontend deve ler o UISPEC inteiro antes de escrever a primeira linha, e em particular:

- **secao 3** para os tokens computados (`--accent` `#9d00ff`, `--accent-hover` `#b23dff`, `--accent-soft` `#9d00ff26`, `--bg-app` `#0e0b12`, `--danger` `#ff3d5e`, `--dur-fast` 120 ms, `--dur-enter` 180 ms, `--ease`), para a regra de `prefers-reduced-motion` (`theme.css:62-77`) e para a **EXCECAO DELIBERADA do deslize do cursor**, que esta SPEC concretiza em 3/T6 (`--dur-cursor-glide: 32ms`, easing `linear`);
- **secao 3, bloco "Letterbox do player"**, para a regra de medir o `<video>` (`.z-player__video`) e **nunca** `.z-player` (que tem `border: 1px` fora do fullscreen e perde a borda dentro dele);
- **secao 4** para o inventario a REUSAR: `z-switch` (`room.css:578-643`, escala 38x22 com thumb de 16 px e `translateX(16px)`), `z-switch--bar` (`room.css:652-688`, escala 30x18 com thumb de 12 px e `translateX(12px)`), `z-switch__hint`, `z-note`, `Toast`, e a geometria EXATA do `.z-participant__avatar` (`room.css:226-238`: 34x34 px, `flex: none`, `border-radius: 50%`, `font-weight: 600`, `text-transform: uppercase`, tamanho de fonte herdado);
- **secao 4, bloco "EMPILHAMENTO"**, para onde a camada de cursores entra no JSX de `PlayerView` (irma entre o `<video>` e o `PlayerControls`; nao ha `z-index` nenhum em `player.css`, o empilhamento e ordem de fonte, e a barra de controles cobrir os ~13% inferiores do video e consequencia ACEITA, nao defeito a corrigir);
- **secao 6** para o unico ponto onde esta feature nao tem precedente: o nome do espectador flutua sobre VIDEO ao vivo, nao sobre superficie solida, e precisa de contraste proprio;
- **secao 7 (Do / Dont)** inteira, com destaque para: nao inventar familia nova de switch; nao esconder o toggle quando a fonte e janela; nao reusar `--danger` como cor de pessoa; nao animar nada alem de `transform` e `opacity`; nao desenhar cursor dentro do `<video>`. **UMA EXCECAO EXPLICITA: o Don't numero 4 do UISPEC ("nao deixar a interpolacao de posicao do cursor ignorar `prefers-reduced-motion`: ela precisa checar `matchMedia` em JS") fica SUPERADO por 3/T6 desta SPEC.** O UISPEC escreveu esse Don't presumindo que a interpolacao seria feita em JS; esta SPEC decidiu faze-la por TRANSICAO CSS, e o bloco global de `theme.css:62-77` forca `transition-duration: 0.001ms !important` em `*`, `*::before` e `*::after`, ou seja zera transicao e nao so animacao. Com isso o resultado observavel que RNF-08 exige (o cursor SALTA) sai de graca, e chamar `matchMedia` seria codigo morto. **O que continua valendo do espirito daquele Don't**: se alguem trocar a transicao por um laco de `requestAnimationFrame`, a regra global deixa de alcancar o calculo e o `matchMedia` volta a ser obrigatorio - por isso 3/T6 PROIBE interpolar em JS nesta feature. Em qualquer outro ponto de conflito entre UISPEC e SPEC que nao esteja listado aqui, vale o UISPEC;
- **secao 8** para as tres lacunas conscientes (cursor e bolinha colorida nao existem para fotografar; overlay do transmissor nao tem UI de app para fotografar; fullscreen e PiP nao foram capturados) e para o estado `disabled` do `z-switch`, que **foi** render-capturado por harness descartavel em `05-z-switch-disabled-harness.png` e cuja formula e `opacity: 0.45; cursor: not-allowed;` aplicada ao `<button role="switch">` inteiro, identica a `.z-btn:disabled` (`components.css:32-36`).

As capturas de referencia mais usadas por sprint: `01b` (toggle desabilitado no picker, F1.1), `02b` (recorte da `TransmittingBar` com o `sharpness-toggle`, F1.2), `04`/`04b` (avatares todos com a MESMA cor hoje, F1.3), `03` (letterbox real com as faixas de 99,5 px, F2.2).

**Regra GREEN (vale para TODA feature, sem excecao, LESSONS 2026-08-25):** antes do commit, alem de `npm run typecheck` e `npm run lint`, a feature precisa ser EXERCITADA de verdade pelo caminho descrito em "Done when". Build passando NAO e exercicio, e para o frontend o exercicio inclui **ver a coisa RENDERIZADA**. Se o orcamento acabar antes do exercicio, **NAO commite**: reporte o estado. Para modulo puro, o exercicio aceito e um arquivo temporario `tests/unit/__scratch-<assunto>.test.ts`, rodado com `npx vitest run tests/unit/__scratch-<assunto>.test.ts` e **APAGADO antes do commit** (os testes definitivos sao do Sprint T).

**Regra de commit:** `git add` sempre com caminhos EXPLICITOS, nunca `-A`; nunca rodar formatador com glob amplo dentro desta feature (LESSONS 2026-08-25, `app-audio-capture`). Conventional Commits em pt-BR, sem acentos, sem travessao, **sem assinatura do Claude**.

**Regra de log (risco R6):** toda linha de log nova usa o prefixo `[pointer]` e e PROIBIDO conter `media-pull`, `dialback`, `discando de volta` ou `na outra direcao`. Verificacao mecanica no Done when de cada feature.

**Regra de silencio (regra permanente do usuario, reiterada):** qualquer execucao de Playwright roda MUDA. O helper ja garante isso com `--mute-audio` (`tests/e2e/helpers/zoi-app.ts:130`) e `soundVolume: 0` no perfil semeado (`:86`); nenhuma feature pode remover ou contornar esses dois.

---

## 7. Plano de execucao

### Sprint S1 - SPIKE (PRECONDICAO, PRD RNF-11 / AC-40)

> **Se qualquer uma das duas sondas falhar, o pipeline PARA aqui e volta para conversa com o usuario.** Nao existe plano B nesta SPEC. Nenhum sprint abaixo pode comecar antes de as duas sondas estarem CONFIRMADAS e registradas.

#### Feature S1.1 - As duas sondas obrigatorias `[spike]`

**Traces**: RNF-11, AC-40, e como precondicao tambem RF-05, RF-08, RF-09, AC-05, AC-09, AC-10.

**Steps**
1. Criar `scripts/pointer-probe.mjs`, lendo antes `scripts/audio-probe.mjs` para copiar a estrutura (subir o Electron do proprio projeto, rodar os itens em sequencia, imprimir um relatorio legivel e sair com codigo 0 ou 1). Acrescentar `"pointer:probe": "node scripts/pointer-probe.mjs"` em `package.json`, ao lado de `"audio:probe"`.
2. **Sonda A, item 1 (a janela existe e e visivel).** Criar uma `BrowserWindow` com exatamente as opcoes do contrato 5.C7 (transparente, sem frame, `alwaysOnTop`, `focusable: false`, `skipTaskbar`), carregando um HTML inline com um retangulo MAGENTA opaco de 200x200 px numa posicao conhecida. Mostrar com `showInactive()`. Registrar que a janela apareceu.
3. **Sonda A, item 2 (a janela SEM protecao entra na captura).** Com `setContentProtection` ainda NAO chamado, capturar o proprio monitor por `desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 640, height: 360 } })` e inspecionar o `thumbnail` (`NativeImage.getBitmap()`) na regiao correspondente ao retangulo. **Esperado: o magenta APARECE.** Este item e o CONTROLE: sem ele, um resultado negativo no item 3 poderia ser apenas uma captura que nao pega nada.
4. **Sonda A, item 3 (a janela COM protecao some da captura).** Chamar `window.setContentProtection(true)`, esperar 500 ms, capturar de novo do mesmo jeito e inspecionar a mesma regiao. **Esperado: o magenta SUMIU e o que aparece e o conteudo da area de trabalho por baixo.** Registrar os valores RGB medios da regiao nos dois casos, nao so o veredito.
5. **Sonda A, item 4 (a janela continua visivel ao olho e deixa o clique passar).** Registrar `window.isVisible()` e `window.isDestroyed()` depois do `setContentProtection(true)`, e chamar `window.setIgnoreMouseEvents(true)`. Como a verificacao de clique nao e automatizavel sem input sintetico, o script IMPRIME uma instrucao para o operador ("clique dentro do retangulo magenta e confirme que o clique chegou ao aplicativo por baixo") e o resultado entra no `SPIKE-RESULTS` como item verificado A MAO, declarado como tal. Nao inventar veredito automatico aqui.
6. **Sonda B, item 1 (a ponte de ids existe).** Rodar `desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } })` e `screen.getAllDisplays()` e imprimir a tabela cruzada: para cada fonte, `source.id`, `source.name`, `source.display_id`, e o `display.id`/`display.bounds`/`display.scaleFactor` que casa. **Esperado: todo `source` de tipo `screen` casa com exatamente um `display`.**
7. **Sonda B, item 2 (o `bounds` posiciona a janela no monitor certo).** Para CADA display encontrado, mover a janela do item 2 para `display.bounds` e imprimir `window.getBounds()` de volta, mais `screen.getDisplayMatching(window.getBounds()).id`. **Esperado: o id que volta e o mesmo do display pedido**, para todos eles. Este item e o que prova RF-08 antes de existir codigo de feature.
8. **Sonda B, item 3 (a captura ESCALA e nao preenche com barras).** Abrir uma captura real daquele monitor pelo caminho que o app ja usa (armar a fonte e chamar `getDisplayMedia` com o preset `p720_30` do projeto), ler `videoWidth`/`videoHeight` da track e comparar a proporcao com `display.bounds.width / display.bounds.height`. **Esperado: as duas proporcoes batem dentro de 1%.** E o que sustenta a decisao de 3/T4 de o overlay nao precisar de calculo de letterbox.
9. **Sonda B, item 4 (o caso de UM SO monitor).** Registrar, explicitamente, o que `source.display_id` devolve quando a maquina tem um unico monitor (pode vir vazio). Se vier vazio, isso NAO e falha: e o caso em que o alvo e trivialmente `screen.getPrimaryDisplay()`, e o contrato 5.C7 ja preve esse ramo.
10. Escrever `.forge/ideas/viewer-cursors/SPIKE-RESULTS_viewer-cursors.md` no formato de `.forge/complete/app-audio-capture/SPIKE-RESULTS_app-audio-capture.md`: frontmatter com `feature`, `sprint: 1 (spike)`, `language: pt-BR` e `machine`; secao 0 com o ambiente medido (Electron, Chromium, Windows, numero de monitores, `scaleFactor` de cada um); secao 1 com a tabela "veredito por item" das duas sondas; uma secao por sonda com a SAIDA REAL, nunca teoria.

**Edge cases** (categoria: spike de plataforma)
- Maquina com UM monitor so: `display_id` vazio (item 9). Registrar, nao falhar.
- Maquina com escala de DPI diferente de 100%: registrar `scaleFactor` de cada display e conferir que `window.getBounds()` volta igual ao `display.bounds` pedido (o mesmo espaco de coordenadas em pontos).
- Monitores com posicoes negativas (monitor a esquerda do principal, `bounds.x < 0`): o item 7 precisa cobrir esse caso se ele existir na maquina; e o caso classico que quebra codigo de posicionamento.
- `setContentProtection` que nao lanca mas tambem nao faz nada: por isso o item 2 (controle) existe. Sem o controle, "o magenta nao apareceu" seria ambiguo.
- `desktopCapturer` devolvendo `thumbnail` vazio (`isEmpty()`): tratar como FALHA DE SONDA, nao como sucesso silencioso.

**Done when**
- `npm run pointer:probe` roda ate o fim e imprime o relatorio das duas sondas.
- Sonda A: item 2 mostra o magenta PRESENTE, item 3 mostra o magenta AUSENTE, com os valores RGB medios registrados. Item 5 confirmado a mao e declarado como tal.
- Sonda B: todos os `source` de tipo `screen` casam com um display; para cada display, a janela reposicionada volta pelo `getDisplayMatching` com o id certo; as proporcoes do item 8 batem dentro de 1%.
- `SPIKE-RESULTS_viewer-cursors.md` escrito, com a saida real e nao um resumo.
- **Se algum item falhar: NAO seguir para B1.** Escrever o `SPIKE-RESULTS` com a falha documentada e devolver ao usuario.

**Commit**: `chore(sonda): registra as sondas de overlay fora da captura e de mapeamento de monitor`
**Rollback**: apagar `scripts/pointer-probe.mjs` e a linha do `package.json`. Nada de producao foi tocado.

---

## Backend

### Sprint B1 - Fundacao pura e contratos

#### Feature B1.1 - Modulos puros de cor e de geometria `[core]`

**Traces**: RF-19, RF-21, RF-22, RF-23, RNF-05.

**Steps**
1. Criar `src/shared/geometry.ts` com o cabecalho de comentario no estilo do projeto (pt-BR sem acento) explicando: modulo PURO (sem DOM, sem Electron, importavel por `tests/unit`), a matematica de `object-fit: contain`, e a regra de medir o `<video>` e nunca o container.
2. Implementar `ContentRect`, `contentRectOf` e `normalizedPointIn` exatamente como o contrato 5.C4 descreve, incluindo o retorno `null` nos dois casos de invalidez (dimensao nao finita ou `<= 0`) e o retorno `null` de `normalizedPointIn` quando o ponto cai fora do conteudo. **`normalizedPointIn` NUNCA clampa.**
3. Criar `src/shared/person-colors.ts` com cabecalho explicando a decisao de 3/T1 em duas frases (paleta fixa de 10, colisao resolvida por `joinedAt` e `peerId`, quem chega e sempre o deslocado) e o motivo de a formula reproduzir `--accent-hover`/`--accent-soft` em `hue: 277`.
4. Implementar `PERSON_COLOR_SLOTS` com os 10 pares `{ hue, light }` da tabela de 3/T1, **na ordem exata**, `hash32` (FNV-1a de 32 bits: `let h = 0x811c9dc5; for cada code unit: h ^= c; h = Math.imul(h, 0x01000193); return h >>> 0`), `baseSlotOf`, `resolvePersonSlots` com o algoritmo literal dos 4 passos de 5.C5, e `colorOfSlot`.
5. Acrescentar em `src/shared/config.ts`, junto das demais constantes de temporizacao, as cinco chaves de 5b, cada uma com um comentario curto dizendo a unidade e o porque do numero: `CURSOR_SEND_INTERVAL_MS = 40` (25 envios por segundo, dentro da faixa de 20 a 30 de RF-32 e abaixo do teto), `CURSOR_IDLE_MS = 5_000` (P2 da IDEA), `CURSOR_RECEIVE_MIN_GAP_MS = 20` (aceita ate 50 por segundo por peer, o dobro da cadencia nominal, para tolerar jitter sem aceitar enxurrada), `POINTER_OVERLAY_FRAME_MS = 33` (aproximadamente 30 frames por segundo, o tick unico do `CursorHub`), `POINTER_LOG_INTERVAL_MS = 10_000`.

**Edge cases** (categoria: modulo puro de dominio)
- `contentRectOf(0, 0, 1280, 720)`: devolve `null` (elemento ainda sem layout).
- `contentRectOf(1104, 820, 0, 0)`: devolve `null` (video ainda sem `loadedmetadata`).
- `contentRectOf` com `NaN` ou `Infinity` em qualquer argumento: devolve `null`, nao lanca.
- Proporcao do elemento IGUAL a do stream: `left` e `top` sao 0 e nao ha barra nenhuma; o codigo nao pode ter caso especial para isso, a formula ja cobre.
- Barras nas LATERAIS (elemento mais largo que o stream, ex.: caixa 1600x600 com stream 16:9): `top` e 0 e `left` e positivo. A formula cobre; o teste precisa exercitar os dois sentidos.
- `normalizedPointIn` num ponto exatamente na borda (`offsetX === rect.left`): devolve `x = 0`, e valido. Na borda oposta (`offsetX === rect.left + rect.width`) devolve `x = 1`, tambem valido. Fora por 1 px devolve `null`.
- `resolvePersonSlots([])`: devolve `{}`, nao lanca.
- `resolvePersonSlots` com 11 membros (acima da paleta, impossivel com `ROOM_MAX_LIMIT = 8` mas obrigatorio nao travar): o 11o recebe o proprio `baseSlotOf` mesmo ocupado, e a funcao TERMINA.
- Dois membros com `joinedAt` IDENTICO: o desempate cai no `peerId` lexicografico, e o resultado e o mesmo em qualquer maquina.
- `hash32('')`: devolve o valor inicial do FNV (`0x811c9dc5 >>> 0`), sem erro; `baseSlotOf('')` devolve um slot valido.

**Done when**
- `npm run typecheck` e `npm run lint` verdes.
- Exercicio (scratch test, apagado antes do commit) provando: (a) o exemplo trabalhado do letterbox de 5.C4 (caixa 1104x820, stream 1280x720, `top = 99.5`, e o par `0.35 / 0.60` do AC-18); (b) o ponto na faixa preta devolvendo `null`; (c) o exemplo trabalhado do desempate de 5.C5 (Bruna fica com 3, Joao vai para 4, Carla entra sem mexer em ninguem); (d) `colorOfSlot(8).fill === 'hsl(280 100% 68%)'`; (e) que os 10 slots produzem contraste `>= 4.5:1` da inicial contra o proprio fundo do avatar composto sobre `#0e0b12` (a funcao de contraste do teste calcula luminancia relativa sRGB; os valores esperados sao os da tabela de 3/T1).

**Commit**: `feat(cursores): adiciona os modulos puros de cor por pessoa e de area real do video`
**Rollback**: apagar os dois arquivos novos e reverter as 5 constantes de `config.ts`. Ninguem importa ainda.

#### Feature B1.2 - Protocolo, estado do toggle e reanuncio `[api-like]`

**Traces**: RF-01, RF-02, RF-03, RF-04, RF-16, RF-27, RF-28, RF-30, RNF-03, RNF-06.

**Steps**
1. `src/shared/protocol.ts`: aplicar as CINCO alteracoes da tabela do contrato 5.A4, nas linhas indicadas. Acrescentar as interfaces `CursorMovePayload` e `CursorEndPayload` junto dos demais payloads (depois de `WatchingUpdatePayload`, `protocol.ts:142-144`) e os guards `isCursorMovePayload`/`isCursorEndPayload` junto dos demais (depois de `isWatchingUpdatePayload`, `protocol.ts:373-375`). Acrescentar `pointers?: boolean` em `TxStartPayload` e a clausula opcional no guard. **Nao tocar em `PRESET_IDS`, `SOURCE_KINDS`, `QUALITY_LEVELS`, `TX_STOP_REASONS` nem em `PROTOCOL_VERSION`.**
2. `src/renderer/src/core/room-state.ts`: acrescentar `pointersEnabled: boolean` em `TransmissionState` (`room-state.ts:47-59`) com o comentario do contrato 5.A5.
3. Mesmo arquivo, case `TX_START` (`room-state.ts:564`): no branch de TRANSMISSAO NOVA (`room-state.ts:594-610`) gravar `pointersEnabled: payload.pointers === true`. No branch de REANUNCIO (`room-state.ts:574-591`) atualizar `pointersEnabled` junto dos demais campos e trocar o `effects: []` fixo pela expressao do contrato 5.C3 (toast SO na transicao `true -> false` e SO quando `state.selfWatchingTxId === payload.txId`). Preservar `startedAt` e `status` como hoje.
4. Mesmo arquivo, `applyLocalTxStart` (`room-state.ts:1397`): acrescentar `pointers: boolean` em `LocalTxStartEvent` (`room-state.ts:216-227`), gravar `pointersEnabled: event.pointers` na transmissao local e incluir `pointers: event.pointers` no payload do `broadcast` de `TX_START`.
5. Mesmo arquivo: criar `LocalTxPointersEvent`, acrescentar `'LOCAL_TX_POINTERS'` ao union `RoomEvent` (`room-state.ts:255-273`) e ao `switch` de `reduce` (`room-state.ts:366-400`), e implementar `applyLocalTxPointers` com os 4 passos literais do contrato 5.C3.
6. Mesmo arquivo: criar `viewerPeerIdsOf` logo depois de `viewersOf` (`room-state.ts:290-296`), com o comentario do contrato 5.C2.
7. `src/renderer/src/services/session.ts`: acrescentar `setTransmissionPointers(on: boolean): void` no bloco de API publica, ao lado de `watch` (`session.ts:481-483`), despachando `LOCAL_TX_POINTERS`.
8. `src/renderer/src/services/media-manager.ts`: acrescentar `pointers: boolean` em `StartTransmissionOptions` (`media-manager.ts:40-46`) e em `LocalTransmission` (`media-manager.ts:55-68`); em `startTransmission` (`media-manager.ts:428`) gravar **sempre `pointers: false`** no objeto `transmission` e repassar `pointers: false` para `announceTransmissionStart` (quem eventualmente liga e o passo 3 da feature B3.2, DEPOIS de o overlay subir de fato); em `onMemberJoined` (`media-manager.ts:677-694`) incluir `pointers: transmission.pointers` no payload reenviado.
9. `src/renderer/src/services/session.ts`, `announceTransmissionStart` (`session.ts:486-496`): acrescentar `pointers: boolean` na assinatura do objeto e repassar para o evento.
10. `src/renderer/src/ui/components/SourcePickerModal.tsx`: acrescentar `pointers: boolean` e `displayId: string \| null` a `SourceChoice` (`SourcePickerModal.tsx:11-17`) e preenche-los no `onConfirm` (`SourcePickerModal.tsx:78-84`) com, POR ENQUANTO, `pointers: false` e `displayId: selected.displayId`. **Isto e obrigatorio nesta feature, nao na F1.1**: `RoomScreen` passa o `SourceChoice` direto para `mediaManager.startTransmission` (`RoomScreen.tsx:154-160`), entao sem estes dois campos o `typecheck` quebra assim que `StartTransmissionOptions` os exigir. O CONTROLE visual (o `z-switch`) que substitui o `false` fixo e a feature F1.1.

**Edge cases** (categoria: api-like)
- `TX_START` sem `pointers` (cliente antigo): guard aceita, estado grava `false`. Nenhum toast, nenhum overlay.
- `TX_START` com `pointers: 'sim'` (tipo errado): guard rejeita o payload inteiro, `validateEnvelope` devolve `invalid_payload`, o envelope e descartado. Comportamento desejado e registrado em 5c.
- Reanuncio com `pointers` IGUAL ao valor atual: `effects: []`, nenhum toast (e o caso que RF-28 exige, disparado por reconexao e por `onMemberJoined`).
- Reanuncio `true -> false` recebido por quem NAO esta assistindo aquele `txId`: estado atualiza, mas nenhum toast (a pessoa nao estava vendo ponteiro nenhum).
- Reanuncio `false -> true`: estado atualiza, nenhum toast (so o desligar avisa, RF-28).
- `LOCAL_TX_POINTERS` sem transmissao local: `{ state, effects: [] }`.
- `LOCAL_TX_POINTERS(true)` numa transmissao de `sourceKind: 'window'`: forcado para `false` (passo 2 de 5.C3), nenhum broadcast se ja estava `false`.
- `LOCAL_TX_POINTERS` com o MESMO valor: idempotente, nenhum broadcast (evita reanuncio a toa a cada clique repetido).
- `viewerPeerIdsOf` com `txId` inexistente: devolve `[]`.
- `viewerPeerIdsOf` numa sala onde ninguem assiste: devolve `[]`; a lista final de destinatarios fica so com o transmissor.
- `CURSOR_MOVE`/`CURSOR_END` chegando ao reducer (nao deveria acontecer, porque o Session intercepta antes): o `switch` de `applyMessage` cai no `default` (`room-state.ts:729-730`) e devolve `{ state, effects: [] }`. Nao acrescentar case para eles no reducer.

**Done when**
- `npm run typecheck`, `npm run lint` e `npx vitest run` verdes. A suite atual de `protocol.test.ts` e `room-state.test.ts` **nao pode quebrar**: `pointers` e opcional e `pointersEnabled` tem valor definido em todos os caminhos de criacao.
- Exercicio (scratch test, apagado antes do commit): (a) `validateEnvelope` aceita um envelope `CURSOR_MOVE` bem formado e rejeita `x: '0.3'` com `invalid_payload`; (b) um `TX_START` de `txId` conhecido do mesmo remetente com `pointers: false`, vindo depois de um com `pointers: true`, e com `selfWatchingTxId` igual, devolve EXATAMENTE um efeito `showToast` de tom `warning`; repetir a mesma mensagem devolve `effects: []`; (c) `viewerPeerIdsOf` no exemplo trabalhado de 5.C2 devolve `['Bruna','Joao']`.
- `grep -niE "media-pull|dialback|discando de volta|na outra direcao"` nos arquivos tocados: zero ocorrencias novas.

**Commit**: `feat(protocolo): adiciona as mensagens de posicao de cursor e o toggle por transmissao`
**Rollback**: reverter o commit. Os tipos novos nao sao produzidos nem consumidos por ninguem ainda, e `pointers` e aditivo.

---

### Sprint B2 - Rota das posicoes e o hub de cursores

> **Regra de dependencia deste sprint (nao negociavel).** `src/renderer/src/services/cursor-hub.ts` **NAO importa `session.ts`**, nem o valor, nem em escopo de modulo. O projeto ja resolve exatamente este problema por INJECAO: `session.ts:131` declara `MediaHooks`, `session.ts:188` tem o `noopMediaHooks` default, `session.ts:204` guarda o campo, `session.ts:360-362` expoe `setMediaHooks`, e o comentario de `media-manager.ts:1147-1149` diz com todas as letras que "session.ts nao importa o mediaManager: a dependencia e ao contrario". Se o hub importasse `session` e chamasse `attach(session)` em escopo de modulo, um boot que carregasse `session.ts` primeiro bateria em TDZ no `export const session = new Session()` (`session.ts:1195`) e derrubaria o app com `Cannot access 'session' before initialization`. Por isso o hub e criado ANTES (B2.1), fala com a sessao por uma PORTA estrutural, e a ligacao dos dois acontece em B2.2, num modulo de boot que ja importa `session` (`media-manager.ts`).

#### Feature B2.1 - Fan-out seletivo e o `CursorHub`, sem nenhum import de `session` `[core]`

**Traces**: RF-12, RF-14, RF-16, RF-17, RF-18, RF-20, RF-26, RF-29, RF-30, RF-32, RNF-01, RNF-06.

**Steps**
1. `src/renderer/src/services/mesh.ts`: acrescentar `sendMany` logo depois de `broadcast` (`mesh.ts:277-288`), com o corpo literal do contrato 5.C1 e o comentario que explica por que ele existe (fan-out por transmissao sem pagar a sala inteira).
2. Criar `src/renderer/src/services/cursor-hub.ts` implementando a API do contrato 5.C6, com cabecalho explicando TRES coisas: por que NAO passa pelo reducer (custo de render a 25 Hz); por que ha exatamente DOIS timers e nenhum `requestAnimationFrame`; e por que este modulo **nao importa `session.ts`** (a regra de dependencia do sprint, acima).
3. **Imports permitidos neste arquivo**: `type` de `../core/room-state` (`RoomState`, `RosterMember`), `type` de `@shared/protocol` (`ProtocolMessage`), e valores de `@shared/config`, `@shared/person-colors` e `@shared/ipc`. **Proibido** importar `./session`, mesmo com `import type`, para nao deixar a porta aberta a um import de valor no futuro: a porta `CursorSessionPort` do contrato 5.C6 e declarada NESTE arquivo, e `Session` a satisfaz estruturalmente sem que nenhum dos dois se conheca.
4. Estado interno: `entriesByTx: Map<string, Map<string, CursorEntry>>`, `port: CursorSessionPort | null`, `sendContext`, `overlayContext`, `lastSentPoint`, `pendingPoint`, `lastAcceptedAt: Map<string, number>`, `dropCounters: Map<string, { count: number; loggedAt: number }>`, `rosterListeners`, `frameListeners`, `sendTimer`, `frameTimer`.
5. `attach(port)`: guardar a porta e assinar `port.subscribe(state => this.onState(state))`. `onState` faz TRES coisas, todas de baixa frequencia: guarda o `state` corrente para as checagens de 5c, poda ponteiros de peers que sairam do roster (RF-29) e poda `txId` que sumiu de `state.transmissions` ou cujo `pointersEnabled` virou `false` (RF-27).
6. `setSendContext({ txId, enabled })`: quando `enabled` cai para `false` ou o `txId` muda, envia `CURSOR_END` do `txId` ANTERIOR (RF-18) e para o `sendTimer`. Quando liga, arma o `sendTimer` de `CURSOR_SEND_INTERVAL_MS`.
7. `reportLocalPoint(x, y)`: guarda em `pendingPoint`. **Nao envia nada aqui.**
8. `flush()` (corpo do `sendTimer`): se nao ha `pendingPoint`, ou ele e identico ao `lastSentPoint` (comparacao com tolerancia de `0.0005` em cada eixo, para nao enviar ruido de subpixel), nao envia. Caso contrario monta a lista de destinatarios pela regra de 5.C2 e chama `this.port.sendCursor(destinatarios, { type: 'CURSOR_MOVE', payload: { txId, x, y } })`.
9. `endLocal(txId?)`: envia UM `CURSOR_END` para os mesmos destinatarios, zera `pendingPoint` e `lastSentPoint`. Idempotente: chamar duas vezes seguidas nao envia a segunda.
10. `applyRemote(from, message)`: aplicar as checagens da matriz 5c **na ordem exata da tabela** e, passando por todas, criar ou atualizar a `CursorEntry`. Descarte incrementa `dropCounters` e nada mais; o log agregado sai no `frameTimer`, no maximo uma linha por peer a cada `POINTER_LOG_INTERVAL_MS`, sempre com o prefixo `[pointer]`.
11. `frameTimer` (`POINTER_OVERLAY_FRAME_MS`): unico tick. Por tick: (a) recalcula `idle` de cada entrada (`now - lastAt >= CURSOR_IDLE_MS`); (b) chama os `frameListeners` do `txId` visivel; (c) se `overlayContext.enabled`, monta o `PointerOverlayFrame` (resolvendo `nickname` por `nicknameOf` e a cor por `resolvePersonSlots`/`colorOfSlot` sobre `state.members`, mandando SO o campo `fill` de `PersonColor`, ver contrato 5.B) e chama `window.zoi.pointerOverlay.sendFrame(frame)`; (d) se o conjunto de peers ou algum flag `idle` mudou, chama os `rosterListeners`. O timer so fica armado enquanto ha entrada viva ou envio ativo, e se desarma sozinho quando nao ha nada a fazer.
12. `reset()`: limpa entradas, para os dois timers e esvazia listeners, mas **PRESERVA `this.port`** (ver o edge case de `session.reset()` na feature B2.2). Um `dispose()` separado, usado so pelos testes, tambem zera a porta.
13. Exportar a instancia unica: `export const cursorHub = new CursorHub()`. **Nenhuma chamada de `attach` neste arquivo**: quem liga e a feature B2.2.

**Edge cases** (categoria: servico com estado efemero)
- `applyRemote`, `flush` ou `endLocal` antes de `attach` (ordem de carga dos modulos, ou depois de um `dispose`): `this.port` e `null` e tudo vira no-op silencioso. **Nao lanca.** E o que torna a ordem de carga irrelevante.
- `sendMany` com lista vazia: nao cria envelope e nao envia nada.
- `sendMany` com um `peerId` que nao esta em `this.entries` (par que acabou de sair): aquele destinatario e ignorado, os outros recebem.
- `sendMany` com o proprio `selfPeerId` na lista: nao ha entrada para si mesmo em `this.entries`, entao e ignorado naturalmente. Ainda assim o chamador filtra (contrato 5.C2), porque depender de um efeito colateral seria fragil.
- `sendMany` para um par cujo canal ainda nao abriu: `deliver` enfileira (`mesh.ts:257-264`). Aceito: a fila e curta e o proximo flush chega em 40 ms.
- Posicao recebida de um peer que sai do roster no mesmo tick: `onState` poda depois; o pior caso e um frame com um ponteiro a mais, que some no tick seguinte (33 ms).
- Dois `txId` simultaneos com ponteiros ligados nos dois (a pessoa transmite A e assiste B): `entriesByTx` separa por `txId` e `sendContext` aponta so para B. Os dois papeis nao se misturam (persona 3 da PRD).
- `flush` com `state.transmissions[txId]` ja removido (o transmissor parou entre dois flushes): a lista de destinatarios fica vazia e nada e enviado; `setSendContext` sera atualizado pelo `onState` logo em seguida.
- Mouse parado exatamente sobre o mesmo pixel por minutos: nenhum envio (a comparacao com `lastSentPoint` corta), e o ponteiro esmaece em 5 s no lado de quem desenha. Ao voltar a mover, reaparece.
- Relogio do sistema andando para tras (ajuste de horario): `now - lastAt` fica negativo e o ponteiro nunca esmaeceria. Mitigado por `idle = now - lastAt >= CURSOR_IDLE_MS || lastAt > now`, que trata o caso absurdo como idle.
- `CURSOR_END` de um peer que nunca mandou posicao: no-op.
- `window.zoi.pointerOverlay` indisponivel (a janela de overlay caiu, ou o modulo roda dentro do Vitest): o passo 11(c) so chama `sendFrame` quando `typeof window !== 'undefined'` e `window.zoi?.pointerOverlay` existe. Sem essa guarda, o teste do Sprint T quebraria so por instanciar o hub.
- Sala inteira apontando ao mesmo tempo (7 espectadores): um frame por tick com 7 itens, nao 7 frames.

**Done when**
- `npm run typecheck`, `npm run lint` e `npx vitest run` verdes. **Nota de ordem**: `cursor-hub.ts` nao importa `session.ts`, e `session.ts` ainda nao conhece o hub, entao esta feature compila e roda sozinha, sem depender de nada da B2.2.
- Exercicio (scratch test com `vi.useFakeTimers()` e um fake de `CursorSessionPort`, apagado antes do commit): (a) `sendMany(['a','c'], msg)` numa malha fake com `a`, `b` e `c` entrega para `a` e `c` e **nao** para `b`, e o objeto de envelope entregue e o MESMO nos dois (o teste falha se a implementacao criar um envelope por destinatario); (b) 10 chamadas de `reportLocalPoint` dentro de 40 ms produzem UM envio; (c) avancar 1 000 ms movendo o ponto a cada tick produz **25 envios, nunca 26** (prova numerica de RF-32); (d) uma posicao de um peer que nao esta em `state.watching` para aquele `txId` e descartada **sem** nenhuma chamada na porta; (e) apos `CURSOR_IDLE_MS` sem posicao nova, a entrada fica `idle: true`, e a proxima posicao devolve `idle: false`.
- `grep` das quatro marcas de fallback nos arquivos tocados: zero ocorrencias novas.

**Commit**: `feat(cursores): adiciona o envio para subconjunto de pares e o hub de posicoes`
**Rollback**: apagar `cursor-hub.ts` e reverter `sendMany`. Nada importa nenhum dos dois ainda.

#### Feature B2.2 - Ligacao do hub ao transporte, por injecao `[core]`

**Traces**: RF-14, RF-16, RF-30, RNF-01, RNF-06.

**Steps**
1. `src/renderer/src/services/session.ts`: declarar `CursorHooks` (contrato 5.C6b) junto de `MediaHooks` (`session.ts:131`), com um `noopCursorHooks` ao lado de `noopMediaHooks` (`session.ts:188`), o campo `private cursorHooks: CursorHooks = noopCursorHooks` ao lado de `mediaHooks` (`session.ts:204`) e `setCursorHooks(hooks: CursorHooks): void` imediatamente depois de `setMediaHooks` (`session.ts:360-362`). **Molde copiado byte a byte do que ja existe**; nenhum import novo em `session.ts`.
2. Mesmo arquivo, `handleMeshMessage` (`session.ts:899`): acrescentar, LOGO DEPOIS dos dois blocos de PING/PONG (`session.ts:900-910`) e ANTES do `this.dispatch(...)` da linha 911, o bloco de interceptacao de `CURSOR_MOVE` e `CURSOR_END`, com um comentario no mesmo tom do que ja esta la ("posicao de cursor nao passa pelo reducer: e dado efemero de alta frequencia"). O bloco chama `this.cursorHooks.onCursorMessage(from, message)` e retorna. **Nunca `dispatch`, nunca `rejectFrom`, nunca `closeConnection`.**
3. Mesmo arquivo: acrescentar `sendCursor(peerIds: readonly string[], message: ProtocolMessage): void` na API publica, ao lado de `sendTo` (`session.ts:509`), delegando para `this.mesh.sendMany(peerIds, message)`. E a assinatura que faz `Session` satisfazer `CursorSessionPort` estruturalmente, sem `implements` e sem import cruzado.
4. Mesmo arquivo, `teardown` (`session.ts:1159`): acrescentar `this.cursorHooks.reset()` junto das demais limpezas, antes de `this.mesh.closeAll()`.
5. `src/renderer/src/services/media-manager.ts`, no rodape do modulo: logo depois de `session.setMediaHooks(mediaManager)` (`media-manager.ts:1145`), acrescentar `session.setCursorHooks(cursorHub)` e `cursorHub.attach(session)`, importando `cursorHub` de `./cursor-hub`. **Este e o UNICO ponto de ligacao dos dois.** Estender o comentario ja existente de `media-manager.ts:1147-1149` para registrar que o `cursorHub` segue a MESMA regra do `mediaManager` (`session.ts` nao importa nenhum dos dois; a dependencia e sempre ao contrario). A ordem fica garantida por construcao: `media-manager.ts` importa `session`, entao o modulo `session.ts` esta totalmente avaliado quando estas duas linhas rodam, e `cursor-hub.ts` nao importa nenhum dos dois.
6. Acrescentar ao gancho de diagnostico ja existente (`media-manager.ts:1153-1158`) a entrada `cursors: () => cursorHub.debugSnapshot()`, um metodo novo de leitura pura no hub que devolve as entradas por `txId`. Serve ao diagnostico de campo pelo mesmo caminho de `__zoiDebugMedia.sharpness` (`media-manager.ts:1155`).

**Edge cases** (categoria: transporte/servico)
- `CURSOR_MOVE` chegando antes de `setCursorHooks` (janela de boot): `noopCursorHooks` engole em silencio. Nenhum `undefined` em lugar nenhum.
- `CURSOR_MOVE` chegando quando `this.state.phase !== 'active'` (sala ja encerrada): o hub descarta pela checagem (1) da matriz 5c, porque `members` esta vazio.
- `teardown` chamado duas vezes: `reset()` do hub e idempotente.
- **`session.reset()` (`session.ts:1188`) chama `teardown()` e recria o estado.** E por isso que `reset()` do hub PRESERVA a porta (passo 12 de B2.1): `attach` roda uma unica vez por processo, no rodape de `media-manager.ts`, entao se `reset()` zerasse a porta, sair de uma sala e entrar em outra deixaria o hub mudo para sempre. Quem zera a porta e so o `dispose()` dos testes.
- Par forjando `CURSOR_MOVE` fora do roster: cai nas checagens de 5c dentro do hub, **sem** nunca chegar ao reducer e portanto sem nunca tocar `rejectFrom` (`room-state.ts:733-744`) nem gerar `closeConnection` (risco R8).

**Done when**
- `npm run typecheck`, `npm run lint` e `npx vitest run` verdes (`tests/unit/mesh.test.ts` e `tests/unit/session.test.ts` nao podem quebrar).
- **Prova mecanica de que nao ha ciclo de import**: `grep -n "from './session'" src/renderer/src/services/cursor-hub.ts` devolve ZERO linhas, e `grep -n "cursor-hub" src/renderer/src/services/session.ts` tambem devolve ZERO. Se qualquer um dos dois devolver algo, o desenho foi violado.
- **Exercicio real de boot (GREEN tem dentes):** `npm run dev`, entrar numa sala e conferir no console que o app sobe sem `Cannot access 'session' before initialization` e sem nenhum erro novo; no DevTools, `__zoiDebugMedia.cursors()` responde. Sair da sala e entrar em outra, e conferir que `__zoiDebugMedia.cursors()` continua respondendo (prova de que o `reset()` nao matou a porta).
- `grep` das quatro marcas de fallback: zero ocorrencias novas.

**Commit**: `feat(cursores): liga o hub de posicoes ao transporte por injecao de ganchos`
**Rollback**: reverter o commit; o hub volta a existir sem ninguem o alimentar e a interceptacao some.

---

### Sprint B3 - Janela de overlay do transmissor

#### Feature B3.1 - Janela, IPC e segunda entry de renderer `[api-like]`

**Traces**: RF-05, RF-07, RF-08, RF-09, RF-10, RNF-11.

**Steps**
1. `src/shared/ipc.ts`: acrescentar os quatro canais ao objeto `IPC` (`ipc.ts:4-19`), os tipos `PointerOverlayPointer`, `PointerOverlayFrame`, `PointerOverlayShowRequest`, `PointerOverlayShowResult` e a constante `POINTER_OVERLAY_TITLE`, numa secao propria com cabecalho `// pointer-overlay` no mesmo estilo das existentes; e o namespace `pointerOverlay` em `ZoiApi` (`ipc.ts:142-185`), com os comentarios do contrato 5.B.
2. `src/preload/index.ts`: acrescentar o namespace `pointerOverlay` ao objeto `api` (`preload/index.ts:27-77`), com `show`/`hide` por `invoke`, `sendFrame` por `ipcRenderer.send` e `onRender` no molde EXATO de `system.onResume` (`preload/index.ts:68-76`), devolvendo a funcao de descarte.
3. Criar `src/main/pointer-overlay.ts` implementando o contrato 5.C7 na integra, incluindo a sequencia obrigatoria de 8 passos de `showPointerOverlay` e os ganchos de `registerPointerOverlay` (`mainWindow.on('closed', hidePointerOverlay)`, `app.on('before-quit', hidePointerOverlay)`, `screen.on('display-metrics-changed', ...)`, `screen.on('display-removed', ...)`). `hidePointerOverlay` e IDEMPOTENTE e usa `window.destroy()` (nao `close()`, que dispararia o ciclo de `closed` de forma assincrona e abriria janela de corrida com um `show` imediatamente seguinte).
4. `src/main/ipc-handlers.ts`: registrar `pointer-overlay:show` (`ipcMain.handle`, normalizando `displayId` para `string | null`), `pointer-overlay:hide` (`ipcMain.handle`) e `pointer-overlay:frame` (`ipcMain.on`, validando a forma pela regra de 5c e chamando `forwardPointerOverlayFrame`).
5. `src/main/index.ts`: chamar `registerPointerOverlay(() => mainWindow)` dentro de `app.whenReady()`, ao lado de `registerAudioExclusionWindow(() => mainWindow)` (`src/main/index.ts:129`). **Nao mexer** em `window-all-closed` nem em `activate`: os ganchos de `registerPointerOverlay` ja resolvem o risco R2.
6. Criar `src/renderer/overlay.html` copiando a estrutura de `src/renderer/index.html` (mesma meta de CSP, linhas 6-9), com `<title>zoi-pointer-overlay</title>`, `background: transparent` no `html`/`body`/`#root` (em vez de `#0e0b12`) e `<script type="module" src="/src/overlay/main.tsx"></script>`.
7. Criar `src/renderer/src/overlay/main.tsx` montando um componente `OverlayApp` PLACEHOLDER (uma `<div className="z-overlay" />` vazia) e importando `../ui/theme.css`. O desenho de verdade e a feature F2.3.
8. `electron.vite.config.ts`: acrescentar `overlay: resolve(__dirname, 'src/renderer/overlay.html')` a `renderer.build.rollupOptions.input` (hoje so `index`, linha 46).

**Edge cases** (categoria: api-like / infraestrutura de processo)
- `show` chamado duas vezes seguidas: a segunda derruba a primeira antes de criar (passo 2 da sequencia). Nao sobra janela.
- `hide` sem janela no ar: no-op silencioso.
- `show` com `displayId: null` numa maquina com UM monitor: usa `screen.getPrimaryDisplay()`.
- `show` com `displayId` que nao casa e havendo VARIOS monitores: `{ ok: false, reason: 'display-not-found' }`, nenhuma janela criada. **Nao chutar o primario**: cobrir o monitor errado e pior que nao cobrir (o transmissor veria ponteiros no lugar errado, e RF-08 e `[MUST]`).
- `setContentProtection` lancando: janela destruida, `{ ok: false, reason: 'content-protection-failed' }`. Depois da Sonda A este caminho nao deve acontecer, mas ele existe porque a alternativa e vazar cursor para dentro do video (RF-05).
- `loadFile` falhando (arquivo ausente num build quebrado): capturar, destruir a janela e devolver `{ ok: false, reason: 'window-failed' }`.
- Frame chegando depois de `hide`: `forwardPointerOverlayFrame` checa a janela e faz no-op.
- Frame com 10 000 ponteiros ou com `x: 'a'`: descartado inteiro pela validacao de 5c, sem lancar.
- Monitor compartilhado removido no meio: `display-removed` derruba a janela; nao ha tentativa de migrar para outro monitor.
- App fechado com a transmissao no ar: `before-quit` derruba o overlay antes de sair.

**Done when**
- `npm run typecheck`, `npm run lint` e `npm run build` verdes, e o build gera `out/renderer/overlay.html` (conferir o arquivo no disco, nao so o log do bundler).
- **Exercicio real (GREEN tem dentes):** `npm run dev`, com uma transmissao de MONITOR ativa, executar no DevTools do renderer `await window.zoi.pointerOverlay.show({ displayId: null })` e confirmar, na tela, que (a) uma janela transparente subiu sobre o monitor, (b) `await window.zoi.pointerOverlay.hide()` a derruba, (c) `await window.zoi.pointerOverlay.hide()` de novo nao quebra nada. Registrar no relato o `PointerOverlayShowResult` recebido.
- Exercicio da janela orfa (risco R2): com o overlay no ar, fechar a janela principal do app pelo X e confirmar que o processo encerra e nenhuma janela transparente sobra.
- `grep` das quatro marcas de fallback: zero ocorrencias novas.

**Commit**: `feat(overlay): adiciona a janela de ponteiros protegida da captura e o canal de frames`
**Rollback**: reverter o commit. A janela so sobe por chamada explicita que ninguem faz ainda.

#### Feature B3.2 - Ciclo de vida do toggle no `MediaManager` `[core]`

**Traces**: RF-02, RF-03, RF-04, RF-07, RF-10, RF-11, RF-27, RF-30.

**Steps**
1. `src/renderer/src/services/media-manager.ts`: implementar `setPointersMode(on: boolean): Promise<boolean>` no molde de `setSharpnessMode` (`media-manager.ts:562-587`), imediatamente depois dele. Corpo: se nao ha transmissao local, devolve `false`; se `this.local.sourceKind !== 'screen'`, devolve `false` (RF-04 defensivo); ao LIGAR chama `window.zoi.pointerOverlay.show({ displayId: this.local.displayId })` e so segue se `result.ok`; ao DESLIGAR chama `window.zoi.pointerOverlay.hide()`; nos dois casos grava `this.local.pointers = on`, chama `this.session.setTransmissionPointers(on)` e `cursorHub.setOverlayContext({ txId: this.local.txId, enabled: on })`; devolve `true`. Log unico `[pointer] ponteiros ${on ? 'ligados' : 'desligados'} na transmissao ${txId}`.
2. Mesmo arquivo: acrescentar `displayId: string | null` a `StartTransmissionOptions` (`media-manager.ts:40-46`) e a `LocalTransmission` (`media-manager.ts:55-68`), gravando `displayId: options.displayId` no objeto `transmission` de `startTransmission`. O valor ja chega pronto do `SourceChoice` desde a feature B1.2, passo 10. **Sem isso o overlay nao sabe qual monitor cobrir**, que e metade do proposito da Sonda B.
3. Mesmo arquivo, `startTransmission` (`media-manager.ts:428`): a transmissao nasce SEMPRE com `pointers: false` (feature B1.2, passo 8). Depois de `announceTransmissionStart` e antes de `notifyStreams()`, se `options.pointers === true` e `options.sourceKind === 'screen'`, chamar **`await this.setPointersMode(true)`**, com `await`, nunca `void`. So se o `show` resolver `ok` e que `this.local.pointers` vira `true`; se falhar, ele **permanece `false`**, e o `RoomScreen`, que le `transmission.pointers` depois do `await` de `startTransmission`, ve o valor certo e mostra o toast de falha (feature F1.1, passo 6). **Sem o `await`, o toast de falha seria codigo morto e o switch poderia ficar ligado com o overlay caido**, exatamente o que o edge case abaixo proibe. Consequencia aceita e barata: no caminho feliz saem DOIS `TX_START` no inicio da transmissao (o do `applyLocalTxStart` com `pointers: false` e o reanuncio silencioso com `pointers: true`), sendo o segundo idempotente e sem som pelo contrato 5.C3.
4. Mesmo arquivo, `stopTransmission` (`media-manager.ts:535`): acrescentar `void window.zoi.pointerOverlay.hide()` e `cursorHub.setOverlayContext({ txId: null, enabled: false })` junto das demais limpezas, ANTES de `this.session.announceTransmissionStop(reason)`. Cobre os tres motivos (`manual`, `source_switch`, `leaving`) de uma vez, e portanto RF-10 e RF-11 por construcao.
5. Mesmo arquivo, `teardown` (`media-manager.ts:1104`): mesma limpeza, para o caso de sair da sala sem passar por `stopTransmission`.

**Edge cases** (categoria: servico de midia)
- `setPointersMode(true)` com `show` devolvendo `{ ok: false }`: nada e anunciado, `pointers` fica `false`, e a funcao devolve `false` para a UI reverter o switch e avisar. **Nunca deixar o switch ligado com o overlay caido.**
- `setPointersMode` chamado com o mesmo valor: `session.setTransmissionPointers` ja e idempotente (passo 3 de 5.C3) e o `show`/`hide` tambem sao. Nenhum efeito duplicado.
- `switchSource` de MONITOR para JANELA com os ponteiros ligados: `stopTransmission` derruba o overlay, e a transmissao nova nasce com `pointers: false` porque o modal desabilitou o toggle (RF-04 e RF-11 juntos).
- `switchSource` de MONITOR para outro MONITOR: mesma coisa; o toggle nasce desligado (RF-03) e o overlay so volta se o usuario ligar de novo, agora com o `displayId` novo. **Nenhuma coordenada antiga sobrevive**, porque o `txId` mudou e o `CursorHub` e escopado por `txId` (AC-13).
- Sair da sala (`leaving`) com o overlay no ar: `stopTransmission('leaving')` ja e disparado pelo efeito `stopLocalTransmission` do reducer (`room-state.ts:1504`, tratado em `session.ts:975-977`), e a limpeza do passo 4 pega junto.
- Transmissao encerrada pelo proprio sistema operacional (o usuario clica em "parar de compartilhar"): o listener de `ended` da track (`media-manager.ts:496-499`) ja chama `stopTransmission('manual')`, e a limpeza vai junto.

**Done when**
- `npm run typecheck`, `npm run lint` e `npx vitest run` verdes (`tests/unit/media-manager.test.ts` nao pode quebrar; os campos novos sao aditivos).
- **Exercicio real:** `npm run dev`, transmitir um MONITOR, e no DevTools chamar `await __zoiDebugMedia.pointers(true)` (gancho novo a acrescentar ao objeto de debug ja existente em `media-manager.ts:1153-1158`, ao lado de `sharpness`, `media-manager.ts:1155`): a janela de overlay sobe sobre o monitor certo. `await __zoiDebugMedia.pointers(false)` a derruba. Parar a transmissao com os ponteiros ligados derruba a janela sozinho. Registrar os tres resultados no relato.
- `grep` das quatro marcas de fallback: zero ocorrencias novas.

**Commit**: `feat(transmissao): liga o ciclo de vida do overlay de ponteiros a transmissao local`
**Rollback**: reverter o commit; a UI ainda nao chama `setPointersMode`.

---

## Frontend

> Antes de comecar: ler `.forge/ideas/viewer-cursors/UISPEC_viewer-cursors.md` inteiro e abrir as capturas em `ui-refs/`. A secao 6.2 desta SPEC diz exatamente o que procurar em cada secao do UISPEC. **Nao redefinir token, cor, raio, espacamento nem duracao: tudo ja esta contratado la.**

### Sprint F1 - Toggles e cor por pessoa

#### Feature F1.1 - Toggle de ponteiros no seletor de fonte `[frontend]`

**Traces**: RF-01, RF-03, RF-04, RNF-09.

**Steps**
1. `src/renderer/src/ui/components/SourcePickerModal.tsx`: acrescentar o estado local `const [pointers, setPointers] = useState(false)` junto de `withAudio` (`SourcePickerModal.tsx:38`). **Sempre `false` no mount**, e o modal so monta quando aberto (`SourcePickerModal.tsx:213`), o que ja e RF-03 inteiro.
2. Derivar `const pointersDisabled = selected === null || selected.kind === 'window'` (`selected` ja existe, `SourcePickerModal.tsx:59`) e `const pointersOn = pointers && !pointersDisabled`.
3. Inserir o novo `z-switch` dentro de `z-picker__options` (`SourcePickerModal.tsx:158`), **imediatamente DEPOIS do `audio-toggle`** (que termina na linha 175) e ANTES do `z-row-between` de Qualidade. Estrutura clonada byte a byte da do audio-toggle, trocando so os textos, o `data-testid` e o estado:
   - `className={pointersOn ? 'z-switch z-switch--on' : 'z-switch'}`
   - `role="switch"`, `aria-checked={pointersOn}`, `disabled={pointersDisabled}`, `data-testid="pointer-toggle"`
   - `onClick={() => setPointers((value) => !value)}`
   - `<span className="z-switch__track"><span className="z-switch__thumb" /></span>`
   - rotulo: `Mostrar os ponteiros de quem assiste`
   - `z-switch__hint`, com texto CONDICIONAL: quando `selected?.kind === 'window'`, `Disponivel apenas ao compartilhar um monitor inteiro.` (texto exato da IDEA, P1); caso contrario, `Voce ve na sua tela real onde cada pessoa esta apontando.`
   - **Nunca esconder o controle** (Don't do UISPEC secao 7 e RF-04).
4. `src/renderer/src/ui/screens/room.css`: acrescentar, logo depois de `.z-switch:hover` (`room.css:598-600`), a regra nova `.z-switch:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }` com um comentario curto dizendo que e a formula COMPLETA de `.z-btn:disabled` (`components.css:32-36`), **as tres declaracoes, incluindo o `transform: none`** que neutraliza qualquer deslocamento de hover ou de clique e que ela vale para o botao inteiro (trilho, thumb e rotulo esmaecem juntos), como a captura `05-z-switch-disabled-harness.png` mostra. Acrescentar tambem `.z-switch:disabled:hover { background: var(--bg-elevated); }` para o hover nao "acender" um controle desabilitado.
5. No `onConfirm` (`SourcePickerModal.tsx:78-84`), trocar o `pointers: false` fixo que a feature B1.2 deixou por `pointers: pointersOn`. `displayId: selected.displayId` fica como esta.
6. `src/renderer/src/ui/screens/RoomScreen.tsx`, `startTransmission` (`RoomScreen.tsx:154`): depois de `refreshLocalTransmission()`, se `choice.pointers === true` e `transmission.pointers === false`, mostrar `pushToast('warning', 'Nao foi possivel abrir a camada de ponteiros; a transmissao segue sem eles.')`. E o caminho de falha do `show` descrito na feature B3.2. Seguir o padrao dos dois avisos que ja estao ali (`RoomScreen.tsx:162-172`).

**Edge cases** (categoria: frontend / formulario)
- Nenhuma fonte selecionada ainda: o toggle aparece desabilitado (nao ha `kind` para decidir) com o hint neutro. O botao "Transmitir" ja e desabilitado por `!selected` (`SourcePickerModal.tsx:73`), entao o estado casa.
- Usuario liga o toggle na aba Monitores, depois troca para Janelas e seleciona uma janela: `pointersOn` vira `false` por derivacao (nao por efeito), o switch aparece desligado E desabilitado, e o `onConfirm` envia `false`. Voltar para um monitor traz o toggle de volta LIGADO, porque o estado `pointers` nao foi zerado - a derivacao e so de apresentacao. Isso e deliberado: o usuario nao perde a escolha por passear nas abas.
- Modal aberto em modo `switch` (troca de fonte): mesmo comportamento; o toggle nasce desligado tambem aqui, porque a transmissao resultante e nova (RF-03 e RF-11).
- Abrir e fechar o modal sem confirmar: nada persiste, o proximo mount nasce desligado.
- Texto do hint: pt-BR sem acento e sem travessao, conferido a olho.

**Done when**
- `npm run typecheck` e `npm run lint` verdes.
- **Exercicio real com render (GREEN tem dentes):** `npm run dev`, abrir o seletor de fonte e conferir, NA TELA: (a) na aba Monitores com um monitor selecionado, o toggle aparece LIGAVEL e desligado; (b) na aba Janelas com uma janela selecionada, o toggle aparece esmaecido com `cursor: not-allowed` e o hint "Disponivel apenas ao compartilhar um monitor inteiro."; (c) o esmaecimento pega trilho, thumb E rotulo juntos, igual a `ui-refs/05-z-switch-disabled-harness.png`. Anexar ou descrever o que foi visto no relato.
- Transmitir um monitor com o toggle LIGADO e ver a janela de overlay subir (a peca de main ja existe desde B3.1/B3.2).

**Commit**: `feat(ui): adiciona o toggle de ponteiros no seletor de fonte com estado desabilitado`
**Rollback**: reverter o commit; o `SourceChoice` volta a mandar `pointers: false` fixo e nada mais muda.

#### Feature F1.2 - Toggle de ponteiros na barra de transmissao `[frontend]`

**Traces**: RF-02, RF-04, RF-27, RF-30, RNF-09.

**Steps**
1. `src/renderer/src/ui/components/TransmittingBar.tsx`: acrescentar as props `pointers: boolean`, `pointersDisabled: boolean` e `onPointersChange: (next: boolean) => void` a `TransmittingBarProps` (`TransmittingBar.tsx:6-15`).
2. Inserir o novo botao **imediatamente depois do `sharpness-toggle`** (que termina na linha 50) e ANTES do botao "Trocar fonte" (linha 51), preservando a ordem esquerda-metadados / direita-acoes que o UISPEC (secao 4) registrou. Estrutura clonada do `sharpness-toggle`, com `z-switch z-switch--bar` (e `z-switch--on` quando ligado), `role="switch"`, `aria-checked`, `disabled={pointersDisabled}`, `data-testid="pointer-toggle-bar"`, rotulo `Ponteiros` e `title` explicando em uma frase: `Ligado, voce ve na sua tela real onde cada pessoa que assiste esta apontando.`
3. `src/renderer/src/ui/screens/RoomScreen.tsx`: acrescentar o estado `const [pointersOfTx, setPointersOfTx] = useState<{ txId: string; on: boolean } | null>(null)` ao lado de `sharpnessOfTx` (`RoomScreen.tsx:48`), com o MESMO comentario explicando por que o `txId` fica guardado junto do valor. Derivar `const pointers = pointersOfTx !== null && pointersOfTx.txId === localTxId && pointersOfTx.on` (espelho da linha 115).
4. Mesmo arquivo: criar `changePointers` no molde EXATO de `changeSharpness` (`RoomScreen.tsx:117-129`), mas `async`, porque `setPointersMode` devolve `Promise<boolean>`: se `localTxId` for nulo, retorna; chama `const ok = await mediaManager.setPointersMode(next)`; se `ok`, grava `setPointersOfTx({ txId: localTxId, on: next })`; se nao, grava `{ txId: localTxId, on: false }` e `pushToast('warning', 'Nao foi possivel abrir a camada de ponteiros agora.')`.
5. Mesmo arquivo: sincronizar o estado inicial quando a transmissao ja nasce com os ponteiros ligados (caminho de F1.1): logo apos `refreshLocalTransmission()` em `startTransmission` (`RoomScreen.tsx:161`), gravar `setPointersOfTx({ txId: transmission.txId, on: transmission.pointers })`. Assim o switch da barra ja nasce coerente com o do modal.
6. Mesmo arquivo: passar as tres props novas para `<TransmittingBar>` (`RoomScreen.tsx:206-213`), com `pointersDisabled={localTx.sourceKind === 'window'}`.

**Edge cases** (categoria: frontend / controle ao vivo)
- Transmissao de JANELA: o toggle da barra aparece desabilitado com a mesma formula visual do picker (a regra `.z-switch:disabled` da F1.1 ja vale, porque `z-switch--bar` nao redefine `opacity` nem `cursor`). Conferir NO RENDER que o esmaecimento e visivel sobre o fundo `--danger` solido, e nao apenas sobre superficie escura.
- Clique duplo rapido: `setPointersMode` e idempotente e `applyLocalTxPointers` corta valor repetido (5.C3 passo 3). A UI nao trava nem pisca.
- Transmissao trocada por `switchSource`: `localTxId` muda, a derivacao da linha 3 devolve `false` e o switch nasce desligado sozinho, sem efeito (RF-03/RF-11).
- Transmissao encerrada com o toggle ligado: `localTx` vira `null`, a barra some inteira e `stopTransmission` (B3.2 passo 4) ja derrubou o overlay.
- `setPointersMode` demorando (o `show` e `await`): o clique nao bloqueia a UI; o switch so muda quando a promessa resolve. Nao adicionar spinner: a operacao e local e leva milissegundos.

**Done when**
- `npm run typecheck` e `npm run lint` verdes.
- **Exercicio real com render:** `npm run dev`, transmitir um MONITOR com o toggle do modal DESLIGADO, e entao ligar o toggle da barra: a janela de overlay sobe **sem parar nem reiniciar a transmissao** (AC-03). Desligar de novo: a janela desce. Comparar as cores do switch com `ui-refs/02b-transmitting-bar-closeup.png` e confirmar que a escala e a mesma do `sharpness-toggle` (trilho 30x18, thumb 12 px).
- Transmitir uma JANELA e confirmar NO RENDER que o toggle da barra aparece esmaecido e nao clicavel.

**Commit**: `feat(ui): adiciona o toggle de ponteiros na barra de transmissao`
**Rollback**: reverter o commit; o controle do modal continua funcionando sozinho.

#### Feature F1.3 - Cor por pessoa na lista de participantes `[frontend]`

**Traces**: RF-21, RF-22, RF-23, RNF-05.

**Steps**
1. `src/renderer/src/ui/screens/RoomScreen.tsx`: criar UM `useMemo` que ja devolve o mapa de **cores prontas**, e nao de slots, junto dos demais `useMemo` (`RoomScreen.tsx:54-67`), importando de `@shared/person-colors`: `const personColors = useMemo(() => { const slots = resolvePersonSlots(room.members); const out: Record<string, PersonColor> = {}; for (const member of room.members) out[member.peerId] = colorOfSlot(slots[member.peerId] ?? 0); return out }, [room.members])`. **Memoizar so os SLOTS e chamar `colorOfSlot` dentro do `map` criaria um objeto de cor novo a cada render e anularia o `memo` do `ParticipantCard`** (`ParticipantCard.tsx:27`), re-renderizando todos os cards a cada render da sala.
2. Mesmo arquivo, no `map` que renderiza os cards (`RoomScreen.tsx:263-283`): passar `color={personColors[member.peerId]}` para `<ParticipantCard>`, ou seja a entrada JA memoizada, nunca uma chamada nova de `colorOfSlot`.
3. `src/renderer/src/ui/components/ParticipantCard.tsx`: acrescentar `color: PersonColor` a `ParticipantCardProps` (`ParticipantCard.tsx:10-25`) e aplicar no avatar (`ParticipantCard.tsx:65-67`): `style={{ background: color.soft, color: color.fill }}`. **Nao mexer em mais nada do card**: nem em classe, nem em tamanho, nem em peso, nem no conteudo `nickname.trim().charAt(0) || '?'`.
4. `src/renderer/src/ui/screens/room.css`, `.z-participant__avatar` (`room.css:226-238`): **manter `background: var(--accent-soft)` e `color: var(--accent-hover)` exatamente como estao.** Elas deixam de ser a cor efetiva e passam a ser o FALLBACK, porque o `style` inline do passo 3 vence a folha. **Nenhuma declaracao de valor muda aqui**; o que se acrescenta e SO um comentario dizendo tres coisas: que a cor efetiva vem de `@shared/person-colors` por `style` inline, que estas duas declaracoes ficam para o caso de um consumidor futuro esquecer a prop, e que a geometria (34x34, `flex: none`, raio 50%, peso 600, uppercase) e restricao a preservar, nao alvo de mudanca.
5. Conferencia final da regra de estabilidade do passo 1: `grep -n "colorOfSlot" src/renderer/src/ui/screens/RoomScreen.tsx` deve mostrar a chamada SO dentro do `useMemo`, nunca dentro do `map` do JSX. Se aparecer no `map`, o `memo` do `ParticipantCard` esta anulado.

**Edge cases** (categoria: frontend / lista)
- Membro que ainda nao esta em `personSlots` (corrida de render): `?? 0` da o slot 0. Nunca quebra, nunca fica sem cor.
- Nickname vazio ou so com espaco: o conteudo do avatar continua sendo `'?'`, exatamente como hoje; so a cor muda.
- Card do proprio usuario (`z-participant--self`): recebe cor igual a de qualquer outro. E o que faz a pessoa reconhecer a propria cor sem precisar apontar (mesmo nao vendo o proprio cursor, RF-14).
- Entrada de um membro novo: pela regra de 3/T1, ninguem que ja estava muda de cor. Conferir NO RENDER.
- Saida de um membro: um deslocado pode voltar a cor canonica. Conferir NO RENDER que a inicial continua legivel e que o card nao muda de tamanho (AC-22).
- Sala com 8 pessoas (limite): as 8 cores sao distintas. Conferir NO RENDER com o harness descartavel do passo abaixo.

**Done when**
- `npm run typecheck` e `npm run lint` verdes.
- **Exercicio real com render:** `npm run dev` e uma sala com pelo menos 3 instancias, conferindo NA TELA que as bolinhas tem cores DIFERENTES e que a inicial continua legivel em todas. Para cobrir o caso de sala cheia sem 8 maquinas, usar um harness DESCARTAVEL (precedente do `LESSONS.md` 2026-08-26, `black-screen-notice`): injetar temporariamente 8 membros ficticios em `room.members` no `RoomScreen`, fotografar, e **REVERTER** (conferindo `git diff` vazio antes do commit).
- Comparar com `ui-refs/04-participant-list-baseline.png` e `04b`: a geometria do card e do avatar tem que ficar identica, so a cor muda.

**Commit**: `feat(ui): aplica a cor por pessoa nas bolinhas da lista de participantes`
**Rollback**: reverter o commit; o avatar volta ao `--accent-soft`/`--accent-hover` do fallback do CSS.

---

### Sprint F2 - A camada de cursores

#### Feature F2.1 - Marcador de cursor e sua folha de estilo `[frontend]`

**Traces**: RF-06, RF-24, RF-25, RF-26, RNF-07, RNF-08.

**Steps**
1. `src/renderer/src/ui/theme.css`: acrescentar `--dur-cursor-glide: 32ms;` no bloco `:root`, junto de `--dur-fast`/`--dur-enter`/`--dur-screen` (linhas 55-58), com um comentario curto explicando a EXCECAO de 3/T6 (duracao abaixo do intervalo de 40 ms entre posicoes, easing `linear`, e por que os tokens normais nao servem). **Nao acrescentar este token ao bloco de `prefers-reduced-motion` (linhas 62-77)**: o `transition-duration: 0.001ms !important` do seletor universal ja zera a transicao, e duplicar a regra so daria a impressao errada de que a media query precisa ser tratada em JS.
2. Criar `src/renderer/src/ui/components/CursorMarker.tsx`, um componente `memo` com props `{ nickname: string; fill: string; idle: boolean }` e um `forwardRef` para o elemento raiz. **A prop e `fill: string`, e nao `PersonColor`**, porque o marcador nunca usa o `soft` (esse e do avatar) e porque a janela de overlay recebe so a cor de preenchimento pelo frame de IPC (contrato 5.B): com `PersonColor` a feature F2.3 nao conseguiria reusar este mesmo componente sem inventar um adaptador (o `ref` e como o `CursorHub` escreve `style.transform` sem passar por React, contrato 5.C6). Estrutura:
   - raiz `<span className="z-cursor" data-testid="cursor-marker">` (o `data-peer-id` e posto por quem monta, ver F2.2);
   - a seta: um `<svg className="z-cursor__arrow" width="18" height="18" viewBox="0 0 18 18">` com um `<path>` de ponteiro classico, `fill={fill}` e `stroke="#0e0b12"` com `strokeWidth={1.5}` e `strokeLinejoin="round"`. O contorno escuro e o que da separacao sobre QUALQUER quadro de video (UISPEC secao 6: nao ha precedente de "texto sobre video variavel" no app);
   - o nome: `<span className="z-cursor__name" style={{ color: fill, borderColor: fill }}>{nickname}</span>`.
3. Criar `src/renderer/src/ui/components/cursor.css`, importada por `CursorMarker.tsx` no mesmo padrao das demais folhas de componente:
   - `.z-cursor { position: absolute; top: 0; left: 0; pointer-events: none; will-change: transform; transition: transform var(--dur-cursor-glide) linear; display: flex; align-items: flex-start; gap: var(--space-1); }`. **`pointer-events: none` e obrigatorio**: sem ele a camada roubaria o `mousemove` do proprio player.
   - `.z-cursor__name { padding: 2px var(--space-2); border-radius: var(--radius-pill); background: #0e0b12d9; border: 1px solid; font-size: var(--text-meta); font-weight: 500; white-space: nowrap; max-width: 160px; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 2px 8px #00000099; }`. O fundo e `--bg-app` a 85%, e a cor do texto e o `fill` da pessoa: e o MESMO par de contraste ja tabelado em 3/T1 (pior caso 5.11:1), so que sobre o fundo cheio em vez do tint, o que so melhora.
   - Entrada: `@keyframes zCursorIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }` aplicada num filho `.z-cursor__body` com `animation: zCursorIn var(--dur-enter) var(--ease) both`. **A animacao de entrada NAO pode ficar no `.z-cursor` raiz**, porque o raiz tem o `transform` de posicao controlado pelo `CursorHub` e uma animacao de `transform` no mesmo elemento sobrescreveria a posicao.
   - Inatividade: `.z-cursor--idle { opacity: 0; transition: transform var(--dur-cursor-glide) linear, opacity var(--dur-enter) var(--ease); }`. Voltar de idle refaz o fade in pelo mesmo caminho.
   - Saida definitiva: `@keyframes zCursorOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.85); } }` com **NOME PROPRIO**, nunca a de entrada invertida (LESSONS 2026-08-26, `black-screen-notice`: animacao so REINICIA quando o `animation-name` muda; reverter uma animacao ja terminada faz o elemento saltar para o estado final).
   - Transicao coletiva de desligar (RF-27): a mesma `zCursorOut` aplicada a todos de uma vez pelo desmonte da camada; nao ha keyframe separado.
   - **Somente `transform` e `opacity` em todo o arquivo.** Proibido `filter`, `box-shadow` ANIMADO, `width`, `height`, `top`, `left` em qualquer transicao ou keyframe (o `box-shadow` estatico do `.z-cursor__name` e permitido justamente por ser estatico).
4. Nao definir `z-index` em lugar nenhum desta folha: o empilhamento e por ordem de fonte (UISPEC secao 4).

**Edge cases** (categoria: frontend / componente de apresentacao)
- Nickname muito longo: `max-width: 160px` mais `text-overflow: ellipsis`. Sem quebra de linha (`white-space: nowrap`), para o marcador nao mudar de altura enquanto se move.
- Cursor perto da borda direita ou de baixo: o nome pode passar do retangulo. Aceito nesta versao (o container tem `overflow: hidden`, entao o excedente e cortado e nao gera barra de rolagem). **Nao implementar reposicionamento espelhado**: acrescenta calculo por frame para um caso de borda.
- `prefers-reduced-motion: reduce`: a transicao de 32 ms e as duas animacoes sao zeradas pelo bloco global de `theme.css:62-77`. O marcador salta e aparece sem fade. Conferir NO RENDER com a media query forcada.
- Marcador desenhado exatamente sob a barra de `PlayerControls`: fica ocluido enquanto os controles estao visiveis. Consequencia ACEITA (UISPEC secao 4); nao inverter a ordem de fonte por causa disso.

**Done when**
- `npm run typecheck` e `npm run lint` verdes.
- **Exercicio real com render:** montar o `CursorMarker` num harness DESCARTAVEL (dois marcadores fixos sobre o `PlayerView`, com cores dos slots 1 e 7 da paleta) e fotografar sobre uma transmissao REAL, para conferir contraste sobre video claro e escuro; mover um deles por `style.transform` no DevTools e ver o deslize acontecer. **REVERTER o harness** e conferir `git diff` limpo antes do commit.
- `grep -n "filter\|box-shadow\|width\|height\|top\|left" src/renderer/src/ui/components/cursor.css` conferido a olho: nenhuma dessas propriedades dentro de `transition` ou `@keyframes`.

**Commit**: `feat(ui): adiciona o marcador de cursor com nome, deslize e animacoes de entrada e saida`
**Rollback**: apagar os dois arquivos novos; ninguem os monta ainda.

#### Feature F2.2 - Camada de cursores no player do espectador `[frontend]`

**Traces**: RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-18, RF-19, RF-20, RF-24, RF-26, RF-29, RNF-01, RNF-08.

**Steps**
1. Criar `src/renderer/src/ui/components/CursorLayer.tsx` com props `{ txId: string; enabled: boolean; videoRef: RefObject<HTMLVideoElement>; contentRectRef: RefObject<ContentRect | null>; members: RosterMember[]; selfPeerId: string }`. **A camada NAO mede nada por conta propria**: quem mede e o `PlayerView` (passo 3), e `contentRectRef` e exatamente aquele `useRef`, passado por referencia para o callback de frame ler sempre o valor mais recente sem causar re-render. Responsabilidades, nesta ordem:
   - assinar `cursorHub.subscribeRoster(txId, ...)` para saber QUAIS peers desenhar (baixa frequencia, unico `setState` do componente);
   - renderizar `<div className="z-cursor-layer" data-testid="cursor-layer">` com um `CursorMarker` por peer, cada um com `key={peerId}` e `data-peer-id={peerId}`, `nickname` de `nicknameOf` e `fill` do mapa de `resolvePersonSlots`/`colorOfSlot` (so o campo `fill`, coerente com a prop do marcador);
   - assinar `cursorHub.subscribeFrame(txId, ...)` e, no callback, escrever **direto no `ref`** de cada marcador: `element.style.transform = 'translate3d(' + (rect.left + entry.x * rect.width) + 'px,' + (rect.top + entry.y * rect.height) + 'px, 0)'`, e alternar a classe `z-cursor--idle`. **Proibido `setState` aqui** (RNF-01, contrato 5.C6).
   - **nunca renderizar `selfPeerId`** (RF-14, terceira rede de seguranca).
2. `src/renderer/src/ui/screens/player.css`: acrescentar `.z-cursor-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }`, junto das demais regras do player.
3. `src/renderer/src/ui/screens/PlayerView.tsx`: acrescentar a medida do retangulo de conteudo. Um `useRef<ContentRect | null>` mais uma funcao `measure()` que le `videoRef.current.getBoundingClientRect()` (o `<video>`, **nunca** `containerRef`) e `videoRef.current.videoWidth/videoHeight` e chama `contentRectOf`. `measure()` roda em: `loadedmetadata` do video, `resize` da janela, e no listener de `fullscreenchange` que **ja existe** (`PlayerView.tsx:229-235`) - o UISPEC (secao 8) registra que o retangulo muda exatamente nesse evento.
4. Mesmo arquivo: acrescentar `onMouseMove` e `onMouseLeave` no `<div className={classes}>` (`PlayerView.tsx:300`). O `onMouseMove` calcula `offsetX = event.clientX - videoRect.left` e `offsetY = event.clientY - videoRect.top` a partir do `getBoundingClientRect()` do `<video>`, chama `normalizedPointIn(contentRect, offsetX, offsetY)` e: com resultado nao nulo, `cursorHub.reportLocalPoint(x, y)`; com `null` (faixa preta, RF-17), `cursorHub.endLocal()`. `onMouseLeave` chama `cursorHub.endLocal()`.
5. Mesmo arquivo: um `useEffect` que mantem o contexto de envio sincronizado. **Corpo e dependencias ja escritos na forma FINAL** (o passo 6 acrescenta o sinal de foco, e deixar as deps sem ele fecharia uma closure velha e mataria RF-20 em silencio, que e a armadilha de snippet literal registrada no `LESSONS.md` de 2026-08-26): corpo `cursorHub.setSendContext({ txId, enabled: pointersEnabled && !pipActive && focused })`, deps `[txId, pointersEnabled, pipActive, focused]`, e no cleanup `cursorHub.setSendContext({ txId: null, enabled: false })` (que ja dispara o `CURSOR_END` do `txId` anterior, RF-18 e a desmontagem do player).
6. Mesmo arquivo: um `useEffect` com `window.addEventListener('blur', ...)` e `window.addEventListener('focus', ...)` (T10): `blur` chama `cursorHub.endLocal()` e marca um estado local `focused: false`; `focus` marca `true`. O `focused` e o MESMO que o passo 5 ja consome: declare o `const [focused, setFocused] = useState(true)` ANTES do efeito do passo 5, para as deps de la fecharem sobre o valor certo. **Nao usar `document.visibilitychange`** (armadilha documentada em `PlayerView.tsx:124-131` e no CONTEXT).
7. Mesmo arquivo: montar `<CursorLayer />` **entre o `<video>` e o `PlayerControls`**, no mesmo nivel dos overlays condicionais (UISPEC secao 4). Renderizar so quando `pointersEnabled && !pipActive`.
8. `src/renderer/src/ui/screens/RoomScreen.tsx`: passar as props novas para `<PlayerView>` (`RoomScreen.tsx:310-323`): `pointersEnabled={selected.pointersEnabled}`, `members={room.members}` e `selfPeerId={room.selfPeerId}`.

**Edge cases** (categoria: frontend / interacao)
- Mouse sobre a faixa preta do letterbox: `normalizedPointIn` devolve `null` e o ponteiro e ENCERRADO, nao clampado (RF-17, AC-16).
- Mouse sobre a barra de `PlayerControls` (que fica sobre o video): o evento borbulha ate `.z-player` e a coordenada continua valida, porque o ponto ESTA sobre conteudo real. Correto: o que ocorre e oclusao local, nao invalidez.
- Mouse sobre a miniatura da grade ou sobre o `TransmissionStatusCard`: **nenhum listener existe la** (RF-13, AC-15). Nao acrescentar nenhum.
- Video ainda sem `loadedmetadata` (`videoWidth === 0`): `contentRectOf` devolve `null` e nenhuma posicao e gerada.
- Entrar em fullscreen: `measure()` roda no `fullscreenchange` que ja existe; o retangulo novo passa a valer no proximo `mousemove`.
- Entrar em PiP: `enabled` cai para `false`, o efeito do passo 5 dispara o `CURSOR_END` e a camada some (T9).
- `.z-player--idle` (controles escondidos apos 3 s, `player.css:23-25`, `cursor: none`): o cursor LOCAL some da tela, mas o `mousemove` continua chegando e a posicao continua valendo. Nao mexer nisso.
- Espectador que troca de transmissao (A para B): o `key={selected.txId}` do `RoomScreen` (`RoomScreen.tsx:311`) ja remonta o `PlayerView` inteiro, entao o cleanup do passo 5 dispara o `CURSOR_END` de A antes de B comecar (RF-18, AC-17).
- Transmissor que desliga os ponteiros no meio: `selected.pointersEnabled` vira `false`, a camada desmonta com a animacao coletiva e o toast do contrato 5.C3 chega (RF-27, RF-28).

**Done when**
- `npm run typecheck` e `npm run lint` verdes.
- **Exercicio real com render, TRES instancias (Leo transmite, Bruna e Joao assistem), Playwright ou manual, sempre MUDO:** (a) Bruna move o mouse sobre o player e o cursor dela aparece **na tela do Joao** com o nome e a cor dela; (b) **a propria Bruna nao ve cursor nenhum** (AC-06, AC-07); (c) mover o mouse para a faixa preta faz o cursor sumir na tela do Joao (AC-16); (d) parar o mouse por 5 s faz o cursor esmaecer e voltar a mover faz ele reaparecer (AC-25); (e) o movimento DESLIZA, nao pula (AC-24). Registrar cada item no relato.
- Conferir com a media query de `prefers-reduced-motion` forcada no DevTools que o cursor SALTA em vez de deslizar (AC-38).
- `grep` das quatro marcas de fallback nos arquivos tocados: zero ocorrencias novas.

**Commit**: `feat(ui): desenha os cursores dos outros espectadores sobre o player`
**Rollback**: reverter o commit; o `CursorHub` continua existindo sem nenhum produtor nem consumidor de UI.

#### Feature F2.3 - Desenho dentro da janela de overlay do transmissor `[frontend]`

**Traces**: RF-06, RF-08, RF-15, RF-24, RF-25, RF-26, RNF-07, RNF-08.

**Steps**
1. `src/renderer/src/overlay/main.tsx`: trocar o placeholder da feature B3.1 pelo `OverlayApp` de verdade.
2. Criar `src/renderer/src/overlay/OverlayApp.tsx`: assina `window.zoi.pointerOverlay.onRender(frame => ...)`, guarda o ultimo frame num `useRef`, mantem em `useState` apenas a LISTA de `peerId` visiveis (baixa frequencia, mesmo criterio da F2.2) e escreve as posicoes direto nos `ref` dos marcadores. Reusa o MESMO `CursorMarker` da feature F2.1 (import de `../ui/components/CursorMarker`), com `nickname` e `fill` vindos prontos no frame (contrato 5.B), sem nenhum adaptador de tipo: a prop do marcador e o campo do frame tem o mesmo nome e o mesmo tipo (`fill: string`).
3. Como o overlay cobre o monitor inteiro e o conteudo compartilhado E o monitor inteiro (3/T4), a conversao e direta: `translate3d(x * window.innerWidth + 'px', y * window.innerHeight + 'px', 0)`. **Nenhum calculo de letterbox aqui.**
4. Criar `src/renderer/src/overlay/overlay.css` com `html, body, #root { background: transparent; margin: 0; height: 100%; overflow: hidden; }` e `.z-overlay { position: relative; width: 100vw; height: 100vh; pointer-events: none; }`. Importar `../ui/theme.css` (para os tokens e o bloco de `prefers-reduced-motion`) e `../ui/components/cursor.css`.
5. Nenhum estado de sala, nenhum PeerJS, nenhum acesso a `session` ou ao `CursorHub` aqui: esta janela so desenha o que chega pelo canal `pointer-overlay:render`.
6. Timeout de seguranca: se nenhum frame chegar por mais de `CURSOR_IDLE_MS * 2`, limpar todos os marcadores. E a terceira rede contra ponteiro preso (risco R5) no lado que o usuario mais ve.

**Edge cases** (categoria: frontend / segunda janela)
- Frame com lista vazia: todos os marcadores desmontam com a animacao de saida.
- Frame com um `peerId` novo: o marcador entra com a animacao de entrada.
- Frame com `idle: true`: o marcador ganha `z-cursor--idle` e esmaece, exatamente como no player.
- Janela criada e nenhum frame chegando (transmissao sem ninguem assistindo): tela transparente e vazia. Correto, e nao ha estado de "vazio" a desenhar: qualquer texto ali estaria por cima da tela real do usuario.
- `window.innerWidth/innerHeight` diferentes de `display.bounds` por causa de escala de DPI: as duas medidas estao no mesmo espaco de pontos, e a Sonda B (item 7) ja confirmou isso; a conversao por fracao nao depende de pixels fisicos.
- Redimensionamento por `display-metrics-changed`: o main reposiciona a janela e o proximo frame ja usa as medidas novas (a conversao le `window.innerWidth` a cada frame).

**Done when**
- `npm run typecheck`, `npm run lint` e `npm run build` verdes.
- **Exercicio real com render, DUAS maquinas ou duas instancias (Leo transmite um monitor com ponteiros ligados, Bruna assiste e aponta):** o cursor da Bruna aparece **sobre a tela real do Leo**, na cor e com o nome dela, no lugar certo, e desliza. Registrar no relato.
- **Prova da invariante RF-05/AC-05:** com o cursor da Bruna visivel sobre a tela do Leo, a Bruna **nao ve o proprio cursor** dentro do video que ela recebe. Conferir olhando a tela da Bruna, nao so o codigo.
- Clicar em qualquer ponto da tela do Leo enquanto o overlay esta no ar e ver o clique chegar ao aplicativo por baixo (AC-10).

**Commit**: `feat(overlay): desenha os cursores dos espectadores sobre a tela real de quem transmite`
**Rollback**: reverter o commit; a janela volta ao placeholder vazio da B3.1.

---

### Sprint T - Testes (DEFINIDOS aqui, ESCRITOS no sprint de testes)

Comandos: `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run test:e2e`.
**Toda execucao de Playwright roda MUDA**: os specs novos usam `launchInstance` do helper, que ja passa `--mute-audio` (`tests/e2e/helpers/zoi-app.ts:130`) e semeia `soundVolume: 0` (`:86`). Nenhum spec pode subir o app por outro caminho.

**T1. `tests/unit/geometry.test.ts` (NOVO)** - `@shared/geometry`, RF-19/AC-18:
- `contentRectOf(1104, 820, 1280, 720)` devolve `{ left: 0, top: 99.5, width: 1104, height: 621 }` (o exemplo trabalhado de 5.C4, o mesmo medido no UISPEC).
- Barras nas LATERAIS: `contentRectOf(1600, 600, 1280, 720)` devolve `top: 0` e `left` positivo.
- Proporcao identica: `left` e `top` iguais a 0.
- `null` para `0`, negativo, `NaN` e `Infinity` em cada um dos quatro argumentos.
- `normalizedPointIn` devolve `{ x: 0.35, y: 0.60 }` para o ponto `(386.4, 472.1)` do retangulo acima (tolerancia de `1e-6`).
- `normalizedPointIn` devolve `null` para um ponto na faixa preta (`offsetY = 50`) e para um ponto 1 px fora de cada uma das quatro bordas; devolve valor VALIDO exatamente nas quatro bordas.

**T2. `tests/unit/person-colors.test.ts` (NOVO)** - `@shared/person-colors`, RF-21/RF-22/RF-23/RNF-05:
- `hash32` e estavel: o mesmo `peerId` da o mesmo numero em duas chamadas, e dois `peerId` diferentes conhecidos dao numeros diferentes (fixture com valores literais, para pegar mudanca acidental de algoritmo).
- Determinismo entre "clientes": `resolvePersonSlots` com a MESMA lista embaralhada em outra ordem devolve o MESMO mapa (prova de AC-20 no nivel de unidade).
- Desempate: o exemplo trabalhado de 5.C5 (Bruna com 3, Joao deslocado para 4, Carla entrando sem mexer em ninguem).
- **Estabilidade contra entrada**: para 200 conjuntos gerados de 4 membros, acrescentar um 5o membro com `joinedAt` maior NUNCA muda o slot de nenhum dos 4. Este teste falha se alguem trocar o criterio de posse por lexicografico puro.
- **Nao ha colisao com a sala cheia**: para 200 conjuntos de 8 membros, os 8 slots resolvidos sao todos distintos.
- `resolvePersonSlots([])` devolve `{}`; com 11 membros a funcao TERMINA (guarda contra laco infinito).
- **Contraste**: para os 10 slots, a inicial (`fill`) contra o proprio fundo do avatar (`soft` composto sobre `#0e0b12`) da razao `>= 4.5`, e os valores batem com a tabela de 3/T1 dentro de `0.05`. O teste implementa luminancia relativa sRGB e composicao alpha; e a prova mecanica de RNF-05/RF-23/AC-22/AC-35.
- Nenhum slot cai na faixa de matiz de `--danger` (335 a 360 e 0 a 10).

**T3. `tests/unit/protocol.test.ts` (ESTENDER)** - RNF-03/AC-33:
- `isCursorMovePayload` aceita `{ txId: 'a', x: 0.3, y: 0.6 }`; rejeita `x: '0.3'`, `txId: ''`, `y` ausente, `null` e array.
- `isCursorMovePayload` **ACEITA** `x: 5` e `y: -1`: o guard e estrutural e a faixa e checada no `CursorHub`. O teste documenta essa fronteira de proposito.
- `isCursorEndPayload` aceita `{ txId: 'a' }`; rejeita `{ txId: '' }` e `{}`.
- `isTxStartPayload` aceita sem `pointers`, com `pointers: true` e com `pointers: false`; rejeita `pointers: 'sim'` e `pointers: 1`.
- `validateEnvelope` com `type: 'CURSOR_MOVE'` e payload valido devolve `ok: true`; com `type: 'CURSOR_SOMETHING'` devolve `reason: 'unknown_type'` (prova viva da compat de cliente antigo).
- `MESSAGE_TYPES` continua cobrindo o union inteiro (o teste existente que compara os dois nao pode quebrar) e nenhum outro enum mudou.

**T4. `tests/unit/room-state.test.ts` (ESTENDER)** - RF-27/RF-28/RNF-06/AC-26/AC-36:
- `TX_START` novo com `pointers: true` grava `pointersEnabled: true`; sem o campo grava `false`.
- **Toast na transicao**: com `selfWatchingTxId` igual ao `txId`, um segundo `TX_START` do MESMO remetente com `pointers: false`, vindo depois de um com `true`, devolve EXATAMENTE um efeito `showToast` de tom `warning`; **o mesmo `TX_START` repetido devolve `effects: []`** (a prova de RF-28, e o teste falha se alguem tirar o guard de transicao).
- Mesma transicao com `selfWatchingTxId` diferente: `effects: []`.
- Transicao `false -> true`: `effects: []`.
- Reanuncio continua PRESERVANDO `startedAt` e `status`, e continua nao mexendo em `selfWatchingTxId` (o teste que ja existe para isso nao pode quebrar).
- `LOCAL_TX_POINTERS`: sem transmissao local devolve `effects: []`; com transmissao de `sourceKind: 'window'` forca `false`; com o MESMO valor devolve `effects: []`; com valor novo devolve UM `broadcast` de `TX_START` com `pointers` correto e **nenhum `playSound`**.
- `viewerPeerIdsOf` com o exemplo trabalhado de 5.C2 devolve `['Bruna','Joao']`; com `txId` inexistente devolve `[]`.
- **RNF-06 explicito**: uma sequencia de eventos que inclui `LOCAL_TX_POINTERS` nao altera `selfWatchingTxId` nem o conjunto de chaves de `transmissions`.

**T5. `tests/unit/mesh.test.ts` (ESTENDER)** - RNF-01:
- `sendMany(['a','c'], msg)` numa malha com `a`, `b`, `c`: `a` e `c` recebem, `b` **nao**. O caso falha se a implementacao virar um `broadcast` disfarcado.
- O envelope entregue a `a` e a `c` e o **mesmo objeto** (prova de que serializou uma vez so).
- `sendMany([], msg)` nao entrega nada e nao lanca.
- `sendMany(['zzz'], msg)` com peer desconhecido nao lanca e nao entrega.
- `sendMany` para um par com canal ainda fechado ENFILEIRA, e a mensagem sai quando o canal abre (mesmo fake que os testes de fila ja usam).

**T6. `tests/unit/cursor-hub.test.ts` (NOVO)** - o coracao, com `vi.useFakeTimers()`. Regra para este arquivo: **cada caso precisa DISCRIMINAR**, isto e, falhar se a regra for invertida.
- **Preparo obrigatorio do ambiente** (senao o arquivo nem roda): o hub fala com DUAS superficies externas, e as duas precisam de dublagem. (a) A porta: um fake de `CursorSessionPort` com `getState`, `subscribe` e `sendCursor` espionado, injetado por `cursorHub.attach(fakePort)` no `beforeEach` e desligado com `cursorHub.dispose()` no `afterEach`. (b) `window.zoi.pointerOverlay.sendFrame`: o ambiente do Vitest nao tem `window.zoi`, entao o `beforeEach` instala `vi.stubGlobal('window', { zoi: { pointerOverlay: { sendFrame: vi.fn() } } })` ou equivalente no `globalThis`, e o `afterEach` desfaz. Um caso dedicado roda com o stub AUSENTE e prova que o hub nao lanca (a guarda `typeof window !== 'undefined' && window.zoi?.pointerOverlay` da feature B2.1).
- **Cadencia (RF-32/AC-30)**: com posicao mudando a cada tick, 1 000 ms produzem **exatamente 25** chamadas de `session.sendCursor`, nunca 26. O teste falha se alguem trocar o timer por envio direto no `mousemove`.
- **Coalescencia**: 10 `reportLocalPoint` dentro de uma janela de 40 ms produzem UM envio.
- **Sem movimento, sem envio (RF-30)**: com a mesma posicao repetida, nenhum envio depois do primeiro.
- **Destinatarios (RF-16/AC-08)**: `sendCursor` recebe exatamente a lista de 5.C2 (co-espectadores mais o transmissor, sem o proprio), e **nao** a sala inteira.
- **Toggle desligado (RF-30/AC-28)**: com `pointersEnabled: false` na transmissao, nenhum envio acontece por mais que o mouse se mova.
- **As oito checagens de 5c**, uma a uma: remetente fora do roster; `txId` inexistente; `pointersEnabled: false`; remetente que nao esta em `state.watching[from] === txId`; receptor que nao participa daquele `txId`; `x` fora de `[0,1]`; `from === selfPeerId`; e a segunda mensagem dentro de `CURSOR_RECEIVE_MIN_GAP_MS`. Em TODOS os casos a entrada nao e criada e **`closeConnection` nunca e chamado** (risco R8).
- **`CURSOR_END` e aceito sem a checagem de `watching`** (RF-18): um `CURSOR_END` de quem ja trocou de transmissao limpa o ponteiro.
- **Inatividade (RF-26/AC-25)**: sem posicao nova por `CURSOR_IDLE_MS`, a entrada fica `idle: true`; a posicao seguinte devolve `idle: false`.
- **Poda por roster (RF-29/AC-27)**: um `onState` sem aquele peer remove a entrada no mesmo tick.
- **Poda coletiva (RF-27)**: `pointersEnabled` virando `false` limpa TODAS as entradas daquele `txId` de uma vez, e so daquele.
- **Escopo por `txId`**: entradas de dois `txId` simultaneos nao se misturam, e `setSendContext` de um nao apaga o outro.
- **Frame agregado (T11)**: com 3 ponteiros ativos, cada tick de `POINTER_OVERLAY_FRAME_MS` chama `sendFrame` UMA vez com 3 itens, nao 3 vezes.
- **Sem timer ocioso**: sem ponteiro e sem envio, nenhum dos dois timers fica armado (prova de RNF-01 no caso mais comum, que e a sala parada).
- **Relogio para tras**: `lastAt > now` e tratado como idle e nao trava o ponteiro para sempre.

**T7. e2e (`tests/e2e/viewer-cursors.spec.ts`, NOVO, mais extensao do helper)**:
- Helper: acrescentar `pointerOverlayPage(instance, timeoutMs)` e `expectNoPointerOverlay(instance)` a `tests/e2e/helpers/zoi-app.ts` (contrato 3/T5), e um parametro `pointers?: boolean` a `TransmitOptions` (`zoi-app.ts:262-271`) que liga o `pointer-toggle` antes de confirmar, no mesmo molde do `withAudio` (`zoi-app.ts:288-292`).
- **AC-01**: abrir o seletor com um MONITOR selecionado e conferir `pointer-toggle` com `aria-checked="false"`.
- **AC-02/RF-04**: selecionar uma JANELA e conferir que `pointer-toggle` continua VISIVEL (`toBeVisible`) e tem o atributo `disabled`, com o hint "Disponivel apenas ao compartilhar um monitor inteiro." no texto. O teste falha se alguem esconder o controle.
- **AC-04/RF-03**: transmitir com `pointers: true`, parar, reabrir o seletor e conferir `aria-checked="false"` de novo.
- **AC-11/RF-07**: com uma transmissao ativa e os ponteiros DESLIGADOS, `expectNoPointerOverlay(leo)`.
- **AC-03/RF-02**: ligar `pointer-toggle-bar`, esperar `pointerOverlayPage` resolver, e conferir que `transmitting-bar` continua visivel (a transmissao nao reiniciou).
- **AC-12/RF-10**: parar a transmissao com os ponteiros ligados e conferir `expectNoPointerOverlay(leo)` (a janela desceu, sem orfa).
- **AC-06/AC-07/RF-14**: tres instancias (Leo transmite com ponteiros, Bruna e Joao assistem). **Antes do primeiro `page.mouse.move`, esperar o `watching` estabilizar**: a checagem (4) da matriz 5c so aceita posicao de quem ja anunciou `WATCHING_UPDATE`, e esse anuncio tem debounce de `WATCHING_UPDATE_DEBOUNCE_MS = 300` (`src/shared/config.ts:154`) mais tempo de rede, entao mexer o mouse cedo demais faz o teste flakear com toda posicao descartada em silencio. O sinal ja existe na UI e nao exige gancho novo: esperar o rotulo de "assistindo" da Bruna aparecer no card dela na tela do LEO (`participantCard(leo, 'Bruna')` contendo o texto de `watchingLabel`, mesmo dado que alimenta `room.watching`), com o timeout de sala do helper. So entao mover o mouse da Bruna sobre o player (`page.mouse.move` em dois pontos, como `wakePlayerControls` ja faz, `zoi-app.ts:344-351`) e conferir: na pagina do Joao existe `cursor-marker` com `data-peer-id` da Bruna; na pagina da propria Bruna, `page.getByTestId('cursor-marker')` tem contagem ZERO. **Este e o teste central da feature.**
- **AC-16/RF-17**: mover o mouse da Bruna para a faixa preta (um `y` proximo do topo da caixa do player) e conferir que o `cursor-marker` da Bruna desaparece da pagina do Joao.
- **AC-32/RNF-02**: `expectNoDirectionFallbacks([leo, bruna, joao])` no fim do spec, exatamente como os specs existentes ja fazem.
- Os 5 specs existentes continuam chamando `expectNoDirectionFallbacks` inalterados.

**T8. Checklist manual (o que teste local NAO prova, LESSONS 2026-08-26)**:
- **AC-05/RF-05, a invariante central**: com Leo transmitindo com ponteiros ligados e Bruna apontando, confirmar OLHANDO a tela da Bruna que o cursor dela **nao aparece dentro do video**. So um segundo par de olhos numa maquina real fecha isso; o e2e prova que o marcador nao e RENDERIZADO no DOM da Bruna, nao que ele nao esta nos PIXELS do video.
- **AC-09/RF-08**: maquina com DOIS monitores compartilhando so um: o overlay cobre somente o compartilhado.
- **AC-10/RF-09**: clicar atraves do overlay e o clique chegar ao aplicativo por baixo.
- **AC-30/RNF-01**: comparar `framesPerSecond` e `qualityLimitationReason` do `stats-monitor` numa sessao com e sem os ponteiros ligados, mesmo hardware e mesmo preset.
- **AC-41, metrica de sucesso**: numa sessao real do grupo, quem transmite localiza o ponto apontado em menos de 1 segundo e sem descricao por voz; ninguem relata ver o proprio cursor.
- **RF-31/AC-29**: jogo em tela cheia exclusiva engolindo o overlay: confirmar que a limitacao esta nas notas da release e que o app **nao tenta detectar** nada.
- **AC-33/RNF-03**: rodar uma versao anterior contra a nova e confirmar que a sala funciona, que o cliente antigo nao ve ponteiros e que a conexao nao cai.
- **AC-38/RNF-08**: ligar "reduzir movimento" no Windows de verdade (nao so a media query forcada no DevTools) e confirmar que o cursor salta.

---

## 8. Matriz de cobertura da PRD

33 requisitos funcionais (RF-01 a RF-33) e 11 nao-funcionais (RNF-01 a RNF-11) = **44 requisitos, 44 linhas. Sem orfaos.**

| Req | Onde e coberto |
|---|---|
| RF-01 | F1.1 passos 1 a 3 (o `z-switch` novo dentro de `z-picker__options`, nascendo desligado). Teste: T7 (AC-01) |
| RF-02 | F1.2 passos 1 a 6 (`z-switch--bar` ao lado do `sharpness-toggle`), B3.2 passo 1 (`setPointersMode` ao vivo, sem parar a transmissao). Teste: T7 (AC-03) |
| RF-03 | 2b.1 linha "Criar" (o modal so monta quando aberto, `SourcePickerModal.tsx:213`), F1.1 passo 1, F1.2 passo 3 (derivacao por `txId`, molde de `sharpnessOfTx`). **Nada e persistido em lugar nenhum** (5b: nenhuma chave nova em `AppSettings`). Teste: T7 (AC-04) |
| RF-04 | F1.1 passos 2 a 4 (desabilitado com `z-switch__hint` explicativo e a regra `.z-switch:disabled`), F1.2 passo 6, 5.C3 passo 2 (defesa no reducer), B3.2 passo 1 (defesa no `MediaManager`). Teste: T7 (AC-02, que exige o controle VISIVEL e desabilitado) |
| RF-05 | **S1.1, Sonda A** (precondicao); 5.C7 passo 4 (`setContentProtection` antes de `show`, e janela destruida se falhar); F2.3 Done when (prova visual do lado da Bruna). Risco R1. Verificacao final: T8, item 1 |
| RF-06 | F2.3 (o overlay desenha o `CursorMarker` com cor e nome sobre a tela real), B3.2 (ciclo de vida). Teste: T7 (AC-06) e T8 |
| RF-07 | B3.2 passos 1 e 3 (o `show` so acontece quando o toggle liga), 2b.3 linha "Criar". Teste: T7 (AC-11, `expectNoPointerOverlay` com a transmissao ativa e os ponteiros desligados) |
| RF-08 | **S1.1, Sonda B** (precondicao, itens 1, 2 e 4); 5.C7 passo 1 (resolucao do display e recusa explicita quando nao casa com varios monitores). Risco R11. Verificacao final: T8, item 2 |
| RF-09 | 5.C7 (`setIgnoreMouseEvents(true)` sem `forward`, mais `focusable: false`); S1.1, Sonda A item 5. Risco R12. Verificacao final: T8, item 3 |
| RF-10 | B3.2 passos 4 e 5 (limpeza em `stopTransmission` e `teardown`), B3.1 passo 3 (ganchos de `closed` e `before-quit`). Risco R2. Teste: T7 (AC-12) |
| RF-11 | B3.2 edge cases (`switchSource` e `stopTransmission` mais `startTransmission`, `media-manager.ts:594-597`: o `txId` muda, o overlay desce, o toggle nasce desligado e o `CursorHub` e escopado por `txId`), F1.2 edge cases |
| RF-12 | F2.2 passo 4 (o `mousemove` sobre `.z-player` ja e suficiente; nao ha nenhum controle de ativacao do lado do espectador em lugar nenhum desta SPEC). Teste: T7 (AC-14 pelo mesmo roteiro de AC-06) |
| RF-13 | F2.2 passo 4 (o unico listener de coordenada e o de `.z-player`) e F2.2 edge cases (nenhum listener em `StreamThumbnail.tsx` nem em `TransmissionStatusCard.tsx`, que nem tem elemento de video). **Guarda desta SPEC: nenhuma feature acrescenta captura de coordenada em outra superficie** |
| RF-14 | TRES redes independentes: 5.C2 (o proprio `peerId` fica fora da lista de destinatarios), 5c checagem (7) (posicao vinda de si mesmo e descartada), F2.2 passo 1 (`selfPeerId` nunca e renderizado). Testes: T6 e T7 (AC-07, contagem ZERO de `cursor-marker` na pagina de quem aponta) |
| RF-15 | F2.2 (a camada desenha os cursores dos OUTROS espectadores sobre o video), 5.C2 (co-espectadores estao na lista de destinatarios). Teste: T7 (AC-07) |
| RF-16 | 5.C2 (fan-out so para quem participa do `txId`), 5c linha "txId de OUTRA transmissao", 2b.2 (`entriesByTx` separado por `txId`). Teste: T6 (escopo por `txId`) |
| RF-17 | 5.C4 (`normalizedPointIn` devolve `null` fora do conteudo e **nunca clampa**), F2.2 passo 4 (`null` chama `endLocal`), F2.2 `onMouseLeave`, T9 (PiP tambem e "fora da area valida"). Testes: T1 e T7 (AC-16) |
| RF-18 | F2.2 passo 5 (cleanup do efeito dispara o `CURSOR_END` do `txId` anterior; o `key={selected.txId}` do `RoomScreen.tsx:311` ja remonta o player), contrato A3 (o `CURSOR_END` e aceito SEM a checagem de `watching`, justamente por isso). Teste: T6 |
| RF-19 | B1.1 passos 1 e 2 (`src/shared/geometry.ts`), 3/T4 (medir o `<video>`, nunca `.z-player`), F2.2 passos 3 e 4. Exemplo trabalhado com numeros reais em 5.C4. Teste: T1 (AC-18) |
| RF-20 | 3/T10 (`window` `blur`/`focus`, com a justificativa de por que `visibilityState` e inutilizavel aqui), F2.2 passo 6, mais a segunda rede do esmaecimento de 5 s (RF-26). Verificacao: T8 |
| RF-21 | 3/T1 inteiro (as quatro propriedades, a tensao resolvida e a tabela dos 10 slots), 5.C5, B1.1 passos 3 e 4. Testes: T2 (determinismo, estabilidade contra entrada, ausencia de colisao com a sala cheia) |
| RF-22 | F1.3 passos 1 a 5 (`ParticipantCard` recebe `PersonColor` e aplica em `background`/`color` do avatar, preservando a geometria). Teste: T7 nao cobre cor; a prova e o exercicio com render de F1.3 mais T2 |
| RF-23 | 3/T1, tabela de contraste (pior caso 5.11:1 contra 4.31:1 do app hoje), risco R10. Teste: T2 (contraste dos 10 slots, calculado, nao opinado) e AC-22 no exercicio com render de F1.3 |
| RF-24 | F2.1 passo 2 (o nome faz parte do proprio `CursorMarker` e existe enquanto o marcador existe; nao ha estado "so ao mover"). Verificado no exercicio com render de F2.1 e F2.2 |
| RF-25 | 3/T6 (transicao CSS de 32 ms linear, e a proibicao explicita de interpolar em JS), F2.1 passo 3 (`.z-cursor { transition: transform var(--dur-cursor-glide) linear }`), F2.1 passo 1 (o token). Verificado no exercicio com render de F2.2 (AC-24) |
| RF-26 | 2b.2 linha "Esmaecer", 5.C6 passo 9 (o `idle` sai do tick unico, sem timer novo), F2.1 passo 3 (`.z-cursor--idle`). Teste: T6 e o exercicio com render de F2.2 (AC-25) |
| RF-27 | 5.C3 (o reanuncio de `TX_START` com `pointers: false`), 5.C6 passo 3 (`onState` limpa TODAS as entradas do `txId`), F2.2 edge cases (a camada desmonta com a animacao coletiva), F2.1 passo 3 (`zCursorOut` com nome proprio). Teste: T4 e T6 |
| RF-28 | 3/T8 e 5.C3 (o toast sai da TRANSICAO `true -> false`, nunca da chegada da mensagem: reenvio de estado nao duplica). Teste: T4, com o caso explicito de repetir a mesma mensagem e esperar `effects: []` (AC-26) |
| RF-29 | 5.C6 passo 3 (`pruneAgainstRoster` no `onState`, que e assinatura de baixa frequencia), mais a rede do esmaecimento de 5 s. Teste: T6 (AC-27) |
| RF-30 | 5.C6 passos 4 e 6 (`setSendContext({ enabled: false })` para o `sendTimer` e nada e enviado), 5c (o receptor tambem descarta quando `pointersEnabled` e `false`). Teste: T6 (AC-28) |
| RF-31 `[WONT]` | **Explicitamente NAO implementado.** Guarda desta SPEC: nenhuma feature deste plano contem heuristica de deteccao de tela cheia exclusiva, e nenhuma reage a "o overlay nao apareceu". O unico tratamento e a linha nas notas da release (3/T3 e risco R9). Se um agente de implementacao sentir vontade de detectar sozinho, a resposta e nao. Verificacao: T8, item 6 |
| RF-32 | 5b (`CURSOR_SEND_INTERVAL_MS = 40`, ou seja 25 envios por segundo: dentro da faixa de 20 a 30 e **abaixo do teto**), 5.C6 passos 4 e 6. Teste: T6, com a prova numerica de exatamente 25 envios em 1 000 ms (AC-30) |
| RF-33 `[WONT]` | **Explicitamente NAO implementado.** Ultima linha da matriz 5c: nao existe API de input em lugar nenhum desta feature, o overlay tem `setIgnoreMouseEvents(true)` e `focusable: false`, e nenhum modulo importa biblioteca de input sintetico. Guarda explicita para os agentes de implementacao (AC-31) |
| RNF-01 | 3/T3 (fan-out seletivo em vez de broadcast), 3/T6 (zero laco de rAF), 3/T7 (posicoes fora do reducer, zero re-render a 25 Hz), 3/T11 (frame agregado no IPC), 5.C6 (dois timers, e nenhum deles armado quando nao ha nada a fazer). Risco R4. Verificacao: T6 (sem timer ocioso) e T8, item 4 (comparacao de `framesPerSecond` no `stats-monitor` existente, sem harness novo) |
| RNF-02 | Risco R6 (prefixo `[pointer]` obrigatorio e proibicao das quatro marcas), `grep` mecanico no Done when de B1.2, B2.1, B2.2, B3.1, B3.2 e F2.2; T7 mantem `expectNoDirectionFallbacks` nos 5 specs existentes e o acrescenta ao spec novo. **Nenhum arquivo de fallback de direcao e alterado** (2.5) |
| RNF-03 | 5.A4 (comportamento verificado na linha exata `protocol.ts:463`, com o texto que vai para as notas da release), 3/T3. Teste: T3 (`unknown_type`) e T8, item 7 (duas versoes em campo) |
| RNF-04 | 2.5 (lista explicita do que NAO se toca: `TransmissionStatusCard.tsx`, `audio-exclusion.ts`, `first-frame-watch.ts`, `stats-monitor.ts`, `reconnection.ts`, `media-manager.ts` no que toca watchdog e codec). Verificacao: `npx vitest run` e `npm run test:e2e` verdes no Done when de toda feature (AC-34) |
| RNF-05 | 3/T1 (tabela de contraste calculada), F1.3 passos 3 e 4 (so `background` e `color` mudam; a geometria e restricao), risco R10. Teste: T2 (AC-35) |
| RNF-06 | 3/T7: como nenhuma posicao entra no reducer, o carimbo de `txId` **nao tem como** tocar `transmissions` ou `selfWatchingTxId`. Reforco: 5.A5 (nenhum campo novo em `RoomState`). Teste: T4, caso explicito de RNF-06 (AC-36) |
| RNF-07 | F2.1 passo 3 (somente `transform` e `opacity` em toda a folha; `box-shadow` so estatico), 3/T6 (nenhum laco continuo), 5.C6 (dois timers e nenhum rAF). Verificacao mecanica no Done when de F2.1 (AC-37) |
| RNF-08 | 3/T6: a escolha da transicao CSS faz o bloco global de `theme.css:62-77` zerar a interpolacao sozinho, e a SPEC **proibe** interpolar em JS. F2.1 passo 1 (o token nao entra no bloco de reduced motion) e F2.1 edge cases. Verificacao: exercicio com render de F2.2 e T8, item 8 (AC-38) |
| RNF-09 | Todas as strings novas estao escritas por extenso nesta SPEC (F1.1 passo 3, F1.2 passo 2, 5.C3 toast, F2.3), em pt-BR sem acento e sem travessao; conferidas a olho no Done when de F1.1 e F1.2 (AC-39) |
| RNF-10 | `npm run typecheck`, `npm run lint` e `npx vitest run` no Done when de TODA feature; `npm run build` no Done when de B3.1 e F2.3; `npm run test:e2e` no Sprint T (AC-39) |
| RNF-11 | **Sprint S1 inteiro**, declarado como PRECONDICAO em 2.2 e no cabecalho do sprint, com a regra de parar e voltar para conversa em 2.2, em 3/T2 e nos riscos R1 e R3 (AC-40) |

---

## 9. Premissas e questoes em aberto

**[ASSUMPTION A1] O `getDisplayMedia` ESCALA a captura do monitor em vez de preencher com barras.** E o que sustenta a decisao de 3/T4 de o overlay do transmissor nao precisar de calculo de letterbox: se a captura preenchesse, a coordenada normalizada nao mapearia direto para o monitor. **Nao fica como premissa aberta: e o item 8 da Sonda B**, que compara a proporcao de `videoWidth`/`videoHeight` da track com a de `display.bounds` e exige que batam dentro de 1%. Se nao bater, a Sonda B falhou e o pipeline para (nao ha remendo previsto).

**[ASSUMPTION A2] `window.blur` dispara no renderer quando a janela do Electron e minimizada no Windows.** E o sinal escolhido em 3/T10 para RF-20. **Consequencia se estiver errada, ja desenhada:** o envio para sozinho de qualquer jeito (posicao so e enviada quando MUDA, e janela minimizada nao recebe `mousemove`), e o ponteiro some em 5 s por RF-26 em vez de imediatamente. Degradacao suave, nunca ponteiro preso. Nao bloqueia nada e e confirmada ou refutada no primeiro uso real.

**[ASSUMPTION A3] `display.bounds` e `BrowserWindow.setBounds` usam o mesmo espaco de coordenadas em pontos, independente da escala de DPI.** **Nao fica como premissa aberta: e o item 7 da Sonda B**, que reposiciona a janela para cada display e confere pelo `screen.getDisplayMatching` que o id que volta e o pedido.

**[ASSUMPTION A4] Uma transicao CSS de 32 ms encadeada a cada 40 ms produz movimento continuo aceitavel.** O raciocinio esta em 3/T6 (a transicao FECHA antes do proximo update chegar, e o easing `linear` emenda os trechos sem degrau). Sob jitter de rede, um pacote atrasado faz o marcador ficar parado ate o proximo em vez de extrapolar. Isso e deliberado: extrapolar significaria prever posicao, e uma previsao errada faz o cursor apontar para o lugar errado, que e pior do que atrasar. Calibravel por uma linha (`--dur-cursor-glide`).

**[ASSUMPTION A5] Uma segunda `BrowserWindow` transparente com `backgroundThrottling: false`, desenhando ate 7 marcadores por `transform` a 30 Hz, tem custo desprezivel ao lado da codificacao de video.** Base: nao ha imagem, nao ha video, nao ha laco de layout (so `transform`, que fica no compositor). Verificacao real: T8, item 4 (comparacao de `framesPerSecond` do `stats-monitor` com e sem os ponteiros ligados). Se aparecer custo, o primeiro degrau de ajuste ja esta identificado e e uma constante: subir `POINTER_OVERLAY_FRAME_MS`.

**[OPEN Q1] O numero exato de 25 envios por segundo.** `CURSOR_SEND_INTERVAL_MS = 40` foi escolhido por ficar dentro da faixa de RF-32 (20 a 30) com folga em relacao ao teto e por ser um divisor limpo de 1 000. A sessao real do grupo pode mostrar que 20/s (50 ms) ja parece igualmente fluido e economiza trafego. Nao bloqueia nada: e uma constante em `src/shared/config.ts`, num lugar so, e o teste T6 verifica a cadencia RESULTANTE, nao o numero literal.

**[OPEN Q2] Discriminacao perceptual dos 10 matizes em telas reais.** A tabela de 3/T1 garante CONTRASTE (medido) e separacao de MATIZ (32 graus entre vizinhos, calculada), mas a percepcao de "essas duas cores sao a mesma?" depende do monitor de cada pessoa, sobretudo entre os slots 6, 7 e 8 (azul, azul-violeta e roxo), que e onde a discriminacao humana e mais fraca. Nao bloqueia: a paleta e uma lista literal de 10 pares, e trocar um `hue` e uma linha. Reavaliar depois da primeira sessao real com 5 ou mais pessoas.

**[OPEN Q3] Nome do cursor cortado perto da borda direita ou inferior.** F2.1 decide NAO implementar reposicionamento espelhado, porque isso acrescentaria calculo por frame para um caso de borda. O container tem `overflow: hidden`, entao o excedente e cortado sem quebrar layout. Se em campo isso incomodar, a correcao natural (inverter o lado do rotulo quando `x > 0.85`) e local ao `CursorMarker` e nao mexe em contrato nenhum.

**[OPEN Q4] Compartilhamento de JANELA continua fora de escopo (IDEA secao 3, PRD secao 3).** `src/shared/geometry.ts` foi posto em `@shared` justamente pensando nisso (3/T4), mas nenhuma linha desta SPEC prepara a perseguicao da janela em movimento. Nao e divida tecnica escondida: e escopo declarado.

### Inventario de arquivos

**17 arquivos NOVOS**: `scripts/pointer-probe.mjs`; `.forge/ideas/viewer-cursors/SPIKE-RESULTS_viewer-cursors.md`; `src/shared/geometry.ts`; `src/shared/person-colors.ts`; `src/renderer/src/services/cursor-hub.ts`; `src/main/pointer-overlay.ts`; `src/renderer/overlay.html`; `src/renderer/src/overlay/main.tsx`; `src/renderer/src/overlay/OverlayApp.tsx`; `src/renderer/src/overlay/overlay.css`; `src/renderer/src/ui/components/CursorMarker.tsx`; `src/renderer/src/ui/components/CursorLayer.tsx`; `src/renderer/src/ui/components/cursor.css`; `tests/unit/geometry.test.ts`; `tests/unit/person-colors.test.ts`; `tests/unit/cursor-hub.test.ts`; `tests/e2e/viewer-cursors.spec.ts`.

**24 arquivos MODIFICADOS**: `package.json`; `electron.vite.config.ts`; `src/shared/protocol.ts`; `src/shared/ipc.ts`; `src/shared/config.ts`; `src/preload/index.ts`; `src/main/index.ts`; `src/main/ipc-handlers.ts`; `src/renderer/src/core/room-state.ts`; `src/renderer/src/services/session.ts`; `src/renderer/src/services/mesh.ts`; `src/renderer/src/services/media-manager.ts`; `src/renderer/src/ui/components/SourcePickerModal.tsx`; `src/renderer/src/ui/components/TransmittingBar.tsx`; `src/renderer/src/ui/components/ParticipantCard.tsx`; `src/renderer/src/ui/screens/RoomScreen.tsx`; `src/renderer/src/ui/screens/PlayerView.tsx`; `src/renderer/src/ui/screens/room.css`; `src/renderer/src/ui/screens/player.css`; `src/renderer/src/ui/theme.css`; `tests/e2e/helpers/zoi-app.ts`; `tests/unit/protocol.test.ts`; `tests/unit/room-state.test.ts`; `tests/unit/mesh.test.ts`.

Total: **41 arquivos**, em **7 sprints** (S1, B1, B2, B3, F1, F2, T) e **13 features** de implementacao mais 8 grupos de teste definidos no Sprint T.

### Self-check

Reli a SPEC do ponto de vista de um agente de implementacao com contexto limpo, conhecendo apenas SPEC, CONTEXT e UISPEC, perguntando feature a feature "eu conseguiria implementar isto sem fazer uma unica pergunta?". Buracos encontrados e **corrigidos durante a redacao**:

1. **`SourceChoice` sem os campos novos quebraria o typecheck no meio do backend.** `RoomScreen.tsx:154-160` passa o `SourceChoice` direto para `mediaManager.startTransmission`, entao tornar `pointers` e `displayId` obrigatorios em `StartTransmissionOptions` derruba o typecheck antes de o frontend existir. Corrigido: a feature B1.2 ganhou o passo 10, que acrescenta os dois campos a `SourceChoice` com `pointers: false` fixo; o CONTROLE visual so entra em F1.1.
2. **`--dur-cursor-glide` era usado sem nunca ser criado.** Corrigido: F2.1 ganhou o passo 1, que acrescenta o token em `theme.css` e explica por que ele NAO entra no bloco de `prefers-reduced-motion`.
3. **A animacao de entrada colidiria com o `transform` de posicao.** Um `@keyframes` que anima `transform` no MESMO elemento que o `CursorHub` posiciona por `style.transform` sobrescreveria a posicao. Corrigido: F2.1 passo 3 poe a animacao de entrada num filho `.z-cursor__body`, nunca no raiz.
4. **A animacao de saida seria a de entrada invertida.** Corrigido antes de virar codigo, aplicando a licao de `LESSONS.md` (2026-08-26, `black-screen-notice`): `zCursorOut` tem NOME PROPRIO.
5. **`ParticipantCard` e `memo` e receberia um objeto de cor novo a cada render**, anulando a memoizacao e re-renderizando todos os cards. Corrigido: F1.3 passo 5 exige memoizar o mapa `peerId -> PersonColor` inteiro.
6. **`rejectFrom` fecharia a conexao ao receber posicao de nao-membro.** Um efeito colateral aceitavel a 1 mensagem por evento vira desastre a 25 por segundo. Corrigido e travado: risco R8, 3/T7 e a matriz 5c dizem, nos tres lugares, que posicao nunca passa pelo reducer e nunca gera `closeConnection`.
7. **Janela orfa de overlay** por causa de `window-all-closed` (`src/main/index.ts:150-155`) so disparar quando TODAS as janelas fecham. Corrigido: risco R2 e B3.1 passo 3 (ganchos de `closed` e `before-quit`), com exercicio proprio no Done when.

Verificacoes mecanicas feitas ao final:
- **Todo caminho de arquivo citado existe** no `HEAD` `39dbc8d44e177aa2667388d16497b452b2de7910` (os que nao existem estao marcados como NOVOS no inventario acima).
- **Todos os numeros de linha citados foram conferidos por leitura no `HEAD` desta SPEC.** A revisao de contexto limpo recontou 47 citacoes e encontrou 7 erradas mais um punhado de faixas que terminavam uma linha depois do fim real; **todas foram corrigidas nesta revisao** (`isTxStartPayload` 347-362, `setSharpnessMode` 562-587, o gancho de debug 1153-1158 com `sharpness` em 1155, `isSelfSelected` 74, `changeSharpness` 117-129, o toggle de audio do helper 288-292, `rollupOptions.input` 46, `send` 267-274, `broadcast` 277-288, `viewersOf` 290-296, `rejectFrom` 733-744, `LocalTransmission` 55-68, `reduce` 366-400, e o flag da porta reapontado de `peer-manager.ts:218` para `doorWarned` em `session.ts:219`). Formulacao honesta do que esta garantido AGORA: cada citacao foi lida no arquivo e reconferida apos a correcao, e a lista abaixo e a superficie que um revisor precisa recontar para invalidar esta afirmacao: `protocol.ts` 6-21, 137, 142-144, 177-193, 255-271, 347-362, 373-375, 410-426, 460-481, 463; `mesh.ts` 257-264, 267-274, 277-288; `session.ts` 131, 188, 204, 219, 360-362, 481-483, 486-496, 509, 899, 900-910, 911, 916-940, 942, 975-977, 1074-1075, 1083-1084, 1149-1153, 1159, 1195; `room-state.ts` 47-59, 145, 216-227, 255-273, 282, 290-296, 325-329, 352, 366-400, 421, 564-623, 569-591, 574-591, 594-610, 626-650, 733-744, 1397-1437, 1504; `media-manager.ts` 40-46, 55-68, 428, 496-499, 535, 562-587, 589, 594-597, 677-694, 1104, 1144, 1145, 1147-1149, 1153-1158; `admission.ts` 73; `capture.ts` 29, 47, 49; `ipc.ts` 4-19, 61, 63, 142-185; `main/index.ts` 68, 74, 129, 143-147, 150-155; `preload/index.ts` 27-77, 68-76, 86-88; `PlayerView.tsx` 124-131, 194, 229-235, 275-289, 300, 309-317; `RoomScreen.tsx` 48, 54-67, 74, 115, 117-129, 154-160, 161, 206-213, 263-283, 310-323, 311; `SourcePickerModal.tsx` 11-17, 38, 59, 73, 78-84, 158, 159-175, 213; `TransmittingBar.tsx` 6-15, 50, 51; `ParticipantCard.tsx` 10-25, 27, 64, 65-67; `room.css` 206-216, 226-238, 578-643, 598-600, 652-688; `player.css` 12, 17-20, 23-25, 27-33; `theme.css` 21, 55-58, 62-77; `components.css` 32-36, 196-199; `screens.css` 552-563; `config.ts` 154, 158; `app-store.ts` 89-94; `zoi-app.ts` 50, 86, 130, 142, 262-271, 288-292, 327-341, 344-351; `electron.vite.config.ts` 46.
- **Toda regra quantitativa carrega exemplo trabalhado**, e os passos implementam esse mesmo modelo: letterbox (5.C4, caixa 1104x820 com faixa de 99,5 px e o par `0.35 / 0.60`), desempate de cor (5.C5, Bruna fica com 3 e Joao vai para 4), destinatarios (5.C2, dois envios e nao quatro), cadencia (5b/T6, exatamente 25 envios em 1 000 ms), contraste (3/T1, os 10 valores tabelados contra a referencia de 4.31:1 de hoje).
- **Toda mensagem e todo canal novos aparecem na matriz 5c**: `CURSOR_MOVE`, `CURSOR_END`, o campo `pointers` do `TX_START`, e os quatro canais de IPC (`pointer-overlay:show`, `:hide`, `:frame`, `:render`), mais a linha explicita de RF-33.
- **Cobertura sem orfaos**: 33 RF mais 11 RNF = 44 requisitos, 44 linhas na matriz da secao 8.
- **Zero caracteres acentuados e zero travessoes** neste documento, conferido mecanicamente.
- **Todos os fingerprints da secao 1 estao completos** (40 caracteres para `git hash-object`, 64 para os dois sha256 citados), nenhum truncado.

### Rodada de revisao (contexto limpo) - NEEDS-CHANGES atendido

Uma revisao independente releu esta SPEC contra o codigo, reconferiu 47 citacoes de linha e recalculou a tabela de contraste dos 10 slots (bateu ao centesimo). Duas apostas de risco foram CONFIRMADAS no codigo e ficam registradas aqui como fundamento, nao como premissa: (a) `joinedAt` e atribuido UMA unica vez pelo dono (`admission.ts:73`, a partir de `context.now`; `room-state.ts:421` para o proprio dono) e replicado a sala inteira por `ROSTER_UPDATE` (`room-state.ts:352`), ou seja e um relogio unico por sala e `election.ts` ja depende dessa mesma ordenacao, o que sustenta RF-21(i) e o desempate de 3/T1; (b) `theme.css:62-77` zera `transition-duration: 0.001ms !important` em `*`, `*::before` e `*::after`, e nao apenas `animation-duration`, o que sustenta 3/T6 e faz RNF-08 sair sem `matchMedia`.

O que a revisao apontou e foi corrigido nesta versao:

1. **(BLOCKER) Ciclo de import e ordem impossivel entre B2.1 e B2.2.** A versao anterior fazia `session.ts` importar `cursorHub` numa feature em que `cursor-hub.ts` ainda nao existia, e mandava o proprio `cursor-hub.ts` importar `session` e chamar `attach(session)` em escopo de modulo, o que bateria em TDZ no `export const session = new Session()` (`session.ts:1195`). Corrigido pelo padrao que o projeto JA usa para midia: o Sprint B2 ganhou uma regra de dependencia explicita, `cursor-hub.ts` passou a nascer na feature **B2.1** declarando a sua propria porta estrutural `CursorSessionPort` (contrato 5.C6) e **sem importar `session.ts`**, e a ligacao virou a feature **B2.2**, com `CursorHooks`/`noopCursorHooks`/`setCursorHooks` (contrato 5.C6b, molde literal de `MediaHooks` em `session.ts:131`, `:188`, `:204`, `:360-362`) e um unico ponto de wiring no rodape de `media-manager.ts` (`:1145`), que e onde `session.setMediaHooks(mediaManager)` ja mora. O Done when de B2.2 exige a prova mecanica por `grep` de que nenhum dos dois arquivos importa o outro.
2. **(WARNING) O caminho de falha do overlay era codigo morto.** A transmissao nascia com `pointers: true` e o `show` era disparado com `void`, entao o `RoomScreen` lia `true` antes de a promessa resolver e o toast de falha nunca disparava. Corrigido em B1.2 passo 8, B3.2 passo 3 e na linha "Criar" de 2b.1: a transmissao nasce SEMPRE com `false` e o `setPointersMode(true)` e **`await`**, so gravando `true` quando o `show` responde `ok`.
3. **(WARNING) `CursorLayer` usava um `rect` que nao estava nas props.** Corrigido: F2.2 passo 1 declara `contentRectRef: RefObject<ContentRect | null>` e diz que a camada nao mede nada sozinha.
4. **(WARNING) Array de dependencias desatualizado** entre os passos 5 e 6 de F2.2, armadilha de snippet literal (LESSONS 2026-08-26). Corrigido: o passo 5 ja traz corpo e deps na forma final, com `focused`, e o passo 6 manda declarar o estado antes.
5. **(WARNING) F1.3 passos 1 e 2 contradiziam o passo 5.** Corrigido: o passo 1 ja memoiza o mapa `peerId -> PersonColor` pronto, o passo 2 le a entrada memoizada, e o passo 5 virou a conferencia por `grep`.
6. **(WARNING) Tipo do `color` incompativel entre F2.3 e F2.1.** Corrigido escolhendo UMA forma: a prop do `CursorMarker` e `fill: string` e o campo do frame de IPC foi renomeado de `color` para `fill` (contrato 5.B), entao a janela de overlay reusa o componente sem adaptador.
7. **(WARNING) Janela de descarte silencioso no `watching`.** Registrada em 5c com o numero real (`WATCHING_UPDATE_DEBOUNCE_MS = 300`, `config.ts:154`) e enderecada onde importa: o caso AC-06/AC-07 do Sprint T agora espera o rotulo de "assistindo" aparecer antes do primeiro `page.mouse.move`.
8. **(WARNING) Ordem contraditoria entre a secao 6.2 e o Don't numero 4 do UISPEC.** Corrigido em 6.2, que agora declara com todas as letras que aquele Don't fica SUPERADO por 3/T6, explica por que (o `theme.css` zera transicao, nao so animacao), e diz o que continua valendo dele (se alguem trocar para rAF, o `matchMedia` volta a ser obrigatorio, por isso rAF esta proibido).
9. **(WARNING) O self-check afirmava mais do que entregava.** As 7 citacoes erradas e as faixas que terminavam uma linha depois do fim real foram corrigidas, e a frase foi reescrita para algo sustentavel (ver o item de numeros de linha acima).
10. **(NITs)** Corrigidos: `#b53dff` deixou de ser descrito como "exatamente `--accent-hover`" (o token real e `#b23dff`) e a referencia de contraste passou de 4.36:1 para os **4.31:1** reais, em todas as 5 ocorrencias; F1.1 passo 4 passou a citar a formula COMPLETA de `.z-btn:disabled`, com o `transform: none`; 3/T3 e 5.C2 agora dizem que `viewerPeerIdsOf` itera `Object.entries` e nao `Object.values` como `viewersOf`, com o aviso de que copiar devolveria txIds; F1.3 passo 4 foi reescrito para "manter as duas declaracoes e so acrescentar comentario", em vez da instrucao que nao mudava nada; 5.C3 passo 4 ganhou a conversao obrigatoria `videoCodec: transmission.videoCodec ?? undefined` (`VideoCodecId | null` em `room-state.ts:57-58` contra `string | undefined` em `protocol.ts:121-135`), sem a qual o guard rejeitaria o reanuncio inteiro; e T6 ganhou o preparo de ambiente obrigatorio (fake de `CursorSessionPort` mais stub de `window.zoi.pointerOverlay`, e um caso que roda SEM o stub para provar a guarda).

**Sem cascata**: nenhuma correcao acima muda a PRD nem o UISPEC. O unico ponto em que esta SPEC diverge do UISPEC (o Don't numero 4) esta declarado como divergencia deliberada em 6.2, com a justificativa verificada no `theme.css`.

**Self-check: PASS** (7 buracos encontrados na propria redacao e 10 itens da revisao de contexto limpo, todos corrigidos antes de o documento ser fechado).
