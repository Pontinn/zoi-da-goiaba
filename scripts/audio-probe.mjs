// Sonda executavel do Sprint 1 (spike) da feature app-audio-capture.
//
// Transforma o veredito ESTATICO do SPEC (secao 2.1) em evidencia real nesta
// maquina. Responde cinco perguntas:
//   1. o WASAPI Process Loopback ativa de verdade? (addon nativo `probe()`)
//   2. o renderer do Electron 43 tem `MediaStreamTrackGenerator` usavel?
//   3. o transporte utilityProcess -> MessagePort -> renderer funciona?
//   4. o motor de exclusao realmente captura o permitido e nao captura o
//      proibido? (reproduz um SINAL INAUDIVEL num processo separado e mede o PCM)
//   5. informativo: o Chromium do Electron aceita `restrictOwnAudio`?
//
// A etapa 4 NAO produz som audivel: o sinal de teste e uma senoide de 1 Hz,
// muito abaixo da faixa da audicao humana e impossivel de um alto-falante
// reproduzir. Digitalmente ele e obvio (a media por bloco oscila ate a
// amplitude do sinal), enquanto qualquer audio de verdade tem media zero.
// NUNCA trocar por um tom audivel: esta e a maquina de trabalho do usuario.
//
// Rodar com `node scripts/audio-probe.mjs` (ou `npm run audio:probe`): fora do
// Electron o script se re-executa dentro do Electron, sem janela visivel, e
// imprime um JSON com os resultados brutos.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const selfPath = fileURLToPath(import.meta.url)

const PORT_CHANNEL = 'zoi:audio-exclusion-port'
const PCM_SAMPLES_PER_FRAME = 480
const PCM_CHANNELS = 2

/**
 * Fora do Electron: relanca este mesmo arquivo dentro do Electron.
 *
 * O Electron 43 NAO aceita um `.mjs` como entrada do processo main (a janela do
 * app padrao sobe e o script nunca roda), entao o bootstrap e um `.js` CJS
 * temporario que faz `import()` dinamico deste modulo.
 */
function relaunchInsideElectron() {
  const electronPath = require('electron')
  const env = { ...process.env }
  // A variavel liga o modo "electron como node puro" e quebra o utilityProcess.
  delete env.ELECTRON_RUN_AS_NODE

  const bootstrapDir = mkdtempSync(join(tmpdir(), 'zoi-audio-probe-boot-'))
  const bootstrapPath = join(bootstrapDir, 'main.js')
  writeFileSync(
    bootstrapPath,
    `const { pathToFileURL } = require('node:url')
import(pathToFileURL(${JSON.stringify(selfPath)}).href).catch((error) => {
  console.error(error)
  process.exit(1)
})
`,
    'utf8'
  )

  const child = spawn(electronPath, [bootstrapPath], { stdio: 'inherit', env })
  child.on('exit', (code) => {
    rmSync(bootstrapDir, { recursive: true, force: true })
    process.exit(code ?? 1)
  })
}

if (!process.versions.electron) {
  relaunchInsideElectron()
} else {
  await runInsideElectron()
}

