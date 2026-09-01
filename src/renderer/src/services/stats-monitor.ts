// Monitor de qualidade (RF-38): a cada 3s cruza `getStats()` das conexoes de
// ENTRADA com o RTT do heartbeat e classifica good/medium/bad, alimentando o
// broadcast de QUALITY_UPDATE. Thresholds sao a assumption A5 da SPEC.
import {
  AUDIO_LOG_WINDOW_MS,
  QUALITY_BAD_MIN_PACKET_LOSS,
  QUALITY_BAD_MIN_RTT_MS,
  QUALITY_GOOD_MAX_RTT_MS,
  QUALITY_UPDATE_INTERVAL_MS
} from '@shared/config'
import { createThrottledCounter, type ThrottledCounter } from '@shared/log-throttle'
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
 * Irmao de `RtpVideoStatsEntry` para os campos de audio que o `lib.dom` nao
 * declara em toda versao do TypeScript.
 */
interface RtpAudioStatsEntry {
  type?: string
  kind?: string
  codecId?: string
  mimeType?: string
  jitter?: number
  audioLevel?: number
  concealedSamples?: number
  concealmentEvents?: number
  insertedSamplesForDeceleration?: number
  removedSamplesForAcceleration?: number
  packetsDiscarded?: number
}

/**
 * Contadores de quadro de UMA transmissao recebida, lidos do `inbound-rtp` de
 * video no MESMO tick do agregado de qualidade (RNF-05: nenhum segundo laco).
 *
 * Ponto de extensao da video-codec-upgrade: campos novos do mesmo report
 * inbound-rtp (ex.: decoderImplementation) entram AQUI; leitura do lado de saida
 * ganha um outboundEntries simetrico neste MESMO monitor, nunca um coletor
 * paralelo.
 *
 * O irmao de AUDIO (`InboundAudioStats`) nasceu na feature audio-quality dentro
 * deste MESMO laco, pela mesma regra: continua PROIBIDO abrir coletor paralelo
 * ou um segundo `setInterval` para ler estatisticas.
 */
export interface InboundVideoStats {
  framesDecoded: number
  framesReceived: number
  at: number
  /** OPCIONAIS de proposito: nao quebram literais existentes em testes. */
  codec?: string | null
  decoderImplementation?: string | null
}

/**
 * Irmao de `InboundVideoStats` para o audio recebido. Valores ABSOLUTOS do
 * getStats, como os do irmao de video: quem precisa de delta guarda a amostra
 * anterior. `jitter` e `audioLevel` viram `null` quando ausentes (zero e um
 * valor legitimo, e mentir sobre ele estragaria o diagnostico); os contadores
 * ausentes viram 0.
 */
export interface InboundAudioStats {
  at: number
  jitter: number | null
  audioLevel: number | null
  concealedSamples: number
  concealmentEvents: number
  insertedSamplesForDeceleration: number
  removedSamplesForAcceleration: number
  packetsDiscarded: number
  packetsLost: number
  packetsReceived: number
  bytesReceived: number
  codec: string | null
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
  /** Campos de audio por transmissao. Opcional, como o irmao de video. */
  onInboundAudioStats?(stats: ReadonlyMap<string, InboundAudioStats>): void
  /**
   * Amostras de saida, chaveadas por peerId. OBRIGATORIO (sem `?`), ao contrario
   * do irmao de entrada: alem de publicar as amostras, este callback e o RELOGIO
   * de 3s que alimenta o mapa de membros vistos no consumidor, entao ele e
   * chamado a cada tick mesmo com o mapa VAZIO.
   */
  onOutboundVideoStats(stats: ReadonlyMap<string, OutboundVideoStats>): void
}

/** Totais de UM `kind` numa amostra. */
interface KindTotals {
  bytes: number
  packetsLost: number
  packetsReceived: number
}

/**
 * Os acumuladores param de misturar video e audio (RF-03), mas o relatorio de
 * qualidade continua AGREGADO: o que alimenta `onReport` e a SOMA dos dois, que
 * e numericamente identica ao que este arquivo produzia antes da separacao.
 * Trocar o insumo para "so video" mudaria a classificacao good/medium/bad de
 * todo mundo, ou seja regressao de produto disfarcada de refatoracao.
 */
