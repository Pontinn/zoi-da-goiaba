---
feature: p2p-screen-share-mvp
language: pt-BR
generated: 2026-08-24
stack: Electron + TypeScript + electron-vite + React + Zustand + PeerJS (WebRTC mesh) + electron-builder (NSIS) + electron-updater
status: spec
prd_source: PRD_p2p-screen-share-mvp.md @ 82E318F28C519D52A452E2E01243C30715C56A03A36CCDD3BBCC3C8E7F487662
---

# SPEC - p2p-screen-share-mvp (Zói da Goiaba)

Este documento e ao mesmo tempo o desenho tecnico (COMO) e o plano executavel da implementacao. A PRD define O QUE; qualquer conflito se resolve a favor da PRD. A identidade visual e definida pelo UISPEC; a secao de Frontend REFERENCIA o UISPEC, nunca redefine tokens ou componentes inline.

Regras transversais (nao negociaveis):
1. Pilares de prioridade: (1) performance do app e (2) qualidade da tela compartilhada vencem qualquer trade-off. UI moderna e animada, mas animacoes sao GPU-only (transform/opacity) conforme UISPEC secao 2 (Movimento).
2. Identificadores de codigo em INGLES, estilo padrao da stack (camelCase para variaveis/funcoes, PascalCase para tipos/componentes, kebab-case para arquivos nao-componente, SCREAMING_SNAKE_CASE para constantes de protocolo). Prosa em pt-BR.
3. Nenhum passo desta SPEC faz push/merge para o GitHub. Empacotamento termina em "artefato construido localmente"; a publicacao do release e passo MANUAL do usuario (documentado no Sprint 9).
4. Proibido o caractere de travessao em qualquer texto gerado.

---

## 1. Baseline (ancora de drift)

