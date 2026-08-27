// Ponto UNICO por onde posicao de cursor de espectador entra e sai (RF-12 a
// RF-32). Tres decisoes de desenho valem para o arquivo inteiro:
//
// 1. NADA aqui passa pelo reducer. `dispatch` roda `reduce()`, varre membros e
//    transmissoes e chama `notify()`, o que dispara um ciclo de render do React.
//    A 25 mensagens por segundo POR ESPECTADOR, com ate 7 espectadores, isso
//    seria ate 175 ciclos de render por segundo na mesma maquina que esta
//    codificando video (RNF-01). E o mesmo motivo pelo qual PING/PONG ja nao
//    passa pelo reducer. Beneficio colateral: como nenhuma posicao entra no
//    estado, o carimbo de `txId` das posicoes NAO TEM COMO corromper
//    `transmissions` nem `selfWatchingTxId` (RNF-06), por impossibilidade
//    estrutural e nao por cuidado.
//
// 2. Exatamente DOIS timers e nenhum `requestAnimationFrame`. Um de
//    `CURSOR_SEND_INTERVAL_MS` (40 ms) so para o flush de envio, e um de
//    `POINTER_OVERLAY_FRAME_MS` (33 ms) que e o tick UNICO de saida: recalcula
//    `idle`, alimenta os assinantes de frame, emite o frame agregado por IPC e
//    avisa mudanca de conjunto de ponteiros. Os dois se desarmam sozinhos
//    quando nao ha nada a fazer: a sala parada nao paga timer nenhum.
//
// 3. Este modulo NAO IMPORTA `session.ts`, nem com `import type`. Ele declara a
//    porta `CursorSessionPort` e `Session` a satisfaz estruturalmente. Se o hub
//    importasse `session` e chamasse `attach(session)` em escopo de modulo, um
//    boot que carregasse `session.ts` primeiro bateria em TDZ no
//    `export const session = new Session()` e derrubaria o app com
//    "Cannot access 'session' before initialization". A ligacao dos dois
//    acontece no rodape de `media-manager.ts`, que ja importa `session`, no
//    mesmo molde de `session.setMediaHooks(mediaManager)`.
//
// `../core/room-state` e um reducer PURO (sem PeerJS, DOM ou Electron) e nao
// importa nenhum servico, entao importar VALOR dele nao cria ciclo nem risco de
// TDZ. A proibicao de import vale para `./session`, e so para ele.
import {
  CURSOR_IDLE_MS,
  CURSOR_RECEIVE_MIN_GAP_MS,
  CURSOR_SEND_INTERVAL_MS,
  POINTER_LOG_INTERVAL_MS,
  POINTER_OVERLAY_FRAME_MS
} from '@shared/config'
import type { PointerOverlayFrame } from '@shared/ipc'
import { colorOfSlot, resolvePersonSlots } from '@shared/person-colors'
import type { ProtocolMessage } from '@shared/protocol'
import { nicknameOf, viewerPeerIdsOf, type RoomState } from '../core/room-state'

/** Tolerancia de subpixel: abaixo disso a posicao conta como a MESMA (RF-30). */
const POINT_EPSILON = 0.0005

export interface CursorEntry {
  peerId: string
  x: number
  y: number
  /** epoch ms da ultima posicao recebida. */
  lastAt: number
  /** epoch ms da primeira posicao desta aparicao (dispara a animacao de entrada). */
  enteredAt: number
  /** Parado ha mais de CURSOR_IDLE_MS. */
  idle: boolean
}

/**
 * PORTA para a sessao, declarada AQUI de proposito. `Session` a satisfaz
 * estruturalmente, entao este modulo nao importa `session.ts` e nao existe ciclo
 * nem risco de TDZ no boot.
 */
export interface CursorSessionPort {
  getState(): RoomState
  subscribe(listener: (state: RoomState) => void): () => void
  sendCursor(peerIds: readonly string[], message: ProtocolMessage): void
}

interface PointerOverlayBridge {
  sendFrame(frame: PointerOverlayFrame): void
}

