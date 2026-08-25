---
feature: app-audio-capture
language: pt-BR
created: 2026-08-25
---

# PRD - app-audio-capture

## Historico de Revisoes

| Data | Revisao | O que mudou |
|------|---------|--------------|
| 2026-08-25 | 1 | Criacao da PRD a partir da IDEA e do CONTEXT da Stage 1 (exclusao de audio do Discord/Zoi na transmissao + bloqueio de auto-visualizacao do transmissor). |
| 2026-08-25 | 2 | Incorporada a diretriz de design do usuario (IDEA secao 2 ultimas decisoes, secao 9 e secao 10): motion design caprichado no card de status (entrada com bounce, texto com fade/slide, detalhes secundarios escalonados, contagem animada). Novos RF-17/RF-18 [SHOULD], nova RNF-09 [MUST] tornando o limite de performance mensuravel, novos AC-17/AC-18. |
| 2026-08-25 | 3 | Apontamentos do forge-review: (BLOCKER) incorporada a decisao da IDEA de usar a logo do app como elemento central da animacao de entrada do card (novo RF-20 [SHOULD], nova AC-20); (WARNING) novo RF-06 [MUST] cobrindo Discord fechado-e-reaberto durante a transmissao e processos novos abertos apos a captura comecar, com nova AC-19; (WARNING) fingerprint da IDEA recalculado no Baseline (IDEA mudou de novo apos a revisao 2); (NIT) adicionada a diretriz permanente de desempate UX-first (secao 1); (NIT) nova AC-21 cobrindo RNF-07 (nao-persistencia). Toda a secao 4 (Requisitos Funcionais) e a secao 6 (Criterios de Aceitacao) foram renumeradas sequencialmente para acomodar os RFs novos nos seus grupos naturais; referencias cruzadas em ACs e em Questoes em Aberto foram atualizadas. |

## Baseline (ancora de drift)

- **HEAD**: `156693a385f3492d3efbbf9f7ac7f626a4c42826`
- **Fingerprint IDEA_app-audio-capture.md** (git hash-object): `3ed100aaed33cb02c98963697f8233e95d17ae6e` (recalculado 2026-08-25 na revisao 3, apos a IDEA ganhar a decisao de usar a logo do app nas animacoes; fingerprint anterior da revisao 1: `c34a8b58886ced48c080dc67a75d2c78670e06b6`)
- **Fingerprint CONTEXT_app-audio-capture.md** (git hash-object): `ebc5cadccadff0c82df48c6237a854067b4c5af0`

---

## 1. Objetivo e Visao

**Problema (dois problemas relacionados, relatados pelo usuario):**

1. O grupo usa o Discord para conversar por voz e o Zoi da Goiaba so para compartilhar a tela. Quando alguem transmite com som, o loopback de audio do Windows captura TODO o audio do sistema, incluindo as vozes do Discord: quem esta falando ouve o proprio retorno vindo da transmissao (eco atrasado, "retorno da tela de quem ta compartilhando").
2. Quem transmite consegue abrir e assistir a PROPRIA tela transmitida dentro do app. O audio reproduzido pelo proprio app e recapturado pelo loopback, e o loop de realimentacao cresce sem parar ("fica looping desgracado", "absurdamente alto e ensurdecedor").

**Para quem**: o mesmo grupo fechado de amigos do MVP original (uso privado), especificamente quem transmite tela com audio.

**Por que agora**: os dois problemas tornam o uso conjunto de Discord (voz) + Zoi da Goiaba (tela) desconfortavel ou inutilizavel com audio ligado; sao bugs de experiencia relatados em uso real pelo proprio grupo.

**Impacto esperado**: quem fala no Discord deixa de ouvir retorno da propria voz vindo de uma transmissao; quem transmite deixa de sofrer o loop ensurdecedor ao tentar ver a propria tela, vendo em vez disso um card de status. O restante da experiencia (visao dos demais participantes, pipeline de video) permanece identico ao que existe hoje.

