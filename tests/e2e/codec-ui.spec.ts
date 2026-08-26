// Superficie de UI da feature de codec: o escape "modo compatibilidade" das
// Configuracoes (AC-13) e o toggle de nitidez da barra de transmissao
// (AC-16/AC-17 no que da para automatizar).
//
// Os dois cenarios rodam com UMA instancia so, de proposito: nenhum dos dois
// depende de um segundo par. A barra de transmissao existe assim que a captura
// LOCAL termina, e o escape e uma configuracao da maquina, nao da sala. Uma
// instancia a menos e menos tempo e menos flakiness de rede sem perder nada do
// que esta sendo verificado.
//
// A engrenagem de Configuracoes so existe no rodape da sidebar da SALA, entao
// os dois roteiros passam por criar uma sala de verdade.
import { expect, test } from '@playwright/test'
import {
  closeInstance,
  createRoom,
  expectNoDirectionFallbacks,
  launchInstance,
  signalingIsReachable,
  startTransmission,
  stopTransmission,
  TIMEOUTS,
  uniqueRoomCode,
  type ZoiInstance
} from './helpers/zoi-app'

const USER = 'Pontin'

test.describe('superficie de UI do codec de video', () => {
  let app: ZoiInstance | null = null
  /** Perfil segurado entre os dois boots do teste de ida e volta. */
  let keptProfile: ZoiInstance | null = null

  test.beforeAll(async () => {
    test.skip(
      !(await signalingIsReachable()),
      'servidor publico do PeerJS (0.peerjs.com) inacessivel: sem sinalizacao nao ha sala para testar'
    )
  })

  test.afterEach(async () => {
    await closeInstance(app)
    await closeInstance(keptProfile)
    app = null
    keptProfile = null
  })

  test('o modo compatibilidade sobrevive a fechar e reabrir o app', async () => {
    app = await launchInstance('A', USER)
    await createRoom(app, uniqueRoomCode('vp8'))

    await app.page.getByTestId('open-settings').click()
    const toggle = app.page.getByTestId('settings-force-vp8')
    await expect(toggle).toBeVisible()
    // Instalacao nova nasce desligada: o codec bom e o padrao.
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    // O toggle e commit imediato (nao depende do botao Salvar): o valor precisa
    // ja estar no main ANTES de fechar, senao o round-trip nao provaria nada.
    await expect
      .poll(async () => app?.page.evaluate('window.zoi.settings.get().then((s) => s.forceVp8)'), {
        timeout: TIMEOUTS.room
      })
      .toBe(true)

    // Fecha o app INTEIRO segurando o perfil no disco.
    const profile = app.userDataDir
    await closeInstance(app, { keepProfile: true })
    app = null

    // Processo novo, MESMA instalacao: sem apelido para digitar e com a
    // configuracao de antes valendo desde o boot.
    keptProfile = await launchInstance('A2', USER, { userDataDir: profile })
    await createRoom(keptProfile, uniqueRoomCode('vp8b'))
    await keptProfile.page.getByTestId('open-settings').click()
    await expect(keptProfile.page.getByTestId('settings-force-vp8')).toHaveAttribute(
      'aria-checked',
      'true'
    )

    expect(keptProfile.consoleErrors).toEqual([])
    expectNoDirectionFallbacks([keptProfile])
  })

  test('o toggle de nitidez alterna ao vivo sem derrubar a transmissao', async () => {
    app = await launchInstance('A', USER)
    await createRoom(app, uniqueRoomCode('sharp'))
    await startTransmission(app)

    const bar = app.page.getByTestId('transmitting-bar')
    const toggle = app.page.getByTestId('sharpness-toggle')
    await expect(toggle).toBeVisible()
    // Toda transmissao nasce com a nitidez desligada (as duas pontas concordam).
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(bar).toBeVisible()

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    // O ponto do teste: trocar a prioridade NAO para nem reinicia a transmissao.
    await expect(bar).toBeVisible()

    // O desenho seguiu o caminho real ate o motor de midia, nao so o estado do
    // React: cada clique deixou a sua linha no log do caminho de midia.
    expect(
      app.consoleLines.filter((line) => line.includes('[codec] modo nitidez ligado')).length
    ).toBeGreaterThan(0)
    expect(
      app.consoleLines.filter((line) => line.includes('[codec] modo nitidez desligado')).length
    ).toBeGreaterThan(0)

    // Transmissao NOVA nasce desligada, mesmo tendo sido ligada antes (RF-19).
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await stopTransmission(app)
    await startTransmission(app)
    await expect(app.page.getByTestId('sharpness-toggle')).toHaveAttribute('aria-checked', 'false')

    await stopTransmission(app)
    expect(app.consoleErrors).toEqual([])
    expectNoDirectionFallbacks([app])
  })
})
