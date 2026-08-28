// Driver do app real para o smoke E2E: sobe instancias isoladas do Electron a
// partir do build de `out/`, e expoe os passos de UI (apelido, criar sala,
// entrar, transmitir, moderar, sair) como funcoes de alto nivel.
//
// Nada aqui fala com o nucleo do app por atalho: todos os passos passam pela
// interface de verdade, exatamente como o usuario faria.
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Locator,
  type Page
} from '@playwright/test'

/** Raiz do projeto: `tests/e2e/helpers` -> tres niveis acima. */
const PROJECT_ROOT = join(__dirname, '..', '..', '..')

/** Pausa entre passos na variante assistida (`npm run test:e2e:watchme`). */
const STEP_PACING_MS = Number(process.env['ZOI_E2E_SLOWMO'] ?? '0') || 0

/** Boot do Electron + primeiro paint do renderer buildado. */
const LAUNCH_TIMEOUT_MS = 90_000
/** Ingresso real: door peer + retry de `peer-unavailable` + portas seguradas. */
const ROOM_TIMEOUT_MS = 120_000
/** Negociacao WebRTC de uma transmissao ate o primeiro frame do outro lado. */
const MEDIA_TIMEOUT_MS = 90_000

export interface ZoiInstance {
  /** Rotulo curto usado nos logs ("A", "B", "C"). */
  readonly label: string
  readonly nickname: string
  readonly app: ElectronApplication
  readonly page: Page
  readonly userDataDir: string
  /** Erros de console coletados desde o boot (diagnostico em caso de falha). */
  readonly consoleErrors: string[]
  /** TODAS as linhas de console: usadas para provar que um fallback NAO rodou. */
  readonly consoleLines: string[]
}

/**
 * Marcas dos fallbacks de direcao (chamada reversa de midia e dial-back da
 * admissao). Em rede saudavel nenhuma delas pode aparecer: os fallbacks so
 * existem para quando o caminho normal falha.
 */
const DIRECTION_FALLBACK_MARKS = ['media-pull', 'dialback', 'discando de volta', 'na outra direcao']

/** Espera visivel na variante assistida; instantanea na execucao normal. */
export async function pace(): Promise<void> {
  if (STEP_PACING_MS > 0) await new Promise((resolve) => setTimeout(resolve, STEP_PACING_MS))
}

/**
 * Codigo de sala unico por execucao. O servidor do PeerJS e PUBLICO e o id da
 * sala e global: um codigo fixo colidiria com outra execucao (ou com um usuario
 * de verdade) e o teste falharia com "codigo ja em uso" sem haver bug.
 */
export function uniqueRoomCode(prefix = 'e2e'): string {
  const stamp = Date.now().toString(36)
  const salt = Math.random().toString(36).slice(2, 7)
  return `${prefix}-${stamp}-${salt}`
}

/**
 * Variaveis que NAO podem vazar do shell para o app sob teste. O main usa
 * `ELECTRON_RENDERER_URL` para decidir entre o servidor de dev e o renderer
 * buildado: se um `npm run dev` deixou essa variavel no ambiente, o app tentaria
 * carregar um dev server morto e abriria uma pagina de erro em vez da UI. O
 * smoke sempre exercita o BUILD de `out/`.
 */
const STRIPPED_ENV_KEYS = ['ELECTRON_RENDERER_URL']

/**
 * Perfil temporario ja com os sons do app em ZERO. E a segunda camada de
 * silencio (a primeira e `--mute-audio`), usando so a chave `soundVolume` que o
 * produto ja tem: nenhum default de produto muda. O `nickname` fica `null` de
 * proposito para a instancia continuar caindo na primeira execucao.
 */
function seedSilentSettings(userDataDir: string): void {
  writeFileSync(
    join(userDataDir, 'settings.json'),
    JSON.stringify({ nickname: null, installId: randomUUID(), soundVolume: 0 }, null, 2),
    'utf8'
  )
}

/** `process.env` sem as chaves indefinidas (o launch do Playwright exige string). */
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && !STRIPPED_ENV_KEYS.includes(key)) env[key] = value
  }
  return env
}

/** Retangulo em pixels logicos (DIP) do espaco de coordenadas do Electron. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayInfo {
  /** `Display.id` em string, do mesmo jeito que o `display_id` das fontes. */
  readonly id: string
  readonly bounds: Rect
  readonly scaleFactor: number
  readonly isPrimary: boolean
}

