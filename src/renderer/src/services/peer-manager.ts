// Camada FINA sobre o PeerJS: cria e destroi o member peer (mesh) e o door peer
// (porta de ingresso do dono), e traduz eventos do PeerJS em callbacks do app.
// Nenhuma decisao de sala vive aqui (isso e do reducer puro).
import Peer, { type DataConnection, type MediaConnection, type PeerError } from 'peerjs'
import {
  DOOR_REGISTER_RETRY_INTERVAL_MS,
  DOOR_REGISTER_RETRY_WINDOW_MS,
  PEER_OPTIONS
} from '@shared/config'
import { toPeerId } from '../core/room-code'

export type PeerErrorType = PeerError<string>['type']

export interface PeerManagerCallbacks {
  /** DataConnection de mesh recebida no member peer. */
  onMeshConnection(connection: DataConnection): void
  /** DataConnection efemera recebida no door peer (fluxo de admissao). */
  onDoorConnection(connection: DataConnection): void
  /** Chamada de midia recebida no member peer. */
  onCall(call: MediaConnection): void
  /** Sinalizacao caiu ou voltou (nao derruba o mesh ja estabelecido). */
  onSignalingChange(connected: boolean): void
  /** Erro nao fatal do member peer. */
  onMemberError(type: PeerErrorType, message: string): void
}

export class RoomCodeUnavailableError extends Error {
  constructor(code: string) {
    super(`O codigo "${code}" ja esta em uso.`)
    this.name = 'RoomCodeUnavailableError'
  }
}

export class SignalingError extends Error {
  readonly type: PeerErrorType

  constructor(type: PeerErrorType, message: string) {
    super(message)
    this.name = 'SignalingError'
    this.type = type
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class PeerManager {
  private memberPeer: Peer | null = null
  private doorPeer: Peer | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  constructor(private readonly callbacks: PeerManagerCallbacks) {}

  get memberPeerId(): string {
    return this.memberPeer?.id ?? ''
  }

  get hasDoor(): boolean {
    return this.doorPeer !== null && !this.doorPeer.destroyed
  }

  /** Cria o peer de membro (id aleatorio do servidor) e resolve com o id aberto. */
  async startMemberPeer(): Promise<string> {
    if (this.memberPeer) return this.memberPeer.id

    const peer = new Peer({ ...PEER_OPTIONS })
    this.memberPeer = peer

    const peerId = await new Promise<string>((resolve, reject) => {
      const onOpen = (id: string): void => {
        peer.off('error', onError)
        resolve(id)
      }
      const onError = (error: PeerError<string>): void => {
        peer.off('open', onOpen)
        reject(new SignalingError(error.type, error.message))
      }
      peer.once('open', onOpen)
      peer.once('error', onError)
    })

    peer.on('connection', (connection) => this.callbacks.onMeshConnection(connection))
    peer.on('call', (call) => this.callbacks.onCall(call))
    peer.on('disconnected', () => {
      this.callbacks.onSignalingChange(false)
      this.scheduleSignalingReconnect()
    })
    peer.on('error', (error) => {
      this.callbacks.onMemberError(error.type, error.message)
    })

    return peerId
  }

  /**
   * Registra o door peer com o id derivado do codigo da sala.
   * `mode: 'create'` falha imediatamente em `unavailable-id` (RF-04).
   * `mode: 'takeover'` faz retry com backoff ate 10s, pois o servidor PeerJS leva
   * alguns segundos para liberar o id do dono anterior (risco R5).
   */
  async openDoor(code: string, mode: 'create' | 'takeover'): Promise<void> {
    this.closeDoor()
    const doorId = toPeerId(code)
    const deadline = Date.now() + DOOR_REGISTER_RETRY_WINDOW_MS

    for (;;) {
      if (this.destroyed) return
      try {
        await this.registerDoor(doorId)
        return
      } catch (error) {
        const isTaken = error instanceof SignalingError && error.type === 'unavailable-id'
        if (isTaken && mode === 'create') throw new RoomCodeUnavailableError(code)
        if (!isTaken || Date.now() >= deadline) throw error
        await delay(DOOR_REGISTER_RETRY_INTERVAL_MS)
      }
    }
  }

  private registerDoor(doorId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const peer = new Peer(doorId, { ...PEER_OPTIONS })
      const onOpen = (): void => {
        peer.off('error', onError)
        this.doorPeer = peer
        peer.on('connection', (connection) => this.callbacks.onDoorConnection(connection))
        // O door nunca carrega midia: qualquer chamada e recusada.
        peer.on('call', (call) => call.close())
        peer.on('error', (error) => {
          console.warn('[door] erro no peer da porta:', error.type, error.message)
        })
        resolve()
      }
      const onError = (error: PeerError<string>): void => {
        peer.off('open', onOpen)
        peer.destroy()
        reject(new SignalingError(error.type, error.message))
      }
      peer.once('open', onOpen)
      peer.once('error', onError)
    })
  }

  closeDoor(): void {
    if (!this.doorPeer) return
    this.doorPeer.destroy()
    this.doorPeer = null
  }

  /** Abre uma DataConnection confiavel de mesh com outro membro. */
  connectToMember(peerId: string): DataConnection {
    const peer = this.requireMemberPeer()
    return peer.connect(peerId, { reliable: true, serialization: 'json' })
  }

  /** Abre a DataConnection efemera de ingresso com o door da sala. */
  connectToDoor(code: string): DataConnection {
    const peer = this.requireMemberPeer()
    return peer.connect(toPeerId(code), { reliable: true, serialization: 'json' })
  }

  /** Chamada de midia para um membro, com o txId no metadata (correlacao RF-24). */
  call(peerId: string, stream: MediaStream, metadata: { txId: string }): MediaConnection {
    return this.requireMemberPeer().call(peerId, stream, { metadata })
  }

  destroy(): void {
    this.destroyed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.closeDoor()
    if (this.memberPeer) {
      this.memberPeer.destroy()
      this.memberPeer = null
    }
  }

  private requireMemberPeer(): Peer {
    if (!this.memberPeer) throw new Error('member peer ainda nao foi iniciado')
    return this.memberPeer
  }

  /**
   * Queda da SINALIZACAO: o mesh ja estabelecido segue vivo (ICE e direto), mas
   * novos ingressos ficam indisponiveis ate reconectar. Retry com backoff.
   */
  private scheduleSignalingReconnect(attempt = 0): void {
    if (this.destroyed || !this.memberPeer) return
    const waitMs = Math.min(1_000 * 2 ** attempt, 15_000)
    this.reconnectTimer = setTimeout(() => {
      const peer = this.memberPeer
      if (!peer || peer.destroyed) return
      if (!peer.disconnected) {
        this.callbacks.onSignalingChange(true)
        return
      }
      try {
        peer.reconnect()
      } catch (error) {
        console.warn('[peer] falha ao reconectar a sinalizacao:', error)
      }
      peer.once('open', () => this.callbacks.onSignalingChange(true))
      this.scheduleSignalingReconnect(attempt + 1)
    }, waitMs)
  }
}
