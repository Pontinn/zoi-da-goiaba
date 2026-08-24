import { join } from 'node:path'
import { app, shell, BrowserWindow } from 'electron'
import { registerDisplayMediaHandler } from './capture'
import { registerIpcHandlers } from './ipc-handlers'

// Token --bg-app do UISPEC: pintar a janela antes do primeiro frame evita flash branco.
const APP_BACKGROUND = '#0e0b12'

let mainWindow: BrowserWindow | null = null

// Isolamento de perfil para rodar varias instancias na mesma maquina (dev/E2E).
const userDataOverride = process.env['ZOI_USER_DATA_DIR']
if (userDataOverride) {
  app.setPath('userData', userDataOverride)
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: APP_BACKGROUND,
    title: 'Zói da Goiaba',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged
    }
  })

  window.on('ready-to-show', () => window.show())

  // Links externos nunca navegam dentro do app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('com.pontin.zoidagoiaba')

    registerIpcHandlers()
    registerDisplayMediaHandler()

    mainWindow = createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