- **HEAD**: `a3290a3` (primeiro e unico commit do repo: artefatos de planejamento + assets de audio; NAO existe codigo de aplicacao).
- **Fingerprint PRD_p2p-screen-share-mvp.md** (SHA-256, reancorado na revisao 5 da PRD: RF-04/AC-04 restritos a criacao, AC-23 com som "desconectado" para o alvo e "saiu" para os demais, RNF-09 aceitando m4a/AAC): `82E318F28C519D52A452E2E01243C30715C56A03A36CCDD3BBCC3C8E7F487662`
- **Fingerprint CONTEXT_p2p-screen-share-mvp.md** (SHA-256): `336418FD080E498CB4D48CCBBD413132676DCE0678584B01FE3D007E58D750BD`
- **Fingerprint UISPEC_p2p-screen-share-mvp.md** (SHA-256): `2187E8026C17AF8237F045B0D9F9372959F3E656F344E43D4CD18F1BE541B5B4`
- **Dependencias de codigo existentes**: NENHUMA (greenfield). Nao ha package.json, configuracao ou convencao previa. Todas as referencias a arquivos nesta SPEC sao criacoes planejadas.
- **Assets existentes**: `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\audios\` contem os 7 arquivos exigidos pela trava de implementacao, todos em `.m4a`: `entrou.m4a`, `saiu.m4a`, `transmitindo.m4a`, `parou-transmissao.m4a`, `desconectado.m4a`, `erro-conexao.m4a`, `reconectado.m4a` (mais `LEIA-ME.md` e `originais/`, que NAO sao empacotados). Trava de implementacao SATISFEITA.

---

## 2. Design Overview

### 2.1 Visao geral da arquitetura

App Electron para Windows 10/11 com tres camadas de processo:

- **Main process** (Node): ciclo de vida do app, janela principal, `desktopCapturer` (enumeracao de fontes com thumbnails), `session.setDisplayMediaRequestHandler` (entrega da fonte escolhida + loopback de audio do sistema), persistencia de settings (nickname + installId) em `userData`, single-instance lock, electron-updater.
- **Preload** (contextIsolation ON, nodeIntegration OFF, sandbox ON): expoe API tipada minima `window.zoi` via `contextBridge`. Superficie IPC inteira definida na secao 5.B.
- **Renderer** (Chromium): TODA a logica de sala, P2P e midia. PeerJS para sinalizacao (servidor publico), `RTCPeerConnection` em mesh full (video/audio + 1 DataChannel confiavel por par), UI React.

Topologia: mesh full de 2 a 8 participantes (RNF-03). Sem servidor de midia, sem TURN (RF-42), sem estado em servidor (RNF-04). O cliente do dono e a autoridade de roster/moderacao (admissao, capacidade, ban list, transferencia de posse). Protocolo de mensagens explicito e versionado na secao 5.A.

### 2.2 Stack do renderer (decisao e justificativa)

**Escolha: React 18 + Zustand + electron-vite (Vite para main/preload/renderer) + TypeScript estrito.**

Justificativa frente ao pilar de performance:
- O caminho critico de performance NAO passa pelo framework de UI: decodificacao/encoding WebRTC e composicao dos elementos `<video>` acontecem no compositor/GPU do Chromium. O custo do React aparece apenas em eventos de baixa frequencia (roster muda, alguem inicia transmissao, toast aparece), nunca por frame de video.
- Regra de projeto que protege o pipeline: elementos `<video>` sao gerenciados de forma IMPERATIVA (refs estaveis, `srcObject` atribuido uma unica vez por stream, nunca remontados por re-render). Componentes que contem video sao memoizados e isolados do estado de alta frequencia (stats de conexao ficam em store separado com selectors granulares do Zustand, atualizacao maxima a cada 2-3s).
- Alternativa rejeitada: **TS puro sem framework**. Menor overhead teorico, porem o app tem 5 telas, modais, toasts, listas dinamicas e muitos estados derivados; DOM manual eleva risco de bugs de sincronizacao de UI sem ganho mensuravel de performance (o overhead do React aqui e irrelevante perto do video). Rejeitada.
- Alternativa rejeitada: **Redux Toolkit** (verboso demais para o tamanho do app) e **Context API pura** (re-renders amplos; Zustand com selectors evita isso).
- electron-vite escolhido por ser o empacotador padrao atual do ecossistema Electron+Vite (HMR no renderer, build unificado de main/preload/renderer). Alternativa rejeitada: Webpack/Forge templates (mais lentos e mais configuracao).

### 2.3 Modulo central testavel (pure-logic core)

Toda a logica de estado de sala vive em `src/renderer/src/core/` como funcoes puras/reducers SEM dependencia de PeerJS, DOM ou Electron:
- `room-state.ts`: reducer do estado da sala (roster, dono, transmissoes, watching, quality) dirigido por mensagens do protocolo (secao 5.A) e eventos locais.
- `admission.ts`: validacao de JOIN_REQUEST (capacidade, ban list, versao de protocolo).
- `room-code.ts`: geracao de codigo aleatorio, validacao do codigo personalizado (RF-46), normalizacao case-insensitive, mapeamento para peer id.
- `election.ts`: transferencia de dono (voluntaria e por queda) pelo criterio de `joinedAt` mais antigo com desempate deterministico por peerId.

Isso garante testes unitarios diretos (Sprint 10) e mantem a camada PeerJS (services) fina: apenas transporte.

### 2.4 Identidade tecnica de participante e banimento

Nao ha login (RNF-08). Identidades:
- **peerId de membro**: id aleatorio (UUID gerado pelo PeerJS) por sessao; muda a cada entrada.
- **installId**: UUID v4 gerado na primeira execucao e persistido junto ao nickname em settings. E a chave ESTAVEL usada pela ban list (RF-08/RF-33): banir por peerId seria inutil (muda no rejoin). [ASSUMPTION] Ban por installId e contornavel apagando o arquivo de settings; aceitavel para app privado entre amigos (registrado na secao 9).

### 2.5 Sala como "porta" no PeerJS (door peer)

- Cada participante roda UM Peer de membro (id aleatorio) para o mesh (midia + data).
- O DONO atual roda adicionalmente um **door peer** com id derivado do codigo da sala. So aceita DataConnections de ingresso (fluxo de admissao); nunca carrega midia.
- Criar sala = conseguir registrar o door peer. Erro `unavailable-id` do PeerJS = "codigo ja em uso" (RF-04, revisao 5 da PRD: essa mensagem se aplica APENAS a criacao; entrar em sala existente com o mesmo codigo e o fluxo normal de entrada, RF-06).
- Sala morre quando o ultimo participante sai (RF-09): o door peer morre junto (processo fecha ou peer.destroy()), o servidor PeerJS libera o id, e a ban list (memoria dos clientes) evapora. Nada a fazer ativamente: e consequencia da arquitetura sem servidor (RNF-04).
- Transferencia de dono: o novo dono registra o door peer com o mesmo id (retry com backoff por ate 10s, pois o servidor PeerJS leva alguns segundos para liberar o id do dono anterior). Janela curta em que novos ingressos falham com "sala nao encontrada": aceita e documentada (secao 4, risco R5).

Mapeamento codigo -> peer id: `zoidagoiaba-<codigo-normalizado>` (normalizado = trim + lowercase). [ASSUMPTION] O RF-03 pede o prefixo "zoidagoiaba:"; o charset de ids aceito pelo servidor publico do PeerJS nao inclui `:` (aceita letras, digitos, hifen e underscore), entao a forma NA REDE usa hifen como separador: `zoidagoiaba-`. A intencao do RF-03 (namespace anti-colisao) e preservada integralmente; a forma com dois-pontos permanece como notacao logica/documentacional. Sem ambiguidade: o prefixo e fixo e sempre removido por inteiro.

### 2.6 Pipeline de midia

- Enumeracao de fontes: `desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize })` no main, entregue por IPC com thumbnails em data URL (RF-15).
- Captura: renderer chama `navigator.mediaDevices.getDisplayMedia({ video: true, audio: <toggle> })`; o main responde via `session.setDisplayMediaRequestHandler` com a fonte previamente escolhida (armada por IPC) e `audio: 'loopback'` quando o toggle de audio esta ligado (RF-17, RNF-10: loopback captura o sistema inteiro, limitacao aceita).
- Presets (RF-16), definidos em `src/shared/presets.ts`:

| id | resolucao alvo | fps | maxBitrate (video) |
|---|---|---|---|
| `p720_30` | 1280x720 | 30 | 2_500_000 |
| `p1080_30` | 1920x1080 | 30 | 4_000_000 |
| `p1080_60` | 1920x1080 | 60 | 6_000_000 |

Aplicacao: constraints de `getDisplayMedia` (width/height/frameRate ideais) + `RTCRtpSender.setParameters` (`maxBitrate`, `maxFramerate`) em cada conexao de saida, com `videoTrack.contentHint = 'motion'`. Todos os senders do mesmo transmissor usam parametros identicos (RF-24). Nenhuma logica propria de adaptacao alem disso: degradacao sob rede ruim fica 100% com a engine WebRTC (RF-47, RNF-11).
- Uma fonte por pessoa (RF-18): `media-manager` mantem no maximo um `localTransmission`; "trocar fonte" = parar a atual + iniciar nova (RF-19).
- Distribuicao: o transmissor faz `peer.call(memberPeerId, stream, { metadata })` para CADA membro do roster (N copias, RNF-06). Miniaturas ao vivo (RF-23) usam o proprio MediaStream remoto recebido em `<video>` pequenos e mutados; espectador que abre uma stream em tela cheia usa o mesmo stream (sem segunda conexao).

### 2.7 Reconexao (RF-40, RF-48)

Dois niveis de falha, ambos com janela de 15s:
1. **Queda da sinalizacao (PeerJS server)**: `peer.on('disconnected')` -> `peer.reconnect()` em loop com backoff. Nao derruba midia ja estabelecida (ICE segue direto), mas impede novas conexoes.
2. **Queda de um par do mesh**: deteccao por `RTCPeerConnection.connectionState` (`disconnected`/`failed`) OU timeout de heartbeat (sem PONG por 6s). Ao detectar, inicia-se o estado `reconnecting` daquele par com timer de 15s: re-dial (nova DataConnection + re-call de midia se havia transmissao) a cada 3s.

Autoridade da remocao: o DONO roda o timer de 15s por membro; ao expirar, remove do roster e emite `ROSTER_UPDATE` com `lastChange.kind = "timeout"` (demais tocam som "saiu", RF-40/AC-27). Espectadores de uma transmissao em reconexao mantem o ultimo quadro congelado (o `<video>` para de receber frames naturalmente) com overlay "reconectando..." (RF-48); expirados os 15s, a transmissao sai da lista e o fluxo de desconexao definitiva se aplica.

**Queda do DONO e regra de handover (aceitacao de ROSTER_UPDATE de nao-dono)**: cada membro roda o timer de 15s sobre o dono; ao expirar, `election.ts` elege deterministicamente o mais antigo, que assume, registra o door peer e emite `ROSTER_UPDATE` (`lastChange.kind = "transfer"`). Como os timers de 15s expiram em momentos DIFERENTES em cada membro, o primeiro `ROSTER_UPDATE` do dono eleito pode chegar a membros cujo `ownerPeerId` local ainda e o dono caido. Regra explicita de aceitacao (sem brecha de takeover forjado): um membro aceita um `ROSTER_UPDATE` vindo de um remetente que NAO e o seu dono local SOMENTE quando TODAS as condicoes valem:
- (a) o remetente e o vencedor deterministico de `election.ts` calculado sobre o roster LOCAL do membro excluindo o dono atual;
- (b) o link do membro com o dono atual esta em estado `reconnecting` ou `timeout` (nao saudavel);
- (c) o `rosterVersion` da mensagem e estritamente maior que o local.

Na aceitacao, o membro adota o remetente como novo dono (`ownerPeerId` atualizado) e aplica o snapshot. Qualquer `ROSTER_UPDATE` de nao-dono que falhe em (a), (b) ou (c) continua rejeitado com log (secao 5c). Alem disso, o dono eleito RE-EMITE seu primeiro `ROSTER_UPDATE` a cada 5s, ate 3 vezes, apos a eleicao, para que membros cujos timers expiram mais tarde convirjam sem depender de sorte de timing.

**Timeout de par NAO-dono com conectividade assimetrica**: quando a janela de 15s do membro B para o par A expira mas o DONO ainda lista A no roster (a autoridade nao o removeu porque o link dono-A esta saudavel), B NAO remove A: B marca A localmente como `unreachable`. Efeitos locais em B: o card de A fica acinzentado com icone "inalcancavel", a transmissao de A (se houver) e removida da grade/player de B, um toast conforme RF-41 informa B, e B continua tentando reconectar com A a cada 10s em background enquanto A permanecer no roster do dono. Sucesso de reconexao devolve o card ao normal (e re-call de midia se aplicavel); se o dono remover A do roster, o fluxo normal de remocao se aplica.

### 2.8 Fullscreen, PiP e sons

- Fullscreen real (RF-25): `element.requestFullscreen()` no container do player (cobre a tela toda, sem cromo do app). Esc sai nativamente (RF-27). Auto-hide de controles em ~3s de inatividade (RF-26, RNF-07) implementado no renderer com timer de atividade de mouse/teclado, animacao fade+slide por opacity/transform (UISPEC).
- PiP (RF-30): **Document Picture-in-Picture API** (`window.documentPictureInPicture.requestWindow`), nativa do Chromium: janela sempre no topo em nivel de SO, recebe o proprio elemento `<video>` movido para ela (mesmo documento, stream continua), estilizada com os tokens do UISPEC (barra minima com voltar/volume/fechar). Fallback [ASSUMPTION]: se a API nao estiver exposta na versao do Electron adotada, usar `videoElement.requestPictureInPicture()` (PiP nativo do Chromium, tambem always-on-top, sem barra customizada) e registrar a perda cosmetica.
- Sons (RF-39, RNF-09): os 7 `.m4a` sao copiados para `resources/audios/` do pacote no build e tocados no renderer via elementos `Audio` pre-carregados (`sound-player.ts`); zero download em runtime. [ASSUMPTION] RNF-09 cita mp3/wav/ogg, mas os arquivos entregues sao `.m4a` (AAC), que o Chromium/Electron decodifica nativamente; empacotar como estao, sem transcodificar (registrado na secao 9).

### 2b. Mapa de ciclo de vida das entidades

**Room**
- `criando` -> (door peer registrado) -> `ativa` | (unavailable-id) -> erro "codigo ja em uso" (RF-04)
- `ativa` -> membros entram/saem; dono pode mudar (transferencia/eleicao) -> `ativa`
- `ativa` -> ultimo participante sai -> `morta`: id liberado no PeerJS, ban list evapora, codigo reutilizavel (RF-09/AC-07)
- Sem transicao de edicao: codigo e limite sao imutaveis apos criacao (RF-10).

**Participant**
- `fora` -> JOIN_REQUEST -> `pendente` -> JOIN_ACCEPT -> `conectando-mesh` -> `presente`
- `pendente` -> JOIN_REJECT (room_full | banned | version_mismatch) -> `fora` com mensagem (RF-07/RF-08)
- `presente` -> sai voluntariamente (LEAVE) -> `fora` (som "saiu")
- `presente` -> MOD_REMOVE kick -> `fora`, PODE reentrar (RF-31/RF-32)
- `presente` -> MOD_REMOVE ban -> `fora` + installId na ban list ate a sala morrer (RF-33)
- `presente` -> queda -> `reconectando` (ate 15s) -> `presente` (som "reconectado") | timeout -> `fora` (som "saiu") (RF-40)
- `presente` como dono -> LEAVE com OWNER_TRANSFER -> posse migra ao mais antigo (RF-35), ban list herdada (RF-36)

**Transmission**
- `inativa` -> escolher fonte + preset + toggle audio -> `ativa` (TX_START, som "transmitindo", indicador persistente RF-21)
- `ativa` -> parar manual | trocar fonte (para e recomeca, RF-19) | sair da sala -> `encerrada` (TX_STOP, som "parou-transmissao") (RF-20)
- `ativa` -> transmissor cai -> `reconectando` nos espectadores (ultimo quadro + overlay, RF-48) -> `ativa` | `encerrada` apos 15s
- Maximo 1 por participante (RF-18); N simultaneas na sala (RF-22).

**Nickname/Settings**
- Primeira execucao: settings ausentes -> tela de nickname obrigatoria (RF-11) -> `settings.json` em userData com `{ nickname, installId }` (RF-12)
- Round-trip: tela de configuracoes carrega o valor persistido no campo, salva a edicao, novo valor propagado a sala via NICKNAME_UPDATE (RF-13/AC-08/AC-09)
- installId: criado uma unica vez, nunca editavel pela UI.

---

## 3. Trade-offs e alternativas rejeitadas

1. **Door peer no dono vs peer unico com id da sala**: peer unico (dono usa o id da sala para TUDO) foi rejeitado porque na transferencia de posse o novo dono teria que derrubar e recriar suas conexoes de midia para assumir o id. Com door peer dedicado, o mesh (ids aleatorios estaveis) nunca e tocado pela troca de dono; so a "porta" migra.
2. **Ban por installId vs por IP/fingerprint**: IP nao e visivel de forma confiavel via PeerJS e fingerprinting e desproporcional para app privado. installId persistido e simples, estavel entre sessoes e suficiente (evasao possivel e aceita).
3. **Replicar ban list a todos vs so ao proximo dono**: replicada no `ROSTER_UPDATE` para todos. Custo minimo (bytes) e garante RF-36 mesmo quando o dono CAI (sem OWNER_TRANSFER voluntario): qualquer eleito ja possui a lista. Alternativa (so no OWNER_TRANSFER) perderia a lista em queda do dono. Rejeitada.
4. **Thumbnails ao vivo: stream dedicada de baixa resolucao vs reutilizar a stream cheia**: reutilizar a stream ja recebida em um `<video>` pequeno. Uma segunda encoding por espectador dobraria o upload do transmissor (fere RNF-06 e o pilar de qualidade). O decodificador ja pagou o custo; renderizar pequeno e barato. Rejeitada a stream dedicada.
5. **Fullscreen via BrowserWindow.setFullScreen (IPC) vs element.requestFullscreen**: element API escolhida; mesmo resultado visual (tela 100% coberta), sem IPC, Esc gratis, e o compositor promove o video a overlay de hardware. Rejeitada a via IPC.
6. **PiP via segunda BrowserWindow vs Document PiP**: MediaStream nao atravessa BrowserWindows; segunda janela exigiria nova RTCPeerConnection local (loopback) ou re-call ao transmissor (mais upload para ele). Document PiP mantem o mesmo stream e documento. Rejeitada a segunda janela.
7. **Deteccao de queda: so connectionState vs heartbeat proprio**: ambos. `connectionState` demora a acusar em certas quedas (NAT timeouts longos); heartbeat de 2s com timeout de 6s da deteccao previsivel para iniciar a janela de 15s do RF-40. Custo: ~desprezivel no DataChannel.
8. **Estado distribuido por CRDT/gossip vs dono-autoridade**: dono-autoridade com `rosterVersion` monotonico e ordens diretas e muito mais simples, e a PRD ja define o dono como autoridade de moderacao. CRDT rejeitado (complexidade sem requisito).
9. **electron-store (lib) vs JSON proprio para settings**: JSON proprio com escrita atomica (write temp + rename) no main; sao 2 chaves, nao justifica dependencia extra.
10. **Codec preferido**: deixar a negociacao padrao do Chromium (tipicamente VP9/H264 com aceleracao por hardware quando disponivel). Forcar codec seria logica de qualidade nao prevista (RNF-11). Rejeitado forcar.

---

## 4. Riscos

| id | Risco | Impacto | Mitigacao |
|---|---|---|---|
| R1 | Servidor publico do PeerJS instavel ou fora do ar | Ninguem cria/entra em sala | Erro claro na UI + retry manual; risco aceito no MVP (sem servidor proprio por decisao). Config de host isolada em `src/shared/config.ts` para troca em 1 lugar |
| R2 | NAT simetrico/CGNAT impede par direto (10-15% dos cenarios) | Par especifico nao conecta | Sem TURN por decisao (RF-42); mensagem clara identificando QUEM nao conectou (RF-41), demais pares seguem funcionando |
| R3 | Upload do transmissor insuficiente para N copias | Qualidade degrada | Delegado a adaptacao nativa WebRTC (RF-47) + aviso estatico de banda na criacao de sala e no seletor de fonte (RNF-06); indicador de qualidade reflete (RF-38) |
| R4 | Loopback de audio via `audio: 'loopback'` com variacao entre versoes do Electron | Caso filme sem som | Validar na primeira execucao do Sprint 5 na versao pinada do Electron; fallback documentado: constraint legada `chromeMediaSource: 'desktop'` no getUserMedia |
| R5 | Janela de indisponibilidade do id da sala durante transferencia de posse | Ingresso falha por alguns segundos | Retry com backoff no registro do door (ate 10s) e retry curto no lado de quem entra antes de exibir "sala nao encontrada" |
| R6 | Instalador sem code signing dispara SmartScreen | Friccao na instalacao pelos amigos | Aceito no MVP (app privado); documentar no README do release manual ("mais informacoes" -> "executar assim mesmo") |
| R7 | Document PiP indisponivel na versao do Electron | PiP sem barra customizada | Fallback `requestPictureInPicture()` nativo (secao 2.8) |
| R8 | Mensagens forjadas no DataChannel (ex.: falso MOD_REMOVE) | Moderacao burlada | Matriz de autorizacao 5c: validacao de remetente contra roster + dono; mensagens invalidas descartadas e logadas |
| R9 | Auto-update sem release publicado (usuario ainda nao publicou) | Checagem falha silenciosa | electron-updater com erro tratado como no-op silencioso + log; UI so aparece quando ha update real |

---

## 5. Contrato de Mensagens e IPC (equivalente a "Endpoints Contract")

Nao ha endpoints HTTP. Os contratos com o mesmo rigor sao: (A) protocolo P2P via DataChannel, (B) IPC Electron, (5c) matriz de autorizacao.

### 5.A Protocolo P2P (DataChannel confiavel, JSON)

Envelope comum de TODA mensagem (definido em `src/shared/protocol.ts`):

```ts
interface Envelope<T> {
  v: 1;                // PROTOCOL_VERSION; mismatch tratado na admissao
  type: MessageType;   // nome da mensagem
  from: string;        // peerId do remetente (validado contra a conexao real)
  ts: number;          // epoch ms do remetente (informativo)
  payload: T;
}
```

Regra geral de rejeicao: mensagem com `v` diferente, `type` desconhecido, payload invalido (validacao estrutural por type guards em `protocol.ts`) ou remetente nao autorizado (5c) e DESCARTADA silenciosamente com log local `console.warn`; a conexao e fechada quando o remetente nem consta no roster. Nao existe mensagem de erro de protocolo de volta ao remetente, exceto JOIN_REJECT no fluxo de admissao.

**Canal de admissao (DataConnection efemera: candidato -> door peer do dono):**

| Mensagem | Direcao | Payload | Quem envia | Reacao esperada |
|---|---|---|---|---|
| `JOIN_REQUEST` | candidato -> dono | `{ nickname: string, memberPeerId: string, installId: string }` | qualquer peer desconhecido (unica mensagem aceita no door) | Dono valida via `admission.ts`; responde JOIN_ACCEPT ou JOIN_REJECT e fecha o canal |
| `JOIN_ACCEPT` | dono -> candidato | `{ roomMeta: { code: string, limit: number, createdAt: number }, rosterVersion: number, ownerPeerId: string, members: RosterMember[], banList: BanEntry[] }` | somente o dono | Candidato abre DataConnection de mesh com CADA membro e envia HELLO; dono ja o incluiu no roster e emitiu ROSTER_UPDATE aos demais |
| `JOIN_REJECT` | dono -> candidato | `{ reason: "room_full" \| "banned" \| "version_mismatch" \| "invalid_payload" }` | somente o dono | Candidato exibe a mensagem correspondente ("sala cheia" para room_full etc.) e destroi o peer |

`RosterMember = { peerId: string, installId: string, nickname: string, joinedAt: number, isOwner: boolean }`
`BanEntry = { installId: string, nickname: string }` (nickname apenas como rotulo de UI da ban list)

**Canal de mesh (1 DataConnection confiavel por par de membros, persistente):**

| Mensagem | Direcao | Payload | Quem envia | Reacao esperada |
|---|---|---|---|---|
| `HELLO` | membro novo -> cada membro existente | `{ nickname: string, joinedAt: number }` | membro presente no roster (o receptor pode receber HELLO ANTES do ROSTER_UPDATE que o inclui: guarda em quarentena por 5s aguardando o roster; se nao chegar, fecha) | Receptor associa a conexao ao roster, marca o par como conectado, toca som "entrou" na primeira confirmacao (roster OU hello, o que fechar o par) |
| `ROSTER_UPDATE` | dono -> todos | `{ rosterVersion: number, ownerPeerId: string, members: RosterMember[], banList: BanEntry[], lastChange: { kind: "join" \| "leave" \| "kick" \| "ban" \| "timeout" \| "nickname" \| "transfer", targetPeerId: string } }` | somente o dono atual | Receptores aplicam snapshot integral SE `rosterVersion` maior que o local (senao descartam); `lastChange` dirige som/toast conforme AC-23 (revisao 5 da PRD): join = "entrou"; leave/timeout = "saiu"; kick/ban = "saiu" nos DEMAIS participantes (o ALVO do kick/ban toca "desconectado" ao receber MOD_REMOVE, nunca por esta mensagem); e derruba conexoes com removidos |
| `NICKNAME_UPDATE` | qualquer membro -> todos | `{ nickname: string }` | o proprio membro (so muda o SEU nickname) | Receptores aplicam otimista; dono consolida no proximo ROSTER_UPDATE (`lastChange.kind = "nickname"`) |
| `TX_START` | transmissor -> todos | `{ txId: string, presetId: "p720_30" \| "p1080_30" \| "p1080_60", hasAudio: boolean, sourceKind: "screen" \| "window", sourceLabel: string, startedAt: number }` | o proprio transmissor | Receptores adicionam a transmissao a lista/grade, tocam som "transmitindo"; o `call` de midia correspondente carrega `{ txId }` no metadata para correlacao |
| `TX_STOP` | transmissor -> todos | `{ txId: string, reason: "manual" \| "source_switch" \| "leaving" }` | o proprio transmissor | Receptores removem da lista (espectadores voltam a grade), tocam som "parou-transmissao"; em `source_switch` o TX_START seguinte chega em sequencia (RF-19) |
| `WATCHING_UPDATE` | qualquer membro -> todos | `{ watchingTxId: string \| null }` | o proprio espectador | Alimenta o indicador "quem assiste o que" (RF-37) nos cards de participante |
| `QUALITY_UPDATE` | qualquer membro -> todos | `{ level: "good" \| "medium" \| "bad", rttMs: number, inboundBitrateKbps: number \| null }` | o proprio membro, a cada 3s (throttle), calculado de `getStats()` + RTT de heartbeat | Alimenta as barrinhas de qualidade (RF-38); ausencia por 10s rebaixa a exibicao para "sem dados" |
| `MOD_REMOVE` | dono -> alvo | `{ mode: "kick" \| "ban" }` | SOMENTE o dono | Alvo toca som "desconectado", exibe tela "voce foi desconectado/banido" e destroi seus peers; dono remove do roster (ban adiciona installId a ban list) e emite ROSTER_UPDATE (`kind = "kick"` ou `"ban"`) |
| `OWNER_TRANSFER` | dono -> todos | `{ newOwnerPeerId: string, rosterVersion: number }` | SOMENTE o dono, imediatamente antes do proprio LEAVE voluntario | Novo dono assume (registra door peer, passa a emitir ROSTER_UPDATE); demais atualizam `ownerPeerId` |
| `LEAVE` | membro -> todos | `{}` | o proprio membro ao sair voluntariamente | Receptores fecham conexoes com ele sem esperar timeout; dono emite ROSTER_UPDATE (`kind = "leave"`) |
| `PING` | par -> par | `{ seq: number }` | qualquer membro, a cada 2s por par | Receptor responde PONG com o mesmo seq |
| `PONG` | par -> par | `{ seq: number }` | resposta a PING | Origem mede RTT; 3 PINGs sem PONG (6s) inicia estado `reconnecting` do par (secao 2.7) |

Semantica de reconexao (15s, RF-40/RF-48): definida na secao 2.7; nao ha mensagem propria de "reconectando" (o estado e local, derivado da queda do transporte); o retorno bem-sucedido re-estabelece DataConnection + re-call e dispara som "reconectado" (`lastChange` nao e usado para isso: o proprio par detecta o retorno).

Erros de conexao P2P nao estabelecida (RF-41): apos JOIN_ACCEPT, cada par tem 20s para completar a conexao de mesh; falha gera toast local "Nao foi possivel conectar com <nickname> (conexao P2P direta falhou)" + som "erro-conexao" nos DOIS lados, sem retry infinito e sem TURN (RF-42).

### 5.B Contrato IPC Electron (preload `window.zoi`)

Todos os canais sao `ipcRenderer.invoke`/`ipcMain.handle` (request/response) exceto os marcados como evento (`ipcRenderer.on`). Tipos em `src/shared/ipc.ts` (fonte unica importada por main, preload e renderer).

| Canal | Direcao | Payload (request) | Retorno / evento | Uso |
|---|---|---|---|---|
| `settings:get` | renderer -> main | `void` | `{ nickname: string \| null, installId: string }` (installId criado on-demand na primeira chamada) | Bootstrap: decide tela de primeira execucao (RF-11); pre-popula configuracoes (RF-13) |
| `settings:set` | renderer -> main | `{ nickname: string }` (trim, 1 a 24 chars [ASSUMPTION A9]; invalido = throw) | `{ nickname: string, installId: string }` | Persistencia do nickname (RF-12) com escrita atomica em `userData/settings.json` |
| `capture:list-sources` | renderer -> main | `{ thumbnailWidth: number }` | `Array<{ id: string, name: string, kind: "screen" \| "window", thumbnailDataUrl: string, displayId: string \| null }>` | Popular o seletor de fonte (RF-15); telas incluem indice do monitor |
| `capture:select-source` | renderer -> main | `{ sourceId: string, withAudio: boolean }` | `void` | Arma o `setDisplayMediaRequestHandler` para o PROXIMO `getDisplayMedia` do renderer (fonte + `audio: 'loopback'` se `withAudio`); desarmado apos consumo ou 30s |
| `app:get-version` | renderer -> main | `void` | `string` | Exibir versao em configuracoes; compo o log |
| `update:check` | renderer -> main | `void` | `void` (resultado via evento) | Dispara checagem manual; main tambem checa sozinho no boot (RF-43) |
| `update:install` | renderer -> main | `void` | nao retorna (app reinicia) | `quitAndInstall` apos download completo |
| `update:status` | main -> renderer (evento) | n/a | `{ state: "checking" \| "available" \| "downloading" \| "downloaded" \| "none" \| "error", version: string \| null, percent: number \| null }` | UI de update (toast/badge em configuracoes) |

Fora do IPC por decisao (ficam 100% no renderer): copiar codigo (`navigator.clipboard.writeText`, RF-05), fullscreen (element API), PiP (Document PiP), sons (elementos Audio com assets empacotados), relogio de auto-hide.

### 5c. Matriz de autorizacao (mensagem x papel do remetente)

Papeis: **Dono** (peerId == ownerPeerId do roster local), **Membro** (peerId presente no roster, nao dono), **Desconhecido** (peerId fora do roster; inclui banidos, que apos rejeicao nem entram no roster).

| Mensagem | Dono | Membro | Desconhecido | Validacao adicional / rejeicao |
|---|---|---|---|---|
| `JOIN_REQUEST` (door) | n/a | n/a | ACEITA (unica aceita no door) | Payload invalido -> JOIN_REJECT invalid_payload; `v` diferente -> version_mismatch; installId na ban list -> banned; roster cheio -> room_full. Qualquer OUTRO type no door -> conexao fechada |
| `JOIN_ACCEPT` / `JOIN_REJECT` | ACEITA (so vinda do door do dono) | REJEITA | REJEITA | Candidato so aceita do peer ao qual ELE se conectou (o door); qualquer outra origem e descartada |
| `HELLO` | ACEITA | ACEITA | QUARENTENA 5s (pode chegar antes do ROSTER_UPDATE); sem roster confirmando -> conexao fechada | `from` deve ser o peerId real da DataConnection (PeerJS garante o id da conexao; envelope divergente -> descarte + log) |
| `ROSTER_UPDATE` | ACEITA | REJEITA + log, EXCETO handover de queda do dono: aceita SOMENTE se (a) remetente e o vencedor de `election.ts` sobre o roster local excluindo o dono atual, E (b) o link local com o dono atual esta reconnecting/timeout, E (c) `rosterVersion` estritamente maior que o local (regra completa na secao 2.7; membro entao adota o remetente como novo dono) | REJEITA + fecha conexao | Tambem rejeita se `rosterVersion` <= versao local (replay/atraso) |
| `OWNER_TRANSFER` | ACEITA | REJEITA + log | REJEITA + fecha conexao | `newOwnerPeerId` deve constar no roster; senao descarte |
| `MOD_REMOVE` | ACEITA (RF-31/RF-33) | REJEITA + log (RF-34: forjar kick/ban e inocuo) | REJEITA + fecha conexao | Alvo confere `from == ownerPeerId` do SEU roster antes de obedecer; demais membros so reagem ao ROSTER_UPDATE subsequente (nunca ao MOD_REMOVE em si) |
| `NICKNAME_UPDATE` | ACEITA (proprio nick) | ACEITA (proprio nick) | REJEITA + fecha conexao | So altera o nickname DO REMETENTE; payload nao referencia terceiros |
| `TX_START` / `TX_STOP` | ACEITA | ACEITA | REJEITA + fecha conexao | So cria/encerra transmissao DO REMETENTE; TX_START duplicado do mesmo peer substitui o anterior (defesa do RF-18) |
| `WATCHING_UPDATE` / `QUALITY_UPDATE` | ACEITA | ACEITA | REJEITA + fecha conexao | Sempre sobre o proprio remetente |
| `LEAVE` | ACEITA | ACEITA | ignora | Idempotente |
| `PING` / `PONG` | ACEITA | ACEITA | REJEITA + fecha conexao | seq eco obrigatorio no PONG |
| Chamada de MIDIA (`peer.call`) | ACEITA | ACEITA | REJEITADA: `call.close()` imediato | So se atende call cujo peerId esta no roster E com TX_START correspondente (metadata.txId conhecido ou aguardado por ate 5s) |

Identidade do remetente: o campo `from` do envelope e SEMPRE cruzado com o peerId real da DataConnection (fornecido pelo PeerJS/WebRTC, nao forjavel sem controlar a conexao). Divergencia = descarte + log. Banido tentando reentrar: barrado na admissao (JOIN_REJECT banned); conexao de mesh direta de um banido cai na linha "Desconhecido" (fora do roster, fechada).

---

## 6. Divisao de trabalho

### Backend (main process, protocolo, P2P, midia, empacotamento)

Sprints 1 a 5 e 9. Features:

- **B1. Scaffolding do projeto** (structure): repo de codigo funcional com electron-vite + TS + React, lint/format, scripts, janela abrindo. Sprint 1.
- **B2. Servicos de plataforma no main** (infra): settings persistidos (nickname + installId), superficie IPC completa da secao 5.B (exceto update), enumeracao de fontes e display media handler, empacotamento dos audios como assets, single-instance lock. Sprint 2.
- **B3. Nucleo puro do protocolo** (outro): `protocol.ts` (tipos + type guards), `room-state.ts`, `admission.ts`, `room-code.ts`, `election.ts`. 100% testavel sem Electron. Sprint 3.
- **B4. Camada de sessao P2P** (integração): peer manager (member peer + door peer), fluxo de admissao, mesh de DataConnections, heartbeat, reconexao 15s, eleicao por queda do dono, stats/qualidade. Sprint 4.
- **B5. Pipeline de midia** (integração): captura com presets, senders configurados (bitrate/framerate/contentHint), distribuicao N-copias, troca de fonte, correlacao txId, guard de 1 fonte. Sprint 5.
- **B6. Empacotamento e auto-update** (build): NSIS `ZoiDaGoiaba-Setup.exe`, electron-updater via GitHub Releases (repo `Pontinn/screen-share`), canais `update:*`. Artefato local apenas; publicacao manual. Sprint 9.

### Frontend (renderer UI, contrato visual = UISPEC)

Sprints 6 a 8. Toda tela/componente usa EXCLUSIVAMENTE os tokens e componentes do UISPEC (secoes 2 e 3); nada de identidade redefinida inline. Features:

- **F1. Fundacao visual + telas pre-sala** (frontend). UISPEC: tokens de cor/tipografia/geometria/movimento (secao 2), Botao primario/secundario, Input de texto, Modal, Toast; telas 1 (Primeira abertura), 2 (Home), 3 (Criar sala) do mapa (secao 4).
  Consumes: `settings:get`, `settings:set`, `app:get-version`, `JOIN_REQUEST`, `JOIN_ACCEPT`, `JOIN_REJECT`.
- **F2. Tela de sala: roster, grade, transmitir, moderacao, indicadores, toasts e sons** (frontend). UISPEC: Card de participante (coroa/olho/ponto danger), Miniatura de transmissao, Indicador "VOCE ESTA TRANSMITINDO", Toast, Modal (seletor de fonte, confirmacao de ban), Botao perigo; tela 4 (Sala).
  Consumes: `capture:list-sources`, `capture:select-source`, `ROSTER_UPDATE`, `HELLO`, `NICKNAME_UPDATE`, `TX_START`, `TX_STOP`, `WATCHING_UPDATE`, `QUALITY_UPDATE`, `MOD_REMOVE`, `OWNER_TRANSFER`, `LEAVE`.
- **F3. Visualizacao: player, fullscreen, volume, PiP, overlay de reconexao** (frontend). UISPEC: Barra de controles do player (auto-hide 180ms fade+slide), PiP, spinner "reconectando..." (unica animacao continua permitida junto ao ponto "ao vivo"); tela 5 (Assistindo).
  Consumes: `TX_START`, `TX_STOP`, `WATCHING_UPDATE`, `QUALITY_UPDATE`.
- **F4. UI de auto-update** (frontend). UISPEC: Toast e badge em configuracoes.
  Consumes: `update:status`, `update:check`, `update:install`. Sprint 9 (junto de B6).

---

## 7. Sprints

Convencao: paths absolutos; todos os arquivos sao "create" salvo indicacao "edit" (arquivo criado em sprint anterior, referenciado por secao/modulo, nunca por numero de linha). Commits em Conventional Commits, SEM linha de assinatura do Claude. Branch da feature: `feature/p2p-screen-share-mvp` (criada no Sprint 1 a partir de `main`; NENHUM push nesta SPEC).

---

### Sprint 1 - Scaffolding do projeto (categoria: structure)

**Descricao**: transformar o repo (hoje so planejamento + audios) em um projeto Electron+TS executavel: electron-vite com os tres alvos (main/preload/renderer), React, lint/format, scripts de dev/build, janela abrindo com placeholder, estrutura de pastas definitiva.

**Prerequisitos**: nenhum (greenfield). **Risco**: baixo (tooling padrao).

**Arquivos (create)**:
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\package.json`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\electron.vite.config.ts`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tsconfig.json` (+ `tsconfig.node.json`, `tsconfig.web.json`)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\eslint.config.mjs`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\.prettierrc.json`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\.gitignore`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\main\index.ts`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\preload\index.ts`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\index.html`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\main.tsx`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\App.tsx`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\build\icon.ico` (placeholder de icone; icone final e pendencia registrada na secao 9)

**Features**: B1 (structure). **Traces**: RNF-01, RNF-02 (fundacao), pilar de performance (config de build).

**Steps**:
1. `git checkout -b feature/p2p-screen-share-mvp` (sem push).
2. Inicializar `package.json` (name `zoi-da-goiaba`, productName `Zói da Goiaba`, version `0.1.0`, `main` apontando para o build do electron-vite); dependencias: `electron`, `electron-vite`, `vite`, `typescript`, `react`, `react-dom`, `zustand`, `peerjs`, `eslint`, `prettier`, `electron-builder`, `electron-updater` (updater usado so no Sprint 9, ja fixado aqui para nao mexer em deps depois). TODAS as versoes de dependencia sao fixadas EXATAS (sem `^`/`~`) no momento do scaffold, em nome da reprodutibilidade.
3. Fixar a versao estavel mais recente do Electron (major >= 36) e VALIDAR, antes de prosseguir o sprint, as duas capacidades estruturais desta SPEC: (a) loopback de audio do sistema no Windows via `setDisplayMediaRequestHandler` + `getDisplayMedia`/`desktopCapturer`; (b) disponibilidade da Document Picture-in-Picture API (se ausente, ativar o fallback da assumption A6: BrowserWindow frameless always-on-top). Registrar as versoes escolhidas (Electron, electron-vite, React etc.) nas notas do checklist na implementacao.
4. Configurar `electron.vite.config.ts` com os tres alvos e alias `@shared` -> `src/shared`.
5. TS estrito (`strict: true`, `noUncheckedIndexedAccess: true`); ESLint flat config + Prettier.
6. `src/main/index.ts` minimo: `app.whenReady`, `BrowserWindow` (1200x800, `backgroundColor: '#0e0b12'` conforme token `--bg-app` do UISPEC para evitar flash branco), `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; single-instance lock (`app.requestSingleInstanceLock`).
7. Preload vazio com `contextBridge.exposeInMainWorld('zoi', {})` (esqueleto tipado).
8. Renderer com App placeholder ("Zói da Goiaba" em texto simples).
9. Scripts: `dev` (electron-vite dev), `build` (electron-vite build), `lint`, `format`, `typecheck`.
10. `.gitignore`: `node_modules`, `out`, `dist`, `release`, mantendo `.forge/` conforme regra ja existente do repo.

