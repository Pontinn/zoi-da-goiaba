// Sprint 10, item 6 da SPEC: sessao completa de ponta a ponta entre DUAS
// instancias reais do app na mesma maquina, contra o servidor PUBLICO do PeerJS.
//
// Roteiro: A abre pela primeira vez e cria a sala, B entra pelo codigo, os dois
// veem o mesmo roster, A transmite um monitor de verdade, B ve a miniatura ao
// vivo e abre o player, A para, a grade de B esvazia, B sai, A sai.
//
// Os asserts sao de UI (presenca e texto), como manda a SPEC: qualidade de
// video e audio ficam no checklist manual.
import { expect, test } from '@playwright/test'
import {
  closeInstance,
  createRoom,
  expectNoDirectionFallbacks,
  expectRoster,
  joinRoom,
  launchInstance,
  leaveRoom,
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

test.describe('smoke de sessao (2 instancias)', () => {
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

  test('cria sala, entra pelo codigo, transmite, assiste e sai', async () => {
    const code = uniqueRoomCode()

    // 1. Duas instancias isoladas, cada uma passando pela primeira execucao.
    owner = await launchInstance('A', OWNER)
    guest = await launchInstance('B', GUEST)

    // 2. Sala criada pelo dono com codigo personalizado unico da execucao.
    await createRoom(owner, code)
    await expectRoster(owner, [OWNER])

    // 3. Ingresso pelo codigo (digitado em maiusculas, AC-29).
    await joinRoom(guest, code)

    // 4. Roster identico e sincronizado nos dois lados (RF-14).
    await expectRoster(owner, [OWNER, GUEST])
    await expectRoster(guest, [OWNER, GUEST])
    await expect(guest.page.getByTestId('room-code')).toHaveText(code)

    // 5. Antes de qualquer transmissao, a grade mostra o estado vazio.
    await expect(guest.page.getByTestId('stream-thumb')).toHaveCount(0)
    await expect(guest.page.getByText('Ninguem esta transmitindo ainda')).toBeVisible()

    // 6. Transmissao real de um monitor, com fonte escolhida pelo seletor.
    await startTransmission(owner, { presetId: 'p720_30', withAudio: false })
    await expect(owner.page.getByTestId('transmitting-bar')).toContainText('720p30')

    // 6b. Estado de captura de audio no log (RF-04/AC-03): uma linha por
    //     transmissao, distinguindo os tres caminhos possiveis. O unico
    //     deterministico aqui e o `none` (a suite transmite sem audio e o
    //     helper desliga a exclusao por processo); os outros dois dependeriam
    //     da placa de som de quem roda e ficam no checklist manual.
    const broadcaster = owner
    await expect
      .poll(
        () =>
          broadcaster.consoleLines.filter((line) =>
            /\[audio\] transmissao [0-9a-f-]{36} captura=none/.test(line)
          ).length,
        { timeout: TIMEOUTS.media }
      )
      .toBeGreaterThan(0)

    // 7. O espectador recebe a transmissao e o card do dono fica "ao vivo".
    const guestThumb = guest.page.getByTestId('stream-thumb')
    await expect(guestThumb).toHaveCount(1, { timeout: TIMEOUTS.media })
    await expect(guestThumb.first()).toContainText(OWNER)

    // 8. Clicar na miniatura abre o player com a mesma transmissao.
    await guestThumb.first().click()
    await expect(guest.page.getByTestId('player')).toBeVisible({ timeout: TIMEOUTS.media })
    await expect(guest.page.getByTestId('player-preset')).toHaveText('720p30')

    // 8b. Com o video fluindo, o aviso de espera do primeiro quadro esta
    //     AUSENTE neste estado final do caminho feliz (uma presenca transitoria
    //     anterior, amortecida pela carencia, seria aceitavel e nao e negada
    //     aqui). Junto com os outros dois overlays ausentes, e a precedencia
    //     RF-08 conferida no app buildado.
    const watching = guest
    await expect(guest.page.getByTestId('waiting-overlay')).toHaveCount(0, {
      timeout: TIMEOUTS.media
    })
    await expect(guest.page.getByTestId('reconnect-overlay')).toHaveCount(0)
    await expect(guest.page.getByTestId('media-failure')).toHaveCount(0)

    // 8c. O instrumento de diagnostico saiu de verdade (RF-16/AC-14): a linha
    //     do tempo ate o primeiro quadro aparece no console do renderer, que o
    //     file-logger do main ja espelha no arquivo do dia.
    await expect
      .poll(
        () =>
          watching.consoleLines.filter((line) => line.includes('[player] primeiro quadro'))
            .length,
        { timeout: TIMEOUTS.media }
      )
      .toBeGreaterThan(0)

    // 8d. Instrumento de codec (RF-11/AC-12/AC-28): o transmissor registra o
    //     codec e o encoder REAIS por conexao e o espectador registra o que
    //     esta recebendo. Sem depender de hardware especifico: o que se exige e
    //     a linha existir, nao qual codec foi negociado.
    const transmitter = owner
    await expect
      .poll(
        () => transmitter.consoleLines.filter((line) => /\[codec\] envio .*impl=/.test(line)).length,
        { timeout: TIMEOUTS.media }
      )
      .toBeGreaterThan(0)
    await expect
      .poll(
        () => watching.consoleLines.filter((line) => line.includes('[codec] recepcao ')).length,
        { timeout: TIMEOUTS.media }
      )
      .toBeGreaterThan(0)

    // 9. Controles somem sozinhos sem atividade e voltam ao mexer o mouse
    //    (RNF-07). O auto-hide e por classe, o elemento continua no DOM.
    const controls = guest.page.getByTestId('player-controls')
    await expect(controls).toHaveAttribute('data-visible', 'false', { timeout: 20_000 })
    await wakePlayerControls(guest)

    // 10. Voltar do player para a grade nao derruba a transmissao.
    await guest.page.getByTestId('player-back').click()
    await expect(guest.page.getByTestId('player')).toHaveCount(0)
    await expect(guestThumb).toHaveCount(1)

    // 11. O dono encerra: a grade do espectador esvazia (RF-20).
    await stopTransmission(owner)
    await expect(guestThumb).toHaveCount(0, { timeout: TIMEOUTS.media })
    await expect(guest.page.getByText('Ninguem esta transmitindo ainda')).toBeVisible()

    // 12. Saida limpa dos dois lados.
    await leaveRoom(guest)
    await expectRoster(owner, [OWNER])
    await leaveRoom(owner)

    // 13. Nada disso pode ter passado por fallback de direcao: entre duas
    //     instancias da mesma maquina o caminho normal tem que bastar.
    expectNoDirectionFallbacks([owner, guest])
  })
})
