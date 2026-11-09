---
feature: app-sounds-v2
language: pt-BR
type: change
mode: quick
status: done
created: 2026-11-09
---
# IDEA - app-sounds-v2 (quick)

## 1. Objetivo
Trocar os 7 efeitos sonoros do app pelos arquivos novos que o Pontin produziu em
`C:/Users/Usuario/Desktop/Trabalho/Ajuda com design/Sons Zoi da goiaba/games/m4a`.
Nas palavras dele: "quero abrir um quick aqui mesmo so pra vc trocar os efeitos sonoros do app".

## 2. Plano inline
1. Substituir, em `src/renderer/src/assets/audios/`, os 7 arquivos pelos novos de MESMO NOME:
   desconectado, entrou, erro-conexao, parou-transmissao, reconectado, saiu, transmitindo (.m4a).
2. Zero mudanca de codigo esperada: `src/renderer/src/services/sound-player.ts` importa os
   arquivos por nome e toca via `HTMLAudioElement` (`new Audio(url)`), que aceita qualquer
   sample rate/canais.
3. Conferir que nada em sound-player.ts ou em quem o chama assume duracao dos sons (os novos sao
   mais longos: ex. entrou 1,22 s vs 0,91 s; desconectado 2,83 s vs 2,36 s).
4. Verificacao proporcional: typecheck, suite unit do sound-player (e a suite inteira, e rapida),
   build, e um smoke MUDO em que cada um dos 7 arquivos empacotados carrega num
   HTMLAudioElement (evento canplaythrough) sem erro. Nenhum som fisico (ver LESSONS: efeito
   fisico so em forma silenciosa).
5. Um commit atomico, so os 7 arquivos, `git add` com caminhos explicitos.

## 3. Fatos conferidos (ffprobe)
- Novos: AAC, 44100 Hz, MONO. Duracoes: desconectado 2,83 s; entrou 1,22 s; erro-conexao 1,31 s;
  parou-transmissao 1,27 s; reconectado 2,34 s; saiu 1,74 s; transmitindo 1,87 s.
- Atuais: AAC, 96000 Hz, ESTEREO. Duracoes: 2,36 / 0,91 / 2,16 / 1,51 / 2,15 / 0,83 / 1,01 s.

## 4. Casos de borda
- Som mais longo sobrepondo o proximo (ex. "entrou" + "saiu" em sequencia rapida): o player ja
  usa cloneNode por toque, entao instancias convivem; so confirmar que nao ha corte/fila.
- Volume percebido diferente (mono 44,1 k vs estereo 96 k): decisao de design do Pontin; nao
  normalizar sem pedido.

## 5. Fora de escopo
- Qualquer mudanca em sound-player.ts, SettingsModal ou no volume dos sons (feature
  app-sounds-volume continua intacta).
- Nenhum outro arquivo do repo.

## 6. Regressao
- Volume dos sons do app nas configuracoes continua funcionando (nao tocado).
- Os 7 gatilhos (entrou/saiu/transmitindo/parou/desconectado/erro/reconectado) continuam
  disparando o som certo.
