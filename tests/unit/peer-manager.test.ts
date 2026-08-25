// Saude da sinalizacao (SPEC secao 2.7, item 1) exercitada na classe REAL do
// peer-manager com uma fabrica de `Peer` falsa. O que se testa aqui e a maquina
// de recuperacao (reconnect, re-registro do door, verificacao periodica e a
// trava de saida voluntaria), nao o PeerJS.
//
// A falsificacao imita a semantica do PeerJS 1.5: `destroy()` chama `disconnect()`
// por dentro, e `disconnect()` emite `disconnected`. E dai que vinha o aviso de
// "conexao caiu" ao SAIR da sala de proposito.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Peer from 'peerjs'
import { SIGNALING_HEALTH_CHECK_INTERVAL_MS } from '@shared/config'
import { toPeerId } from '@renderer/core/room-code'
import {
  PeerManager,
  RoomCodeUnavailableError,
  type DoorHealth
} from '@renderer/services/peer-manager'

const CODE = 'sala-teste'
const DOOR_ID = toPeerId(CODE)

interface Entry {
  fn: (arg?: never) => void
  once: boolean
}

class FakePeer {
  open = false
  destroyed = false
  disconnected = false
  reconnectCalls = 0
  /** O que o "servidor" responde ao proximo `reconnect()` (assincrono). */
  onReconnect: (() => void) | null = null

  private readonly handlers = new Map<string, Entry[]>()

  constructor(readonly id: string) {}

  on(event: string, fn: (arg?: never) => void): this {
    const list = this.handlers.get(event) ?? []
    list.push({ fn, once: false })
    this.handlers.set(event, list)
    return this
  }

  once(event: string, fn: (arg?: never) => void): this {
    const list = this.handlers.get(event) ?? []
    list.push({ fn, once: true })
    this.handlers.set(event, list)
    return this
  }

  off(event: string, fn: (arg?: never) => void): this {
    const list = this.handlers.get(event) ?? []
    this.handlers.set(
      event,
      list.filter((entry) => entry.fn !== fn)
    )
    return this
  }

  emit(event: string, arg?: unknown): void {
    const list = this.handlers.get(event) ?? []
    this.handlers.set(
      event,
      list.filter((entry) => !entry.once)
    )
    for (const entry of list) entry.fn(arg as never)
  }

  /** O servidor aceitou o registro (ou o re-registro). */
  accept(): void {
    this.open = true
    this.disconnected = false
    this.emit('open', this.id)
  }

  /** O servidor recusou o id / a rede caiu durante o registro. */
  fail(type: string): void {
    this.emit('error', { type, message: `falha simulada: ${type}` })
  }

  /** Queda percebida: o PeerJS avisa com `disconnected`. */
  disconnect(): void {
    if (this.disconnected) return
    this.disconnected = true
    this.open = false
    this.emit('disconnected', this.id)
  }

  /** Queda SILENCIOSA: o registro sumiu no servidor e nenhum evento chegou. */
  dropSilently(): void {
    this.open = false
    this.disconnected = true
  }

  reconnect(): void {
    this.reconnectCalls += 1
    const answer = this.onReconnect
    if (answer) void Promise.resolve().then(answer)
  }

  destroy(): void {
    if (this.destroyed) return
    this.disconnect()
    this.destroyed = true
    this.emit('close')
  }

  connect(): unknown {
    throw new Error('nao usado')
  }
}

type Behavior = (peer: FakePeer, index: number) => void

/** Padrao: o servidor aceita o registro no proximo microtask. */
const acceptSoon: Behavior = (peer) => {
  void Promise.resolve().then(() => peer.accept())
}

function setup(behavior: Behavior = acceptSoon): {
  manager: PeerManager
  created: FakePeer[]
  doorHealth: DoorHealth[]
  signaling: boolean[]
} {
  const created: FakePeer[] = []
  const doorHealth: DoorHealth[] = []
  const signaling: boolean[] = []

  const manager = new PeerManager(
    {
      onMeshConnection: () => {},
      onDoorConnection: () => {},
      onCall: () => {},
      onSignalingChange: (connected) => signaling.push(connected),
      onDoorHealth: (health) => doorHealth.push(health),
      onMemberError: () => {}
    },
    (id) => {
      const peer = new FakePeer(id ?? `member-${created.length}`)
      created.push(peer)
      behavior(peer, created.length - 1)
      return peer as unknown as Peer
    }
  )

  return { manager, created, doorHealth, signaling }
}

/** Deixa correr os microtasks e os timers pendentes ate `ms`. */
async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
}

