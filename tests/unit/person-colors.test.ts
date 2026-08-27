// Cor por pessoa (RF-21/RF-22/RF-23/RNF-05). Tres coisas precisam ser provadas
// por numero e nao por opiniao: que todo cliente chega ao MESMO mapa sem trocar
// nada pela rede, que quem CHEGA nunca muda a cor de quem ja estava, e que a
// inicial do avatar continua legivel em todos os 10 slots.
import { describe, expect, it } from 'vitest'
import {
  baseSlotOf,
  colorOfSlot,
  hash32,
  PERSON_COLOR_COUNT,
  PERSON_COLOR_SLOTS,
  resolvePersonSlots
} from '@shared/person-colors'

/**
 * peerIds ESCOLHIDOS para o exemplo trabalhado de 5.C5: `bruna` e `joao-4` caem
 * os dois no slot 3 (colisao de verdade, nao simulada) e `carla-0` cai no 7. Os
 * valores literais de `hash32` estao no teste de estabilidade abaixo: se alguem
 * mexer no algoritmo, aquele teste falha primeiro e explica este.
 */
const BRUNA = 'bruna'
const JOAO = 'joao-4'
const CARLA = 'carla-0'

/** Gerador deterministico: teste de propriedade nao pode ser intermitente. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function makeMembers(
  random: () => number,
  count: number,
  prefix: string
): { peerId: string; joinedAt: number }[] {
  return Array.from({ length: count }, (_, index) => ({
    peerId: `${prefix}-${Math.floor(random() * 1_000_000)}-${index}`,
    joinedAt: index + 1
  }))
}

// --- contraste: luminancia relativa sRGB e composicao alpha -----------------

function srgbChannel(value: number): number {
  const channel = value / 255
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const first = luminance(a)
  const second = luminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function hslToRgb(hue: number, saturation: number, light: number): [number, number, number] {
  const s = saturation / 100
  const l = light / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  let base: [number, number, number]
  if (hue < 60) base = [c, x, 0]
  else if (hue < 120) base = [x, c, 0]
  else if (hue < 180) base = [0, c, x]
  else if (hue < 240) base = [0, x, c]
  else if (hue < 300) base = [x, 0, c]
  else base = [c, 0, x]
  const m = l - c / 2
  return [
    Math.round((base[0] + m) * 255),
    Math.round((base[1] + m) * 255),
    Math.round((base[2] + m) * 255)
  ]
}

function composite(
  foreground: [number, number, number],
  alpha: number,
  background: [number, number, number]
): [number, number, number] {
  return [
    Math.round(foreground[0] * alpha + background[0] * (1 - alpha)),
    Math.round(foreground[1] * alpha + background[1] * (1 - alpha)),
    Math.round(foreground[2] * alpha + background[2] * (1 - alpha))
  ]
}

/** `--bg-app`, que e o `background` de `.z-participant`. */
const BG_APP: [number, number, number] = [0x0e, 0x0b, 0x12]

describe('person-colors / hash32 e slot canonico', () => {
  it('e estavel e bate com os valores literais do FNV-1a de 32 bits', () => {
    // Fixture literal de proposito: pega mudanca ACIDENTAL de algoritmo, que
    // trocaria a cor de todo mundo sem quebrar mais nada.
    expect(hash32('bruna')).toBe(95925073)
    expect(hash32('joao-4')).toBe(2517007703)
    expect(hash32('carla-0')).toBe(2653399127)
    expect(hash32('bruna')).toBe(hash32('bruna'))
    expect(hash32('bruna')).not.toBe(hash32('joao-4'))
    // String vazia devolve o offset inicial do FNV, sem erro.
    expect(hash32('')).toBe(0x811c9dc5 >>> 0)
    expect(baseSlotOf('')).toBeGreaterThanOrEqual(0)
    expect(baseSlotOf('')).toBeLessThan(PERSON_COLOR_COUNT)
  })

  it('poe os tres peerIds do exemplo trabalhado nos slots que a SPEC descreve', () => {
    expect(baseSlotOf(BRUNA)).toBe(3)
    expect(baseSlotOf(JOAO)).toBe(3)
    expect(baseSlotOf(CARLA)).toBe(7)
  })
})

