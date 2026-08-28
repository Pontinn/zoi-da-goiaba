// Bloqueio de auto-visualizacao (RF-09/RF-10/RF-11/RF-13/RF-14) com DUAS
// instancias reais do app.
//
// Este e o teste do bug de origem da feature: o transmissor conseguia abrir a
// propria transmissao no player e ouvia o proprio audio de volta, num loop
// ensurdecedor. O assert que realmente protege disso e o mais bruto possivel:
// enquanto transmite, a tela do transmissor nao pode ter NENHUM elemento de
// midia. Sem `<video>`/`<audio>` nao ha retorno de audio por caminho nenhum,
// nem player, nem PiP, nem tela cheia (os dois sao sub-estados do player).
//
// O audio da captura fica desligado de proposito (`ZOI_DISABLE_AUDIO_EXCLUSION`
// no helper): aqui o alvo e a UI e o caminho degradado deterministico.
import { expect, test } from '@playwright/test'
import {
  closeInstance,
  createRoom,
  expectNoDirectionFallbacks,
  expectRoster,
  joinRoom,
  launchInstance,
  selectMonitorSource,
  signalingIsReachable,
  startTransmission,
  stopTransmission,
  TIMEOUTS,
  uniqueRoomCode,
  wakePlayerControls,
  type ZoiInstance
} from './helpers/zoi-app'

const OWNER = 'Pontin'
const GUEST = 'Bruna'

/**
 * Quantos elementos de midia existem na tela agora. Avaliado como STRING: o
 * projeto de tipos do e2e nao carrega a lib DOM (o main nao pode enxergar
 * globais de navegador), entao `document` nao existe para o typecheck.
 */
async function mediaElementCount(instance: ZoiInstance): Promise<number> {
  return instance.page.evaluate<number>("document.querySelectorAll('video, audio').length")
}

/**
 * Troca a fonte pela barra fixa (o botao nao tem testid: e alcancado pelo
 * rotulo, como o usuario faz). Gera um txId NOVO, que e o ponto do teste.
 */
async function switchSource(instance: ZoiInstance): Promise<void> {
  const { page } = instance
  await page.getByRole('button', { name: 'Trocar fonte' }).click()
  await selectMonitorSource(instance)
  await page.getByTestId('preset-p720_30').click()
  await page.getByTestId('picker-confirm').click()
  await expect(page.getByTestId('transmitting-bar')).toBeVisible({ timeout: TIMEOUTS.media })
}

test.describe('bloqueio de auto-visualizacao (2 instancias)', () => {
  let owner: ZoiInstance | null = null
  let guest: ZoiInstance | null = null

  test.beforeAll(async () => {
    test.skip(
      !(await signalingIsReachable()),
      'servidor publico do PeerJS (0.peerjs.com) inacessivel: sem sinalizacao nao ha sala para testar'
    )
  })

  test.afterEach(async () => {
    await closeInstance(guest)
    await closeInstance(owner)
    guest = null
    owner = null
  })

  test('o transmissor ve o card no lugar do proprio tile e nunca alcanca a propria midia', async () => {
    const code = uniqueRoomCode('self')

    owner = await launchInstance('A', OWNER)
    guest = await launchInstance('B', GUEST)

    await createRoom(owner, code)
    await joinRoom(guest, code)
    await expectRoster(owner, [OWNER, GUEST])

    // 1. Transmissao no ar: o card toma o lugar do proprio tile.
    await startTransmission(owner)
    const card = owner.page.getByTestId('tx-status-card').first()
    await expect(card).toBeVisible({ timeout: TIMEOUTS.media })
    await expect(card).toContainText('Transmissao iniciada')
    // A propria miniatura simplesmente nao existe para quem transmite.
    await expect(owner.page.getByTestId('stream-thumb')).toHaveCount(0)
    expect(await mediaElementCount(owner)).toBe(0)

    // 2. Clicar no card nao abre player nenhum (nem monta midia escondida).
    await card.click()
    await expect(owner.page.getByTestId('player-controls')).toHaveCount(0)
    await expect(card).toBeVisible()
    expect(await mediaElementCount(owner)).toBe(0)

    // 3. A espectadora, essa sim, ve e assiste normalmente.
    const thumb = guest.page.getByTestId('stream-thumb').first()
    await expect(thumb).toBeVisible({ timeout: TIMEOUTS.media })
    await thumb.click()
    await expect(guest.page.getByTestId('player-controls')).toBeVisible({
      timeout: TIMEOUTS.media
    })

    // 4. A contagem do card acompanha a espectadora ao vivo (RF-11).
    await expect(owner.page.getByTestId('tx-status-viewers')).toHaveText('1 espectador', {
      timeout: TIMEOUTS.media
    })
    await wakePlayerControls(guest)
    await guest.page.getByTestId('player-back').click()
    await expect(owner.page.getByTestId('tx-status-viewers')).toHaveText('0 espectadores', {
      timeout: TIMEOUTS.media
    })

    // 5. Trocar de fonte gera txId novo: o guard vale para a transmissao nova.
    await switchSource(owner)
    await expect(owner.page.getByTestId('tx-status-card').first()).toBeVisible({
      timeout: TIMEOUTS.media
    })
    await expect(owner.page.getByTestId('stream-thumb')).toHaveCount(0)
    expect(await mediaElementCount(owner)).toBe(0)

    // 6. Parar: o card some junto com a transmissao (RF-13).
    await stopTransmission(owner)
    await expect(owner.page.getByTestId('tx-status-card')).toHaveCount(0)

    // 7. Retransmitir reaplica tudo do zero (RF-14).
    await startTransmission(owner)
    await expect(owner.page.getByTestId('tx-status-card').first()).toBeVisible({
      timeout: TIMEOUTS.media
    })
    await expect(owner.page.getByTestId('stream-thumb')).toHaveCount(0)
    expect(await mediaElementCount(owner)).toBe(0)

    await stopTransmission(owner)

    // Nada disso pode ter custado os fallbacks de direcao.
    expectNoDirectionFallbacks([owner, guest])
  })
})
