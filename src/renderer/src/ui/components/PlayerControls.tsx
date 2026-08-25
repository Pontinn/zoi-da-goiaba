// Barra de controles do player (UISPEC secao 3): voltar, volume, badge de preset,
// barras de conexao, PiP e fullscreen. Auto-hide em fade + slide de 180ms.
import type { QualitySample } from '../../core/room-state'
import { ConnectionBars } from './ConnectionBars'
import { VolumeControl } from './VolumeControl'
import { ArrowLeftIcon, FullscreenExitIcon, FullscreenIcon, PipIcon } from './icons'

export interface PlayerControlsProps {
  visible: boolean
  title: string
  presetLabel: string
  hasAudio: boolean
  quality: QualitySample | undefined
  qualityTick: number
  fullscreen: boolean
  pipSupported: boolean
  pipActive: boolean
  volume: number
  muted: boolean
  onBack: () => void
  onVolume: (volume: number) => void
  onToggleMute: () => void
  onToggleFullscreen: () => void
  onTogglePip: () => void
}

export function PlayerControls({
  visible,
  title,
  presetLabel,
  hasAudio,
  quality,
  qualityTick,
  fullscreen,
  pipSupported,
  pipActive,
  volume,
  muted,
  onBack,
  onVolume,
  onToggleMute,
  onToggleFullscreen,
  onTogglePip
}: PlayerControlsProps): JSX.Element {
  return (
    <div
      className={visible ? 'z-controls' : 'z-controls z-controls--hidden'}
      data-testid="player-controls"
      data-visible={visible}
    >
      <button className="z-controls__btn" onClick={onBack} data-testid="player-back">
        <ArrowLeftIcon size={16} /> Voltar
      </button>
      <span className="z-controls__title">{title}</span>

      <span className="z-controls__spacer" />

      {hasAudio ? (
        <VolumeControl
          volume={volume}
          muted={muted}
          onVolume={onVolume}
          onToggleMute={onToggleMute}
        />
      ) : (
        <span className="z-controls__tag">sem audio</span>
      )}

      <span className="z-controls__tag" data-testid="player-preset">
        {presetLabel}
      </span>
      <ConnectionBars sample={quality} tick={qualityTick} />

      {pipSupported ? (
        <button
          className="z-controls__btn"
          onClick={onTogglePip}
          title={pipActive ? 'Fechar a janela flutuante' : 'Abrir em janela flutuante'}
          aria-label={pipActive ? 'Fechar a janela flutuante' : 'Abrir em janela flutuante'}
          data-testid="player-pip"
        >
          <PipIcon size={16} />
        </button>
      ) : null}

      <button
        className="z-controls__btn"
        onClick={onToggleFullscreen}
        title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        data-testid="player-fullscreen"
      >
        {fullscreen ? <FullscreenExitIcon size={16} /> : <FullscreenIcon size={16} />}
      </button>
    </div>
  )
}
