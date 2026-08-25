// Orquestrador da sessao: unico ponto que liga o reducer puro (core) as camadas
// de transporte (peer-manager, mesh, reconnection, stats) e executa os EFEITOS
// declarativos que o reducer emite.
import type { DataConnection, MediaConnection } from 'peerjs'
import {
  ADMISSION_IDLE_TIMEOUT_MS,
  JOIN_PEER_UNAVAILABLE_RETRY_INTERVAL_MS,
  JOIN_PEER_UNAVAILABLE_RETRY_WINDOW_MS,
  JOIN_RESPONSE_TIMEOUT_MS,
  JOIN_TIMEOUT_RETRIES,
  OWNER_REBROADCAST_COUNT,
  OWNER_REBROADCAST_INTERVAL_MS,
  ROOM_DEFAULT_LIMIT,
  ROOM_MAX_LIMIT,
  ROOM_MIN_LIMIT
} from '@shared/config'
import {
  createEnvelope,
  validateEnvelope,
  type JoinAcceptPayload,
  type JoinRejectReason,
  type PresetId,
  type ProtocolMessage,
  type RoomMeta,
  type SourceKind,
  type TxStopReason
} from '@shared/protocol'
import { admit } from '../core/admission'
import { toPeerId, validateRoomCode } from '../core/room-code'
import {
  buildRosterUpdate,
  createInitialState,
  isOwner,
  nicknameOf,
  reduce,
  type Effect,
  type RoomEvent,
  type RoomState,
  type ToastTone
} from '../core/room-state'
import { describeConnectionState, observePeerJsIce, shortPeerId } from './ice-diagnostics'
import { Mesh } from './mesh'
import {
  PeerManager,
  RoomCodeUnavailableError,
  SignalingError,
  type DoorHealth
} from './peer-manager'
import { ReconnectionManager } from './reconnection'
import { StatsMonitor } from './stats-monitor'
import { playSound } from './sound-player'

export class JoinRejectedError extends Error {
  readonly reason: JoinRejectReason

  constructor(reason: JoinRejectReason) {
    super(JOIN_REJECT_MESSAGES[reason])
    this.name = 'JoinRejectedError'
    this.reason = reason
  }
}

export class RoomNotFoundError extends Error {
  constructor(message = 'Sala nao encontrada.') {
    super(message)
    this.name = 'RoomNotFoundError'
  }
}

/**
 * O id da sala EXISTE na sinalizacao (o servidor nao respondeu `peer-unavailable`),
 * mas o canal de ingresso nunca abriu: fica entre as duas maquinas (NAT/firewall,
 * sem TURN por decisao do RF-42) ou o dono nao respondeu a tempo. Herda de
 * `RoomNotFoundError` para nao mudar o tratamento de quem so quer saber que a
 * entrada falhou; o que muda e a MENSAGEM, que antes acusava a sala de nao
 * existir e mandava o usuario para o caminho errado de diagnostico.
 */
export class RoomUnreachableError extends RoomNotFoundError {
  constructor() {
    super('Achei a sala, mas a conexao nao completou. Pode ser a rede de um dos dois.')
    this.name = 'RoomUnreachableError'
  }
}

export class JoinTimeoutError extends Error {
  constructor() {
    super('Sem resposta da sala.')
    this.name = 'JoinTimeoutError'
  }
}

export const JOIN_REJECT_MESSAGES: Record<JoinRejectReason, string> = {
  room_full: 'Sala cheia.',
  banned: 'Voce esta banido desta sala.',
  version_mismatch: 'Atualize o app para entrar nesta sala.',
  invalid_payload: 'Nao foi possivel entrar na sala.'
}

export interface Toast {
  id: number
  tone: ToastTone
  text: string
}

/**
 * Saude do TRANSPORTE, fora do RoomState de proposito: o reducer e puro e nao
 * conhece websocket. A UI usa isto para nao mostrar uma sala "saudavel" enquanto
 * a porta esta fechada (ninguem consegue entrar).
 */
export interface SessionHealth {
  /** Sinalizacao do member peer (mesh e novos dials). */
  signaling: 'up' | 'reconnecting'
  /** Registro do door peer; so o dono tem porta. */
  door: DoorHealth
}

type HealthListener = (health: SessionHealth) => void

