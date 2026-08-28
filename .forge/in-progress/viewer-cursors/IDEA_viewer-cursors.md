---
feature: viewer-cursors
language: pt-BR
type: create
status: done
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
- 2026-08-26: NAO EXISTE COR POR PESSOA HOJE. O `forge-context` derrubou uma premissa da decisao de 2026-08-25: `.z-participant__avatar` (room.css) usa `var(--accent-soft)` para TODOS, e nao ha nenhuma funcao de hash de peerId para matiz no projeto. A cor por pessoa precisa ser CRIADA, nao reusada. Pedido do usuario: "pode gerar cores aleatorias pra cada um, cores distantes uma da outra pra n ter confusao".
- 2026-08-26: REQUISITO DA COR (o algoritmo fica para o SPEC). Tres propriedades obrigatorias: (i) DETERMINISTICA a partir do peerId, para todos os clientes chegarem na MESMA cor para a mesma pessoa sem combinar nada entre si (sorteio local puro esta descartado: o mesmo Leo sairia verde numa tela e azul na outra e a cor deixaria de identificar); (ii) MATIZES BEM SEPARADOS entre as pessoas presentes, para nao dar confusao; (iii) ESTAVEL enquanto a pessoa esta na sala. TENSAO REGISTRADA PARA O SPEC: (ii) e (iii) brigam entre si, porque espacar ao maximo em geral pede reindexar quando alguem entra, e reindexar troca a cor de quem ja estava. O SPEC decide o equilibrio; a saturacao e a luminosidade devem ficar amarradas ao tema escuro + roxo #9d00ff para as cores lerem como familia.
- 2026-08-26: A COR VAI NO CURSOR E TAMBEM NAS BOLINHAS DA LISTA DE PARTICIPANTES (decisao do orquestrador no modo autonomo). Cor distinta so serve para reconhecer quem e quem, e a lista de participantes e a ancora desse reconhecimento: sem ela, a cor do cursor nao remete a ninguem e a pessoa tem que ler o nome toda vez. Consequencia assumida: a lista de participantes entra na superficie de regressao (secao 4).
- 2026-08-26 (P1 RESOLVIDO): quando a fonte escolhida e uma JANELA, a opcao aparece DESABILITADA com a explicacao "Disponivel apenas ao compartilhar um monitor inteiro". Nao esconder: escondida, quem ja usou acha que a feature sumiu ou quebrou e nao tem como descobrir o porque.
- 2026-08-26 (P2 RESOLVIDO): cursor parado por 5 SEGUNDOS some por completo (fade out); reaparece com fade in ao primeiro movimento. Simples, sem estado intermediario. Efeito colateral aceito conscientemente: quem aponta e fica falando sobre o ponto precisa mexer o mouse de leve para o ponteiro nao sumir no meio da explicacao.
- 2026-08-26 (P3 RESOLVIDO): quando quem transmite DESLIGA a opcao, a camada de ponteiros inteira se apaga naquela transmissao, para todos. O espectador recebe um aviso discreto ("Ponteiros desativados por quem transmite"). Coerente (evita gente apontando para quem nao ve) e zera o trafego de posicoes quando esta off.
- 2026-08-26 (P4 RESOLVIDO): a preferencia NAO e lembrada. Toda transmissao comeca com os ponteiros DESLIGADOS e quem transmite liga se quiser. Isto rebaixa o item "lembrar a preferencia" da secao 10 de nice-to-have para NAO FAZER nesta versao.
- 2026-08-26 (P5 RESOLVIDO): jogo em tela cheia exclusiva - apenas DOCUMENTAR a limitacao, sem tentar detectar. Deteccao confiavel disso no Windows e cara e furada; nao vale complicar a v1.
- 2026-08-26 (P6 RESOLVIDO): rota das posicoes fica DELEGADA AO SPEC, como a propria IDEA ja previa, com preferencia pela malha direta se a topologia confirmar full-mesh (o CONTEXT aponta PeerJS em malha, sem TURN).
- 2026-08-26: APONTAR SO VALE NO PLAYER GRANDE (`PlayerView.tsx`). O video tambem aparece em `StreamThumbnail.tsx` e em `TransmissionStatusCard.tsx`, mas na miniatura o alvo e pequeno demais: um erro de 3 px vira metros na tela do transmissor. Ponteiro impreciso e pior que ponteiro nenhum. Tambem evita manter duas superficies de captura de coordenada.
- 2026-08-26: TRANSMISSOES SIMULTANEAS SAO REAIS e o desenho e ESCOPADO POR `txId`. O `forge-context` mostrou que `room-state.ts` guarda `transmissions: Record<txId, TransmissionState>` e que cada participante tem um `selfWatchingTxId` (a transmissao que ele assiste). Portanto: cada posicao viaja carimbada com o `txId` que a pessoa esta assistindo e so aparece para quem esta naquela transmissao; e o toggle e POR TRANSMISSAO, cada transmissor decide na sua sem afetar a do outro. A IDEA original tinha sido escrita como se houvesse uma transmissao unica.
- 2026-08-26: SEGUNDA SONDA OBRIGATORIA, ao lado da do `setContentProtection`. O `forge-context` confirmou que NAO existe hoje nenhuma ponte entre o `display_id` da fonte do `desktopCapturer` e o `screen.getAllDisplays()` do Electron: o mapeamento "a fonte que estou compartilhando" para "as coordenadas fisicas daquele monitor" e inedito e nao verificado. Sem ele o overlay nao sabe QUAL monitor cobrir. Mesma regra da primeira sonda: e premissa, entao tem que ser executada antes do desenho final.
- 2026-08-26: SE QUALQUER UMA DAS DUAS SONDAS FALHAR, O PIPELINE PARA e volta para conversa com o usuario. Nao improvisar plano B no meio da implementacao. Vem direto da licao ja registrada no LESSONS (premissa de API so vira fato quando executada).
- 2026-08-26: O ESPECTADOR NAO PRECISA ATIVAR NADA. Se quem transmite ligou os ponteiros, todo espectador ja aponta so movendo o mouse sobre o player. Exigir que cada um ligue o proprio ponteiro mataria a premissa da feature ("clica ali, nao, mais pra baixo" tem que virar apontar e pronto). Nao ha questao de privacidade relevante: e a posicao do mouse sobre uma tela que o grupo ja esta vendo junto, entre pessoas que ja estao na mesma sala e conversando.

