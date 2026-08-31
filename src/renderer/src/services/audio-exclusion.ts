// Cliente da captura de audio com exclusao, lado renderer.
//
// Transforma os frames PCM que chegam pelo MessagePort numa track de audio
// NOSSA (`MediaStreamTrackGenerator`). A identidade da track nunca muda: um
// re-fork do worker so troca a FONTE por tras dela, entao nao existe
// replaceTrack nem renegociacao, e os fallbacks de direcao ficam intocados.
import {
  AUDIO_EXCLUSION_CHANNELS,
  AUDIO_EXCLUSION_PORT_CHANNEL,
  AUDIO_EXCLUSION_SAMPLE_RATE,
  type AudioExclusionUnavailableReason
} from '@shared/ipc'

/** Quanto esperamos o MessagePort depois do invoke resolver. */
const PORT_TIMEOUT_MS = 4000

export interface AudioExclusionSession {
  track: MediaStreamTrack
  stop(): void
}

export interface AudioExclusionStartOutcome {
  session: AudioExclusionSession | null
  /** Preenchido quando `session` e null: por que a exclusao nao subiu. */
  reason: AudioExclusionUnavailableReason | null
  /**
   * Id da sessao de captura gerada pelo main (RF-08). E ele que liga as linhas
   * `[audio-native]` do arquivo de log a uma transmissao. Null quando nao houve
   * sessao nenhuma.
   */
  captureId: string | null
}

export interface AudioExclusionClient {
  start(): Promise<AudioExclusionStartOutcome>
}

interface PortMessageData {
  channel?: unknown
}

function isPortDelivery(data: unknown): data is PortMessageData {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as PortMessageData).channel === AUDIO_EXCLUSION_PORT_CHANNEL
  )
}

/**
 * Cliente real. A fabrica NAO toca em `window`: quem faz isso e o `start()`,
 * para que o media-manager possa ser instanciado em teste sem DOM.
 */
export function createAudioExclusionClient(): AudioExclusionClient {
  return {
    async start(): Promise<AudioExclusionStartOutcome> {
      let activePort: MessagePort | null = null
      let generator: MediaStreamTrackGenerator | null = null
      let writer: WritableStreamDefaultWriter<AudioData | VideoFrame> | null = null
      let stopped = false
      /**
       * Relogio PROPRIO da track. O worker reinicia o `timestampUs` do zero a
       * cada re-fork da cascata, e timestamp que anda para tras quebraria a
       * track: aqui o tempo so avanca, por contagem de amostras escritas.
       */
      let writtenFrames = 0

      let resolvePort: ((port: MessagePort) => void) | null = null
      const firstPort = new Promise<MessagePort>((resolve) => {
        resolvePort = resolve
      })

      const attachPort = (port: MessagePort): void => {
        if (stopped) {
          port.close()
          return
        }
        activePort?.close()
        activePort = port
        port.onmessage = (event: MessageEvent): void => {
          const payload = event.data as { type?: string; data?: ArrayBuffer } | null
          if (!payload || payload.type !== 'pcm' || !payload.data) return
          writeFrame(payload.data)
        }
        port.start()
      }

      const writeFrame = (data: ArrayBuffer): void => {
        if (!writer || stopped) return
        const numberOfFrames = data.byteLength / (AUDIO_EXCLUSION_CHANNELS * 4)
        if (!Number.isInteger(numberOfFrames) || numberOfFrames <= 0) return

        // Fila cheia: descartar o frame e melhor do que acumular atraso e
        // descolar o labio do video.
        if (writer.desiredSize !== null && writer.desiredSize <= 0) return

        const frame = new AudioData({
          format: 'f32',
          sampleRate: AUDIO_EXCLUSION_SAMPLE_RATE,
          numberOfFrames,
          numberOfChannels: AUDIO_EXCLUSION_CHANNELS,
          timestamp: Math.round((writtenFrames * 1_000_000) / AUDIO_EXCLUSION_SAMPLE_RATE),
          data
        })
        writtenFrames += numberOfFrames
        writer.write(frame).catch(() => {
          // Writer fechado no meio do caminho: o stop ja cuidou de tudo.
        })
      }

      // ORDEM OBRIGATORIA (SPEC 5.B): o listener PRIMEIRO. O main posta o port
      // durante o invoke e `postMessage` nao bufferiza para ouvinte ausente.
      // Ele tambem fica registrado o tempo todo para receber os ports NOVOS
      // que a cascata de degradacao entrega a cada re-fork.
      const onWindowMessage = (event: MessageEvent): void => {
        if (!isPortDelivery(event.data)) return
        const port = event.ports[0]
        if (!port) return
        attachPort(port)
        resolvePort?.(port)
        resolvePort = null
      }
      window.addEventListener('message', onWindowMessage)

      const dispose = (): void => {
        stopped = true
        window.removeEventListener('message', onWindowMessage)
        activePort?.close()
        activePort = null
      }

      const result = await window.zoi.audioExclusion.start()
      if (result.mode === 'unavailable') {
        dispose()
        return { session: null, reason: result.reason, captureId: null }
      }

      const port = await Promise.race([
        firstPort,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), PORT_TIMEOUT_MS))
      ])
      if (!port) {
        dispose()
        void window.zoi.audioExclusion.stop()
        return { session: null, reason: 'activation-failed', captureId: null }
      }

      generator = new MediaStreamTrackGenerator({ kind: 'audio' })
      writer = generator.writable.getWriter()

      const track = generator
      return {
        reason: null,
        captureId: result.captureId,
        session: {
          track,
          stop(): void {
            if (stopped) return
            dispose()
            writer?.close().catch(() => {
              // Ja fechado pelo fim da stream: nada a fazer.
            })
            writer = null
            track.stop()
            void window.zoi.audioExclusion.stop()
          }
        }
      }
    }
  }
}
