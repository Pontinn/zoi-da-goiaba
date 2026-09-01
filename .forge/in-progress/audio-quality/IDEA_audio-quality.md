---
feature: audio-quality
language: pt-BR
type: fix
status: done
created: 2026-08-31
---

# IDEA: Estalos ("clicks") intermitentes no audio recebido da transmissao

## 1. Objetivo

Durante a sessao longa de fim de semana (2026-08-29/30, 5 pessoas simultaneas, v0.4.0), tudo funcionou com qualidade impecavel (video, fluidez, cursores), EXCETO um unico problema percebido pelo usuario: o audio da transmissao dava um "estalinho" de vez em quando. Nao era alto, mas era perceptivel e incomodava por o som nao estar limpo.

Nas palavras do usuario: "as vezes ele ficava dando um estalinho do nada, nao era nada alto mas eu conseguia perceber e me causava um incomodo por o som nao estar limpo".

Objetivo do fix: audio recebido limpo, sem estalos perceptiveis.

## 2. Decisoes (lista viva)

- 2026-08-31: NENHUMA decisao de desenho tomada ainda. Investigar antes de propor solucao (regra global do usuario: nunca chutar causa).
- 2026-08-31 (CORRECAO DE PREMISSA via forge-review): o aviso de captura sistema-inteiro JA EXISTE (start e runtime, RoomScreen.tsx); o MUST do vazamento Win10 foi re-enquadrado de "criar aviso" para "avaliar e ajustar a eficacia do aviso existente". Alem disso, sao TRES estados de captura e nao dois: excluded (addon com exclusao), endpoint-loopback (degrau DENTRO do addon, AudioMode continua excluded) e full-loopback (getDisplayMedia do Chromium, fora do addon). A instrumentacao precisa distinguir os tres.
- 2026-08-31 (DECISAO DO USUARIO, escopo): TUDO NUMA FEATURE SO. Os tres sintomas (estalo, vazamento de audio no Win10, jogo mudo) + a instrumentacao entram nesta mesma feature. P5 e P9 fechados por esta decisao. O usuario tambem pediu para RENOMEAR o slug (e a futura branch) para refletir o escopo ampliado.
- 2026-08-31 (DECISAO DO USUARIO, MUST): "independente do que for decidido aqui, adicione logs de audio pra podermos debugar futuramente". Instrumentacao/observabilidade de audio e entregavel OBRIGATORIO desta feature, seja qual for o escopo dos sintomas. Cobre no minimo os buracos ja identificados: os tres pontos de descarte silencioso do caminho excluded (U2), stats de audio do WebRTC no stats-monitor com filtro por kind (U3), e o modo de captura ativo (excluded vs full-loopback) visivel no log (U1).

## 3. Escopo

Dentro (decisao do usuario 2026-08-31: tudo numa feature so):
- Instrumentacao/observabilidade de audio completa (MUST): os tres pontos de descarte silencioso do caminho excluded, stats de audio do WebRTC por kind no stats-monitor, modo de captura ativo no log, e o relatorio active do motor nativo (composicao PID/exe) que hoje e descartado sem log.
- Estalo: conserto das fontes de clique comprovadas no codigo (fronteira zero-pad do underrun do mixer, timestamp que cola apos descarte de frame) + o que os dados de campo indicarem.
- Vazamento Win10: TRANSPARENCIA EFICAZ ao transmissor sobre captura em modo sistema-inteiro. CORRECAO DE PREMISSA (2026-08-31, achado do forge-review no codigo): avisos JA EXISTEM (toast no start quando o modo e full-loopback, RoomScreen.tsx:211-216, e toast em runtime quando degrada, RoomScreen.tsx:113-131), e mesmo assim o vazamento aconteceu na demo sem o transmissor se dar conta. O MUST portanto NAO e criar aviso: e avaliar por que o existente nao funcionou (redacao que nao menciona vazamento de outros apps? saliencia? aparece uma vez so?) e ajustar. O SPEC nao deve desenhar toast duplicado.
- Jogo mudo: diagnostico viabilizado pelos logs novos + conserto ou aviso claro conforme a causa (sessao em outro endpoint/role, modo exclusivo, ou include que falha em silencio).

