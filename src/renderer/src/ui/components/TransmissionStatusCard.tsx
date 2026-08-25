// Card de status da propria transmissao: ocupa o lugar do proprio tile (grid ou
// strip) porque o transmissor nunca assiste a si mesmo (RF-09/RF-10). Sem
// <video> e sem stream: o custo por frame e zero.
//
// Motion (UISPEC secao 6): entrada UNICA por transmissao (o mount e keyed por
// txId no RoomScreen), so transform/opacity, nenhum loop continuo perto do
// video. A logo entra com bounce (unica excecao de easing do app), o titulo com
// fade/slide e os detalhes com o stagger padrao `.z-item-enter` + `--z-delay`.
import { memo, type CSSProperties } from 'react'
import logoGoiaba from '../../assets/brand/logo-goiaba.png'
import { EyeIcon, VolumeIcon, VolumeMuteIcon } from './icons'

export interface TransmissionStatusCardProps {
  txId: string
  sourceLabel: string
  hasAudio: boolean
  viewerCount: number
  variant: 'tile' | 'strip'
}

/** Atraso do stagger dos detalhes: 220ms + i * 60ms (UISPEC secao 6.2, fase 3). */
function delayOf(index: number): CSSProperties {
  return { '--z-delay': `${220 + index * 60}ms` } as CSSProperties
}

function viewersLabel(count: number): string {
  return count === 1 ? '1 espectador' : `${count} espectadores`
}

/**
 * Contagem de espectadores. O `key` no valor forca a remontagem do span a cada
 * troca, e so ele reanima (RF-19): o card inteiro fica parado.
 */
function ViewerCount({ count }: { count: number }): JSX.Element {
  return (
    <span className="z-status-card__count">
      <span
        className="z-status-card__count-value"
        key={count}
        data-testid="tx-status-viewers"
      >
        {viewersLabel(count)}
      </span>
    </span>
  )
}

export const TransmissionStatusCard = memo(function TransmissionStatusCard({
  txId,
  sourceLabel,
  hasAudio,
  viewerCount,
  variant
}: TransmissionStatusCardProps): JSX.Element {
  if (variant === 'strip') {
    return (
      <div
        className="z-status-card z-status-card--strip"
        role="status"
        data-testid="tx-status-card"
        data-tx-id={txId}
      >
        <img className="z-status-card__logo" src={logoGoiaba} alt="" aria-hidden="true" />
        <span className="z-status-card__strip-text">
          <span className="z-status-card__title">sua transmissao</span>
          <ViewerCount count={viewerCount} />
        </span>
      </div>
    )
  }

  return (
    <div
      className="z-status-card z-status-card--tile"
      role="status"
      data-testid="tx-status-card"
      data-tx-id={txId}
    >
      <img className="z-status-card__logo" src={logoGoiaba} alt="" aria-hidden="true" />
      <span className="z-status-card__title">Transmissao iniciada</span>
      <span className="z-status-card__details">
        <span className="z-status-card__detail z-item-enter" style={delayOf(0)} title={sourceLabel}>
          {sourceLabel}
        </span>
        <span className="z-status-card__detail z-item-enter" style={delayOf(1)}>
          {hasAudio ? <VolumeIcon size={11} /> : <VolumeMuteIcon size={11} />}
          {hasAudio ? 'com audio' : 'sem audio'}
        </span>
        <span className="z-status-card__detail z-item-enter" style={delayOf(2)}>
          <EyeIcon size={11} />
          <ViewerCount count={viewerCount} />
        </span>
      </span>
      <span className="z-status-card__hint z-item-enter" style={delayOf(3)}>
        Voce nao assiste a propria transmissao; isso evita o retorno de audio.
      </span>
    </div>
  )
})
