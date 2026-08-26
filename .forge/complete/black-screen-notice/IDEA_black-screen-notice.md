---
feature: black-screen-notice
language: pt-BR
type: change
status: in-progress
created: 2026-08-25
---

# IDEA: Aviso de tela preta (transmissao ainda sem quadros)

## 1. Objetivo

Quando alguem abre uma transmissao, as vezes a tela fica PRETA por alguns segundos e depois a imagem compartilhada aparece normalmente. Nas palavras do usuario (2026-08-25): "em caso de tela preta, as vezes ela aparece e demora um pouco e aparece a tela compartilhada normal. Da pra detectar q a tela ta preta e colocar um aviso na transmissao (ex: Aguarde alguns segundos)".

Problema real: nesse intervalo o espectador nao tem NENHUMA informacao. Ele nao sabe se e demora normal, se a conexao morreu, ou se deve sair e entrar de novo. Objetivo: detectar que ainda nao chegou quadro nenhum e mostrar um aviso claro no player, transformando um silencio confuso em uma espera compreensivel.

## 2. Decisoes (lista viva)

- 2026-08-25: DETECCAO PELO FLUXO DE VIDEO, NUNCA por amostragem de pixels. Amostrar pixels custa CPU continuamente (fere o pilar de performance) e confunde dois casos distintos: cena genuinamente escura (jogo noturno, video com barras pretas) versus ausencia de quadros. O sinal correto vem do proprio WebRTC: a faixa de video fica `muted` ate os primeiros quadros decodificarem (eventos `mute`/`unmute`), o `getStats()` do receptor expoe `framesDecoded`/`framesReceived` (parados em zero enquanto nada chega), e ha o callback de quadro apresentado (`requestVideoFrameCallback`) para saber quando o primeiro quadro foi realmente PINTADO. Combinados, distinguem "nada chegou" de "chegou e e escuro", que e exatamente o que a amostragem de pixels erraria.
- 2026-08-25: AVISO EM DOIS ESTAGIOS. Primeiros segundos: mensagem calma de espera (ex: "Conectando a transmissao, aguarde alguns segundos"). Passando de ~10-15s sem nenhum quadro: a mensagem muda de tom e vira ACIONAVEL, porque a essa altura provavelmente nao e demora normal e sim conexao que nao vingou; o espectador merece saber que pode sair e entrar de novo em vez de encarar o preto. Limiares exatos e copy final ficam em aberto (P1, P2).
- 2026-08-25: FEATURE PROPRIA, com branch propria, e feita ANTES da video-codec-upgrade. Motivo (decidido com o usuario): a troca de codec e a mudanca mais arriscada da fila e pode CAUSAR tela preta (bug de driver com encoder de hardware, ou par que nao decodifica AV1 bem); ela ja lista "tela preta/artefatos" nos seus casos de borda. Embutir o detector dentro dela criaria o pior arranjo: testar a mudanca arriscada sem ter o instrumento de diagnostico, e perder o aviso junto se o codec precisar ser revertido. Feito antes, o detector vira REDE DE SEGURANCA e INSTRUMENTO de diagnostico da feature do codec.
- 2026-08-25: DIRETRIZES PERMANENTES DO USUARIO, ja valendo para esta feature (as mesmas dadas na app-audio-capture e reafirmadas aqui):
  (a) MODO 100% AUTONOMO: o orquestrador toma as decisoes que faltarem, sem parar em gates. Excecao inviolavel: push, merge e release SO com pedido explicito do usuario.
  (b) PRIORIDADES: qualidade e performance do app acima de tudo, e usabilidade junto. Nada do que ja foi feito pode ser danificado ou corrompido (mudar codigo existente quando necessario e esperado; regressao de comportamento nao).
  (c) UX COMO CRITERIO DE DESEMPATE: sempre a escolha que beneficia a experiencia do usuario, de forma que nao o atrapalhe, nao complique e nao perca qualidade.
  (d) ANIMACOES: dar o melhor no design, com regua alta ("bem impressionante no quesito animacoes", mesmo sendo app entre amigos). Pode usar a LOGO DO APP para deixar mais caracteristico, sem se limitar a cores. Limite: transform/opacity acelerados por GPU, sem loop pesado, sem custar frames de video e sem atrapalhar a leitura da mensagem (aqui o aviso precisa ser COMPREENSIVEL antes de ser bonito: quem esta esperando quer informacao, nao espetaculo).
