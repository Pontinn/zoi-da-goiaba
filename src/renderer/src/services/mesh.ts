// Mesh de DataConnections confiaveis (um LINK LOGICO por par). Responsavel por:
// fila de envio ate `open`, corrida de dial simultaneo, validacao de envelope
// contra o peerId REAL da conexao (matriz 5c) e fechamento limpo quando o roster
// remove alguem.
//
// Corrida de dial: quando os dois lados discam ao mesmo tempo nascem DUAS
// conexoes fisicas para o mesmo par. Sem TURN (RF-42) uma das duas direcoes pode
// simplesmente nunca fechar o ICE, entao descartar a "perdedora" na hora do
// attach (regra antiga) fazia o app insistir justamente na direcao quebrada. A
// regra agora e "primeira que ABRIR vence": as duas ficam vivas ate uma abrir.
import type { DataConnection } from 'peerjs'
import { MESH_RACE_GRACE_MS } from '@shared/config'
import {
  createEnvelope,
  validateEnvelope,
  type EnvelopeRejectReason,
  type ProtocolMessage
} from '@shared/protocol'
import { observePeerJsIce, shortPeerId } from './ice-diagnostics'

export interface MeshCallbacks {
  /** Mensagem valida recebida de um par (autorizacao fica com o reducer). */
  onMessage(from: string, message: ProtocolMessage): void
  /** O link logico do par abriu (uma vez por par, nao por conexao fisica). */
  onOpen(peerId: string): void
  /** O link logico do par caiu (queda ou fechamento explicito). */
  onClose(peerId: string): void
  /** Envelope descartado pela regra geral da secao 5.A. */
  onInvalid(from: string, reason: EnvelopeRejectReason): void
}

export type MeshDirection = 'outgoing' | 'incoming'

/** Uma conexao fisica candidata a virar o link do par. */
interface MeshLink {
  connection: DataConnection
  direction: MeshDirection
  open: boolean
  /** Descarte do diagnostico de ICE desta conexao. */
  disposeIce: () => void
}

