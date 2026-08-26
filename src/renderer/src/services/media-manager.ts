// Pipeline de midia: captura com preset, configuracao dos senders, distribuicao
// N-copias para o roster e recepcao correlacionada por txId (SPEC Sprint 5).
// Pilar de performance: nada aqui roda por frame; tudo e eventual.
import type { MediaConnection } from 'peerjs'
import {
  CALL_METADATA_WAIT_MS,
  ICE_ATTACH_MAX_ATTEMPTS,
  ICE_ATTACH_RETRY_INTERVAL_MS,
  MEDIA_STALL_TIMEOUT_MS
} from '@shared/config'
import { PRESETS } from '@shared/presets'
import type { PresetId, SourceKind, TxStopReason } from '@shared/protocol'
import {
  createAudioExclusionClient,
  type AudioExclusionClient,
  type AudioExclusionSession
} from './audio-exclusion'
import { ensureEncodeProbe } from './codec-capabilities'
import { observePeerJsIce, shortPeerId } from './ice-diagnostics'
import { session, type MediaHooks, type Session } from './session'
import type { InboundEntry } from './stats-monitor'

export interface StartTransmissionOptions {
  sourceId: string
  sourceLabel: string
  sourceKind: SourceKind
  presetId: PresetId
  withAudio: boolean
}

/**
 * De onde veio o audio da transmissao. `excluded` = captura por aplicativo com
 * Discord e Zoi fora do mix; `full-loopback` = som do sistema inteiro (caminho
 * degradado, identico ao comportamento antigo); `none` = transmissao sem audio.
 */
export type AudioMode = 'excluded' | 'full-loopback' | 'none'

export interface LocalTransmission {
  txId: string
  presetId: PresetId
  sourceId: string
  sourceLabel: string
  sourceKind: SourceKind
  hasAudio: boolean
  audioMode: AudioMode
  stream: MediaStream
  /** Descarte do writer/port da captura com exclusao (null nos outros modos). */
  stopAudioExclusion: (() => void) | null
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
type FailuresListener = (failures: ReadonlySet<string>) => void

interface PendingCall {
  call: MediaConnection
  receivedAt: number
}

/** Stream ficticia da chamada reversa + o que ela precisa soltar no fim. */
export interface PullStream {
  stream: MediaStream
  /** Fecha o AudioContext da faixa muda (as tracks sao paradas a parte). */
  release: () => void
}

/** Chamada REVERSA aberta pelo espectador + a stream ficticia que ela exige. */
interface PullCall {
  call: MediaConnection
  stream: MediaStream
  release: () => void
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop()
}

/**
 * Faixa de audio MUDA para a stream ficticia. Sem ela a oferta do espectador sai
 * so com m-line de video: o transmissor responde com video+audio, o audio nao
 * acha transceiver e some sem aviso (o PeerJS nao renegocia). Um destino de
 * MediaStream SEM nenhuma fonte ligada nao processa nada, entao o custo e
 * praticamente zero (pilar de performance).
 */
function attachSilentAudio(stream: MediaStream): () => void {
  try {
    const audioContext = new AudioContext()
    const track = audioContext.createMediaStreamDestination().stream.getAudioTracks()[0]
    if (!track) {
      void audioContext.close()
      return () => {}
    }
    stream.addTrack(track)
    return () => {
      audioContext.close().catch((error: unknown) => {
        console.warn('[media] falha ao fechar o audio da chamada reversa:', error)
      })
    }
  } catch (error) {
    // Degrada para video-only: a chamada reversa continua valendo, mas sem som.
    console.warn('[media] sem faixa de audio muda na chamada reversa; ela vai sem som:', error)
    return () => {}
  }
}

/**
 * Stream exigida pelo PeerJS no `call`. O espectador nao tem nada para enviar,
 * entao vai um canvas 2x2 com `captureStream(0)`: sem timer por quadro, sem
 * captura de nada e custo praticamente zero (pilar de performance). Junto vai
 * uma faixa de audio muda, para que a resposta do transmissor caiba inteira.
 */
export function createDummyStream(): PullStream | null {
  try {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 2
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = '#000000'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    const stream = canvas.captureStream(0)
    if (stream.getTracks().length === 0) return null
    return { stream, release: attachSilentAudio(stream) }
  } catch (error) {
    console.warn('[media] nao foi possivel criar a stream ficticia da chamada reversa:', error)
    return null
  }
}

/** Chamada de saida + o descarte do diagnostico de ICE dela. */
interface OutgoingCall {
  call: MediaConnection
  disposeIce: () => void
}

/**
 * Vigia de uma chamada RECEBIDA. O evento `stream` do PeerJS dispara ainda na
 * negociacao, entao ter stream nao significa ter video: sem este vigia um ICE
 * que nunca fecha fica para sempre como um retangulo preto.
 */
interface IncomingWatch {
  call: MediaConnection
  /** Prazo unico para a midia dar sinal de vida. */
  timer: ReturnType<typeof setTimeout> | null
  /** Espera pela `peerConnection` do PeerJS (ela nasce alguns ticks depois). */
  connectionTimer: ReturnType<typeof setTimeout> | null
  connectionAttempts: number
  disposeIce: () => void
  detachConnection: (() => void) | null
  detachTrack: (() => void) | null
}

export class MediaManager implements MediaHooks {
  private local: LocalTransmission | null = null
  /** txId -> stream recebida (RF-23: a mesma stream serve miniatura e player). */
  private readonly remoteStreams = new Map<string, MediaStream>()
  /** peerId -> chamada de saida ativa da transmissao local. */
  private readonly outgoingCalls = new Map<string, OutgoingCall>()
  /** txId -> chamada de entrada. */
  private readonly incomingCalls = new Map<string, MediaConnection>()
  /** txId -> vigia da chamada de entrada (watchdog + diagnostico). */
  private readonly incomingWatches = new Map<string, IncomingWatch>()
  /** txIds cuja midia foi anunciada e nunca chegou (AC-25). */
  private readonly mediaFailures = new Set<string>()
  /** txId -> chamada reversa aberta por ESTE espectador (fallback de direcao). */
  private readonly pullCalls = new Map<string, PullCall>()
  /** txIds que ja tentaram a chamada reversa nesta falha (uma tentativa so). */
  private readonly pullAttempts = new Set<string>()
  private readonly pendingCalls: PendingCall[] = []
  private pendingTimer: ReturnType<typeof setInterval> | null = null
  private readonly streamsListeners = new Set<StreamsListener>()
  private readonly failuresListeners = new Set<FailuresListener>()

