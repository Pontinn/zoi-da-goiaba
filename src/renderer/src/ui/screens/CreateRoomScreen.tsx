// Tela 3 do UISPEC: criar sala (codigo aleatorio ou personalizado, limite 2 a 8
// com padrao 6, copiar codigo e aviso de banda do RNF-06).
import { useState } from 'react'
import { ROOM_CODE_MAX_LENGTH, ROOM_DEFAULT_LIMIT, ROOM_MAX_LIMIT, ROOM_MIN_LIMIT } from '@shared/config'
import { generateRoomCode, normalize, validateRoomCode } from '../../core/room-code'
import { RoomCodeUnavailableError } from '../../services/peer-manager'
import { session } from '../../services/session'
import { useAppStore } from '../../store/app-store'
import { Button, IconButton } from '../components/Button'
import { TextInput } from '../components/TextInput'
import { AlertIcon, ArrowLeftIcon, CheckIcon, CopyIcon, DiceIcon } from '../components/icons'
import { copyText } from '../clipboard'
import { ROOM_CODE_MESSAGES } from '../validation'

type CodeMode = 'random' | 'custom'

export function CreateRoomScreen(): JSX.Element {
  const setRoute = useAppStore((state) => state.setRoute)
  const pushToast = useAppStore((state) => state.pushToast)

  const [mode, setMode] = useState<CodeMode>('random')
  const [code, setCode] = useState(() => generateRoomCode())
  const [limit, setLimit] = useState(ROOM_DEFAULT_LIMIT)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [creating, setCreating] = useState(false)

  const changeMode = (next: CodeMode): void => {
    setMode(next)
    setError(null)
    setCopied(false)
    setCode(next === 'random' ? generateRoomCode() : '')
  }

  const copy = async (): Promise<void> => {
    if (!code) return
    const ok = await copyText(code)
    if (!ok) {
      pushToast('warning', 'Nao consegui copiar; selecione o codigo e use Ctrl+C.')
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1_600)
  }

  const create = async (): Promise<void> => {
    if (creating) return
    const validation = validateRoomCode(code)
    if (!validation.ok) {
      setError(ROOM_CODE_MESSAGES[validation.error])
      return
    }
    setCreating(true)
    setError(null)
    try {
      await session.createRoom({ code: validation.code, limit })
      setRoute('room')
    } catch (error) {
      if (error instanceof RoomCodeUnavailableError) {
        setError(error.message)
      } else {
        setError(
          error instanceof Error && error.message
            ? `Nao foi possivel criar a sala: ${error.message}`
            : 'Nao foi possivel criar a sala. Verifique sua conexao e tente de novo.'
        )
      }
      setCreating(false)
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
            <h2 className="z-panel__title">Criar sala</h2>
            <p className="z-panel__lead">
              Compartilhe o codigo com a galera: quem tiver o codigo entra na sala.
            </p>
          </div>

          <div className="z-panel__card">
            <div className="z-row-between">
              <span className="z-field__label">Codigo da sala</span>
              <div className="z-seg" role="tablist" aria-label="Tipo de codigo">
                <button
                  role="tab"
                  aria-selected={mode === 'random'}
                  className={mode === 'random' ? 'z-seg__item z-seg__item--on' : 'z-seg__item'}
                  onClick={() => changeMode('random')}
                >
                  Aleatorio
                </button>
                <button
                  role="tab"
                  aria-selected={mode === 'custom'}
                  className={mode === 'custom' ? 'z-seg__item z-seg__item--on' : 'z-seg__item'}
                  onClick={() => changeMode('custom')}
                >
                  Personalizado
                </button>
              </div>
            </div>

            <div className="z-code-row">
              <TextInput
                value={code}
                mono
                readOnly={mode === 'random'}
                autoFocus={mode === 'custom'}
                maxLength={ROOM_CODE_MAX_LENGTH}
                placeholder="ex: sala-do-filme"
                aria-label="Codigo da sala"
                data-testid="room-code-input"
                onChange={(event) => {
                  // Normalizacao visivel: minusculas e sem espacos (AC-29).
                  setCode(normalize(event.target.value).replace(/\s+/g, ''))
                  if (error) setError(null)
                }}
                error={error}
                hint={mode === 'custom' ? '3 a 32 caracteres: letras, numeros e hifen.' : undefined}
              />
              <div className="z-code-row__buttons">
                {mode === 'random' ? (
                  <IconButton
                    label="Gerar outro codigo"
                    onClick={() => {
                      setCode(generateRoomCode())
                      setCopied(false)
                    }}
                  >
                    <DiceIcon size={18} />
                  </IconButton>
                ) : null}
                <IconButton label="Copiar codigo" onClick={() => void copy()}>
                  {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
                </IconButton>
              </div>
            </div>
            {copied ? (
              <span className="z-badge z-badge--success z-inline-badge">codigo copiado</span>
            ) : null}

            <div className="z-row-between">
              <div>
                <div className="z-field__label">Limite de pessoas</div>
                <div className="z-field__hint">Entre {ROOM_MIN_LIMIT} e {ROOM_MAX_LIMIT}, contando voce.</div>
              </div>
              <div className="z-stepper">
                <IconButton
                  label="Diminuir limite"
                  disabled={limit <= ROOM_MIN_LIMIT}
                  onClick={() => setLimit((value) => Math.max(ROOM_MIN_LIMIT, value - 1))}
                >
                  <span aria-hidden="true">-</span>
                </IconButton>
                <span className="z-stepper__value" data-testid="room-limit">
                  {limit}
                </span>
                <IconButton
                  label="Aumentar limite"
                  disabled={limit >= ROOM_MAX_LIMIT}
                  onClick={() => setLimit((value) => Math.min(ROOM_MAX_LIMIT, value + 1))}
                >
                  <span aria-hidden="true">+</span>
                </IconButton>
              </div>
            </div>

            <div className="z-note">
              <span className="z-note__icon">
                <AlertIcon size={14} />
              </span>
              <span>
                Como a transmissao e direta entre as pessoas, salas maiores pedem mais upload de
                quem transmite. Com muita gente, prefira o preset de qualidade menor.
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            block
            loading={creating}
            onClick={() => void create()}
            data-testid="create-room-submit"
          >
            Criar sala
          </Button>
        </div>
      </div>
    </div>
  )
}