**Metrica de sucesso** [ASSUMPTION: a IDEA nao define uma metrica de sucesso explicita para esta feature (diferente da PRD do MVP original, que teve uma metrica confirmada pelo usuario); a metrica abaixo e proposta com base nos dois "Must" da secao 10 da IDEA e no pilar de performance ja estabelecido no projeto]: numa sessao real do grupo com o Discord aberto e pelo menos um participante transmitindo tela com audio do sistema ligado, (a) nenhum participante que fala no Discord ouve retorno da propria voz vindo da transmissao; (b) o transmissor, ao tentar abrir a propria transmissao por qualquer caminho do app, encontra sempre o card de status (nunca video ou audio da propria tela); e (c) nenhuma dessas duas correcoes causa queda perceptivel de frames de video nem quebra algum teste automatizado ja existente no projeto.

**Diretriz de desempate (UX-first)**: o usuario autorizou modo autonomo para as decisoes que faltarem neste pipeline (IDEA secao 2) com um criterio de desempate permanente: sempre escolher o que beneficia a experiencia do usuario, nao atrapalhar, nao complicar e nao perder qualidade. Essa diretriz vale para qualquer decisao de produto/UI ainda em aberto nesta feature (incluindo as que o SPEC precisar tomar) e deve ser herdada pelas proximas etapas do pipeline.

## 2. Publico-Alvo (Personas)

- **Transmissor**: participante do grupo (dono ou membro, sem distincao de papel - ver secao 4) que compartilha a propria tela com audio do sistema ligado. E quem sofre os dois problemas descritos e quem ve o card de status e o aviso de degradacao.
- **Espectador**: participante que assiste a transmissao de outra pessoa. A experiencia dele nao muda nesta feature: continua vendo e ouvindo a transmissao normalmente, sem as vozes do Discord do transmissor nem a transmissao de terceiros que o transmissor porventura esteja assistindo.

## 3. Escopo

**Dentro do escopo:**
- Exclusao automatica, sempre ativa (sem toggle, sem preferencia persistida), das arvores de processos do Discord e do proprio Zoi da Goiaba do audio capturado numa transmissao com "audio do sistema" ligado.
- Degradacao para o loopback de audio do sistema inteiro (comportamento atual), com aviso discreto ao transmissor, quando a captura por processo falhar ao armar ou durante a transmissao.
- Bloqueio de auto-visualizacao: o transmissor nunca ve nem ouve a propria transmissao, em nenhum caminho de exibicao do app (tile no grid, faixa lateral, PlayerView, fullscreen, picture-in-picture).
- Card persistente de status no lugar do proprio tile/player, com mensagem de transmissao ativa, fonte compartilhada, indicacao de com/sem audio e contagem de espectadores.
- Reaplicacao do bloqueio e do card em toda troca de fonte, parada e retransmissao.
- Cenario de transmitir e assistir outra transmissao ao mesmo tempo (raro, mas suportado): o audio da transmissao alheia assistida nao pode vazar para dentro da propria transmissao.
- UI apenas do card de status e do aviso de degradacao (toast padrao), sem tela/opcao nova de configuracao.
- Windows apenas (o app ja e Windows-only).

**Fora do escopo / NAO fazer:**
- Correcao dos bugs de conexao ICE/NAT do teste multi-PC (trilha separada, feature p2p-screen-share-mvp).
- Captura de microfone (continua fora, decisao do MVP original; a voz do grupo continua sendo so o Discord).
- TURN ou qualquer infraestrutura de rede nova.
- Voz dentro do proprio Zoi da Goiaba (o Discord continua sendo o canal de voz do grupo).
- Seletor generico de aplicativo de audio (capturar so o app escolhido, "variante B"): descartado como comportamento principal; fica registrado como possivel evolucao futura, nao construido nesta feature.
- Lembrar/persistir qualquer escolha de audio entre sessoes: nao havera preferencia nova em settings.
- Qualquer mudanca na experiencia dos espectadores de uma transmissao alheia: eles continuam vendo/ouvindo exatamente como hoje.
- Qualquer UI nova de escolha de modo de captura de audio (sem toggle, sem tela de configuracao adicional).

## 4. Requisitos Funcionais

Nota sobre papeis: os requisitos desta secao valem igualmente para qualquer transmissor, seja ele o dono da sala ou um membro comum (confirmado na IDEA, secao 5) - nao ha matriz de permissoes nova nem distincao de comportamento por papel.

**Exclusao de audio da transmissao**