## 3. Escopo

Dentro:
- Overlay transparente, sempre no topo e que deixa os cliques passarem, sobre o MONITOR compartilhado, mostrando os cursores dos espectadores.
- Envio das posicoes pelo canal de dados que ja existe entre os participantes.
- Desenho local dos cursores dos OUTROS sobre o video, no lado de quem assiste.
- Toggle no fluxo de iniciar transmissao e tambem durante a transmissao, sempre comecando DESLIGADO.
- Cor por pessoa deterministica (nova no projeto), aplicada aos cursores E as bolinhas da lista de participantes.
- Escopo por `txId`: as posicoes pertencem a uma transmissao especifica e o toggle vale por transmissao.

Fora (NAO tocar):
- Compartilhamento de JANELA (so monitor inteiro nesta versao; janela fica como evolucao futura).
- Qualquer forma de CONTROLE remoto: isto e ponteiro, nao mouse compartilhado. Ninguem clica na maquina de ninguem.
- Pipeline de midia: codec, negociacao, fallbacks de direcao, watchdog. Esta feature so acrescenta dados e uma janela de desenho.
- Bloqueio de auto-visualizacao do transmissor (segue valendo; nada de reabrir a propria tela dentro do app).
- Apontar pela MINIATURA da grade ou pelo card de status: so o player grande captura coordenada.
- LEMBRAR a preferencia entre transmissoes (P4: sempre comeca desligada).
- DETECTAR jogo em tela cheia exclusiva (P5: apenas documentar a limitacao).

## 4. Superficie de regressao

- Fallbacks de direcao (mesh race-to-open, media pull, dial-back de admissao) e watchdog: intactos. O e2e `expectNoDirectionFallbacks` precisa continuar verde.
- Canal de dados existente: acrescentar um tipo de mensagem nao pode quebrar cliente antigo. LICAO REGISTRADA NO LESSONS: enum de protocolo com validacao fechada faz o cliente antigo DESCARTAR a mensagem inteira; investigar e documentar o comportamento do cliente antigo nas notas da release.
- Performance: o pilar do projeto e a qualidade e a fluidez da tela transmitida. Nem o envio das posicoes nem o desenho do overlay podem custar frames.
- Card de status do transmissor, exclusao de audio e aviso de tela preta: nao podem ser afetados.
- LISTA DE PARTICIPANTES (`ParticipantCard.tsx` + `.z-participant__avatar` em `room.css`): entra na superficie de regressao porque a cor por pessoa passa a ser aplicada la. Hoje todos os avatares usam `var(--accent-soft)`; a mudanca nao pode quebrar contraste, legibilidade da inicial nem o layout da lista.
- Transmissoes simultaneas: acrescentar carimbo de `txId` nas posicoes nao pode confundir o estado de `transmissions` / `selfWatchingTxId` que ja existe.

