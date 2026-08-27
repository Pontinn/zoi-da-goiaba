---
feature: ice-gathering-stall
language: pt-BR
type: fix
status: in-progress
created: 2026-08-27
---

# IDEA: ICE nao fecha e impede entrar na sala ate reiniciar o app

## 1. Objetivo

Entrar numa sala falha com "Achei a sala, mas a conexao nao completou. Pode ser a rede de um dos dois.", SEMPRE com a mesma pessoa, e SEMPRE volta a funcionar quando essa pessoa reinicia o app. Observado pelo usuario em campo em 2026-08-27, na v0.3.0 instalada.

A mensagem culpa a rede das duas pontas, mas o padrao "reiniciar o app do outro lado resolve" DESCARTA rede: NAT e firewall nao mudam com um restart. O que muda com restart e o REGISTRO na sinalizacao.

Objetivo do fix: que o app perceba sozinho que perdeu a sinalizacao e se re-registre, em vez de virar uma porta que existe no servidor e nao atende. E, enquanto isso nao for possivel, que a mensagem de erro aponte para o lado certo.

## 2. Decisoes (lista viva)

- 2026-08-27: NENHUMA decisao de desenho tomada. A ideia nasceu durante a implementacao da `viewer-cursors` e o usuario mandou NAO desviar. Nada de codigo foi alterado.
- 2026-08-27: DUAS HIPOTESES FORAM LEVANTADAS E AS DUAS FORAM DERRUBADAS pelo log da outra maquina. Ficam registradas porque saber o que NAO e vale tanto quanto saber o que e:
  - DERRUBADA 1, "peer fantasma / socket morto na sinalizacao": a porta `pipoca-7iig` foi registrada as 22:31:20 e a tentativa falhou as 22:31:49, 29 segundos depois. Registro fresco, app vivo. E o log dela mostra `pedido de admissao chegou pela sinalizacao`, ou seja a porta ATENDEU e a sinalizacao funcionou nos dois sentidos.
  - DERRUBADA 2, "estado que sobra na transicao de membro para dono": tambem nao explica, porque o app dela recebeu o pedido normalmente. O problema esta depois disso.

## 3. Escopo

Dentro (provavel, a confirmar no CONTEXT):
- Deteccao ativa de que a conexao com a sinalizacao morreu, em vez de depender so do evento `disconnected`.
- Re-registro da porta da sala quando isso acontece.
- Redacao da mensagem de erro do lado de quem entra.

Fora:
- Adicionar TURN. A ausencia de TURN e decisao registrada (RF-42) e este problema NAO e de travessia de NAT.
- Mudar o servidor de sinalizacao publico.

## 4. Superficie de regressao

- `peer-manager.ts` e `reconnection.ts` mexem no nucleo do transporte. Os fallbacks de direcao ja estabilizados em campo e o e2e `expectNoDirectionFallbacks` nao podem quebrar.
- A eleicao de dono (`election.ts`) depende do roster e do registro.

## 7. Regras e evidencia

### Caminho de codigo (verificado)
- `session.ts:598` lanca `RoomUnreachableError` (definida em `session.ts:89`) dentro de `requestJoin` (`session.ts:575`), quando a sinalizacao NAO respondeu `peer-unavailable` e mesmo assim o canal de admissao nao abriu em `JOIN_RESPONSE_TIMEOUT_MS`.

### Cronologia cruzada dos DOIS logs (2026-08-27)
Logs: o de quem entra e `%APPDATA%/Zoi da Goiaba/logs/zoi-2026-08-27.log`; o do outro lado foi entregue pelo usuario.

| Hora | Lado | Evento |
|---|---|---|
| 22:29:43 | dona | app iniciado (boot 1) |
| 22:31:11 | dona | ELA TAMBEM falha ao entrar na `sala-7ckp`, mesmo erro `sem canal` |
| 22:31:20 | dona | porta `pipoca-7iig` registrada |
| 22:31:30 | dona | `pedido de admissao chegou pela sinalizacao` (a porta ATENDEU) |
| 22:31:34 | dona | canal nao abriu em 4000ms, dispara o dial-back |
| 22:31:40 | dona | `o canal de admissao nunca abriu em 10000ms (connectionState=connecting iceConnectionState=checking gathering=gathering)` |
| 22:31:44 | dona | o dial-back falha do mesmo jeito |
| 22:31:49 | entrante | falha, `(sem canal)` |
| 22:32:59 | dona | porta `pipoca-sk19` registrada |
| 22:33:12 e 22:33:26 | entrante | falha duas vezes |
| 22:33:35 | dona | APP REINICIADO (boot 2) |
| 22:33:59 | dona | porta `zoi-oflv` registrada |
| 22:34:12 | entrante | ENTRA. `local=host/udp remoto=host/udp estado=succeeded rtt=3ms` |

