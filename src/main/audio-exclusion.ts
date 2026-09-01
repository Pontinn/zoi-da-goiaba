// Orquestracao da captura de audio com exclusao das arvores proibidas.
//
// O main e o unico dono da politica: monta a config inteira sozinho (o renderer
// nao consegue influenciar QUAIS processos sao excluidos), decide o modo, e e
// ELE quem degrada quando o worker cai (um worker que morreu nao troca de modo
// sozinho). A cascata e: process-exclusion -> process-exclusion (uma retentativa)
// -> endpoint-loopback -> falha explicita.
import { release } from 'node:os'
import { join, sep } from 'node:path'
import {
  MessageChannelMain,
  utilityProcess,
  type BrowserWindow,
  type UtilityProcess
} from 'electron'
import {
  AUDIO_EXCLUSION_CHANNELS,
  AUDIO_EXCLUSION_FRAME_MS,
  AUDIO_EXCLUSION_PORT_CHANNEL,
  AUDIO_EXCLUSION_SAMPLE_RATE,
  IPC,
  type AudioExclusionStartResult,
  type AudioExclusionStatus,
  type AudioExclusionUnavailableReason
} from '@shared/ipc'
import { AUDIO_LOG_WINDOW_MS } from '@shared/config'
import { createThrottledCounter, type ThrottledCounter } from '@shared/log-throttle'
// O pacote nativo NUNCA lanca no import: sem o binario ele exporta um stub que
// responde `probe()` com o motivo, e o app segue no caminho degradado.
import { probe as probeNativeAddon } from 'zoi-audio-capture'
import { logToFile } from './file-logger'
import type { AudioWorkerConfig, AudioWorkerEvent } from './audio-capture-worker'

/** Arvores que nunca podem entrar no mix (RF-01). Fixa, sem UI, sem settings. */
const EXCLUDED_EXECUTABLES = ['discord.exe', 'discordptb.exe', 'discordcanary.exe']

/** Build minimo do Windows com WASAPI Process Loopback. */
const MIN_WINDOWS_BUILD = 20348

type CaptureMode = AudioWorkerConfig['mode']

interface ExclusionSession {
  worker: UtilityProcess
  mode: CaptureMode
  /**
   * Identidade da SESSAO de captura (RF-08), nao do worker: a cascata re-forka o
   * worker e o id continua o mesmo, que e o que liga o degrau A->B a mesma
   * transmissao no arquivo de log.
   */
  captureId: string
  /** Quantas vezes a cascata ja re-forkou nesta sessao. */
  restarts: number
  /** Parada voluntaria: `exit` depois disso nao dispara a cascata. */
  disposing: boolean
  /**
   * Contadores com janela dos dois relatorios de diagnostico que podem repetir.
   * Um app que abre e fecha sessao de audio varias vezes por segundo faria o
   * motor emitir `active`/`skipped` na mesma cadencia; sem janela, isso encheria
   * o arquivo do dia. A linha que sai carrega o estado MAIS RECENTE e quantas
   * mudancas foram suprimidas.
   */
  activeLog: ThrottledCounter
  skippedLog: ThrottledCounter
  lastActiveDetail: string
  lastSkippedDetail: string
}

let session: ExclusionSession | null = null
let getWindow: (() => BrowserWindow | null) | null = null
/** Resultado do probe nativo, memorizado (a ativacao custa dezenas de ms). */
let probeResult: { ok: boolean; error: string | null } | null = null

export function registerAudioExclusionWindow(getter: () => BrowserWindow | null): void {
  getWindow = getter
}

function sendStatus(status: AudioExclusionStatus): void {
  logToFile(
    'info',
    `[audio-exclusion] sessao ${status.captureId ?? 'sem-sessao'} estado ${status.state}${
      status.detail ? `: ${status.detail}` : ''
    }`
  )
  getWindow?.()?.webContents.send(IPC.audioExclusionStatus, status)
}

/** Build do Windows a partir de `os.release()` ("10.0.26200"). */
function isSupportedWindows(): boolean {
  if (process.platform !== 'win32') return false
  const parts = release().split('.')
  const build = Number.parseInt(parts[2] ?? '0', 10)
  return Number.isFinite(build) && build >= MIN_WINDOWS_BUILD
}