**Edge cases** (structure):
- `npm install` atras de proxy/antivirus travando o download do binario do Electron: documentar `ELECTRON_MIRROR` como saida no README do projeto (nao bloquear o sprint).
- Segunda instancia do app aberta: lock foca a janela existente e encerra a nova.

**Done when**: `npm run dev` abre a janela escura com o placeholder; `npm run typecheck` e `npm run lint` passam; `npm run build` gera `out/` sem erro.

**Commit**: `chore: scaffold electron-vite + react + ts project structure`

**Rollback**: reverter o commit do sprint (o repo volta a ser so planejamento + audios; nada externo foi tocado).

---

### Sprint 2 - Servicos de plataforma no main (categoria: infra)

**Descricao**: implementar tudo que o renderer precisa do Electron: settings (nickname + installId) com escrita atomica, IPC da secao 5.B (exceto `update:*`), enumeracao de fontes de captura, display media handler com loopback de audio, assets de som empacotados e `sound-player` no renderer.

**Prerequisitos**: Sprint 1. **Risco**: medio (loopback de audio e o ponto sensivel; validado de fato no Sprint 5, aqui so a fiacao).

**Arquivos**:
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\shared\ipc.ts` (create: nomes de canais + tipos request/response, fonte unica)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\main\settings.ts` (create: load/save atomico de `userData/settings.json`, geracao de installId)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\main\capture.ts` (create: `desktopCapturer.getSources` + `setDisplayMediaRequestHandler` armado por `capture:select-source`)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\main\index.ts` (edit: registrar handlers IPC e o display media handler no boot)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\preload\index.ts` (edit: expor `window.zoi` completo e tipado)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\sound-player.ts` (create: pre-load dos 7 audios, `play(soundId)` com ids `entered | left | transmitting | stoppedTransmitting | removed | connectionError | reconnected`)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\assets\audios\` (create: copia dos 7 `.m4a` de `audios\` para dentro do bundle do renderer; a pasta `audios\originais` NAO entra)

**Features**: B2 (infra). **Traces**: RF-12, RF-13 (persistencia), RF-15 (enumeracao), RF-17 (loopback), RF-39/RNF-09 (sons), RNF-10.

**Steps**:
1. Definir `src/shared/ipc.ts` com os canais EXATAMENTE como na tabela 5.B (nomes verbatim) e tipos compartilhados.
2. `settings.ts`: leitura preguicosa; primeira chamada de `settings:get` cria installId (UUID v4 via `crypto.randomUUID`) e persiste; `settings:set` valida nickname (trim, 1 a 24 chars, [ASSUMPTION] A9) e grava com write-temp+rename.
3. `capture.ts`: `capture:list-sources` retorna telas e janelas com thumbnail data URL (thumbnailWidth vindo do renderer, sugerido 320); `capture:select-source` guarda `{ sourceId, withAudio }` por ate 30s; `setDisplayMediaRequestHandler` resolve o proximo pedido com a fonte armada e `audio: 'loopback'` quando `withAudio` (Windows).
4. Preload: `window.zoi.settings.get/set`, `window.zoi.capture.listSources/selectSource`, `window.zoi.app.getVersion`, `window.zoi.update.onStatus/check/install` (update como stub ate o Sprint 9), tudo tipado a partir de `@shared/ipc`.
5. `sound-player.ts`: importar os 7 `.m4a` como assets do Vite, pre-instanciar `Audio`, `play()` idempotente com clone para sobreposicao; respeitar volume fixo 1.0 (sons de app, nao afetados pelo volume da transmissao).
6. Copia dos audios: script de copia unica (manual, versionada) de `audios\*.m4a` para `src\renderer\src\assets\audios\` mantendo os nomes; documentar no proprio arquivo que a fonte canonica e a pasta `audios\` da raiz.

**Edge cases** (infra):
- `settings.json` corrompido: parse falha -> renomear para `settings.bak` e recomecar (primeira execucao de novo; nickname pedido outra vez, aceitavel).
- `capture:select-source` armado mas `getDisplayMedia` nunca chamado: desarmar aos 30s (nao vazar a escolha para um pedido futuro).
- Fonte escolhida fecha (janela encerrada) entre a selecao e o `getDisplayMedia`: handler falha, renderer trata o reject e reabre o seletor.
- `settings:set` com nickname vazio/so espacos/25+ chars: throw estruturado, UI exibe validacao.

**Done when**: com `npm run dev`, um harness temporario na tela placeholder consegue: ler/gravar nickname (persistindo entre execucoes), listar fontes com thumbnails visiveis, e tocar cada um dos 7 sons; typecheck/lint passam.

**Commit**: `feat(main): settings store, capture ipc surface and bundled notification sounds`

**Rollback**: reverter o commit; Sprint 1 permanece integro.

---

### Sprint 3 - Nucleo puro do protocolo e estado de sala (categoria: outro)

**Descricao**: implementar o coracao logico SEM transporte: tipos e type guards do protocolo (secao 5.A verbatim), reducer de estado de sala, admissao, codigo de sala e eleicao de dono. Nenhum import de PeerJS/Electron/DOM: 100% puro e testavel.

**Prerequisitos**: Sprint 1 (tooling). Independe do Sprint 2. **Risco**: baixo (logica pura), mas e o modulo de maior criticidade de corretude (moderacao, versionamento de roster).

**Arquivos (create)**:
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\shared\protocol.ts` (envelope, MessageType, payloads, type guards `isEnvelope`/`isJoinRequest`/etc., `PROTOCOL_VERSION = 1`)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\shared\config.ts` (constantes: `ROOM_ID_PREFIX = "zoidagoiaba-"`, `RECONNECT_WINDOW_MS = 15000`, `HEARTBEAT_INTERVAL_MS = 2000`, `HEARTBEAT_TIMEOUT_MS = 6000`, `MESH_CONNECT_TIMEOUT_MS = 20000`, limites de sala 2/8/6)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\core\room-state.ts` (estado + reducer: aplica ROSTER_UPDATE/TX_START/TX_STOP/WATCHING_UPDATE/QUALITY_UPDATE/NICKNAME_UPDATE/OWNER_TRANSFER e eventos locais de conexao; emite "efeitos" declarativos: playSound, showToast, closeConnection, para a camada de servicos executar)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\core\admission.ts` (decide JOIN_ACCEPT/JOIN_REJECT: versao, ban list por installId case-sensitive, capacidade `members.length >= limit` -> room_full)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\core\room-code.ts` (gerar aleatorio formato `<palavra>-<4 alfanum>` com palavras do universo do app: `filme`, `sala`, `zoi`, `goiaba`, `pipoca`, `serie`; validar personalizado RF-46: 3 a 32 chars, `[a-zA-Z0-9-]` apenas, mensagens de erro especificas; `normalize()` = trim + lowercase; `toPeerId()` = prefixo + normalizado)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\core\election.ts` (`electOwner(members)`: menor `joinedAt`, desempate por `peerId` ordinal; usada na transferencia voluntaria e na queda do dono)

**Features**: B3 (outro). **Traces**: RF-01, RF-02, RF-03, RF-07, RF-08, RF-10 (imutabilidade: estado sem acao de edicao), RF-14, RF-18 (estado), RF-20, RF-32, RF-34 (autz 5c em código), RF-35, RF-36, RF-46, RNF-04, RNF-08.

**Steps**:
1. `protocol.ts`: transcrever a secao 5.A na integra (nomes de mensagens VERBATIM); type guards estruturais para cada payload; funcao `validateEnvelope(raw, expectedFrom)` que aplica a regra geral de rejeicao (retorna mensagem tipada ou motivo de descarte).
2. `room-state.ts`: modelar `RoomState = { phase, roomMeta, rosterVersion, ownerPeerId, selfPeerId, members, banList, transmissions, watching, quality, peerLinks }`; reducer puro `(state, event) -> { state, effects[] }`; eventos = mensagens do protocolo + `PEER_LINK_UP/DOWN/RECONNECTING/RECONNECT_TIMEOUT` (locais). Guard de `rosterVersion` monotonico; `lastChange` -> efeito de som/toast conforme tabela 5.A.
3. `admission.ts`: funcao pura `admit(request, state) -> { accept: JoinAcceptPayload } | { reject: JoinRejectPayload }`; comparacao de ban por installId; capacidade conta o proprio dono.
4. `room-code.ts` conforme acima; validacao devolve codigo de erro discriminado (`too_short`, `too_long`, `invalid_chars`) para a UI montar mensagens (AC-28).
5. `election.ts` conforme acima; determinismo garante que todos os membros elegem o MESMO novo dono sem coordenacao na queda do dono.
6. Autorizacao (5c) implementada em `validateEnvelope` + reducer: mensagens de dono checadas contra `ownerPeerId`; mensagens "sobre si mesmo" checadas contra `from`.

**Edge cases** (outro):
- ROSTER_UPDATE atrasado (versao menor) chegando depois de um mais novo: descartado pelo guard.
- HELLO de peer ainda fora do roster local (corrida com ROSTER_UPDATE): quarentena de 5s (modelada como estado `pendingHellos` no reducer + efeito de expiracao).
- MOD_REMOVE forjado por membro: reducer ignora e emite efeito de log (RF-34).
- Dois TX_START do mesmo peer sem TX_STOP: o segundo substitui o primeiro (defesa RF-18).
- Eleicao com `joinedAt` identico (mesma ms): desempate por peerId garante unicidade.
- Codigo personalizado com maiusculas: normalizado; "SALA-do-Pontin" == "sala-do-pontin" (AC-29).

**Done when**: typecheck/lint passam; modulos exportam API pura sem imports de plataforma (verificavel por grep de imports); casos acima exercitados por testes de fumaca locais informais (testes formais no Sprint 10).

**Commit**: `feat(core): versioned room protocol, room state reducer, admission and owner election`

**Rollback**: reverter o commit; nada fora de `src/shared` e `src/renderer/src/core` foi tocado.

---

### Sprint 4 - Camada de sessao P2P (PeerJS) (categoria: integração)

**Descricao**: dar transporte ao nucleo do Sprint 3: member peer + door peer, fluxo de admissao completo, mesh de DataConnections com heartbeat, reconexao com janela de 15s, eleicao por queda do dono, monitor de stats e broadcast de qualidade.

**Prerequisitos**: Sprints 2 e 3. **Risco**: ALTO (comportamento do servidor publico do PeerJS, corridas de conexao, timing de liberacao de id). Mitigacao: toda decisao vive no reducer puro; esta camada so transporta.

**Arquivos (create)**:
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\peer-manager.ts` (cria/destroi member peer e door peer; mapeia eventos PeerJS para eventos do reducer; broadcast helper `sendToAll`; retry de registro do door com backoff ate 10s na transferencia)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\mesh.ts` (DataConnections por par: abrir para todos no ingresso, aceitar conforme 5c, fila de envio ate `open`, fechamento limpo em remocao de roster)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\reconnection.ts` (heartbeat PING/PONG por par, deteccao 6s, janela de 15s com re-dial a cada 3s, eventos `PEER_LINK_RECONNECTING`/`RECONNECT_TIMEOUT`/`PEER_LINK_UP`; tambem `peer.reconnect()` para queda de sinalizacao)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\stats-monitor.ts` (a cada 3s: `getStats()` das conexoes de entrada + RTT de heartbeat -> nivel good/medium/bad -> `QUALITY_UPDATE` broadcast; thresholds iniciais [ASSUMPTION]: good < 150ms RTT e sem perda relevante, bad > 400ms ou perda > 5%)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\session.ts` (orquestrador: `createRoom(code, limit)`, `joinRoom(code)`, `leaveRoom()`, `kick(peerId)`, `ban(peerId)`; unico ponto que liga reducer <-> services; executa os "efeitos" do reducer, incluindo sons via `sound-player`)

