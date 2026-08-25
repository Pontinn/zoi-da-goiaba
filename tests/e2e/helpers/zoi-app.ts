// Driver do app real para o smoke E2E: sobe instancias isoladas do Electron a
// partir do build de `out/`, e expoe os passos de UI (apelido, criar sala,
// entrar, transmitir, moderar, sair) como funcoes de alto nivel.
//
// Nada aqui fala com o nucleo do app por atalho: todos os passos passam pela
// interface de verdade, exatamente como o usuario faria.
import { mkdtempSync, rmSync } from 'node:fs'
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
}

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

/** `process.env` sem as chaves indefinidas (o launch do Playwright exige string). */
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && !STRIPPED_ENV_KEYS.includes(key)) env[key] = value
  }
  return env
}

/**
 * Sobe uma instancia isolada e passa pela primeira execucao gravando o apelido.
 * Cada instancia tem o proprio `userData` (perfil temporario), o que tambem
 * neutraliza a trava de instancia unica do main.
 */
export async function launchInstance(label: string, nickname: string): Promise<ZoiInstance> {
  const userDataDir = mkdtempSync(join(tmpdir(), `zoi-e2e-${label.toLowerCase()}-`))
  const app = await electron.launch({
    args: [PROJECT_ROOT],
    cwd: PROJECT_ROOT,
    env: { ...cleanEnv(), ZOI_USER_DATA_DIR: userDataDir },
    timeout: LAUNCH_TIMEOUT_MS
  })

  const page = await app.firstWindow({ timeout: LAUNCH_TIMEOUT_MS })
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`[${label}] ${message.text()}`)
  })
  page.on('pageerror', (error) => consoleErrors.push(`[${label}] pageerror: ${error.message}`))

  const instance: ZoiInstance = { label, nickname, app, page, userDataDir, consoleErrors }

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

/** Fecha a instancia e apaga o perfil temporario. Nunca lanca. */
export async function closeInstance(instance: ZoiInstance | null): Promise<void> {
  if (!instance) return
  if (instance.consoleErrors.length > 0) {
    console.log(`erros de console em ${instance.label}:\n  ${instance.consoleErrors.join('\n  ')}`)
  }
  try {
    await instance.app.close()
  } catch (error) {
    console.warn(`falha ao fechar a instancia ${instance.label}:`, error)
  }
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

export interface TransmitOptions {
  /** Preset da SPEC; o padrao usa o mais leve para nao pesar na maquina do teste. */
  presetId?: 'p720_30' | 'p1080_30' | 'p1080_60'
  /**
   * O toggle nasce ligado (RNF-10). O smoke desliga por padrao: loopback de
   * audio depende de dispositivo de saida ativo na maquina e ja foi validado no
   * backend (B5) e no checklist manual; aqui so atrapalharia a determinismo.
   */
  withAudio?: boolean
}

/** Abre o seletor, escolhe o primeiro MONITOR e inicia a transmissao. */
export async function startTransmission(
  instance: ZoiInstance,
  options: TransmitOptions = {}
): Promise<void> {
  const { page } = instance
  const { presetId = 'p720_30', withAudio = false } = options

  await page.getByTestId('transmit-button').click()

  const sources = page.getByTestId('capture-source')
  await expect(sources.first()).toBeVisible({ timeout: MEDIA_TIMEOUT_MS })
  await pace()
  await sources.first().click()

  const audioToggle = page.getByTestId('audio-toggle')
  if ((await audioToggle.getAttribute('aria-checked')) !== String(withAudio)) {
    await audioToggle.click()
  }
  await expect(audioToggle).toHaveAttribute('aria-checked', String(withAudio))

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
 * Acorda os controles do player. Depois de ~3s parados eles ficam com
 * `pointer-events: none`, entao clicar sem mexer o mouse antes nao funcionaria
 * (nem para o teste, nem para o usuario).
 */
export async function wakePlayerControls(instance: ZoiInstance): Promise<void> {
  await instance.page.mouse.move(600, 400)
  await instance.page.mouse.move(620, 420)
  await expect(instance.page.getByTestId('player-controls')).toHaveAttribute(
    'data-visible',
    'true'
  )
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
