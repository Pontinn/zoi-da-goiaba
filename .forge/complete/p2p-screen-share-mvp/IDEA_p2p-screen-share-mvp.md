---
feature: p2p-screen-share-mvp
language: pt-BR
type: create
status: in-progress
created: 2026-08-24
---

# IDEA - p2p-screen-share-mvp

## 1. Objetivo

App de compartilhamento de tela pra um grupo de ate 5 amigos, rodando localmente no PC de cada um, conectando-se diretamente (P2P) **sem VPS de midia**. Nas palavras do usuario: "transmitir a tela um pro outro", com a possibilidade de "mais de uma pessoa conseguir transmitir a tela ao mesmo tempo" e cada um "escolher entre ver uma e outra". Caso de uso destacado: "todos nos vermos um filme juntos com uma pessoa mostrando o filme na tela, nesse caso precisaria de som tbm".

## 2. Decisoes (lista viva)

- **AUTONOMIA TOTAL (2026-08-24)**: o usuario aprovou o PRD e autorizou execucao 100% autonoma ate o fim do pipeline (SPEC, implementacao, testes) sem gates intermediarios. Nas palavras dele: "pode seguir 100% autonomo ate o fim". EXCECOES que continuam valendo: nunca push/merge sem pedido explicito; testes manuais que so o usuario pode fazer.
- **PILARES DE PRIORIDADE (2026-08-24)**: (1) PERFORMANCE do app e (2) QUALIDADE da tela compartilhada sao as prioridades maximas em qualquer trade-off tecnico. Isso NAO autoriza um app feio ou ruim: "tem que ser bom e bonito, visual moderno, animacoes e tudo mais". Animacoes devem ser GPU-friendly (transform/opacity) pra nao competir com o pipeline de video.

- **Nome do app: ZOI DA GOIABA** (decidido em 2026-08-24; usuario queria nome engracado, gostou de "Zoiao" e cravou a variante "quero que seja 'zoi da goiaba'"). Exibicao na interface: **"Zói da Goiaba"** (com acento). Formas tecnicas sem acento: instalador `ZoiDaGoiaba-Setup.exe`, prefixo interno de sala `zoidagoiaba:`.

