// Reducer PURO do estado de sala (SPEC secao 2.3 e 5.A/5c).
// Recebe mensagens ja validadas + eventos locais de transporte e devolve o novo
// estado mais uma lista de EFEITOS declarativos que a camada de servicos executa.
// Nenhum import de PeerJS, DOM ou Electron: 100% testavel.
import { HELLO_QUARANTINE_MS } from '@shared/config'
import type { SoundId } from '@shared/sounds'
import {
  type BanEntry,
  type JoinAcceptPayload,
  type ModRemoveMode,
  type PresetId,
  type ProtocolMessage,
  type QualityLevel,
  type RoomMeta,
  type RosterChangeKind,
  type RosterMember,
  type RosterUpdatePayload,
  type SourceKind,
  type TxStopReason
} from '@shared/protocol'
import { electOwnerExcluding } from './election'

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export type RoomPhase = 'idle' | 'connecting' | 'active' | 'ended'

export type EndReason = 'left' | 'kicked' | 'banned' | 'connection_lost'

export type PeerLinkStatus = 'connecting' | 'up' | 'reconnecting' | 'timeout' | 'unreachable'

export interface PeerLink {
  peerId: string
  status: PeerLinkStatus
  since: number
  lastSeenAt: number
}

export type TransmissionStatus = 'live' | 'reconnecting'

export interface TransmissionState {
  txId: string
  /** peerId de QUEM transmite. */
  peerId: string
  presetId: PresetId
  hasAudio: boolean
  sourceKind: SourceKind
  sourceLabel: string
  startedAt: number
  status: TransmissionStatus
}

export interface QualitySample {
  level: QualityLevel
  rttMs: number
  inboundBitrateKbps: number | null
  receivedAt: number
}

export interface PendingHello {
  peerId: string
  nickname: string
  joinedAt: number
  expiresAt: number
}

export interface RoomState {
  phase: RoomPhase
  endReason: EndReason | null
  roomMeta: RoomMeta | null
  rosterVersion: number
  ownerPeerId: string | null
  selfPeerId: string
  selfInstallId: string
  members: RosterMember[]
  banList: BanEntry[]
  /** Chaveado por txId. */
  transmissions: Record<string, TransmissionState>
  /** peerId -> txId que ele assiste (RF-37). */
  watching: Record<string, string | null>
  selfWatchingTxId: string | null
  /** peerId -> ultima amostra de qualidade (RF-38). */
  quality: Record<string, QualitySample>
  /** peerId -> estado do link de mesh. */
  peerLinks: Record<string, PeerLink>
  pendingHellos: PendingHello[]
  /** peerIds cujo som "entrou" ja tocou (evita tocar duas vezes por par). */
  announcedPeers: string[]
}

export function createInitialState(selfPeerId = '', selfInstallId = ''): RoomState {
  return {
    phase: 'idle',
    endReason: null,
    roomMeta: null,
    rosterVersion: 0,
    ownerPeerId: null,
    selfPeerId,
    selfInstallId,
    members: [],
    banList: [],
    transmissions: {},
    watching: {},
    selfWatchingTxId: null,
    quality: {},
    peerLinks: {},
    pendingHellos: [],
    announcedPeers: []
  }
}

// ---------------------------------------------------------------------------
// Efeitos
// ---------------------------------------------------------------------------

export type ToastTone = 'info' | 'success' | 'warning' | 'danger'

export type Effect =
  | { kind: 'playSound'; sound: SoundId }
  | { kind: 'showToast'; tone: ToastTone; text: string }
  | { kind: 'send'; to: string; message: ProtocolMessage }
  | { kind: 'broadcast'; message: ProtocolMessage }
  | { kind: 'closeConnection'; peerId: string }
  | { kind: 'log'; level: 'info' | 'warn'; text: string }
  /** O cliente virou dono: registrar o door peer e passar a emitir ROSTER_UPDATE. */
  | { kind: 'assumeOwnership'; rebroadcast: boolean }
  /** Dono saindo: liberar o id do door ANTES de anunciar a transferencia (R5). */
  | { kind: 'releaseDoor' }
  /** Par inalcancavel que segue no roster do dono: tentar reconectar em background. */
  | { kind: 'scheduleRedial'; peerId: string }
  /** Encerrar a sessao P2P local (destruir peers). */
  | { kind: 'destroySession'; reason: EndReason }
  /** Parar a transmissao local em curso. */
  | { kind: 'stopLocalTransmission'; reason: TxStopReason }

