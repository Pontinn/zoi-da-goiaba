// Mesh de DataConnections confiaveis (uma por par). Responsavel por: fila de
// envio ate `open`, validacao de envelope contra o peerId REAL da conexao
// (matriz 5c) e fechamento limpo quando o roster remove alguem.
import type { DataConnection } from 'peerjs'
import {
  createEnvelope,
  validateEnvelope,
  type EnvelopeRejectReason,
  type ProtocolMessage
} from '@shared/protocol'

export interface MeshCallbacks {
  /** Mensagem valida recebida de um par (autorizacao fica com o reducer). */
  onMessage(from: string, message: ProtocolMessage): void
  /** DataChannel do par abriu. */
  onOpen(peerId: string): void
  /** DataChannel do par fechou (queda ou fechamento explicito). */
  onClose(peerId: string): void
  /** Envelope descartado pela regra geral da secao 5.A. */
  onInvalid(from: string, reason: EnvelopeRejectReason): void
}

export type MeshDirection = 'outgoing' | 'incoming'

interface MeshEntry {
  connection: DataConnection
  direction: MeshDirection
  queue: unknown[]
  open: boolean
}

export class Mesh {
  private readonly entries = new Map<string, MeshEntry>()
  private selfPeerId = ''

  constructor(private readonly callbacks: MeshCallbacks) {}

  setSelfPeerId(peerId: string): void {
    this.selfPeerId = peerId
  }

  get connectedPeerIds(): string[] {
    return [...this.entries.entries()]
      .filter(([, entry]) => entry.open)
      .map(([peerId]) => peerId)
  }

  isOpen(peerId: string): boolean {
    return this.entries.get(peerId)?.open ?? false
  }

  has(peerId: string): boolean {
    return this.entries.has(peerId)
  }

  /**
   * Conexao vencedora numa corrida de dial simultaneo: sempre a iniciada pelo
   * peer de id lexicograficamente MENOR. Os dois lados calculam o mesmo
   * resultado, entao convergem para a mesma DataConnection sem negociar.
   */
  private preferredDirection(peerId: string): MeshDirection {
    return this.selfPeerId < peerId ? 'outgoing' : 'incoming'
  }

  /** Registra uma DataConnection (de entrada ou de saida) como o link do par. */
  attach(connection: DataConnection, direction: MeshDirection): void {
    const peerId = connection.peer
    const previous = this.entries.get(peerId)

    if (previous && previous.connection !== connection) {
      const preferred = this.preferredDirection(peerId)
      if (previous.direction === preferred && direction !== preferred) {
        // A conexao que ja temos e a vencedora: descarta a recem-chegada.
        connection.close()
        return
      }
      previous.connection.close()
    }

    const entry: MeshEntry = {
      connection,
      direction,
      queue: previous ? [...previous.queue] : [],
      open: false
    }
    this.entries.set(peerId, entry)

    connection.on('open', () => {
      entry.open = true
      for (const payload of entry.queue.splice(0)) {
        connection.send(payload)
      }
      this.callbacks.onOpen(peerId)
    })

    connection.on('data', (raw: unknown) => {
      const result = validateEnvelope(raw, peerId)
      if (!result.ok) {
        this.callbacks.onInvalid(peerId, result.reason)
        return
      }
      this.callbacks.onMessage(result.from, result.message)
    })

    connection.on('close', () => {
      const current = this.entries.get(peerId)
      if (current?.connection !== connection) return
      current.open = false
      this.entries.delete(peerId)
      this.callbacks.onClose(peerId)
    })

    connection.on('error', (error) => {
      console.warn(`[mesh] erro na conexao com ${peerId}:`, error)
    })
  }

  private deliver(entry: MeshEntry, envelope: unknown): void {
    if (!entry.open || !entry.connection.open) {
      entry.queue.push(envelope)
      return
    }
    try {
      entry.connection.send(envelope)
    } catch (error) {
      // Canal caiu entre o check e o envio: a janela de reconexao cuida do resto.
      console.warn(`[mesh] envio falhou para ${entry.connection.peer}:`, error)
    }
  }

  /** Envia para um par especifico; enfileira se o canal ainda nao abriu. */
  send(peerId: string, message: ProtocolMessage): void {
    const entry = this.entries.get(peerId)
    if (!entry) return
    this.deliver(
      entry,
      createEnvelope(message.type, message.payload as never, this.selfPeerId, Date.now())
    )
  }

  /** Serializa o envelope UMA vez e envia para todos os pares conhecidos. */
  broadcast(message: ProtocolMessage, exceptPeerId?: string): void {
    const envelope = createEnvelope(
      message.type,
      message.payload as never,
      this.selfPeerId,
      Date.now()
    )
    for (const [peerId, entry] of this.entries) {
      if (peerId === exceptPeerId) continue
      this.deliver(entry, envelope)
    }
  }

  /**
   * Fecha o link com um par. `flush: true` garante que a ultima mensagem
   * enfileirada (tipicamente o MOD_REMOVE que precede o fechamento) chegue ao
   * outro lado antes do canal cair.
   */
  close(peerId: string): void {
    const entry = this.entries.get(peerId)
    if (!entry) return
    this.entries.delete(peerId)
    entry.connection.close({ flush: true })
  }

  closeAll(): void {
    for (const entry of this.entries.values()) {
      entry.connection.close({ flush: true })
    }
    this.entries.clear()
  }
}
