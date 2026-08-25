// Sonda executavel do Sprint 1 (spike) da feature app-audio-capture.
//
// Transforma o veredito ESTATICO do SPEC (secao 2.1) em evidencia real nesta
// maquina. Responde quatro perguntas:
//   1. o WASAPI Process Loopback ativa de verdade? (addon nativo `probe()`)
//   2. o renderer do Electron 43 tem `MediaStreamTrackGenerator` usavel?
//   3. o transporte utilityProcess -> MessagePort -> renderer funciona?
//   4. informativo: o Chromium do Electron aceita `restrictOwnAudio`?
//
// Rodar com `node scripts/audio-probe.mjs` (ou `npm run audio:probe`): fora do
// Electron o script se re-executa dentro do Electron, sem janela visivel, e
// imprime um JSON com os resultados brutos.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
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
    electronLoopbackSurface: null
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
  app.exit(results.fatal ? 1 : 0)
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
