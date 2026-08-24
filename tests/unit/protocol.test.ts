import { describe, expect, it } from 'vitest'
import {
  createEnvelope,
  isEnvelope,
  isRosterMember,
  isRosterUpdatePayload,
  isTxStartPayload,
  MESSAGE_TYPES,
  PROTOCOL_VERSION,
  validateEnvelope
} from '@shared/protocol'

const member = {
  peerId: 'p1',
  installId: 'i1',
  nickname: 'Pontin',
  joinedAt: 10,
  isOwner: true
}

describe('protocol / envelope', () => {
  it('createEnvelope produz a casca da secao 5.A', () => {
    const envelope = createEnvelope('PING', { seq: 3 }, 'p1', 1234)
    expect(envelope).toEqual({
      v: PROTOCOL_VERSION,
      type: 'PING',
      from: 'p1',
      ts: 1234,
      payload: { seq: 3 }
    })
    expect(isEnvelope(envelope)).toBe(true)
  })

  it('isEnvelope rejeita cascas invalidas', () => {
    expect(isEnvelope(null)).toBe(false)
    expect(isEnvelope([])).toBe(false)
    expect(isEnvelope({ v: 2, type: 'PING', from: 'p', ts: 1, payload: {} })).toBe(false)
    expect(isEnvelope({ v: 1, type: 'NOPE', from: 'p', ts: 1, payload: {} })).toBe(false)
    expect(isEnvelope({ v: 1, type: 'PING', from: 1, ts: 1, payload: {} })).toBe(false)
    expect(isEnvelope({ v: 1, type: 'PING', from: 'p', ts: 'agora', payload: {} })).toBe(false)
    expect(isEnvelope({ v: 1, type: 'PING', from: 'p', ts: 1 })).toBe(false)
  })

  it('cobre todos os 15 tipos da secao 5.A', () => {
    expect(MESSAGE_TYPES).toHaveLength(15)
    expect(MESSAGE_TYPES).toContain('JOIN_REQUEST')
    expect(MESSAGE_TYPES).toContain('OWNER_TRANSFER')
    expect(MESSAGE_TYPES).toContain('QUALITY_UPDATE')
  })
})

