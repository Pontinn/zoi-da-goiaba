import { describe, expect, it } from 'vitest'
import type { RosterMember } from '@shared/protocol'
import { compareSuccession, electOwner, electOwnerExcluding } from '@renderer/core/election'

function member(peerId: string, joinedAt: number, isOwner = false): RosterMember {
  return { peerId, installId: `install-${peerId}`, nickname: peerId, joinedAt, isOwner }
}

describe('election / sucessao por antiguidade (RF-35)', () => {
  it('elege o membro com menor joinedAt', () => {
    const members = [member('c', 300), member('a', 100), member('b', 200)]
    expect(electOwner(members)?.peerId).toBe('a')
  })

  it('devolve null para roster vazio', () => {
    expect(electOwner([])).toBeNull()
  })

  it('desempata deterministicamente pelo peerId quando joinedAt e identico', () => {
    const members = [member('zebra', 1000), member('alfa', 1000), member('meio', 1000)]
    expect(electOwner(members)?.peerId).toBe('alfa')
    // A ordem de entrada da lista nao pode mudar o vencedor.
    expect(electOwner([...members].reverse())?.peerId).toBe('alfa')
  })

  it('todos os membros elegem o MESMO dono independentemente da ordem local', () => {
    const base = [member('p3', 50), member('p1', 50), member('p2', 10)]
    const permutations = [
      base,
      [base[2]!, base[0]!, base[1]!],
      [base[1]!, base[2]!, base[0]!],
      [...base].reverse()
    ]
    const winners = permutations.map((roster) => electOwner(roster)?.peerId)
    expect(new Set(winners).size).toBe(1)
    expect(winners[0]).toBe('p2')
  })

  it('compareSuccession e uma ordem total consistente', () => {
    const a = member('a', 10)
    const b = member('b', 10)
    expect(compareSuccession(a, b)).toBeLessThan(0)
    expect(compareSuccession(b, a)).toBeGreaterThan(0)
    expect(compareSuccession(a, a)).toBe(0)
  })
})

describe('election / exclusao do dono caido', () => {
  it('ignora o peerId excluido', () => {
    const members = [member('owner', 1, true), member('b', 5), member('c', 9)]
    expect(electOwnerExcluding(members, 'owner')?.peerId).toBe('b')
  })

  it('devolve null quando so restava o excluido', () => {
    expect(electOwnerExcluding([member('owner', 1, true)], 'owner')).toBeNull()
  })
})