/**
 * Acesso DEFENSIVO a ponte de overlay, no molde de `onSystemResume` da sessao:
 * dentro do Vitest nao existe `window`, e a janela de overlay pode nem estar no
 * ar. Sem esta guarda, so instanciar o hub quebraria o teste unitario.
 */
function pointerOverlayBridge(): PointerOverlayBridge | null {
  if (typeof window === 'undefined') return null
  const api = (window as { zoi?: { pointerOverlay?: PointerOverlayBridge } }).zoi
  return api?.pointerOverlay ?? null
}

export class CursorHub {
  private port: CursorSessionPort | null = null
  private offState: (() => void) | null = null
  private state: RoomState | null = null

  /** txId -> peerId -> posicao. Escopo por transmissao (RF-16). */
  private readonly entriesByTx = new Map<string, Map<string, CursorEntry>>()

  private sendContext: { txId: string | null; enabled: boolean } = { txId: null, enabled: false }
  private overlayContext: { txId: string | null; enabled: boolean } = {
    txId: null,
    enabled: false
  }

  private pendingPoint: { x: number; y: number } | null = null
  private lastSentPoint: { x: number; y: number } | null = null
  /** txId do ultimo CURSOR_END ja enviado; zera a cada posicao nova enviada. */
  private endedTxId: string | null = null

  private readonly lastAcceptedAt = new Map<string, number>()
  private readonly dropCounters = new Map<string, { count: number; loggedAt: number }>()

  private readonly rosterListeners = new Map<string, Set<(peerIds: string[]) => void>>()
  private readonly frameListeners = new Map<
    string,
    Set<(entries: readonly CursorEntry[]) => void>
  >()
  /** Assinatura do ultimo conjunto notificado por txId (peers mais flag idle). */
  private readonly rosterSignature = new Map<string, string>()

  private sendTimer: ReturnType<typeof setInterval> | null = null
  private frameTimer: ReturnType<typeof setInterval> | null = null
  /** Ha mudanca a emitir mesmo sem entrada viva (ultimo frame vazio). */
  private frameDirty = false

  /** Liga a porta e assina o estado. Chamado UMA vez, do rodape de `media-manager.ts`. */
  attach(port: CursorSessionPort): void {
    if (this.offState) this.offState()
    this.port = port
    this.state = port.getState()
    this.offState = port.subscribe((state) => this.onState(state))
  }

  /** Contexto de quem APONTA. `enabled` reune todas as condicoes de 2b.2. */
  setSendContext(context: { txId: string | null; enabled: boolean }): void {
    const previous = this.sendContext
    if (previous.txId === context.txId && previous.enabled === context.enabled) return
    // Trocar de transmissao ou desligar encerra o ponteiro na ANTERIOR (RF-18).
    if (previous.enabled && previous.txId && previous.txId !== context.txId) {
      this.endLocal(previous.txId)
    } else if (previous.enabled && !context.enabled && previous.txId) {
      this.endLocal(previous.txId)
    }
    this.sendContext = { txId: context.txId, enabled: context.enabled }
    if (context.enabled && context.txId) {
      this.startSendTimer()
    } else {
      this.stopSendTimer()
      this.pendingPoint = null
      this.lastSentPoint = null
    }
  }

  /** Uma posicao ja normalizada e validada pela CursorLayer. */
  reportLocalPoint(x: number, y: number): void {
    if (!this.sendContext.enabled || this.sendContext.txId === null) return
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    this.pendingPoint = { x, y }
    this.startSendTimer()
  }

  /** Encerra o ponteiro local naquele txId (os SEIS gatilhos de 2b.2). */
  endLocal(txId?: string): void {
    const target = txId ?? this.sendContext.txId
    if (!target) return
    this.pendingPoint = null
    this.lastSentPoint = null
    if (this.endedTxId === target) return
    this.endedTxId = target
    const recipients = this.recipientsOf(target)
    if (recipients.length === 0) return
    this.port?.sendCursor(recipients, { type: 'CURSOR_END', payload: { txId: target } })
  }

  /** Entrada vinda do mesh; as checagens da matriz 5c acontecem AQUI. */
  applyRemote(from: string, message: ProtocolMessage): void {
    if (message.type === 'CURSOR_MOVE') {
      this.applyRemoteMove(from, message.payload.txId, message.payload.x, message.payload.y)
      return
    }
    if (message.type === 'CURSOR_END') {
      this.applyRemoteEnd(from, message.payload.txId)
    }
  }

