// Protocolo P2P sobre DataChannel confiavel (SPEC secao 5.A), com type guards
// estruturais. Modulo puro: nada de PeerJS, DOM ou Electron.

export const PROTOCOL_VERSION = 1 as const

export type MessageType =
  | 'JOIN_REQUEST'
  | 'JOIN_ACCEPT'
  | 'JOIN_REJECT'
  | 'HELLO'
  | 'ROSTER_UPDATE'
  | 'NICKNAME_UPDATE'
  | 'TX_START'
  | 'TX_STOP'
  | 'WATCHING_UPDATE'
  | 'QUALITY_UPDATE'
  | 'MOD_REMOVE'
  | 'OWNER_TRANSFER'
  | 'LEAVE'
  | 'PING'
  | 'PONG'

export interface Envelope<T = unknown> {
  v: typeof PROTOCOL_VERSION
  type: MessageType
  /** peerId do remetente; sempre cruzado com o peerId real da conexao. */
  from: string
  /** epoch ms do remetente, informativo. */
  ts: number
  payload: T
}

// ---------------------------------------------------------------------------
// Entidades do roster
// ---------------------------------------------------------------------------

export interface RosterMember {
  peerId: string
  installId: string
  nickname: string
  joinedAt: number
  isOwner: boolean
}

/** O nickname e apenas rotulo de UI; a chave do banimento e o installId. */
export interface BanEntry {
  installId: string
  nickname: string
}

export interface RoomMeta {
  code: string
  limit: number
  createdAt: number
}

/**
 * Os ids sao parte do PROTOCOLO: `isTxStartPayload` so aceita os desta lista.
 * Adicionar um preset novo e uma mudanca so-pra-frente: cliente antigo descarta
 * o TX_START com id que ele nao conhece (ver notas da release).
 */
export type PresetId = 'p720_30' | 'p1080_30' | 'p1080_30_hq' | 'p1080_60' | 'p1080_60_hq'
export type SourceKind = 'screen' | 'window'
export type QualityLevel = 'good' | 'medium' | 'bad'
export type RosterChangeKind =
  'join' | 'leave' | 'kick' | 'ban' | 'timeout' | 'nickname' | 'transfer'
export type JoinRejectReason = 'room_full' | 'banned' | 'version_mismatch' | 'invalid_payload'
export type ModRemoveMode = 'kick' | 'ban'
export type TxStopReason = 'manual' | 'source_switch' | 'leaving'

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

export interface JoinRequestPayload {
  nickname: string
  memberPeerId: string
  installId: string
}

export interface JoinAcceptPayload {
  roomMeta: RoomMeta
  rosterVersion: number
  ownerPeerId: string
  members: RosterMember[]
  banList: BanEntry[]
}

export interface JoinRejectPayload {
  reason: JoinRejectReason
}

export interface HelloPayload {
  nickname: string
  joinedAt: number
}

export interface RosterChange {
  kind: RosterChangeKind
  targetPeerId: string
}

export interface RosterUpdatePayload {
  rosterVersion: number
  ownerPeerId: string
  members: RosterMember[]
  banList: BanEntry[]
  lastChange: RosterChange
}

export interface NicknameUpdatePayload {
  nickname: string
}

export interface TxStartPayload {
  txId: string
  presetId: PresetId
  hasAudio: boolean
  sourceKind: SourceKind
  sourceLabel: string
  startedAt: number
}

export interface TxStopPayload {
  txId: string
  reason: TxStopReason
}

export interface WatchingUpdatePayload {
  watchingTxId: string | null
}

export interface QualityUpdatePayload {
  level: QualityLevel
  rttMs: number
  inboundBitrateKbps: number | null
}

export interface ModRemovePayload {
  mode: ModRemoveMode
}

export interface OwnerTransferPayload {
  newOwnerPeerId: string
  rosterVersion: number
}

export type LeavePayload = Record<string, never>

export interface PingPayload {
  seq: number
}

export type PongPayload = PingPayload

export interface PayloadByType {
  JOIN_REQUEST: JoinRequestPayload
  JOIN_ACCEPT: JoinAcceptPayload
  JOIN_REJECT: JoinRejectPayload
  HELLO: HelloPayload
  ROSTER_UPDATE: RosterUpdatePayload
  NICKNAME_UPDATE: NicknameUpdatePayload
  TX_START: TxStartPayload
  TX_STOP: TxStopPayload
  WATCHING_UPDATE: WatchingUpdatePayload
  QUALITY_UPDATE: QualityUpdatePayload
  MOD_REMOVE: ModRemovePayload
  OWNER_TRANSFER: OwnerTransferPayload
  LEAVE: LeavePayload
  PING: PingPayload
  PONG: PongPayload
}

/** Mensagem ja validada, sem o envelope de transporte. */
export type ProtocolMessage = {
  [K in MessageType]: { type: K; payload: PayloadByType[K] }
}[MessageType]

