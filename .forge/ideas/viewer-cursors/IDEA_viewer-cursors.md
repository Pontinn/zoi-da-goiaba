---
feature: viewer-cursors
language: pt-BR
type: create
status: in-progress
created: 2026-08-25
---

# IDEA: Cursores dos espectadores na tela de quem transmite

## 1. Objetivo

Hoje, quando alguem assiste a sua transmissao e quer apontar alguma coisa, so resta descrever por voz: "clica ali, nao, mais pra baixo, no botao da direita". Pergunta original do usuario (2026-08-25): "daria pra durante a transmissao de tela alguma forma de visualizar o cursor do mouse de quem ta assistindo a sua tela na sua tela?".

Objetivo: quem transmite ve, sobre a propria tela real, os cursores das pessoas que estao assistindo, cada um com a cor da pessoa e o nome em cima. E os espectadores veem os cursores uns dos outros sobre o video. Transforma "explica por voz onde e" em "aponta e pronto".

## 2. Decisoes (lista viva)

- 2026-08-25: CURSOR E DADO, NUNCA PIXEL. Esta e a decisao central e ela nasceu de uma pergunta do usuario ("nao tem como ir na A e quem esta assistindo nao ver o proprio cursor colorido?"). O desenho ingenuo seria desenhar os cursores num overlay sobre a tela capturada e deixar que eles entrem no video; nesse caso todos recebem os MESMOS pixels e e impossivel remover o cursor de uma pessoa so (exigiria codificar um video por espectador, caro demais). A solucao: o overlay do transmissor fica FORA da captura, e as POSICOES dos cursores viajam pelo canal de dados; cada app desenha os cursores localmente sobre o que ja esta exibindo. Assim cada cliente decide o que desenhar e o espectador simplesmente NAO desenha o proprio. Mesma abordagem de Figma e Miro.
- 2026-08-25: consequencias diretas dessa escolha, todas desejaveis: zero efeito fantasma (nada faz a volta pelo video, entao ninguem ve o proprio cursor atrasado correndo atras do real); MENOR latencia que a alternativa (a coordenada vai direto pelo canal de dados, sem esperar codificacao/transmissao/decodificacao do video); e o transmissor ve os cursores mesmo sem ver a propria tela dentro do app (o bloqueio de auto-visualizacao da app-audio-capture continua valendo e intocado).
- 2026-08-25: COORDENADAS NORMALIZADAS (fracao de largura e altura do conteudo compartilhado, ex: 0.35 / 0.60), calculadas descontando as bordas pretas quando o formato do video nao bate com a janela de quem assiste. Cada cliente remapeia para o proprio tamanho de exibicao. E o que faz o mesmo dado servir a telas de tamanhos diferentes.
- 2026-08-25: CADA CURSOR USA A COR JA EXISTENTE DA PESSOA (a mesma das bolinhas com a inicial na lista de participantes) e leva o NOME em cima. Reusar o vocabulario visual ja estabelecido faz a pessoa ser reconhecida sem precisar ler.
- 2026-08-25: ESCOLHA ANTES DE TRANSMITIR, no mesmo fluxo em que hoje se escolhe a fonte e o som (SourcePickerModal). Quem transmite decide se quer ver os cursores.
- 2026-08-25: ALEM DISSO, deve dar para ligar e desligar DURANTE a transmissao (barra de transmissao). Motivo levantado na conversa: a necessidade costuma aparecer no meio ("clica ali, nao, mais pra baixo"), e sem isso a pessoa teria que parar e retransmitir so para mudar de ideia. Nao complica o fluxo inicial e evita friccao real.
- 2026-08-25: O CURSOR REAL DO TRANSMISSOR SAI DE GRACA: a captura de tela do Windows ja inclui o cursor dele, entao os espectadores continuam vendo para onde ele aponta sem nenhum trabalho extra. Nao inventar um cursor sintetico para o transmissor.
- 2026-08-25: PRIMEIRA VERSAO SO PARA MONITOR INTEIRO. Compartilhamento de JANELA fica fora (ver secao 3), porque o overlay teria que perseguir a janela enquanto ela se move e redimensiona, o que e bem mais dificil.
- 2026-08-25: ANTES DE IMPLEMENTAR, SONDAR o `setContentProtection` do Electron (por baixo usa o recurso do Windows que marca uma janela como invisivel para quem captura a tela). O caminho e documentado, mas depois da licao da app-audio-capture (premissa de API so vira fato quando executada) isto NAO deve ser assumido: uma sonda curta confirma que a janela some da captura nessa versao do Electron e sem efeito colateral. Se falhar, o desenho precisa de plano B antes de qualquer codigo.
- 2026-08-25: DIRETRIZES PERMANENTES DO USUARIO, valendo para esta feature:
  (a) MODO 100% AUTONOMO: o orquestrador decide o que faltar, sem parar em gates. Excecao inviolavel: push, merge e release SO com pedido explicito.
  (b) PRIORIDADES: qualidade e performance do app acima de tudo, com usabilidade junto. Nada do que ja funciona pode ser danificado.
  (c) UX COMO DESEMPATE: sempre a escolha que nao atrapalha, nao complica e nao perde qualidade.
  (d) ANIMACOES: regua alta, animar onde couber, podendo usar a logo do app como elemento caracteristico. Limite: transform/opacity acelerados por GPU, sem loop pesado, sem custar frames de video.

