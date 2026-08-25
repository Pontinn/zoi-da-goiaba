// Tela 5 do UISPEC (Assistindo): a MESMA stream da miniatura promovida ao player
// (sem nova conexao), com fullscreen real, controles auto-hide, volume local,
// janela flutuante e overlay de reconexao.
import { useEffect, useRef, useState } from 'react'
import type { QualitySample } from '../../core/room-state'
import { closePip, isPipSupported, openPip } from '../../services/pip-controller'
import { PlayerControls } from '../components/PlayerControls'
import { ReconnectOverlay } from '../components/ReconnectOverlay'

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
  quality: QualitySample | undefined
  qualityTick: number
  onBack: () => void
}

export function PlayerView({
  txId,
  stream,
  nickname,
  presetLabel,
  hasAudio,
  reconnecting,
  quality,
  qualityTick,
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
