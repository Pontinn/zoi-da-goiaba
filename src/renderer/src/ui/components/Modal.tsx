// Modal do UISPEC (secao 3): overlay #000000a6 + caixa elevada com entrada
// scale(0.96 -> 1) + fade em 240ms. Esc fecha; foco inicial dentro da caixa.
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './Button'
import { CloseIcon } from './icons'

export interface ModalProps {
  open: boolean
  title: string
  subtitle?: string
  wide?: boolean
  onClose: () => void
  /** Esconde o X do cabecalho (modais de decisao obrigatoria). */
  hideClose?: boolean
  children: ReactNode
  footer?: ReactNode
}

export function Modal({
  open,
  title,
  subtitle,
  wide = false,
  onClose,
  hideClose = false,
  children,
  footer
}: ModalProps): JSX.Element | null {
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    const focusTarget = boxRef.current?.querySelector<HTMLElement>(
      'input, button, select, [tabindex]:not([tabindex="-1"])'
    )
    focusTarget?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="z-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={wide ? 'z-modal z-modal--wide' : 'z-modal'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={boxRef}
      >
        <div className="z-modal__header">
          <div>
            <h2 className="z-modal__title">{title}</h2>
            {subtitle ? <p className="z-modal__subtitle">{subtitle}</p> : null}
          </div>
          {hideClose ? null : (
            <IconButton label="Fechar" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </div>
        <div className="z-modal__body">{children}</div>
        {footer ? <div className="z-modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}
