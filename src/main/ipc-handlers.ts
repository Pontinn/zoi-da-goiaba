// Registro dos handlers IPC da SPEC secao 5.B (exceto `update:*`, no updater).
import { app, ipcMain, shell } from 'electron'
import {
  IPC,
  type AppSettings,
  type AudioExclusionStartResult,
  type CaptureListSourcesRequest,
  type CaptureSelectSourceRequest,
  type CaptureSource,
  type SettingsSetRequest
} from '@shared/ipc'
import { startAudioExclusion, stopAudioExclusion } from './audio-exclusion'
import { listSources, selectSource } from './capture'
import { ensureLogDirectory } from './file-logger'
import { getSettings, NicknameValidationError, setNickname, setSoundVolume } from './settings'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.settingsGet, (): AppSettings => getSettings())

  ipcMain.handle(IPC.settingsSet, (_event, request: SettingsSetRequest): AppSettings => {
    try {
      // Pedido parcial: cada campo presente e aplicado na ordem, os outros ficam.
      let settings = getSettings()
      if (request?.nickname !== undefined) settings = setNickname(request.nickname)
      if (request?.soundVolume !== undefined) settings = setSoundVolume(request.soundVolume)
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

  ipcMain.handle(IPC.appGetVersion, (): string => app.getVersion())

  ipcMain.handle(IPC.logsOpenFolder, async (): Promise<void> => {
    // A pasta pode nao existir se nada foi gravado ainda: cria antes de abrir.
    const directory = ensureLogDirectory()
    const failure = await shell.openPath(directory)
    if (failure) throw new Error(failure)
  })
}