describe('protocol / validateEnvelope (base da matriz 5c)', () => {
  it('aceita mensagem valida com from batendo com a conexao real', () => {
    const raw = createEnvelope('HELLO', { nickname: 'Leo', joinedAt: 5 }, 'p2', 99)
    const result = validateEnvelope(raw, 'p2')
    expect(result).toEqual({
      ok: true,
      message: { type: 'HELLO', payload: { nickname: 'Leo', joinedAt: 5 } },
      from: 'p2',
      ts: 99
    })
  })

  it('rejeita from divergente do peerId real da conexao', () => {
    const forged = createEnvelope('MOD_REMOVE', { mode: 'ban' }, 'dono-falsificado', 1)
    expect(validateEnvelope(forged, 'p9')).toEqual({ ok: false, reason: 'from_mismatch' })
  })

  it('rejeita versao diferente', () => {
    const raw = { ...createEnvelope('PING', { seq: 1 }, 'p1', 1), v: 2 }
    expect(validateEnvelope(raw, 'p1')).toEqual({ ok: false, reason: 'version_mismatch' })
  })

  it('rejeita type desconhecido', () => {
    const raw = { v: 1, type: 'HACK', from: 'p1', ts: 1, payload: {} }
    expect(validateEnvelope(raw, 'p1')).toEqual({ ok: false, reason: 'unknown_type' })
  })

  it('rejeita nao-objeto', () => {
    expect(validateEnvelope('texto', 'p1')).toEqual({ ok: false, reason: 'not_an_envelope' })
    expect(validateEnvelope(null, 'p1')).toEqual({ ok: false, reason: 'not_an_envelope' })
    expect(validateEnvelope([], 'p1')).toEqual({ ok: false, reason: 'not_an_envelope' })
  })

  it('rejeita payload malformado por tipo', () => {
    const cases: Array<[string, unknown]> = [
      ['TX_START', { txId: 'a', presetId: 'p4k_120', hasAudio: true, sourceKind: 'screen', sourceLabel: 'x', startedAt: 1 }],
      ['TX_STOP', { txId: 'a', reason: 'porque_sim' }],
      ['MOD_REMOVE', { mode: 'exile' }],
      ['QUALITY_UPDATE', { level: 'otimo', rttMs: 1, inboundBitrateKbps: null }],
      ['WATCHING_UPDATE', { watchingTxId: 42 }],
      ['OWNER_TRANSFER', { newOwnerPeerId: '', rosterVersion: 2 }],
      ['HELLO', { nickname: 'x' }],
      ['PING', { seq: 'um' }],
      ['JOIN_REQUEST', { nickname: 'x', memberPeerId: '', installId: 'i' }]
    ]
    for (const [type, payload] of cases) {
      const raw = { v: 1, type, from: 'p1', ts: 1, payload }
      expect(validateEnvelope(raw, 'p1')).toEqual({ ok: false, reason: 'invalid_payload' })
    }
  })

  it('aceita payloads validos de todos os tipos do mesh', () => {
    const valid: Array<[string, unknown]> = [
      ['HELLO', { nickname: 'a', joinedAt: 1 }],
      [
        'ROSTER_UPDATE',
        {
          rosterVersion: 2,
          ownerPeerId: 'p1',
          members: [member],
          banList: [{ installId: 'i9', nickname: 'x' }],
          lastChange: { kind: 'join', targetPeerId: 'p2' }
        }
      ],
      ['NICKNAME_UPDATE', { nickname: 'novo' }],
      [
        'TX_START',
        {
          txId: 't1',
          presetId: 'p1080_60',
          hasAudio: false,
          sourceKind: 'window',
          sourceLabel: 'VLC',
          startedAt: 7
        }
      ],
      ['TX_STOP', { txId: 't1', reason: 'source_switch' }],
      ['WATCHING_UPDATE', { watchingTxId: null }],
      ['QUALITY_UPDATE', { level: 'medium', rttMs: 120, inboundBitrateKbps: 900 }],
      ['MOD_REMOVE', { mode: 'kick' }],
      ['OWNER_TRANSFER', { newOwnerPeerId: 'p2', rosterVersion: 9 }],
      ['LEAVE', {}],
      ['PONG', { seq: 4 }]
    ]
    for (const [type, payload] of valid) {
      const raw = { v: 1, type, from: 'p1', ts: 1, payload }
      const result = validateEnvelope(raw, 'p1')
      expect(result.ok, `esperava aceitar ${type}`).toBe(true)
    }
  })
})

describe('protocol / type guards de entidades', () => {
  it('isRosterMember exige todos os campos', () => {
    expect(isRosterMember(member)).toBe(true)
    expect(isRosterMember({ ...member, peerId: '' })).toBe(false)
    expect(isRosterMember({ ...member, joinedAt: 'ontem' })).toBe(false)
    expect(isRosterMember({ ...member, isOwner: 'sim' })).toBe(false)
    expect(isRosterMember(undefined)).toBe(false)
  })

  it('isRosterUpdatePayload valida a lista inteira de membros', () => {
    const good = {
      rosterVersion: 1,
      ownerPeerId: 'p1',
      members: [member],
      banList: [],
      lastChange: { kind: 'timeout', targetPeerId: 'p2' }
    }
    expect(isRosterUpdatePayload(good)).toBe(true)
    expect(isRosterUpdatePayload({ ...good, members: [member, { peerId: 'x' }] })).toBe(false)
    expect(isRosterUpdatePayload({ ...good, lastChange: { kind: 'explode', targetPeerId: 'p' } })).toBe(
      false
    )
  })

  it('isTxStartPayload aceita apenas os 3 presets da SPEC', () => {
    const base = {
      txId: 't',
      hasAudio: true,
      sourceKind: 'screen',
      sourceLabel: 'Tela 1',
      startedAt: 1
    }
    expect(isTxStartPayload({ ...base, presetId: 'p720_30' })).toBe(true)
    expect(isTxStartPayload({ ...base, presetId: 'p1080_30' })).toBe(true)
    expect(isTxStartPayload({ ...base, presetId: 'p1080_60' })).toBe(true)
    expect(isTxStartPayload({ ...base, presetId: 'p1440_144' })).toBe(false)
  })
})
