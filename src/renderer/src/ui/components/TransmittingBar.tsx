// Indicador "VOCE ESTA TRANSMITINDO" do UISPEC (secao 3): barra fina fixa no
// topo da janela, fundo danger, com parar e trocar fonte. NUNCA some sozinha.
import { memo } from 'react'
import { StopIcon, SwapIcon } from './icons'

export interface TransmittingBarProps {
  sourceLabel: string
  presetLabel: string
  hasAudio: boolean
  /** Modo nitidez ligado: prioriza detalhe da imagem no lugar da fluidez. */
  sharpness: boolean
  onSharpnessChange: (next: boolean) => void
  /** Ponteiros dos espectadores desenhados sobre a tela real (RF-02). */
  pointers: boolean
  /** Fonte de JANELA nao tem monitor para cobrir: o controle fica esmaecido. */
  pointersDisabled: boolean
  onPointersChange: (next: boolean) => void
  onSwitch: () => void
  onStop: () => void
}

export const TransmittingBar = memo(function TransmittingBar({
  sourceLabel,
  presetLabel,
  hasAudio,
  sharpness,
  onSharpnessChange,
  pointers,
  pointersDisabled,
  onPointersChange,
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
      <button
        className={sharpness ? 'z-switch z-switch--bar z-switch--on' : 'z-switch z-switch--bar'}
        role="switch"
        aria-checked={sharpness}
        title="Ligado, prioriza a nitidez do texto e perde quadros quando a rede aperta. Desligado, prioriza o movimento fluido."
        onClick={() => onSharpnessChange(!sharpness)}
        data-testid="sharpness-toggle"
      >
        <span className="z-switch__track">
          <span className="z-switch__thumb" />
        </span>
        <span className="z-switch__label">
          <span>Nitidez</span>
        </span>
      </button>
      <button
        className={pointers ? 'z-switch z-switch--bar z-switch--on' : 'z-switch z-switch--bar'}
        role="switch"
        aria-checked={pointers}
        disabled={pointersDisabled}
        title="Ligado, voce ve na sua tela real onde cada pessoa que assiste esta apontando."
        onClick={() => onPointersChange(!pointers)}
        data-testid="pointer-toggle-bar"
      >
        <span className="z-switch__track">
          <span className="z-switch__thumb" />
        </span>
        <span className="z-switch__label">
          <span>Ponteiros</span>
        </span>
      </button>
      <button className="z-transmitting-bar__btn" onClick={onSwitch}>
        <SwapIcon size={13} /> Trocar fonte
      </button>
      <button className="z-transmitting-bar__btn" onClick={onStop} data-testid="stop-transmission">
        <StopIcon size={12} /> Parar
      </button>
    </div>
  )
})