### O que a evidencia diz
- A sinalizacao esta INTEIRA. A oferta chega, a porta atende, e 92 candidatos ICE foram trocados na conexao que falhou (`697c29`). Nao e registro, nao e socket morto, nao e a porta ausente.
- O que trava e o ICE: parado em `iceConnectionState=checking` com `gathering=gathering`, ou seja o GATHERING NUNCA COMPLETOU nos 10 segundos inteiros. No caso que funcionou, o log do entrante mostra `iceGatheringState: complete` e so entao conecta.
- TODAS as 4 conexoes bem-sucedidas no log dela fecharam por `local=host/udp`: candidato HOST, nunca `srflx` (STUN), nunca relay (nao ha TURN, RF-42). Com `rtt=3ms` no caso de sucesso, as duas maquinas estavam na MESMA REDE LOCAL.
- Naquela janela a maquina dela nao fechava ICE em direcao NENHUMA: as 22:31:11 ela propria falhou ao ENTRAR numa sala, com o mesmo erro. E bilateral e e do lado dela.
- O reinicio do app resolve. Entre o boot 1 e o boot 2 nada mudou de rede: mudou o que o ICE enumerou.

### O CAMINHO QUE FUNCIONA (2026-08-27, inspecao da maquina de quem entra)

O usuario informou que as duas maquinas NAO estao na mesma Wi-Fi: casas diferentes, so o mesmo provedor. Isso tornava o `host/udp` com `rtt=3ms` impossivel de explicar por rede local. A inspecao da maquina dele explicou:

```
26.38.59.243    Radmin VPN      (adaptador Up, 100 Mbps)
192.168.1.8     Ethernet        (DHCP, a rede real)
172.26.144.1    vEthernet (Default Switch)   (Hyper-V)
169.254.x.x     Wi-Fi, Bluetooth e duas "Conexao Local*"  (SEM endereco, interfaces mortas)
```

**Eles usam Radmin VPN.** Ele cria uma LAN virtual que poe as duas maquinas na faixa `26.x.x.x`, e para o ICE esse endereco e um candidato `host` comum. E ISSO, e nao proximidade fisica, que explica o `local=host/udp remoto=host/udp rtt=3ms` entre casas diferentes. Todas as conexoes que funcionaram passaram por ai.

**O achado decisivo:** no momento da inspecao, o adaptador `Radmin VPN` estava `Up` e COM endereco atribuido, mas o PROCESSO do Radmin VPN NAO estava rodando (`Get-Process *radmin*` vazio). Adaptador zumbi: o ICE enxerga a placa, considera `26.38.59.243` um candidato host valido e o oferece ao outro lado, mas nao ha nada roteando por ele. O outro lado tenta e bate no vazio. Resultado exato do log: dezenas de candidatos trocados, `checking` eterno, nada conecta.

**Consequencia de arquitetura, ate agora nao escrita em lugar nenhum:** a conectividade do grupo depende INTEIRAMENTE de um software de terceiro estar de pe. Sem TURN (RF-42) e com o STUN aparentemente sem serventia para eles, o Radmin VPN nao e um atalho, e o unico caminho. Quando ele cai, nao ha plano B.

### CONCLUSAO DE CAUSA RAIZ RETIRADA (2026-08-27, mesma noite)

Uma versao anterior desta IDEA apontava o ADAPTADOR ZUMBI como causa raiz. **O usuario derrubou isso e ele esta certo.** Fica registrado porque saber o que NAO e vale tanto quanto saber o que e:

- O adaptador zumbi foi encontrado na maquina de QUEM ENTRA, nao na do outro lado. Se fosse a causa, ele falharia com TODO MUNDO: sem o processo do Radmin rodando, o `26.38.59.243` dele esta morto para qualquer par. Ele conecta normalmente com os outros amigos.
- FATO NOVO trazido pelo usuario: **todos os outros amigos do grupo tambem usam Radmin VPN e com eles nao ha problema nenhum.** Portanto "usar Radmin" NAO e o que diferencia este caso.
- Licao de metodo: houve salto da evidencia para a conclusao sem testar a conclusao contra os casos que funcionam. O achado do adaptador zumbi e real e continua valendo como RISCO (ver P5), mas nao explica ESTE caso.