// ---------------------------------------------------------------------------
// Type guards estruturais
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard)
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
}

const PRESET_IDS: readonly PresetId[] = [
  'p720_30',
  'p1080_30',
  'p1080_30_hq',
  'p1080_60',
  'p1080_60_hq'
]
const SOURCE_KINDS: readonly SourceKind[] = ['screen', 'window']
const QUALITY_LEVELS: readonly QualityLevel[] = ['good', 'medium', 'bad']
const ROSTER_CHANGE_KINDS: readonly RosterChangeKind[] = [
  'join',
  'leave',
  'kick',
  'ban',
  'timeout',
  'nickname',
  'transfer'
]
const JOIN_REJECT_REASONS: readonly JoinRejectReason[] = [
  'room_full',
  'banned',
  'version_mismatch',
  'invalid_payload'
]
const MOD_REMOVE_MODES: readonly ModRemoveMode[] = ['kick', 'ban']
const TX_STOP_REASONS: readonly TxStopReason[] = ['manual', 'source_switch', 'leaving']

export const MESSAGE_TYPES: readonly MessageType[] = [
  'JOIN_REQUEST',
  'JOIN_ACCEPT',
  'JOIN_REJECT',
  'HELLO',
  'ROSTER_UPDATE',
  'NICKNAME_UPDATE',
  'TX_START',
  'TX_STOP',
  'WATCHING_UPDATE',
  'QUALITY_UPDATE',
  'MOD_REMOVE',
  'OWNER_TRANSFER',
  'LEAVE',
  'PING',
  'PONG'
]

export function isRosterMember(value: unknown): value is RosterMember {
  return (
    isRecord(value) &&
    isString(value['peerId']) &&
    value['peerId'].length > 0 &&
    isString(value['installId']) &&
    isString(value['nickname']) &&
    isFiniteNumber(value['joinedAt']) &&
    isBoolean(value['isOwner'])
  )
}

export function isBanEntry(value: unknown): value is BanEntry {
  return isRecord(value) && isString(value['installId']) && isString(value['nickname'])
}

export function isRoomMeta(value: unknown): value is RoomMeta {
  return (
    isRecord(value) &&
    isString(value['code']) &&
    isFiniteNumber(value['limit']) &&
    isFiniteNumber(value['createdAt'])
  )
}

export function isJoinRequestPayload(value: unknown): value is JoinRequestPayload {
  return (
    isRecord(value) &&
    isString(value['nickname']) &&
    isString(value['memberPeerId']) &&
    value['memberPeerId'].length > 0 &&
    isString(value['installId']) &&
    value['installId'].length > 0
  )
}

export function isJoinAcceptPayload(value: unknown): value is JoinAcceptPayload {
  return (
    isRecord(value) &&
    isRoomMeta(value['roomMeta']) &&
    isFiniteNumber(value['rosterVersion']) &&
    isString(value['ownerPeerId']) &&
    isArrayOf(value['members'], isRosterMember) &&
    isArrayOf(value['banList'], isBanEntry)
  )
}

export function isJoinRejectPayload(value: unknown): value is JoinRejectPayload {
  return isRecord(value) && isOneOf(value['reason'], JOIN_REJECT_REASONS)
}

export function isHelloPayload(value: unknown): value is HelloPayload {
  return isRecord(value) && isString(value['nickname']) && isFiniteNumber(value['joinedAt'])
}

export function isRosterChange(value: unknown): value is RosterChange {
  return (
    isRecord(value) &&
    isOneOf(value['kind'], ROSTER_CHANGE_KINDS) &&
    isString(value['targetPeerId'])
  )
}

export function isRosterUpdatePayload(value: unknown): value is RosterUpdatePayload {
  return (
    isRecord(value) &&
    isFiniteNumber(value['rosterVersion']) &&
    isString(value['ownerPeerId']) &&
    isArrayOf(value['members'], isRosterMember) &&
    isArrayOf(value['banList'], isBanEntry) &&
    isRosterChange(value['lastChange'])
  )
}

export function isNicknameUpdatePayload(value: unknown): value is NicknameUpdatePayload {
  return isRecord(value) && isString(value['nickname'])
}

export function isTxStartPayload(value: unknown): value is TxStartPayload {
  return (
    isRecord(value) &&
    isString(value['txId']) &&
    value['txId'].length > 0 &&
    isOneOf(value['presetId'], PRESET_IDS) &&
    isBoolean(value['hasAudio']) &&
    isOneOf(value['sourceKind'], SOURCE_KINDS) &&
    isString(value['sourceLabel']) &&
    isFiniteNumber(value['startedAt'])
  )
}