/** Ganchos que o pipeline de midia (Sprint 5) registra na sessao. */
export interface MediaHooks {
  /** Um membro novo entrou: re-`call` se houver transmissao local ativa. */
  onMemberJoined(peerId: string): void
  /** Um par voltou de reconexao: re-`call` se houver transmissao local ativa. */
  onPeerRecovered(peerId: string): void
  /** Chamada de midia recebida no member peer. */
  onIncomingCall(call: MediaConnection): void
  /** A transmissao saiu do estado (TX_STOP ou remocao do transmissor). */
  dropRemote(txId: string): void
  /** Encerra a transmissao local (saida da sala, troca de fonte). */
  stopLocal(reason: TxStopReason): void
  /** Conexoes de ENTRADA para o monitor de qualidade. */
  inboundConnections(): RTCPeerConnection[]
  /** Libera tudo ao destruir a sessao. */
  teardown(): void
}

export interface CreateRoomOptions {
  code: string
  limit: number
}

type StateListener = (state: RoomState) => void
type ToastListener = (toast: Toast) => void

/**
 * Retomada do sistema depois de suspensao (powerMonitor no main). Ao dormir, o
 * websocket morre sem que o evento chegue ao renderer: acordar precisa disparar
 * uma verificacao imediata. Fora do Electron (testes) vira no-op, e a verificacao
 * periodica continua cobrindo o caso.
 */
function onSystemResume(listener: () => void): (() => void) | null {
  if (typeof window === 'undefined') return null
  const api = (window as { zoi?: { system?: { onResume?(cb: () => void): () => void } } }).zoi
  return api?.system?.onResume?.(listener) ?? null
}

const noopMediaHooks: MediaHooks = {
  onMemberJoined: () => {},
  onPeerRecovered: () => {},
  onIncomingCall: (call) => call.close(),
  dropRemote: () => {},
  stopLocal: () => {},
  inboundConnections: () => [],
  teardown: () => {}
}

export class Session {
  private state: RoomState = createInitialState()
  private nickname = ''
  private installId = ''
  private mediaHooks: MediaHooks = noopMediaHooks

  private readonly stateListeners = new Set<StateListener>()
  private readonly toastListeners = new Set<ToastListener>()
  private readonly healthListeners = new Set<HealthListener>()
  private readonly memberErrorListeners = new Set<(type: string, message: string) => void>()
  private readonly rttByPeer = new Map<string, number>()

  private health: SessionHealth = { signaling: 'up', door: 'closed' }
  /** Ja avisamos que a porta esta fechada? Evita repetir o toast a cada ciclo. */
  private doorWarned = false
  /** Descarte do listener de retomada de suspensao (powerMonitor). */
  private offResume: (() => void) | null = null

  private toastSeq = 0
  /** Registro do door em andamento (evita dois takeovers concorrentes). */
  private doorRegistration: Promise<void> | null = null
  private rebroadcastTimer: ReturnType<typeof setInterval> | null = null
  private quarantineTimer: ReturnType<typeof setInterval> | null = null

  private readonly peerManager: PeerManager
  private readonly mesh: Mesh
  private readonly reconnection: ReconnectionManager
  private readonly statsMonitor: StatsMonitor

  constructor() {
    this.peerManager = new PeerManager({
      onMeshConnection: (connection) => this.handleIncomingMeshConnection(connection),
      onDoorConnection: (connection) => this.handleDoorConnection(connection),
      onCall: (call) => this.mediaHooks.onIncomingCall(call),
      onSignalingChange: (connected) => this.handleSignalingChange(connected),
      onDoorHealth: (health) => this.handleDoorHealth(health),
      onMemberError: (type, message) => {
        for (const listener of this.memberErrorListeners) listener(type, message)
        if (type === 'peer-unavailable') {
          this.handlePeerUnavailable(message)
          return
        }
        console.warn('[session] erro do member peer:', type, message)
      }
    })

    this.mesh = new Mesh({
      onMessage: (from, message) => this.handleMeshMessage(from, message),
      onOpen: (peerId) => {
        this.reconnection.markOpen(peerId)
        this.dispatch({ kind: 'PEER_LINK_UP', peerId, now: Date.now() })
        this.mediaHooks.onPeerRecovered(peerId)
      },
      onClose: (peerId) => this.reconnection.markClosed(peerId),
      onInvalid: (from, reason) => {
        console.warn(`[mesh] envelope descartado de ${from}: ${reason}`)
      }
    })

    this.reconnection = new ReconnectionManager({
      sendPing: (peerId, seq) => this.mesh.send(peerId, { type: 'PING', payload: { seq } }),
      redial: (peerId) => this.redial(peerId),
      onReconnecting: (peerId) =>
        this.dispatch({ kind: 'PEER_LINK_RECONNECTING', peerId, now: Date.now() }),
      onReconnectTimeout: (peerId) =>
        this.dispatch({ kind: 'PEER_LINK_RECONNECT_TIMEOUT', peerId, now: Date.now() }),
      onConnectFailed: (peerId) =>
        this.dispatch({ kind: 'PEER_LINK_FAILED', peerId, now: Date.now() }),
      onRtt: (peerId, rttMs) => this.rttByPeer.set(peerId, rttMs)
    })

    this.statsMonitor = new StatsMonitor({
      inboundConnections: () => this.mediaHooks.inboundConnections(),
      averageRttMs: () => this.averageRtt(),
      onReport: (report) => {
        if (this.state.phase !== 'active') return
        this.dispatch({
          kind: 'LOCAL_QUALITY',
          level: report.level,
          rttMs: report.rttMs,
          inboundBitrateKbps: report.inboundBitrateKbps,
          now: Date.now()
        })
      }
    })
  }

