// Contador com janela usado por todo ponto de log de audio (feature
// audio-quality). O que este arquivo protege de verdade:
//   1. a semantica "acumula e RESUME", que e o que separa este contador de uma
//      amostragem "1 a cada N": a linha liberada carrega o TOTAL do periodo,
//      nao uma amostra dele;
//   2. a primeira ocorrencia SEMPRE sai, porque "isto aconteceu pelo menos uma
//      vez" e a informacao que hoje nao existe em lugar nenhum;
//   3. o modulo nao le o relogio do sistema: `now` e argumento, e e por isso
//      que nao ha relogio falso em nenhum caso aqui.
import { describe, expect, it, vi } from 'vitest'
import { createThrottledCounter } from '@shared/log-throttle'

const WINDOW_MS = 10_000

describe('log-throttle', () => {
  it('1. exemplo trabalhado: mil ocorrencias em 10 s viram DUAS linhas com o total', () => {
    const counter = createThrottledCounter(WINDOW_MS)

    expect(counter.record(0)).toEqual({ count: 1, sinceMs: 0 })
    for (let now = 10; now <= 9_990; now += 10) {
      expect(counter.record(now)).toBeNull()
    }
    // As 999 suprimidas mais esta: o total do periodo, e nao uma amostra dele.
    expect(counter.record(10_000)).toEqual({ count: 1000, sinceMs: 10_000 })
    expect(counter.record(10_010)).toBeNull()
  })

  it('2. segunda janela conta a partir da ultima emissao', () => {
    const counter = createThrottledCounter(WINDOW_MS)

    // A ocorrencia que ABRE a janela ja saiu na linha anterior, entao a
    // proxima emissao conta so o que veio depois dela.
    counter.record(0)
    expect(counter.record(10_010)).toEqual({ count: 1, sinceMs: 10_010 })
    expect(counter.record(10_020)).toBeNull()
    expect(counter.record(20_020)).toEqual({ count: 2, sinceMs: 10_010 })
  })

  it('3. a primeira ocorrencia sai qualquer que seja o `now`', () => {
    expect(createThrottledCounter(WINDOW_MS).record(0)).toEqual({ count: 1, sinceMs: 0 })
    expect(createThrottledCounter(WINDOW_MS).record(1_700_000_000_000)).toEqual({
      count: 1,
      sinceMs: 0
    })
    expect(createThrottledCounter(WINDOW_MS).record(-50)).toEqual({ count: 1, sinceMs: 0 })
  })

  it('4. duas chamadas com o MESMO now: so a primeira emite', () => {
    const counter = createThrottledCounter(WINDOW_MS)

    expect(counter.record(500)).toEqual({ count: 1, sinceMs: 0 })
    expect(counter.record(500)).toBeNull()
  })

  it('5. fronteira exata: 10 000 emite (>=), 9 999 nao', () => {
    const early = createThrottledCounter(WINDOW_MS)
    early.record(0)
    expect(early.record(9_999)).toBeNull()

    const exact = createThrottledCounter(WINDOW_MS)
    exact.record(0)
    expect(exact.record(10_000)).toEqual({ count: 1, sinceMs: 10_000 })
  })

  it('6. flush devolve o pendente e nunca um resumo de contagem zero', () => {
    const counter = createThrottledCounter(WINDOW_MS)

    // Sem nenhuma ocorrencia: nada pendente.
    expect(counter.flush(0)).toBeNull()

    counter.record(0)
    // Logo depois de um record que emitiu, o pendente e zero.
    expect(counter.flush(10)).toBeNull()

    counter.record(20)
    counter.record(30)
    counter.record(40)
    expect(counter.flush(50)).toEqual({ count: 3, sinceMs: 50 })
    expect(counter.flush(60)).toBeNull()
  })

  it('7. janela zero ou negativa desliga o throttle, sem lancar', () => {
    const zero = createThrottledCounter(0)
    expect(zero.record(0)).toEqual({ count: 1, sinceMs: 0 })
    expect(zero.record(0)).toEqual({ count: 1, sinceMs: 0 })
    expect(zero.record(1)).toEqual({ count: 1, sinceMs: 1 })

    const negative = createThrottledCounter(-1)
    expect(negative.record(0)).toEqual({ count: 1, sinceMs: 0 })
    expect(negative.record(0)).toEqual({ count: 1, sinceMs: 0 })
  })

  it('8. relogio para tras devolve null e nao trava o contador', () => {
    const counter = createThrottledCounter(WINDOW_MS)

    counter.record(0)
    expect(counter.record(20_000)).toEqual({ count: 1, sinceMs: 20_000 })
    // Salto para tras: a diferenca fica negativa e a janela nunca abre.
    expect(counter.record(100)).toBeNull()
    // E a proxima leitura valida volta a emitir, com tudo que ficou pendente
    // (a ocorrencia do salto para tras nao se perde: ela e contada aqui).
    expect(counter.record(30_000)).toEqual({ count: 2, sinceMs: 10_000 })
  })

  it('9. o modulo nao chama o relogio do sistema', () => {
    const clock = vi.spyOn(Date, 'now')
    const counter = createThrottledCounter(WINDOW_MS)

    for (let index = 0; index < 50; index += 1) counter.record(index * 10)
    counter.flush(1_000)

    expect(clock).not.toHaveBeenCalled()
    clock.mockRestore()
  })
})
