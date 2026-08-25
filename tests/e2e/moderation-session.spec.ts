// Sprint 10, item 7 da SPEC: extensao do smoke com moderacao real.
//
// Sao TRES instancias de proposito: alem do dono e do alvo, a terceira prova que
// o roster converge para todo mundo (nao so para quem executou a acao). Roteiro:
// dono desconecta o alvo pela UI, o alvo cai na tela "Voce foi desconectado", os
// dois que ficaram veem o roster encolher, e o alvo REENTRA com o mesmo codigo
// (RF-31 e RF-32: kick nao e banimento).
import { expect, test } from '@playwright/test'
import {
  backToHome,
  closeInstance,
  createRoom,
  expectRoster,
  joinRoom,
  launchInstance,
  leaveRoom,
  moderate,
  participantCard,
  signalingIsReachable,
  uniqueRoomCode,
  type ZoiInstance
} from './helpers/zoi-app'

const OWNER = 'Pontin'
const TARGET = 'Bruna'
const WITNESS = 'Caio'

test.describe('moderacao do dono (3 instancias)', () => {
  let owner: ZoiInstance | null = null
  let target: ZoiInstance | null = null
  let witness: ZoiInstance | null = null

  test.beforeAll(async () => {
    test.skip(
      !(await signalingIsReachable()),
      'servidor publico do PeerJS (0.peerjs.com) inacessivel: sem sinalizacao nao ha sala para testar'
    )
  })

  test.afterEach(async () => {
    await closeInstance(witness)
    await closeInstance(target)
    await closeInstance(owner)
    witness = null
    target = null
    owner = null
  })

  test('dono desconecta um participante e ele consegue reentrar', async () => {
    const code = uniqueRoomCode('mod')

    owner = await launchInstance('A', OWNER)
    target = await launchInstance('B', TARGET)
    witness = await launchInstance('C', WITNESS)

    // 1. Sala com tres pessoas e roster identico nas tres instancias.
    await createRoom(owner, code)
    await joinRoom(target, code)
    await joinRoom(witness, code)

    const everyone = [OWNER, TARGET, WITNESS]
    await expectRoster(owner, everyone)
    await expectRoster(target, everyone)
    await expectRoster(witness, everyone)

    // 2. So o dono ve acoes de moderacao, e nunca no proprio card (RF-34/AC-19).
    await expect(
      participantCard(owner, OWNER).getByRole('button', { name: `Acoes para ${OWNER}` })
    ).toHaveCount(0)
    await expect(
      participantCard(target, WITNESS).getByRole('button', { name: `Acoes para ${WITNESS}` })
    ).toHaveCount(0)

    // 3. Desconectar pela UI do dono (RF-31).
    await moderate(owner, TARGET, 'kick')

    // 4. O alvo cai na tela terminal com o motivo correto.
    await expect(target.page.getByText('Voce foi desconectado')).toBeVisible()

    // 5. Quem ficou converge para dois participantes, nas DUAS instancias.
    await expectRoster(owner, [OWNER, WITNESS])
    await expectRoster(witness, [OWNER, WITNESS])

    // 6. Kick nao e banimento: o alvo entra de novo com o mesmo codigo (RF-32).
    await backToHome(target)
    await joinRoom(target, code)

    await expectRoster(target, everyone)
    await expectRoster(owner, everyone)
    await expectRoster(witness, everyone)

    // 7. Saida limpa das tres instancias.
    await leaveRoom(witness)
    await leaveRoom(target)
    await leaveRoom(owner)
  })
})
