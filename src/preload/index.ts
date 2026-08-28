// Ponte tipada e minima entre renderer e main (SPEC secao 5.B).
// contextIsolation ON + sandbox ON: apenas ipcRenderer atravessa.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  AUDIO_EXCLUSION_PORT_CHANNEL,
  IPC,
  type AppSettings,
  type AudioExclusionStartResult,
  type AudioExclusionStatus,
  type CaptureListSourcesRequest,
  type CaptureSelectSourceRequest,
  type CaptureSource,
  type PointerOverlayFrame,
  type PointerOverlayShowRequest,
  type PointerOverlayShowResult,
  type SettingsSetRequest,
  type UpdateStatus,
  type ZoiApi
} from '@shared/ipc'

/**
 * O preload roda no renderer, mas e typechecado pelo projeto NODE (sem lib DOM,
 * de proposito: o main nao pode enxergar globais de navegador). So o que este
 * arquivo realmente usa de `window` e declarado aqui.
 */
declare const window: {
  postMessage(message: unknown, targetOrigin: string, transfer?: readonly unknown[]): void
}

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
  logs: {
    openFolder: (): Promise<void> => ipcRenderer.invoke(IPC.logsOpenFolder)
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
  audioExclusion: {
    start: (): Promise<AudioExclusionStartResult> => ipcRenderer.invoke(IPC.audioExclusionStart),
    stop: (): Promise<void> => ipcRenderer.invoke(IPC.audioExclusionStop),
    onStatus: (listener: (status: AudioExclusionStatus) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, status: AudioExclusionStatus): void =>
        listener(status)
      ipcRenderer.on(IPC.audioExclusionStatus, handler)
      return () => {
        ipcRenderer.removeListener(IPC.audioExclusionStatus, handler)
      }
    }
  },
  // UM SO preload serve as duas janelas (a principal e a de overlay): expor
  // `onRender` tambem na principal e inofensivo, porque o main nunca envia
  // `pointer-overlay:render` para ela, e evita um segundo arquivo de preload e
  // uma segunda entry de build.
  pointerOverlay: {
    show: (request: PointerOverlayShowRequest): Promise<PointerOverlayShowResult> =>
      ipcRenderer.invoke(IPC.pointerOverlayShow, request),
    hide: (): Promise<void> => ipcRenderer.invoke(IPC.pointerOverlayHide),
    sendFrame: (frame: PointerOverlayFrame): void => {
      ipcRenderer.send(IPC.pointerOverlayFrame, frame)
    },
    onRender: (listener: (frame: PointerOverlayFrame) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, frame: PointerOverlayFrame): void =>
        listener(frame)
      ipcRenderer.on(IPC.pointerOverlayRender, handler)
      return () => {
        ipcRenderer.removeListener(IPC.pointerOverlayRender, handler)
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

// MessagePort nao atravessa o contextBridge: o preload reposta o port ao mundo
// principal com `window.postMessage`, o unico caminho que transfere ports com
// sandbox ligado. O servico do renderer escuta `message` filtrando o `channel`,
// e precisa estar escutando ANTES do `start()` (o main posta o port durante o
// invoke e postMessage nao bufferiza para ouvinte ausente).
ipcRenderer.on(IPC.audioExclusionPort, (event) => {
  window.postMessage({ channel: AUDIO_EXCLUSION_PORT_CHANNEL }, '*', event.ports)
})
