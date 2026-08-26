// Maquina de espera do PRIMEIRO quadro de uma visualizacao (RF-01..RF-07).
//
// Licao que originou a feature (.forge/LESSONS.md): "receber o objeto de midia
// NAO prova midia fluindo" - o evento `stream` do PeerJS dispara ainda na troca
// de SDP, muito antes do primeiro pacote RTP. Por isso a prova aqui e SEMPRE de
// fluxo de video (quadro pintado OU quadro decodificado), nunca a mera posse da
// stream, e jamais leitura de pixel (RNF-01).
//
// A outra licao do arquivo, "instrumentar ANTES de tentar corrigir", e a razao
// do log: uma unica linha por visualizacao com o tempo REAL ate o primeiro
// quadro (ou o desfecho triste de ter fechado sem nenhum), ja espelhada no
// arquivo do dia pelo file-logger do main.
//
// Pura de proposito: nao toca DOM nem WebRTC. Recebe SINAIS por metodos, o que a
// torna testavel no Vitest em ambiente node.
import {
  FIRST_FRAME_ESCALATE_MS,
  FIRST_FRAME_GRACE_MS,
  WAITING_MIN_VISIBLE_MS
} from '@shared/config'

export type FirstFrameStage = 'grace' | 'notice' | 'escalated' | 'done'

export interface FirstFrameWatchCallbacks {
  onStageChange(stage: FirstFrameStage): void
}

/** Estagio maximo alcancado, no vocabulario da linha de log. */
type MaxStageLabel = 'nenhum' | 'espera' | 'escalado'

export class FirstFrameWatch {
  private currentStage: FirstFrameStage = 'grace'
  /** Tempo EFETIVO ja contado (fora dos periodos pausados). */
  private accumulatedMs = 0
  /** Quando o relogio voltou a correr; `null` = pausado. */
  private runningSince: number | null = Date.now()
  /** Tempo de PAREDE de abertura da visualizacao: e o numero que o log reporta. */
  private readonly openedAt = Date.now()
  private maxStage: MaxStageLabel = 'nenhum'
  private timer: ReturnType<typeof setTimeout> | null = null
  private currentTrackId: string | null = null
  private logged = false
  private disposed = false
  /** Quando o aviso ficou VISIVEL; insumo do minimo visivel anti-flash. */
  private shownAt: number | null = null
  private minVisibleTimer: ReturnType<typeof setTimeout> | null = null
  /** Prova ja recebida, mesmo que `done` ainda nao tenha sido notificado. */
  private completed = false

  /**
   * Nasce RODANDO: o espectador ja esta encarando o preto no instante em que o
   * player monta. O hook ajusta o estado real de bloqueio logo apos criar.
   */
  constructor(
    private readonly txId: string,
    private readonly callbacks: FirstFrameWatchCallbacks
  ) {
    this.scheduleNext()
  }

  get stage(): FirstFrameStage {
    return this.currentStage
  }

  /**
   * Pausa/retoma o relogio (RF-04). A classe nao sabe o MOTIVO: recebe um
   * booleano ja combinado (overlay de precedencia, janela oculta, stream sem
   * faixa de video). Tempo pausado nao conta para nenhuma das duas fronteiras.
   */
  setBlocked(blocked: boolean): void {
    if (this.disposed || this.completed) return
    if (blocked) {
      if (this.runningSince === null) return
      this.accumulatedMs += Date.now() - this.runningSince
      this.runningSince = null
      this.clearStageTimer()
      return
    }
    if (this.runningSince !== null) return
    this.runningSince = Date.now()
    this.scheduleNext()
  }

  /** Prova 1 (RF-03): o elemento de video PINTOU um quadro (rVFC). */
  reportFramePainted(): void {
    this.complete()
  }

  /** Prova 2 (RF-03): o decoder entregou quadros (`framesDecoded` do getStats). */
  reportFramesDecoded(frames: number): void {
    if (frames > 0) this.complete()
  }