describe('person-colors / resolvePersonSlots', () => {
  it('resolve a colisao pelo joinedAt: quem chegou antes FICA com o slot', () => {
    const pair = resolvePersonSlots([
      { peerId: BRUNA, joinedAt: 1000 },
      { peerId: JOAO, joinedAt: 2000 }
    ])
    expect(pair[BRUNA]).toBe(3)
    expect(pair[JOAO]).toBe(4)
  })

  it('membro NOVO nao mexe na cor de ninguem (a diferenca contra o lexicografico)', () => {
    const trio = resolvePersonSlots([
      { peerId: BRUNA, joinedAt: 1000 },
      { peerId: JOAO, joinedAt: 2000 },
      { peerId: CARLA, joinedAt: 3000 }
    ])
    expect(trio[BRUNA]).toBe(3)
    expect(trio[JOAO]).toBe(4)
    expect(trio[CARLA]).toBe(7)
  })

  it('e deterministico entre clientes: a MESMA lista embaralhada da o MESMO mapa', () => {
    // Prova de AC-20 no nivel de unidade: a cor nunca viaja pela rede, entao os
    // dois clientes so convergem se a funcao independer da ordem de chegada.
    const members = [
      { peerId: CARLA, joinedAt: 3000 },
      { peerId: BRUNA, joinedAt: 1000 },
      { peerId: JOAO, joinedAt: 2000 }
    ]
    const shuffled = [members[1]!, members[0]!, members[2]!]
    expect(resolvePersonSlots(shuffled)).toEqual(resolvePersonSlots(members))
  })

  it('desempata por peerId lexicografico quando o joinedAt e IDENTICO', () => {
    const same = resolvePersonSlots([
      { peerId: JOAO, joinedAt: 1000 },
      { peerId: BRUNA, joinedAt: 1000 }
    ])
    // 'bruna' vem antes de 'joao-4': Bruna fica com o slot canonico.
    expect(same[BRUNA]).toBe(3)
    expect(same[JOAO]).toBe(4)
  })

  it('acrescentar um 5o membro nunca muda o slot dos 4 que ja estavam', () => {
    const random = makeRandom(20260827)
    for (let round = 0; round < 200; round += 1) {
      const four = makeMembers(random, 4, `r${round}`)
      const before = resolvePersonSlots(four)
      const newcomer = { peerId: `r${round}-novo`, joinedAt: 999 }
      const after = resolvePersonSlots([...four, newcomer])
      for (const member of four) {
        expect(after[member.peerId]).toBe(before[member.peerId])
      }
    }
  })

  it('com a sala CHEIA (8) os oito slots sao todos distintos', () => {
    // Garantia ESTRUTURAL, nao estatistica: 10 slots contra ROOM_MAX_LIMIT = 8.
    const random = makeRandom(11223344)
    for (let round = 0; round < 200; round += 1) {
      const eight = makeMembers(random, 8, `full${round}`)
      const slots = Object.values(resolvePersonSlots(eight))
      expect(slots).toHaveLength(8)
      expect(new Set(slots).size).toBe(8)
    }
  })

  it('devolve mapa vazio para lista vazia e TERMINA com mais membros que slots', () => {
    expect(resolvePersonSlots([])).toEqual({})
    const eleven = Array.from({ length: 11 }, (_, index) => ({
      peerId: `x-${index}`,
      joinedAt: index
    }))
    const result = resolvePersonSlots(eleven)
    expect(Object.keys(result)).toHaveLength(11)
    for (const slot of Object.values(result)) {
      expect(slot).toBeGreaterThanOrEqual(0)
      expect(slot).toBeLessThan(PERSON_COLOR_COUNT)
    }
  })
})

describe('person-colors / paleta', () => {
  it('mantem os 10 pares de matiz e luz, na ordem, como contrato', () => {
    expect(PERSON_COLOR_SLOTS).toEqual([
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
    ])
  })

  it('converte slot em cores concretas', () => {
    expect(colorOfSlot(8).fill).toBe('hsl(280 100% 68%)')
    expect(colorOfSlot(8).soft).toBe('hsl(280 100% 50% / 0.15)')
    expect(colorOfSlot(0).fill).toBe('hsl(20 100% 62%)')
    // Indice fora da faixa nao pode lancar nem devolver undefined.
    expect(colorOfSlot(PERSON_COLOR_COUNT)).toEqual(colorOfSlot(0))
  })

  it('nenhum slot cai na faixa de matiz de --danger', () => {
    // `--danger` e #ff3d5e, matiz aproximadamente 349: cor de pessoa nunca pode
    // ser lida como estado de erro.
    for (const slot of PERSON_COLOR_SLOTS) {
      expect(slot.hue >= 335 || slot.hue <= 10).toBe(false)
    }
  })

  it('da contraste de 4.5:1 ou mais da inicial contra o proprio fundo, nos 10 slots', () => {
    // Valores da tabela de 3/T1 da SPEC. Bater dentro de 0.05 prova que a
    // tabela nao e decorativa: ela foi calculada com esta mesma formula.
    const expected = [6.6, 11.11, 11.47, 10.8, 10.94, 11.09, 5.39, 5.11, 5.52, 5.69]
    PERSON_COLOR_SLOTS.forEach((slot, index) => {
      const fill = hslToRgb(slot.hue, 100, slot.light)
      const soft = composite(hslToRgb(slot.hue, 100, 50), 0.15, BG_APP)
      const ratio = contrastRatio(fill, soft)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(Math.abs(ratio - expected[index]!)).toBeLessThanOrEqual(0.05)
    })
  })

  it('todos os slots ficam ACIMA do contraste que o avatar entrega hoje', () => {
    // Referencia atual: --accent-hover #b23dff sobre --accent-soft (#9d00ff com
    // alpha 0x26/255) composto sobre --bg-app.
    const current = contrastRatio(
      [0xb2, 0x3d, 0xff],
      composite([0x9d, 0x00, 0xff], 0x26 / 255, BG_APP)
    )
    expect(current).toBeCloseTo(4.31, 1)
    for (const slot of PERSON_COLOR_SLOTS) {
      const fill = hslToRgb(slot.hue, 100, slot.light)
      const soft = composite(hslToRgb(slot.hue, 100, 50), 0.15, BG_APP)
      expect(contrastRatio(fill, soft)).toBeGreaterThan(current)
    }
  })
})
