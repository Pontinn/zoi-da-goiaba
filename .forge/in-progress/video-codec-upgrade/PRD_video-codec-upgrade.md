---
feature: video-codec-upgrade
language: pt-BR
created: 2026-08-26
---

# PRD - video-codec-upgrade

## Historico de Revisoes

| Data | Revisao | O que mudou |
|------|---------|--------------|
| 2026-08-26 | 1 | Criacao da PRD a partir da IDEA (Stage 1 fechada, P3/P4/P5 resolvidos, P1/P2/P6/P7 delegados a SPEC) e do CONTEXT tecnico. |
| 2026-08-26 | 2 | Fold das respostas do usuario as duas Questoes em Aberto da revisao 1: (1) confirmado que o escape manual "forcar compatibilidade/VP8" e a rede de seguranca para bug de driver de encoder de hardware, sem deteccao automatica nesta feature; a antiga `[ASSUMPTION]` virou decisao confirmada e ganhou o RF-22 `[WONT]` explicito. (2) verificacao de "sem regressao de fps" definida como log periodico por conexao (framesPerSecond + qualityLimitationReason) estendendo o stats-monitor ja existente, sem harness de benchmark novo; RNF-01 e AC-20 ficaram concretos nessa base, e o RF-21 novo cobre o log. Bloco de Questoes em Aberto zerado. Nenhum RF/RNF/AC anterior foi renumerado; RF-21 e RF-22 foram adicionados ao final da lista de RFs, e AC-28/AC-29 ao final da lista de ACs. |
| 2026-08-26 | 3 | Ajustes do review (forge-review, NEEDS-CHANGES, sem blockers): (WARNING) removido o unico travessao do arquivo (nota introdutoria da secao 4), trocado por dois-pontos. (WARNING) RF-14 e AC-15 reescritos de forma neutra quanto a P6: a maquina com o escape ligado sempre RECEBE VP8, seja por convergencia da sala inteira (RF-05) ou por escolha por conexao (mecanica delegada a SPEC), sem mais presumir codec por-espectador. (NIT) RF-18 e RF-19 (MUST) agora condicionados a "se o toggle de nitidez for entregue (RF-16)" para nao pendurar um MUST num SHOULD nao garantido. (NIT) RF-08 reescrito sem a palavra "renegociacao": a troca de fonte/preset e parada e reinicio da transmissao (CONTEXT secao 4), nao renegociacao SDP incremental. (NIT) AC-27 ganhou rastreabilidade explicita a RF-11, RNF-01 e RNF-05, alem da metrica de sucesso da secao 1. (NIT) RF-02 ganhou frase fixando o comportamento observavel de maquina sem nenhum encoder de hardware: nunca forcar codec pesado por software, em duvida permanece em VP8 (escolha fina VP9 vs VP8 por software fica para a SPEC). Nenhum RF/RNF/AC foi renumerado. |

## Baseline (ancora de drift)

- **HEAD**: `1e73ffa779cbce50ddd89f84543ccf663c847035`
- **Fingerprint IDEA_video-codec-upgrade.md** (git hash-object): `febc949c459df55f4f722b44fc5e46958722df18`
- **Fingerprint CONTEXT_video-codec-upgrade.md** (git hash-object): `d2c7b857fef567db36c5f1ab46204c00b67e02db`

---

## 1. Objetivo e Visao

**Problema**: a transmissao hoje negocia sempre VP8, o codec default do PeerJS e o mais antigo e menos eficiente do WebRTC. Isso tem dois efeitos negativos observados de fato pelo grupo: (a) a imagem compartilhada fica aquem do possivel no mesmo bitrate (o usuario perguntou como deixar a transmissao "mais bonita ainda"); e (b) em maquinas fracas ou notebooks antigos, codificar VP8 por SOFTWARE consome CPU a ponto de a transmissao TRAVAR (caso real: um amigo do grupo com notebook antigo trava o video ao transmitir porque a CPU nao da conta de capturar e codificar ao mesmo tempo).

**Para quem**: o grupo de amigos que usa o "Zoi da Goiaba" para compartilhar tela P2P, tanto no papel de transmissor (quem compartilha) quanto de espectador (quem assiste).