**Features**: B4 (integração). **Traces**: RF-03, RF-04, RF-05 (codigo disponivel para copia via estado), RF-06, RF-07, RF-08, RF-09, RF-31, RF-32, RF-33, RF-35, RF-36, RF-37 (transporte WATCHING_UPDATE), RF-38 (stats), RF-39 (disparo dos sons por efeito), RF-40, RF-41, RNF-03, RNF-04, RNF-11 (15s).

**Steps**:
1. `peer-manager.ts`: member peer com id gerado pelo PeerJS; door peer criado apenas quando o cliente e/vira dono, com `toPeerId(code)`; erro `unavailable-id` na criacao da sala -> UI "codigo ja em uso" (RF-04); `peer-unavailable` ao entrar -> retry por ~10s (alinhado a janela de re-registro do door peer durante transferencia de posse, risco R5) e depois "sala nao encontrada".
2. Fluxo de criacao: criar member peer + door peer; estado inicial do roster com o proprio dono (`joinedAt = Date.now()`).
3. Fluxo de ingresso: conectar ao door, enviar `JOIN_REQUEST`, aguardar resposta com timeout de 10s (timeout -> erro "sem resposta da sala"); em `JOIN_ACCEPT`, abrir mesh com todos os membros e enviar `HELLO`; em `JOIN_REJECT`, mapear reason -> mensagem ("sala cheia", "voce esta banido desta sala", "atualize o app para entrar nesta sala").
4. Lado do dono: door aceita conexao, so processa `JOIN_REQUEST` (5c), roda `admission.ts`, responde, atualiza roster, emite `ROSTER_UPDATE` (`kind: "join"`), fecha o canal de admissao.
5. `mesh.ts`: aceitar DataConnection somente de peerId no roster (ou quarentena HELLO); associar conexao <-> membro; `sendToAll` serializa envelope uma vez.
6. `reconnection.ts`: conforme secao 2.7; dono e a autoridade do timeout de membros; queda do dono dispara timer local em cada membro e, no timeout, `election.ts` + assuncao pelo eleito (registrar door com retry, emitir `ROSTER_UPDATE` com `kind: "transfer"` e RE-EMITI-LO a cada 5s, ate 3 vezes, para convergir membros cujos timers de 15s expiram depois). Implementar no receptor a regra de handover da secao 2.7: `ROSTER_UPDATE` de nao-dono aceito SOMENTE com (a) remetente == vencedor de `election.ts` sobre o roster local sem o dono atual, (b) link local com o dono atual em reconnecting/timeout, (c) `rosterVersion` estritamente maior; na aceitacao, adotar o remetente como novo dono.
7. Timeout de par NAO-dono com o membro ainda no roster do dono (conectividade assimetrica, secao 2.7): marcar o par como `unreachable` local (evento para o reducer: card acinzentado com icone, transmissao dele removida localmente, toast RF-41) e manter tentativa de reconexao em background a cada 10s enquanto ele constar no roster do dono; sucesso restaura o estado normal do par.
8. Falha de estabelecimento de mesh (nunca conectou, tipicamente NAT simetrico, RF-41): timer de 20s por par novo; timeout gera efeito de toast identificando o nickname + som "erro-conexao" nos dois lados; par fica marcado `unreachable` (sem retry infinito e sem TURN, RF-42; distinto do step 7, onde o par JA esteve conectado e o retry de background se justifica).
9. `session.ts`: API publica para a UI; `kick`/`ban` enviam `MOD_REMOVE` ao alvo e atualizam roster+ban list+`ROSTER_UPDATE`; `leaveRoom` do dono envia `OWNER_TRANSFER` (eleito por `election.ts`) e depois `LEAVE`; destruicao ordenada dos peers.
10. Sons conectados aos efeitos do reducer conforme AC-23 (revisao 5 da PRD): entrou/saiu/erro-conexao/reconectado para os presentes; em kick/ban, o ALVO toca "desconectado" (via MOD_REMOVE) e os DEMAIS tocam "saiu" (via ROSTER_UPDATE); transmitindo/parou ficam no Sprint 5 via TX_*.

