// Cliente da captura com exclusao (lado renderer): o pedaco que transforma
// frames PCM numa track de audio unica e estavel.
//
// O que este arquivo protege de verdade:
//   1. a ORDEM anti-corrida: o listener de `message` existe antes do invoke,
//      senao o port chega e cai no vazio (o postMessage nao bufferiza);
//   2. o relogio PROPRIO da track: o worker reinicia o timestamp do zero a cada
//      re-fork da cascata, e timestamp que anda para tras quebra a track;
//   3. a troca de port em runtime sem trocar a track (e o que mantem os
//      fallbacks de direcao intocados: zero replaceTrack, zero renegociacao).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAudioExclusionClient } from '@renderer/services/audio-exclusion'

const PORT_CHANNEL = 'zoi:audio-exclusion-port'
const FRAME_BYTES = 480 * 2 * 4

/** MessagePort minimo: o cliente so usa `onmessage`, `start` e `close`. */
class FakePort {
  onmessage: ((event: { data: unknown }) => void) | null = null
  started = false
  closed = false

  start(): void {
    this.started = true
  }

  close(): void {
    this.closed = true
  }

  /** Entrega um frame PCM como o worker faria. */
  deliverPcm(timestampUs: number, bytes = FRAME_BYTES): void {
    this.onmessage?.({ data: { type: 'pcm', timestampUs, data: new ArrayBuffer(bytes) } })
  }

  deliver(data: unknown): void {
    this.onmessage?.({ data })
  }
}

interface WrittenFrame {
  timestamp: number
  numberOfFrames: number
  numberOfChannels: number
  sampleRate: number
  format: string
}

const written: WrittenFrame[] = []
let writerClosed = false
let desiredSize: number | null = 8

class FakeWriter {
  write(frame: WrittenFrame): Promise<void> {
    written.push(frame)
    return Promise.resolve()
  }

  close(): Promise<void> {
    writerClosed = true
    return Promise.resolve()
  }

  get desiredSize(): number | null {
    return desiredSize
  }
}

class FakeGenerator {
  static instances: FakeGenerator[] = []
  readonly kind: string
  readonly writable = { getWriter: (): FakeWriter => new FakeWriter() }
  stopped = false

  constructor(init: { kind: string }) {
    this.kind = init.kind
    FakeGenerator.instances.push(this)
  }

  stop(): void {
    this.stopped = true
  }
}

/** `AudioData` do WebCodecs: aqui so precisa guardar o que foi pedido. */
class FakeAudioData {
  timestamp: number
  numberOfFrames: number
  numberOfChannels: number
  sampleRate: number
  format: string

  constructor(init: WrittenFrame & { data: ArrayBuffer }) {
    this.timestamp = init.timestamp
    this.numberOfFrames = init.numberOfFrames
    this.numberOfChannels = init.numberOfChannels
    this.sampleRate = init.sampleRate
    this.format = init.format
  }
}

type MessageListener = (event: { data: unknown; ports: FakePort[] }) => void

const listeners = new Set<MessageListener>()
let startResult: unknown = { mode: 'process-exclusion', sampleRate: 48000, channels: 2 }
let startCalls = 0
let stopCalls = 0
/** Quando true, o main entrega o port ANTES do invoke resolver (caso real). */
let deliverPortOnStart = true
let deliveredPorts: FakePort[] = []

function deliverPort(): FakePort {
  const port = new FakePort()
  deliveredPorts.push(port)
  for (const listener of listeners) {
    listener({ data: { channel: PORT_CHANNEL }, ports: [port] })
  }
  return port
}

function installGlobals(): void {
  vi.stubGlobal('MediaStreamTrackGenerator', FakeGenerator)
  vi.stubGlobal('AudioData', FakeAudioData)
  vi.stubGlobal('window', {
    addEventListener: (type: string, listener: MessageListener) => {
      if (type === 'message') listeners.add(listener)
    },
    removeEventListener: (type: string, listener: MessageListener) => {
      if (type === 'message') listeners.delete(listener)
    },
    zoi: {
      audioExclusion: {
        start: async (): Promise<unknown> => {
          startCalls += 1
          // O main posta o port durante o invoke: reproduzir essa ordem e o
          // ponto do teste, porque e ela que expoe a corrida.
          if (deliverPortOnStart) deliverPort()
          return startResult
        },
        stop: async (): Promise<void> => {
          stopCalls += 1
        }
      }
    }
  })
}