**Por que agora**: esta feature foi decidida deliberadamente depois da `black-screen-notice` (ja concluida), que entrega um instrumento de diagnostico (log de tempo-ate-primeiro-quadro do lado do espectador) para esta mudanca mais arriscada nao ser testada as cegas. Os pilares do projeto (performance do app + qualidade da tela compartilhada) sao exatamente o eixo desta feature.

**Impacto esperado**: qualidade de imagem percebida igual ou melhor no mesmo bitrate para quem tem maquina forte; reducao de travamento para quem transmite de maquina fraca (uso de encoder por hardware quando disponivel); nenhuma regressao de fluidez, de compatibilidade com clientes de versao antiga, ou dos fallbacks de direcao ja estabilizados em campo. Objetivo duplo confirmado pelo usuario: "mais bonito no mesmo bitrate" E "menos travamento em maquina fraca ao transmitir" sao ambos criterio de aceitacao, lado a lado.

**Metrica de sucesso** (decisao do usuario, 2026-08-26): apos a implementacao, os logs devem mostrar, por maquina/conexao, o codec negociado e o `encoderImplementation` (hardware ou software); nenhuma maquina deve apresentar regressao de fps/travamento nem `qualityLimitationReason` igual a `'cpu'` de forma persistente. Em complemento (parte subjetiva, mas explicitamente exigida pelo usuario como criterio): uma sessao real do grupo, com pessoas de verdade e maquinas de verdade, precisa confirmar qualidade igual ou melhor do que hoje.

**Diretriz de desempate (UX-first)**: nas decisoes autonomas que restarem no pipeline (SPEC/implementacao), vale o criterio ja usado nas features anteriores do projeto: escolher sempre o que beneficia a experiencia do usuario, sem atrapalhar, sem complicar e sem perder qualidade.

## 2. Publico-Alvo (Personas)

- **Transmissor com PC forte**: maquina com encoder de hardware disponivel para codec moderno (ex.: AV1). Quer a melhor qualidade de imagem possivel no bitrate do preset escolhido, sem custo de CPU adicional perceptivel.
- **Transmissor com notebook fraco (caso real do grupo)**: maquina antiga onde codificar em software (mesmo VP8) ja e pesado; tipicamente tem encoder de video por HARDWARE (ex.: Intel QuickSync/H264) disponivel. Para esta persona, fluidez (nao travar) importa mais do que a imagem mais bonita possivel; e quem hoje trava ao transmitir e o motivador direto desta feature.
- **Espectador com notebook fraco (lado de decodificacao)**: assiste a transmissao de outra pessoa numa maquina que nao decodifica bem todo codec moderno. A escolha de codec do transmissor precisa considerar esta persona: a sala tem, pelo menos as vezes, alguem nessa situacao, e a escolha de codec do transmissor nao pode ignora-la.

## 3. Escopo

**Dentro do escopo:**
- Preferencia de codec de video aplicada nas chamadas de midia, incluindo o caminho da chamada reversa (pull), onde o espectador e quem oferta e o transmissor responde com a stream real.
- Escolha de codec por MAQUINA, considerando disponibilidade real de encoder de hardware (nunca uma preferencia global fixa).
- Escolha de codec considerando a SALA TODA: o transmissor escolhe um codec que sirva a todos os membros presentes, com base no que cada um anuncia decodificar bem.
- Fallback limpo para VP8 quando o outro lado nao suporta/nao anuncia preferencia de codec (par de versao antiga).
- Rebaixamento automatico de codec quando o transmissor mede `qualityLimitationReason` `'cpu'` persistente, reusando a mecanica de watchdog/redial ja existente.
- Escape manual "forcar modo compatibilidade/VP8" nas Configuracoes, persistido entre sessoes, valendo tanto para TRANSMITIR (forca VP8 no encode) quanto para RECEBER (anuncia "so VP8" para a sala, influenciando o que o transmissor manda para essa maquina).
- Toggle "modo nitidez" no fluxo de transmissao (TransmittingBar), alternavel ao vivo, sem persistencia entre sessoes.
- Log do codec negociado + `encoderImplementation` (hardware/software) por conexao, como base do criterio de aceitacao.

