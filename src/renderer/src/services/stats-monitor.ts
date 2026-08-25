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

export interface StatsMonitorCallbacks {
  /** Conexoes de entrada a inspecionar (uma por transmissao recebida). */
  inboundConnections(): RTCPeerConnection[]
  /** Media dos RTTs de heartbeat conhecidos. */
  averageRttMs(): number
  onReport(report: QualityReport): void
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
    const connections = this.callbacks.inboundConnections()
    const rttMs = Math.round(this.callbacks.averageRttMs())

    let bytes = 0
    let packetsLost = 0
    let packetsReceived = 0

    for (const connection of connections) {
      try {
        const stats = await connection.getStats()
        stats.forEach((report) => {
          if (report.type !== 'inbound-rtp') return
          const entry = report as RTCInboundRtpStreamStats
          bytes += entry.bytesReceived ?? 0
          packetsLost += entry.packetsLost ?? 0
          packetsReceived += entry.packetsReceived ?? 0
        })
      } catch (error) {
        console.warn('[stats] falha ao coletar getStats:', error)
      }
    }

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
