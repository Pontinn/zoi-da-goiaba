// Monitor de qualidade (RF-38): a cada 3s cruza `getStats()` das conexoes de
// ENTRADA com o RTT do heartbeat e classifica good/medium/bad, alimentando o
// broadcast de QUALITY_UPDATE. Thresholds sao a assumption A5 da SPEC.
import {
  QUALITY_BAD_MIN_PACKET_LOSS,
  QUALITY_BAD_MIN_RTT_MS,
  QUALITY_GOOD_MAX_RTT_MS,
  QUALITY_UPDATE_INTERVAL_MS
} from '@shared/config'
import type { QualityLevel } from '@shared/protocol'

export interface QualityReport {
  level: QualityLevel
  rttMs: number
  inboundBitrateKbps: number | null
}

/** Conexao de entrada ETIQUETADA pela transmissao que ela carrega. */
export interface InboundEntry {
  txId: string
  connection: RTCPeerConnection
}

/** Conexao de SAIDA etiquetada pelo par que a recebe. */
export interface OutboundEntry {
  peerId: string
  txId: string
  connection: RTCPeerConnection
}

/** Leitura do `outbound-rtp` de video de UMA conexao de saida. */
export interface OutboundVideoStats {
  txId: string
  /** `mimeType` do report `codec` apontado por `codecId`, ex 'video/VP9'. */
  codec: string | null
  encoderImplementation: string | null
  qualityLimitationReason: string | null
  framesPerSecond: number | null
  at: number
}

/**
 * Recorte ESTREITO dos campos do getStats que interessam aqui. O `lib.dom` nao
 * declara `encoderImplementation`/`decoderImplementation`/`codecId` em toda
 * versao do TypeScript, entao a leitura passa por esta interface local, no mesmo
 * padrao que `ice-diagnostics.ts` ja usa.
 */
interface RtpVideoStatsEntry {
  type?: string
  kind?: string
  codecId?: string
  mimeType?: string
  encoderImplementation?: string
  decoderImplementation?: string
  qualityLimitationReason?: string
  framesPerSecond?: number
}

/**
 * Contadores de quadro de UMA transmissao recebida, lidos do `inbound-rtp` de
 * video no MESMO tick do agregado de qualidade (RNF-05: nenhum segundo laco).
 *
 * Ponto de extensao da video-codec-upgrade: campos novos do mesmo report
 * inbound-rtp (ex.: decoderImplementation) entram AQUI; leitura do lado de saida
 * ganha um outboundEntries simetrico neste MESMO monitor, nunca um coletor
 * paralelo.
 */
export interface InboundVideoStats {
  framesDecoded: number
  framesReceived: number
  at: number
  /** OPCIONAIS de proposito: nao quebram literais existentes em testes. */
  codec?: string | null
  decoderImplementation?: string | null
}

export interface StatsMonitorCallbacks {
  /** Conexoes de entrada a inspecionar, uma por transmissao recebida. */
  inboundEntries(): InboundEntry[]
  /** Conexoes de SAIDA da transmissao local (vazio quando nao transmite). */
  outboundEntries(): OutboundEntry[]
  /** Media dos RTTs de heartbeat conhecidos. */
  averageRttMs(): number
  onReport(report: QualityReport): void
  /** Contadores por transmissao. Opcional: o monitor roda sem consumidor. */
  onInboundVideoStats?(stats: ReadonlyMap<string, InboundVideoStats>): void
  /**
   * Amostras de saida, chaveadas por peerId. OBRIGATORIO (sem `?`), ao contrario
   * do irmao de entrada: alem de publicar as amostras, este callback e o RELOGIO
   * de 3s que alimenta o mapa de membros vistos no consumidor, entao ele e
   * chamado a cada tick mesmo com o mapa VAZIO.
   */
  onOutboundVideoStats(stats: ReadonlyMap<string, OutboundVideoStats>): void
}

interface InboundSample {
  bytes: number
  at: number
  packetsLost: number
  packetsReceived: number
}

export function classify(rttMs: number, packetLoss: number): QualityLevel {
  if (rttMs >= QUALITY_BAD_MIN_RTT_MS || packetLoss > QUALITY_BAD_MIN_PACKET_LOSS) return 'bad'
  if (rttMs <= QUALITY_GOOD_MAX_RTT_MS && packetLoss <= QUALITY_BAD_MIN_PACKET_LOSS / 2) {
    return 'good'
  }
  return 'medium'
}