## 3. Escopo

Dentro:
- Overlay transparente, sempre no topo e que deixa os cliques passarem, sobre o MONITOR compartilhado, mostrando os cursores dos espectadores.
- Envio das posicoes pelo canal de dados que ja existe entre os participantes.
- Desenho local dos cursores dos OUTROS sobre o video, no lado de quem assiste.
- Toggle no fluxo de iniciar transmissao e tambem durante a transmissao.

Fora (NAO tocar):
- Compartilhamento de JANELA (so monitor inteiro nesta versao; janela fica como evolucao futura).
- Qualquer forma de CONTROLE remoto: isto e ponteiro, nao mouse compartilhado. Ninguem clica na maquina de ninguem.
- Pipeline de midia: codec, negociacao, fallbacks de direcao, watchdog. Esta feature so acrescenta dados e uma janela de desenho.
- Bloqueio de auto-visualizacao do transmissor (segue valendo; nada de reabrir a propria tela dentro do app).

## 4. Superficie de regressao

- Fallbacks de direcao (mesh race-to-open, media pull, dial-back de admissao) e watchdog: intactos. O e2e `expectNoDirectionFallbacks` precisa continuar verde.
- Canal de dados existente: acrescentar um tipo de mensagem nao pode quebrar cliente antigo. LICAO REGISTRADA NO LESSONS: enum de protocolo com validacao fechada faz o cliente antigo DESCARTAR a mensagem inteira; investigar e documentar o comportamento do cliente antigo nas notas da release.
- Performance: o pilar do projeto e a qualidade e a fluidez da tela transmitida. Nem o envio das posicoes nem o desenho do overlay podem custar frames.
- Card de status do transmissor, exclusao de audio e aviso de tela preta: nao podem ser afetados.

## 5. Papeis e permissoes

N/A por papel de sala (dono e membro se comportam igual). A unica decisao e LOCAL de quem transmite: ligar ou nao os cursores. Ponto a confirmar: se o transmissor desliga, os espectadores continuam vendo os cursores uns dos outros ou tudo se apaga (ver P3).

## 6. Entidades e ciclo de vida

Nada persistido (a preferencia pode ou nao ser lembrada, ver P4). O ciclo relevante e o da transmissao: iniciar com a opcao ligada (overlay sobe), mover o mouse sobre o video (posicoes fluem), ficar parado (cursor some sozinho), ligar/desligar no meio, trocar de fonte, parar de transmitir (overlay desce e nao pode sobrar janela orfa), espectador sair da sala (o cursor dele desaparece na hora).

## 7. Regras de negocio e exemplos

- Exemplo alvo: Leo transmite o monitor inteiro com a opcao ligada. Bruna, assistindo, move o mouse sobre o video e para em cima de um botao. Na tela real do Leo aparece uma setinha na cor da Bruna, com o nome "Bruna" em cima, exatamente sobre aquele botao. Joao, tambem assistindo, ve o cursor da Bruna sobre o video dele, mas NAO ve um cursor duplicado do proprio mouse.
- Exemplo de mapeamento: a Bruna aponta a 35% da largura e 60% da altura do conteudo. Esse par viaja como dado. Na tela do Leo vira pixel sobre o monitor compartilhado; na tela do Joao vira pixel sobre o video dele, que pode ter tamanho e bordas diferentes. Mesma referencia logica, tres desenhos distintos.
- Regra: cada participante desenha os cursores de todos MENOS o proprio.

## 8. Casos de borda / caminhos tristes

- DOIS MONITORES compartilhando so um: o overlay precisa cobrir APENAS o monitor compartilhado, e as coordenadas se referem a ele. Resolvivel, mas precisa estar no plano desde o inicio.
- COMPARTILHAMENTO DE JANELA: o overlay teria que perseguir a janela enquanto ela se move e redimensiona. Fora do escopo desta versao (secao 3); definir o que a UI faz quando a fonte e janela: esconder a opcao, ou mostrar desabilitada com explicacao (ver P1).
- SALA CHEIA: sete cursores tremendo viram poluicao visual. Solucao elegante ja escolhida em principio: o cursor SOME sozinho depois de alguns segundos parado e reaparece ao mover. Tempo exato em aberto (P2).
- JOGO EM TELA CHEIA EXCLUSIVA: o Windows normalmente nao deixa nada ser desenhado por cima. E limitacao do sistema, nao do app; precisa ser documentada e, se possivel, detectada para avisar em vez de falhar em silencio.
- `setContentProtection` nao funcionar como esperado: os cursores entrariam no video e cada espectador veria o proprio fantasma atrasado. E o cenario que a sonda deve descartar ANTES da implementacao.
- Espectador sai da sala ou cai a conexao: o cursor dele nao pode ficar parado na tela para sempre.
- Transmissao trocada de fonte no meio: as coordenadas antigas nao valem mais para a fonte nova; o overlay precisa se remapear ou limpar.
- Fluxo de posicoes: precisa ser limitado (algo em torno de 20 a 30 envios por segundo) e nunca virar enxurrada no canal de dados.
- Espectador com a janela em segundo plano ou minimizada: nao faz sentido continuar enviando posicao.
- Cursor fora da area do video (ponteiro sobre a UI do app, ou fora da janela): nao deve aparecer na tela do transmissor.