- **RF-01** [MUST] Sempre que uma transmissao for iniciada com "audio do sistema" ligado, a captura deve excluir automaticamente do audio capturado as arvores de processos do Discord (aplicativo desktop, cobrindo as variantes conhecidas: Discord, Discord PTB, Discord Canary) e do proprio Zoi da Goiaba, sem qualquer opcao de configuracao visivel para o usuario.
- **RF-02** [MUST] A exclusao descrita em RF-01 deve se aplicar a toda a arvore de processos do app alvo (processo principal e processos filhos), nao apenas ao executavel principal.
- **RF-03** [MUST] Nao deve existir toggle, preferencia ou configuracao persistida para ligar/desligar a exclusao: ela e sempre aplicada quando "audio do sistema" estiver ativo, e nada relacionado a ela e salvo entre sessoes.
- **RF-04** [WONT] Discord acessado por navegador (web, nao aplicativo desktop) nao e tratado como uma arvore de processo isolavel do Discord; esse cenario fica fora da exclusao nesta feature (limitacao conhecida: o audio do navegador com Discord aberto continua entrando na captura, como hoje).
- **RF-05** [MUST] Se o Discord (em qualquer variante desktop coberta por RF-01) fechar durante uma transmissao ja em andamento, a transmissao deve continuar ativa, sem cair e sem ficar muda; esse cenario e tratado como uma possivel falha/indisponibilidade da captura por processo, sujeito ao comportamento de degradacao do RF-08.
- **RF-06** [MUST] Se o Discord (qualquer variante coberta por RF-01) for fechado e reaberto enquanto uma transmissao com audio estiver ativa, ou se o Discord (ou o proprio Zoi da Goiaba) abrir processos novos depois que a captura ja tiver comecado, esses processos novos devem permanecer excluidos do audio transmitido: as vozes do Discord nao podem voltar a aparecer na transmissao sem que a exclusao seja reaplicada. Se a exclusao nao puder ser reaplicada automaticamente para os processos novos, o comportamento de degradacao com aviso do RF-08 se aplica; em nenhum caso deve haver vazamento silencioso das vozes do Discord nem a transmissao seguir muda silenciosamente.
- **RF-07** [MUST] Em uma maquina onde a captura de audio por processo nao estiver disponivel (ex.: versao do Windows abaixo do minimo exigido pela API usada), o sistema deve identificar essa indisponibilidade e aplicar o comportamento de degradacao do RF-08 em vez de falhar a transmissao ou de expor algum erro cru ao usuario.
- **RF-08** [MUST] Se a captura por processo falhar, seja ao armar a transmissao, seja durante uma transmissao em andamento (incluindo os cenarios de RF-05 e RF-06), o sistema deve degradar automaticamente para o loopback de audio do sistema inteiro (o comportamento de hoje, sem exclusao) e exibir um aviso discreto ao transmissor; a transmissao nunca deve seguir muda silenciosamente quando audio foi solicitado.

**Bloqueio de auto-visualizacao**

- **RF-09** [MUST] Enquanto uma transmissao propria estiver ativa, o transmissor nunca deve conseguir ver nem ouvir a propria transmissao, em nenhum caminho de exibicao do app: tile no grid principal, faixa lateral (strip), PlayerView, fullscreen e picture-in-picture.
- **RF-10** [MUST] No lugar do tile/player da propria transmissao, o transmissor deve ver um card persistente de status contendo: mensagem indicando que a transmissao esta ativa (ex.: "Transmissao iniciada"), a fonte que esta sendo compartilhada, se a transmissao esta com ou sem audio, e a contagem atual de espectadores.
- **RF-11** [MUST] A contagem de espectadores exibida no card deve refletir, em tempo real, quantos participantes estao assistindo aquela transmissao no momento (aumentando/diminuindo conforme pessoas comecam ou param de assistir).
- **RF-12** [MUST] Ao trocar de fonte durante uma transmissao ativa, o card de status deve atualizar a fonte exibida e o bloqueio de auto-visualizacao deve permanecer valendo, sem nenhuma janela em que o proprio video ou audio fique momentaneamente visivel/audivel.
- **RF-13** [MUST] Ao parar a transmissao, o card de status deve desaparecer e a area voltar ao comportamento normal (grid/empty-state), permitindo ao ex-transmissor assistir normalmente qualquer transmissao ativa, inclusive a de outra pessoa.
- **RF-14** [MUST] Ao retransmitir (iniciar uma nova transmissao apos ter parado uma anterior), o bloqueio de auto-visualizacao e o card de status devem se reaplicar integralmente para a nova transmissao.
- **RF-15** [MUST] O bloqueio de auto-visualizacao se aplica exclusivamente a propria transmissao do usuario; assistir a transmissao de qualquer outro participante, inclusive enquanto se transmite, deve funcionar normalmente, com video e audio.