Fora:
- TURN/servidor de midia (pertence a ice-gathering-stall P7, nao a audio).
- Mudar defaults de produto de som local (app-sounds-volume intocada).
- Reescrever a arquitetura da captura (addon nativo permanece; consertos sao dentro do desenho existente).

## 4. Superficie de regressao

- A captura de audio do app (feature app-audio-capture, completa) e o volume de sons do app (app-sounds-volume) nao podem quebrar.
- Qualidade de video e fluidez recem-validadas em campo (v0.4.0) intocaveis.

## 5. Roles & permissions

N/A ate aqui: fix de qualidade de midia, sem mudanca de permissao prevista.

## 6. Entities & lifecycle

N/A ate aqui: sem entidade nova prevista.

## 7. Regras e evidencia

### Sintoma (relato do usuario, 2026-08-31)
- Papel: ASSISTINDO (o estalo aparecia no som da transmissao de outra pessoa).
- Origem: SO no audio da transmissao. Sons locais (Discord, musica, Windows) limpos, o que ISENTA a saida de audio da maquina do receptor como um todo e aponta para o caminho do stream.
- Padrao: variavel; as vezes aleatorios e espacados, as vezes frequentes (varios por minuto).
- Sessao: horas seguidas, 5 pessoas simultaneas, v0.4.0.
- So o usuario percebeu; ele nao perguntou ao grupo, entao pode ter acontecido com os outros tambem.

### Relato adicional (2026-08-31): audio do Discord vazando na transmissao de quem usa Windows 10
- Um amigo do grupo usa WINDOWS 10. Quando ele transmitia, o usuario ouvia a PROPRIA VOZ do Discord pela transmissao dele: o audio capturado carregava o Discord junto, nao so o app compartilhado.
- Quando o USUARIO (Windows 11) transmitia, o amigo NAO ouvia o Discord dele. Assimetria por sistema operacional.
- Leitura preliminar (A CONFIRMAR NO CONTEXT, nao tratar como fato): a exclusao de audio por processo da feature app-audio-capture pode nao funcionar no Windows 10, caindo em captura do sistema inteiro. Conferir qual API o app usa e qual o requisito minimo de versao do Windows dela.
- HIPOTESE DO USUARIO (nao confirmada): o estalinho pode acontecer so com transmissor Windows 10.
- HIPOTESE DERRUBADA (2026-08-31, na mesma conversa): os estalinhos foram ouvidos em OUTRA transmissao, nao na do amigo de Win10, e esse amigo NEM PARTICIPOU do uso do fim de semana (entrou uma unica vez, numa demo, quando o vazamento do Discord foi percebido). Portanto o estalo acontece com transmissor Windows 11 e os dois problemas sao INDEPENDENTES.
- So esse amigo usa Windows 10 no grupo; o resto e Windows 11.

### Relato adicional 2 (2026-08-31): jogo sem audio na transmissao de um amigo, YouTube com audio, NA MESMA transmissao
- Um amigo transmitia a tela mostrando um JOGO e o audio do jogo NAO saia na transmissao. Na MESMA transmissao, sem mudar nada, ele saia do jogo e abria YouTube: o audio do YouTube saia normalmente.
- Ele tentou o jogo em modo janela, tela cheia e janela sem bordas: nenhum modo fez o som do jogo sair.
- Quando o USUARIO transmitiu o MESMO jogo, o som saiu normal.
- 2026-08-31, dado que fecha o lado: NINGUEM na call ouvia o jogo dele (nao era so o usuario), e quando o usuario transmitiu o mesmo jogo TODOS ouviram, inclusive esse amigo. O defeito e 100% do lado da CAPTURA na maquina do amigo; nenhum receptor esta implicado.
- O amigo em questao e de Windows 11 (nao e o amigo do Win10), ouvia o jogo normalmente na propria maquina, e usa so fone pelo que o usuario sabe.
- Leitura: a captura de audio em si funcionava naquela transmissao (YouTube passou). O que falhou foi ESPECIFICAMENTE o audio daquele jogo naquela maquina. Modo de janela ja foi descartado como fator pelo proprio amigo.
- HIPOTESES CANDIDATAS (nenhuma confirmada; dependem de como a captura funciona, ver CONTEXT):
  (a) o jogo do amigo saindo por OUTRO dispositivo de saida (fone/placa diferente, ou roteamento por app nas configuracoes de som do Windows); se a captura de loopback ouve so o dispositivo padrao, o jogo fica fora do mix enquanto o navegador segue o padrao;
  (b) audio do jogo em modo EXCLUSIVO do WASAPI, que passa por fora do mix compartilhado que o loopback captura;
  (c) o jogo tocando audio por um PROCESSO diferente do capturado, se a captura for por processo.