## 9. Referencia de UI

mode: project-identity. Tema escuro + roxo #9d00ff, tokens ja catalogados no UISPEC da app-audio-capture. Cor de cada cursor = a cor que a pessoa ja tem na lista de participantes. O toggle segue o padrao do toggle de audio no SourcePickerModal, e o controle durante a transmissao segue o padrao da barra de transmissao.

DIRECAO DE MOTION (regua alta do usuario, animar onde couber):
- Movimento do cursor: as posicoes chegam umas 20 vezes por segundo, entao o cursor deve DESLIZAR suavemente entre uma posicao e outra em vez de pular. E o que faz parecer fluido em vez de travado. Esta e a animacao mais importante da feature.
- Entrada: quando um espectador comeca a apontar, o cursor dele aparece com uma entrada suave (fade + leve escala), nao um pop seco.
- Saida por inatividade: desaparecimento suave depois dos segundos de parada, e reaparecimento suave ao voltar a mover.
- Saida definitiva (pessoa saiu da sala): desaparecimento com transicao, nunca sumir de repente.
- Ligar/desligar no meio da transmissao: transicao coletiva suave, nao um corte.
LIMITES: transform/opacity apenas, sem loop continuo, sem custar frames de video, e `prefers-reduced-motion` respeitado (com movimento reduzido, o cursor pode saltar direto para a posicao em vez de interpolar).

## 10. Prioridades

- Must: o transmissor ver, sobre a propria tela real, o cursor de quem esta assistindo, com cor e nome.
- Must: ninguem ver o proprio cursor duplicado/atrasado.
- Should: espectadores verem os cursores uns dos outros sobre o video.
- Should: ligar e desligar durante a transmissao.
- Should: cursor sumir sozinho quando parado.
- Nice: lembrar a preferencia entre transmissoes.
- Nao fazer: controle remoto de mouse ou teclado.

## 11. Assumptions confirmadas

- 2026-08-25: o usuario escolheu explicitamente o caminho do overlay sobre a tela real (em vez de uma previa dentro do app) por ser o que torna a feature util de verdade: ele continua usando a maquina normalmente e ve o dedo do amigo no lugar exato.
- 2026-08-25: a captura de tela do Windows inclui o cursor do proprio transmissor, entao o caminho inverso (espectador ver para onde o transmissor aponta) ja funciona hoje e nao precisa de trabalho.

## 12. Pontos em aberto (lista viva)

- P1: O que a UI faz quando a fonte escolhida e uma JANELA (opcao escondida, ou visivel e desabilitada com explicacao)?
- P2: Quantos segundos parado ate o cursor sumir, e ele reaparece instantaneamente ao mover?
- P3: Se o transmissor desliga a opcao, os espectadores continuam vendo os cursores uns dos outros, ou tudo se apaga junto?
- P4: A preferencia e lembrada entre transmissoes ou sempre comeca desligada?
- P5: Detectar jogo em tela cheia exclusiva para avisar que o overlay nao vai aparecer, ou apenas documentar a limitacao?
- P6: As posicoes trafegam direto entre espectadores pela malha, ou passam pelo transmissor e ele reemite? (O transmissor ja esta conectado a todos; decidir no SPEC pesando latencia e simplicidade.)

## 13. APENDICE: contexto tecnico

Sequenciamento combinado com o usuario: esta feature vem DEPOIS da `video-codec-upgrade` (que por sua vez vem depois da `black-screen-notice`). Ver `.forge/complete/` e `.forge/in-progress/` para o estado das demais.

Pontos de partida conhecidos no codigo: `src/renderer/src/ui/components/PlayerView.tsx` (elemento de video onde os cursores dos outros serao desenhados), `src/renderer/src/ui/components/SourcePickerModal.tsx` (padrao do toggle de audio, onde entra a nova opcao), a barra de transmissao (controle durante a transmissao), o canal de dados/malha em `src/renderer/src/services/` (por onde as posicoes viajam), e o processo principal em `src/main/` (criacao da janela de overlay, `setContentProtection`, e o mapeamento do monitor compartilhado).

Convencoes do projeto: identificadores em ingles, strings de UI em pt-BR sem acento, PROIBIDO travessao. Commits conventional em pt-BR sem acento e sem assinatura. Testes: Vitest em `tests/unit` (sem importar modulos do main) e Playwright `_electron` em `tests/e2e` (esperar o overlay `.z-doors` sumir antes de asserir na tela de sala). Ler `.forge/LESSONS.md` antes de planejar: ha licoes diretamente aplicaveis aqui sobre enum de protocolo com validacao fechada, sonda antes de assumir capacidade de API, e comandos com glob amplo dentro de uma feature.