**Transmitir e assistir simultaneamente**

- **RF-16** [MUST] Um participante deve conseguir transmitir a propria tela e, ao mesmo tempo, assistir a transmissao de outro participante, sem que isso afete o bloqueio de auto-visualizacao (que continua se aplicando so a propria transmissao) nem a exclusao de audio (RF-01).
- **RF-17** [MUST] Quando um participante estiver transmitindo e assistindo a transmissao de outro ao mesmo tempo, o audio da transmissao alheia que ele assiste nao deve vazar para dentro da propria transmissao (a exclusao do proprio Zoi da Goiaba, RF-01, atua como defesa em profundidade para esse cenario).

**Motion do card de status**

- **RF-18** [SHOULD] Ao ser exibido no inicio de uma transmissao, o card de status deve entrar com uma animacao caprichada: os elementos surgem com efeito de bounce/spring (escala), o texto principal ("Transmissao iniciada" ou equivalente) aparece com uma transicao suave de fade/slide, e os detalhes secundarios (fonte compartilhada, com/sem audio, contagem de espectadores) entram em sequencia escalonada (staggered), nao todos de uma vez.
- **RF-19** [SHOULD] Quando a contagem de espectadores exibida no card mudar enquanto ele estiver visivel, o novo valor deve aparecer com uma transicao animada, em vez de uma troca abrupta e instantanea do numero.
- **RF-20** [SHOULD] A animacao de entrada do card de status deve usar a logo do app como elemento central e caracteristico do card (ex.: a logo entrando com o efeito de bounce descrito em RF-18), em vez de se apoiar apenas em cores e texto para o efeito de polish.

**Papeis**

- **RF-21** [MUST] Todos os requisitos desta secao (exclusao de audio, bloqueio de auto-visualizacao, card de status e sua animacao) se aplicam igualmente a qualquer transmissor, seja ele o dono ou um membro comum da sala; nao ha diferenciacao de comportamento por papel.

## 5. Requisitos Nao-Funcionais

