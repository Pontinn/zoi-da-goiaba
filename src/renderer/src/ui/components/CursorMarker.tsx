// Marcador do cursor de um espectador (RF-06/RF-24/RF-25/RF-26): a seta na cor
// da pessoa mais o nome dela.
//
// A prop e `fill: string`, e NAO `PersonColor`: o marcador nunca usa o `soft`
// (esse e do fundo do avatar), e a janela de overlay do transmissor recebe so a
// cor de preenchimento no frame de IPC. Com `PersonColor` a janela precisaria de
// um adaptador para reusar este mesmo componente.
//
// O `forwardRef` existe porque quem move o marcador e o `CursorHub`, escrevendo
// `style.transform` direto no elemento a 30 quadros por segundo: passar posicao
// por prop custaria um render de React por quadro.
import { forwardRef, memo } from 'react'
import './cursor.css'

export interface CursorMarkerProps {
  nickname: string
  /** `hsl(...)` ja resolvido da paleta de `@shared/person-colors`. */
  fill: string
  /** Parado ha mais de `CURSOR_IDLE_MS`: esmaece sem sair (RF-26). */
  idle: boolean
}

export const CursorMarker = memo(
  forwardRef<HTMLSpanElement, CursorMarkerProps>(function CursorMarker(
    { nickname, fill, idle },
    ref
  ) {
    return (
      <span
        ref={ref}
        className={idle ? 'z-cursor z-cursor--idle' : 'z-cursor'}
        data-testid="cursor-marker"
      >
        <span className="z-cursor__body">
          <svg
            className="z-cursor__arrow"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            aria-hidden="true"
          >
            {/* O contorno escuro e o que separa a seta de QUALQUER quadro de video. */}
            <path
              d="M2 1 L2 14.2 L5.3 11 L7.4 15.4 L9.9 14.2 L7.8 9.9 L12 9.6 Z"
              fill={fill}
              stroke="#0e0b12"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          </svg>
          <span className="z-cursor__name" style={{ color: fill, borderColor: fill }}>
            {nickname}
          </span>
        </span>
      </span>
    )
  })
)
