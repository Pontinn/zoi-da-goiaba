// Tela 4 do UISPEC (Sala). Nesta etapa: identidade da sala, roster ao vivo e
// saida. A grade de transmissoes e a moderacao entram no proximo sprint.
import { useState } from 'react'
import { session } from '../../services/session'
import { useAppStore } from '../../store/app-store'
import { useRoomStore } from '../../store/room-store'
import { Button, IconButton } from '../components/Button'
import { CheckIcon, CopyIcon, CrownIcon, LogoutIcon } from '../components/icons'
import { copyText } from '../clipboard'

export function RoomScreen(): JSX.Element {
  const room = useRoomStore((state) => state.room)
  const setRoute = useAppStore((state) => state.setRoute)
  const pushToast = useAppStore((state) => state.pushToast)
  const [copied, setCopied] = useState(false)

  const code = room.roomMeta?.code ?? ''

  const copy = async (): Promise<void> => {
    const ok = await copyText(code)
    if (!ok) {
      pushToast('warning', 'Nao consegui copiar; selecione o codigo e use Ctrl+C.')
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1_600)
  }

  const leave = (): void => {
    session.leaveRoom()
    setRoute('home')
    // Da tempo do LEAVE sair pelo mesh antes de destruir os peers.
    setTimeout(() => session.reset(), 800)
  }

  return (
    <div className="z-shell">
      <div className="z-shell__topbar">
        <div className="z-back">
          <span className="z-secondary">Sala</span>
          <span className="z-badge z-tabular" data-testid="room-code">
            {code}
          </span>
          <IconButton label="Copiar codigo da sala" onClick={() => void copy()}>
            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
          </IconButton>
        </div>
        <Button variant="danger" size="sm" icon={<LogoutIcon />} onClick={leave}>
          Sair da sala
        </Button>
      </div>

      <div className="z-shell__center">
        <div className="z-panel">
          <div className="z-panel__head">
            <h2 className="z-panel__title">
              Participantes ({room.members.length}/{room.roomMeta?.limit ?? 0})
            </h2>
          </div>
          <div className="z-panel__card">
            {room.members.map((member) => (
              <div key={member.peerId} className="z-row-between" data-testid="participant">
                <span>
                  {member.nickname}
                  {member.peerId === room.selfPeerId ? ' (voce)' : ''}
                </span>
                {member.isOwner ? (
                  <span className="z-badge">
                    <CrownIcon size={12} /> dono
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
