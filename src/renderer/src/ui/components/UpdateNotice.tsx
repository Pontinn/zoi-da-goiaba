// F4: aviso de atualizacao (SPEC secao 5.B, canais `update:*`). Vive na pilha de
// avisos do canto inferior direito, junto dos toasts (UISPEC secao 3).
//
// Fluxo: "available" -> o usuario aceita -> `update:install` comeca o download
// (`autoDownload: false` no main) -> "downloading" com progresso -> "downloaded"
// -> "Reiniciar e atualizar" chama `update:install` de novo, agora quitAndInstall.
//
// Estados silenciosos: `checking`, `none` e `error` NAO aparecem sozinhos (risco
// R9 da SPEC: sem release publicada a checagem falha e nao pode virar ruido).
// Eles so viram toast quando a checagem partiu do botao das Configuracoes.
import { useEffect, useState } from 'react'
import type { UpdateState } from '@shared/ipc'
import { useAppStore } from '../../store/app-store'
import { Button, IconButton } from './Button'
import { CloseIcon, DownloadIcon } from './icons'

/** Estados que rendem um aviso visivel. */
const VISIBLE_STATES = ['available', 'downloading', 'downloaded'] as const

export function UpdateNotice(): JSX.Element | null {
  const status = useAppStore((state) => state.updateStatus)
  const dismissed = useAppStore((state) => state.updateDismissed)
  const checkResult = useAppStore((state) => state.updateCheckResult)
  const dismissUpdate = useAppStore((state) => state.dismissUpdate)
  const consumeUpdateCheckResult = useAppStore((state) => state.consumeUpdateCheckResult)
  const pushToast = useAppStore((state) => state.pushToast)

  // Guarda o estado em que a acao foi disparada: qualquer novidade vinda do
  // updater ja libera o botao, sem efeito de sincronizacao.
  const [startedAt, setStartedAt] = useState<UpdateState | null>(null)

  const state = status?.state ?? null
  const starting = startedAt !== null && startedAt === state

  // Retorno da checagem MANUAL: o usuario pediu, entao merece resposta mesmo
  // quando nao ha novidade (o botao "Verificar atualizacoes" do SettingsModal).
  // Havendo novidade, quem responde e o proprio aviso abaixo, sem toast extra.
  useEffect(() => {
    if (checkResult === null) return
    consumeUpdateCheckResult()
    if (checkResult === 'none') {
      pushToast('success', 'Voce ja esta na versao mais recente.')
    } else if (checkResult === 'error') {
      pushToast('warning', 'Nao foi possivel verificar atualizacoes agora.')
    }
  }, [checkResult, consumeUpdateCheckResult, pushToast])

  if (!status || dismissed) return null
  if (!(VISIBLE_STATES as readonly string[]).includes(status.state)) return null

  const version = status.version ? `v${status.version}` : null
  const downloaded = status.state === 'downloaded'
  const downloading = status.state === 'downloading'
  const percent = Math.max(0, Math.min(100, status.percent ?? 0))

  const install = async (): Promise<void> => {
    setStartedAt(status.state)
    try {
      // Em "available" isso baixa; em "downloaded" reinicia e instala.
      await window.zoi.update.install()
    } catch {
      setStartedAt(null)
      pushToast('warning', 'Nao foi possivel iniciar a atualizacao.')
    }
  }

  return (
    <div className="z-update" role="status">
      <div className="z-update__head">
        <span className="z-update__icon" aria-hidden="true">
          <DownloadIcon size={16} />
        </span>
        <div className="z-update__copy">
          <strong className="z-update__title">
            {downloading
              ? 'Baixando atualizacao'
              : downloaded
                ? 'Atualizacao pronta'
                : 'Atualizacao disponivel'}
          </strong>
          <span className="z-update__text">
            {downloading
              ? `${percent}% concluido.`
              : downloaded
                ? `A versao ${version ?? 'nova'} sera aplicada ao reiniciar.`
                : `Uma versao nova${version ? ` (${version})` : ''} do Zói da Goiaba esta pronta para baixar.`}
          </span>
        </div>
        <IconButton label="Dispensar aviso de atualizacao" onClick={dismissUpdate}>
          <CloseIcon size={16} />
        </IconButton>
      </div>

      {downloading ? (
        <div
          className="z-update__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          {/* Barra em scaleX: animacao so de transform (UISPEC secao 2). */}
          <span className="z-update__bar" style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
      ) : (
        <div className="z-update__actions">
          <Button size="sm" onClick={dismissUpdate}>
            Agora nao
          </Button>
          <Button size="sm" variant="primary" loading={starting} onClick={() => void install()}>
            {downloaded ? 'Reiniciar e atualizar' : 'Baixar atualizacao'}
          </Button>
        </div>
      )}
    </div>
  )
}
