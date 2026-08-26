---
feature: black-screen-notice
language: pt-BR
created: 2026-08-25
---

# PRD - black-screen-notice

## Historico de Revisoes

| Data | Revisao | O que mudou |
|------|---------|--------------|
| 2026-08-25 | 1 | Criacao da PRD a partir da IDEA (Stage 1 fechada, P1-P6 resolvidos, finalization pass com F1-F5) e do CONTEXT tecnico. |
| 2026-08-25 | 2 | Apontamentos do forge-review: (WARNING) corrigidas as duas citacoes erradas de "RF-15/RF-16" para "RF-16/RF-17" na secao 1 (Por que agora e Metrica de sucesso); (NIT) RF-13 e RF-14 retagueados de [WON'T] para [MUST] (sao proibicoes verificaveis com AC propria, RF-15 permanece [WON'T] por ser ausencia real de escopo); (NIT) adicionados AC-24 e AC-25 cobrindo RNF-08 e RNF-09, que estavam sem nenhum criterio de aceitacao; (NIT) adicionada nota ao SPEC logo apos RF-16/RF-17 explicando que a tag COULD nao torna o log candidato natural a corte, citando a licao "instrumentar ANTES de tentar corrigir" de `.forge/LESSONS.md`. Nenhum RF/RNF/AC foi renumerado. |

## Baseline (ancora de drift)

- **HEAD**: `6f1d2e53638f42d6261b4e255d7d41ce98a403fd`
- **Fingerprint IDEA_black-screen-notice.md** (git hash-object): `a259846e1bf28f96526a0e39dd032eadbf83b12d`
- **Fingerprint CONTEXT_black-screen-notice.md** (git hash-object): `3607b3266d176fe681c49b438bedabdfb8057d9e`

---

## 1. Objetivo e Visao

**Problema**: quando alguem abre uma transmissao, o espectador as vezes encara alguns segundos de tela PRETA antes do video compartilhado aparecer normalmente. Nesse intervalo ele nao tem nenhuma informacao: nao sabe se e demora normal, se a conexao morreu, ou se deve fechar e tentar de novo. O silencio visual e confuso mesmo quando o caminho feliz (a imagem aparece pouco depois) e o desfecho mais comum.

**Para quem**: quem assiste uma transmissao (espectador), dono ou membro da sala, sem distincao. O transmissor nunca ve este aviso, porque ele nao assiste a propria tela (bloqueio de auto-visualizacao entregue na feature app-audio-capture).

**Por que agora**: feita de proposito ANTES da feature video-codec-upgrade, que e a mudanca mais arriscada da fila e pode ela mesma causar tela preta (driver de encoder de hardware, par que nao decodifica bem um codec novo). Construir o detector agora entrega uma rede de seguranca e um instrumento de diagnostico (o log do tempo ate o primeiro quadro, ver RF-16/RF-17) que a proxima feature vai poder consumir, em vez de testar a mudanca arriscada as cegas.

**Impacto esperado**: o espectador deixa de encarar preto sem explicacao; em vez de silencio, ve uma mensagem calma nos primeiros segundos e, se a espera passar do razoavel, uma mensagem mais direta sugerindo fechar e abrir de novo. Nenhuma cena legitimamente escura (jogo noturno, filme com cena escura) passa a disparar aviso indevido, e nenhum overlay ja existente (reconexao, falha de midia) perde precedencia.

**Metrica de sucesso** [ASSUMPTION: a IDEA nao define uma metrica de sucesso explicita para esta feature; a metrica abaixo e proposta com base no "Must"/"Should" da secao 10 da IDEA e no log do tempo-ate-primeiro-quadro (F4), que a propria IDEA ja planeja como instrumento de diagnostico]: apos a feature rodar em uso real do grupo, os logs de tempo-ate-primeiro-quadro (RF-16/RF-17) devem mostrar que (a) toda visualizacao com espera maior ou igual a carencia de 1,5s exibiu o aviso de conexao antes do primeiro quadro pintar; (b) nenhuma visualizacao de cena legitimamente escura registrou o aviso (zero falso-positivo relatado pelo grupo); e (c) a introducao da deteccao nao mudou o tempo mediano ate o primeiro quadro nem a taxa de quadros de video em relacao ao comportamento anterior a feature.