async function runInsideElectron() {
  const {
    app,
    BrowserWindow,
    desktopCapturer,
    session,
    utilityProcess,
    MessageChannelMain
  } = require('electron')

  app.disableHardwareAcceleration()
  await app.whenReady()

  const results = {
    environment: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      arch: process.arch,
      osRelease: require('node:os').release()
    },
    wasapiProcessLoopback: null,
    trackGenerator: null,
    utilityProcessTransport: null,
    restrictOwnAudio: null,
    electronLoopbackSurface: null,
    captureEngine: null
  }

  step('sonda WASAPI (addon nativo)')
  results.wasapiProcessLoopback = probeNativeAddon()

  const scratchDir = mkdtempSync(join(tmpdir(), 'zoi-audio-probe-'))
  let window = null
  try {
    const preloadPath = join(scratchDir, 'probe-preload.js')
    writeFileSync(preloadPath, buildPreloadSource(), 'utf8')
    // Pagina em file:// (contexto seguro): em about:blank o Chromium nem
    // expoe `navigator.mediaDevices`.
    const pagePath = join(scratchDir, 'probe.html')
    writeFileSync(
      pagePath,
      '<!doctype html><meta charset="utf-8"><title>zoi audio probe</title>',
      'utf8'
    )

    window = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: { preload: preloadPath, sandbox: true, contextIsolation: true }
    })
    await window.loadFile(pagePath)

    step('sonda MediaStreamTrackGenerator (renderer)')
    results.trackGenerator = await guarded(
      window.webContents.executeJavaScript(buildTrackGeneratorProbe(), true),
      20000
    )

    step('sonda utilityProcess + MessagePort')
    results.utilityProcessTransport = await guarded(
      probeUtilityTransport({ utilityProcess, MessageChannelMain, window, scratchDir }),
      30000
    )

    step('sonda restrictOwnAudio (informativo)')
    results.restrictOwnAudio = await guarded(
      probeRestrictOwnAudio({ desktopCapturer, session, window }),
      30000
    )

    step('sonda o motor de captura (exclusao real de arvore)')
    results.captureEngine = await guarded(probeCaptureEngine(scratchDir), 180000)

    step('sonda a superficie de audio do setDisplayMediaRequestHandler')
    results.electronLoopbackSurface = await guarded(
      probeLoopbackSurface({ desktopCapturer, session, window }),
      30000
    )
  } catch (error) {
    results.fatal = String(error && error.stack ? error.stack : error)
  } finally {
    if (window && !window.isDestroyed()) {
      window.destroy()
    }
    rmSync(scratchDir, { recursive: true, force: true })
  }

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`)

  const failures = evaluate(results)
  process.stderr.write('\n[audio-probe] resumo\n')
  for (const check of failures.checks) {
    process.stderr.write(`  ${check.ok ? 'OK   ' : 'FALHA'} ${check.name}\n`)
  }
  if (failures.failed.length > 0) {
    process.stderr.write(
      `\n[audio-probe] ${failures.failed.length} verificacao(oes) reprovada(s). ` +
        'A invariante de seguranca (audio proibido nunca entra no mix) e o motivo ' +
        'deste script existir: NAO siga com o build sem entender a falha.\n'
    )
  }
  app.exit(results.fatal || failures.failed.length > 0 ? 1 : 0)
}

/**
 * Converte os resultados brutos em aprovacao/reprovacao. E o que transforma a
 * sonda de "relatorio para ler" em PORTAO: rodar `npm run audio:probe` depois de
 * mexer no motor nativo e sair com codigo 1 significa regressao.
 *
 * `machineWasQuiet` de proposito NAO entra: e informativo, e o discriminante de
 * sinal ja e imune a audio ambiente.
 */
function evaluate(results) {
  const value = (object, path) =>
    path.split('.').reduce((current, key) => (current == null ? undefined : current[key]), object)

  const checks = [
    { name: 'ativacao do WASAPI Process Loopback', ok: value(results, 'wasapiProcessLoopback.ok') },
    {
      name: 'MediaStreamTrackGenerator construido e alimentado',
      ok: Boolean(
        value(results, 'trackGenerator.constructed') && value(results, 'trackGenerator.wroteFrame')
      )
    },
    {
      name: 'transporte utilityProcess -> MessagePort -> renderer',
      ok: Boolean(
        value(results, 'utilityProcessTransport.portDeliveredToRenderer') &&
        (value(results, 'utilityProcessTransport.messagesReceived') ?? []).length > 0
      )
    },
    {
      name: 'motor captura o audio permitido',
      ok: value(results, 'captureEngine.verdict.captureWorks')
    },
    {
      name: 'arvore proibida por PID raiz fica FORA do mix',
      ok: value(results, 'captureEngine.verdict.rootPidExclusionWorks')
    },
    {
      name: 'arvore proibida por nome de executavel fica FORA do mix',
      ok: value(results, 'captureEngine.verdict.executableExclusionWorks')
    },
    {
      name: 'processo permitido que nasce durante a captura entra',
      ok: value(results, 'captureEngine.verdict.newAllowedProcessGetsCaptured')
    },
    {
      name: 'processo proibido que nasce durante a captura NAO entra',
      ok: value(results, 'captureEngine.verdict.newForbiddenProcessStaysOut')
    },
    {
      name: 'endpoint-loopback ignora as listas de exclusao',
      ok: value(results, 'captureEngine.verdict.endpointLoopbackIgnoresLists')
    },
    {
      name: 'frames continuos (silencio tambem sai)',
      ok: value(results, 'captureEngine.verdict.framesAreContinuous')
    },
    {
      name: 'sem vazamento de handle em 10 ciclos',
      ok: value(results, 'captureEngine.verdict.noHandleLeak')
    }
  ].map((check) => ({ ...check, ok: check.ok === true }))

  return { checks, failed: checks.filter((check) => !check.ok) }
}

/** Ativacao real do Process Loopback pelo addon nativo, no processo main. */
function probeNativeAddon() {
  const startedAt = Date.now()
  try {
    const addon = require('zoi-audio-capture')
    const probe = addon.probe()
    return { ...probe, elapsedMs: Date.now() - startedAt, loaded: true }
  } catch (error) {
    return {
      ok: false,
      error: `require-failed: ${error instanceof Error ? error.message : String(error)}`,
      elapsedMs: Date.now() - startedAt,
      loaded: false
    }
  }
}

function buildPreloadSource() {
  return `const { ipcRenderer } = require('electron')
