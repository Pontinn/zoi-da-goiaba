// Diagnostico de ICE. O app nao usa TURN (decisao RF-42), entao TODA conexao
// depende de host/srflx: quando o NAT de um dos lados nao coopera, a
// RTCPeerConnection simplesmente nunca chega a `connected` e o sintoma vira
// tela preta (midia) ou "sala nao encontrada" (admissao), sem nenhuma pista.
//
// Este modulo nao muda comportamento nenhum: so observa e loga. Pilar de
// performance: zero trabalho por frame; apenas eventos de estado e UM getStats
// pontual (ao conectar e ao falhar).
import {
  ICE_ATTACH_MAX_ATTEMPTS,
  ICE_ATTACH_RETRY_INTERVAL_MS,
  ICE_DISCONNECTED_REPORT_AFTER_MS
} from '@shared/config'

/** Recorte dos campos do getStats que interessam ao diagnostico. */
export interface IceStatsEntry {
  id?: string
  type?: string
  state?: string
  nominated?: boolean
  selected?: boolean
  localCandidateId?: string
  remoteCandidateId?: string
  selectedCandidatePairId?: string
  candidateType?: string
  protocol?: string
  relayProtocol?: string
  networkType?: string
  bytesReceived?: number
  currentRoundTripTime?: number
}

export type IceStatsMap = ReadonlyMap<string, IceStatsEntry>

export interface CandidateSummary {
  /** host, srflx, prflx ou relay. */
  type: string
  /** udp ou tcp. */
  protocol: string
  networkType: string | null
}

export interface SelectedPairSummary {
  local: CandidateSummary | null
  remote: CandidateSummary | null
  state: string | null
  bytesReceived: number | null
  roundTripTimeMs: number | null
}

export interface CandidateTypes {
  local: string[]
  remote: string[]
}

const UNKNOWN = 'desconhecido'

/** Identificador curto do par, para caber no log sem virar sopa de uuid. */
export function shortPeerId(peerId: string): string {
  return peerId.slice(0, 6)
}

/** Converte o RTCStatsReport (Map-like) num Map simples e tipado. */
export function toStatsMap(report: RTCStatsReport): IceStatsMap {
  const entries = new Map<string, IceStatsEntry>()
  report.forEach((value: unknown, key: string) => {
    entries.set(key, value as IceStatsEntry)
  })
  return entries
}

/**
 * Par de candidatos EM USO. A ordem de preferencia segue o que os navegadores
 * de fato preenchem: `transport.selectedCandidatePairId` primeiro, depois as
 * marcas do proprio par.
 */
export function findSelectedPair(stats: IceStatsMap): IceStatsEntry | null {
  const pairs: IceStatsEntry[] = []
  let transportPairId: string | null = null

  for (const entry of stats.values()) {
    if (entry.type === 'transport' && typeof entry.selectedCandidatePairId === 'string') {
      transportPairId = entry.selectedCandidatePairId
    } else if (entry.type === 'candidate-pair') {
      pairs.push(entry)
    }
  }

  if (transportPairId !== null) {
    const direct = stats.get(transportPairId)
    if (direct) return direct
  }

  return (
    pairs.find((pair) => pair.selected === true) ??
    pairs.find((pair) => pair.nominated === true && pair.state === 'succeeded') ??
    pairs.find((pair) => pair.state === 'succeeded') ??
    null
  )
}

function readCandidate(stats: IceStatsMap, id: string | undefined): CandidateSummary | null {
  if (typeof id !== 'string') return null
  const entry = stats.get(id)
  if (!entry) return null
  return {
    type: entry.candidateType ?? UNKNOWN,
    protocol: entry.relayProtocol ?? entry.protocol ?? UNKNOWN,
    networkType: entry.networkType ?? null
  }
}

/** Tipos dos candidatos do par selecionado (revela o comportamento do NAT). */
export function summarizeSelectedPair(stats: IceStatsMap): SelectedPairSummary | null {
  const pair = findSelectedPair(stats)
  if (!pair) return null
  return {
    local: readCandidate(stats, pair.localCandidateId),
    remote: readCandidate(stats, pair.remoteCandidateId),
    state: pair.state ?? null,
    bytesReceived: typeof pair.bytesReceived === 'number' ? pair.bytesReceived : null,
    roundTripTimeMs:
      typeof pair.currentRoundTripTime === 'number'
        ? Math.round(pair.currentRoundTripTime * 1000)
        : null
  }
}

