// Admissao no door peer (SPEC 5.A + 5c): decide JOIN_ACCEPT ou JOIN_REJECT.
// Modulo puro; a autoridade e SEMPRE o cliente do dono.
import {
  isJoinRequestPayload,
  PROTOCOL_VERSION,
  type BanEntry,
  type JoinAcceptPayload,
  type JoinRejectPayload,
  type RoomMeta,
  type RosterMember
} from '@shared/protocol'

export interface AdmissionContext {
  roomMeta: RoomMeta
  rosterVersion: number
  ownerPeerId: string
  members: readonly RosterMember[]
  banList: readonly BanEntry[]
  /** epoch ms injetado (mantem a funcao pura e testavel). */
  now: number
}

export type AdmissionDecision =
  | { accept: JoinAcceptPayload; member: RosterMember }
  | { reject: JoinRejectPayload }

/**
 * Avalia o envelope BRUTO recebido no door peer. Recebe o raw (nao a mensagem ja
 * validada) porque so aqui a diferenca entre `version_mismatch` e
 * `invalid_payload` importa para a resposta ao candidato.
 */
export function admit(raw: unknown, context: AdmissionContext): AdmissionDecision {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { reject: { reason: 'invalid_payload' } }
  }
  const envelope = raw as Record<string, unknown>

  if (envelope['v'] !== PROTOCOL_VERSION) {
    return { reject: { reason: 'version_mismatch' } }
  }
  if (envelope['type'] !== 'JOIN_REQUEST') {
    return { reject: { reason: 'invalid_payload' } }
  }

  const payload: unknown = envelope['payload']
  if (!isJoinRequestPayload(payload)) {
    return { reject: { reason: 'invalid_payload' } }
  }
  const nickname = payload.nickname.trim()
  if (nickname.length === 0) {
    return { reject: { reason: 'invalid_payload' } }
  }

  // Banimento e chaveado pelo installId, comparacao exata (RF-08/RF-33).
  if (context.banList.some((entry) => entry.installId === payload.installId)) {
    return { reject: { reason: 'banned' } }
  }

  const existing = context.members.find((member) => member.peerId === payload.memberPeerId)

  // Capacidade conta o proprio dono (RF-07). Um reingresso do MESMO peerId nao
  // consome vaga nova.
  if (!existing && context.members.length >= context.roomMeta.limit) {
    return { reject: { reason: 'room_full' } }
  }

  const member: RosterMember = existing
    ? { ...existing, nickname, installId: payload.installId }
    : {
        peerId: payload.memberPeerId,
        installId: payload.installId,
        nickname,
        joinedAt: context.now,
        isOwner: false
      }

  const members = existing
    ? context.members.map((current) => (current.peerId === member.peerId ? member : current))
    : [...context.members, member]

  return {
    accept: {
      roomMeta: context.roomMeta,
      rosterVersion: context.rosterVersion + 1,
      ownerPeerId: context.ownerPeerId,
      members,
      banList: [...context.banList]
    },
    member
  }
}