  /** Conjunto de peers com ponteiro visivel neste txId. BAIXA frequencia. */
  subscribeRoster(txId: string, listener: (peerIds: string[]) => void): () => void {
    const set = this.rosterListeners.get(txId) ?? new Set<(peerIds: string[]) => void>()
    set.add(listener)
    this.rosterListeners.set(txId, set)
    // Entrega imediata do estado corrente: quem assina no meio de uma sessao
    // precisa saber dos ponteiros que ja existem.
    listener(this.peerIdsOf(txId))
    return () => {
      const current = this.rosterListeners.get(txId)
      if (!current) return
      current.delete(listener)
      if (current.size === 0) {
        this.rosterListeners.delete(txId)
        this.rosterSignature.delete(txId)
      }
    }
  }

  /** Posicoes a cada POINTER_OVERLAY_FRAME_MS. ALTA frequencia, imperativo. */
  subscribeFrame(txId: string, listener: (entries: readonly CursorEntry[]) => void): () => void {
    const set =
      this.frameListeners.get(txId) ?? new Set<(entries: readonly CursorEntry[]) => void>()
    set.add(listener)
    this.frameListeners.set(txId, set)
    return () => {
      const current = this.frameListeners.get(txId)
      if (!current) return
      current.delete(listener)
      if (current.size === 0) this.frameListeners.delete(txId)
    }
  }

  /** Contexto de quem TRANSMITE: liga o envio do frame agregado por IPC. */
  setOverlayContext(context: { txId: string | null; enabled: boolean }): void {
    this.overlayContext = { txId: context.txId, enabled: context.enabled }
    if (context.enabled && context.txId) {
      this.frameDirty = true
      this.startFrameTimer()
    }
  }

  /** Limpa entradas, timers e listeners. PRESERVA a porta e a assinatura. */
  reset(): void {
    this.stopSendTimer()
    this.stopFrameTimer()
    this.entriesByTx.clear()
    this.rosterListeners.clear()
    this.frameListeners.clear()
    this.rosterSignature.clear()
    this.lastAcceptedAt.clear()
    this.dropCounters.clear()
    this.sendContext = { txId: null, enabled: false }
    this.overlayContext = { txId: null, enabled: false }
    this.pendingPoint = null
    this.lastSentPoint = null
    this.endedTxId = null
    this.frameDirty = false
  }

  /** So para teste: alem do `reset`, zera a porta. Nunca chamado em runtime. */
  dispose(): void {
    this.reset()
    if (this.offState) this.offState()
    this.offState = null
    this.port = null
    this.state = null
  }

  /** Leitura pura para o gancho `__zoiDebugMedia.cursors()`. */
  debugSnapshot(): Record<string, CursorEntry[]> {
    const snapshot: Record<string, CursorEntry[]> = {}
    for (const [txId, entries] of this.entriesByTx) {
      snapshot[txId] = [...entries.values()].map((entry) => ({ ...entry }))
    }
    return snapshot
  }

  // --- estado da sala ------------------------------------------------------

  /**
   * Baixa frequencia: guarda o estado para as checagens de 5c, poda ponteiro de
   * quem saiu do roster (RF-29) e poda transmissao que sumiu ou que desligou os
   * ponteiros (RF-27).
   */
  private onState(state: RoomState): void {
    this.state = state
    const alive = new Set(state.members.map((member) => member.peerId))
    let changed = false
    for (const [txId, entries] of [...this.entriesByTx]) {
      const transmission = state.transmissions[txId]
      if (!transmission || !transmission.pointersEnabled) {
        this.entriesByTx.delete(txId)
        changed = true
        continue
      }
      for (const peerId of [...entries.keys()]) {
        if (!alive.has(peerId)) {
          entries.delete(peerId)
          changed = true
        }
      }
      if (entries.size === 0) this.entriesByTx.delete(txId)
    }
    if (changed) {
      this.frameDirty = true
      this.startFrameTimer()
    }
  }

