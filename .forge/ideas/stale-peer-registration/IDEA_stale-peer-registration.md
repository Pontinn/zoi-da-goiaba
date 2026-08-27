---
feature: stale-peer-registration
language: pt-BR
type: fix
status: in-progress
created: 2026-08-27
---

# IDEA: Peer fantasma na sinalizacao impede entrar na sala

## 1. Objetivo

Entrar numa sala falha com "Achei a sala, mas a conexao nao completou. Pode ser a rede de um dos dois.", SEMPRE com a mesma pessoa, e SEMPRE volta a funcionar quando essa pessoa reinicia o app. Observado pelo usuario em campo em 2026-08-27, na v0.3.0 instalada.

A mensagem culpa a rede das duas pontas, mas o padrao "reiniciar o app do outro lado resolve" DESCARTA rede: NAT e firewall nao mudam com um restart. O que muda com restart e o REGISTRO na sinalizacao.

Objetivo do fix: que o app perceba sozinho que perdeu a sinalizacao e se re-registre, em vez de virar uma porta que existe no servidor e nao atende. E, enquanto isso nao for possivel, que a mensagem de erro aponte para o lado certo.

## 2. Decisoes (lista viva)

- 2026-08-27: NENHUMA decisao de desenho tomada ainda. A ideia nasceu durante a implementacao da `viewer-cursors` e o usuario mandou NAO desviar: registrar e seguir. Nada foi alterado no codigo.

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

Caminho de codigo EXATO que produz o sintoma, ja verificado:
- `session.ts:598` lanca `RoomUnreachableError` (definida em `session.ts:89`) dentro de `requestJoin` (`session.ts:575`).
- A condicao: a sinalizacao NAO respondeu `peer-unavailable` (ou seja, o id da sala EXISTE no servidor) e mesmo assim o canal de admissao nao abriu dentro de `JOIN_RESPONSE_TIMEOUT_MS`.
- O log do usuario (`%APPDATA%/Zoi da Goiaba/logs/zoi-2026-08-27.log`) registra tres tentativas: `pipoca-7iig` e `pipoca-sk19` falharam com o estado `(sem canal)`, ou seja o canal nem chegou a abrir. Uma terceira, `zoi-oflv`, conectou por `local=host/udp remoto=host/udp rtt=3ms`, que e conexao LOCAL e nao serve de contraprova.

Tratamento que JA existe e nao esta bastando:
- `peer-manager.ts:185` e `:483` escutam `disconnected` e chamam `reconnect()` com backoff nos DOIS peers (`:411`, `:553`).
- HIPOTESE PRINCIPAL: `disconnected` e um evento que precisa CHEGAR. Quando a maquina suspende ou a rede cai de forma suja, o socket vira buraco negro, nao chega RST, nenhum evento dispara, e o app segue achando que esta conectado. Nao ha checagem ATIVA de vida da sinalizacao, so reacao a um evento que nesse cenario nunca vem.

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

- P1: PENDENCIA QUE FECHA O DIAGNOSTICO. Pegar o log do outro lado (`%APPDATA%/Zoi da Goiaba/logs/zoi-<data>.log`). Se aparecer `disconnected` seguido de tentativas de `reconnect`, a recuperacao esta tentando e FALHANDO. Se nao aparecer NADA no horario da tentativa, o socket morreu mudo e o app nem percebeu. Sao consertos diferentes e o desenho depende dessa resposta.
- P2: qual sinal de vida usar (ping de aplicacao, `peer.socket` observado, reacao a `powerMonitor` de resume no main)?
- P3: a mensagem de erro deve mudar? Hoje ela culpa a rede dos dois; neste cenario o problema e de um lado so e e de registro.
- P4: cabe um aviso ao PROPRIO dono de que ele caiu da sinalizacao, ja que hoje ele nao percebe nada?

## 13. APENDICE

Descoberto durante a Stage 4 da `viewer-cursors`, sem qualquer alteracao de codigo. Diretriz do usuario em 2026-08-27: bug encontrado no meio de outra coisa vira IDEIA, nunca desvio.
