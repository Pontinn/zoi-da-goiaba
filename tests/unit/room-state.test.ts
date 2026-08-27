import { describe, expect, it } from 'vitest'
import { HELLO_QUARANTINE_MS } from '@shared/config'
import type {
  JoinAcceptPayload,
  RosterMember,
  RosterUpdatePayload,
  ProtocolMessage
} from '@shared/protocol'
import type { SoundId } from '@shared/sounds'
import {
  createInitialState,
  reduce,
  reduceAll,
  viewersOf,
  type Effect,
  type RoomEvent,
  type RoomState
} from '@renderer/core/room-state'

// --- helpers ---------------------------------------------------------------

function member(peerId: string, joinedAt: number, isOwner = false): RosterMember {
  return { peerId, installId: `install-${peerId}`, nickname: peerId, joinedAt, isOwner }
}

function sounds(effects: readonly Effect[]): SoundId[] {
  return effects.filter((effect) => effect.kind === 'playSound').map((effect) => effect.sound)
}

function broadcasts(effects: readonly Effect[]): ProtocolMessage[] {
  return effects.filter((effect) => effect.kind === 'broadcast').map((effect) => effect.message)
}

function kinds(effects: readonly Effect[]): string[] {
  return effects.map((effect) => effect.kind)
}

function joinedState(
  selfPeerId: string,
  members: RosterMember[],
  ownerPeerId: string,
  rosterVersion = 3
): RoomState {
  const accept: JoinAcceptPayload = {
    roomMeta: { code: 'sala-teste', limit: 8, createdAt: 0 },
    rosterVersion,
    ownerPeerId,
    members,
    banList: []
  }
  return reduce(createInitialState(), {
    kind: 'ROOM_JOINED',
    accept,
    selfPeerId,
    selfInstallId: `install-${selfPeerId}`,
    now: 1_000
  }).state
}

function ownerState(members: RosterMember[], rosterVersion = 3): RoomState {
  const created = reduce(createInitialState(), {
    kind: 'ROOM_CREATED',
    roomMeta: { code: 'sala-teste', limit: 8, createdAt: 0 },
    selfPeerId: 'owner',
    selfInstallId: 'install-owner',
    nickname: 'owner',
    now: 100
  }).state
  return {
    ...created,
    rosterVersion,
    members,
    announcedPeers: members.map((entry) => entry.peerId),
    peerLinks: Object.fromEntries(
      members
        .filter((entry) => entry.peerId !== 'owner')
        .map((entry) => [
          entry.peerId,
          { peerId: entry.peerId, status: 'up' as const, since: 100, lastSeenAt: 100 }
        ])
    )
  }
}

function rosterUpdate(
  overrides: Partial<RosterUpdatePayload> & Pick<RosterUpdatePayload, 'rosterVersion'>
): RosterUpdatePayload {
  return {
    ownerPeerId: 'owner',
    members: [],
    banList: [],
    lastChange: { kind: 'join', targetPeerId: 'x' },
    ...overrides
  }
}

// --- criacao e ingresso ----------------------------------------------------

describe('room-state / criacao e ingresso', () => {
  it('ROOM_CREATED coloca o criador como dono e pede o door peer', () => {
    const result = reduce(createInitialState(), {
      kind: 'ROOM_CREATED',
      roomMeta: { code: 'zoi-1a2b', limit: 6, createdAt: 0 },
      selfPeerId: 'owner',
      selfInstallId: 'install-owner',
      nickname: 'Pontin',
      now: 500
    })
    expect(result.state.phase).toBe('active')
    expect(result.state.ownerPeerId).toBe('owner')
    expect(result.state.rosterVersion).toBe(1)
    expect(result.state.members).toHaveLength(1)
    expect(result.state.members[0]).toMatchObject({ isOwner: true, joinedAt: 500 })
    expect(kinds(result.effects)).toContain('assumeOwnership')
  })

  it('ROOM_JOINED aplica o snapshot sem tocar som de "entrou" pelos ja presentes', () => {
    const state = joinedState(
      'me',
      [member('owner', 1, true), member('b', 2), member('me', 3)],
      'owner'
    )
    expect(state.phase).toBe('active')
    expect(state.members).toHaveLength(3)
    expect(state.announcedPeers).toEqual(['owner', 'b', 'me'])
    expect(Object.keys(state.peerLinks).sort()).toEqual(['b', 'owner'])
    expect(state.peerLinks['owner']?.status).toBe('connecting')
  })
})

// --- guard de rosterVersion -----------------------------------------------

describe('room-state / guard de rosterVersion (replay e atraso)', () => {
  it('descarta ROSTER_UPDATE com versao menor ou igual', () => {
    const state = joinedState('me', [member('owner', 1, true), member('me', 2)], 'owner', 7)
    for (const version of [7, 6, 1]) {
      const result = reduce(state, {
        kind: 'MESSAGE',
        from: 'owner',
        now: 2_000,
        message: {
          type: 'ROSTER_UPDATE',
          payload: rosterUpdate({
            rosterVersion: version,
            members: [member('owner', 1, true)],
            lastChange: { kind: 'timeout', targetPeerId: 'me' }
          })
        }
      })
      expect(result.state.rosterVersion).toBe(7)
      expect(result.state.members).toHaveLength(2)
      expect(kinds(result.effects)).toEqual(['log'])
    }
  })

  it('aceita ROSTER_UPDATE com versao estritamente maior', () => {
    const state = joinedState('me', [member('owner', 1, true), member('me', 2)], 'owner', 7)
    const result = reduce(state, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 2_000,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 8,
          members: [member('owner', 1, true), member('me', 2), member('novo', 3)],
          lastChange: { kind: 'join', targetPeerId: 'novo' }
        })
      }
    })
    expect(result.state.rosterVersion).toBe(8)
    expect(result.state.members).toHaveLength(3)
    expect(sounds(result.effects)).toEqual(['entered'])
  })
})

// --- quarentena de HELLO ---------------------------------------------------

