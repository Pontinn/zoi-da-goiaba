// Autorizacao de chamada de midia recebida (matriz 5c): so atende `peer.call`
// de quem esta no roster e cujo txId bate com uma transmissao ANUNCIADA por ele.
// E o vigia da midia que nunca chega: sem TURN (RF-42) a conexao direta pode
// nao subir, e o evento `stream` do PeerJS dispara antes do primeiro RTP.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CALL_METADATA_WAIT_MS,
  CODEC_CPU_PERSISTENT_SAMPLES,
  CODEC_CPU_WARMUP_SAMPLES,
  CODEC_MAX_DOWNGRADES,
  CODEC_MEMBER_GRACE_MS,
  MEDIA_STALL_TIMEOUT_MS
} from '@shared/config'
import type { VideoCodecId } from '@shared/codecs'
import type { MediaConnection } from 'peerjs'
import { createInitialState, type RoomState } from '@renderer/core/room-state'
import {
  CaptureFailedError,
  createDummyStream,
  MediaManager
} from '@renderer/services/media-manager'
import type { Session } from '@renderer/services/session'
import type { OutboundVideoStats } from '@renderer/services/stats-monitor'

/**
 * A sondagem de capacidade e do ambiente (Chromium real), nao do reducer: aqui
 * ela vira um stub controlavel para que cada caso possa dizer QUAIS codecs esta
 * maquina imaginaria codifica por hardware.
 */
const codecStub = vi.hoisted(() => {
  const state = {
    encodeCandidates: ['VP8'] as string[],
    forceVp8: false,
    listeners: new Set<(value: boolean) => void>(),
    setForceVp8(value: boolean): void {
      if (state.forceVp8 === value) return
      state.forceVp8 = value
      for (const listener of state.listeners) listener(value)
    }
  }
  return state
})