/**
 * Monitor que a transmissao do e2e vai capturar (e, por tabela, o que o overlay
 * de ponteiros vai cobrir): o primeiro NAO primario, quando existe.
 *
 * A maquina de desenvolvimento e o desktop diario de uma pessoa, e a camada de
 * ponteiros e uma janela sempre-no-topo cobrindo um monitor INTEIRO. Jogando o
 * teste para o monitor secundario, nem as janelas do app nem o overlay entram
 * na tela em que a pessoa esta trabalhando. Com UM monitor so nao ha para onde
 * ir: devolve o primario e tudo continua exatamente como era (CI, outra
 * maquina), sem erro e sem teste pulado.
 */
export async function captureTargetDisplay(instance: ZoiInstance): Promise<DisplayInfo> {
  return instance.app.evaluate(({ screen }) => {
    const primary = screen.getPrimaryDisplay()
    const target = screen.getAllDisplays().find((display) => display.id !== primary.id) ?? primary
    return {
      id: String(target.id),
      bounds: { ...target.bounds },
      scaleFactor: target.scaleFactor,
      isPrimary: target.id === primary.id
    }
  })
}

/** Bounds da janela PRINCIPAL da instancia (a que nao e o overlay). */
export async function mainWindowBounds(instance: ZoiInstance): Promise<Rect | null> {
  return instance.app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(
      (candidate) => !candidate.webContents.getURL().includes('overlay.html')
    )
    return window ? { ...window.getBounds() } : null
  })
}

/** Bounds da janela de overlay de ponteiros, ou `null` se ela nao existir. */
export async function pointerOverlayBounds(instance: ZoiInstance): Promise<Rect | null> {
  return instance.app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((candidate) =>
      candidate.webContents.getURL().includes('overlay.html')
    )
    return window ? { ...window.getBounds() } : null
  })
}

/**
 * Calcula e aplica o retangulo da janela principal no monitor de teste:
 * centralizada e do MESMO tamanho logico de antes (so muda de lugar, nunca de
 * geometria - varios asserts dependem do layout da janela). Devolve o retangulo
 * planejado, ou `null` numa maquina de um monitor so, onde nao ha para onde ir e
 * tudo continua exatamente como era.
 *
 * A janela pode nao existir ainda quando o `launch` do Playwright resolve, por
 * isso o gancho de `browser-window-created`. So a PRIMEIRA janela e movida: a
 * segunda do app e o overlay de ponteiros, que dimensiona a si mesmo para cobrir
 * um monitor inteiro e nao pode ser reposicionado por fora.
 */
async function planTestDisplayPlacement(app: ElectronApplication): Promise<Rect | null> {
  return app.evaluate(({ app: electronApp, BrowserWindow, screen }) => {
    const primary = screen.getPrimaryDisplay()
    const target = screen.getAllDisplays().find((display) => display.id !== primary.id)
    if (!target) return null

    const place = (window: Electron.BrowserWindow): Rect | null => {
      if (window.isDestroyed()) return null
      if (window.webContents.getURL().includes('overlay.html')) return null
      const current = window.getBounds()
      const width = Math.min(current.width, target.bounds.width)
      const height = Math.min(current.height, target.bounds.height)
      const rect = {
        x: target.bounds.x + Math.round((target.bounds.width - width) / 2),
        y: target.bounds.y + Math.round((target.bounds.height - height) / 2),
        width,
        height
      }
      window.setBounds(rect)
      return rect
    }

    const existing = BrowserWindow.getAllWindows()[0]
    if (existing) return place(existing)

    return new Promise<Rect | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 30_000)
      electronApp.once('browser-window-created', (_event, window) => {
        clearTimeout(timer)
        resolve(place(window))
      })
    })
  })
}

/**
 * Reafirma o retangulo planejado ate ele PARAR de pe.
 *
 * Sem isto a janela chega ao monitor de teste com outro tamanho: o Windows
 * reescala a janela quando ela cruza para um monitor de DPI diferente (aqui,
 * 1.25 para 1.0), e 1200x800 vira 960x640 - a 20px do `minWidth` do app e com um
 * layout que nao e o mesmo que os asserts da suite viram sempre. Reaplicando o
 * retangulo com a janela JA no destino nao ha troca de DPI, e o tamanho fica.
 *
 * Exige leituras iguais em sequencia porque a reescala pode chegar depois do
 * `show`: uma unica leitura boa nao prova que a geometria assentou.
 */
