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

  /**
   * Frame com TODAS as amostras em 1. E o unico jeito de ver a rampa: num
   * buffer zerado, um ganho de 0 e um ganho de 1 produzem o mesmo valor.
   */
  deliverOnes(timestampUs: number): void {
    const buffer = new ArrayBuffer(FRAME_BYTES)
    new Float32Array(buffer).fill(1)
    this.onmessage?.({ data: { type: 'pcm', timestampUs, data: buffer } })
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
  /** O buffer entregue, para inspecionar a rampa aplicada no lugar. */
  data: ArrayBuffer
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
  data: ArrayBuffer

  constructor(init: WrittenFrame) {
    this.timestamp = init.timestamp
    this.numberOfFrames = init.numberOfFrames
    this.numberOfChannels = init.numberOfChannels
    this.sampleRate = init.sampleRate
    this.format = init.format
    this.data = init.data
  }
}

type MessageListener = (event: { data: unknown; ports: FakePort[] }) => void

const listeners = new Set<MessageListener>()
let startResult: unknown = { mode: 'process-exclusion', sampleRate: 48000, channels: 2, captureId: 'ax-teste' }
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
    startResult = { mode: 'process-exclusion', sampleRate: 48000, channels: 2, captureId: 'ax-teste' }
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

    // O frame descartado nao e escrito, mas o relogio ANDA sobre o buraco: a
    // terceira entrega sai rotulada 20 000 us (e nao 10 000), porque colar os
    // dois pedacos emendaria formas de onda nao contiguas no tempo real.
    expect(written.map((frame) => frame.timestamp)).toEqual([0, 20_000])
  })

  it('so chama o start do main uma vez por sessao', async () => {
    await createAudioExclusionClient().start()
    expect(startCalls).toBe(1)
  })

  // -------------------------------------------------------------------------
  // Relogio honesto sobre o buraco, rampa de retomada e rate-limit do log.
  //
  // O defeito que estes casos travam: um frame descartado por backpressure nao
  // avancava o relogio, entao o pedaco seguinte era COLADO no anterior e o
  // consumidor recebia duas formas de onda nao contiguas emendadas sem marca
  // nenhuma. Agora o buraco e declarado (com teto) e a retomada sobe do zero.
  // -------------------------------------------------------------------------

  it('o relogio ANDA sobre o buraco: 0, 10 000 e 30 000, nunca 20 000', async () => {
    await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port) throw new Error('o port deveria existir')

    port.deliverPcm(0)
    port.deliverPcm(10_000)
    desiredSize = 0
    port.deliverPcm(20_000)
    desiredSize = 8
    port.deliverPcm(30_000)

    expect(written.map((frame) => frame.timestamp)).toEqual([0, 10_000, 30_000])
  })

  it('sem descarte nenhum, o caminho feliz nao e deslocado', async () => {
    await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port) throw new Error('o port deveria existir')

    for (let index = 0; index < 4; index += 1) port.deliverPcm(index * 10_000)

    expect(written.map((frame) => frame.timestamp)).toEqual([0, 10_000, 20_000, 30_000])
  })

  it('dez descartes seguidos avancam o relogio em 100 ms (abaixo do teto)', async () => {
    await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port) throw new Error('o port deveria existir')

    port.deliverPcm(0)
    desiredSize = 0
    for (let index = 0; index < 10; index += 1) port.deliverPcm(0)
    desiredSize = 8
    port.deliverPcm(0)

    expect(written).toHaveLength(2)
    // 10 ms do proprio frame anterior mais os 100 ms do buraco.
    expect(written[1]!.timestamp - written[0]!.timestamp).toBe(110_000)
  })

  it('o avanco tem TETO: mil descartes pulam 200 ms, e nao 10 s', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port) throw new Error('o port deveria existir')

    port.deliverPcm(0)
    desiredSize = 0
    for (let index = 0; index < 1_000; index += 1) port.deliverPcm(0)
    desiredSize = 8
    port.deliverPcm(0)

    // AUDIO_MAX_SKIP_MS = 200: o buraco declarado para em 200 ms.
    expect(written[1]!.timestamp - written[0]!.timestamp).toBe(210_000)

    // O teto limita o RELOGIO, nunca a contagem: a linha reporta o numero real.
    const dropLines = warn.mock.calls.filter((call) => String(call[0]).startsWith('[audio-drop]'))
    expect(dropLines.length).toBeGreaterThanOrEqual(1)
    expect(String(dropLines[0]![0])).toContain('backpressure: 1 quadros')
    warn.mockRestore()
  })

  it('a escrita seguinte a um descarte entra com rampa de 1 ms', async () => {
    await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port) throw new Error('o port deveria existir')

    port.deliverOnes(0)
    port.deliverOnes(10_000)
    desiredSize = 0
    port.deliverOnes(20_000)
    desiredSize = 8
    port.deliverOnes(30_000)

    const resumed = new Float32Array(written[2]!.data)
    // Quadro 0 (os dois canais) sai exatamente em zero.
    expect(resumed[0]).toBe(0)
    expect(resumed[1]).toBe(0)
    // Quadro 47 ja esta com ganho 1, e o resto do frame fica intacto.
    expect(resumed[47 * 2]).toBe(1)
    expect(resumed[47 * 2 + 1]).toBe(1)
    expect(resumed[48 * 2]).toBe(1)

    // Sem descarte antes dele, o frame do meio nao e tocado.
    expect(new Float32Array(written[1]!.data)[0]).toBe(1)
  })

  it('o PRIMEIRO frame da track tambem nasce de um silencio', async () => {
    await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port) throw new Error('o port deveria existir')

    port.deliverOnes(0)

    const first = new Float32Array(written[0]!.data)
    expect(first[0]).toBe(0)
    expect(first[47 * 2]).toBe(1)
  })

  it('mil descartes consecutivos produzem no maximo 2 linhas de log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port) throw new Error('o port deveria existir')

    desiredSize = 0
    for (let index = 0; index < 1_000; index += 1) port.deliverPcm(0)

    const dropLines = warn.mock.calls.filter((call) => String(call[0]).startsWith('[audio-drop]'))
    expect(dropLines.length).toBeGreaterThanOrEqual(1)
    expect(dropLines.length).toBeLessThanOrEqual(2)
    warn.mockRestore()
  })

  it('o caminho feliz continua MUDO', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port) throw new Error('o port deveria existir')

    for (let index = 0; index < 50; index += 1) port.deliverPcm(index * 10_000)

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('as guardas de payload invalido NAO contam como descarte', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await createAudioExclusionClient().start()
    const port = deliveredPorts[0]
    if (!port) throw new Error('o port deveria existir')

    port.deliverPcm(0)
    port.deliver({ type: 'status', state: 'active' })
    port.deliver({ type: 'pcm' })
    // 100 bytes nao fecha um numero inteiro de amostras estereo float32.
    port.deliverPcm(0, 100)
    port.deliverPcm(0)

    // Nenhuma dessas guardas representa audio perdido: nem log, nem buraco.
    expect(warn).not.toHaveBeenCalled()
    expect(written.map((frame) => frame.timestamp)).toEqual([0, 10_000])
    warn.mockRestore()
  })
})
