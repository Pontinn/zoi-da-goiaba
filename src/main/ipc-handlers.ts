// Registro dos handlers IPC da SPEC secao 5.B (exceto `update:*`, no updater).
import { app, ipcMain } from 'electron'
import {
  IPC,
  type AppSettings,
  type CaptureListSourcesRequest,
  type CaptureSelectSourceRequest,
  type CaptureSource,
  type SettingsSetRequest
} from '@shared/ipc'
import { listSources, selectSource } from './capture'
import { getSettings, NicknameValidationError, setNickname } from './settings'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.settingsGet, (): AppSettings => getSettings())

  ipcMain.handle(IPC.settingsSet, (_event, request: SettingsSetRequest): AppSettings => {
    try {
      return setNickname(request?.nickname)
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

  ipcMain.handle(IPC.appGetVersion, (): string => app.getVersion())
}