export function isTxStopPayload(value: unknown): value is TxStopPayload {
  return (
    isRecord(value) &&
    isString(value['txId']) &&
    value['txId'].length > 0 &&
    isOneOf(value['reason'], TX_STOP_REASONS)
  )
}

export function isWatchingUpdatePayload(value: unknown): value is WatchingUpdatePayload {
  return isRecord(value) && (value['watchingTxId'] === null || isString(value['watchingTxId']))
}

export function isQualityUpdatePayload(value: unknown): value is QualityUpdatePayload {
  return (
    isRecord(value) &&
    isOneOf(value['level'], QUALITY_LEVELS) &&
    isFiniteNumber(value['rttMs']) &&
    (value['inboundBitrateKbps'] === null || isFiniteNumber(value['inboundBitrateKbps']))
  )
}

export function isModRemovePayload(value: unknown): value is ModRemovePayload {
  return isRecord(value) && isOneOf(value['mode'], MOD_REMOVE_MODES)
}

export function isOwnerTransferPayload(value: unknown): value is OwnerTransferPayload {
  return (
    isRecord(value) &&
    isString(value['newOwnerPeerId']) &&
    value['newOwnerPeerId'].length > 0 &&
    isFiniteNumber(value['rosterVersion'])
  )
}

export function isLeavePayload(value: unknown): value is LeavePayload {
  return isRecord(value)
}

export function isPingPayload(value: unknown): value is PingPayload {
  return isRecord(value) && isFiniteNumber(value['seq'])
}

const PAYLOAD_GUARDS: { [K in MessageType]: (value: unknown) => value is PayloadByType[K] } = {
  JOIN_REQUEST: isJoinRequestPayload,
  JOIN_ACCEPT: isJoinAcceptPayload,
  JOIN_REJECT: isJoinRejectPayload,
  HELLO: isHelloPayload,
  ROSTER_UPDATE: isRosterUpdatePayload,
  NICKNAME_UPDATE: isNicknameUpdatePayload,
  TX_START: isTxStartPayload,
  TX_STOP: isTxStopPayload,
  WATCHING_UPDATE: isWatchingUpdatePayload,
  QUALITY_UPDATE: isQualityUpdatePayload,
  MOD_REMOVE: isModRemovePayload,
  OWNER_TRANSFER: isOwnerTransferPayload,
  LEAVE: isLeavePayload,
  PING: isPingPayload,
  PONG: isPingPayload
}

/** Verifica apenas a casca do envelope, sem olhar o payload. */
export function isEnvelope(value: unknown): value is Envelope {
  return (
    isRecord(value) &&
    value['v'] === PROTOCOL_VERSION &&
    isOneOf(value['type'], MESSAGE_TYPES) &&
    isString(value['from']) &&
    isFiniteNumber(value['ts']) &&
    'payload' in value
  )
}

// ---------------------------------------------------------------------------
// Validacao de entrada (regra geral de rejeicao da secao 5.A)
// ---------------------------------------------------------------------------

export type EnvelopeRejectReason =
  'not_an_envelope' | 'version_mismatch' | 'unknown_type' | 'invalid_payload' | 'from_mismatch'

export type EnvelopeValidation =
  | { ok: true; message: ProtocolMessage; from: string; ts: number }
  | { ok: false; reason: EnvelopeRejectReason }

/**
 * Aplica a regra geral de rejeicao: envelope malformado, versao diferente, type
 * desconhecido, payload invalido ou `from` divergente do peerId REAL da conexao
 * (`expectedFrom`) devolvem motivo de descarte em vez de mensagem.
 */
export function validateEnvelope(raw: unknown, expectedFrom: string): EnvelopeValidation {
  if (!isRecord(raw)) return { ok: false, reason: 'not_an_envelope' }
  if (raw['v'] !== PROTOCOL_VERSION) return { ok: false, reason: 'version_mismatch' }
  if (!isOneOf(raw['type'], MESSAGE_TYPES)) return { ok: false, reason: 'unknown_type' }
  if (!isString(raw['from']) || !isFiniteNumber(raw['ts']) || !('payload' in raw)) {
    return { ok: false, reason: 'not_an_envelope' }
  }
  if (raw['from'] !== expectedFrom) return { ok: false, reason: 'from_mismatch' }

  const type = raw['type']
  const guard = PAYLOAD_GUARDS[type]
  const payload: unknown = raw['payload']
  if (!guard(payload)) return { ok: false, reason: 'invalid_payload' }

  return {
    ok: true,
    message: { type, payload } as ProtocolMessage,
    from: raw['from'],
    ts: raw['ts']
  }
}

/** Monta o envelope de saida de uma mensagem. */
export function createEnvelope<K extends MessageType>(
  type: K,
  payload: PayloadByType[K],
  from: string,
  now: number
): Envelope<PayloadByType[K]> {
  return { v: PROTOCOL_VERSION, type, from, ts: now, payload }
}
