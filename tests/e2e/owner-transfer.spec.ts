// Transferencia voluntaria de posse (RF-35) com QUATRO instancias reais.
//
// Regressao de um bug de protocolo achado no teste end-to-end: o OWNER_TRANSFER
// do dono que sai e o ROSTER_UPDATE do sucessor viajam por links diferentes, e
// quem recebia o snapshot antes de adotar o novo dono rejeitava tudo e ficava
// com o roster velho para sempre. Por isso o roteiro sai da sala com o mesh
// recem-formado (sem espera artificial): e essa janela que expunha a corrida.
//
// A quarta instancia entra DEPOIS da transferencia: prova que o door peer
// migrou de verdade (o id da sala e global no PeerJS, entao o dono que sai tem
// de liberar antes de anunciar).
import { expect, test } from '@playwright/test'
import {
  closeInstance,
  createRoom,
  expectRoster,
  joinRoom,
  launchInstance,
  participantCard,
  signalingIsReachable,
  uniqueRoomCode,
  type ZoiInstance
} from './helpers/zoi-app'

const OWNER = 'Pontin'
const SUCCESSOR = 'Bruna'
const WITNESS = 'Caio'
const LATECOMER = 'Duda'

test.describe('transferencia voluntaria de posse (4 instancias)', () => {
  const instances: ZoiInstance[] = []

  test.beforeAll(async () => {
    test.skip(
      !(await signalingIsReachable()),
      'servidor publico do PeerJS (0.peerjs.com) inacessivel: sem sinalizacao nao ha sala para testar'
    )
  })

  test.afterEach(async () => {
    for (const instance of instances.splice(0).reverse()) await closeInstance(instance)
  })

  test('o dono sai, a coroa migra e a sala segue recebendo gente', async () => {
    const code = uniqueRoomCode('own')

    const owner = await launchInstance('A', OWNER)
    instances.push(owner)
    const successor = await launchInstance('B', SUCCESSOR)
    instances.push(successor)
    const witness = await launchInstance('C', WITNESS)
    instances.push(witness)

    await createRoom(owner, code)
    await joinRoom(successor, code)
    await joinRoom(witness, code)

    const everyone = [OWNER, SUCCESSOR, WITNESS]
    await expectRoster(owner, everyone)
    await expectRoster(successor, everyone)
    await expectRoster(witness, everyone)

    // 1. Saida voluntaria do dono pela UI.
    await owner.page.getByTestId('leave-room').click()
    await expect(owner.page.getByTestId('greeting')).toBeVisible()

    // 2. Os dois que ficaram convergem: roster menor e coroa no mais antigo.
    await expectRoster(successor, [SUCCESSOR, WITNESS])
    await expectRoster(witness, [SUCCESSOR, WITNESS])
    await expect(participantCard(successor, SUCCESSOR).getByTitle('dono da sala')).toHaveCount(1)
    await expect(participantCard(witness, SUCCESSOR).getByTitle('dono da sala')).toHaveCount(1)

    // 3. A porta e do novo dono: alguem novo entra pelo MESMO codigo.
    const latecomer = await launchInstance('D', LATECOMER)
    instances.push(latecomer)
    await joinRoom(latecomer, code)

    const afterJoin = [SUCCESSOR, WITNESS, LATECOMER]
    await expectRoster(latecomer, afterJoin)
    await expectRoster(successor, afterJoin)
    await expectRoster(witness, afterJoin)
  })
})
