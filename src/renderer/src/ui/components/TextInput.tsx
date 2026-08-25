// Input de texto do UISPEC (secao 3): foco com borda accent + anel accent-soft,
// erro inline em pt-BR e contador opcional de caracteres.
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string | null
  counter?: string
  trailing?: ReactNode
  mono?: boolean
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, error, counter, trailing, mono = false, className, id, ...rest },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="z-field">
      {label ? (
        <label className="z-field__label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <div className="z-field__wrap">
        <input
          {...rest}
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={[
            'z-input',
            mono ? 'z-input--mono' : '',
            error ? 'z-input--invalid' : '',
            className ?? ''
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {trailing}
      </div>
      <div className="z-field__footer">
        {error ? (
          <span className="z-field__error" id={`${inputId}-error`} role="alert">
            {error}
          </span>
        ) : hint ? (
          <span className="z-field__hint" id={`${inputId}-hint`}>
            {hint}
          </span>
        ) : (
          <span />
        )}
        {counter ? <span className="z-field__counter">{counter}</span> : null}
      </div>
    </div>
  )
})