ipcRenderer.on(${JSON.stringify(PORT_CHANNEL)}, (event) => {
  window.postMessage({ channel: ${JSON.stringify(PORT_CHANNEL)} }, '*', event.ports)
})
`
}

function buildWorkerSource(addonPath) {
  return `// Worker temporario do spike: espelha o handshake do Sprint 3.
const addonPath = ${JSON.stringify(addonPath)}

process.parentPort.on('message', (event) => {
  const message = event.data
  if (!message || message.type !== 'start') return

  let probe = null
  try {
    probe = require(addonPath).probe()
  } catch (error) {
    probe = { ok: false, error: 'require-failed: ' + String(error && error.message) }
  }
  process.parentPort.postMessage({ type: 'probe', probe })

  const port = event.ports[0]
  port.start()

  // O contrato do SPEC (secao 5.C) promete ArrayBuffer TRANSFERIDO. O
  // MessagePortMain do Electron so aceita MessagePortMain na lista de
  // transferencia, entao o spike mede as duas tentativas.
  const bytes = ${PCM_SAMPLES_PER_FRAME * PCM_CHANNELS * 4}
  let transferError = null
  try {
    const transferred = new ArrayBuffer(bytes)
    port.postMessage({ type: 'pcm', timestampUs: 0, data: transferred }, [transferred])
  } catch (error) {
    transferError = String(error && error.message ? error.message : error)
  }
  let copyError = null
  try {
    port.postMessage({ type: 'pcm-copy', timestampUs: 10000, data: new ArrayBuffer(bytes) })
  } catch (error) {
    copyError = String(error && error.message ? error.message : error)
  }
  process.parentPort.postMessage({ type: 'post', transferError, copyError })
})
`
}

/** Probe do renderer: MediaStreamTrackGenerator e as alternativas do SPEC. */
function buildTrackGeneratorProbe() {
  return `(async () => {
  const out = {
    hasMediaStreamTrackGenerator: typeof MediaStreamTrackGenerator !== 'undefined',
    hasMediaStreamTrackProcessor: typeof MediaStreamTrackProcessor !== 'undefined',
    hasVideoTrackGenerator: typeof VideoTrackGenerator !== 'undefined',
    hasAudioData: typeof AudioData !== 'undefined',
    hasAudioContext: typeof AudioContext !== 'undefined',
    hasCreateMediaStreamDestination:
      typeof AudioContext !== 'undefined' &&
      typeof AudioContext.prototype.createMediaStreamDestination === 'function',
    isSecureContext: window.isSecureContext,
    constructed: false,
    wroteFrame: false,
    trackKind: null,
    readyState: null,
    addedToStream: false,
    error: null
  }
  try {
    if (!out.hasMediaStreamTrackGenerator) {
      out.error = 'MediaStreamTrackGenerator indisponivel'
      return out
    }
    const generator = new MediaStreamTrackGenerator({ kind: 'audio' })
    out.constructed = true
    out.trackKind = generator.kind
    const writer = generator.writable.getWriter()
    const frame = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: ${PCM_SAMPLES_PER_FRAME},
      numberOfChannels: ${PCM_CHANNELS},
      timestamp: 0,
      data: new Float32Array(${PCM_SAMPLES_PER_FRAME * PCM_CHANNELS})
    })
    await writer.write(frame)
    out.wroteFrame = true
    const stream = new MediaStream([generator])
    out.addedToStream = stream.getAudioTracks().length === 1
    out.readyState = generator.readyState
    await writer.close()
  } catch (error) {
    out.error = String(error && error.message ? error.message : error)
  }
  return out
})()`
}

/** Handshake completo: worker -> MessagePort -> preload -> main world. */
async function probeUtilityTransport({ utilityProcess, MessageChannelMain, window, scratchDir }) {
  const result = {
    forked: false,
    workerProbe: null,
    portDeliveredToRenderer: false,
    transferredArrayBufferAccepted: null,
    transferError: null,
    copyError: null,
    messagesReceived: [],
    error: null
  }

  const workerPath = join(scratchDir, 'probe-worker.js')
  writeFileSync(workerPath, buildWorkerSource(require.resolve('zoi-audio-capture')), 'utf8')

  let child = null
  try {
    await window.webContents.executeJavaScript(
      `(() => {
        window.__zoiProbe = { portReceived: false, messages: [] }
        window.addEventListener('message', (event) => {
          if (!event.data || event.data.channel !== ${JSON.stringify(PORT_CHANNEL)}) return
          const port = event.ports[0]
          window.__zoiProbe.portReceived = true
          port.onmessage = (message) => {
            const payload = message.data || {}
            window.__zoiProbe.messages.push({
              type: String(payload.type),
              byteLength: payload.data ? payload.data.byteLength : -1,
              isArrayBuffer: payload.data instanceof ArrayBuffer
            })
          }
          port.start()
        })
        return true
      })()`,
      true
    )

    child = utilityProcess.fork(workerPath, [], { stdio: 'inherit' })
    await once(child, 'spawn', 5000)
    result.forked = true

    let resolveProbe = null
    let resolvePost = null
    const workerProbe = new Promise((resolve) => {
      resolveProbe = resolve
    })
    const workerPost = new Promise((resolve) => {
      resolvePost = resolve
    })
    child.on('message', (message) => {
      if (!message) return
      if (message.type === 'probe') resolveProbe(message.probe)
      if (message.type === 'post') resolvePost(message)
    })

    const channel = new MessageChannelMain()
    child.postMessage({ type: 'start' }, [channel.port1])
    window.webContents.postMessage(PORT_CHANNEL, { channel: PORT_CHANNEL }, [channel.port2])

    result.workerProbe = await withTimeout(workerProbe, 8000, 'worker nao respondeu o probe')
    const post = await withTimeout(workerPost, 8000, 'worker nao reportou o envio de PCM')
    result.transferError = post.transferError
    result.copyError = post.copyError
    result.transferredArrayBufferAccepted = post.transferError === null

    const rendererState = await pollRenderer(window, 8000)
    result.portDeliveredToRenderer = rendererState.portReceived
    result.messagesReceived = rendererState.messages
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  } finally {
    if (child) child.kill()
  }

  return result
}

/**
 * Informativo (SPEC secao 3, item 3): o Chromium do Electron aceita o constraint
 * `restrictOwnAudio` no caminho `setDisplayMediaRequestHandler` + 'loopback'?
 */
async function probeRestrictOwnAudio({ desktopCapturer, session, window }) {
  const result = {
    inSupportedConstraints: null,
    getDisplayMediaResolved: false,
    audioTracks: 0,
    appliedSetting: null,
    error: null
  }

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 }
    })
    const source = sources[0]
    if (!source) {
      result.error = 'nenhuma fonte de tela disponivel'
      return result
    }

    session.defaultSession.setDisplayMediaRequestHandler(
      (_request, callback) => callback({ video: source, audio: 'loopback' }),
      { useSystemPicker: false }
    )

    return await window.webContents.executeJavaScript(
      `(async () => {
        const out = {
          inSupportedConstraints: Boolean(
            navigator.mediaDevices.getSupportedConstraints().restrictOwnAudio
          ),
          getDisplayMediaResolved: false,
          audioTracks: 0,
          appliedSetting: null,
          error: null
        }
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: { restrictOwnAudio: true }
          })
          out.getDisplayMediaResolved = true
          out.audioTracks = stream.getAudioTracks().length
          const track = stream.getAudioTracks()[0]
          if (track) {
            const settings = track.getSettings()
            out.appliedSetting =
              'restrictOwnAudio' in settings ? String(settings.restrictOwnAudio) : 'ausente'
          }
          stream.getTracks().forEach((item) => item.stop())
        } catch (error) {
          out.error = String(error && error.message ? error.message : error)
        }
        return out
      })()`,
      true
    )
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    return result
  }
}

/** Progresso em stderr: o stdout carrega SO o JSON final. */
function step(label) {
  process.stderr.write(`[audio-probe] ${label}\n`)
}

/** Nenhuma etapa pode pendurar o spike: estouro vira resultado com `timeout`. */
async function guarded(promise, timeoutMs) {
  try {
    return await withTimeout(promise, timeoutMs, `etapa excedeu ${timeoutMs} ms`)
  } catch (error) {
    return { timedOut: true, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Exercicio REAL do motor nativo (Sprint 2). Um processo separado (powershell)
 * reproduz o sinal inaudivel de 1 Hz e a sonda mede o PCM entregue:
 *   - listas vazias: o sinal PRECISA aparecer (a captura funciona);
 *   - arvore proibida por PID raiz: o sinal NAO pode aparecer (deteccao por
 *     ancestralidade, que e exatamente o caso do Discord);
 *   - arvore proibida por nome de executavel: idem;
 *   - processo permitido/proibido que nasce COM a captura ja rodando;
 *   - endpoint-loopback: o sinal aparece mesmo com as listas (sao ignoradas).
 * Mede tambem a continuidade dos frames e vazamento de handles em 10 ciclos.
 */
async function probeCaptureEngine(scratchDir) {
  const addon = require('zoi-audio-capture')
  const tonePath = join(scratchDir, 'probe-signal.wav')
  writeSilentProbeWav(tonePath, 8, 0.25)

  const baseConfig = {
    excludedExecutables: [],
    excludedRootPids: [],
    sampleRate: 48000,
    channels: 2,
    frameMs: 10
  }

  const result = { discordRunning: listDiscordPids() }

  // Referencia de silencio: se a maquina ja estiver tocando alguma coisa, os
  // testes de exclusao ficam inconclusivos e isso precisa aparecer.
  result.baselineSilence = await captureFor(
    addon,
    { ...baseConfig, mode: 'process-exclusion' },
    1500
  )

  result.allowedTreeCaptured = await captureWhilePlaying(addon, tonePath, {
    ...baseConfig,
    mode: 'process-exclusion'
  })

  result.forbiddenByRootPid = await captureWhilePlaying(addon, tonePath, {
    ...baseConfig,
    mode: 'process-exclusion',
    excludedRootPids: [process.pid]
  })

  result.forbiddenByExecutable = await captureWhilePlaying(addon, tonePath, {
    ...baseConfig,
    mode: 'process-exclusion',
    excludedExecutables: ['powershell.exe']
  })

  result.endpointLoopback = await captureWhilePlaying(addon, tonePath, {
    ...baseConfig,
    mode: 'endpoint-loopback',
    excludedRootPids: [process.pid],
    excludedExecutables: ['powershell.exe']
  })

  result.allowedAppearsDuringCapture = await captureWithMidStart(addon, tonePath, {
    ...baseConfig,
    mode: 'process-exclusion'
  })

  result.forbiddenAppearsDuringCapture = await captureWithMidStart(addon, tonePath, {
    ...baseConfig,
    mode: 'process-exclusion',
    excludedExecutables: ['powershell.exe']
  })

  // So faz sentido se o Discord estiver rodando E tocando algo agora.
  result.discordExcluded =
    result.discordRunning.length > 0
      ? await captureFor(
          addon,
          {
            ...baseConfig,
            mode: 'process-exclusion',
            excludedExecutables: ['discord.exe', 'discordptb.exe', 'discordcanary.exe']
          },
          3000
        )
      : null

  result.startStopCycles = await runStartStopCycles(addon, {
    ...baseConfig,
    mode: 'process-exclusion'
  })

  // `signalLevel` (media absoluta por frame de 10 ms) e imune a musica ou voz
  // tocando na maquina: qualquer audio de verdade tem media zero, so o sinal
  // de 1 Hz produz media alta. Da para julgar mesmo com o PC fazendo barulho.
  const ambient = result.baselineSilence.signalLevel
  const withSignal = result.allowedTreeCaptured.signalLevel
  const floor = Math.max(ambient * 3, withSignal * 0.25, 0.01)
  result.verdict = {
    ambientSignalLevel: ambient,
    capturedSignalLevel: withSignal,
    detectionFloor: floor,
    machineWasQuiet: result.baselineSilence.rms < 0.005,
    captureWorks: withSignal > floor,
    rootPidExclusionWorks: result.forbiddenByRootPid.signalLevel < floor,
    executableExclusionWorks: result.forbiddenByExecutable.signalLevel < floor,
    endpointLoopbackIgnoresLists: result.endpointLoopback.signalLevel > floor,
    newAllowedProcessGetsCaptured: result.allowedAppearsDuringCapture.signalLevel > floor,
    newForbiddenProcessStaysOut: result.forbiddenAppearsDuringCapture.signalLevel < floor,
    framesAreContinuous: result.baselineSilence.frames >= 130,
    noHandleLeak:
      result.startStopCycles.handleDelta !== null && result.startStopCycles.handleDelta < 50
  }

  return result
}

/**
 * WAV PCM16 mono com uma senoide de 1 Hz: INAUDIVEL (abaixo dos 20 Hz da
 * audicao e da faixa fisica de qualquer alto-falante), mas trivial de detectar
 * no PCM porque a media por bloco curto acompanha a amplitude do sinal.
 */
function writeSilentProbeWav(path, seconds, amplitude) {
  const frequency = 1
  const sampleRate = 48000
  const frames = sampleRate * seconds
  const dataBytes = frames * 2
  const buffer = Buffer.alloc(44 + dataBytes)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataBytes, 40)
  for (let index = 0; index < frames; index += 1) {
    const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * amplitude
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2)
  }
  writeFileSync(path, buffer)
}

/** Reproduz o sinal num processo FILHO (logo, dentro da arvore desta sonda). */
function startTonePlayer(wavPath) {
  return spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$player = New-Object Media.SoundPlayer '${wavPath}'; $player.PlaySync()`
    ],
    { stdio: 'ignore', windowsHide: true }
  )
}

