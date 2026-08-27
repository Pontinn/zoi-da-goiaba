// Sonda executavel do Sprint S1 (spike) da feature viewer-cursors.
//
// Transforma as duas premissas de plataforma do SPEC (secao 2.2) em evidencia
// real nesta maquina. Responde duas perguntas, e o pipeline inteiro depende das
// duas:
//   Sonda A - uma BrowserWindow transparente com `setContentProtection(true)`
//             some da captura do PROPRIO processo (`desktopCapturer`), sem
//             sumir para o olho humano e sem quebrar o resto da captura?
//   Sonda B - existe ponte entre a fonte escolhida no `desktopCapturer`
//             (`source.display_id`) e o monitor fisico (`screen.getAllDisplays()`),
//             a ponto de posicionar a janela exatamente sobre aquele monitor?
//
// A sonda NAO produz som: nenhuma captura de audio e pedida em lugar nenhum
// (`audio: false` no unico `getDisplayMedia` do script). Ela ABRE uma janela
// transparente com um retangulo magenta por alguns segundos: isso e proposital e
// e o unico efeito visivel.
//
// O item 5 da Sonda A (clique atravessando a janela) NAO tem veredito
// automatico: sem injecao de input do sistema operacional nao existe forma
// honesta de provar isso daqui. O script IMPRIME a instrucao para o operador e o
// resultado entra no SPIKE-RESULTS declarado como verificacao MANUAL.
//
// Rodar com `node scripts/pointer-probe.mjs` (ou `npm run pointer:probe`): fora
// do Electron o script se re-executa dentro do Electron e imprime um JSON com os
// resultados brutos, mais um resumo em stderr. Sai com codigo 0 quando tudo
// passou e 1 quando qualquer item reprovou.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const require = createRequire(import.meta.url)
const selfPath = fileURLToPath(import.meta.url)

/** Lado do retangulo magenta, em pontos (DIP). */
const MARK_SIZE = 200
/** Deslocamento do retangulo dentro da janela (que cobre o monitor inteiro). */
const MARK_OFFSET = 120
/** Quanto tempo esperar depois de mexer na janela antes de capturar de novo. */
const SETTLE_MS = 500
/** Espera opcional para o operador fazer o item 5 a mao. */
const MANUAL_WAIT_MS = Number(process.env['ZOI_POINTER_PROBE_MANUAL_WAIT_MS'] ?? 0) || 0

/**
 * Fora do Electron: relanca este mesmo arquivo dentro do Electron.
 *
 * Mesmo bootstrap de `scripts/audio-probe.mjs`: o Electron 43 nao aceita um
 * `.mjs` como entrada do processo main, entao o ponto de partida e um `.js` CJS
 * temporario que faz `import()` dinamico deste modulo.
 */
function relaunchInsideElectron() {
  const electronPath = require('electron')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  const bootstrapDir = mkdtempSync(join(tmpdir(), 'zoi-pointer-probe-boot-'))
  const bootstrapPath = join(bootstrapDir, 'main.js')
  writeFileSync(
    bootstrapPath,
    `const { pathToFileURL } = require('node:url')
import(pathToFileURL(${JSON.stringify(selfPath)}).href).catch((error) => {
  console.error(error)
  process.exit(1)
})
`,
    'utf8'
  )

  const child = spawn(electronPath, [bootstrapPath], { stdio: 'inherit', env })
  child.on('exit', (code) => {
    rmSync(bootstrapDir, { recursive: true, force: true })
    process.exit(code ?? 1)
  })
}

if (!process.versions.electron) {
  relaunchInsideElectron()
} else {
  await runInsideElectron()
}

