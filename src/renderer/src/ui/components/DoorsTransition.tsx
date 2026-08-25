// Transicao "portas da sala": fecham na vertical ao pedir entrada, seguram a
// cena enquanto a admissao real acontece (marca pulsando + "conectando") e abrem
// na horizontal quando a sala aparece. Somente transform/opacity.
import { createPortal } from 'react-dom'
import logoGoiaba from '../../assets/brand/logo-goiaba.png'
import { DOOR_CLOSE_MS, DOOR_OPEN_MS, useAppStore } from '../../store/app-store'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const wait = (ms: number): Promise<void> => delay(prefersReducedMotion() ? 0 : ms)

/** Tempo minimo de portas fechadas: o momento da marca pulsando sempre aparece. */
export const DOOR_MIN_HOLD_MS = 1_500
/** Piso menor no caminho de erro: evita o flash, sem prender o usuario. */
export const DOOR_FAILURE_HOLD_MS = 400

let closedSince = 0

/** Fecha as portas e so resolve quando elas estao cobrindo a tela. */
export async function closeDoors(): Promise<void> {
  useAppStore.getState().setDoorPhase('closing')
  await wait(DOOR_CLOSE_MS)
  closedSince = Date.now()
  if (useAppStore.getState().doorPhase === 'closing') {
    useAppStore.getState().setDoorPhase('closed')
  }
}

/**
 * Abre as portas (sucesso ou erro): ninguem fica preso atras delas. O tempo de
 * espera e `max(piso, tempo real de conexao)`, nunca um temporizador fixo.
 */
export async function openDoors(options: { failed?: boolean } = {}): Promise<void> {
  const store = useAppStore.getState()
  if (store.doorPhase === 'idle') return
  const floor = options.failed ? DOOR_FAILURE_HOLD_MS : DOOR_MIN_HOLD_MS
  const elapsed = Date.now() - closedSince
  if (elapsed < floor) await delay(floor - elapsed)
  useAppStore.getState().setDoorPhase('opening')
  await wait(DOOR_OPEN_MS)
  if (useAppStore.getState().doorPhase === 'opening') {
    useAppStore.getState().setDoorPhase('idle')
  }
}

export function DoorsTransition(): JSX.Element | null {
  const phase = useAppStore((state) => state.doorPhase)
  if (phase === 'idle') return null

  return createPortal(
    <div className={`z-doors z-doors--${phase}`} role="status" aria-live="polite">
      <div className="z-doors__panel z-doors__panel--top" />
      <div className="z-doors__panel z-doors__panel--bottom" />
      <div className="z-doors__center">
        <img className="z-doors__logo" src={logoGoiaba} alt="" aria-hidden="true" />
        <span className="z-doors__label">
          conectando
          <span className="z-doors__dot" />
          <span className="z-doors__dot" />
          <span className="z-doors__dot" />
        </span>
      </div>
    </div>,
    document.body
  )
}
