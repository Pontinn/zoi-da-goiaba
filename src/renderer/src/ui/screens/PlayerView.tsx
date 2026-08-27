// Tela 5 do UISPEC (Assistindo): a MESMA stream da miniatura promovida ao player
// (sem nova conexao), com fullscreen real, controles auto-hide, volume local,
// janela flutuante e overlay de reconexao.
import { useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react'
import { contentRectOf, normalizedPointIn, type ContentRect } from '@shared/geometry'
import type { RosterMember } from '@shared/protocol'
import type { QualitySample } from '../../core/room-state'
import {
  FirstFrameWatch,
  type FirstFrameStage
} from '../../services/first-frame-watch'
import { cursorHub } from '../../services/cursor-hub'
import { closePip, isPipSupported, openPip } from '../../services/pip-controller'
import type { InboundVideoStats } from '../../services/stats-monitor'
import { CursorLayer } from '../components/CursorLayer'
import { MediaFailureOverlay } from '../components/MediaFailureOverlay'
import { PlayerControls } from '../components/PlayerControls'
import { ReconnectOverlay } from '../components/ReconnectOverlay'
import { WaitingOverlay } from '../components/WaitingOverlay'

/** Volume escolhido vale para a sessao inteira (memoria, nao configuracao). */
let sessionVolume = 1
let sessionMuted = false

const IDLE_MS = 3_000

export interface PlayerViewProps {
  txId: string
  stream: MediaStream | null
  nickname: string
  presetLabel: string
  hasAudio: boolean
  reconnecting: boolean
  /** A midia foi atendida e nunca chegou (conexao direta entre as redes). */
  failed: boolean
  quality: QualitySample | undefined
  qualityTick: number
  /** Contadores de quadro desta transmissao, do tick de 3s do monitor. */
  videoStats: InboundVideoStats | undefined
  /** O transmissor ligou os ponteiros dos espectadores nesta transmissao. */
  pointersEnabled: boolean
  members: RosterMember[]
  selfPeerId: string
  onBack: () => void
}

/**
 * Coreografia de saida do aviso de espera: 180ms de `--dur-enter` mais folga.
 * Vive aqui, e nao em config, porque e detalhe de animacao acoplado ao CSS, nao
 * um limiar de produto (esses estao em `@shared/config`).
 */
const WAITING_EXIT_MS = 200

/** Estado visivel do aviso, num objeto so para trocar tudo num unico update. */
interface WaitingState {
  stage: FirstFrameStage
  /**
   * Ultimo estagio que chegou a ficar VISIVEL. Congela durante a saida: sem
   * isso, um aviso que estava ESCALADO piscaria a copy do estagio 1 no fade.
   */
  shown: 'notice' | 'escalated'
  exiting: boolean
}

/**
 * Liga a maquina de espera do primeiro quadro (RF-01..RF-11) ao ciclo de vida do
 * player. UMA instancia por mount: o `key={txId}` do RoomScreen ja remonta o
 * player a cada troca de transmissao, entao nada sobrevive a uma visualizacao.
 *
 * Nada aqui toca o pipeline de midia: a prova PINTADA vem do proprio elemento de
 * video (rVFC, um unico disparo) e a prova DECODIFICADA vem da prop de stats,
 * coletada no tick que ja existia. Nenhum listener novo em track ou pconn.
 */
function useFirstFrameWatch(
  txId: string,
  videoRef: RefObject<HTMLVideoElement>,
  stream: MediaStream | null,
  reconnecting: boolean,
  failed: boolean,
  videoStats: InboundVideoStats | undefined
): WaitingState {
  const watchRef = useRef<FirstFrameWatch | null>(null)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stageRef = useRef<FirstFrameStage>('grace')
  const [waiting, setWaiting] = useState<WaitingState>({
    stage: 'grace',
    shown: 'notice',
    exiting: false
  })

  // Instancia unica por visualizacao; o dispose do unmount emite o desfecho.
  useEffect(() => {
    /*
     * Toda transicao passa por aqui, sempre disparada por um SINAL (timer da
     * maquina, quadro pintado, quadro decodificado). A saida suave comeca no
     * exato `done` que vem de um estagio visivel; `done` vindo da carencia nao
     * mostra nem anima nada (caminho rapido intocado).
     *
     * INVARIANTE: nada disso toca o video. O elemento ja esta com `srcObject` e
     * tocando por baixo; o que sai devagar e apenas o veu escuro do overlay.
     */
    const handleStage = (stage: FirstFrameStage): void => {
      const previous = stageRef.current
      stageRef.current = stage
      const startExit = stage === 'done' && (previous === 'notice' || previous === 'escalated')
      if (startExit) {
        if (exitTimerRef.current !== null) clearTimeout(exitTimerRef.current)
        exitTimerRef.current = setTimeout(() => {
          exitTimerRef.current = null
          setWaiting((current) => ({ ...current, exiting: false }))
        }, WAITING_EXIT_MS)
      }
      setWaiting((current) => ({
        stage,
        shown: stage === 'notice' || stage === 'escalated' ? stage : current.shown,
        exiting: startExit ? true : current.exiting
      }))
    }

    const watch = new FirstFrameWatch(txId, { onStageChange: handleStage })
    watchRef.current = watch
    return () => {
      watch.dispose()
      watchRef.current = null
      if (exitTimerRef.current !== null) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
    }
  }, [txId])

  /*
   * Pausa do relogio (RF-04). Os overlays de precedencia sao a causa que atua
   * hoje; o ramo de visibilidade e DEFENSIVO: com `backgroundThrottling: false`
   * (src/main/index.ts) o `visibilityState` fica sempre `visible` neste app, mas
   * se um dia isso voltar atras a pausa passa a funcionar sozinha. Stream sem
   * faixa de video pausa para sempre (RF-09): nada a esperar, aviso nunca sobe.
   * Stream ainda `null` CONTA tempo: o espectador ja esta encarando preto.
   */
  useEffect(() => {
    const watch = watchRef.current
    if (watch === null) return
    const apply = (): void => {
      const hidden = document.visibilityState === 'hidden'
      const withoutVideoTrack = stream !== null && stream.getVideoTracks().length === 0
      watch.setBlocked(reconnecting || failed || hidden || withoutVideoTrack)
    }
    apply()
    document.addEventListener('visibilitychange', apply)
    return () => document.removeEventListener('visibilitychange', apply)
  }, [reconnecting, failed, stream])

  // Faixa SUBSTITUIDA antes do primeiro quadro reinicia a espera (RF-06).
  useEffect(() => {
    watchRef.current?.reportTrackChange(stream?.getVideoTracks()[0]?.id ?? null)
  }, [stream])

  /*
   * Prova PINTADA (RF-03/RNF-02): um unico disparo por attach, sem nenhum
   * reagendamento. O callback captura o instante do primeiro quadro e para.
   */
  useEffect(() => {
    const watch = watchRef.current
    const element = videoRef.current
    if (watch === null || element === null) return
    if (watch.stage === 'done') return
    if (typeof element.requestVideoFrameCallback !== 'function') return
    const id = element.requestVideoFrameCallback(() => watch.reportFramePainted())
    return () => element.cancelVideoFrameCallback(id)
  }, [stream, videoRef])

  // Prova DECODIFICADA (RF-03): granularidade de 3s, rede de seguranca da acima.
  useEffect(() => {
    if (videoStats && videoStats.framesDecoded > 0) {
      watchRef.current?.reportFramesDecoded(videoStats.framesDecoded)
    }
  }, [videoStats])

  return waiting
}

export function PlayerView({
  txId,
  stream,
  nickname,
  presetLabel,
  hasAudio,
  reconnecting,
  failed,
  quality,
  qualityTick,
  videoStats,
  pointersEnabled,
  members,
  selfPeerId,
  onBack
}: PlayerViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const attachedRef = useRef<MediaStream | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * Area REAL do video dentro da caixa (RF-19). Vive num `ref` de proposito: e
   * lida no callback de quadro do `CursorHub` a 30 Hz, e guardar isso em estado
   * custaria um render por medida sem mudar um pixel do que se ve.
   */
  const contentRectRef = useRef<ContentRect | null>(null)

  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [pipActive, setPipActive] = useState(false)
  /**
   * Janela do app em foco (RF-20). O sinal e `blur`/`focus` da JANELA, nunca
   * `document.visibilitychange`: com `backgroundThrottling: false` o
   * `visibilityState` deste app fica sempre `visible` (armadilha ja documentada
   * no efeito de pausa do relogio do primeiro quadro).
   */
  const [focused, setFocused] = useState(true)
  const [volume, setVolume] = useState(sessionVolume)
  const [muted, setMuted] = useState(sessionMuted)
  const pipSupported = isPipSupported()

  // Stream atribuida UMA vez por stream (regra de performance da SPEC).
  useEffect(() => {
    const element = videoRef.current
    if (!element || !stream || attachedRef.current === stream) return
    attachedRef.current = stream
    element.srcObject = stream
    void element.play().catch(() => {
      /* autoplay pode exigir interacao; o clique na miniatura ja e a interacao */
    })
  }, [stream, txId])

  // Declarado APOS o attach para que o rVFC seja armado com o srcObject ja no
  // elemento. O aviso de espera do primeiro quadro sai daqui (RF-01..RF-11).
  const {
    stage: waitStage,
    shown: shownStage,
    exiting
  } = useFirstFrameWatch(txId, videoRef, stream, reconnecting, failed, videoStats)

  // Volume e mudo vivem no elemento, jamais na stream (RF-28).
  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    element.volume = volume
    element.muted = muted
    sessionVolume = volume
    sessionMuted = muted
  }, [volume, muted])

  /**
   * Mede o `<video>`, NUNCA o `.z-player`: o container tem `border: 1px` fora do
   * fullscreen e a perde dentro dele, o que viraria um erro sistematico (e de
   * tamanho variavel entre os dois modos) em toda coordenada normalizada.
   */
  const measure = (): void => {
    const element = videoRef.current
    if (!element) {
      contentRectRef.current = null
      return
    }
    const box = element.getBoundingClientRect()
    contentRectRef.current = contentRectOf(
      box.width,
      box.height,
      element.videoWidth,
      element.videoHeight
    )
  }

  // Fullscreen real: Esc nativo e o botao mantem o estado sincronizado (AC-14).
  // O MESMO evento remede o retangulo de conteudo: o `<video>` muda de tamanho
  // exatamente aqui (UISPEC secao 8).
  useEffect(() => {
    const onChange = (): void => {
      setFullscreen(document.fullscreenElement === containerRef.current)
      measure()
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    const element = videoRef.current
    measure()
    if (!element) return undefined
    element.addEventListener('loadedmetadata', measure)
    window.addEventListener('resize', measure)
    return () => {
      element.removeEventListener('loadedmetadata', measure)
      window.removeEventListener('resize', measure)
    }
  }, [stream, txId])

  // Foco da janela (RF-20): sair do app encerra o proprio ponteiro na hora.
  useEffect(() => {
    const onBlur = (): void => {
      setFocused(false)
      cursorHub.endLocal()
    }
    const onFocus = (): void => setFocused(true)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  /*
   * Contexto de ENVIO do proprio ponteiro. O cleanup ja dispara o `CURSOR_END`
   * do txId anterior, o que cobre tanto a troca de transmissao (RF-18) quanto a
   * desmontagem do player.
   */
  useEffect(() => {
    cursorHub.setSendContext({ txId, enabled: pointersEnabled && !pipActive && focused })
    return () => cursorHub.setSendContext({ txId: null, enabled: false })
  }, [txId, pointersEnabled, pipActive, focused])

  // Auto-hide dos controles (e do cursor) apos 3s sem atividade (RNF-07).
  useEffect(() => {
    const schedule = (): void => {
      if (idleTimerRef.current !== null) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => setControlsVisible(false), IDLE_MS)
    }
    const wake = (): void => {
      setControlsVisible(true)
      schedule()
    }
    schedule()
    window.addEventListener('mousemove', wake)
    window.addEventListener('keydown', wake)
    window.addEventListener('mousedown', wake)
    return () => {
      if (idleTimerRef.current !== null) clearTimeout(idleTimerRef.current)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('keydown', wake)
      window.removeEventListener('mousedown', wake)
    }
  }, [])

  // Sair do player (transmissao encerrada, volta para a grade) limpa tudo.
  useEffect(() => {
    return () => {
      closePip()
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [])

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
      return
    }
    void containerRef.current?.requestFullscreen().catch(() => {})
  }

  const togglePip = async (): Promise<void> => {
    if (pipActive) {
      closePip()
      return
    }
    const element = videoRef.current
    if (!element) return
    // Video e um so: PiP e fullscreen nao coexistem.
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
    const session = await openPip({
      video: element,
      onClose: () => setPipActive(false)
    })
    if (session) setPipActive(true)
  }

  const classes = [
    'z-player',
    fullscreen ? 'z-player--fullscreen' : '',
    controlsVisible ? '' : 'z-player--idle'
  ]
    .filter(Boolean)
    .join(' ')

  /**
   * Posicao do proprio ponteiro (RF-12). Fora do conteudo real (faixa preta do
   * letterbox) o ponteiro e ENCERRADO, nunca preso na borda (RF-17).
   */
  const onPlayerMouseMove = (event: MouseEvent<HTMLDivElement>): void => {
    if (!pointersEnabled || pipActive) return
    const element = videoRef.current
    const rect = contentRectRef.current
    if (!element || !rect) return
    const box = element.getBoundingClientRect()
    const point = normalizedPointIn(rect, event.clientX - box.left, event.clientY - box.top)
    if (point === null) {
      cursorHub.endLocal()
      return
    }
    cursorHub.reportLocalPoint(point.x, point.y)
  }

  return (
    <div
      className={classes}
      ref={containerRef}
      data-testid="player"
      onMouseMove={onPlayerMouseMove}
      onMouseLeave={() => cursorHub.endLocal()}
    >
      <video
        className="z-player__video"
        ref={videoRef}
        playsInline
        autoPlay
        onDoubleClick={toggleFullscreen}
      />

      {pipActive ? (
        <div className="z-player__pip-note">
          <span className="z-empty__title">Assistindo na janela flutuante</span>
          <span className="z-empty__text">
            A janelinha fica por cima dos outros programas. Feche ou use o botao de voltar dela
            para trazer a transmissao de volta para ca.
          </span>
        </div>
      ) : null}

      {reconnecting ? <ReconnectOverlay nickname={nickname} /> : null}

      {!reconnecting && failed ? <MediaFailureOverlay nickname={nickname} /> : null}

      {!reconnecting &&
      !failed &&
      (waitStage === 'notice' || waitStage === 'escalated' || exiting) ? (
        <WaitingOverlay nickname={nickname} stage={shownStage} exiting={exiting} />
      ) : null}

      {/*
        IRMAO do video e ANTES do PlayerControls de proposito: player.css nao tem
        z-index nenhum, o empilhamento e ordem de fonte, e o precedente
        "controles sempre por cima" fica preservado (UISPEC secao 4).
      */}
      {pointersEnabled && !pipActive ? (
        <CursorLayer
          txId={txId}
          enabled={pointersEnabled}
          videoRef={videoRef}
          contentRectRef={contentRectRef}
          members={members}
          selfPeerId={selfPeerId}
        />
      ) : null}

      <PlayerControls
        visible={controlsVisible}
        title={nickname}
        presetLabel={presetLabel}
        hasAudio={hasAudio}
        quality={quality}
        qualityTick={qualityTick}
        fullscreen={fullscreen}
        pipSupported={pipSupported}
        pipActive={pipActive}
        volume={volume}
        muted={muted}
        onBack={onBack}
        onVolume={(next) => {
          setVolume(next)
          if (next > 0 && muted) setMuted(false)
        }}
        onToggleMute={() => setMuted((value) => !value)}
        onToggleFullscreen={toggleFullscreen}
        onTogglePip={() => void togglePip()}
      />
    </div>
  )
}
