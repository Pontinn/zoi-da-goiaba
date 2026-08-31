// Contador com JANELA para pontos de log de alta frequencia.
//
// Modulo PURO de proposito: sem DOM, sem Electron, sem import nenhum. Ele e
// importado pelo main, pelo renderer e por `tests/unit` sem preparo de ambiente.
//
// Por que ele existe: o `file-logger.ts` tem teto de 5 MB por dia e, quando o
// teto estoura, ele silencia o log do APP INTEIRO pelo resto do dia (a flag
// `capped`), levando junto ICE, sessao e codec. Uma linha por frame de audio, a
// 100 frames por segundo, estouraria esse teto em segundos. Nao existia helper
// de throttle no projeto, entao ele nasce aqui.
//
// Semantica: contar SEMPRE, escrever no maximo uma linha por janela, e a linha
// carrega o TOTAL acumulado desde a linha anterior. A primeira ocorrencia sai NA
// HORA, porque "isto aconteceu pelo menos uma vez" e a informacao mais valiosa.
// Amostragem ("1 a cada N") foi rejeitada: ela perde a MAGNITUDE, que e o que
// separa um descarte isolado de uma enxurrada.
//
// Por que `now` vem de fora: o modulo nao le o relogio do sistema em lugar
// nenhum. E isso que torna o teste deterministico sem relogio falso.

export interface ThrottleSummary {
  /** Ocorrencias acumuladas desde a linha anterior, incluindo a atual. */
  count: number
  /** Milissegundos desde a linha anterior; 0 na primeira. */
  sinceMs: number
}

export interface ThrottledCounter {
  /** Registra uma ocorrencia. Devolve o resumo quando a janela abriu, senao null. */
  record(now: number): ThrottleSummary | null
  /** Resumo do que ficou pendente, ou null se nada ficou. NAO usado em producao. */
  flush(now: number): ThrottleSummary | null
}

/**
 * Cria um contador com janela de `windowMs`.
 *
 * `windowMs <= 0` desliga o throttle: toda chamada de `record` devolve resumo.
 * Relogio para tras devolve `null` sem travar; a proxima janela valida volta a
 * emitir.
 */
export function createThrottledCounter(windowMs: number): ThrottledCounter {
  let pending = 0
  let lastEmitAt: number | null = null

  return {
    record(now: number): ThrottleSummary | null {
      pending += 1
      if (lastEmitAt === null) {
        const summary: ThrottleSummary = { count: pending, sinceMs: 0 }
        pending = 0
        lastEmitAt = now
        return summary
      }
      if (now - lastEmitAt >= windowMs) {
        const summary: ThrottleSummary = { count: pending, sinceMs: now - lastEmitAt }
        pending = 0
        lastEmitAt = now
        return summary
      }
      return null
    },

    flush(now: number): ThrottleSummary | null {
      if (pending === 0) return null
      const summary: ThrottleSummary = {
        count: pending,
        sinceMs: lastEmitAt === null ? 0 : now - lastEmitAt
      }
      pending = 0
      lastEmitAt = now
      return summary
    }
  }
}
