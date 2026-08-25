// Corrida de dial simultaneo no mesh. Sem TURN (RF-42) uma das duas direcoes
// pode nunca fechar o ICE, entao a regra deixou de ser "vence a direcao do id
// lexicograficamente menor" e passou a ser "vence a primeira que ABRIR". O
// desempate lexicografico so entra quando as DUAS abrem dentro da janela de
// corrida, para que os dois lados escolham a mesma conexao.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MESH_RACE_GRACE_MS } from '@shared/config'
import { createEnvelope } from '@shared/protocol'
import type { DataConnection } from 'peerjs'
import { Mesh, type MeshDirection } from '@renderer/services/mesh'

type Handler = (arg: never) => void

/** DataConnection falsa: guarda handlers, envios e fechamentos. */
class FakeConnection {
  open = false
  closed = false
  flushed = false
  readonly sent: unknown[] = []
  private readonly handlers = new Map<string, Handler[]>()

  constructor(
    readonly peer: string,
    readonly label: string
  ) {}

  on(event: string, handler: Handler): this {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
    return this
  }

  emit(event: string, arg?: unknown): void {
    for (const handler of [...(this.handlers.get(event) ?? [])]) handler(arg as never)
  }

  /** Abertura do DataChannel, como o peerjs faz: flag primeiro, evento depois. */
  fire(): void {
    this.open = true
    this.emit('open')
  }

  send(payload: unknown): void {
    this.sent.push(payload)
  }

  close(options?: { flush?: boolean }): void {
    if (options?.flush === true) this.flushed = true
    if (this.closed) return
    this.closed = true
    this.open = false
    this.emit('close')
  }
}

interface Harness {
  mesh: Mesh
  opens: string[]
  closes: string[]
  messages: { from: string; type: string }[]
  attach(connection: FakeConnection, direction: MeshDirection): void
}

function makeMesh(selfPeerId: string): Harness {
  const opens: string[] = []
  const closes: string[] = []
  const messages: { from: string; type: string }[] = []
  const mesh = new Mesh({
    onMessage: (from, message) => messages.push({ from, type: message.type }),
    onOpen: (peerId) => opens.push(peerId),
    onClose: (peerId) => closes.push(peerId),
    onInvalid: () => {}
  })
  mesh.setSelfPeerId(selfPeerId)
  return {
    mesh,
    opens,
    closes,
    messages,
    attach: (connection, direction) =>
      mesh.attach(connection as unknown as DataConnection, direction)
  }
}