- **Tecnologia de transmissao**: WebRTC em topologia mesh (malha), cada participante conecta P2P com cada um dos outros. Sem servidor de midia (sem SFU/VPS).
- **Escala**: grupo fixo de amigos (~5-6 pessoas). Uso exclusivamente privado/entre amigos - nao e produto pra terceiros.
- **Limite de participantes configuravel pelo dono**: ao criar a sala, o dono define o limite (faixa 2 a 8, padrao 6). Quem tentar entrar com a sala cheia recebe "sala cheia". Nota tecnica: em 8 pessoas, quem transmite envia 7 copias (~21-28 Mbps de upload em 1080p) - o app deixa claro que salas grandes pedem upload forte ou preset menor.
- **Uma fonte por pessoa**: cada participante transmite no maximo UMA fonte por vez. Trocar de tela/janela = parar e compartilhar de novo (ou botao "trocar fonte" que faz isso por baixo).
- **Ciclo de vida da sala**: a sala existe enquanto tiver pelo menos 1 participante. Quando o ultimo sai, a sala morre: o codigo libera e a lista de banidos zera. Nenhum estado persistente em servidor.
- **Plataforma do MVP**: Windows apenas (todo o grupo usa Windows).
- **Modelo de execucao**: todos os participantes rodam o app localmente no proprio PC; nenhuma infraestrutura hospedada pra midia.
- **Multiplos transmissores simultaneos**: qualquer participante pode compartilhar a tela a qualquer momento; mais de um pode transmitir ao mesmo tempo; cada espectador escolhe qual stream assistir.
- **Audio**: somente o audio do sistema de quem compartilha (loopback do Windows via Chromium). **Sem voz de microfone** - o grupo ja usa outro canal (ex: Discord) pra conversar.
- **Qualidade**: "se for a mesma qualidade do Discord ta otimo" - qualidade estilo Discord e o piso aceitavel; como e P2P sem limite artificial, pode chegar a 1080p/60fps se o upload de quem transmite aguentar.
- **Plataforma alvo**: Windows (grupo do usuario usa Windows; loopback de audio do sistema funciona nativo no Chromium/Windows).
- **Selecao de fonte de captura**: ao compartilhar, o usuario escolhe entre **monitor** (ecra inteiro; se tiver mais de um monitor, escolhe qual) ou **aplicativo/janela especifica** (ex: navegador, jogos). Nas palavras do usuario: "monitor que a pessoa quer transmitir (ecra inteiro) ou aplicativo (google, ou jogos)".
- **Qualidade configuravel**: presets **720p/30fps** (leve), **1080p/30fps** (filme), **1080p/60fps** (jogos). Quem transmite escolhe o preset; todos os espectadores recebem igual (sem qualidade por espectador no MVP).
- **Formato do app**: **Electron**, empacotado em **.exe**. CRAVADO em 2026-08-24: a entrega final e um **INSTALADOR Windows** (next-next-finish, atalhos no menu iniciar/desktop), "pra que seja facil meus amigos instalarem no pc deles". Ninguem precisa de Node/terminal. O instalador e a base do auto-update do MVP.
- **Sinalizacao**: servidor **publico do PeerJS** (gratuito, so coordena a entrada na sala; a midia nunca passa por ele).
- **Acesso a sala**: ao criar, o app gera um **codigo de sala aleatorio** (ex: filme-4X9K) que o criador compartilha fora do app (WhatsApp/Discord). O codigo aleatorio funciona como senha; sem senha adicional, sem cadastro.
- **Papeis** (REVISADO em 2026-08-24, substituindo "todos iguais sem expulsao"): o **criador da sala e o dono** e tem duas acoes de moderacao sobre os demais:
  - **Desconectar**: derruba o participante na hora; ele PODE entrar de novo com o codigo.
  - **Banir**: derruba E bloqueia; o banido nao consegue reentrar enquanto a sala existir (lista de banidos da sala).
  Os demais participantes nao tem poderes de moderacao.
