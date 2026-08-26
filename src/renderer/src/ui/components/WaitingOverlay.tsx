// Terceiro irmao da familia de overlays do player (ReconnectOverlay e
// MediaFailureOverlay sao os mais velhos): a transmissao foi aberta, a stream ja
// chegou, e nenhum quadro pintou ainda. E o estado MAIS BRANDO dos tres, entao
// herda a base `.z-reconnect` (fundo #000000a6) e nunca o `--failure` opaco.
//
// Motion (UISPEC secao 6.3, contrato medido): o cartao entra com o `z-fade-in`
// da propria base, a logo entra com o bounce do card de status (unica excecao de
// easing do app), o indicador de espera e um pulso SO de opacity no wrap da logo
// e a troca para o segundo estagio e um crossfade real por grid stacking. A
// saida e o keyframe dedicado `z-fade-out`, aplicado pelo PlayerView.
//
// Puramente apresentacional: sem estado, sem fetch, sem nada interativo (RF-13).
import logoGoiaba from '../../assets/brand/logo-goiaba.png'

/**
 * Copy dos dois estagios, exportada para o teste de unidade poder prova-la sem
 * renderizar (o projeto nao tem Testing Library). pt-BR sem acento, tom dos
 * irmaos, segundo estagio SO com a sugestao de fechar e abrir (RF-12).
 */
export const WAITING_COPY = {
  noticeText: 'conectando a transmissao...',
  noticeHint: (nickname: string): string =>
    'A tela de ' + nickname + ' costuma aparecer em poucos segundos. Aguarde mais um pouco.',
  escalatedText: 'A transmissao esta demorando mais que o normal',
  escalatedHint: (nickname: string): string =>
    'Nenhuma imagem de ' +
    nickname +
    ' chegou ate agora. Feche e abra a transmissao de novo; isso costuma resolver.'
}

export interface WaitingOverlayProps {
  nickname: string
  stage: 'notice' | 'escalated'
  /** Saida em curso: o veu escuro sai por fade, o video por baixo nunca espera. */
  exiting: boolean
}

export function WaitingOverlay({ nickname, stage, exiting }: WaitingOverlayProps): JSX.Element {
  const classes =
    'z-reconnect z-reconnect--waiting' + (exiting ? ' z-reconnect--waiting-exit' : '')

  return (
    <div className={classes} role="status" data-testid="waiting-overlay" data-stage={stage}>
      <span
        className={
          'z-waiting__logo-wrap' + (stage === 'notice' ? ' z-waiting__logo-wrap--pulse' : '')
        }
      >
        <img className="z-waiting__logo" src={logoGoiaba} alt="" aria-hidden="true" />
      </span>

      {/* Os DOIS estagios ficam montados na mesma celula do grid: o crossfade e
          real (um funde para dentro enquanto o outro funde para fora) e o
          container assume a altura do maior, sem pulo de layout. */}
      <span className="z-waiting__swap">
        <span
          className={'z-waiting__stage' + (stage === 'notice' ? ' z-waiting__stage--active' : '')}
        >
          <span className="z-reconnect__text">{WAITING_COPY.noticeText}</span>
          <span className="z-reconnect__hint">{WAITING_COPY.noticeHint(nickname)}</span>
        </span>
        <span
          className={
            'z-waiting__stage' + (stage === 'escalated' ? ' z-waiting__stage--active' : '')
          }
        >
          <span className="z-reconnect__text">{WAITING_COPY.escalatedText}</span>
          <span className="z-reconnect__hint">{WAITING_COPY.escalatedHint(nickname)}</span>
        </span>
      </span>
    </div>
  )
}