**Diretriz de desempate (UX-first)**: o usuario autorizou modo autonomo total para as decisoes que faltarem neste pipeline, com um criterio de desempate permanente ja usado nas features anteriores (app-audio-capture, p2p-screen-share-mvp): sempre escolher o que beneficia a experiencia do usuario, sem atrapalhar, sem complicar e sem perder qualidade. Essa diretriz ja foi aplicada no finalization pass da IDEA (decisoes F1-F5) e continua valendo para o SPEC e a implementacao.

## 2. Publico-Alvo (Personas)

- **Espectador**: quem assiste a transmissao de outra pessoa, dono ou membro da sala, sem distincao de papel. E quem ve o aviso de espera, nos dois estagios, e quem se beneficia do log de diagnostico.
- **Transmissor**: nao e publico desta feature. Ele nao assiste a propria transmissao (bloqueio de auto-visualizacao entregue pela app-audio-capture), entao nunca ve este aviso; nenhuma informacao sobre a espera do espectador chega ate ele (ver RF-13, decisao P6).

## 3. Escopo

**Dentro do escopo:**
- Deteccao, no lado de quem assiste, de que a transmissao aberta ainda nao apresentou nenhum quadro da faixa de video atual.
- Aviso visual no player, em dois estagios (espera calma, depois escalada acionavel), seguindo a identidade visual ja existente (familia ReconnectOverlay/MediaFailureOverlay).
- Animacao caprichada nos quatro pontos pedidos pelo usuario: entrada do aviso, indicador de espera vivo, transicao entre estagios, saida do aviso.
- Log de uma linha por visualizacao aberta com o tempo ate o primeiro quadro e o estagio maximo alcancado, incluindo o caso de fechar sem nunca receber quadro.

**Fora do escopo / NAO fazer:**
- Qualquer mudanca na negociacao de midia, nos fallbacks de direcao (mesh race-to-open, media pull, dial-back de admissao) ou no watchdog de midia existente: esta feature apenas OBSERVA sinais ja emitidos pelo WebRTC e pelo pipeline atual, nunca altera decisao de conexao.
- Deteccao de congelamento no meio de uma transmissao que ja mostrou quadros (freeze pos-primeiro-quadro): fora de escopo (P4). O watchdog de midia e a tela de reconexao ja cobrem queda real; detectar congelamento aqui geraria aviso falso numa tela estatica legitima (ex.: compartilhar um documento parado).
- Botao de "tentar de novo" no segundo estagio do aviso (P6): tocaria no caminho de midia ja estabilizado em campo (fallbacks de direcao).
- Qualquer sinalizacao nova para o transmissor sobre a espera do espectador (P6): exigiria trafegar dado novo no mesh, nao construido aqui.
- Deteccao por amostragem de pixels do quadro de video: descartada por decisao explicita do usuario (custa CPU continuamente e nao distingue cena escura legitima de ausencia de quadro).
- Qualquer mudanca no lado do transmissor: ele nao assiste a propria tela (app-audio-capture), entao nao ha aviso de tela preta para ele nesta feature.
- Segunda estrutura de coleta/polling de estatisticas de video em paralelo ao coletor ja existente (F5): qualquer leitura nova por-transmissao deve estender o que ja existe.
- Miniatura/thumbnail do grid (`StreamThumbnail`) e qualquer outra superficie fora do player principal: o aviso desta feature e so no player.

## 4. Requisitos Funcionais

Nota sobre papeis e entidades: os requisitos desta secao valem igualmente para qualquer espectador, dono ou membro da sala (IDEA secao 5), sem matriz de permissoes. Nao ha nenhuma entidade persistida: o unico ciclo relevante e o da visualizacao aberta (abrir o player, primeiro quadro pintar, eventualmente trocar de fonte, fechar/reabrir), e nada disso sobrevive alem da sessao (IDEA secao 6).

**Deteccao do estado de espera**