## 5. Papeis e permissoes

N/A por papel de sala (dono e membro se comportam igual). A unica decisao e de quem transmite, POR TRANSMISSAO: ligar ou nao os ponteiros na transmissao dele. RESOLVIDO (P3, 2026-08-26): quando ele desliga, a camada inteira se apaga naquela transmissao para todos, com aviso discreto no espectador. O espectador nao tem decisao nenhuma a tomar: se esta ligado, ele aponta so movendo o mouse sobre o player.

## 6. Entidades e ciclo de vida

NADA PERSISTIDO (P4 resolvido em 2026-08-26: a preferencia nao e lembrada, toda transmissao comeca desligada). O ciclo relevante e o da transmissao: iniciar (sempre desligado), ligar no meio (overlay sobe), mover o mouse sobre o player (posicoes fluem), ficar 5 s parado (cursor some sozinho), voltar a mover (reaparece), desligar no meio (camada se apaga para todos), trocar de fonte, parar de transmitir (overlay desce e nao pode sobrar janela orfa), espectador trocar de transmissao (ponteiro dele migra e nao deixa fantasma), espectador sair da sala (o cursor dele desaparece na hora).

## 7. Regras de negocio e exemplos

- Exemplo alvo: Leo transmite o monitor inteiro com a opcao ligada. Bruna, assistindo, move o mouse sobre o video e para em cima de um botao. Na tela real do Leo aparece uma setinha na cor da Bruna, com o nome "Bruna" em cima, exatamente sobre aquele botao. Joao, tambem assistindo, ve o cursor da Bruna sobre o video dele, mas NAO ve um cursor duplicado do proprio mouse.
- Exemplo de mapeamento: a Bruna aponta a 35% da largura e 60% da altura do conteudo. Esse par viaja como dado. Na tela do Leo vira pixel sobre o monitor compartilhado; na tela do Joao vira pixel sobre o video dele, que pode ter tamanho e bordas diferentes. Mesma referencia logica, tres desenhos distintos.
- Regra: cada participante desenha os cursores de todos MENOS o proprio.
- Regra: uma posicao so e desenhada por quem esta assistindo a MESMA transmissao (`txId`) de onde ela veio. Exemplo: Leo transmite (txId A) e Carla transmite (txId B) ao mesmo tempo. Bruna assiste a A e aponta; o ponteiro dela aparece na tela real do Leo e para os demais espectadores de A. Quem esta assistindo a B nao ve nada disso, e a Carla pode ter os ponteiros desligados na transmissao dela sem afetar a do Leo.
- Regra da cor, com exemplo: a cor de cada pessoa sai do peerId dela por uma regra deterministica, entao Bruna e a MESMA cor na tela do Leo, na do Joao e na dela propria. Se a Bruna e "roxo-rosado", a bolinha dela na lista de participantes tambem e roxo-rosada, e e assim que o Leo reconhece o ponteiro sem ler o nome. Duas pessoas na sala nunca devem cair em matizes vizinhos a ponto de confundir.
- Regra: a opcao comeca DESLIGADA em toda transmissao; enquanto estiver desligada nenhuma posicao trafega.

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
- TRANSMISSOES SIMULTANEAS: o espectador troca da transmissao A para a B no meio. O ponteiro dele tem que sumir de A na hora e so passar a valer em B; nao pode ficar um ponteiro fantasma parado na tela do transmissor de A.
- QUEM TRANSMITE TAMBEM ASSISTE: uma pessoa pode estar transmitindo a sua e assistindo a de outro. Ela aponta na transmissao que assiste e ve ponteiros na que transmite; os dois papeis convivem e nao se misturam.
- MOUSE SOBRE A MINIATURA: como so o player grande captura coordenada, mover o mouse sobre a miniatura nao pode gerar posicao nenhuma (nem uma posicao errada, nem um ponteiro preso na ultima posicao valida).
- SONDA DO MAPEAMENTO DE MONITOR falhar: sem a ponte entre a fonte do `desktopCapturer` e o monitor fisico, o overlay nao sabe qual monitor cobrir. Como a sonda do `setContentProtection`, e cenario de PARAR e conversar, nao de improvisar.
- COR: duas pessoas caindo em cores parecidas demais, e a cor de alguem MUDANDO quando outra pessoa entra na sala (consequencia possivel do algoritmo de espacamento; ver a tensao registrada na secao 2).
- Toggle desligado pelo transmissor enquanto alguem esta apontando: os ponteiros na tela precisam sair com transicao e o aviso discreto tem que chegar aos espectadores, sem toast duplicado por espectador.

