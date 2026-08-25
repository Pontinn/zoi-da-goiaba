// Toast do UISPEC (secao 3): canto inferior direito, entrada translateY+fade em
// 180ms, auto-dismiss em 4s. Os sons ja sao tocados pela sessao; aqui so o texto.
import { useEffect } from 'react'
import { TOAST_TTL_MS, useAppStore, type ToastItem } from '../../store/app-store'

function ToastRow({ toast }: { toast: ToastItem }): JSX.Element {
  const dismissToast = useAppStore((state) => state.dismissToast)

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), TOAST_TTL_MS)
    return () => clearTimeout(timer)
  }, [toast.id, dismissToast])

  return (
    <div className={`z-toast z-toast--${toast.tone}`} role="status">
      <span className="z-toast__dot" />
      <span className="z-toast__text">{toast.text}</span>
    </div>
  )
}

export function ToastContainer(): JSX.Element {
  const toasts = useAppStore((state) => state.toasts)

  return (
    <div className="z-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
