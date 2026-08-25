---
feature: app-audio-capture
language: pt-BR
type: change
status: done
created: 2026-08-25
---

# IDEA: Captura de audio por aplicativo

## 1. Objetivo

O grupo usa o Discord para conversar por voz e o Zoi da Goiaba so para compartilhar a tela. Quando alguem transmite com som, o loopback captura TODO o audio do sistema, incluindo as vozes do Discord: quem esta falando ouve o proprio retorno vindo da transmissao (eco atrasado). Nas palavras do usuario: "quando compartilhamos a tela com som, ele pega o som da nossa voz no discord, entao a pessoa que fala fica ouvindo retorno da tela de quem ta compartilhando".

Objetivo: a captura de som da transmissao nao deve incluir o audio do Discord (ou, na variante invertida, deve incluir APENAS o som do app que interessa).

SEGUNDO PROBLEMA (adicionado 2026-08-25): quem transmite consegue abrir e ASSISTIR a PROPRIA tela transmitida dentro do app. Nas palavras do usuario: "quando eu compartilho a tela e assisto minha propria tela eu ouco tudo la e fica looping desgracado", "absurdamente alto e ensurdecedor". O audio reproduzido pelo proprio app e recapturado pelo loopback e o loop cresce sem parar. Pedido: o transmissor NUNCA pode ouvir nem VER a propria tela transmitida; no lugar deve aparecer uma mensagem tipo "Transmissao iniciada". A visao dos OUTROS participantes continua exatamente como esta.

## 2. Decisoes (lista viva)

- 2026-08-25: Todos os PCs do grupo rodam Windows 11 (relato do usuario), entao a API de Process Loopback do Windows (AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK, incluir ou excluir arvore de processos) esta disponivel em todas as maquinas. Sem gate de versao de SO no MVP da feature.
- 2026-08-25: DECIDIDO pelo usuario: variante A, EXCLUIR o Discord da captura ("a ideia e que nao capture o discord mesmo"). O resto do audio do sistema continua entrando na transmissao como hoje. A variante B (capturar so o app compartilhado) fica descartada como comportamento principal; se voltar, e como evolucao futura. Resolve o ponto P1.
- 2026-08-25: Antes de escrever codigo nativo, INVESTIGAR se o Electron 43 / Chromium ja expoe a captura de audio por janela no Windows (o Chromium ganhou suporte a window audio capture usando Process Loopback por baixo). Se expor, a feature pode dispensar o addon nativo.
- 2026-08-25 (finalizacao com o usuario): (a) exclusao e SO DO DISCORD, FIXA no codigo (sem lista de apps; lista fica como evolucao futura se pedirem); (b) SEMPRE LIGADA quando transmitir com som, sem toggle: zero fricao, com aviso discreto se a captura por processo falhar e degradar pro loopback atual. Resolve o desdobramento do P1, o P3 e o P4: sem UI de escolha e sem preferencia a persistir; a unica UI e o aviso de degradacao.

- 2026-08-25: NOVO PEDIDO incorporado a feature: bloquear auto-visualizacao do transmissor (nao ve nem ouve a propria transmissao; placeholder "Transmissao iniciada" ou similar). Espectadores nao mudam.
- 2026-08-25: DECIDIDO (P6): no lugar do tile da propria tela entra um CARD PERSISTENTE com status: mensagem "Transmissao iniciada" + info util (fonte compartilhada, com/sem audio, contagem de espectadores), visivel durante toda a transmissao.
- 2026-08-25: DECIDIDO (P7): a captura exclui a arvore de processos do Discord E do PROPRIO Zoi. Defesa em profundidade contra o loop e contra o vazamento do audio de outra transmissao assistida enquanto se transmite.
- 2026-08-25: Duas transmissoes simultaneas no grupo: "raro, mas possivel" (usuario). Tratar como borda suportada: transmitir e assistir outra transmissao ao mesmo tempo deve funcionar, e a exclusao do Zoi impede o som dela de vazar na sua.
- 2026-08-25 (fechamento da Stage 1): usuario aprovou o resumo final e autorizou MODO 100% AUTONOMO para o restante do pipeline: o orquestrador toma as decisoes que faltarem, priorizando (a) qualidade e performance do app e (b) usabilidade, e (c) nada do que ja foi feito pode ser danificado (mudancas no codigo existente sao esperadas quando necessarias, regressao de comportamento nao). Push/merge/release continuam SO com pedido explicito do usuario.
- 2026-08-25 (diretriz permanente do usuario para as decisoes autonomas): sempre escolher o que beneficia a EXPERIENCIA DO USUARIO: nao atrapalhar, nao complicar e nao perder qualidade. Criterio de desempate em qualquer decisao de produto/UI deste pipeline.
- 2026-08-25 (design/animacoes, pedido do usuario): o card de bloqueio da propria tela deve ter ANIMACOES caprichadas: entrada dos elementos com bounce, texto "Transmissao iniciada" aparecendo com transicao suave e bonita. Sao ideias do usuario; o orquestrador decide o que cabe, mas a regua e alta: "quero que fique bem impressionante no quesito animacoes", mesmo sendo app entre amigos. Limite: animacoes nao podem custar performance de video (pilar) nem atrapalhar a usabilidade (diretriz UX): preferir CSS transform/opacity acelerado por GPU, sem loops pesados.
- 2026-08-25 (design/animacoes, complemento do usuario): pode usar a LOGO DO APP nas animacoes para deixar mais caracteristico; nao se limitar a cores. Direcao para o UISPEC/implementacao: a logo como elemento central do card de status (ex: logo com bounce na entrada), mantendo os limites de performance.