- **RF-01** [MUST] O sistema nao deve exibir nenhum aviso desta feature antes de decorridos 1,5s sem nenhuma prova de quadro pintado para a faixa de video atual (carencia).
- **RF-02** [MUST] Apos a carencia de 1,5s decorrer sem prova de quadro, o sistema deve exibir o aviso de primeiro estagio: mensagem calma informando que a transmissao esta conectando e pedindo para aguardar.
- **RF-03** [MUST] A prova de quadro que encerra a espera e satisfeita por QUALQUER um dos dois sinais, o que ocorrer primeiro: o callback de quadro pintado disparar, OU o contador de quadros decodificados da faixa sair de zero (prova dupla, F2). Nenhum dos dois sozinho e obrigatorio; qualquer um basta.
- **RF-04** [MUST] O relogio da espera (carencia de 1,5s e escalada de 12s) deve PAUSAR enquanto a janela do app estiver oculta/minimizada e enquanto um overlay de maior precedencia (reconexao ou falha de midia, RF-08) estiver sendo exibido, retomando de onde parou quando a condicao cessar (F1).
- **RF-05** [SHOULD] Se a espera continuar sem nenhuma prova de quadro por 12s de tempo efetivamente contado (respeitando as pausas de RF-04), o aviso deve escalar para o segundo estagio: mensagem com tom mais direto.
- **RF-06** [MUST] A avaliacao do estado de espera e feita por FAIXA DE VIDEO ATUAL, nao por sessao de player: uma troca de fonte pelo transmissor (faixa nova) reabre a espera do zero para a faixa nova (F3).
- **RF-07** [MUST] Uma faixa de video que ja pintou pelo menos um quadro e depois para de entregar quadros novos (congelamento) NAO reabre o aviso desta feature, independente de quanto tempo fique parada (F3; congelamento pos-primeiro-quadro e fora de escopo, P4).
- **RF-08** [MUST] Enquanto o ReconnectOverlay ou o MediaFailureOverlay estiver sendo exibido para a transmissao em questao, o aviso desta feature nunca aparece simultaneamente: os dois overlays existentes sempre tem precedencia, por serem diagnosticos mais especificos e mais graves (P3).
- **RF-09** [MUST] Quando a transmissao sendo assistida nao tiver nenhuma faixa de video, o sistema nao deve exibir nenhum aviso desta feature (nao ha primeiro quadro para esperar, logo nao ha espera a comunicar).
- **RF-10** [MUST] Fechar e reabrir a visualizacao de uma transmissao reavalia o estado de espera do zero, sem herdar estagio ou tempo decorrido de uma abertura anterior.
- **RF-11** [MUST] O aviso desta feature deve poder aparecer em todo modo de apresentacao que renderize a camada de interface do proprio app (ex.: janela normal, modos com controles do app visiveis). Em um modo que exiba apenas o video cru do navegador sem a camada do app, a ausencia do aviso nesse modo especifico e aceita e nao e considerada falha.

**Segundo estagio: conteudo e limites deliberados**

