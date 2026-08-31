---
feature: video-codec-upgrade
language: pt-BR
type: change
status: done
created: 2026-08-25
---

# IDEA: Codec de video melhor (VP9/AV1) + modo nitidez

## 1. Objetivo

A transmissao hoje negocia VP8 (default do PeerJS), o codec mais antigo e menos eficiente do WebRTC. Trocar a preferencia para VP9 ou AV1 entrega qualidade visivelmente melhor NO MESMO bitrate (AV1 ate ~50% mais eficiente que VP8). Contexto: usuario perguntou em 2026-08-25 como deixar a transmissao "mais bonita ainda"; orquestrador apontou o codec como a alavanca de maior impacto. Pilares do projeto (performance + qualidade de tela) sao exatamente o eixo desta feature.

## 2. Decisoes (lista viva)

- 2026-08-25: usuario decidiu que codec e FEATURE COMPLETA (pipeline forge normal), separada do quick de presets (hq-presets, ja feito). Motivo: mexe no coracao do caminho de midia recem estabilizado em campo (fallbacks de direcao, pull, watchdog) e tem matriz de risco real.
- 2026-08-25: o modo "nitidez" vai DE CARONA nesta feature (toggle no transmissor: contentHint 'detail' + degradationPreference 'maintain-resolution', para leitura/codigo/imagem parada; hoje e fixo 'motion' + 'maintain-framerate').
- 2026-08-25 (finalizacao com o usuario): TERA escape manual nas Configuracoes ("forcar modo compatibilidade/VP8"), persistido, como rede de seguranca se AV1/VP9 der problema em alguma maquina. Resolve P5.
- 2026-08-26 (retomada): toggle do modo nitidez vive na TransmittingBar, alternavel AO VIVO durante a transmissao (sem reiniciar). NAO persiste entre sessoes: sempre inicia desligado (padrao 'motion'), pois nitidez e situacional. Resolve P3.
- 2026-08-26: criterio de aceitacao (P4) = log + teste real. Objetivo: log mostra codec negociado + encoderImplementation (hw/sw) em cada maquina, sem regressao de fps/travamento e sem qualityLimitationReason 'cpu'. Subjetivo: uma sessao real do grupo confirmando qualidade igual ou melhor. Resolve P4.
- 2026-08-26: escolha de codec considera a SALA TODA: cada membro anuncia no mesh o que decodifica bem (mediaCapabilities.decodingInfo) e o transmissor escolhe um codec que sirva a todos (grupo tem notebook fraco que tambem assiste). Fecha a decisao de produto do P1 item 3; o COMO (formato do anuncio, compat com versao antiga que nao anuncia) fica para a SPEC.
- 2026-08-26: rebaixamento automatico e MUST nesta feature: se getStats do transmissor mostrar qualityLimitationReason 'cpu' persistente, trocar para codec mais leve e rediscar. Motivo do usuario: deteccao previa pode errar; sem isso, maquina fraca mal detectada trava ate alguem mexer na config. CUIDADO registrado: o redial deve REUSAR a mecanica estabilizada (watchdog/redial existentes) e nao pode disparar os logs vigiados por expectNoDirectionFallbacks fora de fallback real.
- 2026-08-26: quando fluidez e beleza conflitam em maquina fraca transmitindo, FLUIDEZ GANHA (ex: H264 por hardware liso vence VP9 por software mais eficiente por bit). O caso real do grupo e o notebook que trava.
- 2026-08-26: escape "forcar compatibilidade/VP8" vale para TRANSMITIR E RECEBER: maquina com escape ligado transmite em VP8 e se anuncia como "so VP8" para a sala. Consequencia aceita: com a escolha valendo para a sala toda, um membro com escape ligado leva o transmissor a usar VP8 para ele (rede de seguranca completa cobre bug de encode E de decode).
- 2026-08-26: hook tecnico confirmado pelo CONTEXT: PeerJS 1.5.5 nao da janela para setCodecPreferences (oferta criada sincronamente dentro de call()); o caminho e options.sdpTransform, simetrico em call() e answer(), cobrindo tambem o pull. Detalhe fino na SPEC.
- 2026-08-25: OBJETIVO DUPLO confirmado na conversa com o usuario. Caso real do grupo: um amigo com notebook antigo/fraco TRAVA o video ao transmitir (CPU nao da conta de capturar+codificar VP8 em software). Notebooks Intel antigos costumam ter encoder de H264 em HARDWARE (QuickSync): a matriz de escolha deve incluir H264-hw como opcao para maquina fraca (fluidez), alem de AV1/VP9 para maquina forte (qualidade). "Reduzir travamento em maquina fraca ao transmitir" vira objetivo e criterio de aceitacao ao lado de "mais bonito no mesmo bitrate". CUIDADO ja registrado: AV1/VP9 em software em maquina fraca PIORA o travamento; a detecao por maquina e obrigatoria, nunca preferencia global fixa.

