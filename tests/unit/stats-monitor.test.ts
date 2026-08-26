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
  type OutboundVideoStats,
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
      outboundEntries: () => [],
      onOutboundVideoStats: () => {},
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
      outboundEntries: () => [],
      onOutboundVideoStats: () => {},
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
      outboundEntries: () => [],
      onOutboundVideoStats: () => {},
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
      outboundEntries: () => [],
      onOutboundVideoStats: () => {},
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
      outboundEntries: () => [],
      onOutboundVideoStats: () => {},
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

// --- video-codec-upgrade: laco de SAIDA no MESMO tick (RNF-07/RF-11/RF-21) ---

/** Conexao falsa com reports ENDERECAVEIS por id (o codec e achado por codecId). */
class KeyedConnection {
  calls = 0
  constructor(private readonly reports: Record<string, FakeReport>) {}

  getStats(): Promise<Map<string, FakeReport>> {
    this.calls += 1
    return Promise.resolve(new Map(Object.entries(this.reports)))
  }

  asPeerConnection(): RTCPeerConnection {
    return this as unknown as RTCPeerConnection
  }
}

function outboundReports(overrides: FakeReport = {}): Record<string, FakeReport> {
  return {
    'codec-1': { type: 'codec', id: 'codec-1', mimeType: 'video/AV1' },
    'out-1': {
      type: 'outbound-rtp',
      kind: 'video',
      codecId: 'codec-1',
      encoderImplementation: 'ExternalEncoder (NVIDIA)',
      qualityLimitationReason: 'none',
      framesPerSecond: 30,
      ...overrides
    }
  }
}