**Fora do escopo / NAO fazer:**
- TURN ou qualquer infraestrutura de rede nova.
- Presets de qualidade (resolucao/fps/bitrate teto): ja resolvidos na feature `hq-presets`, nao mexer aqui.
- Audio: fora do escopo desta feature.
- Simulcast ou SFU: o transmissor continua codificando N copias, uma por espectador; nenhuma mudanca de arquitetura de fanout.
- Qualquer regressao dos fallbacks de direcao estabilizados em campo (mesh race-to-open, media pull, dial-back de admissao) ou do watchdog de midia existente: esta feature muda O QUE e negociado (codec), nunca a mecanica de conexao/reconexao em si.
- Deteccao automatica de bug de driver de encoder de hardware (tela preta/artefatos por driver defeituoso): a mitigacao para esse caso e o escape manual "forcar VP8" (ver RF-20); nao ha deteccao automatica desse cenario especifico nesta feature.

## 4. Requisitos Funcionais

Nota: os requisitos abaixo valem igualmente para qualquer membro da sala (dono ou membro), sem matriz de permissoes (IDEA secao 5): a escolha de codec e automatica/por maquina, e o modo nitidez e local ao transmissor.

**Escolha automatica de codec (por maquina e para a sala)**

- **RF-01** [MUST] O sistema deve aplicar uma preferencia de codec de video na negociacao de midia do transmissor, tanto na chamada de saida (transmissor liga para o espectador) quanto na chamada reversa/pull (espectador liga, transmissor responde com a stream real).
- **RF-02** [MUST] A escolha de codec deve ser feita por MAQUINA, com base na disponibilidade real de encoder de video por hardware naquela maquina; o sistema nunca deve usar uma preferencia de codec fixa/global. Numa maquina sem nenhum encoder de hardware disponivel, o sistema nunca deve forcar um codec pesado por software: em duvida, a maquina permanece em VP8 (a escolha fina entre VP9 e VP8 por software nessa maquina fica para a SPEC).
- **RF-03** [MUST] Em maquina com encoder de hardware para codec moderno disponivel (ex.: AV1) e sem indicio de limitacao de CPU, o transmissor deve usar esse codec (exemplo trabalhado da IDEA: PC forte com encoder AV1 por hardware transmite AV1).
- **RF-04** [MUST] Quando fluidez e qualidade de imagem entram em conflito numa maquina fraca, a fluidez deve vencer: o sistema deve preferir um codec com encoder de HARDWARE mesmo que um codec por SOFTWARE renderizasse imagem melhor por bit (exemplo trabalhado da IDEA: notebook antigo com encoder H264 por hardware (QuickSync) transmite em H264 por hardware, e nao em VP9 por software, mesmo que VP9 por software fosse teoricamente mais bonito por bit).
- **RF-05** [MUST] A escolha de codec do transmissor deve considerar a sala inteira: o transmissor deve escolher um codec que sirva a todos os membros presentes, com base no que cada membro anuncia decodificar bem, e nao apenas na propria capacidade do transmissor (exemplo trabalhado da IDEA: transmissor forte com encoder AV1 por hardware, mas com um espectador de notebook fraco que so decodifica bem H264/VP8 na sala: o transmissor NAO usa AV1 para essa sala; escolhe o melhor codec que todos os presentes decodificam bem).
- **RF-06** [MUST] Um membro que nao anuncia capacidade de decodificacao (ex.: versao antiga do app, sem esse anuncio) deve ser tratado, para efeito da escolha de codec da sala, como se so decodificasse bem VP8, garantindo fallback seguro sem exigir que o membro antigo participe do anuncio.
- **RF-07** [MUST] Ao negociar com um par que nao suporta ou nao anuncia nenhuma preferencia de codec (par de versao antiga do app), a negociacao deve cair para VP8 sem falha visivel para nenhum dos dois lados.
- **RF-08** [MUST] A troca de fonte/preset (parada e reinicio da transmissao) mantem a regra de escolha de codec: a escolha e recalculada para a nova transmissao pelas mesmas regras (RF-02 a RF-06), sem herdar uma escolha divergente da transmissao anterior nem exigir passo manual do usuario.
- **RF-09** [MUST] Se o transmissor medir `qualityLimitationReason` igual a `'cpu'` de forma PERSISTENTE (nao pontual/flutuante) durante a transmissao, o sistema deve trocar automaticamente para um codec mais leve e rediscar, reusando a mecanica de watchdog/redial ja existente no projeto.
- **RF-10** [MUST] O rebaixamento automatico de RF-09 nao deve disparar nenhum dos marcadores de log vigiados pelo teste `expectNoDirectionFallbacks` (`media-pull`, `dialback`, `discando de volta`, `na outra direcao`) fora de um fallback de direcao real; o rebaixamento de codec e uma causa diferente de redial e nao deve ser confundido com fallback de direcao nos logs.
- **RF-11** [MUST] O sistema deve registrar, para cada conexao de midia, o codec efetivamente negociado e o `encoderImplementation` (hardware ou software) daquela conexao, servindo de base verificavel para o criterio de aceitacao desta feature.

