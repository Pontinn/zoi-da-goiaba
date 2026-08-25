// Volume e mudo LOCAIS (RF-28/AC-15): aplicados no elemento de video, nunca na
// stream, entao nao afetam os outros espectadores nem quem transmite.
import { VolumeIcon, VolumeMuteIcon } from './icons'

export interface VolumeControlProps {
  volume: number
  muted: boolean
  onVolume: (volume: number) => void
  onToggleMute: () => void
}

export function VolumeControl({
  volume,
  muted,
  onVolume,
  onToggleMute
}: VolumeControlProps): JSX.Element {
  return (
    <span className="z-volume">
      <button
        className="z-controls__btn"
        onClick={onToggleMute}
        title={muted ? 'Ativar som' : 'Silenciar'}
        aria-label={muted ? 'Ativar som' : 'Silenciar'}
        data-testid="player-mute"
      >
        {muted ? <VolumeMuteIcon size={16} /> : <VolumeIcon size={16} />}
      </button>
      <input
        className="z-volume__slider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        aria-label="Volume"
        data-testid="player-volume"
        onChange={(event) => onVolume(Number(event.target.value))}
      />
    </span>
  )
}
