// Pipeline de midia: captura com preset, configuracao dos senders, distribuicao
// N-copias para o roster e recepcao correlacionada por txId (SPEC Sprint 5).
// Pilar de performance: nada aqui roda por frame; tudo e eventual.
import type { MediaConnection } from 'peerjs'
import { CALL_METADATA_WAIT_MS } from '@shared/config'
import { PRESETS } from '@shared/presets'
import type { PresetId, SourceKind, TxStopReason } from '@shared/protocol'
import { session, type MediaHooks, type Session } from './session'

export interface StartTransmissionOptions {
  sourceId: string
  sourceLabel: string
  sourceKind: SourceKind
  presetId: PresetId
  withAudio: boolean
}

export interface LocalTransmission {
  txId: string
  presetId: PresetId
  sourceId: string
  sourceLabel: string
  sourceKind: SourceKind
  hasAudio: boolean
  stream: MediaStream
}

export class TransmissionInProgressError extends Error {
  constructor() {
    super('Ja existe uma transmissao ativa. Pare a atual antes de iniciar outra.')
    this.name = 'TransmissionInProgressError'
  }
}

export class CaptureFailedError extends Error {
  constructor(cause: unknown) {
    super('Nao foi possivel capturar a fonte escolhida.')
    this.name = 'CaptureFailedError'
    this.cause = cause
  }
}

type StreamsListener = (streams: ReadonlyMap<string, MediaStream>) => void

interface PendingCall {
  call: MediaConnection
  receivedAt: number
}

export class MediaManager implements MediaHooks {
  private local: LocalTransmission | null = null
  /** txId -> stream recebida (RF-23: a mesma stream serve miniatura e player). */
  private readonly remoteStreams = new Map<string, MediaStream>()
  /** peerId -> chamada de saida ativa da transmissao local. */
  private readonly outgoingCalls = new Map<string, MediaConnection>()
  /** txId -> chamada de entrada. */
  private readonly incomingCalls = new Map<string, MediaConnection>()
  private readonly pendingCalls: PendingCall[] = []
  private pendingTimer: ReturnType<typeof setInterval> | null = null
  private readonly streamsListeners = new Set<StreamsListener>()

  constructor(private readonly session: Session) {}

  // --- consulta ------------------------------------------------------------

  getLocalTransmission(): LocalTransmission | null {
    return this.local
  }

  getStream(txId: string): MediaStream | null {
    return this.remoteStreams.get(txId) ?? this.localStreamFor(txId)
  }

  getStreams(): ReadonlyMap<string, MediaStream> {
    const all = new Map(this.remoteStreams)
    if (this.local) all.set(this.local.txId, this.local.stream)
    return all
  }

  subscribeStreams(listener: StreamsListener): () => void {
    this.streamsListeners.add(listener)
    listener(this.getStreams())
    return () => this.streamsListeners.delete(listener)
  }

  private localStreamFor(txId: string): MediaStream | null {
    return this.local && this.local.txId === txId ? this.local.stream : null
  }

  private notifyStreams(): void {
    const snapshot = this.getStreams()
    for (const listener of this.streamsListeners) listener(snapshot)
  }

  // --- transmissao local ---------------------------------------------------

