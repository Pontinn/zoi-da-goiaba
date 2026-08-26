// Cobertura da maquina de espera do primeiro quadro (Sprint 4, Feature 4.1).
//
// A fronteira de mock e a propria API da classe: ela nao toca DOM nem WebRTC,
// so recebe SINAIS. Timers falsos no padrao de `media-manager.test.ts`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FIRST_FRAME_ESCALATE_MS,
  FIRST_FRAME_GRACE_MS,
  WAITING_MIN_VISIBLE_MS
} from '@shared/config'
import { FirstFrameWatch, type FirstFrameStage } from '@renderer/services/first-frame-watch'

/** Cria a maquina ja com o coletor de estagios e os espioes de log ligados. */
function createWatch(txId = 'tx1'): {
  watch: FirstFrameWatch
  stages: FirstFrameStage[]
  info: ReturnType<typeof vi.spyOn>
  warn: ReturnType<typeof vi.spyOn>
} {
  const stages: FirstFrameStage[] = []
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const watch = new FirstFrameWatch(txId, { onStageChange: (stage) => stages.push(stage) })
  return { watch, stages, info, warn }
}

function textOf(spy: ReturnType<typeof vi.spyOn>, call = 0): string {
  return String(spy.mock.calls[call]?.[0] ?? '')
}

