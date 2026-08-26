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
}

export interface StatsMonitorCallbacks {
  /** Conexoes de entrada a inspecionar, uma por transmissao recebida. */
  inboundEntries(): InboundEntry[]
  /** Media dos RTTs de heartbeat conhecidos. */
  averageRttMs(): number
  onReport(report: QualityReport): void
  /** Contadores por transmissao. Opcional: o monitor roda sem consumidor. */
  onInboundVideoStats?(stats: ReadonlyMap<string, InboundVideoStats>): void
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
          perTx.set(inbound.txId, {
            framesDecoded,
            framesReceived: entry.framesReceived ?? 0,
            at: sampledAt
          })
        })
      } catch (error) {
        console.warn('[stats] falha ao coletar getStats:', error)
      }
    }

    this.callbacks.onInboundVideoStats?.(perTx)

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
