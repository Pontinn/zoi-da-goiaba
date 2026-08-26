// Casca do app: bootstrap de identidade, ligacao com a sessao e roteamento por
// fase. Toda a identidade visual vem de `ui/theme.css` (tokens do UISPEC).
import { useEffect } from 'react'
import './ui/theme.css'
import './ui/components/components.css'
import './ui/screens/screens.css'
import './ui/screens/room.css'
import './ui/screens/player.css'
import { ensureDecodeProbe, setForceVp8 } from './services/codec-capabilities'
import { preloadSounds, setSoundVolume } from './services/sound-player'
import { session } from './services/session'
import { useAppStore } from './store/app-store'
import { attachRoomStore, useRoomStore } from './store/room-store'
import { DoorsTransition } from './ui/components/DoorsTransition'
import { ToastContainer } from './ui/components/Toast'
import { UpdateNotice } from './ui/components/UpdateNotice'
import { CreateRoomScreen } from './ui/screens/CreateRoomScreen'
import { EndedScreen } from './ui/screens/EndedScreen'
import { FirstRunScreen } from './ui/screens/FirstRunScreen'
import { HomeScreen } from './ui/screens/HomeScreen'
import { JoinRoomScreen } from './ui/screens/JoinRoomScreen'
import { RoomScreen } from './ui/screens/RoomScreen'

function BootScreen({ error }: { error: string | null }): JSX.Element {
  return (
    <div className="z-shell">
      <div className="z-boot">
        {error ? (
          <>
            <strong style={{ color: 'var(--danger)' }}>Nao foi possivel iniciar o app</strong>
            <span>{error}</span>
          </>
        ) : (
          <span className="z-spinner z-spinner--lg" aria-label="Carregando" />
        )}
      </div>
    </div>
  )
}

export default function App(): JSX.Element {
  const route = useAppStore((state) => state.route)
  const bootError = useAppStore((state) => state.bootError)
  const phase = useRoomStore((state) => state.room.phase)
  const endReason = useRoomStore((state) => state.room.endReason)
  // Player embutido aberto: os avisos sobem para nao cobrir os controles dele.
  const playerOpen = useRoomStore((state) => state.selectedTxId !== null)

  // Bootstrap: sons, ligacao com a sessao e identidade persistida.
  useEffect(() => {
    const store = useAppStore.getState()
    preloadSounds()
    const detachRoom = attachRoomStore()
    const offToast = session.onToast((toast) => store.pushToast(toast.tone, toast.text))
    const offUpdate = window.zoi.update.onStatus((status) => store.setUpdateStatus(status))

    const bootstrap = async (): Promise<void> => {
      try {
        const [settings, version] = await Promise.all([
          window.zoi.settings.get(),
          window.zoi.app.getVersion()
        ])
        store.setVersion(version)
        // Antes de qualquer som tocavel: nenhum evento de sala chega ate aqui.
        setSoundVolume(settings.soundVolume)
        // O escape PRIMEIRO, para a sonda ja sair com ele valendo. E `void` de
        // proposito: o boot nao espera a sondagem; ate ela resolver a maquina
        // anuncia ['VP8'] e o tick seguinte de 3s ja corrige.
        setForceVp8(settings.forceVp8)
        void ensureDecodeProbe()
        store.setIdentity({ nickname: settings.nickname ?? '', installId: settings.installId })
        if (!settings.nickname) {
          store.setRoute('first-run')
          return
        }
        session.setIdentity(settings.nickname, settings.installId)
        store.setRoute('home')
      } catch (error) {
        store.setBootError(
          error instanceof Error && error.message
            ? error.message
            : 'Falha ao ler as configuracoes locais.'
        )
      }
    }
    void bootstrap()

    return () => {
      detachRoom()
      offToast()
      offUpdate()
    }
  }, [])

  // Fim de sala involuntario (kick/ban/queda) leva para a tela terminal.
  useEffect(() => {
    if (phase !== 'ended' || endReason === 'left') return
    if (useAppStore.getState().route === 'room') useAppStore.getState().setRoute('ended')
  }, [phase, endReason])

  return (
    <div className="z-app">
      {bootError || route === 'boot' ? <BootScreen error={bootError} /> : null}
      {route === 'first-run' ? <FirstRunScreen /> : null}
      {route === 'home' ? <HomeScreen /> : null}
      {route === 'create' ? <CreateRoomScreen /> : null}
      {route === 'join' ? <JoinRoomScreen /> : null}
      {route === 'room' ? <RoomScreen /> : null}
      {route === 'ended' ? <EndedScreen /> : null}
      <div className={playerOpen ? 'z-notices z-notices--player' : 'z-notices'}>
        <UpdateNotice />
        <ToastContainer />
      </div>
      <DoorsTransition />
    </div>
  )
}
