// Sondagem de capacidade de codec desta MAQUINA. Duas sondas separadas de
// proposito:
//
// - DECODE (`ensureDecodeProbe`): roda UMA vez no boot, sem preset e sem
//   depender de transmitir. Quem so assiste PRECISA anunciar o que decodifica,
//   senao a sala inteira degenera para VP8 no cenario primario (1 transmissor +
//   N espectadores).
// - ENCODE (`ensureEncodeProbe`): roda quando a maquina vai transmitir, cacheada
//   POR PRESET, porque `encodingInfo` recebe largura/altura/fps/bitrate.
//
// Criterio da escada de codificacao: `powerEfficient === true`, ou seja, encoder
// de HARDWARE. Codec pesado por software e exatamente o que a feature nao pode
// adotar. Qualquer falha, excecao ou API ausente degrada para ['VP8']: nunca
// lanca, nunca bloqueia o boot, nada roda por quadro.
import {
  DECODE_PROBE_VIDEO,
  DEFAULT_FORCE_VP8,
  VIDEO_CODEC_PRIORITY,
  type VideoCodecId
} from '@shared/codecs'
import { PRESETS } from '@shared/presets'
import type { PresetId } from '@shared/protocol'

/** `mimeType` de `getCapabilities` -> codec da escada. O resto (rtx, red, ulpfec) e ignorado. */
const MIME_TO_CODEC: Record<string, VideoCodecId> = {
  'video/av1': 'AV1',
  'video/vp9': 'VP9',
  'video/h264': 'H264',
  'video/vp8': 'VP8'
}

interface CodecCandidate {
  codec: VideoCodecId
  /** `mimeType;sdpFmtpLine`, como o `mediaCapabilities` espera. */
  contentType: string
}

let forceVp8 = DEFAULT_FORCE_VP8
const forceListeners = new Set<(value: boolean) => void>()
let encodeCandidates: VideoCodecId[] = ['VP8']
let decodeCodecs: VideoCodecId[] = ['VP8']
let decodeProbe: Promise<void> | null = null
const encodeProbes = new Map<PresetId, Promise<void>>()
let lastProbe: Record<string, unknown> = {}

/** Estado do escape "modo compatibilidade" nesta maquina. */
export function isForceVp8(): boolean {
  return forceVp8
}

/** Aplicado no boot pelo `settings.get()` e pelo toggle das Configuracoes. */
export function setForceVp8(value: boolean): void {
  if (forceVp8 === value) return
  forceVp8 = value
  for (const listener of forceListeners) listener(value)
}

export function subscribeForceVp8(listener: (value: boolean) => void): () => void {
  forceListeners.add(listener)
  return () => forceListeners.delete(listener)
}

/** Ordena uma lista de aprovados pela escada e garante VP8 no fim. */
function withFloor(approved: Iterable<VideoCodecId>): VideoCodecId[] {
  const set = new Set(approved)
  set.add('VP8')
  return VIDEO_CODEC_PRIORITY.filter((codec) => set.has(codec))
}

/**
 * Codecs que o Chromium desta maquina consegue NEGOCIAR (aparecem na `m=video`
 * da SDP). E daqui que saem os `mimeType`/`sdpFmtpLine` reais usados no
 * `contentType` das duas sondas.
 */
function negotiableCodecs(): CodecCandidate[] {
  try {
    if (typeof RTCRtpSender === 'undefined' || !RTCRtpSender.getCapabilities) return []
    const capabilities = RTCRtpSender.getCapabilities('video')
    if (!capabilities) return []
    const candidates: CodecCandidate[] = []
    for (const entry of capabilities.codecs) {
      const codec = MIME_TO_CODEC[entry.mimeType.toLowerCase()]
      if (!codec) continue
      candidates.push({
        codec,
        contentType: entry.sdpFmtpLine ? `${entry.mimeType};${entry.sdpFmtpLine}` : entry.mimeType
      })
    }
    return candidates
  } catch (error) {
    console.warn('[codec] nao foi possivel listar os codecs negociaveis:', error)
    return []
  }
}

/** `navigator.mediaCapabilities` existe aqui? (jsdom e ambientes de teste nao tem). */
function mediaCapabilities(): MediaCapabilities | null {
  if (typeof navigator === 'undefined') return null
  return navigator.mediaCapabilities ?? null
}