describe('room-state / quarentena de HELLO (corrida com ROSTER_UPDATE)', () => {
  const base = (): RoomState =>
    joinedState('me', [member('owner', 1, true), member('me', 2)], 'owner', 5)

  it('guarda HELLO de peer fora do roster sem fechar a conexao na hora', () => {
    const result = reduce(base(), {
      kind: 'MESSAGE',
      from: 'novo',
      now: 1_000,
      message: { type: 'HELLO', payload: { nickname: 'Novo', joinedAt: 900 } }
    })
    expect(result.state.pendingHellos).toEqual([
      { peerId: 'novo', nickname: 'Novo', joinedAt: 900, expiresAt: 1_000 + HELLO_QUARANTINE_MS }
    ])
    expect(kinds(result.effects)).toEqual(['log'])
  })

  it('o ROSTER_UPDATE que confirma o peer resolve a quarentena e toca "entrou" UMA vez', () => {
    const withPending = reduce(base(), {
      kind: 'MESSAGE',
      from: 'novo',
      now: 1_000,
      message: { type: 'HELLO', payload: { nickname: 'Novo', joinedAt: 900 } }
    }).state

    const result = reduce(withPending, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 1_200,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 6,
          members: [member('owner', 1, true), member('me', 2), member('novo', 3)],
          lastChange: { kind: 'join', targetPeerId: 'novo' }
        })
      }
    })
    expect(result.state.pendingHellos).toHaveLength(0)
    expect(result.state.peerLinks['novo']?.status).toBe('up')
    expect(sounds(result.effects)).toEqual(['entered'])
  })

  it('quarentena expirada fecha a conexao', () => {
    const withPending = reduce(base(), {
      kind: 'MESSAGE',
      from: 'novo',
      now: 1_000,
      message: { type: 'HELLO', payload: { nickname: 'Novo', joinedAt: 900 } }
    }).state

    const early = reduce(withPending, {
      kind: 'HELLO_QUARANTINE_TICK',
      now: 1_000 + HELLO_QUARANTINE_MS - 1
    })
    expect(early.effects).toHaveLength(0)

    const expired = reduce(withPending, {
      kind: 'HELLO_QUARANTINE_TICK',
      now: 1_000 + HELLO_QUARANTINE_MS
    })
    expect(expired.state.pendingHellos).toHaveLength(0)
    expect(kinds(expired.effects)).toEqual(['log', 'closeConnection'])
  })

  it('HELLO de membro ja no roster fecha o par e toca "entrou" uma unica vez', () => {
    const state = joinedState('me', [member('owner', 1, true), member('me', 2)], 'owner', 5)
    const withNew = reduce(state, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 1_100,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 6,
          members: [member('owner', 1, true), member('me', 2), member('novo', 3)],
          lastChange: { kind: 'join', targetPeerId: 'novo' }
        })
      }
    })
    expect(sounds(withNew.effects)).toEqual(['entered'])

    const hello = reduce(withNew.state, {
      kind: 'MESSAGE',
      from: 'novo',
      now: 1_200,
      message: { type: 'HELLO', payload: { nickname: 'novo', joinedAt: 3 } }
    })
    expect(sounds(hello.effects)).toEqual([])
    expect(hello.state.peerLinks['novo']?.status).toBe('up')
  })
})

// --- matriz de autorizacao 5c ---------------------------------------------

describe('room-state / matriz de autorizacao 5c', () => {
  const state = (): RoomState =>
    joinedState('me', [member('owner', 1, true), member('me', 2), member('b', 3)], 'owner', 5)

  it('MOD_REMOVE forjado por membro e ignorado (RF-34)', () => {
    const result = reduce(state(), {
      kind: 'MESSAGE',
      from: 'b',
      now: 1,
      message: { type: 'MOD_REMOVE', payload: { mode: 'ban' } }
    })
    expect(result.state.phase).toBe('active')
    expect(kinds(result.effects)).toEqual(['log'])
    expect(sounds(result.effects)).toEqual([])
  })

  it('MOD_REMOVE do dono derruba o alvo com som "desconectado" (AC-23)', () => {
    const result = reduce(state(), {
      kind: 'MESSAGE',
      from: 'owner',
      now: 1,
      message: { type: 'MOD_REMOVE', payload: { mode: 'kick' } }
    })
    expect(result.state.phase).toBe('ended')
    expect(result.state.endReason).toBe('kicked')
    expect(sounds(result.effects)).toEqual(['removed'])
    expect(kinds(result.effects)).toContain('destroySession')
  })

  it('MOD_REMOVE do dono com mode ban marca endReason banned', () => {
    const result = reduce(state(), {
      kind: 'MESSAGE',
      from: 'owner',
      now: 1,
      message: { type: 'MOD_REMOVE', payload: { mode: 'ban' } }
    })
    expect(result.state.endReason).toBe('banned')
  })

  it('OWNER_TRANSFER de membro comum e rejeitado', () => {
    const result = reduce(state(), {
      kind: 'MESSAGE',
      from: 'b',
      now: 1,
      message: { type: 'OWNER_TRANSFER', payload: { newOwnerPeerId: 'b', rosterVersion: 99 } }
    })
    expect(result.state.ownerPeerId).toBe('owner')
    expect(kinds(result.effects)).toContain('log')
  })

  it('mensagens de desconhecido fecham a conexao', () => {
    for (const message of [
      { type: 'TX_STOP', payload: { txId: 't', reason: 'manual' } },
      { type: 'WATCHING_UPDATE', payload: { watchingTxId: null } },
      { type: 'QUALITY_UPDATE', payload: { level: 'good', rttMs: 1, inboundBitrateKbps: null } },
      { type: 'NICKNAME_UPDATE', payload: { nickname: 'x' } }
    ] as ProtocolMessage[]) {
      const result = reduce(state(), { kind: 'MESSAGE', from: 'intruso', now: 1, message })
      expect(kinds(result.effects)).toContain('closeConnection')
    }
  })

  it('mensagens de admissao chegando no mesh sao apenas logadas', () => {
    const result = reduce(state(), {
      kind: 'MESSAGE',
      from: 'b',
      now: 1,
      message: {
        type: 'JOIN_ACCEPT',
        payload: {
          roomMeta: { code: 'x', limit: 2, createdAt: 0 },
          rosterVersion: 99,
          ownerPeerId: 'b',
          members: [],
          banList: []
        }
      }
    })
    expect(result.state.ownerPeerId).toBe('owner')
    expect(kinds(result.effects)).toEqual(['log'])
  })
})

// --- transmissoes ----------------------------------------------------------

