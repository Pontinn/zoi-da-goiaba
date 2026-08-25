// Heartbeat PING/PONG por par, deteccao de queda e janela de reconexao de 15s
// (SPEC secao 2.7). Nao decide nada sobre roster: apenas emite eventos de link
// para o reducer e pede re-dial a camada de sessao.
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  MESH_CONNECT_TIMEOUT_MS,
  RECONNECT_REDIAL_INTERVAL_MS,
  RECONNECT_WINDOW_MS,
  UNREACHABLE_RETRY_INTERVAL_MS
} from '@shared/config'

const TICK_MS = 500

export type LinkPhase = 'connecting' | 'up' | 'reconnecting' | 'unreachable'

export interface ReconnectionCallbacks {
  /** Envia um PING pelo DataChannel do par (a sessao monta o envelope). */
  sendPing(peerId: string, seq: number): void
  /** Abre (ou reabre) a DataConnection com o par. */
  redial(peerId: string): void
  /** Sem PONG por 6s: entra a janela de 15s. */
  onReconnecting(peerId: string): void
  /** Os 15s expiraram sem recuperacao. */
  onReconnectTimeout(peerId: string): void
  /** Par NOVO que nunca fechou a conexao de mesh dentro de 20s (RF-41). */
  onConnectFailed(peerId: string): void
  /** RTT medido para o monitor de qualidade. */
  onRtt(peerId: string, rttMs: number): void
}

interface LinkRecord {
  peerId: string
  phase: LinkPhase
  seq: number
  pending: Map<number, number>
  lastPongAt: number
  lastPingAt: number
  lastRedialAt: number
  deadline: number
  backgroundRetry: boolean
}

export class ReconnectionManager {
  private readonly links = new Map<string, LinkRecord>()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly callbacks: ReconnectionCallbacks,
    private readonly now: () => number = () => Date.now()
  ) {}

  /** Comeca a acompanhar um par novo: 20s para fechar a conexao de mesh. */
  track(peerId: string): void {
    if (this.links.has(peerId)) return
    const now = this.now()
    this.links.set(peerId, {
      peerId,
      phase: 'connecting',
      seq: 0,
      pending: new Map(),
      lastPongAt: now,
      lastPingAt: 0,
      lastRedialAt: now,
      deadline: now + MESH_CONNECT_TIMEOUT_MS,
      backgroundRetry: false
    })
    this.ensureTimer()
  }

  untrack(peerId: string): void {
    this.links.delete(peerId)
    if (this.links.size === 0) this.stopTimer()
  }

  phaseOf(peerId: string): LinkPhase | null {
    return this.links.get(peerId)?.phase ?? null
  }

  /** O DataChannel do par abriu. */
  markOpen(peerId: string): void {
    const now = this.now()
    const link = this.links.get(peerId)
    if (!link) {
      this.track(peerId)
      const created = this.links.get(peerId)
      if (created) {
        created.phase = 'up'
        created.lastPongAt = now
        created.deadline = 0
      }
      return
    }
    link.phase = 'up'
    link.lastPongAt = now
    link.lastPingAt = 0
    link.deadline = 0
    link.pending.clear()
    link.backgroundRetry = false
    this.ensureTimer()
  }

  /** O DataChannel do par fechou: comeca (ou mantem) a janela de 15s. */
  markClosed(peerId: string): void {
    const link = this.links.get(peerId)
    if (!link) return
    if (link.phase === 'reconnecting' || link.phase === 'unreachable') return
    this.beginReconnecting(link)
  }

  /**
   * Par inalcancavel que continua no roster do dono (conectividade assimetrica):
   * retentativa em background a cada 10s enquanto ele permanecer no roster.
   */
  enableBackgroundRetry(peerId: string): void {
    const link = this.links.get(peerId)
    if (!link) return
    link.phase = 'unreachable'
    link.backgroundRetry = true
    link.lastRedialAt = this.now()
    this.ensureTimer()
  }

  handlePong(peerId: string, seq: number): void {
    const link = this.links.get(peerId)
    if (!link) return
    const sentAt = link.pending.get(seq)
    link.pending.delete(seq)
    const now = this.now()
    link.lastPongAt = now
    if (sentAt !== undefined) this.callbacks.onRtt(peerId, now - sentAt)
  }

  destroy(): void {
    this.links.clear()
    this.stopTimer()
  }

  // -------------------------------------------------------------------------

  private beginReconnecting(link: LinkRecord): void {
    const now = this.now()
    link.phase = 'reconnecting'
    link.deadline = now + RECONNECT_WINDOW_MS
    link.lastRedialAt = 0
    link.pending.clear()
    this.callbacks.onReconnecting(link.peerId)
    this.ensureTimer()
  }

  private ensureTimer(): void {
    if (this.timer !== null) return
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  private stopTimer(): void {
    if (this.timer === null) return
    clearInterval(this.timer)
    this.timer = null
  }

  private tick(): void {
    const now = this.now()
    for (const link of [...this.links.values()]) {
      switch (link.phase) {
        case 'connecting':
          if (now >= link.deadline) {
            link.phase = 'unreachable'
            link.backgroundRetry = false
            this.callbacks.onConnectFailed(link.peerId)
          }
          break

        case 'up':
          if (now - link.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
            this.beginReconnecting(link)
            break
          }
          if (now - link.lastPingAt >= HEARTBEAT_INTERVAL_MS) {
            link.lastPingAt = now
            link.seq += 1
            link.pending.set(link.seq, now)
            this.callbacks.sendPing(link.peerId, link.seq)
          }
          break

        case 'reconnecting':
          if (now >= link.deadline) {
            link.phase = 'unreachable'
            this.callbacks.onReconnectTimeout(link.peerId)
            break
          }
          if (now - link.lastRedialAt >= RECONNECT_REDIAL_INTERVAL_MS) {
            link.lastRedialAt = now
            this.callbacks.redial(link.peerId)
          }
          break

        case 'unreachable':
          if (link.backgroundRetry && now - link.lastRedialAt >= UNREACHABLE_RETRY_INTERVAL_MS) {
            link.lastRedialAt = now
            this.callbacks.redial(link.peerId)
          }
          break
      }
    }
  }
}