vi.mock('@renderer/services/codec-capabilities', () => ({
  ensureDecodeProbe: () => Promise.resolve(),
  ensureEncodeProbe: () => Promise.resolve(),
  getEncodeCandidates: () => [...codecStub.encodeCandidates],
  getLocalDecodeCodecs: () => ['VP8'],
  isForceVp8: () => codecStub.forceVp8,
  setForceVp8: (value: boolean) => codecStub.setForceVp8(value),
  subscribeForceVp8: (listener: (value: boolean) => void) => {
    codecStub.listeners.add(listener)
    return () => codecStub.listeners.delete(listener)
  },
  describeCodecProbe: () => ({})
}))

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

  /** `answerOptions` fica `undefined` quando a resposta vai sem segundo argumento. */
  answerOptions: unknown = undefined

  answer(stream?: unknown, options?: unknown): void {
    this.answered = true
    this.answeredWith = stream ?? null
    this.answerOptions = options
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
        status: 'live',
        videoCodec: null,
        pointersEnabled: false
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

type TrackKind = 'video' | 'audio'

/** Track de saida: o que interessa e se ela foi PARADA no cleanup. */
class FakeOutTrack {
  stopped = false

  constructor(readonly kind: TrackKind) {}

  stop(): void {
    this.stopped = true
  }
}

class FakeOutStream {
  readonly tracks: FakeOutTrack[]

  constructor(kinds: TrackKind[] = ['video']) {
    this.tracks = kinds.map((kind) => new FakeOutTrack(kind))
  }

  getTracks(): FakeOutTrack[] {
    return this.tracks
  }

  getVideoTracks(): FakeOutTrack[] {
    return this.tracks.filter((track) => track.kind === 'video')
  }

  getAudioTracks(): FakeOutTrack[] {
    return this.tracks.filter((track) => track.kind === 'audio')
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
): { manager: MediaManager; dummies: FakeOutStream[]; released: FakeOutStream[] } {
  const dummies: FakeOutStream[] = []
  const released: FakeOutStream[] = []
  const manager = new MediaManager(
    dialingSession(() => state, dialed),
    () => {
      // A ficticia da reversa vai com video E audio mudo (senao a resposta do
      // transmissor perde a faixa de audio).
      const dummy = new FakeOutStream(['video', 'audio'])
      dummies.push(dummy)
      return { stream: dummy as unknown as MediaStream, release: () => released.push(dummy) }
    }
  )
  return { manager, dummies, released }
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
        status: 'live',
        videoCodec: null,
        pointersEnabled: false
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
    // A conexao da reversa entra no monitor de qualidade do espectador, ja
    // ETIQUETADA pela transmissao (o que permite ler quadros por txId).
    const entries = manager.inboundEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.txId).toBe('tx1')
    manager.teardown()
  })

  it('a reversa e discada com video E audio, senao a resposta perde o som', () => {
    const dialed: OutgoingRecord[] = []
    const { manager, dummies } = pullingManager(stateWithTransmission(), dialed)
    stalled(manager)

    expect(dialed[0]?.stream).toBe(dummies[0])
    expect(dummies[0]?.getVideoTracks()).toHaveLength(1)
    expect(dummies[0]?.getAudioTracks()).toHaveLength(1)
    manager.teardown()
  })

  it('a stream ficticia da reversa e solta no cleanup, sem timer pendurado', () => {
    const dialed: OutgoingRecord[] = []
    const { manager, dummies, released } = pullingManager(stateWithTransmission(), dialed)
    stalled(manager)

    expect(dummies).toHaveLength(1)
    expect(dummies[0]?.tracks.some((track) => track.stopped)).toBe(false)
    expect(released).toEqual([])

    manager.teardown()
    expect(dummies[0]?.tracks.every((track) => track.stopped)).toBe(true)
    // O AudioContext da faixa muda tem que fechar junto.
    expect(released).toEqual([dummies[0]])
    expect(dialed[0]?.call.closed).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a transmissao saindo do estado tambem solta a stream ficticia', () => {
    const dialed: OutgoingRecord[] = []
    const { manager, dummies, released } = pullingManager(stateWithTransmission(), dialed)
    stalled(manager)

    manager.dropRemote('tx1')
    expect(dummies[0]?.tracks.every((track) => track.stopped)).toBe(true)
    expect(released).toEqual([dummies[0]])
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
  function transmitting(
    dialed: OutgoingRecord[],
    kinds: TrackKind[] = ['video']
  ): {
    manager: MediaManager
    stream: FakeOutStream
  } {
    const { manager } = pullingManager(stateTransmittingLocally(), dialed)
    const stream = new FakeOutStream(kinds)
    ;(manager as unknown as { local: unknown }).local = {
      txId: 'tx9',
      presetId: 'p720_30',
      sourceId: 'screen:0',
      sourceLabel: 'Tela 1',
      sourceKind: 'screen',
      hasAudio: kinds.includes('audio'),
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
    expect(manager.inboundEntries()).toEqual([])

    manager.teardown()
    expect(pull.closed).toBe(true)
  })

  it('responde a reversa com video E audio quando a transmissao tem som', () => {
    const dialed: OutgoingRecord[] = []
    const { manager, stream } = transmitting(dialed, ['video', 'audio'])

    const pull = new FakeCall('dono', { txId: 'tx9', pull: true }, new FakePeerConnection())
    call(manager, pull)

    expect(pull.answered).toBe(true)
    expect(pull.answeredWith).toBe(stream)
    expect(stream.getAudioTracks()).toHaveLength(1)
    manager.teardown()
  })

  it('responde a reversa so com video quando a transmissao nao tem som', () => {
    const dialed: OutgoingRecord[] = []
    const { manager, stream } = transmitting(dialed, ['video'])

    const pull = new FakeCall('dono', { txId: 'tx9', pull: true }, new FakePeerConnection())
    call(manager, pull)

    expect(pull.answered).toBe(true)
    expect(pull.answeredWith).toBe(stream)
    expect(stream.getAudioTracks()).toEqual([])
    expect(pull.closed).toBe(false)
    manager.teardown()
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

// --- a stream ficticia de verdade (canvas + audio mudo) -------------------
// O ambiente do vitest e node: nao existe `document` nem `AudioContext`, entao
// os dois entram como stub, no mesmo espirito das outras falsificacoes.

class FakeCanvasTrack {
  stopped = false

  constructor(readonly kind: TrackKind) {}

  stop(): void {
    this.stopped = true
  }
}

class FakeCanvasStream {
  readonly tracks: FakeCanvasTrack[] = [new FakeCanvasTrack('video')]

  getTracks(): FakeCanvasTrack[] {
    return this.tracks
  }

  getVideoTracks(): FakeCanvasTrack[] {
    return this.tracks.filter((track) => track.kind === 'video')
  }

  getAudioTracks(): FakeCanvasTrack[] {
    return this.tracks.filter((track) => track.kind === 'audio')
  }

  addTrack(track: FakeCanvasTrack): void {
    this.tracks.push(track)
  }
}

class FakeAudioContext {
  static readonly instances: FakeAudioContext[] = []
  closed = false

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createMediaStreamDestination(): { stream: FakeCanvasStream } {
    const stream = new FakeCanvasStream()
    stream.tracks.length = 0
    stream.addTrack(new FakeCanvasTrack('audio'))
    return { stream }
  }

  close(): Promise<void> {
    this.closed = true
    return Promise.resolve()
  }
}

function stubCanvasDocument(): void {
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ fillStyle: '', fillRect: () => {} }),
      captureStream: () => new FakeCanvasStream()
    })
  })
}

describe('media-manager / stream ficticia da chamada reversa', () => {
  beforeEach(() => {
    FakeAudioContext.instances.length = 0
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubCanvasDocument()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('leva video e uma faixa de audio muda', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const pull = createDummyStream()
    if (!pull) throw new Error('a stream ficticia deveria existir')

    const stream = pull.stream as unknown as FakeCanvasStream
    expect(stream.getVideoTracks()).toHaveLength(1)
    expect(stream.getAudioTracks()).toHaveLength(1)
    expect(FakeAudioContext.instances).toHaveLength(1)
  })

  it('o release fecha o AudioContext da faixa muda', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const pull = createDummyStream()
    if (!pull) throw new Error('a stream ficticia deveria existir')

    expect(FakeAudioContext.instances[0]?.closed).toBe(false)
    pull.release()
    expect(FakeAudioContext.instances[0]?.closed).toBe(true)
  })

  it('audio que nao pode ser criado degrada para video-only sem quebrar', () => {
    class BrokenAudioContext {
      constructor() {
        throw new Error('sem dispositivo de audio')
      }
    }
    vi.stubGlobal('AudioContext', BrokenAudioContext)

    const pull = createDummyStream()
    if (!pull) throw new Error('a pull sem audio ainda tem que valer')

    const stream = pull.stream as unknown as FakeCanvasStream
    expect(stream.getVideoTracks()).toHaveLength(1)
    expect(stream.getAudioTracks()).toEqual([])
    expect(() => pull.release()).not.toThrow()
    expect(console.warn).toHaveBeenCalled()
  })

  it('sem document nenhum nao ha stream ficticia', () => {
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('AudioContext', FakeAudioContext)
    expect(createDummyStream()).toBeNull()
  })
})

