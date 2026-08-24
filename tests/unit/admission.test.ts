import { describe, expect, it } from 'vitest'
import { createEnvelope, PROTOCOL_VERSION, type RosterMember } from '@shared/protocol'
import { admit, type AdmissionContext } from '@renderer/core/admission'

function member(peerId: string, joinedAt: number, isOwner = false): RosterMember {
  return {
    peerId,
    installId: `install-${peerId}`,
    nickname: peerId,
    joinedAt,
    isOwner
  }
}

function context(overrides: Partial<AdmissionContext> = {}): AdmissionContext {
  return {
    roomMeta: { code: 'sala-teste', limit: 3, createdAt: 1_000 },
    rosterVersion: 4,
    ownerPeerId: 'owner',
    members: [member('owner', 1_000, true)],
    banList: [],
    now: 5_000,
    ...overrides
  }
}

function joinRequest(overrides: Partial<{ nickname: string; memberPeerId: string; installId: string }> = {}) {
  return createEnvelope(
    'JOIN_REQUEST',
    {
      nickname: 'Pontin',
      memberPeerId: 'peer-new',
      installId: 'install-new',
      ...overrides
    },
    'peer-new',
    4_000
  )
}

describe('admission / caminho feliz (RF-06)', () => {
  it('aceita e devolve o snapshot do roster ja com o novo membro', () => {
    const decision = admit(joinRequest(), context())
    expect('accept' in decision).toBe(true)
    if (!('accept' in decision)) return
    expect(decision.accept.rosterVersion).toBe(5)
    expect(decision.accept.ownerPeerId).toBe('owner')
    expect(decision.accept.members.map((entry) => entry.peerId)).toEqual(['owner', 'peer-new'])
    expect(decision.member).toMatchObject({
      peerId: 'peer-new',
      installId: 'install-new',
      nickname: 'Pontin',
      joinedAt: 5_000,
      isOwner: false
    })
    expect(decision.accept.roomMeta.code).toBe('sala-teste')
  })

  it('aplica trim no nickname recebido', () => {
    const decision = admit(joinRequest({ nickname: '   Leo   ' }), context())
    expect('accept' in decision && decision.member.nickname).toBe('Leo')
  })
})

describe('admission / capacidade (RF-07)', () => {
  it('aceita enquanto ha vaga (o dono conta na capacidade)', () => {
    const ctx = context({ members: [member('owner', 1, true), member('b', 2)] })
    expect('accept' in admit(joinRequest(), ctx)).toBe(true)
  })

  it('rejeita room_full no limite exato', () => {
    const ctx = context({
      members: [member('owner', 1, true), member('b', 2), member('c', 3)]
    })
    expect(admit(joinRequest(), ctx)).toEqual({ reject: { reason: 'room_full' } })
  })

  it('reingresso do MESMO peerId nao consome vaga nova', () => {
    const ctx = context({
      members: [member('owner', 1, true), member('b', 2), member('peer-new', 3)]
    })
    const decision = admit(joinRequest(), ctx)
    expect('accept' in decision).toBe(true)
    if (!('accept' in decision)) return
    expect(decision.accept.members).toHaveLength(3)
    // joinedAt original preservado: a antiguidade na eleicao nao e resetada.
    expect(decision.member.joinedAt).toBe(3)
  })
})

describe('admission / ban list por installId (RF-08)', () => {
  it('rejeita banned mesmo com peerId novo', () => {
    const ctx = context({ banList: [{ installId: 'install-new', nickname: 'Pontin' }] })
    expect(admit(joinRequest({ memberPeerId: 'outro-peer' }), ctx)).toEqual({
      reject: { reason: 'banned' }
    })
  })

  it('comparacao de installId e exata (case-sensitive)', () => {
    const ctx = context({ banList: [{ installId: 'INSTALL-NEW', nickname: 'Pontin' }] })
    expect('accept' in admit(joinRequest(), ctx)).toBe(true)
  })

  it('quem so levou kick (nao esta na ban list) entra de volta (RF-32)', () => {
    const ctx = context({ banList: [{ installId: 'install-outro', nickname: 'Outro' }] })
    expect('accept' in admit(joinRequest(), ctx)).toBe(true)
  })
})

describe('admission / rejeicoes de protocolo', () => {
  it('rejeita version_mismatch', () => {
    const raw = { ...joinRequest(), v: PROTOCOL_VERSION + 1 }
    expect(admit(raw, context())).toEqual({ reject: { reason: 'version_mismatch' } })
  })

  it('rejeita payload invalido', () => {
    const raw = { ...joinRequest(), payload: { nickname: 'x' } }
    expect(admit(raw, context())).toEqual({ reject: { reason: 'invalid_payload' } })
  })

  it('rejeita nickname vazio', () => {
    expect(admit(joinRequest({ nickname: '   ' }), context())).toEqual({
      reject: { reason: 'invalid_payload' }
    })
  })

  it('rejeita qualquer outro type no door', () => {
    const raw = createEnvelope('HELLO', { nickname: 'x', joinedAt: 1 }, 'peer-new', 1)
    expect(admit(raw, context())).toEqual({ reject: { reason: 'invalid_payload' } })
  })

  it('rejeita entradas nao-objeto', () => {
    expect(admit(null, context())).toEqual({ reject: { reason: 'invalid_payload' } })
    expect(admit('JOIN_REQUEST', context())).toEqual({ reject: { reason: 'invalid_payload' } })
    expect(admit([], context())).toEqual({ reject: { reason: 'invalid_payload' } })
  })

  it('banimento tem precedencia sobre sala cheia', () => {
    const ctx = context({
      members: [member('owner', 1, true), member('b', 2), member('c', 3)],
      banList: [{ installId: 'install-new', nickname: 'Pontin' }]
    })
    expect(admit(joinRequest(), ctx)).toEqual({ reject: { reason: 'banned' } })
  })
})