async function settleTestDisplayBounds(app: ElectronApplication, plan: Rect): Promise<void> {
  const matches = (rect: Rect | null): boolean =>
    rect !== null &&
    rect.x === plan.x &&
    rect.y === plan.y &&
    rect.width === plan.width &&
    rect.height === plan.height

  let stable = 0
  for (let attempt = 0; attempt < 20; attempt++) {
    const bounds = await app.evaluate(({ BrowserWindow }, rect) => {
      const window = BrowserWindow.getAllWindows().find(
        (candidate) => !candidate.webContents.getURL().includes('overlay.html')
      )
      if (!window || window.isDestroyed()) return null
      const current = window.getBounds()
      if (
        current.x !== rect.x ||
        current.y !== rect.y ||
        current.width !== rect.width ||
        current.height !== rect.height
      ) {
        window.setBounds(rect)
        return null
      }
      return current
    }, plan)

    stable = matches(bounds) ? stable + 1 : 0
    if (stable >= 3) return
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  console.warn(
    `janela do teste nao assentou em ${JSON.stringify(plan)}: a geometria pode diferir do padrao da suite`
  )
}

export interface LaunchOptions {
  /**
   * Perfil que JA existe, para reabrir a mesma instalacao. E o que permite
   * provar round-trip de configuracao: fechar o app e voltar com o disco de
   * antes. Sem isso cada boot nasce num perfil novo e nada persiste.
   */
  userDataDir?: string
}

/**
 * Sobe uma instancia isolada e passa pela primeira execucao gravando o apelido.
 * Cada instancia tem o proprio `userData` (perfil temporario), o que tambem
 * neutraliza a trava de instancia unica do main. Com `options.userDataDir` o
 * perfil e reaproveitado e a primeira execucao NAO acontece de novo (o apelido
 * ja esta no disco), entao o boot cai direto na home.
 */
export async function launchInstance(
  label: string,
  nickname: string,
  options: LaunchOptions = {}
): Promise<ZoiInstance> {
  const reusedProfile = options.userDataDir !== undefined
  const userDataDir =
    options.userDataDir ?? mkdtempSync(join(tmpdir(), `zoi-e2e-${label.toLowerCase()}-`))
  if (!reusedProfile) seedSilentSettings(userDataDir)
  const app = await electron.launch({
    // A maquina de desenvolvimento e o desktop diario de uma pessoa: uma sessao
    // de teste com 3 instancias tocaria os sons do app e o audio da transmissao
    // nas caixas dela. `--mute-audio` cala a saida de audio da instancia INTEIRA
    // (sons do app e reproducao WebRTC) sem mexer em nada do produto.
    args: ['--mute-audio', PROJECT_ROOT],
    cwd: PROJECT_ROOT,
    env: {
      ...cleanEnv(),
      ZOI_USER_DATA_DIR: userDataDir,
      // O e2e cobre a UI e o caminho DEGRADADO deterministico: sem isso cada
      // instancia subiria um utilityProcess capturando audio real da maquina.
      ZOI_DISABLE_AUDIO_EXCLUSION: '1'
    },
    timeout: LAUNCH_TIMEOUT_MS
  })

  // Antes do `firstWindow` de proposito: quanto mais cedo o gancho entra, menor
  // a chance de a janela chegar a piscar no monitor de quem esta usando a
  // maquina (ela so aparece no `ready-to-show`).
  const placement = await planTestDisplayPlacement(app)

  const page = await app.firstWindow({ timeout: LAUNCH_TIMEOUT_MS })
  if (placement) await settleTestDisplayBounds(app, placement)
  const consoleErrors: string[] = []
  const consoleLines: string[] = []
  page.on('console', (message) => {
    const text = `[${label}] ${message.text()}`
    consoleLines.push(text)
    if (message.type() === 'error') consoleErrors.push(text)
  })
  page.on('pageerror', (error) => consoleErrors.push(`[${label}] pageerror: ${error.message}`))

  const instance: ZoiInstance = {
    label,
    nickname,
    app,
    page,
    userDataDir,
    consoleErrors,
    consoleLines
  }

  if (reusedProfile) {
    // Perfil de antes: o apelido ja esta gravado e o app abre direto na home.
    await expect(page.getByTestId('greeting')).toBeVisible({ timeout: LAUNCH_TIMEOUT_MS })
    await pace()
    return instance
  }

  // Primeira execucao (RF-11): perfil novo sempre cai na tela de apelido.
  const nicknameField = page.getByLabel('Como te chamam?')
  await expect(nicknameField).toBeVisible({ timeout: LAUNCH_TIMEOUT_MS })
  await pace()
  await nicknameField.fill(nickname)
  await page.getByRole('button', { name: 'Bora' }).click()
  await expect(page.getByTestId('greeting')).toBeVisible()
  await pace()

  return instance
}

export interface CloseOptions {
  /** Guarda o perfil no disco para um `launchInstance` reabrir depois. */
  keepProfile?: boolean
}

/** Fecha a instancia e apaga o perfil temporario. Nunca lanca. */
export async function closeInstance(
  instance: ZoiInstance | null,
  options: CloseOptions = {}
): Promise<void> {
  if (!instance) return
  if (instance.consoleErrors.length > 0) {
    console.log(`erros de console em ${instance.label}:\n  ${instance.consoleErrors.join('\n  ')}`)
  }
  try {
    await instance.app.close()
  } catch (error) {
    console.warn(`falha ao fechar a instancia ${instance.label}:`, error)
  }
  if (options.keepProfile) return
  try {
    rmSync(instance.userDataDir, { recursive: true, force: true, maxRetries: 5 })
  } catch (error) {
    console.warn(`falha ao limpar o perfil de ${instance.label}:`, error)
  }
}

/** Cria a sala com um codigo personalizado e espera a tela de sala aparecer. */
export async function createRoom(instance: ZoiInstance, code: string): Promise<void> {
  const { page } = instance
  await page.getByTestId('home-create').click()
  await expect(page.getByTestId('room-code-input')).toBeVisible()
  await pace()

  await page.getByRole('tab', { name: 'Personalizado' }).click()
  await page.getByTestId('room-code-input').fill(code)
  await pace()
  await page.getByTestId('create-room-submit').click()

  await expect(page.getByTestId('room-code')).toHaveText(code, { timeout: ROOM_TIMEOUT_MS })
  await pace()
}

/**
 * Entra pelo codigo digitado em MAIUSCULAS de proposito: a normalizacao
 * case-insensitive (AC-29) faz parte do caminho feliz.
 */
export async function joinRoom(instance: ZoiInstance, code: string): Promise<void> {
  const { page } = instance
  await page.getByTestId('home-join').click()
  await expect(page.getByTestId('join-code-input')).toBeVisible()
  await pace()

  await page.getByTestId('join-code-input').fill(code.toUpperCase())
  await pace()
  await page.getByTestId('join-room-submit').click()

  await expect(page.getByTestId('room-code')).toHaveText(code, { timeout: ROOM_TIMEOUT_MS })
  await pace()
}

/** Espera o roster convergir para `size` participantes com os nomes esperados. */
export async function expectRoster(
  instance: ZoiInstance,
  nicknames: readonly string[]
): Promise<void> {
  const cards = instance.page.getByTestId('participant')
  await expect(cards).toHaveCount(nicknames.length, { timeout: ROOM_TIMEOUT_MS })
  for (const nickname of nicknames) {
    await expect(cards.filter({ hasText: nickname })).toHaveCount(1, { timeout: ROOM_TIMEOUT_MS })
  }
}

/** Card de um participante especifico dentro do roster. */
export function participantCard(instance: ZoiInstance, nickname: string): Locator {
  return instance.page.getByTestId('participant').filter({ hasText: nickname })
}

/** Mesma ordem de PRESET_LIST; duplicado aqui porque o e2e nao importa @shared. */
const PRESET_TESTIDS = ['p720_30', 'p1080_30', 'p1080_30_hq', 'p1080_60', 'p1080_60_hq'] as const

/**
 * Pagina da SEGUNDA janela do app: o overlay de ponteiros do transmissor. O
 * `firstWindow()` do helper so alcanca a janela principal, entao a busca aqui e
 * por `app.windows()`, filtrando pela entry propria (`overlay.html`).
 */
export async function pointerOverlayPage(
  instance: ZoiInstance,
  timeoutMs = 20_000
): Promise<Page> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    for (const candidate of instance.app.windows()) {
      if (candidate.url().includes('overlay.html')) return candidate
    }
    if (Date.now() >= deadline) {
      throw new Error(`janela de overlay de ponteiros nao apareceu em ${timeoutMs}ms`)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

/**
 * Prova que NENHUMA janela de overlay esta no ar. A janela e transparente, sem
 * frame e invisivel para captura de tela: uma orfa passaria despercebida no
 * teste e ficaria por cima da tela do usuario de verdade, que nao conseguiria
 * nem clicar no que esta por baixo nem fotografar o problema (RF-07/RF-10).
 *
 * A checagem tem uma folga curta de proposito: a janela cai por IPC e o
 * Playwright so tira a pagina da lista quando o processo dela morre. Uma folga
 * grande mascararia uma demora real de encerramento.
 */
export async function expectNoPointerOverlay(instance: ZoiInstance): Promise<void> {
  await expect
    .poll(
      () =>
        instance.app
          .windows()
          .map((page) => page.url())
          .filter((url) => url.includes('overlay.html')),
      { message: 'janela de overlay de ponteiros ficou no ar', timeout: 5_000 }
    )
    .toEqual([])
}

export interface TransmitOptions {
  /** Preset da SPEC; o padrao usa o mais leve para nao pesar na maquina do teste. */
  presetId?: 'p720_30' | 'p1080_30' | 'p1080_30_hq' | 'p1080_60' | 'p1080_60_hq'
  /**
   * O toggle nasce ligado (RNF-10). O smoke desliga por padrao: loopback de
   * audio depende de dispositivo de saida ativo na maquina e ja foi validado no
   * backend (B5) e no checklist manual; aqui so atrapalharia a determinismo.
   */
  withAudio?: boolean
  /**
   * Liga o toggle de ponteiros antes de confirmar (RF-01). So faz sentido com
   * fonte de MONITOR, que e a que `startTransmission` sempre escolhe.
   */
  pointers?: boolean
}

/**
 * Nome da fonte de MONITOR que casa com o monitor de teste, ou `null` quando a
 * maquina tem um monitor so (nao ha preferencia a exprimir).
 */
async function preferredMonitorSourceName(instance: ZoiInstance): Promise<string | null> {
  return instance.app.evaluate(async ({ desktopCapturer, screen }) => {
    if (screen.getAllDisplays().length < 2) return null
    const primaryId = String(screen.getPrimaryDisplay().id)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 }
    })
    const match = sources.find(
      (source) => source.display_id !== '' && source.display_id !== primaryId
    )
    return match ? match.name : null
  })
}