  /**
   * Faixa de video corrente da stream (F3). Faixa SUBSTITUIDA antes do primeiro
   * quadro reinicia a espera; a CHEGADA da primeira faixa nao zera o relogio que
   * ja comecou na abertura do player.
   */
  reportTrackChange(trackId: string | null): void {
    if (this.disposed || this.completed) return
    const previous = this.currentTrackId
    this.currentTrackId = trackId
    if (previous === null || trackId === null || trackId === previous) return

    this.accumulatedMs = 0
    if (this.runningSince !== null) this.runningSince = Date.now()
    this.maxStage = 'nenhum'
    this.shownAt = null
    this.currentStage = 'grace'
    this.callbacks.onStageChange('grace')
    this.scheduleNext()
  }

  /** Fim da visualizacao (unmount do player). Idempotente. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.clearStageTimer()
    if (this.minVisibleTimer !== null) {
      clearTimeout(this.minVisibleTimer)
      this.minVisibleTimer = null
    }
    if (this.completed || this.logged) return
    this.logged = true
    console.warn(
      '[player] visualizacao de ' +
        this.txId +
        ' fechada sem nenhum quadro apos ' +
        (Date.now() - this.openedAt) +
        'ms (aviso: ' +
        this.maxStage +
        ')'
    )
  }

  // --- interno --------------------------------------------------------------

  private effectiveMs(): number {
    return this.accumulatedMs + (this.runningSince !== null ? Date.now() - this.runningSince : 0)
  }

  private clearStageTimer(): void {
    if (this.timer === null) return
    clearTimeout(this.timer)
    this.timer = null
  }

  /** UM unico timeout por vez, sempre para a proxima fronteira efetiva. */
  private scheduleNext(): void {
    this.clearStageTimer()
    if (this.disposed || this.completed || this.runningSince === null) return
    if (this.currentStage !== 'grace' && this.currentStage !== 'notice') return
    const boundaryMs =
      this.currentStage === 'grace' ? FIRST_FRAME_GRACE_MS : FIRST_FRAME_ESCALATE_MS
    const delayMs = Math.max(0, boundaryMs - this.effectiveMs())
    this.timer = setTimeout(() => {
      this.timer = null
      this.advance()
    }, delayMs)
  }

  private advance(): void {
    if (this.disposed || this.completed) return
    if (this.currentStage === 'grace') {
      this.currentStage = 'notice'
      this.maxStage = 'espera'
      this.shownAt = Date.now()
    } else if (this.currentStage === 'notice') {
      // A escalada e medida do ZERO EFETIVO total (RF-05), nao a partir do aviso.
      this.currentStage = 'escalated'
      this.maxStage = 'escalado'
    } else {
      return
    }
    this.callbacks.onStageChange(this.currentStage)
    this.scheduleNext()
  }

  private complete(): void {
    if (this.disposed || this.completed) return
    this.completed = true
    this.clearStageTimer()

    // O log sai no instante REAL do primeiro quadro: atrasa-lo pela coreografia
    // contaminaria a metrica de diagnostico da proxima feature.
    if (!this.logged) {
      this.logged = true
      console.info(
        '[player] primeiro quadro de ' +
          this.txId +
          ' em ' +
          (Date.now() - this.openedAt) +
          'ms (aviso: ' +
          this.maxStage +
          ')'
      )
    }

    // Minimo visivel (anti-flash): so vale se o aviso chegou a APARECER. O video
    // ja esta tocando por baixo; o que espera aqui e apenas o veu do overlay.
    if (this.shownAt === null) {
      this.finish()
      return
    }
    const remainingMs = Math.max(0, WAITING_MIN_VISIBLE_MS - (Date.now() - this.shownAt))
    if (remainingMs === 0) {
      this.finish()
      return
    }
    this.minVisibleTimer = setTimeout(() => {
      this.minVisibleTimer = null
      this.finish()
    }, remainingMs)
  }

  private finish(): void {
    if (this.disposed) return
    this.currentStage = 'done'
    this.callbacks.onStageChange('done')
  }
}