describe('audio-exclusion client', () => {
  beforeEach(() => {
    written.length = 0
    listeners.clear()
    deliveredPorts = []
    writerClosed = false
    desiredSize = 8
    startCalls = 0
    stopCalls = 0
    deliverPortOnStart = true
    startResult = { mode: 'process-exclusion', sampleRate: 48000, channels: 2 }
    FakeGenerator.instances = []
    installGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('resolve com a track quando o port chega durante o invoke', async () => {
    const outcome = await createAudioExclusionClient().start()

    expect(outcome.reason).toBeNull()
    expect(outcome.session).not.toBeNull()
    expect(FakeGenerator.instances[0]?.kind).toBe('audio')
    expect(outcome.session?.track).toBe(FakeGenerator.instances[0])
    expect(deliveredPorts[0]?.started).toBe(true)
  })

  it('escuta ANTES de chamar o start: o port entregue no meio do invoke nao se perde', async () => {
    // Se o listener fosse registrado depois do invoke, este teste falharia com
    // `activation-failed` (o postMessage nao bufferiza para ouvinte ausente).
    const outcome = await createAudioExclusionClient().start()
    expect(outcome.session).not.toBeNull()
    expect(listeners.size).toBe(1)
  })

  it('transforma cada frame pcm num AudioData de 480 amostras', async () => {
    const outcome = await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port || !outcome.session) throw new Error('a sessao deveria existir')

    port.deliverPcm(0)
    port.deliverPcm(10_000)

    expect(written).toHaveLength(2)
    expect(written[0]).toMatchObject({
      format: 'f32',
      sampleRate: 48000,
      numberOfChannels: 2,
      numberOfFrames: 480,
      timestamp: 0
    })
    expect(written[1]?.timestamp).toBe(10_000)
  })

  it('usa relogio PROPRIO: o timestamp do worker reiniciando nao anda para tras', async () => {
    const outcome = await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port || !outcome.session) throw new Error('a sessao deveria existir')

    // O worker manda tudo com timestamp zero (ou repetido): a track nao pode
    // regredir por causa disso.
    port.deliverPcm(0)
    port.deliverPcm(0)
    port.deliverPcm(0)

    expect(written.map((frame) => frame.timestamp)).toEqual([0, 10_000, 20_000])
  })

  it('aceita port NOVO da cascata sem trocar a track e sem repetir timestamp', async () => {
    const outcome = await createAudioExclusionClient().start()
    const first = deliveredPorts[0]
    if (!first || !outcome.session) throw new Error('a sessao deveria existir')
    first.deliverPcm(0)
    first.deliverPcm(10_000)

    // Re-fork: o main entrega um port novo para a MESMA sessao.
    const second = deliverPort()
    // O worker novo recomeca a contar do zero.
    second.deliverPcm(0)

    expect(first.closed).toBe(true)
    expect(second.started).toBe(true)
    expect(outcome.session.track).toBe(FakeGenerator.instances[0])
    expect(FakeGenerator.instances).toHaveLength(1)
    expect(written.map((frame) => frame.timestamp)).toEqual([0, 10_000, 20_000])
  })

  it('devolve o motivo e limpa o listener quando a exclusao esta indisponivel', async () => {
    startResult = { mode: 'unavailable', reason: 'disabled-by-env' }
    deliverPortOnStart = false

    const outcome = await createAudioExclusionClient().start()

    expect(outcome.session).toBeNull()
    expect(outcome.reason).toBe('disabled-by-env')
    expect(listeners.size).toBe(0)
    expect(FakeGenerator.instances).toHaveLength(0)
  })

  it('port que nunca chega vira activation-failed e desarma o main', async () => {
    vi.useFakeTimers()
    deliverPortOnStart = false

    const pending = createAudioExclusionClient().start()
    await vi.advanceTimersByTimeAsync(5000)
    const outcome = await pending

    expect(outcome.session).toBeNull()
    expect(outcome.reason).toBe('activation-failed')
    expect(stopCalls).toBe(1)
    expect(listeners.size).toBe(0)
  })

  it('stop fecha writer, para a track, solta o port e avisa o main', async () => {
    const outcome = await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port || !outcome.session) throw new Error('a sessao deveria existir')

    outcome.session.stop()

    expect(writerClosed).toBe(true)
    expect(FakeGenerator.instances[0]?.stopped).toBe(true)
    expect(port.closed).toBe(true)
    expect(listeners.size).toBe(0)
    expect(stopCalls).toBe(1)
  })

  it('stop e idempotente e frames atrasados depois dele sao ignorados', async () => {
    const outcome = await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port || !outcome.session) throw new Error('a sessao deveria existir')

    outcome.session.stop()
    outcome.session.stop()
    port.deliverPcm(0)

    expect(stopCalls).toBe(1)
    expect(written).toHaveLength(0)
  })

  it('ignora mensagem que nao e pcm e frame de tamanho invalido', async () => {
    const outcome = await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port || !outcome.session) throw new Error('a sessao deveria existir')

    port.deliver({ type: 'status', state: 'active' })
    port.deliver(null)
    port.deliver({ type: 'pcm' })
    // 100 bytes nao fecha um numero inteiro de amostras estereo float32.
    port.deliverPcm(0, 100)

    expect(written).toHaveLength(0)
  })

  it('descarta o frame quando a fila da track esta cheia (nao acumula atraso)', async () => {
    const outcome = await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port || !outcome.session) throw new Error('a sessao deveria existir')

    port.deliverPcm(0)
    desiredSize = 0
    port.deliverPcm(10_000)
    desiredSize = 4
    port.deliverPcm(20_000)

    // O frame descartado tambem nao pode avancar o relogio da track.
    expect(written.map((frame) => frame.timestamp)).toEqual([0, 10_000])
  })

  it('so chama o start do main uma vez por sessao', async () => {
    await createAudioExclusionClient().start()
    expect(startCalls).toBe(1)
  })
})
