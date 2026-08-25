// A midia foi anunciada, a chamada foi atendida e nenhum quadro chegou: sem
// TURN (RF-42) a conexao direta entre as duas redes pode simplesmente nao
// subir. Antes disso virava um retangulo preto sem explicacao nenhuma (AC-25).
import { AlertIcon } from './icons'

export function MediaFailureOverlay({ nickname }: { nickname: string }): JSX.Element {
  return (
    <div className="z-reconnect z-reconnect--failure" role="status" data-testid="media-failure">
      <span className="z-reconnect__icon">
        <AlertIcon size={24} />
      </span>
      <span className="z-reconnect__text">O video de {nickname} nao chegou ate voce</span>
      <span className="z-reconnect__hint">
        A conexao direta entre as redes falhou. Peca para {nickname} parar e comecar a transmissao
        de novo; se insistir, tentem por outra rede.
      </span>
    </div>
  )
}