## 9. Referencia de UI

mode: project-identity. Tema escuro + roxo #9d00ff, tokens ja catalogados no UISPEC da app-audio-capture. Cor de cada cursor = a cor por pessoa CRIADA por esta feature (ver secao 2), a mesma que passa a valer na bolinha da lista de participantes. O toggle segue o padrao do toggle de audio no SourcePickerModal, e o controle durante a transmissao segue o `z-switch` com o modificador `z-switch--bar` que o toggle de nitidez (`sharpness-toggle`) ja estabeleceu na TransmittingBar.

DIRECAO DE MOTION (regua alta do usuario, animar onde couber):
- Movimento do cursor: as posicoes chegam umas 20 vezes por segundo, entao o cursor deve DESLIZAR suavemente entre uma posicao e outra em vez de pular. E o que faz parecer fluido em vez de travado. Esta e a animacao mais importante da feature.
- Entrada: quando um espectador comeca a apontar, o cursor dele aparece com uma entrada suave (fade + leve escala), nao um pop seco.
- Saida por inatividade: desaparecimento suave depois de 5 s parado (P2), e reaparecimento suave ao voltar a mover.
- Saida definitiva (pessoa saiu da sala): desaparecimento com transicao, nunca sumir de repente.
- Ligar/desligar no meio da transmissao: transicao coletiva suave, nao um corte.
LIMITES: transform/opacity apenas, sem loop continuo, sem custar frames de video, e `prefers-reduced-motion` respeitado (com movimento reduzido, o cursor pode saltar direto para a posicao em vez de interpolar). NOTA DO CONTEXT: `prefers-reduced-motion` ja e tratado globalmente em `theme.css` (zera os tokens de duracao e forca `animation-duration: 0.001ms`), entao as animacoes novas herdam isso de graca DESDE QUE usem os tokens de duracao existentes; a interpolacao do movimento, por nao ser CSS, precisa checar a media query explicitamente.

## 10. Prioridades

- Must: o transmissor ver, sobre a propria tela real, o cursor de quem esta assistindo, com cor e nome.
- Must: ninguem ver o proprio cursor duplicado/atrasado.
- Should: espectadores verem os cursores uns dos outros sobre o video.
- Should: ligar e desligar durante a transmissao.
- Should: cursor sumir sozinho quando parado.
- Must: cor por pessoa deterministica e bem separada, no cursor e na lista de participantes (sem ela o ponteiro nao identifica ninguem).
- Should: espectadores verem os cursores uns dos outros sobre o video.
- Nao fazer: lembrar a preferencia entre transmissoes (P4; era nice-to-have, foi rebaixado).
- Nao fazer: apontar pela miniatura da grade.
- Nao fazer: detectar jogo em tela cheia exclusiva.
- Nao fazer: controle remoto de mouse ou teclado.

## 11. Assumptions confirmadas

- 2026-08-25: o usuario escolheu explicitamente o caminho do overlay sobre a tela real (em vez de uma previa dentro do app) por ser o que torna a feature util de verdade: ele continua usando a maquina normalmente e ve o dedo do amigo no lugar exato.
- 2026-08-25: a captura de tela do Windows inclui o cursor do proprio transmissor, entao o caminho inverso (espectador ver para onde o transmissor aponta) ja funciona hoje e nao precisa de trabalho.

CONFIRMADAS PELO USUARIO EM 2026-08-26 (respostas diretas):
- P1 desabilitada com explicacao; P2 sumico total em 5 s; P3 desliga para todos; P4 nunca lembra; apontar so no player grande; escopo por `txId`; cores por pessoa bem separadas ("cores distantes uma da outra pra n ter confusao").

DERRUBADA EM 2026-08-26 (era premissa falsa da IDEA original):
- "Cada cursor usa a cor JA EXISTENTE da pessoa." FALSA. Nao ha cor por pessoa no app: todos os avatares usam `var(--accent-soft)`. A cor tem que ser criada por esta feature. Foi o `forge-context` que pegou; a IDEA de 2026-08-25 teria levado essa premissa ate a implementacao.