### O que sobrevive como FATO
- O caminho que fecha entre eles e a LAN virtual do Radmin (`26.x.x.x` visto pelo ICE como candidato `host`), e nao a rede local nem STUN. Sao casas diferentes, so o mesmo provedor.
- Nas falhas o ICE nunca fechou: 92 candidatos trocados, preso em `checking`, `gathering` sem completar nos 10 s inteiros.
- A falha e do lado DELA e e bilateral naquela janela: as 22:31:11 ela tambem falhou ao ENTRAR numa sala.
- Reiniciar o app DELA resolve, de forma repetida.
- Sem TURN e sem STUN util, nao existe plano B quando esse caminho nao fecha.

### O que o "restart resolve" ja elimina
Configuracao de rede ruim e persistente na maquina dela esta DESCARTADA por dois motivos independentes: reiniciar um aplicativo nao muda configuracao de rede, e ela quebraria com o grupo inteiro, nao so com uma pessoa. O que muda com o restart do app e o que o processo enumera e o estado interno dele.

### ANALISE DOS 3 DIAS DE LOG DELA (2026-08-27, pasta restaurada pelo usuario)

Contagem por dia (`iniciado`, `conectado por local=`, `nunca abriu`/`nao respondeu`):

| Dia | Boots | Sucessos | Falhas |
|---|---|---|---|
| 25/08 | 4 | 19 | 16 |
| 26/08 | 3 | 5 | 6 |
| 27/08 | 2 | 4 | 10 |

**E CRONICO, nao episodico:** 32 falhas contra 28 sucessos em 3 dias. E **TODAS as 28 conexoes bem-sucedidas, sem excecao, fecharam por `host/udp`**. Nunca uma unica por srflx ou relay em 3 dias. Para ela o caminho do Radmin nao e o preferido, e o unico que ja funcionou alguma vez.

**Sessoes nascem boas ou ruins e tendem a permanecer.** Correlacionando cada evento com o tempo desde o boot da sessao: 25/08 boot 1 deu 11 falhas e ZERO sucesso; 27/08 boot 1 deu 9 falhas e ZERO sucesso; 26/08 boot 2 deu 4 falhas e ZERO sucesso. Outras sessoes foram quase todas de sucesso, inclusive com conexoes boas aos 24 minutos de vida. Isso confirma com dado o "reinicia e funciona", e DESCARTA tempo de vida do app como fator.

### A UNICA TRANSICAO BOM -> RUIM OBSERVADA (25/08, boot 3)
Sessao boa por ~250 s, depois falhas a partir de 3357 s. O que houve entre as duas:

```
23:07:15  OK     conectado por local=host/udp remoto=host/udp rtt=2ms
23:47:34  ERROR  PeerJS: Lost connection to server.
23:47:34  WARN   member disconnected da sinalizacao
23:47:35  INFO   member open (reconectou em 1 segundo)
23:58:18  WARN   iceConnectionState: disconnected      <- 11 min depois
23:58:23  WARN   o ICE nao fechou (disconnected persistente).
                 gathering=complete sinalizacao=stable gerados=13
                 candidatos locais=[host/tcp, host/udp, srflx/udp] remotos=[host/udp]
23:58:28  WARN   connectionState: failed
```

Leituras que isso permite:
- A RECONEXAO DA SINALIZACAO FUNCIONOU: caiu e voltou em 1 segundo, como projetado. O que nao se refez foi o caminho de MIDIA, 11 minutos depois. Sao camadas diferentes e so uma se recuperou.
- Neste diagnostico o lado DELA tinha `srflx/udp` (o STUN funcionou para ela), e o lado REMOTO ofereceu SO `host/udp`. Quando um dos lados so tem candidato host, o unico encontro possivel e host-com-host, que entre casas diferentes so existe pelo Radmin. Se o Radmin nao estiver de pe naquele instante, nao sobra NADA, e o srflx de um lado so nao salva por falta de par.
- Aqui o `gathering=complete`, diferente das falhas de admissao do dia 27, onde ficou `gathering=gathering`. Sao dois modos de falha distintos e nao devem ser tratados como um so.

**NOTA DE PRECISAO SOBRE O LOG:** esta linha registra a lista de TIPOS de candidato, nao os enderecos. O P3 continua valendo: sem endereco e sem interface, nao da para saber de qual placa saiu cada candidato host. Esta linha rica so aparece UMA vez em 3 dias de log (so no caminho de `disconnected persistente`), enquanto as falhas de admissao, que sao a maioria, nao produzem nenhuma.

### A PERGUNTA QUE SEPARA AS HIPOTESES, E POR QUE NENHUM LOG RESPONDE