  constructor(
    private readonly session: Session,
    /** Injetavel nos testes: o canvas e o AudioContext so existem no renderer. */
    private readonly createPullStream: () => PullStream | null = createDummyStream,
    /** Injetavel nos testes: depende de IPC e do breakout box do Chromium. */
    private readonly audioExclusion: AudioExclusionClient = createAudioExclusionClient()
  ) {}

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

  /** txIds cuja midia foi atendida mas nunca chegou (a UI mostra o erro). */
  getMediaFailures(): ReadonlySet<string> {
    return new Set(this.mediaFailures)
  }

  subscribeMediaFailures(listener: FailuresListener): () => void {
    this.failuresListeners.add(listener)
    listener(this.getMediaFailures())
    return () => this.failuresListeners.delete(listener)
  }

  private notifyMediaFailures(): void {
    const snapshot = this.getMediaFailures()
    for (const listener of this.failuresListeners) listener(snapshot)
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
    // A sonda de codificacao depende do preset escolhido e e aguardada: quem
    // escolhe o codec da sala precisa da lista pronta. Cacheada por preset, na
    // pior hipotese resolve com ['VP8'].
    await ensureEncodeProbe(options.presetId)

    // A exclusao e armada ANTES da captura de video: com ela ativa o audio nao
    // vem mais do getDisplayMedia, e sim da nossa track gerada.
    let exclusion: AudioExclusionSession | null = null
    if (options.withAudio) {
      const outcome = await this.audioExclusion.start()
      exclusion = outcome.session
      if (!exclusion) {
        console.warn(
          `[media] captura por aplicativo indisponivel (${outcome.reason ?? 'sem motivo'})`
        )
      }
    }
    const useSystemLoopback = options.withAudio && exclusion === null

    await window.zoi.capture.selectSource({
      sourceId: options.sourceId,
      withAudio: useSystemLoopback
    })

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: preset.width },
          height: { ideal: preset.height },
          frameRate: { ideal: preset.frameRate }
        },
        audio: useSystemLoopback
      })
    } catch (error) {
      // Nao deixar worker armado para tras quando o usuario cancela o seletor.
      exclusion?.stop()
      throw new CaptureFailedError(error)
    }

    const videoTrack = stream.getVideoTracks()[0]
    if (!videoTrack) {
      stream.getTracks().forEach((track) => track.stop())
      exclusion?.stop()
      throw new CaptureFailedError(new Error('a fonte nao devolveu video'))
    }
    // Conteudo de tela em movimento (filme/jogo): prioriza taxa de quadros.
    videoTrack.contentHint = 'motion'

    // A track entra na stream ANTES do announce e das chamadas: os dois
    // caminhos de midia (direto e pull) herdam o audio sem tocar em nada.
    if (exclusion) stream.addTrack(exclusion.track)

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
      audioMode: !options.withAudio ? 'none' : exclusion ? 'excluded' : 'full-loopback',
      stream,
      stopAudioExclusion: exclusion ? () => exclusion.stop() : null
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

    for (const outgoing of this.outgoingCalls.values()) {
      outgoing.disposeIce()
      outgoing.call.close()
    }
    this.outgoingCalls.clear()
    transmission.stream.getTracks().forEach((track) => track.stop())
    transmission.stopAudioExclusion?.()

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
    this.closeOutgoing(peerId)
    try {
      const call = this.session.callPeer(peerId, transmission.stream, {
        txId: transmission.txId
      })
      this.outgoingCalls.set(peerId, {
        call,
        disposeIce: observePeerJsIce(call, `media-out:${shortPeerId(peerId)}`)
      })
      call.on('close', () => {
        if (this.outgoingCalls.get(peerId)?.call === call) this.closeOutgoing(peerId)
      })
      call.on('error', (error) => {
        console.warn(`[media] erro na chamada para ${peerId}:`, error)
      })
      this.applySenderParameters(call, transmission.presetId)
    } catch (error) {
      console.warn(`[media] nao foi possivel chamar ${peerId}:`, error)
    }
  }

  /** Encerra a chamada de saida de um par e o diagnostico dela. */
  private closeOutgoing(peerId: string): void {
    const outgoing = this.outgoingCalls.get(peerId)
    if (!outgoing) return
    this.outgoingCalls.delete(peerId)
    outgoing.disposeIce()
    outgoing.call.close()
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

    const metadata = call.metadata as { txId?: unknown; pull?: unknown } | null | undefined
    const txId = typeof metadata?.txId === 'string' ? metadata.txId : null
    if (!txId) {
      call.close()
      return
    }

    // Chamada REVERSA: o espectador esta puxando a midia porque a chamada que
    // saiu daqui nunca chegou nele.
    if (metadata?.pull === true) {
      this.answerPull(call, txId)
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
    this.stopIncomingWatch(txId)
    // Espectador nao devolve midia: a chamada e unidirecional.
    call.answer()
    this.bindIncoming(call, txId, `media-in:${shortPeerId(call.peer)}`)
  }

  /** Liga uma chamada de ENTRADA (recebida ou puxada) ao txId dela. */
  private bindIncoming(call: MediaConnection, txId: string, tag: string): void {
    this.incomingCalls.set(txId, call)
    this.startIncomingWatch(call, txId, tag)
    call.on('stream', (stream: MediaStream) => {
      this.remoteStreams.set(txId, stream)
      this.watchIncomingTrack(txId, stream)
      this.notifyStreams()
    })
    call.on('close', () => {
      if (this.incomingCalls.get(txId) !== call) return
      this.incomingCalls.delete(txId)
      this.stopIncomingWatch(txId)
      this.clearMediaFailure(txId)
      this.closePull(txId)
      this.remoteStreams.delete(txId)
      this.notifyStreams()
    })
    call.on('error', (error) => {
      console.warn(`[media] erro na chamada de midia com ${call.peer}:`, error)
    })
  }

  /** Solta a chamada de entrada atual do txId SEM apagar o estado de falha. */
  private detachIncoming(txId: string): void {
    const previous = this.incomingCalls.get(txId)
    this.incomingCalls.delete(txId)
    this.stopIncomingWatch(txId)
    if (!previous) return
    previous.close()
    if (this.remoteStreams.delete(txId)) this.notifyStreams()
  }

  // --- fallback de direcao da midia ---------------------------------------

  /**
   * Lado ESPECTADOR: a chamada do transmissor nao chegou. Sem TURN (RF-42) uma
   * das duas direcoes pode simplesmente nunca fechar o ICE, entao vale tentar a
   * outra: quem disca agora e quem quer assistir. Uma tentativa por falha.
   */
  private startMediaPull(txId: string): void {
    if (this.pullAttempts.has(txId)) return
    const state = this.session.getState()
    const txPeerId = state.transmissions[txId]?.peerId ?? ''
    if (txPeerId === '' || txPeerId === state.selfPeerId) return
    if (!state.members.some((member) => member.peerId === txPeerId)) return
    this.pullAttempts.add(txId)

    const dummy = this.createPullStream()
    if (!dummy) return

    let call: MediaConnection
    try {
      call = this.session.callPeer(txPeerId, dummy.stream, { txId, pull: true })
    } catch (error) {
      console.warn(`[media] nao foi possivel puxar a transmissao ${txId}:`, error)
      stopTracks(dummy.stream)
      dummy.release()
      return
    }

    console.info(`[media] a chamada de ${txPeerId} nao chegou; puxando ${txId} na outra direcao`)
    this.closePull(txId)
    this.detachIncoming(txId)
    this.pullCalls.set(txId, { call, stream: dummy.stream, release: dummy.release })
    this.bindIncoming(call, txId, `media-pull-out:${shortPeerId(txPeerId)}`)
  }

  /**
   * Lado TRANSMISSOR: um espectador puxou a transmissao LOCAL ativa. A chamada
   * reversa vira o canal de envio para aquele par, no lugar da que falhou.
   */
  private answerPull(call: MediaConnection, txId: string): void {
    const transmission = this.local
    if (!transmission || transmission.txId !== txId) {
      console.warn(`[media] ${call.peer} pediu uma transmissao que nao esta no ar (${txId})`)
      call.close()
      return
    }

    const peerId = call.peer
    console.info(`[media] ${peerId} puxou a transmissao ${txId}; respondendo pela outra direcao`)
    // A chamada antiga para este par morreu: a nova toma o lugar dela.
    this.closeOutgoing(peerId)
    this.outgoingCalls.set(peerId, {
      call,
      disposeIce: observePeerJsIce(call, `media-pull-in:${shortPeerId(peerId)}`)
    })
    // A oferta da reversa tem m-line de video E de audio: vai a transmissao
    // inteira. Sem audio na captura (hasAudio false) o m-line de audio fica
    // vazio e a chamada segue so com video, como antes.
    call.answer(transmission.stream)
    call.on('close', () => {
      if (this.outgoingCalls.get(peerId)?.call === call) this.closeOutgoing(peerId)
    })
    call.on('error', (error) => {
      console.warn(`[media] erro na chamada puxada por ${peerId}:`, error)
    })
    this.applySenderParameters(call, transmission.presetId)
  }

  /** Encerra a chamada reversa de um txId e solta a stream ficticia dela. */
  private closePull(txId: string): void {
    const pull = this.pullCalls.get(txId)
    if (!pull) return
    this.pullCalls.delete(txId)
    stopTracks(pull.stream)
    pull.release()
    pull.call.close()
  }

  // --- vigia da midia recebida (tela preta silenciosa) ---------------------

  private startIncomingWatch(call: MediaConnection, txId: string, tag: string): void {
    const watch: IncomingWatch = {
      call,
      timer: null,
      connectionTimer: null,
      connectionAttempts: 0,
      disposeIce: observePeerJsIce(call, tag),
      detachConnection: null,
      detachTrack: null
    }
    this.incomingWatches.set(txId, watch)
    watch.timer = setTimeout(() => {
      watch.timer = null
      this.reviewIncoming(txId, 'deadline')
    }, MEDIA_STALL_TIMEOUT_MS)
    this.trackConnectionState(txId, watch)
  }

  /** A `peerConnection` do PeerJS nasce alguns ticks depois do `answer()`. */
  private trackConnectionState(txId: string, watch: IncomingWatch): void {
    if (this.incomingWatches.get(txId) !== watch) return
    const connection = watch.call.peerConnection
    if (!connection) {
      watch.connectionAttempts += 1
      if (watch.connectionAttempts >= ICE_ATTACH_MAX_ATTEMPTS) return
      watch.connectionTimer = setTimeout(() => {
        watch.connectionTimer = null
        this.trackConnectionState(txId, watch)
      }, ICE_ATTACH_RETRY_INTERVAL_MS)
      return
    }

    const listener = (): void => {
      if (connection.connectionState === 'failed') this.markMediaFailure(txId)
      else if (connection.connectionState === 'connected') this.reviewIncoming(txId, 'recovery')
    }
    connection.addEventListener('connectionstatechange', listener)
    watch.detachConnection = () => connection.removeEventListener('connectionstatechange', listener)
  }

  /** A track remota nasce `muted` e so desmuta quando o primeiro RTP chega. */
  private watchIncomingTrack(txId: string, stream: MediaStream): void {
    const watch = this.incomingWatches.get(txId)
    if (!watch) return
    watch.detachTrack?.()
    watch.detachTrack = null
    const track = stream.getVideoTracks()[0]
    if (!track) return
    const onUnmute = (): void => this.reviewIncoming(txId, 'recovery')
    track.addEventListener('unmute', onUnmute)
    watch.detachTrack = () => track.removeEventListener('unmute', onUnmute)
  }

  /** Chegou video de verdade: conexao estabelecida E track recebendo quadros. */
  private isIncomingHealthy(txId: string): boolean {
    const watch = this.incomingWatches.get(txId)
    if (!watch) return true
    const connection = watch.call.peerConnection
    if (!connection || connection.connectionState !== 'connected') return false
    const track = this.remoteStreams.get(txId)?.getVideoTracks()[0]
    return track !== undefined && !track.muted
  }

  /**
   * `deadline`: passou o prazo, o veredito e final (falhou ou nao).
   * `recovery`: algo melhorou; so serve para LIMPAR uma falha ja marcada.
   */
  private reviewIncoming(txId: string, moment: 'deadline' | 'recovery'): void {
    if (this.isIncomingHealthy(txId)) {
      this.clearMediaFailure(txId)
      return
    }
    if (moment === 'deadline') this.markMediaFailure(txId)
  }

  private markMediaFailure(txId: string): void {
    if (this.mediaFailures.has(txId)) return
    const peerId = this.incomingWatches.get(txId)?.call.peer ?? ''
    this.mediaFailures.add(txId)
    this.notifyMediaFailures()
    this.session.notifyMediaFailure(txId, peerId)
    // Ultimo recurso: tentar a direcao contraria antes de desistir de vez.
    this.startMediaPull(txId)
  }

  private clearMediaFailure(txId: string): void {
    // A falha acabou: uma falha futura tem direito a uma nova chamada reversa.
    this.pullAttempts.delete(txId)
    if (!this.mediaFailures.delete(txId)) return
    console.info(`[media] a transmissao ${txId} finalmente chegou; erro removido`)
    this.notifyMediaFailures()
  }

  private stopIncomingWatch(txId: string): void {
    const watch = this.incomingWatches.get(txId)
    if (!watch) return
    this.incomingWatches.delete(txId)
    if (watch.timer !== null) clearTimeout(watch.timer)
    if (watch.connectionTimer !== null) clearTimeout(watch.connectionTimer)
    watch.detachConnection?.()
    watch.detachTrack?.()
    watch.disposeIce()
  }

  stopLocal(reason: TxStopReason): void {
    this.stopTransmission(reason)
  }

  /**
   * Conexoes de ENTRADA para o monitor de qualidade (RF-38), ETIQUETADAS pela
   * transmissao: cada chamada de entrada corresponde a exatamente um txId, e a
   * etiqueta e o que permite ler contadores de quadro por transmissao sem um
   * segundo laco de `getStats()`. Leitura passiva: nao decide nada de conexao.
   */
  inboundEntries(): InboundEntry[] {
    const entries: InboundEntry[] = []
    for (const [txId, call] of this.incomingCalls.entries()) {
      if (call.peerConnection) entries.push({ txId, connection: call.peerConnection })
    }
    return entries
  }

  /** Remove uma transmissao remota que saiu do roster/parou. */
  dropRemote(txId: string): void {
    this.stopIncomingWatch(txId)
    this.clearMediaFailure(txId)
    this.closePull(txId)
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
    for (const txId of [...this.pullCalls.keys()]) this.closePull(txId)
    this.pullAttempts.clear()
    for (const txId of [...this.incomingWatches.keys()]) this.stopIncomingWatch(txId)
    if (this.mediaFailures.size > 0) {
      this.mediaFailures.clear()
      this.notifyMediaFailures()
    }
    for (const call of this.incomingCalls.values()) call.close()
    this.incomingCalls.clear()
    for (const outgoing of this.outgoingCalls.values()) {
      outgoing.disposeIce()
      outgoing.call.close()
    }
    this.outgoingCalls.clear()
    this.remoteStreams.clear()
    if (this.local) {
      this.local.stream.getTracks().forEach((track) => track.stop())
      this.local.stopAudioExclusion?.()
      this.local = null
    }
    this.notifyStreams()
  }
}

/** Instancia unica ligada a sessao do app. */
export const mediaManager = new MediaManager(session)
session.setMediaHooks(mediaManager)