describe('mesh / corrida de dial simultaneo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('(a) a conexao PREFERIDA abrindo primeiro vira o link do par', () => {
    // self "aaa" < peer "zzz": a preferida e a de SAIDA.
    const harness = makeMesh('aaa')
    const outgoing = new FakeConnection('zzz', 'out')
    const incoming = new FakeConnection('zzz', 'in')
    harness.attach(outgoing, 'outgoing')
    harness.attach(incoming, 'incoming')

    outgoing.fire()
    expect(harness.opens).toEqual(['zzz'])
    expect(harness.mesh.isOpen('zzz')).toBe(true)
    // A perdedora so cai depois da janela de corrida.
    expect(incoming.closed).toBe(false)

    vi.advanceTimersByTime(MESH_RACE_GRACE_MS + 10)
    expect(incoming.closed).toBe(true)
    expect(outgoing.closed).toBe(false)
    expect(harness.closes).toEqual([])
  })

  it('(b) a conexao NAO preferida abrindo primeiro vence (bug do campo)', () => {
    // Regra antiga: a de saida (preferida) ficava e a de entrada era descartada
    // no attach, mesmo quando a de saida nunca fechava o ICE.
    const harness = makeMesh('aaa')
    const outgoing = new FakeConnection('zzz', 'out')
    const incoming = new FakeConnection('zzz', 'in')
    harness.attach(outgoing, 'outgoing')
    harness.attach(incoming, 'incoming')

    // A preferida nunca abre; a outra abre.
    incoming.fire()
    expect(harness.opens).toEqual(['zzz'])

    vi.advanceTimersByTime(MESH_RACE_GRACE_MS + 10)
    expect(outgoing.closed).toBe(true)
    expect(incoming.closed).toBe(false)
    expect(harness.mesh.isOpen('zzz')).toBe(true)
    expect(harness.closes).toEqual([])
  })

  it('(c) as duas abrindo na janela levam os DOIS lados a mesma conexao', () => {
    // Lado "aaa": a conexao iniciada por ele e a de saida.
    const local = makeMesh('aaa')
    const localOut = new FakeConnection('zzz', 'out')
    const localIn = new FakeConnection('zzz', 'in')
    local.attach(localOut, 'outgoing')
    local.attach(localIn, 'incoming')
    localIn.fire()
    localOut.fire()

    // Lado "zzz": a MESMA conexao chega para ele como de entrada.
    const remote = makeMesh('zzz')
    const remoteOut = new FakeConnection('aaa', 'out')
    const remoteIn = new FakeConnection('aaa', 'in')
    remote.attach(remoteOut, 'outgoing')
    remote.attach(remoteIn, 'incoming')
    remoteOut.fire()
    remoteIn.fire()

    // Os dois ficaram com a conexao iniciada por "aaa".
    expect(localOut.closed).toBe(false)
    expect(localIn.closed).toBe(true)
    expect(remoteIn.closed).toBe(false)
    expect(remoteOut.closed).toBe(true)

    // E o par abriu uma unica vez de cada lado, sem nenhuma queda.
    expect(local.opens).toEqual(['zzz'])
    expect(local.closes).toEqual([])
    expect(remote.opens).toEqual(['aaa'])
    expect(remote.closes).toEqual([])
  })

  it('(d) a perdedora fechando nao derruba o par vencedor', () => {
    const harness = makeMesh('aaa')
    const outgoing = new FakeConnection('zzz', 'out')
    const incoming = new FakeConnection('zzz', 'in')
    harness.attach(outgoing, 'outgoing')
    harness.attach(incoming, 'incoming')

    incoming.fire()
    // A perdedora morre sozinha (ICE que nunca fechou) antes do fim da janela.
    outgoing.close()

    expect(harness.closes).toEqual([])
    expect(harness.mesh.isOpen('zzz')).toBe(true)

    // O canal vencedor continua entregando mensagens do par.
    incoming.emit('data', createEnvelope('LEAVE', {}, 'zzz', 0))
    expect(harness.messages).toEqual([{ from: 'zzz', type: 'LEAVE' }])

    // E a queda dele, sim, derruba o par (uma unica vez).
    incoming.close()
    expect(harness.closes).toEqual(['zzz'])
    expect(harness.mesh.has('zzz')).toBe(false)
  })

  it('(e) a fila acumulada sai pela conexao vencedora, sem perder mensagem', () => {
    const harness = makeMesh('aaa')
    const outgoing = new FakeConnection('zzz', 'out')
    const incoming = new FakeConnection('zzz', 'in')
    harness.attach(outgoing, 'outgoing')
    harness.attach(incoming, 'incoming')

    harness.mesh.send('zzz', { type: 'HELLO', payload: { nickname: 'Eu', joinedAt: 1 } })
    expect(outgoing.sent).toEqual([])
    expect(incoming.sent).toEqual([])

    // Quem abre e a NAO preferida: a fila tem que sair por ela.
    incoming.fire()
    expect(incoming.sent).toEqual([
      expect.objectContaining({ type: 'HELLO', from: 'aaa' })
    ])
    expect(outgoing.sent).toEqual([])

    // Depois de aberta, o envio e direto.
    harness.mesh.send('zzz', { type: 'PING', payload: { seq: 1 } })
    expect(incoming.sent).toHaveLength(2)
    expect(outgoing.sent).toEqual([])
  })

  it('conexao que chega com o par JA aberto e descartada na hora', () => {
    const harness = makeMesh('aaa')
    const incoming = new FakeConnection('zzz', 'in')
    harness.attach(incoming, 'incoming')
    incoming.fire()

    const late = new FakeConnection('zzz', 'out')
    harness.attach(late, 'outgoing')

    expect(late.closed).toBe(true)
    expect(harness.opens).toEqual(['zzz'])
    expect(harness.closes).toEqual([])
    expect(harness.mesh.isOpen('zzz')).toBe(true)
  })

  it('a vencedora caindo derruba o par mesmo com candidata ainda negociando', () => {
    const harness = makeMesh('aaa')
    const first = new FakeConnection('zzz', 'in')
    harness.attach(first, 'incoming')
    first.fire()
    expect(harness.opens).toEqual(['zzz'])

    // Segunda oferta chega DEPOIS: com o par aberto ela e descartada na hora.
    // Aqui a candidata nasce antes de a vencedora cair (re-dial em curso).
    harness.mesh.close('zzz')
    const retry = new FakeConnection('zzz', 'out')
    harness.attach(retry, 'outgoing')
    const second = new FakeConnection('zzz', 'in')
    harness.attach(second, 'incoming')

    second.fire()
    // Par aberto de novo, agora pela segunda conexao.
    expect(harness.opens).toEqual(['zzz', 'zzz'])

    second.close()
    // Mesmo com `retry` ainda viva, a queda do canal em uso e anunciada.
    expect(harness.closes).toEqual(['zzz'])
    expect(harness.mesh.isOpen('zzz')).toBe(false)
    expect(harness.mesh.has('zzz')).toBe(true)

    // E quando ela finalmente abre, o par sobe de novo (evento novo).
    retry.fire()
    expect(harness.opens).toEqual(['zzz', 'zzz', 'zzz'])
  })

  it('as duas candidatas caindo sem abrir derrubam o par uma unica vez', () => {
    const harness = makeMesh('aaa')
    const outgoing = new FakeConnection('zzz', 'out')
    const incoming = new FakeConnection('zzz', 'in')
    harness.attach(outgoing, 'outgoing')
    harness.attach(incoming, 'incoming')

    outgoing.close()
    expect(harness.closes).toEqual([])

    incoming.close()
    expect(harness.closes).toEqual(['zzz'])
    expect(harness.mesh.has('zzz')).toBe(false)
  })

  it('close(peerId) derruba TODAS as candidatas do par', () => {
    const harness = makeMesh('aaa')
    const outgoing = new FakeConnection('zzz', 'out')
    const incoming = new FakeConnection('zzz', 'in')
    harness.attach(outgoing, 'outgoing')
    harness.attach(incoming, 'incoming')
    incoming.fire()

    harness.mesh.close('zzz')
    expect(incoming.closed).toBe(true)
    expect(incoming.flushed).toBe(true)
    expect(outgoing.closed).toBe(true)
    // Fechamento deliberado nao vira evento de queda para o resto do app.
    expect(harness.closes).toEqual([])
    expect(harness.mesh.has('zzz')).toBe(false)
  })
})