async function captureWhilePlaying(addon, wavPath, config) {
  const player = startTonePlayer(wavPath)
  // Deixa a sessao de audio do player existir antes de medir.
  await new Promise((resolve) => setTimeout(resolve, 1200))
  const stats = await captureFor(addon, config, 3000)
  player.kill()
  await new Promise((resolve) => setTimeout(resolve, 300))
  return stats
}

/**
 * O caso que mais importa: o processo aparece DEPOIS que a captura ja comecou
 * (e o cenario "Discord reaberto durante a transmissao"). Prova as redes de
 * OnSessionCreated e do vigia de 1 s.
 */
async function captureWithMidStart(addon, wavPath, config) {
  let player = null
  const stats = await captureFor(addon, config, 4500, () => {
    setTimeout(() => {
      player = startTonePlayer(wavPath)
    }, 1000)
  })
  if (player) player.kill()
  await new Promise((resolve) => setTimeout(resolve, 300))
  return stats
}

function captureFor(addon, config, durationMs, onStarted) {
  return new Promise((resolve, reject) => {
    const stats = {
      frames: 0,
      samples: 0,
      peak: 0,
      rms: 0,
      /** Maior media absoluta de um frame de 10 ms: assinatura do sinal de 1 Hz. */
      signalLevel: 0,
      firstTimestampUs: null,
      lastTimestampUs: null,
      statuses: []
    }
    let sumSquares = 0

    const onPcm = (data, timestampUs) => {
      const view = new Float32Array(data)
      stats.frames += 1
      stats.samples += view.length
      if (stats.firstTimestampUs === null) stats.firstTimestampUs = timestampUs
      stats.lastTimestampUs = timestampUs
      let sum = 0
      for (let index = 0; index < view.length; index += 1) {
        const value = view[index]
        const magnitude = value < 0 ? -value : value
        if (magnitude > stats.peak) stats.peak = magnitude
        sumSquares += value * value
        sum += value
      }
      const frameMean = Math.abs(sum / view.length)
      if (frameMean > stats.signalLevel) stats.signalLevel = frameMean
    }
    const onStatus = (state, detail) => {
      stats.statuses.push({ state, detail })
    }

    let handle
    try {
      handle = addon.start(config, onPcm, onStatus)
    } catch (error) {
      reject(error)
      return
    }

    if (onStarted) onStarted()

    setTimeout(() => {
      addon.stop(handle)
      stats.rms = stats.samples > 0 ? Math.sqrt(sumSquares / stats.samples) : 0
      resolve(stats)
    }, durationMs)
  })
}