**A outra pessoa nunca usou o app com mais ninguem** (informado pelo usuario em 2026-08-27). Consequencia direta e que corrige o alcance da analise acima: TODO o dado que existe e de UM UNICO PAR. O que foi registrado como "cronico na maquina dela" e, com rigor, "cronico nesta dupla". Log nenhum separa as duas coisas, porque nao existe sessao dela com outra pessoa para comparar.

Isto NAO se resolve com mais analise. So com teste.

### VIRADA DE 2026-08-27 (nova tentativa do usuario, logs2): O CAMINHO REAL FUNCIONA

O usuario rodou uma versao do E2: houve falha, eles ABRIRAM O RADMIN, e conectou. Logs novos dela analisados.

**O log grava o TIPO DE REDE do candidato vencedor**, coisa que passou despercebida nas analises anteriores: `conectado por local=host/udp (unknown)` contra `(ethernet)`. Contagem nos 3 dias:

| Adaptador | Conexoes | RTT |
|---|---|---|
| `unknown` (virtual, nao classificado pelo Chromium: e o Radmin) | 28 | 2 a 4 ms |
| `ethernet` (placa real) | 3 | 21 a 23 ms |

As tres por `ethernet` sao TODAS da ultima tentativa (27/08 23:51). Sequencia exata:

```
23:50:43  app iniciado
23:51:07  FALHOU     a porta nao respondeu 10000ms
23:51:34  app iniciado                                      <- REINICIOU
23:51:39  conectado  local=host/udp (ethernet) rtt=22ms     <- funcionou, por OUTRO caminho
23:51:40  conectado  local=host/udp (ethernet) remoto=prflx/udp rtt=21ms
```

**AFIRMACAO ANTERIOR DERRUBADA (a terceira desta investigacao):** estava escrito acima que "para ela o caminho do Radmin nao e o preferido, e o unico que ja funcionou alguma vez". Era verdade nos dados de entao e DEIXOU de ser. O caminho pela internet real funciona entre eles, a ~22 ms.

**RESSALVA QUE O PROPRIO USUARIO LEVANTOU:** o app dela REINICIOU entre a falha e o sucesso (23:51:34). Portanto abrir o Radmin NAO esta isolado como causa. Pode ter sido o restart, pode ter sido o Radmin, pode ter sido os dois.

### HIPOTESE LIDER ATUAL (a antiga, agora com evidencia melhor)
O adaptador do Radmin num estado MEIO QUEBRADO (interface no ar com endereco, software nao roteando) e pior que o Radmin desligado:
- Radmin SAUDAVEL: conecta pelo virtual em 2-4 ms.
- Radmin FECHADO DE VEZ: conecta pela ethernet em ~22 ms.
- Radmin MEIO QUEBRADO: o ICE enumera os candidatos dele, gasta o orcamento de 10 s testando um caminho que nao existe, e a ethernet (que funcionaria) nao chega a vencer dentro da janela. Falha.
Isso tambem explica por que os OUTROS amigos nao tem o problema: o Radmin deles esta de pe ou desligado, e nenhum desses dois estados quebra. E casa com o adaptador zumbi encontrado na maquina do usuario (`Up` com endereco, processo fechado), que continua sendo um estado real e observado deste sistema.

### EXPERIMENTO DECISIVO AGORA (substitui o E2 anterior em prioridade)
**E4 - Radmin DESLIGADO de verdade dos dois lados.** Fechar o Radmin e DESABILITAR o adaptador no Windows (nao basta fechar a janela), nos dois, e entrar numa sala varias vezes seguidas SEM reiniciar o app entre elas.
- Conectou de forma consistente por `(ethernet)` a ~22 ms: hipotese CONFIRMADA. O conserto vira despriorizar ou descartar candidato de interface que nao responde, e o Radmin deixa de ser necessario para o grupo.
- Continuou falhando: o Radmin nao e o fator e sobra o modo `gathering` que nao completa.
Coletar os logs dos dois lados, e conferir o campo de tipo de rede do candidato vencedor em cada tentativa.

### EXPERIMENTOS DESENHADOS (fazer antes de desenhar qualquer conserto)

**E1 - o decisivo.** Ela entra numa sala com OUTRO amigo do grupo, sem o usuario. Todos os outros amigos usam Radmin e nao tem problema com o usuario, entao qualquer um serve de controle.
- FALHOU: o problema e da maquina/instalacao dela. Alvo do conserto: o que o app dela enumera ao subir e o que guarda entre sessoes.
- FUNCIONOU: o problema e da combinacao dos dois. Alvo: a rota entre os dois enderecos de Radmin, a ordem/priorizacao de candidatos, ou algo especifico do par.
Coletar os logs dos DOIS lados da tentativa, em qualquer resultado.