**Edge cases** (integração):
- Dois candidatos entram simultaneamente com 1 vaga: admissao e serializada no dono (fila por ordem de chegada); o segundo recebe room_full.
- Candidato conecta ao door e nunca envia JOIN_REQUEST: door fecha o canal em 10s.
- Dono cai DURANTE uma admissao: candidato tem timeout de 10s e mostra erro; reentrar depois.
- Membro removido (kick/ban) com conexoes ainda abertas: demais fecham as conexoes ao aplicar o ROSTER_UPDATE (efeito closeConnection); alvo destroi tudo ao receber MOD_REMOVE.
- Sinalizacao PeerJS cai mas o mesh segue vivo: `peer.reconnect()` em background; sala continua funcionando (midia e data sao P2P diretos); novos ingressos indisponiveis ate reconectar.
- Ex-dono retorna apos queda com eleicao ja ocorrida: ele NAO retoma a posse. Ao reconectar, recebe o `ROSTER_UPDATE` do dono eleito (re-broadcast de 5s x3, `rosterVersion` maior) e cede: durante sua propria queda seus links estavam todos em reconnecting, entao a condicao (b) vale do lado dele, e o eleito e o vencedor deterministico, condicao (a); se os 15s ja o excluiram do roster, ele reentra como candidato novo pelo door. Membros cujo timer ainda nao expirou convergem pelo mesmo re-broadcast com (a)+(b)+(c) satisfeitas.
- ROSTER_UPDATE forjado por membro se passando por "novo dono" com o dono atual SAUDAVEL: rejeitado pela condicao (b) da regra de handover (link com o dono nao esta em reconnecting/timeout); forjado por quem nao e o vencedor deterministico: rejeitado pela condicao (a).
- Banido tenta mesh direto pulando o door: fora do roster -> conexao fechada (5c).

**Done when**: em uma maquina, 3 instancias do app (dev) criam sala, entram, veem roster igual e sincronizado, kick/ban/transferencia funcionam, matar um processo dispara "reconectando" e remocao aos 15s nos demais com som "saiu"; typecheck/lint passam.

**Commit**: `feat(p2p): peerjs session layer with admission, mesh, moderation and 15s reconnection`

**Rollback**: reverter o commit; nucleo (Sprint 3) e plataforma (Sprint 2) permanecem utilizaveis.

---

### Sprint 5 - Pipeline de midia (captura, presets, distribuicao) (categoria: integração)

**Descricao**: transmissao de fato: captura com preset e audio opcional, configuracao dos senders, N-copias para o roster, recepcao/correlacao por txId, troca de fonte, encerramento em todas as saidas.

**Prerequisitos**: Sprints 2 e 4. **Risco**: ALTO (loopback de audio, custo de encoding com multiplos receivers). Este sprint valida na pratica o risco R4.

