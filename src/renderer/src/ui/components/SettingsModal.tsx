// Configuracoes: apelido com round-trip (campo pre-preenchido, RF-13/AC-08),
// volume dos sons do app, versao do app com "verificar atualizacoes" (F4) e o
// escape de modo compatibilidade (transmite e recebe sempre no codec antigo).
import { useRef, useState } from 'react'
import { NICKNAME_MAX_LENGTH } from '@shared/ipc'
import { isForceVp8, setForceVp8 } from '../../services/codec-capabilities'
import { session } from '../../services/session'
import { getSoundVolume, playSound, setSoundVolume } from '../../services/sound-player'
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
  // O modal so monta aberto: o slider ja nasce no volume que esta valendo.
  const [soundVolume, setSoundVolumeDraft] = useState(() => getSoundVolume())
  // So salva e da o feedback sonoro quando o usuario mexeu de fato no slider.
  const volumeDirty = useRef(false)
  // O boot ja alimentou o modulo com o valor persistido: aqui so se le.
  const [forceVp8, setForceVp8Draft] = useState(() => isForceVp8())

  /**
   * Commit IMEDIATO, como o volume: nao depende do botao Salvar (que continua
   * sendo so do apelido). O modulo em runtime muda ANTES da gravacao, porque o
   * efeito no caminho de midia e imediato; se o IPC falhar, tudo volta.
   */
  const toggleForceVp8 = (next: boolean): void => {
    setForceVp8Draft(next)
    setForceVp8(next)
    void window.zoi.settings.set({ forceVp8: next }).catch(() => {
      setForceVp8Draft(!next)
      setForceVp8(!next)
      pushToast('warning', 'Nao foi possivel salvar o modo compatibilidade.')
    })
  }

  const dragSoundVolume = (value: number): void => {
    volumeDirty.current = true
    setSoundVolumeDraft(value)
    // Aplica na hora: o proximo som ja sai no nivel novo.
    setSoundVolume(value)
  }

  // Ao SOLTAR o slider: som curto como amostra do nivel e gravacao do valor.
  const commitSoundVolume = (): void => {
    if (!volumeDirty.current) return
    volumeDirty.current = false
    playSound('entered')
    void window.zoi.settings.set({ soundVolume }).catch(() => {
      pushToast('warning', 'Nao foi possivel salvar o volume dos sons.')
    })
  }

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
      subtitle="Seu apelido, os sons e a compatibilidade de video."
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
            Volume dos sons do app
          </div>
          <div className="z-secondary" style={{ fontSize: 'var(--text-meta)' }}>
            Avisos de entrar, sair e transmitir. No zero fica mudo.
          </div>
        </div>
        <span className="z-volume">
          <input
            className="z-volume__slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={soundVolume}
            aria-label="Volume dos sons do app"
            data-testid="settings-sound-volume"
            onChange={(event) => dragSoundVolume(Number(event.target.value))}
            onPointerUp={commitSoundVolume}
            onKeyUp={commitSoundVolume}
            onBlur={commitSoundVolume}
          />
          <span
            className="z-secondary z-tabular"
            style={{ fontSize: 'var(--text-meta)', minWidth: '2.5rem', textAlign: 'right' }}
          >
            {`${Math.round(soundVolume * 100)}%`}
          </span>
        </span>
      </div>

      <div className="z-row-between" style={{ marginTop: 'var(--space-3)' }}>
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

      <div className="z-row-between" style={{ marginTop: 'var(--space-3)' }}>
        <div>
          <div className="z-secondary" style={{ fontSize: 'var(--text-secondary-size)' }}>
            Modo compatibilidade
          </div>
          <div className="z-secondary" style={{ fontSize: 'var(--text-meta)' }}>
            Transmite e recebe sempre no codec antigo. Ligue so se o video travar ou aparecer preto.
          </div>
        </div>
        <button
          className={
            forceVp8 ? 'z-switch z-switch--inline z-switch--on' : 'z-switch z-switch--inline'
          }
          role="switch"
          aria-checked={forceVp8}
          aria-label="Modo compatibilidade"
          onClick={() => toggleForceVp8(!forceVp8)}
          data-testid="settings-force-vp8"
        >
          <span className="z-switch__track">
            <span className="z-switch__thumb" />
          </span>
        </button>
      </div>
    </Modal>
  )
}

export function SettingsModal({ open, onClose }: SettingsModalProps): JSX.Element | null {
  if (!open) return null
  return <SettingsForm onClose={onClose} />
}
