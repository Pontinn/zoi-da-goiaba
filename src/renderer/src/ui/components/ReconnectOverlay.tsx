// Overlay de reconexao (RF-48/AC-35): o video congela no ultimo quadro (nao
// chegam frames novos) e o spinner - unica animacao continua permitida junto ao
// ponto "ao vivo" - explica o que esta acontecendo.
import { RECONNECT_WINDOW_MS } from '@shared/config'

export function ReconnectOverlay({ nickname }: { nickname: string }): JSX.Element {
  return (
    <div className="z-reconnect" role="status" data-testid="reconnect-overlay">
      <span className="z-spinner z-spinner--lg" />
      <span className="z-reconnect__text">reconectando...</span>
      <span className="z-reconnect__hint">
        {nickname} caiu. Se nao voltar em {Math.round(RECONNECT_WINDOW_MS / 1000)} segundos, a
        transmissao encerra.
      </span>
    </div>
  )
}