**Arquivos**:
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\shared\presets.ts` (create: tabela da secao 2.6 com tipos)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\media-manager.ts` (create: `startTransmission({sourceId, presetId, withAudio})` -> `capture:select-source` + `getDisplayMedia` + contentHint + calls para o roster + `TX_START`; `stopTransmission(reason)`; `switchSource` = stop(`source_switch`) + start; guard de transmissao unica; aplicar `setParameters` em cada sender; re-call de novos membros que entram durante transmissao ativa; re-call no retorno de reconexao)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\session.ts` (edit: modulo de orquestracao passa a executar efeitos de TX e expor a API de transmissao para a UI)

**Features**: B5 (integração). **Traces**: RF-15, RF-16, RF-17, RF-18, RF-19, RF-20, RF-22, RF-24, RF-47, RNF-05, RNF-06, RNF-10, RNF-11.

**Steps**:
1. `presets.ts` conforme tabela; export unico usado por media-manager e pela UI do seletor.
2. `startTransmission`: recusar se ja ha transmissao local (RF-18); armar fonte via `capture:select-source`; `getDisplayMedia` com constraints do preset e `audio` conforme toggle; `videoTrack.contentHint = 'motion'`.
3. Para cada membro do roster: `memberPeer.call(peerId, stream, { metadata: { txId } })`; apos `negotiationneeded`/conexao, aplicar `sender.setParameters` com `maxBitrate`/`maxFramerate` do preset, IDENTICOS para todos os receivers (RF-24). Nenhuma outra logica de bitrate (RF-47/RNF-11).
4. Broadcast `TX_START` (payload da 5.A) e efeito de som "transmitindo"; `TX_STOP` + som "parou-transmissao" no encerramento por qualquer via (RF-20): parada manual, `source_switch`, `leaving` (hook no `leaveRoom`), e tambem quando o usuario encerra a captura pelo proprio SO (track `ended`).
5. Recepcao: `peer.on('call')` -> validar remetente/txId (5c) -> `call.answer()` sem stream de retorno -> entregar MediaStream ao estado (`transmissions[txId].stream`).
6. Membro novo entra com transmissoes ativas: cada transmissor re-`call` o novato ao aplicar o `ROSTER_UPDATE` de join (e reenvia `TX_START` direto para ele pela conexao de mesh, garantindo metadata).
7. Retorno de reconexao de par com transmissao ativa: transmissor re-`call` o par recuperado.
8. Validacao pratica do loopback (R4): transmitir janela + audio e confirmar audio do sistema no receptor; se `audio: 'loopback'` falhar na versao pinada do Electron, aplicar o fallback documentado (getUserMedia com `chromeMediaSource: 'desktop'`) e registrar em LESSONS na conclusao da feature.

**Edge cases** (integração):
- Toggle de audio ligado mas fonte sem permissao de loopback: prosseguir só com video + toast "nao foi possivel capturar o audio do sistema".
- Janela compartilhada e fechada pelo usuario: track `ended` -> `stopTransmission("manual")` com toast.
- Transmissor com upload saturado: NADA a fazer no app (RF-47); apenas stats refletem (RF-38).
- 8 participantes, 7 receivers: custo de encoding alto; contentHint e maxBitrate limitam; performance real validada no teste manual (Sprint 10).
- `getDisplayMedia` rejeitado (fonte sumiu / handler desarmado por timeout): reabrir seletor com aviso.
- Espectador entra depois do TX_START global: recebe TX_START direto no mesh (step 6), nunca fica com stream sem metadata.

**Done when**: entre 2 instancias na mesma maquina: A transmite monitor com audio em cada um dos 3 presets e B ve/ouve; troca de fonte funciona sem duas transmissoes simultaneas de A; B entra depois do inicio e recebe; typecheck/lint passam.

**Commit**: `feat(media): screen capture pipeline with quality presets and mesh distribution`

**Rollback**: reverter o commit; camada P2P (Sprint 4) segue integra (sala sem midia).

---

### Sprint 6 - Fundacao visual e telas pre-sala (categoria: frontend)

**Descricao**: implementar os tokens do UISPEC como CSS custom properties, os componentes base e as telas 1 a 3 do mapa do UISPEC (Primeira abertura, Home com engrenagem de configuracoes, Criar sala) mais a entrada por codigo. Contrato visual: UISPEC secoes 2, 3 e 4 (NUNCA redefinir identidade inline).

**Prerequisitos**: Sprints 2, 3, 4 (fluxos de criar/entrar reais). **Risco**: baixo.

**Arquivos (create)**:
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\theme.css` (todos os tokens do UISPEC secao 2: cores, tipografia Inter embutida via asset + fallback, radius, espacamento, duracoes/easing, `prefers-reduced-motion`)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\assets\fonts\` (Inter 400/500/600 woff2 embutidas, sem download em runtime, UISPEC Tipografia)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\Button.tsx` (variantes primary/secondary/danger do UISPEC)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\TextInput.tsx`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\Modal.tsx` (overlay + scale/fade 240ms do UISPEC)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\Toast.tsx` (container + item, translateY+fade 180ms, auto-dismiss 4s)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\store\app-store.ts` (Zustand: fase de navegacao, settings, sessao; selectors granulares)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\FirstRunScreen.tsx` (UISPEC tela 1: marca 28px + nickname + botao "Bora")
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\HomeScreen.tsx` (UISPEC tela 2: Criar sala / Entrar com codigo / engrenagem)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\CreateRoomScreen.tsx` (UISPEC tela 3: gerar/digitar codigo, limite 2-8 padrao 6, copiar codigo, aviso de banda RNF-06)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\JoinRoomScreen.tsx` (campo de codigo + estados de erro)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\SettingsModal.tsx` (nickname round-trip + versao do app)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\App.tsx` (edit: roteamento por fase, remocao do placeholder)

**Features**: F1 (frontend). Componentes/tokens UISPEC: tokens secao 2 completos, Botao primario/secundario, Input de texto, Modal, Toast; telas 1, 2, 3.
Consumes: `settings:get`, `settings:set`, `app:get-version`, `JOIN_REQUEST`, `JOIN_ACCEPT`, `JOIN_REJECT` (via `session.ts`).

**Traces**: RF-01, RF-02, RF-04 (mensagem), RF-05, RF-06, RF-07 (mensagem "sala cheia"), RF-08 (mensagem de banido), RF-10 (ausencia de edicao), RF-11, RF-12, RF-13, RF-46, RNF-06 (aviso), RNF-12.

**Steps**:
1. `theme.css` com os tokens VERBATIM do UISPEC (nomes `--bg-app`, `--accent` etc.); Inter via `@font-face` local; classe base de animacao so com transform/opacity; media query `prefers-reduced-motion` zerando duracoes.
2. Componentes base com os estados exatos do UISPEC (hover/pressed/foco com anel `--accent-soft`).
3. FirstRun: exibida quando `settings:get` retorna nickname null; valida 1 a 24 chars; salva e segue para Home (RF-11/RF-12).
4. Home: duas acoes grandes + engrenagem abrindo SettingsModal (campo pre-preenchido com o nickname salvo, salvar chama `settings:set` e, se em sala, dispara NICKNAME_UPDATE) (RF-13, AC-08/AC-09).
5. CreateRoom: toggle gerar/digitar; validacao inline via `room-code.ts` com mensagens por erro (AC-28); stepper de limite 2 a 8 preso na faixa, padrao 6 (AC-03); botao copiar (`navigator.clipboard`) com feedback "copiado!" (AC-01); aviso estatico de banda (texto do RNF-06: salas maiores pedem upload maior ou preset menor); acao cria a sala via `session.createRoom` e navega para a Sala; erro `unavailable-id` -> "codigo ja em uso" (AC-04).
6. JoinRoom: campo de codigo (mesma validacao), `session.joinRoom`; erros: "sala cheia", "voce esta banido desta sala", "sala nao encontrada", "atualize o app para entrar nesta sala".
7. Nenhuma UI de edicao de sala em lugar nenhum (RF-10/AC-10).

**Edge cases** (frontend):
- Colar codigo com espacos/maiusculas: normalizacao visivel (lowercase no campo ao validar).
- Duplo clique em "Criar sala": botao entra em estado loading/disabled na primeira acao (sem dupla criacao).
- Clipboard indisponivel (raro em Electron): fallback de selecao manual do texto do codigo.
- Nickname so com espacos: bloqueado com mensagem.

**Done when**: fluxo completo em dev: primeira execucao pede nickname, Home navega, criar sala com codigo aleatorio E personalizado funciona (com validacoes e copiar), segunda instancia entra pelo codigo; visual confere com os tokens do UISPEC (verificacao manual lado a lado com a tabela de tokens); typecheck/lint passam.

**Commit**: `feat(ui): design tokens, base components and pre-room screens`

**Rollback**: reverter o commit; a logica dos Sprints 2-5 nao depende da UI.

---

### Sprint 7 - Tela de Sala: roster, grade, transmitir, moderacao, indicadores (categoria: frontend)

**Descricao**: tela 4 do UISPEC: sidebar de participantes com badges, grade de miniaturas ao vivo, fluxo "Transmitir" (seletor de fonte com abas Monitores/Janelas, toggle de audio, preset), indicador persistente "VOCE ESTA TRANSMITINDO", moderacao do dono, toasts+sons dos eventos de sala.

**Prerequisitos**: Sprints 4, 5, 6. **Risco**: medio (muitos estados simultaneos; disciplina de re-render perto de video).

**Arquivos (create, exceto indicacao)**:
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\RoomScreen.tsx` (layout: sidebar + grade + barra de acoes)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\ParticipantCard.tsx` (UISPEC Card de participante: avatar inicial sobre `--accent-soft`, coroa dono, olho assistindo, ponto danger pulsante transmitindo; menu do dono: desconectar/banir)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\StreamThumbnail.tsx` (UISPEC Miniatura de transmissao: video ao vivo muted, nickname na base, borda 2px accent na assistida, hover scale 1.02; componente memoizado com ref estavel de video)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\SourcePickerModal.tsx` (abas Monitores/Janelas com previews de `capture:list-sources`, toggle "transmitir audio do sistema" LIGADO por padrao, preset selector com os 3 presets, nota da limitacao de loopback RNF-10 e aviso de banda RNF-06)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\TransmittingBar.tsx` (UISPEC Indicador "VOCE ESTA TRANSMITINDO": barra fixa danger no topo + botao parar + trocar fonte; NUNCA auto-hide)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\ConnectionBars.tsx` (3 barrinhas success/warning/danger a partir de QUALITY_UPDATE)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\store\room-store.ts` (Zustand espelhando o RoomState do reducer; stats em slice separado com selector proprio para nao re-renderizar cards inteiros)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\App.tsx` (edit: rota da sala)

**Features**: F2 (frontend). Componentes UISPEC: Card de participante, Miniatura de transmissao, Indicador "VOCE ESTA TRANSMITINDO", Toast, Modal, Botao perigo; tela 4.
Consumes: `capture:list-sources`, `capture:select-source`, `ROSTER_UPDATE`, `HELLO`, `NICKNAME_UPDATE`, `TX_START`, `TX_STOP`, `WATCHING_UPDATE`, `QUALITY_UPDATE`, `MOD_REMOVE`, `OWNER_TRANSFER`, `LEAVE`.

**Traces**: RF-14, RF-15 (UI), RF-16 (UI), RF-17 (UI), RF-19 (UI trocar fonte), RF-21, RF-22 (UI), RF-23, RF-31 (UI), RF-33 (UI), RF-34 (UI: acoes so para o dono), RF-37, RF-38 (UI), RF-39 (toasts casados com sons), RNF-06 (aviso no picker), RNF-12.

**Steps**:
1. RoomScreen com sidebar (cards) e grade central; codigo da sala visivel com botao copiar (RF-05 tambem dentro da sala).
2. ParticipantCard: badges por estado do roster; acoes desconectar/banir APENAS quando `self == owner` e alvo != self (RF-34/AC-19), ban com Modal de confirmacao (Botao perigo).
3. StreamThumbnail: `<video muted playsInline>` com srcObject atribuido via ref uma unica vez por stream; clique = escolher assistir (dispara WATCHING_UPDATE e navega ao player do Sprint 8).
4. Fluxo Transmitir: botao primario abre SourcePickerModal; confirmar chama `media-manager.startTransmission`; durante transmissao ativa o botao vira "trocar fonte"/"parar" (RF-19).
5. TransmittingBar montada fora da arvore da grade (posicao fixa no topo), visivel em toda a UI da sala enquanto transmite (RF-21/AC-32).
6. Toasts + sons: efeitos do reducer viram toasts (entrou/saiu/comecou a transmitir/parou/desconectado-banido/erro de conexao/reconectado) casados 1:1 com os 7 sons (RF-39/AC-23).
7. Indicador quem-assiste-o-que: badge de olho no card + tooltip "assistindo <nickname>" via WATCHING_UPDATE (RF-37/AC-21).
8. ConnectionBars por participante alimentado pelo slice de stats (RF-38/AC-22); estado "sem dados" apos 10s sem QUALITY_UPDATE.
9. Sair da sala (botao): `session.leaveRoom` (dono dispara OWNER_TRANSFER; UI mostra toast de novo dono via `lastChange kind transfer`).
10. Telas terminais: "voce foi desconectado" / "voce foi banido" (apos MOD_REMOVE) com acao de voltar a Home (banido pode tentar reentrar e recebera a rejeicao, AC-18).