describe('room-state / transmissoes', () => {
  const state = (): RoomState =>
    joinedState('me', [member('owner', 1, true), member('me', 2), member('b', 3)], 'owner', 5)

  const txStart = (txId: string): ProtocolMessage => ({
    type: 'TX_START',
    payload: {
      txId,
      presetId: 'p1080_30',
      hasAudio: true,
      sourceKind: 'screen',
      sourceLabel: 'Tela 1',
      startedAt: 10
    }
  })

  it('TX_START adiciona a transmissao e toca "transmitindo"', () => {
    const result = reduce(state(), { kind: 'MESSAGE', from: 'b', now: 10, message: txStart('t1') })
    expect(Object.keys(result.state.transmissions)).toEqual(['t1'])
    expect(result.state.transmissions['t1']).toMatchObject({ peerId: 'b', status: 'live' })
    expect(sounds(result.effects)).toEqual(['transmitting'])
  })

  it('TX_START duplicado do mesmo peer SUBSTITUI o anterior (RF-18)', () => {
    const first = reduce(state(), { kind: 'MESSAGE', from: 'b', now: 10, message: txStart('t1') })
    const second = reduce(first.state, {
      kind: 'MESSAGE',
      from: 'b',
      now: 20,
      message: txStart('t2')
    })
    expect(Object.keys(second.state.transmissions)).toEqual(['t2'])
  })

  it('dois transmissores coexistem (RF-22)', () => {
    const first = reduce(state(), { kind: 'MESSAGE', from: 'b', now: 10, message: txStart('t1') })
    const second = reduce(first.state, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 11,
      message: txStart('t2')
    })
    expect(Object.keys(second.state.transmissions).sort()).toEqual(['t1', 't2'])
  })

  it('TX_STOP remove e toca "parou-transmissao"', () => {
    const started = reduce(state(), { kind: 'MESSAGE', from: 'b', now: 10, message: txStart('t1') })
    const result = reduce(started.state, {
      kind: 'MESSAGE',
      from: 'b',
      now: 30,
      message: { type: 'TX_STOP', payload: { txId: 't1', reason: 'manual' } }
    })
    expect(result.state.transmissions).toEqual({})
    expect(sounds(result.effects)).toEqual(['stoppedTransmitting'])
  })

  it('TX_STOP de transmissao alheia e ignorado', () => {
    const started = reduce(state(), { kind: 'MESSAGE', from: 'b', now: 10, message: txStart('t1') })
    const result = reduce(started.state, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 30,
      message: { type: 'TX_STOP', payload: { txId: 't1', reason: 'manual' } }
    })
    expect(Object.keys(result.state.transmissions)).toEqual(['t1'])
    expect(kinds(result.effects)).toEqual(['log'])
  })

  it('parar de assistir quando a transmissao assistida termina', () => {
    const started = reduce(state(), { kind: 'MESSAGE', from: 'b', now: 10, message: txStart('t1') })
    const watching = reduce(started.state, { kind: 'LOCAL_WATCHING', txId: 't1', now: 12 })
    expect(watching.state.selfWatchingTxId).toBe('t1')
    expect(broadcasts(watching.effects)).toEqual([
      { type: 'WATCHING_UPDATE', payload: { watchingTxId: 't1' } }
    ])
    const stopped = reduce(watching.state, {
      kind: 'MESSAGE',
      from: 'b',
      now: 30,
      message: { type: 'TX_STOP', payload: { txId: 't1', reason: 'manual' } }
    })
    expect(stopped.state.selfWatchingTxId).toBeNull()
  })

  it('LOCAL_TX_START anuncia TX_START e LOCAL_TX_STOP por leaving anuncia TX_STOP (RF-20)', () => {
    const started = reduce(state(), {
      kind: 'LOCAL_TX_START',
      txId: 'meu',
      presetId: 'p720_30',
      hasAudio: false,
      sourceKind: 'window',
      sourceLabel: 'VLC',
      videoCodec: 'VP8',
      pointers: false,
      now: 40
    })
    expect(broadcasts(started.effects)[0]).toMatchObject({ type: 'TX_START' })
    expect(sounds(started.effects)).toEqual(['transmitting'])

    const stopped = reduce(started.state, { kind: 'LOCAL_TX_STOP', reason: 'leaving', now: 50 })
    expect(broadcasts(stopped.effects)).toEqual([
      { type: 'TX_STOP', payload: { txId: 'meu', reason: 'leaving' } }
    ])
    expect(sounds(stopped.effects)).toEqual(['stoppedTransmitting'])
    expect(stopped.state.transmissions).toEqual({})
  })

  it('TX_START nao muta o mapa de transmissoes do estado anterior (imutabilidade)', () => {
    // A UI decide re-render por identidade: escrever no objeto antigo faria a
    // grade de miniaturas nunca aparecer.
    const before = state()
    const local = reduce(before, {
      kind: 'LOCAL_TX_START',
      txId: 'meu',
      presetId: 'p720_30',
      hasAudio: false,
      sourceKind: 'screen',
      sourceLabel: 'Tela 1',
      videoCodec: 'VP8',
      pointers: false,
      now: 40
    })
    expect(before.transmissions).toEqual({})
    expect(local.state.transmissions).not.toBe(before.transmissions)

    const remote = reduce(local.state, {
      kind: 'MESSAGE',
      from: 'b',
      now: 45,
      message: {
        type: 'TX_START',
        payload: {
          txId: 'dele',
          presetId: 'p720_30',
          hasAudio: false,
          sourceKind: 'screen',
          sourceLabel: 'Tela 2',
          startedAt: 45
        }
      }
    })
    expect(Object.keys(local.state.transmissions)).toEqual(['meu'])
    expect(remote.state.transmissions).not.toBe(local.state.transmissions)
    expect(Object.keys(remote.state.transmissions).sort()).toEqual(['dele', 'meu'])
  })
})

// --- reconexao e timeout ---------------------------------------------------

describe('room-state / reconexao de par (RF-40/RF-48)', () => {
  it('reconnecting congela a transmissao do par e a volta marca "reconectado"', () => {
    const state = joinedState(
      'me',
      [member('owner', 1, true), member('me', 2), member('b', 3)],
      'owner',
      5
    )
    const started = reduce(state, {
      kind: 'MESSAGE',
      from: 'b',
      now: 10,
      message: {
        type: 'TX_START',
        payload: {
          txId: 't1',
          presetId: 'p720_30',
          hasAudio: false,
          sourceKind: 'screen',
          sourceLabel: 'Tela',
          startedAt: 10
        }
      }
    }).state

    const down = reduce(started, { kind: 'PEER_LINK_RECONNECTING', peerId: 'b', now: 1_000 })
    expect(down.state.peerLinks['b']?.status).toBe('reconnecting')
    expect(down.state.transmissions['t1']?.status).toBe('reconnecting')
    expect(down.effects).toHaveLength(0)

    const up = reduce(down.state, { kind: 'PEER_LINK_UP', peerId: 'b', now: 5_000 })
    expect(up.state.peerLinks['b']?.status).toBe('up')
    expect(up.state.transmissions['t1']?.status).toBe('live')
    expect(sounds(up.effects)).toEqual(['reconnected'])
  })

  it('o DONO remove o membro no timeout e propaga kind "timeout" com som "saiu"', () => {
    const state = ownerState([member('owner', 1, true), member('b', 2), member('c', 3)], 5)
    const result = reduce(state, {
      kind: 'PEER_LINK_RECONNECT_TIMEOUT',
      peerId: 'b',
      now: 20_000
    })
    expect(result.state.members.map((entry) => entry.peerId)).toEqual(['owner', 'c'])
    expect(result.state.rosterVersion).toBe(6)
    expect(sounds(result.effects)).toEqual(['left'])
    const broadcast = broadcasts(result.effects)[0]
    expect(broadcast).toMatchObject({
      type: 'ROSTER_UPDATE',
      payload: { lastChange: { kind: 'timeout', targetPeerId: 'b' } }
    })
  })

  it('membro comum NAO remove par que segue no roster do dono: marca unreachable', () => {
    const state = joinedState(
      'me',
      [member('owner', 1, true), member('me', 2), member('b', 3)],
      'owner',
      5
    )
    const withTx = reduce(state, {
      kind: 'MESSAGE',
      from: 'b',
      now: 10,
      message: {
        type: 'TX_START',
        payload: {
          txId: 't1',
          presetId: 'p720_30',
          hasAudio: false,
          sourceKind: 'screen',
          sourceLabel: 'Tela',
          startedAt: 10
        }
      }
    }).state

    const result = reduce(withTx, { kind: 'PEER_LINK_RECONNECT_TIMEOUT', peerId: 'b', now: 30_000 })
    expect(result.state.members.map((entry) => entry.peerId)).toEqual(['owner', 'me', 'b'])
    expect(result.state.peerLinks['b']?.status).toBe('unreachable')
    expect(result.state.transmissions).toEqual({})
    expect(sounds(result.effects)).toEqual(['connectionError'])
    expect(kinds(result.effects)).toContain('scheduleRedial')
  })

  it('par que nunca conectou (RF-41) toca "erro-conexao" e vira unreachable sem retry', () => {
    const state = joinedState(
      'me',
      [member('owner', 1, true), member('me', 2), member('b', 3)],
      'owner',
      5
    )
    const result = reduce(state, { kind: 'PEER_LINK_FAILED', peerId: 'b', now: 20_000 })
    expect(result.state.peerLinks['b']?.status).toBe('unreachable')
    expect(sounds(result.effects)).toEqual(['connectionError'])
    expect(kinds(result.effects)).not.toContain('scheduleRedial')
  })
})

// --- queda do dono e handover ---------------------------------------------

