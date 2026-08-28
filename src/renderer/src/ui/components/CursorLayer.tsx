// Camada dos cursores dos OUTROS espectadores sobre o player (RF-15/RF-24).
//
// Divisao de frequencia, que e a regra que organiza este arquivo (RNF-01):
// - QUEM desenhar muda pouco (alguem entra, alguem some): vem do
//   `subscribeRoster` e e o UNICO `setState` do componente;
// - ONDE desenhar muda 30 vezes por segundo: vem do `subscribeFrame` e e escrito
//   DIRETO no `style.transform` de cada `ref`. Nunca por `setState`.
//
// A camada tambem nao MEDE nada: quem mede o `<video>` e o `PlayerView`, que
// passa o `contentRectRef` por referencia. Ler o `ref` no callback de quadro da
// sempre o valor mais recente sem custar um render.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { ContentRect } from '@shared/geometry'
import { colorOfSlot, resolvePersonSlots } from '@shared/person-colors'
import type { RosterMember } from '@shared/protocol'
import { cursorHub } from '../../services/cursor-hub'
import { CursorMarker } from './CursorMarker'

/** Corrida de roster: um peer sem entrada ainda desenha, com o slot 0. */
const FALLBACK_FILL = colorOfSlot(0).fill

/** Posicao em PIXEIS ja convertida para a caixa do video. */
interface MarkerPosition {
  x: number
  y: number
  idle: boolean
}

function applyPosition(element: HTMLSpanElement, position: MarkerPosition): void {
  element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`
  element.classList.toggle('z-cursor--idle', position.idle)
}

export interface CursorLayerProps {
  txId: string
  /** O transmissor ligou os ponteiros nesta transmissao. */
  enabled: boolean
  videoRef: RefObject<HTMLVideoElement>
  contentRectRef: RefObject<ContentRect | null>
  members: RosterMember[]
  selfPeerId: string
}

export function CursorLayer({
  txId,
  enabled,
  videoRef,
  contentRectRef,
  members,
  selfPeerId
}: CursorLayerProps): JSX.Element {
  const [peerIds, setPeerIds] = useState<string[]>([])
  const markerRefs = useRef(new Map<string, HTMLSpanElement>())
  /**
   * Ultima posicao em PIXEIS de cada peer. Existe por causa da ordem do tick do
   * hub: o quadro sai ANTES do aviso de roster, entao no quadro em que um peer
   * aparece o elemento dele ainda nao foi montado. Sem guardar a posicao aqui, o
   * marcador nasceria sem `transform` (canto do video) e deslizaria de la ate o
   * lugar certo no quadro seguinte, 33 ms depois.
   */
  const positionsRef = useRef(new Map<string, MarkerPosition>())

  /**
   * Nome e cor PRONTOS por pessoa, memoizados: o mesmo criterio do `RoomScreen`,
   * para o `memo` do `CursorMarker` nao ser anulado por um valor novo a cada
   * render. O fallback do nome e o mesmo do `nicknameOf` (`room-state.ts:296`),
   * repetido aqui so porque aquela funcao pede o `RoomState` inteiro e esta
   * camada recebe apenas o roster.
   */
  const people = useMemo(() => {
    const slots = resolvePersonSlots(members)
    const out: Record<string, { nickname: string; fill: string }> = {}
    for (const member of members) {
      out[member.peerId] = {
        nickname: member.nickname,
        fill: colorOfSlot(slots[member.peerId] ?? 0).fill
      }
    }
    return out
  }, [members])

  // QUEM desenhar. O hub entrega a lista corrente na assinatura, entao quem
  // abre o player no meio de uma sessao ja nasce com os ponteiros que existem.
  useEffect(() => {
    if (!enabled) return undefined
    return cursorHub.subscribeRoster(txId, (next) => {
      // Terceira rede de seguranca de RF-14: o proprio cursor nunca e desenhado.
      setPeerIds(next.filter((peerId) => peerId !== selfPeerId))
    })
  }, [txId, enabled, selfPeerId])

  // ONDE desenhar. Escrita imperativa, PROIBIDO `setState` aqui (RNF-01).
  useEffect(() => {
    if (!enabled) return undefined
    return cursorHub.subscribeFrame(txId, (entries) => {
      const rect = contentRectRef.current
      const video = videoRef.current
      if (!rect || !video) return
      const seen = new Set<string>()
      for (const entry of entries) {
        if (entry.peerId === selfPeerId) continue
        seen.add(entry.peerId)
        const position: MarkerPosition = {
          x: rect.left + entry.x * rect.width,
          y: rect.top + entry.y * rect.height,
          idle: entry.idle
        }
        positionsRef.current.set(entry.peerId, position)
        const element = markerRefs.current.get(entry.peerId)
        if (element) applyPosition(element, position)
      }
      for (const peerId of [...positionsRef.current.keys()]) {
        if (!seen.has(peerId)) positionsRef.current.delete(peerId)
      }
    })
  }, [txId, enabled, selfPeerId, videoRef, contentRectRef])

  return (
    <div className="z-cursor-layer" data-testid="cursor-layer">
      {peerIds.map((peerId) => (
        <CursorMarker
          key={peerId}
          ref={(element) => {
            if (!element) {
              markerRefs.current.delete(peerId)
              return
            }
            markerRefs.current.set(peerId, element)
            element.setAttribute('data-peer-id', peerId)
            // Posicionar JA no anexo, antes do primeiro paint: ver o comentario
            // de `positionsRef`.
            const position = positionsRef.current.get(peerId)
            if (position) applyPosition(element, position)
          }}
          nickname={people[peerId]?.nickname ?? peerId.slice(0, 6)}
          fill={people[peerId]?.fill ?? FALLBACK_FILL}
          idle={false}
        />
      ))}
    </div>
  )
}