- 2026-08-25 (fechamento com o usuario, resolve P1-P6): (a) carencia de 1,5s antes do aviso e escalada aos 12s sem quadro; (b) so a espera INICIAL, congelamento no meio fica FORA (risco de aviso falso em tela estatica, e o watchdog + tela de reconexao ja cobrem queda real); (c) o segundo estagio e so texto explicativo com sugestao de fechar e abrir, SEM botao de retry (tocaria no caminho de midia estabilizado em campo) e SEM sinalizar para o transmissor (exigiria dado novo no mesh); (d) overlays de reconexao e falha de midia SEMPRE tem precedencia sobre este aviso; (e) copy lapidada na implementacao; (f) registrar no log o tempo ate o primeiro quadro.
- 2026-08-25: reaproveitamento planejado: a leitura de `getStats()` do LADO RECEPTOR estabelecida aqui e a mesma estrutura que a video-codec-upgrade vai consumir (ela ja planeja ler `encoderImplementation` e `qualityLimitationReason`). Fazer nesta ordem evita duas estruturas paralelas.
- 2026-08-25 (FINALIZATION PASS, decisoes autonomas do orquestrador apos o forge-context, criterio UX-first; o usuario ja autorizou autonomia total):
  - F1. RELOGIO DA ESPERA SO CORRE QUANDO O ESPECTADOR ESTA MESMO ENCARANDO O PRETO SEM EXPLICACAO. A carencia de 1,5s e a escalada de 12s PAUSAM enquanto a janela esta oculta/minimizada e enquanto um overlay de maior precedencia (reconexao ou falha de midia) esta na tela, e retomam de onde pararam. Motivo: contar esse tempo faria o aviso reaparecer JA ESCALADO no instante em que a reconexao esta se recuperando, mandando o usuario fechar e abrir justo quando a conexao vai voltar. Fecha tambem o caso de borda da aba em segundo plano.
  - F2. PROVA DE QUADRO E DUPLA E QUALQUER UMA BASTA: quadro PINTADO (callback de quadro apresentado) OU contador de quadros decodificados saindo do zero. Motivo: em janela oculta o navegador pode estrangular a pintura mesmo com quadros chegando; exigir a pintura sozinha geraria aviso falso, que e exatamente o que a feature existe para evitar.
  - F3. RESOLVE A CONTRADICAO ENTRE A SECAO 6 E O P4: a espera e avaliada POR FAIXA DE VIDEO ATUAL, nao por sessao de player. Vale sempre que a faixa corrente ainda nao entregou o PRIMEIRO quadro dela, o que inclui a troca de fonte pelo transmissor (faixa nova, espera nova). NAO vale para faixa que ja pintou e depois congelou: isso continua fora de escopo (P4) e e assunto do watchdog. Assim "so a espera inicial" e "trocar de fonte pode voltar a esperar" deixam de se contradizer.
  - F4. O QUE VAI PARA O LOG: uma linha por visualizacao aberta, com o identificador da transmissao, o tempo em milissegundos ate o primeiro quadro, e qual foi o estagio maximo do aviso (nenhum, espera, escalado). Se o espectador fechar sem nunca receber quadro, registrar isso tambem. Motivo: e o instrumento de diagnostico prometido para a video-codec-upgrade, e sem o caso "fechou sem nunca receber" o log so contaria as historias que terminaram bem. Formato exato fica para o SPEC.
  - F5. NADA DE SEGUNDA ESTRUTURA DE POLLING: a leitura por transmissao dos contadores de quadro entra COMO EXTENSAO do coletor de estatisticas que ja existe (hoje ele soma tudo numa unica leitura da sala inteira), e essa extensao ja nasce desenhada para servir tambem a video-codec-upgrade. Onde exatamente ela mora e decisao do SPEC; criar um segundo laco de coleta em paralelo esta PROIBIDO (fere o pilar de performance).

## 3. Escopo

Dentro:
- Deteccao, no lado de QUEM ASSISTE, de que a transmissao aberta ainda nao apresentou nenhum quadro.
- Aviso visual no player, em dois estagios, seguindo a identidade existente.

Fora (NAO tocar):
- Captura e exclusao de audio (feature app-audio-capture, em andamento).
- Troca de codec e deteccao de hardware (feature video-codec-upgrade, vem depois).
- Qualquer mudanca no pipeline de midia em si: esta feature apenas OBSERVA e informa, nao altera negociacao, nem fallbacks de direcao, nem watchdog.
- Lado do transmissor: ele nao assiste a propria tela (ver app-audio-capture), entao nao ha aviso de tela preta para ele.

## 4. Superficie de regressao

- Fallbacks de direcao (mesh race-to-open, media pull, dial-back de admissao) e watchdog de midia: intactos. O e2e `expectNoDirectionFallbacks` precisa continuar verde.
- Overlays existentes (ReconnectOverlay, MediaFailureOverlay): o estado novo nao pode competir nem sobrepor os existentes; precisa de precedencia definida (P3).
- Card de status do transmissor e bloqueio de auto-visualizacao (app-audio-capture): nao podem ser afetados.
- Pilar de performance: a deteccao nao pode custar frames nem CPU perceptivel.

