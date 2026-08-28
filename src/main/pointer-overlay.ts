// Janela de overlay dos ponteiros dos espectadores (RF-05 a RF-10).
//
// A invariante da feature inteira e RF-05: a posicao do cursor viaja como DADO e
// nunca como PIXEL. Quem garante isso e o `setContentProtection(true)` desta
// janela, que a tira da captura do PROPRIO processo. Sem ele o cursor voltaria
// dentro do video e cada espectador veria o proprio fantasma atrasado, que e
// exatamente o defeito que esta feature existe para evitar. A sonda do Sprint S1
// mediu isso nesta plataforma: sem protecao o retangulo de teste aparece na
// captura com RGB (255, 0, 255); com protecao, some.
//
// A janela cobre SO o monitor compartilhado (RF-08), nunca rouba foco, deixa o
// clique passar (RF-09) e cai por qualquer caminho de encerramento (RF-10),
// inclusive o fechamento da janela principal: `window-all-closed` so dispara
// quando TODAS as janelas fecham, entao um overlay de pe seguraria o app vivo
// com uma janela transparente sempre no topo.
import { join } from 'node:path'
import { app, BrowserWindow, screen } from 'electron'
import {
  IPC,
  POINTER_OVERLAY_TITLE,
  type PointerOverlayFrame,
  type PointerOverlayShowRequest,
  type PointerOverlayShowResult
} from '@shared/ipc'

let overlayWindow: BrowserWindow | null = null
/** displayId que a janela no ar esta cobrindo; usado no reposicionamento. */
let overlayDisplayId: string | null = null
let hooksInstalled = false

function resolveDisplay(displayId: string | null): Electron.Display | null {
  const displays = screen.getAllDisplays()
  const match = displays.find((display) => String(display.id) === displayId)
  if (match) return match
  // Com UM SO monitor o `display_id` do desktopCapturer pode vir vazio, e o alvo
  // e trivialmente o primario. Com VARIOS, chutar o primario cobriria o monitor
  // errado, que e pior do que nao cobrir (RF-08 e obrigatorio).
  if (displays.length === 1) return screen.getPrimaryDisplay()
  return null
}

/** Sobe o overlay sobre o monitor da fonte. Nunca lanca. */
export async function showPointerOverlay(
  request: PointerOverlayShowRequest
): Promise<PointerOverlayShowResult> {
  const displayId = typeof request?.displayId === 'string' ? request.displayId : null
  const display = resolveDisplay(displayId)
  if (!display) {
    console.warn(`[pointer] nenhum monitor casou com o displayId ${String(displayId)}`)
    return { ok: false, reason: 'display-not-found' }
  }

  // Idempotencia: um `show` seguido de outro nao deixa janela para tras.
  hidePointerOverlay()

  const bounds = display.bounds
  const window = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // Nunca rouba o foco de quem esta usando a maquina.
    focusable: false,
    // So aparece depois do setContentProtection (RF-05).
    show: false,
    title: POINTER_OVERLAY_TITLE,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      backgroundThrottling: false
    }
  })

  try {
    window.setContentProtection(true)
  } catch (error) {
    console.error('[pointer] setContentProtection falhou:', error)
    window.destroy()
    return { ok: false, reason: 'content-protection-failed' }
  }

  // Sem `{ forward: true }` de proposito: encaminhar faria o Chromium continuar
  // entregando eventos de mouse a pagina, que e o oposto do que RF-09 pede.
  window.setIgnoreMouseEvents(true)
  window.setAlwaysOnTop(true, 'screen-saver')

  try {
    await window.loadFile(join(__dirname, '../renderer/overlay.html'))
  } catch (error) {
    console.error('[pointer] falha ao carregar a pagina do overlay:', error)
    window.destroy()
    return { ok: false, reason: 'window-failed' }
  }

  if (window.isDestroyed()) return { ok: false, reason: 'window-failed' }
  window.showInactive()
  overlayWindow = window
  overlayDisplayId = String(display.id)
  console.info(`[pointer] overlay no ar sobre o monitor ${overlayDisplayId}`)
  return { ok: true }
}

/**
 * Derruba o overlay. Idempotente: sem janela no ar e no-op. Usa `destroy()` e
 * nao `close()`: `close()` dispara o ciclo de `closed` de forma assincrona e
 * abriria janela de corrida com um `show` imediatamente seguinte.
 */
export function hidePointerOverlay(): void {
  const window = overlayWindow
  overlayWindow = null
  overlayDisplayId = null
  if (!window || window.isDestroyed()) return
  window.destroy()
}

/** Relaya um frame para a janela de overlay. No-op se ela nao existir. */
export function forwardPointerOverlayFrame(frame: PointerOverlayFrame): void {
  const window = overlayWindow
  if (!window || window.isDestroyed()) return
  window.webContents.send(IPC.pointerOverlayRender, frame)
}

/** Instala os ganchos de ciclo de vida; chamado uma vez em `app.whenReady()`. */
export function registerPointerOverlay(getMainWindow: () => BrowserWindow | null): void {
  if (hooksInstalled) return
  hooksInstalled = true

  const mainWindow = getMainWindow()
  // Guarda contra janela orfa: com a principal fechada e o overlay de pe,
  // `window-all-closed` nunca dispararia e o app ficaria vivo e invisivel.
  mainWindow?.on('closed', () => hidePointerOverlay())
  app.on('before-quit', () => hidePointerOverlay())

  screen.on('display-metrics-changed', (_event, display) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return
    if (String(display.id) !== overlayDisplayId) return
    overlayWindow.setBounds({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height
    })
  })

  screen.on('display-removed', (_event, display) => {
    if (String(display.id) !== overlayDisplayId) return
    // O monitor compartilhado sumiu: nao ha o que cobrir, e migrar para outro
    // monitor mostraria o ponteiro no lugar errado.
    console.warn('[pointer] o monitor compartilhado sumiu, derrubando o overlay')
    hidePointerOverlay()
  })
}