function step(name) {
  process.stderr.write(`[pointer-probe] ${name}\n`)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** HTML da janela de sonda: fundo transparente, um retangulo magenta opaco. */
function buildMarkPage() {
  return (
    '<!doctype html><meta charset="utf-8"><title>zoi pointer probe</title>' +
    '<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}' +
    `.mark{position:fixed;left:${MARK_OFFSET}px;top:${MARK_OFFSET}px;` +
    `width:${MARK_SIZE}px;height:${MARK_SIZE}px;background:#ff00ff}</style>` +
    '<div class="mark"></div>'
  )
}

/**
 * Media RGB de uma regiao do thumbnail, mapeada a partir de coordenadas de TELA.
 * `getBitmap()` do Electron devolve BGRA.
 */
function sampleRegion(thumbnail, displayBounds, screenRect) {
  const size = thumbnail.getSize()
  if (size.width <= 0 || size.height <= 0) return null
  const bitmap = thumbnail.getBitmap()
  if (!bitmap || bitmap.length === 0) return null

  const scaleX = size.width / displayBounds.width
  const scaleY = size.height / displayBounds.height
  // Encolhe 25% de cada lado: evita a borda do retangulo e qualquer sombra.
  const inset = 0.25
  const left = Math.round((screenRect.x - displayBounds.x + screenRect.width * inset) * scaleX)
  const top = Math.round((screenRect.y - displayBounds.y + screenRect.height * inset) * scaleY)
  const right = Math.round(
    (screenRect.x - displayBounds.x + screenRect.width * (1 - inset)) * scaleX
  )
  const bottom = Math.round(
    (screenRect.y - displayBounds.y + screenRect.height * (1 - inset)) * scaleY
  )

  let sumR = 0
  let sumG = 0
  let sumB = 0
  let count = 0
  for (let y = Math.max(0, top); y < Math.min(size.height, bottom); y += 1) {
    for (let x = Math.max(0, left); x < Math.min(size.width, right); x += 1) {
      const offset = (y * size.width + x) * 4
      sumB += bitmap[offset]
      sumG += bitmap[offset + 1]
      sumR += bitmap[offset + 2]
      count += 1
    }
  }
  if (count === 0) return null
  return {
    r: Number((sumR / count).toFixed(1)),
    g: Number((sumG / count).toFixed(1)),
    b: Number((sumB / count).toFixed(1)),
    pixels: count,
    thumbnailSize: size,
    regionInThumbnail: { left, top, right, bottom }
  }
}

/** Magenta puro: vermelho e azul altos, verde baixo. */
function looksMagenta(sample) {
  if (!sample) return false
  return sample.r > 170 && sample.b > 170 && sample.g < 90
}

async function captureDisplay(desktopCapturer, display) {
  const width = 640
  const height = Math.max(
    1,
    Math.round((width * display.bounds.height) / Math.max(1, display.bounds.width))
  )
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height }
  })
  const match =
    sources.find((source) => source.display_id === String(display.id)) ??
    (sources.length === 1 ? sources[0] : null)
  if (!match) return { source: null, thumbnail: null }
  return { source: match, thumbnail: match.thumbnail }
}

