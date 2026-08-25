---
feature: app-audio-capture
sprint: 1 (spike)
language: pt-BR
generated: 2026-08-25
machine: Windows 11 Pro 10.0.26200 x64
---

# SPIKE-RESULTS - app-audio-capture

Resultados REAIS da sonda do Sprint 1, rodada nesta maquina com
`node scripts/audio-probe.mjs`. Nada aqui e teoria: cada linha veio da saida do
probe, do `npm run dist` ou do binario empacotado.

## 0. Ambiente medido

| Item | Valor |
|---|---|
| Electron | 43.4.1 |
| Chromium | 150.0.7871.224 |
| Node (dentro do Electron) | 24.18.1 |
| Node (host) / npm | 24.18.0 / 11.17.0 |
| Windows | 10.0.26200 (muito acima do minimo 20348 do Process Loopback) |
| Arquitetura | x64 |
| Visual Studio | Community 2026 (18.9.1), MSVC 14.51.36231 |
| Windows SDK | 10.0.26100.0 (traz `audioclientactivationparams.h`) |
| node-gyp | 12.3.0 (embutido no npm 11; ja reconhece VS 2026) |

## 1. Veredito por item

| # | Pergunta | Resultado | Veredito |
|---|---|---|---|
| 1 | O Electron 43 consegue excluir a arvore de um processo de terceiro do loopback? | Recusa explicita: `audio must be a WebFrameMain, "loopback" or "loopbackWithMute"` | **CONFIRMADO** (nao consegue: o addon nativo e obrigatorio) |
| 2 | O WASAPI Process Loopback ativa nesta maquina? | `probe()` = `{ ok: true, error: null }` em 6-40 ms, no main E dentro do utilityProcess | **CONFIRMADO** |
| 3 | O renderer tem `MediaStreamTrackGenerator` usavel? | Construiu, escreveu um `AudioData` de 480 amostras, entrou num `MediaStream`, `readyState: 'live'` | **CONFIRMADO** |
| 4 | O transporte utilityProcess -> MessagePort -> renderer funciona? | Worker forkou, port chegou ao main world pelo preload, mensagem PCM de 3840 bytes recebida | **CONFIRMADO com uma correcao** (ver 4.2) |
| 5 | O addon atravessa `npm run dist` sem quebrar o NSIS? | Instalador, `latest.yml` e `.blockmap` gerados; `.node` em `app.asar.unpacked`; o app EMPACOTADO carrega o addon e o probe da `ok` | **CONFIRMADO** |
| 6 | Informativo: o Chromium do Electron aceita `restrictOwnAudio`? | Aceita (ver 5) | **CONFIRMADO** (mais forte do que o SPEC supunha) |

**Conclusao geral: a arquitetura do SPEC se sustenta.** Uma suposicao secundaria
caiu (transferencia de `ArrayBuffer` pelo MessagePort do Electron) e uma virou
oportunidade (`restrictOwnAudio` funciona de verdade). Nenhuma das duas muda o
desenho; as duas mudam TEXTO do SPEC.

## 2. Aposta central: o Electron nao exclui processo do loopback

Prova empirica, nao leitura de typings. O probe registrou o handler
`setDisplayMediaRequestHandler` cinco vezes, cada uma devolvendo um valor
diferente no campo `audio`, e chamou `getDisplayMedia` do renderer:

| Valor passado em `audio` | Erro no callback do main | getDisplayMedia |
|---|---|---|
| `'loopback'` | - | resolveu, 1 track de audio |
| `'loopbackWithMute'` | - | resolveu, 1 track de audio |
| `{ excludeProcessIds: [pid] }` | `audio must be a WebFrameMain, "loopback" or "loopbackWithMute"` | rejeitou (`Invalid capture constraints`) |
| `{ includeProcessIds: [pid] }` | `audio must be a WebFrameMain, "loopback" or "loopbackWithMute"` | rejeitou (`Invalid capture constraints`) |
| `'loopbackExcludeProcess'` (string arbitraria) | - | rejeitou (`Could not start audio source`) |

O proprio Electron enumera o conjunto aceito na mensagem de erro, e ele nao tem
nenhuma forma de filtro por processo. Confere com `node_modules/electron/electron.d.ts`
linha 23747 (`audio?: (('loopback' | 'loopbackWithMute')) | (WebFrameMain)`).
**A secao 2.1 do SPEC esta correta: sem addon nativo nao ha como tirar o Discord
do loopback.**

## 3. WASAPI Process Loopback (addon nativo)

