// Area real do video dentro do player (RF-19/AC-18). O modulo e puro, entao o
// teste e aritmetica pura: nenhum DOM, nenhum mock.
//
// O exemplo trabalhado nao foi inventado aqui: e a caixa REAL do `<video>` que o
// UISPEC mediu na captura `03-playerview-remote-stream.png` (1104 x 820 px com
// stream 720p), com as faixas pretas de 99,5 px em cima e embaixo.
import { describe, expect, it } from 'vitest'
import { contentRectOf, normalizedPointIn, type ContentRect } from '@shared/geometry'

describe('geometry / contentRectOf', () => {
  it('reproduz o exemplo trabalhado do letterbox medido no UISPEC', () => {
    const rect = contentRectOf(1104, 820, 1280, 720)
    expect(rect).not.toBeNull()
    expect(rect!.left).toBeCloseTo(0, 10)
    expect(rect!.top).toBeCloseTo(99.5, 10)
    expect(rect!.width).toBeCloseTo(1104, 10)
    expect(rect!.height).toBeCloseTo(621, 10)
  })

  it('poe as barras nas LATERAIS quando o elemento e mais largo que o stream', () => {
    const rect = contentRectOf(1600, 600, 1280, 720)
    expect(rect).not.toBeNull()
    // 600/720 e menor que 1600/1280, entao a altura manda e sobra nas laterais.
    expect(rect!.top).toBeCloseTo(0, 10)
    expect(rect!.left).toBeGreaterThan(0)
    expect(rect!.height).toBeCloseTo(600, 10)
    expect(rect!.width).toBeCloseTo((1280 * 600) / 720, 10)
  })

  it('nao deixa barra nenhuma quando a proporcao e identica', () => {
    // A formula ja cobre este caso: nao pode existir ramo especial para ele.
    const rect = contentRectOf(640, 360, 1280, 720)
    expect(rect).toEqual({ left: 0, top: 0, width: 640, height: 360 })
  })

  it('devolve null para zero, negativo, NaN e Infinity em CADA argumento', () => {
    const valid = [1104, 820, 1280, 720] as const
    const invalids = [0, -1, NaN, Infinity, -Infinity]
    for (let index = 0; index < valid.length; index += 1) {
      for (const invalid of invalids) {
        const args = [...valid] as [number, number, number, number]
        args[index] = invalid
        expect(contentRectOf(...args)).toBeNull()
      }
    }
    // O caminho valido continua valido, para o laco acima nao passar por engano.
    expect(contentRectOf(...valid)).not.toBeNull()
  })
})

describe('geometry / normalizedPointIn', () => {
  const rect: ContentRect = contentRectOf(1104, 820, 1280, 720)!

  it('devolve o par 0.35 / 0.60 do exemplo do AC-18', () => {
    const point = normalizedPointIn(rect, 386.4, 472.1)
    expect(point).not.toBeNull()
    expect(point!.x).toBeCloseTo(0.35, 6)
    expect(point!.y).toBeCloseTo(0.6, 6)
  })

  it('devolve null na faixa preta do letterbox (RF-17)', () => {
    // 50 px do topo cai na faixa preta de 99,5 px: nao existe conteudo ali.
    expect(normalizedPointIn(rect, 500, 50)).toBeNull()
    expect(normalizedPointIn(rect, 500, 815)).toBeNull()
  })

  it('e valido EXATAMENTE nas quatro bordas', () => {
    expect(normalizedPointIn(rect, rect.left, rect.top)).toEqual({ x: 0, y: 0 })
    expect(normalizedPointIn(rect, rect.left + rect.width, rect.top)).toEqual({ x: 1, y: 0 })
    expect(normalizedPointIn(rect, rect.left, rect.top + rect.height)).toEqual({ x: 0, y: 1 })
    expect(normalizedPointIn(rect, rect.left + rect.width, rect.top + rect.height)).toEqual({
      x: 1,
      y: 1
    })
  })

  it('devolve null 1 px FORA de cada uma das quatro bordas, sem clampar', () => {
    // Clampar prenderia o ponteiro na borda, que e o defeito que RF-17 proibe:
    // por isso o retorno e null e nunca 0 ou 1.
    expect(normalizedPointIn(rect, rect.left - 1, 400)).toBeNull()
    expect(normalizedPointIn(rect, rect.left + rect.width + 1, 400)).toBeNull()
    expect(normalizedPointIn(rect, 500, rect.top - 1)).toBeNull()
    expect(normalizedPointIn(rect, 500, rect.top + rect.height + 1)).toBeNull()
  })

  it('devolve null para ponto nao finito e para retangulo degenerado', () => {
    expect(normalizedPointIn(rect, NaN, 400)).toBeNull()
    expect(normalizedPointIn(rect, 500, Infinity)).toBeNull()
    expect(normalizedPointIn({ left: 0, top: 0, width: 0, height: 10 }, 0, 0)).toBeNull()
  })
})