- **Transferencia de dono**: se o dono sai da sala, o papel de dono passa automaticamente pra outro participante (criterio: o mais antigo na sala). A sala continua viva com moderacao. A lista de banidos e herdada pelo novo dono.
- **Audio opcional por transmissao**: toggle "transmitir audio do sistema" na hora de compartilhar, ligado por padrao. Limitacao conhecida (Windows loopback): o audio capturado e o do sistema inteiro, mesmo compartilhando so uma janela.
- **Chat de texto**: fora do MVP (grupo ja usa Discord pra conversar).
- **Indicador "quem esta assistindo o que"**: incluido no MVP (custo baixo).
- **Falha de conexao P2P (NAT/CGNAT)**: MVP mostra mensagem de erro clara dizendo quem nao conseguiu conectar; sem fallback TURN/relay.
- **Criacao de sala com codigo flexivel**: botao de **gerar codigo aleatorio** OU campo pra **criar codigo personalizado** (ex: "sala-do-pontin") e enviar pros amigos.
- **Nickname na primeira abertura**: na primeira execucao do app, tela pedindo o nickname do usuario, usado pra identificar quem esta na sala. (Persistido localmente; detalhe em aberto: editavel depois nas configuracoes.)
- **Tela cheia na visualizacao**: botao de fullscreen ao assistir uma transmissao; a transmissao cobre a tela COMPLETAMENTE (fullscreen real, sem bordas/barras do app).
- **Auto-hide dos controles em fullscreen**: o botao de sair/minimizar da tela cheia some apos um tempo sem atividade do usuario (mouse/teclado); reaparece ao mexer. Detalhe tecnico: ~3s de inatividade, Esc tambem sai do fullscreen.
- **Controle de volume**: slider de volume + botao de mudo na visualizacao da transmissao. Controle LOCAL de cada espectador (nao afeta os outros). Tambem visivel/auto-hide junto com os controles do fullscreen.
- **Nickname editavel**: alem da tela de primeira abertura, o nickname pode ser editado depois (telinha de configuracoes).
- **Prefixo interno no codigo de sala**: o app prefixa o codigo digitado com identificador proprio no PeerJS (evita colisao com apps de terceiros); se o codigo ja estiver em uso, avisa "codigo ja em uso".
- **Sons customizados do usuario como padrao do app**: os avisos sonoros serao gravacoes feitas pelo proprio usuario (sons de boca), embutidas no app como arquivos de audio (mp3/wav/ogg). Todo mundo que rodar o app ouve esses sons. 7 sons combinados (pasta `audios/` na raiz do projeto, nomes acordados): entrou, saiu, transmitindo, parou-transmissao, desconectado (pra quem foi desconectado/banido), erro-conexao, reconectado. Usuario vai gravar TODOS (essenciais + opcionais).
- **TRAVA DE IMPLEMENTACAO (pedido explicito do usuario)**: a implementacao (Stage 4) NAO comeca antes de os 7 arquivos de audio estarem na pasta `audios/`. Planejamento (PRD/SPEC) pode avancar normalmente.
- **Upload insuficiente (decidido no gate do PRD)**: o app confia na adaptacao automatica nativa do WebRTC (reduz bitrate/framerate sozinho) e reflete a degradacao no indicador de qualidade da conexao. Sem logica extra de aviso.
- **Tolerancia de reconexao (decidido no gate do PRD)**: 15 segundos tentando reconectar antes de tratar como desconexao definitiva.
- **Validacao do codigo personalizado (decidido no gate do PRD)**: 3 a 32 caracteres; letras, numeros e hifen; case-insensitive.
- **Metrica de sucesso do MVP (decidido no gate do PRD)**: nas palavras do usuario, "quero que tenha tudo no mvp ja" - o sucesso do MVP cobre o conjunto COMPLETO de funcionalidades (nao so a sessao de filme): sessao real do grupo exercitando criacao de sala, entrada por codigo, multiplas transmissoes simultaneas, fullscreen, volume, PiP, moderacao, sons, indicadores e reconexao, sem erro bloqueante.

## 3. Escopo

**Dentro do escopo (MVP):**
- Sala unica com ate 5-6 participantes; codigo aleatorio ou personalizado; botao de copiar codigo.
- Nickname na primeira abertura (editavel depois).
- Compartilhar tela (monitor ou janela/app) com audio do sistema opcional e preset de qualidade.
- Multiplas transmissoes simultaneas; seletor com miniaturas ao vivo de cada stream.
- Fullscreen real com controles auto-hide; volume local por espectador.
- Dono da sala com desconectar/banir; transferencia de dono ao sair.
- Indicador persistente de "voce esta transmitindo".
- Aviso sonoro/visual de entrada/saida de participantes.
- Reconexao automatica em queda breve de conexao.
- Indicador de "quem esta assistindo o que".
- Caso filme: 1 transmite, demais assistem com som.
- Janela flutuante picture-in-picture (assistir numa janelinha sempre no topo enquanto usa outros programas).
- Indicador de qualidade da conexao (ping/bitrate por participante, estilo barrinhas de sinal).
- Auto-update do app (avisa/baixa quando ha versao nova do .exe).

(Revisao 2026-08-24: usuario moveu PiP, indicador de qualidade e auto-update da v2 pro MVP.)

**Fora do escopo / NAO fazer:**
- Chat de voz por microfone (grupo usa Discord).
- Chat de texto.
- Servidor de midia (SFU) / suporte a mais de 6 pessoas.
- Assistir 2 streams ao mesmo tempo em janelas separadas (descartado pelo usuario).
- Fallback TURN/relay pra NAT simetrico (MVP: mensagem de erro clara).

## 4. Superficie de regressao

N/A - projeto greenfield, pasta vazia, nada existente pra quebrar.

## 5. Papeis e permissoes

