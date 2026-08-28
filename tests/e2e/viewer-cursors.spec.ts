// Ponteiros dos espectadores (viewer-cursors) com instancias reais do app.
//
// A invariante central da feature (RF-05) e que a posicao do cursor viaja como
// DADO e nunca como PIXEL: quem aponta NUNCA ve o proprio cursor, nem no video
// que recebe nem no DOM. O e2e prova a metade que ele consegue provar (o
// marcador nao e RENDERIZADO na pagina de quem aponta, e E renderizado na de
// quem so assiste); a outra metade, os PIXELS do video, fica no checklist
// manual, porque nenhum assert de DOM alcanca o conteudo de uma stream.
//
// Armadilha que este spec trata de proposito: a validacao de posicao do
// `CursorHub` so aceita quem ja anunciou `WATCHING_UPDATE`, e esse anuncio tem
// debounce de 300ms mais o tempo de rede. Mexer o mouse antes disso faria TODA
// posicao ser descartada em silencio. Por isso o teste espera o rotulo de
// "assistindo" aparecer no card da Bruna antes do primeiro `page.mouse.move`.
import { expect, test } from '@playwright/test'
import {
  captureTargetDisplay,
  closeInstance,
  createRoom,
  expectNoDirectionFallbacks,
  expectNoPointerOverlay,
  expectRoster,
  joinRoom,
  launchInstance,
  participantCard,
  pointerOverlayBounds,
  pointerOverlayPage,
  selectMonitorSource,
  signalingIsReachable,
  startTransmission,
  stopTransmission,
  TIMEOUTS,
  uniqueRoomCode,
  type ZoiInstance
} from './helpers/zoi-app'

const LEO = 'Leo'
const BRUNA = 'Bruna'
const JOAO = 'Joao'

/**
 * Aponta ate o marcador aparecer (ou sumir) do outro lado.
 *
 * Um par unico de `mouse.move` nao serve, e isto foi observado falhando: quem
 * aponta so ENVIA quando a posicao MUDA, e o receptor descarta em silencio toda
 * posicao que chega antes de `watching` convergir. Com um par unico de
 * movimentos, tudo o que resta e uma posicao parada que nunca mais e enviada, e
 * o teste espera para sempre por um marcador que nao vem. Alternar entre dois
 * pontos ate a condicao valer e o que a pessoa de verdade faz, e nao enfraquece
 * a assercao: se a feature estiver quebrada, o laco estoura o prazo.
 */
async function pointUntil(
  pointer: ZoiInstance,
  x: number,
  y: number,
  condition: () => Promise<void>
): Promise<void> {
  await expect(async () => {
    await pointer.page.mouse.move(x - 20, y - 20)
    await pointer.page.mouse.move(x, y)
    await condition()
  }).toPass({ timeout: TIMEOUTS.media })
}

/** Abre o player da unica transmissao no ar pela miniatura da grade. */
async function openPlayer(instance: ZoiInstance): Promise<void> {
  const thumb = instance.page.getByTestId('stream-thumb').first()
  await expect(thumb).toBeVisible({ timeout: TIMEOUTS.media })
  await thumb.click()
  await expect(instance.page.getByTestId('player-controls')).toBeVisible({
    timeout: TIMEOUTS.media
  })
}