- FALTA SABER: qual amigo era (o de Win10 ou outro), se ele ouvia o jogo normalmente na maquina dele, e se ele tem mais de um dispositivo de saida / roteamento por app configurado.

### Logs da sessao de fim de semana analisados (2026-08-31, maquina do usuario)
- zoi-2026-08-30.log (442KB, a sessao longa): 4482 INFO, 23 WARN, 5 ERROR.
- ZERO linha sobre audio no log inteiro: nenhuma ocorrencia de "audio", "opus" ou "som". As categorias existentes sao [codec] (940 linhas, SO video: codec/impl/quadros), [player] (primeiro quadro), [pointer], [ice], [door], [session], [app], [media].
- CONSEQUENCIA: o app hoje nao tem NENHUMA observabilidade de audio. Impossivel correlacionar os estalos com evidencia de log. Qualquer diagnostico serio provavelmente comeca por instrumentar as stats de audio do WebRTC no receptor (inbound-rtp audio: concealedSamples, concealmentEvents, jitter, packetsLost, insertedSamplesForDeceleration/removedSamplesForAcceleration), que separam "estalo nascido na rede/concealment" de "estalo ja nascido na captura do transmissor".
- Os WARN/ERROR do dia sao todos de ICE/sinalizacao (quedas pontuais com recuperacao), nada correlacionavel com audio sem timestamps dos estalos.

## 8. Casos de borda

- Jogo/app aberto DEPOIS de a transmissao comecar (testa o caminho de deteccao por evento + poll do Reconcile; cruza com U13).
- Sessao de audio em dispositivo/role fora do endpoint padrao do Windows (invisivel a enumeracao atual; candidata a causa do jogo mudo).
- App com audio em modo EXCLUSIVO do WASAPI (invisivel aos dois modos de captura; nao tratado hoje em lugar nenhum).
- Cascata de degradacao no MEIO da transmissao (process-exclusion caindo para endpoint-loopback com a track ja no ar; a identidade da track nunca muda e o espectador nao percebe a troca). CORRIGIDO 2026-08-31: existe toast de runtime para degraded-full-loopback e failed (RoomScreen.tsx:113-131, uma vez por estado por transmissao); o caso de borda passa a ser a EFICACIA desse aviso, nao a ausencia.
- Transmissor com CPU saturada (condicao real de campo, e exatamente quando o mixer nativo e as filas tendem a underrun/descarte; o rebaixamento de codec de video ja existe por causa disso).
- Sala cheia (5+ pessoas): mais sessoes WASAPI nascendo/morrendo (jogos, apps de voz), mais getStats, mais carga no main thread do renderer que hospeda o writeFrame de 10ms.
- Instrumentacao nao pode virar fonte de problema: log de descarte/underrun precisa de rate-limit (um estouro de fila a 100 frames/s nao pode gerar 100 linhas/s de log).

## 8b. Nota de regressao adicional
- Guarda e2e expectNoDirectionFallbacks intocavel; qualquer conserto que force redial/renegociacao herda esse risco.
- Toda execucao de Playwright MUDA (regra permanente do projeto: --mute-audio + soundVolume 0 via helper zoi-app.ts) - ironicamente relevante AQUI: testes e2e de audio precisam validar o caminho sem depender de ouvir som; a validacao auditiva e humana/manual.

## 9. UI reference

Modo: project-identity. Avisos novos ao transmissor (ex.: captura degradou para modo sistema-inteiro) seguem o padrao de TOAST atual do app, confirmado pelo usuario em 2026-08-31. Sem tela nova.

## 10. Prioridades