**Escape manual "forcar compatibilidade/VP8" (Configuracoes)**

- **RF-12** [MUST] A tela de Configuracoes deve oferecer um controle "forcar modo compatibilidade/VP8", persistido em disco (sobrevive a reinicio do app).
- **RF-13** [MUST] Quando o escape estiver ligado, a maquina deve transmitir sempre em VP8, independente da capacidade de hardware detectada (RF-02 a RF-04 ficam suspensos para essa maquina enquanto o escape estiver ativo).
- **RF-14** [MUST] Quando o escape estiver ligado, a maquina deve se anunciar para a sala como aceitando apenas VP8 na recepcao; ao aplicar RF-05/RF-06, o resultado observavel deve ser que essa maquina sempre RECEBE VP8, seja porque a sala inteira converge para VP8 (codec unico servindo a todos, RF-05) ou porque a escolha e feita por conexao individual (mecanica que fica para a SPEC decidir, P6).
- **RF-15** [MUST] A tela de Configuracoes deve mostrar o valor atual do escape (ligado/desligado) ao ser aberta, refletindo o que foi persistido, inclusive apos reiniciar o app (ida e volta completa: define, fecha o app, reabre, ve o mesmo valor).

**Modo nitidez (TransmittingBar)**

- **RF-16** [SHOULD] A barra de transmissao (TransmittingBar) deve oferecer um toggle "modo nitidez", visivel enquanto a transmissao estiver ativa.
- **RF-17** [SHOULD] Alternar o modo nitidez deve ter efeito imediato na transmissao em andamento (contentHint passa a `'detail'` e degradationPreference passa a priorizar resolucao, no espirito de leitura/codigo/imagem parada), sem parar ou reiniciar a transmissao.
- **RF-18** [MUST] Se o toggle de nitidez for entregue (RF-16), entao desligar o modo nitidez deve restaurar o comportamento atual do projeto (contentHint `'motion'`, prioridade de fluidez), tambem sem parar a transmissao.
- **RF-19** [MUST] Se o toggle de nitidez for entregue (RF-16), entao o modo nitidez nunca deve persistir entre sessoes: toda nova transmissao deve comecar com o modo nitidez desligado, independente do valor escolhido numa transmissao anterior.

**Casos de borda**

- **RF-20** [MUST] O escape "forcar compatibilidade/VP8" (RF-12 a RF-15) deve servir como caminho de mitigacao para o caso de um encoder de hardware com bug de driver (ex.: tela preta ou artefatos visuais causados pelo driver): ligar o escape naquela maquina deve eliminar o uso do encoder de hardware problematico, sem exigir nenhuma deteccao automatica desse bug especifico.
- **RF-21** [MUST] O sistema deve registrar, periodicamente e por conexao (reusando o coletor de estatisticas ja existente no projeto, RNF-07), o `framesPerSecond` efetivo e o `qualityLimitationReason` correntes daquela conexao, servindo de base observavel para verificar ausencia de regressao de fps (RNF-01) e ausencia de limitacao de CPU persistente (RNF-05) sem depender de nenhum harness de benchmark dedicado.
- **RF-22** [WONT] Esta feature nao inclui deteccao automatica de bug de driver de encoder de hardware (ex.: reconhecer sozinho um padrao de tela preta/artefato causado por driver e reagir). A rede de seguranca para esse cenario e exclusivamente o escape manual "forcar compatibilidade/VP8" (RF-12 a RF-15, RF-20): o espectador percebe o sintoma via o aviso ja entregue pela feature `black-screen-notice` e a pessoa afetada liga o escape nas Configuracoes. Decisao do usuario, 2026-08-26.

## 5. Requisitos Nao-Funcionais

