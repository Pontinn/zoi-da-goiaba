// Autorizacao de chamada de midia recebida (matriz 5c): so atende `peer.call`
// de quem esta no roster e cujo txId bate com uma transmissao ANUNCIADA por ele.
// E o vigia da midia que nunca chega: sem TURN (RF-42) a conexao direta pode
// nao subir, e o evento `stream` do PeerJS dispara antes do primeiro RTP.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CALL_METADATA_WAIT_MS, MEDIA_STALL_TIMEOUT_MS } from '@shared/config'
import type { MediaConnection } from 'peerjs'
import { createInitialState, type RoomState } from '@renderer/core/room-state'
import { MediaManager } from '@renderer/services/media-manager'
import type { Session } from '@renderer/services/session'

type Handler = (arg: never) => void

/** RTCPeerConnection falsa: so estado e listeners, que e o que o vigia le. */
class FakePeerConnection {
  connectionState = 'connecting'
  iceConnectionState = 'checking'
  iceGatheringState = 'gathering'
  signalingState = 'stable'
  private readonly listeners = new Map<string, (() => void)[]>()

  addEventListener(event: string, listener: () => void): void {
    const list = this.listeners.get(event) ?? []
    list.push(listener)
    this.listeners.set(event, list)
  }

  removeEventListener(event: string, listener: () => void): void {
    const list = this.listeners.get(event) ?? []
    this.listeners.set(
      event,
      list.filter((current) => current !== listener)
    )
  }

  getStats(): Promise<Map<string, unknown>> {
    return Promise.resolve(new Map())
  }

  setConnectionState(state: string): void {
    this.connectionState = state
    for (const listener of this.listeners.get('connectionstatechange') ?? []) listener()
  }

  get listenerCount(): number {
    let total = 0
    for (const list of this.listeners.values()) total += list.length
    return total
  }
}

/** Track remota: nasce `muted` e so desmuta quando o primeiro RTP chega. */
class FakeTrack {
  muted = true
  private readonly listeners = new Map<string, (() => void)[]>()

  addEventListener(event: string, listener: () => void): void {
    const list = this.listeners.get(event) ?? []
    list.push(listener)
    this.listeners.set(event, list)
  }

  removeEventListener(event: string, listener: () => void): void {
    const list = this.listeners.get(event) ?? []
    this.listeners.set(
      event,
      list.filter((current) => current !== listener)
    )
  }

  unmute(): void {
    this.muted = false
    for (const listener of this.listeners.get('unmute') ?? []) listener()
  }
}

class FakeStream {
  constructor(private readonly track: FakeTrack) {}

  getVideoTracks(): FakeTrack[] {
    return [this.track]
  }
}

class FakeCall {
  answered = false
  closed = false
  private readonly handlers = new Map<string, Handler[]>()

  constructor(
    readonly peer: string,
    readonly metadata: unknown,
    readonly peerConnection: FakePeerConnection | null = null
  ) {}

  on(event: string, handler: Handler): this {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
    return this
  }

  emit(event: string, arg?: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) handler(arg as never)
  }

  answer(): void {
    this.answered = true
  }

  close(): void {
    this.closed = true
    this.emit('close')
  }
}

function stateWithTransmission(): RoomState {
  const base = createInitialState('me', 'i-me')
  return {
    ...base,
    phase: 'active',
    members: [
      { peerId: 'me', installId: 'i-me', nickname: 'Eu', joinedAt: 2, isOwner: false },
      { peerId: 'dono', installId: 'i-dono', nickname: 'Dono', joinedAt: 1, isOwner: true }
    ],
    transmissions: {
      tx1: {
        txId: 'tx1',
        peerId: 'dono',
        presetId: 'p720_30',
        hasAudio: false,
        sourceKind: 'screen',
        sourceLabel: 'Tela 1',
        startedAt: 0,
        status: 'live'
      }
    }
  }
}

/** Avisos de falha de midia que a sessao recebeu (um por txId). */
const failureNotices: string[] = []

function fakeSession(getState: () => RoomState): Session {
  return {
    getState,
    notifyMediaFailure: (txId: string, peerId: string) => {
      failureNotices.push(`${txId}:${peerId}`)
    }
  } as unknown as Session
}

function managerFor(state: RoomState): MediaManager {
  return new MediaManager(fakeSession(() => state))
}

function call(manager: MediaManager, fake: FakeCall): void {
  manager.onIncomingCall(fake as unknown as MediaConnection)
}

