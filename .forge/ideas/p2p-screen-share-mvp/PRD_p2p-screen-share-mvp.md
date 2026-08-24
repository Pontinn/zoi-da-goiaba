---
feature: p2p-screen-share-mvp
language: pt-BR
created: 2026-08-24
---

# PRD - p2p-screen-share-mvp

## Historico de Revisoes

| Data | Revisao | O que mudou |
|------|---------|--------------|
| 2026-08-24 | 1 | Criacao da PRD a partir da IDEA e do CONTEXT da Stage 1. |
| 2026-08-24 | 2 | Incorporadas as respostas do usuario as 4 perguntas em aberto da revisao 1: adaptacao nativa de qualidade via WebRTC (novo RF-47), threshold de reconexao de 15s e desconexao definitiva (RF-40 atualizado), regras de validacao do codigo personalizado de sala (novo RF-46), e metrica de sucesso ampliada para cobrir todo o conjunto de funcionalidades do MVP (removido o marcador [ASSUMPTION]). |
| 2026-08-24 | 3 | Aplicados os apontamentos do reviewer (NEEDS-CHANGES, sem bloqueadores) e um novo requisito do usuario: nova RNF de identidade visual (tema escuro + roxo #9d00ff, IDEA secao 9); RNF-02 de empacotamento atualizada para exigir INSTALADOR Windows (nao `.exe` avulso), com AC de instalacao dedicada; correcao do typo "baina" para "bana" em RF-34; novas ACs para RF-21, RF-24 e RF-29; novo RF-48 detalhando o comportamento do lado do espectador durante a janela de reconexao de 15s (ultimo quadro + overlay "reconectando...", com remocao da transmissao se o prazo expirar); Baseline reancorada com os fingerprints atuais de IDEA e CONTEXT (ambos editados desde a revisao 2: trava de decisoes registrada, limpeza do limite de participantes na secao 7, decisao do instalador). |
| 2026-08-24 | 4 | Nome do produto escolhido pelo usuario incorporado na PRD: **Zói da Goiaba** (nome de exibicao, com acento) na secao 1 (Objetivo e Visao); forma sem acento usada nos nomes tecnicos: instalador `ZoiDaGoiaba-Setup.exe` (RNF-02, AC-31) e prefixo interno do codigo de sala `zoidagoiaba:` (RF-03). |

## Baseline (ancora de drift)

- **HEAD**: repo iniciado, sem commits (a pasta do projeto nao possui diretorio `.git` no momento da criacao desta PRD; repo sera iniciado na Stage 2).
- **Fingerprint IDEA_p2p-screen-share-mvp.md** (SHA-256, reancorado na revisao 3): `31BBEB9546D0C68BDF48F445735BB07D81F363C85A92490401BA8747D6E2F4DD`
- **Fingerprint CONTEXT_p2p-screen-share-mvp.md** (SHA-256, reancorado na revisao 3): `09E9A2654E769D3549EE95673622C413959C4341D582050FD3EF086A225D25DA`

---

## 1. Objetivo e Visao

**Problema**: um grupo fechado de 5-6 amigos, todos em Windows, quer compartilhar a tela um com o outro (jogos, e principalmente assistir filme juntos com uma pessoa exibindo a tela e som) sem depender de um servidor de midia proprio/hospedado e sem que mais de uma pessoa precise ficar sem poder transmitir ao mesmo tempo. O app que atende essa necessidade se chama **Zói da Goiaba** (nome escolhido pelo usuario).

**Para quem**: o proprio grupo de amigos do usuario (uso privado, nao e produto para terceiros).

**Por que agora**: nao existe hoje, para esse grupo, uma ferramenta P2P leve, sem custo de servidor de midia, com controle de dono/moderacao e identidade visual propria, que cubra o caso "assistir filme juntos com som" e "compartilhar jogo" no mesmo app.

**Impacto esperado**: o grupo passa a conseguir fazer sessoes de tela compartilhada (filme ou jogo) direto entre os proprios PCs, com qualidade no minimo equivalente ao Discord (podendo chegar a 1080p/60fps quando o upload de quem transmite permitir), sem depender de infraestrutura paga ou de terceiros para a midia.

**Metrica de sucesso** (confirmada pelo usuario na revisao 2: "quero que tenha tudo no mvp ja"): o grupo completo (5 a 6 pessoas, todas em Windows) consegue completar uma sessao real de grupo exercitando, de ponta a ponta e sem erro bloqueante nao tratado, o conjunto COMPLETO de funcionalidades do MVP: criacao da sala, entrada por codigo, multiplas transmissoes simultaneas, visualizacao em fullscreen, controle de volume local, picture-in-picture, moderacao do dono (desconectar/banir), sons customizados do app, indicadores (voce-esta-transmitindo, quem-assiste-o-que, qualidade de conexao) e reconexao automatica.

## 2. Publico-Alvo (Personas)

- **Dono da sala** (quem cria a sessao): amigo do grupo que abre o app, cria a sala definindo codigo e limite de participantes, e modera o grupo (desconectar/banir); usuario casual, sem conhecimento tecnico, so precisa rodar o `.exe`.
- **Participante/Espectador** (quem entra na sala): amigo convidado que entra com o codigo recebido fora do app (WhatsApp/Discord), assiste as transmissoes disponiveis, controla seu proprio volume, edita seu proprio nickname e pode, a qualquer momento, tambem compartilhar sua propria tela; usuario casual, sem conhecimento tecnico.

Nao ha papel de "transmissor" separado: qualquer participante (incluindo o dono) pode transmitir a propria tela a qualquer momento, respeitando o limite de uma fonte por vez por pessoa.

## 3. Escopo

**Dentro do escopo (MVP):**
- Sala unica com codigo aleatorio ou personalizado; limite de participantes configuravel pelo dono (2 a 8, padrao 6); botao de copiar codigo.
- Nickname definido na primeira abertura do app, persistido localmente e editavel depois nas configuracoes.
- Compartilhar tela (monitor especifico ou janela/aplicativo) com audio do sistema opcional (toggle, ligado por padrao) e escolha de preset de qualidade (720p/30fps, 1080p/30fps, 1080p/60fps).
- Multiplas transmissoes simultaneas de participantes diferentes; seletor com miniaturas ao vivo de cada stream para o espectador escolher o que assistir.
- Fullscreen real (sem bordas do app) com controles de auto-hide; controle de volume local por espectador (slider + mute).
- Dono da sala com poderes de desconectar (participante pode reentrar) e banir (bloqueado ate a sala morrer); transferencia automatica de dono para o participante mais antigo quando o dono sai.
- Indicador persistente de "voce esta transmitindo".
- Indicador de "quem esta assistindo o que".
- Indicador de qualidade de conexao por participante (estilo barras de sinal, baseado em ping/bitrate).
- Avisos sonoros/visuais (sons proprios do usuario) para: entrou, saiu, comecou a transmitir, parou de transmitir, foi desconectado/banido, erro de conexao, reconectado.
- Reconexao automatica em queda breve de conexao.
- Janela flutuante picture-in-picture (always-on-top) para assistir enquanto usa outros programas.
- Auto-update do app (avisa/baixa quando ha nova versao do `.exe`).
- Caso de uso "filme": um participante transmite tela + audio do sistema, os demais assistem com som.

**Restricao de sequenciamento (confirmada pelo usuario)**: a implementacao (Stage 4) so pode comecar depois que os 7 arquivos de audio (`entrou`, `saiu`, `transmitindo`, `parou-transmissao`, `desconectado`, `erro-conexao`, `reconectado`) estiverem presentes na pasta `audios/` na raiz do projeto. O planejamento (esta PRD e a SPEC seguinte) pode avancar normalmente.

**Fora do escopo / NAO fazer:**
- Chat de voz por microfone (o grupo ja usa outro canal, ex.: Discord, para conversar).
- Chat de texto dentro do app.
- Servidor de midia proprio (SFU) ou suporte a mais de 6-8 pessoas por sala.
- Assistir 2 streams simultaneamente em janelas separadas (descartado explicitamente pelo usuario: "acho que nao precisa").
- Fallback TURN/relay para NAT simetrico/CGNAT (MVP se limita a mensagem de erro clara quando a conexao P2P direta falha).
- Contas de usuario, login/cadastro ou qualquer persistencia de estado em servidor (identidade = nickname local; acesso = codigo da sala).
- Edicao da sala (codigo, limite) apos criada.

## 4. Requisitos Funcionais

**Sala**

- **RF-01** [MUST] O usuario deve poder criar uma sala escolhendo entre gerar um codigo aleatorio (ex.: "filme-4X9K") ou definir um codigo personalizado (ex.: "sala-do-pontin").
- **RF-02** [MUST] Ao criar a sala, o dono deve definir o limite de participantes dentro da faixa de 2 a 8, com valor padrao 6 quando nao alterado.
- **RF-03** [MUST] O sistema deve prefixar o codigo digitado/gerado com o identificador interno do app ("zoidagoiaba:") no PeerJS, evitando colisao com outros aplicativos que usem o mesmo servidor publico de sinalizacao.
- **RF-04** [MUST] Se o codigo gerado ou digitado ja estiver em uso por outra sala ativa, o sistema deve exibir a mensagem "codigo ja em uso" e impedir a criacao/entrada.
- **RF-05** [MUST] O sistema deve fornecer um botao para copiar o codigo da sala para a area de transferencia, para o dono compartilhar fora do app.
- **RF-06** [MUST] Um participante deve poder entrar em uma sala existente informando o codigo da sala.
- **RF-07** [MUST] Se a sala ja tiver atingido o limite de participantes definido pelo dono, o sistema deve recusar a entrada de um novo participante e exibir a mensagem "sala cheia".
- **RF-08** [MUST] Se o usuario estiver na lista de banidos da sala, o sistema deve recusar sua entrada enquanto a sala existir.
- **RF-09** [MUST] A sala deve deixar de existir automaticamente quando o ultimo participante sair; o codigo volta a ficar disponivel para reuso e a lista de banidos daquela sala e zerada.
- **RF-10** [MUST] Nao deve existir funcionalidade de editar os dados da sala (codigo, limite de participantes) apos ela ter sido criada, no MVP.

**Participante e nickname**

- **RF-11** [MUST] Na primeira execucao do app, o sistema deve exibir uma tela pedindo o nickname do usuario antes de permitir criar ou entrar em uma sala.
- **RF-12** [MUST] O nickname definido deve ser persistido localmente no dispositivo do usuario.
- **RF-13** [MUST] O usuario deve poder editar seu nickname posteriormente em uma tela de configuracoes; o campo de edicao deve carregar o nickname atualmente salvo (round-trip).
- **RF-14** [MUST] O nickname deve identificar o participante para os demais membros da sala (lista de participantes, indicadores de quem transmite/assiste).

**Transmissao**

- **RF-15** [MUST] Um participante deve poder iniciar o compartilhamento de tela escolhendo entre: (a) um monitor inteiro, com selecao de qual monitor caso haja mais de um, ou (b) uma janela/aplicativo especifico.
- **RF-16** [MUST] Ao iniciar uma transmissao, o participante deve poder escolher um preset de qualidade entre: 720p/30fps, 1080p/30fps ou 1080p/60fps.
- **RF-17** [MUST] Ao iniciar uma transmissao, o participante deve poder ativar/desativar o envio de audio do sistema por meio de um toggle "transmitir audio do sistema", ligado por padrao.
- **RF-18** [MUST] Cada participante deve poder transmitir no maximo uma fonte por vez.
- **RF-19** [MUST] Para trocar de fonte durante uma transmissao ativa, o sistema deve parar a transmissao atual e iniciar a nova (via acao explicita "trocar fonte" ou via parar e compartilhar novamente).
- **RF-20** [MUST] Uma transmissao deve terminar quando o participante para manualmente, troca de fonte, ou sai da sala.
- **RF-21** [MUST] O sistema deve exibir um indicador persistente e visivel para quem esta transmitindo, mostrando que ele esta no ar.
- **RF-22** [MUST] Mais de um participante deve poder transmitir simultaneamente na mesma sala.
- **RF-23** [MUST] Cada espectador deve poder escolher, entre as transmissoes ativas no momento, qual assistir, por meio de um seletor com miniaturas ao vivo (thumbnails) de cada stream.
- **RF-24** [MUST] Todos os espectadores de uma mesma transmissao devem recebe-la na mesma qualidade escolhida por quem transmite (nao ha ajuste de qualidade por espectador no MVP).

**Visualizacao**

- **RF-25** [MUST] O usuario deve poder alternar para tela cheia (fullscreen) real ao assistir uma transmissao, cobrindo completamente a tela sem bordas/barras do app.
- **RF-26** [MUST] Em fullscreen, os controles (botao de sair/minimizar) devem desaparecer automaticamente apos aproximadamente 3 segundos sem atividade de mouse/teclado, e reaparecer assim que houver atividade.
- **RF-27** [MUST] A tecla Esc deve sair do modo fullscreen.
- **RF-28** [MUST] O usuario deve poder controlar o volume (slider) e mutar/desmutar o audio de uma transmissao que esta assistindo, de forma local: a mudanca nao afeta o que outros espectadores ouvem.
- **RF-29** [MUST] O controle de volume deve ficar visivel junto com os demais controles de fullscreen, seguindo a mesma regra de auto-hide.
- **RF-30** [MUST] O usuario deve poder assistir uma transmissao em uma janela flutuante (picture-in-picture) que permanece sempre no topo (always-on-top) enquanto ele usa outros programas.

**Moderacao e papeis**

- **RF-31** [MUST] O dono da sala deve poder desconectar qualquer outro participante, derrubando-o imediatamente da sala.
- **RF-32** [MUST] Um participante desconectado pelo dono deve poder entrar novamente na sala usando o codigo.
- **RF-33** [MUST] O dono da sala deve poder banir qualquer outro participante, derrubando-o e impedindo que ele reentre enquanto a sala existir.
- **RF-34** [MUST] O sistema NAO deve permitir que um participante que nao seja o dono desconecte ou bana outro participante; essa acao deve estar disponivel apenas para o dono.
- **RF-35** [MUST] Se o dono sair da sala voluntariamente, o papel de dono deve ser transferido automaticamente para o participante mais antigo ainda presente na sala.
- **RF-36** [MUST] A lista de banidos da sala deve ser preservada e herdada pelo novo dono apos a transferencia de posse.

**Indicadores e notificacoes**

- **RF-37** [MUST] O sistema deve exibir um indicador de "quem esta assistindo o que" (qual espectador esta assistindo qual transmissao).
- **RF-38** [MUST] O sistema deve exibir um indicador de qualidade de conexao por participante (ex.: barras de sinal), refletindo ping/bitrate.
- **RF-39** [MUST] O sistema deve tocar um aviso sonoro e/ou visual para cada um dos eventos: participante entrou, participante saiu, participante comecou a transmitir, participante parou de transmitir, participante foi desconectado/banido, erro de conexao, participante reconectado.

**Reconexao e falhas**

- **RF-40** [MUST] Em caso de queda de conexao de um participante, o sistema deve tentar reconectar automaticamente por ate 15 segundos, sem exigir acao manual do usuario; se a reconexao nao for concluida dentro desse prazo, o participante deve ser tratado como definitivamente desconectado: removido da lista de participantes da sala, com o som de "saiu" reproduzido para os demais.
- **RF-41** [MUST] Se a conexao P2P direta entre dois participantes nao puder ser estabelecida (ex.: NAT simetrico/CGNAT), o sistema deve exibir uma mensagem de erro clara identificando quem nao conseguiu se conectar.
- **RF-42** [WON'T] O sistema nao implementa fallback TURN/relay para contornar falhas de NAT simetrico no MVP; a conexao falha com mensagem de erro clara, sem tentativa de relay.

**Aplicativo**

- **RF-43** [MUST] O sistema deve verificar se ha uma nova versao instalavel disponivel e avisar/permitir baixar e aplicar a atualizacao (auto-update), usando o instalador como base do mecanismo (ver RNF-02).
- **RF-44** [WON'T] O sistema nao permite que um espectador assista duas transmissoes simultaneamente em janelas separadas no MVP.
- **RF-45** [WON'T] O MVP nao inclui chat de texto nem chat de voz por microfone dentro do app.

**Complementos (Revisao 2, respostas as perguntas em aberto)**

- **RF-46** [MUST] (complementa RF-01/RF-04, Sala) O codigo personalizado de sala deve ter entre 3 e 32 caracteres, usando apenas letras, digitos e hifen; a verificacao de disponibilidade e de banimento deve ser case-insensitive (ex.: "SALA-do-Pontin" e "sala-do-pontin" sao tratados como o mesmo codigo). Um codigo fora dessas regras deve ser rejeitado na propria tela de criacao, sem chegar a checar disponibilidade.
- **RF-47** [MUST] (complementa RF-16/RF-38, Transmissao) Quando a rede nao sustentar o preset de qualidade escolhido por quem transmite, o sistema deve depender exclusivamente da adaptacao automatica nativa do WebRTC (reducao de bitrate/framerate feita pela propria engine), sem logica adicional de aviso e sem forcar troca de preset; a degradacao deve ficar visivel para os demais participantes atraves do indicador de qualidade de conexao (RF-38).

**Complementos (Revisao 3, apontamentos do reviewer)**

- **RF-48** [MUST] (complementa RF-40, Visualizacao/Reconexao) Enquanto a reconexao automatica de um participante que estava transmitindo estiver em andamento (dentro da janela de 15 segundos definida em RF-40), os espectadores daquela transmissao devem continuar vendo o ultimo quadro recebido, com um indicador/overlay "reconectando..." sobreposto. Se os 15 segundos expirarem sem sucesso, a transmissao deve ser removida da lista de streams ativos e o fluxo de desconexao definitiva (RF-40) se aplica.

### Matriz de permissoes (Dono x Participante)

| Acao | Dono | Participante |
|------|------|--------------|
| Criar sala (definir codigo e limite) | Sim | N/A (quem cria vira dono) |
| Entrar/sair da sala | Sim | Sim |
| Compartilhar a propria tela (1 fonte, audio on/off, preset) | Sim | Sim |
| Assistir qualquer transmissao ativa | Sim | Sim |
| Controlar o proprio volume | Sim | Sim |
| Editar o proprio nickname | Sim | Sim |
| Desconectar outro participante | Sim | **Nao** |
| Banir outro participante | Sim | **Nao** |
| Alterar o limite de participantes apos a criacao | **Nao** (nao ha edicao de sala no MVP) | Nao |

## 5. Requisitos Nao-Funcionais

- **RNF-01** [MUST] O MVP roda apenas em Windows (10/11); nenhuma outra plataforma e suportada.
- **RNF-02** [MUST] O app (**Zói da Goiaba**) deve ser distribuido como um INSTALADOR Windows chamado `ZoiDaGoiaba-Setup.exe` (Electron, wizard next-next-finish), criando atalhos no menu iniciar e na area de trabalho ao final da instalacao; nao deve ser distribuido como um `.exe` avulso/portatil. O instalador nao deve exigir que o usuario final tenha Node.js ou terminal instalado, e e a base do mecanismo de auto-update (RF-43).
- **RNF-03** [MUST] Nao deve existir servidor de midia proprio (SFU): toda transmissao de video/audio deve ser P2P direta entre os clientes (topologia mesh); apenas a sinalizacao passa pelo servidor publico do PeerJS.
- **RNF-04** [MUST] Nao deve existir estado persistente em servidor: o estado da sala (lista de participantes, dono atual, lista de banidos, limite) vive somente nos clientes conectados (via DataChannel) e e perdido quando a sala morre.
- **RNF-05** [MUST] A qualidade minima aceitavel de transmissao e equivalente a "qualidade estilo Discord" (piso); como e P2P sem limite artificial de servidor, a qualidade pode chegar a 1080p/60fps quando o upload de quem transmite suportar.
- **RNF-06** [MUST] Estimativa de banda de upload de quem transmite (calculada como N copias, uma por espectador): exemplo confirmado de 4 espectadores a 1080p (~3-4 Mbps por copia) resulta em ~12-16 Mbps de upload total (aproximadamente metade disso em 720p); em uma sala de 8 pessoas (7 espectadores) em 1080p, o upload estimado e de ~21-28 Mbps. O app deve deixar claro que salas maiores exigem upload maior ou um preset de qualidade menor.
- **RNF-07** [MUST] O auto-hide dos controles de fullscreen deve ocorrer apos aproximadamente 3 segundos de inatividade de mouse/teclado.
- **RNF-08** [MUST] Nao ha sistema de login/cadastro; a identidade do usuario e o nickname local e o acesso a sala se da exclusivamente pelo codigo da sala (que funciona como senha implicita).
- **RNF-09** [MUST] Os sons de notificacao devem ser arquivos de audio (mp3/wav/ogg) embutidos no pacote do app (pasta `audios/`), sem dependencia de download externo em tempo de execucao.
- **RNF-10** [MUST] Limitacao conhecida e aceita (loopback de audio do Windows): o audio do sistema capturado e sempre do sistema inteiro, mesmo quando o participante esta compartilhando apenas uma janela/aplicativo especifico; o MVP nao isola audio por aplicativo.
- **RNF-11** [MUST] (confirmado na revisao 2) O app nao implementa logica propria de controle/adaptacao de bitrate; a degradacao de qualidade sob rede ruim e delegada inteiramente ao mecanismo nativo de adaptacao do WebRTC (ver RF-47). O tempo maximo de tentativa de reconexao automatica apos queda de conexao e de 15 segundos (ver RF-40).
- **RNF-12** [MUST] (identidade visual, IDEA secao 9) A interface deve seguir tema escuro (fundos em cinza-escuro/quase preto) com roxo `#9d00ff` como cor de destaque em botoes, indicadores e bordas ativas, usando variacoes mais claras/escuras do proprio roxo para os estados hover, pressed e active.

## 6. Criterios de Aceitacao

- **AC-01** (RF-01, RF-05): Dado que o usuario esta na tela de criar sala, quando ele escolhe "gerar codigo aleatorio", entao um codigo no formato tipo "filme-4X9K" e exibido, com um botao de copiar funcional.
- **AC-02** (RF-01): Dado que o usuario esta na tela de criar sala, quando ele digita um codigo personalizado (ex.: "sala-do-pontin") e confirma, entao a sala e criada com esse codigo.
- **AC-03** (RF-02): Dado que o dono esta criando a sala, quando ele tenta definir um limite de participantes fora da faixa 2-8, entao o sistema impede o valor invalido e mantem o padrao (6) caso nada seja escolhido.
- **AC-04** (RF-03, RF-04): Dado um codigo ja em uso por outra sala ativa, quando um usuario tenta criar ou entrar com o mesmo codigo, entao o sistema exibe "codigo ja em uso" e a acao e bloqueada.
- **AC-05** (RF-06, RF-07): Dado uma sala com o limite de participantes ja atingido, quando um novo usuario tenta entrar com o codigo correto, entao o sistema recusa a entrada e exibe "sala cheia".
- **AC-06** (RF-08, RF-33): Dado um participante banido de uma sala, quando ele tenta reentrar com o codigo enquanto a sala ainda existe, entao o sistema recusa a entrada.
- **AC-07** (RF-09): Dado uma sala com um unico participante restante, quando esse participante sai, entao a sala deixa de existir: um novo usuario consegue criar uma sala com o mesmo codigo depois, e um usuario anteriormente banido consegue entrar em uma nova sala criada com esse codigo (lista de banidos zerada).
- **AC-08** (RF-11, RF-12, RF-13) [round-trip]: Dado que e a primeira execucao do app, quando o usuario informa um nickname, entao ele e salvo localmente; ao abrir a tela de configuracoes depois, o campo de nickname aparece pre-preenchido com esse mesmo valor.
- **AC-09** (RF-13) [round-trip]: Dado um nickname ja definido, quando o usuario o edita na tela de configuracoes e salva, entao o novo nickname passa a ser exibido para os demais participantes nas proximas interacoes na sala.
- **AC-10** (RF-10): Dado uma sala ja criada, quando qualquer participante procura uma opcao de editar a sala (codigo ou limite), entao nenhuma opcao desse tipo existe na UI do MVP.
- **AC-11** (RF-15, RF-16, RF-17): Dado um participante na sala, quando ele clica em "compartilhar tela", escolhe uma janela especifica, o preset 1080p/30fps e deixa o toggle de audio ligado, entao a transmissao inicia enviando video daquela janela com audio do sistema, visivel para os demais participantes.
- **AC-12** (RF-18, RF-19): Dado um participante ja transmitindo uma fonte, quando ele aciona "trocar fonte" e escolhe uma nova janela, entao a transmissao anterior e encerrada e uma nova comeca com a fonte escolhida, sem que duas fontes fiquem ativas ao mesmo tempo para ele.
- **AC-13** (RF-22, RF-23): Dado dois participantes transmitindo simultaneamente, quando um terceiro participante abre o seletor de streams, entao ele ve miniaturas ao vivo de ambas as transmissoes e pode escolher assistir qualquer uma delas, independentemente do que outro espectador esta assistindo.
- **AC-14** (RF-25, RF-26, RF-27): Dado um espectador assistindo uma transmissao, quando ele ativa fullscreen, entao o video cobre 100% da tela sem elementos do app visiveis; apos ~3s sem atividade de mouse/teclado os controles somem; ao mexer, reaparecem; ao pressionar Esc, o app sai do fullscreen.
- **AC-15** (RF-28): Dado um espectador assistindo uma transmissao com outros espectadores presentes, quando ele ajusta seu proprio volume ou muta, entao apenas o audio que ele ouve muda; os demais espectadores nao sao afetados.
- **AC-16** (RF-30): Dado um espectador assistindo uma transmissao, quando ele ativa o modo picture-in-picture, entao uma janela flutuante permanece visivel acima de outros programas enquanto ele usa o PC normalmente.
- **AC-17** (RF-31, RF-32): Dado o dono de uma sala, quando ele desconecta um participante, entao esse participante e removido imediatamente da sala e consegue entrar novamente usando o codigo.
- **AC-18** (RF-33): Dado o dono de uma sala, quando ele bane um participante, entao esse participante e removido e uma nova tentativa de entrada com o mesmo codigo e recusada enquanto a sala existir.
- **AC-19** (RF-34): Dado um participante que nao e dono, quando a sala e inspecionada, entao nenhuma acao de desconectar/banir esta disponivel para ele sobre os demais participantes.
- **AC-20** (RF-35, RF-36): Dado o dono saindo voluntariamente de uma sala com outros participantes presentes, quando a saida ocorre, entao o participante mais antigo remanescente assume como novo dono, e um usuario previamente banido continua impedido de entrar (lista de banidos preservada).
- **AC-21** (RF-37): Dado dois espectadores assistindo transmissoes diferentes, quando qualquer participante consulta a lista de participantes, entao e possivel ver quem esta assistindo qual transmissao.
- **AC-22** (RF-38): Dado participantes conectados na sala, quando a conexao de um deles piora (latencia/perda alta), entao o indicador de qualidade daquele participante muda de forma visivel.
- **AC-23** (RF-39): Dado um participante entrando na sala, quando a entrada e concluida, entao os demais participantes ouvem o som "entrou" (e de forma analoga para saiu, transmitindo, parou-transmissao, desconectado/banido, erro-conexao e reconectado, cada um no respectivo evento).
- **AC-24** (RF-40): Dado um participante que perde a conexao e a rede volta em menos de 15 segundos, quando a reconexao automatica e concluida dentro desse prazo, entao o app reconecta sem que o usuario precise sair e entrar manualmente na sala, e o participante nao sai da lista de participantes dos demais.
- **AC-25** (RF-41, RF-42): Dado dois participantes atras de NAT simetrico/CGNAT que impede a conexao direta, quando o app tenta estabelecer a conexao P2P entre eles, entao uma mensagem de erro clara identifica quem nao conseguiu conectar, sem nenhuma tentativa de fallback TURN.
- **AC-26** (RF-43): Dado uma nova versao do `.exe` publicada, quando o app verifica atualizacoes, entao o usuario e avisado e consegue baixar a nova versao.
- **AC-27** (RF-40): Dado um participante que perde a conexao e a reconexao automatica NAO se completa dentro de 15 segundos, quando o prazo expira, entao o participante e removido da lista de participantes dos demais e o som "saiu" e reproduzido para eles.
- **AC-28** (RF-46): Dado um usuario tentando criar uma sala com codigo personalizado, quando ele digita um codigo com menos de 3 caracteres, mais de 32 caracteres, ou contendo caracteres alem de letras/digitos/hifen, entao o sistema rejeita o codigo com uma mensagem de validacao, sem chegar a criar a sala.
- **AC-29** (RF-46): Dado uma sala ja criada com o codigo "sala-do-pontin", quando outro usuario tenta criar ou entrar usando "SALA-do-Pontin", entao o sistema trata os dois codigos como identicos (case-insensitive), aplicando "codigo ja em uso" na criacao ou permitindo a entrada normal na sala existente.
- **AC-30** (RF-47, RF-38): Dado um participante transmitindo no preset 1080p/60fps cujo upload piora durante a transmissao, quando a rede deixa de sustentar esse preset, entao o video degrada automaticamente (bitrate/framerate menores) via adaptacao nativa do WebRTC, sem qualquer aviso ou bloqueio adicional do app, e o indicador de qualidade de conexao (RF-38) reflete a piora para os demais participantes.
- **AC-31** (RNF-02, RF-43): Dado o instalador `ZoiDaGoiaba-Setup.exe`, quando o usuario o executa e segue o wizard (next-next-finish), entao o Zói da Goiaba e instalado no PC com atalhos criados no menu iniciar e na area de trabalho, sem que o usuario precise instalar Node.js ou usar terminal; nenhuma versao `.exe` avulsa/portatil e oferecida como entrega final.
- **AC-32** (RF-21): Dado um participante que inicia uma transmissao, quando a transmissao esta ativa, entao um indicador persistente e visivel confirma para ele que esta transmitindo, permanecendo visivel enquanto a transmissao durar e desaparecendo quando ela termina.
- **AC-33** (RF-24): Dado um participante transmitindo no preset 1080p/60fps para dois espectadores diferentes assistindo ao mesmo tempo, quando ambos recebem a transmissao, entao os dois recebem exatamente a mesma qualidade (nenhum espectador recebe um preset diferente do outro).
- **AC-34** (RF-29, RF-26): Dado um espectador em fullscreen assistindo uma transmissao, quando os controles de fullscreen somem por inatividade (RF-26), entao o controle de volume (slider + mute) some junto com eles; ao detectar atividade de mouse/teclado, o controle de volume reaparece junto com os demais controles.
- **AC-35** (RF-48): Dado um espectador assistindo a transmissao de um participante cuja conexao caiu, quando a reconexao automatica esta em andamento (dentro dos 15 segundos de RF-40), entao o espectador continua vendo o ultimo quadro recebido com um indicador "reconectando..." sobreposto; se os 15 segundos expirarem sem reconexao, a transmissao desaparece da lista de streams ativos e o participante e tratado como definitivamente desconectado (AC-27).

---

## Pontos em Aberto

Todas as 4 perguntas da revisao 1 foram respondidas pelo usuario e incorporadas nesta revisao (2). Nenhum ponto permanece em aberto no momento.

1. ~~Upload insuficiente de quem transmite~~ - **Resolvido**: o app depende exclusivamente da adaptacao automatica nativa do WebRTC (bitrate/framerate degradam sozinhos quando a rede nao aguenta); sem aviso extra, sem forcar troca de preset; a degradacao aparece no indicador de qualidade de conexao. Ver RF-47 e RNF-11.

2. ~~Threshold de "queda breve" de conexao~~ - **Resolvido**: o app tenta reconectar automaticamente por ate 15 segundos; passado esse prazo, o participante e tratado como definitivamente desconectado (removido da lista, som "saiu"). Ver RF-40 e RNF-11.

3. ~~Regras de validacao do codigo personalizado de sala~~ - **Resolvido**: 3 a 32 caracteres, apenas letras, digitos e hifen, verificacao case-insensitive. Ver RF-46.

4. ~~Confirmacao da metrica de sucesso~~ - **Resolvido**: o usuario confirmou que quer o conjunto COMPLETO do MVP coberto pela metrica de sucesso (nao so o caso filme); marcador `[ASSUMPTION]` removido da secao 1.
