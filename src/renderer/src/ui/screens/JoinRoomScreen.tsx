// Entrada por codigo: mesma validacao do criar sala + mensagens de recusa
// (sala cheia, banido, sala nao encontrada, versao incompativel).
import { useState } from 'react'
import { ROOM_CODE_MAX_LENGTH } from '@shared/config'
import { normalize, validateRoomCode } from '../../core/room-code'
import { JoinRejectedError, JoinTimeoutError, RoomNotFoundError, session } from '../../services/session'
import { useAppStore } from '../../store/app-store'
import { Button, IconButton } from '../components/Button'
import { TextInput } from '../components/TextInput'
import { ArrowLeftIcon } from '../components/icons'
import { ROOM_CODE_MESSAGES } from '../validation'

export function JoinRoomScreen(): JSX.Element {
  const setRoute = useAppStore((state) => state.setRoute)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const join = async (): Promise<void> => {
    if (joining) return
    const validation = validateRoomCode(code)
    if (!validation.ok) {
      setError(ROOM_CODE_MESSAGES[validation.error])
      return
    }
    setJoining(true)
    setError(null)
    try {
      await session.joinRoom(validation.code)
      setRoute('room')
    } catch (error) {
      if (
        error instanceof JoinRejectedError ||
        error instanceof RoomNotFoundError ||
        error instanceof JoinTimeoutError
      ) {
        setError(error.message)
      } else {
        setError(
          error instanceof Error && error.message
            ? `Nao foi possivel entrar na sala: ${error.message}`
            : 'Nao foi possivel entrar na sala. Verifique sua conexao e tente de novo.'
        )
      }
      setJoining(false)
    }
  }

  return (
    <div className="z-shell">
      <div className="z-shell__topbar">
        <div className="z-back">
          <IconButton label="Voltar" onClick={() => setRoute('home')}>
            <ArrowLeftIcon />
          </IconButton>
          <span className="z-secondary">Voltar</span>
        </div>
      </div>

      <div className="z-shell__center z-screen-enter">
        <div className="z-panel">
          <div className="z-panel__head">
            <h2 className="z-panel__title">Entrar com codigo</h2>
            <p className="z-panel__lead">Peca o codigo para quem criou a sala.</p>
          </div>

          <div className="z-panel__card">
            <TextInput
              label="Codigo da sala"
              value={code}
              mono
              autoFocus
              maxLength={ROOM_CODE_MAX_LENGTH}
              placeholder="ex: goiaba-4f2k"
              data-testid="join-code-input"
              onChange={(event) => {
                setCode(normalize(event.target.value).replace(/\s+/g, ''))
                if (error) setError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void join()
              }}
              error={error}
              hint="Maiusculas e minusculas dao no mesmo."
            />
          </div>

          <Button
            variant="primary"
            size="lg"
            block
            loading={joining}
            onClick={() => void join()}
            data-testid="join-room-submit"
          >
            {joining ? 'Entrando...' : 'Entrar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