describe('first-frame-watch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('1. quadro pintado dentro da carencia nunca mostra aviso (AC-01)', () => {
    const { watch, stages, info } = createWatch()

    vi.advanceTimersByTime(1_000)
    watch.reportFramePainted()

    expect(stages).toEqual(['done'])
    expect(info).toHaveBeenCalledTimes(1)
    expect(textOf(info)).toContain('[player] primeiro quadro de tx1')
    expect(textOf(info)).toContain('em 1000ms')
    expect(textOf(info)).toContain('(aviso: nenhum)')

    // Avancar mais nao reabre nada: `done` e terminal na instancia.
    vi.advanceTimersByTime(60_000)
    expect(stages).toEqual(['done'])
  })

  it('2. sem prova, avisa aos 1500ms e escala aos 12000ms efetivos (AC-02/AC-05)', () => {
    const { watch, stages } = createWatch()

    vi.advanceTimersByTime(FIRST_FRAME_GRACE_MS - 1)
    expect(stages).toEqual([])
    vi.advanceTimersByTime(1)
    expect(stages).toEqual(['notice'])
    expect(watch.stage).toBe('notice')

    // A escalada e medida do ZERO EFETIVO total, nao a partir do aviso.
    vi.advanceTimersByTime(FIRST_FRAME_ESCALATE_MS - FIRST_FRAME_GRACE_MS - 1)
    expect(stages).toEqual(['notice'])
    vi.advanceTimersByTime(1)
    expect(stages).toEqual(['notice', 'escalated'])
    expect(watch.stage).toBe('escalated')
  })

  it('3. prova decodificada sozinha encerra; zero quadros nao encerra (AC-03)', () => {
    const semProva = createWatch('tx-preta')
    // Tela preta que nunca entrega quadro: 20s dao os dois estagios, e so eles.
    semProva.watch.reportFramesDecoded(0)
    vi.advanceTimersByTime(20_000)
    expect(semProva.stages).toEqual(['notice', 'escalated'])
    expect(semProva.info).not.toHaveBeenCalled()
    semProva.watch.dispose()
    vi.restoreAllMocks()

    const comProva = createWatch('tx-ok')
    vi.advanceTimersByTime(500)
    comProva.watch.reportFramesDecoded(7)
    expect(comProva.stages).toEqual(['done'])
    expect(comProva.info).toHaveBeenCalledTimes(1)
  })

  it('4. cena legitimamente escura nunca vira aviso (AC-19)', () => {
    const { watch, stages } = createWatch()

    vi.advanceTimersByTime(900)
    watch.reportFramePainted()
    vi.advanceTimersByTime(60_000)

    // Quadros fluem (a classe nem tem acesso ao conteudo do quadro): nenhum
    // estagio de aviso jamais foi notificado.
    expect(stages).toEqual(['done'])
    expect(stages).not.toContain('notice')
    expect(stages).not.toContain('escalated')
  })

  it('5. tempo pausado nao conta para nenhuma das fronteiras (AC-04)', () => {
    const { watch, stages } = createWatch()

    vi.advanceTimersByTime(1_000)
    watch.setBlocked(true)
    vi.advanceTimersByTime(30_000)
    expect(stages).toEqual([])

    watch.setBlocked(false)
    vi.advanceTimersByTime(499)
    expect(stages).toEqual([])
    vi.advanceTimersByTime(1)
    expect(stages).toEqual(['notice'])

    // Mesmo padrao cruzando a fronteira dos 12s efetivos.
    vi.advanceTimersByTime(5_000)
    watch.setBlocked(true)
    vi.advanceTimersByTime(120_000)
    expect(stages).toEqual(['notice'])
    watch.setBlocked(false)
    vi.advanceTimersByTime(FIRST_FRAME_ESCALATE_MS - FIRST_FRAME_GRACE_MS - 5_000 - 1)
    expect(stages).toEqual(['notice'])
    vi.advanceTimersByTime(1)
    expect(stages).toEqual(['notice', 'escalated'])

    // setBlocked redundante e no-op: nao ha dupla contagem nem timer duplicado.
    watch.setBlocked(true)
    watch.setBlocked(true)
    watch.setBlocked(false)
    watch.setBlocked(false)
    vi.advanceTimersByTime(60_000)
    expect(stages).toEqual(['notice', 'escalated'])
  })

  it('6. freeze depois do primeiro quadro nunca reabre o aviso (AC-07/AC-13/RF-15)', () => {
    const { watch, stages, info } = createWatch()

    watch.reportTrackChange('track-a')
    // Aos 3s o aviso ja apareceu (a carencia e 1,5s); o quadro entao encerra.
    vi.advanceTimersByTime(3_000)
    watch.reportFramePainted()
    expect(stages).toEqual(['notice', 'done'])

    vi.advanceTimersByTime(120_000)
    watch.reportTrackChange('track-a')
    watch.setBlocked(true)
    watch.setBlocked(false)

    expect(watch.stage).toBe('done')
    expect(stages).toEqual(['notice', 'done'])
    expect(info).toHaveBeenCalledTimes(1)
  })

  it('7. faixa substituida antes do quadro reseta; a primeira faixa nao (AC-06)', () => {
    const { watch, stages } = createWatch()

    // null -> track-a e a CHEGADA da primeira faixa: nao zera o relogio corrido.
    vi.advanceTimersByTime(1_000)
    watch.reportTrackChange('track-a')
    vi.advanceTimersByTime(500)
    expect(stages).toEqual(['notice'])

    // Aos 5s, ja em `notice`, a faixa e SUBSTITUIDA: volta para a carencia.
    vi.advanceTimersByTime(3_500)
    watch.reportTrackChange('track-b')
    expect(stages).toEqual(['notice', 'grace'])
    expect(watch.stage).toBe('grace')

    vi.advanceTimersByTime(FIRST_FRAME_GRACE_MS - 1)
    expect(stages).toEqual(['notice', 'grace'])
    vi.advanceTimersByTime(1)
    expect(stages).toEqual(['notice', 'grace', 'notice'])
  })

  it('8. dispose sem quadro loga o desfecho triste uma unica vez (AC-14)', () => {
    const { watch, stages, warn, info } = createWatch('tx-triste')

    vi.advanceTimersByTime(15_000)
    expect(stages).toEqual(['notice', 'escalated'])

    watch.dispose()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(textOf(warn)).toContain('tx-triste')
    expect(textOf(warn)).toContain('sem nenhum quadro')
    expect(textOf(warn)).toContain('apos 15000ms')
    expect(textOf(warn)).toContain('(aviso: escalado)')
    expect(info).not.toHaveBeenCalled()

    // Dispose duplo nao loga de novo e nenhum timer sobrevive.
    watch.dispose()
    vi.advanceTimersByTime(120_000)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(stages).toEqual(['notice', 'escalated'])
  })

  it('9. provas repetidas geram UMA unica linha de log (AC-14)', () => {
    const { watch, stages, info } = createWatch()

    vi.advanceTimersByTime(800)
    watch.reportFramePainted()
    watch.reportFramePainted()
    watch.reportFramesDecoded(42)

    expect(stages).toEqual(['done'])
    expect(info).toHaveBeenCalledTimes(1)

    // O dispose de uma visualizacao que JA teve quadro nao acrescenta linha.
    watch.dispose()
    expect(info).toHaveBeenCalledTimes(1)
  })

  it('10. minimo visivel segura o `done`, nunca o log (anti-flash)', () => {
    const { watch, stages, info } = createWatch()

    vi.advanceTimersByTime(FIRST_FRAME_GRACE_MS)
    expect(stages).toEqual(['notice'])

    // Quadro logo apos a carencia: o log sai NA HORA, com o tempo real.
    vi.advanceTimersByTime(100)
    watch.reportFramePainted()
    expect(info).toHaveBeenCalledTimes(1)
    expect(textOf(info)).toContain('em 1600ms')
    expect(textOf(info)).toContain('(aviso: espera)')
    expect(stages).toEqual(['notice'])

    // O `done` so vem quando o aviso completa o minimo visivel.
    vi.advanceTimersByTime(WAITING_MIN_VISIBLE_MS - 100 - 1)
    expect(stages).toEqual(['notice'])
    vi.advanceTimersByTime(1)
    expect(stages).toEqual(['notice', 'done'])
  })

  it('10b. quadro dentro da carencia nao sofre atraso nenhum', () => {
    const { watch, stages } = createWatch()

    vi.advanceTimersByTime(1_000)
    watch.reportFramePainted()

    // Sem avancar um unico ms: `done` foi notificado na hora.
    expect(stages).toEqual(['done'])
  })

  it('10c. dispose durante o minimo visivel nao deixa callback nem log orfao', () => {
    const { watch, stages, info, warn } = createWatch()

    vi.advanceTimersByTime(FIRST_FRAME_GRACE_MS)
    vi.advanceTimersByTime(100)
    watch.reportFramePainted()
    expect(info).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)
    watch.dispose()

    vi.advanceTimersByTime(120_000)
    expect(stages).toEqual(['notice'])
    expect(info).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })
})
