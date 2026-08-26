// Cobertura da extracao por transmissao do monitor de qualidade (Feature 4.2).
//
// Fakes manuais no estilo do `FakePeerConnection` de `media-manager.test.ts`:
// nenhum Electron, nenhum WebRTC de verdade, so reports simulados. O ponto que
// mais importa aqui e RNF-05: UM unico `getStats()` por conexao por tick, no
// mesmo laco do agregado que ja existia.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QUALITY_UPDATE_INTERVAL_MS } from '@shared/config'
import {
  StatsMonitor,
  classify,
  type InboundVideoStats,
  type QualityReport
} from '@renderer/services/stats-monitor'

type FakeReport = Record<string, unknown>

/** Conexao falsa que devolve os reports do tick e conta quantas vezes foi lida. */
class FakeConnection {
  calls = 0
  constructor(private reports: FakeReport[]) {}

  setReports(reports: FakeReport[]): void {
    this.reports = reports
  }

  getStats(): Promise<Map<string, FakeReport>> {
    this.calls += 1
    return Promise.resolve(new Map(this.reports.map((report, index) => [String(index), report])))
  }

  asPeerConnection(): RTCPeerConnection {
    return this as unknown as RTCPeerConnection
  }
}

/** Conexao falsa cujo `getStats()` sempre rejeita. */
class BrokenConnection {
  calls = 0
  getStats(): Promise<Map<string, FakeReport>> {
    this.calls += 1
    return Promise.reject(new Error('pconn fechada'))
  }

  asPeerConnection(): RTCPeerConnection {
    return this as unknown as RTCPeerConnection
  }
}

async function tick(times = 1): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await vi.advanceTimersByTimeAsync(QUALITY_UPDATE_INTERVAL_MS)
  }
}

