---
feature: viewer-cursors
language: pt-BR
created: 2026-08-26
---

# PRD - viewer-cursors

## Historico de Revisoes

| Data | Revisao | O que mudou |
|------|---------|--------------|
| 2026-08-26 | 1 | Criacao da PRD a partir da IDEA (Stage 1 fechada, P1-P6 todos resolvidos na propria IDEA) e do CONTEXT tecnico revisado. |
| 2026-08-26 | 2 | Correcoes do forge-review (NEEDS-CHANGES, todas locais a PRD, sem mudanca na IDEA/CONTEXT): (BLOCKER) adicionado RF-20, requisito ausente sobre pausar o envio de posicao quando a janela do espectador perde foco/fica minimizada, com nota registrando que `visibilityState` e comprovadamente inutilizavel neste app (CONTEXT secao 7). (CONTRADICAO) RF-21 e RF-23 reescritos para nao afirmar simultaneamente "estavel" como absoluto e "reindexa ao entrar alguem" como certo; agora (ii) matizes separados e (iii) estabilidade sao objetivos com tensao registrada e delegada ao SPEC (T1), e RF-23 cobre o risco de reindexacao condicionalmente. (WARNING) adicionada a decisao da IDEA de nao inventar cursor sintetico para o transmissor, em Fora de escopo. (WARNING) elevada a RF-05, a invariante central "overlay fora da captura, cursor e dado nunca pixel". (WARNING) RNF-01 reescrito ancorado num sinal observavel do stats-monitor existente, com comparacao antes/depois. (WARNING) RF-15 (antigo) separado em dois requisitos com prioridade correta da IDEA secao 10: RF-14 `[MUST]` ninguem ve o proprio cursor, RF-15 `[SHOULD]` espectadores veem os cursores uns dos outros. (WARNING) trazida de volta a restricao de saturacao/luminosidade amarradas ao tema escuro + roxo, como quarta propriedade da cor em RF-21. (WARNING) elevada a RF-25 a animacao de deslizar do cursor entre posicoes, com AC proprio. (WARNING) adicionados ACs que faltavam para RF-07 (overlay so sobe quando ligado), RNF-06 (txId nao corrompe estado) e RNF-07 (animacoes so em transform/opacity). (WARNING) uniformizado o criterio de quando um item "Nao fazer" da IDEA secao 10 vira `[WONT]`: os 4 itens (lembrar preferencia, apontar pela miniatura, detectar jogo em tela cheia, controle remoto) agora tem rastreabilidade explicita, com RF-03 e RF-13 mantidos como `[MUST]` (tem contraparte positiva testavel, nota de rastreabilidade incluida) e RF-31 e o novo RF-33 como `[WONT]` (exclusao pura, sem contraparte positiva); removidos os RFs duplicados antigos (RF-04 e RF-06 da revisao 1). (NIT) AC-41 (antigo AC-32) ganhou ancoragem explicita a RF-06, RF-14 e RNF-02, alem da Metrica de sucesso. (NIT) Metrica de sucesso, item (a), ganhou alvo duro (menos de 1 segundo). (NIT) RF-32 (antigo RF-30) reescrito sem a suavizacao "da ordem de", alinhado a faixa firme do AC. (NIT) RNF-08 reescrito priorizando o resultado observavel (cursor salta em vez de interpolar), com o mecanismo (checar a media query em JS) rebaixado a nota/justificativa, sem remover a informacao. Toda a secao 4 foi renumerada; a rastreabilidade dos ACs foi recalculada e nenhum AC ficou sem RF/RNF associado. |

## Baseline (ancora de drift)

- **HEAD**: `7c9e8a1c839a648de0e9faad3cb48ba9cfe920e0`
- **Fingerprint IDEA_viewer-cursors.md** (sha256, 64 caracteres): `1759d1ffa0e13eb0702a4b9c02cb0fa9647f421b64b6098606f83443fc061f32`
- **Fingerprint CONTEXT_viewer-cursors.md** (sha256, 64 caracteres): `24bafa755a3236e65f4406ad70d154622842a62e5ef8011c1338a8f521bcaa33`

---

## 1. Objetivo e Visao

**Problema**: hoje, quando um espectador quer indicar um ponto especifico na tela de quem transmite, so resta descrever por voz ("clica ali, nao, mais pra baixo, no botao da direita"). E lento, ambiguo e depende de quem transmite entender a descricao e localizar o ponto sozinho.

**Para quem**: o grupo de amigos que usa o "Zoi da Goiaba" para compartilhar tela P2P, tanto no papel de quem transmite (ve os cursores dos espectadores sobre a propria tela real) quanto no de espectador (ve os cursores dos demais espectadores sobre o video que assiste).

