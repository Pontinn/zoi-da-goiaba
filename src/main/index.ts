import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, shell, BrowserWindow } from 'electron'
import { registerDisplayMediaHandler } from './capture'
import { registerIpcHandlers } from './ipc-handlers'
import { registerUpdaterIpc, startUpdater } from './updater'

// Token --bg-app do UISPEC: pintar a janela antes do primeiro frame evita flash branco.
const APP_BACKGROUND = '#0e0b12'

/**
 * Icone da janela (barra de titulo e barra de tarefas) em DESENVOLVIMENTO.
 * No app empacotado o icone ja vem embutido no proprio `ZoiDaGoiaba.exe` pelo
 * electron-builder (`win.icon` no electron-builder.yml), e `build/` nao entra no
 * asar: por isso o caminho e resolvido a partir da raiz do projeto e so e usado
 * quando o arquivo existe de fato. `.ico` (multi-resolucao) rende mais nitido
 * que PNG na barra de tarefas do Windows.
 */
function resolveWindowIcon(): string | undefined {
  if (app.isPackaged) return undefined
  const iconPath = join(app.getAppPath(), 'build', 'icon.ico')
  return existsSync(iconPath) ? iconPath : undefined
}

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
    icon: resolveWindowIcon(),
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
    registerUpdaterIpc(() => mainWindow)
    registerDisplayMediaHandler()

    mainWindow = createWindow()
    // Updater so entra em acao no app empacotado (RF-43).
    mainWindow.once('ready-to-show', () => startUpdater())

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