test.describe('ponteiros dos espectadores', () => {
  let leo: ZoiInstance | null = null
  let bruna: ZoiInstance | null = null
  let joao: ZoiInstance | null = null

  test.beforeAll(async () => {
    test.skip(
      !(await signalingIsReachable()),
      'servidor publico do PeerJS (0.peerjs.com) inacessivel: sem sinalizacao nao ha sala para testar'
    )
  })

  test.afterEach(async () => {
    await closeInstance(joao)
    await closeInstance(bruna)
    await closeInstance(leo)
    joao = null
    bruna = null
    leo = null
  })

  test('o toggle nasce desligado, some com fonte de janela e nao persiste entre transmissoes', async () => {
    leo = await launchInstance('A', LEO)
    await createRoom(leo, uniqueRoomCode('ptr'))
    const { page } = leo

    // AC-01: com um MONITOR selecionado, o controle nasce desligado.
    await page.getByTestId('transmit-button').click()
    await selectMonitorSource(leo)
    const toggle = page.getByTestId('pointer-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    // AC-02/RF-04: com uma JANELA, o controle continua VISIVEL e desabilitado,
    // com a explicacao ao lado. Esconder o controle faz este teste falhar.
    await page.getByRole('tab', { name: 'Janelas' }).click()
    const windows = page.getByTestId('capture-source')
    await expect(windows.first()).toBeVisible({ timeout: TIMEOUTS.media })
    await windows.first().click()
    await expect(toggle).toBeVisible()
    await expect(toggle).toBeDisabled()
    await expect(toggle).toContainText('Disponivel apenas ao compartilhar um monitor inteiro.')

    // AC-04/RF-03: transmitir com ponteiros, parar, e o proximo seletor nasce
    // desligado de novo. Nada e persistido em lugar nenhum.
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await startTransmission(leo, { pointers: true })
    await pointerOverlayPage(leo)
    await stopTransmission(leo)
    await expectNoPointerOverlay(leo)

    await page.getByTestId('transmit-button').click()
    await selectMonitorSource(leo)
    await expect(page.getByTestId('pointer-toggle')).toHaveAttribute('aria-checked', 'false')

    expectNoDirectionFallbacks([leo])
  })

  test('a camada de overlay sobe e desce pelo toggle da barra, sem reiniciar a transmissao', async () => {
    leo = await launchInstance('A', LEO)
    await createRoom(leo, uniqueRoomCode('ptr'))

    // AC-11/RF-07: transmissao no ar com os ponteiros DESLIGADOS, sem overlay.
    await startTransmission(leo)
    await expectNoPointerOverlay(leo)

    // AC-03/RF-02: ligar ao vivo sobe a janela e a barra continua no ar.
    const bar = leo.page.getByTestId('transmitting-bar')
    const toggle = leo.page.getByTestId('pointer-toggle-bar')
    await expect(toggle).toBeEnabled()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await pointerOverlayPage(leo)
    await expect(bar).toBeVisible()

    // RF-08: o overlay cobre o monitor CAPTURADO, inteiro e so ele. Numa
    // maquina com dois monitores o e2e captura o secundario de proposito, entao
    // este assert tambem prova que a camada sempre-no-topo nao caiu na tela em
    // que a pessoa esta trabalhando. Com um monitor so, capturado e primario
    // sao o mesmo e o assert continua valendo.
    const captured = await captureTargetDisplay(leo)
    expect(await pointerOverlayBounds(leo)).toEqual(captured.bounds)

    // AC-12/RF-10: parar com os ponteiros ligados nao deixa janela orfa.
    await stopTransmission(leo)
    await expectNoPointerOverlay(leo)

    expectNoDirectionFallbacks([leo])
  })

  test('o cursor de quem aponta aparece para o outro espectador e nunca para ela mesma', async () => {
    const code = uniqueRoomCode('ptr')
    leo = await launchInstance('A', LEO)
    await createRoom(leo, code)
    bruna = await launchInstance('B', BRUNA)
    await joinRoom(bruna, code)
    joao = await launchInstance('C', JOAO)
    await joinRoom(joao, code)
    await expectRoster(leo, [LEO, BRUNA, JOAO])

    await startTransmission(leo, { pointers: true })
    await pointerOverlayPage(leo)

    await openPlayer(bruna)
    await openPlayer(joao)

    // A janela do debounce de WATCHING_UPDATE: sem esta espera, toda posicao da
    // Bruna seria descartada em silencio e o teste flakearia. O sinal ja existe
    // na UI e sai do MESMO dado que alimenta a validacao (`room.watching`).
    await expect(participantCard(leo, BRUNA)).toContainText(LEO, { timeout: TIMEOUTS.room })
    await expect(participantCard(leo, JOAO)).toContainText(LEO, { timeout: TIMEOUTS.room })

    // AC-06/AC-14: a Bruna aponta o centro do conteudo do video.
    const box = await bruna.page.locator('.z-player__video').boundingBox()
    expect(box, 'a caixa do video deveria existir').not.toBeNull()
    const centerX = Math.round(box!.x + box!.width / 2)
    const centerY = Math.round(box!.y + box!.height / 2)

    const brunaPeerId = await selfPeerIdOf(bruna)
    expect(brunaPeerId.length, 'peerId da Bruna deveria estar no card dela').toBeGreaterThan(0)
    const brunaMarkerOnJoao = joao.page.locator(
      `[data-testid="cursor-marker"][data-peer-id="${brunaPeerId}"]`
    )
    await pointUntil(bruna, centerX, centerY, async () => {
      await expect(brunaMarkerOnJoao).toHaveCount(1, { timeout: 2_000 })
    })
    await expect(brunaMarkerOnJoao).toBeVisible()
    await expect(brunaMarkerOnJoao).toContainText(BRUNA)

    // AC-07/RF-14: a propria Bruna nao tem NENHUM marcador na tela.
    await expect(bruna.page.getByTestId('cursor-marker')).toHaveCount(0)

    // AC-16/RF-17: a faixa preta do letterbox encerra o ponteiro, nao o prende
    // na borda. A faixa de cima so existe se o video for proporcionalmente MAIS
    // LARGO que a caixa do player (`object-fit: contain`), e a proporcao do
    // video e a do monitor capturado. Isso era implicito enquanto o e2e sempre
    // capturava o primario; agora que ele prefere o secundario, a dependencia
    // fica explicita aqui em vez de virar uma falha misteriosa em quem tiver
    // dois monitores de proporcoes diferentes.
    const captured = await captureTargetDisplay(leo)
    expect(
      captured.bounds.width / captured.bounds.height,
      'o monitor capturado precisa ser mais largo que a caixa do player, senao nao ha letterbox no topo'
    ).toBeGreaterThan(box!.width / box!.height)

    await pointUntil(bruna, centerX, Math.round(box!.y + 2), async () => {
      await expect(brunaMarkerOnJoao).toHaveCount(0, { timeout: 2_000 })
    })

    // Este teste ligou os ponteiros: encerrar a transmissao e provar que a
    // janela de overlay NAO ficou por cima da tela real da maquina de teste.
    await stopTransmission(leo)
    await expectNoPointerOverlay(leo)

    expectNoDirectionFallbacks([leo, bruna, joao])
  })
})

/** peerId da propria instancia, lido do card marcado como "voce" no roster. */
async function selfPeerIdOf(instance: ZoiInstance): Promise<string> {
  return instance.page.evaluate<string>(
    "document.querySelector('.z-participant--self')?.getAttribute('data-peer-id') ?? ''"
  )
}