describe('media-manager / autorizacao de chamada recebida (5c)', () => {
  beforeEach(() => {
    failureNotices.length = 0
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('atende a chamada do transmissor com o txId anunciado', () => {
    const manager = managerFor(stateWithTransmission())
    const fake = new FakeCall('dono', { txId: 'tx1' })
    call(manager, fake)

    expect(fake.answered).toBe(true)
    expect(fake.closed).toBe(false)
    manager.teardown()
  })

  it('recusa chamada de quem nao esta no roster', () => {
    const manager = managerFor(stateWithTransmission())
    const fake = new FakeCall('intruso', { txId: 'tx1' })
    call(manager, fake)

    expect(fake.answered).toBe(false)
    expect(fake.closed).toBe(true)
    manager.teardown()
  })

  it('recusa chamada sem txId no metadata', () => {
    const manager = managerFor(stateWithTransmission())
    const semMetadata = new FakeCall('dono', null)
    const metadataErrado = new FakeCall('dono', { txId: 42 })
    call(manager, semMetadata)
    call(manager, metadataErrado)

    expect(semMetadata.closed).toBe(true)
    expect(metadataErrado.closed).toBe(true)
    manager.teardown()
  })

  it('nao atende chamada com txId de transmissao de OUTRO peer', () => {
    const state = stateWithTransmission()
    const manager = managerFor(state)
    // "me" tenta entregar midia usando o txId anunciado pelo dono.
    const fake = new FakeCall('me', { txId: 'tx1' })
    call(manager, fake)

    expect(fake.answered).toBe(false)
    // Fica na espera pelo TX_START correspondente e cai fora no fim dela.
    vi.advanceTimersByTime(CALL_METADATA_WAIT_MS + 500)
    expect(fake.answered).toBe(false)
    expect(fake.closed).toBe(true)
    manager.teardown()
  })

  it('chamada que chega antes do TX_START e atendida quando ele chega', () => {
    const state = stateWithTransmission()
    const pendente: RoomState = { ...state, transmissions: {} }
    let current = pendente
    const manager = new MediaManager(fakeSession(() => current))

    const fake = new FakeCall('dono', { txId: 'tx1' })
    call(manager, fake)
    expect(fake.answered).toBe(false)

    current = state
    vi.advanceTimersByTime(500)
    expect(fake.answered).toBe(true)
    expect(fake.closed).toBe(false)
    manager.teardown()
  })
})

describe('media-manager / vigia da midia que nunca chega', () => {
  beforeEach(() => {
    failureNotices.length = 0
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function answered(manager: MediaManager, connection: FakePeerConnection | null): FakeCall {
    const fake = new FakeCall('dono', { txId: 'tx1' }, connection)
    call(manager, fake)
    expect(fake.answered).toBe(true)
    return fake
  }

  it('sem conexao estabelecida no prazo, marca a falha e avisa a sessao', () => {
    const manager = managerFor(stateWithTransmission())
    const connection = new FakePeerConnection()
    answered(manager, connection)

    const seen: number[] = []
    manager.subscribeMediaFailures((failures) => seen.push(failures.size))

    vi.advanceTimersByTime(MEDIA_STALL_TIMEOUT_MS - 1)
    expect(manager.getMediaFailures().size).toBe(0)

    vi.advanceTimersByTime(2)
    expect([...manager.getMediaFailures()]).toEqual(['tx1'])
    expect(failureNotices).toEqual(['tx1:dono'])
    // Primeiro valor e o do assinante entrando; o segundo, a falha.
    expect(seen).toEqual([0, 1])
    manager.teardown()
  })

  it('video que chega dentro do prazo nao vira falha nenhuma', () => {
    const manager = managerFor(stateWithTransmission())
    const connection = new FakePeerConnection()
    const fake = answered(manager, connection)

    const track = new FakeTrack()
    fake.emit('stream', new FakeStream(track))
    connection.setConnectionState('connected')
    track.unmute()

    vi.advanceTimersByTime(MEDIA_STALL_TIMEOUT_MS + 100)
    expect(manager.getMediaFailures().size).toBe(0)
    expect(failureNotices).toEqual([])
    manager.teardown()
  })

  it('conexao que morre antes do prazo ja marca a falha', () => {
    const manager = managerFor(stateWithTransmission())
    const connection = new FakePeerConnection()
    answered(manager, connection)

    connection.setConnectionState('failed')
    expect([...manager.getMediaFailures()]).toEqual(['tx1'])
    expect(failureNotices).toEqual(['tx1:dono'])

    // O prazo que ainda vai vencer nao pode avisar a sessao de novo.
    vi.advanceTimersByTime(MEDIA_STALL_TIMEOUT_MS + 100)
    expect(failureNotices).toEqual(['tx1:dono'])
    manager.teardown()
  })

  it('video que chega DEPOIS da falha limpa o erro', () => {
    const manager = managerFor(stateWithTransmission())
    const connection = new FakePeerConnection()
    const fake = answered(manager, connection)

    vi.advanceTimersByTime(MEDIA_STALL_TIMEOUT_MS + 100)
    expect(manager.getMediaFailures().size).toBe(1)

    const track = new FakeTrack()
    fake.emit('stream', new FakeStream(track))
    connection.setConnectionState('connected')
    expect(manager.getMediaFailures().size).toBe(1)

    track.unmute()
    expect(manager.getMediaFailures().size).toBe(0)
    manager.teardown()
  })

  it('teardown solta os timers e os listeners do vigia', () => {
    const manager = managerFor(stateWithTransmission())
    const connection = new FakePeerConnection()
    answered(manager, connection)
    expect(connection.listenerCount).toBeGreaterThan(0)

    manager.teardown()
    expect(connection.listenerCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)

    vi.advanceTimersByTime(MEDIA_STALL_TIMEOUT_MS * 2)
    expect(manager.getMediaFailures().size).toBe(0)
    expect(failureNotices).toEqual([])
  })

  it('transmissao que sai do estado limpa a falha ja marcada', () => {
    const manager = managerFor(stateWithTransmission())
    const connection = new FakePeerConnection()
    answered(manager, connection)

    vi.advanceTimersByTime(MEDIA_STALL_TIMEOUT_MS + 100)
    expect(manager.getMediaFailures().size).toBe(1)

    manager.dropRemote('tx1')
    expect(manager.getMediaFailures().size).toBe(0)
    manager.teardown()
  })
})
