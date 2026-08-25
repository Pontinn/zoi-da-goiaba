// Enumeracao de fontes de captura (RF-15) e entrega da fonte escolhida ao
// getDisplayMedia do renderer, com loopback de audio do sistema (RF-17/RNF-10).
import { desktopCapturer, session, type DesktopCapturerSource } from 'electron'
import {
  CAPTURE_SELECTION_TTL_MS,
  type CaptureListSourcesRequest,
  type CaptureSelectSourceRequest,
  type CaptureSource
} from '@shared/ipc'

interface ArmedSelection {
  sourceId: string
  withAudio: boolean
  armedAt: number
}

let armedSelection: ArmedSelection | null = null
let disarmTimer: NodeJS.Timeout | null = null

function disarm(): void {
  armedSelection = null
  if (disarmTimer) {
    clearTimeout(disarmTimer)
    disarmTimer = null
  }
}

/** Arma a fonte para o PROXIMO getDisplayMedia do renderer. Expira em 30s. */
export function selectSource(request: CaptureSelectSourceRequest): void {
  disarm()
  armedSelection = {
    sourceId: request.sourceId,
    withAudio: request.withAudio,
    armedAt: Date.now()
  }
  disarmTimer = setTimeout(() => {
    console.warn('[capture] selecao de fonte expirou sem uso, desarmando')
    disarm()
  }, CAPTURE_SELECTION_TTL_MS)
  disarmTimer.unref?.()
}

function toCaptureSource(source: DesktopCapturerSource): CaptureSource {
  return {
    id: source.id,
    name: source.name,
    kind: source.id.startsWith('screen:') ? 'screen' : 'window',
    thumbnailDataUrl: source.thumbnail.isEmpty() ? '' : source.thumbnail.toDataURL(),
    displayId: source.display_id ? source.display_id : null
  }
}

export async function listSources(request: CaptureListSourcesRequest): Promise<CaptureSource[]> {
  const width = Math.max(120, Math.min(640, Math.round(request.thumbnailWidth) || 320))
  const height = Math.round((width * 9) / 16)
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width, height },
    fetchWindowIcons: false
  })
  return sources.map(toCaptureSource)
}

/**
 * Registra o handler global de display media. Resolve cada pedido com a fonte
 * previamente armada; `audio: 'loopback'` captura o audio do sistema inteiro.
 */
export function registerDisplayMediaHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      const selection = armedSelection
      if (!selection || Date.now() - selection.armedAt > CAPTURE_SELECTION_TTL_MS) {
        disarm()
        // Cancela o pedido: o renderer recebe reject e reabre o seletor.
        callback({})
        return
      }

      void desktopCapturer
        .getSources({ types: ['screen', 'window'], thumbnailSize: { width: 1, height: 1 } })
        .then((sources) => {
          const source = sources.find((candidate) => candidate.id === selection.sourceId)
          disarm()
          if (!source) {
            // Fonte sumiu entre a selecao e o pedido (janela fechada).
            callback({})
            return
          }
          callback(
            selection.withAudio ? { video: source, audio: 'loopback' } : { video: source }
          )
        })
        .catch((error: unknown) => {
          console.error('[capture] falha ao resolver a fonte armada:', error)
          disarm()
          callback({})
        })
    },
    { useSystemPicker: false }
  )
}
