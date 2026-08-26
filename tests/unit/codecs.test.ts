// Modulo puro de codec (@shared/codecs): escolha do codec da sala, rebaixamento
// e reordenacao de payload types na SDP. Aqui mora a regra que decide a
// qualidade da imagem de todo mundo, entao cada caso precisa DISCRIMINAR: falhar
// se a regra for invertida.
import { describe, expect, it } from 'vitest'
import {
  CODEC_RTPMAP_NAMES,
  isVideoCodecId,
  nextLowerCodec,
  normalizeDecodeAnnouncement,
  normalizeForceVp8,
  pickRoomCodec,
  preferVideoCodec,
  VIDEO_CODEC_PRIORITY,
  type VideoCodecId
} from '@shared/codecs'

/** Recorte realista de uma oferta do Chromium: video com 4 codecs + rtx. */
const OFFER_SDP = [
  'v=0',
  'o=- 1 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111 63',
  'a=rtpmap:111 opus/48000/2',
  'a=rtpmap:63 red/48000/2',
  'm=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 45 46',
  'a=rtpmap:96 VP8/90000',
  'a=rtpmap:97 rtx/90000',
  'a=rtpmap:98 VP9/90000',
  'a=rtpmap:99 rtx/90000',
  'a=rtpmap:100 H264/90000',
  'a=rtpmap:101 rtx/90000',
  'a=rtpmap:45 AV1/90000',
  'a=rtpmap:46 rtx/90000'
].join('\r\n')

function videoPayloads(sdp: string): string[] {
  const line = sdp.split(/\r\n|\n/).find((entry) => entry.startsWith('m=video '))
  return (line ?? '').split(' ').slice(3)
}

function audioLine(sdp: string): string {
  return sdp.split(/\r\n|\n/).find((entry) => entry.startsWith('m=audio ')) ?? ''
}

describe('codecs / preferVideoCodec', () => {
  it('poe os PT do codec pedido na FRENTE preservando a ordem relativa', () => {
    expect(videoPayloads(preferVideoCodec(OFFER_SDP, 'AV1'))).toEqual([
      '45',
      '96',
      '97',
      '98',
      '99',
      '100',
      '101',
      '46'
    ])
    expect(videoPayloads(preferVideoCodec(OFFER_SDP, 'VP9'))[0]).toBe('98')
    expect(videoPayloads(preferVideoCodec(OFFER_SDP, 'H264'))[0]).toBe('100')
  })

  it('NUNCA remove um payload type', () => {
    const before = [...videoPayloads(OFFER_SDP)].sort()
    for (const codec of VIDEO_CODEC_PRIORITY) {
      expect([...videoPayloads(preferVideoCodec(OFFER_SDP, codec))].sort()).toEqual(before)
    }
  })

  it('nao corrompe a secao de audio', () => {
    expect(audioLine(preferVideoCodec(OFFER_SDP, 'AV1'))).toBe(audioLine(OFFER_SDP))
  })

  it('devolve o SDP original quando nao ha o que reordenar', () => {
    // Sem secao de video (oferta so de audio).
    const audioOnly = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2'
    expect(preferVideoCodec(audioOnly, 'AV1')).toBe(audioOnly)

    // O codec pedido nao tem PT nenhum na oferta.
    const semAv1 = 'm=video 9 x 96 98\r\na=rtpmap:96 VP8/90000\r\na=rtpmap:98 VP9/90000'
    expect(preferVideoCodec(semAv1, 'AV1')).toBe(semAv1)

    // Todos os PT ja sao do codec pedido: nada a mover.
    const soVp8 = 'm=video 9 x 96\r\na=rtpmap:96 VP8/90000'
    expect(preferVideoCodec(soVp8, 'VP8')).toBe(soVp8)
  })

  it('sobrevive a entrada lixo sem lancar', () => {
    expect(preferVideoCodec('', 'AV1')).toBe('')
    expect(preferVideoCodec('m=video', 'AV1')).toBe('m=video')
    expect(preferVideoCodec('m=video 9 x', 'VP8')).toBe('m=video 9 x')
  })

  it('so reescreve a PRIMEIRA secao m=video e para na proxima m=', () => {
    const duas = [
      'm=video 9 x 96 45',
      'a=rtpmap:96 VP8/90000',
      'a=rtpmap:45 AV1/90000',
      'm=application 9 DTLS/SCTP',
      'a=rtpmap:45 AV1/90000'
    ].join('\r\n')
    const result = preferVideoCodec(duas, 'AV1')
    expect(videoPayloads(result)).toEqual(['45', '96'])
    expect(result.split('\r\n')).toHaveLength(5)
  })

  it('reconhece o nome antigo AV1X do rtpmap', () => {
    const antigo = 'm=video 9 x 96 45\r\na=rtpmap:96 VP8/90000\r\na=rtpmap:45 AV1X/90000'
    expect(videoPayloads(preferVideoCodec(antigo, 'AV1'))[0]).toBe('45')
    expect(CODEC_RTPMAP_NAMES.AV1).toContain('AV1X')
  })

  it('normaliza a quebra de linha para CRLF sem perder linhas', () => {
    const lf = OFFER_SDP.split('\r\n').join('\n')
    const result = preferVideoCodec(lf, 'AV1')
    expect(result.split('\r\n')).toHaveLength(OFFER_SDP.split('\r\n').length)
    expect(videoPayloads(result)[0]).toBe('45')
  })
})

