// Entry do utilityProcess que hospeda o addon nativo de captura (SPEC 2.2).
//
// Fica no processo utilitario de proposito: um bug no C++ derruba ESTE processo,
// nunca o app. O worker nao tem logica propria, so repassa: PCM vai direto para
// o renderer pelo MessagePort (fluxo quente) e status vai para o main pelo
// parentPort (fluxo de controle).
import { start as startCapture, stop as stopCapture } from 'zoi-audio-capture'

export interface AudioWorkerConfig {
  mode: 'process-exclusion' | 'endpoint-loopback'
  excludedExecutables: string[]
  excludedRootPids: number[]
  sampleRate: number
  channels: number
  frameMs: number
}

export type AudioWorkerCommand = { type: 'start'; config: AudioWorkerConfig } | { type: 'stop' }

export type AudioWorkerEvent =
  { type: 'status'; state: string; detail: string } | { type: 'fatal'; error: string }

let handle: number | null = null
let rendererPort: Electron.MessagePortMain | null = null

function emit(event: AudioWorkerEvent): void {
  process.parentPort.postMessage(event)
}

function stopCurrent(): void {
  if (handle !== null) {
    try {
      stopCapture(handle)
    } catch (error) {
      console.error('[audio-worker] falha ao parar a captura:', error)
    }
    handle = null
  }
  if (rendererPort) {
    rendererPort.close()
    rendererPort = null
  }
}

process.parentPort.on('message', (event) => {
  const message = event.data as AudioWorkerCommand | undefined
  if (!message || typeof message.type !== 'string') return

  if (message.type === 'stop') {
    stopCurrent()
    return
  }
  if (message.type !== 'start') return

  stopCurrent()

  const port = event.ports[0]
  if (!port) {
    emit({ type: 'fatal', error: 'start sem MessagePort do renderer' })
    return
  }
  rendererPort = port
  port.start()

  try {
    handle = startCapture(
      message.config,
      (data, timestampUs) => {
        // SEM lista de transferencia: o MessagePortMain do Electron so aceita
        // MessagePortMain no transfer, e tentar transferir o ArrayBuffer
        // lancaria a cada frame (verificado no spike do Sprint 1).
        port.postMessage({ type: 'pcm', timestampUs, data })
      },
      (state, detail) => {
        emit({ type: 'status', state, detail })
      }
    )
  } catch (error) {
    handle = null
    emit({
      type: 'fatal',
      error: error instanceof Error ? error.message : String(error)
    })
  }
})
