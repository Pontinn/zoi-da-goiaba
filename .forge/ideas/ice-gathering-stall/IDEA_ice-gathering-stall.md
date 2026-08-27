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

### Hipotese atual (NAO confirmada)
O agente de ICE da maquina dela fica preso no gathering, provavelmente enumerando uma interface de rede que nao responde (VPN, adaptador virtual de VM ou container, Wi-Fi e cabo simultaneos). Com STUN sem resposta e sem TURN, so sobra candidato host; se o host escolhido for de uma interface errada, os 92 candidatos trocados nao levam a lugar nenhum. O restart re-enumera as interfaces e por isso funciona.
Isto e INFERENCIA a partir do comportamento, nao fato observado: o log nao registra QUAIS interfaces geraram os candidatos.

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

- P1: FECHADO em 2026-08-27. O log do outro lado foi obtido e derrubou as duas hipoteses iniciais. Ver secao 7.
- P2 (NOVO, e o que fecha o diagnostico): descobrir QUAIS interfaces de rede a maquina dela expoe e quais candidatos host o ICE gerou em cada boot. O log atual nao registra o candidato local por extenso, so o tipo. Sem isso, a hipotese da interface errada continua inferencia.
- P3: o log deveria passar a registrar o endereco/interface de cada candidato host e o motivo de o gathering nao completar? Hoje ele diz `gathering=gathering` e para por ai, que e pouco para diagnosticar em campo.
- P4: cabe um timeout de gathering que force o ICE a seguir com os candidatos que ja tem, em vez de esperar 10 s por um que nunca vem?
- P5: a mensagem de erro precisa mudar. Hoje ela diz "pode ser a rede de um dos dois", o que joga a suspeita nos dois lados igualmente, quando a evidencia aqui aponta para UM lado especifico e para o ICE, nao para a rede em geral.
- P6: vale detectar e avisar quando o proprio app nao consegue fechar ICE em direcao nenhuma (a dona falhou ao entrar as 22:31:11 e nao soube disso)? Um aviso do tipo "sua maquina nao esta conseguindo conectar, tente reiniciar o app" resolveria o caso em campo sem entender a causa raiz.

## 13. APENDICE

Descoberto durante a Stage 4 da `viewer-cursors`, sem qualquer alteracao de codigo. Diretriz do usuario em 2026-08-27: bug encontrado no meio de outra coisa vira IDEIA, nunca desvio.