/**
 * Escolhe uma fonte de MONITOR no seletor ja aberto, preferindo a do monitor de
 * teste. Nao basta mandar as janelas do app para o outro monitor: o overlay de
 * ponteiros cobre o monitor CAPTURADO, nao o monitor onde a janela esta. Se a
 * captura continuasse no primario, a camada sempre-no-topo cairia justamente na
 * tela em que a pessoa esta trabalhando e o ganho seria zero.
 *
 * A casagem e por NOME, comparado com o `title` exato que o seletor ja mostra:
 * o indice do item na grade e derivado da mesma lista do `desktopCapturer`,
 * entao nao ha suposicao sobre ordenacao. Sem casar (um monitor so, ou fonte
 * sem `display_id`), cai no primeiro item, que e o comportamento de antes.
 */
export async function selectMonitorSource(instance: ZoiInstance): Promise<void> {
  const sources = instance.page.getByTestId('capture-source')
  await expect(sources.first()).toBeVisible({ timeout: MEDIA_TIMEOUT_MS })
  await pace()

  const preferred = await preferredMonitorSourceName(instance)
  if (preferred !== null) {
    const titles = await instance.page.evaluate<string[]>(
      "Array.from(document.querySelectorAll('[data-testid=\"capture-source\"] .z-source__name')).map((node) => node.getAttribute('title') ?? '')"
    )
    const index = titles.indexOf(preferred)
    if (index >= 0) {
      await sources.nth(index).click()
      return
    }
  }

  await sources.first().click()
}

