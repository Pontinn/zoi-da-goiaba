// Ingresso pelo canal efemero do door (SPEC secao 2.5 e matriz 5c), exercitado
// na classe real da sessao com um PeerManager falso: o que se testa aqui e a
// LEITURA das respostas do door (origem, tipo, ausencia de resposta), nao o
// PeerJS.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  JOIN_PEER_UNAVAILABLE_RETRY_WINDOW_MS,
  JOIN_RESPONSE_TIMEOUT_MS
} from '@shared/config'
import { createEnvelope, type JoinAcceptPayload } from '@shared/protocol'
import { toPeerId } from '@renderer/core/room-code'
import { Session } from '@renderer/services/session'

const CODE = 'sala-teste'
const DOOR_ID = toPeerId(CODE)
const SELF = 'me'

type Handler = (arg: never) => void

/** DataConnection falsa: guarda handlers e o que foi enviado. */
class FakeConnection {
  open = false
  closed = false
  readonly sent: unknown[] = []
  private readonly handlers = new Map<string, Handler[]>()

  constructor(readonly peer: string) {}

  on(event: string, handler: Handler): this {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
    return this
  }

  emit(event: string, arg?: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) handler(arg as never)
  }

  send(payload: unknown): void {
    this.sent.push(payload)
  }

  close(): void {
    this.closed = true
  }
}

function acceptPayload(): JoinAcceptPayload {
  return {
    roomMeta: { code: CODE, limit: 6, createdAt: 0 },
    rosterVersion: 4,
    ownerPeerId: 'dono',
    members: [
      { peerId: 'dono', installId: 'i-dono', nickname: 'Dono', joinedAt: 1, isOwner: true },
      { peerId: SELF, installId: 'i-me', nickname: 'Eu', joinedAt: 2, isOwner: false }
    ],
    banList: []
  }
}

interface SessionOptions {
  /**
   * Simula o `peer-unavailable` que a sinalizacao emite quando o id procurado
   * nao existe. E emitido a cada tentativa de ingresso, como faz o servidor.
   */
  unavailablePeerId?: string
}

function makeSession(options: SessionOptions = {}): {
  session: Session
  doors: FakeConnection[]
  members: Map<string, FakeConnection>
} {
  const session = new Session()
  const doors: FakeConnection[] = []
  const members = new Map<string, FakeConnection>()

  const emitMemberError = (type: string, message: string): void => {
    const listeners = (
      session as unknown as { memberErrorListeners: Set<(t: string, m: string) => void> }
    ).memberErrorListeners
    for (const listener of [...listeners]) listener(type, message)
  }

  const peerManager = {
    memberPeerId: SELF,
    hasDoor: false,
    startMemberPeer: () => Promise.resolve(SELF),
    connectToDoor: () => {
      const connection = new FakeConnection(DOOR_ID)
      doors.push(connection)
      if (options.unavailablePeerId !== undefined) {
        setTimeout(
          () =>
            emitMemberError(
              'peer-unavailable',
              `Could not connect to peer ${options.unavailablePeerId}`
            ),
          1
        )
      }
      return connection
    },
    connectToMember: (peerId: string) => {
      const connection = new FakeConnection(peerId)
      members.set(peerId, connection)
      return connection
    },
    openDoor: () => Promise.resolve(),
    closeDoor: () => {},
    doorStatus: 'closed' as const,
    startHealthChecks: () => {},
    checkSignalingHealth: () => {},
    debugDropSignaling: () => {},
    call: () => {
      throw new Error('nao usado')
    },
    destroy: () => {}
  }
  ;(session as unknown as { peerManager: unknown }).peerManager = peerManager
  session.setIdentity('Eu', 'i-me')
  return { session, doors, members }
}