**Edge cases** (frontend):
- Sala com 8 participantes e 7 transmissoes: grade rola; miniaturas mantem aspect ratio 16:9.
- Transmissao some enquanto o seletor de fonte esta aberto: grade atualiza por baixo, sem crash.
- Dono banindo alguem que esta transmitindo: transmissao removida da grade junto com o membro.
- Auto-moderacao: acoes de kick/ban nunca aparecem no proprio card do dono.
- Re-render de stats: verificar que atualizacao de QUALITY_UPDATE nao re-renderiza `<video>` (React DevTools profile durante dev).

**Done when**: com 3 instancias: roster com badges corretas, 2 transmitindo ao mesmo tempo e miniaturas ao vivo de ambas (AC-13), kick/ban pela UI com toasts/sons, indicador de transmissao persistente, quem-assiste-o-que refletindo cliques; typecheck/lint passam.

**Commit**: `feat(ui): room screen with roster, live stream grid, transmit flow and moderation`

**Rollback**: reverter o commit; telas pre-sala (Sprint 6) seguem funcionais.

---

### Sprint 8 - Visualizacao: player, fullscreen, volume, PiP, reconexao (categoria: frontend)

**Descricao**: tela 5 do UISPEC (Assistindo): player embutido, fullscreen real com controles auto-hide (3s), volume local (slider + mute), badge de qualidade e barras de conexao na barra do player, PiP always-on-top, overlay "reconectando..." com ultimo quadro (RF-48).

**Prerequisitos**: Sprints 5, 7. **Risco**: medio (Document PiP, disciplina de fullscreen).

**Arquivos (create, exceto indicacao)**:
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\PlayerView.tsx` (video principal; entrada/saida de fullscreen via `requestFullscreen` no container; Esc nativo; clique na grade retorna)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\PlayerControls.tsx` (UISPEC Barra de controles do player: sair do fullscreen, volume, badge de preset ex 1080p30, ConnectionBars; auto-hide fade+slide 180ms apos 3s de inatividade de mouse/teclado, RNF-07)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\VolumeControl.tsx` (slider + mute LOCAIS: aplicados em `videoElement.volume`/`muted`, jamais tocando a stream, RF-28)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\services\pip-controller.ts` (Document PiP: mover o elemento de video para a janela PiP com folha de estilo dos tokens, barra minima voltar/volume/fechar; fallback `requestPictureInPicture`, secao 2.8)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\ReconnectOverlay.tsx` (overlay "reconectando..." com spinner permitido pelo UISPEC sobre o ultimo quadro congelado; acionado pelo estado `reconnecting` do transmissor)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\screens\RoomScreen.tsx` (edit: integracao grade <-> player)

**Features**: F3 (frontend). Componentes UISPEC: Barra de controles do player, PiP, spinner reconectando + ponto "ao vivo".
Consumes: `TX_START`, `TX_STOP`, `WATCHING_UPDATE`, `QUALITY_UPDATE`.

**Traces**: RF-23 (troca de stream pelo player), RF-25, RF-26, RF-27, RF-28, RF-29, RF-30, RF-38 (barra do player), RF-48, RNF-07, RNF-12.

**Steps**:
1. PlayerView: mesmo MediaStream da miniatura promovido ao player (sem nova conexao); ao assistir, emitir `WATCHING_UPDATE { watchingTxId }`; ao voltar a grade, `null`.
2. Fullscreen: `containerRef.current.requestFullscreen()`; botao sair + Esc nativo (`fullscreenchange` sincroniza estado) (AC-14).
3. Auto-hide: timer de 3s renovado por mousemove/keydown; esconder controles E cursor (`cursor: none`); reaparecer em atividade; volume dentro da mesma barra (RF-29/AC-34); animacao apenas opacity/transform (UISPEC Movimento).
4. VolumeControl: persistir volume escolhido por sessao (memoria, nao settings); mute independente do slider (AC-15).
5. PiP: `pip-controller` abre Document PiP (~480x270 inicial), move o video, injeta CSS de tokens; fechar PiP devolve o video ao player; controles minimos voltar/volume/fechar (AC-16). Deteccao de suporte no boot; sem suporte -> fallback nativo.
6. ReconnectOverlay: quando o transmissor assistido entra em `reconnecting`, video mantem o ultimo quadro (sem frames novos, comportamento natural) + overlay com spinner e texto "reconectando..."; sucesso remove overlay (som "reconectado" ja vem do efeito global); timeout de 15s remove a transmissao e o player cai de volta para a grade com toast (RF-48/AC-35, AC-27).
7. Badge de qualidade do preset (ex "1080p30") vinda do TX_START ativo.

**Edge cases** (frontend):
- TX_STOP enquanto em fullscreen: sair de fullscreen programaticamente e voltar a grade com toast "transmissao encerrada".
- PiP aberto e transmissao morre: fechar PiP e devolver foco a janela principal.
- Fullscreen + PiP simultaneos do mesmo video: abrir PiP sai do fullscreen primeiro (video e um so).
- Usuario alterna rapidamente entre 2 streams: WATCHING_UPDATE com debounce de 300ms para nao inundar o mesh.
- Monitor secundario: fullscreen ocorre no display onde a janela esta (comportamento padrao; sem seletor de display no MVP).

**Done when**: com 2 instancias: fullscreen real cobre a tela sem cromo, controles somem em ~3s e voltam com atividade (com volume junto), Esc sai, volume/mute local nao afeta o outro espectador, PiP fica acima de outras janelas com video rodando, matar o transmissor mostra ultimo quadro + "reconectando..." e aos 15s a transmissao some; typecheck/lint passam.

**Commit**: `feat(ui): player with real fullscreen, local volume, pip window and reconnect overlay`

**Rollback**: reverter o commit; sala (Sprint 7) segue funcional com miniaturas.

---

### Sprint 9 - Empacotamento NSIS e auto-update (categoria: build)

**Descricao**: entrega instalavel: `ZoiDaGoiaba-Setup.exe` via electron-builder (NSIS, wizard, atalhos), electron-updater apontando para GitHub Releases do repo `Pontinn/screen-share`, UI de update (F4). NENHUM passo publica nada: o sprint termina com o artefato local e um passo manual documentado para o usuario.

**Prerequisitos**: Sprints 1 a 8 (app completo). **Risco**: medio (config NSIS/updater; SmartScreen risco R6).