- **Dono da sala** (criador; transferido ao mais antigo se sair): tudo que um participante faz + desconectar participante + banir participante + define o limite de participantes ao criar.
- **Participante**: entrar/sair da sala, compartilhar a propria tela (1 fonte, com/sem audio, preset de qualidade), assistir qualquer stream, controlar o proprio volume, editar o proprio nickname.
- Ninguem alem do dono tem moderacao. Nao ha conta/login; identidade = nickname local.

## 6. Entidades e ciclo de vida

- **Sala**: criada com codigo (aleatorio ou personalizado) + limite; vive enquanto tiver >=1 participante; morre vazia (codigo libera, banimentos zeram). Nao ha "editar sala" depois de criada (MVP).
- **Participante**: entra com codigo + nickname; sai voluntariamente, por desconexao (pode voltar) ou banimento (bloqueado ate a sala morrer).
- **Transmissao**: iniciada por um participante (escolhe fonte + audio on/off + preset); 1 por pessoa; termina quando ele para, troca de fonte (reinicia) ou sai da sala.
- **Nickname**: definido na primeira abertura, salvo localmente, editavel nas configuracoes; round-trip simples (campo carrega o valor atual).

## 7. Regras de negocio e exemplos concretos

- Limite de participantes: configuravel pelo dono na criacao da sala, faixa 2-8, padrao 6 (decisao final; substitui a mencao inicial a "5 amigos").
- Banda no caso filme: 1 transmissor envia 1 copia por espectador; com 4 espectadores a ~3-4 Mbps por copia, ~12-16 Mbps de upload em 1080p (metade disso em 720p).

## 8. Edge cases / sad paths

A discutir. Candidatos ja levantados:
- NAT simetrico / CGNAT: STUN falha em ~10-15% dos cenarios; sem TURN a conexao direta nao fecha. Definir comportamento (mensagem de erro clara? fallback?).
- Queda de conexao de um participante no meio da transmissao.
- Upload insuficiente de quem transmite (qualidade adaptativa? aviso?).

## 9. Referencia de UI

Modo: identidade nova (projeto greenfield), definida pelo usuario:
- **Tema escuro** com **acento roxo `#9d00ff`** ("gosto muito da cor roxa, acho q misturar os dois ficaria legal").
- Direcao: fundos em cinza-escuro/quase preto, roxo #9d00ff como cor de destaque (botoes, indicadores, bordas ativas), variacoes mais claras/escuras do roxo pra estados hover/pressed.

## 10. Prioridades

Nas palavras do usuario: ele "gostou de todas" as sugestoes e quis "tudo isso ja no MVP", exceto assistir 2 streams simultaneos ("acho q n precisa"). Ou seja: TUDO que esta em "Dentro do escopo (MVP)" e must-have; nao ha backlog de nice-to-have; o unico corte deliberado e o multi-stream em janelas separadas.

## 11. Premissas confirmadas

- Usuario confirmou: sem voz de microfone, so o som do compartilhamento.
- Usuario confirmou: qualidade estilo Discord e suficiente (como piso).
- Usuario confirmou: grupo de no maximo 5-6 amigos, todos rodando o app localmente.
- Usuario escolheu: limite de participantes configuravel pelo dono ao criar a sala (nao fixo).
- Usuario confirmou: uma fonte de transmissao por pessoa por vez.
- Usuario confirmou: sala morre quando o ultimo participante sai (banimentos zeram).
- Usuario confirmou: MVP e Windows-only.
- Usuario confirmou: expulsao em 2 niveis (desconectar = pode voltar; banir = bloqueado ate a sala fechar), so o dono.
- Usuario confirmou: dono que sai transfere o papel pra outro participante.
- Usuario confirmou: sons do app serao gravacoes proprias dele (entrega na implementacao; placeholders ate la).
- Usuario confirmou: tema escuro com roxo #9d00ff e variantes.

## 12. Pontos em aberto (lista viva)

- Nenhum. Stage 1 finalizada em 2026-08-24 (aguardando confirmacao final do usuario no resumo).