function describeCandidate(candidate: CandidateSummary | null): string {
  if (!candidate) return UNKNOWN
  const network = candidate.networkType ? ` (${candidate.networkType})` : ''
  return `${candidate.type}/${candidate.protocol}${network}`
}

export function describeSelectedPair(summary: SelectedPairSummary): string {
  const parts = [
    `local=${describeCandidate(summary.local)}`,
    `remoto=${describeCandidate(summary.remote)}`,
    `estado=${summary.state ?? UNKNOWN}`
  ]
  if (summary.roundTripTimeMs !== null) parts.push(`rtt=${summary.roundTripTimeMs}ms`)
  if (summary.bytesReceived !== null) parts.push(`bytesRecebidos=${summary.bytesReceived}`)
  return parts.join(' ')
}

/** Todos os tipos de candidato COLETADOS, mesmo sem par formado (caso de falha). */
export function summarizeCandidateTypes(stats: IceStatsMap): CandidateTypes {
  const local = new Set<string>()
  const remote = new Set<string>()
  for (const entry of stats.values()) {
    const label = `${entry.candidateType ?? UNKNOWN}/${entry.protocol ?? UNKNOWN}`
    if (entry.type === 'local-candidate') local.add(label)
    else if (entry.type === 'remote-candidate') remote.add(label)
  }
  return { local: [...local], remote: [...remote] }
}

function listOrNone(values: string[]): string {
  return values.length === 0 ? 'nenhum' : values.join(', ')
}

async function logConnected(connection: RTCPeerConnection, prefix: string): Promise<void> {
  try {
    const stats = toStatsMap(await connection.getStats())
    const summary = summarizeSelectedPair(stats)
    if (!summary) {
      console.info(`${prefix} conectado, mas o getStats nao trouxe par de candidatos`)
      return
    }
    console.info(`${prefix} conectado por ${describeSelectedPair(summary)}`)
  } catch (error) {
    console.warn(`${prefix} nao foi possivel ler o getStats:`, error)
  }
}

async function logFailure(
  connection: RTCPeerConnection,
  prefix: string,
  reason: string,
  generated: number
): Promise<void> {
  const gathering = connection.iceGatheringState
  const signaling = connection.signalingState
  try {
    const stats = toStatsMap(await connection.getStats())
    const candidates = summarizeCandidateTypes(stats)
    console.warn(
      `${prefix} o ICE nao fechou (${reason}). gathering=${gathering} sinalizacao=${signaling} ` +
        `gerados=${generated} ` +
        `candidatos locais=[${listOrNone(candidates.local)}] remotos=[${listOrNone(candidates.remote)}]`
    )
  } catch (error) {
    console.warn(
      `${prefix} o ICE nao fechou (${reason}). gathering=${gathering} sinalizacao=${signaling} ` +
        `gerados=${generated}; getStats indisponivel:`,
      error
    )
  }
}

/**
 * Liga o diagnostico numa RTCPeerConnection ja existente. Devolve a funcao de
 * descarte (obrigatoria: sem ela ficam listeners e um timer pendurados).
 */