  // --- API publica ---------------------------------------------------------

  getState(): RoomState {
    return this.state
  }

  get selfPeerId(): string {
    return this.peerManager.memberPeerId
  }

  subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener)
    listener(this.state)
    return () => this.stateListeners.delete(listener)
  }

  onToast(listener: ToastListener): () => void {
    this.toastListeners.add(listener)
    return () => this.toastListeners.delete(listener)
  }

  getHealth(): SessionHealth {
    return this.health
  }

  /** Assina a saude do transporte; chama o listener na hora com o valor atual. */
  onHealth(listener: HealthListener): () => void {
    this.healthListeners.add(listener)
    listener(this.health)
    return () => this.healthListeners.delete(listener)
  }

  /**
   * Verifica AGORA se a sinalizacao (member peer e porta) continua registrada.
   * Chamada ao voltar de suspensao e pelo gancho de diagnostico.
   */
  checkSignalingHealth(): void {
    this.peerManager.checkSignalingHealth()
  }

  /** Diagnostico: derruba o websocket como o servidor faria (ver `__zoiDebug`). */
  debugDropSignaling(target: 'door' | 'member' | 'both' = 'both'): void {
    this.peerManager.debugDropSignaling(target)
  }

  setMediaHooks(hooks: MediaHooks): void {
    this.mediaHooks = hooks
  }

  setIdentity(nickname: string, installId: string): void {
    this.nickname = nickname
    this.installId = installId
  }

  /** Sobe o member peer (id aleatorio) e devolve o peerId aberto. */
  async start(): Promise<string> {
    const peerId = await this.peerManager.startMemberPeer()
    this.mesh.setSelfPeerId(peerId)
    return peerId
  }

  /** RF-01/RF-02/RF-04: cria a sala registrando o door peer com o codigo. */
  async createRoom(options: CreateRoomOptions): Promise<void> {
    const validation = validateRoomCode(options.code)
    if (!validation.ok) throw new Error(`Codigo invalido: ${validation.error}`)
    const limit = Math.min(ROOM_MAX_LIMIT, Math.max(ROOM_MIN_LIMIT, Math.round(options.limit)))

    const selfPeerId = await this.start()
    // Falha aqui com unavailable-id significa "codigo ja em uso" (RF-04).
    await this.peerManager.openDoor(validation.code, 'create')

    const roomMeta: RoomMeta = {
      code: validation.code,
      limit: Number.isFinite(limit) ? limit : ROOM_DEFAULT_LIMIT,
      createdAt: Date.now()
    }
    this.dispatch({
      kind: 'ROOM_CREATED',
      roomMeta,
      selfPeerId,
      selfInstallId: this.installId,
      nickname: this.nickname,
      now: Date.now()
    })
    this.startBackgroundTimers()
  }

  /** RF-06: entra pelo codigo via canal efemero com o door peer do dono. */
  async joinRoom(rawCode: string): Promise<void> {
    const validation = validateRoomCode(rawCode)
    if (!validation.ok) throw new Error(`Codigo invalido: ${validation.error}`)
    const code = validation.code

    const selfPeerId = await this.start()
    const deadline = Date.now() + JOIN_PEER_UNAVAILABLE_RETRY_WINDOW_MS
    let timeoutRetries = JOIN_TIMEOUT_RETRIES

    let accept: JoinAcceptPayload | null = null
    for (;;) {
      try {
        accept = await this.requestJoin(code)
        break
      } catch (error) {
        // Janela de indisponibilidade do id durante transferencia de posse (R5).
        if (error instanceof RoomNotFoundError && Date.now() < deadline) {
          await new Promise((resolve) =>
            setTimeout(resolve, JOIN_PEER_UNAVAILABLE_RETRY_INTERVAL_MS)
          )
          continue
        }
        // O door respondeu mas a admissao nao concluiu (dono ocupado ou canal
        // perdido no meio): uma segunda tentativa antes de desistir.
        if (error instanceof JoinTimeoutError && timeoutRetries > 0) {
          timeoutRetries -= 1
          continue
        }
        throw error
      }
    }

    this.dispatch({
      kind: 'ROOM_JOINED',
      accept,
      selfPeerId,
      selfInstallId: this.installId,
      now: Date.now()
    })
    this.startBackgroundTimers()

    // O mesh com cada membro ja foi aberto pelo `dispatch` acima (todo mundo do
    // snapshot entra como "novo"). Discar de novo aqui abriria uma SEGUNDA
    // DataConnection por par e derrubaria a primeira no meio da negociacao,
    // atrasando o link em centenas de ms. Aqui so falta se apresentar: o `send`
    // enfileira ate o canal abrir.
    for (const member of accept.members) {
      if (member.peerId === selfPeerId) continue
      this.mesh.send(member.peerId, {
        type: 'HELLO',
        payload: { nickname: this.nickname, joinedAt: Date.now() }
      })
    }
  }

  leaveRoom(): void {
    if (this.state.phase !== 'active') {
      this.teardown()
      return
    }
    this.dispatch({ kind: 'SELF_LEAVE', now: Date.now() })
  }

  kick(peerId: string): void {
    this.dispatch({ kind: 'OWNER_REMOVE', peerId, mode: 'kick', now: Date.now() })
  }

  ban(peerId: string): void {
    this.dispatch({ kind: 'OWNER_REMOVE', peerId, mode: 'ban', now: Date.now() })
  }

  updateNickname(nickname: string): void {
    this.nickname = nickname.trim()
    if (this.state.phase !== 'active') return
    this.dispatch({ kind: 'LOCAL_NICKNAME', nickname: this.nickname, now: Date.now() })
  }

  watch(txId: string | null): void {
    this.dispatch({ kind: 'LOCAL_WATCHING', txId, now: Date.now() })
  }

  /** Usado pelo media-manager (Sprint 5) para anunciar TX_START/TX_STOP. */
  announceTransmissionStart(payload: {
    txId: string
    presetId: PresetId
    hasAudio: boolean
    sourceKind: SourceKind
    sourceLabel: string
  }): void {
    this.dispatch({ kind: 'LOCAL_TX_START', ...payload, now: Date.now() })
  }

  announceTransmissionStop(reason: TxStopReason): void {
    this.dispatch({ kind: 'LOCAL_TX_STOP', reason, now: Date.now() })
  }

  /** peerIds do roster, exceto o proprio (alvos de `call` e de broadcast). */
  otherMemberPeerIds(): string[] {
    return this.state.members
      .map((member) => member.peerId)
      .filter((peerId) => peerId !== this.state.selfPeerId)
  }

  sendTo(peerId: string, message: ProtocolMessage): void {
    this.mesh.send(peerId, message)
  }

  /** Chamada de midia para um membro, com o txId no metadata (Sprint 5). */
  callPeer(peerId: string, stream: MediaStream, metadata: { txId: string }): MediaConnection {
    return this.peerManager.call(peerId, stream, metadata)
  }

  /**
   * A midia de um par foi anunciada e atendida, mas nunca chegou: sem TURN
   * (RF-42) a conexao direta entre as duas redes pode simplesmente nao subir.
   * O espectador precisa saber disso, senao so ve um retangulo preto.
   */
  notifyMediaFailure(txId: string, peerId: string): void {
    console.warn(`[media] a transmissao ${txId} de ${peerId} nao chegou ate aqui`)
    this.emitToast(
      'warning',
      `O video de ${nicknameOf(this.state, peerId)} nao chegou ate voce. A conexao direta entre as redes falhou.`
    )
  }

  // --- ingresso ------------------------------------------------------------

  private requestJoin(code: string): Promise<JoinAcceptPayload> {
    return new Promise<JoinAcceptPayload>((resolve, reject) => {
      let settled = false
      let opened = false
      /** O servidor confirmou que o id da sala NAO existe (door desregistrado). */
      let doorMissing = false
      const doorId = toPeerId(code)
      const connection = this.peerManager.connectToDoor(code)
      const disposeIce = observePeerJsIce(connection, `join-out:${doorId}`)

      // Duas falhas MUITO diferentes que antes viravam a mesma frase: a porta
      // nao existe (codigo errado, dono saiu, registro perdido) ou a porta
      // existe e o canal e que nao fechou (rede das duas pontas).
      const giveUp = (): Error => {
        if (opened) return new JoinTimeoutError()
        if (doorMissing) return new RoomNotFoundError()
        console.warn(
          `[ice join-out:${doorId}] a porta nao respondeu ${JOIN_RESPONSE_TIMEOUT_MS}ms sem 'peer-unavailable': o id existe na sinalizacao e a conexao e que nao completou (${describeConnectionState(connection)})`
        )
        return new RoomUnreachableError()
      }

      const finish = (action: () => void): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        disposeIce()
        this.memberErrorListeners.delete(onMemberError)
        connection.close()
        action()
      }

      // Mesma leitura do `close`: canal que nunca abriu significa que nao existe
      // door com esse codigo. Sem isso, um `peer-unavailable` que demora mais que
      // a espera interna virava "Sem resposta da sala." no lugar de "Sala nao
      // encontrada." (e ainda saia do retry, que so cobria RoomNotFoundError).
      const timeout = setTimeout(() => {
        finish(() => reject(giveUp()))
      }, JOIN_RESPONSE_TIMEOUT_MS)

      const onMemberError = (type: string, message: string): void => {
        // O erro precisa ser DESTA porta: um `peer-unavailable` de outro par
        // (re-dial de mesh, por exemplo) nao diz nada sobre a sala.
        if (type !== 'peer-unavailable' || !message.includes(doorId)) return
        doorMissing = true
        finish(() => reject(new RoomNotFoundError()))
      }
      this.memberErrorListeners.add(onMemberError)

      connection.on('open', () => {
        opened = true
        connection.send(
          createEnvelope(
            'JOIN_REQUEST',
            {
              nickname: this.nickname,
              memberPeerId: this.peerManager.memberPeerId,
              installId: this.installId
            },
            this.peerManager.memberPeerId,
            Date.now()
          )
        )
      })

      connection.on('data', (raw: unknown) => {
        // O candidato so aceita respostas do door ao qual ELE se conectou (5c).
        const result = validateEnvelope(raw, connection.peer)
        if (!result.ok) return
        if (result.message.type === 'JOIN_ACCEPT') {
          const accept = result.message.payload
          finish(() => resolve(accept))
          return
        }
        if (result.message.type === 'JOIN_REJECT') {
          const reason = result.message.payload.reason
          finish(() => reject(new JoinRejectedError(reason)))
        }
      })

      connection.on('close', () => {
        // Canal que nunca abriu: `giveUp` decide entre "nao existe" e "existe
        // mas nao conectou". Fechou depois de aberto = o dono nao respondeu.
        finish(() => reject(giveUp()))
      })

      connection.on('error', () => {
        finish(() => reject(giveUp()))
      })
    })
  }

  /** Lado do DONO: canal efemero de admissao, so aceita JOIN_REQUEST (5c). */
  private handleDoorConnection(connection: DataConnection): void {
    const tag = `door-in:${shortPeerId(connection.peer)}`
    const disposeIce = observePeerJsIce(connection, tag)
    // A oferta de admissao chega pela SINALIZACAO: este log sai mesmo quando o
    // ICE nunca fecha, e e ele que separa "ninguem tentou entrar" de "tentou e
    // a conexao direta nao subiu".
    console.info(`[ice ${tag}] pedido de admissao chegou pela sinalizacao`)

    const idleTimer = setTimeout(() => {
      if (connection.open) {
        console.warn(`[ice ${tag}] candidato nao enviou JOIN_REQUEST; fechando canal`)
      } else {
        console.warn(
          `[ice ${tag}] o canal de admissao nunca abriu em ${ADMISSION_IDLE_TIMEOUT_MS}ms: a oferta chegou pela sinalizacao e o ICE nao fechou (${describeConnectionState(connection)})`
        )
      }
      disposeIce()
      connection.close()
    }, ADMISSION_IDLE_TIMEOUT_MS)

    const closeSoon = (): void => {
      clearTimeout(idleTimer)
      disposeIce()
      setTimeout(() => connection.close(), 250)
    }

    connection.on('open', () => {
      console.info(`[ice ${tag}] canal de admissao aberto`)
    })

    connection.on('data', (raw: unknown) => {
      clearTimeout(idleTimer)
      const roomMeta = this.state.roomMeta
      if (!isOwner(this.state) || !roomMeta) {
        connection.close()
        return
      }

      // O candidato valida a resposta contra o peerId do DOOR, que e o peer ao
      // qual ELE se conectou (matriz 5c), nao contra o member peer do dono.
      const doorPeerId = toPeerId(roomMeta.code)

      const decision = admit(raw, {
        roomMeta,
        rosterVersion: this.state.rosterVersion,
        ownerPeerId: this.state.selfPeerId,
        members: this.state.members,
        banList: this.state.banList,
        now: Date.now()
      })

      if ('reject' in decision) {
        connection.send(createEnvelope('JOIN_REJECT', decision.reject, doorPeerId, Date.now()))
        closeSoon()
        return
      }

      // Identidade cruzada: o memberPeerId declarado tem que ser o peerId REAL
      // da conexao de admissao, senao o candidato poderia se passar por outro.
      if (decision.member.peerId !== connection.peer) {
        connection.send(
          createEnvelope('JOIN_REJECT', { reason: 'invalid_payload' }, doorPeerId, Date.now())
        )
        closeSoon()
        return
      }

      connection.send(createEnvelope('JOIN_ACCEPT', decision.accept, doorPeerId, Date.now()))
      this.dispatch({
        kind: 'OWNER_ADMIT',
        member: decision.member,
        members: decision.accept.members,
        rosterVersion: decision.accept.rosterVersion,
        now: Date.now()
      })
      this.reconnection.track(decision.member.peerId)
      this.mediaHooks.onMemberJoined(decision.member.peerId)
      closeSoon()
    })

    connection.on('close', () => {
      clearTimeout(idleTimer)
      disposeIce()
    })
    connection.on('error', () => {
      clearTimeout(idleTimer)
      disposeIce()
    })
  }

  // --- mesh ----------------------------------------------------------------

  private handleIncomingMeshConnection(connection: DataConnection): void {
    this.mesh.attach(connection, 'incoming')
  }

  private dial(peerId: string): void {
    if (this.mesh.isOpen(peerId)) return
    this.reconnection.track(peerId)
    try {
      this.mesh.attach(this.peerManager.connectToMember(peerId), 'outgoing')
    } catch (error) {
      console.warn(`[session] nao foi possivel discar para ${peerId}:`, error)
    }
  }

  private redial(peerId: string): void {
    const stillInRoster = this.state.members.some((member) => member.peerId === peerId)
    if (!stillInRoster || this.state.phase !== 'active') {
      this.reconnection.untrack(peerId)
      return
    }
    this.mesh.close(peerId)
    try {
      this.mesh.attach(this.peerManager.connectToMember(peerId), 'outgoing')
    } catch (error) {
      console.warn(`[session] nao foi possivel rediscar para ${peerId}:`, error)
    }
  }

  /**
   * `peer-unavailable` e a resposta da sinalizacao para "esse peer nao existe".
   * O erro do PeerJS traz o peerId no texto, entao o alvo e identificado por
   * comparacao com o roster (nao dependemos da redacao da mensagem). Se for um
   * membro, o link com ele deixa de ser "nunca conectou" e passa a ser queda.
   */
  private handlePeerUnavailable(message: string): void {
    const target = this.state.members.find(
      (member) => member.peerId !== this.state.selfPeerId && message.includes(member.peerId)
    )
    if (!target) return
    this.reconnection.markGone(target.peerId)
  }

  private handleMeshMessage(from: string, message: ProtocolMessage): void {
    // Heartbeat nao passa pelo reducer: e puro transporte.
    if (message.type === 'PING') {
      if (this.state.members.some((member) => member.peerId === from)) {
        this.mesh.send(from, { type: 'PONG', payload: { seq: message.payload.seq } })
      }
      return
    }
    if (message.type === 'PONG') {
      this.reconnection.handlePong(from, message.payload.seq)
      return
    }
    this.dispatch({ kind: 'MESSAGE', from, message, now: Date.now() })
  }

  // --- reducer e efeitos ---------------------------------------------------

  dispatch(event: RoomEvent): void {
    const previousMembers = this.state.members.map((member) => member.peerId)
    const previousTxIds = Object.keys(this.state.transmissions)
    const result = reduce(this.state, event)
    this.state = result.state
    this.runEffects(result.effects)

    // Transmissoes que sairam do estado liberam a chamada e a stream recebida.
    for (const txId of previousTxIds) {
      if (!this.state.transmissions[txId]) this.mediaHooks.dropRemote(txId)
    }

    // Membros novos no roster: abrir mesh e avisar a midia (re-call, RF-22).
    const joined = this.state.members
      .map((member) => member.peerId)
      .filter(
        (peerId) => peerId !== this.state.selfPeerId && !previousMembers.includes(peerId)
      )
    for (const peerId of joined) {
      this.dial(peerId)
      this.mediaHooks.onMemberJoined(peerId)
    }

    this.notify()
  }

  private runEffects(effects: readonly Effect[]): void {
    for (const effect of effects) {
      switch (effect.kind) {
        case 'playSound':
          playSound(effect.sound)
          break
        case 'showToast':
          this.emitToast(effect.tone, effect.text)
          break
        case 'send':
          this.mesh.send(effect.to, effect.message)
          break
        case 'broadcast':
          this.mesh.broadcast(effect.message)
          break
        case 'closeConnection':
          this.mesh.close(effect.peerId)
          this.reconnection.untrack(effect.peerId)
          this.rttByPeer.delete(effect.peerId)
          break
        case 'log':
          if (effect.level === 'warn') console.warn('[room]', effect.text)
          else console.info('[room]', effect.text)
          break
        case 'assumeOwnership':
          void this.assumeOwnership(effect.rebroadcast)
          break
        case 'releaseDoor':
          this.peerManager.closeDoor()
          break
        case 'scheduleRedial':
          this.reconnection.enableBackgroundRetry(effect.peerId)
          break
        case 'stopLocalTransmission':
          this.mediaHooks.stopLocal(effect.reason)
          break
        case 'destroySession':
          setTimeout(() => this.teardown(), 300)
          break
      }
    }
  }

  private async assumeOwnership(rebroadcast: boolean): Promise<void> {
    const code = this.state.roomMeta?.code
    if (!code) return
    // A re-emissao nao pode esperar o registro do door: sao coisas independentes
    // e o registro pode levar segundos (retry de id ocupado).
    if (rebroadcast) this.startOwnerRebroadcast()
    // Dois efeitos podem pedir a posse quase juntos (OWNER_TRANSFER + snapshot):
    // sem esta trava o segundo registro destruiria o door que o primeiro abriu.
    if (this.peerManager.hasDoor || this.doorRegistration !== null) return

    const registration = this.peerManager.openDoor(code, 'takeover')
    this.doorRegistration = registration
    try {
      // Sempre "takeover": o id do dono anterior pode levar alguns segundos para
      // ser liberado pelo servidor PeerJS (risco R5). O modo "create" so aparece
      // em `createRoom`, onde `unavailable-id` significa mesmo "codigo em uso".
      await registration
    } catch (error) {
      if (error instanceof RoomCodeUnavailableError || error instanceof SignalingError) {
        // O peer-manager continua tentando reabrir a porta em background; este
        // aviso e so para o dono nao achar que ja pode passar o codigo adiante.
        console.warn('[session] nao foi possivel registrar o door peer:', error.message)
        this.emitToast(
          'warning',
          'A sala segue funcionando, mas novas entradas podem falhar por alguns segundos.'
        )
        return
      }
      throw error
    } finally {
      if (this.doorRegistration === registration) this.doorRegistration = null
    }
  }

  /**
   * Re-emite o primeiro ROSTER_UPDATE do dono eleito a cada 5s, ate 3 vezes, para
   * que membros cujos timers de 15s expiram depois convirjam (secao 2.7).
   */
  private startOwnerRebroadcast(): void {
    this.stopOwnerRebroadcast()
    let remaining = OWNER_REBROADCAST_COUNT
    this.rebroadcastTimer = setInterval(() => {
      if (remaining <= 0 || !isOwner(this.state) || this.state.phase !== 'active') {
        this.stopOwnerRebroadcast()
        return
      }
      remaining -= 1
      this.mesh.broadcast({
        type: 'ROSTER_UPDATE',
        payload: buildRosterUpdate(this.state, {
          kind: 'transfer',
          targetPeerId: this.state.selfPeerId
        })
      })
    }, OWNER_REBROADCAST_INTERVAL_MS)
  }

  private stopOwnerRebroadcast(): void {
    if (this.rebroadcastTimer === null) return
    clearInterval(this.rebroadcastTimer)
    this.rebroadcastTimer = null
  }

  // --- infra ---------------------------------------------------------------

  /**
   * Queda/volta da sinalizacao do member peer. O mesh ja estabelecido nao cai
   * junto (ICE e direto), mas sem sinalizacao nao ha novo dial nem ingresso.
   */
  private handleSignalingChange(connected: boolean): void {
    const next: SessionHealth['signaling'] = connected ? 'up' : 'reconnecting'
    if (this.health.signaling === next) return
    const wasDown = this.health.signaling === 'reconnecting'
    this.setHealth({ signaling: next })
    if (!connected) {
      this.emitToast('warning', 'Conexao com o servidor de sinalizacao caiu; reconectando...')
      return
    }
    if (wasDown) this.emitToast('success', 'Conexao com o servidor de sinalizacao restabelecida.')
  }

  /**
   * Registro da porta. Enquanto ela estiver fechada a sala CONTINUA funcionando
   * para quem ja esta dentro, mas ninguem novo consegue entrar: o dono precisa
   * saber disso, senao o convidado ouve "Sala nao encontrada." sem explicacao.
   */
  private handleDoorHealth(health: DoorHealth): void {
    if (this.health.door === health) return
    this.setHealth({ door: health })
    if (health === 'failed' && !this.doorWarned) {
      this.doorWarned = true
      console.warn('[session] a porta da sala segue fechada; novas entradas vao falhar')
      this.emitToast(
        'warning',
        'A porta da sala caiu: quem tentar entrar agora vai ver "sala nao encontrada". Reabrindo...'
      )
      return
    }
    if (health === 'open' && this.doorWarned) {
      this.doorWarned = false
      this.emitToast('success', 'Porta da sala reaberta; ja da para entrar de novo.')
    }
  }

  private setHealth(patch: Partial<SessionHealth>): void {
    this.health = { ...this.health, ...patch }
    for (const listener of this.healthListeners) listener(this.health)
  }

  private startBackgroundTimers(): void {
    this.statsMonitor.start()
    // Queda silenciosa do websocket (servidor derruba ocioso, maquina dorme):
    // sem esta verificacao a porta pode ficar fechada para sempre.
    this.peerManager.startHealthChecks()
    if (this.offResume === null) {
      this.offResume = onSystemResume(() => {
        console.info('[session] retomada do sistema; verificando a sinalizacao')
        this.peerManager.checkSignalingHealth()
      })
    }
    if (this.quarantineTimer === null) {
      this.quarantineTimer = setInterval(() => {
        if (this.state.pendingHellos.length === 0) return
        this.dispatch({ kind: 'HELLO_QUARANTINE_TICK', now: Date.now() })
      }, 1_000)
    }
  }

  private averageRtt(): number {
    if (this.rttByPeer.size === 0) return 0
    let total = 0
    for (const rtt of this.rttByPeer.values()) total += rtt
    return total / this.rttByPeer.size
  }

  private emitToast(tone: ToastTone, text: string): void {
    this.toastSeq += 1
    const toast: Toast = { id: this.toastSeq, tone, text }
    for (const listener of this.toastListeners) listener(toast)
  }

  private notify(): void {
    for (const listener of this.stateListeners) listener(this.state)
  }

  teardown(): void {
    this.stopOwnerRebroadcast()
    if (this.offResume !== null) {
      this.offResume()
      this.offResume = null
    }
    this.doorWarned = false
    this.setHealth({ signaling: 'up', door: 'closed' })
    if (this.quarantineTimer !== null) {
      clearInterval(this.quarantineTimer)
      this.quarantineTimer = null
    }
    this.statsMonitor.stop()
    this.reconnection.destroy()
    this.mediaHooks.teardown()
    this.mesh.closeAll()
    this.peerManager.destroy()
    this.rttByPeer.clear()
  }

  /** Reinicia o estado para voltar a Home apos sair/ser removido. */
  reset(): void {
    this.teardown()
    this.state = createInitialState()
    this.notify()
  }
}

export const session = new Session()

/**
 * Gancho de DIAGNOSTICO da sinalizacao. Nao expoe nada que o proprio app ja nao
 * faca (derrubar o proprio websocket e verificar o estado dele) e existe para
 * reproduzir, no app instalado, a queda de conexao que so aparece depois de
 * minutos em sala. Uso: `__zoiDebug.dropSignaling('door')` no DevTools.
 */
if (typeof window !== 'undefined') {
  ;(window as unknown as { __zoiDebug: unknown }).__zoiDebug = {
    dropSignaling: (target?: 'door' | 'member' | 'both') => session.debugDropSignaling(target),
    checkHealth: () => session.checkSignalingHealth(),
    health: () => session.getHealth()
  }
}
