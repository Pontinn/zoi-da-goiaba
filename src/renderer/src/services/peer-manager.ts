// Camada FINA sobre o PeerJS: cria e destroi o member peer (mesh) e o door peer
// (porta de ingresso do dono), e traduz eventos do PeerJS em callbacks do app.
// Nenhuma decisao de sala vive aqui (isso e do reducer puro).
//
// Alem disso, e o dono da SAUDE DA SINALIZACAO (SPEC secao 2.7, item 1). O
// servidor publico do PeerJS derruba conexoes ociosas e a maquina pode dormir ou
// perder a rede por instantes. Quando isso acontece o PeerJS emite `disconnected`
// e o id do peer deixa de existir no servidor. Sem reconectar, o door peer do
// dono some da sinalizacao PARA SEMPRE: o mesh ja estabelecido continua vivo
// (ICE e direto) e a sala parece saudavel, mas ninguem mais consegue entrar
// ("Sala nao encontrada." do lado de quem tenta). Por isso:
//   - `disconnected` -> `reconnect()` com backoff, nos DOIS peers;
//   - reconnect que falha em definitivo -> door peer recriado e re-registrado;
//   - verificacao periodica (e sob demanda, ao voltar de suspensao) para o caso
//     de o evento nunca chegar (queda silenciosa do websocket).
import Peer, { type DataConnection, type MediaConnection, type PeerError } from 'peerjs'
import {
  DOOR_RECOVERY_MAX_BACKOFF_MS,
  DOOR_RECOVERY_WARN_AFTER_MS,
  DOOR_REGISTER_RETRY_INTERVAL_MS,
  DOOR_REGISTER_RETRY_WINDOW_MS,
  PEER_OPTIONS,
  SIGNALING_HEALTH_CHECK_INTERVAL_MS,
  SIGNALING_RECONNECT_MAX_BACKOFF_MS,
  SIGNALING_RECONNECT_TIMEOUT_MS
} from '@shared/config'
import { toPeerId } from '../core/room-code'
import { observeSignalingCandidates } from './ice-diagnostics'

/** Metadata de uma chamada de midia. `pull` = o espectador e quem discou. */
export interface CallMetadata {
  txId: string
  pull?: boolean
}

export type PeerErrorType = PeerError<string>['type']

/**
 * Estado da porta da sala do ponto de vista da SINALIZACAO:
 * `closed` (nao ha porta sob responsabilidade deste app), `open` (id registrado),
 * `recovering` (caiu e esta sendo re-registrada) e `failed` (segue caindo depois
 * de `DOOR_RECOVERY_WARN_AFTER_MS`, ou seja, o dono precisa saber).
 */
export type DoorHealth = 'closed' | 'open' | 'recovering' | 'failed'

export interface PeerManagerCallbacks {
  /** DataConnection de mesh recebida no member peer. */
  onMeshConnection(connection: DataConnection): void
  /** DataConnection efemera recebida no door peer (fluxo de admissao). */
  onDoorConnection(connection: DataConnection): void
  /** Chamada de midia recebida no member peer. */
  onCall(call: MediaConnection): void
  /** Sinalizacao caiu ou voltou (nao derruba o mesh ja estabelecido). */
  onSignalingChange(connected: boolean): void
  /** Mudou o estado de registro do door peer (so o dono tem door). */
  onDoorHealth(health: DoorHealth): void
  /** Erro nao fatal do member peer. */
  onMemberError(type: PeerErrorType, message: string): void
}

/** Fabrica de `Peer` (injetavel nos testes). `null` = id sorteado pelo servidor. */
export type PeerFactory = (id: string | null) => Peer

const defaultPeerFactory: PeerFactory = (id) =>
  id === null ? new Peer({ ...PEER_OPTIONS }) : new Peer(id, { ...PEER_OPTIONS })

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