- **RNF-01** [MUST] Nenhuma maquina deve apresentar regressao de fps de transmissao em relacao ao comportamento atual (baseline VP8), no mesmo hardware e no mesmo preset de qualidade. A verificacao dessa nao-regressao e observavel: log periodico por conexao de `framesPerSecond` e `qualityLimitationReason` (RF-21), estendendo o stats-monitor ja existente, sem nenhum harness de benchmark dedicado novo; a comparacao antes/depois acontece na sessao real do grupo ja prevista na metrica de sucesso (secao 1).
- **RNF-02** [MUST] Nao deve haver regressao dos fallbacks de direcao ja estabilizados em campo (mesh race-to-open, media pull, dial-back de admissao) nem do watchdog de midia existente; o teste e2e `expectNoDirectionFallbacks` deve continuar passando.
- **RNF-03** [MUST] O sistema deve manter compatibilidade com a versao anterior do app: a negociacao de midia com um par rodando a versao anterior deve continuar funcionando (cai para VP8, RF-07), sem quebrar a conexao nem exigir atualizacao simultanea dos dois lados.
- **RNF-04** [MUST] Esta feature nao deve introduzir nenhum trabalho por-quadro (per-frame): a escolha e aplicacao de codec acontece no momento da negociacao/renegociacao de uma conexao, nao a cada quadro de video capturado ou renderizado.
- **RNF-05** [MUST] Nenhuma maquina deve apresentar `qualityLimitationReason` igual a `'cpu'` de forma persistente apos a escolha de codec se estabilizar naquela maquina (fora da janela transitoria de deteccao/rebaixamento de RF-09).
- **RNF-06** [MUST] Qualquer extensao de protocolo necessaria para o anuncio de capacidade de decodificacao (RF-05/RF-06) deve ser aditiva (campo novo opcional), nunca alterando um enum fechado ja validado (ex.: `PresetId`), preservando compatibilidade com clientes de versao antiga que ignoram o campo novo.
- **RNF-07** [MUST] Nenhuma segunda estrutura de coleta/polling de estatisticas de midia deve ser criada em paralelo ao coletor ja existente no projeto; qualquer leitura nova de `encoderImplementation`/`qualityLimitationReason` deve estender a coleta ja existente, nunca abrir um segundo laco concorrente de `getStats()`.
- **RNF-08** [MUST] Toda string de UI nova (escape de compatibilidade, toggle de nitidez) deve estar em portugues (pt-BR), sem caracteres acentuados e sem travessao, seguindo a convencao ja usada no projeto.
- **RNF-09** [MUST] A suite de testes completa do projeto (typecheck, lint, `npx vitest run`, `npm run test:e2e`) deve continuar passando (verde) apos a implementacao desta feature.

## 6. Criterios de Aceitacao

