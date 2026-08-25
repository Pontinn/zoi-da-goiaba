// Janela flutuante do video (SPEC secao 2.8, RF-27).
//
// DECISAO DE REALIDADE: o Document Picture-in-Picture EXISTE no Electron 43.4.1
// (`'documentPictureInPicture' in window === true`), mas chamar `requestWindow()`
// DERRUBA o renderer (target crashed) mesmo autorizando a janela no
// `setWindowOpenHandler` do main. Exercitado e reproduzido aqui. Por isso o app
// usa o PiP NATIVO do elemento de video, que e exatamente o fallback previsto na
// SPEC: janela sempre no topo, com os controles do proprio sistema.
export interface OpenPipOptions {
  video: HTMLVideoElement
  /** Chamado quando a janela flutuante fecha por qualquer via. */
  onClose: () => void
}

export interface PipSession {
  close(): void
}

let active: { session: PipSession; video: HTMLVideoElement } | null = null

/** Deteccao de suporte feita no boot (SPEC step 5 do Sprint 8). */
export function isPipSupported(): boolean {
  return document.pictureInPictureEnabled
}

export function isPipActive(): boolean {
  return active !== null
}

/** Abre a janela flutuante com o video atual. */
export async function openPip(options: OpenPipOptions): Promise<PipSession | null> {
  if (!document.pictureInPictureEnabled) return null
  if (active) active.session.close()

  const { video } = options
  try {
    await video.requestPictureInPicture()
  } catch (error) {
    console.warn('[pip] nao foi possivel abrir a janela flutuante:', error)
    return null
  }

  const onLeave = (): void => {
    video.removeEventListener('leavepictureinpicture', onLeave)
    if (active?.video === video) active = null
    options.onClose()
  }
  video.addEventListener('leavepictureinpicture', onLeave)

  const session: PipSession = {
    close: () => {
      if (document.pictureInPictureElement === video) {
        void document.exitPictureInPicture().catch(() => {})
      }
    }
  }
  active = { session, video }
  return session
}

/** Fecha a janela flutuante ativa (transmissao encerrada, saida da sala). */
export function closePip(): void {
  active?.session.close()
}
