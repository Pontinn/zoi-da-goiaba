// Ultima sala usada, para o atalho de reentrada na home. Fica no armazenamento
// local do renderer (nao e configuracao do app, e conveniencia da UI).
const STORAGE_KEY = 'zoi:last-room'

export function readLastRoom(): string | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value && value.trim().length > 0 ? value : null
  } catch {
    return null
  }
}

export function rememberLastRoom(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code)
  } catch {
    /* sem armazenamento local: o atalho simplesmente nao aparece */
  }
}