describe('session / respostas do door no ingresso', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('silencio da porta NAO e acusado como sala inexistente', async () => {
    const { session, doors } = makeSession()
    const promise = session.joinRoom(CODE)
    // Sem `peer-unavailable`, o id da sala EXISTE na sinalizacao: quem falhou
    // foi a conexao entre as duas maquinas, e a mensagem precisa dizer isso.
    const assertion = expect(promise).rejects.toThrowError('Achei a sala, mas a conexao')

    await vi.advanceTimersByTimeAsync(JOIN_PEER_UNAVAILABLE_RETRY_WINDOW_MS + 100)
    await assertion
    expect(doors[0]?.closed).toBe(true)
    session.teardown()
  })

  it('`peer-unavailable` da porta vira "Sala nao encontrada."', async () => {
    // O servidor responde, a cada tentativa, que o id da sala nao existe.
    const { session } = makeSession({ unavailablePeerId: DOOR_ID })
    const promise = session.joinRoom(CODE)
    const assertion = expect(promise).rejects.toThrowError('Sala nao encontrada.')

    await vi.advanceTimersByTimeAsync(JOIN_PEER_UNAVAILABLE_RETRY_WINDOW_MS + 2_000)
    await assertion
    session.teardown()
  })

  it('`peer-unavailable` de OUTRO peer nao e confundido com a porta', async () => {
    const { session } = makeSession({ unavailablePeerId: 'outro-par-qualquer' })
    const promise = session.joinRoom(CODE)
    const assertion = expect(promise).rejects.toThrowError('Achei a sala, mas a conexao')

    await vi.advanceTimersByTimeAsync(JOIN_PEER_UNAVAILABLE_RETRY_WINDOW_MS + 2_000)
    await assertion
    session.teardown()
  })

  it('door que abre e nao responde ganha uma segunda tentativa antes de desistir', async () => {
    const { session, doors } = makeSession()
    const promise = session.joinRoom(CODE)
    await vi.advanceTimersByTimeAsync(1)

    doors[0]?.emit('open')
    expect(doors[0]?.sent).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(JOIN_RESPONSE_TIMEOUT_MS + 100)
    expect(doors).toHaveLength(2)

    doors[1]?.emit('open')
    doors[1]?.emit('data', createEnvelope('JOIN_ACCEPT', acceptPayload(), DOOR_ID, 0))
    await promise

    expect(session.getState().phase).toBe('active')
    expect(session.getState().ownerPeerId).toBe('dono')
    session.teardown()
  })

  it('JOIN_ACCEPT assinado por outro peer que nao o door e ignorado (5c)', async () => {
    const { session, doors } = makeSession()
    const promise = session.joinRoom(CODE)
    // O canal abriu, entao a desistencia final e a de "door nao respondeu".
    const assertion = expect(promise).rejects.toThrowError('Sem resposta da sala.')
    await vi.advanceTimersByTimeAsync(1)

    doors[0]?.emit('open')
    // Envelope perfeito, so que assinado pelo member peer do dono: o candidato
    // valida contra o peerId do DOOR ao qual ELE se conectou.
    doors[0]?.emit('data', createEnvelope('JOIN_ACCEPT', acceptPayload(), 'dono', 0))
    await vi.advanceTimersByTimeAsync(50)
    expect(session.getState().phase).toBe('idle')

    // O canal foi para o timeout como se nada tivesse chegado.
    await vi.advanceTimersByTimeAsync(JOIN_RESPONSE_TIMEOUT_MS + 100)
    doors[1]?.emit('open')
    await vi.advanceTimersByTimeAsync(JOIN_RESPONSE_TIMEOUT_MS + 100)
    await assertion
    session.teardown()
  })

  it('JOIN_REJECT do door vira o erro com a mensagem da razao (RF-33)', async () => {
    const { session, doors } = makeSession()
    const promise = session.joinRoom(CODE)
    const assertion = expect(promise).rejects.toThrowError('Voce esta banido desta sala.')
    await vi.advanceTimersByTimeAsync(1)

    doors[0]?.emit('open')
    doors[0]?.emit('data', createEnvelope('JOIN_REJECT', { reason: 'banned' }, DOOR_ID, 0))
    await assertion
    // Recusa e definitiva: nao existe segunda tentativa.
    expect(doors).toHaveLength(1)
    session.teardown()
  })

  it('JOIN_REJECT forjado por outro peer nao derruba o ingresso (5c)', async () => {
    const { session, doors } = makeSession()
    const promise = session.joinRoom(CODE)
    await vi.advanceTimersByTimeAsync(1)

    doors[0]?.emit('open')
    doors[0]?.emit('data', createEnvelope('JOIN_REJECT', { reason: 'banned' }, 'intruso', 0))
    doors[0]?.emit('data', createEnvelope('JOIN_ACCEPT', acceptPayload(), DOOR_ID, 0))
    await promise

    expect(session.getState().phase).toBe('active')
    session.teardown()
  })

  it('sem segunda resposta a mensagem final e "Sem resposta da sala."', async () => {
    const { session, doors } = makeSession()
    const promise = session.joinRoom(CODE)
    const assertion = expect(promise).rejects.toThrowError('Sem resposta da sala.')
    await vi.advanceTimersByTimeAsync(1)

    doors[0]?.emit('open')
    await vi.advanceTimersByTimeAsync(JOIN_RESPONSE_TIMEOUT_MS + 100)
    doors[1]?.emit('open')
    await vi.advanceTimersByTimeAsync(JOIN_RESPONSE_TIMEOUT_MS + 100)

    await assertion
    expect(doors).toHaveLength(2)
    session.teardown()
  })
})