**Por que agora**: esta feature e a proxima da fila apos a `video-codec-upgrade` (implementada, mergeada na main, publicada na v0.3.0, parada em `testing` so por itens manuais). A Stage 1 desta feature fechou em 2026-08-26 com todos os seis pontos em aberto originais resolvidos, deixando so decisoes tecnicas (T1-T5) explicitamente delegadas ao SPEC.

**Impacto esperado**: transformar "explica por voz onde e" em "aponta e pronto". Quem transmite enxerga, sobre a propria tela real, exatamente onde cada espectador esta apontando, com cor e nome, sem precisar abrir o app para ver a propria transmissao (o bloqueio de auto-visualizacao continua valendo). Espectadores tambem se veem apontando uns para os outros sobre o video. Nenhum espectador ve o proprio cursor (nem original, nem fantasma atrasado), porque a posicao viaja como dado pelo canal ja existente, nunca como pixel dentro do video capturado.

**Metrica de sucesso** (verificavel): numa sessao real do grupo apos a implementacao, (a) quem transmite ve o cursor de um espectador aparecer e se atualizar em MENOS DE 1 SEGUNDO desde o movimento real do mouse do espectador, valor bem abaixo do tempo de pronunciar uma frase falada e consistente com a cadencia de envio de 20 a 30 vezes por segundo ja exigida (RF-32, RNF-01); (b) nenhum participante relata ver o proprio cursor aparecendo de volta na tela (nem instantaneo, nem atrasado); (c) os logs/telemetria existentes (`expectNoDirectionFallbacks`, stats-monitor) nao mostram nenhuma regressao de fps nem fallback de direcao novo atribuivel a esta feature.

**Diretriz de desempate (UX-first)**: nas decisoes autonomas que restarem no pipeline (SPEC/implementacao), vale o criterio ja usado nas features anteriores do projeto: escolher sempre o que beneficia a experiencia do usuario, sem atrapalhar, sem complicar e sem perder qualidade.

## 2. Publico-Alvo (Personas)

- **Quem transmite o proprio monitor inteiro**: quer ver, sobre a tela real que esta compartilhando, para onde os espectadores estao apontando, com cor e nome, sem gastar tempo descrevendo por voz onde fica cada coisa. Decide, antes de comecar e a qualquer momento durante a transmissao, se quer essa camada ligada.
- **Espectador assistindo a uma transmissao**: quer apontar um ponto so movendo o mouse sobre o video, sem ativar nada por conta propria, e quer ver os cursores dos demais espectadores da mesma transmissao sem ver o proprio.
- **Pessoa que transmite e assiste ao mesmo tempo**: transmite a propria tela (txId A) enquanto assiste a transmissao de outra pessoa (txId B). Aponta na transmissao B que assiste e ve ponteiros na transmissao A que transmite; os dois papeis nao se misturam.
- **Quem compartilha uma JANELA (nao um monitor)**: nesta versao, essa persona encontra a opcao desabilitada com explicacao; a feature nao se aplica a ela ainda.

## 3. Escopo

**Dentro do escopo:**
- Overlay transparente, sempre no topo, com cliques passando por ele, sobre o MONITOR compartilhado, mostrando os cursores dos espectadores para quem transmite.
- Envio das posicoes de cursor pelo canal de dados ja existente entre os participantes, escopado por `txId`.
- Desenho local, do lado de cada espectador, dos cursores dos OUTROS espectadores da mesma transmissao sobre o video assistido.
- Toggle da opcao no fluxo de escolha da fonte antes de transmitir (mesmo modal onde hoje se escolhe fonte e audio) e tambem durante a transmissao (barra de transmissao), sempre comecando DESLIGADO.
- Cor deterministica por pessoa (nova nesta feature, ver secao 4), aplicada ao cursor e tambem as bolinhas da lista de participantes.
- Escopo por `txId`: posicoes e toggle pertencem a uma transmissao especifica; transmissoes simultaneas nao se afetam.
- Aviso discreto ao espectador quando quem transmite desliga a opcao no meio.

**Fora de escopo / NAO fazer:**
- Compartilhamento de JANELA como fonte que recebe ponteiros (so monitor inteiro nesta versao; janela fica como evolucao futura).
- Qualquer forma de CONTROLE remoto de mouse ou teclado: isto e ponteiro, nunca mouse compartilhado. Ninguem clica na maquina de ninguem (ver tambem RF-33).
- Cursor sintetico para o transmissor: a captura de tela do Windows ja inclui o cursor real dele; esta feature nao inventa nem desenha um cursor adicional para quem transmite (decisao da IDEA, secao 2).
- Alteracoes no pipeline de midia: codec, negociacao, fallbacks de direcao, watchdog. Esta feature so acrescenta dados e uma janela de desenho.
- Alteracoes no bloqueio de auto-visualizacao do transmissor (continua valendo, intocado).
- Apontar pela MINIATURA da grade (`StreamThumbnail.tsx`) ou pelo card de status do transmissor (`TransmissionStatusCard.tsx`): so o player grande (`PlayerView.tsx`) captura coordenada (ver tambem RF-13).
- LEMBRAR a preferencia de ligar os ponteiros entre transmissoes: toda transmissao comeca sempre desligada (ver tambem RF-03, P4 resolvido).
- DETECTAR jogo em tela cheia exclusiva: a limitacao e apenas documentada, sem tentativa de deteccao automatica (ver tambem RF-31, P5 resolvido).
- Limitar quantos espectadores podem apontar ao mesmo tempo numa transmissao.