DECIDIDAS PELO ORQUESTRADOR NO MODO AUTONOMO EM 2026-08-26 (diretriz 2(a); usuario pode vetar):
- A cor por pessoa e aplicada TAMBEM na lista de participantes, nao so no cursor (justificativa na secao 2).
- "Aleatorias" foi lido como "bem separadas e distintas", nao como sorteio local: sorteio local puro quebraria a identidade entre clientes. Requisito reescrito como deterministico na secao 2.
- O espectador nao ativa nada: apontar e automatico quando o transmissor ligou.
- O nome fica visivel junto do cursor durante todo o tempo em que o cursor esta visivel (nao so ao mover).
- Sem limite de quantos apontam ao mesmo tempo: todo espectador da transmissao pode apontar.
- A janela de overlay so sobe quando a opcao esta LIGADA; nao fica uma janela invisivel permanente sobre o monitor.
- Parar de transmitir derruba o overlay na hora, e a queda do overlay e responsabilidade do mesmo ciclo que encerra a transmissao (nada de janela orfa).
- Falha de qualquer uma das duas sondas PARA o pipeline e volta para conversa, em vez de virar plano B improvisado.

## 12. Pontos em aberto (lista viva)

TODOS OS SEIS PONTOS ORIGINAIS FORAM FECHADOS EM 2026-08-26 (detalhe e justificativa na secao 2):
- P1 (UI quando a fonte e janela): RESOLVIDO - desabilitada com explicacao.
- P2 (tempo ate o cursor sumir): RESOLVIDO - 5 s parado, some por completo, reaparece ao mover.
- P3 (transmissor desliga): RESOLVIDO - apaga para todos naquela transmissao, com aviso discreto.
- P4 (preferencia lembrada): RESOLVIDO - nunca lembra, sempre comeca desligada.
- P5 (jogo em tela cheia exclusiva): RESOLVIDO - apenas documentar, sem deteccao.
- P6 (rota das posicoes): RESOLVIDO como delegacao deliberada ao SPEC, com preferencia por malha direta.

NENHUM PONTO DE PRODUTO EM ABERTO. O que resta e tecnico e ja esta enderecado ao SPEC:
- T1: algoritmo da cor, equilibrando matizes bem separados contra estabilidade quando alguem entra na sala (tensao registrada na secao 2).
- T2: as DUAS sondas obrigatorias (`setContentProtection` e o mapeamento fonte do `desktopCapturer` -> monitor fisico), antes de qualquer desenho final.
- T3: rota das posicoes na malha (P6) e o formato/frequencia da mensagem no canal de dados, incluindo o que a release note dira sobre cliente antigo (o `MessageType` e enum fechado validado por `isOneOf`: cliente antigo DESCARTA o envelope inteiro, confirmado pelo CONTEXT).
- T4: utilitario da area real do video dentro do elemento (descontar as bordas pretas do `object-fit: contain`), e se ele e compartilhado entre o `PlayerView` e o overlay do transmissor ou calculado dos dois lados.
- T5: como o e2e alcanca uma SEGUNDA janela (`app.windows()`), ja que o helper `tests/e2e/helpers/zoi-app.ts` so usa `app.firstWindow()` hoje.

## 13. APENDICE: contexto tecnico

Sequenciamento: `black-screen-notice` esta COMPLETA; a `video-codec-upgrade` esta implementada, mergeada na main e publicada na v0.3.0, parada em `testing` so por 9 itens manuais que dependem das maquinas reais do grupo. Esta feature e a proxima da fila e teve a Stage 1 fechada em 2026-08-26. Ver `.forge/complete/` e `.forge/in-progress/` para o estado das demais.

CONTEXT: `CONTEXT_viewer-cursors.md` gerado em 2026-08-26 sobre o HEAD `7c9e8a1`. Ele e a referencia concreta de arquivos e convencoes; esta secao 13 fica so como orientacao rapida.

Pontos de partida conhecidos no codigo: `src/renderer/src/ui/components/PlayerView.tsx` (elemento de video onde os cursores dos outros serao desenhados), `src/renderer/src/ui/components/SourcePickerModal.tsx` (padrao do toggle de audio, onde entra a nova opcao), a barra de transmissao (controle durante a transmissao), o canal de dados/malha em `src/renderer/src/services/` (por onde as posicoes viajam), e o processo principal em `src/main/` (criacao da janela de overlay, `setContentProtection`, e o mapeamento do monitor compartilhado).

Convencoes do projeto: identificadores em ingles, strings de UI em pt-BR sem acento, PROIBIDO travessao. Commits conventional em pt-BR sem acento e sem assinatura. Testes: Vitest em `tests/unit` (sem importar modulos do main) e Playwright `_electron` em `tests/e2e` (esperar o overlay `.z-doors` sumir antes de asserir na tela de sala). Ler `.forge/LESSONS.md` antes de planejar: ha licoes diretamente aplicaveis aqui sobre enum de protocolo com validacao fechada, sonda antes de assumir capacidade de API, e comandos com glob amplo dentro de uma feature.
