// Autorizacao de chamada de midia recebida (matriz 5c): so atende `peer.call`
// de quem esta no roster e cujo txId bate com uma transmissao ANUNCIADA por ele.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CALL_METADATA_WAIT_MS } from '@shared/config'
import type { MediaConnection } from 'peerjs'
import { createInitialState, type RoomState } from '@renderer/core/room-state'
import { MediaManager } from '@renderer/services/media-manager'
import type { Session } from '@renderer/services/session'

type Handler = (arg: never) => void

class FakeCall {
  answered = false
  closed = false
  private readonly handlers = new Map<string, Handler[]>()

  constructor(
    readonly peer: string,
    readonly metadata: unknown
  ) {}

  on(event: string, handler: Handler): this {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
    return this
  }

  answer(): void {
    this.answered = true
  }

  close(): void {
    this.closed = true
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

function managerFor(state: RoomState): MediaManager {
  const session = { getState: () => state } as unknown as Session
  return new MediaManager(session)
}

function call(manager: MediaManager, fake: FakeCall): void {
  manager.onIncomingCall(fake as unknown as MediaConnection)
}

describe('media-manager / autorizacao de chamada recebida (5c)', () => {
  beforeEach(() => {
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
    const session = { getState: () => current } as unknown as Session
    const manager = new MediaManager(session)

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