- Must: instrumentacao/observabilidade de audio (decisao explicita do usuario em 2026-08-31, vale independente do resto do escopo).
- Must: eliminar (ou reduzir a imperceptivel) os estalos no audio recebido.
- Must: vazamento Win10 (aviso ao transmissor quando degradar para sistema-inteiro). Confirmado no finalization pass (A1).
- Must: jogo mudo (diagnostico + conserto/aviso conforme causa). Confirmado no finalization pass (A1).
- Nota: nao ha regra quantitativa/posicional nesta feature que exija exemplo trabalhado; limiares de instrumentacao (rate-limit de log etc.) sao decisao tecnica do SPEC.

## 11. Assumptions confirmadas

Finalization pass de 2026-08-31, todas confirmadas explicitamente pelo usuario:
- A1: vazamento Win10 e jogo mudo sao MUST. A contradicao do questionario anterior (MUST + nice marcados juntos) esta RESOLVIDA: leitura forte confirmada. O MUST do vazamento e TRANSPARENCIA (avisar o transmissor do modo sistema-inteiro), nao fazer exclusao funcionar no Win10 (a API nao existe la).
- A2: criterio de pronto aceita VALIDACAO DE CAMPO DEPOIS da entrega para os itens que dependem das maquinas dos amigos (jogo mudo, vazamento no Win10 real, confirmacao do estalo sumido em sessao real), como nas duas features anteriores.
- A3: expectativa do estalo alinhada: o conserto ataca as fontes de clique PROVADAS no codigo + instrumentacao; se os dados de campo mostrarem outra causa (ex.: rede), vira follow-up com dado em maos, sem garantia de reproducao em bancada.
- A4: o usuario tem CERTEZA de que o estalo vinha do som do app (acompanhava a transmissao), nao da voz do Discord da call.

## 11b. Nota para o SPEC
- Se a causa do jogo mudo exigir enumerar sessoes ALEM do endpoint padrao (outro dispositivo/role), isso e EXTENSAO do desenho atual, permitida; "reescrever a arquitetura" do fora-de-escopo significa nao trocar o addon/mixer por outra abordagem, nao proibir estender a enumeracao.

## 12. Pontos em aberto (lista viva)

- P1: reproduzir/observar o estalo de forma controlada, ou ao menos correlacionar com evidencia (logs, stats WebRTC). Sem isso, qualquer conserto e chute.
- P2: o estalo acontece com transmissor especifico ou com qualquer um? 2026-08-31: usuario NAO LEMBRA se foi numa pessoa so. Irrespondivel por memoria; so instrumentacao ou nova sessao observada responde.
- P3: os outros do grupo tambem ouvem? (usuario nao perguntou ainda)
- P4: PARCIALMENTE FECHADO. Os logs foram analisados e NAO tem nada de audio (zero observabilidade). Vira insumo: o fix provavelmente precisa de uma etapa de instrumentacao antes de qualquer conserto.
- P5: o vazamento de audio do Discord na transmissao do amigo de Windows 10 e um segundo defeito real e INDEPENDENTE do estalo. Decisao do usuario (2026-08-31): decidir DEPOIS do CONTEXT se entra nesta feature ou vira ideia separada (se a camada de captura for vizinha, junta; senao separa).
- P6: FECHADO. Os estalos vieram de outra transmissao (transmissor Win11); o amigo de Win10 nao participou da sessao de fim de semana. Hipotese Win10-para-estalo derrubada.
- P7: FECHADO. So esse amigo usa Win10; o resto do grupo e Win11.
- P8: RESPONDIDO em parte (2026-08-31): NAO era o amigo de Win10 (e outro, de Win11); ele OUVIA o jogo normalmente na propria maquina; pelo que o usuario sabe ele usa SO fone (um dispositivo). O usuario acrescentou que ELE MESMO usa varias saidas de som e nunca teve esse problema. Isso enfraquece a hipotese (a) de dispositivo fisico diferente, e deixa mais fortes: modo exclusivo WASAPI, audio saindo por processo diferente do capturado, ou roteamento por app nas configuracoes do Windows (invisivel para o usuario comum).
- P9: o relato 2 entra nesta feature, na mesma decisao de escopo do P5, ou vira ideia separada? Os tres sintomas (estalo, vazamento Win10, jogo mudo) moram na mesma regiao (captura/caminho de audio), decidir apos o CONTEXT.
