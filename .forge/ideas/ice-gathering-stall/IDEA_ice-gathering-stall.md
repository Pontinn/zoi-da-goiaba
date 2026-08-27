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

### A PERGUNTA QUE SEPARA AS HIPOTESES (ainda sem resposta)
**A outra pessoa falha tambem com os DEMAIS amigos, ou so com este par?**
- Se falha com todos: o problema e da maquina/instalacao dela, e o alvo e o que o app dela enumera ou guarda entre sessoes.
- Se falha so com este par: o problema e da combinacao dos dois (rota entre os dois enderecos de Radmin, ordem de candidatos, algo especifico do par), e o alvo e outro.
Sem essa resposta, qualquer desenho de conserto e chute.

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