**E2 - mais rapido, vale rodar junto.** O par de sempre, mas conferindo ANTES que o Radmin VPN esta aberto e CONECTADO nas duas maquinas (nao basta o adaptador existir no Windows: na maquina do usuario o adaptador estava `Up` com endereco e o processo estava fechado).
- Problema sumiu: a dependencia do Radmin esta confirmada e vira o centro do desenho, junto com P7 (reabrir a decisao de nao ter TURN).
- Problema continuou: o Radmin nao e o fator, e sobra o modo de falha do `gathering` que nao completa.

**E3 - barato e util em qualquer cenario.** Na maquina DELA, listar as interfaces de rede (`Get-NetIPAddress` e `Get-NetAdapter`) e o estado do processo do Radmin, do mesmo jeito que foi feito na maquina do usuario. E o unico dado que falta do outro lado e o log nao entrega.

## 8. Casos de borda

- Maquina do dono suspende e volta.
- Oscilacao de rede do lado do dono sem queda percebida.
- Re-registro precisa preservar o MESMO id de sala, senao o codigo que o grupo ja combinou para de valer.
- Duas instancias tentando registrar a mesma porta durante a recuperacao.

## 11. Assumptions confirmadas

- 2026-08-27 CONFIRMADO por log: o id da sala existia na sinalizacao no momento da falha (nao houve `peer-unavailable`).
- 2026-08-27 CONFIRMADO pelo usuario: e sempre a mesma pessoa, e reiniciar o app dela resolve.
- 2026-08-27 NAO CONFIRMADO: a mecanica exata na maquina dela. So ha log do lado de quem entra.

## 12. Pontos em aberto (lista viva)

- P1: FECHADO. O log do outro lado derrubou as duas hipoteses iniciais (peer fantasma e estado residual de dono).
- P2: PARCIALMENTE fechado. A inspecao da maquina de QUEM ENTRA explicou o caminho que funciona (LAN virtual do Radmin) e revelou o adaptador zumbi, mas NAO explica este caso (ver a retratacao na secao 7). Falta inspecionar a maquina do OUTRO lado, que e onde a falha acontece.
- P2b (AGORA E O PRINCIPAL): a outra pessoa falha tambem com os DEMAIS amigos do grupo, ou so com este par? Todos os outros usam Radmin sem problema. Esta resposta separa "maquina dela" de "combinacao dos dois" e decide o alvo do conserto. Antes dela, qualquer desenho e chute.
- P3: o log grava so o TIPO do candidato (`host`), nunca o endereco nem a interface. Foi o que impediu de fechar o diagnostico pelos logs e obrigou a inspecionar a maquina a mao. Deveria passar a registrar endereco e interface do candidato vencedor e dos oferecidos.
- P4: cabe um teto de tempo no gathering, para o ICE seguir com o que ja tem em vez de esperar por interface morta? A maquina inspecionada tinha CINCO interfaces sem endereco (`169.254.x.x`) concorrendo.
- P5: DETECTAR ADAPTADOR ZUMBI (vale por si, mesmo nao sendo a causa deste caso). Um candidato host de uma interface cujo software nao esta rodando e pior que candidato nenhum: ele parece valido e consome a janela inteira do ICE. Da para descartar ou despriorizar?
- P6: a mensagem de erro precisa mudar. "Pode ser a rede de um dos dois" espalha a suspeita e nao ajuda: o caso real e de UM lado e de UM adaptador. Algo que aponte o caminho ("nenhum caminho de rede fechou; se voces usam VPN, confira se ela esta conectada dos dois lados") resolveria em campo sem ninguem entender de ICE.
- P7: DECISAO DE PRODUTO, e a maior delas. O grupo depende de um software de terceiro para conectar. Vale reabrir a decisao de nao ter TURN (RF-42), nem que seja um TURN so para o canal de admissao? Sem isso, qualquer queda do Radmin derruba o app inteiro e a culpa cai no app.
- P8: avisar o proprio dono quando ele nao consegue fechar ICE em direcao nenhuma? Na noite do problema ela tambem falhou ao ENTRAR numa sala as 22:31:11 e nao soube disso.

## 13. APENDICE

Descoberto durante a Stage 4 da `viewer-cursors`, sem qualquer alteracao de codigo. Diretriz do usuario em 2026-08-27: bug encontrado no meio de outra coisa vira IDEIA, nunca desvio.