## 5. Papeis e permissoes

N/A: comportamento local de quem assiste, igual para dono e membro.

## 6. Entidades e ciclo de vida

Nenhuma entidade persistida. O ciclo relevante e o da VISUALIZACAO: abrir a transmissao (estado de espera aparece se ainda nao ha quadro), primeiro quadro pintado (aviso some), transmissao trocada de fonte pelo transmissor (pode voltar ao estado de espera durante a renegociacao), fechar/reabrir o player (reavalia do zero).

## 7. Regras de negocio e exemplos

- Exemplo alvo: Bruna clica na transmissao do Leo. Nenhum quadro chegou ainda: ela ve "Conectando a transmissao, aguarde alguns segundos". 3s depois o primeiro quadro pinta: o aviso some e o video aparece normalmente.
- Exemplo do caso ruim: Joao abre a transmissao e nada chega. Aos ~12s a mensagem vira acionavel, sugerindo o que fazer, em vez de deixa-lo encarando preto.
- Exemplo do caso que NAO pode disparar aviso: o Leo transmite um filme com cena noturna quase toda preta. Quadros estao chegando normalmente, entao NENHUM aviso aparece, mesmo com a tela visualmente escura.

## 8. Casos de borda / caminhos tristes

- Cena legitimamente escura (nao pode disparar o aviso): resolvido por design ao usar quadros, nao pixels.
- Transmissao que congela DEPOIS de ja ter mostrado quadros (freeze no meio): FORA DE ESCOPO (P4 resolvido). Nao gera aviso; o watchdog de midia e a tela de reconexao ja cobrem a queda real, e detectar congelamento geraria aviso falso em tela estatica legitima.
- Troca de fonte pelo transmissor no meio: renegociacao pode zerar o fluxo por um instante; o aviso nao pode piscar de forma irritante (precisa de carencia minima antes de aparecer).
- Interacao com o ReconnectOverlay / MediaFailureOverlay: eles SEMPRE ganham (P3 resolvido). O aviso de espera so aparece quando nao ha problema conhecido.
- Transmissao sem video (caso hoje inexistente, mas nao pode quebrar).
- Espectador com aba/janela em segundo plano: o navegador pode nao pintar quadros; nao pode gerar aviso falso.
- Modo de movimento reduzido do sistema: o aviso nao pode depender de animacao para ser compreendido.
- Transmissao SEM faixa de video (caso hoje inexistente): nao mostra aviso nenhum e nao pode quebrar. Nao ha primeiro quadro para esperar, entao nao ha espera a comunicar (decisao do finalization pass).
- Modos de apresentacao (tela cheia, PiP): o aviso precisa aparecer em todo modo que renderize a interface do proprio app. Se algum modo mostrar apenas o video cru do navegador, sem a camada do app, ali nao ha como exibir o aviso e isso e aceito; o SPEC verifica qual e o caso de cada modo.

## 9. Referencia de UI

mode: project-identity. Terceiro estado da familia de overlays que ja existe (ReconnectOverlay / MediaFailureOverlay), tema escuro + roxo #9d00ff, tokens ja catalogados no UISPEC da app-audio-capture.

DIRECAO DE MOTION (pedido explicito do usuario, 2026-08-25: "nao se esqueca das animacoes, pede pra colocar animacao onde der"): usar animacao em TODO ponto onde couber, com a mesma regua alta do card de status da app-audio-capture. Pontos onde cabe nesta feature:
- Entrada do aviso: aparicao suave (nunca um POP seco depois da carencia de 1,5s), com a logo do app como elemento caracteristico, no espirito do bounce ja usado no card de status.
- Estado de espera em si: indicador de progresso vivo (a logo pulsando de leve, ou um indicador proprio) para comunicar "esta acontecendo algo" em vez de um texto parado. ATENCAO: aqui um loop continuo e justificavel porque comunica espera, mas precisa ser LEVE (transform/opacity apenas) e some assim que o primeiro quadro pinta; nunca roda durante a exibicao normal do video.
- Transicao para o segundo estagio (12s): a troca de mensagem deve ser uma transicao suave (crossfade/slide), nunca um corte seco de texto.
- Saida: quando o primeiro quadro pinta, o aviso deve SUMIR com transicao suave, cedendo lugar ao video sem solavanco.
LIMITES (mantidos): transform/opacity acelerados por GPU, nada que custe frames do video, `prefers-reduced-motion` respeitado, e a mensagem precisa continuar LEGIVEL e compreensivel antes de ser bonita (quem espera quer informacao, nao espetaculo).

