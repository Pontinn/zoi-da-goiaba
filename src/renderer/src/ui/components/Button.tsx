// Botao do UISPEC (secao 3): variantes primary / secondary / danger / ghost.
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  loading = false,
  icon,
  children,
  className,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element {
  const classes = [
    'z-btn',
    `z-btn--${variant}`,
    size === 'md' ? '' : `z-btn--${size}`,
    block ? 'z-btn--block' : '',
    className ?? ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button {...rest} type={type} className={classes} disabled={disabled || loading}>
      {loading ? <span className="z-btn__spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
}

export function IconButton({
  label,
  children,
  className,
  type = 'button',
  ...rest
}: IconButtonProps): JSX.Element {
  return (
    <button
      {...rest}
      type={type}
      className={['z-icon-btn', className ?? ''].filter(Boolean).join(' ')}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  )
}
