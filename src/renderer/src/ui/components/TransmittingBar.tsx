// Indicador "VOCE ESTA TRANSMITINDO" do UISPEC (secao 3): barra fina fixa no
// topo da janela, fundo danger, com parar e trocar fonte. NUNCA some sozinha.
import { memo } from 'react'
import { StopIcon, SwapIcon } from './icons'

export interface TransmittingBarProps {
  sourceLabel: string
  presetLabel: string
  hasAudio: boolean
  onSwitch: () => void
  onStop: () => void
}

export const TransmittingBar = memo(function TransmittingBar({
  sourceLabel,
  presetLabel,
  hasAudio,
  onSwitch,
  onStop
}: TransmittingBarProps): JSX.Element {
  return (
    <div className="z-transmitting-bar z-fade-enter" role="status" data-testid="transmitting-bar">
      <span className="z-transmitting-bar__label">
        <span className="z-live-dot" style={{ background: '#ffffff' }} />
        Voce esta transmitindo
      </span>
      <span className="z-transmitting-bar__source">
        {sourceLabel} · {presetLabel} · {hasAudio ? 'com audio' : 'sem audio'}
      </span>
      <span className="z-transmitting-bar__spacer" />
      <button className="z-transmitting-bar__btn" onClick={onSwitch}>
        <SwapIcon size={13} /> Trocar fonte
      </button>
      <button className="z-transmitting-bar__btn" onClick={onStop} data-testid="stop-transmission">
        <StopIcon size={12} /> Parar
      </button>
    </div>
  )
})
