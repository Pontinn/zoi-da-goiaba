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

  getSenders(): unknown[] {
    return []
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
  answeredWith: unknown = null
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

  answer(stream?: unknown): void {
    this.answered = true
    this.answeredWith = stream ?? null
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

// --- fallback de direcao da midia (chamada reversa) ------------------------

/** Track de saida: o que interessa e se ela foi PARADA no cleanup. */
class FakeOutTrack {
  stopped = false
  readonly kind = 'video'

  stop(): void {
    this.stopped = true
  }
}

class FakeOutStream {
  readonly tracks = [new FakeOutTrack()]

  getTracks(): FakeOutTrack[] {
    return this.tracks
  }

  getVideoTracks(): FakeOutTrack[] {
    return this.tracks
  }
}

interface OutgoingRecord {
  peerId: string
  stream: FakeOutStream
  metadata: { txId: string; pull?: boolean }
  call: FakeCall
}

/** Sessao falsa que registra cada `callPeer` (chamadas normais e reversas). */
function dialingSession(getState: () => RoomState, dialed: OutgoingRecord[]): Session {
  return {
    getState,
    notifyMediaFailure: (txId: string, peerId: string) => {
      failureNotices.push(`${txId}:${peerId}`)
    },
    callPeer: (peerId: string, stream: FakeOutStream, metadata: OutgoingRecord['metadata']) => {
      const call = new FakeCall(peerId, metadata, new FakePeerConnection())
      dialed.push({ peerId, stream, metadata, call })
      return call
    }
  } as unknown as Session
}

function pullingManager(
  state: RoomState,
  dialed: OutgoingRecord[]
): { manager: MediaManager; dummies: FakeOutStream[] } {
  const dummies: FakeOutStream[] = []
  const manager = new MediaManager(dialingSession(() => state, dialed), () => {
    const dummy = new FakeOutStream()
    dummies.push(dummy)
    return dummy as unknown as MediaStream
  })
  return { manager, dummies }
}

/** Estado em que quem roda o teste ("me") e o TRANSMISSOR de tx9. */
function stateTransmittingLocally(): RoomState {
  const base = stateWithTransmission()
  return {
    ...base,
    transmissions: {
      tx9: {
        txId: 'tx9',
        peerId: 'me',
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

describe('media-manager / espectador puxa a midia quando a chamada falha', () => {
  beforeEach(() => {
    failureNotices.length = 0
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Chamada recebida do dono que fica no ar sem nunca entregar video. */
  function stalled(manager: MediaManager): FakeCall {
    const fake = new FakeCall('dono', { txId: 'tx1' }, new FakePeerConnection())
    call(manager, fake)
    expect(fake.answered).toBe(true)
    vi.advanceTimersByTime(MEDIA_STALL_TIMEOUT_MS + 10)
    return fake
  }

  it('o vigia que falha dispara UMA chamada reversa para o transmissor', () => {
    const dialed: OutgoingRecord[] = []
    const { manager } = pullingManager(stateWithTransmission(), dialed)
    const original = stalled(manager)

    expect(dialed).toHaveLength(1)
    expect(dialed[0]?.peerId).toBe('dono')
    expect(dialed[0]?.metadata).toEqual({ txId: 'tx1', pull: true })
    // A chamada que falhou sai do caminho: quem manda agora e a reversa.
    expect(original.closed).toBe(true)
    expect([...manager.getMediaFailures()]).toEqual(['tx1'])

    // A reversa tambem falhando NAO vira loop: segue uma tentativa so.
    vi.advanceTimersByTime(MEDIA_STALL_TIMEOUT_MS * 3)
    expect(dialed).toHaveLength(1)
    expect(failureNotices).toEqual(['tx1:dono'])
    manager.teardown()
  })

  it('o video que chega pela reversa entra no txId e limpa a falha', () => {
    const dialed: OutgoingRecord[] = []
    const { manager } = pullingManager(stateWithTransmission(), dialed)
    stalled(manager)

    const pull = dialed[0]?.call
    if (!pull || !pull.peerConnection) throw new Error('a reversa deveria existir')

    const track = new FakeTrack()
    pull.emit('stream', new FakeStream(track))
    pull.peerConnection.setConnectionState('connected')
    track.unmute()

    expect(manager.getMediaFailures().size).toBe(0)
    expect(manager.getStreams().has('tx1')).toBe(true)
    // A conexao da reversa entra no monitor de qualidade do espectador.
    expect(manager.inboundConnections()).toHaveLength(1)
    manager.teardown()
  })

  it('a stream ficticia da reversa e parada no cleanup, sem timer pendurado', () => {
    const dialed: OutgoingRecord[] = []
    const { manager, dummies } = pullingManager(stateWithTransmission(), dialed)
    stalled(manager)

    expect(dummies).toHaveLength(1)
    expect(dummies[0]?.tracks[0]?.stopped).toBe(false)

    manager.teardown()
    expect(dummies[0]?.tracks[0]?.stopped).toBe(true)
    expect(dialed[0]?.call.closed).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a transmissao saindo do estado tambem para a stream ficticia', () => {
    const dialed: OutgoingRecord[] = []
    const { manager, dummies } = pullingManager(stateWithTransmission(), dialed)
    stalled(manager)

    manager.dropRemote('tx1')
    expect(dummies[0]?.tracks[0]?.stopped).toBe(true)
    expect(manager.getMediaFailures().size).toBe(0)
    manager.teardown()
  })

  it('nao puxa nada de quem saiu do roster', () => {
    const state = stateWithTransmission()
    const semDono: RoomState = {
      ...state,
      members: state.members.filter((member) => member.peerId !== 'dono')
    }
    const dialed: OutgoingRecord[] = []
    const { manager } = pullingManager(semDono, dialed)
    // A chamada e recusada logo na autorizacao; a falha vem do vigia de outra
    // transmissao, entao o que importa aqui e que nada seja discado de volta.
    const fake = new FakeCall('dono', { txId: 'tx1' }, new FakePeerConnection())
    call(manager, fake)
    vi.advanceTimersByTime(MEDIA_STALL_TIMEOUT_MS * 2)

    expect(dialed).toEqual([])
    manager.teardown()
  })
})

describe('media-manager / transmissor respondendo a chamada reversa', () => {
  beforeEach(() => {
    failureNotices.length = 0
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Transmissao local ativa de "me" com uma chamada em andamento para o dono. */
  function transmitting(dialed: OutgoingRecord[]): {
    manager: MediaManager
    stream: FakeOutStream
  } {
    const { manager } = pullingManager(stateTransmittingLocally(), dialed)
    const stream = new FakeOutStream()
    ;(manager as unknown as { local: unknown }).local = {
      txId: 'tx9',
      presetId: 'p720_30',
      sourceId: 'screen:0',
      sourceLabel: 'Tela 1',
      sourceKind: 'screen',
      hasAudio: false,
      stream
    }
    // Chamada normal (a que falha no campo) para o espectador.
    ;(manager as unknown as { callPeer(peerId: string): void }).callPeer('dono')
    return { manager, stream }
  }

  it('responde a reversa com a transmissao local e troca o canal de envio', () => {
    const dialed: OutgoingRecord[] = []
    const { manager, stream } = transmitting(dialed)
    const original = dialed[0]?.call
    if (!original) throw new Error('a chamada normal deveria existir')

    const pull = new FakeCall('dono', { txId: 'tx9', pull: true }, new FakePeerConnection())
    call(manager, pull)

    expect(pull.answered).toBe(true)
    expect(pull.answeredWith).toBe(stream)
    // A chamada antiga para o mesmo par nao pode ficar duplicada.
    expect(original.closed).toBe(true)
    expect(pull.closed).toBe(false)

    // A reversa e canal de SAIDA: nao pode contar como entrada no transmissor.
    expect(manager.inboundConnections()).toEqual([])

    manager.teardown()
    expect(pull.closed).toBe(true)
  })

  it('ignora reversa de quem nao esta no roster', () => {
    const dialed: OutgoingRecord[] = []
    const { manager } = transmitting(dialed)

    const pull = new FakeCall('intruso', { txId: 'tx9', pull: true }, new FakePeerConnection())
    call(manager, pull)

    expect(pull.answered).toBe(false)
    expect(pull.closed).toBe(true)
    manager.teardown()
  })

  it('ignora reversa com txId que nao e o da transmissao local', () => {
    const dialed: OutgoingRecord[] = []
    const { manager } = transmitting(dialed)

    const pull = new FakeCall('dono', { txId: 'tx-outro', pull: true }, new FakePeerConnection())
    call(manager, pull)

    expect(pull.answered).toBe(false)
    expect(pull.closed).toBe(true)
    manager.teardown()
  })

  it('ignora reversa quando nao ha transmissao local nenhuma', () => {
    const dialed: OutgoingRecord[] = []
    const { manager } = pullingManager(stateTransmittingLocally(), dialed)

    const pull = new FakeCall('dono', { txId: 'tx9', pull: true }, new FakePeerConnection())
    call(manager, pull)

    expect(pull.answered).toBe(false)
    expect(pull.closed).toBe(true)
    manager.teardown()
  })
})