- **AC-01** (RF-01, RF-07): Dado um transmissor iniciando uma chamada de saida para um espectador, quando a negociacao de midia completa, entao o log da conexao mostra um codec negociado (nao necessariamente VP8) e nenhuma falha visivel ocorre.
- **AC-02** (RF-01): Dado um cenario de fallback de direcao onde o espectador disca por pull (chamada reversa) e o transmissor responde, quando a negociacao completa, entao a preferencia de codec tambem foi aplicada nesse sentido (nao apenas na chamada direta).
- **AC-03** (RF-02, RF-03, exemplo IDEA): Dado um PC forte com encoder de hardware AV1 disponivel e sem indicio de limitacao de CPU, quando esse PC transmite, entao o codec negociado e AV1.
- **AC-04** (RF-02, RF-04, exemplo IDEA): Dado um notebook antigo com encoder H264 por hardware (QuickSync) disponivel, quando esse notebook transmite, entao o codec negociado e H264 por hardware, mesmo que VP9 por software estivesse disponivel como alternativa.
- **AC-05** (RF-05, exemplo IDEA): Dado um transmissor com encoder AV1 por hardware e uma sala com um espectador cuja maquina so decodifica bem H264/VP8, quando o transmissor inicia a transmissao para essa sala, entao o codec negociado para toda a sala NAO e AV1, e sim um codec que o espectador fraco decodifica bem.
- **AC-06** (RF-06): Dado um membro da sala rodando uma versao antiga do app que nao anuncia capacidade de decodificacao, quando o transmissor calcula o codec da sala, entao esse membro e tratado como suportando apenas VP8 para efeito da escolha.
- **AC-07** (RF-07, RNF-03): Dado um par rodando a versao anterior do app (sem suporte a preferencia de codec), quando a negociacao de midia acontece com ele, entao a chamada completa normalmente em VP8, sem erro visivel para nenhum dos dois lados.
- **AC-08** (RF-08): Dado uma transmissao em andamento onde o usuario troca de fonte ou de preset, quando a nova transmissao inicia, entao a escolha de codec e recalculada pelas mesmas regras (nao herda uma escolha divergente da transmissao anterior, nem exige acao manual extra do usuario).
- **AC-09** (RF-09): Dado um transmissor cujo `getStats()` mostra `qualityLimitationReason` `'cpu'` de forma persistente, quando essa condicao e detectada, entao o sistema troca para um codec mais leve e redisca usando a mecanica de watchdog/redial existente.
- **AC-10** (RF-09): Dado o mesmo cenario de AC-09, quando a condicao de CPU e apenas pontual/flutuante (nao persistente), entao o sistema NAO troca de codec nem redisca (evita flapping).
- **AC-11** (RF-10): Dado o rebaixamento automatico de codec disparando (AC-09), quando os logs da execucao sao inspecionados, entao nenhuma das marcas vigiadas por `expectNoDirectionFallbacks` (`media-pull`, `dialback`, `discando de volta`, `na outra direcao`) aparece por causa desse rebaixamento.
- **AC-12** (RF-11): Dado qualquer conexao de midia estabelecida (transmissao direta ou pull), quando a conexao completa, entao existe uma linha de log com o codec negociado e o `encoderImplementation` (hardware ou software) daquela conexao.
- **AC-13** (RF-12, RF-15): Dado o usuario abrindo a tela de Configuracoes, quando ele liga o escape "forcar compatibilidade/VP8", fecha o app e reabre, entao a tela de Configuracoes mostra o escape ainda ligado.
- **AC-14** (RF-13): Dado o escape "forcar compatibilidade/VP8" ligado numa maquina, quando essa maquina transmite, entao o codec negociado e sempre VP8, mesmo que essa maquina tenha encoder de hardware para outro codec disponivel.
- **AC-15** (RF-14, RF-05): Dado o escape "forcar compatibilidade/VP8" ligado numa maquina espectadora, quando outra pessoa da sala transmite, entao essa maquina espectadora sempre RECEBE video em VP8, seja porque a sala inteira converge para VP8 (codec unico, RF-05) ou porque a escolha e feita por conexao individual (mecanica delegada a SPEC, P6).
- **AC-16** (RF-16, RF-17): Dado uma transmissao ativa, quando o usuario liga o modo nitidez na TransmittingBar, entao o efeito (prioridade de nitidez sobre fluidez) aplica-se imediatamente, sem interrupcao visivel da transmissao.
- **AC-17** (RF-18): Dado o modo nitidez ligado durante uma transmissao ativa, quando o usuario desliga o toggle, entao o comportamento volta ao padrao atual do projeto (prioridade de fluidez), sem interrupcao visivel da transmissao.
- **AC-18** (RF-19): Dado uma transmissao encerrada com o modo nitidez ligado, quando uma nova transmissao e iniciada (mesma sessao do app ou apos reiniciar o app), entao o modo nitidez comeca desligado.
- **AC-19** (RF-20): Dado uma maquina com encoder de hardware apresentando bug de driver (sintoma: tela preta ou artefatos no lado de quem assiste), quando o usuario liga o escape "forcar compatibilidade/VP8" nela, entao essa maquina passa a transmitir em VP8 e o sintoma associado ao encoder de hardware deixa de ocorrer.
- **AC-20** (RNF-01, RF-21): Dado o mesmo hardware e o mesmo preset de qualidade usados antes desta feature, quando a transmissao usa o novo codec escolhido, entao o `framesPerSecond` registrado no log periodico por conexao nao regride em relacao ao fps observado hoje em VP8, verificado por comparacao do log na sessao real do grupo (sem harness de benchmark dedicado).
- **AC-21** (RNF-02): Dado o conjunto de testes e2e apos a implementacao, quando ele roda em rede saudavel, entao `expectNoDirectionFallbacks` continua passando, sem nenhum fallback de direcao novo introduzido por esta feature.
- **AC-22** (RNF-04): Dado o pipeline de captura e codificacao de video apos a implementacao, quando revisado, entao nenhuma logica desta feature roda por-quadro (a decisao de codec acontece na negociacao/renegociacao, nao a cada frame).
- **AC-23** (RNF-05): Dado uma maquina apos a escolha de codec se estabilizar, quando o `getStats()` e observado ao longo da transmissao, entao `qualityLimitationReason` nao permanece `'cpu'` de forma persistente (fora da janela transitoria do proprio rebaixamento de RF-09).
- **AC-24** (RNF-06): Dado um cliente de versao antiga que nao entende o campo novo de anuncio de capacidade, quando ele recebe uma mensagem do protocolo com esse campo extra, entao ele continua processando a mensagem normalmente (campo extra ignorado, nenhum enum fechado existente foi alterado).
- **AC-25** (RNF-07): Dado o coletor de estatisticas ja existente no projeto, quando a leitura de `encoderImplementation`/`qualityLimitationReason` e adicionada, entao ela estende esse coletor em vez de abrir um segundo laco concorrente de `getStats()`.
- **AC-26** (RNF-08, RNF-09): Dado o texto novo introduzido (escape de compatibilidade, toggle de nitidez) e o pipeline de testes completo do projeto, quando ambos sao conferidos apos a implementacao, entao o texto esta em pt-BR sem acento e sem travessao, e typecheck/lint/vitest/e2e passam integralmente.
- **AC-27** (Metrica de sucesso, secao 1; RF-11; RNF-01; RNF-05): Dado o app em uso real pelo grupo apos a implementacao, quando os logs de codec negociado + `encoderImplementation` sao revisados por maquina, entao nenhuma maquina mostra regressao de fps/travamento nem `qualityLimitationReason` `'cpu'` persistente, e uma sessao real do grupo confirma qualidade igual ou melhor que a experiencia atual.
- **AC-28** (RF-21): Dado qualquer conexao de midia ativa, quando o log periodico do coletor de estatisticas ja existente e inspecionado, entao ele contem, por conexao, o `framesPerSecond` corrente e o `qualityLimitationReason` corrente, sem que um segundo laco de coleta paralelo tenha sido criado para isso.
- **AC-29** (RF-22): Dado um encoder de hardware com bug de driver causando tela preta/artefatos numa maquina, quando o cenario ocorre, entao o sistema nao tenta detectar ou reagir a isso automaticamente; a mitigacao esperada e o espectador perceber o sintoma pelo aviso da `black-screen-notice` e a pessoa afetada ligar manualmente o escape "forcar compatibilidade/VP8" (RF-20).

