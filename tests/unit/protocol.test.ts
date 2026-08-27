import { describe, expect, it } from 'vitest'
import { PRESET_LIST } from '@shared/presets'
import {
  createEnvelope,
  isEnvelope,
  isQualityUpdatePayload,
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

  it('cobre todos os 17 tipos da secao 5.A', () => {
    expect(MESSAGE_TYPES).toHaveLength(17)
    expect(MESSAGE_TYPES).toContain('JOIN_REQUEST')
    expect(MESSAGE_TYPES).toContain('OWNER_TRANSFER')
    expect(MESSAGE_TYPES).toContain('QUALITY_UPDATE')
    expect(MESSAGE_TYPES).toContain('CURSOR_MOVE')
    expect(MESSAGE_TYPES).toContain('CURSOR_END')
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

  /*
   * Documenta a compatibilidade so-pra-frente dos presets: quem nao conhece o id
   * descarta o TX_START inteiro como `invalid_payload`. E o que um cliente antigo
   * faz ao receber `p1080_30_hq` / `p1080_60_hq`.
   */
  it('TX_START com preset desconhecido vira invalid_payload', () => {
    const raw = {
      v: 1,
      type: 'TX_START',
      from: 'p1',
      ts: 1,
      payload: {
        txId: 't1',
        presetId: 'p1080_30_hq_do_futuro',
        hasAudio: true,
        sourceKind: 'screen',
        sourceLabel: 'Tela 1',
        startedAt: 1
      }
    }
    expect(validateEnvelope(raw, 'p1')).toEqual({ ok: false, reason: 'invalid_payload' })
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

  it('isTxStartPayload aceita exatamente os presets do seletor', () => {
    const base = {
      txId: 't',
      hasAudio: true,
      sourceKind: 'screen',
      sourceLabel: 'Tela 1',
      startedAt: 1
    }
    for (const preset of PRESET_LIST) {
      expect(isTxStartPayload({ ...base, presetId: preset.id }), preset.id).toBe(true)
    }
    expect(isTxStartPayload({ ...base, presetId: 'p1440_144' })).toBe(false)
    // Um id "quase certo" tambem cai: a lista e fechada, nao um prefixo.
    expect(isTxStartPayload({ ...base, presetId: 'p1080_30_ultra' })).toBe(false)
  })

  it('presets de alta qualidade passam pela validacao do TX_START', () => {
    const base = {
      txId: 't',
      hasAudio: true,
      sourceKind: 'screen',
      sourceLabel: 'Tela 1',
      startedAt: 1
    }
    expect(isTxStartPayload({ ...base, presetId: 'p1080_30_hq' })).toBe(true)
    expect(isTxStartPayload({ ...base, presetId: 'p1080_60_hq' })).toBe(true)
  })
})

// --- campos aditivos da video-codec-upgrade (RNF-06/AC-24) ------------------
//
// Os dois campos novos sao OPCIONAIS e de tipo ABERTO. A regra que estes casos
// protegem: um valor DESCONHECIDO nunca pode invalidar a mensagem inteira, senao
// um cliente futuro cegaria este aqui (LESSONS 2026-08-25, preset novo).

describe('protocol / campos opcionais de codec', () => {
  const txStart = {
    txId: 't',
    presetId: 'p720_30',
    hasAudio: false,
    sourceKind: 'screen',
    sourceLabel: 'Tela 1',
    startedAt: 1
  }
  const quality = { level: 'good', rttMs: 30, inboundBitrateKbps: 1_000 }

  it('isTxStartPayload aceita SEM videoCodec (cliente antigo)', () => {
    expect(isTxStartPayload(txStart)).toBe(true)
  })

  it('isTxStartPayload aceita videoCodec conhecido E desconhecido', () => {
    expect(isTxStartPayload({ ...txStart, videoCodec: 'AV1' })).toBe(true)
    // Um cliente futuro pode anunciar um nome que este aqui nao conhece.
    expect(isTxStartPayload({ ...txStart, videoCodec: 'H265' })).toBe(true)
  })

  it('isTxStartPayload rejeita videoCodec que nao e string', () => {
    expect(isTxStartPayload({ ...txStart, videoCodec: 42 })).toBe(false)
    expect(isTxStartPayload({ ...txStart, videoCodec: ['AV1'] })).toBe(false)
  })

  it('isQualityUpdatePayload aceita SEM decodes (cliente antigo)', () => {
    expect(isQualityUpdatePayload(quality)).toBe(true)
    expect(isQualityUpdatePayload({ ...quality, inboundBitrateKbps: null })).toBe(true)
  })

  it('isQualityUpdatePayload aceita decodes com nomes desconhecidos', () => {
    expect(isQualityUpdatePayload({ ...quality, decodes: ['AV1', 'VP8'] })).toBe(true)
    expect(isQualityUpdatePayload({ ...quality, decodes: ['H265', 'AV2'] })).toBe(true)
    expect(isQualityUpdatePayload({ ...quality, decodes: [] })).toBe(true)
  })

  it('isQualityUpdatePayload rejeita decodes que nao e array de string', () => {
    expect(isQualityUpdatePayload({ ...quality, decodes: 'VP9' })).toBe(false)
    expect(isQualityUpdatePayload({ ...quality, decodes: ['VP9', 3] })).toBe(false)
    expect(isQualityUpdatePayload({ ...quality, decodes: { a: 1 } })).toBe(false)
  })

  it('nenhum enum fechado do protocolo mudou', () => {
    expect(MESSAGE_TYPES).toHaveLength(17)
    expect(MESSAGE_TYPES).not.toContain('CODEC_HELLO')
    expect(PROTOCOL_VERSION).toBe(1)
  })
})
