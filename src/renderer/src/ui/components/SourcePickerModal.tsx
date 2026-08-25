// Seletor de fonte (RF-15/RF-16): abas Monitores/Janelas com previews reais,
// audio do sistema ligado por padrao (RNF-10) e preset de qualidade (RF-24).
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { CaptureSource } from '@shared/ipc'
import { DEFAULT_PRESET_ID, PRESET_LIST } from '@shared/presets'
import type { PresetId } from '@shared/protocol'
import { Button } from './Button'
import { Modal } from './Modal'
import { AlertIcon, MonitorIcon, WindowIcon } from './icons'

export interface SourceChoice {
  sourceId: string
  sourceLabel: string
  sourceKind: 'screen' | 'window'
  presetId: PresetId
  withAudio: boolean
}

export interface SourcePickerModalProps {
  open: boolean
  /** "switch" muda o texto do botao para troca de fonte (RF-19). */
  mode: 'start' | 'switch'
  busy: boolean
  onClose: () => void
  onConfirm: (choice: SourceChoice) => void
}

function PickerBody({
  mode,
  busy,
  onClose,
  onConfirm
}: Omit<SourcePickerModalProps, 'open'>): JSX.Element {
  const [tab, setTab] = useState<'screen' | 'window'>('screen')
  const [sources, setSources] = useState<CaptureSource[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [withAudio, setWithAudio] = useState(true)
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PRESET_ID)

  const load = useCallback(async (): Promise<void> => {
    try {
      const list = await window.zoi.capture.listSources({ thumbnailWidth: 320 })
      setSources(list)
      setError(null)
    } catch {
      setSources([])
      setError('Nao foi possivel listar as telas e janelas abertas.')
    }
  }, [])

  useEffect(() => {
    // Fora do commit sincrono do efeito: a lista chega por IPC, nao por render.
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  const visible = (sources ?? []).filter((source) => source.kind === tab)
  const selected = (sources ?? []).find((source) => source.id === selectedId) ?? null

  return (
    <Modal
      open
      wide
      title={mode === 'switch' ? 'Trocar a fonte' : 'O que voce quer transmitir?'}
      subtitle="Escolha um monitor ou uma janela e ajuste a qualidade."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!selected}
            loading={busy}
            data-testid="picker-confirm"
            onClick={() => {
              if (!selected) return
              onConfirm({
                sourceId: selected.id,
                sourceLabel: selected.name,
                sourceKind: selected.kind,
                presetId,
                withAudio
              })
            }}
          >
            {mode === 'switch' ? 'Trocar fonte' : 'Transmitir'}
          </Button>
        </>
      }
    >
      <div className="z-picker__tabs">
        <div className="z-seg" role="tablist" aria-label="Tipo de fonte">
          <button
            role="tab"
            aria-selected={tab === 'screen'}
            className={tab === 'screen' ? 'z-seg__item z-seg__item--on' : 'z-seg__item'}
            onClick={() => setTab('screen')}
          >
            Monitores
          </button>
          <button
            role="tab"
            aria-selected={tab === 'window'}
            className={tab === 'window' ? 'z-seg__item z-seg__item--on' : 'z-seg__item'}
            onClick={() => setTab('window')}
          >
            Janelas
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <Button size="sm" onClick={() => void load()}>
          Atualizar lista
        </Button>
      </div>

      {sources === null ? (
        <div className="z-empty">
          <span className="z-spinner" />
          <span className="z-empty__text">carregando as fontes disponiveis...</span>
        </div>
      ) : error ? (
        <div className="z-empty">
          <span className="z-empty__title">{error}</span>
          <span className="z-empty__text">Tente atualizar a lista.</span>
        </div>
      ) : visible.length === 0 ? (
        <div className="z-empty">
          <span className="z-empty__title">
            {tab === 'screen' ? 'Nenhum monitor encontrado' : 'Nenhuma janela aberta'}
          </span>
          <span className="z-empty__text">
            Abra a janela que quer mostrar e clique em atualizar a lista.
          </span>
        </div>
      ) : (
        <div className="z-picker__grid">
          {visible.map((source, index) => (
            <button
              key={source.id}
              className={
                source.id === selectedId ? 'z-source z-source--on z-item-enter' : 'z-source z-item-enter'
              }
              style={{ '--z-delay': `${Math.min(index, 8) * 30}ms` } as CSSProperties}
              onClick={() => setSelectedId(source.id)}
              data-testid="capture-source"
            >
              <img className="z-source__thumb" src={source.thumbnailDataUrl} alt="" />
              <span className="z-source__name" title={source.name}>
                {source.kind === 'screen' ? <MonitorIcon size={12} /> : <WindowIcon size={12} />}{' '}
                {source.name}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="z-picker__options">
        <button
          className={withAudio ? 'z-switch z-switch--on' : 'z-switch'}
          role="switch"
          aria-checked={withAudio}
          onClick={() => setWithAudio((value) => !value)}
          data-testid="audio-toggle"
        >
          <span className="z-switch__track">
            <span className="z-switch__thumb" />
          </span>
          <span className="z-switch__label">
            <span>Transmitir o audio do sistema</span>
            <span className="z-switch__hint">
              O audio capturado e o do computador inteiro, nao so o da janela escolhida.
            </span>
          </span>
        </button>

        <div className="z-row-between">
          <span className="z-field__label">Qualidade</span>
          <div className="z-seg">
            {PRESET_LIST.map((preset) => (
              <button
                key={preset.id}
                className={preset.id === presetId ? 'z-seg__item z-seg__item--on' : 'z-seg__item'}
                onClick={() => setPresetId(preset.id)}
                data-testid={`preset-${preset.id}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="z-note">
          <span className="z-note__icon">
            <AlertIcon size={14} />
          </span>
          <span>
            Quanto maior a qualidade, mais upload sua conexao precisa: com a sala cheia, prefira
            720p30.
          </span>
        </div>
      </div>
    </Modal>
  )
}

export function SourcePickerModal({
  open,
  ...rest
}: SourcePickerModalProps): JSX.Element | null {
  // Montar so quando aberto garante lista de fontes sempre fresca.
  if (!open) return null
  return <PickerBody {...rest} />
}