/** Abre o seletor, escolhe o MONITOR de teste e inicia a transmissao. */
export async function startTransmission(
  instance: ZoiInstance,
  options: TransmitOptions = {}
): Promise<void> {
  const { page } = instance
  const { presetId = 'p720_30', withAudio = false, pointers = false } = options

  await page.getByTestId('transmit-button').click()
  await selectMonitorSource(instance)

  const audioToggle = page.getByTestId('audio-toggle')
  if ((await audioToggle.getAttribute('aria-checked')) !== String(withAudio)) {
    await audioToggle.click()
  }
  await expect(audioToggle).toHaveAttribute('aria-checked', String(withAudio))

  const pointerToggle = page.getByTestId('pointer-toggle')
  if ((await pointerToggle.getAttribute('aria-checked')) !== String(pointers)) {
    await pointerToggle.click()
  }
  await expect(pointerToggle).toHaveAttribute('aria-checked', String(pointers))

  // O seletor mostra os 5 presets e cabe na janela sem cortar rotulo.
  for (const id of PRESET_TESTIDS) {
    await expect(page.getByTestId(`preset-${id}`)).toBeVisible()
  }

  await page.getByTestId(`preset-${presetId}`).click()
  await pace()
  await page.getByTestId('picker-confirm').click()

  await expect(page.getByTestId('transmitting-bar')).toBeVisible({ timeout: MEDIA_TIMEOUT_MS })
  await pace()
}