export interface ReducerResult {
  state: RoomState
  effects: Effect[]
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export interface RoomCreatedEvent {
  kind: 'ROOM_CREATED'
  roomMeta: RoomMeta
  selfPeerId: string
  selfInstallId: string
  nickname: string
  now: number
}

export interface RoomJoinedEvent {
  kind: 'ROOM_JOINED'
  accept: JoinAcceptPayload
  selfPeerId: string
  selfInstallId: string
  now: number
}

export interface MessageEvent {
  kind: 'MESSAGE'
  from: string
  message: ProtocolMessage
  now: number
}

export interface PeerLinkEvent {
  kind:
    | 'PEER_LINK_UP'
    | 'PEER_LINK_RECONNECTING'
    | 'PEER_LINK_RECONNECT_TIMEOUT'
    | 'PEER_LINK_FAILED'
  peerId: string
  now: number
}

export interface HelloQuarantineEvent {
  kind: 'HELLO_QUARANTINE_TICK'
  now: number
}

export interface OwnerAdmitEvent {
  kind: 'OWNER_ADMIT'
  member: RosterMember
  members: RosterMember[]
  rosterVersion: number
  now: number
}

export interface OwnerRemoveEvent {
  kind: 'OWNER_REMOVE'
  peerId: string
  mode: ModRemoveMode
  now: number
}

export interface LocalNicknameEvent {
  kind: 'LOCAL_NICKNAME'
  nickname: string
  now: number
}

export interface LocalTxStartEvent {
  kind: 'LOCAL_TX_START'
  txId: string
  presetId: PresetId
  hasAudio: boolean
  sourceKind: SourceKind
  sourceLabel: string
  now: number
}

export interface LocalTxStopEvent {
  kind: 'LOCAL_TX_STOP'
  reason: TxStopReason
  now: number
}

export interface LocalWatchingEvent {
  kind: 'LOCAL_WATCHING'
  txId: string | null
  now: number
}

export interface LocalQualityEvent {
  kind: 'LOCAL_QUALITY'
  level: QualityLevel
  rttMs: number
  inboundBitrateKbps: number | null
  now: number
}

export interface SelfLeaveEvent {
  kind: 'SELF_LEAVE'
  now: number
}

export type RoomEvent =
  | RoomCreatedEvent
  | RoomJoinedEvent
  | MessageEvent
  | PeerLinkEvent
  | HelloQuarantineEvent
  | OwnerAdmitEvent
  | OwnerRemoveEvent
  | LocalNicknameEvent
  | LocalTxStartEvent
  | LocalTxStopEvent
  | LocalWatchingEvent
  | LocalQualityEvent
  | SelfLeaveEvent

// ---------------------------------------------------------------------------
// Helpers puros
// ---------------------------------------------------------------------------

export function isOwner(state: RoomState): boolean {
  return state.ownerPeerId !== null && state.ownerPeerId === state.selfPeerId
}

export function findMember(state: RoomState, peerId: string): RosterMember | undefined {
  return state.members.find((member) => member.peerId === peerId)
}

export function nicknameOf(state: RoomState, peerId: string): string {
  return findMember(state, peerId)?.nickname ?? peerId.slice(0, 6)
}

function withLink(
  state: RoomState,
  peerId: string,
  status: PeerLinkStatus,
  now: number
): Record<string, PeerLink> {
  const previous = state.peerLinks[peerId]
  return {
    ...state.peerLinks,
    [peerId]: {
      peerId,
      status,
      since: previous?.status === status ? previous.since : now,
      lastSeenAt: status === 'up' ? now : (previous?.lastSeenAt ?? now)
    }
  }
}

function withoutKeys<T>(record: Record<string, T>, keys: readonly string[]): Record<string, T> {
  if (keys.length === 0) return record
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(record)) {
    if (!keys.includes(key)) next[key] = value
  }
  return next
}

function transmissionsOf(state: RoomState, peerId: string): TransmissionState[] {
  return Object.values(state.transmissions).filter(
    (transmission) => transmission.peerId === peerId
  )
}

function dropTransmissionsOf(
  state: RoomState,
  peerIds: readonly string[]
): { transmissions: Record<string, TransmissionState>; droppedTxIds: string[] } {
  const droppedTxIds = Object.values(state.transmissions)
    .filter((transmission) => peerIds.includes(transmission.peerId))
    .map((transmission) => transmission.txId)
  return {
    transmissions: withoutKeys(state.transmissions, droppedTxIds),
    droppedTxIds
  }
}

/** Snapshot de ROSTER_UPDATE montado pelo dono a partir do estado atual. */
export function buildRosterUpdate(
  state: RoomState,
  lastChange: { kind: RosterChangeKind; targetPeerId: string }
): RosterUpdatePayload {
  return {
    rosterVersion: state.rosterVersion,
    ownerPeerId: state.ownerPeerId ?? state.selfPeerId,
    members: state.members.map((member) => ({ ...member })),
    banList: state.banList.map((entry) => ({ ...entry })),
    lastChange
  }
}