## 4. Requisitos Funcionais

Nota: nao ha distincao de papel de sala (dono/membro) nestes requisitos; a unica decisao de permissao e de quem transmite, por transmissao, sobre ligar ou nao os ponteiros na propria transmissao (IDEA secao 5).

Nota sobre criterio MoSCoW `[WONT]`: um item listado em "Nao fazer" na IDEA secao 10 vira `[WONT]` explicito nesta lista SOMENTE quando for uma exclusao pura, sem nenhuma contraparte de comportamento positivo testavel (RF-31, RF-33). Quando o mesmo item tem uma contraparte positiva testavel mais natural (ex.: "sempre comeca desligado" em vez de "nao lembra"), o requisito fica como `[MUST]` positivo, com nota explicita de que atende aquele item da secao 10 (RF-03, RF-13). Isso evita duas entradas redundantes para a mesma decisao.

**Ligar/desligar a opcao**

- **RF-01** [MUST] O fluxo de escolha da fonte antes de transmitir deve oferecer um toggle para ligar os ponteiros dos espectadores, no mesmo modal onde hoje se escolhe fonte e audio, comecando DESLIGADO.
- **RF-02** [SHOULD] A barra de transmissao deve oferecer um controle equivalente para ligar/desligar os ponteiros DURANTE uma transmissao ja em andamento, sem precisar parar e retransmitir (IDEA secao 10, Should).
- **RF-03** [MUST] O sistema NUNCA deve lembrar a preferencia de ligar os ponteiros entre transmissoes: toda nova transmissao, de qualquer fonte, comeca sempre com os ponteiros desligados, independente do valor escolhido numa transmissao anterior (atende IDEA secao 10 "Nao fazer" e P4).
- **RF-04** [MUST] Quando a fonte escolhida no fluxo de transmissao for uma JANELA (nao um monitor inteiro), o toggle de ponteiros deve aparecer DESABILITADO com uma explicacao visivel de que a opcao so esta disponivel ao compartilhar um monitor inteiro (P1). O controle nunca deve ser escondido nesse caso. Compartilhamento de janela continua fora do escopo desta versao (IDEA secao 3).

**Invariante central e camada no transmissor**

- **RF-05** [MUST] O overlay de ponteiros do transmissor deve permanecer FORA da captura de tela: nenhum cursor desenhado pela camada de overlay pode aparecer dentro do video que a captura de tela envia aos espectadores. Cada posicao de cursor viaja como DADO pelo canal de dados ja existente e e desenhada LOCALMENTE por cada cliente; nunca deve ser renderizada como pixel dentro do fluxo de video capturado. Esta e a invariante central que torna possivel um espectador nunca ver o proprio cursor (RF-14) sem exigir um video diferente por espectador.
- **RF-06** [MUST] Quando os ponteiros estiverem ligados numa transmissao, quem transmite deve ver, sobre a propria tela real (o monitor compartilhado), um cursor por espectador que estiver apontando naquela transmissao, cada um na cor daquela pessoa e com o nome dela visivel junto.
- **RF-07** [MUST] A janela/camada de overlay so deve subir quando a opcao estiver LIGADA naquela transmissao; nao deve existir uma janela de overlay permanente e invisivel sobre o monitor enquanto a opcao estiver desligada.
- **RF-08** [MUST] Quando quem transmite tem dois ou mais monitores mas compartilha apenas um deles, o overlay de ponteiros deve cobrir SOMENTE o monitor efetivamente compartilhado, nunca os demais.
- **RF-09** [MUST] O overlay de ponteiros nunca deve capturar cliques ou interferir no uso normal da maquina de quem transmite (cliques atravessam a camada).
- **RF-10** [MUST] Ao parar de transmitir, a camada de overlay deve descer imediatamente, sem deixar nenhuma janela orfa sobre a tela.
- **RF-11** [MUST] Ao trocar de fonte no meio de uma transmissao com ponteiros ligados, as coordenadas antigas nao devem ser aplicadas a fonte nova: o overlay deve se remapear para a nova fonte ou se limpar, nunca exibir um ponteiro na posicao errada.

**Apontar do lado do espectador**

