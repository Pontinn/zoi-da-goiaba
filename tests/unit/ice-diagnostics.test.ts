// Leitura do getStats: e ela que responde a pergunta do bug de campo ("por que
// so as conexoes iniciadas por aquela maquina falham?"), dizendo por qual TIPO
// de candidato (host/srflx/prflx/relay) cada lado fechou a conexao.
import { describe, expect, it } from 'vitest'
import {
  describeSelectedPair,
  findSelectedPair,
  summarizeCandidateTypes,
  summarizeSelectedPair,
  toStatsMap,
  type IceStatsEntry,
  type IceStatsMap
} from '@renderer/services/ice-diagnostics'

function statsOf(entries: Record<string, IceStatsEntry>): IceStatsMap {
  return new Map(Object.entries(entries))
}

const CONNECTED = statsOf({
  T1: { type: 'transport', selectedCandidatePairId: 'P2' },
  P1: { type: 'candidate-pair', state: 'failed', localCandidateId: 'L1', remoteCandidateId: 'R1' },
  P2: {
    type: 'candidate-pair',
    state: 'succeeded',
    nominated: true,
    localCandidateId: 'L2',
    remoteCandidateId: 'R2',
    bytesReceived: 4_096,
    currentRoundTripTime: 0.042
  },
  L1: { type: 'local-candidate', candidateType: 'host', protocol: 'udp' },
  R1: { type: 'remote-candidate', candidateType: 'host', protocol: 'udp' },
  L2: { type: 'local-candidate', candidateType: 'srflx', protocol: 'udp', networkType: 'wifi' },
  R2: { type: 'remote-candidate', candidateType: 'prflx', protocol: 'udp' }
})

describe('ice-diagnostics / par de candidatos selecionado', () => {
  it('prefere o par apontado por transport.selectedCandidatePairId', () => {
    const pair = findSelectedPair(CONNECTED)
    expect(pair?.localCandidateId).toBe('L2')
  })

  it('descreve os tipos dos dois lados, o rtt e os bytes recebidos', () => {
    const summary = summarizeSelectedPair(CONNECTED)
    expect(summary?.local).toEqual({ type: 'srflx', protocol: 'udp', networkType: 'wifi' })
    expect(summary?.remote).toEqual({ type: 'prflx', protocol: 'udp', networkType: null })
    expect(summary?.roundTripTimeMs).toBe(42)
    expect(summary && describeSelectedPair(summary)).toBe(
      'local=srflx/udp (wifi) remoto=prflx/udp estado=succeeded rtt=42ms bytesRecebidos=4096'
    )
  })

  it('sem transport, cai para o par nominado e bem-sucedido', () => {
    const stats = statsOf({
      P1: { type: 'candidate-pair', state: 'in-progress', localCandidateId: 'L1' },
      P2: {
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        localCandidateId: 'L2',
        remoteCandidateId: 'R2'
      },
      L2: { type: 'local-candidate', candidateType: 'relay', relayProtocol: 'tcp' },
      R2: { type: 'remote-candidate', candidateType: 'srflx', protocol: 'udp' }
    })
    const summary = summarizeSelectedPair(stats)
    // Relay declara o protocolo do proprio relay, nao o do candidato.
    expect(summary?.local?.protocol).toBe('tcp')
    expect(summary?.remote?.type).toBe('srflx')
  })

  it('sem nenhum par formado devolve null (o caso da conexao que nunca fecha)', () => {
    const stats = statsOf({
      P1: { type: 'candidate-pair', state: 'in-progress' },
      L1: { type: 'local-candidate', candidateType: 'host', protocol: 'udp' }
    })
    expect(findSelectedPair(stats)).toBeNull()
    expect(summarizeSelectedPair(stats)).toBeNull()
  })
})

describe('ice-diagnostics / candidatos coletados', () => {
  it('lista os tipos locais e remotos sem repetir', () => {
    const stats = statsOf({
      L1: { type: 'local-candidate', candidateType: 'host', protocol: 'udp' },
      L2: { type: 'local-candidate', candidateType: 'host', protocol: 'udp' },
      L3: { type: 'local-candidate', candidateType: 'srflx', protocol: 'udp' },
      R1: { type: 'remote-candidate', candidateType: 'host', protocol: 'tcp' },
      X1: { type: 'inbound-rtp' }
    })
    expect(summarizeCandidateTypes(stats)).toEqual({
      local: ['host/udp', 'srflx/udp'],
      remote: ['host/tcp']
    })
  })

  it('lado que nao coletou nada aparece como lista vazia', () => {
    const stats = statsOf({ L1: { type: 'local-candidate', candidateType: 'host' } })
    expect(summarizeCandidateTypes(stats)).toEqual({ local: ['host/desconhecido'], remote: [] })
  })
})

describe('ice-diagnostics / conversao do RTCStatsReport', () => {
  it('aceita qualquer objeto com forEach no formato do report', () => {
    const source = new Map<string, IceStatsEntry>([['P1', { type: 'candidate-pair' }]])
    const converted = toStatsMap(source as unknown as RTCStatsReport)
    expect(converted.get('P1')?.type).toBe('candidate-pair')
  })
})