export function observeIce(connection: RTCPeerConnection, tag: string): () => void {
  const prefix = `[ice ${tag}]`
  let disposed = false
  let connectedLogged = false
  let failureLogged = false
  let disconnectedTimer: ReturnType<typeof setTimeout> | null = null
  /** Candidatos LOCAIS gerados; entregar cada um e trabalho da sinalizacao. */
  let generatedCandidates = 0

  const clearDisconnectedTimer = (): void => {
    if (disconnectedTimer === null) return
    clearTimeout(disconnectedTimer)
    disconnectedTimer = null
  }

  const reportConnected = (): void => {
    if (disposed || connectedLogged) return
    connectedLogged = true
    void logConnected(connection, prefix)
  }

  const reportFailure = (reason: string): void => {
    if (disposed || failureLogged) return
    failureLogged = true
    void logFailure(connection, prefix, reason, generatedCandidates)
  }

  const onLocalCandidate = (event: RTCPeerConnectionIceEvent): void => {
    if (disposed || event.candidate === null) return
    generatedCandidates += 1
  }

  // `disconnected` costuma ser passageiro; so vira relatorio se persistir.
  const scheduleDisconnectedReport = (): void => {
    if (disposed || disconnectedTimer !== null) return
    disconnectedTimer = setTimeout(() => {
      disconnectedTimer = null
      if (connection.connectionState !== 'disconnected') return
      reportFailure('disconnected persistente')
    }, ICE_DISCONNECTED_REPORT_AFTER_MS)
  }

  const onConnectionState = (): void => {
    if (disposed) return
    const state = connection.connectionState
    if (state === 'failed') {
      console.warn(`${prefix} connectionState: failed`)
      clearDisconnectedTimer()
      reportFailure('connectionState=failed')
      return
    }
    if (state === 'disconnected') {
      console.warn(`${prefix} connectionState: disconnected`)
      scheduleDisconnectedReport()
      return
    }
    console.info(`${prefix} connectionState: ${state}`)
    if (state === 'connected') {
      clearDisconnectedTimer()
      failureLogged = false
      reportConnected()
      return
    }
    if (state === 'connecting' || state === 'new') connectedLogged = false
  }

  const onIceConnectionState = (): void => {
    if (disposed) return
    const state = connection.iceConnectionState
    if (state === 'failed') {
      console.warn(`${prefix} iceConnectionState: failed`)
      reportFailure('iceConnectionState=failed')
      return
    }
    if (state === 'disconnected') {
      console.warn(`${prefix} iceConnectionState: disconnected`)
      return
    }
    console.info(`${prefix} iceConnectionState: ${state}`)
    // Nem todo caminho passa por `connectionState` (implementacoes antigas).
    if (state === 'connected' || state === 'completed') reportConnected()
  }

  const onGatheringState = (): void => {
    if (disposed) return
    console.info(`${prefix} iceGatheringState: ${connection.iceGatheringState}`)
  }

  connection.addEventListener('connectionstatechange', onConnectionState)
  connection.addEventListener('iceconnectionstatechange', onIceConnectionState)
  connection.addEventListener('icegatheringstatechange', onGatheringState)
  connection.addEventListener('icecandidate', onLocalCandidate as EventListener)
  console.info(`${prefix} observando (connectionState=${connection.connectionState})`)

  return () => {
    if (disposed) return
    disposed = true
    clearDisconnectedTimer()
    connection.removeEventListener('connectionstatechange', onConnectionState)
    connection.removeEventListener('iceconnectionstatechange', onIceConnectionState)
    connection.removeEventListener('icegatheringstatechange', onGatheringState)
    connection.removeEventListener('icecandidate', onLocalCandidate as EventListener)
  }
}

/** Objeto do PeerJS (DataConnection ou MediaConnection) que carrega a conexao. */
export interface PeerConnectionHolder {
  peerConnection?: RTCPeerConnection | null
}

/**
 * Mesma observacao, para objetos do PeerJS: a `peerConnection` pode ainda nao
 * existir no instante em que a conexao e criada (chamada recebida, oferta em
 * negociacao), entao ha uma espera curta antes de desistir.
 */
export function observePeerJsIce(holder: PeerConnectionHolder, tag: string): () => void {
  let disposed = false
  let attempts = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let detach: (() => void) | null = null

  const attach = (): void => {
    if (disposed) return
    timer = null
    const connection = holder.peerConnection
    if (connection) {
      detach = observeIce(connection, tag)
      return
    }
    attempts += 1
    if (attempts >= ICE_ATTACH_MAX_ATTEMPTS) {
      console.warn(`[ice ${tag}] a RTCPeerConnection nunca apareceu; sem diagnostico deste par`)
      return
    }
    timer = setTimeout(attach, ICE_ATTACH_RETRY_INTERVAL_MS)
  }

  attach()

  return () => {
    if (disposed) return
    disposed = true
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    detach?.()
    detach = null
  }
}