// --- captura de audio com exclusao ----------------------------------------
//
// Estes casos protegem a decisao central do pipeline: com a exclusao ativa o
// audio NAO vem mais do getDisplayMedia (`withAudio: false` nos dois lados) e
// sim de uma track NOSSA, colocada na stream ANTES do announce. E por isso que
// a chamada direta e a chamada reversa herdam o audio sem nenhum replaceTrack.

class FakeMediaTrack {
  contentHint = ''
  stopped = false
  private readonly listeners = new Map<string, (() => void)[]>()

  constructor(readonly kind: TrackKind) {}

  addEventListener(event: string, listener: () => void): void {
    const list = this.listeners.get(event) ?? []
    list.push(listener)
    this.listeners.set(event, list)
  }

  stop(): void {
    this.stopped = true
  }

  emit(event: string): void {
    for (const listener of this.listeners.get(event) ?? []) listener()
  }
}

/** MediaStream falsa com o pouco que o pipeline usa (inclui `addTrack`). */
class FakeCaptureStream {
  readonly tracks: FakeMediaTrack[]

  constructor(kinds: TrackKind[]) {
    this.tracks = kinds.map((kind) => new FakeMediaTrack(kind))
  }

  addTrack(track: FakeMediaTrack): void {
    this.tracks.push(track)
  }

  getTracks(): FakeMediaTrack[] {
    return this.tracks
  }

  getVideoTracks(): FakeMediaTrack[] {
    return this.tracks.filter((track) => track.kind === 'video')
  }

  getAudioTracks(): FakeMediaTrack[] {
    return this.tracks.filter((track) => track.kind === 'audio')
  }
}

interface ExclusionStub {
  client: { start: () => Promise<{ session: unknown; reason: string | null }> }
  starts: number
  stops: number
  tracks: FakeMediaTrack[]
}

/** Stub do cliente de exclusao: devolve uma track propria ou recusa. */
function exclusionStub(available: boolean): ExclusionStub {
  const stub: ExclusionStub = {
    starts: 0,
    stops: 0,
    tracks: [],
    client: {
      start: async () => {
        stub.starts += 1
        if (!available) return { session: null, reason: 'addon-load-failed' }
        const track = new FakeMediaTrack('audio')
        stub.tracks.push(track)
        return {
          session: {
            track,
            stop: () => {
              stub.stops += 1
            }
          },
          reason: null
        }
      }
    }
  }
  return stub
}

interface CaptureCalls {
  selectSource: { sourceId: string; withAudio: boolean }[]
  displayMedia: { audio: unknown }[]
}

/**
 * Instala `window.zoi` e `navigator.mediaDevices` falsos e devolve o que foi
 * pedido a cada um. `displayMediaFails` simula o usuario cancelando o seletor.
 */
function stubCapture(displayMediaFails = false): CaptureCalls {
  const calls: CaptureCalls = { selectSource: [], displayMedia: [] }
  vi.stubGlobal('window', {
    zoi: {
      capture: {
        selectSource: async (request: { sourceId: string; withAudio: boolean }) => {
          calls.selectSource.push(request)
        }
      }
    }
  })
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getDisplayMedia: async (constraints: { audio: unknown }) => {
        calls.displayMedia.push({ audio: constraints.audio })
        if (displayMediaFails) throw new Error('usuario cancelou o seletor')
        // O loopback do SO so entrega faixa de audio quando foi pedido.
        return new FakeCaptureStream(constraints.audio ? ['video', 'audio'] : ['video'])
      }
    }
  })
  return calls
}

interface Announced {
  txId: string
  hasAudio: boolean
}

function transmittingSession(
  announced: Announced[],
  dialed: OutgoingRecord[],
  stops: string[]
): Session {
  return {
    getState: () => stateTransmittingLocally(),
    notifyMediaFailure: () => {},
    announceTransmissionStart: (payload: Announced) => announced.push(payload),
    announceTransmissionStop: (reason: string) => stops.push(reason),
    otherMemberPeerIds: () => ['dono'],
    callPeer: (peerId: string, stream: unknown, metadata: OutgoingRecord['metadata']) => {
      const fake = new FakeCall(peerId, metadata, new FakePeerConnection())
      dialed.push({
        peerId,
        stream: stream as unknown as FakeOutStream,
        metadata,
        call: fake
      })
      return fake
    }
  } as unknown as Session
}

const START_OPTIONS = {
  sourceId: 'screen:0',
  sourceLabel: 'Tela 1',
  sourceKind: 'screen' as const,
  presetId: 'p720_30' as const,
  withAudio: true,
  pointers: false,
  displayId: 'display-1'
}