- **RF-12** [MUST] O espectador nao ativa nada por conta propria: se quem transmite ligou os ponteiros naquela transmissao, mover o mouse sobre o player grande ja e suficiente para a posicao do espectador ser enviada e desenhada nas telas dos demais.
- **RF-13** [MUST] Apontar so deve funcionar dentro do player grande (`PlayerView.tsx`). Mover o mouse sobre a miniatura da grade ou sobre o card de status do transmissor nunca deve gerar ou atualizar uma posicao de ponteiro (atende IDEA secao 10 "Nao fazer").
- **RF-14** [MUST] Cada participante deve desenhar os cursores de todos os demais espectadores da mesma transmissao, MENOS o proprio: ninguem ve o proprio cursor, seja instantaneo ou atrasado (IDEA secao 10, Must).
- **RF-15** [SHOULD] Espectadores devem ver os cursores uns dos outros sobre o video que assistem, nao apenas o transmissor (IDEA secao 10, Should).
- **RF-16** [MUST] Uma posicao de cursor so deve ser desenhada por quem esta assistindo a MESMA transmissao (`txId`) de onde ela se originou; espectadores de uma transmissao simultanea diferente nunca veem esses cursores.
- **RF-17** [MUST] Cursor fora da area real do video (mouse sobre a UI do app, ou fora da janela do app) nunca deve gerar uma posicao valida nem deixar um ponteiro preso na ultima posicao conhecida.
- **RF-18** [MUST] Ao trocar de uma transmissao para outra (txId A para txId B) no meio de uma sessao de assistir, o ponteiro do espectador deve desaparecer de A imediatamente e so passar a valer em B; nenhum ponteiro fantasma pode continuar aparecendo na tela do transmissor de A.
- **RF-19** [MUST] Coordenadas de cursor devem ser normalizadas como fracao da largura e altura do CONTEUDO real compartilhado (descontando as bordas pretas do letterbox), para que a mesma posicao logica seja remapeada corretamente em telas de espectadores com tamanhos e proporcoes diferentes.
- **RF-20** [MUST] Quando a janela do espectador perde o foco do sistema operacional ou fica em segundo plano/minimizada, o envio da posicao de cursor daquele espectador deve pausar; ao a janela voltar a ter foco/ficar em primeiro plano, o envio deve retomar normalmente ao mouse se mover de novo sobre o player. NOTA para o SPEC: o sinal obvio para isso (`document.visibilityState`) fica SEMPRE `'visible'` neste app por causa de `backgroundThrottling: false` (configurado para o heartbeat do PeerJS nao ser estrangulado quando a janela e minimizada), conforme o CONTEXT ja documentou; a implementacao precisa escolher outro sinal (ex.: foco de janela do sistema operacional), sem herdar essa armadilha ja conhecida.

**Identidade visual (cor por pessoa)**

- **RF-21** [MUST] O sistema deve calcular uma cor por pessoa que nao existe hoje no projeto, com QUATRO propriedades: (i) DETERMINISTICA a partir do `peerId`, de forma que todo cliente calcule a MESMA cor para a mesma pessoa sem combinar nada entre si; (ii) objetivo de matizes BEM SEPARADOS entre as pessoas presentes na sala, para evitar confusao; (iii) objetivo de ESTAVEL enquanto a pessoa permanece na sala; (iv) saturacao e luminosidade amarradas ao tema escuro + roxo `#9d00ff`, para as cores lerem como familia visual com o resto do app (restricao de identidade visual, nao de algoritmo). As propriedades (ii) e (iii) tem uma TENSAO CONHECIDA e registrada na IDEA (secao 2): espacar ao maximo tende a pedir reindexar quando alguem entra na sala, e reindexar troca a cor de quem ja estava. Esta PRD nao decide qual das duas vence nem presume que a reindexacao vai necessariamente acontecer; o equilibrio fica a cargo do SPEC (T1).
- **RF-22** [MUST] A cor calculada em RF-21 deve ser aplicada tanto ao cursor da pessoa quanto a bolinha dela na lista de participantes (`ParticipantCard.tsx` / `.z-participant__avatar`), substituindo a cor unica atual (`var(--accent-soft)`) por uma cor distinta por pessoa.
- **RF-23** [MUST] SE o algoritmo escolhido pelo SPEC para equilibrar (ii) e (iii) do RF-21 causar a reindexacao/troca de cor de uma bolinha de participante ja existente na lista (por exemplo, quando alguem novo entra na sala), essa troca nunca deve quebrar o contraste minimo de legibilidade da inicial nem o layout ja existente do card. Este requisito cobre o RISCO conhecido; nao presume que a reindexacao vai obrigatoriamente ocorrer.
- **RF-24** [MUST] O nome do espectador deve permanecer visivel junto do cursor durante todo o tempo em que o cursor esta visivel, nao apenas no instante em que o mouse se move.

**Animacao**