  // --- envio ---------------------------------------------------------------

  private recipientsOf(txId: string): string[] {
    const state = this.state
    if (!state) return []
    const ids = new Set(viewerPeerIdsOf(state, txId))
    const owner = state.transmissions[txId]?.peerId
    if (owner) ids.add(owner)
    ids.delete(state.selfPeerId)
    return [...ids]
  }

  private flush(): void {
    const { txId, enabled } = this.sendContext
    if (!enabled || txId === null) return
    const point = this.pendingPoint
    if (!point) return
    const last = this.lastSentPoint
    if (
      last &&
      Math.abs(last.x - point.x) <= POINT_EPSILON &&
      Math.abs(last.y - point.y) <= POINT_EPSILON
    ) {
      return
    }
    const recipients = this.recipientsOf(txId)
    if (recipients.length === 0) return
    this.port?.sendCursor(recipients, {
      type: 'CURSOR_MOVE',
      payload: { txId, x: point.x, y: point.y }
    })
    this.lastSentPoint = point
    this.endedTxId = null
  }

  // --- recebimento (matriz 5c) --------------------------------------------

  private applyRemoteMove(from: string, txId: string, x: number, y: number): void {
    const state = this.state
    if (!state) return
    // (1) remetente no roster
    if (!state.members.some((member) => member.peerId === from)) return this.countDrop(from)
    // (2) a transmissao existe
    const transmission = state.transmissions[txId]
    if (!transmission) return this.countDrop(from)
    // (3) os ponteiros estao ligados nela
    if (!transmission.pointersEnabled) return this.countDrop(from)
    // (4) o remetente E espectador daquela transmissao
    if (state.watching[from] !== txId) return this.countDrop(from)
    // (5) o receptor participa daquela transmissao
    if (!this.selfParticipatesIn(state, txId)) return this.countDrop(from)
    // (6) faixa valida, SEM clamp
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return this.countDrop(from)
    // (7) nunca a propria posicao de volta
    if (from === state.selfPeerId) return this.countDrop(from)
    // (8) piso de intervalo por peer, contra enxurrada
    const now = Date.now()
    const previous = this.lastAcceptedAt.get(from)
    if (previous !== undefined && now - previous < CURSOR_RECEIVE_MIN_GAP_MS) {
      return this.countDrop(from)
    }
    this.lastAcceptedAt.set(from, now)

    const entries = this.entriesByTx.get(txId) ?? new Map<string, CursorEntry>()
    this.entriesByTx.set(txId, entries)
    const existing = entries.get(from)
    if (existing) {
      existing.x = x
      existing.y = y
      existing.lastAt = now
      existing.idle = false
    } else {
      entries.set(from, { peerId: from, x, y, lastAt: now, enteredAt: now, idle: false })
    }
    this.frameDirty = true
    this.startFrameTimer()
  }

  private applyRemoteEnd(from: string, txId: string): void {
    const state = this.state
    if (!state) return
    // As mesmas checagens de CURSOR_MOVE, MENOS (3) e (4): um CURSOR_END precisa
    // ser aceito justamente quando o remetente ja parou de assistir (RF-18) ou
    // quando o toggle ja desligou.
    if (!state.members.some((member) => member.peerId === from)) return this.countDrop(from)
    if (!state.transmissions[txId]) return this.countDrop(from)
    if (!this.selfParticipatesIn(state, txId)) return this.countDrop(from)
    if (from === state.selfPeerId) return this.countDrop(from)

    const entries = this.entriesByTx.get(txId)
    if (!entries || !entries.delete(from)) return
    if (entries.size === 0) this.entriesByTx.delete(txId)
    this.frameDirty = true
    this.startFrameTimer()
  }

  private selfParticipatesIn(state: RoomState, txId: string): boolean {
    if (state.transmissions[txId]?.peerId === state.selfPeerId) return true
    return state.selfWatchingTxId === txId
  }

  /**
   * Descarte SILENCIOSO com contador. Nunca `closeConnection`, nunca
   * `rejectFrom`, nunca um `console` por mensagem: a 25 Hz isso encheria o log
   * do dia e derrubaria a legibilidade do diagnostico de campo.
   */
  private countDrop(peerId: string): void {
    const counter = this.dropCounters.get(peerId)
    if (counter) counter.count += 1
    else this.dropCounters.set(peerId, { count: 1, loggedAt: 0 })
  }