/** 10 ciclos start/stop: um vazamento de handle apareceria como salto grande. */
async function runStartStopCycles(addon, config) {
  const before = readHandleCount(process.pid)
  for (let cycle = 0; cycle < 10; cycle += 1) {
    const handle = addon.start(
      config,
      () => {},
      () => {}
    )
    await new Promise((resolve) => setTimeout(resolve, 200))
    addon.stop(handle)
  }
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const after = readHandleCount(process.pid)
  return {
    cycles: 10,
    handlesBefore: before,
    handlesAfter: after,
    handleDelta: before !== null && after !== null ? after - before : null
  }
}

function readHandleCount(pid) {
  try {
    const output = execSync(
      `powershell.exe -NoProfile -NonInteractive -Command "(Get-Process -Id ${pid}).HandleCount"`,
      { encoding: 'utf8', windowsHide: true }
    )
    const value = Number.parseInt(output.trim(), 10)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function listDiscordPids() {
  try {
    const output = execSync(
      'powershell.exe -NoProfile -NonInteractive -Command "Get-Process discord* -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"',
      { encoding: 'utf8', windowsHide: true }
    )
    return output
      .split(/\s+/)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value))
  } catch {
    return []
  }
}

/**
 * Prova empirica da aposta central do SPEC (secao 2.1): o Electron aceita
 * algum descritor de audio POR PROCESSO no setDisplayMediaRequestHandler?
 * Tenta valores de exclusao/inclusao por PID e registra a recusa de cada um.
 */