- **RF-25** [MUST] O cursor de um espectador deve DESLIZAR suavemente entre uma posicao recebida e a proxima, em vez de saltar/pular diretamente para o novo ponto. A IDEA (secao 9) trata esta como "a animacao mais importante da feature", ja que as posicoes chegam por volta de 20 a 30 vezes por segundo (RF-32) e a interpolacao e o que faz o movimento parecer fluido em vez de travado. Excecao: ver RNF-08 para o comportamento com `prefers-reduced-motion` ativo.
- **RF-26** [SHOULD] Um cursor parado por 5 segundos deve desaparecer por completo (fade out); ao primeiro movimento apos isso, deve reaparecer (fade in) (IDEA secao 10, Should; P2 resolvido).

**Ciclo de vida e casos de borda**

- **RF-27** [MUST] Quando quem transmite desliga a opcao no meio da transmissao, a camada de ponteiros inteira deve se apagar para TODOS os espectadores daquela transmissao (P3 resolvido).
- **RF-28** [MUST] Quando a camada se apaga por RF-27, cada espectador deve receber um aviso discreto (ex.: "Ponteiros desativados por quem transmite"), sem que reenvios de estado (reconexao, atualizacao de roster) gerem um segundo aviso duplicado para o mesmo espectador na mesma ocorrencia.
- **RF-29** [MUST] Quando um espectador sai da sala ou perde a conexao, o cursor dele deve desaparecer das telas dos demais imediatamente, nunca permanecer parado indefinidamente.
- **RF-30** [MUST] Enquanto a opcao estiver desligada numa transmissao, nenhuma posicao de cursor daquela transmissao deve trafegar pelo canal de dados.
- **RF-31** [WONT] Esta feature nao detecta automaticamente jogos ou aplicativos em tela cheia exclusiva; a limitacao (o Windows normalmente impede desenhar por cima desses casos) e apenas documentada nas notas da release, sem deteccao (IDEA secao 10, "Nao fazer"; P5 resolvido).
- **RF-32** [MUST] O envio de posicoes de cursor deve ficar entre 20 e 30 envios por segundo por espectador, sem ultrapassar esse teto superior.
- **RF-33** [WONT] Esta feature nunca deve permitir controle remoto de mouse ou teclado da maquina de outra pessoa: e estritamente um ponteiro visual (dado de posicao), nunca um mecanismo de input remoto (IDEA secao 3, Fora de escopo, e secao 10, "Nao fazer").

## 5. Requisitos Nao-Funcionais

- **RNF-01** [MUST] Nem o envio das posicoes de cursor nem o desenho do overlay podem custar frames de video. Verificacao observavel: o coletor de estatisticas ja existente no projeto (stats-monitor) deve continuar registrando `framesPerSecond` e `qualityLimitationReason` por conexao durante uma transmissao com os ponteiros ligados; a comparacao antes/depois (mesmo hardware, mesmo preset, com e sem a feature ligada) nao deve mostrar queda de `framesPerSecond` nem `qualityLimitationReason` igual a `'cpu'` atribuivel a esta feature, sem exigir nenhum harness de benchmark dedicado novo.
- **RNF-02** [MUST] Nao deve haver regressao dos fallbacks de direcao ja estabilizados em campo (mesh race-to-open, media pull, dial-back de admissao) nem do watchdog de midia existente; o teste e2e `expectNoDirectionFallbacks` deve continuar passando.
- **RNF-03** [MUST] Qualquer novo tipo de mensagem de protocolo introduzido para as posicoes de cursor deve ter seu comportamento em cliente de versao antiga investigado e DOCUMENTADO nas notas da release (o `MessageType` e um enum fechado validado por `isOneOf`; um cliente antigo descarta o envelope inteiro sem feedback ao remetente), consistente com a licao ja registrada no `LESSONS.md`.
- **RNF-04** [MUST] O card de status do transmissor, a exclusao de audio e o aviso de tela preta ja existentes nao podem ser afetados por esta feature.
- **RNF-05** [MUST] Qualquer mudanca de cor aplicada por esta feature (cursor ou lista de participantes) nao pode quebrar o contraste minimo de legibilidade da inicial nem o layout ja existente do card (`ParticipantCard.tsx`, `room.css`), de forma geral e independente de um evento especifico de reindexacao (ver tambem RF-23 para o risco especifico de reindexacao).
- **RNF-06** [MUST] O carimbo de `txId` adicionado as posicoes de cursor nao pode confundir ou corromper o estado ja existente de `transmissions` / `selfWatchingTxId` em `room-state.ts`.
- **RNF-07** [MUST] Toda animacao nova de entrada, saida por inatividade, saida definitiva e transicao coletiva de ligar/desligar deve usar apenas propriedades aceleradas por GPU (`transform`/`opacity`), sem loop continuo pesado, e sem custar frames de video (a interpolacao de movimento entre posicoes tem seu proprio requisito em RF-25, com a excecao de reduced-motion tratada em RNF-08).
- **RNF-08** [MUST] Com `prefers-reduced-motion: reduce` ativo, o resultado observavel deve ser que o cursor SALTA diretamente para a posicao mais recente recebida, em vez de deslizar/interpolar entre posicoes (a interpolacao do RF-25 fica desligada nesse modo). As demais transicoes (entrada, saida por inatividade, saida definitiva, ligar/desligar coletivo) podem herdar o comportamento reduzido globalmente ao usar os tokens de duracao existentes (`--dur-fast`, `--dur-enter`). Nota/justificativa (nao prescreve mecanismo, apenas registra uma armadilha ja conhecida para o SPEC nao cair nela): a interpolacao de movimento nao e CSS puro, entao nao herda sozinha o zeramento global de `--dur-*` feito em `theme.css`; a implementacao precisa checar essa media query explicitamente no calculo de posicao, sem presumir que o CSS reduzido alcanca esse calculo sozinho.
- **RNF-09** [MUST] Toda string de UI nova (toggle, explicacao do P1, aviso do P3) deve estar em portugues (pt-BR), sem caracteres acentuados e sem travessao, seguindo a convencao do projeto.
- **RNF-10** [MUST] A suite de testes completa do projeto (typecheck, lint, `npx vitest run`, `npm run test:e2e`) deve continuar passando (verde) apos a implementacao desta feature.
- **RNF-11** [MUST] As duas sondas obrigatorias exigidas pela IDEA (T2: `setContentProtection` bloqueando a janela de overlay da propria captura, e o mapeamento entre a fonte escolhida no `desktopCapturer` e o monitor fisico correspondente em `screen.getAllDisplays()`) sao precondicao da implementacao. Se qualquer uma delas falhar, o pipeline desta feature para e volta para conversa com o usuario, em vez de seguir com um plano B improvisado nesta PRD ou no SPEC.