/** Backoff exponencial com teto; a tentativa 0 e imediata (evento ja confirmou a queda). */
function backoffMs(attempt: number, maxMs: number): number {
  if (attempt <= 0) return 0
  return Math.min(1_000 * 2 ** (attempt - 1), maxMs)
}

/** O peer perdeu (ou nunca teve) registro valido no servidor de sinalizacao. */
function isUnregistered(peer: Peer | null): boolean {
  if (!peer) return true
  return peer.destroyed || peer.disconnected || !peer.open
}

function stamp(): string {
  return new Date().toISOString().slice(11, 23)
}

export class PeerManager {
  private memberPeer: Peer | null = null
  private doorPeer: Peer | null = null
  /** Codigo da sala cuja porta e responsabilidade deste app (null = sem porta). */
  private doorCode: string | null = null
  private doorHealth: DoorHealth = 'closed'
  private doorRecovering = false
  /** Serializa registro e recuperacao: dois registros paralelos se destruiriam. */
  private doorOperation: Promise<unknown> | null = null
  /** Descartes do contador de CANDIDATE na sinalizacao (diagnostico puro). */
  private disposeMemberSignaling: (() => void) | null = null
  private disposeDoorSignaling: (() => void) | null = null
  private memberReconnectTimer: ReturnType<typeof setTimeout> | null = null
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private lastHealthTickAt = 0
  /**
   * Saida VOLUNTARIA em andamento (sair da sala, fechar o app). `peer.destroy()`
   * emite `disconnected` por dentro: sem esta trava o usuario veria o aviso de
   * "conexao caiu, reconectando..." justamente ao clicar em Sair.
   */
  private disposing = false

  constructor(
    private readonly callbacks: PeerManagerCallbacks,
    private readonly createPeer: PeerFactory = defaultPeerFactory
  ) {}

  get memberPeerId(): string {
    return this.memberPeer?.id ?? ''
  }

  /** Ha uma porta sob responsabilidade deste app (aberta ou em recuperacao). */
  get hasDoor(): boolean {
    return this.doorCode !== null
  }

  get doorStatus(): DoorHealth {
    return this.doorHealth
  }

  /** Cria o peer de membro (id aleatorio do servidor) e resolve com o id aberto. */
  async startMemberPeer(): Promise<string> {
    if (this.memberPeer) return this.memberPeer.id
    // Sessao nova depois de um `reset()`: a trava de saida volta ao normal (os
    // eventos atrasados do peer antigo continuam ignorados pela identidade).
    this.disposing = false

    const peer = this.createPeer(null)
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
    this.disposeMemberSignaling = observeSignalingCandidates(peer, 'member')

    // `open` volta a ser emitido a cada reconexao bem-sucedida: e a confirmacao
    // de que a sinalizacao voltou (um unico listener, registrado aqui).
    peer.on('open', () => {
      if (peer !== this.memberPeer) return
      console.info(`[peer ${stamp()}] member open (${peer.id})`)
      this.clearMemberReconnectTimer()
      if (!this.disposing) this.callbacks.onSignalingChange(true)
    })

    peer.on('disconnected', () => {
      if (peer !== this.memberPeer || this.disposing) return
      console.warn(`[peer ${stamp()}] member disconnected da sinalizacao`)
      this.callbacks.onSignalingChange(false)
      this.scheduleMemberReconnect(0)
    })

    peer.on('close', () => {
      if (peer !== this.memberPeer || this.disposing) return
      console.warn(`[peer ${stamp()}] member peer destruido pelo PeerJS`)
      this.callbacks.onSignalingChange(false)
    })

    peer.on('error', (error) => {
      this.callbacks.onMemberError(error.type, error.message)
      if (this.disposing || peer !== this.memberPeer) return
      // `network` e as falhas de socket significam servidor inalcancavel: o
      // PeerJS ja marca o peer como desconectado, so falta insistir.
      if (error.type === 'network' || error.type === 'socket-error') {
        this.scheduleMemberReconnect(0)
      }
    })

    console.info(`[peer ${stamp()}] member peer registrado (${peerId})`)
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
    this.doorCode = code
    try {
      await this.runDoorOperation(() => this.registerWithRetry(code, mode))
      this.setDoorHealth('open')
    } catch (error) {
      // Criacao que falha nao deixa porta pendurada: nao existe sala nenhuma.
      // No takeover a porta continua sendo responsabilidade deste app e a
      // verificacao periodica segue tentando reabri-la.
      if (mode === 'create') {
        this.doorCode = null
        this.setDoorHealth('closed')
      } else {
        this.setDoorHealth('failed')
        this.ensureDoorHealthy()
      }
      throw error
    }
  }