interface InboundSample {
  at: number
  video: KindTotals
  audio: KindTotals
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
  /** Contador com janela do log de audio, um por transmissao recebida. */
  private readonly audioLogByTx = new Map<string, ThrottledCounter>()
  /** Amostra de audio anterior por transmissao, para calcular os deltas. */
  private readonly previousAudioByTx = new Map<string, InboundAudioStats>()

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
    this.audioLogByTx.clear()
    this.previousAudioByTx.clear()
  }

  private async sample(): Promise<void> {
    const connections = this.callbacks.inboundEntries()
    const rttMs = Math.round(this.callbacks.averageRttMs())
    const sampledAt = Date.now()

    // Poda: sem isso, uma transmissao que acabou deixaria a entrada viva pelo
    // resto da sessao.
    const liveTxIds = new Set(connections.map((entry) => entry.txId))
    for (const txId of this.audioLogByTx.keys()) {
      if (!liveTxIds.has(txId)) this.audioLogByTx.delete(txId)
    }
    for (const txId of this.previousAudioByTx.keys()) {
      if (!liveTxIds.has(txId)) this.previousAudioByTx.delete(txId)
    }

    const videoTotals: KindTotals = { bytes: 0, packetsLost: 0, packetsReceived: 0 }
    const audioTotals: KindTotals = { bytes: 0, packetsLost: 0, packetsReceived: 0 }
    const perTx = new Map<string, InboundVideoStats>()
    const perTxAudio = new Map<string, InboundAudioStats>()

    for (const inbound of connections) {
      try {
        const stats = await inbound.connection.getStats()
        stats.forEach((report) => {
          if (report.type !== 'inbound-rtp') return
          const entry = report as RTCInboundRtpStreamStats
          // Report sem `kind` (navegador antigo ou report parcial) cai no
          // conjunto de VIDEO, que e o comportamento anterior a esta separacao.
          const totals = entry.kind === 'audio' ? audioTotals : videoTotals
          totals.bytes += entry.bytesReceived ?? 0
          totals.packetsLost += entry.packetsLost ?? 0
          totals.packetsReceived += entry.packetsReceived ?? 0

          if (entry.kind === 'audio') {
            const sound = report as RtpAudioStatsEntry
            const packetsReceived = entry.packetsReceived ?? 0
            // Dedupe no mesmo espirito do irmao de video: com dois inbound-rtp de
            // audio na mesma conexao, fica o de maior contagem de pacotes.
            const known = perTxAudio.get(inbound.txId)
            if (known && known.packetsReceived >= packetsReceived) return
            perTxAudio.set(inbound.txId, {
              at: sampledAt,
              jitter: sound.jitter ?? null,
              audioLevel: sound.audioLevel ?? null,
              concealedSamples: sound.concealedSamples ?? 0,
              concealmentEvents: sound.concealmentEvents ?? 0,
              insertedSamplesForDeceleration: sound.insertedSamplesForDeceleration ?? 0,
              removedSamplesForAcceleration: sound.removedSamplesForAcceleration ?? 0,
              packetsDiscarded: sound.packetsDiscarded ?? 0,
              packetsLost: entry.packetsLost ?? 0,
              packetsReceived,
              bytesReceived: entry.bytesReceived ?? 0,
              codec: codecMimeOf(stats, sound.codecId)
            })
            return
          }
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
    this.callbacks.onInboundAudioStats?.(perTxAudio)
    this.logAudio(perTxAudio, sampledAt)

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

    // Agregado por SOMA EXPLICITA dos dois kind: mesmo numero de antes.
    const bytes = videoTotals.bytes + audioTotals.bytes
    const packetsLost = videoTotals.packetsLost + audioTotals.packetsLost
    const packetsReceived = videoTotals.packetsReceived + audioTotals.packetsReceived

    const now = Date.now()
    let inboundBitrateKbps: number | null = null
    if (this.previous && connections.length > 0) {
      const previousBytes = this.previous.video.bytes + this.previous.audio.bytes
      const elapsedMs = now - this.previous.at
      if (elapsedMs > 0 && bytes >= previousBytes) {
        inboundBitrateKbps = Math.round(((bytes - previousBytes) * 8) / elapsedMs)
      }
    }

    const previousLost = this.previous
      ? this.previous.video.packetsLost + this.previous.audio.packetsLost
      : 0
    const previousReceived = this.previous
      ? this.previous.video.packetsReceived + this.previous.audio.packetsReceived
      : 0
    const deltaLost = this.previous ? Math.max(0, packetsLost - previousLost) : 0
    const deltaReceived = this.previous ? Math.max(0, packetsReceived - previousReceived) : 0
    const packetLoss = deltaReceived + deltaLost > 0 ? deltaLost / (deltaReceived + deltaLost) : 0

    this.previous = { at: now, video: videoTotals, audio: audioTotals }

    this.callbacks.onReport({
      level: classify(rttMs, packetLoss),
      rttMs,
      inboundBitrateKbps: connections.length > 0 ? inboundBitrateKbps : null
    })
  }

  /**
   * Log de audio recebido (RF-01, lado de recepcao). So escreve quando ha algo a
   * contar: uma sessao com audio saudavel nao gera linha nenhuma, que e o
   * comportamento certo (log de diagnostico existe para o dia ruim). O primeiro
   * tique de uma transmissao tambem nao gera linha: sem amostra anterior nao ha
   * delta, e contador absoluto isolado nao diz nada sobre o intervalo.
   */
  private logAudio(perTxAudio: ReadonlyMap<string, InboundAudioStats>, at: number): void {
    for (const [txId, current] of perTxAudio) {
      const previous = this.previousAudioByTx.get(txId)
      this.previousAudioByTx.set(txId, current)
      if (!previous) continue

      const conceal = Math.max(0, current.concealmentEvents - previous.concealmentEvents)
      const concealed = Math.max(0, current.concealedSamples - previous.concealedSamples)
      const discarded = Math.max(0, current.packetsDiscarded - previous.packetsDiscarded)
      const lost = Math.max(0, current.packetsLost - previous.packetsLost)
      if (conceal === 0 && discarded === 0 && lost === 0) continue

      let counter = this.audioLogByTx.get(txId)
      if (!counter) {
        counter = createThrottledCounter(AUDIO_LOG_WINDOW_MS)
        this.audioLogByTx.set(txId, counter)
      }
      // A template string so e montada quando a janela abriu.
      if (counter.record(at)) {
        console.warn(
          `[audio-stats] tx ${txId} delta conceal=${conceal} amostras=${concealed} descartados=${discarded} perdidos=${lost} jitter=${current.jitter ?? 'sem-dado'}`
        )
      }
    }
  }
}
