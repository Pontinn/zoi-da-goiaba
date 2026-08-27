// Desenho dos cursores dos espectadores DENTRO da janela de overlay do
// transmissor (RF-06/RF-08/RF-15/RF-24).
//
// Esta janela e burra de proposito: nao tem sessao, nao tem PeerJS, nao tem
// roster e nao conhece o `CursorHub`. Ela so recebe pelo canal
// `pointer-overlay:render` um frame ja RESOLVIDO (apelido e cor prontos) e
// desenha. Todo o resto mora no renderer principal.
//
// Mesma divisao de frequencia da `CursorLayer`: QUEM desenhar vira `useState`
// (muda raramente), ONDE desenhar vira escrita direta no `style.transform` do
// `ref` (muda 30 vezes por segundo). Nenhum `setState` por posicao.
//
// A conversao aqui e DIRETA, sem letterbox: o overlay cobre o monitor inteiro e
// o conteudo compartilhado E o monitor inteiro, entao a fracao vale contra
// `window.innerWidth/innerHeight`.
import { useEffect, useRef, useState } from 'react'
import { CURSOR_IDLE_MS } from '@shared/config'
import type { PointerOverlayFrame } from '@shared/ipc'
import { CursorMarker } from '../ui/components/CursorMarker'

/** Sem nenhum frame por este tempo, a janela limpa tudo (rede contra preso). */
const FRAME_STALL_MS = CURSOR_IDLE_MS * 2

interface VisiblePerson {
  peerId: string
  nickname: string
  fill: string
}

interface Position {
  x: number
  y: number
  idle: boolean
}

/** Assinatura de baixa frequencia: so muda quando QUEM aparece muda. */
function signatureOf(people: readonly VisiblePerson[]): string {
  return people.map((person) => `${person.peerId}/${person.nickname}/${person.fill}`).join('|')
}

function applyPosition(element: HTMLSpanElement, position: Position): void {
  const x = position.x * window.innerWidth
  const y = position.y * window.innerHeight
  element.style.transform = `translate3d(${x}px, ${y}px, 0)`
  element.classList.toggle('z-cursor--idle', position.idle)
}

export function OverlayApp(): JSX.Element {
  const [people, setPeople] = useState<VisiblePerson[]>([])
  const signatureRef = useRef('')
  const markerRefs = useRef(new Map<string, HTMLSpanElement>())
  const positionsRef = useRef(new Map<string, Position>())
  /** `0` ate o primeiro frame; o relogio so e lido dentro de efeito (pureza). */
  const lastFrameAtRef = useRef(0)

  useEffect(() => {
    lastFrameAtRef.current = Date.now()
    const bridge = window.zoi?.pointerOverlay
    if (!bridge) return undefined

    const onFrame = (frame: PointerOverlayFrame): void => {
      lastFrameAtRef.current = Date.now()
      const next: VisiblePerson[] = []
      const seen = new Set<string>()
      for (const pointer of frame.pointers) {
        seen.add(pointer.peerId)
        const position: Position = { x: pointer.x, y: pointer.y, idle: pointer.idle }
        positionsRef.current.set(pointer.peerId, position)
        const element = markerRefs.current.get(pointer.peerId)
        if (element) applyPosition(element, position)
        next.push({ peerId: pointer.peerId, nickname: pointer.nickname, fill: pointer.fill })
      }
      for (const peerId of [...positionsRef.current.keys()]) {
        if (!seen.has(peerId)) positionsRef.current.delete(peerId)
      }
      const signature = signatureOf(next)
      if (signature === signatureRef.current) return
      signatureRef.current = signature
      setPeople(next)
    }

    return bridge.onRender(onFrame)
  }, [])

  // Terceira rede contra ponteiro preso (risco R5), e no lado que a pessoa mais
  // ve: se os frames pararem de chegar (renderer principal travado, transmissao
  // encerrada por um caminho novo), a janela se esvazia sozinha.
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastFrameAtRef.current < FRAME_STALL_MS) return
      if (signatureRef.current === '') return
      signatureRef.current = ''
      positionsRef.current.clear()
      setPeople([])
    }, CURSOR_IDLE_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="z-overlay">
      {people.map((person) => (
        <CursorMarker
          key={person.peerId}
          ref={(element) => {
            if (!element) {
              markerRefs.current.delete(person.peerId)
              return
            }
            markerRefs.current.set(person.peerId, element)
            element.setAttribute('data-peer-id', person.peerId)
            // Posicionar JA no anexo: o marcador nasce sem `transform` e o
            // proximo frame so chega 33 ms depois. Sem isto o cursor apareceria
            // no canto superior esquerdo e deslizaria de la ate o lugar certo.
            const position = positionsRef.current.get(person.peerId)
            if (position) applyPosition(element, position)
          }}
          nickname={person.nickname}
          fill={person.fill}
          idle={false}
        />
      ))}
    </div>
  )
}