- **RF-12** [SHOULD] O aviso de segundo estagio deve ser apenas texto explicativo, com sugestao de fechar e abrir a transmissao novamente, no tom do app.
- **RF-13** [MUST] O segundo estagio nao deve incluir nenhum botao de "tentar de novo" ou acao equivalente que interfira no caminho de midia (P6).
- **RF-14** [MUST] Esta feature nao deve enviar nenhuma sinalizacao nova ao transmissor informando que um espectador esta esperando ou vendo o aviso (P6).
- **RF-15** [WON'T] Deteccao de congelamento apos o primeiro quadro (freeze no meio da transmissao) nao e implementada nesta feature; nenhum aviso desta familia deve ser acionado por esse cenario (reforca RF-07; fora de escopo por P4).

**Log de diagnostico**

- **RF-16** [COULD] O sistema deve registrar, para cada visualizacao aberta, uma linha de log contendo o identificador da transmissao, o tempo em milissegundos ate o primeiro quadro, e o estagio maximo do aviso alcancado (nenhum, espera, ou escalado) (F4).
- **RF-17** [COULD] Se o espectador fechar a visualizacao sem nunca ter recebido um primeiro quadro, esse desfecho tambem deve ser registrado no log (F4), para que o log nao conte so as historias que terminaram bem.

Nota ao SPEC (RF-16/RF-17): a prioridade COULD reflete a palavra do proprio usuario ("Nice", IDEA secao 10) e nao deve ser reescrita. Mas este log e o instrumento de diagnostico planejado de proposito para a feature seguinte (video-codec-upgrade, ver IDEA secao 2), e `.forge/LESSONS.md` ja registra a licao "instrumentar ANTES de tentar corrigir" a partir de um caso real deste projeto (tela preta silenciosa). Por isso RF-16/RF-17 nao devem ser tratados como candidatos naturais a corte so por causa da tag COULD.

**Motion (IDEA secao 9)**

- **RF-18** [SHOULD] A entrada do aviso, ao final da carencia de 1,5s, deve usar uma aparicao suave (nunca um corte/pop seco), com a logo do app como elemento caracteristico da animacao, no espirito do bounce ja usado no card de status da app-audio-capture.
- **RF-19** [SHOULD] Enquanto o primeiro estagio estiver visivel, o sistema deve exibir um indicador de progresso vivo (ex.: a logo pulsando de leve, ou indicador proprio) comunicando que algo esta acontecendo; esse indicador roda em loop continuo e leve enquanto a espera dura, e desaparece assim que o primeiro quadro pinta, nunca rodando durante a exibicao normal do video.
- **RF-20** [SHOULD] A transicao do primeiro para o segundo estagio (aos 12s) deve ser uma transicao suave (crossfade/slide) entre as mensagens, nunca uma troca abrupta de texto.
- **RF-21** [SHOULD] Quando o primeiro quadro pinta, o aviso deve desaparecer com uma transicao suave, cedendo lugar ao video sem solavanco.

## 5. Requisitos Nao-Funcionais

- **RNF-01** [MUST] A deteccao nunca deve amostrar pixels do quadro de video; deve se basear exclusivamente em sinais de fluxo de video ja emitidos pelo WebRTC/DOM (estado `muted`/`unmute` da faixa, contadores `framesDecoded`/`framesReceived` de `getStats()`, e o callback de quadro pintado `requestVideoFrameCallback`). Amostragem de pixels para este fim e proibida (decisao explicita da IDEA secao 2).
- **RNF-02** [MUST] A deteccao nao deve custar CPU perceptivel nem derrubar quadros de video: o callback de quadro pintado deve ser usado apenas ate capturar o instante do primeiro quadro da faixa atual, sem continuar sendo reagendado durante a exibicao normal do video.
- **RNF-03** [MUST] Toda animacao desta feature deve usar exclusivamente propriedades aceleradas por GPU (transform/opacity), sem layout thrashing, e deve respeitar a preferencia de movimento reduzido do sistema (`prefers-reduced-motion`) ja tratada globalmente no app.
- **RNF-04** [MUST] O aviso, em qualquer estagio, deve ser compreensivel (mensagem legivel e clara) mesmo com toda animacao desabilitada ou reduzida: a informacao nunca pode depender de movimento para ser entendida.
- **RNF-05** [MUST] Nenhuma segunda estrutura de coleta/polling de estatisticas de video deve ser criada em paralelo ao coletor ja existente; qualquer leitura nova por-transmissao dos contadores de quadro deve estender a estrutura de coleta ja existente, nunca abrir um segundo laco concorrente de `getStats()` (F5).
- **RNF-06** [MUST] Nao deve haver regressao nos fallbacks de direcao ja estabilizados (mesh race-to-open, media pull, dial-back de admissao) nem no watchdog de midia existente; o teste e2e `expectNoDirectionFallbacks` deve continuar passando.
- **RNF-07** [MUST] Esta feature e puramente observacional: nao deve alterar negociacao de midia, fallbacks de direcao, nem o pipeline de midia em si (streams, tracks, chamadas do PeerJS permanecem intocados no seu comportamento de conexao).
- **RNF-08** [MUST] Toda string de UI nova (mensagens dos dois estagios) deve estar em portugues (pt-BR), sem caracteres acentuados e sem travessao, seguindo a convencao ja usada em `ReconnectOverlay`/`MediaFailureOverlay`.
- **RNF-09** [MUST] O aviso deve seguir a identidade visual ja existente do app (tema escuro + roxo #9d00ff), reaproveitando os padroes visuais da familia de overlays do player (`ReconnectOverlay`/`MediaFailureOverlay`) em vez de introduzir uma linguagem visual nova.
- **RNF-10** [MUST] A suite de testes completa do projeto (typecheck, lint, `npx vitest run`, `npm run test:e2e`) deve continuar passando (verde) apos a implementacao desta feature.

## 6. Criterios de Aceitacao

- **AC-01** (RF-01, RF-02, exemplo IDEA secao 7 - Bruna): Dado um espectador que abre uma transmissao onde nenhum quadro chegou ainda, quando menos de 1,5s se passam, entao nenhum aviso e exibido; se aos 3s o primeiro quadro pinta (via RF-03), entao o aviso de primeiro estagio (exibido desde 1,5s) desaparece e o video aparece normalmente, sem nunca ter escalado.
- **AC-02** (RF-01, RF-02): Dado um espectador que abre uma transmissao, quando decorrem exatamente 1,5s sem nenhuma prova de quadro, entao o aviso de primeiro estagio (mensagem calma) aparece.
- **AC-03** (RF-03): Dado o primeiro estagio do aviso visivel, quando o callback de quadro pintado dispara OU o contador de quadros decodificados sai de zero (qualquer um dos dois, o que ocorrer primeiro), entao o sistema considera o primeiro quadro recebido e encerra a espera.
- **AC-04** (RF-04): Dado o aviso em qualquer estagio de espera, quando a janela do app e minimizada/ocultada ou quando um overlay de reconexao/falha de midia assume a tela, entao o relogio da espera pausa e retoma exatamente de onde parou quando a janela volta ao primeiro plano ou o overlay de maior precedencia some.
- **AC-05** (RF-05, exemplo IDEA secao 7 - Joao): Dado um espectador que abre uma transmissao e nenhum quadro chega, quando se passam 12s de tempo efetivo de espera (sem pausas), entao a mensagem escala para o segundo estagio, com tom mais direto sugerindo fechar e abrir de novo.
- **AC-06** (RF-06, F3): Dado uma faixa de video que ja pintou seu primeiro quadro, quando o transmissor troca de fonte (nova faixa), entao o estado de espera reabre do zero para a faixa nova, podendo mostrar o aviso novamente apos a carencia.
- **AC-07** (RF-07, F3): Dado uma faixa de video que ja pintou pelo menos um quadro, quando ela para de entregar quadros novos (congelamento, ex.: compartilhar um documento parado), entao nenhum aviso desta feature e exibido, independente do tempo parado.
- **AC-08** (RF-08, P3): Dado uma transmissao em estado de reconexao ou com falha de midia marcada, quando essas condicoes estao ativas, entao o aviso desta feature nunca aparece simultaneamente com `ReconnectOverlay`/`MediaFailureOverlay`.
- **AC-09** (RF-09): Dado uma transmissao sem nenhuma faixa de video, quando o espectador a assiste, entao nenhum aviso desta feature e exibido, e nada quebra.
- **AC-10** (RF-10): Dado um espectador que fecha e reabre a visualizacao de uma transmissao, quando reabre, entao o estado de espera comeca do zero (carencia nova, sem herdar estagio anterior).
- **AC-11** (RF-11): Dado um modo de apresentacao que renderiza a camada de interface do app, quando a espera se aplica, entao o aviso aparece normalmente nesse modo; em um modo que exiba somente o video cru do navegador sem a camada do app, a ausencia do aviso e aceita.
- **AC-12** (RF-12, RF-13, RF-14): Dado o aviso escalado ao segundo estagio, quando o espectador le a mensagem, entao ela e apenas texto explicativo com sugestao de fechar e abrir de novo, sem nenhum botao de retry e sem nenhuma sinalizacao enviada ao transmissor.
- **AC-13** (RF-15, P4): Dado uma transmissao ja exibindo video normalmente (pos-primeiro-quadro), quando o video congela no meio, entao nenhum aviso desta feature dispara (esse caso permanece coberto apenas pelo watchdog de midia/tela de reconexao existentes).
- **AC-14** (RF-16, RF-17, F4): Dado uma visualizacao aberta, quando ela termina, entao existe uma linha de log com o identificador da transmissao, o tempo em ms ate o primeiro quadro e o estagio maximo alcancado; se a visualizacao for fechada sem nunca ter recebido um quadro, essa linha registra esse desfecho explicitamente.
- **AC-15** (RF-18): Dado o fim da carencia de 1,5s sem prova de quadro, quando o aviso aparece, entao a entrada usa transicao suave com a logo do app como elemento caracteristico, nunca um corte seco.
- **AC-16** (RF-19): Dado o primeiro estagio do aviso visivel, quando ele permanece na tela, entao um indicador de progresso vivo e leve (transform/opacity) roda em loop continuo, e desaparece assim que o primeiro quadro pinta.
- **AC-17** (RF-20): Dado o aviso escalando do primeiro para o segundo estagio aos 12s, quando a troca acontece, entao e uma transicao suave (crossfade/slide) entre as mensagens, nunca um corte abrupto de texto.
- **AC-18** (RF-21): Dado o primeiro quadro pintando enquanto o aviso esta visivel, quando isso acontece, entao o aviso desaparece com transicao suave, sem solavanco na chegada do video.
- **AC-19** (RNF-01, RNF-02, exemplo IDEA secao 7 - cena escura do Leo): Dado um transmissor compartilhando uma cena legitimamente escura (filme com cena noturna) com quadros chegando normalmente, quando um espectador assiste, entao nenhum aviso desta feature dispara em nenhum momento, mesmo com a tela visualmente quase toda preta.
- **AC-20** (RNF-03, RNF-04): Dado o sistema com `prefers-reduced-motion` ativo, quando o aviso aparece em qualquer estagio, entao ele continua totalmente compreensivel (mensagem legivel, sem depender de nenhuma animacao) mesmo com toda animacao reduzida/desabilitada.
- **AC-21** (RNF-05): Dado o coletor de estatisticas ja existente no projeto, quando a leitura por-transmissao dos contadores de quadro for adicionada, entao ela estende esse coletor (ou reaproveita a mesma chamada `getStats()` ja feita por conexao) em vez de abrir um segundo laco de coleta concorrente.
- **AC-22** (RNF-06, RNF-07): Dado o conjunto de testes e2e do caminho feliz apos a implementacao, quando ele roda, entao `expectNoDirectionFallbacks` continua passando, sem nenhum fallback de direcao novo introduzido por esta feature.
- **AC-23** (RNF-10): Dado o pipeline de testes completo do projeto (typecheck, lint, vitest, playwright e2e), quando executado apos a implementacao, entao todos os testes passam (verde), sem regressao.
- **AC-24** (RNF-08): Dado o texto exibido nos dois estagios do aviso, quando a copy e conferida, entao ela esta em portugues (pt-BR), sem nenhum caractere acentuado e sem nenhum travessao, no mesmo tom ja usado em `ReconnectOverlay`/`MediaFailureOverlay`.
- **AC-25** (RNF-09): Dado o aviso desta feature renderizado em tela, quando comparado visualmente com `ReconnectOverlay`/`MediaFailureOverlay`, entao ele reaproveita os mesmos tokens/identidade visual da familia de overlays existente (tema escuro, roxo #9d00ff, estrutura de cartao central), em vez de introduzir um estilo proprio divergente.

---

## Questoes em Aberto

1. **Throttling de `requestVideoFrameCallback` com a janela em segundo plano/minimizada**: o CONTEXT nao encontrou nenhum precedente no codigo atual sobre se o Chromium embutido no Electron 43 (~150.x) atrasa esse callback quando a janela do app esta oculta, e em quanto. A IDEA ja decidiu o comportamento desejado (RF-04: pausar o relogio nesse cenario), mas a mecanica exata de deteccao de "janela oculta" e a confirmacao empirica de que o atraso do callback nao dispara falso-positivo antes da pausa entrar em vigor ficam para o SPEC validar. Bloqueia: detalhe de implementacao de RF-04, nao a PRD em si (o requisito observavel ja esta definido).
2. **Formato exato da linha de log (F4)**: nivel (`info`/`debug`), se agrega por `txId` ou por `peerId`, e se ha algum limite de retencao. A IDEA explicitamente delega o formato ao SPEC ("Formato exato fica para o SPEC", secao 2 F4); RF-16/RF-17 desta PRD descrevem apenas o conteudo minimo observavel exigido. Bloqueia: detalhe de formato de log, nao o comportamento exigido.
3. **Onde expor a leitura de `framesDecoded`/`framesReceived` por-transmissao sem duplicar `getStats()`** (extensao do `StatsMonitor` existente vs. leitura direta pelo `MediaManager`/hook de UI): decisao de arquitetura explicitamente delegada ao SPEC pela propria IDEA (F5: "onde exatamente ela mora e decisao do SPEC"). Bloqueia: design tecnico do RNF-05, nao o requisito observavel.

Nenhuma assumption de gap-filling alem da metrica de sucesso (secao 1, ja marcada `[ASSUMPTION]`) foi necessaria: a IDEA fechou Stage 1 com todos os pontos P1-P6 resolvidos e o finalization pass (F1-F5) cobriu as contradicoes e ambiguidades tecnicas remanescentes.