/**
 * Sonda de DECODIFICACAO. Roda UMA vez por sessao do app, no boot, sem preset e
 * sem depender de transmitir. Idempotente (promessa cacheada), nunca lanca,
 * nunca bloqueia o boot (chamada com `void`).
 */
export function ensureDecodeProbe(): Promise<void> {
  if (decodeProbe) return decodeProbe
  decodeProbe = (async () => {
    try {
      const capabilities = mediaCapabilities()
      if (!capabilities) return
      const approved = new Set<VideoCodecId>()
      const raw: Record<string, unknown> = {}
      for (const candidate of negotiableCodecs()) {
        try {
          const info = await capabilities.decodingInfo({
            type: 'webrtc',
            video: { contentType: candidate.contentType, ...DECODE_PROBE_VIDEO }
          })
          raw[`decode:${candidate.contentType}`] = {
            supported: info.supported,
            smooth: info.smooth,
            powerEfficient: info.powerEfficient
          }
          // Decodificar bem NAO exige hardware: maquina forte decodifica bem por
          // software, e recusar isso derrubaria a sala inteira para VP8.
          if (info.supported && info.smooth) approved.add(candidate.codec)
        } catch (error) {
          raw[`decode:${candidate.contentType}`] = `falhou: ${String(error)}`
        }
      }
      decodeCodecs = withFloor(approved)
      lastProbe = { ...lastProbe, ...raw }
      console.info(`[codec] sonda de decodificacao: [${decodeCodecs.join(', ')}]`)
    } catch (error) {
      console.warn('[codec] sonda de decodificacao indisponivel; anunciando so VP8:', error)
    }
  })()
  return decodeProbe
}

/**
 * Sonda de CODIFICACAO, cacheada POR PRESET (o `encodingInfo` recebe
 * largura/altura/fps/bitrate do preset). Chamada em `startTransmission`.
 */
export function ensureEncodeProbe(presetId: PresetId): Promise<void> {
  const cached = encodeProbes.get(presetId)
  if (cached) return cached
  const probe = (async () => {
    try {
      const capabilities = mediaCapabilities()
      if (!capabilities) return
      const preset = PRESETS[presetId]
      const approved = new Set<VideoCodecId>()
      const raw: Record<string, unknown> = {}
      for (const candidate of negotiableCodecs()) {
        try {
          const info = await capabilities.encodingInfo({
            type: 'webrtc',
            video: {
              contentType: candidate.contentType,
              width: preset.width,
              height: preset.height,
              bitrate: preset.maxBitrate,
              framerate: preset.frameRate
            }
          })
          raw[`encode:${presetId}:${candidate.contentType}`] = {
            supported: info.supported,
            smooth: info.smooth,
            powerEfficient: info.powerEfficient
          }
          // So encoder de HARDWARE entra na escada (P2): adotar codec pesado por
          // software e o pior cenario da feature.
          if (info.supported && info.powerEfficient) approved.add(candidate.codec)
        } catch (error) {
          raw[`encode:${presetId}:${candidate.contentType}`] = `falhou: ${String(error)}`
        }
      }
      encodeCandidates = withFloor(approved)
      lastProbe = { ...lastProbe, ...raw }
      console.info(`[codec] sonda de codificacao ${presetId}: [${encodeCandidates.join(', ')}]`)
    } catch (error) {
      console.warn('[codec] sonda de codificacao indisponivel; seguindo em VP8:', error)
    }
  })()
  encodeProbes.set(presetId, probe)
  return probe
}

/** Codecs com encoder de HARDWARE nesta maquina, na ordem de prioridade. */
export function getEncodeCandidates(): VideoCodecId[] {
  if (forceVp8) return ['VP8']
  return [...encodeCandidates]
}

/** O que esta maquina anuncia decodificar bem. ['VP8'] com o escape ligado. */
export function getLocalDecodeCodecs(): VideoCodecId[] {
  if (forceVp8) return ['VP8']
  return [...decodeCodecs]
}

/** Somente diagnostico: instantaneo cru da ultima sondagem (para __zoiDebug). */
export function describeCodecProbe(): Record<string, unknown> {
  return {
    forceVp8,
    encodeCandidates: [...encodeCandidates],
    decodeCodecs: [...decodeCodecs],
    decodeProbed: decodeProbe !== null,
    encodeProbedPresets: [...encodeProbes.keys()],
    raw: { ...lastProbe }
  }
}