describe('codecs / pickRoomCodec', () => {
  it('AC-05: espectador que so decodifica H264 derruba a sala para H264', () => {
    expect(
      pickRoomCodec(
        ['AV1', 'VP9', 'H264', 'VP8'],
        [
          ['AV1', 'VP9', 'H264', 'VP8'],
          ['H264', 'VP8']
        ]
      )
    ).toBe('H264')
  })

  it('AC-04: so o que a MAQUINA codifica entra na conta', () => {
    expect(pickRoomCodec(['H264', 'VP8'], [['AV1', 'VP9', 'H264', 'VP8']])).toBe('H264')
  })

  it('sala sem outros membros vale so a capacidade local', () => {
    expect(pickRoomCodec(['AV1', 'VP8'], [])).toBe('AV1')
  })

  it('AC-06: membro tratado como VP8-only leva a sala para VP8', () => {
    expect(pickRoomCodec(['AV1', 'VP9', 'H264', 'VP8'], [['VP8']])).toBe('VP8')
  })

  it('sem nenhum encoder de hardware o resultado e VP8', () => {
    expect(pickRoomCodec(['VP8'], [['AV1', 'VP9', 'H264', 'VP8']])).toBe('VP8')
  })
})

describe('codecs / nextLowerCodec', () => {
  it('pula degrau que a maquina nao codifica', () => {
    expect(
      nextLowerCodec('AV1', ['AV1', 'H264', 'VP8'], [['AV1', 'VP9', 'H264', 'VP8']])
    ).toBe('H264')
  })

  it('pula degrau que algum membro nao decodifica', () => {
    expect(
      nextLowerCodec('AV1', ['AV1', 'VP9', 'H264', 'VP8'], [['AV1', 'VP8']])
    ).toBe('VP8')
  })

  it('VP8 nao tem degrau abaixo', () => {
    expect(nextLowerCodec('VP8', ['AV1', 'VP9', 'H264', 'VP8'], [])).toBeNull()
  })
})

describe('codecs / normalizacoes', () => {
  it('normalizeDecodeAnnouncement trata ausente, vazio, desconhecido e duplicado', () => {
    expect(normalizeDecodeAnnouncement(undefined)).toEqual(['VP8'])
    expect(normalizeDecodeAnnouncement([])).toEqual(['VP8'])
    expect(normalizeDecodeAnnouncement(['H265', 'AV2'])).toEqual(['VP8'])
    expect(normalizeDecodeAnnouncement(['VP8', 'AV1', 'AV1'])).toEqual(['AV1', 'VP8'])
    // A saida sai sempre na ordem da escada, nao na ordem anunciada.
    expect(normalizeDecodeAnnouncement(['VP8', 'H264', 'AV1'])).toEqual(['AV1', 'H264', 'VP8'])
  })

  it('normalizeDecodeAnnouncement corta anuncio gigante em 8 entradas', () => {
    const gigante = Array<string>(10_000).fill('AV1')
    const result = normalizeDecodeAnnouncement(gigante)
    expect(result.length).toBeLessThanOrEqual(8)
    expect(result).toEqual(['AV1', 'VP8'])
  })

  it('isVideoCodecId so aceita a escada conhecida', () => {
    const conhecidos: VideoCodecId[] = ['AV1', 'VP9', 'H264', 'VP8']
    for (const codec of conhecidos) expect(isVideoCodecId(codec)).toBe(true)
    expect(isVideoCodecId('H265')).toBe(false)
    expect(isVideoCodecId(42)).toBe(false)
    expect(isVideoCodecId(undefined)).toBe(false)
  })

  it('normalizeForceVp8 so liga com o booleano true', () => {
    expect(normalizeForceVp8(true)).toBe(true)
    expect(normalizeForceVp8('true')).toBe(false)
    expect(normalizeForceVp8(1)).toBe(false)
    expect(normalizeForceVp8(undefined)).toBe(false)
    expect(normalizeForceVp8(null)).toBe(false)
  })
})