## 3. Escopo

Dentro:
- Preferencia de codec nas chamadas de midia (setCodecPreferences ou equivalente), incluindo o caminho da chamada reversa (pull).
- Deteccao de capacidade por maquina (encoder de hardware disponivel?) para escolher AV1 vs VP9 vs manter VP8.
- Fallback limpo para VP8 quando o outro lado nao suporta ou esta em versao antiga.
- Toggle "modo nitidez" no fluxo de transmissao.
- Rebaixamento automatico de codec em qualityLimitationReason 'cpu' persistente no transmissor (must, decisao 2026-08-26), reusando a mecanica de watchdog/redial existente.
- Escape manual "forcar compatibilidade/VP8" nas Configuracoes, persistido, valendo para transmitir e receber.

Fora (NAO tocar):
- TURN/infra de rede; presets (ja resolvido no hq-presets); audio; simulcast/SFU (multi-espectador continua N copias).

## 4. Superficie de regressao

- TUDO que foi estabilizado em campo em 2026-08-25: fallbacks de direcao (mesh race, media pull, dial-back de admissao), watchdog de midia, compat com versao antiga. Cada um precisa continuar funcionando com o codec novo.
- Performance do transmissor: AV1/VP9 em SOFTWARE num PC fraco pode DERRUBAR fps e piorar a experiencia; a escolha errada de codec e pior que ficar no VP8.

## 5. Papeis e permissoes

N/A por acao de sala: escolha e automatica (ou local do transmissor, no caso do modo nitidez).

## 6. Entidades e ciclo de vida

- Preferencia persistida: "forcar compatibilidade/VP8" nas Configuracoes PERSISTE (rede de seguranca, decisao de 2026-08-25).
- Modo nitidez NAO persiste: estado de sessao, sempre inicia desligado (decisao de 2026-08-26).

## 7. Regras de negocio e exemplos

- Exemplo alvo: filme 1080p30 a 4 Mbps em AV1 deve aparentar qualidade proxima de VP8 a ~7-8 Mbps.
- Regra de escolha (rascunho, confirmar na SPEC): AV1 se encoder de HARDWARE presente; senao VP9 (bom equilibrio em software); senao VP8. Nunca escolher codec que force software pesado em maquina fraca.
- Regra de desempate (decisao 2026-08-26): fluidez ganha de beleza em maquina fraca. Exemplo trabalhado: notebook antigo com QuickSync transmite em H264 por hardware (liso), mesmo que VP9 por software renderia imagem melhor por bit; PC forte com encoder AV1 por hardware transmite AV1.
- A escolha deve servir a sala toda: exemplo trabalhado: transmissor forte (AV1 hw) + espectador notebook fraco que so decodifica bem H264/VP8 = transmissor NAO usa AV1; escolhe o melhor codec que todos decodificam bem.

## 8. Casos de borda / caminhos tristes

- Par com versao antiga (so VP8): negociacao tem que cair pra VP8 sem falha visivel.
- Encoder de hardware presente mas com bug de driver (tela preta/artefatos): precisa de caminho de escape (config? deteccao?). REFERENCIA CRUZADA (2026-08-25): a feature `black-screen-notice` (`.forge/ideas/black-screen-notice/`) foi criada para detectar ausencia de quadros no lado de quem assiste e avisar o espectador, e por decisao do usuario e feita ANTES desta. Ela cobre parcialmente este caso de borda e serve de INSTRUMENTO DE DIAGNOSTICO da troca de codec: com ela pronta, da para distinguir "nenhum quadro chegou" de "chegou e o driver cuspiu lixo". A leitura de getStats do lado RECEPTOR estabelecida la deve ser reaproveitada aqui (P1 desta ideia ja planeja ler encoderImplementation e qualityLimitationReason), em vez de criar uma estrutura paralela.
- Pull (chamada reversa): a preferencia de codec vale para a resposta do transmissor tambem.
- Troca de fonte/preset no meio da transmissao: renegociacao mantem o codec.
- CPU alta no transmissor durante AV1 software: criterio para nao escolher (ou rebaixar).

## 9. Referencia de UI

mode: project-identity. Superficie de UI minima: toggle do modo nitidez na TransmittingBar (alternavel ao vivo, decisao 2026-08-26) + escape "forcar compatibilidade/VP8" na SettingsModal.

## 10. Prioridades

- Must: melhorar qualidade percebida sem regressao de performance nem de compatibilidade; reduzir travamento de maquina fraca ao transmitir (encoder de hardware quando existir); rebaixamento automatico em limite de cpu (decisao 2026-08-26); escape manual "forcar VP8" persistido (transmitir e receber); log do codec negociado + encoderImplementation por maquina (base do criterio de aceitacao).
- Nice: modo nitidez (de carona, baixo risco).