async function runInsideElectron() {
  const { app, BrowserWindow, desktopCapturer, screen, session } = require('electron')

  await app.whenReady()

  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()

  const results = {
    environment: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      arch: process.arch,
      osRelease: require('node:os').release(),
      displayCount: displays.length,
      displays: displays.map((display) => ({
        id: String(display.id),
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor,
        internal: display.internal,
        primary: display.id === primary.id
      }))
    },
    sondaA: {
      windowCreated: null,
      withoutProtection: null,
      withProtection: null,
      sideEffects: null,
      manualClickThrough: {
        automated: false,
        note:
          'Verificacao MANUAL: sem injecao de input do sistema nao existe veredito ' +
          'automatico honesto. Ver instrucao impressa pelo script.',
        confirmed: null
      }
    },
    sondaB: {
      sourceToDisplay: null,
      boundsRoundTrip: null,
      captureAspect: null,
      singleMonitorDisplayId: null
    },
    fatal: null
  }

  const scratchDir = mkdtempSync(join(tmpdir(), 'zoi-pointer-probe-'))
  let markWindow = null
  let mediaWindow = null

  try {
    const markPagePath = join(scratchDir, 'mark.html')
    writeFileSync(markPagePath, buildMarkPage(), 'utf8')

    // -----------------------------------------------------------------------
    // Sonda A, item 1: a janela existe e e visivel
    // -----------------------------------------------------------------------
    step('sonda A item 1: cria a janela transparente sobre o monitor primario')
    markWindow = new BrowserWindow({
      x: primary.bounds.x,
      y: primary.bounds.y,
      width: primary.bounds.width,
      height: primary.bounds.height,
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
      focusable: false,
      show: false,
      title: 'zoi-pointer-probe',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false
      }
    })
    await markWindow.loadFile(markPagePath)
    markWindow.setAlwaysOnTop(true, 'screen-saver')
    markWindow.showInactive()
    await wait(SETTLE_MS)

    results.sondaA.windowCreated = {
      requestedBounds: primary.bounds,
      actualBounds: markWindow.getBounds(),
      isVisible: markWindow.isVisible(),
      isDestroyed: markWindow.isDestroyed()
    }

    const markRect = {
      x: primary.bounds.x + MARK_OFFSET,
      y: primary.bounds.y + MARK_OFFSET,
      width: MARK_SIZE,
      height: MARK_SIZE
    }

    // -----------------------------------------------------------------------
    // Sonda A, item 2 (CONTROLE): sem protecao, o magenta ENTRA na captura
    // -----------------------------------------------------------------------
    step('sonda A item 2 (controle): captura SEM setContentProtection')
    const before = await captureDisplay(desktopCapturer, primary)
    if (!before.thumbnail || before.thumbnail.isEmpty()) {
      results.sondaA.withoutProtection = { error: 'thumbnail vazio ou fonte nao encontrada' }
    } else {
      const sample = sampleRegion(before.thumbnail, primary.bounds, markRect)
      results.sondaA.withoutProtection = {
        sourceId: before.source.id,
        sourceName: before.source.name,
        sourceDisplayId: before.source.display_id,
        sample,
        magentaPresent: looksMagenta(sample)
      }
    }

    // -----------------------------------------------------------------------
    // Sonda A, item 3: com protecao, o magenta SOME da captura
    // -----------------------------------------------------------------------
    step('sonda A item 3: setContentProtection(true) e captura de novo')
    let protectionError = null
    try {
      markWindow.setContentProtection(true)
    } catch (error) {
      protectionError = String(error && error.stack ? error.stack : error)
    }
    await wait(SETTLE_MS)

    const after = await captureDisplay(desktopCapturer, primary)
    if (!after.thumbnail || after.thumbnail.isEmpty()) {
      results.sondaA.withProtection = {
        protectionError,
        error: 'thumbnail vazio ou fonte nao encontrada'
      }
    } else {
      const sample = sampleRegion(after.thumbnail, primary.bounds, markRect)
      results.sondaA.withProtection = {
        protectionError,
        sample,
        magentaPresent: looksMagenta(sample),
        thumbnailEmpty: after.thumbnail.isEmpty()
      }
    }

    // -----------------------------------------------------------------------
    // Sonda A, item 4 e 5: efeitos colaterais e o clique (manual)
    // -----------------------------------------------------------------------
    step('sonda A item 4/5: efeitos colaterais e instrucao de clique manual')
    let ignoreMouseError = null
    try {
      markWindow.setIgnoreMouseEvents(true)
    } catch (error) {
      ignoreMouseError = String(error && error.stack ? error.stack : error)
    }
    results.sondaA.sideEffects = {
      isVisibleAfterProtection: markWindow.isVisible(),
      isDestroyedAfterProtection: markWindow.isDestroyed(),
      boundsAfterProtection: markWindow.getBounds(),
      setIgnoreMouseEventsError: ignoreMouseError
    }

    process.stderr.write(
      '\n[pointer-probe] ITEM 5 (MANUAL): o retangulo magenta esta na tela, no canto\n' +
        `  superior esquerdo do monitor primario (${MARK_OFFSET}, ${MARK_OFFSET}).\n` +
        '  1) Confirme que voce CONSEGUE VER o retangulo (a protecao nao some para o olho).\n' +
        '  2) Clique DENTRO do retangulo e confirme que o clique chegou ao aplicativo\n' +
        '     que esta por baixo (a janela e click-through).\n' +
        '  O resultado entra no SPIKE-RESULTS como verificacao MANUAL, declarada como tal.\n' +
        `  Espera configurada: ${MANUAL_WAIT_MS} ms (ZOI_POINTER_PROBE_MANUAL_WAIT_MS).\n\n`
    )
    if (MANUAL_WAIT_MS > 0) await wait(MANUAL_WAIT_MS)

    // -----------------------------------------------------------------------
    // Sonda B, item 1: a ponte de ids existe
    // -----------------------------------------------------------------------
    step('sonda B item 1: cruzamento source.display_id x screen.getAllDisplays()')
    const screenSources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 }
    })
    const crossTable = screenSources.map((source) => {
      const match = displays.find((display) => String(display.id) === source.display_id) ?? null
      return {
        sourceId: source.id,
        sourceName: source.name,
        sourceDisplayId: source.display_id,
        matchedDisplayId: match ? String(match.id) : null,
        matchedBounds: match ? match.bounds : null,
        matchedScaleFactor: match ? match.scaleFactor : null
      }
    })
    results.sondaB.sourceToDisplay = {
      sourceCount: screenSources.length,
      displayCount: displays.length,
      rows: crossTable,
      allMatched: crossTable.every((row) => row.matchedDisplayId !== null)
    }

    // Item 4: o caso de UM SO monitor (display_id pode vir vazio).
    results.sondaB.singleMonitorDisplayId = {
      singleMonitor: displays.length === 1,
      rawDisplayIds: screenSources.map((source) => source.display_id),
      anyEmpty: screenSources.some((source) => !source.display_id)
    }

    // -----------------------------------------------------------------------
    // Sonda B, item 2: o bounds posiciona a janela no monitor certo
    // -----------------------------------------------------------------------
    step('sonda B item 2: reposiciona a janela em cada display e confere o id de volta')
    const roundTrip = []
    for (const display of displays) {
      markWindow.setBounds({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height
      })
      await wait(150)
      const actual = markWindow.getBounds()
      const matched = screen.getDisplayMatching(actual)
      roundTrip.push({
        requestedDisplayId: String(display.id),
        requestedBounds: display.bounds,
        actualBounds: actual,
        matchedDisplayId: String(matched.id),
        ok: String(matched.id) === String(display.id),
        boundsExact:
          actual.x === display.bounds.x &&
          actual.y === display.bounds.y &&
          actual.width === display.bounds.width &&
          actual.height === display.bounds.height,
        scaleFactor: display.scaleFactor,
        negativeOrigin: display.bounds.x < 0 || display.bounds.y < 0
      })
    }
    results.sondaB.boundsRoundTrip = {
      rows: roundTrip,
      allOk: roundTrip.every((row) => row.ok)
    }

    // -----------------------------------------------------------------------
    // Sonda B, item 3: a captura ESCALA e nao preenche com barras
    // -----------------------------------------------------------------------
    step('sonda B item 3: proporcao da track capturada x proporcao do display')
    const mediaPagePath = join(scratchDir, 'media.html')
    writeFileSync(
      mediaPagePath,
      '<!doctype html><meta charset="utf-8"><title>zoi pointer probe media</title>',
      'utf8'
    )
    mediaWindow = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    await mediaWindow.loadFile(mediaPagePath)

    const aspectRows = []
    for (const display of displays) {
      const target = screenSources.find((source) => source.display_id === String(display.id))
      const chosen = target ?? (screenSources.length === 1 ? screenSources[0] : null)
      if (!chosen) {
        aspectRows.push({ displayId: String(display.id), error: 'sem fonte de tela para o display' })
        continue
      }
      session.defaultSession.setDisplayMediaRequestHandler(
        (_request, callback) => {
          void desktopCapturer
            .getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } })
            .then((sources) => {
              const source = sources.find((candidate) => candidate.id === chosen.id)
              // `audio` ausente de proposito: a sonda nunca captura som.
              callback(source ? { video: source } : {})
            })
            .catch(() => callback({}))
        },
        { useSystemPicker: false }
      )

      const measured = await mediaWindow.webContents.executeJavaScript(
        `(async () => {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
            audio: false
          })
          const track = stream.getVideoTracks()[0]
          const video = document.createElement('video')
          video.muted = true
          video.srcObject = stream
          await video.play().catch(() => {})
          await new Promise((resolve) => {
            if (video.videoWidth > 0) return resolve()
            video.addEventListener('loadedmetadata', () => resolve(), { once: true })
            setTimeout(resolve, 5000)
          })
          const settings = track.getSettings()
          const result = {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            settingsWidth: settings.width ?? null,
            settingsHeight: settings.height ?? null
          }
          stream.getTracks().forEach((item) => item.stop())
          video.srcObject = null
          return result
        })()`,
        true
      )

      const displayRatio = display.bounds.width / display.bounds.height
      const trackRatio =
        measured.videoWidth > 0 && measured.videoHeight > 0
          ? measured.videoWidth / measured.videoHeight
          : null
      aspectRows.push({
        displayId: String(display.id),
        sourceId: chosen.id,
        displayBounds: display.bounds,
        displayRatio: Number(displayRatio.toFixed(5)),
        trackRatio: trackRatio === null ? null : Number(trackRatio.toFixed(5)),
        deltaPercent:
          trackRatio === null
            ? null
            : Number((Math.abs(trackRatio - displayRatio) / displayRatio * 100).toFixed(3)),
        ok: trackRatio !== null && Math.abs(trackRatio - displayRatio) / displayRatio <= 0.01,
        ...measured
      })
    }
    results.sondaB.captureAspect = {
      rows: aspectRows,
      allOk: aspectRows.every((row) => row.ok === true)
    }
  } catch (error) {
    results.fatal = String(error && error.stack ? error.stack : error)
  } finally {
    if (markWindow && !markWindow.isDestroyed()) markWindow.destroy()
    if (mediaWindow && !mediaWindow.isDestroyed()) mediaWindow.destroy()
    rmSync(scratchDir, { recursive: true, force: true })
  }

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`)

  const checks = [
    {
      name: 'A1 janela transparente criada e visivel',
      ok: Boolean(results.sondaA.windowCreated?.isVisible)
    },
    {
      name: 'A2 CONTROLE: magenta PRESENTE na captura sem protecao',
      ok: results.sondaA.withoutProtection?.magentaPresent === true
    },
    {
      name: 'A3 magenta AUSENTE na captura com setContentProtection(true)',
      ok:
        results.sondaA.withProtection?.magentaPresent === false &&
        !results.sondaA.withProtection?.protectionError &&
        !results.sondaA.withProtection?.error
    },
    {
      name: 'A4 janela continua visivel e viva depois da protecao',
      ok:
        results.sondaA.sideEffects?.isVisibleAfterProtection === true &&
        results.sondaA.sideEffects?.isDestroyedAfterProtection === false &&
        !results.sondaA.sideEffects?.setIgnoreMouseEventsError
    },
    {
      name: 'B1 toda fonte de tela casa com um display',
      ok: results.sondaB.sourceToDisplay?.allMatched === true
    },
    {
      name: 'B2 bounds de cada display leva a janela ao display certo',
      ok: results.sondaB.boundsRoundTrip?.allOk === true
    },
    {
      name: 'B3 proporcao da track bate com a do display dentro de 1%',
      ok: results.sondaB.captureAspect?.allOk === true
    }
  ]

  process.stderr.write('\n[pointer-probe] resumo\n')
  for (const check of checks) {
    process.stderr.write(`  ${check.ok ? 'OK   ' : 'FALHA'} ${check.name}\n`)
  }
  process.stderr.write('  MANUAL A5 clique atravessa a janela (confirmar a mao)\n')

  const failed = checks.filter((check) => !check.ok)
  if (failed.length > 0) {
    process.stderr.write(
      `\n[pointer-probe] ${failed.length} verificacao(oes) reprovada(s). ` +
        'As duas sondas sao PRECONDICAO da feature viewer-cursors: sem as duas ' +
        'confirmadas, o pipeline PARA e volta para conversa com o usuario.\n'
    )
  }
  app.exit(results.fatal || failed.length > 0 ? 1 : 0)
}