describe('room-state / queda do dono e regra de handover (secao 2.7)', () => {
  const roster = [member('owner', 1, true), member('me', 5), member('c', 9)]

  it('o vencedor da eleicao assume, remove o dono caido e re-emite ROSTER_UPDATE', () => {
    const state = joinedState('me', roster, 'owner', 5)
    const down = reduce(state, {
      kind: 'PEER_LINK_RECONNECTING',
      peerId: 'owner',
      now: 1_000
    }).state
    const result = reduce(down, {
      kind: 'PEER_LINK_RECONNECT_TIMEOUT',
      peerId: 'owner',
      now: 16_000
    })

    expect(result.state.ownerPeerId).toBe('me')
    expect(result.state.rosterVersion).toBe(6)
    expect(result.state.members.map((entry) => entry.peerId)).toEqual(['me', 'c'])
    expect(result.state.members.find((entry) => entry.peerId === 'me')?.isOwner).toBe(true)
    expect(sounds(result.effects)).toEqual(['left'])
    const assume = result.effects.find((effect) => effect.kind === 'assumeOwnership')
    expect(assume).toEqual({ kind: 'assumeOwnership', rebroadcast: true })
    expect(broadcasts(result.effects)[0]).toMatchObject({
      type: 'ROSTER_UPDATE',
      payload: { lastChange: { kind: 'transfer', targetPeerId: 'me' } }
    })
  })

  it('quem NAO venceu apenas espera o eleito', () => {
    const state = joinedState('c', roster, 'owner', 5)
    const down = reduce(state, {
      kind: 'PEER_LINK_RECONNECTING',
      peerId: 'owner',
      now: 1_000
    }).state
    const result = reduce(down, {
      kind: 'PEER_LINK_RECONNECT_TIMEOUT',
      peerId: 'owner',
      now: 16_000
    })
    expect(result.state.ownerPeerId).toBe('owner')
    expect(result.state.members).toHaveLength(3)
    expect(kinds(result.effects)).toEqual(['log'])
  })

  it('aceita ROSTER_UPDATE do eleito quando (a)+(b)+(c) valem', () => {
    const state = joinedState('c', roster, 'owner', 5)
    const down = reduce(state, {
      kind: 'PEER_LINK_RECONNECTING',
      peerId: 'owner',
      now: 1_000
    }).state
    const result = reduce(down, {
      kind: 'MESSAGE',
      from: 'me',
      now: 2_000,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 6,
          ownerPeerId: 'me',
          members: [member('me', 5, true), member('c', 9)],
          lastChange: { kind: 'transfer', targetPeerId: 'me' }
        })
      }
    })
    expect(result.state.ownerPeerId).toBe('me')
    expect(result.state.rosterVersion).toBe(6)
    expect(result.state.members.map((entry) => entry.peerId)).toEqual(['me', 'c'])
  })

  it('aceita o handover tambem com o link do dono em unreachable (condicao b)', () => {
    const state = joinedState('c', roster, 'owner', 5)
    const failed = reduce(state, { kind: 'PEER_LINK_FAILED', peerId: 'owner', now: 1_000 }).state
    expect(failed.peerLinks['owner']?.status).toBe('unreachable')
    const result = reduce(failed, {
      kind: 'MESSAGE',
      from: 'me',
      now: 2_000,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 6,
          ownerPeerId: 'me',
          members: [member('me', 5, true), member('c', 9)],
          lastChange: { kind: 'transfer', targetPeerId: 'me' }
        })
      }
    })
    expect(result.state.ownerPeerId).toBe('me')
  })

  it('REJEITA handover enquanto o link com o dono ainda esta apenas "connecting"', () => {
    const state = joinedState('c', roster, 'owner', 5)
    expect(state.peerLinks['owner']?.status).toBe('connecting')
    const result = reduce(state, {
      kind: 'MESSAGE',
      from: 'me',
      now: 2_000,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 6,
          ownerPeerId: 'me',
          members: [member('me', 5, true), member('c', 9)],
          lastChange: { kind: 'transfer', targetPeerId: 'me' }
        })
      }
    })
    expect(result.state.ownerPeerId).toBe('owner')
    expect(kinds(result.effects)).toEqual(['log'])
  })

  it('REJEITA takeover forjado com o dono SAUDAVEL (condicao b)', () => {
    const state = joinedState('c', roster, 'owner', 5)
    const healthy = reduce(state, { kind: 'PEER_LINK_UP', peerId: 'owner', now: 900 }).state
    const result = reduce(healthy, {
      kind: 'MESSAGE',
      from: 'me',
      now: 2_000,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 99,
          ownerPeerId: 'me',
          members: [member('me', 5, true)],
          lastChange: { kind: 'transfer', targetPeerId: 'me' }
        })
      }
    })
    expect(result.state.ownerPeerId).toBe('owner')
    expect(result.state.rosterVersion).toBe(5)
    expect(kinds(result.effects)).toEqual(['log'])
  })

  it('REJEITA takeover de quem NAO e o vencedor deterministico (condicao a)', () => {
    const state = joinedState('me', roster, 'owner', 5)
    const down = reduce(state, {
      kind: 'PEER_LINK_RECONNECTING',
      peerId: 'owner',
      now: 1_000
    }).state
    const result = reduce(down, {
      kind: 'MESSAGE',
      from: 'c',
      now: 2_000,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 99,
          ownerPeerId: 'c',
          members: [member('c', 9, true), member('me', 5)],
          lastChange: { kind: 'transfer', targetPeerId: 'c' }
        })
      }
    })
    expect(result.state.ownerPeerId).toBe('owner')
    expect(kinds(result.effects)).toEqual(['log'])
  })

  it('REJEITA handover com rosterVersion nao maior (condicao c)', () => {
    const state = joinedState('c', roster, 'owner', 5)
    const down = reduce(state, {
      kind: 'PEER_LINK_RECONNECTING',
      peerId: 'owner',
      now: 1_000
    }).state
    const result = reduce(down, {
      kind: 'MESSAGE',
      from: 'me',
      now: 2_000,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 5,
          ownerPeerId: 'me',
          members: [member('me', 5, true), member('c', 9)],
          lastChange: { kind: 'transfer', targetPeerId: 'me' }
        })
      }
    })
    expect(result.state.ownerPeerId).toBe('owner')
    expect(kinds(result.effects)).toEqual(['log'])
  })

  it('o ex-dono isolado CEDE ao receber o ROSTER_UPDATE do eleito', () => {
    // Perspectiva do ex-dono: ele era o dono e todos os seus links cairam.
    const exOwner = ownerState([member('owner', 1, true), member('me', 5), member('c', 9)], 5)
    const isolated: RoomState = {
      ...exOwner,
      peerLinks: {
        me: { peerId: 'me', status: 'reconnecting', since: 1, lastSeenAt: 1 },
        c: { peerId: 'c', status: 'reconnecting', since: 1, lastSeenAt: 1 }
      }
    }
    const result = reduce(isolated, {
      kind: 'MESSAGE',
      from: 'me',
      now: 30_000,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 6,
          ownerPeerId: 'me',
          members: [member('me', 5, true), member('c', 9)],
          lastChange: { kind: 'transfer', targetPeerId: 'me' }
        })
      }
    })
    // Ele cede a posse e, por ja estar fora do roster do eleito, encerra a
    // sessao local para reentrar pela porta (edge case do Sprint 4).
    expect(result.state.ownerPeerId).toBe('me')
    expect(result.state.phase).toBe('ended')
    expect(result.state.endReason).toBe('connection_lost')
    expect(kinds(result.effects)).toContain('destroySession')
  })

  it('dono SAUDAVEL com a sala conectada barra o takeover do sucessor', () => {
    const owner = ownerState([member('owner', 1, true), member('me', 5), member('c', 9)], 5)
    const result = reduce(owner, {
      kind: 'MESSAGE',
      from: 'me',
      now: 30_000,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 99,
          ownerPeerId: 'me',
          members: [member('me', 5, true), member('c', 9)],
          lastChange: { kind: 'transfer', targetPeerId: 'me' }
        })
      }
    })
    expect(result.state.ownerPeerId).toBe('owner')
    expect(result.state.phase).toBe('active')
    expect(kinds(result.effects)).toEqual(['log'])
  })

  it('ultimo membro restante encerra a sala quando o dono cai', () => {
    const state = joinedState('me', [member('owner', 1, true), member('me', 5)], 'owner', 5)
    const down = reduce(state, {
      kind: 'PEER_LINK_RECONNECTING',
      peerId: 'owner',
      now: 1_000
    }).state
    const result = reduce(down, {
      kind: 'PEER_LINK_RECONNECT_TIMEOUT',
      peerId: 'owner',
      now: 16_000
    })
    expect(result.state.ownerPeerId).toBe('me')
    expect(result.state.members.map((entry) => entry.peerId)).toEqual(['me'])
  })
})