## 11. Assumptions confirmadas

- CONFIRMADA 2026-08-26: grupo todo em Win11 com auto-update do app ligado; janela de versoes mistas e curta (dias). Fallback VP8 para versao antiga precisa funcionar, mas e transitorio.
- CONFIRMADA 2026-08-26: em maquina fraca, fluidez ganha de beleza (ver Decisoes).
- CONFIRMADA 2026-08-26: modo nitidez sempre inicia desligado (padrao 'motion' preserva o comportamento atual para video/jogo).

## 12. Pontos em aberto (lista viva)

- P1: Criterio exato de deteccao de encoder de hardware no Electron/Chromium. ESBOCO discutido com o usuario (2026-08-25), validar na SPEC: (1) DETECCAO com navigator.mediaCapabilities.encodingInfo({type:'webrtc', video:{contentType/width/height/framerate/bitrate do preset}}) por codec (AV1, VP9, H264): escolher o melhor com powerEfficient=true (hardware); sem hardware nenhum, VP8/VP9 conforme CPU. Complemento: RTCRtpSender.getCapabilities('video') para o que e negociavel. (2) VERIFICACAO pos-conexao via getStats(): encoderImplementation (hw vs sw de verdade) e qualityLimitationReason=='cpu' como gatilho de rebaixamento automatico + redial (mesmo espirito do watchdog de midia existente). (3) LADO RECEPTOR: decodificar tambem conta (AV1 sw em notebook velho engasga); considerar cada membro anunciar no mesh o que decodifica bem (mediaCapabilities.decodingInfo) e o transmissor escolher codec que sirva a sala toda: decisao da SPEC.
- P2: AV1 vs VP9 como alvo principal (medir nas maquinas reais do grupo; fica para SPEC/teste).
- P3: RESOLVIDO 2026-08-26 (TransmittingBar, ao vivo, sem persistencia; ver Decisoes).
- P4: RESOLVIDO 2026-08-26 (log + teste real; ver Decisoes).
- P5: RESOLVIDO 2026-08-25 (tera escape manual persistido nas Configuracoes; ver Decisoes).
- P6 (novo, 2026-08-26, para a SPEC): um codec UNICO para a sala vs negociar POR ESPECTADOR. Sao N RTCPeerConnections independentes, entao tecnicamente cada espectador poderia receber um codec diferente; mas isso pode multiplicar instancias de encoder no transmissor (custo de CPU) e conflita com o espirito do RF-24 (parametros identicos). A decisao do usuario (sala toda) assume codec unico; a SPEC deve validar se ha razao forte para por-espectador e o custo real do fanout N (unknown do CONTEXT: encoder compartilhado ou nao).
- P7 (novo, 2026-08-26, para a SPEC): como o rebaixamento automatico redisca sem disparar os fallbacks de direcao nem os logs vigiados por expectNoDirectionFallbacks; qual o criterio de "persistente" para qualityLimitationReason 'cpu' (evitar flapping).

## 13. APENDICE: contexto tecnico do projeto (para sessao com contexto ZERO)

Leia isto antes de qualquer coisa. Fonte da verdade complementar: `.forge/in-progress/p2p-screen-share-mvp/STATE_p2p-screen-share-mvp.md` (estado da feature mae) e `docs/DESENVOLVIMENTO.md` (build/release).

### O que e o app
"Zoi da Goiaba": screen share P2P para um grupo de amigos. Electron 43 + React + Vite + TypeScript, Windows-only, instalador NSIS com auto-update via GitHub Releases (repo Pontinn/zoi-da-goiaba). WebRTC mesh via PeerJS (servidor publico 0.peerjs.com + STUN do Google, SEM TURN por decisao RF-42). Sem servidor de midia: o transmissor codifica N copias, uma RTCPeerConnection por espectador. Sala de 2-8 pessoas por codigo; audio do sistema via loopback; sem microfone (voz do grupo e no Discord). Versoes: v0.1.1 MVP -> v0.1.2 diagnostico ICE -> v0.1.3 fallbacks de direcao -> v0.1.4 volume dos sons; v0.1.5 planejada (audio na chamada reversa + presets alta qualidade).

