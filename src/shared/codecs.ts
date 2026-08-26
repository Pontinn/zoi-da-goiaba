// Escolha e preferencia de codec de video. Modulo PURO: sem DOM, sem Electron,
// sem PeerJS (o processo main tambem importa daqui o default do escape).
//
// Escada de prioridade: AV1 > VP9 > H264 > VP8. VP8 e o PISO UNIVERSAL, o codec
// que o Chromium ja negocia sozinho hoje e que toda maquina decodifica: em
// qualquer duvida (anuncio ausente, sonda que falhou, nome desconhecido) a
// resposta e VP8, nunca uma aposta.

export type VideoCodecId = 'AV1' | 'VP9' | 'H264' | 'VP8'

/** Do mais eficiente por bit ao mais compativel. VP8 e o piso universal. */
export const VIDEO_CODEC_PRIORITY: readonly VideoCodecId[] = ['AV1', 'VP9', 'H264', 'VP8']

/** Nomes que cada codec pode ter no `a=rtpmap` (o AV1 ja se chamou AV1X). */
export const CODEC_RTPMAP_NAMES = {
  AV1: ['AV1', 'AV1X'],
  VP9: ['VP9'],
  H264: ['H264'],
  VP8: ['VP8']
} as const satisfies Record<VideoCodecId, readonly string[]>

/** Teto de entradas aceitas num anuncio de decodificacao (limite anti-abuso). */
const MAX_DECODE_ANNOUNCEMENT = 8

export function isVideoCodecId(value: unknown): value is VideoCodecId {
  return typeof value === 'string' && (VIDEO_CODEC_PRIORITY as readonly string[]).includes(value)
}

/**
 * Anuncio recebido -> lista confiavel. Filtra desconhecidos, remove repetidos,
 * garante 'VP8' e corta em 8 entradas (limite anti-abuso). Nunca lanca.
 */
export function normalizeDecodeAnnouncement(
  value: readonly string[] | undefined
): VideoCodecId[] {
  if (!Array.isArray(value)) return ['VP8']
  const known = new Set<VideoCodecId>()
  for (const item of value) {
    if (isVideoCodecId(item)) known.add(item)
  }
  known.add('VP8')
  // A ordem de saida e sempre a da escada: o anuncio nao dita prioridade.
  return VIDEO_CODEC_PRIORITY.filter((codec) => known.has(codec)).slice(
    0,
    MAX_DECODE_ANNOUNCEMENT
  )
}

/** Melhor codec que ESTA maquina codifica e que TODOS os membros decodificam. */
export function pickRoomCodec(
  localEncodeCandidates: readonly VideoCodecId[],
  memberDecodes: readonly (readonly VideoCodecId[])[]
): VideoCodecId {
  for (const codec of VIDEO_CODEC_PRIORITY) {
    if (!localEncodeCandidates.includes(codec)) continue
    if (memberDecodes.every((list) => list.includes(codec))) return codec
  }
  return 'VP8'
}

/** Proximo degrau ABAIXO de `current` que ainda serve a sala; null se nao houver. */
export function nextLowerCodec(
  current: VideoCodecId,
  localEncodeCandidates: readonly VideoCodecId[],
  memberDecodes: readonly (readonly VideoCodecId[])[]
): VideoCodecId | null {
  const start = VIDEO_CODEC_PRIORITY.indexOf(current) + 1
  for (let index = start; index < VIDEO_CODEC_PRIORITY.length; index += 1) {
    const codec = VIDEO_CODEC_PRIORITY[index]
    if (!codec) continue
    if (!localEncodeCandidates.includes(codec)) continue
    if (memberDecodes.every((list) => list.includes(codec))) return codec
  }
  return null
}

/**
 * Reordena os payload types da secao `m=video` para por o codec pedido na
 * frente. NUNCA remove nenhum payload type (remover quebra a negociacao com
 * facilidade) e NUNCA lanca: em qualquer duvida devolve o SDP original.
 */
export function preferVideoCodec(sdp: string, codec: VideoCodecId): string {
  try {
    const lines = sdp.split(/\r\n|\r|\n/)
    const mIndex = lines.findIndex((line) => line.startsWith('m=video '))
    if (mIndex === -1) return sdp

    let end = lines.length
    for (let index = mIndex + 1; index < lines.length; index += 1) {
      const line = lines[index]
      if (line !== undefined && line.startsWith('m=')) {
        end = index
        break
      }
    }

    const names = CODEC_RTPMAP_NAMES[codec] as readonly string[]
    const wanted = new Set<string>()
    for (let index = mIndex + 1; index < end; index += 1) {
      const match = /^a=rtpmap:(\d+) ([^/]+)\//.exec(lines[index] ?? '')
      if (!match) continue
      const payloadType = match[1]
      const name = match[2]
      if (payloadType === undefined || name === undefined) continue
      if (names.includes(name.toUpperCase())) wanted.add(payloadType)
    }
    if (wanted.size === 0) return sdp

    const fields = (lines[mIndex] ?? '').split(' ')
    const header = fields.slice(0, 3)
    const payloads = fields.slice(3)
    const preferred = payloads.filter((payload) => wanted.has(payload))
    const rest = payloads.filter((payload) => !wanted.has(payload))
    if (preferred.length === 0 || preferred.length === payloads.length) return sdp

    lines[mIndex] = [...header, ...preferred, ...rest].join(' ')
    return lines.join('\r\n')
  } catch {
    return sdp
  }
}

/**
 * Configuracao de referencia da sonda de DECODIFICACAO. Decodificar e
 * propriedade da maquina, nao do preset que outra pessoa escolheu: um numero
 * fixo (o do preset padrao 1080p30) evita ter que sondar 5 combinacoes e evita
 * depender de saber, no boot, o que alguem vai transmitir depois.
 */
export const DECODE_PROBE_VIDEO = {
  width: 1920,
  height: 1080,
  framerate: 30,
  bitrate: 4_000_000
} as const

/** Escape "modo compatibilidade" desligado por padrao: a feature vale por default. */
export const DEFAULT_FORCE_VP8 = false

/** Qualquer coisa que nao seja o booleano `true` e "desligado". */
export function normalizeForceVp8(value: unknown): boolean {
  return value === true
}