## 3. Escopo

Dentro:
- Pipeline de captura de audio da transmissao (hoje: loopback do sistema inteiro via getDisplayMedia + selectSource no main).
- Auto-visualizacao do transmissor: bloquear ver/ouvir a propria transmissao; placeholder "Transmissao iniciada" no lugar da tela propria.
- UI: apenas o card persistente de status do transmissor e o aviso de degradacao (toast padrao). SEM UI de escolha de modo (decisao P3). Padrao visual existente (precedentes: ReconnectOverlay/MediaFailureOverlay, pushToast warning).
- Windows apenas (o app ja e Windows-only).

Fora (NAO tocar):
- Correcao dos bugs de conexao ICE/NAT do teste multi-PC (trilha separada, feature p2p-screen-share-mvp).
- Captura de microfone (segue fora, decisao do MVP original).
- TURN/infra de rede.
- Voz dentro do proprio Zoi (o Discord continua sendo o canal de voz do grupo).

## 4. Superficie de regressao

- A captura atual (tela/janela + som do sistema via loopback) deve continuar funcionando como fallback e como comportamento padrao ate o usuario escolher o modo novo.
- Transmissao sem audio, presets de qualidade, troca de fonte, PiP, indicadores: nada disso pode quebrar.
- Pilares do projeto: performance e qualidade da tela transmitida sao maximas; a captura de audio nao pode custar frames de video.

## 5. Papeis e permissoes

CONFIRMADO 2026-08-25 (finalizacao): igual pra todo transmissor, dono ou membro. Bloqueio da propria tela + card de status + exclusao de audio sao locais de quem transmite, sem regra por papel.

## 6. Entidades e ciclo de vida

- Nenhuma entidade nova e nada a persistir (P3/P4 resolvidos: sem preferencia, exclusao fixa sempre ligada). O "ciclo de vida" relevante e o da transmissao: iniciar (card de status aparece pro transmissor), trocar fonte (card atualiza a fonte, bloqueio continua), parar (card some, grade volta ao normal), retransmitir (tudo se reaplica).

## 7. Regras de negocio e exemplos

- Variante A (excluir): capturar todo o sistema MENOS as arvores de processos do Discord E do proprio Zoi (decisao P7). Exemplo: filme no MPV + Discord tocando vozes + Zoi tocando a transmissao de outra pessoa -> o espectador ouve o filme; nao ouve as vozes nem a outra transmissao.
- Variante B (incluir apenas): capturar SO a arvore de processos do app escolhido. Exemplo: transmitindo o monitor inteiro com filme no MPV -> escolher "MPV" como fonte de audio; espectador ouve so o filme, mesmo com Discord e WhatsApp apitando.
- Regra comum: "app" significa ARVORE de processos (Discord e navegadores tem varios processos filhos).
- Auto-visualizacao: se EU transmito, a minha propria transmissao nunca toca video nem audio na MINHA maquina; vejo apenas o placeholder. Exemplo: sala com Leo (transmitindo) + Bruna + Joao: Leo ve "Transmissao iniciada"; Bruna e Joao veem e ouvem a tela do Leo normalmente. Se a Bruna tambem transmitir, Leo ve/ouve a transmissao da Bruna normalmente (o bloqueio e so da PROPRIA).

## 8. Casos de borda / caminhos tristes