// --- moderacao pelo dono ---------------------------------------------------

describe('room-state / moderacao do dono (RF-31/RF-33/RF-36)', () => {
  it('kick remove sem adicionar a ban list', () => {
    const state = ownerState([member('owner', 1, true), member('b', 2)], 5)
    const result = reduce(state, { kind: 'OWNER_REMOVE', peerId: 'b', mode: 'kick', now: 100 })
    expect(result.state.members.map((entry) => entry.peerId)).toEqual(['owner'])
    expect(result.state.banList).toEqual([])
    expect(result.state.rosterVersion).toBe(6)
    const modRemove = result.effects.find((effect) => effect.kind === 'send')
    expect(modRemove).toEqual({
      kind: 'send',
      to: 'b',
      message: { type: 'MOD_REMOVE', payload: { mode: 'kick' } }
    })
    expect(sounds(result.effects)).toEqual(['left'])
    expect(broadcasts(result.effects)[0]).toMatchObject({
      payload: { lastChange: { kind: 'kick', targetPeerId: 'b' } }
    })
  })

  it('ban adiciona o installId na ban list replicada no ROSTER_UPDATE', () => {
    const state = ownerState([member('owner', 1, true), member('b', 2)], 5)
    const result = reduce(state, { kind: 'OWNER_REMOVE', peerId: 'b', mode: 'ban', now: 100 })
    expect(result.state.banList).toEqual([{ installId: 'install-b', nickname: 'b' }])
    const broadcast = broadcasts(result.effects)[0]
    expect(broadcast).toMatchObject({
      type: 'ROSTER_UPDATE',
      payload: {
        banList: [{ installId: 'install-b', nickname: 'b' }],
        lastChange: { kind: 'ban', targetPeerId: 'b' }
      }
    })
  })

  it('ban do mesmo peer duas vezes nao duplica a entrada', () => {
    const state = ownerState([member('owner', 1, true), member('b', 2)], 5)
    const first = reduce(state, { kind: 'OWNER_REMOVE', peerId: 'b', mode: 'ban', now: 100 })
    const again = reduce(
      { ...first.state, members: [...first.state.members, member('b', 20)] },
      { kind: 'OWNER_REMOVE', peerId: 'b', mode: 'ban', now: 200 }
    )
    expect(again.state.banList).toHaveLength(1)
  })

  it('moderacao por quem nao e dono e ignorada', () => {
    const state = joinedState(
      'me',
      [member('owner', 1, true), member('me', 2), member('b', 3)],
      'owner',
      5
    )
    const result = reduce(state, { kind: 'OWNER_REMOVE', peerId: 'b', mode: 'ban', now: 100 })
    expect(result.state.members).toHaveLength(3)
    expect(kinds(result.effects)).toEqual(['log'])
  })

  it('o dono nao pode moderar a si mesmo', () => {
    const state = ownerState([member('owner', 1, true), member('b', 2)], 5)
    const result = reduce(state, { kind: 'OWNER_REMOVE', peerId: 'owner', mode: 'kick', now: 100 })
    expect(result.state.members).toHaveLength(2)
    expect(kinds(result.effects)).toEqual(['log'])
  })

  it('os DEMAIS participantes tocam "saiu" no kick/ban (AC-23 revisao 5)', () => {
    const state = joinedState(
      'c',
      [member('owner', 1, true), member('b', 2), member('c', 3)],
      'owner',
      5
    )
    const result = reduce(state, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 500,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 6,
          members: [member('owner', 1, true), member('c', 3)],
          lastChange: { kind: 'ban', targetPeerId: 'b' }
        })
      }
    })
    expect(sounds(result.effects)).toEqual(['left'])
    expect(result.state.members.map((entry) => entry.peerId)).toEqual(['owner', 'c'])
    expect(kinds(result.effects)).toContain('closeConnection')
  })
})

// --- admissao pelo dono e saida --------------------------------------------

