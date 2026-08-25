// Configuracoes: apelido com round-trip (campo pre-preenchido, RF-13/AC-08) e
// versao do app com "verificar atualizacoes" (F4).
import { useState } from 'react'
import { NICKNAME_MAX_LENGTH } from '@shared/ipc'
import { session } from '../../services/session'
import { useAppStore } from '../../store/app-store'
import { Button } from './Button'
import { Modal } from './Modal'
import { TextInput } from './TextInput'
import { messageFromError, validateNickname } from '../validation'

export interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

/**
 * O conteudo so monta com o modal aberto, entao o campo nasce sempre
 * pre-preenchido com o apelido salvo (round-trip do RF-13, sem efeito de sync).
 */
function SettingsForm({ onClose }: { onClose: () => void }): JSX.Element {
  const nickname = useAppStore((state) => state.nickname)
  const version = useAppStore((state) => state.version)
  const setNickname = useAppStore((state) => state.setNickname)
  const pushToast = useAppStore((state) => state.pushToast)
  const updateStatus = useAppStore((state) => state.updateStatus)
  const requestUpdateCheck = useAppStore((state) => state.requestUpdateCheck)

  const [draft, setDraft] = useState(nickname)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [openingLogs, setOpeningLogs] = useState(false)

  const save = async (): Promise<void> => {
    const validation = validateNickname(draft)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    setSaving(true)
    try {
      const settings = await window.zoi.settings.set({ nickname: validation.nickname })
      const saved = settings.nickname ?? validation.nickname
      setNickname(saved)
      // Se estiver em sala, propaga o novo apelido (NICKNAME_UPDATE).
      session.updateNickname(saved)
      pushToast('success', 'Apelido atualizado.')
      onClose()
    } catch (error) {
      setError(messageFromError(error, 'Nao foi possivel salvar o apelido.'))
    } finally {
      setSaving(false)
    }
  }

  const checkUpdates = async (): Promise<void> => {
    setChecking(true)
    // Marca a checagem como MANUAL: o `UpdateNotice` responde com toast mesmo
    // quando nao ha novidade (a checagem automatica do boot fica silenciosa).
    requestUpdateCheck()
    // O aviso de "procurando" vem ANTES do await: a resposta do main costuma
    // chegar primeiro, e a pilha de toasts ficaria fora de ordem.
    pushToast('info', 'Procurando atualizacoes...')
    try {
      await window.zoi.update.check()
    } catch {
      pushToast('warning', 'Nao foi possivel verificar atualizacoes agora.')
    } finally {
      setChecking(false)
    }
  }

  const openLogs = async (): Promise<void> => {
    setOpeningLogs(true)
    try {
      await window.zoi.logs.openFolder()
    } catch {
      pushToast('warning', 'Nao foi possivel abrir a pasta de logs.')
    } finally {
      setOpeningLogs(false)
    }
  }

  return (
    <Modal
      open
      title="Configuracoes"
      subtitle="Seu apelido e a versao do app."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Salvar
          </Button>
        </>
      }
    >
      <TextInput
        label="Apelido"
        value={draft}
        autoFocus
        maxLength={NICKNAME_MAX_LENGTH}
        onChange={(event) => {
          setDraft(event.target.value)
          if (error) setError(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void save()
        }}
        error={error}
        counter={`${draft.trim().length}/${NICKNAME_MAX_LENGTH}`}
        hint="Aparece para todo mundo na sala."
      />

      <div className="z-row-between" style={{ marginTop: 'var(--space-4)' }}>
        <div>
          <div className="z-secondary" style={{ fontSize: 'var(--text-secondary-size)' }}>
            Versao do app
          </div>
          <div className="z-tabular" style={{ fontWeight: 500 }}>
            {version ? `v${version}` : 'carregando...'}
          </div>
          {updateStatus?.state === 'downloaded' ? (
            <div className="z-badge z-badge--success" style={{ marginTop: 'var(--space-2)' }}>
              atualizacao pronta
            </div>
          ) : null}
          {updateStatus?.state === 'available' ? (
            <div className="z-badge z-badge--neutral" style={{ marginTop: 'var(--space-2)' }}>
              nova versao disponivel
            </div>
          ) : null}
          {updateStatus?.state === 'downloading' ? (
            <div className="z-badge z-badge--neutral" style={{ marginTop: 'var(--space-2)' }}>
              {`baixando ${updateStatus.percent ?? 0}%`}
            </div>
          ) : null}
        </div>
        <Button size="sm" loading={checking} onClick={() => void checkUpdates()}>
          Verificar atualizacoes
        </Button>
      </div>

      <div className="z-row-between" style={{ marginTop: 'var(--space-3)' }}>
        <div>
          <div className="z-secondary" style={{ fontSize: 'var(--text-secondary-size)' }}>
            Diagnostico
          </div>
          <div className="z-secondary" style={{ fontSize: 'var(--text-meta)' }}>
            O app guarda um arquivo por dia com o que aconteceu na sala.
          </div>
        </div>
        <Button size="sm" loading={openingLogs} onClick={() => void openLogs()}>
          Abrir pasta de logs
        </Button>
      </div>
    </Modal>
  )
}

export function SettingsModal({ open, onClose }: SettingsModalProps): JSX.Element | null {
  if (!open) return null
  return <SettingsForm onClose={onClose} />
}