- O app de audio escolhido fecha no meio da transmissao (variante B): o que acontece? (silencio? aviso? voltar pro loopback?)
- Compartilhar o monitor inteiro mas querer o audio de um app especifico (fonte de video != fonte de audio).
- App alvo abre processos novos depois que a captura comecou (a API de process tree cobre? verificar).
- Discord instalado de formas diferentes (Discord/DiscordPTB/Canary, ou aberto no navegador): como identificar o processo a excluir na variante A.
- Fallback se a captura por processo falhar em runtime: degradar para o loopback atual com aviso, nunca transmitir mudo sem avisar.
- Maquina fora do esperado (alguem entra com Win10 antigo): comportamento de degradacao.
- Realimentacao de audio: transmissor abre a propria tela transmitida no app -> loop infinito ensurdecedor (problema relatado; vira impossivel com o bloqueio de auto-visualizacao, e a exclusao do proprio app da captura pode servir de defesa extra, ver P7).
- PiP / troca de fonte / re-transmissao: o bloqueio da propria tela precisa valer em TODOS os caminhos de exibicao (tile normal, PiP, apos trocar de fonte, apos parar e retransmitir).

## 9. Referencia de UI

mode: project-identity. Seguir o padrao visual existente (tema escuro + roxo #9d00ff); precedentes de overlay: ReconnectOverlay/MediaFailureOverlay. DIRECAO DE MOTION (2026-08-25): o card de status da propria transmissao e vitrine de animacao: entrada com bounce dos elementos, texto com fade/slide suave, nivel "bem impressionante". Detalhar no UISPEC (Stage 3b) tokens de motion coerentes com o app.

## 10. Prioridades

- Must: as vozes do Discord nao vazarem na transmissao (o problema relatado).
- Must: transmissor nunca ver/ouvir a propria transmissao (mata o loop de realimentacao).
- Should: animacoes de alto nivel no card de bloqueio (bounce na entrada, texto suave); polish visual impressionante sem custo de performance.
- Nice: seletor generico de app de audio (qualquer app, nao so Discord); lembrar a escolha entre sessoes.

## 11. Assumptions confirmadas

- "Acredito que todos estejam usando win11" (usuario, 2026-08-25): tratado como confirmado para planejamento, com degradacao educada como borda (secao 8) caso apareca excecao.
- 2026-08-25 (finalizacao): papeis confirmados como N/A (comportamento igual pra dono e membro; ver secao 5).
- 2026-08-25 (finalizacao): copy exata do card ("Transmissao iniciada" + detalhes) pode ser lapidada na implementacao no tom do app (pt-BR sem acento); nao precisa de aprovacao previa da copy.

## 12. Pontos em aberto (lista viva)

- P1: RESOLVIDO 2026-08-25 (incluindo o desdobramento): variante A, excluir SO o Discord, fixo no codigo, sempre ligado (decisoes na secao 2).
- P2: Resultado da investigacao tecnica: Electron 43 expoe window/process audio capture do Chromium? Se nao, addon nativo (N-API) + injecao da track no WebRTC (MediaStreamTrackGenerator ou similar).
- P3: RESOLVIDO 2026-08-25: sem UI de escolha; exclusao sempre ligada (secao 2). So o aviso de degradacao.
- P4: RESOLVIDO 2026-08-25: nada a persistir (sem preferencia).
- P5: Comportamento quando o app de audio fecha no meio da transmissao (borda da secao 8).
- P6: RESOLVIDO 2026-08-25: card persistente com status (mensagem + fonte + com/sem audio + contagem de espectadores). Decisao na secao 2.
- P7: RESOLVIDO 2026-08-25: sim, excluir tambem o proprio Zoi da captura. Decisao na secao 2.

## 13. APENDICE: contexto tecnico do projeto (para sessao com contexto ZERO)

Leia isto antes de qualquer coisa. Fonte da verdade complementar: `.forge/in-progress/p2p-screen-share-mvp/STATE_p2p-screen-share-mvp.md` (estado da feature mae) e `docs/DESENVOLVIMENTO.md` (build/release).

### O que e o app
"Zoi da Goiaba": screen share P2P para um grupo de amigos. Electron 43 + React + Vite + TypeScript, Windows-only, instalador NSIS com auto-update via GitHub Releases (repo Pontinn/zoi-da-goiaba). WebRTC mesh via PeerJS (servidor publico + STUN Google, SEM TURN por decisao RF-42), sem servidor de midia. Sala de 2-8 por codigo. Voz do grupo e no DISCORD (o app nao captura microfone de proposito); o app transmite tela + som do sistema. Versoes: v0.1.1 MVP -> v0.1.2 diagnostico ICE -> v0.1.3 fallbacks de direcao -> v0.1.4 volume dos sons; v0.1.5 planejada (audio na chamada reversa + presets alta qualidade).

### Como a captura de audio funciona HOJE (o que esta feature muda)
- `src/main/capture.ts` + `src/main/ipc-handlers.ts`: o renderer chama `window.zoi.capture.selectSource({sourceId, withAudio})` via IPC; o main configura o handler de display media do Electron (setDisplayMediaRequestHandler / desktopCapturer) com loopback de audio do SISTEMA INTEIRO quando withAudio=true.
- `src/renderer/src/services/media-manager.ts`: `startTransmission` faz `getDisplayMedia({video: constraints do preset, audio: withAudio})`; se o loopback nao vier, degrada para so video com warn (RNF-10). `videoTrack.contentHint='motion'`. A stream (video+audio) e enviada por RTCPeerConnection para cada espectador; ha tambem a CHAMADA REVERSA (pull): quando a chamada do transmissor nao completa (NAT), o ESPECTADOR disca com stream ficticia e o transmissor responde `call.answer(localTransmission.stream)`. A track de audio substituta desta feature precisa funcionar nos DOIS caminhos (basta ela estar na `localTransmission.stream`).
- UI da transmissao: `SourcePickerModal.tsx` (fonte monitor/janela, toggle "com audio", preset), `TransmittingBar.tsx`, `SettingsModal.tsx` (settings persistidas via `src/main/settings.ts` + IPC `settings:set` parcial; exemplo recente: `soundVolume`). Siga esse padrao para persistencia.
- Sons do proprio app (entrar/sair): `sound-player.ts`, NAO tem relacao com o audio da transmissao.

### Caminho tecnico ja investigado (2026-08-25)
- API alvo: Process Loopback do Windows (`AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK` com `PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE`), Win10 2004+; grupo todo em Win11 (sem gate de SO). E como o OBS faz o Application Audio Capture.
- ANTES de codigo nativo, investigar se o Electron 43/Chromium ja expoe captura de audio por janela/processo no Windows (o Chromium ganhou window audio capture usando essa API por baixo); se expor, dispensa addon.
- Caso precise de addon nativo: N-API (C++/Rust) capturando PCM da arvore de processos excluida e injetando como track WebRTC no renderer (MediaStreamTrackGenerator/Insertable Streams), substituindo a track de loopback do getDisplayMedia. Atencao a sincronizacao A/V e resampling.
- Discord tem VARIOS processos (arvore) e variantes (Discord, PTB, Canary, navegador): identificar por nome de executavel da arvore.
- Fallback obrigatorio: se a captura por processo falhar em runtime, degradar para o loopback atual COM AVISO (nunca transmitir mudo em silencio).

### Historia de campo que NAO PODE REGREDIR (2026-08-25)
Fallbacks de direcao para NAT assimetrico (mesh race-to-open, media pull, dial-back de admissao) foram estabilizados com teste de campo caro. O E2E tem `expectNoDirectionFallbacks` no caminho feliz. O pipeline de midia (incluindo pull) precisa continuar intacto; esta feature idealmente so troca a ORIGEM da track de audio local.

### Testes e comandos
`npm run typecheck` (node+web; tests/unit e typechecado pelo projeto WEB sem types de node: nao importe modulos do main em teste unit), `npm run lint`, `npx vitest run` (~195 testes), `npm run test:e2e` (Playwright _electron, 5 testes, ZOI_USER_DATA_DIR para instancias isoladas). Tudo verde antes de commitar; prettier ativo. Addon nativo (se houver) precisa entrar no build do electron-builder (`npm run dist`) sem quebrar o instalador.

### Regras do usuario (INVIOLAVEIS)
- Push/merge/release SO com pedido explicito. Branch de trabalho ate hoje: feature/p2p-screen-share-mvp (repo ainda sem main); para ESTA feature, criar branch propria (confirmar base com o usuario).
- Identificadores de codigo 100% em ingles; strings de UI e comentarios em pt-BR SEM acento; PROIBIDO travessao (em dash) em qualquer texto gerado.
- Commits conventional pt-BR sem acento, SEM assinatura Claude/Co-Authored-By.
- Roteamento de modelos do forge: review/spec = fable, implementacao = opus; orquestrador NUNCA edita codigo-fonte (sempre via agente).
- Pilares: performance do app + qualidade da tela compartilhada sao MAXIMAS; captura de audio nao pode custar frames de video.
- Release: bump no package.json + `npm run dist` + `gh release create vX.Y.Z --target <branch>` com ZoiDaGoiaba-Setup.exe + latest.yml + blockmap (docs/DESENVOLVIMENTO.md).
- Usuario: Leonardo "Pontin". Testes multi-PC dependem dos amigos: minimize rodadas de teste em campo.