describe('stats-monitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('1. publica contadores por txId no MESMO tick do agregado (RNF-05)', async () => {
    const first = new FakeConnection([
      { type: 'inbound-rtp', kind: 'video', bytesReceived: 1_000, framesDecoded: 12, framesReceived: 14 }
    ])
    const second = new FakeConnection([
      { type: 'inbound-rtp', kind: 'video', bytesReceived: 500, framesDecoded: 3, framesReceived: 5 }
    ])

    const perTxSeen: ReadonlyMap<string, InboundVideoStats>[] = []
    const reports: QualityReport[] = []
    const monitor = new StatsMonitor({
      inboundEntries: () => [
        { txId: 'tx1', connection: first.asPeerConnection() },
        { txId: 'tx2', connection: second.asPeerConnection() }
      ],
      averageRttMs: () => 40,
      onReport: (report) => reports.push(report),
      onInboundVideoStats: (stats) => perTxSeen.push(stats)
    })

    monitor.start()
    await tick()
    monitor.stop()

    // Um unico getStats por conexao por tick: nenhum segundo laco.
    expect(first.calls).toBe(1)
    expect(second.calls).toBe(1)

    // O mapa per-tx sai no mesmo tick do relatorio agregado.
    expect(perTxSeen).toHaveLength(1)
    expect(reports).toHaveLength(1)

    const map = perTxSeen[0]!
    expect(map.get('tx1')?.framesDecoded).toBe(12)
    expect(map.get('tx1')?.framesReceived).toBe(14)
    expect(map.get('tx2')?.framesDecoded).toBe(3)
    expect(map.get('tx2')?.framesReceived).toBe(5)
    expect(typeof map.get('tx1')?.at).toBe('number')
  })

  it('2. o agregado de qualidade continua identico ao calculo anterior', async () => {
    const connection = new FakeConnection([
      { type: 'inbound-rtp', kind: 'video', bytesReceived: 1_000, packetsLost: 0, packetsReceived: 100 }
    ])
    const reports: QualityReport[] = []
    const monitor = new StatsMonitor({
      inboundEntries: () => [{ txId: 'tx1', connection: connection.asPeerConnection() }],
      averageRttMs: () => 42.4,
      onReport: (report) => reports.push(report)
    })

    monitor.start()
    await tick()
    // Primeiro tick nao tem anterior: bitrate ainda desconhecido.
    expect(reports[0]?.inboundBitrateKbps).toBeNull()
    expect(reports[0]?.rttMs).toBe(42)

    connection.setReports([
      { type: 'inbound-rtp', kind: 'video', bytesReceived: 4_750, packetsLost: 6, packetsReceived: 294 }
    ])
    await tick()
    monitor.stop()

    // (4750 - 1000) * 8 / 3000ms = 10 kbps, a mesma conta de sempre.
    expect(reports[1]?.inboundBitrateKbps).toBe(10)
    // deltaLost=6, deltaReceived=194 -> perda de 3%, que classifica como medium.
    expect(reports[1]?.level).toBe(classify(42, 6 / 200))
  })

  it('3. report de audio e ignorado; sem framesDecoded o valor vira zero', async () => {
    const connection = new FakeConnection([
      { type: 'inbound-rtp', kind: 'audio', bytesReceived: 800, framesDecoded: 99 },
      { type: 'inbound-rtp', kind: 'video', bytesReceived: 200, framesReceived: 4 },
      { type: 'candidate-pair', kind: 'video', framesDecoded: 77 }
    ])
    let seen: ReadonlyMap<string, InboundVideoStats> | null = null
    const monitor = new StatsMonitor({
      inboundEntries: () => [{ txId: 'tx1', connection: connection.asPeerConnection() }],
      averageRttMs: () => 10,
      onReport: () => {},
      onInboundVideoStats: (stats) => {
        seen = stats
      }
    })

    monitor.start()
    await tick()
    monitor.stop()

    const map = seen as unknown as ReadonlyMap<string, InboundVideoStats>
    // O 99 do audio e o 77 do candidate-pair nao podem vazar para a prova.
    expect(map.get('tx1')?.framesDecoded).toBe(0)
    expect(map.get('tx1')?.framesReceived).toBe(4)
  })

  it('4. getStats rejeitando omite so aquela entrada e nao derruba o resto', async () => {
    const broken = new BrokenConnection()
    const healthy = new FakeConnection([
      { type: 'inbound-rtp', kind: 'video', bytesReceived: 900, framesDecoded: 5, framesReceived: 5 }
    ])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const reports: QualityReport[] = []
    let seen: ReadonlyMap<string, InboundVideoStats> | null = null

    const monitor = new StatsMonitor({
      inboundEntries: () => [
        { txId: 'tx-quebrada', connection: broken.asPeerConnection() },
        { txId: 'tx-boa', connection: healthy.asPeerConnection() }
      ],
      averageRttMs: () => 15,
      onReport: (report) => reports.push(report),
      onInboundVideoStats: (stats) => {
        seen = stats
      }
    })

    monitor.start()
    await tick()
    monitor.stop()

    const map = seen as unknown as ReadonlyMap<string, InboundVideoStats>
    expect(map.has('tx-quebrada')).toBe(false)
    expect(map.get('tx-boa')?.framesDecoded).toBe(5)
    expect(reports).toHaveLength(1)
    expect(warn).toHaveBeenCalled()
  })

  it('5. o consumidor per-tx e opcional de verdade', async () => {
    const connection = new FakeConnection([
      { type: 'inbound-rtp', kind: 'video', bytesReceived: 100, framesDecoded: 1, framesReceived: 1 }
    ])
    const reports: QualityReport[] = []
    const monitor = new StatsMonitor({
      inboundEntries: () => [{ txId: 'tx1', connection: connection.asPeerConnection() }],
      averageRttMs: () => 20,
      onReport: (report) => reports.push(report)
    })

    monitor.start()
    await tick(2)
    monitor.stop()

    expect(reports).toHaveLength(2)
    expect(connection.calls).toBe(2)
  })
})