function markOwner(members: readonly RosterMember[], ownerPeerId: string): RosterMember[] {
  return members.map((member) => ({ ...member, isOwner: member.peerId === ownerPeerId }))
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduce(state: RoomState, event: RoomEvent): ReducerResult {
  switch (event.kind) {
    case 'ROOM_CREATED':
      return applyRoomCreated(state, event)
    case 'ROOM_JOINED':
      return applyRoomJoined(state, event)
    case 'MESSAGE':
      return applyMessage(state, event)
    case 'PEER_LINK_UP':
    case 'PEER_LINK_RECONNECTING':
    case 'PEER_LINK_RECONNECT_TIMEOUT':
    case 'PEER_LINK_FAILED':
      return applyPeerLink(state, event)
    case 'HELLO_QUARANTINE_TICK':
      return applyQuarantineTick(state, event)
    case 'OWNER_ADMIT':
      return applyOwnerAdmit(state, event)
    case 'OWNER_REMOVE':
      return applyOwnerRemove(state, event)
    case 'LOCAL_NICKNAME':
      return applyLocalNickname(state, event)
    case 'LOCAL_TX_START':
      return applyLocalTxStart(state, event)
    case 'LOCAL_TX_STOP':
      return applyLocalTxStop(state, event)
    case 'LOCAL_WATCHING':
      return applyLocalWatching(state, event)
    case 'LOCAL_QUALITY':
      return applyLocalQuality(state, event)
    case 'SELF_LEAVE':
      return applySelfLeave(state)
    default:
      return { state, effects: [] }
  }
}

/** Aplica uma sequencia de eventos acumulando efeitos (util em testes e no orquestrador). */
export function reduceAll(state: RoomState, events: readonly RoomEvent[]): ReducerResult {
  let current = state
  const effects: Effect[] = []
  for (const event of events) {
    const result = reduce(current, event)
    current = result.state
    effects.push(...result.effects)
  }
  return { state: current, effects }
}

// --- criacao e ingresso ----------------------------------------------------

function applyRoomCreated(state: RoomState, event: RoomCreatedEvent): ReducerResult {
  const self: RosterMember = {
    peerId: event.selfPeerId,
    installId: event.selfInstallId,
    nickname: event.nickname,
    joinedAt: event.now,
    isOwner: true
  }
  return {
    state: {
      ...createInitialState(event.selfPeerId, event.selfInstallId),
      phase: 'active',
      roomMeta: event.roomMeta,
      rosterVersion: 1,
      ownerPeerId: event.selfPeerId,
      members: [self],
      announcedPeers: [event.selfPeerId]
    },
    effects: [{ kind: 'assumeOwnership', rebroadcast: false }]
  }
}

function applyRoomJoined(state: RoomState, event: RoomJoinedEvent): ReducerResult {
  const { accept } = event
  const members = markOwner(accept.members, accept.ownerPeerId)
  const peerLinks: Record<string, PeerLink> = {}
  for (const member of members) {
    if (member.peerId === event.selfPeerId) continue
    peerLinks[member.peerId] = {
      peerId: member.peerId,
      status: 'connecting',
      since: event.now,
      lastSeenAt: event.now
    }
  }
  return {
    state: {
      ...createInitialState(event.selfPeerId, event.selfInstallId),
      phase: 'active',
      roomMeta: accept.roomMeta,
      rosterVersion: accept.rosterVersion,
      ownerPeerId: accept.ownerPeerId,
      members,
      banList: accept.banList.map((entry) => ({ ...entry })),
      peerLinks,
      // Quem ja estava na sala nao dispara som de "entrou" para quem chega agora.
      announcedPeers: members.map((member) => member.peerId)
    },
    effects: []
  }
}

// --- mensagens do protocolo ------------------------------------------------

function applyMessage(state: RoomState, event: MessageEvent): ReducerResult {
  const { from, message, now } = event
  const senderIsOwner = state.ownerPeerId !== null && from === state.ownerPeerId
  const senderIsMember = state.members.some((member) => member.peerId === from)

  switch (message.type) {
    case 'HELLO':
      return applyHello(state, from, message.payload.nickname, message.payload.joinedAt, now)

    case 'ROSTER_UPDATE':
      return applyRosterUpdate(state, from, message.payload, senderIsOwner, senderIsMember, now)

    case 'MOD_REMOVE': {
      if (!senderIsOwner) {
        // RF-34: kick/ban forjado por membro e inocuo.
        return {
          state,
          effects: [
            { kind: 'log', level: 'warn', text: `MOD_REMOVE de nao-dono ignorado (${from})` }
          ]
        }
      }
      const reason: EndReason = message.payload.mode === 'ban' ? 'banned' : 'kicked'
      return {
        state: { ...state, phase: 'ended', endReason: reason },
        effects: [
          { kind: 'playSound', sound: 'removed' },
          { kind: 'destroySession', reason }
        ]
      }
    }

    case 'OWNER_TRANSFER': {
      if (!senderIsOwner) {
        return rejectFrom(state, from, senderIsMember, 'OWNER_TRANSFER')
      }
      const target = findMember(state, message.payload.newOwnerPeerId)
      if (!target) {
        return {
          state,
          effects: [
            { kind: 'log', level: 'warn', text: 'OWNER_TRANSFER para peer fora do roster' }
          ]
        }
      }
      const rosterVersion = Math.max(state.rosterVersion, message.payload.rosterVersion)
      const nextState: RoomState = {
        ...state,
        ownerPeerId: target.peerId,
        rosterVersion,
        members: markOwner(state.members, target.peerId)
      }
      const effects: Effect[] = [
        {
          kind: 'showToast',
          tone: 'info',
          text: `${target.nickname} agora e o dono da sala.`
        }
      ]
      if (target.peerId === state.selfPeerId) {
        // Re-emissao do primeiro ROSTER_UPDATE (secao 2.7): na saida voluntaria o
        // OWNER_TRANSFER e o ROSTER_UPDATE do sucessor viajam por links
        // diferentes, entao um membro pode receber o snapshot ANTES de adotar o
        // novo dono e rejeita-lo. Sem a re-emissao, esse membro nunca converge.
        effects.push({ kind: 'assumeOwnership', rebroadcast: true })
      }
      return { state: nextState, effects }
    }

    case 'NICKNAME_UPDATE': {
      if (!senderIsMember) return rejectFrom(state, from, senderIsMember, 'NICKNAME_UPDATE')
      const nickname = message.payload.nickname.trim()
      if (nickname.length === 0) return { state, effects: [] }
      const members = state.members.map((member) =>
        member.peerId === from ? { ...member, nickname } : member
      )
      const nextState: RoomState = { ...state, members }
      if (!isOwner(state)) return { state: nextState, effects: [] }
      // O dono consolida a mudanca no proximo ROSTER_UPDATE.
      const consolidated: RoomState = { ...nextState, rosterVersion: state.rosterVersion + 1 }
      return {
        state: consolidated,
        effects: [
          {
            kind: 'broadcast',
            message: {
              type: 'ROSTER_UPDATE',
              payload: buildRosterUpdate(consolidated, { kind: 'nickname', targetPeerId: from })
            }
          }
        ]
      }
    }

    case 'TX_START': {
      if (!senderIsMember) return rejectFrom(state, from, senderIsMember, 'TX_START')
      const payload = message.payload
      // RF-18: TX_START novo do mesmo peer substitui o anterior.
      const previous = transmissionsOf(state, from).map((transmission) => transmission.txId)
      // A copia e obrigatoria: `withoutKeys` devolve o MESMO objeto quando nao ha
      // o que remover, e escrever nele mutaria o estado anterior (a UI compara
      // por identidade para decidir o re-render).
      const transmissions = { ...withoutKeys(state.transmissions, previous) }
      transmissions[payload.txId] = {
        txId: payload.txId,
        peerId: from,
        presetId: payload.presetId,
        hasAudio: payload.hasAudio,
        sourceKind: payload.sourceKind,
        sourceLabel: payload.sourceLabel,
        startedAt: payload.startedAt,
        status: 'live'
      }
      const selfWatchingTxId = previous.includes(state.selfWatchingTxId ?? '')
        ? null
        : state.selfWatchingTxId
      return {
        state: { ...state, transmissions, selfWatchingTxId },
        effects: [
          { kind: 'playSound', sound: 'transmitting' },
          {
            kind: 'showToast',
            tone: 'info',
            text: `${nicknameOf(state, from)} comecou a transmitir.`
          }
        ]
      }
    }

    case 'TX_STOP': {
      if (!senderIsMember) return rejectFrom(state, from, senderIsMember, 'TX_STOP')
      const transmission = state.transmissions[message.payload.txId]
      if (!transmission || transmission.peerId !== from) {
        return {
          state,
          effects: [{ kind: 'log', level: 'warn', text: 'TX_STOP de transmissao desconhecida' }]
        }
      }
      const transmissions = withoutKeys(state.transmissions, [transmission.txId])
      const stoppedWatched = state.selfWatchingTxId === transmission.txId
      return {
        state: {
          ...state,
          transmissions,
          selfWatchingTxId: stoppedWatched ? null : state.selfWatchingTxId
        },
        effects: [
          { kind: 'playSound', sound: 'stoppedTransmitting' },
          {
            kind: 'showToast',
            tone: 'info',
            text: `${nicknameOf(state, from)} parou de transmitir.`
          }
        ]
      }
    }

    case 'WATCHING_UPDATE': {
      if (!senderIsMember) return rejectFrom(state, from, senderIsMember, 'WATCHING_UPDATE')
      return {
        state: {
          ...state,
          watching: { ...state.watching, [from]: message.payload.watchingTxId }
        },
        effects: []
      }
    }

    case 'QUALITY_UPDATE': {
      if (!senderIsMember) return rejectFrom(state, from, senderIsMember, 'QUALITY_UPDATE')
      return {
        state: {
          ...state,
          quality: {
            ...state.quality,
            [from]: {
              level: message.payload.level,
              rttMs: message.payload.rttMs,
              inboundBitrateKbps: message.payload.inboundBitrateKbps,
              receivedAt: now
            }
          }
        },
        effects: []
      }
    }

    case 'LEAVE': {
      if (!senderIsMember) return { state, effects: [] }
      const effects: Effect[] = [{ kind: 'closeConnection', peerId: from }]
      // Nao-dono apenas fecha a conexao: o som e o roster vem do ROSTER_UPDATE do dono.
      if (!isOwner(state)) {
        // O DONO avisou que esta saindo: o link com ele deixa de ser saudavel na
        // hora. Sem isso a condicao (b) do handover (secao 2.7) continuaria vendo
        // um dono "up" que ja nao existe, e o snapshot do sucessor seria rejeitado
        // para sempre (o `closeConnection` acima nao gera evento de link).
        if (from === state.ownerPeerId) {
          return { state: { ...state, peerLinks: withLink(state, from, 'timeout', now) }, effects }
        }
        return { state, effects }
      }
      return removeMemberAsOwner(state, from, 'leave', effects)
    }

    case 'PING':
    case 'PONG':
      // Heartbeat e tratado na camada de transporte (reconnection.ts).
      return { state, effects: [] }

    case 'JOIN_REQUEST':
    case 'JOIN_ACCEPT':
    case 'JOIN_REJECT':
      // Fluxo de admissao vive no canal efemero do door, nunca no mesh.
      return {
        state,
        effects: [
          { kind: 'log', level: 'warn', text: `${message.type} recebido fora do canal de admissao` }
        ]
      }

    default:
      return { state, effects: [] }
  }
}

function rejectFrom(
  state: RoomState,
  from: string,
  senderIsMember: boolean,
  type: string
): ReducerResult {
  const effects: Effect[] = [
    { kind: 'log', level: 'warn', text: `${type} rejeitado (remetente ${from} nao autorizado)` }
  ]
  if (!senderIsMember) effects.push({ kind: 'closeConnection', peerId: from })
  return { state, effects }
}

function applyHello(
  state: RoomState,
  from: string,
  nickname: string,
  joinedAt: number,
  now: number
): ReducerResult {
  const member = findMember(state, from)
  if (!member) {
    // Corrida com o ROSTER_UPDATE que inclui o remetente: quarentena de 5s.
    if (state.pendingHellos.some((pending) => pending.peerId === from)) {
      return { state, effects: [] }
    }
    return {
      state: {
        ...state,
        pendingHellos: [
          ...state.pendingHellos,
          { peerId: from, nickname, joinedAt, expiresAt: now + HELLO_QUARANTINE_MS }
        ]
      },
      effects: [
        { kind: 'log', level: 'info', text: `HELLO de ${from} em quarentena aguardando roster` }
      ]
    }
  }

  const alreadyAnnounced = state.announcedPeers.includes(from)
  const nextState: RoomState = {
    ...state,
    peerLinks: withLink(state, from, 'up', now),
    announcedPeers: alreadyAnnounced ? state.announcedPeers : [...state.announcedPeers, from]
  }
  if (alreadyAnnounced) return { state: nextState, effects: [] }
  return {
    state: nextState,
    effects: [
      { kind: 'playSound', sound: 'entered' },
      { kind: 'showToast', tone: 'success', text: `${member.nickname} entrou na sala.` }
    ]
  }
}

/**
 * Regra de handover da secao 2.7: um ROSTER_UPDATE de quem NAO e o dono local so
 * e aceito com as tres condicoes cumulativas.
 */
export type HandoverRejection = 'no_owner' | 'not_winner' | 'owner_healthy' | 'stale_version'

export function checkHandover(
  state: RoomState,
  from: string,
  payload: RosterUpdatePayload
): HandoverRejection | null {
  if (state.ownerPeerId === null) return 'no_owner'
  // (a) remetente e o vencedor deterministico sobre o roster local sem o dono atual
  const winner = electOwnerExcluding(state.members, state.ownerPeerId)
  if (!winner || winner.peerId !== from) return 'not_winner'
  // (c) rosterVersion estritamente maior que a local
  if (payload.rosterVersion <= state.rosterVersion) return 'stale_version'

  // (b) o link com o dono atual nao esta saudavel: `reconnecting` e `timeout` sao
  // os estados citados na SPEC; `unreachable` entra pelo mesmo criterio de "nao
  // saudavel" (a janela de 15s ja se esgotou ou o link nunca fechou). `connecting`
  // NAO entra: e o estado normal de quem acabou de ingressar.
  if (state.ownerPeerId !== state.selfPeerId) {
    const ownerLink = state.peerLinks[state.ownerPeerId]
    if (!ownerLink) return 'owner_healthy'
    const unhealthy =
      ownerLink.status === 'reconnecting' ||
      ownerLink.status === 'timeout' ||
      ownerLink.status === 'unreachable'
    return unhealthy ? null : 'owner_healthy'
  }

  // Caso do EX-DONO que volta de uma queda propria (Sprint 4, edge case): nao ha
  // link consigo mesmo, entao (b) vira "este cliente esta isolado", ou seja,
  // nenhum outro link de membro alem do remetente esta saudavel. Com o dono
  // realmente ativo e a sala conectada, os demais links estao "up" e o takeover
  // forjado continua barrado.
  const isolated = !state.members.some(
    (candidate) =>
      candidate.peerId !== state.selfPeerId &&
      candidate.peerId !== from &&
      state.peerLinks[candidate.peerId]?.status === 'up'
  )
  return isolated ? null : 'owner_healthy'
}

export function isAcceptableHandover(
  state: RoomState,
  from: string,
  payload: RosterUpdatePayload
): boolean {
  return checkHandover(state, from, payload) === null
}

function applyRosterUpdate(
  state: RoomState,
  from: string,
  payload: RosterUpdatePayload,
  senderIsOwner: boolean,
  senderIsMember: boolean,
  now: number
): ReducerResult {
  if (!senderIsOwner) {
    if (!senderIsMember) {
      return {
        state,
        effects: [
          { kind: 'log', level: 'warn', text: `ROSTER_UPDATE de desconhecido (${from}) rejeitado` },
          { kind: 'closeConnection', peerId: from }
        ]
      }
    }
    const rejection = checkHandover(state, from, payload)
    if (rejection) {
      return {
        state,
        effects: [
          {
            kind: 'log',
            level: 'warn',
            text: `ROSTER_UPDATE de nao-dono (${from}) rejeitado: ${rejection} (dono local ${state.ownerPeerId}, link ${state.peerLinks[state.ownerPeerId ?? '']?.status ?? 'ausente'}, v${payload.rosterVersion} vs v${state.rosterVersion})`
          }
        ]
      }
    }
    // Handover aceito: o remetente vira o dono local.
    const adopted: RoomState = { ...state, ownerPeerId: from }
    return applySnapshot(adopted, payload, now, [
      {
        kind: 'showToast',
        tone: 'info',
        text: `${nicknameOf(state, from)} assumiu a sala.`
      }
    ])
  }

  if (payload.rosterVersion <= state.rosterVersion) {
    return {
      state,
      effects: [
        {
          kind: 'log',
          level: 'warn',
          text: `ROSTER_UPDATE atrasado descartado (v${payload.rosterVersion} <= v${state.rosterVersion})`
        }
      ]
    }
  }
  return applySnapshot(state, payload, now, [])
}

function applySnapshot(
  state: RoomState,
  payload: RosterUpdatePayload,
  now: number,
  baseEffects: readonly Effect[]
): ReducerResult {
  const effects: Effect[] = [...baseEffects]
  const nextMembers = markOwner(payload.members, payload.ownerPeerId)
  const nextPeerIds = nextMembers.map((member) => member.peerId)
  const removedPeerIds = state.members
    .map((member) => member.peerId)
    .filter((peerId) => !nextPeerIds.includes(peerId))

  const selfRemoved = !nextPeerIds.includes(state.selfPeerId) && state.members.length > 0

  const { transmissions, droppedTxIds } = dropTransmissionsOf(state, removedPeerIds)
  const selfWatchingTxId = droppedTxIds.includes(state.selfWatchingTxId ?? '')
    ? null
    : state.selfWatchingTxId

  // Links: novos membros entram como "connecting", removidos saem do mapa.
  const peerLinks: Record<string, PeerLink> = {}
  for (const peerId of nextPeerIds) {
    if (peerId === state.selfPeerId) continue
    peerLinks[peerId] = state.peerLinks[peerId] ?? {
      peerId,
      status: 'connecting',
      since: now,
      lastSeenAt: now
    }
  }

  for (const peerId of removedPeerIds) {
    effects.push({ kind: 'closeConnection', peerId })
  }

  // HELLOs em quarentena que o roster agora confirma.
  const stillPending: PendingHello[] = []
  const announcedPeers = [...state.announcedPeers]
  for (const pending of state.pendingHellos) {
    if (!nextPeerIds.includes(pending.peerId)) {
      stillPending.push(pending)
      continue
    }
    const link = peerLinks[pending.peerId]
    if (link) peerLinks[pending.peerId] = { ...link, status: 'up', lastSeenAt: now }
    if (!announcedPeers.includes(pending.peerId)) {
      announcedPeers.push(pending.peerId)
      effects.push({ kind: 'playSound', sound: 'entered' })
      effects.push({
        kind: 'showToast',
        tone: 'success',
        text: `${pending.nickname} entrou na sala.`
      })
    }
  }

  // Sons/toasts de `lastChange` sao decididos ANTES do estado final para que a
  // lista de anunciados ja saia consolidada (evita som duplicado de "entrou").
  const change = effectsForChange(state, nextMembers, payload, announcedPeers)
  effects.push(...change.effects)

  const nextState: RoomState = {
    ...state,
    roomMeta: state.roomMeta,
    rosterVersion: payload.rosterVersion,
    ownerPeerId: payload.ownerPeerId,
    members: nextMembers,
    banList: payload.banList.map((entry) => ({ ...entry })),
    transmissions,
    selfWatchingTxId,
    watching: withoutKeys(state.watching, removedPeerIds),
    quality: withoutKeys(state.quality, removedPeerIds),
    peerLinks,
    pendingHellos: stillPending,
    announcedPeers: change.announcedPeers
  }

  if (selfRemoved) {
    return {
      state: { ...nextState, phase: 'ended', endReason: 'connection_lost' },
      effects: [
        ...effects,
        {
          kind: 'showToast',
          tone: 'danger',
          text: 'Voce perdeu a conexao com a sala.'
        },
        { kind: 'destroySession', reason: 'connection_lost' }
      ]
    }
  }

  if (nextState.ownerPeerId === nextState.selfPeerId && state.ownerPeerId !== nextState.selfPeerId) {
    effects.push({ kind: 'assumeOwnership', rebroadcast: false })
  }

  return { state: nextState, effects }
}

/** Sons/toasts dirigidos por `lastChange` (tabela 5.A, AC-23 revisao 5). */
function effectsForChange(
  previous: RoomState,
  nextMembers: readonly RosterMember[],
  payload: RosterUpdatePayload,
  announcedPeers: readonly string[]
): { effects: Effect[]; announcedPeers: string[] } {
  const { kind, targetPeerId } = payload.lastChange
  const announced = [...announcedPeers]
  if (targetPeerId === previous.selfPeerId) return { effects: [], announcedPeers: announced }

  switch (kind) {
    case 'join': {
      if (announced.includes(targetPeerId)) return { effects: [], announcedPeers: announced }
      announced.push(targetPeerId)
      const nickname =
        nextMembers.find((member) => member.peerId === targetPeerId)?.nickname ?? 'alguem'
      return {
        effects: [
          { kind: 'playSound', sound: 'entered' },
          { kind: 'showToast', tone: 'success', text: `${nickname} entrou na sala.` }
        ],
        announcedPeers: announced
      }
    }
    case 'leave':
    case 'timeout':
    case 'kick':
    case 'ban': {
      const nickname = nicknameOf(previous, targetPeerId)
      const text =
        kind === 'kick'
          ? `${nickname} foi desconectado da sala.`
          : kind === 'ban'
            ? `${nickname} foi banido da sala.`
            : `${nickname} saiu da sala.`
      return {
        effects: [
          { kind: 'playSound', sound: 'left' },
          { kind: 'showToast', tone: 'info', text }
        ],
        // Quem saiu perde o "ja anunciado": se voltar, o som de "entrou" toca de novo.
        announcedPeers: announced.filter((peerId) => peerId !== targetPeerId)
      }
    }
    case 'transfer': {
      const nickname =
        nextMembers.find((member) => member.peerId === targetPeerId)?.nickname ??
        nicknameOf(previous, targetPeerId)
      return {
        effects: [
          { kind: 'showToast', tone: 'info', text: `${nickname} agora e o dono da sala.` }
        ],
        announcedPeers: announced
      }
    }
    case 'nickname':
    default:
      return { effects: [], announcedPeers: announced }
  }
}

// --- eventos de transporte -------------------------------------------------

function applyPeerLink(state: RoomState, event: PeerLinkEvent): ReducerResult {
  const { peerId, now } = event

  if (event.kind === 'PEER_LINK_UP') {
    const previous = state.peerLinks[peerId]
    const wasDown =
      previous?.status === 'reconnecting' ||
      previous?.status === 'timeout' ||
      previous?.status === 'unreachable'
    const transmissions = { ...state.transmissions }
    for (const transmission of Object.values(transmissions)) {
      if (transmission.peerId === peerId && transmission.status === 'reconnecting') {
        transmissions[transmission.txId] = { ...transmission, status: 'live' }
      }
    }
    const nextState: RoomState = {
      ...state,
      peerLinks: withLink(state, peerId, 'up', now),
      transmissions
    }
    if (!wasDown) return { state: nextState, effects: [] }
    return {
      state: nextState,
      effects: [
        { kind: 'playSound', sound: 'reconnected' },
        {
          kind: 'showToast',
          tone: 'success',
          text: `${nicknameOf(state, peerId)} reconectou.`
        }
      ]
    }
  }

  if (event.kind === 'PEER_LINK_RECONNECTING') {
    const transmissions = { ...state.transmissions }
    for (const transmission of Object.values(transmissions)) {
      if (transmission.peerId === peerId) {
        transmissions[transmission.txId] = { ...transmission, status: 'reconnecting' }
      }
    }
    return {
      state: { ...state, peerLinks: withLink(state, peerId, 'reconnecting', now), transmissions },
      effects: []
    }
  }

  if (event.kind === 'PEER_LINK_FAILED') {
    // Par que NUNCA conectou (tipicamente NAT simetrico, RF-41/RF-42).
    const { transmissions } = dropTransmissionsOf(state, [peerId])
    return {
      state: { ...state, peerLinks: withLink(state, peerId, 'unreachable', now), transmissions },
      effects: [
        { kind: 'playSound', sound: 'connectionError' },
        {
          kind: 'showToast',
          tone: 'danger',
          text: `Nao foi possivel conectar com ${nicknameOf(state, peerId)} (conexao P2P direta falhou)`
        }
      ]
    }
  }

  // PEER_LINK_RECONNECT_TIMEOUT: a janela de 15s expirou.
  if (state.ownerPeerId === peerId) {
    return applyOwnerTimeout(state, peerId, now)
  }

  if (isOwner(state)) {
    // O dono e a autoridade: remove do roster e propaga (kind "timeout").
    return removeMemberAsOwner(state, peerId, 'timeout', [{ kind: 'closeConnection', peerId }])
  }

  // Conectividade assimetrica: o dono ainda lista o par, entao NAO removemos.
  const { transmissions } = dropTransmissionsOf(state, [peerId])
  return {
    state: { ...state, peerLinks: withLink(state, peerId, 'unreachable', now), transmissions },
    effects: [
      { kind: 'playSound', sound: 'connectionError' },
      {
        kind: 'showToast',
        tone: 'warning',
        text: `Sem conexao direta com ${nicknameOf(state, peerId)}; tentando novamente em segundo plano.`
      },
      { kind: 'scheduleRedial', peerId }
    ]
  }
}

function applyOwnerTimeout(state: RoomState, ownerPeerId: string, now: number): ReducerResult {
  const timedOut: RoomState = { ...state, peerLinks: withLink(state, ownerPeerId, 'timeout', now) }
  const winner = electOwnerExcluding(state.members, ownerPeerId)

  if (!winner) {
    return {
      state: { ...timedOut, phase: 'ended', endReason: 'connection_lost' },
      effects: [
        { kind: 'playSound', sound: 'left' },
        { kind: 'showToast', tone: 'danger', text: 'A sala foi encerrada.' },
        { kind: 'destroySession', reason: 'connection_lost' }
      ]
    }
  }

  if (winner.peerId !== state.selfPeerId) {
    // Aguarda o ROSTER_UPDATE do eleito (regra de handover da secao 2.7).
    return {
      state: timedOut,
      effects: [
        {
          kind: 'log',
          level: 'info',
          text: `dono caiu; aguardando ${winner.peerId} assumir`
        }
      ]
    }
  }

  // Este cliente venceu a eleicao: assume, remove o dono caido e propaga.
  const members = markOwner(
    state.members.filter((member) => member.peerId !== ownerPeerId),
    state.selfPeerId
  )
  const { transmissions } = dropTransmissionsOf(state, [ownerPeerId])
  const nextState: RoomState = {
    ...timedOut,
    ownerPeerId: state.selfPeerId,
    rosterVersion: state.rosterVersion + 1,
    members,
    transmissions,
    watching: withoutKeys(state.watching, [ownerPeerId]),
    quality: withoutKeys(state.quality, [ownerPeerId]),
    peerLinks: withoutKeys(timedOut.peerLinks, [ownerPeerId])
  }
  return {
    state: nextState,
    effects: [
      { kind: 'playSound', sound: 'left' },
      {
        kind: 'showToast',
        tone: 'warning',
        text: `${nicknameOf(state, ownerPeerId)} caiu; voce assumiu a sala.`
      },
      { kind: 'closeConnection', peerId: ownerPeerId },
      { kind: 'assumeOwnership', rebroadcast: true },
      {
        kind: 'broadcast',
        message: {
          type: 'ROSTER_UPDATE',
          payload: buildRosterUpdate(nextState, { kind: 'transfer', targetPeerId: state.selfPeerId })
        }
      }
    ]
  }
}

function applyQuarantineTick(state: RoomState, event: HelloQuarantineEvent): ReducerResult {
  const expired = state.pendingHellos.filter((pending) => pending.expiresAt <= event.now)
  if (expired.length === 0) return { state, effects: [] }
  return {
    state: {
      ...state,
      pendingHellos: state.pendingHellos.filter((pending) => pending.expiresAt > event.now)
    },
    effects: expired.flatMap((pending): Effect[] => [
      {
        kind: 'log',
        level: 'warn',
        text: `HELLO de ${pending.peerId} expirou sem confirmacao no roster`
      },
      { kind: 'closeConnection', peerId: pending.peerId }
    ])
  }
}

// --- acoes do dono ---------------------------------------------------------

function applyOwnerAdmit(state: RoomState, event: OwnerAdmitEvent): ReducerResult {
  const members = markOwner(event.members, state.ownerPeerId ?? state.selfPeerId)
  const nextState: RoomState = {
    ...state,
    rosterVersion: event.rosterVersion,
    members,
    peerLinks: {
      ...state.peerLinks,
      [event.member.peerId]: state.peerLinks[event.member.peerId] ?? {
        peerId: event.member.peerId,
        status: 'connecting',
        since: event.now,
        lastSeenAt: event.now
      }
    },
    announcedPeers: state.announcedPeers.includes(event.member.peerId)
      ? state.announcedPeers
      : [...state.announcedPeers, event.member.peerId]
  }
  const alreadyAnnounced = state.announcedPeers.includes(event.member.peerId)
  const effects: Effect[] = [
    {
      kind: 'broadcast',
      message: {
        type: 'ROSTER_UPDATE',
        payload: buildRosterUpdate(nextState, {
          kind: 'join',
          targetPeerId: event.member.peerId
        })
      }
    }
  ]
  if (!alreadyAnnounced) {
    effects.push(
      { kind: 'playSound', sound: 'entered' },
      { kind: 'showToast', tone: 'success', text: `${event.member.nickname} entrou na sala.` }
    )
  }
  return { state: nextState, effects }
}

function applyOwnerRemove(state: RoomState, event: OwnerRemoveEvent): ReducerResult {
  if (!isOwner(state)) {
    return {
      state,
      effects: [{ kind: 'log', level: 'warn', text: 'moderacao ignorada: cliente nao e o dono' }]
    }
  }
  if (event.peerId === state.selfPeerId) {
    return {
      state,
      effects: [{ kind: 'log', level: 'warn', text: 'o dono nao pode moderar a si mesmo' }]
    }
  }
  const target = findMember(state, event.peerId)
  if (!target) return { state, effects: [] }

  const banList =
    event.mode === 'ban' &&
    !state.banList.some((entry) => entry.installId === target.installId)
      ? [...state.banList, { installId: target.installId, nickname: target.nickname }]
      : state.banList

  return removeMemberAsOwner({ ...state, banList }, event.peerId, event.mode, [
    {
      kind: 'send',
      to: event.peerId,
      message: { type: 'MOD_REMOVE', payload: { mode: event.mode } }
    },
    { kind: 'closeConnection', peerId: event.peerId }
  ])
}

/** Remocao de um membro pelo DONO: atualiza roster, propaga e toca o som "saiu". */
function removeMemberAsOwner(
  state: RoomState,
  peerId: string,
  kind: Extract<RosterChangeKind, 'leave' | 'kick' | 'ban' | 'timeout'>,
  baseEffects: readonly Effect[]
): ReducerResult {
  const target = findMember(state, peerId)
  if (!target) return { state, effects: [...baseEffects] }

  const { transmissions } = dropTransmissionsOf(state, [peerId])
  const nextState: RoomState = {
    ...state,
    rosterVersion: state.rosterVersion + 1,
    members: state.members.filter((member) => member.peerId !== peerId),
    transmissions,
    watching: withoutKeys(state.watching, [peerId]),
    quality: withoutKeys(state.quality, [peerId]),
    peerLinks: withoutKeys(state.peerLinks, [peerId]),
    announcedPeers: state.announcedPeers.filter((announced) => announced !== peerId),
    selfWatchingTxId: transmissions[state.selfWatchingTxId ?? ''] ? state.selfWatchingTxId : null
  }

  const text =
    kind === 'kick'
      ? `${target.nickname} foi desconectado da sala.`
      : kind === 'ban'
        ? `${target.nickname} foi banido da sala.`
        : `${target.nickname} saiu da sala.`

  return {
    state: nextState,
    effects: [
      ...baseEffects,
      { kind: 'playSound', sound: 'left' },
      { kind: 'showToast', tone: 'info', text },
      {
        kind: 'broadcast',
        message: {
          type: 'ROSTER_UPDATE',
          payload: buildRosterUpdate(nextState, { kind, targetPeerId: peerId })
        }
      }
    ]
  }
}

// --- acoes locais ----------------------------------------------------------

function applyLocalNickname(state: RoomState, event: LocalNicknameEvent): ReducerResult {
  const nickname = event.nickname.trim()
  if (nickname.length === 0 || state.phase !== 'active') return { state, effects: [] }
  const members = state.members.map((member) =>
    member.peerId === state.selfPeerId ? { ...member, nickname } : member
  )
  const nextState: RoomState = { ...state, members }
  if (isOwner(state)) {
    const consolidated: RoomState = { ...nextState, rosterVersion: state.rosterVersion + 1 }
    return {
      state: consolidated,
      effects: [
        {
          kind: 'broadcast',
          message: {
            type: 'ROSTER_UPDATE',
            payload: buildRosterUpdate(consolidated, {
              kind: 'nickname',
              targetPeerId: state.selfPeerId
            })
          }
        }
      ]
    }
  }
  return {
    state: nextState,
    effects: [{ kind: 'broadcast', message: { type: 'NICKNAME_UPDATE', payload: { nickname } } }]
  }
}

function applyLocalTxStart(state: RoomState, event: LocalTxStartEvent): ReducerResult {
  const previous = transmissionsOf(state, state.selfPeerId).map(
    (transmission) => transmission.txId
  )
  // Copia obrigatoria pelo mesmo motivo do TX_START remoto (imutabilidade).
  const transmissions = { ...withoutKeys(state.transmissions, previous) }
  transmissions[event.txId] = {
    txId: event.txId,
    peerId: state.selfPeerId,
    presetId: event.presetId,
    hasAudio: event.hasAudio,
    sourceKind: event.sourceKind,
    sourceLabel: event.sourceLabel,
    startedAt: event.now,
    status: 'live'
  }
  return {
    state: { ...state, transmissions },
    effects: [
      {
        kind: 'broadcast',
        message: {
          type: 'TX_START',
          payload: {
            txId: event.txId,
            presetId: event.presetId,
            hasAudio: event.hasAudio,
            sourceKind: event.sourceKind,
            sourceLabel: event.sourceLabel,
            startedAt: event.now
          }
        }
      },
      { kind: 'playSound', sound: 'transmitting' }
    ]
  }
}

function applyLocalTxStop(state: RoomState, event: LocalTxStopEvent): ReducerResult {
  const own = transmissionsOf(state, state.selfPeerId)
  if (own.length === 0) return { state, effects: [] }
  const txIds = own.map((transmission) => transmission.txId)
  return {
    state: { ...state, transmissions: withoutKeys(state.transmissions, txIds) },
    effects: [
      ...txIds.map(
        (txId): Effect => ({
          kind: 'broadcast',
          message: { type: 'TX_STOP', payload: { txId, reason: event.reason } }
        })
      ),
      { kind: 'playSound', sound: 'stoppedTransmitting' }
    ]
  }
}

function applyLocalWatching(state: RoomState, event: LocalWatchingEvent): ReducerResult {
  if (state.selfWatchingTxId === event.txId) return { state, effects: [] }
  return {
    state: {
      ...state,
      selfWatchingTxId: event.txId,
      watching: { ...state.watching, [state.selfPeerId]: event.txId }
    },
    effects: [
      {
        kind: 'broadcast',
        message: { type: 'WATCHING_UPDATE', payload: { watchingTxId: event.txId } }
      }
    ]
  }
}

function applyLocalQuality(state: RoomState, event: LocalQualityEvent): ReducerResult {
  return {
    state,
    effects: [
      {
        kind: 'broadcast',
        message: {
          type: 'QUALITY_UPDATE',
          payload: {
            level: event.level,
            rttMs: event.rttMs,
            inboundBitrateKbps: event.inboundBitrateKbps
          }
        }
      }
    ]
  }
}

function applySelfLeave(state: RoomState): ReducerResult {
  if (state.phase !== 'active') {
    return { state: { ...state, phase: 'ended', endReason: 'left' }, effects: [] }
  }

  const effects: Effect[] = []
  const hasLocalTransmission = transmissionsOf(state, state.selfPeerId).length > 0
  if (hasLocalTransmission) {
    effects.push({ kind: 'stopLocalTransmission', reason: 'leaving' })
  }

  if (isOwner(state)) {
    const successor = electOwnerExcluding(state.members, state.selfPeerId)
    if (successor) {
      // O id do door e derivado do codigo da sala e e GLOBAL no PeerJS: enquanto
      // este cliente o mantiver registrado, o sucessor recebe `unavailable-id`.
      // Liberar ANTES de anunciar da ao sucessor a porta livre (risco R5).
      effects.push({ kind: 'releaseDoor' })
      // RF-35: OWNER_TRANSFER vai imediatamente antes do LEAVE. Quem remove o
      // dono que saiu do roster e o NOVO dono, ao receber o LEAVE em seguida.
      // A ban list (RF-36) ja esta replicada em todos pelos ROSTER_UPDATE
      // anteriores, entao o sucessor assume com ela na mao.
      effects.push({
        kind: 'broadcast',
        message: {
          type: 'OWNER_TRANSFER',
          payload: {
            newOwnerPeerId: successor.peerId,
            rosterVersion: state.rosterVersion + 1
          }
        }
      })
    }
  }

  effects.push({ kind: 'broadcast', message: { type: 'LEAVE', payload: {} } })
  effects.push({ kind: 'destroySession', reason: 'left' })

  return {
    state: { ...state, phase: 'ended', endReason: 'left', selfWatchingTxId: null },
    effects
  }
}
