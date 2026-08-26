// Tela 5 do UISPEC (Assistindo): a MESMA stream da miniatura promovida ao player
// (sem nova conexao), com fullscreen real, controles auto-hide, volume local,
// janela flutuante e overlay de reconexao.
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { QualitySample } from '../../core/room-state'
import {
  FirstFrameWatch,
  type FirstFrameStage
} from '../../services/first-frame-watch'
import { closePip, isPipSupported, openPip } from '../../services/pip-controller'
import type { InboundVideoStats } from '../../services/stats-monitor'
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
  onBack
}: PlayerViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const attachedRef = useRef<MediaStream | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [pipActive, setPipActive] = useState(false)
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

  // Fullscreen real: Esc nativo e o botao mantem o estado sincronizado (AC-14).
  useEffect(() => {
    const onChange = (): void => {
      setFullscreen(document.fullscreenElement === containerRef.current)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

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

  return (
    <div className={classes} ref={containerRef} data-testid="player">
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
