import type { ZoiApi } from '@shared/ipc'

declare global {
  interface Window {
    zoi: ZoiApi
  }
}

export {}
