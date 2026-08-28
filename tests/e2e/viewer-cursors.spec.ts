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
import { expect, test, type Locator, type Page } from '@playwright/test'
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

/**
 * `CURSOR_IDLE_MS` de `@shared/config`, repetido aqui porque o e2e nao importa
 * `@shared` (mesmo motivo do `PRESET_TESTIDS` do helper).
 */
const CURSOR_IDLE_MS = 5_000

/**
 * Excecoes nao tratadas de TODAS as janelas da instancia, inclusive as que ainda
 * nao existem: a janela de overlay de ponteiros nasce e morre a cada ciclo do
 * toggle, e um erro dentro dela nunca apareceria no `consoleErrors` do helper,
 * que so escuta a janela principal. O ACHADO F1 da rodada de teste era
 * exatamente uma excecao de `removeChild` que ninguem conseguia atribuir a uma
 * janela: sem esta rede, um erro assim volta a passar despercebido.
 */
function watchWindowErrors(instance: ZoiInstance, sink: string[]): void {
  const attach = (page: Page): void => {
    const kind = page.url().includes('overlay.html') ? 'overlay' : 'principal'
    page.on('pageerror', (error) => {
      sink.push(`[${instance.label} ${kind}] ${error.stack ?? error.message}`)
    })
  }
  for (const page of instance.app.windows()) attach(page)
  instance.app.on('window', attach)
}

/** Marcador de um peer DENTRO da janela de overlay do transmissor. */
async function overlayMarker(instance: ZoiInstance, peerId: string): Promise<Locator> {
  const page = await pointerOverlayPage(instance)
  return page.locator(`[data-testid="cursor-marker"][data-peer-id="${peerId}"]`)
}

/**
 * `opacity` computado do marcador de um peer na janela de overlay, ou
 * `'ausente'` quando ele nao esta no DOM. O AC-25 esmaece SEM tirar o elemento
 * da pagina, entao so contar elemento nunca provaria o esmaecimento.
 */
async function overlayMarkerOpacity(instance: ZoiInstance, peerId: string): Promise<string> {
  const page = await pointerOverlayPage(instance)
  return page.evaluate<string>(
    `(() => { const node = document.querySelector('[data-testid="cursor-marker"][data-peer-id="${peerId}"]'); return node === null ? 'ausente' : getComputedStyle(node).opacity })()`
  )
}

