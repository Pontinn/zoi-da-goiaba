// Miniatura de transmissao do UISPEC (secao 3). Regras de performance da SPEC:
// componente memoizado, `srcObject` atribuido UMA vez por stream via ref estavel
// e sempre `muted` (o audio toca so no player).
import { memo, useEffect, useRef } from 'react'
import { AlertIcon, VolumeIcon } from './icons'

export interface StreamThumbnailProps {
  txId: string
  stream: MediaStream | null
  nickname: string
  presetLabel: string
  hasAudio: boolean
  isSelf: boolean
  watching: boolean
  reconnecting: boolean
  /** A midia foi atendida e nunca chegou (conexao direta entre as redes). */
  failed: boolean
  onSelect: (txId: string) => void
}

export const StreamThumbnail = memo(function StreamThumbnail({
  txId,
  stream,
  nickname,
  presetLabel,
  hasAudio,
  isSelf,
  watching,
  reconnecting,
  failed,
  onSelect
}: StreamThumbnailProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const attachedRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    // Cinto de seguranca do bloqueio de auto-visualizacao (RF-09): a propria
    // transmissao nunca e anexada ao video, em nenhum uso deste componente.
    if (isSelf) return
    const element = videoRef.current
    if (!element || !stream || attachedRef.current === stream) return
    attachedRef.current = stream
    element.srcObject = stream
    void element.play().catch(() => {
      /* autoplay de video mudo nao costuma falhar; ignorar em caso raro */
    })
  }, [stream, isSelf])

  return (
    <button
      className={watching ? 'z-thumb z-thumb--watching' : 'z-thumb'}
      onClick={() => {
        if (isSelf) return
        onSelect(txId)
      }}
      data-testid="stream-thumb"
      data-tx-id={txId}
      title={`Assistir ${nickname}`}
    >
      <video className="z-thumb__video" ref={videoRef} muted playsInline autoPlay />
      {isSelf ? <span className="z-thumb__self">sua transmissao</span> : null}
      {failed ? (
        <span className="z-thumb__failure" data-testid="thumb-failure">
          <AlertIcon size={18} />
          <span className="z-thumb__failure-title">O video nao chegou ate voce</span>
          <span className="z-thumb__failure-text">A conexao direta entre as redes falhou.</span>
        </span>
      ) : stream ? null : (
        <span className="z-empty__text" style={{ position: 'absolute', inset: 'auto 0 50% 0' }}>
          conectando video...
        </span>
      )}
      <span className="z-thumb__foot">
        <span className="z-thumb__name">{nickname}</span>
        <span className="z-thumb__tags">
          {reconnecting ? <span className="z-thumb__tag">reconectando</span> : null}
          {hasAudio ? (
            <span className="z-thumb__tag" title="com audio do sistema">
              <VolumeIcon size={11} />
            </span>
          ) : null}
          <span className="z-thumb__tag">{presetLabel}</span>
        </span>
      </span>
    </button>
  )
})
