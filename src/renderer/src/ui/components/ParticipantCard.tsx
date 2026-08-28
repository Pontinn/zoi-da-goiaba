// Card de participante do UISPEC (secao 3): avatar com inicial, coroa de dono,
// olho de "assistindo", ponto danger de "transmitindo" e acoes de moderacao
// (apenas para o dono, nunca no proprio card, RF-34/AC-19).
import { memo, useEffect, useRef, useState } from 'react'
import type { PersonColor } from '@shared/person-colors'
import type { PeerLinkStatus, QualitySample } from '../../core/room-state'
import { ConnectionBars } from './ConnectionBars'
import { IconButton } from './Button'
import { BanIcon, CrownIcon, DotsIcon, EyeIcon, UserMinusIcon } from './icons'

export interface ParticipantCardProps {
  peerId: string
  nickname: string
  isSelf: boolean
  isOwner: boolean
  /** Cor desta pessoa (RF-21/RF-22): a MESMA do cursor dela sobre o video. */
  color: PersonColor
  /** O usuario local e o dono da sala (habilita moderacao). */
  canModerate: boolean
  transmitting: boolean
  /** Nickname de quem esta sendo assistido por este participante, se houver. */
  watchingLabel: string | null
  quality: QualitySample | undefined
  qualityTick: number
  linkStatus: PeerLinkStatus | undefined
  onKick: (peerId: string) => void
  onBan: (peerId: string) => void
}

export const ParticipantCard = memo(function ParticipantCard({
  peerId,
  nickname,
  isSelf,
  isOwner,
  color,
  canModerate,
  transmitting,
  watchingLabel,
  quality,
  qualityTick,
  linkStatus,
  onKick,
  onBan
}: ParticipantCardProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onDocument = (event: MouseEvent): void => {
      if (!cardRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocument)
    return () => document.removeEventListener('mousedown', onDocument)
  }, [menuOpen])

  const unreachable = linkStatus === 'unreachable' || linkStatus === 'timeout'
  const reconnecting = linkStatus === 'reconnecting'
  const classes = [
    'z-participant',
    isSelf ? 'z-participant--self' : '',
    unreachable ? 'z-participant--unreachable' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} ref={cardRef} data-testid="participant" data-peer-id={peerId}>
      <span
        className="z-participant__avatar"
        aria-hidden="true"
        style={{ background: color.soft, color: color.fill }}
      >
        {nickname.trim().charAt(0) || '?'}
      </span>

      <span className="z-participant__info">
        <span className="z-participant__name">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{nickname}</span>
          {isSelf ? <span className="z-muted">(voce)</span> : null}
          {isOwner ? (
            <span className="z-participant__crown" title="dono da sala">
              <CrownIcon size={13} />
            </span>
          ) : null}
        </span>
        <span className="z-participant__badges">
          {isSelf ? null : <ConnectionBars sample={quality} tick={qualityTick} />}
          {transmitting ? (
            <span className="z-badge z-badge--danger" title="transmitindo agora">
              <span className="z-live-dot" /> ao vivo
            </span>
          ) : null}
          {watchingLabel ? (
            <span className="z-participant__watching" title={`assistindo ${watchingLabel}`}>
              <EyeIcon size={12} /> {watchingLabel}
            </span>
          ) : null}
          {reconnecting ? <span className="z-badge z-badge--neutral">reconectando</span> : null}
          {unreachable ? <span className="z-badge z-badge--neutral">sem conexao</span> : null}
        </span>
      </span>

      {canModerate && !isSelf ? (
        <IconButton label={`Acoes para ${nickname}`} onClick={() => setMenuOpen((open) => !open)}>
          <DotsIcon size={16} />
        </IconButton>
      ) : null}

      {menuOpen ? (
        <div className="z-participant__menu" role="menu">
          <button
            className="z-menu-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              onKick(peerId)
            }}
          >
            <UserMinusIcon size={15} /> Desconectar da sala
          </button>
          <button
            className="z-menu-item z-menu-item--danger"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              onBan(peerId)
            }}
          >
            <BanIcon size={15} /> Banir desta sala
          </button>
        </div>
      ) : null}
    </div>
  )
})