  // --- tick unico de saida -------------------------------------------------

  private frameTick(): void {
    const now = Date.now()
    const hasEntries = this.recomputeIdle(now)
    this.emitFrames()
    this.emitOverlayFrame()
    this.emitRosterChanges()
    this.flushDropLog(now)
    const keep = hasEntries || this.frameDirty || this.overlayContext.enabled
    this.frameDirty = false
    if (!keep) this.stopFrameTimer()
  }

  private recomputeIdle(now: number): boolean {
    let hasEntries = false
    for (const entries of this.entriesByTx.values()) {
      for (const entry of entries.values()) {
        hasEntries = true
        // Relogio do sistema andando para tras: `lastAt > now` viraria um
        // ponteiro eterno. Tratar o absurdo como idle e a saida segura.
        const idle = now - entry.lastAt >= CURSOR_IDLE_MS || entry.lastAt > now
        if (idle !== entry.idle) {
          entry.idle = idle
          this.frameDirty = true
        }
      }
    }
    return hasEntries
  }

  private emitFrames(): void {
    for (const [txId, listeners] of this.frameListeners) {
      const entries = [...(this.entriesByTx.get(txId)?.values() ?? [])]
      for (const listener of listeners) listener(entries)
    }
  }

  private emitOverlayFrame(): void {
    const { txId, enabled } = this.overlayContext
    if (!enabled || txId === null) return
    const bridge = pointerOverlayBridge()
    if (!bridge) return
    const state = this.state
    const entries = [...(this.entriesByTx.get(txId)?.values() ?? [])]
    const slots = state ? resolvePersonSlots(state.members) : {}
    const frame: PointerOverlayFrame = {
      txId,
      pointers: entries.map((entry) => ({
        peerId: entry.peerId,
        nickname: state ? nicknameOf(state, entry.peerId) : entry.peerId.slice(0, 6),
        fill: colorOfSlot(slots[entry.peerId] ?? 0).fill,
        x: entry.x,
        y: entry.y,
        idle: entry.idle
      }))
    }
    bridge.sendFrame(frame)
  }

  private peerIdsOf(txId: string): string[] {
    return [...(this.entriesByTx.get(txId)?.keys() ?? [])]
  }

  private emitRosterChanges(): void {
    for (const [txId, listeners] of this.rosterListeners) {
      const entries = this.entriesByTx.get(txId)
      const signature = [...(entries?.values() ?? [])]
        .map((entry) => `${entry.peerId}:${entry.idle ? '1' : '0'}`)
        .join('|')
      if (this.rosterSignature.get(txId) === signature) continue
      this.rosterSignature.set(txId, signature)
      const peerIds = this.peerIdsOf(txId)
      for (const listener of listeners) listener(peerIds)
    }
  }

  private flushDropLog(now: number): void {
    for (const [peerId, counter] of this.dropCounters) {
      if (counter.count === 0) continue
      if (now - counter.loggedAt < POINTER_LOG_INTERVAL_MS) continue
      console.warn(`[pointer] ${counter.count} posicao(oes) descartada(s) de ${peerId}`)
      counter.count = 0
      counter.loggedAt = now
    }
  }

  // --- timers --------------------------------------------------------------

  private startSendTimer(): void {
    if (this.sendTimer !== null) return
    this.sendTimer = setInterval(() => this.flush(), CURSOR_SEND_INTERVAL_MS)
  }

  private stopSendTimer(): void {
    if (this.sendTimer === null) return
    clearInterval(this.sendTimer)
    this.sendTimer = null
  }

  private startFrameTimer(): void {
    if (this.frameTimer !== null) return
    this.frameTimer = setInterval(() => this.frameTick(), POINTER_OVERLAY_FRAME_MS)
  }

  private stopFrameTimer(): void {
    if (this.frameTimer === null) return
    clearInterval(this.frameTimer)
    this.frameTimer = null
  }
}

export const cursorHub = new CursorHub()
