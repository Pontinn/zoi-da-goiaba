import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, shell, powerMonitor, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import { registerDisplayMediaHandler } from './capture'
import { attachRendererLogging, logToFile, startFileLogger } from './file-logger'
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

/** Apenas http/https podem ser entregues ao navegador do sistema. */
function isExternalLink(url: string): boolean {
  try {
    const protocol = new URL(url).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
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
      devTools: !app.isPackaged,
      // O dono costuma MINIMIZAR a janela enquanto espera os amigos entrarem, e
      // e ai que o Chromium estrangula timers de janela em segundo plano. O
      // heartbeat do PeerJS (5s) e a verificacao de saude da sala dependem
      // desses timers: estrangulados, o servidor poda a conexao e o codigo da
      // sala some da sinalizacao sem ninguem perceber.
      backgroundThrottling: false
    }
  })

  // Console do renderer espelhado em arquivo: sem isso, o app instalado nao
  // deixa nenhum rastro do que aconteceu na maquina do usuario.
  attachRendererLogging(window.webContents)

  window.on('ready-to-show', () => window.show())

  // Links externos nunca navegam dentro do app; nenhuma janela nova e criada
  // pelo renderer (a janela flutuante do video usa o PiP nativo do Chromium).
  window.webContents.setWindowOpenHandler(({ url }) => {
    // SO http/https vao para o navegador: `about:`, `file:` e afins entregues ao
    // shell fazem o Windows abrir o dialogo "obter um aplicativo para abrir...".
    if (isExternalLink(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Navegacao para fora do app tambem so acontece pelo navegador padrao.
  window.webContents.on('will-navigate', (event, url) => {
    if (url === window.webContents.getURL()) return
    event.preventDefault()
    if (isExternalLink(url)) void shell.openExternal(url)
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

    startFileLogger()
    registerIpcHandlers()
    registerUpdaterIpc(() => mainWindow)
    registerDisplayMediaHandler()

    mainWindow = createWindow()
    // Updater so entra em acao no app empacotado (RF-43).
    mainWindow.once('ready-to-show', () => startUpdater())

    // Suspensao mata o websocket da sinalizacao sem avisar o renderer: ao voltar,
    // o app reverifica o registro do member peer e da porta da sala.
    powerMonitor.on('resume', () => {
      logToFile('info', '[system] maquina voltou de suspensao')
      mainWindow?.webContents.send(IPC.systemResume)
    })

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