  /** RF-16/RF-17/RF-18: inicia a unica transmissao local permitida. */
  async startTransmission(options: StartTransmissionOptions): Promise<LocalTransmission> {
    if (this.local) throw new TransmissionInProgressError()

    const preset = PRESETS[options.presetId]
    await window.zoi.capture.selectSource({
      sourceId: options.sourceId,
      withAudio: options.withAudio
    })

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: preset.width },
          height: { ideal: preset.height },
          frameRate: { ideal: preset.frameRate }
        },
        audio: options.withAudio
      })
    } catch (error) {
      throw new CaptureFailedError(error)
    }

    const videoTrack = stream.getVideoTracks()[0]
    if (!videoTrack) {
      stream.getTracks().forEach((track) => track.stop())
      throw new CaptureFailedError(new Error('a fonte nao devolveu video'))
    }
    // Conteudo de tela em movimento (filme/jogo): prioriza taxa de quadros.
    videoTrack.contentHint = 'motion'

    const hasAudio = stream.getAudioTracks().length > 0
    if (options.withAudio && !hasAudio) {
      // RNF-10: loopback indisponivel para esta fonte; segue so com video.
      console.warn('[media] audio do sistema nao foi capturado; seguindo apenas com video')
    }

    // O usuario pode encerrar a captura pelo proprio SO (RF-20).
    videoTrack.addEventListener('ended', () => {
      if (this.local?.txId === transmission.txId) void this.stopTransmission('manual')
    })

    const transmission: LocalTransmission = {
      txId: crypto.randomUUID(),
      presetId: options.presetId,
      sourceId: options.sourceId,
      sourceLabel: options.sourceLabel,
      sourceKind: options.sourceKind,
      hasAudio,
      stream
    }
    this.local = transmission

    // Anuncia primeiro para que o TX_START chegue antes ou junto do `call`.
    this.session.announceTransmissionStart({
      txId: transmission.txId,
      presetId: transmission.presetId,
      hasAudio: transmission.hasAudio,
      sourceKind: transmission.sourceKind,
      sourceLabel: transmission.sourceLabel
    })

    for (const peerId of this.session.otherMemberPeerIds()) {
      this.callPeer(peerId)
    }

    this.notifyStreams()
    return transmission
  }

  /** RF-20: encerra por qualquer via (manual, troca de fonte, saida da sala). */
  stopTransmission(reason: TxStopReason): void {
    const transmission = this.local
    if (!transmission) return
    this.local = null

    for (const call of this.outgoingCalls.values()) call.close()
    this.outgoingCalls.clear()
    transmission.stream.getTracks().forEach((track) => track.stop())

    this.session.announceTransmissionStop(reason)
    this.notifyStreams()
  }

  /** RF-19: trocar fonte = parar a atual e comecar a nova. */
  async switchSource(options: StartTransmissionOptions): Promise<LocalTransmission> {
    this.stopTransmission('source_switch')
    return this.startTransmission(options)
  }

  private callPeer(peerId: string): void {
    const transmission = this.local
    if (!transmission) return
    this.outgoingCalls.get(peerId)?.close()
    try {
      const call = this.session.callPeer(peerId, transmission.stream, {
        txId: transmission.txId
      })
      this.outgoingCalls.set(peerId, call)
      call.on('close', () => {
        if (this.outgoingCalls.get(peerId) === call) this.outgoingCalls.delete(peerId)
      })
      call.on('error', (error) => {
        console.warn(`[media] erro na chamada para ${peerId}:`, error)
      })
      this.applySenderParameters(call, transmission.presetId)
    } catch (error) {
      console.warn(`[media] nao foi possivel chamar ${peerId}:`, error)
    }
  }

  /**
   * RF-24: parametros IDENTICOS em todos os senders. Os transceivers so existem
   * depois que a oferta e criada, entao a aplicacao e retentada por alguns ticks.
   */
  private applySenderParameters(call: MediaConnection, presetId: PresetId): void {
    const preset = PRESETS[presetId]
    let attempts = 0

    const apply = (): void => {
      attempts += 1
      const connection = call.peerConnection
      const senders = connection ? connection.getSenders() : []
      const videoSender = senders.find((sender) => sender.track?.kind === 'video')

      if (!videoSender) {
        if (attempts < 20) setTimeout(apply, 250)
        return
      }

      const parameters = videoSender.getParameters()
      if (!parameters.encodings || parameters.encodings.length === 0) {
        parameters.encodings = [{}]
      }
      for (const encoding of parameters.encodings) {
        encoding.maxBitrate = preset.maxBitrate
        encoding.maxFramerate = preset.frameRate
      }
      parameters.degradationPreference = 'maintain-framerate'
      videoSender.setParameters(parameters).catch((error: unknown) => {
        console.warn('[media] falha ao aplicar parametros do sender:', error)
      })
    }

    setTimeout(apply, 250)
  }

  // --- ganchos da sessao (MediaHooks) --------------------------------------

  /** Membro novo com transmissao local ativa: re-`call` + TX_START direto. */
  onMemberJoined(peerId: string): void {
    const transmission = this.local
    if (!transmission) return
    // Reenvia o TX_START pelo mesh para garantir o metadata no espectador tardio.
    this.session.sendTo(peerId, {
      type: 'TX_START',
      payload: {
        txId: transmission.txId,
        presetId: transmission.presetId,
        hasAudio: transmission.hasAudio,
        sourceKind: transmission.sourceKind,
        sourceLabel: transmission.sourceLabel,
        startedAt: Date.now()
      }
    })
    this.callPeer(peerId)
  }

  /** Par voltou de reconexao: refaz a chamada de midia. */
  onPeerRecovered(peerId: string): void {
    if (!this.local) return
    this.callPeer(peerId)
  }

  /** Matriz 5c: so atende chamada de peer do roster com txId conhecido. */
  onIncomingCall(call: MediaConnection): void {
    const state = this.session.getState()
    const inRoster = state.members.some((member) => member.peerId === call.peer)
    if (!inRoster) {
      call.close()
      return
    }

    const metadata = call.metadata as { txId?: unknown } | null | undefined
    const txId = typeof metadata?.txId === 'string' ? metadata.txId : null
    if (!txId) {
      call.close()
      return
    }

    const transmission = state.transmissions[txId]
    if (transmission && transmission.peerId === call.peer) {
      this.answerCall(call, txId)
      return
    }

    // TX_START ainda nao chegou: aguarda ate 5s pela correlacao.
    this.pendingCalls.push({ call, receivedAt: Date.now() })
    this.ensurePendingTimer()
  }

  private ensurePendingTimer(): void {
    if (this.pendingTimer !== null) return
    this.pendingTimer = setInterval(() => this.drainPendingCalls(), 250)
  }

  private drainPendingCalls(): void {
    const now = Date.now()
    const state = this.session.getState()

    for (let index = this.pendingCalls.length - 1; index >= 0; index -= 1) {
      const pending = this.pendingCalls[index]
      if (!pending) continue
      const metadata = pending.call.metadata as { txId?: unknown } | null | undefined
      const txId = typeof metadata?.txId === 'string' ? metadata.txId : ''
      const transmission = state.transmissions[txId]

      if (transmission && transmission.peerId === pending.call.peer) {
        this.pendingCalls.splice(index, 1)
        this.answerCall(pending.call, txId)
        continue
      }
      if (now - pending.receivedAt > CALL_METADATA_WAIT_MS) {
        this.pendingCalls.splice(index, 1)
        console.warn(`[media] chamada sem TX_START correspondente descartada (${txId})`)
        pending.call.close()
      }
    }

    if (this.pendingCalls.length === 0 && this.pendingTimer !== null) {
      clearInterval(this.pendingTimer)
      this.pendingTimer = null
    }
  }

  private answerCall(call: MediaConnection, txId: string): void {
    this.incomingCalls.get(txId)?.close()
    this.incomingCalls.set(txId, call)
    // Espectador nao devolve midia: a chamada e unidirecional.
    call.answer()
    call.on('stream', (stream: MediaStream) => {
      this.remoteStreams.set(txId, stream)
      this.notifyStreams()
    })
    call.on('close', () => {
      if (this.incomingCalls.get(txId) !== call) return
      this.incomingCalls.delete(txId)
      this.remoteStreams.delete(txId)
      this.notifyStreams()
    })
    call.on('error', (error) => {
      console.warn(`[media] erro na chamada recebida de ${call.peer}:`, error)
    })
  }

  stopLocal(reason: TxStopReason): void {
    this.stopTransmission(reason)
  }

  /** Conexoes de ENTRADA para o monitor de qualidade (RF-38). */
  inboundConnections(): RTCPeerConnection[] {
    const connections: RTCPeerConnection[] = []
    for (const call of this.incomingCalls.values()) {
      if (call.peerConnection) connections.push(call.peerConnection)
    }
    return connections
  }

  /** Remove uma transmissao remota que saiu do roster/parou. */
  dropRemote(txId: string): void {
    this.incomingCalls.get(txId)?.close()
    this.incomingCalls.delete(txId)
    if (this.remoteStreams.delete(txId)) this.notifyStreams()
  }

  teardown(): void {
    if (this.pendingTimer !== null) {
      clearInterval(this.pendingTimer)
      this.pendingTimer = null
    }
    for (const pending of this.pendingCalls.splice(0)) pending.call.close()
    for (const call of this.incomingCalls.values()) call.close()
    this.incomingCalls.clear()
    for (const call of this.outgoingCalls.values()) call.close()
    this.outgoingCalls.clear()
    this.remoteStreams.clear()
    if (this.local) {
      this.local.stream.getTracks().forEach((track) => track.stop())
      this.local = null
    }
    this.notifyStreams()
  }
}

/** Instancia unica ligada a sessao do app. */
export const mediaManager = new MediaManager(session)
session.setMediaHooks(mediaManager)
