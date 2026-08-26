// Sondagem de capacidade por maquina. O caso mais importante do arquivo e o
// primeiro: quem SO ASSISTE precisa anunciar o que decodifica sem nunca ter
// transmitido, senao a sala inteira degenera para VP8 no cenario primario
// (1 transmissor + N espectadores).
//
// O modulo guarda estado de sessao (sondas cacheadas), entao cada caso importa
// uma COPIA nova dele via `vi.resetModules()`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as CodecCapabilitiesModule from '@renderer/services/codec-capabilities'

interface ProbeCounters {
  decoding: number
  encoding: number
}

type CodecCapabilities = typeof CodecCapabilitiesModule

/**
 * Instala `RTCRtpSender.getCapabilities` e `navigator.mediaCapabilities` falsos.
 * `approve` decide o veredito por codec, imitando a resposta do Chromium.
 */
function stubPlatform(options: {
  codecs?: string[]
  decode?: (contentType: string) => { supported: boolean; smooth: boolean; powerEfficient: boolean }
  encode?: (contentType: string) => { supported: boolean; smooth: boolean; powerEfficient: boolean }
  noMediaCapabilities?: boolean
  decodingRejects?: boolean
}): ProbeCounters {
  const counters: ProbeCounters = { decoding: 0, encoding: 0 }
  const codecs = options.codecs ?? ['video/AV1', 'video/VP9', 'video/H264', 'video/VP8']

  vi.stubGlobal('RTCRtpSender', {
    getCapabilities: () => ({ codecs: codecs.map((mimeType) => ({ mimeType })) })
  })

  const mediaCapabilities = {
    decodingInfo: async (config: { video: { contentType: string } }) => {
      counters.decoding += 1
      if (options.decodingRejects) throw new Error('sonda indisponivel')
      return (
        options.decode?.(config.video.contentType) ?? {
          supported: true,
          smooth: true,
          powerEfficient: false
        }
      )
    },
    encodingInfo: async (config: { video: { contentType: string } }) => {
      counters.encoding += 1
      return (
        options.encode?.(config.video.contentType) ?? {
          supported: true,
          smooth: true,
          powerEfficient: false
        }
      )
    }
  }

  vi.stubGlobal('navigator', options.noMediaCapabilities ? {} : { mediaCapabilities })
  return counters
}

async function freshModule(): Promise<CodecCapabilities> {
  vi.resetModules()
  return import('@renderer/services/codec-capabilities')
}

describe('codec-capabilities', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('a sonda de DECODIFICACAO popula a lista sem sondar codificacao nenhuma', async () => {
    const counters = stubPlatform({
      decode: (contentType) => ({
        supported: true,
        smooth: !contentType.includes('H264'),
        powerEfficient: false
      })
    })
    const module = await freshModule()

    await module.ensureDecodeProbe()

    // AV1, VP9 e VP8 passaram; H264 nao veio "smooth" e ficou de fora.
    expect(module.getLocalDecodeCodecs()).toEqual(['AV1', 'VP9', 'VP8'])
    expect(counters.decoding).toBe(4)
    // Prova de que quem so assiste nao precisa da sonda de codificacao.
    expect(counters.encoding).toBe(0)
    expect(module.getEncodeCandidates()).toEqual(['VP8'])
  })

  it('antes de qualquer sonda a maquina anuncia so VP8', async () => {
    stubPlatform({})
    const module = await freshModule()
    expect(module.getLocalDecodeCodecs()).toEqual(['VP8'])
    expect(module.getEncodeCandidates()).toEqual(['VP8'])
  })

  it('a sonda de CODIFICACAO so aceita quem tem encoder de hardware', async () => {
    stubPlatform({
      encode: (contentType) => ({
        supported: true,
        smooth: true,
        // So o H264 tem aceleracao nesta maquina imaginaria.
        powerEfficient: contentType.includes('H264')
      })
    })
    const module = await freshModule()

    await module.ensureEncodeProbe('p1080_30')

    expect(module.getEncodeCandidates()).toEqual(['H264', 'VP8'])
  })

  it('a sonda de codificacao e cacheada POR PRESET', async () => {
    const counters = stubPlatform({})
    const module = await freshModule()

    await module.ensureEncodeProbe('p720_30')
    await module.ensureEncodeProbe('p720_30')
    expect(counters.encoding).toBe(4)

    await module.ensureEncodeProbe('p1080_60')
    expect(counters.encoding).toBe(8)
  })

  it('ensureDecodeProbe chamado duas vezes sonda uma vez so', async () => {
    const counters = stubPlatform({})
    const module = await freshModule()

    await Promise.all([module.ensureDecodeProbe(), module.ensureDecodeProbe()])
    await module.ensureDecodeProbe()

    expect(counters.decoding).toBe(4)
  })

  it('com o escape ligado tudo vira VP8, mesmo com a sonda aprovando AV1', async () => {
    stubPlatform({
      decode: () => ({ supported: true, smooth: true, powerEfficient: true }),
      encode: () => ({ supported: true, smooth: true, powerEfficient: true })
    })
    const module = await freshModule()
    await module.ensureDecodeProbe()
    await module.ensureEncodeProbe('p1080_30')
    expect(module.getLocalDecodeCodecs()).toContain('AV1')

    module.setForceVp8(true)
    expect(module.isForceVp8()).toBe(true)
    expect(module.getLocalDecodeCodecs()).toEqual(['VP8'])
    expect(module.getEncodeCandidates()).toEqual(['VP8'])

    // Desligar devolve a lista real: o escape nao apaga a sondagem.
    module.setForceVp8(false)
    expect(module.getLocalDecodeCodecs()).toContain('AV1')
  })

  it('subscribeForceVp8 avisa so quando o valor MUDA', async () => {
    stubPlatform({})
    const module = await freshModule()
    const seen: boolean[] = []
    const off = module.subscribeForceVp8((value) => seen.push(value))

    module.setForceVp8(true)
    module.setForceVp8(true)
    module.setForceVp8(false)
    off()
    module.setForceVp8(true)

    expect(seen).toEqual([true, false])
  })

  it('sem navigator.mediaCapabilities a sonda degrada para VP8 sem lancar', async () => {
    stubPlatform({ noMediaCapabilities: true })
    const module = await freshModule()

    await expect(module.ensureDecodeProbe()).resolves.toBeUndefined()
    await expect(module.ensureEncodeProbe('p720_30')).resolves.toBeUndefined()
    expect(module.getLocalDecodeCodecs()).toEqual(['VP8'])
    expect(module.getEncodeCandidates()).toEqual(['VP8'])
  })

  it('decodingInfo que rejeita nao derruba a sonda: o codec so fica de fora', async () => {
    stubPlatform({ decodingRejects: true })
    const module = await freshModule()

    await expect(module.ensureDecodeProbe()).resolves.toBeUndefined()
    expect(module.getLocalDecodeCodecs()).toEqual(['VP8'])
  })

  it('describeCodecProbe expoe o instantaneo para o __zoiDebug', async () => {
    stubPlatform({
      decode: () => ({ supported: true, smooth: true, powerEfficient: true })
    })
    const module = await freshModule()
    await module.ensureDecodeProbe()

    const snapshot = module.describeCodecProbe()
    expect(snapshot['decodeProbed']).toBe(true)
    expect(snapshot['decodeCodecs']).toEqual(['AV1', 'VP9', 'H264', 'VP8'])
    expect(snapshot['encodeProbedPresets']).toEqual([])
  })
})