## 10. Prioridades

- Must: o espectador nunca mais encarar preto sem informacao; nunca disparar aviso falso em cena escura legitima.
- Should: segundo estagio acionavel quando a espera passa do razoavel.
- Should: animacao em todo ponto onde couber (entrada, espera, troca de estagio, saida), na regua alta pedida pelo usuario, ver secao 9.
- Nice: registrar no log qual foi o tempo ate o primeiro quadro (util como instrumento para a feature do codec).

## 11. Assumptions confirmadas

- 2026-08-25: usuario confirmou que o sintoma e transitorio no caso comum ("demora um pouco e aparece a tela compartilhada normal"), ou seja, o caminho feliz existe e o aviso e sobre a ESPERA, nao sobre falha permanente.
- 2026-08-25 (finalization pass, premissas que o orquestrador carregava e resolveu sozinho, registradas para poderem ser contestadas): (a) pausar o relogio durante overlay de maior precedencia e durante janela oculta e melhor que zerar ou que deixar correr; (b) o aviso vale por faixa de video, entao troca de fonte reabre a espera; (c) transmissao sem video nao gera aviso; (d) o log tambem registra a visualizacao que fechou sem nunca receber quadro.

## 12. Pontos em aberto (lista viva)

TODOS RESOLVIDOS. Stage 1 FECHADA em 2026-08-25: P1-P6 resolvidos com o usuario, forge-context concluido (ver CONTEXT_black-screen-notice.md) e finalization pass executado (reconciliacao, scorecard das secoes 1-12, cacada de premissas e checagem de contradicao). A unica contradicao encontrada, entre a secao 6 e o P4, foi resolvida na decisao F3. Os quatro pontos tecnicos abertos pelo forge-context viraram as decisoes F1-F5.

- P1: RESOLVIDO: carencia de 1,5s antes de mostrar o aviso (transmissao que abre rapido nao mostra nada) e escalada para o segundo estagio aos 12s sem nenhum quadro.
- P2: RESOLVIDO: copy lapidada na implementacao, no tom do app (pt-BR sem acento), sem necessidade de aprovacao previa; o segundo estagio EXPLICA e SUGERE fechar e abrir de novo (ver P4 abaixo).
- P3: RESOLVIDO: os overlays existentes (reconectando, falha de midia) SEMPRE tem precedencia; sao diagnosticos mais especificos e mais graves. O aviso de espera so aparece quando nao ha nenhum problema conhecido, ou seja, quando a espera e mesmo so espera.
- P4: RESOLVIDO: FORA DE ESCOPO nesta feature. So a espera INICIAL. Motivo: detectar congelamento e traicoeiro (quem compartilha um documento parado e nao mexe no mouse gera poucos quadros e levaria aviso falso de travamento), e o app ja tem watchdog de midia + tela de reconexao para queda real. Fica anotado como possivel evolucao futura, a reavaliar depois do detector rodar em campo.
- P5: RESOLVIDO: SIM, registrar no log o tempo ate o primeiro quadro. Barato e vira instrumento de diagnostico para a video-codec-upgrade.
- P6 (novo, resolvido junto): o segundo estagio NAO ganha botao de "tentar de novo" nem sinaliza para o transmissor. So texto explicativo com sugestao. Motivo: botao de retry tocaria no caminho de midia recem estabilizado em campo (fallbacks de direcao), e avisar o transmissor exigiria trafegar informacao nova entre os participantes. Ambos ficam como evolucao futura, se a necessidade aparecer no uso real.

## 13. APENDICE: contexto tecnico

MAPA DE CODIGO OFICIAL DESTA FEATURE: `CONTEXT_black-screen-notice.md` (gerado em 2026-08-25 no commit 6f1d2e5). Ele corrige caminhos citados de memoria aqui embaixo. Complementos: `.forge/complete/p2p-screen-share-mvp/` e o CONTEXT da app-audio-capture para o mapa do codigo. Pontos de partida ja conhecidos: `src/renderer/src/ui/components/PlayerView.tsx` (elemento de video e overlays), `ReconnectOverlay`/`MediaFailureOverlay` como precedente visual, `src/renderer/src/services/media-manager.ts` (streams e o caminho de pull), e o coletor de estatisticas que ja alimenta o indicador de qualidade da sala (`room.quality` / `qualityTick`). Convencoes: identificadores em ingles, strings pt-BR sem acento, proibido travessao. Testes: Vitest em `tests/unit` (sem importar modulos do main) e Playwright `_electron` em `tests/e2e` (esperar `.z-doors` sumir antes de asserir na tela de sala).