### Mapa do codigo (o que importa para ESTA feature)
- `src/renderer/src/services/media-manager.ts`: CORACAO da feature. `startTransmission` captura via `getDisplayMedia` (constraints do preset; `videoTrack.contentHint='motion'`), anuncia TX_START pelo mesh e chama `callPeer` para cada membro. `applySenderParameters` aplica `maxBitrate`/`maxFramerate` do preset e `degradationPreference='maintain-framerate'` em todos os senders (RF-24: parametros identicos). `onIncomingCall`/`answerCall` no espectador + watchdog de 10s (`MEDIA_STALL_TIMEOUT_MS`) que marca falha e dispara `startMediaPull`.
- CHAMADA REVERSA (pull): quando a chamada do transmissor nao completa o ICE, o ESPECTADOR disca com uma stream ficticia (canvas 2x2 `captureStream(0)` + faixa de audio muda de AudioContext, ver `createDummyStream`) e o transmissor responde `call.answer(localTransmission.stream)`. QUALQUER preferencia de codec precisa valer TAMBEM nesse caminho (a oferta e do espectador!).
- `src/renderer/src/services/peer-manager.ts`: dois peers PeerJS por app (member = mesh/midia, door = porta de ingresso do dono), reconexao/recuperacao de sinalizacao. `PEER_OPTIONS` em `src/shared/config.ts` e o ponto unico de config ICE.
- `src/renderer/src/services/mesh.ts`: DataConnections do mesh com corrida "primeiro que abrir vence" (`MESH_RACE_GRACE_MS=1500`, desempate lexicografico se ambas abrirem juntas).
- `src/renderer/src/services/session.ts`: orquestra reducer puro (core/room-state) + efeitos; admissao com dial-back do dono (`DOOR_DIALBACK_AFTER_MS=4000`).
- `src/renderer/src/services/ice-diagnostics.ts`: `observeIce(pc, tag)` loga estados e candidate-pair; tags media-out/media-in/media-pull-out/media-pull-in; `[ice-sig]` conta CANDIDATEs da sinalizacao. Logue o codec negociado aqui (getStats tem outbound-rtp/codec).
- `src/shared/presets.ts`: presets com teto de bitrate (720p30 2.5M, 1080p30 4M default, 1080p60 6M + os "alta" 8M/12M do quick hq-presets; confira o arquivo). `src/shared/protocol.ts`: PROTOCOL_VERSION, envelopes, TX_START carrega presetId.
- Logs persistentes: main captura console do renderer -> `%APPDATA%/Zói da Goiaba/logs/zoi-AAAA-MM-DD.log`; botao "Abrir pasta de logs" na SettingsModal.

### Historia de campo que NAO PODE REGREDIR (2026-08-25)
Entre dois PCs reais descobrimos NAT assimetrico: conexoes iniciadas por um lado nunca completavam (o lado com defeito recebe candidatos mas nunca ENVIA os dele pela sinalizacao). A solucao foi um conjunto de fallbacks de direcao (mesh race-to-open, media pull, dial-back de admissao), validados em campo. O E2E tem a assertion `expectNoDirectionFallbacks` garantindo que NENHUM fallback dispara em rede saudavel. Mudanca de codec nao pode quebrar nada disso, nem o watchdog, nem a compat com versao antiga (cair para VP8 na negociacao com cliente velho).

### Testes e comandos
`npm run typecheck` (node+web; atencao: tests/unit e typechecado pelo projeto WEB, sem types de node, entao nao importe modulos do main em teste unit), `npm run lint`, `npx vitest run` (~195 testes), `npm run test:e2e` (Playwright _electron, 5 testes, usa ZOI_USER_DATA_DIR para instancias isoladas, roda contra o PeerJS publico com captura real). Tudo verde antes de commitar; prettier ativo.

### Regras do usuario (INVIOLAVEIS)
- Push/merge/release SO com pedido explicito. Branch de trabalho ate hoje: feature/p2p-screen-share-mvp (repo ainda sem main); para ESTA feature, criar branch propria a partir do estado atual (confirmar base com o usuario).
- Identificadores de codigo 100% em ingles; strings de UI e comentarios em pt-BR SEM acento; PROIBIDO travessao (em dash) em qualquer texto gerado.
- Commits conventional em pt-BR sem acento, SEM assinatura Claude/Co-Authored-By.
- Roteamento de modelos do forge: review/spec = fable, implementacao = opus; orquestrador NUNCA edita codigo-fonte (sempre via agente).
- Pilares: performance do app + qualidade da tela compartilhada sao MAXIMAS. Nada de trabalho por frame; custo de CPU no transmissor e critico (codec em software pode custar fps: medir antes de adotar).
- Release: bump no package.json + `npm run dist` + `gh release create vX.Y.Z --target <branch>` com ZoiDaGoiaba-Setup.exe + latest.yml + blockmap (passo a passo em docs/DESENVOLVIMENTO.md).
- Usuario: Leonardo "Pontin". Grupo todo em Windows 11 (relato dele). Testes multi-PC dependem dos amigos dele: minimize rodadas, cada build de teste custa caro em coordenacao.