/** O link LOGICO do par: uma ou duas conexoes fisicas disputando. */
interface MeshEntry {
  links: MeshLink[]
  /** Conexao em uso; null enquanto nenhuma abriu. */
  active: MeshLink | null
  queue: unknown[]
  /** Ja avisamos o resto do app que este par abriu? */
  announced: boolean
  /** Fim da janela de corrida (fecha as perdedoras). */
  raceTimer: ReturnType<typeof setTimeout> | null
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
      .filter(([, entry]) => entry.active !== null)
      .map(([peerId]) => peerId)
  }

  isOpen(peerId: string): boolean {
    const entry = this.entries.get(peerId)
    return entry !== undefined && entry.active !== null
  }

  has(peerId: string): boolean {
    return this.entries.has(peerId)
  }

  /**
   * Desempate quando as DUAS conexoes de um par abrem dentro da janela de
   * corrida: fica a iniciada pelo peer de id lexicograficamente MENOR. Os dois
   * lados calculam o mesmo resultado, entao convergem sem negociar.
   */
  private preferredDirection(peerId: string): MeshDirection {
    return this.selfPeerId < peerId ? 'outgoing' : 'incoming'
  }

  /** Registra uma DataConnection (de entrada ou de saida) como candidata do par. */
  attach(connection: DataConnection, direction: MeshDirection): void {
    const peerId = connection.peer
    let entry = this.entries.get(peerId)

    if (!entry) {
      entry = { links: [], active: null, queue: [], announced: false, raceTimer: null }
      this.entries.set(peerId, entry)
    }

    // Re-attach da MESMA conexao (re-dial que devolveu o objeto existente).
    if (entry.links.some((link) => link.connection === connection)) return

    // Ja existe link ABERTO: a corrida acabou e quem chega agora e descartado.
    if (entry.active !== null) {
      connection.close()
      return
    }

    const link: MeshLink = {
      connection,
      direction,
      open: false,
      disposeIce: observePeerJsIce(
        connection,
        `mesh-${direction === 'outgoing' ? 'out' : 'in'}:${shortPeerId(peerId)}`
      )
    }
    entry.links.push(link)

    connection.on('open', () => this.handleLinkOpen(peerId, link))

    connection.on('data', (raw: unknown) => {
      const result = validateEnvelope(raw, peerId)
      if (!result.ok) {
        this.callbacks.onInvalid(peerId, result.reason)
        return
      }
      this.callbacks.onMessage(result.from, result.message)
    })

    connection.on('close', () => this.handleLinkDown(peerId, link))

    connection.on('error', (error) => {
      console.warn(`[mesh] erro na conexao com ${peerId}:`, error)
    })
  }

  /** Uma das conexoes candidatas abriu. */
  private handleLinkOpen(peerId: string, link: MeshLink): void {
    const entry = this.entries.get(peerId)
    // Entrada ja descartada (close/redial): a conexao nao serve mais a ninguem.
    if (!entry || !entry.links.includes(link)) {
      link.disposeIce()
      link.connection.close()
      return
    }
    link.open = true

    if (entry.active === null) {
      this.promote(peerId, entry, link)
      // A perdedora fica viva por mais um instante: se ela tambem abrir, o
      // desempate lexicografico faz os DOIS lados escolherem a mesma conexao.
      this.scheduleRaceEnd(peerId, entry)
      return
    }

    // As duas abriram dentro da janela: decide quem fica, igual nos dois lados.
    const preferred = this.preferredDirection(peerId)
    if (entry.active.direction !== preferred && link.direction === preferred) {
      const loser = entry.active
      this.promote(peerId, entry, link)
      this.discard(entry, loser)
      return
    }
    this.discard(entry, link)
  }

  /** Torna `link` o canal ativo do par e escoa a fila acumulada. */
  private promote(peerId: string, entry: MeshEntry, link: MeshLink): void {
    entry.active = link
    for (const payload of entry.queue.splice(0)) {
      this.write(link, payload)
    }
    if (entry.announced) return
    entry.announced = true
    this.callbacks.onOpen(peerId)
  }

  /**
   * Fim da janela de corrida: a vencedora esta aberta, entao as candidatas que
   * nao abriram podem cair sem risco de derrubar o par dos dois lados.
   */
  private scheduleRaceEnd(peerId: string, entry: MeshEntry): void {
    if (entry.raceTimer !== null || entry.links.length < 2) return
    entry.raceTimer = setTimeout(() => {
      entry.raceTimer = null
      if (this.entries.get(peerId) !== entry || entry.active === null) return
      for (const link of [...entry.links]) {
        if (link !== entry.active) this.discard(entry, link)
      }
    }, MESH_RACE_GRACE_MS)
  }

  /** Fecha uma conexao PERDEDORA sem mexer no estado do par. */
  private discard(entry: MeshEntry, link: MeshLink): void {
    if (link === entry.active) return
    entry.links = entry.links.filter((current) => current !== link)
    link.disposeIce()
    link.connection.close()
  }

  /** Uma das conexoes candidatas caiu. */
  private handleLinkDown(peerId: string, link: MeshLink): void {
    const entry = this.entries.get(peerId)
    if (!entry || !entry.links.includes(link)) return
    link.open = false
    link.disposeIce()
    entry.links = entry.links.filter((current) => current !== link)

    let logicalDown = false
    if (entry.active === link) {
      entry.active = null
      // Se a outra candidata ja estava aberta, ela assume sem avisar ninguem: o
      // link LOGICO do par nunca chegou a cair.
      const survivor = entry.links.find((current) => current.open)
      if (survivor) {
        this.promote(peerId, entry, survivor)
        return
      }
      // Caiu o canal em uso e nao ha substituto pronto: o par CAIU, mesmo que
      // ainda exista candidata negociando.
      entry.announced = false
      logicalDown = true
    } else if (entry.active !== null) {
      // Perdedora caindo nao derruba o par (semantica do guard antigo).
      return
    }

    if (entry.links.length === 0) {
      this.dropEntry(peerId, entry)
      this.callbacks.onClose(peerId)
      return
    }
    // Sobrou candidata tentando abrir: a entrada (e a fila) continua de pe.
    if (logicalDown) this.callbacks.onClose(peerId)
  }

  /** Remove a entrada e solta timers e diagnosticos dela. */
  private dropEntry(peerId: string, entry: MeshEntry): void {
    if (this.entries.get(peerId) === entry) this.entries.delete(peerId)
    if (entry.raceTimer !== null) {
      clearTimeout(entry.raceTimer)
      entry.raceTimer = null
    }
    entry.active = null
    for (const link of entry.links.splice(0)) link.disposeIce()
  }

  private write(link: MeshLink, envelope: unknown): void {
    try {
      link.connection.send(envelope)
    } catch (error) {
      // Canal caiu entre o check e o envio: a janela de reconexao cuida do resto.
      console.warn(`[mesh] envio falhou para ${link.connection.peer}:`, error)
    }
  }

  private deliver(entry: MeshEntry, envelope: unknown): void {
    const active = entry.active
    if (!active || !active.connection.open) {
      entry.queue.push(envelope)
      return
    }
    this.write(active, envelope)
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
    const links = [...entry.links]
    this.dropEntry(peerId, entry)
    for (const link of links) {
      // `flush` so faz sentido em canal ABERTO: num canal que nunca abriu (re-dial
      // de par caido) o peerjs tenta enviar assim mesmo e loga erro.
      if (link.connection.open) link.connection.close({ flush: true })
      else link.connection.close()
    }
  }

  closeAll(): void {
    for (const [peerId, entry] of [...this.entries]) {
      const links = [...entry.links]
      this.dropEntry(peerId, entry)
      for (const link of links) link.connection.close({ flush: true })
    }
    this.entries.clear()
  }
}