describe('room-state / OWNER_ADMIT e SELF_LEAVE', () => {
  it('OWNER_ADMIT propaga ROSTER_UPDATE de join e toca "entrou"', () => {
    const state = ownerState([member('owner', 1, true)], 4)
    const novo = member('novo', 900)
    const result = reduce(state, {
      kind: 'OWNER_ADMIT',
      member: novo,
      members: [member('owner', 1, true), novo],
      rosterVersion: 5,
      now: 900
    })
    expect(result.state.rosterVersion).toBe(5)
    expect(result.state.members).toHaveLength(2)
    expect(sounds(result.effects)).toEqual(['entered'])
    expect(broadcasts(result.effects)[0]).toMatchObject({
      type: 'ROSTER_UPDATE',
      payload: { lastChange: { kind: 'join', targetPeerId: 'novo' } }
    })
  })

  it('SELF_LEAVE do dono transfere a posse ao mais antigo e depois sai (RF-35)', () => {
    const state = ownerState([member('owner', 1, true), member('b', 5), member('c', 2)], 5)
    const result = reduce(state, { kind: 'SELF_LEAVE', now: 1_000 })
    const messages = broadcasts(result.effects)
    // OWNER_TRANSFER vai imediatamente antes do LEAVE (tabela 5.A).
    expect(messages).toEqual([
      { type: 'OWNER_TRANSFER', payload: { newOwnerPeerId: 'c', rosterVersion: 6 } },
      { type: 'LEAVE', payload: {} }
    ])
    expect(result.state.phase).toBe('ended')
    expect(result.state.endReason).toBe('left')
  })

  it('SELF_LEAVE do dono libera o door ANTES de anunciar a transferencia (R5)', () => {
    const state = ownerState([member('owner', 1, true), member('b', 5), member('c', 2)], 5)
    const result = reduce(state, { kind: 'SELF_LEAVE', now: 1_000 })
    const order = kinds(result.effects)
    expect(order).toContain('releaseDoor')
    expect(order.indexOf('releaseDoor')).toBeLessThan(order.indexOf('broadcast'))
  })

  it('sem sucessor o dono nao libera o door nem anuncia transferencia', () => {
    const state = ownerState([member('owner', 1, true)], 5)
    const result = reduce(state, { kind: 'SELF_LEAVE', now: 1_000 })
    expect(kinds(result.effects)).not.toContain('releaseDoor')
    expect(broadcasts(result.effects)).toEqual([{ type: 'LEAVE', payload: {} }])
  })

  it('o sucessor assume ao receber OWNER_TRANSFER e remove o ex-dono no LEAVE', () => {
    const state = joinedState(
      'c',
      [member('owner', 1, true), member('b', 5), member('c', 2)],
      'owner',
      5
    )
    const transferred = reduce(state, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 1_000,
      message: {
        type: 'OWNER_TRANSFER',
        payload: { newOwnerPeerId: 'c', rosterVersion: 6 }
      }
    })
    expect(transferred.state.ownerPeerId).toBe('c')
    expect(transferred.state.rosterVersion).toBe(6)
    // Re-emissao ligada: quem receber o snapshot antes do OWNER_TRANSFER precisa
    // de uma segunda chance para convergir (secao 2.7).
    expect(transferred.effects).toContainEqual({ kind: 'assumeOwnership', rebroadcast: true })

    const left = reduce(transferred.state, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 1_100,
      message: { type: 'LEAVE', payload: {} }
    })
    expect(left.state.members.map((entry) => entry.peerId).sort()).toEqual(['b', 'c'])
    expect(broadcasts(left.effects)[0]).toMatchObject({
      type: 'ROSTER_UPDATE',
      payload: { ownerPeerId: 'c', lastChange: { kind: 'leave', targetPeerId: 'owner' } }
    })
  })

  it('o sucessor ja carrega a ban list replicada (RF-36)', () => {
    const state = joinedState('c', [member('owner', 1, true), member('c', 2)], 'owner', 5)
    const withBan = reduce(state, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 900,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 6,
          members: [member('owner', 1, true), member('c', 2)],
          banList: [{ installId: 'i-x', nickname: 'X' }],
          lastChange: { kind: 'ban', targetPeerId: 'x' }
        })
      }
    }).state
    const transferred = reduce(withBan, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 1_000,
      message: { type: 'OWNER_TRANSFER', payload: { newOwnerPeerId: 'c', rosterVersion: 7 } }
    })
    expect(transferred.state.banList).toEqual([{ installId: 'i-x', nickname: 'X' }])
    const left = reduce(transferred.state, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 1_100,
      message: { type: 'LEAVE', payload: {} }
    })
    expect(broadcasts(left.effects)[0]).toMatchObject({
      payload: { banList: [{ installId: 'i-x', nickname: 'X' }] }
    })
  })

  it('SELF_LEAVE de membro comum so anuncia LEAVE', () => {
    const state = joinedState('me', [member('owner', 1, true), member('me', 2)], 'owner', 5)
    const result = reduce(state, { kind: 'SELF_LEAVE', now: 1_000 })
    expect(broadcasts(result.effects)).toEqual([{ type: 'LEAVE', payload: {} }])
    expect(kinds(result.effects)).toContain('destroySession')
  })

  it('SELF_LEAVE com transmissao ativa pede a parada antes de sair (RF-20)', () => {
    const state = joinedState('me', [member('owner', 1, true), member('me', 2)], 'owner', 5)
    const transmitting = reduce(state, {
      kind: 'LOCAL_TX_START',
      txId: 'meu',
      presetId: 'p1080_60',
      hasAudio: true,
      sourceKind: 'screen',
      sourceLabel: 'Tela 1',
      videoCodec: 'VP8',
      pointers: false,
      now: 10
    }).state
    const result = reduce(transmitting, { kind: 'SELF_LEAVE', now: 1_000 })
    expect(result.effects[0]).toEqual({ kind: 'stopLocalTransmission', reason: 'leaving' })
  })

  it('LEAVE recebido pelo dono remove o membro e propaga kind "leave"', () => {
    const state = ownerState([member('owner', 1, true), member('b', 2)], 5)
    const result = reduce(state, {
      kind: 'MESSAGE',
      from: 'b',
      now: 100,
      message: { type: 'LEAVE', payload: {} }
    })
    expect(result.state.members.map((entry) => entry.peerId)).toEqual(['owner'])
    expect(sounds(result.effects)).toEqual(['left'])
    expect(broadcasts(result.effects)[0]).toMatchObject({
      payload: { lastChange: { kind: 'leave', targetPeerId: 'b' } }
    })
  })

  it('LEAVE do DONO destrava o handover para o membro que perdeu o OWNER_TRANSFER', () => {
    // O membro "me" recebe o LEAVE do dono mas nunca recebeu o OWNER_TRANSFER
    // (viajaram por links diferentes). O snapshot do sucessor "b" so pode ser
    // aceito se o link com o ex-dono deixar de contar como saudavel.
    const members = [member('owner', 1, true), member('b', 2), member('me', 3)]
    const joined = joinedState('me', members, 'owner', 5)
    const linked: RoomState = {
      ...joined,
      peerLinks: Object.fromEntries(
        ['owner', 'b'].map((peerId) => [
          peerId,
          { peerId, status: 'up' as const, since: 1, lastSeenAt: 1 }
        ])
      )
    }

    const snapshotFromB: RoomEvent = {
      kind: 'MESSAGE',
      from: 'b',
      now: 200,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 7,
          ownerPeerId: 'b',
          members: [member('b', 2, true), member('me', 3)],
          lastChange: { kind: 'transfer', targetPeerId: 'b' }
        })
      }
    }

    // Antes do LEAVE: rejeitado, o dono local ainda parece saudavel.
    expect(reduce(linked, snapshotFromB).state.ownerPeerId).toBe('owner')

    const afterLeave = reduce(linked, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 100,
      message: { type: 'LEAVE', payload: {} }
    })
    expect(afterLeave.state.peerLinks['owner']?.status).toBe('timeout')

    const adopted = reduce(afterLeave.state, snapshotFromB)
    expect(adopted.state.ownerPeerId).toBe('b')
    expect(adopted.state.members.map((entry) => entry.peerId).sort()).toEqual(['b', 'me'])
  })

  it('LEAVE recebido por membro comum apenas fecha a conexao (som vem do dono)', () => {
    const state = joinedState(
      'me',
      [member('owner', 1, true), member('me', 2), member('b', 3)],
      'owner',
      5
    )
    const result = reduce(state, {
      kind: 'MESSAGE',
      from: 'b',
      now: 100,
      message: { type: 'LEAVE', payload: {} }
    })
    expect(result.state.members).toHaveLength(3)
    expect(kinds(result.effects)).toEqual(['closeConnection'])
  })
})

// --- nickname e qualidade --------------------------------------------------