  /** Libera a porta de forma DELIBERADA (transferencia de posse, saida da sala). */
  closeDoor(): void {
    this.doorCode = null
    this.disposeDoorPeer()
    this.setDoorHealth('closed')
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
  call(peerId: string, stream: MediaStream, metadata: CallMetadata): MediaConnection {
    return this.requireMemberPeer().call(peerId, stream, { metadata })
  }

  // --- saude da sinalizacao -------------------------------------------------

  /** Liga a verificacao periodica (idempotente). */
  startHealthChecks(): void {
    if (this.healthTimer !== null || this.disposing) return
    this.lastHealthTickAt = Date.now()
    this.healthTimer = setInterval(() => {
      const now = Date.now()
      const gap = now - this.lastHealthTickAt
      this.lastHealthTickAt = now
      // Salto grande no relogio = a maquina dormiu (ou a aba congelou): os
      // eventos do websocket podem ter se perdido no caminho.
      if (gap > SIGNALING_HEALTH_CHECK_INTERVAL_MS * 2) {
        console.info(`[peer ${stamp()}] retomada apos ${Math.round(gap / 1000)}s parado`)
      }
      this.checkSignalingHealth()
    }, SIGNALING_HEALTH_CHECK_INTERVAL_MS)
  }

  /**
   * Verifica AGORA se member peer e door peer continuam registrados e dispara a
   * recuperacao do que estiver caido. Chamada pelo timer, ao voltar de suspensao
   * (powerMonitor) e pelo gancho de diagnostico.
   */
  checkSignalingHealth(): void {
    if (this.disposing) return
    const member = this.memberPeer
    if (member && !member.destroyed && isUnregistered(member)) {
      console.warn(`[peer ${stamp()}] member peer sem registro; reconectando`)
      this.callbacks.onSignalingChange(false)
      this.scheduleMemberReconnect(0)
    }
    this.ensureDoorHealthy()
  }

  /** Diagnostico: simula a queda do websocket exatamente como o servidor faz. */
  debugDropSignaling(target: 'door' | 'member' | 'both' = 'both'): void {
    if (target !== 'member' && this.doorPeer && !this.doorPeer.disconnected) {
      console.warn(`[door ${stamp()}] queda simulada do websocket`)
      this.doorPeer.disconnect()
    }
    if (target !== 'door' && this.memberPeer && !this.memberPeer.disconnected) {
      console.warn(`[peer ${stamp()}] queda simulada do websocket`)
      this.memberPeer.disconnect()
    }
  }

  destroy(): void {
    this.disposing = true
    this.clearMemberReconnectTimer()
    if (this.healthTimer !== null) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
    this.doorCode = null
    this.disposeDoorPeer()
    this.setDoorHealth('closed')
    this.disposeMemberSignaling?.()
    this.disposeMemberSignaling = null
    if (this.memberPeer) {
      this.memberPeer.destroy()
      this.memberPeer = null
    }
  }

  // --- internals ------------------------------------------------------------

  private requireMemberPeer(): Peer {
    if (!this.memberPeer) throw new Error('member peer ainda nao foi iniciado')
    return this.memberPeer
  }

  private setDoorHealth(health: DoorHealth): void {
    if (this.doorHealth === health) return
    this.doorHealth = health
    this.callbacks.onDoorHealth(health)
  }

  private disposeDoorPeer(): void {
    this.disposeDoorSignaling?.()
    this.disposeDoorSignaling = null
    if (!this.doorPeer) return
    const peer = this.doorPeer
    this.doorPeer = null
    peer.destroy()
  }

  private clearMemberReconnectTimer(): void {
    if (this.memberReconnectTimer === null) return
    clearTimeout(this.memberReconnectTimer)
    this.memberReconnectTimer = null
  }

  /**
   * Queda da SINALIZACAO do member peer: o mesh ja estabelecido segue vivo (ICE e
   * direto), mas novos ingressos e novos dials ficam indisponiveis ate reconectar.
   * O id do member peer e sorteado pelo servidor e esta no roster de todo mundo,
   * entao ele NUNCA e recriado: so reconectado, quantas vezes for preciso.
   */
  private scheduleMemberReconnect(attempt: number): void {
    if (this.disposing || this.memberReconnectTimer !== null) return
    const peer = this.memberPeer
    if (!peer || peer.destroyed) return

    this.memberReconnectTimer = setTimeout(() => {
      this.memberReconnectTimer = null
      const current = this.memberPeer
      if (this.disposing || !current || current.destroyed) return
      if (!current.disconnected) {
        this.callbacks.onSignalingChange(true)
        return
      }
      try {
        console.info(`[peer ${stamp()}] member reconnect (tentativa ${attempt + 1})`)
        current.reconnect()
      } catch (error) {
        console.warn('[peer] falha ao reconectar a sinalizacao:', error)
      }
      // O `open` confirma e cancela o ciclo; enquanto nao vier, insiste.
      this.scheduleMemberReconnect(attempt + 1)
    }, backoffMs(attempt, SIGNALING_RECONNECT_MAX_BACKOFF_MS))
  }

  /** Uma operacao de porta por vez (registro inicial, takeover, recuperacao). */
  private async runDoorOperation<T>(task: () => Promise<T>): Promise<T> {
    while (this.doorOperation !== null) {
      try {
        await this.doorOperation
      } catch {
        // O resultado da operacao anterior nao interessa a esta.
      }
    }
    const promise = task()
    this.doorOperation = promise
    try {
      return await promise
    } finally {
      if (this.doorOperation === promise) this.doorOperation = null
    }
  }

  private async registerWithRetry(code: string, mode: 'create' | 'takeover'): Promise<void> {
    const doorId = toPeerId(code)
    const deadline = Date.now() + DOOR_REGISTER_RETRY_WINDOW_MS

    for (;;) {
      if (this.disposing) return
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
      const peer = this.createPeer(doorId)
      const onOpen = (): void => {
        peer.off('error', onError)
        this.doorPeer = peer
        this.attachDoorHandlers(peer)
        console.info(`[door ${stamp()}] porta registrada (${doorId})`)
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

  private attachDoorHandlers(peer: Peer): void {
    this.disposeDoorSignaling?.()
    this.disposeDoorSignaling = observeSignalingCandidates(peer, 'door')
    peer.on('connection', (connection) => this.callbacks.onDoorConnection(connection))
    // O door nunca carrega midia: qualquer chamada e recusada.
    peer.on('call', (call) => call.close())

    peer.on('disconnected', () => {
      if (peer !== this.doorPeer || this.disposing || this.doorCode === null) return
      console.warn(`[door ${stamp()}] porta perdeu a sinalizacao; recuperando`)
      this.setDoorHealth('recovering')
      this.ensureDoorHealthy()
    })

    peer.on('close', () => {
      if (peer !== this.doorPeer || this.disposing || this.doorCode === null) return
      console.warn(`[door ${stamp()}] peer da porta destruido pelo PeerJS; recriando`)
      this.doorPeer = null
      this.setDoorHealth('recovering')
      this.ensureDoorHealthy()
    })

    peer.on('error', (error) => {
      console.warn('[door] erro no peer da porta:', error.type, error.message)
      if (peer !== this.doorPeer || this.disposing || this.doorCode === null) return
      if (error.type === 'network' || error.type === 'socket-error') this.ensureDoorHealthy()
    })
  }

  /** Se a porta caiu, comeca (ou deixa seguir) o ciclo de recuperacao. */
  private ensureDoorHealthy(): void {
    if (this.disposing || this.doorCode === null || this.doorRecovering) return
    if (!isUnregistered(this.doorPeer)) {
      this.setDoorHealth('open')
      return
    }
    void this.recoverDoor()
  }

  /**
   * Ciclo de recuperacao da porta: reconecta o peer existente e, se isso falhar
   * em definitivo, recria e re-registra o id (mesma maquinaria de retry do
   * takeover). Persiste enquanto a sala existir: uma porta fechada e uma sala
   * na qual ninguem mais consegue entrar.
   */
  private async recoverDoor(): Promise<void> {
    this.doorRecovering = true
    const startedAt = Date.now()
    let attempt = 0
    try {
      while (!this.disposing && this.doorCode !== null) {
        if (!isUnregistered(this.doorPeer)) {
          this.setDoorHealth('open')
          return
        }
        this.setDoorHealth(
          Date.now() - startedAt >= DOOR_RECOVERY_WARN_AFTER_MS ? 'failed' : 'recovering'
        )
        if (await this.reopenDoor()) {
          this.setDoorHealth('open')
          console.info(`[door ${stamp()}] porta reaberta apos ${Date.now() - startedAt}ms`)
          return
        }
        attempt += 1
        await delay(backoffMs(attempt, DOOR_RECOVERY_MAX_BACKOFF_MS))
      }
    } finally {
      this.doorRecovering = false
    }
  }

  /** Uma rodada: `reconnect()` no peer atual ou, falhando, um peer novo. */
  private async reopenDoor(): Promise<boolean> {
    const peer = this.doorPeer
    if (peer && !peer.destroyed && peer.disconnected) {
      try {
        console.info(`[door ${stamp()}] reconnect da porta`)
        peer.reconnect()
        await this.waitForOpen(peer)
        return true
      } catch (error) {
        console.warn('[door] reconnect falhou; recriando a porta:', error)
      }
    }

    const code = this.doorCode
    if (code === null || this.disposing) return false
    this.disposeDoorPeer()
    try {
      // Sempre "takeover": o servidor pode segurar o id antigo por alguns
      // segundos (mesma janela do risco R5).
      await this.runDoorOperation(() => this.registerWithRetry(code, 'takeover'))
      return true
    } catch (error) {
      console.warn('[door] nao foi possivel re-registrar a porta:', error)
      return false
    }
  }

  private waitForOpen(peer: Peer): Promise<void> {
    return new Promise((resolve, reject) => {
      const done = (action: () => void): void => {
        clearTimeout(timer)
        peer.off('open', onOpen)
        peer.off('error', onError)
        peer.off('close', onClose)
        action()
      }
      const onOpen = (): void => done(resolve)
      const onError = (error: PeerError<string>): void =>
        done(() => reject(new SignalingError(error.type, error.message)))
      // Peer destruido nunca mais abre: esperar o timeout inteiro so atrasaria
      // a recriacao da porta.
      const onClose = (): void =>
        done(() => reject(new SignalingError('network', 'peer destruido durante o reconnect')))
      const timer = setTimeout(() => {
        done(() => reject(new SignalingError('network', 'reconnect sem resposta')))
      }, SIGNALING_RECONNECT_TIMEOUT_MS)
      peer.on('open', onOpen)
      peer.on('error', onError)
      peer.on('close', onClose)
    })
  }
}
