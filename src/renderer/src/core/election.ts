// Eleicao do dono (RF-35): mais antigo por `joinedAt`, desempate deterministico
// pelo peerId. O determinismo garante que TODOS os membros elegem o mesmo dono
// na queda do dono, sem coordenacao. Modulo puro.
import type { RosterMember } from '@shared/protocol'

/** Ordem canonica de sucessao: menor joinedAt; empate resolvido por peerId. */
export function compareSuccession(a: RosterMember, b: RosterMember): number {
  if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt
  if (a.peerId === b.peerId) return 0
  return a.peerId < b.peerId ? -1 : 1
}

/** Vencedor da eleicao entre os membros dados, ou null se a lista for vazia. */
export function electOwner(members: readonly RosterMember[]): RosterMember | null {
  let winner: RosterMember | null = null
  for (const member of members) {
    if (!winner || compareSuccession(member, winner) < 0) winner = member
  }
  return winner
}

/** Vencedor ignorando um peerId (usado na queda do dono e na saida voluntaria). */
export function electOwnerExcluding(
  members: readonly RosterMember[],
  excludedPeerId: string
): RosterMember | null {
  return electOwner(members.filter((member) => member.peerId !== excludedPeerId))
}