describe('room-state / nickname e qualidade', () => {
  it('NICKNAME_UPDATE altera apenas o nickname DO REMETENTE', () => {
    const state = joinedState(
      'me',
      [member('owner', 1, true), member('me', 2), member('b', 3)],
      'owner',
      5
    )
    const result = reduce(state, {
      kind: 'MESSAGE',
      from: 'b',
      now: 10,
      message: { type: 'NICKNAME_UPDATE', payload: { nickname: 'Bruno' } }
    })
    expect(result.state.members.find((entry) => entry.peerId === 'b')?.nickname).toBe('Bruno')
    expect(result.state.members.find((entry) => entry.peerId === 'me')?.nickname).toBe('me')
  })

  it('o dono consolida o nickname no proximo ROSTER_UPDATE', () => {
    const state = ownerState([member('owner', 1, true), member('b', 2)], 5)
    const result = reduce(state, {
      kind: 'MESSAGE',
      from: 'b',
      now: 10,
      message: { type: 'NICKNAME_UPDATE', payload: { nickname: 'Bruno' } }
    })
    expect(result.state.rosterVersion).toBe(6)
    expect(broadcasts(result.effects)[0]).toMatchObject({
      type: 'ROSTER_UPDATE',
      payload: { lastChange: { kind: 'nickname', targetPeerId: 'b' } }
    })
  })

  it('LOCAL_NICKNAME de membro comum anuncia NICKNAME_UPDATE', () => {
    const state = joinedState('me', [member('owner', 1, true), member('me', 2)], 'owner', 5)
    const result = reduce(state, { kind: 'LOCAL_NICKNAME', nickname: '  Leo  ', now: 10 })
    expect(result.state.members.find((entry) => entry.peerId === 'me')?.nickname).toBe('Leo')
    expect(broadcasts(result.effects)).toEqual([
      { type: 'NICKNAME_UPDATE', payload: { nickname: 'Leo' } }
    ])
  })

  it('QUALITY_UPDATE guarda a amostra por remetente com o instante de chegada', () => {
    const state = joinedState(
      'me',
      [member('owner', 1, true), member('me', 2), member('b', 3)],
      'owner',
      5
    )
    const result = reduce(state, {
      kind: 'MESSAGE',
      from: 'b',
      now: 7_777,
      message: {
        type: 'QUALITY_UPDATE',
        payload: { level: 'bad', rttMs: 480, inboundBitrateKbps: 300 }
      }
    })
    expect(result.state.quality['b']).toEqual({
      level: 'bad',
      rttMs: 480,
      inboundBitrateKbps: 300,
      receivedAt: 7_777
    })
  })

  it('WATCHING_UPDATE alimenta o indicador quem-assiste-o-que (RF-37)', () => {
    const state = joinedState(
      'me',
      [member('owner', 1, true), member('me', 2), member('b', 3)],
      'owner',
      5
    )
    const result = reduce(state, {
      kind: 'MESSAGE',
      from: 'b',
      now: 1,
      message: { type: 'WATCHING_UPDATE', payload: { watchingTxId: 't9' } }
    })
    expect(result.state.watching['b']).toBe('t9')
  })
})

describe('room-state / viewersOf (contagem de espectadores, RF-11)', () => {
  const roster = [member('owner', 1, true), member('me', 2), member('b', 3), member('c', 4)]

  it('devolve 0 quando ninguem esta assistindo', () => {
    const state = joinedState('me', roster, 'owner', 5)
    expect(viewersOf(state, 't1')).toBe(0)
  })

  it('conta apenas quem assiste o txId pedido e ignora os nulls', () => {
    const state = reduceAll(joinedState('me', roster, 'owner', 5), [
      {
        kind: 'MESSAGE',
        from: 'b',
        now: 1,
        message: { type: 'WATCHING_UPDATE', payload: { watchingTxId: 't1' } }
      },
      {
        kind: 'MESSAGE',
        from: 'c',
        now: 2,
        message: { type: 'WATCHING_UPDATE', payload: { watchingTxId: 't2' } }
      },
      {
        kind: 'MESSAGE',
        from: 'owner',
        now: 3,
        message: { type: 'WATCHING_UPDATE', payload: { watchingTxId: null } }
      }
    ]).state

    expect(viewersOf(state, 't1')).toBe(1)
    expect(viewersOf(state, 't2')).toBe(1)
    expect(viewersOf(state, 't3')).toBe(0)
  })

  it('sobe e desce conforme os WATCHING_UPDATE chegam', () => {
    let state = joinedState('me', roster, 'owner', 5)
    state = reduceAll(state, [
      {
        kind: 'MESSAGE',
        from: 'b',
        now: 1,
        message: { type: 'WATCHING_UPDATE', payload: { watchingTxId: 't1' } }
      },
      {
        kind: 'MESSAGE',
        from: 'c',
        now: 2,
        message: { type: 'WATCHING_UPDATE', payload: { watchingTxId: 't1' } }
      }
    ]).state
    expect(viewersOf(state, 't1')).toBe(2)

    state = reduce(state, {
      kind: 'MESSAGE',
      from: 'c',
      now: 3,
      message: { type: 'WATCHING_UPDATE', payload: { watchingTxId: null } }
    }).state
    expect(viewersOf(state, 't1')).toBe(1)
  })

  it('espectador que SAI da sala para de contar na hora', () => {
    // A contagem do card e o unico numero que o transmissor ve sobre quem esta
    // do outro lado: deixar um fantasma la seria mentira silenciosa.
    // Do ponto de vista do DONO, que e quem aplica a saida no roster (o membro
    // comum so atualiza quando o ROSTER_UPDATE do dono chega).
    let state = reduceAll(ownerState(roster, 5), [
      {
        kind: 'MESSAGE',
        from: 'b',
        now: 1,
        message: { type: 'WATCHING_UPDATE', payload: { watchingTxId: 't1' } }
      },
      {
        kind: 'MESSAGE',
        from: 'c',
        now: 2,
        message: { type: 'WATCHING_UPDATE', payload: { watchingTxId: 't1' } }
      }
    ]).state
    expect(viewersOf(state, 't1')).toBe(2)

    state = reduce(state, {
      kind: 'MESSAGE',
      from: 'c',
      now: 3,
      message: { type: 'LEAVE', payload: {} }
    }).state

    expect(viewersOf(state, 't1')).toBe(1)
  })
})

// --- sequencias ------------------------------------------------------------

describe('room-state / sequencias completas', () => {
  it('entrada, transmissao, kick e saida em cadeia mantem o estado coerente', () => {
    const state = ownerState([member('owner', 1, true)], 4)
    const novo = member('novo', 900)
    const events: RoomEvent[] = [
      {
        kind: 'OWNER_ADMIT',
        member: novo,
        members: [member('owner', 1, true), novo],
        rosterVersion: 5,
        now: 900
      },
      {
        kind: 'MESSAGE',
        from: 'novo',
        now: 950,
        message: { type: 'HELLO', payload: { nickname: 'novo', joinedAt: 900 } }
      },
      {
        kind: 'MESSAGE',
        from: 'novo',
        now: 1_000,
        message: {
          type: 'TX_START',
          payload: {
            txId: 'tx-1',
            presetId: 'p1080_30',
            hasAudio: true,
            sourceKind: 'screen',
            sourceLabel: 'Tela 1',
            startedAt: 1_000
          }
        }
      },
      { kind: 'OWNER_REMOVE', peerId: 'novo', mode: 'kick', now: 2_000 }
    ]
    const result = reduceAll(state, events)
    expect(result.state.members.map((entry) => entry.peerId)).toEqual(['owner'])
    expect(result.state.transmissions).toEqual({})
    expect(result.state.rosterVersion).toBe(6)
    expect(sounds(result.effects)).toEqual(['entered', 'transmitting', 'left'])
  })
})

// --- video-codec-upgrade: anuncio de decodificacao e idempotencia do TX_START