describe('stats-monitor / conexoes de saida', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('le UM getStats por conexao de saida por tick, no MESMO tick da entrada', async () => {
    const inbound = new FakeConnection([
      { type: 'inbound-rtp', kind: 'video', bytesReceived: 10, framesDecoded: 1, framesReceived: 1 }
    ])
    const outbound = new KeyedConnection(outboundReports())
    const perPeerSeen: ReadonlyMap<string, OutboundVideoStats>[] = []
    const perTxSeen: ReadonlyMap<string, InboundVideoStats>[] = []

    const monitor = new StatsMonitor({
      inboundEntries: () => [{ txId: 'tx1', connection: inbound.asPeerConnection() }],
      outboundEntries: () => [
        { peerId: 'p1', txId: 'tx9', connection: outbound.asPeerConnection() }
      ],
      onOutboundVideoStats: (stats) => perPeerSeen.push(stats),
      averageRttMs: () => 20,
      onReport: () => {},
      onInboundVideoStats: (stats) => perTxSeen.push(stats)
    })

    monitor.start()
    await tick()
    monitor.stop()

    expect(inbound.calls).toBe(1)
    expect(outbound.calls).toBe(1)
    expect(perPeerSeen).toHaveLength(1)
    expect(perTxSeen).toHaveLength(1)
  })

  it('extrai codec, encoder, limitacao e fps do outbound-rtp', async () => {
    const outbound = new KeyedConnection(outboundReports())
    const seen: ReadonlyMap<string, OutboundVideoStats>[] = []
    const monitor = new StatsMonitor({
      inboundEntries: () => [],
      outboundEntries: () => [
        { peerId: 'p1', txId: 'tx9', connection: outbound.asPeerConnection() }
      ],
      onOutboundVideoStats: (stats) => seen.push(stats),
      averageRttMs: () => 20,
      onReport: () => {}
    })

    monitor.start()
    await tick()
    monitor.stop()

    const entry = seen[0]?.get('p1')
    expect(entry?.txId).toBe('tx9')
    expect(entry?.codec).toBe('video/AV1')
    expect(entry?.encoderImplementation).toBe('ExternalEncoder (NVIDIA)')
    expect(entry?.qualityLimitationReason).toBe('none')
    expect(entry?.framesPerSecond).toBe(30)
    expect(typeof entry?.at).toBe('number')
  })

  it('campos ausentes viram null em vez de quebrar o tick', async () => {
    const outbound = new KeyedConnection({
      'out-1': { type: 'outbound-rtp', kind: 'video' }
    })
    const seen: ReadonlyMap<string, OutboundVideoStats>[] = []
    const monitor = new StatsMonitor({
      inboundEntries: () => [],
      outboundEntries: () => [
        { peerId: 'p1', txId: 'tx9', connection: outbound.asPeerConnection() }
      ],
      onOutboundVideoStats: (stats) => seen.push(stats),
      averageRttMs: () => 20,
      onReport: () => {}
    })

    monitor.start()
    await tick()
    monitor.stop()

    const entry = seen[0]?.get('p1')
    expect(entry?.codec).toBeNull()
    expect(entry?.encoderImplementation).toBeNull()
    expect(entry?.qualityLimitationReason).toBeNull()
    expect(entry?.framesPerSecond).toBeNull()
  })

  it('o callback de saida e chamado a CADA tick, mesmo sem transmissao local', async () => {
    const seen: ReadonlyMap<string, OutboundVideoStats>[] = []
    const monitor = new StatsMonitor({
      inboundEntries: () => [],
      outboundEntries: () => [],
      onOutboundVideoStats: (stats) => seen.push(stats),
      averageRttMs: () => 20,
      onReport: () => {}
    })

    monitor.start()
    await tick(3)
    monitor.stop()

    // E o RELOGIO do consumidor: sem estas chamadas a carencia por membro nunca
    // venceria para quem nao esta transmitindo.
    expect(seen).toHaveLength(3)
    expect(seen.every((map) => map.size === 0)).toBe(true)
  })

  it('conexao de saida que rejeita getStats nao derruba o tick', async () => {
    const broken = new BrokenConnection()
    const good = new KeyedConnection(outboundReports())
    const seen: ReadonlyMap<string, OutboundVideoStats>[] = []
    const reports: QualityReport[] = []
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const monitor = new StatsMonitor({
      inboundEntries: () => [],
      outboundEntries: () => [
        { peerId: 'quebrada', txId: 'tx9', connection: broken.asPeerConnection() },
        { peerId: 'boa', txId: 'tx9', connection: good.asPeerConnection() }
      ],
      onOutboundVideoStats: (stats) => seen.push(stats),
      averageRttMs: () => 20,
      onReport: (report) => reports.push(report)
    })

    monitor.start()
    await tick()
    monitor.stop()

    expect(seen[0]?.has('quebrada')).toBe(false)
    expect(seen[0]?.get('boa')?.codec).toBe('video/AV1')
    // O agregado de qualidade do tick continua saindo.
    expect(reports).toHaveLength(1)
  })

  it('o inbound-rtp de video ganha codec e decoderImplementation opcionais', async () => {
    const inbound = new KeyedConnection({
      'codec-9': { type: 'codec', id: 'codec-9', mimeType: 'video/VP9' },
      'in-1': {
        type: 'inbound-rtp',
        kind: 'video',
        codecId: 'codec-9',
        decoderImplementation: 'libvpx',
        bytesReceived: 100,
        framesDecoded: 7,
        framesReceived: 8
      }
    })
    const seen: ReadonlyMap<string, InboundVideoStats>[] = []
    const monitor = new StatsMonitor({
      inboundEntries: () => [{ txId: 'tx1', connection: inbound.asPeerConnection() }],
      outboundEntries: () => [],
      onOutboundVideoStats: () => {},
      averageRttMs: () => 20,
      onReport: () => {},
      onInboundVideoStats: (stats) => seen.push(stats)
    })

    monitor.start()
    await tick()
    monitor.stop()

    const entry = seen[0]?.get('tx1')
    expect(entry?.framesDecoded).toBe(7)
    expect(entry?.codec).toBe('video/VP9')
    expect(entry?.decoderImplementation).toBe('libvpx')
  })

  it('RNF-07: nenhum timer novo alem do tick unico do monitor', async () => {
    const outbound = new KeyedConnection(outboundReports())
    const monitor = new StatsMonitor({
      inboundEntries: () => [],
      outboundEntries: () => [
        { peerId: 'p1', txId: 'tx9', connection: outbound.asPeerConnection() }
      ],
      onOutboundVideoStats: () => {},
      averageRttMs: () => 20,
      onReport: () => {}
    })

    monitor.start()
    await tick(4)
    monitor.stop()
    // Uma leitura por tick: se existisse um segundo laco/coletor, seriam mais.
    expect(outbound.calls).toBe(4)

    // Parado o monitor, mais nenhuma leitura acontece.
    await tick(2)
    expect(outbound.calls).toBe(4)
  })
})