async function probeLoopbackSurface({ desktopCapturer, session, window }) {
  const candidates = [
    { label: 'loopback', value: 'loopback' },
    { label: 'loopbackWithMute', value: 'loopbackWithMute' },
    { label: 'objeto com excludeProcessIds', value: { excludeProcessIds: [process.pid] } },
    { label: 'objeto com includeProcessIds', value: { includeProcessIds: [process.pid] } },
    { label: 'string arbitraria', value: 'loopbackExcludeProcess' }
  ]

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1, height: 1 }
  })
  const source = sources[0]
  if (!source) {
    return { error: 'nenhuma fonte de tela disponivel', attempts: [] }
  }

  const attempts = []
  for (const candidate of candidates) {
    let callbackError = null
    session.defaultSession.setDisplayMediaRequestHandler(
      (_request, callback) => {
        try {
          callback({ video: source, audio: candidate.value })
        } catch (error) {
          // O Electron ja rejeitou o pedido ao validar: chamar o callback de
          // novo dispara "One-time callback was called more than once".
          callbackError = error instanceof Error ? error.message : String(error)
        }
      },
      { useSystemPicker: false }
    )

    const rendererResult = await window.webContents.executeJavaScript(
      `(async () => {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          const audioTracks = stream.getAudioTracks().length
          stream.getTracks().forEach((track) => track.stop())
          return { resolved: true, audioTracks, error: null }
        } catch (error) {
          return { resolved: false, audioTracks: 0, error: String(error && error.message) }
        }
      })()`,
      true
    )

    attempts.push({ candidate: candidate.label, callbackError, ...rendererResult })
  }

  return { attempts }
}

function once(emitter, event, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout esperando '${event}'`)), timeoutMs)
    emitter.once(event, (value) => {
      clearTimeout(timer)
      resolve(value)
    })
  })
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error(message)), timeoutMs))
  ])
}

async function pollRenderer(window, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let state = { portReceived: false, messages: [] }
  while (Date.now() < deadline) {
    state = await window.webContents.executeJavaScript('window.__zoiProbe', true)
    if (state.messages.length > 0) return state
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return state
}