## 6. Criterios de Aceitacao

- **AC-01** (RF-01): Dado o modal de escolha da fonte antes de transmitir, quando ele e aberto, entao o toggle de ponteiros aparece desligado por padrao.
- **AC-02** (RF-04): Dado que a fonte escolhida no modal e uma JANELA, quando o toggle de ponteiros e observado, entao ele aparece desabilitado com uma explicacao visivel do motivo, nunca escondido.
- **AC-03** (RF-02): Dado uma transmissao ativa de um MONITOR com ponteiros desligados, quando o usuario liga o controle na barra de transmissao, entao os ponteiros passam a funcionar sem parar ou reiniciar a transmissao.
- **AC-04** (RF-03): Dado uma transmissao anterior com os ponteiros ligados, quando uma nova transmissao e iniciada (mesma sessao do app ou apos reiniciar), entao ela comeca com os ponteiros desligados.
- **AC-05** (RF-05): Dado o overlay de ponteiros ativo sobre a tela de quem transmite, quando o video efetivamente enviado aos espectadores e inspecionado, entao nenhum cursor desenhado pelo overlay aparece dentro desse video (o overlay fica comprovadamente fora da captura, apoiado na sonda de `setContentProtection` de RNF-11).
- **AC-06** (RF-06, RF-14): Dado Leo transmitindo com ponteiros ligados e Bruna, espectadora, movendo o mouse sobre um botao no player, quando a posicao chega, entao a tela real do Leo mostra um cursor na cor da Bruna com o nome dela sobre aquele botao, e a propria Bruna nao ve esse cursor na tela dela.
- **AC-07** (RF-14, RF-15): Dado Joao tambem assistindo a mesma transmissao que a Bruna, quando o cursor da Bruna aparece, entao Joao ve o cursor da Bruna sobre o video, mas nunca ve um cursor duplicado do proprio mouse dele.
- **AC-08** (RF-16): Dado Leo transmitindo (txId A) e Carla transmitindo (txId B) ao mesmo tempo, com Bruna assistindo A e apontando, quando alguem assistindo B observa a tela, entao essa pessoa nao ve nenhum cursor da Bruna.
- **AC-09** (RF-08): Dado quem transmite com dois monitores compartilhando apenas um deles, quando o overlay de ponteiros sobe, entao ele cobre somente o monitor compartilhado.
- **AC-10** (RF-09): Dado o overlay de ponteiros ativo sobre a tela de quem transmite, quando essa pessoa clica em qualquer ponto da propria tela, entao o clique chega normalmente ao aplicativo por baixo do overlay.
- **AC-11** (RF-07): Dado uma transmissao com os ponteiros desligados, quando o processo main e inspecionado, entao nenhuma janela de overlay existe criada/visivel para aquela transmissao; ela so sobe no momento em que a opcao e ligada.
- **AC-12** (RF-10): Dado uma transmissao com ponteiros ligados, quando ela e encerrada, entao a janela/camada de overlay desce imediatamente e nenhuma janela orfa permanece.
- **AC-13** (RF-11): Dado uma transmissao com ponteiros ligados onde a fonte e trocada no meio, quando a nova fonte comeca a ser compartilhada, entao nenhum cursor aparece na posicao da fonte antiga (overlay remapeado ou limpo).
- **AC-14** (RF-12): Dado um espectador assistindo a uma transmissao com ponteiros ligados, quando ele apenas move o mouse sobre o player grande sem clicar em nenhum controle de ativacao, entao seu cursor ja aparece para os demais.
- **AC-15** (RF-13): Dado um espectador movendo o mouse sobre a miniatura da grade ou sobre o card de status do transmissor, quando essa movimentacao acontece, entao nenhuma posicao de cursor e gerada ou atualizada por causa dela.
- **AC-16** (RF-17): Dado um espectador movendo o mouse para fora da area real do video (sobre a UI do app ou fora da janela), quando isso acontece, entao nenhum ponteiro seu permanece visivel na ultima posicao valida.
- **AC-17** (RF-18): Dado um espectador assistindo a transmissao A e apontando, quando ele troca para assistir a transmissao B, entao o cursor dele desaparece de A imediatamente e so passa a aparecer em B ao mover o mouse la.
- **AC-18** (RF-19): Dado o mesmo par de coordenadas normalizadas (ex.: 0.35 de largura, 0.60 de altura) enviado por um espectador, quando remapeado nas telas do transmissor e de outro espectador com proporcoes de janela diferentes, entao o ponto visual corresponde ao mesmo local logico do conteudo em ambos, descontando as bordas do letterbox.
- **AC-19** (RF-20): Dado um espectador assistindo com o ponteiro ativo, quando a janela do app dele perde o foco do sistema operacional ou e minimizada, entao o envio de posicoes daquele espectador pausa; quando a janela volta a ficar em primeiro plano, entao o envio retoma normalmente ao mouse se mover de novo sobre o player.
- **AC-20** (RF-21): Dado duas pessoas presentes na sala, quando suas cores sao calculadas a partir dos respectivos `peerId` em clientes diferentes (transmissor e qualquer espectador), entao cada cliente chega de forma independente na MESMA cor para a mesma pessoa (determinismo), e a cor resultante usa saturacao e luminosidade compativeis com o tema escuro + roxo `#9d00ff`, lendo como familia visual com o resto do app.
- **AC-21** (RF-22): Dado a bolinha de um participante na lista, quando a cor por pessoa e aplicada, entao ela deixa de usar `var(--accent-soft)` unico e passa a refletir a cor calculada daquela pessoa, igual a cor do cursor dela.
- **AC-22** (RF-23, RNF-05): Dado uma nova pessoa entrando na sala e o algoritmo escolhido pelo SPEC reindexando cores de bolinhas ja existentes, quando essa reindexacao acontece, entao a legibilidade da inicial e o layout do card permanecem intactos para todas as bolinhas afetadas.
- **AC-23** (RF-24): Dado um cursor visivel sobre o player, quando observado a qualquer momento enquanto visivel (parado ou em movimento, antes dos 5s de inatividade), entao o nome da pessoa continua visivel junto dele.
- **AC-24** (RF-25): Dado uma sequencia de posicoes recebidas para o mesmo espectador, quando o cursor e desenhado entre uma posicao e a proxima, entao ele desliza visivelmente por posicoes intermediarias em vez de saltar direto de um ponto ao outro.
- **AC-25** (RF-26): Dado um cursor parado por 5 segundos, quando o tempo se esgota, entao ele desaparece por completo (fade out); quando o mouse volta a se mover, entao ele reaparece (fade in).
- **AC-26** (RF-27, RF-28): Dado uma transmissao com ponteiros ligados e espectadores apontando, quando quem transmite desliga a opcao, entao todos os cursores somem para todos os espectadores daquela transmissao e cada espectador recebe exatamente UM aviso discreto, mesmo que o estado seja reafirmado depois por reconexao ou atualizacao de roster.
- **AC-27** (RF-29): Dado um espectador apontando que sai da sala ou perde a conexao, quando isso acontece, entao o cursor dele desaparece das telas dos demais imediatamente.
- **AC-28** (RF-30): Dado uma transmissao com ponteiros desligados, quando o trafego do canal de dados e observado, entao nenhuma mensagem de posicao de cursor daquela transmissao e enviada.
- **AC-29** (RF-31): Dado um jogo ou aplicativo em tela cheia exclusiva rodando na maquina de quem transmite, quando a feature esta em uso, entao o sistema nao tenta detectar essa condicao automaticamente; a limitacao fica apenas documentada nas notas da release.
- **AC-30** (RF-32, RNF-01): Dado uma sessao de apontar em andamento, quando a cadencia de envio de posicoes e medida, entao ela fica estritamente entre 20 e 30 envios por segundo por espectador, sem ultrapassar o teto, e sem regressao de fps observavel no stats-monitor existente.
- **AC-31** (RF-33): Dado esta feature implementada, quando revisada quanto a capacidades de input, entao nao existe nenhum mecanismo que permita a um espectador clicar ou digitar na maquina de quem transmite (ou vice-versa) atraves dela.
- **AC-32** (RNF-02): Dado o conjunto de testes e2e apos a implementacao, quando ele roda em rede saudavel, entao `expectNoDirectionFallbacks` continua passando.
- **AC-33** (RNF-03): Dado um cliente de versao antiga recebendo o novo tipo de mensagem de posicao de cursor, quando o comportamento e verificado, entao ele e documentado explicitamente nas notas da release (descarte do envelope, sem quebra de conexao).
- **AC-34** (RNF-04): Dado o card de status do transmissor, a exclusao de audio e o aviso de tela preta, quando exercitados apos a implementacao, entao continuam se comportando exatamente como antes desta feature.
- **AC-35** (RNF-05): Dado qualquer aplicacao de cor por pessoa (cursor ou lista de participantes) fora de um evento de reindexacao, quando observada, entao o contraste minimo de legibilidade e o layout existente permanecem intactos.
- **AC-36** (RNF-06): Dado o reducer de `room-state.ts` apos a adicao do carimbo de `txId` as posicoes de cursor, quando os testes unitarios de `transmissions` e `selfWatchingTxId` sao executados, entao continuam passando sem alteracao de comportamento desse estado.
- **AC-37** (RNF-07): Dado as animacoes de entrada, saida por inatividade, saida definitiva e transicao coletiva de ligar/desligar, quando inspecionadas, entao usam somente `transform`/`opacity`, nenhum loop continuo pesado foi introduzido, e nenhum custo de frame de video e observado.
- **AC-38** (RNF-08): Dado `prefers-reduced-motion: reduce` ativo no sistema, quando um cursor recebe uma nova posicao, entao ele salta direto para o novo ponto em vez de interpolar visualmente o deslocamento.
- **AC-39** (RNF-09, RNF-10): Dado todo texto de UI novo desta feature e o pipeline de testes completo do projeto, quando ambos sao conferidos apos a implementacao, entao o texto esta em pt-BR sem acento e sem travessao, e typecheck/lint/vitest/e2e passam integralmente.
- **AC-40** (RNF-11): Dado o inicio do trabalho tecnico desta feature, quando as duas sondas obrigatorias (`setContentProtection` e mapeamento fonte-monitor) sao executadas, entao a implementacao final so prossegue se ambas confirmarem o comportamento esperado; se qualquer uma falhar, o trabalho para e retorna para conversa com o usuario.
- **AC-41** (Metrica de sucesso, secao 1; RF-06; RF-14; RNF-02): Dado o app em uso real pelo grupo apos a implementacao, quando alguem aponta durante uma transmissao real, entao quem transmite localiza o ponto indicado em menos de 1 segundo e sem descricao por voz, ninguem relata ver o proprio cursor, e nenhuma regressao de fps ou fallback de direcao novo aparece nos logs.