describe('peer-manager / saude da porta da sala', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('porta que perde a sinalizacao reconecta o MESMO peer', async () => {
    const { manager, created, doorHealth } = setup()
    await manager.openDoor(CODE, 'create')
    expect(doorHealth).toEqual(['open'])

    const door = created[0]!
    door.onReconnect = () => door.accept()
    door.disconnect()
    await settle(50)

    expect(door.reconnectCalls).toBe(1)
    // Reconexao nao recria o peer: o id da porta continua o mesmo objeto.
    expect(created).toHaveLength(1)
    expect(manager.doorStatus).toBe('open')
    expect(doorHealth).toEqual(['open', 'recovering', 'open'])
    manager.destroy()
  })

  it('reconnect que falha faz a porta ser RECRIADA com o mesmo id', async () => {
    const { manager, created } = setup()
    await manager.openDoor(CODE, 'create')

    const door = created[0]!
    // O servidor recusa a volta (id ainda preso ao socket anterior).
    door.onReconnect = () => door.fail('network')
    door.disconnect()
    await settle(100)

    expect(created).toHaveLength(2)
    expect(created[1]!.id).toBe(DOOR_ID)
    expect(created[0]!.destroyed).toBe(true)
    expect(manager.doorStatus).toBe('open')
    manager.destroy()
  })

  it('peer da porta destruido pelo PeerJS e re-registrado', async () => {
    const { manager, created } = setup()
    await manager.openDoor(CODE, 'create')

    created[0]!.destroy()
    await settle(100)

    expect(created).toHaveLength(2)
    expect(created[1]!.id).toBe(DOOR_ID)
    expect(manager.doorStatus).toBe('open')
    manager.destroy()
  })

  it('queda SILENCIOSA da porta e pega pela verificacao periodica', async () => {
    const { manager, created } = setup()
    await manager.openDoor(CODE, 'create')
    manager.startHealthChecks()

    const door = created[0]!
    door.onReconnect = () => door.accept()
    // Nenhum evento: para o app a sala continua com cara de saudavel.
    door.dropSilently()
    expect(manager.doorStatus).toBe('open')

    await settle(SIGNALING_HEALTH_CHECK_INTERVAL_MS + 100)

    expect(door.reconnectCalls).toBe(1)
    expect(manager.doorStatus).toBe('open')
    manager.destroy()
  })

  it('verificacao sob demanda (retomada de suspensao) recupera na hora', async () => {
    const { manager, created } = setup()
    await manager.openDoor(CODE, 'create')

    const door = created[0]!
    door.onReconnect = () => door.accept()
    door.dropSilently()

    manager.checkSignalingHealth()
    await settle(50)

    expect(door.reconnectCalls).toBe(1)
    expect(manager.doorStatus).toBe('open')
    manager.destroy()
  })

  it('porta liberada de proposito nao volta sozinha', async () => {
    const { manager, created } = setup()
    await manager.openDoor(CODE, 'create')

    // Transferencia de posse: quem sai FECHA a porta e nao deve reabri-la.
    manager.closeDoor()
    await settle(SIGNALING_HEALTH_CHECK_INTERVAL_MS * 2)

    expect(created).toHaveLength(1)
    expect(manager.hasDoor).toBe(false)
    expect(manager.doorStatus).toBe('closed')
    manager.destroy()
  })

  it('codigo em uso na CRIACAO nao deixa porta pendurada em recuperacao', async () => {
    const { manager, created } = setup((peer) => {
      void Promise.resolve().then(() => peer.fail('unavailable-id'))
    })

    await expect(manager.openDoor(CODE, 'create')).rejects.toBeInstanceOf(
      RoomCodeUnavailableError
    )
    await settle(200)

    expect(created).toHaveLength(1)
    expect(manager.hasDoor).toBe(false)
    manager.destroy()
  })
})

describe('peer-manager / saude do member peer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reconecta a sinalizacao sem trocar o peerId do membro', async () => {
    const { manager, created, signaling } = setup()
    const peerId = await manager.startMemberPeer()

    const member = created[0]!
    member.onReconnect = () => member.accept()
    member.disconnect()
    await settle(50)

    expect(member.reconnectCalls).toBe(1)
    // O peerId esta no roster de todo mundo: recriar o peer quebraria a sala.
    expect(created).toHaveLength(1)
    expect(manager.memberPeerId).toBe(peerId)
    // O `open` inicial nao e reportado (nao houve queda); a VOLTA, sim.
    expect(signaling).toEqual([false, true])
    manager.destroy()
  })

  it('insiste com backoff enquanto o servidor nao responde', async () => {
    const { manager, created } = setup()
    await manager.startMemberPeer()

    const member = created[0]!
    member.disconnect()
    await settle(5_000)

    // Tentativa imediata + backoff 1s + 2s: tres tentativas em 5s.
    expect(member.reconnectCalls).toBe(3)
    manager.destroy()
  })

  it('saida voluntaria NAO vira aviso de queda de conexao', async () => {
    const { manager, signaling } = setup()
    await manager.startMemberPeer()
    expect(signaling).toEqual([])

    // `destroy()` do PeerJS emite `disconnected` por dentro: sem a trava de
    // saida, o usuario via "conexao caiu; reconectando..." ao clicar em Sair.
    manager.destroy()
    await settle(100)

    expect(signaling).toEqual([])
  })

  it('sessao nova depois de sair da sala volta a monitorar a sinalizacao', async () => {
    const { manager, created, signaling } = setup()
    await manager.startMemberPeer()
    manager.destroy()

    // `session.reset()` reaproveita o mesmo peer-manager para a proxima sala.
    ;(manager as unknown as { memberPeer: unknown }).memberPeer = null
    await manager.startMemberPeer()

    const member = created[1]!
    member.onReconnect = () => member.accept()
    member.disconnect()
    await settle(50)

    expect(member.reconnectCalls).toBe(1)
    expect(signaling.slice(-2)).toEqual([false, true])
  })
})
