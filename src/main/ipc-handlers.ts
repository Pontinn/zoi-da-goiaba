// Registro dos handlers IPC da SPEC secao 5.B (exceto `update:*`, no updater).
import { app, ipcMain, shell } from 'electron'
import { ROOM_MAX_LIMIT } from '@shared/config'
import {
  IPC,
  type AppSettings,
  type AudioExclusionStartResult,
  type CaptureListSourcesRequest,
  type CaptureSelectSourceRequest,
  type CaptureSource,
  type PointerOverlayFrame,
  type PointerOverlayShowRequest,
  type PointerOverlayShowResult,
  type SettingsSetRequest
} from '@shared/ipc'
import { startAudioExclusion, stopAudioExclusion } from './audio-exclusion'
import { listSources, selectSource } from './capture'
import {
  forwardPointerOverlayFrame,
  hidePointerOverlay,
  showPointerOverlay
} from './pointer-overlay'
import { ensureLogDirectory } from './file-logger'
import {
  getSettings,
  NicknameValidationError,
  setForceVp8,
  setNickname,
  setSoundVolume
} from './settings'

function isFraction(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

/**
 * Valida a FORMA do frame antes de relayar (matriz 5c). Um frame que nao casa e
 * descartado inteiro e em silencio: o overlay simplesmente mantem o ultimo frame
 * valido ate o proximo chegar, 33 ms depois.
 */
function isPointerOverlayFrame(value: unknown): value is PointerOverlayFrame {
  if (typeof value !== 'object' || value === null) return false
  const frame = value as Record<string, unknown>
  if (typeof frame['txId'] !== 'string' || frame['txId'].length === 0) return false
  const pointers = frame['pointers']
  if (!Array.isArray(pointers) || pointers.length > ROOM_MAX_LIMIT) return false
  return pointers.every((item) => {
    if (typeof item !== 'object' || item === null) return false
    const pointer = item as Record<string, unknown>
    return (
      typeof pointer['peerId'] === 'string' &&
      typeof pointer['nickname'] === 'string' &&
      typeof pointer['fill'] === 'string' &&
      isFraction(pointer['x']) &&
      isFraction(pointer['y']) &&
      typeof pointer['idle'] === 'boolean'
    )
  })
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.settingsGet, (): AppSettings => getSettings())

  ipcMain.handle(IPC.settingsSet, (_event, request: SettingsSetRequest): AppSettings => {
    try {
      // Pedido parcial: cada campo presente e aplicado na ordem, os outros ficam.
      let settings = getSettings()
      if (request?.nickname !== undefined) settings = setNickname(request.nickname)
      if (request?.soundVolume !== undefined) settings = setSoundVolume(request.soundVolume)
      if (request?.forceVp8 !== undefined) settings = setForceVp8(request.forceVp8)
      return settings
    } catch (error) {
      if (error instanceof NicknameValidationError) {
        // Erro estruturado: o renderer le o codigo pelo prefixo da mensagem.
        throw new Error(`nickname_invalid:${error.code}:${error.message}`)
      }
      throw error
    }
  })

  ipcMain.handle(
    IPC.captureListSources,
    (_event, request: CaptureListSourcesRequest): Promise<CaptureSource[]> => listSources(request)
  )

  ipcMain.handle(IPC.captureSelectSource, (_event, request: CaptureSelectSourceRequest): void => {
    selectSource(request)
  })

  // O renderer nao manda payload: a lista de processos excluidos e o PID raiz
  // sao montados no main. Qualquer argumento recebido e ignorado de proposito.
  ipcMain.handle(IPC.audioExclusionStart, (): Promise<AudioExclusionStartResult> =>
    startAudioExclusion()
  )

  ipcMain.handle(IPC.audioExclusionStop, (): void => {
    stopAudioExclusion()
  })

  ipcMain.handle(
    IPC.pointerOverlayShow,
    (_event, request: PointerOverlayShowRequest): Promise<PointerOverlayShowResult> =>
      showPointerOverlay({
        displayId: typeof request?.displayId === 'string' ? request.displayId : null
      })
  )

  ipcMain.handle(IPC.pointerOverlayHide, (): void => {
    hidePointerOverlay()
  })

  // Fire and forget: um frame agregado a cada 33 ms, ninguem espera resposta.
  ipcMain.on(IPC.pointerOverlayFrame, (_event, frame: unknown): void => {
    if (!isPointerOverlayFrame(frame)) return
    forwardPointerOverlayFrame(frame)
  })

  ipcMain.handle(IPC.appGetVersion, (): string => app.getVersion())

  ipcMain.handle(IPC.logsOpenFolder, async (): Promise<void> => {
    // A pasta pode nao existir se nada foi gravado ainda: cria antes de abrir.
    const directory = ensureLogDirectory()
    const failure = await shell.openPath(directory)
    if (failure) throw new Error(failure)
  })
}
