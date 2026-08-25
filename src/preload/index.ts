// Ponte tipada e minima entre renderer e main (SPEC secao 5.B).
// contextIsolation ON + sandbox ON: apenas ipcRenderer atravessa.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  type AppSettings,
  type CaptureListSourcesRequest,
  type CaptureSelectSourceRequest,
  type CaptureSource,
  type SettingsSetRequest,
  type UpdateStatus,
  type ZoiApi
} from '@shared/ipc'

const api: ZoiApi = {
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.settingsGet),
    set: (request: SettingsSetRequest): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC.settingsSet, request)
  },
  capture: {
    listSources: (request: CaptureListSourcesRequest): Promise<CaptureSource[]> =>
      ipcRenderer.invoke(IPC.captureListSources, request),
    selectSource: (request: CaptureSelectSourceRequest): Promise<void> =>
      ipcRenderer.invoke(IPC.captureSelectSource, request)
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.appGetVersion)
  },
  update: {
    check: (): Promise<void> => ipcRenderer.invoke(IPC.updateCheck),
    install: (): Promise<void> => ipcRenderer.invoke(IPC.updateInstall),
    onStatus: (listener: (status: UpdateStatus) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, status: UpdateStatus): void => listener(status)
      ipcRenderer.on(IPC.updateStatus, handler)
      return () => {
        ipcRenderer.removeListener(IPC.updateStatus, handler)
      }
    }
  },
  system: {
    onResume: (listener: () => void): (() => void) => {
      const handler = (): void => listener()
      ipcRenderer.on(IPC.systemResume, handler)
      return () => {
        ipcRenderer.removeListener(IPC.systemResume, handler)
      }
    }
  }
}

contextBridge.exposeInMainWorld('zoi', api)