describe('session / heartbeat PING-PONG (matriz 5c)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Sala ativa com o dono no mesh e o canal com ele aberto. */
  async function activeSession(): Promise<{
    session: Session
    owner: FakeConnection
  }> {
    const { session, doors, members } = makeSession()
    const promise = session.joinRoom(CODE)
    await vi.advanceTimersByTimeAsync(1)
    doors[0]?.emit('open')
    doors[0]?.emit('data', createEnvelope('JOIN_ACCEPT', acceptPayload(), DOOR_ID, 0))
    await promise

    const owner = members.get('dono')
    if (!owner) throw new Error('a sessao deveria ter discado para o dono')
    owner.open = true
    owner.emit('open')
    owner.sent.length = 0
    return { session, owner }
  }

  it('PING de membro do roster e respondido com PONG ecoando o mesmo seq', async () => {
    const { session, owner } = await activeSession()

    owner.emit('data', createEnvelope('PING', { seq: 77 }, 'dono', 0))

    expect(owner.sent).toEqual([
      expect.objectContaining({ type: 'PONG', from: SELF, payload: { seq: 77 } })
    ])
    session.teardown()
  })

  it('PING de quem nao esta no roster nao e respondido', async () => {
    const { session, owner } = await activeSession()

    // 1. Conexao de fora da sala, com envelope internamente coerente.
    const stranger = new FakeConnection('intruso')
    ;(
      session as unknown as { handleIncomingMeshConnection(connection: unknown): void }
    ).handleIncomingMeshConnection(stranger)
    stranger.open = true
    stranger.emit('open')
    stranger.sent.length = 0
    stranger.emit('data', createEnvelope('PING', { seq: 1 }, 'intruso', 0))
    expect(stranger.sent).toEqual([])

    // 2. PING assinado por outro peer no canal do dono: o `from` tem que bater
    // com o peerId REAL da conexao.
    owner.emit('data', createEnvelope('PING', { seq: 2 }, 'intruso', 0))
    expect(owner.sent).toEqual([])
    session.teardown()
  })

  it('PONG com seq diferente do enviado nao vira amostra de RTT', async () => {
    const { session, owner } = await activeSession()

    // Heartbeat do proprio app: primeiro PING sai sozinho depois de 2s.
    await vi.advanceTimersByTimeAsync(2_500)
    const ping = owner.sent.find(
      (payload): payload is { type: string; payload: { seq: number } } =>
        typeof payload === 'object' && payload !== null && 'type' in payload
    )
    expect(ping).toMatchObject({ type: 'PING' })

    owner.emit('data', createEnvelope('PONG', { seq: 999 }, 'dono', 0))
    expect(session.getState().quality['dono']).toBeUndefined()
    session.teardown()
  })
})