describe('media-manager / captura de audio com exclusao', () => {
  let announced: Announced[]
  let dialed: OutgoingRecord[]
  let stops: string[]

  beforeEach(() => {
    announced = []
    dialed = []
    stops = []
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function managerWith(stub: ExclusionStub): {
    manager: MediaManager
    calls: CaptureCalls
  } {
    const calls = stubCapture()
    const manager = new MediaManager(
      transmittingSession(announced, dialed, stops),
      createDummyStream,
      stub.client as never
    )
    return { manager, calls }
  }

  it('com exclusao ativa o audio nao vem do getDisplayMedia', async () => {
    const stub = exclusionStub(true)
    const { manager, calls } = managerWith(stub)

    const local = await manager.startTransmission(START_OPTIONS)

    expect(stub.starts).toBe(1)
    // Os DOIS lados precisam pedir sem audio: o loopback do SO traria o Discord.
    expect(calls.selectSource[0]).toEqual({ sourceId: 'screen:0', withAudio: false })
    expect(calls.displayMedia[0]?.audio).toBe(false)
    expect(local.audioMode).toBe('excluded')
    expect(local.hasAudio).toBe(true)
    expect(local.stream.getAudioTracks()).toEqual([stub.tracks[0]])
    manager.teardown()
  })

  it('a track gerada entra na stream ANTES do announce e das chamadas', async () => {
    const stub = exclusionStub(true)
    const { manager } = managerWith(stub)

    const local = await manager.startTransmission(START_OPTIONS)

    // Se a track entrasse depois, o announce iria com hasAudio falso e a
    // chamada sairia sem m-line de audio.
    expect(announced).toEqual([expect.objectContaining({ txId: local.txId, hasAudio: true })])
    expect(dialed).toHaveLength(1)
    expect(dialed[0]?.stream).toBe(local.stream)
    manager.teardown()
  })

  it('sem exclusao disponivel degrada para o loopback do sistema inteiro', async () => {
    const stub = exclusionStub(false)
    const { manager, calls } = managerWith(stub)

    const local = await manager.startTransmission(START_OPTIONS)

    expect(stub.starts).toBe(1)
    expect(calls.selectSource[0]).toEqual({ sourceId: 'screen:0', withAudio: true })
    expect(calls.displayMedia[0]?.audio).toBe(true)
    expect(local.audioMode).toBe('full-loopback')
    expect(local.hasAudio).toBe(true)
    expect(local.stopAudioExclusion).toBeNull()
    manager.teardown()
  })

  it('transmitir sem audio nao arma exclusao nenhuma', async () => {
    const stub = exclusionStub(true)
    const { manager, calls } = managerWith(stub)

    const local = await manager.startTransmission({ ...START_OPTIONS, withAudio: false })

    expect(stub.starts).toBe(0)
    expect(local.audioMode).toBe('none')
    expect(local.hasAudio).toBe(false)
    expect(calls.selectSource[0]?.withAudio).toBe(false)
    manager.teardown()
  })

  it('parar a transmissao solta a captura de audio', async () => {
    const stub = exclusionStub(true)
    const { manager } = managerWith(stub)
    await manager.startTransmission(START_OPTIONS)

    manager.stopTransmission('manual')

    expect(stub.stops).toBe(1)
    expect(stops).toEqual(['manual'])
    manager.teardown()
  })

  it('trocar de fonte rearma a exclusao inteira', async () => {
    const stub = exclusionStub(true)
    const { manager } = managerWith(stub)
    const first = await manager.startTransmission(START_OPTIONS)

    const second = await manager.switchSource({ ...START_OPTIONS, sourceId: 'screen:1' })

    expect(stub.starts).toBe(2)
    expect(stub.stops).toBe(1)
    expect(second.txId).not.toBe(first.txId)
    expect(second.audioMode).toBe('excluded')
    expect(second.stream.getAudioTracks()).toEqual([stub.tracks[1]])
    manager.teardown()
  })

  it('falha do getDisplayMedia nao deixa a captura de audio armada', async () => {
    const stub = exclusionStub(true)
    const calls = stubCapture(true)
    const manager = new MediaManager(
      transmittingSession(announced, dialed, stops),
      createDummyStream,
      stub.client as never
    )

    await expect(manager.startTransmission(START_OPTIONS)).rejects.toBeInstanceOf(
      CaptureFailedError
    )

    expect(stub.starts).toBe(1)
    expect(stub.stops).toBe(1)
    expect(calls.displayMedia).toHaveLength(1)
    manager.teardown()
  })

  it('teardown tambem solta a captura de audio', async () => {
    const stub = exclusionStub(true)
    const { manager } = managerWith(stub)
    await manager.startTransmission(START_OPTIONS)

    manager.teardown()

    expect(stub.stops).toBe(1)
  })

  it('a chamada reversa responde com a MESMA stream, ja com o audio dentro', async () => {
    const stub = exclusionStub(true)
    const { manager } = managerWith(stub)
    const local = await manager.startTransmission(START_OPTIONS)

    // O espectador puxa a midia porque a chamada direta nao chegou nele.
    const pull = new FakeCall('dono', { txId: local.txId, pull: true })
    call(manager, pull)

    expect(pull.answered).toBe(true)
    // Identidade, nao equivalencia: e o que garante zero renegociacao.
    expect(pull.answeredWith).toBe(local.stream)
    expect((pull.answeredWith as FakeCaptureStream).getAudioTracks()).toEqual([stub.tracks[0]])
    manager.teardown()
  })
})

// --- video-codec-upgrade: escolha, aplicacao e rebaixamento de codec ---------
//
// Regra deste bloco: cada caso precisa DISCRIMINAR, isto e, falhar se a regra
// for invertida. Assercao do tipo "e uma funcao" nao serve, porque o transform
// seria funcao em qualquer implementacao: o que se verifica e o EFEITO dele
// sobre um SDP de verdade e a ausencia dele no caminho VP8.

/** Recorte de uma oferta real do Chromium, com VP8, VP9, H264 e AV1. */
const CODEC_OFFER_SDP = [
  'v=0',
  'm=video 9 UDP/TLS/RTP/SAVPF 96 97 98 45 46',
  'a=rtpmap:96 VP8/90000',
  'a=rtpmap:97 rtx/90000',
  'a=rtpmap:98 VP9/90000',
  'a=rtpmap:45 AV1/90000',
  'a=rtpmap:46 rtx/90000'
].join('\r\n')

function videoPayloadsOf(sdp: string): string[] {
  const line = sdp.split(/\r\n|\n/).find((entry) => entry.startsWith('m=video '))
  return (line ?? '').split(' ').slice(3)
}

/** Sender de video falso: guarda o ultimo `setParameters` aplicado. */
class FakeVideoSender {
  parameters: Record<string, unknown> = { encodings: [{}] }
  readonly track = { kind: 'video' as const }

  getParameters(): Record<string, unknown> {
    return { ...this.parameters }
  }

  setParameters(next: Record<string, unknown>): Promise<void> {
    this.parameters = next
    return Promise.resolve()
  }
}

/** Conexao falsa que ja expoe um sender de video (para nitidez e getStats). */
class FakeSenderConnection extends FakePeerConnection {
  readonly videoSender = new FakeVideoSender()

  override getSenders(): unknown[] {
    return [this.videoSender]
  }
}

interface CodecDial {
  peerId: string
  metadata: { txId: string; pull?: boolean }
  transform: ((sdp: string) => string) | undefined
  call: FakeCall
}

interface SentMessage {
  peerId: string
  message: { type: string; payload: Record<string, unknown> }
}

interface CodecHarness {
  manager: MediaManager
  dials: CodecDial[]
  sent: SentMessage[]
  announced: Record<string, unknown>[]
  state: () => RoomState
  setState: (next: RoomState) => void
}

const CODEC_START_OPTIONS = {
  sourceId: 'screen:0',
  sourceLabel: 'Tela 1',
  sourceKind: 'screen' as const,
  presetId: 'p720_30' as const,
  withAudio: false,
  pointers: false,
  displayId: 'display-1'
}

function codecState(options: {
  members?: string[]
  decodeCapabilities?: Record<string, VideoCodecId[]>
  transmissions?: RoomState['transmissions']
}): RoomState {
  const peers = options.members ?? ['dono']
  const base = createInitialState('me', 'i-me')
  return {
    ...base,
    phase: 'active',
    members: [
      { peerId: 'me', installId: 'i-me', nickname: 'Eu', joinedAt: 1, isOwner: true },
      ...peers.map((peerId, index) => ({
        peerId,
        installId: `i-${peerId}`,
        nickname: peerId,
        joinedAt: index + 2,
        isOwner: false
      }))
    ],
    decodeCapabilities: options.decodeCapabilities ?? {},
    transmissions: options.transmissions ?? {}
  }
}

function codecHarness(initial: RoomState): CodecHarness {
  const dials: CodecDial[] = []
  const sent: SentMessage[] = []
  const announced: Record<string, unknown>[] = []
  let state = initial

  const session = {
    getState: () => state,
    notifyMediaFailure: () => {},
    announceTransmissionStart: (payload: Record<string, unknown>) => announced.push(payload),
    announceTransmissionStop: () => {},
    otherMemberPeerIds: () =>
      state.members.map((entry) => entry.peerId).filter((peerId) => peerId !== 'me'),
    sendTo: (peerId: string, message: SentMessage['message']) => sent.push({ peerId, message }),
    callPeer: (
      peerId: string,
      _stream: unknown,
      metadata: CodecDial['metadata'],
      transform?: (sdp: string) => string
    ) => {
      const call = new FakeCall(peerId, metadata, new FakeSenderConnection())
      dials.push({ peerId, metadata, transform, call })
      return call
    }
  } as unknown as Session

  const manager = new MediaManager(session, () => {
    const dummy = new FakeOutStream(['video', 'audio'])
    return { stream: dummy as unknown as MediaStream, release: () => {} }
  })

  return {
    manager,
    dials,
    sent,
    announced,
    state: () => state,
    setState: (next) => {
      state = next
    }
  }
}

/** Amostra de saida sintetica, uma por par. */
function outboundSample(
  peers: string[],
  reason: string | null,
  txId = 'tx'
): ReadonlyMap<string, OutboundVideoStats> {
  return new Map(
    peers.map((peerId) => [
      peerId,
      {
        txId,
        codec: 'video/AV1',
        encoderImplementation: 'FakeEncoder',
        qualityLimitationReason: reason,
        framesPerSecond: 30,
        at: Date.now()
      }
    ])
  )
}

describe('media-manager / codec na negociacao', () => {
  beforeEach(() => {
    codecStub.encodeCandidates = ['VP8']
    codecStub.forceVp8 = false
    codecStub.listeners.clear()
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('caminho VP8: NENHUM sdpTransform chega ao PeerJS', async () => {
    stubCapture()
    codecStub.encodeCandidates = ['VP8']
    const harness = codecHarness(codecState({ decodeCapabilities: { dono: ['AV1', 'VP8'] } }))

    const local = await harness.manager.startTransmission(CODEC_START_OPTIONS)

    expect(local.videoCodec).toBe('VP8')
    expect(harness.dials).toHaveLength(1)
    // O teste falha se vier funcao: a linha de base tem que ficar sem munging.
    expect(harness.dials[0]?.transform).toBeUndefined()
    harness.manager.teardown()
  })

  it('caminho de hardware: o transform aplicado reordena a m=video de verdade', async () => {
    stubCapture()
    codecStub.encodeCandidates = ['AV1', 'VP8']
    const harness = codecHarness(codecState({ decodeCapabilities: { dono: ['AV1', 'VP8'] } }))

    const local = await harness.manager.startTransmission(CODEC_START_OPTIONS)

    expect(local.videoCodec).toBe('AV1')
    const transform = harness.dials[0]?.transform
    expect(transform).toBeTypeOf('function')
    const result = transform?.(CODEC_OFFER_SDP) ?? ''
    expect(videoPayloadsOf(result)).toEqual(['45', '96', '97', '98', '46'])
    // Nenhum payload type se perdeu no caminho.
    expect(videoPayloadsOf(result).sort()).toEqual(videoPayloadsOf(CODEC_OFFER_SDP).sort())
    harness.manager.teardown()
  })

  it('membro que nunca anunciou e ja passou da carencia derruba a escolha para VP8', async () => {
    stubCapture()
    codecStub.encodeCandidates = ['AV1', 'VP8']
    const harness = codecHarness(codecState({}))

    // Um tick de saida VAZIO (ninguem transmitindo) registra o membro...
    harness.manager.onOutboundVideoStats(new Map())
    vi.advanceTimersByTime(CODEC_MEMBER_GRACE_MS + 1_000)
    // ...e passada a carencia ele conta como VP8 (RF-06).
    const local = await harness.manager.startTransmission(CODEC_START_OPTIONS)

    expect(local.videoCodec).toBe('VP8')
    expect(harness.dials[0]?.transform).toBeUndefined()
    harness.manager.teardown()
  })

  it('o codec escolhido viaja no announce e no reenvio para quem chega depois', async () => {
    stubCapture()
    codecStub.encodeCandidates = ['AV1', 'VP8']
    const harness = codecHarness(codecState({ decodeCapabilities: { dono: ['AV1', 'VP8'] } }))

    const local = await harness.manager.startTransmission(CODEC_START_OPTIONS)
    harness.manager.onMemberJoined('dono')

    expect(harness.announced[0]).toMatchObject({ txId: local.txId, videoCodec: 'AV1' })
    expect(harness.sent[0]?.message.type).toBe('TX_START')
    expect(harness.sent[0]?.message.payload['videoCodec']).toBe('AV1')
    harness.manager.teardown()
  })

  it('answerCall NUNCA recebe sdpTransform, nem com o escape ligado', () => {
    codecStub.forceVp8 = true
    const harness = codecHarness(
      codecState({
        transmissions: {
          tx1: {
            txId: 'tx1',
            peerId: 'dono',
            presetId: 'p720_30',
            hasAudio: false,
            sourceKind: 'screen',
            sourceLabel: 'Tela 1',
            startedAt: 0,
            status: 'live',
            videoCodec: 'AV1',
            pointersEnabled: false
          }
        }
      })
    )
    const incoming = new FakeCall('dono', { txId: 'tx1' }, new FakePeerConnection())
    harness.manager.onIncomingCall(incoming as unknown as MediaConnection)

    expect(incoming.answered).toBe(true)
    expect(incoming.answerOptions).toBeUndefined()
    harness.manager.teardown()
  })

  it('answerPull leva o transform do codec local, e nada quando ele e VP8', async () => {
    stubCapture()
    codecStub.encodeCandidates = ['AV1', 'VP8']
    const harness = codecHarness(codecState({ decodeCapabilities: { dono: ['AV1', 'VP8'] } }))
    const local = await harness.manager.startTransmission(CODEC_START_OPTIONS)

    const pull = new FakeCall('dono', { txId: local.txId, pull: true }, new FakeSenderConnection())
    harness.manager.onIncomingCall(pull as unknown as MediaConnection)
    const options = pull.answerOptions as { sdpTransform?: (sdp: string) => string } | undefined
    expect(options?.sdpTransform).toBeTypeOf('function')
    expect(videoPayloadsOf(options?.sdpTransform?.(CODEC_OFFER_SDP) ?? '')[0]).toBe('45')
    harness.manager.teardown()

    // Mesma cena com a transmissao em VP8: nenhum transform.
    codecStub.encodeCandidates = ['VP8']
    const plain = codecHarness(codecState({}))
    const localVp8 = await plain.manager.startTransmission(CODEC_START_OPTIONS)
    const pullVp8 = new FakeCall(
      'dono',
      { txId: localVp8.txId, pull: true },
      new FakeSenderConnection()
    )
    plain.manager.onIncomingCall(pullVp8 as unknown as MediaConnection)
    const plainOptions = pullVp8.answerOptions as { sdpTransform?: unknown } | undefined
    expect(plainOptions?.sdpTransform).toBeUndefined()
    plain.manager.teardown()
  })
})

describe('media-manager / chamada reversa com codec', () => {
  function pullHarness(videoCodec: VideoCodecId | null): CodecHarness {
    return codecHarness(
      codecState({
        transmissions: {
          tx1: {
            txId: 'tx1',
            peerId: 'dono',
            presetId: 'p720_30',
            hasAudio: false,
            sourceKind: 'screen',
            sourceLabel: 'Tela 1',
            startedAt: 0,
            status: 'live',
            videoCodec,
            pointersEnabled: false
          }
        }
      })
    )
  }

  /** Leva a chamada recebida ate o prazo do watchdog, que dispara a reversa. */
  function forceFailure(harness: CodecHarness): CodecDial | undefined {
    const incoming = new FakeCall('dono', { txId: 'tx1' }, new FakePeerConnection())
    harness.manager.onIncomingCall(incoming as unknown as MediaConnection)
    vi.advanceTimersByTime(MEDIA_STALL_TIMEOUT_MS + 100)
    return harness.dials.find((dial) => dial.metadata.pull === true)
  }

  beforeEach(() => {
    codecStub.encodeCandidates = ['VP8']
    codecStub.forceVp8 = false
    vi.useFakeTimers()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('a oferta do pull repete o codec da transmissao anunciada', () => {
    const harness = pullHarness('AV1')
    const dial = forceFailure(harness)
    expect(dial).toBeDefined()
    expect(videoPayloadsOf(dial?.transform?.(CODEC_OFFER_SDP) ?? '')[0]).toBe('45')
    harness.manager.teardown()
  })

  it('transmissao em VP8 ou de versao antiga oferta sem nenhum transform', () => {
    const vp8 = pullHarness('VP8')
    expect(forceFailure(vp8)?.transform).toBeUndefined()
    vp8.manager.teardown()

    const antiga = pullHarness(null)
    expect(forceFailure(antiga)?.transform).toBeUndefined()
    antiga.manager.teardown()
  })

  it('com o escape local ligado a oferta do pull sai sem transform mesmo em AV1', () => {
    codecStub.forceVp8 = true
    const harness = pullHarness('AV1')
    expect(forceFailure(harness)?.transform).toBeUndefined()
    harness.manager.teardown()
  })
})

describe('media-manager / rebaixamento automatico', () => {
  beforeEach(() => {
    codecStub.encodeCandidates = ['AV1', 'H264', 'VP8']
    codecStub.forceVp8 = false
    codecStub.listeners.clear()
    vi.useFakeTimers()
    vi.setSystemTime(2_000_000)
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  /** Transmissao local ativa em AV1, com um espectador que decodifica tudo. */
  async function transmitting(): Promise<CodecHarness> {
    stubCapture()
    const harness = codecHarness(
      codecState({ decodeCapabilities: { dono: ['AV1', 'VP9', 'H264', 'VP8'] } })
    )
    const local = await harness.manager.startTransmission(CODEC_START_OPTIONS)
    expect(local.videoCodec).toBe('AV1')
    return harness
  }

  function feed(harness: CodecHarness, reason: string | null, times = 1): void {
    for (let index = 0; index < times; index += 1) {
      harness.manager.onOutboundVideoStats(outboundSample(['dono'], reason))
    }
  }

  function codecNow(harness: CodecHarness): string | undefined {
    return harness.manager.getLocalTransmission()?.videoCodec
  }

  it('aquecimento: as primeiras amostras de cpu nao rebaixam nada', async () => {
    const harness = await transmitting()
    feed(harness, 'cpu', CODEC_CPU_WARMUP_SAMPLES)
    expect(codecNow(harness)).toBe('AV1')
    harness.manager.teardown()
  })

  it('cpu persistente rebaixa UM degrau e refaz as chamadas de saida', async () => {
    const harness = await transmitting()
    const dialsBefore = harness.dials.length

    feed(harness, 'cpu', CODEC_CPU_WARMUP_SAMPLES + CODEC_CPU_PERSISTENT_SAMPLES)

    expect(codecNow(harness)).toBe('H264')
    expect(harness.dials.length).toBe(dialsBefore + 1)
    // O reanuncio silencioso saiu com o codec NOVO e o MESMO txId.
    const reannounce = harness.sent.at(-1)
    expect(reannounce?.message.type).toBe('TX_START')
    expect(reannounce?.message.payload['videoCodec']).toBe('H264')
    expect(reannounce?.message.payload['txId']).toBe(harness.manager.getLocalTransmission()?.txId)
    harness.manager.teardown()
  })

  it('AC-10: uma amostra que nao e de cpu zera a contagem (anti-flapping)', async () => {
    const harness = await transmitting()
    feed(harness, 'cpu', CODEC_CPU_WARMUP_SAMPLES)
    feed(harness, 'cpu', CODEC_CPU_PERSISTENT_SAMPLES - 1)
    feed(harness, 'bandwidth')
    feed(harness, 'cpu', CODEC_CPU_PERSISTENT_SAMPLES - 1)

    expect(codecNow(harness)).toBe('AV1')

    // Fechada a sequencia inteira, ai sim rebaixa.
    feed(harness, 'cpu')
    expect(codecNow(harness)).toBe('H264')
    harness.manager.teardown()
  })

  it('o teto de rebaixamentos por cpu vale por transmissao', async () => {
    const harness = await transmitting()
    const full = CODEC_CPU_WARMUP_SAMPLES + CODEC_CPU_PERSISTENT_SAMPLES

    feed(harness, 'cpu', full)
    expect(codecNow(harness)).toBe('H264')
    feed(harness, 'cpu', full)
    expect(codecNow(harness)).toBe('VP8')

    // Ja gastou CODEC_MAX_DOWNGRADES e, alem disso, VP8 nao tem degrau abaixo.
    const dialsBefore = harness.dials.length
    feed(harness, 'cpu', full * 2)
    expect(codecNow(harness)).toBe('VP8')
    expect(harness.dials.length).toBe(dialsBefore)
    expect(CODEC_MAX_DOWNGRADES).toBe(2)
    harness.manager.teardown()
  })

  it('carencia por membro: quem acabou de chegar nao derruba a sala', async () => {
    const harness = await transmitting()
    harness.setState(
      codecState({
        members: ['dono', 'novo'],
        decodeCapabilities: { dono: ['AV1', 'VP9', 'H264', 'VP8'] }
      })
    )

    // Dentro da carencia o recem chegado fica FORA da conta.
    vi.advanceTimersByTime(1_000)
    feed(harness, null)
    expect(codecNow(harness)).toBe('AV1')

    // Vencida a carencia, ele conta como VP8 e a sala desce no tick seguinte.
    vi.advanceTimersByTime(CODEC_MEMBER_GRACE_MS)
    feed(harness, null)
    expect(codecNow(harness)).toBe('VP8')
    harness.manager.teardown()
  })

  it('membro que ANUNCIA dentro da carencia entra com a lista real dele', async () => {
    const harness = await transmitting()
    harness.setState(
      codecState({
        members: ['dono', 'novo'],
        decodeCapabilities: {
          dono: ['AV1', 'VP9', 'H264', 'VP8'],
          novo: ['AV1', 'VP9', 'H264', 'VP8']
        }
      })
    )
    vi.advanceTimersByTime(CODEC_MEMBER_GRACE_MS * 2)
    feed(harness, null)
    expect(codecNow(harness)).toBe('AV1')
    harness.manager.teardown()
  })

  it('regra monotonica: o codec NUNCA sobe durante a transmissao', async () => {
    const harness = await transmitting()
    harness.setState(
      codecState({
        members: ['dono', 'fraco'],
        decodeCapabilities: { dono: ['AV1', 'VP9', 'H264', 'VP8'], fraco: ['VP8'] }
      })
    )
    feed(harness, null)
    expect(codecNow(harness)).toBe('VP8')

    // O membro fraco sai: mesmo assim nada de promover de volta para AV1.
    harness.setState(
      codecState({ decodeCapabilities: { dono: ['AV1', 'VP9', 'H264', 'VP8'] } })
    )
    feed(harness, null, 3)
    expect(codecNow(harness)).toBe('VP8')
    harness.manager.teardown()
  })

  it('o mapa de membros vistos sobrevive ao stopTransmission', async () => {
    const harness = await transmitting()
    // O 'dono' ja esta no mapa desde o inicio desta transmissao.
    vi.advanceTimersByTime(CODEC_MEMBER_GRACE_MS + 1_000)
    harness.manager.stopTransmission('manual')

    // Agora ele nao anuncia mais nada: a transmissao nova ja nasce em VP8,
    // sem uma nova carencia inteira de gracas.
    harness.setState(codecState({}))
    const again = await harness.manager.startTransmission(CODEC_START_OPTIONS)
    expect(again.videoCodec).toBe('VP8')
    harness.manager.teardown()
  })

  it('ligar o escape ao vivo rebaixa a transmissao para VP8', async () => {
    const harness = await transmitting()
    codecStub.setForceVp8(true)
    expect(codecNow(harness)).toBe('VP8')
    const reannounce = harness.sent.at(-1)
    expect(reannounce?.message.payload['videoCodec']).toBe('VP8')
    harness.manager.teardown()
  })

  it('debugDowngradeCodec em VP8 nao refaz chamada nenhuma', async () => {
    stubCapture()
    codecStub.encodeCandidates = ['VP8']
    const harness = codecHarness(codecState({}))
    await harness.manager.startTransmission(CODEC_START_OPTIONS)
    const dialsBefore = harness.dials.length

    harness.manager.debugDowngradeCodec()

    expect(harness.dials.length).toBe(dialsBefore)
    expect(harness.manager.getLocalTransmission()?.videoCodec).toBe('VP8')
    harness.manager.teardown()
  })
})

describe('media-manager / modo nitidez', () => {
  beforeEach(() => {
    codecStub.encodeCandidates = ['VP8']
    codecStub.forceVp8 = false
    vi.useFakeTimers()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('alterna contentHint e degradationPreference ao vivo, sem parar nada', async () => {
    stubCapture()
    const harness = codecHarness(codecState({}))
    const local = await harness.manager.startTransmission(CODEC_START_OPTIONS)
    const track = local.stream.getVideoTracks()[0] as unknown as { contentHint: string }
    const sender = (harness.dials[0]?.call.peerConnection as FakeSenderConnection).videoSender

    expect(harness.manager.isSharpnessMode()).toBe(false)
    expect(track.contentHint).toBe('motion')

    harness.manager.setSharpnessMode(true)
    expect(harness.manager.isSharpnessMode()).toBe(true)
    expect(track.contentHint).toBe('detail')
    expect(sender.parameters['degradationPreference']).toBe('maintain-resolution')

    harness.manager.setSharpnessMode(false)
    expect(track.contentHint).toBe('motion')
    expect(sender.parameters['degradationPreference']).toBe('maintain-framerate')

    // O modo nao mexe no teto de bitrate/fps, que e do preset.
    expect(sender.parameters['encodings']).toBeDefined()
    harness.manager.teardown()
  })

  it('RF-19: toda transmissao nova comeca com a nitidez desligada', async () => {
    stubCapture()
    const harness = codecHarness(codecState({}))
    await harness.manager.startTransmission(CODEC_START_OPTIONS)
    harness.manager.setSharpnessMode(true)
    harness.manager.stopTransmission('manual')
    expect(harness.manager.isSharpnessMode()).toBe(false)

    await harness.manager.startTransmission(CODEC_START_OPTIONS)
    expect(harness.manager.isSharpnessMode()).toBe(false)
    harness.manager.teardown()
  })

  it('alternar sem transmissao ativa guarda o valor e nao lanca', () => {
    const harness = codecHarness(codecState({}))
    expect(() => harness.manager.setSharpnessMode(true)).not.toThrow()
    expect(harness.manager.isSharpnessMode()).toBe(true)
    harness.manager.teardown()
  })
})