**Arquivos**:
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\electron-builder.yml` (create: appId `com.pontin.zoidagoiaba`, productName `Zói da Goiaba`, target nsis, `artifactName: ZoiDaGoiaba-Setup.exe`, oneClick false, atalhos desktop + start menu, icone, publish provider github owner `Pontinn` repo `screen-share`)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\main\updater.ts` (create: electron-updater; check no boot + `update:check`; eventos mapeados para `update:status`; download automatico apos confirmacao; `update:install` -> quitAndInstall; TODO erro de "sem release" tratado como `none` silencioso, risco R9)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\main\index.ts` (edit: iniciar updater apos janela pronta, apenas em app empacotado)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\preload\index.ts` (edit: substituir stub de update pela implementacao)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\src\renderer\src\ui\components\UpdateNotice.tsx` (create: toast "nova versao disponivel" -> progresso -> "reiniciar para atualizar"; badge de versao no SettingsModal)
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\README.md` (create: instrucoes de build local `npm run dist` e o PASSO MANUAL de publicacao: criar GitHub Release com tag `v<versao>`, anexar `ZoiDaGoiaba-Setup.exe` + `latest.yml` gerados em `release\`; aviso do SmartScreen; NENHUM comando de push/publish automatizado)

**Features**: B6 (build) + F4 (frontend). F4 Consumes: `update:status`, `update:check`, `update:install`.

**Traces**: RF-43, RNF-01, RNF-02, RNF-09 (assets no pacote final).

**Steps**:
1. `electron-builder.yml` conforme acima; script `dist`: `electron-vite build && electron-builder --win --publish never` (`--publish never` e obrigatorio: garante zero interacao com GitHub no build).
2. Validar conteudo do pacote: audios presentes, fontes presentes, devtools desabilitado em producao.
3. `updater.ts` com `autoDownload: false` (baixa so apos o usuario aceitar no toast), fluxo de eventos completo para `update:status`.
4. UpdateNotice integrado; SettingsModal mostra versao atual (`app:get-version`) e botao "verificar atualizacoes" (`update:check`).
5. Rodar `npm run dist`, instalar `release\ZoiDaGoiaba-Setup.exe` em maquina/VM local: wizard next-next-finish, atalhos criados, app abre e funciona sem Node/terminal (AC-31).
6. Documentar no README o passo manual de release (SEM executar): o mecanismo de update so opera apos o usuario publicar um Release; ate la a checagem resulta `none` silencioso.

**Edge cases** (build):
- App em dev (`!app.isPackaged`): updater nunca inicia (evita erro de config).
- Sem rede na checagem: `update:status error` silencioso (sem toast de erro, so log).
- Release futura com tag sem `latest.yml`: updater reporta erro; README instrui anexar ambos os arquivos.
- Instalacao por usuario sem admin: NSIS `perMachine: false` (instalacao por usuario, sem UAC).

**Done when**: `npm run dist` gera `release\ZoiDaGoiaba-Setup.exe` localmente; instalacao manual cria atalhos e o app instalado completa uma sala entre 2 maquinas/instancias; nenhum push/publish ocorreu; typecheck/lint passam.

**Commit**: `feat(build): nsis installer ZoiDaGoiaba-Setup.exe and github releases auto-update wiring`

**Rollback**: reverter o commit; o app segue 100% utilizavel via `npm run dev`.

---

### Sprint 10 - Testes (dedicado) (categoria: outro)

**Descricao**: instalar o stack de testes e DEFINIR/implementar a suite: unit para o nucleo puro, integracao leve do protocolo, smoke E2E do app buildado em multi-janela na mesma maquina contra o PeerJS cloud real. Multi-peer entre REDES REAIS nao e automatizavel em CI: vira checklist manual (alimenta o checklist da Stage 5).

**Prerequisitos**: Sprints 1 a 9. **Risco**: baixo-medio (flakiness E2E dependente do servidor publico).

[ASSUMPTION] Nao existe framework de teste no projeto (greenfield). Proposta padrao da stack: **Vitest** (unit, nativo de Vite, mesmo pipeline de transform) + **Playwright** com `_electron` (smoke do app empacotado/buildado). Conforme preferencia global do usuario para testes de UI: execucoes de Playwright assistidas localmente usam `headless: false` e `slowMo: 2000`; na variante nao assistida (CI/local rapida) `slowMo` e reduzido, mantendo Electron sempre com janela visivel (Electron nao roda headless de verdade).

**Arquivos (create)**:
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\vitest.config.ts`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\room-code.test.ts`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\admission.test.ts`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\election.test.ts`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\room-state.test.ts`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\unit\protocol.test.ts`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\playwright.config.ts`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\e2e\smoke-session.spec.ts`
- `C:\Users\Usuario\Desktop\Pessoais\Projetos\screen-share\tests\MANUAL_CHECKLIST.md` (insumo direto do checklist manual da Stage 5)

**Features**: suite de testes (outro). **Traces**: valida transversalmente RF-01..RF-48 e RNF-04/07/11/12 conforme mapa abaixo.

**Testes definidos (automatizaveis)**:

*Unit (Vitest, nucleo puro):*
1. `room-code`: validacao RF-46 (limites 3/32, charset, mensagens discriminadas; AC-28), normalizacao case-insensitive (AC-29), formato do codigo aleatorio, `toPeerId` com prefixo (RF-03).
2. `admission`: room_full no limite exato (RF-07), banned por installId (RF-08), version_mismatch, payload invalido, aceite feliz com snapshot de roster (RF-06); kicked (nao banido) e aceito de volta (RF-32).
3. `election`: mais antigo vence (RF-35), desempate deterministico, ban list presente no estado herdado (RF-36).
4. `room-state`: guard de rosterVersion (replay/atraso), quarentena de HELLO, MOD_REMOVE forjado ignorado (RF-34), TX_START duplicado substitui (RF-18), TX_STOP por leaving (RF-20), efeitos de som corretos por `lastChange` conforme AC-23 rev 5 (kind join -> entrou; leave/timeout -> saiu; kick/ban -> "saiu" nos demais e "desconectado" apenas no alvo via MOD_REMOVE), regra de handover de queda do dono (aceita ROSTER_UPDATE de nao-dono somente com as condicoes (a)+(b)+(c) da secao 2.7; rejeita takeover forjado com dono saudavel ou remetente nao-vencedor), estado `unreachable` de par nao-dono com o membro ainda no roster do dono, transicao reconnecting -> timeout aos 15s remove membro e transmissao (RF-40/RF-48, com relogio fake).
5. `protocol`: type guards aceitam payloads validos e rejeitam malformados; envelope com `from` divergente rejeitado (base da matriz 5c).

*E2E smoke (Playwright + _electron, 1 maquina, 2-3 instancias, PeerJS cloud real):*
6. `smoke-session`: instancia A cria sala (codigo aleatorio capturado da UI), B entra pelo codigo, roster mostra 2 nicknames em ambas; A inicia transmissao de tela (fonte "Entire screen" via fluxo real de `capture:select-source`), B ve a miniatura aparecer e abre o player; A para; B ve a grade vazia; B sai; A sai. Asserts de UI apenas (presenca de elementos), sem assert de qualidade de video.
7. Extensao do smoke: kick pela UI do dono (B recebe tela "voce foi desconectado") e reentrada de B com sucesso (RF-31/RF-32).

*Manual (nao automatizavel; entra no MANUAL_CHECKLIST.md para a Stage 5):*
- Sessao real do grupo (5-6 pessoas, redes distintas): metrica de sucesso da PRD secao 1 completa.
- Qualidade percebida por preset (720p30/1080p30/1080p60) e caso filme com audio (AC-11), adaptacao nativa sob rede ruim (AC-30, exige rede degradada real).
- Loopback de audio em Windows 10 E 11 (RNF-01/RNF-10).
- Reconexao real por queda de Wi-Fi (AC-24/AC-27/AC-35 em rede fisica).
- NAT simetrico/CGNAT com mensagem de erro clara (AC-25, depende de rede especifica).
- PiP sobre jogos/apps em fullscreen de terceiros (AC-16).
- Instalador em maquina limpa + fluxo de auto-update com release real publicada pelo usuario (AC-26/AC-31).
- Performance com 8 participantes e multiplas transmissoes (RNF-06, pilar 1).

**Steps**:
1. Instalar/configurar Vitest (aliases iguais aos do electron-vite) e Playwright config com projeto electron.
2. Implementar os testes unit 1-5 (o nucleo do Sprint 3 ja nasceu puro para isso).
3. Implementar smoke 6-7 lancando o app via `_electron.launch` com `args` do build; duas instancias em paralelo com `userData` distintos (flag `--user-data-dir` propria via env `ZOI_USER_DATA_DIR` lida no main em modo teste).
4. Escrever `tests\MANUAL_CHECKLIST.md` com os itens manuais acima em formato de checklist executavel pelo grupo.
5. Scripts: `test` (vitest run), `test:e2e` (playwright test), `test:e2e:watchme` (variante assistida com slowMo 2000 conforme preferencia do usuario).

**Edge cases** (outro):
- PeerJS cloud fora do ar durante o E2E: teste marca skip com mensagem clara (nao falso-negativo).
- Corrida de duas instancias no mesmo `userData`: prevenida pelo isolamento por env no step 3.
- Timers de 15s em unit: relogio fake do Vitest (sem esperas reais).

**Done when**: `npm run test` verde com o mapa unit completo; `npm run test:e2e` verde na maquina de dev; `MANUAL_CHECKLIST.md` cobre todos os itens manuais listados; typecheck/lint passam.

**Commit**: `test: unit suite for protocol core and electron e2e smoke session`

**Rollback**: reverter o commit; app de producao intocado.

---

## 8. Matriz de cobertura da PRD

| Req | Onde e coberto (secao/sprint) |
|---|---|
| RF-01 | §2.5, S3 (room-code), S6 (CreateRoom) |
| RF-02 | S3 (config limites), S6 (stepper 2-8 padrao 6) |
| RF-03 | §2.5 (prefixo `zoidagoiaba-`, assumption A2), S3 `toPeerId` |
| RF-04 | §2.5 (unavailable-id), S4 step 1, S6 step 5 |
| RF-05 | S6 step 5, S7 step 1 (copiar tambem na sala) |
| RF-06 | §5.A admissao, S4 step 3, S6 (JoinRoom) |
| RF-07 | S3 (admission room_full), S4, S6 (mensagem "sala cheia") |
| RF-08 | §2.4 (installId), S3 (admission banned), S6 (mensagem) |
| RF-09 | §2.5 (morte da sala por arquitetura), S4 |
| RF-10 | §2b Room (imutavel), S6 step 7 (ausencia de UI, AC-10) |
| RF-11 | S6 (FirstRunScreen) |
| RF-12 | S2 (settings.ts) |
| RF-13 | S2 + S6 (SettingsModal round-trip) |
| RF-14 | §5.A (nickname no roster), S7 (cards) |
| RF-15 | S2 (capture.ts), S5, S7 (SourcePickerModal abas) |
| RF-16 | §2.6 (presets), S5, S7 (picker) |
| RF-17 | S2 (loopback), S5, S7 (toggle default ON) |
| RF-18 | S3 (estado), S5 (guard media-manager) |
| RF-19 | S5 (`switchSource`), S7 (botao trocar fonte) |
| RF-20 | §2b Transmission, S5 step 4 |
| RF-21 | S7 (TransmittingBar, nunca auto-hide) |
| RF-22 | S4/S5 (mesh N transmissores), S7 (grade) |
| RF-23 | §3 item 4 (thumbnails da stream real), S7 (StreamThumbnail), S8 (troca no player) |
| RF-24 | S5 step 3 (setParameters identicos em todos os senders) |
| RF-25 | S8 (requestFullscreen) |
| RF-26 | S8 step 3 (auto-hide 3s) |
| RF-27 | S8 (Esc nativo) |
| RF-28 | S8 (VolumeControl local) |
| RF-29 | S8 step 3 (volume dentro da barra auto-hide) |
| RF-30 | §2.8 (Document PiP), S8 step 5 |
| RF-31 | §5.A MOD_REMOVE kick, S4, S7 |
| RF-32 | S3 (kick nao entra na ban list), teste unit 2 |
| RF-33 | §5.A MOD_REMOVE ban + ban list, S4, S7 |
| RF-34 | §5c (matriz), S3 (reducer ignora forjado), S7 (UI so para dono) |
| RF-35 | S3 (election), S4 (OWNER_TRANSFER + eleicao por queda) |
| RF-36 | §3 item 3 (ban list replicada), S3/S4 |
| RF-37 | §5.A WATCHING_UPDATE, S7/S8 |
| RF-38 | S4 (stats-monitor + QUALITY_UPDATE), S7/S8 (ConnectionBars) |
| RF-39 | S2 (sound-player), S3 (efeitos), S4/S5/S7 (disparo) |
| RF-40 | §2.7, S4 (reconnection 15s, autoridade do dono) |
| RF-41 | S4 step 7 (toast identificando quem, som erro-conexao) |
| RF-42 | EXCLUIDO EXPLICITAMENTE (WON'T): nenhum TURN/relay em lugar algum da SPEC |
| RF-43 | S9 (electron-updater + UI) |
| RF-44 | EXCLUIDO EXPLICITAMENTE (WON'T): player unico; nenhuma feature de multi-janela de streams |
| RF-45 | EXCLUIDO EXPLICITAMENTE (WON'T): nenhum chat de texto/voz na SPEC |
| RF-46 | S3 (room-code), S6 (validacao inline), teste unit 1 |
| RF-47 | S5 (nenhuma logica propria; so preset + engine WebRTC) |
| RF-48 | §2.7, S8 step 6 (ReconnectOverlay + remocao aos 15s) |
| RNF-01 | S1 (target win), S9 (nsis), checklist manual (Win10 e 11) |
| RNF-02 | S9 (`ZoiDaGoiaba-Setup.exe`, wizard, atalhos, sem Node) |
| RNF-03 | §2.1 (mesh, sem SFU), S4/S5 |
| RNF-04 | §2.5/§2b (estado so nos clientes, morre com a sala) |
| RNF-05 | §2.6 (presets ate 1080p60), validacao no checklist manual |
| RNF-06 | S6 (aviso na criacao), S7 (aviso no picker), §2.6 (N copias) |
| RNF-07 | S8 step 3 (3s) |
| RNF-08 | §2.4 (sem login; nickname + codigo) |
| RNF-09 | S2 (assets .m4a/AAC empacotados, aceitos pela PRD rev 5; nota A3), S9 step 2 |
| RNF-10 | §2.6 (loopback do sistema inteiro), S7 (nota no picker) |
| RNF-11 | S5 (sem logica de bitrate propria), S4 (15s) |
| RNF-12 | S6 (theme.css com tokens do UISPEC, que implementa o roxo #9d00ff) |

Sem orfaos: 48/48 RF mapeados (45 implementados + 3 WON'T explicitamente excluidos), 12/12 RNF mapeados.

---

## 9. Assumptions e pontos em aberto

**Assumptions (marcadas ao longo do texto):**
- **A1 (testes)**: stack de testes proposta Vitest + Playwright `_electron` (nenhum framework existia; padrao da stack Vite/Electron).
- **A2 (prefixo de sala)**: forma NA REDE do prefixo e `zoidagoiaba-` (hifen) porque o charset de id do servidor publico PeerJS nao aceita `:`. Intencao de namespace do RF-03 preservada.
- **A3 (formato dos sons)**: os 7 arquivos sao `.m4a` (AAC), decodificados nativamente pelo Chromium e empacotados como estao, sem transcodificacao. A PRD (revisao 5, RNF-09) ja aceita m4a/AAC explicitamente: nao ha mais desvio, apenas registro da decisao.
- **A4 (ban list por installId)**: banimento chaveia por UUID local persistido; evadivel apagando settings; aceito para app privado entre amigos.
- **A5 (thresholds de qualidade)**: good/medium/bad iniciais (RTT 150ms/400ms, perda 5%) sao chute calibravel; ajuste fino na sessao real do grupo.
- **A6 (Document PiP)**: assumido disponivel na versao atual do Electron; fallback nativo definido (risco R7).
- **A7 (icone do app)**: nao existe asset de icone; Sprint 1 usa placeholder e a troca pelo definitivo fica como pendencia cosmetica (nao bloqueia nenhum requisito).
- **A8 (bitrates dos presets)**: valores de maxBitrate derivados da faixa da RNF-06 (3-4 Mbps em 1080p); calibraveis na sessao real.
- **A9 (tamanho do nickname)**: a PRD nao define limite de tamanho para o nickname; adotado 1 a 24 caracteres apos trim (cabe nos cards e badges do UISPEC sem truncamento agressivo).

**Pontos em aberto**: nenhum bloqueante. A publicacao do primeiro GitHub Release (que ativa o auto-update de verdade) e acao manual futura do usuario, fora desta SPEC por regra.

**SELF-CHECK (dry-run de implementabilidade):**
- Percorri os 10 sprints como implementador: cada arquivo referenciado como "edit" e criado em sprint anterior; nenhuma referencia circular (S3 nao depende de S2; S4 depende de 2+3; S5 de 2+4; UI 6-8 consome apenas contratos ja definidos verbatim nas secoes 5.A/5.B).
- Conferi que toda mensagem em `Consumes:` das features F1-F4 existe verbatim nas tabelas 5.A/5.B. Corrigido durante a checagem: F2 listava `HELLO` sem que a tabela 5c explicitasse o caso de quarentena no reducer (adicionado ao Sprint 3, step 2 e edge cases); e o Sprint 5 ganhou o reenvio de TX_START direto ao novato (sem isso, espectador tardio ficaria com stream sem metadata: furo real encontrado no dry-run).
- Conferi a matriz §8 contra a PRD: RF-01..RF-48 e RNF-01..RNF-12 todos presentes, 3 WON'T excluidos explicitamente.
- Conferi ausencia de qualquer passo de push/merge/publish: builds usam `--publish never`; release e passo manual documentado.
- Conferi ausencia do caractere de travessao no documento inteiro.
- Revisao da SPEC (NEEDS-CHANGES) aplicada e re-ancorada na revisao 5 da PRD: regra explicita de handover na queda do dono (condicoes (a)+(b)+(c) + re-broadcast 5s x3), consistente entre secao 2.7, matriz 5c, Sprint 4 (steps 6-8 e edge cases) e teste unit 4; estado `unreachable` para timeout de par nao-dono com retry de background de 10s; sons de kick/ban alinhados ao AC-23 rev 5 (alvo "desconectado", demais "saiu"); RF-04 restrito a criacao; RNF-09 aceita m4a (A3 sem desvio); Sprint 1 com versoes exatas e validacao antecipada de Electron >= 36 (loopback + Document PiP); retry de ingresso alinhado a ~10s; limite de nickname marcado como assumption A9; Toast adicionado ao inventario da F1.
- Self-check: PASS (com as correcoes do dry-run e da revisao aplicadas).