describe('room-state / capacidade de decodificacao anunciada pela sala', () => {
  function roomOfThree(): RoomState {
    return joinedState(
      'me',
      [member('owner', 1, true), member('me', 2), member('outro', 3)],
      'owner'
    )
  }

  function qualityFrom(from: string, decodes?: string[]): RoomEvent {
    return {
      kind: 'MESSAGE',
      from,
      now: 5_000,
      message: {
        type: 'QUALITY_UPDATE',
        payload: {
          level: 'good',
          rttMs: 30,
          inboundBitrateKbps: 900,
          ...(decodes ? { decodes } : {})
        }
      }
    }
  }

  it('QUALITY_UPDATE COM decodes grava a lista normalizada', () => {
    const result = reduce(roomOfThree(), qualityFrom('owner', ['VP8', 'AV1', 'H265']))
    expect(result.state.decodeCapabilities).toEqual({ owner: ['AV1', 'VP8'] })
    // O agregado de qualidade continua sendo gravado como antes.
    expect(result.state.quality['owner']?.level).toBe('good')
  })

  it('QUALITY_UPDATE SEM decodes (versao antiga) NAO cria entrada nenhuma', () => {
    const result = reduce(roomOfThree(), qualityFrom('owner'))
    expect(result.state.decodeCapabilities).toEqual({})
  })

  it('o ultimo anuncio do par vence', () => {
    const first = reduce(roomOfThree(), qualityFrom('owner', ['AV1', 'VP8']))
    const second = reduce(first.state, qualityFrom('owner', ['VP8']))
    expect(second.state.decodeCapabilities).toEqual({ owner: ['VP8'] })
  })

  it('QUALITY_UPDATE de quem NAO esta no roster nao grava capacidade', () => {
    const result = reduce(roomOfThree(), qualityFrom('intruso', ['AV1', 'VP8']))
    expect(result.state.decodeCapabilities).toEqual({})
  })

  it('a poda por ROSTER_UPDATE remove a capacidade de quem saiu', () => {
    const announced = reduce(roomOfThree(), qualityFrom('outro', ['AV1', 'VP8'])).state
    expect(announced.decodeCapabilities['outro']).toBeDefined()
    const pruned = reduce(announced, {
      kind: 'MESSAGE',
      from: 'owner',
      now: 6_000,
      message: {
        type: 'ROSTER_UPDATE',
        payload: rosterUpdate({
          rosterVersion: 9,
          members: [member('owner', 1, true), member('me', 2)],
          lastChange: { kind: 'leave', targetPeerId: 'outro' }
        })
      }
    })
    expect(pruned.state.decodeCapabilities).toEqual({})
  })

  it('a poda por kick do dono remove a capacidade do removido', () => {
    const base = ownerState([member('owner', 1, true), member('novo', 2)])
    const announced = reduce(base, {
      kind: 'MESSAGE',
      from: 'novo',
      now: 5_000,
      message: {
        type: 'QUALITY_UPDATE',
        payload: { level: 'good', rttMs: 20, inboundBitrateKbps: 500, decodes: ['AV1', 'VP8'] }
      }
    }).state
    expect(announced.decodeCapabilities['novo']).toEqual(['AV1', 'VP8'])
    const kicked = reduce(announced, {
      kind: 'OWNER_REMOVE',
      peerId: 'novo',
      mode: 'kick',
      now: 6_000
    })
    expect(kicked.state.decodeCapabilities).toEqual({})
  })

  it('o dono que caiu perde a capacidade quando este cliente assume a sala', () => {
    const base = joinedState('me', [member('owner', 1, true), member('me', 2)], 'owner')
    const announced = reduce(base, qualityFrom('owner', ['AV1', 'VP8'])).state
    expect(announced.decodeCapabilities['owner']).toEqual(['AV1', 'VP8'])
    const elected = reduce(announced, {
      kind: 'PEER_LINK_RECONNECT_TIMEOUT',
      peerId: 'owner',
      now: 60_000
    })
    expect(elected.state.ownerPeerId).toBe('me')
    expect(elected.state.decodeCapabilities['owner']).toBeUndefined()
  })

  it('applyLocalQuality leva os decodes locais no broadcast', () => {
    const result = reduce(roomOfThree(), {
      kind: 'LOCAL_QUALITY',
      level: 'good',
      rttMs: 25,
      inboundBitrateKbps: 800,
      decodes: ['AV1', 'VP9', 'H264', 'VP8'],
      now: 5_000
    })
    expect(broadcasts(result.effects)).toEqual([
      {
        type: 'QUALITY_UPDATE',
        payload: {
          level: 'good',
          rttMs: 25,
          inboundBitrateKbps: 800,
          decodes: ['AV1', 'VP9', 'H264', 'VP8']
        }
      }
    ])
  })

  it('estado inicial nasce sem nenhuma capacidade conhecida', () => {
    expect(createInitialState().decodeCapabilities).toEqual({})
  })
})

describe('room-state / TX_START idempotente (reanuncio de codec)', () => {
  const base = (): RoomState =>
    joinedState('me', [member('owner', 1, true), member('me', 2), member('outro', 3)], 'owner')

  function txStart(from: string, txId: string, videoCodec?: string, now = 1_000): RoomEvent {
    return {
      kind: 'MESSAGE',
      from,
      now,
      message: {
        type: 'TX_START',
        payload: {
          txId,
          presetId: 'p1080_30',
          hasAudio: true,
          sourceKind: 'screen',
          sourceLabel: 'Tela 1',
          startedAt: now,
          ...(videoCodec ? { videoCodec } : {})
        }
      }
    }
  }

  it('TX_START novo grava o codec anunciado e toca som + toast', () => {
    const result = reduce(base(), txStart('owner', 'tx1', 'AV1'))
    expect(result.state.transmissions['tx1']?.videoCodec).toBe('AV1')
    expect(sounds(result.effects)).toEqual(['transmitting'])
    expect(kinds(result.effects)).toContain('showToast')
  })

  it('TX_START sem videoCodec (versao antiga) grava null', () => {
    const result = reduce(base(), txStart('owner', 'tx1'))
    expect(result.state.transmissions['tx1']?.videoCodec).toBeNull()
  })

  it('TX_START com codec DESCONHECIDO grava null em vez de sujar o estado', () => {
    const result = reduce(base(), txStart('owner', 'tx1', 'H265'))
    expect(result.state.transmissions['tx1']?.videoCodec).toBeNull()
  })

  it('reanuncio do MESMO remetente com o MESMO txId atualiza sem som nem toast', () => {
    const first = reduce(base(), txStart('owner', 'tx1', 'AV1', 1_000)).state
    const again = reduce(first, txStart('owner', 'tx1', 'VP8', 9_000))

    expect(again.state.transmissions['tx1']?.videoCodec).toBe('VP8')
    // O que NAO pode mudar no reanuncio:
    expect(again.state.transmissions['tx1']?.startedAt).toBe(1_000)
    expect(again.state.transmissions['tx1']?.status).toBe('live')
    expect(again.effects).toEqual([])
  })

  it('reanuncio nao mexe no que este cliente esta assistindo', () => {
    const first = reduce(base(), txStart('owner', 'tx1', 'AV1')).state
    const watching = reduce(first, { kind: 'LOCAL_WATCHING', txId: 'tx1', now: 2_000 }).state
    const again = reduce(watching, txStart('owner', 'tx1', 'VP8', 9_000))
    expect(again.state.selfWatchingTxId).toBe('tx1')
  })

  it('txId NOVO do mesmo remetente continua sendo transmissao nova (som + toast)', () => {
    const first = reduce(base(), txStart('owner', 'tx1', 'AV1')).state
    const second = reduce(first, txStart('owner', 'tx2', 'AV1', 9_000))
    expect(sounds(second.effects)).toEqual(['transmitting'])
    expect(second.state.transmissions['tx1']).toBeUndefined()
    expect(second.state.transmissions['tx2']?.videoCodec).toBe('AV1')
  })

  it('txId conhecido vindo de OUTRO peer NAO vira atualizacao silenciosa', () => {
    const first = reduce(base(), txStart('owner', 'tx1', 'AV1')).state
    const forged = reduce(first, txStart('outro', 'tx1', 'VP8', 9_000))
    // Transmissao de outro dono: caminho normal, com som, e nao atualizacao.
    expect(forged.state.transmissions['tx1']?.peerId).toBe('outro')
    expect(sounds(forged.effects)).toEqual(['transmitting'])
  })
})
