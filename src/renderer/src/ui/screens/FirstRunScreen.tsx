// Tela 1 do UISPEC: primeira abertura (marca 28px + apelido + botao "Bora").
import { useState, type FormEvent } from 'react'
import { NICKNAME_MAX_LENGTH } from '@shared/ipc'
import { session } from '../../services/session'
import { useAppStore } from '../../store/app-store'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { TextInput } from '../components/TextInput'
import { messageFromError, validateNickname } from '../validation'

export function FirstRunScreen(): JSX.Element {
  const setIdentity = useAppStore((state) => state.setIdentity)
  const setRoute = useAppStore((state) => state.setRoute)
  const installId = useAppStore((state) => state.installId)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const validation = validateNickname(draft)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const settings = await window.zoi.settings.set({ nickname: validation.nickname })
      const nickname = settings.nickname ?? validation.nickname
      setIdentity({ nickname, installId: settings.installId || installId })
      session.setIdentity(nickname, settings.installId || installId)
      setRoute('home')
    } catch (error) {
      setError(messageFromError(error, 'Nao foi possivel salvar o apelido.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="z-shell">
      <div className="z-shell__center z-screen-enter">
        <div className="z-panel z-firstrun">
          <Brand size="lg" />
          <p className="z-firstrun__lead">
            Compartilhe sua tela com a galera, sem servidor no meio do caminho.
          </p>
          <form className="z-firstrun__form" onSubmit={(event) => void submit(event)}>
            <TextInput
              label="Como te chamam?"
              placeholder="Seu apelido"
              value={draft}
              autoFocus
              maxLength={NICKNAME_MAX_LENGTH}
              onChange={(event) => {
                setDraft(event.target.value)
                if (error) setError(null)
              }}
              error={error}
              counter={`${draft.trim().length}/${NICKNAME_MAX_LENGTH}`}
              hint="Esse nome aparece para todo mundo na sala."
            />
            <Button type="submit" variant="primary" size="lg" block loading={saving}>
              Bora
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