---

## Questoes em Aberto

Nenhuma questao em aberto restante. As duas questoes da revisao 1 foram respondidas pelo usuario em 2026-08-26 e incorporadas nesta revisao:

1. **Deteccao automatica de bug de driver de encoder de hardware**: RESOLVIDO. Decisao do usuario, 2026-08-26: o escape manual "forcar compatibilidade/VP8" e a rede de seguranca confirmada para esse cenario; NAO ha deteccao automatica de bug de driver nesta feature. O caminho esperado e o espectador perceber o sintoma pelo aviso ja entregue pela `black-screen-notice` e a pessoa afetada ligar o escape nas Configuracoes. Formalizado como RF-22 `[WONT]` (explicito, para rastreabilidade) e AC-29; a antiga `[ASSUMPTION]` da revisao 1 virou decisao confirmada.
2. **Metodologia objetiva de verificacao de "sem regressao de fps" (RNF-01/AC-20)**: RESOLVIDO. Decisao do usuario, 2026-08-26: usar o coletor de estatisticas ja existente no projeto (sem harness de benchmark novo), com log periodico por conexao de `framesPerSecond` e `qualityLimitationReason`; a comparacao antes/depois acontece na sessao real do grupo ja prevista na metrica de sucesso (secao 1). Formalizado como RF-21, com RNF-01 e AC-20 reescritos para ficarem concretos nessa base.

Os seguintes topicos que a propria IDEA aponta como nao decididos continuam tratados como delegados a SPEC (P1 no aspecto de deteccao/COMO, P2, P6 no aspecto de mecanica/custo, P7), conforme instrucao explicita da IDEA, e por isso nao sao questao em aberto desta PRD: (a) o metodo exato de deteccao de encoder de hardware e a API usada; (b) AV1 vs VP9 como alvo primario a ser medido nas maquinas reais do grupo; (c) o custo real de fanout (se o Chromium do Electron compartilha um encoder entre as N conexoes ou paga N vezes); (d) a mecanica fina do redial automatico (criterio exato de "persistente" para evitar flapping, alem do que RF-09/AC-10 ja fixam como comportamento observavel).