`probe()` faz o teste honesto: `ActivateAudioInterfaceAsync` em
`VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK` com
`AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK`,
`TargetProcessId = GetCurrentProcessId()`,
`ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE`,
depois `IAudioClient::Initialize` (WAVEFORMATEX explicito float32/48 kHz/2ch,
`AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK`),
`SetEventHandle`, `GetService(IAudioCaptureClient)`, `Start` e `Stop`.

Resultado: `{ "ok": true, "error": null }`, entre 6 ms e 40 ms.

Detalhes que valem para o Sprint 2:

- A ativacao roda numa thread propria com COM em **MTA**. O handler de conclusao
  chega em thread arbitraria do WASAPI e nao pode depender do apartamento do
  Node; foi assim que o probe ficou estavel.
- O formato PRECISA ser explicito, como o SPEC ja antecipava: `GetMixFormat` nao
  e usavel nesse modo. Nao houve nenhum `E_NOTIMPL` porque o codigo nunca chama
  `GetMixFormat`.
- Nao foi preciso ter audio tocando: o `Start()` deu `S_OK` com o sistema em
  silencio, como o SPEC previa nas edge cases.
- O mesmo `probe()` deu `ok` DENTRO do `utilityProcess`, que e onde o motor do
  Sprint 2 vai rodar de verdade.

## 4. Transporte utilityProcess -> MessagePort -> renderer

Reproduzido o handshake inteiro do Sprint 3: `utilityProcess.fork` do worker,
`MessageChannelMain`, `port1` para o worker via `postMessage`, `port2` para o
renderer via `webContents.postMessage`, preload reemitindo com
`window.postMessage(..., '*', event.ports)` e o main world escutando `message`.

### 4.1 O que funcionou

- `forked: true`, `workerProbe: { ok: true }` (o addon nativo carrega dentro do
  utilityProcess).
- `portDeliveredToRenderer: true`: o port chegou ao mundo isolado do renderer.
- Frame de 3840 bytes (480 amostras x 2 canais x 4 bytes) recebido como
  `ArrayBuffer` de verdade (`isArrayBuffer: true`).
- A regra de ordem da secao 5.B do SPEC se confirma na pratica: o listener de
  `message` foi registrado ANTES do main postar o port; nao ha buffer.

### 4.2 SUPOSICAO REFUTADA: nao ha transferencia de ArrayBuffer

O SPEC (secao 5.C) descreve `data` como "um ArrayBuffer TRANSFERIDO (sem copia)".
**Isso nao existe no Electron.** Passar o buffer na lista de transferencia falha:

```
port.postMessage({ type: 'pcm', ... }, [arrayBuffer])
-> Error: "Port at index 0 is not a valid port"
```

O `MessagePortMain` do Electron so aceita `MessagePortMain` na lista de
transferencia; qualquer outra coisa e recusada. Enviar SEM lista de
transferencia funciona perfeitamente (o buffer e serializado por structured
clone, ou seja, **copiado**).

Impacto real: desprezivel. 3840 bytes a ~100 frames/s = ~384 KB/s de copia, com
o buffer descartado no mesmo tick. Nao ameaca o RNF-01. O que precisa mudar e o
TEXTO do SPEC (secao 5.C) e a implementacao do Sprint 3, que nao deve tentar
transferir (a excecao mataria o fluxo de audio a cada frame).

## 5. `restrictOwnAudio` (informativo, SPEC secao 3 item 3)

O SPEC anotou que o comportamento desse constraint no caminho
`setDisplayMediaRequestHandler` + `'loopback'` "nao e documentado" e decidiu nao
depender dele. Medido:

- `navigator.mediaDevices.getSupportedConstraints().restrictOwnAudio` = `true`
- `getDisplayMedia({ video: true, audio: { restrictOwnAudio: true } })` resolveu
  com 1 track de audio
- `track.getSettings().restrictOwnAudio` = `true` (o constraint foi APLICADO,
  nao ignorado)

Ou seja: o Chromium 150 do Electron aceita e aplica o constraint mesmo no
caminho de loopback do Electron. Isso NAO substitui o addon (nao remove o
Discord), mas e uma defesa extra de graca para o audio do PROPRIO Zoi no
caminho DEGRADADO (`endpoint-loopback` / `full-loopback`), onde hoje o loopback
total devolve o proprio som do app para dentro da transmissao. Fica registrado
como oportunidade para o Sprint 4 decidir; nao houve acoplamento nenhum agora.

## 6. Empacotamento (NSIS + auto-update)

`npm run dist` completo, com o addon dentro:

- `release/ZoiDaGoiaba-Setup.exe` gerado (~105 MB), `latest.yml` e
  `ZoiDaGoiaba-Setup.exe.blockmap` intactos: o auto-update nao foi afetado.
- `@electron/rebuild` reconstruiu `native/zoi-audio-capture` para o Electron 43
  antes de empacotar (`postinstall: electron-builder install-app-deps`).
- `asarUnpack: ['**/*.node']` colocou o binario em
  `resources/app.asar.unpacked/node_modules/zoi-audio-capture/build/Release/zoi_audio_capture.node`.
- **Teste no app EMPACOTADO** (nao so no dev): carregando o modulo pelo caminho
  de dentro do asar, o require e redirecionado para o unpacked e o probe devolve
  `{"ok":true,"error":null}`.
- Ajuste feito alem do SPEC: o `node-gyp` deixa ~1,1 MB de intermediarios
  (`obj/`, `.lib`, `.iobj`, `.ipdb`, projeto do MSBuild) ao lado do `.node`, e
  eles estavam viajando no instalador. Tres negacoes em `files` do
  `electron-builder.yml` derrubaram o payload nativo de 1,3 MB para 181 KB.

## 7. Toolchain nativa nesta maquina

- **MSVC**: ja estava pronto (VS Community 2026 com o workload C++, MSVC
  14.51.36231, Windows SDK 10.0.26100). Nenhum ajuste necessario.
- **Python**: NAO existia (so o alias da Microsoft Store, que nao serve). Foi
  instalado o **Python 3.12.10** via `winget install Python.Python.3.12
  --scope user` para o node-gyp funcionar. **Isto e um pre-requisito de maquina
  de dev e precisa entrar na documentacao da secao 9 do SPEC.**
- **electron-rebuild**: nao foi preciso rodar a mao. O `postinstall` com
  `electron-builder install-app-deps` cobre o `npm install` e o `npm run dist`.
- **Node-API**: o binario compilado contra o Electron 43 tambem carrega no Node
  24 do host (o probe do main roda em ambos), confirmando a promessa de ABI
  estavel do SPEC (trade-off 9).
- **Atencao (npm 11)**: o npm bloqueia scripts de install de pacotes que nao
  estejam em `allowScripts` do package.json. Sem a entrada
  `"zoi-audio-capture@0.1.0": true` o `node-gyp rebuild` do pacote e PULADO
  silenciosamente (com aviso). A entrada foi adicionada.

## 8. Achados de ferramenta (custaram tempo, ficam registrados)

1. **Electron 43 nao aceita um `.mjs` como entrada do processo main.** Passar
   `electron scripts/audio-probe.mjs` sobe a janela do app padrao e o script
   nunca roda (trava sem output). Um `.js` CJS equivalente roda normal. A sonda
   contorna com um bootstrap CJS temporario que faz `import()` dinamico. Isso
   nao afeta o app (o electron-vite ja emite CJS para o main), mas afeta
   qualquer script de diagnostico futuro.
2. **`ELECTRON_RUN_AS_NODE` herdado, mesmo vazio, quebra o `utilityProcess`**
   com `Assertion failed: (isolate_data->snapshot_data()) != nullptr`. O worker
   do Sprint 3 deve garantir que a variavel nao vaze para o fork.
3. **`about:blank` nao expoe `navigator.mediaDevices`** (nao e contexto seguro
   suficiente para o Chromium 150). A sonda carrega uma pagina `file://`. O app
   real ja usa `file://` em producao e `http://localhost` em dev: sem impacto.

## 9. O que o SPEC precisa mudar antes dos Sprints 2-4

1. **Secao 5.C**: remover a promessa de `ArrayBuffer` TRANSFERIDO. O protocolo
   segue igual (`{ type: 'pcm', timestampUs, data }`), mas por copia via
   structured clone, sem lista de transferencia. Custo medido: ~384 KB/s.
2. **Secao 9 / requisitos de maquina**: registrar Python 3.12 (instalado aqui
   via winget) e a entrada obrigatoria em `allowScripts` do npm 11.
3. **Secao 3, item 3 (`restrictOwnAudio`)**: atualizar de "comportamento nao
   documentado" para "aceito e aplicado no Chromium 150 do Electron", e decidir
   no Sprint 4 se o caminho degradado passa a usa-lo.
4. **Secao 2.2**: anotar o cuidado com `ELECTRON_RUN_AS_NODE` no fork do worker.

Nada disso muda a arquitetura. Os Sprints 2-4 podem seguir como planejados.