- **RNF-01** [MUST] A captura/filtragem de audio nao pode custar frames de video: o pipeline de video deve manter a mesma performance (resolucao e fps do preset escolhido) com a exclusao de audio ativa, igual ao que ocorre hoje sem ela. Este e um dos pilares do projeto (performance e qualidade da tela transmitida sao maximas).
- **RNF-02** [MUST] Os fallbacks de direcao de conexao ja estabilizados (mesh race-to-open, media pull, dial-back de admissao) nao podem regredir; o teste E2E do caminho feliz que garante ausencia de fallbacks (`expectNoDirectionFallbacks`) deve continuar passando.
- **RNF-03** [MUST] A suite de testes completa do projeto (typecheck node+web, lint, `npx vitest run`, `npm run test:e2e`) deve continuar passando (verde) apos a implementacao desta feature.
- **RNF-04** [MUST] Toda string de UI nova (card de status, aviso de degradacao) deve estar em portugues (pt-BR), sem caracteres acentuados, seguindo a convencao ja usada no restante do app.
- **RNF-05** [MUST] O card de status e o aviso de degradacao devem seguir a identidade visual ja existente do app (tema escuro + roxo #9d00ff), reaproveitando os padroes visuais ja usados: cartao central estilo ReconnectOverlay/MediaFailureOverlay para o card; toast tom warning (padrao ja usado pelo aviso de degradacao de audio existente) para o aviso.
- **RNF-06** [MUST] A mudanca na origem da faixa de audio local (com exclusao aplicada) nao pode introduzir latencia ou renegociacao adicional perceptivel no fluxo de midia, nem duplicar logica entre a chamada direta e a chamada reversa (pull): os dois caminhos devem continuar consumindo a mesma stream local da transmissao.
- **RNF-07** [MUST] Nenhuma nova preferencia relacionada a exclusao de audio deve ser persistida em configuracoes (settings): o comportamento e fixo e sempre ligado, sem opcao de configuracao pelo usuario.
- **RNF-08** [MUST] O card de status deve ser leve o suficiente para nao impactar a performance de renderizacao do grid, seguindo o padrao ja usado por componentes de lista do app (memoizacao, ex.: StreamThumbnail/TransmittingBar/ParticipantCard).
- **RNF-09** [MUST] As animacoes do card de status (entrada com bounce, texto, detalhes escalonados, mudanca de contagem) devem usar exclusivamente propriedades aceleradas por GPU (transform/opacity), sem layout thrashing e sem loop continuo pesado rodando durante toda a transmissao; a taxa de frames de video entregue durante a exibicao/animacao do card nao pode apresentar queda perceptivel em relacao ao mesmo cenario sem animacao, e a animacao nao pode atrasar a leitura das informacoes do card (mensagem, fonte, audio, contagem) nem tornar o card menos usavel.

## 6. Criterios de Aceitacao

- **AC-01** (RF-01, RF-02): Dado um transmissor com o Discord (variante desktop) aberto e "audio do sistema" ligado, quando ele inicia uma transmissao, entao as vozes do Discord, incluindo processos filhos da sua arvore, nao estao presentes no audio recebido pelos espectadores.
- **AC-02** (RF-09, RF-10): Dado um transmissor com uma transmissao propria ativa, quando ele clica na propria miniatura/tile no grid (ou em qualquer outro caminho de exibicao da propria transmissao), entao nenhum video ou audio da propria transmissao e reproduzido; em vez disso, o card de status persistente e exibido - tornando o loop de realimentacao (feedback) impossivel de acontecer.
- **AC-03** (RF-09): Dado um transmissor com transmissao ativa, quando ele tenta ver a propria transmissao por qualquer caminho do app (tile no grid, faixa lateral, fullscreen, picture-in-picture), entao o resultado e sempre o mesmo em todos eles: card de status, nunca video ou audio proprio.
- **AC-04** (RF-10, RF-11): Dado um transmissor com o card de status visivel, quando outro participante comeca ou para de assistir sua transmissao, entao a contagem de espectadores exibida no card atualiza de acordo, em tempo real.
- **AC-05** (RF-08): Dado uma transmissao com audio solicitado em que a captura por processo falha (seja ao armar, seja durante a transmissao), quando a falha ocorre, entao o sistema degrada automaticamente para o loopback total e exibe um aviso discreto ao transmissor, sem que a transmissao fique muda silenciosamente em nenhum momento.
- **AC-06** (RF-05): Dado uma transmissao ativa com a exclusao de audio aplicada, quando o Discord e fechado no meio da transmissao, entao a transmissao continua ativa (nao cai nem para), e se a exclusao deixar de ser possivel a partir dai, o fluxo de degradacao com aviso (RF-08) se aplica.
- **AC-07** (RF-07): Dado uma maquina sem suporte a captura de audio por processo, quando o usuario inicia uma transmissao com audio, entao o sistema degrada para o loopback total com aviso, em vez de falhar a transmissao ou expor um erro cru.
- **AC-08** (RF-12): Dado uma transmissao ativa com o card de status visivel, quando o transmissor troca de fonte, entao o card atualiza a fonte exibida e continua sendo exibido no lugar do proprio video/audio, sem nenhuma janela de exposicao da propria tela/audio durante a troca.
- **AC-09** (RF-13): Dado uma transmissao ativa, quando o transmissor para a transmissao, entao o card de status desaparece e a area volta ao grid/empty-state normal, permitindo assistir outras transmissoes normalmente.
- **AC-10** (RF-14): Dado um transmissor que parou uma transmissao e inicia uma nova (retransmissao), quando a nova transmissao comeca, entao o bloqueio de auto-visualizacao e o card de status se aplicam novamente desde o inicio, sem depender de estado da transmissao anterior.
- **AC-11** (RF-15, RF-16, RF-17): Dado um participante transmitindo a propria tela e assistindo simultaneamente a transmissao de outra pessoa, quando ele consulta as duas telas, entao ve o card de status para a propria transmissao e video/audio normal da transmissao alheia; e os espectadores da transmissao DELE nao ouvem nada da transmissao alheia que ele esta assistindo.
- **AC-12** (RF-21): Dado uma sala onde tanto o dono quanto um membro comum transmitem em momentos diferentes, quando cada um inicia sua propria transmissao, entao ambos tem exatamente o mesmo comportamento de exclusao de audio, bloqueio de auto-visualizacao e card de status, sem diferenca alguma atribuivel ao papel.
- **AC-13** (RNF-02): Dado o conjunto de testes E2E do caminho feliz apos a implementacao, quando ele roda, entao `expectNoDirectionFallbacks` continua passando (nenhum fallback de direcao extra introduzido pela troca de origem da faixa de audio).
- **AC-14** (RNF-01): Dado uma transmissao com a exclusao de audio ativa, quando comparada com a mesma transmissao no comportamento atual (sem exclusao), entao a taxa de frames de video entregue nao apresenta queda perceptivel atribuivel a captura/filtragem de audio.
- **AC-15** (RNF-03): Dado o pipeline de testes completo do projeto (typecheck, lint, vitest, playwright e2e), quando executado apos a implementacao, entao todos os testes passam (verde), sem nenhuma regressao.
- **AC-16** (RF-04): Dado o Discord acessado via navegador (nao aplicativo desktop), quando uma transmissao com audio e iniciada, entao o audio desse Discord-web continua presente na captura (limitacao conhecida, sem exclusao), sem erro nem comportamento inesperado no restante da transmissao.
- **AC-17** (RF-18, RNF-09): Dado o inicio de uma transmissao, quando o card de status aparece, entao os elementos entram com animacao de bounce/spring, o texto principal aparece com fade/slide suave e os detalhes secundarios entram em sequencia escalonada; e, nesse mesmo intervalo, a taxa de frames de video da transmissao nao apresenta queda perceptivel em relacao ao mesmo cenario sem a animacao.
- **AC-18** (RF-19): Dado o card de status visivel com uma contagem de espectadores exibida, quando a contagem muda (alguem comeca ou para de assistir), entao o novo valor e exibido com uma transicao animada, nunca uma troca abrupta e instantanea do numero.
- **AC-19** (RF-06, RF-08): Dado uma transmissao ativa com a exclusao aplicada, quando o Discord e fechado e reaberto durante a transmissao, ou quando o Discord/Zoi abre processos novos apos a captura ja ter comecado, entao as vozes do Discord nao voltam a aparecer no audio recebido pelos espectadores; se a exclusao nao puder ser reaplicada aos processos novos, o fluxo de degradacao com aviso (RF-08) se aplica, e em nenhum momento ha vazamento silencioso das vozes do Discord nem transmissao muda sem aviso.
- **AC-20** (RF-20): Dado o inicio de uma transmissao, quando o card de status entra em cena, entao a logo do app aparece como elemento central e caracteristico da animacao de entrada (ex.: com o efeito de bounce), e nao apenas cores/texto compoem o polish visual do card.
- **AC-21** (RNF-07): Dado uma transmissao iniciada e finalizada com audio do sistema ligado, quando o arquivo de configuracoes (settings.json) e inspecionado antes e depois, entao nenhuma chave nova relacionada a exclusao de audio foi escrita nele; e, apos reiniciar o app, o comportamento de exclusao/bloqueio continua identico, sem depender de nenhuma preferencia carregada.

---

## Questoes em Aberto

1. **P2 - veredito tecnico (Electron/Chromium expoe exclusao de processo nativamente ou precisa de addon nativo?)**: delegado ao SPEC.
2. **P5 - mecanica exata de deteccao de falha em runtime e de reaplicacao da exclusao se o Discord for fechado/reaberto ou abrir processos novos durante a transmissao**: o comportamento observavel (vozes do Discord nunca voltam sem reaplicar a exclusao; nunca transmissao muda silenciosa) esta coberto por RF-05/RF-06/RF-08 desta PRD; o mecanismo de deteccao/reaplicacao em runtime fica delegado ao SPEC.
3. **Sincronizacao A/V e resampling, caso a solucao final precise de um addon nativo processando PCM bruto**: delegado ao SPEC.
4. **Identificacao robusta dos executaveis/arvore de processos do Discord (nomes exatos por variante) e mecanismo de runtime-probe para checar disponibilidade da API na maquina**: delegado ao SPEC.
