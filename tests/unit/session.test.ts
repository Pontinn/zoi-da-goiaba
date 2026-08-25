// Ingresso pelo canal efemero do door (SPEC secao 2.5 e matriz 5c), exercitado
// na classe real da sessao com um PeerManager falso: o que se testa aqui e a
// LEITURA das respostas do door (origem, tipo, ausencia de resposta), nao o
// PeerJS.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JOIN_RESPONSE_TIMEOUT_MS } from '@shared/config'
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

function makeSession(): { session: Session; doors: FakeConnection[] } {
  const session = new Session()
  const doors: FakeConnection[] = []
  const peerManager = {
    memberPeerId: SELF,
    hasDoor: false,
    startMemberPeer: () => Promise.resolve(SELF),
    connectToDoor: () => {
      const connection = new FakeConnection(DOOR_ID)
      doors.push(connection)
      return connection
    },
    connectToMember: (peerId: string) => new FakeConnection(peerId),
    openDoor: () => Promise.resolve(),
    closeDoor: () => {},
    call: () => {
      throw new Error('nao usado')
    },
    destroy: () => {}
  }
  ;(session as unknown as { peerManager: unknown }).peerManager = peerManager
  session.setIdentity('Eu', 'i-me')
  return { session, doors }
}

describe('session / respostas do door no ingresso', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('canal que nunca abre vira "Sala nao encontrada." mesmo pela espera interna', async () => {
    const { session, doors } = makeSession()
    const promise = session.joinRoom(CODE)
    const assertion = expect(promise).rejects.toThrowError('Sala nao encontrada.')

    // Sem `peer-unavailable` e sem `close`: so a espera interna responde.
    await vi.advanceTimersByTimeAsync(JOIN_RESPONSE_TIMEOUT_MS + 100)
    await assertion
    expect(doors).toHaveLength(1)
    expect(doors[0]?.closed).toBe(true)
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