---

## Questoes em Aberto

Nenhuma questao de produto em aberto. Todos os seis pontos originais da IDEA (P1 a P6) foram resolvidos na propria IDEA em 2026-08-26 e estao incorporados nos requisitos acima (RF-04, RF-26, RF-27/RF-28, RF-03, RF-31, e o escopo por `txId` em toda a secao 4).

Os itens abaixo sao tecnicos e ja estao deliberadamente delegados ao SPEC (Stage 3) pela propria IDEA (secao 12); nao sao tratados como questao em aberto desta PRD, apenas referenciados onde um requisito depende deles:

- **T1**: o algoritmo exato da cor deterministica por pessoa (RF-21), equilibrando matizes bem separados contra estabilidade quando alguem entra na sala (tensao explicitamente registrada em RF-21, nao resolvida por esta PRD).
- **T2**: a execucao das duas sondas obrigatorias (RNF-11) - `setContentProtection` e o mapeamento `display_id` -> `screen.getAllDisplays()`.
- **T3**: a rota exata das posicoes na malha (unicast em loop vs. fan-out seletivo novo) e o formato/frequencia da mensagem no canal de dados (RF-32, RNF-03).
- **T4**: o utilitario de calculo da area real do video dentro do elemento (RF-19), e se ele e compartilhado entre `PlayerView.tsx` e o overlay do transmissor ou calculado dos dois lados.
- **T5**: como o e2e alcanca uma segunda janela (`app.windows()`) para testar o overlay do transmissor, ja que o helper `tests/e2e/helpers/zoi-app.ts` so usa `app.firstWindow()` hoje.

Nenhum `[ASSUMPTION]` foi necessario nesta PRD: a IDEA, ja na sua versao finalizada de 2026-08-26, cobre objetivo, escopo, papeis, ciclo de vida, regras de negocio, casos de borda, UI e prioridades com decisoes explicitas o suficiente para derivar os requisitos acima sem preencher lacunas de produto.
