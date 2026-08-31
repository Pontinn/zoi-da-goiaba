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
import { AUDIO_FADE_MS, AUDIO_LOG_WINDOW_MS, AUDIO_MAX_SKIP_MS } from '@shared/config'
import { createThrottledCounter } from '@shared/log-throttle'

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
       *
       * O relogio conta tambem o que foi PULADO: um frame descartado por
       * backpressure e um buraco real na linha do tempo, e colar o pedaco
       * seguinte no anterior emendaria duas formas de onda nao contiguas, que e
       * uma descontinuidade de amplitude arbitraria (o estalo). O buraco passa a
       * ser DECLARADO ao consumidor, com teto de `AUDIO_MAX_SKIP_MS`.
       */
      let writtenFrames = 0
      /** Quadros descartados desde a ultima escrita, ja limitados pelo teto. */
      let pendingSkippedFrames = 0
      /** Comeca true: o PRIMEIRO frame da track tambem nasce de um silencio. */
      let needsFadeIn = true
      let captureId: string | null = null
      const dropCounter = createThrottledCounter(AUDIO_LOG_WINDOW_MS)
      /** 48 quadros a 48 kHz. */
      const fadeFrames = Math.max(
        2,
        Math.round((AUDIO_EXCLUSION_SAMPLE_RATE * AUDIO_FADE_MS) / 1000)
      )
      /** 9 600 quadros a 48 kHz, ou seja 200 ms. */
      const maxSkipFrames = Math.round((AUDIO_EXCLUSION_SAMPLE_RATE * AUDIO_MAX_SKIP_MS) / 1000)

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
        // descolar o labio do video. O descarte deixa de ser silencioso em dois
        // sentidos: ele vira contagem no log e vira buraco declarado no relogio,
        // e a retomada entra com rampa em vez de degrau.
        if (writer.desiredSize !== null && writer.desiredSize <= 0) {
          pendingSkippedFrames = Math.min(pendingSkippedFrames + numberOfFrames, maxSkipFrames)
          needsFadeIn = true
          const summary = dropCounter.record(Date.now())
          // A template string so e montada DENTRO do if: fora da janela o custo
          // e uma soma e uma comparacao (RNF-05).
          if (summary) {
            console.warn(
              `[audio-drop] ${captureId ?? 'sem-sessao'} backpressure: ${summary.count} quadros em ${summary.sinceMs} ms`
            )
          }
          return
        }

        writtenFrames += pendingSkippedFrames
        pendingSkippedFrames = 0

        if (needsFadeIn) {
          const fade = Math.min(numberOfFrames, fadeFrames)
          // `fade < 2` dividiria por zero; nesse caso nao ha rampa.
          if (fade >= 2) {
            // Formato 'f32', ou seja INTERLEAVED: o quadro i ocupa os indices
            // i * canais ate i * canais + canais - 1.
            const view = new Float32Array(data)
            for (let i = 0; i < fade; i += 1) {
              const gain = i / (fade - 1)
              for (let channel = 0; channel < AUDIO_EXCLUSION_CHANNELS; channel += 1) {
                const index = i * AUDIO_EXCLUSION_CHANNELS + channel
                view[index] = (view[index] ?? 0) * gain
              }
            }
          }
          needsFadeIn = false
        }

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
      captureId = result.captureId

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