/** `mimeType` do report `codec` apontado por um `codecId`, ou null. */
function codecMimeOf(report: RTCStatsReport, codecId: string | undefined): string | null {
  if (!codecId) return null
  const entry = report.get(codecId) as RtpVideoStatsEntry | undefined
  if (!entry || entry.type !== 'codec') return null
  return entry.mimeType ?? null
}

export class StatsMonitor {
  private timer: ReturnType<typeof setInterval> | null = null
  private previous: InboundSample | null = null

  constructor(private readonly callbacks: StatsMonitorCallbacks) {}

  start(): void {
    if (this.timer !== null) return
    this.timer = setInterval(() => {
      void this.sample()
    }, QUALITY_UPDATE_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.previous = null
  }

  private async sample(): Promise<void> {
    const connections = this.callbacks.inboundEntries()
    const rttMs = Math.round(this.callbacks.averageRttMs())
    const sampledAt = Date.now()

    let bytes = 0
    let packetsLost = 0
    let packetsReceived = 0
    const perTx = new Map<string, InboundVideoStats>()

    for (const inbound of connections) {
      try {
        const stats = await inbound.connection.getStats()
        stats.forEach((report) => {
          if (report.type !== 'inbound-rtp') return
          const entry = report as RTCInboundRtpStreamStats
          bytes += entry.bytesReceived ?? 0
          packetsLost += entry.packetsLost ?? 0
          packetsReceived += entry.packetsReceived ?? 0
          // Contadores de quadro (RF-03): so o report de VIDEO desta conexao, que
          // corresponde a exatamente uma transmissao (incomingCalls por txId).
          if (entry.kind !== 'video') return
          const framesDecoded = entry.framesDecoded ?? 0
          const previous = perTx.get(inbound.txId)
          if (previous && previous.framesDecoded >= framesDecoded) return
          const video = report as RtpVideoStatsEntry
          perTx.set(inbound.txId, {
            framesDecoded,
            framesReceived: entry.framesReceived ?? 0,
            at: sampledAt,
            codec: codecMimeOf(stats, video.codecId),
            decoderImplementation: video.decoderImplementation ?? null
          })
        })
      } catch (error) {
        console.warn('[stats] falha ao coletar getStats:', error)
      }
    }

    this.callbacks.onInboundVideoStats?.(perTx)

    // Laco de SAIDA no MESMO tick e no MESMO metodo (RNF-07): um `getStats()`
    // por conexao, nenhum timer novo em lugar nenhum.
    const perPeer = new Map<string, OutboundVideoStats>()
    for (const outbound of this.callbacks.outboundEntries()) {
      try {
        const stats = await outbound.connection.getStats()
        stats.forEach((report) => {
          const entry = report as RtpVideoStatsEntry
          if (entry.type !== 'outbound-rtp' || entry.kind !== 'video') return
          perPeer.set(outbound.peerId, {
            txId: outbound.txId,
            codec: codecMimeOf(stats, entry.codecId),
            encoderImplementation: entry.encoderImplementation ?? null,
            qualityLimitationReason: entry.qualityLimitationReason ?? null,
            framesPerSecond: entry.framesPerSecond ?? null,
            at: sampledAt
          })
        })
      } catch (error) {
        console.warn('[stats] falha ao coletar getStats:', error)
      }
    }
    // Chamado a CADA tick, inclusive com o mapa vazio: e contrato, o consumidor
    // usa este tick como relogio.
    this.callbacks.onOutboundVideoStats(perPeer)

    const now = Date.now()
    let inboundBitrateKbps: number | null = null
    if (this.previous && connections.length > 0) {
      const elapsedMs = now - this.previous.at
      if (elapsedMs > 0 && bytes >= this.previous.bytes) {
        inboundBitrateKbps = Math.round(((bytes - this.previous.bytes) * 8) / elapsedMs)
      }
    }

    const deltaLost = this.previous ? Math.max(0, packetsLost - this.previous.packetsLost) : 0
    const deltaReceived = this.previous
      ? Math.max(0, packetsReceived - this.previous.packetsReceived)
      : 0
    const packetLoss = deltaReceived + deltaLost > 0 ? deltaLost / (deltaReceived + deltaLost) : 0

    this.previous = { bytes, at: now, packetsLost, packetsReceived }

    this.callbacks.onReport({
      level: classify(rttMs, packetLoss),
      rttMs,
      inboundBitrateKbps: connections.length > 0 ? inboundBitrateKbps : null
    })
  }
}
