// Cor por pessoa (RF-21/RF-22/RF-23/RNF-05): a mesma cor identifica alguem na
// bolinha da lista de participantes e no cursor que ela move sobre a tela.
//
// Modulo PURO: sem DOM, sem Electron. A cor NUNCA viaja pela rede; cada cliente
// deriva do `peerId` mais o roster, entao dois clientes chegam ao mesmo
// resultado sozinhos (a divergencia possivel dura o tempo de um ROSTER_UPDATE
// em transito e se resolve no proximo).
//
// A decisao (3/T1 da SPEC), em duas frases: paleta FIXA de 10 slots escolhida
// por hash do `peerId`, e colisao entre pessoas PRESENTES resolvida pelo roster,
// ordenando os colidentes por (`joinedAt`, `peerId`) e mandando os demais andar
// pela paleta ate o primeiro slot livre. Como o criterio de posse e `joinedAt`
// crescente, quem CHEGA e sempre o deslocado: uma entrada na sala nunca muda a
// cor de quem ja estava. Com `ROOM_MAX_LIMIT = 8` e 10 slots, duas pessoas
// presentes nunca compartilham cor, por construcao e nao por estatistica.
//
// A formula das duas cores reproduz o par de hoje do avatar quando `hue = 277`:
// `hsl(277 100% 62%)` da `#b53dff` contra o `--accent-hover` real `#b23dff`, e o
// fundo com alpha 0.15 da o mesmo `#230935` do `--accent-soft` composto sobre
// `--bg-app`. Ou seja, o avatar atual vira um membro da familia nova, e nao um
// caso a parte.

export interface PersonColorSlot {
  hue: number
  light: number
}

/**
 * Paleta fixa de 10 slots (3/T1). Ordem e valores sao CONTRATO: mudar aqui muda
 * a cor de todo mundo. Nenhum matiz cai na faixa de `--danger` (`#ff3d5e`,
 * matiz aproximadamente 349), para cor de pessoa nunca ser lida como erro.
 * Os matizes 215, 247 e 280 ganham `light` maior de proposito: azul e roxo puros
 * tem luminancia baixa e cairiam abaixo da referencia atual com `light: 62`.
 */
export const PERSON_COLOR_SLOTS: readonly PersonColorSlot[] = [
  { hue: 20, light: 62 },
  { hue: 52, light: 62 },
  { hue: 85, light: 62 },
  { hue: 117, light: 62 },
  { hue: 150, light: 62 },
  { hue: 182, light: 62 },
  { hue: 215, light: 62 },
  { hue: 247, light: 72 },
  { hue: 280, light: 68 },
  { hue: 312, light: 62 }
]

export const PERSON_COLOR_COUNT = PERSON_COLOR_SLOTS.length

export interface PersonColor {
  /** Preenchimento: cursor e texto da inicial. `hsl(H 100% L%)`. */
  fill: string
  /** Fundo do avatar. `hsl(H 100% 50% / 0.15)`. */
  soft: string
}

/** FNV-1a de 32 bits sobre os code units da string. Deterministico e sem deps. */
export function hash32(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Slot canonico de um peerId, ignorando o roster. */
export function baseSlotOf(peerId: string): number {
  return hash32(peerId) % PERSON_COLOR_COUNT
}

/**
 * Slot de cada pessoa PRESENTE, com o desempate de colisao de 3/T1: ordena os
 * colidentes por (`joinedAt`, `peerId`), o primeiro fica com o slot e os demais
 * andam pela paleta ate o primeiro slot livre. Devolve `peerId -> slot`.
 */
export function resolvePersonSlots(
  members: readonly { peerId: string; joinedAt: number }[]
): Record<string, number> {
  const ordered = [...members].sort(
    (a, b) => a.joinedAt - b.joinedAt || (a.peerId < b.peerId ? -1 : a.peerId > b.peerId ? 1 : 0)
  )
  const taken = new Set<number>()
  const result: Record<string, number> = {}
  for (const member of ordered) {
    const start = baseSlotOf(member.peerId)
    // O laco e LIMITADO ao tamanho da paleta: com mais membros que slots (algo
    // impossivel com ROOM_MAX_LIMIT = 8) o excedente fica com o proprio slot
    // canonico, mesmo ocupado, e a funcao TERMINA.
    let slot = start
    for (let step = 0; step < PERSON_COLOR_COUNT; step += 1) {
      const candidate = (start + step) % PERSON_COLOR_COUNT
      if (!taken.has(candidate)) {
        slot = candidate
        break
      }
    }
    taken.add(slot)
    result[member.peerId] = slot
  }
  return result
}

/** Converte um slot em cores concretas. */
export function colorOfSlot(slot: number): PersonColor {
  const index = ((slot % PERSON_COLOR_COUNT) + PERSON_COLOR_COUNT) % PERSON_COLOR_COUNT
  const entry = PERSON_COLOR_SLOTS[index] ?? { hue: 277, light: 62 }
  return {
    fill: `hsl(${entry.hue} 100% ${entry.light}%)`,
    soft: `hsl(${entry.hue} 100% 50% / 0.15)`
  }
}
