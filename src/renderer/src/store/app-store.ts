// Estado de aplicacao (navegacao, identidade, toasts, update). Selectors
// granulares: cada tela assina so o pedaco que usa, para nao re-renderizar a
// arvore da sala (pilar de performance, RNF-12).
import { create } from 'zustand'
import type { UpdateStatus } from '@shared/ipc'
import type { ToastTone } from '../core/room-state'

export type Route = 'boot' | 'first-run' | 'home' | 'create' | 'join' | 'room' | 'ended'

export interface ToastItem {
  id: number
  tone: ToastTone
  text: string
}

/** Duracao de exibicao de um toast (UISPEC secao 3). */
export const TOAST_TTL_MS = 4_000

let toastSeq = 0

export interface AppStore {
  route: Route
  /** Erro fatal do bootstrap (IPC indisponivel): a UI nunca fica em branco. */
  bootError: string | null
  nickname: string
  installId: string
  version: string
  toasts: ToastItem[]
  updateStatus: UpdateStatus | null
  updateDismissed: boolean

  setRoute: (route: Route) => void
  setBootError: (message: string | null) => void
  setIdentity: (identity: { nickname: string; installId: string }) => void
  setNickname: (nickname: string) => void
  setVersion: (version: string) => void
  pushToast: (tone: ToastTone, text: string) => void
  dismissToast: (id: number) => void
  setUpdateStatus: (status: UpdateStatus) => void
  dismissUpdate: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  route: 'boot',
  bootError: null,
  nickname: '',
  installId: '',
  version: '',
  toasts: [],
  updateStatus: null,
  updateDismissed: false,

  setRoute: (route) => set({ route }),
  setBootError: (bootError) => set({ bootError }),
  setIdentity: ({ nickname, installId }) => set({ nickname, installId }),
  setNickname: (nickname) => set({ nickname }),
  setVersion: (version) => set({ version }),
  pushToast: (tone, text) =>
    set((current) => {
      toastSeq += 1
      // Teto defensivo: uma rajada de eventos nunca vira uma pilha infinita.
      const toasts = [...current.toasts, { id: toastSeq, tone, text }]
      return { toasts: toasts.slice(-5) }
    }),
  dismissToast: (id) =>
    set((current) => ({ toasts: current.toasts.filter((toast) => toast.id !== id) })),
  setUpdateStatus: (updateStatus) => set({ updateStatus, updateDismissed: false }),
  dismissUpdate: () => set({ updateDismissed: true })
}))