/** Centro da area de conteudo do video do player aberto. */
async function videoCenter(instance: ZoiInstance): Promise<{ x: number; y: number }> {
  const box = await instance.page.locator('.z-player__video').boundingBox()
  expect(box, 'a caixa do video deveria existir').not.toBeNull()
  return { x: Math.round(box!.x + box!.width / 2), y: Math.round(box!.y + box!.height / 2) }
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

  /*
   * Sessao LONGA, o roteiro que produziu o ACHADO F1 da rodada de teste: duas
   * transmissoes ao mesmo tempo, a espectadora trocando de txId, o ciclo de
   * ligar e desligar o toggle (RF-27/RF-28), um peer saindo enquanto aponta
   * (RF-29) e perda e retomada de foco (RF-20), tudo em sequencia rapida.
   *
   * O que este teste guarda que nenhum outro guardava:
   * 1. excecao nao tratada em QUALQUER janela, inclusive a de overlay, que nasce
   *    e morre a cada ciclo do toggle e nao era observada por ninguem;
   * 2. a RETOMADA do RF-20 (o ponteiro volta depois do foco), que a rodada de
   *    teste nao conseguiu confirmar;
   * 3. o AC-25 (esmaece parado, volta ao mexer) medido por `opacity` computado,
   *    e nao por presenca no DOM: o marcador inativo CONTINUA no DOM, entao
   *    contar elemento nunca provaria o esmaecimento.
   *
   * O `blur`/`focus` e disparado como evento de janela em vez de mexer no foco
   * do sistema operacional de proposito: com tres janelas do MESMO app na mesma
   * maquina, o foco real nem sempre migra em automacao, e o teste ficaria
   * instavel por um motivo que nao e o produto. O produto escuta exatamente
   * estes dois eventos de `window` (PlayerView), entao o caminho exercitado e o
   * mesmo.
   */
  test('sessao longa com troca de txId, toggle e foco nao deixa excecao e o ponteiro volta', async () => {
    const code = uniqueRoomCode('ptr')
    leo = await launchInstance('A', LEO)
    await createRoom(leo, code)
    bruna = await launchInstance('B', BRUNA)
    await joinRoom(bruna, code)
    joao = await launchInstance('C', JOAO)
    await joinRoom(joao, code)
    await expectRoster(leo, [LEO, BRUNA, JOAO])

    const crashes: string[] = []
    watchWindowErrors(leo, crashes)
    watchWindowErrors(bruna, crashes)
    watchWindowErrors(joao, crashes)

    // Duas transmissoes no ar ao mesmo tempo, as duas com ponteiros ligados.
    await startTransmission(leo, { pointers: true })
    await pointerOverlayPage(leo)
    await startTransmission(joao, { pointers: true })
    await pointerOverlayPage(joao)

    const brunaPeerId = await selfPeerIdOf(bruna)
    expect(brunaPeerId.length, 'peerId da Bruna deveria estar no card dela').toBeGreaterThan(0)

    const thumbLeo = bruna.page.getByTestId('stream-thumb').filter({ hasText: LEO })
    const thumbJoao = bruna.page.getByTestId('stream-thumb').filter({ hasText: JOAO })

    // A Bruna assiste o Leo e aponta.
    await expect(thumbLeo).toBeVisible({ timeout: TIMEOUTS.media })
    await thumbLeo.click()
    await expect(bruna.page.getByTestId('player-controls')).toBeVisible({
      timeout: TIMEOUTS.media
    })
    await expect(participantCard(leo, BRUNA)).toContainText(LEO, { timeout: TIMEOUTS.room })
    let markerOnLeo = await overlayMarker(leo, brunaPeerId)
    let center = await videoCenter(bruna)
    await pointUntil(bruna, center.x, center.y, async () => {
      await expect(markerOnLeo).toHaveCount(1, { timeout: 2_000 })
    })

    // RF-18: troca para a transmissao do Joao e volta para a do Leo.
    await expect(thumbJoao).toBeVisible({ timeout: TIMEOUTS.media })
    await thumbJoao.click()
    await expect(participantCard(joao, BRUNA)).toContainText(JOAO, { timeout: TIMEOUTS.room })
    const markerOnJoao = await overlayMarker(joao, brunaPeerId)
    center = await videoCenter(bruna)
    await pointUntil(bruna, center.x, center.y, async () => {
      await expect(markerOnJoao).toHaveCount(1, { timeout: 2_000 })
    })
    await thumbLeo.click()
    await expect(participantCard(leo, BRUNA)).toContainText(LEO, { timeout: TIMEOUTS.room })
    center = await videoCenter(bruna)
    await pointUntil(bruna, center.x, center.y, async () => {
      await expect(markerOnLeo).toHaveCount(1, { timeout: 2_000 })
    })

    // O Joao TAMBEM assiste o Leo e aponta: a camada da Bruna passa a desenhar
    // um marcador de verdade, e nao so a caixa vazia.
    const joaoThumbLeo = joao.page.getByTestId('stream-thumb').filter({ hasText: LEO })
    await expect(joaoThumbLeo).toBeVisible({ timeout: TIMEOUTS.media })
    await joaoThumbLeo.click()
    await expect(joao.page.getByTestId('player-controls')).toBeVisible({ timeout: TIMEOUTS.media })
    await expect(participantCard(leo, JOAO)).toContainText(LEO, { timeout: TIMEOUTS.room })
    const joaoPeerId = await selfPeerIdOf(joao)
    const joaoCenter = await videoCenter(joao)
    const joaoMarkerOnBruna = bruna.page.locator(
      `[data-testid="cursor-marker"][data-peer-id="${joaoPeerId}"]`
    )
    await pointUntil(joao, joaoCenter.x, joaoCenter.y, async () => {
      await expect(joaoMarkerOnBruna).toHaveCount(1, { timeout: 2_000 })
    })

    // RF-27/RF-28: o transmissor desliga e religa os ponteiros, com os dois
    // espectadores apontando. Cada ciclo derruba e sobe a janela de overlay e
    // desmonta e remonta a camada inteira na tela dos dois.
    const barToggle = leo.page.getByTestId('pointer-toggle-bar')
    for (let round = 0; round < 4; round += 1) {
      await barToggle.click()
      await expect(barToggle).toHaveAttribute('aria-checked', 'false')
      await expectNoPointerOverlay(leo)
      await expect(bruna.page.getByTestId('cursor-layer')).toHaveCount(0)
      await barToggle.click()
      await expect(barToggle).toHaveAttribute('aria-checked', 'true')
      await pointerOverlayPage(leo)
      await joao.page.mouse.move(joaoCenter.x + round, joaoCenter.y + round)
    }
    markerOnLeo = await overlayMarker(leo, brunaPeerId)
    center = await videoCenter(bruna)
    await pointUntil(bruna, center.x, center.y, async () => {
      await expect(markerOnLeo).toHaveCount(1, { timeout: 2_000 })
    })

    // RF-29: o Joao sai da sala enquanto aponta. O marcador dele cai da camada
    // da Bruna pela poda de roster, sem depender de nenhum CURSOR_END.
    await joao.page.mouse.move(joaoCenter.x + 9, joaoCenter.y + 9)
    await closeInstance(joao)
    joao = null
    await expect(joaoMarkerOnBruna).toHaveCount(0, { timeout: 15_000 })

    // RF-20: perde o foco e o ponteiro para na hora; recupera o foco, mexe o
    // mouse, e o ponteiro VOLTA. A retomada e o que a rodada de teste nao tinha
    // conseguido confirmar (ACHADO F1).
    for (let round = 0; round < 3; round += 1) {
      await bruna.page.evaluate("window.dispatchEvent(new Event('blur'))")
      await expect(markerOnLeo).toHaveCount(0, { timeout: 15_000 })
      await bruna.page.evaluate("window.dispatchEvent(new Event('focus'))")
      center = await videoCenter(bruna)
      await pointUntil(bruna, center.x, center.y, async () => {
        await expect(markerOnLeo).toHaveCount(1, { timeout: 5_000 })
      })
    }

    /*
     * O AC-25 NAO mora nesta sessao de proposito, e a razao foi medida: o
     * esmaecimento exige a espectadora PARADA por mais de `CURSOR_IDLE_MS`, e
     * uma janela que perde o foco nesse intervalo tem o ponteiro encerrado pelo
     * RF-20, o que APAGA a entrada no transmissor em vez de deixa-la inativa.
     * Com tres instancias e as janelas de overlay sempre-no-topo disputando o
     * foco do sistema, isso acontecia de vez em quando e o teste acusava um
     * defeito que nao existe. O AC-25 fica no teste seguinte, com duas
     * instancias e sem nada para roubar o foco.
     *
     * `expectNoDirectionFallbacks` tambem nao cabe aqui: o Joao sai da sala no
     * meio, e a chamada de midia que ele nao atende mais faz o outro lado puxar
     * a stream na direcao contraria. O fallback dispara por causa do roteiro, e
     * nao por rede doente.
     */
    await stopTransmission(leo)
    await expectNoPointerOverlay(leo)
    expect(crashes, 'excecao nao tratada em alguma janela do app').toEqual([])
  })

  /*
   * AC-25/RF-26: parada, a seta ESMAECE sem sair da pagina; ao mexer, volta
   * pelo mesmo caminho. Duas instancias e nada mais acontecendo: o esmaecimento
   * so e observavel com a espectadora imovel por mais de `CURSOR_IDLE_MS`, e
   * qualquer evento no meio (perda de foco, troca de transmissao, toggle)
   * encerraria o ponteiro pelo RF-20 e apagaria a entrada, que e um resultado
   * CERTO do produto e um falso negativo para este teste.
   *
   * A medicao e por `opacity` computado, nunca por presenca no DOM: o marcador
   * inativo CONTINUA na pagina, entao contar elemento jamais provaria o
   * esmaecimento (e foi assim que o AC-25 ficou sem cobertura ate agora).
   */
  test('o marcador parado esmaece sem sair do DOM e volta ao mexer', async () => {
    const code = uniqueRoomCode('ptr')
    leo = await launchInstance('A', LEO)
    await createRoom(leo, code)
    bruna = await launchInstance('B', BRUNA)
    await joinRoom(bruna, code)
    await expectRoster(leo, [LEO, BRUNA])

    await startTransmission(leo, { pointers: true })
    await pointerOverlayPage(leo)

    await openPlayer(bruna)
    await expect(participantCard(leo, BRUNA)).toContainText(LEO, { timeout: TIMEOUTS.room })

    const brunaPeerId = await selfPeerIdOf(bruna)
    const marker = await overlayMarker(leo, brunaPeerId)
    const center = await videoCenter(bruna)
    await pointUntil(bruna, center.x, center.y, async () => {
      await expect(marker).toHaveCount(1, { timeout: 2_000 })
    })

    // A partir daqui ninguem mexe o mouse. `'ausente'` na mensagem de falha e o
    // sinal de que o ponteiro foi ENCERRADO (RF-20) em vez de esmaecer, que e
    // um diagnostico diferente de "nao esmaeceu".
    await expect
      .poll(() => overlayMarkerOpacity(leo!, brunaPeerId), {
        message: 'o marcador parado deveria esmaecer sem sair do DOM (AC-25)',
        timeout: CURSOR_IDLE_MS * 3
      })
      .toBe('0')
    await expect(marker, 'esmaecer nao pode significar sair do DOM').toHaveCount(1)

    // Mexer de novo traz a seta de volta pelo mesmo caminho (RF-26).
    await pointUntil(bruna, center.x, center.y, async () => {
      expect(await overlayMarkerOpacity(leo!, brunaPeerId)).toBe('1')
    })

    await stopTransmission(leo)
    await expectNoPointerOverlay(leo)
    expectNoDirectionFallbacks([leo, bruna])
  })
})

/** peerId da propria instancia, lido do card marcado como "voce" no roster. */
async function selfPeerIdOf(instance: ZoiInstance): Promise<string> {
  return instance.page.evaluate<string>(
    "document.querySelector('.z-participant--self')?.getAttribute('data-peer-id') ?? ''"
  )
}
