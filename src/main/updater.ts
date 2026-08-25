// Auto-update via GitHub Releases (RF-43). Nada aqui publica nada: o app apenas
// CONSOME uma release que o usuario publica manualmente (ver README).
// Sem release publicada, a checagem termina em `none` silencioso (risco R9).
import { app, ipcMain, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC, type UpdateStatus } from '@shared/ipc'

type WindowProvider = () => BrowserWindow | null

let sendStatus: (status: UpdateStatus) => void = () => {}
let pendingInstall = false
let downloaded = false

function status(
  state: UpdateStatus['state'],
  version: string | null = null,
  percent: number | null = null
): UpdateStatus {
  return { state, version, percent }
}

export function registerUpdaterIpc(getWindow: WindowProvider): void {
  sendStatus = (payload) => {
    const window = getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(IPC.updateStatus, payload)
    }
  }

  ipcMain.handle(IPC.updateCheck, async (): Promise<void> => {
    if (!app.isPackaged) {
      // Em dev o updater nunca roda (evita erro de configuracao de app-update.yml).
      sendStatus(status('none'))
      return
    }
    try {
      sendStatus(status('checking'))
      await autoUpdater.checkForUpdates()
    } catch (error) {
      console.warn('[updater] checagem falhou:', error)
      sendStatus(status('error'))
    }
  })

  ipcMain.handle(IPC.updateInstall, async (): Promise<void> => {
    if (!app.isPackaged) return
    if (downloaded) {
      setImmediate(() => autoUpdater.quitAndInstall(false, true))
      return
    }
    // O download so comeca depois do aceite do usuario (autoDownload = false).
    pendingInstall = true
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      console.warn('[updater] download falhou:', error)
      pendingInstall = false
      sendStatus(status('error'))
    }
  })
}

/** Liga os eventos do electron-updater e checa uma vez no boot (so empacotado). */
export function startUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  autoUpdater.on('checking-for-update', () => sendStatus(status('checking')))

  autoUpdater.on('update-available', (info) => {
    sendStatus(status('available', info.version))
  })

  autoUpdater.on('update-not-available', () => {
    sendStatus(status('none'))
  })

  autoUpdater.on('download-progress', (progress) => {
    sendStatus(status('downloading', null, Math.round(progress.percent)))
  })

  autoUpdater.on('update-downloaded', (info) => {
    downloaded = true
    sendStatus(status('downloaded', info.version, 100))
    if (pendingInstall) {
      pendingInstall = false
      setImmediate(() => autoUpdater.quitAndInstall(false, true))
    }
  })

  autoUpdater.on('error', (error) => {
    // Sem release publicada / sem rede: no-op silencioso com log (risco R9).
    console.warn('[updater] erro tratado como no-op:', error?.message ?? error)
    sendStatus(status('error'))
  })

  autoUpdater.checkForUpdates().catch((error: unknown) => {
    console.warn('[updater] checagem inicial falhou:', error)
    sendStatus(status('error'))
  })
}