function probeAddon(): { ok: boolean; error: string | null } {
  if (probeResult) return probeResult
  try {
    probeResult = probeNativeAddon()
  } catch (error) {
    probeResult = {
      ok: false,
      error: `native-binary-missing: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  return probeResult
}

function buildConfig(mode: CaptureMode): AudioWorkerConfig {
  return {
    mode,
    excludedExecutables: EXCLUDED_EXECUTABLES,
    // A arvore do proprio Zoi: em dev o exe e `electron.exe`, em prod
    // `ZoiDaGoiaba.exe`, entao a exclusao por PID raiz e a autoritativa.
    excludedRootPids: [process.pid],
    sampleRate: AUDIO_EXCLUSION_SAMPLE_RATE,
    channels: AUDIO_EXCLUSION_CHANNELS,
    frameMs: AUDIO_EXCLUSION_FRAME_MS
  }
}

/**
 * O utilityProcess herda o env do main. `ELECTRON_RUN_AS_NODE`, mesmo VAZIA,
 * faz o fork subir sem snapshot do V8 e abortar com assertion (medido no
 * spike do Sprint 1).
 */
function workerEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key === 'ELECTRON_RUN_AS_NODE') continue
    if (value !== undefined) env[key] = value
  }
  return env
}

/** Entrega um MessagePort novo ao renderer e manda o worker comecar. */
function handshake(worker: UtilityProcess, mode: CaptureMode): boolean {
  const window = getWindow?.()
  if (!window || window.isDestroyed()) return false

  const channel = new MessageChannelMain()
  worker.postMessage({ type: 'start', config: buildConfig(mode) }, [channel.port1])
  window.webContents.postMessage(
    IPC.audioExclusionPort,
    { channel: AUDIO_EXCLUSION_PORT_CHANNEL },
    [channel.port2]
  )
  return true
}

/**
 * Caminho do script do worker. No app empacotado ele fica em
 * `app.asar.unpacked` (ver `asarUnpack` do electron-builder): o
 * `utilityProcess.fork` abre um caminho de ARQUIVO, e depender do asar aqui
 * seria apostar num comportamento nao documentado.
 */
function workerScriptPath(): string {
  return join(__dirname, 'audio-capture-worker.js').replace(
    `${sep}app.asar${sep}`,
    `${sep}app.asar.unpacked${sep}`
  )
}

function spawnWorker(
  mode: CaptureMode,
  restarts: number,
  captureId: string
): ExclusionSession | null {
  let worker: UtilityProcess
  try {
    worker = utilityProcess.fork(workerScriptPath(), [], {
      serviceName: 'zoi-audio-capture',
      stdio: 'inherit',
      env: workerEnv()
    })
  } catch (error) {
    logToFile('error', `[audio-exclusion] fork do worker falhou: ${String(error)}`)
    return null
  }

  const created: ExclusionSession = {
    worker,
    mode,
    captureId,
    restarts,
    disposing: false,
    activeLog: createThrottledCounter(AUDIO_LOG_WINDOW_MS),
    skippedLog: createThrottledCounter(AUDIO_LOG_WINDOW_MS),
    lastActiveDetail: '',
    lastSkippedDetail: ''
  }

  worker.on('message', (message: AudioWorkerEvent | undefined) => {
    if (!message || typeof message.type !== 'string') return
    if (session !== created) return

    if (message.type === 'status') {
      if (message.state === 'failed') {
        escalate(created, message.detail || 'motor de captura falhou')
        return
      }

      // Os quatro estados abaixo sao DIAGNOSTICO: nenhum deles pode disparar a
      // cascata de degradacao, e um `state` desconhecido continua sendo
      // descartado em silencio, como era o comportamento de hoje.
      if (message.state === 'active') {
        created.lastActiveDetail = message.detail
        const summary = created.activeLog.record(Date.now())
        if (summary) {
          logToFile(
            'info',
            `[audio-native] ${created.captureId} active (${summary.count} mudancas em ${summary.sinceMs} ms): ${created.lastActiveDetail}`
          )
        }
        return
      }
      if (message.state === 'skipped') {
        created.lastSkippedDetail = message.detail
        const summary = created.skippedLog.record(Date.now())
        if (summary) {
          logToFile(
            'info',
            `[audio-native] ${created.captureId} skipped (${summary.count} mudancas em ${summary.sinceMs} ms): ${created.lastSkippedDetail}`
          )
        }
        return
      }
      if (message.state === 'health') {
        // Sem throttle aqui: o proprio C++ ja limita a uma linha a cada 15 s.
        logToFile('warn', `[audio-native] ${created.captureId} health: ${message.detail}`)
        return
      }
      if (message.state === 'app-skipped') {
        logToFile('warn', `[audio-native] ${created.captureId} app-skipped: ${message.detail}`)
        // Um toast sem nome de aplicativo nao ajuda ninguem: sem detalhe, o
        // evento fica so no log.
        if (message.detail) {
          sendStatus({
            state: 'app-not-captured',
            detail: message.detail,
            captureId: created.captureId,
            app: message.detail
          })
        }
        return
      }
      return
    }
    if (message.type === 'fatal') {
      escalate(created, message.error)
    }
  })

  worker.on('exit', (code) => {
    if (created.disposing || session !== created) return
    escalate(created, `worker encerrou inesperadamente (codigo ${code})`)
  })

  if (!handshake(worker, mode)) {
    created.disposing = true
    worker.kill()
    return null
  }

  return created
}

/**
 * Cascata de degradacao. Roda no MAIN porque um worker morto nao consegue
 * trocar de modo sozinho. Nunca muda em silencio: cada degrau avisa o renderer.
 */
function escalate(previous: ExclusionSession, reason: string): void {
  if (session !== previous) return

  previous.disposing = true
  previous.worker.kill()
  session = null

  logToFile('warn', `[audio-exclusion] sessao ${previous.captureId} degradando: ${reason}`)

  // Degrau 1: uma retentativa no mesmo modo (falha transitoria do motor).
  if (previous.mode === 'process-exclusion' && previous.restarts === 0) {
    const retry = spawnWorker('process-exclusion', 1, previous.captureId)
    if (retry) {
      session = retry
      return
    }
  }

  // Degrau 2: loopback classico do endpoint, sempre disponivel.
  if (previous.mode === 'process-exclusion') {
    const fallback = spawnWorker('endpoint-loopback', previous.restarts + 1, previous.captureId)
    if (fallback) {
      session = fallback
      sendStatus({
        state: 'degraded-full-loopback',
        detail: reason,
        captureId: previous.captureId,
        app: null
      })
      return
    }
  }

  sendStatus({ state: 'failed', detail: reason, captureId: previous.captureId, app: null })
}

export async function startAudioExclusion(): Promise<AudioExclusionStartResult> {
  // Uma captura por vez, espelhando a regra de transmissao unica do app.
  stopAudioExclusion()

  const unavailable = (reason: AudioExclusionUnavailableReason): AudioExclusionStartResult => {
    logToFile('info', `[audio-exclusion] indisponivel: ${reason}`)
    return { mode: 'unavailable', reason }
  }

  if (process.env['ZOI_DISABLE_AUDIO_EXCLUSION']) return unavailable('disabled-by-env')
  if (!isSupportedWindows()) return unavailable('os-unsupported')

  const probe = probeAddon()
  if (!probe.ok) {
    const isMissingBinary = (probe.error ?? '').startsWith('native-binary-missing')
    logToFile('warn', `[audio-exclusion] probe nativo falhou: ${probe.error ?? 'sem detalhe'}`)
    return unavailable(isMissingBinary ? 'addon-load-failed' : 'activation-failed')
  }

  // Um id por SESSAO de exclusao, gerado ANTES do fork: a cascata re-forka o
  // worker e leva o mesmo id adiante (2b.1 da SPEC).
  const captureId = `ax-${Date.now().toString(36)}`

  const started = spawnWorker('process-exclusion', 0, captureId)
  if (!started) return unavailable('worker-spawn-failed')

  session = started
  logToFile('info', `[audio-exclusion] sessao ${captureId} iniciada em process-exclusion`)
  return {
    mode: 'process-exclusion',
    sampleRate: AUDIO_EXCLUSION_SAMPLE_RATE,
    channels: AUDIO_EXCLUSION_CHANNELS,
    captureId
  }
}

export function stopAudioExclusion(): void {
  const current = session
  session = null
  if (!current) return

  current.disposing = true
  try {
    current.worker.postMessage({ type: 'stop' })
  } catch {
    // Worker ja pode ter morrido: o kill abaixo resolve.
  }
  current.worker.kill()
}