// ---------------------------------------------------------------------------
// Contador de candidatos na SINALIZACAO
// ---------------------------------------------------------------------------

/** Recorte do socket interno do PeerJS que este diagnostico consegue usar. */
interface SignalingSocket {
  on?(event: string, handler: (message: unknown) => void): unknown
  off?(event: string, handler: (message: unknown) => void): unknown
  removeListener?(event: string, handler: (message: unknown) => void): unknown
  send?(data: unknown): unknown
}

interface SignalingMessage {
  type?: unknown
  src?: unknown
  dst?: unknown
  payload?: { connectionId?: unknown; candidate?: unknown } | null
}

const noop = (): void => {}

function readMessage(value: unknown): SignalingMessage | null {
  if (typeof value !== 'object' || value === null) return null
  return value as SignalingMessage
}

function describePeer(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? shortPeerId(value) : UNKNOWN
}

function describeConnectionId(message: SignalingMessage): string {
  const id = message.payload?.connectionId
  return typeof id === 'string' && id.length > 0 ? id.slice(-8) : UNKNOWN
}

/**
 * Conta e loga as mensagens CANDIDATE que passam pelo socket de sinalizacao do
 * PeerJS, por conexao. Existe para responder a UMA pergunta de campo: quando o
 * ICE nunca fecha numa direcao, os candidatos do outro lado chegaram a este
 * processo? Sao poucas mensagens por conexao, entao uma linha por candidato.
 *
 * O `socket` e API INTERNA do PeerJS 1.x: tudo aqui e defensivo e degrada para
 * no-op se a forma mudar. Nenhum comportamento do app depende disto.
 */
export function observeSignalingCandidates(peer: unknown, tag: string): () => void {
  const prefix = `[ice-sig ${tag}]`
  try {
    const socket = (peer as { socket?: SignalingSocket } | null)?.socket
    if (!socket || typeof socket.on !== 'function') {
      console.info(`${prefix} socket do PeerJS indisponivel; sem contagem de candidatos`)
      return noop
    }

    const received = new Map<string, number>()
    const sent = new Map<string, number>()

    const onMessage = (raw: unknown): void => {
      const message = readMessage(raw)
      if (!message || message.type !== 'CANDIDATE') return
      const key = describeConnectionId(message)
      const total = (received.get(key) ?? 0) + 1
      received.set(key, total)
      console.info(
        `${prefix} CANDIDATE recebido de ${describePeer(message.src)} conn=${key} (#${total})`
      )
    }
    socket.on('message', onMessage)

    // O `send` e opcional: sem ele fica so a contagem de entrada.
    const originalSend = typeof socket.send === 'function' ? socket.send.bind(socket) : null
    if (originalSend) {
      socket.send = (data: unknown): unknown => {
        try {
          const message = readMessage(data)
          if (message && message.type === 'CANDIDATE') {
            const key = describeConnectionId(message)
            const total = (sent.get(key) ?? 0) + 1
            sent.set(key, total)
            console.info(
              `${prefix} CANDIDATE enviado para ${describePeer(message.dst)} conn=${key} (#${total})`
            )
          }
        } catch {
          // Contagem nunca pode atrapalhar o envio real.
        }
        return originalSend(data)
      }
    }

    return () => {
      try {
        const detach = socket.off ?? socket.removeListener
        detach?.call(socket, 'message', onMessage)
        if (originalSend) socket.send = originalSend
      } catch (error) {
        console.warn(`${prefix} falha ao soltar o observador do socket:`, error)
      }
    }
  } catch (error) {
    console.warn(`${prefix} nao foi possivel observar o socket de sinalizacao:`, error)
    return noop
  }
}

/** Estado atual de uma conexao do PeerJS, para logar junto de um timeout. */
export function describeConnectionState(holder: PeerConnectionHolder): string {
  const connection = holder.peerConnection
  if (!connection) return 'sem RTCPeerConnection'
  return (
    `connectionState=${connection.connectionState} ` +
    `iceConnectionState=${connection.iceConnectionState} ` +
    `gathering=${connection.iceGatheringState}`
  )
}