/** Encerra a transmissao local pela barra fixa do topo. */
export async function stopTransmission(instance: ZoiInstance): Promise<void> {
  await instance.page.getByTestId('stop-transmission').click()
  await expect(instance.page.getByTestId('transmitting-bar')).toHaveCount(0)
  await pace()
}

/** Sai da sala pelo botao da barra e volta para a home. */
export async function leaveRoom(instance: ZoiInstance): Promise<void> {
  await instance.page.getByTestId('leave-room').click()
  await expect(instance.page.getByTestId('greeting')).toBeVisible({ timeout: ROOM_TIMEOUT_MS })
  await pace()
}

/**
 * Prova que a sessao inteira rodou pelo caminho normal. Os fallbacks de direcao
 * (chamada reversa de midia, dial-back da admissao) so podem existir quando a
 * conexao direta falha: se um deles aparecer numa sessao saudavel entre duas
 * instancias da MESMA maquina, e regressao.
 */
export function expectNoDirectionFallbacks(instances: (ZoiInstance | null)[]): void {
  const hits: string[] = []
  for (const instance of instances) {
    if (!instance) continue
    for (const line of instance.consoleLines) {
      const lowered = line.toLowerCase()
      if (DIRECTION_FALLBACK_MARKS.some((mark) => lowered.includes(mark))) hits.push(line)
    }
  }
  expect(hits, 'fallback de direcao disparou em rede saudavel').toEqual([])
}

/**
 * Acorda os controles do player. Depois de ~3s parados eles ficam com
 * `pointer-events: none`, entao clicar sem mexer o mouse antes nao funcionaria
 * (nem para o teste, nem para o usuario).
 */
export async function wakePlayerControls(instance: ZoiInstance): Promise<void> {
  await instance.page.mouse.move(600, 400)
  await instance.page.mouse.move(620, 420)
  await expect(instance.page.getByTestId('player-controls')).toHaveAttribute('data-visible', 'true')
}

type ModerationAction = 'kick' | 'ban'

/** Abre o menu de moderacao do dono no card do alvo e dispara a acao. */
export async function moderate(
  owner: ZoiInstance,
  targetNickname: string,
  action: ModerationAction
): Promise<void> {
  const card = participantCard(owner, targetNickname)
  await card.getByRole('button', { name: `Acoes para ${targetNickname}` }).click()
  await pace()

  const item = action === 'kick' ? 'Desconectar da sala' : 'Banir desta sala'
  await card.getByRole('menuitem', { name: item }).click()

  if (action === 'ban') {
    await owner.page.getByTestId('confirm-ban').click()
  }
  await pace()
}

/** Volta da tela terminal (desconectado/banido) para a home. */
export async function backToHome(instance: ZoiInstance): Promise<void> {
  await instance.page.getByRole('button', { name: 'Voltar para o inicio' }).click()
  await expect(instance.page.getByTestId('greeting')).toBeVisible({ timeout: ROOM_TIMEOUT_MS })
  await pace()
}

/**
 * O servidor publico de sinalizacao esta no ar? Sem ele nao existe sala, e a
 * falha nao seria do app: o teste pula com mensagem clara (edge case da SPEC).
 */
export async function signalingIsReachable(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    // Qualquer resposta HTTP serve: o que importa e o servidor responder.
    await fetch('https://0.peerjs.com/', { signal: controller.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export const TIMEOUTS = {
  launch: LAUNCH_TIMEOUT_MS,
  room: ROOM_TIMEOUT_MS,
  media: MEDIA_TIMEOUT_MS
} as const
