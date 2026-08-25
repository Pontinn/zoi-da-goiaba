// Regressao do bug de campo: a porta da sala (door peer) perdia o registro na
// nuvem do PeerJS e NUNCA voltava. A sala continuava com cara de saudavel para
// quem ja estava dentro (o mesh e direto por ICE), mas todo mundo que tentava
// entrar depois disso via "Sala nao encontrada.".
//
// O roteiro derruba o websocket da porta exatamente como o servidor faz ao podar
// uma conexao ociosa (`peer.disconnect()` do PeerJS, o mesmo caminho que leva ao
// evento `disconnected`) e cobra o que importa: a porta volta sozinha e um app
// NOVO consegue entrar pelo mesmo codigo.
import { expect, test } from '@playwright/test'
import {
  closeInstance,
  createRoom,
  expectRoster,
  joinRoom,
  launchInstance,
  signalingIsReachable,
  uniqueRoomCode,
  type ZoiInstance
} from './helpers/zoi-app'

const OWNER = 'Pontin'
const GUEST = 'Bruna'

/**
 * Gancho de diagnostico exposto pelo renderer (`__zoiDebug` em `session.ts`).
 * Avaliado como expressao para nao depender das tipagens de DOM aqui.
 */
async function doorHealth(instance: ZoiInstance): Promise<string> {
  return (await instance.page.evaluate('window.__zoiDebug.health().door')) as string
}

async function dropDoorSocket(instance: ZoiInstance): Promise<void> {
  await instance.page.evaluate("window.__zoiDebug.dropSignaling('door')")
}

test.describe('recuperacao da sinalizacao (2 instancias)', () => {
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

  test('porta que perde o registro volta sozinha e a sala continua recebendo gente', async () => {
    const code = uniqueRoomCode('recover')

    owner = await launchInstance('A', OWNER)
    await createRoom(owner, code)
    await expect.poll(() => doorHealth(owner!)).toBe('open')

    // O servidor derruba a conexao: o id da sala deixa de existir na nuvem.
    await dropDoorSocket(owner)

    // A porta volta sozinha, sem ninguem mexer no app.
    await expect.poll(() => doorHealth(owner!), { timeout: 30_000 }).toBe('open')

    // A prova real: uma instancia NOVA entra pelo mesmo codigo.
    guest = await launchInstance('B', GUEST)
    await joinRoom(guest, code)
    await expectRoster(owner, [OWNER, GUEST])
    await expectRoster(guest, [OWNER, GUEST])
  })

  test('sair da sala de proposito nao vira aviso de queda de conexao', async () => {
    const code = uniqueRoomCode('leave')

    owner = await launchInstance('A', OWNER)
    await createRoom(owner, code)

    // `peer.destroy()` emite `disconnected` por dentro: sem a trava de saida, o
    // usuario levava um "conexao caiu; reconectando..." ao clicar em Sair.
    await owner.page.getByTestId('leave-room').click()
    await expect(owner.page.getByTestId('greeting')).toBeVisible()
    await owner.page.waitForTimeout(2_500)
    await expect(owner.page.getByText('sinalizacao caiu')).toHaveCount(0)
  })
})
